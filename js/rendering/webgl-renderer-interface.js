// WebGL Renderer Interface Module
// Main entry point to the rendering system, coordinating the various rendering modules

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
    init: function(core, canvas) {
        console.log("Initializing WebGL rendering system...");
        
        // Verify core dimensions are available
        if (!core || !core.width || !core.height) {
            console.error("WebGL rendering system init failed: core dimensions not available", 
                         core ? `${core.width}x${core.height}` : "core not provided");
            return null;
        }
        
        console.log(`WebGL system initializing with core dimensions: ${core.width}x${core.height}`);

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
        this.rendererCore = WebGLRendererCore.init(core, canvas);
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
        return this.visualizationManager.setMode(mode);
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
    }
};