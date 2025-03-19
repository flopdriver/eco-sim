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

        // Create ground/soil in the bottom portion
        const groundLevel = Math.floor(core.height * 0.6); // Increased to 60% for more soil

        for (let y = groundLevel; y < core.height; y++) {
            for (let x = 0; x < core.width; x++) {
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
                    core.state[index] = depth > 0.3 ? STATE.WET : STATE.DRY;

                    // Water increases with depth
                    core.water[index] = Math.floor(depth * 150);

                    // Nutrients vary randomly
                    core.nutrient[index] = 30 + Math.floor(Math.random() * 40);
                }

                // Mark as active for first update
                activePixels.add(index);
            }
        }

        // Add plant seeds
        this.addInitialSeeds(groundLevel);

        // Add worms
        this.addInitialWorms(groundLevel);
    },

    // Add initial seeds to the environment
    addInitialSeeds: function(groundLevel) {
        const core = this.controller.core;
        const TYPE = this.controller.TYPE;
        const activePixels = this.controller.activePixels;

        // Add a few varied plant seeds on the surface
        const numSeeds = 8 + Math.floor(Math.random() * 5); // 8-12 seeds
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
        const numWorms = 3 + Math.floor(Math.random() * 3); // 3-5 worms
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
    }
};