// Decomposition System
// Handles decay of dead matter and nutrient cycling

const DecompositionSystem = {
    // Reference to parent biology system
    biology: null,

    // Shorthand references to commonly used objects
    core: null,
    TYPE: null,
    STATE: null,

    // Initialize decomposition system
    init: function(biologySystem) {
        this.biology = biologySystem;
        this.core = biologySystem.core;
        this.TYPE = biologySystem.TYPE;
        this.STATE = biologySystem.STATE;

        console.log("Initializing decomposition system...");

        return this;
    },

    // Update all dead matter pixels
    update: function(activePixels, nextActivePixels) {
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.DEAD_MATTER && !this.biology.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);
                this.updateSingleDeadMatter(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Update a single dead matter pixel
    updateSingleDeadMatter: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.biology.processedThisFrame[index] = 1;

        // Dead matter gradually decomposes into nutrients

        // First, check if there's soil or water below (for gravity)
        const downIndex = this.core.getIndex(x, y + 1);

        if (downIndex !== -1) {
            if (this.core.type[downIndex] === this.TYPE.SOIL) {
                // Decompose into the soil below
                if (Math.random() < 0.05) {
                    // Add nutrients to soil
                    this.core.nutrient[downIndex] += 20;

                    // Make soil fertile
                    this.core.state[downIndex] = this.STATE.FERTILE;

                    // Remove dead matter
                    this.core.type[index] = this.TYPE.AIR;

                    nextActivePixels.add(downIndex);
                    return;
                }
            } else if (this.core.type[downIndex] === this.TYPE.WATER) {
                // Decompose into the water below (slower)
                if (Math.random() < 0.02) {
                    // Add nutrients to water
                    this.core.nutrient[downIndex] += 10;

                    // Remove dead matter
                    this.core.type[index] = this.TYPE.AIR;

                    nextActivePixels.add(downIndex);
                    return;
                }
            }
        }

        // Decomposition is faster when wet
        // Check if there's water nearby
        const neighbors = this.core.getNeighborIndices(x, y);
        const hasWaterNearby = neighbors.some(n => this.core.type[n.index] === this.TYPE.WATER);

        // Chance to decompose in place
        let decomposeChance = 0.01; // Base chance
        if (hasWaterNearby) {
            decomposeChance = 0.03; // Higher with water
        }

        if (Math.random() < decomposeChance) {
            // Convert to fertile soil
            this.core.type[index] = this.TYPE.SOIL;
            this.core.state[index] = this.STATE.FERTILE;
            this.core.nutrient[index] = 30;

            nextActivePixels.add(index);
            return;
        }

        // Dead matter remains active
        nextActivePixels.add(index);
    }
};