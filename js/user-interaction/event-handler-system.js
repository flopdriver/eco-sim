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
        const self = this; // Store 'this' reference for event handlers

        // Mouse events
        canvas.addEventListener('mousedown', function(event) {
            self.handleMouseDown(event);
        });
        canvas.addEventListener('mousemove', function(event) {
            self.handleMouseMove(event);
        });
        canvas.addEventListener('mouseup', function(event) {
            self.handleMouseUp(event);
        });
        canvas.addEventListener('mouseleave', function(event) {
            self.handleMouseLeave(event);
        });
        canvas.addEventListener('wheel', function(event) {
            self.handleMouseWheel(event);
        }, { passive: false });

        // Prevent context menu on right-click for the canvas
        canvas.addEventListener('contextmenu', function(event) {
            event.preventDefault();
            return false;
        });

        // Touch events for mobile
        canvas.addEventListener('touchstart', function(event) {
            self.handleTouchStart(event);
        });
        canvas.addEventListener('touchmove', function(event) {
            self.handleTouchMove(event);
        });
        canvas.addEventListener('touchend', function(event) {
            self.handleTouchEnd(event);
        });

        // Tool selection
        const toolButtons = document.querySelectorAll('.tool-button');
        toolButtons.forEach(button => {
            button.addEventListener('click', function(event) {
                self.handleToolSelect(event);
            });
        });

        // Visualization mode selection
        const vizButtons = document.querySelectorAll('.viz-button');
        vizButtons.forEach(button => {
            button.addEventListener('click', function(event) {
                self.handleVisualizationSelect(event);
            });
        });

        // Zoom controls
        const zoomInButton = document.getElementById('zoom-in-button');
        const zoomOutButton = document.getElementById('zoom-out-button');
        const zoomResetButton = document.getElementById('zoom-reset-button');
        const zoomSlider = document.getElementById('zoom-slider');

        if (zoomInButton) {
            zoomInButton.addEventListener('click', function() {
                self.handleZoomIn();
            });
        }

        if (zoomOutButton) {
            zoomOutButton.addEventListener('click', function() {
                self.handleZoomOut();
            });
        }

        if (zoomResetButton) {
            zoomResetButton.addEventListener('click', function() {
                self.handleZoomReset();
            });
        }

        if (zoomSlider) {
            zoomSlider.addEventListener('input', function(event) {
                self.handleZoomSlider(event);
            });
        }

        // Brush size slider
        const brushSlider = document.getElementById('brush-slider');
        if (brushSlider) {
            brushSlider.addEventListener('input', function() {
                self.userInteraction.setBrushSize(parseInt(brushSlider.value));
            });
        }

        console.log("Event listeners set up");
    },

    // Handle mouse down event
    handleMouseDown: function(event) {
        event.preventDefault(); // Prevent default browser behavior

        // Check for middle/right mouse button for panning
        if (event.button === 1 || event.button === 2) {
            // Middle button (1) or right button (2) starts panning
            this.userInteraction.isMouseDown = false; // Don't apply tool

            // Start panning with the zoom controller
            if (window.ZoomController) {
                const mouseX = event.clientX;
                const mouseY = event.clientY;
                window.ZoomController.startPan(mouseX, mouseY);
            }
            return;
        }

        // Only left mouse button (0) applies tools
        if (event.button !== 0) return;

        this.userInteraction.isMouseDown = true;

        // Get the simulation coordinates based on zoom/pan
        let coords;
        if (window.ZoomController) {
            coords = window.ZoomController.clientToSimCoordinates(event.clientX, event.clientY);
        } else {
            coords = this.userInteraction.getSimCoordinates(event);
        }

        this.userInteraction.lastX = coords.x;
        this.userInteraction.lastY = coords.y;

        // Apply tool at mouse position
        // Check if core and getIndex function exist
        let index = -1;
        if (this.userInteraction.core && typeof this.userInteraction.core.getIndex === 'function') {
            index = this.userInteraction.core.getIndex(coords.x, coords.y);
        } else {
            console.error("Error: core.getIndex is not a function");
            return;
        }
        
        this.userInteraction.toolSystem.applyTool(this.userInteraction.currentTool, coords.x, coords.y);
        
        // Check if hand tool is active and has a selection - if so, start drag
        if (this.userInteraction.currentTool === 'hand' && this.userInteraction.selectedEntity && index !== -1) {
            if (this.userInteraction.toolSystem.startEntityDrag) {
                this.userInteraction.toolSystem.startEntityDrag(
                    this.userInteraction.selectedEntity, 
                    coords.x, 
                    coords.y
                );
            }
        }
    },

    // Handle mouse move event
    handleMouseMove: function(event) {
        event.preventDefault(); // Prevent default browser behavior

        // Check if we're panning
        if (window.ZoomController && window.ZoomController.isPanning) {
            window.ZoomController.updatePan(event.clientX, event.clientY);
            return;
        }

        // Get the simulation coordinates based on zoom/pan
        let coords;
        if (window.ZoomController) {
            coords = window.ZoomController.clientToSimCoordinates(event.clientX, event.clientY);
        } else {
            coords = this.userInteraction.getSimCoordinates(event);
        }
        
        // Check if we're dragging with the hand tool
        if (this.userInteraction.currentTool === 'hand' && 
            this.userInteraction.toolSystem.draggedEntity &&
            this.userInteraction.toolSystem.updateEntityDrag) {
            
            // Update the drag operation
            const isDragging = this.userInteraction.toolSystem.updateEntityDrag(coords.x, coords.y);
            
            // If actively dragging, don't do normal tool application
            if (isDragging) {
                this.userInteraction.lastX = coords.x;
                this.userInteraction.lastY = coords.y;
                return;
            }
        }

        if (!this.userInteraction.isMouseDown) {
            // Even when not dragging, update last position for better interaction
            this.userInteraction.lastX = coords.x;
            this.userInteraction.lastY = coords.y;
            return;
        }

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

        // End panning if we were panning
        if (window.ZoomController && window.ZoomController.isPanning) {
            window.ZoomController.endPan();
        }

        // Check if we're finishing a hand tool drag operation
        if (this.userInteraction.currentTool === 'hand' && 
            this.userInteraction.toolSystem.draggedEntity &&
            this.userInteraction.toolSystem.completeEntityDrag) {
            
            // Get the final position coordinates
            let coords;
            if (window.ZoomController) {
                coords = window.ZoomController.clientToSimCoordinates(event.clientX, event.clientY);
            } else {
                coords = this.userInteraction.getSimCoordinates(event);
            }
            
            // Complete the drag operation
            this.userInteraction.toolSystem.completeEntityDrag(coords.x, coords.y);
        }

        this.userInteraction.isMouseDown = false;
    },

    // Handle mouse leave event
    handleMouseLeave: function(event) {
        // End panning if we were panning
        if (window.ZoomController && window.ZoomController.isPanning) {
            window.ZoomController.endPan();
        }

        this.userInteraction.isMouseDown = false;
    },

    // Handle mouse wheel for zooming
    handleMouseWheel: function(event) {
        if (window.ZoomController) {
            // Convert mouse position to canvas coordinates
            const rect = this.userInteraction.canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // Handle zoom
            window.ZoomController.handleMouseWheel(event, mouseX, mouseY);
        }
    },

    // Handle touch start event
    handleTouchStart: function(event) {
        event.preventDefault(); // Prevent scrolling

        // Handle multi-touch for zooming
        if (event.touches.length === 2) {
            // Two-finger touch starts a pinch zoom
            this.userInteraction.isMouseDown = false;
            this.handlePinchStart(event);
            return;
        }

        this.userInteraction.isMouseDown = true;

        const touch = event.touches[0];

        // Get the simulation coordinates based on zoom/pan
        let coords;
        if (window.ZoomController) {
            coords = window.ZoomController.clientToSimCoordinates(touch.clientX, touch.clientY);
        } else {
            coords = this.userInteraction.getSimCoordinates(touch);
        }

        this.userInteraction.lastX = coords.x;
        this.userInteraction.lastY = coords.y;

        // Apply tool at touch position
        this.userInteraction.toolSystem.applyTool(this.userInteraction.currentTool, coords.x, coords.y);
    },

    // Handle touch move event
    handleTouchMove: function(event) {
        event.preventDefault(); // Prevent scrolling

        // Handle multi-touch pinch zoom
        if (event.touches.length === 2) {
            this.handlePinchMove(event);
            return;
        }

        if (!this.userInteraction.isMouseDown) return;

        const touch = event.touches[0];

        // Get the simulation coordinates based on zoom/pan
        let coords;
        if (window.ZoomController) {
            coords = window.ZoomController.clientToSimCoordinates(touch.clientX, touch.clientY);
        } else {
            coords = this.userInteraction.getSimCoordinates(touch);
        }

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
        this.pinchInProgress = false;
    },

    // Handle pinch start for zoom
    handlePinchStart: function(event) {
        if (event.touches.length !== 2) return;

        // Calculate initial distance between fingers
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        this.pinchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );

        // Store initial zoom level
        this.pinchInitialZoom = window.ZoomController ? window.ZoomController.currentZoom : 1.0;
        this.pinchInProgress = true;
    },

    // Handle pinch move for zoom
    handlePinchMove: function(event) {
        if (!this.pinchInProgress || event.touches.length !== 2) return;

        // Calculate new distance between fingers
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const newDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );

        // Calculate zoom scale factor
        const scale = newDistance / this.pinchDistance;

        // Calculate pinch center
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;

        // Set new zoom level centered on pinch
        if (window.ZoomController) {
            const newZoom = this.pinchInitialZoom * scale;

            // Get the rectangular bounds of the canvas
            const rect = this.userInteraction.canvas.getBoundingClientRect();

            // Convert pinch center to canvas coordinates
            const canvasX = centerX - rect.left;
            const canvasY = centerY - rect.top;

            // Get previous zoom center in simulation coordinates
            const prevZoom = window.ZoomController.currentZoom;

            // Calculate simulation coordinates at pinch center
            const simX = (canvasX / prevZoom) + window.ZoomController.panX;
            const simY = (canvasY / prevZoom) + window.ZoomController.panY;

            // Calculate new pan to keep pinch center stable
            const newPanX = simX - (canvasX / newZoom);
            const newPanY = simY - (canvasY / newZoom);

            // Apply new zoom and pan
            window.ZoomController.currentZoom = newZoom;
            window.ZoomController.setPan(newPanX, newPanY);
            window.ZoomController.updateZoomUI();
        }
    },

    // Handle zoom in button click
    handleZoomIn: function() {
        if (window.ZoomController) {
            window.ZoomController.zoomIn();
        }
    },

    // Handle zoom out button click
    handleZoomOut: function() {
        if (window.ZoomController) {
            window.ZoomController.zoomOut();
        }
    },

    // Handle zoom reset button click
    handleZoomReset: function() {
        if (window.ZoomController) {
            window.ZoomController.zoomToFit();
        }
    },

    // Handle zoom slider change
    handleZoomSlider: function(event) {
        if (window.ZoomController) {
            const zoomPercent = parseInt(event.target.value);
            const zoomLevel = zoomPercent / 100;
            window.ZoomController.setZoom(zoomLevel);
        }
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