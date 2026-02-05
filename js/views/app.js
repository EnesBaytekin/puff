// Main app view
const AppView = {
    canvas: null,
    creature: null,
    physicsSolver: null,
    inputHandler: null,
    foodDragHandler: null,
    stateManager: null,
    animationFrameId: null,
    isPanelOpen: false,

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
        // Close food panel first
        this.closeFoodPanel();

        const toggleBtn = document.getElementById('status-toggle-btn');
        const overlay = document.getElementById('status-overlay');
        const panel = document.getElementById('status-panel');

        if (toggleBtn) toggleBtn.classList.add('active');
        overlay.classList.add('active');
        panel.classList.add('active');
        this.isPanelOpen = true;
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

        if (statusOverlay) statusOverlay.classList.remove('active');
        if (foodOverlay) foodOverlay.classList.remove('active');
        if (statusPanel) statusPanel.classList.remove('active');
        if (foodPanel) foodPanel.classList.remove('active');
        if (statusToggleBtn) statusToggleBtn.classList.remove('active');
        if (foodToggleBtn) foodToggleBtn.classList.remove('active');

        this.isPanelOpen = false;

        // Clear canvas if exists
        if (this.canvas) {
            this.canvas.clear();
        }
    }
};
