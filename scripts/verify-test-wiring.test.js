'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { verifyTestWiring } = require('./verify-test-wiring');

function writeFile(rootDir, relativePath, content = '// fixture\n') {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function withTempRepo(run) {
  const fixturesRoot = path.join(__dirname, '..', '.tmp');
  fs.mkdirSync(fixturesRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(fixturesRoot, 'ce-verify-wiring-'));
  try {
    return run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test('repo test wiring invariants hold', () => {
  assert.deepEqual(verifyTestWiring(), []);
});

test('agent bridge tests are reachable through root CI and the workers job', () => {
  const rootDir = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const workflow = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');

  assert.match(pkg.scripts['test:ci'], /npm run test:worker:agent-bridge/);
  assert.match(workflow, /run: npm run test:worker:agent-bridge/);
});

test('agent bridge runner skips cleanly when a public artifact omits the worker', () => {
  const { runAgentBridgeWorkerTests } = require('./run-agent-bridge-worker-tests');

  withTempRepo((rootDir) => {
    assert.equal(runAgentBridgeWorkerTests(rootDir), 0);
  });
});

test('public-release style copies without .git still pass wiring checks', () => {
  withTempRepo((rootDir) => {
    writeFile(
      rootDir,
      'package.json',
      JSON.stringify({
        scripts: {
          'test:contracts':
            'forge test --match-contract "^(SurveysTest|CustomSBTTest|SessionRegistryTest|SurveysFuzzTest|CustomSBTFuzzTest|SessionRegistryFuzzTest|CustomSBTInvariantTest)$"',
          'abi:check': 'node scripts/verify-abi-sync.mjs',
          'verify:abi-sync': 'forge build && npm run -s abi:check',
          'test:root:jest':
            "cd client && npm test -- --watchAll=false --runInBand --testMatch '<rootDir>/../tests/root/deployHelper.worker.test.js' '<rootDir>/../tests/root/sessionCorsWorker.auth.test.js'",
          'test:worker:session-cors': 'npm --prefix workers/sessionCorsWorker test',
          'test:worker:agent-bridge': 'node scripts/run-agent-bridge-worker-tests.js',
          'test:node': 'node scripts/run-node-tests.js',
          'test:node:tracked': 'node scripts/run-node-tests.js --tracked-only',
          'client-boundaries:check': 'node scripts/check-client-boundaries.mjs',
          'dead-exports:advisory': 'node scripts/check-dead-exports-advisory.mjs',
          'dead-exports:check': 'node scripts/check-dead-exports-advisory.mjs --check',
          'test:e2e': 'npm run -s test:e2e:smoke',
          'test:e2e:quick': 'npm run -s test:e2e:smoke',
          'test:e2e:smoke': 'npm run -s ai:test-nav:smoke',
          'ai:test-nav:smoke': 'node scripts/vite-navigation-smoke.js',
          'test:ci':
            'npm run test:wiring && npm run type-debt:check && npm run verify:release && npm run verify:abi-sync && npm run test:client && npm run coverage-floor:check && npm run test:root:jest && npm run test:worker:session-cors && npm run test:worker:agent-bridge && npm run test:node',
          'test:wiring':
            'node scripts/verify-test-wiring.js && node scripts/verify-test-inventory.js && npm run -s client-boundaries:check && npm run -s dead-exports:check',
          tests: 'npm run test:ci && npm run test:surveys-sbt',
          'test:client': 'npm test -- --coverage',
          'typecheck:client': 'npm --prefix client run typecheck',
          'worker:bundle': 'node scripts/worker-bundle.mjs',
          'deploy-helper:deploy': 'node scripts/deploy-helper-deploy.mjs',
          'verify:worker-bundle': 'node scripts/verify-worker-bundle-sync.mjs',
          'verify:public-release-surface': 'node scripts/verify-public-release-surface.js',
          'verify:public-assets': 'node scripts/verify-public-assets.js',
          'verify:public-text': 'node scripts/verify-public-text.js',
          'verify:public-release-pii': 'bash scripts/verify-public-release-pii.sh',
          'verify:release':
            'npm run lint && npm run typecheck:client && npm run -s test:node:tracked && npm run test:release:client && npm run verify:public-release-surface && npm run verify:public-assets && npm run worker:bundle && npm run verify:worker-bundle && npm --prefix client run build',
        },
      }),
    );
    writeFile(
      rootDir,
      '.github/workflows/ci.yml',
      [
        'jobs:',
        '  wiring-and-release:',
        '    steps:',
        '      - uses: actions/checkout@v4',
        '        with:',
        '          fetch-depth: 0',
        '      - run: npm run test:wiring',
        '      - run: npm run type-debt:check',
        '      - run: node scripts/resolve-baseline-growth-approval.mjs',
        '      - env:',
        '          BASELINE_MONOTONICITY_BASE: ${{ github.event_name == \'pull_request\' && github.event.pull_request.base.sha || github.event.before }}',
        '          BASELINE_MONOTONICITY_APPROVED: ${{ steps.baseline-growth-approval.outputs.approved }}',
        '        run: node scripts/check-baseline-monotonicity.mjs --require-base-sha',
        '      - run: npm run lint',
        '      - run: npm run typecheck:client',
        '      - run: npm run verify:public-release-surface',
        '      - run: npm run verify:public-assets',
        '      - run: npm run verify:public-text',
        '      - run: npm run worker:bundle',
        '      - run: npm run verify:worker-bundle',
        '      - run: npm --prefix client run build',
        '  contracts:',
        '    steps:',
        '      - run: npm run test:contracts',
        '      - run: npm run verify:abi-sync',
        '  client:',
        '    steps:',
        '      - run: npm run ci:gate -- client',
        '      - uses: actions/upload-artifact@1111111111111111111111111111111111111111',
        '        with:',
        '          path: client/coverage/lcov.info',
        '  root-jest:',
        '    steps:',
        '      - run: npm run ci:gate -- root-jest',
        '  workers:',
        '    steps:',
        '      - run: npm run test:worker:session-cors',
        '      - run: npm run test:worker:agent-bridge',
        '  cecc-and-node:',
        '    steps:',
        '      - run: npm run test:node',
        '      - run: npm run test:cache-guard',
        '      - continue-on-error: true',
        '        run: npm run dead-exports:advisory',
        '  test:',
        '    needs:',
        '      - wiring-and-release',
        '      - contracts',
        '      - client',
        '      - root-jest',
        '      - workers',
        '      - cecc-and-node',
        '    if: ${{ always() }}',
        '    steps:',
        '      - env:',
        '          CI_GATE_RESULTS_JSON: {"wiring-and-release":"${{ needs.wiring-and-release.result }}","public-text":"${{ needs.wiring-and-release.result }}"}',
        '        run: npm run ci:gates:check-hosted',
        '      - run: node scripts/worker-release-artifacts.mjs resolve-source',
        '      - run: node scripts/worker-release-artifacts.mjs create',
        '      - uses: actions/upload-artifact@1111111111111111111111111111111111111111',
        '        with:',
        '          name: worker-bundles-${{ github.sha }}',
      ].join('\n'),
    );
    writeFile(
      rootDir,
      '.github/CODEOWNERS',
      [
        '/.github/workflows/ci.yml @AgalmicSoftware',
        '/scripts/check-baseline-monotonicity.mjs @AgalmicSoftware',
        '/scripts/resolve-baseline-growth-approval.mjs @AgalmicSoftware',
        '/scripts/client-boundaries-baseline.json @AgalmicSoftware',
        '/scripts/type-debt-baseline.json @AgalmicSoftware',
        '/scripts/dead-exports-baseline.json @AgalmicSoftware',
        '/scripts/verify-abi-sync.mjs @AgalmicSoftware',
        '/client/src/contractsABI/ @AgalmicSoftware',
        '/contracts/ @AgalmicSoftware',
      ].join('\n'),
    );
    writeFile(
      rootDir,
      '.github/workflows/publish-worker-bundles.yml',
      [
        'steps:',
        '  - run: npm run worker:bundle',
        '  - run: npm run verify:worker-bundle',
        '  - uses: softprops/action-gh-release@v2',
        '    with:',
        '      make_latest: true',
        '      files: |',
        '        dist/sessionCorsWorker.bundle.js',
        '        dist/deployHelper.bundle.js',
        '        dist/agentBridgeWorker.bundle.js',
      ].join('\n'),
    );
    writeFile(
      rootDir,
      'scripts/sync-public-history.sh',
      [
        '#!/usr/bin/env bash',
        'verify_public_test_wiring() {',
        '  npm run test:wiring',
        '}',
        'verify_public_type_debt() {',
        '  npm run type-debt:check',
        '}',
        'verify_public_assets() {',
        '  node scripts/verify-public-assets.js',
        '}',
        'verify_public_text() {',
        '  node scripts/verify-public-text.js',
        '}',
      ].join('\n'),
    );

    [
      'tests/root/deployHelperOrigins.test.mjs',
      'scripts/worker-bundle.mjs',
      'scripts/deploy-helper-deploy.mjs',
      'scripts/run-node-tests.js',
      'scripts/run-node-tests.test.js',
      'scripts/pre-push-guard.test.js',
      'scripts/check-client-boundaries.mjs',
      'scripts/check-client-boundaries.test.mjs',
      'scripts/client-boundaries-baseline.json',
      'scripts/check-type-debt-ratchet.mjs',
      'scripts/check-coverage-floor.mjs',
      'scripts/check-coverage-floor.test.mjs',
      'scripts/coverage-baseline.json',
      'scripts/check-dead-exports-advisory.mjs',
      'scripts/check-dead-exports-advisory.test.mjs',
      'scripts/dead-exports-baseline.json',
      'scripts/check-baseline-monotonicity.mjs',
      'scripts/check-baseline-monotonicity.test.mjs',
      'scripts/resolve-baseline-growth-approval.mjs',
      'scripts/resolve-baseline-growth-approval.test.mjs',
      'scripts/verify-abi-sync.mjs',
      'scripts/verify-abi-sync.test.mjs',
      'scripts/testInventoryConfig.js',
      'scripts/verify-test-inventory.js',
      'scripts/verify-test-inventory.test.js',
      'scripts/vite-navigation-smoke.js',
      'scripts/vite-navigation-smoke.test.js',
      'scripts/verify-worker-bundle-sync.mjs',
      'scripts/verify-worker-bundle-sync.test.js',
      'scripts/verify-public-release-surface.js',
      'scripts/verify-public-release-surface.test.js',
      'scripts/verify-public-docs.js',
      'scripts/verify-public-docs.test.js',
      'scripts/verify-public-assets.js',
      'scripts/verify-public-assets.test.js',
      'scripts/verify-public-text.js',
      'scripts/verify-public-text.test.js',
      'scripts/verify-public-release-pii.sh',
      'scripts/verify-public-release-pii.test.js',
      'scripts/run-agent-bridge-worker-tests.js',
      'workers/sessionCorsWorker/package.json',
      'workers/agentBridgeWorker/package.json',
      'workers/deploy-helper/wrangler.example.toml',
      'workers/deploy-helper/.dev.vars.example',
      'workers/deploy-helper/LICENSE',
    ].forEach((relativePath) => writeFile(rootDir, relativePath));

    assert.deepEqual(verifyTestWiring(rootDir), []);
  });
});
