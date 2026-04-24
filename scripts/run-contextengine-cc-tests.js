'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TEST_FILE_RE = /\.test\.(?:c?js|mjs)$/;
const REQUIRED_CONTEXTENGINE_CC_FILES = Object.freeze([
  path.join('contextEngine-cc', 'server.mjs'),
  path.join('contextEngine-cc', 'lib', 'router.mjs'),
  path.join('contextEngine-cc', 'public', 'js', 'sessionSlugs.mjs'),
]);

function walkDir(absoluteDir) {
  if (!fs.existsSync(absoluteDir) || !fs.statSync(absoluteDir).isDirectory()) {
    return [];
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const absolutePath = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        return walkDir(absolutePath);
      }
      return TEST_FILE_RE.test(entry.name) ? [absolutePath] : [];
    });
}

function collectContextEngineCcTestFiles(rootDir = path.resolve(__dirname, '..')) {
  const ccRoot = path.join(rootDir, 'contextEngine-cc');
  return walkDir(ccRoot).map((absolutePath) => path.relative(rootDir, absolutePath));
}

function hasRunnableContextEngineCc(rootDir = path.resolve(__dirname, '..')) {
  return REQUIRED_CONTEXTENGINE_CC_FILES.every((relativePath) =>
    fs.existsSync(path.join(rootDir, relativePath))
  );
}

function runContextEngineCcTests(rootDir = path.resolve(__dirname, '..'), nodeArgs = []) {
  const files = collectContextEngineCcTestFiles(rootDir);
  if (!files.length || !hasRunnableContextEngineCc(rootDir)) {
    console.log('contextEngine-cc runtime or tests unavailable in this checkout; skipping test:cc');
    return 0;
  }

  const result = spawnSync(process.execPath, [...nodeArgs, '--test', ...files], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  return typeof result.status === 'number' ? result.status : 1;
}

if (require.main === module) {
  process.exit(runContextEngineCcTests(path.resolve(__dirname, '..'), process.argv.slice(2)));
}

module.exports = {
  collectContextEngineCcTestFiles,
  hasRunnableContextEngineCc,
  REQUIRED_CONTEXTENGINE_CC_FILES,
  runContextEngineCcTests,
};
