// Biology System
// Handles all organism behaviors: plants, insects, worms, and decomposition

const BiologySystem = {
    // Reference to core simulation
    core: null,

    // Type and state enums (will be populated by controller)
    TYPE: null,
    STATE: null,

    // Biology settings
    growthRate: 1.0,        // Multiplier for organism growth rates
    metabolism: 1.0,        // Energy consumption rate multiplier
    reproduction: 1.0,      // Reproduction probability multiplier

    // Processing flags to avoid double updates
    processedThisFrame: null,

    // Initialize biology system
    init: function(core) {
        this.core = core;
        console.log("Initializing biology systems...");

        // Create processed flags array
        this.processedThisFrame = new Uint8Array(core.size);

        return this;
    },

    // Main update function
    update: function(activePixels, nextActivePixels) {
        // Reset processed flags
        this.processedThisFrame.fill(0);

        // Process plants first (plants don't move, so all active plant pixels can be processed)
        this.updatePlants(activePixels, nextActivePixels);

        // Process seeds
        this.updateSeeds(activePixels, nextActivePixels);

        // Process mobile organisms (insects, worms)
        this.updateMobileOrganisms(activePixels, nextActivePixels);

        // Process decomposition (dead matter)
        this.updateDecomposition(activePixels, nextActivePixels);
    },

    // Update all plant pixels
    updatePlants: function(activePixels, nextActivePixels) {
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.PLANT && !this.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);
                this.updateSinglePlant(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Update a single plant pixel
    updateSinglePlant: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.processedThisFrame[index] = 1;

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
        this.core.energy[index] -= 0.5 * this.metabolism;

        // If energy is depleted, plant dies
        if (this.core.energy[index] <= 0) {
            this.core.type[index] = this.TYPE.DEAD_MATTER;
            nextActivePixels.add(index);
            return;
        }

        // Plants need water to survive
        if (this.core.water[index] <= 0) {
            // Plants without water lose energy faster
            this.core.energy[index] -= 2 * this.metabolism;
        }
    },

    // Update plant root behavior
    updateRoot: function(x, y, index, nextActivePixels) {
        // Roots absorb water and nutrients from surrounding soil
        this.absorbWaterAndNutrients(x, y, index, nextActivePixels);

        // Roots grow downward and laterally through soil
        if (this.core.energy[index] > 80 && Math.random() < 0.05 * this.growthRate) {
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
            if (this.core.type[neighbor.index] === this.TYPE.SOIL) {
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
            if (rootCount >= 3 && Math.random() < 0.02 * this.growthRate) {
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
        if (this.core.energy[index] > 80 && Math.random() < 0.08 * this.growthRate) {
            this.growStem(x, y, index, nextActivePixels);
        }

        // Stems can grow leaves
        if (this.core.energy[index] > 100 && Math.random() < 0.1 * this.growthRate) {
            this.growLeaf(x, y, index, nextActivePixels);
        }

        // Stems remain active
        nextActivePixels.add(index);
    },

    // Grow new stem pixels
    growStem: function(x, y, index, nextActivePixels) {
        // Stems prefer to grow up, but can grow at angles
        const growthDirections = [
            {dx: 0, dy: -1, weight: 10},   // Up (highest probability)
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
        if (y < this.core.height * 0.3 && this.core.energy[index] > 150 && Math.random() < 0.01 * this.growthRate) {
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

        // Can only grow into air
        if (newIndex !== -1 && this.core.type[newIndex] === this.TYPE.AIR) {
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
        if (this.core.energy[index] > 160 && Math.random() < 0.03 * this.reproduction) {
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
    },

    // Update all seed pixels
    updateSeeds: function(activePixels, nextActivePixels) {
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.SEED && !this.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);
                this.updateSingleSeed(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Update a single seed
    updateSingleSeed: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.processedThisFrame[index] = 1;

        // Seeds try to germinate if they're on soil with enough water
        const downIndex = this.core.getIndex(x, y + 1);

        if (downIndex !== -1 && this.core.type[downIndex] === this.TYPE.SOIL) {
            // Check if soil has enough water
            if (this.core.water[downIndex] > 50) {
                // Chance to germinate
                if (Math.random() < 0.05 * this.growthRate) {
                    // Convert seed to plant root
                    this.core.type[index] = this.TYPE.PLANT;
                    this.core.state[index] = this.STATE.ROOT;

                    // Initial root has some water and energy
                    this.core.water[index] = 50;

                    nextActivePixels.add(index);
                    return;
                }
            }
        }

        // Seeds lose energy slowly
        this.core.energy[index] -= 0.1 * this.metabolism;

        // If energy is depleted, seed dies
        if (this.core.energy[index] <= 0) {
            this.core.type[index] = this.TYPE.DEAD_MATTER;
            nextActivePixels.add(index);
            return;
        }

        // Seeds remain active while viable
        nextActivePixels.add(index);
    },

    // Update all mobile organisms (insects, worms)
    updateMobileOrganisms: function(activePixels, nextActivePixels) {
        activePixels.forEach(index => {
            if ((this.core.type[index] === this.TYPE.INSECT || this.core.type[index] === this.TYPE.WORM) &&
                !this.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);

                if (this.core.type[index] === this.TYPE.INSECT) {
                    this.updateSingleInsect(coords.x, coords.y, index, nextActivePixels);
                } else {
                    this.updateSingleWorm(coords.x, coords.y, index, nextActivePixels);
                }
            }
        });
    },

    // Update a single insect
    updateSingleInsect: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.processedThisFrame[index] = 1;

        // Insects move, eat plants, and reproduce
        // They also need energy to survive

        // First, check if insect has enough energy
        if (this.core.energy[index] <= 0) {
            // Insect dies
            this.core.type[index] = this.TYPE.DEAD_MATTER;
            nextActivePixels.add(index);
            return;
        }

        // Insects consume energy each tick
        this.core.energy[index] -= 0.5 * this.metabolism;

        // Decide action: move, eat, or reproduce based on needs
        if (this.core.energy[index] < 50) {
            // Low energy, prioritize eating
            if (this.tryEat(x, y, index, nextActivePixels)) {
                return; // If successfully ate, don't do other actions
            }

            // If couldn't eat, try to move toward food
            this.moveInsect(x, y, index, nextActivePixels, true);
        } else {
            // Enough energy, consider reproduction
            if (this.core.energy[index] > 150 && Math.random() < 0.02 * this.reproduction) {
                this.reproduceInsect(x, y, index, nextActivePixels);
            } else {
                // Otherwise just move randomly
                this.moveInsect(x, y, index, nextActivePixels, false);
            }
        }

        // Insects remain active
        nextActivePixels.add(index);
    },

    // Try to eat plant material
    tryEat: function(x, y, index, nextActivePixels) {
        // Check all neighbors for plant material
        const neighbors = this.core.getNeighborIndices(x, y);
        const plantNeighbors = neighbors.filter(n => this.core.type[n.index] === this.TYPE.PLANT);

        if (plantNeighbors.length > 0) {
            // Choose a random plant neighbor
            const neighbor = plantNeighbors[Math.floor(Math.random() * plantNeighbors.length)];

            // Eat the plant - convert to air and gain energy
            const energyGain = 30 + Math.floor(this.core.energy[neighbor.index] / 2);
            this.core.energy[index] += energyGain;

            // Cap energy
            if (this.core.energy[index] > 200) {
                this.core.energy[index] = 200;
            }

            // Remove the plant
            this.core.type[neighbor.index] = this.TYPE.AIR;
            this.core.state[neighbor.index] = this.STATE.DEFAULT;
            this.core.energy[neighbor.index] = 0;
            this.core.water[neighbor.index] = 0;

            return true;
        }

        return false;
    },

    // Move insect to a new position
    moveInsect: function(x, y, index, nextActivePixels, seekingFood) {
        let possibleMoves = [];

        // Get all possible moves (into air)
        const neighbors = this.core.getNeighborIndices(x, y);

        for (const neighbor of neighbors) {
            if (this.core.type[neighbor.index] === this.TYPE.AIR) {
                possibleMoves.push(neighbor);
            }
        }

        // If seeking food, check if any moves are toward plants
        if (seekingFood && possibleMoves.length > 0) {
            // Look for plants within detection range
            const plantDirections = this.findDirectionToPlant(x, y, 5);

            if (plantDirections.length > 0) {
                // Filter moves that are in the direction of plants
                const plantDirectionMoves = possibleMoves.filter(move => {
                    const dx = move.x - x;
                    const dy = move.y - y;

                    // Check if this move is in any of the plant directions
                    return plantDirections.some(dir => {
                        return (dx * dir.dx + dy * dir.dy) > 0; // Dot product > 0 means same general direction
                    });
                });

                // If we have any moves toward plants, use those instead
                if (plantDirectionMoves.length > 0) {
                    possibleMoves = plantDirectionMoves;
                }
            }
        }

        // If we have possible moves, choose one randomly
        if (possibleMoves.length > 0) {
            const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

            // Move insect
            this.core.type[move.index] = this.TYPE.INSECT;
            this.core.state[move.index] = this.core.state[index];
            this.core.energy[move.index] = this.core.energy[index];

            // Clear original position
            this.core.type[index] = this.TYPE.AIR;
            this.core.state[index] = this.STATE.DEFAULT;
            this.core.energy[index] = 0;

            // Mark new position as processed
            this.processedThisFrame[move.index] = 1;
            nextActivePixels.add(move.index);

            return true;
        }

        return false;
    },

    // Find direction(s) to nearby plants
    findDirectionToPlant: function(x, y, range) {
        const directions = [];

        // Check in a square area around the insect
        for (let dy = -range; dy <= range; dy++) {
            for (let dx = -range; dx <= range; dx++) {
                // Skip the center
                if (dx === 0 && dy === 0) continue;

                const nx = x + dx;
                const ny = y + dy;
                const index = this.core.getIndex(nx, ny);

                if (index !== -1 && this.core.type[index] === this.TYPE.PLANT) {
                    // Found a plant, calculate direction vector
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // Normalize direction
                    const ndx = dx / distance;
                    const ndy = dy / distance;

                    // Add direction with a weight based on distance (closer = higher weight)
                    directions.push({
                        dx: ndx,
                        dy: ndy,
                        weight: 1 / distance
                    });
                }
            }
        }

        return directions;
    },

    // Reproduce insect
    reproduceInsect: function(x, y, index, nextActivePixels) {
        // Check for air pixels where offspring can be placed
        const neighbors = this.core.getNeighborIndices(x, y);
        const airNeighbors = neighbors.filter(n => this.core.type[n.index] === this.TYPE.AIR);

        if (airNeighbors.length > 0) {
            // Choose a random air neighbor
            const neighbor = airNeighbors[Math.floor(Math.random() * airNeighbors.length)];

            // Create new insect
            this.core.type[neighbor.index] = this.TYPE.INSECT;
            this.core.state[neighbor.index] = this.STATE.ADULT;

            // Share energy with offspring
            this.core.energy[neighbor.index] = this.core.energy[index] / 2;
            this.core.energy[index] = this.core.energy[index] / 2;

            // Mark as processed and active
            this.processedThisFrame[neighbor.index] = 1;
            nextActivePixels.add(neighbor.index);

            return true;
        }

        return false;
    },

    // Update a single worm
    updateSingleWorm: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.processedThisFrame[index] = 1;

        // Worms move through soil, eat dead matter, and aerate soil

        // First, check if worm has enough energy
        if (this.core.energy[index] <= 0) {
            // Worm dies and becomes fertile soil
            this.core.type[index] = this.TYPE.SOIL;
            this.core.state[index] = this.STATE.FERTILE;
            this.core.nutrient[index] = 30;
            nextActivePixels.add(index);
            return;
        }

        // Worms consume energy each tick
        this.core.energy[index] -= 0.3 * this.metabolism;

        // Try to find and eat dead matter
        if (this.core.energy[index] < 100) {
            if (this.tryEatDeadMatter(x, y, index, nextActivePixels)) {
                return; // If successfully ate, don't do other actions
            }
        }

        // Move through soil
        this.moveWorm(x, y, index, nextActivePixels);

        // Worms remain active
        nextActivePixels.add(index);
    },

    // Try to eat dead matter
    tryEatDeadMatter: function(x, y, index, nextActivePixels) {
        // Check all neighbors for dead matter
        const neighbors = this.core.getNeighborIndices(x, y);
        const deadMatterNeighbors = neighbors.filter(n => this.core.type[n.index] === this.TYPE.DEAD_MATTER);

        if (deadMatterNeighbors.length > 0) {
            // Choose a random dead matter neighbor
            const neighbor = deadMatterNeighbors[Math.floor(Math.random() * deadMatterNeighbors.length)];

            // Consume the dead matter
            const energyGain = 50;
            this.core.energy[index] += energyGain;

            // Cap energy
            if (this.core.energy[index] > 200) {
                this.core.energy[index] = 200;
            }

            // Convert dead matter to fertile soil
            this.core.type[neighbor.index] = this.TYPE.SOIL;
            this.core.state[neighbor.index] = this.STATE.FERTILE;
            this.core.nutrient[neighbor.index] = 30;

            nextActivePixels.add(neighbor.index);
            return true;
        }

        return false;
    },

    // Move worm through soil or other materials
    moveWorm: function(x, y, index, nextActivePixels) {
        const possibleDirections = [];

        // Worms can move in any direction but prefer soil
        const neighbors = this.core.getNeighborIndices(x, y);

        // Evaluate each neighbor
        for (const neighbor of neighbors) {
            let weight = 0;

            switch (this.core.type[neighbor.index]) {
                case this.TYPE.SOIL:
                    // Prefer soil - higher weight
                    weight = 10;
                    // Prefer fertile soil even more
                    if (this.core.state[neighbor.index] === this.STATE.FERTILE) {
                        weight = 5;
                    }
                    // But wet soil is best for worms
                    else if (this.core.state[neighbor.index] === this.STATE.WET) {
                        weight = 15;
                    }
                    break;

                case this.TYPE.DEAD_MATTER:
                    // Very high weight for dead matter (food)
                    weight = 20;
                    break;

                case this.TYPE.AIR:
                    // Can move through air but don't prefer it
                    weight = 2;
                    break;

                default:
                    // Can't move through other materials
                    weight = 0;
            }

            // If valid direction, add to possibilities
            if (weight > 0) {
                possibleDirections.push({
                    x: neighbor.x,
                    y: neighbor.y,
                    index: neighbor.index,
                    weight: weight
                });
            }
        }

        // If we have possible directions, choose weighted random
        if (possibleDirections.length > 0) {
            // Calculate total weight
            let totalWeight = 0;
            for (const dir of possibleDirections) {
                totalWeight += dir.weight;
            }

            // Choose random direction based on weights
            let randomWeight = Math.random() * totalWeight;
            let selectedDir = null;

            for (const dir of possibleDirections) {
                randomWeight -= dir.weight;
                if (randomWeight <= 0) {
                    selectedDir = dir;
                    break;
                }
            }

            if (selectedDir) {
                // Remember what was in the target position
                const originalType = this.core.type[selectedDir.index];
                const originalState = this.core.state[selectedDir.index];
                const originalNutrient = this.core.nutrient[selectedDir.index];

                // Move worm
                this.core.type[selectedDir.index] = this.TYPE.WORM;
                this.core.energy[selectedDir.index] = this.core.energy[index];

                // Leave aerated soil behind
                this.core.type[index] = this.TYPE.SOIL;
                this.core.state[index] = this.STATE.FERTILE;

                // If original was soil, preserve some properties
                if (originalType === this.TYPE.SOIL) {
                    // Keep nutrients but add some aeration benefit
                    this.core.nutrient[index] = originalNutrient + 5;
                } else {
                    // New soil starts with basic nutrients
                    this.core.nutrient[index] = 20;
                }

                // Mark new position as processed
                this.processedThisFrame[selectedDir.index] = 1;
                nextActivePixels.add(selectedDir.index);
                nextActivePixels.add(index);

                return true;
            }
        }

        return false;
    },

    // Update all dead matter pixels
    updateDecomposition: function(activePixels, nextActivePixels) {
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.DEAD_MATTER && !this.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);
                this.updateSingleDeadMatter(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Update a single dead matter pixel
    updateSingleDeadMatter: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.processedThisFrame[index] = 1;

        // Dead matter gradually decomposes into nutrients

        // First, check if there's soil or water below (for gravity)
        const downIndex = this.core.getIndex(x, y + 1);

        if (downIndex !== -1) {
            if (this.core.type[downIndex] === this.TYPE.SOIL) {
                // Decompose into the soil below
                if (Math.random() < 0.05) {
                    // Add nutrients to soil
                    this.core.nutrient[downIndex] += 20;

                    // Make soil fertile
                    this.core.state[downIndex] = this.STATE.FERTILE;

                    // Remove dead matter
                    this.core.type[index] = this.TYPE.AIR;

                    nextActivePixels.add(downIndex);
                    return;
                }
            } else if (this.core.type[downIndex] === this.TYPE.WATER) {
                // Decompose into the water below (slower)
                if (Math.random() < 0.02) {
                    // Add nutrients to water
                    this.core.nutrient[downIndex] += 10;

                    // Remove dead matter
                    this.core.type[index] = this.TYPE.AIR;

                    nextActivePixels.add(downIndex);
                    return;
                }
            }
        }

        // Decomposition is faster when wet
        // Check if there's water nearby
        const neighbors = this.core.getNeighborIndices(x, y);
        const hasWaterNearby = neighbors.some(n => this.core.type[n.index] === this.TYPE.WATER);

        // Chance to decompose in place
        let decomposeChance = 0.01; // Base chance
        if (hasWaterNearby) {
            decomposeChance = 0.03; // Higher with water
        }

        if (Math.random() < decomposeChance) {
            // Convert to fertile soil
            this.core.type[index] = this.TYPE.SOIL;
            this.core.state[index] = this.STATE.FERTILE;
            this.core.nutrient[index] = 30;

            nextActivePixels.add(index);
            return;
        }

        // Dead matter remains active
        nextActivePixels.add(index);
    }
};