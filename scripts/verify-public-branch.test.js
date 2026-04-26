'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const SCRIPT_SOURCE_PATH = path.join(__dirname, 'verify-public-branch.sh');
const HELPER_SOURCE_PATH = path.join(__dirname, 'lib', 'public-release-strip-patterns.sh');
const TEST_TMP_ROOT = path.join(__dirname, '.tmp-verify-public-branch-tests');

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

function installVerifyScriptFixture(repoDir) {
  writeFile(repoDir, path.join('scripts', 'verify-public-branch.sh'), fs.readFileSync(SCRIPT_SOURCE_PATH, 'utf8'));
  writeFile(
    repoDir,
    path.join('scripts', 'lib', 'public-release-strip-patterns.sh'),
    fs.readFileSync(HELPER_SOURCE_PATH, 'utf8'),
  );
}

function runVerifyScript(repoDir, ref) {
  return spawnSync('bash', [path.join(repoDir, 'scripts', 'verify-public-branch.sh'), ref], {
    cwd: repoDir,
    encoding: 'utf8',
  });
}

function setupRepo({ withPrivatePaths }) {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(TEST_TMP_ROOT, 'ce-verify-public-branch-'));
  const repoDir = path.join(tempRoot, 'repo');
  fs.mkdirSync(repoDir, { recursive: true });

  try {
    git(repoDir, ['init', '--quiet', '--initial-branch=main']);
    git(repoDir, ['config', 'user.name', 'Private Dev']);
    git(repoDir, ['config', 'user.email', 'private@example.com']);

    installVerifyScriptFixture(repoDir);

    writeFile(repoDir, 'README.md', 'public file\n');
    if (withPrivatePaths) {
      writeFile(repoDir, 'private-pack.manifest.json', 'stale manifest\n');
      writeFile(repoDir, path.join('test', 'contextEngineCc.sw-cache-policy.test.mjs'), 'private ce-cc fixture\n');
      writeFile(repoDir, path.join('.tmp-review', 'legacy.js'), 'temporary review copy\n');
    }

    git(repoDir, ['add', '-A']);
    git(repoDir, ['commit', '--quiet', '-m', 'Fixture commit']);
    git(repoDir, ['branch', 'release-staging']);

    return { tempRoot, repoDir };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

function withRepo(options, run) {
  const repo = setupRepo(options);
  try {
    return run(repo);
  } finally {
    fs.rmSync(repo.tempRoot, { recursive: true, force: true });
  }
}

test('verify-public-branch fails when the target ref still tracks strip-listed files', () => {
  withRepo({ withPrivatePaths: true }, ({ repoDir }) => {
    const result = runVerifyScript(repoDir, 'release-staging');

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Tracked paths in release-staging still match the public strip list:/);
    assert.match(result.stderr, /private-pack\.manifest\.json/);
    assert.match(result.stderr, /test\/contextEngineCc\.sw-cache-policy\.test\.mjs/);
    assert.match(result.stderr, /\.tmp-review\/legacy\.js/);
  });
});

test('verify-public-branch passes when the target ref has no strip-listed tracked files', () => {
  withRepo({ withPrivatePaths: false }, ({ repoDir }) => {
    const result = runVerifyScript(repoDir, 'release-staging');

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /No tracked strip-pattern matches found in release-staging\./);
  });
});
