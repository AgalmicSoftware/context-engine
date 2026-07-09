#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASELINE_PATH = 'scripts/coverage-baseline.json';
const DEFAULT_SUMMARY_PATH = 'client/coverage/coverage-summary.json';
const METRICS = ['statements', 'branches', 'functions', 'lines'];
const EPSILON = 0.000001;

function usage() {
  return `Usage: node scripts/check-coverage-floor.mjs [options]

Fails if client coverage falls below the checked-in floor.

Options:
  --baseline <path>  Baseline JSON. Defaults to ${DEFAULT_BASELINE_PATH}.
  --summary <path>   Jest coverage summary JSON. Defaults to ${DEFAULT_SUMMARY_PATH}.
  --repo <path>      Repository root. Defaults to the current working directory.
  --help             Show this help.
`;
}

function parseArgs(argv) {
  const options = {
    baselinePath: DEFAULT_BASELINE_PATH,
    summaryPath: DEFAULT_SUMMARY_PATH,
    repoDir: process.cwd(),
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--baseline') {
      index += 1;
      if (index >= argv.length) throw new Error('--baseline requires a value');
      options.baselinePath = argv[index];
    } else if (arg === '--summary') {
      index += 1;
      if (index >= argv.length) throw new Error('--summary requires a value');
      options.summaryPath = argv[index];
    } else if (arg === '--repo') {
      index += 1;
      if (index >= argv.length) throw new Error('--repo requires a value');
      options.repoDir = argv[index];
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  return options;
}

function readJson(repoDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(repoDir, relativePath), 'utf8'));
}

function finitePercent(value, label) {
  const percent = Number(value);
  if (!Number.isFinite(percent)) {
    throw new Error(`${label} must be a finite number`);
  }
  return percent;
}

export function collectCoverageFloorFindings({
  repoDir = process.cwd(),
  baselinePath = DEFAULT_BASELINE_PATH,
  summaryPath = DEFAULT_SUMMARY_PATH,
} = {}) {
  const baseline = readJson(repoDir, baselinePath);
  const summary = readJson(repoDir, summaryPath);
  const baselineGlobal = baseline.global || {};
  const summaryGlobal = summary.total || {};

  return METRICS.map((metric) => {
    const floor = finitePercent(baselineGlobal[metric], `baseline.global.${metric}`);
    const actual = finitePercent(summaryGlobal[metric]?.pct, `summary.total.${metric}.pct`);
    return {
      metric,
      floor,
      actual,
      passed: actual + EPSILON >= floor,
    };
  }).filter((result) => !result.passed);
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return 0;
  }

  const findings = collectCoverageFloorFindings(options);
  if (findings.length > 0) {
    console.error('Coverage floor check failed:');
    findings.forEach(({ metric, actual, floor }) => {
      console.error(`- ${metric}: ${actual}% is below floor ${floor}%`);
    });
    return 1;
  }

  console.log('Coverage floor check passed.');
  return 0;
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  try {
    process.exit(main());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
