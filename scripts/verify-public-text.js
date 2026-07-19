'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createStripMatcher, loadStripPatterns } = require('./verify-public-release-surface');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'build', 'dist', 'coverage']);
const EXEMPT_PATHS = new Set([
  '.gitignore',
  'scripts/install-private-branch-guard.sh',
  'scripts/install-private-branch-guard.test.js',
  'scripts/lib/public-release-strip-patterns.sh',
  'scripts/pre-push-guard.test.js',
  'scripts/prepare-public-release.sh',
  'scripts/prepare-public-release.test.js',
  'scripts/scrub-public-package-json.js',
  'scripts/scrub-public-package-json.test.js',
  'scripts/sync-public-history.sh',
  'scripts/sync-public-history.test.js',
  'scripts/verify-public-assets.js',
  'scripts/verify-public-assets.test.js',
  'scripts/verify-public-docs.js',
  'scripts/verify-public-docs.test.js',
  'scripts/verify-public-release-surface.test.js',
  'scripts/verify-public-text.js',
  'scripts/verify-public-text.test.js',
  'scripts/verify-test-inventory.test.js',
]);
const FORBIDDEN_MARKERS = Object.freeze([
  { label: 'internal planning identifier', re: /\bPRDs?(?:\s*(?:[#:_-]\s*)?\d+|\d+)\b/gi },
  { label: 'private planning path', re: /(?:^|[^\w])TODO\//gi },
  { label: 'private agent settings path', re: /(?:^|[^\w.-])\.(?:claude|codex)(?:\/|\b)|\bCLAUDE\.md\b/gi },
  { label: 'private companion path', re: /\bcontextEngine-cc(?:\/|\b)/gi },
  { label: 'private skill path', re: /\bclient\/public\/skill\.md\b/gi },
  { label: 'private inventory manifest', re: /\bprivate-pack\.manifest\.json\b/gi },
]);

function normalizePath(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function isProbablyBinary(buffer) {
  if (buffer.includes(0)) return true;
  const sampleLength = Math.min(buffer.length, 4096);
  let controlBytes = 0;
  for (let index = 0; index < sampleLength; index += 1) {
    const byte = buffer[index];
    if (byte < 8 || (byte > 13 && byte < 32)) controlBytes += 1;
  }
  return controlBytes > Math.max(8, sampleLength * 0.02);
}

function collectTextFiles(rootDir, isStrippedPath) {
  const files = [];
  const walk = (absoluteDir) => {
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolutePath = path.join(absoluteDir, entry.name);
      const relativePath = normalizePath(path.relative(rootDir, absolutePath));
      if (isStrippedPath(relativePath)) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (EXEMPT_PATHS.has(relativePath)) continue;
      const buffer = fs.readFileSync(absolutePath);
      if (!isProbablyBinary(buffer)) files.push({ absolutePath, relativePath, text: buffer.toString('utf8') });
    }
  };
  walk(rootDir);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function verifyPublicText(rootDir = path.resolve(__dirname, '..')) {
  const absoluteRoot = path.resolve(rootDir);
  const stripHelper = path.join(absoluteRoot, 'scripts', 'lib', 'public-release-strip-patterns.sh');
  const isStrippedPath = fs.existsSync(stripHelper)
    ? createStripMatcher(loadStripPatterns(absoluteRoot))
    : () => false;
  const textFiles = collectTextFiles(absoluteRoot, isStrippedPath);
  const findings = [];

  for (const file of textFiles) {
    for (const marker of FORBIDDEN_MARKERS) {
      marker.re.lastIndex = 0;
      let match;
      while ((match = marker.re.exec(file.text)) !== null) {
        findings.push({
          file: file.relativePath,
          line: lineForOffset(file.text, match.index),
          kind: marker.label,
          detail: match[0].trim(),
        });
      }
    }
  }

  return { findings, scannedFiles: textFiles.length };
}

function formatFindings(findings) {
  return findings.map((finding) => (
    `${finding.file}:${finding.line} ${finding.kind}: ${finding.detail}`
  )).join('\n');
}

function main(argv = process.argv.slice(2)) {
  const rootDir = argv[0] ? path.resolve(argv[0]) : path.resolve(__dirname, '..');
  const { findings, scannedFiles } = verifyPublicText(rootDir);

  if (findings.length > 0) {
    console.error('Public text verification failed:');
    console.error(formatFindings(findings));
    return 2;
  }

  console.log(`public text verification passed (${scannedFiles} text files scanned)`);
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = {
  formatFindings,
  verifyPublicText,
};
