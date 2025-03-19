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

// WebGL Rendering System Module - defined in global scope for access by other modules
window.WebGLRenderingSystem = {
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
        // For moisture visualization (blue gradient) - more natural blues
        moisture: [
            { level: 0, color: { r: 240, g: 240, b: 250 } },   // Dry - very pale blue
            { level: 50, color: { r: 176, g: 196, b: 222 } },  // Low moisture - light steel blue
            { level: 100, color: { r: 70, g: 130, b: 180 } },  // Medium moisture - steel blue
            { level: 200, color: { r: 25, g: 25, b: 112 } }    // High moisture - midnight blue
        ],

        // For energy visualization (yellow/orange/red gradient) - more earthy tones
        energy: [
            { level: 0, color: { r: 245, g: 245, b: 220 } },   // Low energy - beige
            { level: 50, color: { r: 210, g: 180, b: 140 } },  // Medium energy - tan
            { level: 150, color: { r: 205, g: 133, b: 63 } },  // High energy - peru
            { level: 250, color: { r: 165, g: 42, b: 42 } }    // Max energy - brown
        ],

        // For nutrient visualization (green gradient) - more natural greens
        nutrient: [
            { level: 0, color: { r: 240, g: 240, b: 230 } },   // Low nutrients - cream
            { level: 50, color: { r: 144, g: 238, b: 144 } },  // Some nutrients - light green
            { level: 100, color: { r: 60, g: 179, b: 113 } },  // Medium nutrients - medium sea green
            { level: 200, color: { r: 34, g: 139, b: 34 } }    // High nutrients - forest green
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
        this.gl = WebGLUtils.getContext(this.canvas);
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
        const vertexShader = WebGLUtils.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = WebGLUtils.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

        // Create program and link shaders
        this.program = WebGLUtils.createProgram(gl, vertexShader, fragmentShader);
        if (!this.program) {
            console.error('Unable to initialize shader program');
            return;
        }

        // Get attribute locations
        this.positionLocation = gl.getAttribLocation(this.program, 'a_position');
        this.texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord');
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
        // FIX: Flipped Y coordinates to correct the upside-down rendering
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 1,  // bottom-left (flipped y)
            1, 1,  // bottom-right (flipped y)
            0, 0,  // top-left (flipped y)
            1, 0   // top-right (flipped y)
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
                // Air color varies slightly with energy (sunlight) - softer blue
                const lightLevel = Math.min(1.0, energy / 150);
                // More subtle sky blue with day/night influence
                r = 140 + Math.floor(lightLevel * 70);
                g = 180 + Math.floor(lightLevel * 40);
                b = 230 + Math.floor(lightLevel * 20);
                // Add slight variation for more natural look
                r += Math.floor(Math.random() * 10) - 5;
                g += Math.floor(Math.random() * 10) - 5;
                b += Math.floor(Math.random() * 10) - 5;
                break;

            case this.TYPE.WATER:
                // Water color - more natural blue with subtle variation
                r = 35 + Math.floor(nutrient * 0.1); // Slight reddish with nutrients
                g = 110 + Math.floor(nutrient * 0.05) - Math.floor(Math.random() * 15);
                b = 185 - Math.floor(nutrient * 0.1) + Math.floor(Math.random() * 15);
                // Darker in deeper water
                const coords = this.core.getCoords(index);
                if (coords) {
                    const depth = coords.y / this.core.height;
                    r = Math.max(10, r - Math.floor(depth * 20));
                    g = Math.max(70, g - Math.floor(depth * 30));
                    b = Math.max(140, b - Math.floor(depth * 20));
                }
                break;

            case this.TYPE.SOIL:
                // Soil color - more natural earth tones with variation
                switch (state) {
                    case this.STATE.DRY:
                        // Dry soil - sandy, light brown with variation
                        r = 150 - Math.floor(water * 0.15) + Math.floor(Math.random() * 15) - 7;
                        g = 120 - Math.floor(water * 0.1) + Math.floor(Math.random() * 15) - 7;
                        b = 90 - Math.floor(water * 0.05) + Math.floor(Math.random() * 10) - 5;
                        break;
                    case this.STATE.WET:
                        // Wet soil - darker brown with variation
                        r = 100 - Math.floor(water * 0.1) + Math.floor(Math.random() * 10) - 5;
                        g = 65 - Math.floor(water * 0.05) + Math.floor(Math.random() * 10) - 5;
                        b = 40 + Math.floor(Math.random() * 10) - 5;
                        break;
                    case this.STATE.FERTILE:
                        // Fertile soil - rich darker brown with variation
                        r = 110 - Math.floor(nutrient * 0.05) + Math.floor(Math.random() * 10) - 5;
                        g = 75 + Math.floor(nutrient * 0.1) + Math.floor(Math.random() * 10) - 5;
                        b = 50 + Math.floor(Math.random() * 8) - 4;
                        break;
                    default:
                        // Default brown with variation
                        r = 120 + Math.floor(Math.random() * 15) - 7;
                        g = 85 + Math.floor(Math.random() * 10) - 5;
                        b = 55 + Math.floor(Math.random() * 10) - 5;
                }
                break;

            case this.TYPE.PLANT:
                // Different plant parts have different colors - more natural greens
                switch (state) {
                    case this.STATE.ROOT:
                        // Roots - more natural brownish with water influence
                        r = 140 - Math.floor(water * 0.2) + Math.floor(Math.random() * 10) - 5;
                        g = 100 + Math.floor(water * 0.1) + Math.floor(Math.random() * 10) - 5;
                        b = 60 + Math.floor(Math.random() * 8) - 4;
                        break;
                    case this.STATE.STEM:
                        // Stems - natural green-brown
                        r = 80 + Math.floor(energy * 0.05) + Math.floor(Math.random() * 10) - 5;
                        g = 120 + Math.floor(energy * 0.1) + Math.floor(Math.random() * 15) - 7;
                        b = 50 + Math.floor(Math.random() * 10) - 5;
                        break;
                    case this.STATE.LEAF:
                        // Leaves - more natural muted green with variation
                        // Use both energy and water to influence color
                        const energyFactor = Math.min(1.0, energy / 200);
                        const waterFactor = Math.min(1.0, water / 200);

                        // Base green color
                        r = 40 + Math.floor(waterFactor * 20) + Math.floor(Math.random() * 15) - 7;
                        g = 100 + Math.floor(energyFactor * 40) + Math.floor(Math.random() * 20) - 10;
                        b = 30 + Math.floor(waterFactor * 20) + Math.floor(Math.random() * 10) - 5;

                        // Age variation - older leaves turn more yellow
                        if (Math.random() < 0.2) {
                            r += 20;
                            g -= 10;
                        }
                        break;
                    case this.STATE.FLOWER:
                        // Flowers with more natural color variation
                        if (Math.random() < 0.3) {
                            // White/pale flowers
                            r = 240 + Math.floor(Math.random() * 15);
                            g = 240 + Math.floor(Math.random() * 15);
                            b = 220 + Math.floor(Math.random() * 35);
                        } else if (Math.random() < 0.5) {
                            // Yellow/orange flowers
                            r = 220 + Math.floor(Math.random() * 35);
                            g = 180 + Math.floor(Math.random() * 75);
                            b = 50 + Math.floor(Math.random() * 30);
                        } else {
                            // Pink/purple flowers
                            r = 180 + Math.floor(Math.random() * 75);
                            g = 100 + Math.floor(Math.random() * 40);
                            b = 150 + Math.floor(Math.random() * 105);
                        }
                        break;
                    default:
                        // Default green with variation
                        r = 60 + Math.floor(Math.random() * 20) - 10;
                        g = 120 + Math.floor(Math.random() * 30) - 15;
                        b = 50 + Math.floor(Math.random() * 20) - 10;
                }
                break;

            case this.TYPE.INSECT:
                // Insects - more natural reddish-brown
                const insectEnergy = Math.min(1.0, energy / 200);
                r = 150 + Math.floor(insectEnergy * 40) + Math.floor(Math.random() * 20) - 10;
                g = 80 + Math.floor(insectEnergy * 20) + Math.floor(Math.random() * 15) - 7;
                b = 40 + Math.floor(insectEnergy * 10) + Math.floor(Math.random() * 15) - 7;
                break;

            case this.TYPE.SEED:
                // Seeds - natural brown with variation
                r = 120 + Math.floor(energy * 0.1) + Math.floor(Math.random() * 15) - 7;
                g = 100 - Math.floor(energy * 0.05) + Math.floor(Math.random() * 15) - 7;
                b = 60 + Math.floor(Math.random() * 10) - 5;
                break;

            case this.TYPE.DEAD_MATTER:
                // Dead matter - grayish brown with variation
                r = 100 - Math.floor(water * 0.1) + Math.floor(Math.random() * 15) - 7;
                g = 90 - Math.floor(water * 0.1) + Math.floor(Math.random() * 15) - 7;
                b = 70 - Math.floor(water * 0.05) + Math.floor(Math.random() * 10) - 5;
                break;

            case this.TYPE.WORM:
                // Worms - pinkish-brown with variation
                r = 180 - Math.floor(energy * 0.05) + Math.floor(Math.random() * 15) - 7;
                g = 130 - Math.floor(energy * 0.05) + Math.floor(Math.random() * 15) - 7;
                b = 130 - Math.floor(energy * 0.05) + Math.floor(Math.random() * 10) - 5;
                break;

            default:
                // Unknown type - gray with variation
                r = g = b = 120 + Math.floor(Math.random() * 20) - 10;
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
            // Add slight variation for more natural look
            const variation = Math.floor(Math.random() * 10) - 5;
            return { r: 235 + variation, g: 235 + variation, b: 235 + variation };
        }

        // Interpolate between colors based on value
        const baseColor = this.interpolateColor(value, palette);

        // Add small random variation for more natural appearance
        return {
            r: Math.max(0, Math.min(255, baseColor.r + Math.floor(Math.random() * 10) - 5)),
            g: Math.max(0, Math.min(255, baseColor.g + Math.floor(Math.random() * 10) - 5)),
            b: Math.max(0, Math.min(255, baseColor.b + Math.floor(Math.random() * 10) - 5))
        };
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