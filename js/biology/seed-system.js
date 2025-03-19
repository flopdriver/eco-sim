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

        // Seeds try to germinate if they're on soil with enough water
        const downIndex = this.core.getIndex(x, y + 1);

        if (downIndex !== -1 && this.core.type[downIndex] === this.TYPE.SOIL) {
            // Check if soil has enough water
            if (this.core.water[downIndex] > 50) {
                // Chance to germinate
                if (Math.random() < 0.05 * this.biology.growthRate) {
                    // Convert seed to plant root
                    this.core.type[index] = this.TYPE.PLANT;
                    this.core.state[index] = this.STATE.ROOT;

                    // Initial root has some water and energy
                    this.core.water[index] = 50;

                    nextActivePixels.add(index);
                    return;
                }
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
    }
};