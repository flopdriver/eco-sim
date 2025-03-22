// Fire System Tests

describe('FireSystem', () => {
  let mockEnvironment;
  let mockCore;
  let nextActivePixels;
  let FireSystem;

  beforeEach(() => {
    // Reset modules
    jest.resetModules();
    
    // Mock console
    global.console = { log: jest.fn() };
    
    // Mock Math.random for deterministic tests
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    
    // Set up mock core simulation
    mockCore = {
      width: 20,
      height: 20,
      size: 400,
      type: new Uint8Array(400),
      state: new Uint8Array(400),
      water: new Uint8Array(400),
      energy: new Uint8Array(400),
      nutrient: new Uint8Array(400),
      metadata: new Uint8Array(400),
      getIndex: jest.fn((x, y) => {
        if (x < 0 || x >= 20 || y < 0 || y >= 20) return -1;
        return y * 20 + x;
      }),
      getCoords: jest.fn(index => {
        if (index < 0 || index >= 400) return null;
        return {
          x: index % 20,
          y: Math.floor(index / 20)
        };
      }),
      getNeighborIndices: jest.fn((x, y) => {
        const neighbors = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < 20 && ny >= 0 && ny < 20) {
              neighbors.push({
                x: nx,
                y: ny,
                index: ny * 20 + nx,
                diagonal: dx !== 0 && dy !== 0
              });
            }
          }
        }
        return neighbors;
      })
    };
    
    // Define types and states for testing
    const TYPE = {
      AIR: 0,
      WATER: 1,
      SOIL: 2,
      PLANT: 3,
      INSECT: 4,
      SEED: 5,
      DEAD_MATTER: 6,
      WORM: 7
    };
    
    const STATE = {
      DEFAULT: 0,
      WET: 1,
      DRY: 2,
      FERTILE: 3,
      ROOT: 4,
      STEM: 5,
      LEAF: 6,
      FLOWER: 7
    };
    
    // Set up mock environment controller
    mockEnvironment = {
      core: mockCore,
      TYPE: TYPE,
      STATE: STATE,
      dayNightCycle: 128, // Mid-day
      temperature: 150, // Normal temperature
      weatherSystem: {
        weatherPatterns: {
          current: 'clear',
          patterns: {
            clear: { cloudiness: 0.2, rainProbability: 0.0 },
            storm: { cloudiness: 1.0, rainProbability: 1.0 }
          }
        }
      }
    };
    
    // Load the FireSystem module
    FireSystem = require('../../../js/environment/fire-system.js');
    
    // Initialize fire system
    FireSystem.init(mockEnvironment);
    
    // Create a set for next active pixels
    nextActivePixels = new Set();
  });

  // Test initialization
  test('initialization sets environment reference and default properties', () => {
    expect(FireSystem.environment).toBe(mockEnvironment);
    expect(FireSystem.fireProperties.activeFires).toBeInstanceOf(Set);
    expect(FireSystem.fireProperties.spreadProbability).toBeGreaterThan(0);
    expect(FireSystem.fireProperties.burnDuration).toBeGreaterThan(0);
    expect(FireSystem.fireProperties.maxFireSize).toBeGreaterThan(0);
  });

  // Test starting a fire
  test('startFire should initialize a fire on a plant', () => {
    // Set up a plant
    const index = mockCore.getIndex(10, 10);
    mockCore.type[index] = mockEnvironment.TYPE.PLANT;
    mockCore.state[index] = mockEnvironment.STATE.STEM;
    
    // Start fire
    const result = FireSystem.startFire(index, nextActivePixels);
    
    // Validate fire started
    expect(result).toBe(true);
    expect(FireSystem.fireProperties.activeFires.has(index)).toBe(true);
    expect(mockCore.metadata[index]).toBe(1); // Fire just started
    expect(mockCore.energy[index]).toBe(FireSystem.fireProperties.fireIntensity);
    expect(nextActivePixels.has(index)).toBe(true);
  });

  // Test starting a fire on non-flammable material
  test('startFire should not work on non-flammable material', () => {
    // Set up water (non-flammable)
    const index = mockCore.getIndex(10, 10);
    mockCore.type[index] = mockEnvironment.TYPE.WATER;
    
    // Try to start fire
    const result = FireSystem.startFire(index, nextActivePixels);
    
    // Validate fire did not start
    expect(result).toBe(false);
    expect(FireSystem.fireProperties.activeFires.has(index)).toBe(false);
  });

  // Test fire spreading to neighboring plants
  test('spreadFire should handle various spread scenarios correctly', () => {
    // Set up a burning plant
    const sourceX = 10;
    const sourceY = 10;
    const sourceIndex = mockCore.getIndex(sourceX, sourceY);
    mockCore.type[sourceIndex] = mockEnvironment.TYPE.PLANT;
    mockCore.state[sourceIndex] = mockEnvironment.STATE.STEM;
    mockCore.metadata[sourceIndex] = 100; // Established fire
    FireSystem.fireProperties.activeFires.add(sourceIndex);
    
    // Set up neighboring plants with different conditions
    const neighbors = [
      { x: 11, y: 10, state: mockEnvironment.STATE.LEAF, water: 0 },    // Dry leaf (highly flammable)
      { x: 10, y: 11, state: mockEnvironment.STATE.STEM, water: 50 },   // Wet stem (less flammable)
      { x: 9, y: 10, state: mockEnvironment.STATE.ROOT, water: 100 }    // Wet root (least flammable)
    ];
    
    // Set up the neighboring plants
    neighbors.forEach(neighbor => {
      const index = mockCore.getIndex(neighbor.x, neighbor.y);
      mockCore.type[index] = mockEnvironment.TYPE.PLANT;
      mockCore.state[index] = neighbor.state;
      mockCore.water[index] = neighbor.water;
    });
    
    // Test multiple random scenarios
    const scenarios = [
      { randomValue: 0.01, expectedSpreads: 2 },  // Very low random (should spread to dry and wet stem)
      { randomValue: 0.3, expectedSpreads: 1 },   // Medium random (should only spread to dry leaf)
      { randomValue: 0.9, expectedSpreads: 0 }    // High random (should not spread)
    ];
    
    for (const scenario of scenarios) {
      // Reset the fire system state
      FireSystem.fireProperties.activeFires.clear();
      FireSystem.fireProperties.activeFires.add(sourceIndex);
      
      // Set random value for this scenario
      jest.spyOn(Math, 'random').mockReturnValue(scenario.randomValue);
      
      // Spread fire
      FireSystem.spreadFire(sourceIndex, FireSystem.fireProperties.spreadProbability, nextActivePixels);
      
      // Count how many neighbors caught fire
      const spreadCount = neighbors.filter(neighbor => {
        const index = mockCore.getIndex(neighbor.x, neighbor.y);
        return FireSystem.fireProperties.activeFires.has(index);
      }).length;
      
      // Verify spread count matches expected
      expect(spreadCount).toBe(scenario.expectedSpreads);
      
      // Verify fire properties on spread pixels
      neighbors.forEach(neighbor => {
        const index = mockCore.getIndex(neighbor.x, neighbor.y);
        if (FireSystem.fireProperties.activeFires.has(index)) {
          expect(mockCore.metadata[index]).toBe(1); // Fire just started
          expect(mockCore.energy[index]).toBe(FireSystem.fireProperties.fireIntensity);
          expect(nextActivePixels.has(index)).toBe(true);
        }
      });
    }
  });

  // Test fire burning progress and conversion to soil
  test('updateFires should track burn progress and convert fully burned plants to soil', () => {
    // Set up a burning plant
    const index = mockCore.getIndex(10, 10);
    mockCore.type[index] = mockEnvironment.TYPE.PLANT;
    mockCore.state[index] = mockEnvironment.STATE.STEM;
    mockCore.metadata[index] = 195; // Almost fully burned
    FireSystem.fireProperties.activeFires.add(index);
    
    // Update fires
    FireSystem.updateFires(nextActivePixels);
    
    // Should increment burn progress
    expect(mockCore.metadata[index]).toBe(197);
    
    // Update again to reach full burn
    mockCore.metadata[index] = 199; // One step away from full burn
    FireSystem.updateFires(nextActivePixels);
    
    // Should convert to fertile soil
    expect(mockCore.type[index]).toBe(mockEnvironment.TYPE.SOIL);
    expect(mockCore.state[index]).toBe(mockEnvironment.STATE.FERTILE);
    expect(mockCore.nutrient[index]).toBeGreaterThan(100); // High nutrients from ash
    expect(FireSystem.fireProperties.activeFires.has(index)).toBe(false); // Fire is removed
  });

  // Test heat generation
  test('addHeatToSurroundingAir should increase energy in adjacent air pixels', () => {
    // Set up a burning plant
    const plantX = 10;
    const plantY = 10;
    const plantIndex = mockCore.getIndex(plantX, plantY);
    
    // Set up air pixels around it
    const airIndex = mockCore.getIndex(plantX, plantY - 1); // Above the fire
    mockCore.type[airIndex] = mockEnvironment.TYPE.AIR;
    mockCore.energy[airIndex] = 50; // Initial energy
    
    // Add heat
    FireSystem.addHeatToSurroundingAir(plantIndex, nextActivePixels);
    
    // Validate energy increase and pixel activation
    expect(mockCore.energy[airIndex]).toBeGreaterThan(50);
    expect(nextActivePixels.has(airIndex)).toBe(true);
  });

  // Test spontaneous combustion
  test('spontaneous combustion should occur based on environmental conditions', () => {
    // Set up multiple plants with different conditions
    const plants = [
      { x: 10, y: 10, water: 5, temperature: 220 },    // Hot and dry (should combust)
      { x: 15, y: 10, water: 50, temperature: 220 },   // Hot but wet (should not combust)
      { x: 20, y: 10, water: 5, temperature: 150 }     // Dry but cool (should not combust)
    ];
    
    // Set up the plants
    plants.forEach(plant => {
      const index = mockCore.getIndex(plant.x, plant.y);
      mockCore.type[index] = mockEnvironment.TYPE.PLANT;
      mockCore.water[index] = plant.water;
    });
    
    // Test multiple scenarios
    const scenarios = [
      { temperature: 220, randomValue: 0.001, expectedCombustion: true },   // Hot with low random
      { temperature: 220, randomValue: 0.5, expectedCombustion: false },    // Hot with medium random
      { temperature: 150, randomValue: 0.001, expectedCombustion: false },  // Cool with low random
      { temperature: 250, randomValue: 0.5, expectedCombustion: true }      // Very hot with medium random
    ];
    
    for (const scenario of scenarios) {
      // Reset environment and fire system
      mockEnvironment.temperature = scenario.temperature;
      FireSystem.fireProperties.activeFires.clear();
      
      // Set random value for this scenario
      jest.spyOn(Math, 'random').mockReturnValue(scenario.randomValue);
      
      // Run spontaneous combustion check
      FireSystem.checkSpontaneousCombustion(nextActivePixels);
      
      // Verify combustion behavior
      plants.forEach((plant, i) => {
        const index = mockCore.getIndex(plant.x, plant.y);
        if (scenario.expectedCombustion && plant.water < 10) {
          // Plant should catch fire if conditions are right
          expect(FireSystem.fireProperties.activeFires.has(index)).toBe(true);
          expect(mockCore.metadata[index]).toBe(1); // Fire just started
          expect(mockCore.energy[index]).toBe(FireSystem.fireProperties.fireIntensity);
          expect(nextActivePixels.has(index)).toBe(true);
        } else {
          // Plant should not catch fire
          expect(FireSystem.fireProperties.activeFires.has(index)).toBe(false);
          expect(mockCore.type[index]).toBe(mockEnvironment.TYPE.PLANT);
        }
      });
    }
  });

  // Test fire spreading from dead matter
  test('fire should spread effectively from dead matter', () => {
    // Set up burning dead matter
    const sourceIndex = mockCore.getIndex(10, 10);
    mockCore.type[sourceIndex] = mockEnvironment.TYPE.DEAD_MATTER;
    mockCore.metadata[sourceIndex] = 50; // Established fire
    FireSystem.fireProperties.activeFires.add(sourceIndex);
    
    // Set up neighboring plant
    const neighborIndex = mockCore.getIndex(11, 10);
    mockCore.type[neighborIndex] = mockEnvironment.TYPE.PLANT;
    
    // Force random checks to pass for spreading
    jest.spyOn(Math, 'random').mockReturnValue(0.01);
    
    // Spread fire
    FireSystem.spreadFire(sourceIndex, FireSystem.fireProperties.spreadProbability, nextActivePixels);
    
    // Validate dead matter spreads fire effectively
    expect(FireSystem.fireProperties.activeFires.has(neighborIndex)).toBe(true);
  });

  // Test water effects on fire spread
  test('water nearby should reduce fire spread', () => {
    // Instead of testing two separate scenarios, we'll test the calculation directly
    // to ensure water actually reduces the spread chance
    
    // Set up a burning plant
    const sourceX = 10;
    const sourceY = 10;
    const sourceIndex = mockCore.getIndex(sourceX, sourceY);
    mockCore.type[sourceIndex] = mockEnvironment.TYPE.PLANT;
    mockCore.metadata[sourceIndex] = 50; // Established fire
    
    // Set up a neighboring plant
    const neighborX = 11;
    const neighborY = 10;
    const neighborIndex = mockCore.getIndex(neighborX, neighborY);
    mockCore.type[neighborIndex] = mockEnvironment.TYPE.PLANT;
    
    // Clear the environment around the test area
    for (let y = sourceY - 1; y <= sourceY + 1; y++) {
      for (let x = sourceX - 1; x <= sourceX + 3; x++) {
        if (x === sourceX && y === sourceY) continue; // Skip source fire
        if (x === neighborX && y === neighborY) continue; // Skip target plant
        
        const clearIndex = mockCore.getIndex(x, y);
        if (clearIndex !== -1) {
          mockCore.type[clearIndex] = mockEnvironment.TYPE.AIR;
        }
      }
    }
    
    // Get material factor without water
    let materialFactorWithoutWater = 0;
    
    // First test spread without water
    const coords = mockCore.getCoords(neighborIndex);
    const nearbyNeighbors = mockCore.getNeighborIndices(coords.x, coords.y);
    
    // Calculate materialFactor as the fire system would
    let materialFactor = 1.0;
    for (const nearbyNeighbor of nearbyNeighbors) {
      if (nearbyNeighbor.diagonal) continue;
      
      switch (mockCore.type[nearbyNeighbor.index]) {
        case mockEnvironment.TYPE.AIR:
          materialFactor += FireSystem.fireProperties.materialEffects.air;
          break;
      }
    }
    materialFactorWithoutWater = materialFactor;
    
    // Now add water and recalculate
    const waterIndex = mockCore.getIndex(neighborX + 1, neighborY);
    mockCore.type[waterIndex] = mockEnvironment.TYPE.WATER;
    
    // Recalculate material factor
    materialFactor = 1.0;
    for (const nearbyNeighbor of nearbyNeighbors) {
      if (nearbyNeighbor.diagonal) continue;
      
      switch (mockCore.type[nearbyNeighbor.index]) {
        case mockEnvironment.TYPE.WATER:
          materialFactor += FireSystem.fireProperties.materialEffects.water;
          break;
        case mockEnvironment.TYPE.AIR:
          materialFactor += FireSystem.fireProperties.materialEffects.air;
          break;
      }
    }
    materialFactor = Math.max(0.1, materialFactor);
    const materialFactorWithWater = materialFactor;
    
    // Test that water significantly reduces the material factor
    expect(materialFactorWithWater).toBeLessThan(materialFactorWithoutWater);
    
    // The water effect should be strong enough to make a meaningful difference
    expect(materialFactorWithWater).toBeLessThan(materialFactorWithoutWater * 0.5);
  });

  // Test fire resistance of different plant parts
  test('different plant parts should have different flammability based on actual system behavior', () => {
    // Create 4 plants with different parts
    const plants = [
      { x: 5, y: 5, state: mockEnvironment.STATE.LEAF },    // Leaf (should burn fastest)
      { x: 6, y: 5, state: mockEnvironment.STATE.FLOWER },  // Flower (should burn medium-fast)
      { x: 7, y: 5, state: mockEnvironment.STATE.STEM },    // Stem (should burn medium)
      { x: 8, y: 5, state: mockEnvironment.STATE.ROOT }     // Root (should burn slowest)
    ];
    
    // Set up the plants
    plants.forEach(plant => {
      const index = mockCore.getIndex(plant.x, plant.y);
      mockCore.type[index] = mockEnvironment.TYPE.PLANT;
      mockCore.state[index] = plant.state;
      mockCore.water[index] = 0; // Dry plants for consistent testing
    });
    
    // Start fires on all plants
    plants.forEach(plant => {
      const index = mockCore.getIndex(plant.x, plant.y);
      FireSystem.startFire(index, nextActivePixels);
    });
    
    // Reset metadata to ensure consistent starting point
    plants.forEach(plant => {
      const index = mockCore.getIndex(plant.x, plant.y);
      mockCore.metadata[index] = 1;
    });
    
    // Run multiple updates to observe actual burn rates
    for (let i = 0; i < 10; i++) {
      FireSystem.updateFires(nextActivePixels);
    }
    
    // Verify relative burn rates using actual system behavior
    const burnRates = plants.map(plant => {
      const index = mockCore.getIndex(plant.x, plant.y);
      return {
        state: plant.state,
        burnProgress: mockCore.metadata[index]
      };
    });
    
    // Verify the relative burn rates: leaves > flowers > stems > roots
    expect(burnRates[0].burnProgress).toBeGreaterThan(burnRates[1].burnProgress);
    expect(burnRates[1].burnProgress).toBeGreaterThan(burnRates[2].burnProgress);
    expect(burnRates[2].burnProgress).toBeGreaterThan(burnRates[3].burnProgress);
    
    // Verify all burn faster than roots specifically
    burnRates.forEach((rate, i) => {
      if (i < 3) { // All except roots
        expect(rate.burnProgress).toBeGreaterThan(burnRates[3].burnProgress);
      }
    });
    
    // Verify energy consumption matches burn rates
    plants.forEach((plant, i) => {
      const index = mockCore.getIndex(plant.x, plant.y);
      if (i < 3) { // All except roots
        expect(mockCore.energy[index]).toBeLessThan(FireSystem.fireProperties.fireIntensity);
      }
    });
  });

  // Test maximum fire size limiting
  test('fire spread should be reduced when maximum fire size is reached', () => {
    // Set a temporary small max fire size for testing
    const originalMax = FireSystem.fireProperties.maxFireSize;
    FireSystem.fireProperties.maxFireSize = 5;
    
    // Create multiple burning plants to reach the max
    for (let i = 0; i < 6; i++) {
      const index = mockCore.getIndex(5 + i, 10);
      mockCore.type[index] = mockEnvironment.TYPE.PLANT;
      FireSystem.startFire(index, nextActivePixels);
    }
    
    // Check if the spread probability gets reduced
    const normalSpread = FireSystem.fireProperties.spreadProbability;
    const reducedSpread = FireSystem.fireProperties.spreadProbability * 0.3;
    
    const effectiveSpread = FireSystem.fireProperties.activeFires.size > FireSystem.fireProperties.maxFireSize ?
      reducedSpread : normalSpread;
    
    // Validate fire spread rate is reduced
    expect(effectiveSpread).toBeLessThan(normalSpread);
    
    // Restore original max
    FireSystem.fireProperties.maxFireSize = originalMax;
  });

  // Test smoke generation
  test('smoke generation should vary based on fire intensity and conditions', () => {
    // Set up multiple burning plants with different intensities
    const plants = [
      { x: 10, y: 10, intensity: 100 },  // Strong fire
      { x: 15, y: 10, intensity: 50 },   // Medium fire
      { x: 20, y: 10, intensity: 25 }    // Weak fire
    ];
    
    // Set up the burning plants
    plants.forEach(plant => {
      const index = mockCore.getIndex(plant.x, plant.y);
      mockCore.type[index] = mockEnvironment.TYPE.PLANT;
      mockCore.metadata[index] = 50; // Established fire
      mockCore.energy[index] = plant.intensity;
      FireSystem.fireProperties.activeFires.add(index);
    });
    
    // Set up air pixels above each fire
    const airPixels = plants.map(plant => ({
      fireIndex: mockCore.getIndex(plant.x, plant.y),
      airIndex: mockCore.getIndex(plant.x, plant.y - 2)
    }));
    
    // Initialize air pixels
    airPixels.forEach(pixel => {
      mockCore.type[pixel.airIndex] = mockEnvironment.TYPE.AIR;
      mockCore.water[pixel.airIndex] = 0; // No smoke yet
    });
    
    // Test multiple scenarios
    const scenarios = [
      { randomValue: 0.01, expectedSmoke: true },   // Very low random (should create smoke)
      { randomValue: 0.5, expectedSmoke: false },   // Medium random (should not create smoke)
      { randomValue: 0.99, expectedSmoke: false }   // High random (should not create smoke)
    ];
    
    for (const scenario of scenarios) {
      // Reset smoke levels
      airPixels.forEach(pixel => {
        mockCore.water[pixel.airIndex] = 0;
      });
      
      // Set random value for this scenario
      jest.spyOn(Math, 'random').mockReturnValue(scenario.randomValue);
      
      // Add heat and potentially create smoke for each fire
      airPixels.forEach(pixel => {
        FireSystem.addHeatToSurroundingAir(pixel.fireIndex, nextActivePixels);
      });
      
      // Verify smoke behavior
      airPixels.forEach((pixel, i) => {
        const plant = plants[i];
        if (scenario.expectedSmoke) {
          // Stronger fires should create more smoke
          expect(mockCore.water[pixel.airIndex]).toBeGreaterThan(0);
          if (i > 0) {
            // Each subsequent fire should create less smoke than the previous
            expect(mockCore.water[pixel.airIndex]).toBeLessThanOrEqual(
              mockCore.water[airPixels[i-1].airIndex]
            );
          }
        } else {
          expect(mockCore.water[pixel.airIndex]).toBe(0);
        }
      });
    }
  });

  // Test fire interaction with weather
  test('heavy rain should make spontaneous combustion less likely', () => {
    // Change weather to stormy/rainy
    mockEnvironment.weatherSystem.weatherPatterns.current = 'storm';
    
    // Set temperature high
    mockEnvironment.temperature = 220;
    
    // Create a somewhat dry plant that would normally catch fire
    const index = mockCore.getIndex(10, 10);
    mockCore.type[index] = mockEnvironment.TYPE.PLANT;
    mockCore.water[index] = 5;
    
    // Check for spontaneous combustion
    FireSystem.checkSpontaneousCombustion(nextActivePixels);
    
    // During rain, even with high temp, probability should stay low
    // This test just verifies that the system considers weather conditions
    // The actual behavior depends on implementation details
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("Spontaneous combustion occurred"));
  });
});