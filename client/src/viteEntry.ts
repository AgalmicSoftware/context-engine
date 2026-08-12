import processShim from 'process/browser';
import { Buffer } from 'buffer/';
import { clearBootReloadMarker, renderBootFailure } from './bootRecovery.js';
import 'assets/css/contextEngine.scss';

globalThis.process = globalThis.process || processShim;
globalThis.process.env = {
  ...(processShim.env || {}),
  ...(globalThis.process.env || {}),
};
globalThis.Buffer = globalThis.Buffer || Buffer;
globalThis.global = globalThis.global || globalThis;
initializeThemeRuntime();

// Keep the app import dynamic so browser globals are available before app modules run.
import('./index')
  .then(() => {
    clearBootReloadMarker();
  })
  .catch((error) => {
    console.error('[boot] App startup failed', error);
    renderBootFailure(error);
  });
