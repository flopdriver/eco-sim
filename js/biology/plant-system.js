// Plant System
// Handles plant growth, photosynthesis, and resource distribution

const PlantSystem = {
    // Reference to parent biology system
    biology: null,

    // Shorthand references to commonly used objects
    core: null,
    TYPE: null,
    STATE: null,

    // Initialize plant system
    init: function(biologySystem) {
        this.biology = biologySystem;
        this.core = biologySystem.core;
        this.TYPE = biologySystem.TYPE;
        this.STATE = biologySystem.STATE;

        console.log("Initializing plant system...");

        return this;
    },

    // Update all plant pixels
    update: function(activePixels, nextActivePixels) {
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.PLANT && !this.biology.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);
                this.updateSinglePlant(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Update a single plant pixel
    updateSinglePlant: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.biology.processedThisFrame[index] = 1;

        // Get plant state
        const state = this.core.state[index];

        // Different plant parts have different behaviors
        switch (state) {
            case this.STATE.ROOT:
                this.updateRoot(x, y, index, nextActivePixels);
                break;
            case this.STATE.STEM:
                this.updateStem(x, y, index, nextActivePixels);
                break;
            case this.STATE.LEAF:
                this.updateLeaf(x, y, index, nextActivePixels);
                break;
            case this.STATE.FLOWER:
                this.updateFlower(x, y, index, nextActivePixels);
                break;
            default:
                // Unknown plant state, keep active but don't do anything
                nextActivePixels.add(index);
                break;
        }

        // All plants slowly lose energy over time (metabolism)
        this.core.energy[index] -= 0.5 * this.biology.metabolism;

        // If energy is depleted, plant dies
        if (this.core.energy[index] <= 0) {
            this.core.type[index] = this.TYPE.DEAD_MATTER;
            nextActivePixels.add(index);
            return;
        }

        // Plants need water to survive
        if (this.core.water[index] <= 0) {
            // Plants without water lose energy faster
            this.core.energy[index] -= 2 * this.biology.metabolism;
        }
    },

    // Update plant root behavior
    updateRoot: function(x, y, index, nextActivePixels) {
        // Roots absorb water and nutrients from surrounding soil
        this.absorbWaterAndNutrients(x, y, index, nextActivePixels);

        // Roots grow downward and laterally through soil
        if (this.core.energy[index] > 80 && Math.random() < 0.05 * this.biology.growthRate) {
            this.growRoot(x, y, index, nextActivePixels);
        }

        // Roots remain active
        nextActivePixels.add(index);
    },

    // Absorb water and nutrients from surrounding soil
    absorbWaterAndNutrients: function(x, y, index, nextActivePixels) {
        // Get all neighbors
        const neighbors = this.core.getNeighborIndices(x, y);

        // Check soil neighbors for water and nutrients
        for (const neighbor of neighbors) {
            if (this.core.type[neighbor.index] === this.TYPE.SOIL || this.TYPE.AIR || this.TYPE.WATER) {
                // Extract water if soil has enough
                if (this.core.water[neighbor.index] > 10) {
                    const extractAmount = Math.min(2, this.core.water[neighbor.index] - 5);
                    this.core.water[neighbor.index] -= extractAmount;
                    this.core.water[index] += extractAmount;

                    // Update soil state
                    if (this.core.water[neighbor.index] <= 20) {
                        this.core.state[neighbor.index] = this.STATE.DRY;
                    }

                    nextActivePixels.add(neighbor.index);
                }

                // Extract nutrients if soil has enough
                if (this.core.nutrient[neighbor.index] > 5) {
                    const extractAmount = Math.min(1, this.core.nutrient[neighbor.index] - 2);
                    this.core.nutrient[neighbor.index] -= extractAmount;
                    this.core.nutrient[index] += extractAmount;

                    nextActivePixels.add(neighbor.index);
                }
            }
        }

        // Distribute water up through the plant
        this.distributeWaterUpward(x, y, index, nextActivePixels);
    },

    // Distribute water upward through the plant
    distributeWaterUpward: function(x, y, index, nextActivePixels) {
        // Only try this occasionally
        if (Math.random() < 0.2 && this.core.water[index] > 10) {
            // Find connected plant parts above
            const upIndex = this.core.getIndex(x, y - 1);

            if (upIndex !== -1 && this.core.type[upIndex] === this.TYPE.PLANT) {
                // Transfer water upward
                const transferAmount = Math.min(2, this.core.water[index] - 5);
                this.core.water[upIndex] += transferAmount;
                this.core.water[index] -= transferAmount;

                nextActivePixels.add(upIndex);
            }
        }
    },

    // Grow new root pixels
    growRoot: function(x, y, index, nextActivePixels) {
        // Roots prefer to grow down and to the sides
        const growthDirections = [
            {dx: 0, dy: 1, weight: 5},    // Down (highest probability)
            {dx: -1, dy: 0, weight: 2},   // Left
            {dx: 1, dy: 0, weight: 2},    // Right
            {dx: -1, dy: 1, weight: 3},   // Down-left
            {dx: 1, dy: 1, weight: 3}     // Down-right
        ];

        // Get total weight for weighted random selection
        let totalWeight = 0;
        for (const dir of growthDirections) {
            totalWeight += dir.weight;
        }

        // Weighted random selection
        let randomWeight = Math.random() * totalWeight;
        let selectedDir = null;

        for (const dir of growthDirections) {
            randomWeight -= dir.weight;
            if (randomWeight <= 0) {
                selectedDir = dir;
                break;
            }
        }

        if (selectedDir) {
            const newX = x + selectedDir.dx;
            const newY = y + selectedDir.dy;
            const newIndex = this.core.getIndex(newX, newY);

            // Can only grow into soil
            if (newIndex !== -1 && this.core.type[newIndex] === this.TYPE.SOIL) {
                // Create new root
                this.core.type[newIndex] = this.TYPE.PLANT;
                this.core.state[newIndex] = this.STATE.ROOT;

                // Share energy, water and nutrients
                this.core.energy[newIndex] = this.core.energy[index] / 2;
                this.core.energy[index] = this.core.energy[index] / 2;

                this.core.water[newIndex] = this.core.water[index] / 2;
                this.core.water[index] = this.core.water[index] / 2;

                this.core.nutrient[newIndex] = this.core.nutrient[index] / 2;
                this.core.nutrient[index] = this.core.nutrient[index] / 2;

                nextActivePixels.add(newIndex);
            }
        }

        // Check if we have enough root mass to start growing a stem
        this.tryGrowStem(x, y, index, nextActivePixels);
    },

    // Try to grow a stem from the root system
    tryGrowStem: function(x, y, index, nextActivePixels) {
        // Only grow stem if we're in the upper part of the root system
        // and there's air above
        const upIndex = this.core.getIndex(x, y - 1);

        if (upIndex !== -1 && this.core.type[upIndex] === this.TYPE.AIR) {
            // Count nearby root pixels to ensure we have enough root mass
            let rootCount = 0;

            // Check 5x5 area around this root for other roots
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const nIndex = this.core.getIndex(nx, ny);

                    if (nIndex !== -1 &&
                        this.core.type[nIndex] === this.TYPE.PLANT &&
                        this.core.state[nIndex] === this.STATE.ROOT) {
                        rootCount++;
                    }
                }
            }

            // Only grow stem if we have enough root mass
            if (rootCount >= 3 && Math.random() < 0.02 * this.biology.growthRate) {
                // Create stem pixel
                this.core.type[upIndex] = this.TYPE.PLANT;
                this.core.state[upIndex] = this.STATE.STEM;

                // Transfer some energy and water to the stem
                this.core.energy[upIndex] = this.core.energy[index] / 2;
                this.core.energy[index] = this.core.energy[index] / 2;

                this.core.water[upIndex] = this.core.water[index] / 2;
                this.core.water[index] = this.core.water[index] / 2;

                nextActivePixels.add(upIndex);
            }
        }
    },

    // Update plant stem behavior
    updateStem: function(x, y, index, nextActivePixels) {
        // Stems grow upward and can branch
        if (this.core.energy[index] > 80 && Math.random() < 0.1 * this.biology.growthRate) {
            this.growStem(x, y, index, nextActivePixels);
        }

        // Stems can grow leaves
        if (this.core.energy[index] > 100 && Math.random() < 0.1 * this.biology.growthRate) {
            this.growLeaf(x, y, index, nextActivePixels);
        }

        // Stems remain active
        nextActivePixels.add(index);
    },

    // Grow new stem pixels
    growStem: function(x, y, index, nextActivePixels) {
        // Stems prefer to grow up, but can grow at angles
        const growthDirections = [
            {dx: 0, dy: -1, weight: 20},   // Up (highest probability)
            {dx: -1, dy: -1, weight: 2},   // Up-left
            {dx: 1, dy: -1, weight: 2}     // Up-right
        ];

        // Get total weight for weighted random selection
        let totalWeight = 0;
        for (const dir of growthDirections) {
            totalWeight += dir.weight;
        }

        // Weighted random selection
        let randomWeight = Math.random() * totalWeight;
        let selectedDir = null;

        for (const dir of growthDirections) {
            randomWeight -= dir.weight;
            if (randomWeight <= 0) {
                selectedDir = dir;
                break;
            }
        }

        if (selectedDir) {
            const newX = x + selectedDir.dx;
            const newY = y + selectedDir.dy;
            const newIndex = this.core.getIndex(newX, newY);

            // Can only grow into air
            if (newIndex !== -1 && this.core.type[newIndex] === this.TYPE.AIR) {
                // Create new stem
                this.core.type[newIndex] = this.TYPE.PLANT;
                this.core.state[newIndex] = this.STATE.STEM;

                // Share energy and water
                this.core.energy[newIndex] = this.core.energy[index] / 2;
                this.core.energy[index] = this.core.energy[index] / 2;

                this.core.water[newIndex] = this.core.water[index] / 2;
                this.core.water[index] = this.core.water[index] / 2;

                nextActivePixels.add(newIndex);
            }
        }

        // Check if stem is high enough to flower
        if (y < this.core.height * 0.3 && this.core.energy[index] > 150 && Math.random() < 0.01 * this.biology.growthRate) {
            this.core.state[index] = this.STATE.FLOWER;
        }
    },

    // Grow a leaf from a stem
    growLeaf: function(x, y, index, nextActivePixels) {
        // Leaves grow horizontally from stems
        const leafDirections = [
            {dx: -1, dy: 0},  // Left
            {dx: 1, dy: 0}    // Right
        ];

        // Choose a random direction
        const dir = leafDirections[Math.floor(Math.random() * leafDirections.length)];

        const newX = x + dir.dx;
        const newY = y + dir.dy;
        const newIndex = this.core.getIndex(newX, newY);

        // Can only grow into air or water
        if (newIndex !== -1 && this.core.type[newIndex] === this.TYPE.AIR || this.TYPE.WATER) {
            // Create leaf
            this.core.type[newIndex] = this.TYPE.PLANT;
            this.core.state[newIndex] = this.STATE.LEAF;

            // Transfer some energy and water
            this.core.energy[newIndex] = this.core.energy[index] / 3;
            this.core.energy[index] = this.core.energy[index] * 2 / 3;

            this.core.water[newIndex] = this.core.water[index] / 3;
            this.core.water[index] = this.core.water[index] * 2 / 3;

            nextActivePixels.add(newIndex);
        }
    },

    // Update leaf behavior
    updateLeaf: function(x, y, index, nextActivePixels) {
        // Leaves perform photosynthesis (convert light to energy)
        // Energy depends on the amount of light received
        if (this.core.energy[index] < 200) { // Not fully charged
            // Get energy from light (already calculated in environment system)
            // Just a small amount each tick to avoid sudden energy spikes
            this.core.energy[index] += this.core.energy[index] * 0.02;

            // Cap at maximum
            if (this.core.energy[index] > 200) {
                this.core.energy[index] = 200;
            }
        }

        // Leaves distribute energy to the rest of the plant
        this.distributeEnergyDownward(x, y, index, nextActivePixels);

        // Leaves remain active
        nextActivePixels.add(index);
    },

    // Distribute energy downward through the plant
    distributeEnergyDownward: function(x, y, index, nextActivePixels) {
        // Only try this occasionally
        if (Math.random() < 0.2 && this.core.energy[index] > 50) {
            // Find connected plant parts
            const neighbors = this.core.getNeighborIndices(x, y);

            for (const neighbor of neighbors) {
                if (this.core.type[neighbor.index] === this.TYPE.PLANT) {
                    // Only share if neighbor has less energy
                    if (this.core.energy[neighbor.index] < this.core.energy[index] - 20) {
                        // Transfer energy
                        const transferAmount = Math.min(10, Math.floor((this.core.energy[index] - this.core.energy[neighbor.index]) / 4));
                        this.core.energy[neighbor.index] += transferAmount;
                        this.core.energy[index] -= transferAmount;

                        nextActivePixels.add(neighbor.index);
                    }
                }
            }
        }
    },

    // Update flower behavior
    updateFlower: function(x, y, index, nextActivePixels) {
        // Flowers consume energy but can produce seeds
        if (this.core.energy[index] > 160 && Math.random() < 0.03 * this.biology.reproduction) {
            this.createSeed(x, y, index, nextActivePixels);
        }

        // Flowers remain active
        nextActivePixels.add(index);
    },

    // Create a seed from a flower
    createSeed: function(x, y, index, nextActivePixels) {
        // Seeds can be created in any adjacent air pixel
        const neighbors = this.core.getNeighborIndices(x, y);
        const airNeighbors = neighbors.filter(n => this.core.type[n.index] === this.TYPE.AIR);

        if (airNeighbors.length > 0) {
            // Choose a random air neighbor
            const neighbor = airNeighbors[Math.floor(Math.random() * airNeighbors.length)];

            // Create seed
            this.core.type[neighbor.index] = this.TYPE.SEED;

            // Transfer some energy to the seed
            this.core.energy[neighbor.index] = 100;
            this.core.energy[index] -= 100;

            nextActivePixels.add(neighbor.index);
        }
    }
};