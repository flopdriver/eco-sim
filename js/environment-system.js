// Environment System
// Handles environmental factors like light, temperature, and weather

const EnvironmentSystem = {
    // Reference to core simulation
    core: null,

    // Environment state
    dayNightCycle: 0,      // 0-255 representing time of day
    dayLength: 5,          // Length of day cycle (1-10 scale)
    temperature: 128,      // 0-255 representing temperature
    rainProbability: 0.01, // Chance of rain per tick

    // Type and state enums (will be populated by controller)
    TYPE: null,
    STATE: null,

    // Initialize environment system
    init: function(core) {
        this.core = core;
        console.log("Initializing environment systems...");
        return this;
    },

    // Update environmental factors
    update: function(activePixels, nextActivePixels) {
        // Update day/night cycle
        this.updateDayNightCycle();

        // Process weather (rain, etc)
        this.updateWeather(nextActivePixels);

        // Process light penetration
        this.updateLight(nextActivePixels);

        // Process temperature
        this.updateTemperature(nextActivePixels);

        // Update UI indicators
        this.updateUI();
    },

    // Update day/night cycle
    updateDayNightCycle: function() {
        // Progress day/night cycle based on dayLength setting
        // Lower dayLength = faster cycle, higher = slower cycle
        const cycleSpeed = 0.5 * (11 - this.dayLength) / 5; // Scale to reasonable range
        this.dayNightCycle = (this.dayNightCycle + cycleSpeed) % 256;

        // Update day/night indicator on UI
        const isDaytime = this.dayNightCycle < 128;
        const indicator = document.getElementById('day-night-indicator');
        if (indicator) {
            if (isDaytime) {
                indicator.textContent = "Day";
            } else {
                indicator.textContent = "Night";
            }
        }
    },

    // Update weather conditions
    updateWeather: function(nextActivePixels) {
        // Rain has a chance to occur based on rainProbability
        if (Math.random() < this.rainProbability) {
            this.createRain(nextActivePixels);
        }
    },

    // Create rain at the top of the simulation
    createRain: function(nextActivePixels) {
        // Rain appears at the top of the simulation
        for (let x = 0; x < this.core.width; x++) {
            // Not every column gets rain - randomize for natural look
            if (Math.random() < 0.1) {
                const index = this.core.getIndex(x, 0);

                if (index !== -1 && this.core.type[index] === this.TYPE.AIR) {
                    // Create water at the top
                    this.core.type[index] = this.TYPE.WATER;
                    this.core.water[index] = 255; // Full water content
                    nextActivePixels.add(index);
                }
            }
        }
    },

    // Update light levels throughout the simulation
    updateLight: function(nextActivePixels) {
        // Calculate sun intensity based on day/night cycle
        // Sine wave creates smooth transition between day and night
        const sunIntensity = Math.sin((this.dayNightCycle / 256) * Math.PI) * 255;

        // Negative values mean night
        const normalizedIntensity = Math.max(0, sunIntensity);

        // Process light penetration column by column
        for (let x = 0; x < this.core.width; x++) {
            let lightLevel = normalizedIntensity;

            // Light travels from top to bottom
            for (let y = 0; y < this.core.height; y++) {
                const index = this.core.getIndex(x, y);
                if (index === -1) continue;

                // Store light energy in the cell
                this.core.energy[index] = Math.min(255, this.core.energy[index] + lightLevel / 10);

                // Different materials absorb/block light differently
                switch (this.core.type[index]) {
                    case this.TYPE.PLANT:
                        if (this.core.state[index] === this.STATE.LEAF) {
                            // Leaves absorb more light for photosynthesis
                            lightLevel -= 30;
                            nextActivePixels.add(index);
                        } else {
                            // Other plant parts absorb less
                            lightLevel -= 10;
                        }
                        break;

                    case this.TYPE.WATER:
                        // Water absorbs light gradually with depth
                        lightLevel -= 5;
                        break;

                    case this.TYPE.SOIL:
                        // Soil blocks most light
                        lightLevel -= 50;
                        break;

                    case this.TYPE.INSECT:
                    case this.TYPE.WORM:
                        // Creatures block light
                        lightLevel -= 30;
                        break;

                    case this.TYPE.AIR:
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
    },

    // Update temperature throughout the simulation
    updateTemperature: function(nextActivePixels) {
        // Base temperature fluctuates with day/night cycle
        const baseTempFactor = Math.sin((this.dayNightCycle / 256) * Math.PI);

        // Apply global temperature setting
        // Map from 0-255 to a reasonable range like -50 to +50 from base
        const tempOffset = (this.temperature - 128) / 2.5;

        // Temperature dissipates from top to bottom (simplified model)
        for (let y = 0; y < this.core.height; y++) {
            // Temperature decreases slightly with depth
            const depthFactor = 1 - (y / this.core.height * 0.5);

            for (let x = 0; x < this.core.width; x++) {
                const index = this.core.getIndex(x, y);
                if (index === -1) continue;

                // Calculate temperature for this pixel
                // This doesn't use a separate array, but could affect evaporation, growth rates, etc.
                const pixelTemp = 128 + (baseTempFactor * 50 * depthFactor) + tempOffset;

                // Temperature affects different materials
                switch (this.core.type[index]) {
                    case this.TYPE.WATER:
                        // Higher temp increases evaporation probability
                        if (pixelTemp > 150 && Math.random() < 0.01) {
                            // Chance to evaporate if surface water
                            const aboveIndex = this.core.getIndex(x, y - 1);
                            if (aboveIndex !== -1 && this.core.type[aboveIndex] === this.TYPE.AIR) {
                                // Evaporate into air
                                this.core.type[index] = this.TYPE.AIR;
                                nextActivePixels.add(index);
                            }
                        }
                        break;

                    case this.TYPE.SOIL:
                        // Temperature affects soil moisture (evaporation)
                        if (this.core.water[index] > 10 && pixelTemp > 150) {
                            // Higher temperature increases evaporation from soil
                            const aboveIndex = this.core.getIndex(x, y - 1);
                            if (aboveIndex !== -1 && this.core.type[aboveIndex] === this.TYPE.AIR) {
                                // Evaporate some moisture
                                if (Math.random() < 0.005) {
                                    this.core.water[index] -= 1;

                                    // Update soil state based on moisture
                                    if (this.core.water[index] <= 20) {
                                        this.core.state[index] = this.STATE.DRY;
                                    } else {
                                        this.core.state[index] = this.STATE.WET;
                                        nextActivePixels.add(index);
                                    }
                                }
                            }
                        }
                        break;

                    case this.TYPE.PLANT:
                        // Temperature affects plant growth rates
                        // Too hot or too cold can damage plants
                        if (pixelTemp < 60 || pixelTemp > 200) {
                            // Extreme temperatures can kill plants
                            if (Math.random() < 0.001) {
                                this.core.type[index] = this.TYPE.DEAD_MATTER;
                                nextActivePixels.add(index);
                            }
                        }
                        break;

                    case this.TYPE.INSECT:
                    case this.TYPE.WORM:
                        // Temperature affects creature activity
                        // Creatures are more active in moderate temperatures
                        if (pixelTemp < 80 || pixelTemp > 180) {
                            // Extreme temperatures reduce energy
                            if (Math.random() < 0.005) {
                                this.core.energy[index] -= 1;

                                // If energy is depleted, creature dies
                                if (this.core.energy[index] <= 0) {
                                    this.core.type[index] = this.TYPE.DEAD_MATTER;
                                }

                                nextActivePixels.add(index);
                            }
                        }
                        break;
                }
            }
        }
    },

    // Update UI elements related to environment
    updateUI: function() {
        // Update daylight indicator
        const dayPercent = (this.dayNightCycle / 256) * 100;
        const timeOfDay = Math.floor((this.dayNightCycle / 256) * 24); // 24-hour format

        // Format time as HH:MM
        const hours = timeOfDay;
        const minutes = Math.floor((this.dayNightCycle / 256 * 24 * 60) % 60);
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        // Update time indicator if it exists
        const timeIndicator = document.getElementById('time-indicator');
        if (timeIndicator) {
            timeIndicator.textContent = timeString;
        }
    },

    // Set rain probability (0-1 scale)
    setRainProbability: function(probability) {
        this.rainProbability = Math.max(0, Math.min(1, probability));
    },

    // Set temperature (0-255 scale)
    setTemperature: function(temperature) {
        this.temperature = Math.max(0, Math.min(255, temperature));
    },

    // Set day length (1-10 scale, where 1 is fastest, 10 is slowest)
    setDayLength: function(length) {
        this.dayLength = Math.max(1, Math.min(10, length));
    }
};