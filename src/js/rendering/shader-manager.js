// Shader Manager Module
// Handles shader compilation, program linking, and shader-related functionality
import { WebGLUtils } from './webgl-utils.js';

export const ShaderManager = {
    // WebGL context
    gl: null,

    // Shader program and attribute locations
    program: null,
    positionLocation: null,
    texCoordLocation: null,

    // Shader sources
    vertexShaderSource: `
attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0, 1);
  v_texCoord = a_texCoord;
}
`,

    fragmentShaderSource: `
precision mediump float;

uniform sampler2D u_image;
varying vec2 v_texCoord;

void main() {
  gl_FragColor = texture2D(u_image, v_texCoord);
}
`,

    // Initialize shader manager
    init: function(gl) {
        this.gl = gl;
        console.log("Initializing shader manager...");

        // Create shaders and program
        return this.setupShaders();
    },

    // Set up shaders and program
    setupShaders: function() {
        const gl = this.gl;

        // Create shaders
        const vertexShader = WebGLUtils.createShader(gl, gl.VERTEX_SHADER, this.vertexShaderSource);
        const fragmentShader = WebGLUtils.createShader(gl, gl.FRAGMENT_SHADER, this.fragmentShaderSource);

        if (!vertexShader || !fragmentShader) {
            console.error('Failed to create shaders');
            return false;
        }

        // Create program and link shaders
        this.program = WebGLUtils.createProgram(gl, vertexShader, fragmentShader);
        if (!this.program) {
            console.error('Unable to initialize shader program');
            return false;
        }

        // Get attribute locations
        this.positionLocation = gl.getAttribLocation(this.program, 'a_position');
        this.texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord');

        return true;
    },

    // Add a new shader (for extending functionality)
    addShader: function(type, source) {
        const gl = this.gl;
        return WebGLUtils.createShader(gl, type, source);
    },

    // Create a new program from existing shaders
    createProgram: function(vertexShader, fragmentShader) {
        const gl = this.gl;
        return WebGLUtils.createProgram(gl, vertexShader, fragmentShader);
    }
};