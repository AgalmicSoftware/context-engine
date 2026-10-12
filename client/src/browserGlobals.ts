import processShim from 'process/browser';
import { Buffer } from 'buffer/';

// Static imports evaluate before viteEntry's body. Install the browser globals
// in its first dependency so theme/app configuration can read build-time env.
globalThis.process = globalThis.process || processShim;
globalThis.process.env = {
  ...(processShim.env || {}),
  ...(globalThis.process.env || {}),
};
globalThis.Buffer = globalThis.Buffer || Buffer;
globalThis.global = globalThis.global || globalThis;
