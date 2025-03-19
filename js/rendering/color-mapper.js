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
        return this;
    },

    // Get color for a pixel based on its properties and current visualization mode
    getPixelColor: function(index) {
        // Safety check: ensure we have proper initialization
        if (!this.core || !this.TYPE || !this.STATE) {
            console.error("ColorMapper not properly initialized");
            return { r: 0, g: 0, b: 0 }; // Return black as fallback
        }

        // Handle specialized visualization modes first
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
                // Air color varies slightly with energy (sunlight) - softer blue
                const lightLevel = Math.min(1.0, energy / 150);
                // More subtle sky blue with day/night influence
                r = 140 + Math.floor(lightLevel * 70);
                g = 180 + Math.floor(lightLevel * 40);
                b = 230 + Math.floor(lightLevel * 20);
                // Add slight variation for more natural look
                r += Math.floor(Math.random() * 10) - 5;
                g += Math.floor(Math.random() * 10) - 5;
                b += Math.floor(Math.random() * 10) - 5;
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
                        r = 120 + Math.floor(Math.random() * 15) - 7;
                        g = 85 + Math.floor(Math.random() * 10) - 5;
                        b = 55 + Math.floor(Math.random() * 10) - 5;
                }
                break;

            case this.TYPE.PLANT:
                // Different plant parts have different colors - more natural greens
                switch (state) {
                    case this.STATE.ROOT:
                        // Roots - more natural brownish with water influence
                        r = 140 - Math.floor(water * 0.2) + Math.floor(Math.random() * 10) - 5;
                        g = 100 + Math.floor(water * 0.1) + Math.floor(Math.random() * 10) - 5;
                        b = 60 + Math.floor(Math.random() * 8) - 4;
                        break;
                    case this.STATE.STEM:
                        // Stems - natural green-brown
                        r = 80 + Math.floor(energy * 0.05) + Math.floor(Math.random() * 10) - 5;
                        g = 120 + Math.floor(energy * 0.1) + Math.floor(Math.random() * 15) - 7;
                        b = 50 + Math.floor(Math.random() * 10) - 5;
                        break;
                    case this.STATE.LEAF:
                        // Leaves - more natural muted green with variation
                        // Use both energy and water to influence color
                        const energyFactor = Math.min(1.0, energy / 200);
                        const waterFactor = Math.min(1.0, water / 200);

                        // Base green color
                        r = 40 + Math.floor(waterFactor * 20) + Math.floor(Math.random() * 15) - 7;
                        g = 100 + Math.floor(energyFactor * 40) + Math.floor(Math.random() * 20) - 10;
                        b = 30 + Math.floor(waterFactor * 20) + Math.floor(Math.random() * 10) - 5;

                        // Age variation - older leaves turn more yellow
                        if (Math.random() < 0.2) {
                            r += 20;
                            g -= 10;
                        }
                        break;
                    case this.STATE.FLOWER:
                        // Flowers with more natural color variation
                        if (Math.random() < 0.3) {
                            // White/pale flowers
                            r = 240 + Math.floor(Math.random() * 15);
                            g = 240 + Math.floor(Math.random() * 15);
                            b = 220 + Math.floor(Math.random() * 35);
                        } else if (Math.random() < 0.5) {
                            // Yellow/orange flowers
                            r = 220 + Math.floor(Math.random() * 35);
                            g = 180 + Math.floor(Math.random() * 75);
                            b = 50 + Math.floor(Math.random() * 30);
                        } else {
                            // Pink/purple flowers
                            r = 180 + Math.floor(Math.random() * 75);
                            g = 100 + Math.floor(Math.random() * 40);
                            b = 150 + Math.floor(Math.random() * 105);
                        }
                        break;
                    default:
                        // Default green with variation
                        r = 60 + Math.floor(Math.random() * 20) - 10;
                        g = 120 + Math.floor(Math.random() * 30) - 15;
                        b = 50 + Math.floor(Math.random() * 20) - 10;
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
        // Safety check: ensure we have proper initialization
        if (!this.core || !this.TYPE) {
            console.error("ColorMapper not properly initialized for specialized visualization");
            return { r: 0, g: 0, b: 0 }; // Return black as fallback
        }

        const mode = window.WebGLRenderingSystem.visualizationManager.getMode();

        // Get the relevant property based on visualization mode
        let value = 0;
        let palette = null;

        switch (mode) {
            case 'moisture':
                value = this.core.water[index];
                palette = window.WebGLRenderingSystem.visualizationManager.colorPalettes.moisture;
                break;
            case 'energy':
                value = this.core.energy[index];
                palette = window.WebGLRenderingSystem.visualizationManager.colorPalettes.energy;
                break;
            case 'nutrient':
                value = this.core.nutrient[index];
                palette = window.WebGLRenderingSystem.visualizationManager.colorPalettes.nutrient;
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
        const baseColor = window.WebGLRenderingSystem.visualizationManager.interpolateColor(value, palette);

        // Add small random variation for more natural appearance
        return {
            r: Math.max(0, Math.min(255, baseColor.r + Math.floor(Math.random() * 10) - 5)),
            g: Math.max(0, Math.min(255, baseColor.g + Math.floor(Math.random() * 10) - 5)),
            b: Math.max(0, Math.min(255, baseColor.b + Math.floor(Math.random() * 10) - 5))
        };
    }
};