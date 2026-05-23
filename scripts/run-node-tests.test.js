'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { collectNodeTestFiles } = require('./run-node-tests');

function writeFile(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, '// test fixture\n');
}

function withTempRepo(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-node-tests-'));
  try {
    return run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('collectNodeTestFiles includes static, script, and e2e helper tests when present', () => {
  withTempRepo((rootDir) => {
    writeFile(rootDir, 'test/arweave-metadata-uri.test.js');
    writeFile(rootDir, 'test/client.package.test.js');
    writeFile(rootDir, 'test/deployHelperOrigins.test.mjs');
    writeFile(rootDir, 'test/e2eTestIds.compat.test.js');
    writeFile(rootDir, 'test/rpcDefaults.compat.test.js');
    writeFile(rootDir, 'test/sessionCorsWorker.faucet-proof.test.mjs');
    writeFile(rootDir, 'test/sessionCorsWorker.package.test.js');
    writeFile(rootDir, 'test/private-runtime.private.test.mjs');
    writeFile(rootDir, 'scripts/verify-test-wiring.test.js');
    writeFile(rootDir, 'scripts/run-node-tests.test.js');
    writeFile(rootDir, 'scripts/lib/e2e/tx.test.js');
    writeFile(rootDir, 'scripts/lib/e2e/network-default-consumers.test.js');
    writeFile(rootDir, 'scripts/lib/e2e/worker-auth.test.js');

    assert.deepEqual(collectNodeTestFiles(rootDir), [
      'test/arweave-metadata-uri.test.js',
      'test/client.package.test.js',
      'test/deployHelperOrigins.test.mjs',
      'test/e2eTestIds.compat.test.js',
      'test/rpcDefaults.compat.test.js',
      'test/sessionCorsWorker.faucet-proof.test.mjs',
      'test/sessionCorsWorker.package.test.js',
      'test/private-runtime.private.test.mjs',
      path.join('scripts', 'run-node-tests.test.js'),
      path.join('scripts', 'verify-test-wiring.test.js'),
      path.join('scripts', 'lib', 'e2e', 'network-default-consumers.test.js'),
      path.join('scripts', 'lib', 'e2e', 'tx.test.js'),
      path.join('scripts', 'lib', 'e2e', 'worker-auth.test.js'),
    ]);
  });
});

test('collectNodeTestFiles tolerates stripped public copies without optional helper directories', () => {
  withTempRepo((rootDir) => {
    writeFile(rootDir, 'test/arweave-metadata-uri.test.js');
    writeFile(rootDir, 'test/sessionCorsWorker.package.test.js');
    writeFile(rootDir, 'scripts/verify-worker-bundle-sync.test.js');

    const files = collectNodeTestFiles(rootDir);
    assert.deepEqual(files, [
      'test/arweave-metadata-uri.test.js',
      'test/sessionCorsWorker.package.test.js',
      path.join('scripts', 'verify-worker-bundle-sync.test.js'),
    ]);
    assert.equal(files.some((entry) => entry.includes('*')), false);
    assert.equal(files.some((entry) => entry.includes(path.join('scripts', 'lib', 'e2e'))), false);
  });
});
