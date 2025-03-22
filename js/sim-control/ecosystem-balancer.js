// Ecosystem Balancer - Manages ecosystem balance mechanics
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

    // Initialize ecosystem balancer
    init: function(controller) {
        console.log("Initializing ecosystem balancer...");
        this.controller = controller;
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
        // Calculate temperature effect
        const tempFactor = (this.controller.environment.temperature - 128) / 128;
        const temperatureEffect = 1.0 + (tempFactor * this.environmentalInfluence.temperatureEffect);
        
        // Calculate day/night cycle effect
        const isDaytime = this.controller.environment.dayNightCycle < 128;
        const lightEffect = isDaytime ? 1.2 : 0.8;
        
        // Calculate moisture effect based on rain probability
        const moistureEffect = 1.0 + (this.controller.environment.rainProbability * 0.5);
        
        // Apply effects to biological rates
        this.controller.biology.metabolism *= temperatureEffect;
        this.controller.biology.growthRate *= (temperatureEffect * lightEffect * moistureEffect);
        this.controller.biology.reproduction *= moistureEffect;
        
        // Ensure rates stay within reasonable bounds
        this.controller.biology.metabolism = Math.max(0, Math.min(2.0, this.controller.biology.metabolism));
        this.controller.biology.growthRate = Math.max(0, Math.min(2.0, this.controller.biology.growthRate));
        this.controller.biology.reproduction = Math.max(0, Math.min(2.0, this.controller.biology.reproduction));
    },

    // Check ecosystem balance and apply corrections if needed
    checkEcosystemBalance: function(plantCount, insectCount, wormCount) {
        // More sophisticated population dynamics
        const totalActiveCells = this.controller.core.width * this.controller.core.height * 0.4;

        // Track plant maturity by checking total plant energy
        let totalPlantEnergy = 0;
        let maturePlantCount = 0;

        // Sample plant cells to estimate maturity (checking all would be expensive)
        const core = this.controller.core;
        const TYPE = this.controller.TYPE;
        const sampleSize = 100;

        for (let i = 0; i < sampleSize; i++) {
            const x = Math.floor(Math.random() * core.width);
            const y = Math.floor(Math.random() * core.height);
            const index = core.getIndex(x, y);

            if (index !== -1 && core.type[index] === TYPE.PLANT) {
                totalPlantEnergy += core.energy[index];
                if (core.energy[index] > 100) {
                    maturePlantCount++;
                }
            }
        }

        // If too many plants and few insects, spawn more
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
    },

    // Helper function to spawn random insects as a balancing mechanism
    spawnRandomInsects: function(count) {
        const core = this.controller.core;
        const TYPE = this.controller.TYPE;
        const STATE = this.controller.STATE;
        const activePixels = this.controller.activePixels;

        for (let i = 0; i < count; i++) {
            // Find a random air cell in the upper half
            const x = Math.floor(Math.random() * core.width);
            const y = Math.floor(Math.random() * (core.height * 0.3));
            const index = core.getIndex(x, y);

            if (index !== -1 && core.type[index] === TYPE.AIR) {
                // Create insect
                core.type[index] = TYPE.INSECT;
                core.state[index] = STATE.ADULT;
                core.energy[index] = 150; // Initial energy
                activePixels.add(index);
            }
        }
    }
};

// Export the balancer - make it work in both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EcosystemBalancer;
}