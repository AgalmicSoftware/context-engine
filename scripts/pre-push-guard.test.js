'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const PRE_PUSH_SOURCE_PATH = path.join(__dirname, '..', '.githooks', 'pre-push');
const RELEASE_VERSION_SOURCE_PATH = path.join(__dirname, 'release-version.mjs');
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
  writeFile(
    tempDir,
    path.join('scripts', 'release-version.mjs'),
    fs.readFileSync(RELEASE_VERSION_SOURCE_PATH, 'utf8'),
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

function writeVersionSurfaces(rootDir, version, clientVersion = version) {
  const rootPackage = { name: 'contextEngine', version, private: true };
  const clientPackage = { name: 'client', version: clientVersion, private: true };
  const lock = (pkg) => ({
    ...pkg,
    lockfileVersion: 3,
    packages: { '': { name: pkg.name, version: pkg.version } },
  });

  writeFile(rootDir, 'package.json', `${JSON.stringify(rootPackage, null, 2)}\n`);
  writeFile(rootDir, 'package-lock.json', `${JSON.stringify(lock(rootPackage), null, 2)}\n`);
  writeFile(rootDir, path.join('client', 'package.json'), `${JSON.stringify(clientPackage, null, 2)}\n`);
  writeFile(rootDir, path.join('client', 'package-lock.json'), `${JSON.stringify(lock(clientPackage), null, 2)}\n`);
}

function createVersionedCandidate(rootDir, candidateVersion, clientVersion = candidateVersion) {
  git(rootDir, ['config', 'user.name', 'Test User']);
  git(rootDir, ['config', 'user.email', 'test@example.com']);
  writeVersionSurfaces(rootDir, '0.1.0');
  git(rootDir, ['add', '-A']);
  git(rootDir, ['commit', '--quiet', '-m', 'base']);
  const mainSha = git(rootDir, ['rev-parse', 'HEAD']);
  git(rootDir, ['update-ref', 'refs/remotes/origin/main', mainSha]);

  writeVersionSurfaces(rootDir, candidateVersion, clientVersion);
  writeFile(rootDir, 'candidate.txt', `${candidateVersion}\n`);
  git(rootDir, ['add', '-A']);
  git(rootDir, ['commit', '--quiet', '-m', 'candidate']);
  return {
    mainSha,
    candidateSha: git(rootDir, ['rev-parse', 'HEAD']),
  };
}

function git(rootDir, args) {
  return execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
  }).trim();
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
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.1');
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging-refresh',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging-refresh',
    }));

    assert.equal(result.status, 0);
    assert.match(result.stderr, /release version verified: 0\.1\.1/);
  });
});

test('pre-push guard blocks release-staging versions that do not advance public main', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.0');
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Candidate version 0\.1\.0 must be greater/);
    assert.match(result.stderr, /Blocked release-staging push/);
  });
});

test('pre-push guard blocks mismatched release version surfaces', () => {
  withHookFixture((rootDir) => {
    const { candidateSha } = createVersionedCandidate(rootDir, '0.1.1', '0.1.2');
    const result = runHook(rootDir, pushLine({
      localRef: 'refs/heads/release-staging',
      localSha: candidateSha,
      remoteRef: 'refs/heads/release-staging',
    }));

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Release version surface mismatch/);
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
