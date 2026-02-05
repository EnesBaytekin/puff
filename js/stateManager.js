// State Manager - Handles local storage, offline sync, and decay

class StateManager {
    constructor(appView, initialState = null) {
        this.appView = appView;
        this.currentState = initialState || {
            hunger: 50,
            mood: 50,
            energy: 50
        };
        this.lastServerUpdate = null;
        this.isOnline = navigator.onLine;
        this.pendingChanges = [];
        this.decayInterval = null;
        this.activeEffects = []; // Active food effects (crash, protein, etc.)
        this.storageKey = null; // User-specific storage key

        this.init();
    }

    init() {
        // Get user-specific storage key from token
        this.setupStorageKey();

        // Load from localStorage
        this.loadFromStorage();

        // Setup online/offline listeners
        window.addEventListener('online', () => this.onOnline());
        window.addEventListener('offline', () => this.onOffline());

        // Start decay loop
        this.startDecayLoop();
    }

    // Get user ID from JWT token and create storage key
    setupStorageKey() {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                // Decode JWT (simple decode, just to get user ID)
                const payload = JSON.parse(atob(token.split('.')[1]));
                const userId = payload.userId;
                this.storageKey = `puffState_${userId}`;
            } else {
                // Fallback for non-logged in users
                this.storageKey = 'puffState_guest';
            }
        } catch (err) {
            console.error('Failed to setup storage key:', err);
            this.storageKey = 'puffState_guest';
        }
    }

    // Load state from localStorage
    loadFromStorage() {
        if (!this.storageKey) return;

        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                // Round loaded values to ensure integers
                this.currentState = {
                    hunger: Math.round(data.puffState?.hunger || 50),
                    mood: Math.round(data.puffState?.mood || 50),
                    energy: Math.round(data.puffState?.energy || 50)
                };
                this.lastServerUpdate = new Date(data.lastUpdate);
                // Clean pending changes - round values and filter invalid ones
                this.pendingChanges = (data.pendingChanges || [])
                    .map(change => ({
                        ...change,
                        state: {
                            hunger: Math.round(change.state?.hunger || 50),
                            mood: Math.round(change.state?.mood || 50),
                            energy: Math.round(change.state?.energy || 50)
                        }
                    }))
                    .filter(change => change.state); // Filter out invalid entries
                this.activeEffects = data.activeEffects || [];
            }
        } catch (err) {
            console.error('Failed to load from localStorage:', err);
        }
    }

    // Save state to localStorage
    saveToStorage() {
        if (!this.storageKey) return;

        try {
            const data = {
                puffState: this.currentState,
                lastUpdate: this.lastServerUpdate?.toISOString() || new Date().toISOString(),
                pendingChanges: this.pendingChanges,
                activeEffects: this.activeEffects
            };
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (err) {
            console.error('Failed to save to localStorage:', err);
        }
    }

    // Fetch fresh state from server (with offline decay)
    async fetchFromServer() {
        try {
            const puffData = await API.getPuff();
            this.currentState = {
                hunger: puffData.hunger,
                mood: puffData.mood,
                energy: puffData.energy
            };
            this.lastServerUpdate = new Date(puffData.updated_at);

            // Clear pending changes (they're now on server)
            this.pendingChanges = [];

            this.saveToStorage();
            return this.currentState;
        } catch (err) {
            console.error('Failed to fetch from server:', err);
            // Return cached state if available
            return this.currentState;
        }
    }

    // Update state (called when eating, playing, etc.)
    async updateState(newState) {
        const timestamp = new Date().toISOString();

        // Update local state immediately (round to integers for DB)
        this.currentState = {
            hunger: Math.round(Math.max(1, Math.min(100, newState.hunger ?? this.currentState.hunger))),
            mood: Math.round(Math.max(1, Math.min(100, newState.mood ?? this.currentState.mood))),
            energy: Math.round(Math.max(1, Math.min(100, newState.energy ?? this.currentState.energy)))
        };

        // Save to localStorage immediately
        this.saveToStorage();

        // Sync to server IMMEDIATELY (don't wait for 5 min cycle)
        if (this.isOnline) {
            try {
                await this.syncToServer();
            } catch (err) {
                console.error('Failed to sync to server:', err);
                // Add to pending changes if sync fails
                this.pendingChanges.push({
                    state: { ...this.currentState },
                    timestamp
                });
                this.saveToStorage();
            }
        } else {
            // Offline - add to pending changes
            this.pendingChanges.push({
                state: { ...this.currentState },
                timestamp
            });
            this.saveToStorage();
        }

        // Update UI
        this.updateUI();

        return this.currentState;
    }

    // Sync current state to server immediately
    async syncToServer() {
        if (!this.currentState) return;

        try {
            await API.updatePuffState(this.currentState);

            // Clear pending changes and update timestamp on success
            this.pendingChanges = [];
            this.lastServerUpdate = new Date();
            this.saveToStorage();

            console.log('✓ Synced to server:', this.currentState);
        } catch (err) {
            console.error('Failed to sync to server:', err);
            throw err; // Re-throw so caller can handle it
        }
    }

    // Called when going online
    async onOnline() {
        this.isOnline = true;
        console.log('Back online - syncing...');

        // Sync pending changes
        await this.syncToServer();

        // Fetch fresh state from server
        await this.fetchFromServer();
        this.updateUI();
    }

    // Called when going offline
    onOffline() {
        this.isOnline = false;
        console.log('Gone offline - using local storage');
    }

    // Client-side decay loop (every 30 seconds)
    startDecayLoop() {
        // Decay every 30 seconds
        this.decayInterval = setInterval(() => {
            this.applyDecay();
        }, 30000);
    }

    stopDecayLoop() {
        if (this.decayInterval) {
            clearInterval(this.decayInterval);
            this.decayInterval = null;
        }
    }

    // Apply decay to current state
    applyDecay() {
        if (!this.currentState) return;

        // 30 seconds = 0.5 minutes
        const minutesPassed = 0.5;

        // Decay rates (same as server)
        const FULLNESS_DECAY_PER_MIN = 99 / 600;  // ~0.165
        const MOOD_DECAY_PER_MIN = 99 / 480;      // ~0.206
        const ENERGY_DECAY_PER_MIN = 99 / 390;    // ~0.254

        // Get current decay multipliers from active effects
        const moodDecayMultiplier = this.getMoodDecayMultiplier();
        const energyDecayMultiplier = this.getEnergyDecayMultiplier();

        // Calculate new values with minimum = 1
        let newHunger = this.currentState.hunger - (minutesPassed * FULLNESS_DECAY_PER_MIN);
        let newMood = this.currentState.mood - (minutesPassed * MOOD_DECAY_PER_MIN * moodDecayMultiplier);
        let newEnergy = this.currentState.energy - (minutesPassed * ENERGY_DECAY_PER_MIN * energyDecayMultiplier);

        // Apply Fullness → Energy conversion
        // If fullness > 50 and energy < 80, convert fullness to energy
        if (newHunger > 50 && newEnergy < 80) {
            const conversionAmount = 2; // Convert 2 fullness to 1 energy
            newHunger -= conversionAmount * minutesPassed;
            newEnergy += (conversionAmount / 2) * minutesPassed;
        }

        // Clamp values (minimum 1, maximum 100)
        newHunger = Math.max(1, Math.min(100, newHunger));
        newMood = Math.max(1, Math.min(100, newMood));
        newEnergy = Math.max(1, Math.min(100, newEnergy));

        // Update state (round to integers)
        this.currentState = {
            hunger: Math.round(newHunger),
            mood: Math.round(newMood),
            energy: Math.round(newEnergy)
        };

        // Update active effects (remove expired)
        this.updateActiveEffects();

        // Save and sync
        this.saveToStorage();

        // Sync to server periodically (backup sync every 5 minutes)
        const now = new Date();
        const timeSinceLastSync = this.lastServerUpdate
            ? (now - this.lastServerUpdate) / 1000 / 60
            : Infinity;

        if (timeSinceLastSync >= 5 && this.isOnline) {
            // Don't await - fire and forget
            this.syncToServer().catch(err => {
                console.error('Periodic sync failed:', err);
            });
        }

        // Update UI
        this.updateUI();
    }

    // Get mood decay multiplier from active effects
    getMoodDecayMultiplier() {
        let multiplier = 1.0;

        for (const effect of this.activeEffects) {
            if (effect.type === 'mood_decay' && effect.isActive()) {
                multiplier *= effect.multiplier;
            }
        }

        return multiplier;
    }

    // Get energy decay multiplier from active effects
    getEnergyDecayMultiplier() {
        let multiplier = 1.0;

        for (const effect of this.activeEffects) {
            if (effect.type === 'energy_decay' && effect.isActive()) {
                multiplier *= effect.multiplier;
            }
        }

        return multiplier;
    }

    // Add a food effect (crash, protein, etc.)
    addEffect(effect) {
        this.activeEffects.push({
            ...effect,
            startTime: Date.now(),
            isActive: function() {
                return Date.now() - this.startTime < this.duration;
            }
        });

        this.saveToStorage();
    }

    // Update and remove expired effects
    updateActiveEffects() {
        this.activeEffects = this.activeEffects.filter(effect => effect.isActive());
        this.saveToStorage();
    }

    // Update UI progress bars and creature state
    updateUI() {
        if (!this.currentState || !this.appView.creature) return;

        // Update progress bars
        this.appView.updateProgressBars(this.currentState);

        // Update creature state
        this.appView.creature.updateState(this.currentState);
    }

    // Get current state
    getState() {
        return this.currentState;
    }

    // Cleanup
    cleanup() {
        this.stopDecayLoop();
    }
}
