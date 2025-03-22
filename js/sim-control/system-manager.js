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
    initializeSystems: function(canvas) {
        console.log("Initializing subsystems...");

        // Initialize core simulation first
        this.controller.core = CoreSimulation.init();
        if (!this.controller.core) {
            console.error('Failed to initialize core simulation.');
            return false;
        }
        
        // Make sure core dimensions are directly available on controller
        this.controller.width = this.controller.core.width;
        this.controller.height = this.controller.core.height;
        this.controller.pixelSize = this.controller.core.pixelSize;

        // Initialize environment system
        this.controller.environment = EnvironmentController.init(this.controller.core);
        if (!this.controller.environment) {
            console.error('Failed to initialize environment system.');
            return false;
        }

        // Initialize physics system - physics system expects controller.core, not the controller itself
        console.log("Core object being passed to PhysicsSystem:", Object.keys(this.controller.core));
        this.controller.physics = PhysicsSystem.init(this.controller.core);
        if (!this.controller.physics) {
            console.error('Failed to initialize physics system.');
            return false;
        }

        // Initialize biology system
        this.controller.biology = BiologySystem.init(this.controller.core);
        if (!this.controller.biology) {
            console.error('Failed to initialize biology system.');
            return false;
        }

        // Initialize rendering system
        this.controller.rendering = WebGLRenderingSystem.init(this.controller.core, canvas);
        if (!this.controller.rendering) {
            console.error('Failed to initialize rendering system.');
            return false;
        }

        // Initialize user interaction system
        this.controller.userInteraction = UserInteractionSystem.init(this.controller, canvas);
        if (!this.controller.userInteraction) {
            console.error('Failed to initialize user interaction system.');
            return false;
        }

        // Propagate constants to all systems
        return this.propagateConstants();
    },

    // Propagate constants to all subsystems
    propagateConstants: function() {
        console.log("Propagating constants to subsystems...");

        if (!this.controller.TYPE || !this.controller.STATE) {
            console.error('TYPE and STATE not initialized in controller');
            return false;
        }

        // Propagate to core simulation
        this.controller.core.TYPE = this.controller.TYPE;
        this.controller.core.STATE = this.controller.STATE;

        // Propagate to environment system
        this.controller.environment.TYPE = this.controller.TYPE;
        this.controller.environment.STATE = this.controller.STATE;

        // Propagate to physics system
        this.controller.physics.TYPE = this.controller.TYPE;
        this.controller.physics.STATE = this.controller.STATE;

        // Propagate to biology system
        this.controller.biology.TYPE = this.controller.TYPE;
        this.controller.biology.STATE = this.controller.STATE;

        // Propagate to rendering system
        this.controller.rendering.TYPE = this.controller.TYPE;
        this.controller.rendering.STATE = this.controller.STATE;

        // Propagate to user interaction system
        this.controller.userInteraction.TYPE = this.controller.TYPE;
        this.controller.userInteraction.STATE = this.controller.STATE;

        // Update ColorMapper
        window.ColorMapper.TYPE = this.controller.TYPE;
        window.ColorMapper.STATE = this.controller.STATE;
        window.ColorMapper.core = this.controller.core;

        // Propagate constants to systems that need it
        this.controller.biology.propagateConstants();
        this.controller.userInteraction.propagateConstants();

        console.log("Constants propagated successfully");
        return true;
    }
};

// Export the manager - make it work in both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemManager;
}