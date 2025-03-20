// Plant Flower System
// Handles plant flower reproduction and seed creation

const PlantFlowerSystem = {
    // Reference to parent plant system
    plant: null,
    
    // Initialize flower system
    init: function(plantSystem) {
        this.plant = plantSystem;
        return this;
    },
    
    // Update flower behavior
    updateFlower: function(x, y, index, nextActivePixels) {
        // First check if this is a flower center or petal
        const isFlowerCenter = this.isFlowerCenter(x, y, index);
        
        // Only central flowers can produce seeds
        if (isFlowerCenter) {
            // Flowers consume energy but can produce seeds
            if (this.plant.core.energy[index] > 80 && Math.random() < 0.35 * this.plant.biology.reproduction) {
                this.createSeed(x, y, index, nextActivePixels);
                
                // Create multiple seeds occasionally from flower centers
                if (Math.random() < 0.4) {
                    this.createSeed(x, y, index, nextActivePixels);
                }
            }
        } else {
            // Flower petals don't produce seeds but have random chance to die off
            // This creates more dynamic and realistic looking flowers
            if (Math.random() < 0.01) {
                this.plant.core.energy[index] -= 1;
            }
        }

        // Give flowers distinctive appearance with more energy/water
    // This makes them visually stand out more in the visualization
    if (Math.random() < 0.05) {
        this.plant.core.energy[index] = Math.min(255, this.plant.core.energy[index] + 5);
        this.plant.core.water[index] = Math.min(255, this.plant.core.water[index] + 3);
    }
    
    // Flowers remain active
    nextActivePixels.add(index);
    },

    // Check if this flower is a center (connected to stem) or petal
    isFlowerCenter: function(x, y, index) {
        // Get neighbor pixels
        const neighbors = this.plant.core.getNeighborIndices(x, y);
        
        // Count stem neighbors - flower centers are connected to stem
        let stemCount = 0;
        let flowerCount = 0;
        
        for (const neighbor of neighbors) {
            if (this.plant.core.type[neighbor.index] === this.plant.TYPE.PLANT) {
                if (this.plant.core.state[neighbor.index] === this.plant.STATE.STEM) {
                    stemCount++;
                } else if (this.plant.core.state[neighbor.index] === this.plant.STATE.FLOWER) {
                    flowerCount++;
                }
            }
        }
        
        // Flower centers have at least one stem connection
        // Petals only have flower connections (no stems)
        return stemCount > 0;
    },
    
    // Create a seed from a flower
    createSeed: function(x, y, index, nextActivePixels) {
        // Seeds can be created in any adjacent air pixel
        const neighbors = this.plant.core.getNeighborIndices(x, y);
        const airNeighbors = neighbors.filter(n => this.plant.core.type[n.index] === this.plant.TYPE.AIR);

        if (airNeighbors.length > 0) {
            // Choose a random air neighbor
            const neighbor = airNeighbors[Math.floor(Math.random() * airNeighbors.length)];

            // Create seed
            this.plant.core.type[neighbor.index] = this.plant.TYPE.SEED;

            // Transfer more energy to the seed and reduce the energy cost from the flower
            this.plant.core.energy[neighbor.index] = 150; // Increased from 100
            this.plant.core.energy[index] -= 80; // Reduced from 100

            nextActivePixels.add(neighbor.index);
            
            // If there's still space, maybe create another seed nearby
            if (airNeighbors.length > 1 && Math.random() < 0.3) {
                // Choose a different air neighbor
                const remainingNeighbors = airNeighbors.filter(n => n.index !== neighbor.index);
                if (remainingNeighbors.length > 0) {
                    const secondNeighbor = remainingNeighbors[Math.floor(Math.random() * remainingNeighbors.length)];
                    
                    // Create second seed
                    this.plant.core.type[secondNeighbor.index] = this.plant.TYPE.SEED;
                    this.plant.core.energy[secondNeighbor.index] = 120;
                    this.plant.core.energy[index] -= 60;
                    
                    nextActivePixels.add(secondNeighbor.index);
                }
            }
        }
    }
};