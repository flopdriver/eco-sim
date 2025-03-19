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

    // Reference to core simulation
    core: null,

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

    // Type and state enums (will be populated by controller)
    TYPE: null,
    STATE: null,

    // Visualization mode
    visualizationMode: 'normal', // normal, moisture, energy, nutrient

    // Color palettes for different visualization modes
    colorPalettes: {
        // For moisture visualization (blue gradient)
        moisture: [
            { level: 0, color: { r: 230, g: 230, b: 250 } },   // Dry - light lavender
            { level: 50, color: { r: 135, g: 206, b: 250 } },  // Low moisture - light blue
            { level: 100, color: { r: 30, g: 144, b: 255 } },  // Medium moisture - dodger blue
            { level: 200, color: { r: 0, g: 0, b: 139 } }      // High moisture - dark blue
        ],

        // For energy visualization (yellow/orange/red gradient)
        energy: [
            { level: 0, color: { r: 255, g: 250, b: 205 } },   // Low energy - light yellow
            { level: 50, color: { r: 255, g: 215, b: 0 } },    // Medium energy - gold
            { level: 150, color: { r: 255, g: 140, b: 0 } },   // High energy - dark orange
            { level: 250, color: { r: 255, g: 0, b: 0 } }      // Max energy - red
        ],

        // For nutrient visualization (green gradient)
        nutrient: [
            { level: 0, color: { r: 245, g: 245, b: 220 } },   // Low nutrients - beige
            { level: 50, color: { r: 173, g: 255, b: 47 } },   // Some nutrients - green yellow
            { level: 100, color: { r: 34, g: 139, b: 34 } },   // Medium nutrients - forest green
            { level: 200, color: { r: 0, g: 100, b: 0 } }      // High nutrients - dark green
        ]
    },

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
            1, -1,   // bottom-right
            -1,  1,  // top-left
            1,  1    // top-right
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

    // Set visualization mode
    setVisualizationMode: function(mode) {
        if (['normal', 'moisture', 'energy', 'nutrient'].includes(mode)) {
            this.visualizationMode = mode;
            console.log("Visualization mode set to:", mode);
        } else {
            console.warn("Unknown visualization mode:", mode);
        }
    },

    // Update texture with current simulation state
    updateTexture: function() {
        const gl = this.gl;

        // Update texture data from simulation state
        for (let y = 0; y < this.core.height; y++) {
            for (let x = 0; x < this.core.width; x++) {
                const index = y * this.core.width + x;
                const texIndex = index * 4;

                // Get color based on pixel properties and current visualization mode
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
    },

    // Get color for a pixel based on its properties and current visualization mode
    getPixelColor: function(index) {
        // Handle specialized visualization modes first
        if (this.visualizationMode !== 'normal') {
            return this.getSpecializedVisualizationColor(index);
        }

        // Get pixel properties
        const type = this.core.type[index];
        const state = this.core.state[index];
        const water = this.core.water[index];
        const energy = this.core.energy[index];
        const nutrient = this.core.nutrient[index];

        // Default colors
        let r = 0, g = 0, b = 0;

        // Normal mode - color based on type and state
        switch (type) {
            case this.TYPE.AIR:
                // Air color varies slightly with energy (sunlight)
                const lightLevel = Math.min(1.0, energy / 100);
                r = 120 + Math.floor(lightLevel * 135);
                g = 170 + Math.floor(lightLevel * 85);
                b = 225 + Math.floor(lightLevel * 30);
                break;

            case this.TYPE.WATER:
                // Water color varies with nutrient content and depth perception
                r = 20 + Math.floor(nutrient * 0.2); // Redder with nutrients
                g = 80 + Math.floor(nutrient * 0.1);
                b = 200 - Math.floor(nutrient * 0.2); // Less blue with nutrients
                break;

            case this.TYPE.SOIL:
                // Soil color varies with state and water content
                switch (state) {
                    case this.STATE.DRY:
                        r = 150 - Math.floor(water * 0.2);
                        g = 100 - Math.floor(water * 0.1);
                        b = 60 - Math.floor(water * 0.1);
                        break;
                    case this.STATE.WET:
                        r = 110 - Math.floor(water * 0.1);
                        g = 70 - Math.floor(water * 0.05);
                        b = 40;
                        break;
                    case this.STATE.FERTILE:
                        r = 100 - Math.floor(nutrient * 0.1);
                        g = 80 + Math.floor(nutrient * 0.2);
                        b = 40;
                        break;
                    default:
                        r = 120; g = 80; b = 40; // Default brown
                }
                break;

            case this.TYPE.PLANT:
                // Different plant parts have different colors
                switch (state) {
                    case this.STATE.ROOT:
                        r = 180 - Math.floor(water * 0.3);
                        g = 120 + Math.floor(water * 0.2);
                        b = 60;
                        break;
                    case this.STATE.STEM:
                        r = 60 + Math.floor(energy * 0.1);
                        g = 160 + Math.floor(energy * 0.2);
                        b = 60;
                        break;
                    case this.STATE.LEAF:
                        // Leaves get greener with energy (photosynthesis)
                        r = 20 + Math.floor(water * 0.1);
                        g = 150 + Math.floor(energy * 0.4);
                        b = 20 + Math.floor(water * 0.1);
                        break;
                    case this.STATE.FLOWER:
                        // Flowers are colorful - using energy to determine color
                        const colorPhase = (energy % 100) / 100;
                        // Create rainbow effect
                        if (colorPhase < 0.33) {
                            r = 255; g = Math.floor(colorPhase * 3 * 255); b = 0;
                        } else if (colorPhase < 0.66) {
                            r = Math.floor((0.66 - colorPhase) * 3 * 255); g = 255; b = Math.floor((colorPhase - 0.33) * 3 * 255);
                        } else {
                            r = Math.floor((colorPhase - 0.66) * 3 * 255); g = Math.floor((1.0 - colorPhase) * 3 * 255); b = 255;
                        }
                        break;
                    default:
                        r = 40; g = 180; b = 40; // Default green
                }
                break;

            case this.TYPE.INSECT:
                // Insects are reddish or orangish, color varies with energy
                r = 200 + Math.floor(energy * 0.2);
                g = 50 + Math.floor(energy * 0.4);
                b = 20 + Math.floor(energy * 0.1);
                break;

            case this.TYPE.SEED:
                // Seeds are small brown dots
                r = 160 + Math.floor(energy * 0.1);
                g = 140 - Math.floor(energy * 0.1);
                b = 40;
                break;

            case this.TYPE.DEAD_MATTER:
                // Dead matter - grayish brown
                r = 120 - Math.floor(water * 0.2);
                g = 100 - Math.floor(water * 0.2);
                b = 80 - Math.floor(water * 0.1);
                break;

            case this.TYPE.WORM:
                // Worms are pinkish
                r = 220 - Math.floor(energy * 0.1);
                g = 150 - Math.floor(energy * 0.1);
                b = 150 - Math.floor(energy * 0.1);
                break;

            default:
                // Unknown type - gray
                r = g = b = 128;
        }

        // Ensure RGB values are in valid range
        return {
            r: Math.max(0, Math.min(255, Math.floor(r))),
            g: Math.max(0, Math.min(255, Math.floor(g))),
            b: Math.max(0, Math.min(255, Math.floor(b)))
        };
    },

    // Get color for specialized visualization modes (moisture, energy, nutrient)
    getSpecializedVisualizationColor: function(index) {
        // Get the relevant property based on visualization mode
        let value = 0;
        let palette = null;

        switch (this.visualizationMode) {
            case 'moisture':
                value = this.core.water[index];
                palette = this.colorPalettes.moisture;
                break;
            case 'energy':
                value = this.core.energy[index];
                palette = this.colorPalettes.energy;
                break;
            case 'nutrient':
                value = this.core.nutrient[index];
                palette = this.colorPalettes.nutrient;
                break;
            default:
                return { r: 0, g: 0, b: 0 }; // Black for unknown mode
        }

        // Special case for air - always show as very transparent in special modes
        if (this.core.type[index] === this.TYPE.AIR) {
            return { r: 240, g: 240, b: 240 };
        }

        // Interpolate between colors based on value
        return this.interpolateColor(value, palette);
    },

    // Interpolate between colors in a palette based on a value
    interpolateColor: function(value, palette) {
        // Find the two colors to interpolate between
        let lowerColor = palette[0].color;
        let upperColor = palette[palette.length - 1].color;
        let lowerLevel = palette[0].level;
        let upperLevel = palette[palette.length - 1].level;

        for (let i = 0; i < palette.length - 1; i++) {
            if (value >= palette[i].level && value <= palette[i+1].level) {
                lowerColor = palette[i].color;
                upperColor = palette[i+1].color;
                lowerLevel = palette[i].level;
                upperLevel = palette[i+1].level;
                break;
            }
        }

        // Calculate interpolation factor (0-1)
        const range = upperLevel - lowerLevel;
        const factor = range === 0 ? 0 : (value - lowerLevel) / range;

        // Interpolate RGB values
        return {
            r: Math.floor(lowerColor.r + factor * (upperColor.r - lowerColor.r)),
            g: Math.floor(lowerColor.g + factor * (upperColor.g - lowerColor.g)),
            b: Math.floor(lowerColor.b + factor * (upperColor.b - lowerColor.b))
        };
    },

    // Add debug information to the scene (e.g., highlight active pixels)
    drawDebugInfo: function() {
        // This would be implemented if using a second canvas overlay for debugging
        // For now, this is a placeholder for future implementation
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