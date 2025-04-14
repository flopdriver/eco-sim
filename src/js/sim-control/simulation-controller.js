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

    // Main update loop
    update: function() {
        // console.log("Entering SimulationController.update..."); // DEBUG
        if (!this.running) {
            // console.log("Simulation not running, exiting update."); // DEBUG
            return;
        }

        // Track performance
        this.performanceManager.startFrame();
        // console.log(`Frame started. Active pixels: ${this.activePixels.size}`); // DEBUG

        // Track pixels that will become active next frame
        const nextActivePixels = new Set();

        // Run multiple update steps based on speed setting
        for (let i = 0; i < this.simulationSpeed; i++) {
            // console.log(`  Update step ${i + 1}/${this.simulationSpeed}`); // DEBUG
            
            // Periodically update environmental-biological connections
            if (i === 0 && Math.random() < 0.05) {
                // console.log("    Updating biological rates..."); // DEBUG
                this.ecosystemBalancer.updateBiologicalRates();
            }

            // Update each system in order:
            try {
                // console.log("    Updating Environment..."); // DEBUG
                this.environment.update(this.activePixels, nextActivePixels);
                // console.log("    Environment updated."); // DEBUG
            } catch (e) {
                console.error("Error during Environment update:", e); this.stop(); return; 
            }
             try {
                // console.log("    Updating Physics..."); // DEBUG
                this.physics.update(this.activePixels, nextActivePixels);
                // console.log("    Physics updated."); // DEBUG
            } catch (e) {
                console.error("Error during Physics update:", e); this.stop(); return; 
            }
            try {
                // console.log("    Updating Biology..."); // DEBUG
                this.biology.update(this.activePixels, nextActivePixels);
                // console.log("    Biology updated."); // DEBUG
            } catch (e) {
                console.error("Error during Biology update:", e); this.stop(); return; 
            }

            // Manage active pixels with performance considerations
            // console.log(`    Pixels active before manage: ${nextActivePixels.size}`); // DEBUG
            this.performanceManager.manageActivePixels(nextActivePixels);
            // console.log(`    Pixels active after manage: ${nextActivePixels.size}`); // DEBUG

            // Update active pixels for next iteration
            this.activePixels = new Set(nextActivePixels);
            nextActivePixels.clear();
            // console.log(`  End of step ${i + 1}. Next frame active pixels: ${this.activePixels.size}`); // DEBUG
        }

        // End timing for this frame
        this.performanceManager.endFrame();

        // Update statistics display
        try {
            // console.log("  Updating UI Stats..."); // DEBUG
            this.uiManager.updateStats();
            // console.log("  UI Stats updated."); // DEBUG
        } catch (e) {
             console.error("Error during UI Stats update:", e); this.stop(); return; 
        }
        
        // Render
        try {
            // console.log("  Rendering..."); // DEBUG
            this.rendering.render();
            // console.log("  Rendering complete."); // DEBUG
        } catch (e) {
             console.error("Error during Rendering:", e); this.stop(); return; 
        }

        // Schedule next update
        if (this.running) {
            // console.log("Scheduling next frame..."); // DEBUG
            requestAnimationFrame(() => this.update());
        } else {
            // console.log("Simulation stopped, not scheduling next frame."); // DEBUG
        }
    }
};

export { SimulationController };