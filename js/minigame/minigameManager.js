/**
 * Manages mini game lifecycle
 * Handles switching between main game and mini games
 */
class MinigameManager {
    constructor(canvas, softBody, physicsSolver, inputHandler) {
        this.canvas = canvas;
        this.softBody = softBody;
        this.physicsSolver = physicsSolver;
        this.inputHandler = inputHandler;

        this.currentMinigame = null;
        this.isMinigameActive = false;
        this.originalPhysicsState = null;
        this.originalInputState = null;

        // Store minigame classes for registration
        this.registeredMinigames = new Map();
    }

    /**
     * Register a minigame class
     * @param {string} name - Minigame identifier (e.g., 'drift')
     * @param {Class} MinigameClass - Minigame class constructor
     */
    registerMinigame(name, MinigameClass) {
        this.registeredMinigames.set(name, MinigameClass);
    }

    /**
     * Start a minigame by name
     * @param {string} minigameName - Name of the minigame to start
     * @param {Object} initialState - Current puff state
     */
    startMinigame(minigameName, initialState) {
        if (this.isMinigameActive) {
            console.warn('Minigame already active');
            return;
        }

        console.log('[MinigameManager] Starting minigame with initialState:', initialState);

        const MinigameClass = this.registeredMinigames.get(minigameName);
        if (!MinigameClass) {
            console.error(`Minigame '${minigameName}' not found`);
            return;
        }

        // Save original physics and input state
        this.saveOriginalState();

        // Create and start minigame
        this.currentMinigame = new MinigameClass(this.canvas, this.softBody, initialState);
        this.currentMinigame.onExit(() => this.endMinigame());
        this.currentMinigame.onStateChange((changes) => this.onMinigameStateChange(changes));

        this.currentMinigame.start(initialState);
        this.isMinigameActive = true;

        console.log('[MinigameManager] Minigame started. softBody.puffState:', this.softBody.puffState);

        // Show minigame UI
        this.showMinigameUI();

        console.log(`Started minigame: ${minigameName}`);
    }

    /**
     * End the current minigame
     */
    endMinigame() {
        if (!this.isMinigameActive || !this.currentMinigame) {
            return;
        }

        // Get final state changes (should be zero now - live updates handle everything)
        const stateChanges = this.currentMinigame.end();

        console.log('[MinigameManager] Minigame ended, state changes (should be zero):', stateChanges);

        // NO LONGER applying state changes here - live updates already synced everything
        // this.applyStateChanges(stateChanges); // REMOVED - prevents double-update

        // Cleanup
        this.currentMinigame = null;
        this.isMinigameActive = false;

        // Restore original physics and input state
        this.restoreOriginalState();

        // Hide minigame UI
        this.hideMinigameUI();

        console.log('Minigame ended cleanly');
    }

    /**
     * Update current minigame (called every frame)
     */
    update(deltaTime) {
        if (this.isMinigameActive && this.currentMinigame) {
            this.currentMinigame.update(deltaTime);
        }
    }

    /**
     * Render current minigame (called every frame)
     */
    render(ctx) {
        if (this.isMinigameActive && this.currentMinigame) {
            this.currentMinigame.render(ctx);
        }
    }

    /**
     * Handle input events
     */
    handleInput(type, data) {
        if (this.isMinigameActive && this.currentMinigame) {
            this.currentMinigame.handleInput(type, data);
        }
    }

    /**
     * Check if a minigame is currently active
     */
    isGameActive() {
        return this.isMinigameActive;
    }

    /**
     * Get the current active minigame
     */
    getCurrentMinigame() {
        return this.currentMinigame;
    }

    /**
     * Save original physics and input state before starting minigame
     */
    saveOriginalState() {
        // Store that we need to restore these later
        this.originalPhysicsState = {
            solver: this.physicsSolver
        };
        this.originalInputState = {
            handler: this.inputHandler
        };
    }

    /**
     * Restore original physics and input state after minigame
     */
    restoreOriginalState() {
        // Original objects are still valid, just restore references
        this.physicsSolver = this.originalPhysicsState.solver;
        this.inputHandler = this.originalInputState.handler;
    }

    /**
     * Apply state changes from minigame to main game
     */
    applyStateChanges(changes) {
        // This will be handled by StateManager
        // Just notify that changes occurred
        if (changes && typeof this.onStateApplied === 'function') {
            this.onStateApplied(changes);
        }
    }

    /**
     * Handle state changes during minigame (live updates)
     */
    onMinigameStateChange(changes) {
        console.log('[MinigameManager] State change received:', changes);
        // Update progress bars in real-time
        if (changes && typeof this.onStateApplied === 'function') {
            this.onStateApplied(changes);
        }
    }

    /**
     * Register callback for state application
     */
    onStateApplied(callback) {
        this.onStateApplied = callback;
    }

    /**
     * Show minigame-specific UI
     */
    showMinigameUI() {
        const overlay = document.getElementById('minigame-overlay');
        const exitBtn = document.getElementById('minigame-exit-btn');

        if (overlay) overlay.classList.add('active');
        if (exitBtn) exitBtn.classList.add('active');

        // Hide control buttons during minigame
        this.toggleControlButtons(false);
    }

    /**
     * Hide minigame-specific UI
     */
    hideMinigameUI() {
        const overlay = document.getElementById('minigame-overlay');
        const exitBtn = document.getElementById('minigame-exit-btn');

        if (overlay) overlay.classList.remove('active');
        if (exitBtn) exitBtn.classList.remove('active');

        // Show control buttons after minigame
        this.toggleControlButtons(true);
    }

    /**
     * Toggle control buttons visibility
     */
    toggleControlButtons(show) {
        const topControls = document.querySelector('.top-controls');
        const bottomControls = document.querySelector('.bottom-controls');

        if (show) {
            if (topControls) topControls.style.display = '';
            if (bottomControls) bottomControls.style.display = '';
        } else {
            if (topControls) topControls.style.display = 'none';
            if (bottomControls) bottomControls.style.display = 'none';
        }
    }
}
