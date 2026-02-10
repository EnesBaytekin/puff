// Customize view
const CustomizeView = {
    currentHue: 10,
    previewCanvas: null,
    previewCtx: null,
    previewPuff: null,
    animationFrame: null,

    init() {
        const form = document.getElementById('customize-form');
        const errorEl = document.getElementById('customize-error');
        const hueSlider = document.getElementById('puff-hue');
        this.previewCanvas = document.getElementById('puff-preview-canvas');
        this.previewCtx = this.previewCanvas.getContext('2d');

        // Clear previous error
        errorEl.textContent = '';

        // Set initial hue
        this.currentHue = parseInt(hueSlider.value);

        // Create preview puff
        this.createPreviewPuff();

        // Start animation loop
        this.startPreviewAnimation();

        // Update preview when hue changes
        hueSlider.oninput = () => {
            this.currentHue = parseInt(hueSlider.value);
            this.updatePuffColor();
        };

        // Handle form submission
        form.onsubmit = async (e) => {
            e.preventDefault();

            const name = document.getElementById('puff-name').value;
            const color = this.hslToHex(this.currentHue, 85, 78);

            errorEl.textContent = '';

            // Stop animation before navigating
            this.stopPreviewAnimation();

            try {
                await API.createPuff(name, color);
                // Navigate to app
                Router.fetchPuffAndRoute();
            } catch (err) {
                errorEl.textContent = err.message;
                // Restart animation if there's an error
                this.startPreviewAnimation();
            }
        };
    },

    createPreviewPuff() {
        // Use CSS dimensions, not canvas internal dimensions
        const centerX = this.previewCanvas.clientWidth / 2;
        const centerY = this.previewCanvas.clientHeight / 2;
        const radius = 50; // Smaller radius for preview

        // Get initial color (vibrant pastel: 85% saturation, 78% lightness)
        const color = this.hslToHex(this.currentHue, 85, 78);

        // Create a softbody puff with neutral state
        this.previewPuff = new SoftBody(centerX, centerY, radius, 12, color, {
            hunger: 100,  // Full (normal color)
            mood: 0,      // Happy
            energy: 100   // Full energy
        });

        // Set initial color
        this.updatePuffColor();
    },

    updatePuffColor() {
        if (!this.previewPuff) return;

        const color = this.hslToHex(this.currentHue, 85, 78);
        this.previewPuff.baseColor = color;
        this.previewPuff.color = color;
    },

    startPreviewAnimation() {
        const animate = () => {
            // Clear canvas (use internal dimensions)
            this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

            // Update puff animation
            if (this.previewPuff) {
                this.previewPuff.applyOrganicDeformation();
                this.previewPuff.draw(this.previewCtx);
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

    cleanup() {
        this.stopPreviewAnimation();
        this.previewPuff = null;
    },

    // Convert HSL to Hex color
    hslToHex(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }
};
