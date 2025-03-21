// Mock module to enable testing
// This file provides mock implementations for browser-specific globals

// Mock for window object
global.window = {
  innerWidth: 800,
  innerHeight: 600,
  addEventListener: jest.fn(),
  requestAnimationFrame: jest.fn(callback => setTimeout(callback, 0))
};

// Mock for document object
global.document = {
  createElement: jest.fn(tagName => {
    if (tagName === 'canvas') {
      return {
        getContext: jest.fn(() => ({
          clearRect: jest.fn(),
          drawImage: jest.fn(),
          fillRect: jest.fn(),
          fillText: jest.fn(),
          getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(100) })),
          putImageData: jest.fn(),
          createImageData: jest.fn(() => ({ data: new Uint8ClampedArray(100) })),
          scale: jest.fn(),
          translate: jest.fn()
        })),
        width: 400,
        height: 300,
        style: {}
      };
    }
    return {
      appendChild: jest.fn(),
      addEventListener: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn(),
        toggle: jest.fn()
      },
      style: {},
      textContent: ''
    };
  }),
  getElementById: jest.fn(id => ({
    appendChild: jest.fn(),
    getContext: jest.fn(() => ({
      clearRect: jest.fn(),
      drawImage: jest.fn(),
      fillRect: jest.fn(),
      fillText: jest.fn(),
      getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(100) })),
      putImageData: jest.fn(),
      createImageData: jest.fn(() => ({ data: new Uint8ClampedArray(100) })),
      scale: jest.fn(),
      translate: jest.fn()
    })),
    addEventListener: jest.fn(),
    width: 400,
    height: 300,
    style: {}
  })),
  querySelector: jest.fn(() => ({
    addEventListener: jest.fn(),
    appendChild: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn()
    },
    style: {},
    value: ''
  })),
  querySelectorAll: jest.fn(() => []),
  body: {
    appendChild: jest.fn(),
    style: {}
  }
};

// Mock WebGL context
const mockWebGLContext = {
  viewport: jest.fn(),
  clearColor: jest.fn(),
  clear: jest.fn(),
  createBuffer: jest.fn(() => ({})),
  bindBuffer: jest.fn(),
  bufferData: jest.fn(),
  createShader: jest.fn(() => ({})),
  shaderSource: jest.fn(),
  compileShader: jest.fn(),
  getShaderParameter: jest.fn(() => true),
  getShaderInfoLog: jest.fn(() => ''),
  createProgram: jest.fn(() => ({})),
  attachShader: jest.fn(),
  linkProgram: jest.fn(),
  getProgramParameter: jest.fn(() => true),
  getProgramInfoLog: jest.fn(() => ''),
  useProgram: jest.fn(),
  getAttribLocation: jest.fn(() => 0),
  getUniformLocation: jest.fn(() => ({})),
  enableVertexAttribArray: jest.fn(),
  vertexAttribPointer: jest.fn(),
  uniform1i: jest.fn(),
  uniform1f: jest.fn(),
  uniform2f: jest.fn(),
  uniform3f: jest.fn(),
  uniform4f: jest.fn(),
  uniformMatrix4fv: jest.fn(),
  createTexture: jest.fn(() => ({})),
  bindTexture: jest.fn(),
  texParameteri: jest.fn(),
  texImage2D: jest.fn(),
  activeTexture: jest.fn(),
  drawArrays: jest.fn(),
  drawElements: jest.fn(),
  ARRAY_BUFFER: 'ARRAY_BUFFER',
  ELEMENT_ARRAY_BUFFER: 'ELEMENT_ARRAY_BUFFER',
  STATIC_DRAW: 'STATIC_DRAW',
  DYNAMIC_DRAW: 'DYNAMIC_DRAW',
  VERTEX_SHADER: 'VERTEX_SHADER',
  FRAGMENT_SHADER: 'FRAGMENT_SHADER',
  COMPILE_STATUS: 'COMPILE_STATUS',
  LINK_STATUS: 'LINK_STATUS',
  COLOR_BUFFER_BIT: 'COLOR_BUFFER_BIT',
  DEPTH_BUFFER_BIT: 'DEPTH_BUFFER_BIT',
  TEXTURE_2D: 'TEXTURE_2D',
  TEXTURE0: 'TEXTURE0',
  TEXTURE1: 'TEXTURE1',
  TEXTURE_MIN_FILTER: 'TEXTURE_MIN_FILTER',
  TEXTURE_MAG_FILTER: 'TEXTURE_MAG_FILTER',
  NEAREST: 'NEAREST',
  LINEAR: 'LINEAR',
  RGBA: 'RGBA',
  UNSIGNED_BYTE: 'UNSIGNED_BYTE',
  FLOAT: 'FLOAT',
  TRIANGLE_STRIP: 'TRIANGLE_STRIP',
  TRIANGLES: 'TRIANGLES'
};

// Add WebGL context getter to canvas getContext method
const originalGetContext = document.createElement('canvas').getContext;
document.createElement('canvas').getContext = jest.fn((contextType) => {
  if (contextType === 'webgl' || contextType === 'webgl2') {
    return mockWebGLContext;
  }
  return originalGetContext(contextType);
});

// Mock performance measurement API
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByType: jest.fn(() => [])
};

// Export mock types that may be needed in tests
module.exports = {
  mockWebGLContext
};