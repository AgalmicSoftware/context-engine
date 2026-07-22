import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const javascriptFiles = ['src/**/*.{js,jsx,mjs,cjs}'];
const typedFiles = ['src/**/*.{ts,tsx}'];
const typedReactFiles = ['src/**/*.tsx'];
const typedDomainFiles = ['src/domains/**/*.{ts,tsx}'];
const typedSessionUtilityFiles = ['src/utilities/session/**/*.{ts,tsx}'];
const typedWorkerUtilityFiles = ['src/utilities/worker/**/*.{ts,tsx}'];
const typedArweaveUtilityFiles = ['src/utilities/arweave/**/*.{ts,tsx}'];
const typedWeb3UtilityFiles = ['src/utilities/web3/**/*.{ts,tsx}'];
const typedCacheUtilityFiles = ['src/utilities/cache/**/*.{ts,tsx}'];
const typedSurveyUtilityFiles = ['src/utilities/survey/**/*.{ts,tsx}'];
const typedSbtUtilityFiles = ['src/utilities/sbt/**/*.{ts,tsx}'];
const typedUserUtilityFiles = ['src/utilities/user/**/*.{ts,tsx}'];
const typedSponsorUtilityFiles = ['src/utilities/sponsor/**/*.{ts,tsx}'];
const typedTagsUtilityFiles = ['src/utilities/tags/**/*.{ts,tsx}'];
const typedContractsUtilityFiles = ['src/utilities/contracts/**/*.{ts,tsx}'];
const typedSharedUtilityFiles = ['src/utilities/shared/**/*.{ts,tsx}'];
const typedUiUtilityFiles = ['src/utilities/ui/**/*.{ts,tsx}'];
const typedStorageUtilityFiles = ['src/utilities/storage/**/*.{ts,tsx}'];
const typedSharedComponentFiles = ['src/components/Shared/**/*.{ts,tsx}'];
const typedInformationalComponentFiles = [
  'src/components/About/**/*.{ts,tsx}',
  'src/components/Footer/**/*.{ts,tsx}',
  'src/components/InformationModals/**/*.{ts,tsx}',
  'src/components/Onboarding/**/*.{ts,tsx}',
];
const typedMainContentComponentFiles = ['src/components/MainContent/**/*.{ts,tsx}'];
const typedAuxiliaryPageComponentFiles = [
  'src/components/Agent/**/*.{ts,tsx}',
  'src/components/Bookmarks/**/*.{ts,tsx}',
  'src/components/Sponsor/**/*.{ts,tsx}',
];
const typedShellSupportComponentFiles = [
  'src/components/ErrorBoundary/**/*.{ts,tsx}',
  'src/components/RightSidebar/**/*.{ts,tsx}',
];
const typedDevSupportComponentFiles = ['src/components/E2E/**/*.{ts,tsx}'];
const typedGateComponentFiles = ['src/components/Gates/**/*.{ts,tsx}'];
const typedCommunityTabComponentFiles = ['src/components/CommunityTab/**/*.{ts,tsx}'];
const typedPolisReportComponentFiles = ['src/components/PolisReport/**/*.{ts,tsx}'];
const typedDebateMapComponentFiles = ['src/components/DebateMap/**/*.{ts,tsx}'];
const typedNavbarComponentFiles = ['src/components/Navbar/**/*.{ts,tsx}'];
const typedContractPageComponentFiles = ['src/components/ContractPage/**/*.{ts,tsx}'];
const typedOnePageSessionComponentFiles = ['src/components/OnePageSession/**/*.{ts,tsx}'];
const typedTagPageComponentFiles = ['src/components/TagPage/**/*.{ts,tsx}'];
const typedDocumentLibraryComponentFiles = ['src/components/DocumentLibrary/**/*.{ts,tsx}'];
const typedDemoViewsComponentFiles = ['src/components/DemoViews/**/*.{ts,tsx}'];
const typedAccountComponentFiles = ['src/components/Account/**/*.{ts,tsx}'];
const typedAdminComponentFiles = ['src/components/Admin/**/*.{ts,tsx}'];
const typedMainSiteComponentFiles = ['src/components/MainSite/**/*.{ts,tsx}'];
const typedUserPageComponentFiles = ['src/components/UserPage/**/*.{ts,tsx}'];
const typedSessionsComponentFiles = ['src/components/Sessions/**/*.{ts,tsx}'];
const typedSbtComponentFiles = ['src/components/SBTs/**/*.{ts,tsx}'];
const typedSurveyToolComponentFiles = ['src/components/SurveyTool/**/*.{ts,tsx}'];

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

const reactPlugins = {
  react: reactPlugin,
  'react-hooks': reactHooksPlugin,
};

const reactSettings = {
  react: {
    version: 'detect',
  },
};

const reactRules = {
  ...reactPlugin.configs.flat.recommended.rules,
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'error',
  'react/display-name': 'off',
  'react/prop-types': 'off',
  'react/react-in-jsx-scope': 'off',
  'react/jsx-uses-react': 'off',
};

export default [
  {
    ignores: ['build/**', 'coverage/**', 'node_modules/**'],
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: javascriptFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
    },
  },
  {
    files: typedFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedReactFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedDomainFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedSessionUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedWorkerUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedArweaveUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedWeb3UtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedCacheUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedSurveyUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedSbtUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedUserUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedSponsorUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedTagsUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedContractsUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedSharedUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
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
  {
    files: typedStorageUtilityFiles,
    languageOptions: sharedLanguageOptions,
    rules: {
      ...sharedRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedSharedComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedInformationalComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedMainContentComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedAuxiliaryPageComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedShellSupportComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedDevSupportComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedGateComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedCommunityTabComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedPolisReportComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedDebateMapComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedNavbarComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedContractPageComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedOnePageSessionComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedTagPageComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedDocumentLibraryComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedDemoViewsComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedAccountComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedAdminComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedMainSiteComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedUserPageComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedSessionsComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedSbtComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
  {
    files: typedSurveyToolComponentFiles,
    languageOptions: sharedLanguageOptions,
    plugins: reactPlugins,
    settings: reactSettings,
    rules: {
      ...sharedRules,
      ...reactRules,
      'no-undef': 'off',
    },
  },
];
