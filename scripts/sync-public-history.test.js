'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const SCRIPT_SOURCE_PATH = path.join(__dirname, 'sync-public-history.sh');
const HELPER_SOURCE_PATH = path.join(__dirname, 'lib', 'public-release-strip-patterns.sh');
const TEST_TMP_ROOT = path.join(__dirname, '.tmp-sync-public-history-tests');

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

function runSyncScript(sourceDir, args = []) {
  return spawnSync('bash', [path.join(sourceDir, 'scripts', 'sync-public-history.sh'), ...args], {
    cwd: sourceDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      TMPDIR: TEST_TMP_ROOT,
    },
  });
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
    git(sourceDir, ['config', 'user.email', 'private@example.com'], { stdio: 'ignore' });

    installSyncScriptFixture(sourceDir);

    writeFile(sourceDir, 'README.md', 'base\n');
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
    commitAll(sourceDir, 'Private-only commit', {
      authorDate: '2025-01-03T04:05:06Z',
      committerDate: '2025-01-03T04:05:06Z',
    });

    writeFile(sourceDir, 'public.txt', 'public one\npublic two\n');
    writeFile(sourceDir, path.join('contextEngine-cc', 'secret.txt'), 'internal\n');
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

test('sync-public-history dry run reports replayed and skipped commits without creating a branch', () => {
  withSourceRepo(({ sourceDir }) => {
    const result = runSyncScript(sourceDir, ['--dry-run', 'release-candidate']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Dry run complete\./);
    assert.match(result.stdout, /Would replay: 2/);
    assert.match(result.stdout, /Would skip: 1/);
    assert.match(result.stdout, /Branch name: release-candidate/);
    assert.match(result.stderr, /DRY RUN replay .*Public commit title/);
    assert.match(result.stderr, /DRY RUN skip .*Private-only commit/);
    assert.equal(git(sourceDir, ['branch', '--list', 'release-candidate']).trim(), '');
  });
});

test('sync-public-history accepts an explicit source branch', () => {
  withSourceRepo(({ sourceDir }) => {
    git(sourceDir, ['branch', 'dev-public-sync', 'dev']);

    const result = runSyncScript(sourceDir, ['--dry-run', '--source-branch', 'dev-public-sync', 'release-candidate']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Source branch: dev-public-sync/);
    assert.match(result.stdout, /Branch name: release-candidate/);
  });
});

test('sync-public-history replays public commits, skips private-only commits, and enforces public identity', () => {
  withSourceRepo(({ sourceDir }) => {
    const result = runSyncScript(sourceDir);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Replay complete\./);
    assert.match(result.stdout, /Branch name: release-staging/);
    assert.match(result.stdout, /Replayed commits: 2/);
    assert.match(result.stdout, /Skipped commits: 1/);
    assert.match(result.stdout, /To push: git push -u origin release-staging/);

    const tempDir = parseSummaryValue(result.stdout, 'Temp dir');
    assert.ok(tempDir);
    assert.equal(fs.existsSync(tempDir), false);

    const historyLines = git(sourceDir, [
      'log',
      '--reverse',
      '--format=%s|%aI|%cI|%an <%ae>|%cn <%ce>',
      'origin/main..release-staging',
    ]).trim().split('\n');

    assert.deepEqual(historyLines, [
      'Public commit title|2025-01-02T03:04:05Z|2025-01-02T03:04:05Z|Agalmic <agalmicsoftware@protonmail.com>|Agalmic <agalmicsoftware@protonmail.com>',
      'Mixed commit|2025-01-04T05:06:07Z|2025-01-04T05:06:07Z|Agalmic <agalmicsoftware@protonmail.com>|Agalmic <agalmicsoftware@protonmail.com>',
    ]);

    const replayedShas = git(sourceDir, [
      'log',
      '--reverse',
      '--format=%H',
      'origin/main..release-staging',
    ]).trim().split('\n');
    const commitBodies = replayedShas.map((sha) => git(sourceDir, ['show', '--quiet', '--format=%B', sha]));
    assert.deepEqual(commitBodies, [
      'Public commit title\n\nPublic commit body line.\n\n',
      'Mixed commit\n\n',
    ]);

    const trackedPaths = git(sourceDir, ['ls-tree', '-r', '--name-only', 'release-staging']);
    assert.doesNotMatch(trackedPaths, /^TODO\//m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\//m);

    const publicFile = git(sourceDir, ['show', 'release-staging:public.txt']);
    assert.equal(publicFile, 'public one\npublic two\n');
  });
});

test('sync-public-history refuses to run when the target remote branch already exists', () => {
  withSourceRepo(({ sourceDir }) => {
    git(sourceDir, ['push', '--quiet', 'origin', 'main:release-staging']);

    const result = runSyncScript(sourceDir);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Remote branch origin\/release-staging already exists/);
    assert.equal(git(sourceDir, ['branch', '--list', 'release-staging']).trim(), '');
  });
});

test('sync-public-history updates an existing PR branch with --force-with-lease without reintroducing private paths', () => {
  withSourceRepo(({ sourceDir }) => {
    const initialPush = runSyncScript(sourceDir, ['--push', 'release-staging']);
    assert.equal(initialPush.status, 0);
    assert.match(initialPush.stdout, /Pushed: yes/);

    writeFile(sourceDir, 'public.txt', 'public one\npublic two\npublic three\n');
    writeFile(sourceDir, path.join('TODO', 'more-secret.md'), 'still private\n');
    commitAll(sourceDir, 'Follow-up public commit', {
      authorDate: '2025-01-05T06:07:08Z',
      committerDate: '2025-01-05T06:07:08Z',
    });

    const refreshPush = runSyncScript(sourceDir, ['--push', '--force-with-lease', 'release-staging']);

    assert.equal(refreshPush.status, 0);
    assert.match(refreshPush.stderr, /will be replaced with --force-with-lease/);
    assert.match(refreshPush.stdout, /Branch name: release-staging/);
    assert.match(refreshPush.stdout, /Replayed commits: 3/);
    assert.match(refreshPush.stdout, /Skipped commits: 1/);
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
    ]);

    const trackedPaths = git(sourceDir, ['ls-tree', '-r', '--name-only', 'origin/release-staging']);
    assert.doesNotMatch(trackedPaths, /^TODO\//m);
    assert.doesNotMatch(trackedPaths, /^contextEngine-cc\//m);

    const publicFile = git(sourceDir, ['show', 'origin/release-staging:public.txt']);
    assert.equal(publicFile, 'public one\npublic two\npublic three\n');
  });
});
