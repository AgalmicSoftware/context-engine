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

test('verify-public-release-pii passes clean text while warning on public values', () => {
  withFixture((rootDir) => {
    const corpusContact = `public-contact${'@'}example.org`;
    const packageMaintainer = `maintainer${'@'}example.org`;
    const securityContact = `contextengine${'@'}protonmail.com`;

    writeFile(rootDir, 'README.md', [
      '# Fixture',
      'Published contract: 0x1111111111111111111111111111111111111111',
      'API_TOKEN=REPLACE_WITH_PUBLIC_TOKEN',
      'const AgentTokenPanel = ({ agentTokenStatus }) => agentTokenStatus;',
      'const tokenType = "session_jwt";',
      '',
    ].join('\n'));
    writeFile(rootDir, 'ai-discourse-corpus/corpuses/public-corpus.json', [
      '{',
      `  "contact": "${corpusContact}"`,
      '}',
      '',
    ].join('\n'));
    writeFile(rootDir, 'client/package-lock.json', [
      '{',
      '  "packages": {',
      '    "node_modules/public-package": {',
      `      "author": "Package Maintainer <${packageMaintainer}>"`,
      '    }',
      '  }',
      '}',
      '',
    ].join('\n'));
    writeFile(rootDir, 'SECURITY.md', [
      '# Security Policy',
      `1. **Email:** \`${securityContact}\``,
      `Mixed-case mention: ContextEngine${'@'}Protonmail.COM`,
      '',
    ].join('\n'));

    const result = runScanner(rootDir);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /public release PII scan passed/);
    assert.match(result.stderr, /WARN bare-0x/);
    assert.match(result.stderr, /WARN public-email: ai-discourse-corpus\/corpuses\/public-corpus\.json:2/);
    assert.match(result.stderr, /WARN public-email: client\/package-lock\.json:4/);
    assert.match(result.stderr, /WARN public-email: SECURITY\.md:2/);
    assert.match(result.stderr, /WARN public-email: SECURITY\.md:3/);
  });
});

test('verify-public-release-pii fails emails, home paths, secrets, PEMs, and private keys', () => {
  withFixture((rootDir) => {
    const email = `owner${'@'}example.test`;
    const homePath = `/${'Us'}ers/alice/project/context-engine`;
    const privateKeyPemHeader = `-----BEGIN ${'PRIVATE KEY'}-----`;
    const privateKeyHex = `0x${'abcdef'.repeat(10)}abcd`;

    writeFile(rootDir, 'docs/leak.md', [
      `Contact ${email}`,
      `Local path: ${homePath}`,
      'SECRET_TOKEN=super-secret-value-12345',
      privateKeyPemHeader,
      `privateKey: "${privateKeyHex}"`,
      `Near-miss of the allowlisted contact: contextengine+tag${'@'}protonmail.com`,
      '',
    ].join('\n'));

    const result = runScanner(rootDir);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /FAIL email: docs\/leak\.md:1/);
    assert.match(result.stderr, /FAIL email: docs\/leak\.md:6/);
    assert.match(result.stderr, /FAIL home-path: docs\/leak\.md:2/);
    assert.match(result.stderr, /FAIL secret-assignment: docs\/leak\.md:3/);
    assert.match(result.stderr, /FAIL pem-private-key: docs\/leak\.md:4/);
    assert.match(result.stderr, /FAIL hex-private-key: docs\/leak\.md:5/);
  });
});
