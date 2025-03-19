// Visualization Manager Module
// Handles visualization modes and visualization-specific settings

window.VisualizationManager = {
    // Current visualization mode
    mode: 'normal', // normal, moisture, energy, nutrient

    // Available visualization modes
    availableModes: ['normal', 'moisture', 'energy', 'nutrient'],

    // Color palettes for different visualization modes
    colorPalettes: {
        // For moisture visualization (blue gradient) - more natural blues
        moisture: [
            { level: 0, color: { r: 240, g: 240, b: 250 } },   // Dry - very pale blue
            { level: 50, color: { r: 176, g: 196, b: 222 } },  // Low moisture - light steel blue
            { level: 100, color: { r: 70, g: 130, b: 180 } },  // Medium moisture - steel blue
            { level: 200, color: { r: 25, g: 25, b: 112 } }    // High moisture - midnight blue
        ],

        // For energy visualization (yellow/orange/red gradient) - more earthy tones
        energy: [
            { level: 0, color: { r: 245, g: 245, b: 220 } },   // Low energy - beige
            { level: 50, color: { r: 210, g: 180, b: 140 } },  // Medium energy - tan
            { level: 150, color: { r: 205, g: 133, b: 63 } },  // High energy - peru
            { level: 250, color: { r: 165, g: 42, b: 42 } }    // Max energy - brown
        ],

        // For nutrient visualization (green gradient) - more natural greens
        nutrient: [
            { level: 0, color: { r: 240, g: 240, b: 230 } },   // Low nutrients - cream
            { level: 50, color: { r: 144, g: 238, b: 144 } },  // Some nutrients - light green
            { level: 100, color: { r: 60, g: 179, b: 113 } },  // Medium nutrients - medium sea green
            { level: 200, color: { r: 34, g: 139, b: 34 } }    // High nutrients - forest green
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
        return this.mode || 'normal';  // Ensure we always return a valid mode
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
    },

    // Get description of current visualization mode
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
    }
};