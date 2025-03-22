// Fluid Dynamics System
// Handles water movement and fluid physics

const FluidDynamicsSystem = {
    // Reference to parent physics system
    physics: null,

    // Configuration constants
    WATER_FLOW_RATE: 45.5,            // Flow speed multiplier
    WATER_EMERGENCY_THRESHOLD: 100000,  // Trigger drainage when this many water pixels exist

    // Water transfer amounts
    VERTICAL_TRANSFER_DIVIDER: 1.8,     // Higher number = slower vertical flow
    HORIZONTAL_TRANSFER_DIVIDER: 1.8,   // Higher number = slower horizontal flow

    // Evaporation probabilities
    SURFACE_EVAPORATION_THRESHOLD: 30, // Stuck counter that increases evaporation chance
    ABOVE_GROUND_EVAPORATION_THRESHOLD: 60,
    BELOW_GROUND_ABSORPTION_THRESHOLD: 25,

    // Soil absorption rates
    MIN_TRANSFER_AMOUNT: 25,
    SHALLOW_SOIL_WATER_CAPACITY: 9999, // "Infinite" absorption for surface soil

    // Current frame count for timing operations
    frameCount: 0,

    // Initialize fluid dynamics system
    init: function(physicsSystem) {
        this.physics = physicsSystem;
        console.log("Initializing fluid dynamics system...");
        return this;
    },

    // Main update function - processes active water pixels
    updateWaterMovement: function(activePixels, nextActivePixels) {
        // Increment frame count for soil line calculations
        this.frameCount++;
        
        // Emergency drainage if water count is too high
        if (this.physics.core.countPixelsOfType(this.physics.TYPE.WATER) > this.WATER_EMERGENCY_THRESHOLD) {
            this.emergencyWaterDrainage();
        }

        // Process each active water pixel
        activePixels.forEach(index => {
            if (this.physics.core.type[index] === this.physics.TYPE.WATER) {
                const coords = this.physics.core.getCoords(index);
                
                // Skip if already processed this frame
                if (!this.physics.processedThisFrame[index]) {
                    this.physics.processedThisFrame[index] = 1;
                    this.updateSingleWaterPixel(coords.x, coords.y, index, nextActivePixels);
                }
            }
        });
    },

    // Collect water pixels from active pixels
    collectWaterPixels: function(activePixels) {
        const waterPixels = [];

        activePixels.forEach(index => {
            if (this.physics.core.type[index] === this.physics.TYPE.WATER) {
                const coords = this.physics.core.getCoords(index);
                waterPixels.push({index, x: coords.x, y: coords.y});
            }
        });

        return waterPixels;
    },

    // Handle emergency drainage to prevent flooding
    emergencyWaterDrainage: function() {
        console.log("Emergency water drainage activated - removing excess water");
        
        // Find and process all water pixels
        for (let y = 0; y < this.physics.core.height; y++) {
            for (let x = 0; x < this.physics.core.width; x++) {
                const index = this.physics.core.getIndex(x, y);
                
                if (index !== -1 && this.physics.core.type[index] === this.physics.TYPE.WATER) {
                    // Use actual soil line for each column
                    const groundLevel = this.getGroundLevel(x);
                    
                    // 20% chance of immediate removal
                    if (Math.random() < 0.2) {
                        this.convertWaterByElevation(index, y, groundLevel);
                    }
                }
            }
        }
    },

    // Convert water to air or soil based on elevation
    convertWaterByElevation: function(index, y, groundLevel) {
        if (y < groundLevel) {
            // Above ground - convert to air
            this.physics.core.type[index] = this.physics.TYPE.AIR;
            this.physics.core.water[index] = 0;
        } else {
            // Below ground - convert to soil instead of air
            // This prevents air bubbles from forming underground
            this.physics.core.type[index] = this.physics.TYPE.SOIL;
            this.physics.core.state[index] = this.physics.STATE.WET;
            this.physics.core.water[index] = Math.min(255, this.physics.core.water[index]);
            if (this.physics.core.water[index] < 10) {
                this.physics.core.water[index] = 10; // Ensure minimum water content
            }
            this.physics.core.nutrient[index] = 10; // Some basic nutrients
        }
    },

    // Get ground level for a specific x coordinate using the actual soil line
    getGroundLevel: function(x) {
        // If x is provided, use the soil height at that position
        if (x !== undefined) {
            return this.physics.core.getSoilHeight(x, this.frameCount);
        }
        
        // Fallback to the default value (for backward compatibility)
        return Math.floor(this.physics.core.height * 0.7);
    },

    // Update a single water pixel
    updateSingleWaterPixel: function(x, y, index, nextActivePixels) {
        // Skip if not water anymore (might have been processed already)
        if (this.physics.core.type[index] !== this.physics.TYPE.WATER) return;

        // Update stuck counter
        this.updateStuckCounter(index);
        const stuckCounter = this.physics.core.metadata[index];

        // Check for evaporation or absorption based on position
        const groundLevel = this.getGroundLevel(x);

        if (this.handleEvaporationAndAbsorption(index, y, stuckCounter, groundLevel)) {
            return; // Water was converted, no further processing needed
        }

        // Try to move down first (gravity)
        const downIndex = this.physics.core.getIndex(x, y + 1);

        if (downIndex !== -1) {
            if (this.handleDownwardMovement(index, downIndex, x, y, groundLevel, nextActivePixels)) {
                return; // Water moved down, no need for further processing
            }
        }

        // Try to spread horizontally if couldn't move down
        if (this.handleHorizontalSpread(index, x, y, stuckCounter, groundLevel, nextActivePixels)) {
            return; // Water spread horizontally, no further processing
        }

        // Try diagonal movement if horizontal spread failed
        if (this.handleDiagonalMovement(index, x, y, groundLevel, nextActivePixels)) {
            return; // Water moved diagonally, no further processing
        }

        // Handle stuck water with more aggressive measures
        if (stuckCounter > 10) {
            if (this.handleStuckWater(index, x, y, stuckCounter, groundLevel, nextActivePixels)) {
                return; // Stuck water was handled, no further processing
            }
        }

        // If still here, water couldn't move, but remains active
        nextActivePixels.add(index);
    },

    // Update stuck counter for water pixel
    updateStuckCounter: function(index) {
        if (!this.physics.core.metadata[index]) {
            this.physics.core.metadata[index] = 1;
        } else if (this.physics.core.metadata[index] < 255) {
            this.physics.core.metadata[index]++;
        }
    },

    // Handle evaporation and absorption based on position and stuck counter
    handleEvaporationAndAbsorption: function(index, y, stuckCounter, groundLevel) {
        // Surface water evaporation
        if (y >= groundLevel - 2 && y <= groundLevel + 2) {
            if (stuckCounter > this.SURFACE_EVAPORATION_THRESHOLD && Math.random() < 0.3) {
                this.physics.core.type[index] = this.physics.TYPE.AIR;
                this.physics.core.water[index] = 0;
                return true;
            }
        }
        // Water above ground evaporation
        else if (y < groundLevel && stuckCounter > this.ABOVE_GROUND_EVAPORATION_THRESHOLD && Math.random() < 0.01) {
            this.physics.core.type[index] = this.physics.TYPE.AIR;
            this.physics.core.water[index] = 0;
            return true;
        }
        // Water below ground absorption
        else if (y > groundLevel && stuckCounter > this.BELOW_GROUND_ABSORPTION_THRESHOLD && Math.random() < 0.05) {
            this.physics.core.type[index] = this.physics.TYPE.SOIL;
            this.physics.core.state[index] = this.physics.STATE.WET;
            this.physics.core.water[index] = Math.min(255, this.physics.core.water[index]);
            this.physics.core.nutrient[index] = 10;
            return true;
        }

        return false;
    },

    // Handle downward water movement
    handleDownwardMovement: function(index, downIndex, x, y, groundLevel, nextActivePixels) {
        // Check what's below
        const belowType = this.physics.core.type[downIndex];

        switch (belowType) {
            case this.physics.TYPE.AIR:
                return this.moveWaterIntoAir(index, downIndex, nextActivePixels);

            case this.physics.TYPE.SOIL:
                return this.absorbWaterIntoSoil(index, downIndex, x, y, groundLevel, nextActivePixels);

            case this.physics.TYPE.PLANT:
                return this.handlePlantInteraction(index, downIndex, x, y, groundLevel, nextActivePixels);

            case this.physics.TYPE.INSECT:
                if (Math.random() < 0.10 * this.WATER_FLOW_RATE) {
                    return this.swapWaterWithElement(index, downIndex, nextActivePixels);
                }
                break;

            case this.physics.TYPE.WORM:
                if (Math.random() < 0.25) {
                    return this.swapWaterWithElement(index, downIndex, nextActivePixels);
                }
                break;

            case this.physics.TYPE.SEED:
                if (Math.random() < 0.2) {
                    return this.swapWaterWithElement(index, downIndex, nextActivePixels);
                }
                break;

            case this.physics.TYPE.DEAD_MATTER:
                if (Math.random() < 0.3) {
                    return this.swapWaterWithElement(index, downIndex, nextActivePixels);
                }
                break;
        }

        return false;
    },

    // Move water into air
    moveWaterIntoAir: function(fromIndex, toIndex, nextActivePixels) {
        this.physics.core.type[toIndex] = this.physics.TYPE.WATER;
        this.physics.core.water[toIndex] = this.physics.core.water[fromIndex];
        this.physics.core.type[fromIndex] = this.physics.TYPE.AIR;
        this.physics.core.water[fromIndex] = 0;

        this.physics.processedThisFrame[toIndex] = 1;
        nextActivePixels.add(toIndex);
        return true;
    },

    // Absorb water into soil
    absorbWaterIntoSoil: function(waterIndex, soilIndex, x, y, groundLevel, nextActivePixels) {
        // Determine soil saturation limit based on depth
        const soilCoords = this.physics.core.getCoords(soilIndex);
        
        // Check if this is at the soil-air boundary
        const isAtSoilLine = this.physics.core.isAtSoilAirBoundary(soilCoords.x, soilCoords.y, this.physics.frameCount);
        
        // Use the core's soil line position checker instead of just using groundLevel
        const depthBelowSurface = this.physics.core.getSoilLinePosition(soilCoords.x, soilCoords.y, this.physics.frameCount);

        // Surface soil has lower saturation (drains faster), deeper soil has higher capacity
        let soilCapacity = 255;
        
        // If at the soil-air boundary or just below it
        if (isAtSoilLine || depthBelowSurface <= 5) {
            // Top layers of soil have high absorption but not infinite
            soilCapacity = Math.min(255, this.SHALLOW_SOIL_WATER_CAPACITY);
        }

        // Absorb water if not oversaturated
        if (this.physics.core.water[soilIndex] < soilCapacity) {
            // Transfer amount is a percentage of the water based on soil depth
            const transferRate = isAtSoilLine ? 0.98 : 0.90;  // Higher transfer at the soil-air boundary
            const transferAmount = Math.max(
                Math.floor(this.physics.core.water[waterIndex] * transferRate),
                Math.min(80, this.physics.core.water[waterIndex])
            );

            // Ensure we don't exceed soil's capacity
            const effectiveTransfer = Math.min(transferAmount, soilCapacity - this.physics.core.water[soilIndex]);
            
            this.physics.core.water[soilIndex] += effectiveTransfer;
            this.physics.core.water[waterIndex] -= effectiveTransfer;
            
            // Update soil states
            if (this.physics.core.water[soilIndex] > 20) {
                this.physics.core.state[soilIndex] = this.physics.STATE.WET;
            }

            // Make sure soil stays active to continue water propagation
            nextActivePixels.add(soilIndex);

            // If water is depleted or nearly depleted, convert appropriately
            if (this.physics.core.water[waterIndex] <= 2) {
                this.convertWaterByElevation(waterIndex, y, groundLevel);
            } else {
                nextActivePixels.add(waterIndex);
            }

            return true;
        }
        // Even if soil is saturated, still try to absorb some water
        else {
            // Soil is saturated, but still allow minimal absorption to prevent water buildup
            const drainAmount = Math.min(20, this.physics.core.water[waterIndex]);
            this.physics.core.water[waterIndex] -= drainAmount;

            // Keep soil active for water movement
            nextActivePixels.add(soilIndex);

            // If water is depleted, convert appropriately
            if (this.physics.core.water[waterIndex] <= 0) {
                this.convertWaterByElevation(waterIndex, y, groundLevel);
            } else {
                nextActivePixels.add(waterIndex);
            }

            return true;
        }
    },

    // Handle interaction between water and plants
    handlePlantInteraction: function(waterIndex, plantIndex, x, y, groundLevel, nextActivePixels) {
        // Different interactions based on plant part
        const plantState = this.physics.core.state[plantIndex];

        // FIXED: Roots can absorb water without displacement
        if (plantState === this.physics.STATE.ROOT) {
            if (Math.random() < 0.7) { // Increased from 0.5 to 0.7
                // Roots absorb water without moving the plant
                const absorbAmount = Math.min(30, this.physics.core.water[waterIndex] * 0.9); // Absorb 90% rather than all water
                this.physics.core.water[plantIndex] += absorbAmount;
                this.physics.core.water[waterIndex] -= absorbAmount;

                // Only convert water to air/soil if truly depleted
                // Leave a minimum amount of water to prevent air bubble creation
                if (this.physics.core.water[waterIndex] <= 5) {
                    // Instead of converting to air, maintain as water with minimum value
                    // This prevents air bubbles from forming underground
                    if (y >= groundLevel) {
                        // Below ground - ensure it stays as water or converts to wet soil
                        if (Math.random() < 0.3) {
                            // Convert to wet soil sometimes
                            this.physics.core.type[waterIndex] = this.physics.TYPE.SOIL;
                            this.physics.core.state[waterIndex] = this.physics.STATE.WET;
                            this.physics.core.water[waterIndex] = 10; // Minimum water content
                            this.physics.core.nutrient[waterIndex] = 10; // Some basic nutrients
                        } else {
                            // Keep as water with minimum value
                            this.physics.core.water[waterIndex] = 5;
                        }
                    } else {
                        // Above ground - normal conversion to air is okay
                        this.physics.core.type[waterIndex] = this.physics.TYPE.AIR;
                        this.physics.core.water[waterIndex] = 0;
                    }
                }

                // Activate both pixels
                nextActivePixels.add(waterIndex);
                nextActivePixels.add(plantIndex);
                return true;
            }
        }
        // FIXED: Stems can absorb water or let it pass through
        else if (plantState === this.physics.STATE.STEM) {
            // Check if stem needs water (has room for more)
            if (this.physics.core.water[plantIndex] < 180 && Math.random() < 0.5) { // Increased from 150 to 180, and 0.4 to 0.5
                // Stems can absorb water directly
                const absorbAmount = Math.min(20, this.physics.core.water[waterIndex]); // Increased from 15 to 20
                this.physics.core.water[plantIndex] += absorbAmount;
                this.physics.core.water[waterIndex] -= absorbAmount;

                // If water is depleted, convert based on location
                if (this.physics.core.water[waterIndex] <= 0) {
                    this.convertWaterByElevation(waterIndex, y, groundLevel);
                }

                // Activate both pixels
                nextActivePixels.add(waterIndex);
                nextActivePixels.add(plantIndex);
                return true;
            }
            // FIXED: Water can occasionally pass through stems
            else if (Math.random() < 0.08) { // Increased from 0.05 to 0.08
                // Get the pixel below the stem
                const belowStemIndex = this.physics.core.getIndex(x, y + 2);
                if (belowStemIndex !== -1 &&
                    (this.physics.core.type[belowStemIndex] === this.physics.TYPE.AIR ||
                        this.physics.core.type[belowStemIndex] === this.physics.TYPE.WATER)) {

                    // Move water through the stem to the pixel below
                    if (this.physics.core.type[belowStemIndex] === this.physics.TYPE.AIR) {
                        this.physics.core.type[belowStemIndex] = this.physics.TYPE.WATER;
                        this.physics.core.water[belowStemIndex] = this.physics.core.water[waterIndex];
                    } else {
                        // Add water to existing water
                        this.physics.core.water[belowStemIndex] += this.physics.core.water[waterIndex];
                    }

                    // Convert original water appropriately
                    this.convertWaterByElevation(waterIndex, y, groundLevel);

                    // Activate all three pixels
                    nextActivePixels.add(waterIndex);
                    nextActivePixels.add(plantIndex);
                    nextActivePixels.add(belowStemIndex);
                    return true;
                }
            }
        }
        // FIXED: Leaves absorb water but block it from passing through
        else if (plantState === this.physics.STATE.LEAF) {
            // Check if leaf needs water
            if (this.physics.core.water[plantIndex] < 150) { // Increased from 120 to 150
                // Leaves can absorb water with high probability
                if (Math.random() < 0.45) { // Increased from 0.35 to 0.45
                    // Absorb a significant amount of water
                    const absorbAmount = Math.min(15, this.physics.core.water[waterIndex]); // Increased from 10 to 15
                    this.physics.core.water[plantIndex] += absorbAmount;
                    this.physics.core.water[waterIndex] -= absorbAmount;

                    // If water is depleted, convert appropriately
                    if (this.physics.core.water[waterIndex] <= 0) {
                        this.convertWaterByElevation(waterIndex, y, groundLevel);
                    }
                }
                // Smaller chance for minimal absorption (like dew on leaf)
                else if (Math.random() < 0.4) { // Increased from 0.3 to 0.4
                    // Minimal water transfer
                    this.physics.core.water[plantIndex] += 4; // Increased from 2 to 4
                    this.physics.core.water[waterIndex] -= 4; // Increased from 2 to 4

                    if (this.physics.core.water[waterIndex] <= 0) {
                        this.convertWaterByElevation(waterIndex, y, groundLevel);
                    }
                }
            }
            // Water pools on leaves (no passing through)
            nextActivePixels.add(waterIndex);
            nextActivePixels.add(plantIndex);
            return true;
        }

        // Default case - water doesn't pass through plant
        nextActivePixels.add(waterIndex);
        return true;
    },

    // Handle horizontal water spread
    handleHorizontalSpread: function(index, x, y, stuckCounter, groundLevel, nextActivePixels) {
        // Enhance horizontal spread near ground
        const isNearGround = y >= groundLevel - 8; // Increased range from groundLevel - 5

        // Randomize whether we check left or right first
        const checkLeftFirst = Math.random() < 0.5;

        // Get horizontal neighbors
        const leftIndex = this.physics.core.getIndex(x - 1, y);
        const rightIndex = this.physics.core.getIndex(x + 1, y);

        // Near ground, try both directions for faster spreading
        if (isNearGround) {
            let movedLeft = false;
            let movedRight = false;

            // Check downward movement chance first to encourage ground penetration
            const downIndex = this.physics.core.getIndex(x, y + 1);
            if (downIndex !== -1 && Math.random() < 0.8) { // High chance to check downward movement again
                const belowType = this.physics.core.type[downIndex];
                if (belowType === this.physics.TYPE.SOIL) {
                    if (this.absorbWaterIntoSoil(index, downIndex, x, y, groundLevel, nextActivePixels)) {
                        return true;
                    }
                }
            }

            movedLeft = this.tryMoveWaterHorizontal(index, leftIndex, nextActivePixels, groundLevel);

            // If water still exists, try right too
            if (this.physics.core.type[index] === this.physics.TYPE.WATER) {
                movedRight = this.tryMoveWaterHorizontal(index, rightIndex, nextActivePixels, groundLevel);
            }

            return (movedLeft || movedRight);
        }
        // Away from ground, try one direction at a time
        else {
            if (checkLeftFirst) {
                if (this.tryMoveWaterHorizontal(index, leftIndex, nextActivePixels, groundLevel)) return true;
                if (this.tryMoveWaterHorizontal(index, rightIndex, nextActivePixels, groundLevel)) return true;
            } else {
                if (this.tryMoveWaterHorizontal(index, rightIndex, nextActivePixels, groundLevel)) return true;
                if (this.tryMoveWaterHorizontal(index, leftIndex, nextActivePixels, groundLevel)) return true;
            }
        }

        return false;
    },

    // Handle diagonal water movement
    handleDiagonalMovement: function(index, x, y, groundLevel, nextActivePixels) {
        const checkLeftFirst = Math.random() < 0.5;

        // Get diagonal indices
        const downLeftIndex = this.physics.core.getIndex(x - 1, y + 1);
        const downRightIndex = this.physics.core.getIndex(x + 1, y + 1);

        if (checkLeftFirst) {
            if (this.tryMoveWaterDiagonal(index, downLeftIndex, nextActivePixels, groundLevel)) return true;
            if (this.tryMoveWaterDiagonal(index, downRightIndex, nextActivePixels, groundLevel)) return true;
        } else {
            if (this.tryMoveWaterDiagonal(index, downRightIndex, nextActivePixels, groundLevel)) return true;
            if (this.tryMoveWaterDiagonal(index, downLeftIndex, nextActivePixels, groundLevel)) return true;
        }

        return false;
    },

    // Handle stuck water with more aggressive measures
    handleStuckWater: function(index, x, y, stuckCounter, groundLevel, nextActivePixels) {
        // Try to move in any available direction
        const neighbors = this.physics.core.getNeighborIndices(x, y);

        // Sort neighbors to prioritize downward directions
        neighbors.sort((a, b) => {
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

                // Convert original water appropriately
                this.convertWaterByElevation(index, y, groundLevel);

                // Reset stuck counter on new position
                this.physics.core.metadata[neighbor.index] = 0;

                this.physics.processedThisFrame[neighbor.index] = 1;
                nextActivePixels.add(neighbor.index);
                return true;
            }
        }

        // If still stuck and underground for a while, convert to soil
        if (stuckCounter > 20 && y >= groundLevel) {
            this.physics.core.type[index] = this.physics.TYPE.SOIL;
            this.physics.core.state[index] = this.physics.STATE.WET;
            this.physics.core.water[index] = Math.min(255, this.physics.core.water[index]);
            this.physics.core.nutrient[index] = 10;
            this.physics.core.metadata[index] = 0;
            nextActivePixels.add(index);
            return true;
        }

        return false;
    },

    // Helper method to swap water with another element
    swapWaterWithElement: function(waterIndex, elementIndex, nextActivePixels) {
        // Use core's swap function for cleaner code
        this.physics.core.swapPixels(waterIndex, elementIndex);

        // Mark both as active
        this.physics.processedThisFrame[elementIndex] = 1;
        nextActivePixels.add(elementIndex);
        nextActivePixels.add(waterIndex);

        return true;
    },

    // Try to move water horizontally
    tryMoveWaterHorizontal: function(fromIndex, toIndex, nextActivePixels, groundLevel) {
        if (toIndex === -1) return false;

        const toType = this.physics.core.type[toIndex];
        
        // Check if we can move into this cell
        if (toType === this.physics.TYPE.AIR) {
            const fromCoords = this.physics.core.getCoords(fromIndex);
            const toCoords = this.physics.core.getCoords(toIndex);
            
            // Calculate water amount to transfer (more aggressive near ground)
            const isNearGround = fromCoords.y >= groundLevel - 5;
            const transferAmount = isNearGround 
                ? Math.floor(this.physics.core.water[fromIndex] / 1.5) // More aggressive transfer near ground
                : Math.floor(this.physics.core.water[fromIndex] / this.HORIZONTAL_TRANSFER_DIVIDER);
            
            if (transferAmount >= this.MIN_TRANSFER_AMOUNT) {
                // Create new water in target cell
                this.physics.core.type[toIndex] = this.physics.TYPE.WATER;
                this.physics.core.water[toIndex] = transferAmount;
                
                // Remove water from source cell
                this.physics.core.water[fromIndex] -= transferAmount;
                
                // If source is depleted, convert to air
                if (this.physics.core.water[fromIndex] <= 5) {
                    // Get coordinates to check if we're underground
                    const coords = this.physics.core.getCoords(fromIndex);
                    const groundLevel = this.getGroundLevel(coords.x);
                    
                    if (coords.y >= groundLevel) {
                        // Underground - convert to wet soil instead of air
                        this.physics.core.type[fromIndex] = this.physics.TYPE.SOIL;
                        this.physics.core.state[fromIndex] = this.physics.STATE.WET;
                        this.physics.core.water[fromIndex] = 10; // Minimum water
                        this.physics.core.nutrient[fromIndex] = 10; // Some nutrients
                    } else {
                        // Above ground - convert to air
                        this.physics.core.type[fromIndex] = this.physics.TYPE.AIR;
                        this.physics.core.water[fromIndex] = 0;
                    }
                }
                
                // Mark both cells active
                this.physics.processedThisFrame[toIndex] = 1;
                nextActivePixels.add(fromIndex);
                nextActivePixels.add(toIndex);
                
                return true;
            }
        } 
        // Enhanced soil absorption when water is moving horizontally near soil
        else if (toType === this.physics.TYPE.SOIL && Math.random() < 0.6) { // Increased from default probability
            const fromCoords = this.physics.core.getCoords(fromIndex);
            return this.absorbWaterIntoSoil(fromIndex, toIndex, fromCoords.x, fromCoords.y, groundLevel, nextActivePixels);
        }
        
        return false;
    },

    // Try to move water diagonally down
    tryMoveWaterDiagonal: function(fromIndex, toIndex, nextActivePixels, groundLevel) {
        if (toIndex === -1) return false;

        // Get position info for ground checking
        const coords = this.physics.core.getCoords(fromIndex);
        const isBelowGround = coords.y >= groundLevel;

        // Can only move into air
        if (this.physics.core.type[toIndex] === this.physics.TYPE.AIR) {
            // Get stuck counter
            const stuckCounter = this.physics.core.metadata[fromIndex] || 0;

            // Higher chance to move diagonally if stuck
            const moveProbability = stuckCounter > 5 ? 1.0 : 0.8;

            if (Math.random() < moveProbability) {
                // Transfer all water (full movement)
                this.physics.core.type[toIndex] = this.physics.TYPE.WATER;
                this.physics.core.water[toIndex] = this.physics.core.water[fromIndex];

                // Reset stuck counter for new position
                this.physics.core.metadata[toIndex] = 0;

                // Convert source to soil if below ground, air if above
                if (isBelowGround) {
                    this.physics.core.type[fromIndex] = this.physics.TYPE.SOIL;
                    this.physics.core.state[fromIndex] = this.physics.STATE.WET;
                    this.physics.core.water[fromIndex] = 10; // Minimum water to prevent air bubbles
                    this.physics.core.nutrient[fromIndex] = 5; // Minimal nutrients
                } else {
                    this.physics.core.type[fromIndex] = this.physics.TYPE.AIR;
                    this.physics.core.water[fromIndex] = 0;
                }

                // Activate both cells
                nextActivePixels.add(fromIndex);
                nextActivePixels.add(toIndex);

                return true;
            }
        }

        return false;
    }
};