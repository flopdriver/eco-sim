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

    // Fire properties
    fireProperties: {
        activeFires: new Set(), // Currently burning pixels
        spreadProbability: 0.08, // Chance of fire spreading to neighboring plants
        burnDuration: 60,      // How long a fire burns before dying out (frames)
        maxFireSize: 300,      // Limit total fire size to prevent excessive burning
        fireIntensity: 220,    // Fire visual intensity (0-255)
    },

    // Tracking for fire state in metadata
    // Format: 0-200 = burn progress (0=start, 200=finished)
    // We use this format to be compatible with the existing metadata array

    // Initialize lightning system
    init: function(environmentController) {
        this.environment = environmentController;
        console.log("Initializing lightning system...");
        return this;
    },

    // Update lightning and fire effects
    updateLightning: function(nextActivePixels) {
        // First handle ongoing fires
        this.updateFires(nextActivePixels);

        // Then check for new lightning strikes
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
                            // Lightning strikes plant - start a fire
                            this.startFire(index, nextActivePixels);
                            path[i].hasStruckTarget = true;
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

    // Start a fire at the given location
    startFire: function(index, nextActivePixels) {
        const core = this.environment.core;

        // Only start fires in plants
        if (core.type[index] !== this.environment.TYPE.PLANT) return;

        // Initialize fire state in metadata
        // Use metadata to track burn progress
        core.metadata[index] = 1; // Just starting to burn

        // Add to active fires set
        this.fireProperties.activeFires.add(index);

        // Add energy for fire visuals
        core.energy[index] = this.fireProperties.fireIntensity;

        // Generate some heat in air above for convection and visual effects
        this.addHeatToSurroundingAir(index, nextActivePixels);

        // Activate the pixel
        nextActivePixels.add(index);
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

                    // Random chance to create smoke (upward air movement)
                    if (dy < 0 && Math.random() < 0.1 * heatFactor) {
                        // Use water content to represent smoke density
                        core.water[airIndex] = Math.min(30, core.water[airIndex] + 10);
                    }

                    // Activate this air pixel
                    nextActivePixels.add(airIndex);
                }
            }
        }
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
            if (core.type[index] !== this.environment.TYPE.PLANT || burnProgress === 0) {
                firesToRemove.push(index);
                return;
            }

            // Update burn progress
            const newProgress = Math.min(200, burnProgress + 2);
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
            }

            // Keep fire pixel active
            nextActivePixels.add(index);
        });

        // Remove fires that are done
        firesToRemove.forEach(index => {
            this.fireProperties.activeFires.delete(index);
        });
    },

    // Spread fire to neighboring plants
    spreadFire: function(index, spreadRate, nextActivePixels) {
        const core = this.environment.core;
        const coords = core.getCoords(index);

        if (!coords) return;

        // Get burn progress - more advanced fires spread more
        const burnProgress = core.metadata[index];
        const isEstablishedFire = burnProgress > 50;

        // Fire spreads upward and sideways more easily than downward
        // Get neighbors with varying probabilities
        const neighbors = core.getNeighborIndices(coords.x, coords.y);

        for (const neighbor of neighbors) {
            // Only spread to plants that aren't already burning
            if (core.type[neighbor.index] === this.environment.TYPE.PLANT &&
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

                // Established fires spread more easily
                if (isEstablishedFire) {
                    directionalFactor *= 1.5;
                }

                // Calculate final spread chance
                const spreadChance = spreadRate * directionalFactor;

                // Try to spread fire with calculated probability
                if (Math.random() < spreadChance) {
                    this.startFire(neighbor.index, nextActivePixels);
                }
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