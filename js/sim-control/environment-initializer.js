// Environment Initializer - Sets up the initial ecosystem state
const EnvironmentInitializer = {
    // Reference to main controller
    controller: null,

    // Initialize environment initializer
    init: function(controller) {
        console.log("Initializing environment initializer...");
        this.controller = controller;
        return this;
    },

    // Set up the initial environment
    initializeEnvironment: function() {
        console.log("Setting up initial environment...");

        // Get shortcuts to commonly used objects
        const core = this.controller.core;
        const TYPE = this.controller.TYPE;
        const STATE = this.controller.STATE;
        const activePixels = this.controller.activePixels;

        // Fill everything with air initially
        core.type.fill(TYPE.AIR);

        // Create ground/soil in the bottom portion with more pronounced wavy terrain
        const groundLevelBase = Math.floor(core.height * 0.6); // Base ground level
        const terrainVariation = 40; // Increased maximum height variation
        const frequency = 0.01; // Lower frequency for longer, more sweeping hills
        const additionalFrequency = 0.2; // Additional higher frequency for more detail

        // Generate terrain noise with multiple frequency components
        const terrainNoise = new Array(core.width).fill(0).map((_, x) => {
            // Low-frequency large hills
            const mainHill = Math.sin(x * frequency) * terrainVariation * 0.5;

            // Higher frequency smaller variations
            const detailVariation = Math.sin(x * (frequency * 4)) * (terrainVariation * 0.1) +
                Math.sin(x * (frequency * 8)) * (terrainVariation * 0.1);

            // Random additional noise for more natural feel
            const randomNoise = (Math.random() * terrainVariation * 0.2) - (terrainVariation * 0.5);

            return mainHill + detailVariation + randomNoise;
        });

        // Smooth the terrain noise with a wider kernel
        const smoothTerrainNoise = terrainNoise.map((val, i, arr) => {
            // Wider averaging for smoother transitions
            const smoothingKernel = [-2, -1, 0, 1, 2].map(offset =>
                arr[i + offset] || val
            );
            return smoothingKernel.reduce((sum, v) => sum + v, 0) / smoothingKernel.length;
        });

        for (let x = 0; x < core.width; x++) {
            // Calculate ground level with noise
            const groundVariation = smoothTerrainNoise[x];
            const groundLevel = Math.floor(groundLevelBase + groundVariation);

            for (let y = groundLevel; y < core.height; y++) {
                const index = core.getIndex(x, y);
                core.type[index] = TYPE.SOIL;

                // Add variation to soil - some dry, some wet, some fertile
                const soilRandom = Math.random();
                if (soilRandom < 0.15) { // Increased chance for fertile soil
                    // Fertile soil patches
                    core.state[index] = STATE.FERTILE;
                    core.nutrient[index] = 70 + Math.floor(Math.random() * 50);
                } else {
                    // Regular soil - drier near surface, wetter deep down
                    const depth = (y - groundLevel) / (core.height - groundLevel);

                    // Add some randomness to soil moisture
                    const moistureVariation = Math.random() * 0.4 - 0.2; // -0.2 to 0.2 variation
                    const moistureDepth = Math.min(1, depth + moistureVariation);

                    core.state[index] = moistureDepth > 0.3 ? STATE.WET : STATE.DRY;

                    // Water increases with depth, with added variation
                    core.water[index] = Math.floor(moistureDepth * 150 * (0.8 + Math.random() * 0.4));

                    // Nutrients vary randomly with slight depth influence
                    core.nutrient[index] = 30 + Math.floor(Math.random() * 40 * (1 + depth));
                }

                // Mark as active for first update
                activePixels.add(index);
            }
        }

        // Add plant seeds to the environment
        this.addInitialSeeds(groundLevelBase);

        // Add worms to help with soil fertility
        this.addInitialWorms(groundLevelBase);

        // Add initial insects to create ecosystem dynamics
        this.addInitialInsects(groundLevelBase);
    },

    // Add initial seeds to the environment
    addInitialSeeds: function(groundLevel) {
        const core = this.controller.core;
        const TYPE = this.controller.TYPE;
        const activePixels = this.controller.activePixels;

        // Add a few varied plant seeds on the surface
        const numSeeds = 80 + Math.floor(Math.random() * 15); // 8-12 seeds
        const seedPositions = new Set();

        // Create unique positions for seeds
        while (seedPositions.size < numSeeds) {
            const x = Math.floor(Math.random() * core.width);
            seedPositions.add(x);
        }

        // Place seeds at the positions
        for (const x of seedPositions) {
            const y = groundLevel - 1; // Just above ground
            const index = core.getIndex(x, y);

            if (index !== -1) {
                core.type[index] = TYPE.SEED;
                core.energy[index] = 100 + Math.floor(Math.random() * 40); // Increased seed energy
                activePixels.add(index);
            }
        }
    },

    // Add initial worms to the environment
    addInitialWorms: function(groundLevel) {
        const core = this.controller.core;
        const TYPE = this.controller.TYPE;
        const activePixels = this.controller.activePixels;

        // Add a few initial worms in the soil to help fertility
        const numWorms = 30 + Math.floor(Math.random() * 3); // 3-5 worms
        for (let i = 0; i < numWorms; i++) {
            const x = Math.floor(Math.random() * core.width);
            const y = groundLevel + Math.floor(Math.random() * (core.height - groundLevel) * 0.5);
            const index = core.getIndex(x, y);

            if (index !== -1 && core.type[index] === TYPE.SOIL) {
                core.type[index] = TYPE.WORM;
                core.energy[index] = 180; // Increased initial energy
                activePixels.add(index);
            }
        }
    },

    // Add initial insects to the environment
    addInitialInsects: function(groundLevel) {
        const core = this.controller.core;
        const TYPE = this.controller.TYPE;
        const STATE = this.controller.STATE;
        const activePixels = this.controller.activePixels;

        // Moderate number of initial insects - 5-8
        const numInsects = 5 + Math.floor(Math.random() * 3);

        for (let i = 0; i < numInsects; i++) {
            const x = Math.floor(Math.random() * core.width);
            const y = Math.floor(Math.random() * (groundLevel - 5));
            const index = core.getIndex(x, y);

            if (index !== -1 && core.type[index] === TYPE.AIR) {
                core.type[index] = TYPE.INSECT;
                core.state[index] = STATE.ADULT;
                core.energy[index] = 130 + Math.floor(Math.random() * 40);
                core.metadata[index] = 0; // Starvation counter
                activePixels.add(index);
            }
        }
    }
};