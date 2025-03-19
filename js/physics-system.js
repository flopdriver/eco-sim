// Physics System
// Handles physical processes like fluid dynamics, gravity, and material interactions

const PhysicsSystem = {
    // Reference to core simulation
    core: null,

    // Physics settings
    gravity: true,         // Whether gravity is enabled
    fluidDynamics: true,   // Whether fluid dynamics are enabled
    erosion: true,         // Whether erosion is enabled

    // Type and state enums (will be populated by controller)
    TYPE: null,
    STATE: null,

    // Processing flags to avoid double updates
    processedThisFrame: null,

    // Initialize physics system
    init: function(core) {
        this.core = core;
        console.log("Initializing physics systems...");

        // Create processed flags array
        this.processedThisFrame = new Uint8Array(core.size);

        return this;
    },

    // Main update function
    update: function(activePixels, nextActivePixels) {
        // Reset processed flags
        this.processedThisFrame.fill(0);

        // Process water movement (fluid dynamics)
        if (this.fluidDynamics) {
            this.updateWaterMovement(activePixels, nextActivePixels);
        }

        // Process soil moisture movement
        this.updateSoilMoisture(activePixels, nextActivePixels);

        // Process falling objects (seeds, dead matter, etc)
        if (this.gravity) {
            this.updateGravity(activePixels, nextActivePixels);
        }

        // Process erosion (water eroding soil)
        if (this.erosion) {
            this.updateErosion(activePixels, nextActivePixels);
        }
    },

    // Update water movement (processes active water pixels)
    updateWaterMovement: function(activePixels, nextActivePixels) {
        // Process water movement from bottom to top to avoid cascading water in a single tick
        // First, collect all water pixels and sort them by y-position (bottom to top)
        const waterPixels = [];

        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.WATER) {
                const coords = this.core.getCoords(index);
                waterPixels.push({index, x: coords.x, y: coords.y});
            }
        });

        // Sort water pixels by y-position (descending, so bottom pixels are processed first)
        waterPixels.sort((a, b) => b.y - a.y);

        // Process each water pixel
        for (const pixel of waterPixels) {
            // Skip if already processed this frame
            if (this.processedThisFrame[pixel.index]) continue;

            this.processedThisFrame[pixel.index] = 1;
            this.updateSingleWaterPixel(pixel.x, pixel.y, pixel.index, nextActivePixels);
        }
    },

    // Update a single water pixel
    updateSingleWaterPixel: function(x, y, index, nextActivePixels) {
        // Skip if not water anymore (might have been processed already)
        if (this.core.type[index] !== this.TYPE.WATER) return;

        // Try to move down first (gravity)
        const downIndex = this.core.getIndex(x, y + 1);

        if (downIndex !== -1) {
            // Check what's below
            switch (this.core.type[downIndex]) {
                case this.TYPE.AIR:
                    // Move water down into air
                    this.core.type[downIndex] = this.TYPE.WATER;
                    this.core.water[downIndex] = this.core.water[index];
                    this.core.type[index] = this.TYPE.AIR;
                    this.core.water[index] = 0;

                    this.processedThisFrame[downIndex] = 1;
                    nextActivePixels.add(downIndex);
                    return;

                case this.TYPE.SOIL:
                    // Absorb into soil if not saturated
                    if (this.core.water[downIndex] < 255) {
                        const transferAmount = Math.min(this.core.water[index], 255 - this.core.water[downIndex]);
                        this.core.water[downIndex] += transferAmount;
                        this.core.water[index] -= transferAmount;

                        // Update soil state
                        if (this.core.water[downIndex] > 20) {
                            this.core.state[downIndex] = this.STATE.WET;
                        }

                        // If water is depleted, convert to air
                        if (this.core.water[index] <= 0) {
                            this.core.type[index] = this.TYPE.AIR;
                        } else {
                            nextActivePixels.add(index);
                        }

                        nextActivePixels.add(downIndex);
                        return;
                    }
                    break;
            }
        }

        // If can't move down, try to spread horizontally
        // Randomize whether we check left or right first for more natural flow
        const checkLeftFirst = Math.random() < 0.5;

        // Get horizontal neighbors
        const leftIndex = this.core.getIndex(x - 1, y);
        const rightIndex = this.core.getIndex(x + 1, y);

        // Try first direction
        if (checkLeftFirst) {
            if (this.tryMoveWaterHorizontal(index, leftIndex, nextActivePixels)) return;
            if (this.tryMoveWaterHorizontal(index, rightIndex, nextActivePixels)) return;
        } else {
            if (this.tryMoveWaterHorizontal(index, rightIndex, nextActivePixels)) return;
            if (this.tryMoveWaterHorizontal(index, leftIndex, nextActivePixels)) return;
        }

        // Try diagonal down movement if horizontal fails
        const downLeftIndex = this.core.getIndex(x - 1, y + 1);
        const downRightIndex = this.core.getIndex(x + 1, y + 1);

        if (checkLeftFirst) {
            if (this.tryMoveWaterDiagonal(index, downLeftIndex, nextActivePixels)) return;
            if (this.tryMoveWaterDiagonal(index, downRightIndex, nextActivePixels)) return;
        } else {
            if (this.tryMoveWaterDiagonal(index, downRightIndex, nextActivePixels)) return;
            if (this.tryMoveWaterDiagonal(index, downLeftIndex, nextActivePixels)) return;
        }

        // If still here, water couldn't move, but remains active
        nextActivePixels.add(index);
    },

    // Try to move water horizontally
    tryMoveWaterHorizontal: function(fromIndex, toIndex, nextActivePixels) {
        if (toIndex === -1) return false;

        // Can only move into air
        if (this.core.type[toIndex] === this.TYPE.AIR) {
            // Water can only spread horizontally if it has enough pressure (water level)
            // This prevents single pixels of water from spreading endlessly
            if (this.core.water[fromIndex] > 4) {
                // Move some water (not all) to create spread effect
                const transferAmount = Math.floor(this.core.water[fromIndex] / 2);

                this.core.type[toIndex] = this.TYPE.WATER;
                this.core.water[toIndex] = transferAmount;
                this.core.water[fromIndex] -= transferAmount;

                // If source water is too low, convert back to air
                if (this.core.water[fromIndex] <= 1) {
                    this.core.type[fromIndex] = this.TYPE.AIR;
                    this.core.water[fromIndex] = 0;
                } else {
                    nextActivePixels.add(fromIndex);
                }

                this.processedThisFrame[toIndex] = 1;
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
        if (this.core.type[toIndex] === this.TYPE.AIR) {
            // Transfer all water (full movement)
            this.core.type[toIndex] = this.TYPE.WATER;
            this.core.water[toIndex] = this.core.water[fromIndex];

            // Clear source pixel
            this.core.type[fromIndex] = this.TYPE.AIR;
            this.core.water[fromIndex] = 0;

            this.processedThisFrame[toIndex] = 1;
            nextActivePixels.add(toIndex);
            return true;
        }

        return false;
    },

    // Update soil moisture movement
    updateSoilMoisture: function(activePixels, nextActivePixels) {
        // Process only wet soil pixels
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.SOIL && this.core.water[index] > 20) {
                const coords = this.core.getCoords(index);
                this.updateSingleSoilMoisture(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Update a single soil moisture pixel
    updateSingleSoilMoisture: function(x, y, index, nextActivePixels) {
        // Skip if already processed or not soil anymore
        if (this.processedThisFrame[index] || this.core.type[index] !== this.TYPE.SOIL) return;

        this.processedThisFrame[index] = 1;

        // Water moves down through soil due to gravity (faster than sideways)
        // Soil also exchanges moisture with neighbors to balance levels

        // Check downward flow first (stronger than sideways)
        const downIndex = this.core.getIndex(x, y + 1);

        if (downIndex !== -1 && this.core.type[downIndex] === this.TYPE.SOIL) {
            // Water flows from higher moisture to lower moisture (always some down bias)
            const moistureDiff = this.core.water[index] - this.core.water[downIndex];

            if (moistureDiff > 0) {
                // Transfer amount based on difference (faster transfer with bigger difference)
                // Add a small bias for downward flow
                const transferAmount = Math.max(1, Math.floor(moistureDiff / 4) + 1);

                // Update moisture levels
                this.core.water[downIndex] += transferAmount;
                this.core.water[index] -= transferAmount;

                // Update soil states
                if (this.core.water[downIndex] > 20) {
                    this.core.state[downIndex] = this.STATE.WET;
                }

                if (this.core.water[index] <= 20) {
                    this.core.state[index] = this.STATE.DRY;
                }

                nextActivePixels.add(downIndex);
            }
        }

        // Only do horizontal moisture balancing occasionally (slower than vertical)
        if (Math.random() < 0.2) {
            // Get horizontal neighbors
            const horizontalNeighbors = [];
            const leftIndex = this.core.getIndex(x - 1, y);
            const rightIndex = this.core.getIndex(x + 1, y);

            if (leftIndex !== -1 && this.core.type[leftIndex] === this.TYPE.SOIL) {
                horizontalNeighbors.push(leftIndex);
            }

            if (rightIndex !== -1 && this.core.type[rightIndex] === this.TYPE.SOIL) {
                horizontalNeighbors.push(rightIndex);
            }

            // Pick one neighbor randomly
            if (horizontalNeighbors.length > 0) {
                const neighborIndex = horizontalNeighbors[Math.floor(Math.random() * horizontalNeighbors.length)];

                // Balance moisture (slower than vertical flow)
                const moistureDiff = this.core.water[index] - this.core.water[neighborIndex];

                // Only balance if there's a significant difference
                if (Math.abs(moistureDiff) > 10) {
                    // Direction of transfer depends on moisture difference
                    if (moistureDiff > 0) {
                        // Transfer from this pixel to neighbor
                        const transferAmount = Math.max(1, Math.floor(moistureDiff / 8));

                        this.core.water[neighborIndex] += transferAmount;
                        this.core.water[index] -= transferAmount;

                        // Update soil states
                        if (this.core.water[neighborIndex] > 20) {
                            this.core.state[neighborIndex] = this.STATE.WET;
                        }

                        if (this.core.water[index] <= 20) {
                            this.core.state[index] = this.STATE.DRY;
                        }
                    } else {
                        // Transfer from neighbor to this pixel
                        const transferAmount = Math.max(1, Math.floor(-moistureDiff / 8));

                        this.core.water[index] += transferAmount;
                        this.core.water[neighborIndex] -= transferAmount;

                        // Update soil states
                        if (this.core.water[index] > 20) {
                            this.core.state[index] = this.STATE.WET;
                        }

                        if (this.core.water[neighborIndex] <= 20) {
                            this.core.state[neighborIndex] = this.STATE.DRY;
                        }
                    }

                    nextActivePixels.add(neighborIndex);
                }
            }
        }

        // If soil still has significant moisture, keep it active
        if (this.core.water[index] > 20) {
            nextActivePixels.add(index);
        }
    },

    // Update gravity effects on objects
    updateGravity: function(activePixels, nextActivePixels) {
        // Process items that should fall: seeds, dead matter, some insects
        activePixels.forEach(index => {
            // Skip if already processed
            if (this.processedThisFrame[index]) return;

            const type = this.core.type[index];

            // Check if it's a type affected by gravity
            const affectedByGravity = (
                type === this.TYPE.SEED ||
                type === this.TYPE.DEAD_MATTER ||
                (type === this.TYPE.INSECT && Math.random() < 0.1) // Insects sometimes fall
            );

            if (affectedByGravity) {
                const coords = this.core.getCoords(index);
                this.applyGravity(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Apply gravity to a single pixel
    applyGravity: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.processedThisFrame[index] = 1;

        // Check below
        const downIndex = this.core.getIndex(x, y + 1);

        if (downIndex !== -1) {
            // Can only fall into air or water
            if (this.core.type[downIndex] === this.TYPE.AIR ||
                (this.core.type[downIndex] === this.TYPE.WATER && this.core.type[index] !== this.TYPE.INSECT)) {

                // Swap positions
                const tempType = this.core.type[downIndex];
                const tempWater = this.core.water[downIndex];

                // Move falling object down
                this.core.type[downIndex] = this.core.type[index];
                this.core.state[downIndex] = this.core.state[index];
                this.core.water[downIndex] = this.core.water[index];
                this.core.nutrient[downIndex] = this.core.nutrient[index];
                this.core.energy[downIndex] = this.core.energy[index];
                this.core.metadata[downIndex] = this.core.metadata[index];

                // Replace original position with what was below
                this.core.type[index] = tempType;
                this.core.state[index] = this.STATE.DEFAULT;
                this.core.water[index] = tempWater;
                this.core.nutrient[index] = 0;
                this.core.energy[index] = 0;
                this.core.metadata[index] = 0;

                // Mark both positions as active
                nextActivePixels.add(downIndex);
                if (tempType !== this.TYPE.AIR) {
                    nextActivePixels.add(index);
                }

                return true;
            }
        }

        // If couldn't fall straight down, try falling diagonally
        if (Math.random() < 0.3) { // Don't try every frame
            // Randomly choose left or right diagonal
            const diagonalX = x + (Math.random() < 0.5 ? -1 : 1);
            const diagonalIndex = this.core.getIndex(diagonalX, y + 1);

            if (diagonalIndex !== -1 && this.core.type[diagonalIndex] === this.TYPE.AIR) {
                // Same swap logic as above
                // Move falling object diagonally down
                this.core.type[diagonalIndex] = this.core.type[index];
                this.core.state[diagonalIndex] = this.core.state[index];
                this.core.water[diagonalIndex] = this.core.water[index];
                this.core.nutrient[diagonalIndex] = this.core.nutrient[index];
                this.core.energy[diagonalIndex] = this.core.energy[index];
                this.core.metadata[diagonalIndex] = this.core.metadata[index];

                // Replace original position with air
                this.core.type[index] = this.TYPE.AIR;
                this.core.state[index] = this.STATE.DEFAULT;
                this.core.water[index] = 0;
                this.core.nutrient[index] = 0;
                this.core.energy[index] = 0;
                this.core.metadata[index] = 0;

                // Mark new position as active
                nextActivePixels.add(diagonalIndex);

                return true;
            }
        }

        // If the object couldn't fall, keep it active so it tries again next frame
        // (but only if it's a type that should keep trying)
        if (this.core.type[index] === this.TYPE.SEED ||
            this.core.type[index] === this.TYPE.DEAD_MATTER) {
            nextActivePixels.add(index);
        }

        return false;
    },

    // Update erosion effects (water eroding soil)
    updateErosion: function(activePixels, nextActivePixels) {
        // Water has a chance to erode soil when flowing past it
        // Only process a subset of active water pixels each frame for performance
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.WATER && Math.random() < 0.05) {
                const coords = this.core.getCoords(index);
                this.processSingleErosion(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Process erosion for a single water pixel
    processSingleErosion: function(x, y, index, nextActivePixels) {
        // Water can erode adjacent soil
        // Get all neighbors
        const neighbors = this.core.getNeighborIndices(x, y);

        // Check each neighbor for soil
        for (const neighbor of neighbors) {
            if (this.core.type[neighbor.index] === this.TYPE.SOIL && this.TYPE.PLANT && this.TYPE.INSECT) {
                // Erosion is more likely for soil with low nutrients
                // and is affected by water content
                const erosionChance = 100 * (100 + (this.core.water[index] / 255));

                if (Math.random() < erosionChance) {
                    // Erode the soil - convert to water
                    this.core.type[neighbor.index] = this.TYPE.WATER;
                    this.core.water[neighbor.index] = this.core.water[index];
                    this.core.state[neighbor.index] = this.STATE.DEFAULT;

                    // Add nutrients to the water from the eroded soil
                    this.core.nutrient[neighbor.index] += this.core.nutrient[neighbor.index];

                    nextActivePixels.add(neighbor.index);
                    break; // Only erode one soil pixel per water pixel per frame
                }
            }
        }
    }
};