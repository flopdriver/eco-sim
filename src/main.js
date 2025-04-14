import '../css/style.css';

// Import core simulation FIRST
import './js/core-simulation.js';

// Import Environment System Components
import './js/environment/day-night-system.js';
import './js/environment/weather-system.js';
import './js/environment/light-system.js';
import './js/environment/temperature-system.js';
import './js/environment/environment-controller.js';

// Import New modular physics system references
import './js/physics/fluid-dynamics.js';
import './js/physics/soil-moisture.js';
import './js/physics/gravity-system.js';
import './js/physics/erosion-system.js';
import './js/physics/air-dynamics.js';
import './js/physics/physics-system.js';

// Import Biology system components
// Plant system modules
import './js/biology/plant/plant-root-system.js';
import './js/biology/plant/plant-stem-system.js';
import './js/biology/plant/plant-leaf-system.js';
import './js/biology/plant/plant-flower-system.js';
import './js/biology/plant/plant-system.js';
// Other biology modules
import './js/biology/seed-system.js';
import './js/biology/insect-system.js';
import './js/biology/worm-system.js';
import './js/biology/decomposition-system.js';
import './js/biology/biology-system.js';

// Import User interaction components
import './js/user-interaction/visualization-system.js';
import './js/user-interaction/tool-system.js';
import './js/user-interaction/event-handler-system.js';
import './js/user-interaction/user-interaction-system.js';

// Import WebGL Rendering System Components
import { WebGLUtils } from './js/rendering/webgl-utils.js'; // Import explicitly for check
import { WebGLRenderingSystem } from './js/rendering/webgl-renderer-interface.js'; // Interface for resize/viz
// Core, ShaderManager, VizManager, ColorMapper are imported by the interface/core
import './js/rendering/webgl-renderer-core.js';

// Import Simulation controller components
import { SystemManager } from './js/sim-control/system-manager.js';
import { SimulationController } from './js/sim-control/simulation-controller.js';
import './js/sim-control/environment-initializer.js';
import './js/sim-control/performance-manager.js';
import './js/sim-control/ui-manager.js';
import './js/sim-control/ecosystem-balancer.js';

// Variable to hold the initialized simulation controller instance
let ecosimController = null;

// --- Initialization and Event Listeners --- 
window.addEventListener('load', function() {

    // Show WebGL error if not supported
    if (!WebGLUtils.isWebGLSupported()) {
        const errorElement = document.getElementById('webgl-error');
        if (errorElement) {
            errorElement.style.display = 'block';
        }
        // Hide loading screen even if WebGL fails
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        return; // Stop initialization if WebGL is not supported
    }

    // Initialize the simulation controller
    // Note: Many internal systems might still rely on finding each other via globals initially.
    // This might require further refactoring inside the system components themselves.
    try {
        ecosimController = SimulationController.init('ecosystem-canvas');
    } catch (e) {
        console.error("Error during SimulationController initialization:", e);
        // Show a generic error to the user?
        const errorElement = document.getElementById('webgl-error');
        if (errorElement) {
            errorElement.textContent = "An error occurred during simulation initialization. Check the console.";
            errorElement.style.display = 'block';
        }
    }

    // Hide loading screen after attempting initialization
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        // Use a short timeout to ensure rendering has a chance to start
        setTimeout(() => { 
            loadingScreen.style.display = 'none'; 
        }, 200); 
    }

    // Start the simulation if initialization was successful
    if (ecosimController) {
        console.log("Starting simulation from main.js...");
        ecosimController.start();
        // Optionally make it globally accessible for debugging
        // window.ecosim = ecosimController;
    } else {
        console.error("Simulation controller failed to initialize. Cannot start simulation.");
    }

    // Resize canvas function (using the local controller instance)
    function resizeCanvas() {
        const canvas = document.getElementById('ecosystem-canvas');
        const container = document.querySelector('.canvas-container');
        if (canvas && container) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            container.style.width = window.innerWidth + 'px';
            container.style.height = window.innerHeight + 'px';

            try {
                // Use the initialized controller's rendering system
                if (ecosimController && ecosimController.rendering) {
                    ecosimController.rendering.resize(window.innerWidth, window.innerHeight);
                    // updateScaleFactor might not be directly on the interface, depends on implementation
                    // Assuming it might be, or accessed via rendererCore if needed
                    if (typeof ecosimController.rendering.updateScaleFactor === 'function') {
                         ecosimController.rendering.updateScaleFactor(window.innerWidth, window.innerHeight);
                    } else if (ecosimController.rendering.rendererCore && typeof ecosimController.rendering.rendererCore.setScaleFactor === 'function') {
                        // Fallback if scale factor is on core
                         ecosimController.rendering.rendererCore.setScaleFactor(window.innerWidth, window.innerHeight);
                    }
                    ecosimController.rendering.render(); // Force redraw on resize
                }
            } catch (e) {
                console.warn("Could not resize canvas properly:", e);
            }
        }
    }

    // Initial resize and add event listener
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Tool buttons functionality (using the local controller instance)
    const toolButtons = document.querySelectorAll('.tool-button');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            toolButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const tool = button.getAttribute('data-tool');
            if (ecosimController && ecosimController.userInteraction) {
                ecosimController.userInteraction.setTool(tool);
            }
        });
    });

    // Visualization buttons functionality (using the local controller instance)
    const vizButtons = document.querySelectorAll('.viz-button');
    vizButtons.forEach(button => {
        button.addEventListener('click', () => {
            vizButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const mode = button.getAttribute('data-mode');
            if (ecosimController && ecosimController.rendering) {
                ecosimController.rendering.setVisualizationMode(mode);
            }
        });
    });
}); 