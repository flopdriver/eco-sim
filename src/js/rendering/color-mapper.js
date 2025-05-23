// Color Mapper Module
// Handles color mapping between simulation data and rendered pixels
import { VisualizationManager } from './visualization-manager.js';
import { PlantSystem } from '../biology/plant/plant-system.js';

export const ColorMapper = {
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
            // Find the corresponding cloud pixel to determine the layer
            const cloudColors = {
                upper: { r: 250, g: 250, b: 255 }, // Brighter, whiter for upper layer
                lower: { r: 220, g: 225, b: 240 }  // Slightly darker, hint of blue for lower layer
            };
            
            // Default cloud color if we can't determine the layer
            let cloudColor = {
                r: 240,
                g: 240,
                b: 250
            };
            
            // Try to determine which cloud layer this pixel belongs to
            if (this.weatherSystem && this.weatherSystem.cloudProperties.cloudPixels) {
                const coords = this.core.getCoords(index);
                if (coords) {
                    // Find a matching cloud pixel
                    for (const cloudPixel of this.weatherSystem.cloudProperties.cloudPixels) {
                        if (Math.floor(cloudPixel.x) === coords.x && cloudPixel.y === coords.y) {
                            // Use the layer-specific color if available
                            if (cloudPixel.layer && cloudColors[cloudPixel.layer]) {
                                cloudColor = cloudColors[cloudPixel.layer];
                            }
                            break;
                        }
                    }
                }
            }
            
            // Add slight variation to avoid uniform appearance
            return {
                r: cloudColor.r + Math.floor(Math.random() * 5) - 2,
                g: cloudColor.g + Math.floor(Math.random() * 5) - 2,
                b: cloudColor.b + Math.floor(Math.random() * 5) - 2
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
                        // Get age info for darkening
                        const rootAge = PlantSystem.plantAges[index] || 1;
                        const rootAgeFactor = Math.min(0.5, rootAge / 500); // Max 50% darkening at age 500
                        
                        // Roots - BRIGHTENED COLORS for better visibility against soil
                        // Cap the water influence to prevent blue tinting with high water levels
                        const cappedWater = Math.min(100, water); // Cap water value at 100 for color calculation
                        r = 160 - Math.floor(cappedWater * 0.15) + Math.floor(Math.random() * 10) - 5; // Reduced water influence
                        g = 120 + Math.floor(cappedWater * 0.05) + Math.floor(Math.random() * 10) - 5; // Reduced water influence
                        b = 65 + Math.floor(Math.random() * 8) - 4; // Fixed base value, reduced from 80
                        
                        // Darken based on age
                        r = Math.floor(r * (1 - rootAgeFactor));
                        g = Math.floor(g * (1 - rootAgeFactor));
                        b = Math.floor(b * (1 - rootAgeFactor));
                        break;
                    case this.STATE.STEM:
                        // Get age info for darkening
                        const stemAge = PlantSystem.plantAges[index] || 1;
                        const stemAgeFactor = Math.min(0.45, stemAge / 600); // Max 45% darkening at age 600
                        
                        // Check for metadata about plant species
                        // For stems we'll use metadata to check for trunk/species type
                        const metadata = this.core.metadata[index];
                        
                        // Get plant group ID to check for species
                        let speciesIndex = -1;
                        let plantGroupId = null;
                        if (PlantSystem.plantGroups && PlantSystem.plantGroups[index]) {
                            plantGroupId = PlantSystem.plantGroups[index];
                            if (PlantSystem.plantSpeciesMap && PlantSystem.plantSpeciesMap[plantGroupId] !== undefined) {
                                speciesIndex = PlantSystem.plantSpeciesMap[plantGroupId];
                            }
                        }
                        
                        // Check if this is a trunk part as marked in metadata
                        // We now have different trunk thickness values (50-70) instead of just 100
                        const trunkValue = metadata >= 50 && metadata < 80 ? metadata : 0;
                        const isTrunk = trunkValue >= 50;
                        const trunkThickness = isTrunk ? (trunkValue - 50) / 20 : 0; // 0-1 scale for thickness
                        
                        if (isTrunk) {
                            // Trunk - BROWN STEM color with varying thickness
                            // Skinnier trunks are slightly more reddish-brown
                            r = 130 + Math.floor(Math.random() * 15) - 5 - Math.floor(trunkThickness * 20); // Thicker = less red
                            g = 85 + Math.floor(Math.random() * 10) - 5 - Math.floor(trunkThickness * 15);  // Thicker = less green
                            b = 45 + Math.floor(Math.random() * 8) - 4 - Math.floor(trunkThickness * 10);   // Thicker = less blue
                            
                            // Adjust trunk color based on species if available
                            if (speciesIndex >= 0 && PlantSystem.plantSpecies) {
                                const species = PlantSystem.plantSpecies[speciesIndex];
                                if (species) {
                                    // Modify trunk color based on species stem color
                                    switch (species.stemColor) {
                                        case "green": // Bright green stems - more green in trunk
                                            g += 20;
                                            break;
                                        case "brown": // Brown stems - standard
                                            // No change - default brown
                                            break;
                                        case "darkgreen": // Dark green stems - darker green-brown
                                            r -= 15;
                                            g += 10;
                                            break;
                                        case "reddish": // Reddish stems - more red in trunk
                                            r += 25;
                                            g -= 10;
                                            break;
                                        case "yellow": // Yellowish stems - more yellow in trunk
                                            r += 15;
                                            g += 15;
                                            break;
                                        case "purple": // Purplish stems - subtle purple tint
                                            r += 10;
                                            b += 15;
                                            break;
                                    }
                                }
                            }
                            
                            // Add some subtle variation for bendiness
                            if (Math.random() < 0.3) {
                                r += Math.floor(Math.random() * 10);
                                g += Math.floor(Math.random() * 8);
                            }
                            
                            // Darken based on age to simulate hardening wood
                            const trunkAgeFactor = Math.min(0.3, stemAge / 800); // Slower darkening
                            r = Math.floor(r * (1 - trunkAgeFactor * 0.5));
                            g = Math.floor(g * (1 - trunkAgeFactor * 0.6));
                            b = Math.floor(b * (1 - trunkAgeFactor * 0.7));
                        } else {
                            // Regular stems - Set BASE COLOR based on species
                            let baseRed = 65;
                            let baseGreen = 160;
                            let baseBlue = 65;
                            
                            // Apply species-specific stem color if available
                            if (speciesIndex >= 0 && PlantSystem.plantSpecies) {
                                const species = PlantSystem.plantSpecies[speciesIndex];
                                if (species) {
                                    switch (species.stemColor) {
                                        case "green": // Bright green stems 
                                            baseRed = 60;
                                            baseGreen = 180;
                                            baseBlue = 70;
                                            break;
                                        case "brown": // Brown stems
                                            baseRed = 110;
                                            baseGreen = 80;
                                            baseBlue = 45;
                                            break;
                                        case "darkgreen": // Dark green stems
                                            baseRed = 50;
                                            baseGreen = 120;
                                            baseBlue = 60;
                                            break;
                                        case "reddish": // Reddish stems
                                            baseRed = 120;
                                            baseGreen = 70;
                                            baseBlue = 55;
                                            break;
                                        case "yellow": // Yellowish stems
                                            baseRed = 150;
                                            baseGreen = 150;
                                            baseBlue = 60;
                                            break;
                                        case "purple": // Purplish stems
                                            baseRed = 100;
                                            baseGreen = 80;
                                            baseBlue = 120;
                                            break;
                                    }
                                }
                            }
                            
                            // Apply energy and randomization
                            r = baseRed + Math.floor(energy * 0.05) + Math.floor(Math.random() * 10) - 5;
                            g = baseGreen + Math.floor(energy * 0.1) + Math.floor(Math.random() * 15) - 7;
                            b = baseBlue + Math.floor(Math.random() * 10) - 5;
                            
                            // Darken based on age - stems get more brown as they age
                            r = Math.floor(r * (1 - stemAgeFactor * 0.6)); // Less darkening for red (becoming more brown)
                            g = Math.floor(g * (1 - stemAgeFactor));
                            b = Math.floor(b * (1 - stemAgeFactor));
                        }
                        break;
                    case this.STATE.LEAF:
                        // Get age info for darkening/yellowing
                        const leafAge = PlantSystem.plantAges[index] || 1;
                        const leafAgeFactor = Math.min(0.7, leafAge / 400); // Max 70% effect at age 400
                        
                        // Get leaf metadata to determine color variation if available
                        const leafMetadata = this.core.metadata[index] || 0;
                        // Extract shape type (high 4 bits) and color variation (low 4 bits)
                        const leafShape = (leafMetadata >> 4) & 0xF; // 0-5 shape types
                        const leafColorVar = leafMetadata & 0xF; // 0-4 color variations
                        
                        // Leaf color based on plant species and color variation
                        let baseRed = 30;
                        let baseGreen = 170;
                        let baseBlue = 40;
                        
                        // Adjust base color based on leaf type/species
                        switch (leafColorVar) {
                            case 0: // Vibrant green (jungle_vine)
                                baseRed = 30;
                                baseGreen = 190;
                                baseBlue = 45;
                                break;
                            case 1: // Deep green (tropical_palm)
                                baseRed = 20;
                                baseGreen = 140;
                                baseBlue = 40;
                                break;
                            case 2: // Forest green (fern)
                                baseRed = 25;
                                baseGreen = 120;
                                baseBlue = 35;
                                break;
                            case 3: // Pale green with blue tint (succulent)
                                baseRed = 45;
                                baseGreen = 160;
                                baseBlue = 85;
                                break;
                            case 4: // Light green (bamboo)
                                baseRed = 60;
                                baseGreen = 180;
                                baseBlue = 50;
                                break;
                        }
                        
                        // Leaf shape also influences color - adjust for uniqueness
                        if (leafShape === 0) { // Heart shape (slightly redder)
                            baseRed += 15;
                        } else if (leafShape === 1) { // Fan shape (slightly more yellow)
                            baseRed += 10;
                            baseGreen += 15;
                        } else if (leafShape === 2) { // Frond shape (deeper green)
                            baseGreen -= 10;
                        } else if (leafShape === 3) { // Round shape (more blue-green)
                            baseBlue += 15;
                        } else if (leafShape === 4) { // Pointed shape (yellower)
                            baseRed += 15;
                            baseGreen += 20;
                        } else if (leafShape === 5) { // Oval shape (balanced)
                            // No adjustment
                        }
                        
                        // Use both energy and water to influence color
                        const energyFactor = Math.min(1.0, energy / 200);
                        const waterFactor = Math.min(1.0, water / 200);

                        // Apply base color with energy and water influence - MORE CONTRAST
                        r = baseRed + Math.floor(waterFactor * 20) + Math.floor(Math.random() * 15) - 7;
                        g = baseGreen + Math.floor(energyFactor * 40) + Math.floor(Math.random() * 20) - 10;
                        b = baseBlue + Math.floor(waterFactor * 20) + Math.floor(Math.random() * 10) - 5;

                        // Age variation - older leaves turn more yellow then brown
                        if (leafAgeFactor > 0.1) {
                            // Progressively yellowing and browning with age
                            r += Math.floor(80 * leafAgeFactor); // Red increases (yellow/brown)
                            g -= Math.floor(70 * (leafAgeFactor - 0.1)); // Green decreases (browning)
                            b -= Math.floor(20 * leafAgeFactor); // Blue decreases slightly
                        }
                        break;
                    case this.STATE.FLOWER:
                        // Get age info for flower
                        const flowerAge = PlantSystem.plantAges[index] || 1;
                        const flowerAgeFactor = Math.min(0.8, flowerAge / 300); // Max 80% effect at age 300
                        
                        // Enhanced flower visualization with distinct petal and center colors
                        // Get metadata to determine flower type and color variation
                        const flowerMetadata = this.core.metadata[index] || 0;
                        // Extract flower type (high 4 bits) and color variation (low 4 bits)
                        const flowerType = (flowerMetadata >> 4) & 0xF; // 0-5 flower types
                        const colorVar = flowerMetadata & 0xF; // 0-4 color variations
                        
                        // Get coordinates for additional variation
                        const coords = this.core.getCoords(index);
                        
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
                        
                        // Define base colors for different flower types
                        const flowerColors = [
                            { name: "daisy", center: { r: 230, g: 200, b: 50 }, petal: { r: 250, g: 250, b: 250 } },
                            { name: "rose", center: { r: 180, g: 40, b: 60 }, petal: { r: 220, g: 60, b: 100 } },
                            { name: "tulip", center: { r: 200, g: 150, b: 40 }, petal: { r: 230, g: 50, b: 80 } },
                            { name: "sunflower", center: { r: 130, g: 80, b: 20 }, petal: { r: 250, g: 230, b: 30 } },
                            { name: "orchid", center: { r: 140, g: 40, b: 180 }, petal: { r: 200, g: 80, b: 230 } },
                            { name: "lily", center: { r: 230, g: 180, b: 200 }, petal: { r: 250, g: 250, b: 240 } }
                        ];
                        
                        // Get base colors for this flower type
                        const flowerTypeIndex = Math.min(flowerType, flowerColors.length - 1);
                        let baseColor = isCenter ? 
                            { r: flowerColors[flowerTypeIndex].center.r, g: flowerColors[flowerTypeIndex].center.g, b: flowerColors[flowerTypeIndex].center.b } :
                            { r: flowerColors[flowerTypeIndex].petal.r, g: flowerColors[flowerTypeIndex].petal.g, b: flowerColors[flowerTypeIndex].petal.b };
                        
                        // Apply color variation
                        let hueShift = 0;
                        let satShift = 0;
                        
                        switch (colorVar) {
                            case 0: // Standard
                                // No shift
                                break;
                            case 1: // Pastel variant
                                // Lighter, less saturated
                                if (!isCenter) {
                                    baseColor.r = Math.min(255, baseColor.r + 20);
                                    baseColor.g = Math.min(255, baseColor.g + 20);
                                    baseColor.b = Math.min(255, baseColor.b + 20);
                                }
                                break;
                            case 2: // Vibrant variant
                                // More saturated
                                if (baseColor.r > baseColor.g && baseColor.r > baseColor.b) { // Red dominant
                                    baseColor.r = Math.min(255, baseColor.r + 20);
                                    baseColor.g = Math.max(0, baseColor.g - 20);
                                    baseColor.b = Math.max(0, baseColor.b - 20);
                                } else if (baseColor.g > baseColor.r && baseColor.g > baseColor.b) { // Green dominant
                                    baseColor.r = Math.max(0, baseColor.r - 20);
                                    baseColor.g = Math.min(255, baseColor.g + 20);
                                    baseColor.b = Math.max(0, baseColor.b - 20);
                                } else if (baseColor.b > baseColor.r && baseColor.b > baseColor.g) { // Blue dominant
                                    baseColor.r = Math.max(0, baseColor.r - 20);
                                    baseColor.g = Math.max(0, baseColor.g - 20);
                                    baseColor.b = Math.min(255, baseColor.b + 20);
                                }
                                break;
                            case 3: // Dark variant
                                // Darker, more intense
                                baseColor.r = Math.max(0, baseColor.r - 30);
                                baseColor.g = Math.max(0, baseColor.g - 30);
                                baseColor.b = Math.max(0, baseColor.b - 30);
                                break;
                            case 4: // Exotic variant - complementary colors
                                // Shift hue dramatically for exotic variants
                                if (!isCenter) {
                                    // Inverted complementary colors for petals
                                    if (baseColor.r > 200 && baseColor.g > 200) { // White/yellow -> purple
                                        baseColor.r = 180;
                                        baseColor.g = 60;
                                        baseColor.b = 220;
                                    } else if (baseColor.r > 200) { // Red -> cyan
                                        baseColor.r = 60;
                                        baseColor.g = 200;
                                        baseColor.b = 220;
                                    } else if (baseColor.g > 200) { // Green -> magenta
                                        baseColor.r = 220;
                                        baseColor.g = 60;
                                        baseColor.b = 180;
                                    } else if (baseColor.b > 200) { // Blue -> yellow
                                        baseColor.r = 240;
                                        baseColor.g = 220;
                                        baseColor.b = 40;
                                    }
                                }
                                break;
                        }
                        
                        // Apply base colors with some random variation
                        r = baseColor.r + Math.floor(Math.random() * 20) - 10;
                        g = baseColor.g + Math.floor(Math.random() * 20) - 10;
                        b = baseColor.b + Math.floor(Math.random() * 20) - 10;
                        
                        // Age effect for flowers - they fade and brown over time
                        if (flowerAgeFactor > 0.2) {
                            // First stage - slight fading
                            if (flowerAgeFactor < 0.5) {
                                const fadeFactor = (flowerAgeFactor - 0.2) * 2; // 0-0.6
                                // Reduce saturation by moving colors toward gray
                                const avg = (r + g + b) / 3;
                                r = Math.floor(r * (1 - fadeFactor) + avg * fadeFactor);
                                g = Math.floor(g * (1 - fadeFactor) + avg * fadeFactor);
                                b = Math.floor(b * (1 - fadeFactor) + avg * fadeFactor);
                            } 
                            // Second stage - browning
                            else {
                                const brownFactor = (flowerAgeFactor - 0.5) * 2; // 0-0.6
                                // Move toward brown
                                r = Math.floor(r * (1 - brownFactor) + 120 * brownFactor);
                                g = Math.floor(g * (1 - brownFactor) + 80 * brownFactor);
                                b = Math.floor(b * (1 - brownFactor) + 40 * brownFactor);
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
        const palette = VisualizationManager.getCurrentPalette();

        if (!palette) {
            console.warn(`No palette found for mode: ${mode}`);
            return { r: 0, g: 0, b: 0 }; // Black for unknown mode
        }

        // Special case for air - always show as very transparent in special modes
        if (this.core.type[index] === this.TYPE.AIR) {
            // Add slight variation for more natural look
            const variation = Math.floor(Math.random() * 10) - 5;
            return { r: 235 + variation, g: 235 + variation, b: 235 + variation };
        }

        // Get the relevant property based on visualization mode
        let value = 0;

        switch (mode) {
            case 'moisture':
                value = this.core.water[index];
                break;
            case 'energy':
                value = this.core.energy[index];
                break;
            case 'nutrient':
                value = this.core.nutrient[index];
                break;
            default:
                return { r: 0, g: 0, b: 0 }; // Black for unknown mode
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