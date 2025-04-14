// Decomposition System
// Handles decay of dead matter and nutrient cycling

export const DecompositionSystem = {
    // Reference to parent biology system
    biology: null,

    // Shorthand references to commonly used objects
    core: null,
    TYPE: null,
    STATE: null,
    
    // Decomposition settings
    decompositionRate: 1.0,  // Global multiplier for decomposition speed

    // Initialize decomposition system
    init: function(biologySystem) {
        this.biology = biologySystem;
        this.core = biologySystem.core;
        this.TYPE = biologySystem.TYPE;
        this.STATE = biologySystem.STATE;

        console.log("Initializing decomposition system...");

        return this;
    },

    // Update all dead matter pixels
    update: function(activePixels, nextActivePixels) {
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.DEAD_MATTER && !this.biology.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);
                this.updateSingleDeadMatter(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Update a single dead matter pixel
    updateSingleDeadMatter: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.biology.processedThisFrame[index] = 1;

        // Dead matter gradually decomposes into nutrients

        // Check if this dead matter has decomposition progress tracked
        if (!this.core.metadata[index]) {
            // Initialize decomposition progress (0-100)
            this.core.metadata[index] = 0;
        }

        // Apply gravity to dead matter - it should gradually settle to the ground
        // REMOVED: This is now handled by the GravitySystem
        /*
        const downIndex = this.core.getIndex(x, y + 1);
        if (downIndex !== -1 && this.core.type[downIndex] === this.TYPE.AIR && Math.random() < 0.3) {
            // Move dead matter downward if there's air below
            this.core.type[downIndex] = this.TYPE.DEAD_MATTER;
            this.core.type[index] = this.TYPE.AIR;
            
            // Transfer properties
            this.core.metadata[downIndex] = this.core.metadata[index];
            this.core.energy[downIndex] = this.core.energy[index];
            this.core.nutrient[downIndex] = this.core.nutrient[index] || 0;
            
            // Mark new position as active and processed
            nextActivePixels.add(downIndex);
            this.biology.processedThisFrame[downIndex] = 1;
            return;
        }
        */
        const downIndex = this.core.getIndex(x, y + 1); // Keep downIndex definition for decomposition logic below

        // Environmental factors that affect decomposition
        let decompositionRate = 1.0; // Base rate

        // Check surrounding pixels for factors that speed up decomposition
        const neighbors = this.core.getNeighborIndices(x, y);
        
        // Count factors that affect decomposition
        let waterCount = 0;
        let wormCount = 0;
        let soilCount = 0;

        for (const neighbor of neighbors) {
            if (this.core.type[neighbor.index] === this.TYPE.WATER) {
                waterCount++;
            } else if (this.core.type[neighbor.index] === this.TYPE.WORM) {
                wormCount++;
            } else if (this.core.type[neighbor.index] === this.TYPE.SOIL) {
                soilCount++;
                // Wet soil speeds up decomposition even more
                if (this.core.state[neighbor.index] === this.STATE.WET) {
                    decompositionRate += 0.2;
                }
            }
        }

        // Water significantly speeds up decomposition
        decompositionRate += waterCount * 0.3;
        
        // Worms dramatically speed up decomposition
        decompositionRate += wormCount * 0.5;
        
        // Contact with soil speeds up decomposition slightly
        decompositionRate += soilCount * 0.1;

        // Advance decomposition based on rate and global decomposition rate
        this.core.metadata[index] += Math.max(1, Math.floor(decompositionRate * this.decompositionRate));

        // Check if decomposition is complete
        if (this.core.metadata[index] >= 100) {
            // Fully decomposed - convert to appropriate type based on position
            if (downIndex !== -1) {
                if (this.core.type[downIndex] === this.TYPE.SOIL) {
                    // If above soil, add nutrients to soil below
                    this.core.nutrient[downIndex] += 20 + Math.floor(Math.random() * 10);
                    this.core.state[downIndex] = this.STATE.FERTILE;
                    this.core.type[index] = this.TYPE.AIR;
                    nextActivePixels.add(downIndex);
                } else if (this.core.type[downIndex] === this.TYPE.WATER) {
                    // If above water, add nutrients to water below
                    this.core.nutrient[downIndex] += 10 + Math.floor(Math.random() * 5);
                    this.core.type[index] = this.TYPE.AIR;
                    nextActivePixels.add(downIndex);
                } else if (this.core.type[downIndex] === this.TYPE.AIR) {
                    // If above air, turn into air. Nutrients dissipate.
                    // Let GravitySystem handle the falling of the original dead matter
                    this.core.type[index] = this.TYPE.AIR;
                    // Optionally: Add some nutrient value to the air or nearby elements if needed
                    // this.core.nutrient[downIndex] += 5; // Example: Add small nutrient to air below
                    // nextActivePixels.add(downIndex); 
                } else {
                    // If above anything else (Plant, another Dead Matter, etc.), turn into AIR
                    // Add nutrients to the object below
                    this.core.nutrient[downIndex] += 15 + Math.floor(Math.random() * 8);
                    this.core.type[index] = this.TYPE.AIR; 
                    nextActivePixels.add(downIndex);
                }
            } else {
                // At the bottom of the world, turn into AIR (or perhaps shallow fertile soil? For now, AIR)
                this.core.type[index] = this.TYPE.AIR;
                // Maybe add nutrients to nearby ground if possible, or just dissipate
            }
            return;
        }

        // Visual change during decomposition - make dead matter look more decomposed
        // By adjusting energy value for visuals (assuming it affects rendering)
        const decompositionProgress = this.core.metadata[index] / 100;
        this.core.energy[index] = Math.max(0, 100 - (decompositionProgress * 100));

        // Dead matter remains active while decomposing
        nextActivePixels.add(index);
    }
};