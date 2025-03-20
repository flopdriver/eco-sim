// WebGL Renderer Core Module
// Manages the main WebGL context and rendering pipeline

window.WebGLRendererCore = {
    // Canvas and GL context
    canvas: null,
    gl: null,

    // Reference to core simulation
    core: null,

    // Program and attribute locations
    program: null,
    positionLocation: null,
    texCoordLocation: null,

    // Buffers
    positionBuffer: null,
    texCoordBuffer: null,

    // Texture for rendering the simulation
    texture: null,
    textureData: null,

    // Base dimensions for scaling
    baseWidth: null,
    baseHeight: null,

    // Zoom and pan settings
    zoomLevel: 1.0,
    panX: 0,
    panY: 0,

    // Initialize WebGL renderer
    init: function(core, canvasId) {
        this.core = core;
        console.log("Initializing WebGL renderer core...");

        // Set up canvas and WebGL context
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Canvas element not found:', canvasId);
            return null;
        }

        // Set canvas size to match the simulation size
        this.canvas.width = core.width * core.pixelSize;
        this.canvas.height = core.height * core.pixelSize;

        // Store base dimensions for reference (this is the simulation size, not the canvas size)
        this.baseWidth = core.width;
        this.baseHeight = core.height;

        // Try to get WebGL context
        this.gl = WebGLUtils.getContext(this.canvas);
        if (!this.gl) {
            console.error('WebGL not supported, falling back to canvas 2D');
            return null;
        }

        // Set up the shader program via the shader manager
        if (!ShaderManager.init(this.gl)) {
            console.error('Failed to initialize shader manager');
            return null;
        }

        this.program = ShaderManager.program;
        this.positionLocation = ShaderManager.positionLocation;
        this.texCoordLocation = ShaderManager.texCoordLocation;

        // Create buffers
        this.setupBuffers();

        // Create texture for the simulation data
        this.setupTexture();

        // Initialize texture data array (RGBA for each pixel)
        this.textureData = new Uint8Array(core.width * core.height * 4);

        return this;
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
        // Using flipped Y coordinates to correct the upside-down rendering
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

    // Update texture with current simulation state using the color mapper
    updateTexture: function() {
        const gl = this.gl;

        // Update texture data from simulation state
        for (let y = 0; y < this.core.height; y++) {
            for (let x = 0; x < this.core.width; x++) {
                const index = y * this.core.width + x;
                const texIndex = index * 4;

                // Get color based on pixel properties and current visualization mode
                const color = ColorMapper.getPixelColor(index);

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

        // Set up texture and texture coordinate transformations based on zoom and pan
        this.updateTextureCoordinates();

        // Draw the quad (2 triangles, 6 vertices)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    // Update texture coordinates based on zoom and pan
    updateTextureCoordinates: function() {
        const gl = this.gl;

        // Calculate texture coordinates based on zoom and pan
        const width = this.core.width;
        const height = this.core.height;

        // Calculate the visible portion of the texture based on canvas aspect ratio
        const canvasAspect = this.canvas.width / this.canvas.height;
        const textureAspect = width / height;

        let visibleWidth, visibleHeight;

        // Default behavior - cover the entire texture
        if (this.zoomLevel === 1.0 && this.panX === 0 && this.panY === 0) {
            // Use simple coordinates that map the entire texture
            gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                0, 1,  // bottom-left (flipped Y)
                1, 1,  // bottom-right (flipped Y)
                0, 0,  // top-left (flipped Y)
                1, 0   // top-right (flipped Y)
            ]), gl.STATIC_DRAW);
            return;
        }

        // Calculate visible dimensions based on zoom
        visibleWidth = width / this.zoomLevel;
        visibleHeight = height / this.zoomLevel;

        // Calculate normalized texture coordinates
        let left = this.panX / width;
        let right = Math.min(1.0, (this.panX + visibleWidth) / width);
        let bottom = 1.0 - Math.min(1.0, (this.panY + visibleHeight) / height); // Flipped Y
        let top = 1.0 - (this.panY / height); // Flipped Y

        // Safety checks to avoid out of bounds texture coordinates
        left = Math.max(0.0, Math.min(1.0, left));
        right = Math.max(0.0, Math.min(1.0, right));
        bottom = Math.max(0.0, Math.min(1.0, bottom));
        top = Math.max(0.0, Math.min(1.0, top));

        // Update the texture coordinate buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            left, top,      // bottom-left (flipped Y)
            right, top,     // bottom-right (flipped Y)
            left, bottom,   // top-left (flipped Y)
            right, bottom   // top-right (flipped Y)
        ]), gl.STATIC_DRAW);
    },

    // Set zoom level and pan offset
    setZoom: function(zoomLevel, panX, panY) {
        this.zoomLevel = zoomLevel;
        this.panX = panX || 0;
        this.panY = panY || 0;

        // Force a re-render with new zoom/pan
        this.render();
    },

    // Resize the WebGL canvas and viewport
    resize: function(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl.viewport(0, 0, width, height);

        // Force a re-render with new size
        this.render();
    },

    // Set scale factor for maintaining simulation size while scaling display
    setScaleFactor: function(scaleFactor) {
        // Store the base width and height if not already stored
        if (!this.baseWidth) {
            this.baseWidth = this.core.width;
            this.baseHeight = this.core.height;
        }

        // Adjust the canvas style size for proper display scaling
        // This keeps the canvas looking full-sized while maintaining aspect ratio
        const containerWidth = window.innerWidth;
        const containerHeight = window.innerHeight;

        const containerAspect = containerWidth / containerHeight;
        const simulationAspect = this.baseWidth / this.baseHeight;

        let styleWidth, styleHeight;

        if (containerAspect > simulationAspect) {
            // Container is wider than simulation - use height to determine scale
            styleHeight = containerHeight;
            styleWidth = styleHeight * simulationAspect;
        } else {
            // Container is taller than simulation - use width to determine scale
            styleWidth = containerWidth;
            styleHeight = styleWidth / simulationAspect;
        }

        this.canvas.style.width = `${styleWidth}px`;
        this.canvas.style.height = `${styleHeight}px`;

        console.log(`WebGL scale factor set to: ${scaleFactor}, Canvas style size: ${styleWidth}x${styleHeight}`);
    }
};