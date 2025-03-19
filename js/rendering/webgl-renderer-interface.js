// WebGL Renderer Interface Module
// Main entry point to the rendering system, coordinating the various rendering modules

window.WebGLRenderingSystem = {
    // References to other modules
    rendererCore: null,
    visualizationManager: null,
    colorMapper: null,

    // Type and state enums
    TYPE: null,
    STATE: null,

    // Initialize the rendering system
    init: function(core, canvasId) {
        console.log("Initializing WebGL rendering system...");

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
        this.rendererCore = WebGLRendererCore.init(core, canvasId);
        if (!this.rendererCore) {
            console.error("Failed to initialize WebGL renderer core");
            return null;
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
    }
};