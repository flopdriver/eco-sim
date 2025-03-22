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
    
    // Time step control
    fixedTimeStepEnabled: true,
    fixedTimeStep: 1000 / 60, // 60 updates per second - back to normal refresh rate
    maxCatchUpIterations: 1, // Only do one simulation update per frame, never try to "catch up"
    lastUpdateTime: 0,
    accumulatedTime: 0,

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
        
        // Initialize timing variables
        this.lastUpdateTime = performance.now();

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
        this.lastUpdateTime = performance.now();
        this.accumulatedTime = 0;
        
        // Only start animation frame if speed is positive
        if (this.simulationSpeed > 0) {
            requestAnimationFrame(() => this.animationFrame());
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
    
    // Animation frame - decoupled from update logic
    animationFrame: function() {
        if (!this.running) return;
        
        // Calculate delta time
        const currentTime = performance.now();
        let deltaTime = currentTime - this.lastUpdateTime;
        this.lastUpdateTime = currentTime;
        
        // Prevent spiral of death - cap delta time at 50ms
        if (deltaTime > 50) {
            deltaTime = 50;
        }
        
        // Track performance
        this.performanceManager.startFrame();
        
        if (this.fixedTimeStepEnabled) {
            // Fixed time step update logic - simplified to be more stable
            // Apply simulation speed to how fast time accumulates
            this.accumulatedTime += deltaTime * this.simulationSpeed; 
            
            // Only do at most one update per frame to keep rendering smooth
            if (this.accumulatedTime >= this.fixedTimeStep) {
                // When using speed > 1, allow up to speed number of updates
                // but still limit to prevent freezes
                let updatesThisFrame = 0;
                const maxUpdates = Math.min(this.simulationSpeed, 3); // Never do more than 3 updates per frame
                
                while (this.accumulatedTime >= this.fixedTimeStep && updatesThisFrame < maxUpdates) {
                    this.updateSimulation();
                    this.accumulatedTime -= this.fixedTimeStep;
                    updatesThisFrame++;
                }
                
                // If we're still behind after max updates, clamp to avoid spiraling
                if (this.accumulatedTime > this.fixedTimeStep * 2) {
                    this.accumulatedTime = this.fixedTimeStep;
                }
            }
        } else {
            // Variable time step mode
            for (let i = 0; i < this.simulationSpeed; i++) {
                this.updateSimulation();
            }
        }
        
        // End timing for this frame
        this.performanceManager.endFrame();

        // Update statistics display
        this.uiManager.updateStats();

        // Render
        this.rendering.render();

        // Schedule next frame only if still running
        if (this.running && this.simulationSpeed > 0) {
            requestAnimationFrame(() => this.animationFrame());
        }
    },

    // The actual simulation update, separate from timing logic
    updateSimulation: function() {
        if (!this.running) return;

        // Track pixels that will become active next frame
        const nextActivePixels = new Set();

        // Periodically update environmental-biological connections
        if (Math.random() < 0.01) {
            this.ecosystemBalancer.updateBiologicalRates();
        }

        // Update each system in order:
        this.environment.update(this.activePixels, nextActivePixels);
        this.physics.update(this.activePixels, nextActivePixels);
        this.biology.update(this.activePixels, nextActivePixels);

        // Mark all active and new active pixels as dirty for rendering
        this.markDirtyPixels(this.activePixels);
        this.markDirtyPixels(nextActivePixels);

        // Manage active pixels with performance considerations
        this.performanceManager.manageActivePixels(nextActivePixels);

        // Update active pixels for next iteration
        this.activePixels = new Set(nextActivePixels);
        nextActivePixels.clear();
    },

    // Mark a set of pixels as dirty for rendering
    markDirtyPixels: function(pixelSet) {
        if (!this.rendering) return;
        
        // Don't try to mark too many pixels - use sampling if set is very large
        const setSizeThreshold = 10000;
        
        if (pixelSet.size > setSizeThreshold) {
            // Use sampling for large sets
            let markCount = 0;
            const samplingRate = Math.max(1, Math.floor(pixelSet.size / setSizeThreshold));
            
            let i = 0;
            for (const index of pixelSet) {
                if (i % samplingRate === 0) {
                    this.rendering.markPixelDirty(index);
                    markCount++;
                }
                i++;
                
                // Safety limit - don't mark too many
                if (markCount >= setSizeThreshold) break;
            }
        } else {
            // Mark all pixels for smaller sets
            pixelSet.forEach(index => {
                this.rendering.markPixelDirty(index);
            });
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