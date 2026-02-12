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

        // Initialize accessory asset loader (load config and preload all images)
        AccessoryAssetLoader.loadConfig().then(() => {
            return AccessoryAssetLoader.preloadAll();
        }).then(() => {
            console.log('[App] Accessory assets loaded');

            // Load accessories from server data
            if (puffData.accessories && typeof puffData.accessories === 'object') {
                this.loadAccessories(puffData.accessories);
            }
        }).catch(err => {
            console.error('[App] Failed to load accessory assets:', err);
        });

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
        // DISABLED: Live updates cause reference sharing issues
        // Only sync state when minigame ends, not during gameplay
        /*
        this.minigameManager.onStateApplied((changes) => {
            if (this.stateManager) {
                // Update state manager with changes
                this.stateManager.handleMinigameStateChanges(changes);
            }
        });
        */

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

        // Initialize wardrobe system
        WardrobeSystem.init(this);

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
        // Close food panel, settings panel and wardrobe first
        this.closeFoodPanel();
        this.closeSettingsPanel();
        this.closeWardrobePanel();

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

    closeWardrobePanel() {
        if (WardrobeSystem) {
            WardrobeSystem.closeWardrobe();
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
        this.closeWardrobePanel();

        // Sync creature with StateManager's current state first!
        // Create NEW object to avoid reference sharing
        if (this.stateManager && this.stateManager.currentState) {
            const newState = {
                hunger: this.stateManager.currentState.hunger,
                mood: this.stateManager.currentState.mood,
                energy: this.stateManager.currentState.energy
            };
            console.log('[App] Creating NEW puffState object for creature:', newState);
            this.creature.puffState = newState;
        }

        // Get current puff state from creature (now synced)
        const currentState = {
            energy: this.creature.puffState.energy,
            mood: this.creature.puffState.mood,
            hunger: this.creature.puffState.hunger
        };

        console.log('[App] Starting minigame with state:', currentState);

        // Start drift minigame
        this.minigameManager.startMinigame('drift', currentState);
    },

    endMinigame() {
        if (this.minigameManager && this.minigameManager.isGameActive()) {
            this.minigameManager.endMinigame();

            // Sync final state from creature to StateManager
            // Create NEW object to avoid reference sharing
            const finalState = this.creature.puffState;
            if (this.stateManager && finalState) {
                this.stateManager.currentState = {
                    hunger: finalState.hunger,
                    mood: finalState.mood,
                    energy: finalState.energy
                };
                console.log('[App] Syncing final state to StateManager:', this.stateManager.currentState);
                this.stateManager.updateUI();
            }

            // Update progress bars
            this.updateProgressBars(finalState);

            console.log('[App] Minigame ended, final state:', finalState);
        }
    },

    updateProgressBars(state) {
        const hungerBar = document.getElementById('hunger-bar');
        const moodBar = document.getElementById('mood-bar');
        const energyBar = document.getElementById('energy-bar');

        // Handle null/undefined values - default to 50
        // IMPORTANT: Create NEW values to avoid reference sharing
        const hunger = (state && state.hunger !== undefined) ? Math.round(state.hunger) : 50;
        const mood = (state && state.mood !== undefined) ? Math.round(state.mood) : 50;
        const energy = (state && state.energy !== undefined) ? Math.round(state.energy) : 50;

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

                // Apply organic deformation for visual morphing based on mood/energy
                this.creature.applyOrganicDeformation();

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

    loadAccessories(accessories) {
        // Load accessories from server data
        if (!this.creature || !this.creature.accessoryRenderer) return;

        const renderer = this.creature.accessoryRenderer;

        // IMPORTANT: Don't clear existing accessories directly!
        // Server data contains user's saved accessories - we should preserve them
        // Instead, we'll merge server accessories with user's current equipped items

        // Load each accessory from server data
        for (const [slot, accessoryData] of Object.entries(accessories)) {
            if (accessoryData && accessoryData.id) {
                // Get full accessory data from config
                const configAccessory = AccessoryAssetLoader.getAccessory(accessoryData.id);

                if (configAccessory) {
                    // Use config data (new system)
                    const accessory = {
                        id: configAccessory.id,
                        name: configAccessory.name,
                        category: configAccessory.category,
                        file: configAccessory.file,
                        position: configAccessory.position,
                        scale: configAccessory.scale,
                        enabled: accessoryData.enabled !== false
                    };
                    renderer.addAccessory(accessory);
                } else {
                    // Fallback to legacy system if not found in config
                    console.warn(`[App] Accessory ${accessoryData.id} not found in config, using legacy data`);
                    const accessory = new Accessory(
                        accessoryData.id,
                        accessoryData.name || 'Unknown',
                        accessoryData.type || 'head',
                        accessoryData.color || '#ffffff'
                    );
                    accessory.enabled = accessoryData.enabled !== false;
                    renderer.addAccessory(accessory);
                }
            }
        }

        console.log('[App] Loaded accessories from server:', accessories);
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

        // Cleanup wardrobe system
        if (WardrobeSystem) {
            WardrobeSystem.cleanup();
        }

        // Close panels
        const statusOverlay = document.getElementById('status-overlay');
        const foodOverlay = document.getElementById('food-overlay');
        const wardrobeOverlay = document.getElementById('wardrobe-overlay');
        const statusPanel = document.getElementById('status-panel');
        const foodPanel = document.getElementById('food-panel');
        const wardrobePanel = document.getElementById('wardrobe-panel');
        const statusToggleBtn = document.getElementById('status-toggle-btn');
        const foodToggleBtn = document.getElementById('food-toggle-btn');
        const wardrobeToggleBtn = document.getElementById('wardrobe-toggle-btn');
        const minigameOverlay = document.getElementById('minigame-overlay');
        const minigameExitBtn = document.getElementById('minigame-exit-btn');

        if (statusOverlay) statusOverlay.classList.remove('active');
        if (foodOverlay) foodOverlay.classList.remove('active');
        if (wardrobeOverlay) wardrobeOverlay.classList.remove('active');
        if (statusPanel) statusPanel.classList.remove('active');
        if (foodPanel) foodPanel.classList.remove('active');
        if (wardrobePanel) wardrobePanel.classList.remove('active');
        if (statusToggleBtn) statusToggleBtn.classList.remove('active');
        if (foodToggleBtn) foodToggleBtn.classList.remove('active');
        if (wardrobeToggleBtn) wardrobeToggleBtn.classList.remove('active');
        if (minigameOverlay) minigameOverlay.classList.remove('active');
        if (minigameExitBtn) minigameExitBtn.classList.remove('active');

        this.isPanelOpen = false;

        // Clear canvas if exists
        if (this.canvas) {
            this.canvas.clear();
        }
    }
};
