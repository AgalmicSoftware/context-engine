#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const BASELINE_GROWTH_APPROVAL_LABEL = 'baseline-growth-approved';

const BOUNDARY_BASELINE = 'scripts/client-boundaries-baseline.json';
const TYPE_DEBT_BASELINE = 'scripts/type-debt-baseline.json';
const LEGACY_COVERAGE_BASELINE = 'scripts/coverage-baseline.json';
const FULL_COVERAGE_BASELINE = 'scripts/client-coverage-full-baseline.json';
const COVERAGE_EXCLUSIONS_BASELINE = 'scripts/client-coverage-exclusions.json';
const LEGACY_COVERAGE_FILES_BASELINE = 'scripts/client-coverage-legacy-files.json';
const TEST_TYPE_DIAGNOSTICS_BASELINE = 'scripts/client-test-type-diagnostics-baseline.json';
const TEST_TYPE_CONTRACT_BASELINE = 'scripts/client-test-type-contract.json';
const CLIENT_BUNDLE_BUDGET_BASELINE = 'scripts/client-bundle-budget.json';
const COVERAGE_METRICS = ['statements', 'branches', 'functions', 'lines'];

function usage() {
  return `Usage: node scripts/check-baseline-monotonicity.mjs [options]

Fails if baseline files grow relative to a base ref:
  - ${BOUNDARY_BASELINE} must not gain violation entries.
  - ${TYPE_DEBT_BASELINE} must not increase any count.
  - Client coverage floors must not decrease, exclusion rules must not broaden,
    and the fixed legacy comparable file set must not grow.
  - Typed-test diagnostics must not grow, classifications must not shrink, and
    explicit test-source exclusions must not grow.
  - Client bundle caps and warning coverage must not loosen, and exception,
    vendor, entry, or duplicate-asset allowlists must not grow.

Options:
  --base <ref>        Base git ref to compare against. Defaults to
                      BASELINE_MONOTONICITY_BASE or origin/main.
  --repo <path>       Repository root. Defaults to the current working directory.
  --approval <value>  Set to "approved" only from the verified CI approval step.
  --require-base-sha  Require --base to be an exact 40-character commit SHA.
  --help              Show this help.

Approval gate:
  Boundary or type-debt growth requires the ${BASELINE_GROWTH_APPROVAL_LABEL}
  label applied by a maintainer plus a distinct approving CODEOWNER review.
  CI verifies that GitHub metadata before passing --approval approved. Direct
  pushes, coverage contract regressions, and bundle-budget
  regressions cannot use this exception.
`;
}

function parseArgs(argv) {
  const options = {
    baseRef: process.env.BASELINE_MONOTONICITY_BASE || 'origin/main',
    repoDir: process.cwd(),
    approval: process.env.BASELINE_MONOTONICITY_APPROVED || '',
    requireBaseSha: ['1', 'true'].includes(String(process.env.BASELINE_MONOTONICITY_REQUIRE_BASE_SHA || '').toLowerCase()),
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--base') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--base requires a value');
      }
      options.baseRef = argv[index];
    } else if (arg === '--repo') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--repo requires a value');
      }
      options.repoDir = argv[index];
    } else if (arg === '--approval') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--approval requires a value');
      }
      options.approval = argv[index];
    } else if (arg === '--require-base-sha') {
      options.requireBaseSha = true;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  return options;
}

function runGit(repoDir, args) {
  return execFileSync('git', ['-C', repoDir, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function resolveBaseCommit(repoDir, baseRef) {
  try {
    return runGit(repoDir, ['rev-parse', '--verify', `${baseRef}^{commit}`]).trim();
  } catch (_error) {
    return null;
  }
}

function readCurrentJson(repoDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoDir, relativePath), 'utf8'));
}

function readBaseJson(repoDir, baseCommit, relativePath) {
  return JSON.parse(runGit(repoDir, ['show', `${baseCommit}:${relativePath}`]));
}

function stableViolationKey(violation) {
  return JSON.stringify({
    rule: String(violation?.rule ?? ''),
    source: String(violation?.source ?? ''),
    import: String(violation?.import ?? ''),
    resolved: String(violation?.resolved ?? ''),
  });
}

function boundaryViolationGains(baseBaseline, currentBaseline) {
  const baseViolations = Array.isArray(baseBaseline?.violations)
    ? baseBaseline.violations
    : [];
  const currentViolations = Array.isArray(currentBaseline?.violations)
    ? currentBaseline.violations
    : [];
  const baseKeys = new Set(baseViolations.map(stableViolationKey));

  return currentViolations.filter((violation) => !baseKeys.has(stableViolationKey(violation)));
}

function toFiniteCount(value, pattern, baselinePath) {
  const count = Number(value ?? 0);
  if (!Number.isFinite(count)) {
    throw new Error(`${baselinePath} count ${pattern} must be numeric`);
  }
  return count;
}

function typeDebtIncreases(baseBaseline, currentBaseline) {
  const baseCounts = baseBaseline?.counts || {};
  const currentCounts = currentBaseline?.counts || {};
  const patterns = [...new Set([
    ...Object.keys(baseCounts),
    ...Object.keys(currentCounts),
  ])].sort();

  return patterns.flatMap((pattern) => {
    const base = toFiniteCount(baseCounts[pattern], pattern, TYPE_DEBT_BASELINE);
    const current = toFiniteCount(currentCounts[pattern], pattern, TYPE_DEBT_BASELINE);
    return current > base ? [{ pattern, base, current }] : [];
  });
}

function coverageFloorDecreases(baseBaseline, currentBaseline, kind) {
  return COVERAGE_METRICS.flatMap((metric) => {
    const base = Number(baseBaseline?.global?.[metric]);
    const current = Number(currentBaseline?.global?.[metric]);
    if (!Number.isFinite(base) || !Number.isFinite(current)) {
      return [{ kind, metric, base, current }];
    }
    return current < base ? [{ kind, metric, base, current }] : [];
  });
}

function stableCoverageRuleKey(rule) {
  return JSON.stringify({
    id: String(rule?.id || ''),
    jestPatterns: Array.isArray(rule?.jestPatterns) ? rule.jestPatterns.map(String) : [],
    reason: String(rule?.reason || ''),
  });
}

function coverageContractRegressions({
  repoDir,
  baseLegacyCoverage,
  currentLegacyCoverage,
  baseFullCoverage,
  currentFullCoverage,
  baseExclusions,
  currentExclusions,
  baseLegacyFiles,
  currentLegacyFiles,
}) {
  const regressions = baseLegacyCoverage && currentLegacyCoverage
    ? coverageFloorDecreases(
      baseLegacyCoverage,
      currentLegacyCoverage,
      'legacy-floor-decrease',
    )
    : [];
  if (baseFullCoverage && currentFullCoverage) {
    regressions.push(...coverageFloorDecreases(
      baseFullCoverage,
      currentFullCoverage,
      'full-floor-decrease',
    ));
  }
  if (baseExclusions && currentExclusions) {
    const baseRuleKeys = new Set((baseExclusions.rules || []).map(stableCoverageRuleKey));
    (currentExclusions.rules || []).forEach((rule) => {
      if (!baseRuleKeys.has(stableCoverageRuleKey(rule))) {
        regressions.push({ kind: 'exclusion-rule-gain', rule: String(rule?.id || '') });
      }
    });
    const baseExceptions = new Set(baseExclusions.explicitProductionFileExceptions || []);
    (currentExclusions.explicitProductionFileExceptions || []).forEach((relativePath) => {
      if (!baseExceptions.has(relativePath)) {
        regressions.push({ kind: 'exclusion-exception-gain', relativePath });
      }
    });
  }
  if (baseLegacyFiles && currentLegacyFiles) {
    const baseFiles = new Set(baseLegacyFiles.files || []);
    const currentFiles = new Set(currentLegacyFiles.files || []);
    (currentLegacyFiles.files || []).forEach((relativePath) => {
      if (!baseFiles.has(relativePath)) {
        regressions.push({ kind: 'legacy-file-gain', relativePath });
      }
    });
    (baseLegacyFiles.files || []).forEach((relativePath) => {
      if (
        !currentFiles.has(relativePath)
        && fs.existsSync(path.resolve(repoDir, relativePath))
      ) {
        regressions.push({ kind: 'legacy-live-file-loss', relativePath });
      }
    });
  }
  return regressions;
}

function testTypeContractRegressions({
  baseDiagnostics,
  currentDiagnostics,
  baseContract,
  currentContract,
}) {
  const regressions = [];
  if (baseDiagnostics && currentDiagnostics) {
    const baseCounts = new Map((baseDiagnostics.diagnostics || []).map((entry) => [
      String(entry?.signature || ''),
      Number(entry?.count || 0),
    ]));
    (currentDiagnostics.diagnostics || []).forEach((entry) => {
      const signature = String(entry?.signature || '');
      const base = baseCounts.get(signature) || 0;
      const current = Number(entry?.count || 0);
      if (current > base) {
        regressions.push({ kind: 'typed-diagnostic-gain', signature, base, current });
      }
    });
  }
  if (baseContract && currentContract) {
    const stableClassification = (entry) => JSON.stringify({
      id: String(entry?.id || ''),
      pattern: String(entry?.pattern || ''),
    });
    const currentClassifications = new Set((currentContract.classifications || []).map(stableClassification));
    (baseContract.classifications || []).forEach((entry) => {
      if (!currentClassifications.has(stableClassification(entry))) {
        regressions.push({ kind: 'typed-classification-loss', classification: String(entry?.id || '') });
      }
    });
    const baseExclusions = new Set(baseContract.explicitExclusions || []);
    (currentContract.explicitExclusions || []).forEach((relativePath) => {
      if (!baseExclusions.has(relativePath)) {
        regressions.push({ kind: 'typed-exclusion-gain', relativePath });
      }
    });
  }
  return regressions;
}

function clientBundleBudgetRegressions(baseBudget, currentBudget) {
  if (!baseBudget || !currentBudget) return [];
  const regressions = [];
  const compareCap = (kind, base, current) => {
    const baseValue = Number(base);
    const currentValue = Number(current);
    if (!Number.isFinite(baseValue) || !Number.isFinite(currentValue) || currentValue > baseValue) {
      regressions.push({ kind, base: baseValue, current: currentValue });
    }
  };
  compareCap(
    'bundle-entry-cap-increase',
    baseBudget.entry?.maxGzipBytes,
    currentBudget.entry?.maxGzipBytes,
  );
  compareCap(
    'bundle-chunk-cap-increase',
    baseBudget.nonVendorChunk?.maxMinifiedBytes,
    currentBudget.nonVendorChunk?.maxMinifiedBytes,
  );
  compareCap(
    'bundle-warning-ratio-increase',
    baseBudget.warningRatio,
    currentBudget.warningRatio,
  );
  compareCap(
    'bundle-entry-dynamic-import-expansion',
    baseBudget.entry?.includeDirectDynamicImports ? 1 : 0,
    currentBudget.entry?.includeDirectDynamicImports ? 1 : 0,
  );

  const recordGains = (kind, baseValues, currentValues) => {
    const base = new Set(baseValues || []);
    (currentValues || []).forEach((value) => {
      if (!base.has(value)) regressions.push({ kind, value });
    });
  };
  recordGains('bundle-entry-source-gain', baseBudget.entry?.sources, currentBudget.entry?.sources);
  recordGains(
    'bundle-vendor-prefix-gain',
    baseBudget.nonVendorChunk?.vendorFilePrefixes,
    currentBudget.nonVendorChunk?.vendorFilePrefixes,
  );
  recordGains(
    'bundle-duplicate-allowlist-gain',
    baseBudget.duplicateAssets?.allowedPairs,
    currentBudget.duplicateAssets?.allowedPairs,
  );

  const baseExceptions = new Map((baseBudget.exceptions || []).map((entry) => [entry.id, entry]));
  (currentBudget.exceptions || []).forEach((entry) => {
    const base = baseExceptions.get(entry.id);
    if (!base) {
      regressions.push({ kind: 'bundle-exception-gain', value: entry.id });
      return;
    }
    if (entry.filePrefix !== base.filePrefix) {
      regressions.push({
        kind: 'bundle-exception-selector-change',
        value: entry.id,
        base: base.filePrefix,
        current: entry.filePrefix,
      });
    }
    compareCap(
      `bundle-exception-cap-increase:${entry.id}`,
      base.maxMinifiedBytes,
      entry.maxMinifiedBytes,
    );
  });
  return regressions;
}

export function collectBaselineMonotonicityFindings({
  repoDir = process.cwd(),
  baseRef = process.env.BASELINE_MONOTONICITY_BASE || 'origin/main',
  requireBaseSha = false,
} = {}) {
  const resolvedRepoDir = path.resolve(repoDir);
  const notices = [];
  if (requireBaseSha && !/^[0-9a-f]{40}$/i.test(String(baseRef))) {
    notices.push(`Baseline monotonicity failed: base ref "${baseRef}" must be an exact 40-character commit SHA.`);
    return {
      skipped: false,
      failed: true,
      notices,
      boundaryGains: [],
      typeDebtIncreases: [],
      coverageRegressions: [],
      testTypeRegressions: [],
      bundleBudgetRegressions: [],
    };
  }
  const baseCommit = resolveBaseCommit(resolvedRepoDir, baseRef);
  if (!baseCommit) {
    notices.push(`Baseline monotonicity failed: base ref "${baseRef}" was not available.`);
    return {
      skipped: false,
      failed: true,
      notices,
      boundaryGains: [],
      typeDebtIncreases: [],
      coverageRegressions: [],
      testTypeRegressions: [],
      bundleBudgetRegressions: [],
    };
  }

  let baseBoundary;
  let baseTypeDebt;
  try {
    baseBoundary = readBaseJson(resolvedRepoDir, baseCommit, BOUNDARY_BASELINE);
    baseTypeDebt = readBaseJson(resolvedRepoDir, baseCommit, TYPE_DEBT_BASELINE);
  } catch (error) {
    notices.push(`Baseline monotonicity failed: baseline files were not available at ${baseRef}: ${error.message}`);
    return {
      skipped: false,
      failed: true,
      notices,
      boundaryGains: [],
      typeDebtIncreases: [],
      coverageRegressions: [],
      testTypeRegressions: [],
      bundleBudgetRegressions: [],
    };
  }

  const currentBoundary = readCurrentJson(resolvedRepoDir, BOUNDARY_BASELINE);
  const currentTypeDebt = readCurrentJson(resolvedRepoDir, TYPE_DEBT_BASELINE);
  const optionalCoverageBaselines = [
    LEGACY_COVERAGE_BASELINE,
    FULL_COVERAGE_BASELINE,
    COVERAGE_EXCLUSIONS_BASELINE,
    LEGACY_COVERAGE_FILES_BASELINE,
    TEST_TYPE_DIAGNOSTICS_BASELINE,
    TEST_TYPE_CONTRACT_BASELINE,
    CLIENT_BUNDLE_BUDGET_BASELINE,
  ];
  const baseOptionalCoverage = {};
  const currentOptionalCoverage = {};
  optionalCoverageBaselines.forEach((relativePath) => {
    try {
      baseOptionalCoverage[relativePath] = readBaseJson(resolvedRepoDir, baseCommit, relativePath);
    } catch (_error) {
      notices.push(`Baseline monotonicity bootstrap: ${relativePath} was not present at ${baseRef}.`);
    }
    if (fs.existsSync(path.join(resolvedRepoDir, relativePath))) {
      currentOptionalCoverage[relativePath] = readCurrentJson(resolvedRepoDir, relativePath);
    }
  });

  return {
    skipped: false,
    failed: false,
    notices,
    boundaryGains: boundaryViolationGains(baseBoundary, currentBoundary),
    typeDebtIncreases: typeDebtIncreases(baseTypeDebt, currentTypeDebt),
    coverageRegressions: coverageContractRegressions({
      repoDir: resolvedRepoDir,
      baseLegacyCoverage: baseOptionalCoverage[LEGACY_COVERAGE_BASELINE],
      currentLegacyCoverage: currentOptionalCoverage[LEGACY_COVERAGE_BASELINE],
      baseFullCoverage: baseOptionalCoverage[FULL_COVERAGE_BASELINE],
      currentFullCoverage: currentOptionalCoverage[FULL_COVERAGE_BASELINE],
      baseExclusions: baseOptionalCoverage[COVERAGE_EXCLUSIONS_BASELINE],
      currentExclusions: currentOptionalCoverage[COVERAGE_EXCLUSIONS_BASELINE],
      baseLegacyFiles: baseOptionalCoverage[LEGACY_COVERAGE_FILES_BASELINE],
      currentLegacyFiles: currentOptionalCoverage[LEGACY_COVERAGE_FILES_BASELINE],
    }),
    testTypeRegressions: testTypeContractRegressions({
      baseDiagnostics: baseOptionalCoverage[TEST_TYPE_DIAGNOSTICS_BASELINE],
      currentDiagnostics: currentOptionalCoverage[TEST_TYPE_DIAGNOSTICS_BASELINE],
      baseContract: baseOptionalCoverage[TEST_TYPE_CONTRACT_BASELINE],
      currentContract: currentOptionalCoverage[TEST_TYPE_CONTRACT_BASELINE],
    }),
    bundleBudgetRegressions: clientBundleBudgetRegressions(
      baseOptionalCoverage[CLIENT_BUNDLE_BUDGET_BASELINE],
      currentOptionalCoverage[CLIENT_BUNDLE_BUDGET_BASELINE],
    ),
  };
}

function formatBoundaryGain(violation) {
  return [
    violation.rule,
    violation.source,
    violation.import,
    violation.resolved,
  ].map((part) => String(part ?? '')).join(' | ');
}

function formatTypeDebtIncrease(increase) {
  return `${increase.pattern}: ${increase.base} -> ${increase.current}`;
}

function printFindings(result, writeLine) {
  if (result.boundaryGains.length > 0) {
    writeLine(`${BOUNDARY_BASELINE} gained ${result.boundaryGains.length} violation entr${result.boundaryGains.length === 1 ? 'y' : 'ies'}:`);
    result.boundaryGains.forEach((violation) => {
      writeLine(`  - ${formatBoundaryGain(violation)}`);
    });
  }

  if (result.typeDebtIncreases.length > 0) {
    writeLine(`${TYPE_DEBT_BASELINE} increased ${result.typeDebtIncreases.length} count${result.typeDebtIncreases.length === 1 ? '' : 's'}:`);
    result.typeDebtIncreases.forEach((increase) => {
      writeLine(`  - ${formatTypeDebtIncrease(increase)}`);
    });
  }

  if (result.coverageRegressions.length > 0) {
    writeLine(`Client coverage contract regressed in ${result.coverageRegressions.length} place${result.coverageRegressions.length === 1 ? '' : 's'}:`);
    result.coverageRegressions.forEach((regression) => {
      const detail = regression.metric
        ? `${regression.metric}: ${regression.base} -> ${regression.current}`
        : (regression.relativePath || regression.rule || 'invalid coverage contract');
      writeLine(`  - ${regression.kind}: ${detail}`);
    });
  }
  if (result.testTypeRegressions.length > 0) {
    writeLine(`Typed-test contract regressed in ${result.testTypeRegressions.length} place${result.testTypeRegressions.length === 1 ? '' : 's'}:`);
    result.testTypeRegressions.forEach((regression) => {
      writeLine(`  - ${regression.kind}: ${regression.signature || regression.relativePath || regression.classification}`);
    });
  }
  if (result.bundleBudgetRegressions.length > 0) {
    writeLine(`Client bundle budget regressed in ${result.bundleBudgetRegressions.length} place${result.bundleBudgetRegressions.length === 1 ? '' : 's'}:`);
    result.bundleBudgetRegressions.forEach((regression) => {
      const detail = regression.value || `${regression.base} -> ${regression.current}`;
      writeLine(`  - ${regression.kind}: ${detail}`);
    });
  }
}

export function hasBaselineGrowth(result) {
  return result.boundaryGains.length > 0
    || result.typeDebtIncreases.length > 0
    || result.coverageRegressions.length > 0
    || result.testTypeRegressions.length > 0
    || result.bundleBudgetRegressions.length > 0;
}

function runCli(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    return 2;
  }

  if (options.help) {
    process.stdout.write(usage());
    return 0;
  }

  const result = collectBaselineMonotonicityFindings({
    repoDir: options.repoDir,
    baseRef: options.baseRef,
    requireBaseSha: options.requireBaseSha,
  });

  if (result.failed) {
    result.notices.forEach((notice) => console.error(notice));
    return 1;
  }

  result.notices.forEach((notice) => {
    console.log(`notice: ${notice}`);
  });

  if (!hasBaselineGrowth(result)) {
    console.log(`Baseline monotonicity check passed against ${options.baseRef}.`);
    return 0;
  }

  const approved = options.approval === 'approved';
  if (
    approved
    && result.coverageRegressions.length === 0
    && result.testTypeRegressions.length === 0
    && result.bundleBudgetRegressions.length === 0
  ) {
    console.log(`Baseline growth allowed by verified ${BASELINE_GROWTH_APPROVAL_LABEL} governance.`);
    printFindings(result, (line) => console.log(line));
    return 0;
  }

  console.error('Baseline monotonicity check failed.');
  if (result.coverageRegressions.length > 0 && approved) {
    console.error('Client coverage contract regression cannot be approved.');
  }
  if (result.testTypeRegressions.length > 0 && approved) {
    console.error('Typed-test contract regression cannot be approved.');
  }
  if (result.bundleBudgetRegressions.length > 0 && approved) {
    console.error('Client bundle-budget regression cannot be approved.');
  }
  console.error(`Boundary or type-debt growth requires the ${BASELINE_GROWTH_APPROVAL_LABEL} label from a maintainer and an approving CODEOWNER review.`);
  printFindings(result, (line) => console.error(line));
  return 1;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exit(runCli(process.argv.slice(2)));
}
