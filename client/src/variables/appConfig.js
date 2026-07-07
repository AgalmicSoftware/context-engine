import { initializeRuntimeConfig } from '../utilities/session/runtimeConfig';

export * from './appConfig.ts';

try {
  initializeRuntimeConfig();
} catch (e) {}
