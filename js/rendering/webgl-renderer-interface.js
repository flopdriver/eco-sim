// WebGL Renderer Interface Module
// Main entry point to the rendering system, coordinating the various rendering modules
// Enhanced to work with the chunk-based ecosystem

window.WebGLRenderingSystem = {
    // References to other modules
    rendererCore: null,
    visualizationManager: null,
    colorMapper: null,
    zoomController: null,

    // Type and state enums
    TYPE: null,
    STATE: null,

    // Initialize the rendering system
    init: function(core, canvasId, chunkManager) {
        console.log("Initializing WebGL rendering system with chunk support...");

        // Store references to type and state enums
        this.TYPE = core.TYPE;
        this.STATE = core.STATE;

        // Initialize visualization manager first (no dependencies)
        this.visualizationManager = VisualizationManager.init();
        if (!this.visualizationManager) {
            console.error("Failed to initialize visualization manager");
            return null;
        }

        // Initialize color mapper (depends on core and enums)
        this.colorMapper = ColorMapper.init(core, this.TYPE, this.STATE);
        if (!this.colorMapper) {
            console.error("Failed to initialize color mapper");
            return null;
        }

        // Initialize renderer core (depends on all other modules)
        // Pass chunkManager to enable chunk-based rendering
        this.rendererCore = WebGLRendererCore.init(core, canvasId, chunkManager);
        if (!this.rendererCore) {
            console.error("Failed to initialize WebGL renderer core");
            return null;
        }

        // Initialize zoom controller (depends on renderer core)
        this.zoomController = ZoomController.init(this);
        if (!this.zoomController) {
            console.error("Failed to initialize zoom controller");
            // Non-fatal, continue anyway
        }

        // Set up reference to canvas for external access
        this.canvas = this.rendererCore.canvas;

        console.log("WebGL rendering system initialization complete");
        return this;
    },

    // Set visualization mode
    setVisualizationMode: function(mode) {
        const success = this.visualizationManager.setMode(mode);

        // Mark all chunks as needing re-rendering after visualization change
        if (success && this.rendererCore.chunkVisibilityBuffers) {
            this.rendererCore.chunkVisibilityBuffers.dirtyFlags.fill(1);
        }

        return success;
    },

    // Get current visualization mode
    getVisualizationMode: function() {
        return this.visualizationManager.getMode();
    },

    // Get visualization mode description
    getVisualizationDescription: function() {
        return this.visualizationManager.getModeDescription();
    },

    // Render the current simulation state
    render: function() {
        return this.rendererCore.render();
    },

    // Resize the rendering canvas
    resize: function(width, height) {
        return this.rendererCore.resize(width, height);
    },

    // Update scale factor for window resizing while keeping simulation size
    updateScaleFactor: function(width, height) {
        if (!this.rendererCore) {
            console.warn("Renderer core not initialized yet");
            return 1.0;
        }

        // Check if base dimensions are available
        if (!this.rendererCore.baseWidth) {
            // Use default values if core simulation dimensions aren't set yet
            this.rendererCore.baseWidth = 400;  // Default width
            this.rendererCore.baseHeight = 300; // Default height
        }

        // Calculate optimal scale factor based on window size
        const scaleFactor = Math.min(
            width / this.rendererCore.baseWidth,
            height / this.rendererCore.baseHeight
        );

        // Update the renderer with new scale factor
        this.rendererCore.setScaleFactor(scaleFactor);

        return scaleFactor;
    },

    // Toggle chunk-based rendering optimization
    toggleChunkRendering: function(enabled) {
        if (this.rendererCore) {
            this.rendererCore.toggleChunkRendering(enabled);
        }
    }
};