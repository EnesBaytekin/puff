// Main app view
const AppView = {
    canvas: null,
    creature: null,
    physicsSolver: null,
    inputHandler: null,
    animationFrameId: null,

    init(puffData) {
        // Clean up previous instance if exists
        this.cleanup();

        // Initialize canvas
        this.canvas = new Canvas('canvas');

        // Create creature with custom color and state
        const centerX = this.canvas.getWidth() / 2;
        const centerY = this.canvas.getHeight() / 2;
        const radius = Math.min(this.canvas.getWidth(), this.canvas.getHeight()) * 0.15;

        // Extract puff state or use defaults
        const puffState = {
            hunger: puffData.hunger || 50,
            mood: puffData.mood || 50,
            energy: puffData.energy || 50
        };

        this.creature = new SoftBody(centerX, centerY, radius, 20, puffData.color, puffState);

        // Initialize physics solver
        this.physicsSolver = new PhysicsSolver(
            0,      // gravity (disabled - using centering force instead)
            0.98,   // damping
            5       // constraint iterations
        );

        // Initialize input handler
        this.inputHandler = new InputHandler(this.canvas, this.creature, this.physicsSolver);

        // Setup logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                API.logout();
            };
        }

        // Setup test sliders
        this.setupTestSliders(puffState);

        // Start the game loop
        this.startLoop();
    },

    setupTestSliders(initialState) {
        const hungerSlider = document.getElementById('hunger-slider');
        const moodSlider = document.getElementById('mood-slider');
        const energySlider = document.getElementById('energy-slider');
        const hungerValue = document.getElementById('hunger-value');
        const moodValue = document.getElementById('mood-value');
        const energyValue = document.getElementById('energy-value');

        // Set initial values
        hungerSlider.value = initialState.hunger;
        moodSlider.value = initialState.mood;
        energySlider.value = initialState.energy;
        hungerValue.textContent = initialState.hunger;
        moodValue.textContent = initialState.mood;
        energyValue.textContent = initialState.energy;

        // Helper function to update state with debounce
        let updateTimeout = null;
        const updateState = () => {
            const newState = {
                hunger: parseInt(hungerSlider.value),
                mood: parseInt(moodSlider.value),
                energy: parseInt(energySlider.value)
            };

            // Update display values
            hungerValue.textContent = newState.hunger;
            moodValue.textContent = newState.mood;
            energyValue.textContent = newState.energy;

            // Update creature immediately for visual feedback
            this.creature.updateState(newState);

            // Debounced API call
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                API.updatePuffState(newState).catch(err => {
                    console.error('Failed to update puff state:', err);
                });
            }, 500);
        };

        // Add event listeners
        hungerSlider.addEventListener('input', updateState);
        moodSlider.addEventListener('input', updateState);
        energySlider.addEventListener('input', updateState);
    },

    startLoop() {
        const update = () => {
            // Apply organic deformation (continuous morphing)
            this.creature.applyOrganicDeformation();

            // Apply continuous drag force (keeps creature under finger while holding)
            this.inputHandler.continuousDrag();

            // Update physics
            this.physicsSolver.update(this.creature, this.canvas.getWidth(), this.canvas.getHeight());

            // Clear canvas
            this.canvas.clear();

            // Draw creature
            this.creature.draw(this.canvas.getContext());

            // Request next frame
            this.animationFrameId = requestAnimationFrame(update);
        };

        update();
    },

    cleanup() {
        // Stop animation loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Clear canvas if exists
        if (this.canvas) {
            this.canvas.clear();
        }
    }
};
