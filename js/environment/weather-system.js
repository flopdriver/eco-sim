// Weather System
// Handles weather phenomena like rain

const WeatherSystem = {
    // Reference to parent environment controller
    environment: null,

    // Initialize weather system
    init: function(environmentController) {
        this.environment = environmentController;
        console.log("Initializing weather system...");
        return this;
    },

    // Update weather conditions
    updateWeather: function(nextActivePixels) {
        // Rain has a chance to occur based on rainProbability
        if (Math.random() < this.environment.rainProbability) {
            this.createRain(nextActivePixels);
        }
    },

    // Create rain at the top of the simulation
    createRain: function(nextActivePixels) {
        // Rain appears at the top of the simulation
        for (let x = 0; x < this.environment.core.width; x++) {
            // Not every column gets rain - randomize for natural look
            if (Math.random() < 0.1) {
                const index = this.environment.core.getIndex(x, 0);

                if (index !== -1 && this.environment.core.type[index] === this.environment.TYPE.AIR) {
                    // Create water at the top
                    this.environment.core.type[index] = this.environment.TYPE.WATER;
                    this.environment.core.water[index] = 255; // Full water content
                    nextActivePixels.add(index);
                }
            }
        }
    }
};