// UI Manager - Handles all UI-related functionality
const UIManager = {
    // Reference to main controller
    controller: null,

    // Initialize UI manager
    init: function(controller) {
        console.log("Initializing UI manager...");
        this.controller = controller;
        return this;
    },

    // Set up UI elements and event listeners
    setupUI: function() {
        this.setupControlButtons();
        this.setupEnvironmentControls();
        this.setupSimulationControls();
        this.setupVisualizationControls();
    },

    // Set up pause and reset buttons
    setupControlButtons: function() {
        // Pause/resume button
        const pauseButton = document.getElementById('pause-button');
        if (pauseButton) {
            pauseButton.addEventListener('click', () => this.controller.togglePause());
        }

        // Reset button
        const resetButton = document.getElementById('reset-button');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.controller.reset());
        }
    },

    // Set up environment control sliders
    setupEnvironmentControls: function() {
        // Rain frequency slider
        this.setupSlider('rain-slider', 'rain-value', (value) => {
            const percentage = value / 100;
            this.controller.environment.rainProbability = percentage * 0.01; // Scale to appropriate range
            // Update biological systems based on new rain setting
            this.controller.ecosystemBalancer.updateBiologicalRates();
            return value + '%';
        });

        // Temperature slider
        this.setupSlider('temp-slider', 'temp-value', (value) => {
            this.controller.environment.temperature = 50 + ((value - 50) * 2); // Scale from 0-100 to 50-150
            // Update biological systems based on new temperature
            this.controller.ecosystemBalancer.updateBiologicalRates();

            if (value < 30) return 'Cold';
            if (value > 70) return 'Hot';
            return 'Normal';
        });

        // Day length slider
        this.setupSlider('day-slider', 'day-value', (value) => {
            this.controller.environment.dayLength = value;
            // Update biological systems (day length affects plant growth cycles)
            this.controller.ecosystemBalancer.updateBiologicalRates();

            if (value < 3) return 'Short';
            if (value > 7) return 'Long';
            return 'Normal';
        });
    },

    // Set up simulation control sliders
    setupSimulationControls: function() {
        // Simulation speed slider
        this.setupSlider('speed-slider', 'speed-value', (value) => {
            this.controller.simulationSpeed = value;
            return value + 'x';
        });

        // Brush size slider
        this.setupSlider('brush-slider', 'brush-value', (value) => {
            this.controller.userInteraction.brushSize = value;
            return value + 'px';
        });

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
                this.controller.userInteraction.setTool(tool);
            });
        });
    },

    // Set up visualization mode controls
    setupVisualizationControls: function() {
        const vizButtons = document.querySelectorAll('.viz-button');
        vizButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Remove active class from all buttons
                vizButtons.forEach(btn => btn.classList.remove('active'));

                // Add active class to clicked button
                button.classList.add('active');

                // Set visualization mode
                const mode = button.getAttribute('data-mode');
                this.controller.rendering.setVisualizationMode(mode);
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
        // Only update stats periodically to avoid performance impact
        if (!this.controller.performanceManager.shouldUpdateStats()) return;

        this.updatePerformanceStats();
        this.updateEntityCounts();
        this.updateEnvironmentInfo();
    },

    // Update performance statistics display
    updatePerformanceStats: function() {
        // Update FPS counter
        const fpsCounter = document.getElementById('fps-counter');
        if (fpsCounter) {
            fpsCounter.textContent = this.controller.performanceManager.getFPS();
        }

        // Update active pixel counter
        const activeCounter = document.getElementById('active-counter');
        if (activeCounter) {
            activeCounter.textContent = this.controller.activePixels.size;
        }
    },

    // Update entity count statistics
    updateEntityCounts: function() {
        // Get shortcuts to commonly used objects
        const core = this.controller.core;
        const TYPE = this.controller.TYPE;

        // Count different entities
        let plantCount = 0;
        let insectCount = 0;
        let waterCount = 0;
        let wormCount = 0;
        let seedCount = 0;

        // Only sample a portion of the grid for performance on large grids
        const sampleRate = core.size > 100000 ? 0.1 : 1.0; // Sample 10% for very large grids

        for (let i = 0; i < core.size; i++) {
            // Skip samples based on sample rate
            if (sampleRate < 1.0 && Math.random() > sampleRate) continue;

            const type = core.type[i];
            switch (type) {
                case TYPE.PLANT: plantCount++; break;
                case TYPE.INSECT: insectCount++; break;
                case TYPE.WATER: waterCount++; break;
                case TYPE.WORM: wormCount++; break;
                case TYPE.SEED: seedCount++; break;
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
        this.updateCounterElement('plant-counter', plantCount);
        this.updateCounterElement('insect-counter', insectCount);
        this.updateCounterElement('water-counter', waterCount);

        // Notify ecosystem balancer about counts for balance checks
        this.controller.ecosystemBalancer.checkEcosystemBalance(plantCount, insectCount, wormCount);
    },

    // Update a counter element with a value
    updateCounterElement: function(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    },

    // Update environment information display
    updateEnvironmentInfo: function() {
        // Update day/night indicator
        const timeIndicator = document.getElementById('day-night-indicator');
        if (timeIndicator) {
            const isPrimarilyDay = this.controller.environment.dayNightCycle < 128;
            timeIndicator.textContent = isPrimarilyDay ? "Day" : "Night";
        }
    }
};