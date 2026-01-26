// Main app view
const AppView = {
    canvas: null,
    creature: null,
    physicsSolver: null,
    inputHandler: null,
    animationFrameId: null,

    init(puffData) {
        // Clean up previous instance if exists
        this.cleanup();

        // Initialize canvas
        this.canvas = new Canvas('canvas');

        // Create creature with custom color
        const centerX = this.canvas.getWidth() / 2;
        const centerY = this.canvas.getHeight() / 2;
        const radius = Math.min(this.canvas.getWidth(), this.canvas.getHeight()) * 0.15;

        this.creature = new SoftBody(centerX, centerY, radius, 20, puffData.color);

        // Initialize physics solver
        this.physicsSolver = new PhysicsSolver(
            0,      // gravity (disabled - using centering force instead)
            0.98,   // damping
            5       // constraint iterations
        );

        // Initialize input handler
        this.inputHandler = new InputHandler(this.canvas, this.creature, this.physicsSolver);

        // Setup logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                API.logout();
            };
        }

        // Start the game loop
        this.startLoop();
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

        // Clear canvas if exists
        if (this.canvas) {
            this.canvas.clear();
        }
    }
};
