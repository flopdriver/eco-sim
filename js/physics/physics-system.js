// Physics System
// Main coordinator for all physics-related subsystems

const PhysicsSystem = {
    // Reference to core simulation
    core: null,

    // Physics settings
    gravity: true,         // Whether gravity is enabled
    fluidDynamics: true,   // Whether fluid dynamics are enabled
    erosion: true,         // Whether erosion is enabled
    airDynamics: true,     // Whether air dynamics are enabled

    // Type and state enums (will be populated by controller)
    TYPE: null,
    STATE: null,

    // Processing flags to avoid double updates
    processedThisFrame: null,
    
    // Frame counter for timing operations
    frameCount: 0,

    // Subsystem references
    fluidDynamicsSystem: null,
    soilMoistureSystem: null,
    gravitySystem: null,
    erosionSystem: null,
    airDynamicsSystem: null,

    // Initialize physics system
    init: function(core) {
        console.log("Initializing physics systems...");
        
        // Validate core object
        if (!core) {
            console.error("Physics system init failed: core object is missing");
            return null;
        }
        
        if (!core.getCoords || !core.getIndex) {
            console.error("Physics system init failed: core object missing required methods");
            console.error("Core methods available:", Object.keys(core).filter(k => typeof core[k] === 'function'));
            return null;
        }
        
        if (!core.size || !core.width || !core.height) {
            console.error("Physics system init failed: core dimensions not available", 
                         core.width, core.height, core.size);
            return null;
        }
        
        this.core = core;
        console.log(`Physics system using core with dimensions: ${core.width}x${core.height}`);

        // Create processed flags array
        this.processedThisFrame = new Uint8Array(core.size);

        // Initialize subsystems
        this.fluidDynamicsSystem = FluidDynamicsSystem.init(this);
        this.soilMoistureSystem = SoilMoistureSystem.init(this);
        this.gravitySystem = GravitySystem.init(this);
        this.erosionSystem = ErosionSystem.init(this);
        this.airDynamicsSystem = AirDynamicsSystem.init(this);

        return this;
    },

    // Main update function
    update: function(activePixels, nextActivePixels) {
        // Reset processed flags
        this.processedThisFrame.fill(0);
        
        // Increment frame counter
        this.frameCount++;
        
        // Process seed scattering (added for increased seed dispersal)
        this.scatterSeeds(activePixels, nextActivePixels);

        // Process water movement (fluid dynamics)
        if (this.fluidDynamics) {
            this.fluidDynamicsSystem.updateWaterMovement(activePixels, nextActivePixels);
        }

        // Ensure key soil pixels are always active
        this.activateImportantSoilPixels(activePixels);

        // Process soil moisture movement
        this.soilMoistureSystem.updateSoilMoisture(activePixels, nextActivePixels);

        // Process falling objects (seeds, dead matter, etc)
        if (this.gravity) {
            // Ensure gravity is applied to every eligible pixel
            // First, collect all pixels affected by gravity
            const gravityAffectedTypes = [
                this.TYPE.SEED,
                this.TYPE.DEAD_MATTER,
                this.TYPE.INSECT,
                this.TYPE.WORM,
                this.TYPE.SOIL
            ];
            
            // Check for pixels that should be falling but aren't active
            const gravityPixels = new Set();
            
            // Add all active pixels of gravity-affected types
            activePixels.forEach(index => {
                if (gravityAffectedTypes.includes(this.core.type[index])) {
                    gravityPixels.add(index);
                }
            });
            
            // Periodic full-grid gravity check (every 30 frames)
            if (Math.random() < 0.03) {
                // Only scan the top portion of the grid where falling objects are likely to be
                const scanHeight = Math.floor(this.core.height * 0.3); // Only scan top 30% of grid
                for (let y = 0; y < scanHeight; y++) {
                    for (let x = 0; x < this.core.width; x++) {
                        const index = this.core.getIndex(x, y);
                        if (index !== -1 && gravityAffectedTypes.includes(this.core.type[index]) && !activePixels.has(index)) {
                            // Check if there's air or water below this pixel
                            const belowIndex = this.core.getIndex(x, y + 1);
                            
                            if (belowIndex !== -1 && 
                                (this.core.type[belowIndex] === this.TYPE.AIR || 
                                 this.core.type[belowIndex] === this.TYPE.WATER)) {
                                // This pixel should be falling but isn't active
                                gravityPixels.add(index);
                            }
                        }
                    }
                }
            }
            
            // Process all gravity-affected pixels
            this.gravitySystem.updateGravity(gravityPixels, nextActivePixels);
        }

        // Process erosion (water eroding soil)
        if (this.erosion) {
            this.erosionSystem.updateErosion(activePixels, nextActivePixels);
        }

        // Process air dynamics (air movement)
        if (this.airDynamics) {
            this.airDynamicsSystem.updateAirDynamics(activePixels, nextActivePixels);
        }
    },
    
    // Ensure key soil areas are active for processing
    activateImportantSoilPixels: function(activePixels) {
        // Every 5th frame, activate soil near plant roots and water
        if (this.frameCount % 5 === 0) {
            for (const index of activePixels) {
                // If this is a plant root or water, activate nearby soil
                if ((this.core.type[index] === this.TYPE.PLANT && 
                     this.core.state[index] === this.STATE.ROOT) ||
                    this.core.type[index] === this.TYPE.WATER) {
                    
                    // Get coordinates and neighbors
                    const coords = this.core.getCoords(index);
                    const neighbors = this.core.getNeighborIndices(coords.x, coords.y);
                    
                    // Activate soil neighbors
                    for (const neighbor of neighbors) {
                        if (this.core.type[neighbor.index] === this.TYPE.SOIL) {
                            activePixels.add(neighbor.index);
                        }
                    }
                }
            }
        }
    },

    // Dramatically enhanced seed scattering for aggressive Jumanji-like propagation
    scatterSeeds: function(activePixels, nextActivePixels) {
        // Find all seeds and flowers that can scatter seeds
        const surfaceSeeds = [];
        const activeFlowers = [];
        
        for (const index of activePixels) {
            const coords = this.core.getCoords(index);
            
            // Process seeds on surfaces
            if (this.core.type[index] === this.TYPE.SEED) {
                // Check if seed is on a surface
                const downIndex = this.core.getIndex(coords.x, coords.y + 1);
                if (downIndex !== -1 && 
                    (this.core.type[downIndex] === this.TYPE.SOIL || 
                     this.core.type[downIndex] === this.TYPE.PLANT)) {
                    surfaceSeeds.push({index, x: coords.x, y: coords.y});
                }
            }
            
            // Track flowers for explosive seed production
            if (this.core.type[index] === this.TYPE.PLANT && 
                this.core.state[index] === this.STATE.FLOWER) {
                activeFlowers.push({index, x: coords.x, y: coords.y});
            }
        }
        
        // Aggressively scatter seeds from flowers for explosive growth
        for (const flower of activeFlowers) {
            // Much higher chance of dispersal
            if (Math.random() < 0.15) {
                // Calculate a larger random horizontal offset (between -15 and 15)
                const offsetX = Math.floor(Math.random() * 31) - 15;
                const offsetY = Math.floor(Math.random() * 10) - 8; // Mostly upward/outward
                
                // Get the new position
                const newX = flower.x + offsetX;
                const newY = flower.y + offsetY;
                const newIndex = this.core.getIndex(newX, newY);
                
                // Check if the new position is valid (air)
                if (newIndex !== -1 && this.core.type[newIndex] === this.TYPE.AIR) {
                    // Create a new seed with plenty of energy
                    this.core.type[newIndex] = this.TYPE.SEED;
                    this.core.energy[newIndex] = 150 + Math.random() * 50;
                    
                    // Mark the new seed as active
                    nextActivePixels.add(newIndex);
                    
                    // Sometimes create multiple nearby seeds in a cluster
                    if (Math.random() < 0.4) {
                        for (let i = 0; i < 2; i++) {
                            const clusterX = newX + (Math.floor(Math.random() * 5) - 2);
                            const clusterY = newY + (Math.floor(Math.random() * 3) - 1);
                            const clusterIndex = this.core.getIndex(clusterX, clusterY);
                            
                            if (clusterIndex !== -1 && this.core.type[clusterIndex] === this.TYPE.AIR) {
                                this.core.type[clusterIndex] = this.TYPE.SEED;
                                this.core.energy[clusterIndex] = 120 + Math.random() * 30;
                                nextActivePixels.add(clusterIndex);
                            }
                        }
                    }
                }
            }
        }
        
        // Randomly scatter seeds on surfaces with increased range and frequency
        for (const seed of surfaceSeeds) {
            // Much higher chance of movement for Jumanji-like spread
            if (Math.random() < 0.25) {
                // Calculate a much larger random horizontal offset (between -12 and 12)
                const offsetX = Math.floor(Math.random() * 25) - 12;
                
                // Skip if offset is 0 (no movement)
                if (offsetX === 0) continue;
                
                // Get the new position
                const newX = seed.x + offsetX;
                const newY = seed.y;
                const newIndex = this.core.getIndex(newX, newY);
                
                // Check if the new position is valid (air)
                if (newIndex !== -1 && this.core.type[newIndex] === this.TYPE.AIR) {
                    // Move the seed
                    this.core.type[newIndex] = this.TYPE.SEED;
                    this.core.energy[newIndex] = this.core.energy[seed.index];
                    
                    // Clear the old position
                    this.core.type[seed.index] = this.TYPE.AIR;
                    this.core.energy[seed.index] = 0;
                    
                    // Mark both positions as active
                    nextActivePixels.add(newIndex);
                    nextActivePixels.add(seed.index);
                }
            }
        }
    }
};