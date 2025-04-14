// Weather System
// Handles weather phenomena like rain and sky representation

export const WeatherSystem = {
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
        movementSpeed: 0.3,    // Cloud movement speed
        cloudDensity: 0.9      // Cloud density factor
    },

    // Rain properties - dramatically enhanced for Jumanji-style downpours
    rainProperties: {
        intensity: 0,          // 0-1 range representing rain intensity
        droplets: [],          // Array to store active rain droplets
        maxDropletsPerTick: 0, // Maximum number of droplets per tick
        dropletSizes: {        // Different droplet size configurations (massively increased for Jumanji effect)
            small: { water: 250, speed: 20, probability: 0.3 },
            medium: { water: 400, speed: 30, probability: 0.4 },
            large: { water: 600, speed: 40, probability: 0.3 }  // Increased large droplet probability
        },
        splashEnabled: true    // Enable water splash effects
    },

    // Weather patterns
    weatherPatterns: {
        current: 'clear',      // Current weather pattern
        duration: 0,           // Duration of current pattern
        transitionSpeed: 0.02, // Speed of transitions between patterns
        patterns: {
            clear: { cloudiness: 0.2, rainProbability: 0.3 },
            partlyCloudy: { cloudiness: 0.5, rainProbability: 0.5 },
            overcast: { cloudiness: 0.8, rainProbability: 0.8 },
            lightRain: { cloudiness: 0.7, rainProbability: 0.9 },
            heavyRain: { cloudiness: 0.9, rainProbability: 1.0 },
            storm: { cloudiness: 1.0, rainProbability: 1.0 }
        }
    },

    // Initialize weather system
    init: function(environmentController) {
        this.environment = environmentController;

        // Set maximum cloud width based on simulation width
        this.cloudProperties.maxCloudWidth = Math.floor(this.environment.core.width * 0.8);
        
        // Initialize with random weather pattern
        this.setRandomWeatherPattern();
        
        console.log("Initializing weather system...");

        // Initialize clouds and sky
        this.createInitialClouds();

        return this;
    },

    // Create initial cloud formation
    createInitialClouds: function() {
        const core = this.environment.core;
        
        // Base cloud color
        const baseCloudColor = {
            r: 240,
            g: 240,
            b: 250
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
        const numClouds = Math.floor(3 + cloudiness * 5); // 3-8 clouds based on cloudiness
        
        // Create clouds in two layers for a more dynamic sky
        for (let cloud = 0; cloud < numClouds; cloud++) {
            const cloudStartX = Math.floor(Math.random() * core.width);
            const cloudWidth = Math.floor(this.cloudProperties.maxCloudWidth * (0.3 + cloudiness * 0.4));
            const cloudHeight = Math.floor(core.height * 0.06 * (0.8 + cloudiness));
            
            // Determine which cloud layer this cloud belongs to
            let cloudY;
            let cloudLayerType; // Track which layer for coloring
            
            if (cloud % 2 === 0) {
                // Upper layer (5-10% from top)
                cloudY = Math.floor(core.height * 0.05 + Math.random() * Math.floor(core.height * 0.05));
                cloudLayerType = 'upper';
            } else {
                // Lower layer (12-18% from top)
                cloudY = Math.floor(core.height * 0.12 + Math.random() * Math.floor(core.height * 0.06));
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
        if (Math.random() < 0.002) {
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

    // Create dynamic rain
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

                this.rainProperties.droplets.push({
                    x: x,
                    y: cloudSource.y + 1,
                    speed: dropletConfig.speed * (0.8 + Math.random() * 0.4),
                    type: dropletType,
                    size: dropletConfig.water
                });

                nextActivePixels.add(index);
            }
        }

        // Move existing droplets
        const updatedDroplets = [];
        for (const droplet of this.rainProperties.droplets) {
            // Calculate new y position based on speed
            const newY = droplet.y + droplet.speed;
            const newIndex = core.getIndex(droplet.x, newY);
            
            // Handle collision with ground or other pixels
            if (newIndex === -1 || core.type[newIndex] !== this.environment.TYPE.AIR) {
                // Create splash effect if enabled
                if (this.rainProperties.splashEnabled) {
                    const splashSize = droplet.size / 100; // Scale splash based on droplet size
                    
                    // Create smaller water droplets in nearby pixels
                    for (let sx = -1; sx <= 1; sx++) {
                        if (Math.random() > splashSize * 0.3) continue;
                        
                        const splashIndex = core.getIndex(droplet.x + sx, droplet.y);
                        if (splashIndex !== -1 && core.type[splashIndex] === this.environment.TYPE.AIR) {
                            core.type[splashIndex] = this.environment.TYPE.WATER;
                            core.water[splashIndex] = Math.floor(droplet.size * 0.3);
                            nextActivePixels.add(splashIndex);
                        }
                    }
                }
                
                // Add water to existing water pixel or soil
                const currentIndex = core.getIndex(droplet.x, droplet.y);
                if (currentIndex !== -1) {
                    if (core.type[currentIndex] === this.environment.TYPE.WATER) {
                        core.water[currentIndex] += droplet.size * 0.2;
                    } else if (core.type[currentIndex] === this.environment.TYPE.SOIL) {
                        core.moisture[currentIndex] = Math.min(255, 
                            (core.moisture[currentIndex] || 0) + droplet.size * 0.5);
                    }
                    nextActivePixels.add(currentIndex);
                }
                
                continue; // Don't keep this droplet
            }
            
            // Update droplet position
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
            
            // Increase speed (acceleration due to gravity)
            droplet.speed = Math.min(droplet.speed * 1.12, 35); // Increased acceleration from 1.05 to 1.12 and cap from 25 to 35
            droplet.y = newY;
            
            updatedDroplets.push(droplet);
        }

        // Update droplets
        this.rainProperties.droplets = updatedDroplets;
    }
};