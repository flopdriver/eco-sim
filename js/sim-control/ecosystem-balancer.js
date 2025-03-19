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
    },

    // Check ecosystem balance and apply corrections if needed
    checkEcosystemBalance: function(plantCount, insectCount, wormCount) {
        // Calculate total active area (non-soil)
        const totalActiveCells = this.controller.core.width * this.controller.core.height * 0.4; // Approx cells above ground

        // Check plant domination
        if (plantCount > totalActiveCells * 0.5 && insectCount < 10) {
            // Plants taking over, but few insects - spawn some insects
            this.spawnRandomInsects(3);
        }

        // Check insect overpopulation
        if (insectCount > plantCount * 0.5) {
            // Too many insects for available plants - reduce reproduction
            this.controller.biology.reproduction *= 0.9;
        } else {
            // Normalize reproduction rate back toward standard
            this.controller.biology.reproduction = Math.min(1.0, this.controller.biology.reproduction * 1.05);
        }

        // Other balance mechanisms could be added here
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