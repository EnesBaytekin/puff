/**
 * Particle effect for visual feedback
 * Used when target is completed
 */
class ParticleEffect {
    constructor(x, y, color = '150, 255, 150') {
        this.x = x;
        this.y = y;
        this.color = color;

        // Random velocity in all directions
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        // Particle properties
        this.radius = 3 + Math.random() * 5;
        this.life = 1.0; // 1.0 to 0.0
        this.decay = 0.015 + Math.random() * 0.01; // Decay rate
        this.gravity = 0.05;
    }

    /**
     * Update particle
     */
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity; // Apply gravity
        this.life -= this.decay;
    }

    /**
     * Check if particle is dead
     */
    isDead() {
        return this.life <= 0;
    }

    /**
     * Render particle
     */
    render(ctx) {
        if (this.isDead()) return;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * this.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color}, ${this.life * 0.8})`;
        ctx.fill();
    }
}

/**
 * Particle system manager
 */
class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    /**
     * Spawn particles at position
     */
    spawn(x, y, count = 20, color = '150, 255, 150') {
        for (let i = 0; i < count; i++) {
            // Add slight randomness to position
            const offsetX = (Math.random() - 0.5) * 20;
            const offsetY = (Math.random() - 0.5) * 20;
            this.particles.push(new ParticleEffect(x + offsetX, y + offsetY, color));
        }
    }

    /**
     * Update all particles
     */
    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].isDead()) {
                this.particles.splice(i, 1);
            }
        }
    }

    /**
     * Render all particles
     */
    render(ctx) {
        for (const particle of this.particles) {
            particle.render(ctx);
        }
    }

    /**
     * Check if system has active particles
     */
    hasParticles() {
        return this.particles.length > 0;
    }
}
