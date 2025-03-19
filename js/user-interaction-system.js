// User Interaction System
// Handles user input and interaction with the simulation

const UserInteractionSystem = {
    // Reference to core simulation
    core: null,

    // Canvas reference
    canvas: null,

    // Current selected tool
    currentTool: 'water',

    // Current visualization mode
    visualizationMode: 'normal',

    // Mouse state
    isMouseDown: false,
    lastX: 0,
    lastY: 0,

    // Tool parameters
    brushSize: 3, // Size of the tool effect

    // Type and state enums (will be populated by controller)
    TYPE: null,
    STATE: null,

    // Initialize user interaction system
    init: function(core, canvas) {
        this.core = core;
        this.canvas = canvas;
        console.log("Initializing user interaction system...");

        // Set up event listeners
        this.setupEventListeners();

        return this;
    },

    // Set up event listeners for user interaction
    setupEventListeners: function() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Tool selection
        const toolButtons = document.querySelectorAll('.tool-button');
        toolButtons.forEach(button => {
            button.addEventListener('click', this.handleToolSelect.bind(this));
        });

        // Visualization mode selection
        const vizButtons = document.querySelectorAll('.viz-button');
        vizButtons.forEach(button => {
            button.addEventListener('click', this.handleVisualizationSelect.bind(this));
        });

        console.log("Event listeners set up");
    },

    // Handle mouse down event
    handleMouseDown: function(event) {
        this.isMouseDown = true;

        const coords = this.getSimCoordinates(event);
        this.lastX = coords.x;
        this.lastY = coords.y;

        // Apply tool at mouse position
        this.applyTool(this.currentTool, coords.x, coords.y);
    },

    // Handle mouse move event
    handleMouseMove: function(event) {
        if (!this.isMouseDown) return;

        const coords = this.getSimCoordinates(event);

        // Interpolate between last position and current position
        // to avoid gaps when moving mouse quickly
        this.interpolateToolApplication(
            this.lastX, this.lastY,
            coords.x, coords.y,
            this.currentTool
        );

        this.lastX = coords.x;
        this.lastY = coords.y;
    },

    // Handle mouse up event
    handleMouseUp: function(event) {
        this.isMouseDown = false;
    },

    // Handle mouse leave event
    handleMouseLeave: function(event) {
        this.isMouseDown = false;
    },

    // Handle touch start event
    handleTouchStart: function(event) {
        event.preventDefault(); // Prevent scrolling

        this.isMouseDown = true;

        const touch = event.touches[0];
        const coords = this.getSimCoordinates(touch);
        this.lastX = coords.x;
        this.lastY = coords.y;

        // Apply tool at touch position
        this.applyTool(this.currentTool, coords.x, coords.y);
    },

    // Handle touch move event
    handleTouchMove: function(event) {
        event.preventDefault(); // Prevent scrolling

        if (!this.isMouseDown) return;

        const touch = event.touches[0];
        const coords = this.getSimCoordinates(touch);

        // Interpolate between last position and current position
        this.interpolateToolApplication(
            this.lastX, this.lastY,
            coords.x, coords.y,
            this.currentTool
        );

        this.lastX = coords.x;
        this.lastY = coords.y;
    },

    // Handle touch end event
    handleTouchEnd: function(event) {
        this.isMouseDown = false;
    },

    // Handle tool selection
    handleToolSelect: function(event) {
        // Remove active class from all buttons
        const toolButtons = document.querySelectorAll('.tool-button');
        toolButtons.forEach(button => button.classList.remove('active'));

        // Add active class to selected button
        event.target.classList.add('active');

        // Update current tool
        this.currentTool = event.target.getAttribute('data-tool');
        console.log('Tool selected:', this.currentTool);
    },

    // Handle visualization mode selection
    handleVisualizationSelect: function(event) {
        // Remove active class from all buttons
        const vizButtons = document.querySelectorAll('.viz-button');
        vizButtons.forEach(button => button.classList.remove('active'));

        // Add active class to selected button
        event.target.classList.add('active');

        // Update visualization mode
        this.visualizationMode = event.target.getAttribute('data-mode');
        console.log('Visualization mode selected:', this.visualizationMode);

        // Notify rendering system about the mode change
        // This would typically be done through a callback or event system
        // For now, we'll assume the global WebGLRenderingSystem variable exists
        if (window.WebGLRenderingSystem) {
            window.WebGLRenderingSystem.setVisualizationMode(this.visualizationMode);
        }
    },

    // Set current tool
    setTool: function(tool) {
        this.currentTool = tool;
    },

    // Convert canvas/client coordinates to simulation coordinates
    getSimCoordinates: function(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const canvasX = (event.clientX - rect.left) * scaleX;
        const canvasY = (event.clientY - rect.top) * scaleY;

        const simX = Math.floor(canvasX / this.core.pixelSize);
        const simY = Math.floor(canvasY / this.core.pixelSize);

        return {
            x: Math.max(0, Math.min(this.core.width - 1, simX)),
            y: Math.max(0, Math.min(this.core.height - 1, simY))
        };
    },

    // Interpolate tool application between two points
    interpolateToolApplication: function(x1, y1, x2, y2, tool) {
        // Use Bresenham's line algorithm to interpolate
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = (x1 < x2) ? 1 : -1;
        const sy = (y1 < y2) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            // Apply tool at current position
            this.applyTool(tool, x1, y1);

            // Break if we've reached the end point
            if (x1 === x2 && y1 === y2) break;

            // Calculate next point
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x1 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y1 += sy;
            }
        }
    },

    // Apply tool at position with brush size
    applyTool: function(tool, x, y) {
        // Apply in a circular area based on brush size
        for (let dy = -this.brushSize; dy <= this.brushSize; dy++) {
            for (let dx = -this.brushSize; dx <= this.brushSize; dx++) {
                // Calculate distance from center
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Apply only within radius
                if (distance <= this.brushSize) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const index = this.core.getIndex(nx, ny);

                    if (index !== -1) {
                        // Intensity decreases with distance from center
                        const intensity = 1 - (distance / this.brushSize);
                        this.applySingleTool(tool, nx, ny, index, intensity);
                    }
                }
            }
        }
    },

    // Apply tool at a single pixel
    applySingleTool: function(tool, x, y, index, intensity) {
        // Skip invalid indices
        if (index === -1) return;

        // Full intensity by default
        intensity = intensity || 1.0;

        switch (tool) {
            case 'water':
                this.applyWaterTool(x, y, index, intensity);
                break;
            case 'seed':
                this.applySeedTool(x, y, index, intensity);
                break;
            case 'dig':
                this.applyDigTool(x, y, index, intensity);
                break;
            case 'insect':
                this.applyInsectTool(x, y, index, intensity);
                break;
            case 'worm':
                this.applyWormTool(x, y, index, intensity);
                break;
            case 'observe':
                // Observation tool doesn't modify anything
                break;
        }
    },

    // Apply water tool
    applyWaterTool: function(x, y, index, intensity) {
        if (this.core.type[index] === this.TYPE.AIR) {
            // Add water to air
            this.core.type[index] = this.TYPE.WATER;
            this.core.water[index] = Math.floor(255 * intensity);
        } else if (this.core.type[index] === this.TYPE.SOIL) {
            // Add water to soil
            this.core.water[index] = Math.min(255, this.core.water[index] + Math.floor(100 * intensity));
            this.core.state[index] = this.STATE.WET;
        }
    },

    // Apply seed tool
    applySeedTool: function(x, y, index, intensity) {
        // Only plant seeds in air or on top of soil
        if (this.core.type[index] === this.TYPE.AIR) {
            // Check if there's soil below
            const belowIndex = this.core.getIndex(x, y + 1);

            // Place seed with 20% chance based on intensity
            if (Math.random() < 0.2 * intensity) {
                this.core.type[index] = this.TYPE.SEED;
                this.core.energy[index] = Math.floor(100 * intensity);
            }
        }
    },

    // Apply dig tool
    applyDigTool: function(x, y, index, intensity) {
        // Digging simply removes whatever is there
        // Chance to remove increases with intensity
        if (Math.random() < intensity) {
            // If in the upper part of the simulation, set to air
            if (y < this.core.height * 0.4) {
                this.core.type[index] = this.TYPE.AIR;
                this.core.state[index] = this.STATE.DEFAULT;
                this.core.water[index] = 0;
                this.core.nutrient[index] = 0;
            } else {
                // In the lower part, set to soil
                this.core.type[index] = this.TYPE.SOIL;
                this.core.state[index] = this.STATE.DRY;
                this.core.water[index] = Math.floor(20 * intensity);
                this.core.nutrient[index] = Math.floor(10 * intensity);
            }
        }
    },

    // Apply insect tool
    applyInsectTool: function(x, y, index, intensity) {
        // Only add insects to air
        if (this.core.type[index] === this.TYPE.AIR) {
            // Add with 10% chance based on intensity
            if (Math.random() < 0.1 * intensity) {
                this.core.type[index] = this.TYPE.INSECT;
                this.core.state[index] = this.STATE.ADULT;
                this.core.energy[index] = Math.floor(150 * intensity);
            }
        }
    },

    // Apply worm tool
    applyWormTool: function(x, y, index, intensity) {
        // Add worms to soil or air
        if (this.core.type[index] === this.TYPE.SOIL || this.core.type[index] === this.TYPE.AIR) {
            // Add with 10% chance based on intensity
            if (Math.random() < 0.1 * intensity) {
                this.core.type[index] = this.TYPE.WORM;
                this.core.energy[index] = Math.floor(200 * intensity);
            }
        }
    }
};