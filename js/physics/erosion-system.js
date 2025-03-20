// Erosion System
// Handles erosion effects (water eroding soil)

const ErosionSystem = {
    // Reference to parent physics system
    physics: null,
    
    // Erosion strength multiplier
    erosionStrength: 1.0,

    // Initialize erosion system
    init: function(physicsSystem) {
        this.physics = physicsSystem;
        console.log("Initializing erosion system...");
        return this;
    },

    // Update erosion effects (water eroding soil)
    updateErosion: function(activePixels, nextActivePixels) {
        // Water has a chance to erode soil when flowing past it
        // Only process a subset of active water pixels each frame for performance
        activePixels.forEach(index => {
            if (this.physics.core.type[index] === this.physics.TYPE.WATER && Math.random() < 0.05) {
                const coords = this.physics.core.getCoords(index);
                this.processSingleErosion(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Process erosion for a single water pixel
    processSingleErosion: function(x, y, index, nextActivePixels) {
        // Water can erode adjacent soil
        // Get all neighbors
        const neighbors = this.physics.core.getNeighborIndices(x, y);

        // Check each neighbor for soil
        for (const neighbor of neighbors) {
            if (this.physics.core.type[neighbor.index] === this.physics.TYPE.SOIL) {
                // Erosion is more likely for soil with low nutrients
                // and is affected by water content and erosion strength setting
                const erosionChance = 0.001 * (100 + (this.physics.core.water[index] / 255)) * this.erosionStrength;

                if (Math.random() < erosionChance) {
                    // Erode the soil - convert to water
                    this.physics.core.type[neighbor.index] = this.physics.TYPE.WATER;
                    this.physics.core.water[neighbor.index] = this.physics.core.water[index];
                    this.physics.core.state[neighbor.index] = this.physics.STATE.DEFAULT;

                    // Add nutrients to the water from the eroded soil
                    this.physics.core.nutrient[neighbor.index] += this.physics.core.nutrient[neighbor.index];

                    nextActivePixels.add(neighbor.index);
                    break; // Only erode one soil pixel per water pixel per frame
                }
            }
        }
    }
};