// Worm System
// Handles worm movement, soil aeration, and decomposition activities

const WormSystem = {
    // Reference to parent biology system
    biology: null,

    // Shorthand references to commonly used objects
    core: null,
    TYPE: null,
    STATE: null,

    // Initialize worm system
    init: function(biologySystem) {
        this.biology = biologySystem;
        this.core = biologySystem.core;
        this.TYPE = biologySystem.TYPE;
        this.STATE = biologySystem.STATE;

        console.log("Initializing worm system...");

        return this;
    },

    // Update all worms
    update: function(activePixels, nextActivePixels) {
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.WORM && !this.biology.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);
                this.updateSingleWorm(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Update a single worm
    updateSingleWorm: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.biology.processedThisFrame[index] = 1;

        // Worms move through soil, eat dead matter, and aerate soil

        // First, check if worm has enough energy
        if (this.core.energy[index] <= 0) {
            // Worm dies and becomes fertile soil
            this.core.type[index] = this.TYPE.SOIL;
            this.core.state[index] = this.STATE.FERTILE;
            this.core.nutrient[index] = 30;
            nextActivePixels.add(index);
            return;
        }

        // Worms consume energy each tick
        this.core.energy[index] -= 0.3 * this.biology.metabolism;

        // Try to find and eat dead matter
        if (this.core.energy[index] < 100) {
            if (this.tryEatDeadMatter(x, y, index, nextActivePixels)) {
                return; // If successfully ate, don't do other actions
            }
        }

        // Move through soil
        this.moveWorm(x, y, index, nextActivePixels);

        // Worms remain active
        nextActivePixels.add(index);
    },

    // Try to eat dead matter
    tryEatDeadMatter: function(x, y, index, nextActivePixels) {
        // Check all neighbors for dead matter
        const neighbors = this.core.getNeighborIndices(x, y);
        const deadMatterNeighbors = neighbors.filter(n => this.core.type[n.index] === this.TYPE.DEAD_MATTER);

        if (deadMatterNeighbors.length > 0) {
            // Choose a random dead matter neighbor
            const neighbor = deadMatterNeighbors[Math.floor(Math.random() * deadMatterNeighbors.length)];

            // Consume the dead matter
            const energyGain = 50;
            this.core.energy[index] += energyGain;

            // Cap energy
            if (this.core.energy[index] > 200) {
                this.core.energy[index] = 200;
            }

            // Convert dead matter to fertile soil
            this.core.type[neighbor.index] = this.TYPE.SOIL;
            this.core.state[neighbor.index] = this.STATE.FERTILE;
            this.core.nutrient[neighbor.index] = 300;

            nextActivePixels.add(neighbor.index);
            return true;
        }

        return false;
    },

    // Move worm through soil or other materials
    moveWorm: function(x, y, index, nextActivePixels) {
        const possibleDirections = [];

        // Worms can move in any direction but prefer soil
        const neighbors = this.core.getNeighborIndices(x, y);

        // Evaluate each neighbor
        for (const neighbor of neighbors) {
            let weight = 0;

            switch (this.core.type[neighbor.index]) {
                case this.TYPE.SOIL:
                    // Prefer soil - higher weight
                    weight = 10;
                    // Prefer fertile soil even more
                    if (this.core.state[neighbor.index] === this.STATE.FERTILE) {
                        weight = 5;
                    }
                    // But wet soil is best for worms
                    else if (this.core.state[neighbor.index] === this.STATE.WET) {
                        weight = 15;
                    }
                    break;

                case this.TYPE.DEAD_MATTER:
                    // Very high weight for dead matter (food)
                    weight = 20;
                    break;

                case this.TYPE.AIR:
                    // Can move through air but don't prefer it
                    weight = 2;
                    break;

                default:
                    // Can't move through other materials
                    weight = 0;
            }

            // If valid direction, add to possibilities
            if (weight > 0) {
                possibleDirections.push({
                    x: neighbor.x,
                    y: neighbor.y,
                    index: neighbor.index,
                    weight: weight
                });
            }
        }

        // If we have possible directions, choose weighted random
        if (possibleDirections.length > 0) {
            // Calculate total weight
            let totalWeight = 0;
            for (const dir of possibleDirections) {
                totalWeight += dir.weight;
            }

            // Choose random direction based on weights
            let randomWeight = Math.random() * totalWeight;
            let selectedDir = null;

            for (const dir of possibleDirections) {
                randomWeight -= dir.weight;
                if (randomWeight <= 0) {
                    selectedDir = dir;
                    break;
                }
            }

            if (selectedDir) {
                // Remember what was in the target position
                const originalType = this.core.type[selectedDir.index];
                const originalState = this.core.state[selectedDir.index];
                const originalNutrient = this.core.nutrient[selectedDir.index];

                // Move worm
                this.core.type[selectedDir.index] = this.TYPE.WORM;
                this.core.energy[selectedDir.index] = this.core.energy[index];

                // Leave aerated soil behind
                this.core.type[index] = this.TYPE.SOIL;
                this.core.state[index] = this.STATE.FERTILE;

                // If original was soil, preserve some properties
                if (originalType === this.TYPE.SOIL) {
                    // Keep nutrients but add some aeration benefit
                    this.core.nutrient[index] = originalNutrient + 5;
                } else {
                    // New soil starts with basic nutrients
                    this.core.nutrient[index] = 20;
                }

                // Mark new position as processed
                this.biology.processedThisFrame[selectedDir.index] = 1;
                nextActivePixels.add(selectedDir.index);
                nextActivePixels.add(index);

                return true;
            }
        }

        return false;
    }
};