#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { listTrackedClientCoverageFiles, normalizeRepoPath } = require('./clientCoverageUniverse');

const METRICS = ['statements', 'branches', 'functions', 'lines'];
const EPSILON = 0.000001;
const DEFAULT_PATHS = Object.freeze({
  legacyBaseline: 'scripts/coverage-baseline.json',
  fullBaseline: 'scripts/client-coverage-full-baseline.json',
  legacyFiles: 'scripts/client-coverage-legacy-files.json',
  coverageFinal: 'client/coverage/coverage-final.json',
});

function readJson(repoDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(repoDir, relativePath), 'utf8'));
}

function normalizeCoverageFilePath(repoDir, coveragePath) {
  const absolutePath = path.isAbsolute(coveragePath)
    ? coveragePath
    : path.resolve(repoDir, coveragePath);
  return normalizeRepoPath(path.relative(repoDir, absolutePath));
}

export function buildCoverageIndex(repoDir, coverageFinal) {
  return new Map(Object.entries(coverageFinal).map(([coveragePath, entry]) => [
    normalizeCoverageFilePath(repoDir, entry?.path || coveragePath),
    entry,
  ]));
}

function createTotals() {
  return Object.fromEntries(METRICS.map((metric) => [metric, { covered: 0, total: 0 }]));
}

function addSimpleCounts(target, values) {
  const counts = Object.values(values || {}).map(Number);
  target.total += counts.length;
  target.covered += counts.filter((count) => count > 0).length;
}

function addLineCounts(target, entry) {
  const lines = new Map();
  for (const [statementId, rawCount] of Object.entries(entry?.s || {})) {
    const line = Number(entry?.statementMap?.[statementId]?.start?.line);
    if (!Number.isInteger(line) || line <= 0) continue;
    const count = Number(rawCount || 0);
    lines.set(line, Math.max(lines.get(line) || 0, count));
  }
  addSimpleCounts(target, Object.fromEntries(lines));
}

function addBranchCounts(target, values) {
  const counts = Object.values(values || {}).flatMap((value) => Array.isArray(value) ? value : []);
  target.total += counts.length;
  target.covered += counts.filter((count) => Number(count) > 0).length;
}

function percent({ covered, total }) {
  if (total === 0) return 100;
  return Math.floor((covered / total) * 10000) / 100;
}

export function aggregateCoverageForFiles({ repoDir, coverageIndex, files }) {
  const totals = createTotals();
  const missingFiles = [];
  const zeroHitFiles = [];

  for (const relativePath of files) {
    const entry = coverageIndex.get(normalizeRepoPath(relativePath));
    if (!entry) {
      missingFiles.push(normalizeRepoPath(relativePath));
      continue;
    }
    const coveredStatements = Object.values(entry.s || {}).filter((count) => Number(count) > 0).length;
    if (Object.keys(entry.s || {}).length > 0 && coveredStatements === 0) {
      zeroHitFiles.push(normalizeRepoPath(relativePath));
    }
    addSimpleCounts(totals.statements, entry.s);
    addBranchCounts(totals.branches, entry.b);
    addSimpleCounts(totals.functions, entry.f);
    addLineCounts(totals.lines, entry);
  }

  return {
    metrics: Object.fromEntries(METRICS.map((metric) => [metric, percent(totals[metric])])),
    missingFiles: missingFiles.sort(),
    zeroHitFiles: zeroHitFiles.sort(),
    totals,
  };
}

function floorFindings(label, metrics, baseline) {
  return METRICS.flatMap((metric) => {
    const actual = Number(metrics[metric]);
    const floor = Number(baseline?.global?.[metric]);
    if (!Number.isFinite(floor)) return [`${label} ${metric}: floor is not a finite number`];
    return actual + EPSILON < floor
      ? [`${label} ${metric}: ${actual}% is below floor ${floor}%`]
      : [];
  });
}

export function collectClientCoverageFloorResult({
  repoDir = process.cwd(),
  currentProductionFiles,
  paths = DEFAULT_PATHS,
} = {}) {
  const resolvedRepoDir = path.resolve(repoDir);
  const coverageFinal = readJson(resolvedRepoDir, paths.coverageFinal);
  const coverageIndex = buildCoverageIndex(resolvedRepoDir, coverageFinal);
  const productionFiles = currentProductionFiles || listTrackedClientCoverageFiles(resolvedRepoDir);
  const legacyFileInventory = readJson(resolvedRepoDir, paths.legacyFiles);
  const legacyFiles = (legacyFileInventory.files || []).filter((relativePath) => (
    fs.existsSync(path.resolve(resolvedRepoDir, relativePath))
  ));
  const legacy = aggregateCoverageForFiles({ repoDir: resolvedRepoDir, coverageIndex, files: legacyFiles });
  const fullUniverse = aggregateCoverageForFiles({
    repoDir: resolvedRepoDir,
    coverageIndex,
    files: productionFiles,
  });
  const findings = [
    ...floorFindings('legacy-imported', legacy.metrics, readJson(resolvedRepoDir, paths.legacyBaseline)),
    ...floorFindings('whole-production', fullUniverse.metrics, readJson(resolvedRepoDir, paths.fullBaseline)),
  ];
  if (legacy.missingFiles.length > 0) {
    findings.push(`legacy-imported coverage is missing ${legacy.missingFiles.length} retained file${legacy.missingFiles.length === 1 ? '' : 's'}: ${legacy.missingFiles.join(', ')}`);
  }
  if (fullUniverse.missingFiles.length > 0) {
    findings.push(`whole-production coverage is missing ${fullUniverse.missingFiles.length} current production file${fullUniverse.missingFiles.length === 1 ? '' : 's'}: ${fullUniverse.missingFiles.join(', ')}`);
  }
  return {
    findings,
    metrics: {
      legacy: legacy.metrics,
      fullUniverse: fullUniverse.metrics,
    },
    missingCoverageFiles: fullUniverse.missingFiles,
    zeroHitFiles: fullUniverse.zeroHitFiles,
    productionFileCount: productionFiles.length,
    legacyFileCount: legacyFiles.length,
  };
}

function main() {
  const result = collectClientCoverageFloorResult();
  console.log(`Legacy imported coverage (${result.legacyFileCount} fixed files): ${JSON.stringify(result.metrics.legacy)}`);
  console.log(`Whole-production coverage (${result.productionFileCount} files): ${JSON.stringify(result.metrics.fullUniverse)}`);
  console.log(`Whole-production zero-hit files (${result.zeroHitFiles.length}):`);
  result.zeroHitFiles.forEach((relativePath) => console.log(`- ${relativePath}`));
  if (result.findings.length > 0) {
    console.error('Client coverage floor check failed:');
    result.findings.forEach((finding) => console.error(`- ${finding}`));
    return 1;
  }
  console.log('Client dual coverage floor check passed.');
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

export const __test__clientCoverageFloors = {
  DEFAULT_PATHS,
};
