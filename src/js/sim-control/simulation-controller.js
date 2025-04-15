import { SystemManager } from './system-manager.js';
import { WebGLUtils } from '../rendering/webgl-utils.js';
import { EnvironmentInitializer } from './environment-initializer.js';
import { PerformanceManager } from './performance-manager.js';
import { UIManager } from './ui-manager.js';
import { EcosystemBalancer } from './ecosystem-balancer.js';

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
    lastFrameTime: 0,
    targetFrameTime: 16.67, // Target 60 FPS (1000ms / 60)

    // Active pixel tracking
    activePixels: null,
    nextActivePixels: null,

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

        // Initialize active pixels sets
        this.activePixels = new Set();
        this.nextActivePixels = new Set();

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
        this.lastFrameTime = performance.now();
        this.performanceManager.resetTiming();
        requestAnimationFrame((timestamp) => this.update(timestamp));
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
        this.nextActivePixels.clear();

        // Re-initialize environment
        this.environmentInitializer.initializeEnvironment();

        // Reset environmental-biological connections
        this.ecosystemBalancer.initializeEnvironmentalConnections();

        // Restart simulation
        this.start();
    },

    // Main update loop
    update: function(timestamp) {
        if (!this.running) return;

        // Calculate frame time and adjust simulation speed if needed
        const frameTime = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        // Track performance
        this.performanceManager.startFrame();

        // Clear next active pixels set
        this.nextActivePixels.clear();

        // Run multiple update steps based on speed setting
        for (let i = 0; i < this.simulationSpeed; i++) {
            // Periodically update environmental-biological connections
            if (i === 0 && Math.random() < 0.05) {
                this.ecosystemBalancer.updateBiologicalRates();
            }

            // Update each system in order
            try {
                this.environment.update(this.activePixels, this.nextActivePixels);
                this.physics.update(this.activePixels, this.nextActivePixels);
                this.biology.update(this.activePixels, this.nextActivePixels);
            } catch (e) {
                console.error("Error during system update:", e);
                this.stop();
                return;
            }

            // Manage active pixels with performance considerations
            this.performanceManager.manageActivePixels(this.nextActivePixels);

            // Update active pixels for next iteration
            this.activePixels = new Set(this.nextActivePixels);
            this.nextActivePixels.clear();
        }

        // End timing for this frame
        this.performanceManager.endFrame();

        // Update statistics display
        try {
            this.uiManager.updateStats();
        } catch (e) {
            console.error("Error during UI Stats update:", e);
            this.stop();
            return;
        }
        
        // Render
        try {
            this.rendering.render();
        } catch (e) {
            console.error("Error during Rendering:", e);
            this.stop();
            return;
        }

        // Schedule next update with frame timing
        if (this.running) {
            const nextFrameTime = Math.max(0, this.targetFrameTime - (performance.now() - timestamp));
            setTimeout(() => {
                requestAnimationFrame((nextTimestamp) => this.update(nextTimestamp));
            }, nextFrameTime);
        }
    }
};

export { SimulationController };