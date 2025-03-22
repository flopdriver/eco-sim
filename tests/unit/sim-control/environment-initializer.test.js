// Environment Initializer Tests
describe('EnvironmentInitializer', () => {
    let mockController;
    let EnvironmentInitializer;
    
    beforeEach(() => {
        // Reset modules
        jest.resetModules();
        
        // Mock console
        global.console = { log: jest.fn() };
        
        // Mock controller with required systems
        mockController = {
            core: {
                width: 20,
                height: 20,
                size: 400,
                type: new Uint8Array(400),
                state: new Uint8Array(400),
                water: new Uint8Array(400),
                energy: new Uint8Array(400),
                nutrient: new Uint8Array(400),
                metadata: new Uint8Array(400),
                getIndex: jest.fn((x, y) => {
                    if (x < 0 || x >= 20 || y < 0 || y >= 20) return -1;
                    return y * 20 + x;
                })
            },
            TYPE: {
                AIR: 0,
                WATER: 1,
                SOIL: 2,
                PLANT: 3,
                INSECT: 4,
                SEED: 5,
                DEAD_MATTER: 6,
                WORM: 7
            },
            STATE: {
                DEFAULT: 0,
                WET: 1,
                DRY: 2,
                FERTILE: 3,
                ROOT: 4,
                STEM: 5,
                LEAF: 6,
                FLOWER: 7,
                CLAY: 11,
                SANDY: 12,
                LOAMY: 13,
                ROCKY: 14
            },
            physics: {
                soilMoistureSystem: {
                    determineSoilLayer: jest.fn((x, y) => {
                        // Simulate different soil types based on position
                        if (y > 15) return mockController.STATE.CLAY;
                        if (y > 10) return mockController.STATE.LOAMY;
                        if (y > 5) return mockController.STATE.SANDY;
                        return mockController.STATE.ROCKY;
                    })
                }
            }
        };
        
        // Load the EnvironmentInitializer module
        EnvironmentInitializer = require('../../../js/sim-control/environment-initializer.js');
    });
    
    // Test initialization
    test('initialization sets controller reference', () => {
        const initializer = EnvironmentInitializer.init(mockController);
        expect(initializer.controller).toBe(mockController);
    });
    
    // Test environment initialization
    test('environment initialization creates terrain and soil layers', () => {
        const initializer = EnvironmentInitializer.init(mockController);
        initializer.initializeEnvironment();
        
        // Verify terrain generation
        let hasGround = false;
        let hasAir = false;
        
        for (let i = 0; i < mockController.core.size; i++) {
            if (mockController.core.type[i] === mockController.TYPE.SOIL) {
                hasGround = true;
            } else if (mockController.core.type[i] === mockController.TYPE.AIR) {
                hasAir = true;
            }
        }
        
        expect(hasGround).toBe(true);
        expect(hasAir).toBe(true);
        
        // Verify soil layers
        let hasClay = false;
        let hasLoamy = false;
        let hasSandy = false;
        let hasRocky = false;
        
        for (let i = 0; i < mockController.core.size; i++) {
            if (mockController.core.state[i] === mockController.STATE.CLAY) {
                hasClay = true;
            } else if (mockController.core.state[i] === mockController.STATE.LOAMY) {
                hasLoamy = true;
            } else if (mockController.core.state[i] === mockController.STATE.SANDY) {
                hasSandy = true;
            } else if (mockController.core.state[i] === mockController.STATE.ROCKY) {
                hasRocky = true;
            }
        }
        
        expect(hasClay).toBe(true);
        expect(hasLoamy).toBe(true);
        expect(hasSandy).toBe(true);
        expect(hasRocky).toBe(true);
    });
    
    // Test water content initialization
    test('water content is initialized based on soil type and depth', () => {
        const initializer = EnvironmentInitializer.init(mockController);
        initializer.initializeEnvironment();
        
        // Test water content in different soil types
        const clayIndex = mockController.core.getIndex(5, 16); // Deep clay soil
        const loamyIndex = mockController.core.getIndex(5, 11); // Medium loamy soil
        const sandyIndex = mockController.core.getIndex(5, 6); // Shallow sandy soil
        const rockyIndex = mockController.core.getIndex(5, 1); // Very shallow rocky soil
        
        // Verify water content follows expected patterns
        expect(mockController.core.water[clayIndex]).toBeGreaterThan(mockController.core.water[loamyIndex]);
        expect(mockController.core.water[loamyIndex]).toBeGreaterThan(mockController.core.water[sandyIndex]);
        expect(mockController.core.water[sandyIndex]).toBeGreaterThan(mockController.core.water[rockyIndex]);
    });
    
    // Test terrain variation
    test('terrain has natural variation with multiple frequency components', () => {
        const initializer = EnvironmentInitializer.init(mockController);
        initializer.initializeEnvironment();
        
        // Check for terrain variation at different heights
        const heights = new Set();
        for (let x = 0; x < mockController.core.width; x++) {
            for (let y = 0; y < mockController.core.height; y++) {
                const index = mockController.core.getIndex(x, y);
                if (mockController.core.type[index] === mockController.TYPE.SOIL) {
                    heights.add(y);
                }
            }
        }
        
        // Verify we have multiple different heights
        expect(heights.size).toBeGreaterThan(1);
    });
    
    // Test soil moisture system integration
    test('uses soil moisture system when available', () => {
        const initializer = EnvironmentInitializer.init(mockController);
        initializer.initializeEnvironment();
        
        // Verify soil moisture system was called
        expect(mockController.physics.soilMoistureSystem.determineSoilLayer).toHaveBeenCalled();
    });
    
    // Test fallback soil layer determination
    test('uses fallback implementation when soil moisture system is not available', () => {
        // Remove soil moisture system
        delete mockController.physics.soilMoistureSystem;
        
        const initializer = EnvironmentInitializer.init(mockController);
        initializer.initializeEnvironment();
        
        // Verify we still have soil layers
        let hasSoilLayers = false;
        for (let i = 0; i < mockController.core.size; i++) {
            if ([mockController.STATE.CLAY, mockController.STATE.LOAMY, 
                 mockController.STATE.SANDY, mockController.STATE.ROCKY].includes(mockController.core.state[i])) {
                hasSoilLayers = true;
                break;
            }
        }
        
        expect(hasSoilLayers).toBe(true);
    });
}); 