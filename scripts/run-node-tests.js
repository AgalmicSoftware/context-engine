'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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

function collectNodeTestFiles(rootDir = path.resolve(__dirname, '..')) {
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

  return files;
}

function runNodeTests(rootDir = path.resolve(__dirname, '..')) {
  const files = collectNodeTestFiles(rootDir);
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
  process.exit(runNodeTests());
}

module.exports = {
  STATIC_NODE_TEST_FILES,
  collectNodeTestFiles,
  runNodeTests,
};
