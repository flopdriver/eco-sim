// webgl-renderer-core.js - Updated version

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
    
    // Dirty rectangle tracking for optimized updates
    dirtyPixels: null,
    dirtyRect: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    hasDirtyPixels: false,
    maxDirtyPixelsPerFrame: 5000, // Increased from 2000 to handle more changes
    dirtyPixelBatchSize: 16, // Increased batch size for more efficient updates
    dirtyUpdateThreshold: 0.5, // Only use partial updates when less than 50% of screen is dirty

    // Base dimensions for scaling
    baseWidth: 0,
    baseHeight: 0,

    // Zoom and pan settings
    zoomLevel: 1.0,
    panX: 0,
    panY: 0,

    // Scale factor for zoom/display
    currentScaleFactor: 1.0,

    // Initialize WebGL renderer
    init: function(core, canvas) {
        this.core = core;
        console.log("Initializing WebGL renderer core...");

        // Check if we have a valid canvas
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            console.error('Invalid canvas element provided:', canvas);
            return null;
        }
        
        this.canvas = canvas;
        
        // Check if core dimensions are valid
        if (!core || !core.width || !core.height) {
            console.error('Invalid core dimensions:', core ? `${core.width}x${core.height}` : 'core not defined');
            return null;
        }
        
        // Make sure pixelSize is defined
        const pixelSize = core.pixelSize || 1;
        
        // Set canvas size to match the simulation size precisely
        // This ensures exact 1:1 mapping of simulation pixels to render pixels
        this.canvas.width = core.width * pixelSize;
        this.canvas.height = core.height * pixelSize;
        
        console.log(`Canvas dimensions set to: ${this.canvas.width}x${this.canvas.height}`);

        // Store base dimensions for reference
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
        
        // Initialize dirty pixels tracking
        this.dirtyPixels = new Set();
        this.resetDirtyRect();
        
        // Initial render requires a full texture update
        this.markAllPixelsDirty();

        // Set viewport to match canvas size exactly
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

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

        // Set texture parameters - critically important for pixel-perfect rendering
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // NEAREST filtering is crucial for pixel-perfect rendering
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
    
    // Reset the dirty rectangle to default values
    resetDirtyRect: function() {
        this.dirtyRect = {
            minX: this.core.width, 
            minY: this.core.height,
            maxX: 0,
            maxY: 0
        };
        this.hasDirtyPixels = false;
    },
    
    // Mark a pixel as dirty for rendering
    markPixelDirty: function(index) {
        // Skip if we're tracking too many pixels this frame
        if (this.dirtyPixels.size > this.maxDirtyPixelsPerFrame) {
            // If we exceed the limit, just mark the entire screen dirty for this frame
            if (!this.hasDirtyPixels) {
                this.markAllPixelsDirty();
            }
            return;
        }
        
        // Add to dirty pixel set
        this.dirtyPixels.add(index);
        
        // Extract x,y from index
        const x = index % this.core.width;
        const y = Math.floor(index / this.core.width);
        
        // Convert to batched cell coordinates
        const cellX = Math.floor(x / this.dirtyPixelBatchSize) * this.dirtyPixelBatchSize;
        const cellY = Math.floor(y / this.dirtyPixelBatchSize) * this.dirtyPixelBatchSize;
        
        // Update dirty rectangle with cell coordinates
        this.dirtyRect.minX = Math.min(this.dirtyRect.minX, cellX);
        this.dirtyRect.minY = Math.min(this.dirtyRect.minY, cellY);
        this.dirtyRect.maxX = Math.max(this.dirtyRect.maxX, cellX + this.dirtyPixelBatchSize); 
        this.dirtyRect.maxY = Math.max(this.dirtyRect.maxY, cellY + this.dirtyPixelBatchSize);
        
        this.hasDirtyPixels = true;
    },
    
    // Mark all pixels as dirty for full update
    markAllPixelsDirty: function() {
        this.dirtyRect = {
            minX: 0, 
            minY: 0,
            maxX: this.core.width - 1,
            maxY: this.core.height - 1
        };
        this.hasDirtyPixels = true;
    },

    // Update texture with current simulation state using the color mapper and dirty rectangle optimization
    updateTexture: function() {
        const gl = this.gl;
        
        // Skip update if no dirty pixels
        if (!this.hasDirtyPixels) {
            return;
        }
        
        const dr = this.dirtyRect;
        
        // Expand the dirty rect by 1 pixel for safety
        const startX = Math.max(0, dr.minX - 1);
        const startY = Math.max(0, dr.minY - 1);
        const endX = Math.min(this.core.width - 1, dr.maxX + 1);
        const endY = Math.min(this.core.height - 1, dr.maxY + 1);
        
        // Calculate the width and height of the dirty region
        const dirtyWidth = endX - startX + 1;
        const dirtyHeight = endY - startY + 1;
        
        // Calculate what percentage of the screen is dirty
        const dirtyArea = dirtyWidth * dirtyHeight;
        const totalArea = this.core.width * this.core.height;
        const dirtyRatio = dirtyArea / totalArea;
        
        // Is this a full screen update?
        const isFullUpdate = (startX <= 0 && startY <= 0 && 
                            endX >= this.core.width - 1 && 
                            endY >= this.core.height - 1);
                            
        // If it's almost a full screen update or the dirty ratio exceeds our threshold, do a complete update
        if (isFullUpdate || dirtyRatio > this.dirtyUpdateThreshold) {
            // Update entire texture as before
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
        } else {
            // Update only the dirty rectangle
            for (let y = startY; y <= endY; y++) {
                for (let x = startX; x <= endX; x++) {
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
            
            // Update only the modified portion of the texture
            gl.bindTexture(gl.TEXTURE_2D, this.texture);
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0,                    // level
                startX,               // xoffset
                startY,               // yoffset
                dirtyWidth,           // width
                dirtyHeight,          // height
                gl.RGBA,              // format
                gl.UNSIGNED_BYTE,     // type
                // Create a new view into the texture data array for the dirty rectangle
                new Uint8Array(this.textureData.buffer, 
                               (startY * this.core.width + startX) * 4, 
                               dirtyWidth * dirtyHeight * 4)
            );
        }
        
        // Reset dirty pixels and rectangle for next frame
        this.dirtyPixels.clear();
        this.resetDirtyRect();
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

        // Calculate visible dimensions based on zoom (improved precision for zoom)
        const visibleWidth = width / this.zoomLevel;
        const visibleHeight = height / this.zoomLevel;

        // Calculate normalized texture coordinates with improved precision
        // Clamp pan values to prevent showing outside the texture
        const maxPanX = Math.max(0, width - (width / this.zoomLevel));
        const maxPanY = Math.max(0, height - (height / this.zoomLevel));

        // Clamp pan values to valid range
        const clampedPanX = Math.max(0, Math.min(maxPanX, this.panX));
        const clampedPanY = Math.max(0, Math.min(maxPanY, this.panY));

        // Calculate texture coordinates with high precision
        let left = clampedPanX / width;
        let right = Math.min(1.0, (clampedPanX + visibleWidth) / width);
        let bottom = 1.0 - Math.min(1.0, (clampedPanY + visibleHeight) / height); // Flipped Y
        let top = 1.0 - (clampedPanY / height); // Flipped Y

        // Update the texture coordinate buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            left, top,      // bottom-left (flipped Y)
            right, top,     // bottom-right (flipped Y)
            left, bottom,   // top-left (flipped Y)
            right, bottom   // top-right (flipped Y)
        ]), gl.STATIC_DRAW);
    },

    // Set zoom level and pan offset with improved precision
    setZoom: function(zoomLevel, panX, panY) {
        this.zoomLevel = Math.max(0.1, zoomLevel); // Prevent zoom from going too small
        this.panX = panX || 0;
        this.panY = panY || 0;

        // Force a re-render with new zoom/pan
        this.render();
    },

    // Resize the WebGL canvas and viewport with pixel-perfect scaling
    resize: function(width, height) {
        // Calculate the scaling factor to maintain pixel-perfect rendering
        const pixelRatio = window.devicePixelRatio || 1;
        const displayWidth = Math.floor(width * pixelRatio);
        const displayHeight = Math.floor(height * pixelRatio);

        // Set canvas dimensions
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;

        // Update viewport to match the new canvas size
        this.gl.viewport(0, 0, displayWidth, displayHeight);

        // Force a re-render with new size
        this.render();
    },

    // Update scale factor for window resizing while keeping simulation size
    setScaleFactor: function(scaleFactor) {
        this.currentScaleFactor = scaleFactor;
        console.log(`WebGL renderer scale factor set to: ${scaleFactor}`);
        return scaleFactor;
    }
};