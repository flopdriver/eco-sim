// Tool System
// Handles tool-specific functionality for the pixel ecosystem simulation

window.ToolSystem = {
    // Reference to parent user interaction system
    userInteraction: null,

    // Shorthand references to commonly used objects
    core: null,
    TYPE: null,
    STATE: null,

    // Tool-specific settings
    toolSettings: {
        water: {
            amount: 255,      // Amount of water to add (0-255)
            spreadFactor: 0.8 // How much water spreads with brush size
        },
        seed: {
            energy: 100,       // Initial seed energy
            probability: 0.2   // Chance to place seed within brush
        },
        dig: {
            depth: 0.4,        // Dig depth factor (0-1)
            effectiveness: 0.9 // How effectively the dig tool removes material
        },
        insect: {
            energy: 150,       // Initial insect energy
            probability: 0.1   // Chance to place insect within brush
        },
        worm: {
            energy: 200,       // Initial worm energy
            probability: 0.1   // Chance to place worm within brush
        },
        fire: {
            probability: 0.8,  // High chance to place fire within brush
            intensity: 1.0     // Fire intensity
        },
        hand: {
            selectionRadius: 5,  // Visual selection radius
            dragThreshold: 3,    // Minimum drag distance to start moving entities
            interactionRange: 15 // Range for entity interactions
        }
    },

    // Initialize tool system
    init: function(userInteractionSystem) {
        console.log("Initializing tool system...");
        
        if (!userInteractionSystem) {
            console.error("Error: userInteractionSystem is null or undefined");
            return this;
        }
        
        this.userInteraction = userInteractionSystem;
        
        if (!userInteractionSystem.core) {
            console.error("Error: userInteractionSystem.core is null or undefined");
            return this;
        }
        
        this.core = userInteractionSystem.core;
        this.TYPE = userInteractionSystem.TYPE;
        this.STATE = userInteractionSystem.STATE;

        // Energy factor modifiers (used by UI sliders)
        this.plantEnergyFactor = 1.0;
        this.insectEnergyFactor = 1.0;
        this.wormEnergyFactor = 1.0;

        return this;
    },

    // Apply tool at position with brush size
    applyTool: function(tool, x, y) {
        // Check if core exists and has getIndex method
        if (!this.core || typeof this.core.getIndex !== 'function') {
            console.error("Error: core object or getIndex method is missing");
            return;
        }
        
        // Apply in a circular area based on brush size
        const brushSize = this.userInteraction.brushSize;
        for (let dy = -brushSize; dy <= brushSize; dy++) {
            for (let dx = -brushSize; dx <= brushSize; dx++) {
                // Calculate distance from center
                const distanceSquared = dx * dx + dy * dy;
                const distance = Math.sqrt(distanceSquared);

                // Apply only within radius
                if (distance <= brushSize) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const index = this.core.getIndex(nx, ny);

                    if (index !== -1) {
                        // Intensity decreases with distance from center
                        // Uses a smoother falloff curve
                        const intensity = Math.pow(1 - (distance / brushSize), 2);
                        this.applySingleTool(tool, nx, ny, index, intensity);
                    }
                }
            }
        }
    },

    // Apply tool at a single pixel
    applySingleTool: function(tool, x, y, index, intensity) {
        // Skip invalid indices
        if (index === -1) return;

        // Full intensity by default
        intensity = intensity || 1.0;

        switch (tool) {
            case 'water':
                this.applyWaterTool(x, y, index, intensity);
                break;
            case 'seed':
                this.applySeedTool(x, y, index, intensity);
                break;
            case 'dig':
                this.applyDigTool(x, y, index, intensity);
                break;
            case 'insect':
                this.applyInsectTool(x, y, index, intensity);
                break;
            case 'worm':
                this.applyWormTool(x, y, index, intensity);
                break;
            case 'fire':
                this.applyFireTool(x, y, index, intensity);
                break;
            case 'observe':
                this.applyObserveTool(x, y, index, intensity);
                break;
            case 'hand':
                this.applyHandTool(x, y, index, intensity);
                break;
            default:
                console.warn('Unknown tool:', tool);
                break;
        }
    },

    // Apply water tool
    applyWaterTool: function(x, y, index, intensity) {
        const settings = this.toolSettings.water;
        const waterAmount = Math.floor(settings.amount * intensity * settings.spreadFactor);

        if (this.core.type[index] === this.TYPE.AIR) {
            // Add water to air if enough intensity
            if (intensity > 0.3) {
                this.core.type[index] = this.TYPE.WATER;
                this.core.water[index] = Math.min(255, waterAmount);
            }
        } else if (this.core.type[index] === this.TYPE.SOIL) {
            // Add water to soil - soil absorbs water effectively
            this.core.water[index] = Math.min(255, this.core.water[index] + waterAmount);

            // Update soil state based on wetness
            if (this.core.water[index] > 20) {
                this.core.state[index] = this.STATE.WET;
            }
        } else if (this.core.type[index] === this.TYPE.PLANT) {
            // Plants can absorb some water
            this.core.water[index] = Math.min(255, this.core.water[index] + Math.floor(waterAmount * 0.5));
        }
    },

    // Apply seed tool
    applySeedTool: function(x, y, index, intensity) {
        const settings = this.toolSettings.seed;

        // Plant seeds in air, soil, or on top of soil
        if (this.core.type[index] === this.TYPE.AIR || this.core.type[index] === this.TYPE.SOIL) {
            // Check if there's soil nearby (especially below)
            const belowIndex = this.core.getIndex(x, y + 1);
            const hasSoilBelow = belowIndex !== -1 && this.core.type[belowIndex] === this.TYPE.SOIL;
            const isInSoil = this.core.type[index] === this.TYPE.SOIL;

            // Adjust chance factor based on where we're planting
            let chanceFactor = 1.0;
            if (isInSoil) {
                // Higher chance when planting directly in soil (preferred)
                chanceFactor = 2.0;
            } else if (hasSoilBelow) {
                // Slightly higher chance when on top of soil
                chanceFactor = 1.5;
            }

            // Place seed with probability based on intensity and settings
            if (Math.random() < settings.probability * intensity * chanceFactor) {
                this.core.type[index] = this.TYPE.SEED;
                this.core.state[index] = this.STATE.DEFAULT;

                // Energy varies with intensity and plant energy factor
                // Seeds planted in soil start with more energy
                const energyBonus = isInSoil ? 1.3 : 1.0;
                this.core.energy[index] = Math.floor(settings.energy * (0.8 + 0.4 * intensity) * this.plantEnergyFactor * energyBonus);

                // Seeds contain some water - more if planted in wet soil
                if (isInSoil && this.core.water[index] > 20) {
                    this.core.water[index] = Math.min(50, this.core.water[index]);
                } else {
                    this.core.water[index] = 30;
                }

                // Initialize the metadata counter to ensure gravity processing
                this.core.metadata[index] = 0;

                // Ensure this pixel becomes active immediately
                if (window.ecosim && window.ecosim.activePixels) {
                    window.ecosim.activePixels.add(index);
                }
            }
        }
    },

    // Apply dig tool
    applyDigTool: function(x, y, index, intensity) {
        const settings = this.toolSettings.dig;

        // Digging effectiveness increases with intensity
        const effectiveness = settings.effectiveness * intensity;

        // Chance to remove/modify based on intensity
        if (Math.random() < effectiveness) {
            // Handle differently based on current pixel type
            switch (this.core.type[index]) {
                case this.TYPE.AIR:
                    // Nothing to dig in air
                    break;

                case this.TYPE.WATER:
                    // Remove water
                    this.core.type[index] = this.TYPE.AIR;
                    this.core.water[index] = 0;
                    break;

                case this.TYPE.SOIL:
                    // In the upper part of the simulation, convert to air
                    if (y < this.core.height * settings.depth) {
                        this.core.type[index] = this.TYPE.AIR;
                        this.core.state[index] = this.STATE.DEFAULT;
                        this.core.water[index] = 0;
                        this.core.nutrient[index] = 0;
                    } else {
                        // Lower soil just gets disturbed/aerated
                        // Sometimes makes soil more fertile
                        if (Math.random() < 0.3) {
                            this.core.state[index] = this.STATE.FERTILE;
                            this.core.nutrient[index] = Math.min(255, this.core.nutrient[index] + 20);
                        }
                    }
                    break;

                case this.TYPE.PLANT:
                case this.TYPE.INSECT:
                case this.TYPE.SEED:
                case this.TYPE.WORM:
                    // Remove organisms, convert to dead matter
                    this.core.type[index] = this.TYPE.DEAD_MATTER;
                    break;

                case this.TYPE.DEAD_MATTER:
                    // Remove dead matter
                    this.core.type[index] = this.TYPE.AIR;
                    break;
            }
        }
    },

    // Apply insect tool
    applyInsectTool: function(x, y, index, intensity) {
        const settings = this.toolSettings.insect;

        // Only add insects to air, and with some randomness
        if (this.core.type[index] === this.TYPE.AIR) {
            // Add with probability based on intensity and settings
            if (Math.random() < settings.probability * intensity) {
                this.core.type[index] = this.TYPE.INSECT;
                this.core.state[index] = this.STATE.ADULT;

                // Energy based on settings, intensity, and insect energy factor
                this.core.energy[index] = Math.floor(settings.energy * (0.9 + 0.2 * intensity) * this.insectEnergyFactor);

                // Initialize the metadata counter to ensure gravity processing
                this.core.metadata[index] = 0;

                // Ensure this pixel becomes active immediately
                if (window.ecosim && window.ecosim.activePixels) {
                    window.ecosim.activePixels.add(index);
                }
            }
        }
    },

    // Apply worm tool
    applyWormTool: function(x, y, index, intensity) {
        const settings = this.toolSettings.worm;

        // Worms can be added to soil or air
        if (this.core.type[index] === this.TYPE.SOIL || this.core.type[index] === this.TYPE.AIR) {
            // Higher chance in soil than air
            const typeFactor = this.core.type[index] === this.TYPE.SOIL ? 1.5 : 0.7;

            // Add with probability based on intensity, type and settings
            if (Math.random() < settings.probability * intensity * typeFactor) {
                this.core.type[index] = this.TYPE.WORM;

                // Energy based on settings, intensity, and worm energy factor
                this.core.energy[index] = Math.floor(settings.energy * (0.8 + 0.4 * intensity) * this.wormEnergyFactor);

                // Worms in soil get a nutrient bonus
                if (this.core.type[index] === this.TYPE.SOIL) {
                    this.core.nutrient[index] = Math.min(255, this.core.nutrient[index] + 30);
                }

                // Initialize the metadata counter to ensure gravity processing
                this.core.metadata[index] = 0;

                // Ensure this pixel becomes active immediately
                if (window.ecosim && window.ecosim.activePixels) {
                    window.ecosim.activePixels.add(index);
                }
            }
        }
    },

    // Apply fire tool
    applyFireTool: function(x, y, index, intensity) {
        // Skip if intensity is too low
        if (intensity < 0.3) return;

        // Only apply to plants and dead matter with some probability
        const type = this.core.type[index];
        if ((type === this.TYPE.PLANT || type === this.TYPE.DEAD_MATTER) &&
            Math.random() < this.toolSettings.fire.probability * intensity) {

            // Start a fire at this location
            if (window.ecosim && window.ecosim.environment && window.ecosim.environment.fireSystem) {
                window.ecosim.environment.fireSystem.startFire(index,
                    window.ecosim.activePixels || new Set());
            }
        }
    },

    // Apply observe tool (shows info without modifying)
    applyObserveTool: function(x, y, index, intensity) {
        // Only apply to the center pixel of the brush at high intensity
        if (intensity < 0.9) return;

        // Get pixel properties
        const type = this.core.type[index];
        const state = this.core.state[index];
        const water = this.core.water[index];
        const nutrient = this.core.nutrient[index];
        const energy = this.core.energy[index];

        // Log information about the observed pixel
        console.log("Observed pixel:", {
            position: { x, y },
            type: this.getTypeString(type),
            state: this.getStateString(state),
            water: water,
            nutrient: nutrient,
            energy: energy
        });

        // Future enhancement: show tooltip or info panel with this data
    },
    
    // Apply hand tool for selection and interaction with entities
    applyHandTool: function(x, y, index, intensity) {
        // Only apply at high intensity for precise selection
        if (intensity < 0.8) return false;
        
        // Get pixel properties
        const type = this.core.type[index];
        
        // Skip air/empty pixels - nothing to interact with
        if (type === this.TYPE.AIR) {
            // Clear any existing selection
            if (this.userInteraction.selectedEntity) {
                this.userInteraction.selectedEntity = null;
                
                // Clear visual highlights
                if (this.userInteraction.visualizationSystem && 
                    this.userInteraction.visualizationSystem.clearHighlights) {
                    this.userInteraction.visualizationSystem.clearHighlights();
                }
                
                console.log("Selection cleared");
            }
            return false;
        }
        
        // Get details of the entity for selection
        const entityDetails = this.getEntityDetails(x, y, index);
        
        // Find connected entities (e.g. all parts of a plant)
        if (type === this.TYPE.PLANT || type === this.TYPE.INSECT || type === this.TYPE.WORM) {
            entityDetails.connectedPixels = this.findConnectedEntities(index, type);
        }
        
        // Store selection in the user interaction system
        this.userInteraction.selectedEntity = entityDetails;
        
        // Highlight the selection visually if visualization system is available
        if (this.userInteraction.visualizationSystem && 
            this.userInteraction.visualizationSystem.highlightSelection) {
            // Use selection radius from settings
            this.userInteraction.visualizationSystem.highlightSelection(
                x, y, this.toolSettings.hand.selectionRadius
            );
        }
        
        console.log("Selected entity:", entityDetails);
        return true;
    },
    
    // Get detailed information about an entity at a specific position
    getEntityDetails: function(x, y, index) {
        const type = this.core.type[index];
        const state = this.core.state[index];
        const water = this.core.water[index];
        const nutrient = this.core.nutrient[index];
        const energy = this.core.energy[index];
        
        // Base details common to all entity types
        const details = {
            type: this.getTypeString(type),
            state: this.getStateString(state),
            index: index,
            position: { x, y },
            properties: {
                water: water,
                nutrient: nutrient,
                energy: energy
            }
        };
        
        // Add type-specific details
        switch (type) {
            case this.TYPE.PLANT:
                details.healthStatus = energy > 70 ? "Healthy" : energy > 30 ? "Stable" : "Struggling";
                details.waterStatus = water > 40 ? "Well-hydrated" : water > 15 ? "Adequate" : "Dehydrated";
                details.growthStage = this.getPlantGrowthStage(state, energy);
                break;
                
            case this.TYPE.INSECT:
                details.healthStatus = energy > 70 ? "Healthy" : energy > 30 ? "Hungry" : "Starving";
                details.lifeStage = state === this.STATE.LARVA ? "Larva" : "Adult";
                details.movementStatus = energy > 50 ? "Active" : "Sluggish";
                break;
                
            case this.TYPE.SEED:
                details.germinationStatus = energy > 50 ? "Ready to germinate" : "Dormant";
                details.viabilityStatus = energy > 20 ? "Viable" : "Low viability";
                break;
                
            case this.TYPE.WORM:
                details.healthStatus = energy > 60 ? "Healthy" : energy > 25 ? "Stable" : "Weak";
                details.soilImpact = "Aerating soil";
                break;
                
            case this.TYPE.SOIL:
                details.moisture = water > 50 ? "Very wet" : water > 20 ? "Moist" : "Dry";
                details.fertility = nutrient > 50 ? "Very fertile" : nutrient > 20 ? "Fertile" : "Poor";
                details.composition = state === this.STATE.FERTILE ? "Rich soil" : "Standard soil";
                break;
                
            case this.TYPE.WATER:
                details.depth = water > 200 ? "Deep" : water > 100 ? "Medium" : "Shallow";
                details.clarity = nutrient < 10 ? "Clear" : nutrient < 30 ? "Slightly murky" : "Murky";
                break;
        }
        
        return details;
    },
    
    // Get descriptive growth stage for plants
    getPlantGrowthStage: function(state, energy) {
        switch (state) {
            case this.STATE.ROOT:
                return energy > 80 ? "Established root" : "Developing root";
            case this.STATE.STEM:
                return energy > 80 ? "Mature stem" : "Growing stem";
            case this.STATE.LEAF:
                return energy > 80 ? "Mature leaf" : "Developing leaf";
            case this.STATE.FLOWER:
                return energy > 80 ? "Blooming flower" : "Budding flower";
            default:
                return "Undifferentiated";
        }
    },
    
    // Find all connected entities of the same type
    // Returns an array of indices of connected pixels
    findConnectedEntities: function(startIndex, entityType) {
        const connected = new Set();
        const visited = new Set();
        const queue = [startIndex];
        
        while (queue.length > 0) {
            const currentIndex = queue.shift();
            if (visited.has(currentIndex)) continue;
            
            visited.add(currentIndex);
            
            if (this.core.type[currentIndex] === entityType) {
                connected.add(currentIndex);
                
                // Get coordinates for the current index
                const coords = this.core.getCoords(currentIndex);
                if (!coords) continue;
                
                // Check all neighboring pixels
                const neighbors = this.core.getNeighborIndices(coords.x, coords.y);
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor.index) && this.core.type[neighbor.index] === entityType) {
                        queue.push(neighbor.index);
                    }
                }
            }
        }
        
        return Array.from(connected);
    },
    
    // Start dragging an entity - called when mouse down with hand tool
    startEntityDrag: function(entity, startX, startY) {
        if (!entity) return false;
        
        this.draggedEntity = entity;
        this.dragStartPos = { x: startX, y: startY };
        this.isDragging = false; // Not dragging yet until we exceed threshold
        
        return true;
    },
    
    // Update entity dragging - called during mouse move
    updateEntityDrag: function(currentX, currentY) {
        if (!this.draggedEntity) return false;
        
        // Calculate distance moved from start
        const dx = currentX - this.dragStartPos.x;
        const dy = currentY - this.dragStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Only start actual dragging if we exceed threshold
        if (distance > this.toolSettings.hand.dragThreshold) {
            this.isDragging = true;
            
            // Use exact cursor position for precise alignment
            // Show visual feedback during drag at exact cursor position
            if (this.userInteraction.visualizationSystem && 
                this.userInteraction.visualizationSystem.showTooltip) {
                this.userInteraction.visualizationSystem.showTooltip(
                    currentX, currentY, "Release to place entity"
                );
            }
            
            // Move visual representation during drag to exact cursor position
            if (this.userInteraction.visualizationSystem && 
                this.userInteraction.visualizationSystem.moveHighlight) {
                this.userInteraction.visualizationSystem.moveHighlight(currentX, currentY);
            }
        }
        
        return this.isDragging;
    },
    
    // Complete entity drag - called on mouse up
    completeEntityDrag: function(finalX, finalY) {
        // If we weren't dragging or have no entity, just clean up
        if (!this.draggedEntity || !this.isDragging) {
            this.draggedEntity = null;
            this.dragStartPos = null;
            this.isDragging = false;
            return false;
        }
        
        // The exact mouse position is what matters - use the exact coordinates
        // This is the core fix - we want to drop the entity exactly where the mouse cursor is
        const exactIndex = this.core.getIndex(finalX, finalY);
        
        if (exactIndex === -1) {
            // Invalid position
            this.draggedEntity = null;
            this.dragStartPos = null;
            this.isDragging = false;
            return false;
        }
        
        // Check if we can place the entity here
        const originType = this.core.type[this.draggedEntity.index];
        const targetType = this.core.type[exactIndex];
        
        // Determine valid placement based on entity type
        let canPlace = false;
        
        switch (originType) {
            case this.TYPE.PLANT:
                // Plants can be placed in air or soil
                canPlace = targetType === this.TYPE.AIR || targetType === this.TYPE.SOIL;
                break;
                
            case this.TYPE.INSECT:
                // Insects can be placed in air or on plants
                canPlace = targetType === this.TYPE.AIR || targetType === this.TYPE.PLANT;
                break;
                
            case this.TYPE.WORM:
                // Worms can be placed in soil or air
                canPlace = targetType === this.TYPE.SOIL || targetType === this.TYPE.AIR;
                break;
                
            default:
                // Other types default to air only
                canPlace = targetType === this.TYPE.AIR;
        }
        
        if (canPlace) {
            // Move entity from original position to the exact mouse position
            this.moveEntity(this.draggedEntity.index, exactIndex);
            
            // Update selection with the exact coordinates - critical for alignment
            this.draggedEntity.index = exactIndex;
            this.draggedEntity.position = { x: finalX, y: finalY };
            this.userInteraction.selectedEntity = this.draggedEntity;
            
            // Update visual highlight at the exact cursor position
            if (this.userInteraction.visualizationSystem && 
                this.userInteraction.visualizationSystem.highlightSelection) {
                this.userInteraction.visualizationSystem.highlightSelection(
                    finalX, finalY, this.toolSettings.hand.selectionRadius
                );
            }
            
            // Hide tooltip if shown during drag
            if (this.userInteraction.visualizationSystem && 
                this.userInteraction.visualizationSystem.hideTooltip) {
                this.userInteraction.visualizationSystem.hideTooltip();
            }
            
            // Clean up drag state
            this.draggedEntity = null;
            this.dragStartPos = null;
            this.isDragging = false;
            
            return true;
        }
        
        // Reset drag state
        this.draggedEntity = null;
        this.dragStartPos = null;
        this.isDragging = false;
        
        return false;
    },
    
    // Move an entity from one position to another
    moveEntity: function(sourceIndex, targetIndex) {
        // Copy all properties from source to target
        this.core.type[targetIndex] = this.core.type[sourceIndex];
        this.core.state[targetIndex] = this.core.state[sourceIndex];
        this.core.water[targetIndex] = this.core.water[sourceIndex];
        this.core.energy[targetIndex] = this.core.energy[sourceIndex];
        this.core.nutrient[targetIndex] = this.core.nutrient[sourceIndex];
        this.core.metadata[targetIndex] = this.core.metadata[sourceIndex];
        
        // Clear source position (make it air)
        this.core.type[sourceIndex] = this.TYPE.AIR;
        this.core.state[sourceIndex] = this.STATE.DEFAULT;
        this.core.water[sourceIndex] = 0;
        this.core.energy[sourceIndex] = 0;
        this.core.nutrient[sourceIndex] = 0;
        this.core.metadata[sourceIndex] = 0;
        
        // Make sure the entity becomes active at new location
        if (window.ecosim && window.ecosim.activePixels) {
            window.ecosim.activePixels.add(targetIndex);
        }
        
        return true;
    },
    
    // Apply a specific interaction to an entity
    handleEntityInteraction: function(interactionType, entity, targetX, targetY, targetIndex) {
        if (!entity) return false;
        
        switch (interactionType) {
            case 'inspect':
                // Show detailed information about entity
                const details = this.getEntityDetails(entity.position.x, entity.position.y, entity.index);
                
                // Display details in tooltip or info panel
                if (this.userInteraction.visualizationSystem && 
                    this.userInteraction.visualizationSystem.showEntityInfo) {
                    this.userInteraction.visualizationSystem.showEntityInfo(details);
                }
                
                console.log("Entity details:", details);
                return true;
                
            case 'boost':
                // Boost an organism's energy level
                if (entity.type === 'Plant' || entity.type === 'Insect' || entity.type === 'Worm' || entity.type === 'Seed') {
                    // Add energy
                    this.core.energy[entity.index] = Math.min(255, this.core.energy[entity.index] + 50);
                    
                    // Also add some water for plants and seeds
                    if (entity.type === 'Plant' || entity.type === 'Seed') {
                        this.core.water[entity.index] = Math.min(255, this.core.water[entity.index] + 30);
                    }
                    
                    // Make sure the entity becomes active
                    if (window.ecosim && window.ecosim.activePixels) {
                        window.ecosim.activePixels.add(entity.index);
                    }
                    
                    return true;
                }
                return false;
                
            case 'transplant':
                // Move an entity to a new location
                if (!targetIndex) return false;
                
                // Determine if target location is valid for this entity
                const entityType = this.core.type[entity.index];
                const targetType = this.core.type[targetIndex];
                
                let canTransplant = false;
                
                switch (entityType) {
                    case this.TYPE.PLANT:
                        // Plants can be transplanted to air or soil
                        canTransplant = targetType === this.TYPE.AIR || targetType === this.TYPE.SOIL;
                        break;
                        
                    case this.TYPE.INSECT:
                        // Insects can be placed in air or on plants
                        canTransplant = targetType === this.TYPE.AIR || targetType === this.TYPE.PLANT;
                        break;
                        
                    case this.TYPE.WORM:
                        // Worms can be placed in soil or air
                        canTransplant = targetType === this.TYPE.SOIL || targetType === this.TYPE.AIR;
                        break;
                        
                    default:
                        // Other types default to air only
                        canTransplant = targetType === this.TYPE.AIR;
                }
                
                if (canTransplant) {
                    // Use the move entity function to handle the transplant
                    return this.moveEntity(entity.index, targetIndex);
                }
                return false;
                
            default:
                console.warn('Unknown interaction type:', interactionType);
                return false;
        }
    },

    // Convert type value to string description
    getTypeString: function(type) {
        const typeMap = {
            [this.TYPE.AIR]: "Air",
            [this.TYPE.WATER]: "Water",
            [this.TYPE.SOIL]: "Soil",
            [this.TYPE.PLANT]: "Plant",
            [this.TYPE.INSECT]: "Insect",
            [this.TYPE.SEED]: "Seed",
            [this.TYPE.DEAD_MATTER]: "Dead Matter",
            [this.TYPE.WORM]: "Worm"
        };
        return typeMap[type] || "Unknown";
    },

    // Convert state value to string description
    getStateString: function(state) {
        const stateMap = {
            [this.STATE.DEFAULT]: "Default",
            [this.STATE.WET]: "Wet",
            [this.STATE.DRY]: "Dry",
            [this.STATE.FERTILE]: "Fertile",
            [this.STATE.ROOT]: "Root",
            [this.STATE.STEM]: "Stem",
            [this.STATE.LEAF]: "Leaf",
            [this.STATE.FLOWER]: "Flower",
            [this.STATE.LARVA]: "Larva",
            [this.STATE.ADULT]: "Adult",
            [this.STATE.DECOMPOSING]: "Decomposing"
        };
        return stateMap[state] || "Unknown";
    }
};