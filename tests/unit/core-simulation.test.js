// Core simulation test suite

describe('CoreSimulation', () => {
  let CoreSimulation;

  beforeEach(() => {
    // Create a fresh copy of CoreSimulation for each test
    jest.resetModules();
    
    // Mock the global console to avoid actual console logs
    global.console = { log: jest.fn() };
    
    // Load the CoreSimulation module
    CoreSimulation = require('../../js/core-simulation.js');
    
    // Initialize with test values
    CoreSimulation.width = 10;
    CoreSimulation.height = 10;
    
    // Mock TYPE and STATE enums
    CoreSimulation.TYPE = {
      AIR: 0,
      WATER: 1,
      SOIL: 2,
      PLANT: 3,
      SEED: 4,
      WORM: 5,
      INSECT: 6
    };
    
    CoreSimulation.STATE = {
      DEFAULT: 0,
      WET: 1,
      DRY: 2,
      FERTILE: 3,
      ADULT: 4
    };
    
    // Initialize the core data structures
    CoreSimulation.init();
  });
  
  test('init() should initialize data structures correctly', () => {
    // Verify size calculation
    expect(CoreSimulation.size).toBe(100); // 10x10
    
    // Verify all arrays are created
    expect(CoreSimulation.type).toBeInstanceOf(Uint8Array);
    expect(CoreSimulation.type.length).toBe(100);
    
    expect(CoreSimulation.state).toBeInstanceOf(Uint8Array);
    expect(CoreSimulation.water).toBeInstanceOf(Uint8Array);
    expect(CoreSimulation.nutrient).toBeInstanceOf(Uint8Array);
    expect(CoreSimulation.energy).toBeInstanceOf(Uint8Array);
    expect(CoreSimulation.metadata).toBeInstanceOf(Uint8Array);
    expect(CoreSimulation.cloud).toBeInstanceOf(Uint8Array);
  });
  
  test('getIndex() should convert coordinates to array index', () => {
    // Test valid coordinates
    expect(CoreSimulation.getIndex(0, 0)).toBe(0);
    expect(CoreSimulation.getIndex(9, 9)).toBe(99);
    expect(CoreSimulation.getIndex(5, 2)).toBe(25);
    
    // Test boundary conditions
    expect(CoreSimulation.getIndex(-1, 5)).toBe(-1);
    expect(CoreSimulation.getIndex(10, 5)).toBe(-1);
    expect(CoreSimulation.getIndex(5, -1)).toBe(-1);
    expect(CoreSimulation.getIndex(5, 10)).toBe(-1);
  });
  
  test('getCoords() should convert index to coordinates', () => {
    // Test valid indices
    expect(CoreSimulation.getCoords(0)).toEqual({ x: 0, y: 0 });
    expect(CoreSimulation.getCoords(99)).toEqual({ x: 9, y: 9 });
    expect(CoreSimulation.getCoords(25)).toEqual({ x: 5, y: 2 });
    
    // Test boundary conditions
    expect(CoreSimulation.getCoords(-1)).toBeNull();
    expect(CoreSimulation.getCoords(100)).toBeNull();
  });
  
  test('getNeighborIndices() should return all valid neighbors', () => {
    // Middle pixel should have 8 neighbors
    const middleNeighbors = CoreSimulation.getNeighborIndices(5, 5);
    expect(middleNeighbors.length).toBe(8);
    
    // Corner pixel (0,0) should have 3 neighbors
    const cornerNeighbors = CoreSimulation.getNeighborIndices(0, 0);
    expect(cornerNeighbors.length).toBe(3);
    
    // Edge pixel (0,5) should have 5 neighbors
    const edgeNeighbors = CoreSimulation.getNeighborIndices(0, 5);
    expect(edgeNeighbors.length).toBe(5);
  });
  
  test('swapPixels() should exchange all properties between pixels', () => {
    // Set up two pixels with different properties
    const index1 = CoreSimulation.getIndex(1, 1);
    const index2 = CoreSimulation.getIndex(2, 2);
    
    CoreSimulation.type[index1] = CoreSimulation.TYPE.WATER;
    CoreSimulation.water[index1] = 100;
    
    CoreSimulation.type[index2] = CoreSimulation.TYPE.SOIL;
    CoreSimulation.nutrient[index2] = 50;
    
    // Swap the pixels
    CoreSimulation.swapPixels(index1, index2);
    
    // Verify properties were swapped
    expect(CoreSimulation.type[index1]).toBe(CoreSimulation.TYPE.SOIL);
    expect(CoreSimulation.nutrient[index1]).toBe(50);
    
    expect(CoreSimulation.type[index2]).toBe(CoreSimulation.TYPE.WATER);
    expect(CoreSimulation.water[index2]).toBe(100);
  });
  
  test('clearPixel() should reset a pixel to air type with no properties', () => {
    // Set up a pixel with non-default properties
    const index = CoreSimulation.getIndex(3, 3);
    CoreSimulation.type[index] = CoreSimulation.TYPE.PLANT;
    CoreSimulation.water[index] = 75;
    CoreSimulation.energy[index] = 100;
    
    // Clear the pixel
    CoreSimulation.clearPixel(index);
    
    // Verify all properties were reset
    expect(CoreSimulation.type[index]).toBe(CoreSimulation.TYPE.AIR);
    expect(CoreSimulation.state[index]).toBe(CoreSimulation.STATE.DEFAULT);
    expect(CoreSimulation.water[index]).toBe(0);
    expect(CoreSimulation.nutrient[index]).toBe(0);
    expect(CoreSimulation.energy[index]).toBe(0);
    expect(CoreSimulation.metadata[index]).toBe(0);
  });
  
  test('findPixelsOfType() should return all matching indices', () => {
    // Set up a few pixels of the same type
    CoreSimulation.type[CoreSimulation.getIndex(1, 1)] = CoreSimulation.TYPE.PLANT;
    CoreSimulation.type[CoreSimulation.getIndex(3, 4)] = CoreSimulation.TYPE.PLANT;
    CoreSimulation.type[CoreSimulation.getIndex(6, 7)] = CoreSimulation.TYPE.PLANT;
    
    // Find all plant pixels
    const plantIndices = CoreSimulation.findPixelsOfType(CoreSimulation.TYPE.PLANT);
    
    // Verify we found exactly the three indices we set
    expect(plantIndices.length).toBe(3);
    expect(plantIndices).toContain(CoreSimulation.getIndex(1, 1));
    expect(plantIndices).toContain(CoreSimulation.getIndex(3, 4));
    expect(plantIndices).toContain(CoreSimulation.getIndex(6, 7));
  });
  
  test('countPixelsOfType() should return accurate count', () => {
    // Set up a few pixels of the same type
    CoreSimulation.type[CoreSimulation.getIndex(1, 1)] = CoreSimulation.TYPE.WATER;
    CoreSimulation.type[CoreSimulation.getIndex(3, 4)] = CoreSimulation.TYPE.WATER;
    CoreSimulation.type[CoreSimulation.getIndex(6, 7)] = CoreSimulation.TYPE.WATER;
    CoreSimulation.type[CoreSimulation.getIndex(8, 8)] = CoreSimulation.TYPE.WATER;
    
    // Count water pixels
    const waterCount = CoreSimulation.countPixelsOfType(CoreSimulation.TYPE.WATER);
    
    // Verify we found exactly the four pixels we set
    expect(waterCount).toBe(4);
  });
});