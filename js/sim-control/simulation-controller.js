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

    chunkManager: null,
    useChunkedProcessing: true, // Flag to enable/disable chunked processing

    init: function(canvasId) {
        console.log("Initializing simulation controller...");

        // Check if WebGL is supported
        if (!WebGLUtils.isWebGLSupported()) {
            alert('WebGL is not supported in your browser. This simulation requires WebGL.');
            return null;
        }

        // Initialize active pixels set
        this.activePixels = new Set();

        // Initialize all module managers
        this.systemManager = SystemManager.init(this);

        // Initialize all systems through system manager
        if (!this.systemManager.initializeSystems(canvasId)) {
            return null;
        }

        // Set up constants and propagate to subsystems
        this.initializeConstants();
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

        // Initialize chunk manager if chunked processing is enabled
        if (this.useChunkedProcessing) {
            this.chunkManager = ChunkManager.init(this);
        }

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
            DECOMPOSING: 10
        };
    },

    // Start the simulation
    start: function() {
        console.log("Starting simulation...");
        this.running = true;
        this.performanceManager.resetTiming();

        // Initialize chunked system if needed
        if (this.useChunkedProcessing && this.chunkManager) {
            this.chunkManager.initialSync();
        }

        requestAnimationFrame(() => this.update());
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
            document.getElementById('pause-button').textContent = 'Resume';
        } else {
            this.start();
            document.getElementById('pause-button').textContent = 'Pause';
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
        this.activePixels.clear();

        // Re-initialize environment
        this.environmentInitializer.initializeEnvironment();

        // Reset environmental-biological connections
        this.ecosystemBalancer.initializeEnvironmentalConnections();

        // Restart simulation
        this.start();
    },

    update: function() {
        if (!this.running) return;

        // Track performance
        this.performanceManager.startFrame();

        // Process active pixels
        if (this.useChunkedProcessing && this.chunkManager) {
            // Use chunked processing
            this.chunkManager.update();
        } else {
            // Use original processing
            // Track pixels that will become active next frame
            const nextActivePixels = new Set();

            // Run multiple update steps based on speed setting
            for (let i = 0; i < this.simulationSpeed; i++) {
                // Periodically update environmental-biological connections
                if (i === 0 && Math.random() < 0.05) {
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
        }

        // End timing for this frame
        this.performanceManager.endFrame();

        // Update statistics display
        this.uiManager.updateStats();

        // Render
        this.rendering.render();

        // Schedule next update
        if (this.running) {
            requestAnimationFrame(() => this.update());
        }
    },
};

// Initialize and start the simulation when the page loads
window.onload = function() {
    // Check WebGL support first
    if (!WebGLUtils.isWebGLSupported()) {
        alert('WebGL is not supported in your browser. This simulation requires WebGL.');
        return;
    }

    const simulation = SimulationController.init('ecosystem-canvas');
    if (simulation) {
        simulation.start();

        // Make simulation globally accessible for debugging
        window.ecosim = simulation;
    }
};