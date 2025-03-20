// Air Dynamics System
// Handles air movement, turbulence, and wind-like behaviors

const AirDynamicsSystem = {
    // Reference to parent physics system
    physics: null,

    // Air movement parameters
    windDirection: 0,     // 0-360 degrees, 0 = right, 90 = down, 180 = left, 270 = up
    windStrength: 0.5,    // 0-1 range, controls wind intensity
    turbulenceIntensity: 0.3, // 0-1 range, controls randomness of air movement
    airFlowRate: 1.0,     // Global multiplier for air movement speed

    // Initialize air dynamics system
    init: function(physicsSystem) {
        this.physics = physicsSystem;
        console.log("Initializing air dynamics system...");

        // Randomly initialize wind parameters
        this.randomizeWindParameters();

        return this;
    },

    // Randomize wind parameters periodically
    randomizeWindParameters: function() {
        // Random wind direction (0-360 degrees)
        this.windDirection = Math.random() * 360;

        // Random wind strength
        this.windStrength = Math.random() * 0.3; // Max 0.7 to keep movement subtle

        // Random turbulence intensity
        this.turbulenceIntensity = Math.random() * 0.4; // Max 0.4 to prevent too chaotic movement
    },

    // Update air movement
    updateAirDynamics: function(activePixels, nextActivePixels) {
        // Periodically randomize wind (every ~100 ticks on average)
        if (Math.random() < 0.01) {
            this.randomizeWindParameters();
        }

        // Collect air pixels
        const airPixels = [];
        activePixels.forEach(index => {
            if (this.physics.core.type[index] === this.physics.TYPE.AIR) {
                const coords = this.physics.core.getCoords(index);
                airPixels.push({index, x: coords.x, y: coords.y});
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

        // Can only move into another air or certain lightweight pixels
        if (newIndex !== -1) {
            const targetType = this.physics.core.type[newIndex];
            const movableTypes = [
                this.physics.TYPE.AIR,
                this.physics.TYPE.SEED,
                this.physics.TYPE.DEAD_MATTER
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
    }
};