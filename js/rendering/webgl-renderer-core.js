// Modified WebGL Renderer Core Module
// Enhanced to work with the chunk-based ecosystem simulation

window.WebGLRendererCore = {
    // Canvas and GL context
    canvas: null,
    gl: null,

    // Reference to core simulation
    core: null,

    // Reference to chunk manager
    chunkManager: null,

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

    // Rendering optimization flags
    renderOnlyActiveChunks: true,
    chunkVisibilityBuffers: null,
    lastRenderedChunks: null,

    // Initialize WebGL renderer
    init: function(core, canvasId, chunkManager) {
        this.core = core;
        this.chunkManager = chunkManager;
        console.log("Initializing WebGL renderer core with chunk support...");

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

        // Initialize chunk visibility tracking
        this.initializeChunkVisibilityTracking();

        return this;
    },

    // Initialize chunk visibility tracking
    initializeChunkVisibilityTracking: function() {
        if (!this.chunkManager) return;

        // Create a buffer to track which chunks are visible
        const chunksX = this.chunkManager.chunksX;
        const chunksY = this.chunkManager.chunksY;

        this.chunkVisibilityBuffers = {
            visible: new Uint8Array(chunksX * chunksY),
            active: new Uint8Array(chunksX * chunksY),
            dirtyFlags: new Uint8Array(chunksX * chunksY)
        };

        // Initially mark all chunks as needing rendering
        this.chunkVisibilityBuffers.dirtyFlags.fill(1);

        // Remember last rendered chunk set
        this.lastRenderedChunks = new Set();
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

    // Update texture with current simulation state using chunk-aware color mapping
    updateTexture: function() {
        const gl = this.gl;

        // Check if chunk manager is available - if not, fall back to original method
        if (!this.chunkManager || !this.chunkManager.chunkedEcosystem) {
            this.updateTextureFullGrid();
            return;
        }

        // Get chunked ecosystem reference for more efficient access
        const chunkedEcosystem = this.chunkManager.chunkedEcosystem;
        const chunkSize = this.chunkManager.chunkSize;
        const chunksX = this.chunkManager.chunksX;
        const chunksY = this.chunkManager.chunksY;

        // Get active chunks
        const activeChunks = this.chunkManager.chunkedEcosystem.activeChunks;
        const dirtyFlags = this.chunkVisibilityBuffers.dirtyFlags;

        // Track active chunks for visibility
        this.chunkVisibilityBuffers.active.fill(0);

        // Mark active chunks
        for (const chunkIdx of activeChunks) {
            this.chunkVisibilityBuffers.active[chunkIdx] = 1;

            // If a chunk wasn't previously active, mark it as dirty
            if (!this.lastRenderedChunks.has(chunkIdx)) {
                dirtyFlags[chunkIdx] = 1;
            }
        }

        // Check previously active chunks that are no longer active
        for (const chunkIdx of this.lastRenderedChunks) {
            if (!activeChunks.has(chunkIdx)) {
                dirtyFlags[chunkIdx] = 1; // Mark as dirty if was active but no longer is
            }
        }

        // Update last rendered chunks
        this.lastRenderedChunks = new Set(activeChunks);

        // If we've changed which chunks are visible, make sure sky bg is clear
        let hasChunkVisibilityChanged = false;

        // Update pixel data only for active chunks or chunks marked as dirty
        for (let cy = 0; cy < chunksY; cy++) {
            for (let cx = 0; cx < chunksX; cx++) {
                const chunkIdx = cy * chunksX + cx;

                // Skip if chunk isn't active or dirty
                if (!this.chunkVisibilityBuffers.active[chunkIdx] && !dirtyFlags[chunkIdx]) {
                    continue;
                }

                // Determine chunk boundaries
                const startX = cx * chunkSize;
                const startY = cy * chunkSize;
                const endX = Math.min(startX + chunkSize, this.core.width);
                const endY = Math.min(startY + chunkSize, this.core.height);

                // Update pixels in this chunk
                for (let y = startY; y < endY; y++) {
                    for (let x = startX; x < endX; x++) {
                        const index = y * this.core.width + x;
                        const texIndex = index * 4;

                        // Get color based on pixel properties using our adapter functions
                        let color = this.getChunkedPixelColor(x, y, chunkedEcosystem);

                        // Set RGBA values in texture data
                        this.textureData[texIndex + 0] = color.r;  // R
                        this.textureData[texIndex + 1] = color.g;  // G
                        this.textureData[texIndex + 2] = color.b;  // B
                        this.textureData[texIndex + 3] = 255;      // A (fully opaque)
                    }
                }

                // Mark this chunk as rendered, no longer dirty
                dirtyFlags[chunkIdx] = 0;
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

    // Original method for updating the entire texture - used as fallback
    updateTextureFullGrid: function() {
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

    // Get color for a pixel in the chunked ecosystem
    getChunkedPixelColor: function(x, y, chunkedEcosystem) {
        const index = y * this.core.width + x;

        // First check clouds
        if (this.core.cloud && this.core.cloud[index] > 0) {
            // Cloud code from ColorMapper
            const cloudColors = {
                upper: { r: 250, g: 250, b: 255 }, // Brighter, whiter for upper layer
                lower: { r: 220, g: 225, b: 240 }  // Slightly darker, hint of blue for lower layer
            };

            // Default cloud color if we can't determine the layer
            let cloudColor = {
                r: 240,
                g: 240,
                b: 250
            };

            // Try to determine which cloud layer this pixel belongs to
            if (window.WeatherSystem && window.WeatherSystem.cloudProperties.cloudPixels) {
                // Find a matching cloud pixel
                for (const cloudPixel of window.WeatherSystem.cloudProperties.cloudPixels) {
                    if (Math.floor(cloudPixel.x) === x && cloudPixel.y === y) {
                        // Use the layer-specific color if available
                        if (cloudPixel.layer && cloudColors[cloudPixel.layer]) {
                            cloudColor = cloudColors[cloudPixel.layer];
                        }
                        break;
                    }
                }
            }

            // Add slight variation to avoid uniform appearance
            return {
                r: cloudColor.r + Math.floor(Math.random() * 5) - 2,
                g: cloudColor.g + Math.floor(Math.random() * 5) - 2,
                b: cloudColor.b + Math.floor(Math.random() * 5) - 2
            };
        }

        // Get current visualization mode
        const visualizationMode = VisualizationManager.getMode();

        // Different handling based on visualization mode
        if (visualizationMode !== 'normal') {
            // Handle specialized visualization from chunked data
            return this.getSpecializedChunkedVisualization(x, y, chunkedEcosystem, visualizationMode);
        }

        // Normal mode - direct mapping from chunked ecosystem
        const pixelType = chunkedEcosystem.typeArray[index];
        const pixelState = chunkedEcosystem.stateArray[index];
        const water = chunkedEcosystem.waterArray[index];
        const energy = chunkedEcosystem.energyArray[index];
        const nutrient = chunkedEcosystem.nutrientArray[index];

        // Create color based on pixel type and state
        let r = 0, g = 0, b = 0;

        // This follows the same logic as ColorMapper but uses chunked data directly
        switch (pixelType) {
            case 0: // Air/Empty
                // Air color varies with energy (sunlight) - softer blue
                const lightLevel = Math.min(1.0, energy / 150);
                // More natural sky blue with day/night influence
                r = 70 + Math.floor(lightLevel * 100);
                g = 130 + Math.floor(lightLevel * 70);
                b = 200 + Math.floor(lightLevel * 30);
                // Add slight variation for more natural look
                r += Math.floor(Math.random() * 15) - 7;
                g += Math.floor(Math.random() * 15) - 7;
                b += Math.floor(Math.random() * 15) - 7;
                break;

            case 1: // Soil
                // Soil color - more natural earth tones with variation
                switch (pixelState) {
                    case 2: // DRY
                        // Dry soil - sandy, light brown with variation
                        r = 150 - Math.floor(water * 0.15) + Math.floor(Math.random() * 15) - 7;
                        g = 120 - Math.floor(water * 0.1) + Math.floor(Math.random() * 15) - 7;
                        b = 90 - Math.floor(water * 0.05) + Math.floor(Math.random() * 10) - 5;
                        break;
                    case 1: // WET
                        // Wet soil - darker brown with variation
                        r = 100 - Math.floor(water * 0.1) + Math.floor(Math.random() * 10) - 5;
                        g = 65 - Math.floor(water * 0.05) + Math.floor(Math.random() * 10) - 5;
                        b = 40 + Math.floor(Math.random() * 10) - 5;
                        break;
                    case 3: // FERTILE
                        // Fertile soil - rich darker brown with variation
                        r = 110 - Math.floor(nutrient * 0.05) + Math.floor(Math.random() * 10) - 5;
                        g = 75 + Math.floor(nutrient * 0.1) + Math.floor(Math.random() * 10) - 5;
                        b = 50 + Math.floor(Math.random() * 8) - 4;
                        break;
                    default:
                        // Default brown with variation
                        r = 150 + Math.floor(Math.random() * 15) - 7;
                        g = 120 + Math.floor(Math.random() * 10) - 5;
                        b = 90 + Math.floor(Math.random() * 10) - 5;
                }
                break;

            case 2: // Water
                // Water color - more natural blue with subtle variation
                r = 35 + Math.floor(nutrient * 0.1); // Slight reddish with nutrients
                g = 110 + Math.floor(nutrient * 0.05) - Math.floor(Math.random() * 15);
                b = 185 - Math.floor(nutrient * 0.1) + Math.floor(Math.random() * 15);
                // Darker in deeper water
                const depth = y / this.core.height;
                r = Math.max(10, r - Math.floor(depth * 20));
                g = Math.max(70, g - Math.floor(depth * 30));
                b = Math.max(140, b - Math.floor(depth * 20));
                break;

            case 3: // Plant
                // Different plant parts have different colors
                switch (pixelState) {
                    case 4: // ROOT
                        // Roots - dark brown with hints of green
                        r = 120 - Math.floor(water * 0.1);
                        g = 80 + Math.floor(energy * 0.1);
                        b = 40;
                        break;
                    case 5: // STEM
                        // Stems - green with variation
                        r = 50 + Math.floor(energy * 0.1);
                        g = 150 + Math.floor(energy * 0.2);
                        b = 50;
                        break;
                    case 6: // LEAF
                        // Leaves - vibrant green depending on energy
                        r = 30 + Math.floor(energy * 0.05);
                        g = 160 + Math.floor(energy * 0.3);
                        b = 40 + Math.floor(water * 0.1);
                        break;
                    case 7: // FLOWER
                        // Flowers - color depends on metadata
                        const metadata = chunkedEcosystem.metadataArray[index] || 0;
                        // Extract flower type (high 4 bits) and color variation (low 4 bits)
                        const flowerType = (metadata >> 4) & 0xF; // 0-5 flower types
                        const colorVar = metadata & 0xF; // 0-4 color variations

                        // Flower colors
                        switch (colorVar) {
                            case 0: // Yellow (default)
                                r = 250; g = 230; b = 50;
                                break;
                            case 1: // Red/Pink
                                r = 230; g = 60; b = 100;
                                break;
                            case 2: // Purple
                                r = 160; g = 80; b = 220;
                                break;
                            case 3: // White
                                r = 240; g = 240; b = 240;
                                break;
                            case 4: // Orange
                                r = 240; g = 140; b = 40;
                                break;
                            default:
                                r = 240; g = 200; b = 60;
                        }
                        break;
                    default:
                        // Default green
                        r = 50;
                        g = 150;
                        b = 50;
                }
                break;

            case 4: // Insect
                // Insects - reddish-brown with variation
                r = 150 + Math.floor(energy * 0.2);
                g = 80 + Math.floor(energy * 0.1);
                b = 40 + Math.floor(energy * 0.05);
                break;

            case 5: // Seed
                // Seeds - natural brown with variation
                r = 120 + Math.floor(energy * 0.1);
                g = 100 - Math.floor(energy * 0.05);
                b = 60;
                break;

            case 6: // Dead matter
                // Dead matter - grayish brown with variation
                r = 100 - Math.floor(water * 0.1);
                g = 90 - Math.floor(water * 0.1);
                b = 70 - Math.floor(water * 0.05);
                break;

            case 7: // Worm
                // Worms - pinkish with variation
                r = 180 - Math.floor(energy * 0.05);
                g = 130 - Math.floor(energy * 0.05);
                b = 130 - Math.floor(energy * 0.05);
                break;

            default:
                // Unknown type - gray
                r = g = b = 120;
        }

        // Ensure RGB values are in valid range
        return {
            r: Math.max(0, Math.min(255, Math.floor(r))),
            g: Math.max(0, Math.min(255, Math.floor(g))),
            b: Math.max(0, Math.min(255, Math.floor(b)))
        };
    },

    // Handle specialized visualization for chunked ecosystem
    getSpecializedChunkedVisualization: function(x, y, chunkedEcosystem, mode) {
        const index = y * this.core.width + x;

        // Get the relevant property based on visualization mode
        let value = 0;
        let palette = null;

        switch (mode) {
            case 'moisture':
                value = chunkedEcosystem.waterArray[index];
                palette = VisualizationManager.colorPalettes.moisture;
                break;
            case 'energy':
                value = chunkedEcosystem.energyArray[index];
                palette = VisualizationManager.colorPalettes.energy;
                break;
            case 'nutrient':
                value = chunkedEcosystem.nutrientArray[index];
                palette = VisualizationManager.colorPalettes.nutrient;
                break;
            default:
                return { r: 0, g: 0, b: 0 }; // Black for unknown mode
        }

        // Special case for air - always show as very transparent in special modes
        if (chunkedEcosystem.typeArray[index] === 0) { // Air
            // Add slight variation for more natural look
            const variation = Math.floor(Math.random() * 10) - 5;
            return { r: 235 + variation, g: 235 + variation, b: 235 + variation };
        }

        // Interpolate between colors based on value
        const baseColor = VisualizationManager.interpolateColor(value, palette);

        // Add small random variation for more natural appearance
        return {
            r: Math.max(0, Math.min(255, baseColor.r + Math.floor(Math.random() * 10) - 5)),
            g: Math.max(0, Math.min(255, baseColor.g + Math.floor(Math.random() * 10) - 5)),
            b: Math.max(0, Math.min(255, baseColor.b + Math.floor(Math.random() * 10) - 5))
        };
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
    },

    // Toggle chunk-based rendering optimization
    toggleChunkRendering: function(enabled) {
        this.renderOnlyActiveChunks = enabled;

        // Mark all chunks as dirty to force a full render
        if (this.chunkVisibilityBuffers) {
            this.chunkVisibilityBuffers.dirtyFlags.fill(1);
        }

        console.log(`Chunk-based rendering: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
};