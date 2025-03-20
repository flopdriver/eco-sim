// Core Simulation Module
// Manages the fundamental data structures for the pixel ecosystem simulation

const CoreSimulation = {
    // Grid dimensions and settings
    width: 400,
    height: 300,
    pixelSize: 3,
    size: 0, // Will be calculated as width * height

    // Type and state enums (will be populated by controller)
    TYPE: null,
    STATE: null,

    // Data arrays
    type: null,     // Pixel type (air, water, soil, plant, etc.)
    state: null,    // Pixel state (default, wet, dry, stem, leaf, etc.)
    water: null,    // Water content (0-255)
    nutrient: null, // Nutrient content (0-255)
    energy: null,   // Energy/light level (0-255)
    metadata: null, // Additional data for complex behaviors
    cloud: null,    // Cloud data (0-255 for density)

    // Initialize core systems
    init: function() {
        console.log("Initializing core simulation data structures...");

        // Calculate total size
        this.size = this.width * this.height;

        // Create typed arrays for performance
        this.type = new Uint8Array(this.size);
        this.state = new Uint8Array(this.size);
        this.water = new Uint8Array(this.size);
        this.nutrient = new Uint8Array(this.size);
        this.energy = new Uint8Array(this.size);
        this.metadata = new Uint8Array(this.size);
        this.cloud = new Uint8Array(this.size);

        return this;
    },

    // Get index from coordinates with boundary checking
    getIndex: function(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return -1; // Out of bounds
        }
        return y * this.width + x;
    },

    // Get coordinates from index
    getCoords: function(index) {
        if (index < 0 || index >= this.size) {
            return null; // Invalid index
        }
        const x = index % this.width;
        const y = Math.floor(index / this.width);
        return { x, y };
    },

    // Get all neighboring indices of a position (including diagonals)
    getNeighborIndices: function(x, y) {
        const neighbors = [];

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue; // Skip self

                const nx = x + dx;
                const ny = y + dy;
                const index = this.getIndex(nx, ny);

                if (index !== -1) {
                    neighbors.push({
                        x: nx,
                        y: ny,
                        index: index,
                        diagonal: dx !== 0 && dy !== 0
                    });
                }
            }
        }

        return neighbors;
    },

    // Get vertical neighbors (up, down)
    getVerticalNeighbors: function(x, y) {
        const neighbors = [];

        const directions = [
            {dx: 0, dy: -1}, // Up
            {dx: 0, dy: 1}   // Down
        ];

        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            const index = this.getIndex(nx, ny);

            if (index !== -1) {
                neighbors.push({
                    x: nx,
                    y: ny,
                    index: index,
                    direction: dir.dy < 0 ? 'up' : 'down'
                });
            }
        }

        return neighbors;
    },

    // Get horizontal neighbors (left, right)
    getHorizontalNeighbors: function(x, y) {
        const neighbors = [];

        const directions = [
            {dx: -1, dy: 0}, // Left
            {dx: 1, dy: 0}   // Right
        ];

        for (const dir of directions) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            const index = this.getIndex(nx, ny);

            if (index !== -1) {
                neighbors.push({
                    x: nx,
                    y: ny,
                    index: index,
                    direction: dir.dx < 0 ? 'left' : 'right'
                });
            }
        }

        return neighbors;
    },

    // Swap two pixels (swap all properties)
    swapPixels: function(index1, index2) {
        // Skip if either index is invalid
        if (index1 === -1 || index2 === -1 || index1 === index2) return false;

        // Temporary storage for the first pixel's properties
        const tempType = this.type[index1];
        const tempState = this.state[index1];
        const tempWater = this.water[index1];
        const tempNutrient = this.nutrient[index1];
        const tempEnergy = this.energy[index1];
        const tempMetadata = this.metadata[index1];

        // Copy properties from second pixel to first
        this.type[index1] = this.type[index2];
        this.state[index1] = this.state[index2];
        this.water[index1] = this.water[index2];
        this.nutrient[index1] = this.nutrient[index2];
        this.energy[index1] = this.energy[index2];
        this.metadata[index1] = this.metadata[index2];

        // Copy properties from temporary storage to second pixel
        this.type[index2] = tempType;
        this.state[index2] = tempState;
        this.water[index2] = tempWater;
        this.nutrient[index2] = tempNutrient;
        this.energy[index2] = tempEnergy;
        this.metadata[index2] = tempMetadata;

        return true;
    },

    // Clear a pixel (set to air with no properties)
    clearPixel: function(index) {
        if (index === -1) return false;

        this.type[index] = this.TYPE.AIR;
        this.state[index] = this.STATE.DEFAULT;
        this.water[index] = 0;
        this.nutrient[index] = 0;
        this.energy[index] = 0;
        this.metadata[index] = 0;

        return true;
    },

    // Check if pixel is of certain type
    isType: function(index, type) {
        if (index === -1) return false;
        return this.type[index] === type;
    },

    // Check if pixel is in certain state
    isState: function(index, state) {
        if (index === -1) return false;
        return this.state[index] === state;
    },

    // Find all pixels of a certain type
    findPixelsOfType: function(type) {
        const indices = [];

        for (let i = 0; i < this.size; i++) {
            if (this.type[i] === type) {
                indices.push(i);
            }
        }

        return indices;
    },

    // Count pixels of a certain type
    countPixelsOfType: function(type) {
        let count = 0;

        for (let i = 0; i < this.size; i++) {
            if (this.type[i] === type) {
                count++;
            }
        }

        return count;
    }
};