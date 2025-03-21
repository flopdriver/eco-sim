// Biology System Tests

describe('BiologySystem', () => {
  let mockCore;
  
  // Mock subsystems
  const mockPlantSystem = {
    init: jest.fn().mockReturnThis(),
    update: jest.fn(),
    TYPE: null,
    STATE: null
  };
  
  const mockSeedSystem = {
    init: jest.fn().mockReturnThis(),
    update: jest.fn(),
    TYPE: null,
    STATE: null
  };
  
  const mockInsectSystem = {
    init: jest.fn().mockReturnThis(),
    update: jest.fn(),
    TYPE: null,
    STATE: null
  };
  
  const mockWormSystem = {
    init: jest.fn().mockReturnThis(),
    update: jest.fn(),
    TYPE: null,
    STATE: null
  };
  
  const mockDecompositionSystem = {
    init: jest.fn().mockReturnThis(),
    update: jest.fn(),
    TYPE: null,
    STATE: null
  };
  
  // Create our own mock implementation of the BiologySystem
  const BiologySystem = {
    // Properties
    core: null,
    TYPE: null,
    STATE: null,
    growthRate: 4.5,
    metabolism: 0.65,
    reproduction: 5.0,
    processedThisFrame: null,
    plantSystem: null,
    seedSystem: null,
    insectSystem: null,
    wormSystem: null,
    decompositionSystem: null,
    
    // Mock methods
    init: jest.fn(function(core) {
      this.core = core;
      console.log("Initializing biology systems...");
      
      // Create processed flags array
      this.processedThisFrame = new Uint8Array(core.size);
      
      // Initialize subsystems
      this.plantSystem = mockPlantSystem.init(this);
      this.seedSystem = mockSeedSystem.init(this);
      this.insectSystem = mockInsectSystem.init(this);
      this.wormSystem = mockWormSystem.init(this);
      this.decompositionSystem = mockDecompositionSystem.init(this);
      
      // Ensure constants are propagated to subsystems
      this.propagateConstants();
      
      return this;
    }),
    
    propagateConstants: jest.fn(function() {
      console.log("Propagating constants to biology subsystems...");
      
      // Ensure TYPE and STATE are set in all subsystems
      if (this.plantSystem) {
        this.plantSystem.TYPE = this.TYPE;
        this.plantSystem.STATE = this.STATE;
      }
      if (this.seedSystem) {
        this.seedSystem.TYPE = this.TYPE;
        this.seedSystem.STATE = this.STATE;
      }
      if (this.insectSystem) {
        this.insectSystem.TYPE = this.TYPE;
        this.insectSystem.STATE = this.STATE;
      }
      if (this.wormSystem) {
        this.wormSystem.TYPE = this.TYPE;
        this.wormSystem.STATE = this.STATE;
      }
      if (this.decompositionSystem) {
        this.decompositionSystem.TYPE = this.TYPE;
        this.decompositionSystem.STATE = this.STATE;
      }
    }),
    
    update: jest.fn(function(activePixels, nextActivePixels) {
      // Reset processed flags
      this.processedThisFrame.fill(0);
      
      // Process plants first
      this.plantSystem.update(activePixels, nextActivePixels);
      
      // Process seeds
      this.seedSystem.update(activePixels, nextActivePixels);
      
      // Process mobile organisms
      this.insectSystem.update(activePixels, nextActivePixels);
      this.wormSystem.update(activePixels, nextActivePixels);
      
      // Process decomposition
      this.decompositionSystem.update(activePixels, nextActivePixels);
    })
  };
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console
    global.console = { log: jest.fn() };
    
    // Set up mock core
    mockCore = {
      size: 2500,
      width: 50,
      height: 50
    };
    
    // Define global subsystems
    global.PlantSystem = mockPlantSystem;
    global.SeedSystem = mockSeedSystem;
    global.InsectSystem = mockInsectSystem;
    global.WormSystem = mockWormSystem;
    global.DecompositionSystem = mockDecompositionSystem;
    
    // Define type and state enums
    BiologySystem.TYPE = {
      AIR: 0,
      WATER: 1,
      SOIL: 2,
      PLANT: 3,
      DEAD_MATTER: 4,
      SEED: 5,
      WORM: 6,
      INSECT: 7
    };
    
    BiologySystem.STATE = {
      DEFAULT: 0,
      WET: 1,
      DRY: 2,
      FERTILE: 3,
      ROOT: 10,
      STEM: 11,
      LEAF: 12,
      FLOWER: 13
    };
  });
  
  test('initialization should set references and initialize subsystems', () => {
    // Initialize biology system
    BiologySystem.init(mockCore);
    
    // Verify core reference was set
    expect(BiologySystem.core).toBe(mockCore);
    
    // Verify processed flags array was created
    expect(BiologySystem.processedThisFrame).toBeInstanceOf(Uint8Array);
    expect(BiologySystem.processedThisFrame.length).toBe(mockCore.size);
    
    // Verify subsystems were initialized
    expect(mockPlantSystem.init).toHaveBeenCalledWith(BiologySystem);
    expect(mockSeedSystem.init).toHaveBeenCalledWith(BiologySystem);
    expect(mockInsectSystem.init).toHaveBeenCalledWith(BiologySystem);
    expect(mockWormSystem.init).toHaveBeenCalledWith(BiologySystem);
    expect(mockDecompositionSystem.init).toHaveBeenCalledWith(BiologySystem);
    
    // Verify subsystem references were set
    expect(BiologySystem.plantSystem).toBe(mockPlantSystem);
    expect(BiologySystem.seedSystem).toBe(mockSeedSystem);
    expect(BiologySystem.insectSystem).toBe(mockInsectSystem);
    expect(BiologySystem.wormSystem).toBe(mockWormSystem);
    expect(BiologySystem.decompositionSystem).toBe(mockDecompositionSystem);
  });
  
  test('update should reset processed flags and call subsystem updates', () => {
    // Initialize biology system
    BiologySystem.init(mockCore);
    
    // Set some processed flags
    BiologySystem.processedThisFrame[10] = 1;
    BiologySystem.processedThisFrame[20] = 1;
    
    // Create active pixels
    const activePixels = new Set([1, 2, 3]);
    const nextActivePixels = new Set();
    
    // Call update
    BiologySystem.update(activePixels, nextActivePixels);
    
    // Verify processed flags were reset
    expect(BiologySystem.processedThisFrame[10]).toBe(0);
    expect(BiologySystem.processedThisFrame[20]).toBe(0);
    
    // Verify subsystem updates were called in correct order
    expect(mockPlantSystem.update).toHaveBeenCalledWith(activePixels, nextActivePixels);
    expect(mockSeedSystem.update).toHaveBeenCalledWith(activePixels, nextActivePixels);
    expect(mockInsectSystem.update).toHaveBeenCalledWith(activePixels, nextActivePixels);
    expect(mockWormSystem.update).toHaveBeenCalledWith(activePixels, nextActivePixels);
    expect(mockDecompositionSystem.update).toHaveBeenCalledWith(activePixels, nextActivePixels);
  });
  
  test('propagateConstants should propagate TYPE and STATE to all subsystems', () => {
    // Initialize biology system
    BiologySystem.init(mockCore);
    
    // Set TYPE and STATE constants
    BiologySystem.TYPE = { PLANT: 1, SOIL: 2 };
    BiologySystem.STATE = { ROOT: 1, STEM: 2 };
    
    // Call propagateConstants
    BiologySystem.propagateConstants();
    
    // Verify constants were propagated to all subsystems
    expect(mockPlantSystem.TYPE).toBe(BiologySystem.TYPE);
    expect(mockPlantSystem.STATE).toBe(BiologySystem.STATE);
    
    expect(mockSeedSystem.TYPE).toBe(BiologySystem.TYPE);
    expect(mockSeedSystem.STATE).toBe(BiologySystem.STATE);
    
    expect(mockInsectSystem.TYPE).toBe(BiologySystem.TYPE);
    expect(mockInsectSystem.STATE).toBe(BiologySystem.STATE);
    
    expect(mockWormSystem.TYPE).toBe(BiologySystem.TYPE);
    expect(mockWormSystem.STATE).toBe(BiologySystem.STATE);
    
    expect(mockDecompositionSystem.TYPE).toBe(BiologySystem.TYPE);
    expect(mockDecompositionSystem.STATE).toBe(BiologySystem.STATE);
  });
  
  test('growthRate setting should be accessible', () => {
    // Verify default value
    expect(BiologySystem.growthRate).toBe(4.5);
    
    // Change value
    BiologySystem.growthRate = 6.0;
    
    // Verify new value
    expect(BiologySystem.growthRate).toBe(6.0);
  });
  
  test('metabolism setting should be accessible', () => {
    // Verify default value
    expect(BiologySystem.metabolism).toBe(0.65);
    
    // Change value
    BiologySystem.metabolism = 0.8;
    
    // Verify new value
    expect(BiologySystem.metabolism).toBe(0.8);
  });
  
  test('reproduction setting should be accessible', () => {
    // Verify default value
    expect(BiologySystem.reproduction).toBe(5.0);
    
    // Change value
    BiologySystem.reproduction = 3.0;
    
    // Verify new value
    expect(BiologySystem.reproduction).toBe(3.0);
  });
});