'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const PRE_PUSH_SOURCE_PATH = path.join(__dirname, '..', '.githooks', 'pre-push');
const NON_ZERO_SHA = '1111111111111111111111111111111111111111';
const ZERO_SHA = '0000000000000000000000000000000000000000';

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function setupHookFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-pre-push-guard-'));
  execFileSync('git', ['init', '--quiet'], { cwd: tempDir });
  writeFile(
    tempDir,
    path.join('.githooks', 'pre-push'),
    fs.readFileSync(PRE_PUSH_SOURCE_PATH, 'utf8'),
  );
  fs.chmodSync(path.join(tempDir, '.githooks', 'pre-push'), 0o755);
  return tempDir;
}

function withHookFixture(run) {
  const tempDir = setupHookFixture();
  try {
    return run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function gitDir(rootDir) {
  return execFileSync('git', ['rev-parse', '--git-dir'], {
    cwd: rootDir,
    encoding: 'utf8',
  }).trim();
}

function runHook(rootDir, input, remoteName = 'origin') {
  return spawnSync(
    'bash',
    [
      path.join(rootDir, '.githooks', 'pre-push'),
      remoteName,
      '[redacted-email]-agalmic:AgalmicSoftware/context-engine.git',
    ],
    {
      cwd: rootDir,
      encoding: 'utf8',
      input,
    },
  );
}

function pushLine({ localRef, localSha = NON_ZERO_SHA, remoteRef, remoteSha = ZERO_SHA }) {
  return `${localRef} ${localSha} ${remoteRef} ${remoteSha}\n`;
}

test('pre-push guard blocks dev pushes to the public origin', () => {
  withHookFixture((rootDir) => {
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/dev',
      remoteRef: 'refs/heads/dev',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Blocked push to public Context Engine remote origin\./);
    assert.match(result.stderr, /Rejected ref: refs\/heads\/dev/);
    assert.doesNotMatch(result.stderr, /CE_PUSH_OVERRIDE|CE_ALLOW_PRIVATE_BRANCH_PUSH/);
  });
});

test('pre-push guard allows main pushes to the public origin', () => {
  withHookFixture((rootDir) => {
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/main',
      remoteRef: 'refs/heads/main',
    }));

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
  });
});

test('pre-push guard allows release-staging pushes to the public origin', () => {
  withHookFixture((rootDir) => {
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging-refresh',
      remoteRef: 'refs/heads/release-staging-refresh',
    }));

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
  });
});

test('pre-push guard allows remote deletions to the public origin', () => {
  withHookFixture((rootDir) => {
    const result = runHook(rootDir, pushLine({
      localRef: '(delete)',
      localSha: ZERO_SHA,
      remoteRef: 'refs/heads/dev',
      remoteSha: NON_ZERO_SHA,
    }));

    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
  });
});

test('pre-push guard honors and consumes the one-shot override file', () => {
  withHookFixture((rootDir) => {
    const overridePath = path.join(rootDir, gitDir(rootDir), 'CE_PUSH_OVERRIDE');
    fs.writeFileSync(overridePath, 'operator-approved\n');

    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/dev',
      remoteRef: 'refs/heads/dev',
    }));

    assert.equal(result.status, 0);
    assert.match(result.stderr, /warning: consumed one-time CE push override for origin\./);
    assert.equal(fs.existsSync(overridePath), false);
  });
});
