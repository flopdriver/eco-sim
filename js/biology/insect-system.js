// Insect System
// Handles insect movement, feeding, and reproduction

const InsectSystem = {
    // Reference to parent biology system
    biology: null,

    // Shorthand references to commonly used objects
    core: null,
    TYPE: null,
    STATE: null,

    // Initialize insect system
    init: function(biologySystem) {
        this.biology = biologySystem;
        this.core = biologySystem.core;
        this.TYPE = biologySystem.TYPE;
        this.STATE = biologySystem.STATE;

        console.log("Initializing insect system...");

        return this;
    },

    // Update all insects
    update: function(activePixels, nextActivePixels) {
        activePixels.forEach(index => {
            if (this.core.type[index] === this.TYPE.INSECT && !this.biology.processedThisFrame[index]) {
                const coords = this.core.getCoords(index);
                this.updateSingleInsect(coords.x, coords.y, index, nextActivePixels);
            }
        });
    },

    // Update a single insect
    updateSingleInsect: function(x, y, index, nextActivePixels) {
        // Mark as processed
        this.biology.processedThisFrame[index] = 1;

        // Insects move, eat plants, and reproduce
        // They also need energy to survive

        // First, check if insect has enough energy
        if (this.core.energy[index] <= 0) {
            // Insect dies
            this.core.type[index] = this.TYPE.DEAD_MATTER;
            nextActivePixels.add(index);
            return;
        }

        // Insects consume energy each tick
        this.core.energy[index] -= 0.5 * this.biology.metabolism;

        // Decide action: move, eat, or reproduce based on needs
        if (this.core.energy[index] < 50) {
            // Low energy, prioritize eating
            if (this.tryEat(x, y, index, nextActivePixels)) {
                return; // If successfully ate, don't do other actions
            }

            // If couldn't eat, try to move toward food
            this.moveInsect(x, y, index, nextActivePixels, true);
        } else {
            // Enough energy, consider reproduction
            if (this.core.energy[index] > 200 && Math.random() < 0.02 * this.biology.reproduction) {
                this.reproduceInsect(x, y, index, nextActivePixels);
            } else {
                // Otherwise just move randomly
                this.moveInsect(x, y, index, nextActivePixels, false);
            }
        }

        // Insects remain active
        nextActivePixels.add(index);
    },

    // Try to eat plant material
    tryEat: function(x, y, index, nextActivePixels) {
        // Check all neighbors for plant material
        const neighbors = this.core.getNeighborIndices(x, y);
        const plantNeighbors = neighbors.filter(n => this.core.type[n.index] === this.TYPE.PLANT);

        if (plantNeighbors.length > 0) {
            // Choose a random plant neighbor
            const neighbor = plantNeighbors[Math.floor(Math.random() * plantNeighbors.length)];

            // Eat the plant - convert to air and gain energy
            const energyGain = 30 + Math.floor(this.core.energy[neighbor.index] / 2);
            this.core.energy[index] += energyGain;

            // Cap energy
            if (this.core.energy[index] > 200) {
                this.core.energy[index] = 200;
            }

            // Remove the plant
            this.core.type[neighbor.index] = this.TYPE.AIR;
            this.core.state[neighbor.index] = this.STATE.DEFAULT;
            this.core.energy[neighbor.index] = 0;
            this.core.water[neighbor.index] = 0;

            return true;
        }

        return false;
    },

    // Move insect to a new position
    moveInsect: function(x, y, index, nextActivePixels, seekingFood) {
        let possibleMoves = [];

        // Get all possible moves (into air)
        const neighbors = this.core.getNeighborIndices(x, y);

        for (const neighbor of neighbors) {
            if (this.core.type[neighbor.index] === this.TYPE.AIR) {
                possibleMoves.push(neighbor);
            }
        }

        // If seeking food, check if any moves are toward plants
        if (seekingFood && possibleMoves.length > 0) {
            // Look for plants within detection range
            const plantDirections = this.findDirectionToPlant(x, y, 5);

            if (plantDirections.length > 0) {
                // Filter moves that are in the direction of plants
                const plantDirectionMoves = possibleMoves.filter(move => {
                    const dx = move.x - x;
                    const dy = move.y - y;

                    // Check if this move is in any of the plant directions
                    return plantDirections.some(dir => {
                        return (dx * dir.dx + dy * dir.dy) > 0; // Dot product > 0 means same general direction
                    });
                });

                // If we have any moves toward plants, use those instead
                if (plantDirectionMoves.length > 0) {
                    possibleMoves = plantDirectionMoves;
                }
            }
        }

        // If we have possible moves, choose one randomly
        if (possibleMoves.length > 0) {
            const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

            // Move insect
            this.core.type[move.index] = this.TYPE.INSECT;
            this.core.state[move.index] = this.core.state[index];
            this.core.energy[move.index] = this.core.energy[index];

            // Clear original position
            this.core.type[index] = this.TYPE.AIR;
            this.core.state[index] = this.STATE.DEFAULT;
            this.core.energy[index] = 0;

            // Mark new position as processed
            this.biology.processedThisFrame[move.index] = 1;
            nextActivePixels.add(move.index);

            return true;
        }

        return false;
    },

    // Find direction(s) to nearby plants
    findDirectionToPlant: function(x, y, range) {
        const directions = [];

        // Check in a square area around the insect
        for (let dy = -range; dy <= range; dy++) {
            for (let dx = -range; dx <= range; dx++) {
                // Skip the center
                if (dx === 0 && dy === 0) continue;

                const nx = x + dx;
                const ny = y + dy;
                const index = this.core.getIndex(nx, ny);

                if (index !== -1 && this.core.type[index] === this.TYPE.PLANT) {
                    // Found a plant, calculate direction vector
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // Normalize direction
                    const ndx = dx / distance;
                    const ndy = dy / distance;

                    // Add direction with a weight based on distance (closer = higher weight)
                    directions.push({
                        dx: ndx,
                        dy: ndy,
                        weight: 1 / distance
                    });
                }
            }
        }

        return directions;
    },

    // Reproduce insect
    reproduceInsect: function(x, y, index, nextActivePixels) {
        // Check for air pixels where offspring can be placed
        const neighbors = this.core.getNeighborIndices(x, y);
        const airNeighbors = neighbors.filter(n => this.core.type[n.index] === this.TYPE.AIR);

        if (airNeighbors.length > 0) {
            // Choose a random air neighbor
            const neighbor = airNeighbors[Math.floor(Math.random() * airNeighbors.length)];

            // Create new insect
            this.core.type[neighbor.index] = this.TYPE.INSECT;
            this.core.state[neighbor.index] = this.STATE.ADULT;

            // Share energy with offspring
            this.core.energy[neighbor.index] = this.core.energy[index] / 2;
            this.core.energy[index] = this.core.energy[index] / 2;

            // Mark as processed and active
            this.biology.processedThisFrame[neighbor.index] = 1;
            nextActivePixels.add(neighbor.index);

            return true;
        }

        return false;
    }
}