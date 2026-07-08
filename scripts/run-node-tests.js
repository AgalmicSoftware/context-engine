'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const {
  ROOT_NODE_TEST_FILES,
  ROOT_PRIVATE_STRIPPED_TEST_FILE_RE,
} = require('./testInventoryConfig');

const STATIC_NODE_TEST_FILES = ROOT_NODE_TEST_FILES;

const NODE_TEST_FILE_RE = /\.test\.(?:c?js|mjs)$/;

function readOptionalTestDir(rootDir, relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(absoluteDir) || !fs.statSync(absoluteDir).isDirectory()) {
    return [];
  }

  return fs.readdirSync(absoluteDir)
    .filter((entry) => NODE_TEST_FILE_RE.test(entry))
    .sort()
    .map((entry) => path.join(relativeDir, entry));
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

  files.push(
    ...readOptionalTestDir(rootDir, path.join('tests', 'root'))
      .filter((relativePath) => ROOT_PRIVATE_STRIPPED_TEST_FILE_RE.test(relativePath)),
  );
  files.push(...readOptionalTestDir(rootDir, 'scripts'));
  files.push(...readOptionalTestDir(rootDir, path.join('scripts', 'lib', 'e2e')));

  if (!options.trackedOnly) {
    return files;
  }

  const trackedFiles = listTrackedFiles(rootDir);
  return files.filter((relativePath) => trackedFiles.has(relativePath.split(path.sep).join('/')));
}

function parseRunNodeTestsArgs(argv = process.argv.slice(2), env = process.env) {
  const trackedOnly = argv.includes('--tracked-only') || env.CE_NODE_TESTS_TRACKED_ONLY === '1';
  const unknownArgs = argv.filter((arg) => arg !== '--tracked-only');

  return {
    trackedOnly,
    unknownArgs,
  };
}

function runNodeTests(rootDir = path.resolve(__dirname, '..'), options = {}) {
  const files = collectNodeTestFiles(rootDir, options);
  if (!files.length) {
    console.error('No node test files found.');
    return 1;
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
  runNodeTests,
};
