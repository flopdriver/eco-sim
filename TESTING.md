# Testing in EcoSim

This document describes how to run and write tests for the EcoSim project.

## Test Setup

The project uses Jest as the testing framework. Tests are organized in the `tests/` directory with a structure that mirrors the main source code:

```
tests/
├── mock.js                   # Mock implementations of browser globals
├── unit/                     # Unit tests directory
│   ├── biology/              # Tests for biology systems
│   ├── core-simulation.test.js # Tests for core simulation
│   ├── environment/          # Tests for environment systems
│   └── physics/              # Tests for physics systems
└── integration/              # Integration tests (future)
```

## Running Tests

To run all tests:

```bash
npm test
```

To run specific tests:

```bash
# Run tests for a specific file
npm test -- tests/unit/core-simulation.test.js

# Run tests with a specific name pattern
npm test -- -t "CoreSimulation"

# Run tests with coverage report
npm test -- --coverage
```

## Writing Tests

When writing tests for EcoSim modules, follow these guidelines:

1. **Create Mocks for Dependencies**: Many modules have dependencies on other modules. Create proper mocks for these dependencies.

2. **Test Pure Functions First**: Focus on testing pure functions that don't have side effects.

3. **Handle Browser Globals**: Use the provided mock.js file to handle browser-specific globals (window, document, etc.)

4. **Isolate Tests**: Each test should be independent and not rely on the state set by other tests.

### Example Test Structure

```javascript
describe('ModuleName', () => {
  let module;
  let mockDependency;
  
  beforeEach(() => {
    jest.resetModules();
    
    // Mock console to avoid actual console logs
    global.console = { log: jest.fn() };
    
    // Set up mock dependencies
    mockDependency = {
      someMethod: jest.fn()
    };
    
    // Load the module
    module = require('../../path/to/module.js');
    
    // Initialize module with mocks
    module.init(mockDependency);
  });
  
  test('test description', () => {
    // Arrange - set up test scenario
    
    // Act - perform the action being tested
    
    // Assert - check the result
    expect(result).toBe(expectedValue);
  });
});
```

## Module Export for Testing

To make modules testable in Node.js, each module should have an export statement at the end:

```javascript
// Make Module available for testing in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModuleName;
}
```

## Tips for Effective Testing

1. **Test Edge Cases**: Make sure to test boundary conditions and edge cases.

2. **Test Behavior, Not Implementation**: Focus on testing what the function does, not how it does it.

3. **Keep Tests Fast**: Tests should run quickly to encourage frequent running.

4. **Test One Thing at a Time**: Each test should verify a single aspect of behavior.

5. **Make Tests Readable**: Use descriptive test names and clear assertions.

## Adding New Tests

When adding new functionality, also add corresponding tests to verify the behavior. Tests should be added in the appropriate directory under `tests/` with a filename following the pattern `[module-name].test.js`.

## Testing Environment

The test environment is configured in `jest.config.js`. This configuration sets up:

- Node.js test environment
- Setup files that should run before each test
- Module name mapping
- File patterns to match for tests

## Future Testing Improvements

1. Integration tests for system interactions
2. End-to-end testing with Puppeteer or similar
3. Improved module mocking strategy
4. Test coverage goals