// Soil Moisture System
// Handles soil moisture movement and dynamics

const SoilMoistureSystem = {
    // Reference to parent physics system
    physics: null,

    // Configuration for soil moisture behavior
    soilTypeAffectsWaterMovement: true,
    wormTunnelsAffectDrainage: true,
    
    // Drainage rates for different soil types (higher = faster water movement)
    soilDrainageRates: {
        DEFAULT: 1.0,    // Standard soil
        CLAY: 0.4,       // Clay drains slowly
        SANDY: 2.5,      // Sandy soil drains quickly
        LOAMY: 1.5,      // Loamy soil has good drainage
        ROCKY: 1.8       // Rocky soil has fast drainage but low retention
    },

    // Soil layer probabilities by depth (starting from ground level)
    // These are configured to create realistic soil profiles
    soilLayerProbabilities: [
        // Topsoil (0-10 depth units)
        {
            DEFAULT: 0.2,
            LOAMY: 0.6,
            SANDY: 0.15,
            CLAY: 0.05,
            ROCKY: 0.0
        },
        // Subsoil (10-30 depth units)
        {
            DEFAULT: 0.1,
            LOAMY: 0.4,
            SANDY: 0.25,
            CLAY: 0.2,
            ROCKY: 0.05
        },
        // Deep soil (30+ depth units)
        {
            DEFAULT: 0.05,
            LOAMY: 0.15,
            SANDY: 0.3,
            CLAY: 0.2,
            ROCKY: 0.3
        }
    ],

    // Initialize soil moisture system
    init: function(physicsSystem) {
        this.physics = physicsSystem;
        console.log("Initializing soil moisture system...");
        return this;
    },

    // Determine soil layer type based on position and depth
    determineSoilLayer: function(x, y) {
        // Calculate ground level and depth
        const groundLevel = Math.floor(this.physics.core.height * 0.6);
        const depthFromSurface = y - groundLevel;
        
        // Get appropriate probability distribution based on depth
        let probabilities;
        if (depthFromSurface < 10) {
            probabilities = this.soilLayerProbabilities[0]; // Topsoil
        } else if (depthFromSurface < 30) {
            probabilities = this.soilLayerProbabilities[1]; // Subsoil
        } else {
            probabilities = this.soilLayerProbabilities[2]; // Deep soil
        }
        
        // Create deposit influence using Perlin-like noise function
        // Use different prime number multipliers to create varied patterns
        const noiseX = Math.sin(x * 0.053) * Math.cos(y * 0.071) * 50;
        const noiseY = Math.cos(x * 0.067) * Math.sin(y * 0.059) * 50;
        const depositNoise = (Math.sin(noiseX) + Math.cos(noiseY)) * 50 + 50; // 0-100 range
        
        // Create random soil pockets with varied sizes
        // Multiply by different primes to avoid repetition patterns
        const pocketSeed = Math.sin(x * 0.029 + y * 0.037) * 100;
        const smallDeposit = Math.abs(Math.sin(x * 0.13 + y * 0.17) * 100);
        const mediumDeposit = Math.abs(Math.cos(x * 0.07 + y * 0.11) * 100);
        const largeDeposit = Math.abs(Math.sin(x * 0.05 + y * 0.03) * 100);
        
        // Clay deposit influence (more common at certain depths)
        const clayInfluence = (depthFromSurface > 15 && depthFromSurface < 40) ? 
                            mediumDeposit * 0.3 : smallDeposit * 0.1;
                            
        // Sandy deposit influence (more common near surface and very deep)
        const sandyInfluence = (depthFromSurface < 12 || depthFromSurface > 35) ? 
                             largeDeposit * 0.3 : smallDeposit * 0.1;
                            
        // Rocky deposit influence (increases with depth)
        const rockyInfluence = depthFromSurface > 25 ? 
                             Math.min(100, mediumDeposit * (depthFromSurface / 60)) : 
                             smallDeposit * 0.05;
        
        // Adjust probabilities based on deposit influences
        // This creates "pockets" of different soil types
        let adjustedProbs = {...probabilities};
        
        // Clay pocket check
        if (clayInfluence > 60) {
            adjustedProbs.CLAY = Math.min(0.9, adjustedProbs.CLAY + 0.6);
            adjustedProbs.LOAMY = Math.max(0.05, adjustedProbs.LOAMY - 0.3);
            adjustedProbs.SANDY = Math.max(0.05, adjustedProbs.SANDY - 0.3);
        }
        
        // Sandy pocket check
        if (sandyInfluence > 65) {
            adjustedProbs.SANDY = Math.min(0.9, adjustedProbs.SANDY + 0.6);
            adjustedProbs.LOAMY = Math.max(0.05, adjustedProbs.LOAMY - 0.3);
            adjustedProbs.CLAY = Math.max(0.05, adjustedProbs.CLAY - 0.3);
        }
        
        // Rocky pocket check
        if (rockyInfluence > 70) {
            adjustedProbs.ROCKY = Math.min(0.9, adjustedProbs.ROCKY + 0.6);
            adjustedProbs.DEFAULT = Math.max(0.05, adjustedProbs.DEFAULT - 0.3);
            adjustedProbs.LOAMY = Math.max(0.05, adjustedProbs.LOAMY - 0.3);
        }
        
        // Hash function for consistent soil type selection
        // Use adjusted probabilities for more natural soil distribution
        const hash = (depositNoise + pocketSeed) % 100;
        
        // Use the hash to select a soil type based on adjusted probabilities
        let cumulativeProbability = 0;
        for (const [type, probability] of Object.entries(adjustedProbs)) {
            cumulativeProbability += probability * 100;
            if (hash < cumulativeProbability) {
                return this.physics.STATE[type];
            }
        }
        
        // Default fallback
        return this.physics.STATE.DEFAULT;
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

        // Get current soil state and moisture
        const currentState = this.physics.core.state[index];
        const currentWater = this.physics.core.water[index];
        
        // Get soil drainage rate based on soil type
        let drainageRate = 1.0; // Default rate
        
        if (this.soilTypeAffectsWaterMovement) {
            // Map state value to drainage rate, falling back to default if not found
            switch (currentState) {
                case this.physics.STATE.CLAY:
                    drainageRate = this.soilDrainageRates.CLAY;
                    break;
                case this.physics.STATE.SANDY:
                    drainageRate = this.soilDrainageRates.SANDY;
                    break;
                case this.physics.STATE.LOAMY:
                    drainageRate = this.soilDrainageRates.LOAMY;
                    break;
                case this.physics.STATE.ROCKY:
                    drainageRate = this.soilDrainageRates.ROCKY;
                    break;
                default:
                    drainageRate = this.soilDrainageRates.DEFAULT;
            }
            
            // Worm tunnels enhance drainage
            if (this.wormTunnelsAffectDrainage && 
                this.physics.core.state[index] === this.physics.STATE.FERTILE &&
                this.physics.core.metadata[index] > 0) {
                drainageRate *= 1.5; // 50% better drainage through worm tunnels
            }
        }

        // Water moves down through soil due to gravity (faster than sideways)
        // Soil also exchanges moisture with neighbors to balance levels
        // Check downward flow first (stronger than sideways)
        const downIndex = this.physics.core.getIndex(x, y + 1);

        if (downIndex !== -1 && this.physics.core.type[downIndex] === this.physics.TYPE.SOIL) {
            // Water flows from higher moisture to lower moisture (always some down bias)
            const moistureDiff = this.physics.core.water[index] - this.physics.core.water[downIndex];

            if (moistureDiff > 0) {
                // Transfer amount based on difference (faster transfer with bigger difference)
                // Modify transfer rate based on soil type drainage properties
                const transferAmount = Math.max(1, Math.floor((moistureDiff / 4) * drainageRate) + 1);

                // Update moisture levels
                this.physics.core.water[downIndex] += transferAmount;
                this.physics.core.water[index] -= transferAmount;

                // Update soil states
                this.updateSoilState(downIndex);
                this.updateSoilState(index);

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
                
                // Get neighbor soil type and drainage rate
                let neighborDrainageRate = 1.0;
                
                if (this.soilTypeAffectsWaterMovement) {
                    const neighborState = this.physics.core.state[neighborIndex];
                    
                    switch (neighborState) {
                        case this.physics.STATE.CLAY:
                            neighborDrainageRate = this.soilDrainageRates.CLAY;
                            break;
                        case this.physics.STATE.SANDY:
                            neighborDrainageRate = this.soilDrainageRates.SANDY;
                            break;
                        case this.physics.STATE.LOAMY:
                            neighborDrainageRate = this.soilDrainageRates.LOAMY;
                            break;
                        case this.physics.STATE.ROCKY:
                            neighborDrainageRate = this.soilDrainageRates.ROCKY;
                            break;
                        default:
                            neighborDrainageRate = this.soilDrainageRates.DEFAULT;
                    }
                    
                    // Worm tunnels enhance drainage in neighbor as well
                    if (this.wormTunnelsAffectDrainage && 
                        this.physics.core.state[neighborIndex] === this.physics.STATE.FERTILE &&
                        this.physics.core.metadata[neighborIndex] > 0) {
                        neighborDrainageRate *= 1.5;
                    }
                }

                // Balance moisture (slower than vertical flow)
                const moistureDiff = this.physics.core.water[index] - this.physics.core.water[neighborIndex];

                // Only balance if there's a significant difference
                if (Math.abs(moistureDiff) > 10) {
                    // Calculate average drainage rate between both soil types
                    const avgDrainageRate = (drainageRate + neighborDrainageRate) / 2;
                    
                    // Direction of transfer depends on moisture difference
                    if (moistureDiff > 0) {
                        // Transfer from this pixel to neighbor
                        const transferAmount = Math.max(1, Math.floor((moistureDiff / 8) * avgDrainageRate));

                        this.physics.core.water[neighborIndex] += transferAmount;
                        this.physics.core.water[index] -= transferAmount;

                        // Update soil states
                        this.updateSoilState(neighborIndex);
                        this.updateSoilState(index);
                    } else {
                        // Transfer from neighbor to this pixel
                        const transferAmount = Math.max(1, Math.floor((-moistureDiff / 8) * avgDrainageRate));

                        this.physics.core.water[index] += transferAmount;
                        this.physics.core.water[neighborIndex] -= transferAmount;

                        // Update soil states
                        this.updateSoilState(index);
                        this.updateSoilState(neighborIndex);
                    }

                    nextActivePixels.add(neighborIndex);
                }
            }
        }

        // If soil still has significant moisture, keep it active
        if (this.physics.core.water[index] > 20) {
            nextActivePixels.add(index);
        }
    },
    
    // Update soil state based on water content
    updateSoilState: function(index) {
        // Skip if not soil
        if (this.physics.core.type[index] !== this.physics.TYPE.SOIL) return;
        
        // Get current state and water level
        const currentState = this.physics.core.state[index];
        const waterLevel = this.physics.core.water[index];
        
        // Keep layer type states (CLAY, SANDY, LOAMY, ROCKY) when updating moisture state
        // Only update WET/DRY status if it's a basic soil type
        const isSoilLayer = currentState === this.physics.STATE.CLAY || 
                         currentState === this.physics.STATE.SANDY ||
                         currentState === this.physics.STATE.LOAMY ||
                         currentState === this.physics.STATE.ROCKY;
        
        // Don't override existing special soil types with basic WET/DRY states
        if (!isSoilLayer && currentState !== this.physics.STATE.FERTILE) {
            if (waterLevel > 20) {
                this.physics.core.state[index] = this.physics.STATE.WET;
            } else if (currentState !== this.physics.STATE.FERTILE) {
                this.physics.core.state[index] = this.physics.STATE.DRY;
            }
        }
    }
};

// Allow module export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoilMoistureSystem;
}