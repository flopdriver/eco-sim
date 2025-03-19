// Plant System
// Handles plant growth, photosynthesis, and resource distribution

const PlantSystem = {
    // Reference to parent biology system
    biology: null,

    // Shorthand references to commonly used objects
    core: null,
    TYPE: null,
    STATE: null,

    // Root growth patterns and parameters
    rootPatterns: {
        primaryGrowthRate: 0.08,    // Chance for main roots to grow (higher = more growth)
        lateralGrowthRate: 0.12,    // Chance for lateral roots to branch (higher = more branching)
        secondaryGrowthRate: 0.05,  // Chance for smaller secondary lateral roots
        depthFactor: 0.7,           // How much roots prefer to grow downward vs laterally
        maxRootDepth: 100,          // Maximum depth roots can reach
        rootDensityFactor: 1.2,     // Controls how dense root systems become
        waterSeeking: 0.8,          // How strongly roots are attracted to water sources (0-1)
        nutrientSeeking: 0.6        // How strongly roots are attracted to nutrient sources (0-1)
    },

    // Plant growth tracking
    plantMetrics: {
        stemHeight: 0,              // Track how tall stems grow to scale roots appropriately
        leafCount: 0                // Track number of leaves to determine root system size
    },

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
        // Reset plant metrics for this frame
        this.plantMetrics.stemHeight = 0;
        this.plantMetrics.leafCount = 0;

        // First pass - count metrics (stem height, leaf count)
        this.countPlantMetrics(activePixels);

        // Second pass - update each plant pixel
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.PLANT && !this.biology.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);
                this.updateSinglePlant(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Count important plant metrics to scale root growth appropriately
    countPlantMetrics: function(activePixels) {
        let stemCount = 0;
        let maxStemHeight = 0;
        let leafCount = 0;

        // Process plant pixels to gather metrics
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.PLANT) {
                const coords = this.core.getCoords(index);
                const state = this.core.state[index];

                if (state === this.STATE.STEM) {
                    stemCount++;
                    // Track how high stems reach from ground level
                    const groundLevel = Math.floor(this.core.height * 0.6);
                    const heightFromGround = groundLevel - coords.y;
                    if (heightFromGround > maxStemHeight) {
                        maxStemHeight = heightFromGround;
                    }
                } else if (state === this.STATE.LEAF) {
                    leafCount++;
                }
            }
        });

        // Update metrics
        this.plantMetrics.stemHeight = maxStemHeight;
        this.plantMetrics.leafCount = leafCount;

        // Adjust root growth parameters based on above-ground growth
        this.adjustRootGrowthParameters();
    },

    // Adjust root growth parameters based on above-ground growth
    adjustRootGrowthParameters: function() {
        if (this.plantMetrics.stemHeight > 0) {
            // Increase root growth rates for taller plants
            const heightFactor = Math.min(1.5, this.plantMetrics.stemHeight / 20);
            this.rootPatterns.primaryGrowthRate = 0.08 * heightFactor;
            this.rootPatterns.lateralGrowthRate = 0.12 * heightFactor;

            // Increase root density for plants with more leaves
            const leafFactor = Math.min(1.8, (this.plantMetrics.leafCount / 10) + 1);
            this.rootPatterns.rootDensityFactor = 1.2 * leafFactor;
        }
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

        // Roots grow based on multiple factors and patterns
        this.growRootSystem(x, y, index, nextActivePixels);

        // Roots remain active
        nextActivePixels.add(index);
    },

    // Grow a more complex and extensive root system
    growRootSystem: function(x, y, index, nextActivePixels) {
        // Only attempt growth if root has enough energy
        if (this.core.energy[index] <= 60) return;

        // Calculate local environment factors for this root
        const environmentFactors = this.assessRootEnvironment(x, y);

        // Determine what type of root growth to attempt
        // 1. Deep primary root growth (going straight down)
        // 2. Lateral root branching (sideways growth)
        // 3. Secondary lateral roots (smaller branches from lateral roots)

        // Calculate distance from plant origin (approximately) for growth decisions
        const groundLevel = Math.floor(this.core.height * 0.6);
        const depthFromSurface = y - groundLevel; // How far below ground
        const maxDesiredRootDepth = Math.min(this.rootPatterns.maxRootDepth,
            this.plantMetrics.stemHeight * 1.2); // Roots ~ 1.2x stem height

        // Primary root growth (downward) - more likely for newer/shallower roots
        const primaryGrowthChance = this.rootPatterns.primaryGrowthRate *
            (1 - (depthFromSurface / maxDesiredRootDepth)) *
            this.biology.growthRate;

        if (Math.random() < primaryGrowthChance) {
            // Attempt downward growth with slight randomness
            this.growPrimaryRoot(x, y, index, environmentFactors, nextActivePixels);
        }

        // Lateral root growth - more likely at certain depths and with mature plants
        // Increases with plant's overall size
        const lateralGrowthFactor = Math.min(1.5, this.plantMetrics.leafCount / 5 + 0.5);
        const lateralGrowthChance = this.rootPatterns.lateralGrowthRate *
            lateralGrowthFactor *
            this.biology.growthRate;

        if (Math.random() < lateralGrowthChance) {
            // Grow lateral roots with directional bias based on environmental factors
            this.growLateralRoot(x, y, index, environmentFactors, nextActivePixels);
        }

        // Check if we have enough roots to support stem growth
        this.checkRootMassForStem(x, y, index, nextActivePixels);
    },

    // Assess the local environment for root growth decisions
    assessRootEnvironment: function(x, y) {
        // Analyze soil in the surrounding area to find water and nutrients
        const environment = {
            waterLeft: 0,
            waterRight: 0,
            waterDown: 0,
            nutrientLeft: 0,
            nutrientRight: 0,
            nutrientDown: 0,
            soilQualityLeft: 0,
            soilQualityRight: 0,
            soilQualityDown: 0,
            obstacleLeft: false,
            obstacleRight: false,
            obstacleDown: false
        };

        // Check soil in each direction (with a 3x3 area)
        for (let dy = 0; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                const checkIndex = this.core.getIndex(nx, ny);

                if (checkIndex === -1) continue;

                // Only analyze soil pixels
                if (this.core.type[checkIndex] === this.TYPE.SOIL) {
                    const waterValue = this.core.water[checkIndex];
                    const nutrientValue = this.core.nutrient[checkIndex];
                    const soilQuality = waterValue * 0.7 + nutrientValue * 0.3; // Combined soil quality

                    // Sort into directional categories
                    if (dx < 0) {
                        // Left side
                        environment.waterLeft += waterValue * (3 - Math.abs(dx)) / 6;
                        environment.nutrientLeft += nutrientValue * (3 - Math.abs(dx)) / 6;
                        environment.soilQualityLeft += soilQuality * (3 - Math.abs(dx)) / 6;
                    } else if (dx > 0) {
                        // Right side
                        environment.waterRight += waterValue * (3 - Math.abs(dx)) / 6;
                        environment.nutrientRight += nutrientValue * (3 - Math.abs(dx)) / 6;
                        environment.soilQualityRight += soilQuality * (3 - Math.abs(dx)) / 6;
                    } else {
                        // Directly down
                        environment.waterDown += waterValue * (3 - dy) / 3;
                        environment.nutrientDown += nutrientValue * (3 - dy) / 3;
                        environment.soilQualityDown += soilQuality * (3 - dy) / 3;
                    }
                } else if (this.core.type[checkIndex] !== this.TYPE.SOIL &&
                    this.core.type[checkIndex] !== this.TYPE.PLANT) {
                    // Mark obstacles in each direction
                    if (dx < 0) environment.obstacleLeft = true;
                    else if (dx > 0) environment.obstacleRight = true;
                    else if (dy > 0) environment.obstacleDown = true;
                }
            }
        }

        return environment;
    },

    // Grow the primary (main) root downward
    growPrimaryRoot: function(x, y, index, environmentFactors, nextActivePixels) {
        // Primary roots grow mainly downward with some influence from water and nutrients
        // Calculate optimal growth direction with slight randomness

        let dx = 0;
        const dy = 1; // Always downward

        // Slight sideways tendencies based on water/nutrients and randomness
        const leftBias = environmentFactors.waterLeft * this.rootPatterns.waterSeeking +
            environmentFactors.nutrientLeft * this.rootPatterns.nutrientSeeking;
        const rightBias = environmentFactors.waterRight * this.rootPatterns.waterSeeking +
            environmentFactors.nutrientRight * this.rootPatterns.nutrientSeeking;

        // Add some randomness to the bias
        const randomFactor = Math.random() * 0.4 - 0.2; // -0.2 to 0.2

        // Calculate final horizontal tendency
        const horizontalBias = rightBias - leftBias + randomFactor;

        // Determine if we should go straight down or diagonally
        if (horizontalBias > 0.15) dx = 1;
        else if (horizontalBias < -0.15) dx = -1;

        // Try growing in the calculated direction
        const newX = x + dx;
        const newY = y + dy;
        const newIndex = this.core.getIndex(newX, newY);

        // Can only grow into soil
        if (newIndex !== -1 && this.core.type[newIndex] === this.TYPE.SOIL) {
            // Create new root
            this.core.type[newIndex] = this.TYPE.PLANT;
            this.core.state[newIndex] = this.STATE.ROOT;

            // Transfer some energy and resources to new root
            this.core.energy[newIndex] = this.core.energy[index] * 0.6;
            this.core.energy[index] *= 0.7; // Parent root keeps most energy

            this.core.water[newIndex] = this.core.water[index] * 0.5;
            this.core.water[index] *= 0.7;

            this.core.nutrient[newIndex] = this.core.nutrient[index] * 0.5;
            this.core.nutrient[index] *= 0.7;

            nextActivePixels.add(newIndex);
            return true;
        }

        return false;
    },

    // Grow lateral (sideways) roots
    growLateralRoot: function(x, y, index, environmentFactors, nextActivePixels) {
        // Lateral roots grow more horizontally
        // Choose a direction based on environmental factors and randomness

        // Bias the direction based on water and nutrients with some randomness
        const leftBias = environmentFactors.waterLeft * this.rootPatterns.waterSeeking +
            environmentFactors.nutrientLeft * this.rootPatterns.nutrientSeeking +
            Math.random() * 0.5;
        const rightBias = environmentFactors.waterRight * this.rootPatterns.waterSeeking +
            environmentFactors.nutrientRight * this.rootPatterns.nutrientSeeking +
            Math.random() * 0.5;

        // Pick the better direction, avoiding obstacles
        let dx = 0;
        if (leftBias > rightBias && !environmentFactors.obstacleLeft) {
            dx = -1;
        } else if (!environmentFactors.obstacleRight) {
            dx = 1;
        } else if (!environmentFactors.obstacleLeft) {
            dx = -1;
        } else {
            // Both directions blocked, try growing down slightly
            return this.growPrimaryRoot(x, y, index, environmentFactors, nextActivePixels);
        }

        // Determine vertical component
        let dy = 0;
        // Get the ground level from the core
        const groundLevel = Math.floor(this.core.height * 0.6);

        // If at or above ground level, ALWAYS grow downward
        if (y <= groundLevel) {
            dy = 1; // Force downward growth near surface
        } else {
            // Below ground, safer to allow horizontal growth but not upward
            const vertRandom = Math.random();
            if (vertRandom < 0.7) {
                dy = 1; // 70% chance to grow downward
            } else {
                dy = 0; // 30% chance to grow straight horizontally
            }
            // Never grow upward (removed the dy = -1 option)
        }

        // Try growing in the calculated direction
        const newX = x + dx;
        const newY = y + dy;
        const newIndex = this.core.getIndex(newX, newY);

        // Can only grow into soil
        if (newIndex !== -1 && this.core.type[newIndex] === this.TYPE.SOIL) {
            // Create new root
            this.core.type[newIndex] = this.TYPE.PLANT;
            this.core.state[newIndex] = this.STATE.ROOT;

            // Transfer resources - lateral roots get less than primary roots
            this.core.energy[newIndex] = this.core.energy[index] * 0.5;
            this.core.energy[index] *= 0.7;

            this.core.water[newIndex] = this.core.water[index] * 0.4;
            this.core.water[index] *= 0.7;

            this.core.nutrient[newIndex] = this.core.nutrient[index] * 0.4;
            this.core.nutrient[index] *= 0.7;

            nextActivePixels.add(newIndex);
            return true;
        }

        return false;
    },

    // Absorb water and nutrients from surrounding soil
    absorbWaterAndNutrients: function(x, y, index, nextActivePixels) {
        // Get all neighbors
        const neighbors = this.core.getNeighborIndices(x, y);

        // Rate of absorption scales with plant's overall size
        // Larger plants have more efficient root systems
        const absorbFactor = Math.min(1.5, 1 + (this.plantMetrics.stemHeight / 30));

        // Check soil neighbors for water and nutrients
        for (const neighbor of neighbors) {
            if (this.core.type[neighbor.index] === this.TYPE.SOIL) {
                // Extract water if soil has enough
                if (this.core.water[neighbor.index] > 10) {
                    const extractAmount = Math.min(2 * absorbFactor, this.core.water[neighbor.index] - 5);
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
                    const extractAmount = Math.min(1 * absorbFactor, this.core.nutrient[neighbor.index] - 2);
                    this.core.nutrient[neighbor.index] -= extractAmount;
                    this.core.nutrient[index] += extractAmount;

                    nextActivePixels.add(neighbor.index);
                }
            }
        }

        // Distribute water upward through the plant
        this.distributeWaterUpward(x, y, index, nextActivePixels);
    },

    // Distribute water upward through the plant
    distributeWaterUpward: function(x, y, index, nextActivePixels) {
        // Only try this occasionally
        if (Math.random() < 0.2 && this.core.water[index] > 10) {
            // Find connected plant parts above
            const upIndex = this.core.getIndex(x, y - 1);

            if (upIndex !== -1 && this.core.type[upIndex] === this.TYPE.PLANT) {
                // Transfer water upward - larger plants have better water transport
                const transportEfficiency = Math.min(1.5, 1 + (this.plantMetrics.stemHeight / 40));
                const transferAmount = Math.min(2 * transportEfficiency, this.core.water[index] - 5);
                this.core.water[upIndex] += transferAmount;
                this.core.water[index] -= transferAmount;

                nextActivePixels.add(upIndex);
            }
        }
    },

    // Check if we have enough root mass to start growing a stem
    checkRootMassForStem: function(x, y, index, nextActivePixels) {
        // Only grow stem if we're in the upper part of the root system
        // and there's air above
        const upIndex = this.core.getIndex(x, y - 1);

        if (upIndex !== -1 && this.core.type[upIndex] === this.TYPE.AIR) {
            // Count nearby root pixels to ensure we have enough root mass
            let rootCount = this.countNearbyRoots(x, y, 3);  // Check in a 7x7 area (3 distance)

            // Only grow stem if we have enough root mass
            // This threshold is now proportional to existing plant size
            const stemThreshold = 3 + Math.floor(this.plantMetrics.stemHeight / 5);

            if (rootCount >= stemThreshold && Math.random() < 0.02 * this.biology.growthRate) {
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

    // Count nearby root pixels within a given distance
    countNearbyRoots: function(x, y, distance) {
        let count = 0;

        for (let dy = -distance; dy <= distance; dy++) {
            for (let dx = -distance; dx <= distance; dx++) {
                // Skip the center pixel
                if (dx === 0 && dy === 0) continue;

                const nx = x + dx;
                const ny = y + dy;
                const index = this.core.getIndex(nx, ny);

                if (index !== -1 &&
                    this.core.type[index] === this.TYPE.PLANT &&
                    this.core.state[index] === this.STATE.ROOT) {
                    // Weight closer roots more heavily
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist <= distance) {
                        count += 1 + (distance - dist) / distance;
                    }
                }
            }
        }

        return count;
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