// Gravity System
// Handles gravity effects on objects like seeds, dead matter and insects

const GravitySystem = {
    // Reference to parent physics system
    physics: null,

    // Initialize gravity system
    init: function(physicsSystem) {
        this.physics = physicsSystem;
        console.log("Initializing gravity system...");
        return this;
    },

    // Update gravity effects on objects
    updateGravity: function(activePixels, nextActivePixels) {
        // Process items that should fall: seeds, dead matter, some insects
        activePixels.forEach(index => {
            // Skip if already processed
            if (this.physics.processedThisFrame[index]) return;

            const type = this.physics.core.type[index];

            // Check if it's a type affected by gravity
            const affectedByGravity = (
                type === this.physics.TYPE.SEED ||
                type === this.physics.TYPE.DEAD_MATTER ||
                (type === this.physics.TYPE.INSECT && Math.random() < 0.1) // Insects sometimes fall
            );

            if (affectedByGravity) {
                const coords = this.physics.core.getCoords(index);
                this.applyGravity(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Apply gravity to a single pixel
    applyGravity: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.physics.processedThisFrame[index] = 1;

        // Check below
        const downIndex = this.physics.core.getIndex(x, y + 1);

        if (downIndex !== -1) {
            // Can only fall into air or water
            if (this.physics.core.type[downIndex] === this.physics.TYPE.AIR ||
                (this.physics.core.type[downIndex] === this.physics.TYPE.WATER &&
                    this.physics.core.type[index] !== this.physics.TYPE.INSECT)) {

                // Swap positions
                const tempType = this.physics.core.type[downIndex];
                const tempWater = this.physics.core.water[downIndex];

                // Move falling object down
                this.physics.core.type[downIndex] = this.physics.core.type[index];
                this.physics.core.state[downIndex] = this.physics.core.state[index];
                this.physics.core.water[downIndex] = this.physics.core.water[index];
                this.physics.core.nutrient[downIndex] = this.physics.core.nutrient[index];
                this.physics.core.energy[downIndex] = this.physics.core.energy[index];
                this.physics.core.metadata[downIndex] = this.physics.core.metadata[index];

                // Replace original position with what was below
                this.physics.core.type[index] = tempType;
                this.physics.core.state[index] = this.physics.STATE.DEFAULT;
                this.physics.core.water[index] = tempWater;
                this.physics.core.nutrient[index] = 0;
                this.physics.core.energy[index] = 0;
                this.physics.core.metadata[index] = 0;

                // Mark both positions as active
                nextActivePixels.add(downIndex);
                if (tempType !== this.physics.TYPE.AIR) {
                    nextActivePixels.add(index);
                }

                return true;
            }
        }

        // If couldn't fall straight down, try falling diagonally
        if (Math.random() < 0.3) { // Don't try every frame
            // Randomly choose left or right diagonal
            const diagonalX = x + (Math.random() < 0.5 ? -1 : 1);
            const diagonalIndex = this.physics.core.getIndex(diagonalX, y + 1);

            if (diagonalIndex !== -1 && this.physics.core.type[diagonalIndex] === this.physics.TYPE.AIR) {
                // Same swap logic as above
                // Move falling object diagonally down
                this.physics.core.type[diagonalIndex] = this.physics.core.type[index];
                this.physics.core.state[diagonalIndex] = this.physics.core.state[index];
                this.physics.core.water[diagonalIndex] = this.physics.core.water[index];
                this.physics.core.nutrient[diagonalIndex] = this.physics.core.nutrient[index];
                this.physics.core.energy[diagonalIndex] = this.physics.core.energy[index];
                this.physics.core.metadata[diagonalIndex] = this.physics.core.metadata[index];

                // Replace original position with air
                this.physics.core.type[index] = this.physics.TYPE.AIR;
                this.physics.core.state[index] = this.physics.STATE.DEFAULT;
                this.physics.core.water[index] = 0;
                this.physics.core.nutrient[index] = 0;
                this.physics.core.energy[index] = 0;
                this.physics.core.metadata[index] = 0;

                // Mark new position as active
                nextActivePixels.add(diagonalIndex);

                return true;
            }
        }

        // If the object couldn't fall, keep it active so it tries again next frame
        // (but only if it's a type that should keep trying)
        if (this.physics.core.type[index] === this.physics.TYPE.SEED ||
            this.physics.core.type[index] === this.physics.TYPE.DEAD_MATTER) {
            nextActivePixels.add(index);
        }

        return false;
    }
};