// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'coverage/*'],
  },
  {
    // jest.mock(...) exige require() dentro da factory.
    files: ['**/__tests__/**', 'src/test/**'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
