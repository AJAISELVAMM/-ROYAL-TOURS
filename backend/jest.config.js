export default {
  testEnvironment: 'node',
  setupFiles: ['./tests/setup.js'],
  globalTeardown: './tests/teardown.js',
  testMatch: ['**/tests/**/*.test.js'],
  transform: {},
  verbose: true,
  forceExit: true
};
