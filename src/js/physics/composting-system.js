// Composting System
// Handles the decomposition of dead matter into rich soil

export const CompostingSystem = {
    // Reference to parent physics system
    physics: null,
    
    // Composting settings
    decompositionRate: 0.05,  // Base rate of decomposition
    nutrientMultiplier: 2.0,  // How much nutrients are added from decomposition
    
    // Initialize composting system
    init: function(physicsSystem) {
        this.physics = physicsSystem;
        console.log("Initializing composting system...");
        return this;
    },
    
    // Update composting processes
    updateComposting: function(activePixels, nextActivePixels) {
        // Process dead matter and its impact on soil
        activePixels.forEach(index => {
            // Process dead matter decomposition
            if (this.physics.core.type[index] === this.physics.TYPE.DEAD_MATTER) {
                this.processDeadMatterDecomposition(index, nextActivePixels);
            }
            
            // Process soil that's adjacent to dead matter - it gradually becomes composted
            else if (this.physics.core.type[index] === this.physics.TYPE.SOIL &&
                    this.physics.core.state[index] !== this.physics.STATE.COMPOSTED) {
                this.checkForAdjacentDeadMatter(index, nextActivePixels);
            }
        });
    },
    
    // Process decomposition of dead matter
    processDeadMatterDecomposition: function(index, nextActivePixels) {
        // Skip if already processed this frame
        if (this.physics.processedThisFrame[index]) return;
        this.physics.processedThisFrame[index] = 1;
        
        // Get the decomposition state (stored in metadata)
        // Metadata will be percentage decomposed (0-100)
        const decompositionState = this.physics.core.metadata[index] || 0;
        
        // Check if in contact with soil (decomposes faster)
        const coords = this.physics.core.getCoords(index);
        const neighbors = this.physics.core.getNeighborIndices(coords.x, coords.y);
        
        let touchingSoil = false;
        let soilNeighborIndices = [];
        let waterContent = this.physics.core.water[index];
        
        // Check for neighboring soil
        for (const neighbor of neighbors) {
            if (this.physics.core.type[neighbor.index] === this.physics.TYPE.SOIL) {
                touchingSoil = true;
                soilNeighborIndices.push(neighbor.index);
            }
        }
        
        // Calculate decomposition rate based on conditions
        let currentDecompositionRate = this.decompositionRate;
        
        // Faster decomposition if touching soil
        if (touchingSoil) currentDecompositionRate *= 1.5;
        
        // Faster decomposition if wet
        if (waterContent > 20) currentDecompositionRate *= 1.3;
        
        // Decompose the dead matter
        if (Math.random() < currentDecompositionRate) {
            // Increment decomposition state
            const newDecompositionState = Math.min(100, decompositionState + Math.floor(Math.random() * 3) + 1);
            this.physics.core.metadata[index] = newDecompositionState;
            
            // If touching soil, transfer some nutrients to adjacent soil
            if (touchingSoil && soilNeighborIndices.length > 0) {
                // Pick a random adjacent soil
                const soilIndex = soilNeighborIndices[Math.floor(Math.random() * soilNeighborIndices.length)];
                
                // Add nutrients to that soil
                const nutrientAmount = Math.floor(Math.random() * 5) + 1;
                this.physics.core.nutrient[soilIndex] = Math.min(255, this.physics.core.nutrient[soilIndex] + nutrientAmount);
                
                // Chance to convert it to composted soil if it gets enough nutrients
                if (this.physics.core.nutrient[soilIndex] > 100 && Math.random() < 0.1) {
                    this.physics.core.state[soilIndex] = this.physics.STATE.COMPOSTED;
                } else if (this.physics.core.nutrient[soilIndex] > 50) {
                    // Otherwise, make it fertile
                    this.physics.core.state[soilIndex] = this.physics.STATE.FERTILE;
                }
                
                // Mark the soil as active
                nextActivePixels.add(soilIndex);
            }
            
            // If fully decomposed, convert to rich composted soil
            if (newDecompositionState >= 100) {
                this.physics.core.type[index] = this.physics.TYPE.SOIL;
                this.physics.core.state[index] = this.physics.STATE.COMPOSTED;
                
                // Rich in nutrients
                this.physics.core.nutrient[index] = Math.min(255, 150 + Math.floor(Math.random() * 50));
                
                // Preserve some water
                this.physics.core.water[index] = Math.max(30, this.physics.core.water[index]);
                
                // Reset metadata
                this.physics.core.metadata[index] = null;
            }
        }
        
        // Keep decomposing dead matter active
        if (this.physics.core.type[index] === this.physics.TYPE.DEAD_MATTER) {
            nextActivePixels.add(index);
        }
    },
    
    // Check for adjacent dead matter and potentially become composted
    checkForAdjacentDeadMatter: function(index, nextActivePixels) {
        // Skip if already processed
        if (this.physics.processedThisFrame[index]) return;
        this.physics.processedThisFrame[index] = 1;
        
        // Get coordinates
        const coords = this.physics.core.getCoords(index);
        
        // Check for adjacent dead matter
        const neighbors = this.physics.core.getNeighborIndices(coords.x, coords.y);
        let adjacentDeadMatter = false;
        
        for (const neighbor of neighbors) {
            if (this.physics.core.type[neighbor.index] === this.physics.TYPE.DEAD_MATTER) {
                adjacentDeadMatter = true;
                break;
            }
        }
        
        // If touching dead matter, chance to improve soil quality
        if (adjacentDeadMatter && Math.random() < 0.05) {
            // Increase nutrients in the soil
            const nutrientIncrease = Math.floor(Math.random() * 5) + 1;
            this.physics.core.nutrient[index] = Math.min(255, this.physics.core.nutrient[index] + nutrientIncrease);
            
            // Chance to convert to fertile soil based on nutrient level
            if (this.physics.core.nutrient[index] > 100 && Math.random() < 0.1) {
                // Compost conversion
                this.physics.core.state[index] = this.physics.STATE.COMPOSTED;
            } else if (this.physics.core.nutrient[index] > 50) {
                // Fertile soil conversion
                this.physics.core.state[index] = this.physics.STATE.FERTILE;
            }
            
            // Keep active
            nextActivePixels.add(index);
        }
    }
}; 