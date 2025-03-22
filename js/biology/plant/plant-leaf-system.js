// Plant Leaf System
// Handles plant leaf photosynthesis and energy distribution

window.PlantLeafSystem = {
    // Reference to parent plant system
    plant: null,
    
    // Initialize leaf system
    init: function(plantSystem) {
        this.plant = plantSystem;
        return this;
    },
    
    // Update leaf behavior
    updateLeaf: function(x, y, index, nextActivePixels) {
        // Ensure nextActivePixels exists even if not provided (for testing)
        nextActivePixels = nextActivePixels || new Set();
        
        // Check for adequate water for photosynthesis
        const hasAdequateWater = this.plant.core.water[index] > 15;
        
        // Leaves perform photosynthesis (convert light to energy)
        // Energy depends on the amount of light received and water availability
        if (this.plant.core.energy[index] < 200) { // Dramatically increased energy cap
            // Base photosynthesis rate
            let photosynthesisRate = 0.08; // Increased base rate for faster energy production
            
            // If water is adequate, photosynthesis works at full efficiency
            // If water is limited, photosynthesis is reduced
            if (!hasAdequateWater) {
                photosynthesisRate *= (this.plant.core.water[index] / 25); // Scales with available water
            }
            
            // Get energy from light (already calculated in environment system)
            this.plant.core.energy[index] += this.plant.core.energy[index] * photosynthesisRate;

            // More boost for small plants to help get established
            if (this.plant.plantMetrics.stemHeight < 15) {
                this.plant.core.energy[index] += 5; // Significantly increased boost for more aggressive growth
            }

            // Cap at maximum
            if (this.plant.core.energy[index] > 300) {
                this.plant.core.energy[index] = 300;
            }
            
            // Leaves consume water during photosynthesis
            if (hasAdequateWater) {
                // Water consumption scales with energy production
                this.plant.core.water[index] -= 0.5;
            }
        }
        
        // Occasional small water boost to prevent leaves from drying out completely
        if (this.plant.core.water[index] < 10 && Math.random() < 0.05) {
            // Small chance to get water from humidity/dew
            this.plant.core.water[index] += 3;
        }

        // Leaves distribute energy to the rest of the plant
        this.distributeEnergyDownward(x, y, index, nextActivePixels);

        // Leaves remain active
        nextActivePixels.add(index);
    },

    // Distribute energy downward through the plant
    distributeEnergyDownward: function(x, y, index, nextActivePixels) {
        // Much more frequent energy sharing for rapid vine-like growth
        const sharingChance = Math.min(0.75, 0.4 + (this.plant.plantMetrics.totalSize / 100));
        
        // More aggressive energy distribution throughout the plant
        if (Math.random() < sharingChance && this.plant.core.energy[index] > 30) {
            // Find connected plant parts
            const neighbors = this.plant.core.getNeighborIndices(x, y);
            
            // Prioritize stems to keep plant structure healthy
            const stemNeighbors = [];
            const otherNeighbors = [];
            
            for (const neighbor of neighbors) {
                if (this.plant.core.type[neighbor.index] === this.plant.TYPE.PLANT) {
                    if (this.plant.core.state[neighbor.index] === this.plant.STATE.STEM) {
                        stemNeighbors.push(neighbor);
                    } else {
                        otherNeighbors.push(neighbor);
                    }
                }
            }
            
            // First try to share with stems
            let sharedWithStem = false;
            for (const stem of stemNeighbors) {
                // Stems need more energy to stay healthy
                if (this.plant.core.energy[stem.index] < this.plant.core.energy[index] - 15) {
                    // Transfer more energy to stems
                    const transferAmount = Math.min(15, Math.floor((this.plant.core.energy[index] - this.plant.core.energy[stem.index]) / 3));
                    this.plant.core.energy[stem.index] += transferAmount;
                    this.plant.core.energy[index] -= transferAmount;
                    
                    // Occasionally share water with stem too for larger plants
                    if (this.plant.core.water[index] > 30 && this.plant.core.water[stem.index] < 20 && this.plant.plantMetrics.totalSize > 30) {
                        const waterTransfer = Math.min(10, this.plant.core.water[index] - 20);
                        this.plant.core.water[stem.index] += waterTransfer;
                        this.plant.core.water[index] -= waterTransfer;
                    }
                    
                    nextActivePixels.add(stem.index);
                    sharedWithStem = true;
                    break; // Only share with one stem per turn
                }
            }
            
            // If we didn't share with a stem, try other plant parts
            if (!sharedWithStem && otherNeighbors.length > 0 && this.plant.core.energy[index] > 60) {
                const neighbor = otherNeighbors[Math.floor(Math.random() * otherNeighbors.length)];
                
                // Only share if neighbor has less energy
                if (this.plant.core.energy[neighbor.index] < this.plant.core.energy[index] - 20) {
                    // Transfer energy
                    const transferAmount = Math.min(10, Math.floor((this.plant.core.energy[index] - this.plant.core.energy[neighbor.index]) / 4));
                    this.plant.core.energy[neighbor.index] += transferAmount;
                    this.plant.core.energy[index] -= transferAmount;
                    
                    nextActivePixels.add(neighbor.index);
                }
            }
        }
    }
};