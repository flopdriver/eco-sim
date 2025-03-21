// WebGL Renderer Interface Tests

describe('WebGLRenderingSystem', () => {
  let WebGLRenderingSystem;
  let mockCore;
  
  beforeEach(() => {
    // Reset modules for each test
    jest.resetModules();
    
    // Mock console
    global.console = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
    
    // Setup mock core simulation
    mockCore = {
      width: 100,
      height: 80,
      pixelSize: 1,
      TYPE: {
        AIR: 0,
        WATER: 1,
        SOIL: 2,
        PLANT: 3
      },
      STATE: {
        DEFAULT: 0,
        WET: 1,
        DRY: 2,
        ROOT: 10,
        STEM: 11
      }
    };
    
    // Mock dependencies
    global.VisualizationManager = {
      init: jest.fn(() => ({
        setMode: jest.fn(),
        getMode: jest.fn(() => 'normal'),
        getModeDescription: jest.fn(() => 'Normal view: showing natural appearance of all elements')
      })),
      setMode: jest.fn(),
      getMode: jest.fn(() => 'normal'),
      getModeDescription: jest.fn(() => 'Normal view: showing natural appearance of all elements')
    };
    
    global.ColorMapper = {
      init: jest.fn(() => ({
        setWeatherSystem: jest.fn()
      })),
      setWeatherSystem: jest.fn()
    };
    
    global.WebGLRendererCore = {
      init: jest.fn(() => ({
        render: jest.fn(),
        resize: jest.fn(),
        setScaleFactor: jest.fn(),
        canvas: document.createElement('canvas')
      })),
      render: jest.fn(),
      resize: jest.fn(),
      setScaleFactor: jest.fn()
    };
    
    global.ZoomController = {
      init: jest.fn(() => ({
        setZoom: jest.fn(),
        zoomIn: jest.fn(),
        zoomOut: jest.fn()
      })),
      setZoom: jest.fn(),
      zoomIn: jest.fn(),
      zoomOut: jest.fn()
    };
    
    // Load the module under test
    require('../../../js/rendering/webgl-renderer-interface.js');
    WebGLRenderingSystem = window.WebGLRenderingSystem;
  });
  
  test('init() should initialize all rendering subsystems in the correct order', () => {
    // Call init function with our mock core and canvas ID
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    
    // Verify TYPE and STATE enums were stored
    expect(renderingSystem.TYPE).toBe(mockCore.TYPE);
    expect(renderingSystem.STATE).toBe(mockCore.STATE);
    
    // Verify subsystems were initialized in the correct order
    // 1. VisualizationManager should be initialized first (no dependencies)
    expect(VisualizationManager.init).toHaveBeenCalled();
    expect(renderingSystem.visualizationManager).toBeTruthy();
    
    // 2. ColorMapper should be initialized next (depends on core and enums)
    expect(ColorMapper.init).toHaveBeenCalledWith(mockCore, renderingSystem.TYPE, renderingSystem.STATE);
    expect(renderingSystem.colorMapper).toBeTruthy();
    
    // 3. WebGLRendererCore should be initialized next (depends on other subsystems)
    expect(WebGLRendererCore.init).toHaveBeenCalledWith(mockCore, 'simulation-canvas');
    expect(renderingSystem.rendererCore).toBeTruthy();
    
    // 4. ZoomController should be initialized last (depends on renderer core)
    expect(ZoomController.init).toHaveBeenCalledWith(renderingSystem);
    expect(renderingSystem.zoomController).toBeTruthy();
    
    // Verify canvas reference was stored
    expect(renderingSystem.canvas).toBeDefined();
  });
  
  test('init() should handle visualization manager initialization failure', () => {
    // Mock initialization failure
    VisualizationManager.init.mockReturnValue(null);
    
    // Call init function
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    
    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith('Failed to initialize visualization manager');
    
    // Verify null is returned
    expect(renderingSystem).toBeNull();
    
    // Verify subsequent initialization steps were not performed
    expect(ColorMapper.init).not.toHaveBeenCalled();
    expect(WebGLRendererCore.init).not.toHaveBeenCalled();
    expect(ZoomController.init).not.toHaveBeenCalled();
  });
  
  test('init() should handle color mapper initialization failure', () => {
    // Mock initialization failure
    ColorMapper.init.mockReturnValue(null);
    
    // Call init function
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    
    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith('Failed to initialize color mapper');
    
    // Verify null is returned
    expect(renderingSystem).toBeNull();
    
    // Verify subsequent initialization steps were not performed
    expect(WebGLRendererCore.init).not.toHaveBeenCalled();
    expect(ZoomController.init).not.toHaveBeenCalled();
  });
  
  test('init() should handle renderer core initialization failure', () => {
    // Mock initialization failure
    WebGLRendererCore.init.mockReturnValue(null);
    
    // Call init function
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    
    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith('Failed to initialize WebGL renderer core');
    
    // Verify null is returned
    expect(renderingSystem).toBeNull();
    
    // Verify subsequent initialization steps were not performed
    expect(ZoomController.init).not.toHaveBeenCalled();
  });
  
  test('init() should continue even if zoom controller initialization fails', () => {
    // Mock initialization failure
    ZoomController.init.mockReturnValue(null);
    
    // Call init function
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    
    // Verify warning was logged
    expect(console.error).toHaveBeenCalledWith('Failed to initialize zoom controller');
    
    // Verify the system still initialized successfully
    expect(renderingSystem).toBeTruthy();
  });
  
  test('setVisualizationMode() should delegate to visualization manager', () => {
    // Initialize first
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    
    // Mock visualization manager's setMode
    renderingSystem.visualizationManager.setMode = jest.fn(() => true);
    
    // Call setVisualizationMode
    const result = renderingSystem.setVisualizationMode('moisture');
    
    // Verify visualization manager's setMode was called with correct mode
    expect(renderingSystem.visualizationManager.setMode).toHaveBeenCalledWith('moisture');
    
    // Verify result is passed through
    expect(result).toBe(true);
  });
  
  test('getVisualizationMode() should delegate to visualization manager', () => {
    // Initialize first
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    
    // Mock visualization manager's getMode
    renderingSystem.visualizationManager.getMode = jest.fn(() => 'energy');
    
    // Call getVisualizationMode
    const result = renderingSystem.getVisualizationMode();
    
    // Verify visualization manager's getMode was called
    expect(renderingSystem.visualizationManager.getMode).toHaveBeenCalled();
    
    // Verify result is passed through
    expect(result).toBe('energy');
  });
  
  test('getVisualizationDescription() should delegate to visualization manager', () => {
    // Initialize first
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    
    // Mock visualization manager's getModeDescription
    renderingSystem.visualizationManager.getModeDescription = jest.fn(() => 'Test description');
    
    // Call getVisualizationDescription
    const result = renderingSystem.getVisualizationDescription();
    
    // Verify visualization manager's getModeDescription was called
    expect(renderingSystem.visualizationManager.getModeDescription).toHaveBeenCalled();
    
    // Verify result is passed through
    expect(result).toBe('Test description');
  });
  
  test('render() should delegate to renderer core', () => {
    // Initialize first
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    
    // Mock renderer core's render
    renderingSystem.rendererCore.render = jest.fn(() => true);
    
    // Call render
    const result = renderingSystem.render();
    
    // Verify renderer core's render was called
    expect(renderingSystem.rendererCore.render).toHaveBeenCalled();
    
    // Verify result is passed through
    expect(result).toBe(true);
  });
  
  test('resize() should delegate to renderer core', () => {
    // Initialize first
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    
    // Mock renderer core's resize
    renderingSystem.rendererCore.resize = jest.fn(() => true);
    
    // Call resize
    const result = renderingSystem.resize(800, 600);
    
    // Verify renderer core's resize was called with correct dimensions
    expect(renderingSystem.rendererCore.resize).toHaveBeenCalledWith(800, 600);
    
    // Verify result is passed through
    expect(result).toBe(true);
  });
  
  test('updateScaleFactor() should handle uninitialized renderer core', () => {
    // Initialize first, but without renderer core
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    renderingSystem.rendererCore = null;
    
    // Call updateScaleFactor
    const result = renderingSystem.updateScaleFactor(800, 600);
    
    // Verify warning was logged
    expect(console.warn).toHaveBeenCalledWith('Renderer core not initialized yet');
    
    // Verify default scale factor is returned
    expect(result).toBe(1.0);
  });
  
  test('updateScaleFactor() should calculate and apply optimal scale factor', () => {
    // Initialize first
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    
    // Set up mock renderer core with base dimensions
    renderingSystem.rendererCore.baseWidth = 400;
    renderingSystem.rendererCore.baseHeight = 300;
    renderingSystem.rendererCore.setScaleFactor = jest.fn();
    
    // Call updateScaleFactor with dimensions that make width the constraint
    const result1 = renderingSystem.updateScaleFactor(800, 900);
    
    // Verify scale factor was calculated correctly (width-constrained: 800/400 = 2.0)
    expect(result1).toBe(2.0);
    expect(renderingSystem.rendererCore.setScaleFactor).toHaveBeenCalledWith(2.0);
    
    // Call updateScaleFactor with dimensions that make height the constraint
    const result2 = renderingSystem.updateScaleFactor(1000, 450);
    
    // Verify scale factor was calculated correctly (height-constrained: 450/300 = 1.5)
    expect(result2).toBe(1.5);
    expect(renderingSystem.rendererCore.setScaleFactor).toHaveBeenCalledWith(1.5);
  });
  
  test('updateScaleFactor() should handle missing base dimensions', () => {
    // Initialize first
    const renderingSystem = WebGLRenderingSystem.init(mockCore, 'simulation-canvas');
    
    // Set up renderer core without base dimensions
    renderingSystem.rendererCore.baseWidth = null;
    renderingSystem.rendererCore.baseHeight = null;
    renderingSystem.rendererCore.setScaleFactor = jest.fn();
    
    // Call updateScaleFactor
    const result = renderingSystem.updateScaleFactor(800, 600);
    
    // Verify default dimensions were used
    expect(renderingSystem.rendererCore.baseWidth).toBe(400);
    expect(renderingSystem.rendererCore.baseHeight).toBe(300);
    
    // Verify scale factor was calculated and applied
    expect(renderingSystem.rendererCore.setScaleFactor).toHaveBeenCalled();
    expect(result).toBe(2.0); // 800/400 = 2.0
  });
});