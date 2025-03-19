// Physics System
// Main coordinator for all physics-related subsystems

const PhysicsSystem = {
    // Reference to core simulation
    core: null,

    // Physics settings
    gravity: true,         // Whether gravity is enabled
    fluidDynamics: true,   // Whether fluid dynamics are enabled
    erosion: true,         // Whether erosion is enabled

    // Type and state enums (will be populated by controller)
    TYPE: null,
    STATE: null,

    // Processing flags to avoid double updates
    processedThisFrame: null,

    // Subsystem references
    fluidDynamicsSystem: null,
    soilMoistureSystem: null,
    gravitySystem: null,
    erosionSystem: null,

    // Initialize physics system
    init: function(core) {
        this.core = core;
        console.log("Initializing physics systems...");

        // Create processed flags array
        this.processedThisFrame = new Uint8Array(core.size);

        // Initialize subsystems
        this.fluidDynamicsSystem = FluidDynamicsSystem.init(this);
        this.soilMoistureSystem = SoilMoistureSystem.init(this);
        this.gravitySystem = GravitySystem.init(this);
        this.erosionSystem = ErosionSystem.init(this);

        return this;
    },

    // Main update function
    update: function(activePixels, nextActivePixels) {
        // Reset processed flags
        this.processedThisFrame.fill(0);

        // Process water movement (fluid dynamics)
        if (this.fluidDynamics) {
            this.fluidDynamicsSystem.updateWaterMovement(activePixels, nextActivePixels);
        }

        // Process soil moisture movement
        this.soilMoistureSystem.updateSoilMoisture(activePixels, nextActivePixels);

        // Process falling objects (seeds, dead matter, etc)
        if (this.gravity) {
            this.gravitySystem.updateGravity(activePixels, nextActivePixels);
        }

        // Process erosion (water eroding soil)
        if (this.erosion) {
            this.erosionSystem.updateErosion(activePixels, nextActivePixels);
        }
    }
};