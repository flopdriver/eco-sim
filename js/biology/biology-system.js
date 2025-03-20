// Biology System
// Handles all organism behaviors: plants, insects, worms, and decomposition

const BiologySystem = {
    // Reference to core simulation
    core: null,

    // Type and state enums (will be populated by controller)
    TYPE: null,
    STATE: null,

    // Biology settings
    growthRate: 4.5,        // Multiplier for organism growth rates (massively increased for Jumanji-like growth)
    metabolism: 0.65,       // Energy consumption rate multiplier (decreased for sustained rapid growth)
    reproduction: 5.0,      // Reproduction probability multiplier (dramatically increased)

    // Processing flags to avoid double updates
    processedThisFrame: null,

    // References to subsystems
    plantSystem: null,
    seedSystem: null,
    insectSystem: null,
    wormSystem: null,
    decompositionSystem: null,

    // Initialize biology system
    init: function(core) {
        this.core = core;
        console.log("Initializing biology systems...");

        // Create processed flags array
        this.processedThisFrame = new Uint8Array(core.size);

        // Initialize subsystems
        this.plantSystem = PlantSystem.init(this);
        this.seedSystem = SeedSystem.init(this);
        this.insectSystem = InsectSystem.init(this);
        this.wormSystem = WormSystem.init(this);
        this.decompositionSystem = DecompositionSystem.init(this);

        // Ensure constants are propagated to subsystems
        this.propagateConstants();

        return this;
    },

    // Main update function
    update: function(activePixels, nextActivePixels) {
        // Reset processed flags
        this.processedThisFrame.fill(0);

        // Process plants first (plants don't move, so all active plant pixels can be processed)
        this.plantSystem.update(activePixels, nextActivePixels);

        // Process seeds
        this.seedSystem.update(activePixels, nextActivePixels);

        // Process mobile organisms (insects, worms)
        this.insectSystem.update(activePixels, nextActivePixels);
        this.wormSystem.update(activePixels, nextActivePixels);

        // Process decomposition (dead matter)
        this.decompositionSystem.update(activePixels, nextActivePixels);
    },

    propagateConstants: function() {
        console.log("Propagating constants to biology subsystems...");

        // Ensure TYPE and STATE are set in all subsystems
        if (this.plantSystem) {
            this.plantSystem.TYPE = this.TYPE;
            this.plantSystem.STATE = this.STATE;
        }
        if (this.seedSystem) {
            this.seedSystem.TYPE = this.TYPE;
            this.seedSystem.STATE = this.STATE;
        }
        if (this.insectSystem) {
            this.insectSystem.TYPE = this.TYPE;
            this.insectSystem.STATE = this.STATE;
        }
        if (this.wormSystem) {
            this.wormSystem.TYPE = this.TYPE;
            this.wormSystem.STATE = this.STATE;
        }
        if (this.decompositionSystem) {
            this.decompositionSystem.TYPE = this.TYPE;
            this.decompositionSystem.STATE = this.STATE;
        }
    },
};