import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const javascriptFiles = ['src/**/*.{js,jsx,mjs,cjs}'];
const typedUiUtilityFiles = ['src/utilities/ui/**/*.{ts,tsx}'];

const sharedLanguageOptions = {
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
};

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
    ignores: ['build/**', 'coverage/**', 'node_modules/**'],
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    files: javascriptFiles,
    languageOptions: sharedLanguageOptions,
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
      ...sharedRules,
      ...reactPlugin.configs.flat.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/display-name': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
    },
  },
  {
    files: typedUiUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
];
