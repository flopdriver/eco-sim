# EcoSim

A pixel-based ecosystem simulation with realistic physical interactions.

## Overview

EcoSim is a web-based ecological simulator that models complex interactions between plants, soil, water, and creatures in a pixel-based environment. The simulation includes:

- Dynamic weather systems with clouds and rain
- Realistic plant growth with roots, stems, leaves, and flowers
- Soil physics with moisture and nutrient modeling
- Day/night cycles affecting ecosystem behavior
- Gravity and fluid dynamics

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