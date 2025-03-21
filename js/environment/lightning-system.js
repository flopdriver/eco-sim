// Lightning System
// Handles lightning strikes and fire propagation for ecosystem renewal

const LightningSystem = {
    // Reference to parent environment controller
    environment: null,

    // Lightning properties
    lightningProperties: {
        activeStrikes: [],     // Currently active lightning bolts
        maxActiveStrikes: 3,   // Maximum concurrent lightning bolts
        strikeProbability: 0.005, // Base chance of lightning per tick during storms
        boltLifetime: 8,       // How many frames a lightning bolt lasts
        strikeWidth: 2,        // Width of lightning bolt (pixels)
        strikeIntensity: 255,  // Maximum brightness of lightning
    },

    // Initialize lightning system
    init: function(environmentController) {
        this.environment = environmentController;
        console.log("Initializing lightning system...");
        return this;
    },

    // Update lightning effects
    updateLightning: function(nextActivePixels) {
        // Check for new lightning strikes
        this.generateLightning(nextActivePixels);

        // Update active lightning visuals
        this.updateLightningVisuals(nextActivePixels);
    },

    // Generate new lightning during appropriate weather
    generateLightning: function(nextActivePixels) {
        const weatherSystem = this.environment.weatherSystem;

        // Determine if conditions are right for lightning
        // Lightning happens during storms and some heavy rain
        let lightningChance = 0;

        if (weatherSystem.weatherPatterns.current === 'storm') {
            lightningChance = this.lightningProperties.strikeProbability * 5; // Highest in storms
        } else if (weatherSystem.weatherPatterns.current === 'heavyRain') {
            lightningChance = this.lightningProperties.strikeProbability; // Possible in heavy rain
        }

        // Additional chance during nighttime
        if (this.environment.dayNightCycle > 128) {
            lightningChance *= 1.5; // More lightning at night
        }

        // Check if we should generate lightning this frame
        if (Math.random() < lightningChance &&
            this.lightningProperties.activeStrikes.length < this.lightningProperties.maxActiveStrikes) {

            // Create a new lightning bolt
            this.createLightningStrike(nextActivePixels);
        }
    },

    // Create a new lightning strike
    createLightningStrike: function(nextActivePixels) {
        const core = this.environment.core;

        // Randomize starting position (near top of sky)
        const startX = Math.floor(Math.random() * core.width);
        const startY = Math.floor(core.height * 0.1) + Math.floor(Math.random() * (core.height * 0.1));

        // Calculate random path variations
        const jitter = 0.8; // How much the lightning can zigzag
        const direction = Math.random() < 0.5 ? -1 : 1; // Overall left or right bias
        const segments = 10 + Math.floor(Math.random() * 10); // Number of lightning segments

        // Create lightning bolt path
        const path = [];
        let currentX = startX;
        let currentY = startY;

        for (let i = 0; i < segments; i++) {
            // Add current point
            path.push({x: currentX, y: currentY});

            // Move downward with zigzag
            currentY += Math.floor((core.height - startY) / segments);
            currentX += direction * Math.floor(Math.random() * (jitter * 10)) - Math.floor(jitter * 5);

            // Keep within bounds
            currentX = Math.max(0, Math.min(core.width - 1, currentX));
        }

        // Add the new lightning bolt
        this.lightningProperties.activeStrikes.push({
            path: path,
            lifetime: this.lightningProperties.boltLifetime,
            width: this.lightningProperties.strikeWidth,
            intensity: this.lightningProperties.strikeIntensity,
            hasStruckTarget: false // Track if this bolt has hit something flammable
        });

        // Activate all pixels along the lightning path
        this.illuminateLightningPath(path, nextActivePixels);
    },

    // Illuminate the sky along the lightning path
    illuminateLightningPath: function(path, nextActivePixels) {
        const core = this.environment.core;

        // For each point in the path
        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];

            // Use Bresenham's line algorithm to get all pixels along this segment
            const points = this.getLinePoints(p1.x, p1.y, p2.x, p2.y);

            // Illuminate each point
            for (const point of points) {
                const index = core.getIndex(point.x, point.y);

                if (index !== -1) {
                    // Illuminate the sky with lightning
                    if (core.type[index] === this.environment.TYPE.AIR) {
                        // Add massive energy to the air - makes it bright
                        core.energy[index] = 255;

                        // Mark as active for rendering
                        nextActivePixels.add(index);
                    }
                    // Strike plants, water, or soil to potentially start fires
                    else if (!path[i].hasStruckTarget) {
                        if (core.type[index] === this.environment.TYPE.PLANT) {
                            // Lightning strikes plant - start a fire using fire system
                            if (this.environment.fireSystem) {
                                this.environment.fireSystem.startFire(index, nextActivePixels);
                                path[i].hasStruckTarget = true;
                            }
                        }
                        else if (core.type[index] === this.environment.TYPE.WATER ||
                            core.type[index] === this.environment.TYPE.SOIL) {
                            // Lightning strikes water or ground with no effect
                            path[i].hasStruckTarget = true;
                        }
                    }
                }
            }
        }
    },

    // Update lightning visuals (brightness fading)
    updateLightningVisuals: function(nextActivePixels) {
        // Update each active lightning strike
        for (let i = 0; i < this.lightningProperties.activeStrikes.length; i++) {
            const strike = this.lightningProperties.activeStrikes[i];

            // Decrease lifetime
            strike.lifetime--;

            // If expired, remove it
            if (strike.lifetime <= 0) {
                this.lightningProperties.activeStrikes.splice(i, 1);
                i--;
                continue;
            }

            // Make the lightning flicker
            if (strike.lifetime % 2 === 0) {
                this.illuminateLightningPath(strike.path, nextActivePixels);
            }
        }
    },

    // Helper method to get points along a line using Bresenham's algorithm
    getLinePoints: function(x0, y0, x1, y1) {
        const points = [];

        // Calculate absolute differences and direction
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;

        // Error term for Bresenham's algorithm
        let err = dx - dy;

        // Current position
        let x = x0;
        let y = y0;

        while (true) {
            // Add current point
            points.push({x, y});

            // Break if we've reached the end
            if (x === x1 && y === y1) break;

            // Calculate error for next step
            const e2 = 2 * err;

            // Update x if needed
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }

            // Update y if needed
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }

        return points;
    }
};