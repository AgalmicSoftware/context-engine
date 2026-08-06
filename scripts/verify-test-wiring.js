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
  const codeowners = readText(rootDir, '.github/CODEOWNERS');
  const gateManifestPath = 'scripts/ci-gates.json';
  const gateManifest = fs.existsSync(path.join(rootDir, gateManifestPath))
    ? readJson(rootDir, gateManifestPath)
    : { profiles: {}, gates: {} };
  const syncPublicHistory = readText(rootDir, 'scripts/sync-public-history.sh');
  const publishWorkflowPath = '.github/workflows/publish-worker-bundles.yml';
  const publishWorkflow = fs.existsSync(path.join(rootDir, publishWorkflowPath))
    ? readText(rootDir, publishWorkflowPath)
    : '';
  const promoteWorkflowPath = '.github/workflows/promote-worker-bundles.yml';
  const promoteWorkflow = fs.existsSync(path.join(rootDir, promoteWorkflowPath))
    ? readText(rootDir, promoteWorkflowPath)
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
  const gateCommandText = (gateName) => (
    (gateManifest.gates?.[gateName]?.commands || [])
      .map((entry) => [entry.command, ...(entry.args || [])].join(' '))
  );
  const expectGateContains = (gateName, expected) => {
    if (!gateCommandText(gateName).includes(expected)) {
      failures.push(`CI gate "${gateName}" must include "${expected}"`);
    }
  };
  const expectGateOmits = (gateName, unexpected) => {
    if (gateCommandText(gateName).includes(unexpected)) {
      failures.push(`CI gate "${gateName}" must not include "${unexpected}"`);
    }
  };
  const expectGateAfter = (gateName, before, after) => {
    const commands = gateCommandText(gateName);
    const beforeIndex = commands.indexOf(before);
    const afterIndex = commands.indexOf(after);
    if (beforeIndex < 0 || afterIndex <= beforeIndex) {
      failures.push(`CI gate "${gateName}" must run "${after}" after "${before}"`);
    }
  };
  const expectProfileContains = (profileName, gateName) => {
    if (!(gateManifest.profiles?.[profileName] || []).includes(gateName)) {
      failures.push(`CI profile "${profileName}" must include gate "${gateName}"`);
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
  expectFile('.githooks/pre-push');
  expectFile('scripts/pre-push-guard.test.js');
  expectFile('scripts/check-client-boundaries.mjs');
  expectFile('scripts/check-client-boundaries.test.mjs');
  expectFile('scripts/client-boundaries-baseline.json');
  expectFile('scripts/check-type-debt-ratchet.mjs');
  expectFile('client/jest.full-universe.config.cjs');
  expectFile('client/tsconfig.tests.json');
  expectFile('client/types/jest-test-globals.d.ts');
  expectFile('scripts/capture-client-coverage-baseline.mjs');
  expectFile('scripts/check-client-coverage-floors.mjs');
  expectFile('scripts/check-client-coverage-floors.test.mjs');
  expectFile('scripts/clientCoverageUniverse.js');
  expectFile('scripts/clientCoverageUniverse.test.js');
  expectFile('scripts/coverage-baseline.json');
  expectFile('scripts/client-coverage-legacy-files.json');
  expectFile('scripts/client-coverage-exclusions.json');
  expectFile('scripts/client-coverage-full-baseline.json');
  expectFile('scripts/check-client-test-types.mjs');
  expectFile('scripts/check-client-test-types.test.mjs');
  expectFile('scripts/clientTestTypeUniverse.js');
  expectFile('scripts/clientTestTypeUniverse.test.js');
  expectFile('scripts/client-test-type-contract.json');
  expectFile('scripts/client-test-type-diagnostics-baseline.json');
  expectFile('scripts/client-bundle-budget.json');
  expectFile('scripts/check-client-bundle-budget.mjs');
  expectFile('scripts/check-client-bundle-budget.test.mjs');
  expectFile('docs/bundle-budget.md');
  expectFile('scripts/check-dead-exports-advisory.mjs');
  expectFile('scripts/check-dead-exports-advisory.test.mjs');
  expectFile('scripts/dead-exports-baseline.json');
  expectFile('scripts/check-baseline-monotonicity.mjs');
  expectFile('scripts/check-baseline-monotonicity.test.mjs');
  expectFile('scripts/resolve-baseline-monotonicity-base.mjs');
  expectFile('scripts/resolve-baseline-monotonicity-base.test.mjs');
  expectFile('scripts/resolve-baseline-growth-approval.mjs');
  expectFile('scripts/resolve-baseline-growth-approval.test.mjs');
  expectFile(gateManifestPath);
  expectFile('scripts/run-ci-gates.mjs');
  expectFile('scripts/run-ci-gates.test.mjs');
  expectFile('scripts/worker-release-artifacts.mjs');
  expectFile('scripts/worker-release-artifacts.test.mjs');
  expectFile('.github/CODEOWNERS');
  expectFile('scripts/verify-abi-sync.mjs');
  expectFile('scripts/verify-abi-sync.test.mjs');
  expectFile('scripts/lib/audit-verdict.sh');
  expectFile('scripts/audit-verdict.test.js');
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
  expectFile('scripts/release-version.mjs');
  expectFile('scripts/release-version.test.mjs');
  expectFile('workers/sessionCorsWorker/package.json');
  expectFile('workers/agentBridgeWorker/package.json');
  expectFile('scripts/run-agent-bridge-worker-tests.js');
  expectFile(publishWorkflowPath);
  expectFile(promoteWorkflowPath);
  expectFile('workers/deploy-helper/wrangler.example.toml');
  expectFile('workers/deploy-helper/.dev.vars.example');
  expectFile('workers/deploy-helper/LICENSE');
  expectFileMissing('client/src/assets/worker/sessionCorsWorker.js.txt');
  expectFileMissing('client/src/assets/worker/sessionCorsWorker.unbundled.js.txt');
  expectFileMissing('client/src/assets/worker/deploy-helper-worker.js.txt');

  const surveysSbtProxyPath = 'client/src/utilities/web3/contractScripts.surveys-sbt.proxy.test.js';
  if (fs.existsSync(path.join(rootDir, surveysSbtProxyPath))) {
    expectScriptContains('test:surveys-sbt', 'src/utilities/web3/contractScripts.surveys-sbt.proxy.test.js');
    expectScriptContains('tests', 'npm run test:surveys-sbt');
  } else {
    expectScriptMissing('test:surveys-sbt');
    expectScriptOmits('tests', 'npm run test:surveys-sbt');
  }
  expectScriptContains('test:contracts', 'SurveysTest');
  expectScriptContains('test:contracts', 'CustomSBTTest');
  expectScriptContains('test:contracts', 'SessionRegistryTest');
  expectScriptContains('test:contracts', 'SurveysFuzzTest');
  expectScriptContains('test:contracts', 'CustomSBTFuzzTest');
  expectScriptContains('test:contracts', 'SessionRegistryFuzzTest');
  expectScriptContains('test:contracts', 'CustomSBTInvariantTest');
  expectScriptContains('abi:check', 'scripts/verify-abi-sync.mjs');
  expectScriptContains('verify:abi-sync', 'forge build');
  expectScriptContains('verify:abi-sync', 'abi:check');
  expectScriptContains('test:node', 'scripts/run-node-tests.js');
  expectScriptContains('test:root:jest', '--testMatch');
  expectScriptContains('test:root:jest', '../tests/root/sessionCorsWorker.auth.test.js');
  expectScriptContains('test:root:jest', '../tests/root/deployHelper.worker.test.js');
  expectScriptContains('test:worker:session-cors', 'npm --prefix workers/sessionCorsWorker test');
  expectScriptContains('test:worker:agent-bridge', 'scripts/run-agent-bridge-worker-tests.js');
  expectScriptContains('test:e2e', 'npm run -s test:e2e:smoke');
  expectScriptContains('test:e2e:quick', 'npm run -s test:e2e:smoke');
  expectScriptContains('test:e2e:smoke', 'npm run -s ai:test-nav:smoke');
  expectScriptContains('ai:test-nav:smoke', 'node scripts/vite-navigation-smoke.js');
  expectScriptContains('ci:gate', 'scripts/run-ci-gates.mjs --gate');
  expectScriptContains('ci:gates:check-hosted', 'scripts/run-ci-gates.mjs --check-results hosted');
  expectScriptContains('test:ci', 'scripts/run-ci-gates.mjs --profile ci');
  expectScriptOmits('test:ci', 'verify:release');
  expectScriptOmits('test:ci', 'test:release:client');
  expectScriptOmits('test:ci', 'test:node:tracked');
  expectScriptContains('test:wiring', 'client-boundaries:check');
  expectScriptContains('test:wiring', 'dead-exports:check');
  expectScriptContains('test:wiring', 'scripts/verify-test-inventory.js');
  expectScriptContains('tests', 'npm run test:ci');
  expectScriptContains('test:client', 'test:coverage:full-universe');
  expectScriptContains('test:release:client', 'npm test -- --watchAll=false --runInBand');
  expectScriptContains('typecheck:client', 'npm --prefix client run typecheck');
  expectScriptContains('typecheck:client-tests', 'scripts/check-client-test-types.mjs');
  expectScriptContains('worker:bundle', 'scripts/worker-bundle.mjs');
  expectScriptContains('deploy-helper:deploy', 'scripts/deploy-helper-deploy.mjs');
  expectScriptContains('verify:worker-bundle', 'scripts/verify-worker-bundle-sync.mjs');
  expectScriptContains('verify:public-release-surface', 'scripts/verify-public-release-surface.js');
  expectScriptContains('verify:public-assets', 'scripts/verify-public-assets.js');
  expectScriptContains('verify:public-text', 'scripts/verify-public-text.js');
  expectScriptContains('verify:public-text:prepared', 'scripts/verify-prepared-public-text.sh');
  expectScriptContains('verify:public-release-pii', 'scripts/verify-public-release-pii.sh');
  expectScriptContains('verify:release-version', 'scripts/release-version.mjs verify-worktree');
  expectScriptContains('coverage-floor:check', 'scripts/check-coverage-floor.mjs');
  expectScriptContains('dead-exports:advisory', 'scripts/check-dead-exports-advisory.mjs');
  expectScriptContains('dead-exports:check', 'scripts/check-dead-exports-advisory.mjs --check');
  expectScriptContains('verify:release', 'npm run lint');
  expectScriptContains('verify:release', 'npm run typecheck:client');
  expectScriptContains('verify:release', 'npm run verify:release-version');
  expectScriptContains('verify:release', 'npm run -s test:node:tracked');
  expectScriptContains('verify:release', 'npm run test:release:client');
  expectScriptContains('verify:release', 'npm run verify:public-release-surface');
  expectScriptContains('verify:release', 'npm run verify:public-assets');
  expectScriptContains('verify:release', 'npm run worker:bundle');
  expectScriptContains('verify:release', 'npm run verify:worker-bundle');
  expectScriptContains('verify:release', 'npm --prefix client run build');
  expectScriptOmits('verify:release', 'NODE_OPTIONS=--openssl-legacy-provider');

  [
    'wiring-and-release',
    'contracts',
    'client',
    'root-jest',
    'workers',
    'cecc-and-node',
  ].forEach((gateName) => expectProfileContains('ci', gateName));
  [
    'wiring-and-release',
    'public-text',
    'contracts',
    'client',
    'root-jest',
    'workers',
    'e2e-smoke',
    'cecc-and-node',
  ].forEach((gateName) => expectProfileContains('hosted', gateName));
  expectProfileContains('release', 'release');

  [
    'npm run test:wiring',
    'npm run type-debt:check',
    'npm run lint',
    'npm --prefix client run format:check',
    'npm run lint:workers',
    'npm run typecheck:client',
    'npm run typecheck:client-tests',
    'npm run verify:public-release-surface',
    'npm run verify:public-assets',
    'npm run worker:bundle',
    'npm run verify:worker-bundle',
    'npm --prefix client run build',
  ].forEach((command) => expectGateContains('wiring-and-release', command));
  expectGateContains('wiring-and-release', 'npm run client:bundle-budget:check');
  expectGateAfter(
    'wiring-and-release',
    'npm --prefix client run build',
    'npm run client:bundle-budget:check',
  );
  expectGateContains('public-text', 'npm run verify:public-text:prepared');
  expectGateContains('contracts', 'npm run test:contracts');
  expectGateContains('contracts', 'npm run abi:check');
  expectGateOmits('contracts', 'npm run verify:abi-sync');
  expectGateContains('client', 'npm run test:client');
  expectGateContains('client', 'npm run coverage-floor:check');
  expectGateContains('root-jest', 'npm run test:root:jest');
  expectGateContains('workers', 'npm run test:worker:session-cors');
  expectGateContains('workers', 'npm run test:worker:agent-bridge');
  expectGateContains('e2e-smoke', 'npm run test:e2e:smoke');
  if (Object.prototype.hasOwnProperty.call(scripts, 'test:cc')) {
    expectGateContains('cecc-and-node', 'npm run test:cc');
  } else {
    expectGateOmits('cecc-and-node', 'npm run test:cc');
  }
  expectGateContains('cecc-and-node', 'npm run test:node:tracked');
  expectGateOmits('cecc-and-node', 'npm run test:node');
  expectGateContains('cecc-and-node', 'npm run test:cache-guard');
  [
    'npm run lint',
    'npm run typecheck:client',
    'npm run typecheck:client-tests',
    'npm run test:node:tracked',
    'npm run test:release:client',
    'npm run verify:public-release-surface',
    'npm run verify:public-assets',
    'npm run worker:bundle',
    'npm run verify:worker-bundle',
    'npm --prefix client run build',
  ].forEach((command) => expectGateContains('release', command));
  expectGateContains('release', 'npm run client:bundle-budget:check');
  expectGateAfter(
    'release',
    'npm --prefix client run build',
    'npm run client:bundle-budget:check',
  );

  expectSyncPublicHistoryContains('npm run test:wiring', '"npm run test:wiring"');
  expectSyncPublicHistoryContains('npm run type-debt:check', '"npm run type-debt:check"');
  expectSyncPublicHistoryContains('verify_public_assets', '"verify_public_assets"');
  expectSyncPublicHistoryContains('verify_public_text', '"verify_public_text"');
  expectSyncPublicHistoryContains('CE-Private-Source:', 'private-to-public source mapping trailer');

  expectWorkflowContains('wiring-and-release:', 'the wiring-and-release job');
  expectWorkflowContains('contracts:', 'the contracts job');
  expectWorkflowContains('client:', 'the client job');
  expectWorkflowContains('root-jest:', 'the root-jest job');
  expectWorkflowContains('workers:', 'the workers job');
  expectWorkflowContains('cecc-and-node:', 'the cecc-and-node job');
  expectWorkflowContains('test:', 'the final aggregate test job');
  expectWorkflowContains('run: npm run ci:gate -- wiring-and-release', 'the manifest-backed wiring-and-release gate');
  expectWorkflowContains('run: npm run ci:gate -- public-text', 'the hosted public-text gate');
  expectWorkflowContains('node scripts/resolve-baseline-monotonicity-base.mjs', 'baseline monotonicity base resolver');
  expectWorkflowContains(
    'BASELINE_MONOTONICITY_BASE: ${{ steps.baseline-monotonicity-base.outputs.base_sha }}',
    'resolved baseline monotonicity SHA',
  );
  expectWorkflowContains('node scripts/resolve-baseline-growth-approval.mjs', 'verified baseline growth approval resolver');
  expectWorkflowContains('BASELINE_MONOTONICITY_APPROVED:', 'verified baseline growth approval output');
  expectWorkflowContains('--require-base-sha', 'fail-closed baseline SHA requirement');
  expectWorkflowContains('fetch-depth: 0', 'complete history checkout for baseline comparison');
  expectWorkflowContains(
    "- 'release-staging/**'",
    'nested release-staging push trigger',
  );
  expectWorkflowContains('node scripts/check-baseline-monotonicity.mjs', '"node scripts/check-baseline-monotonicity.mjs"');
  expectWorkflowContains('run: npm run lint', '"npm run lint"');
  expectWorkflowContains('run: npm run typecheck:client', '"npm run typecheck:client"');
  expectWorkflowContains('run: npm run verify:release-version', '"npm run verify:release-version"');
  expectWorkflowContains(
    'RELEASE_PUSH_BEFORE_SHA: ${{ github.event.before }}',
    'release-staging previous push SHA',
  );
  expectWorkflowContains(
    'RELEASE_PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}',
    'release-staging pull request head SHA',
  );
  expectWorkflowContains(
    'RELEASE_EVENT_NAME: ${{ github.event_name }}',
    'release-staging push event discriminator',
  );
  expectWorkflowContains(
    'if [ "$RELEASE_EVENT_NAME" = "pull_request" ]; then',
    'release-staging pull request event discriminator',
  );
  expectWorkflowContains(
    'release_candidate_ref="$RELEASE_PR_HEAD_SHA"',
    'release-staging pull request candidate selection',
  );
  expectWorkflowContains(
    'git fetch --no-tags origin "$release_candidate_ref"',
    'release-staging pull request head fetch',
  );
  expectWorkflowOmits(
    'git fetch --no-tags --depth=1',
    'release verification fetches that discard existing history',
  );
  expectWorkflowContains(
    'git fetch --force --tags origin',
    'release-staging public tag history fetch',
  );
  expectWorkflowContains(
    '--candidate-ref "$release_candidate_ref"',
    'release-staging explicit candidate ref',
  );
  expectWorkflowOmits(
    '--candidate-ref HEAD',
    'synthetic pull request merge candidate',
  );
  expectWorkflowContains(
    'if [ "$RELEASE_EVENT_NAME" = "push" ] && [ "$RELEASE_PUSH_BEFORE_SHA" != "$ZERO_OID" ]; then',
    'release-staging nonzero previous push guard',
  );
  expectWorkflowContains(
    'git fetch --no-tags origin "$RELEASE_PUSH_BEFORE_SHA"',
    'release-staging previous push object fetch',
  );
  expectWorkflowContains(
    'verify_args+=(--minimum-ref "$RELEASE_PUSH_BEFORE_SHA")',
    'release-staging minimum version ref',
  );
  expectWorkflowContains(
    'node scripts/release-version.mjs "${verify_args[@]}"',
    'release-staging version advancement verification',
  );
  expectWorkflowContains(
    'node scripts/worker-release-artifacts.mjs verify-replay-range',
    'release-staging replay identity and provenance verification',
  );
  expectWorkflowOmits('BASELINE_MONOTONICITY_ALLOW_TEXT', 'author-controlled baseline approval text');
  expectWorkflowOmits('--allow-text', 'author-controlled baseline approval option');
  expectWorkflowContains('run: npm --prefix client run build', '"npm --prefix client run build"');
  expectWorkflowContains('run: npm run ci:gate -- contracts', 'the manifest-backed contracts gate');
  expectWorkflowContains('run: npm run ci:gate -- client', 'the manifest-backed client gate');
  expectWorkflowContains('run: npm run ci:gate -- root-jest', 'the manifest-backed root-jest gate');
  expectWorkflowContains('run: npm run ci:gate -- workers', 'the manifest-backed workers gate');
  expectWorkflowContains('npm run ci:gate -- e2e-smoke', 'the manifest-backed E2E smoke gate');
  expectWorkflowContains('run: npm run ci:gate -- cecc-and-node', 'the manifest-backed CE-CC/Node gate');
  expectWorkflowContains('continue-on-error: true', 'non-blocking advisory step');
  expectWorkflowContains('run: npm run dead-exports:advisory', '"npm run dead-exports:advisory"');
  expectWorkflowContains('uses: actions/upload-artifact@', 'client coverage artifact upload');
  expectWorkflowContains('path: client/coverage/lcov.info', 'client coverage artifact path');
  expectWorkflowContains('needs:', 'aggregate job dependency list');
  expectWorkflowContains('if: ${{ always() }}', 'always-running aggregate test job');
  expectWorkflowContains('CI_GATE_RESULTS_JSON:', 'manifest-backed aggregate result map');
  expectWorkflowContains('run: npm run ci:gates:check-hosted', 'manifest-backed aggregate checker');
  expectWorkflowContains('worker-bundle-candidate-${{ github.sha }}', 'SHA-keyed tested Worker candidate');
  expectWorkflowContains('node scripts/worker-release-artifacts.mjs resolve-source', 'private-to-public provenance resolver');
  expectWorkflowContains('node scripts/worker-release-artifacts.mjs create', 'immutable Worker manifest creation');
  expectWorkflowContains('name: worker-bundles-${{ github.sha }}', 'SHA-keyed immutable Worker artifact');
  expectWorkflowOmits('      - dev\n', 'private dev branch triggers');
  [
    '/.github/workflows/ci.yml @AgalmicSoftware',
    '/.github/workflows/publish-worker-bundles.yml @AgalmicSoftware',
    '/.github/workflows/promote-worker-bundles.yml @AgalmicSoftware',
    '/.github/workflows/public-drift.yml @AgalmicSoftware',
    '/.githooks/pre-push @AgalmicSoftware',
    '/scripts/pre-push-guard.test.js @AgalmicSoftware',
    '/scripts/release-version.mjs @AgalmicSoftware',
    '/scripts/release-version.test.mjs @AgalmicSoftware',
    '/scripts/check-baseline-monotonicity.mjs @AgalmicSoftware',
    '/scripts/resolve-baseline-monotonicity-base.mjs @AgalmicSoftware',
    '/scripts/resolve-baseline-growth-approval.mjs @AgalmicSoftware',
    '/scripts/ci-gates.json @AgalmicSoftware',
    '/scripts/run-ci-gates.mjs @AgalmicSoftware',
    '/scripts/run-ci-gates.test.mjs @AgalmicSoftware',
    '/scripts/worker-release-artifacts.mjs @AgalmicSoftware',
    '/scripts/worker-release-artifacts.test.mjs @AgalmicSoftware',
    '/scripts/verify-public-release-pii.sh @AgalmicSoftware',
    '/scripts/verify-public-release-pii.test.js @AgalmicSoftware',
    '/scripts/sync-public-history.sh @AgalmicSoftware',
    '/scripts/client-boundaries-baseline.json @AgalmicSoftware',
    '/scripts/type-debt-baseline.json @AgalmicSoftware',
    '/scripts/dead-exports-baseline.json @AgalmicSoftware',
    '/scripts/client-bundle-budget.json @AgalmicSoftware',
    '/scripts/verify-abi-sync.mjs @AgalmicSoftware',
    '/client/src/contractsABI/ @AgalmicSoftware',
    '/contracts/ @AgalmicSoftware',
  ].forEach((rule) => {
    if (!codeowners.includes(rule)) {
      failures.push(`CODEOWNERS must include "${rule}"`);
    }
  });
  if (/npm run (?:worker:bundle|verify:worker-bundle)/.test(publishWorkflow)) {
    failures.push('publish-worker-bundles workflow must consume tested CI bytes without rebuilding');
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
  if (
    !publishWorkflow.includes('APP_VERSION="$(node -p')
    || !publishWorkflow.includes('require("./package.json").version')
  ) {
    failures.push('publish-worker-bundles workflow must read the canonical application version');
  }
  if (!publishWorkflow.includes('steps.meta.outputs.app_version')) {
    failures.push('publish-worker-bundles workflow must include the application version in release metadata');
  }
  if (!publishWorkflow.includes('dist/sessionCorsWorker.bundle.js')) {
    failures.push('publish-worker-bundles workflow must upload dist/sessionCorsWorker.bundle.js');
  }
  if (!publishWorkflow.includes('dist/deployHelper.bundle.js')) {
    failures.push('publish-worker-bundles workflow must upload dist/deployHelper.bundle.js');
  }
  if (!publishWorkflow.includes('dist/agentBridgeWorker.bundle.js')) {
    failures.push('publish-worker-bundles workflow must upload dist/agentBridgeWorker.bundle.js');
  }
  if (trackedDistFiles.includes('dist/sessionCorsWorker.bundle.js')) {
    failures.push('dist/sessionCorsWorker.bundle.js must not be tracked by git');
  }
  if (trackedDistFiles.includes('dist/deployHelper.bundle.js')) {
    failures.push('dist/deployHelper.bundle.js must not be tracked by git');
  }
  if (trackedDistFiles.includes('dist/agentBridgeWorker.bundle.js')) {
    failures.push('dist/agentBridgeWorker.bundle.js must not be tracked by git');
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
