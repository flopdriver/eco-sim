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

        // 1. Core data structures (no dependencies)
        this.controller.core = CoreSimulation.init();
        if (!this.controller.core) {
            console.error("Failed to initialize core simulation.");
            return false;
        }

        // 2. Environment system (depends on core)
        this.controller.environment = EnvironmentSystem.init(this.controller.core);
        if (!this.controller.environment) {
            console.error("Failed to initialize environment system.");
            return false;
        }

        // 3. Physics system (depends on core)
        this.controller.physics = PhysicsSystem.init(this.controller.core);
        if (!this.controller.physics) {
            console.error("Failed to initialize physics system.");
            return false;
        }

        // 4. Biology system (depends on core and environment)
        this.controller.biology = BiologySystem.init(this.controller.core);
        if (!this.controller.biology) {
            console.error("Failed to initialize biology system.");
            return false;
        }

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

        return true;
    },

    // Propagate constants to all subsystems
    propagateConstants: function() {
        console.log("Propagating constants to subsystems...");

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

        // Propagate to biology subsystems
        if (this.controller.biology) {
            this.controller.biology.propagateConstants();
        }

        // Propagate to user interaction subsystems
        if (this.controller.userInteraction) {
            this.controller.userInteraction.propagateConstants();
        }
    }
};