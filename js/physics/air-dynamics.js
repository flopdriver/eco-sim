// Air Dynamics System
// Handles air movement, turbulence, and wind-like behaviors

const AirDynamicsSystem = {
    // Reference to parent physics system
    physics: null,

    // Air movement parameters
    windDirection: 0,     // 0-360 degrees, 0 = right, 90 = down, 180 = left, 270 = up
    windStrength: 0.7,    // 0-1 range, controls wind intensity
    turbulenceIntensity: 0.3, // 0-1 range, controls randomness of air movement
    airFlowRate: 2.5,     // Global multiplier for air movement speed

    // Current frame count for timing operations
    frameCount: 0,

    // Initialize air dynamics system
    init: function(physicsSystem) {
        this.physics = physicsSystem;
        console.log("Initializing air dynamics system...");

        // Initialize with more stable wind parameters
        this.initializeStableWindParameters();

        return this;
    },

    // Initialize wind parameters with stronger horizontal movement
    initializeStableWindParameters: function() {
        // Set wind to blow more horizontally with slight downward component
        this.windDirection = 45 + (Math.random() * 30); // 45-75 degrees, much more horizontal

        // Strong wind strength
        this.windStrength = 0.6; // Strong to move water effectively sideways

        // Moderate turbulence
        this.turbulenceIntensity = 0.3; // More variation to prevent stagnation
    },

    // Randomize wind parameters periodically with stronger horizontal bias
    randomizeWindParameters: function() {
        // Predominantly horizontal wind with bias to right or left
        // Either 0-60 degrees (right with down) or 120-180 degrees (left with down)
        this.windDirection = Math.random() < 0.5 ?
            (Math.random() * 60) : // Right-biased: 0-60 degrees
            (120 + Math.random() * 60); // Left-biased: 120-180 degrees

        // Strong wind strength with good variation
        this.windStrength = 0.4 + Math.random() * 0.4; // 0.4-0.8 range for strong movement

        // Higher turbulence intensity for more dynamic movement
        this.turbulenceIntensity = 0.2 + Math.random() * 0.3; // 0.2-0.5 for dynamic movement
    },

    // Update air movement
    updateAirDynamics: function(activePixels, nextActivePixels) {
        // Increment frame count
        this.frameCount++;
        
        // Periodically randomize wind (every ~100 ticks on average)
        if (Math.random() < 0.01) {
            this.randomizeWindParameters();
        }

        // Collect air pixels, prioritizing those above ground
        const airPixels = [];

        activePixels.forEach(index => {
            if (this.physics.core.type[index] === this.physics.TYPE.AIR) {
                const coords = this.physics.core.getCoords(index);
                
                // Get the actual ground level at this x position
                const groundLevel = this.getSoilHeight(coords.x);

                // Only process air pixels that are above ground level
                // This prevents air bubble creation below the soil line
                if (coords.y <= groundLevel) {
                    airPixels.push({index, x: coords.x, y: coords.y});
                }
            }
        });

        // Process air pixels with wind and turbulence
        for (const pixel of airPixels) {
            // Skip if already processed
            if (this.physics.processedThisFrame[pixel.index]) continue;

            this.physics.processedThisFrame[pixel.index] = 1;
            this.updateSingleAirPixel(pixel.x, pixel.y, pixel.index, nextActivePixels);
        }
    },

    // Update a single air pixel with wind and turbulence
    updateSingleAirPixel: function(x, y, index, nextActivePixels) {
        // Get the actual ground level at this x position
        const groundLevel = this.getSoilHeight(x);

        // Check if this air is below ground level (should never be the case now with our filter)
        const isBelowGround = y > groundLevel;

        // For air above ground, use normal wind dynamics
        // Check if we should process this air pixel
        // Increased chance of moving to create more active wind
        if (Math.random() > 0.6) { // Increased from 0.3 to 0.6 (doubled)
            nextActivePixels.add(index);
            return;
        }

        // Calculate wind movement based on wind direction and strength
        const windVector = this.calculateWindVector();

        // Add some turbulence
        const turbulenceVector = this.calculateTurbulenceVector();

        // Combine wind and turbulence
        const dx = Math.floor(windVector.x + turbulenceVector.x);
        const dy = Math.floor(windVector.y + turbulenceVector.y);

        const newX = x + dx;
        const newY = y + dy;
        const newIndex = this.physics.core.getIndex(newX, newY);

        if (newIndex !== -1) {
            const targetType = this.physics.core.type[newIndex];

            // ABOVE GROUND BEHAVIOR: Normal air movement rules
            const movableTypes = [
                this.physics.TYPE.AIR,
                this.physics.TYPE.SEED,
                this.physics.TYPE.DEAD_MATTER,
                this.physics.TYPE.WATER // Allow air to push water
            ];

            // First check if target is a plant - protect all plant types
            if (targetType === this.physics.TYPE.PLANT) {
                // Leaves can rustle in the wind (activate but don't move)
                if (this.physics.core.state[newIndex] === this.physics.STATE.LEAF &&
                    Math.random() < 0.3) {
                    // Make the leaf active but don't move it - simulate leaf rustle
                    nextActivePixels.add(newIndex);
                    nextActivePixels.add(index);
                    return;
                }
                // All other plant parts should be completely protected from air movement
                nextActivePixels.add(index); // Keep air active
                return; // Exit without moving the air into the plant
            }

            if (movableTypes.includes(targetType)) {
                // Special case for water - greatly enhance wind's ability to push water horizontally
                // This helps water move in the sky and prevents it from stacking up
                if (targetType === this.physics.TYPE.WATER) {
                    // If water is above ground, prioritize horizontal movement
                    if (newY < groundLevel) {
                        // Check if movement is mostly horizontal
                        if (Math.abs(dx) >= Math.abs(dy)) {
                            // Almost always allow horizontal movement (90% chance)
                            if (Math.random() < 0.9) {
                                // Increase movement effectiveness by potentially moving water further
                                // (Additional horizontal push will happen in the swap below)
                            } else {
                                nextActivePixels.add(index);
                                nextActivePixels.add(newIndex);
                                return;
                            }
                        }
                        // For diagonal movement, still good chance to move
                        else if (Math.abs(dx) > 0) {
                            if (Math.random() < 0.7) {
                                // Continue to swap operation
                            } else {
                                nextActivePixels.add(index);
                                nextActivePixels.add(newIndex);
                                return;
                            }
                        }
                    }

                    // If air is pushing water upward, still limit but allow some movement
                    if (dy < 0) {
                        if (Math.random() < 0.03) { // Reduce upward probability slightly
                            // Continue to the swap operation below
                        } else {
                            nextActivePixels.add(index);
                            nextActivePixels.add(newIndex);
                            return;
                        }
                    }
                }

                // Swap pixels
                this.physics.core.swapPixels(index, newIndex);

                // Mark both pixels as active
                nextActivePixels.add(index);
                nextActivePixels.add(newIndex);

                return;
            }
        }

        // If can't move, still keep air pixel active with some chance of slight movement
        if (Math.random() < 0.1) {
            // Small random jitter
            const jitterDx = Math.random() < 0.5 ? -1 : 1;
            const jitterDy = Math.random() < 0.5 ? -1 : 1;
            const jitterX = x + jitterDx;
            const jitterY = y + jitterDy;
            const jitterIndex = this.physics.core.getIndex(jitterX, jitterY);

            if (jitterIndex !== -1 && this.physics.core.type[jitterIndex] === this.physics.TYPE.AIR) {
                this.physics.core.swapPixels(index, jitterIndex);
                nextActivePixels.add(index);
                nextActivePixels.add(jitterIndex);
            } else {
                // Keep air pixel active
                nextActivePixels.add(index);
            }
        } else {
            // Keep air pixel active
            nextActivePixels.add(index);
        }
    },

    // Calculate wind vector based on wind direction and strength
    calculateWindVector: function() {
        // Convert wind direction to radians
        const radians = this.windDirection * (Math.PI / 180);

        // Calculate x and y components with airFlowRate modifier
        const x = Math.cos(radians) * this.windStrength * this.airFlowRate;
        const y = Math.sin(radians) * this.windStrength * this.airFlowRate;

        return { x, y };
    },

    // Calculate turbulence vector for randomness
    calculateTurbulenceVector: function() {
        // Create some randomness based on turbulence intensity
        const maxTurbulence = this.turbulenceIntensity * 2;
        const x = (Math.random() * maxTurbulence) - maxTurbulence / 2;
        const y = (Math.random() * maxTurbulence) - maxTurbulence / 2;

        return { x, y };
    },

    // Get soil height at a specific x coordinate
    getSoilHeight: function(x) {
        return this.physics.core.getSoilHeight(x, this.frameCount);
    }
};