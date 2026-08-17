'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { scrubPublicPackageJson } = require('./scrub-public-package-json');
const { verifyPublicText } = require('./verify-public-text');

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function withFixture(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-public-text-'));
  try {
    return run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('verifyPublicText scans non-Markdown metadata for private references', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'README.md', '# Public\n');
    writeFile(rootDir, 'public-manifest.json', '{"source":"contextEngine-cc/private.mjs"}\n');

    const { findings } = verifyPublicText(rootDir);
    assert.deepEqual(findings.map(({ file, kind }) => ({ file, kind })), [{
      file: 'public-manifest.json',
      kind: 'private companion path',
    }]);
  });
});

test('verifyPublicText permits release guard files to encode forbidden patterns', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'scripts/lib/public-release-strip-patterns.sh', [
      '#!/usr/bin/env bash',
      'ce_public_release_strip_patterns() {',
      "  printf '%s\\n' contextEngine-cc TODO/",
      '}',
      '',
    ].join('\n'));
    writeFile(
      rootDir,
      'scripts/scrub-public-package-json.js',
      "const privateRunner = 'scripts/run-contextengine-cc-tests.js';\n",
    );
    writeFile(
      rootDir,
      'scripts/scrub-public-package-json.test.js',
      "const privateRunner = 'scripts/run-contextengine-cc-tests.js';\n",
    );
    writeFile(rootDir, 'README.md', '# Public\n');

    const result = verifyPublicText(rootDir);
    assert.deepEqual(result.findings, []);
    assert.equal(result.scannedFiles, 1);
  });
});

test('verifyPublicText permits the replay PII guard to encode forbidden patterns', () => {
  withFixture((rootDir) => {
    writeFile(
      rootDir,
      'scripts/verify-public-release-pii.sh',
      "const privateReplayTokens = ['contextEngine-cc', 'TODO/'];\n",
    );
    writeFile(rootDir, 'README.md', '# Public\n');

    const result = verifyPublicText(rootDir);
    assert.deepEqual(result.findings, []);
    assert.equal(result.scannedFiles, 1);
  });
});

test('verifyPublicText does not confuse public domains with local agent settings paths', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'sources.json', '{"url":"https://platform.claude.com/docs"}\n');
    assert.deepEqual(verifyPublicText(rootDir).findings, []);
  });
});

test('verifyPublicText rejects an unsanitized root package.json', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'package.json', `${JSON.stringify({
      name: 'fixture',
      scripts: {
        'test:cc': 'node scripts/run-contextengine-cc-tests.js',
        build: 'node scripts/build.js',
      },
    }, null, 2)}\n`);

    assert.deepEqual(
      verifyPublicText(rootDir).findings.map(({ file, kind }) => ({ file, kind })),
      [{ file: 'package.json', kind: 'private companion path' }],
    );
  });
});

test('verifyPublicText accepts a root package.json physically scrubbed for release', () => {
  withFixture((rootDir) => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    writeFile(rootDir, 'package.json', `${JSON.stringify({
      name: 'fixture',
      scripts: {
        'test:cc': 'node scripts/run-contextengine-cc-tests.js',
        'test:cc:coverage': 'NODE_V8_COVERAGE=coverage node scripts/run-contextengine-cc-tests.js --flag',
        build: 'node scripts/build.js',
      },
    }, null, 2)}\n`);

    scrubPublicPackageJson(packageJsonPath);

    const preparedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    assert.deepEqual(preparedPackageJson.scripts, { build: 'node scripts/build.js' });
    assert.deepEqual(verifyPublicText(rootDir).findings, []);
  });
});

test('verifyPublicText still fails on companion references that survive the package.json scrub', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'package.json', `${JSON.stringify({
      name: 'fixture',
      description: 'mirrors contextEngine-cc runtime helpers',
      scripts: { build: 'node scripts/build.js' },
    }, null, 2)}\n`);
    writeFile(rootDir, 'client/package.json', `${JSON.stringify({
      name: 'client-fixture',
      scripts: { leak: 'node ../scripts/run-contextengine-cc-tests.js' },
    }, null, 2)}\n`);

    const { findings } = verifyPublicText(rootDir);
    assert.deepEqual(findings.map(({ file, kind }) => ({ file, kind })), [
      { file: 'client/package.json', kind: 'private companion path' },
      { file: 'package.json', kind: 'private companion path' },
    ]);
  });
});

test('verifyPublicText matches release export visibility in a git checkout', () => {
  withFixture((rootDir) => {
    execFileSync('git', ['init', '--quiet'], { cwd: rootDir });
    writeFile(rootDir, '.gitignore', '.tmp/\n');
    writeFile(rootDir, 'README.md', '# Public\n');
    writeFile(rootDir, '.tmp/ignored.txt', 'contextEngine-cc/private.mjs\n');
    writeFile(rootDir, 'visible-untracked.json', '{"source":"contextEngine-cc/private.mjs"}\n');

    const { findings } = verifyPublicText(rootDir);

    assert.deepEqual(findings.map(({ file, kind }) => ({ file, kind })), [{
      file: 'visible-untracked.json',
      kind: 'private companion path',
    }]);
  });
});
