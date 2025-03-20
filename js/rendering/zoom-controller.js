// Zoom Controller Module
// Handles zooming functionality for the simulation

window.ZoomController = {
    // Reference to rendering system
    rendering: null,

    // Reference to core simulation (direct reference)
    core: null,

    // Zoom settings
    currentZoom: 1.0,
    minZoom: 0.5,
    maxZoom: 5.0,
    zoomStep: 0.1,
    initialZoomFactor: 1.0, // Default to 100% zoom

    // View settings
    panX: 0, // Horizontal pan offset in simulation pixels
    panY: 0, // Vertical pan offset in simulation pixels

    // Whether we're currently panning the view
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,

    // Initialize zoom controller
    init: function(renderingSystem) {
        console.log("Initializing zoom controller...");
        this.rendering = renderingSystem;

        // Get direct reference to core for safety
        if (renderingSystem && renderingSystem.core) {
            this.core = renderingSystem.core;
        } else {
            // Fallback to global core if available
            this.core = window.ecosim ? window.ecosim.core : null;

            if (!this.core) {
                console.warn("ZoomController: Could not get core reference, some features may not work");
            }
        }

        // Reset to default values
        this.panX = 0;
        this.panY = 0;

        // Set appropriate initial zoom based on window size and simulation size
        this.setInitialZoom();

        // Update UI if available
        this.updateZoomUI();

        return this;
    },

    // Set initial zoom level based on window and simulation size
    setInitialZoom: function() {
        const core = this.getCore();
        if (!core) {
            this.currentZoom = 1.0;
            return;
        }

        // Get window dimensions
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        // Get simulation dimensions
        const simWidth = core.width;
        const simHeight = core.height;

        // Calculate zoom to fit the simulation correctly in the window
        // We want to start at a zoom level that shows the entire simulation
        const horizontalZoom = windowWidth / simWidth;
        const verticalZoom = windowHeight / simHeight;

        // Use the smaller of the two zoom factors to ensure the entire simulation is visible
        // Also apply the initialZoomFactor preference
        this.currentZoom = Math.min(horizontalZoom, verticalZoom) * this.initialZoomFactor;

        // Ensure zoom doesn't go below minimum allowed
        this.currentZoom = Math.max(this.minZoom, this.currentZoom);

        // Apply the initial zoom
        if (this.rendering && this.rendering.rendererCore) {
            this.rendering.rendererCore.setZoom(this.currentZoom, this.panX, this.panY);
        }

        console.log(`Initial zoom set to ${this.currentZoom.toFixed(2)}x`);
    },

    // Set zoom level with bounds checking
    setZoom: function(zoomLevel) {
        // Enforce min/max zoom bounds
        this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoomLevel));

        // Apply zoom to rendering system
        if (this.rendering && this.rendering.rendererCore) {
            this.rendering.rendererCore.setZoom(this.currentZoom, this.panX, this.panY);
        }

        // Update UI
        this.updateZoomUI();

        console.log(`Zoom set to ${this.currentZoom.toFixed(2)}x, pan: (${this.panX.toFixed(0)}, ${this.panY.toFixed(0)})`);

        return this.currentZoom;
    },

    // Zoom in by one step
    zoomIn: function() {
        return this.setZoom(this.currentZoom + this.zoomStep);
    },

    // Zoom out by one step
    zoomOut: function() {
        return this.setZoom(this.currentZoom - this.zoomStep);
    },

    // Zoom to fit the entire simulation
    zoomToFit: function() {
        this.setInitialZoom();
        this.panX = 0;
        this.panY = 0;

        // Apply to rendering system
        if (this.rendering && this.rendering.rendererCore) {
            this.rendering.rendererCore.setZoom(this.currentZoom, this.panX, this.panY);
        }
    },

    // Set panning offset
    setPan: function(x, y) {
        // Get current core reference
        const core = this.getCore();
        if (!core) return;

        // Get canvas dimensions to calculate safe bounds
        const canvas = this.rendering.rendererCore.canvas;
        if (!canvas) return;

        // Calculate bounds to prevent panning too far
        const visibleWidth = core.width / this.currentZoom;
        const visibleHeight = core.height / this.currentZoom;

        // Allow some margin when panning
        const maxPanX = Math.max(0, core.width - visibleWidth * 0.5);
        const maxPanY = Math.max(0, core.height - visibleHeight * 0.5);

        // Apply bounds with larger margins to make panning feel more natural
        this.panX = Math.max(-visibleWidth * 0.25, Math.min(maxPanX, x));
        this.panY = Math.max(-visibleHeight * 0.25, Math.min(maxPanY, y));

        // Apply to rendering system
        if (this.rendering && this.rendering.rendererCore) {
            this.rendering.rendererCore.setZoom(this.currentZoom, this.panX, this.panY);
        }
    },

    // Start panning the view
    startPan: function(x, y) {
        this.isPanning = true;
        this.lastPanX = x;
        this.lastPanY = y;

        // Update cursor for panning
        const canvasContainer = document.querySelector('.canvas-container');
        if (canvasContainer) {
            canvasContainer.classList.add('panning');
        }
    },

    // Continue panning the view
    updatePan: function(x, y) {
        if (!this.isPanning) return;

        // Calculate the difference in screen pixels
        const dx = this.lastPanX - x;
        const dy = this.lastPanY - y;

        // Convert to simulation pixels based on zoom level
        const simDx = dx / this.currentZoom;
        const simDy = dy / this.currentZoom;

        // Update pan position
        this.setPan(this.panX + simDx, this.panY + simDy);

        // Update last position
        this.lastPanX = x;
        this.lastPanY = y;
    },

    // Stop panning
    endPan: function() {
        this.isPanning = false;

        // Restore cursor
        const canvasContainer = document.querySelector('.canvas-container');
        if (canvasContainer) {
            canvasContainer.classList.remove('panning');
        }
    },

    // Update zoom level based on mouse wheel event
    handleMouseWheel: function(event, mouseX, mouseY) {
        // Get zoom center in simulation coordinates
        const simX = (mouseX / this.currentZoom) + this.panX;
        const simY = (mouseY / this.currentZoom) + this.panY;

        // Calculate new zoom level - smoother zooming with reduced step size
        const zoomFactor = 0.15; // Reduced from default for smoother zooming
        const delta = -Math.sign(event.deltaY) * zoomFactor;
        let newZoom;

        // Scale zoom exponentially for smoother feeling
        if (delta > 0) {
            // Zooming in
            newZoom = this.currentZoom * (1 + delta);
        } else {
            // Zooming out
            newZoom = this.currentZoom / (1 - delta);
        }

        // Apply bounds
        newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));

        // If zoom level didn't change, exit early
        if (newZoom === this.currentZoom) return;

        // Calculate new pan position to keep mouse position stable during zoom
        // This makes the zoom appear centered on the mouse cursor
        const newPanX = simX - (mouseX / newZoom);
        const newPanY = simY - (mouseY / newZoom);

        // Set new zoom level
        this.currentZoom = newZoom;

        // Apply new pan position
        this.setPan(newPanX, newPanY);

        // Update UI
        this.updateZoomUI();

        // Prevent default scrolling behavior
        event.preventDefault();
    },

    // Helper method to safely get core reference
    getCore: function() {
        // First try direct reference
        if (this.core) return this.core;

        // Next try through rendering system
        if (this.rendering && this.rendering.core) {
            this.core = this.rendering.core;
            return this.core;
        }

        // Finally, try global reference
        if (window.ecosim && window.ecosim.core) {
            this.core = window.ecosim.core;
            return this.core;
        }

        // Log error if still not found
        console.error("ZoomController: Cannot find core simulation reference");
        return null;
    },

    // Convert client coordinates to simulation coordinates
    clientToSimCoordinates: function(clientX, clientY) {
        // Get canvas and check if rendering system is ready
        if (!this.rendering || !this.rendering.rendererCore || !this.rendering.rendererCore.canvas) {
            return { x: 0, y: 0 }; // Return default if system not ready
        }

        // Get core reference safely
        const core = this.getCore();
        if (!core) {
            return { x: 0, y: 0 }; // Return default if core not available
        }

        const canvas = this.rendering.rendererCore.canvas;
        const rect = canvas.getBoundingClientRect();

        // Calculate position within canvas in CSS pixels
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;

        // Scale to match actual canvas pixel space
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const pixelX = canvasX * scaleX;
        const pixelY = canvasY * scaleY;

        // Apply zoom and pan to get simulation coordinates
        const simX = Math.floor((pixelX / this.currentZoom) + this.panX);
        const simY = Math.floor((pixelY / this.currentZoom) + this.panY);

        // Ensure coordinates are within simulation bounds
        return {
            x: Math.max(0, Math.min(core.width - 1, simX)),
            y: Math.max(0, Math.min(core.height - 1, simY))
        };
    },

    // Update the zoom UI control if it exists
    updateZoomUI: function() {
        // Update zoom slider if it exists
        const zoomSlider = document.getElementById('zoom-slider');
        if (zoomSlider) {
            // Convert zoom to percentage for the slider
            const zoomPercent = Math.round(this.currentZoom * 100);
            zoomSlider.value = zoomPercent;
        }

        // Update zoom value display
        const zoomValue = document.getElementById('zoom-value');
        if (zoomValue) {
            zoomValue.textContent = Math.round(this.currentZoom * 100) + '%';
        }
    }
};