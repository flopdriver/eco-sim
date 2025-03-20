// Ecosystem Balancer - Manages ecosystem balance for chunked processing
const EcosystemBalancer = {
    // Reference to main controller
    controller: null,

    // Environmental influence settings
    environmentalInfluence: {
        lightEfficiency: 1.0,     // How efficiently plants use light
        temperatureEffect: 1.0,    // How much temperature affects organisms
        moistureSensitivity: 1.0,  // How sensitive plants are to moisture
        soilQualityImpact: 1.0     // How much soil quality affects growth
    },

    // Population estimates
    populationEstimates: {
        plants: 0,
        insects: 0,
        worms: 0,
        seeds: 0,
        water: 0,
        soil: 0
    },

    // Last balance check time
    lastBalanceCheck: 0,
    balanceCheckInterval: 30, // Frames between balance checks

    // Initialize ecosystem balancer
    init: function(controller) {
        console.log("Initializing ecosystem balancer...");
        this.controller = controller;
        this.lastBalanceCheck = 0;
        return this;
    },

    // Initialize connections between environmental and biological systems
    initializeEnvironmentalConnections: function() {
        console.log("Setting up environmental-biological connections...");

        // Set base rates for biology
        this.controller.biology.metabolism = 1.0;   // Base metabolism rate
        this.controller.biology.growthRate = 1.0;   // Base growth rate
        this.controller.biology.reproduction = 1.0; // Base reproduction rate

        // Initial update of biological rates based on environment
        this.updateBiologicalRates();
    },

    // Update biological rates based on current environmental conditions
    updateBiologicalRates: function() {
        const biology = this.controller.biology;
        const environment = this.controller.environment;

        if (!biology || !environment) return;

        // Calculate average temperature (simplified)
        const tempFactor = (environment.temperature - 128) / 128; // -1 to 1 range

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
        const isDaytime = environment.dayNightCycle < 128;
        const lightFactor = isDaytime ?
            0.8 + (0.4 * Math.sin((environment.dayNightCycle / 128) * Math.PI)) :
            0.3; // Reduced growth at night

        // Rain frequency affects growth rates
        const moistureFactor = 0.7 + (environment.rainProbability * 300);

        // Apply all factors with environmental influence settings
        biology.metabolism = tempMetabolismFactor * this.environmentalInfluence.temperatureEffect;
        biology.growthRate = lightFactor * moistureFactor * this.environmentalInfluence.lightEfficiency;
        biology.reproduction = moistureFactor * this.environmentalInfluence.moistureSensitivity;

        // Log changes for debugging
        console.log(`Updated biological rates - Metabolism: ${biology.metabolism.toFixed(2)}, Growth: ${biology.growthRate.toFixed(2)}, Reproduction: ${biology.reproduction.toFixed(2)}`);

        // Also update chunk-based ecosystem parameters if needed
        if (this.controller.chunkManager && this.controller.chunkManager.chunkedEcosystem) {
            // Update biological parameters in chunked ecosystem if it has such properties
            const chunkedEcosystem = this.controller.chunkManager.chunkedEcosystem;
            if (chunkedEcosystem.environmentParams) {
                chunkedEcosystem.environmentParams.metabolism = biology.metabolism;
                chunkedEcosystem.environmentParams.growthRate = biology.growthRate;
                chunkedEcosystem.environmentParams.reproduction = biology.reproduction;
            }
        }
    },

    // Estimation of ecosystem populations from chunk system
    estimatePopulations: function() {
        // Only update periodically
        if (this.lastBalanceCheck++ < this.balanceCheckInterval) {
            return;
        }

        this.lastBalanceCheck = 0;

        // Use sampling to estimate population sizes
        const ecosystem = this.controller.chunkManager.chunkedEcosystem;
        const sampleSize = Math.min(5000, ecosystem.typeArray.length); // Sample up to 5000 pixels
        const sampleInterval = Math.floor(ecosystem.typeArray.length / sampleSize);

        // Reset counts
        const counts = {
            plants: 0,
            insects: 0,
            worms: 0,
            seeds: 0,
            water: 0,
            soil: 0
        };

        // Sample the ecosystem
        for (let i = 0; i < ecosystem.typeArray.length; i += sampleInterval) {
            const pixelType = ecosystem.typeArray[i];

            switch(pixelType) {
                case 3: // Plant
                    counts.plants++;
                    break;
                case 4: // Insect
                    counts.insects++;
                    break;
                case 7: // Worm
                    counts.worms++;
                    break;
                case 5: // Seed
                    counts.seeds++;
                    break;
                case 2: // Water
                    counts.water++;
                    break;
                case 1: // Soil
                    counts.soil++;
                    break;
            }
        }

        // Scale up the estimates
        const scaleFactor = ecosystem.typeArray.length / sampleSize;
        for (const key in counts) {
            this.populationEstimates[key] = Math.round(counts[key] * scaleFactor);
        }

        // Check ecosystem balance now that we have population estimates
        this.checkEcosystemBalance();
    },

    // Check ecosystem balance and apply corrections if needed
    checkEcosystemBalance: function() {
        // Get population estimates
        const plantCount = this.populationEstimates.plants;
        const insectCount = this.populationEstimates.insects;
        const wormCount = this.populationEstimates.worms;

        // More sophisticated population dynamics
        const totalCells = this.controller.core.width * this.controller.core.height;
        const totalActiveCells = totalCells * 0.4;

        // If too many plants and few insects, spawn more insects
        if (plantCount > totalActiveCells * 0.4 && insectCount < 10) {
            this.spawnRandomInsects(5 + Math.floor(plantCount / 50)); // Scale spawn with plant count
        }

        // More dynamic reproduction rate
        if (insectCount > plantCount * 0.3) {
            // Reduce reproduction if too many insects
            this.controller.biology.reproduction *= 0.7;
        } else if (insectCount < plantCount * 0.1) {
            // Increase reproduction if too few insects
            this.controller.biology.reproduction = Math.min(1.0, this.controller.biology.reproduction * 1.3);
        } else {
            // Normalize reproduction
            this.controller.biology.reproduction = Math.min(1.0, this.controller.biology.reproduction * 1.05);
        }

        // Strict population control logic
        if (insectCount > plantCount * 0.1) {
            // Increase insect death rate if overpopulated
            this.controller.biology.metabolism *= 2.0;
        } else {
            // Normalize metabolism
            this.controller.biology.metabolism = Math.max(0.5, this.controller.biology.metabolism * 0.85);
        }

        // Update chunk ecosystem parameters if available
        this.updateChunkEcosystemParams();
    },

    // Update chunk ecosystem parameters
    updateChunkEcosystemParams: function() {
        if (this.controller.chunkManager && this.controller.chunkManager.chunkedEcosystem) {
            const chunkedEcosystem = this.controller.chunkManager.chunkedEcosystem;
            if (chunkedEcosystem.environmentParams) {
                chunkedEcosystem.environmentParams.metabolism = this.controller.biology.metabolism;
                chunkedEcosystem.environmentParams.growthRate = this.controller.biology.growthRate;
                chunkedEcosystem.environmentParams.reproduction = this.controller.biology.reproduction;
            }
        }
    },

    // Helper function to spawn random insects as a balancing mechanism
    spawnRandomInsects: function(count) {
        const core = this.controller.core;
        const ecosystem = this.controller.chunkManager.chunkedEcosystem;

        for (let i = 0; i < count; i++) {
            // Find a random air cell in the upper half
            const x = Math.floor(Math.random() * core.width);
            const y = Math.floor(Math.random() * (core.height * 0.3));
            const index = core.getIndex(x, y);

            if (index !== -1 && ecosystem.typeArray[index] === 0) {
                // Create insect in the chunk ecosystem
                ecosystem.typeArray[index] = 4; // Insect
                ecosystem.energyArray[index] = 150; // Initial energy

                // Mark change in the chunk system
                this.controller.chunkManager.markChange(x, y);
            }
        }
    }
};