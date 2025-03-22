// Fluid Dynamics System
// Handles water movement and fluid physics

const FluidDynamicsSystem = {
    // Reference to parent physics system
    physics: null,

    // Configuration constants
    WATER_FLOW_RATE: 30.5,            // Flow speed multiplier
    WATER_EMERGENCY_THRESHOLD: 10000,  // Trigger drainage when this many water pixels exist

    // Water transfer amounts
    VERTICAL_TRANSFER_DIVIDER: 4,     // Higher number = slower vertical flow
    HORIZONTAL_TRANSFER_DIVIDER: 2,   // Higher number = slower horizontal flow

    // Evaporation probabilities
    SURFACE_EVAPORATION_THRESHOLD: 10, // Stuck counter that increases evaporation chance
    ABOVE_GROUND_EVAPORATION_THRESHOLD: 20,
    BELOW_GROUND_ABSORPTION_THRESHOLD: 30,

    // Soil absorption rates
    MIN_TRANSFER_AMOUNT: 10,
    SHALLOW_SOIL_WATER_CAPACITY: 9999, // "Infinite" absorption for surface soil

    // Initialize fluid dynamics system
    init: function(physicsSystem) {
        this.physics = physicsSystem;
        console.log("Initializing fluid dynamics system...");
        return this;
    },

    // Main update function - processes active water pixels
    updateWaterMovement: function(activePixels, nextActivePixels) {
        // Collect and sort water pixels (bottom to top to prevent cascading)
        const waterPixels = this.collectWaterPixels(activePixels);

        // Check if emergency drainage is needed
        const emergencyDrainageNeeded = waterPixels.length > this.WATER_EMERGENCY_THRESHOLD;

        if (emergencyDrainageNeeded) {
            this.performEmergencyDrainage(waterPixels);
        }

        // Sort water pixels by y-position (descending, bottom pixels first)
        waterPixels.sort((a, b) => b.y - a.y);

        // Process each water pixel
        for (const pixel of waterPixels) {
            // Skip if already processed this frame
            if (this.physics.processedThisFrame[pixel.index]) continue;

            this.physics.processedThisFrame[pixel.index] = 1;

            // Handle emergency drainage
            if (emergencyDrainageNeeded && Math.random() < 0.2) {
                const groundLevel = this.getGroundLevel();
                this.convertWaterByElevation(pixel.index, pixel.y, groundLevel);
                continue;
            }

            this.updateSingleWaterPixel(pixel.x, pixel.y, pixel.index, nextActivePixels);
        }
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
    performEmergencyDrainage: function(waterPixels) {
        console.log("Emergency water drainage activated - removing excess water");

        // Identify ground level for drainage
        const groundLevel = this.getGroundLevel();

        // Find water pixels at ground level for removal
        const groundWaterPixels = waterPixels.filter(p =>
            p.y >= groundLevel - 3 && p.y <= groundLevel + 5
        );

        // Remove 40-50% of ground water
        const removalCount = Math.ceil(groundWaterPixels.length * 0.4 + Math.random() * 0.1);
        const toRemove = groundWaterPixels.slice(0, removalCount);

        // Actually remove the water
        toRemove.forEach(pixel => {
            this.physics.core.type[pixel.index] = this.physics.TYPE.AIR;
            this.physics.core.water[pixel.index] = 0;
            this.physics.processedThisFrame[pixel.index] = 1;
        });
    },

    // Convert water to air or soil based on elevation
    convertWaterByElevation: function(index, y, groundLevel) {
        if (y < groundLevel) {
            // Above ground - convert to air
            this.physics.core.type[index] = this.physics.TYPE.AIR;
            this.physics.core.water[index] = 0;
        } else {
            // Below ground - convert to soil
            this.physics.core.type[index] = this.physics.TYPE.SOIL;
            this.physics.core.state[index] = this.physics.STATE.WET;
            this.physics.core.water[index] = Math.min(255, this.physics.core.water[index]);
            this.physics.core.nutrient[index] = 10; // Some basic nutrients
        }
    },

    // Get ground level (reused in several places)
    getGroundLevel: function() {
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
        const groundLevel = this.getGroundLevel();

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
            if (stuckCounter > this.SURFACE_EVAPORATION_THRESHOLD && Math.random() < 0.5) {
                this.physics.core.type[index] = this.physics.TYPE.AIR;
                this.physics.core.water[index] = 0;
                return true;
            }
        }
        // Water above ground evaporation
        else if (y < groundLevel && stuckCounter > this.ABOVE_GROUND_EVAPORATION_THRESHOLD && Math.random() < 0.05) {
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
        const depthBelowSurface = soilCoords.y - groundLevel;

        // Surface soil has lower saturation (drains faster), deeper soil has higher capacity
        let soilCapacity = 255;
        if (depthBelowSurface < 5) {
            // Top layers of soil have "infinite" absorption (simulates drainage)
            soilCapacity = this.SHALLOW_SOIL_WATER_CAPACITY;
        }

        // Absorb water if not oversaturated
        if (this.physics.core.water[soilIndex] < soilCapacity) {
            // Transfer almost all water at once (95-100%)
            const transferAmount = Math.max(
                Math.floor(this.physics.core.water[waterIndex] * 0.95),
                Math.min(50, this.physics.core.water[waterIndex]) // At least 50 units if possible
            );

            this.physics.core.water[soilIndex] += transferAmount;
            this.physics.core.water[waterIndex] -= transferAmount;

            // Update soil states
            if (this.physics.core.water[soilIndex] > 20) {
                this.physics.core.state[soilIndex] = this.physics.STATE.WET;
            }

            // If water is depleted or nearly depleted, convert appropriately
            if (this.physics.core.water[waterIndex] <= 2) {
                this.convertWaterByElevation(waterIndex, y, groundLevel);
            } else {
                nextActivePixels.add(waterIndex);
            }

            nextActivePixels.add(soilIndex);
            return true;
        }
        // Even if soil is saturated, still try to absorb some water
        else if (Math.random() < 0.7) {
            // Simulate drainage by allowing oversaturated soil to still absorb water
            const drainAmount = Math.min(30, this.physics.core.water[waterIndex]);
            this.physics.core.water[waterIndex] -= drainAmount;

            // If water is depleted, convert appropriately
            if (this.physics.core.water[waterIndex] <= 0) {
                this.convertWaterByElevation(waterIndex, y, groundLevel);
            } else {
                nextActivePixels.add(waterIndex);
            }

            return true;
        }

        return false;
    },

    // Handle interaction between water and plants
    handlePlantInteraction: function(waterIndex, plantIndex, x, y, groundLevel, nextActivePixels) {
        // Different interactions based on plant part
        const plantState = this.physics.core.state[plantIndex];

        // Roots can absorb water without displacement
        if (plantState === this.physics.STATE.ROOT) {
            if (Math.random() < 0.5) {
                // Roots absorb water without moving the plant
                const absorbAmount = Math.min(20, this.physics.core.water[waterIndex]);
                this.physics.core.water[plantIndex] += absorbAmount;
                this.physics.core.water[waterIndex] -= absorbAmount;

                // If water is depleted, convert appropriately
                if (this.physics.core.water[waterIndex] <= 0) {
                    this.convertWaterByElevation(waterIndex, y, groundLevel);
                }

                // Activate both pixels
                nextActivePixels.add(waterIndex);
                nextActivePixels.add(plantIndex);
                return true;
            }
        }
        // Stems can absorb water or let it pass through
        else if (plantState === this.physics.STATE.STEM) {
            // Check if stem needs water (has room for more)
            if (this.physics.core.water[plantIndex] < 150 && Math.random() < 0.4) {
                // Stems can absorb water directly
                const absorbAmount = Math.min(15, this.physics.core.water[waterIndex]);
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
            // Water can occasionally pass through stems
            else if (Math.random() < 0.05) {
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
        // Leaves absorb water but block it from passing through
        else if (plantState === this.physics.STATE.LEAF) {
            // Check if leaf needs water
            if (this.physics.core.water[plantIndex] < 120) {
                // Leaves can absorb water with high probability
                if (Math.random() < 0.35) {
                    // Absorb a significant amount of water
                    const absorbAmount = Math.min(10, this.physics.core.water[waterIndex]);
                    this.physics.core.water[plantIndex] += absorbAmount;
                    this.physics.core.water[waterIndex] -= absorbAmount;

                    // If water is depleted, convert appropriately
                    if (this.physics.core.water[waterIndex] <= 0) {
                        this.convertWaterByElevation(waterIndex, y, groundLevel);
                    }
                }
                // Smaller chance for minimal absorption (like dew on leaf)
                else if (Math.random() < 0.3) {
                    // Minimal water transfer
                    this.physics.core.water[plantIndex] += 2;
                    this.physics.core.water[waterIndex] -= 2;

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
        const isNearGround = y >= groundLevel - 5;

        // Randomize whether we check left or right first
        const checkLeftFirst = Math.random() < 0.5;

        // Get horizontal neighbors
        const leftIndex = this.physics.core.getIndex(x - 1, y);
        const rightIndex = this.physics.core.getIndex(x + 1, y);

        // Near ground, try both directions for faster spreading
        if (isNearGround) {
            let movedLeft = false;
            let movedRight = false;

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

        // Get position info for ground checking
        const coords = this.physics.core.getCoords(fromIndex);
        const isBelowGround = coords.y >= groundLevel;

        // Can only move into air
        if (this.physics.core.type[toIndex] === this.physics.TYPE.AIR) {
            // Get stuck counter to help unstick water
            const stuckCounter = this.physics.core.metadata[fromIndex] || 0;

            // Check if water is at ground level
            const horizCoords = this.physics.core.getCoords(fromIndex);
            const horizontalGroundLevel = Math.floor(this.physics.core.height * 0.6);
            const isNearGround = horizCoords.y >= horizontalGroundLevel - 5;

            // Water can spread horizontally if:
            // 1. It has enough water level, OR
            // 2. It's been stuck for a while, OR
            // 3. It's at ground level
            if (this.physics.core.water[fromIndex] > 4 || stuckCounter > 3 || isNearGround) {
                // Ground level spreads more water
                const transferRatio = isNearGround ? 0.9 : // 90% at ground
                    (stuckCounter > 6 ? 0.8 : 0.5); // Otherwise use stuck counter

                // Calculate transfer amount
                const transferAmount = Math.floor(this.physics.core.water[fromIndex] * transferRatio);

                this.physics.core.type[toIndex] = this.physics.TYPE.WATER;
                this.physics.core.water[toIndex] = transferAmount;
                this.physics.core.water[fromIndex] -= transferAmount;

                // Reset stuck counter for the new water
                this.physics.core.metadata[toIndex] = 0;

                // If source water is too low, convert based on location
                if (this.physics.core.water[fromIndex] <= 1) {
                    if (isBelowGround) {
                        // Below ground - convert to soil
                        this.physics.core.type[fromIndex] = this.physics.TYPE.SOIL;
                        this.physics.core.state[fromIndex] = this.physics.STATE.WET;
                        this.physics.core.water[fromIndex] = 15;
                        this.physics.core.nutrient[fromIndex] = 10;
                    } else {
                        // Above ground - convert to air
                        this.physics.core.type[fromIndex] = this.physics.TYPE.AIR;
                        this.physics.core.water[fromIndex] = 0;
                    }
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
                    this.physics.core.water[fromIndex] = 15;
                    this.physics.core.nutrient[fromIndex] = 10;
                } else {
                    this.physics.core.type[fromIndex] = this.physics.TYPE.AIR;
                    this.physics.core.water[fromIndex] = 0;
                }

                this.physics.processedThisFrame[toIndex] = 1;
                nextActivePixels.add(toIndex);
                return true;
            }
        }

        return false;
    }
};