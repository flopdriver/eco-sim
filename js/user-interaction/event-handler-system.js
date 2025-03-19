// Event Handler System
// Manages all event handling for the user interaction

window.EventHandlerSystem = {
    // Reference to parent user interaction system
    userInteraction: null,

    // Initialize event handler system
    init: function(userInteractionSystem) {
        console.log("Initializing event handler system...");
        this.userInteraction = userInteractionSystem;
        return this;
    },

    // Set up event listeners for user interaction
    setupEventListeners: function() {
        const canvas = this.userInteraction.canvas;

        // Mouse events
        canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

        // Touch events for mobile
        canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

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

        // Brush size slider
        const brushSlider = document.getElementById('brush-slider');
        if (brushSlider) {
            brushSlider.addEventListener('input', () => {
                this.userInteraction.setBrushSize(parseInt(brushSlider.value));
            });
        }

        console.log("Event listeners set up");
    },

    // Handle mouse down event
    handleMouseDown: function(event) {
        event.preventDefault(); // Prevent default browser behavior
        this.userInteraction.isMouseDown = true;

        const coords = this.userInteraction.getSimCoordinates(event);
        this.userInteraction.lastX = coords.x;
        this.userInteraction.lastY = coords.y;

        // Apply tool at mouse position
        this.userInteraction.toolSystem.applyTool(this.userInteraction.currentTool, coords.x, coords.y);
    },

    // Handle mouse move event
    handleMouseMove: function(event) {
        event.preventDefault(); // Prevent default browser behavior

        if (!this.userInteraction.isMouseDown) {
            // Even when not dragging, update last position for better interaction
            const coords = this.userInteraction.getSimCoordinates(event);
            this.userInteraction.lastX = coords.x;
            this.userInteraction.lastY = coords.y;
            return;
        }

        const coords = this.userInteraction.getSimCoordinates(event);

        // Interpolate between last position and current position
        // to avoid gaps when moving mouse quickly
        this.userInteraction.interpolateToolApplication(
            this.userInteraction.lastX,
            this.userInteraction.lastY,
            coords.x,
            coords.y,
            this.userInteraction.currentTool
        );

        this.userInteraction.lastX = coords.x;
        this.userInteraction.lastY = coords.y;
    },

    // Handle mouse up event
    handleMouseUp: function(event) {
        event.preventDefault(); // Prevent default browser behavior
        this.userInteraction.isMouseDown = false;
    },

    // Handle mouse leave event
    handleMouseLeave: function(event) {
        this.userInteraction.isMouseDown = false;
    },

    // Handle touch start event
    handleTouchStart: function(event) {
        event.preventDefault(); // Prevent scrolling

        this.userInteraction.isMouseDown = true;

        const touch = event.touches[0];
        const coords = this.userInteraction.getSimCoordinates(touch);
        this.userInteraction.lastX = coords.x;
        this.userInteraction.lastY = coords.y;

        // Apply tool at touch position
        this.userInteraction.toolSystem.applyTool(this.userInteraction.currentTool, coords.x, coords.y);
    },

    // Handle touch move event
    handleTouchMove: function(event) {
        event.preventDefault(); // Prevent scrolling

        if (!this.userInteraction.isMouseDown) return;

        const touch = event.touches[0];
        const coords = this.userInteraction.getSimCoordinates(touch);

        // Interpolate between last position and current position
        this.userInteraction.interpolateToolApplication(
            this.userInteraction.lastX,
            this.userInteraction.lastY,
            coords.x,
            coords.y,
            this.userInteraction.currentTool
        );

        this.userInteraction.lastX = coords.x;
        this.userInteraction.lastY = coords.y;
    },

    // Handle touch end event
    handleTouchEnd: function(event) {
        event.preventDefault();
        this.userInteraction.isMouseDown = false;
    },

    // Handle tool selection
    handleToolSelect: function(event) {
        // Remove active class from all buttons
        const toolButtons = document.querySelectorAll('.tool-button');
        toolButtons.forEach(button => button.classList.remove('active'));

        // Add active class to selected button
        event.target.classList.add('active');

        // Update current tool
        const tool = event.target.getAttribute('data-tool');
        this.userInteraction.setTool(tool);
        console.log('Tool selected:', tool);
    },

    // Handle visualization mode selection
    handleVisualizationSelect: function(event) {
        // Remove active class from all buttons
        const vizButtons = document.querySelectorAll('.viz-button');
        vizButtons.forEach(button => button.classList.remove('active'));

        // Add active class to selected button
        event.target.classList.add('active');

        // Update visualization mode
        const mode = event.target.getAttribute('data-mode');
        this.userInteraction.visualizationSystem.setVisualizationMode(mode);
    }
};