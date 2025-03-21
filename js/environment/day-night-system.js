// Day-Night System
// Handles day/night cycle management with visual elements

const DayNightSystem = {
    // Reference to parent environment controller
    environment: null,
    
    // Elements for celestial objects
    skyElement: null,
    sunElement: null,
    moonElement: null,
    starsElement: null,
    stars: [],
    starsCreated: false,
    
    // Sky colors at different times of day (will transition between these)
    skyColors: {
        night: '#0a1a33',       // Deep night blue
        predawn: '#1e3b5a',     // Deep blue with hint of light
        dawn: '#864d49',        // Dawn red-orange
        sunrise: '#ff9e4f',     // Sunrise orange
        morning: '#6aadff',     // Morning blue
        noon: '#4a99ff',        // Bright mid-day blue
        afternoon: '#6aadff',   // Afternoon blue
        sunset: '#ff9e4f',      // Sunset orange
        dusk: '#864d49',        // Dusk red-orange
        evening: '#1e3b5a'      // Evening deep blue
    },

    // Initialize day/night system
    init: function(environmentController) {
        this.environment = environmentController;
        console.log("Initializing day/night system with visual elements...");
        
        // Get DOM elements
        this.skyElement = document.getElementById('sky-background');
        this.sunElement = document.getElementById('sun');
        this.moonElement = document.getElementById('moon');
        this.starsElement = document.getElementById('stars');
        
        // Create stars immediately if elements exist
        if (this.starsElement && !this.starsCreated) {
            this.createStars();
        }
        
        // Initialize with current cycle time
        this.updateVisualElements();
        
        return this;
    },
    
    // Create stars in the night sky
    createStars: function() {
        // Only create stars once
        if (this.starsCreated) return;
        
        // Check if we can create DOM elements (in browser environment)
        if (!this.starsElement) {
            // Set flag to avoid trying again
            this.starsCreated = true;
            return;
        }
        
        const starCount = 50; // Number of stars to create
        
        try {
            for (let i = 0; i < starCount; i++) {
                const star = document.createElement('div');
                star.classList.add('star');
                
                // Random position
                const left = Math.random() * 100; // Percentage position
                const top = Math.random() * 100;
                
                // Random size (1-3px)
                const size = 1 + Math.random() * 2;
                
                // Random twinkle delay
                const delay = Math.random() * 4; // 0-4s delay in animation
                
                // Set style
                star.style.left = `${left}%`;
                star.style.top = `${top}%`;
                star.style.width = `${size}px`;
                star.style.height = `${size}px`;
                star.style.animationDelay = `${delay}s`;
                
                // Add to DOM and track in array
                this.starsElement.appendChild(star);
                this.stars.push(star);
            }
        } catch (e) {
            // Handle errors in testing environment
            console.log("Error creating stars (likely in test environment):", e);
        }
        
        this.starsCreated = true;
    },

    // Update day/night cycle
    updateDayNightCycle: function() {
        // Progress day/night cycle based on dayLength setting
        // Lower dayLength = faster cycle, higher = slower cycle
        const cycleSpeed = 0.5 * (11 - this.environment.dayLength) / 5; // Scale to reasonable range
        this.environment.dayNightCycle = (this.environment.dayNightCycle + cycleSpeed) % 256;

        // Update visual elements
        this.updateVisualElements();
        
        // Update day/night indicator on UI
        const isDaytime = this.isDaytime();
        const indicator = document.getElementById('day-night-indicator');
        if (indicator) {
            if (isDaytime) {
                indicator.textContent = "Day";
            } else {
                indicator.textContent = "Night";
            }
        }
    },
    
    // Update visual elements based on current time
    updateVisualElements: function() {
        // If elements don't exist, return early
        if (!this.skyElement || !this.sunElement || !this.moonElement || !this.starsElement) {
            return;
        }
        
        // Create stars if not already created
        if (!this.starsCreated) {
            this.createStars();
        }
        
        // Cycle normalized to 0-1 range
        const cycleNormalized = this.environment.dayNightCycle / 256;
        
        // Update sky color based on time of day
        this.updateSkyColor(cycleNormalized);
        
        // Update sun position
        this.updateSunPosition(cycleNormalized);
        
        // Update moon position
        this.updateMoonPosition(cycleNormalized);
        
        // Update stars visibility
        this.updateStarsVisibility(cycleNormalized);
    },
    
    // Update sky color based on time of day
    updateSkyColor: function(cycleNormalized) {
        let skyColor;
        
        // Determine sky color based on time of day (0-1 range)
        if (cycleNormalized < 0.2) { // Night (0-20%)
            skyColor = this.skyColors.night;
        } else if (cycleNormalized < 0.25) { // Pre-dawn (20-25%)
            const t = (cycleNormalized - 0.2) / 0.05;
            skyColor = this.lerpColor(this.skyColors.night, this.skyColors.predawn, t);
        } else if (cycleNormalized < 0.3) { // Dawn (25-30%)
            const t = (cycleNormalized - 0.25) / 0.05;
            skyColor = this.lerpColor(this.skyColors.predawn, this.skyColors.dawn, t);
        } else if (cycleNormalized < 0.35) { // Sunrise (30-35%)
            const t = (cycleNormalized - 0.3) / 0.05;
            skyColor = this.lerpColor(this.skyColors.dawn, this.skyColors.sunrise, t);
        } else if (cycleNormalized < 0.4) { // Morning transition (35-40%)
            const t = (cycleNormalized - 0.35) / 0.05;
            skyColor = this.lerpColor(this.skyColors.sunrise, this.skyColors.morning, t);
        } else if (cycleNormalized < 0.5) { // Morning to noon (40-50%)
            const t = (cycleNormalized - 0.4) / 0.1;
            skyColor = this.lerpColor(this.skyColors.morning, this.skyColors.noon, t);
        } else if (cycleNormalized < 0.6) { // Noon to afternoon (50-60%)
            const t = (cycleNormalized - 0.5) / 0.1;
            skyColor = this.lerpColor(this.skyColors.noon, this.skyColors.afternoon, t);
        } else if (cycleNormalized < 0.65) { // Afternoon to sunset (60-65%)
            const t = (cycleNormalized - 0.6) / 0.05;
            skyColor = this.lerpColor(this.skyColors.afternoon, this.skyColors.sunset, t);
        } else if (cycleNormalized < 0.7) { // Sunset to dusk (65-70%)
            const t = (cycleNormalized - 0.65) / 0.05;
            skyColor = this.lerpColor(this.skyColors.sunset, this.skyColors.dusk, t);
        } else if (cycleNormalized < 0.75) { // Dusk to evening (70-75%)
            const t = (cycleNormalized - 0.7) / 0.05;
            skyColor = this.lerpColor(this.skyColors.dusk, this.skyColors.evening, t);
        } else if (cycleNormalized < 0.8) { // Evening to night (75-80%)
            const t = (cycleNormalized - 0.75) / 0.05;
            skyColor = this.lerpColor(this.skyColors.evening, this.skyColors.night, t);
        } else { // Night (80-100%)
            skyColor = this.skyColors.night;
        }
        
        this.skyElement.style.backgroundColor = skyColor;
    },
    
    // Linear interpolation between colors
    lerpColor: function(color1, color2, t) {
        // Convert hex to RGB
        const rgb1 = this.hexToRgb(color1);
        const rgb2 = this.hexToRgb(color2);
        
        // Interpolate each component
        const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
        const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
        const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);
        
        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    },
    
    // Convert hex color to RGB
    hexToRgb: function(hex) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse the hex value
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return { r, g, b };
    },
    
    // Update sun position
    updateSunPosition: function(cycleNormalized) {
        // Sun is visible from 30% to 70% of the cycle (sunrise to sunset)
        // It follows an arc path (sine wave)
        
        // Sun position calculation
        let sunPosition = 0;
        let sunOpacity = 0;
        
        if (cycleNormalized >= 0.3 && cycleNormalized <= 0.7) {
            // Normalize to 0-1 range for the sun's journey
            const sunProgress = (cycleNormalized - 0.3) / 0.4;
            
            // Calculate position along an arc (sine wave)
            // 0 = just rising, 0.5 = highest point, 1 = setting
            const sunHeight = Math.sin(sunProgress * Math.PI);
            
            // Convert to pixel position - when at highest, it should be at top of sky container
            // Value between 120 (horizon) and 0 (top of sky)
            sunPosition = 120 - (sunHeight * 100);
            
            // Opacity fades in/out at sunrise/sunset
            if (sunProgress < 0.1) {
                sunOpacity = sunProgress / 0.1; // Fade in during first 10% of sun's journey
            } else if (sunProgress > 0.9) {
                sunOpacity = (1 - sunProgress) / 0.1; // Fade out during last 10% of sun's journey
            } else {
                sunOpacity = 1; // Fully visible in the middle 80% of the day
            }
            
            // Sun's horizontal position
            // 0% of sky width at sunrise, 100% at sunset
            const sunLeft = sunProgress * 100;
            this.sunElement.style.left = `${sunLeft}%`;
        }
        
        // Update sun position and opacity
        this.sunElement.style.transform = `translateY(${sunPosition}px)`;
        this.sunElement.style.opacity = sunOpacity;
    },
    
    // Update moon position
    updateMoonPosition: function(cycleNormalized) {
        // Moon is visible from 70% to 30% of the next cycle (sunset to sunrise)
        // It follows an arc path (sine wave) like the sun
        
        // Moon position calculation
        let moonPosition = 0;
        let moonOpacity = 0;
        
        if (cycleNormalized <= 0.3 || cycleNormalized >= 0.7) {
            // Normalize to 0-1 range for the moon's journey
            let moonProgress;
            if (cycleNormalized >= 0.7) {
                moonProgress = (cycleNormalized - 0.7) / 0.6; // Evening to midnight
            } else {
                moonProgress = (cycleNormalized + 0.3) / 0.6; // Midnight to morning
            }
            
            // Calculate position along an arc (sine wave)
            const moonHeight = Math.sin(moonProgress * Math.PI);
            
            // Convert to pixel position
            moonPosition = 120 - (moonHeight * 100);
            
            // Opacity fades in/out at moonrise/moonset
            if (moonProgress < 0.1) {
                moonOpacity = moonProgress / 0.1; // Fade in
            } else if (moonProgress > 0.9) {
                moonOpacity = (1 - moonProgress) / 0.1; // Fade out
            } else {
                moonOpacity = 1; // Fully visible
            }
            
            // Moon's horizontal position
            // 0% of sky width at moonrise, 100% at moonset
            const moonLeft = moonProgress * 100;
            this.moonElement.style.left = `${moonLeft}%`;
        }
        
        // Update moon position and opacity
        this.moonElement.style.transform = `translateY(${moonPosition}px)`;
        this.moonElement.style.opacity = moonOpacity;
    },
    
    // Update stars visibility
    updateStarsVisibility: function(cycleNormalized) {
        // Stars are visible from 70% to 30% of the next cycle (sunset to sunrise)
        // with fade in/out at dusk and dawn
        
        let starsOpacity = 0;
        
        if (cycleNormalized <= 0.3 || cycleNormalized >= 0.7) {
            // Stars fade in from 70%-80% and fade out from 20%-30%
            if (cycleNormalized >= 0.7 && cycleNormalized <= 0.8) {
                starsOpacity = (cycleNormalized - 0.7) / 0.1; // Fade in at dusk
            } else if (cycleNormalized >= 0.2 && cycleNormalized <= 0.3) {
                starsOpacity = (0.3 - cycleNormalized) / 0.1; // Fade out at dawn
            } else if (cycleNormalized > 0.8 || cycleNormalized < 0.2) {
                starsOpacity = 1; // Fully visible at night
            }
        }
        
        this.starsElement.style.opacity = starsOpacity;
    },

    // Get current sun intensity (0-255)
    getSunIntensity: function() {
        // Sine wave creates smooth transition between day and night
        const cycleNormalized = this.environment.dayNightCycle / 256;
        
        // Only calculate sunlight during day hours (30%-70% of cycle)
        if (cycleNormalized >= 0.3 && cycleNormalized <= 0.7) {
            // Normalize to 0-1 for the daylight hours
            const dayProgress = (cycleNormalized - 0.3) / 0.4;
            // Sine wave for smooth transition, peak at noon
            return Math.sin(dayProgress * Math.PI) * 255;
        }
        
        return 0; // No sunlight at night
    },

    // Check if it's currently daytime
    isDaytime: function() {
        const cycleNormalized = this.environment.dayNightCycle / 256;
        return cycleNormalized >= 0.3 && cycleNormalized <= 0.7;
    },

    // Get time as formatted string (HH:MM)
    getTimeString: function() {
        const cycleNormalized = this.environment.dayNightCycle / 256;
        // Convert to 24-hour format
        const timeOfDay = Math.floor(cycleNormalized * 24);
        const minutes = Math.floor((cycleNormalized * 24 * 60) % 60);
        return `${timeOfDay.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
};

// Make DayNightSystem available in browser
if (typeof window !== 'undefined') {
    window.DayNightSystem = DayNightSystem;
}

// Make DayNightSystem available for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DayNightSystem;
}