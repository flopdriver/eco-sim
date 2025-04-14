// Visualization System
// Handles visualization modes and rendering options
import { WebGLRenderingSystem } from '../rendering/webgl-renderer-interface.js';

export const VisualizationSystem = {
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
        // Use imported WebGLRenderingSystem
        if (WebGLRenderingSystem) {
            WebGLRenderingSystem.setVisualizationMode(mode);
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
    }
};