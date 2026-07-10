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

test('public-release style copies without .git still pass wiring checks', () => {
  withTempRepo((rootDir) => {
    writeFile(
      rootDir,
      'package.json',
      JSON.stringify({
        scripts: {
          'test:surveys-sbt':
            'src/utilities/web3/contractScripts.surveys-sbt.proxy.test.js',
          'test:contracts':
            'forge test --match-contract "^(SurveysTest|CustomSBTTest|SessionRegistryTest|SurveysFuzzTest|CustomSBTFuzzTest|SessionRegistryFuzzTest|CustomSBTInvariantTest)$"',
          'test:root:jest':
            "cd client && npm test -- --watchAll=false --runInBand --testMatch '<rootDir>/../tests/root/deployHelper.worker.test.js' '<rootDir>/../tests/root/sessionCorsWorker.auth.test.js'",
          'test:worker:session-cors': 'npm --prefix workers/sessionCorsWorker test',
          'test:node': 'node scripts/run-node-tests.js',
          'test:node:tracked': 'node scripts/run-node-tests.js --tracked-only',
          'client-boundaries:check': 'node scripts/check-client-boundaries.mjs',
          'dead-exports:advisory': 'node scripts/check-dead-exports-advisory.mjs',
          'dead-exports:check': 'node scripts/check-dead-exports-advisory.mjs --check',
          'test:e2e': 'npm run -s test:e2e:smoke',
          'test:e2e:quick': 'npm run -s test:e2e:smoke',
          'test:e2e:smoke': 'npm run -s ai:test-nav:smoke',
          'ai:test-nav:smoke': 'node scripts/vite-navigation-smoke.js',
          'type-debt:check': 'node scripts/check-type-debt-ratchet.mjs',
          'coverage-floor:check': 'node scripts/check-coverage-floor.mjs',
          'test:ci':
            'npm run test:wiring && npm run type-debt:check && npm run verify:release && npm run test:client && npm run coverage-floor:check && npm run test:root:jest && npm run test:worker:session-cors && npm run test:node',
          'test:wiring':
            'node scripts/verify-test-wiring.js && node scripts/verify-test-inventory.js && npm run -s client-boundaries:check && npm run -s dead-exports:check',
          tests: 'npm run test:ci && npm run test:surveys-sbt',
          'test:client': 'npm test -- --coverage --coverageReporters=json-summary',
          'test:release:client':
            'cd client && npm test -- --watchAll=false --runInBand',
          'typecheck:client': 'npm --prefix client run typecheck',
          'worker:bundle': 'node scripts/worker-bundle.mjs',
          'deploy-helper:deploy': 'node scripts/deploy-helper-deploy.mjs',
          'verify:worker-bundle': 'node scripts/verify-worker-bundle-sync.mjs',
          'verify:public-release-surface': 'node scripts/verify-public-release-surface.js',
          'verify:public-release-pii': 'bash scripts/verify-public-release-pii.sh',
          'verify:release':
            'npm run lint && npm run typecheck:client && npm run -s test:node:tracked && npm run test:release:client && npm run verify:public-release-surface && npm run worker:bundle && npm run verify:worker-bundle && npm --prefix client run build',
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
        '      - env:',
        '          BASELINE_MONOTONICITY_BASE: ${{ github.event.pull_request.base.sha || \'origin/main\' }}',
        '        run: |',
        '          BASELINE_MONOTONICITY_COMMIT_TEXT="$(git log --format=%B "$BASELINE_MONOTONICITY_BASE"..HEAD || true)"',
        '          node scripts/check-baseline-monotonicity.mjs',
        '      - run: npm run lint',
        '      - run: npm run typecheck:client',
        '      - run: npm run verify:public-release-surface',
        '      - run: npm run worker:bundle',
        '      - run: npm run verify:worker-bundle',
        '      - run: npm --prefix client run build',
        '  contracts:',
        '    steps:',
        '      - run: npm run test:contracts',
        '  client:',
        '    steps:',
        '      - run: npm run test:client',
        '      - run: npm run coverage-floor:check',
        '      - uses: actions/upload-artifact@v4',
        '        with:',
        '          path: client/coverage/lcov.info',
        '  root-jest:',
        '    steps:',
        '      - run: npm run test:root:jest',
        '  workers:',
        '    steps:',
        '      - run: npm run test:worker:session-cors',
        '  cecc-and-node:',
        '    steps:',
        '      - run: npm run test:cc',
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
        '          WIRING_AND_RELEASE_RESULT: ${{ needs.wiring-and-release.result }}',
        '          CECC_AND_NODE_RESULT: ${{ needs.cecc-and-node.result }}',
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
      'scripts/testInventoryConfig.js',
      'scripts/verify-test-inventory.js',
      'scripts/verify-test-inventory.test.js',
      'scripts/vite-navigation-smoke.js',
      'scripts/vite-navigation-smoke.test.js',
      'scripts/verify-worker-bundle-sync.mjs',
      'scripts/verify-worker-bundle-sync.test.js',
      'scripts/verify-public-release-surface.js',
      'scripts/verify-public-release-surface.test.js',
      'scripts/verify-public-release-pii.sh',
      'scripts/verify-public-release-pii.test.js',
      'workers/sessionCorsWorker/package.json',
      'workers/deploy-helper/wrangler.example.toml',
      'workers/deploy-helper/.dev.vars.example',
      'workers/deploy-helper/LICENSE',
    ].forEach((relativePath) => writeFile(rootDir, relativePath));

    assert.deepEqual(verifyTestWiring(rootDir), []);
  });
});
