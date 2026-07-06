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
    writeFile(rootDir, 'tests/root/arweave-metadata-uri.test.js');
    writeFile(rootDir, 'tests/root/client.package.test.js');
    writeFile(rootDir, 'tests/root/deployHelperOrigins.test.mjs');
    writeFile(rootDir, 'tests/root/e2eTestIds.compat.test.js');
    writeFile(rootDir, 'tests/root/rpcDefaults.compat.test.js');
    writeFile(rootDir, 'tests/root/sessionCorsWorker.faucet-proof.test.mjs');
    writeFile(rootDir, 'tests/root/sessionCorsWorker.package.test.js');
    writeFile(rootDir, 'tests/root/private-runtime.private.test.mjs');
    writeFile(rootDir, 'scripts/pre-push-guard.test.js');
    writeFile(rootDir, 'scripts/verify-test-wiring.test.js');
    writeFile(rootDir, 'scripts/verify-public-release-pii.test.js');
    writeFile(rootDir, 'scripts/run-node-tests.test.js');
    writeFile(rootDir, 'scripts/lib/e2e/tx.test.js');
    writeFile(rootDir, 'scripts/lib/e2e/network-default-consumers.test.js');
    writeFile(rootDir, 'scripts/lib/e2e/worker-auth.test.js');

    assert.deepEqual(collectNodeTestFiles(rootDir), [
      'tests/root/arweave-metadata-uri.test.js',
      'tests/root/client.package.test.js',
      'tests/root/deployHelperOrigins.test.mjs',
      'tests/root/e2eTestIds.compat.test.js',
      'tests/root/rpcDefaults.compat.test.js',
      'tests/root/sessionCorsWorker.faucet-proof.test.mjs',
      'tests/root/sessionCorsWorker.package.test.js',
      'tests/root/private-runtime.private.test.mjs',
      path.join('scripts', 'pre-push-guard.test.js'),
      path.join('scripts', 'run-node-tests.test.js'),
      path.join('scripts', 'verify-public-release-pii.test.js'),
      path.join('scripts', 'verify-test-wiring.test.js'),
      path.join('scripts', 'lib', 'e2e', 'network-default-consumers.test.js'),
      path.join('scripts', 'lib', 'e2e', 'tx.test.js'),
      path.join('scripts', 'lib', 'e2e', 'worker-auth.test.js'),
    ]);
  });
});

test('collectNodeTestFiles tolerates stripped public copies without optional helper directories', () => {
  withTempRepo((rootDir) => {
    writeFile(rootDir, 'tests/root/arweave-metadata-uri.test.js');
    writeFile(rootDir, 'tests/root/sessionCorsWorker.package.test.js');
    writeFile(rootDir, 'scripts/verify-worker-bundle-sync.test.js');

    const files = collectNodeTestFiles(rootDir);
    assert.deepEqual(files, [
      'tests/root/arweave-metadata-uri.test.js',
      'tests/root/sessionCorsWorker.package.test.js',
      path.join('scripts', 'verify-worker-bundle-sync.test.js'),
    ]);
    assert.equal(files.some((entry) => entry.includes('*')), false);
    assert.equal(files.some((entry) => entry.includes(path.join('scripts', 'lib', 'e2e'))), false);
  });
});
