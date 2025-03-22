// Plant Stem System
// Handles plant stem growth and branching

window.PlantStemSystem = {
    // Reference to parent plant system
    plant: null,

    // Trunk development parameters
    trunkParams: {
        initialTrunkHeight: 200
        ,   // Initial trunk height before branching
        trunkThicknessVariation: 3, // Variation in trunk thickness
        maxTrunkHeight: 600,         // Maximum height before extensive branching
        trunkColorVariations: [
            { r: 110, g: 70, b: 40 },   // Brown
            { r: 100, g: 65, b: 35 },   // Darker brown
            { r: 120, g: 75, b: 45 },   // Lighter brown
            { r: 90, g: 60, b: 30 },    // Reddish brown
            { r: 130, g: 80, b: 50 }    // Warm brown
        ]
    },
    
    // Initialize stem system
    init: function(plantSystem) {
        this.plant = plantSystem;
        return this;
    },
    
    // Update stem behavior
    updateStem: function(x, y, index, nextActivePixels) {
        // Ensure nextActivePixels exists even if not provided (for testing)
        nextActivePixels = nextActivePixels || new Set();

        // Get the plant group ID to determine species and track trunk development
        const plantGroupId = this.plant.plantGroups[index];

        // Ensure we have tracking for this plant's trunk development
        if (!this.plant.trunkDevelopment) {
            this.plant.trunkDevelopment = {};
        }

        if (!this.plant.trunkDevelopment[plantGroupId]) {
            this.plant.trunkDevelopment[plantGroupId] = {
                height: 0,  // Start with 0 for the test expectation
                thickness: 1 + Math.floor(Math.random() * this.trunkParams.trunkThicknessVariation),
                trunkColor: this.trunkParams.trunkColorVariations[
                    Math.floor(Math.random() * this.trunkParams.trunkColorVariations.length)
                    ]
            };
        }

        const trunkDev = this.plant.trunkDevelopment[plantGroupId];

        // Check if we're still in trunk development phase
        const isTrunkDevelopmentPhase = trunkDev.height < this.trunkParams.initialTrunkHeight;
        const canContinueTrunkGrowth = trunkDev.height < this.trunkParams.maxTrunkHeight;

        // Trunk growth is modified to be more consistent and controlled
        if (canContinueTrunkGrowth && this.plant.core.energy[index] > 40 && Math.random() < 0.35 * this.plant.biology.growthRate) {
            this.growTrunk(x, y, index, trunkDev, nextActivePixels);
        }

        // Start branching after initial trunk development
        if (!isTrunkDevelopmentPhase) {
            // Slightly reduced chance of stem/branch growth compared to trunk growth
            if (this.plant.core.energy[index] > 50 && Math.random() < 0.30 * this.plant.biology.growthRate) {
                this.growStem(x, y, index, nextActivePixels);
            }

            // Leaf growth after trunk development
            if (this.plant.core.energy[index] > 60 && Math.random() < 0.25 * this.plant.biology.growthRate) {
                this.growLeaf(x, y, index, nextActivePixels);
            }
        }

        // Stems remain active
        nextActivePixels.add(index);
    },

    // Grow a consistent, thickening trunk
    growTrunk: function(x, y, index, trunkDev, nextActivePixels) {
        // Try to grow upward, maintaining a consistent thickness
        const newY = y - 1;
        const newIndex = this.plant.core.getIndex(x, newY);

        // Slight horizontal variation for more natural trunk growth
        const horizontalOffset = Math.random() < 0.1 ?
            (Math.random() < 0.5 ? -1 : 1) : 0;
        const newX = x + horizontalOffset;
        const adjustedNewIndex = this.plant.core.getIndex(newX, newY);

        // Can only grow into air
        if (newIndex !== -1 && this.plant.core.type[newIndex] === this.plant.TYPE.AIR &&
            (!horizontalOffset || (adjustedNewIndex !== -1 &&
                this.plant.core.type[adjustedNewIndex] === this.plant.TYPE.AIR))) {

            // Use the adjusted index if horizontal offset is used
            const finalIndex = horizontalOffset ? adjustedNewIndex : newIndex;

            // Create new trunk pixel
            this.plant.core.type[finalIndex] = this.plant.TYPE.PLANT;
            this.plant.core.state[finalIndex] = this.plant.STATE.STEM;

            // Transfer energy with slight reduction
            this.plant.core.energy[finalIndex] = this.plant.core.energy[index] * 0.7;
            this.plant.core.energy[index] *= 0.8;

            // Water transfer
            this.plant.core.water[finalIndex] = this.plant.core.water[index] * 0.6;
            this.plant.core.water[index] *= 0.8;

            // Add trunk-specific metadata to help with coloration and tracking
            // Store trunk thickness in high bits, use low bits for color variation
            this.plant.core.metadata[finalIndex] = 50 + Math.min(20, trunkDev.thickness * 5);

            // Propagate plant group ID
            if (this.plant.plantGroups[index]) {
                this.plant.plantGroups[finalIndex] = this.plant.plantGroups[index];
            }

            // Mark as connected to ground
            this.plant.plantConnectivity.connectedToGround[finalIndex] = 1;
            this.plant.plantConnectivity.checkedThisFrame[finalIndex] = 1;

            // Increment trunk height
            trunkDev.height++;

            nextActivePixels.add(finalIndex);
        }
    },

    // Grow new stem pixels with connectivity checks
    growStem: function(x, y, index, nextActivePixels) {
        // Get the plant group ID to determine species
        const plantGroupId = this.plant.plantGroups[index];
        let speciesIndex = 0; // Default species
        
        // Get the plant species if available
        if (plantGroupId && this.plant.plantSpeciesMap[plantGroupId] !== undefined) {
            speciesIndex = this.plant.plantSpeciesMap[plantGroupId];
        }
        
        // Get species-specific growth parameters
        const species = this.plant.plantSpecies[speciesIndex];
        
        // Adjust growth behavior based on plant species
        let upWeight = 20;    // Default up weight
        let diagWeight = 12;  // Default diagonal weight
        let sideWeight = 10;  // Default side weight
        let longWeight = 5;   // Default long reach weight
        
        // Modify growth patterns based on species
        if (species) {
            // Different plant types have different growth habits
            switch (species.name) {
                case "jungle_vine":
                    // More spread out, vine-like growth
                    upWeight = 12;
                    diagWeight = 15; // More diagonal growth
                    sideWeight = 15; // More lateral spread
                    longWeight = 10; // More extended growth
                    break;
                case "tropical_palm":
                    // Strong upward growth with less spread
                    upWeight = 20;
                    diagWeight = 10;
                    sideWeight = 5;
                    longWeight = 3;
                    break;
                case "fern":
                    // Balanced growth with more side branching
                    upWeight = 12;
                    diagWeight = 15;
                    sideWeight = 12;
                    longWeight = 8;
                    break;
                case "succulent":
                    // Compact, stocky growth
                    upWeight = 10;
                    diagWeight = 8;
                    sideWeight = 12;
                    longWeight = 3;
                    break;
                case "bamboo":
                    // Strong vertical growth with minimal spread
                    upWeight = 25;
                    diagWeight = 8;
                    sideWeight = 5;
                    longWeight = 3;
                    break;
                case "flower_bush":
                    // Bushy growth with lots of branching
                    upWeight = 12;
                    diagWeight = 14;
                    sideWeight = 14;
                    longWeight = 6;
                    break;
            }
        }
        
        // Regular branches - growth pattern adjusted by species
        const growthDirections = [
            {dx: 0, dy: -1, weight: upWeight},        // Up
            {dx: -1, dy: -1, weight: diagWeight},     // Up-left
            {dx: 1, dy: -1, weight: diagWeight},      // Up-right
            {dx: -1, dy: 0, weight: sideWeight},      // Left
            {dx: 1, dy: 0, weight: sideWeight},       // Right
            {dx: -2, dy: -1, weight: longWeight},     // Long reach left-up
            {dx: 2, dy: -1, weight: longWeight},      // Long reach right-up
            {dx: -2, dy: -2, weight: longWeight/2},   // Diagonal bendy growth
            {dx: 2, dy: -2, weight: longWeight/2}     // Diagonal bendy growth
        ];
        
        // Get ground level and plant height for reference
        const groundLevel = Math.floor(this.plant.core.height * 0.6);
        const plantHeight = this.plant.plantMetrics.stemHeight;
        
        // Check if connected to other plant parts - stems should not grow in isolation
        let isConnectedToBranch = false;
        const neighbors = this.plant.core.getNeighborIndices(x, y);
        
        // Count connected plant parts
        let connectedPlantParts = 0;
        for (const neighbor of neighbors) {
            if (this.plant.core.type[neighbor.index] === this.plant.TYPE.PLANT) {
                connectedPlantParts++;
            }
        }
        
        // Safety check - stems should have at least one connection to another plant part
        // For small plants, allow some leniency to help them get established
        if (connectedPlantParts === 0 && this.plant.plantMetrics.stemHeight > 3) {
            // This stem somehow got isolated - it's not supported
            // Mark it for detachment on next update
            this.plant.plantConnectivity.connectedToGround[index] = 0;
            return;
        }

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
            const newIndex = this.plant.core.getIndex(newX, newY);

            // Can only grow into air
            if (newIndex !== -1 && this.plant.core.type[newIndex] === this.plant.TYPE.AIR) {
                // Create new stem
                this.plant.core.type[newIndex] = this.plant.TYPE.PLANT;
                this.plant.core.state[newIndex] = this.plant.STATE.STEM;
                
                const newCoords = this.plant.core.getCoords(newIndex);
                
                // Propagate plant group ID for origin tracking
                if (this.plant.plantGroups && this.plant.plantGroups[index]) {
                    const groupId = this.plant.plantGroups[index];
                    this.plant.plantGroups[newIndex] = groupId;
                }
                
                // Regular stem growth - all stems use the same energy distribution
                this.plant.core.energy[newIndex] = this.plant.core.energy[index] * 0.6;
                
                this.plant.core.energy[index] = this.plant.core.energy[index] * 0.6; // Parent loses less energy (120% total for growth boost)

                // Stems need abundant water for aggressive Jumanji-like growth
                const waterShare = Math.min(0.6, 0.4 + (0.2 / Math.sqrt(this.plant.plantMetrics.totalSize + 1)));
                this.plant.core.water[newIndex] = this.plant.core.water[index] * waterShare;
                this.plant.core.water[index] = this.plant.core.water[index] * (1 - waterShare * 0.4); // Lose even less water when growing

                // Mark as connected to ground (inherits connectivity from parent)
                this.plant.plantConnectivity.connectedToGround[newIndex] = 1;
                nextActivePixels.add(newIndex);
                
                // New stems are checked in the next frame
                this.plant.plantConnectivity.checkedThisFrame[newIndex] = 1;
            }
        }

        // Enhanced flower production for rapid seed dispersal
        // Only at tip endpoints for better aesthetic appearance
        if ((y < this.plant.core.height * 0.6 || Math.random() < 0.01) && this.plant.core.energy[index] > 100 && Math.random() < 0.08 * this.plant.biology.growthRate) {
            // Count surrounding plant parts to ensure it's a stem endpoint (max 1-2 connections)
            const neighbors = this.plant.core.getNeighborIndices(x, y);
            let stemCount = 0;
            
            for (const neighbor of neighbors) {
                if (this.plant.core.type[neighbor.index] === this.plant.TYPE.PLANT) {
                    stemCount++;
                }
            }
            
            // Only create flowers at stem endpoints or tips
            if (stemCount <= 2) {
                this.plant.core.state[index] = this.plant.STATE.FLOWER;
                
                // Create an actual flower shape with petals
                this.createFlowerPetals(x, y, index, nextActivePixels);
            }
        }
    },

    // Create a flower with petals around a center
    createFlowerPetals: function(x, y, index, nextActivePixels) {
        // Get plant species/variant ID from plant group for consistent flower patterns
        const plantGroup = this.plant.plantGroups[index] || 0;
        // Use plant group ID and coordinates for deterministic but varied flower patterns
        const patternSeed = (plantGroup * 13 + x * 7 + y * 11) % 100;
        
        // Determine flower type based on pattern seed
        // This ensures the same plant will have consistent flower types
        const flowerTypeIndex = patternSeed % 6; // 0-5 based on PlantFlowerSystem.flowerTypes
        
        // Color variation (0-4) for this plant species
        const colorVar = Math.floor(patternSeed / 20); // 0-4 color variations
        
        // Generate petal positions based on flower type
        let petalPositions = [];
        
        // Basic 8-direction template
        const baseDirections = [
            {dx: -1, dy: 0},    // Left
            {dx: -1, dy: -1},   // Upper left
            {dx: 0, dy: -1},    // Up
            {dx: 1, dy: -1},    // Upper right
            {dx: 1, dy: 0},     // Right
            {dx: 1, dy: 1},     // Lower right
            {dx: 0, dy: 1},     // Down
            {dx: -1, dy: 1}     // Lower left
        ];
        
        // Extended directions for more complex flowers
        const extendedDirections = [
            {dx: -2, dy: 0},    // Far left
            {dx: -2, dy: -1},   // Far upper left
            {dx: -2, dy: -2},   // Far diagonal upper left
            {dx: -1, dy: -2},   // Far diagonal upper left
            {dx: 0, dy: -2},    // Far up
            {dx: 1, dy: -2},    // Far diagonal upper right
            {dx: 2, dy: -2},    // Far diagonal upper right
            {dx: 2, dy: -1},    // Far upper right
            {dx: 2, dy: 0},     // Far right
            {dx: 2, dy: 1},     // Far lower right
            {dx: 2, dy: 2},     // Far diagonal lower right
            {dx: 1, dy: 2},     // Far diagonal lower right
            {dx: 0, dy: 2},     // Far down
            {dx: -1, dy: 2},    // Far diagonal lower left
            {dx: -2, dy: 2},    // Far diagonal lower left
            {dx: -2, dy: 1}     // Far lower left
        ];
        
        // Create specialized petal patterns based on flower type
        switch(flowerTypeIndex) {
            case 0: // Daisy - rounded flower with evenly distributed petals
                // Select all standard petals except maybe bottom ones
                petalPositions = baseDirections.filter(dir => {
                    // Skip some bottom petals for a more natural look
                    if (dir.dy > 0 && Math.random() < 0.5) return false;
                    return true;
                });
                break;
                
            case 1: // Rose - dense spiral pattern with multiple layers
                // Use all base directions
                petalPositions = [...baseDirections];
                // Add some extended petals for a fuller look
                extendedDirections.forEach(dir => {
                    // 40% chance to add each extended petal for roses
                    if (Math.random() < 0.4) {
                        petalPositions.push(dir);
                    }
                });
                break;
                
            case 2: // Tulip - cup-shaped, mainly upward petals
                // Focus on upper and side petals
                petalPositions = baseDirections.filter(dir => {
                    // Keep mainly upward and side petals
                    if (dir.dy > 0 && dir.dx !== 0) return false; // Remove lower diagonal petals
                    if (dir.dy > 0 && Math.random() < 0.8) return false; // Rarely keep direct bottom petals
                    return true;
                });
                break;
                
            case 3: // Sunflower - large, radial pattern with many petals
                // Use all base directions
                petalPositions = [...baseDirections];
                // Add many extended petals for a large sunflower look
                extendedDirections.forEach(dir => {
                    // 70% chance to add extended petals for sunflowers
                    if (Math.random() < 0.7) {
                        petalPositions.push(dir);
                    }
                });
                break;
                
            case 4: // Orchid - asymmetric, exotic pattern
                // Start with fewer base petals
                petalPositions = baseDirections.filter(dir => Math.random() < 0.6);
                // Add some specific extended petals for exotic look
                if (Math.random() < 0.7) petalPositions.push({dx: -2, dy: -1});
                if (Math.random() < 0.7) petalPositions.push({dx: 2, dy: -1});
                if (Math.random() < 0.5) petalPositions.push({dx: 0, dy: -2});
                if (Math.random() < 0.3) petalPositions.push({dx: 0, dy: 2});
                break;
                
            case 5: // Lily - trumpet shape with extended petals
                // Focus on upper and side petals with some extension
                petalPositions = baseDirections.filter(dir => {
                    // Remove most bottom petals for lily shape
                    if (dir.dy > 0 && Math.random() < 0.8) return false;
                    return true;
                });
                // Add some extended upper petals
                if (Math.random() < 0.8) petalPositions.push({dx: -1, dy: -2});
                if (Math.random() < 0.8) petalPositions.push({dx: 1, dy: -2});
                if (Math.random() < 0.7) petalPositions.push({dx: 0, dy: -2});
                break;
        }
        
        // Create each petal
        for (const dir of petalPositions) {
            const petalX = x + dir.dx;
            const petalY = y + dir.dy;
            const petalIndex = this.plant.core.getIndex(petalX, petalY);
            
            // Create petal if space is available
            if (petalIndex !== -1 && this.plant.core.type[petalIndex] === this.plant.TYPE.AIR) {
                // Create flower petal
                this.plant.core.type[petalIndex] = this.plant.TYPE.PLANT;
                this.plant.core.state[petalIndex] = this.plant.STATE.FLOWER;
                
                // Share energy and water with petal
                this.plant.core.energy[petalIndex] = this.plant.core.energy[index] * 0.4;
                this.plant.core.water[petalIndex] = this.plant.core.water[index] * 0.4;
                
                // Mark as connected to ground (inherits connectivity from parent)
                this.plant.plantConnectivity.connectedToGround[petalIndex] = 1;
                this.plant.plantConnectivity.checkedThisFrame[petalIndex] = 1;
                
                // Propagate plant group ID for origin tracking
                if (this.plant.plantGroups[index]) {
                    this.plant.plantGroups[petalIndex] = this.plant.plantGroups[index];
                }
                
                // Store flower type and color variation in metadata for rendering
                // Use the format: high 4 bits for flower type (0-5), low 4 bits for color variation (0-4)
                this.plant.core.metadata[petalIndex] = (flowerTypeIndex << 4) | colorVar;
                
                // Also store the same metadata in the center flower for consistency
                this.plant.core.metadata[index] = (flowerTypeIndex << 4) | colorVar;
                
                nextActivePixels.add(petalIndex);
            }
        }
    },
    
    // Grow a leaf from a stem with connectivity checks
    growLeaf: function(x, y, index, nextActivePixels) {
        // Get the plant group ID to determine species
        const plantGroupId = this.plant.plantGroups[index];
        let speciesIndex = 0; // Default species
        
        // Get the plant species if available
        if (plantGroupId && this.plant.plantSpeciesMap[plantGroupId] !== undefined) {
            speciesIndex = this.plant.plantSpeciesMap[plantGroupId];
        }
        
        // Get species-specific leaf parameters
        const species = this.plant.plantSpecies[speciesIndex];
        
        // Base leaf directions
        const baseLeafDirections = [
            {dx: -1, dy: 0},   // Left
            {dx: 1, dy: 0},    // Right
            {dx: -1, dy: -1},  // Up-left
            {dx: 1, dy: -1},   // Up-right
            {dx: 0, dy: -1}    // Up
        ];
        
        // Extended leaf directions for larger leaf types
        const extendedLeafDirections = [
            {dx: -2, dy: 0},   // Far left
            {dx: 2, dy: 0},    // Far right
            {dx: -2, dy: -1},  // Far up-left
            {dx: 2, dy: -1},   // Far up-right
            {dx: -1, dy: -2},  // Far up-left
            {dx: 1, dy: -2},   // Far up-right
            {dx: 0, dy: -2}    // Far up
        ];
        
        // Choose leaf shape based on species
        let leafDirections = [...baseLeafDirections]; // Default shape
        let sizeMultiplier = 2.0;
        
        if (species) {
            // Different species have different leaf shapes
            switch (species.leafShape) {
                case "heart":
                    // Heart-shaped leaves have more side growth
                    leafDirections = baseLeafDirections.filter(dir => true); // Use all base directions
                    // Add more side directions for width
                    if (Math.random() < 0.7) leafDirections.push({dx: -2, dy: 0});
                    if (Math.random() < 0.7) leafDirections.push({dx: 2, dy: 0});
                    sizeMultiplier = species.leafSize || 1.2;
                    break;
                    
                case "fan":
                    // Fan-shaped leaves are wide and short
                    leafDirections = baseLeafDirections.filter(dir => {
                        // More focus on side growth
                        return dir.dx !== 0 || Math.random() < 0.4; // Keep horizontal directions
                    });
                    // Add all side extensions
                    if (Math.random() < 0.8) leafDirections.push({dx: -2, dy: 0});
                    if (Math.random() < 0.8) leafDirections.push({dx: 2, dy: 0});
                    if (Math.random() < 0.6) leafDirections.push({dx: -2, dy: -1});
                    if (Math.random() < 0.6) leafDirections.push({dx: 2, dy: -1});
                    sizeMultiplier = species.leafSize || 1.5;
                    break;
                    
                case "frond":
                    // Frond-like leaves are thinner and longer
                    leafDirections = baseLeafDirections.filter(dir => {
                        // Keep upward directions, fewer side ones
                        return dir.dy === -1 || Math.random() < 0.4;
                    });
                    // Add vertical extensions
                    if (Math.random() < 0.7) leafDirections.push({dx: 0, dy: -2});
                    if (Math.random() < 0.5) leafDirections.push({dx: -1, dy: -2});
                    if (Math.random() < 0.5) leafDirections.push({dx: 1, dy: -2});
                    sizeMultiplier = species.leafSize || 0.9;
                    break;
                    
                case "round":
                    // Round leaves are more compact
                    leafDirections = baseLeafDirections.filter(dir => {
                        // Fewer diagonal directions
                        return (dir.dx === 0 || dir.dy === 0) || Math.random() < 0.5;
                    });
                    sizeMultiplier = species.leafSize || 0.8;
                    break;
                    
                case "pointed":
                    // Pointed leaves are longer and narrower
                    leafDirections = baseLeafDirections.filter(dir => {
                        // Favor vertical growth
                        return dir.dy === -1 || Math.random() < 0.3;
                    });
                    // Add vertical extension
                    if (Math.random() < 0.6) leafDirections.push({dx: 0, dy: -2});
                    sizeMultiplier = species.leafSize || 0.7;
                    break;
                    
                case "oval":
                    // Oval leaves are balanced
                    leafDirections = baseLeafDirections.filter(dir => {
                        // Generally balanced
                        return true;
                    });
                    // Add a few extensions for larger leaves
                    if (Math.random() < 0.3) leafDirections.push({dx: -2, dy: 0});
                    if (Math.random() < 0.3) leafDirections.push({dx: 2, dy: 0});
                    if (Math.random() < 0.3) leafDirections.push({dx: 0, dy: -1});
                    sizeMultiplier = species.leafSize || 0.9;
                    break;
                
                default:
                    // Default leaf shape if nothing matches
                    sizeMultiplier = 1.0;
            }
        }
        
        // Make sure stem is stable enough to support a leaf
        // Count connected plant parts
        const neighbors = this.plant.core.getNeighborIndices(x, y);
        let connectedPlantParts = 0;
        
        for (const neighbor of neighbors) {
            if (this.plant.core.type[neighbor.index] === this.plant.TYPE.PLANT) {
                connectedPlantParts++;
            }
        }
        
        // Relaxed connection requirements for aggressive leafy growth
        // Even minimally supported stems can grow leaves for Jumanji-style overgrowth
        if (connectedPlantParts < 1 && Math.random() > 0.3) {
            // Still some restriction but 30% chance to grow leaf even when poorly supported
            return;
        }

        // Choose a random direction
        const dir = leafDirections[Math.floor(Math.random() * leafDirections.length)];

        const newX = x + dir.dx;
        const newY = y + dir.dy;
        const newIndex = this.plant.core.getIndex(newX, newY);

        // Can only grow into air
        if (newIndex !== -1 && this.plant.core.type[newIndex] === this.plant.TYPE.AIR) {
            // Create leaf
            this.plant.core.type[newIndex] = this.plant.TYPE.PLANT;
            this.plant.core.state[newIndex] = this.plant.STATE.LEAF;

            // Transfer some energy and water
            this.plant.core.energy[newIndex] = this.plant.core.energy[index] / 3;
            this.plant.core.energy[index] = this.plant.core.energy[index] * 2 / 3;

            this.plant.core.water[newIndex] = this.plant.core.water[index] / 3;
            this.plant.core.water[index] = this.plant.core.water[index] * 2 / 3;

            // Mark as connected to ground (inherits connectivity from parent)
            this.plant.plantConnectivity.connectedToGround[newIndex] = 1;
            this.plant.plantConnectivity.checkedThisFrame[newIndex] = 1;
            
            // Propagate plant group ID for origin tracking
            if (this.plant.plantGroups[index]) {
                this.plant.plantGroups[newIndex] = this.plant.plantGroups[index];
            }
            
            nextActivePixels.add(newIndex);
        }
    }
};