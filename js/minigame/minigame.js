/**
 * Base class for all mini games
 * Provides a common interface that all mini games must implement
 */
class Minigame {
    constructor(canvas, softBody) {
        this.canvas = canvas;
        this.softBody = softBody;
        this.isActive = false;
        this.onExitCallback = null;
        this.onStateChangeCallback = null;
    }

    /**
     * Called when the minigame starts
     * @param {Object} initialState - Current puff state {hunger, mood, energy}
     */
    start(initialState) {
        this.isActive = true;
        this.setup();
    }

    /**
     * Called when the minigame ends
     * @returns {Object} Final state changes to apply {energyDelta, moodDelta, etc.}
     */
    end() {
        this.isActive = false;
        this.cleanup();
        return this.getStateChanges();
    }

    /**
     * Setup method - override in subclass
     * Initialize game-specific resources
     */
    setup() {
        // Override in subclass
    }

    /**
     * Cleanup method - override in subclass
     * Release game-specific resources
     */
    cleanup() {
        // Override in subclass
    }

    /**
     * Update method - called every frame
     * @param {number} deltaTime - Time since last frame in ms
     */
    update(deltaTime) {
        // Override in subclass
    }

    /**
     * Render method - called every frame after update
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    render(ctx) {
        // Override in subclass
    }

    /**
     * Handle input events
     * @param {string} type - Event type ('touchstart', 'touchmove', 'touchend', etc.)
     * @param {Object} data - Event data {x, y, etc.}
     */
    handleInput(type, data) {
        // Override in subclass
    }

    /**
     * Get state changes to apply when game ends
     * @returns {Object} State changes {energyDelta, moodDelta, etc.}
     */
    getStateChanges() {
        return {
            energyDelta: 0,
            moodDelta: 0,
            hungerDelta: 0
        };
    }

    /**
     * Register callback for when game exits
     */
    onExit(callback) {
        this.onExitCallback = callback;
    }

    /**
     * Register callback for state changes (live updates during game)
     */
    onStateChange(callback) {
        this.onStateChangeCallback = callback;
    }

    /**
     * Notify state change (call this during game to update UI)
     */
    notifyStateChange() {
        if (this.onStateChangeCallback) {
            const changes = this.getStateChanges();
            this.onStateChangeCallback(changes);
        }
    }

    /**
     * Exit the game
     */
    exit() {
        if (this.onExitCallback) {
            this.onExitCallback();
        }
    }

    /**
     * Check if game is currently active
     */
    isGameActive() {
        return this.isActive;
    }
}
