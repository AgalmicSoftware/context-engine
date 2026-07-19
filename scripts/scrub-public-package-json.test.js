'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scrubPublicPackageJson } = require('./scrub-public-package-json');

test('scrubPublicPackageJson uses source metadata to remove absent private commands', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-public-package-'));
  try {
    const targetPath = path.join(tempDir, 'target.json');
    const sourcePath = path.join(tempDir, 'source.json');
    fs.writeFileSync(targetPath, `${JSON.stringify({
      scripts: {
        'test:ci': 'npm run test:node && npm run test:cc',
        'test:node': 'node scripts/run-node-tests.js',
      },
    }, null, 2)}\n`);
    fs.writeFileSync(sourcePath, `${JSON.stringify({
      scripts: {
        'test:node': 'node scripts/run-node-tests.js',
        'test:cc': 'node scripts/run-contextengine-cc-tests.js',
        'test:ci': 'npm run test:node && npm run test:cc',
      },
    }, null, 2)}\n`);

    scrubPublicPackageJson(targetPath, sourcePath);

    const result = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    assert.deepEqual(Object.keys(result.scripts), ['test:node', 'test:ci']);
    assert.equal(result.scripts['test:ci'], 'npm run test:node');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
