'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const {
  ROOT_NODE_TEST_FILES,
  ROOT_OPTIONAL_NODE_TEST_FILES,
  ROOT_PRIVATE_STRIPPED_TEST_FILE_RE,
} = require('./testInventoryConfig');
const {
  createStripMatcher,
  loadStripPatterns,
} = require('./verify-public-release-surface');

const STATIC_NODE_TEST_FILES = ROOT_NODE_TEST_FILES;

const NODE_TEST_FILE_RE = /\.test\.(?:c?js|mjs)$/;
const SERIAL_NODE_TEST_FILES = new Set([
  path.join('scripts', 'sync-public-history.test.js'),
]);

function readOptionalTestDir(rootDir, relativeDir, { recursive = false } = {}) {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(absoluteDir) || !fs.statSync(absoluteDir).isDirectory()) {
    return [];
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory() && recursive) {
        return readOptionalTestDir(rootDir, relativePath, { recursive: true });
      }
      return entry.isFile() && NODE_TEST_FILE_RE.test(entry.name) ? [relativePath] : [];
    })
    .sort();
}

function listTrackedFiles(rootDir) {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: rootDir,
    encoding: 'buffer',
  }).toString('utf8');
  return new Set(output.split('\0').filter(Boolean));
}

function collectNodeTestFiles(rootDir = path.resolve(__dirname, '..'), options = {}) {
  const files = [];

  STATIC_NODE_TEST_FILES.forEach((relativePath) => {
    if (fs.existsSync(path.join(rootDir, relativePath))) {
      files.push(relativePath);
    }
  });
  files.push(...readOptionalTestDir(rootDir, path.join('workers', 'shared'), { recursive: true }));
  ROOT_OPTIONAL_NODE_TEST_FILES.forEach((relativePath) => {
    if (fs.existsSync(path.join(rootDir, relativePath))) {
      files.push(relativePath);
    }
  });

  files.push(
    ...readOptionalTestDir(rootDir, path.join('tests', 'root'), { recursive: true })
      .filter((relativePath) => ROOT_PRIVATE_STRIPPED_TEST_FILE_RE.test(relativePath)),
  );
  files.push(...readOptionalTestDir(rootDir, 'scripts', { recursive: true }));

  const uniqueFiles = [...new Set(files)];

  const uniqueFiles = [...new Set(files)];

  if (!options.trackedOnly) {
    return uniqueFiles;
  }

  const trackedFiles = listTrackedFiles(rootDir);
  const stripHelper = path.join(rootDir, 'scripts', 'lib', 'public-release-strip-patterns.sh');
  const isStrippedPath = fs.existsSync(stripHelper)
    ? createStripMatcher(loadStripPatterns(rootDir))
    : () => false;

  // Regression guard: the clean-checkout release gate must not execute tests
  // whose helpers are intentionally absent from the public/clean tree.
  return uniqueFiles.filter((relativePath) => {
    const normalized = relativePath.split(path.sep).join('/');
    return trackedFiles.has(normalized) && !isStrippedPath(normalized);
  });
}

function parseRunNodeTestsArgs(argv = process.argv.slice(2), env = process.env) {
  const trackedOnly = argv.includes('--tracked-only') || env.CE_NODE_TESTS_TRACKED_ONLY === '1';
  const unknownArgs = argv.filter((arg) => arg !== '--tracked-only');

  return {
    trackedOnly,
    unknownArgs,
  };
}

function partitionNodeTestFiles(files) {
  return files.reduce((partitioned, relativePath) => {
    if (SERIAL_NODE_TEST_FILES.has(relativePath)) {
      partitioned.serialFiles.push(relativePath);
    } else {
      partitioned.concurrentFiles.push(relativePath);
    }
    return partitioned;
  }, {
    concurrentFiles: [],
    serialFiles: [],
  });
}

function runNodeTestFiles(rootDir, files) {
  if (!files.length) {
    return 0;
  }

  const result = spawnSync(process.execPath, ['--test', ...files], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  return typeof result.status === 'number' ? result.status : 1;
}

function runNodeTests(rootDir = path.resolve(__dirname, '..'), options = {}) {
  const files = collectNodeTestFiles(rootDir, options);
  if (!files.length) {
    console.error('No node test files found.');
    return 1;
  }

  const { concurrentFiles, serialFiles } = partitionNodeTestFiles(files);
  const concurrentStatus = runNodeTestFiles(rootDir, concurrentFiles);
  if (concurrentStatus !== 0) {
    return concurrentStatus;
  }

  for (const relativePath of serialFiles) {
    const serialStatus = runNodeTestFiles(rootDir, [relativePath]);
    if (serialStatus !== 0) {
      return serialStatus;
    }
  }

  return 0;
}

if (require.main === module) {
  const { trackedOnly, unknownArgs } = parseRunNodeTestsArgs();
  if (unknownArgs.length) {
    console.error(`Unknown argument(s): ${unknownArgs.join(', ')}`);
    process.exit(1);
  }
  process.exit(runNodeTests(path.resolve(__dirname, '..'), { trackedOnly }));
}

module.exports = {
  STATIC_NODE_TEST_FILES,
  collectNodeTestFiles,
  listTrackedFiles,
  parseRunNodeTestsArgs,
  partitionNodeTestFiles,
  runNodeTests,
};
