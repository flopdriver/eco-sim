// System Manager Tests
describe('SystemManager', () => {
    let mockController;
    let SystemManager;
    let CoreSimulation;
    
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Mock CoreSimulation
        CoreSimulation.init.mockImplementation(() => ({
            TYPE: { WATER: 1, SOIL: 2 },
            STATE: { LIQUID: 1, SOLID: 2 }
        }));
        
        // Mock controller
        mockController = {
            core: null,
            environment: {
                init: jest.fn().mockReturnThis(),
                initializeEnvironment: jest.fn().mockReturnValue(true)
            }
        };
        
        // Mock console
        global.console = { log: jest.fn(), error: jest.fn() };
        
        // Mock controller with all required systems
        mockController = {
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
                FLOWER: 7
            },
            core: null,
            environment: null,
            physics: null,
            biology: null,
            rendering: null,
            userInteraction: null
        };
        
        // Mock EnvironmentController
        const EnvironmentController = {
            init: jest.fn().mockReturnThis()
        };
        
        // Mock PhysicsSystem
        const PhysicsSystem = {
            init: jest.fn().mockReturnThis()
        };
        
        // Mock BiologySystem
        const BiologySystem = {
            init: jest.fn().mockReturnThis(),
            propagateConstants: jest.fn()
        };
        
        // Mock WebGLRenderingSystem
        const WebGLRenderingSystem = {
            init: jest.fn().mockReturnThis()
        };
        
        // Mock UserInteractionSystem
        const UserInteractionSystem = {
            init: jest.fn().mockReturnThis(),
            propagateConstants: jest.fn()
        };
        
        // Mock ColorMapper
        global.ColorMapper = {
            TYPE: null,
            STATE: null,
            core: null
        };
    });
    
    // Test initialization
    test('initialization sets controller reference', () => {
        const manager = SystemManager.init(mockController);
        expect(manager.controller).toBe(mockController);
    });
    
    // Test system initialization order
    test('systems are initialized in correct order', () => {
        const manager = SystemManager.init(mockController);
        
        // Initialize systems
        const result = manager.initializeSystems('test-canvas');
        
        // Verify initialization order
        expect(mockController.core).toBeDefined();
        expect(mockController.environment).toBeDefined();
        expect(mockController.physics).toBeDefined();
        expect(mockController.biology).toBeDefined();
        expect(mockController.rendering).toBeDefined();
        expect(mockController.userInteraction).toBeDefined();
        
        // Verify TYPE and STATE were set on each system
        expect(mockController.core.TYPE).toBe(mockController.TYPE);
        expect(mockController.core.STATE).toBe(mockController.STATE);
        expect(mockController.environment.TYPE).toBe(mockController.TYPE);
        expect(mockController.environment.STATE).toBe(mockController.STATE);
        expect(mockController.physics.TYPE).toBe(mockController.TYPE);
        expect(mockController.physics.STATE).toBe(mockController.STATE);
        expect(mockController.biology.TYPE).toBe(mockController.TYPE);
        expect(mockController.biology.STATE).toBe(mockController.STATE);
        expect(mockController.rendering.TYPE).toBe(mockController.TYPE);
        expect(mockController.rendering.STATE).toBe(mockController.STATE);
        expect(mockController.userInteraction.TYPE).toBe(mockController.TYPE);
        expect(mockController.userInteraction.STATE).toBe(mockController.STATE);
        
        // Verify ColorMapper was updated
        expect(global.ColorMapper.TYPE).toBe(mockController.TYPE);
        expect(global.ColorMapper.STATE).toBe(mockController.STATE);
        expect(global.ColorMapper.core).toBe(mockController.core);
        
        // Verify propagateConstants was called on appropriate systems
        expect(mockController.biology.propagateConstants).toHaveBeenCalled();
        expect(mockController.userInteraction.propagateConstants).toHaveBeenCalled();
        
        expect(result).toBe(true);
    });
    
    // Test constant propagation
    test('constants are propagated to all systems', () => {
        const manager = SystemManager.init(mockController);
        
        // Initialize systems first
        manager.initializeSystems('test-canvas');
        
        // Propagate constants
        const result = manager.propagateConstants();
        
        // Verify TYPE and STATE were propagated to all systems
        expect(mockController.core.TYPE).toBe(mockController.TYPE);
        expect(mockController.core.STATE).toBe(mockController.STATE);
        expect(mockController.environment.TYPE).toBe(mockController.TYPE);
        expect(mockController.environment.STATE).toBe(mockController.STATE);
        expect(mockController.physics.TYPE).toBe(mockController.TYPE);
        expect(mockController.physics.STATE).toBe(mockController.STATE);
        expect(mockController.biology.TYPE).toBe(mockController.TYPE);
        expect(mockController.biology.STATE).toBe(mockController.STATE);
        expect(mockController.rendering.TYPE).toBe(mockController.TYPE);
        expect(mockController.rendering.STATE).toBe(mockController.STATE);
        expect(mockController.userInteraction.TYPE).toBe(mockController.TYPE);
        expect(mockController.userInteraction.STATE).toBe(mockController.STATE);
        
        // Verify ColorMapper was updated
        expect(global.ColorMapper.TYPE).toBe(mockController.TYPE);
        expect(global.ColorMapper.STATE).toBe(mockController.STATE);
        expect(global.ColorMapper.core).toBe(mockController.core);
        
        // Verify propagateConstants was called on appropriate systems
        expect(mockController.biology.propagateConstants).toHaveBeenCalled();
        expect(mockController.userInteraction.propagateConstants).toHaveBeenCalled();
        
        expect(result).toBe(true);
    });
    
    // Test error handling
    test('initialization fails if core simulation fails', () => {
        const manager = SystemManager.init(mockController);
        
        // Mock CoreSimulation.init to return null
        CoreSimulation.init.mockReturnValue(null);
        
        const result = manager.initializeSystems('test-canvas');
        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith('Failed to initialize core simulation.');
    });
    
    // Test error handling for missing TYPE/STATE
    test('constant propagation fails if TYPE/STATE not initialized', () => {
        const manager = SystemManager.init(mockController);
        
        // Remove TYPE and STATE from controller
        delete mockController.TYPE;
        delete mockController.STATE;
        
        const result = manager.propagateConstants();
        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith('TYPE and STATE not initialized in controller');
    });
}); 