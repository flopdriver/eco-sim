// Chunk Manager
// Manages the chunking system and coordinates between ecosystem simulation and the chunked optimization

const ChunkManager = {
    // Reference to main controller
    controller: null,

    // Reference to chunked ecosystem
    chunkedEcosystem: null,

    // Chunk dimensions
    chunkSize: 16,
    chunksX: 0,
    chunksY: 0,

    // Enums for type translation
    TYPE: null,
    STATE: null,

    // Debugging
    debugMode: false,

    // Initialize chunk manager
    init: function(controller) {
        console.log("Initializing chunk manager...");
        this.controller = controller;

        // Create ChunkedEcosystem with same dimensions as core simulation
        const width = this.controller.core.width;
        const height = this.controller.core.height;

        this.chunkedEcosystem = new ChunkedEcosystem(width, height, this.chunkSize);

        // Calculate chunk dimensions
        this.chunksX = Math.ceil(width / this.chunkSize);
        this.chunksY = Math.ceil(height / this.chunkSize);

        // Store references to TYPE and STATE enums
        this.TYPE = this.controller.TYPE;
        this.STATE = this.controller.STATE;

        console.log(`Created chunked ecosystem with ${this.chunksX}x${this.chunksY} chunks`);

        return this;
    },

    // Set TYPE enum reference
    setTypeEnum: function(TYPE) {
        this.TYPE = TYPE;
    },

    // Set STATE enum reference
    setStateEnum: function(STATE) {
        this.STATE = STATE;
    },

    // Sync full state from original simulation to chunked system
    initialSync: function() {
        console.log("Performing initial data sync to chunked system...");

        const core = this.controller.core;
        const ecosystem = this.chunkedEcosystem;

        // For each pixel, copy state from core to chunked ecosystem
        for (let y = 0; y < core.height; y++) {
            for (let x = 0; x < core.width; x++) {
                const index = core.getIndex(x, y);

                if (index !== -1) {
                    // Copy type and state
                    ecosystem.typeArray[index] = this.translateType(core.type[index]);
                    ecosystem.stateArray[index] = core.state[index];

                    // Copy resources
                    ecosystem.waterArray[index] = core.water[index];
                    ecosystem.nutrientArray[index] = core.nutrient[index];
                    ecosystem.energyArray[index] = core.energy[index];

                    // Copy metadata
                    ecosystem.metadataArray[index] = core.metadata[index];

                    // Mark as active (if not air)
                    if (core.type[index] !== this.TYPE.AIR) {
                        ecosystem.markChange(x, y);
                    }
                }
            }
        }

        console.log("Initial data sync complete");
    },

    // Translate between simulation TYPE enum and chunked system types
    translateType: function(originalType) {
        // Map from simulation TYPE enum to chunked system types
        switch (originalType) {
            case this.TYPE.AIR:
                return 0; // Air/Empty
            case this.TYPE.WATER:
                return 2; // Water
            case this.TYPE.SOIL:
                return 1; // Soil
            case this.TYPE.PLANT:
                return 3; // Plant
            case this.TYPE.INSECT:
                return 4; // Insect
            case this.TYPE.SEED:
                return 5; // Seed
            case this.TYPE.DEAD_MATTER:
                return 6; // Dead matter
            case this.TYPE.WORM:
                return 7; // Worm
            default:
                return 0; // Default to air
        }
    },

    // Translate back from chunked system types to simulation TYPE enum
    translateTypeBack: function(chunkedType) {
        // Map from chunked system types to simulation TYPE enum
        switch (chunkedType) {
            case 0:
                return this.TYPE.AIR;
            case 1:
                return this.TYPE.SOIL;
            case 2:
                return this.TYPE.WATER;
            case 3:
                return this.TYPE.PLANT;
            case 4:
                return this.TYPE.INSECT;
            case 5:
                return this.TYPE.SEED;
            case 6:
                return this.TYPE.DEAD_MATTER;
            case 7:
                return this.TYPE.WORM;
            default:
                return this.TYPE.AIR;
        }
    },

    // Update the active pixels set based on chunked ecosystem's active chunks
    // Only needed for rendering compatibility
    updateActivePixels: function() {
        // Clear the controller's active pixels set
        this.controller.activePixels.clear();

        // Add all pixels in active chunks to the set (more efficient approach)
        const ecosystem = this.chunkedEcosystem;

        // Only add non-air pixels to active set
        for (let i = 0; i < ecosystem.typeArray.length; i++) {
            if (ecosystem.typeArray[i] !== 0) { // Not air
                this.controller.activePixels.add(i);
            }
        }

        // For debugging, log the number of active pixels
        if (this.debugMode && this.controller.activePixels.size % 100 === 0) {
            console.log(`Active pixels: ${this.controller.activePixels.size}`);
        }
    },

    // Sync changes from chunked system back to original simulation
    // Only needed for rendering compatibility
    syncChangesToCore: function() {
        const ecosystem = this.chunkedEcosystem;
        const core = this.controller.core;

        // For each active chunk, sync changes back to core
        for (const chunkIdx of ecosystem.activeChunks) {
            const cy = Math.floor(chunkIdx / ecosystem.chunksX);
            const cx = chunkIdx % ecosystem.chunksX;

            // Get chunk boundaries
            const startX = cx * ecosystem.chunkSize;
            const startY = cy * ecosystem.chunkSize;
            const endX = Math.min(startX + ecosystem.chunkSize, ecosystem.width);
            const endY = Math.min(startY + ecosystem.chunkSize, ecosystem.height);

            // Check each pixel in chunk for changes
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const index = core.getIndex(x, y);

                    if (index !== -1) {
                        // Always sync pixels in active chunks
                        core.type[index] = this.translateTypeBack(ecosystem.typeArray[index]);
                        core.state[index] = ecosystem.stateArray[index];
                        core.water[index] = ecosystem.waterArray[index];
                        core.nutrient[index] = ecosystem.nutrientArray[index];
                        core.energy[index] = ecosystem.energyArray[index];
                        core.metadata[index] = ecosystem.metadataArray[index];
                    }
                }
            }
        }
    },

    // Update method called from simulation controller
    update: function() {
        // Update the chunked system
        this.chunkedEcosystem.update();

        // Sync changes back to the core simulation for rendering compatibility
        this.syncChangesToCore();

        // Update the active pixels set for rendering
        this.updateActivePixels();
    },

    // Mark a position as changed (e.g., from user interaction)
    markChange: function(x, y) {
        this.chunkedEcosystem.markChange(x, y);
    },

    // Toggle debug mode
    toggleDebug: function() {
        this.debugMode = !this.debugMode;
        console.log(`Chunk debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
    },

    // Helper method to get active chunk count (for performance monitoring)
    getActiveChunkCount: function() {
        return this.chunkedEcosystem.activeChunks.size;
    },

    // Helper method to get total chunk count
    getTotalChunkCount: function() {
        return this.chunksX * this.chunksY;
    }
};