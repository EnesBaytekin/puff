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

        const timeSinceInteraction = Date.now() - this.lastInteractionTime;
        const isIdling = timeSinceInteraction > this.idleDelay;

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

                    // Pick a random direction and distance
                    const angle = Math.random() * Math.PI * 2;
                    const distance = 80 + Math.random() * 120; // 80-200 pixels

                    this.idleTargetX = this.idleStartX + Math.cos(angle) * distance;
                    this.idleTargetY = this.idleStartY + Math.sin(angle) * distance;

                    // Keep target within screen bounds
                    const margin = 150;
                    this.idleTargetX = Math.max(margin, Math.min(canvasWidth - margin, this.idleTargetX));
                    this.idleTargetY = Math.max(margin, Math.min(canvasHeight - margin, this.idleTargetY));
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

            // Gentle spring force toward center (weaker when idling)
            const centeringStrength = isIdling ? 0.002 : 0.01;
            particle.applyForce(dx * centeringStrength, dy * centeringStrength);

            // Apply idle movement force
            particle.applyForce(idleForceX * particle.mass * 0.1, idleForceY * particle.mass * 0.1);
        }

        // Update particle positions (Verlet integration)
        for (const particle of particles) {
            particle.update();

            // Apply damping
            const vx = particle.getVelocityX();
            const vy = particle.getVelocityY();

            particle.oldX = particle.x - vx * this.damping;
            particle.oldY = particle.y - vy * this.damping;
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
