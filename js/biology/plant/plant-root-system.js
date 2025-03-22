// Plant Root System
// Handles plant root growth, water/nutrient absorption

window.PlantRootSystem = {
    // Reference to parent plant system
    plant: null,

    // Root growth patterns and parameters
    rootPatterns: {
        primaryGrowthRate: 7.0,       // Faster primary root growth 
        lateralGrowthRate: 0.35,      // Balanced lateral growth
        secondaryGrowthRate: 0.20,    // Slightly reduced for more natural density
        tertiaryGrowthRate: 0.10,     // Better tertiary growth patterning
        depthFactor: 0.85,            // Encourage depth growth
        maxRootDepth: 600,            // Deep maximum depth
        rootDensityFactor: 1.8,       // Slightly reduced density for cleaner appearance
        rootSpreadFactor: 1.3,        // Slightly increased spread for better visibility
        waterSeeking: 0.8,            // Seek water but not aggressively
        nutrientSeeking: 0.6,         // Seek nutrients but not aggressively
        fractalIterationLimit: 3,     // Controls recursion depth for branching patterns
        maturityThreshold: 15,        // Plant height at which mature root patterns begin
        ageVariation: true,           // Whether roots change behavior based on their age/depth
        growthVariability: 0.15,      // Reduced randomness for more structured appearance
        tendrilFrequency: 0.01,       // Reduced tendril frequency for cleaner look
        tendrilMaxLength: 80,         // Shorter tendrils for more natural appearance
        mainRootProbability: 0.15     // Probability of creating a main taproot
    },

    // Track tendril information
    tendrilTracking: {},

    // Initialize root system
    init: function(plantSystem) {
        this.plant = plantSystem;
        return this;
    },

    // Update root behavior
    updateRoot: function(x, y, index, nextActivePixels) {
        // Ensure nextActivePixels exists even if not provided (for testing)
        nextActivePixels = nextActivePixels || new Set();
        
        // Roots absorb water and nutrients from surrounding soil
        this.absorbWaterAndNutrients(x, y, index, nextActivePixels);

        // Roots grow based on multiple factors and patterns
        this.growRootSystem(x, y, index, nextActivePixels);

        // Occasionally generate exploratory tendrils
        this.generateTendrils(x, y, index, nextActivePixels);

        // Roots remain active
        nextActivePixels.add(index);
    },

    // Generate exploratory root tendrils - updated to create fewer, more natural-looking tendrils
    generateTendrils: function(x, y, index, nextActivePixels) {
        // Chance to generate a tendril depends on root's maturity and plant metrics
        const plantMaturity = this.plant.plantMetrics.stemHeight / this.rootPatterns.maturityThreshold;
        const tendrilChance = this.rootPatterns.tendrilFrequency * (0.8 + plantMaturity);

        // Tracking for this specific root
        if (!this.tendrilTracking[index]) {
            this.tendrilTracking[index] = {
                activeTendrils: 0,
                lastTendrilTime: 0,
                tendrilLength: 0,
                isMainRoot: false
            };
        }

        // Limited number of tendrils per root, based on plant size - reduced for less clutter
        const maxTendrils = Math.min(3, Math.floor(plantMaturity * 1.5));

        // Conditions for generating a tendril
        if (Math.random() < tendrilChance &&
            this.tendrilTracking[index].activeTendrils < maxTendrils &&
            this.plant.core.energy[index] > 50) {

            // Choose a direction for the tendril - more natural growth directions
            const tendrilDirections = [
                {dx: -1, dy: 1, weight: 1.2},  // Down-left
                {dx: 1, dy: 1, weight: 1.2},   // Down-right
                {dx: 0, dy: 1, weight: 1.5},   // Directly down - more common
                {dx: -1, dy: 2, weight: 0.6},  // Steep down-left
                {dx: 1, dy: 2, weight: 0.6},   // Steep down-right
                {dx: -2, dy: 1, weight: 0.3},  // Far left-down - uncommon
                {dx: 2, dy: 1, weight: 0.3}    // Far right-down - uncommon
            ];

            // Calculate total weight
            const totalWeight = tendrilDirections.reduce((sum, dir) => sum + dir.weight, 0);

            // Select direction
            let randomValue = Math.random() * totalWeight;
            let selectedDirection = null;

            for (const dir of tendrilDirections) {
                randomValue -= dir.weight;
                if (randomValue <= 0) {
                    selectedDirection = dir;
                    break;
                }
            }

            // Attempt to generate tendril
            if (selectedDirection) {
                const newX = x + selectedDirection.dx;
                const newY = y + selectedDirection.dy;
                const newIndex = this.plant.core.getIndex(newX, newY);

                // Can only grow into soil or air with some restrictions
                if (newIndex !== -1 &&
                    (this.plant.core.type[newIndex] === this.plant.TYPE.SOIL ||
                     this.plant.core.type[newIndex] === this.plant.TYPE.AIR)) {

                    // Create thin, exploratory root tendril
                    this.plant.core.type[newIndex] = this.plant.TYPE.PLANT;
                    this.plant.core.state[newIndex] = this.plant.STATE.ROOT;

                    // Determine if this will be a main root or a normal small root
                    const isMainRoot = Math.random() < this.rootPatterns.mainRootProbability;
                    if (isMainRoot) {
                        // Set metadata for main roots (20-39 for main roots)
                        // This will be used by the color mapper to render thicker, darker roots
                        const thickness = 20 + Math.floor(Math.random() * 19);
                        this.plant.core.metadata[newIndex] = thickness;
                    } else {
                        // Small roots have no special metadata
                        this.plant.core.metadata[newIndex] = 0;
                    }

                    // Use less energy for thin tendrils
                    this.plant.core.energy[newIndex] = this.plant.core.energy[index] * 0.3;
                    this.plant.core.energy[index] *= 0.9;

                    // Transfer some water to the tendril, but less than normal roots
                    this.plant.core.water[newIndex] = this.plant.core.water[index] * 0.2;
                    this.plant.core.water[index] *= 0.95;

                    // Transfer plant group information
                    if (this.plant.plantGroups[index]) {
                        this.plant.plantGroups[newIndex] = this.plant.plantGroups[index];
                    }

                    // Update tendril tracking
                    this.tendrilTracking[index].activeTendrils++;
                    this.tendrilTracking[index].lastTendrilTime = Date.now();
                    this.tendrilTracking[newIndex] = {
                        parentIndex: index,
                        tendrilLength: 1,
                        isMainRoot: isMainRoot,
                        activeTendrils: 0
                    };

                    nextActivePixels.add(newIndex);
                }
            }
        }

        // Manage existing tendrils
        this.manageTendrils(x, y, index, nextActivePixels);
    },

    // Manage existing tendrils - prune if they get too long or unproductive
    manageTendrils: function(x, y, index, nextActivePixels) {
        const tracking = this.tendrilTracking[index];
        if (!tracking) return;

        // Periodically reduce active tendril count as they mature
        if (tracking.activeTendrils > 0 && Math.random() < 0.02) {
            tracking.activeTendrils = Math.max(0, tracking.activeTendrils - 1);
        }

        // Limit the length of tendrils to create more natural looking root systems
        if (tracking.tendrilLength > 0) {
            // Continue growing this tendril until it reaches max length
            const maxLength = tracking.isMainRoot ? 
                this.rootPatterns.tendrilMaxLength * 2 : // Main roots grow longer
                this.rootPatterns.tendrilMaxLength * (0.7 + Math.random() * 0.5); // Variable length for normal roots
            
            if (tracking.tendrilLength < maxLength) {
                // Continue growth with decreasing probability as we get longer
                const continueProbability = 0.8 * (1 - tracking.tendrilLength / maxLength);
                if (Math.random() < continueProbability) {
                    // Choose growth direction with preference for continuing current direction
                    const possibleDirections = [
                        {dx: -1, dy: 1, weight: 0.8},   // Down-left
                        {dx: 0, dy: 1, weight: 1.5},    // Directly down - preferred
                        {dx: 1, dy: 1, weight: 0.8},    // Down-right
                        {dx: -1, dy: 0, weight: 0.1},   // Left - rare
                        {dx: 1, dy: 0, weight: 0.1}     // Right - rare
                    ];
                    
                    // If this is a main root, heavily favor downward growth
                    if (tracking.isMainRoot) {
                        possibleDirections.find(d => d.dx === 0 && d.dy === 1).weight = 3.0;
                    }

                    // Calculate total weight
                    const totalWeight = possibleDirections.reduce((sum, dir) => sum + dir.weight, 0);
                    
                    // Select direction
                    let randomValue = Math.random() * totalWeight;
                    let selectedDirection = null;
                    
                    for (const dir of possibleDirections) {
                        randomValue -= dir.weight;
                        if (randomValue <= 0) {
                            selectedDirection = dir;
                            break;
                        }
                    }
                    
                    if (selectedDirection) {
                        const newX = x + selectedDirection.dx;
                        const newY = y + selectedDirection.dy;
                        const newIndex = this.plant.core.getIndex(newX, newY);
                        
                        // Check if we can grow into this spot
                        if (newIndex !== -1 && 
                            (this.plant.core.type[newIndex] === this.plant.TYPE.SOIL || 
                             this.plant.core.type[newIndex] === this.plant.TYPE.AIR)) {
                            
                            // Create the new root segment
                            this.plant.core.type[newIndex] = this.plant.TYPE.PLANT;
                            this.plant.core.state[newIndex] = this.plant.STATE.ROOT;
                            
                            // Apply same metadata for consistent coloring within a root
                            const thisMetadata = this.plant.core.metadata[index] || 0;
                            this.plant.core.metadata[newIndex] = thisMetadata;
                            
                            // Share resources
                            this.plant.core.energy[newIndex] = this.plant.core.energy[index] * 0.7;
                            this.plant.core.water[newIndex] = this.plant.core.water[index] * 0.6;
                            
                            // Update tracking
                            if (this.plant.plantGroups[index]) {
                                this.plant.plantGroups[newIndex] = this.plant.plantGroups[index];
                            }
                            
                            // Create tracking for the new segment
                            this.tendrilTracking[newIndex] = {
                                parentIndex: index,
                                tendrilLength: tracking.tendrilLength + 1,
                                isMainRoot: tracking.isMainRoot,
                                activeTendrils: 0,
                                lastTendrilTime: Date.now()
                            };
                            
                            // Occasionally branch from main roots as they grow deeper
                            if (tracking.isMainRoot && tracking.tendrilLength > 15 && Math.random() < 0.15) {
                                // This will become a branch point from the main root
                                tracking.activeTendrils++;
                            }
                            
                            // Add to active pixels
                            nextActivePixels.add(newIndex);
                        }
                    }
                }
            }
        }
    },

    // Adjust root growth parameters based on above-ground growth
    adjustRootGrowthParameters: function() {
        // Root system should develop more complex patterns as plant matures
        const stemHeight = this.plant.plantMetrics.stemHeight;
        const leafCount = this.plant.plantMetrics.leafCount;

        if (stemHeight > 0) {
            // Add random variation for more natural patterns
            const randomVariation = 1 + (Math.random() * this.rootPatterns.growthVariability * 2 - this.rootPatterns.growthVariability);

            // Calculate growth factors that change with plant maturity
            const heightFactor = Math.min(200.0, (stemHeight / 15) + 0.5) * randomVariation;
            const leafFactor = Math.min(2.2, (leafCount / 8) + 0.8) * randomVariation;

            // Early growth - focus on primary and lateral roots
            if (stemHeight < this.rootPatterns.maturityThreshold) {
                // Young plants focus on establishing main root structure
                this.rootPatterns.primaryGrowthRate = 10.0 * heightFactor;
                this.rootPatterns.lateralGrowthRate = 0.12 * heightFactor;
                this.rootPatterns.secondaryGrowthRate = 0.06 * heightFactor;
                this.rootPatterns.tertiaryGrowthRate = 0.02 * heightFactor;
            }
            // Mature growth - develop dense, complex network
            else {
                // Mature plants develop more complex root structures
                // Reduce primary growth (main taproot) after initial establishment
                this.rootPatterns.primaryGrowthRate = 0.07 * heightFactor;

                // Increase lateral and secondary branching for more elaborate patterns
                this.rootPatterns.lateralGrowthRate = 0.15 * heightFactor;
                this.rootPatterns.secondaryGrowthRate = 0.12 * heightFactor;
                this.rootPatterns.tertiaryGrowthRate = 0.08 * heightFactor;

                // Increase horizontal spread in mature plants
                this.rootPatterns.rootSpreadFactor = 0.8 + (stemHeight / 60);
            }

            // Root density scaling with leaf count (more leaves = more roots needed for water)
            this.rootPatterns.rootDensityFactor = 10.2 * leafFactor;

            // Adjust maximum root depth based on stem height
            // Roots grow ~4-6x the height of the stem for extremely deep roots
            this.rootPatterns.maxRootDepth = Math.max(200, stemHeight * 10.0);
        }
    },

    // Grow a more complex and extensive root system
    growRootSystem: function(x, y, index, nextActivePixels) {
        // Only attempt growth if root has enough energy
        if (this.plant.core.energy[index] <= 60) return;

        // Calculate local environment factors for this root
        const environmentFactors = this.assessRootEnvironment(x, y);

        // Calculate distance from plant origin for growth decisions
        const groundLevel = this.getSoilHeight(x);
        const depthFromSurface = y - groundLevel; // How far below ground
        const maxDesiredRootDepth = Math.min(this.rootPatterns.maxRootDepth,
            Math.max(400, this.plant.plantMetrics.stemHeight * 5.0)); // 5x deeper than stem height

        // Get plant maturity indicators
        const stemHeight = this.plant.plantMetrics.stemHeight;
        const plantMaturity = stemHeight / this.rootPatterns.maturityThreshold;

        // Calculate root age factor (older/deeper roots behave differently)
        const rootAge = depthFromSurface / maxDesiredRootDepth; // 0 = new, 1 = oldest

        // Root depth zone affects growth behavior (creates distinct layers)
        // More balanced zone distribution
        const isShallowZone = depthFromSurface < maxDesiredRootDepth * 0.2;
        const isMiddleZone = depthFromSurface >= maxDesiredRootDepth * 0.2 &&
                           depthFromSurface < maxDesiredRootDepth * 0.6;
        const isDeepZone = depthFromSurface >= maxDesiredRootDepth * 0.6;

        // Check if this is a main root segment based on metadata
        const rootMetadata = this.plant.core.metadata[index] || 0;
        const isMainRoot = rootMetadata >= 20 && rootMetadata < 40;

        // Calculate growth chances - more natural and visually appealing distribution
        let downGrowthChance = this.rootPatterns.primaryGrowthRate * 0.01 * (1 - rootAge * 0.5);
        let sideGrowthChance = this.rootPatterns.lateralGrowthRate * 0.01 * (1 - rootAge * 0.3);
        let branchGrowthChance = this.rootPatterns.secondaryGrowthRate * 0.01 * (1 - rootAge * 0.4);

        // Modify growth based on depth zone for more natural tapering
        if (isShallowZone) {
            // Shallow zone - focus on lateral spread and branching
            downGrowthChance *= 0.7;
            sideGrowthChance *= 1.4;
            branchGrowthChance *= 1.2;
        } else if (isMiddleZone) {
            // Middle zone - balanced growth
            downGrowthChance *= 1.0;
            sideGrowthChance *= 1.0;
            branchGrowthChance *= 1.0;
        } else if (isDeepZone) {
            // Deep zone - less branching, more elongation and seeking
            downGrowthChance *= 1.2;
            sideGrowthChance *= 0.6;
            branchGrowthChance *= 0.5;
        }

        // Main roots grow more downward with less branching
        if (isMainRoot) {
            downGrowthChance *= 1.5;
            sideGrowthChance *= 0.5;
            branchGrowthChance *= 0.7;
        }

        // Apply environmental influences
        const waterFactor = environmentFactors.waterDensity * this.rootPatterns.waterSeeking;
        const nutrientFactor = environmentFactors.nutrientDensity * this.rootPatterns.nutrientSeeking;

        // Add subtle environmental response
        downGrowthChance *= (1 + waterFactor * 0.2);
        sideGrowthChance *= (1 + nutrientFactor * 0.3);

        // Growth directions with weighted probabilities
        const growthDirections = [
            // Downward growth directions
            {dx: 0, dy: 1, chance: downGrowthChance, type: "down"},
            {dx: -1, dy: 1, chance: downGrowthChance * 0.6, type: "down-side"},
            {dx: 1, dy: 1, chance: downGrowthChance * 0.6, type: "down-side"},
            
            // Side growth directions
            {dx: -1, dy: 0, chance: sideGrowthChance, type: "side"},
            {dx: 1, dy: 0, chance: sideGrowthChance, type: "side"},
            
            // Branching growth (more angles for variation)
            {dx: -2, dy: 1, chance: branchGrowthChance * 0.5, type: "branch"},
            {dx: 2, dy: 1, chance: branchGrowthChance * 0.5, type: "branch"},
            {dx: -1, dy: 2, chance: branchGrowthChance * 0.7, type: "branch"},
            {dx: 1, dy: 2, chance: branchGrowthChance * 0.7, type: "branch"}
        ];

        // Try each possible growth direction
        for (const direction of growthDirections) {
            // Roll for chance to grow in this direction
            if (Math.random() > direction.chance) continue;

            // Calculate new position
            const newX = x + direction.dx;
            const newY = y + direction.dy;
            const newIndex = this.plant.core.getIndex(newX, newY);

            // Check if new position is valid
            if (newIndex === -1) continue;

            // Can only grow into soil
            if (this.plant.core.type[newIndex] !== this.plant.TYPE.SOIL) continue;

            // Create new root segment
            this.plant.core.type[newIndex] = this.plant.TYPE.PLANT;
            this.plant.core.state[newIndex] = this.plant.STATE.ROOT;

            // Transfer parent metadata for consistent visual appearance
            if (isMainRoot) {
                this.plant.core.metadata[newIndex] = rootMetadata;
            } else {
                // Occasionally create a new main root when branching downward
                if (direction.type === "down" && Math.random() < 0.08 * plantMaturity) {
                    const thickness = 20 + Math.floor(Math.random() * 19);
                    this.plant.core.metadata[newIndex] = thickness;
                } else {
                    this.plant.core.metadata[newIndex] = 0; // Regular root
                }
            }

            // Distribute resources
            // Reduce energy for growth
            this.plant.core.energy[newIndex] = this.plant.core.energy[index] * 0.8;
            this.plant.core.energy[index] *= 0.9;

            // Reset water distribution more evenly for new segments
            this.plant.core.water[newIndex] = Math.max(10, this.plant.core.water[index] * 0.7);

            // Transfer plant group information
            if (this.plant.plantGroups[index]) {
                this.plant.plantGroups[newIndex] = this.plant.plantGroups[index];
            }

            // Initialize tracking for the new growth
            this.tendrilTracking[newIndex] = {
                parentIndex: index,
                tendrilLength: 0,
                isMainRoot: isMainRoot || this.plant.core.metadata[newIndex] >= 20,
                activeTendrils: 0,
                lastTendrilTime: Date.now()
            };

            // Add to active pixels
            nextActivePixels.add(newIndex);
        }
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
                const checkIndex = this.plant.core.getIndex(nx, ny);

                if (checkIndex === -1) continue;

                // Only analyze soil pixels
                if (this.plant.core.type[checkIndex] === this.plant.TYPE.SOIL) {
                    const waterValue = this.plant.core.water[checkIndex];
                    const nutrientValue = this.plant.core.nutrient[checkIndex];
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
                } else if (this.plant.core.type[checkIndex] !== this.plant.TYPE.SOIL &&
                    this.plant.core.type[checkIndex] !== this.plant.TYPE.PLANT) {
                    // Mark obstacles in each direction
                    if (dx < 0) environment.obstacleLeft = true;
                    else if (dx > 0) environment.obstacleRight = true;
                    else if (dy > 0) environment.obstacleDown = true;
                }
            }
        }

        return environment;
    },

    // Absorb water and nutrients from surrounding soil
    absorbWaterAndNutrients: function(x, y, index, nextActivePixels) {
        // Get all neighbors
        const neighbors = this.plant.core.getNeighborIndices(x, y);

        // Rate of absorption scales with plant's overall water needs
        // Larger plants have more efficient root systems but need more water
        const waterNeeds = this.plant.plantMetrics.waterNeeds;

        // FIXED: Increase absorption efficiency for larger plants
        const sizeBonus = Math.sqrt(this.plant.plantMetrics.totalSize / 15); // Reduced from 20 to 15
        const absorbFactor = Math.min(4.0, 1.5 + sizeBonus * 0.5 + (this.plant.plantMetrics.stemHeight / 20)); // Increased from 3.0 to 4.0, 1.0 to 1.5, and 0.4 to 0.5

        // Check soil neighbors for water and nutrients
        for (const neighbor of neighbors) {
            if (this.plant.core.type[neighbor.index] === this.plant.TYPE.SOIL) {
                // FIXED: Extract water if soil has enough (reduced minimum threshold)
                if (this.plant.core.water[neighbor.index] > 3) { // Reduced from 5 to 3
                    // Larger plants extract more water per root with increased extraction rate
                    const extractAmount = Math.min(10 * absorbFactor, this.plant.core.water[neighbor.index] - 1); // Increased from 7 to 10, and 2 to 1
                    this.plant.core.water[neighbor.index] -= extractAmount;
                    this.plant.core.water[index] += extractAmount;

                    // Update soil state
                    if (this.plant.core.water[neighbor.index] <= 20) {
                        this.plant.core.state[neighbor.index] = this.plant.STATE.DRY;
                    }

                    nextActivePixels.add(neighbor.index);
                }

                // FIXED: Extract nutrients if soil has enough
                if (this.plant.core.nutrient[neighbor.index] > 3) { // Reduced from 5 to 3
                    const extractAmount = Math.min(2 * absorbFactor, this.plant.core.nutrient[neighbor.index] - 1); // Increased from 1 to 2, and 2 to 1
                    this.plant.core.nutrient[neighbor.index] -= extractAmount;
                    this.plant.core.nutrient[index] += extractAmount;

                    nextActivePixels.add(neighbor.index);
                }
            }
        }

        // Distribute water upward through the plant
        this.distributeWaterUpward(x, y, index, nextActivePixels);
    },

    // Distribute water upward through the plant
    distributeWaterUpward: function(x, y, index, nextActivePixels) {
        // FIXED: More frequent water distribution for larger plants with increased distribution chance
        const distributionChance = Math.min(0.85, 0.4 + (this.plant.plantMetrics.totalSize / 120)); // Increased from 0.75 to 0.85, 0.3 to 0.4, and 150 to 120

        // FIXED: Only distribute if we have water to spare (reduced minimum threshold)
        if (Math.random() < distributionChance && this.plant.core.water[index] > 5) { // Reduced from 10 to 5
            // Find connected plant parts above and to the sides
            const neighbors = this.plant.core.getNeighborIndices(x, y);

            // Prioritize upward flow but allow some horizontal distribution
            const upNeighbors = [];
            const sideNeighbors = [];

            for (const neighbor of neighbors) {
                if (this.plant.core.type[neighbor.index] === this.plant.TYPE.PLANT) {
                    if (neighbor.y < y) { // Above
                        upNeighbors.push(neighbor);
                    } else if (neighbor.y === y) { // Side
                        sideNeighbors.push(neighbor);
                    }
                }
            }

            // Transfer water upward first (if possible)
            if (upNeighbors.length > 0) {
                const upNeighbor = upNeighbors[Math.floor(Math.random() * upNeighbors.length)];

                // FIXED: Transfer water upward - larger plants have better water transport
                // Increased transport efficiency for better water movement
                const transportEfficiency = Math.min(5.0, 2.5 + (this.plant.plantMetrics.stemHeight / 12)); // Increased from 4.0 to 5.0, 2.0 to 2.5, and 15 to 12
                const transferAmount = Math.min(10 * transportEfficiency, this.plant.core.water[index] - 3); // Increased from 8 to 10, and 5 to 3

                this.plant.core.water[upNeighbor.index] += transferAmount;
                this.plant.core.water[index] -= transferAmount;

                nextActivePixels.add(upNeighbor.index);
            }

            // FIXED: Sometimes distribute horizontally as well (if we still have water to spare)
            // Increased chance of horizontal distribution
            if (sideNeighbors.length > 0 && this.plant.core.water[index] > 10 && Math.random() < 0.65) { // Reduced from 15 to 10, and increased from 0.5 to 0.65
                const sideNeighbor = sideNeighbors[Math.floor(Math.random() * sideNeighbors.length)];

                // Horizontal transfer efficiency improved
                const transferAmount = Math.min(7, this.plant.core.water[index] - 5); // Increased from 5 to 7, and 10 to 5

                this.plant.core.water[sideNeighbor.index] += transferAmount;
                this.plant.core.water[index] -= transferAmount;

                nextActivePixels.add(sideNeighbor.index);
            }
        }
    },

    // Get soil height at a specific x coordinate using the parent plant system's method
    getSoilHeight: function(x) {
        return this.plant.getSoilHeight(x);
    }
};