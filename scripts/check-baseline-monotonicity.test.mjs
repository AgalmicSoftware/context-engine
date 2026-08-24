import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  BASELINE_GROWTH_APPROVAL_LABEL,
  collectBaselineMonotonicityFindings,
} from './check-baseline-monotonicity.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.join(__dirname, 'check-baseline-monotonicity.mjs');

function git(repoDir, args) {
  return execFileSync('git', args, {
    cwd: repoDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function writeJson(repoDir, relativePath, value) {
  const absolutePath = path.join(repoDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeBaselines(
  repoDir,
  {
    violations,
    counts,
    legacyCoverage = { statements: 75.7, branches: 61, functions: 77, lines: 79.1 },
    fullCoverage = { statements: 70, branches: 55, functions: 70, lines: 72 },
    coverageRules = [{ id: 'test-source', jestPatterns: ['!src/**/*.test.ts'], reason: 'tests' }],
    coverageExceptions = [],
    legacyCoverageFiles = ['client/src/imported.ts'],
    typedDiagnostics = [{ signature: 'src/example.test.ts|TS2322|fixture', count: 1 }],
    typedClassifications = [{ id: 'test-source', pattern: 'client/src/**/*.test.ts' }],
    typedExclusions = [],
    bundleBudget = {
      warningRatio: 0.95,
      entry: { sources: ['index.html'], includeDirectDynamicImports: true, maxGzipBytes: 250000 },
      nonVendorChunk: { maxMinifiedBytes: 500000, vendorFilePrefixes: ['assets/vendor-'] },
      exceptions: [{ id: 'app-shell', filePrefix: 'assets/AppShell-', maxMinifiedBytes: 625000 }],
      duplicateAssets: { allowedPairs: [] },
    },
  },
) {
  writeJson(repoDir, 'scripts/client-boundaries-baseline.json', {
    version: 1,
    mode: 'fail-on-new-violation',
    violations,
  });
  writeJson(repoDir, 'scripts/type-debt-baseline.json', {
    counts,
  });
  writeJson(repoDir, 'scripts/coverage-baseline.json', { global: legacyCoverage });
  writeJson(repoDir, 'scripts/client-coverage-full-baseline.json', { global: fullCoverage });
  writeJson(repoDir, 'scripts/client-coverage-exclusions.json', {
    rules: coverageRules,
    explicitProductionFileExceptions: coverageExceptions,
  });
  writeJson(repoDir, 'scripts/client-coverage-legacy-files.json', { files: legacyCoverageFiles });
  writeJson(repoDir, 'scripts/client-test-type-diagnostics-baseline.json', { diagnostics: typedDiagnostics });
  writeJson(repoDir, 'scripts/client-test-type-contract.json', {
    classifications: typedClassifications,
    explicitExclusions: typedExclusions,
  });
  writeJson(repoDir, 'scripts/client-bundle-budget.json', bundleBudget);
}

function commitAll(repoDir, message) {
  git(repoDir, ['add', '-A']);
  git(repoDir, ['commit', '--quiet', '-m', message]);
}

function withTempRepo(run) {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-baseline-monotonicity-'));
  try {
    git(repoDir, ['init', '--initial-branch=main']);
    git(repoDir, ['config', 'user.name', 'Baseline Tester']);
    git(repoDir, ['config', 'user.email', '[redacted-email]']);
    return run(repoDir);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
}

const BASE_VIOLATION = {
  rule: 'route-page-no-low-level',
  source: 'client/src/components/Page.tsx',
  import: '../../utilities/web3/chainGateway.js',
  resolved: 'client/src/utilities/web3/contractScripts',
};

const NEW_VIOLATION = {
  rule: 'route-page-no-low-level',
  source: 'client/src/components/NewPage.tsx',
  import: '../../utilities/worker/workerAuth.js',
  resolved: 'client/src/utilities/worker/workerAuth',
};

test('passes when baselines stay flat or shrink', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [BASE_VIOLATION],
      counts: { colonAny: 4, asAny: 2 },
    });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 3, asAny: 2 },
    });

    const result = collectBaselineMonotonicityFindings({ repoDir, baseRef: base });
    assert.equal(result.skipped, false);
    assert.deepEqual(result.boundaryGains, []);
    assert.deepEqual(result.typeDebtIncreases, []);
  });
});

test('reports boundary gains and type-debt increases', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [BASE_VIOLATION],
      counts: { colonAny: 4, asAny: 2 },
    });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeBaselines(repoDir, {
      violations: [BASE_VIOLATION, NEW_VIOLATION],
      counts: { colonAny: 5, asAny: 2 },
    });

    const result = collectBaselineMonotonicityFindings({ repoDir, baseRef: base });
    assert.equal(result.skipped, false);
    assert.deepEqual(result.boundaryGains.map((violation) => violation.source), [
      NEW_VIOLATION.source,
    ]);
    assert.deepEqual(result.typeDebtIncreases, [
      { pattern: 'colonAny', base: 4, current: 5 },
    ]);
  });
});

test('reports lowered coverage floors, broadened exclusions, and legacy-universe gains', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
    });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
      legacyCoverage: { statements: 75.6, branches: 61, functions: 77, lines: 79.1 },
      fullCoverage: { statements: 69.9, branches: 55, functions: 70, lines: 72 },
      coverageRules: [
        { id: 'test-source', jestPatterns: ['!src/**/*.test.ts'], reason: 'tests' },
        { id: 'new-exclusion', jestPatterns: ['!src/legacy/**'], reason: 'broader' },
      ],
      coverageExceptions: ['client/src/legacy/owner.ts'],
      legacyCoverageFiles: ['client/src/imported.ts', 'client/src/newly-added.ts'],
    });

    const result = collectBaselineMonotonicityFindings({ repoDir, baseRef: base });
    assert.deepEqual(result.coverageRegressions.map((entry) => entry.kind), [
      'legacy-floor-decrease',
      'full-floor-decrease',
      'exclusion-rule-gain',
      'exclusion-exception-gain',
      'legacy-file-gain',
    ]);
  });
});

test('verified approval cannot permit coverage-contract regression', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, { violations: [], counts: { colonAny: 0 } });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();
    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
      fullCoverage: { statements: 69, branches: 55, functions: 70, lines: 72 },
    });

    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--repo', repoDir,
      '--base', base,
      '--approval', 'approved',
    ], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /coverage contract regression cannot be approved/i);
  });
});

test('reports typed-test diagnostic growth, classification loss, and contract exclusions', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, { violations: [], counts: { colonAny: 0 } });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();
    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
      typedDiagnostics: [
        { signature: 'src/example.test.ts|TS2322|fixture', count: 2 },
        { signature: 'src/new.test.ts|TS2345|new', count: 1 },
      ],
      typedClassifications: [],
      typedExclusions: ['client/src/legacy.test.ts'],
    });

    const result = collectBaselineMonotonicityFindings({ repoDir, baseRef: base });
    assert.deepEqual(result.testTypeRegressions.map((entry) => entry.kind), [
      'typed-diagnostic-gain',
      'typed-diagnostic-gain',
      'typed-classification-loss',
      'typed-exclusion-gain',
    ]);
  });
});

test('legacy coverage inventory can shrink only when the production file is deleted', () => {
  withTempRepo((repoDir) => {
    fs.mkdirSync(path.join(repoDir, 'client/src'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'client/src/imported.ts'), 'export const imported = true;\n');
    writeBaselines(repoDir, { violations: [], counts: { colonAny: 0 } });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
      legacyCoverageFiles: [],
    });
    let result = collectBaselineMonotonicityFindings({ repoDir, baseRef: base });
    assert.deepEqual(result.coverageRegressions, [{
      kind: 'legacy-live-file-loss',
      relativePath: 'client/src/imported.ts',
    }]);

    fs.rmSync(path.join(repoDir, 'client/src/imported.ts'));
    result = collectBaselineMonotonicityFindings({ repoDir, baseRef: base });
    assert.deepEqual(result.coverageRegressions, []);
  });
});

test('reports every bundle-budget cap and classification loosening', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, { violations: [], counts: { colonAny: 0 } });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
      bundleBudget: {
        warningRatio: 0.96,
        entry: {
          sources: ['index.html', 'src/new-entry.ts'],
          includeDirectDynamicImports: true,
          maxGzipBytes: 250001,
        },
        nonVendorChunk: {
          maxMinifiedBytes: 500001,
          vendorFilePrefixes: ['assets/vendor-', 'assets/hidden-'],
        },
        exceptions: [
          { id: 'app-shell', filePrefix: 'assets/RenamedShell-', maxMinifiedBytes: 625001 },
          { id: 'new-exception', filePrefix: 'assets/LargeRoute-', maxMinifiedBytes: 700000 },
        ],
        duplicateAssets: { allowedPairs: ['assets/logo-a.png|images/logo.png'] },
      },
    });
    const result = collectBaselineMonotonicityFindings({ repoDir, baseRef: base });
    assert.deepEqual(result.bundleBudgetRegressions.map((entry) => entry.kind), [
      'bundle-entry-cap-increase',
      'bundle-chunk-cap-increase',
      'bundle-warning-ratio-increase',
      'bundle-entry-source-gain',
      'bundle-vendor-prefix-gain',
      'bundle-duplicate-allowlist-gain',
      'bundle-exception-selector-change',
      'bundle-exception-cap-increase:app-shell',
      'bundle-exception-gain',
    ]);
  });
});

test('verified approval cannot permit a bundle-budget regression', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, { violations: [], counts: { colonAny: 0 } });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();
    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
      bundleBudget: {
        warningRatio: 0.95,
        entry: { sources: ['index.html'], includeDirectDynamicImports: true, maxGzipBytes: 250001 },
        nonVendorChunk: { maxMinifiedBytes: 500000, vendorFilePrefixes: ['assets/vendor-'] },
        exceptions: [{ id: 'app-shell', filePrefix: 'assets/AppShell-', maxMinifiedBytes: 625000 }],
        duplicateAssets: { allowedPairs: [] },
      },
    });
    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--repo', repoDir,
      '--base', base,
      '--approval', 'approved',
    ], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /bundle-budget regression cannot be approved/i);
  });
});

test('verified maintainer approval lets intentional boundary and type-debt growth pass', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
    });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeBaselines(repoDir, {
      violations: [NEW_VIOLATION],
      counts: { colonAny: 1 },
    });

    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--repo',
      repoDir,
      '--base',
      base,
      '--approval',
      'approved',
    ], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Baseline growth allowed/);
  });
});

test('cli fails without verified approval when baselines grow', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
    });
    commitAll(repoDir, 'base baselines');
    const base = git(repoDir, ['rev-parse', 'HEAD']).trim();

    writeBaselines(repoDir, {
      violations: [NEW_VIOLATION],
      counts: { colonAny: 1 },
    });

    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--repo',
      repoDir,
      '--base',
      base,
    ], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Baseline monotonicity check failed/);
    assert.match(result.stderr, /client-boundaries-baseline\.json gained 1 violation/);
    assert.match(result.stderr, /type-debt-baseline\.json increased 1 count/);
  });
});

test('missing base ref fails closed with a notice', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
    });
    commitAll(repoDir, 'base baselines');

    const result = collectBaselineMonotonicityFindings({
      repoDir,
      baseRef: 'missing-base-ref',
    });

    assert.equal(result.skipped, false);
    assert.equal(result.failed, true);
    assert.match(result.notices.join('\n'), /missing-base-ref/);

    const cli = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--repo',
      repoDir,
      '--base',
      'missing-base-ref',
    ], { encoding: 'utf8' });
    assert.equal(cli.status, 1);
    assert.match(cli.stderr, /base ref.*was not available/i);
  });
});

test('required base SHA rejects symbolic refs before comparison', () => {
  withTempRepo((repoDir) => {
    writeBaselines(repoDir, {
      violations: [],
      counts: { colonAny: 0 },
    });
    commitAll(repoDir, 'base baselines');

    const result = spawnSync(process.execPath, [
      SCRIPT_PATH,
      '--repo',
      repoDir,
      '--base',
      'HEAD',
      '--require-base-sha',
    ], { encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /must be an exact 40-character commit SHA/i);
  });
});

test('author-controlled marker text is no longer an accepted option', () => {
  const result = spawnSync(process.execPath, [
    SCRIPT_PATH,
    '--allow-text',
    '[allow-baseline-growth]',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown option: --allow-text/);
});

test('help documents the maintainer label and CODEOWNER approval gate', () => {
  const result = spawnSync(process.execPath, [SCRIPT_PATH, '--help'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(BASELINE_GROWTH_APPROVAL_LABEL));
  assert.match(result.stdout, /CODEOWNER review/i);
  assert.doesNotMatch(result.stdout, /allow-baseline-growth/);
});
