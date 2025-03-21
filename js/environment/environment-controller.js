// Environment Controller
// Main coordinator for all environment-related subsystems

window.EnvironmentController = {
    // Reference to core simulation
    core: null,

    // Environment state
    dayNightCycle: 0,      // 0-255 representing time of day
    dayLength: 5,          // Length of day cycle (1-10 scale)
    temperature: 128,      // 0-255 representing temperature
    rainProbability: 0.8, // Chance of rain per tick (massively increased for jungle-like environment)

    // Type and state enums (will be populated by controller)
    TYPE: null,
    STATE: null,

    // Subsystem references
    dayNightSystem: null,
    weatherSystem: null,
    lightSystem: null,
    temperatureSystem: null,
    lightningSystem: null, // Reference to lightning system
    fireSystem: null,      // Reference to fire system

    // Initialize environment system
    init: function(core) {
        this.core = core;
        console.log("Initializing environment systems...");

        // Initialize subsystems
        this.dayNightSystem = DayNightSystem.init(this);
        this.weatherSystem = WeatherSystem.init(this);
        this.lightSystem = LightSystem.init(this);
        this.temperatureSystem = TemperatureSystem.init(this);
        this.lightningSystem = LightningSystem.init(this);
        this.fireSystem = FireSystem.init(this); // Initialize fire system

        // Connect weather system with rendering systems
        if (window.ColorMapper) {
            window.ColorMapper.setWeatherSystem(this.weatherSystem);
        }

        return this;
    },

    // Update environmental factors
    update: function(activePixels, nextActivePixels) {
        // Update day/night cycle
        this.dayNightSystem.updateDayNightCycle();

        // Process weather (rain, etc)
        this.weatherSystem.updateWeather(nextActivePixels);

        // Process light penetration
        this.lightSystem.updateLight(nextActivePixels);

        // Process temperature
        this.temperatureSystem.updateTemperature(nextActivePixels);

        // Process lightning and fire
        this.lightningSystem.updateLightning(nextActivePixels);

        // Process active fires and update fire state
        this.fireSystem.updateFires(nextActivePixels);

        // Check for new fire starts based on temperature
        this.fireSystem.checkSpontaneousCombustion(nextActivePixels);

        // Update UI indicators
        this.updateUI();
    },

    // Update UI elements related to environment
    updateUI: function() {
        // Update daylight indicator
        const dayPercent = (this.dayNightCycle / 256) * 100;
        const timeOfDay = Math.floor((this.dayNightCycle / 256) * 24); // 24-hour format

        // Format time as HH:MM
        const hours = timeOfDay;
        const minutes = Math.floor((this.dayNightCycle / 256 * 24 * 60) % 60);
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        // Update time indicator if it exists
        const timeIndicator = document.getElementById('time-indicator');
        if (timeIndicator) {
            timeIndicator.textContent = timeString;
        }
    },

    // Set rain probability (0-1 scale)
    setRainProbability: function(probability) {
        this.rainProbability = Math.max(0, Math.min(1, probability));
    },

    // Set temperature (0-255 scale)
    setTemperature: function(temperature) {
        this.temperature = Math.max(0, Math.min(255, temperature));
    },

    // Set day length (1-10 scale, where 1 is fastest, 10 is slowest)
    setDayLength: function(length) {
        this.dayLength = Math.max(1, Math.min(10, length));
    }
};