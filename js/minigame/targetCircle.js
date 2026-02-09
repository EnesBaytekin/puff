/**
 * Target circle for Drift minigame
 * Player must keep puff inside the circle for a duration
 */
class TargetCircle {
    constructor(x, y, radius, requiredDuration = 3000) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.requiredDuration = requiredDuration; // ms
        this.currentDuration = 0; // ms
        this.isCompleted = false;
        this.pulsePhase = 0; // For visual pulsing effect
    }

    /**
     * Update target circle state
     * @param {Object} hitbox - Puff hitbox {x, y, radius}
     * @param {number} deltaTime - Time since last frame in ms
     * @returns {boolean} True if target was just completed
     */
    update(hitbox, deltaTime) {
        // Update pulse phase for visual effect
        this.pulsePhase += deltaTime * 0.003;

        // Check if ENTIRE hitbox is inside circle
        const isFullyInside = this.containsHitbox(hitbox);

        // DEBUG: Log hitbox position (every 60 frames = ~1 sec)
        if (Math.random() < 0.016) { // Approx every second
            console.log('[TargetCircle] Hitbox:', hitbox, 'Circle:', {x: this.x, y: this.y, radius: this.radius}, 'isFullyInside:', isFullyInside, 'currentDuration:', this.currentDuration, 'required:', this.requiredDuration);
        }

        if (isFullyInside && !this.isCompleted) {
            this.currentDuration += deltaTime;

            // Check if target is completed
            if (this.currentDuration >= this.requiredDuration) {
                this.isCompleted = true;
                console.log('[TargetCircle] TARGET COMPLETED! Returning true');
                return true; // Just completed
            }
        } else {
            // Reset progress if hitbox leaves circle
            this.currentDuration = Math.max(0, this.currentDuration - deltaTime * 2);
        }

        return false;
    }

    /**
     * Check if a point is inside the circle
     */
    containsPoint(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= this.radius;
    }

    /**
     * Check if entire hitbox is inside the circle
     * The hitbox must be completely contained for success
     */
    containsHitbox(hitbox) {
        // For the hitbox to be completely inside the circle,
        // the farthest point of the hitbox must still be within the circle
        const dx = hitbox.x - this.x;
        const dy = hitbox.y - this.y;
        const centerDistance = Math.sqrt(dx * dx + dy * dy);

        // Farthest point distance = centerDistance + hitboxRadius
        const farthestPointDistance = centerDistance + hitbox.radius;

        return farthestPointDistance <= this.radius;
    }

    /**
     * Get progress percentage (0-1)
     */
    getProgress() {
        return Math.min(1, this.currentDuration / this.requiredDuration);
    }

    /**
     * Render the target circle
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    render(ctx) {
        const progress = this.getProgress();

        // Pulse effect - slight radius change
        const pulseScale = 1 + Math.sin(this.pulsePhase) * 0.02;
        const pulseRadius = this.radius * pulseScale;

        // Draw filled background - warm amber/gold
        ctx.beginPath();
        ctx.arc(this.x, this.y, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 180, 50, 0.12)'; // Amber
        ctx.fill();

        // Draw dashed circle (main target indicator) - amber/orange
        ctx.beginPath();
        ctx.arc(this.x, this.y, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 160, 60, 0.9)'; // Orange/amber, very visible
        ctx.lineWidth = 2; // Thin
        ctx.setLineDash([15, 10]); // Dashed
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        // Draw progress arc LAST (on top) - vibrant green, solid, thicker
        if (progress > 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, pulseRadius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
            ctx.strokeStyle = 'rgba(60, 180, 60, 1)'; // Darker vibrant green, solid
            ctx.lineWidth = 7; // Thicker, more prominent
            ctx.stroke();
        }

        // Draw completion effect
        if (this.isCompleted) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, pulseRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(100, 230, 100, 1)'; // Bright green
            ctx.lineWidth = 8;
            ctx.stroke();

            // Glow effect
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, pulseRadius * 1.5);
            gradient.addColorStop(0, 'rgba(100, 230, 100, 0.6)');
            gradient.addColorStop(1, 'rgba(100, 230, 100, 0)');
            ctx.fillStyle = gradient;
            ctx.fill();
        }
    }

    /**
     * Respawn at a new random position
     */
    respawn(canvasWidth, canvasHeight) {
        const margin = 100;
        this.x = margin + Math.random() * (canvasWidth - margin * 2);
        this.y = margin + Math.random() * (canvasHeight - margin * 2);
        this.currentDuration = 0;
        this.isCompleted = false;
        this.pulsePhase = 0;
    }
}
