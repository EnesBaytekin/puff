// Accessory Asset Loader
// Handles loading of accessory configuration and image assets

const AccessoryAssetLoader = {
    config: null,
    loadedImages: new Map(),
    isLoaded: false,

    /**
     * Load the accessory configuration file
     * @returns {Promise<Object>} Configuration object with categories and accessories
     */
    async loadConfig() {
        if (this.config) {
            return this.config;
        }

        try {
            const response = await fetch('/assets/accessories/config.json');
            if (!response.ok) {
                throw new Error(`Failed to load config: ${response.status}`);
            }
            this.config = await response.json();
            console.log('[AccessoryAssetLoader] Config loaded:', this.config);
            return this.config;
        } catch (err) {
            console.error('[AccessoryAssetLoader] Failed to load config:', err);
            throw err;
        }
    },

    /**
     * Load a single image (SVG or PNG)
     * @param {string} path - Relative path to image file
     * @returns {Promise<HTMLImageElement|SVGSVGElement>} Loaded image element
     */
    async loadImage(path) {
        // Check if already loaded
        if (this.loadedImages.has(path)) {
            return this.loadedImages.get(path);
        }

        const fullPath = `/assets/accessories/${path}`;

        try {
            // Determine if it's an SVG by extension
            if (path.endsWith('.svg')) {
                return await this.loadSVG(fullPath, path);
            } else {
                return await this.loadRaster(fullPath, path);
            }
        } catch (err) {
            console.error(`[AccessoryAssetLoader] Failed to load image: ${path}`, err);
            throw err;
        }
    },

    /**
     * Load SVG file as an element
     * @param {string} fullPath - Full path to SVG
     * @param {string} cacheKey - Key for cache
     * @returns {Promise<SVGSVGElement>} SVG element
     */
    async loadSVG(fullPath, cacheKey) {
        try {
            const response = await fetch(fullPath);
            if (!response.ok) {
                throw new Error(`Failed to load SVG: ${response.status}`);
            }
            const svgText = await response.text();

            // Parse SVG text to DOM element
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = doc.documentElement;

            // Create an image from the SVG for easier drawing
            const img = new Image();
            const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            img.onload = () => {
                URL.revokeObjectURL(url);
            };

            img.src = url;
            this.loadedImages.set(cacheKey, img);
            return img;

        } catch (err) {
            console.error('[AccessoryAssetLoader] Failed to load SVG:', err);
            throw err;
        }
    },

    /**
     * Load raster image (PNG, JPG, etc.)
     * @param {string} fullPath - Full path to image
     * @param {string} cacheKey - Key for cache
     * @returns {Promise<HTMLImageElement>} Image element
     */
    async loadRaster(fullPath, cacheKey) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.loadedImages.set(cacheKey, img);
                resolve(img);
            };
            img.onerror = () => {
                reject(new Error(`Failed to load image: ${fullPath}`));
            };
            img.src = fullPath;
        });
    },

    /**
     * Preload all accessory images
     * @returns {Promise<void>}
     */
    async preloadAll() {
        if (!this.config) {
            await this.loadConfig();
        }

        const loadPromises = this.config.accessories.map(acc =>
            this.loadImage(acc.file).catch(err => {
                console.warn(`[AccessoryAssetLoader] Failed to preload ${acc.id}:`, err);
                return null;
            })
        );

        await Promise.all(loadPromises);
        this.isLoaded = true;
        console.log('[AccessoryAssetLoader] All images preloaded');
    },

    /**
     * Get accessory by ID
     * @param {string} id - Accessory ID
     * @returns {Object|null} Accessory object or null if not found
     */
    getAccessory(id) {
        if (!this.config) {
            console.warn('[AccessoryAssetLoader] Config not loaded yet');
            return null;
        }
        return this.config.accessories.find(acc => acc.id === id) || null;
    },

    /**
     * Get all accessories
     * @returns {Array} Array of all accessories
     */
    getAllAccessories() {
        if (!this.config) {
            console.warn('[AccessoryAssetLoader] Config not loaded yet');
            return [];
        }
        return this.config.accessories;
    },

    /**
     * Get accessories by category
     * @param {string} categoryId - Category ID
     * @returns {Array} Array of accessories in the category
     */
    getAccessoriesByCategory(categoryId) {
        if (!this.config) {
            console.warn('[AccessoryAssetLoader] Config not loaded yet');
            return [];
        }
        if (categoryId === 'all') {
            return this.config.accessories;
        }
        return this.config.accessories.filter(acc => acc.category === categoryId);
    },

    /**
     * Get all categories
     * @returns {Array} Array of categories
     */
    getCategories() {
        if (!this.config) {
            console.warn('[AccessoryAssetLoader] Config not loaded yet');
            return [];
        }
        return this.config.categories;
    },

    /**
     * Get category by ID
     * @param {string} categoryId - Category ID
     * @returns {Object|null} Category object or null if not found
     */
    getCategory(categoryId) {
        if (!this.config) {
            console.warn('[AccessoryAssetLoader] Config not loaded yet');
            return null;
        }
        return this.config.categories.find(cat => cat.id === categoryId) || null;
    },

    /**
     * Get image for accessory (from cache)
     * @param {string} file - File path
     * @returns {HTMLImageElement|null} Image element or null if not loaded
     */
    getImage(file) {
        return this.loadedImages.get(file) || null;
    }
};
