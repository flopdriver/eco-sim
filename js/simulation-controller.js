// Main Simulation Controller with WebGL Support
const SimulationController = {
    // Performance tracking
    lastUpdate: 0,
    fps: 0,
    running: false,

    // Active pixel tracking for optimization
    activePixels: null,

    init: function(canvasId) {
        console.log("Initializing simulation controller...");

        // Check if WebGL is supported
        if (!WebGLUtils.isWebGLSupported()) {
            alert('WebGL is not supported in your browser. This simulation requires WebGL.');
            return null;
        }

        // Initialize active pixels set
        this.activePixels = new Set();

        // Initialize core systems
        this.core = CoreSimulation.init();
        this.environment = EnvironmentSystem.init(this.core);
        this.physics = PhysicsSystem.init(this.core);
        this.biology = BiologySystem.init(this.core);

        // Initialize WebGL rendering system
        this.rendering = WebGLRenderingSystem.init(this.core, canvasId);
        if (!this.rendering) {
            alert('Failed to initialize WebGL rendering system.');
            return null;
        }

        // Initialize user interaction
        this.userInteraction = UserInteractionSystem.init(this.core, this.rendering.canvas);

        // Set up constants (pixel types, states)
        this.initializeConstants();

        // Set up initial environment
        this.initializeEnvironment();

        // Setup UI components
        this.setupUI();

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
                this.core.state[index] = this.STATE.DRY;

                // Add some initial nutrients to soil
                this.core.nutrient[index] = 50 + Math.floor(Math.random() * 50);

                // Add initial water to soil (more at deeper levels)
                const depth = (y - groundLevel) / (this.core.height - groundLevel);
                this.core.water[index] = Math.floor(depth * 100);

                // Mark as active for first update
                this.activePixels.add(index);
            }
        }

        // Add a few random seeds on the surface
        for (let i = 0; i < 5; i++) {
            const x = Math.floor(Math.random() * this.core.width);
            const index = groundLevel * this.core.width + x;
            this.core.type[index] = this.TYPE.SEED;
            this.core.energy[index] = 100; // Initial energy
            this.activePixels.add(index);
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

        // Clear active pixels
        this.activePixels.clear();

        // Re-initialize environment
        this.initializeEnvironment();

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
            return value + '%';
        });

        this.setupSlider('temp-slider', 'temp-value', (value) => {
            this.environment.temperature = 50 + ((value - 50) * 2); // Scale from 0-100 to 50-150

            if (value < 30) return 'Cold';
            if (value > 70) return 'Hot';
            return 'Normal';
        });

        this.setupSlider('day-slider', 'day-value', (value) => {
            this.environment.dayLength = value;

            if (value < 3) return 'Short';
            if (value > 7) return 'Long';
            return 'Normal';
        });

        // Simulation speed slider
        this.setupSlider('speed-slider', 'speed-value', (value) => {
            this.simulationSpeed = value;
            return value + 'x';
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

        for (let i = 0; i < this.core.size; i++) {
            if (this.core.type[i] === this.TYPE.PLANT) plantCount++;
            if (this.core.type[i] === this.TYPE.INSECT) insectCount++;
            if (this.core.type[i] === this.TYPE.WATER) waterCount++;
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
            // Update each system
            this.environment.update(this.activePixels, nextActivePixels);
            this.physics.update(this.activePixels, nextActivePixels);
            this.biology.update(this.activePixels, nextActivePixels);

            // Update active pixels for next iteration
            this.activePixels = new Set(nextActivePixels);
            nextActivePixels.clear();
        }

        // Calculate FPS
        const currentTime = performance.now();
        this.fps = 1000 / (currentTime - this.lastUpdate);
        this.lastUpdate = currentTime;

        // Update statistics
        if (currentTime - this.lastStatsUpdate > 500) { // Update stats every 500ms
            this.updateStats();
            this.lastStatsUpdate = currentTime;
        }

        // Render
        this.rendering.render();

        // Schedule next update
        if (this.running) {
            requestAnimationFrame(() => this.update());
        }
    }
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