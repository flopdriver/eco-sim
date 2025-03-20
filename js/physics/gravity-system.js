// Gravity System
// Handles gravity effects on objects like seeds, dead matter and insects

const GravitySystem = {
    // Reference to parent physics system
    physics: null,
    
    // Gravity strength multiplier
    gravityStrength: 1.0,

    // Initialize gravity system
    init: function(physicsSystem) {
        this.physics = physicsSystem;
        console.log("Initializing gravity system...");
        return this;
    },

    // Update gravity effects on objects
    updateGravity: function(activePixels, nextActivePixels) {
        // Process items that should fall: seeds, dead matter, insects, worms
        activePixels.forEach(index => {
            // Skip if already processed
            if (this.physics.processedThisFrame[index]) return;

            const type = this.physics.core.type[index];

            // Check if it's a type affected by gravity
            const affectedByGravity = (
                type === this.physics.TYPE.SEED ||
                type === this.physics.TYPE.DEAD_MATTER ||
                type === this.physics.TYPE.WORM ||
                (type === this.physics.TYPE.INSECT && (this.physics.core.metadata[index] > 8 || Math.random() < 0.6)) // Increased insect falling chance
            );

            if (affectedByGravity) {
                const coords = this.physics.core.getCoords(index);
                this.applyGravity(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Apply gravity to a single pixel
    applyGravity: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.physics.processedThisFrame[index] = 1;
        
        // Track if the object is stuck
        if (!this.physics.core.metadata[index]) {
            // Initialize metadata for stuck counter if not set
            this.physics.core.metadata[index] = 1;
        } else if (this.physics.core.metadata[index] < 255) {
            // Increment stuck counter if already initialized (with cap to prevent overflow)
            this.physics.core.metadata[index]++;
        }
        
        // Get the value before we potentially reset it
        const stuckCounter = this.physics.core.metadata[index];
        
        // Try moving directly down first
        if (this.tryMoveDown(x, y, index, nextActivePixels)) {
            // Reset stuck counter if successful
            this.physics.core.metadata[index] = 0;
            return true;
        }
        
        // If that fails, try diagonal with increased probability as object stays stuck longer
        // Adjust probability based on stuck counter
        let diagonalProbability = 0.3 * this.gravityStrength;
        
        // Increase probability based on stuck counter - more aggressive unsticking
        if (stuckCounter > 3) {
            diagonalProbability = Math.min(0.95, diagonalProbability + (stuckCounter * 0.05));
        }
        
        if (Math.random() < diagonalProbability) {
            // Try more angles as object gets more stuck
            let attempts = 1;
            if (stuckCounter > 10) attempts = 2;
            if (stuckCounter > 20) attempts = 3;
            
            // Try multiple diagonal directions
            for (let i = 0; i < attempts; i++) {
                // Choose direction with more randomness as object gets more stuck
                let offset;
                if (stuckCounter < 10) {
                    // Regular diagonal
                    offset = Math.random() < 0.5 ? -1 : 1;
                } else if (stuckCounter < 20) {
                    // More random diagonal
                    offset = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
                } else {
                    // Even more random for very stuck objects
                    offset = Math.floor(Math.random() * 5) - 2; // -2, -1, 0, 1, or 2
                }
                
                const diagonalX = x + offset;
                const diagonalIndex = this.physics.core.getIndex(diagonalX, y + 1);
                
                if (this.tryMoveDiagonal(index, diagonalIndex, nextActivePixels)) {
                    // Reset stuck counter if successful
                    this.physics.core.metadata[index] = 0;
                    return true;
                }
            }
        }
        
        // If the object is severely stuck, try more aggressive measures
        if (stuckCounter > 15) {
            // Force movement in any available direction
            const neighbors = this.physics.core.getNeighborIndices(x, y);
            
            // Sort neighbors to prioritize downward directions
            neighbors.sort((a, b) => {
                // Prioritize downward directions
                const aDownward = a.y > y;
                const bDownward = b.y > y;
                
                if (aDownward && !bDownward) return -1;
                if (!aDownward && bDownward) return 1;
                return 0;
            });
            
            // Try each neighbor
            for (const neighbor of neighbors) {
                if (this.physics.core.type[neighbor.index] === this.physics.TYPE.AIR) {
                    // Use core's swap function for cleaner code
                    this.physics.core.swapPixels(index, neighbor.index);
                    
                    // Mark both positions as active
                    nextActivePixels.add(neighbor.index);
                    
                    // Reset stuck counter
                    this.physics.core.metadata[neighbor.index] = 0;
                    
                    return true;
                }
            }
        }
        
        // If the object couldn't fall, keep it active so it tries again next frame
        // (but only if it's a type that should keep trying)
        if (this.physics.core.type[index] === this.physics.TYPE.SEED ||
            this.physics.core.type[index] === this.physics.TYPE.DEAD_MATTER ||
            this.physics.core.type[index] === this.physics.TYPE.INSECT) {
            nextActivePixels.add(index);
        }
        
        return false;
    },
    
    // Helper method to try moving straight down
    tryMoveDown: function(x, y, index, nextActivePixels) {
        const downIndex = this.physics.core.getIndex(x, y + 1);
        
        if (downIndex === -1) return false;
        
        // Can fall into air, water, or (for seeds) sometimes into soil
        if (this.physics.core.type[downIndex] === this.physics.TYPE.AIR ||
            (this.physics.core.type[downIndex] === this.physics.TYPE.WATER &&
                this.physics.core.type[index] !== this.physics.TYPE.INSECT) ||
            (this.physics.core.type[index] === this.physics.TYPE.SEED && 
                this.physics.core.type[downIndex] === this.physics.TYPE.SOIL && 
                // Only allow seeds to dig into the top layer of soil
                this.getDepthInSoil(x, y) < 3 &&
                Math.random() < 0.08)) { // Reduced chance to fall into soil so more seeds stay on surface
            
            // Swap positions using core function for cleaner code
            this.physics.core.swapPixels(index, downIndex);
            
            // Mark both positions as active
            nextActivePixels.add(downIndex);
            if (this.physics.core.type[index] !== this.physics.TYPE.AIR) {
                nextActivePixels.add(index);
            }
            
            return true;
        }
        
        return false;
    },
    
    // Helper method to try moving diagonally
    tryMoveDiagonal: function(fromIndex, toIndex, nextActivePixels) {
        if (toIndex === -1) return false;
        
        if (this.physics.core.type[toIndex] === this.physics.TYPE.AIR) {
            // Use core's swap function
            this.physics.core.swapPixels(fromIndex, toIndex);
            
            // Mark new position as active
            nextActivePixels.add(toIndex);
            
            return true;
        }
        
        return false;
    },
    
    // Helper function to measure how deep a pixel is in soil
    getDepthInSoil: function(x, y) {
        let depth = 0;
        let checkY = y - 1; // Start checking one pixel above
        
        // Look upward until we hit non-soil
        while (checkY >= 0) {
            const checkIndex = this.physics.core.getIndex(x, checkY);
            if (checkIndex === -1 || this.physics.core.type[checkIndex] !== this.physics.TYPE.SOIL) {
                break;
            }
            depth++;
            checkY--;
        }
        
        return depth;
    }
};