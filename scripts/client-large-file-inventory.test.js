'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const HARD_FILE_LINE_LIMIT = 5000;
const NEW_FILE_LINE_LIMIT = 1500;
const LARGE_FILE_LINE_LIMIT = 1000;
const MIN_GROWTH_ALLOWANCE = 100;
const GROWTH_ALLOWANCE_RATIO = 0.1;

const PRODUCTION_FILE_RE = /\.(?:js|jsx|ts|tsx)$/;
const TEST_OR_DECLARATION_FILE_RE = /(?:\.d|\.test|\.spec|\.testUtils|TestUtils)\.(?:js|jsx|ts|tsx)$/;
const GENERATED_OR_FIXTURE_PATH_RE = /(?:^|\/)(?:__fixtures__|__mocks__|__tests__|fixtures|generated)(?:\/|$)/;

const gitOutput = (args, rootDir = ROOT_DIR) =>
  execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

const git = (args, rootDir = ROOT_DIR) => gitOutput(args, rootDir).trim();

const resolveCommit = (ref, rootDir = ROOT_DIR) => {
  if (!ref) return '';
  try {
    return git(['rev-parse', '--verify', `${ref}^{commit}`], rootDir);
  } catch {
    return '';
  }
};

const resolveBaseCommit = (rootDir = ROOT_DIR, env = process.env) => {
  const head = resolveCommit('HEAD', rootDir);
  const candidates = [
    env.CLIENT_LARGE_FILE_BASE_REF,
    env.GITHUB_BASE_SHA,
    env.GITHUB_BASE_REF ? `origin/${env.GITHUB_BASE_REF}` : '',
    'dev',
  ];

  for (const candidate of candidates) {
    const commit = resolveCommit(candidate, rootDir);
    if (!commit || commit === head) continue;
    try {
      return git(['merge-base', commit, head], rootDir);
    } catch {
      // Try the next explicit base before falling back to the previous commit.
    }
  }

  return resolveCommit('HEAD^', rootDir);
};

const listTrackedClientProductionFiles = (rootDir = ROOT_DIR) =>
  git(['ls-files', 'client/src/components', 'client/src/utilities'], rootDir)
    .split('\n')
    .filter(Boolean)
    .filter((relativePath) => PRODUCTION_FILE_RE.test(relativePath))
    .filter((relativePath) => !TEST_OR_DECLARATION_FILE_RE.test(relativePath))
    .filter((relativePath) => !GENERATED_OR_FIXTURE_PATH_RE.test(relativePath))
    .filter((relativePath) => fs.existsSync(path.join(rootDir, relativePath)))
    .sort();

const countLines = (text) => {
  if (text.length === 0) return 0;
  const lineCount = text.split(/\r?\n/).length;
  return /\r?\n$/.test(text) ? lineCount - 1 : lineCount;
};

const readBaseLineCount = (baseCommit, relativePath, rootDir = ROOT_DIR) => {
  if (!baseCommit) return null;
  try {
    return countLines(gitOutput(['show', `${baseCommit}:${relativePath}`], rootDir));
  } catch {
    return null;
  }
};

const evaluateLargeFilePolicy = (records) => {
  const failures = [];

  for (const { relativePath, currentLineCount, baseLineCount } of records) {
    if (currentLineCount > HARD_FILE_LINE_LIMIT) {
      failures.push(`${relativePath} has ${currentLineCount} lines; the hard limit is ${HARD_FILE_LINE_LIMIT}.`);
      continue;
    }

    if (baseLineCount == null) {
      if (currentLineCount > NEW_FILE_LINE_LIMIT) {
        failures.push(
          `${relativePath} is a new ${currentLineCount}-line file; new files may not exceed ${NEW_FILE_LINE_LIMIT} lines.`,
        );
      }
      continue;
    }

    if (currentLineCount <= LARGE_FILE_LINE_LIMIT) continue;
    const allowance = Math.max(MIN_GROWTH_ALLOWANCE, Math.ceil(baseLineCount * GROWTH_ALLOWANCE_RATIO));
    if (currentLineCount > baseLineCount + allowance) {
      failures.push(
        `${relativePath} grew from ${baseLineCount} to ${currentLineCount} lines; ` +
          `the allowed change from this base is ${allowance} lines.`,
      );
    }
  }

  return failures;
};

test('large-file policy rejects new monoliths and material growth', () => {
  assert.deepEqual(
    evaluateLargeFilePolicy([
      { relativePath: 'hard.ts', baseLineCount: 4999, currentLineCount: 5001 },
      { relativePath: 'new.ts', baseLineCount: null, currentLineCount: 1501 },
      { relativePath: 'fixed-growth.ts', baseLineCount: 1000, currentLineCount: 1101 },
      { relativePath: 'ratio-growth.ts', baseLineCount: 2000, currentLineCount: 2201 },
    ]),
    [
      'hard.ts has 5001 lines; the hard limit is 5000.',
      'new.ts is a new 1501-line file; new files may not exceed 1500 lines.',
      'fixed-growth.ts grew from 1000 to 1101 lines; the allowed change from this base is 100 lines.',
      'ratio-growth.ts grew from 2000 to 2201 lines; the allowed change from this base is 200 lines.',
    ],
  );
});

test('large-file policy accepts bounded growth and shrinking files', () => {
  assert.deepEqual(
    evaluateLargeFilePolicy([
      { relativePath: 'new.ts', baseLineCount: null, currentLineCount: 1500 },
      { relativePath: 'fixed-growth.ts', baseLineCount: 1000, currentLineCount: 1100 },
      { relativePath: 'ratio-growth.ts', baseLineCount: 2000, currentLineCount: 2200 },
      { relativePath: 'shrinking.ts', baseLineCount: 3000, currentLineCount: 1200 },
    ]),
    [],
  );
});

test('line counts are independent of a trailing newline', () => {
  assert.equal(countLines('first\nsecond'), 2);
  assert.equal(countLines('first\nsecond\n'), 2);
  assert.equal(countLines('first\r\nsecond\r\n'), 2);
  assert.equal(countLines(''), 0);
});

test('tracked production client files satisfy the base-diff large-file policy', () => {
  const baseCommit = resolveBaseCommit();
  assert.ok(baseCommit, 'A git base commit is required for the large-file policy.');

  const records = listTrackedClientProductionFiles().map((relativePath) => ({
    relativePath,
    currentLineCount: countLines(fs.readFileSync(path.join(ROOT_DIR, relativePath), 'utf8')),
    baseLineCount: readBaseLineCount(baseCommit, relativePath),
  }));

  assert.deepEqual(evaluateLargeFilePolicy(records), []);
});

module.exports = {
  countLines,
  evaluateLargeFilePolicy,
  resolveBaseCommit,
};
