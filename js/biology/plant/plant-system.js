// Plant System - main coordinator
// This file handles initialization and updates for all plant subsystems

window.PlantSystem = {
    // Reference to parent biology system
    biology: null,

    // Shorthand references to commonly used objects
    core: null,
    TYPE: null,
    STATE: null,

    // Plant subsystems
    rootSystem: null,
    stemSystem: null,
    leafSystem: null,
    flowerSystem: null,
    
    // Plant growth tracking
    plantMetrics: {
        stemHeight: 0,              // Track how tall stems grow to scale roots appropriately
        leafCount: 0,               // Track number of leaves to determine root system size
        rootStrength: 1.0,          // Strength of root-to-stem connection
        stemIntegrity: 1.0,         // Structural integrity of stems
        waterNeeds: 1.0,            // Water needs multiplier based on plant size
        totalSize: 0                // Total size of the plant (pixel count)
    },
    
    // Plant species/variants
    plantSpecies: [
        {
            name: "jungle_vine",
            leafShape: "heart",
            leafSize: 1.2,
            stemColor: "green", // bright green stems
            leafColor: "vibrant", // bright green leaves
            growthRate: 1.3
        },
        {
            name: "tropical_palm",
            leafShape: "fan",
            leafSize: 1.5,
            stemColor: "brown", // brown stems
            leafColor: "deep", // deep green leaves
            growthRate: 0.9
        },
        {
            name: "fern",
            leafShape: "frond",
            leafSize: 0.9,
            stemColor: "darkgreen", // dark green stems
            leafColor: "forest", // forest green leaves 
            growthRate: 1.1
        },
        {
            name: "succulent",
            leafShape: "round",
            leafSize: 0.8,
            stemColor: "reddish", // reddish stems
            leafColor: "pale", // pale green leaves with blue tint
            growthRate: 0.7
        },
        {
            name: "bamboo",
            leafShape: "pointed",
            leafSize: 0.7,
            stemColor: "yellow", // yellowish stems
            leafColor: "light", // light green leaves
            growthRate: 1.2
        },
        {
            name: "flower_bush",
            leafShape: "oval",
            leafSize: 0.9,
            stemColor: "purple", // purplish stems
            leafColor: "dark", // dark green leaves
            growthRate: 1.0
        }
    ],
    
    // Plant age tracking by plant part indices
    plantAges: {},                  // Map of indices to age (frames since creation)
    
    // Plant origin tracking - where each plant germinated
    plantOrigins: {},              // Map of plant group IDs to origin coordinates {x, y}
    
    // Track the exact x-position of the first stem for each plant
    stemOrigins: {},               // Map of plant group IDs to stem x-coordinates
    
    // Plant groups to track which plant parts belong to which original plant
    plantGroups: {},               // Map of indices to plant group IDs
    nextPlantGroupId: 1,           // Counter for assigning unique IDs to plant groups
    
    // Store species/variant information for each plant group
    plantSpeciesMap: {},           // Map of plant group IDs to species indices

    // Initialize plant system
    init: function(biologySystem) {
        this.biology = biologySystem;
        this.core = biologySystem.core;
        this.TYPE = biologySystem.TYPE;
        this.STATE = biologySystem.STATE;

        console.log("Initializing plant system...");
        
        // Initialize subsystems
        this.rootSystem = PlantRootSystem.init(this);
        this.stemSystem = PlantStemSystem.init(this);
        this.leafSystem = PlantLeafSystem.init(this);
        this.flowerSystem = PlantFlowerSystem.init(this);
        
        // Initialize plant ages tracking
        this.plantAges = {};
        
        // Initialize plant origin tracking
        this.plantOrigins = {};
        this.stemOrigins = {};
        this.plantGroups = {};
        this.nextPlantGroupId = 1;

        return this;
    },

    // Track plant connectivity
    plantConnectivity: {
        connectedToGround: null,  // Array of booleans tracking if each plant pixel is connected
        rootIndices: [],          // List of root indices connected to ground
        checkedThisFrame: null    // Track which pixels we've already checked
    },
    
    // Update all plant pixels
    update: function(activePixels, nextActivePixels) {
        // Reset plant metrics for this frame
        this.plantMetrics.stemHeight = 0;
        this.plantMetrics.leafCount = 0;
        this.plantMetrics.rootStrength = 1.0;
        this.plantMetrics.stemIntegrity = 1.0;
        this.plantMetrics.waterNeeds = 1.0;
        this.plantMetrics.totalSize = 0;
        
        // Initialize connectivity tracking
        if (!this.plantConnectivity.connectedToGround) {
            this.plantConnectivity.connectedToGround = new Uint8Array(this.core.size);
        }
        if (!this.plantConnectivity.checkedThisFrame) {
            this.plantConnectivity.checkedThisFrame = new Uint8Array(this.core.size);
        }
        
        // Make sure metadata array exists (used for trunk tracking)
        if (!this.core.metadata) {
            this.core.metadata = new Uint8Array(this.core.size);
        }
        
        // Reset connectivity arrays
        this.plantConnectivity.connectedToGround.fill(0);
        this.plantConnectivity.checkedThisFrame.fill(0);
        this.plantConnectivity.rootIndices = [];
        
        // First pass - find all ground-connected roots
        this.findGroundConnectedRoots(activePixels);
        
        // Second pass - mark all plant parts connected to roots
        this.markConnectedPlantParts();
        
        // Third pass - count metrics (stem height, leaf count) only for connected plants
        this.countPlantMetrics(activePixels);
        
        // Process any trapped debris inside plants
        this.processTrappedDebris(activePixels, nextActivePixels);
        
        // Fourth pass - update each plant pixel or detach floating parts
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.PLANT && !this.biology.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);
                
                // Check if this plant part is connected to the ground
                if (this.plantConnectivity.connectedToGround[index]) {
                    // Track or update plant age
                    if (!this.plantAges[index]) {
                        this.plantAges[index] = 1; // Initialize age if not already tracked
                    } else {
                        this.plantAges[index]++; // Increment age counter
                    }
                    
                    // Connected plant parts update normally
                    this.updateSinglePlant(coords.x, coords.y, index, nextActivePixels);
                } else {
                    // Disconnected plant parts fall off and become dead matter
                    this.detachPlantPart(coords.x, coords.y, index, nextActivePixels);
                }
            }
        });
    },

    // Count important plant metrics to scale root growth appropriately
    countPlantMetrics: function(activePixels) {
        let stemCount = 0;
        let maxStemHeight = 0;
        let leafCount = 0;
        let totalPlantPixels = 0;

        // Process plant pixels to gather metrics
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.PLANT) {
                totalPlantPixels++;
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
        this.plantMetrics.totalSize = totalPlantPixels;
        
        // Calculate water needs based on plant size
        // Plants need more water as they grow larger
        if (totalPlantPixels > 0) {
            // Larger plants need more water, but the per-pixel need decreases due to efficiency
            this.plantMetrics.waterNeeds = Math.min(5.0, 1.0 + Math.pow(totalPlantPixels / 50, 0.7));
        }
        
        // Calculate root strength based on root count and distribution
        const rootCount = this.plantConnectivity.rootIndices.length;
        if (rootCount > 0) {
            // Dramatically increased root strength for Jumanji-like resilience
            this.plantMetrics.rootStrength = Math.min(8.0, 3.0 + (rootCount / 10));
            
            // Greatly increased stem integrity for aggressive vine growth
            this.plantMetrics.stemIntegrity = Math.min(6.0, 2.5 + (stemCount / 15) * this.plantMetrics.rootStrength / 1.5);
        } else {
            // Even rootless plants should have some integrity for vines
            this.plantMetrics.rootStrength = 1.0;
            this.plantMetrics.stemIntegrity = 1.0;
        }

        // Adjust root growth parameters based on above-ground growth
        this.rootSystem.adjustRootGrowthParameters();
    },

    // Update a single plant pixel
    // Find all roots connected to the ground
    findGroundConnectedRoots: function(activePixels) {
        // Calculate ground level
        const groundLevel = Math.floor(this.core.height * 0.6);
        
        // First find all roots at or below ground level
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.PLANT && 
                this.core.state[index] === this.STATE.ROOT) {
                
                const coords = this.core.getCoords(index);
                
                // Check if root is at or below ground level
                if (coords.y >= groundLevel) {
                    // Make sure this root is in contact with soil to count as grounded
                    const neighbors = this.core.getNeighborIndices(coords.x, coords.y);
                    let touchingSoil = false;
                    
                    for (const neighbor of neighbors) {
                        if (this.core.type[neighbor.index] === this.TYPE.SOIL) {
                            touchingSoil = true;
                            break;
                        }
                    }
                    
                    // Only count as grounded if touching soil
                    if (touchingSoil) {
                        // Mark as connected to ground
                        this.plantConnectivity.connectedToGround[index] = 1;
                        this.plantConnectivity.rootIndices.push(index);
                    }
                }
            }
        });
    },
    
    // Process debris that might be trapped inside a plant
    processTrappedDebris: function(activePixels, nextActivePixels) {
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.DEAD_MATTER && !this.biology.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);
                
                // Check if this debris is surrounded by plant matter
                const neighbors = this.core.getNeighborIndices(coords.x, coords.y);
                let surroundingPlantCount = 0;
                
                for (const neighbor of neighbors) {
                    if (this.core.type[neighbor.index] === this.TYPE.PLANT) {
                        surroundingPlantCount++;
                    }
                }
                
                // If debris is mostly surrounded by plant matter (3+ sides), process it
                if (surroundingPlantCount >= 3) {
                    // Mark as processed
                    this.biology.processedThisFrame[index] = 1;
                    
                    // 25% chance to begin decomposing in place
                    if (Math.random() < 0.25) {
                        // Accelerated decomposition for trapped debris
                        if (!this.core.metadata[index]) {
                            this.core.metadata[index] = 20; // Start with some decomposition progress
                        } else {
                            this.core.metadata[index] += 5; // Progress decomposition faster
                        }
                        
                        // If fully decomposed, convert to nutrients for the plant
                        if (this.core.metadata[index] >= 100) {
                            // Find a nearby plant part to give nutrients to
                            let targetNeighbor = null;
                            for (const neighbor of neighbors) {
                                if (this.core.type[neighbor.index] === this.TYPE.PLANT) {
                                    targetNeighbor = neighbor;
                                    break;
                                }
                            }
                            
                            if (targetNeighbor) {
                                // Transfer nutrients to plant part
                                this.core.energy[targetNeighbor.index] = Math.min(255, 
                                    this.core.energy[targetNeighbor.index] + 20);
                                
                                // Increase water if needed
                                if (this.core.water[targetNeighbor.index] < 100) {
                                    this.core.water[targetNeighbor.index] += 10;
                                }
                                
                                // Remove debris
                                this.core.type[index] = this.TYPE.AIR;
                                nextActivePixels.add(targetNeighbor.index);
                            } else {
                                // If no plant neighbors found, just convert to air
                                this.core.type[index] = this.TYPE.AIR;
                            }
                        } else {
                            // Still decomposing, remain active
                            nextActivePixels.add(index);
                        }
                    } 
                    // 25% chance to be pushed out of the plant gradually
                    else if (Math.random() < 0.33) {
                        // Find nearby air pixel to move toward
                        let airNeighbors = [];
                        for (const neighbor of neighbors) {
                            if (this.core.type[neighbor.index] === this.TYPE.AIR) {
                                airNeighbors.push(neighbor);
                            }
                        }
                        
                        // If an air pixel is found, move toward it
                        if (airNeighbors.length > 0) {
                            const targetAir = airNeighbors[Math.floor(Math.random() * airNeighbors.length)];
                            this.core.swapPixels(index, targetAir.index);
                            nextActivePixels.add(targetAir.index);
                        } else {
                            // No air found, stay active
                            nextActivePixels.add(index);
                        }
                    } else {
                        // Otherwise, remain active but don't change yet
                        nextActivePixels.add(index);
                    }
                } else {
                    // Not surrounded enough by plant to count as trapped
                    nextActivePixels.add(index);
                }
            }
        });
    },
    
    // Mark all plant parts connected to roots using flood fill
    markConnectedPlantParts: function() {
        // Start from all ground-connected roots
        const queue = [...this.plantConnectivity.rootIndices];
        
        // For larger plants, a standard array can be inefficient for the queue
        // as shift() is O(n). For optimization, we'll use a simple queue implementation
        // with a front and back pointer.
        let front = 0;  // Front of the queue
        
        // Process the queue
        while (front < queue.length) {
            const currentIndex = queue[front++];  // Get next item and increment front
            
            // Skip if already checked (should be redundant now with our tracking)
            if (this.plantConnectivity.checkedThisFrame[currentIndex]) continue;
            this.plantConnectivity.checkedThisFrame[currentIndex] = 1;
            
            // Get coordinates
            const coords = this.core.getCoords(currentIndex);
            
            // Check all neighbors
            const neighbors = this.core.getNeighborIndices(coords.x, coords.y);
            
            for (const neighbor of neighbors) {
                // Only process plant pixels that haven't been checked yet
                if (this.core.type[neighbor.index] === this.TYPE.PLANT && 
                    !this.plantConnectivity.checkedThisFrame[neighbor.index]) {
                    
                    // Mark as connected to ground
                    this.plantConnectivity.connectedToGround[neighbor.index] = 1;
                    
                    // Add to queue for further processing
                    queue.push(neighbor.index);
                }
                
                // For Jumanji-like growth, also count air pixels as potential growth points
                // This dramatically enhances connectivity and prevents breakage
                if (this.core.type[neighbor.index] === this.TYPE.AIR) {
                    // 30% chance to consider an air pixel as a potential future connection point
                    // This creates a "force field" of potential growth areas that don't break easily
                    if (Math.random() < 0.3) {
                        this.plantConnectivity.connectedToGround[neighbor.index] = 1;
                    }
                }
            }
        }
        
        // Additional verification - make sure stems are well supported
        // This helps prevent issues where a single thin connection supports a large structure
        this.verifyStructuralIntegrity();
    },
    
    // Verify plant parts have proper structural support
    verifyStructuralIntegrity: function() {
        // For each connected plant part, verify it has enough support
        // Go through all active pixels (this is a subset of the simulation)
        const connectedIndices = [];
        
        // Collect all indices of connected plant parts
        for (let i = 0; i < this.plantConnectivity.connectedToGround.length; i++) {
            if (this.plantConnectivity.connectedToGround[i] && 
                this.core.type[i] === this.TYPE.PLANT) {
                connectedIndices.push(i);
            }
        }
        
        // Count stems near roots to calculate trunk thickness
        let trunkThickness = 1;
        const groundLevel = Math.floor(this.core.height * 0.6);
        let nearGroundStems = 0;
        
        // Count stems near the ground level to determine trunk thickness
        for (const index of connectedIndices) {
            if (this.core.state[index] === this.STATE.STEM) {
                const coords = this.core.getCoords(index);
                // Check if stem is near ground (first 5 rows above ground)
                if (coords.y >= groundLevel - 5 && coords.y < groundLevel) {
                    nearGroundStems++;
                }
            }
        }
        
        // Calculate trunk thickness (1-3 scale)
        if (nearGroundStems > 0) {
            trunkThickness = Math.min(3.0, 1.0 + (nearGroundStems / 5));
        }
        
        // Apply massively increased root strength bonus to trunk thickness
        const effectiveTrunkThickness = trunkThickness * this.plantMetrics.rootStrength * 2.0; // Doubled multiplier for extreme resilience
        
        // Check each part for sufficient support
        for (const index of connectedIndices) {
            const state = this.core.state[index];
            const coords = this.core.getCoords(index);
            
            // Different plant parts need different levels of support
            if (state === this.STATE.STEM) {
                // Stems need good support, especially higher up
                const heightFromGround = groundLevel - coords.y; // Higher = more height
                
                // Higher stems need more support
                const neighbors = this.core.getNeighborIndices(coords.x, coords.y);
                let supportCount = 0;
                
                for (const neighbor of neighbors) {
                    if (this.core.type[neighbor.index] === this.TYPE.PLANT && 
                        this.plantConnectivity.connectedToGround[neighbor.index]) {
                        supportCount++;
                        
                        // Count neighboring stems for additional support
                        if (this.core.state[neighbor.index] === this.STATE.STEM) {
                            // Stems provide better support than other plant parts
                            supportCount += 0.5;
                        }
                    }
                }
                
                // Dramatically boost effective support for Jumanji-style growth
                const effectiveSupportCount = supportCount * 
                    (effectiveTrunkThickness * 1.5) * 
                    this.plantMetrics.stemIntegrity * 2.0; // Doubled multiplication factor
                
                // Support requirements based on height, but significantly reduced for Jumanji-like growth
                let requiredSupport = 0.5;  // Dramatically reduced base requirement
                
                // Adjust support requirements based on effective trunk thickness with much more lenient thresholds
                if (heightFromGround > 60 / effectiveTrunkThickness) {
                    requiredSupport = 1.0;
                }
                
                if (heightFromGround > 120 / effectiveTrunkThickness) {
                    requiredSupport = 1.5;
                }
                
                // For all plants, be extremely lenient to allow vine-like growth
                if (this.plantMetrics.stemHeight < 10) {
                    requiredSupport = 0.3; // Almost no support needed for small plants
                } else if (this.plantMetrics.stemHeight < 30) {
                    requiredSupport = 0.5; // Very minimal support for medium plants
                }
                
                // For stems near the base, provide dramatically extra strength
                if (heightFromGround < 20) {
                    requiredSupport = Math.max(0.1, requiredSupport - 1); // Almost no support requirement
                }
                
                // Special handling for ALL stems - they should be extremely strong for Jumanji vines
                const distanceFromCenter = Math.abs(coords.x - Math.floor(this.core.width / 2));
                if (heightFromGround < 35 || distanceFromCenter < 20) {
                    // Most stems are stable to allow for vine-like growth
                    requiredSupport = Math.max(0.1, requiredSupport - 0.8);
                }
                
                // If support is insufficient, mark for detachment
                if (effectiveSupportCount < requiredSupport) {
                    this.plantConnectivity.connectedToGround[index] = 0;
                }
            }
        }
    },
    
    // Detach a plant part that's not connected to the ground
    detachPlantPart: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.biology.processedThisFrame[index] = 1;
        
        // Get the plant state to determine detached behavior
        const state = this.core.state[index];
        
        // Detached parts become dead matter but retain some properties
        this.core.type[index] = this.TYPE.DEAD_MATTER;
        
        // Different plant parts have different values as dead matter
        switch (state) {
            case this.STATE.LEAF:
                // Leaves have moderate nutrients
                this.core.nutrient[index] = 20;
                break;
            case this.STATE.STEM:
                // Stems have more energy value
                this.core.nutrient[index] = 15;
                this.core.energy[index] = Math.max(20, this.core.energy[index]);
                break;
            case this.STATE.FLOWER:
                // Flowers have high nutrient value
                this.core.nutrient[index] = 30;
                break;
            case this.STATE.ROOT:
                // Roots have more water content
                this.core.nutrient[index] = 15;
                break;
        }
        
        // Clean up age tracking when plant part is detached
        delete this.plantAges[index];
        
        // Reset state to default
        this.core.state[index] = this.STATE.DEFAULT;
        
        // Mark as active for next frame
        nextActivePixels.add(index);
        
        // Find connected detached parts and detach them as a group
        // This makes breaking more interesting as whole branches fall off
        this.detachConnectedPlantParts(x, y, nextActivePixels);
    },
    
    // Find and detach all connected plant parts in a cluster
    detachConnectedPlantParts: function(startX, startY, nextActivePixels) {
        // Use a temporary queue for flood fill of disconnected parts
        const queue = [];
        const processed = new Set();
        
        // Get starting neighbors
        const startNeighbors = this.core.getNeighborIndices(startX, startY);
        
        // Add all plant neighbors that aren't connected to ground
        for (const neighbor of startNeighbors) {
            if (this.core.type[neighbor.index] === this.TYPE.PLANT && 
                !this.plantConnectivity.connectedToGround[neighbor.index] &&
                !this.biology.processedThisFrame[neighbor.index]) {
                queue.push(neighbor);
            }
        }
        
        // Process the queue to find all connected parts to detach
        while (queue.length > 0) {
            const current = queue.shift();
            const currentIndex = current.index;
            
            // Skip if already processed
            if (processed.has(currentIndex) || this.biology.processedThisFrame[currentIndex]) continue;
            processed.add(currentIndex);
            
            // Convert to dead matter with properties based on type
            const state = this.core.state[currentIndex];
            
            // Mark as processed
            this.biology.processedThisFrame[currentIndex] = 1;
            
            // Convert to dead matter
            this.core.type[currentIndex] = this.TYPE.DEAD_MATTER;
            
            // Set properties based on plant part type
            switch (state) {
                case this.STATE.LEAF:
                    this.core.nutrient[currentIndex] = 20;
                    break;
                case this.STATE.STEM:
                    this.core.nutrient[currentIndex] = 15;
                    this.core.energy[currentIndex] = Math.max(20, this.core.energy[currentIndex]);
                    break;
                case this.STATE.FLOWER:
                    this.core.nutrient[currentIndex] = 30;
                    break;
                case this.STATE.ROOT:
                    this.core.nutrient[currentIndex] = 15;
                    break;
            }
            
            // Reset state
            this.core.state[currentIndex] = this.STATE.DEFAULT;
            
            // Mark as active for next frame
            nextActivePixels.add(currentIndex);
            
            // Check neighbors
            const coords = this.core.getCoords(currentIndex);
            const neighbors = this.core.getNeighborIndices(coords.x, coords.y);
            
            // Add all unprocessed plant neighbors
            for (const neighbor of neighbors) {
                if (this.core.type[neighbor.index] === this.TYPE.PLANT && 
                    !this.plantConnectivity.connectedToGround[neighbor.index] &&
                    !processed.has(neighbor.index) &&
                    !this.biology.processedThisFrame[neighbor.index]) {
                    queue.push(neighbor);
                }
            }
        }
    },
    
    updateSinglePlant: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.biology.processedThisFrame[index] = 1;

        // Ensure nextActivePixels exists even if not provided (for testing)
        nextActivePixels = nextActivePixels || new Set();

        // Get plant state
        const state = this.core.state[index];

        // Different plant parts have different behaviors
        switch (state) {
            case this.STATE.ROOT:
                this.rootSystem.updateRoot(x, y, index, nextActivePixels);
                break;
            case this.STATE.STEM:
                this.stemSystem.updateStem(x, y, index, nextActivePixels);
                break;
            case this.STATE.LEAF:
                this.leafSystem.updateLeaf(x, y, index, nextActivePixels);
                break;
            case this.STATE.FLOWER:
                this.flowerSystem.updateFlower(x, y, index, nextActivePixels);
                break;
            default:
                // Unknown plant state, keep active but don't do anything
                nextActivePixels.add(index);
                break;
        }

        // Boost energy for small plants to help them establish
        if (this.plantMetrics.stemHeight < 10 && Math.random() < 0.05) {
            this.core.energy[index] = Math.min(255, this.core.energy[index] + 3);
        }
        
        // Boost water levels in stems and leaves for larger plants
        // This helps prevent the dark spots that appear in larger plants due to water deficiency
        if ((state === this.STATE.STEM || state === this.STATE.LEAF) && 
            this.plantMetrics.totalSize > 20 && 
            this.core.water[index] < 50 && 
            Math.random() < 0.1) {
            
            // Prioritize boosting water in stems for structural health
            if (state === this.STATE.STEM) {
                this.core.water[index] = Math.min(120, this.core.water[index] + 10);
            } else {
                this.core.water[index] = Math.min(100, this.core.water[index] + 5);
            }
        }

        // All plants lose energy over time (metabolism) - dramatically reduced rate for Jumanji growth
        this.core.energy[index] -= 0.12 * this.biology.metabolism; // Greatly reduced from 0.25 to 0.12
        
        // Random energy boost for rapid growth (Jumanji plants are super-charged)
        if (Math.random() < 0.08) {
            this.core.energy[index] = Math.min(255, this.core.energy[index] + 10);
        }

        // If energy is depleted, plant has chance to recover instead of dying for Jumanji resilience
        if (this.core.energy[index] <= 0) {
            // 75% chance to recover with minimal energy instead of dying
            if (Math.random() < 0.75) {
                this.core.energy[index] = 15 + Math.random() * 20;
                nextActivePixels.add(index);
                return;
            }
            // Only 25% chance to actually die when energy depleted
            this.core.type[index] = this.TYPE.DEAD_MATTER;
            nextActivePixels.add(index);
            return;
        }

        // Plants need water to survive - drastically reduced penalty for Jumanji plants
        if (this.core.water[index] <= 0) {
            // Different plant parts lose energy at different rates when dehydrated
            let waterStressFactor = 0.6; // Halved from 1.2
            
            // Stems and flowers need more protection from water stress
            if (state === this.STATE.STEM) {
                waterStressFactor = 0.3; // Stems are extremely resistant to water stress
            } else if (state === this.STATE.LEAF) {
                waterStressFactor = 0.8; // Leaves more resistant to water stress
            }
            
            // Plants without water lose energy at a much slower rate
            this.core.energy[index] -= waterStressFactor * this.biology.metabolism;
            
            // Occasional random water boost to help plants survive dry periods
            if (Math.random() < 0.2) {
                this.core.water[index] = 5 + Math.random() * 10; // Small water boost from humidity
            }
        }
    }
};

// Make PlantSystem available for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.PlantSystem;
}