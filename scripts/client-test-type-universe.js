'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const TYPED_TEST_SOURCE_RE = /\.(?:test|spec)\.(?:ts|tsx)$/;
const TYPED_TEST_HELPER_RE = /(?:testUtils|TestUtils|testHarness|TestHarness|testHelpers?|TestHelpers?)\.(?:ts|tsx)$/;

const CLIENT_TEST_TYPE_CONTRACT = Object.freeze({
  schemaVersion: 1,
  classifications: Object.freeze([
    Object.freeze({ id: 'test-source', pattern: 'client/src/**/*.{test,spec}.{ts,tsx}' }),
    Object.freeze({ id: 'test-helper', pattern: 'client/src/**/*{testUtils,TestUtils,testHarness,TestHarness,testHelper,testHelpers,TestHelper,TestHelpers}.{ts,tsx}' }),
    Object.freeze({ id: 'test-setup', pattern: 'client/src/setupTests.ts' }),
  ]),
  explicitExclusions: Object.freeze([]),
});

function normalizeRepoPath(value) {
  return String(value || '').split(path.sep).join('/').replace(/^\.\//, '');
}

function classifyClientTestTypePath(relativePath) {
  const normalized = normalizeRepoPath(relativePath);
  if (normalized === 'client/src/setupTests.ts') return { included: true, reason: 'test-setup' };
  if (!/^client\/src\/.+\.(?:ts|tsx)$/.test(normalized)) {
    return { included: false, reason: 'outside-typed-client-source' };
  }
  if (TYPED_TEST_SOURCE_RE.test(normalized)) return { included: true, reason: 'test-source' };
  if (TYPED_TEST_HELPER_RE.test(normalized)) return { included: true, reason: 'test-helper' };
  return { included: false, reason: 'production-source' };
}

function listTrackedClientTestTypeFiles(rootDir) {
  const output = execFileSync('git', ['ls-files', '-z', '--', 'client/src'], {
    cwd: rootDir,
    encoding: 'buffer',
  }).toString('utf8');
  return output.split('\0')
    .filter(Boolean)
    .map(normalizeRepoPath)
    .filter((relativePath) => fs.existsSync(path.join(rootDir, relativePath)))
    .filter((relativePath) => classifyClientTestTypePath(relativePath).included)
    .sort();
}

module.exports = {
  CLIENT_TEST_TYPE_CONTRACT,
  classifyClientTestTypePath,
  listTrackedClientTestTypeFiles,
  normalizeRepoPath,
};
