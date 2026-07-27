'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const WRAPPER_SOURCE_PATH = path.join(__dirname, 'verify-prepared-public-text.sh');

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function withFixture(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-prepared-public-text-'));
  try {
    return run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

function installFixtureScripts(rootDir) {
  writeFile(
    rootDir,
    'scripts/verify-prepared-public-text.sh',
    fs.readFileSync(WRAPPER_SOURCE_PATH, 'utf8'),
  );
  writeFile(rootDir, 'scripts/prepare-public-release.sh', [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'test "$1" = "--force"',
    'mkdir -p "$2"',
    'printf "prepared\\n" > "$2/sentinel.txt"',
    'printf "public text verification passed (1 text file scanned)\\n" >&2',
    'if [ "${CE_TEST_PREPARE_FAILURE:-0}" = "1" ]; then exit 7; fi',
    '',
  ].join('\n'));
}

function runWrapper(rootDir, extraEnv = {}) {
  const tempDir = path.join(rootDir, 'tmp');
  fs.mkdirSync(tempDir, { recursive: true });
  const result = spawnSync('bash', [path.join(rootDir, 'scripts/verify-prepared-public-text.sh')], {
    cwd: rootDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      TMPDIR: tempDir,
      ...extraEnv,
    },
  });
  return { result, tempDir };
}

test('prepared public-text wrapper delegates once and removes its temporary artifact', () => {
  withFixture((rootDir) => {
    installFixtureScripts(rootDir);

    const { result, tempDir } = runWrapper(rootDir);

    assert.equal(result.status, 0, result.stderr);
    assert.equal((result.stderr.match(/public text verification passed/g) || []).length, 1);
    assert.deepEqual(fs.readdirSync(tempDir), []);
  });
});

test('prepared public-text wrapper propagates preparation failure and still cleans up', () => {
  withFixture((rootDir) => {
    installFixtureScripts(rootDir);

    const { result, tempDir } = runWrapper(rootDir, { CE_TEST_PREPARE_FAILURE: '1' });

    assert.equal(result.status, 7);
    assert.deepEqual(fs.readdirSync(tempDir), []);
  });
});
