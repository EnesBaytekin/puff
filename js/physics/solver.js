// Physics solver for the soft-body simulation
// Handles gravity, damping, and constraint satisfaction

class PhysicsSolver {
    constructor(gravity = 0.5, damping = 0.98, iterations = 5) {
        this.gravity = gravity;
        this.damping = damping; // Air resistance
        this.iterations = iterations; // Constraint iterations per frame
        this.lastInteractionTime = Date.now();

        // Idle behavior state
        this.idleDelay = 10000; // Wait 10 seconds before starting idle
        this.idleState = 'waiting'; // 'waiting' or 'moving'
        this.idleStateStartTime = Date.now();
        this.idleTargetX = 0;
        this.idleTargetY = 0;
        this.idleStartX = 0;
        this.idleStartY = 0;
        this.idleMoveDuration = 3000; // 3 seconds to move to new location
        this.idleWaitDuration = 4000; // Wait 4 seconds between movements
    }

    // Update all particles and constraints
    update(softBody, canvasWidth, canvasHeight) {
        const particles = softBody.getParticles();
        const constraints = softBody.getConstraints();

        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        // Calculate dynamic damping based on energy
        // Low energy = high damping (sluggish), high energy = low damping (responsive)
        const energy = softBody.puffState.energy || 50;
        const energyFactor = energy / 100; // 0 = exhausted, 1 = full energy
        // Damping: 0.9995 (exhausted, zero oscillation) to 0.95 (full energy, normal)
        const dynamicDamping = 0.9995 - energyFactor * 0.0495;

        // Dynamic centering strength based on energy
        // Low energy = very weak centering (sluggish return), high energy = normal centering
        // 0.001 (exhausted) to 0.01 (full energy)
        const dynamicCenteringStrength = 0.001 + energyFactor * 0.009;

        // Extra stiffness for low energy - prevents wobbling
        // Low energy = direct position correction (no physics), high energy = normal physics
        const useDirectCorrection = energy < 30; // Below 30 energy

        // Dynamic idle delay - low energy takes much longer to start idling
        const dynamicIdleDelay = 5000 + (1 - energyFactor) * 15000; // 5s (high energy) to 20s (low energy)

        const timeSinceInteraction = Date.now() - this.lastInteractionTime;
        const isIdling = timeSinceInteraction > dynamicIdleDelay;

        // Handle idle state machine
        let idleForceX = 0;
        let idleForceY = 0;

        if (isIdling) {
            const stateElapsedTime = Date.now() - this.idleStateStartTime;

            if (this.idleState === 'waiting') {
                // Waiting between movements
                if (stateElapsedTime > this.idleWaitDuration) {
                    // Start a new movement
                    this.idleState = 'moving';
                    this.idleStateStartTime = Date.now();

                    // Get current creature center position
                    const creature = this.getCreatureCenter(particles);
                    this.idleStartX = creature.x;
                    this.idleStartY = creature.y;

                    // Pick a random direction and distance (based on energy)
                    const energy = softBody.puffState.energy || 50;
                    const energyFactor = energy / 100;
                    const angle = Math.random() * Math.PI * 2;

                    // Low energy = barely moves (0-5px), high energy = normal wandering (80-200px)
                    // Using energyFactor^2 for more dramatic curve
                    const movementScale = energyFactor * energyFactor; // Squared for more dramatic effect
                    const minDistance = movementScale * 80; // 0 to 80
                    const maxDistance = movementScale * 200; // 0 to 200
                    const distance = minDistance + Math.random() * (maxDistance - minDistance);

                    // If energy is very low, skip this idle movement entirely
                    if (distance < 5) {
                        this.idleState = 'waiting';
                        this.idleStateStartTime = Date.now();
                        return;
                    }

                    this.idleTargetX = this.idleStartX + Math.cos(angle) * distance;
                    this.idleTargetY = this.idleStartY + Math.sin(angle) * distance;

                    // Keep target within screen bounds
                    const margin = 150;
                    this.idleTargetX = Math.max(margin, Math.min(canvasWidth - margin, this.idleTargetX));
                    this.idleTargetY = Math.max(margin, Math.min(canvasHeight - margin, this.idleTargetY));

                    // Dynamic movement duration - low energy = slower movement
                    const energyFactorDuration = energy / 100;
                    // Low energy: 8 seconds, high energy: 3 seconds
                    this.idleMoveDuration = 8000 - energyFactorDuration * 5000; // 8000 to 3000ms
                }
            } else if (this.idleState === 'moving') {
                // Moving to a new location
                if (stateElapsedTime > this.idleMoveDuration) {
                    // Movement complete, start waiting
                    this.idleState = 'waiting';
                    this.idleStateStartTime = Date.now();
                } else {
                    // Calculate progress (0 to 1) with easing
                    const t = stateElapsedTime / this.idleMoveDuration;
                    const easedT = this.easeInOutCubic(t);

                    // Current target position during movement
                    const currentTargetX = this.idleStartX + (this.idleTargetX - this.idleStartX) * easedT;
                    const currentTargetY = this.idleStartY + (this.idleTargetY - this.idleStartY) * easedT;

                    // Calculate force toward current target
                    const creature = this.getCreatureCenter(particles);
                    const dx = currentTargetX - creature.x;
                    const dy = currentTargetY - creature.y;

                    idleForceX = dx * 0.03;
                    idleForceY = dy * 0.03;
                }
            }
        }

        // Apply gentle centering force + idle movement
        for (const particle of particles) {
            const dx = centerX - particle.x;
            const dy = centerY - particle.y;

            // Gentle spring force toward center
            // When idling, use even weaker force (handled by dynamicCenteringStrength being energy-based)
            // Low energy = very weak centering (sluggish), high energy = normal
            const centeringStrength = isIdling ? dynamicCenteringStrength * 0.3 : dynamicCenteringStrength;
            particle.applyForce(dx * centeringStrength, dy * centeringStrength);

            // Apply idle movement force (low energy = barely moves)
            particle.applyForce(idleForceX * particle.mass * 0.1, idleForceY * particle.mass * 0.1);

            // Extra damping for low energy - directly reduce velocity to prevent oscillation
            if (useDirectCorrection && !isIdling) {
                // When returning to center after drag, heavily dampen
                const velX = particle.getVelocityX();
                const velY = particle.getVelocityY();
                particle.oldX = particle.x - velX * 0.9; // Heavy damping
                particle.oldY = particle.y - velY * 0.9;
            }
        }

        // Update particle positions (Verlet integration)
        for (const particle of particles) {
            particle.update();

            // Apply dynamic damping based on energy
            const vx = particle.getVelocityX();
            const vy = particle.getVelocityY();

            particle.oldX = particle.x - vx * dynamicDamping;
            particle.oldY = particle.y - vy * dynamicDamping;
        }

        // Satisfy constraints multiple times for stability
        for (let i = 0; i < this.iterations; i++) {
            for (const constraint of constraints) {
                constraint.satisfy();
            }

            // Keep particles on screen
            for (const particle of particles) {
                this.constrainToBounds(particle, canvasWidth, canvasHeight);
            }
        }
    }

    // Keep particle within canvas bounds
    constrainToBounds(particle, width, height) {
        const margin = 20; // Keep creature away from edges

        if (particle.x < margin) {
            particle.x = margin;
        } else if (particle.x > width - margin) {
            particle.x = width - margin;
        }

        if (particle.y < margin) {
            particle.y = margin;
        } else if (particle.y > height - margin) {
            particle.y = height - margin;
        }
    }

    // Apply drag force to a particle (for user interaction)
    applyDrag(particle, targetX, targetY, strength = 0.3) {
        if (!particle) return;

        // Update interaction time (prevents idle movement while dragging)
        this.lastInteractionTime = Date.now();

        const dx = targetX - particle.x;
        const dy = targetY - particle.y;

        // Apply spring-like force toward target
        particle.x += dx * strength;
        particle.y += dy * strength;
    }

    // Call this when user interacts (touch/mouse)
    markInteraction() {
        this.lastInteractionTime = Date.now();
        // Reset idle state when user interacts
        this.idleState = 'waiting';
        this.idleStateStartTime = Date.now();
    }

    // Get the center position of the creature
    getCreatureCenter(particles) {
        let sumX = 0;
        let sumY = 0;
        for (const p of particles) {
            sumX += p.x;
            sumY += p.y;
        }
        return {
            x: sumX / particles.length,
            y: sumY / particles.length
        };
    }

    // Easing function for smooth movement (slow start, fast middle, slow end)
    easeInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
}
