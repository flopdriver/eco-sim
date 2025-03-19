// Fluid Dynamics System
// Handles water movement and fluid physics

const FluidDynamicsSystem = {
    // Reference to parent physics system
    physics: null,

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

        // Sort water pixels by y-position (descending, so bottom pixels are processed first)
        waterPixels.sort((a, b) => b.y - a.y);

        // Process each water pixel
        for (const pixel of waterPixels) {
            // Skip if already processed this frame
            if (this.physics.processedThisFrame[pixel.index]) continue;

            this.physics.processedThisFrame[pixel.index] = 1;
            this.updateSingleWaterPixel(pixel.x, pixel.y, pixel.index, nextActivePixels);
        }
    },

    // Update a single water pixel
    updateSingleWaterPixel: function(x, y, index, nextActivePixels) {
        // Skip if not water anymore (might have been processed already)
        if (this.physics.core.type[index] !== this.physics.TYPE.WATER) return;

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
                    // Absorb into soil if not saturated
                    if (this.physics.core.water[downIndex] < 255) {
                        const transferAmount = Math.min(this.physics.core.water[index], 255 - this.physics.core.water[downIndex]);
                        this.physics.core.water[downIndex] += transferAmount;
                        this.physics.core.water[index] -= transferAmount;

                        // Update soil state
                        if (this.physics.core.water[downIndex] > 20) {
                            this.physics.core.state[downIndex] = this.physics.STATE.WET;
                        }

                        // If water is depleted, convert to air
                        if (this.physics.core.water[index] <= 0) {
                            this.physics.core.type[index] = this.physics.TYPE.AIR;
                        } else {
                            nextActivePixels.add(index);
                        }

                        nextActivePixels.add(downIndex);
                        return;
                    }
                    break;

                case this.physics.TYPE.PLANT:
                    // Allow water to pass through plants with some probability
                    // Different probabilities for different plant parts
                    let passChance = 0.1; // Base chance

                    // Adjust based on plant state (root, stem, leaf, etc.)
                    switch (this.physics.core.state[downIndex]) {
                        case this.physics.STATE.ROOT:
                            passChance = 0.3; // Roots absorb water, but also let it pass
                            break;
                        case this.physics.STATE.STEM:
                            passChance = 0.2; // Stems let some water pass
                            break;
                        case this.physics.STATE.LEAF:
                            passChance = 0.05; // Leaves block most water
                            break;
                        default:
                            passChance = 0.1;
                    }

                    if (Math.random() < passChance) {
                        // Water passes through the plant
                        this.swapWaterWithElement(index, downIndex, nextActivePixels);
                        return;
                    }
                    break;

                case this.physics.TYPE.INSECT:
                    // Allow water to pass through insects with small probability
                    if (Math.random() < 0.15) {
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
        // Randomize whether we check left or right first for more natural flow
        const checkLeftFirst = Math.random() < 0.5;

        // Get horizontal neighbors
        const leftIndex = this.physics.core.getIndex(x - 1, y);
        const rightIndex = this.physics.core.getIndex(x + 1, y);

        // Try first direction
        if (checkLeftFirst) {
            if (this.tryMoveWaterHorizontal(index, leftIndex, nextActivePixels)) return;
            if (this.tryMoveWaterHorizontal(index, rightIndex, nextActivePixels)) return;
        } else {
            if (this.tryMoveWaterHorizontal(index, rightIndex, nextActivePixels)) return;
            if (this.tryMoveWaterHorizontal(index, leftIndex, nextActivePixels)) return;
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
            // Water can only spread horizontally if it has enough pressure (water level)
            // This prevents single pixels of water from spreading endlessly
            if (this.physics.core.water[fromIndex] > 4) {
                // Move some water (not all) to create spread effect
                const transferAmount = Math.floor(this.physics.core.water[fromIndex] / 2);

                this.physics.core.type[toIndex] = this.physics.TYPE.WATER;
                this.physics.core.water[toIndex] = transferAmount;
                this.physics.core.water[fromIndex] -= transferAmount;

                // If source water is too low, convert back to air
                if (this.physics.core.water[fromIndex] <= 1) {
                    this.physics.core.type[fromIndex] = this.physics.TYPE.AIR;
                    this.physics.core.water[fromIndex] = 0;
                } else {
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
            // Transfer all water (full movement)
            this.physics.core.type[toIndex] = this.physics.TYPE.WATER;
            this.physics.core.water[toIndex] = this.physics.core.water[fromIndex];

            // Clear source pixel
            this.physics.core.type[fromIndex] = this.physics.TYPE.AIR;
            this.physics.core.water[fromIndex] = 0;

            this.physics.processedThisFrame[toIndex] = 1;
            nextActivePixels.add(toIndex);
            return true;
        }

        return false;
    }
};