// Input handler for mouse and touch interaction

class InputHandler {
    constructor(canvas, softBody, physicsSolver) {
        this.canvas = canvas;
        this.softBody = softBody;
        this.physicsSolver = physicsSolver;
        this.draggedParticle = null;
        this.isDragging = false;
        this.dragX = 0; // Current drag position
        this.dragY = 0;

        this.setupMouseEvents();
        this.setupTouchEvents();
    }

    // Get position from mouse event
    getMousePosition(event) {
        const rect = this.canvas.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    // Get position from touch event
    getTouchPosition(event) {
        const rect = this.canvas.canvas.getBoundingClientRect();
        const touch = event.touches[0];
        return {
            x: touch.clientX - rect.left,
            y: touch.clientY - rect.top
        };
    }

    // Start dragging
    startDrag(x, y) {
        this.physicsSolver.markInteraction(); // Mark that user interacted
        this.draggedParticle = this.softBody.findNearestParticle(x, y);
        if (this.draggedParticle) {
            this.isDragging = true;
            this.dragX = x;
            this.dragY = y;
        }
    }

    // Continue dragging (store position for continuous application)
    drag(x, y) {
        if (this.isDragging) {
            this.physicsSolver.markInteraction(); // Keep marking while dragging
            this.dragX = x;
            this.dragY = y;
        }
    }

    // Apply continuous drag force (called every frame while holding)
    // Energy affects how quickly the puff follows the finger (dramatically)
    continuousDrag() {
        if (this.isDragging && this.draggedParticle) {
            // Get energy from softBody state
            const energy = this.softBody.puffState.energy || 50;
            const energyFactor = energy / 100; // 0 = exhausted, 1 = full energy

            // Low energy = very sluggish following (0.01 to 0.8 range)
            // Very dramatic difference: exhausted puff barely moves
            const dragStrength = 0.01 + energyFactor * 0.79;

            this.physicsSolver.applyDrag(this.draggedParticle, this.dragX, this.dragY, dragStrength);
        }
    }

    // Stop dragging
    endDrag() {
        this.isDragging = false;
        this.draggedParticle = null;
    }

    // Setup mouse events
    setupMouseEvents() {
        this.canvas.canvas.addEventListener('mousedown', (event) => {
            const pos = this.getMousePosition(event);
            this.startDrag(pos.x, pos.y);
        });

        window.addEventListener('mousemove', (event) => {
            const pos = this.getMousePosition(event);
            this.drag(pos.x, pos.y);
        });

        window.addEventListener('mouseup', () => {
            this.endDrag();
        });

        // Handle mouse leaving window
        window.addEventListener('mouseleave', () => {
            this.endDrag();
        });
    }

    // Setup touch events
    setupTouchEvents() {
        this.canvas.canvas.addEventListener('touchstart', (event) => {
            event.preventDefault(); // Prevent scrolling
            const pos = this.getTouchPosition(event);
            this.startDrag(pos.x, pos.y);
        }, { passive: false });

        window.addEventListener('touchmove', (event) => {
            event.preventDefault(); // Prevent scrolling
            const pos = this.getTouchPosition(event);
            this.drag(pos.x, pos.y);
        }, { passive: false });

        window.addEventListener('touchend', () => {
            this.endDrag();
        });

        window.addEventListener('touchcancel', () => {
            this.endDrag();
        });
    }
}
