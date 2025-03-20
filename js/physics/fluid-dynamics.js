// Fluid Dynamics System
// Handles water movement and fluid physics

const FluidDynamicsSystem = {
    // Reference to parent physics system
    physics: null,
    
    // Water flow rate multiplier
    waterFlowRate: 2.5, // Significantly increased for faster water movement
    
    // Water threshold for emergency measures
    waterEmergencyThreshold: 1000, // Number of water pixels that trigger special drainage

    // Initialize fluid dynamics system
    init: function(physicsSystem) {
        this.physics = physicsSystem;
        console.log("Initializing fluid dynamics system...");
        return this;
    },

    // Update water movement (processes active water pixels)
    updateWaterMovement: function(activePixels, nextActivePixels) {
        // Process water movement from bottom to top to avoid cascading water in a single tick
        // First, collect all water pixels and sort them by y-position (bottom to top)
        const waterPixels = [];

        activePixels.forEach(index => {
            if (this.physics.core.type[index] === this.physics.TYPE.WATER) {
                const coords = this.physics.core.getCoords(index);
                waterPixels.push({index, x: coords.x, y: coords.y});
            }
        });
        
        // Check if we need emergency drainage (too much water)
        const emergencyDrainageNeeded = waterPixels.length > this.waterEmergencyThreshold;
        
        // If emergency drainage is needed, remove some ground-level water
        if (emergencyDrainageNeeded && waterPixels.length > 0) {
            console.log("Emergency water drainage activated - removing excess water");
            
            // Identify ground level for drainage (uses a different variable name)
            const drainageGroundLevel = Math.floor(this.physics.core.height * 0.6);
            
            // Find water pixels at ground level for removal
            const groundWaterPixels = waterPixels.filter(p => 
                p.y >= drainageGroundLevel - 3 && p.y <= drainageGroundLevel + 5
            );
            
            // Remove a percentage of ground water (40-50%)
            const removalCount = Math.ceil(groundWaterPixels.length * 0.4 + Math.random() * 0.1);
            const toRemove = groundWaterPixels.slice(0, removalCount);
            
            // Actually remove the water
            toRemove.forEach(pixel => {
                this.physics.core.type[pixel.index] = this.physics.TYPE.AIR;
                this.physics.core.water[pixel.index] = 0;
                this.physics.processedThisFrame[pixel.index] = 1;
            });
        }

        // Sort water pixels by y-position (descending, so bottom pixels are processed first)
        waterPixels.sort((a, b) => b.y - a.y);

        // Process each water pixel
        for (const pixel of waterPixels) {
            // Skip if already processed this frame
            if (this.physics.processedThisFrame[pixel.index]) continue;

            this.physics.processedThisFrame[pixel.index] = 1;
            
            // If emergency, process water more aggressively
            if (emergencyDrainageNeeded) {
                // Higher evaporation and drainage chance during emergency
                if (Math.random() < 0.2) {
                    this.physics.core.type[pixel.index] = this.physics.TYPE.AIR;
                    this.physics.core.water[pixel.index] = 0;
                    continue;
                }
            }
            
            this.updateSingleWaterPixel(pixel.x, pixel.y, pixel.index, nextActivePixels);
        }
    },

    // Update a single water pixel
    updateSingleWaterPixel: function(x, y, index, nextActivePixels) {
        // Skip if not water anymore (might have been processed already)
        if (this.physics.core.type[index] !== this.physics.TYPE.WATER) return;
        
        // Track if water is stuck
        if (!this.physics.core.metadata[index]) {
            this.physics.core.metadata[index] = 1;
        } else if (this.physics.core.metadata[index] < 255) {
            this.physics.core.metadata[index]++;
        }
        
        // Get stuck counter
        const stuckCounter = this.physics.core.metadata[index];
        
        // WATER EVAPORATION - Remove excess water if there's too much on the map
        // Calculate ground level once and reuse throughout the function
        const simGroundLevel = Math.floor(this.physics.core.height * 0.6);
        
        // Check if water is on the ground surface
        if (y >= simGroundLevel - 2 && y <= simGroundLevel + 2) {
            // Surface water evaporates quickly (50% chance if stuck for a while)
            if (stuckCounter > 10 && Math.random() < 0.5) {
                this.physics.core.type[index] = this.physics.TYPE.AIR;
                this.physics.core.water[index] = 0;
                return;
            }
        } 
        // Water anywhere else evaporates more slowly
        else if (stuckCounter > 20 && Math.random() < 0.05) {
            this.physics.core.type[index] = this.physics.TYPE.AIR;
            this.physics.core.water[index] = 0;
            return;
        }
        
        // Try to move down first (gravity)
        const downIndex = this.physics.core.getIndex(x, y + 1);

        if (downIndex !== -1) {
            // Check what's below
            switch (this.physics.core.type[downIndex]) {
                case this.physics.TYPE.AIR:
                    // Move water down into air
                    this.physics.core.type[downIndex] = this.physics.TYPE.WATER;
                    this.physics.core.water[downIndex] = this.physics.core.water[index];
                    this.physics.core.type[index] = this.physics.TYPE.AIR;
                    this.physics.core.water[index] = 0;

                    this.physics.processedThisFrame[downIndex] = 1;
                    nextActivePixels.add(downIndex);
                    return;

                case this.physics.TYPE.SOIL:
                    // Extremely fast soil absorption to prevent flooding
                    // Almost all soil can absorb water regardless of saturation level
                    
                    // Determine soil saturation limit - higher near ground surface
                    const soilCoords = this.physics.core.getCoords(downIndex);
                    // Use simGroundLevel from above
                    const depthBelowSurface = soilCoords.y - simGroundLevel;
                    
                    // Surface soil has lower saturation (drains faster), deeper soil has higher capacity
                    let soilCapacity = 255;
                    if (depthBelowSurface < 5) {
                        // Top layers of soil have "infinite" absorption (simulates drainage)
                        soilCapacity = 9999;
                    }
                    
                    // Absorb water if not oversaturated
                    if (this.physics.core.water[downIndex] < soilCapacity) {
                        // Transfer almost all water at once (95-100%)
                        const transferAmount = Math.max(
                            Math.floor(this.physics.core.water[index] * 0.95),
                            Math.min(50, this.physics.core.water[index]) // At least 50 units if possible
                        );
                        
                        this.physics.core.water[downIndex] += transferAmount;
                        this.physics.core.water[index] -= transferAmount;

                        // Update soil state
                        if (this.physics.core.water[downIndex] > 20) {
                            this.physics.core.state[downIndex] = this.physics.STATE.WET;
                        }

                        // If water is depleted or nearly depleted, convert to air
                        if (this.physics.core.water[index] <= 2) {
                            this.physics.core.type[index] = this.physics.TYPE.AIR;
                            this.physics.core.water[index] = 0;
                        } else {
                            nextActivePixels.add(index);
                        }

                        nextActivePixels.add(downIndex);
                        return;
                    } 
                    // Even if soil is saturated, still try to absorb some water
                    else if (Math.random() < 0.7) {
                        // Simulate drainage by allowing oversaturated soil to still absorb water
                        const drainAmount = Math.min(30, this.physics.core.water[index]);
                        this.physics.core.water[index] -= drainAmount;
                        
                        // If water is depleted, convert to air
                        if (this.physics.core.water[index] <= 0) {
                            this.physics.core.type[index] = this.physics.TYPE.AIR;
                        } else {
                            nextActivePixels.add(index);
                        }
                        
                        return;
                    }
                    break;

                case this.physics.TYPE.PLANT:
                    // Plants mostly block water, but interact with it differently
                    // based on plant part
                    const plantState = this.physics.core.state[downIndex];
                    
                    // Roots can absorb water without displacement
                    if (plantState === this.physics.STATE.ROOT) {
                        if (Math.random() < 0.5) {  // Increased absorption chance from 0.3 to 0.5
                            // Roots absorb more water without moving the plant
                            const absorbAmount = Math.min(20, this.physics.core.water[index]);  // Increased absorption amount from 10 to 20
                            this.physics.core.water[downIndex] += absorbAmount;
                            this.physics.core.water[index] -= absorbAmount;
                            
                            // If water is depleted, convert to air
                            if (this.physics.core.water[index] <= 0) {
                                this.physics.core.type[index] = this.physics.TYPE.AIR;
                            }
                            
                            // Activate both pixels
                            nextActivePixels.add(index);
                            nextActivePixels.add(downIndex);
                            return;
                        }
                    }
                    // Stems can absorb water or let it pass through
                    else if (plantState === this.physics.STATE.STEM) {
                        // Check if stem needs water (has room for more)
                        if (this.physics.core.water[downIndex] < 150 && Math.random() < 0.4) {
                            // Stems can absorb water directly
                            const absorbAmount = Math.min(15, this.physics.core.water[index]);
                            this.physics.core.water[downIndex] += absorbAmount;
                            this.physics.core.water[index] -= absorbAmount;
                            
                            // If water is depleted, convert to air
                            if (this.physics.core.water[index] <= 0) {
                                this.physics.core.type[index] = this.physics.TYPE.AIR;
                            }
                            
                            // Activate both pixels
                            nextActivePixels.add(index);
                            nextActivePixels.add(downIndex);
                            return;
                        }
                        // If stem didn't absorb water, it might let water pass through (rarely)
                        else if (Math.random() < 0.05) {
                            // Water can occasionally pass through stems
                            // But use special handling to preserve plant structure
                            
                            // Get the pixel below the stem
                            const belowStemIndex = this.physics.core.getIndex(x, y + 2);
                            if (belowStemIndex !== -1 && 
                                (this.physics.core.type[belowStemIndex] === this.physics.TYPE.AIR ||
                                 this.physics.core.type[belowStemIndex] === this.physics.TYPE.WATER)) {
                                 
                                // Move water through the stem to the pixel below
                                if (this.physics.core.type[belowStemIndex] === this.physics.TYPE.AIR) {
                                    this.physics.core.type[belowStemIndex] = this.physics.TYPE.WATER;
                                    this.physics.core.water[belowStemIndex] = this.physics.core.water[index];
                                } else {
                                    // Add water to existing water
                                    this.physics.core.water[belowStemIndex] += this.physics.core.water[index];
                                }
                                
                                // Convert original water to air
                                this.physics.core.type[index] = this.physics.TYPE.AIR;
                                this.physics.core.water[index] = 0;
                                
                                // Activate all three pixels
                                nextActivePixels.add(index);
                                nextActivePixels.add(downIndex);
                                nextActivePixels.add(belowStemIndex);
                                return;
                            }
                        }
                    }
                    // Leaves absorb water but block it from passing through
                    else if (plantState === this.physics.STATE.LEAF) {
                        // Check if leaf needs water (has room for more)
                        if (this.physics.core.water[downIndex] < 120) {
                            // Leaves can absorb water directly with high probability
                            if (Math.random() < 0.35) {
                                // Absorb a significant amount of water
                                const absorbAmount = Math.min(10, this.physics.core.water[index]);
                                this.physics.core.water[downIndex] += absorbAmount;
                                this.physics.core.water[index] -= absorbAmount;
                                
                                // If water is depleted, convert to air
                                if (this.physics.core.water[index] <= 0) {
                                    this.physics.core.type[index] = this.physics.TYPE.AIR;
                                }
                            }
                            // Smaller chance for minimal absorption (like dew on leaf)
                            else if (Math.random() < 0.3) {
                                // Increase water content of leaf slightly
                                this.physics.core.water[downIndex] += 2;
                                this.physics.core.water[index] -= 2;
                                
                                if (this.physics.core.water[index] <= 0) {
                                    this.physics.core.type[index] = this.physics.TYPE.AIR;
                                }
                            }
                        }
                        // Water pools on leaves (no passing through)
                        nextActivePixels.add(index);
                        nextActivePixels.add(downIndex);
                        return;
                    }
                    
                    // Default case - water doesn't pass through plant
                    nextActivePixels.add(index);
                    return;

                case this.physics.TYPE.INSECT:
                    // Allow water to pass through insects with small probability
                    // Modified by waterFlowRate setting
                    if (Math.random() < 0.10 * this.waterFlowRate) {
                        this.swapWaterWithElement(index, downIndex, nextActivePixels);
                        return;
                    }
                    break;

                case this.physics.TYPE.WORM:
                    // Worms are more permeable to water
                    if (Math.random() < 0.25) {
                        this.swapWaterWithElement(index, downIndex, nextActivePixels);
                        return;
                    }
                    break;

                case this.physics.TYPE.SEED:
                    // Seeds can let water pass occasionally
                    if (Math.random() < 0.2) {
                        this.swapWaterWithElement(index, downIndex, nextActivePixels);
                        return;
                    }
                    break;

                case this.physics.TYPE.DEAD_MATTER:
                    // Dead matter is somewhat permeable
                    if (Math.random() < 0.3) {
                        this.swapWaterWithElement(index, downIndex, nextActivePixels);
                        return;
                    }
                    break;
            }
        }

        // If can't move down, try to spread horizontally
        // Check ground level to enhance spreading on the ground (using simGroundLevel from above)
        const isNearGround = y >= simGroundLevel - 5;

        // Randomize whether we check left or right first for more natural flow
        const checkLeftFirst = Math.random() < 0.5;

        // Get horizontal neighbors
        const leftIndex = this.physics.core.getIndex(x - 1, y);
        const rightIndex = this.physics.core.getIndex(x + 1, y);

        // If water is stacking up at ground level, try both directions
        // This significantly increases horizontal spread at ground level
        if (isNearGround) {
            let movedLeft = false;
            let movedRight = false;
            
            // Try both directions for water at ground level
            // This creates faster spreading puddles instead of stacks
            movedLeft = this.tryMoveWaterHorizontal(index, leftIndex, nextActivePixels);
            
            // If we still have water in the original pixel, try right too
            if (this.physics.core.type[index] === this.physics.TYPE.WATER) {
                movedRight = this.tryMoveWaterHorizontal(index, rightIndex, nextActivePixels);
            }
            
            if (movedLeft || movedRight) return;
        } else {
            // Away from ground, just try one direction as before
            // Try first direction
            if (checkLeftFirst) {
                if (this.tryMoveWaterHorizontal(index, leftIndex, nextActivePixels)) return;
                if (this.tryMoveWaterHorizontal(index, rightIndex, nextActivePixels)) return;
            } else {
                if (this.tryMoveWaterHorizontal(index, rightIndex, nextActivePixels)) return;
                if (this.tryMoveWaterHorizontal(index, leftIndex, nextActivePixels)) return;
            }
        }

        // Try diagonal down movement if horizontal fails
        const downLeftIndex = this.physics.core.getIndex(x - 1, y + 1);
        const downRightIndex = this.physics.core.getIndex(x + 1, y + 1);

        if (checkLeftFirst) {
            if (this.tryMoveWaterDiagonal(index, downLeftIndex, nextActivePixels)) return;
            if (this.tryMoveWaterDiagonal(index, downRightIndex, nextActivePixels)) return;
        } else {
            if (this.tryMoveWaterDiagonal(index, downRightIndex, nextActivePixels)) return;
            if (this.tryMoveWaterDiagonal(index, downLeftIndex, nextActivePixels)) return;
        }

        // If water is stuck for too long, try more aggressive measures
        if (stuckCounter > 10) {
            // Try to move in any available direction
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
                    // Move water to air
                    this.physics.core.type[neighbor.index] = this.physics.TYPE.WATER;
                    this.physics.core.water[neighbor.index] = this.physics.core.water[index];
                    this.physics.core.type[index] = this.physics.TYPE.AIR;
                    this.physics.core.water[index] = 0;
                    
                    // Reset stuck counter on new position
                    this.physics.core.metadata[neighbor.index] = 0;
                    
                    this.physics.processedThisFrame[neighbor.index] = 1;
                    nextActivePixels.add(neighbor.index);
                    return;
                }
            }
        }
        
        // If still here, water couldn't move, but remains active
        nextActivePixels.add(index);
    },

    // Helper method to swap water with another element
    swapWaterWithElement: function(waterIndex, elementIndex, nextActivePixels) {
        // Store the element's properties
        const elementType = this.physics.core.type[elementIndex];
        const elementState = this.physics.core.state[elementIndex];
        const elementWater = this.physics.core.water[elementIndex];
        const elementNutrient = this.physics.core.nutrient[elementIndex];
        const elementEnergy = this.physics.core.energy[elementIndex];
        const elementMetadata = this.physics.core.metadata[elementIndex];

        // Move water down
        this.physics.core.type[elementIndex] = this.physics.TYPE.WATER;
        this.physics.core.water[elementIndex] = this.physics.core.water[waterIndex];
        this.physics.core.state[elementIndex] = this.physics.STATE.DEFAULT;
        this.physics.core.nutrient[elementIndex] = 0;
        this.physics.core.energy[elementIndex] = 0;
        this.physics.core.metadata[elementIndex] = 0;

        // Move element up
        this.physics.core.type[waterIndex] = elementType;
        this.physics.core.state[waterIndex] = elementState;
        this.physics.core.water[waterIndex] = elementWater;
        this.physics.core.nutrient[waterIndex] = elementNutrient;
        this.physics.core.energy[waterIndex] = elementEnergy;
        this.physics.core.metadata[waterIndex] = elementMetadata;

        // Mark both as active
        this.physics.processedThisFrame[elementIndex] = 1;
        nextActivePixels.add(elementIndex);
        nextActivePixels.add(waterIndex);
    },

    // Try to move water horizontally
    tryMoveWaterHorizontal: function(fromIndex, toIndex, nextActivePixels) {
        if (toIndex === -1) return false;

        // Can only move into air
        if (this.physics.core.type[toIndex] === this.physics.TYPE.AIR) {
            // Get the stuck counter to help unstick water
            const stuckCounter = this.physics.core.metadata[fromIndex] || 0;
            
            // Get coordinates to check if water is at ground level
            const horizCoords = this.physics.core.getCoords(fromIndex);
            // Calculate horizontalGroundLevel here rather than reusing to avoid scope issues
            const horizontalGroundLevel = Math.floor(this.physics.core.height * 0.6);
            const isNearGround = horizCoords.y >= horizontalGroundLevel - 5;
            
            // Water can spread horizontally if:
            // 1. It has enough pressure (water level), OR
            // 2. It's been stuck for a while, OR
            // 3. It's at ground level (to prevent stacking)
            if (this.physics.core.water[fromIndex] > 4 || stuckCounter > 3 || isNearGround) {
                // If water is near ground, spread more aggressively
                const transferRatio = isNearGround ? 0.9 : // 90% transfer at ground
                                      (stuckCounter > 6 ? 0.8 : 0.5); // Otherwise use stuck counter
                
                // Calculate transfer amount but ensure more transfer near ground
                const transferAmount = Math.floor(this.physics.core.water[fromIndex] * transferRatio);

                this.physics.core.type[toIndex] = this.physics.TYPE.WATER;
                this.physics.core.water[toIndex] = transferAmount;
                this.physics.core.water[fromIndex] -= transferAmount;

                // Reset stuck counter for the new water
                this.physics.core.metadata[toIndex] = 0;
                
                // If source water is too low, convert back to air
                if (this.physics.core.water[fromIndex] <= 1) {
                    this.physics.core.type[fromIndex] = this.physics.TYPE.AIR;
                    this.physics.core.water[fromIndex] = 0;
                } else {
                    // Reset stuck counter for remaining water too
                    this.physics.core.metadata[fromIndex] = 0;
                    nextActivePixels.add(fromIndex);
                }

                this.physics.processedThisFrame[toIndex] = 1;
                nextActivePixels.add(toIndex);
                return true;
            }
        }

        return false;
    },

    // Try to move water diagonally down
    tryMoveWaterDiagonal: function(fromIndex, toIndex, nextActivePixels) {
        if (toIndex === -1) return false;

        // Can only move into air
        if (this.physics.core.type[toIndex] === this.physics.TYPE.AIR) {
            // Get stuck counter
            const stuckCounter = this.physics.core.metadata[fromIndex] || 0;
            
            // Higher chance to move diagonally if stuck for a while
            const moveProbability = stuckCounter > 5 ? 1.0 : 0.8;
            
            if (Math.random() < moveProbability) {
                // Transfer all water (full movement)
                this.physics.core.type[toIndex] = this.physics.TYPE.WATER;
                this.physics.core.water[toIndex] = this.physics.core.water[fromIndex];
                
                // Reset stuck counter for new position
                this.physics.core.metadata[toIndex] = 0;

                // Clear source pixel
                this.physics.core.type[fromIndex] = this.physics.TYPE.AIR;
                this.physics.core.water[fromIndex] = 0;

                this.physics.processedThisFrame[toIndex] = 1;
                nextActivePixels.add(toIndex);
                return true;
            }
        }

        return false;
    },
};