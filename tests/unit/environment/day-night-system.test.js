// Tests for Day-Night System

// Mock DOM elements and functions
global.document = {
    getElementById: jest.fn().mockImplementation((id) => {
        return {
            style: {},
            appendChild: jest.fn(),
            textContent: ''
        };
    }),
    createElement: jest.fn().mockImplementation((tag) => {
        return {
            style: {},
            classList: {
                add: jest.fn()
            }
        };
    })
};

// Setup global window and visualization objects
global.window = {};
global.VisualizationManager = {
    getMode: jest.fn().mockReturnValue('normal')
};

// Mock environment controller
const mockEnvironmentController = {
    dayNightCycle: 0,
    dayLength: 5,
    weatherSystem: { cloudProperties: { cloudPixels: [] } }
};

// Mock core simulation and color mapper
const mockCore = {
    width: 100,
    height: 100,
    type: {},
    state: {},
    water: {},
    energy: {},
    nutrient: {},
    metadata: {},
    cloud: {},
    getCoords: jest.fn().mockReturnValue({x: 0, y: 0}),
    getNeighborIndices: jest.fn().mockReturnValue([])
};

// Import day-night system
const DayNightSystem = require('../../../js/environment/day-night-system');

// Define TYPE and STATE constants for testing
const TYPE = {
    AIR: 0,
    WATER: 1,
    SOIL: 2,
    PLANT: 3
};

const STATE = {
    DEFAULT: 0,
    ROOT: 1,
    STEM: 2,
    LEAF: 3,
    FLOWER: 4
};

// Import ColorMapper for testing
jest.mock('../../../js/rendering/color-mapper', () => {
    const ColorMapperMock = {
        core: null,
        TYPE: null,
        STATE: null,
        weatherSystem: null,
        
        init: function(core, TYPE, STATE) {
            this.core = core;
            this.TYPE = TYPE;
            this.STATE = STATE;
            return this;
        },
        
        setWeatherSystem: function(weatherSystem) {
            this.weatherSystem = weatherSystem;
        },
        
        getPixelColor: function(index) {
            const type = this.core.type[index];
            const energy = this.core.energy[index] || 0;
            
            // Simulate color generation based on type and energy
            if (type === this.TYPE.AIR) {
                // Air color based on energy (sunlight)
                const lightLevel = Math.min(1.0, energy / 150);
                return {
                    r: 70 + Math.floor(lightLevel * 100),
                    g: 130 + Math.floor(lightLevel * 70),
                    b: 200 + Math.floor(lightLevel * 30)
                };
            }
            
            // Default color
            return { r: 0, g: 0, b: 0 };
        }
    };
    
    return ColorMapperMock;
}, { virtual: true });

const ColorMapper = require('../../../js/rendering/color-mapper');

describe('DayNightSystem', () => {
    // Set up system before each test
    beforeEach(() => {
        // Reset system properties
        DayNightSystem.environment = {...mockEnvironmentController};
        DayNightSystem.starsCreated = false;
        DayNightSystem.stars = [];
        
        // Mock DOM elements
        DayNightSystem.skyElement = { style: {} };
        DayNightSystem.sunElement = { style: {} };
        DayNightSystem.moonElement = { style: {} };
        DayNightSystem.starsElement = { 
            style: {},
            appendChild: jest.fn()
        };
        
        // Reset mocks
        document.getElementById.mockClear();
        
        // Initialize ColorMapper
        ColorMapper.init(mockCore, TYPE, STATE);
        ColorMapper.setWeatherSystem(mockEnvironmentController.weatherSystem);
        
        // Set mock types
        mockCore.type = {};
    });

    test('init should set environment reference', () => {
        const result = DayNightSystem.init(mockEnvironmentController);
        expect(result).toBe(DayNightSystem); // Should return self
        expect(DayNightSystem.environment).toBe(mockEnvironmentController);
    });

    test('updateDayNightCycle should increment cycle based on dayLength', () => {
        // Initial cycle value
        DayNightSystem.environment.dayNightCycle = 0;
        DayNightSystem.environment.dayLength = 5; // Medium speed
        
        // Update cycle
        DayNightSystem.updateDayNightCycle();
        
        // Cycle should have increased
        expect(DayNightSystem.environment.dayNightCycle).toBeGreaterThan(0);
    });

    test('isDaytime should correctly identify day and night phases', () => {
        // Daytime (dawn to dusk, 30% to 70% of cycle)
        DayNightSystem.environment.dayNightCycle = 256 * 0.5; // 50% - mid-day
        expect(DayNightSystem.isDaytime()).toBe(true);
        
        // Nighttime (dusk to dawn, 70% to 30% of cycle)
        DayNightSystem.environment.dayNightCycle = 256 * 0.8; // 80% - night
        expect(DayNightSystem.isDaytime()).toBe(false);
    });

    test('getSunIntensity should return higher values during day', () => {
        // Mid-day (50%)
        DayNightSystem.environment.dayNightCycle = 256 * 0.5;
        const middayIntensity = DayNightSystem.getSunIntensity();
        
        // Dawn (30%)
        DayNightSystem.environment.dayNightCycle = 256 * 0.3;
        const dawnIntensity = DayNightSystem.getSunIntensity();
        
        // Night (80%)
        DayNightSystem.environment.dayNightCycle = 256 * 0.8;
        const nightIntensity = DayNightSystem.getSunIntensity();
        
        // Mid-day should have maximum intensity
        expect(middayIntensity).toBeGreaterThan(dawnIntensity);
        // Night should have zero intensity
        expect(nightIntensity).toBe(0);
    });

    test('getTimeString should format time correctly', () => {
        // Midnight
        DayNightSystem.environment.dayNightCycle = 0;
        expect(DayNightSystem.getTimeString()).toBe("00:00");
        
        // Noon (50%)
        DayNightSystem.environment.dayNightCycle = 256 * 0.5;
        expect(DayNightSystem.getTimeString()).toBe("12:00");
        
        // 6 PM (75%)
        DayNightSystem.environment.dayNightCycle = 256 * 0.75;
        expect(DayNightSystem.getTimeString()).toBe("18:00");
    });

    test('hexToRgb should convert hex colors correctly', () => {
        const blue = DayNightSystem.hexToRgb('#0000ff');
        expect(blue).toEqual({r: 0, g: 0, b: 255});
        
        const red = DayNightSystem.hexToRgb('#ff0000');
        expect(red).toEqual({r: 255, g: 0, b: 0});
    });

    test('lerpColor should interpolate between colors', () => {
        const red = '#ff0000';
        const blue = '#0000ff';
        
        // 50% between red and blue should be purple
        const purple = DayNightSystem.lerpColor(red, blue, 0.5);
        
        // Check that we get some kind of color blending
        expect(purple.toLowerCase()).not.toBe(red.toLowerCase());
        expect(purple.toLowerCase()).not.toBe(blue.toLowerCase());
    });

    test('createStars should set starsCreated flag', () => {
        // Create stars
        DayNightSystem.createStars();
        
        // Should be marked as created
        expect(DayNightSystem.starsCreated).toBe(true);
    });
    
    // New tests for sky color transition
    test('sky background color should change with time of day', () => {
        // Check multiple times of day

        // Night (10% of cycle)
        DayNightSystem.environment.dayNightCycle = 256 * 0.1;
        DayNightSystem.updateVisualElements();
        const nightColor = DayNightSystem.skyElement.style.backgroundColor;
        
        // Dawn (27% of cycle)
        DayNightSystem.environment.dayNightCycle = 256 * 0.27;
        DayNightSystem.updateVisualElements();
        const dawnColor = DayNightSystem.skyElement.style.backgroundColor;
        
        // Noon (50% of cycle)
        DayNightSystem.environment.dayNightCycle = 256 * 0.5;
        DayNightSystem.updateVisualElements();
        const noonColor = DayNightSystem.skyElement.style.backgroundColor;
        
        // Sunset (67% of cycle)
        DayNightSystem.environment.dayNightCycle = 256 * 0.67;
        DayNightSystem.updateVisualElements();
        const sunsetColor = DayNightSystem.skyElement.style.backgroundColor;
        
        // Each time should have a different sky color
        expect(nightColor).not.toBe(dawnColor);
        expect(dawnColor).not.toBe(noonColor);
        expect(noonColor).not.toBe(sunsetColor);
        expect(sunsetColor).not.toBe(nightColor);
    });
    
    // Test for sun and moon positioning
    test('sun and moon should move with time of day', () => {
        // Morning - sun rising
        DayNightSystem.environment.dayNightCycle = 256 * 0.35;
        DayNightSystem.updateVisualElements();
        const morningSunPosition = DayNightSystem.sunElement.style.transform;
        const morningSunOpacity = DayNightSystem.sunElement.style.opacity;
        
        // Noon - sun at highest
        DayNightSystem.environment.dayNightCycle = 256 * 0.5;
        DayNightSystem.updateVisualElements();
        const noonSunPosition = DayNightSystem.sunElement.style.transform;
        const noonSunOpacity = DayNightSystem.sunElement.style.opacity;
        
        // Evening - moon rising
        DayNightSystem.environment.dayNightCycle = 256 * 0.75;
        DayNightSystem.updateVisualElements();
        const eveningMoonPosition = DayNightSystem.moonElement.style.transform;
        const eveningMoonOpacity = DayNightSystem.moonElement.style.opacity;
        
        // Midnight - moon at highest
        DayNightSystem.environment.dayNightCycle = 256 * 0.9;
        DayNightSystem.updateVisualElements();
        const midnightMoonPosition = DayNightSystem.moonElement.style.transform;
        const midnightMoonOpacity = DayNightSystem.moonElement.style.opacity;
        
        // Positions should be different
        expect(morningSunPosition).not.toBe(noonSunPosition);
        expect(eveningMoonPosition).not.toBe(midnightMoonPosition);
        
        // Sun should be visible during day, moon during night
        expect(parseFloat(noonSunOpacity)).toBeGreaterThan(0);
        expect(parseFloat(midnightMoonOpacity)).toBeGreaterThan(0);
    });
    
    // Test for stars visibility
    test('stars should be visible at night and invisible during day', () => {
        // Noon - stars should be invisible
        DayNightSystem.environment.dayNightCycle = 256 * 0.5;
        DayNightSystem.updateVisualElements();
        const dayStarsOpacity = DayNightSystem.starsElement.style.opacity;
        
        // Midnight - stars should be visible
        DayNightSystem.environment.dayNightCycle = 256 * 0.9;
        DayNightSystem.updateVisualElements();
        const nightStarsOpacity = DayNightSystem.starsElement.style.opacity;
        
        expect(parseFloat(dayStarsOpacity)).toBe(0);
        expect(parseFloat(nightStarsOpacity)).toBeGreaterThan(0);
    });
    
    // Test for air color changes based on sun intensity
    test('air color should change with sun intensity', () => {
        // Set up a few air pixels
        for (let i = 0; i < 10; i++) {
            mockCore.type[i] = TYPE.AIR;
        }
        
        // Test at different times of day
        
        // Night (10% of cycle) - should have minimal light
        DayNightSystem.environment.dayNightCycle = 256 * 0.1;
        const nightSunIntensity = DayNightSystem.getSunIntensity();
        mockCore.energy[0] = nightSunIntensity;
        const nightAirColor = ColorMapper.getPixelColor(0);
        
        // Noon (50% of cycle) - should have maximum light
        DayNightSystem.environment.dayNightCycle = 256 * 0.5;
        const noonSunIntensity = DayNightSystem.getSunIntensity();
        mockCore.energy[1] = noonSunIntensity;
        const noonAirColor = ColorMapper.getPixelColor(1);
        
        // Air should be brighter during day
        expect(noonAirColor.r).toBeGreaterThan(nightAirColor.r);
        expect(noonAirColor.g).toBeGreaterThan(nightAirColor.g);
        expect(noonAirColor.b).toBeGreaterThan(nightAirColor.b);
        
        // Verify sun intensity affects air color
        expect(noonSunIntensity).toBeGreaterThan(nightSunIntensity);
    });
    
    // Integration test for day/night cycle affecting multiple systems
    test('day/night cycle should affect environment systems consistently', () => {
        // Set time to noon
        DayNightSystem.environment.dayNightCycle = 256 * 0.5;
        
        // Update visual elements
        DayNightSystem.updateVisualElements();
        
        // Check sky color (should be day color)
        const dayColor = DayNightSystem.skyElement.style.backgroundColor;
        
        // Check sun position and visibility
        const sunDayOpacity = parseFloat(DayNightSystem.sunElement.style.opacity);
        const moonDayOpacity = parseFloat(DayNightSystem.moonElement.style.opacity);
        const starsDayOpacity = parseFloat(DayNightSystem.starsElement.style.opacity);
        
        // Set time to midnight
        DayNightSystem.environment.dayNightCycle = 256 * 0.9;
        
        // Update visual elements
        DayNightSystem.updateVisualElements();
        
        // Check sky color (should be night color)
        const nightColor = DayNightSystem.skyElement.style.backgroundColor;
        
        // Check moon position and visibility
        const sunNightOpacity = parseFloat(DayNightSystem.sunElement.style.opacity);
        const moonNightOpacity = parseFloat(DayNightSystem.moonElement.style.opacity);
        const starsNightOpacity = parseFloat(DayNightSystem.starsElement.style.opacity);
        
        // Verify everything changes correctly
        expect(dayColor).not.toBe(nightColor);
        expect(sunDayOpacity).toBeGreaterThan(0);
        expect(sunNightOpacity).toBe(0);
        expect(moonDayOpacity).toBe(0);
        expect(moonNightOpacity).toBeGreaterThan(0);
        expect(starsDayOpacity).toBe(0);
        expect(starsNightOpacity).toBeGreaterThan(0);
    });
});