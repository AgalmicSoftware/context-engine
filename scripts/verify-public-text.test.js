'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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
