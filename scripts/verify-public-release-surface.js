'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SOURCE_FILE_RE = /\.(?:cjs|mjs|js|jsx|ts|tsx|cts|mts)$/;
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const SPECIFIER_PATTERNS = Object.freeze([
  { kind: 'from', re: /\bfrom\s*['"]([^'"]+)['"]/g },
  { kind: 'side-effect import', re: /\bimport\s*['"]([^'"]+)['"]/g },
  { kind: 'dynamic import', re: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g },
  { kind: 'require', re: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g },
]);

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function normalizePublicPath(relativePath) {
  return toPosix(relativePath).replace(/^\.\//, '').replace(/\/+/g, '/');
}

function hasGlobMagic(pattern) {
  return /[*?[]/.test(pattern);
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(pattern) {
  let source = '';
  for (const char of pattern) {
    if (char === '*') {
      source += '.*';
    } else if (char === '?') {
      source += '.';
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(`^${source}$`);
}

function loadStripPatterns(rootDir) {
  const helperPath = path.join(rootDir, 'scripts', 'lib', 'public-release-strip-patterns.sh');
  if (!fs.existsSync(helperPath)) {
    throw new Error(`missing public release strip-pattern helper: ${helperPath}`);
  }

  const output = execFileSync(
    'bash',
    ['-c', 'source "$1"; ce_public_release_strip_patterns', 'bash', helperPath],
    { cwd: rootDir, encoding: 'utf8' },
  );

  return output.split('\n')
    .map((line) => normalizePublicPath(line.trim()))
    .filter(Boolean);
}

function createStripMatcher(patterns) {
  const compiled = patterns.map((pattern) => ({
    pattern,
    hasMagic: hasGlobMagic(pattern),
    regexp: hasGlobMagic(pattern) ? globToRegExp(pattern) : null,
  }));

  return (relativePath) => {
    const normalized = normalizePublicPath(relativePath);
    return compiled.find((entry) => (
      entry.hasMagic
        ? entry.regexp.test(normalized)
        : normalized === entry.pattern || normalized.startsWith(`${entry.pattern}/`)
    )) || null;
  };
}

function isVanishedPathError(error) {
  return !!error && typeof error === 'object' && error.code === 'ENOENT';
}

function collectSourceFiles(rootDir, isStrippedPath) {
  const files = [];

  const walk = (absoluteDir) => {
    let entries;
    try {
      entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    } catch (error) {
      if (absoluteDir !== rootDir && isVanishedPathError(error)) return;
      throw error;
    }
    for (const entry of entries) {
      const absolutePath = path.join(absoluteDir, entry.name);
      const relativePath = normalizePublicPath(path.relative(rootDir, absolutePath));
      if (!relativePath || relativePath.startsWith('..')) continue;

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || isStrippedPath(relativePath)) continue;
        walk(absolutePath);
        continue;
      }

      if (!entry.isFile() || !SOURCE_FILE_RE.test(entry.name)) continue;
      if (isStrippedPath(relativePath)) continue;
      files.push(relativePath);
    }
  };

  walk(rootDir);
  return files.sort();
}

function lineForOffset(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function resolveRepoSpecifier(rootDir, importerRelativePath, specifier) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null;

  const importerDir = path.dirname(path.join(rootDir, importerRelativePath));
  const absoluteTarget = specifier.startsWith('/')
    ? path.resolve(rootDir, `.${specifier}`)
    : path.resolve(importerDir, specifier);
  const relativeTarget = path.relative(rootDir, absoluteTarget);
  if (!relativeTarget || relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    return null;
  }
  return normalizePublicPath(relativeTarget);
}

function scanFileForStrippedImports(rootDir, relativePath, isStrippedPath) {
  const absolutePath = path.join(rootDir, relativePath);
  let text;
  try {
    text = fs.readFileSync(absolutePath, 'utf8');
  } catch (error) {
    if (isVanishedPathError(error)) return null;
    throw error;
  }
  const findings = [];

  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.re.lastIndex = 0;
    let match;
    while ((match = pattern.re.exec(text)) !== null) {
      const specifier = match[1];
      const targetPath = resolveRepoSpecifier(rootDir, relativePath, specifier);
      if (!targetPath) continue;
      const strippedMatch = isStrippedPath(targetPath);
      if (!strippedMatch) continue;

      findings.push({
        file: relativePath,
        line: lineForOffset(text, match.index),
        kind: pattern.kind,
        specifier,
        targetPath,
        pattern: strippedMatch.pattern,
      });
    }
  }

  return findings;
}

function verifyPublicReleaseSurface(rootDir = path.resolve(__dirname, '..'), options = {}) {
  const absoluteRoot = path.resolve(rootDir);
  const stripPatterns = options.stripPatterns || loadStripPatterns(absoluteRoot);
  const isStrippedPath = createStripMatcher(stripPatterns);
  const sourceFiles = collectSourceFiles(absoluteRoot, isStrippedPath);
  const findings = [];
  let scannedFiles = 0;

  for (const relativePath of sourceFiles) {
    const fileFindings = scanFileForStrippedImports(absoluteRoot, relativePath, isStrippedPath);
    if (fileFindings === null) continue;
    scannedFiles += 1;
    findings.push(...fileFindings);
  }

  return { findings, scannedFiles };
}

function formatFindings(findings) {
  return findings.map((finding) => (
    `${finding.file}:${finding.line} imports stripped path "${finding.specifier}" `
    + `-> ${finding.targetPath} (matched ${finding.pattern})`
  )).join('\n');
}

function main(argv = process.argv.slice(2)) {
  const rootDir = argv[0] ? path.resolve(argv[0]) : path.resolve(__dirname, '..');
  const { findings, scannedFiles } = verifyPublicReleaseSurface(rootDir);

  if (findings.length > 0) {
    console.error('Public release surface verification failed; public files import stripped paths:');
    console.error(formatFindings(findings));
    return 2;
  }

  console.log(`public release surface verification passed (${scannedFiles} files scanned)`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  createStripMatcher,
  formatFindings,
  loadStripPatterns,
  verifyPublicReleaseSurface,
};
