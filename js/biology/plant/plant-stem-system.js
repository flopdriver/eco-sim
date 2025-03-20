// Plant Stem System
// Handles plant stem growth and branching

const PlantStemSystem = {
    // Reference to parent plant system
    plant: null,
    
    // Initialize stem system
    init: function(plantSystem) {
        this.plant = plantSystem;
        return this;
    },
    
    // Update stem behavior
    updateStem: function(x, y, index, nextActivePixels) {
        // Stems grow upward and can branch - dramatically reduced energy requirement and massively increased chance
        if (this.plant.core.energy[index] > 40 && Math.random() < 0.35 * this.plant.biology.growthRate) { // Massively increased growth rate for Jumanji vines
            this.growStem(x, y, index, nextActivePixels);
        }

        // Stems can grow leaves - dramatically reduced energy requirement and massively increased chance
        if (this.plant.core.energy[index] > 50 && Math.random() < 0.30 * this.plant.biology.growthRate) { // Massively increased leaf production
            this.growLeaf(x, y, index, nextActivePixels);
        }

        // Stems remain active
        nextActivePixels.add(index);
    },

    // Grow new stem pixels with connectivity checks
    growStem: function(x, y, index, nextActivePixels) {
        // Dramatically modified stem growth directions for aggressive vine-like behavior
        const growthDirections = [
            {dx: 0, dy: -1, weight: 18},   // Up (reduced weight to allow more horizontal spread)
            {dx: -1, dy: -1, weight: 10},  // Up-left (massively increased for vine-like growth)
            {dx: 1, dy: -1, weight: 10},   // Up-right (massively increased for vine-like growth)
            {dx: -1, dy: 0, weight: 8},    // Left (new horizontal growth for aggressive spreading)
            {dx: 1, dy: 0, weight: 8},     // Right (new horizontal growth for aggressive spreading)
            {dx: -2, dy: -1, weight: 3},   // Long reach left-up (new for extended tendrils)
            {dx: 2, dy: -1, weight: 3}     // Long reach right-up (new for extended tendrils)
        ];
        
        // Check if connected to other plant parts - stems should not grow in isolation
        let isConnectedToBranch = false;
        const neighbors = this.plant.core.getNeighborIndices(x, y);
        
        // Count connected plant parts
        let connectedPlantParts = 0;
        for (const neighbor of neighbors) {
            if (this.plant.core.type[neighbor.index] === this.plant.TYPE.PLANT) {
                connectedPlantParts++;
            }
        }
        
        // Safety check - stems should have at least one connection to another plant part
        // For small plants, allow some leniency to help them get established
        if (connectedPlantParts === 0 && this.plant.plantMetrics.stemHeight > 3) {
            // This stem somehow got isolated - it's not supported
            // Mark it for detachment on next update
            this.plant.plantConnectivity.connectedToGround[index] = 0;
            return;
        }

        // Get total weight for weighted random selection
        let totalWeight = 0;
        for (const dir of growthDirections) {
            totalWeight += dir.weight;
        }

        // Weighted random selection
        let randomWeight = Math.random() * totalWeight;
        let selectedDir = null;

        for (const dir of growthDirections) {
            randomWeight -= dir.weight;
            if (randomWeight <= 0) {
                selectedDir = dir;
                break;
            }
        }

        if (selectedDir) {
            const newX = x + selectedDir.dx;
            const newY = y + selectedDir.dy;
            const newIndex = this.plant.core.getIndex(newX, newY);

            // Can only grow into air
            if (newIndex !== -1 && this.plant.core.type[newIndex] === this.plant.TYPE.AIR) {
                // Create new stem
                this.plant.core.type[newIndex] = this.plant.TYPE.PLANT;
                this.plant.core.state[newIndex] = this.plant.STATE.STEM;

                // Share energy and water (greatly improved resource distribution for aggressive growth)
                this.plant.core.energy[newIndex] = this.plant.core.energy[index] * 0.6; // Give new stems more energy
                this.plant.core.energy[index] = this.plant.core.energy[index] * 0.6; // Parent loses less energy (120% total for growth boost)

                // Stems need abundant water for aggressive Jumanji-like growth
                const waterShare = Math.min(0.6, 0.4 + (0.2 / Math.sqrt(this.plant.plantMetrics.totalSize + 1)));
                this.plant.core.water[newIndex] = this.plant.core.water[index] * waterShare;
                this.plant.core.water[index] = this.plant.core.water[index] * (1 - waterShare * 0.4); // Lose even less water when growing

                // Mark as connected to ground (inherits connectivity from parent)
                this.plant.plantConnectivity.connectedToGround[newIndex] = 1;
                nextActivePixels.add(newIndex);
                
                // New stems are checked in the next frame
                this.plant.plantConnectivity.checkedThisFrame[newIndex] = 1;
            }
        }

        // Enhanced flower production for rapid seed dispersal
        // Only at tip endpoints for better aesthetic appearance
        if ((y < this.plant.core.height * 0.7 || Math.random() < 0.01) && this.plant.core.energy[index] > 100 && Math.random() < 0.08 * this.plant.biology.growthRate) {
            // Count surrounding plant parts to ensure it's a stem endpoint (max 1-2 connections)
            const neighbors = this.plant.core.getNeighborIndices(x, y);
            let stemCount = 0;
            
            for (const neighbor of neighbors) {
                if (this.plant.core.type[neighbor.index] === this.plant.TYPE.PLANT) {
                    stemCount++;
                }
            }
            
            // Only create flowers at stem endpoints or tips
            if (stemCount <= 2) {
                this.plant.core.state[index] = this.plant.STATE.FLOWER;
                
                // Create an actual flower shape with petals
                this.createFlowerPetals(x, y, index, nextActivePixels);
            }
        }
    },

    // Create a flower with petals around a center
    createFlowerPetals: function(x, y, index, nextActivePixels) {
        // Flower petal pattern - create actual flower shape
        const petalDirections = [
            {dx: -1, dy: 0},    // Left
            {dx: -1, dy: -1},   // Upper left
            {dx: 0, dy: -1},    // Up
            {dx: 1, dy: -1},    // Upper right
            {dx: 1, dy: 0},     // Right
            {dx: 1, dy: 1},     // Lower right
            {dx: 0, dy: 1},     // Down
            {dx: -1, dy: 1}     // Lower left
        ];
        
        // Create petals around the center flower
        let petalCount = 0;
        
        // Create a unique flower shape pattern for each flower
        // This makes each flower look slightly different
        const flowerType = Math.floor(Math.random() * 3); // 0, 1, or 2
        
        for (const dir of petalDirections) {
            // Different flower shapes based on pattern type
            if (flowerType === 0) {
                // Rounded flower with 5-6 petals
                if (petalCount >= 5 && Math.random() < 0.5) {
                    continue; // Skip some petals randomly
                }
                // Skip lower petals more often for this type
                if ((dir.dy === 1 || (dir.dy === 1 && dir.dx !== 0)) && Math.random() < 0.7) {
                    continue;
                }
            } else if (flowerType === 1) {
                // Star-like flower with alternating petals
                if (dir.dx !== 0 && dir.dy !== 0 && Math.random() < 0.7) {
                    continue; // Skip most diagonal petals
                }
            } else {
                // Random asymmetric flower
                if (Math.random() < 0.3) {
                    continue; // Random skipping for unique shapes
                }
            }
            
            const petalX = x + dir.dx;
            const petalY = y + dir.dy;
            const petalIndex = this.plant.core.getIndex(petalX, petalY);
            
            // Create petal if space is available
            if (petalIndex !== -1 && this.plant.core.type[petalIndex] === this.plant.TYPE.AIR) {
                // Create flower petal
                this.plant.core.type[petalIndex] = this.plant.TYPE.PLANT;
                this.plant.core.state[petalIndex] = this.plant.STATE.FLOWER;
                
                // Share energy and water with petal
                this.plant.core.energy[petalIndex] = this.plant.core.energy[index] * 0.4;
                this.plant.core.water[petalIndex] = this.plant.core.water[index] * 0.4;
                
                // Mark as connected to ground (inherits connectivity from parent)
                this.plant.plantConnectivity.connectedToGround[petalIndex] = 1;
                this.plant.plantConnectivity.checkedThisFrame[petalIndex] = 1;
                nextActivePixels.add(petalIndex);
                
                petalCount++;
            }
        }
    },
    
    // Grow a leaf from a stem with connectivity checks
    growLeaf: function(x, y, index, nextActivePixels) {
        // Leaves grow in more directions for denser foliage
        const leafDirections = [
            {dx: -1, dy: 0},   // Left
            {dx: 1, dy: 0},    // Right
            {dx: -1, dy: -1},  // Up-left (new for more sprawling growth)
            {dx: 1, dy: -1},   // Up-right (new for more sprawling growth)
            {dx: 0, dy: -1}    // Up (new for vertical leaves - adds density)
        ];
        
        // Make sure stem is stable enough to support a leaf
        // Count connected plant parts
        const neighbors = this.plant.core.getNeighborIndices(x, y);
        let connectedPlantParts = 0;
        
        for (const neighbor of neighbors) {
            if (this.plant.core.type[neighbor.index] === this.plant.TYPE.PLANT) {
                connectedPlantParts++;
            }
        }
        
        // Relaxed connection requirements for aggressive leafy growth
        // Even minimally supported stems can grow leaves for Jumanji-style overgrowth
        if (connectedPlantParts < 1 && Math.random() > 0.3) {
            // Still some restriction but 30% chance to grow leaf even when poorly supported
            return;
        }

        // Choose a random direction
        const dir = leafDirections[Math.floor(Math.random() * leafDirections.length)];

        const newX = x + dir.dx;
        const newY = y + dir.dy;
        const newIndex = this.plant.core.getIndex(newX, newY);

        // Can only grow into air
        if (newIndex !== -1 && this.plant.core.type[newIndex] === this.plant.TYPE.AIR) {
            // Create leaf
            this.plant.core.type[newIndex] = this.plant.TYPE.PLANT;
            this.plant.core.state[newIndex] = this.plant.STATE.LEAF;

            // Transfer some energy and water
            this.plant.core.energy[newIndex] = this.plant.core.energy[index] / 3;
            this.plant.core.energy[index] = this.plant.core.energy[index] * 2 / 3;

            this.plant.core.water[newIndex] = this.plant.core.water[index] / 3;
            this.plant.core.water[index] = this.plant.core.water[index] * 2 / 3;

            // Mark as connected to ground (inherits connectivity from parent)
            this.plant.plantConnectivity.connectedToGround[newIndex] = 1;
            this.plant.plantConnectivity.checkedThisFrame[newIndex] = 1;
            nextActivePixels.add(newIndex);
        }
    }
};