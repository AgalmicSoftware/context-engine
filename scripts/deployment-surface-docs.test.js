'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('deployment docs distinguish source, deploy templates, and release bundles', () => {
  const boundaryDoc = read('deploy/README.md');
  const structureDoc = read('docs/repo-structure.md');

  assert.match(boundaryDoc, /workers\/sessionCorsWorker\//);
  assert.match(boundaryDoc, /deploy\/cloudflare\/session-worker\//);
  assert.match(boundaryDoc, /dist\/sessionCorsWorker\.bundle\.js/);
  assert.match(boundaryDoc, /GitHub Worker-bundle releases/);
  assert.match(structureDoc, /`deploy\/` holds reviewed, installable deployment packages/);
});

test('session Worker docs keep immutable publication separate from latest promotion', () => {
  const workerDoc = read('docs/session-cors-worker.md');

  assert.match(workerDoc, /publish-worker-bundles\.yml[^\n]*publishes verified bundle/);
  assert.match(workerDoc, /promote-worker-bundles\.yml[^\n]*re-verifies/);
  assert.doesNotMatch(workerDoc, /publish-worker-bundles\.yml[^\n]*(?:marks|marked)[^\n]*latest/i);
});
