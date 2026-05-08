#!/usr/bin/env node

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNTIME_REQUIREMENTS = [
  resolve(__dirname, 'statusline.mjs'),
  resolve(__dirname, '..', 'lib', 'keyEncryption.mjs'),
  resolve(__dirname, '..', 'public', 'js', 'sessionSlugs.mjs'),
];

async function run() {
  if (!RUNTIME_REQUIREMENTS.every((path) => existsSync(path))) {
    process.exit(0);
  }

  try {
    const { main } = await import('./statusline.mjs');
    await main();
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      process.exit(0);
    }
    throw error;
  }
}

run();
