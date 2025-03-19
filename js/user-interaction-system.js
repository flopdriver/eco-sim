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

    // Tool intensity (varies by distance from center)
    toolIntensity: 1.0,

    // Tool-specific settings
    toolSettings: {
        water: {
            amount: 255,      // Amount of water to add (0-255)
            spreadFactor: 0.8 // How much water spreads with brush size
        },
        seed: {
            energy: 100,       // Initial seed energy
            probability: 0.2   // Chance to place seed within brush
        },
        dig: {
            depth: 0.4,        // Dig depth factor (0-1)
            effectiveness: 0.9 // How effectively the dig tool removes material
        },
        insect: {
            energy: 150,       // Initial insect energy
            probability: 0.1   // Chance to place insect within brush
        },
        worm: {
            energy: 200,       // Initial worm energy
            probability: 0.1   // Chance to place worm within brush
        }
    },

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

        // Brush size slider
        const brushSlider = document.getElementById('brush-slider');
        if (brushSlider) {
            brushSlider.addEventListener('input', () => {
                this.brushSize = parseInt(brushSlider.value);
                const brushValue = document.getElementById('brush-value');
                if (brushValue) {
                    brushValue.textContent = this.brushSize + 'px';
                }
            });
        }

        console.log("Event listeners set up");
    },

    // Handle mouse down event
    handleMouseDown: function(event) {
        event.preventDefault(); // Prevent default browser behavior
        this.isMouseDown = true;

        const coords = this.getSimCoordinates(event);
        this.lastX = coords.x;
        this.lastY = coords.y;

        // Apply tool at mouse position
        this.applyTool(this.currentTool, coords.x, coords.y);
    },

    // Handle mouse move event
    handleMouseMove: function(event) {
        event.preventDefault(); // Prevent default browser behavior

        if (!this.isMouseDown) {
            // Even when not dragging, update last position for better interaction
            const coords = this.getSimCoordinates(event);
            this.lastX = coords.x;
            this.lastY = coords.y;
            return;
        }

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
        event.preventDefault(); // Prevent default browser behavior
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
        event.preventDefault();
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
        if (window.WebGLRenderingSystem) {
            window.WebGLRenderingSystem.setVisualizationMode(this.visualizationMode);
        }
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

        // Determine spacing based on brush size and movement speed
        // Larger brushes can have more spacing
        const spacing = Math.max(1, Math.floor(this.brushSize / 3));
        let stepCount = 0;

        while (true) {
            // Apply tool at current position with modulated spacing
            // for larger brushes to improve performance
            if (stepCount % spacing === 0) {
                this.applyTool(tool, x1, y1);
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

    // Apply tool at position with brush size
    applyTool: function(tool, x, y) {
        // Apply in a circular area based on brush size
        for (let dy = -this.brushSize; dy <= this.brushSize; dy++) {
            for (let dx = -this.brushSize; dx <= this.brushSize; dx++) {
                // Calculate distance from center
                const distanceSquared = dx * dx + dy * dy;
                const distance = Math.sqrt(distanceSquared);

                // Apply only within radius
                if (distance <= this.brushSize) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const index = this.core.getIndex(nx, ny);

                    if (index !== -1) {
                        // Intensity decreases with distance from center
                        // Uses a smoother falloff curve
                        const intensity = Math.pow(1 - (distance / this.brushSize), 2);
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
                this.applyObserveTool(x, y, index, intensity);
                break;
            default:
                console.warn('Unknown tool:', tool);
                break;
        }
    },

    // Apply water tool
    applyWaterTool: function(x, y, index, intensity) {
        const settings = this.toolSettings.water;
        const waterAmount = Math.floor(settings.amount * intensity * settings.spreadFactor);

        if (this.core.type[index] === this.TYPE.AIR) {
            // Add water to air if enough intensity
            if (intensity > 0.3) {
                this.core.type[index] = this.TYPE.WATER;
                this.core.water[index] = Math.min(255, waterAmount);
            }
        } else if (this.core.type[index] === this.TYPE.SOIL) {
            // Add water to soil - soil absorbs water effectively
            this.core.water[index] = Math.min(255, this.core.water[index] + waterAmount);

            // Update soil state based on wetness
            if (this.core.water[index] > 20) {
                this.core.state[index] = this.STATE.WET;
            }
        } else if (this.core.type[index] === this.TYPE.PLANT) {
            // Plants can absorb some water
            this.core.water[index] = Math.min(255, this.core.water[index] + Math.floor(waterAmount * 0.5));
        }
    },

    // Apply seed tool
    applySeedTool: function(x, y, index, intensity) {
        const settings = this.toolSettings.seed;

        // Only plant seeds in air or on soil
        if (this.core.type[index] === this.TYPE.AIR) {
            // Check if there's soil nearby (especially below)
            const belowIndex = this.core.getIndex(x, y + 1);
            const hasSoilBelow = belowIndex !== -1 && this.core.type[belowIndex] === this.TYPE.SOIL;

            // Higher chance to plant seed if on soil and high intensity
            const chanceFactor = hasSoilBelow ? 1.5 : 1.0;

            // Place seed with probability based on intensity and settings
            if (Math.random() < settings.probability * intensity * chanceFactor) {
                this.core.type[index] = this.TYPE.SEED;
                this.core.state[index] = this.STATE.DEFAULT;

                // Energy varies with intensity
                this.core.energy[index] = Math.floor(settings.energy * (0.8 + 0.4 * intensity));

                // Seeds contain some water
                this.core.water[index] = 30;
            }
        }
    },

    // Apply dig tool
    applyDigTool: function(x, y, index, intensity) {
        const settings = this.toolSettings.dig;

        // Digging effectiveness increases with intensity
        const effectiveness = settings.effectiveness * intensity;

        // Chance to remove/modify based on intensity
        if (Math.random() < effectiveness) {
            // Handle differently based on current pixel type
            switch (this.core.type[index]) {
                case this.TYPE.AIR:
                    // Nothing to dig in air
                    break;

                case this.TYPE.WATER:
                    // Remove water
                    this.core.type[index] = this.TYPE.AIR;
                    this.core.water[index] = 0;
                    break;

                case this.TYPE.SOIL:
                    // In the upper part of the simulation, convert to air
                    if (y < this.core.height * settings.depth) {
                        this.core.type[index] = this.TYPE.AIR;
                        this.core.state[index] = this.STATE.DEFAULT;
                        this.core.water[index] = 0;
                        this.core.nutrient[index] = 0;
                    } else {
                        // Lower soil just gets disturbed/aerated
                        // Sometimes makes soil more fertile
                        if (Math.random() < 0.3) {
                            this.core.state[index] = this.STATE.FERTILE;
                            this.core.nutrient[index] = Math.min(255, this.core.nutrient[index] + 20);
                        }
                    }
                    break;

                case this.TYPE.PLANT:
                case this.TYPE.INSECT:
                case this.TYPE.SEED:
                case this.TYPE.WORM:
                    // Remove organisms, convert to dead matter
                    this.core.type[index] = this.TYPE.DEAD_MATTER;
                    break;

                case this.TYPE.DEAD_MATTER:
                    // Remove dead matter
                    this.core.type[index] = this.TYPE.AIR;
                    break;
            }
        }
    },

    // Apply insect tool
    applyInsectTool: function(x, y, index, intensity) {
        const settings = this.toolSettings.insect;

        // Only add insects to air, and with some randomness
        if (this.core.type[index] === this.TYPE.AIR) {
            // Add with probability based on intensity and settings
            if (Math.random() < settings.probability * intensity) {
                this.core.type[index] = this.TYPE.INSECT;
                this.core.state[index] = this.STATE.ADULT;

                // Energy based on settings and intensity
                this.core.energy[index] = Math.floor(settings.energy * (0.9 + 0.2 * intensity));
            }
        }
    },

    // Apply worm tool
    applyWormTool: function(x, y, index, intensity) {
        const settings = this.toolSettings.worm;

        // Worms can be added to soil or air
        if (this.core.type[index] === this.TYPE.SOIL || this.core.type[index] === this.TYPE.AIR) {
            // Higher chance in soil than air
            const typeFactor = this.core.type[index] === this.TYPE.SOIL ? 1.5 : 0.7;

            // Add with probability based on intensity, type and settings
            if (Math.random() < settings.probability * intensity * typeFactor) {
                this.core.type[index] = this.TYPE.WORM;

                // Energy based on settings and intensity
                this.core.energy[index] = Math.floor(settings.energy * (0.8 + 0.4 * intensity));

                // Worms in soil get a nutrient bonus
                if (this.core.type[index] === this.TYPE.SOIL) {
                    this.core.nutrient[index] = Math.min(255, this.core.nutrient[index] + 30);
                }
            }
        }
    },

    // Apply observe tool (shows info without modifying)
    applyObserveTool: function(x, y, index, intensity) {
        // Only apply to the center pixel of the brush at high intensity
        if (intensity < 0.9) return;

        // Get pixel properties
        const type = this.core.type[index];
        const state = this.core.state[index];
        const water = this.core.water[index];
        const nutrient = this.core.nutrient[index];
        const energy = this.core.energy[index];

        // Log information about the observed pixel
        console.log("Observed pixel:", {
            position: { x, y },
            type: this.getTypeString(type),
            state: this.getStateString(state),
            water: water,
            nutrient: nutrient,
            energy: energy
        });

        // Future enhancement: show tooltip or info panel with this data
    },

    // Convert type value to string description
    getTypeString: function(type) {
        const typeMap = {
            [this.TYPE.AIR]: "Air",
            [this.TYPE.WATER]: "Water",
            [this.TYPE.SOIL]: "Soil",
            [this.TYPE.PLANT]: "Plant",
            [this.TYPE.INSECT]: "Insect",
            [this.TYPE.SEED]: "Seed",
            [this.TYPE.DEAD_MATTER]: "Dead Matter",
            [this.TYPE.WORM]: "Worm"
        };
        return typeMap[type] || "Unknown";
    },

    // Convert state value to string description
    getStateString: function(state) {
        const stateMap = {
            [this.STATE.DEFAULT]: "Default",
            [this.STATE.WET]: "Wet",
            [this.STATE.DRY]: "Dry",
            [this.STATE.FERTILE]: "Fertile",
            [this.STATE.ROOT]: "Root",
            [this.STATE.STEM]: "Stem",
            [this.STATE.LEAF]: "Leaf",
            [this.STATE.FLOWER]: "Flower",
            [this.STATE.LARVA]: "Larva",
            [this.STATE.ADULT]: "Adult",
            [this.STATE.DECOMPOSING]: "Decomposing"
        };
        return stateMap[state] || "Unknown";
    },

    // Update method called from main loop (if needed)
    update: function() {
        // Any continuous processing needed for interaction system
        // Currently none needed as everything is event-driven
    }
};