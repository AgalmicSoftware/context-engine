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
  ROOT_OPTIONAL_NODE_TEST_FILES,
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

  const packageFixture = {
    scripts: {
      'test:contracts': 'SurveysTest CustomSBTTest SessionRegistryTest SurveysFuzzTest CustomSBTFuzzTest SessionRegistryFuzzTest CustomSBTInvariantTest',
      'test:node': 'node scripts/run-node-tests.js',
      'test:node:tracked': 'node scripts/run-node-tests.js --tracked-only',
      'test:root:jest': `cd client && npm test -- --watchAll=false --runInBand --testMatch ${
        ROOT_JEST_TEST_FILES.map((relativePath) => `'<rootDir>/${path.join('..', relativePath)}'`).join(' ')
      }`,
      'test:worker:session-cors': 'npm --prefix workers/sessionCorsWorker test',
      'test:worker:agent-bridge': 'node scripts/run-agent-bridge-worker-tests.js',
      'test:e2e': 'npm run -s test:e2e:smoke',
      'test:e2e:quick': 'npm run -s test:e2e:smoke',
      'test:e2e:smoke': 'npm run -s ai:test-nav:smoke',
      'ai:test-nav:smoke': 'node scripts/vite-navigation-smoke.js',
      'test:client': 'npm --prefix client run test:coverage:full-universe',
      'test:release:client': 'cd client && npm test -- --watchAll=false --runInBand',
      'test:cache-guard': 'bash ./scripts/check-managed-cache-localstorage.sh',
      'typecheck:client-tests': 'node scripts/check-client-test-types.mjs',
      'coverage-floor:check': 'node scripts/check-client-coverage-floors.mjs',
      'ci:gate': 'node scripts/run-ci-gates.mjs --gate',
      'test:ci': 'node scripts/run-ci-gates.mjs --profile ci',
      'test:wiring': 'node scripts/verify-test-wiring.js && node scripts/verify-test-inventory.js',
      tests: 'npm run test:ci',
    },
  };
  const packageOverrides = overrides.packageJson || {};
  writeJson(rootDir, 'package.json', {
    ...packageFixture,
    ...packageOverrides,
    scripts: {
      ...packageFixture.scripts,
      ...(packageOverrides.scripts || {}),
    },
  });
  writeJson(rootDir, 'scripts/ci-gates.json', {
    schemaVersion: 1,
    profiles: {
      ci: ['wiring-and-release', 'contracts', 'client', 'root-jest', 'workers', 'cecc-and-node'],
      hosted: ['wiring-and-release', 'contracts', 'client', 'root-jest', 'workers', 'e2e-smoke', 'cecc-and-node'],
    },
    gates: {
      contracts: {
        commands: [{ label: 'contracts', command: 'npm', args: ['run', 'test:contracts'] }],
      },
      client: {
        commands: [
          { label: 'client', command: 'npm', args: ['run', 'test:client'] },
          { label: 'coverage', command: 'npm', args: ['run', 'coverage-floor:check'] },
        ],
      },
      'root-jest': {
        commands: [{ label: 'root', command: 'npm', args: ['run', 'test:root:jest'] }],
      },
      workers: {
        commands: [
          { label: 'worker', command: 'npm', args: ['run', 'test:worker:session-cors'] },
          { label: 'agent', command: 'npm', args: ['run', 'test:worker:agent-bridge'] },
        ],
      },
      'wiring-and-release': {
        commands: [
          { label: 'wiring', command: 'npm', args: ['run', 'test:wiring'] },
          { label: 'types', command: 'npm', args: ['run', 'typecheck:client-tests'] },
        ],
      },
      'e2e-smoke': {
        commands: [{ label: 'e2e', command: 'npm', args: ['run', 'test:e2e:smoke'] }],
      },
      'cecc-and-node': {
        commands: [
          { label: 'node', command: 'npm', args: ['run', 'test:node:tracked'] },
          { label: 'cache', command: 'npm', args: ['run', 'test:cache-guard'] },
        ],
      },
      release: {
        commands: [
          { label: 'types', command: 'npm', args: ['run', 'typecheck:client-tests'] },
          { label: 'node', command: 'npm', args: ['run', 'test:node:tracked'] },
          { label: 'client', command: 'npm', args: ['run', 'test:release:client'] },
        ],
      },
    },
  });
  writeFile(rootDir, '.github/workflows/ci.yml', [
    'run: npm run ci:gate -- contracts',
    'run: npm run ci:gate -- client',
    'run: npm run ci:gate -- root-jest',
    'run: npm run ci:gate -- workers',
    'npm run ci:gate -- e2e-smoke',
    'run: npm run ci:gate -- cecc-and-node',
    '  test:',
    'needs:',
    'if: ${{ always() }}',
    'CI_GATE_RESULTS_JSON:',
    'run: npm run ci:gates:check-hosted',
  ].join('\n'));
}

test('repo test inventory invariants hold', () => {
  assert.deepEqual(verifyTestInventory(), []);
});

test('verifyTestInventory tolerates stripped public copies without private runtime tests', () => {
  withTempRepo((rootDir) => {
    writeInventoryFixture(rootDir, { includePrivateRuntime: false });

    ROOT_OPTIONAL_NODE_TEST_FILES.forEach((relativePath) => {
      assert.equal(fs.existsSync(path.join(rootDir, relativePath)), false);
    });
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

test('verifyTestInventory flags recursively nested unclassified root tests', () => {
  withTempRepo((rootDir) => {
    writeInventoryFixture(rootDir);
    writeFile(rootDir, 'tests/root/nested/new-unwired.test.mjs');

    assert.deepEqual(verifyTestInventory(rootDir), [
      'unclassified root test files: tests/root/nested/new-unwired.test.mjs',
    ]);
  });
});

test('verifyTestInventory owns canonical test runner and CI-gate reachability', () => {
  withTempRepo((rootDir) => {
    writeInventoryFixture(rootDir);
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    delete pkg.scripts['test:worker:agent-bridge'];
    writeJson(rootDir, 'package.json', pkg);

    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'scripts/ci-gates.json'), 'utf8'));
    manifest.profiles.ci = manifest.profiles.ci.filter((gateName) => gateName !== 'client');
    manifest.gates.workers.commands = manifest.gates.workers.commands
      .filter((entry) => entry.args.join(' ') !== 'run test:worker:agent-bridge');
    writeJson(rootDir, 'scripts/ci-gates.json', manifest);
    writeFile(rootDir, '.github/workflows/ci.yml', fs.readFileSync(
      path.join(rootDir, '.github/workflows/ci.yml'),
      'utf8',
    ).replace('run: npm run ci:gates:check-hosted', 'run: true'));

    assert.deepEqual(verifyTestInventory(rootDir), [
      'package.json missing scripts.test:worker:agent-bridge',
      'scripts/ci-gates.json profile "ci" must include "client"',
      'scripts/ci-gates.json gate "workers" must run test:worker:agent-bridge',
      '.github/workflows/ci.yml must include the manifest-backed aggregate checker',
    ]);
  });
});

test('verifyTestInventory rejects root scripts that expose non-public worker paths', () => {
  withTempRepo((rootDir) => {
    writeInventoryFixture(rootDir, {
      packageJson: {
        scripts: {
          'test:private-worker': 'node --test workers/privateWorker/*.test.mjs',
        },
      },
    });

    assert.deepEqual(verifyTestInventory(rootDir), [
      'root package scripts must not reference non-public worker package paths: workers/privateWorker',
    ]);
  });
});
