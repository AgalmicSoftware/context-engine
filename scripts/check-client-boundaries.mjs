#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');
export const SOURCE_ROOT = 'client/src';
export const BASELINE_PATH = 'scripts/client-boundaries-baseline.json';

const SOURCE_FILE_PATTERN = /\.(?:js|jsx|ts|tsx)$/;
const DECLARATION_FILE_PATTERN = /\.d\.ts$/;
const TEST_FILE_PATTERN = /\.(?:test|spec)\.(?:js|jsx|ts|tsx)$/;
const TEST_UTILITY_FILE_PATTERN =
  /(?:^|[._-])(?:test-?utils?|testing|fixtures?)(?:[._-]|\.)|(?:testFixtures|testUtils|testingUtils)/i;
const TEST_HARNESS_FILE_PATTERN = /harness\.(?:js|jsx|ts|tsx)$/i;

const IMPORT_PATTERNS = Object.freeze([
  /\bimport\s+(?:type\s+)?(?:[^'";]+?\s+from\s*)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:type\s+)?[^'";]+?\s+from\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]);

const LOW_LEVEL_ROUTE_IMPORT_PREFIXES = Object.freeze([
  'client/src/utilities/arweave/',
  'client/src/utilities/storage/',
  'client/src/utilities/web3/',
  'client/src/utilities/worker/',
]);

const VITE_BARE_CLIENT_ALIASES = Object.freeze([
  'assets',
  'components',
  'utilities',
  'variables',
]);

const ROUTE_RUNTIME_OWNER_PREFIXES = Object.freeze([
  'client/src/app/runtime/',
  'client/src/app/routes/',
  'client/src/components/Admin/AdminPage',
  'client/src/components/MainSite/',
  'client/src/components/OnePageSession/',
  'client/src/components/Sessions/SessionWizard',
]);

const SHARED_RUNTIME_MIN_LINE_COUNT = 5000;
const SHARED_RUNTIME_COMPONENT_FILES = Object.freeze([
  'client/src/components/SurveyTool/SurveyQuestions.tsx',
]);

export const CLIENT_BOUNDARY_RULES = Object.freeze({
  domainsNoComponents: {
    id: 'domains-no-components',
    description: 'client/src/domains/** must not import client/src/components/**',
  },
  routePageNoLowLevel: {
    id: 'route-page-no-low-level',
    description: 'route/page code should not add direct imports of low-level web3/worker/storage modules',
  },
  sharedRuntimeNoNewLowLevel: {
    id: 'shared-runtime-no-new-low-level',
    description: 'large shared runtime components should not add direct imports of low-level web3/worker/storage modules',
  },
  noPassthroughFacade: {
    id: 'no-passthrough-facade',
    description: 'client utility/component modules should not add thin pass-through facades over low-level modules',
  },
  productionNoTestExclusionImports: {
    id: 'production-no-test-exclusion-imports',
    description: 'production client/src files must not import harness/test utility/fixture modules excluded from test gates',
  },
  uiNoRouteRuntime: {
    id: 'ui-no-route-runtime',
    description: 'client/src/components/ui/** must not import route/runtime owners',
  },
  utilitiesNoComponents: {
    id: 'utilities-no-components',
    description: 'client/src/utilities/** must not import client/src/components/**',
  },
});

const normalizePath = (filePath) => filePath.split(/[\\/]+/).join('/');
const startsWithPath = (filePath, prefix) => filePath === prefix || filePath.startsWith(prefix);
const hasPathPrefix = (filePath, prefix) => (
  filePath === prefix.slice(0, -1) || filePath.startsWith(prefix)
);

export const isProductionClientSourceFile = (filePath) => {
  const normalizedPath = normalizePath(filePath);

  if (!normalizedPath.startsWith(`${SOURCE_ROOT}/`)) {
    return false;
  }
  if (!SOURCE_FILE_PATTERN.test(normalizedPath) || DECLARATION_FILE_PATTERN.test(normalizedPath)) {
    return false;
  }
  if (normalizedPath.startsWith(`${SOURCE_ROOT}/artifacts/`)) {
    return false;
  }

  const basename = path.posix.basename(normalizedPath);
  if (
    TEST_FILE_PATTERN.test(basename)
    || /^setupTests\.(?:js|jsx|ts|tsx)$/i.test(basename)
    || TEST_UTILITY_FILE_PATTERN.test(basename)
    || TEST_HARNESS_FILE_PATTERN.test(basename)
  ) {
    return false;
  }

  const sourceRelativeSegments = normalizedPath.slice(`${SOURCE_ROOT}/`.length).split('/');
  return !sourceRelativeSegments.some((segment) => (
    segment === '__fixtures__'
    || segment === '__mocks__'
    || segment === '__tests__'
    || segment === 'fixtures'
    || segment === 'test'
    || segment === 'test-utils'
    || segment === 'tests'
    || segment === 'testing'
  ));
};

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

export function listClientSourceFiles(rootDir = DEFAULT_ROOT_DIR) {
  const gitDir = path.join(rootDir, '.git');
  if (fs.existsSync(gitDir)) {
    try {
      return execFileSync('git', ['ls-files', '-z', SOURCE_ROOT], {
        cwd: rootDir,
        encoding: 'buffer',
      })
        .toString('utf8')
        .split('\0')
        .filter(Boolean)
        .sort();
    } catch {
      // Fall through to a filesystem walk for stripped/public copies.
    }
  }

  return walkFiles(rootDir).sort();
}

export function extractImportSpecifiers(source) {
  const specifiers = [];

  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }

  return [...new Set(specifiers)].sort();
}

export function resolveClientImport(sourceFile, specifier) {
  const normalizedSource = normalizePath(sourceFile);
  const normalizedSpecifier = normalizePath(specifier);
  let resolved = null;

  if (normalizedSpecifier.startsWith('.')) {
    resolved = path.posix.normalize(path.posix.join(path.posix.dirname(normalizedSource), normalizedSpecifier));
  } else if (normalizedSpecifier.startsWith(`${SOURCE_ROOT}/`)) {
    resolved = normalizedSpecifier;
  } else if (normalizedSpecifier.startsWith('src/')) {
    resolved = `client/${normalizedSpecifier}`;
  } else if (normalizedSpecifier.startsWith('@/')) {
    resolved = `${SOURCE_ROOT}/${normalizedSpecifier.slice(2)}`;
  } else {
    const alias = VITE_BARE_CLIENT_ALIASES.find((candidate) => (
      normalizedSpecifier === candidate
      || normalizedSpecifier.startsWith(`${candidate}/`)
    ));
    if (alias) {
      resolved = `${SOURCE_ROOT}/${normalizedSpecifier}`;
    }
  }

  if (!resolved || !resolved.startsWith(`${SOURCE_ROOT}/`)) {
    return null;
  }

  return resolved.replace(/\.(?:js|jsx|ts|tsx)$/, '').replace(/\/index$/, '/');
}

const isComponentsPath = (filePath) => hasPathPrefix(filePath, 'client/src/components/');
const isDomainsPath = (filePath) => hasPathPrefix(filePath, 'client/src/domains/');
const isUtilitiesPath = (filePath) => hasPathPrefix(filePath, 'client/src/utilities/');
const isUiComponentPath = (filePath) => hasPathPrefix(filePath, 'client/src/components/ui/');

const isRouteRuntimeOwnerImport = (resolvedImport) => ROUTE_RUNTIME_OWNER_PREFIXES
  .some((prefix) => startsWithPath(resolvedImport, prefix));

const isLowLevelRouteImport = (resolvedImport) => LOW_LEVEL_ROUTE_IMPORT_PREFIXES
  .some((prefix) => startsWithPath(resolvedImport, prefix));

const countSourceLines = (sourceText) => (
  sourceText.length === 0 ? 0 : sourceText.split(/\r\n|\r|\n/).length
);

function isSharedRuntimeComponent(source, sourceText) {
  if (!isComponentsPath(source)) {
    return false;
  }
  if (SHARED_RUNTIME_COMPONENT_FILES.includes(source)) {
    return true;
  }
  return countSourceLines(sourceText) > SHARED_RUNTIME_MIN_LINE_COUNT;
}

const isPassthroughFacadeRuleScope = (filePath) => (
  (isUtilitiesPath(filePath) || isComponentsPath(filePath))
  && !hasPathPrefix(filePath, 'client/src/domains/')
  && !hasPathPrefix(filePath, 'client/src/app/runtime/')
);

const isNamingMigrationAlias = (sourceText) => (
  /^\s*\/\*\*\s*naming-migration alias, remove after compatibility cleanup\.\s*\*\/\s*/.test(sourceText)
);

const isComponentRuntimeFacadeCandidate = (filePath) => (
  isComponentsPath(filePath)
  && /Runtime\.(?:js|jsx|ts|tsx)$/.test(path.posix.basename(filePath))
);

const TEST_EXCLUSION_IMPORT_FILE_PATTERN =
  /(?:^|[._-])(?:test-?utils?|testing|fixtures?)(?:[._-]|\.|$)|(?:testFixtures|testUtils|testingUtils)|harness(?:\.(?:js|jsx|ts|tsx))?$/i;

function isTestExclusionImportTarget(filePath) {
  const normalizedPath = normalizePath(filePath);
  if (!normalizedPath.startsWith(`${SOURCE_ROOT}/`)) {
    return false;
  }

  const basename = path.posix.basename(normalizedPath);
  if (
    TEST_FILE_PATTERN.test(basename)
    || /^setupTests(?:\.(?:js|jsx|ts|tsx))?$/i.test(basename)
    || TEST_EXCLUSION_IMPORT_FILE_PATTERN.test(basename)
  ) {
    return true;
  }

  const sourceRelativeSegments = normalizedPath.slice(`${SOURCE_ROOT}/`.length).split('/');
  return sourceRelativeSegments.some((segment) => (
    segment === '__fixtures__'
    || segment === '__mocks__'
    || segment === '__tests__'
    || segment === 'fixtures'
    || segment === 'test'
    || segment === 'test-utils'
    || segment === 'tests'
    || segment === 'testing'
  ));
}

export function isRouteOrPageCode(filePath) {
  const normalizedPath = normalizePath(filePath).replace(/\.(?:js|jsx|ts|tsx)$/, '');

  if (
    hasPathPrefix(normalizedPath, 'client/src/app/pages/')
    || hasPathPrefix(normalizedPath, 'client/src/app/routes/')
    || hasPathPrefix(normalizedPath, 'client/src/components/pages/')
  ) {
    return true;
  }

  const basename = path.posix.basename(normalizedPath);
  return (
    basename === 'App'
    || basename === 'AppShell'
    || basename === 'MainSite'
    || basename === 'OnePageSession'
    || basename === 'SessionWizard'
    || /(?:Page|Routes?)$/.test(basename)
  );
}

function buildViolation(rule, source, specifier, resolvedImport) {
  return {
    rule: rule.id,
    source,
    import: specifier,
    resolved: resolvedImport,
  };
}

function parseNamedExportCount(specifiers) {
  if (!specifiers) {
    return 1;
  }

  return specifiers
    .split(',')
    .map((specifier) => specifier.trim())
    .filter(Boolean)
    .length;
}

function parseImportedIdentifiers(importClause) {
  const identifiers = [];
  const clause = importClause.trim();
  const namespaceMatch = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (namespaceMatch) {
    identifiers.push(namespaceMatch[1]);
  }

  const namedMatch = clause.match(/\{([\s\S]*?)\}/);
  if (namedMatch) {
    for (const namedImport of namedMatch[1].split(',')) {
      const cleaned = namedImport.trim();
      if (!cleaned || cleaned.startsWith('type ')) {
        continue;
      }
      const aliasMatch = cleaned.match(/\bas\s+([A-Za-z_$][\w$]*)$/);
      const directMatch = cleaned.match(/^([A-Za-z_$][\w$]*)/);
      if (aliasMatch) {
        identifiers.push(aliasMatch[1]);
      } else if (directMatch) {
        identifiers.push(directMatch[1]);
      }
    }
  }

  const defaultImport = clause
    .replace(/\{[\s\S]*?\}/g, '')
    .replace(/\*\s+as\s+[A-Za-z_$][\w$]*/g, '')
    .split(',')[0]
    .trim();
  if (/^[A-Za-z_$][\w$]*$/.test(defaultImport)) {
    identifiers.push(defaultImport);
  }

  return identifiers;
}

function collectLowLevelImportedIdentifiers(sourceFile, sourceText) {
  const identifiers = new Set();
  const importPattern = /\bimport\s+(?:type\s+)?([^'";]+?)\s+from\s*['"]([^'"]+)['"]/g;

  for (const match of sourceText.matchAll(importPattern)) {
    const resolved = resolveClientImport(sourceFile, match[2]);
    if (!resolved || !isLowLevelRouteImport(resolved)) {
      continue;
    }
    parseImportedIdentifiers(match[1]).forEach((identifier) => identifiers.add(identifier));
  }

  let addedAlias = true;
  while (addedAlias) {
    addedAlias = false;
    const aliasPattern = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*\(?\s*([A-Za-z_$][\w$]*)\b[^;]*;/g;
    for (const match of sourceText.matchAll(aliasPattern)) {
      if (identifiers.has(match[2]) && !identifiers.has(match[1])) {
        identifiers.add(match[1]);
        addedAlias = true;
      }
    }
  }

  return identifiers;
}

function isLowLevelDelegatingExpression(expression, lowLevelIdentifiers) {
  const normalized = expression.trim();
  if (!normalized) {
    return false;
  }

  for (const identifier of lowLevelIdentifiers) {
    const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^${escapedIdentifier}\\s*(?:\\.|\\?\\.|\\()`).test(normalized)) {
      return true;
    }
  }
  return false;
}

function collectPassthroughFacadeExportStats(sourceFile, sourceText) {
  let totalExports = 0;
  let passthroughExports = 0;

  const reExportPattern = /\bexport\s+(?:type\s+)?(?:\*\s*(?:as\s+[A-Za-z_$][\w$]*\s*)?|\{([\s\S]*?)\})\s+from\s*['"]([^'"]+)['"]/g;
  for (const match of sourceText.matchAll(reExportPattern)) {
    const exportCount = parseNamedExportCount(match[1]);
    totalExports += exportCount;

    const resolved = resolveClientImport(sourceFile, match[2]);
    if (resolved && isLowLevelRouteImport(resolved)) {
      passthroughExports += exportCount;
    }
  }

  const lowLevelIdentifiers = collectLowLevelImportedIdentifiers(sourceFile, sourceText);

  const exportedConstPattern = /\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*=[\s\S]*?=>\s*\(([\s\S]*?)\)\s*;/g;
  for (const match of sourceText.matchAll(exportedConstPattern)) {
    totalExports += 1;
    if (isLowLevelDelegatingExpression(match[2], lowLevelIdentifiers)) {
      passthroughExports += 1;
    }
  }

  const exportedFunctionPattern = /\bexport\s+(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*(?::[^{]+)?\{\s*return\s+([\s\S]*?);\s*\}/g;
  for (const match of sourceText.matchAll(exportedFunctionPattern)) {
    totalExports += 1;
    if (isLowLevelDelegatingExpression(match[1], lowLevelIdentifiers)) {
      passthroughExports += 1;
    }
  }

  return {
    totalExports,
    passthroughExports,
  };
}

export function evaluatePassthroughFacade({ source, sourceText }) {
  if (!isPassthroughFacadeRuleScope(source)) {
    return [];
  }
  if (isNamingMigrationAlias(sourceText)) {
    return [];
  }

  const { totalExports, passthroughExports } = collectPassthroughFacadeExportStats(source, sourceText);
  if (passthroughExports === 0) {
    return [];
  }

  const passthroughRatio = passthroughExports / totalExports;
  const exceedsFacadeThreshold = totalExports >= 3 && passthroughRatio >= 0.8;
  const isComponentMicroFacade = (
    isComponentRuntimeFacadeCandidate(source)
    && totalExports >= 1
    && passthroughRatio === 1
  );

  if (!exceedsFacadeThreshold && !isComponentMicroFacade) {
    return [];
  }

  return [buildViolation(
    CLIENT_BOUNDARY_RULES.noPassthroughFacade,
    source,
    '<passthrough-facade>',
    source,
  )];
}

export function evaluateClientBoundaryImport({ source, sourceText = '', specifier, resolved }) {
  const violations = [];

  if (isUtilitiesPath(source) && isComponentsPath(resolved)) {
    violations.push(buildViolation(
      CLIENT_BOUNDARY_RULES.utilitiesNoComponents,
      source,
      specifier,
      resolved,
    ));
  }

  if (isDomainsPath(source) && isComponentsPath(resolved)) {
    violations.push(buildViolation(
      CLIENT_BOUNDARY_RULES.domainsNoComponents,
      source,
      specifier,
      resolved,
    ));
  }

  if (isUiComponentPath(source) && isRouteRuntimeOwnerImport(resolved)) {
    violations.push(buildViolation(
      CLIENT_BOUNDARY_RULES.uiNoRouteRuntime,
      source,
      specifier,
      resolved,
    ));
  }

  if (isRouteOrPageCode(source) && isLowLevelRouteImport(resolved)) {
    violations.push(buildViolation(
      CLIENT_BOUNDARY_RULES.routePageNoLowLevel,
      source,
      specifier,
      resolved,
    ));
  }

  if (isSharedRuntimeComponent(source, sourceText) && isLowLevelRouteImport(resolved)) {
    violations.push(buildViolation(
      CLIENT_BOUNDARY_RULES.sharedRuntimeNoNewLowLevel,
      source,
      specifier,
      resolved,
    ));
  }

  if (isTestExclusionImportTarget(resolved)) {
    violations.push(buildViolation(
      CLIENT_BOUNDARY_RULES.productionNoTestExclusionImports,
      source,
      specifier,
      resolved,
    ));
  }

  return violations;
}

export function collectClientBoundaryViolations({
  rootDir = DEFAULT_ROOT_DIR,
  listFiles = listClientSourceFiles,
} = {}) {
  const files = listFiles(rootDir).filter(isProductionClientSourceFile).sort();
  const violations = [];

  for (const source of files) {
    const absolutePath = path.join(rootDir, source);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const sourceText = fs.readFileSync(absolutePath, 'utf8');
    const importSpecifiers = extractImportSpecifiers(sourceText);
    violations.push(...evaluatePassthroughFacade({ source, sourceText }));

    for (const specifier of importSpecifiers) {
      const resolved = resolveClientImport(source, specifier);
      if (!resolved) {
        continue;
      }
      violations.push(...evaluateClientBoundaryImport({
        source,
        sourceText,
        specifier,
        resolved,
      }));
    }
  }

  return violations.sort(compareViolations);
}

function compareViolations(left, right) {
  return violationId(left).localeCompare(violationId(right));
}

export function violationId(violation) {
  return [
    violation.rule,
    violation.source,
    violation.import,
    violation.resolved,
  ].join('\t');
}

export function readBoundaryBaseline(rootDir = DEFAULT_ROOT_DIR) {
  const baselinePath = path.join(rootDir, BASELINE_PATH);
  if (!fs.existsSync(baselinePath)) {
    return {
      version: 1,
      mode: 'fail-on-new-violation',
      violations: [],
    };
  }
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

export function writeBoundaryBaseline(violations, rootDir = DEFAULT_ROOT_DIR) {
  const baseline = {
    version: 1,
    mode: 'fail-on-new-violation',
    note: 'Existing legacy boundary violations are allowed only as a baseline; new violations fail the boundary check.',
    violations,
  };
  const baselinePath = path.join(rootDir, BASELINE_PATH);
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  return baselinePath;
}

export function compareToBaseline(currentViolations, baselineViolations) {
  const baselineIds = new Set(baselineViolations.map(violationId));
  const currentIds = new Set(currentViolations.map(violationId));

  return {
    newViolations: currentViolations.filter((violation) => !baselineIds.has(violationId(violation))),
    resolvedViolations: baselineViolations.filter((violation) => !currentIds.has(violationId(violation))),
  };
}

export function findDuplicateBaselineViolations(baselineViolations) {
  const seenIds = new Set();
  const duplicates = [];

  for (const violation of baselineViolations) {
    const id = violationId(violation);
    if (seenIds.has(id)) {
      duplicates.push(violation);
    } else {
      seenIds.add(id);
    }
  }

  return duplicates.sort(compareViolations);
}

function countByRule(violations) {
  const counts = {};
  for (const violation of violations) {
    counts[violation.rule] = (counts[violation.rule] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function formatViolation(violation) {
  return `${violation.rule}: ${violation.source} imports ${violation.import} (${violation.resolved})`;
}

export function runClientBoundaryCheck({
  rootDir = DEFAULT_ROOT_DIR,
  argv = process.argv.slice(2),
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const args = new Set(argv);
  const knownArgs = new Set(['--help', '--json', '--list', '--write-baseline']);
  const unknownArgs = argv.filter((arg) => !knownArgs.has(arg));

  if (unknownArgs.length > 0) {
    stderr(`Unknown argument(s): ${unknownArgs.join(', ')}`);
    return 1;
  }

  if (args.has('--help')) {
    stdout([
      'Usage: node scripts/check-client-boundaries.mjs [--json] [--list] [--write-baseline]',
      '',
      'Checks conservative client architecture import boundaries against scripts/client-boundaries-baseline.json.',
      'Default mode fails only when the current tree adds a violation outside the checked-in baseline.',
    ].join('\n'));
    return 0;
  }

  const violations = collectClientBoundaryViolations({ rootDir });

  if (args.has('--write-baseline')) {
    const baselinePath = writeBoundaryBaseline(violations, rootDir);
    stdout(`Wrote client boundary baseline to ${path.relative(rootDir, baselinePath)}.`);
    return 0;
  }

  const baseline = readBoundaryBaseline(rootDir);
  const baselineViolations = Array.isArray(baseline.violations) ? baseline.violations : [];
  const comparison = compareToBaseline(violations, baselineViolations);
  const duplicateBaselineViolations = findDuplicateBaselineViolations(baselineViolations);
  const result = {
    mode: baseline.mode || 'fail-on-new-violation',
    filesRoot: SOURCE_ROOT,
    totalViolations: violations.length,
    countsByRule: countByRule(violations),
    baselineViolations: baselineViolations.length,
    duplicateBaselineViolations,
    newViolations: comparison.newViolations,
    resolvedViolations: comparison.resolvedViolations,
  };

  if (args.has('--json')) {
    stdout(JSON.stringify(result, null, 2));
    return (
      comparison.newViolations.length > 0
      || duplicateBaselineViolations.length > 0
      || comparison.resolvedViolations.length > 0
    ) ? 1 : 0;
  }

  stdout(`Client boundary check scanned ${SOURCE_ROOT}.`);
  stdout(`Current violations: ${violations.length}; baseline: ${baselineViolations.length}; new: ${comparison.newViolations.length}; resolved: ${comparison.resolvedViolations.length}.`);
  Object.entries(result.countsByRule).forEach(([rule, count]) => {
    stdout(`- ${rule}: ${count}`);
  });

  if (args.has('--list')) {
    violations.forEach((violation) => stdout(formatViolation(violation)));
  }

  if (duplicateBaselineViolations.length > 0) {
    stderr('Client boundary check failed: duplicate baseline entry/entries found.');
    duplicateBaselineViolations.forEach((violation) => stderr(`- ${formatViolation(violation)}`));
    return 1;
  }

  if (comparison.newViolations.length > 0) {
    stderr('Client boundary check failed: new architecture boundary violation(s) found.');
    comparison.newViolations.forEach((violation) => stderr(`- ${formatViolation(violation)}`));
    return 1;
  }

  if (comparison.resolvedViolations.length > 0) {
    stderr('Client boundary check failed: resolved baseline entry/entries found; prune the baseline in the same commit.');
    comparison.resolvedViolations.forEach((violation) => stderr(`- ${formatViolation(violation)}`));
    return 1;
  }

  stdout('Client boundary check passed: no new boundary violations.');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runClientBoundaryCheck());
}
