// Main application entry point

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize canvas
    const canvas = new Canvas('canvas');

    // Create creature in center of screen
    const centerX = canvas.getWidth() / 2;
    const centerY = canvas.getHeight() / 2;
    const radius = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.15;

    const creature = new SoftBody(centerX, centerY, radius, 20);

    // Initialize physics solver
    const physicsSolver = new PhysicsSolver(
        0,      // gravity (disabled - using centering force instead)
        0.98,   // damping
        5       // constraint iterations
    );

    // Initialize input handler
    const inputHandler = new InputHandler(canvas, creature, physicsSolver);

    // Main game loop
    function update() {
        // Apply organic lava lamp deformation (continuous morphing)
        creature.applyOrganicDeformation();

        // Apply continuous drag force (keeps creature under finger while holding)
        inputHandler.continuousDrag();

        // Update physics
        physicsSolver.update(creature, canvas.getWidth(), canvas.getHeight());

        // Clear canvas
        canvas.clear();

        // Draw creature
        creature.draw(canvas.getContext());

        // Request next frame
        requestAnimationFrame(update);
    }

    // Start the loop
    update();

    // Handle window resize (recenter creature)
    window.addEventListener('resize', () => {
        // Optional: you could recenter the creature here
        // For now, the creature will stay where it is
    });
});
