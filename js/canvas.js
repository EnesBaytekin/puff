// Canvas setup and rendering system

class Canvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = 0;
        this.height = 0;
        this.pixelRatio = window.devicePixelRatio || 1;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    // Resize canvas to fill screen, handling high-DPI displays
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Set actual canvas size (scaled for high-DPI)
        this.canvas.width = this.width * this.pixelRatio;
        this.canvas.height = this.height * this.pixelRatio;

        // Set CSS size
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';

        // Scale drawing context
        this.ctx.scale(this.pixelRatio, this.pixelRatio);
    }

    // Clear the canvas
    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    // Get canvas dimensions
    getWidth() {
        return this.width;
    }

    getHeight() {
        return this.height;
    }

    // Get drawing context
    getContext() {
        return this.ctx;
    }

    // Get pixel ratio
    getPixelRatio() {
        return this.pixelRatio;
    }
}
