#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');
export const SOURCE_ROOT = 'client/src';
export const BASELINE_PATH = 'scripts/type-debt-baseline.json';

export const TYPE_DEBT_PATTERNS = Object.freeze([
  {
    key: 'tsNocheck',
    label: '@ts-nocheck',
    pattern: /^\s*\/\/\s*@ts-nocheck\b/gm,
  },
  {
    key: 'colonAny',
    label: ': any',
    pattern: /:\s*any\b/g,
  },
  {
    key: 'asAny',
    label: 'as any',
    pattern: /\bas\s+any\b/g,
  },
  {
    key: 'asUnknownAs',
    label: 'as unknown as',
    pattern: /\bas\s+unknown\s+as\b/g,
  },
  {
    key: 'promiseAny',
    label: 'Promise<any>',
    pattern: /\bPromise\s*<\s*any\s*>/g,
  },
  {
    key: 'arrayAny',
    label: 'Array<any>',
    pattern: /\bArray\s*<\s*any\s*>/g,
  },
  {
    key: 'recordAny',
    label: 'Record<...any...>',
    pattern: /\bRecord\s*<(?=[^>\n]*\bany\b)[^>\n]*>/g,
  },
]);

const TEST_DIRECTORY_SEGMENTS = new Set([
  '__fixtures__',
  '__mocks__',
  '__tests__',
  'fixtures',
  'test',
  'test-utils',
  'tests',
  'testing',
]);

const TEST_FILE_PATTERN = /\.(?:test|spec)\.tsx?$/;
const TEST_UTILITY_FILE_PATTERN =
  /(?:^|[._-])(?:test-?utils?|testing|fixtures?)(?:[._-]|\.)|(?:testFixtures|testUtils|testingUtils)/i;
const TEST_HARNESS_FILE_PATTERN = /harness\.tsx?$/i;

export const createZeroCounts = () => Object.fromEntries(
  TYPE_DEBT_PATTERNS.map(({ key }) => [key, 0]),
);

export const countTotal = (counts) => TYPE_DEBT_PATTERNS.reduce(
  (total, { key }) => total + (counts[key] || 0),
  0,
);

const normalizePath = (filePath) => filePath.split(path.sep).join('/');

export const isProductionTypeScriptFile = (filePath) => {
  const normalizedPath = normalizePath(filePath);

  if (!normalizedPath.startsWith(`${SOURCE_ROOT}/`)) {
    return false;
  }

  if (!/\.(?:ts|tsx)$/.test(normalizedPath)) {
    return false;
  }

  const basename = path.posix.basename(normalizedPath);
  if (TEST_FILE_PATTERN.test(basename) || /^setupTests\.tsx?$/i.test(basename)) {
    return false;
  }

  if (TEST_UTILITY_FILE_PATTERN.test(basename) || TEST_HARNESS_FILE_PATTERN.test(basename)) {
    return false;
  }

  const sourceRelativeSegments = normalizedPath.slice(`${SOURCE_ROOT}/`.length).split('/');
  return !sourceRelativeSegments.some((segment) => TEST_DIRECTORY_SEGMENTS.has(segment));
};

export const countTypeDebtInText = (source) => {
  const counts = createZeroCounts();

  for (const { key, pattern } of TYPE_DEBT_PATTERNS) {
    counts[key] = [...source.matchAll(pattern)].length;
  }

  return counts;
};

export const addCounts = (target, counts) => {
  for (const { key } of TYPE_DEBT_PATTERNS) {
    target[key] = (target[key] || 0) + (counts[key] || 0);
  }
  return target;
};

export const listTrackedClientSourceFiles = (rootDir = DEFAULT_ROOT_DIR) => {
  const trackedFilesBuffer = execFileSync('git', ['ls-files', '-z', SOURCE_ROOT], {
    cwd: rootDir,
    encoding: 'buffer',
  });

  return trackedFilesBuffer
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort();
};

export const collectTypeDebt = ({
  rootDir = DEFAULT_ROOT_DIR,
  listFiles = listTrackedClientSourceFiles,
} = {}) => {
  const counts = createZeroCounts();
  const files = [];
  let filesChecked = 0;

  const candidateFiles = listFiles(rootDir).filter(isProductionTypeScriptFile).sort();

  for (const filePath of candidateFiles) {
    const absolutePath = path.join(rootDir, filePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    filesChecked += 1;
    const fileCounts = countTypeDebtInText(fs.readFileSync(absolutePath, 'utf8'));
    addCounts(counts, fileCounts);

    if (countTotal(fileCounts) > 0) {
      files.push({
        path: filePath,
        counts: fileCounts,
      });
    }
  }

  return {
    sourceRoot: SOURCE_ROOT,
    filesChecked,
    counts,
    files,
  };
};

export const normalizeBaselineCounts = (baseline) => ({
  ...createZeroCounts(),
  ...(baseline.counts || baseline),
});

export const compareTypeDebtCounts = (currentCounts, baselineCounts) => TYPE_DEBT_PATTERNS
  .map(({ key, label }) => {
    const current = currentCounts[key] || 0;
    const baseline = baselineCounts[key] || 0;

    return {
      key,
      label,
      current,
      baseline,
      delta: current - baseline,
    };
  })
  .filter(({ delta }) => delta > 0);

export const compareTypeDebtReductions = (currentCounts, baselineCounts) => TYPE_DEBT_PATTERNS
  .map(({ key, label }) => {
    const current = currentCounts[key] || 0;
    const baseline = baselineCounts[key] || 0;

    return {
      key,
      label,
      current,
      baseline,
      delta: current - baseline,
    };
  })
  .filter(({ delta }) => delta < 0);

export const readBaseline = (rootDir = DEFAULT_ROOT_DIR) => {
  const baselinePath = path.join(rootDir, BASELINE_PATH);
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
};

export const writeBaseline = (debt, rootDir = DEFAULT_ROOT_DIR) => {
  const baseline = {
    sourceRoot: SOURCE_ROOT,
    excluded: [
      '*.test.ts',
      '*.test.tsx',
      '*.spec.ts',
      '*.spec.tsx',
      'setupTests.ts',
      '__tests__/**',
      'test utility directories/files',
    ],
    counts: debt.counts,
  };

  const baselinePath = path.join(rootDir, BASELINE_PATH);
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  return baselinePath;
};

const formatCounts = (currentCounts, baselineCounts) => TYPE_DEBT_PATTERNS
  .map(({ key, label }) => (
    `- ${label}: ${currentCounts[key] || 0} / ${baselineCounts[key] || 0}`
  ))
  .join('\n');

const formatFileCounts = ({ path: filePath, counts }) => {
  const nonZeroCounts = TYPE_DEBT_PATTERNS
    .filter(({ key }) => counts[key] > 0)
    .map(({ key, label }) => `${label}=${counts[key]}`);

  return `- ${filePath}: ${nonZeroCounts.join(', ')}`;
};

export const runTypeDebtRatchet = ({
  rootDir = DEFAULT_ROOT_DIR,
  argv = process.argv.slice(2),
  stdout = console.log,
  stderr = console.error,
} = {}) => {
  const args = new Set(argv);
  const knownArgs = new Set(['--help', '--json', '--list', '--write-baseline']);
  const unknownArgs = argv.filter((arg) => !knownArgs.has(arg));

  if (unknownArgs.length > 0) {
    stderr(`Unknown argument(s): ${unknownArgs.join(', ')}`);
    return 1;
  }

  if (args.has('--help')) {
    stdout([
      'Usage: node scripts/check-type-debt-ratchet.mjs [--json] [--list] [--write-baseline]',
      '',
      'Checks production client/src TS/TSX type-debt counts against scripts/type-debt-baseline.json.',
      'Use --write-baseline after intentional cleanup to ratchet the checked-in baseline down.',
    ].join('\n'));
    return 0;
  }

  const debt = collectTypeDebt({ rootDir });

  if (args.has('--write-baseline')) {
    const baselinePath = writeBaseline(debt, rootDir);
    stdout(`Wrote type debt baseline to ${path.relative(rootDir, baselinePath)}.`);
    return 0;
  }

  if (args.has('--json')) {
    stdout(JSON.stringify(debt, null, 2));
    return 0;
  }

  const baselineCounts = normalizeBaselineCounts(readBaseline(rootDir));
  const increases = compareTypeDebtCounts(debt.counts, baselineCounts);
  const reductions = compareTypeDebtReductions(debt.counts, baselineCounts);

  stdout(`Type debt ratchet checked ${debt.filesChecked} production TS/TSX files in ${SOURCE_ROOT}.`);
  stdout('Current counts (current / baseline):');
  stdout(formatCounts(debt.counts, baselineCounts));

  if (args.has('--list') && debt.files.length > 0) {
    stdout('Files with counted debt:');
    debt.files.forEach((file) => stdout(formatFileCounts(file)));
  }

  if (increases.length > 0) {
    stderr('Type debt ratchet failed: count(s) increased above baseline.');
    increases.forEach(({ label, current, baseline, delta }) => {
      stderr(`- ${label}: ${current} exceeds baseline ${baseline} by ${delta}`);
    });
    return 1;
  }

  if (reductions.length > 0) {
    stdout('Type debt baseline has headroom; re-bank the baseline with --write-baseline in the same commit.');
    reductions.forEach(({ label, current, baseline, delta }) => {
      stdout(`- ${label}: ${current} is below baseline ${baseline} by ${Math.abs(delta)}`);
    });
  }

  stdout('Type debt ratchet passed: no count increased above baseline.');
  return 0;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runTypeDebtRatchet());
}
