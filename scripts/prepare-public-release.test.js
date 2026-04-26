'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const SCRIPT_SOURCE_PATH = path.join(__dirname, 'prepare-public-release.sh');
const HELPER_SOURCE_PATH = path.join(__dirname, 'lib', 'public-release-strip-patterns.sh');
const TEST_TMP_ROOT = path.join(__dirname, '.tmp-prepare-public-release-tests');

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

function installPrepareScriptFixture(repoDir) {
  writeFile(repoDir, path.join('scripts', 'prepare-public-release.sh'), fs.readFileSync(SCRIPT_SOURCE_PATH, 'utf8'));
  writeFile(
    repoDir,
    path.join('scripts', 'lib', 'public-release-strip-patterns.sh'),
    fs.readFileSync(HELPER_SOURCE_PATH, 'utf8'),
  );
}

function runPrepareScript(repoDir, outputDir) {
  return spawnSync('bash', [path.join(repoDir, 'scripts', 'prepare-public-release.sh'), '--force', outputDir], {
    cwd: repoDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      TMPDIR: TEST_TMP_ROOT,
    },
  });
}

function setupRepo() {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(TEST_TMP_ROOT, 'ce-prepare-public-release-'));
  const repoDir = path.join(tempRoot, 'repo');
  fs.mkdirSync(repoDir, { recursive: true });

  try {
    git(repoDir, ['init', '--quiet', '--initial-branch=main']);
    git(repoDir, ['config', 'user.name', 'Private Dev']);
    git(repoDir, ['config', 'user.email', 'private@example.com']);

    installPrepareScriptFixture(repoDir);

    writeFile(repoDir, 'README.md', 'public file\n');
    writeFile(repoDir, path.join('TODO', 'secret.md'), 'private planning\n');
    writeFile(repoDir, 'private-pack.manifest.json', 'tracked-stale-manifest\n');
    writeFile(repoDir, path.join('contextEngine-cc', 'public', 'sw.js'), 'service worker\n');
    writeFile(repoDir, path.join('test', 'contextEngineCc.sw-cache-policy.test.mjs'), 'ce-cc sw policy\n');
    writeFile(repoDir, path.join('.tmp-review', 'legacy.js'), 'temporary review copy\n');

    git(repoDir, ['add', '-A']);
    git(repoDir, ['commit', '--quiet', '-m', 'Fixture commit']);

    writeFile(repoDir, path.join('docs', 'ai-agent-bootstrap.md'), 'untracked scratch doc\n');

    return { tempRoot, repoDir };
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

function withRepo(run) {
  const repo = setupRepo();
  try {
    return run(repo);
  } finally {
    fs.rmSync(repo.tempRoot, { recursive: true, force: true });
  }
}

test('prepare-public-release strips configured private paths and ignores untracked files', () => {
  withRepo(({ tempRoot, repoDir }) => {
    const outputDir = path.join(tempRoot, 'public-output');
    const result = runPrepareScript(repoDir, outputDir);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /files stripped, output at/);

    assert.equal(fs.existsSync(path.join(outputDir, 'README.md')), true);
    assert.equal(fs.existsSync(path.join(outputDir, 'TODO')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'contextEngine-cc')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'test', 'contextEngineCc.sw-cache-policy.test.mjs')), false);
    assert.equal(fs.existsSync(path.join(outputDir, '.tmp-review')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'docs', 'ai-agent-bootstrap.md')), false);

    const manifestPath = path.join(outputDir, 'private-pack.manifest.json');
    assert.equal(fs.existsSync(manifestPath), true);

    const manifestText = fs.readFileSync(manifestPath, 'utf8');
    assert.doesNotMatch(manifestText, /tracked-stale-manifest/);

    const manifest = JSON.parse(manifestText);
    const manifestSummary = JSON.stringify(manifest);
    assert.match(manifestSummary, /TODO\/secret\.md/);
    assert.match(manifestSummary, /contextEngine-cc\/public\/sw\.js/);
    assert.match(manifestSummary, /test\/contextEngineCc\.sw-cache-policy\.test\.mjs/);
    assert.match(manifestSummary, /\.tmp-review\/legacy\.js/);
    assert.match(manifestSummary, /private-pack\.manifest\.json/);
    assert.doesNotMatch(manifestSummary, /docs\/ai-agent-bootstrap\.md/);
  });
});
