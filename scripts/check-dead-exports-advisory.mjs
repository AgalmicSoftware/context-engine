#!/usr/bin/env node

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');
export const SOURCE_ROOT = 'client/src';

const require = createRequire(import.meta.url);
let typescript = null;
try {
  typescript = require(path.join(DEFAULT_ROOT_DIR, 'client/node_modules/typescript/lib/typescript.js'));
} catch {
  // Report a focused setup error from the public entrypoints below.
}

const SOURCE_FILE_RE = /\.(?:js|jsx|mjs|cjs|ts|tsx)$/;
const DECLARATION_FILE_RE = /\.d\.ts$/;
const TEST_FILE_RE = /\.(?:test|spec)\.(?:js|jsx|mjs|cjs|ts|tsx)$/;
const TEST_UTILITY_FILE_RE =
  /(?:^|[._-])(?:test-?utils?|testing|fixtures?)(?:[._-]|\.)|(?:harness|fixtures|testUtils?|testingUtils?)\.(?:js|jsx|mjs|cjs|ts|tsx)$/i;
const SKIP_SEGMENTS = new Set([
  '__fixtures__',
  '__mocks__',
  '__tests__',
  'artifacts',
  'fixtures',
  'test',
  'test-utils',
  'testutils',
  'tests',
  'testing',
]);

// These files are selected by build aliases or package scripts instead of a
// client/src import. Keeping the executable entry-point map beside the scanner
// is more truthful than banking a count of false-positive "dead" files.
const NON_IMPORT_ENTRYPOINT_FILES = new Set([
  'client/src/app/runtime/walletConnectorProfile.metamask.ts',
  'client/src/app/runtime/walletUiRuntime.metamask.tsx',
  'client/src/shims/metamask-superstruct.ts',
  'client/src/utilities/survey/commongroundExport.ts',
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
  return !segments.some((segment) => SKIP_SEGMENTS.has(segment.toLowerCase()));
}

function isReferenceSourceFile(filePath) {
  const normalized = normalizePath(filePath);
  return normalized.startsWith(`${SOURCE_ROOT}/`) && SOURCE_FILE_RE.test(normalized);
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

// Parity-locked runtime twins (e.g. rpcDefaults.{js,ts}, litChipotlePolicy.{js,ts})
// are one module: the .js exists only for no-loader runtime consumers and is
// pinned byte-equivalent in behavior by a parity test. Reachability and
// export-usage accounting must not report either twin as dead while the other
// is alive.
function resolveTwinSibling(file, fileSet) {
  if (file.endsWith('.js')) {
    const twin = `${file.slice(0, -'.js'.length)}.ts`;
    return fileSet.has(twin) ? twin : null;
  }
  if (file.endsWith('.ts')) {
    const twin = `${file.slice(0, -'.ts'.length)}.js`;
    return fileSet.has(twin) ? twin : null;
  }
  return null;
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

function parseSourceFile(sourceText, filePath) {
  const scriptKind = filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
    ? typescript.ScriptKind.TSX
    : filePath.endsWith('.js') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs')
      ? typescript.ScriptKind.JS
      : typescript.ScriptKind.TS;
  return typescript.createSourceFile(filePath, sourceText, typescript.ScriptTarget.Latest, true, scriptKind);
}

function hasExportModifier(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === typescript.SyntaxKind.ExportKeyword));
}

function hasDefaultModifier(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === typescript.SyntaxKind.DefaultKeyword));
}

function extractNamedExports(sourceText, filePath) {
  const sourceFile = parseSourceFile(sourceText, filePath);
  const exports = new Set();
  sourceFile.statements.forEach((statement) => {
    if (typescript.isVariableStatement(statement) && hasExportModifier(statement)) {
      statement.declarationList.declarations.forEach((declaration) => {
        if (typescript.isIdentifier(declaration.name)) exports.add(declaration.name.text);
      });
    } else if (
      (typescript.isFunctionDeclaration(statement) || typescript.isClassDeclaration(statement))
      && hasExportModifier(statement)
      && !hasDefaultModifier(statement)
      && statement.name
    ) {
      exports.add(statement.name.text);
    } else if (
      typescript.isExportDeclaration(statement)
      && !statement.moduleSpecifier
      && statement.exportClause
      && typescript.isNamedExports(statement.exportClause)
    ) {
      statement.exportClause.elements.forEach((element) => exports.add(element.name.text));
    }
  });
  return [...exports].sort();
}

function isOwnExportName(node) {
  const parent = node.parent;
  if (
    (typescript.isFunctionDeclaration(parent) || typescript.isClassDeclaration(parent))
    && parent.name === node
    && hasExportModifier(parent)
  ) {
    return true;
  }
  if (typescript.isVariableDeclaration(parent) && parent.name === node) {
    const declarationList = parent.parent;
    const statement = declarationList?.parent;
    return Boolean(statement && typescript.isVariableStatement(statement) && hasExportModifier(statement));
  }
  if (typescript.isExportSpecifier(parent) && parent.name === node) {
    const exportDeclaration = parent.parent?.parent;
    return Boolean(exportDeclaration && typescript.isExportDeclaration(exportDeclaration) && !exportDeclaration.moduleSpecifier);
  }
  return false;
}

function extractIdentifiers(sourceText, filePath, { omitOwnExports = false } = {}) {
  const sourceFile = parseSourceFile(sourceText, filePath);
  const identifiers = new Set();
  const visit = (node) => {
    if (typescript.isIdentifier(node) && !(omitOwnExports && isOwnExportName(node))) {
      identifiers.add(node.text);
    }
    typescript.forEachChild(node, visit);
  };
  visit(sourceFile);
  return identifiers;
}

export function collectDeadExportAdvisory({ rootDir = DEFAULT_ROOT_DIR } = {}) {
  if (!typescript) {
    throw new Error('Dead export analysis requires client dependencies. Run `npm --prefix client install` first.');
  }
  const referenceFiles = walkFiles(rootDir).filter(isReferenceSourceFile).sort();
  const files = referenceFiles.filter(isProductionSourceFile);
  const fileSet = new Set(referenceFiles);
  const importedFiles = new Set();
  const allIdentifiers = new Set();
  const fileExports = [];
  const sourceByFile = new Map();

  for (const file of referenceFiles) {
    const sourceText = fs.readFileSync(path.join(rootDir, file), 'utf8');
    sourceByFile.set(file, sourceText);
    const productionSource = isProductionSourceFile(file);
    const identifiers = productionSource
      ? extractIdentifiers(sourceText, file, { omitOwnExports: true })
      : extractIdentifiers(sourceText, file);
    identifiers.forEach((identifier) => allIdentifiers.add(identifier));
    if (productionSource || DECLARATION_FILE_RE.test(file)) {
      extractImportSpecifiers(sourceText)
        .map((specifier) => resolveClientImport(file, specifier, fileSet))
        .filter(Boolean)
        .forEach((resolved) => {
          importedFiles.add(resolved);
          const twin = resolveTwinSibling(resolved, fileSet);
          if (twin) importedFiles.add(twin);
        });
    }
  }

  NON_IMPORT_ENTRYPOINT_FILES.forEach((file) => {
    if (fileSet.has(file)) importedFiles.add(file);
  });

  for (const file of files) {
    const sourceText = sourceByFile.get(file) || '';
    fileExports.push({
      file,
      exports: extractNamedExports(sourceText, file),
    });
  }

  const candidateDeadFiles = fileExports
    .filter(({ file, exports }) => isCandidateFile(file) && exports.length > 0 && !importedFiles.has(file))
    .map(({ file }) => file);
  const exportsByFile = new Map(fileExports.map(({ file, exports }) => [file, exports]));
  const candidateUnusedExports = fileExports
    .filter(({ file }) => isCandidateFile(file) && !NON_IMPORT_ENTRYPOINT_FILES.has(file))
    .flatMap(({ file, exports }) => exports
      .filter((exportName) => !allIdentifiers.has(exportName))
      .filter((exportName) => {
        // A shared twin export counts once, attributed to the .ts side.
        const twin = resolveTwinSibling(file, fileSet);
        return !(twin && file.endsWith('.js') && (exportsByFile.get(twin) || []).includes(exportName));
      })
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

export function runDeadExportAdvisory({
  rootDir = DEFAULT_ROOT_DIR,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  if (!typescript) {
    stderr('Dead export analysis requires client dependencies. Run `npm --prefix client install` first.');
    return 1;
  }
  stdout(formatDeadExportAdvisory(collectDeadExportAdvisory({ rootDir })));
  return 0;
}

export function runDeadExportCheck({
  rootDir = DEFAULT_ROOT_DIR,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  if (!typescript) {
    stderr('Dead export check requires client dependencies. Run `npm --prefix client install` first.');
    return 1;
  }
  const current = collectDeadExportAdvisory({ rootDir });
  if (current.candidateDeadFiles.length > 0 || current.candidateUnusedExports.length > 0) {
    stderr('Dead export check failed; remove or explicitly wire every candidate:');
    stderr(formatDeadExportAdvisory(current));
    return 1;
  }

  stdout(`Dead export check passed: ${current.filesScanned} production client files, zero candidates.`);
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.exit(process.argv.includes('--check') ? runDeadExportCheck() : runDeadExportAdvisory());
}
