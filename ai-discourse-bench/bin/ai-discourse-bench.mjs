#!/usr/bin/env node

import { runCli } from '../src/cli.mjs';

runCli(process.argv.slice(2)).catch((error) => {
  const message = error && typeof error.message === 'string'
    ? error.message
    : String(error || 'Unknown error');
  console.error(`ai-discourse-bench: ${message}`);
  process.exitCode = 1;
});
