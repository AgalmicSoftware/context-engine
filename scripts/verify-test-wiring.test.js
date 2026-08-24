'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
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

function git(rootDir, args) {
  return execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gitExitCode(rootDir, args) {
  return spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).status;
}

test('repo test wiring invariants hold', () => {
  assert.deepEqual(verifyTestWiring(), []);
});

test('Worker provenance checkouts include complete public history and tags', () => {
  const repoRoot = path.resolve(__dirname, '..');
  for (const [relativePath, resolveStep] of [
    ['.github/workflows/ci.yml', '- name: Resolve private-to-public replay provenance'],
    ['.github/workflows/publish-worker-bundles.yml', '- name: Resolve checked-out replay provenance'],
    ['.github/workflows/promote-worker-bundles.yml', '- name: Resolve checked-out replay provenance'],
  ]) {
    const workflow = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    const resolveIndex = workflow.indexOf(resolveStep);
    const checkoutIndex = workflow.lastIndexOf('- name: Checkout', resolveIndex);
    assert.notEqual(resolveIndex, -1, `${relativePath} must resolve Worker provenance`);
    assert.notEqual(checkoutIndex, -1, `${relativePath} must check out the resolved source`);
    assert.match(
      workflow.slice(checkoutIndex, resolveIndex),
      /fetch-depth: 0/,
      `${relativePath} must fetch complete public history before resolving provenance`,
    );
  }
});

test('E2E preview readiness retries stay quiet but the final probe remains diagnostic', () => {
  const rootDir = path.resolve(__dirname, '..');
  const workflow = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');

  assert.match(workflow, /if curl -fs "\$BASE_URL" >\/dev\/null; then/);
  assert.doesNotMatch(workflow, /if curl -fsS "\$BASE_URL" >\/dev\/null; then/);
  assert.match(workflow, /curl -fsS "\$BASE_URL" >\/dev\/null\s+npm run ci:gate -- e2e-smoke/);
});

test('E2E smoke timeout leaves room for Playwright installation and execution', () => {
  const rootDir = path.resolve(__dirname, '..');
  const workflow = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');
  const e2eJob = workflow.slice(workflow.indexOf('  e2e-smoke:'), workflow.indexOf('  cecc-and-node:'));

  assert.match(e2eJob, /timeout-minutes: 20/);
});

test('Context Engine CC and Node gate installs client parser dependencies', () => {
  const rootDir = path.resolve(__dirname, '..');
  const workflow = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');
  const ceccJob = workflow.slice(workflow.indexOf('  cecc-and-node:'), workflow.indexOf('  test:'));
  const installIndex = ceccJob.indexOf('npm --prefix client ci');
  const gateIndex = ceccJob.indexOf('npm run ci:gate -- cecc-and-node');

  assert.match(ceccJob, /cache-dependency-path:[\s\S]*client\/package-lock\.json/);
  assert.notEqual(installIndex, -1, 'cecc-and-node must install client dependencies');
  assert.ok(installIndex < gateIndex, 'client dependencies must be installed before the gate runs');
});

test('release-staging PR events do not duplicate the authoritative push matrix', () => {
  const rootDir = path.resolve(__dirname, '..');
  const workflow = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');
  const dedupCondition =
    "if: ${{ github.event_name == 'push' || github.event.pull_request.head.repo.full_name != github.repository || !startsWith(github.head_ref, 'release-staging') }}";

  for (const jobName of [
    'wiring-and-release',
    'contracts',
    'client',
    'root-jest',
    'workers',
    'e2e-smoke',
    'cecc-and-node',
  ]) {
    assert.ok(
      workflow.includes(`  ${jobName}:\n    ${dedupCondition}`),
      `${jobName} must skip duplicate same-repository release-staging PR verification`,
    );
  }

  const aggregateJob = workflow.slice(workflow.indexOf('  test:'));
  assert.match(aggregateJob, /name: \$\{\{ github\.event_name == 'pull_request'.*'release-staging-pr-deduplicated' \|\| 'test' \}\}/);
  assert.match(aggregateJob, /if: \$\{\{ always\(\) \}\}/);
  assert.match(aggregateJob, /Report deduplicated release-staging PR verification/);
  assert.match(aggregateJob, /Check split CI job results\s+if: \$\{\{ github\.event_name == 'push'/);
});

test('release-staging PR verification uses the fetched PR head instead of merge HEAD', () => {
  const rootDir = path.resolve(__dirname, '..');
  const workflow = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');

  assert.match(
    workflow,
    /ZERO_OID:\s+["']0{40}["']/,
    'the zero OID must remain quoted so YAML does not coerce it to numeric zero',
  );
  assert.match(
    workflow,
    /RELEASE_PR_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/,
  );
  assert.match(
    workflow,
    /release_candidate_ref=HEAD\s+if \[ "\$RELEASE_EVENT_NAME" = "pull_request" \]; then\s+release_candidate_ref="\$RELEASE_PR_HEAD_SHA"\s+git fetch --no-tags origin "\$release_candidate_ref"\s+fi/,
  );
  assert.match(
    workflow,
    /git fetch --force --tags origin\s+node scripts\/worker-release-artifacts\.mjs verify-replay-range\s+\\\s+--base-ref origin\/main\s+\\\s+--candidate-ref "\$release_candidate_ref"/,
  );
  assert.match(
    workflow,
    /verify_args=\(verify-ref --candidate-ref "\$release_candidate_ref" --baseline-ref origin\/main\)/,
  );
});

test('release workflow runs for nested release-staging branches', () => {
  const rootDir = path.resolve(__dirname, '..');
  const workflow = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');

  assert.match(workflow, /- 'release-staging\/\*\*'/);
});

test('release workflow fetches preserve public ancestry for exact release refs', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const fetchCommands = Array.from(
    workflow.matchAll(/^\s*(git fetch --no-tags[^\r\n]+)$/gm),
    (match) => match[1].trim(),
  );

  assert.equal(fetchCommands.length, 4, 'expected every release no-tags fetch command');

  withTempRepo((rootDir) => {
    const originDir = path.join(rootDir, 'origin.git');
    const sourceDir = path.join(rootDir, 'source');
    const checkoutDir = path.join(rootDir, 'checkout');
    fs.mkdirSync(sourceDir, { recursive: true });

    git(rootDir, ['init', '--bare', originDir]);
    git(sourceDir, ['init']);
    git(sourceDir, ['config', 'user.name', 'Release Fixture']);
    git(sourceDir, ['config', 'user.email', '[redacted-email]']);
    git(sourceDir, ['branch', '-M', 'main']);

    writeFile(sourceDir, 'public.txt', 'initial public release\n');
    git(sourceDir, ['add', 'public.txt']);
    git(sourceDir, ['commit', '-m', 'initial public release']);
    const olderPublicSha = git(sourceDir, ['rev-parse', 'HEAD']);

    writeFile(sourceDir, 'public.txt', 'current public release\n');
    git(sourceDir, ['add', 'public.txt']);
    git(sourceDir, ['commit', '-m', 'advance public main']);
    const mainSha = git(sourceDir, ['rev-parse', 'HEAD']);

    git(sourceDir, ['switch', '-c', 'release-staging']);
    writeFile(sourceDir, 'candidate.txt', 'previous staging candidate\n');
    git(sourceDir, ['add', 'candidate.txt']);
    git(sourceDir, ['commit', '-m', 'prepare staging candidate']);
    const previousStagingSha = git(sourceDir, ['rev-parse', 'HEAD']);

    writeFile(sourceDir, 'candidate.txt', 'current staging candidate\n');
    git(sourceDir, ['add', 'candidate.txt']);
    git(sourceDir, ['commit', '-m', 'advance staging candidate']);
    const releaseCandidateSha = git(sourceDir, ['rev-parse', 'HEAD']);

    git(sourceDir, ['remote', 'add', 'origin', originDir]);
    git(sourceDir, ['push', 'origin', 'main', 'release-staging']);
    git(rootDir, ['--git-dir', originDir, 'symbolic-ref', 'HEAD', 'refs/heads/main']);
    git(rootDir, ['clone', '--no-local', originDir, checkoutDir]);

    assert.equal(git(checkoutDir, ['rev-parse', 'origin/main']), mainSha);
    assert.equal(git(checkoutDir, ['rev-parse', '--is-shallow-repository']), 'false');

    for (const command of fetchCommands) {
      const expanded = command
        .replace('"$release_candidate_ref"', releaseCandidateSha)
        .replace('"$RELEASE_PUSH_BEFORE_SHA"', previousStagingSha);
      const [executable, ...args] = expanded.split(/\s+/);
      assert.equal(executable, 'git');
      assert.doesNotMatch(expanded, /\$/);
      git(checkoutDir, args);
    }

    assert.deepEqual(
      {
        isShallow: git(checkoutDir, ['rev-parse', '--is-shallow-repository']),
        mainRemainsAncestor: gitExitCode(
          checkoutDir,
          ['merge-base', '--is-ancestor', 'origin/main', releaseCandidateSha],
        ),
        olderPublicRemainsAncestor: gitExitCode(
          checkoutDir,
          ['merge-base', '--is-ancestor', olderPublicSha, releaseCandidateSha],
        ),
      },
      {
        isShallow: 'false',
        mainRemainsAncestor: 0,
        olderPublicRemainsAncestor: 0,
      },
    );
  });
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
          'dead-exports:check': 'node scripts/check-dead-exports-advisory.mjs --check',
          'test:e2e': 'npm run -s test:e2e:smoke',
          'test:e2e:quick': 'npm run -s test:e2e:smoke',
          'test:e2e:smoke': 'npm run -s ai:test-nav:smoke',
          'ai:test-nav:smoke': 'node scripts/vite-navigation-smoke.js',
          'type-debt:check': 'node scripts/check-type-debt-ratchet.mjs',
          'coverage-floor:check': 'node scripts/check-client-coverage-floors.mjs',
          'client:bundle-budget:check': 'node scripts/check-client-bundle-budget.mjs',
          'ci:gate': 'node scripts/run-ci-gates.mjs --gate',
          'ci:gates:check-hosted': 'node scripts/run-ci-gates.mjs --check-results hosted',
          'test:ci': 'node scripts/run-ci-gates.mjs --profile ci',
          'test:wiring':
            'node scripts/verify-test-wiring.js && node scripts/verify-test-inventory.js && npm run -s client-boundaries:check && npm run -s dead-exports:check',
          tests: 'npm run test:ci',
          'test:client': 'npm --prefix client run test:coverage:full-universe',
          'test:release:client':
            'cd client && npm test -- --watchAll=false --runInBand',
          'typecheck:client': 'npm --prefix client run typecheck',
          'typecheck:client-tests': 'node scripts/check-client-test-types.mjs',
          'worker:bundle': 'node scripts/worker-bundle.mjs',
          'deploy-helper:deploy': 'node scripts/deploy-helper-deploy.mjs',
          'verify:public-release-surface': 'node scripts/verify-public-release-surface.js',
          'verify:public-assets': 'node scripts/verify-public-assets.js',
          'verify:public-text': 'node scripts/verify-public-text.js',
          'verify:public-text:prepared': 'bash scripts/verify-prepared-public-text.sh',
          'verify:public-release-pii': 'bash scripts/verify-public-release-pii.sh',
          'verify:release-version': 'node scripts/release-version.mjs verify-worktree',
          'verify:release': 'node scripts/run-ci-gates.mjs --profile release',
        },
      }),
    );
    writeFile(
      rootDir,
      '.github/workflows/ci.yml',
      [
        'on:',
        '  push:',
        '    branches:',
        "      - 'release-staging/**'",
        'jobs:',
        '  wiring-and-release:',
        '    steps:',
        '      - uses: actions/checkout@1111111111111111111111111111111111111111',
        '        with:',
        '          fetch-depth: 0',
        '      - run: node scripts/resolve-baseline-growth-approval.mjs',
        '      - run: |',
        '          git fetch --no-tags origin main',
        '          node scripts/resolve-baseline-monotonicity-base.mjs',
        '      - env:',
        '          BASELINE_MONOTONICITY_BASE: ${{ steps.baseline-monotonicity-base.outputs.base_sha }}',
        '          BASELINE_MONOTONICITY_APPROVED: ${{ steps.baseline-growth-approval.outputs.approved }}',
        '        run: node scripts/check-baseline-monotonicity.mjs --require-base-sha',
        '      - run: npm run ci:gate -- wiring-and-release',
        '      - run: npm run ci:gate -- public-text',
        '      - run: node scripts/worker-release-artifacts.mjs stage',
        '      - env:',
        '          RELEASE_EVENT_NAME: ${{ github.event_name }}',
        '          RELEASE_PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}',
        '          RELEASE_PUSH_BEFORE_SHA: ${{ github.event.before }}',
        '        run: |',
        '          git fetch --no-tags origin main',
        '          release_candidate_ref=HEAD',
        '          if [ "$RELEASE_EVENT_NAME" = "pull_request" ]; then',
        '            release_candidate_ref="$RELEASE_PR_HEAD_SHA"',
        '            git fetch --no-tags origin "$release_candidate_ref"',
        '          fi',
        '          git fetch --force --tags origin',
        '          node scripts/worker-release-artifacts.mjs verify-replay-range --candidate-ref "$release_candidate_ref"',
        '          verify_args=(verify-ref --candidate-ref "$release_candidate_ref" --baseline-ref origin/main)',
        '          if [ "$RELEASE_EVENT_NAME" = "push" ] && [ "$RELEASE_PUSH_BEFORE_SHA" != "$ZERO_OID" ]; then',
        '            git fetch --no-tags origin "$RELEASE_PUSH_BEFORE_SHA"',
        '            verify_args+=(--minimum-ref "$RELEASE_PUSH_BEFORE_SHA")',
        '          fi',
        '          node scripts/release-version.mjs "${verify_args[@]}"',
        '      - uses: actions/upload-artifact@1111111111111111111111111111111111111111',
        '        with:',
        '          name: worker-bundle-candidate-${{ github.sha }}',
        '  contracts:',
        '    steps:',
        '      - run: npm run ci:gate -- contracts',
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
        '      - run: npm run ci:gate -- workers',
        '  e2e-smoke:',
        '    steps:',
        '      - run: npm --prefix client run build',
        '      - run: npm run ci:gate -- e2e-smoke',
        '  cecc-and-node:',
        '    steps:',
        '      - run: npm run ci:gate -- cecc-and-node',
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
        '/scripts/lib/public-release-strip-patterns.sh @AgalmicSoftware',
        '/scripts/sync-public-history.sh @AgalmicSoftware',
        '/scripts/client-boundaries-baseline.json @AgalmicSoftware',
        '/scripts/type-debt-baseline.json @AgalmicSoftware',
        '/scripts/client-bundle-budget.json @AgalmicSoftware',
        '/scripts/verify-abi-sync.mjs @AgalmicSoftware',
        '/client/src/contractsABI/ @AgalmicSoftware',
        '/contracts/ @AgalmicSoftware',
      ].join('\n'),
    );
    const publicGateManifest = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'ci-gates.json'), 'utf8'),
    );
    publicGateManifest.gates['cecc-and-node'].commands =
      publicGateManifest.gates['cecc-and-node'].commands.filter((entry) => (
        !entry.args.includes('test:cc')
      ));
    writeFile(rootDir, 'scripts/ci-gates.json', `${JSON.stringify(publicGateManifest, null, 2)}\n`);
    writeFile(
      rootDir,
      '.github/workflows/publish-worker-bundles.yml',
      [
        'on:',
        '  workflow_run:',
        'concurrency:',
        '  cancel-in-progress: false',
        'jobs:',
        '  publish:',
        '    if: github.event.workflow_run.conclusion == \'success\'',
        '    steps:',
        '      - uses: actions/checkout@1111111111111111111111111111111111111111',
        '      - run: node scripts/worker-release-artifacts.mjs validate-run',
        '      - run: node scripts/worker-release-artifacts.mjs verify',
        '      - run: |',
        '          app_version="$(node -p \'require("./package.json").version\')"',
        '          echo "Context Engine ${app_version} Worker bundles"',
        '          gh release create --latest=false',
        '          worker-bundles-${{ steps.run.outputs.sourceCommit }}',
        '          sessionCorsWorker.bundle.js',
        '          deployHelper.bundle.js',
        '          agentBridgeWorker.bundle.js',
        '          worker-release-manifest.json',
      ].join('\n'),
    );
    writeFile(
      rootDir,
      '.github/workflows/promote-worker-bundles.yml',
      [
        'concurrency:',
        '  group: worker-bundle-stable-promotion',
        '  cancel-in-progress: false',
        'jobs:',
        '  promote:',
        '    environment: worker-release-promotion',
        '    steps:',
        '      - uses: actions/checkout@1111111111111111111111111111111111111111',
        '      - run: node scripts/worker-release-artifacts.mjs validate-run',
        '      - run: node scripts/worker-release-artifacts.mjs verify',
        '      - run: |',
        '          echo worker-bundles-previous',
        '          echo worker-bundles-stable',
        '          gh release edit "worker-bundles-${STABLE_COMMIT}" --latest',
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
        'bind_public_replay_to_source() { echo "CE-Private-Source: $1"; }',
      ].join('\n'),
    );

    [
      'tests/root/deployHelperOrigins.test.mjs',
      'scripts/worker-bundle.mjs',
      'scripts/deploy-helper-deploy.mjs',
      'scripts/run-node-tests.js',
      'scripts/run-node-tests.test.js',
      '.githooks/pre-push',
      'scripts/pre-push-guard.test.js',
      'scripts/release-version.mjs',
      'scripts/release-version.test.mjs',
      'scripts/check-client-boundaries.mjs',
      'scripts/check-client-boundaries.test.mjs',
      'scripts/client-boundaries-baseline.json',
      'scripts/check-type-debt-ratchet.mjs',
      'client/jest.full-universe.config.cjs',
      'client/tsconfig.tests.json',
      'client/types/jest-test-globals.d.ts',
      'scripts/capture-client-coverage-baseline.mjs',
      'scripts/check-client-coverage-floors.mjs',
      'scripts/check-client-coverage-floors.test.mjs',
      'scripts/clientCoverageUniverse.js',
      'scripts/clientCoverageUniverse.test.js',
      'scripts/coverage-baseline.json',
      'scripts/client-coverage-legacy-files.json',
      'scripts/client-coverage-exclusions.json',
      'scripts/client-coverage-full-baseline.json',
      'scripts/check-client-test-types.mjs',
      'scripts/check-client-test-types.test.mjs',
      'scripts/clientTestTypeUniverse.js',
      'scripts/clientTestTypeUniverse.test.js',
      'scripts/client-test-type-contract.json',
      'scripts/client-test-type-diagnostics-baseline.json',
      'scripts/client-bundle-budget.json',
      'scripts/check-client-bundle-budget.mjs',
      'scripts/check-client-bundle-budget.test.mjs',
      'docs/bundle-budget.md',
      'scripts/check-dead-exports-advisory.mjs',
      'scripts/check-dead-exports-advisory.test.mjs',
      'scripts/check-baseline-monotonicity.mjs',
      'scripts/check-baseline-monotonicity.test.mjs',
      'scripts/resolve-baseline-monotonicity-base.mjs',
      'scripts/resolve-baseline-monotonicity-base.test.mjs',
      'scripts/resolve-baseline-growth-approval.mjs',
      'scripts/resolve-baseline-growth-approval.test.mjs',
      'scripts/run-ci-gates.mjs',
      'scripts/run-ci-gates.test.mjs',
      'scripts/worker-release-artifacts.mjs',
      'scripts/worker-release-artifacts.test.mjs',
      'scripts/verify-abi-sync.mjs',
      'scripts/verify-abi-sync.test.mjs',
      'scripts/lib/audit-verdict.sh',
      'scripts/audit-verdict.test.js',
      'scripts/testInventoryConfig.js',
      'scripts/verify-test-inventory.js',
      'scripts/verify-test-inventory.test.js',
      'scripts/vite-navigation-smoke.js',
      'scripts/vite-navigation-smoke.test.js',
      'scripts/verify-public-release-surface.js',
      'scripts/verify-public-release-surface.test.js',
      'scripts/verify-public-docs.js',
      'scripts/verify-public-docs.test.js',
      'scripts/verify-public-assets.js',
      'scripts/verify-public-assets.test.js',
      'scripts/verify-public-text.js',
      'scripts/verify-public-text.test.js',
      'scripts/verify-prepared-public-text.sh',
      'scripts/verify-public-release-pii.sh',
      'scripts/verify-public-release-pii.test.js',
      'scripts/lib/public-release-strip-patterns.sh',
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
