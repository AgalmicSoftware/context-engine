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
const FALLBACK_CONTEXTENGINE_CC_TEST_MARKER = '@contextengine-cc-fallback-test';

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

function collectContextEngineCcFallbackTestFiles(rootDir = path.resolve(__dirname, '..')) {
  return collectContextEngineCcTestFiles(rootDir).filter((relativePath) => {
    const absolutePath = path.join(rootDir, relativePath);
    try {
      return fs.readFileSync(absolutePath, 'utf8').includes(FALLBACK_CONTEXTENGINE_CC_TEST_MARKER);
    } catch {
      return false;
    }
  });
}

function getMissingContextEngineCcFiles(rootDir = path.resolve(__dirname, '..')) {
  return REQUIRED_CONTEXTENGINE_CC_FILES.filter((relativePath) =>
    !fs.existsSync(path.join(rootDir, relativePath))
  );
}

function hasRunnableContextEngineCc(rootDir = path.resolve(__dirname, '..')) {
  return getMissingContextEngineCcFiles(rootDir).length === 0;
}

function runContextEngineCcTests(rootDir = path.resolve(__dirname, '..'), nodeArgs = []) {
  const files = collectContextEngineCcTestFiles(rootDir);
  const missingFiles = getMissingContextEngineCcFiles(rootDir);
  if (!files.length) {
    const reason = 'no contextEngine-cc test files found';
    console.log(`contextEngine-cc runtime or tests unavailable in this checkout; skipping test:cc (${reason})`);
    return 0;
  }

  const runnableFiles = missingFiles.length
    ? collectContextEngineCcFallbackTestFiles(rootDir)
    : files;
  if (missingFiles.length) {
    if (!runnableFiles.length) {
      console.log(`contextEngine-cc runtime files missing and no fallback tests found; skipping test:cc (${missingFiles.join(', ')})`);
      return 0;
    }
    console.log(`contextEngine-cc runtime files missing; running marked fallback tests (${missingFiles.join(', ')})`);
  }

  const result = spawnSync(process.execPath, [...nodeArgs, '--test', ...runnableFiles], {
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
  collectContextEngineCcFallbackTestFiles,
  collectContextEngineCcTestFiles,
  FALLBACK_CONTEXTENGINE_CC_TEST_MARKER,
  getMissingContextEngineCcFiles,
  hasRunnableContextEngineCc,
  REQUIRED_CONTEXTENGINE_CC_FILES,
  runContextEngineCcTests,
};
