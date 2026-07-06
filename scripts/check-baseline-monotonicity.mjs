#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ALLOW_MARKER = '[allow-baseline-growth]';

const BOUNDARY_BASELINE = 'scripts/client-boundaries-baseline.json';
const TYPE_DEBT_BASELINE = 'scripts/type-debt-baseline.json';

function usage() {
  return `Usage: node scripts/check-baseline-monotonicity.mjs [options]

Fails if baseline files grow relative to a base ref:
  - ${BOUNDARY_BASELINE} must not gain violation entries.
  - ${TYPE_DEBT_BASELINE} must not increase any count.

Options:
  --base <ref>        Base git ref to compare against. Defaults to
                      BASELINE_MONOTONICITY_BASE or origin/main.
  --repo <path>       Repository root. Defaults to the current working directory.
  --allow-text <text> Text inspected for the ${ALLOW_MARKER} escape hatch.
                      CI passes PR title/body or push commit text here.
  --help              Show this help.

Escape hatch:
  Put ${ALLOW_MARKER} in the PR title/body or commit message when a legitimate
  checker-rule rollout intentionally increases a baseline. The script will still
  print the growth it found, but it will exit 0.
`;
}

function parseArgs(argv) {
  const options = {
    baseRef: process.env.BASELINE_MONOTONICITY_BASE || 'origin/main',
    repoDir: process.cwd(),
    allowText: process.env.BASELINE_MONOTONICITY_ALLOW_TEXT || '',
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
    } else if (arg === '--allow-text') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--allow-text requires a value');
      }
      options.allowText = argv[index];
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

export function shouldAllowBaselineGrowth(allowText = '') {
  return String(allowText).includes(ALLOW_MARKER)
    || process.env.BASELINE_MONOTONICITY_ALLOW === '1'
    || process.env.BASELINE_MONOTONICITY_ALLOW === 'true';
}

export function collectBaselineMonotonicityFindings({
  repoDir = process.cwd(),
  baseRef = process.env.BASELINE_MONOTONICITY_BASE || 'origin/main',
} = {}) {
  const resolvedRepoDir = path.resolve(repoDir);
  const notices = [];
  const baseCommit = resolveBaseCommit(resolvedRepoDir, baseRef);
  if (!baseCommit) {
    notices.push(`Baseline monotonicity skipped: base ref "${baseRef}" was not available.`);
    return {
      skipped: true,
      notices,
      boundaryGains: [],
      typeDebtIncreases: [],
    };
  }

  let baseBoundary;
  let baseTypeDebt;
  try {
    baseBoundary = readBaseJson(resolvedRepoDir, baseCommit, BOUNDARY_BASELINE);
    baseTypeDebt = readBaseJson(resolvedRepoDir, baseCommit, TYPE_DEBT_BASELINE);
  } catch (error) {
    notices.push(`Baseline monotonicity skipped: baseline files were not available at ${baseRef}: ${error.message}`);
    return {
      skipped: true,
      notices,
      boundaryGains: [],
      typeDebtIncreases: [],
    };
  }

  const currentBoundary = readCurrentJson(resolvedRepoDir, BOUNDARY_BASELINE);
  const currentTypeDebt = readCurrentJson(resolvedRepoDir, TYPE_DEBT_BASELINE);

  return {
    skipped: false,
    notices,
    boundaryGains: boundaryViolationGains(baseBoundary, currentBoundary),
    typeDebtIncreases: typeDebtIncreases(baseTypeDebt, currentTypeDebt),
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
}

export function hasBaselineGrowth(result) {
  return result.boundaryGains.length > 0 || result.typeDebtIncreases.length > 0;
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
  });

  result.notices.forEach((notice) => {
    console.log(`notice: ${notice}`);
  });

  if (result.skipped) {
    return 0;
  }

  if (!hasBaselineGrowth(result)) {
    console.log(`Baseline monotonicity check passed against ${options.baseRef}.`);
    return 0;
  }

  if (shouldAllowBaselineGrowth(options.allowText)) {
    console.log(`Baseline growth allowed by ${ALLOW_MARKER}.`);
    printFindings(result, (line) => console.log(line));
    return 0;
  }

  console.error('Baseline monotonicity check failed.');
  console.error(`Use ${ALLOW_MARKER} in the PR title/body or commit message only for intentional checker-rule baseline growth.`);
  printFindings(result, (line) => console.error(line));
  return 1;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  process.exit(runCli(process.argv.slice(2)));
}
