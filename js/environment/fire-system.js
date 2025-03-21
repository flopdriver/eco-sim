// Fire System
// Handles fire behavior, propagation, and effects on the ecosystem

const FireSystem = {
    // Reference to parent environment controller
    environment: null,

    // Fire properties
    fireProperties: {
        activeFires: new Set(), // Currently burning pixels
        spreadProbability: 0.12, // Chance of fire spreading to neighboring plants
        burnDuration: 60,      // How long a fire burns before dying out (frames)
        maxFireSize: 400,      // Limit total fire size to prevent excessive burning
        fireIntensity: 220,    // Fire visual intensity (0-255)

        // Plant flammability factors (different plants burn differently)
        plantFlammability: {
            stem: 1.2,         // Stems burn faster
            leaf: 1.5,         // Leaves are most flammable
            flower: 1.3,       // Flowers are quite flammable
            root: 0.6          // Roots are resistant to burning
        },

        // Effects of different materials on fire
        materialEffects: {
            water: -0.8,       // Water significantly reduces fire
            soil: -0.5,        // Soil reduces fire
            air: 0.2           // Air increases fire (oxygen)
        }
    },

    // Initialize fire system
    init: function(environmentController) {
        this.environment = environmentController;
        console.log("Initializing fire system...");
        return this;
    },

    // Update all active fires
    updateFires: function(nextActivePixels) {
        const core = this.environment.core;

        // Check if there are too many active fires - if so, reduce intensity
        const fireRate = this.fireProperties.activeFires.size > this.fireProperties.maxFireSize ?
            this.fireProperties.spreadProbability * 0.3 : // Reduced spread when fire is large
            this.fireProperties.spreadProbability;        // Normal spread otherwise

        // Process each active fire
        const firesToRemove = [];

        this.fireProperties.activeFires.forEach(index => {
            // Skip invalid indices
            if (index === -1) {
                firesToRemove.push(index);
                return;
            }

            // Get burn progress
            const burnProgress = core.metadata[index];

            // If no longer a plant or burning, remove from active fires
            if (core.type[index] !== this.environment.TYPE.PLANT || burnProgress === 0) {
                firesToRemove.push(index);
                return;
            }

            // Update burn progress
            const newProgress = Math.min(200, burnProgress + 2);
            core.metadata[index] = newProgress;

            // Make the plant look like it's burning
            core.energy[index] = 220 - newProgress / 2; // Redder as it burns more

            // If fully burned, convert to fertile soil
            if (newProgress >= 200) {
                // Convert to fertile soil with good nutrients
                core.type[index] = this.environment.TYPE.SOIL;
                core.state[index] = this.environment.STATE.FERTILE;
                core.nutrient[index] = 150 + Math.floor(Math.random() * 50); // High nutrients from ash
                core.water[index] = 10 + Math.floor(Math.random() * 20); // Some moisture remains
                core.energy[index] = Math.floor(Math.random() * 30); // Ember glow

                // Emit a bit of "ash" (dead matter) occasionally
                if (Math.random() < 0.1) {
                    const coords = core.getCoords(index);
                    const upIndex = core.getIndex(coords.x, coords.y - 1);

                    if (upIndex !== -1 && core.type[upIndex] === this.environment.TYPE.AIR) {
                        core.type[upIndex] = this.environment.TYPE.DEAD_MATTER;
                        core.nutrient[upIndex] = 50;
                        core.energy[upIndex] = 10;
                        nextActivePixels.add(upIndex);
                    }
                }

                // Remove from active fires
                firesToRemove.push(index);
            }
            else {
                // Still burning - try to spread fire to neighboring plants
                this.spreadFire(index, fireRate, nextActivePixels);
            }

            // Keep fire pixel active
            nextActivePixels.add(index);

            // Add heat to surrounding air
            this.addHeatToSurroundingAir(index, nextActivePixels);
        });

        // Remove fires that are done
        firesToRemove.forEach(index => {
            this.fireProperties.activeFires.delete(index);
        });
    },

    // Start a fire at the given location
    startFire: function(index, nextActivePixels) {
        const core = this.environment.core;

        // Only start fires in plants or dead matter
        if (core.type[index] !== this.environment.TYPE.PLANT &&
            core.type[index] !== this.environment.TYPE.DEAD_MATTER) return false;

        // Initialize fire state in metadata
        // Use metadata to track burn progress
        core.metadata[index] = 1; // Just starting to burn

        // Add to active fires set
        this.fireProperties.activeFires.add(index);

        // Add energy for fire visuals
        core.energy[index] = this.fireProperties.fireIntensity;

        // Generate heat in air above for convection and visual effects
        this.addHeatToSurroundingAir(index, nextActivePixels);

        // Activate the pixel
        nextActivePixels.add(index);

        return true;
    },

    // Spread fire to neighboring plants
    spreadFire: function(index, spreadRate, nextActivePixels) {
        const core = this.environment.core;
        const coords = core.getCoords(index);

        if (!coords) return;

        // Get burn progress - more advanced fires spread more
        const burnProgress = core.metadata[index];
        const isEstablishedFire = burnProgress > 50;

        // Fire spreads upward and sideways more easily than downward
        // Get neighbors with varying probabilities
        const neighbors = core.getNeighborIndices(coords.x, coords.y);

        for (const neighbor of neighbors) {
            // Only spread to plants or dead matter that aren't already burning
            if ((core.type[neighbor.index] === this.environment.TYPE.PLANT ||
                    core.type[neighbor.index] === this.environment.TYPE.DEAD_MATTER) &&
                (!core.metadata[neighbor.index] || core.metadata[neighbor.index] === 0)) {

                // Direction-based spread adjustments
                let directionalFactor = 1.0;

                // Spreading to plants above is easier (heat rises)
                if (neighbor.y < coords.y) {
                    directionalFactor = 2.0;
                }
                // Spreading sideways is normal
                else if (neighbor.y === coords.y) {
                    directionalFactor = 1.0;
                }
                // Spreading downward is harder
                else {
                    directionalFactor = 0.5;
                }

                // Established fires spread more easily
                if (isEstablishedFire) {
                    directionalFactor *= 1.5;
                }

                // Adjust for plant type flammability
                if (core.type[neighbor.index] === this.environment.TYPE.PLANT) {
                    const plantState = core.state[neighbor.index];
                    let flammabilityFactor = 1.0;

                    // Different plant parts have different flammability
                    switch (plantState) {
                        case this.environment.STATE.LEAF:
                            flammabilityFactor = this.fireProperties.plantFlammability.leaf;
                            break;
                        case this.environment.STATE.STEM:
                            flammabilityFactor = this.fireProperties.plantFlammability.stem;
                            break;
                        case this.environment.STATE.FLOWER:
                            flammabilityFactor = this.fireProperties.plantFlammability.flower;
                            break;
                        case this.environment.STATE.ROOT:
                            flammabilityFactor = this.fireProperties.plantFlammability.root;
                            break;
                    }

                    directionalFactor *= flammabilityFactor;
                } else if (core.type[neighbor.index] === this.environment.TYPE.DEAD_MATTER) {
                    // Dead matter is highly flammable
                    directionalFactor *= 1.8;
                }

                // Check for nearby materials that affect fire spread
                const nearbyNeighbors = core.getNeighborIndices(neighbor.x, neighbor.y);
                let materialFactor = 1.0;

                for (const nearbyNeighbor of nearbyNeighbors) {
                    // Skip diagonals for material check
                    if (nearbyNeighbor.diagonal) continue;

                    // Check for materials that affect fire
                    switch (core.type[nearbyNeighbor.index]) {
                        case this.environment.TYPE.WATER:
                            materialFactor += this.fireProperties.materialEffects.water;
                            break;
                        case this.environment.TYPE.SOIL:
                            materialFactor += this.fireProperties.materialEffects.soil;
                            break;
                        case this.environment.TYPE.AIR:
                            materialFactor += this.fireProperties.materialEffects.air;
                            break;
                    }
                }

                // Ensure material factor stays positive
                materialFactor = Math.max(0.1, materialFactor);

                // Calculate final spread chance
                const spreadChance = spreadRate * directionalFactor * materialFactor;

                // Try to spread fire with calculated probability
                if (Math.random() < spreadChance) {
                    this.startFire(neighbor.index, nextActivePixels);
                }
            }
        }
    },

    // Add heat to air above and around fire for convection effects
    addHeatToSurroundingAir: function(index, nextActivePixels) {
        const core = this.environment.core;
        const coords = core.getCoords(index);

        if (!coords) return;

        // Apply heat to air pixels above and to the sides
        for (let dy = -3; dy <= 0; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                // Skip the center (that's the fire itself)
                if (dx === 0 && dy === 0) continue;

                // Heat rises, so upper pixels get more heat
                const heatFactor = (dy < 0) ? 1.0 - (dy / -5) : 0.3;

                // Air farther to the sides gets less heat
                const sideFactor = 1.0 - (Math.abs(dx) / 3);

                // Get index of air pixel
                const airX = coords.x + dx;
                const airY = coords.y + dy;
                const airIndex = core.getIndex(airX, airY);

                if (airIndex !== -1 && core.type[airIndex] === this.environment.TYPE.AIR) {
                    // Calculate heat level - base energy plus randomness
                    const heatLevel = 170 + Math.floor(50 * heatFactor * sideFactor) + Math.floor(Math.random() * 30);

                    // Add heat/energy to air pixel (for visual effects and air dynamics)
                    core.energy[airIndex] = Math.max(core.energy[airIndex], heatLevel);

                    // Random chance to create smoke (upward air movement)
                    if (dy < 0 && Math.random() < 0.1 * heatFactor) {
                        // Use water content to represent smoke density
                        core.water[airIndex] = Math.min(30, core.water[airIndex] + 10);
                    }

                    // Activate this air pixel
                    nextActivePixels.add(airIndex);
                }
            }
        }
    },

    // Check for and handle temperature-based fire starts (dry areas in hot weather)
    checkSpontaneousCombustion: function(nextActivePixels) {
        const core = this.environment.core;
        const temperature = this.environment.temperature;

        // Only allow spontaneous combustion in very hot weather
        if (temperature < 180) return;

        // Very small chance of spontaneous combustion
        const baseChance = 0.00002;

        // Increased chance based on temperature
        const temperatureFactor = (temperature - 180) / 75;
        const combustionChance = baseChance * temperatureFactor;

        // Check random plant pixels
        const sampleSize = 20;

        for (let i = 0; i < sampleSize; i++) {
            // Pick a random position
            const x = Math.floor(Math.random() * core.width);
            const y = Math.floor(Math.random() * core.height);
            const index = core.getIndex(x, y);

            if (index === -1) continue;

            // Only plants with very low water can spontaneously combust
            if (core.type[index] === this.environment.TYPE.PLANT &&
                core.water[index] < 10 &&
                Math.random() < combustionChance) {

                // Start a fire
                this.startFire(index, nextActivePixels);

                // Log the event
                console.log("Spontaneous combustion occurred at hot temperature:", temperature);
            }
        }
    }
};