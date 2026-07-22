'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CLIENT_COVERAGE_EXCLUSION_RULES,
  JEST_COLLECT_COVERAGE_FROM,
  classifyClientCoveragePath,
} = require('./clientCoverageUniverse');

test('coverage universe includes executable production owners', () => {
  for (const file of [
    'client/src/index.tsx',
    'client/src/bootRecovery.ts',
    'client/src/components/MainSite/AppShell.tsx',
    'client/src/utilities/web3/rpcDefaults.js',
  ]) {
    assert.deepEqual(classifyClientCoveragePath(file), { included: true, reason: 'production' });
  }
});

test('coverage universe excludes only documented non-production classes', () => {
  const cases = new Map([
    ['client/src/components/MainSite/routeTable.test.ts', 'test-source'],
    ['client/src/components/MainSite/__tests__/routeTable.ts', 'test-source'],
    ['client/src/types/audio-vendors.d.ts', 'declaration'],
    ['client/src/setupTests.ts', 'test-setup'],
    ['client/src/components/SBTs/SBTSelector.testUtils.ts', 'test-helper'],
    ['client/src/components/SurveyTool/surveyQuestionsTestHarness.tsx', 'test-helper'],
  ]);

  for (const [file, reason] of cases) {
    assert.deepEqual(classifyClientCoveragePath(file), { included: false, reason });
  }
  assert.equal(new Set(CLIENT_COVERAGE_EXCLUSION_RULES.map((rule) => rule.id)).size, CLIENT_COVERAGE_EXCLUSION_RULES.length);
});

test('Jest collection patterns keep one broad include and named exclusions', () => {
  assert.equal(JEST_COLLECT_COVERAGE_FROM[0], 'src/**/*.{js,jsx,ts,tsx}');
  assert.ok(JEST_COLLECT_COVERAGE_FROM.every((pattern) => typeof pattern === 'string' && pattern.length > 0));
  assert.ok(JEST_COLLECT_COVERAGE_FROM.slice(1).every((pattern) => pattern.startsWith('!')));
});
