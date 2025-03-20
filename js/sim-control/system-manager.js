// System Manager - Handles initialization and coordination of subsystems
const SystemManager = {
    // Reference to main controller
    controller: null,

    // Initialize system manager
    init: function(controller) {
        console.log("Initializing system manager...");
        this.controller = controller;
        return this;
    },

    // Initialize all subsystems in proper order
    initializeSystems: function(canvasId) {
        console.log("Initializing subsystems...");

        // 1. Core data structures (still needed for rendering/reference)
        this.controller.core = CoreSimulation.init();
        if (!this.controller.core) {
            console.error("Failed to initialize core simulation.");
            return false;
        }

        // Set TYPE and STATE on core immediately
        this.controller.core.TYPE = this.controller.TYPE;
        this.controller.core.STATE = this.controller.STATE;

        // 2. Environment system (depends on core)
        this.controller.environment = EnvironmentController.init(this.controller.core);
        if (!this.controller.environment) {
            console.error("Failed to initialize environment system.");
            return false;
        }

        // Set TYPE and STATE on environment immediately
        this.controller.environment.TYPE = this.controller.TYPE;
        this.controller.environment.STATE = this.controller.STATE;

        // 3. Physics system (depends on core)
        this.controller.physics = PhysicsSystem.init(this.controller.core);
        if (!this.controller.physics) {
            console.error("Failed to initialize physics system.");
            return false;
        }

        // Set TYPE and STATE on physics immediately
        this.controller.physics.TYPE = this.controller.TYPE;
        this.controller.physics.STATE = this.controller.STATE;

        // 4. Biology system (depends on core and environment)
        this.controller.biology = BiologySystem.init(this.controller.core);
        if (!this.controller.biology) {
            console.error("Failed to initialize biology system.");
            return false;
        }

        // Set TYPE and STATE on biology immediately
        this.controller.biology.TYPE = this.controller.TYPE;
        this.controller.biology.STATE = this.controller.STATE;
        this.controller.biology.propagateConstants();

        // 5. Rendering system (depends on core)
        this.controller.rendering = WebGLRenderingSystem.init(this.controller.core, canvasId);
        if (!this.controller.rendering) {
            console.error("Failed to initialize WebGL rendering system.");
            return false;
        }

        // 6. User interaction system (depends on core and rendering)
        this.controller.userInteraction = UserInteractionSystem.init(
            this.controller.core,
            this.controller.rendering.canvas
        );
        if (!this.controller.userInteraction) {
            console.error("Failed to initialize user interaction system.");
            return false;
        }

        // Set TYPE and STATE on user interaction immediately
        this.controller.userInteraction.TYPE = this.controller.TYPE;
        this.controller.userInteraction.STATE = this.controller.STATE;
        this.controller.userInteraction.propagateConstants();

        console.log("All subsystems initialized successfully");
        return true;
    },

    // Propagate constants to all subsystems
    propagateConstants: function() {
        console.log("Propagating constants to subsystems...");

        // Verify TYPE and STATE are valid
        if (!this.controller.TYPE || !this.controller.STATE) {
            console.error("TYPE and STATE not initialized in controller");
            return false;
        }

        // Set TYPE and STATE on all main systems
        this.controller.core.TYPE = this.controller.TYPE;
        this.controller.core.STATE = this.controller.STATE;

        this.controller.environment.TYPE = this.controller.TYPE;
        this.controller.environment.STATE = this.controller.STATE;

        this.controller.physics.TYPE = this.controller.TYPE;
        this.controller.physics.STATE = this.controller.STATE;

        this.controller.biology.TYPE = this.controller.TYPE;
        this.controller.biology.STATE = this.controller.STATE;

        this.controller.rendering.TYPE = this.controller.TYPE;
        this.controller.rendering.STATE = this.controller.STATE;

        this.controller.userInteraction.TYPE = this.controller.TYPE;
        this.controller.userInteraction.STATE = this.controller.STATE;

        // Propagate to rendering subsystems specifically
        if (window.ColorMapper) {
            window.ColorMapper.TYPE = this.controller.TYPE;
            window.ColorMapper.STATE = this.controller.STATE;
            window.ColorMapper.core = this.controller.core;
        }

        // Propagate to biology subsystems
        if (this.controller.biology) {
            this.controller.biology.propagateConstants();
        }

        // Propagate to user interaction subsystems
        if (this.controller.userInteraction) {
            this.controller.userInteraction.propagateConstants();
        }

        // Propagate to chunk manager if initialized
        if (this.controller.chunkManager) {
            this.controller.chunkManager.setTypeEnum(this.controller.TYPE);
            this.controller.chunkManager.setStateEnum(this.controller.STATE);
        }

        console.log("Constants propagated successfully");
        return true;
    }
};