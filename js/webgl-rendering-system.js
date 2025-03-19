// WebGL Rendering System for Pixel Ecosystem Simulation

// Shader sources
const vertexShaderSource = `
attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0, 1);
  v_texCoord = a_texCoord;
}
`;

const fragmentShaderSource = `
precision mediump float;

uniform sampler2D u_image;
varying vec2 v_texCoord;

void main() {
  gl_FragColor = texture2D(u_image, v_texCoord);
}
`;

// WebGL Rendering System Module
const WebGLRenderingSystem = {
    canvas: null,
    gl: null,

    // Program and locations
    program: null,
    positionLocation: null,
    texCoordLocation: null,

    // Buffers
    positionBuffer: null,
    texCoordBuffer: null,

    // Textures
    texture: null,
    textureData: null,

    init: function(core, canvasId) {
        this.core = core;
        console.log("Initializing WebGL rendering system...");

        // Set up canvas and WebGL context
        this.canvas = document.getElementById(canvasId);
        this.canvas.width = core.width * core.pixelSize;
        this.canvas.height = core.height * core.pixelSize;

        // Try to get WebGL context
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        if (!this.gl) {
            console.error('WebGL not supported, falling back to canvas 2D');
            return null;
        }

        // Create shader program
        this.setupShaders();

        // Create buffers
        this.setupBuffers();

        // Create texture for the simulation data
        this.setupTexture();

        // Initialize texture data array (RGBA for each pixel)
        this.textureData = new Uint8Array(core.width * core.height * 4);

        return this;
    },

    setupShaders: function() {
        const gl = this.gl;

        // Create shaders
        const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

        // Create program and link shaders
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);

        // Check if linking succeeded
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            console.error('Unable to initialize shader program:', gl.getProgramInfoLog(this.program));
            return;
        }

        // Get attribute locations
        this.positionLocation = gl.getAttribLocation(this.program, 'a_position');
        this.texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord');
    },

    createShader: function(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        // Check if compilation succeeded
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    },

    setupBuffers: function() {
        const gl = this.gl;

        // Create position buffer (a simple full-screen quad)
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,  // bottom-left
            1, -1,  // bottom-right
            -1,  1,  // top-left
            1,  1   // top-right
        ]), gl.STATIC_DRAW);

        // Create texture coordinate buffer
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 0,  // bottom-left
            1, 0,  // bottom-right
            0, 1,  // top-left
            1, 1   // top-right
        ]), gl.STATIC_DRAW);
    },

    setupTexture: function() {
        const gl = this.gl;

        // Create a texture
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Initialize the texture with empty data (we'll update it later)
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,                   // level
            gl.RGBA,             // internal format
            this.core.width,     // width
            this.core.height,    // height
            0,                   // border
            gl.RGBA,             // format
            gl.UNSIGNED_BYTE,    // type
            null                 // data (null for now)
        );
    },

    // Update texture with current simulation state
    updateTexture: function() {
        const gl = this.gl;

        // Update texture data from simulation state
        for (let y = 0; y < this.core.height; y++) {
            for (let x = 0; x < this.core.width; x++) {
                const index = y * this.core.width + x;
                const texIndex = index * 4;

                // Get color based on pixel properties
                const color = this.getPixelColor(index);

                // Set RGBA values in texture data
                this.textureData[texIndex + 0] = color.r;  // R
                this.textureData[texIndex + 1] = color.g;  // G
                this.textureData[texIndex + 2] = color.b;  // B
                this.textureData[texIndex + 3] = 255;      // A (fully opaque)
            }
        }

        // Update the texture with new data
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,                    // level
            gl.RGBA,              // internal format
            this.core.width,      // width
            this.core.height,     // height
            0,                    // border
            gl.RGBA,              // format
            gl.UNSIGNED_BYTE,     // type
            this.textureData      // data
        );
    },

    // Render the current simulation state
    render: function() {
        const gl = this.gl;

        // Update texture with current simulation state
        this.updateTexture();

        // Clear the canvas
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Use our shader program
        gl.useProgram(this.program);

        // Set up the position attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.enableVertexAttribArray(this.positionLocation);
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

        // Set up the texture coordinate attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.enableVertexAttribArray(this.texCoordLocation);
        gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

        // Draw the quad (2 triangles, 6 vertices)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Draw UI on top of the WebGL canvas
        this.drawUI();
    },

    // Get color for a pixel based on its properties
    getPixelColor: function(index) {
        const type = this.core.type[index];
        const state = this.core.state[index];
        const water = this.core.water[index];
        const energy = this.core.energy[index];

        // Default colors (to be implemented based on pixel properties)
        // This is a placeholder - you'll need to define how different types of pixels
        // should be colored based on your TYPE and STATE enums
        let r = 0, g = 0, b = 0;

        // Simple placeholder coloring based on type
        switch (type) {
            case 0: // AIR
                r = g = b = 200;  // Light gray
                break;
            case 1: // WATER
                r = 20; g = 50; b = 200;  // Blue
                break;
            case 2: // SOIL
                r = 120; g = 80; b = 40;  // Brown
                break;
            case 3: // PLANT
                r = 40; g = 180; b = 40;  // Green
                break;
            case 4: // INSECT
                r = 200; g = 50; b = 50;  // Red
                break;
            default:
                r = g = b = 128;  // Gray for unknown
        }

        return { r, g, b };
    },

    // Draw UI elements on top of the WebGL canvas
    drawUI: function() {
        // We'll implement this later - possibly with HTML overlays or a second canvas
        // For now, this is a placeholder
    },

    // Resize the WebGL canvas and viewport
    resize: function(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }
};

// WebGL utility functions
const WebGLUtils = {
    // Check if WebGL is supported
    isWebGLSupported: function() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext &&
                (canvas.getContext('webgl') ||
                    canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    },

    // Get WebGL context with error handling
    getContext: function(canvas) {
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
            console.error('WebGL not supported. Please use a different browser.');
            return null;
        }
        return gl;
    },

    // Create and compile a shader
    createShader: function(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    },

    // Create and link a shader program
    createProgram: function(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program linking error:', gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }
};