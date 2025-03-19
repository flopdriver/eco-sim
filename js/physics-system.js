// Physics System
// Handles physical processes like fluid dynamics, gravity, and material interactions

const PhysicsSystem = {
    // Reference to core simulation
    core: null,

    // Physics settings
    gravity: true,         // Whether gravity is enabled
    fluidDynamics: true,   // Whether fluid dynamics are enabled
    erosion: true,         // Whether erosion is enabled

    // Water physics settings
    waterSettings: {
        pressureTransfer: true,    // Whether water pressure affects flow
        minPressureToSpread: 3,    // Minimum water amount to cause horizontal spread
        waterAbsorptionRates: {    // How quickly different materials absorb water (0-1)
            [undefined]: 0,        // Default (will be set during init)
            // Other rates will be set in init from TYPE enum
        },
        waterPermeability: {       // How easily water flows through materials (0-1)
            [undefined]: 0,        // Default (will be set during init)
            // Other values will be set in init from TYPE enum
        }
    },

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

        // Setup water absorption and permeability rates once enums are available
        this.initWaterPhysics();

        return this;
    },

    // Initialize water physics settings
    initWaterPhysics: function() {
        // Don't proceed if TYPE enum isn't available yet
        if (!this.TYPE) return;

        // Set water absorption rates (0-1 scale, how quickly material absorbs water)
        this.waterSettings.waterAbsorptionRates = {
            [this.TYPE.AIR]: 0,           // Air doesn't absorb water
            [this.TYPE.WATER]: 0,         // Water doesn't absorb more water
            [this.TYPE.SOIL]: 0.8,        // Soil absorbs water quickly
            [this.TYPE.PLANT]: 0.4,       // Plants absorb water moderately
            [this.TYPE.INSECT]: 0.05,     // Insects absorb minimal water
            [this.TYPE.SEED]: 0.2,        // Seeds absorb some water
            [this.TYPE.DEAD_MATTER]: 0.6, // Dead matter absorbs water well
            [this.TYPE.WORM]: 0.1         // Worms absorb minimal water
        };

        // Set water permeability (0-1 scale, how easily water flows through material)
        this.waterSettings.waterPermeability = {
            [this.TYPE.AIR]: 1.0,          // Water flows freely through air
            [this.TYPE.WATER]: 1.0,        // Water combines with water
            [this.TYPE.SOIL]: 0.4,         // Soil has moderate permeability
            [this.TYPE.PLANT]: 0.3,        // Plants have moderate-low permeability
            [this.TYPE.INSECT]: 0.05,      // Insects block water flow substantially
            [this.TYPE.SEED]: 0.1,         // Seeds mostly block water
            [this.TYPE.DEAD_MATTER]: 0.5,  // Dead matter has moderate permeability
            [this.TYPE.WORM]: 0.1          // Worms mostly block water
        };
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

    // Calculate water pressure based on height of water column and amount
    getWaterPressure: function(x, y, index) {
        // Base pressure is the water amount in this pixel
        let pressure = this.core.water[index];

        // Add additional pressure from water above (simplified model)
        let checkY = y - 1;
        let waterHeight = 0;

        // Look up to 5 pixels above for water column
        while (checkY >= Math.max(0, y - 5)) {
            const aboveIndex = this.core.getIndex(x, checkY);
            if (aboveIndex === -1 || this.core.type[aboveIndex] !== this.TYPE.WATER) {
                break;
            }

            // Water above adds to pressure
            pressure += this.core.water[aboveIndex] * 0.5; // Half effect for each higher level
            waterHeight++;
            checkY--;
        }

        // Adjust pressure by water column height
        pressure *= (1 + (waterHeight * 0.2));

        return pressure;
    },

    // Update a single water pixel
    updateSingleWaterPixel: function(x, y, index, nextActivePixels) {
        // Skip if not water anymore (might have been processed already)
        if (this.core.type[index] !== this.TYPE.WATER) return;

        // Calculate water pressure for this pixel
        const waterPressure = this.getWaterPressure(x, y, index);

        // Try to move down first (gravity)
        const downIndex = this.core.getIndex(x, y + 1);

        if (downIndex !== -1) {
            const downType = this.core.type[downIndex];

            // Handle the different materials below the water
            switch (downType) {
                case this.TYPE.AIR:
                    // Move water down into air (full flow)
                    this.core.type[downIndex] = this.TYPE.WATER;
                    this.core.water[downIndex] = this.core.water[index];
                    this.core.type[index] = this.TYPE.AIR;
                    this.core.water[index] = 0;

                    this.processedThisFrame[downIndex] = 1;
                    nextActivePixels.add(downIndex);
                    return;

                case this.TYPE.WATER:
                    // Balance water between cells (mixing)
                    if (this.core.water[downIndex] < this.core.water[index]) {
                        // Balance the water levels - move water down
                        const diff = this.core.water[index] - this.core.water[downIndex];
                        const transferAmount = Math.max(1, Math.floor(diff / 2));

                        this.core.water[downIndex] += transferAmount;
                        this.core.water[index] -= transferAmount;

                        nextActivePixels.add(downIndex);
                        nextActivePixels.add(index);
                        return;
                    }
                    break;

                default:
                    // For all other materials, check absorption based on material's absorption rate
                    const absorbRate = this.waterSettings.waterAbsorptionRates[downType] || 0;

                    if (absorbRate > 0) {
                        // Materials with higher absorption will take more water
                        const maxAbsorption = Math.floor(this.core.water[index] * absorbRate);

                        if (maxAbsorption > 0) {
                            // Actual transfer depends on current water in target and capacity
                            const transferAmount = Math.min(maxAbsorption, 255 - this.core.water[downIndex]);

                            if (transferAmount > 0) {
                                this.core.water[downIndex] += transferAmount;
                                this.core.water[index] -= transferAmount;

                                // Special handling for soil
                                if (downType === this.TYPE.SOIL && this.core.water[downIndex] > 20) {
                                    this.core.state[downIndex] = this.STATE.WET;
                                }

                                // Special handling for plants - they benefit from absorbed water
                                if (downType === this.TYPE.PLANT) {
                                    // Plants get a small energy boost from absorbing water
                                    this.core.energy[downIndex] = Math.min(255, this.core.energy[downIndex] + 2);
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
                        }
                    }

                    // Check permeability - if material allows water to pass through
                    const permeability = this.waterSettings.waterPermeability[downType] || 0;

                    // If water pressure is high enough, water can flow through permeable materials
                    if (permeability > 0 && waterPressure > 200 * (1 - permeability)) {
                        // High-pressure water can displace some materials (like dead matter or seeds)
                        if (downType === this.TYPE.DEAD_MATTER || downType === this.TYPE.SEED) {
                            // Swap positions - water flows down, material gets pushed up
                            const tempWater = this.core.water[index];

                            // Preserve the item's properties
                            const tempType = this.core.type[downIndex];
                            const tempState = this.core.state[downIndex];
                            const tempEnergy = this.core.energy[downIndex];
                            const tempNutrient = this.core.nutrient[downIndex];

                            // Move water down
                            this.core.type[downIndex] = this.TYPE.WATER;
                            this.core.water[downIndex] = tempWater;
                            this.core.state[downIndex] = this.STATE.DEFAULT;
                            this.core.energy[downIndex] = 0;
                            this.core.nutrient[downIndex] = 0;

                            // Move object up
                            this.core.type[index] = tempType;
                            this.core.state[index] = tempState;
                            this.core.energy[index] = tempEnergy;
                            this.core.nutrient[index] = tempNutrient;
                            this.core.water[index] = 0;

                            nextActivePixels.add(downIndex);
                            nextActivePixels.add(index);
                            return;
                        }
                    }
                    break;
            }
        }

        // If water can't move straight down, or if there's pressure, try to spread horizontally
        if (waterPressure > this.waterSettings.minPressureToSpread) {
            // Randomize whether we check left or right first for more natural flow
            const checkLeftFirst = Math.random() < 0.5;

            // Get horizontal neighbors
            const leftIndex = this.core.getIndex(x - 1, y);
            const rightIndex = this.core.getIndex(x + 1, y);

            // Try first direction
            if (checkLeftFirst) {
                if (this.tryMoveWaterHorizontal(index, leftIndex, waterPressure, nextActivePixels)) return;
                if (this.tryMoveWaterHorizontal(index, rightIndex, waterPressure, nextActivePixels)) return;
            } else {
                if (this.tryMoveWaterHorizontal(index, rightIndex, waterPressure, nextActivePixels)) return;
                if (this.tryMoveWaterHorizontal(index, leftIndex, waterPressure, nextActivePixels)) return;
            }

            // Try diagonal down movement if horizontal fails
            const downLeftIndex = this.core.getIndex(x - 1, y + 1);
            const downRightIndex = this.core.getIndex(x + 1, y + 1);

            if (checkLeftFirst) {
                if (this.tryMoveWaterDiagonal(index, downLeftIndex, waterPressure, nextActivePixels)) return;
                if (this.tryMoveWaterDiagonal(index, downRightIndex, waterPressure, nextActivePixels)) return;
            } else {
                if (this.tryMoveWaterDiagonal(index, downRightIndex, waterPressure, nextActivePixels)) return;
                if (this.tryMoveWaterDiagonal(index, downLeftIndex, waterPressure, nextActivePixels)) return;
            }

            // If pressure is very high, check upward movement (water can spray upward)
            if (waterPressure > 180) {
                const upIndex = this.core.getIndex(x, y - 1);
                if (upIndex !== -1 && this.core.type[upIndex] === this.TYPE.AIR) {
                    // High pressure water can move upward (like a fountain)
                    const transferAmount = Math.min(Math.floor(this.core.water[index] * 0.3),
                        Math.floor((waterPressure - 180) / 3));

                    if (transferAmount > 0) {
                        this.core.type[upIndex] = this.TYPE.WATER;
                        this.core.water[upIndex] = transferAmount;
                        this.core.water[index] -= transferAmount;

                        if (this.core.water[index] <= 0) {
                            this.core.type[index] = this.TYPE.AIR;
                        } else {
                            nextActivePixels.add(index);
                        }

                        nextActivePixels.add(upIndex);
                        return;
                    }
                }
            }
        }

        // If still here, water couldn't move, but remains active
        nextActivePixels.add(index);
    },

    // Try to move water horizontally
    tryMoveWaterHorizontal: function(fromIndex, toIndex, pressure, nextActivePixels) {
        if (toIndex === -1) return false;

        const toType = this.core.type[toIndex];

        // Handle different target materials
        switch (toType) {
            case this.TYPE.AIR:
                // Water can spread into air if it has enough pressure
                if (this.core.water[fromIndex] > this.waterSettings.minPressureToSpread) {
                    // Amount transferred depends on pressure - higher pressure transfers more
                    const pressureFactor = Math.min(1.0, pressure / 150);
                    const transferAmount = Math.max(1, Math.floor(this.core.water[fromIndex] * 0.5 * pressureFactor));

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
                break;

            case this.TYPE.WATER:
                // Balance water between cells horizontally (slower than vertical)
                if (Math.abs(this.core.water[fromIndex] - this.core.water[toIndex]) > 4) {
                    // Balance water levels - move from higher to lower
                    const diff = this.core.water[fromIndex] - this.core.water[toIndex];
                    const transferAmount = Math.max(1, Math.floor(Math.abs(diff) / 4));

                    if (diff > 0) {
                        // Transfer from fromIndex to toIndex
                        this.core.water[toIndex] += transferAmount;
                        this.core.water[fromIndex] -= transferAmount;
                    } else {
                        // Transfer from toIndex to fromIndex
                        this.core.water[fromIndex] += transferAmount;
                        this.core.water[toIndex] -= transferAmount;
                    }

                    nextActivePixels.add(toIndex);
                    nextActivePixels.add(fromIndex);
                    return true;
                }
                break;

            default:
                // For all other materials, check absorption and permeability
                const absorbRate = this.waterSettings.waterAbsorptionRates[toType] || 0;

                if (absorbRate > 0) {
                    // Materials with higher absorption will take more water
                    const maxAbsorption = Math.floor(this.core.water[fromIndex] * absorbRate * 0.3);

                    if (maxAbsorption > 0) {
                        // Horizontal absorption is less efficient
                        const transferAmount = Math.min(maxAbsorption, 255 - this.core.water[toIndex]);

                        if (transferAmount > 0) {
                            this.core.water[toIndex] += transferAmount;
                            this.core.water[fromIndex] -= transferAmount;

                            // Special handling for materials
                            if (toType === this.TYPE.SOIL && this.core.water[toIndex] > 20) {
                                this.core.state[toIndex] = this.STATE.WET;
                            }

                            if (this.core.water[fromIndex] <= 0) {
                                this.core.type[fromIndex] = this.TYPE.AIR;
                            } else {
                                nextActivePixels.add(fromIndex);
                            }

                            nextActivePixels.add(toIndex);
                            return true;
                        }
                    }
                }

                // High pressure water can flow through permeable materials
                const permeability = this.waterSettings.waterPermeability[toType] || 0;

                if (permeability > 0 && pressure > 220 * (1 - permeability)) {
                    // Very high pressure can push through some materials horizontally
                    if (toType === this.TYPE.DEAD_MATTER ||
                        toType === this.TYPE.SEED ||
                        (toType === this.TYPE.PLANT && this.core.state[toIndex] !== this.STATE.ROOT)) {

                        // Swap positions with high pressure
                        const tempWater = this.core.water[fromIndex];

                        // Preserve the item's properties
                        const tempType = this.core.type[toIndex];
                        const tempState = this.core.state[toIndex];
                        const tempEnergy = this.core.energy[toIndex];
                        const tempNutrient = this.core.nutrient[toIndex];
                        const tempMetadata = this.core.metadata[toIndex];

                        // Move water to target position
                        this.core.type[toIndex] = this.TYPE.WATER;
                        this.core.water[toIndex] = tempWater;
                        this.core.state[toIndex] = this.STATE.DEFAULT;
                        this.core.energy[toIndex] = 0;
                        this.core.nutrient[toIndex] = 0;
                        this.core.metadata[toIndex] = 0;

                        // Move object to source position
                        this.core.type[fromIndex] = tempType;
                        this.core.state[fromIndex] = tempState;
                        this.core.energy[fromIndex] = tempEnergy;
                        this.core.nutrient[fromIndex] = tempNutrient;
                        this.core.metadata[fromIndex] = tempMetadata;
                        this.core.water[fromIndex] = 0;

                        nextActivePixels.add(toIndex);
                        nextActivePixels.add(fromIndex);
                        return true;
                    }
                }
                break;
        }

        return false;
    },

    // Try to move water diagonally down
    tryMoveWaterDiagonal: function(fromIndex, toIndex, pressure, nextActivePixels) {
        if (toIndex === -1) return false;

        const toType = this.core.type[toIndex];

        // Handle different target materials for diagonal movement
        switch (toType) {
            case this.TYPE.AIR:
                // Movement into air is always possible
                // Amount transferred depends on pressure but is higher for diagonal
                // (water naturally wants to flow down)
                const pressureFactor = Math.min(1.0, pressure / 100);
                const transferAmount = Math.max(Math.floor(this.core.water[fromIndex] * 0.7 * pressureFactor),
                    Math.min(4, this.core.water[fromIndex]));

                if (transferAmount <= 0) return false;

                this.core.type[toIndex] = this.TYPE.WATER;
                this.core.water[toIndex] = transferAmount;
                this.core.water[fromIndex] -= transferAmount;

                // If source water is depleted, convert to air
                if (this.core.water[fromIndex] <= 1) {
                    this.core.type[fromIndex] = this.TYPE.AIR;
                    this.core.water[fromIndex] = 0;
                } else {
                    nextActivePixels.add(fromIndex);
                }

                this.processedThisFrame[toIndex] = 1;
                nextActivePixels.add(toIndex);
                return true;

            case this.TYPE.WATER:
                // Balance water between cells diagonally (slower than vertical, faster than horizontal)
                if (Math.abs(this.core.water[fromIndex] - this.core.water[toIndex]) > 3) {
                    // Movement tends downward, so favor transfer from fromIndex to toIndex
                    const transferAmount = Math.max(1, Math.floor(this.core.water[fromIndex] / 5));

                    this.core.water[toIndex] += transferAmount;
                    this.core.water[fromIndex] -= transferAmount;

                    nextActivePixels.add(toIndex);
                    nextActivePixels.add(fromIndex);
                    return true;
                }
                break;

            default:
                // For other materials, check absorption rates
                const absorbRate = this.waterSettings.waterAbsorptionRates[toType] || 0;

                if (absorbRate > 0) {
                    // Diagonal absorption is more efficient than horizontal but less than vertical
                    const maxAbsorption = Math.floor(this.core.water[fromIndex] * absorbRate * 0.5);

                    if (maxAbsorption > 0) {
                        const transferAmount = Math.min(maxAbsorption, 255 - this.core.water[toIndex]);

                        if (transferAmount > 0) {
                            this.core.water[toIndex] += transferAmount;
                            this.core.water[fromIndex] -= transferAmount;

                            // Special handling for materials
                            if (toType === this.TYPE.SOIL && this.core.water[toIndex] > 20) {
                                this.core.state[toIndex] = this.STATE.WET;
                            }

                            if (this.core.water[fromIndex] <= 0) {
                                this.core.type[fromIndex] = this.TYPE.AIR;
                            } else {
                                nextActivePixels.add(fromIndex);
                            }

                            nextActivePixels.add(toIndex);
                            return true;
                        }
                    }
                }

                // High pressure water can flow through permeable materials
                const permeability = this.waterSettings.waterPermeability[toType] || 0;

                if (permeability > 0 && pressure > 180 * (1 - permeability)) {
                    // Diagonally, water has more force due to gravity
                    if (toType === this.TYPE.DEAD_MATTER ||
                        toType === this.TYPE.SEED ||
                        (toType === this.TYPE.PLANT && this.core.state[toIndex] !== this.STATE.ROOT)) {

                        // Swap positions with high pressure
                        const tempWater = this.core.water[fromIndex];

                        // Preserve item properties
                        const tempType = this.core.type[toIndex];
                        const tempState = this.core.state[toIndex];
                        const tempEnergy = this.core.energy[toIndex];
                        const tempNutrient = this.core.nutrient[toIndex];
                        const tempMetadata = this.core.metadata[toIndex];

                        // Move water to target position
                        this.core.type[toIndex] = this.TYPE.WATER;
                        this.core.water[toIndex] = tempWater;
                        this.core.state[toIndex] = this.STATE.DEFAULT;
                        this.core.energy[toIndex] = 0;
                        this.core.nutrient[toIndex] = 0;
                        this.core.metadata[toIndex] = 0;

                        // Move object to source position
                        this.core.type[fromIndex] = tempType;
                        this.core.state[fromIndex] = tempState;
                        this.core.energy[fromIndex] = tempEnergy;
                        this.core.nutrient[fromIndex] = tempNutrient;
                        this.core.metadata[fromIndex] = tempMetadata;
                        this.core.water[fromIndex] = 0;

                        nextActivePixels.add(toIndex);
                        nextActivePixels.add(fromIndex);
                        return true;
                    }
                }
                break;
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

        // Check if soil has plant roots nearby - transfer moisture to roots
        if (this.core.water[index] > 30) {
            const neighbors = this.core.getNeighborIndices(x, y);
            const rootNeighbors = neighbors.filter(n =>
                this.core.type[n.index] === this.TYPE.PLANT &&
                this.core.state[n.index] === this.STATE.ROOT
            );

            if (rootNeighbors.length > 0) {
                // Transfer water to a random root
                const rootIndex = rootNeighbors[Math.floor(Math.random() * rootNeighbors.length)].index;
                const transferAmount = Math.min(this.core.water[index] / 4, 255 - this.core.water[rootIndex]);

                if (transferAmount > 0) {
                    // Roots actively pull water from soil
                    this.core.water[rootIndex] += transferAmount;
                    this.core.water[index] -= transferAmount;

                    // Add energy to root when it absorbs water
                    this.core.energy[rootIndex] = Math.min(255, this.core.energy[rootIndex] + 1);

                    nextActivePixels.add(rootIndex);
                }
            }
        }

        // Check downward flow first (stronger than sideways)
        const downIndex = this.core.getIndex(x, y + 1);

        if (downIndex !== -1) {
            const downType = this.core.type[downIndex];

            if (downType === this.TYPE.SOIL) {
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
            } else if (downType === this.TYPE.PLANT && this.core.state[downIndex] === this.STATE.ROOT) {
                // Water can flow directly to plant roots below
                const transferAmount = Math.floor(this.core.water[index] / 5);

                if (transferAmount > 0) {
                    // Roots actively absorb water
                    this.core.water[downIndex] += transferAmount;
                    this.core.water[index] -= transferAmount;

                    // Roots gain energy from absorbed water
                    this.core.energy[downIndex] = Math.min(255, this.core.energy[downIndex] + 1);

                    if (this.core.water[index] <= 20) {
                        this.core.state[index] = this.STATE.DRY;
                    }

                    nextActivePixels.add(downIndex);
                }
            }
        }

        // Horizontal water distribution (capillary action in soil)
        if (this.core.water[index] > 30 && Math.random() < 0.3) {
            // Get horizontal neighbors
            const horizontalNeighbors = [];
            const leftIndex = this.core.getIndex(x - 1, y);
            const rightIndex = this.core.getIndex(x + 1, y);

            // Check left neighbor
            if (leftIndex !== -1) {
                const leftType = this.core.type[leftIndex];

                if (leftType === this.TYPE.SOIL) {
                    horizontalNeighbors.push({index: leftIndex, type: leftType});
                } else if (leftType === this.TYPE.PLANT && this.core.state[leftIndex] === this.STATE.ROOT) {
                    // Roots have priority for water absorption
                    const transferAmount = Math.min(Math.floor(this.core.water[index] / 6),
                        255 - this.core.water[leftIndex]);

                    if (transferAmount > 0) {
                        this.core.water[leftIndex] += transferAmount;
                        this.core.water[index] -= transferAmount;
                        this.core.energy[leftIndex] = Math.min(255, this.core.energy[leftIndex] + 1);

                        nextActivePixels.add(leftIndex);
                    }
                }
            }

            // Check right neighbor
            if (rightIndex !== -1) {
                const rightType = this.core.type[rightIndex];

                if (rightType === this.TYPE.SOIL) {
                    horizontalNeighbors.push({index: rightIndex, type: rightType});
                } else if (rightType === this.TYPE.PLANT && this.core.state[rightIndex] === this.STATE.ROOT) {
                    // Roots have priority for water absorption
                    const transferAmount = Math.min(Math.floor(this.core.water[index] / 6),
                        255 - this.core.water[rightIndex]);

                    if (transferAmount > 0) {
                        this.core.water[rightIndex] += transferAmount;
                        this.core.water[index] -= transferAmount;
                        this.core.energy[rightIndex] = Math.min(255, this.core.energy[rightIndex] + 1);

                        nextActivePixels.add(rightIndex);
                    }
                }
            }

            // Balance moisture with soil neighbors
            horizontalNeighbors.forEach(neighbor => {
                const moistureDiff = this.core.water[index] - this.core.water[neighbor.index];

                // Only balance if there's a significant difference
                if (Math.abs(moistureDiff) > 10) {
                    // Direction of transfer depends on moisture difference
                    if (moistureDiff > 0) {
                        // Transfer from this pixel to neighbor
                        const transferAmount = Math.max(1, Math.floor(moistureDiff / 8));

                        this.core.water[neighbor.index] += transferAmount;
                        this.core.water[index] -= transferAmount;

                        // Update soil states
                        if (this.core.water[neighbor.index] > 20) {
                            this.core.state[neighbor.index] = this.STATE.WET;
                        }

                        if (this.core.water[index] <= 20) {
                            this.core.state[index] = this.STATE.DRY;
                        }
                    } else {
                        // Transfer from neighbor to this pixel
                        const transferAmount = Math.max(1, Math.floor(-moistureDiff / 8));

                        this.core.water[index] += transferAmount;
                        this.core.water[neighbor.index] -= transferAmount;

                        // Update soil states
                        if (this.core.water[index] > 20) {
                            this.core.state[index] = this.STATE.WET;
                        }

                        if (this.core.water[neighbor.index] <= 20) {
                            this.core.state[neighbor.index] = this.STATE.DRY;
                        }
                    }

                    nextActivePixels.add(neighbor.index);
                }
            });
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
            const downType = this.core.type[downIndex];

            // Different behavior based on what's below
            switch (downType) {
                case this.TYPE.AIR:
                    // Objects fall freely through air
                    this.swapPixels(index, downIndex, nextActivePixels);
                    return true;

                case this.TYPE.WATER:
                    // Objects fall through water (possibly with buoyancy)
                    // Check if object should float based on its type
                    const floatChance = this.getFloatChance(this.core.type[index]);

                    if (Math.random() < floatChance) {
                        // Object floats in water
                        nextActivePixels.add(index);
                        return false;
                    }

                    // Otherwise, sink through water
                    this.swapPixels(index, downIndex, nextActivePixels);
                    return true;

                default:
                    // Can't fall through other materials directly
                    // Try to slide off if on an incline
                    if (Math.random() < 0.3) {
                        this.trySlideSideways(x, y, index, nextActivePixels);
                    }
                    break;
            }
        }

        // If couldn't fall straight down, try falling diagonally
        if (Math.random() < 0.4) { // Higher chance than before
            // Randomly choose left or right diagonal
            const diagonalX = x + (Math.random() < 0.5 ? -1 : 1);
            const diagonalIndex = this.core.getIndex(diagonalX, y + 1);

            if (diagonalIndex !== -1) {
                const diagType = this.core.type[diagonalIndex];

                if (diagType === this.TYPE.AIR) {
                    // Fall diagonally into air
                    this.swapPixels(index, diagonalIndex, nextActivePixels);
                    return true;
                } else if (diagType === this.TYPE.WATER) {
                    // Check floating in water (same logic as above)
                    const floatChance = this.getFloatChance(this.core.type[index]);

                    if (Math.random() < floatChance) {
                        nextActivePixels.add(index);
                        return false;
                    }

                    // Otherwise sink diagonally
                    this.swapPixels(index, diagonalIndex, nextActivePixels);
                    return true;
                }
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

    // Helper method to swap two pixels completely (for gravity movement)
    swapPixels: function(index1, index2, nextActivePixels) {
        // Store all properties of first pixel
        const tempType = this.core.type[index1];
        const tempState = this.core.state[index1];
        const tempWater = this.core.water[index1];
        const tempNutrient = this.core.nutrient[index1];
        const tempEnergy = this.core.energy[index1];
        const tempMetadata = this.core.metadata[index1];

        // Move second pixel to first position
        this.core.type[index1] = this.core.type[index2];
        this.core.state[index1] = this.core.state[index2];
        this.core.water[index1] = this.core.water[index2];
        this.core.nutrient[index1] = this.core.nutrient[index2];
        this.core.energy[index1] = this.core.energy[index2];
        this.core.metadata[index1] = this.core.metadata[index2];

        // Move stored first pixel to second position
        this.core.type[index2] = tempType;
        this.core.state[index2] = tempState;
        this.core.water[index2] = tempWater;
        this.core.nutrient[index2] = tempNutrient;
        this.core.energy[index2] = tempEnergy;
        this.core.metadata[index2] = tempMetadata;

        // Mark both positions as active and processed
        this.processedThisFrame[index2] = 1;
        nextActivePixels.add(index2);
        nextActivePixels.add(index1);
    },

    // Try to slide off a diagonal surface (for more natural pile behavior)
    trySlideSideways: function(x, y, index, nextActivePixels) {
        // Check both left and right
        const directions = [
            {dx: -1, dy: 0},
            {dx: 1, dy: 0}
        ];

        // Shuffle directions for randomness
        if (Math.random() < 0.5) {
            directions.reverse();
        }

        // Try each direction
        for (const dir of directions) {
            const sideX = x + dir.dx;
            const sideIndex = this.core.getIndex(sideX, y);

            // Can only slide into air
            if (sideIndex !== -1 && this.core.type[sideIndex] === this.TYPE.AIR) {
                // Check if there's no support underneath (creating an incline)
                const diagDownIndex = this.core.getIndex(sideX, y + 1);

                if (diagDownIndex !== -1) {
                    // More likely to slide if there's no support or just water below
                    const noSupport = this.core.type[diagDownIndex] === this.TYPE.AIR ||
                        this.core.type[diagDownIndex] === this.TYPE.WATER;

                    // Chance to slide depends on support
                    const slideChance = noSupport ? 0.8 : 0.3;

                    if (Math.random() < slideChance) {
                        this.swapPixels(index, sideIndex, nextActivePixels);
                        return true;
                    }
                }
            }
        }

        return false;
    },

    // Get chance of an object floating in water based on its type
    getFloatChance: function(type) {
        switch (type) {
            case this.TYPE.SEED:
                return 0.7;  // Most seeds float
            case this.TYPE.DEAD_MATTER:
                return 0.4;  // Some dead matter floats
            case this.TYPE.INSECT:
                return 0.9;  // Most insects can float/swim
            default:
                return 0.0;  // Default to sinking
        }
    },

    // Update erosion (water eroding soil)
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
        // Skip if the water amount is too low to cause erosion
        if (this.core.water[index] < 100) return;

        // Calculate water pressure for erosion power
        const waterPressure = this.getWaterPressure(x, y, index);

        // Only flowing water causes significant erosion
        // Check if this water pixel is actively flowing
        const isFlowing = this.isWaterFlowing(x, y, index);
        if (!isFlowing && waterPressure < 150) return;

        // Water can erode adjacent soil
        // Get all neighbors
        const neighbors = this.core.getNeighborIndices(x, y);

        // Check each neighbor for soil
        for (const neighbor of neighbors) {
            if (this.core.type[neighbor.index] === this.TYPE.SOIL) {
                // Calculate erosion chance based on multiple factors:
                // - Higher water pressure increases erosion
                // - Wet soil erodes more easily than dry soil
                // - Soil with plant roots is more resistant to erosion
                // - Fertile soil with higher nutrients is more resistant

                // Check if soil has plant roots nearby (provides protection)
                let hasRoots = false;
                const soilNeighbors = this.core.getNeighborIndices(neighbor.x, neighbor.y);
                for (const soilNeighbor of soilNeighbors) {
                    if (this.core.type[soilNeighbor.index] === this.TYPE.PLANT &&
                        this.core.state[soilNeighbor.index] === this.STATE.ROOT) {
                        hasRoots = true;
                        break;
                    }
                }

                // Base erosion chance
                let erosionChance = 0.005;

                // Water pressure effect (higher pressure = more erosion)
                erosionChance *= (waterPressure / 100);

                // Soil moisture effect (wetter soil erodes more easily)
                const soilMoisture = this.core.water[neighbor.index];
                if (soilMoisture > 100) {
                    erosionChance *= 1.5;
                }

                // Soil fertility effect (fertile soil is more resistant)
                if (this.core.state[neighbor.index] === this.STATE.FERTILE) {
                    erosionChance *= 0.7;
                }

                // Root protection effect (roots significantly reduce erosion)
                if (hasRoots) {
                    erosionChance *= 0.3;
                }

                if (Math.random() < erosionChance) {
                    // Erode the soil
                    if (waterPressure > 200 || Math.random() < 0.3) {
                        // Complete erosion - convert to water
                        this.core.type[neighbor.index] = this.TYPE.WATER;
                        this.core.water[neighbor.index] = this.core.water[index];
                        this.core.state[neighbor.index] = this.STATE.DEFAULT;

                        // Carry nutrients in the water
                        this.core.nutrient[neighbor.index] += Math.floor(this.core.nutrient[neighbor.index] * 0.7);
                    } else {
                        // Partial erosion - soil remains but loses nutrients and becomes wetter
                        this.core.water[neighbor.index] = Math.min(255, this.core.water[neighbor.index] + 50);
                        this.core.nutrient[neighbor.index] = Math.max(0, this.core.nutrient[neighbor.index] - 10);

                        // Very wet soil becomes less fertile
                        if (this.core.water[neighbor.index] > 200) {
                            this.core.state[neighbor.index] = this.STATE.WET;
                        }
                    }

                    nextActivePixels.add(neighbor.index);
                    break; // Only erode one soil pixel per water pixel per frame
                }
            }
        }
    },

    // Helper method to determine if water is actively flowing
    isWaterFlowing: function(x, y, index) {
        // Check surrounding pixels for air or lower water levels
        const neighbors = this.core.getNeighborIndices(x, y);

        for (const neighbor of neighbors) {
            // Water flows if there's air or water with lower level nearby
            if (this.core.type[neighbor.index] === this.TYPE.AIR) {
                return true;
            }

            if (this.core.type[neighbor.index] === this.TYPE.WATER &&
                this.core.water[neighbor.index] < this.core.water[index] - 20) {
                return true;
            }
        }

        return false;
    }
};