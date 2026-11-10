'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const EXECUTABLE_CLIENT_FILE_RE = /^client\/src\/.+\.(?:js|jsx|ts|tsx)$/;
const TEST_SOURCE_RE = /(?:^|\/)__tests__\/|\.(?:test|spec)\.(?:js|jsx|ts|tsx)$/;
const TEST_HELPER_RE = /(?:testUtils|TestUtils|testHarness|TestHarness|testHelpers?|TestHelpers?)\.(?:js|jsx|ts|tsx)$/;

const CLIENT_COVERAGE_EXCLUSION_RULES = Object.freeze([
  Object.freeze({
    id: 'test-source',
    jestPatterns: ['!src/**/__tests__/**', '!src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    reason: 'Jest tests/specs are verification sources, not shipped production owners.',
  }),
  Object.freeze({
    id: 'declaration',
    jestPatterns: ['!src/**/*.d.ts'],
    reason: 'TypeScript declarations contain no executable runtime statements.',
  }),
  Object.freeze({
    id: 'test-setup',
    jestPatterns: ['!src/setupTests.ts'],
    reason: 'The Jest environment bootstrap is test-only setup.',
  }),
  Object.freeze({
    id: 'test-helper',
    jestPatterns: [
      '!src/**/*.{testUtils,TestUtils,testHarness,TestHarness,testHelper,testHelpers,TestHelper,TestHelpers}.{js,jsx,ts,tsx}',
    ],
    reason: 'Named test utilities and harnesses are test-only support modules.',
  }),
]);

const JEST_COLLECT_COVERAGE_FROM = Object.freeze([
  'src/**/*.{js,jsx,ts,tsx}',
  ...CLIENT_COVERAGE_EXCLUSION_RULES.flatMap((rule) => rule.jestPatterns),
]);

function normalizeRepoPath(value) {
  return String(value || '').split(path.sep).join('/').replace(/^\.\//, '');
}

function classifyClientCoveragePath(relativePath) {
  const normalized = normalizeRepoPath(relativePath);
  if (!EXECUTABLE_CLIENT_FILE_RE.test(normalized)) {
    return { included: false, reason: 'outside-production-universe' };
  }
  if (TEST_SOURCE_RE.test(normalized)) return { included: false, reason: 'test-source' };
  if (/\.d\.ts$/.test(normalized)) return { included: false, reason: 'declaration' };
  if (normalized === 'client/src/setupTests.ts') return { included: false, reason: 'test-setup' };
  if (TEST_HELPER_RE.test(normalized)) return { included: false, reason: 'test-helper' };
  return { included: true, reason: 'production' };
}

function listTrackedClientCoverageFiles(rootDir) {
  const output = execFileSync('git', ['ls-files', '-z', '--', 'client/src'], {
    cwd: rootDir,
    encoding: 'buffer',
  }).toString('utf8');
  return output.split('\0')
    .filter(Boolean)
    .map(normalizeRepoPath)
    .filter((relativePath) => classifyClientCoveragePath(relativePath).included)
    .sort();
}

module.exports = {
  CLIENT_COVERAGE_EXCLUSION_RULES,
  JEST_COLLECT_COVERAGE_FROM,
  classifyClientCoveragePath,
  listTrackedClientCoverageFiles,
  normalizeRepoPath,
};
