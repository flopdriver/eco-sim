// User Interaction System
// Main module for handling user input and interaction with the simulation

window.UserInteractionSystem = {
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

    // Tool intensity (varies by distance from center)
    toolIntensity: 1.0,

    // System references
    toolSystem: null,
    eventHandlerSystem: null,
    visualizationSystem: null,

    // Type and state enums (will be populated by controller)
    TYPE: null,
    STATE: null,

    // Initialize user interaction system
    init: function(core, canvas) {
        this.core = core;
        this.canvas = canvas;
        console.log("Initializing user interaction system...");

        // Initialize subsystems
        this.toolSystem = ToolSystem.init(this);
        this.eventHandlerSystem = EventHandlerSystem.init(this);
        this.visualizationSystem = VisualizationSystem.init(this);

        // Ensure constants are propagated to subsystems
        this.propagateConstants();

        // Set up event listeners
        this.eventHandlerSystem.setupEventListeners();

        return this;
    },

    // Convert canvas/client coordinates to simulation coordinates
    getSimCoordinates: function(event) {
        // Get the canvas bounding rectangle
        const rect = this.canvas.getBoundingClientRect();
        
        // Calculate scaling factor between physical size and logical size
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        // Calculate exact position inside canvas element
        const canvasX = (event.clientX - rect.left) * scaleX;
        const canvasY = (event.clientY - rect.top) * scaleY;
        
        // Now calculate the simulation position by getting proportional position
        // Use the render scale factor if available to account for canvas resizing
        let simX, simY;
        
        // Use core width/height for simulation dimensions, divided by pixelSize
        simX = Math.floor(canvasX / this.core.pixelSize);
        simY = Math.floor(canvasY / this.core.pixelSize);
        
        // Check scale factors from WebGL renderer if available 
        if (window.WebGLRenderingSystem && window.WebGLRenderingSystem.rendererCore && 
            window.WebGLRenderingSystem.rendererCore.baseWidth) {
            
            // Log pixel positions for debugging
            console.log(`Mouse at (${event.clientX}, ${event.clientY}), SimPos: (${simX}, ${simY})`);
        }
        
        // Ensure coordinates are within simulation bounds
        return {
            x: Math.max(0, Math.min(this.core.width - 1, simX)),
            y: Math.max(0, Math.min(this.core.height - 1, simY))
        };
    },

    // Set current tool
    setTool: function(tool) {
        this.currentTool = tool;

        // Update UI to reflect the current tool
        const toolButtons = document.querySelectorAll('.tool-button');
        toolButtons.forEach(button => {
            if (button.getAttribute('data-tool') === tool) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    },

    // Set brush size
    setBrushSize: function(size) {
        this.brushSize = Math.max(1, Math.min(10, size));

        // Update UI slider if it exists
        const brushSlider = document.getElementById('brush-slider');
        if (brushSlider) {
            brushSlider.value = this.brushSize;
        }

        // Update display value
        const brushValue = document.getElementById('brush-value');
        if (brushValue) {
            brushValue.textContent = this.brushSize + 'px';
        }
    },

    // Interpolate tool application between two points
    interpolateToolApplication: function(x1, y1, x2, y2, tool) {
        // Use Bresenham's line algorithm to interpolate
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = (x1 < x2) ? 1 : -1;
        const sy = (y1 < y2) ? 1 : -1;
        let err = dx - dy;

        // Determine spacing based on brush size and movement speed
        // Larger brushes can have more spacing
        const spacing = Math.max(1, Math.floor(this.brushSize / 3));
        let stepCount = 0;

        while (true) {
            // Apply tool at current position with modulated spacing
            // for larger brushes to improve performance
            if (stepCount % spacing === 0) {
                this.toolSystem.applyTool(tool, x1, y1);
            }
            stepCount++;

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

    // Update method called from main loop (if needed)
    update: function() {
        // Any continuous processing needed for interaction system
        // Currently none needed as everything is event-driven
    },

    // Add this method to the UserInteractionSystem object
    propagateConstants: function() {
        console.log("Propagating constants to user interaction subsystems...");

        // Ensure TYPE and STATE are set in all subsystems
        if (this.toolSystem) {
            this.toolSystem.TYPE = this.TYPE;
            this.toolSystem.STATE = this.STATE;
        }
        if (this.eventHandlerSystem) {
            this.eventHandlerSystem.TYPE = this.TYPE;
            this.eventHandlerSystem.STATE = this.STATE;
        }
        if (this.visualizationSystem) {
            this.visualizationSystem.TYPE = this.TYPE;
            this.visualizationSystem.STATE = this.STATE;
        }
    },
};