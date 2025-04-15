// Performance Manager - Tracks performance and optimizes active pixels
export const PerformanceManager = {
    // Reference to main controller
    controller: null,

    // Performance tracking
    lastUpdate: 0,
    lastStatsUpdate: 0,
    fps: 0,
    frameTimes: [],
    frameTimeWindow: 60, // Number of frames to average over

    // Active pixel management
    maxActivePixels: 100000, // Safety limit to prevent performance issues
    activePixelThreshold: 0.8, // Percentage of maxActivePixels before optimization kicks in
    optimizationInterval: 30, // Frames between optimization checks

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
        this.frameTimes = [];
    },

    // Start timing a new frame
    startFrame: function() {
        this.frameStartTime = performance.now();
    },

    // End timing for the current frame and calculate FPS
    endFrame: function() {
        const currentTime = performance.now();
        const frameTime = currentTime - this.frameStartTime;
        
        // Add frame time to rolling window
        this.frameTimes.push(frameTime);
        if (this.frameTimes.length > this.frameTimeWindow) {
            this.frameTimes.shift();
        }
        
        // Calculate average FPS over the window
        const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        this.fps = 1000 / avgFrameTime;
        this.lastUpdate = currentTime;
    },

    // Manage active pixels with performance considerations
    manageActivePixels: function(pixelSet) {
        // Only check optimization every N frames
        if (this.controller.core.frameCount % this.optimizationInterval !== 0) {
            return;
        }

        // Check if we're approaching the active pixel limit
        if (pixelSet.size > this.maxActivePixels * this.activePixelThreshold) {
            this.optimizeActivePixels(pixelSet);
        }
    },

    // Optimize active pixels based on importance and activity
    optimizeActivePixels: function(pixelSet) {
        const pixelArray = Array.from(pixelSet);
        const optimizedSet = new Set();
        
        // Sort pixels by importance (type and state)
        pixelArray.sort((a, b) => {
            const typeA = this.controller.core.type[a];
            const typeB = this.controller.core.type[b];
            const stateA = this.controller.core.state[a];
            const stateB = this.controller.core.state[b];
            
            // Priority order: PLANT > WATER > SOIL > SEED > INSECT > WORM > DEAD_MATTER > AIR
            const typePriority = {
                [this.controller.TYPE.PLANT]: 8,
                [this.controller.TYPE.WATER]: 7,
                [this.controller.TYPE.SOIL]: 6,
                [this.controller.TYPE.SEED]: 5,
                [this.controller.TYPE.INSECT]: 4,
                [this.controller.TYPE.WORM]: 3,
                [this.controller.TYPE.DEAD_MATTER]: 2,
                [this.controller.TYPE.AIR]: 1
            };
            
            // Compare types first
            if (typePriority[typeA] !== typePriority[typeB]) {
                return typePriority[typeB] - typePriority[typeA];
            }
            
            // If types are equal, compare states
            return stateB - stateA;
        });
        
        // Keep the most important pixels up to the limit
        const keepCount = Math.min(pixelArray.length, this.maxActivePixels);
        for (let i = 0; i < keepCount; i++) {
            optimizedSet.add(pixelArray[i]);
        }
        
        // Clear and update the original set
        pixelSet.clear();
        optimizedSet.forEach(pixel => pixelSet.add(pixel));
        
        console.log(`Optimized active pixels: ${pixelArray.length} -> ${pixelSet.size}`);
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

    // Get average frame time
    getAverageFrameTime: function() {
        if (this.frameTimes.length === 0) return 0;
        return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    }
};