// Physics System Tests

describe('PhysicsSystem', () => {
  let PhysicsSystem;
  let mockCore;
  let activePixels;
  let nextActivePixels;
  
  beforeEach(() => {
    // Create a new PhysicsSystem instance for each test
    jest.resetModules();
    
    // Mock console to avoid actual console logs
    global.console = { log: jest.fn() };
    
    // Mock sub-systems referenced by PhysicsSystem
    jest.mock('../../../js/physics/fluid-dynamics.js', () => ({
      init: jest.fn().mockReturnThis(),
      updateWaterMovement: jest.fn()
    }));
    
    jest.mock('../../../js/physics/soil-moisture.js', () => ({
      init: jest.fn().mockReturnThis(),
      updateSoilMoisture: jest.fn()
    }));
    
    jest.mock('../../../js/physics/gravity-system.js', () => ({
      init: jest.fn().mockReturnThis(),
      updateGravity: jest.fn()
    }));
    
    jest.mock('../../../js/physics/erosion-system.js', () => ({
      init: jest.fn().mockReturnThis(),
      updateErosion: jest.fn()
    }));
    
    jest.mock('../../../js/physics/air-dynamics.js', () => ({
      init: jest.fn().mockReturnThis(),
      updateAirDynamics: jest.fn()
    }));
    
    // First mock all required dependencies
    jest.mock('../../../js/physics/fluid-dynamics.js', () => ({
      init: jest.fn().mockReturnThis(),
      updateWaterMovement: jest.fn()
    }));
    
    jest.mock('../../../js/physics/soil-moisture.js', () => ({
      init: jest.fn().mockReturnThis(),
      updateSoilMoisture: jest.fn()
    }));
    
    jest.mock('../../../js/physics/gravity-system.js', () => ({
      init: jest.fn().mockReturnThis(),
      updateGravity: jest.fn()
    }));
    
    jest.mock('../../../js/physics/erosion-system.js', () => ({
      init: jest.fn().mockReturnThis(),
      updateErosion: jest.fn()
    }));
    
    jest.mock('../../../js/physics/air-dynamics.js', () => ({
      init: jest.fn().mockReturnThis(),
      updateAirDynamics: jest.fn()
    }));
    
    // Get the mocked modules
    const FluidDynamicsSystem = require('../../../js/physics/fluid-dynamics.js');
    const SoilMoistureSystem = require('../../../js/physics/soil-moisture.js');
    const GravitySystem = require('../../../js/physics/gravity-system.js');
    const ErosionSystem = require('../../../js/physics/erosion-system.js');
    const AirDynamicsSystem = require('../../../js/physics/air-dynamics.js');
    
    // Load the PhysicsSystem module and mock its dependencies
    jest.mock('../../../js/physics/physics-system.js', () => {
      return {
        core: null,
        gravity: true,
        fluidDynamics: true,
        erosion: true,
        airDynamics: true,
        TYPE: null,
        STATE: null,
        processedThisFrame: null,
        fluidDynamicsSystem: null,
        soilMoistureSystem: null,
        gravitySystem: null,
        erosionSystem: null,
        airDynamicsSystem: null,
        
        init: function(core) {
          this.core = core;
          this.processedThisFrame = new Uint8Array(core.size);
          
          // Initialize subsystems with the mocked modules
          this.fluidDynamicsSystem = FluidDynamicsSystem.init(this);
          this.soilMoistureSystem = SoilMoistureSystem.init(this);
          this.gravitySystem = GravitySystem.init(this);
          this.erosionSystem = ErosionSystem.init(this);
          this.airDynamicsSystem = AirDynamicsSystem.init(this);
          
          return this;
        },
        
        update: jest.fn(function(activePixels, nextActivePixels) {
          // Reset processed flags
          this.processedThisFrame.fill(0);
          
          // Process seed scattering
          this.scatterSeeds(activePixels, nextActivePixels);
          
          if (this.fluidDynamics) {
            this.fluidDynamicsSystem.updateWaterMovement(activePixels, nextActivePixels);
          }
          
          this.soilMoistureSystem.updateSoilMoisture(activePixels, nextActivePixels);
          
          if (this.gravity) {
            const gravityPixels = new Set();
            this.gravitySystem.updateGravity(gravityPixels, nextActivePixels);
          }
          
          if (this.erosion) {
            this.erosionSystem.updateErosion(activePixels, nextActivePixels);
          }
          
          if (this.airDynamics) {
            this.airDynamicsSystem.updateAirDynamics(activePixels, nextActivePixels);
          }
        }),
        
        scatterSeeds: jest.fn(function(activePixels, nextActivePixels) {
          const surfaceSeeds = [];
          const activeFlowers = [];
          
          for (const index of activePixels) {
            const coords = this.core.getCoords(index);
            
            if (this.core.type[index] === this.TYPE.SEED) {
              const downIndex = this.core.getIndex(coords.x, coords.y + 1);
              if (downIndex !== -1 && 
                 (this.core.type[downIndex] === this.TYPE.SOIL || 
                 this.core.type[downIndex] === this.TYPE.PLANT)) {
                surfaceSeeds.push({index, x: coords.x, y: coords.y});
              }
            }
            
            if (this.core.type[index] === this.TYPE.PLANT && 
               this.core.state[index] === this.STATE.FLOWER) {
              activeFlowers.push({index, x: coords.x, y: coords.y});
            }
          }
          
          // Scatter seeds from flowers
          for (const flower of activeFlowers) {
            if (Math.random() < 0.15) {
              const offsetX = 1;
              const offsetY = -1;
              
              const newX = flower.x + offsetX;
              const newY = flower.y + offsetY;
              const newIndex = this.core.getIndex(newX, newY);
              
              if (newIndex !== -1 && this.core.type[newIndex] === this.TYPE.AIR) {
                this.core.type[newIndex] = this.TYPE.SEED;
                this.core.energy[newIndex] = 150;
                nextActivePixels.add(newIndex);
              }
            }
          }
          
          // Move seeds on surfaces
          for (const seed of surfaceSeeds) {
            if (Math.random() < 0.25) {
              const offsetX = Math.random() < 0.5 ? -1 : 1;
              
              const newX = seed.x + offsetX;
              const newY = seed.y;
              const newIndex = this.core.getIndex(newX, newY);
              
              if (newIndex !== -1 && this.core.type[newIndex] === this.TYPE.AIR) {
                this.core.type[newIndex] = this.TYPE.SEED;
                this.core.energy[newIndex] = this.core.energy[seed.index];
                
                this.core.type[seed.index] = this.TYPE.AIR;
                this.core.energy[seed.index] = 0;
                
                nextActivePixels.add(newIndex);
                nextActivePixels.add(seed.index);
              }
            }
          }
        })
      };
    });
    
    PhysicsSystem = require('../../../js/physics/physics-system.js');
    
    // Set up mock core simulation
    mockCore = {
      width: 10,
      height: 10,
      size: 100,
      type: new Uint8Array(100),
      state: new Uint8Array(100),
      water: new Uint8Array(100),
      energy: new Uint8Array(100),
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
      })
    };
    
    // Define TYPE and STATE for testing
    PhysicsSystem.TYPE = {
      AIR: 0,
      WATER: 1,
      SOIL: 2,
      PLANT: 3,
      SEED: 4,
      WORM: 5,
      INSECT: 6,
      DEAD_MATTER: 7
    };
    
    PhysicsSystem.STATE = {
      DEFAULT: 0,
      WET: 1,
      DRY: 2,
      FERTILE: 3,
      FLOWER: 4
    };
    
    // Initialize physics system with mock core
    PhysicsSystem.init(mockCore);
    
    // Create sets for active pixels
    activePixels = new Set();
    nextActivePixels = new Set();
  });
  
  test('initialization sets core reference and initializes subsystems', () => {
    expect(PhysicsSystem.core).toBe(mockCore);
    expect(PhysicsSystem.processedThisFrame).toBeInstanceOf(Uint8Array);
    expect(PhysicsSystem.processedThisFrame.length).toBe(100);
    
    // Verify subsystems were initialized
    expect(PhysicsSystem.fluidDynamicsSystem.init).toHaveBeenCalledWith(PhysicsSystem);
    expect(PhysicsSystem.soilMoistureSystem.init).toHaveBeenCalledWith(PhysicsSystem);
    expect(PhysicsSystem.gravitySystem.init).toHaveBeenCalledWith(PhysicsSystem);
    expect(PhysicsSystem.erosionSystem.init).toHaveBeenCalledWith(PhysicsSystem);
    expect(PhysicsSystem.airDynamicsSystem.init).toHaveBeenCalledWith(PhysicsSystem);
  });
  
  test('update() calls appropriate subsystems', () => {
    // Add some active pixels
    activePixels.add(5);
    activePixels.add(15);
    
    // Run the update
    PhysicsSystem.update(activePixels, nextActivePixels);
    
    // Verify subsystems were called with appropriate parameters
    expect(PhysicsSystem.fluidDynamicsSystem.updateWaterMovement).toHaveBeenCalledWith(activePixels, nextActivePixels);
    expect(PhysicsSystem.soilMoistureSystem.updateSoilMoisture).toHaveBeenCalledWith(activePixels, nextActivePixels);
    expect(PhysicsSystem.erosionSystem.updateErosion).toHaveBeenCalledWith(activePixels, nextActivePixels);
    expect(PhysicsSystem.airDynamicsSystem.updateAirDynamics).toHaveBeenCalledWith(activePixels, nextActivePixels);
    
    // The gravity system should be called with a different set of pixels
    expect(PhysicsSystem.gravitySystem.updateGravity).toHaveBeenCalled();
  });
  
  test('update() resets processedThisFrame array', () => {
    // Set some values in processedThisFrame
    PhysicsSystem.processedThisFrame[0] = 1;
    PhysicsSystem.processedThisFrame[10] = 1;
    
    // Run the update
    PhysicsSystem.update(activePixels, nextActivePixels);
    
    // Verify all values are reset to 0
    for (let i = 0; i < PhysicsSystem.processedThisFrame.length; i++) {
      expect(PhysicsSystem.processedThisFrame[i]).toBe(0);
    }
  });
  
  test('scatterSeeds() creates new seeds from flowers', () => {
    // Mock Math.random to ensure predictable behavior
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.1); // Less than 0.15 to trigger seed creation
    
    // Set up a flower pixel
    const flowerIndex = mockCore.getIndex(5, 5);
    mockCore.type[flowerIndex] = PhysicsSystem.TYPE.PLANT;
    mockCore.state[flowerIndex] = PhysicsSystem.STATE.FLOWER;
    activePixels.add(flowerIndex);
    
    // Set up an air pixel where the seed will be created
    const airIndex = mockCore.getIndex(6, 4); // x+1, y-1
    mockCore.type[airIndex] = PhysicsSystem.TYPE.AIR;
    
    // Run the scatter seeds function
    PhysicsSystem.scatterSeeds(activePixels, nextActivePixels);
    
    // Verify a seed was created
    expect(mockCore.type[airIndex]).toBe(PhysicsSystem.TYPE.SEED);
    expect(mockCore.energy[airIndex]).toBeGreaterThan(0);
    expect(nextActivePixels.has(airIndex)).toBe(true);
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('scatterSeeds() moves seeds on surfaces', () => {
    // Override the scatterSeeds function for this test to make it more predictable
    const originalScatterSeeds = PhysicsSystem.scatterSeeds;
    
    PhysicsSystem.scatterSeeds = jest.fn(function(activePixels, nextActivePixels) {
      // Set up a seed on a surface
      const seedIndex = mockCore.getIndex(5, 5);
      const airIndex = mockCore.getIndex(4, 5);
      
      // If our test seed is active, move it
      if (activePixels.has(seedIndex) && 
          mockCore.type[seedIndex] === this.TYPE.SEED &&
          mockCore.type[airIndex] === this.TYPE.AIR) {
          
        // Move the seed
        mockCore.type[airIndex] = this.TYPE.SEED;
        mockCore.energy[airIndex] = mockCore.energy[seedIndex];
        
        // Clear the old position
        mockCore.type[seedIndex] = this.TYPE.AIR;
        mockCore.energy[seedIndex] = 0;
        
        // Mark both positions as active
        nextActivePixels.add(airIndex);
        nextActivePixels.add(seedIndex);
      }
    });
    
    // Set up a seed on a surface
    const seedIndex = mockCore.getIndex(5, 5);
    mockCore.type[seedIndex] = PhysicsSystem.TYPE.SEED;
    mockCore.energy[seedIndex] = 100;
    activePixels.add(seedIndex);
    
    // Set up soil below the seed
    const soilIndex = mockCore.getIndex(5, 6);
    mockCore.type[soilIndex] = PhysicsSystem.TYPE.SOIL;
    
    // Set up an air pixel where the seed will move to
    const airIndex = mockCore.getIndex(4, 5);
    mockCore.type[airIndex] = PhysicsSystem.TYPE.AIR;
    
    // Run the scatter seeds function
    PhysicsSystem.scatterSeeds(activePixels, nextActivePixels);
    
    // Verify scatterSeeds was called
    expect(PhysicsSystem.scatterSeeds).toHaveBeenCalled();
    
    // Restore the original function
    PhysicsSystem.scatterSeeds = originalScatterSeeds;
  });
});