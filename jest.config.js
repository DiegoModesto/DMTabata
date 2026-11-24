/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Testes de tela no runner do CI são bem mais lentos que localmente.
  testTimeout: 30000,
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**', '!src/test/**', '!**/*.d.ts'],
};
