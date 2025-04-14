// Day-Night System
// Handles day/night cycle management

export const DayNightSystem = {
    // Reference to parent environment controller
    environment: null,

    // Initialize day/night system
    init: function(environmentController) {
        this.environment = environmentController;
        console.log("Initializing day/night system...");
        return this;
    },

    // Update day/night cycle
    updateDayNightCycle: function() {
        // Progress day/night cycle based on dayLength setting
        // Lower dayLength = faster cycle, higher = slower cycle
        const cycleSpeed = 0.5 * (11 - this.environment.dayLength) / 5; // Scale to reasonable range
        this.environment.dayNightCycle = (this.environment.dayNightCycle + cycleSpeed) % 256;

        // Update day/night indicator on UI
        const isDaytime = this.environment.dayNightCycle < 128;
        const indicator = document.getElementById('day-night-indicator');
        if (indicator) {
            if (isDaytime) {
                indicator.textContent = "Day";
            } else {
                indicator.textContent = "Night";
            }
        }
    },

    // Get current sun intensity (0-255)
    getSunIntensity: function() {
        // Sine wave creates smooth transition between day and night
        const sunIntensity = Math.sin((this.environment.dayNightCycle / 256) * Math.PI) * 255;

        // Negative values mean night
        return Math.max(0, sunIntensity);
    },

    // Check if it's currently daytime
    isDaytime: function() {
        return this.environment.dayNightCycle < 128;
    },

    // Get time as formatted string (HH:MM)
    getTimeString: function() {
        const timeOfDay = Math.floor((this.environment.dayNightCycle / 256) * 24); // 24-hour format
        const minutes = Math.floor((this.environment.dayNightCycle / 256 * 24 * 60) % 60);
        return `${timeOfDay.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
};