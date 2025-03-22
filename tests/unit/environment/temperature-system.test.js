// Temperature System Tests

describe('TemperatureSystem', () => {
  let TemperatureSystem;
  let mockEnvironment;
  let mockCore;
  let nextActivePixels;

  beforeEach(() => {
    // Create a new TemperatureSystem instance for each test
    jest.resetModules();
    
    // Mock console to avoid actual console logs
    global.console = { log: jest.fn() };
    
    // Load the TemperatureSystem module
    TemperatureSystem = require('../../../js/environment/temperature-system.js');
    
    // Set up mock environment controller and core simulation
    mockCore = {
      width: 10,
      height: 10,
      size: 100,
      type: new Uint8Array(100),
      state: new Uint8Array(100),
      water: new Uint8Array(100),
      energy: new Uint8Array(100),
      getIndex: jest.fn((x, y) => {
        if (x < 0 || x >= 10 || y < 0 || y >= 10) return -1;
        return y * 10 + x;
      })
    };
    
    // Define types and states for testing
    const TYPE = {
      AIR: 0,
      WATER: 1,
      SOIL: 2,
      PLANT: 3,
      SEED: 4,
      WORM: 5,
      INSECT: 6,
      DEAD_MATTER: 7
    };
    
    const STATE = {
      DEFAULT: 0,
      WET: 1,
      DRY: 2,
      FERTILE: 3
    };
    
    mockEnvironment = {
      core: mockCore,
      TYPE: TYPE,
      STATE: STATE,
      dayNightCycle: 128, // Mid-day
      temperature: 128 // Normal temperature
    };
    
    // Initialize temperature system with mock environment
    TemperatureSystem.init(mockEnvironment);
    
    // Create a set to track active pixels
    nextActivePixels = new Set();
  });
  
  test('initialization sets environment reference', () => {
    expect(TemperatureSystem.environment).toBe(mockEnvironment);
  });
  
  test('updateTemperature affects water evaporation at high temperatures', () => {
    // Set up test scenario - water with air above it
    const waterIndex = mockCore.getIndex(5, 5);
    const airIndex = mockCore.getIndex(5, 4); // Above the water
    
    mockCore.type[waterIndex] = mockEnvironment.TYPE.WATER;
    mockCore.type[airIndex] = mockEnvironment.TYPE.AIR;
    
    // Set high temperature to increase evaporation chance
    mockEnvironment.temperature = 200; // Hot
    
    // Mock random to ensure evaporation happens
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.001); // Low enough to trigger evaporation
    
    // Run the temperature update
    TemperatureSystem.updateTemperature(nextActivePixels);
    
    // Check if water evaporated (turned to air)
    expect(mockCore.type[waterIndex]).toBe(mockEnvironment.TYPE.AIR);
    expect(nextActivePixels.has(waterIndex)).toBe(true);
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('updateTemperature affects soil moisture at high temperatures', () => {
    // Set up test scenario - wet soil with air above it
    const soilIndex = mockCore.getIndex(3, 6);
    const airIndex = mockCore.getIndex(3, 5); // Above the soil
    
    mockCore.type[soilIndex] = mockEnvironment.TYPE.SOIL;
    mockCore.type[airIndex] = mockEnvironment.TYPE.AIR;
    mockCore.state[soilIndex] = mockEnvironment.STATE.WET;
    mockCore.water[soilIndex] = 50; // Significant water content
    
    // Set high temperature to increase evaporation chance
    mockEnvironment.temperature = 200; // Hot
    
    // Mock random to ensure evaporation happens
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.001); // Low enough to trigger evaporation
    
    // Run the temperature update
    TemperatureSystem.updateTemperature(nextActivePixels);
    
    // Check if soil lost some moisture
    expect(mockCore.water[soilIndex]).toBe(49);
    expect(nextActivePixels.has(soilIndex)).toBe(true);
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('extreme temperatures can damage plants', () => {
    // Set up test scenario - plant
    const plantIndex = mockCore.getIndex(7, 3);
    
    mockCore.type[plantIndex] = mockEnvironment.TYPE.PLANT;
    
    // Set extreme temperature to increase damage chance
    mockEnvironment.temperature = 250; // Very hot
    
    // Mock random to ensure damage happens
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.0001); // Low enough to trigger damage
    
    // Run the temperature update
    TemperatureSystem.updateTemperature(nextActivePixels);
    
    // Check if plant died and became dead matter
    expect(mockCore.type[plantIndex]).toBe(mockEnvironment.TYPE.DEAD_MATTER);
    expect(nextActivePixels.has(plantIndex)).toBe(true);
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('extreme temperatures affect creature energy through actual system updates', () => {
    // Set up test scenario - insect with moderate energy
    const insectIndex = mockCore.getIndex(2, 2);
    mockCore.type[insectIndex] = mockEnvironment.TYPE.INSECT;
    mockCore.energy[insectIndex] = 50; // Start with moderate energy
    
    // Set extreme temperature
    mockEnvironment.temperature = 50; // Very cold
    
    // Test multiple scenarios
    const scenarios = [
      { randomValue: 0.001, expectedEnergyChange: -2 },  // Very low random (high energy loss)
      { randomValue: 0.5, expectedEnergyChange: -1 },    // Medium random (normal energy loss)
      { randomValue: 0.999, expectedEnergyChange: 0 }    // High random (no energy loss)
    ];
    
    for (const scenario of scenarios) {
      // Reset energy for each scenario
      mockCore.energy[insectIndex] = 50;
      
      // Set random value for this scenario
      jest.spyOn(Math, 'random').mockReturnValue(scenario.randomValue);
      
      // Run the actual temperature update
      TemperatureSystem.updateTemperature(nextActivePixels);
      
      // Verify energy change
      expect(mockCore.energy[insectIndex]).toBe(50 + scenario.expectedEnergyChange);
      
      // Verify pixel was marked active if energy changed
      if (scenario.expectedEnergyChange !== 0) {
        expect(nextActivePixels.has(insectIndex)).toBe(true);
      }
    }
  });
  
  test('creatures die from temperature effects through actual system updates', () => {
    // Set up test scenario - worm with low energy
    const wormIndex = mockCore.getIndex(4, 8);
    mockCore.type[wormIndex] = mockEnvironment.TYPE.WORM;
    mockCore.energy[wormIndex] = 2; // Just enough energy to potentially die
    
    // Set extreme temperature
    mockEnvironment.temperature = 50; // Very cold
    
    // Test death scenario
    jest.spyOn(Math, 'random').mockReturnValue(0.001); // Very low random to ensure energy loss
    
    // Run the actual temperature update
    TemperatureSystem.updateTemperature(nextActivePixels);
    
    // Verify the actual system behavior
    expect(mockCore.energy[wormIndex]).toBe(0);
    expect(mockCore.type[wormIndex]).toBe(mockEnvironment.TYPE.DEAD_MATTER);
    expect(nextActivePixels.has(wormIndex)).toBe(true);
    
    // Verify death effects
    expect(mockCore.nutrient[wormIndex]).toBeGreaterThan(0); // Should leave nutrients
    expect(mockCore.state[wormIndex]).toBe(mockEnvironment.STATE.DEFAULT);
  });
  
  test('water evaporation should vary based on temperature and conditions', () => {
    // Set up multiple water bodies with different conditions
    const waterBodies = [
      { x: 5, y: 5, depth: 100, airAbove: true },    // Deep water with air
      { x: 5, y: 6, depth: 50, airAbove: true },     // Medium water with air
      { x: 5, y: 7, depth: 25, airAbove: false }     // Shallow water without air
    ];
    
    // Set up the water bodies and their surroundings
    waterBodies.forEach(body => {
      const waterIndex = mockCore.getIndex(body.x, body.y);
      const airIndex = mockCore.getIndex(body.x, body.y - 1);
      
      // Set up water
      mockCore.type[waterIndex] = mockEnvironment.TYPE.WATER;
      mockCore.water[waterIndex] = body.depth;
      
      // Set up air above if needed
      if (body.airAbove) {
        mockCore.type[airIndex] = mockEnvironment.TYPE.AIR;
        mockCore.water[airIndex] = 0;
      } else {
        mockCore.type[airIndex] = mockEnvironment.TYPE.SOIL;
      }
    });
    
    // Test multiple temperature scenarios
    const scenarios = [
      { temperature: 150, randomValue: 0.001, expectedEvaporation: true },   // Hot with low random
      { temperature: 150, randomValue: 0.5, expectedEvaporation: false },    // Hot with medium random
      { temperature: 100, randomValue: 0.001, expectedEvaporation: false },  // Cool with low random
      { temperature: 200, randomValue: 0.5, expectedEvaporation: true }      // Very hot with medium random
    ];
    
    for (const scenario of scenarios) {
      // Reset water levels
      waterBodies.forEach(body => {
        const waterIndex = mockCore.getIndex(body.x, body.y);
        mockCore.water[waterIndex] = body.depth;
      });
      
      // Set temperature and random value
      mockEnvironment.temperature = scenario.temperature;
      jest.spyOn(Math, 'random').mockReturnValue(scenario.randomValue);
      
      // Run temperature update
      TemperatureSystem.updateTemperature(nextActivePixels);
      
      // Verify evaporation behavior
      waterBodies.forEach((body, i) => {
        const waterIndex = mockCore.getIndex(body.x, body.y);
        const airIndex = mockCore.getIndex(body.x, body.y - 1);
        
        if (scenario.expectedEvaporation && body.airAbove) {
          // Water should evaporate if conditions are right
          expect(mockCore.type[waterIndex]).toBe(mockEnvironment.TYPE.AIR);
          expect(mockCore.water[airIndex]).toBeGreaterThan(0); // Some water in air
          expect(nextActivePixels.has(waterIndex)).toBe(true);
          
          // Deeper water should evaporate more slowly
          if (i > 0) {
            const prevWaterIndex = mockCore.getIndex(waterBodies[i-1].x, waterBodies[i-1].y);
            expect(mockCore.water[waterIndex]).toBeLessThanOrEqual(
              mockCore.water[prevWaterIndex]
            );
          }
        } else {
          // Water should not evaporate
          expect(mockCore.type[waterIndex]).toBe(mockEnvironment.TYPE.WATER);
          expect(mockCore.water[waterIndex]).toBe(body.depth);
          if (body.airAbove) {
            expect(mockCore.water[airIndex]).toBe(0);
          }
        }
      });
    }
  });
});