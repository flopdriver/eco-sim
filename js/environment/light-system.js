// Light System
// Handles light propagation through the simulation

const LightSystem = {
    // Reference to parent environment controller
    environment: null,

    // Initialize light system
    init: function(environmentController) {
        this.environment = environmentController;
        console.log("Initializing light system...");
        return this;
    },

    // Update light levels throughout the simulation
    updateLight: function(nextActivePixels) {
        // Get sun intensity from day/night system
        const sunIntensity = this.environment.dayNightSystem.getSunIntensity();

        // Process light penetration column by column
        for (let x = 0; x < this.environment.core.width; x++) {
            let lightLevel = sunIntensity;

            // Light travels from top to bottom
            for (let y = 0; y < this.environment.core.height; y++) {
                const index = this.environment.core.getIndex(x, y);
                if (index === -1) continue;

                // Store light energy in the cell
                this.environment.core.energy[index] = Math.min(255, this.environment.core.energy[index] + lightLevel / 10);

                // Different materials absorb/block light differently
                switch (this.environment.core.type[index]) {
                    case this.environment.TYPE.PLANT:
                        if (this.environment.core.state[index] === this.environment.STATE.LEAF) {
                            // Leaves absorb more light for photosynthesis
                            lightLevel -= 30;
                            nextActivePixels.add(index);
                        } else {
                            // Other plant parts absorb less
                            lightLevel -= 10;
                        }
                        break;

                    case this.environment.TYPE.WATER:
                        // Water absorbs light gradually with depth
                        lightLevel -= 5;
                        break;

                    case this.environment.TYPE.SOIL:
                        // Soil blocks most light
                        lightLevel -= 50;
                        break;

                    case this.environment.TYPE.INSECT:
                    case this.environment.TYPE.WORM:
                        // Creatures block light
                        lightLevel -= 30;
                        break;

                    case this.environment.TYPE.AIR:
                        // Air doesn't block much light
                        lightLevel -= 1;
                        break;

                    default:
                        // Default light absorption
                        lightLevel -= 5;
                }

                // Ensure light level doesn't go negative
                lightLevel = Math.max(0, lightLevel);

                // If no more light, skip the rest of this column
                if (lightLevel <= 0) break;
            }
        }
    }
};