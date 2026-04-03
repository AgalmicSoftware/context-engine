'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

test('worker bundle stays in sync with canonical worker sources', async () => {
  const moduleUrl = pathToFileURL(path.join(__dirname, 'verify-worker-bundle-sync.mjs')).href;
  const { compareWorkerBundleSync } = await import(moduleUrl);
  const result = await compareWorkerBundleSync({ rootDir: path.resolve(__dirname, '..') });
  assert.deepEqual(result.mismatches, []);
});
