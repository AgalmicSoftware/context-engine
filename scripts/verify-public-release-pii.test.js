'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

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

function git(rootDir, args) {
  return execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function runGitRangeScanner(rootDir, baseRef, candidateRef) {
  return spawnSync('bash', [SCANNER_PATH, '--git-range', rootDir, baseRef, candidateRef], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
  });
}

test('verify-public-release-pii passes clean text while warning on public values', () => {
  withFixture((rootDir) => {
    const corpusContact = `public-contact${'@'}example.org`;
    const packageMaintainer = `maintainer${'@'}example.org`;
    const publicGitIdentity = `agalmicsoftware${'@'}protonmail.com`;
    const securityContact = `contextengine${'@'}protonmail.com`;
    const bundledVendorContact = `me${'@'}ricmoo.com`;

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
      '  "contact": "[redacted-email]"',
      '}',
      '',
    ].join('\n'));
    writeFile(rootDir, 'client/package-lock.json', [
      '{',
      '  "packages": {',
      '    "node_modules/public-package": {',
      '      "author": "Package Maintainer <[redacted-email]>"',
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
    writeFile(rootDir, 'scripts/public-history.sh', `PUBLIC_GIT_EMAIL="${publicGitIdentity}"\n`);
    writeFile(
      rootDir,
      'deploy/cloudflare/session-worker/worker.mjs',
      `const bundledWordlist = "Rfe${'@'}Rm.Rs"; // ${bundledVendorContact}\n`,
    );

    const result = runScanner(rootDir);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /public release PII scan passed/);
    assert.match(result.stderr, /WARN bare-0x/);
    assert.match(result.stderr, /WARN public-email: ai-discourse-corpus\/corpuses\/public-corpus\.json:2/);
    assert.match(result.stderr, /WARN public-email: client\/package-lock\.json:4/);
    assert.match(result.stderr, /WARN public-email: deploy\/cloudflare\/session-worker\/worker\.mjs:1/);
    assert.match(result.stderr, /WARN public-email: SECURITY\.md:2/);
    assert.match(result.stderr, /WARN public-email: SECURITY\.md:3/);
    assert.match(result.stderr, /WARN public-email: scripts\/public-history\.sh:1/);
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
    writeFile(
      rootDir,
      'deploy/cloudflare/session-worker/worker.mjs',
      `const unexpectedContact = "private-contact${'@'}example.test";\n`,
    );

    const result = runScanner(rootDir);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /FAIL email: docs\/leak\.md:1/);
    assert.match(result.stderr, /FAIL email: docs\/leak\.md:6/);
    assert.match(result.stderr, /FAIL email: deploy\/cloudflare\/session-worker\/worker\.mjs:1/);
    assert.match(result.stderr, /FAIL home-path: docs\/leak\.md:2/);
    assert.match(result.stderr, /FAIL secret-assignment: docs\/leak\.md:3/);
    assert.match(result.stderr, /FAIL pem-private-key: docs\/leak\.md:4/);
    assert.match(result.stderr, /FAIL hex-private-key: docs\/leak\.md:5/);
  });
});

test('verify-public-release-pii scans broken symlink targets', () => {
  withFixture((rootDir) => {
    const linkPath = path.join(rootDir, 'client', 'src', 'unsafe-link');
    const secretAssignment = `${'provider_api'}_${'token'}='${'live-credential'}-material-must-not-ship'`;
    const unsafeTarget = `/${'Us'}ers/example/${secretAssignment}`;
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(unsafeTarget, linkPath);

    const result = runScanner(rootDir);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /FAIL home-path: client\/src\/unsafe-link:1/);
    assert.match(result.stderr, /FAIL secret-assignment: client\/src\/unsafe-link:1/);
  });
});

test('verify-public-release-pii scans transient Git history and commit messages', () => {
  withFixture((rootDir) => {
    git(rootDir, ['init', '--quiet', '-b', 'main']);
    git(rootDir, ['config', 'user.name', 'Agalmic']);
    git(rootDir, ['config', 'user.email', 'agalmicsoftware@protonmail.com']);
    writeFile(rootDir, 'README.md', '# Public fixture\n');
    git(rootDir, ['add', 'README.md']);
    git(rootDir, ['commit', '--quiet', '-m', 'base']);
    const baseCommit = git(rootDir, ['rev-parse', 'HEAD']);

    writeFile(rootDir, 'docs/transient-leak.md', `Contact owner${'@'}example.test\n`);
    const linkPath = path.join(rootDir, 'client', 'src', 'transient-link');
    fs.mkdirSync(path.dirname(linkPath), { recursive: true });
    fs.symlinkSync(`/${'Us'}ers/example/private-release-note`, linkPath);
    git(rootDir, ['add', 'docs/transient-leak.md', 'client/src/transient-link']);
    git(rootDir, [
      'commit',
      '--quiet',
      '-m',
      `temporary note from /${'Us'}ers/example/context-engine`,
    ]);
    git(rootDir, ['rm', '--quiet', 'docs/transient-leak.md', 'client/src/transient-link']);
    git(rootDir, ['commit', '--quiet', '-m', 'remove temporary files']);
    const candidateCommit = git(rootDir, ['rev-parse', 'HEAD']);

    assert.equal(git(rootDir, ['ls-tree', '-r', '--name-only', candidateCommit]), 'README.md');
    const result = runGitRangeScanner(rootDir, baseCommit, candidateCommit);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /FAIL email: docs\/transient-leak\.md:1/);
    assert.match(result.stderr, /FAIL home-path: client\/src\/transient-link:1/);
    assert.match(result.stderr, /FAIL home-path: \.git-commit-messages\/[a-f0-9]{40}\.txt:1/);
  });
});

test('verify-public-release-pii rejects private planning tokens in Git commit messages', () => {
  withFixture((rootDir) => {
    git(rootDir, ['init', '--quiet', '-b', 'main']);
    git(rootDir, ['config', 'user.name', 'Agalmic']);
    git(rootDir, ['config', 'user.email', 'agalmicsoftware@protonmail.com']);
    writeFile(rootDir, 'README.md', '# Public fixture\n');
    git(rootDir, ['add', 'README.md']);
    git(rootDir, ['commit', '--quiet', '-m', 'base']);
    const baseCommit = git(rootDir, ['rev-parse', 'HEAD']);

    const privatePath = path.join(`${'TO'}${'DO'}`, 'private-note.md');
    writeFile(rootDir, 'public-change.txt', 'public change\n');
    writeFile(rootDir, privatePath, 'private planning note\n');
    git(rootDir, ['add', 'public-change.txt', privatePath]);
    const planningId = `${'PR'}${'D'} 123`;
    git(rootDir, ['commit', '--quiet', '-m', `public change\n\nReferences ${planningId}.`]);
    git(rootDir, ['rm', '--quiet', privatePath]);
    git(rootDir, ['commit', '--quiet', '-m', 'remove private planning note']);
    const candidateCommit = git(rootDir, ['rev-parse', 'HEAD']);
    assert.equal(git(rootDir, ['ls-tree', '-r', '--name-only', candidateCommit, '--', privatePath]), '');
    const result = runGitRangeScanner(rootDir, baseCommit, candidateCommit);

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /FAIL private-commit-message: \.git-commit-messages\/[a-f0-9]{40}\.txt:3: internal planning identifier/,
    );
    const privatePathToken = `${'TO'}${'DO'}`;
    assert.match(
      result.stderr,
      new RegExp(`FAIL private-release-path: ${privatePathToken}/private-note\\.md:1: matched ${privatePathToken}`),
    );
  });
});
