// Shader Manager Tests

describe('ShaderManager', () => {
  let ShaderManager;
  let mockWebGLContext;
  
  beforeEach(() => {
    // Reset modules for each test
    jest.resetModules();
    
    // Mock console
    global.console = { log: jest.fn(), error: jest.fn() };
    
    // Create a mock WebGL context
    mockWebGLContext = {
      createShader: jest.fn(() => ({})),
      shaderSource: jest.fn(),
      compileShader: jest.fn(),
      getShaderParameter: jest.fn(() => true),
      getShaderInfoLog: jest.fn(() => ''),
      deleteShader: jest.fn(),
      createProgram: jest.fn(() => ({})),
      attachShader: jest.fn(),
      linkProgram: jest.fn(),
      getProgramParameter: jest.fn(() => true),
      getProgramInfoLog: jest.fn(() => ''),
      getAttribLocation: jest.fn((program, name) => {
        // Simple mock implementation that returns different values for different attributes
        if (name === 'a_position') return 0;
        if (name === 'a_texCoord') return 1;
        return -1;
      }),
      VERTEX_SHADER: 'VERTEX_SHADER',
      FRAGMENT_SHADER: 'FRAGMENT_SHADER',
      COMPILE_STATUS: 'COMPILE_STATUS',
      LINK_STATUS: 'LINK_STATUS'
    };
    
    // Mock WebGLUtils
    global.WebGLUtils = {
      createShader: jest.fn((gl, type, source) => {
        gl.createShader(type);
        gl.shaderSource(undefined, source);
        gl.compileShader(undefined);
        if (gl.getShaderParameter(undefined, gl.COMPILE_STATUS)) {
          return {}; // Return a mock shader
        }
        return null;
      }),
      createProgram: jest.fn((gl, vertexShader, fragmentShader) => {
        gl.createProgram();
        gl.attachShader(undefined, vertexShader);
        gl.attachShader(undefined, fragmentShader);
        gl.linkProgram(undefined);
        if (gl.getProgramParameter(undefined, gl.LINK_STATUS)) {
          return {}; // Return a mock program
        }
        return null;
      })
    };
    
    // Load the module under test
    require('../../../js/rendering/shader-manager.js');
    ShaderManager = window.ShaderManager;
  });
  
  test('init() should initialize shader manager with WebGL context', () => {
    // Call init with mock context
    const result = ShaderManager.init(mockWebGLContext);
    
    // Verify context was stored
    expect(ShaderManager.gl).toBe(mockWebGLContext);
    
    // Verify setupShaders was called successfully
    expect(result).toBe(true);
  });
  
  test('setupShaders() should create and compile shaders', () => {
    // Setup manager with mock context
    ShaderManager.gl = mockWebGLContext;
    
    // Call setupShaders
    const result = ShaderManager.setupShaders();
    
    // Verify WebGLUtils.createShader was called twice (vertex and fragment)
    expect(WebGLUtils.createShader).toHaveBeenCalledTimes(2);
    
    // Verify WebGLUtils.createProgram was called
    expect(WebGLUtils.createProgram).toHaveBeenCalledTimes(1);
    
    // Verify attribute locations were retrieved
    expect(mockWebGLContext.getAttribLocation).toHaveBeenCalledTimes(2);
    expect(ShaderManager.positionLocation).toBe(0);
    expect(ShaderManager.texCoordLocation).toBe(1);
    
    // Verify success result
    expect(result).toBe(true);
  });
  
  test('setupShaders() should handle shader compilation failure', () => {
    // Setup manager with mock context
    ShaderManager.gl = mockWebGLContext;
    
    // Mock shader compilation failure
    mockWebGLContext.getShaderParameter.mockReturnValueOnce(false);
    WebGLUtils.createShader.mockReturnValueOnce(null);
    
    // Call setupShaders
    const result = ShaderManager.setupShaders();
    
    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith('Failed to create shaders');
    
    // Verify failure result
    expect(result).toBe(false);
  });
  
  test('setupShaders() should handle program creation failure', () => {
    // Setup manager with mock context
    ShaderManager.gl = mockWebGLContext;
    
    // Mock program creation failure
    mockWebGLContext.getProgramParameter.mockReturnValueOnce(false);
    WebGLUtils.createProgram.mockReturnValueOnce(null);
    
    // Call setupShaders
    const result = ShaderManager.setupShaders();
    
    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith('Unable to initialize shader program');
    
    // Verify failure result
    expect(result).toBe(false);
  });
  
  test('addShader() should delegate to WebGLUtils.createShader', () => {
    // Setup manager with mock context
    ShaderManager.gl = mockWebGLContext;
    
    // Call addShader
    const testSource = 'test shader source';
    ShaderManager.addShader(mockWebGLContext.VERTEX_SHADER, testSource);
    
    // Verify WebGLUtils.createShader was called with correct parameters
    expect(WebGLUtils.createShader).toHaveBeenCalledWith(
      mockWebGLContext,
      mockWebGLContext.VERTEX_SHADER,
      testSource
    );
  });
  
  test('createProgram() should delegate to WebGLUtils.createProgram', () => {
    // Setup manager with mock context
    ShaderManager.gl = mockWebGLContext;
    
    // Create mock shaders
    const mockVertexShader = {};
    const mockFragmentShader = {};
    
    // Call createProgram
    ShaderManager.createProgram(mockVertexShader, mockFragmentShader);
    
    // Verify WebGLUtils.createProgram was called with correct parameters
    expect(WebGLUtils.createProgram).toHaveBeenCalledWith(
      mockWebGLContext,
      mockVertexShader,
      mockFragmentShader
    );
  });
});