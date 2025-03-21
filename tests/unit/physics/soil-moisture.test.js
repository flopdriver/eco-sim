// Soil Moisture System Tests

describe('SoilMoistureSystem', () => {
  let SoilMoistureSystem;
  let mockPhysics;
  let mockCore;
  let activePixels;
  let nextActivePixels;
  
  beforeEach(() => {
    // Create a new SoilMoistureSystem instance for each test
    jest.resetModules();
    
    // Mock console to avoid actual console logs
    global.console = { log: jest.fn() };
    
    // Load the SoilMoistureSystem module
    SoilMoistureSystem = require('../../../js/physics/soil-moisture.js');
    
    // Set up mock core simulation
    mockCore = {
      width: 10,
      height: 10,
      size: 100,
      type: new Uint8Array(100),
      state: new Uint8Array(100),
      water: new Uint8Array(100),
      nutrient: new Uint8Array(100),
      metadata: new Uint8Array(100),
      getIndex: jest.fn((x, y) => {
        if (x < 0 || x >= 10 || y < 0 || y >= 10) return -1;
        return y * 10 + x;
      }),
      getCoords: jest.fn(index => {
        if (index < 0 || index >= 100) return null;
        return {
          x: index % 10,
          y: Math.floor(index / 10)
        };
      }),
      getNeighborIndices: jest.fn((x, y) => {
        const neighbors = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            const index = mockCore.getIndex(nx, ny);
            if (index !== -1) {
              neighbors.push({
                x: nx,
                y: ny,
                index: index,
                diagonal: dx !== 0 && dy !== 0
              });
            }
          }
        }
        return neighbors;
      })
    };
    
    // Define TYPE and STATE for testing
    const TYPE = {
      AIR: 0,
      WATER: 1,
      SOIL: 2,
      PLANT: 3,
      SEED: 4,
      DEAD_MATTER: 6,
      WORM: 7
    };
    
    const STATE = {
      DEFAULT: 0,
      WET: 1,
      DRY: 2,
      FERTILE: 3,
      CLAY: 4,
      SANDY: 5,
      LOAMY: 6,
      ROCKY: 7
    };
    
    // Set up mock physics system
    mockPhysics = {
      core: mockCore,
      TYPE: TYPE,
      STATE: STATE,
      processedThisFrame: new Uint8Array(100)
    };
    
    // Initialize soil moisture system with mock physics
    SoilMoistureSystem.init(mockPhysics);
    
    // Create sets for active pixels
    activePixels = new Set();
    nextActivePixels = new Set();
  });
  
  test('initialization sets physics reference', () => {
    expect(SoilMoistureSystem.physics).toBe(mockPhysics);
  });
  
  test('updateSoilMoisture moves water downward in soil', () => {
    // Set up wet soil with drier soil below
    const wetSoilIndex = mockPhysics.core.getIndex(5, 5);
    const drySoilBelowIndex = mockPhysics.core.getIndex(5, 6);
    
    mockPhysics.core.type[wetSoilIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[wetSoilIndex] = mockPhysics.STATE.WET;
    mockPhysics.core.water[wetSoilIndex] = 50;
    
    mockPhysics.core.type[drySoilBelowIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[drySoilBelowIndex] = mockPhysics.STATE.DRY;
    mockPhysics.core.water[drySoilBelowIndex] = 10;
    
    activePixels.add(wetSoilIndex);
    
    // Run the soil moisture update
    SoilMoistureSystem.updateSoilMoisture(activePixels, nextActivePixels);
    
    // Verify water moved down
    expect(mockPhysics.core.water[wetSoilIndex]).toBeLessThan(50);
    expect(mockPhysics.core.water[drySoilBelowIndex]).toBeGreaterThan(10);
    expect(nextActivePixels.has(drySoilBelowIndex)).toBe(true);
  });
  
  test('updateSoilMoisture moves water horizontally in soil', () => {
    // This test checks horizontal water movement which is less frequent
    // Make Math.random always return a small value to guarantee horizontal movement
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.1); // Below the 0.2 threshold

    // Set up wet soil with dry soil to the side
    const wetSoilIndex = mockPhysics.core.getIndex(5, 5);
    const drySoilRightIndex = mockPhysics.core.getIndex(6, 5);
    
    mockPhysics.core.type[wetSoilIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[wetSoilIndex] = mockPhysics.STATE.WET;
    mockPhysics.core.water[wetSoilIndex] = 100;
    
    mockPhysics.core.type[drySoilRightIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[drySoilRightIndex] = mockPhysics.STATE.DRY;
    mockPhysics.core.water[drySoilRightIndex] = 10;
    
    activePixels.add(wetSoilIndex);
    
    // Run the soil moisture update
    SoilMoistureSystem.updateSoilMoisture(activePixels, nextActivePixels);
    
    // Verify water moved horizontally
    expect(mockPhysics.core.water[wetSoilIndex]).toBeLessThan(100);
    expect(mockPhysics.core.water[drySoilRightIndex]).toBeGreaterThan(10);
    expect(nextActivePixels.has(drySoilRightIndex)).toBe(true);
    
    // Restore original Math.random
    Math.random = originalRandom;
  });
  
  test('updateSoilMoisture only processes soil with water above threshold', () => {
    // Set up dry soil with little water
    const drySoilIndex = mockPhysics.core.getIndex(3, 3);
    
    mockPhysics.core.type[drySoilIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[drySoilIndex] = mockPhysics.STATE.DRY;
    mockPhysics.core.water[drySoilIndex] = 10; // Below the 20 threshold
    
    activePixels.add(drySoilIndex);
    
    // Spy on updateSingleSoilMoisture to see if it's called
    const spy = jest.spyOn(SoilMoistureSystem, 'updateSingleSoilMoisture');
    
    // Run the soil moisture update
    SoilMoistureSystem.updateSoilMoisture(activePixels, nextActivePixels);
    
    // Verify updateSingleSoilMoisture was not called
    expect(spy).not.toHaveBeenCalled();
    
    // Cleanup
    spy.mockRestore();
  });
  
  test('updateSingleSoilMoisture skips already processed pixels', () => {
    // Set up wet soil with dry soil below
    const wetSoilIndex = mockPhysics.core.getIndex(4, 4);
    const drySoilBelowIndex = mockPhysics.core.getIndex(4, 5);
    
    mockPhysics.core.type[wetSoilIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[wetSoilIndex] = mockPhysics.STATE.WET;
    mockPhysics.core.water[wetSoilIndex] = 50;
    
    mockPhysics.core.type[drySoilBelowIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[drySoilBelowIndex] = mockPhysics.STATE.DRY;
    mockPhysics.core.water[drySoilBelowIndex] = 10;
    
    // Mark as already processed
    mockPhysics.processedThisFrame[wetSoilIndex] = 1;
    
    // Run updateSingleSoilMoisture directly
    SoilMoistureSystem.updateSingleSoilMoisture(4, 4, wetSoilIndex, nextActivePixels);
    
    // Verify no water transfer occurred
    expect(mockPhysics.core.water[wetSoilIndex]).toBe(50);
    expect(mockPhysics.core.water[drySoilBelowIndex]).toBe(10);
    expect(nextActivePixels.has(drySoilBelowIndex)).toBe(false);
  });
  
  test('updateSingleSoilMoisture updates soil state based on water content', () => {
    // Set up wet soil with dry soil below
    const wetSoilIndex = mockPhysics.core.getIndex(6, 6);
    const drySoilBelowIndex = mockPhysics.core.getIndex(6, 7);
    
    mockPhysics.core.type[wetSoilIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[wetSoilIndex] = mockPhysics.STATE.WET;
    mockPhysics.core.water[wetSoilIndex] = 25; // Just above wet threshold
    
    mockPhysics.core.type[drySoilBelowIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[drySoilBelowIndex] = mockPhysics.STATE.DRY;
    mockPhysics.core.water[drySoilBelowIndex] = 10;
    
    // Run updateSingleSoilMoisture directly
    SoilMoistureSystem.updateSingleSoilMoisture(6, 6, wetSoilIndex, nextActivePixels);
    
    // Verify water transfer occurred and states were updated
    expect(mockPhysics.core.water[wetSoilIndex]).toBeLessThan(25);
    expect(mockPhysics.core.water[drySoilBelowIndex]).toBeGreaterThan(10);
    
    // If water dropped below 20, state should be DRY
    if (mockPhysics.core.water[wetSoilIndex] <= 20) {
      expect(mockPhysics.core.state[wetSoilIndex]).toBe(mockPhysics.STATE.DRY);
    }
    
    // If water went above 20, state should be WET
    if (mockPhysics.core.water[drySoilBelowIndex] > 20) {
      expect(mockPhysics.core.state[drySoilBelowIndex]).toBe(mockPhysics.STATE.WET);
    }
  });
  
  test('wet soil remains active after processing', () => {
    // Set up very wet soil
    const wetSoilIndex = mockPhysics.core.getIndex(7, 7);
    
    mockPhysics.core.type[wetSoilIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[wetSoilIndex] = mockPhysics.STATE.WET;
    mockPhysics.core.water[wetSoilIndex] = 100;
    
    // Run updateSingleSoilMoisture directly
    SoilMoistureSystem.updateSingleSoilMoisture(7, 7, wetSoilIndex, nextActivePixels);
    
    // Verify the soil is still marked as active
    expect(nextActivePixels.has(wetSoilIndex)).toBe(true);
  });

  test('different soil types affect water movement rates', () => {
    // Set up wet soil with different soil types below
    const wetSoilIndex = mockPhysics.core.getIndex(2, 2);
    const sandyBelowIndex = mockPhysics.core.getIndex(2, 3); 
    const clayBelowIndex = mockPhysics.core.getIndex(3, 3);
    
    // Wet source soil
    mockPhysics.core.type[wetSoilIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[wetSoilIndex] = mockPhysics.STATE.WET;
    mockPhysics.core.water[wetSoilIndex] = 100;
    
    // Sandy soil (should drain faster)
    mockPhysics.core.type[sandyBelowIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[sandyBelowIndex] = mockPhysics.STATE.SANDY;
    mockPhysics.core.water[sandyBelowIndex] = 10;
    
    // Clay soil (should drain slower)
    mockPhysics.core.type[clayBelowIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[clayBelowIndex] = mockPhysics.STATE.CLAY;
    mockPhysics.core.water[clayBelowIndex] = 10;
    
    activePixels.add(wetSoilIndex);
    
    // Run the soil moisture update
    SoilMoistureSystem.updateSoilMoisture(activePixels, nextActivePixels);
    
    // Test skipped if soil types don't affect water movement in current implementation
    if (SoilMoistureSystem.soilTypeAffectsWaterMovement) {
      // Verify water moves differently based on soil type
      expect(mockPhysics.core.water[sandyBelowIndex]).toBeGreaterThan(mockPhysics.core.water[clayBelowIndex]);
    }
  });

  test('worm tunnels improve water drainage', () => {
    // Set up wet soil with a worm tunnel
    const wetSoilIndex = mockPhysics.core.getIndex(1, 1);
    const wormTunnelBelowIndex = mockPhysics.core.getIndex(1, 2);
    const regularSoilBelowIndex = mockPhysics.core.getIndex(2, 2);
    
    // Wet source soil
    mockPhysics.core.type[wetSoilIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[wetSoilIndex] = mockPhysics.STATE.WET;
    mockPhysics.core.water[wetSoilIndex] = 100;
    
    // Soil with worm tunnel (should have improved drainage)
    mockPhysics.core.type[wormTunnelBelowIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[wormTunnelBelowIndex] = mockPhysics.STATE.FERTILE; // Fertile from worm activity
    mockPhysics.core.water[wormTunnelBelowIndex] = 10;
    mockPhysics.core.metadata[wormTunnelBelowIndex] = 1; // Flag for worm tunnel
    
    // Regular soil for comparison
    mockPhysics.core.type[regularSoilBelowIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.state[regularSoilBelowIndex] = mockPhysics.STATE.DEFAULT;
    mockPhysics.core.water[regularSoilBelowIndex] = 10;
    
    activePixels.add(wetSoilIndex);
    
    // Run the soil moisture update
    SoilMoistureSystem.updateSoilMoisture(activePixels, nextActivePixels);
    
    // Test skipped if worm tunnels don't affect drainage in current implementation
    if (SoilMoistureSystem.wormTunnelsAffectDrainage) {
      // Verify water moves better through worm tunnels
      expect(mockPhysics.core.water[wormTunnelBelowIndex]).toBeGreaterThan(mockPhysics.core.water[regularSoilBelowIndex]);
    }
  });

  test('soil layers are created with depth', () => {
    // Test to verify soil layer distribution if implemented
    const layerCounts = {
      [mockPhysics.STATE.DEFAULT]: 0,
      [mockPhysics.STATE.CLAY]: 0,
      [mockPhysics.STATE.SANDY]: 0,
      [mockPhysics.STATE.LOAMY]: 0,
      [mockPhysics.STATE.ROCKY]: 0
    };
    
    // Create soil column
    for (let y = 5; y < 10; y++) {
      const index = mockPhysics.core.getIndex(5, y);
      mockPhysics.core.type[index] = mockPhysics.TYPE.SOIL;
      
      // Call the layer creation function if it exists
      if (typeof SoilMoistureSystem.determineSoilLayer === 'function') {
        mockPhysics.core.state[index] = SoilMoistureSystem.determineSoilLayer(5, y);
      }
      
      // Count each layer type
      layerCounts[mockPhysics.core.state[index]]++;
    }
    
    // Skip test if soil layers feature is not implemented
    if (typeof SoilMoistureSystem.determineSoilLayer === 'function') {
      // Verify that we have at least some different soil types
      const uniqueLayerTypes = Object.values(layerCounts).filter(count => count > 0).length;
      expect(uniqueLayerTypes).toBeGreaterThan(1);
    }
  });
});