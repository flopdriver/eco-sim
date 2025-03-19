// Main Simulation Controller with WebGL Support
const SimulationController = {
    // Performance tracking
    lastUpdate: 0,
    lastStatsUpdate: 0,
    fps: 0,
    running: false,
    simulationSpeed: 1,

    // Active pixel tracking for optimization
    activePixels: null,
    activePixelCount: 0,
    maxActivePixels: 100000, // Safety limit to prevent performance issues

    // System references
    core: null,
    environment: null,
    physics: null,
    biology: null,
    rendering: null,
    userInteraction: null,

    // Environmental influence settings
    environmentalInfluence: {
        lightEfficiency: 1.0,    // How efficiently plants use light
        temperatureEffect: 1.0,   // How much temperature affects organisms
        moistureSensitivity: 1.0, // How sensitive plants are to moisture
        soilQualityImpact: 1.0    // How much soil quality affects growth
    },

    init: function(canvasId) {
        console.log("Initializing simulation controller...");

        // Check if WebGL is supported
        if (!WebGLUtils.isWebGLSupported()) {
            alert('WebGL is not supported in your browser. This simulation requires WebGL.');
            return null;
        }

        // Initialize active pixels set with an estimated capacity for better performance
        this.activePixels = new Set();

        // Initialize core systems in correct dependency order
        this.initializeSystems(canvasId);

        // Set up constants (pixel types, states)
        this.initializeConstants();

        // Propagate constants to all subsystems
        this.propagateConstants();

        // Set up initial environment
        this.initializeEnvironment();

        // Setup UI components
        this.setupUI();

        // Initialize environmental-biological connections
        this.initializeEnvironmentalConnections();

        // Log initialization complete
        console.log("Simulation initialization complete.");

        return this;
    },

    // Initialize all subsystems in proper order
    initializeSystems: function(canvasId) {
        console.log("Initializing subsystems...");

        // 1. Core data structures (no dependencies)
        this.core = CoreSimulation.init();
        if (!this.core) {
            console.error("Failed to initialize core simulation.");
            return false;
        }

        // 2. Environment system (depends on core)
        this.environment = EnvironmentSystem.init(this.core);
        if (!this.environment) {
            console.error("Failed to initialize environment system.");
            return false;
        }

        // 3. Physics system (depends on core)
        this.physics = PhysicsSystem.init(this.core);
        if (!this.physics) {
            console.error("Failed to initialize physics system.");
            return false;
        }

        // 4. Biology system (depends on core and environment)
        this.biology = BiologySystem.init(this.core);
        if (!this.biology) {
            console.error("Failed to initialize biology system.");
            return false;
        }

        // 5. Rendering system (depends on core)
        this.rendering = WebGLRenderingSystem.init(this.core, canvasId);
        if (!this.rendering) {
            console.error("Failed to initialize WebGL rendering system.");
            return false;
        }

        // 6. User interaction system (depends on core and rendering)
        this.userInteraction = UserInteractionSystem.init(this.core, this.rendering.canvas);
        if (!this.userInteraction) {
            console.error("Failed to initialize user interaction system.");
            return false;
        }

        return true;
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

        // Share constants with other systems
        this.core.TYPE = this.TYPE;
        this.core.STATE = this.STATE;
        this.environment.TYPE = this.TYPE;
        this.environment.STATE = this.STATE;
        this.physics.TYPE = this.TYPE;
        this.physics.STATE = this.STATE;
        this.biology.TYPE = this.TYPE;
        this.biology.STATE = this.STATE;
        this.rendering.TYPE = this.TYPE;
        this.rendering.STATE = this.STATE;
        this.userInteraction.TYPE = this.TYPE;
        this.userInteraction.STATE = this.STATE;
    },

    // Initialize connections between environmental and biological systems
    initializeEnvironmentalConnections: function() {
        console.log("Setting up environmental-biological connections...");

        // Connect light levels to plant photosynthesis efficiency
        // This is achieved by sharing the energy array from core
        // with both environment and biology systems

        // Connect temperature to organism metabolism
        this.biology.metabolism = 1.0; // Base metabolism rate
        this.biology.growthRate = 1.0; // Base growth rate
        this.biology.reproduction = 1.0; // Base reproduction rate

        // Initialize callbacks for environment changes
        this.environment.onTemperatureChange = this.updateBiologicalRates.bind(this);
        this.environment.onLightLevelChange = this.updateBiologicalRates.bind(this);

        // Initial update of biological rates based on environment
        this.updateBiologicalRates();
    },

    // Update biological rates based on current environmental conditions
    updateBiologicalRates: function() {
        if (!this.biology || !this.environment) return;

        // Calculate average temperature (simplified)
        const tempFactor = (this.environment.temperature - 128) / 128; // -1 to 1 range

        // Temperature affects metabolism (higher temp = higher metabolism)
        // with optimal range and extremes being harmful
        let tempMetabolismFactor;
        if (tempFactor < -0.5) {
            // Too cold - metabolism slows down dramatically
            tempMetabolismFactor = 0.5 + tempFactor; // 0 to 0.5
        } else if (tempFactor > 0.5) {
            // Too hot - metabolism increases, energy consumed faster
            tempMetabolismFactor = 1.5 + (tempFactor - 0.5); // 1.5 to 2.0
        } else {
            // Optimal range - normal to slightly increased metabolism
            tempMetabolismFactor = 1.0 + tempFactor; // 0.5 to 1.5
        }

        // Day/night cycle affects growth (plants grow better during day)
        const isDaytime = this.environment.dayNightCycle < 128;
        const lightFactor = isDaytime ?
            0.8 + (0.4 * Math.sin((this.environment.dayNightCycle / 128) * Math.PI)) :
            0.3; // Reduced growth at night

        // Rain frequency affects growth rates
        const moistureFactor = 0.7 + (this.environment.rainProbability * 300);

        // Apply all factors with environmental influence settings
        this.biology.metabolism = tempMetabolismFactor * this.environmentalInfluence.temperatureEffect;
        this.biology.growthRate = lightFactor * moistureFactor * this.environmentalInfluence.lightEfficiency;
        this.biology.reproduction = moistureFactor * this.environmentalInfluence.moistureSensitivity;

        // Log changes for debugging
        console.log(`Updated biological rates - Metabolism: ${this.biology.metabolism.toFixed(2)}, Growth: ${this.biology.growthRate.toFixed(2)}, Reproduction: ${this.biology.reproduction.toFixed(2)}`);
    },

    // Set up the initial environment
    initializeEnvironment: function() {
        console.log("Setting up initial environment...");

        // Fill everything with air initially
        this.core.type.fill(this.TYPE.AIR);

        // Create ground/soil in the bottom portion
        const groundLevel = Math.floor(this.core.height * 0.4);

        for (let y = groundLevel; y < this.core.height; y++) {
            for (let x = 0; x < this.core.width; x++) {
                const index = this.core.getIndex(x, y);
                this.core.type[index] = this.TYPE.SOIL;

                // Add variation to soil - some dry, some wet, some fertile
                const soilRandom = Math.random();
                if (soilRandom < 0.1) {
                    // Fertile soil patches
                    this.core.state[index] = this.STATE.FERTILE;
                    this.core.nutrient[index] = 70 + Math.floor(Math.random() * 50);
                } else {
                    // Regular soil - drier near surface, wetter deep down
                    const depth = (y - groundLevel) / (this.core.height - groundLevel);
                    this.core.state[index] = depth > 0.3 ? this.STATE.WET : this.STATE.DRY;

                    // Water increases with depth
                    const wetness = Math.floor(depth * 150);
                    this.core.water[index] = wetness;

                    // Nutrients vary randomly
                    this.core.nutrient[index] = 30 + Math.floor(Math.random() * 40);
                }

                // Mark as active for first update
                this.activePixels.add(index);
            }
        }

        // Add a few varied plant seeds on the surface
        const numSeeds = 5 + Math.floor(Math.random() * 5); // 5-9 seeds
        const seedPositions = new Set();

        // Create unique positions for seeds
        while (seedPositions.size < numSeeds) {
            const x = Math.floor(Math.random() * this.core.width);
            seedPositions.add(x);
        }

        // Place seeds at the positions
        for (const x of seedPositions) {
            const y = groundLevel - 1; // Just above ground
            const index = this.core.getIndex(x, y);

            if (index !== -1) {
                this.core.type[index] = this.TYPE.SEED;
                this.core.energy[index] = 80 + Math.floor(Math.random() * 40); // Varying seed energy
                this.activePixels.add(index);
            }
        }

        // Add a few initial worms in the soil to help fertility
        const numWorms = 2 + Math.floor(Math.random() * 3); // 2-4 worms
        for (let i = 0; i < numWorms; i++) {
            const x = Math.floor(Math.random() * this.core.width);
            const y = groundLevel + Math.floor(Math.random() * (this.core.height - groundLevel) * 0.5);
            const index = this.core.getIndex(x, y);

            if (index !== -1 && this.core.type[index] === this.TYPE.SOIL) {
                this.core.type[index] = this.TYPE.WORM;
                this.core.energy[index] = 150; // Initial energy
                this.activePixels.add(index);
            }
        }
    },

    // Start the simulation
    start: function() {
        console.log("Starting simulation...");
        this.running = true;
        this.lastUpdate = performance.now();
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
        this.activePixelCount = 0;

        // Re-initialize environment
        this.initializeEnvironment();

        // Reset environmental-biological connections
        this.initializeEnvironmentalConnections();

        // Restart simulation
        this.start();
    },

    // Set up UI elements and event listeners
    setupUI: function() {
        // Pause/resume button
        const pauseButton = document.getElementById('pause-button');
        if (pauseButton) {
            pauseButton.addEventListener('click', () => this.togglePause());
        }

        // Reset button
        const resetButton = document.getElementById('reset-button');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.reset());
        }

        // Tool buttons
        const toolButtons = document.querySelectorAll('.tool-button');
        toolButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Remove active class from all buttons
                toolButtons.forEach(btn => btn.classList.remove('active'));

                // Add active class to clicked button
                button.classList.add('active');

                // Set current tool
                const tool = button.getAttribute('data-tool');
                this.userInteraction.setTool(tool);
            });
        });

        // Environment sliders
        this.setupSlider('rain-slider', 'rain-value', (value) => {
            const percentage = value / 100;
            this.environment.rainProbability = percentage * 0.01; // Scale to appropriate range
            // Update biological systems based on new rain setting
            this.updateBiologicalRates();
            return value + '%';
        });

        this.setupSlider('temp-slider', 'temp-value', (value) => {
            this.environment.temperature = 50 + ((value - 50) * 2); // Scale from 0-100 to 50-150
            // Update biological systems based on new temperature
            this.updateBiologicalRates();

            if (value < 30) return 'Cold';
            if (value > 70) return 'Hot';
            return 'Normal';
        });

        this.setupSlider('day-slider', 'day-value', (value) => {
            this.environment.dayLength = value;
            // Update biological systems (day length affects plant growth cycles)
            this.updateBiologicalRates();

            if (value < 3) return 'Short';
            if (value > 7) return 'Long';
            return 'Normal';
        });

        // Simulation speed slider
        this.setupSlider('speed-slider', 'speed-value', (value) => {
            this.simulationSpeed = value;
            return value + 'x';
        });

        // Brush size slider for user interaction
        this.setupSlider('brush-slider', 'brush-value', (value) => {
            this.userInteraction.brushSize = value;
            return value + 'px';
        });

        // Visualization buttons
        const vizButtons = document.querySelectorAll('.viz-button');
        vizButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Remove active class from all buttons
                vizButtons.forEach(btn => btn.classList.remove('active'));

                // Add active class to clicked button
                button.classList.add('active');

                // Set visualization mode
                const mode = button.getAttribute('data-mode');
                this.rendering.setVisualizationMode(mode);
            });
        });
    },

    // Helper to set up a slider with a value display and callback
    setupSlider: function(sliderId, valueId, callback) {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(valueId);

        if (slider && valueDisplay) {
            // Initial value
            valueDisplay.textContent = callback(parseInt(slider.value));

            // Update on change
            slider.addEventListener('input', () => {
                const value = parseInt(slider.value);
                valueDisplay.textContent = callback(value);
            });
        }
    },

    // Update statistics display
    updateStats: function() {
        // Get current time for time-based updates
        const currentTime = performance.now();

        // Only update stats every 500ms to avoid performance impact
        if (currentTime - this.lastStatsUpdate < 500) return;

        this.lastStatsUpdate = currentTime;

        // Update FPS counter
        const fpsCounter = document.getElementById('fps-counter');
        if (fpsCounter) {
            fpsCounter.textContent = Math.round(this.fps);
        }

        // Update active pixel counter
        const activeCounter = document.getElementById('active-counter');
        if (activeCounter) {
            activeCounter.textContent = this.activePixels.size;
        }

        // Count different entities
        let plantCount = 0;
        let insectCount = 0;
        let waterCount = 0;
        let wormCount = 0;
        let seedCount = 0;

        // Only sample a portion of the grid for performance on large grids
        const sampleRate = this.core.size > 100000 ? 0.1 : 1.0; // Sample 10% for very large grids

        for (let i = 0; i < this.core.size; i++) {
            // Skip samples based on sample rate
            if (sampleRate < 1.0 && Math.random() > sampleRate) continue;

            const type = this.core.type[i];
            switch (type) {
                case this.TYPE.PLANT: plantCount++; break;
                case this.TYPE.INSECT: insectCount++; break;
                case this.TYPE.WATER: waterCount++; break;
                case this.TYPE.WORM: wormCount++; break;
                case this.TYPE.SEED: seedCount++; break;
            }
        }

        // Scale counts if we're sampling
        if (sampleRate < 1.0) {
            plantCount = Math.round(plantCount / sampleRate);
            insectCount = Math.round(insectCount / sampleRate);
            waterCount = Math.round(waterCount / sampleRate);
            wormCount = Math.round(wormCount / sampleRate);
            seedCount = Math.round(seedCount / sampleRate);
        }

        // Update entity counters
        const plantCounter = document.getElementById('plant-counter');
        if (plantCounter) {
            plantCounter.textContent = plantCount;
        }

        const insectCounter = document.getElementById('insect-counter');
        if (insectCounter) {
            insectCounter.textContent = insectCount;
        }

        const waterCounter = document.getElementById('water-counter');
        if (waterCounter) {
            waterCounter.textContent = waterCount;
        }

        // Add additional counters as needed for worms, seeds, etc.
        // This could be extended with a dynamic counter system

        // Update day/night indicator
        const timeIndicator = document.getElementById('day-night-indicator');
        if (timeIndicator) {
            const isPrimarilyDay = this.environment.dayNightCycle < 128;
            timeIndicator.textContent = isPrimarilyDay ? "Day" : "Night";
        }

        // Check for ecosystem balance metrics
        this.checkEcosystemBalance(plantCount, insectCount, wormCount);
    },

    // Check ecosystem balance and apply corrections if needed
    checkEcosystemBalance: function(plantCount, insectCount, wormCount) {
        // This function could implement self-balancing mechanisms
        // For instance, if plants take over too much (>50% of non-soil),
        // increase insect reproduction rates

        // Calculate total active area (non-soil)
        const totalActiveCells = this.core.width * this.core.height * 0.4; // Approx cells above ground

        // Check plant domination
        if (plantCount > totalActiveCells * 0.5 && insectCount < 10) {
            // Plants taking over, but few insects - spawn some insects
            this.spawnRandomInsects(3);
        }

        // Check insect overpopulation
        if (insectCount > plantCount * 0.5) {
            // Too many insects for available plants - reduce reproduction
            this.biology.reproduction *= 0.9;
        } else {
            // Normalize reproduction rate back toward standard
            this.biology.reproduction = Math.min(1.0, this.biology.reproduction * 1.05);
        }

        // Other balance mechanisms could be added here
    },

    // Helper function to spawn random insects as a balancing mechanism
    spawnRandomInsects: function(count) {
        for (let i = 0; i < count; i++) {
            // Find a random air cell in the upper half
            const x = Math.floor(Math.random() * this.core.width);
            const y = Math.floor(Math.random() * (this.core.height * 0.3));
            const index = this.core.getIndex(x, y);

            if (index !== -1 && this.core.type[index] === this.TYPE.AIR) {
                // Create insect
                this.core.type[index] = this.TYPE.INSECT;
                this.core.state[index] = this.STATE.ADULT;
                this.core.energy[index] = 150; // Initial energy
                this.activePixels.add(index);
            }
        }
    },

    // Main update loop
    update: function() {
        if (!this.running) return;

        const startTime = performance.now();

        // Track pixels that will become active next frame
        const nextActivePixels = new Set();

        // Get simulation speed (default to 1 if not set)
        const speed = this.simulationSpeed || 1;

        // Run multiple update steps based on speed setting
        for (let i = 0; i < speed; i++) {
            // Periodically update environmental-biological connections
            if (i === 0 && Math.random() < 0.05) {
                this.updateBiologicalRates();
            }

            // Update each system in order:
            // 1. Environment (temperature, light, rain)
            // 2. Physics (water movement, gravity)
            // 3. Biology (plant growth, animal movement)
            this.environment.update(this.activePixels, nextActivePixels);
            this.physics.update(this.activePixels, nextActivePixels);
            this.biology.update(this.activePixels, nextActivePixels);

            // Safety check: limit active pixels to prevent performance issues
            if (nextActivePixels.size > this.maxActivePixels) {
                console.warn(`Too many active pixels (${nextActivePixels.size}), pruning to ${this.maxActivePixels}`);
                this.pruneActivePixels(nextActivePixels);
            }

            // Update active pixels for next iteration
            this.activePixels = new Set(nextActivePixels);
            this.activePixelCount = nextActivePixels.size;
            nextActivePixels.clear();
        }

        // Calculate FPS
        const currentTime = performance.now();
        this.fps = 1000 / (currentTime - this.lastUpdate);
        this.lastUpdate = currentTime;

        // Update statistics
        this.updateStats();

        // Render
        this.rendering.render();

        // Schedule next update
        if (this.running) {
            requestAnimationFrame(() => this.update());
        }
    },

    // Prune active pixels when they exceed the maximum limit
    pruneActivePixels: function(pixelSet) {
        // Convert to array for easier manipulation
        const pixelArray = Array.from(pixelSet);

        // Shuffle array to randomize which pixels are kept
        this.shuffleArray(pixelArray);

        // Clear the set and refill with max allowed pixels
        pixelSet.clear();
        for (let i = 0; i < this.maxActivePixels; i++) {
            pixelSet.add(pixelArray[i]);
        }
    },

    // Fisher-Yates shuffle for arrays
    shuffleArray: function(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    propagateConstants: function() {
        console.log("Propagating constants to subsystems...");

        // User interaction subsystems
        if (this.userInteraction) {
            if (this.userInteraction.toolSystem) {
                this.userInteraction.toolSystem.TYPE = this.TYPE;
                this.userInteraction.toolSystem.STATE = this.STATE;
            }
            if (this.userInteraction.eventHandlerSystem) {
                this.userInteraction.eventHandlerSystem.TYPE = this.TYPE;
                this.userInteraction.eventHandlerSystem.STATE = this.STATE;
            }
            if (this.userInteraction.visualizationSystem) {
                this.userInteraction.visualizationSystem.TYPE = this.TYPE;
                this.userInteraction.visualizationSystem.STATE = this.STATE;
            }
        }

        // Biology subsystems
        if (this.biology) {
            if (this.biology.plantSystem) {
                this.biology.plantSystem.TYPE = this.TYPE;
                this.biology.plantSystem.STATE = this.STATE;
            }
            if (this.biology.seedSystem) {
                this.biology.seedSystem.TYPE = this.TYPE;
                this.biology.seedSystem.STATE = this.STATE;
            }
            if (this.biology.insectSystem) {
                this.biology.insectSystem.TYPE = this.TYPE;
                this.biology.insectSystem.STATE = this.STATE;
            }
            if (this.biology.wormSystem) {
                this.biology.wormSystem.TYPE = this.TYPE;
                this.biology.wormSystem.STATE = this.STATE;
            }
            if (this.biology.decompositionSystem) {
                this.biology.decompositionSystem.TYPE = this.TYPE;
                this.biology.decompositionSystem.STATE = this.STATE;
            }
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