// Soil Moisture System
// Handles soil moisture movement and dynamics

export const SoilMoistureSystem = {
    // Reference to parent physics system
    physics: null,

    // Initialize soil moisture system
    init: function(physicsSystem) {
        this.physics = physicsSystem;
        console.log("Initializing soil moisture system...");
        return this;
    },

    // Update soil moisture movement
    updateSoilMoisture: function(activePixels, nextActivePixels) {
        // Process only wet soil pixels
        activePixels.forEach(index => {
            if (this.physics.core.type[index] === this.physics.TYPE.SOIL &&
                this.physics.core.water[index] > 20) {

                const coords = this.physics.core.getCoords(index);
                this.updateSingleSoilMoisture(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Update a single soil moisture pixel
    updateSingleSoilMoisture: function(x, y, index, nextActivePixels) {
        // Skip if already processed or not soil anymore
        if (this.physics.processedThisFrame[index] ||
            this.physics.core.type[index] !== this.physics.TYPE.SOIL) return;

        this.physics.processedThisFrame[index] = 1;

        // Water moves down through soil due to gravity (faster than sideways)
        // Soil also exchanges moisture with neighbors to balance levels

        // Check downward flow first (stronger than sideways)
        const downIndex = this.physics.core.getIndex(x, y + 1);

        if (downIndex !== -1 && this.physics.core.type[downIndex] === this.physics.TYPE.SOIL) {
            // Water flows from higher moisture to lower moisture (always some down bias)
            const moistureDiff = this.physics.core.water[index] - this.physics.core.water[downIndex];

            if (moistureDiff > 0) {
                // Transfer amount based on difference (faster transfer with bigger difference)
                // Add a small bias for downward flow
                const transferAmount = Math.max(1, Math.floor(moistureDiff / 4) + 1);

                // Update moisture levels
                this.physics.core.water[downIndex] += transferAmount;
                this.physics.core.water[index] -= transferAmount;

                // Update soil states
                if (this.physics.core.water[downIndex] > 20) {
                    this.physics.core.state[downIndex] = this.physics.STATE.WET;
                }

                if (this.physics.core.water[index] <= 20) {
                    this.physics.core.state[index] = this.physics.STATE.DRY;
                }

                nextActivePixels.add(downIndex);
            }
        }

        // Only do horizontal moisture balancing occasionally (slower than vertical)
        if (Math.random() < 0.2) {
            // Get horizontal neighbors
            const horizontalNeighbors = [];
            const leftIndex = this.physics.core.getIndex(x - 1, y);
            const rightIndex = this.physics.core.getIndex(x + 1, y);

            if (leftIndex !== -1 && this.physics.core.type[leftIndex] === this.physics.TYPE.SOIL) {
                horizontalNeighbors.push(leftIndex);
            }

            if (rightIndex !== -1 && this.physics.core.type[rightIndex] === this.physics.TYPE.SOIL) {
                horizontalNeighbors.push(rightIndex);
            }

            // Pick one neighbor randomly
            if (horizontalNeighbors.length > 0) {
                const neighborIndex = horizontalNeighbors[Math.floor(Math.random() * horizontalNeighbors.length)];

                // Balance moisture (slower than vertical flow)
                const moistureDiff = this.physics.core.water[index] - this.physics.core.water[neighborIndex];

                // Only balance if there's a significant difference
                if (Math.abs(moistureDiff) > 10) {
                    // Direction of transfer depends on moisture difference
                    if (moistureDiff > 0) {
                        // Transfer from this pixel to neighbor
                        const transferAmount = Math.max(1, Math.floor(moistureDiff / 8));

                        this.physics.core.water[neighborIndex] += transferAmount;
                        this.physics.core.water[index] -= transferAmount;

                        // Update soil states
                        if (this.physics.core.water[neighborIndex] > 20) {
                            this.physics.core.state[neighborIndex] = this.physics.STATE.WET;
                        }

                        if (this.physics.core.water[index] <= 20) {
                            this.physics.core.state[index] = this.physics.STATE.DRY;
                        }
                    } else {
                        // Transfer from neighbor to this pixel
                        const transferAmount = Math.max(1, Math.floor(-moistureDiff / 8));

                        this.physics.core.water[index] += transferAmount;
                        this.physics.core.water[neighborIndex] -= transferAmount;

                        // Update soil states
                        if (this.physics.core.water[index] > 20) {
                            this.physics.core.state[index] = this.physics.STATE.WET;
                        }

                        if (this.physics.core.water[neighborIndex] <= 20) {
                            this.physics.core.state[neighborIndex] = this.physics.STATE.DRY;
                        }
                    }

                    nextActivePixels.add(neighborIndex);
                }
            }
        }

        // If soil still has significant moisture, keep it active
        if (this.physics.core.water[index] > 20) {
            nextActivePixels.add(index);
        }
    }
};