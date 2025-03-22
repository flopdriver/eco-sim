# EcoSim

A pixel-based ecosystem simulation with realistic physical interactions.

## Overview

EcoSim is a web-based ecological simulator that models complex interactions between plants, soil, water, and creatures in a pixel-based environment. The simulation includes:

- Dynamic weather systems with clouds and rain
- Realistic plant growth with roots, stems, leaves, and flowers
- Soil physics with moisture and nutrient modeling
- Day/night cycles affecting ecosystem behavior
- Gravity and fluid dynamics

## System Implementation Details

The ecosystem simulation works through these interconnected systems:

1. **Seed Germination System**: Seeds require sufficient water in surrounding soil to germinate. Seeds convert to plant roots when conditions are met, with germination chance influenced by soil moisture, depth, and fire adaptation.

2. **Plant Growth System**: Plants grow through connected parts (roots, stems, leaves, flowers) that work together:
   - Roots absorb water and nutrients from soil
   - Stems transport water upward and provide structural support
   - Leaves capture energy and create nutrients
   - The plant system ensures connectivity to maintain resource flow

3. **Soil Moisture Dynamics**: Water flows through soil based on soil type properties:
   - Clay soil: Slow drainage, high water retention
   - Sandy soil: Fast drainage, low retention
   - Loamy soil: Balanced properties for optimal plant growth
   - Different soil layers form naturally at various depths

4. **Water Transportation**: The fluid dynamics system handles water movement:
   - Water flows downward due to gravity
   - Soil absorbs water based on type and saturation
   - Plants interact with water through absorption at roots, stems, and leaves
   - Water distributes through plant systems to sustain growth

5. **Plant-Water Interaction**: Water provides essential hydration:
   - Roots seek out and absorb water from soil
   - Water flows upward through the plant via stems
   - Larger plants develop more efficient water transport systems
   - Insufficient water leads to stunted growth or death

## Recent Fixes

The plant growth system was enhanced by addressing several issues:

1. **Seed Germination Improvement**:
   - Reduced water requirements for germination (from 25 to 10)
   - Increased germination chance (40% to 60%)
   - Reduced energy loss rate for seeds to improve viability

2. **Water Absorption Enhancement**:
   - Improved root absorption efficiency of water from soil
   - Enhanced water distribution through plant vascular system
   - Reduced minimum water thresholds needed for absorption

3. **Soil Moisture Optimization**:
   - Adjusted soil type distribution to favor plant-friendly loamy soil
   - Fine-tuned drainage rates for better water availability
   - Modified soil layer composition for improved water retention

4. **Fluid Dynamics Refinement**:
   - Increased water flow rates for better soil saturation
   - Reduced evaporation rates to maintain moisture
   - Enhanced plant-water interaction for more effective absorption

These modifications ensure that plants have sufficient access to water for germination and growth, resulting in a more vibrant ecosystem.

## Setup and Running

1. Clone the repository
2. Open `index.html` in a modern web browser

## Testing

The project uses Jest for unit testing. To run tests:

```
npm test
```

For test coverage report:

```
npm run test:coverage
```

For continuous testing during development:

```
npm run test:watch
```

See [TESTING.md](TESTING.md) for more details on testing.

## Project Structure

- `/js`: JavaScript source code
  - `/biology`: Plant and creature systems
  - `/environment`: Weather, temperature, and lighting systems
  - `/physics`: Physical interactions and dynamics
  - `/rendering`: WebGL visualization code
  - `/sim-control`: Simulation control and management
  - `/user-interaction`: User input handling

## Technologies

- HTML5 Canvas and WebGL for rendering
- Vanilla JavaScript for simulation logic
- Jest for testing

## License

See the LICENSE file for details.