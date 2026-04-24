'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  collectContextEngineCcTestFiles,
  hasRunnableContextEngineCc,
  REQUIRED_CONTEXTENGINE_CC_FILES,
} = require('./run-contextengine-cc-tests');

function writeFile(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, '// test fixture\n');
}

function withTempRepo(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-cc-node-tests-'));
  try {
    return run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('collectContextEngineCcTestFiles finds nested CE-CC tests without package metadata', () => {
  withTempRepo((rootDir) => {
    writeFile(rootDir, 'contextEngine-cc/test/server.static-assets.test.mjs');
    writeFile(rootDir, 'contextEngine-cc/lib/router.regressions.test.mjs');
    writeFile(rootDir, 'contextEngine-cc/hook/manual-question.test.mjs');
    writeFile(rootDir, 'contextEngine-cc/README.md');

    assert.deepEqual(collectContextEngineCcTestFiles(rootDir), [
      path.join('contextEngine-cc', 'hook', 'manual-question.test.mjs'),
      path.join('contextEngine-cc', 'lib', 'router.regressions.test.mjs'),
      path.join('contextEngine-cc', 'test', 'server.static-assets.test.mjs'),
    ]);
  });
});

test('collectContextEngineCcTestFiles returns an empty list when CE-CC tests are absent', () => {
  withTempRepo((rootDir) => {
    assert.deepEqual(collectContextEngineCcTestFiles(rootDir), []);
  });
});

test('hasRunnableContextEngineCc requires the core CE-CC runtime files', () => {
  withTempRepo((rootDir) => {
    writeFile(rootDir, 'contextEngine-cc/test/server.static-assets.test.mjs');
    assert.equal(hasRunnableContextEngineCc(rootDir), false);

    REQUIRED_CONTEXTENGINE_CC_FILES.forEach((relativePath) => writeFile(rootDir, relativePath));
    assert.equal(hasRunnableContextEngineCc(rootDir), true);
  });
});
