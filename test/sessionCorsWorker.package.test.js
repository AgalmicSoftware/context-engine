import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(rootDir, relativePath), 'utf8'));

test('sessionCorsWorker worker-local package stays pinned to ethers v6', () => {
  const pkg = readJson('workers/sessionCorsWorker/package.json');
  const lock = readJson('workers/sessionCorsWorker/package-lock.json');

  assert.equal(pkg?.dependencies?.ethers, '6.15.0');
  assert.equal(lock?.packages?.['']?.dependencies?.ethers, '6.15.0');
});
