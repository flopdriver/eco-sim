// Temperature System
// Handles temperature effects throughout the simulation

export const TemperatureSystem = {
    // Reference to parent environment controller
    environment: null,

    // Initialize temperature system
    init: function(environmentController) {
        this.environment = environmentController;
        console.log("Initializing temperature system...");
        return this;
    },

    // Update temperature throughout the simulation
    updateTemperature: function(nextActivePixels) {
        // Base temperature fluctuates with day/night cycle
        const baseTempFactor = Math.sin((this.environment.dayNightCycle / 256) * Math.PI);

        // Apply global temperature setting
        // Map from 0-255 to a reasonable range like -50 to +50 from base
        const tempOffset = (this.environment.temperature - 128) / 2.5;

        // Temperature dissipates from top to bottom (simplified model)
        for (let y = 0; y < this.environment.core.height; y++) {
            // Temperature decreases slightly with depth
            const depthFactor = 1 - (y / this.environment.core.height * 0.5);

            for (let x = 0; x < this.environment.core.width; x++) {
                const index = this.environment.core.getIndex(x, y);
                if (index === -1) continue;

                // Calculate temperature for this pixel
                // This doesn't use a separate array, but could affect evaporation, growth rates, etc.
                const pixelTemp = 128 + (baseTempFactor * 50 * depthFactor) + tempOffset;

                // Temperature affects different materials
                switch (this.environment.core.type[index]) {
                    case this.environment.TYPE.WATER:
                        // Higher temp increases evaporation probability
                        if (pixelTemp > 150 && Math.random() < 0.01) {
                            // Chance to evaporate if surface water
                            const aboveIndex = this.environment.core.getIndex(x, y - 1);
                            if (aboveIndex !== -1 && this.environment.core.type[aboveIndex] === this.environment.TYPE.AIR) {
                                // Evaporate into air
                                this.environment.core.type[index] = this.environment.TYPE.AIR;
                                nextActivePixels.add(index);
                            }
                        }
                        break;

                    case this.environment.TYPE.SOIL:
                        // Temperature affects soil moisture (evaporation)
                        if (this.environment.core.water[index] > 10 && pixelTemp > 150) {
                            // Higher temperature increases evaporation from soil
                            const aboveIndex = this.environment.core.getIndex(x, y - 1);
                            if (aboveIndex !== -1 && this.environment.core.type[aboveIndex] === this.environment.TYPE.AIR) {
                                // Evaporate some moisture
                                if (Math.random() < 0.005) {
                                    this.environment.core.water[index] -= 1;

                                    // Update soil state based on moisture
                                    if (this.environment.core.water[index] <= 20) {
                                        this.environment.core.state[index] = this.environment.STATE.DRY;
                                    } else {
                                        this.environment.core.state[index] = this.environment.STATE.WET;
                                        nextActivePixels.add(index);
                                    }
                                }
                            }
                        }
                        break;

                    case this.environment.TYPE.PLANT:
                        // Temperature affects plant growth rates
                        // Too hot or too cold can damage plants
                        if (pixelTemp < 60 || pixelTemp > 200) {
                            // Extreme temperatures can kill plants
                            if (Math.random() < 0.001) {
                                this.environment.core.type[index] = this.environment.TYPE.DEAD_MATTER;
                                nextActivePixels.add(index);
                            }
                        }
                        break;

                    case this.environment.TYPE.INSECT:
                    case this.environment.TYPE.WORM:
                        // Temperature affects creature activity
                        // Creatures are more active in moderate temperatures
                        if (pixelTemp < 80 || pixelTemp > 180) {
                            // Extreme temperatures reduce energy
                            if (Math.random() < 0.005) {
                                this.environment.core.energy[index] -= 1;

                                // If energy is depleted, creature dies
                                if (this.environment.core.energy[index] <= 0) {
                                    this.environment.core.type[index] = this.environment.TYPE.DEAD_MATTER;
                                }

                                nextActivePixels.add(index);
                            }
                        }
                        break;
                }
            }
        }
    }
};