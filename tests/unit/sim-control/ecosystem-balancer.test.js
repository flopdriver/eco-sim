// Ecosystem Balancer Tests
describe('EcosystemBalancer', () => {
    let mockController;
    let EcosystemBalancer;
    
    beforeEach(() => {
        // Reset modules
        jest.resetModules();
        
        // Mock console
        global.console = { log: jest.fn() };
        
        // Mock controller with required systems
        mockController = {
            biology: {
                metabolism: 1.0,
                growthRate: 1.0,
                reproduction: 1.0
            },
            environment: {
                temperature: 128, // Middle of range (0-255)
                dayNightCycle: 64, // Middle of range (0-255)
                rainProbability: 0.5
            }
        };
        
        // Load the EcosystemBalancer module
        EcosystemBalancer = require('../../../js/sim-control/ecosystem-balancer.js');
    });
    
    // Test initialization
    test('initialization sets controller reference and default rates', () => {
        const balancer = EcosystemBalancer.init(mockController);
        expect(balancer.controller).toBe(mockController);
        
        // Verify default rates
        expect(mockController.biology.metabolism).toBe(1.0);
        expect(mockController.biology.growthRate).toBe(1.0);
        expect(mockController.biology.reproduction).toBe(1.0);
    });
    
    // Test environmental connections initialization
    test('initializeEnvironmentalConnections sets up base rates', () => {
        const balancer = EcosystemBalancer.init(mockController);
        balancer.initializeEnvironmentalConnections();
        
        // Verify base rates are set
        expect(mockController.biology.metabolism).toBe(1.0);
        expect(mockController.biology.growthRate).toBe(1.0);
        expect(mockController.biology.reproduction).toBe(1.0);
    });
    
    // Test temperature effects
    test('biological rates adjust based on temperature', () => {
        const balancer = EcosystemBalancer.init(mockController);
        
        // Test cold temperature
        mockController.environment.temperature = 32; // Very cold
        balancer.updateBiologicalRates();
        expect(mockController.biology.metabolism).toBeLessThan(1.0);
        
        // Test optimal temperature
        mockController.environment.temperature = 128; // Optimal
        balancer.updateBiologicalRates();
        expect(mockController.biology.metabolism).toBeCloseTo(1.0);
        
        // Test hot temperature
        mockController.environment.temperature = 224; // Very hot
        balancer.updateBiologicalRates();
        expect(mockController.biology.metabolism).toBeGreaterThan(1.0);
    });
    
    // Test day/night cycle effects
    test('biological rates adjust based on day/night cycle', () => {
        const balancer = EcosystemBalancer.init(mockController);
        
        // Test daytime
        mockController.environment.dayNightCycle = 64; // Middle of day
        balancer.updateBiologicalRates();
        const daytimeGrowth = mockController.biology.growthRate;
        
        // Test nighttime
        mockController.environment.dayNightCycle = 192; // Middle of night
        balancer.updateBiologicalRates();
        const nighttimeGrowth = mockController.biology.growthRate;
        
        expect(daytimeGrowth).toBeGreaterThan(nighttimeGrowth);
    });
    
    // Test rain probability effects
    test('biological rates adjust based on rain probability', () => {
        const balancer = EcosystemBalancer.init(mockController);
        
        // Test dry conditions
        mockController.environment.rainProbability = 0.1;
        balancer.updateBiologicalRates();
        const dryGrowth = mockController.biology.growthRate;
        const dryReproduction = mockController.biology.reproduction;
        
        // Test wet conditions
        mockController.environment.rainProbability = 0.9;
        balancer.updateBiologicalRates();
        const wetGrowth = mockController.biology.growthRate;
        const wetReproduction = mockController.biology.reproduction;
        
        expect(wetGrowth).toBeGreaterThan(dryGrowth);
        expect(wetReproduction).toBeGreaterThan(dryReproduction);
    });
    
    // Test environmental influence settings
    test('environmental influence settings affect rate adjustments', () => {
        const balancer = EcosystemBalancer.init(mockController);
        
        // Test with default influence settings
        mockController.environment.temperature = 224; // Very hot
        balancer.updateBiologicalRates();
        const defaultMetabolism = mockController.biology.metabolism;
        
        // Test with modified influence settings
        balancer.environmentalInfluence.temperatureEffect = 2.0;
        balancer.updateBiologicalRates();
        const modifiedMetabolism = mockController.biology.metabolism;
        
        expect(modifiedMetabolism).toBeGreaterThan(defaultMetabolism);
    });
    
    // Test combined environmental effects
    test('biological rates reflect combined environmental conditions', () => {
        const balancer = EcosystemBalancer.init(mockController);
        
        // Set optimal conditions
        mockController.environment.temperature = 128;
        mockController.environment.dayNightCycle = 64;
        mockController.environment.rainProbability = 0.5;
        balancer.updateBiologicalRates();
        const optimalGrowth = mockController.biology.growthRate;
        
        // Set poor conditions
        mockController.environment.temperature = 32;
        mockController.environment.dayNightCycle = 192;
        mockController.environment.rainProbability = 0.1;
        balancer.updateBiologicalRates();
        const poorGrowth = mockController.biology.growthRate;
        
        expect(optimalGrowth).toBeGreaterThan(poorGrowth);
    });
    
    // Test edge cases
    test('handles extreme environmental conditions gracefully', () => {
        const balancer = EcosystemBalancer.init(mockController);
        
        // Test extreme cold
        mockController.environment.temperature = 0;
        balancer.updateBiologicalRates();
        expect(mockController.biology.metabolism).toBeGreaterThan(0);
        
        // Test extreme heat
        mockController.environment.temperature = 255;
        balancer.updateBiologicalRates();
        expect(mockController.biology.metabolism).toBeGreaterThan(0);
        
        // Test no rain
        mockController.environment.rainProbability = 0;
        balancer.updateBiologicalRates();
        expect(mockController.biology.growthRate).toBeGreaterThan(0);
        
        // Test constant rain
        mockController.environment.rainProbability = 1;
        balancer.updateBiologicalRates();
        expect(mockController.biology.growthRate).toBeGreaterThan(0);
    });
}); 