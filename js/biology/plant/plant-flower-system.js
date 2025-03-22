// Plant Flower System
// Handles plant flower reproduction and seed creation

window.PlantFlowerSystem = {
    // Reference to parent plant system
    plant: null,
    
    // Flower type variations
    flowerTypes: [
        {
            name: "daisy",
            petalCount: 8,
            petalPattern: "round",
            petalSpread: 1.0,
            centerSize: 1,
            seedProbability: 0.35
        },
        {
            name: "rose",
            petalCount: 12,
            petalPattern: "spiral",
            petalSpread: 0.9,
            centerSize: 2,
            seedProbability: 0.3
        },
        {
            name: "tulip",
            petalCount: 6,
            petalPattern: "cup",
            petalSpread: 0.7,
            centerSize: 1,
            seedProbability: 0.4
        },
        {
            name: "sunflower",
            petalCount: 14,
            petalPattern: "ray",
            petalSpread: 1.2,
            centerSize: 3,
            seedProbability: 0.5
        },
        {
            name: "orchid",
            petalCount: 5,
            petalPattern: "exotic",
            petalSpread: 0.8,
            centerSize: 1,
            seedProbability: 0.25
        },
        {
            name: "lily",
            petalCount: 6,
            petalPattern: "trumpet",
            petalSpread: 1.1,
            centerSize: 2,
            seedProbability: 0.35
        }
    ],
    
    // Flower color variations - metadata to store flower type per pixel
    flowerVariations: {},

    // Initialize flower system
    init: function(plantSystem) {
        this.plant = plantSystem;
        this.flowerVariations = {};
        return this;
    },
    
    // Update flower behavior
    updateFlower: function(x, y, index, nextActivePixels) {
        // Ensure nextActivePixels exists even if not provided (for testing)
        nextActivePixels = nextActivePixels || new Set();
        
        // First check if this is a flower center or petal
        const isFlowerCenter = this.isFlowerCenter(x, y, index);
        
        // Store a flower type for consistent visualization
        if (!this.flowerVariations[index]) {
            // For flower centers, create a new flower type
            if (isFlowerCenter) {
                // Get a random flower type or assign based on position for consistent results
                const flowerTypeIndex = (x * 7 + y * 13) % this.flowerTypes.length;
                this.flowerVariations[index] = {
                    typeIndex: flowerTypeIndex,
                    colorVar: Math.floor(Math.random() * 5), // 0-4 color variations
                    size: 0.8 + Math.random() * 0.4  // Size multiplier 0.8-1.2
                };
            } 
            // For petals, try to inherit from nearby center
            else {
                // Find nearby centers
                const neighbors = this.plant.core.getNeighborIndices(x, y);
                let inheritedVariation = null;
                
                for (const neighbor of neighbors) {
                    if (this.plant.core.type[neighbor.index] === this.plant.TYPE.PLANT &&
                        this.plant.core.state[neighbor.index] === this.plant.STATE.FLOWER &&
                        this.flowerVariations[neighbor.index]) {
                        inheritedVariation = this.flowerVariations[neighbor.index];
                        break;
                    }
                }
                
                // If no inherited variation, create a new random one
                if (!inheritedVariation) {
                    const flowerTypeIndex = (x * 7 + y * 13) % this.flowerTypes.length;
                    this.flowerVariations[index] = {
                        typeIndex: flowerTypeIndex,
                        colorVar: Math.floor(Math.random() * 5),
                        size: 0.8 + Math.random() * 0.4
                    };
                } else {
                    // Use the inherited variation but with slight color variance
                    this.flowerVariations[index] = {
                        typeIndex: inheritedVariation.typeIndex,
                        colorVar: inheritedVariation.colorVar,
                        size: inheritedVariation.size * (0.95 + Math.random() * 0.1) // Slight size variation
                    };
                }
            }
        }
        
        // Only central flowers can produce seeds
        if (isFlowerCenter) {
            // Get the flower type for seed probability
            const flowerType = this.flowerTypes[this.flowerVariations[index]?.typeIndex || 0];
            const seedProbability = flowerType?.seedProbability || 0.35;
            
            // Flowers consume energy but can produce seeds based on type
            if (this.plant.core.energy[index] > 80 && Math.random() < seedProbability * this.plant.biology.reproduction) {
                this.createSeed(x, y, index, nextActivePixels);
                
                // Create multiple seeds occasionally from flower centers
                // Sunflowers have higher chance for multiple seeds
                const multiSeedChance = (flowerType.name === "sunflower") ? 0.6 : 0.4;
                if (Math.random() < multiSeedChance) {
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
        
        // Store metadata for color mapping
        // Use the format: high byte for flower type, low byte for color variation
        if (this.flowerVariations[index]) {
            const typeIndex = this.flowerVariations[index].typeIndex;
            const colorVar = this.flowerVariations[index].colorVar;
            this.plant.core.metadata[index] = (typeIndex << 4) | colorVar;
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
            
            // Transfer flower type information to seed for inheritance
            if (this.flowerVariations[index]) {
                const typeIndex = this.flowerVariations[index].typeIndex;
                const colorVar = this.flowerVariations[index].colorVar;
                this.plant.core.metadata[neighbor.index] = (typeIndex << 4) | colorVar;
            }

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
                    
                    // Transfer flower type to this seed too
                    if (this.flowerVariations[index]) {
                        const typeIndex = this.flowerVariations[index].typeIndex;
                        const colorVar = this.flowerVariations[index].colorVar;
                        this.plant.core.metadata[secondNeighbor.index] = (typeIndex << 4) | colorVar;
                    }
                    
                    nextActivePixels.add(secondNeighbor.index);
                }
            }
        }
    }
};