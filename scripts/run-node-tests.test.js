'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  collectNodeTestFiles,
  parseRunNodeTestsArgs,
  partitionNodeTestFiles,
} = require('./run-node-tests');

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

test('collectNodeTestFiles recursively includes classified root, script, and shared-worker tests', () => {
  withTempRepo((rootDir) => {
    writeFile(rootDir, 'tests/root/arweave-metadata-uri.test.js');
    writeFile(rootDir, 'tests/root/client.package.test.js');
    writeFile(rootDir, 'tests/root/deployHelperOrigins.test.mjs');
    writeFile(rootDir, 'tests/root/e2eTestIds.compat.test.js');
    writeFile(rootDir, 'tests/root/rpcDefaults.compat.test.js');
    writeFile(rootDir, 'tests/root/sessionCorsWorker.faucet-proof.test.mjs');
    writeFile(rootDir, 'tests/root/sessionCorsWorker.package.test.js');
    writeFile(rootDir, 'tests/root/private-runtime.private.test.mjs');
    writeFile(rootDir, 'scripts/verify-test-wiring.test.js');
    writeFile(rootDir, 'scripts/verify-public-release-pii.test.js');
    writeFile(rootDir, 'scripts/run-node-tests.test.js');
    writeFile(rootDir, 'scripts/lib/e2e/tx.test.js');
    writeFile(rootDir, 'scripts/lib/e2e/network-default-consumers.test.js');
    writeFile(rootDir, 'scripts/lib/e2e/worker-auth.test.js');
    writeFile(rootDir, 'scripts/nested/recovery/checkpoint.test.mjs');
    writeFile(rootDir, 'scripts/e2e/cloudflare/session-worker-ui.test.js');
    writeFile(rootDir, 'scripts/e2e/cloudflare/worker-login-result.test.js');
    writeFile(rootDir, 'workers/shared/deployHelperEndpointConfig.test.mjs');
    writeFile(rootDir, 'workers/shared/provenance/manifest.test.mjs');

    assert.deepEqual(collectNodeTestFiles(rootDir), [
      'tests/root/arweave-metadata-uri.test.js',
      'tests/root/client.package.test.js',
      'tests/root/deployHelperOrigins.test.mjs',
      'tests/root/e2eTestIds.compat.test.js',
      'tests/root/rpcDefaults.compat.test.js',
      'tests/root/sessionCorsWorker.faucet-proof.test.mjs',
      'tests/root/sessionCorsWorker.package.test.js',
      'tests/root/private-runtime.private.test.mjs',
      path.join('scripts', 'run-node-tests.test.js'),
      path.join('scripts', 'verify-test-wiring.test.js'),
      path.join('scripts', 'lib', 'e2e', 'network-default-consumers.test.js'),
      path.join('scripts', 'lib', 'e2e', 'tx.test.js'),
      path.join('scripts', 'lib', 'e2e', 'worker-auth.test.js'),
      path.join('scripts', 'nested', 'recovery', 'checkpoint.test.mjs'),
      path.join('scripts', 'pre-push-guard.test.js'),
      path.join('scripts', 'run-node-tests.test.js'),
      path.join('scripts', 'verify-public-release-pii.test.js'),
      path.join('scripts', 'verify-test-wiring.test.js'),
    ]);
    assert.equal(new Set(collectNodeTestFiles(rootDir)).size, collectNodeTestFiles(rootDir).length);
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

test('collectNodeTestFiles can filter to git-tracked node tests', () => {
  withTempRepo((rootDir) => {
    execFileSync('git', ['init'], { cwd: rootDir, stdio: 'ignore' });
    writeFile(rootDir, 'tests/root/arweave-metadata-uri.test.js');
    writeFile(rootDir, 'scripts/verify-worker-bundle-sync.test.js');
    writeFile(rootDir, 'scripts/untracked-local.test.js');
    execFileSync('git', ['add', 'tests/root/arweave-metadata-uri.test.js', 'scripts/verify-worker-bundle-sync.test.js'], {
      cwd: rootDir,
      stdio: 'ignore',
    });

    assert.deepEqual(collectNodeTestFiles(rootDir, { trackedOnly: true }), [
      'tests/root/arweave-metadata-uri.test.js',
      path.join('scripts', 'verify-worker-bundle-sync.test.js'),
    ]);
  });
});

test('tracked-only collection excludes tests matched by public strip patterns', () => {
  withTempRepo((rootDir) => {
    execFileSync('git', ['init'], { cwd: rootDir, stdio: 'ignore' });
    writeFile(rootDir, 'tests/root/arweave-metadata-uri.test.js');
    writeFile(rootDir, 'scripts/lib/e2e/wallets.test.js');
    const helperPath = path.join(rootDir, 'scripts/lib/public-release-strip-patterns.sh');
    fs.mkdirSync(path.dirname(helperPath), { recursive: true });
    fs.writeFileSync(helperPath, [
      '#!/usr/bin/env bash',
      'ce_public_release_strip_patterns() {',
      "  printf '%s\\n' scripts/lib/e2e",
      '}',
      '',
    ].join('\n'));
    execFileSync('git', ['add', 'tests/root/arweave-metadata-uri.test.js', 'scripts/lib/e2e/wallets.test.js'], {
      cwd: rootDir,
      stdio: 'ignore',
    });

    assert.deepEqual(collectNodeTestFiles(rootDir, { trackedOnly: true }), [
      'tests/root/arweave-metadata-uri.test.js',
    ]);
  });
});

test('parseRunNodeTestsArgs accepts tracked-only flag or env opt-in', () => {
  assert.deepEqual(parseRunNodeTestsArgs(['--tracked-only'], {}), {
    trackedOnly: true,
    unknownArgs: [],
  });
  assert.deepEqual(parseRunNodeTestsArgs([], { CE_NODE_TESTS_TRACKED_ONLY: '1' }), {
    trackedOnly: true,
    unknownArgs: [],
  });
  assert.deepEqual(parseRunNodeTestsArgs(['--unknown'], {}), {
    trackedOnly: false,
    unknownArgs: ['--unknown'],
  });
});

test('partitionNodeTestFiles isolates Git-heavy history tests from concurrent files', () => {
  assert.deepEqual(partitionNodeTestFiles([
    'scripts/verify-test-wiring.test.js',
    path.join('scripts', 'sync-public-history.test.js'),
    'tests/root/client.package.test.js',
  ]), {
    concurrentFiles: [
      'scripts/verify-test-wiring.test.js',
      'tests/root/client.package.test.js',
    ],
    serialFiles: [path.join('scripts', 'sync-public-history.test.js')],
  });
});
