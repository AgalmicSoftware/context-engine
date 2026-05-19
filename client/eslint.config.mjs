import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const sourceFiles = ['src/**/*.{js,jsx,mjs,cjs}'];

export default [
  {
    ignores: ['build/**', 'coverage/**', 'node_modules/**'],
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    files: sourceFiles,
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.jest,
        ...globals.node,
        globalThis: 'readonly',
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.flat.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': 'off',
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
      'no-empty': 'off',
      'no-extra-semi': 'off',
      'no-redeclare': 'off',
      'react/display-name': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
    },
  },
];
