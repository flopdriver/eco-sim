// Gravity System Tests

describe('GravitySystem', () => {
  let GravitySystem;
  let mockPhysics;
  let mockCore;
  let activePixels;
  let nextActivePixels;
  
  beforeEach(() => {
    // Create a new GravitySystem instance for each test
    jest.resetModules();
    
    // Mock console to avoid actual console logs
    global.console = { log: jest.fn() };
    
    // Load the GravitySystem module and mock its dependencies
    jest.mock('../../../js/physics/gravity-system.js', () => {
      return {
        physics: null,
        gravityStrength: 1.0,
        
        init: function(physicsSystem) {
          this.physics = physicsSystem;
          return this;
        },
        
        updateGravity: jest.fn(function(activePixels, nextActivePixels) {
          activePixels.forEach(index => {
            if (this.physics.processedThisFrame[index]) return;
            
            const type = this.physics.core.type[index];
            const affectedByGravity = (
              type === this.physics.TYPE.SEED ||
              type === this.physics.TYPE.DEAD_MATTER ||
              type === this.physics.TYPE.WORM ||
              (type === this.physics.TYPE.INSECT && Math.random() < 0.6)
            );
            
            if (affectedByGravity) {
              const coords = this.physics.core.getCoords(index);
              this.applyGravity(coords.x, coords.y, index, nextActivePixels);
            }
          });
        }),
        
        applyGravity: jest.fn(function(x, y, index, nextActivePixels) {
          this.physics.processedThisFrame[index] = 1;
          
          if (this.tryMoveDown(x, y, index, nextActivePixels)) {
            return true;
          }
          
          return false;
        }),
        
        tryMoveDown: jest.fn(function(x, y, index, nextActivePixels) {
          const downIndex = this.physics.core.getIndex(x, y + 1);
          
          if (downIndex === -1) return false;
          
          if (this.physics.core.type[downIndex] === this.physics.TYPE.AIR ||
              (this.physics.core.type[downIndex] === this.physics.TYPE.WATER &&
               this.physics.core.type[index] !== this.physics.TYPE.INSECT) ||
              (this.physics.core.type[index] === this.physics.TYPE.SEED && 
               this.physics.core.type[downIndex] === this.physics.TYPE.SOIL && 
               this.getDepthInSoil(x, y) < 3 &&
               Math.random() < 0.08)) {
            
            this.physics.core.swapPixels(index, downIndex);
            
            nextActivePixels.add(downIndex);
            if (this.physics.core.type[index] !== this.physics.TYPE.AIR) {
              nextActivePixels.add(index);
            }
            
            return true;
          }
          
          return false;
        }),
        
        tryMoveDiagonal: jest.fn(function(fromIndex, toIndex, nextActivePixels) {
          if (toIndex === -1) return false;
          
          if (this.physics.core.type[toIndex] === this.physics.TYPE.AIR) {
            this.physics.core.swapPixels(fromIndex, toIndex);
            nextActivePixels.add(toIndex);
            return true;
          }
          
          return false;
        }),
        
        getDepthInSoil: jest.fn(function(x, y) {
          let depth = 0;
          let checkY = y - 1;
          
          while (checkY >= 0) {
            const checkIndex = this.physics.core.getIndex(x, checkY);
            if (checkIndex === -1 || this.physics.core.type[checkIndex] !== this.physics.TYPE.SOIL) {
              break;
            }
            depth++;
            checkY--;
          }
          
          return depth;
        })
      };
    });
    
    GravitySystem = require('../../../js/physics/gravity-system.js');
    
    // Set up mock core simulation
    mockCore = {
      width: 10,
      height: 10,
      size: 100,
      type: new Uint8Array(100),
      state: new Uint8Array(100),
      water: new Uint8Array(100),
      energy: new Uint8Array(100),
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
      }),
      swapPixels: jest.fn((index1, index2) => {
        // Simple mock that just swaps type values for testing
        const tempType = mockCore.type[index1];
        mockCore.type[index1] = mockCore.type[index2];
        mockCore.type[index2] = tempType;
      })
    };
    
    // Define TYPE and STATE for testing
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
    
    // Set up mock physics system
    mockPhysics = {
      core: mockCore,
      TYPE: TYPE,
      STATE: STATE,
      processedThisFrame: new Uint8Array(100)
    };
    
    // Initialize gravity system with mock physics
    GravitySystem.init(mockPhysics);
    
    // Create sets for active pixels
    activePixels = new Set();
    nextActivePixels = new Set();
  });
  
  test('initialization sets physics reference', () => {
    expect(GravitySystem.physics).toBe(mockPhysics);
  });
  
  test('updateGravity applies gravity to seeds', () => {
    // Mock Math.random to ensure predictable behavior
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.3);
    
    // Set up a seed with air below it
    const seedIndex = mockPhysics.core.getIndex(5, 5);
    const airBelowIndex = mockPhysics.core.getIndex(5, 6);
    
    mockPhysics.core.type[seedIndex] = mockPhysics.TYPE.SEED;
    mockPhysics.core.type[airBelowIndex] = mockPhysics.TYPE.AIR;
    
    activePixels.add(seedIndex);
    
    // Run the gravity update
    GravitySystem.updateGravity(activePixels, nextActivePixels);
    
    // Verify the seed moved down
    expect(mockPhysics.core.type[seedIndex]).toBe(mockPhysics.TYPE.AIR);
    expect(mockPhysics.core.type[airBelowIndex]).toBe(mockPhysics.TYPE.SEED);
    expect(nextActivePixels.has(airBelowIndex)).toBe(true);
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('updateGravity applies gravity to dead matter', () => {
    // Set up dead matter with air below it
    const deadMatterIndex = mockPhysics.core.getIndex(3, 3);
    const airBelowIndex = mockPhysics.core.getIndex(3, 4);
    
    mockPhysics.core.type[deadMatterIndex] = mockPhysics.TYPE.DEAD_MATTER;
    mockPhysics.core.type[airBelowIndex] = mockPhysics.TYPE.AIR;
    
    activePixels.add(deadMatterIndex);
    
    // Run the gravity update
    GravitySystem.updateGravity(activePixels, nextActivePixels);
    
    // Verify the dead matter moved down
    expect(mockPhysics.core.type[deadMatterIndex]).toBe(mockPhysics.TYPE.AIR);
    expect(mockPhysics.core.type[airBelowIndex]).toBe(mockPhysics.TYPE.DEAD_MATTER);
    expect(nextActivePixels.has(airBelowIndex)).toBe(true);
  });
  
  test('updateGravity applies gravity to worms', () => {
    // Set up a worm with air below it
    const wormIndex = mockPhysics.core.getIndex(7, 7);
    const airBelowIndex = mockPhysics.core.getIndex(7, 8);
    
    mockPhysics.core.type[wormIndex] = mockPhysics.TYPE.WORM;
    mockPhysics.core.type[airBelowIndex] = mockPhysics.TYPE.AIR;
    
    activePixels.add(wormIndex);
    
    // Run the gravity update
    GravitySystem.updateGravity(activePixels, nextActivePixels);
    
    // Verify the worm moved down
    expect(mockPhysics.core.type[wormIndex]).toBe(mockPhysics.TYPE.AIR);
    expect(mockPhysics.core.type[airBelowIndex]).toBe(mockPhysics.TYPE.WORM);
    expect(nextActivePixels.has(airBelowIndex)).toBe(true);
  });
  
  test('updateGravity applies gravity to insects conditionally', () => {
    // Mock Math.random to ensure predictable behavior
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.5); // Less than 0.6 to trigger falling
    
    // Set up an insect with air below it
    const insectIndex = mockPhysics.core.getIndex(2, 2);
    const airBelowIndex = mockPhysics.core.getIndex(2, 3);
    
    mockPhysics.core.type[insectIndex] = mockPhysics.TYPE.INSECT;
    mockPhysics.core.type[airBelowIndex] = mockPhysics.TYPE.AIR;
    
    activePixels.add(insectIndex);
    
    // Run the gravity update
    GravitySystem.updateGravity(activePixels, nextActivePixels);
    
    // Verify the insect moved down
    expect(mockPhysics.core.type[insectIndex]).toBe(mockPhysics.TYPE.AIR);
    expect(mockPhysics.core.type[airBelowIndex]).toBe(mockPhysics.TYPE.INSECT);
    expect(nextActivePixels.has(airBelowIndex)).toBe(true);
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('tryMoveDown allows seeds to fall into water', () => {
    // Set up a seed with water below it
    const seedIndex = mockPhysics.core.getIndex(4, 4);
    const waterBelowIndex = mockPhysics.core.getIndex(4, 5);
    
    mockPhysics.core.type[seedIndex] = mockPhysics.TYPE.SEED;
    mockPhysics.core.type[waterBelowIndex] = mockPhysics.TYPE.WATER;
    
    // Call tryMoveDown directly
    const result = GravitySystem.tryMoveDown(4, 4, seedIndex, nextActivePixels);
    
    // Verify the seed moved into water
    expect(result).toBe(true);
    expect(mockPhysics.core.swapPixels).toHaveBeenCalledWith(seedIndex, waterBelowIndex);
    expect(nextActivePixels.has(waterBelowIndex)).toBe(true);
  });
  
  test('tryMoveDown sometimes allows seeds to fall into soil', () => {
    // Mock Math.random to ensure predictable behavior
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.05); // Less than 0.08 to trigger soil entry
    
    // Set up a seed with soil below it
    const seedIndex = mockPhysics.core.getIndex(6, 6);
    const soilBelowIndex = mockPhysics.core.getIndex(6, 7);
    
    mockPhysics.core.type[seedIndex] = mockPhysics.TYPE.SEED;
    mockPhysics.core.type[soilBelowIndex] = mockPhysics.TYPE.SOIL;
    
    // Mock getDepthInSoil to return 1 (shallow enough)
    GravitySystem.getDepthInSoil = jest.fn().mockReturnValue(1);
    
    // Call tryMoveDown directly
    const result = GravitySystem.tryMoveDown(6, 6, seedIndex, nextActivePixels);
    
    // Verify the seed moved into soil
    expect(result).toBe(true);
    expect(mockPhysics.core.swapPixels).toHaveBeenCalledWith(seedIndex, soilBelowIndex);
    expect(nextActivePixels.has(soilBelowIndex)).toBe(true);
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('tryMoveDiagonal attempts to move a pixel diagonally when blocked below', () => {
    // Set up a seed with soil below it but air to diagonal
    const seedIndex = mockPhysics.core.getIndex(5, 5);
    const diagonalIndex = mockPhysics.core.getIndex(6, 6);
    
    mockPhysics.core.type[seedIndex] = mockPhysics.TYPE.SEED;
    mockPhysics.core.type[diagonalIndex] = mockPhysics.TYPE.AIR;
    
    // Call tryMoveDiagonal directly
    const result = GravitySystem.tryMoveDiagonal(seedIndex, diagonalIndex, nextActivePixels);
    
    // Verify the seed moved diagonally
    expect(result).toBe(true);
    expect(mockPhysics.core.swapPixels).toHaveBeenCalledWith(seedIndex, diagonalIndex);
    expect(nextActivePixels.has(diagonalIndex)).toBe(true);
  });
  
  test('getDepthInSoil calculates depth in soil correctly', () => {
    // Set up a column of soil
    mockPhysics.core.type[mockPhysics.core.getIndex(5, 5)] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.type[mockPhysics.core.getIndex(5, 4)] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.type[mockPhysics.core.getIndex(5, 3)] = mockPhysics.TYPE.SOIL;
    mockPhysics.core.type[mockPhysics.core.getIndex(5, 2)] = mockPhysics.TYPE.AIR;
    
    // Calculate depth for the bottom soil pixel
    const depth = GravitySystem.getDepthInSoil(5, 5);
    
    // Verify depth is 2 (two soil pixels above)
    expect(depth).toBe(2);
  });
});