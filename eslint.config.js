// Code checks (npm run lint). Catches mistakes like a missing import or an unused variable before they reach
// the app. Formatting is Prettier's job (npm run format), so nothing here is about spacing or quotes.

import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['vendor/**', 'data/**', 'node_modules/**', 'docs/**'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js', 'sw.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.serviceworker },
    },
  },
  {
    files: ['tests/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
  },
  {
    files: ['worker/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.worker } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'smart'],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
