// Accessory System for Puff
// Refactored to use image-based assets instead of canvas drawing

// Accessory class - simple data holder
class Accessory {
    constructor(id, name, type, color = '#ffffff') {
        this.id = id;
        this.name = name;
        this.type = type; // Legacy: for backward compatibility
        this.color = color;
        this.enabled = true;
    }
}

// Accessory Renderer - now uses pre-loaded images
class AccessoryRenderer {
    constructor() {
        // Slot system - each slot can hold ONE accessory
        this.slots = {
            hat: null,
            glasses: null,
            head: null,      // ribbon, halo, crown, horns, antenna
            face: null       // eyebrows, mustache
        };

        // Category to slot mapping (from config)
        this.categorySlotMap = {
            'hats': 'hat',
            'glasses': 'glasses',
            'head': 'head',
            'face': 'face'
        };
    }

    /**
     * Get slot for a given category
     * @param {string} categoryId - Category ID from config
     * @returns {string} Slot name
     */
    getSlotForCategory(categoryId) {
        return this.categorySlotMap[categoryId] || 'head';
    }

    /**
     * Get slot for legacy type compatibility
     * @param {string} type - Legacy type (hat, glasses, ribbon, etc.)
     * @returns {string} Slot name
     */
    getSlotForType(type) {
        if (type === 'hat') return 'hat';
        if (type === 'glasses') return 'glasses';
        if (type === 'eyebrows' || type === 'mustache') return 'face';
        return 'head'; // ribbon, bowtie, halo, crown, horns, antenna
    }

    addAccessory(accessory) {
        // If accessory has category property (new system)
        if (accessory.category) {
            const slot = this.getSlotForCategory(accessory.category);
            this.slots[slot] = accessory;
        } else {
            // Legacy type support
            const slot = this.getSlotForType(accessory.type);
            this.slots[slot] = accessory;
        }
    }

    removeAccessory(accessoryId) {
        Object.keys(this.slots).forEach(slot => {
            if (this.slots[slot] && this.slots[slot].id === accessoryId) {
                this.slots[slot] = null;
            }
        });
    }

    clearAccessories() {
        this.slots = {
            hat: null,
            glasses: null,
            head: null,
            face: null
        };
    }

    hasAccessory(id) {
        return Object.values(this.slots).some(acc => acc && acc.id === id);
    }

    // Get all accessories (for compatibility)
    get accessories() {
        return Object.values(this.slots).filter(acc => acc !== null);
    }

    /**
     * Render all accessories on the puff using pre-loaded images
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {SoftBody} softBody - Puff creature
     */
    render(ctx, softBody) {
        if (!AccessoryAssetLoader.isLoaded) {
            console.warn('[AccessoryRenderer] Assets not loaded yet, skipping render');
            return;
        }

        // Get all equipped accessories
        const equippedAccessories = this.accessories;
        if (equippedAccessories.length === 0) {
            return; // No accessories equipped
        }

        console.log(`[AccessoryRenderer] Rendering ${equippedAccessories.length} accessories`);

        // Get categories sorted by zIndex
        const categories = AccessoryAssetLoader.getCategories()
            .sort((a, b) => a.zIndex - b.zIndex);

        // Render each category's accessory
        categories.forEach(category => {
            const slot = category.slot;
            const accessory = this.slots[slot];
            if (!accessory || !accessory.enabled) return;

            console.log(`[AccessoryRenderer] Rendering accessory: ${accessory.id} in slot: ${slot}`);
            this.renderAccessory(ctx, softBody, accessory);
        });
    }

    /**
     * Render a single accessory
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {SoftBody} softBody - Puff creature
     * @param {Object} accessory - Accessory config object
     */
    renderAccessory(ctx, softBody, accessory) {
        // Get the image from cache
        const img = AccessoryAssetLoader.getImage(accessory.file);
        if (!img) {
            console.warn(`[AccessoryRenderer] Image not loaded: ${accessory.file}`);
            return;
        }

        // Check if image is ready (has width/height)
        // Allow small values (like 1-2px) but reject zero
        if (!img.width || !img.height || img.width < 1 || img.height < 1) {
            console.warn(`[AccessoryRenderer] Image not ready yet: ${accessory.file} (${img.width}x${img.height})`);
            return;
        }

        // Position: relative to puff's main circle center
        const centerX = softBody.mainCircle.x + accessory.position.x;
        const centerY = softBody.mainCircle.y + accessory.position.y;

        // Scale based on puff radius (reference radius = 70)
        const radiusScale = softBody.radius / 70;
        const scale = accessory.scale * radiusScale;

        // Calculate image dimensions
        const imgWidth = img.width * scale;
        const imgHeight = img.height * scale;

        ctx.save();

        // Draw the accessory centered at position
        ctx.drawImage(
            img,
            centerX - imgWidth / 2,
            centerY - imgHeight / 2,
            imgWidth,
            imgHeight
        );

        ctx.restore();
    }
}

// Note: ACCESSORY_CATALOG removed - now using config.json
// Accessories are loaded from assets/accessories/config.json
