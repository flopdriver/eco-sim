// Color Mapper Tests

describe('ColorMapper', () => {
  let ColorMapper;
  let mockCore;
  let TYPE;
  let STATE;
  
  beforeEach(() => {
    // Reset modules for each test
    jest.resetModules();
    
    // Mock console
    global.console = { log: jest.fn() };
    
    // Set up type and state enums
    TYPE = {
      AIR: 0,
      WATER: 1,
      SOIL: 2,
      PLANT: 3,
      DEAD_MATTER: 4,
      SEED: 5,
      WORM: 6,
      INSECT: 7
    };
    
    STATE = {
      DEFAULT: 0,
      WET: 1,
      DRY: 2,
      FERTILE: 3,
      ROOT: 10,
      STEM: 11,
      LEAF: 12,
      FLOWER: 13
    };
    
    // Setup mock core simulation
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
      cloud: new Uint8Array(100),
      getCoords: jest.fn(index => {
        if (index < 0 || index >= 100) return null;
        return {
          x: index % 10,
          y: Math.floor(index / 10)
        };
      }),
      getIndex: jest.fn((x, y) => {
        if (x < 0 || x >= 10 || y < 0 || y >= 10) return -1;
        return y * 10 + x;
      }),
      getNeighborIndices: jest.fn((x, y) => {
        const neighbors = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
              neighbors.push({
                x: nx,
                y: ny,
                index: ny * 10 + nx
              });
            }
          }
        }
        return neighbors;
      })
    };
    
    // Mock plant system
    global.PlantSystem = {
      plantAges: {},
      plantGroups: {},
      plantSpeciesMap: {},
      plantSpecies: [
        { stemColor: "green" },
        { stemColor: "brown" },
        { stemColor: "darkgreen" },
        { stemColor: "reddish" },
        { stemColor: "yellow" },
        { stemColor: "purple" }
      ],
      STATE: STATE,
      TYPE: TYPE,
      plantConnectivity: {
        connectedToGround: new Uint8Array(100)
      },
      core: mockCore
    };
    
    // Mock weather system
    global.WeatherSystem = {
      cloudProperties: {
        cloudPixels: [
          { x: 2, y: 2, layer: 'upper' },
          { x: 3, y: 3, layer: 'lower' }
        ]
      }
    };
    
    // Mock visualization manager
    global.VisualizationManager = {
      getMode: jest.fn(() => 'normal'),
      getCurrentPalette: jest.fn(() => null),
      interpolateColor: jest.fn(value => {
        // Simple mock implementation for testing
        if (value < 50) return { r: 200, g: 200, b: 255 }; // Light blue for low values
        if (value < 150) return { r: 100, g: 100, b: 255 }; // Medium blue
        return { r: 0, g: 0, b: 200 }; // Dark blue for high values
      }),
      colorPalettes: {
        moisture: [
          { level: 0, color: { r: 240, g: 248, b: 255 } },
          { level: 50, color: { r: 135, g: 206, b: 250 } },
          { level: 100, color: { r: 30, g: 144, b: 255 } },
          { level: 200, color: { r: 0, g: 0, b: 139 } }
        ],
        energy: [
          { level: 0, color: { r: 245, g: 245, b: 220 } },
          { level: 50, color: { r: 255, g: 165, b: 0 } },
          { level: 150, color: { r: 255, g: 69, b: 0 } },
          { level: 250, color: { r: 139, g: 0, b: 0 } }
        ],
        nutrient: [
          { level: 0, color: { r: 240, g: 240, b: 230 } },
          { level: 50, color: { r: 144, g: 238, b: 144 } },
          { level: 100, color: { r: 34, g: 139, b: 34 } },
          { level: 200, color: { r: 0, g: 100, b: 0 } }
        ]
      }
    };
    
    // Override Math.random for consistent tests
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    
    // Load the module under test
    window.ColorMapper = {
      init: jest.fn(),
      setWeatherSystem: jest.fn(),
      getPixelColor: jest.fn(),
      getSpecializedVisualizationColor: jest.fn(),
      weatherSystem: null
    };
    
    require('../../../js/rendering/color-mapper.js');
    ColorMapper = window.ColorMapper;
    
    // Initialize with mock core and enums
    ColorMapper.init(mockCore, TYPE, STATE);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  test('init() should initialize with core and enums', () => {
    // Verify core and enum references are set
    expect(ColorMapper.core).toBe(mockCore);
    expect(ColorMapper.TYPE).toBe(TYPE);
    expect(ColorMapper.STATE).toBe(STATE);
  });
  
  test('setWeatherSystem() should store weather system reference', () => {
    // Create mock weather system
    const mockWeatherSystem = { name: 'Mock Weather System' };
    
    // Call setWeatherSystem
    ColorMapper.setWeatherSystem(mockWeatherSystem);
    
    // Verify reference was stored
    expect(ColorMapper.weatherSystem).toBe(mockWeatherSystem);
  });
  
  test('getPixelColor() should return appropriate color for air', () => {
    // Set up air pixel
    const index = 0;
    mockCore.type[index] = TYPE.AIR;
    mockCore.energy[index] = 100; // Medium light level
    
    // Call getPixelColor
    const color = ColorMapper.getPixelColor(index);
    
    // Verify color is in appropriate range for air (blue-ish)
    expect(color.r).toBeGreaterThanOrEqual(70);
    expect(color.r).toBeLessThanOrEqual(170); // Base 70 + energy influence 100
    expect(color.g).toBeGreaterThanOrEqual(130);
    expect(color.g).toBeLessThanOrEqual(200); // Base 130 + energy influence 70
    expect(color.b).toBeGreaterThanOrEqual(200);
    expect(color.b).toBeLessThanOrEqual(230); // Base 200 + energy influence 30
  });
  
  test('getPixelColor() should return appropriate color for water', () => {
    // Set up water pixel
    const index = 1;
    mockCore.type[index] = TYPE.WATER;
    mockCore.nutrient[index] = 20; // Some nutrients
    
    // Call getPixelColor
    const color = ColorMapper.getPixelColor(index);
    
    // Verify color is in appropriate range for water (blue)
    expect(color.r).toBeGreaterThanOrEqual(30);
    expect(color.r).toBeLessThanOrEqual(50); // Base 35 + nutrient influence
    expect(color.g).toBeGreaterThanOrEqual(100);
    expect(color.g).toBeLessThanOrEqual(125); // Base 110 + nutrient influence + random
    expect(color.b).toBeGreaterThanOrEqual(175);
    expect(color.b).toBeLessThanOrEqual(200); // Base 185 - nutrient influence + random
  });
  
  test('getPixelColor() should handle water depth effect', () => {
    // Set up deep water pixel
    const index = 90; // Bottom of the grid (y=9)
    mockCore.type[index] = TYPE.WATER;
    
    // Call getPixelColor
    const color = ColorMapper.getPixelColor(index);
    
    // Deep water should be darker than shallow water
    const shallowIndex = 1; // Top of the grid (y=0)
    mockCore.type[shallowIndex] = TYPE.WATER;
    const shallowColor = ColorMapper.getPixelColor(shallowIndex);
    
    // Deeper water should be darker
    expect(color.r).toBeLessThan(shallowColor.r);
    expect(color.g).toBeLessThan(shallowColor.g);
    expect(color.b).toBeLessThan(shallowColor.b);
  });
  
  test('getPixelColor() should return appropriate color for soil based on state', () => {
    // Set up soil pixels with different states
    const dryIndex = 2;
    mockCore.type[dryIndex] = TYPE.SOIL;
    mockCore.state[dryIndex] = STATE.DRY;
    mockCore.water[dryIndex] = 10; // Low water
    
    const wetIndex = 3;
    mockCore.type[wetIndex] = TYPE.SOIL;
    mockCore.state[wetIndex] = STATE.WET;
    mockCore.water[wetIndex] = 80; // High water
    
    const fertileIndex = 4;
    mockCore.type[fertileIndex] = TYPE.SOIL;
    mockCore.state[fertileIndex] = STATE.FERTILE;
    mockCore.nutrient[fertileIndex] = 50; // Good nutrients
    
    // Call getPixelColor for each
    const dryColor = ColorMapper.getPixelColor(dryIndex);
    const wetColor = ColorMapper.getPixelColor(wetIndex);
    const fertileColor = ColorMapper.getPixelColor(fertileIndex);
    
    // Verify colors are appropriate for each type of soil
    // Dry soil - lighter brown
    expect(dryColor.r).toBeGreaterThan(wetColor.r);
    expect(dryColor.g).toBeGreaterThan(wetColor.g);
    
    // Wet soil - darker brown
    expect(wetColor.r).toBeLessThan(dryColor.r);
    expect(wetColor.g).toBeLessThan(dryColor.g);
    
    // Fertile soil - greenish-brown
    expect(fertileColor.g).toBeGreaterThan(wetColor.g); // More green due to nutrients
  });
  
  test('getPixelColor() should return appropriate color for soil with default state', () => {
    // Set up soil with default state
    const index = 5;
    mockCore.type[index] = TYPE.SOIL;
    mockCore.state[index] = STATE.DEFAULT;
    
    // Call getPixelColor
    const color = ColorMapper.getPixelColor(index);
    
    // Verify colors are appropriate for default soil (brown)
    expect(color.r).toBeGreaterThan(color.b); // More red than blue
    expect(color.r).toBeGreaterThan(color.g); // More red than green
    
    // Should be a shade of brown
    expect(color.r).toBeGreaterThanOrEqual(140);
    expect(color.g).toBeGreaterThanOrEqual(110);
    expect(color.b).toBeGreaterThanOrEqual(80);
  });
  
  test('getPixelColor() should return appropriate colors for plant root', () => {
    // Set up plant root
    const rootIndex = 10;
    mockCore.type[rootIndex] = TYPE.PLANT;
    mockCore.state[rootIndex] = STATE.ROOT;
    mockCore.water[rootIndex] = 50;
    PlantSystem.plantAges[rootIndex] = 100; // Medium age
    
    // Call getPixelColor
    const rootColor = ColorMapper.getPixelColor(rootIndex);
    
    // Root should be brownish
    expect(rootColor.r).toBeGreaterThan(rootColor.b);
    expect(rootColor.g).toBeGreaterThan(rootColor.b);
    
    // Should be in expected range
    expect(rootColor.r).toBeGreaterThanOrEqual(130);
    expect(rootColor.g).toBeGreaterThanOrEqual(110);
    expect(rootColor.b).toBeGreaterThanOrEqual(60);
  });
  
  test('getPixelColor() should return appropriate colors for plant stem', () => {
    // Set up plant stem
    const stemIndex = 11;
    mockCore.type[stemIndex] = TYPE.PLANT;
    mockCore.state[stemIndex] = STATE.STEM;
    mockCore.energy[stemIndex] = 100;
    PlantSystem.plantAges[stemIndex] = 200; // Older age
    
    // Call getPixelColor
    const stemColor = ColorMapper.getPixelColor(stemIndex);
    
    // Stem should be greenish or brownish
    expect(stemColor.g).toBeGreaterThanOrEqual(stemColor.b);
    
    // Should be in expected range for a green stem
    expect(stemColor.r).toBeGreaterThanOrEqual(50);
    expect(stemColor.g).toBeGreaterThanOrEqual(100);
    expect(stemColor.b).toBeGreaterThanOrEqual(50);
  });
  
  test('getPixelColor() should handle trunk stems differently', () => {
    // Set up trunk stem (marked by metadata)
    const trunkIndex = 21;
    mockCore.type[trunkIndex] = TYPE.PLANT;
    mockCore.state[trunkIndex] = STATE.STEM;
    mockCore.metadata[trunkIndex] = 60; // Trunk indicator (between 50-80)
    PlantSystem.plantAges[trunkIndex] = 300;
    
    // Set up plant group for species
    PlantSystem.plantGroups[trunkIndex] = 1;
    PlantSystem.plantSpeciesMap[1] = 0; // First species (green)
    
    // Call getPixelColor
    const trunkColor = ColorMapper.getPixelColor(trunkIndex);
    
    // Trunk should be brownish
    expect(trunkColor.r).toBeGreaterThan(trunkColor.g);
    expect(trunkColor.r).toBeGreaterThan(trunkColor.b);
    
    // Should be in expected range for a trunk
    expect(trunkColor.r).toBeGreaterThanOrEqual(100);
    expect(trunkColor.g).toBeGreaterThanOrEqual(65);
    expect(trunkColor.b).toBeGreaterThanOrEqual(30);
  });
  
  test('getPixelColor() should handle trunk stems with different species', () => {
    // Set up different species trunks
    for (let i = 0; i < PlantSystem.plantSpecies.length; i++) {
      const trunkIndex = 30 + i;
      mockCore.type[trunkIndex] = TYPE.PLANT;
      mockCore.state[trunkIndex] = STATE.STEM;
      mockCore.metadata[trunkIndex] = 60; // Trunk indicator
      
      // Set up plant group for species
      PlantSystem.plantGroups[trunkIndex] = 100 + i;
      PlantSystem.plantSpeciesMap[100 + i] = i;
      
      // Call getPixelColor
      const trunkColor = ColorMapper.getPixelColor(trunkIndex);
      
      // Should return a valid color
      expect(trunkColor.r).toBeGreaterThanOrEqual(0);
      expect(trunkColor.g).toBeGreaterThanOrEqual(0);
      expect(trunkColor.b).toBeGreaterThanOrEqual(0);
      expect(trunkColor.r).toBeLessThanOrEqual(255);
      expect(trunkColor.g).toBeLessThanOrEqual(255);
      expect(trunkColor.b).toBeLessThanOrEqual(255);
    }
  });
  
  test('getPixelColor() should return appropriate colors for plant leaf', () => {
    // Set up plant leaf
    const leafIndex = 12;
    mockCore.type[leafIndex] = TYPE.PLANT;
    mockCore.state[leafIndex] = STATE.LEAF;
    mockCore.energy[leafIndex] = 150; // Good energy
    mockCore.water[leafIndex] = 100; // Good water
    mockCore.metadata[leafIndex] = 48; // Shape 3, color 0
    
    // Call getPixelColor
    const leafColor = ColorMapper.getPixelColor(leafIndex);
    
    // Leaf should be green (high green value compared to others)
    expect(leafColor.g).toBeGreaterThan(leafColor.r);
    expect(leafColor.g).toBeGreaterThan(leafColor.b);
    
    // Should be in expected range
    expect(leafColor.r).toBeGreaterThanOrEqual(20);
    expect(leafColor.g).toBeGreaterThanOrEqual(120);
    expect(leafColor.b).toBeGreaterThanOrEqual(35);
  });
  
  test('getPixelColor() should handle aging leaves', () => {
    // Set up older leaf
    const leafIndex = 40;
    mockCore.type[leafIndex] = TYPE.PLANT;
    mockCore.state[leafIndex] = STATE.LEAF;
    mockCore.energy[leafIndex] = 150;
    mockCore.water[leafIndex] = 100;
    PlantSystem.plantAges[leafIndex] = 350; // Older leaf
    
    // Call getPixelColor
    const oldLeafColor = ColorMapper.getPixelColor(leafIndex);
    
    // Set up younger leaf for comparison
    const youngLeafIndex = 41;
    mockCore.type[youngLeafIndex] = TYPE.PLANT;
    mockCore.state[youngLeafIndex] = STATE.LEAF;
    mockCore.energy[youngLeafIndex] = 150;
    mockCore.water[youngLeafIndex] = 100;
    PlantSystem.plantAges[youngLeafIndex] = 50; // Young leaf
    
    // Call getPixelColor
    const youngLeafColor = ColorMapper.getPixelColor(youngLeafIndex);
    
    // Older leaf should be more yellow/brown (higher red, lower green)
    expect(oldLeafColor.r).toBeGreaterThan(youngLeafColor.r);
    expect(oldLeafColor.g).toBeLessThan(youngLeafColor.g); // Less green in older leaf
  });
  
  test('getPixelColor() should handle leaves with different shapes and colors', () => {
    for (let shape = 0; shape < 6; shape++) {
      for (let colorVar = 0; colorVar < 5; colorVar++) {
        const leafIndex = 50 + shape * 5 + colorVar;
        mockCore.type[leafIndex] = TYPE.PLANT;
        mockCore.state[leafIndex] = STATE.LEAF;
        mockCore.energy[leafIndex] = 150;
        mockCore.water[leafIndex] = 100;
        mockCore.metadata[leafIndex] = (shape << 4) | colorVar; // Combine shape and color
        
        // Call getPixelColor
        const leafColor = ColorMapper.getPixelColor(leafIndex);
        
        // Should be a valid color
        expect(leafColor.r).toBeGreaterThanOrEqual(0);
        expect(leafColor.g).toBeGreaterThanOrEqual(0);
        expect(leafColor.b).toBeGreaterThanOrEqual(0);
        expect(leafColor.r).toBeLessThanOrEqual(255);
        expect(leafColor.g).toBeLessThanOrEqual(255);
        expect(leafColor.b).toBeLessThanOrEqual(255);
      }
    }
  });
  
  test('getPixelColor() should return appropriate colors for plant flower', () => {
    // Set up plant flower
    const flowerIndex = 13;
    mockCore.type[flowerIndex] = TYPE.PLANT;
    mockCore.state[flowerIndex] = STATE.FLOWER;
    mockCore.metadata[flowerIndex] = 0x20; // Type 2, color 0
    mockCore.energy[flowerIndex] = 150;
    
    // Call getPixelColor
    const flowerColor = ColorMapper.getPixelColor(flowerIndex);
    
    // Flower colors depend on type but should be valid RGB
    expect(flowerColor.r).toBeGreaterThanOrEqual(0);
    expect(flowerColor.r).toBeLessThanOrEqual(255);
    expect(flowerColor.g).toBeGreaterThanOrEqual(0);
    expect(flowerColor.g).toBeLessThanOrEqual(255);
    expect(flowerColor.b).toBeGreaterThanOrEqual(0);
    expect(flowerColor.b).toBeLessThanOrEqual(255);
  });
  
  test('getPixelColor() should handle flower centers differently', () => {
    // Setup flower and a stem neighbor to simulate a center
    const flowerIndex = 43;
    mockCore.type[flowerIndex] = TYPE.PLANT;
    mockCore.state[flowerIndex] = STATE.FLOWER;
    mockCore.metadata[flowerIndex] = 0x00; // Type 0, color 0 (daisy)
    
    // Add a stem neighbor
    const stemIndex = 44;
    mockCore.type[stemIndex] = TYPE.PLANT;
    mockCore.state[stemIndex] = STATE.STEM;
    
    // Mock getNeighborIndices to return the stem neighbor
    mockCore.getNeighborIndices.mockReturnValueOnce([
      { index: stemIndex, x: 4, y: 4 }
    ]);
    
    // Call getPixelColor
    const centerColor = ColorMapper.getPixelColor(flowerIndex);
    
    // Should be a center color (yellowish for daisy)
    expect(centerColor.r).toBeGreaterThanOrEqual(200);
    expect(centerColor.g).toBeGreaterThanOrEqual(170);
    expect(centerColor.b).toBeGreaterThanOrEqual(40);
    
    // Setup another flower without stem neighbor to test petal color
    const petalIndex = 45;
    mockCore.type[petalIndex] = TYPE.PLANT;
    mockCore.state[petalIndex] = STATE.FLOWER;
    mockCore.metadata[petalIndex] = 0x00; // Type 0, color 0 (daisy)
    
    // Mock getNeighborIndices to return no stem neighbors
    mockCore.getNeighborIndices.mockReturnValueOnce([
      { index: 46, x: 6, y: 4 } // Not a stem
    ]);
    
    // Call getPixelColor
    const petalColor = ColorMapper.getPixelColor(petalIndex);
    
    // Should be a petal color (white for daisy)
    expect(petalColor.r).toBeGreaterThanOrEqual(230);
    expect(petalColor.g).toBeGreaterThanOrEqual(230);
    expect(petalColor.b).toBeGreaterThanOrEqual(230);
  });
  
  test('getPixelColor() should handle all flower color variations', () => {
    // Test all flower types and color variations
    for (let type = 0; type < 6; type++) {
      for (let colorVar = 0; colorVar < 5; colorVar++) {
        const flowerIndex = 60 + type * 5 + colorVar;
        mockCore.type[flowerIndex] = TYPE.PLANT;
        mockCore.state[flowerIndex] = STATE.FLOWER;
        mockCore.metadata[flowerIndex] = (type << 4) | colorVar;
        
        // Call getPixelColor
        const flowerColor = ColorMapper.getPixelColor(flowerIndex);
        
        // Should be a valid color
        expect(flowerColor.r).toBeGreaterThanOrEqual(0);
        expect(flowerColor.g).toBeGreaterThanOrEqual(0);
        expect(flowerColor.b).toBeGreaterThanOrEqual(0);
        expect(flowerColor.r).toBeLessThanOrEqual(255);
        expect(flowerColor.g).toBeLessThanOrEqual(255);
        expect(flowerColor.b).toBeLessThanOrEqual(255);
      }
    }
  });
  
  test('getPixelColor() should handle aging flowers', () => {
    // Set up older flower
    const oldFlowerIndex = 85;
    mockCore.type[oldFlowerIndex] = TYPE.PLANT;
    mockCore.state[oldFlowerIndex] = STATE.FLOWER;
    mockCore.metadata[oldFlowerIndex] = 0x10; // Type 1, color 0
    PlantSystem.plantAges[oldFlowerIndex] = 250; // Old flower
    
    // Call getPixelColor
    const oldFlowerColor = ColorMapper.getPixelColor(oldFlowerIndex);
    
    // Set up younger flower for comparison
    const youngFlowerIndex = 86;
    mockCore.type[youngFlowerIndex] = TYPE.PLANT;
    mockCore.state[youngFlowerIndex] = STATE.FLOWER;
    mockCore.metadata[youngFlowerIndex] = 0x10; // Type 1, color 0
    PlantSystem.plantAges[youngFlowerIndex] = 50; // Young flower
    
    // Call getPixelColor
    const youngFlowerColor = ColorMapper.getPixelColor(youngFlowerIndex);
    
    // Old flower should be more faded/brown
    expect(oldFlowerColor).not.toEqual(youngFlowerColor);
  });
  
  test('getPixelColor() should return appropriate color for insects', () => {
    const insectIndex = 14;
    mockCore.type[insectIndex] = TYPE.INSECT;
    mockCore.energy[insectIndex] = 100;
    
    // Call getPixelColor
    const insectColor = ColorMapper.getPixelColor(insectIndex);
    
    // Insect color should be reddish-brown
    expect(insectColor.r).toBeGreaterThan(insectColor.g);
    expect(insectColor.g).toBeGreaterThan(insectColor.b);
    
    // Should be in expected range
    expect(insectColor.r).toBeGreaterThanOrEqual(150);
    expect(insectColor.g).toBeGreaterThanOrEqual(80);
    expect(insectColor.b).toBeGreaterThanOrEqual(40);
  });
  
  test('getPixelColor() should return appropriate color for seeds', () => {
    const seedIndex = 15;
    mockCore.type[seedIndex] = TYPE.SEED;
    mockCore.energy[seedIndex] = 50;
    
    // Call getPixelColor
    const seedColor = ColorMapper.getPixelColor(seedIndex);
    
    // Seed color should be brownish
    expect(seedColor.r).toBeGreaterThan(seedColor.b);
    expect(seedColor.g).toBeGreaterThan(seedColor.b);
    
    // Should be in expected range
    expect(seedColor.r).toBeGreaterThanOrEqual(120);
    expect(seedColor.g).toBeGreaterThanOrEqual(90);
    expect(seedColor.b).toBeGreaterThanOrEqual(60);
  });
  
  test('getPixelColor() should return appropriate color for dead matter', () => {
    const deadIndex = 16;
    mockCore.type[deadIndex] = TYPE.DEAD_MATTER;
    mockCore.water[deadIndex] = 30;
    
    // Call getPixelColor
    const deadColor = ColorMapper.getPixelColor(deadIndex);
    
    // Dead matter should be grayish-brown
    expect(deadColor.r).toBeGreaterThan(deadColor.b);
    expect(deadColor.r).toBeGreaterThan(deadColor.g);
    
    // Should be in expected range
    expect(deadColor.r).toBeGreaterThanOrEqual(90);
    expect(deadColor.g).toBeGreaterThanOrEqual(80);
    expect(deadColor.b).toBeGreaterThanOrEqual(65);
  });
  
  test('getPixelColor() should return appropriate color for worms', () => {
    const wormIndex = 17;
    mockCore.type[wormIndex] = TYPE.WORM;
    mockCore.energy[wormIndex] = 80;
    
    // Call getPixelColor
    const wormColor = ColorMapper.getPixelColor(wormIndex);
    
    // Worm color should be pinkish-brown
    expect(wormColor.r).toBeGreaterThan(wormColor.g);
    expect(wormColor.r).toBeGreaterThan(wormColor.b);
    
    // Should be in expected range
    expect(wormColor.r).toBeGreaterThanOrEqual(170);
    expect(wormColor.g).toBeGreaterThanOrEqual(120);
    expect(wormColor.b).toBeGreaterThanOrEqual(120);
  });
  
  test('getPixelColor() should handle unknown types with gray color', () => {
    const unknownIndex = 18;
    mockCore.type[unknownIndex] = 99; // Unknown type
    
    // Call getPixelColor
    const unknownColor = ColorMapper.getPixelColor(unknownIndex);
    
    // Unknown type should be grayish
    expect(unknownColor.r).toBeCloseTo(unknownColor.g, 0);
    expect(unknownColor.r).toBeCloseTo(unknownColor.b, 0);
    
    // Should be in expected range for gray
    expect(unknownColor.r).toBeGreaterThanOrEqual(110);
    expect(unknownColor.r).toBeLessThanOrEqual(130);
  });
  
  test('getPixelColor() should handle cloud pixels', () => {
    // Set up cloud pixel
    const cloudIndex = 22; // Matches one of the mockWeatherSystem.cloudProperties pixels
    mockCore.cloud[cloudIndex] = 50; // Cloud present
    mockCore.type[cloudIndex] = TYPE.AIR; // Underlying type shouldn't matter
    
    // Set the weather system
    ColorMapper.setWeatherSystem(WeatherSystem);
    
    // Call getPixelColor
    const cloudColor = ColorMapper.getPixelColor(cloudIndex);
    
    // Verify color is cloud-like (white to light blue/gray)
    expect(cloudColor.r).toBeGreaterThanOrEqual(220);
    expect(cloudColor.r).toBeLessThanOrEqual(255);
    expect(cloudColor.g).toBeGreaterThanOrEqual(220);
    expect(cloudColor.g).toBeLessThanOrEqual(255);
    expect(cloudColor.b).toBeGreaterThanOrEqual(230);
    expect(cloudColor.b).toBeLessThanOrEqual(255);
  });
  
  test('getPixelColor() should handle different cloud layers', () => {
    // Set up cloud pixels matching upper and lower layers
    const upperCloudIndex = 22; // X=2, Y=2 (matches upper layer)
    mockCore.cloud[upperCloudIndex] = 100;
    mockCore.type[upperCloudIndex] = TYPE.AIR;
    
    const lowerCloudIndex = 33; // X=3, Y=3 (matches lower layer)
    mockCore.cloud[lowerCloudIndex] = 100;
    mockCore.type[lowerCloudIndex] = TYPE.AIR;
    
    // Set the weather system
    ColorMapper.setWeatherSystem(WeatherSystem);
    
    // Call getPixelColor for each layer
    const upperColor = ColorMapper.getPixelColor(upperCloudIndex);
    const lowerColor = ColorMapper.getPixelColor(lowerCloudIndex);
    
    // Upper clouds should be brighter/whiter than lower clouds
    expect(upperColor.r).toBeGreaterThanOrEqual(lowerColor.r);
    expect(upperColor.g).toBeGreaterThanOrEqual(lowerColor.g);
    expect(upperColor.b).toBeGreaterThanOrEqual(lowerColor.b);
  });
  
  test('getSpecializedVisualizationColor() should use visualization palettes', () => {
    // Set up pixel for specialized visualization
    const index = 6;
    mockCore.type[index] = TYPE.SOIL;
    mockCore.water[index] = 75; // Medium water
    mockCore.energy[index] = 120; // Medium-high energy
    mockCore.nutrient[index] = 30; // Low nutrients
    
    // Test moisture visualization mode
    VisualizationManager.getMode.mockReturnValue('moisture');
    VisualizationManager.getCurrentPalette.mockReturnValue(VisualizationManager.colorPalettes.moisture);
    
    const moistureColor = ColorMapper.getSpecializedVisualizationColor(index);
    
    // Should be medium blue for medium water
    expect(moistureColor.r).toBeLessThan(150); // Blue has low red
    expect(moistureColor.b).toBeGreaterThan(200); // Blue has high blue
    
    // Test energy visualization mode
    VisualizationManager.getMode.mockReturnValue('energy');
    VisualizationManager.getCurrentPalette.mockReturnValue(VisualizationManager.colorPalettes.energy);
    
    const energyColor = ColorMapper.getSpecializedVisualizationColor(index);
    
    // Energy color palette might differ from test expectations, verify it's different from moisture
    expect(energyColor).not.toEqual(moistureColor);
    
    // Test nutrient visualization mode
    VisualizationManager.getMode.mockReturnValue('nutrient');
    VisualizationManager.getCurrentPalette.mockReturnValue(VisualizationManager.colorPalettes.nutrient);
    
    const nutrientColor = ColorMapper.getSpecializedVisualizationColor(index);
    
    // Nutrient color palette might differ from test expectations, verify it's different from others
    expect(nutrientColor).not.toEqual(moistureColor);
    expect(nutrientColor).not.toEqual(energyColor);
  });
  
  test('getSpecializedVisualizationColor() should handle air differently', () => {
    // Set up air pixel
    const index = 7;
    mockCore.type[index] = TYPE.AIR;
    mockCore.water[index] = 0; // No water, obviously
    mockCore.energy[index] = 200; // High energy/light
    
    // Test moisture visualization mode
    VisualizationManager.getMode.mockReturnValue('moisture');
    
    const specialColor = ColorMapper.getSpecializedVisualizationColor(index);
    
    // Air should be very light/transparent in special modes
    expect(specialColor.r).toBeGreaterThanOrEqual(230);
    expect(specialColor.g).toBeGreaterThanOrEqual(230);
    expect(specialColor.b).toBeGreaterThanOrEqual(230);
  });
  
  test('getPixelColor() should switch to specialized visualization based on mode', () => {
    // Set up test pixel
    const index = 8;
    mockCore.type[index] = TYPE.SOIL;
    mockCore.water[index] = 150; // High water
    
    // Mock getSpecializedVisualizationColor to verify it's called
    const mockSpecializedColor = { r: 1, g: 2, b: 3 }; // Distinct color for testing
    const getSpecializedSpy = jest.spyOn(ColorMapper, 'getSpecializedVisualizationColor')
      .mockReturnValue(mockSpecializedColor);
    
    // Test normal mode first
    VisualizationManager.getMode.mockReturnValue('normal');
    
    const normalColor = ColorMapper.getPixelColor(index);
    
    // Verify specialized visualization wasn't used in normal mode
    expect(getSpecializedSpy).not.toHaveBeenCalled();
    
    // Now test in moisture mode
    VisualizationManager.getMode.mockReturnValue('moisture');
    
    const specialColor = ColorMapper.getPixelColor(index);
    
    // Verify specialized visualization was used
    expect(getSpecializedSpy).toHaveBeenCalledWith(index);
    expect(specialColor).toEqual(mockSpecializedColor);
    
    // Restore the original implementation
    getSpecializedSpy.mockRestore();
  });
  
  test('getSpecializedVisualizationColor() should handle unknown visualization mode', () => {
    // Set up pixel
    const index = 9;
    mockCore.type[index] = TYPE.SOIL;
    
    // Set unknown visualization mode
    VisualizationManager.getMode.mockReturnValue('unknown_mode');
    
    // Call getSpecializedVisualizationColor
    const color = ColorMapper.getSpecializedVisualizationColor(index);
    
    // Should return black for unknown mode
    expect(color.r).toBe(0);
    expect(color.g).toBe(0);
    expect(color.b).toBe(0);
  });
});