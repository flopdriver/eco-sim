// Main Simulation Controller - Top-level coordination
const SimulationController = {
    // System references
    core: null,
    environment: null,
    physics: null,
    biology: null,
    rendering: null,
    userInteraction: null,

    // Module references
    systemManager: null,
    environmentInitializer: null,
    performanceManager: null,
    uiManager: null,
    ecosystemBalancer: null,

    // Runtime state
    running: false,
    simulationSpeed: 1,

    // Active pixel tracking
    activePixels: null,

    // Type and state enums
    TYPE: null,
    STATE: null,

    init: function(canvasId) {
        console.log("Initializing simulation controller...");

        // Check if WebGL is supported
        if (!WebGLUtils.isWebGLSupported()) {
            alert('WebGL is not supported in your browser. This simulation requires WebGL.');
            return null;
        }

        // Get the canvas element from the ID
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error('Canvas element not found with ID:', canvasId);
            return null;
        }

        // Initialize active pixels set
        this.activePixels = new Set();
        
        // Set up constants first to ensure they're available to all subsystems
        this.initializeConstants();

        // Initialize all module managers
        this.systemManager = SystemManager.init(this);

        // Initialize all systems through system manager
        if (!this.systemManager.initializeSystems(canvas)) {
            return null;
        }

        // Propagate constants to subsystems
        this.systemManager.propagateConstants();

        // Initialize other manager modules with required references
        this.environmentInitializer = EnvironmentInitializer.init(this);
        this.performanceManager = PerformanceManager.init(this);
        this.uiManager = UIManager.init(this);
        this.ecosystemBalancer = EcosystemBalancer.init(this);

        // Set up initial environment
        this.environmentInitializer.initializeEnvironment();

        // Setup UI components
        this.uiManager.setupUI();

        // Initialize environmental-biological connections
        this.ecosystemBalancer.initializeEnvironmentalConnections();

        console.log("Simulation initialization complete.");
        return this;
    },

    // Set up type and state constants
    initializeConstants: function() {
        // Pixel type enum
        this.TYPE = {
            AIR: 0,
            WATER: 1,
            SOIL: 2,
            PLANT: 3,
            INSECT: 4,
            SEED: 5,
            DEAD_MATTER: 6,
            WORM: 7
        };

        // Pixel state enum
        this.STATE = {
            DEFAULT: 0,
            WET: 1,
            DRY: 2,
            FERTILE: 3,
            ROOT: 4,
            STEM: 5,
            LEAF: 6,
            FLOWER: 7,
            LARVA: 8,
            ADULT: 9,
            DECOMPOSING: 10,
            CLAY: 11,     // Clay soil type (poor drainage)
            SANDY: 12,    // Sandy soil type (good drainage)
            LOAMY: 13,    // Loamy soil type (balanced retention and drainage)
            ROCKY: 14     // Rocky soil type (excellent drainage, poor retention)
        };
    },

    // Start the simulation
    start: function() {
        console.log("Starting simulation...");
        this.running = true;
        this.performanceManager.resetTiming();
        // Only start animation frame if speed is positive
        if (this.simulationSpeed > 0) {
            requestAnimationFrame(() => this.update());
        }
    },

    // Stop the simulation
    stop: function() {
        console.log("Stopping simulation...");
        this.running = false;
    },

    // Toggle simulation pause state
    togglePause: function() {
        if (this.running) {
            this.stop();
        } else {
            this.start();
        }
    },

    // Reset the simulation
    reset: function() {
        console.log("Resetting simulation...");
        this.stop();

        // Clear all arrays
        this.core.type.fill(0);
        this.core.state.fill(0);
        this.core.water.fill(0);
        this.core.nutrient.fill(0);
        this.core.energy.fill(0);
        this.core.metadata.fill(0);

        // Clear active pixels
        this.activePixels = new Set();

        // Re-initialize environment
        this.environmentInitializer.initializeEnvironment();

        // Reset environmental-biological connections
        this.ecosystemBalancer.initializeEnvironmentalConnections();

        // Don't automatically start the simulation after reset
    },

    // Main update loop
    update: function() {
        if (!this.running) return;

        // Track performance
        this.performanceManager.startFrame();

        // Track pixels that will become active next frame
        const nextActivePixels = new Set();

        // Run multiple update steps based on speed setting
        for (let i = 0; i < this.simulationSpeed && this.running; i++) {
            // Periodically update environmental-biological connections
            if (i === 0 && Math.random() < 0.01) {
                this.ecosystemBalancer.updateBiologicalRates();
            }

            // Update each system in order:
            this.environment.update(this.activePixels, nextActivePixels);
            this.physics.update(this.activePixels, nextActivePixels);
            this.biology.update(this.activePixels, nextActivePixels);

            // Manage active pixels with performance considerations
            this.performanceManager.manageActivePixels(nextActivePixels);

            // Update active pixels for next iteration
            this.activePixels = new Set(nextActivePixels);
            nextActivePixels.clear();
        }

        // End timing for this frame
        this.performanceManager.endFrame();

        // Update statistics display
        this.uiManager.updateStats();

        // Render
        this.rendering.render();

        // Schedule next update only if still running
        if (this.running && this.simulationSpeed > 0) {
            requestAnimationFrame(() => this.update());
        }
    }
};

// Export the controller - make it work in both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimulationController;
}

// Initialize and start the simulation when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Check WebGL support first
    if (!WebGLUtils.isWebGLSupported()) {
        alert('WebGL is not supported in your browser. This simulation requires WebGL.');
        return;
    }

    // Make sure the canvas exists and has dimensions
    const canvas = document.getElementById('ecosystem-canvas');
    if (!canvas) {
        console.error('Canvas element not found with ID: ecosystem-canvas');
        return;
    }

    // Ensure the canvas has proper dimensions
    if (canvas.width === 0 || canvas.height === 0) {
        // Set default dimensions if not specified in CSS
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        console.log('Set canvas dimensions:', canvas.width, 'x', canvas.height);
    }

    // Initialize simulation with the verified canvas
    const simulation = SimulationController.init('ecosystem-canvas');
    if (simulation) {
        simulation.start();

        // Make simulation globally accessible for debugging
        window.ecosim = simulation;
    }
});