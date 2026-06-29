'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  ROOT_JEST_TEST_FILES,
  ROOT_LOCAL_CHAIN_TEST_FILES,
  ROOT_NODE_TEST_FILES,
} = require('./testInventoryConfig');
const { verifyTestInventory } = require('./verify-test-inventory');

const PRIVATE_STRIPPED_TEST_FIXTURE = 'tests/root/private-runtime.private.test.mjs';

function writeFile(rootDir, relativePath, content = '// fixture\n') {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function writeJson(rootDir, relativePath, value) {
  writeFile(rootDir, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function withTempRepo(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-test-inventory-'));
  try {
    return run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeInventoryFixture(rootDir, overrides = {}) {
  [
    ...ROOT_NODE_TEST_FILES,
    ...ROOT_JEST_TEST_FILES,
    ...ROOT_LOCAL_CHAIN_TEST_FILES,
    ...(overrides.includePrivateRuntime === false ? [] : [PRIVATE_STRIPPED_TEST_FIXTURE]),
  ].forEach((relativePath) => writeFile(rootDir, relativePath));

  if (overrides.includePrivateRuntime !== false) {
    writeFile(rootDir, path.join('contextEngine-cc', 'server.mjs'));
  }

  writeFile(rootDir, path.join('workers', 'sessionCorsWorker', 'worker.js'));
  writeFile(rootDir, path.join('workers', 'sessionCorsWorker', 'routeBaseHeaders.test.mjs'));
  writeJson(rootDir, path.join('workers', 'sessionCorsWorker', 'package.json'), {
    scripts: {
      test: 'node --test *.test.mjs',
    },
  });

  writeJson(rootDir, 'package.json', {
    scripts: {
      'test:root:jest': `cd client && npm test -- --watchAll=false --runInBand --testMatch ${
        ROOT_JEST_TEST_FILES.map((relativePath) => `'<rootDir>/${path.join('..', relativePath)}'`).join(' ')
      }`,
      'test:worker:session-cors': 'npm --prefix workers/sessionCorsWorker test',
      'test:ci': 'npm run test:root:jest && npm run test:worker:session-cors && npm run test:node',
      'test:node': 'node scripts/run-node-tests.js',
    },
    ...(overrides.packageJson || {}),
  });
}

test('repo test inventory invariants hold', () => {
  assert.deepEqual(verifyTestInventory(), []);
});

test('verifyTestInventory tolerates stripped public copies without private runtime tests', () => {
  withTempRepo((rootDir) => {
    writeInventoryFixture(rootDir, { includePrivateRuntime: false });

    assert.deepEqual(verifyTestInventory(rootDir), []);
  });
});

test('verifyTestInventory flags unclassified root tests', () => {
  withTempRepo((rootDir) => {
    writeInventoryFixture(rootDir);
    writeFile(rootDir, 'tests/root/new-unwired.test.js');

    assert.deepEqual(verifyTestInventory(rootDir), [
      'unclassified root test files: tests/root/new-unwired.test.js',
    ]);
  });
});

test('verifyTestInventory rejects root scripts that expose non-public worker paths', () => {
  withTempRepo((rootDir) => {
    writeInventoryFixture(rootDir, {
      packageJson: {
        scripts: {
          'test:root:jest': `cd client && npm test -- --watchAll=false --runInBand --testMatch ${
            ROOT_JEST_TEST_FILES.map((relativePath) => `'<rootDir>/${path.join('..', relativePath)}'`).join(' ')
          }`,
          'test:worker:session-cors': 'npm --prefix workers/sessionCorsWorker test',
          'test:private-worker': 'node --test workers/privateWorker/*.test.mjs',
          'test:ci': 'npm run test:root:jest && npm run test:worker:session-cors && npm run test:node',
          'test:node': 'node scripts/run-node-tests.js',
        },
      },
    });

    assert.deepEqual(verifyTestInventory(rootDir), [
      'root package scripts must not reference non-public worker package paths: workers/privateWorker',
    ]);
  });
});
