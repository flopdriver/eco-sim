// Core Simulation Module
// Manages the fundamental data structures for the pixel ecosystem simulation

const CoreSimulation = {
    // Grid dimensions and settings
    width: 400,
    height: 300,
    pixelSize: 1,
    size: 120000, // width * height

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

    // Cache for soil line heights
    soilLineHeights: null,
    soilLineLastUpdated: 0,
    soilLineUpdateFrequency: 60, // Increased from default to reduce updates
    soilLineCache: new Map(), // Cache for soil line calculations
    
    // Initialize core systems
    init: function(canvasWidth, canvasHeight) {
        console.log("Initializing core simulation data structures...");

        // If canvas dimensions are provided, adjust the grid size to match the aspect ratio
        if (canvasWidth && canvasHeight) {
            console.log(`Adjusting grid dimensions based on canvas size: ${canvasWidth}x${canvasHeight}`);
            // Maintain a reasonable pixel count for performance
            const targetPixelCount = 120000; // Our target size
            
            // Calculate dimensions that match canvas aspect ratio
            const aspectRatio = canvasWidth / canvasHeight;
            this.height = Math.floor(Math.sqrt(targetPixelCount / aspectRatio));
            this.width = Math.floor(this.height * aspectRatio);
            
            // Safety check - ensure reasonable minimum dimensions
            this.width = Math.max(200, this.width);
            this.height = Math.max(150, this.height);
            
            // Update the size
            this.size = this.width * this.height;
            
            console.log(`Adjusted grid dimensions to: ${this.width}x${this.height} (total: ${this.size} pixels)`);
        } else {
            console.log(`Using default grid dimensions: ${this.width}x${this.height}`);
        }

        // Initialize TYPE and STATE enums if not already set
        if (!this.TYPE) {
            this.TYPE = {
                AIR: 0,
                WATER: 1,
                SOIL: 2,
                PLANT: 3,
                INSECT: 4,
                SEED: 5,
                DEAD_MATTER: 6,
                WORM: 7
            };
        }

        if (!this.STATE) {
            this.STATE = {
                DEFAULT: 0,
                WET: 1,
                DRY: 2,
                FERTILE: 3,
                ROOT: 4,
                STEM: 5,
                LEAF: 6,
                FLOWER: 7,
                LARVA: 8,
                ADULT: 9,
                DECOMPOSING: 10,
                CLAY: 11,     // Clay soil type (poor drainage)
                SANDY: 12,    // Sandy soil type (good drainage)
                LOAMY: 13,    // Loamy soil type (balanced retention and drainage)
                ROCKY: 14     // Rocky soil type (excellent drainage, poor retention)
            };
        }

        // Initialize arrays
        this.type = new Uint8Array(this.size);
        this.state = new Uint8Array(this.size);
        this.water = new Uint8Array(this.size);
        this.nutrient = new Uint8Array(this.size);
        this.energy = new Uint8Array(this.size);
        this.cloud = new Uint8Array(this.size);
        this.metadata = new Uint8Array(this.size);
        this.soilLineHeights = new Int16Array(this.width);
        this.soilLineCache = new Map();
        
        // Initialize all pixels to air
        this.type.fill(this.TYPE.AIR);
        
        // Initialize other arrays to 0
        this.nutrient.fill(0);
        this.energy.fill(0);
        this.water.fill(0);
        this.state.fill(this.STATE.DEFAULT);
        this.metadata.fill(0);
        
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
    
    // Get soil height for a specific x coordinate
    getSoilHeight: function(x, frameCount) {
        // Check cache first
        if (this.soilLineCache.has(x)) {
            const cached = this.soilLineCache.get(x);
            if (frameCount - cached.frame < this.soilLineUpdateFrequency) {
                return cached.height;
            }
        }

        // If not in cache or cache expired, calculate
        const height = this.calculateSoilHeight(x);
        
        // Update cache
        this.soilLineCache.set(x, {
            height: height,
            frame: frameCount
        });

        return height;
    },

    // Calculate soil height for a specific x coordinate
    calculateSoilHeight: function(x) {
        // Start from the top and go down
        for (let y = 0; y < this.height; y++) {
            const index = this.getIndex(x, y);
            if (index !== -1 && this.type[index] === this.TYPE.SOIL) {
                return y;
            }
        }
        
        // If no soil found, use default value
        return this.getDefaultSoilHeight();
    },

    // Update soil line heights
    updateSoilLineHeights: function(frameCount) {
        // Only update periodically to save performance
        if (frameCount - this.soilLineLastUpdated < this.soilLineUpdateFrequency && this.soilLineLastUpdated > 0) {
            return this.soilLineHeights;
        }
        
        // Reset heights
        for (let x = 0; x < this.width; x++) {
            this.soilLineHeights[x] = -1;
        }
        
        // For each column, find the topmost soil pixel
        for (let x = 0; x < this.width; x++) {
            this.soilLineHeights[x] = this.calculateSoilHeight(x);
        }
        
        // Smooth the soil line to prevent sharp spikes
        this.smoothSoilLine();
        
        // Update the last update frame
        this.soilLineLastUpdated = frameCount;
        
        return this.soilLineHeights;
    },
    
    // Smooth the soil line to prevent sharp edges
    smoothSoilLine: function() {
        const tempHeights = new Int16Array(this.soilLineHeights);
        
        // Apply a simple smoothing algorithm
        for (let x = 1; x < this.width - 1; x++) {
            // If the current column is too different from its neighbors, smooth it
            const left = this.soilLineHeights[x - 1];
            const right = this.soilLineHeights[x + 1];
            const current = this.soilLineHeights[x];
            
            // Only smooth if the difference is too large
            if (Math.abs(current - left) > 3 || Math.abs(current - right) > 3) {
                tempHeights[x] = Math.floor((left + right + current) / 3);
            }
        }
        
        // Copy back the smoothed values
        for (let x = 1; x < this.width - 1; x++) {
            this.soilLineHeights[x] = tempHeights[x];
        }
    },
    
    // Get the default soil height (the previous hard-coded value)
    getDefaultSoilHeight: function() {
        return Math.floor(this.height * 0.6);
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

// Make CoreSimulation available for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoreSimulation;
}