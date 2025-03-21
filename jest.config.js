// Jest configuration
module.exports = {
  // Define test environment
  testEnvironment: 'node',
  
  // Setup files that should run before each test
  setupFiles: ['<rootDir>/tests/mock.js'],
  
  // Transform ES modules to CommonJS for testing
  transform: {},
  
  // Files to ignore in tests
  testPathIgnorePatterns: ['/node_modules/'],
  
  // Handle module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  
  // Mock browser globals
  globals: {
    window: {}
  },
  
  // Allow the use of ES modules
  transformIgnorePatterns: [],
  
  // Define test files pattern
  testMatch: ['**/tests/**/*.test.js'],
  
  // Enable verbose output for tests
  verbose: true
};