// Performance Manager - Tracks performance and optimizes active pixels
const PerformanceManager = {
    // Reference to main controller
    controller: null,

    // Performance tracking
    lastUpdate: 0,
    lastStatsUpdate: 0,
    fps: 0,

    // Active pixel management
    maxActivePixels: 500000, // Increased from 200000 to 500000
    pruningThreshold: 0.8, // Start pruning when we reach 80% of max
    
    // Gradual pruning settings
    gradualPruningEnabled: true,
    pruningInProgress: false,
    pixelsToRemovePerFrame: 5000, // Number of pixels to remove each frame during gradual pruning
    pixelsToRemove: [],
    targetPixelCount: 0,

    // Initialize performance manager
    init: function(controller) {
        console.log("Initializing performance manager...");
        this.controller = controller;
        this.resetTiming();
        return this;
    },

    // Reset timing variables
    resetTiming: function() {
        this.lastUpdate = performance.now();
        this.lastStatsUpdate = performance.now();
        this.fps = 60; // Initial estimate
    },

    // Start timing a new frame
    startFrame: function() {
        this.frameStartTime = performance.now();
    },

    // End timing for the current frame and calculate FPS
    endFrame: function() {
        const currentTime = performance.now();
        this.fps = 1000 / (currentTime - this.lastUpdate);
        this.lastUpdate = currentTime;
    },

    // Manage active pixels with performance considerations
    manageActivePixels: function(pixelSet) {
        // Continue gradual pruning if in progress
        if (this.pruningInProgress) {
            this.continuePruningPixels(pixelSet);
            return;
        }
        
        // Only start pruning if we exceed the threshold
        if (pixelSet.size > this.maxActivePixels * this.pruningThreshold) {
            console.warn(`Active pixels (${pixelSet.size}) approaching limit`);
            
            if (this.gradualPruningEnabled) {
                this.startGradualPruning(pixelSet);
            } else {
                this.pruneActivePixels(pixelSet);
            }
        }
    },
    
    // Start gradual pruning process
    startGradualPruning: function(pixelSet) {
        // Calculate target size (maintain some buffer below max)
        this.targetPixelCount = Math.floor(this.maxActivePixels * 0.7);
        
        // Calculate how many pixels to remove total
        const totalToRemove = pixelSet.size - this.targetPixelCount;
        
        if (totalToRemove <= 0) return; // Nothing to do
        
        console.log(`Starting gradual pruning to remove ${totalToRemove} pixels over multiple frames`);
        
        // Instead of converting the entire set to an array and shuffling,
        // we'll just take pixels directly from the set in batches
        this.pixelsToRemove = [];
        let removeCount = 0;
        
        // Only collect a portion of the pixels we need to remove
        // We'll get more in future frames if needed
        const initialBatchSize = Math.min(totalToRemove, 10000);
        
        // Iterate the set and collect pixels to remove
        let i = 0;
        for (const pixel of pixelSet) {
            // Only collect pixels occasionally based on a sampling pattern
            if (i % 5 === 0 && removeCount < initialBatchSize) {
                this.pixelsToRemove.push(pixel);
                removeCount++;
            }
            i++;
            
            // Break early if we've sampled enough pixels
            if (removeCount >= initialBatchSize) break;
        }
        
        this.pruningInProgress = true;
        
        // Do first batch of pruning immediately
        this.continuePruningPixels(pixelSet);
    },
    
    // Continue pruning process over multiple frames
    continuePruningPixels: function(pixelSet) {
        if (!this.pruningInProgress) {
            return;
        }
        
        // If we're out of pixels to remove but haven't reached target size,
        // collect more pixels to remove
        if (this.pixelsToRemove.length === 0 && pixelSet.size > this.targetPixelCount) {
            const stillToRemove = pixelSet.size - this.targetPixelCount;
            const batchSize = Math.min(stillToRemove, 5000);
            
            // Only collect a small batch to avoid expensive operations
            let collected = 0;
            let i = 0;
            
            for (const pixel of pixelSet) {
                if (i % 3 === 0 && collected < batchSize) {
                    this.pixelsToRemove.push(pixel);
                    collected++;
                }
                i++;
                
                if (collected >= batchSize) break;
            }
            
            if (this.pixelsToRemove.length === 0) {
                // If we couldn't collect any more pixels, we're done
                console.log(`Gradual pruning complete. Final pixel count: ${pixelSet.size}`);
                this.pruningInProgress = false;
                return;
            }
        }
        
        // Determine number of pixels to remove this frame
        const removeCount = Math.min(this.pixelsToRemovePerFrame, this.pixelsToRemove.length);
        
        // Remove batch of pixels
        for (let i = 0; i < removeCount; i++) {
            if (this.pixelsToRemove.length > 0) {
                pixelSet.delete(this.pixelsToRemove.pop());
            }
        }
        
        // Check if pruning is complete (reached target size)
        if (pixelSet.size <= this.targetPixelCount) {
            console.log(`Gradual pruning complete. Target pixel count reached: ${pixelSet.size}`);
            this.pixelsToRemove = [];
            this.pruningInProgress = false;
        }
    },

    // Prune active pixels when they exceed the maximum limit (immediate version)
    pruneActivePixels: function(pixelSet) {
        // Convert to array for easier manipulation
        const pixelArray = Array.from(pixelSet);

        // Shuffle array to randomize which pixels are kept
        this.shuffleArray(pixelArray);

        // Clear the set and refill with max allowed pixels
        pixelSet.clear();
        const targetSize = Math.floor(this.maxActivePixels * 0.8); // Keep 80% as buffer
        for (let i = 0; i < targetSize && i < pixelArray.length; i++) {
            pixelSet.add(pixelArray[i]);
        }
        
        console.log(`Pruned active pixels from ${pixelArray.length} to ${pixelSet.size}`);
    },

    // Fisher-Yates shuffle for arrays
    shuffleArray: function(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    // Check if enough time has passed for stats update
    shouldUpdateStats: function() {
        const currentTime = performance.now();
        if (currentTime - this.lastStatsUpdate >= 500) {
            this.lastStatsUpdate = currentTime;
            return true;
        }
        return false;
    },

    // Get current FPS
    getFPS: function() {
        return Math.round(this.fps);
    }
};