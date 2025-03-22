// Visualization Manager Module
// Handles visualization modes and visualization-specific settings

window.VisualizationManager = {
    // Current visualization mode - always use normal by default
    mode: 'normal', // normal, moisture, energy, nutrient

    // Available visualization modes
    availableModes: ['normal', 'moisture', 'energy', 'nutrient'],

    // Color palettes for different visualization modes - ENHANCED AESTHETICS
    colorPalettes: {
        // For moisture visualization - beautiful blue-to-cyan gradient with better contrast
        moisture: [
            { level: 0, color: { r: 247, g: 251, b: 255 } },   // Lightest blue-white - bone dry
            { level: 30, color: { r: 198, g: 219, b: 239 } },  // Very light blue - slight moisture
            { level: 60, color: { r: 158, g: 202, b: 225 } },  // Light blue - low moisture
            { level: 100, color: { r: 107, g: 174, b: 214 } }, // Medium blue - medium moisture
            { level: 140, color: { r: 66, g: 146, b: 198 } },  // Deeper blue - high moisture
            { level: 180, color: { r: 33, g: 113, b: 181 } },  // Dark blue - very high moisture
            { level: 220, color: { r: 8, g: 81, b: 156 } },    // Very dark blue - extremely high moisture
            { level: 250, color: { r: 8, g: 48, b: 107 } }     // Darkest blue - saturated
        ],

        // For energy visualization - beautiful yellow-to-orange-to-red gradient
        energy: [
            { level: 0, color: { r: 255, g: 255, b: 229 } },   // Lightest yellow - minimal energy
            { level: 40, color: { r: 255, g: 247, b: 188 } },  // Light yellow - low energy
            { level: 80, color: { r: 254, g: 227, b: 145 } },  // Yellow - some energy
            { level: 120, color: { r: 254, g: 196, b: 79 } },  // Gold - medium energy
            { level: 160, color: { r: 254, g: 153, b: 41 } },  // Orange - high energy
            { level: 200, color: { r: 236, g: 112, b: 20 } },  // Dark orange - very high energy
            { level: 230, color: { r: 204, g: 76, b: 2 } },    // Burnt orange - extremely high energy
            { level: 250, color: { r: 153, g: 52, b: 4 } }     // Dark red-orange - maximum energy
        ],

        // For nutrient visualization - beautiful green gradient
        nutrient: [
            { level: 0, color: { r: 247, g: 252, b: 245 } },   // Lightest green-white - no nutrients
            { level: 30, color: { r: 229, g: 245, b: 224 } },  // Very light green - minimal nutrients
            { level: 60, color: { r: 199, g: 233, b: 192 } },  // Light green - low nutrients
            { level: 90, color: { r: 161, g: 217, b: 155 } },  // Medium-light green - some nutrients
            { level: 120, color: { r: 116, g: 196, b: 118 } }, // Medium green - medium nutrients
            { level: 150, color: { r: 65, g: 171, b: 93 } },   // Medium-dark green - high nutrients
            { level: 180, color: { r: 35, g: 139, b: 69 } },   // Dark green - very high nutrients
            { level: 210, color: { r: 0, g: 109, b: 44 } },    // Very dark green - extremely high nutrients
            { level: 250, color: { r: 0, g: 68, b: 27 } }      // Darkest green - maximum nutrients
        ]
    },

    // Initialize visualization manager
    init: function() {
        console.log("Initializing visualization manager...");
        return this;
    },

    // Set visualization mode
    setMode: function(mode) {
        if (this.availableModes.includes(mode)) {
            this.mode = mode;
            console.log("Visualization mode set to:", mode);
            return true;
        } else {
            console.warn("Unknown visualization mode:", mode);
            return false;
        }
    },

    // Get current visualization mode
    getMode: function() {
        return this.mode;
    },

    // Get description of the current visualization mode
    getModeDescription: function() {
        switch (this.mode) {
            case 'moisture':
                return 'Showing water content: darker blue indicates higher moisture levels';
            case 'energy':
                return 'Showing energy levels: brighter colors indicate higher energy';
            case 'nutrient':
                return 'Showing nutrient density: darker green indicates higher nutrients';
            case 'normal':
            default:
                return 'Normal view: showing natural appearance of all elements';
        }
    },

    // Get color palette for current mode
    getCurrentPalette: function() {
        if (this.mode === 'normal') {
            return null; // Normal mode doesn't use palettes
        }
        return this.colorPalettes[this.mode];
    },

    // Interpolate between colors in a palette based on a value
    interpolateColor: function(value, palette) {
        // Find the two colors to interpolate between
        let lowerColor = palette[0].color;
        let upperColor = palette[palette.length - 1].color;
        let lowerLevel = palette[0].level;
        let upperLevel = palette[palette.length - 1].level;

        for (let i = 0; i < palette.length - 1; i++) {
            if (value >= palette[i].level && value <= palette[i+1].level) {
                lowerColor = palette[i].color;
                upperColor = palette[i+1].color;
                lowerLevel = palette[i].level;
                upperLevel = palette[i+1].level;
                break;
            }
        }

        // Calculate interpolation factor (0-1)
        const range = upperLevel - lowerLevel;
        const factor = range === 0 ? 0 : (value - lowerLevel) / range;

        // Interpolate RGB values
        return {
            r: Math.floor(lowerColor.r + factor * (upperColor.r - lowerColor.r)),
            g: Math.floor(lowerColor.g + factor * (upperColor.g - lowerColor.g)),
            b: Math.floor(lowerColor.b + factor * (upperColor.b - lowerColor.b))
        };
    }
};