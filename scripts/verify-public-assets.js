'use strict';

const fs = require('node:fs');
const path = require('node:path');

const IMAGE_RE = /\.(?:png|jpe?g|gif|webp|svg|ico|avif)$/i;
const SKIP_DIRS = new Set([
  '.git',
  '.claude',
  '.codex',
  '.codex-artifacts',
  '.codex-solc',
  '.codex-tmp',
  '.e2e-cache',
  '.keys',
  '.tmp',
  '.tmp-build-audit',
  '.tmp-review',
  'TODO',
  'artifacts',
  'broadcast',
  'cache',
  'node_modules',
  'build',
  'dist',
  'coverage',
  'out',
  'output',
  'release-public',
  'contextEngine-cc',
  'local-private-version',
  'video-clickthrough-local',
]);

function normalizePath(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function walkFiles(rootDir) {
  const files = [];
  const walk = (absoluteDir) => {
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolutePath = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  };
  walk(rootDir);
  return files.sort();
}

function isTextFile(absolutePath) {
  const stat = fs.statSync(absolutePath);
  if (stat.size > 12 * 1024 * 1024) return false;
  const sample = fs.readFileSync(absolutePath).subarray(0, 4096);
  return !sample.includes(0);
}

function findUnreferencedAssetNames(files, images) {
  const unreferencedNames = new Set(images.map((absolutePath) => path.basename(absolutePath)));
  for (const absolutePath of files) {
    if (unreferencedNames.size === 0) break;
    if (IMAGE_RE.test(absolutePath) || !isTextFile(absolutePath)) continue;
    const contents = fs.readFileSync(absolutePath, 'utf8');
    for (const assetName of unreferencedNames) {
      if (contents.includes(assetName)) unreferencedNames.delete(assetName);
    }
  }
  return unreferencedNames;
}

function verifyPublicAssets(rootDir = path.resolve(__dirname, '..')) {
  const absoluteRoot = path.resolve(rootDir);
  const files = walkFiles(absoluteRoot);
  const images = files.filter((absolutePath) => IMAGE_RE.test(absolutePath));
  const unreferencedNames = findUnreferencedAssetNames(files, images);

  // Regression guard: dynamic public assets still need a literal manifest entry.
  // Without one, an unreferenced binary silently bloats every release artifact.
  const findings = images
    .filter((absolutePath) => unreferencedNames.has(path.basename(absolutePath)))
    .map((absolutePath) => ({
      file: normalizePath(path.relative(absoluteRoot, absolutePath)),
      kind: 'unreferenced public asset',
    }));

  return { findings, scannedFiles: images.length };
}

function formatFindings(findings) {
  return findings.map((finding) => `${finding.file} ${finding.kind}`).join('\n');
}

function main(argv = process.argv.slice(2)) {
  const rootDir = argv[0] ? path.resolve(argv[0]) : path.resolve(__dirname, '..');
  const { findings, scannedFiles } = verifyPublicAssets(rootDir);

  if (findings.length > 0) {
    console.error('Public asset verification failed:');
    console.error(formatFindings(findings));
    return 2;
  }

  console.log(`public asset verification passed (${scannedFiles} image files scanned)`);
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = {
  formatFindings,
  verifyPublicAssets,
};
