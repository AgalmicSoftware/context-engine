#!/usr/bin/env bash
set -euo pipefail

node - "$@" <<'NODE'
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const gitRangeMode = args[0] === '--git-range';
if ((gitRangeMode && args.length !== 4) || (!gitRangeMode && args.length > 1)) {
  console.error('usage: verify-public-release-pii.sh [directory]');
  console.error('   or: verify-public-release-pii.sh --git-range <repo> <base> <candidate>');
  process.exit(2);
}
const targetDir = path.resolve(gitRangeMode ? args[1] : (args[0] || 'release-public'));
const skipDirs = new Set([
  '.git',
  'node_modules',
  'build',
  'dist',
  'coverage',
  '.cache',
  '.npm-cache',
]);
const knownFixturePrivateKeys = new Set([
  '59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5',
  '8b3a350cf5c34c9194ca3a545d3f6f9f4c7e2d36505f8b0e62be5285bdcf0582',
  '8b3a350cf5c34c9194ca3a545d6915c19f9b8b35c50a6481d948e57808b43711',
  '59c6995e998f97a5a0044976f4d4d4f498a8e09d5405cb918f0a95c31a01d10b',
  '8b3a350cf5c34c9194ca85829f4140c8828f4f53f7e55b6d7a5a1f9d0b5b8f37',
  '1234567890123456789012345678901234567890123456789012345678901234',
]);
const allowedGeneratedWorkerEmails = new Set([
  ['0bje', 'bm.bwayc'].join('@'),
  ['rfe', 'rm.rs'].join('@'),
  ['me', 'ricmoo.com'].join('@'),
]);

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function isProbablyBinary(buffer) {
  if (buffer.includes(0)) return true;
  const sampleLength = Math.min(buffer.length, 4096);
  if (sampleLength === 0) return false;

  let controlBytes = 0;
  for (let index = 0; index < sampleLength; index += 1) {
    const byte = buffer[index];
    if ((byte < 8) || (byte > 13 && byte < 32)) controlBytes += 1;
  }
  return controlBytes > Math.max(8, sampleLength * 0.02);
}

function walkFiles(rootDir) {
  const files = [];

  function walk(absoluteDir) {
    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(absolutePath);
        continue;
      }
      if (entry.isFile() || entry.isSymbolicLink()) files.push(absolutePath);
    }
  }

  walk(rootDir);
  return files.sort();
}

function isSafePlaceholder(value) {
  const normalized = String(value).toLowerCase();
  return normalized.includes('replace')
    || normalized.includes('placeholder')
    || normalized.includes('example')
    || normalized.includes('dummy')
    || normalized.includes('changeme')
    || normalized.includes('redacted')
    || normalized.includes('fixture')
    || normalized.includes('abcdefghijklmnopqrstuvwxyz')
    || normalized.includes('test')
    || normalized.includes('mock')
    || normalized === 'session_jwt'
    || normalized === 'jwt-token'
    || normalized.includes('localhost')
    || normalized.includes('127.0.0.1')
    || normalized.includes('${')
    || normalized.startsWith('<')
    || normalized.startsWith('your_');
}

function isRepeatedHex(hex) {
  return /^([a-f0-9])\1{63}$/i.test(hex);
}

function isAllowedFixtureHex(hex) {
  const normalized = hex.replace(/^0x/i, '').toLowerCase();
  return knownFixturePrivateKeys.has(normalized) || isRepeatedHex(normalized);
}

function redactSecret(value) {
  const text = String(value);
  if (text.length <= 8) return '<redacted>';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function addFinding(findings, kind, file, line, detail) {
  findings.push({ kind, file, line, detail });
}

function addWarning(warnings, kind, file, line, detail) {
  warnings.push({ kind, file, line, detail });
}

function isAllowedPublicEmailPath(relativePath) {
  return relativePath.endsWith('package-lock.json')
    || relativePath.startsWith('ai-discourse-corpus/corpuses/')
    || relativePath.startsWith('client/src/data/ai-discourse-corpus/');
}

function isAllowedGeneratedWorkerEmail(relativePath, email) {
  return relativePath === 'deploy/cloudflare/session-worker/worker.mjs'
    && allowedGeneratedWorkerEmails.has(email.toLowerCase());
}

// Intentionally public addresses (e.g. the SECURITY.md vulnerability-reporting
// contact). Keep in sync with the allowlist in scripts/prepare-public-release.sh.
const allowedPublicEmailAddresses = new Set([
  'agalmicsoftware@protonmail.com',
  'contextengine@protonmail.com',
]);

function scanTextFile(relativePath, text, findings, warnings) {
  const lines = text.split(/\r?\n/);
  const emailRe = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig;
  const homePathRe = /(?:^|[\s"'(=:{])((?:\/Users|\/home)\/[A-Za-z0-9._-]+(?:\/[^\s"'`<>\\)]*)?)/g;
  const pemRe = /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|RSA PRIVATE KEY|EC PRIVATE KEY|OPENSSH PRIVATE KEY)[A-Z0-9 ]*-----/i;
  const envSecretLineRe = /^\s*(?:export\s+)?([A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|PRIVATEKEY|CREDENTIAL)[A-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s#;]+))\s*(?:#.*)?$/;
  const codeSecretRe = /\b([A-Za-z_$][A-Za-z0-9_$]*(?:apiKey|api_key|secret|token|password|privateKey|private_key|credential)[A-Za-z0-9_$]*)\b\s*[:=]\s*['"]([^'"\n]{12,})['"]/g;
  const privateKeyContextRe = /\b(private[_-]?key|privateKey|new\s+ethers\.Wallet|litPayerPrivateKey|cachedLitKey)\b[^'"\n]{0,120}['"]?(0x)?([a-f0-9]{64})['"]?/ig;
  const bare0xRe = /\b0x[a-fA-F0-9]{40,64}\b/g;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    let match;

    emailRe.lastIndex = 0;
    while ((match = emailRe.exec(line)) !== null) {
      if (
        isAllowedPublicEmailPath(relativePath)
        || isAllowedGeneratedWorkerEmail(relativePath, match[0])
        || allowedPublicEmailAddresses.has(match[0].toLowerCase())
      ) {
        addWarning(warnings, 'public-email', relativePath, lineNumber, match[0]);
      } else {
        addFinding(findings, 'email', relativePath, lineNumber, match[0]);
      }
    }

    homePathRe.lastIndex = 0;
    while ((match = homePathRe.exec(line)) !== null) {
      addFinding(findings, 'home-path', relativePath, lineNumber, match[1]);
    }

    if (pemRe.test(line)) {
      addFinding(findings, 'pem-private-key', relativePath, lineNumber, 'private key PEM block');
    }

    match = envSecretLineRe.exec(line);
    if (match !== null) {
      const [, name, doubleQuotedValue, singleQuotedValue, unquotedValue] = match;
      const value = doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? '';
      if (value.length >= 12 && !isSafePlaceholder(value) && !isAllowedFixtureHex(value)) {
        addFinding(findings, 'secret-assignment', relativePath, lineNumber, `${name}=${redactSecret(value)}`);
      }
    }

    codeSecretRe.lastIndex = 0;
    while ((match = codeSecretRe.exec(line)) !== null) {
      const [, name, value] = match;
      if (isSafePlaceholder(value) || isAllowedFixtureHex(value)) continue;
      addFinding(findings, 'secret-assignment', relativePath, lineNumber, `${name}=${redactSecret(value)}`);
    }

    privateKeyContextRe.lastIndex = 0;
    while ((match = privateKeyContextRe.exec(line)) !== null) {
      const hex = match[3];
      if (isAllowedFixtureHex(hex)) continue;
      addFinding(findings, 'hex-private-key', relativePath, lineNumber, `0x${redactSecret(hex)}`);
    }

    bare0xRe.lastIndex = 0;
    while ((match = bare0xRe.exec(line)) !== null) {
      addWarning(warnings, 'bare-0x', relativePath, lineNumber, match[0]);
    }
  });
}

function scanBuffer(relativePath, buffer, findings, warnings) {
  if (isProbablyBinary(buffer)) return false;
  scanTextFile(relativePath, buffer.toString('utf8'), findings, warnings);
  return true;
}

function gitBuffer(repoDir, gitArgs) {
  return execFileSync('git', gitArgs, {
    cwd: repoDir,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitText(repoDir, gitArgs) {
  return gitBuffer(repoDir, gitArgs).toString('utf8').trim();
}

function resolveCommit(repoDir, ref, label) {
  const commit = gitText(repoDir, ['rev-parse', '--verify', `${ref}^{commit}`]);
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(`${label} did not resolve to a commit`);
  return commit;
}

function scanDirectory(rootDir, findings, warnings) {
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    throw new Error(`scan target is not a directory: ${rootDir}`);
  }

  let scannedFiles = 0;
  for (const absolutePath of walkFiles(rootDir)) {
    const buffer = fs.lstatSync(absolutePath).isSymbolicLink()
      ? Buffer.from(fs.readlinkSync(absolutePath))
      : fs.readFileSync(absolutePath);
    const relativePath = toPosix(path.relative(rootDir, absolutePath));
    if (scanBuffer(relativePath, buffer, findings, warnings)) scannedFiles += 1;
  }
  return scannedFiles;
}

function scanGitRange(repoDir, baseRef, candidateRef, findings, warnings) {
  const baseCommit = resolveCommit(repoDir, baseRef, 'Git range base');
  const candidateCommit = resolveCommit(repoDir, candidateRef, 'Git range candidate');
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', baseCommit, candidateCommit], {
      cwd: repoDir,
      stdio: 'ignore',
    });
  } catch (_) {
    throw new Error('Git range candidate is not descended from its base');
  }

  const commits = gitText(repoDir, ['rev-list', '--reverse', `${baseCommit}..${candidateCommit}`])
    .split(/\s+/)
    .filter(Boolean);
  let scannedFiles = 0;

  for (const commit of commits) {
    const parents = gitText(repoDir, ['rev-list', '--parents', '-n', '1', commit])
      .split(/\s+/)
      .slice(1);
    if (parents.length !== 1) throw new Error(`commit ${commit} is not a linear public replay`);

    const message = gitBuffer(repoDir, ['show', '-s', '--format=%B', commit]);
    if (scanBuffer(`.git-commit-messages/${commit}.txt`, message, findings, warnings)) {
      scannedFiles += 1;
    }

    const changedPaths = gitBuffer(repoDir, [
      'diff-tree',
      '--no-commit-id',
      '--name-only',
      '-r',
      '-z',
      '--no-renames',
      '--diff-filter=ACMRTUXB',
      parents[0],
      commit,
    ]).toString('utf8').split('\0').filter(Boolean);

    for (const relativePath of changedPaths) {
      const objectSpec = `${commit}:${relativePath}`;
      const objectType = gitText(repoDir, ['cat-file', '-t', objectSpec]);
      if (objectType !== 'blob') {
        addFinding(findings, 'unsupported-tree-entry', relativePath, 1, objectType);
        continue;
      }
      const buffer = gitBuffer(repoDir, ['cat-file', 'blob', objectSpec]);
      if (scanBuffer(toPosix(relativePath), buffer, findings, warnings)) scannedFiles += 1;
    }
  }

  return { scannedFiles, baseCommit, candidateCommit };
}

const findings = [];
const warnings = [];
let scanResult;
let scanLabel;
try {
  if (gitRangeMode) {
    scanResult = scanGitRange(targetDir, args[2], args[3], findings, warnings);
    scanLabel = `${scanResult.baseCommit}..${scanResult.candidateCommit}`;
  } else {
    scanResult = { scannedFiles: scanDirectory(targetDir, findings, warnings) };
    scanLabel = targetDir;
  }
} catch (error) {
  console.error(`public release PII scan could not inspect ${targetDir}: ${error.message}`);
  process.exit(2);
}

if (warnings.length > 0) {
  console.error(
    `warning: public release PII scan found ${warnings.length} bare 0x value(s); `
    + 'deployed contract addresses and hashes may be legitimate.',
  );
  warnings.slice(0, 50).forEach((warning) => {
    console.error(`WARN ${warning.kind}: ${warning.file}:${warning.line}: ${warning.detail}`);
  });
  if (warnings.length > 50) {
    console.error(`warning: omitted ${warnings.length - 50} additional bare 0x warning(s)`);
  }
}

if (findings.length > 0) {
  console.error(`public release PII scan failed for ${scanLabel}`);
  findings.slice(0, 100).forEach((finding) => {
    console.error(`FAIL ${finding.kind}: ${finding.file}:${finding.line}: ${finding.detail}`);
  });
  if (findings.length > 100) {
    console.error(`public release PII scan omitted ${findings.length - 100} additional finding(s)`);
  }
  process.exit(1);
}

console.log(
  `public release PII scan passed (${scanResult.scannedFiles} text files scanned, `
  + `${warnings.length} bare 0x warning(s))`,
);
NODE
