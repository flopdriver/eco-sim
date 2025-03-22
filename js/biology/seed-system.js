// Seed System
// Handles seed germination and behavior

const SeedSystem = {
    // Reference to parent biology system
    biology: null,

    // Shorthand references to commonly used objects
    core: null,
    TYPE: null,
    STATE: null,

    // Initialize seed system
    init: function(biologySystem) {
        this.biology = biologySystem;
        this.core = biologySystem.core;
        this.TYPE = biologySystem.TYPE;
        this.STATE = biologySystem.STATE;

        console.log("Initializing seed system...");

        return this;
    },

    // Update all seed pixels
    update: function(activePixels, nextActivePixels) {
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.SEED && !this.biology.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);
                this.updateSingleSeed(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Update a single seed
    updateSingleSeed: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.biology.processedThisFrame[index] = 1;

        // Handle two cases: seeds on soil or seeds buried in soil
        const downIndex = this.core.getIndex(x, y + 1);
        const currentLocation = this.core.type[index];
        const downLocation = downIndex !== -1 ? this.core.type[downIndex] : null;

        // Check for fire-adapted seeds (marked with metadata value 200+)
        const isFireAdapted = this.core.metadata[index] >= 200;
        
        // Check if this area has recently burned (using FireSystem if available)
        let recentlyBurned = false;
        if (window.ecosim && window.ecosim.environment && window.ecosim.environment.fireSystem) {
            // Check current position
            recentlyBurned = window.ecosim.environment.fireSystem.isRecentlyBurned(index);
            
            // If not burned at current position, check soil below
            if (!recentlyBurned && downIndex !== -1) {
                recentlyBurned = window.ecosim.environment.fireSystem.isRecentlyBurned(downIndex);
            }
        }

        // Case 1: Seed is on top of soil
        if (downIndex !== -1 && downLocation === this.TYPE.SOIL) {
            // More generous water requirement for germination
            if (this.core.water[downIndex] > 25) { // Reduced from 50 to 25
                // Base germination chance
                let germinationChance = 0.45 * this.biology.growthRate; // Massively increased from 0.25 to 0.45
                
                // Fire-adapted seeds in recently burned areas get a boost
                if (isFireAdapted && recentlyBurned) {
                    germinationChance *= 2.0; // Double germination chance for fire-adapted seeds in burned areas
                    console.log("Fire-adapted seed germinating in recently burned area");
                }
                
                if (Math.random() < germinationChance) {
                    // Convert seed to plant root
                    this.core.type[index] = this.TYPE.PLANT;
                    this.core.state[index] = this.STATE.ROOT;

                    // Initial root has more water and energy
                    this.core.water[index] = 80; // Increased from 50
                    
                    // Fire-adapted plants in burned areas start with more energy
                    let initialEnergy = 150;
                    if (isFireAdapted && recentlyBurned) {
                        initialEnergy = 250; // Extra energy for fire-adapted plants in burned areas
                    }
                    this.core.energy[index] = Math.max(this.core.energy[index], initialEnergy);
                    
                    // Create new plant using the plant system's helper method
                    // This handles plant group IDs, species assignment, and genetic traits
                    const parentSeedIndex = this.core.metadata[index] > 0 && this.core.metadata[index] < 200 ? 
                        this.getSeedParentIndex(index) : null;
                    
                    const plantGroupId = this.biology.plantSystem.createNewPlant(x, y, index, parentSeedIndex);
                    
                    // Record the origin of this plant for trunk positioning
                    this.biology.plantSystem.plantOrigins[plantGroupId] = {x: x, y: y};
                    
                    // Mark fire adaptation in the plant if the seed was fire-adapted
                    if (isFireAdapted) {
                        // Keep the fire adaptation metadata (200+) in the plant
                        // We're keeping the value consistent for ease of tracking
                        this.core.metadata[index] = 200;
                    }

                    nextActivePixels.add(index);
                    return;
                }
            }
        }
        // Case 2: Seed is inside soil
        else if (this.core.type[index] === this.TYPE.SEED && this.getSurroundingType(x, y) === this.TYPE.SOIL) {
            // Seeds in soil have higher germination chance when there's water
            const surroundingWater = this.getSurroundingWater(x, y);
            
            // Get soil depth
            const soilDepth = this.getSoilDepth(x, y);
            
            // Higher germination chance when buried in soil with water
            if (surroundingWater > 20) { // Reduced from 30 to 20
                // Base germination chance
                let germinationChance = 0.4 * this.biology.growthRate; // Reduced from 0.55 to 0.4 for better balance
                
                // Seeds too deep struggle to germinate - but still possible
                if (soilDepth > 5) {
                    // Fire-adapted seeds are better at germinating even when buried deep
                    if (isFireAdapted) {
                        germinationChance *= 0.9; // Less penalty for fire-adapted seeds
                    } else {
                        germinationChance *= 0.7; // Regular seeds penalty
                    }
                }
                
                // Fire-adapted seeds in recently burned areas get a boost
                if (isFireAdapted && recentlyBurned) {
                    germinationChance *= 1.8; // Reduced from 2.0 to 1.8
                }
                
                if (Math.random() < germinationChance) {
                    // Convert seed to plant root
                    this.core.type[index] = this.TYPE.PLANT;
                    this.core.state[index] = this.STATE.ROOT;

                    // Initial root has water based on surrounding soil
                    this.core.water[index] = Math.min(120, surroundingWater * 1.8); // Reduced from 150 to 120 and from 2 to 1.8

                    // Base energy for roots from buried seeds
                    let initialEnergy = 180; // Reduced from 200 to 180
                    
                    // Fire-adapted plants in burned areas start with more energy
                    if (isFireAdapted && recentlyBurned) {
                        initialEnergy = 280; // Reduced from 300 to 280
                    }
                    
                    // Roots from buried seeds start with extra energy
                    this.core.energy[index] = Math.max(this.core.energy[index], initialEnergy);
                    
                    // Create new plant using the plant system's helper method
                    // This handles plant group IDs, species assignment, and genetic traits
                    const parentSeedIndex = this.core.metadata[index] > 0 && this.core.metadata[index] < 200 ? 
                        this.getSeedParentIndex(index) : null;
                    
                    const plantGroupId = this.biology.plantSystem.createNewPlant(x, y, index, parentSeedIndex);
                    
                    // Record the origin of this plant for trunk positioning
                    this.biology.plantSystem.plantOrigins[plantGroupId] = {x: x, y: y};
                    
                    // Mark fire adaptation in the plant if the seed was fire-adapted
                    if (isFireAdapted) {
                        // Keep the fire adaptation metadata (200+) in the plant
                        this.core.metadata[index] = 200;
                    }

                    nextActivePixels.add(index);
                    return;
                }
            }
            
            // Seeds that are too deep may decompose faster
            if (soilDepth > 8) {
                // Fire-adapted seeds are more resilient to being buried deep
                if (isFireAdapted) {
                    this.core.energy[index] -= 0.1 * this.biology.metabolism; // Less energy loss
                } else {
                    this.core.energy[index] -= 0.2 * this.biology.metabolism; // Regular energy loss
                }
            }
        }
        
        // Special case: Check for fire adaptation development in recently burned areas
        if (recentlyBurned && !isFireAdapted && window.ecosim && window.ecosim.environment && window.ecosim.environment.fireSystem) {
            // Chance for seed to develop fire adaptation in recently burned areas
            if (window.ecosim.environment.fireSystem.processFireAdaptations(index, index, nextActivePixels)) {
                // The processFireAdaptations function will modify metadata if adaptation happens
                console.log("Seed developed fire adaptation in recently burned area");
            }
        }

        // Seeds lose energy slowly
        this.core.energy[index] -= 0.1 * this.biology.metabolism;

        // If energy is depleted, seed dies
        if (this.core.energy[index] <= 0) {
            this.core.type[index] = this.TYPE.DEAD_MATTER;
            nextActivePixels.add(index);
            return;
        }

        // Seeds remain active while viable
        nextActivePixels.add(index);
    },
    
    // Helper function to check surrounding pixel types
    getSurroundingType: function(x, y) {
        // Check if surrounded by at least 3 soil pixels
        let soilCount = 0;
        
        // Check the 8 surrounding pixels
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue; // Skip the center pixel
                
                const idx = this.core.getIndex(x + dx, y + dy);
                if (idx !== -1 && this.core.type[idx] === this.TYPE.SOIL) {
                    soilCount++;
                }
            }
        }
        
        // Return the dominant surrounding type
        return soilCount >= 3 ? this.TYPE.SOIL : this.TYPE.AIR;
    },
    
    // Helper function to get average surrounding water level
    getSurroundingWater: function(x, y) {
        // Calculate average water level in surrounding soil pixels
        let totalWater = 0;
        let soilCount = 0;
        
        // Check the 8 surrounding pixels
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue; // Skip the center pixel
                
                const idx = this.core.getIndex(x + dx, y + dy);
                if (idx !== -1 && this.core.type[idx] === this.TYPE.SOIL) {
                    totalWater += this.core.water[idx];
                    soilCount++;
                }
            }
        }
        
        return soilCount > 0 ? totalWater / soilCount : 0;
    },
    
    // Helper function to measure how deep a seed is in soil
    getSoilDepth: function(x, y) {
        let depth = 0;
        let airFound = false;
        let checkY = y - 1; // Start checking one pixel above
        
        // Look upward until we hit air
        while (checkY >= 0) {
            const checkIndex = this.core.getIndex(x, checkY);
            if (checkIndex === -1) break;
            
            // If we find air, mark that air was found and start counting depth
            if (this.core.type[checkIndex] === this.TYPE.AIR) {
                airFound = true;
                break;
            }
            
            depth++;
            checkY--;
        }
        
        // If we never found air, this might be under a big soil mass,
        // so we set a high depth value
        if (!airFound && depth > 0) {
            depth = Math.max(depth, 10);
        }
        
        return depth;
    },

    // New method to track seed parentage
    getSeedParentIndex: function(index) {
        // Extract parent information from metadata if available
        // Currently seeds don't store parent index information,
        // so we return null for now, but this could be extended
        return null;
    },

    // Modified method for seed creation from flowers
    createSeedFromFlower: function(flowerIndex, x, y) {
        // Create a seed at the given position
        const index = this.core.getIndex(x, y);
        if (index === -1 || this.core.type[index] !== this.TYPE.AIR) return false;
        
        // Create the seed
        this.core.type[index] = this.TYPE.SEED;
        this.core.water[index] = 20;
        this.core.energy[index] = 100;
        
        // Get plant group information
        const plantGroupId = this.biology.plantSystem.getPlantGroupId(flowerIndex);
        const speciesIndex = this.biology.plantSystem.plantSpeciesMap[plantGroupId];
        
        // Store flower metadata in seed (for inheritance)
        // Format: Lowest 4 bits = 0, Higher 4 bits = flower/species type
        this.core.metadata[index] = ((speciesIndex & 0xF) << 4) | 0;
        
        // Record parent index in seed for evolution tracking
        // The evolution system will use this to inherit traits
        this.biology.handleReproduction(flowerIndex, index);
        
        return true;
    }
};

// Make the module available for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SeedSystem;
}

// Make the module available for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SeedSystem;
}