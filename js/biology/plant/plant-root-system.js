// Plant Root System
// Handles plant root growth, water/nutrient absorption

const PlantRootSystem = {
    // Reference to parent plant system
    plant: null,
    
    // Root growth patterns and parameters
    rootPatterns: {
        primaryGrowthRate: 0.30,    // Dramatically increased for aggressive deep growth
        lateralGrowthRate: 0.30,    // Slightly reduced to encourage deeper growth
        secondaryGrowthRate: 0.25,  // Maintained for dense root networks
        tertiaryGrowthRate: 0.15,   // Maintained for intricate root systems
        depthFactor: 0.8,           // Increased to encourage deeper growth
        maxRootDepth: 600,          // Massively increased maximum depth for extremely deep roots
        rootDensityFactor: 2.0,     // Maintained for dense root systems
        rootSpreadFactor: 1.2,      // Slightly reduced to focus more on depth than spread
        waterSeeking: 0.9,          // Increased to make roots more aggressively seek water sources
        nutrientSeeking: 0.7,       // Increased to make roots more aggressively seek nutrient sources
        fractalIterationLimit: 3,   // Controls recursion depth for branching patterns
        maturityThreshold: 15,      // Plant height at which mature root patterns begin
        ageVariation: true,         // Whether roots change behavior based on their age/depth
        growthVariability: 0.2      // Random variation in growth rates for natural appearance
    },
    
    // Initialize root system
    init: function(plantSystem) {
        this.plant = plantSystem;
        return this;
    },
    
    // Update root behavior
    updateRoot: function(x, y, index, nextActivePixels) {
        // Roots absorb water and nutrients from surrounding soil
        this.absorbWaterAndNutrients(x, y, index, nextActivePixels);

        // Roots grow based on multiple factors and patterns
        this.growRootSystem(x, y, index, nextActivePixels);

        // Roots remain active
        nextActivePixels.add(index);
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
            const heightFactor = Math.min(2.0, (stemHeight / 15) + 0.5) * randomVariation;
            const leafFactor = Math.min(2.2, (leafCount / 8) + 0.8) * randomVariation;
            
            // Early growth - focus on primary and lateral roots
            if (stemHeight < this.rootPatterns.maturityThreshold) {
                // Young plants focus on establishing main root structure
                this.rootPatterns.primaryGrowthRate = 0.10 * heightFactor;
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
            this.rootPatterns.rootDensityFactor = 1.2 * leafFactor;
            
            // Adjust maximum root depth based on stem height
            // Roots grow ~4-6x the height of the stem for extremely deep roots
            this.rootPatterns.maxRootDepth = Math.max(200, stemHeight * 6.0);
        }
    },

    // Grow a more complex and extensive root system
    growRootSystem: function(x, y, index, nextActivePixels) {
        // Only attempt growth if root has enough energy
        if (this.plant.core.energy[index] <= 60) return;

        // Calculate local environment factors for this root
        const environmentFactors = this.assessRootEnvironment(x, y);

        // Calculate distance from plant origin for growth decisions
        const groundLevel = Math.floor(this.plant.core.height * 0.6);
        const depthFromSurface = y - groundLevel; // How far below ground
        const maxDesiredRootDepth = Math.min(this.rootPatterns.maxRootDepth,
            Math.max(200, this.plant.plantMetrics.stemHeight * 6.0)); // Roots much deeper than stem height

        // Get plant maturity indicators
        const stemHeight = this.plant.plantMetrics.stemHeight;
        const plantMaturity = stemHeight / this.rootPatterns.maturityThreshold;
        
        // Calculate root age factor (older/deeper roots behave differently)
        const rootAge = depthFromSurface / maxDesiredRootDepth; // 0 = new, 1 = oldest
        
        // Root depth zone affects growth behavior (creates distinct layers)
        // Modified to expand deep zone and reduce shallow zone to encourage deeper growth
        const isShallowZone = depthFromSurface < maxDesiredRootDepth * 0.15; 
        const isMiddleZone = depthFromSurface >= maxDesiredRootDepth * 0.15 && 
                            depthFromSurface < maxDesiredRootDepth * 0.5;
        const isDeepZone = depthFromSurface >= maxDesiredRootDepth * 0.5;
        
        // Calculate growth chances factoring in root position and plant maturity
        
        // Primary growth (main taproot) - maintain strength even in deeper areas
        let primaryGrowthChance = this.rootPatterns.primaryGrowthRate * 
            (1 - (rootAge * 0.4)) * // Reduce less as roots get deeper (changed from 0.7 to 0.4)
            this.plant.biology.growthRate;
            
        // Enhance downward growth for all plants, especially immature ones
        if (stemHeight < this.rootPatterns.maturityThreshold) {
            primaryGrowthChance *= 1.5; // Increased from 1.3
        } else {
            primaryGrowthChance *= 1.2; // New bonus for mature plants
        }
            
        // Lateral growth - more common in middle depths and mature plants
        let lateralGrowthFactor = Math.min(2.0, (this.plant.plantMetrics.leafCount / 5) + 0.7);
        let lateralGrowthChance = this.rootPatterns.lateralGrowthRate * 
            lateralGrowthFactor * 
            this.plant.biology.growthRate;
            
        // Enhance lateral growth in middle soil layers
        if (isMiddleZone) {
            lateralGrowthChance *= 1.5;
        }
        
        // Secondary branching - more common in mature plants and in denser soil layers
        let secondaryGrowthChance = this.rootPatterns.secondaryGrowthRate * 
            Math.min(2.0, plantMaturity + 0.5) * 
            this.plant.biology.growthRate;
            
        // Tertiary branching - complex patterns in mature plants
        let tertiaryGrowthChance = this.rootPatterns.tertiaryGrowthRate * 
            Math.max(0, plantMaturity - 0.5) * // Only in mature plants
            this.plant.biology.growthRate;
        
        // Add soil quality influence
        const soilQuality = (environmentFactors.soilQualityLeft + 
                           environmentFactors.soilQualityRight + 
                           environmentFactors.soilQualityDown) / 3;
                           
        // Better soil = more growth
        const soilFactor = 0.7 + (soilQuality / 200);
        primaryGrowthChance *= soilFactor;
        lateralGrowthChance *= soilFactor;
        secondaryGrowthChance *= soilFactor;
        tertiaryGrowthChance *= soilFactor;
        
        // Attempt primary growth (taproot)
        if (Math.random() < primaryGrowthChance) {
            this.growPrimaryRoot(x, y, index, environmentFactors, nextActivePixels);
        }

        // Attempt lateral growth (side branching)
        if (Math.random() < lateralGrowthChance) {
            this.growLateralRoot(x, y, index, environmentFactors, nextActivePixels);
        }
        
        // Attempt secondary growth (smaller branches off laterals)
        // More likely in middle and deep zones
        if ((isMiddleZone || isDeepZone) && Math.random() < secondaryGrowthChance) {
            // Second argument true means diagonal branching allowed
            this.growLateralRoot(x, y, index, environmentFactors, nextActivePixels, true);
        }
        
        // Attempt tertiary growth (fractal-like fine branching) for mature plants
        if (plantMaturity > 1 && Math.random() < tertiaryGrowthChance) {
            // Try growing in multiple directions for dense root networks
            const randomAngle = Math.floor(Math.random() * 8); // 8 possible directions
            const dx = [-1, -1, 0, 1, 1, 1, 0, -1][randomAngle];
            const dy = [0, 1, 1, 1, 0, -1, -1, -1][randomAngle];
            
            const newX = x + dx;
            const newY = y + dy;
            const newIndex = this.plant.core.getIndex(newX, newY);
            
            // Can only grow into soil
            if (newIndex !== -1 && this.plant.core.type[newIndex] === this.plant.TYPE.SOIL) {
                // Create new tertiary root (fine hair-like root)
                this.plant.core.type[newIndex] = this.plant.TYPE.PLANT;
                this.plant.core.state[newIndex] = this.plant.STATE.ROOT;
                
                // Transfer minimal resources - these are small structures
                this.plant.core.energy[newIndex] = this.plant.core.energy[index] * 0.3;
                this.plant.core.energy[index] *= 0.8;
                
                this.plant.core.water[newIndex] = this.plant.core.water[index] * 0.3;
                this.plant.core.water[index] *= 0.8;
                
                this.plant.core.nutrient[newIndex] = this.plant.core.nutrient[index] * 0.3;
                this.plant.core.nutrient[index] *= 0.8;
                
                nextActivePixels.add(newIndex);
            }
        }

        // Check if we have enough roots to support stem growth
        // This is more likely in the shallowest zone
        if (isShallowZone) {
            this.checkRootMassForStem(x, y, index, nextActivePixels);
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

    // Grow the primary (main) root downward
    growPrimaryRoot: function(x, y, index, environmentFactors, nextActivePixels) {
        // Primary roots grow mainly downward with some influence from water and nutrients
        // Calculate optimal growth direction with slight randomness

        let dx = 0;
        const dy = 1; // Always downward

        // Calculate groundLevel and depth for depth-based behavior
        const groundLevel = Math.floor(this.plant.core.height * 0.6);
        const depthFromSurface = y - groundLevel;
        const maxDepth = this.rootPatterns.maxRootDepth;
        const depthRatio = depthFromSurface / maxDepth;

        // Slight sideways tendencies based on water/nutrients and randomness
        const leftBias = environmentFactors.waterLeft * this.rootPatterns.waterSeeking +
            environmentFactors.nutrientLeft * this.rootPatterns.nutrientSeeking;
        const rightBias = environmentFactors.waterRight * this.rootPatterns.waterSeeking +
            environmentFactors.nutrientRight * this.rootPatterns.nutrientSeeking;

        // Add some randomness to the bias, reduced for deeper roots to encourage straighter growth
        const randomFactor = Math.random() * 0.4 - 0.2; // -0.2 to 0.2
        const depthStraighteningFactor = Math.max(0.3, 1.0 - (depthRatio * 0.7)); // Roots get straighter as they go deeper

        // Calculate final horizontal tendency - deeper roots have less horizontal movement
        const horizontalBias = (rightBias - leftBias + randomFactor) * depthStraighteningFactor;

        // Higher threshold for diagonal growth to prefer straight down
        const diagonalThreshold = 0.2 + (depthRatio * 0.1); // Gets harder to grow diagonally as depth increases
        
        // Determine if we should go straight down or diagonally
        if (horizontalBias > diagonalThreshold) dx = 1;
        else if (horizontalBias < -diagonalThreshold) dx = -1;
        
        // Occasionally force straightening for deep taproot effect
        if (depthFromSurface > 100 && Math.random() < 0.3) {
            dx = 0; // Force straight down for deep taproots
        }

        // Try growing in the calculated direction
        const newX = x + dx;
        const newY = y + dy;
        const newIndex = this.plant.core.getIndex(newX, newY);

        // Can only grow into soil
        if (newIndex !== -1 && this.plant.core.type[newIndex] === this.plant.TYPE.SOIL) {
            // Create new root
            this.plant.core.type[newIndex] = this.plant.TYPE.PLANT;
            this.plant.core.state[newIndex] = this.plant.STATE.ROOT;

            // Transfer some energy and resources to new root
            this.plant.core.energy[newIndex] = this.plant.core.energy[index] * 0.6;
            this.plant.core.energy[index] *= 0.7; // Parent root keeps most energy

            this.plant.core.water[newIndex] = this.plant.core.water[index] * 0.5;
            this.plant.core.water[index] *= 0.7;

            this.plant.core.nutrient[newIndex] = this.plant.core.nutrient[index] * 0.5;
            this.plant.core.nutrient[index] *= 0.7;
            
            // Propagate plant group ID for origin tracking
            if (this.plant.plantGroups[index]) {
                this.plant.plantGroups[newIndex] = this.plant.plantGroups[index];
            }

            nextActivePixels.add(newIndex);
            return true;
        }

        return false;
    },

    // Grow lateral (sideways) roots
    growLateralRoot: function(x, y, index, environmentFactors, nextActivePixels, allowDiagonal = false) {
        // Lateral roots grow more horizontally with various patterns
        // Mature plants have more complex branching patterns
        
        // Get plant maturity and root zone info
        const groundLevel = Math.floor(this.plant.core.height * 0.6);
        const depthFromSurface = y - groundLevel;
        const stemHeight = this.plant.plantMetrics.stemHeight;
        const plantMaturity = stemHeight / this.rootPatterns.maturityThreshold;
        
        // Direction bias based on water and nutrients
        const waterSeekingFactor = this.rootPatterns.waterSeeking * (1 + (Math.random() * 0.4 - 0.2));
        const nutrientSeekingFactor = this.rootPatterns.nutrientSeeking * (1 + (Math.random() * 0.4 - 0.2));
        
        const leftBias = environmentFactors.waterLeft * waterSeekingFactor +
                       environmentFactors.nutrientLeft * nutrientSeekingFactor +
                       Math.random() * 0.6;
                       
        const rightBias = environmentFactors.waterRight * waterSeekingFactor +
                        environmentFactors.nutrientRight * nutrientSeekingFactor +
                        Math.random() * 0.6;
        
        // Fractal-like growth patterns for mature plants
        // More spread for mature plants (wider root system)
        const spreadFactor = this.rootPatterns.rootSpreadFactor * 
                          (1 + Math.min(0.5, plantMaturity * 0.3));
                          
        // Calculate possible directions with weights
        let directions = [];
        
        // Horizontal directions (core lateral growth)
        if (!environmentFactors.obstacleLeft) {
            directions.push({ dx: -1, dy: 0, weight: leftBias * spreadFactor });
        }
        
        if (!environmentFactors.obstacleRight) {
            directions.push({ dx: 1, dy: 0, weight: rightBias * spreadFactor });
        }
        
        // Downward directions (always an option)
        directions.push({ dx: 0, dy: 1, weight: 0.7 * (1 - (depthFromSurface / this.rootPatterns.maxRootDepth)) });
        
        // Diagonal directions for more complex patterns
        if (allowDiagonal || plantMaturity > 0.8) {
            // Down-left diagonal
            if (!environmentFactors.obstacleLeft) {
                directions.push({ dx: -1, dy: 1, weight: leftBias * 0.6 });
            }
            
            // Down-right diagonal
            if (!environmentFactors.obstacleRight) {
                directions.push({ dx: 1, dy: 1, weight: rightBias * 0.6 });
            }
            
            // For mature plants, allow shallow upward diagonals for dense networks
            if (plantMaturity > 1.2 && depthFromSurface > this.rootPatterns.maxRootDepth * 0.4) {
                if (!environmentFactors.obstacleLeft) {
                    directions.push({ dx: -1, dy: -1, weight: leftBias * 0.3 }); // Up-left
                }
                
                if (!environmentFactors.obstacleRight) {
                    directions.push({ dx: 1, dy: -1, weight: rightBias * 0.3 }); // Up-right
                }
            }
        }
        
        // If no viable directions, try growing straight down
        if (directions.length === 0) {
            return this.growPrimaryRoot(x, y, index, environmentFactors, nextActivePixels);
        }
        
        // Calculate total weight for weighted random selection
        let totalWeight = 0;
        for (const dir of directions) {
            totalWeight += dir.weight;
        }
        
        // Select a direction based on weighted probabilities
        let selectedDir = null;
        const randWeight = Math.random() * totalWeight;
        let weightSum = 0;
        
        for (const dir of directions) {
            weightSum += dir.weight;
            if (weightSum >= randWeight) {
                selectedDir = dir;
                break;
            }
        }
        
        // Use default if selection fails
        if (!selectedDir) {
            selectedDir = directions[0];
        }
        
        // Try growing in the selected direction
        const newX = x + selectedDir.dx;
        const newY = y + selectedDir.dy;
        const newIndex = this.plant.core.getIndex(newX, newY);
        
        // Can only grow into soil
        if (newIndex !== -1 && this.plant.core.type[newIndex] === this.plant.TYPE.SOIL) {
            // Create new root
            this.plant.core.type[newIndex] = this.plant.TYPE.PLANT;
            this.plant.core.state[newIndex] = this.plant.STATE.ROOT;
            
            // Determine resource allocation based on root type
            // Different types of roots get different resource allocations
            let energyTransferRatio, waterTransferRatio, nutrientTransferRatio;
            
            if (allowDiagonal) {
                // Secondary roots (smaller branches) receive less energy
                energyTransferRatio = 0.4;
                waterTransferRatio = 0.3;
                nutrientTransferRatio = 0.3;
                
                // Parent root keeps more
                this.plant.core.energy[index] *= 0.75;
                this.plant.core.water[index] *= 0.75;
                this.plant.core.nutrient[index] *= 0.75;
            } else {
                // Primary lateral roots receive more energy
                energyTransferRatio = 0.5;
                waterTransferRatio = 0.4;
                nutrientTransferRatio = 0.4;
                
                // Parent root keeps less
                this.plant.core.energy[index] *= 0.7;
                this.plant.core.water[index] *= 0.7;
                this.plant.core.nutrient[index] *= 0.7;
            }
            
            // Transfer resources to new root
            this.plant.core.energy[newIndex] = this.plant.core.energy[index] * energyTransferRatio;
            this.plant.core.water[newIndex] = this.plant.core.water[index] * waterTransferRatio;
            this.plant.core.nutrient[newIndex] = this.plant.core.nutrient[index] * nutrientTransferRatio;
            
            // Mark new root as active
            nextActivePixels.add(newIndex);
            return true;
        }
        
        return false;
    },

    // Absorb water and nutrients from surrounding soil
    absorbWaterAndNutrients: function(x, y, index, nextActivePixels) {
        // Get all neighbors
        const neighbors = this.plant.core.getNeighborIndices(x, y);

        // Rate of absorption scales with plant's overall water needs
        // Larger plants have more efficient root systems but need more water
        const waterNeeds = this.plant.plantMetrics.waterNeeds;
        
        // Increase absorption efficiency for larger plants
        const sizeBonus = Math.sqrt(this.plant.plantMetrics.totalSize / 20);
        const absorbFactor = Math.min(3.0, 1.0 + sizeBonus * 0.4 + (this.plant.plantMetrics.stemHeight / 25));

        // Check soil neighbors for water and nutrients
        for (const neighbor of neighbors) {
            if (this.plant.core.type[neighbor.index] === this.plant.TYPE.SOIL) {
                // Extract water if soil has enough (reduced minimum threshold)
                if (this.plant.core.water[neighbor.index] > 5) {
                    // Larger plants extract more water per root with increased extraction rate
                    const extractAmount = Math.min(7 * absorbFactor, this.plant.core.water[neighbor.index] - 2);
                    this.plant.core.water[neighbor.index] -= extractAmount;
                    this.plant.core.water[index] += extractAmount;

                    // Update soil state
                    if (this.plant.core.water[neighbor.index] <= 20) {
                        this.plant.core.state[neighbor.index] = this.plant.STATE.DRY;
                    }

                    nextActivePixels.add(neighbor.index);
                }

                // Extract nutrients if soil has enough
                if (this.plant.core.nutrient[neighbor.index] > 5) {
                    const extractAmount = Math.min(1 * absorbFactor, this.plant.core.nutrient[neighbor.index] - 2);
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
        // More frequent water distribution for larger plants with increased distribution chance
        const distributionChance = Math.min(0.75, 0.3 + (this.plant.plantMetrics.totalSize / 150));
        
        // Only distribute if we have water to spare (reduced minimum threshold)
        if (Math.random() < distributionChance && this.plant.core.water[index] > 10) {
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
                
                // Transfer water upward - larger plants have better water transport
                // Increased transport efficiency for better water movement
                const transportEfficiency = Math.min(4.0, 2.0 + (this.plant.plantMetrics.stemHeight / 15));
                const transferAmount = Math.min(8 * transportEfficiency, this.plant.core.water[index] - 5);
                
                this.plant.core.water[upNeighbor.index] += transferAmount;
                this.plant.core.water[index] -= transferAmount;
                
                nextActivePixels.add(upNeighbor.index);
            }
            
            // Sometimes distribute horizontally as well (if we still have water to spare)
            // Increased chance of horizontal distribution
            if (sideNeighbors.length > 0 && this.plant.core.water[index] > 15 && Math.random() < 0.5) {
                const sideNeighbor = sideNeighbors[Math.floor(Math.random() * sideNeighbors.length)];
                
                // Horizontal transfer efficiency improved
                const transferAmount = Math.min(5, this.plant.core.water[index] - 10);
                
                this.plant.core.water[sideNeighbor.index] += transferAmount;
                this.plant.core.water[index] -= transferAmount;
                
                nextActivePixels.add(sideNeighbor.index);
            }
        }
    },

    // Check if we have enough root mass to start growing a stem
    // Also strengthen the root-stem connection
    checkRootMassForStem: function(x, y, index, nextActivePixels) {
        // Only grow stem if we're in the upper part of the root system
        const upIndex = this.plant.core.getIndex(x, y - 1);
        
        // Calculate ground level for reference
        const groundLevel = Math.floor(this.plant.core.height * 0.6);
        
        // Check if the root is near the surface (within 10 pixels of ground level)
        const isNearSurface = y <= groundLevel + 10;
        
        // Only allow stem growth from roots near the surface
        if (!isNearSurface) {
            return; // Too deep to grow stems
        }
        
        // Verify this root is connected to ground - temporarily disable this check to help initial growth
        // if (!this.plant.plantConnectivity.connectedToGround[index]) {
        //     return; // Not properly grounded - no stem growth allowed
        // }

        // Count nearby root pixels to ensure we have enough root mass
        let rootCount = this.countNearbyRoots(x, y, 3);  // Check in a 7x7 area (3 distance)

        // Lower the stem threshold to make growth easier
        // This threshold is now proportional to existing plant size
        const stemThreshold = 1 + Math.floor(this.plant.plantMetrics.stemHeight / 8);
        
        // Also check how many nearby roots are connected to ground - reduced requirement
        let connectedRoots = this.countConnectedRoots(x, y, 3);
        const connectionThreshold = Math.ceil(stemThreshold * 0.5); // Need at least 50% connected (reduced from 70%)
        
        // Only attempt to grow stem if we have enough connected root mass - increased chance
        if (rootCount >= stemThreshold && 
            (connectedRoots >= connectionThreshold || this.plant.plantMetrics.stemHeight < 5) && 
            Math.random() < 0.08 * this.plant.biology.growthRate) { // Increased from 0.02 to 0.08
            
            if (upIndex !== -1) {
                // Check what's above the root
                if (this.plant.core.type[upIndex] === this.plant.TYPE.AIR) {
                    // If air is above, directly create a stem (original behavior)
                    this.createStemFromRoot(x, y, index, upIndex, nextActivePixels);
                } 
                else if (this.plant.core.type[upIndex] === this.plant.TYPE.SOIL) {
                    // If soil is above, attempt to push through it
                    this.attemptSoilPenetration(x, y, index, upIndex, nextActivePixels);
                }
            }
        }
    },
    
    // Attempt to penetrate soil and grow upward
    attemptSoilPenetration: function(x, y, index, soilIndex, nextActivePixels) {
        // Stronger roots have higher chance to penetrate soil
        const rootCount = this.countNearbyRoots(x, y, 3);
        const penetrationChance = 0.3 + (rootCount / 30); // Base chance plus bonus from root mass
        
        // More energy = higher penetration chance
        const energyFactor = Math.min(1.0, this.plant.core.energy[index] / 150);
        
        // Attempt to break through soil
        if (Math.random() < penetrationChance * energyFactor) {
            // Penetration successful - convert soil to stem
            this.plant.core.type[soilIndex] = this.plant.TYPE.PLANT;
            this.plant.core.state[soilIndex] = this.plant.STATE.STEM;
            
            // Penetrating soil costs more energy
            const energyCost = 10 + Math.floor(Math.random() * 10);
            this.plant.core.energy[index] = Math.max(10, this.plant.core.energy[index] - energyCost);
            
            // Transfer remaining energy at reduced rate (breakthrough is harder)
            this.plant.core.energy[soilIndex] = this.plant.core.energy[index] * 0.4;
            this.plant.core.water[soilIndex] = this.plant.core.water[index] * 0.3;
            
            // Strengthen the root-stem connection
            this.reinforceRootStemConnection(x, y, soilIndex, nextActivePixels);
            
            // Boost energy to help establishment if it's an early stem
            if (this.plant.plantMetrics.stemHeight < 3) {
                this.plant.core.energy[soilIndex] = Math.max(this.plant.core.energy[soilIndex], 100);
            }
            
            // Mark as connected to ground
            this.plant.plantConnectivity.connectedToGround[soilIndex] = 1;
            this.plant.plantConnectivity.checkedThisFrame[soilIndex] = 1;
            
            // Propagate plant group ID for origin tracking
            if (this.plant.plantGroups[index]) {
                const plantGroupId = this.plant.plantGroups[index];
                this.plant.plantGroups[soilIndex] = plantGroupId;
                
                // Record the first stem position for this plant group if not already set
                if (!this.plant.stemOrigins[plantGroupId]) {
                    this.plant.stemOrigins[plantGroupId] = x;
                    console.log("Recorded first stem position at x:", x, "for plant:", plantGroupId);
                }
            }
            
            nextActivePixels.add(soilIndex);
        } else {
            // Failed penetration attempt
            // Still consume some energy but at a reduced rate
            this.plant.core.energy[index] = Math.max(5, this.plant.core.energy[index] - 5);
            nextActivePixels.add(index);
        }
    },
    
    // Create a new stem from a root when there's air above
    createStemFromRoot: function(x, y, index, upIndex, nextActivePixels) {
        // Create stem pixel with reinforced connection to root
        this.plant.core.type[upIndex] = this.plant.TYPE.PLANT;
        this.plant.core.state[upIndex] = this.plant.STATE.STEM;

        // Transfer some energy and water to the stem
        this.plant.core.energy[upIndex] = this.plant.core.energy[index] * 0.6; // Increased energy transfer
        this.plant.core.energy[index] = this.plant.core.energy[index] * 0.6;

        this.plant.core.water[upIndex] = this.plant.core.water[index] * 0.6;
        this.plant.core.water[index] = this.plant.core.water[index] * 0.6;
        
        // Strengthen the root-stem connection by adding more root pixels around the stem base
        // This creates a thicker base for better support
        this.reinforceRootStemConnection(x, y, upIndex, nextActivePixels);
        
        // Start with more energy to help establishment
        if (this.plant.plantMetrics.stemHeight < 3) {
            this.plant.core.energy[upIndex] = Math.max(this.plant.core.energy[upIndex], 120);
        }
        
        // Explicitly mark new stem as connected to ground
        this.plant.plantConnectivity.connectedToGround[upIndex] = 1;
        this.plant.plantConnectivity.checkedThisFrame[upIndex] = 1;
        
        // Propagate plant group ID for origin tracking
        if (this.plant.plantGroups[index]) {
            const plantGroupId = this.plant.plantGroups[index];
            this.plant.plantGroups[upIndex] = plantGroupId;
            
            // Record the first stem position for this plant group if not already set
            if (!this.plant.stemOrigins[plantGroupId]) {
                this.plant.stemOrigins[plantGroupId] = x;
                console.log("Recorded first stem position at x:", x, "for plant:", plantGroupId);
            }
        }

        nextActivePixels.add(upIndex);
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
                const index = this.plant.core.getIndex(nx, ny);

                if (index !== -1 &&
                    this.plant.core.type[index] === this.plant.TYPE.PLANT &&
                    this.plant.core.state[index] === this.plant.STATE.ROOT) {
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
    
    // Count nearby roots that are connected to ground
    countConnectedRoots: function(x, y, distance) {
        let count = 0;

        for (let dy = -distance; dy <= distance; dy++) {
            for (let dx = -distance; dx <= distance; dx++) {
                // Skip the center pixel
                if (dx === 0 && dy === 0) continue;

                const nx = x + dx;
                const ny = y + dy;
                const index = this.plant.core.getIndex(nx, ny);

                if (index !== -1 &&
                    this.plant.core.type[index] === this.plant.TYPE.PLANT &&
                    this.plant.core.state[index] === this.plant.STATE.ROOT &&
                    this.plant.plantConnectivity.connectedToGround[index]) {
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
    
    // Reinforce the connection between roots and stems for structural integrity
    // This is the most critical part of the plant structure
    reinforceRootStemConnection: function(rootX, rootY, stemIndex, nextActivePixels) {
        // Get stem coordinates
        const stemCoords = this.plant.core.getCoords(stemIndex);
        
        // We'll try to create supporting root structures around the stem base
        // Using a wider array of possible positions to create a more robust connection
        const possiblePositions = [
            {dx: -1, dy: 0, priority: 5},  // Left (high priority)
            {dx: 1, dy: 0, priority: 5},   // Right (high priority)
            {dx: -1, dy: 1, priority: 4},  // Bottom-left (high priority)
            {dx: 1, dy: 1, priority: 4},   // Bottom-right (high priority)
            {dx: 0, dy: 1, priority: 3},   // Bottom (medium priority)
            {dx: -2, dy: 0, priority: 2},  // Far left (lower priority)
            {dx: 2, dy: 0, priority: 2},   // Far right (lower priority)
            {dx: -2, dy: 1, priority: 1},  // Far bottom-left (lowest priority)
            {dx: 2, dy: 1, priority: 1}    // Far bottom-right (lowest priority)
        ];
        
        // Sort positions by priority
        possiblePositions.sort((a, b) => b.priority - a.priority);
        
        // Try to create more additional root pixels around the stem base
        // Increased from 2 to 4 for stronger support
        let addedRoots = 0;
        const maxRoots = 4;
        
        for (const pos of possiblePositions) {
            // Skip after creating enough support
            if (addedRoots >= 2) break;
            
            const nx = rootX + pos.dx;
            const ny = rootY + pos.dy;
            const newIndex = this.plant.core.getIndex(nx, ny);
            
            // Check if this position is soil and can be converted to root
            if (newIndex !== -1 && this.plant.core.type[newIndex] === this.plant.TYPE.SOIL) {
                // Convert soil to root with 50% chance (randomized for natural appearance)
                if (Math.random() < 0.5) {
                    // Create a new root pixel for better support
                    this.plant.core.type[newIndex] = this.plant.TYPE.PLANT;
                    this.plant.core.state[newIndex] = this.plant.STATE.ROOT;
                    
                    // Give it some energy and water
                    this.plant.core.energy[newIndex] = this.plant.core.energy[stemIndex] * 0.5;
                    this.plant.core.water[newIndex] = this.plant.core.water[stemIndex] * 0.5;
                    
                    // Mark as connected to ground
                    this.plant.plantConnectivity.connectedToGround[newIndex] = 1;
                    this.plant.plantConnectivity.checkedThisFrame[newIndex] = 1;
                    
                    // Add to root indices for better tracking
                    this.plant.plantConnectivity.rootIndices.push(newIndex);
                    
                    nextActivePixels.add(newIndex);
                    addedRoots++;
                }
            }
        }
    }
};