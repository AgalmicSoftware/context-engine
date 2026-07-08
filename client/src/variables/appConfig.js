import { initializeRuntimeConfig } from '../utilities/session/runtimeConfig';

// Keep this bridge as plain JS: legacy imports expect appConfig.js, while the
// typed source lives in appConfig.ts. Importing this file initializes runtime
// config for side-effect consumers before re-exporting the TS module.
export * from './appConfig.ts';

try {
  initializeRuntimeConfig();
} catch (e) {}
