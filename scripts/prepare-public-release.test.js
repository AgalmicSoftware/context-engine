'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_SOURCE_PATH = path.join(__dirname, 'prepare-public-release.sh');
const HELPER_SOURCE_PATH = path.join(__dirname, 'lib', 'public-release-strip-patterns.sh');
const TEST_TMP_ROOT = path.join(__dirname, '.tmp-prepare-public-release-tests');

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function runPrepareScript(rootDir, outputDir) {
  return spawnSync('bash', [path.join(rootDir, 'scripts', 'prepare-public-release.sh'), '--force', outputDir], {
    cwd: rootDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      TMPDIR: TEST_TMP_ROOT,
    },
  });
}

test('prepare-public-release strips review artifacts and preserves the generated manifest', () => {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(TEST_TMP_ROOT, 'ce-prepare-public-release-'));
  const sourceDir = path.join(tempRoot, 'source');
  const outputDir = path.join(tempRoot, 'release-public');

  try {
    writeFile(sourceDir, path.join('scripts', 'prepare-public-release.sh'), fs.readFileSync(SCRIPT_SOURCE_PATH, 'utf8'));
    writeFile(
      sourceDir,
      path.join('scripts', 'lib', 'public-release-strip-patterns.sh'),
      fs.readFileSync(HELPER_SOURCE_PATH, 'utf8'),
    );
    fs.chmodSync(path.join(sourceDir, 'scripts', 'prepare-public-release.sh'), 0o755);

    writeFile(sourceDir, 'public.txt', 'keep\n');
    writeFile(sourceDir, path.join('.tmp-review', 'review.js'), 'temporary review snapshot\n');
    writeFile(sourceDir, 'private-pack.manifest.json', 'tracked root manifest that should be replaced\n');
    writeFile(sourceDir, path.join('TODO', 'secret.md'), 'private planning\n');
    writeFile(sourceDir, path.join('contextEngine-cc', 'secret.txt'), 'private companion surface\n');
    writeFile(sourceDir, path.join('docs', 'agent-native-contract.md'), 'private agent contract\n');

    const result = runPrepareScript(sourceDir, outputDir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /files stripped, output at /);

    assert.equal(fs.readFileSync(path.join(outputDir, 'public.txt'), 'utf8'), 'keep\n');
    assert.equal(fs.existsSync(path.join(outputDir, '.tmp-review')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'TODO')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'contextEngine-cc')), false);
    assert.equal(fs.existsSync(path.join(outputDir, 'docs', 'agent-native-contract.md')), false);

    const manifestPath = path.join(outputDir, 'private-pack.manifest.json');
    assert.equal(fs.existsSync(manifestPath), true);

    const manifestText = fs.readFileSync(manifestPath, 'utf8');
    assert.doesNotMatch(manifestText, /tracked root manifest that should be replaced/);
    assert.match(manifestText, /private-pack\.manifest\.json/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
