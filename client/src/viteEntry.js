import processShim from 'process/browser';
import { Buffer } from 'buffer';

globalThis.process = globalThis.process || processShim;
globalThis.process.env = {
  ...(processShim.env || {}),
  ...(globalThis.process.env || {}),
};
globalThis.Buffer = globalThis.Buffer || Buffer;
globalThis.global = globalThis.global || globalThis;

import('./index.js');
