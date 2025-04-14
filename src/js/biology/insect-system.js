// Insect System
// Handles insect movement, feeding, and reproductio
export const InsectSystem = {

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

        // --- Robust Metadata Initialization/Check ---
        let meta = this.core.metadata[index];
        const needsReInit = typeof meta !== 'object' || meta === null || typeof meta.starvationCounter === 'undefined';
        
        if (needsReInit) {
            // If metadata is incorrect (number, null, wrong object), force re-initialization.
            console.warn(`Re-initializing corrupted metadata for insect at index ${index}. Old value:`, meta);
            const newMeta = { // Create the new object
                starvationCounter: 0,
                onPlant: false // Assume not on plant if metadata was corrupted
            };
            this.core.metadata[index] = newMeta; // Assign it to the core array
            meta = newMeta; // *** Re-assign the local meta variable ***
        }
        // --- End Robust Check ---

        // Significant energy consumption each tick
        this.core.energy[index] -= 1 * this.biology.metabolism;

        // If couldn't eat in previous ticks, increase starvation counter
        if (this.core.energy[index] < 150) {
            meta.starvationCounter++; // Use the guaranteed 'meta' object
        } else {
            // Reset starvation counter if well-fed
            meta.starvationCounter = 0;
        }

        // Die quickly if not eating
        if (meta.starvationCounter > 1) {
            // If insect was on a plant, restore the plant when it dies
            // Check 'onPlant' status from the potentially re-initialized meta object
            if (meta.onPlant) { 
                this.core.type[index] = this.TYPE.PLANT;
                // Restore state/energy cautiously, maybe just default
                this.core.state[index] = meta.plantState || this.STATE.DEFAULT; 
                this.core.energy[index] = meta.plantEnergy || 0;
                if (meta.plantWater) {
                    this.core.water[index] = meta.plantWater;
                }
                // After restoring plant, reset metadata to 0 (or default for plant)
                this.core.metadata[index] = 0; 
            } else {
                // Convert to dead matter with some initial decomposition progress
                this.core.type[index] = this.TYPE.DEAD_MATTER;
                this.core.metadata[index] = Math.floor(5 + Math.random() * 10);
                this.core.energy[index] = Math.max(10, this.core.energy[index] / 2);
                this.core.nutrient[index] = 15 + Math.floor(Math.random() * 10);
            }
            nextActivePixels.add(index);
            return;
        }

        // Decide action: move, eat, or reproduce based on needs
        if (this.core.energy[index] < 200) {
            // Low energy, prioritize eating
            if (this.tryEat(x, y, index, nextActivePixels)) {
                // Successfully ate, reset starvation counter
                meta.starvationCounter = 0; // Use meta object
                // Note: We don't return here in case it needs to move immediately after eating
            }

            // Try to move toward food (even if it just ate, maybe find better food)
            this.moveInsect(x, y, index, nextActivePixels, true);
        } else {
            // Enough energy, consider reproduction
            if (this.core.energy[index] > 200 && Math.random() < 0.002 * this.biology.reproduction) {
                if (this.reproduceInsect(x, y, index, nextActivePixels)) {
                     // Successfully reproduced, consume some energy
                     this.core.energy[index] -= 50; 
                }
            } else {
                // Otherwise just move randomly
                this.moveInsect(x, y, index, nextActivePixels, false);
            }
        }

        // Insects remain active
        nextActivePixels.add(index);
    },

    tryEat: function(x, y, index, nextActivePixels) {
        // Check all neighbors for plant material
        const neighbors = this.core.getNeighborIndices(x, y);
        const plantNeighbors = neighbors.filter(n => this.core.type[n.index] === this.TYPE.PLANT);

        if (plantNeighbors.length > 0) {
            // Choose a random plant neighbor
            const neighbor = plantNeighbors[Math.floor(Math.random() * plantNeighbors.length)];

            // More aggressive energy gain
            const energyGain = 10 + Math.floor(this.core.energy[neighbor.index] / 1.2);
            this.core.energy[index] += energyGain;

            // Cap energy
            if (this.core.energy[index] > 200) {
                this.core.energy[index] = 200;
            }

            // Very destructive plant consumption
            switch (this.core.state[neighbor.index]) {
                case this.STATE.LEAF:
                    // Completely destroy leaf, high energy gain
                    this.core.type[neighbor.index] = this.TYPE.AIR;
                    this.core.energy[index] += 30;
                    break;
                case this.STATE.STEM:
                    // Severely damage stem
                    this.core.type[neighbor.index] = this.TYPE.AIR;
                    this.core.energy[index] += 20;
                    break;
                case this.STATE.ROOT:
                    // Moderate damage to roots
                    this.core.energy[neighbor.index] = Math.floor(this.core.energy[neighbor.index] * 0.3);
                    this.core.energy[index] += 10;
                    break;
            }

            nextActivePixels.add(neighbor.index);
            return true;
        }

        return false;
    },

    // Move insect to a new position
    moveInsect: function(x, y, index, nextActivePixels, seekingFood) {
        let possibleMoves = [];

        // Get all possible moves (into air, water, or plants)
        const neighbors = this.core.getNeighborIndices(x, y);

        for (const neighbor of neighbors) {
            // Can move into air, plants (flying over), and occasionally into water (if desperate)
            if (this.core.type[neighbor.index] === this.TYPE.AIR || 
                this.core.type[neighbor.index] === this.TYPE.PLANT ||
                (this.core.type[neighbor.index] === this.TYPE.WATER && 
                 (this.core.energy[index] < 50 || Math.random() < 0.2))) {
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

            // Store the destination plant information if moving into a plant
            const isMovingIntoPlant = this.core.type[move.index] === this.TYPE.PLANT;
            const plantState = isMovingIntoPlant ? this.core.state[move.index] : null;
            const plantEnergy = isMovingIntoPlant ? this.core.energy[move.index] : 0;
            const plantWater = isMovingIntoPlant ? this.core.water[move.index] : 0;
            
            // Check if insect is currently on a plant and needs to restore it when moving
            const wasOnPlant = this.core.metadata[index] && 
                              this.core.metadata[index].onPlant;
            
            // Move insect
            this.core.type[move.index] = this.TYPE.INSECT;
            this.core.state[move.index] = this.STATE.DEFAULT;
            this.core.energy[move.index] = this.core.energy[index];

            // Transfer the metadata OBJECT reference
            const insectMetadata = this.core.metadata[index]; // Get the insect's metadata object
            // Ensure the metadata object is valid before transferring
            if (typeof insectMetadata !== 'object' || insectMetadata === null) {
                console.error(`Error in moveInsect: Invalid metadata for moving insect at index ${index}`, insectMetadata);
                // Attempt recovery if possible, otherwise the insect might error out later
                this.core.metadata[move.index] = { starvationCounter: 0, onPlant: false };
            } else {
                this.core.metadata[move.index] = insectMetadata;
            }

            // What to leave behind at the original location (index)?
            if (wasOnPlant) {
                // If moving onto a plant, insect metadata needs updating
                if (this.core.metadata[move.index] && typeof this.core.metadata[move.index] === 'object') {
                    this.core.metadata[move.index].onPlant = true;
                    // Store plant details IF they exist (targetMetadata might be null/invalid)
                    this.core.metadata[move.index].plantState = plantState;
                    this.core.metadata[move.index].plantEnergy = plantEnergy;
                    this.core.metadata[move.index].plantWater = plantWater; 
                } else {
                     console.warn(`Warning in moveInsect: Could not set onPlant for insect at ${move.index} because metadata is invalid after move.`);
                }
                // Leave air behind where the insect was
                this.core.type[index] = this.TYPE.AIR;
                this.core.state[index] = this.STATE.DEFAULT;
                this.core.metadata[index] = null; // *** Use null instead of 0 ***
                this.core.energy[index] = 0;
                this.core.water[index] = 0;
                this.core.nutrient[index] = 0;
                
            } else { 
                 // If moving into air/water, ensure insect metadata reflects not being on a plant
                if (this.core.metadata[move.index] && typeof this.core.metadata[move.index] === 'object') {
                    this.core.metadata[move.index].onPlant = false; 
                } else {
                     console.warn(`Warning in moveInsect: Could not set onPlant=false for insect at ${move.index} because metadata is invalid after move.`);
                }
                 // Leave air behind where the insect was
                 this.core.type[index] = this.TYPE.AIR;
                 this.core.state[index] = this.STATE.DEFAULT;
                 this.core.metadata[index] = null; // *** Use null instead of 0 ***
                 this.core.energy[index] = 0;
                 this.core.water[index] = 0;
                 this.core.nutrient[index] = 0;
            }

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
            this.core.state[neighbor.index] = this.STATE.DEFAULT; // Use default state

            // Share energy with offspring
            this.core.energy[neighbor.index] = this.core.energy[index] / 2;
            this.core.energy[index] = this.core.energy[index] / 2;
            
            // --- Initialize metadata for the new insect --- 
            this.core.metadata[neighbor.index] = { starvationCounter: 0, onPlant: false };

            // Mark as processed and active
            this.biology.processedThisFrame[neighbor.index] = 1;
            nextActivePixels.add(neighbor.index);

            return true;
        }

        return false;
    }
}