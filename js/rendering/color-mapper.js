// Color Mapper Module
// Handles color mapping between simulation data and rendered pixels

window.ColorMapper = {
    // Reference to core simulation and its type/state enums
    core: null,
    TYPE: null,
    STATE: null,

    // Initialize color mapper
    init: function(core, TYPE, STATE) {
        console.log("Initializing color mapper...");
        this.core = core;
        this.TYPE = TYPE;
        this.STATE = STATE;
        this.weatherSystem = null; // Will be set by environment controller
        return this;
    },
    
    // Set reference to weather system
    setWeatherSystem: function(weatherSystem) {
        this.weatherSystem = weatherSystem;
    },

    // Get color for a pixel based on its properties and current visualization mode
    getPixelColor: function(index) {
        // Check for clouds first (using core.cloud array)
        if (this.core.cloud && this.core.cloud[index] > 0) {
            // This is a cloud pixel - always render clouds on top of everything
            // Use a consistent color for each cloud pixel to avoid flickering
            return {
                r: 240,
                g: 240,
                b: 250
            };
        }
        
        // Handle specialized visualization modes
        if (VisualizationManager.getMode() !== 'normal') {
            return this.getSpecializedVisualizationColor(index);
        }

        // Get pixel properties
        const type = this.core.type[index];
        const state = this.core.state[index];
        const water = this.core.water[index];
        const energy = this.core.energy[index];
        const nutrient = this.core.nutrient[index];

        // Default colors
        let r = 0, g = 0, b = 0;

        // Normal mode - color based on type and state
        switch (type) {
            case this.TYPE.AIR:
                // Air color varies with energy (sunlight) - softer blue
                const lightLevel = Math.min(1.0, energy / 150);
                // More natural sky blue with day/night influence
                r = 70 + Math.floor(lightLevel * 100);  // Reduced from 100
                g = 130 + Math.floor(lightLevel * 70);   // Reduced from 180
                b = 200 + Math.floor(lightLevel * 30);   // Reduced from 230, added light variation
                // Add slight variation for more natural look
                r += Math.floor(Math.random() * 15) - 7;
                g += Math.floor(Math.random() * 15) - 7;
                b += Math.floor(Math.random() * 15) - 7;
                break;

            case this.TYPE.WATER:
                // Water color - more natural blue with subtle variation
                r = 35 + Math.floor(nutrient * 0.1); // Slight reddish with nutrients
                g = 110 + Math.floor(nutrient * 0.05) - Math.floor(Math.random() * 15);
                b = 185 - Math.floor(nutrient * 0.1) + Math.floor(Math.random() * 15);
                // Darker in deeper water
                const coords = this.core.getCoords(index);
                if (coords) {
                    const depth = coords.y / this.core.height;
                    r = Math.max(10, r - Math.floor(depth * 20));
                    g = Math.max(70, g - Math.floor(depth * 30));
                    b = Math.max(140, b - Math.floor(depth * 20));
                }
                break;

            case this.TYPE.SOIL:
                // Soil color - more natural earth tones with variation
                switch (state) {
                    case this.STATE.DRY:
                        // Dry soil - sandy, light brown with variation
                        r = 150 - Math.floor(water * 0.15) + Math.floor(Math.random() * 15) - 7;
                        g = 120 - Math.floor(water * 0.1) + Math.floor(Math.random() * 15) - 7;
                        b = 90 - Math.floor(water * 0.05) + Math.floor(Math.random() * 10) - 5;
                        break;
                    case this.STATE.WET:
                        // Wet soil - darker brown with variation
                        r = 100 - Math.floor(water * 0.1) + Math.floor(Math.random() * 10) - 5;
                        g = 65 - Math.floor(water * 0.05) + Math.floor(Math.random() * 10) - 5;
                        b = 40 + Math.floor(Math.random() * 10) - 5;
                        break;
                    case this.STATE.FERTILE:
                        // Fertile soil - rich darker brown with variation
                        r = 110 - Math.floor(nutrient * 0.05) + Math.floor(Math.random() * 10) - 5;
                        g = 75 + Math.floor(nutrient * 0.1) + Math.floor(Math.random() * 10) - 5;
                        b = 50 + Math.floor(Math.random() * 8) - 4;
                        break;
                    default:
                        // Default brown with variation
                        r = 150 + Math.floor(Math.random() * 15) - 7;
                        g = 120 + Math.floor(Math.random() * 10) - 5;
                        b = 90 + Math.floor(Math.random() * 10) - 5;
                }
                break;

            case this.TYPE.PLANT:
                // Different plant parts have different colors - ENHANCED CONTRAST
                switch (state) {
                    case this.STATE.ROOT:
                        // Roots - BRIGHTENED COLORS for better visibility against soil
                        // Cap the water influence to prevent blue tinting with high water levels
                        const cappedWater = Math.min(100, water); // Cap water value at 100 for color calculation
                        r = 160 - Math.floor(cappedWater * 0.15) + Math.floor(Math.random() * 10) - 5; // Reduced water influence
                        g = 120 + Math.floor(cappedWater * 0.05) + Math.floor(Math.random() * 10) - 5; // Reduced water influence
                        b = 65 + Math.floor(Math.random() * 8) - 4; // Fixed base value, reduced from 80
                        break;
                    case this.STATE.STEM:
                        // Stems - BRIGHTENED COLORS
                        r = 65 + Math.floor(energy * 0.05) + Math.floor(Math.random() * 10) - 5; // Decreased from 80
                        g = 160 + Math.floor(energy * 0.1) + Math.floor(Math.random() * 15) - 7; // Increased from 120
                        b = 65 + Math.floor(Math.random() * 10) - 5; // Increased from 50
                        break;
                    case this.STATE.LEAF:
                        // Leaves - BRIGHTER, MORE VIVID green with variation
                        // Use both energy and water to influence color
                        const energyFactor = Math.min(1.0, energy / 200);
                        const waterFactor = Math.min(1.0, water / 200);

                        // Base green color - MORE CONTRAST
                        r = 30 + Math.floor(waterFactor * 20) + Math.floor(Math.random() * 15) - 7; // Decreased from 40
                        g = 170 + Math.floor(energyFactor * 40) + Math.floor(Math.random() * 20) - 10; // Increased from 100
                        b = 40 + Math.floor(waterFactor * 20) + Math.floor(Math.random() * 10) - 5; // Increased from 30

                        // Age variation - older leaves turn more yellow
                        if (Math.random() < 0.2) {
                            r += 25; // Increased from 20
                            g -= 15; // Increased from 10
                        }
                        break;
                    case this.STATE.FLOWER:
                        // Enhanced flower visualization with distinct petal and center colors
                        // Get coordinates for better color distribution
                        const coords = this.core.getCoords(index);
                        
                        // Use a deterministic "random" value based on position
                        // This ensures specific flowers maintain their color
                        const flowerSeed = ((coords.x * 7) + (coords.y * 13)) % 5;
                        
                        // Check if it's a flower center (has stem connections) or petal
                        let isCenter = false;
                        const neighbors = this.core.getNeighborIndices(coords.x, coords.y);
                        for (const neighbor of neighbors) {
                            if (this.core.type[neighbor.index] === this.TYPE.PLANT && 
                                this.core.state[neighbor.index] === this.STATE.STEM) {
                                isCenter = true;
                                break;
                            }
                        }
                        
                        // Flower colors based on position-based seed
                        if (flowerSeed === 0) {
                            // Red/pink flowers
                            if (isCenter) {
                                r = 200 + Math.floor(Math.random() * 20);
                                g = 40 + Math.floor(Math.random() * 20);
                                b = 60 + Math.floor(Math.random() * 20);
                            } else {
                                r = 240 + Math.floor(Math.random() * 15);
                                g = 80 + Math.floor(Math.random() * 30);
                                b = 100 + Math.floor(Math.random() * 30);
                            }
                        } else if (flowerSeed === 1) {
                            // Purple flowers
                            if (isCenter) {
                                r = 130 + Math.floor(Math.random() * 20);
                                g = 30 + Math.floor(Math.random() * 20);
                                b = 180 + Math.floor(Math.random() * 20);
                            } else {
                                r = 180 + Math.floor(Math.random() * 30);
                                g = 60 + Math.floor(Math.random() * 30);
                                b = 230 + Math.floor(Math.random() * 25);
                            }
                        } else if (flowerSeed === 2) {
                            // White flowers
                            if (isCenter) {
                                r = 200 + Math.floor(Math.random() * 20);
                                g = 200 + Math.floor(Math.random() * 20);
                                b = 120 + Math.floor(Math.random() * 20);
                            } else {
                                r = 240 + Math.floor(Math.random() * 15);
                                g = 240 + Math.floor(Math.random() * 15);
                                b = 220 + Math.floor(Math.random() * 20);
                            }
                        } else if (flowerSeed === 3) {
                            // Yellow flowers
                            if (isCenter) {
                                r = 200 + Math.floor(Math.random() * 20);
                                g = 180 + Math.floor(Math.random() * 20);
                                b = 30 + Math.floor(Math.random() * 20);
                            } else {
                                r = 250 + Math.floor(Math.random() * 5);
                                g = 230 + Math.floor(Math.random() * 20);
                                b = 70 + Math.floor(Math.random() * 30);
                            }
                        } else {
                            // Blue flowers
                            if (isCenter) {
                                r = 40 + Math.floor(Math.random() * 20);
                                g = 80 + Math.floor(Math.random() * 20);
                                b = 180 + Math.floor(Math.random() * 20);
                            } else {
                                r = 70 + Math.floor(Math.random() * 30);
                                g = 120 + Math.floor(Math.random() * 30);
                                b = 240 + Math.floor(Math.random() * 15);
                            }
                        }
                        break;
                    default:
                        // Default green with variation - BRIGHTENED
                        r = 50 + Math.floor(Math.random() * 20) - 10; // Decreased from 60
                        g = 160 + Math.floor(Math.random() * 30) - 15; // Increased from 120
                        b = 60 + Math.floor(Math.random() * 20) - 10; // Increased from 50
                }
                break;

            case this.TYPE.INSECT:
                // Insects - more natural reddish-brown
                const insectEnergy = Math.min(1.0, energy / 200);
                r = 150 + Math.floor(insectEnergy * 40) + Math.floor(Math.random() * 20) - 10;
                g = 80 + Math.floor(insectEnergy * 20) + Math.floor(Math.random() * 15) - 7;
                b = 40 + Math.floor(insectEnergy * 10) + Math.floor(Math.random() * 15) - 7;
                break;

            case this.TYPE.SEED:
                // Seeds - natural brown with variation
                r = 120 + Math.floor(energy * 0.1) + Math.floor(Math.random() * 15) - 7;
                g = 100 - Math.floor(energy * 0.05) + Math.floor(Math.random() * 15) - 7;
                b = 60 + Math.floor(Math.random() * 10) - 5;
                break;

            case this.TYPE.DEAD_MATTER:
                // Dead matter - grayish brown with variation
                r = 100 - Math.floor(water * 0.1) + Math.floor(Math.random() * 15) - 7;
                g = 90 - Math.floor(water * 0.1) + Math.floor(Math.random() * 15) - 7;
                b = 70 - Math.floor(water * 0.05) + Math.floor(Math.random() * 10) - 5;
                break;

            case this.TYPE.WORM:
                // Worms - pinkish-brown with variation
                r = 180 - Math.floor(energy * 0.05) + Math.floor(Math.random() * 15) - 7;
                g = 130 - Math.floor(energy * 0.05) + Math.floor(Math.random() * 15) - 7;
                b = 130 - Math.floor(energy * 0.05) + Math.floor(Math.random() * 10) - 5;
                break;

            default:
                // Unknown type - gray with variation
                r = g = b = 120 + Math.floor(Math.random() * 20) - 10;
        }

        // Ensure RGB values are in valid range
        return {
            r: Math.max(0, Math.min(255, Math.floor(r))),
            g: Math.max(0, Math.min(255, Math.floor(g))),
            b: Math.max(0, Math.min(255, Math.floor(b)))
        };
    },

    // Get color for specialized visualization modes (moisture, energy, nutrient)
    getSpecializedVisualizationColor: function(index) {
        const mode = VisualizationManager.getMode();

        // Get the relevant property based on visualization mode
        let value = 0;
        let palette = null;

        switch (mode) {
            case 'moisture':
                value = this.core.water[index];
                palette = VisualizationManager.colorPalettes.moisture;
                break;
            case 'energy':
                value = this.core.energy[index];
                palette = VisualizationManager.colorPalettes.energy;
                break;
            case 'nutrient':
                value = this.core.nutrient[index];
                palette = VisualizationManager.colorPalettes.nutrient;
                break;
            default:
                return { r: 0, g: 0, b: 0 }; // Black for unknown mode
        }

        // Special case for air - always show as very transparent in special modes
        if (this.core.type[index] === this.TYPE.AIR) {
            // Add slight variation for more natural look
            const variation = Math.floor(Math.random() * 10) - 5;
            return { r: 235 + variation, g: 235 + variation, b: 235 + variation };
        }

        // Interpolate between colors based on value
        const baseColor = VisualizationManager.interpolateColor(value, palette);

        // Add small random variation for more natural appearance
        return {
            r: Math.max(0, Math.min(255, baseColor.r + Math.floor(Math.random() * 10) - 5)),
            g: Math.max(0, Math.min(255, baseColor.g + Math.floor(Math.random() * 10) - 5)),
            b: Math.max(0, Math.min(255, baseColor.b + Math.floor(Math.random() * 10) - 5))
        };
    }
};