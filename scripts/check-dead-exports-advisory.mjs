#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');
export const SOURCE_ROOT = 'client/src';
export const DEAD_EXPORT_BASELINE_PATH = 'scripts/dead-exports-baseline.json';

const SOURCE_FILE_RE = /\.(?:js|jsx|mjs|cjs|ts|tsx)$/;
const DECLARATION_FILE_RE = /\.d\.ts$/;
const TEST_FILE_RE = /\.(?:test|spec)\.(?:js|jsx|mjs|cjs|ts|tsx)$/;
const TEST_UTILITY_FILE_RE =
  /(?:^|[._-])(?:test-?utils?|testing|fixtures?)(?:[._-]|\.)|(?:testFixtures|testUtils|testingUtils)/i;
const SKIP_SEGMENTS = new Set([
  '__fixtures__',
  '__mocks__',
  '__tests__',
  'artifacts',
  'fixtures',
  'test',
  'test-utils',
  'tests',
  'testing',
]);

const ENTRYPOINT_BASENAMES = new Set([
  'index.js',
  'index.jsx',
  'index.ts',
  'index.tsx',
  'setupTests.js',
  'setupTests.ts',
]);

const IMPORT_RE = /\bimport\s+(?:type\s+)?(?:[^'";]+?\s+from\s*)?['"]([^'"]+)['"]/g;
const EXPORT_FROM_RE = /\bexport\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s+from\s*['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const NAMED_EXPORT_DECL_RE = /\bexport\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
const NAMED_EXPORT_LIST_RE = /\bexport\s+(?:type\s+)?\{([\s\S]*?)\}(?!\s+from\s*['"])/g;

const normalizePath = (filePath) => filePath.split(/[\\/]+/).join('/');

function walkFiles(rootDir, relativeDir = SOURCE_ROOT) {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(absoluteDir) || !fs.statSync(absoluteDir).isDirectory()) {
    return [];
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.posix.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(rootDir, relativePath);
      }
      return entry.isFile() ? [relativePath] : [];
    });
}

function isProductionSourceFile(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized.startsWith(`${SOURCE_ROOT}/`)) {
    return false;
  }
  if (!SOURCE_FILE_RE.test(normalized) || DECLARATION_FILE_RE.test(normalized)) {
    return false;
  }
  const basename = path.posix.basename(normalized);
  if (
    TEST_FILE_RE.test(basename)
    || TEST_UTILITY_FILE_RE.test(basename)
    || /^setupTests\.(?:js|jsx|ts|tsx)$/i.test(basename)
  ) {
    return false;
  }
  const segments = normalized.slice(`${SOURCE_ROOT}/`.length).split('/');
  return !segments.some((segment) => SKIP_SEGMENTS.has(segment));
}

function isCandidateFile(filePath) {
  return !ENTRYPOINT_BASENAMES.has(path.posix.basename(filePath));
}

function resolveClientImport(sourceFile, specifier, fileSet) {
  const normalizedSource = normalizePath(sourceFile);
  const normalizedSpecifier = normalizePath(specifier);
  let basePath = null;

  if (normalizedSpecifier.startsWith('.')) {
    basePath = path.posix.normalize(path.posix.join(path.posix.dirname(normalizedSource), normalizedSpecifier));
  } else if (normalizedSpecifier.startsWith(`${SOURCE_ROOT}/`)) {
    basePath = normalizedSpecifier;
  } else if (normalizedSpecifier.startsWith('src/')) {
    basePath = `client/${normalizedSpecifier}`;
  } else if (normalizedSpecifier.startsWith('@/')) {
    basePath = `${SOURCE_ROOT}/${normalizedSpecifier.slice(2)}`;
  } else if (/^(?:assets|components|utilities|variables)(?:\/|$)/.test(normalizedSpecifier)) {
    basePath = `${SOURCE_ROOT}/${normalizedSpecifier}`;
  }

  if (!basePath || !basePath.startsWith(`${SOURCE_ROOT}/`)) {
    return null;
  }

  const explicitExtension = path.posix.extname(basePath);
  const extensionlessBase = SOURCE_FILE_RE.test(explicitExtension)
    ? basePath.slice(0, -explicitExtension.length)
    : basePath;
  const candidates = [
    basePath,
    `${extensionlessBase}.js`,
    `${extensionlessBase}.jsx`,
    `${extensionlessBase}.mjs`,
    `${extensionlessBase}.cjs`,
    `${extensionlessBase}.ts`,
    `${extensionlessBase}.tsx`,
    `${basePath}/index.js`,
    `${basePath}/index.jsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
  ];

  return candidates.find((candidate) => fileSet.has(candidate)) || null;
}

function extractImportSpecifiers(sourceText) {
  const specifiers = [];
  for (const pattern of [IMPORT_RE, EXPORT_FROM_RE, DYNAMIC_IMPORT_RE, REQUIRE_RE]) {
    pattern.lastIndex = 0;
    for (const match of sourceText.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return [...new Set(specifiers)].sort();
}

function parseExportList(listText) {
  return listText
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim())
    .filter((entry) => /^[A-Za-z_$][\w$]*$/.test(entry));
}

function extractNamedExports(sourceText) {
  const exports = new Set();

  for (const match of sourceText.matchAll(NAMED_EXPORT_DECL_RE)) {
    exports.add(match[1]);
  }
  for (const match of sourceText.matchAll(NAMED_EXPORT_LIST_RE)) {
    parseExportList(match[1]).forEach((exportName) => exports.add(exportName));
  }

  return [...exports].sort();
}

function extractIdentifiers(sourceText) {
  const withoutStrings = sourceText.replace(/(['"`])(?:\\.|(?!\1)[\s\S])*\1/g, ' ');
  const identifiers = new Set();
  for (const match of withoutStrings.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
    identifiers.add(match[0]);
  }
  return identifiers;
}

function stripOwnExportNames(sourceText) {
  return sourceText
    .replace(NAMED_EXPORT_DECL_RE, (match, exportName) => match.replace(exportName, ' '))
    .replace(NAMED_EXPORT_LIST_RE, ' ');
}

export function collectDeadExportAdvisory({ rootDir = DEFAULT_ROOT_DIR } = {}) {
  const files = walkFiles(rootDir).filter(isProductionSourceFile).sort();
  const fileSet = new Set(files);
  const importedFiles = new Set();
  const allIdentifiers = new Set();
  const fileExports = [];

  for (const file of files) {
    const sourceText = fs.readFileSync(path.join(rootDir, file), 'utf8');
    extractIdentifiers(stripOwnExportNames(sourceText)).forEach((identifier) => allIdentifiers.add(identifier));
    extractImportSpecifiers(sourceText)
      .map((specifier) => resolveClientImport(file, specifier, fileSet))
      .filter(Boolean)
      .forEach((resolved) => importedFiles.add(resolved));
    fileExports.push({
      file,
      exports: extractNamedExports(sourceText),
    });
  }

  const candidateDeadFiles = fileExports
    .filter(({ file, exports }) => isCandidateFile(file) && exports.length > 0 && !importedFiles.has(file))
    .map(({ file }) => file);
  const candidateUnusedExports = fileExports
    .filter(({ file }) => isCandidateFile(file))
    .flatMap(({ file, exports }) => exports
      .filter((exportName) => !allIdentifiers.has(exportName))
      .map((exportName) => ({ file, exportName })));

  return {
    filesScanned: files.length,
    candidateDeadFiles,
    candidateUnusedExports,
  };
}

export function formatDeadExportAdvisory(result) {
  const lines = [
    `Dead export advisory scanned ${result.filesScanned} production client files.`,
    `Candidate dead files: ${result.candidateDeadFiles.length}.`,
    `Candidate unused named exports: ${result.candidateUnusedExports.length}.`,
  ];

  result.candidateDeadFiles.slice(0, 25).forEach((file) => {
    lines.push(`- dead-file? ${file}`);
  });
  result.candidateUnusedExports.slice(0, 25).forEach(({ file, exportName }) => {
    lines.push(`- unused-export? ${file}#${exportName}`);
  });

  if (result.candidateDeadFiles.length > 25 || result.candidateUnusedExports.length > 25) {
    lines.push('Additional candidates omitted from console output.');
  }

  return lines.join('\n');
}

export function runDeadExportAdvisory({ rootDir = DEFAULT_ROOT_DIR, stdout = console.log } = {}) {
  stdout(formatDeadExportAdvisory(collectDeadExportAdvisory({ rootDir })));
  return 0;
}

function readDeadExportBaseline(rootDir) {
  const baselinePath = path.join(rootDir, DEAD_EXPORT_BASELINE_PATH);
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const candidateDeadFiles = Number(baseline?.candidateDeadFiles);
  const candidateUnusedExports = Number(baseline?.candidateUnusedExports);
  if (!Number.isFinite(candidateDeadFiles) || candidateDeadFiles < 0) {
    throw new Error(`${DEAD_EXPORT_BASELINE_PATH} candidateDeadFiles must be a non-negative number`);
  }
  if (!Number.isFinite(candidateUnusedExports) || candidateUnusedExports < 0) {
    throw new Error(`${DEAD_EXPORT_BASELINE_PATH} candidateUnusedExports must be a non-negative number`);
  }
  return { candidateDeadFiles, candidateUnusedExports };
}

export function collectDeadExportRatchet({ rootDir = DEFAULT_ROOT_DIR } = {}) {
  const current = collectDeadExportAdvisory({ rootDir });
  const baseline = readDeadExportBaseline(rootDir);
  return {
    current,
    baseline,
    deadFileIncrease: Math.max(0, current.candidateDeadFiles.length - baseline.candidateDeadFiles),
    unusedExportIncrease: Math.max(0, current.candidateUnusedExports.length - baseline.candidateUnusedExports),
  };
}

export function runDeadExportCheck({
  rootDir = DEFAULT_ROOT_DIR,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  let result;
  try {
    result = collectDeadExportRatchet({ rootDir });
  } catch (error) {
    stderr(`Dead export ratchet failed: ${error.message}`);
    return 1;
  }

  const { current, baseline, deadFileIncrease, unusedExportIncrease } = result;
  if (deadFileIncrease > 0) {
    stderr(
      `Dead export ratchet failed: candidate dead files increased: ${baseline.candidateDeadFiles} -> ${current.candidateDeadFiles.length}.`,
    );
  }
  if (unusedExportIncrease > 0) {
    stderr(
      `Dead export ratchet failed: candidate unused named exports increased: ${baseline.candidateUnusedExports} -> ${current.candidateUnusedExports.length}.`,
    );
  }
  if (deadFileIncrease > 0 || unusedExportIncrease > 0) return 1;

  stdout(
    `Dead export ratchet passed: dead files ${current.candidateDeadFiles.length}/${baseline.candidateDeadFiles}; unused named exports ${current.candidateUnusedExports.length}/${baseline.candidateUnusedExports}.`,
  );
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.exit(process.argv.includes('--check') ? runDeadExportCheck() : runDeadExportAdvisory());
}
