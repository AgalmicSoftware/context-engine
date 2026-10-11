import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'capture-client-coverage-baseline.mjs');

function withCoveredRepo(run) {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-coverage-capture-'));
  try {
    const sourcePath = path.join(repoDir, 'client/src/feature.ts');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'export const feature = true;\n');
    execFileSync('git', ['init', '--quiet'], { cwd: repoDir });
    execFileSync('git', ['add', 'client/src/feature.ts'], { cwd: repoDir });
    const coveragePath = path.join(repoDir, 'client/coverage/coverage-final.json');
    fs.mkdirSync(path.dirname(coveragePath), { recursive: true });
    fs.writeFileSync(coveragePath, JSON.stringify({
      [sourcePath]: {
        path: sourcePath,
        statementMap: { 0: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } } },
        fnMap: {},
        branchMap: {},
        s: { 0: 1 },
        f: {},
        b: {},
      },
    }));
    return run(repoDir);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
}

function capture(repoDir, mode) {
  return spawnSync(process.execPath, [SCRIPT_PATH, '--mode', mode, '--repo', repoDir, '--output', 'baseline.json'], {
    encoding: 'utf8',
  });
}

test('rejects the retired legacy capture mode', () => withCoveredRepo((repoDir) => {
  const result = capture(repoDir, 'legacy');

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--mode must be full or exclusions/);
  assert.equal(fs.existsSync(path.join(repoDir, 'baseline.json')), false);
}));

test('captures the whole-production floor from coverage-final.json', () => withCoveredRepo((repoDir) => {
  const result = capture(repoDir, 'full');

  assert.equal(result.status, 0, result.stderr);
  const baseline = JSON.parse(fs.readFileSync(path.join(repoDir, 'baseline.json'), 'utf8'));
  assert.equal(baseline.productionFileCount, 1);
  assert.deepEqual(baseline.zeroHitFiles, []);
  assert.deepEqual(baseline.global, { statements: 100, branches: 100, functions: 100, lines: 100 });
  assert.equal(Object.hasOwn(baseline, 'nonComparableWithLegacyImportedMetric'), false);
}));
