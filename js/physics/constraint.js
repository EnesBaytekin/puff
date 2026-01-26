// Constraint class for maintaining distance between two particles
// Uses iterative constraint satisfaction for soft-body physics

class Constraint {
    constructor(particleA, particleB, stiffness = 1.0) {
        this.particleA = particleA;
        this.particleB = particleB;
        this.stiffness = stiffness; // 0.0 = very loose, 1.0 = rigid

        // Calculate initial distance as rest length
        const dx = particleB.x - particleA.x;
        const dy = particleB.y - particleA.y;
        this.restLength = Math.sqrt(dx * dx + dy * dy);
    }

    // Satisfy constraint by moving particles closer or further apart
    satisfy() {
        const dx = this.particleB.x - this.particleA.x;
        const dy = this.particleB.y - this.particleA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return; // Avoid division by zero

        // How much we need to move the particles
        const difference = (distance - this.restLength) / distance;

        // Apply stiffness (lower stiffness = more gradual correction)
        const moveX = dx * difference * this.stiffness * 0.5;
        const moveY = dy * difference * this.stiffness * 0.5;

        // Move particles towards each other (if stretched) or apart (if compressed)
        if (!this.particleA.pinned) {
            this.particleA.x += moveX;
            this.particleA.y += moveY;
        }
        if (!this.particleB.pinned) {
            this.particleB.x -= moveX;
            this.particleB.y -= moveY;
        }
    }

    // Set a specific rest length
    setRestLength(length) {
        this.restLength = length;
    }
}
