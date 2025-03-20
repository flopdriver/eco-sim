// Performance Manager - Tracks performance for chunk-based simulation
const PerformanceManager = {
    // Reference to main controller
    controller: null,

    // Performance tracking
    lastUpdate: 0,
    lastStatsUpdate: 0,
    fps: 0,
    frameStartTime: 0,

    // Chunk performance metrics
    chunkPerformanceStats: {
        activeChunks: 0,
        totalChunks: 0,
        processingPercent: 0,
        averageUpdateTime: 0
    },

    // Update time tracking
    updateTimes: [],
    maxTrackingPoints: 30, // Store last 30 measurements for averaging

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
        this.updateTimes = [];
    },

    // Start timing a new frame
    startFrame: function() {
        this.frameStartTime = performance.now();
    },

    // End timing for the current frame and calculate FPS
    endFrame: function() {
        const currentTime = performance.now();
        const frameDuration = currentTime - this.lastUpdate;

        this.fps = 1000 / frameDuration;
        this.lastUpdate = currentTime;

        // Track update time
        const updateTime = currentTime - this.frameStartTime;
        this.updateTimes.push(updateTime);

        // Maintain fixed size for performance tracking
        if (this.updateTimes.length > this.maxTrackingPoints) {
            this.updateTimes.shift();
        }

        // Calculate average update time
        const avgUpdateTime = this.updateTimes.reduce((sum, time) => sum + time, 0) / this.updateTimes.length;

        // Update chunk performance stats
        if (this.controller.chunkManager) {
            this.chunkPerformanceStats.activeChunks =
                this.controller.chunkManager.getActiveChunkCount();
            this.chunkPerformanceStats.totalChunks =
                this.controller.chunkManager.getTotalChunkCount();
            this.chunkPerformanceStats.processingPercent =
                (this.chunkPerformanceStats.activeChunks / this.chunkPerformanceStats.totalChunks * 100).toFixed(1);
            this.chunkPerformanceStats.averageUpdateTime = avgUpdateTime.toFixed(2);
        }
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
    },

    // Get active chunk count for display
    getActiveChunkCount: function() {
        return this.chunkPerformanceStats.activeChunks;
    },

    // Get processing percentage for display
    getProcessingPercent: function() {
        return this.chunkPerformanceStats.processingPercent;
    },

    // Get average update time
    getAverageUpdateTime: function() {
        return this.chunkPerformanceStats.averageUpdateTime;
    }
};