'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCANNER_PATH = path.join(__dirname, 'verify-public-release-pii.sh');

function writeFile(rootDir, relativePath, contents) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}

function withFixture(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-public-pii-'));
  try {
    return run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

function runScanner(targetDir) {
  return spawnSync('bash', [SCANNER_PATH, targetDir], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
  });
}

test('verify-public-release-pii passes clean text while warning on public 0x values', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'README.md', [
      '# Fixture',
      'Published contract: 0x1111111111111111111111111111111111111111',
      'API_TOKEN=REPLACE_WITH_PUBLIC_TOKEN',
      '',
    ].join('\n'));

    const result = runScanner(rootDir);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /public release PII scan passed/);
    assert.match(result.stderr, /WARN bare-0x/);
  });
});

test('verify-public-release-pii fails emails, home paths, secrets, PEMs, and private keys', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'docs/leak.md', [
      'Contact owner@example.test',
      'Local path: /Users/alice/project/context-engine',
      'SECRET_TOKEN=super-secret-value-12345',
      '-----BEGIN PRIVATE KEY-----',
      'privateKey: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd"',
      '',
    ].join('\n'));

    const result = runScanner(rootDir);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /FAIL email: docs\/leak\.md:1/);
    assert.match(result.stderr, /FAIL home-path: docs\/leak\.md:2/);
    assert.match(result.stderr, /FAIL secret-assignment: docs\/leak\.md:3/);
    assert.match(result.stderr, /FAIL pem-private-key: docs\/leak\.md:4/);
    assert.match(result.stderr, /FAIL hex-private-key: docs\/leak\.md:5/);
  });
});
