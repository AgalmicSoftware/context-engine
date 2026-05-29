'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.join(__dirname, 'check-text-hygiene.mjs');

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function withTempGitRepo(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-text-hygiene-'));
  try {
    execFileSync('git', ['init'], { cwd: rootDir, stdio: 'ignore' });
    return run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

function runHygieneCheck(rootDir) {
  return spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

test('check-text-hygiene warns but exits zero for trailing whitespace', () => {
  withTempGitRepo((rootDir) => {
    writeFile(rootDir, 'README.md', 'line with spaces   \n');
    execFileSync('git', ['add', 'README.md'], { cwd: rootDir, stdio: 'ignore' });

    const result = runHygieneCheck(rootDir);

    assert.equal(result.status, 0);
    assert.match(result.stderr, /Text hygiene warnings:/);
    assert.match(result.stderr, /README\.md:1: trailing whitespace/);
    assert.match(result.stdout, /passed with warnings/i);
  });
});

test('check-text-hygiene still fails for non-whitespace filename issues', () => {
  withTempGitRepo((rootDir) => {
    writeFile(rootDir, 'naive-cafe-café.md', 'ok\n');
    execFileSync('git', ['add', 'naive-cafe-café.md'], { cwd: rootDir, stdio: 'ignore' });

    const result = runHygieneCheck(rootDir);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Text hygiene check failed:/);
    assert.match(result.stderr, /filename contains non-ASCII characters/);
  });
});

test('check-text-hygiene skips tracked files that are currently missing from the worktree', () => {
  withTempGitRepo((rootDir) => {
    const relativePath = 'docs/deleted-during-refactor.md';
    writeFile(rootDir, relativePath, 'ok\n');
    execFileSync('git', ['add', relativePath], { cwd: rootDir, stdio: 'ignore' });
    fs.rmSync(path.join(rootDir, relativePath));

    const result = runHygieneCheck(rootDir);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stderr, /ENOENT|deleted-during-refactor/);
    assert.match(result.stdout, /Text hygiene check passed/i);
  });
});

test('check-text-hygiene skips deleted tracked files before filename validation', () => {
  withTempGitRepo((rootDir) => {
    const relativePath = 'docs/naive-cafe-café.md';
    writeFile(rootDir, relativePath, 'ok\n');
    execFileSync('git', ['add', relativePath], { cwd: rootDir, stdio: 'ignore' });
    fs.rmSync(path.join(rootDir, relativePath));

    const result = runHygieneCheck(rootDir);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stderr, /non-ASCII|NFC-normalized|naive-cafe-café/);
    assert.match(result.stdout, /Text hygiene check passed/i);
  });
});

test('check-text-hygiene fails tracked CHANGELOG.md entries with singular planning identifiers', () => {
  withTempGitRepo((rootDir) => {
    const planningId = `${'PR'}${'D'} 123`;
    writeFile(rootDir, 'CHANGELOG.md', `# Changelog\n\n- ${planningId}: internal note\n`);
    execFileSync('git', ['add', 'CHANGELOG.md'], { cwd: rootDir, stdio: 'ignore' });

    const result = runHygieneCheck(rootDir);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Text hygiene check failed:/);
    assert.match(
      result.stderr,
      new RegExp(`CHANGELOG\\.md:3: changelog must not reference internal planning identifier "${planningId}"`)
    );
  });
});

test('check-text-hygiene fails tracked CHANGELOG.md entries with plural planning ranges', () => {
  withTempGitRepo((rootDir) => {
    const planningRange = `${'PR'}${'D'}s 277-280`;
    writeFile(rootDir, 'CHANGELOG.md', `# Changelog\n\n- Covers ${planningRange} in one release note.\n`);
    execFileSync('git', ['add', 'CHANGELOG.md'], { cwd: rootDir, stdio: 'ignore' });

    const result = runHygieneCheck(rootDir);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Text hygiene check failed:/);
    assert.match(
      result.stderr,
      new RegExp(`CHANGELOG\\.md:3: changelog must not reference internal planning identifier "${planningRange}"`)
    );
  });
});

test('check-text-hygiene passes clean tracked CHANGELOG.md entries', () => {
  withTempGitRepo((rootDir) => {
    writeFile(rootDir, 'CHANGELOG.md', '# Changelog\n\n- Pinned TypeScript to match strict peer requirements.\n');
    execFileSync('git', ['add', 'CHANGELOG.md'], { cwd: rootDir, stdio: 'ignore' });

    const result = runHygieneCheck(rootDir);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stderr, /changelog must not reference internal planning identifier/);
    assert.match(result.stdout, /Text hygiene check passed/i);
  });
});

test('check-text-hygiene ignores planning identifiers outside tracked changelog files', () => {
  withTempGitRepo((rootDir) => {
    const planningId = `${'PR'}${'D'} 123`;
    writeFile(rootDir, 'docs/notes.md', `Reminder: ${planningId} stays in planning docs.\n`);
    execFileSync('git', ['add', 'docs/notes.md'], { cwd: rootDir, stdio: 'ignore' });

    const result = runHygieneCheck(rootDir);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stderr, /changelog must not reference internal planning identifier/);
    assert.match(result.stdout, /Text hygiene check passed/i);
  });
});
