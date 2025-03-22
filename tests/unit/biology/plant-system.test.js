// Plant System Tests

describe('PlantSystem', () => {
  let PlantSystem;
  let mockBiology;
  let mockCore;
  
  // Mock subsystems
  const mockRootSystem = {
    init: jest.fn().mockReturnThis(),
    updateRoot: jest.fn(),
    adjustRootGrowthParameters: jest.fn()
  };
  
  const mockStemSystem = {
    init: jest.fn().mockReturnThis(),
    updateStem: jest.fn()
  };
  
  const mockLeafSystem = {
    init: jest.fn().mockReturnThis(),
    updateLeaf: jest.fn()
  };
  
  const mockFlowerSystem = {
    init: jest.fn().mockReturnThis(),
    updateFlower: jest.fn()
  };

  beforeEach(() => {
    // Reset modules
    jest.resetModules();
    
    // Mock console
    global.console = { log: jest.fn() };
    
    // Mock random for deterministic tests
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.1); // Consistent random value
    
    // Mock global objects
    global.PlantRootSystem = mockRootSystem;
    global.PlantStemSystem = mockStemSystem;
    global.PlantLeafSystem = mockLeafSystem;
    global.PlantFlowerSystem = mockFlowerSystem;
    
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
    
    // Set up mock biology system
    mockBiology = {
      core: mockCore,
      TYPE: TYPE,
      STATE: STATE,
      metabolism: 1.0,
      processedThisFrame: new Uint8Array(2500)
    };
    
    // Load the PlantSystem module
    PlantSystem = require('../../../js/biology/plant/plant-system.js');
    
    // Initialize plant system
    PlantSystem.init(mockBiology);
  });
  
  test('initialization should set references and initialize subsystems', () => {
    expect(PlantSystem.biology).toBe(mockBiology);
    expect(PlantSystem.core).toBe(mockCore);
    expect(PlantSystem.TYPE).toBe(mockBiology.TYPE);
    expect(PlantSystem.STATE).toBe(mockBiology.STATE);
    
    expect(mockRootSystem.init).toHaveBeenCalledWith(PlantSystem);
    expect(mockStemSystem.init).toHaveBeenCalledWith(PlantSystem);
    expect(mockLeafSystem.init).toHaveBeenCalledWith(PlantSystem);
    expect(mockFlowerSystem.init).toHaveBeenCalledWith(PlantSystem);
    
    expect(PlantSystem.plantAges).toEqual({});
    expect(PlantSystem.plantOrigins).toEqual({});
    expect(PlantSystem.plantGroups).toEqual({});
    expect(PlantSystem.nextPlantGroupId).toBe(1);
  });
  
  test('findGroundConnectedRoots should identify roots touching soil', () => {
    // Set up test scenario - ground level is at 30 (0.6 * 50)
    const groundLevel = Math.floor(mockCore.height * 0.6); // 30
    
    // Create a few plant roots at and below ground level
    const rootIndices = [
      mockCore.getIndex(10, groundLevel), // At ground level
      mockCore.getIndex(20, groundLevel + 5), // Below ground level
      mockCore.getIndex(30, groundLevel - 5) // Above ground level (shouldn't be connected)
    ];
    
    // Set up roots
    rootIndices.forEach(index => {
      mockCore.type[index] = PlantSystem.TYPE.PLANT;
      mockCore.state[index] = PlantSystem.STATE.ROOT;
    });
    
    // Set up soil around roots
    mockCore.getNeighborIndices(10, groundLevel).forEach(neighbor => {
      mockCore.type[neighbor.index] = PlantSystem.TYPE.SOIL;
    });
    
    mockCore.getNeighborIndices(20, groundLevel + 5).forEach(neighbor => {
      mockCore.type[neighbor.index] = PlantSystem.TYPE.SOIL;
    });
    
    // Create a Set of activePixels
    const activePixels = new Set(rootIndices);
    
    // Initialize connectivity arrays
    PlantSystem.plantConnectivity.connectedToGround = new Uint8Array(mockCore.size);
    PlantSystem.plantConnectivity.checkedThisFrame = new Uint8Array(mockCore.size);
    PlantSystem.plantConnectivity.rootIndices = [];
    
    // Call the function
    PlantSystem.findGroundConnectedRoots(activePixels);
    
    // Verify that the correct roots are marked as connected
    expect(PlantSystem.plantConnectivity.connectedToGround[rootIndices[0]]).toBe(1);
    expect(PlantSystem.plantConnectivity.connectedToGround[rootIndices[1]]).toBe(1);
    expect(PlantSystem.plantConnectivity.connectedToGround[rootIndices[2]]).toBe(0);
    
    // Verify that the rootIndices array contains the correct indices
    expect(PlantSystem.plantConnectivity.rootIndices).toContain(rootIndices[0]);
    expect(PlantSystem.plantConnectivity.rootIndices).toContain(rootIndices[1]);
    expect(PlantSystem.plantConnectivity.rootIndices).not.toContain(rootIndices[2]);
  });
  
  test('markConnectedPlantParts should propagate connectivity', () => {
    // Set up test scenario - create a simple plant structure
    const rootIndex = mockCore.getIndex(25, 35); // Root
    const stemIndex1 = mockCore.getIndex(25, 34); // Stem above root
    const stemIndex2 = mockCore.getIndex(25, 33); // Stem above first stem
    const leafIndex = mockCore.getIndex(26, 33); // Leaf next to second stem
    
    // Set up plant structure
    mockCore.type[rootIndex] = PlantSystem.TYPE.PLANT;
    mockCore.state[rootIndex] = PlantSystem.STATE.ROOT;
    
    mockCore.type[stemIndex1] = PlantSystem.TYPE.PLANT;
    mockCore.state[stemIndex1] = PlantSystem.STATE.STEM;
    
    mockCore.type[stemIndex2] = PlantSystem.TYPE.PLANT;
    mockCore.state[stemIndex2] = PlantSystem.STATE.STEM;
    
    mockCore.type[leafIndex] = PlantSystem.TYPE.PLANT;
    mockCore.state[leafIndex] = PlantSystem.STATE.LEAF;
    
    // Initialize connectivity arrays
    PlantSystem.plantConnectivity.connectedToGround = new Uint8Array(mockCore.size);
    PlantSystem.plantConnectivity.checkedThisFrame = new Uint8Array(mockCore.size);
    PlantSystem.plantConnectivity.rootIndices = [];
    
    // Mark root as connected to ground
    PlantSystem.plantConnectivity.connectedToGround[rootIndex] = 1;
    PlantSystem.plantConnectivity.rootIndices = [rootIndex];
    
    // Call the function
    PlantSystem.markConnectedPlantParts();
    
    // Verify that connectivity was propagated through the plant
    expect(PlantSystem.plantConnectivity.connectedToGround[rootIndex]).toBe(1);
    expect(PlantSystem.plantConnectivity.connectedToGround[stemIndex1]).toBe(1);
    expect(PlantSystem.plantConnectivity.connectedToGround[stemIndex2]).toBe(1);
    expect(PlantSystem.plantConnectivity.connectedToGround[leafIndex]).toBe(1);
  });
  
  test('updateSinglePlant should handle energy changes correctly across different scenarios', () => {
    // Clear processed flag
    mockBiology.processedThisFrame.fill(0);
    
    // Set up a plant pixel
    const x = 25;
    const y = 25;
    const plantIndex = mockCore.getIndex(x, y);
    mockCore.type[plantIndex] = PlantSystem.TYPE.PLANT;
    mockCore.state[plantIndex] = PlantSystem.STATE.STEM;
    mockCore.energy[plantIndex] = 100;
    mockCore.water[plantIndex] = 50; // Ensure adequate water
    
    // Mock the plant metrics to avoid small plant energy boost
    PlantSystem.plantMetrics = { stemHeight: 15, totalSize: 30 };
    
    // Mock biology metabolism value
    PlantSystem.biology.metabolism = 1.0;
    
    // Save the original energy
    const originalEnergy = mockCore.energy[plantIndex];
    
    // Call updateSinglePlant with all required parameters
    PlantSystem.updateSinglePlant(x, y, plantIndex, new Set());
    
    // Verify energy changes with a more general check
    expect(mockCore.energy[plantIndex]).not.toBe(originalEnergy);
    
    // Test energy cap (by setting energy near maximum)
    mockCore.energy[plantIndex] = 250;
    const highEnergy = mockCore.energy[plantIndex];
    
    // Call updateSinglePlant again
    PlantSystem.updateSinglePlant(x, y, plantIndex, new Set());
    
    // Verify energy is capped at 255
    expect(mockCore.energy[plantIndex]).toBeLessThanOrEqual(255);
    
    // Verify processed flag
    expect(mockBiology.processedThisFrame[plantIndex]).toBe(1);
  });
  
  test('updateSinglePlant should handle edge cases correctly', () => {
    // Test near-zero energy with recovery
    const x = 25;
    const y = 25;
    const minEnergyIndex = mockCore.getIndex(x, y);
    mockCore.type[minEnergyIndex] = PlantSystem.TYPE.PLANT;
    mockCore.state[minEnergyIndex] = PlantSystem.STATE.STEM;
    mockCore.energy[minEnergyIndex] = 1;
    mockCore.water[minEnergyIndex] = 50; // Ensure adequate water
    
    // Set random value to ensure energy recovery (75% chance to recover)
    Math.random = jest.fn().mockReturnValue(0.5);
    
    // Call updateSinglePlant with all required parameters
    PlantSystem.updateSinglePlant(x, y, minEnergyIndex, new Set());
    
    // Verify plant recovers with some energy instead of dying
    expect(mockCore.energy[minEnergyIndex]).toBeGreaterThan(0);
    expect(mockCore.type[minEnergyIndex]).toBe(PlantSystem.TYPE.PLANT);
    
    // Test plant that will actually die (in the 25% chance)
    const dieX = 26;
    const dieY = 26;
    const dieEnergyIndex = mockCore.getIndex(dieX, dieY);
    mockCore.type[dieEnergyIndex] = PlantSystem.TYPE.PLANT;
    mockCore.state[dieEnergyIndex] = PlantSystem.STATE.STEM;
    mockCore.energy[dieEnergyIndex] = 1;
    
    // Set random value to ensure plant dies (> 0.75 for the 25% death chance)
    Math.random = jest.fn().mockReturnValue(0.8);
    
    // Call updateSinglePlant with all required parameters
    PlantSystem.updateSinglePlant(dieX, dieY, dieEnergyIndex, new Set());
    
    // Verify plant dies
    expect(mockCore.type[dieEnergyIndex]).toBe(PlantSystem.TYPE.DEAD_MATTER);
    
    // Test maximum energy
    const maxX = 25;
    const maxY = 26;
    const maxEnergyIndex = mockCore.getIndex(maxX, maxY);
    mockCore.type[maxEnergyIndex] = PlantSystem.TYPE.PLANT;
    mockCore.state[maxEnergyIndex] = PlantSystem.STATE.STEM;
    mockCore.energy[maxEnergyIndex] = 254; // Near maximum
    
    // Set random value to ensure energy increase
    Math.random = jest.fn().mockReturnValue(0.09);
    
    // Call updateSinglePlant with all required parameters
    PlantSystem.updateSinglePlant(maxX, maxY, maxEnergyIndex, new Set());
    
    // Verify energy is capped
    expect(mockCore.energy[maxEnergyIndex]).toBeLessThanOrEqual(255);
  });
  
  test('detachPlantPart should convert plant to dead matter', () => {
    // Set up test case - a plant leaf
    const index = mockCore.getIndex(15, 15);
    mockCore.type[index] = PlantSystem.TYPE.PLANT;
    mockCore.state[index] = PlantSystem.STATE.LEAF;
    mockCore.energy[index] = 50;
    
    // Add to plant ages tracking
    PlantSystem.plantAges[index] = 100;
    
    // Create a Set to track next active pixels
    const nextActivePixels = new Set();
    
    // Call the function
    PlantSystem.detachPlantPart(15, 15, index, nextActivePixels);
    
    // Verify that the plant part was converted to dead matter
    expect(mockCore.type[index]).toBe(PlantSystem.TYPE.DEAD_MATTER);
    expect(mockCore.state[index]).toBe(PlantSystem.STATE.DEFAULT);
    
    // Verify that the plant part was given appropriate nutrient value
    expect(mockCore.nutrient[index]).toBe(20); // Leaves have 20 nutrient value
    
    // Verify that the pixel was marked as active for next frame
    expect(nextActivePixels.has(index)).toBe(true);
    
    // Verify that plant age tracking was cleaned up
    expect(PlantSystem.plantAges[index]).toBeUndefined();
  });
});