// WebGL Renderer Core Tests

describe('WebGLRendererCore', () => {
  let WebGLRendererCore;
  let mockCore;
  let mockCanvas;
  let mockWebGLContext;
  
  beforeEach(() => {
    // Reset modules for each test
    jest.resetModules();
    
    // Mock console
    global.console = { log: jest.fn(), error: jest.fn() };
    
    // Load mock WebGL context
    const mocks = require('../../mock');
    mockWebGLContext = mocks.mockWebGLContext;
    
    // Setup mock canvas element
    mockCanvas = {
      width: 400,
      height: 300,
      style: {},
      getContext: jest.fn(() => mockWebGLContext)
    };
    
    // Mock document.getElementById to return our mock canvas
    document.getElementById = jest.fn(() => mockCanvas);
    
    // Setup mock core simulation
    mockCore = {
      width: 100,
      height: 80,
      pixelSize: 1,
      size: 8000,
      type: new Uint8Array(8000),
      state: new Uint8Array(8000),
      water: new Uint8Array(8000),
      energy: new Uint8Array(8000),
      nutrient: new Uint8Array(8000)
    };
    
    // Mock dependencies
    global.WebGLUtils = {
      getContext: jest.fn(() => mockWebGLContext),
      createShader: jest.fn(() => ({})),
      createProgram: jest.fn(() => ({}))
    };
    
    global.ShaderManager = {
      init: jest.fn(() => true),
      program: {},
      positionLocation: 0,
      texCoordLocation: 1
    };
    
    global.ColorMapper = {
      getPixelColor: jest.fn(() => ({ r: 100, g: 150, b: 200 }))
    };
    
    // Load the module under test
    // Since the module uses window.WebGLRendererCore, we need to manually set it
    require('../../../js/rendering/webgl-renderer-core.js');
    WebGLRendererCore = window.WebGLRendererCore;
  });
  
  test('init() should initialize WebGL renderer with correct dimensions', () => {
    // Call init function with our mock core and canvas ID
    const renderer = WebGLRendererCore.init(mockCore, 'simulation-canvas');
    
    // Verify document.getElementById was called with correct ID
    expect(document.getElementById).toHaveBeenCalledWith('simulation-canvas');
    
    // Verify canvas dimensions were set correctly
    expect(mockCanvas.width).toBe(100); // Core width * pixelSize
    expect(mockCanvas.height).toBe(80); // Core height * pixelSize
    
    // Verify core reference was stored
    expect(renderer.core).toBe(mockCore);
    
    // Verify WebGLUtils.getContext was called
    expect(WebGLUtils.getContext).toHaveBeenCalledWith(mockCanvas);
    
    // Verify ShaderManager.init was called
    expect(ShaderManager.init).toHaveBeenCalledWith(mockWebGLContext);
    
    // Verify buffers and texture were created
    expect(mockWebGLContext.createBuffer).toHaveBeenCalled();
    expect(mockWebGLContext.createTexture).toHaveBeenCalled();
    
    // Verify viewport was set
    expect(mockWebGLContext.viewport).toHaveBeenCalledWith(0, 0, mockCanvas.width, mockCanvas.height);
  });
  
  test('setupBuffers() should create position and texture coordinate buffers', () => {
    // Initialize first
    WebGLRendererCore.init(mockCore, 'simulation-canvas');
    
    // Clear the mock to reset call count
    mockWebGLContext.createBuffer.mockClear();
    mockWebGLContext.bindBuffer.mockClear();
    mockWebGLContext.bufferData.mockClear();
    
    // Call setupBuffers
    WebGLRendererCore.setupBuffers();
    
    // Verify buffer creation
    expect(mockWebGLContext.createBuffer).toHaveBeenCalledTimes(2); // Position and texCoord buffers
    expect(mockWebGLContext.bindBuffer).toHaveBeenCalledTimes(2);
    expect(mockWebGLContext.bufferData).toHaveBeenCalledTimes(2);
  });
  
  test('setupTexture() should initialize texture with correct parameters', () => {
    // Initialize first
    WebGLRendererCore.init(mockCore, 'simulation-canvas');
    
    // Clear the mock to reset call count
    mockWebGLContext.createTexture.mockClear();
    mockWebGLContext.bindTexture.mockClear();
    mockWebGLContext.texParameteri.mockClear();
    mockWebGLContext.texImage2D.mockClear();
    
    // Call setupTexture
    WebGLRendererCore.setupTexture();
    
    // Verify texture creation
    expect(mockWebGLContext.createTexture).toHaveBeenCalledTimes(1);
    expect(mockWebGLContext.bindTexture).toHaveBeenCalledTimes(1);
    expect(mockWebGLContext.texParameteri).toHaveBeenCalledTimes(4); // Four texture params
    
    // Verify texImage2D was called with correct dimensions
    expect(mockWebGLContext.texImage2D).toHaveBeenCalledWith(
      mockWebGLContext.TEXTURE_2D,
      0,
      mockWebGLContext.RGBA,
      mockCore.width,
      mockCore.height,
      0,
      mockWebGLContext.RGBA,
      mockWebGLContext.UNSIGNED_BYTE,
      null
    );
  });
  
  test('updateTexture() should update texture data based on simulation state', () => {
    // Initialize first
    WebGLRendererCore.init(mockCore, 'simulation-canvas');
    
    // Clear the mock to reset call count
    mockWebGLContext.bindTexture.mockClear();
    mockWebGLContext.texImage2D.mockClear();
    
    // Call updateTexture
    WebGLRendererCore.updateTexture();
    
    // Verify ColorMapper.getPixelColor was called for each pixel
    expect(ColorMapper.getPixelColor).toHaveBeenCalledTimes(mockCore.width * mockCore.height);
    
    // Verify textureData was updated
    expect(WebGLRendererCore.textureData).toBeDefined();
    expect(WebGLRendererCore.textureData.length).toBe(mockCore.width * mockCore.height * 4);
    
    // Verify texture was bound and updated
    expect(mockWebGLContext.bindTexture).toHaveBeenCalledWith(mockWebGLContext.TEXTURE_2D, WebGLRendererCore.texture);
    expect(mockWebGLContext.texImage2D).toHaveBeenCalledWith(
      mockWebGLContext.TEXTURE_2D,
      0,
      mockWebGLContext.RGBA,
      mockCore.width,
      mockCore.height,
      0,
      mockWebGLContext.RGBA,
      mockWebGLContext.UNSIGNED_BYTE,
      WebGLRendererCore.textureData
    );
  });
  
  test('render() should update texture and draw the scene', () => {
    // Initialize first
    WebGLRendererCore.init(mockCore, 'simulation-canvas');
    
    // Create spies for methods called by render
    const updateTextureSpy = jest.spyOn(WebGLRendererCore, 'updateTexture');
    
    // Clear mocks
    mockWebGLContext.useProgram.mockClear();
    mockWebGLContext.bindBuffer.mockClear();
    mockWebGLContext.enableVertexAttribArray.mockClear();
    mockWebGLContext.vertexAttribPointer.mockClear();
    mockWebGLContext.drawArrays.mockClear();
    mockWebGLContext.clearColor.mockClear();
    mockWebGLContext.clear.mockClear();
    
    // Call render
    WebGLRendererCore.render();
    
    // Verify updateTexture was called
    expect(updateTextureSpy).toHaveBeenCalledTimes(1);
    
    // Verify clear calls
    expect(mockWebGLContext.clearColor).toHaveBeenCalled();
    expect(mockWebGLContext.clear).toHaveBeenCalledWith(mockWebGLContext.COLOR_BUFFER_BIT);
    
    // Verify program usage
    expect(mockWebGLContext.useProgram).toHaveBeenCalledWith(ShaderManager.program);
    
    // Verify buffer binding and attribute setting
    expect(mockWebGLContext.bindBuffer).toHaveBeenCalledTimes(3); // Called three times in total
    expect(mockWebGLContext.enableVertexAttribArray).toHaveBeenCalledTimes(2);
    expect(mockWebGLContext.vertexAttribPointer).toHaveBeenCalledTimes(2);
    
    // Verify draw call
    expect(mockWebGLContext.drawArrays).toHaveBeenCalledWith(mockWebGLContext.TRIANGLE_STRIP, 0, 4);
  });
  
  test('setZoom() should update zoom level and pan offset', () => {
    // Initialize first
    WebGLRendererCore.init(mockCore, 'simulation-canvas');
    
    // Create spy for render method
    const renderSpy = jest.spyOn(WebGLRendererCore, 'render').mockImplementation(() => {});
    
    // Call setZoom with test values
    WebGLRendererCore.setZoom(2.5, 10, 15);
    
    // Verify zoom and pan values were updated
    expect(WebGLRendererCore.zoomLevel).toBe(2.5);
    expect(WebGLRendererCore.panX).toBe(10);
    expect(WebGLRendererCore.panY).toBe(15);
    
    // Verify render was called
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
  
  test('updateTextureCoordinates() should update texture coordinates based on zoom and pan', () => {
    // Initialize first
    WebGLRendererCore.init(mockCore, 'simulation-canvas');
    
    // Setup zoom and pan
    WebGLRendererCore.zoomLevel = 2.0;
    WebGLRendererCore.panX = 10;
    WebGLRendererCore.panY = 20;
    
    // Clear mocks
    mockWebGLContext.bindBuffer.mockClear();
    mockWebGLContext.bufferData.mockClear();
    
    // Call updateTextureCoordinates
    WebGLRendererCore.updateTextureCoordinates();
    
    // Verify buffer was updated
    expect(mockWebGLContext.bindBuffer).toHaveBeenCalledWith(mockWebGLContext.ARRAY_BUFFER, WebGLRendererCore.texCoordBuffer);
    expect(mockWebGLContext.bufferData).toHaveBeenCalledTimes(1);
  });
  
  test('resize() should update canvas dimensions and viewport', () => {
    // Initialize first
    WebGLRendererCore.init(mockCore, 'simulation-canvas');
    
    // Create spy for render method
    const renderSpy = jest.spyOn(WebGLRendererCore, 'render').mockImplementation(() => {});
    
    // Mock window.devicePixelRatio
    window.devicePixelRatio = 2;
    
    // Call resize with test dimensions
    WebGLRendererCore.resize(320, 240);
    
    // Verify canvas dimensions were updated with pixel ratio
    expect(mockCanvas.width).toBe(640); // 320 * 2
    expect(mockCanvas.height).toBe(480); // 240 * 2
    
    // Verify viewport was updated
    expect(mockWebGLContext.viewport).toHaveBeenCalledWith(0, 0, 640, 480);
    
    // Verify render was called
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});