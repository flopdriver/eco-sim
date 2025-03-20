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

    // Active pixel tracking (mainly for rendering now)
    activePixels: null,

    // Type and state enums
    TYPE: null,
    STATE: null,

    // Chunk system
    chunkManager: null,

    init: function(canvasId) {
        console.log("Initializing simulation controller...");

        // Check if WebGL is supported
        if (!WebGLUtils.isWebGLSupported()) {
            alert('WebGL is not supported in your browser. This simulation requires WebGL.');
            return null;
        }

        // Initialize active pixels set (still needed for rendering)
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

        // Initialize chunk manager - always use chunked processing
        this.chunkManager = ChunkManager.init(this);

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

    initializeSystems: function(canvasId) {
        console.log("Initializing subsystems...");

        // 1. Core data structures (still needed for rendering/reference)
        this.core = CoreSimulation.init();
        if (!this.core) {
            console.error("Failed to initialize core simulation.");
            return false;
        }

        // Set TYPE and STATE on core immediately
        this.core.TYPE = this.controller.TYPE;
        this.core.STATE = this.controller.STATE;

        // 2. Initialize chunk manager first, as it's needed for rendering
        this.chunkManager = ChunkManager.init(this);
        if (!this.chunkManager) {
            console.error("Failed to initialize chunk manager.");
            return false;
        }

        // 3. Environment system (depends on core)
        this.environment = EnvironmentController.init(this.core);
        if (!this.environment) {
            console.error("Failed to initialize environment system.");
            return false;
        }

        // Set TYPE and STATE on environment immediately
        this.environment.TYPE = this.TYPE;
        this.environment.STATE = this.STATE;

        // 4. Physics system (depends on core)
        this.physics = PhysicsSystem.init(this.core);
        if (!this.physics) {
            console.error("Failed to initialize physics system.");
            return false;
        }

        // Set TYPE and STATE on physics immediately
        this.physics.TYPE = this.TYPE;
        this.physics.STATE = this.STATE;

        // 5. Biology system (depends on core and environment)
        this.biology = BiologySystem.init(this.core);
        if (!this.biology) {
            console.error("Failed to initialize biology system.");
            return false;
        }

        // Set TYPE and STATE on biology immediately
        this.biology.TYPE = this.TYPE;
        this.biology.STATE = this.STATE;
        this.biology.propagateConstants();

        // 6. Rendering system (depends on core and now on chunk manager too)
        this.rendering = WebGLRenderingSystem.init(this.core, canvasId, this.chunkManager);
        if (!this.rendering) {
            console.error("Failed to initialize WebGL rendering system.");
            return false;
        }

        // 7. User interaction system (depends on core and rendering)
        this.userInteraction = UserInteractionSystem.init(
            this.core,
            this.rendering.canvas
        );
        if (!this.userInteraction) {
            console.error("Failed to initialize user interaction system.");
            return false;
        }

        // Set TYPE and STATE on user interaction immediately
        this.userInteraction.TYPE = this.TYPE;
        this.userInteraction.STATE = this.STATE;
        this.userInteraction.propagateConstants();

        console.log("All subsystems initialized successfully");
        return true;
    },

    // Start the simulation
    start: function() {
        console.log("Starting simulation...");
        this.running = true;
        this.performanceManager.resetTiming();

        // Initialize chunked system and sync data
        this.chunkManager.initialSync();

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

        // Re-initialize chunk system
        this.chunkManager.initialSync();

        // Restart simulation
        this.start();
    },

    update: function() {
        if (!this.running) return;

        // Track performance
        this.performanceManager.startFrame();

        // Run multiple update steps based on speed setting
        for (let i = 0; i < this.simulationSpeed; i++) {
            // Periodically update environmental-biological connections
            if (i === 0 && Math.random() < 0.05) {
                this.ecosystemBalancer.updateBiologicalRates();
            }

            // Update using chunk manager (optimized approach)
            this.chunkManager.update();
        }

        // End timing for this frame
        this.performanceManager.endFrame();

        // Update statistics display
        this.uiManager.updateStats();

        // Render - no need to sync active pixels since rendering is now chunk-based
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