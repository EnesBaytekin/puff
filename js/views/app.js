// Main app view
const AppView = {
    canvas: null,
    creature: null,
    physicsSolver: null,
    inputHandler: null,
    foodDragHandler: null,
    stateManager: null,
    minigameManager: null,
    animationFrameId: null,
    isPanelOpen: false,
    lastFrameTime: 0,

    init(puffData) {
        // Clean up previous instance if exists
        this.cleanup();

        // Initialize canvas
        this.canvas = new Canvas('canvas');

        // Create creature with custom color and state
        const centerX = this.canvas.getWidth() / 2;
        const centerY = this.canvas.getHeight() / 2;
        const radius = Math.min(this.canvas.getWidth(), this.canvas.getHeight()) * 0.15;

        // Extract puff state or use defaults (handle null values)
        const puffState = {
            hunger: puffData.hunger ?? 50,
            mood: puffData.mood ?? 50,
            energy: puffData.energy ?? 50
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

        // Initialize minigame manager
        this.minigameManager = new MinigameManager(
            this.canvas,
            this.creature,
            this.physicsSolver,
            this.inputHandler
        );

        // Register minigames
        this.minigameManager.registerMinigame('drift', DriftGame);

        // Set minigame manager reference in input handler
        this.inputHandler.setMinigameManager(this.minigameManager);

        // Setup state change callback for minigame
        this.minigameManager.onStateApplied((changes) => {
            if (this.stateManager) {
                // Update state manager with changes
                this.stateManager.handleMinigameStateChanges(changes);
            }
        });

        // Setup minigame UI
        this.setupMinigameUI();

        // Initialize StateManager (handles decay, sync, etc.)
        // Skip localStorage on first load to get fresh data from server
        this.stateManager = new StateManager(this, puffState, true);

        // Fetch latest state from server (with offline decay)
        this.stateManager.fetchFromServer().then((state) => {
            if (state) {
                // Update creature state
                this.creature.updateState(state);
                // Update progress bars
                this.updateProgressBars(state);
            }
        });

        // Setup logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                API.logout();
            };
        }

        // Setup status panel
        this.setupStatusPanel(puffState);

        // Initialize food drag handler (after status panel setup)
        this.foodDragHandler = new FoodDragHandler(this);

        // Start the game loop
        this.startLoop();
    },

    setupStatusPanel(initialState) {
        const toggleBtn = document.getElementById('status-toggle-btn');
        const statusOverlay = document.getElementById('status-overlay');
        const statusPanel = document.getElementById('status-panel');

        // Open status panel
        toggleBtn.addEventListener('click', () => {
            this.openStatusPanel();
        });

        // Close button handler
        const closeBtn = statusPanel.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeStatusPanel();
            });
        }

        // Overlay click handler
        statusOverlay.addEventListener('click', () => {
            this.closeStatusPanel();
        });

        // Update progress bars with initial values
        this.updateProgressBars(initialState);
    },

    openStatusPanel() {
        // Close food panel and settings panel first
        this.closeFoodPanel();
        this.closeSettingsPanel();

        const toggleBtn = document.getElementById('status-toggle-btn');
        const overlay = document.getElementById('status-overlay');
        const panel = document.getElementById('status-panel');

        if (toggleBtn) toggleBtn.classList.add('active');
        overlay.classList.add('active');
        panel.classList.add('active');
        this.isPanelOpen = true;
    },

    closeSettingsPanel() {
        // Global settings panel
        const overlay = document.getElementById('settings-overlay');
        const panel = document.getElementById('settings-panel');
        const buttons = document.querySelectorAll('[id^="settings-toggle-btn"]');

        if (overlay) overlay.classList.remove('active');
        if (panel) panel.classList.remove('active');
        buttons.forEach(btn => btn.classList.remove('active'));
    },

    closeStatusPanel() {
        const toggleBtn = document.getElementById('status-toggle-btn');
        const overlay = document.getElementById('status-overlay');
        const panel = document.getElementById('status-panel');

        if (toggleBtn) toggleBtn.classList.remove('active');
        overlay.classList.remove('active');
        panel.classList.remove('active');
        this.isPanelOpen = false;
    },

    closeFoodPanel() {
        if (this.foodDragHandler) {
            this.foodDragHandler.closeFoodPanel();
        }
    },

    setupMinigameUI() {
        const toggleBtn = document.getElementById('minigame-toggle-btn');
        const exitBtn = document.getElementById('minigame-exit-btn');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.startMinigame();
            });
        }

        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                this.endMinigame();
            });
        }
    },

    startMinigame() {
        // Close all panels first
        this.closeStatusPanel();
        this.closeFoodPanel();
        this.closeSettingsPanel();

        // Get current puff state
        const currentState = {
            energy: this.creature.puffState.energy,
            mood: this.creature.puffState.mood,
            hunger: this.creature.puffState.hunger
        };

        // Start drift minigame
        this.minigameManager.startMinigame('drift', currentState);
    },

    endMinigame() {
        if (this.minigameManager && this.minigameManager.isGameActive()) {
            this.minigameManager.endMinigame();

            // Update progress bars with final state
            const finalState = this.creature.puffState;
            this.updateProgressBars(finalState);
        }
    },

    updateProgressBars(state) {
        const hungerBar = document.getElementById('hunger-bar');
        const moodBar = document.getElementById('mood-bar');
        const energyBar = document.getElementById('energy-bar');

        // Handle null/undefined values - default to 50
        const hunger = state.hunger ?? 50;
        const mood = state.mood ?? 50;
        const energy = state.energy ?? 50;

        if (hungerBar) hungerBar.style.width = hunger + '%';
        if (moodBar) moodBar.style.width = mood + '%';
        if (energyBar) energyBar.style.width = energy + '%';
    },

    startLoop() {
        this.lastFrameTime = performance.now();

        const update = (currentTime) => {
            // Calculate delta time in milliseconds
            const deltaTime = currentTime - this.lastFrameTime;
            this.lastFrameTime = currentTime;

            // Check if minigame is active
            if (this.minigameManager && this.minigameManager.isGameActive()) {
                // Update minigame
                this.minigameManager.update(deltaTime);

                // Clear canvas
                this.canvas.clear();

                // Draw creature
                this.creature.draw(this.canvas.getContext());

                // Render minigame
                this.minigameManager.render(this.canvas.getContext());
            } else {
                // Normal game loop
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
            }

            // Request next frame
            this.animationFrameId = requestAnimationFrame(update);
        };

        this.animationFrameId = requestAnimationFrame(update);
    },

    cleanup() {
        // Stop animation loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // End minigame if active
        if (this.minigameManager && this.minigameManager.isGameActive()) {
            this.minigameManager.endMinigame();
        }

        // Stop StateManager decay loop
        if (this.stateManager) {
            this.stateManager.cleanup();
            this.stateManager = null;
        }

        // Close panels
        const statusOverlay = document.getElementById('status-overlay');
        const foodOverlay = document.getElementById('food-overlay');
        const statusPanel = document.getElementById('status-panel');
        const foodPanel = document.getElementById('food-panel');
        const statusToggleBtn = document.getElementById('status-toggle-btn');
        const foodToggleBtn = document.getElementById('food-toggle-btn');
        const minigameOverlay = document.getElementById('minigame-overlay');
        const minigameExitBtn = document.getElementById('minigame-exit-btn');

        if (statusOverlay) statusOverlay.classList.remove('active');
        if (foodOverlay) foodOverlay.classList.remove('active');
        if (statusPanel) statusPanel.classList.remove('active');
        if (foodPanel) foodPanel.classList.remove('active');
        if (statusToggleBtn) statusToggleBtn.classList.remove('active');
        if (foodToggleBtn) foodToggleBtn.classList.remove('active');
        if (minigameOverlay) minigameOverlay.classList.remove('active');
        if (minigameExitBtn) minigameExitBtn.classList.remove('active');

        this.isPanelOpen = false;

        // Clear canvas if exists
        if (this.canvas) {
            this.canvas.clear();
        }
    }
};
