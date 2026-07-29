#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-release-public}"

node - "$TARGET_DIR" <<'NODE'
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const targetDir = path.resolve(process.argv[2] || 'release-public');
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
      if (entry.isFile()) files.push(absolutePath);
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

if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
  console.error(`public release PII scan target is not a directory: ${targetDir}`);
  process.exit(2);
}

const findings = [];
const warnings = [];
let scannedFiles = 0;

for (const absolutePath of walkFiles(targetDir)) {
  const buffer = fs.readFileSync(absolutePath);
  if (isProbablyBinary(buffer)) continue;

  const relativePath = toPosix(path.relative(targetDir, absolutePath));
  scanTextFile(relativePath, buffer.toString('utf8'), findings, warnings);
  scannedFiles += 1;
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
  console.error(`public release PII scan failed for ${targetDir}`);
  findings.slice(0, 100).forEach((finding) => {
    console.error(`FAIL ${finding.kind}: ${finding.file}:${finding.line}: ${finding.detail}`);
  });
  if (findings.length > 100) {
    console.error(`public release PII scan omitted ${findings.length - 100} additional finding(s)`);
  }
  process.exit(1);
}

console.log(
  `public release PII scan passed (${scannedFiles} text files scanned, `
  + `${warnings.length} bare 0x warning(s))`,
);
NODE
