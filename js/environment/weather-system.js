// Weather System
// Handles weather phenomena like rain and sky representation

const WeatherSystem = {
    // Reference to parent environment controller
    environment: null,

    // Cloud properties
    cloudProperties: {
        cloudiness: 0,         // 0-1 range representing cloud coverage
        cloudPixels: [],       // Actual cloud pixels
        maxCloudWidth: 0,      // Maximum width of clouds
        cloudColor: null,      // Base cloud color
        upperLayerColor: null, // Upper layer cloud color
        lowerLayerColor: null, // Lower layer cloud color
        movementSpeed: 0.5,    // Cloud movement speed
        cloudDensity: 5.9      // Cloud density factor
    },

    // Rain properties - dramatically enhanced for Jumanji-style downpours
    rainProperties: {
        intensity: 1,          // 0-1 range representing rain intensity
        droplets: [],          // Array to store active rain droplets
        maxDropletsPerTick: 0, // Maximum number of droplets per tick
        dropletSizes: {        // Different droplet size configurations (massively increased for Jumanji effect)
            small: { water: 200, speed: 200, probability: 0.3 },
            medium: { water: 300, speed: 300, probability: 0.4 },
            large: { water: 400, speed: 400, probability: 0.3 }  // Increased large droplet probability
        },
        splashEnabled: true    // Enable water splash effects
    },

    // Weather patterns
    weatherPatterns: {
        current: 'clear',      // Current weather pattern
        duration: 0,           // Duration of current pattern
        transitionSpeed: 0.02, // Speed of transitions between patterns
        patterns: {
            clear: { cloudiness: 0.2, rainProbability: 0.5 },
            partlyCloudy: { cloudiness: 0.5, rainProbability: 0.6 },
            overcast: { cloudiness: 0.8, rainProbability: 0.9 },
            lightRain: { cloudiness: 0.7, rainProbability: 1.0 },
            heavyRain: { cloudiness: 0.9, rainProbability: 1.0 },
            storm: { cloudiness: 1.0, rainProbability: 1.0 }
        }
    },

    // Initialize weather system
    init: function(environmentController) {
        console.log("Initializing weather system...");
        
        if (!environmentController) {
            console.error("Weather system init failed: environment controller is missing");
            return null;
        }
        
        if (!environmentController.core) {
            console.error("Weather system init failed: core object is missing from environment controller");
            return null;
        }
        
        if (!environmentController.core.getIndex) {
            console.error("Weather system init failed: core object missing getIndex method");
            return null;
        }
        
        this.environment = environmentController;

        // Set maximum cloud width based on simulation width
        this.cloudProperties.maxCloudWidth = Math.floor(this.environment.core.width * 0.8);
        
        // Initialize with random weather pattern
        this.setRandomWeatherPattern();
        
        // Initialize clouds and sky
        this.createInitialClouds();

        return this;
    },

    // Create initial cloud formation
    createInitialClouds: function() {
        const core = this.environment.core;
        
        // Ensure core is valid
        if (!core || !core.getIndex) {
            console.error("Cannot create clouds: Invalid core object");
            return;
        }
        
        // Base cloud color
        const baseCloudColor = {
            r: 240,
            g: 240,
            b: 255
        };
        this.cloudProperties.cloudColor = baseCloudColor;
        
        // Upper layer clouds - slightly brighter, whiter
        this.cloudProperties.upperLayerColor = {
            r: 250,
            g: 250,
            b: 255
        };
        
        // Lower layer clouds - slightly darker, hint of gray
        this.cloudProperties.lowerLayerColor = {
            r: 220,
            g: 225,
            b: 240
        };

        // Clear previous cloud pixels
        this.cloudProperties.cloudPixels = [];
        
        // Clear all cloud data in core simulation
        for (let i = 0; i < core.size; i++) {
            core.cloud[i] = 0;
        }

        // Create varied clouds based on cloudiness
        const cloudiness = this.weatherPatterns.patterns[this.weatherPatterns.current].cloudiness;
        const numClouds = Math.floor(6 + cloudiness * 5); // 3-8 clouds based on cloudiness
        
        // Create clouds in two layers for a more dynamic sky
        for (let cloud = 0; cloud < numClouds; cloud++) {
            const cloudStartX = Math.floor(Math.random() * core.width);
            const cloudWidth = Math.floor(this.cloudProperties.maxCloudWidth * (0.3 + cloudiness * 0.4));
            const cloudHeight = Math.floor(core.height * 0.1 * (0.8 + cloudiness));
            
            // Determine which cloud layer this cloud belongs to
            let cloudY;
            let cloudLayerType; // Track which layer for coloring
            
            if (cloud % 2 === 0) {
                // Upper layer (5-10% from top)
                cloudY = Math.floor(core.height * 0.05 + Math.random() * Math.floor(core.height * 0.01));
                cloudLayerType = 'upper';
            } else {
                // Lower layer (12-18% from top)
                cloudY = Math.floor(core.height * 0.01 + Math.random() * Math.floor(core.height * 0.06));
                cloudLayerType = 'lower';
            }
            
            // Define the cloud center
            const cloudCenterX = cloudStartX + Math.floor(cloudWidth / 2);
            const cloudCenterY = cloudY + Math.floor(cloudHeight / 2);
            
            for (let y = cloudY; y < cloudY + cloudHeight; y++) {
                for (let x = cloudStartX; x < cloudStartX + cloudWidth; x++) {
                    // Wrap around for x coordinates
                    const wrappedX = (x + core.width) % core.width;
                    
                    // Create clouds with highest density at center
                    // Calculate distance from center as a percentage of max possible distance
                    const distX = Math.abs(x - cloudCenterX) / (cloudWidth / 2);
                    const distY = Math.abs(y - cloudCenterY) / (cloudHeight / 2);
                    const dist = Math.sqrt(distX * distX + distY * distY);
                    
                    // Higher density in center, lower at edges
                    const centerFactor = Math.max(0, 1 - dist);
                    
                    if (Math.random() < this.cloudProperties.cloudDensity * centerFactor) {
                        const cloudDensity = Math.min(1, 0.7 + centerFactor * 0.3);
                        
                        // Add to cloud pixels array with layer information for color
                        this.cloudProperties.cloudPixels.push({ 
                            x: wrappedX, 
                            y: y,
                            density: cloudDensity,
                            layer: cloudLayerType // Store which layer this cloud pixel belongs to
                        });
                        
                        // Set in core simulation grid
                        const index = core.getIndex(wrappedX, y);
                        if (index !== -1) {
                            core.cloud[index] = Math.floor(cloudDensity * 255);
                        }
                    }
                }
            }
        }
    },

    // Set a random weather pattern with extreme bias toward heavy rain for Jumanji environment
    setRandomWeatherPattern: function() {
        const patterns = Object.keys(this.weatherPatterns.patterns);
        
        // Weighted random selection massively favoring rainy patterns for Jumanji environment
        const weights = {
            'clear': 0.1,           // Almost no chance for clear weather
            'partlyCloudy': 0.2,    // Very low chance for partly cloudy
            'overcast': 0.8,        // Reduced chance for overcast
            'lightRain': 2.5,       // Greatly increased chance for light rain
            'heavyRain': 4.0,       // Massively increased chance for heavy rain
            'storm': 3.0            // Greatly increased chance for storms
        };
        
        // Calculate total weight
        let totalWeight = 0;
        for (const pattern of patterns) {
            totalWeight += weights[pattern] || 1;
        }
        
        // Select pattern based on weights
        let randomValue = Math.random() * totalWeight;
        let selectedPattern = patterns[0];
        
        for (const pattern of patterns) {
            const weight = weights[pattern] || 1;
            randomValue -= weight;
            if (randomValue <= 0) {
                selectedPattern = pattern;
                break;
            }
        }
        
        this.weatherPatterns.current = selectedPattern;
        // Shorter weather patterns for more variety
        this.weatherPatterns.duration = 800 + Math.floor(Math.random() * 1200); // Reduced duration

        // Update lightning-related settings based on weather pattern
        if (this.environment.lightningSystem) {
            // Adjust lightning probability based on weather pattern
            if (this.weatherPatterns.current === 'storm') {
                // High chance of lightning during storms
                this.environment.lightningSystem.lightningProperties.strikeProbability = 0.2;
            } else if (this.weatherPatterns.current === 'heavyRain') {
                // Moderate chance during heavy rain
                this.environment.lightningSystem.lightningProperties.strikeProbability = 0.05;
            } else {
                // Very low chance in other weather
                this.environment.lightningSystem.lightningProperties.strikeProbability = 0.005;
            }
        }
        
        // Update environment controller with new rain probability
        this.environment.rainProbability = this.weatherPatterns.patterns[selectedPattern].rainProbability;
    },

    // Update weather conditions
    updateWeather: function(nextActivePixels) {
        // Update weather pattern duration
        this.weatherPatterns.duration--;
        if (this.weatherPatterns.duration <= 0) {
            this.setRandomWeatherPattern();
            this.createInitialClouds();
        }

        // Move clouds horizontally
        this.updateClouds();

        // Update rain properties based on current weather pattern
        const pattern = this.weatherPatterns.patterns[this.weatherPatterns.current];
        this.rainProperties.intensity = pattern.rainProbability;

        // Increased droplet generation for two cloud layers
        this.rainProperties.maxDropletsPerTick = Math.floor(
            this.environment.core.width * 0.2 * pattern.rainProbability // Further increased for double cloud layer system
        );

        if (pattern.rainProbability > 0) {
            this.updateRain(nextActivePixels);
        } else {
            // Clear existing rain
            this.rainProperties.droplets = [];
        }

        // Update lightning system with current weather conditions
        if (this.environment.lightningSystem) {
            // Set lightning probability based on weather pattern
            if (this.weatherPatterns.current === 'storm') {
                // High chance of lightning during storms
                this.environment.lightningSystem.lightningProperties.strikeProbability = 0.02;
            } else if (this.weatherPatterns.current === 'heavyRain') {
                // Moderate chance during heavy rain
                this.environment.lightningSystem.lightningProperties.strikeProbability = 0.005;
            } else {
                // Very low chance in other weather
                this.environment.lightningSystem.lightningProperties.strikeProbability = 0.0005;
            }
        }
    },
    
    // Update cloud positions
    updateClouds: function() {
        const core = this.environment.core;
        
        // Clear all cloud data in core simulation
        for (let i = 0; i < core.size; i++) {
            core.cloud[i] = 0;
        }
        
        // Move all cloud pixels smoothly
        for (let i = 0; i < this.cloudProperties.cloudPixels.length; i++) {
            const cloud = this.cloudProperties.cloudPixels[i];
            // Move more slowly for stability
            cloud.x = (cloud.x + this.cloudProperties.movementSpeed * 0.5) % core.width;
            
            // Set cloud data in the core simulation grid
            const index = core.getIndex(Math.floor(cloud.x), cloud.y);
            if (index !== -1) {
                // Always set cloud to maximum density for stability
                core.cloud[index] = 255;
                
                // Also set neighboring pixels to create a smoother cloud effect
                const neighbors = [
                    core.getIndex(Math.floor(cloud.x) - 1, cloud.y),
                    core.getIndex(Math.floor(cloud.x) + 1, cloud.y),
                    core.getIndex(Math.floor(cloud.x), cloud.y - 1),
                    core.getIndex(Math.floor(cloud.x), cloud.y + 1)
                ];
                
                for (const neighborIndex of neighbors) {
                    if (neighborIndex !== -1) {
                        // If there's already a cloud pixel here, keep it at max density
                        core.cloud[neighborIndex] = Math.max(core.cloud[neighborIndex], 200);
                    }
                }
            }
        }
        
        // Occasionally vary cloud density and shape (less frequently)
        if (Math.random() < 0.02) {
            for (let i = 0; i < this.cloudProperties.cloudPixels.length; i++) {
                if (Math.random() < 0.05) {
                    this.cloudProperties.cloudPixels.splice(i, 1);
                    i--;
                }
            }
            
            // Add new cloud pixels occasionally (less frequently)
            if (Math.random() < 0.1) {
                const existingCloud = this.cloudProperties.cloudPixels[
                    Math.floor(Math.random() * this.cloudProperties.cloudPixels.length)
                ];
                
                if (existingCloud) {
                    for (let i = 0; i < 5; i++) {
                        const newX = (existingCloud.x + (Math.random() * 6) - 3 + core.width) % core.width;
                        const newY = existingCloud.y + (Math.random() * 4) - 2;
                        
                        if (newY >= 0 && newY < core.height * 0.2) {
                            const newCloud = { 
                                x: newX, 
                                y: newY,
                                density: 0.7 + Math.random() * 0.3
                            };
                            
                            this.cloudProperties.cloudPixels.push(newCloud);
                            
                            // Set in core simulation grid
                            const index = core.getIndex(newX, newY);
                            if (index !== -1) {
                                core.cloud[index] = Math.floor(newCloud.density * 255);
                            }
                        }
                    }
                }
            }
        }
    },

    // Modified updateRain function with dramatically faster rain

    updateRain: function(nextActivePixels) {
        const core = this.environment.core;
        const maxDroplets = this.rainProperties.maxDropletsPerTick;
        const intensity = this.rainProperties.intensity;

        // Generate rain droplets from cloud area
        for (let i = 0; i < maxDroplets; i++) {
            // Skip if intensity check fails
            if (Math.random() > intensity) continue;

            // Find a cloud pixel as the source of rain
            if (this.cloudProperties.cloudPixels.length === 0) {
                this.createInitialClouds();
                continue;
            }

            const cloudIndex = Math.floor(Math.random() * this.cloudProperties.cloudPixels.length);
            const cloudSource = this.cloudProperties.cloudPixels[cloudIndex];

            // Only generate rain if cloud density check passes
            if (Math.random() > cloudSource.density) continue;

            const x = cloudSource.x;
            const index = core.getIndex(x, cloudSource.y + 1);

            if (index !== -1 && core.type[index] === this.environment.TYPE.AIR) {
                // Determine droplet size based on probabilities
                let dropletType;
                const r = Math.random();
                if (r < this.rainProperties.dropletSizes.small.probability) {
                    dropletType = 'small';
                } else if (r < this.rainProperties.dropletSizes.small.probability +
                    this.rainProperties.dropletSizes.medium.probability) {
                    dropletType = 'medium';
                } else {
                    dropletType = 'large';
                }

                const dropletConfig = this.rainProperties.dropletSizes[dropletType];

                // Create water droplet
                core.type[index] = this.environment.TYPE.WATER;
                core.water[index] = dropletConfig.water;

                // MASSIVE SPEED BOOST: Multiply initial speed by 5-10x
                this.rainProperties.droplets.push({
                    x: x,
                    y: cloudSource.y + 1,
                    speed: dropletConfig.speed * (50.0 + Math.random() * 5.0), // Dramatically increased!
                    type: dropletType,
                    size: dropletConfig.water
                });

                nextActivePixels.add(index);
            }
        }

        // Move existing droplets - use large steps to make rain fall dramatically faster
        const updatedDroplets = [];
        for (const droplet of this.rainProperties.droplets) {
            // CHANGE: Make larger steps per frame - move drop by its full speed
            const newY = Math.floor(droplet.y + droplet.speed);
            const newIndex = core.getIndex(droplet.x, newY);

            // Only consider it a collision if it hits something that isn't air
            if (newIndex === -1 || (core.type[newIndex] !== this.environment.TYPE.AIR)) {
                // Create splash effect if enabled
                if (this.rainProperties.splashEnabled) {
                    const splashSize = droplet.size / 100; // Scale splash based on droplet size

                    // Create more dramatic splash effects
                    for (let sx = -2; sx <= 2; sx++) {
                        if (Math.random() > splashSize * 0.1) continue; // Much higher chance of splash

                        const splashIndex = core.getIndex(droplet.x + sx, droplet.y);
                        if (splashIndex !== -1 && core.type[splashIndex] === this.environment.TYPE.AIR) {
                            core.type[splashIndex] = this.environment.TYPE.WATER;
                            core.water[splashIndex] = Math.floor(droplet.size * 0.5); // Bigger splashes
                            nextActivePixels.add(splashIndex);
                        }
                    }
                }

                // Add water to existing water pixel or soil
                const currentIndex = core.getIndex(droplet.x, droplet.y);
                if (currentIndex !== -1) {
                    if (core.type[currentIndex] === this.environment.TYPE.WATER) {
                        core.water[currentIndex] += droplet.size * 0.3; // More water impact
                    } else if (core.type[currentIndex] === this.environment.TYPE.SOIL) {
                        core.moisture[currentIndex] = Math.min(255,
                            (core.moisture[currentIndex] || 0) + droplet.size * 0.8); // More soil moisture
                    }
                    nextActivePixels.add(currentIndex);
                }

                continue; // Don't keep this droplet
            }

            // Fill in all air pixels along the path for faster drops to avoid "skipping" rendering
            if (droplet.speed > 1) {
                // For very fast drops, fill in intermediate pixels to avoid gaps
                const startY = Math.floor(droplet.y);
                const distance = newY - startY;

                // Only fill gaps if the drop is moving more than a few pixels per frame
                if (distance > 3) {
                    // Fill in some intermediate pixels to create a "rain streak" effect
                    const skipFactor = Math.max(1, Math.floor(distance / 4)); // Only draw some pixels for performance

                    for (let step = skipFactor; step < distance; step += skipFactor) {
                        const midY = startY + step;
                        const midIndex = core.getIndex(droplet.x, midY);

                        if (midIndex !== -1 && core.type[midIndex] === this.environment.TYPE.AIR) {
                            // Create water droplet with less water (streak effect)
                            core.type[midIndex] = this.environment.TYPE.WATER;
                            core.water[midIndex] = Math.floor(droplet.size * 0.3);
                            nextActivePixels.add(midIndex);
                        }
                    }
                }
            }

            // Update droplet position at the end point
            core.type[newIndex] = this.environment.TYPE.WATER;
            core.water[newIndex] = droplet.size;
            nextActivePixels.add(newIndex);

            // Clear previous position if it was water
            const oldIndex = core.getIndex(droplet.x, droplet.y);
            if (oldIndex !== -1 && core.type[oldIndex] === this.environment.TYPE.WATER) {
                core.type[oldIndex] = this.environment.TYPE.AIR;
                core.water[oldIndex] = 0;
                nextActivePixels.add(oldIndex);
            }

            // MASSIVE acceleration boost - nearly double speed each frame with very high cap
            droplet.speed = Math.min(droplet.speed * 5, 2000); // Dramatic acceleration with very high cap
            droplet.y = newY;

            updatedDroplets.push(droplet);
        }

        // Update droplets
        this.rainProperties.droplets = updatedDroplets;
    }
};

// Make WeatherSystem available for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherSystem;
}

// Make WeatherSystem available for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherSystem;
}