'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  CLIENT_TEST_TYPE_CONTRACT,
  classifyClientTestTypePath,
  listTrackedClientTestTypeFiles,
} = require('./clientTestTypeUniverse');
const trackedContract = require('./client-test-type-contract.json');

test('typed-test classifier includes tests, setup, and named helpers without exclusions', () => {
  const cases = new Map([
    ['client/src/components/About/AboutPage.test.tsx', 'test-source'],
    ['client/src/components/DocumentLibrary/DocumentLibraryPanel.testUtils.tsx', 'test-helper'],
    ['client/src/components/SurveyTool/surveyQuestionsTestHarness.tsx', 'test-helper'],
    ['client/src/setupTests.ts', 'test-setup'],
  ]);
  for (const [relativePath, reason] of cases) {
    assert.deepEqual(classifyClientTestTypePath(relativePath), { included: true, reason });
  }
  assert.deepEqual(CLIENT_TEST_TYPE_CONTRACT.explicitExclusions, []);
  assert.deepEqual(CLIENT_TEST_TYPE_CONTRACT, trackedContract);
});

test('every tracked typed test and named helper is classified', () => {
  const files = listTrackedClientTestTypeFiles(process.cwd());
  assert.ok(files.length > 800);
  assert.ok(files.every((relativePath) => classifyClientTestTypePath(relativePath).included));
});

test('typed-test inventory ignores tracked files deleted in the working tree', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-typed-test-inventory-'));
  try {
    const presentPath = 'client/src/present.test.ts';
    const deletedPath = 'client/src/deleted.test.ts';
    fs.mkdirSync(path.join(rootDir, 'client/src'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, presentPath), 'export {};\n');
    fs.writeFileSync(path.join(rootDir, deletedPath), 'export {};\n');
    execFileSync('git', ['init', '--quiet'], { cwd: rootDir });
    execFileSync('git', ['add', presentPath, deletedPath], { cwd: rootDir });
    fs.rmSync(path.join(rootDir, deletedPath));

    assert.deepEqual(listTrackedClientTestTypeFiles(rootDir), [presentPath]);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
