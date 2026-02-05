// Food System for Puff

// Food class - represents a single food item
class Food {
    constructor(id, name, emoji, hungerBonus, moodBonus = 0, energyBonus = 0, effect = null) {
        this.id = id;
        this.name = name;
        this.emoji = emoji;
        this.hungerBonus = hungerBonus; // How much fullness it gives
        this.moodBonus = moodBonus;     // How much mood it gives
        this.energyBonus = energyBonus; // How much energy it gives
        this.effect = effect;           // Special effect (crash, protein, etc.)
    }
}

// Food Inventory - manages available foods
class FoodInventory {
    constructor() {
        // Default food items with effects
        this.foods = [
            // Normal foods (no special effects)
            new Food(1, 'Apple', '🍎', 15, 5, 0),
            new Food(3, 'Fish', '🐟', 20, 0, 10, {
                type: 'energy_decay',
                multiplier: 0.5,      // Slow energy decay
                duration: 600000,     // 10 minutes
                name: 'Protein Boost'
            }),
            new Food(5, 'Pizza', '🍕', 30, 10, 5),
            new Food(7, 'Sandwich', '🥪', 25, 5, 15),
            new Food(9, 'Burger', '🍔', 30, 10, 10),
            new Food(10, 'Carrot', '🥕', 10, 0, 5, {
                type: 'energy_decay',
                multiplier: 0.7,      // Slow energy decay (less than fish)
                duration: 600000,     // 10 minutes
                name: 'Healthy Snack'
            }),
            new Food(11, 'Banana', '🍌', 15, 5, 10),
            new Food(12, 'Chicken', '🍗', 25, 5, 15),

            // Sweet foods (crash effect!)
            new Food(2, 'Cake', '🍰', 25, 15, 5, {
                type: 'mood_decay',
                multiplier: 2.0,      // 2x mood decay
                duration: 300000,     // 5 minutes
                name: 'Sugar Crash'
            }),
            new Food(4, 'Cookie', '🍪', 10, 20, 0, {
                type: 'mood_decay',
                multiplier: 1.5,      // 1.5x mood decay
                duration: 180000,     // 3 minutes
                name: 'Mini Crash'
            }),
            new Food(6, 'Ice Cream', '🍦', 15, 25, 0, {
                type: 'mood_decay',
                multiplier: 2.5,      // 2.5x mood decay (very strong!)
                duration: 240000,     // 4 minutes
                name: 'Brain Freeze'
            }),
            new Food(8, 'Donut', '🍩', 20, 15, 0, {
                type: 'mood_decay',
                multiplier: 1.8,      // 1.8x mood decay
                duration: 270000,     // 4.5 minutes
                name: 'Sugar Rush'
            }),
        ];
    }

    getAllFoods() {
        return this.foods;
    }

    getFoodById(id) {
        return this.foods.find(food => food.id === id);
    }
}

// Food Drag & Drop Handler
class FoodDragHandler {
    constructor(appView) {
        this.appView = appView;
        this.isDragging = false;
        this.draggedFood = null;
        this.draggedElement = null;
        this.foodPanelOpen = false;

        this.setupFoodToggle();
        this.setupFoodSlots();
    }

    setupFoodToggle() {
        const toggleBtn = document.getElementById('food-toggle-btn');
        const foodOverlay = document.getElementById('food-overlay');
        const foodPanel = document.getElementById('food-panel');

        // Open food panel
        toggleBtn.addEventListener('click', () => {
            this.openFoodPanel();
        });

        // Close button handler
        const closeBtn = foodPanel.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeFoodPanel();
            });
        }

        // Overlay click handler
        foodOverlay.addEventListener('click', () => {
            this.closeFoodPanel();
        });
    }

    closeStatusPanel() {
        const statusToggleBtn = document.getElementById('status-toggle-btn');
        const statusOverlay = document.getElementById('status-overlay');
        const statusPanel = document.getElementById('status-panel');

        if (statusToggleBtn) statusToggleBtn.classList.remove('active');
        if (statusOverlay) statusOverlay.classList.remove('active');
        if (statusPanel) statusPanel.classList.remove('active');
        if (this.appView) this.appView.isPanelOpen = false;
    }

    setupFoodSlots() {
        const inventory = new FoodInventory();
        const foods = inventory.getAllFoods();
        const slotsContainer = document.getElementById('food-slots');

        // Clear existing slots
        slotsContainer.innerHTML = '';

        // Create food slots
        foods.forEach(food => {
            const slot = document.createElement('div');
            slot.className = 'food-slot';
            slot.dataset.foodId = food.id;

            slot.innerHTML = `
                <div class="food-emoji">${food.emoji}</div>
                <div class="food-name">${food.name}</div>
                <div class="food-bonus">+${food.hungerBonus}</div>
            `;

            // Setup drag events
            this.setupDragEvents(slot, food);

            slotsContainer.appendChild(slot);
        });
    }

    setupDragEvents(slot, food) {
        // Mouse events
        slot.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.startDrag(e, food, 'mouse');
        });
        // Touch events
        slot.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrag(e, food, 'touch');
        }, { passive: false });
    }

    startDrag(event, food, inputType) {
        event.preventDefault();
        event.stopPropagation();

        this.isDragging = true;
        this.draggedFood = food;
        this.inputType = inputType; // Store input type

        // Get position
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;

        // Create dragged element
        this.draggedElement = document.getElementById('dragged-food');
        this.draggedElement.textContent = food.emoji;
        this.draggedElement.style.display = 'block';
        this.draggedElement.style.left = clientX + 'px';
        this.draggedElement.style.top = clientY + 'px';

        // Close food panel
        this.closeFoodPanel();

        // Setup move and end listeners
        this.setupDragListeners();
    }

    setupDragListeners() {
        const moveHandler = (e) => this.onDrag(e);
        const endHandler = (e) => this.endDrag(e);

        // Add both mouse and touch listeners
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', endHandler);
        window.addEventListener('touchmove', moveHandler, { passive: false });
        window.addEventListener('touchend', endHandler);

        // Store references to remove later
        this.dragMoveHandler = moveHandler;
        this.dragEndHandler = endHandler;
    }

    onDrag(event) {
        if (!this.isDragging || !this.draggedElement) return;

        event.preventDefault();

        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;

        this.draggedElement.style.left = clientX + 'px';
        this.draggedElement.style.top = clientY + 'px';
    }

    endDrag(event) {
        if (!this.isDragging) return;

        // Remove drag listeners (both mouse and touch)
        window.removeEventListener('mousemove', this.dragMoveHandler);
        window.removeEventListener('mouseup', this.dragEndHandler);
        window.removeEventListener('touchmove', this.dragMoveHandler);
        window.removeEventListener('touchend', this.dragEndHandler);

        // Check if dropped on puff
        const droppedOnPuff = this.checkDropOnPuff(event);

        if (droppedOnPuff) {
            this.feedPuff();
        } else {
            // Dropped outside - reopen food panel
            this.openFoodPanel();
        }

        // Hide dragged element immediately
        if (this.draggedElement) {
            this.draggedElement.style.display = 'none';
            this.draggedElement.textContent = '';
        }

        this.isDragging = false;
        this.draggedFood = null;
        this.draggedElement = null;
        this.inputType = null;
    }

    checkDropOnPuff(event) {
        const clientX = event.changedTouches ? event.changedTouches[0].clientX : event.clientX;
        const clientY = event.changedTouches ? event.changedTouches[0].clientY : event.clientY;

        // Get puff position from canvas
        const creature = this.appView.creature;
        if (!creature) return false;

        const puffX = creature.centerParticle.x;
        const puffY = creature.centerParticle.y;
        const puffRadius = creature.radius * 1.5; // Generous hit area

        const dx = clientX - puffX;
        const dy = clientY - puffY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < puffRadius;
    }

    feedPuff() {
        if (!this.draggedFood || !this.appView.creature) return;

        const food = this.draggedFood;

        // Create eating particles
        this.createEatingParticles();

        // Trigger eating animation
        this.appView.creature.startEating();

        // Get current state safely
        let currentState;
        if (this.appView.stateManager && this.appView.stateManager.currentState) {
            currentState = this.appView.stateManager.getState();
        } else {
            // Fallback to creature state
            currentState = this.appView.creature.puffState;
        }

        const newState = {
            hunger: Math.min(100, currentState.hunger + food.hungerBonus),
            mood: Math.min(100, currentState.mood + food.moodBonus),
            energy: Math.min(100, currentState.energy + food.energyBonus)
        };

        this.appView.creature.updateState(newState);

        // Apply food effect if exists
        if (food.effect && this.appView.stateManager) {
            this.appView.stateManager.addEffect(food.effect);
            console.log(`Applied effect: ${food.effect.name}`);
        }

        // Update through StateManager (handles sync)
        if (this.appView.stateManager) {
            this.appView.stateManager.updateState(newState);
        } else {
            // Fallback
            API.updatePuffState(newState).catch(err => {
                console.error('Failed to update puff state:', err);
            });
            this.appView.updateProgressBars(newState);
        }
    }

    createEatingParticles() {
        const creature = this.appView.creature;
        if (!creature) return;

        const x = creature.centerParticle.x;
        const y = creature.centerParticle.y;

        const particles = ['✨', '⭐', '💫', '🌟'];

        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'eat-particle';
            particle.textContent = particles[Math.floor(Math.random() * particles.length)];

            // Random offset around puff
            const offsetX = (Math.random() - 0.5) * 100;
            const offsetY = (Math.random() - 0.5) * 100;

            particle.style.left = (x + offsetX) + 'px';
            particle.style.top = (y + offsetY) + 'px';
            particle.style.animationDelay = (i * 0.05) + 's';

            document.body.appendChild(particle);

            // Remove after animation
            setTimeout(() => {
                particle.remove();
            }, 1000);
        }
    }

    closeFoodPanel() {
        this.foodPanelOpen = false;
        const toggleBtn = document.getElementById('food-toggle-btn');
        const overlay = document.getElementById('food-overlay');
        const panel = document.getElementById('food-panel');

        if (toggleBtn) toggleBtn.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        if (panel) panel.classList.remove('active');
    }

    openFoodPanel() {
        // Close status panel first
        this.closeStatusPanel();

        this.foodPanelOpen = true;
        const toggleBtn = document.getElementById('food-toggle-btn');
        const overlay = document.getElementById('food-overlay');
        const panel = document.getElementById('food-panel');

        if (toggleBtn) toggleBtn.classList.add('active');
        if (overlay) overlay.classList.add('active');
        if (panel) panel.classList.add('active');
    }
}
