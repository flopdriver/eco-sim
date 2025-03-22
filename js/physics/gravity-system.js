// Gravity System
// Handles gravity effects on objects like seeds, dead matter and insects

const GravitySystem = {
    // Reference to parent physics system
    physics: null,
    
    // Gravity strength multiplier
    gravityStrength: 1.0,

    soilCompactionStrength: 0.8, // 0-1 range, higher means more compaction

    // Initialize gravity system
    init: function(physicsSystem) {
        this.physics = physicsSystem;
        console.log("Initializing gravity system...");
        return this;
    },

    // Update gravity effects on objects
    updateGravity: function(activePixels, nextActivePixels) {
        // Process items that should fall: seeds, dead matter, insects, worms, and now soil
        activePixels.forEach(index => {
            // Skip if already processed
            if (this.physics.processedThisFrame[index]) return;

            const type = this.physics.core.type[index];

            // Check if it's a type affected by gravity
            if (type === this.physics.TYPE.SEED ||
                type === this.physics.TYPE.DEAD_MATTER ||
                type === this.physics.TYPE.WORM ||
                (type === this.physics.TYPE.INSECT && (this.physics.core.metadata[index] > 8 || Math.random() < 0.6))) {

                const coords = this.physics.core.getCoords(index);
                this.applyGravity(coords.x, coords.y, index, nextActivePixels);
            }
            // Special case for soil with different probability and behavior
            else if (type === this.physics.TYPE.SOIL) {
                const coords = this.physics.core.getCoords(index);

                // Check if this soil should be affected by gravity
                if (this.shouldSoilFall(coords.x, coords.y, index)) {
                    this.applySoilGravity(coords.x, coords.y, index, nextActivePixels);
                }
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
    },

    // Method to check if soil should fall (loose, unsupported soil)
    shouldSoilFall: function(x, y, index) {
        // Check what's below this soil pixel
        const belowIndex = this.physics.core.getIndex(x, y + 1);

        // If nothing below or air/water below, soil should fall
        if (belowIndex === -1 ||
            this.physics.core.type[belowIndex] === this.physics.TYPE.AIR ||
            this.physics.core.type[belowIndex] === this.physics.TYPE.WATER) {
            return true;
        }

        // Check for lack of support on sides and below (cave-in conditions)
        // Left and right neighbors
        const leftIndex = this.physics.core.getIndex(x - 1, y);
        const rightIndex = this.physics.core.getIndex(x + 1, y);

        // Diagonal support check
        const diagonalLeftIndex = this.physics.core.getIndex(x - 1, y + 1);
        const diagonalRightIndex = this.physics.core.getIndex(x + 1, y + 1);

        // Count how many sides are unsupported
        let unsupportedCount = 0;

        // Check if there are nearby roots (5x5 area) that should stabilize this soil
        if (this.hasNearbyRoots(x, y, 2)) {
            // Reduce chance of falling if near roots
            // Return early with reduced probability (80% less likely to fall)
            return Math.random() < 0.2 * (unsupportedCount / 10) * this.soilCompactionStrength;
        }

        // Check sides
        if (leftIndex === -1 || this.physics.core.type[leftIndex] === this.physics.TYPE.AIR ||
            this.physics.core.type[leftIndex] === this.physics.TYPE.WATER) {
            unsupportedCount++;
        }

        if (rightIndex === -1 || this.physics.core.type[rightIndex] === this.physics.TYPE.AIR ||
            this.physics.core.type[rightIndex] === this.physics.TYPE.WATER) {
            unsupportedCount++;
        }

        // Check diagonals
        if (diagonalLeftIndex === -1 || this.physics.core.type[diagonalLeftIndex] === this.physics.TYPE.AIR ||
            this.physics.core.type[diagonalLeftIndex] === this.physics.TYPE.WATER) {
            unsupportedCount++;
        }

        if (diagonalRightIndex === -1 || this.physics.core.type[diagonalRightIndex] === this.physics.TYPE.AIR ||
            this.physics.core.type[diagonalRightIndex] === this.physics.TYPE.WATER) {
            unsupportedCount++;
        }

        // Soil with many unsupported sides has a chance to fall
        // More unsupported sides = higher chance to fall
        const fallProbability = (unsupportedCount / 10) * this.soilCompactionStrength;

        return Math.random() < fallProbability;
    },

    // Helper method to check if there are plant roots nearby
    hasNearbyRoots: function(x, y, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                const checkIndex = this.physics.core.getIndex(nx, ny);
                
                if (checkIndex !== -1 && 
                    this.physics.core.type[checkIndex] === this.physics.TYPE.PLANT && 
                    this.physics.core.state[checkIndex] === this.physics.STATE.ROOT) {
                    // Found a root nearby
                    return true;
                }
            }
        }
        return false;
    },

    // Apply gravity to soil pixels (with special compaction behavior)
    applySoilGravity: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.physics.processedThisFrame[index] = 1;

        // Try moving directly down first
        if (this.trySoilMoveDown(x, y, index, nextActivePixels)) {
            return true;
        }

        // If direct down movement fails, try diagonal with lower probability than other objects
        if (Math.random() < 0.15 * this.soilCompactionStrength) {
            // Choose a diagonal direction randomly
            const offset = Math.random() < 0.5 ? -1 : 1;
            const diagonalX = x + offset;
            const diagonalIndex = this.physics.core.getIndex(diagonalX, y + 1);

            if (this.trySoilMoveDiagonal(index, diagonalIndex, nextActivePixels)) {
                return true;
            }
        }

        // If we couldn't move the soil, try compacting it by increasing density/nutrients
        this.compactSoil(index);

        // Keep the soil active for potential future movement
        nextActivePixels.add(index);

        return false;
    },

    // Helper method to try moving soil straight down
    trySoilMoveDown: function(x, y, index, nextActivePixels) {
        const downIndex = this.physics.core.getIndex(x, y + 1);

        if (downIndex === -1) return false;
        
        // Check if there are roots directly below or diagonally below
        // If so, make soil more likely to compact than fall
        const belowX = x;
        const belowY = y + 1;
        if (this.hasNearbyRoots(belowX, belowY, 1)) {
            // Root is directly supporting this soil
            if (Math.random() < 0.8) {
                // Increase soil stability by roots (80% chance to compact instead of fall)
                this.compactSoil(index);
                nextActivePixels.add(index);
                return true;
            }
        }

        // Soil can fall into air or water
        if (this.physics.core.type[downIndex] === this.physics.TYPE.AIR ||
            this.physics.core.type[downIndex] === this.physics.TYPE.WATER) {

            // Store the water content from the destination (in case it's water)
            let destinationWater = 0;
            if (this.physics.core.type[downIndex] === this.physics.TYPE.WATER) {
                destinationWater = this.physics.core.water[downIndex];
            }

            // Move soil down
            this.physics.core.type[downIndex] = this.physics.TYPE.SOIL;
            this.physics.core.state[downIndex] = this.physics.core.state[index];
            this.physics.core.water[downIndex] = this.physics.core.water[index];
            this.physics.core.nutrient[downIndex] = this.physics.core.nutrient[index];

            // If falling into water, add that water content to the soil
            if (destinationWater > 0) {
                this.physics.core.water[downIndex] = Math.min(255, this.physics.core.water[downIndex] + destinationWater);
                if (this.physics.core.water[downIndex] > 20) {
                    this.physics.core.state[downIndex] = this.physics.STATE.WET;
                }
            }

            // Clear original position to air
            this.physics.core.type[index] = this.physics.TYPE.AIR;
            this.physics.core.water[index] = 0;
            this.physics.core.nutrient[index] = 0;

            // Mark both positions as active
            nextActivePixels.add(downIndex);
            nextActivePixels.add(index);

            return true;
        }

        // Special case: soil compaction - if soil falls onto other soil, it might compact
        if (this.physics.core.type[downIndex] === this.physics.TYPE.SOIL) {
            // There's a small chance to compact the soil below and remove this soil
            if (Math.random() < 0.05 * this.soilCompactionStrength) {
                // Increase nutrients in the lower soil (compacting)
                this.physics.core.nutrient[downIndex] = Math.min(255,
                    this.physics.core.nutrient[downIndex] + this.physics.core.nutrient[index] + 10);

                // Transfer any water content
                this.physics.core.water[downIndex] = Math.min(255,
                    this.physics.core.water[downIndex] + this.physics.core.water[index]);

                // Update soil state based on water content
                if (this.physics.core.water[downIndex] > 20) {
                    // Don't change soil type, just update moisture status
                    if (this.physics.core.state[downIndex] !== this.physics.STATE.CLAY &&
                        this.physics.core.state[downIndex] !== this.physics.STATE.SANDY &&
                        this.physics.core.state[downIndex] !== this.physics.STATE.LOAMY &&
                        this.physics.core.state[downIndex] !== this.physics.STATE.ROCKY) {
                        this.physics.core.state[downIndex] = this.physics.STATE.WET;
                    }
                }

                // Remove this soil pixel and replace with air
                this.physics.core.type[index] = this.physics.TYPE.AIR;
                this.physics.core.water[index] = 0;
                this.physics.core.nutrient[index] = 0;

                // Mark both positions as active
                nextActivePixels.add(downIndex);
                nextActivePixels.add(index);

                return true;
            }
        }

        // Special case: soil compaction around roots
        if (this.physics.core.type[downIndex] === this.physics.TYPE.PLANT && 
            this.physics.core.state[downIndex] === this.physics.STATE.ROOT) {
            
            // Soil resting on roots should be very stable
            // Instead of removing the soil, make it more compacted and stable
            this.physics.core.nutrient[index] = Math.min(255, this.physics.core.nutrient[index] + 15);
            
            // Indicate this soil is stable/fertile from root interaction
            if (this.physics.core.state[index] !== this.physics.STATE.CLAY &&
                this.physics.core.state[index] !== this.physics.STATE.SANDY &&
                this.physics.core.state[index] !== this.physics.STATE.LOAMY &&
                this.physics.core.state[index] !== this.physics.STATE.ROCKY) {
                // Chance to become fertile soil from root interaction
                if (Math.random() < 0.1) {
                    this.physics.core.state[index] = this.physics.STATE.FERTILE;
                }
            }
            
            // Keep this soil active but stable
            nextActivePixels.add(index);
            return true;
        }

        return false;
    },

    // Helper method to try moving soil diagonally down
    trySoilMoveDiagonal: function(fromIndex, toIndex, nextActivePixels) {
        if (toIndex === -1) return false;
        
        // Get coordinates for root checking
        const coords = this.physics.core.getCoords(fromIndex);
        const toCoords = this.physics.core.getCoords(toIndex);
        
        // If we're trying to move diagonally but there's a root at the destination
        // or near the destination, stabilize the soil instead
        if (toCoords && this.hasNearbyRoots(toCoords.x, toCoords.y, 1)) {
            if (Math.random() < 0.75) {
                // Stabilize soil instead of moving it (roots bind soil)
                this.compactSoil(fromIndex);
                nextActivePixels.add(fromIndex);
                return true;
            }
        }

        // Soil can only move into air or water
        if (this.physics.core.type[toIndex] === this.physics.TYPE.AIR ||
            this.physics.core.type[toIndex] === this.physics.TYPE.WATER) {

            // Store water content if destination is water
            let destinationWater = 0;
            if (this.physics.core.type[toIndex] === this.physics.TYPE.WATER) {
                destinationWater = this.physics.core.water[toIndex];
            }

            // Move soil to new location
            this.physics.core.type[toIndex] = this.physics.TYPE.SOIL;
            this.physics.core.state[toIndex] = this.physics.core.state[fromIndex];
            this.physics.core.water[toIndex] = this.physics.core.water[fromIndex];
            this.physics.core.nutrient[toIndex] = this.physics.core.nutrient[fromIndex];

            // Add water content if falling into water
            if (destinationWater > 0) {
                this.physics.core.water[toIndex] = Math.min(255, this.physics.core.water[toIndex] + destinationWater);
                if (this.physics.core.water[toIndex] > 20) {
                    this.physics.core.state[toIndex] = this.physics.STATE.WET;
                }
            }

            // Clear original position to air
            this.physics.core.type[fromIndex] = this.physics.TYPE.AIR;
            this.physics.core.water[fromIndex] = 0;
            this.physics.core.nutrient[fromIndex] = 0;

            // Mark both positions as active
            nextActivePixels.add(toIndex);
            nextActivePixels.add(fromIndex);

            return true;
        }
        
        // If the destination is a root, handle it specially
        if (this.physics.core.type[toIndex] === this.physics.TYPE.PLANT &&
            this.physics.core.state[toIndex] === this.physics.STATE.ROOT) {
            
            // Increased compaction near roots
            this.physics.core.nutrient[fromIndex] = Math.min(255, this.physics.core.nutrient[fromIndex] + 10);
            
            // Small chance to make soil more fertile from root interaction
            if (Math.random() < 0.08 &&
                this.physics.core.state[fromIndex] !== this.physics.STATE.CLAY &&
                this.physics.core.state[fromIndex] !== this.physics.STATE.SANDY &&
                this.physics.core.state[fromIndex] !== this.physics.STATE.LOAMY &&
                this.physics.core.state[fromIndex] !== this.physics.STATE.ROCKY) {
                this.physics.core.state[fromIndex] = this.physics.STATE.FERTILE;
            }
            
            // Keep this soil active but don't move it
            nextActivePixels.add(fromIndex);
            return true;
        }

        return false;
    },

    // When soil can't fall, it compacts in place
    compactSoil: function(index) {
        // Skip if not soil anymore (sanity check)
        if (this.physics.core.type[index] !== this.physics.TYPE.SOIL) return;

        // Increase nutrient count (representing compaction)
        // Limit to maximum value to prevent overflow
        const currentNutrient = this.physics.core.nutrient[index];
        this.physics.core.nutrient[index] = Math.min(255, currentNutrient + 1);

        // If soil gets very compacted, it might become a special type
        if (this.physics.core.nutrient[index] > 200 && Math.random() < 0.02) {
            // Don't change the soil layer type (CLAY, SANDY, etc), just add fertility
            if (this.physics.core.state[index] !== this.physics.STATE.CLAY &&
                this.physics.core.state[index] !== this.physics.STATE.SANDY &&
                this.physics.core.state[index] !== this.physics.STATE.LOAMY &&
                this.physics.core.state[index] !== this.physics.STATE.ROCKY) {
                this.physics.core.state[index] = this.physics.STATE.FERTILE;
            }
        }
    }
};