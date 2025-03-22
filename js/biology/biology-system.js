// Biology System
// Handles all organism behaviors: plants, insects, worms, and decomposition

const BiologySystem = {
    // Reference to core simulation
    core: null,

    // Type and state enums (will be populated by controller)
    TYPE: null,
    STATE: null,

    // Biology settings
    growthRate: 2.5,        // Multiplier for organism growth rates (reduced from 4.5 for better balance)
    metabolism: 0.85,       // Energy consumption rate multiplier (increased from 0.65 for predator control)
    reproduction: 2.5,      // Reproduction probability multiplier (decreased from 5.0 for stability)

    // Processing flags to avoid double updates
    processedThisFrame: null,

    // References to subsystems
    plantSystem: null,
    seedSystem: null,
    insectSystem: null,
    wormSystem: null,
    decompositionSystem: null,
    evolutionSystem: null,  // NEW: Evolution system reference

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
        this.evolutionSystem = EvolutionSystem.init(this); // NEW: Initialize evolution system

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
        
        // NEW: Update evolution system
        this.evolutionSystem.update();
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
        // NEW: Set constants for evolution system
        if (this.evolutionSystem) {
            this.evolutionSystem.TYPE = this.TYPE;
            this.evolutionSystem.STATE = this.STATE;
        }
    },
    
    // NEW: Helper function to apply trait modifiers to organisms
    getTraitModifier: function(index, traitName) {
        // Use evolution system to get trait value if available
        if (this.evolutionSystem) {
            return this.evolutionSystem.getTraitValue(index, traitName);
        }
        return 1.0; // Default multiplier if evolution system not available
    },
    
    // NEW: Handle reproduction with genetics
    handleReproduction: function(parentIndex, childIndex) {
        // Track reproduction in evolution system
        if (this.evolutionSystem) {
            this.evolutionSystem.handleReproduction(parentIndex, childIndex);
        }
    },
    
    // NEW: Get evolution metrics for UI display
    getEvolutionMetrics: function() {
        if (this.evolutionSystem) {
            return this.evolutionSystem.getEvolutionMetrics();
        }
        return null;
    }
};