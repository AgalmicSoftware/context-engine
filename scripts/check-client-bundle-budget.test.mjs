import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  __test__clientBundleBudget,
  collectClientBundleBudgetResult,
  formatBundleBudgetPolicyMarkdown,
} from './check-client-bundle-budget.mjs';

const {
  GENERATED_POLICY_END,
  GENERATED_POLICY_START,
} = __test__clientBundleBudget;

function writeFile(rootDir, relativePath, contents) {
  const target = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function fixtureBudget() {
  return {
    schemaVersion: 1,
    warningRatio: 0.95,
    entry: { sources: ['index.html'], includeDirectDynamicImports: true, maxGzipBytes: 400 },
    nonVendorChunk: { maxMinifiedBytes: 100, vendorFilePrefixes: ['assets/vendor-'] },
    exceptions: [{
      id: 'app-shell-temporary',
      filePrefix: 'assets/AppShell-',
      maxMinifiedBytes: 150,
      owner: 'docs/bundle-budget.md#temporary-appshell-exception',
    }],
    duplicateAssets: { allowedPairs: [] },
  };
}

function patternedBytes(length) {
  return Buffer.from(Array.from({ length }, (_value, index) => index % 251));
}

function noisyBytes(length) {
  let state = 0x12345678;
  return Buffer.from(Array.from({ length }, () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state & 0xff;
  }));
}

function createFixture(rootDir, overrides = {}) {
  const budget = fixtureBudget();
  const files = {
    'assets/bootstrap-a1.js': patternedBytes(60),
    'assets/index-b2.js': patternedBytes(200),
    'assets/AppShell-c3.js': patternedBytes(overrides.exceptionBytes || 140),
    'assets/Route-d4.js': patternedBytes(overrides.routeBytes || 80),
    'assets/vendor-react-e5.js': patternedBytes(500),
  };
  Object.entries(files).forEach(([relativePath, contents]) => (
    writeFile(rootDir, `client/build/${relativePath}`, contents)
  ));
  const manifest = {
    'index.html': {
      file: 'assets/bootstrap-a1.js',
      isEntry: true,
      dynamicImports: ['_index-b2.js'],
    },
    '_index-b2.js': { file: 'assets/index-b2.js', isDynamicEntry: true },
    '_AppShell-c3.js': { file: 'assets/AppShell-c3.js', isDynamicEntry: true },
  };
  if (overrides.omitException) delete manifest['_AppShell-c3.js'];
  writeFile(rootDir, 'client/build/vite-bundle-manifest.json', `${JSON.stringify(manifest)}\n`);
  writeFile(rootDir, 'scripts/client-bundle-budget.json', `${JSON.stringify(budget)}\n`);
  writeFile(
    rootDir,
    'docs/bundle-budget.md',
    `${GENERATED_POLICY_START}\n${formatBundleBudgetPolicyMarkdown(budget)}\n${GENERATED_POLICY_END}\n`,
  );
  return budget;
}

function withFixture(run, overrides) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-bundle-budget-'));
  try {
    createFixture(rootDir, overrides);
    return run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('passes hashed entry, vendor, general, and named-exception outputs', () => withFixture((rootDir) => {
  const result = collectClientBundleBudgetResult({ repoDir: rootDir });
  assert.deepEqual(result.findings, []);
  assert.equal(result.entries.length, 2);
  assert.equal(result.exceptions[0].file, 'assets/AppShell-c3.js');
  assert.equal(result.chunks.length, 1);
}));

test('warns at 95 percent and fails above the general non-vendor cap', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'client/build/assets/Route-d4.js', patternedBytes(95));
    const warning = collectClientBundleBudgetResult({ repoDir: rootDir });
    assert.equal(warning.findings.length, 0);
    assert.ok(warning.warnings.some((entry) => entry.includes('Route-d4.js')));

    writeFile(rootDir, 'client/build/assets/Route-d4.js', patternedBytes(101));
    const failure = collectClientBundleBudgetResult({ repoDir: rootDir });
    assert.ok(failure.findings.some((entry) => entry.includes('Route-d4.js')));
  });
});

test('fails when the manifest-discovered dynamic application entry exceeds its gzip cap', () => withFixture((rootDir) => {
  writeFile(rootDir, 'client/build/assets/index-b2.js', noisyBytes(800));
  const result = collectClientBundleBudgetResult({ repoDir: rootDir });
  assert.ok(result.findings.some((entry) => (
    entry.includes('entry gzip assets/index-b2.js') && entry.includes('exceeds')
  )));
}));

test('fails a named exception above its fixed ceiling and when its manifest source disappears', () => {
  withFixture((rootDir) => {
    writeFile(rootDir, 'client/build/assets/AppShell-c3.js', patternedBytes(151));
    const over = collectClientBundleBudgetResult({ repoDir: rootDir });
    assert.ok(over.findings.some((entry) => entry.includes('exception app-shell-temporary')));
  });
  withFixture((rootDir) => {
    const missing = collectClientBundleBudgetResult({ repoDir: rootDir });
    assert.ok(missing.findings.some((entry) => entry.includes('expected exactly one manifest output')));
  }, { omitException: true });
});

test('fails byte-identical emitted and compatibility images without an explicit pair', () => withFixture((rootDir) => {
  const image = patternedBytes(64);
  writeFile(rootDir, 'client/build/assets/logo-a1.png', image);
  writeFile(rootDir, 'client/build/images/logo.png', image);
  const result = collectClientBundleBudgetResult({ repoDir: rootDir });
  assert.equal(result.duplicateBytes, 64);
  assert.deepEqual(result.duplicatePairs, [{
    emittedFile: 'assets/logo-a1.png',
    compatibilityFile: 'images/logo.png',
    bytes: 64,
  }]);
}));

test('fails when the generated documentation policy drifts from the budget data', () => withFixture((rootDir) => {
  writeFile(rootDir, 'docs/bundle-budget.md', `${GENERATED_POLICY_START}\nstale\n${GENERATED_POLICY_END}\n`);
  const result = collectClientBundleBudgetResult({ repoDir: rootDir });
  assert.ok(result.findings.includes('bundle budget documentation policy snapshot is stale'));
}));
