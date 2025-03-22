// Performance Manager - Tracks performance and optimizes active pixels
const PerformanceManager = {
    // Reference to main controller
    controller: null,

    // Performance tracking
    lastUpdate: 0,
    lastStatsUpdate: 0,
    fps: 0,

    // Active pixel management
    maxActivePixels: 200000, // Safety limit to prevent performance issues

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
        // Safety check: limit active pixels to prevent performance issues
        if (pixelSet.size > this.maxActivePixels) {
            console.warn(`Too many active pixels (${pixelSet.size}), pruning to ${this.maxActivePixels}`);
            this.pruneActivePixels(pixelSet);
        }
    },

    // Prune active pixels when they exceed the maximum limit
    pruneActivePixels: function(pixelSet) {
        // Convert to array for easier manipulation
        const pixelArray = Array.from(pixelSet);

        // Shuffle array to randomize which pixels are kept
        this.shuffleArray(pixelArray);

        // Clear the set and refill with max allowed pixels
        pixelSet.clear();
        for (let i = 0; i < this.maxActivePixels; i++) {
            pixelSet.add(pixelArray[i]);
        }
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