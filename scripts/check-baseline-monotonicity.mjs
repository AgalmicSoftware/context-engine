#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const BASELINE_GROWTH_APPROVAL_LABEL = 'baseline-growth-approved';

const BOUNDARY_BASELINE = 'scripts/client-boundaries-baseline.json';
const TYPE_DEBT_BASELINE = 'scripts/type-debt-baseline.json';
const DEAD_EXPORT_BASELINE = 'scripts/dead-exports-baseline.json';

function usage() {
  return `Usage: node scripts/check-baseline-monotonicity.mjs [options]

Fails if baseline files grow relative to a base ref:
  - ${BOUNDARY_BASELINE} must not gain violation entries.
  - ${TYPE_DEBT_BASELINE} must not increase any count.
  - ${DEAD_EXPORT_BASELINE} must not increase either candidate count.

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
  pushes and dead-export growth cannot use this exception.
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

function deadExportCountIncreases(baseBaseline, currentBaseline) {
  return ['candidateDeadFiles', 'candidateUnusedExports'].flatMap((field) => {
    const base = toFiniteCount(baseBaseline?.[field], field, DEAD_EXPORT_BASELINE);
    const current = toFiniteCount(currentBaseline?.[field], field, DEAD_EXPORT_BASELINE);
    return current > base ? [{ field, base, current }] : [];
  });
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
      deadExportIncreases: [],
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
      deadExportIncreases: [],
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
      deadExportIncreases: [],
    };
  }

  const currentBoundary = readCurrentJson(resolvedRepoDir, BOUNDARY_BASELINE);
  const currentTypeDebt = readCurrentJson(resolvedRepoDir, TYPE_DEBT_BASELINE);
  const currentDeadExports = readCurrentJson(resolvedRepoDir, DEAD_EXPORT_BASELINE);
  let baseDeadExports = null;
  try {
    baseDeadExports = readBaseJson(resolvedRepoDir, baseCommit, DEAD_EXPORT_BASELINE);
  } catch (_error) {
    notices.push(`Baseline monotonicity bootstrap: ${DEAD_EXPORT_BASELINE} was not present at ${baseRef}.`);
  }

  return {
    skipped: false,
    failed: false,
    notices,
    boundaryGains: boundaryViolationGains(baseBoundary, currentBoundary),
    typeDebtIncreases: typeDebtIncreases(baseTypeDebt, currentTypeDebt),
    deadExportIncreases: baseDeadExports ? deadExportCountIncreases(baseDeadExports, currentDeadExports) : [],
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

function formatDeadExportIncrease(increase) {
  return `${increase.field}: ${increase.base} -> ${increase.current}`;
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

  if (result.deadExportIncreases.length > 0) {
    writeLine(`${DEAD_EXPORT_BASELINE} increased ${result.deadExportIncreases.length} count${result.deadExportIncreases.length === 1 ? '' : 's'}:`);
    result.deadExportIncreases.forEach((increase) => {
      writeLine(`  - ${formatDeadExportIncrease(increase)}`);
    });
  }
}

export function hasBaselineGrowth(result) {
  return result.boundaryGains.length > 0
    || result.typeDebtIncreases.length > 0
    || result.deadExportIncreases.length > 0;
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
  if (approved && result.deadExportIncreases.length === 0) {
    console.log(`Baseline growth allowed by verified ${BASELINE_GROWTH_APPROVAL_LABEL} governance.`);
    printFindings(result, (line) => console.log(line));
    return 0;
  }

  console.error('Baseline monotonicity check failed.');
  if (result.deadExportIncreases.length > 0 && approved) {
    console.error(`${DEAD_EXPORT_BASELINE} growth cannot be approved.`);
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
