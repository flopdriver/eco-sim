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
        }
    },

    // Initialize tool system
    init: function(userInteractionSystem) {
        console.log("Initializing tool system...");
        this.userInteraction = userInteractionSystem;
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
        // Get reference to controller for easier access to chunk manager
        const controller = this.userInteraction.controller;

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

                        // Mark as changed in the chunk system
                        if (controller && controller.chunkManager) {
                            controller.chunkManager.markChange(nx, ny);
                        }
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
            case 'observe':
                this.applyObserveTool(x, y, index, intensity);
                break;
            default:
                console.warn('Unknown tool:', tool);
                break;
        }
    },

    // Apply water tool
    applyWaterTool: function(x, y, index, intensity) {
        // Get reference to controller for chunk manager
        const controller = this.userInteraction.controller;

        const settings = this.toolSettings.water;
        const waterAmount = Math.floor(settings.amount * intensity * settings.spreadFactor);

        if (this.core.type[index] === this.TYPE.AIR) {
            // Add water to air if enough intensity
            if (intensity > 0.3) {
                this.core.type[index] = this.TYPE.WATER;
                this.core.water[index] = Math.min(255, waterAmount);

                // Mark as changed in chunk system
                if (controller && controller.chunkManager) {
                    controller.chunkManager.markChange(x, y);
                }
            }
        } else if (this.core.type[index] === this.TYPE.SOIL) {
            // Add water to soil - soil absorbs water effectively
            this.core.water[index] = Math.min(255, this.core.water[index] + waterAmount);

            // Update soil state based on wetness
            if (this.core.water[index] > 20) {
                this.core.state[index] = this.STATE.WET;
            }

            // Mark as changed in chunk system
            if (controller && controller.chunkManager) {
                controller.chunkManager.markChange(x, y);
            }
        } else if (this.core.type[index] === this.TYPE.PLANT) {
            // Plants can absorb some water
            this.core.water[index] = Math.min(255, this.core.water[index] + Math.floor(waterAmount * 0.5));

            // Mark as changed in chunk system
            if (controller && controller.chunkManager) {
                controller.chunkManager.markChange(x, y);
            }
        }
    },

    // Apply seed tool
    applySeedTool: function(x, y, index, intensity) {
        // Get reference to controller for chunk manager
        const controller = this.userInteraction.controller;

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

                // Mark as changed in chunk system
                if (controller && controller.chunkManager) {
                    controller.chunkManager.markChange(x, y);
                }

                // Ensure this pixel becomes active immediately
                if (window.ecosim && window.ecosim.activePixels) {
                    window.ecosim.activePixels.add(index);
                }
            }
        }
    },

    // Apply dig tool
    applyDigTool: function(x, y, index, intensity) {
        // Get reference to controller for chunk manager
        const controller = this.userInteraction.controller;

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

                    // Mark as changed in chunk system
                    if (controller && controller.chunkManager) {
                        controller.chunkManager.markChange(x, y);
                    }
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

                    // Mark as changed in chunk system
                    if (controller && controller.chunkManager) {
                        controller.chunkManager.markChange(x, y);
                    }
                    break;

                case this.TYPE.PLANT:
                case this.TYPE.INSECT:
                case this.TYPE.SEED:
                case this.TYPE.WORM:
                    // Remove organisms, convert to dead matter
                    this.core.type[index] = this.TYPE.DEAD_MATTER;

                    // Mark as changed in chunk system
                    if (controller && controller.chunkManager) {
                        controller.chunkManager.markChange(x, y);
                    }
                    break;

                case this.TYPE.DEAD_MATTER:
                    // Remove dead matter
                    this.core.type[index] = this.TYPE.AIR;

                    // Mark as changed in chunk system
                    if (controller && controller.chunkManager) {
                        controller.chunkManager.markChange(x, y);
                    }
                    break;
            }
        }
    },

    // Apply insect tool
    applyInsectTool: function(x, y, index, intensity) {
        // Get reference to controller for chunk manager
        const controller = this.userInteraction.controller;

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

                // Mark as changed in chunk system
                if (controller && controller.chunkManager) {
                    controller.chunkManager.markChange(x, y);
                }

                // Ensure this pixel becomes active immediately
                if (window.ecosim && window.ecosim.activePixels) {
                    window.ecosim.activePixels.add(index);
                }
            }
        }
    },

    // Apply worm tool
    applyWormTool: function(x, y, index, intensity) {
        // Get reference to controller for chunk manager
        const controller = this.userInteraction.controller;

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

                // Mark as changed in chunk system
                if (controller && controller.chunkManager) {
                    controller.chunkManager.markChange(x, y);
                }

                // Ensure this pixel becomes active immediately
                if (window.ecosim && window.ecosim.activePixels) {
                    window.ecosim.activePixels.add(index);
                }
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

        // Get chunked ecosystem data if available
        let chunkedData = null;
        if (this.userInteraction.controller &&
            this.userInteraction.controller.chunkManager &&
            this.userInteraction.controller.chunkManager.chunkedEcosystem) {

            const chunkedEco = this.userInteraction.controller.chunkManager.chunkedEcosystem;
            chunkedData = {
                type: chunkedEco.typeArray[index],
                state: chunkedEco.stateArray[index],
                water: chunkedEco.waterArray[index],
                nutrient: chunkedEco.nutrientArray[index],
                energy: chunkedEco.energyArray[index],
                metadata: chunkedEco.metadataArray[index]
            };
        }

        // Log information about the observed pixel
        console.log("Observed pixel:", {
            position: { x, y },
            type: this.getTypeString(type),
            state: this.getStateString(state),
            water: water,
            nutrient: nutrient,
            energy: energy,
            chunkedData: chunkedData
        });

        // Future enhancement: show tooltip or info panel with this data
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