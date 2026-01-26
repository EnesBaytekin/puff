// Particle class for soft-body physics
// Uses Verlet integration: position is updated based on previous position

class Particle {
    constructor(x, y, mass = 1.0, pinned = false) {
        this.x = x;
        this.y = y;
        this.oldX = x; // Previous position (for Verlet integration)
        this.oldY = y;
        this.mass = mass;
        this.pinned = pinned; // If true, particle doesn't move
        this.forceX = 0;
        this.forceY = 0;
    }

    // Get velocity (derived from position change)
    getVelocityX() {
        return this.x - this.oldX;
    }

    getVelocityY() {
        return this.y - this.oldY;
    }

    // Apply force to particle
    applyForce(fx, fy) {
        this.forceX += fx;
        this.forceY += fy;
    }

    // Update position using Verlet integration
    // acceleration = force / mass
    // newPosition = position + velocity + acceleration * dt * dt
    update(dt = 1.0) {
        if (this.pinned) return;

        const vx = this.getVelocityX();
        const vy = this.getVelocityY();

        // Store current position as old position
        this.oldX = this.x;
        this.oldY = this.y;

        // Apply acceleration from forces
        const ax = this.forceX / this.mass;
        const ay = this.forceY / this.mass;

        // Update position
        this.x += vx + ax * dt * dt;
        this.y += vy + ay * dt * dt;

        // Reset forces
        this.forceX = 0;
        this.forceY = 0;
    }

    // Manually set position (for dragging)
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        // Don't update oldX/oldY - this creates velocity when released
    }

    // Stop all movement
    stop() {
        this.oldX = this.x;
        this.oldY = this.y;
    }
}
