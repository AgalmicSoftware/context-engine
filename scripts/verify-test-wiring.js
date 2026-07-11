const fs = require('fs');
const path = require('path');
const { execFileSync } = require('node:child_process');

function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function readText(rootDir, relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function listTrackedDistFiles(rootDir) {
  if (!fs.existsSync(path.join(rootDir, '.git'))) {
    return [];
  }

  return execFileSync('git', ['ls-files', 'dist'], {
    cwd: rootDir,
    encoding: 'utf8',
  }).split('\n').filter(Boolean);
}

function verifyTestWiring(rootDir = path.resolve(__dirname, '..')) {
  const failures = [];
  const pkg = readJson(rootDir, 'package.json');
  const scripts = pkg.scripts || {};
  const workflow = readText(rootDir, '.github/workflows/ci.yml');
  const syncPublicHistory = readText(rootDir, 'scripts/sync-public-history.sh');
  const publishWorkflowPath = '.github/workflows/publish-worker-bundles.yml';
  const publishWorkflow = fs.existsSync(path.join(rootDir, publishWorkflowPath))
    ? readText(rootDir, publishWorkflowPath)
    : '';
  const trackedDistFiles = listTrackedDistFiles(rootDir);

  const expectScriptContains = (scriptName, expected) => {
    const actual = String(scripts[scriptName] || '');
    if (!actual.includes(expected)) {
      failures.push(`scripts.${scriptName} must include "${expected}"`);
    }
  };
  const expectScriptOmits = (scriptName, unexpected) => {
    const actual = String(scripts[scriptName] || '');
    if (actual.includes(unexpected)) {
      failures.push(`scripts.${scriptName} must not include "${unexpected}"`);
    }
  };
  const expectScriptMissing = (scriptName) => {
    if (Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
      failures.push(`scripts.${scriptName} must be removed`);
    }
  };

  const expectFile = (relativePath) => {
    if (!fs.existsSync(path.join(rootDir, relativePath))) {
      failures.push(`missing required file: ${relativePath}`);
    }
  };
  const expectFileMissing = (relativePath) => {
    if (fs.existsSync(path.join(rootDir, relativePath))) {
      failures.push(`file must be removed: ${relativePath}`);
    }
  };
  const expectWorkflowContains = (expected, description = expected) => {
    if (!workflow.includes(expected)) {
      failures.push(`CI workflow must include ${description}`);
    }
  };
  const expectWorkflowOmits = (unexpected, description = unexpected) => {
    if (workflow.includes(unexpected)) {
      failures.push(`CI workflow must not include ${description}`);
    }
  };
  const expectSyncPublicHistoryContains = (expected, description = expected) => {
    if (!syncPublicHistory.includes(expected)) {
      failures.push(`sync-public-history verification must include ${description}`);
    }
  };

  expectFile('tests/root/deployHelperOrigins.test.mjs');
  expectFile('scripts/worker-bundle.mjs');
  expectFile('scripts/deploy-helper-deploy.mjs');
  expectFile('scripts/run-node-tests.js');
  expectFile('scripts/run-node-tests.test.js');
  expectFile('scripts/pre-push-guard.test.js');
  expectFile('scripts/check-client-boundaries.mjs');
  expectFile('scripts/check-client-boundaries.test.mjs');
  expectFile('scripts/client-boundaries-baseline.json');
  expectFile('scripts/check-type-debt-ratchet.mjs');
  expectFile('scripts/check-coverage-floor.mjs');
  expectFile('scripts/check-coverage-floor.test.mjs');
  expectFile('scripts/coverage-baseline.json');
  expectFile('scripts/check-dead-exports-advisory.mjs');
  expectFile('scripts/check-dead-exports-advisory.test.mjs');
  expectFile('scripts/dead-exports-baseline.json');
  expectFile('scripts/check-baseline-monotonicity.mjs');
  expectFile('scripts/check-baseline-monotonicity.test.mjs');
  expectFile('scripts/testInventoryConfig.js');
  expectFile('scripts/verify-test-inventory.js');
  expectFile('scripts/verify-test-inventory.test.js');
  expectFile('scripts/vite-navigation-smoke.js');
  expectFile('scripts/vite-navigation-smoke.test.js');
  expectFile('scripts/verify-worker-bundle-sync.mjs');
  expectFile('scripts/verify-worker-bundle-sync.test.js');
  expectFile('scripts/verify-public-release-surface.js');
  expectFile('scripts/verify-public-release-surface.test.js');
  expectFile('scripts/verify-public-docs.js');
  expectFile('scripts/verify-public-docs.test.js');
  expectFile('scripts/verify-public-release-pii.sh');
  expectFile('scripts/verify-public-release-pii.test.js');
  expectFile('scripts/verify-public-assets.js');
  expectFile('scripts/verify-public-assets.test.js');
  expectFile('scripts/verify-public-text.js');
  expectFile('scripts/verify-public-text.test.js');
  expectFile('scripts/sync-public-history.sh');
  expectFile('workers/sessionCorsWorker/package.json');
  expectFile(publishWorkflowPath);
  expectFile('workers/deploy-helper/wrangler.example.toml');
  expectFile('workers/deploy-helper/.dev.vars.example');
  expectFile('workers/deploy-helper/LICENSE');
  expectFileMissing('client/src/assets/worker/sessionCorsWorker.js.txt');
  expectFileMissing('client/src/assets/worker/sessionCorsWorker.unbundled.js.txt');
  expectFileMissing('client/src/assets/worker/deploy-helper-worker.js.txt');

  expectScriptContains('test:surveys-sbt', 'src/utilities/web3/contractScripts.surveys-sbt.proxy.test.js');
  expectScriptContains('test:contracts', 'SurveysTest');
  expectScriptContains('test:contracts', 'CustomSBTTest');
  expectScriptContains('test:contracts', 'SessionRegistryTest');
  expectScriptContains('test:contracts', 'SurveysFuzzTest');
  expectScriptContains('test:contracts', 'CustomSBTFuzzTest');
  expectScriptContains('test:contracts', 'SessionRegistryFuzzTest');
  expectScriptContains('test:contracts', 'CustomSBTInvariantTest');
  expectScriptContains('test:node', 'scripts/run-node-tests.js');
  expectScriptContains('test:node:tracked', 'scripts/run-node-tests.js --tracked-only');
  expectScriptContains('client-boundaries:check', 'scripts/check-client-boundaries.mjs');
  expectScriptContains('test:root:jest', '--testMatch');
  expectScriptContains('test:root:jest', '../tests/root/sessionCorsWorker.auth.test.js');
  expectScriptContains('test:root:jest', '../tests/root/deployHelper.worker.test.js');
  expectScriptContains('test:worker:session-cors', 'npm --prefix workers/sessionCorsWorker test');
  expectScriptContains('test:e2e', 'npm run -s test:e2e:smoke');
  expectScriptContains('test:e2e:quick', 'npm run -s test:e2e:smoke');
  expectScriptContains('test:e2e:smoke', 'npm run -s ai:test-nav:smoke');
  expectScriptContains('ai:test-nav:smoke', 'node scripts/vite-navigation-smoke.js');
  expectScriptContains('test:ci', 'npm run test:wiring');
  expectScriptContains('test:ci', 'npm run type-debt:check');
  expectScriptContains('test:ci', 'npm run verify:release');
  expectScriptContains('test:ci', 'npm run coverage-floor:check');
  expectScriptContains('test:ci', 'npm run test:root:jest');
  expectScriptContains('test:ci', 'npm run test:worker:session-cors');
  expectScriptContains('test:ci', 'npm run test:node');
  expectScriptContains('test:wiring', 'client-boundaries:check');
  expectScriptContains('test:wiring', 'dead-exports:check');
  expectScriptContains('test:wiring', 'scripts/verify-test-inventory.js');
  expectScriptContains('tests', 'npm run test:ci');
  expectScriptContains('tests', 'npm run test:surveys-sbt');
  expectScriptContains('test:client', '--coverage');
  expectScriptContains('test:client', '--coverageReporters=json-summary');
  expectScriptContains('test:release:client', 'npm test -- --watchAll=false --runInBand');
  expectScriptContains('typecheck:client', 'npm --prefix client run typecheck');
  expectScriptContains('worker:bundle', 'scripts/worker-bundle.mjs');
  expectScriptContains('deploy-helper:deploy', 'scripts/deploy-helper-deploy.mjs');
  expectScriptContains('verify:worker-bundle', 'scripts/verify-worker-bundle-sync.mjs');
  expectScriptContains('verify:public-release-surface', 'scripts/verify-public-release-surface.js');
  expectScriptContains('verify:public-assets', 'scripts/verify-public-assets.js');
  expectScriptContains('verify:public-text', 'scripts/verify-public-text.js');
  expectScriptContains('verify:public-release-pii', 'scripts/verify-public-release-pii.sh');
  expectScriptContains('coverage-floor:check', 'scripts/check-coverage-floor.mjs');
  expectScriptContains('dead-exports:advisory', 'scripts/check-dead-exports-advisory.mjs');
  expectScriptContains('dead-exports:check', 'scripts/check-dead-exports-advisory.mjs --check');
  expectScriptContains('verify:release', 'npm run lint');
  expectScriptContains('verify:release', 'npm run typecheck:client');
  expectScriptContains('verify:release', 'npm run -s test:node:tracked');
  expectScriptContains('verify:release', 'npm run test:release:client');
  expectScriptContains('verify:release', 'npm run verify:public-release-surface');
  expectScriptContains('verify:release', 'npm run verify:public-assets');
  expectScriptContains('verify:release', 'npm run worker:bundle');
  expectScriptContains('verify:release', 'npm run verify:worker-bundle');
  expectScriptContains('verify:release', 'npm --prefix client run build');
  expectScriptOmits('verify:release', 'NODE_OPTIONS=--openssl-legacy-provider');

  expectSyncPublicHistoryContains('npm run test:wiring', '"npm run test:wiring"');
  expectSyncPublicHistoryContains('npm run type-debt:check', '"npm run type-debt:check"');
  expectSyncPublicHistoryContains('verify_public_assets', '"verify_public_assets"');
  expectSyncPublicHistoryContains('verify_public_text', '"verify_public_text"');

  expectWorkflowContains('wiring-and-release:', 'the wiring-and-release job');
  expectWorkflowContains('contracts:', 'the contracts job');
  expectWorkflowContains('client:', 'the client job');
  expectWorkflowContains('root-jest:', 'the root-jest job');
  expectWorkflowContains('workers:', 'the workers job');
  expectWorkflowContains('cecc-and-node:', 'the cecc-and-node job');
  expectWorkflowContains('test:', 'the final aggregate test job');
  expectWorkflowContains('run: npm run test:wiring', '"npm run test:wiring"');
  expectWorkflowContains('run: npm run type-debt:check', '"npm run type-debt:check"');
  expectWorkflowContains('BASELINE_MONOTONICITY_BASE:', 'baseline monotonicity base env');
  expectWorkflowContains('fetch-depth: 0', 'full history checkout for baseline monotonicity commit text');
  expectWorkflowContains(
    'BASELINE_MONOTONICITY_COMMIT_TEXT="$(git log --format=%B',
    'baseline monotonicity commit-message allow text',
  );
  expectWorkflowContains('node scripts/check-baseline-monotonicity.mjs', '"node scripts/check-baseline-monotonicity.mjs"');
  expectWorkflowContains('run: npm run lint', '"npm run lint"');
  expectWorkflowContains('run: npm run typecheck:client', '"npm run typecheck:client"');
  expectWorkflowContains('run: npm run verify:public-release-surface', '"npm run verify:public-release-surface"');
  expectWorkflowContains('run: npm run verify:public-assets', '"npm run verify:public-assets"');
  expectWorkflowContains('run: npm run verify:public-text', '"npm run verify:public-text"');
  expectWorkflowContains('run: npm run worker:bundle', '"npm run worker:bundle"');
  expectWorkflowContains('run: npm run verify:worker-bundle', '"npm run verify:worker-bundle"');
  expectWorkflowContains('run: npm --prefix client run build', '"npm --prefix client run build"');
  expectWorkflowContains('run: npm run test:contracts', '"npm run test:contracts"');
  expectWorkflowContains('run: npm run test:client', '"npm run test:client"');
  expectWorkflowContains('run: npm run coverage-floor:check', '"npm run coverage-floor:check"');
  expectWorkflowContains('run: npm run test:root:jest', '"npm run test:root:jest"');
  expectWorkflowContains('run: npm run test:worker:session-cors', '"npm run test:worker:session-cors"');
  expectWorkflowContains('run: npm run test:node', '"npm run test:node"');
  expectWorkflowContains('run: npm run test:cache-guard', '"npm run test:cache-guard"');
  expectWorkflowContains('continue-on-error: true', 'non-blocking advisory step');
  expectWorkflowContains('run: npm run dead-exports:advisory', '"npm run dead-exports:advisory"');
  expectWorkflowContains('uses: actions/upload-artifact@v4', 'client coverage artifact upload');
  expectWorkflowContains('path: client/coverage/lcov.info', 'client coverage artifact path');
  expectWorkflowContains('needs:', 'aggregate job dependency list');
  expectWorkflowContains('if: ${{ always() }}', 'always-running aggregate test job');
  expectWorkflowContains('WIRING_AND_RELEASE_RESULT:', 'aggregate wiring-and-release result check');
  expectWorkflowContains('CECC_AND_NODE_RESULT:', 'aggregate cecc-and-node result check');
  expectWorkflowOmits('      - dev\n', 'private dev branch triggers');
  if (!publishWorkflow.includes('run: npm run worker:bundle')) {
    failures.push('publish-worker-bundles workflow must execute "npm run worker:bundle"');
  }
  if (!publishWorkflow.includes('run: npm run verify:worker-bundle')) {
    failures.push('publish-worker-bundles workflow must execute "npm run verify:worker-bundle"');
  }
  if (!publishWorkflow.includes('softprops/action-gh-release@v2')) {
    failures.push('publish-worker-bundles workflow must publish release assets with softprops/action-gh-release@v2');
  }
  if (!publishWorkflow.includes('make_latest: true')) {
    failures.push('publish-worker-bundles workflow must explicitly mark worker bundle releases as latest');
  }
  if (!publishWorkflow.includes('dist/sessionCorsWorker.bundle.js')) {
    failures.push('publish-worker-bundles workflow must upload dist/sessionCorsWorker.bundle.js');
  }
  if (!publishWorkflow.includes('dist/deployHelper.bundle.js')) {
    failures.push('publish-worker-bundles workflow must upload dist/deployHelper.bundle.js');
  }
  if (trackedDistFiles.includes('dist/sessionCorsWorker.bundle.js')) {
    failures.push('dist/sessionCorsWorker.bundle.js must not be tracked by git');
  }
  if (trackedDistFiles.includes('dist/deployHelper.bundle.js')) {
    failures.push('dist/deployHelper.bundle.js must not be tracked by git');
  }

  return failures;
}

if (require.main === module) {
  const failures = verifyTestWiring();
  if (failures.length) {
    failures.forEach((failure) => console.error(`test wiring check failed: ${failure}`));
    process.exit(1);
  }
  console.log('test wiring check passed');
}

module.exports = {
  verifyTestWiring,
};
