// Visualization System
// Handles visualization modes and rendering options

window.VisualizationSystem = {
    // Reference to parent user interaction system
    userInteraction: null,

    // Available visualization modes
    availableModes: [
        'normal',    // Regular view showing all elements
        'moisture',  // Shows water content in blue scale
        'energy',    // Shows energy levels in orange/red scale
        'nutrient'   // Shows nutrient levels in green scale
    ],

    // Initialize visualization system
    init: function(userInteractionSystem) {
        console.log("Initializing visualization system...");
        this.userInteraction = userInteractionSystem;
        return this;
    },

    // Set visualization mode with UI updates
    setVisualizationMode: function(mode) {
        // Validate mode
        if (!this.availableModes.includes(mode)) {
            console.warn('Unknown visualization mode:', mode);
            return;
        }

        // Update stored mode
        this.userInteraction.visualizationMode = mode;
        console.log('Visualization mode selected:', mode);

        // Update UI to reflect current mode
        this.updateVisualizationUI(mode);

        // Notify rendering system about mode change
        if (window.WebGLRenderingSystem) {
            window.WebGLRenderingSystem.setVisualizationMode(mode);
        }
    },

    // Update UI elements for visualization mode
    updateVisualizationUI: function(mode) {
        // Update button states
        const vizButtons = document.querySelectorAll('.viz-button');
        vizButtons.forEach(button => {
            if (button.getAttribute('data-mode') === mode) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // Could add additional UI elements specific to each mode
        // For example, adding legends or color scales
        switch (mode) {
            case 'moisture':
                this.showModeLegend('Water content', 'blue');
                break;
            case 'energy':
                this.showModeLegend('Energy levels', 'orange');
                break;
            case 'nutrient':
                this.showModeLegend('Nutrient density', 'green');
                break;
            case 'normal':
                this.hideModeLegend();
                break;
        }
    },

    // Show a legend for the current visualization mode
    showModeLegend: function(title, color) {
        // This is a placeholder for potential future implementation
        // Would create or update a legend element showing the significance
        // of colors in the current visualization mode

        // For now, just log the change
        console.log(`Visualization legend: ${title} (${color})`);

        // Future implementation could create DOM elements for the legend
    },

    // Hide the visualization mode legend
    hideModeLegend: function() {
        // Placeholder for removing any legend elements
        console.log('Hiding visualization legend');
    },

    // Get a description of the current visualization mode
    getVisualizationDescription: function() {
        switch (this.userInteraction.visualizationMode) {
            case 'moisture':
                return 'Showing water content: darker blue indicates higher moisture levels';
            case 'energy':
                return 'Showing energy levels: brighter colors indicate higher energy';
            case 'nutrient':
                return 'Showing nutrient density: darker green indicates higher nutrients';
            case 'normal':
            default:
                return 'Normal view: showing natural appearance of all elements';
        }
    },
    
    // Highlight a selected entity
    highlightSelection: function(x, y, radius) {
        console.log(`Highlighting selection at (${x}, ${y}) with radius ${radius}`);
        
        // Create or update selection highlight
        if (!this.selectionHighlight) {
            this.createSelectionHighlight();
        }
        
        // Position and show the highlight
        this.updateSelectionHighlight(x, y, radius);
    },
    
    // Create DOM elements for selection highlight
    createSelectionHighlight: function() {
        // Create a highlight element if it doesn't exist
        this.selectionHighlight = document.createElement('div');
        this.selectionHighlight.className = 'selection-highlight';
        document.body.appendChild(this.selectionHighlight);
        
        // Create tooltip for detailed information
        this.selectionTooltip = document.createElement('div');
        this.selectionTooltip.className = 'selection-tooltip';
        document.body.appendChild(this.selectionTooltip);
    },
    
    // Update the position and size of the selection highlight to align precisely with cursor
    updateSelectionHighlight: function(x, y, radius) {
        if (!this.selectionHighlight) return;
        
        // Convert simulation coordinates to screen coordinates
        // Using exact mouse coordinates for perfect cursor alignment
        let screenCoords;
        if (window.ZoomController) {
            // Use exact coordinates for perfect cursor alignment
            screenCoords = window.ZoomController.simToClientCoordinates(x, y);
        } else {
            // Fall back to basic conversion if zoom controller isn't available
            const canvas = this.userInteraction.canvas;
            const rect = canvas.getBoundingClientRect();
            const pixelSize = this.userInteraction.core.pixelSize;
            
            // Use exact coordinates for perfect alignment with cursor
            screenCoords = {
                x: rect.left + (x * pixelSize),
                y: rect.top + (y * pixelSize)
            };
        }
        
        // Calculate visual radius based on zoom
        let visualRadius = radius;
        if (window.ZoomController) {
            visualRadius = radius * window.ZoomController.currentZoom;
        }
        
        // Position the highlight exactly centered on the cursor position
        this.selectionHighlight.style.left = (screenCoords.x - visualRadius) + 'px';
        this.selectionHighlight.style.top = (screenCoords.y - visualRadius) + 'px';
        this.selectionHighlight.style.width = (visualRadius * 2) + 'px';
        this.selectionHighlight.style.height = (visualRadius * 2) + 'px';
        this.selectionHighlight.style.display = 'block';
        this.selectionHighlight.style.borderStyle = 'solid'; // Reset from dragging
        this.selectionHighlight.style.opacity = '1.0';       // Reset from dragging
        
        // Pulse animation effect
        this.selectionHighlight.style.animation = 'highlight-pulse 1.5s infinite';
    },
    
    // Move the highlight to follow dragging, ensuring it's centered precisely with the cursor
    moveHighlight: function(x, y) {
        if (!this.selectionHighlight) return;
        
        // Convert simulation coordinates to screen coordinates
        // Using exact mouse coordinates for perfect alignment
        let screenCoords;
        if (window.ZoomController) {
            // Use exact mouse coordinates for precise cursor centering
            screenCoords = window.ZoomController.simToClientCoordinates(x, y);
        } else {
            // Fall back to basic conversion if zoom controller isn't available
            const canvas = this.userInteraction.canvas;
            const rect = canvas.getBoundingClientRect();
            const pixelSize = this.userInteraction.core.pixelSize;
            
            // Use exact coordinates for precise alignment with cursor
            screenCoords = {
                x: rect.left + (x * pixelSize),
                y: rect.top + (y * pixelSize)
            };
        }
        
        // Get current size of the highlight
        const width = parseInt(this.selectionHighlight.style.width);
        const height = parseInt(this.selectionHighlight.style.height);
        
        // Position the highlight precisely centered on the exact cursor position
        this.selectionHighlight.style.left = (screenCoords.x - width/2) + 'px';
        this.selectionHighlight.style.top = (screenCoords.y - height/2) + 'px';
        
        // Change style during dragging to provide visual feedback
        this.selectionHighlight.style.borderStyle = 'dashed';
        this.selectionHighlight.style.opacity = '0.7';
    },
    
    // Clear the selection highlight
    clearHighlights: function() {
        if (this.selectionHighlight) {
            this.selectionHighlight.style.display = 'none';
        }
        
        if (this.selectionTooltip) {
            this.selectionTooltip.style.display = 'none';
        }
    },
    
    // Show a tooltip at specific coordinates
    showTooltip: function(x, y, text) {
        if (!this.selectionTooltip) {
            this.selectionTooltip = document.createElement('div');
            this.selectionTooltip.className = 'selection-tooltip';
            document.body.appendChild(this.selectionTooltip);
        }
        
        // Convert simulation coordinates to screen coordinates
        let screenCoords;
        if (window.ZoomController) {
            screenCoords = window.ZoomController.simToClientCoordinates(x, y);
        } else {
            // Fall back to basic conversion
            const canvas = this.userInteraction.canvas;
            const rect = canvas.getBoundingClientRect();
            const pixelSize = this.userInteraction.core.pixelSize;
            
            screenCoords = {
                x: rect.left + (x * pixelSize),
                y: rect.top + (y * pixelSize)
            };
        }
        
        // Position the tooltip
        this.selectionTooltip.style.left = (screenCoords.x + 15) + 'px';
        this.selectionTooltip.style.top = (screenCoords.y - 30) + 'px';
        this.selectionTooltip.textContent = text;
        this.selectionTooltip.style.display = 'block';
    },
    
    // Hide the tooltip
    hideTooltip: function() {
        if (this.selectionTooltip) {
            this.selectionTooltip.style.display = 'none';
        }
    },
    
    // Show detailed entity information
    showEntityInfo: function(entityDetails) {
        if (!entityDetails) return;
        
        // Create an info panel if it doesn't exist
        if (!this.entityInfoPanel) {
            this.entityInfoPanel = document.createElement('div');
            this.entityInfoPanel.className = 'entity-info-panel';
            document.body.appendChild(this.entityInfoPanel);
            
            // Add close button
            const closeButton = document.createElement('button');
            closeButton.className = 'info-close-button';
            closeButton.textContent = '×';
            closeButton.addEventListener('click', () => {
                this.entityInfoPanel.style.display = 'none';
            });
            this.entityInfoPanel.appendChild(closeButton);
        }
        
        // Create HTML content for the panel
        let contentHTML = `<h3>${entityDetails.type} (${entityDetails.state})</h3>`;
        contentHTML += `<div class="info-grid">`;
        
        // Add basic properties
        contentHTML += `<div class="info-row"><div>Position:</div><div>(${entityDetails.position.x}, ${entityDetails.position.y})</div></div>`;
        
        // Add properties section if available
        if (entityDetails.properties) {
            if (entityDetails.properties.energy !== undefined) {
                contentHTML += `<div class="info-row"><div>Energy:</div><div>${entityDetails.properties.energy}</div></div>`;
            }
            if (entityDetails.properties.water !== undefined) {
                contentHTML += `<div class="info-row"><div>Water:</div><div>${entityDetails.properties.water}</div></div>`;
            }
            if (entityDetails.properties.nutrient !== undefined) {
                contentHTML += `<div class="info-row"><div>Nutrient:</div><div>${entityDetails.properties.nutrient}</div></div>`;
            }
        }
        
        // Add type-specific details
        if (entityDetails.healthStatus) {
            contentHTML += `<div class="info-row"><div>Health:</div><div>${entityDetails.healthStatus}</div></div>`;
        }
        if (entityDetails.waterStatus) {
            contentHTML += `<div class="info-row"><div>Hydration:</div><div>${entityDetails.waterStatus}</div></div>`;
        }
        if (entityDetails.growthStage) {
            contentHTML += `<div class="info-row"><div>Growth:</div><div>${entityDetails.growthStage}</div></div>`;
        }
        if (entityDetails.lifeStage) {
            contentHTML += `<div class="info-row"><div>Life Stage:</div><div>${entityDetails.lifeStage}</div></div>`;
        }
        if (entityDetails.moisture) {
            contentHTML += `<div class="info-row"><div>Moisture:</div><div>${entityDetails.moisture}</div></div>`;
        }
        if (entityDetails.fertility) {
            contentHTML += `<div class="info-row"><div>Fertility:</div><div>${entityDetails.fertility}</div></div>`;
        }
        
        // Add connected pixels count if available
        if (entityDetails.connectedPixels && entityDetails.connectedPixels.length) {
            contentHTML += `<div class="info-row"><div>Size:</div><div>${entityDetails.connectedPixels.length} pixels</div></div>`;
        }
        
        contentHTML += `</div>`;
        
        // Update and show the panel
        this.entityInfoPanel.innerHTML = contentHTML;
        this.entityInfoPanel.style.display = 'block';
        
        // Position at the right side of the screen
        this.entityInfoPanel.style.right = '20px';
        this.entityInfoPanel.style.top = '100px';
    }
};