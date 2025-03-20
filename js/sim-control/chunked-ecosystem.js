// Ecosystem Simulation - Chunked Processing System

class ChunkedEcosystem {
    constructor(width, height, chunkSize = 16) {
        // Main simulation dimensions
        this.width = width;
        this.height = height;

        // Chunk management
        this.chunkSize = chunkSize;
        this.chunksX = Math.ceil(width / chunkSize);
        this.chunksY = Math.ceil(height / chunkSize);

        // Initialize property arrays (using TypedArrays for performance)
        this.initializeArrays();

        // Chunk activity tracking
        this.activeChunks = new Set();
        this.chunkActivity = new Uint8Array(this.chunksX * this.chunksY);
        this.chunkNeighborCache = this.buildChunkNeighborCache();

        // Activity threshold for chunk processing
        this.activityThreshold = 3; // Chunks remain active for 3 ticks after last activity
    }

    initializeArrays() {
        const size = this.width * this.height;

        // Main property arrays using TypedArrays for efficiency
        this.typeArray = new Uint8Array(size);        // Type: air, soil, water, plant, insect
        this.stateArray = new Uint8Array(size);       // State variations
        this.waterArray = new Uint8Array(size);       // Water content: 0-255
        this.nutrientArray = new Uint8Array(size);    // Nutrient levels: 0-255
        this.energyArray = new Uint8Array(size);      // Energy/sunlight: 0-255
        this.metadataArray = new Uint32Array(size);   // Age, health, etc. packed into bits

        // Change tracking array to detect modifications
        this.changeArray = new Uint8Array(size);      // Tracks pixels that changed this tick
    }

    // Build lookup cache for neighboring chunks
    buildChunkNeighborCache() {
        const cache = new Array(this.chunksX * this.chunksY);

        for (let cy = 0; cy < this.chunksY; cy++) {
            for (let cx = 0; cx < this.chunksX; cx++) {
                const chunkIdx = cy * this.chunksX + cx;
                const neighbors = [];

                // Add all neighboring chunks (including self)
                for (let ny = Math.max(0, cy - 1); ny <= Math.min(this.chunksY - 1, cy + 1); ny++) {
                    for (let nx = Math.max(0, cx - 1); nx <= Math.min(this.chunksX - 1, cx + 1); nx++) {
                        neighbors.push(ny * this.chunksX + nx);
                    }
                }

                cache[chunkIdx] = neighbors;
            }
        }

        return cache;
    }

    // Convert position to index
    posToIndex(x, y) {
        return y * this.width + x;
    }

    // Convert position to chunk coordinates
    posToChunk(x, y) {
        const cx = Math.floor(x / this.chunkSize);
        const cy = Math.floor(y / this.chunkSize);
        return cy * this.chunksX + cx;
    }

    // Mark a pixel as changed, activating its chunk and neighbors
    markChange(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;

        const idx = this.posToIndex(x, y);
        this.changeArray[idx] = 1;

        // Get chunk and mark as active
        const chunkIdx = this.posToChunk(x, y);
        this.activateChunk(chunkIdx);

        // If the pixel is at a chunk boundary, activate neighboring chunks too
        const chunkX = x % this.chunkSize;
        const chunkY = y % this.chunkSize;

        if (chunkX === 0 && x > 0) this.activateChunk(this.posToChunk(x - 1, y));
        if (chunkX === this.chunkSize - 1 && x < this.width - 1) this.activateChunk(this.posToChunk(x + 1, y));
        if (chunkY === 0 && y > 0) this.activateChunk(this.posToChunk(x, y - 1));
        if (chunkY === this.chunkSize - 1 && y < this.height - 1) this.activateChunk(this.posToChunk(x, y + 1));
    }

    // Activate a chunk and its neighbors
    activateChunk(chunkIdx) {
        // Set chunk activity to max
        this.chunkActivity[chunkIdx] = this.activityThreshold;
        this.activeChunks.add(chunkIdx);

        // Also mark border chunks as active with lower priority
        const neighbors = this.chunkNeighborCache[chunkIdx];
        for (const neighborIdx of neighbors) {
            if (this.chunkActivity[neighborIdx] < 1) {
                this.chunkActivity[neighborIdx] = 1;
                this.activeChunks.add(neighborIdx);
            }
        }
    }

    // Process active chunks
    processActiveChunks() {
        // Create new set for next active chunks
        const nextActiveChunks = new Set();

        // Process each active chunk
        for (const chunkIdx of this.activeChunks) {
            // Skip if activity has expired
            if (this.chunkActivity[chunkIdx] <= 0) continue;

            // Process chunk
            this.processChunk(chunkIdx);

            // Decrement activity counter
            this.chunkActivity[chunkIdx]--;

            // If still active, add to next set
            if (this.chunkActivity[chunkIdx] > 0) {
                nextActiveChunks.add(chunkIdx);
            }
        }

        // Update active chunks
        this.activeChunks = nextActiveChunks;
    }

    // Process a single chunk
    processChunk(chunkIdx) {
        const cy = Math.floor(chunkIdx / this.chunksX);
        const cx = chunkIdx % this.chunksX;

        // Get chunk boundaries
        const startX = cx * this.chunkSize;
        const startY = cy * this.chunkSize;
        const endX = Math.min(startX + this.chunkSize, this.width);
        const endY = Math.min(startY + this.chunkSize, this.height);

        // Process all pixels in chunk
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                this.processPixel(x, y);
            }
        }
    }

    // Process individual pixel - contains the actual simulation logic
    processPixel(x, y) {
        const idx = this.posToIndex(x, y);
        const pixelType = this.typeArray[idx];

        // Skip processing for empty/air pixels unless they're next to active pixels
        if (pixelType === 0 && !this.hasActiveNeighbor(x, y)) return;

        // Apply simulation rules based on pixel type
        switch (pixelType) {
            case 1: // Soil
                this.processSoil(x, y, idx);
                break;
            case 2: // Water
                this.processWater(x, y, idx);
                break;
            case 3: // Plant
                this.processPlant(x, y, idx);
                break;
            case 4: // Insect
                this.processInsect(x, y, idx);
                break;
        }
    }

    // Check if pixel has any active neighbors
    hasActiveNeighbor(x, y) {
        // Check 8 surrounding pixels
        for (let ny = Math.max(0, y - 1); ny <= Math.min(this.height - 1, y + 1); ny++) {
            for (let nx = Math.max(0, x - 1); nx <= Math.min(this.width - 1, x + 1); nx++) {
                if (nx === x && ny === y) continue;

                const nIdx = this.posToIndex(nx, ny);
                if (this.changeArray[nIdx]) return true;
            }
        }
        return false;
    }

    // Example soil processing logic
    processSoil(x, y, idx) {
        // Water percolation
        if (this.waterArray[idx] > 0) {
            // Try to move water downward
            const belowIdx = this.posToIndex(x, y + 1);

            if (y < this.height - 1 && this.typeArray[belowIdx] === 1 && this.waterArray[belowIdx] < 255) {
                // Calculate transfer amount (more water moves faster)
                const transferAmount = Math.max(1, Math.floor(this.waterArray[idx] / 10));
                const actualTransfer = Math.min(transferAmount, 255 - this.waterArray[belowIdx]);

                // Transfer water
                this.waterArray[idx] -= actualTransfer;
                this.waterArray[belowIdx] += actualTransfer;

                // Mark changes
                this.markChange(x, y);
                this.markChange(x, y + 1);
            }

            // Lateral water movement (if enough water pressure)
            if (this.waterArray[idx] > 100) {
                const directions = [[1, 0], [-1, 0]]; // Right, Left

                for (const [dx, dy] of directions) {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                        const neighborIdx = this.posToIndex(nx, ny);

                        if (this.typeArray[neighborIdx] === 1 && this.waterArray[neighborIdx] < this.waterArray[idx] - 20) {
                            // Calculate transfer amount
                            const transferAmount = Math.floor((this.waterArray[idx] - this.waterArray[neighborIdx]) / 4);
                            const actualTransfer = Math.min(transferAmount, 255 - this.waterArray[neighborIdx]);

                            // Transfer water
                            this.waterArray[idx] -= actualTransfer;
                            this.waterArray[neighborIdx] += actualTransfer;

                            // Mark changes
                            this.markChange(x, y);
                            this.markChange(nx, ny);
                        }
                    }
                }
            }
        }

        // Additional soil processes would go here (nutrient cycling, etc.)
    }

    // Example water processing logic
    processWater(x, y, idx) {
        // Water falls due to gravity
        if (y < this.height - 1) {
            const belowIdx = this.posToIndex(x, y + 1);

            // Fall into empty space
            if (this.typeArray[belowIdx] === 0) {
                this.typeArray[belowIdx] = 2; // Water
                this.typeArray[idx] = 0;      // Empty
                this.waterArray[belowIdx] = this.waterArray[idx];
                this.waterArray[idx] = 0;

                // Mark changes
                this.markChange(x, y);
                this.markChange(x, y + 1);
                return;
            }

            // Flow into soil
            if (this.typeArray[belowIdx] === 1 && this.waterArray[belowIdx] < 255) {
                const transferAmount = Math.min(this.waterArray[idx], 255 - this.waterArray[belowIdx]);

                // Transfer water to soil
                this.waterArray[belowIdx] += transferAmount;
                this.waterArray[idx] -= transferAmount;

                // If all water transferred, change type to air
                if (this.waterArray[idx] === 0) {
                    this.typeArray[idx] = 0;
                }

                // Mark changes
                this.markChange(x, y);
                this.markChange(x, y + 1);
                return;
            }
        }

        // Water spreads horizontally
        const directions = [[1, 0], [-1, 0]]; // Right, Left
        directions.sort(() => Math.random() - 0.5); // Randomize direction

        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y;

            if (nx >= 0 && nx < this.width) {
                const neighborIdx = this.posToIndex(nx, ny);

                // Spread to empty space
                if (this.typeArray[neighborIdx] === 0) {
                    // Split water between current and neighbor
                    const transferAmount = Math.floor(this.waterArray[idx] / 2);

                    if (transferAmount > 0) {
                        this.typeArray[neighborIdx] = 2; // Water
                        this.waterArray[neighborIdx] = transferAmount;
                        this.waterArray[idx] -= transferAmount;

                        // Mark changes
                        this.markChange(x, y);
                        this.markChange(nx, ny);
                        break; // Only spread in one direction per tick
                    }
                }
            }
        }

        // Evaporation logic would go here
    }

    // Example plant processing logic
    processPlant(x, y, idx) {
        // Plant growth logic
        const plantState = this.stateArray[idx];

        // Check for resource availability
        const hasWater = this.checkWaterAvailability(x, y);
        const hasNutrients = this.checkNutrientAvailability(x, y);
        const hasLight = y < this.height / 2; // Simplified light check

        // Basic growth condition
        if (hasWater && hasNutrients && hasLight) {
            // Consume resources
            this.consumeResources(x, y);

            // Growth chance
            if (Math.random() < 0.1) {
                this.attemptPlantGrowth(x, y, plantState);
            }
        }

        // Plant death if no resources
        if (!hasWater && Math.random() < 0.05) {
            // Plant dies
            this.typeArray[idx] = 1; // Convert back to soil
            this.stateArray[idx] = 0;
            this.nutrientArray[idx] += 20; // Dead plants fertilize soil

            // Mark change
            this.markChange(x, y);
        }
    }

    // Check for water availability to plant
    checkWaterAvailability(x, y) {
        // Look for water in surrounding soil pixels
        for (let ny = y; ny <= Math.min(this.height - 1, y + 5); ny++) {
            const checkIdx = this.posToIndex(x, ny);

            // Check if it's soil with water
            if (this.typeArray[checkIdx] === 1 && this.waterArray[checkIdx] > 20) {
                return true;
            }
        }
        return false;
    }

    // Check for nutrient availability
    checkNutrientAvailability(x, y) {
        // Look for nutrients in surrounding soil pixels
        for (let ny = y; ny <= Math.min(this.height - 1, y + 5); ny++) {
            const checkIdx = this.posToIndex(x, ny);

            // Check if it's soil with nutrients
            if (this.typeArray[checkIdx] === 1 && this.nutrientArray[checkIdx] > 10) {
                return true;
            }
        }
        return false;
    }

    // Consume resources for plant growth
    consumeResources(x, y) {
        for (let ny = y; ny <= Math.min(this.height - 1, y + 5); ny++) {
            const checkIdx = this.posToIndex(x, ny);

            // Reduce water in soil
            if (this.typeArray[checkIdx] === 1 && this.waterArray[checkIdx] > 5) {
                this.waterArray[checkIdx] -= 5;
                this.markChange(x, ny);
                break;
            }
        }

        for (let ny = y; ny <= Math.min(this.height - 1, y + 5); ny++) {
            const checkIdx = this.posToIndex(x, ny);

            // Reduce nutrients in soil
            if (this.typeArray[checkIdx] === 1 && this.nutrientArray[checkIdx] > 2) {
                this.nutrientArray[checkIdx] -= 2;
                this.markChange(x, ny);
                break;
            }
        }
    }

    // Attempt to grow plant in available direction
    attemptPlantGrowth(x, y, plantState) {
        const growthDirections = [];

        // Stems grow upward
        if (plantState === 1) {
            growthDirections.push([0, -1]); // Up
            growthDirections.push([1, 0]);  // Right
            growthDirections.push([-1, 0]); // Left
        }
        // Roots grow downward
        else if (plantState === 2) {
            growthDirections.push([0, 1]);  // Down
            growthDirections.push([1, 1]);  // Down-Right
            growthDirections.push([-1, 1]); // Down-Left
        }

        // Try growth in available directions
        for (const [dx, dy] of growthDirections) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                const growthIdx = this.posToIndex(nx, ny);

                // Only grow into empty space or soil (for roots)
                if (this.typeArray[growthIdx] === 0 ||
                    (this.typeArray[growthIdx] === 1 && plantState === 2)) {

                    // Create new plant pixel
                    this.typeArray[growthIdx] = 3; // Plant
                    this.stateArray[growthIdx] = plantState;

                    // Mark change
                    this.markChange(nx, ny);
                    break; // Only grow in one direction per tick
                }
            }
        }
    }

    // Example insect processing logic
    processInsect(x, y, idx) {
        // Insects move and seek food
        if (Math.random() < 0.3) { // 30% chance to move each tick
            this.moveInsect(x, y, idx);
        }

        // Feeding logic
        if (this.isNextToPlant(x, y)) {
            this.energyArray[idx] = Math.min(255, this.energyArray[idx] + 10);
            this.consumePlant(x, y);
        }

        // Energy consumption
        this.energyArray[idx] = Math.max(0, this.energyArray[idx] - 1);

        // Death from starvation
        if (this.energyArray[idx] === 0 && Math.random() < 0.1) {
            this.typeArray[idx] = 0; // Insect disappears
            this.markChange(x, y);
        }
    }

    // Move insect based on food-seeking behavior
    moveInsect(x, y, idx) {
        const possibleMoves = [];

        // Check all adjacent pixels
        for (let ny = Math.max(0, y - 1); ny <= Math.min(this.height - 1, y + 1); ny++) {
            for (let nx = Math.max(0, x - 1); nx <= Math.min(this.width - 1, x + 1); nx++) {
                if (nx === x && ny === y) continue;

                const moveIdx = this.posToIndex(nx, ny);

                // Can move to empty space or onto plants
                if (this.typeArray[moveIdx] === 0 || this.typeArray[moveIdx] === 3) {
                    // Prefer moving to plants when hungry
                    const score = this.typeArray[moveIdx] === 3 ? 3 : 1;
                    possibleMoves.push({ nx, ny, score });
                }
            }
        }

        // Sort moves by score and pick best option
        if (possibleMoves.length > 0) {
            possibleMoves.sort((a, b) => b.score - a.score);

            // If low energy, strongly prefer food
            if (this.energyArray[idx] < 50) {
                // Filter for highest scoring moves
                const bestScore = possibleMoves[0].score;
                const bestMoves = possibleMoves.filter(move => move.score === bestScore);

                // Pick random from best moves
                const move = bestMoves[Math.floor(Math.random() * bestMoves.length)];
                this.moveInsectTo(x, y, move.nx, move.ny);
            } else {
                // Random movement with weight toward good options
                const totalScore = possibleMoves.reduce((sum, move) => sum + move.score, 0);
                let targetScore = Math.random() * totalScore;

                for (const move of possibleMoves) {
                    targetScore -= move.score;
                    if (targetScore <= 0) {
                        this.moveInsectTo(x, y, move.nx, move.ny);
                        break;
                    }
                }
            }
        }
    }

    // Move insect to new position
    moveInsectTo(x, y, nx, ny) {
        const oldIdx = this.posToIndex(x, y);
        const newIdx = this.posToIndex(nx, ny);

        // Eat plant if moving onto it
        const isEating = this.typeArray[newIdx] === 3;

        // Copy insect properties to new position
        this.typeArray[newIdx] = 4; // Insect
        this.stateArray[newIdx] = this.stateArray[oldIdx];
        this.energyArray[newIdx] = this.energyArray[oldIdx];
        this.metadataArray[newIdx] = this.metadataArray[oldIdx];

        // Clear old position
        this.typeArray[oldIdx] = 0;
        this.stateArray[oldIdx] = 0;
        this.energyArray[oldIdx] = 0;
        this.metadataArray[oldIdx] = 0;

        // Mark changes
        this.markChange(x, y);
        this.markChange(nx, ny);
    }

    // Check if insect is next to a plant
    isNextToPlant(x, y) {
        for (let ny = Math.max(0, y - 1); ny <= Math.min(this.height - 1, y + 1); ny++) {
            for (let nx = Math.max(0, x - 1); nx <= Math.min(this.width - 1, x + 1); nx++) {
                if (nx === x && ny === y) continue;

                const checkIdx = this.posToIndex(nx, ny);
                if (this.typeArray[checkIdx] === 3) {
                    return true;
                }
            }
        }
        return false;
    }

    // Consume adjacent plant
    consumePlant(x, y) {
        for (let ny = Math.max(0, y - 1); ny <= Math.min(this.height - 1, y + 1); ny++) {
            for (let nx = Math.max(0, x - 1); nx <= Math.min(this.width - 1, x + 1); nx++) {
                if (nx === x && ny === y) continue;

                const checkIdx = this.posToIndex(nx, ny);
                if (this.typeArray[checkIdx] === 3 && Math.random() < 0.2) {
                    // Convert plant back to soil with extra nutrients
                    this.typeArray[checkIdx] = 1;
                    this.stateArray[checkIdx] = 0;
                    this.nutrientArray[checkIdx] += 15;

                    // Mark change
                    this.markChange(nx, ny);
                    return;
                }
            }
        }
    }

    // Main simulation update function
    update() {
        // Reset change tracking array
        this.changeArray.fill(0);

        // Process active chunks
        this.processActiveChunks();

        // Global environment effects (rain, day/night cycle)
        this.processGlobalEffects();

        // Add border chunks to active set for the next tick
        this.addBorderChunks();
    }

    // Process global environmental effects
    processGlobalEffects() {
        // Day/night cycle logic
        // Light levels would affect plant growth and evaporation

        // Rain simulation
        if (Math.random() < 0.01) { // 1% chance of rain each tick
            this.simulateRain();
        }
    }

    // Simulate rainfall
    simulateRain() {
        // Determine intensity and duration of rain
        const intensity = Math.random() * 0.2; // 0-20% of top pixels get rain

        // Add water to random top pixels
        for (let x = 0; x < this.width; x++) {
            if (Math.random() < intensity) {
                const idx = this.posToIndex(x, 0);

                // Create water or add to existing water
                if (this.typeArray[idx] === 0) {
                    this.typeArray[idx] = 2; // Water
                    this.waterArray[idx] = 200 + Math.floor(Math.random() * 55); // Random water amount
                } else if (this.typeArray[idx] === 2) {
                    this.waterArray[idx] = Math.min(255, this.waterArray[idx] + 50);
                }

                // Mark change
                this.markChange(x, 0);
            }
        }
    }

    // Add border chunks around current active chunks to active set
    addBorderChunks() {
        const borderChunks = new Set();

        // Check borders of all active chunks
        for (const chunkIdx of this.activeChunks) {
            const neighbors = this.chunkNeighborCache[chunkIdx];

            for (const neighborIdx of neighbors) {
                if (!this.activeChunks.has(neighborIdx)) {
                    borderChunks.add(neighborIdx);
                }
            }
        }

        // Add border chunks to active set with low activity
        for (const borderIdx of borderChunks) {
            if (this.chunkActivity[borderIdx] <= 0) {
                this.chunkActivity[borderIdx] = 1;
                this.activeChunks.add(borderIdx);
            }
        }
    }

    // Initialize ecosystem with basic elements
    initializeEcosystem() {
        // Add ground layer
        const groundLevel = Math.floor(this.height * 0.7);

        for (let y = groundLevel; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = this.posToIndex(x, y);

                // Create soil
                this.typeArray[idx] = 1; // Soil

                // Initial nutrients and water
                this.nutrientArray[idx] = 50 + Math.floor(Math.random() * 50);
                this.waterArray[idx] = 20 + Math.floor(Math.random() * 30);

                // Mark as active to start
                this.markChange(x, y);
            }
        }

        // Add initial plants
        const plantCount = Math.floor(this.width * 0.1); // 10% of width gets plants

        for (let i = 0; i < plantCount; i++) {
            const x = Math.floor(Math.random() * this.width);
            const y = groundLevel - 1;
            const idx = this.posToIndex(x, y);

            // Create stem pixel
            this.typeArray[idx] = 3; // Plant
            this.stateArray[idx] = 1; // Stem

            // Create root pixel
            const rootIdx = this.posToIndex(x, groundLevel);
            this.typeArray[rootIdx] = 3; // Plant
            this.stateArray[rootIdx] = 2; // Root

            // Mark changes
            this.markChange(x, y);
            this.markChange(x, groundLevel);
        }

        // Add initial insects
        const insectCount = Math.floor(this.width * 0.02); // 2% of width gets insects

        for (let i = 0; i < insectCount; i++) {
            const x = Math.floor(Math.random() * this.width);
            const y = groundLevel - 2;
            const idx = this.posToIndex(x, y);

            // Create insect
            this.typeArray[idx] = 4; // Insect
            this.energyArray[idx] = 150; // Initial energy

            // Mark change
            this.markChange(x, y);
        }
    }

    // Get color for rendering pixel
    getPixelColor(x, y) {
        const idx = this.posToIndex(x, y);
        const type = this.typeArray[idx];
        const state = this.stateArray[idx];

        switch (type) {
            case 0: // Air/Empty
                return 'rgb(200, 230, 255)';

            case 1: // Soil
                const darkness = Math.floor(40 + (this.waterArray[idx] / 255) * 60);
                const fertility = Math.floor(30 + (this.nutrientArray[idx] / 255) * 80);
                return `rgb(${100 - darkness}, ${70 + fertility - darkness}, ${30 - darkness})`;

            case 2: // Water
                const waterLevel = 150 + (this.waterArray[idx] / 255) * 105;
                return `rgb(10, 100, ${waterLevel})`;

            case 3: // Plant
                if (state === 1) { // Stem/Leaf
                    const health = 100 + Math.floor(this.energyArray[idx] / 5);
                    return `rgb(10, ${health}, 50)`;
                } else { // Root
                    return 'rgb(120, 80, 40)';
                }

            case 4: // Insect
                const energy = Math.floor(50 + (this.energyArray[idx] / 255) * 150);
                return `rgb(${energy}, ${energy}, 20)`;

            default:
                return 'rgb(0, 0, 0)'; // Black for unknown
        }
    }

    // Render the simulation to a canvas context
    render(ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, this.width, this.height);

        // Option 1: Render full simulation (slower)
        /*
        for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
            ctx.fillStyle = this.getPixelColor(x, y);
            ctx.fillRect(x, y, 1, 1);
          }
        }
        */

        // Option 2: Render only active chunks (much faster)
        for (const chunkIdx of this.activeChunks) {
            const cy = Math.floor(chunkIdx / this.chunksX);
            const cx = chunkIdx % this.chunksX;

            const startX = cx * this.chunkSize;
            const startY = cy * this.chunkSize;
            const endX = Math.min(startX + this.chunkSize, this.width);
            const endY = Math.min(startY + this.chunkSize, this.height);

            // Create ImageData for chunk
            const imgData = ctx.createImageData(endX - startX, endY - startY);
            const data = imgData.data;

            // Fill pixel data
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const idx = this.posToIndex(x, y);
                    const pixelType = this.typeArray[idx];

                    // Calculate position in ImageData array
                    const imgIdx = ((y - startY) * (endX - startX) + (x - startX)) * 4;

                    // Set color based on pixel type
                    const color = this.getPixelColor(x, y);
                    const matches = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

                    if (matches) {
                        data[imgIdx] = parseInt(matches[1]);     // R
                        data[imgIdx + 1] = parseInt(matches[2]); // G
                        data[imgIdx + 2] = parseInt(matches[3]); // B
                        data[imgIdx + 3] = 255;                  // A (fully opaque)
                    }
                }
            }

            // Draw the ImageData
            ctx.putImageData(imgData, startX, startY);
        }

        // Option 3: For debugging, draw chunk boundaries
        /*
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        for (let cy = 0; cy < this.chunksY; cy++) {
          for (let cx = 0; cx < this.chunksX; cx++) {
            const chunkIdx = cy * this.chunksX + cx;

            if (this.activeChunks.has(chunkIdx)) {
              ctx.strokeRect(
                cx * this.chunkSize,
                cy * this.chunkSize,
                this.chunkSize,
                this.chunkSize
              );
            }
          }
        }
        */
    }
}