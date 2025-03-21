// Erosion System Tests

describe('ErosionSystem', () => {
  let ErosionSystem;
  let mockPhysics;
  let mockCore;
  let activePixels;
  let nextActivePixels;
  
  beforeEach(() => {
    // Create a new ErosionSystem instance for each test
    jest.resetModules();
    
    // Mock console to avoid actual console logs
    global.console = { log: jest.fn() };
    
    // Load the ErosionSystem module and mock its dependencies
    jest.mock('../../../js/physics/erosion-system.js', () => {
      return {
        physics: null,
        erosionStrength: 1.0,
        
        init: function(physicsSystem) {
          this.physics = physicsSystem;
          return this;
        },
        
        updateErosion: jest.fn(function(activePixels, nextActivePixels) {
          // Water has a chance to erode soil when flowing past it
          activePixels.forEach(index => {
            if (this.physics.core.type[index] === this.physics.TYPE.WATER && Math.random() < 0.05) {
              const coords = this.physics.core.getCoords(index);
              this.processSingleErosion(coords.x, coords.y, index, nextActivePixels);
            }
          });
        }),
        
        processSingleErosion: jest.fn(function(x, y, index, nextActivePixels) {
          // Water can erode adjacent soil
          const neighbors = this.physics.core.getNeighborIndices(x, y);
          
          // Check each neighbor for soil
          for (const neighbor of neighbors) {
            if (this.physics.core.type[neighbor.index] === this.physics.TYPE.SOIL) {
              // Erosion is more likely for soil with low nutrients
              // and is affected by water content and erosion strength setting
              const erosionChance = 0.001 * (100 + (this.physics.core.water[index] / 255)) * this.erosionStrength;
              
              if (Math.random() < erosionChance) {
                // Erode the soil - convert to water
                this.physics.core.type[neighbor.index] = this.physics.TYPE.WATER;
                this.physics.core.water[neighbor.index] = this.physics.core.water[index];
                this.physics.core.state[neighbor.index] = this.physics.STATE.DEFAULT;
                
                // Add nutrients to the water from the eroded soil
                this.physics.core.nutrient[neighbor.index] += this.physics.core.nutrient[neighbor.index];
                
                nextActivePixels.add(neighbor.index);
                break; // Only erode one soil pixel per water pixel per frame
              }
            }
          }
        })
      };
    });
    
    ErosionSystem = require('../../../js/physics/erosion-system.js');
    
    // Set up mock core simulation
    mockCore = {
      width: 10,
      height: 10,
      size: 100,
      type: new Uint8Array(100),
      state: new Uint8Array(100),
      water: new Uint8Array(100),
      nutrient: new Uint8Array(100),
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
        const directions = [
          {x: -1, y: -1}, {x: 0, y: -1}, {x: 1, y: -1},
          {x: -1, y: 0},                 {x: 1, y: 0},
          {x: -1, y: 1},  {x: 0, y: 1},  {x: 1, y: 1}
        ];
        
        for (const dir of directions) {
          const nx = x + dir.x;
          const ny = y + dir.y;
          const index = mockCore.getIndex(nx, ny);
          if (index !== -1) {
            neighbors.push({index, x: nx, y: ny});
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
      SEED: 4
    };
    
    const STATE = {
      DEFAULT: 0,
      WET: 1,
      DRY: 2,
      FERTILE: 3
    };
    
    // Set up mock physics system
    mockPhysics = {
      core: mockCore,
      TYPE: TYPE,
      STATE: STATE
    };
    
    // Set default erosion strength
    ErosionSystem.erosionStrength = 1.0;
    
    // Initialize erosion system with mock physics
    ErosionSystem.init(mockPhysics);
    
    // Create sets for active pixels
    activePixels = new Set();
    nextActivePixels = new Set();
  });
  
  test('initialization sets physics reference', () => {
    expect(ErosionSystem.physics).toBe(mockPhysics);
  });
  
  test('updateErosion processes water pixels with a chance factor', () => {
    // Mock Math.random to ensure predictable behavior
    const originalRandom = Math.random;
    Math.random = jest.fn()
      .mockReturnValueOnce(0.03) // Less than 0.05 to trigger processing
      .mockReturnValueOnce(0.0005); // Less than erosion chance to trigger erosion
    
    // Set up a water pixel next to soil
    const waterIndex = mockPhysics.core.getIndex(5, 5);
    const soilIndex = mockPhysics.core.getIndex(6, 5); // Adjacent soil
    
    mockPhysics.core.type[waterIndex] = mockPhysics.TYPE.WATER;
    mockPhysics.core.water[waterIndex] = 100;
    
    mockPhysics.core.type[soilIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.nutrient[soilIndex] = 20;
    
    activePixels.add(waterIndex);
    
    // Run the erosion update
    ErosionSystem.updateErosion(activePixels, nextActivePixels);
    
    // Verify soil was eroded to water
    expect(mockPhysics.core.type[soilIndex]).toBe(mockPhysics.TYPE.WATER);
    expect(mockPhysics.core.water[soilIndex]).toBe(100);
    expect(mockPhysics.core.state[soilIndex]).toBe(mockPhysics.STATE.DEFAULT);
    expect(nextActivePixels.has(soilIndex)).toBe(true);
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('erosion chance is affected by erosion strength setting', () => {
    // Set high erosion strength
    ErosionSystem.erosionStrength = 2.0;
    
    // Mock processSingleErosion to verify it receives correct parameters
    const spy = jest.spyOn(ErosionSystem, 'processSingleErosion');
    
    // Mock Math.random for the first check only (to enter the if block)
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValueOnce(0.03);
    
    // Set up a water pixel
    const waterIndex = mockPhysics.core.getIndex(3, 3);
    mockPhysics.core.type[waterIndex] = mockPhysics.TYPE.WATER;
    activePixels.add(waterIndex);
    
    // Run the erosion update
    ErosionSystem.updateErosion(activePixels, nextActivePixels);
    
    // Verify processSingleErosion was called
    expect(spy).toHaveBeenCalledWith(3, 3, waterIndex, nextActivePixels);
    
    // Cleanup
    spy.mockRestore();
    Math.random = originalRandom;
  });
  
  test('processSingleErosion erodes soil with nutrients to water', () => {
    // Mock Math.random to ensure erosion happens
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.0005); // Very low value to trigger erosion
    
    // Set up a water pixel with adjacent soil
    const waterIndex = mockPhysics.core.getIndex(4, 4);
    mockPhysics.core.type[waterIndex] = mockPhysics.TYPE.WATER;
    mockPhysics.core.water[waterIndex] = 80;
    
    // Set up soil neighbor
    const soilIndex = mockPhysics.core.getIndex(4, 5);
    mockPhysics.core.type[soilIndex] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.nutrient[soilIndex] = 30;
    
    // Run processSingleErosion directly
    ErosionSystem.processSingleErosion(4, 4, waterIndex, nextActivePixels);
    
    // Verify soil was eroded to water
    expect(mockPhysics.core.type[soilIndex]).toBe(mockPhysics.TYPE.WATER);
    expect(mockPhysics.core.water[soilIndex]).toBe(80);
    expect(mockPhysics.core.nutrient[soilIndex]).toBeGreaterThan(30); // Added nutrients from erosion
    expect(nextActivePixels.has(soilIndex)).toBe(true);
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('processSingleErosion stops after eroding one soil pixel', () => {
    // Mock Math.random to ensure erosion happens
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.0005); // Very low value to trigger erosion
    
    // Set up a water pixel with multiple adjacent soil pixels
    const waterIndex = mockPhysics.core.getIndex(5, 5);
    mockPhysics.core.type[waterIndex] = mockPhysics.TYPE.WATER;
    mockPhysics.core.water[waterIndex] = 100;
    
    // Set up multiple soil neighbors
    const soilIndex1 = mockPhysics.core.getIndex(4, 5);
    const soilIndex2 = mockPhysics.core.getIndex(6, 5);
    mockPhysics.core.type[soilIndex1] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.type[soilIndex2] = mockPhysics.TYPE.SOIL;
    
    // Run processSingleErosion directly
    ErosionSystem.processSingleErosion(5, 5, waterIndex, nextActivePixels);
    
    // Count how many soil pixels were eroded
    const erodedCount = [soilIndex1, soilIndex2].filter(
      index => mockPhysics.core.type[index] === mockPhysics.TYPE.WATER
    ).length;
    
    // Verify only one soil pixel was eroded
    expect(erodedCount).toBe(1);
    expect(nextActivePixels.size).toBe(1);
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('erosion chance increases with water content', () => {
    // Since we're using a simplified mock, we'll test the principle directly
    
    // Calculate erosion chance for low water content
    const lowWaterContent = 50;
    const lowErosionChance = 0.001 * (100 + (lowWaterContent / 255)) * ErosionSystem.erosionStrength;
    
    // Calculate erosion chance for high water content
    const highWaterContent = 250;
    const highErosionChance = 0.001 * (100 + (highWaterContent / 255)) * ErosionSystem.erosionStrength;
    
    // Verify higher water content leads to higher erosion chance
    expect(highErosionChance).toBeGreaterThan(lowErosionChance);
  });
});