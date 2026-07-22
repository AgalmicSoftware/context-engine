'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const guardScript = path.join(repoRoot, 'scripts', 'check-managed-cache-localstorage.sh');

function writeFile(rootDir, relativePath, content) {
  const target = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function withFixtureRepo(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-cache-guard-'));
  try {
    writeFile(
      tempDir,
      'scripts/check-managed-cache-localstorage.sh',
      fs.readFileSync(guardScript, 'utf8')
    );
    return run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runCacheGuard(rootDir) {
  return spawnSync('bash', ['scripts/check-managed-cache-localstorage.sh'], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

test('cache guard accepts component-scoped managed DG guard helpers', () => {
  withFixtureRepo((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/SBTs/SBTsList.tsx',
      [
        "const isSbtListManagedDgCacheName = (name) => name === 'sbtCache';",
        'const readBooleanFlag = (flagName, normalizedSlug) => {',
        '  if (isSbtListManagedDgCacheName(flagName)) return false;',
        '  const key = `dg:${flagName}:${normalizedSlug}`;',
        '  return localStorage.getItem(key) === "true";',
        '};',
      ].join('\n')
    );

    const result = runCacheGuard(rootDir);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /cache-guard: passed/);
  });
});

test('cache guard rejects dynamic DG localStorage access without a managed guard', () => {
  withFixtureRepo((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/SBTs/SBTsList.tsx',
      [
        'const readBooleanFlag = (flagName, normalizedSlug) => {',
        '  const key = `dg:${flagName}:${normalizedSlug}`;',
        '  return localStorage.getItem(key) === "true";',
        '};',
      ].join('\n')
    );

    const result = runCacheGuard(rootDir);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /dynamic dg:\* localStorage usage without managed namespace guard/);
  });
});

test('cache guard rejects bracket-form managed cache access', () => {
  withFixtureRepo((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/SurveyTool/SurveyTool.tsx',
      [
        "const cached = localStorage['getItem']('dg:questionsCache:general');",
        'void cached;',
      ].join('\n')
    );

    const result = runCacheGuard(rootDir);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /dg:questionsCache:general/);
  });
});

test('cache guard rejects optional bracket-form dynamic DG access without a guard', () => {
  withFixtureRepo((rootDir) => {
    writeFile(
      rootDir,
      'client/src/components/SurveyTool/SurveyTool.tsx',
      [
        'const key = `dg:${cacheName}:${sessionSlug}`;',
        'const cached = localStorage?.["getItem"](key);',
        'void cached;',
      ].join('\n')
    );

    const result = runCacheGuard(rootDir);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /dynamic dg:\* localStorage usage without managed namespace guard/);
  });
});

test('cache guard no longer exempts the obsolete root utilities cache path', () => {
  withFixtureRepo((rootDir) => {
    writeFile(
      rootDir,
      'client/src/utilities/cacheScripts.js',
      "localStorage.setItem('bookmarksCache', 'unsafe');\n"
    );

    const result = runCacheGuard(rootDir);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /bookmarksCache/);
  });
});
