// Plant Flower System Tests

describe('PlantFlowerSystem', () => {
  let mockPlantSystem;
  let mockCore;
  
  beforeEach(() => {
    // Reset modules
    jest.resetModules();
    
    // Mock console
    global.console = { log: jest.fn() };
    
    // Mock random for deterministic tests
    Math.random = jest.fn().mockReturnValue(0.1); // Consistent random value
    Math.floor = jest.fn().mockReturnValue(0); // Predictable results
    
    // Set up mock core
    mockCore = {
      width: 50,
      height: 50,
      size: 2500,
      type: new Uint8Array(2500),
      state: new Uint8Array(2500),
      water: new Uint8Array(2500),
      energy: new Uint8Array(2500),
      nutrient: new Uint8Array(2500),
      metadata: new Uint8Array(2500),
      getIndex: jest.fn((x, y) => {
        if (x < 0 || x >= 50 || y < 0 || y >= 50) return -1;
        return y * 50 + x;
      }),
      getCoords: jest.fn(index => {
        if (index < 0 || index >= 2500) return null;
        return {
          x: index % 50,
          y: Math.floor(index / 50)
        };
      }),
      getNeighborIndices: jest.fn((x, y) => {
        const neighbors = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < 50 && ny >= 0 && ny < 50) {
              neighbors.push({
                x: nx,
                y: ny,
                index: ny * 50 + nx,
                diagonal: dx !== 0 && dy !== 0
              });
            }
          }
        }
        return neighbors;
      })
    };
    
    // Define type and state enums
    const TYPE = {
      AIR: 0,
      WATER: 1,
      SOIL: 2,
      PLANT: 3,
      DEAD_MATTER: 4,
      SEED: 5,
      WORM: 6,
      INSECT: 7
    };
    
    const STATE = {
      DEFAULT: 0,
      WET: 1,
      DRY: 2,
      FERTILE: 3,
      ROOT: 10,
      STEM: 11,
      LEAF: 12,
      FLOWER: 13
    };
    
    // Set up mock plant system with biology
    mockPlantSystem = {
      core: mockCore,
      TYPE: TYPE,
      STATE: STATE,
      biology: {
        metabolism: 1.0,
        reproduction: 1.0
      },
      plantMetrics: {
        stemHeight: 10,
        totalSize: 50
      },
      plantGroups: {}
    };
    
    // Set up the window object
    global.window = {};
    
    // Load the module which will set itself on window
    require('../../../../js/biology/plant/plant-flower-system.js');
    
    // Copy from window to global for easier test access
    global.PlantFlowerSystem = window.PlantFlowerSystem;
    
    // Initialize flower system
    window.PlantFlowerSystem.init(mockPlantSystem);
  });
  
  test('initialization should set references', () => {
    expect(PlantFlowerSystem.plant).toBe(mockPlantSystem);
    expect(PlantFlowerSystem.flowerVariations).toEqual({});
  });
  
  test('should define flower types', () => {
    expect(PlantFlowerSystem.flowerTypes.length).toBeGreaterThan(0);
    expect(PlantFlowerSystem.flowerTypes[0]).toHaveProperty('name');
    expect(PlantFlowerSystem.flowerTypes[0]).toHaveProperty('petalCount');
    expect(PlantFlowerSystem.flowerTypes[0]).toHaveProperty('seedProbability');
  });
  
  test('isFlowerCenter should correctly identify flower centers', () => {
    const centerX = 25;
    const centerY = 25;
    const centerIndex = mockCore.getIndex(centerX, centerY);
    
    // Set up a flower center with stem connection
    mockCore.type[centerIndex] = PlantFlowerSystem.plant.TYPE.PLANT;
    mockCore.state[centerIndex] = PlantFlowerSystem.plant.STATE.FLOWER;
    
    // Add a stem neighbor
    const stemIndex = mockCore.getIndex(centerX + 1, centerY);
    mockCore.type[stemIndex] = PlantFlowerSystem.plant.TYPE.PLANT;
    mockCore.state[stemIndex] = PlantFlowerSystem.plant.STATE.STEM;
    
    // This should be identified as a flower center
    expect(PlantFlowerSystem.isFlowerCenter(centerX, centerY, centerIndex)).toBe(true);
    
    // Now set up a flower petal with no stem connection
    const petalX = 30;
    const petalY = 30;
    const petalIndex = mockCore.getIndex(petalX, petalY);
    
    mockCore.type[petalIndex] = PlantFlowerSystem.plant.TYPE.PLANT;
    mockCore.state[petalIndex] = PlantFlowerSystem.plant.STATE.FLOWER;
    
    // Add a flower neighbor but no stem
    const neighborFlowerIndex = mockCore.getIndex(petalX + 1, petalY);
    mockCore.type[neighborFlowerIndex] = PlantFlowerSystem.plant.TYPE.PLANT;
    mockCore.state[neighborFlowerIndex] = PlantFlowerSystem.plant.STATE.FLOWER;
    
    // This should not be identified as a flower center
    expect(PlantFlowerSystem.isFlowerCenter(petalX, petalY, petalIndex)).toBe(false);
  });
  
  test('updateFlower should create flower variation data', () => {
    const flowerX = 25;
    const flowerY = 25;
    const flowerIndex = mockCore.getIndex(flowerX, flowerY);
    
    // Set up a flower pixel
    mockCore.type[flowerIndex] = PlantFlowerSystem.plant.TYPE.PLANT;
    mockCore.state[flowerIndex] = PlantFlowerSystem.plant.STATE.FLOWER;
    mockCore.energy[flowerIndex] = 50;
    
    // Add a stem connection to make it a flower center
    const stemIndex = mockCore.getIndex(flowerX + 1, flowerY);
    mockCore.type[stemIndex] = PlantFlowerSystem.plant.TYPE.PLANT;
    mockCore.state[stemIndex] = PlantFlowerSystem.plant.STATE.STEM;
    
    // Create a set for next active pixels
    const nextActivePixels = new Set();
    
    // Override Math.floor specifically for this test
    const originalFloor = Math.floor;
    Math.floor = jest.fn(x => {
      if (typeof x === 'number' && x > 0 && x < 1) return 1; // For colorVar
      return 0;
    });
    
    // Update the flower
    PlantFlowerSystem.updateFlower(flowerX, flowerY, flowerIndex, nextActivePixels);
    
    // Restore Math.floor
    Math.floor = originalFloor;
    
    // Check if flower variation was created
    expect(PlantFlowerSystem.flowerVariations[flowerIndex]).toBeDefined();
    expect(PlantFlowerSystem.flowerVariations[flowerIndex]).toHaveProperty('typeIndex');
    expect(PlantFlowerSystem.flowerVariations[flowerIndex]).toHaveProperty('colorVar');
    expect(PlantFlowerSystem.flowerVariations[flowerIndex]).toHaveProperty('size');
    
    // Check if metadata was set
    expect(mockCore.metadata[flowerIndex]).toBeGreaterThan(0);
    
    // Check if flower was marked as active for next frame
    expect(nextActivePixels.has(flowerIndex)).toBe(true);
  });
  
  test('createSeed should create a seed when conditions are met', () => {
    const flowerX = 25;
    const flowerY = 25;
    const flowerIndex = mockCore.getIndex(flowerX, flowerY);
    
    // Set up a flower pixel with high energy
    mockCore.type[flowerIndex] = PlantFlowerSystem.plant.TYPE.PLANT;
    mockCore.state[flowerIndex] = PlantFlowerSystem.plant.STATE.FLOWER;
    mockCore.energy[flowerIndex] = 100;
    
    // Add a stem connection to make it a flower center
    const stemIndex = mockCore.getIndex(flowerX + 1, flowerY);
    mockCore.type[stemIndex] = PlantFlowerSystem.plant.TYPE.PLANT;
    mockCore.state[stemIndex] = PlantFlowerSystem.plant.STATE.STEM;
    
    // Set up a flower variation
    PlantFlowerSystem.flowerVariations[flowerIndex] = {
      typeIndex: 0,
      colorVar: 2,
      size: 1.0
    };
    
    // Create a specific air neighbor for the seed
    const airIndex = mockCore.getIndex(flowerX - 1, flowerY);
    
    // Prepare a mock implementation of getNeighborIndices that returns our controlled neighbors
    const originalGetNeighborIndices = mockCore.getNeighborIndices;
    mockCore.getNeighborIndices = jest.fn().mockReturnValue([
      { index: airIndex, x: flowerX - 1, y: flowerY }
    ]);
    
    // Make the air neighbor actually have AIR type
    mockCore.type[airIndex] = PlantFlowerSystem.plant.TYPE.AIR;
    
    // Create a set for next active pixels
    const nextActivePixels = new Set();
    
    // Create a seed
    PlantFlowerSystem.createSeed(flowerX, flowerY, flowerIndex, nextActivePixels);
    
    // Restore original function
    mockCore.getNeighborIndices = originalGetNeighborIndices;
    
    // Check if a seed was created in the air neighbor
    expect(mockCore.type[airIndex]).toBe(PlantFlowerSystem.plant.TYPE.SEED);
    expect(mockCore.energy[airIndex]).toBe(150);
    expect(mockCore.energy[flowerIndex]).toBe(20); // 100 - 80
    
    // Check if metadata was transferred to seed
    expect(mockCore.metadata[airIndex]).toBeGreaterThan(0);
    
    // Check if seed was marked as active for next frame
    expect(nextActivePixels.has(airIndex)).toBe(true);
  });
  
  test('flower should inherit variation from nearby centers', () => {
    // Set up a flower center first
    const centerX = 25;
    const centerY = 25;
    const centerIndex = mockCore.getIndex(centerX, centerY);
    
    mockCore.type[centerIndex] = PlantFlowerSystem.plant.TYPE.PLANT;
    mockCore.state[centerIndex] = PlantFlowerSystem.plant.STATE.FLOWER;
    
    // Add a stem connection
    const stemIndex = mockCore.getIndex(centerX, centerY + 1);
    mockCore.type[stemIndex] = PlantFlowerSystem.plant.TYPE.PLANT;
    mockCore.state[stemIndex] = PlantFlowerSystem.plant.STATE.STEM;
    
    // Create variation for center with specific values for testing
    PlantFlowerSystem.flowerVariations[centerIndex] = {
      typeIndex: 3, // sunflower
      colorVar: 1,
      size: 1.0
    };
    
    // Now set up a petal nearby
    const petalX = centerX + 1;
    const petalY = centerY;
    const petalIndex = mockCore.getIndex(petalX, petalY);
    
    mockCore.type[petalIndex] = PlantFlowerSystem.plant.TYPE.PLANT;
    mockCore.state[petalIndex] = PlantFlowerSystem.plant.STATE.FLOWER;
    
    // Prepare a mock implementation of getNeighborIndices that returns our controlled neighbors
    const originalGetNeighborIndices = mockCore.getNeighborIndices;
    mockCore.getNeighborIndices = jest.fn().mockImplementation((x, y) => {
      if (x === petalX && y === petalY) {
        // For the petal, return the center as a neighbor
        return [{ index: centerIndex, x: centerX, y: centerY }];
      }
      return [];
    });
    
    // Update the petal
    const nextActivePixels = new Set();
    PlantFlowerSystem.updateFlower(petalX, petalY, petalIndex, nextActivePixels);
    
    // Restore original function
    mockCore.getNeighborIndices = originalGetNeighborIndices;
    
    // Check if petal inherited variation from center
    expect(PlantFlowerSystem.flowerVariations[petalIndex]).toBeDefined();
    expect(PlantFlowerSystem.flowerVariations[petalIndex].typeIndex).toBe(3); // should match center
    expect(PlantFlowerSystem.flowerVariations[petalIndex].colorVar).toBe(1); // should match center
  });
});