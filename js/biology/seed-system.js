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

        // Case 1: Seed is on top of soil
        if (downIndex !== -1 && downLocation === this.TYPE.SOIL) {
            // More generous water requirement for germination
            if (this.core.water[downIndex] > 25) { // Reduced from 50 to 25
                // Dramatically increased chance to germinate for Jumanji-like growth
                if (Math.random() < 0.45 * this.biology.growthRate) { // Massively increased from 0.25 to 0.45
                    // Convert seed to plant root
                    this.core.type[index] = this.TYPE.PLANT;
                    this.core.state[index] = this.STATE.ROOT;

                    // Initial root has more water and energy
                    this.core.water[index] = 80; // Increased from 50
                    this.core.energy[index] = Math.max(this.core.energy[index], 150); // Adding initial energy

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
                // Dramatically increased chance to germinate for aggressive Jumanji-style growth
                let germinationChance = 0.55 * this.biology.growthRate; // Massively increased from 0.35 to 0.55
                
                // Seeds too deep struggle to germinate - but still possible
                if (soilDepth > 5) {
                    germinationChance *= 0.7; // Increased from 0.5 to 0.7
                }
                
                if (Math.random() < germinationChance) {
                    // Convert seed to plant root
                    this.core.type[index] = this.TYPE.PLANT;
                    this.core.state[index] = this.STATE.ROOT;

                    // Initial root has water based on surrounding soil
                    this.core.water[index] = Math.min(150, surroundingWater * 2); // Increased water amount

                    // Roots from buried seeds start with extra energy
                    this.core.energy[index] = Math.max(this.core.energy[index], 200); // Increased energy

                    nextActivePixels.add(index);
                    return;
                }
            }
            
            // Seeds that are too deep may decompose faster
            if (soilDepth > 8) {
                this.core.energy[index] -= 0.2 * this.biology.metabolism;
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
    }
};