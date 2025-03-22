// Insect System
// Handles insect movement, feeding, and reproductio
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

        // Initialize metadata if not present
        if (!this.core.metadata[index]) {
            this.core.metadata[index] = {
                starvationCounter: 0,
                onPlant: false
            };
        } else if (typeof this.core.metadata[index] === 'number') {
            // Convert old number format to object format
            const oldCounter = this.core.metadata[index];
            this.core.metadata[index] = {
                starvationCounter: oldCounter,
                onPlant: false
            };
        }

        // Apply metabolism trait to energy consumption
        const metabolismMultiplier = this.getMetabolismMultiplier(index);
        this.core.energy[index] -= 1.2 * metabolismMultiplier;

        // Apply lifespan trait to starvation counter
        const lifespanMultiplier = this.getLifespanMultiplier(index);
        
        // If couldn't eat in previous ticks, increase starvation counter
        if (this.core.energy[index] < 300) {
            // Insects with higher lifespan trait have slower starvation
            this.core.metadata[index].starvationCounter += 1.2 / lifespanMultiplier;
        } else {
            // Reset starvation counter if well-fed
            this.core.metadata[index].starvationCounter = 0;
        }

        // Die quickly if not eating
        if (this.core.metadata[index].starvationCounter > 1) {
            // If insect was on a plant, restore the plant when it dies
            if (this.core.metadata[index].onPlant) {
                this.core.type[index] = this.TYPE.PLANT;
                this.core.state[index] = this.core.metadata[index].plantState;
                this.core.energy[index] = this.core.metadata[index].plantEnergy;
                if (this.core.metadata[index].plantWater) {
                    this.core.water[index] = this.core.metadata[index].plantWater;
                }
            } else {
                // Convert to dead matter with some initial decomposition progress
                this.core.type[index] = this.TYPE.DEAD_MATTER;
                // Initialize decomposition between 5-15% to represent that insects decompose faster
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
                this.core.metadata[index] = 0;
                return;
            }

            // If couldn't eat, try to move toward food
            this.moveInsect(x, y, index, nextActivePixels, true);
        } else {
            // Enough energy, consider reproduction
            if (this.core.energy[index] > 250 && Math.random() < 0.001 * this.biology.reproduction) {
                this.reproduceInsect(x, y, index, nextActivePixels);
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

            // Apply feeding efficiency to energy gain
            const feedingEfficiency = this.getFeedingEfficiencyMultiplier(index);
            const energyGain = (10 + Math.floor(this.core.energy[neighbor.index] / 1.2)) * feedingEfficiency;
            this.core.energy[index] += energyGain;

            // Cap energy
            if (this.core.energy[index] > 200) {
                this.core.energy[index] = 200;
            }

            // Apply strength trait to plant damage
            const strength = this.getStrengthMultiplier(index);
            
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
        // Get speed multiplier from genetic traits
        const speedMultiplier = this.getSpeedMultiplier(index);
        
        // Adjust movement probability based on speed trait
        // Faster insects move more frequently
        const movementProbability = 0.9 * speedMultiplier;
        
        if (Math.random() > movementProbability) {
            // Insect stays in place this frame
            nextActivePixels.add(index);
            return false;
        }
        
        // Check neighboring cells
        const neighbors = this.core.getNeighborIndices(x, y);
        let validMoves = [];
        
        // If seeking food, prioritize cells near plants
        if (seekingFood) {
            // First priority: Check if any neighbors are plants
            const plantNeighbors = this.core.getNeighborIndices(x, y, 2); // 2-cell radius
            
            // Find air cells that are near plants
            for (const neighbor of neighbors) {
                if (this.core.type[neighbor.index] === this.TYPE.AIR) {
                    // Check if this air cell is near a plant
                    let nearPlant = false;
                    for (const extendedNeighbor of plantNeighbors) {
                        if (this.core.type[extendedNeighbor.index] === this.TYPE.PLANT) {
                            // Calculate distance from this air cell to the plant
                            const dx = extendedNeighbor.x - neighbor.x;
                            const dy = extendedNeighbor.y - neighbor.y;
                            const distance = Math.sqrt(dx*dx + dy*dy);
                            
                            if (distance < 3) {
                                nearPlant = true;
                                break;
                            }
                        }
                    }
                    
                    // If this air cell is near a plant, heavily prioritize it
                    if (nearPlant) {
                        // Add multiple times to increase probability
                        for (let i = 0; i < 5; i++) {
                            validMoves.push(neighbor);
                        }
                    } else {
                        validMoves.push(neighbor);
                    }
                }
            }
        } else {
            // Not seeking food, just find any valid move
            validMoves = neighbors.filter(n => this.core.type[n.index] === this.TYPE.AIR);
        }
        
        // Add current position to valid moves (lower probability to stay in place)
        if (Math.random() < 0.3) {
            validMoves.push({x: x, y: y, index: index});
        }
        
        if (validMoves.length > 0) {
            // Choose a random valid move
            const move = validMoves[Math.floor(Math.random() * validMoves.length)];
            
            // Don't actually move if we selected current position
            if (move.index === index) {
                nextActivePixels.add(index);
                return false;
            }
            
            // Update pixel type and state
            this.core.type[move.index] = this.TYPE.INSECT;
            this.core.state[move.index] = this.core.state[index];
            this.core.energy[move.index] = this.core.energy[index];
            this.core.water[move.index] = this.core.water[index];
            this.core.metadata[move.index] = this.core.metadata[index];
            
            // Clear old position
            this.core.type[index] = this.TYPE.AIR;
            this.core.state[index] = 0;
            this.core.metadata[index] = 0;
            
            // Mark new position as active and processed
            nextActivePixels.add(move.index);
            this.biology.processedThisFrame[move.index] = 1;
            
            // If the evolution system is tracking this insect, update its position
            if (this.biology.evolutionSystem) {
                const genomeId = this.biology.evolutionSystem.organismGenomes[index];
                if (genomeId) {
                    // Transfer genome tracking to new index
                    delete this.biology.evolutionSystem.organismGenomes[index];
                    this.biology.evolutionSystem.organismGenomes[move.index] = genomeId;
                }
            }
            
            return true;
        } else {
            // No valid moves, stay in place
            nextActivePixels.add(index);
            return false;
        }
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
        // Get reproduction rate trait
        const reproductionRate = this.getReproductionRateMultiplier(index);
        
        // Base reproduction chance adjusted by trait
        if (Math.random() < 0.5 * reproductionRate) {
            // Find adjacent air to spawn new insect
            const neighbors = this.core.getNeighborIndices(x, y);
            const airNeighbors = neighbors.filter(n => this.core.type[n.index] === this.TYPE.AIR);
            
            if (airNeighbors.length > 0) {
                // Choose random air neighbor
                const neighbor = airNeighbors[Math.floor(Math.random() * airNeighbors.length)];
                
                // Create new insect
                this.core.type[neighbor.index] = this.TYPE.INSECT;
                this.core.energy[neighbor.index] = 100;
                this.core.water[neighbor.index] = 10;
                this.core.metadata[neighbor.index] = {
                    starvationCounter: 0,
                    onPlant: false
                };
                
                // Register reproduction with evolution system
                this.biology.handleReproduction(index, neighbor.index);
                
                nextActivePixels.add(neighbor.index);
                
                // Parent loses energy from reproduction
                this.core.energy[index] -= 20;
            }
        }
    },

    // Get speed multiplier for insect
    getSpeedMultiplier: function(index) {
        return this.biology.getTraitModifier(index, "speed");
    },
    
    // Get metabolism multiplier for insect
    getMetabolismMultiplier: function(index) {
        // Combine base metabolism with genetic trait
        const baseMetabolism = this.biology.metabolism;
        const geneticModifier = this.biology.getTraitModifier(index, "metabolism");
        return baseMetabolism * geneticModifier;
    },
    
    // Get feeding efficiency multiplier for insect
    getFeedingEfficiencyMultiplier: function(index) {
        return this.biology.getTraitModifier(index, "feedingEfficiency");
    },
    
    // Get reproduction rate multiplier for insect
    getReproductionRateMultiplier: function(index) {
        // Combine base reproduction rate with genetic trait
        const baseReproductionRate = this.biology.reproduction;
        const geneticModifier = this.biology.getTraitModifier(index, "reproductionRate");
        return baseReproductionRate * geneticModifier;
    },
    
    // Get strength multiplier for insect
    getStrengthMultiplier: function(index) {
        return this.biology.getTraitModifier(index, "strength");
    },
    
    // Get lifespan multiplier for insect
    getLifespanMultiplier: function(index) {
        return this.biology.getTraitModifier(index, "lifespan");
    },
}