#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import {
  aggregateCoverageForFiles,
  buildCoverageIndex,
} from './check-client-coverage-floors.mjs';

const require = createRequire(import.meta.url);
const {
  CLIENT_COVERAGE_EXCLUSION_RULES,
  listTrackedClientCoverageFiles,
} = require('./clientCoverageUniverse');

function parseArgs(argv) {
  const options = { repoDir: process.cwd(), coveragePath: 'client/coverage/coverage-final.json' };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (['--mode', '--repo', '--coverage', '--output'].includes(key)) {
      index += 1;
      if (index >= argv.length) throw new Error(`${key} requires a value`);
      const field = {
        '--mode': 'mode',
        '--repo': 'repoDir',
        '--coverage': 'coveragePath',
        '--output': 'outputPath',
      }[key];
      options[field] = argv[index];
    } else {
      throw new Error(`unknown option: ${key}`);
    }
  }
  if (!['full', 'exclusions'].includes(options.mode)) {
    throw new Error('--mode must be full or exclusions');
  }
  if (!options.outputPath) throw new Error('--output is required');
  return options;
}

function writeNewJson(repoDir, outputPath, value) {
  const absolutePath = path.resolve(repoDir, outputPath);
  if (fs.existsSync(absolutePath)) {
    throw new Error(`refusing to overwrite existing baseline: ${outputPath}`);
  }
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}

function roundFloor(value) {
  return Math.floor(Number(value) * 10) / 10;
}

function captureFull(repoDir, coverageFinal) {
  const files = listTrackedClientCoverageFiles(repoDir);
  const result = aggregateCoverageForFiles({
    repoDir,
    coverageIndex: buildCoverageIndex(repoDir, coverageFinal),
    files,
  });
  if (result.missingFiles.length > 0) {
    throw new Error(`coverage is missing ${result.missingFiles.length} production files`);
  }
  return {
    schemaVersion: 1,
    measuredAt: new Date().toISOString().slice(0, 10),
    source: 'npm --prefix client run test:coverage:full-universe',
    denominator: 'Every tracked executable client/src JS/JSX/TS/TSX production file under the documented exclusion contract.',
    productionFileCount: files.length,
    zeroHitFileCount: result.zeroHitFiles.length,
    zeroHitFiles: result.zeroHitFiles,
    measured: result.metrics,
    global: Object.fromEntries(Object.entries(result.metrics).map(([metric, value]) => [metric, roundFloor(value)])),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoDir = path.resolve(options.repoDir);
  let value;
  if (options.mode === 'exclusions') {
    value = {
      schemaVersion: 1,
      rules: CLIENT_COVERAGE_EXCLUSION_RULES,
      explicitProductionFileExceptions: [],
    };
  } else {
    const coverageFinal = JSON.parse(fs.readFileSync(path.resolve(repoDir, options.coveragePath), 'utf8'));
    value = captureFull(repoDir, coverageFinal);
  }
  writeNewJson(repoDir, options.outputPath, value);
  console.log(`Wrote ${options.mode} client coverage baseline to ${options.outputPath}.`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
