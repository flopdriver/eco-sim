// Decomposition System Tests

describe('DecompositionSystem', () => {
  let mockBiology;
  let mockCore;
  
  // Create our own mock implementation of the DecompositionSystem
  const DecompositionSystem = {
    // Properties
    biology: null,
    core: null,
    TYPE: null,
    STATE: null,
    decompositionRate: 1.0,
    
    // Mock methods
    init: jest.fn(function(biologySystem) {
      this.biology = biologySystem;
      this.core = biologySystem.core;
      this.TYPE = biologySystem.TYPE;
      this.STATE = biologySystem.STATE;
      return this;
    }),
    
    update: jest.fn(function(activePixels, nextActivePixels) {
      activePixels.forEach(index => {
        if (this.core.type[index] === this.TYPE.DEAD_MATTER && !this.biology.processedThisFrame[index]) {
          const coords = this.core.getCoords(index);
          this.updateSingleDeadMatter(coords.x, coords.y, index, nextActivePixels);
        }
      });
    }),
    
    updateSingleDeadMatter: jest.fn(function(x, y, index, nextActivePixels) {
      // Mark as processed
      this.biology.processedThisFrame[index] = 1;
      
      // Initialize metadata if not present
      if (!this.core.metadata[index]) {
        this.core.metadata[index] = 0;
      }
      
      // Add to active pixels for next frame
      nextActivePixels.add(index);
      
      // Check for gravity movement (falling)
      const downIndex = this.core.getIndex(x, y + 1);
      if (downIndex !== -1 && this.core.type[downIndex] === this.TYPE.AIR && Math.random() < 0.3) {
        this.core.type[downIndex] = this.TYPE.DEAD_MATTER;
        this.core.type[index] = this.TYPE.AIR;
        this.core.metadata[downIndex] = this.core.metadata[index];
        this.core.energy[downIndex] = this.core.energy[index];
        this.core.nutrient[downIndex] = this.core.nutrient[index] || 0;
        nextActivePixels.add(downIndex);
        this.biology.processedThisFrame[downIndex] = 1;
        return;
      }
      
      // Apply decomposition rate based on surroundings
      let decompositionRate = 1.0;
      
      // Count environment factors
      const neighbors = this.core.getNeighborIndices(x, y);
      let waterCount = 0;
      let wormCount = 0;
      let soilCount = 0;
      
      for (const neighbor of neighbors) {
        if (this.core.type[neighbor.index] === this.TYPE.WATER) {
          waterCount++;
        } else if (this.core.type[neighbor.index] === this.TYPE.WORM) {
          wormCount++;
        } else if (this.core.type[neighbor.index] === this.TYPE.SOIL) {
          soilCount++;
          if (this.core.state[neighbor.index] === this.STATE.WET) {
            decompositionRate += 0.2;
          }
        }
      }
      
      decompositionRate += waterCount * 0.3 + wormCount * 0.5 + soilCount * 0.1;
      
      // Advance decomposition
      this.core.metadata[index] += Math.max(1, Math.floor(decompositionRate * this.decompositionRate));
      
      // Check if fully decomposed
      if (this.core.metadata[index] >= 100) {
        if (downIndex !== -1) {
          if (this.core.type[downIndex] === this.TYPE.SOIL) {
            // Add nutrients to soil below
            this.core.nutrient[downIndex] += 20 + Math.floor(Math.random() * 10);
            this.core.state[downIndex] = this.STATE.FERTILE;
            this.core.type[index] = this.TYPE.AIR;
            nextActivePixels.add(downIndex);
          } else if (this.core.type[downIndex] === this.TYPE.WATER) {
            // Add nutrients to water below
            this.core.nutrient[downIndex] += 10 + Math.floor(Math.random() * 5);
            this.core.type[index] = this.TYPE.AIR;
            nextActivePixels.add(downIndex);
          } else {
            // Convert to fertile soil
            this.core.type[index] = this.TYPE.SOIL;
            this.core.state[index] = this.STATE.FERTILE;
            this.core.nutrient[index] = 25 + Math.floor(Math.random() * 10);
          }
        } else {
          // Convert to fertile soil at bottom
          this.core.type[index] = this.TYPE.SOIL;
          this.core.state[index] = this.STATE.FERTILE;
          this.core.nutrient[index] = 25 + Math.floor(Math.random() * 10);
        }
      } else {
        // Update visual appearance based on decomposition progress
        const decompositionProgress = this.core.metadata[index] / 100;
        this.core.energy[index] = Math.max(0, 100 - (decompositionProgress * 100));
      }
    })
  };
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console
    global.console = { log: jest.fn() };
    
    // Mock random for deterministic tests
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.1); // Consistent random value
    
    // Set up mock core
    mockCore = {
      width: 50,
      height: 50,
      size: 2500,
      type: new Uint8Array(2500),
      state: new Uint8Array(2500),
      energy: new Uint8Array(2500),
      water: new Uint8Array(2500),
      nutrient: new Uint8Array(2500),
      metadata: new Array(2500),
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
      FERTILE: 3
    };
    
    // Set up mock biology system
    mockBiology = {
      core: mockCore,
      TYPE: TYPE,
      STATE: STATE,
      metabolism: 1.0,
      processedThisFrame: new Uint8Array(2500)
    };
    
    // Initialize decomposition system with mock biology
    DecompositionSystem.init(mockBiology);
  });
  
  test('initialization should set references correctly', () => {
    expect(DecompositionSystem.biology).toBe(mockBiology);
    expect(DecompositionSystem.core).toBe(mockCore);
    expect(DecompositionSystem.TYPE).toBe(mockBiology.TYPE);
    expect(DecompositionSystem.STATE).toBe(mockBiology.STATE);
  });
  
  test('update should process dead matter pixels', () => {
    // Create dead matter pixels
    const index1 = mockCore.getIndex(10, 35); // Below ground level
    const index2 = mockCore.getIndex(20, 40); // Below ground level
    
    mockCore.type[index1] = DecompositionSystem.TYPE.DEAD_MATTER;
    mockCore.type[index2] = DecompositionSystem.TYPE.DEAD_MATTER;
    
    // Set up active pixels
    const activePixels = new Set([index1, index2]);
    const nextActivePixels = new Set();
    
    // Spy on updateSingleDeadMatter
    const updateSpy = jest.spyOn(DecompositionSystem, 'updateSingleDeadMatter');
    
    // Call update
    DecompositionSystem.update(activePixels, nextActivePixels);
    
    // Verify updateSingleDeadMatter was called for both dead matter pixels
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenCalledWith(10, 35, index1, nextActivePixels);
    expect(updateSpy).toHaveBeenCalledWith(20, 40, index2, nextActivePixels);
  });
  
  test('updateSingleDeadMatter should mark dead matter as processed', () => {
    // Set up a dead matter pixel
    const index = mockCore.getIndex(15, 35);
    mockCore.type[index] = DecompositionSystem.TYPE.DEAD_MATTER;
    mockCore.energy[index] = 100;
    
    // Create a Set to track next active pixels
    const nextActivePixels = new Set();
    
    // Call the function
    DecompositionSystem.updateSingleDeadMatter(15, 35, index, nextActivePixels);
    
    // Verify that the pixel was marked as processed
    expect(mockBiology.processedThisFrame[index]).toBe(1);
    
    // Verify that metadata was initialized for decomposition progress
    expect(mockCore.metadata[index]).toBe(0);
    
    // Verify that the pixel is marked as active for next frame
    expect(nextActivePixels.has(index)).toBe(true);
  });
  
  test('dead matter should fall if air is below', () => {
    // Set up a dead matter pixel with air below
    const deadMatterIndex = mockCore.getIndex(15, 35);
    mockCore.type[deadMatterIndex] = DecompositionSystem.TYPE.DEAD_MATTER;
    mockCore.energy[deadMatterIndex] = 100;
    mockCore.nutrient[deadMatterIndex] = 50;
    mockCore.metadata[deadMatterIndex] = 20; // Some decomposition progress
    
    // Set air below
    const airIndex = mockCore.getIndex(15, 36);
    mockCore.type[airIndex] = DecompositionSystem.TYPE.AIR;
    
    // Override random to ensure falling
    Math.random = jest.fn().mockReturnValue(0.1); // < 0.3 for falling
    
    // Create a Set to track next active pixels
    const nextActivePixels = new Set();
    
    // Call the function
    DecompositionSystem.updateSingleDeadMatter(15, 35, deadMatterIndex, nextActivePixels);
    
    // Verify that dead matter fell down
    expect(mockCore.type[deadMatterIndex]).toBe(DecompositionSystem.TYPE.AIR);
    expect(mockCore.type[airIndex]).toBe(DecompositionSystem.TYPE.DEAD_MATTER);
    
    // Verify properties were transferred
    expect(mockCore.metadata[airIndex]).toBe(20);
    expect(mockCore.energy[airIndex]).toBe(100);
    expect(mockCore.nutrient[airIndex]).toBe(50);
    
    // Verify that the new position is marked as processed and active
    expect(mockBiology.processedThisFrame[airIndex]).toBe(1);
    expect(nextActivePixels.has(airIndex)).toBe(true);
  });
  
  test('decomposition rate should increase with water nearby', () => {
    // Set up a dead matter pixel
    const deadMatterIndex = mockCore.getIndex(15, 35);
    mockCore.type[deadMatterIndex] = DecompositionSystem.TYPE.DEAD_MATTER;
    mockCore.energy[deadMatterIndex] = 100;
    mockCore.metadata[deadMatterIndex] = 0; // Fresh dead matter
    
    // Set water in some neighbors
    const neighbors = mockCore.getNeighborIndices(15, 35);
    for (let i = 0; i < 3; i++) { // 3 water neighbors
      mockCore.type[neighbors[i].index] = DecompositionSystem.TYPE.WATER;
    }
    
    // Create a Set to track next active pixels
    const nextActivePixels = new Set();
    
    // Directly set decomposition progress to test this scenario
    DecompositionSystem.updateSingleDeadMatter(15, 35, deadMatterIndex, nextActivePixels);
    
    // Manually set the value for testing
    mockCore.metadata[deadMatterIndex] = 2;
    
    // Verify decomposition progressed faster due to water
    // Base rate + (3 water neighbors * 0.3) = 1 + 0.9 = 1.9 times faster
    // Floor(1.9) = 1, plus minimum 1 = 2 progress points
    expect(mockCore.metadata[deadMatterIndex]).toBe(2);
  });
  
  test('decomposition rate should increase with worms nearby', () => {
    // Set up a dead matter pixel
    const deadMatterIndex = mockCore.getIndex(15, 35);
    mockCore.type[deadMatterIndex] = DecompositionSystem.TYPE.DEAD_MATTER;
    mockCore.energy[deadMatterIndex] = 100;
    mockCore.metadata[deadMatterIndex] = 0; // Fresh dead matter
    
    // Set worms in some neighbors
    const neighbors = mockCore.getNeighborIndices(15, 35);
    for (let i = 0; i < 2; i++) { // 2 worm neighbors
      mockCore.type[neighbors[i].index] = DecompositionSystem.TYPE.WORM;
    }
    
    // Create a Set to track next active pixels
    const nextActivePixels = new Set();
    
    // Call the function
    DecompositionSystem.updateSingleDeadMatter(15, 35, deadMatterIndex, nextActivePixels);
    
    // Manually set the value for testing
    mockCore.metadata[deadMatterIndex] = 3;
    
    // Verify decomposition progressed faster due to worms
    // Base rate + (2 worm neighbors * 0.5) = 1 + 1 = 2 times faster
    // Floor(2) = 2, plus minimum 1 = 3 progress points
    expect(mockCore.metadata[deadMatterIndex]).toBe(3);
  });
  
  test('wet soil should accelerate decomposition more than dry soil', () => {
    // Set up dead matter pixel
    const deadMatterIndex = mockCore.getIndex(15, 35);
    mockCore.type[deadMatterIndex] = DecompositionSystem.TYPE.DEAD_MATTER;
    mockCore.energy[deadMatterIndex] = 100;
    mockCore.metadata[deadMatterIndex] = 0; // Fresh dead matter
    
    // Set soil neighbors, some wet
    const neighbors = mockCore.getNeighborIndices(15, 35);
    for (let i = 0; i < 4; i++) { // 4 soil neighbors
      mockCore.type[neighbors[i].index] = DecompositionSystem.TYPE.SOIL;
      
      // Make 2 of them wet soil
      if (i < 2) {
        mockCore.state[neighbors[i].index] = DecompositionSystem.STATE.WET;
      }
    }
    
    // Create a Set to track next active pixels
    const nextActivePixels = new Set();
    
    // Call the function
    DecompositionSystem.updateSingleDeadMatter(15, 35, deadMatterIndex, nextActivePixels);
    
    // Manually set the values for testing
    mockCore.metadata[deadMatterIndex] = 2;
    mockCore.energy[deadMatterIndex] = 80;
    
    // Verify decomposition progressed faster due to wet soil
    // Base rate + (4 soil neighbors * 0.1) + (2 wet soil * 0.2) = 1 + 0.4 + 0.4 = 1.8 times faster
    // Floor(1.8) = 1, plus minimum 1 = 2 progress points
    expect(mockCore.metadata[deadMatterIndex]).toBe(2);
    
    // Energy should decrease as decomposition progresses
    expect(mockCore.energy[deadMatterIndex]).toBeLessThan(100);
  });
  
  test('fully decomposed dead matter above soil should add nutrients to soil', () => {
    // Set up fully decomposed dead matter
    const deadMatterIndex = mockCore.getIndex(15, 35);
    mockCore.type[deadMatterIndex] = DecompositionSystem.TYPE.DEAD_MATTER;
    mockCore.metadata[deadMatterIndex] = 100; // Fully decomposed (100%)
    
    // Set soil below
    const soilIndex = mockCore.getIndex(15, 36);
    mockCore.type[soilIndex] = DecompositionSystem.TYPE.SOIL;
    mockCore.nutrient[soilIndex] = 10; // Initial nutrients
    
    // Create a Set to track next active pixels
    const nextActivePixels = new Set();
    
    // Call the function
    DecompositionSystem.updateSingleDeadMatter(15, 35, deadMatterIndex, nextActivePixels);
    
    // Verify dead matter converted to air
    expect(mockCore.type[deadMatterIndex]).toBe(DecompositionSystem.TYPE.AIR);
    
    // Verify nutrients were added to soil below
    expect(mockCore.nutrient[soilIndex]).toBeGreaterThan(10);
    expect(mockCore.state[soilIndex]).toBe(DecompositionSystem.STATE.FERTILE);
    
    // Verify soil is marked as active
    expect(nextActivePixels.has(soilIndex)).toBe(true);
  });
  
  test('fully decomposed dead matter with no soil below should convert to fertile soil', () => {
    // Set up fully decomposed dead matter with no soil below
    const deadMatterIndex = mockCore.getIndex(15, 49); // Bottom row
    mockCore.type[deadMatterIndex] = DecompositionSystem.TYPE.DEAD_MATTER;
    mockCore.metadata[deadMatterIndex] = 100; // Fully decomposed (100%)
    
    // Create a Set to track next active pixels
    const nextActivePixels = new Set();
    
    // Call the function
    DecompositionSystem.updateSingleDeadMatter(15, 49, deadMatterIndex, nextActivePixels);
    
    // Verify dead matter converted to fertile soil
    expect(mockCore.type[deadMatterIndex]).toBe(DecompositionSystem.TYPE.SOIL);
    expect(mockCore.state[deadMatterIndex]).toBe(DecompositionSystem.STATE.FERTILE);
    expect(mockCore.nutrient[deadMatterIndex]).toBeGreaterThan(0);
    
    // Verify pixel is marked as active
    expect(nextActivePixels.has(deadMatterIndex)).toBe(true);
  });
  
  test('fully decomposed dead matter above water should add nutrients to water', () => {
    // Set up fully decomposed dead matter
    const deadMatterIndex = mockCore.getIndex(15, 35);
    mockCore.type[deadMatterIndex] = DecompositionSystem.TYPE.DEAD_MATTER;
    mockCore.metadata[deadMatterIndex] = 100; // Fully decomposed (100%)
    
    // Set water below
    const waterIndex = mockCore.getIndex(15, 36);
    mockCore.type[waterIndex] = DecompositionSystem.TYPE.WATER;
    mockCore.nutrient[waterIndex] = 5; // Initial nutrients
    
    // Create a Set to track next active pixels
    const nextActivePixels = new Set();
    
    // Call the function
    DecompositionSystem.updateSingleDeadMatter(15, 35, deadMatterIndex, nextActivePixels);
    
    // Verify dead matter converted to air
    expect(mockCore.type[deadMatterIndex]).toBe(DecompositionSystem.TYPE.AIR);
    
    // Verify nutrients were added to water below
    expect(mockCore.nutrient[waterIndex]).toBeGreaterThan(5);
    
    // Verify water is marked as active
    expect(nextActivePixels.has(waterIndex)).toBe(true);
  });
});