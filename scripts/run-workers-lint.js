'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

const result = spawnSync('npm', [
  '--prefix',
  'client',
  'exec',
  'eslint',
  '--',
  '--config',
  'client/eslint.workers.config.mjs',
  'workers/**/*.{js,mjs}',
], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`workers lint failed to start: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
