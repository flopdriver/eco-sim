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

        // Mark the current pixel as a change to ensure all processed pixels are synced
        this.changeArray[idx] = 1;

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
            case 5: // Seed
                this.processSeed(x, y, idx);
                break;
            case 6: // Dead Matter
                this.processDeadMatter(x, y, idx);
                break;
            case 7: // Worm
                this.processWorm(x, y, idx);
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

    // Process Seed
    processSeed(x, y, idx) {
        // Seeds can germinate or fall due to gravity

        // Check if there's soil below
        const downIdx = this.posToIndex(x, y + 1);
        if (y < this.height - 1 && this.typeArray[downIdx] === 1) { // soil below
            // Chance to germinate
            if (this.waterArray[downIdx] > 20 && Math.random() < 0.05) {
                this.typeArray[idx] = 3; // Convert to plant
                this.stateArray[idx] = 4; // Root state
                this.markChange(x, y);
                return;
            }
        }

        // Seeds fall due to gravity
        if (y < this.height - 1 && (this.typeArray[downIdx] === 0 || this.typeArray[downIdx] === 2)) { // air or water below
            // Move seed down
            this.typeArray[downIdx] = 5; // Seed
            this.energyArray[downIdx] = this.energyArray[idx];
            this.typeArray[idx] = 0; // Air
            this.energyArray[idx] = 0;
            this.markChange(x, y);
            this.markChange(x, y + 1);
        }
    }

    // Process Dead Matter
    processDeadMatter(x, y, idx) {
        // Dead matter falls and decomposes

        // Fall due to gravity
        const downIdx = this.posToIndex(x, y + 1);
        if (y < this.height - 1 && this.typeArray[downIdx] === 0) { // air below
            // Move dead matter down
            this.typeArray[downIdx] = 6; // Dead matter
            this.energyArray[downIdx] = this.energyArray[idx];
            this.typeArray[idx] = 0; // Air
            this.energyArray[idx] = 0;
            this.markChange(x, y);
            this.markChange(x, y + 1);
            return;
        }

        // Decompose gradually
        if (Math.random() < 0.01) {
            // Add to decomposition counter stored in metadata
            this.metadataArray[idx] = (this.metadataArray[idx] || 0) + 1;

            // If fully decomposed, convert to soil
            if (this.metadataArray[idx] > 100) {
                this.typeArray[idx] = 1; // Soil
                this.stateArray[idx] = 3; // Fertile state
                this.nutrientArray[idx] = 200;
                this.markChange(x, y);
            }
        }
    }

    // Process Worm
    processWorm(x, y, idx) {
        // Worms move through soil and consume dead matter

        // Reduce energy over time
        this.energyArray[idx] -= 1;

        // If no energy, die
        if (this.energyArray[idx] <= 0) {
            this.typeArray[idx] = 6; // Dead matter
            this.markChange(x, y);
            return;
        }

        // Move in soil
        if (Math.random() < 0.3) {
            // Get possible directions
            const directions = [
                { dx: 0, dy: 1 },  // Down
                { dx: -1, dy: 0 }, // Left
                { dx: 1, dy: 0 },  // Right
                { dx: -1, dy: 1 }, // Down-left
                { dx: 1, dy: 1 }   // Down-right
            ];

            // Shuffle directions for more random movement
            this.shuffleArray(directions);

            // Try each direction
            for (const dir of directions) {
                const nx = x + dir.dx;
                const ny = y + dir.dy;

                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const newIdx = this.posToIndex(nx, ny);

                    // Worms can move through soil
                    if (this.typeArray[newIdx] === 1) { // Soil
                        // Move worm
                        this.typeArray[newIdx] = 7; // Worm
                        this.energyArray[newIdx] = this.energyArray[idx];

                        // Leave aerated soil behind
                        this.typeArray[idx] = 1; // Soil
                        this.stateArray[idx] = 3; // Fertile
                        this.nutrientArray[idx] = 200;

                        this.markChange(x, y);
                        this.markChange(nx, ny);
                        return;
                    }

                    // Worms can consume dead matter
                    if (this.typeArray[newIdx] === 6) { // Dead matter
                        // Consume dead matter
                        this.typeArray[newIdx] = 7; // Worm
                        this.energyArray[newIdx] = this.energyArray[idx] + 50;

                        // Leave fertile soil behind
                        this.typeArray[idx] = 1; // Soil
                        this.stateArray[idx] = 3; // Fertile
                        this.nutrientArray[idx] = 200;

                        this.markChange(x, y);
                        this.markChange(nx, ny);
                        return;
                    }
                }
            }
        }
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
    }

    // Process water movement
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

            // Flow into soil if not saturated
            if (this.typeArray[belowIdx] === 1 && this.waterArray[belowIdx] < 255) {
                const transferAmount = Math.min(this.waterArray[idx], 255 - this.waterArray[belowIdx]);

                // Transfer water to soil
                this.waterArray[belowIdx] += transferAmount;
                this.waterArray[idx] -= transferAmount;

                // If all water transferred, change type to air
                if (this.waterArray[idx] <= 0) {
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
        this.shuffleArray(directions); // Randomize direction

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

        // Occasional evaporation for surface water
        if (y > 0 && this.typeArray[this.posToIndex(x, y-1)] === 0 && Math.random() < 0.001) {
            this.waterArray[idx] -= 1;
            if (this.waterArray[idx] <= 0) {
                this.typeArray[idx] = 0; // Air
                this.waterArray[idx] = 0;
            }
            this.markChange(x, y);
        }
    }

    // Process plant growth and behavior
    processPlant(x, y, idx) {
        // Photosynthesis and growth for plants
        const plantState = this.stateArray[idx];

        // Leaves convert light to energy
        if (plantState === 6) { // Leaf
            if (this.waterArray[idx] > 10) {
                // Convert light to energy
                this.energyArray[idx] += 1;
                this.waterArray[idx] -= 0.2;

                // Leaves have chance to grow more leaves or create flowers
                if (Math.random() < 0.01 && this.energyArray[idx] > 100) {
                    // Find air pixels nearby
                    const directions = [[-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]];
                    this.shuffleArray(directions);

                    for (const [dx, dy] of directions) {
                        const nx = x + dx;
                        const ny = y + dy;

                        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                            const neighborIdx = this.posToIndex(nx, ny);

                            if (this.typeArray[neighborIdx] === 0) { // air
                                if (Math.random() < 0.3) {
                                    // Create flower
                                    this.typeArray[neighborIdx] = 3; // Plant
                                    this.stateArray[neighborIdx] = 7; // Flower
                                } else {
                                    // Create leaf
                                    this.typeArray[neighborIdx] = 3; // Plant
                                    this.stateArray[neighborIdx] = 6; // Leaf
                                }

                                this.energyArray[neighborIdx] = this.energyArray[idx] / 2;
                                this.energyArray[idx] = this.energyArray[idx] / 2;
                                this.waterArray[neighborIdx] = this.waterArray[idx] / 2;
                                this.waterArray[idx] = this.waterArray[idx] / 2;

                                this.markChange(nx, ny);
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Stems grow upward and can create leaves
        else if (plantState === 5) { // Stem
            if (this.energyArray[idx] > 80 && this.waterArray[idx] > 15 && Math.random() < 0.05) {
                // Find air pixels for growth
                const directions = [[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]];
                this.shuffleArray(directions);

                for (const [dx, dy] of directions) {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                        const neighborIdx = this.posToIndex(nx, ny);

                        if (this.typeArray[neighborIdx] === 0) { // air
                            if (dy === -1 && Math.random() < 0.7) { // Prefer growing upward
                                // Create stem
                                this.typeArray[neighborIdx] = 3; // Plant
                                this.stateArray[neighborIdx] = 5; // Stem
                            } else if (Math.random() < 0.4) {
                                // Create leaf
                                this.typeArray[neighborIdx] = 3; // Plant
                                this.stateArray[neighborIdx] = 6; // Leaf
                            }

                            this.energyArray[neighborIdx] = this.energyArray[idx] * 0.7;
                            this.energyArray[idx] *= 0.7;
                            this.waterArray[neighborIdx] = this.waterArray[idx] * 0.7;
                            this.waterArray[idx] *= 0.7;

                            this.markChange(nx, ny);
                            break;
                        }
                    }
                }
            }
        }

        // Roots absorb water and grow downward
        else if (plantState === 4) { // Root
            // Absorb water from surrounding soil
            const neighbors = [];
            for (let ny = y; ny <= Math.min(this.height-1, y+2); ny++) {
                for (let nx = Math.max(0, x-1); nx <= Math.min(this.width-1, x+1); nx++) {
                    if (nx === x && ny === y) continue;
                    neighbors.push({x: nx, y: ny});
                }
            }

            for (const {x: nx, y: ny} of neighbors) {
                const neighborIdx = this.posToIndex(nx, ny);

                if (this.typeArray[neighborIdx] === 1 && this.waterArray[neighborIdx] > 10) { // Soil with water
                    // Absorb water
                    const absorbAmount = Math.min(5, this.waterArray[neighborIdx]);
                    this.waterArray[neighborIdx] -= absorbAmount;
                    this.waterArray[idx] += absorbAmount;

                    this.markChange(nx, ny);
                    break;
                }
            }

            // Grow downward or sideways
            if (this.energyArray[idx] > 60 && Math.random() < 0.03) {
                const directions = [[0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0]]; // Prefer downward
                this.shuffleArray(directions);

                for (const [dx, dy] of directions) {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                        const neighborIdx = this.posToIndex(nx, ny);

                        if (this.typeArray[neighborIdx] === 1) { // Soil
                            // Create root in soil
                            this.typeArray[neighborIdx] = 3; // Plant
                            this.stateArray[neighborIdx] = 4; // Root

                            this.energyArray[neighborIdx] = this.energyArray[idx] * 0.7;
                            this.energyArray[idx] *= 0.7;
                            this.waterArray[neighborIdx] = this.waterArray[idx] * 0.7;
                            this.waterArray[idx] *= 0.7;

                            this.markChange(nx, ny);
                            break;
                        }
                    }
                }
            }
        }

        // Flowers can produce seeds
        else if (plantState === 7) { // Flower
            if (this.energyArray[idx] > 100 && Math.random() < 0.02) {
                // Find air pixels for seed placement
                const directions = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
                this.shuffleArray(directions);

                for (const [dx, dy] of directions) {
                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                        const neighborIdx = this.posToIndex(nx, ny);

                        if (this.typeArray[neighborIdx] === 0) { // air
                            // Create seed
                            this.typeArray[neighborIdx] = 5; // Seed
                            this.energyArray[neighborIdx] = 100;
                            this.energyArray[idx] -= 50;

                            this.markChange(nx, ny);
                            break;
                        }
                    }
                }
            }
        }

        // Plants consume energy and water over time
        this.energyArray[idx] -= 0.2;

        // If energy depleted, plant dies
        if (this.energyArray[idx] <= 0) {
            this.typeArray[idx] = 6; // Dead matter
            this.markChange(x, y);
        }
    }

    // Process insect movement and behavior
    processInsect(x, y, idx) {
        // Consume energy over time
        this.energyArray[idx] -= 1;

        // If no energy, die
        if (this.energyArray[idx] <= 0) {
            this.typeArray[idx] = 6; // Dead matter
            this.markChange(x, y);
            return;
        }

        // Check for plants to eat
        const neighbors = [];
        for (let ny = Math.max(0, y-1); ny <= Math.min(this.height-1, y+1); ny++) {
            for (let nx = Math.max(0, x-1); nx <= Math.min(this.width-1, x+1); nx++) {
                if (nx === x && ny === y) continue;
                neighbors.push({x: nx, y: ny});
            }
        }

        // Shuffle neighbors for more random behavior
        this.shuffleArray(neighbors);

        // Try to eat plants
        for (const {x: nx, y: ny} of neighbors) {
            const neighborIdx = this.posToIndex(nx, ny);

            if (this.typeArray[neighborIdx] === 3) { // Plant
                // Eat plant and gain energy
                this.energyArray[idx] += 30;
                this.typeArray[neighborIdx] = 6; // Convert to dead matter
                this.markChange(nx, ny);
                break;
            }
        }

        // Move randomly
        if (Math.random() < 0.3) {
            // Get available directions
            const availableDirections = [];

            for (const {x: nx, y: ny} of neighbors) {
                const neighborIdx = this.posToIndex(nx, ny);

                if (this.typeArray[neighborIdx] === 0) { // air
                    availableDirections.push({x: nx, y: ny, idx: neighborIdx});
                }
            }

            // If there are available directions, move
            if (availableDirections.length > 0) {
                const destination = availableDirections[Math.floor(Math.random() * availableDirections.length)];

                // Move insect
                this.typeArray[destination.idx] = 4; // Insect
                this.energyArray[destination.idx] = this.energyArray[idx];

                this.typeArray[idx] = 0; // Air
                this.energyArray[idx] = 0;

                this.markChange(x, y);
                this.markChange(destination.x, destination.y);
            }
        }
    }

    // Update method called each frame
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
        // Simplified day/night cycle

        // Rain simulation - add water to random top pixels
        if (Math.random() < 0.005) { // 0.5% chance of rain each tick
            for (let x = 0; x < this.width; x++) {
                if (Math.random() < 0.05) { // 5% of top pixels get rain
                    const idx = this.posToIndex(x, 0);

                    if (this.typeArray[idx] === 0) { // Air
                        this.typeArray[idx] = 2; // Water
                        this.waterArray[idx] = 200; // Random water amount
                        this.markChange(x, 0);
                    }
                }
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

    // Helper function to shuffle an array
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
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
                if (state === 6) { // Leaf
                    const health = 100 + Math.floor(this.energyArray[idx] / 5);
                    return `rgb(10, ${health}, 50)`;
                } else if (state === 5) { // Stem
                    return 'rgb(50, 120, 30)';
                } else if (state === 4) { // Root
                    return 'rgb(120, 80, 40)';
                } else if (state === 7) { // Flower
                    return 'rgb(255, 200, 50)';
                }
                return 'rgb(20, 100, 40)';

            case 4: // Insect
                const energy = Math.floor(50 + (this.energyArray[idx] / 255) * 150);
                return `rgb(${energy}, ${energy}, 20)`;

            case 5: // Seed
                return 'rgb(120, 100, 60)';

            case 6: // Dead matter
                return 'rgb(100, 90, 70)';

            case 7: // Worm
                return 'rgb(180, 130, 130)';

            default:
                return 'rgb(0, 0, 0)'; // Black for unknown
        }
    }

    // Render the simulation to a canvas context
    render(ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, this.width, this.height);

        // Option 1: Render full simulation (slower)
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                ctx.fillStyle = this.getPixelColor(x, y);
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
}