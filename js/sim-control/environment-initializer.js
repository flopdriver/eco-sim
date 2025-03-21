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

                // First determine soil layer type based on depth and position
                const depth = (y - groundLevel) / (core.height - groundLevel);
                
                // Determine soil layer type using the physics soil moisture system
                // if it's available, otherwise use a simpler approach
                let soilState;
                if (this.controller.physics && 
                    this.controller.physics.soilMoistureSystem &&
                    typeof this.controller.physics.soilMoistureSystem.determineSoilLayer === 'function') {
                    
                    // Use the soil moisture system's layer determination
                    soilState = this.controller.physics.soilMoistureSystem.determineSoilLayer(x, y);
                } else {
                    // Fallback implementation with random deposits if soil moisture system not initialized yet
                    const depthFromSurface = y - groundLevel;
                    
                    // Create deposit influence using simple noise
                    const noiseX = Math.sin(x * 0.053) * Math.cos(y * 0.071) * 50;
                    const noiseY = Math.cos(x * 0.067) * Math.sin(y * 0.059) * 50;
                    const depositNoise = (Math.sin(noiseX) + Math.cos(noiseY)) * 50 + 50; // 0-100 range
                    
                    // Create varied soil pockets
                    const pocketSeed = Math.sin(x * 0.029 + y * 0.037) * 100;
                    const smallDeposit = Math.abs(Math.sin(x * 0.13 + y * 0.17) * 100);
                    const mediumDeposit = Math.abs(Math.cos(x * 0.07 + y * 0.11) * 100);
                    const largeDeposit = Math.abs(Math.sin(x * 0.05 + y * 0.03) * 100);
                    
                    // Layer influences
                    const clayInfluence = (depthFromSurface > 15 && depthFromSurface < 40) ? 
                                       mediumDeposit * 0.3 : smallDeposit * 0.1;
                                       
                    const sandyInfluence = (depthFromSurface < 12 || depthFromSurface > 35) ? 
                                        largeDeposit * 0.3 : smallDeposit * 0.1;
                                       
                    const rockyInfluence = depthFromSurface > 25 ? 
                                        Math.min(100, mediumDeposit * (depthFromSurface / 60)) : 
                                        smallDeposit * 0.05;
                    
                    // Final soil type selection with deposits
                    const hash = (depositNoise + pocketSeed) % 100;
                    
                    // Clay deposit check
                    if (clayInfluence > 60) {
                        soilState = STATE.CLAY;
                    }
                    // Sandy deposit check
                    else if (sandyInfluence > 65) {
                        soilState = STATE.SANDY;
                    }
                    // Rocky deposit check
                    else if (rockyInfluence > 70) {
                        soilState = STATE.ROCKY;
                    }
                    // Base layer distribution by depth if not in a deposit pocket
                    else if (depthFromSurface < 10) {
                        // Topsoil - mostly loamy with some sandy and default
                        if (hash < 60) soilState = STATE.LOAMY;
                        else if (hash < 75) soilState = STATE.SANDY;
                        else if (hash < 80) soilState = STATE.CLAY;
                        else soilState = STATE.DEFAULT;
                    } 
                    else if (depthFromSurface < 30) {
                        // Subsoil - mix of types with more clay
                        if (hash < 40) soilState = STATE.LOAMY;
                        else if (hash < 65) soilState = STATE.SANDY;
                        else if (hash < 85) soilState = STATE.CLAY;
                        else if (hash < 90) soilState = STATE.ROCKY;
                        else soilState = STATE.DEFAULT;
                    }
                    else {
                        // Deep soil - more rocky and sandy with some clay
                        if (hash < 15) soilState = STATE.LOAMY;
                        else if (hash < 45) soilState = STATE.SANDY;
                        else if (hash < 65) soilState = STATE.CLAY;
                        else if (hash < 95) soilState = STATE.ROCKY;
                        else soilState = STATE.DEFAULT;
                    }
                }
                
                // Sometimes override with fertile soil regardless of layer type
                const soilRandom = Math.random();
                if (soilRandom < 0.15) { // Chance for fertile soil
                    // Fertile soil patches
                    soilState = STATE.FERTILE;
                    core.nutrient[index] = 70 + Math.floor(Math.random() * 50);
                }
                
                // Set the soil state
                core.state[index] = soilState;
                
                // Add water content based on soil type and depth
                
                // Base water content increases with depth
                const baseWaterContent = Math.floor(depth * 150 * (0.8 + Math.random() * 0.4));
                
                // Adjust water content based on soil type
                let waterMultiplier = 1.0;
                
                switch (soilState) {
                    case STATE.CLAY:
                        // Clay holds water well
                        waterMultiplier = 1.4;
                        break;
                    case STATE.SANDY:
                        // Sandy soil drains quickly, holds less water
                        waterMultiplier = 0.6;
                        break;
                    case STATE.LOAMY:
                        // Loamy soil holds a good amount of water
                        waterMultiplier = 1.1;
                        break;
                    case STATE.ROCKY:
                        // Rocky soil drains very quickly
                        waterMultiplier = 0.4;
                        break;
                    case STATE.FERTILE:
                        // Fertile soil holds water well
                        waterMultiplier = 1.2;
                        break;
                }
                
                // Calculate final water content
                core.water[index] = Math.floor(baseWaterContent * waterMultiplier);
                
                // Update WET/DRY state for non-layer-type soil
                if (soilState === STATE.DEFAULT || soilState === STATE.FERTILE) {
                    if (core.water[index] > 20) {
                        // Only set WET state if not already a special soil type
                        if (soilState === STATE.DEFAULT) {
                            core.state[index] = STATE.WET;
                        }
                    } else if (soilState === STATE.DEFAULT) {
                        core.state[index] = STATE.DRY;
                    }
                }
                
                // Nutrients vary by soil type
                let nutrientBase = 30;
                switch (soilState) {
                    case STATE.CLAY:
                        // Clay can be rich in nutrients
                        nutrientBase = 40;
                        break;
                    case STATE.SANDY:
                        // Sandy soil has fewer nutrients
                        nutrientBase = 20;
                        break;
                    case STATE.LOAMY:
                        // Loamy soil is nutrient-rich
                        nutrientBase = 50;
                        break;
                    case STATE.ROCKY:
                        // Rocky soil has very few nutrients
                        nutrientBase = 15;
                        break;
                    case STATE.FERTILE:
                        // Fertile soil already has high nutrients
                        nutrientBase = 70;
                        break;
                }
                
                // Add depth influence and randomness
                if (soilState !== STATE.FERTILE) { // Skip if already set by fertile soil
                    core.nutrient[index] = nutrientBase + Math.floor(Math.random() * 30 * (1 + depth));
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