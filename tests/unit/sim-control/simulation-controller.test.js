// Simulation Controller Tests
describe('SimulationController', () => {
    let mockCore;
    let mockEnvironment;
    let mockPhysics;
    let mockBiology;
    let mockRendering;
    let mockUserInteraction;
    let SimulationController;

    beforeEach(() => {
        // Reset modules
        jest.resetModules();
        
        // Mock console
        global.console = { log: jest.fn() };
        
        // Mock WebGLUtils
        global.WebGLUtils = {
            isWebGLSupported: jest.fn().mockReturnValue(true)
        };
        
        // Mock core simulation
        mockCore = {
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
        };
        
        // Mock environment controller
        mockEnvironment = {
            init: jest.fn().mockReturnThis(),
            update: jest.fn(),
            TYPE: {},
            STATE: {}
        };
        
        // Mock physics system
        mockPhysics = {
            init: jest.fn().mockReturnThis(),
            update: jest.fn(),
            TYPE: {},
            STATE: {}
        };
        
        // Mock biology system
        mockBiology = {
            init: jest.fn().mockReturnThis(),
            update: jest.fn(),
            TYPE: {},
            STATE: {},
            propagateConstants: jest.fn()
        };
        
        // Mock rendering system
        mockRendering = {
            init: jest.fn().mockReturnThis(),
            render: jest.fn(),
            TYPE: {},
            STATE: {}
        };
        
        // Mock user interaction system
        mockUserInteraction = {
            init: jest.fn().mockReturnThis(),
            TYPE: {},
            STATE: {},
            propagateConstants: jest.fn()
        };
        
        // Mock system manager
        const SystemManager = {
            init: jest.fn().mockReturnThis(),
            initializeSystems: jest.fn().mockReturnValue(true),
            propagateConstants: jest.fn().mockReturnValue(true)
        };
        
        // Mock environment initializer
        const EnvironmentInitializer = {
            init: jest.fn().mockReturnThis(),
            initializeEnvironment: jest.fn()
        };
        
        // Mock performance manager
        const PerformanceManager = {
            init: jest.fn().mockReturnThis(),
            startFrame: jest.fn(),
            endFrame: jest.fn(),
            manageActivePixels: jest.fn(),
            resetTiming: jest.fn()
        };
        
        // Mock UI manager
        const UIManager = {
            init: jest.fn().mockReturnThis(),
            setupUI: jest.fn(),
            updateStats: jest.fn()
        };
        
        // Mock ecosystem balancer
        const EcosystemBalancer = {
            init: jest.fn().mockReturnThis(),
            initializeEnvironmentalConnections: jest.fn(),
            updateBiologicalRates: jest.fn()
        };
        
        // Mock requestAnimationFrame
        global.requestAnimationFrame = jest.fn(callback => setTimeout(callback, 0));
        
        // Load the SimulationController module
        SimulationController = require('../../../js/sim-control/simulation-controller.js');
    });

    // Test initialization
    test('initialization sets up all required systems and managers', () => {
        const simulation = SimulationController.init('test-canvas');
        
        expect(simulation).toBeDefined();
        expect(simulation.core).toBeDefined();
        expect(simulation.environment).toBeDefined();
        expect(simulation.physics).toBeDefined();
        expect(simulation.biology).toBeDefined();
        expect(simulation.rendering).toBeDefined();
        expect(simulation.userInteraction).toBeDefined();
        expect(simulation.systemManager).toBeDefined();
        expect(simulation.environmentInitializer).toBeDefined();
        expect(simulation.performanceManager).toBeDefined();
        expect(simulation.uiManager).toBeDefined();
        expect(simulation.ecosystemBalancer).toBeDefined();
    });

    // Test simulation state management
    test('simulation state can be started, stopped, and toggled', () => {
        const simulation = SimulationController.init('test-canvas');
        
        // Test starting simulation
        simulation.start();
        expect(simulation.running).toBe(true);
        
        // Test stopping simulation
        simulation.stop();
        expect(simulation.running).toBe(false);
        
        // Test toggling simulation
        simulation.togglePause();
        expect(simulation.running).toBe(true);
        simulation.togglePause();
        expect(simulation.running).toBe(false);
    });

    // Test simulation reset
    test('reset clears all arrays and reinitializes environment', () => {
        const simulation = SimulationController.init('test-canvas');
        
        // Fill arrays with test data
        simulation.core.type.fill(1);
        simulation.core.state.fill(2);
        simulation.core.water.fill(3);
        simulation.core.nutrient.fill(4);
        simulation.core.energy.fill(5);
        simulation.core.metadata.fill(6);
        
        // Reset simulation
        simulation.reset();
        
        // Verify arrays are cleared
        expect(simulation.core.type.every(val => val === 0)).toBe(true);
        expect(simulation.core.state.every(val => val === 0)).toBe(true);
        expect(simulation.core.water.every(val => val === 0)).toBe(true);
        expect(simulation.core.nutrient.every(val => val === 0)).toBe(true);
        expect(simulation.core.energy.every(val => val === 0)).toBe(true);
        expect(simulation.core.metadata.every(val => val === 0)).toBe(true);
        
        // Verify environment is reinitialized
        expect(simulation.environmentInitializer.initializeEnvironment).toHaveBeenCalled();
    });

    // Test simulation update loop
    test('update loop processes all systems in correct order', () => {
        const simulation = SimulationController.init('test-canvas');
        simulation.running = true;
        
        // Mock active pixels
        simulation.activePixels = new Set([1, 2, 3]);
        
        // Run one update cycle
        simulation.update();
        
        // Verify systems were updated in correct order
        expect(simulation.environment.update).toHaveBeenCalledWith(
            simulation.activePixels,
            expect.any(Set)
        );
        expect(simulation.physics.update).toHaveBeenCalledWith(
            simulation.activePixels,
            expect.any(Set)
        );
        expect(simulation.biology.update).toHaveBeenCalledWith(
            simulation.activePixels,
            expect.any(Set)
        );
        
        // Verify performance tracking
        expect(simulation.performanceManager.startFrame).toHaveBeenCalled();
        expect(simulation.performanceManager.endFrame).toHaveBeenCalled();
        
        // Verify UI updates
        expect(simulation.uiManager.updateStats).toHaveBeenCalled();
        expect(simulation.rendering.render).toHaveBeenCalled();
    });

    // Test simulation speed control
    test('simulation speed affects number of update cycles', () => {
        const simulation = SimulationController.init('test-canvas');
        simulation.running = true;
        simulation.simulationSpeed = 3;
        
        // Mock active pixels
        simulation.activePixels = new Set([1, 2, 3]);
        
        // Run one update cycle
        simulation.update();
        
        // Verify each system was updated 3 times
        expect(simulation.environment.update).toHaveBeenCalledTimes(3);
        expect(simulation.physics.update).toHaveBeenCalledTimes(3);
        expect(simulation.biology.update).toHaveBeenCalledTimes(3);
    });

    // Test ecosystem balancing
    test('ecosystem balancer updates biological rates periodically', () => {
        const simulation = SimulationController.init('test-canvas');
        simulation.running = true;
        
        // Mock Math.random to control when balancing occurs
        jest.spyOn(Math, 'random').mockReturnValue(0.01); // 1% chance
        
        // Run multiple updates
        for (let i = 0; i < 10; i++) {
            simulation.update();
        }
        
        // Verify ecosystem balancer was called at least once
        expect(simulation.ecosystemBalancer.updateBiologicalRates).toHaveBeenCalled();
    });

    // Test WebGL support check
    test('initialization fails if WebGL is not supported', () => {
        // Mock WebGLUtils to return false
        global.WebGLUtils.isWebGLSupported.mockReturnValue(false);
        
        const simulation = SimulationController.init('test-canvas');
        expect(simulation).toBeNull();
    });
}); 