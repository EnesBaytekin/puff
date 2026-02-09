/**
 * Drift & Catch Minigame
 * Push puff with touches, catch targets by holding puff inside circles
 */
class DriftGame extends Minigame {
    constructor(canvas, softBody, initialState) {
        super(canvas, softBody);

        this.initialState = initialState || { energy: 50, mood: 50, hunger: 50 };
        this.currentEnergy = this.initialState.energy;

        // Game state
        this.targetsCaught = 0;
        this.gameStartTime = 0;
        this.totalPlayTime = 0;

        // Physics solver for this game
        this.driftSolver = null;

        // Target system
        this.targetCircle = null;

        // Energy decay
        this.baseEnergyDecayRate = 0.05; // per second (faster than normal)
        this.lastDecayTime = 0;

        // Mood boost on target catch
        this.moodBoostPerTarget = 5;

        // Touch input
        this.activeTouches = new Map(); // touchId -> {x, y}
    }

    /**
     * Setup game resources
     */
    setup() {
        // Initialize drift solver
        this.driftSolver = new DriftSolver(this.softBody);
        this.driftSolver.updateEnergy(this.currentEnergy);

        // Initialize particle system
        this.particleSystem = new ParticleSystem();

        // Create first target
        this.spawnNewTarget();

        this.gameStartTime = Date.now();
        this.lastDecayTime = Date.now();

        console.log('DriftGame started');
    }

    /**
     * Cleanup game resources
     */
    cleanup() {
        this.driftSolver = null;
        this.targetCircle = null;
        this.activeTouches.clear();
        console.log('DriftGame cleaned up');
    }

    /**
     * Spawn a new target at random position
     */
    spawnNewTarget() {
        const canvasWidth = this.canvas.getWidth();
        const canvasHeight = this.canvas.getHeight();

        // Target should be large enough to contain the entire hitbox
        // Hitbox is 75% of puff radius, target is 1.5x hitbox
        const hitboxRadius = this.softBody.radius * 0.75;
        const targetRadius = hitboxRadius * 1.5; // 1.5x gives enough room

        const margin = targetRadius + 50;
        const x = margin + Math.random() * (canvasWidth - margin * 2);
        const y = margin + Math.random() * (canvasHeight - margin * 2);

        this.targetCircle = new TargetCircle(x, y, targetRadius, 3000); // 3 seconds
    }

    /**
     * Update game logic
     */
    update(deltaTime) {
        if (!this.isActive) return;

        const now = Date.now();

        // Update physics
        this.driftSolver.update(this.canvas.getWidth(), this.canvas.getHeight());

        // Update current energy from softBody state (may have changed)
        this.currentEnergy = this.softBody.puffState?.energy || this.currentEnergy;
        this.driftSolver.updateEnergy(this.currentEnergy);

        // Apply energy decay (faster during minigame)
        this.applyEnergyDecay(now);

        // Update target
        if (this.targetCircle) {
            const hitbox = this.driftSolver.getHitbox();
            const justCompleted = this.targetCircle.update(hitbox, deltaTime);

            if (justCompleted) {
                this.onTargetCaught();
            }
        }

        // Update particles
        if (this.particleSystem) {
            this.particleSystem.update();
        }

        // Update total play time
        this.totalPlayTime = now - this.gameStartTime;
    }

    /**
     * Apply energy decay during gameplay
     */
    applyEnergyDecay(now) {
        const timeSinceLastDecay = now - this.lastDecayTime;

        if (timeSinceLastDecay >= 1000) { // Every second
            // Energy decays faster during minigame
            const decayAmount = this.baseEnergyDecayRate * (timeSinceLastDecay / 1000);
            this.currentEnergy = Math.max(1, this.currentEnergy - decayAmount);

            // Update softBody state
            if (this.softBody.puffState) {
                this.softBody.puffState.energy = Math.round(this.currentEnergy);
            }

            // Notify state change for UI update
            this.notifyStateChange();

            this.lastDecayTime = now;
        }
    }

    /**
     * Handle target caught event
     */
    onTargetCaught() {
        this.targetsCaught++;

        // Spawn particle effect at target position
        if (this.targetCircle && this.particleSystem) {
            this.particleSystem.spawn(
                this.targetCircle.x,
                this.targetCircle.y,
                30, // particle count
                '150, 255, 150' // green color
            );
        }

        // Boost mood
        const currentMood = this.softBody.puffState?.mood || 50;
        const newMood = Math.min(100, currentMood + this.moodBoostPerTarget);
        if (this.softBody.puffState) {
            this.softBody.puffState.mood = Math.round(newMood);
        }

        console.log(`Target caught! Total: ${this.targetsCaught}`);

        // Spawn new target
        this.spawnNewTarget();

        // Notify state change
        this.notifyStateChange();
    }

    /**
     * Render game
     */
    render(ctx) {
        if (!this.isActive) return;

        // Render target circle
        if (this.targetCircle) {
            this.targetCircle.render(ctx);
        }

        // Render particles
        if (this.particleSystem) {
            this.particleSystem.render(ctx);
        }

        // Stats hidden - no text overlay
    }

    /**
     * Render game stats (minimal, in corner)
     */
    renderStats(ctx) {
        const padding = 20;
        const fontSize = 14;

        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = 'rgba(100, 100, 100, 0.6)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // Targets caught
        ctx.fillText(`Targets: ${this.targetsCaught}`, padding, padding);

        // Play time (seconds)
        const seconds = Math.floor(this.totalPlayTime / 1000);
        ctx.fillText(`Time: ${seconds}s`, padding, padding + fontSize + 5);
    }

    /**
     * Handle input events
     */
    handleInput(type, data) {
        if (!this.isActive) return;

        switch (type) {
            case 'touchstart':
            case 'mousedown':
                this.handleTouchStart(data);
                break;
            case 'touchmove':
            case 'mousemove':
                this.handleTouchMove(data);
                break;
            case 'touchend':
            case 'mouseup':
                this.handleTouchEnd(data);
                break;
        }
    }

    /**
     * Handle touch start
     */
    handleTouchStart(data) {
        const touchId = data.identifier || 'mouse';
        this.activeTouches.set(touchId, { x: data.x, y: data.y });

        // Apply push force
        this.driftSolver.applyPushForce(data.x, data.y);
    }

    /**
     * Handle touch move
     */
    handleTouchMove(data) {
        const touchId = data.identifier || 'mouse';
        this.activeTouches.set(touchId, { x: data.x, y: data.y });

        // Continuous push while dragging
        this.driftSolver.applyPushForce(data.x, data.y);
    }

    /**
     * Handle touch end
     */
    handleTouchEnd(data) {
        const touchId = data.identifier || 'mouse';
        this.activeTouches.delete(touchId);
    }

    /**
     * Get state changes when game ends
     */
    getStateChanges() {
        // Calculate energy delta (negative = lost energy)
        const energyDelta = this.currentEnergy - this.initialState.energy;

        // Calculate mood delta (positive = gained mood from targets)
        const moodDelta = (this.softBody.puffState?.mood || this.initialState.mood) - this.initialState.mood;

        return {
            energyDelta: Math.round(energyDelta),
            moodDelta: Math.round(moodDelta),
            hungerDelta: 0
        };
    }
}
