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
          'test:node': 'node scripts/run-node-tests.js',
          'test:e2e': 'npm run -s test:e2e:smoke',
          'test:e2e:quick': 'npm run -s test:e2e:smoke',
          'test:e2e:smoke': 'npm run -s ai:test-nav:smoke',
          'ai:test-nav:smoke': 'node scripts/vite-navigation-smoke.js',
          'test:ci': 'npm run test:wiring && npm run verify:release && npm run test:node',
          tests: 'npm run test:ci && npm run test:surveys-sbt',
          'test:client': 'npm test -- --coverage',
          'worker:bundle': 'node scripts/worker-bundle.mjs',
          'deploy-helper:deploy': 'node scripts/deploy-helper-deploy.mjs',
          'verify:worker-bundle': 'node scripts/verify-worker-bundle-sync.mjs',
          'verify:release':
            'npm run lint && npm run worker:bundle && npm run verify:worker-bundle && npm --prefix client run build',
        },
      }),
    );
    writeFile(
      rootDir,
      '.github/workflows/ci.yml',
      [
        'steps:',
        '  - run: npm run worker:bundle',
        '  - run: npm run verify:worker-bundle',
        '  - run: npm run test:ci',
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

    [
      'test/deployHelperOrigins.test.mjs',
      'scripts/worker-bundle.mjs',
      'scripts/deploy-helper-deploy.mjs',
      'scripts/run-node-tests.js',
      'scripts/run-node-tests.test.js',
      'scripts/vite-navigation-smoke.js',
      'scripts/vite-navigation-smoke.test.js',
      'scripts/verify-worker-bundle-sync.mjs',
      'scripts/verify-worker-bundle-sync.test.js',
      'workers/deploy-helper/wrangler.example.toml',
      'workers/deploy-helper/.dev.vars.example',
      'workers/deploy-helper/LICENSE',
    ].forEach((relativePath) => writeFile(rootDir, relativePath));

    assert.deepEqual(verifyTestWiring(rootDir), []);
  });
});
