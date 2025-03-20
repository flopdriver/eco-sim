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

        console.log(`Created chunked ecosystem with ${this.chunksX}x${this.chunksY} chunks`);

        return this;
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
                    if (core.type[index] !== this.controller.TYPE.AIR) {
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
            case this.controller.TYPE.AIR:
                return 0; // Air/Empty
            case this.controller.TYPE.WATER:
                return 2; // Water
            case this.controller.TYPE.SOIL:
                return 1; // Soil
            case this.controller.TYPE.PLANT:
                return 3; // Plant
            case this.controller.TYPE.INSECT:
                return 4; // Insect
            case this.controller.TYPE.SEED:
                return 5; // Seed
            case this.controller.TYPE.DEAD_MATTER:
                return 6; // Dead matter
            case this.controller.TYPE.WORM:
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
                return this.controller.TYPE.AIR;
            case 1:
                return this.controller.TYPE.SOIL;
            case 2:
                return this.controller.TYPE.WATER;
            case 3:
                return this.controller.TYPE.PLANT;
            case 4:
                return this.controller.TYPE.INSECT;
            case 5:
                return this.controller.TYPE.SEED;
            case 6:
                return this.controller.TYPE.DEAD_MATTER;
            case 7:
                return this.controller.TYPE.WORM;
            default:
                return this.controller.TYPE.AIR;
        }
    },

    // Update the active pixels set based on chunked ecosystem's active chunks
    updateActivePixels: function() {
        // Clear the controller's active pixels set
        this.controller.activePixels.clear();

        // Add all pixels in active chunks to the set
        const ecosystem = this.chunkedEcosystem;

        for (const chunkIdx of ecosystem.activeChunks) {
            const cy = Math.floor(chunkIdx / ecosystem.chunksX);
            const cx = chunkIdx % ecosystem.chunksX;

            // Get chunk boundaries
            const startX = cx * ecosystem.chunkSize;
            const startY = cy * ecosystem.chunkSize;
            const endX = Math.min(startX + ecosystem.chunkSize, ecosystem.width);
            const endY = Math.min(startY + ecosystem.chunkSize, ecosystem.height);

            // Add all pixels in chunk to active set
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const index = this.controller.core.getIndex(x, y);
                    if (index !== -1) {
                        this.controller.activePixels.add(index);
                    }
                }
            }
        }

        // For debugging, log the number of active pixels
        if (this.debugMode) {
            console.log(`Active pixels: ${this.controller.activePixels.size}`);
        }
    },

    // Sync changes from chunked system back to original simulation
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
                        // Always sync pixels in active chunks, not just those with changes marked
                        // This ensures all simulation state gets properly synchronized
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

        // Sync changes back to the core simulation
        this.syncChangesToCore();

        // Update the active pixels set for other systems
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