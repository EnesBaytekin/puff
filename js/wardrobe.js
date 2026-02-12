// Wardrobe System for Puff

const WardrobeSystem = {
    canvas: null,
    ctx: null,
    previewPuff: null,
    animationFrame: null,
    currentCategory: 'all',
    selectedAccessory: null,
    tempAccessory: null, // Temporary preview accessory
    scrollPosition: 0,
    itemsPerPage: 4,

    init(appView) {
        this.appView = appView;
        this.canvas = document.getElementById('wardrobe-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Setup UI
        this.setupWardrobeToggle();
        this.setupTabs();
        this.setupToggleButton();
        this.setupTouchScroll();

        // Create preview puff
        this.createPreviewPuff();

        // Load accessories
        this.loadAccessories('all');

        // Start animation loop
        this.startPreviewAnimation();
    },

    setupWardrobeToggle() {
        const toggleBtn = document.getElementById('wardrobe-toggle-btn');
        const overlay = document.getElementById('wardrobe-overlay');
        const panel = document.getElementById('wardrobe-panel');

        toggleBtn.addEventListener('click', () => {
            this.openWardrobe();
        });

        const closeBtn = panel.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeWardrobe();
            });
        }

        overlay.addEventListener('click', () => {
            this.closeWardrobe();
        });
    },

    setupTabs() {
        const tabs = document.querySelectorAll('.wardrobe-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                // Add active to clicked tab
                tab.classList.add('active');

                // Clear temp preview and selection when category changes
                this.tempAccessory = null;
                this.selectedAccessory = null;

                // Reset UI
                const nameEl = document.getElementById('accessory-name');
                const toggleBtn = document.getElementById('toggle-accessory');
                nameEl.textContent = 'Select an item';
                toggleBtn.disabled = true;
                toggleBtn.textContent = 'Wear';
                toggleBtn.classList.remove('wearing');

                // Remove selected class from all items
                document.querySelectorAll('.accessory-item').forEach(item => {
                    item.classList.remove('selected');
                });

                // Filter accessories
                const category = tab.dataset.category;
                this.currentCategory = category;
                this.loadAccessories(category);
            });
        });
    },

    setupToggleButton() {
        const toggleBtn = document.getElementById('toggle-accessory');
        toggleBtn.addEventListener('click', () => {
            if (!this.selectedAccessory) return;

            // Commit the temp preview - actually equip the item
            const accessory = this.selectedAccessory;

            if (this.previewPuff.accessoryRenderer.hasAccessory(accessory.id)) {
                // Remove accessory
                this.previewPuff.accessoryRenderer.removeAccessory(accessory.id);
                toggleBtn.textContent = 'Wear';
                toggleBtn.classList.remove('wearing');
            } else {
                // Add accessory
                this.previewPuff.accessoryRenderer.addAccessory(accessory);
                toggleBtn.textContent = 'Remove';
                toggleBtn.classList.add('wearing');
            }

            // Clear temp preview after committing
            this.tempAccessory = null;

            // Update UI
            this.updateAccessoriesUI();
        });
    },

    setupTouchScroll() {
        const accessoryList = document.getElementById('accessory-list');
        if (!accessoryList) return;

        let isDown = false;
        let startX;
        let scrollLeft;

        // Mouse events
        accessoryList.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - accessoryList.offsetLeft;
            scrollLeft = accessoryList.scrollLeft;
        });

        accessoryList.addEventListener('mouseleave', () => {
            isDown = false;
        });

        accessoryList.addEventListener('mouseup', () => {
            isDown = false;
        });

        accessoryList.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - accessoryList.offsetLeft;
            const walk = (x - startX) * 2; // Scroll speed
            accessoryList.scrollLeft = scrollLeft - walk;
        });

        // Touch events
        accessoryList.addEventListener('touchstart', (e) => {
            isDown = true;
            startX = e.touches[0].pageX - accessoryList.offsetLeft;
            scrollLeft = accessoryList.scrollLeft;
        });

        accessoryList.addEventListener('touchend', () => {
            isDown = false;
        });

        accessoryList.addEventListener('touchcancel', () => {
            isDown = false;
        });

        accessoryList.addEventListener('touchmove', (e) => {
            if (!isDown) return;
            const x = e.touches[0].pageX - accessoryList.offsetLeft;
            const walk = (x - startX) * 1.5; // Scroll speed
            accessoryList.scrollLeft = scrollLeft - walk;
        });
    },

    createPreviewPuff() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = 70;

        // Get current puff data
        const puffData = this.appView.creature;
        const currentState = {
            hunger: puffData.puffState.hunger,
            mood: puffData.puffState.mood,
            energy: puffData.puffState.energy
        };

        // Create preview puff with MORE particles for better face detection
        // Main puff uses 20, preview needs more for glasses to work
        this.previewPuff = new SoftBody(centerX, centerY, radius, 20, puffData.baseColor, currentState);

        // Copy accessories from main puff
        if (puffData.accessoryRenderer) {
            puffData.accessoryRenderer.accessories.forEach(acc => {
                this.previewPuff.accessoryRenderer.addAccessory(acc);
            });
        }

        // Override draw method to render accessories properly
        const originalDraw = this.previewPuff.draw.bind(this.previewPuff);
        this.previewPuff.draw = (ctx) => {
            // Call original draw (includes body, face, etc.)
            originalDraw(ctx);

            // Manually render accessories on top
            if (this.previewPuff.accessoryRenderer) {
                this.previewPuff.accessoryRenderer.render(ctx, this.previewPuff);
            }
        };

        console.log('[Wardrobe] Preview puff created with 20 particles (was 16)');
    },

    loadAccessories(category) {
        const list = document.getElementById('accessory-list');
        list.innerHTML = '';

        // Get accessories from config
        let accessories = AccessoryAssetLoader.getAccessoriesByCategory(category);

        // Create accessory items
        accessories.forEach(acc => {
            const item = document.createElement('div');
            item.className = 'accessory-item';
            item.dataset.accessoryId = acc.id;

            // Check if wearing
            if (this.previewPuff.accessoryRenderer.hasAccessory(acc.id)) {
                item.classList.add('wearing');
            }

            // Get thumbnail image
            const img = AccessoryAssetLoader.getImage(acc.file);
            const thumbnailHtml = img
                ? `<img src="${img.src}" class="accessory-thumb" alt="${acc.name}">`
                : `<span class="accessory-placeholder">✨</span>`;

            item.innerHTML = `
                ${thumbnailHtml}
                <span class="accessory-name">${acc.name}</span>
            `;

            item.addEventListener('click', () => {
                this.selectAccessory(acc, item);
            });

            list.appendChild(item);
        });
    },

    // getAccessoryEmoji removed - now using image thumbnails

    selectAccessory(accessory, element) {
        // Update selected state
        document.querySelectorAll('.accessory-item').forEach(item => {
            item.classList.remove('selected');
        });
        element.classList.add('selected');

        this.selectedAccessory = accessory;

        // Set temp preview - this will be rendered on top
        this.tempAccessory = accessory;

        // Update UI
        const nameEl = document.getElementById('accessory-name');
        const toggleBtn = document.getElementById('toggle-accessory');

        nameEl.textContent = accessory.name;
        toggleBtn.disabled = false;

        // Check if currently wearing
        if (this.previewPuff.accessoryRenderer.hasAccessory(accessory.id)) {
            toggleBtn.textContent = 'Remove';
            toggleBtn.classList.add('wearing');
        } else {
            toggleBtn.textContent = 'Wear';
            toggleBtn.classList.remove('wearing');
        }
    },

    updateAccessoriesUI() {
        // Update wearing indicators
        document.querySelectorAll('.accessory-item').forEach(item => {
            const id = item.dataset.accessoryId;
            if (this.previewPuff.accessoryRenderer.hasAccessory(id)) {
                item.classList.add('wearing');
            } else {
                item.classList.remove('wearing');
            }
        });

        // Update toggle button if accessory selected
        if (this.selectedAccessory) {
            const toggleBtn = document.getElementById('toggle-accessory');
            if (this.previewPuff.accessoryRenderer.hasAccessory(this.selectedAccessory.id)) {
                toggleBtn.textContent = 'Remove';
                toggleBtn.classList.add('wearing');
            } else {
                toggleBtn.textContent = 'Wear';
                toggleBtn.classList.remove('wearing');
            }
        }
    },

    startPreviewAnimation() {
        const animate = () => {
            // Clear canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Update and draw preview puff
            if (this.previewPuff) {
                this.previewPuff.applyOrganicDeformation();

                // If temp accessory is selected, temporarily hide the item in the same slot
                let hiddenAccessory = null;
                let hiddenSlot = null;

                if (this.tempAccessory) {
                    const renderer = this.previewPuff.accessoryRenderer;
                    const slot = renderer.getSlotForType(this.tempAccessory.type);

                    // Store and temporarily remove the item in the same slot
                    if (renderer.slots[slot] && renderer.slots[slot].id !== this.tempAccessory.id) {
                        hiddenAccessory = renderer.slots[slot];
                        hiddenSlot = slot;
                        renderer.slots[slot] = null;
                    }
                }

                // Draw the puff (with temporarily modified slots)
                this.previewPuff.draw(this.ctx);

                // Draw temp accessory on top if it's not already equipped
                if (this.tempAccessory && !this.previewPuff.accessoryRenderer.hasAccessory(this.tempAccessory.id)) {
                    // Render the temp accessory using new image-based system
                    this.previewPuff.accessoryRenderer.renderAccessory(
                        this.ctx,
                        this.previewPuff,
                        this.tempAccessory
                    );
                }

                // Restore the hidden accessory after drawing
                if (hiddenAccessory && hiddenSlot) {
                    this.previewPuff.accessoryRenderer.slots[hiddenSlot] = hiddenAccessory;
                }
            }

            // Continue animation
            this.animationFrame = requestAnimationFrame(animate);
        };

        animate();
    },

    stopPreviewAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    },

    openWardrobe() {
        // Close other panels
        this.appView.closeStatusPanel();
        this.appView.closeFoodPanel();
        this.appView.closeSettingsPanel();

        // Clear temp preview
        this.tempAccessory = null;
        this.selectedAccessory = null;

        // Sync preview puff with current state
        this.syncPreviewPuff();

        // Open wardrobe panel
        const toggleBtn = document.getElementById('wardrobe-toggle-btn');
        const overlay = document.getElementById('wardrobe-overlay');
        const panel = document.getElementById('wardrobe-panel');

        toggleBtn.classList.add('active');
        overlay.classList.add('active');
        panel.classList.add('active');

        // Reload accessories to show current wearing state
        this.loadAccessories(this.currentCategory);
    },

    closeWardrobe() {
        const toggleBtn = document.getElementById('wardrobe-toggle-btn');
        const overlay = document.getElementById('wardrobe-overlay');
        const panel = document.getElementById('wardrobe-panel');

        toggleBtn.classList.remove('active');
        overlay.classList.remove('active');
        panel.classList.remove('active');

        // Sync accessories back to main puff
        this.syncMainPuff();
    },

    syncPreviewPuff() {
        // Sync state and accessories from main puff to preview
        const mainPuff = this.appView.creature;
        if (!mainPuff || !this.previewPuff) return;

        // Sync state
        this.previewPuff.puffState = {
            hunger: mainPuff.puffState.hunger,
            mood: mainPuff.puffState.mood,
            energy: mainPuff.puffState.energy
        };

        // Sync accessories
        this.previewPuff.accessoryRenderer.clearAccessories();

        // DEBUG: Log main puff accessories
        console.log('[Wardrobe] Main puff slots:', mainPuff.accessoryRenderer.slots);
        console.log('[Wardrobe] Main puff accessories:', mainPuff.accessoryRenderer.accessories);

        mainPuff.accessoryRenderer.accessories.forEach(acc => {
            console.log('[Wardrobe] Copying accessory:', acc);
            this.previewPuff.accessoryRenderer.addAccessory(acc);
        });

        console.log('[Wardrobe] Preview puff slots after sync:', this.previewPuff.accessoryRenderer.slots);
    },

    syncMainPuff() {
        // Sync accessories from preview to main puff
        const mainPuff = this.appView.creature;
        if (!mainPuff || !this.previewPuff) return;

        mainPuff.accessoryRenderer.clearAccessories();
        this.previewPuff.accessoryRenderer.accessories.forEach(acc => {
            mainPuff.accessoryRenderer.addAccessory(acc);
        });

        // Save accessories to server
        this.saveAccessoriesToServer();
    },

    async saveAccessoriesToServer() {
        try {
            const mainPuff = this.appView.creature;
            if (!mainPuff || !mainPuff.accessoryRenderer) return;

            // Get accessories from slots
            const accessories = mainPuff.accessoryRenderer.slots;

            // Send to server
            await API.updatePuffAccessories(accessories);
            console.log('[Wardrobe] Accessories saved to server');
        } catch (err) {
            console.error('[Wardrobe] Failed to save accessories:', err);
        }
    },

    cleanup() {
        this.stopPreviewAnimation();
        this.previewPuff = null;
    }
};
