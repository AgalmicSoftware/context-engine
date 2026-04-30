export * from './appConfig.ts';

import { initializeRuntimeConfig } from '../utilities/session/runtimeConfig';

try { initializeRuntimeConfig(); } catch (e) {}
