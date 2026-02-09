/**
 * Physics solver for Drift minigame
 * Uses momentum-based movement with imaginary hitbox (billiard ball style)
 */
class DriftSolver {
    constructor(softBody) {
        this.softBody = softBody;
        this.particles = softBody.getParticles();

        // Hitbox configuration (imaginary circle for collision)
        this.hitboxRadius = softBody.radius * 0.75; // Hitbox is 75% of puff radius (larger)

        // Physics parameters
        this.friction = 0.985; // Friction coefficient (0-1, lower = more friction)
        this.wallBounce = 0.9; // Wall bounce energy retention (0-1) - almost perfect bounce

        // Push force configuration - much smaller now
        this.basePushForce = 0.5; // Reduced from 50 to 0.5

        // Energy-based modifiers
        this.energy = 50; // Will be updated from puff state
    }

    /**
     * Update energy from puff state
     */
    updateEnergy(energy) {
        this.energy = energy;
    }

    /**
     * Get energy factor (0-1)
     */
    getEnergyFactor() {
        return Math.max(0, Math.min(1, this.energy / 100));
    }

    /**
     * Get hitbox center (face center) and radius
     * Hitbox is imaginary - used only for collision detection
     */
    getHitbox() {
        const center = this.getCreatureCenter();
        return {
            x: center.x,
            y: center.y,
            radius: this.hitboxRadius
        };
    }

    /**
     * Apply push force from touch/click
     * @param {number} touchX - Touch X position
     * @param {number} touchY - Touch Y position
     */
    applyPushForce(touchX, touchY) {
        const hitbox = this.getHitbox();

        const dx = hitbox.x - touchX;
        const dy = hitbox.y - touchY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Force calculation:
        // - Much smaller overall
        // - Proportional to distance (closer = slightly more force)
        // - But still small even when close

        const maxDistance = 500; // pixels
        const normalizedDistance = Math.min(distance / maxDistance, 1);

        // Force is ALWAYS small, increases slightly with proximity
        // At touch (distance=0): force = basePushForce
        // At maxDistance: force = basePushForce * 0.3
        const proximityMultiplier = 1 - (normalizedDistance * 0.7);
        const forceMagnitude = this.basePushForce * proximityMultiplier;

        // Normalize direction
        const dirX = distance > 0 ? dx / distance : 0;
        const dirY = distance > 0 ? dy / distance : 0;

        // Energy affects responsiveness
        const energyFactor = this.getEnergyFactor();
        const energyMultiplier = 0.3 + energyFactor * 0.7;

        const finalForceX = dirX * forceMagnitude * energyMultiplier;
        const finalForceY = dirY * forceMagnitude * energyMultiplier;

        // Apply force to all particles (distributed equally)
        for (const particle of this.particles) {
            particle.applyForce(finalForceX * particle.mass, finalForceY * particle.mass);
        }
    }

    /**
     * Update physics
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     */
    update(canvasWidth, canvasHeight) {
        this.softBody.canvasWidth = canvasWidth;
        this.softBody.canvasHeight = canvasHeight;

        // Update particle positions (Verlet integration)
        for (const particle of this.particles) {
            particle.update();

            // Apply friction
            const vx = particle.getVelocityX();
            const vy = particle.getVelocityY();

            // Energy affects friction - low energy = more friction (stops faster)
            const energyFactor = this.getEnergyFactor();
            const dynamicFriction = 0.96 + energyFactor * 0.03;

            particle.oldX = particle.x - vx * dynamicFriction;
            particle.oldY = particle.y - vy * dynamicFriction;
        }

        // Satisfy constraints multiple times for stability
        const iterations = 5;
        for (let i = 0; i < iterations; i++) {
            for (const constraint of this.softBody.getConstraints()) {
                constraint.satisfy();
            }

            // Wall collision with proper bounce
            this.handleWallCollisions(canvasWidth, canvasHeight);
        }
    }

    /**
     * Handle wall collision with proper bounce (billiard style)
     * Uses hitbox for collision detection
     */
    handleWallCollisions(width, height) {
        const hitbox = this.getHitbox();
        const margin = hitbox.radius;
        const bounce = this.wallBounce;

        // Check each particle
        for (const particle of this.particles) {
            let bounced = false;
            let newPosX = particle.x;
            let newPosY = particle.y;
            let velX = particle.getVelocityX();
            let velY = particle.getVelocityY();

            // Left wall
            if (hitbox.x - margin < 0) {
                const overlap = -(hitbox.x - margin);
                newPosX = particle.x + overlap;
                if (velX < 0) {
                    velX = -velX * bounce;
                    bounced = true;
                }
            }

            // Right wall
            if (hitbox.x + margin > width) {
                const overlap = (hitbox.x + margin) - width;
                newPosX = particle.x - overlap;
                if (velX > 0) {
                    velX = -velX * bounce;
                    bounced = true;
                }
            }

            // Top wall
            if (hitbox.y - margin < 0) {
                const overlap = -(hitbox.y - margin);
                newPosY = particle.y + overlap;
                if (velY < 0) {
                    velY = -velY * bounce;
                    bounced = true;
                }
            }

            // Bottom wall
            if (hitbox.y + margin > height) {
                const overlap = (hitbox.y + margin) - height;
                newPosY = particle.y - overlap;
                if (velY > 0) {
                    velY = -velY * bounce;
                    bounced = true;
                }
            }

            // Apply position correction and velocity reflection
            if (bounced) {
                particle.x = newPosX;
                particle.y = newPosY;

                // Reflect velocity by modifying oldX/oldY
                // This simulates proper bounce
                particle.oldX = particle.x - velX;
                particle.oldY = particle.y - velY;
            }
        }
    }

    /**
     * Get the center position of the creature (hitbox center)
     */
    getCreatureCenter() {
        let sumX = 0;
        let sumY = 0;
        for (const p of this.particles) {
            sumX += p.x;
            sumY += p.y;
        }
        return {
            x: sumX / this.particles.length,
            y: sumY / this.particles.length
        };
    }

    /**
     * Check if creature is roughly stationary
     */
    isStationary() {
        let totalVelocity = 0;
        for (const p of this.particles) {
            const vx = p.getVelocityX();
            const vy = p.getVelocityY();
            totalVelocity += Math.sqrt(vx * vx + vy * vy);
        }
        const avgVelocity = totalVelocity / this.particles.length;
        return avgVelocity < 0.3;
    }
}
