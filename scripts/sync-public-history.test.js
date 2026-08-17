'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const SCRIPT_SOURCE_PATH = path.join(__dirname, 'sync-public-history.sh');
const HELPER_SOURCE_PATH = path.join(__dirname, 'lib', 'public-release-strip-patterns.sh');
const SURFACE_VERIFIER_SOURCE_PATH = path.join(__dirname, 'verify-public-release-surface.js');
const DOCS_VERIFIER_SOURCE_PATH = path.join(__dirname, 'verify-public-docs.js');
const ASSET_VERIFIER_SOURCE_PATH = path.join(__dirname, 'verify-public-assets.js');
const TEXT_VERIFIER_SOURCE_PATH = path.join(__dirname, 'verify-public-text.js');
const PII_VERIFIER_SOURCE_PATH = path.join(__dirname, 'verify-public-release-pii.sh');
const PACKAGE_SCRUBBER_SOURCE_PATH = path.join(__dirname, 'scrub-public-package-json.js');
const PII_SCRUBBER_SOURCE_PATH = path.join(__dirname, 'scrub-public-pii-text.mjs');
const RELEASE_VERSION_SOURCE_PATH = path.join(__dirname, 'release-version.mjs');
const PRIVATE_BRANCH_GUARD_INSTALLER_SOURCE_PATH = path.join(__dirname, 'install-private-branch-guard.sh');
const PRE_PUSH_HOOK_SOURCE_PATH = path.join(__dirname, '..', '.githooks', 'pre-push');
const TEST_TMP_ROOT = path.join(__dirname, '.tmp-sync-public-history-tests');
const ZERO_OID = '0'.repeat(40);

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function git(rootDir, args, options = {}) {
  return execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    ...options,
  });
}

function installSyncScriptFixture(sourceDir) {
  writeFile(sourceDir, path.join('scripts', 'sync-public-history.sh'), fs.readFileSync(SCRIPT_SOURCE_PATH, 'utf8'));
  writeFile(
    sourceDir,
    path.join('scripts', 'lib', 'public-release-strip-patterns.sh'),
    fs.readFileSync(HELPER_SOURCE_PATH, 'utf8'),
  );
  writeFile(
    sourceDir,
    path.join('scripts', 'verify-public-release-surface.js'),
    fs.readFileSync(SURFACE_VERIFIER_SOURCE_PATH, 'utf8'),
  );
  writeFile(
    sourceDir,
    path.join('scripts', 'verify-public-docs.js'),
    fs.readFileSync(DOCS_VERIFIER_SOURCE_PATH, 'utf8'),
  );
  writeFile(
    sourceDir,
    path.join('scripts', 'verify-public-assets.js'),
    fs.readFileSync(ASSET_VERIFIER_SOURCE_PATH, 'utf8'),
  );
  writeFile(
    sourceDir,
    path.join('scripts', 'verify-public-text.js'),
    fs.readFileSync(TEXT_VERIFIER_SOURCE_PATH, 'utf8'),
  );
  writeFile(
    sourceDir,
    path.join('scripts', 'verify-public-release-pii.sh'),
    fs.readFileSync(PII_VERIFIER_SOURCE_PATH, 'utf8'),
  );
  writeFile(
    sourceDir,
    path.join('scripts', 'scrub-public-package-json.js'),
    fs.readFileSync(PACKAGE_SCRUBBER_SOURCE_PATH, 'utf8'),
  );
  writeFile(
    sourceDir,
    path.join('scripts', 'scrub-public-pii-text.mjs'),
    fs.readFileSync(PII_SCRUBBER_SOURCE_PATH, 'utf8'),
  );
  writeFile(
    sourceDir,
    path.join('scripts', 'release-version.mjs'),
    fs.readFileSync(RELEASE_VERSION_SOURCE_PATH, 'utf8'),
  );
  writeFile(
    sourceDir,
    path.join('scripts', 'install-private-branch-guard.sh'),
    fs.readFileSync(PRIVATE_BRANCH_GUARD_INSTALLER_SOURCE_PATH, 'utf8'),
  );
  writeFile(
    sourceDir,
    path.join('.githooks', 'pre-push'),
    fs.readFileSync(PRE_PUSH_HOOK_SOURCE_PATH, 'utf8'),
  );
  fs.chmodSync(path.join(sourceDir, 'scripts', 'sync-public-history.sh'), 0o755);
  fs.chmodSync(path.join(sourceDir, 'scripts', 'verify-public-release-pii.sh'), 0o755);
  fs.chmodSync(path.join(sourceDir, 'scripts', 'install-private-branch-guard.sh'), 0o755);
  fs.chmodSync(path.join(sourceDir, '.githooks', 'pre-push'), 0o755);
}

function commitAll(rootDir, message, { authorDate, committerDate }) {
  const messageFile = path.join(rootDir, '.git', 'commit-message.txt');
  fs.writeFileSync(messageFile, message);
  git(rootDir, ['add', '-A'], { stdio: 'ignore' });
  git(rootDir, ['commit', '--quiet', '--file', messageFile], {
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: authorDate,
      GIT_COMMITTER_DATE: committerDate,
    },
  });
  fs.unlinkSync(messageFile);
}

function runSyncScript(sourceDir, args = [], envOverrides = {}) {
  return spawnSync('bash', [path.join(sourceDir, 'scripts', 'sync-public-history.sh'), ...args], {
    cwd: sourceDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...envOverrides,
      TMPDIR: TEST_TMP_ROOT,
    },
  });
}

function syncFailureMessage(result) {
  return [
    `sync-public-history exited with status ${result.status}${result.signal ? ` (${result.signal})` : ''}`,
    `stdout:\n${result.stdout || '<empty>'}`,
    `stderr:\n${result.stderr || '<empty>'}`,
  ].join('\n');
}

function setupSourceRepo() {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(TEST_TMP_ROOT, 'ce-sync-public-history-'));
  const remoteDir = path.join(tempRoot, 'origin.git');
  const sourceDir = path.join(tempRoot, 'source');

  try {
    git(tempRoot, ['init', '--bare', '--initial-branch=main', remoteDir], { stdio: 'ignore' });
    git(tempRoot, ['clone', remoteDir, sourceDir], { stdio: 'ignore' });
    git(sourceDir, ['config', 'user.name', 'Private Dev'], { stdio: 'ignore' });
    git(sourceDir, ['config', 'user.email', '[redacted-email]'], { stdio: 'ignore' });

    installSyncScriptFixture(sourceDir);

    writeFile(sourceDir, 'README.md', 'base\n');
    writeFile(
      sourceDir,
      'package.json',
      `${JSON.stringify({
        name: 'contextEngine',
        version: '0.1.0',
        scripts: { 'test:node': 'node scripts/public-node-test-fixture.js' },
      }, null, 2)}\n`,
    );
    writeFile(
      sourceDir,
      'package-lock.json',
      `${JSON.stringify({
        name: 'contextEngine',
        version: '0.1.0',
        lockfileVersion: 3,
        packages: { '': { name: 'contextEngine', version: '0.1.0' } },
      }, null, 2)}\n`,
    );
    writeFile(
      sourceDir,
      path.join('client', 'package.json'),
      `${JSON.stringify({ name: 'client', version: '0.1.0', private: true }, null, 2)}\n`,
    );
    writeFile(
      sourceDir,
      path.join('client', 'package-lock.json'),
      `${JSON.stringify({
        name: 'client',
        version: '0.1.0',
        lockfileVersion: 3,
        packages: { '': { name: 'client', version: '0.1.0' } },
      }, null, 2)}\n`,
    );
    writeFile(sourceDir, path.join('scripts', 'public-node-test-fixture.js'), "console.log('public node fixture passed');\n");
    commitAll(sourceDir, 'Initial public base', {
      authorDate: '2025-01-01T00:00:00Z',
      committerDate: '2025-01-01T00:00:00Z',
    });
    git(sourceDir, ['push', '--quiet', '-u', 'origin', 'main']);

    git(sourceDir, ['checkout', '--quiet', '-b', 'dev']);

    writeFile(sourceDir, 'public.txt', 'public one\n');
    commitAll(sourceDir, 'Public commit title\n\nPublic commit body line.\n', {
      authorDate: '2025-01-02T03:04:05Z',
      committerDate: '2025-01-02T03:04:05Z',
    });

    writeFile(sourceDir, path.join('TODO', 'secret.md'), 'private only\n');
    writeFile(sourceDir, path.join('TODO', `${'PR'}${'D'}s`, '123_private-roadmap.md'), 'private roadmap\n');
    commitAll(sourceDir, 'Private-only commit', {
      authorDate: '2025-01-03T04:05:06Z',
      committerDate: '2025-01-03T04:05:06Z',
    });

    writeFile(sourceDir, path.join('contextEngine-cc', 'agent', 'contract.md'), 'private agent contract\n');
    writeFile(sourceDir, path.join('contextEngine-cc', 'server.mjs'), 'private runtime server\n');
    writeFile(sourceDir, path.join('contextEngine-cc', 'package.json'), '{"private":true}\n');
    writeFile(sourceDir, path.join('contextEngine-cc', 'public', 'js', 'sessionSlugs.mjs'), 'export default [];\n');
    writeFile(sourceDir, path.join('docs', 'agent-native-contract.md'), 'private agent doc\n');
    writeFile(sourceDir, path.join('docs', 'telegram-response-export-scope-prd.md'), 'private release planning\n');
    writeFile(sourceDir, path.join('client', 'public', 'skill.md'), 'private agent skill\n');
    writeFile(
      sourceDir,
      path.join('workers', 'agentBridgeWorker', 'worker.js'),
      'private pre-cutover agent bridge worker\n',
    );
    writeFile(
      sourceDir,
      path.join('workers', 'agentBridgeWorker', 'retired-private-notes.txt'),
      'deleted before the audited public cutover\n',
    );
    writeFile(
      sourceDir,
      path.join('scripts', 'run-agent-bridge-worker-tests.js'),
      'private pre-cutover agent bridge test runner\n',
    );
    commitAll(sourceDir, 'Private agent-only commit', {
      authorDate: '2025-01-03T06:07:08Z',
      committerDate: '2025-01-03T06:07:08Z',
    });

    writeFile(sourceDir, 'public.txt', 'public one\npublic two\n');
    writeFile(sourceDir, '.secrets.baseline', '{"results":{".codex/secret.txt":[]}}\n');
    writeFile(sourceDir, '.env.e2e', 'E2E_SECRET=value\n');
    writeFile(sourceDir, '.env.e2e.local', 'E2E_LOCAL_SECRET=value\n');
    writeFile(sourceDir, '.env.e2e.example', 'E2E_AI_MOCK=1\n');
    writeFile(sourceDir, 'private-pack.manifest.json', '{"generated":"local-only"}\n');
    writeFile(sourceDir, path.join('.tmp-review', 'review-snapshot.js'), 'temp review snapshot\n');
    writeFile(sourceDir, path.join('TODO', `${'PR'}${'D'}s`, '456_private-mixed-roadmap.md'), 'private mixed roadmap\n');
    writeFile(sourceDir, path.join('contextEngine-cc', 'secret.txt'), 'internal\n');
    writeFile(sourceDir, path.join('docs', 'agent-native-bridge.md'), 'private agent bridge\n');
    writeFile(sourceDir, path.join('docs', 'telegram-cloudflare-500-user-scale-prd.md'), 'private telegram planning\n');
    writeFile(sourceDir, path.join('client', 'public', 'skill.md'), 'private agent skill v2\n');
    writeFile(sourceDir, path.join('workers', 'agentBridgeWorker', 'worker.js'), 'public agent bridge worker\n');
    writeFile(sourceDir, path.join('workers', 'agentBridgeWorker', 'transportMock.mjs'), 'agent bridge mock\n');
    fs.rmSync(path.join(sourceDir, 'workers', 'agentBridgeWorker', 'retired-private-notes.txt'));
    writeFile(
      sourceDir,
      path.join('workers', 'agentBridgeWorker', 'PUBLIC_RELEASE_CUTOVER'),
      [
        'context-engine-agent-bridge-public-cutover-v1',
        'audited=2025-01-04',
        'scope=workers/agentBridgeWorker,scripts/run-agent-bridge-worker-tests.js',
        '',
      ].join('\n'),
    );
    writeFile(sourceDir, path.join('scripts', 'run-agent-bridge-worker-tests.js'), 'agent bridge test runner\n');
    writeFile(
      sourceDir,
      'package.json',
      `${JSON.stringify(
        {
          name: 'contextEngine',
          version: '0.1.0',
          scripts: {
            'test:node': 'node scripts/public-node-test-fixture.js',
            'test:worker:agent-bridge': 'node scripts/run-agent-bridge-worker-tests.js',
          },
        },
        null,
        2,
      )}\n`,
    );
    writeFile(sourceDir, path.join('scripts', 'vendor-cecc-ethers-bundle.js'), 'private companion vendoring\n');
    commitAll(sourceDir, 'Mixed commit', {
      authorDate: '2025-01-04T05:06:07Z',
      committerDate: '2025-01-04T05:06:07Z',
    });

    return {
      tempRoot,
      remoteDir,
      sourceDir,
    };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

function withSourceRepo(run) {
  const repo = setupSourceRepo();
  try {
    return run(repo);
  } finally {
    fs.rmSync(repo.tempRoot, { recursive: true, force: true });
  }
}

function parseSummaryValue(stdout, label) {
  const match = stdout.match(new RegExp(`^${label}: (.+)$`, 'm'));
  return match ? match[1] : null;
}

function assertNoPrivatePlanningPaths(trackedPaths) {
  const planningToken = `${'PR'}${'D'}`;
  const planningPathPattern = new RegExp(`(^|/)TODO(/|$)|(^|/)[^/\\n]*${planningToken}s?[^/\\n]*(/|$)`, 'mi');
  assert.doesNotMatch(trackedPaths, planningPathPattern);
}

test('sync-public-history dry run reports replayed and skipped commits without creating a branch', () => {
  withSourceRepo(({ sourceDir }) => {
    const result = runSyncScript(sourceDir, ['--dry-run', 'release-candidate']);

    assert.equal(result.status, 0, syncFailureMessage(result));
    assert.match(result.stdout, /Dry run complete\./);
    assert.match(result.stdout, /Would replay: 2/);
    assert.match(result.stdout, /Would skip: 2/);
    assert.match(result.stdout, /Branch name: release-candidate/);
    assert.match(result.stderr, /DRY RUN replay .*Public commit title/);
    assert.match(result.stderr, /DRY RUN skip .*Private-only commit/);
    assert.match(result.stderr, /DRY RUN skip .*Private agent-only commit/);
    assert.equal(git(sourceDir, ['branch', '--list', 'release-candidate']).trim(), '');
  });
});

test('sync-public-history accepts an explicit source branch', () => {
  withSourceRepo(({ sourceDir }) => {
    git(sourceDir, ['branch', 'dev-public-sync', 'dev']);

    const result = runSyncScript(sourceDir, ['--dry-run', '--source-branch', 'dev-public-sync', 'release-candidate']);

    assert.equal(result.status, 0, syncFailureMessage(result));
    assert.match(result.stdout, /Source branch: dev-public-sync/);
    assert.match(result.stdout, /Branch name: release-candidate/);
  });
});

test('sync-public-history rejects a private target base before creating a candidate', () => {
  withSourceRepo(({ sourceDir }) => {
    const privateTarget = git(sourceDir, ['rev-parse', 'dev~1']).trim();
    assert.match(git(sourceDir, ['ls-tree', '-r', '--name-only', privateTarget]), /^TODO\//m);

    const result = runSyncScript(sourceDir, [
      '--target-base',
      privateTarget,
      'release-candidate',
    ]);

    assert.equal(result.status, 1, syncFailureMessage(result));
    assert.match(result.stderr, new RegExp(`Target base ${privateTarget} is not contained in public history`));
    assert.equal(git(sourceDir, ['branch', '--list', 'release-candidate']).trim(), '');
  });
});

test('sync-public-history accepts a target base from the fetched public target history', () => {
  withSourceRepo(({ sourceDir }) => {
    git(sourceDir, ['checkout', '--quiet', '-b', 'prior-release', 'main']);
    writeFile(sourceDir, 'release-follow-up.txt', 'public staging follow-up\n');
    commitAll(sourceDir, 'Prior public staging change', {
      authorDate: '2025-01-02T00:00:00Z',
      committerDate: '2025-01-02T00:00:00Z',
    });
    const priorRelease = git(sourceDir, ['rev-parse', 'HEAD']).trim();
    git(sourceDir, ['push', '--quiet', 'origin', 'HEAD:release-candidate']);
    git(sourceDir, ['checkout', '--quiet', 'dev']);

    const result = runSyncScript(sourceDir, [
      '--target-base',
      priorRelease,
      'release-candidate',
    ]);

    assert.equal(result.status, 0, syncFailureMessage(result));
    assert.equal(
      git(sourceDir, ['merge-base', '--is-ancestor', priorRelease, 'release-candidate']),
      '',
    );
    assert.ok(result.stdout.includes(
      `To push: git push --force-with-lease=refs/heads/release-candidate:${priorRelease} -u origin release-candidate`,
    ));
  });
});

test('sync-public-history can replay patch-new commits from a source branch diverged from main', () => {
  withSourceRepo(({ sourceDir }) => {
    git(sourceDir, ['checkout', '--quiet', 'main']);
    writeFile(sourceDir, 'main-only.txt', 'direct main change\n');
    commitAll(sourceDir, 'Direct main commit', {
      authorDate: '2025-01-02T00:00:00Z',
      committerDate: '2025-01-02T00:00:00Z',
    });
    git(sourceDir, ['push', '--quiet', 'origin', 'main']);
    git(sourceDir, ['checkout', '--quiet', 'dev']);

    const defaultResult = runSyncScript(sourceDir, ['--dry-run', 'release-candidate']);
    assert.equal(defaultResult.status, 1);
    assert.match(defaultResult.stderr, /origin\/main is not an ancestor of dev/);
    assert.match(defaultResult.stderr, /--allow-diverged-source/);

    const result = runSyncScript(sourceDir, ['--allow-diverged-source', 'release-candidate']);

    assert.equal(result.status, 0, syncFailureMessage(result));
    assert.match(result.stderr, /using git cherry to replay patch-new non-merge commits/);
    assert.match(result.stdout, /Replay complete\./);
    assert.match(result.stdout, /Branch name: release-candidate/);
    assert.match(result.stdout, /Replayed commits: 2/);
    assert.match(result.stdout, /Skipped commits: 2/);

    const historySubjects = git(sourceDir, [
      'log',
      '--reverse',
      '--format=%s',
      'origin/main..release-candidate',
    ]).trim().split('\n');
    assert.deepEqual(historySubjects, [
      'Public commit title',
      'Mixed commit',
    ]);

    assert.equal(git(sourceDir, ['show', 'release-candidate:main-only.txt']), 'direct main change\n');
    assert.equal(git(sourceDir, ['show', 'release-candidate:public.txt']), 'public one\npublic two\n');
  });
});

test('sync-public-history resolves replay deletes over public-main edits', () => {
  withSourceRepo(({ sourceDir }) => {
    git(sourceDir, ['checkout', '--quiet', 'dev']);
    fs.rmSync(path.join(sourceDir, 'README.md'));
    commitAll(sourceDir, 'Remove stale public shim', {
      authorDate: '2025-01-05T00:00:00Z',
      committerDate: '2025-01-05T00:00:00Z',
    });

    git(sourceDir, ['checkout', '--quiet', 'main']);
    writeFile(sourceDir, 'README.md', 'public main edit\n');
    commitAll(sourceDir, 'Edit public readme on main', {
      authorDate: '2025-01-04T00:00:00Z',
      committerDate: '2025-01-04T00:00:00Z',
    });
    git(sourceDir, ['push', '--quiet', 'origin', 'main']);
    git(sourceDir, ['checkout', '--quiet', 'dev']);

    const result = runSyncScript(sourceDir, ['--allow-diverged-source', 'release-candidate']);

    assert.equal(result.status, 0, syncFailureMessage(result));
    assert.match(result.stdout, /Replay complete\./);
    assert.match(result.stdout, /Replayed commits: 3/);
    assert.match(result.stdout, /Skipped commits: 2/);

    const readmeCheck = spawnSync('git', ['cat-file', '-e', 'release-candidate:README.md'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });
    assert.notEqual(readmeCheck.status, 0);
  });
});

test('sync-public-history resolves large modify-delete conflict sets without racing the index', () => {
  withSourceRepo(({ sourceDir }) => {
    const conflictPaths = Array.from(
      { length: 128 },
      (_, index) => path.join('conflict-fixtures', `entry-${String(index).padStart(3, '0')}.txt`),
    );

    git(sourceDir, ['checkout', '--quiet', 'main']);
    for (const relativePath of conflictPaths) writeFile(sourceDir, relativePath, 'shared base\n');
    commitAll(sourceDir, 'Add shared conflict fixtures', {
      authorDate: '2025-01-06T00:00:00Z',
      committerDate: '2025-01-06T00:00:00Z',
    });
    const sharedFixtureCommit = git(sourceDir, ['rev-parse', 'HEAD']).trim();
    git(sourceDir, ['push', '--quiet', 'origin', 'main']);

    git(sourceDir, ['checkout', '--quiet', 'dev']);
    git(sourceDir, ['cherry-pick', '--quiet', sharedFixtureCommit]);
    for (const relativePath of conflictPaths) writeFile(sourceDir, relativePath, 'source update\n');
    commitAll(sourceDir, 'Update shared conflict fixtures', {
      authorDate: '2025-01-07T00:00:00Z',
      committerDate: '2025-01-07T00:00:00Z',
    });

    git(sourceDir, ['checkout', '--quiet', 'main']);
    for (const relativePath of conflictPaths) fs.rmSync(path.join(sourceDir, relativePath));
    commitAll(sourceDir, 'Remove shared conflict fixtures', {
      authorDate: '2025-01-08T00:00:00Z',
      committerDate: '2025-01-08T00:00:00Z',
    });
    git(sourceDir, ['push', '--quiet', 'origin', 'main']);
    git(sourceDir, ['checkout', '--quiet', 'dev']);

    const result = runSyncScript(sourceDir, ['--allow-diverged-source', 'release-candidate']);

    assert.equal(result.status, 0, syncFailureMessage(result));
    assert.match(result.stderr, /Resolved remaining cherry-pick conflicts from source/);
    for (const relativePath of conflictPaths) {
      const pathCheck = spawnSync('git', ['cat-file', '-e', `release-candidate:${relativePath}`], {
        cwd: sourceDir,
        encoding: 'utf8',
      });
      assert.notEqual(pathCheck.status, 0);
    }
  });
});

test('sync-public-history installs the private dev push guard before replaying', () => {
  withSourceRepo(({ sourceDir }) => {
    git(sourceDir, ['branch', '--set-upstream-to=origin/main', 'dev'], { stdio: 'ignore' });

    const result = runSyncScript(sourceDir, ['--dry-run']);

    assert.equal(result.status, 0, syncFailureMessage(result));
    assert.equal(git(sourceDir, ['config', '--local', '--get', 'core.hooksPath']).trim(), '.githooks');

    const upstreamResult = spawnSync(
      'git',
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', 'dev@{upstream}'],
      {
        cwd: sourceDir,
        encoding: 'utf8',
      },
    );
    assert.notEqual(upstreamResult.status, 0);
  });
});

test('sync-public-history replays public commits, skips private-only commits, and enforces public identity', () => {
  withSourceRepo(({ sourceDir }) => {
    const result = runSyncScript(sourceDir);

    assert.equal(result.status, 0, syncFailureMessage(result));
    assert.match(result.stdout, /Replay complete\./);
    assert.match(result.stdout, /Branch name: release-staging/);
    assert.match(result.stdout, /Replayed commits: 2/);
    assert.match(result.stdout, /Skipped commits: 2/);
    assert.match(result.stdout, /Release impact suggestion: patch/);
    assert.match(result.stdout, /Release version: 0\.1\.1/);
    assert.ok(result.stdout.includes(
      `To push: git push --force-with-lease=refs/heads/release-staging:${ZERO_OID} -u origin release-staging`,
    ));

    const tempDir = parseSummaryValue(result.stdout, 'Temp dir');
    assert.ok(tempDir);
    assert.equal(fs.existsSync(tempDir), false);

    const historyLines = git(sourceDir, [
      'log',
      '--reverse',
      '--format=%s|%aI|%cI|%an <%ae>|%cn <%ce>',
      'origin/main..release-staging',
    ]).trim().split('\n');

    assert.deepEqual(historyLines.slice(0, 2), [
      'Public commit title|2025-01-02T03:04:05Z|2025-01-02T03:04:05Z|Agalmic <agalmicsoftware@protonmail.com>|Agalmic <agalmicsoftware@protonmail.com>',
      'Mixed commit|2025-01-04T05:06:07Z|2025-01-04T05:06:07Z|Agalmic <agalmicsoftware@protonmail.com>|Agalmic <agalmicsoftware@protonmail.com>',
    ]);
    assert.match(
      historyLines[2],
      /^chore: bump public version to 0\.1\.1\|.+\|.+\|Agalmic <agalmicsoftware@protonmail\.com>\|Agalmic <agalmicsoftware@protonmail\.com>$/,
    );

    const replayedShas = git(sourceDir, [
      'log',
      '--reverse',
      '--format=%H',
      'origin/main..release-staging',
    ]).trim().split('\n');
    const sourceShasBySubject = new Map(
      git(sourceDir, ['log', '--format=%s%x09%H', 'origin/main..dev'])
        .trim()
        .split('\n')
        .map((line) => line.split('\t')),
    );
    const commitBodies = replayedShas.map((sha) => git(sourceDir, ['show', '--quiet', '--format=%B', sha]));
    assert.deepEqual(commitBodies, [
      'Public commit title\n\nPublic commit body line.\n\n',
      'Mixed commit\n\n',
      'chore: bump public version to 0.1.1\n\n',
    ]);
    assert.equal(JSON.parse(git(sourceDir, ['show', 'release-staging:package.json'])).version, '0.1.1');
    assert.equal(JSON.parse(git(sourceDir, ['show', 'release-staging:client/package.json'])).version, '0.1.1');

    const preCutoverPaths = git(sourceDir, ['ls-tree', '-r', '--name-only', replayedShas[0]]);
    assert.doesNotMatch(preCutoverPaths, /^workers\/agentBridgeWorker\//m);
    assert.doesNotMatch(preCutoverPaths, /^scripts\/run-agent-bridge-worker-tests\.js$/m);

    assert.equal(
      git(sourceDir, ['show', `${replayedShas[1]}:workers/agentBridgeWorker/worker.js`]),
      'public agent bridge worker\n',
    );
    assert.equal(
      git(sourceDir, ['show', `${replayedShas[1]}:scripts/run-agent-bridge-worker-tests.js`]),
      'agent bridge test runner\n',
    );
    assert.equal(
      git(sourceDir, ['show', `${replayedShas[1]}:workers/agentBridgeWorker/PUBLIC_RELEASE_CUTOVER`]),
      [
        'context-engine-agent-bridge-public-cutover-v1',
        'audited=2025-01-04',
        'scope=workers/agentBridgeWorker,scripts/run-agent-bridge-worker-tests.js',
        '',
      ].join('\n'),
    );
    const retiredPrivatePath = spawnSync(
      'git',
      ['cat-file', '-e', `${replayedShas[1]}:workers/agentBridgeWorker/retired-private-notes.txt`],
      { cwd: sourceDir, encoding: 'utf8' },
    );
    assert.notEqual(retiredPrivatePath.status, 0);

    const firstWorkerAppearance = git(sourceDir, [
      'log',
      '--reverse',
      '--format=%s',
      'origin/main..release-staging',
      '--',
      'workers/agentBridgeWorker',
      'scripts/run-agent-bridge-worker-tests.js',
    ]).trim().split('\n');
    assert.deepEqual(firstWorkerAppearance, ['Mixed commit']);

    const trackedPaths = git(sourceDir, ['ls-tree', '-r', '--name-only', 'release-staging']);
    assertNoPrivatePlanningPaths(trackedPaths);
    assert.doesNotMatch(trackedPaths, /^TODO\//m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\//m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\/server\.mjs$/m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\/package\.json$/m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\/public\/js\/sessionSlugs\.mjs$/m);
    assert.doesNotMatch(trackedPaths, /^docs\/agent-native.*\.md$/m);
    assert.doesNotMatch(trackedPaths, /^docs\/.*prd.*\.md$/mi);
    assert.doesNotMatch(trackedPaths, /^client\/public\/skill\.md$/m);
    assert.match(trackedPaths, /^workers\/agentBridgeWorker\//m);
    assert.match(trackedPaths, /^scripts\/run-agent-bridge-worker-tests\.js$/m);
    assert.doesNotMatch(trackedPaths, /^scripts\/vendor-cecc-ethers-bundle\.js$/m);
    assert.doesNotMatch(trackedPaths, /^\.tmp-review\//m);
    assert.doesNotMatch(trackedPaths, /^\.secrets\.baseline$/m);
    assert.doesNotMatch(trackedPaths, /^\.env\.e2e$/m);
    assert.doesNotMatch(trackedPaths, /^\.env\.e2e\.local$/m);
    assert.doesNotMatch(trackedPaths, /^\.env\.e2e\.example$/m);
    assert.doesNotMatch(trackedPaths, /^private-pack\.manifest\.json$/m);

    const publicFile = git(sourceDir, ['show', 'release-staging:public.txt']);
    assert.equal(publicFile, 'public one\npublic two\n');
  });
});

test('sync-public-history restores Agent Bridge package wiring at an explicit public cutover', () => {
  withSourceRepo(({ sourceDir }) => {
    git(sourceDir, ['checkout', '--quiet', '-B', 'cutover-source', 'origin/main']);

    writeFile(
      sourceDir,
      path.join('workers', 'agentBridgeWorker', 'worker.js'),
      'private pre-cutover agent bridge worker\n',
    );
    writeFile(
      sourceDir,
      path.join('scripts', 'run-agent-bridge-worker-tests.js'),
      'private pre-cutover agent bridge test runner\n',
    );
    writeFile(
      sourceDir,
      'package.json',
      `${JSON.stringify(
        {
          scripts: {
            'test:node': 'node scripts/public-node-test-fixture.js',
            'test:worker:agent-bridge': 'node scripts/run-agent-bridge-worker-tests.js',
          },
        },
        null,
        2,
      )}\n`,
    );
    commitAll(sourceDir, 'Prepare bridge source base', {
      authorDate: '2025-01-02T00:00:00Z',
      committerDate: '2025-01-02T00:00:00Z',
    });
    const sourceBase = git(sourceDir, ['rev-parse', 'HEAD']).trim();

    writeFile(sourceDir, path.join('workers', 'agentBridgeWorker', 'worker.js'), 'public agent bridge worker\n');
    writeFile(
      sourceDir,
      path.join('workers', 'agentBridgeWorker', 'PUBLIC_RELEASE_CUTOVER'),
      [
        'context-engine-agent-bridge-public-cutover-v1',
        'audited=2025-01-03',
        'scope=workers/agentBridgeWorker,scripts/run-agent-bridge-worker-tests.js',
        '',
      ].join('\n'),
    );
    writeFile(sourceDir, path.join('scripts', 'run-agent-bridge-worker-tests.js'), 'agent bridge test runner\n');
    commitAll(sourceDir, 'Publish bridge cutover', {
      authorDate: '2025-01-03T00:00:00Z',
      committerDate: '2025-01-03T00:00:00Z',
    });

    const result = runSyncScript(sourceDir, [
      '--source-branch',
      'cutover-source',
      '--source-base',
      sourceBase,
      '--target-base',
      'origin/main',
      'release-candidate',
    ]);

    assert.equal(result.status, 0, syncFailureMessage(result));
    const publicPackage = JSON.parse(git(sourceDir, ['show', 'release-candidate:package.json']));
    assert.equal(
      publicPackage.scripts['test:worker:agent-bridge'],
      'node scripts/run-agent-bridge-worker-tests.js',
    );
  });
});

test('sync-public-history removes package commands whose runners are stripped', () => {
  withSourceRepo(({ sourceDir }) => {
    const packagePath = path.join(sourceDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageJson.scripts['ai:test-private-e2e'] = 'node scripts/e2e/private-runner.js';
    packageJson.scripts['test:ci'] = 'npm run test:node && npm run ai:test-private-e2e';
    fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
    writeFile(sourceDir, path.join('scripts', 'e2e', 'private-runner.js'), 'private E2E runner\n');
    commitAll(sourceDir, 'Add source-only E2E command', {
      authorDate: '2025-01-05T00:00:00Z',
      committerDate: '2025-01-05T00:00:00Z',
    });

    const result = runSyncScript(sourceDir, ['release-candidate']);

    assert.equal(result.status, 0, syncFailureMessage(result));
    const publicPackage = JSON.parse(git(sourceDir, ['show', 'release-candidate:package.json']));
    assert.equal(publicPackage.scripts['ai:test-private-e2e'], undefined);
    assert.equal(publicPackage.scripts['test:ci'], 'npm run test:node');
  });
});

test('sync-public-history rejects public files that import stripped paths before pushing', () => {
  withSourceRepo(({ sourceDir }) => {
    const strippedImport = '../../contextEngine-cc/lib/litChipotleActionCatalog.mjs';
    writeFile(
      sourceDir,
      path.join('workers', 'sessionCorsWorker', 'chipotleClient.test.mjs'),
      `import { DEFAULT_CHIPOTLE_ACTION_CODE } from '${strippedImport}';\n`,
    );
    commitAll(sourceDir, 'Add public worker test with stripped import', {
      authorDate: '2025-01-05T06:07:08Z',
      committerDate: '2025-01-05T06:07:08Z',
    });

    const result = runSyncScript(sourceDir, ['--push', 'release-staging']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Public release surface verification failed/);
    assert.match(result.stderr, /contextEngine-cc\/lib\/litChipotleActionCatalog\.mjs/);

    const remoteCheck = spawnSync('git', ['ls-remote', '--heads', 'origin', 'release-staging'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });
    assert.equal(remoteCheck.status, 0);
    assert.equal(remoteCheck.stdout.trim(), '');
  });
});

test('sync-public-history rejects retained Markdown that exposes private planning before pushing', () => {
  withSourceRepo(({ sourceDir }) => {
    const planningId = `${'PR'}${'D'} 321`;
    writeFile(sourceDir, path.join('docs', 'public-guide.md'), `Status for ${planningId} lives here.\n`);
    commitAll(sourceDir, 'Add public guide with private planning status', {
      authorDate: '2025-01-05T06:07:08Z',
      committerDate: '2025-01-05T06:07:08Z',
    });

    const result = runSyncScript(sourceDir, ['--push', 'release-staging']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Public documentation verification failed/);
    assert.match(result.stderr, /internal planning identifier/);

    const remoteCheck = spawnSync('git', ['ls-remote', '--heads', 'origin', 'release-staging'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });
    assert.equal(remoteCheck.status, 0);
    assert.equal(remoteCheck.stdout.trim(), '');
  });
});

test('sync-public-history rejects a runner secret added and deleted after the Agent Bridge cutover', () => {
  withSourceRepo(({ sourceDir }) => {
    const unsafeToken = ['live', 'credential', 'material', 'must', 'not', 'ship'].join('-');
    const runnerPath = path.join('scripts', 'run-agent-bridge-worker-tests.js');
    writeFile(sourceDir, runnerPath, `const agent_api_token = '${unsafeToken}';\n`);
    commitAll(sourceDir, 'Add temporary agent bridge runner credential', {
      authorDate: '2025-01-05T06:07:08Z',
      committerDate: '2025-01-05T06:07:08Z',
    });
    writeFile(sourceDir, runnerPath, 'agent bridge test runner\n');
    commitAll(sourceDir, 'Remove temporary agent bridge runner credential', {
      authorDate: '2025-01-05T07:08:09Z',
      committerDate: '2025-01-05T07:08:09Z',
    });

    const result = runSyncScript(sourceDir, ['--push', 'release-staging']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Scanning Agent Bridge public replay commit for PII\/secrets/);
    assert.match(result.stderr, /public release PII scan failed/);
    assert.match(result.stderr, /scripts\/run-agent-bridge-worker-tests\.js/);

    const remoteCheck = spawnSync('git', ['ls-remote', '--heads', 'origin', 'release-staging'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });
    assert.equal(remoteCheck.status, 0);
    assert.equal(remoteCheck.stdout.trim(), '');
  });
});

test('sync-public-history rejects a public secret added and deleted outside Agent Bridge', () => {
  withSourceRepo(({ sourceDir }) => {
    const unsafeToken = ['live', 'credential', 'material', 'must', 'not', 'ship'].join('-');
    const publicConfigPath = path.join('client', 'src', 'transient-config.js');
    writeFile(sourceDir, publicConfigPath, `const provider_api_token = '${unsafeToken}';\n`);
    commitAll(sourceDir, 'Add temporary public credential', {
      authorDate: '2025-01-05T08:09:10Z',
      committerDate: '2025-01-05T08:09:10Z',
    });
    fs.rmSync(path.join(sourceDir, publicConfigPath));
    commitAll(sourceDir, 'Remove temporary public credential', {
      authorDate: '2025-01-05T09:10:11Z',
      committerDate: '2025-01-05T09:10:11Z',
    });

    const result = runSyncScript(sourceDir, ['--push', 'release-staging']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Scanning public replay commit for PII\/secrets/);
    assert.match(result.stderr, /public release PII scan failed/);
    assert.match(result.stderr, /client\/src\/transient-config\.js/);

    const remoteCheck = spawnSync('git', ['ls-remote', '--heads', 'origin', 'release-staging'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });
    assert.equal(remoteCheck.status, 0);
    assert.equal(remoteCheck.stdout.trim(), '');
  });
});

test('sync-public-history rejects a secret in a retained replay message', () => {
  withSourceRepo(({ sourceDir }) => {
    const unsafeToken = ['live', 'credential', 'material', 'must', 'not', 'ship'].join('-');
    writeFile(sourceDir, path.join('client', 'src', 'safe-config.js'), 'export const enabled = true;\n');
    commitAll(
      sourceDir,
      `Add safe public config\n\nprovider_api_token = '${unsafeToken}'\n`,
      {
        authorDate: '2025-01-05T10:11:12Z',
        committerDate: '2025-01-05T10:11:12Z',
      },
    );

    const result = runSyncScript(sourceDir, ['--push', 'release-staging']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Scanning public replay commit for PII\/secrets/);
    assert.match(result.stderr, /public release PII scan failed/);
    assert.match(result.stderr, /commit-message\.txt/);

    const remoteCheck = spawnSync('git', ['ls-remote', '--heads', 'origin', 'release-staging'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });
    assert.equal(remoteCheck.status, 0);
    assert.equal(remoteCheck.stdout.trim(), '');
  });
});

test('sync-public-history rejects an unsafe symlink added and deleted from public history', () => {
  withSourceRepo(({ sourceDir }) => {
    const publicLinkPath = path.join('client', 'src', 'transient-link');
    const absoluteLinkPath = path.join(sourceDir, publicLinkPath);
    const secretAssignment = `${'provider_api'}_${'token'}='${'live-credential'}-material-must-not-ship'`;
    const unsafeTarget = `/${'Us'}ers/example/${secretAssignment}`;
    fs.mkdirSync(path.dirname(absoluteLinkPath), { recursive: true });
    fs.symlinkSync(unsafeTarget, absoluteLinkPath);
    commitAll(sourceDir, 'Add temporary public symlink', {
      authorDate: '2025-01-05T11:12:13Z',
      committerDate: '2025-01-05T11:12:13Z',
    });
    fs.unlinkSync(absoluteLinkPath);
    commitAll(sourceDir, 'Remove temporary public symlink', {
      authorDate: '2025-01-05T12:13:14Z',
      committerDate: '2025-01-05T12:13:14Z',
    });

    const result = runSyncScript(sourceDir, ['--push', 'release-staging']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Scanning public replay commit for PII\/secrets/);
    assert.match(result.stderr, /public release PII scan failed/);
    assert.match(result.stderr, /client\/src\/transient-link/);

    const remoteCheck = spawnSync('git', ['ls-remote', '--heads', 'origin', 'release-staging'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });
    assert.equal(remoteCheck.status, 0);
    assert.equal(remoteCheck.stdout.trim(), '');
  });
});

test('sync-public-history rejects public Node test failures before pushing', () => {
  withSourceRepo(({ sourceDir }) => {
    writeFile(
      sourceDir,
      path.join('scripts', 'public-node-test-fixture.js'),
      "console.error('public node fixture failed');\nprocess.exit(1);\n",
    );
    commitAll(sourceDir, 'Break public node fixture', {
      authorDate: '2025-01-05T06:07:08Z',
      committerDate: '2025-01-05T06:07:08Z',
    });

    const result = runSyncScript(sourceDir, ['--push', 'release-staging']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Running public release Node tests/);
    assert.match(result.stderr, /public node fixture failed/);

    const remoteCheck = spawnSync('git', ['ls-remote', '--heads', 'origin', 'release-staging'], {
      cwd: sourceDir,
      encoding: 'utf8',
    });
    assert.equal(remoteCheck.status, 0);
    assert.equal(remoteCheck.stdout.trim(), '');
  });
});

test('sync-public-history links source node_modules for public Node ESM imports before pushing', () => {
  withSourceRepo(({ sourceDir }) => {
    writeFile(
      sourceDir,
      'package.json',
      `${JSON.stringify(
        {
          scripts: {
            'test:node': 'node scripts/public-node-test-fixture.mjs',
            'test:worker:agent-bridge': 'node scripts/run-agent-bridge-worker-tests.js',
          },
        },
        null,
        2,
      )}\n`,
    );
    writeFile(
      sourceDir,
      path.join('scripts', 'public-node-test-fixture.mjs'),
      "import { marker } from 'public-node-fixture';\nconsole.log(marker);\n",
    );
    commitAll(sourceDir, 'Use public node ESM fixture', {
      authorDate: '2025-01-05T07:08:09Z',
      committerDate: '2025-01-05T07:08:09Z',
    });

    writeFile(
      sourceDir,
      path.join('node_modules', 'public-node-fixture', 'package.json'),
      `${JSON.stringify({ type: 'module', exports: './index.js' }, null, 2)}\n`,
    );
    writeFile(
      sourceDir,
      path.join('node_modules', 'public-node-fixture', 'index.js'),
      "export const marker = 'public node ESM fixture passed';\n",
    );

    const result = runSyncScript(sourceDir, ['--push', 'release-staging']);

    assert.equal(result.status, 0, syncFailureMessage(result));
    assert.match(result.stderr, /Linking source node_modules into public test checkout/);
    assert.match(result.stdout, /public node ESM fixture passed/);
  });
});

test('sync-public-history rejects planning identifiers in replay messages unless sanitization is explicit', () => {
  withSourceRepo(({ sourceDir }) => {
    const planningId = `${'PR'}${'D'} 123`;
    writeFile(sourceDir, 'public-planning-message.txt', 'public change\n');
    writeFile(sourceDir, path.join('TODO', `${'PR'}${'D'}s`, '789_private-roadmap.md'), 'private planning still stripped\n');
    commitAll(sourceDir, `Public planning reference\n\nReferences ${planningId} without publishing planning files.\n`, {
      authorDate: '2025-01-05T06:07:08Z',
      committerDate: '2025-01-05T06:07:08Z',
    });

    const dryRun = runSyncScript(sourceDir, ['--dry-run', 'release-candidate']);
    assert.equal(dryRun.status, 2);
    assert.match(dryRun.stderr, /internal planning identifier/);

    const sanitized = runSyncScript(sourceDir, [
      '--dry-run',
      '--sanitize-private-replay-messages',
      'release-candidate',
    ]);
    assert.equal(sanitized.status, 0, syncFailureMessage(sanitized));
    assert.match(sanitized.stdout, /Would replay: 3/);
    assert.match(sanitized.stderr, /Sanitized private replay message tokens/);
  });
});

test('sync-public-history rejects replayed commit messages that mention private tokens', () => {
  withSourceRepo(({ sourceDir }) => {
    writeFile(sourceDir, 'public-leak.txt', 'public change\n');
    writeFile(sourceDir, path.join('docs', 'agent-native-leak.md'), 'private doc\n');
    commitAll(sourceDir, 'Public change\n\nReferences agent-native details.\n', {
      authorDate: '2025-01-05T06:07:08Z',
      committerDate: '2025-01-05T06:07:08Z',
    });

    const dryRun = runSyncScript(sourceDir, ['--dry-run', 'release-candidate']);
    assert.equal(dryRun.status, 2);
    assert.match(dryRun.stderr, /Commit message mentions private release token: agent-native/);
    assert.equal(git(sourceDir, ['branch', '--list', 'release-candidate']).trim(), '');

    const result = runSyncScript(sourceDir, ['release-candidate']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Refusing to replay .*Public change/);
    assert.match(result.stderr, /Commit message mentions private release token: agent-native/);
    assert.equal(git(sourceDir, ['branch', '--list', 'release-candidate']).trim(), '');
  });
});

test('sync-public-history can sanitize private tokens in otherwise public replay messages', () => {
  withSourceRepo(({ sourceDir }) => {
    writeFile(sourceDir, 'public-sanitized.txt', 'public change\n');
    const privateCoauthor = ['noreply', 'anthropic.com'].join('@');
    const syntheticEmail = ['private', 'example.com'].join('@');
    const syntheticSecretAssignment = [
      ['provider', 'api', 'token'].join('_'),
      ['live', 'credential', 'material', 'must', 'not', 'ship'].join('-'),
    ].join("='") + "'";
    writeFile(sourceDir, 'public-synthetic-email.txt', `fixture=${syntheticEmail}\n`);
    writeFile(
      sourceDir,
      path.join('scripts', 'verify-public-release-pii.test.js'),
      `const unsafeTarget = \`/${'Us'}ers/example/${syntheticSecretAssignment}\`;\n`,
    );
    commitAll(sourceDir, `Public sanitized change\n\nMentions contextEngine-cc and agent-native follow-up details.\n\nCo-Authored-By: Assistant <${privateCoauthor}>\n`, {
      authorDate: '2025-01-05T06:07:08Z',
      committerDate: '2025-01-05T06:07:08Z',
    });

    const inheritedHooksDir = path.join(sourceDir, 'inherited-hooks');
    const inheritedConfigPath = path.join(sourceDir, 'inherited-gitconfig');
    writeFile(sourceDir, path.join('inherited-hooks', 'pre-commit'), '#!/usr/bin/env bash\nexit 128\n');
    fs.chmodSync(path.join(inheritedHooksDir, 'pre-commit'), 0o755);
    fs.writeFileSync(inheritedConfigPath, [
      '[core]',
      `\thooksPath = ${inheritedHooksDir}`,
      '[commit]',
      '\tgpgSign = true',
      '',
    ].join('\n'));

    const result = runSyncScript(
      sourceDir,
      ['--sanitize-private-replay-messages', 'release-candidate'],
      { GIT_CONFIG_GLOBAL: inheritedConfigPath },
    );

    assert.equal(result.status, 0, syncFailureMessage(result));
    assert.match(result.stderr, /Sanitized private replay message tokens/);
    assert.match(result.stdout, /Replayed commits: 3/);

    const latestMessage = git(sourceDir, ['log', '-1', '--format=%B', 'release-candidate']);
    assert.match(latestMessage, /Public sanitized change/);
    assert.match(latestMessage, /private companion tooling/);
    assert.match(latestMessage, /private integration/);
    assert.doesNotMatch(latestMessage, /contextEngine-cc/i);
    assert.doesNotMatch(latestMessage, /agent-native/i);
    assert.doesNotMatch(latestMessage, /Co-Authored-By/i);
    assert.equal(
      git(sourceDir, ['show', 'release-candidate:public-synthetic-email.txt']),
      'fixture=[redacted-email]\n',
    );
    const normalizedScannerFixture = git(sourceDir, [
      'show',
      'release-candidate:scripts/verify-public-release-pii.test.js',
    ]);
    assert.doesNotMatch(normalizedScannerFixture, new RegExp(syntheticSecretAssignment));
    assert.match(normalizedScannerFixture, /\['provider', 'api', 'token'\]\.join\('_'\)/);
  });
});

test('sync-public-history rejects private replay tokens case-insensitively', () => {
  withSourceRepo(({ sourceDir }) => {
    writeFile(sourceDir, 'public-lowercase-leak.txt', 'public change\n');
    commitAll(sourceDir, 'Public lowercase leak\n\nmentions openclaw handoff details.\n', {
      authorDate: '2025-01-05T06:07:08Z',
      committerDate: '2025-01-05T06:07:08Z',
    });

    const result = runSyncScript(sourceDir, ['--dry-run', 'release-candidate']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Commit message mentions private release token: OpenClaw/);
    assert.equal(git(sourceDir, ['branch', '--list', 'release-candidate']).trim(), '');
  });
});

test('sync-public-history refreshes an existing remote PR branch safely without requiring --force-with-lease', () => {
  withSourceRepo(({ sourceDir }) => {
    git(sourceDir, ['push', '--quiet', 'origin', 'main:release-staging']);

    const result = runSyncScript(sourceDir, ['--push', 'release-staging']);

    assert.equal(result.status, 0, syncFailureMessage(result));
    assert.match(result.stderr, /Remote branch origin\/release-staging already exists and will be refreshed automatically with --force-with-lease\./);
    assert.match(result.stdout, /Branch name: release-staging/);
    assert.match(result.stdout, /Replayed commits: 2/);
    assert.match(result.stdout, /Skipped commits: 2/);
    assert.match(result.stdout, /Pushed: yes/);

    const historySubjects = git(sourceDir, [
      'log',
      '--reverse',
      '--format=%s',
      'origin/main..origin/release-staging',
    ]).trim().split('\n');
    assert.deepEqual(historySubjects, [
      'Public commit title',
      'Mixed commit',
      'chore: bump public version to 0.1.1',
    ]);
    assert.equal(
      JSON.parse(git(sourceDir, ['show', 'origin/release-staging:package.json'])).version,
      '0.1.1',
    );

    const trackedPaths = git(sourceDir, ['ls-tree', '-r', '--name-only', 'origin/release-staging']);
    assertNoPrivatePlanningPaths(trackedPaths);
    assert.doesNotMatch(trackedPaths, /^TODO\//m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\//m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\/server\.mjs$/m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\/package\.json$/m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\/public\/js\/sessionSlugs\.mjs$/m);
    assert.doesNotMatch(trackedPaths, /^docs\/agent-native.*\.md$/m);
    assert.doesNotMatch(trackedPaths, /^docs\/.*prd.*\.md$/mi);
    assert.doesNotMatch(trackedPaths, /^client\/public\/skill\.md$/m);
    assert.match(trackedPaths, /^workers\/agentBridgeWorker\//m);
    assert.match(trackedPaths, /^scripts\/run-agent-bridge-worker-tests\.js$/m);
    assert.doesNotMatch(trackedPaths, /^scripts\/vendor-cecc-ethers-bundle\.js$/m);
    assert.doesNotMatch(trackedPaths, /^\.tmp-review\//m);
    assert.doesNotMatch(trackedPaths, /^\.secrets\.baseline$/m);
    assert.doesNotMatch(trackedPaths, /^\.env\.e2e$/m);
    assert.doesNotMatch(trackedPaths, /^\.env\.e2e\.local$/m);
    assert.doesNotMatch(trackedPaths, /^\.env\.e2e\.example$/m);
    assert.doesNotMatch(trackedPaths, /^private-pack\.manifest\.json$/m);
  });
});

test('sync-public-history advances every successive release-staging candidate', () => {
  withSourceRepo(({ sourceDir }) => {
    const firstPush = runSyncScript(sourceDir, ['--push', 'release-staging']);
    assert.equal(firstPush.status, 0, syncFailureMessage(firstPush));
    assert.match(firstPush.stdout, /Release version: 0\.1\.1/);

    const secondPush = runSyncScript(sourceDir, [
      '--push',
      '--force-with-lease',
      'release-staging',
    ]);
    assert.equal(secondPush.status, 0, syncFailureMessage(secondPush));
    assert.match(secondPush.stdout, /Release version: 0\.1\.2/);

    for (const manifestPath of [
      'package.json',
      'package-lock.json',
      'client/package.json',
      'client/package-lock.json',
    ]) {
      assert.equal(
        JSON.parse(git(sourceDir, ['show', `origin/release-staging:${manifestPath}`])).version,
        '0.1.2',
      );
    }
  });
});

test('sync-public-history applies an operator-selected minor version', () => {
  withSourceRepo(({ sourceDir }) => {
    const result = runSyncScript(sourceDir, [
      '--release-version',
      '0.2.0',
      'release-staging-minor',
    ]);

    assert.equal(result.status, 0, syncFailureMessage(result));
    assert.match(result.stdout, /Release version: 0\.2\.0/);
    assert.equal(
      JSON.parse(git(sourceDir, ['show', 'release-staging-minor:package.json'])).version,
      '0.2.0',
    );
    assert.equal(
      JSON.parse(git(sourceDir, ['show', 'release-staging-minor:client/package.json'])).version,
      '0.2.0',
    );
  });
});

test('sync-public-history suggests minor releases and requires an operator decision', () => {
  withSourceRepo(({ sourceDir }) => {
    writeFile(sourceDir, 'feature.txt', 'new public capability\n');
    commitAll(sourceDir, 'feat: add public capability', {
      authorDate: '2025-01-05T06:07:08Z',
      committerDate: '2025-01-05T06:07:08Z',
    });

    const blocked = runSyncScript(sourceDir, ['release-staging-feature']);
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /release impact suggests minor/i);
    assert.match(blocked.stderr, /--release-version/);
    assert.match(blocked.stderr, /--acknowledge-patch/);

    const acknowledged = runSyncScript(sourceDir, [
      '--acknowledge-patch',
      'release-staging-feature',
    ]);
    assert.equal(acknowledged.status, 0, syncFailureMessage(acknowledged));
    assert.match(acknowledged.stdout, /Release impact suggestion: minor/);
    assert.match(acknowledged.stdout, /Release version: 0\.1\.1/);
  });
});

test('sync-public-history refuses to refresh an existing local target branch without --force-with-lease', () => {
  withSourceRepo(({ sourceDir }) => {
    const initialPush = runSyncScript(sourceDir, ['--push', 'release-staging']);
    assert.equal(initialPush.status, 0);
    assert.match(initialPush.stdout, /Pushed: yes/);

    git(sourceDir, ['push', '--quiet', 'origin', '--delete', 'release-staging']);

    writeFile(sourceDir, 'public.txt', 'public one\npublic two\npublic three\n');
    writeFile(sourceDir, path.join('TODO', 'more-secret.md'), 'still private\n');
    commitAll(sourceDir, 'Follow-up public commit', {
      authorDate: '2025-01-05T06:07:08Z',
      committerDate: '2025-01-05T06:07:08Z',
    });

    const refreshPush = runSyncScript(sourceDir, ['--push', 'release-staging']);

    assert.equal(refreshPush.status, 1);
    assert.match(refreshPush.stderr, /Local branch release-staging already exists in the source repo/);
  });
});

test('sync-public-history recreates a deleted remote branch from an existing local target branch with --force-with-lease', () => {
  withSourceRepo(({ sourceDir }) => {
    const initialPush = runSyncScript(sourceDir, ['--push', 'release-staging']);
    assert.equal(initialPush.status, 0);
    assert.match(initialPush.stdout, /Pushed: yes/);

    git(sourceDir, ['push', '--quiet', 'origin', '--delete', 'release-staging']);

    writeFile(sourceDir, 'public.txt', 'public one\npublic two\npublic three\n');
    writeFile(sourceDir, path.join('TODO', 'more-secret.md'), 'still private\n');
    commitAll(sourceDir, 'Follow-up public commit', {
      authorDate: '2025-01-05T06:07:08Z',
      committerDate: '2025-01-05T06:07:08Z',
    });

    const refreshPush = runSyncScript(sourceDir, ['--push', '--force-with-lease', 'release-staging']);

    assert.equal(refreshPush.status, 0);
    assert.match(refreshPush.stderr, /Local branch release-staging already exists and will be refreshed with --force-with-lease\./);
    assert.match(refreshPush.stdout, /Branch name: release-staging/);
    assert.match(refreshPush.stdout, /Replayed commits: 3/);
    assert.match(refreshPush.stdout, /Skipped commits: 2/);
    assert.match(refreshPush.stdout, /Pushed: yes/);

    const historySubjects = git(sourceDir, [
      'log',
      '--reverse',
      '--format=%s',
      'origin/main..origin/release-staging',
    ]).trim().split('\n');
    assert.deepEqual(historySubjects, [
      'Public commit title',
      'Mixed commit',
      'Follow-up public commit',
      'chore: bump public version to 0.1.1',
    ]);

    const trackedPaths = git(sourceDir, ['ls-tree', '-r', '--name-only', 'origin/release-staging']);
    assertNoPrivatePlanningPaths(trackedPaths);
    assert.doesNotMatch(trackedPaths, /^TODO\//m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\//m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\/server\.mjs$/m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\/package\.json$/m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\/public\/js\/sessionSlugs\.mjs$/m);
    assert.doesNotMatch(trackedPaths, /^docs\/agent-native.*\.md$/m);
    assert.doesNotMatch(trackedPaths, /^docs\/.*prd.*\.md$/mi);
    assert.doesNotMatch(trackedPaths, /^client\/public\/skill\.md$/m);
    assert.match(trackedPaths, /^workers\/agentBridgeWorker\//m);
    assert.match(trackedPaths, /^scripts\/run-agent-bridge-worker-tests\.js$/m);
    assert.doesNotMatch(trackedPaths, /^scripts\/vendor-cecc-ethers-bundle\.js$/m);
    assert.doesNotMatch(trackedPaths, /^\.tmp-review\//m);
    assert.doesNotMatch(trackedPaths, /^\.env\.e2e$/m);
    assert.doesNotMatch(trackedPaths, /^\.env\.e2e\.local$/m);
    assert.doesNotMatch(trackedPaths, /^\.env\.e2e\.example$/m);
    assert.doesNotMatch(trackedPaths, /^private-pack\.manifest\.json$/m);

    const publicFile = git(sourceDir, ['show', 'origin/release-staging:public.txt']);
    assert.equal(publicFile, 'public one\npublic two\npublic three\n');
  });
});
