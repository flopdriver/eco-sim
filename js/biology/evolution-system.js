// Evolution System
// Handles genetic traits and evolution for plants and creatures

const EvolutionSystem = {
    // Reference to parent biology system
    biology: null,
    
    // Shorthand references to commonly used objects
    core: null,
    TYPE: null,
    STATE: null,
    
    // Genetic trait tracking
    organismGenomes: {}, // Maps organism ID to their genome
    speciesStats: {},    // Statistics about each species
    
    // Evolution constants
    MUTATION_RATE: 0.08,         // Chance of mutation during reproduction (reduced from 0.15 for more stability)
    MUTATION_STRENGTH: 0.15,     // How much a trait can change during mutation (reduced from 0.25)
    MIN_TRAIT_VALUE: 0.2,        // Minimum value for any trait (increased from 0.1)
    MAX_TRAIT_VALUE: 3.0,        // Maximum value for any trait (reduced from 5.0 to prevent extremes)
    
    // Trait definitions with default values
    traitDefinitions: {
        plant: {
            growthRate: { default: 1.0, min: 0.5, max: 2.5, description: "Speed of growth" },
            waterEfficiency: { default: 1.2, min: 0.5, max: 2.5, description: "Water usage efficiency" },
            nutrientEfficiency: { default: 1.2, min: 0.5, max: 2.5, description: "Nutrient usage efficiency" },
            stemStrength: { default: 1.3, min: 0.6, max: 2.5, description: "Strength of stems" },
            rootDepth: { default: 1.0, min: 0.5, max: 2.5, description: "Maximum root depth" },
            leafSize: { default: 1.0, min: 0.6, max: 1.8, description: "Size of leaves" },
            seedProduction: { default: 0.9, min: 0.5, max: 2.0, description: "Rate of seed production" },
            droughtResistance: { default: 1.0, min: 0.5, max: 2.5, description: "Ability to survive with less water" },
            fireResistance: { default: 1.0, min: 0.2, max: 2.0, description: "Resistance to fire damage" }
        },
        insect: {
            speed: { default: 1.0, min: 0.5, max: 2.5, description: "Movement speed" },
            metabolism: { default: 1.2, min: 0.6, max: 2.0, description: "Energy consumption rate" },
            strength: { default: 1.0, min: 0.5, max: 2.5, description: "Ability to break plant defenses" },
            feedingEfficiency: { default: 0.8, min: 0.4, max: 2.0, description: "Energy gained from feeding" },
            reproductionRate: { default: 0.8, min: 0.5, max: 2.0, description: "Chance of reproduction" },
            lifespan: { default: 1.1, min: 0.6, max: 2.5, description: "Resistance to age-related death" }
        },
        worm: {
            digSpeed: { default: 1.0, min: 0.5, max: 2.5, description: "Speed of digging through soil" },
            metabolism: { default: 1.0, min: 0.6, max: 1.5, description: "Energy consumption rate" },
            nutrientProcessing: { default: 1.2, min: 0.6, max: 2.5, description: "Ability to process soil nutrients" },
            reproductionRate: { default: 0.8, min: 0.5, max: 2.0, description: "Chance of reproduction" },
            moisturePreference: { default: 1.0, min: 0.5, max: 2.5, description: "Preference for moist soil" }
        }
    },
    
    // Evolution history for visualization
    evolutionHistory: {
        plants: [],     // Array of significant plant genome snapshots with timestamps
        insects: [],    // Array of significant insect genome snapshots with timestamps
        worms: []       // Array of significant worm genome snapshots with timestamps
    },
    
    // Initialize evolution system
    init: function(biologySystem) {
        this.biology = biologySystem;
        this.core = biologySystem.core;
        this.TYPE = biologySystem.TYPE;
        this.STATE = biologySystem.STATE;
        
        console.log("Initializing evolution system...");
        
        // Reset tracking objects
        this.organismGenomes = {};
        this.speciesStats = {
            plants: { count: 0, averageTraits: {}, generations: 0 },
            insects: { count: 0, averageTraits: {}, generations: 0 },
            worms: { count: 0, averageTraits: {}, generations: 0 }
        };
        
        // Initialize average traits
        this.resetAverageTraits();
        
        return this;
    },
    
    // Reset average traits to defaults
    resetAverageTraits: function() {
        for (const category in this.traitDefinitions) {
            this.speciesStats[category + 's'].averageTraits = {};
            for (const trait in this.traitDefinitions[category]) {
                this.speciesStats[category + 's'].averageTraits[trait] = this.traitDefinitions[category][trait].default;
            }
        }
    },
    
    // Create a new genome for an organism
    createGenome: function(type, parentGenome = null) {
        const category = this.getCategory(type);
        if (!category) return null;
        
        let genome = { traits: {}, generation: 1, ancestors: [] };
        
        // Set traits based on parent (inheritance) or defaults
        if (parentGenome) {
            // Inherit traits from parent with possible mutations
            for (const trait in this.traitDefinitions[category]) {
                let value = parentGenome.traits[trait];
                
                // Apply mutation with probability
                if (Math.random() < this.MUTATION_RATE) {
                    // Random mutation within bounds
                    const mutationAmount = (Math.random() * 2 - 1) * this.MUTATION_STRENGTH;
                    value = value * (1 + mutationAmount);
                    
                    // Ensure trait is within allowed range
                    const traitDef = this.traitDefinitions[category][trait];
                    value = Math.max(traitDef.min, Math.min(traitDef.max, value));
                }
                
                genome.traits[trait] = value;
            }
            
            // Increment generation
            genome.generation = parentGenome.generation + 1;
            
            // Track ancestry (limited to 5 most recent)
            genome.ancestors = [parentGenome.id].concat(parentGenome.ancestors.slice(0, 4));
        } else {
            // Create new genome with default traits
            for (const trait in this.traitDefinitions[category]) {
                // Start with default value plus small random variation
                const variation = (Math.random() * 0.4 - 0.2); // ±20% variation
                genome.traits[trait] = this.traitDefinitions[category][trait].default * (1 + variation);
            }
        }
        
        // Assign unique ID
        genome.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        
        // Record timestamp
        genome.timestamp = Date.now();
        
        return genome;
    },
    
    // Get the category (plant, insect, worm) for a given type
    getCategory: function(type) {
        if (type === this.TYPE.PLANT) return "plant";
        if (type === this.TYPE.INSECT) return "insect";
        if (type === this.TYPE.WORM) return "worm";
        return null;
    },
    
    // Apply genome traits to an organism
    applyGenomeToOrganism: function(index, genomeId) {
        this.organismGenomes[index] = genomeId;
    },
    
    // Get trait value for an organism
    getTraitValue: function(index, traitName) {
        const genomeId = this.organismGenomes[index];
        if (!genomeId) return 1.0; // Default if no genome
        
        const genome = this.getGenome(genomeId);
        if (!genome || !genome.traits[traitName]) return 1.0;
        
        return genome.traits[traitName];
    },
    
    // Get full genome by ID
    getGenome: function(genomeId) {
        return this.biology.core.genomeRegistry ? 
            this.biology.core.genomeRegistry[genomeId] : null;
    },
    
    // Register a genome in the central registry
    registerGenome: function(genome) {
        // Ensure registry exists
        if (!this.biology.core.genomeRegistry) {
            this.biology.core.genomeRegistry = {};
        }
        
        // Store genome
        this.biology.core.genomeRegistry[genome.id] = genome;
        
        return genome.id;
    },
    
    // Update genome when an organism reproduces
    handleReproduction: function(parentIndex, childIndex) {
        const parentGenomeId = this.organismGenomes[parentIndex];
        if (!parentGenomeId) {
            // Parent has no genome, create new one
            const type = this.core.type[parentIndex];
            const newGenome = this.createGenome(type);
            const genomeId = this.registerGenome(newGenome);
            
            // Apply to both parent and child
            this.applyGenomeToOrganism(parentIndex, genomeId);
            this.applyGenomeToOrganism(childIndex, genomeId);
        } else {
            // Parent has genome, child inherits with possible mutation
            const parentGenome = this.getGenome(parentGenomeId);
            const childGenome = this.createGenome(this.core.type[childIndex], parentGenome);
            const childGenomeId = this.registerGenome(childGenome);
            
            // Apply to child
            this.applyGenomeToOrganism(childIndex, childGenomeId);
            
            // Track statistics
            this.updateEvolutionHistory(this.core.type[childIndex], childGenome);
        }
    },
    
    // Update evolution history with significant changes
    updateEvolutionHistory: function(type, genome) {
        const category = this.getCategory(type);
        if (!category) return;
        
        const historyKey = category + 's';
        
        // Increment generation counter
        this.speciesStats[historyKey].generations++;
        
        // Check if this is a significant evolution (every 10 generations or significant trait change)
        const isSignificantGeneration = this.speciesStats[historyKey].generations % 10 === 0;
        
        let hasSignificantChange = false;
        if (this.evolutionHistory[historyKey].length > 0) {
            const lastEntry = this.evolutionHistory[historyKey][this.evolutionHistory[historyKey].length - 1];
            
            // Check for significant trait changes
            for (const trait in genome.traits) {
                const change = Math.abs(genome.traits[trait] - lastEntry.averageTraits[trait]);
                if (change > 0.3) { // 30% change is significant
                    hasSignificantChange = true;
                    break;
                }
            }
        }
        
        if (isSignificantGeneration || hasSignificantChange) {
            // Record current average traits
            this.evolutionHistory[historyKey].push({
                timestamp: Date.now(),
                generation: this.speciesStats[historyKey].generations,
                averageTraits: {...this.speciesStats[historyKey].averageTraits},
                population: this.speciesStats[historyKey].count
            });
            
            // Limit history size
            if (this.evolutionHistory[historyKey].length > 100) {
                this.evolutionHistory[historyKey].shift();
            }
        }
    },
    
    // Calculate population and trait statistics
    updateStatistics: function() {
        // Reset counts
        this.speciesStats.plants.count = 0;
        this.speciesStats.insects.count = 0;
        this.speciesStats.worms.count = 0;
        
        // Reset trait sums for averaging
        const traitSums = {
            plants: {},
            insects: {},
            worms: {}
        };
        
        // Initialize trait sums
        for (const category in this.traitDefinitions) {
            const statsKey = category + 's';
            for (const trait in this.traitDefinitions[category]) {
                traitSums[statsKey][trait] = 0;
            }
        }
        
        // Count organisms and sum traits
        for (const index in this.organismGenomes) {
            const genomeId = this.organismGenomes[index];
            const genome = this.getGenome(genomeId);
            
            if (!genome) continue;
            
            const type = this.core.type[index];
            const category = this.getCategory(type);
            if (!category) continue;
            
            const statsKey = category + 's';
            
            // Increment count
            this.speciesStats[statsKey].count++;
            
            // Sum traits for averaging
            for (const trait in genome.traits) {
                traitSums[statsKey][trait] += genome.traits[trait];
            }
        }
        
        // Calculate averages
        for (const category in this.traitDefinitions) {
            const statsKey = category + 's';
            if (this.speciesStats[statsKey].count > 0) {
                for (const trait in this.traitDefinitions[category]) {
                    this.speciesStats[statsKey].averageTraits[trait] = 
                        traitSums[statsKey][trait] / this.speciesStats[statsKey].count;
                }
            }
        }
    },
    
    // Main update function
    update: function() {
        // Update statistics periodically (every ~10 frames)
        if (Math.random() < 0.1) {
            this.updateStatistics();
        }
    },
    
    // Get evolution metrics for UI display
    getEvolutionMetrics: function() {
        return {
            stats: this.speciesStats,
            history: this.evolutionHistory
        };
    }
}; 