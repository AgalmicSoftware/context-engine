import js from '@eslint/js';
import globals from 'globals';

const workerFiles = ['workers/**/*.{js,mjs}'];

const sharedRules = {
  ...js.configs.recommended.rules,
  'no-unused-vars': 'off',
  'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
  'no-empty': 'off',
  'no-extra-semi': 'off',
  'no-redeclare': 'off',
};

export default [
  {
    ignores: [
      'workers/**/node_modules/**',
      'workers/**/dist/**',
      'workers/**/coverage/**',
    ],
  },
  {
    files: workerFiles,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
        ...globals.worker,
        globalThis: 'readonly',
      },
    },
    rules: sharedRules,
  },
];
