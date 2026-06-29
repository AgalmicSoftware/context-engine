'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const rootDir = resolve(__dirname, '..', '..');

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(rootDir, relativePath), 'utf8'));

test('sessionCorsWorker worker-local package stays pinned to ethers v6', () => {
  const pkg = readJson('workers/sessionCorsWorker/package.json');
  const lock = readJson('workers/sessionCorsWorker/package-lock.json');

  assert.equal(pkg?.dependencies?.ethers, '6.15.0');
  assert.equal(lock?.packages?.['']?.dependencies?.ethers, '6.15.0');
});
