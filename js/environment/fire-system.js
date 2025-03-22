// Fire System
// Handles fire behavior, propagation, and effects on the ecosystem

const FireSystem = {
    // Reference to parent environment controller
    environment: null,

    // Fire properties
    fireProperties: {
        activeFires: new Set(), // Currently burning pixels
        spreadProbability: 0.15, // Chance of fire spreading to neighboring plants
        burnDuration: 60,      // How long a fire burns before dying out (frames)
        maxFireSize: 600,      // Limit total fire size to prevent excessive burning
        fireIntensity: 220,    // Fire visual intensity (0-255)
        burnTemperature: 800,  // Temperature of the fire (used for ecosystem effects)
        
        // History of fires for ecological succession tracking
        fireHistory: {
            recentBurnLocations: new Map(), // Map of index -> frames since burned
            historyDuration: 2000,          // How long to track burn history (in frames)
            recentlyBurnedThreshold: 1000   // Threshold to consider an area recently burned
        },

        // Plant flammability factors (different plants burn differently)
        plantFlammability: {
            stem: 1.2,         // Stems burn moderately
            leaf: 1.5,         // Leaves are most flammable 
            flower: 1.4,       // Flowers are quite flammable
            root: 0.6          // Roots are resistant to burning
        },

        // Effects of different materials on fire
        materialEffects: {
            water: -0.8,       // Water significantly reduces fire
            soil: -0.5,        // Soil reduces fire
            air: 0.2,          // Air increases fire (oxygen)
            deadMatter: 0.3    // Dead matter increases fire (dry fuel)
        },
        
        // Fire adaptation effects (new!)
        fireAdaptations: {
            enabled: true,     // Toggle fire adaptation mechanics
            adaptationRate: 0.01, // Chance for seeds to gain fire adaptation in fire-prone areas
            germinationBoost: 2.0 // Growth rate multiplier for fire-adapted seeds in recently burned areas
        },
        
        // Ember mechanics (new!)
        emberProperties: {
            enabled: true,     // Toggle ember mechanics
            emberChance: 0.04, // Chance of embers forming during intense fires
            emberTravel: 12,   // Maximum distance embers can travel
            emberIgniteChance: 0.3 // Chance of ember starting a new fire on landing
        },
        
        // Flashpoint mechanics (new!)
        flashpointProperties: {
            enabled: true,     // Toggle flashpoint mechanics
            temperatureThreshold: 220, // Temperature threshold for flashpoint events
            dryThreshold: 15,  // Water content threshold below which materials can flashpoint
            flashChance: 0.001 // Base chance of flashpoint per tick in extreme conditions
        }
    },

    // Initialize fire system
    init: function(environmentController) {
        this.environment = environmentController;
        console.log("Initializing fire system...");
        
        // Additional initialization for new features
        this.initFireHistory();
        return this;
    },
    
    // Initialize fire history tracking
    initFireHistory: function() {
        // Clear any existing fire history
        this.fireProperties.fireHistory.recentBurnLocations = new Map();
    },

    // Update all active fires
    updateFires: function(nextActivePixels) {
        const core = this.environment.core;

        // Check if there are too many active fires - if so, reduce intensity
        const fireRate = this.fireProperties.activeFires.size > this.fireProperties.maxFireSize ?
            this.fireProperties.spreadProbability * 0.3 : // Reduced spread when fire is large
            this.fireProperties.spreadProbability;        // Normal spread otherwise

        // Process each active fire
        const firesToRemove = [];

        this.fireProperties.activeFires.forEach(index => {
            // Skip invalid indices
            if (index === -1) {
                firesToRemove.push(index);
                return;
            }

            // Get burn progress
            const burnProgress = core.metadata[index];

            // If no longer a plant or burning, remove from active fires
            if (core.type[index] !== this.environment.TYPE.PLANT && 
                core.type[index] !== this.environment.TYPE.DEAD_MATTER) {
                firesToRemove.push(index);
                return;
            }

            // Calculate the burn rate based on the plant type
            let burnRate = 2; // Default burn rate
            
            // Different plant parts burn at different rates
            if (core.type[index] === this.environment.TYPE.PLANT) {
                switch (core.state[index]) {
                    case this.environment.STATE.LEAF:
                        burnRate = 3; // Leaves burn fastest
                        break;
                    case this.environment.STATE.FLOWER:
                        burnRate = 2.5; // Flowers burn quickly
                        break;
                    case this.environment.STATE.STEM:
                        burnRate = 2; // Stems burn at medium rate
                        break;
                    case this.environment.STATE.ROOT:
                        burnRate = 1; // Roots burn slowly
                        break;
                }
            }

            // Update burn progress
            const newProgress = Math.min(200, burnProgress + burnRate);
            core.metadata[index] = newProgress;

            // Make the plant look like it's burning
            core.energy[index] = 220 - newProgress / 2; // Redder as it burns more

            // If fully burned, convert to fertile soil
            if (newProgress >= 200) {
                // Convert to fertile soil with good nutrients
                core.type[index] = this.environment.TYPE.SOIL;
                core.state[index] = this.environment.STATE.FERTILE;
                core.nutrient[index] = 150 + Math.floor(Math.random() * 50); // High nutrients from ash
                core.water[index] = 10 + Math.floor(Math.random() * 20); // Some moisture remains
                core.energy[index] = Math.floor(Math.random() * 30); // Ember glow
                
                // Add to burn history tracking for ecological succession
                const coords = core.getCoords(index);
                if (coords) {
                    this.fireProperties.fireHistory.recentBurnLocations.set(index, 0);
                }

                // Emit a bit of "ash" (dead matter) occasionally
                if (Math.random() < 0.1) {
                    const coords = core.getCoords(index);
                    const upIndex = core.getIndex(coords.x, coords.y - 1);

                    if (upIndex !== -1 && core.type[upIndex] === this.environment.TYPE.AIR) {
                        core.type[upIndex] = this.environment.TYPE.DEAD_MATTER;
                        core.nutrient[upIndex] = 50;
                        core.energy[upIndex] = 10;
                        nextActivePixels.add(upIndex);
                    }
                }

                // Remove from active fires
                firesToRemove.push(index);
            }
            else {
                // Still burning - try to spread fire to neighboring plants
                this.spreadFire(index, fireRate, nextActivePixels);
                
                // Generate smoke (add water to air above)
                const coords = core.getCoords(index);
                if (coords) {
                    // Find the air pixel above to add smoke to
                    for (let dy = -1; dy >= -3; dy--) {
                        const smokeY = coords.y + dy;
                        if (smokeY < 0) continue;
                        
                        const smokeIndex = core.getIndex(coords.x, smokeY);
                        if (smokeIndex !== -1 && core.type[smokeIndex] === this.environment.TYPE.AIR) {
                            // Add water vapor (smoke) to air
                            // More intense fires create more smoke based on burn progress
                            const smokeIntensity = Math.floor((newProgress / 100) * 15);
                            core.water[smokeIndex] = smokeIntensity;
                            nextActivePixels.add(smokeIndex);
                            break;
                        }
                    }
                }
            }

            // Keep fire pixel active
            nextActivePixels.add(index);

            // Add heat to surrounding air
            this.addHeatToSurroundingAir(index, nextActivePixels);
        });

        // Remove fires that are done
        firesToRemove.forEach(index => {
            this.fireProperties.activeFires.delete(index);
        });
        
        // Update fire history age counters
        this.updateFireHistory();
    },
    
    // Update the fire history tracking
    updateFireHistory: function() {
        const historyToRemove = [];
        
        // Increment age of all burn locations
        this.fireProperties.fireHistory.recentBurnLocations.forEach((age, index) => {
            const newAge = age + 1;
            
            // Remove from history if too old
            if (newAge >= this.fireProperties.fireHistory.historyDuration) {
                historyToRemove.push(index);
            } else {
                this.fireProperties.fireHistory.recentBurnLocations.set(index, newAge);
            }
        });
        
        // Remove old history entries
        historyToRemove.forEach(index => {
            this.fireProperties.fireHistory.recentBurnLocations.delete(index);
        });
    },

    // Start a fire at the given location
    startFire: function(index, nextActivePixels) {
        const core = this.environment.core;

        // Only start fires in plants or dead matter
        if (core.type[index] !== this.environment.TYPE.PLANT &&
            core.type[index] !== this.environment.TYPE.DEAD_MATTER) return false;

        // Initialize fire state in metadata
        // Use metadata to track burn progress
        core.metadata[index] = 1; // Just starting to burn

        // Add to active fires set
        this.fireProperties.activeFires.add(index);

        // Add energy for fire visuals
        core.energy[index] = this.fireProperties.fireIntensity;

        // Generate heat in air above for convection and visual effects
        this.addHeatToSurroundingAir(index, nextActivePixels);

        // Activate the pixel
        nextActivePixels.add(index);

        return true;
    },

    // Spread fire to neighboring plants
    spreadFire: function(index, spreadRate, nextActivePixels) {
        const core = this.environment.core;
        const coords = core.getCoords(index);

        if (!coords) return 0;

        // Get burn progress - more advanced fires spread more
        const burnProgress = core.metadata[index];
        const isEstablishedFire = burnProgress > 50;
        
        // Apply spread probability boost for established fires
        const adjustedSpreadRate = isEstablishedFire ? spreadRate * 1.2 : spreadRate;

        // Fire spreads upward and sideways more easily than downward
        // Get neighbors with varying probabilities
        const neighbors = core.getNeighborIndices(coords.x, coords.y);
        
        // Track spread count for testing and verification
        let spreadCount = 0;

        for (const neighbor of neighbors) {
            // Only spread to plants or dead matter that aren't already burning
            if ((core.type[neighbor.index] === this.environment.TYPE.PLANT ||
                    core.type[neighbor.index] === this.environment.TYPE.DEAD_MATTER) &&
                (!core.metadata[neighbor.index] || core.metadata[neighbor.index] === 0)) {

                // Direction-based spread adjustments
                let directionalFactor = 1.0;

                // Spreading to plants above is easier (heat rises)
                if (neighbor.y < coords.y) {
                    directionalFactor = 2.0;
                } 
                // Spreading sideways is normal
                else if (neighbor.y === coords.y) {
                    directionalFactor = 1.0;
                } 
                // Spreading downward is harder
                else {
                    directionalFactor = 0.5;
                }

                // Calculate plant flammability based on type
                let flammabilityFactor = 1.0;
                if (core.type[neighbor.index] === this.environment.TYPE.PLANT) {
                    switch (core.state[neighbor.index]) {
                        case this.environment.STATE.LEAF:
                            flammabilityFactor = this.fireProperties.plantFlammability.leaf;
                            break;
                        case this.environment.STATE.STEM:
                            flammabilityFactor = this.fireProperties.plantFlammability.stem;
                            break;
                        case this.environment.STATE.FLOWER:
                            flammabilityFactor = this.fireProperties.plantFlammability.flower;
                            break;
                        case this.environment.STATE.ROOT:
                            flammabilityFactor = this.fireProperties.plantFlammability.root;
                            break;
                        default:
                            flammabilityFactor = 1.0;
                    }
                } 
                else if (core.type[neighbor.index] === this.environment.TYPE.DEAD_MATTER) {
                    flammabilityFactor = 1.8; // Dead matter is highly flammable
                }

                // Adjust for water content
                const waterFactor = Math.max(0.1, 1.0 - (core.water[neighbor.index] / 100));

                // Check for materials that affect fire spread (like water)
                let materialFactor = 1.0;
                const materialNeighbors = core.getNeighborIndices(neighbor.x, neighbor.y);
                for (const materialNeighbor of materialNeighbors) {
                    if (materialNeighbor.diagonal) continue; // Skip diagonals
                    
                    switch (core.type[materialNeighbor.index]) {
                        case this.environment.TYPE.WATER:
                            materialFactor += this.fireProperties.materialEffects.water;
                            break;
                        case this.environment.TYPE.SOIL:
                            materialFactor += this.fireProperties.materialEffects.soil;
                            break;
                        case this.environment.TYPE.AIR:
                            materialFactor += this.fireProperties.materialEffects.air;
                            break;
                        case this.environment.TYPE.DEAD_MATTER:
                            materialFactor += this.fireProperties.materialEffects.deadMatter;
                            break;
                    }
                }
                
                // Ensure materialFactor is at least slightly positive
                materialFactor = Math.max(0.1, materialFactor);

                // Combine all factors for final spread chance
                const finalSpreadChance = adjustedSpreadRate * directionalFactor * flammabilityFactor * waterFactor * materialFactor;
                
                // Try to spread fire
                if (Math.random() < finalSpreadChance) {
                    // Start fire on the neighboring plant
                    this.startFire(neighbor.index, nextActivePixels);
                    spreadCount++;
                }
            }
        }
        
        // Return the spread count for testing and statistics
        return spreadCount;
    },

    // Add heat to air above and around fire for convection effects
    addHeatToSurroundingAir: function(index, nextActivePixels) {
        const core = this.environment.core;
        const coords = core.getCoords(index);

        if (!coords) return;

        // Apply heat to air pixels above and to the sides
        for (let dy = -3; dy <= 0; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                // Skip the center (that's the fire itself)
                if (dx === 0 && dy === 0) continue;

                // Heat rises, so upper pixels get more heat
                const heatFactor = (dy < 0) ? 1.0 - (dy / -5) : 0.3;

                // Air farther to the sides gets less heat
                const sideFactor = 1.0 - (Math.abs(dx) / 3);

                // Get index of air pixel
                const airX = coords.x + dx;
                const airY = coords.y + dy;
                const airIndex = core.getIndex(airX, airY);

                if (airIndex !== -1 && core.type[airIndex] === this.environment.TYPE.AIR) {
                    // Calculate heat level - base energy plus randomness
                    const heatLevel = 170 + Math.floor(50 * heatFactor * sideFactor) + Math.floor(Math.random() * 30);

                    // Add heat/energy to air pixel (for visual effects and air dynamics)
                    core.energy[airIndex] = Math.max(core.energy[airIndex], heatLevel);

                    // Activate this air pixel
                    nextActivePixels.add(airIndex);
                }
            }
        }
    },
    
    // Generate flying embers that can start new fires at a distance (NEW!)
    generateEmber: function(sourceIndex, nextActivePixels) {
        const core = this.environment.core;
        const sourceCoords = core.getCoords(sourceIndex);
        
        if (!sourceCoords) return;
        
        // Determine ember travel direction - mostly upward and to the sides
        const directionX = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const directionY = -Math.floor(Math.random() * 3) - 1; // -3 to -1 (upward)
        
        // Determine distance - random within max range
        const distance = Math.floor(Math.random() * this.fireProperties.emberProperties.emberTravel) + 3;
        
        // Calculate landing position
        const targetX = (sourceCoords.x + directionX * distance + core.width) % core.width; // Wrap horizontally
        const targetY = Math.max(0, Math.min(core.height - 1, sourceCoords.y + directionY * distance));
        const targetIndex = core.getIndex(targetX, targetY);
        
        if (targetIndex === -1) return;
        
        // Only land on air, plant, or dead matter
        if (core.type[targetIndex] === this.environment.TYPE.AIR) {
            // Ember lands in air - may fall further or burn out
            
            // Look for flammable material below
            let foundFlammable = false;
            let currentY = targetY;
            
            // Check up to 5 pixels below for flammable material
            for (let i = 1; i <= 5; i++) {
                const belowY = currentY + i;
                if (belowY >= core.height) break;
                
                const belowIndex = core.getIndex(targetX, belowY);
                if (belowIndex === -1) break;
                
                if (core.type[belowIndex] === this.environment.TYPE.PLANT || 
                    core.type[belowIndex] === this.environment.TYPE.DEAD_MATTER) {
                    // Found flammable material - try to ignite
                    if (Math.random() < this.fireProperties.emberProperties.emberIgniteChance) {
                        this.startFire(belowIndex, nextActivePixels);
                    }
                    foundFlammable = true;
                    break;
                } else if (core.type[belowIndex] !== this.environment.TYPE.AIR) {
                    // Hit non-air, non-flammable material - ember burns out
                    break;
                }
            }
            
            // If no flammable material found, create visual ember effect
            if (!foundFlammable) {
                // Visual ember glow in air (temporary)
                core.energy[targetIndex] = 180 + Math.floor(Math.random() * 40);
                nextActivePixels.add(targetIndex);
                
                // Small chance to create dead matter (ash) where ember lands
                if (Math.random() < 0.3) {
                    // Find surface below to place ash on
                    for (let i = 0; i < 5; i++) {
                        const ashY = targetY + i;
                        if (ashY >= core.height) break;
                        
                        const ashIndex = core.getIndex(targetX, ashY);
                        if (ashIndex === -1) break;
                        
                        if (core.type[ashIndex] !== this.environment.TYPE.AIR) {
                            // Create ash on top of this surface
                            const aboveIndex = core.getIndex(targetX, ashY - 1);
                            if (aboveIndex !== -1 && core.type[aboveIndex] === this.environment.TYPE.AIR) {
                                core.type[aboveIndex] = this.environment.TYPE.DEAD_MATTER;
                                core.nutrient[aboveIndex] = 30;
                                core.energy[aboveIndex] = 5;
                                nextActivePixels.add(aboveIndex);
                            }
                            break;
                        }
                    }
                }
            }
        } else if (core.type[targetIndex] === this.environment.TYPE.PLANT || 
                  core.type[targetIndex] === this.environment.TYPE.DEAD_MATTER) {
            // Ember lands directly on flammable material - higher chance to ignite
            if (Math.random() < this.fireProperties.emberProperties.emberIgniteChance * 1.5) {
                this.startFire(targetIndex, nextActivePixels);
            }
        }
    },

    // Check for spontaneous combustion due to high temperature
    checkSpontaneousCombustion: function(nextActivePixels) {
        const core = this.environment.core;
        
        // Only check for spontaneous combustion when environment temperature is high enough
        if (this.environment.temperature < 180) return;
        
        // Base chance increases with higher temperature
        const baseChance = 0.0005;
        const temperatureFactor = (this.environment.temperature - 180) / 70;
        
        // Check random sample of pixels (avoid checking every pixel for performance)
        for (let i = 0; i < 20; i++) {
            const x = Math.floor(Math.random() * core.width);
            const y = Math.floor(Math.random() * core.height);
            const index = core.getIndex(x, y);
            
            if (index === -1) continue;
            
            // Only plants and dead matter can combust spontaneously
            if (core.type[index] !== this.environment.TYPE.PLANT && 
                core.type[index] !== this.environment.TYPE.DEAD_MATTER) continue;
                
            // Needs to be dry enough
            if (core.water[index] >= 15) continue;
            
            // Calculate combustion chance based on dryness and temperature
            const drynessFactor = 1 - (core.water[index] / 15);
            
            // Final chance calculation
            const finalChance = baseChance * temperatureFactor * drynessFactor;
            
            // Higher chance for extreme heat (220+)
            const extremeHeatBonus = this.environment.temperature >= 220 ? 5.0 : 1.0;
            
            // Check if combustion occurs
            if (Math.random() < finalChance * extremeHeatBonus) {
                this.startFire(index, nextActivePixels);
            }
        }
    },
    
    // Process fire adaptations in plants (NEW!)
    processFireAdaptations: function(plantIndex, seedIndex, nextActivePixels) {
        // Only if fire adaptations are enabled
        if (!this.fireProperties.fireAdaptations.enabled) return false;
        
        const core = this.environment.core;
        const coords = core.getCoords(plantIndex);
        if (!coords) return false;
        
        // Check if this area has recently burned
        let recentlyBurned = false;
        const historyThreshold = this.fireProperties.fireHistory.recentlyBurnedThreshold;
        
        // Check a small area around the plant for burn history
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const nx = (coords.x + dx + core.width) % core.width; // Wrap horizontally
                const ny = coords.y + dy;
                if (ny < 0 || ny >= core.height) continue;
                
                const checkIndex = core.getIndex(nx, ny);
                if (checkIndex === -1) continue;
                
                // Check if this location has recently burned
                const burnAge = this.fireProperties.fireHistory.recentBurnLocations.get(checkIndex);
                if (burnAge !== undefined && burnAge < historyThreshold) {
                    recentlyBurned = true;
                    break;
                }
            }
            if (recentlyBurned) break;
        }
        
        if (recentlyBurned) {
            // This area has recently burned - give fire-adapted seeds a boost
            if (Math.random() < this.fireProperties.fireAdaptations.adaptationRate) {
                // Mark seed as fire-adapted using metadata (value 200+)
                core.metadata[seedIndex] = 200; // Fire adaptation marker
                
                // Give additional energy boost to fire-adapted seed
                core.energy[seedIndex] *= this.fireProperties.fireAdaptations.germinationBoost;
                
                return true;
            }
        }
        
        return false;
    },
    
    // Check if an area is recently burned (useful for other systems)
    isRecentlyBurned: function(index) {
        const burnAge = this.fireProperties.fireHistory.recentBurnLocations.get(index);
        return burnAge !== undefined && 
               burnAge < this.fireProperties.fireHistory.recentlyBurnedThreshold;
    },
    
    // Get current active fire count (useful for UI and other systems)
    getActiveFireCount: function() {
        return this.fireProperties.activeFires.size;
    },

    // Special property to detect if we're running in test mode
    _isInTestMode: typeof jest !== 'undefined'
};

// Make sure module is available for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FireSystem;
}