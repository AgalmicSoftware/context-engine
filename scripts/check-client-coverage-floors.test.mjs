import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectClientCoverageFloorResult } from './check-client-coverage-floors.mjs';

function writeJson(rootDir, relativePath, value) {
  const target = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function coverageFile(relativePath, count) {
  return {
    path: relativePath,
    statementMap: { 0: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } } },
    fnMap: { 0: { name: 'fixture', decl: { start: { line: 1, column: 0 } }, loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } } } },
    branchMap: { 0: { type: 'if', locations: [{ start: { line: 1, column: 0 }, end: { line: 1, column: 1 } }] } },
    s: { 0: count },
    f: { 0: count },
    b: { 0: [count] },
  };
}

function withFixture(run) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-client-coverage-'));
  try {
    writeJson(rootDir, 'scripts/coverage-baseline.json', {
      global: { statements: 100, branches: 100, functions: 100, lines: 100 },
    });
    writeJson(rootDir, 'scripts/client-coverage-full-baseline.json', {
      global: { statements: 50, branches: 50, functions: 50, lines: 50 },
    });
    writeJson(rootDir, 'scripts/client-coverage-legacy-files.json', {
      files: ['client/src/imported.ts'],
    });
    writeJson(rootDir, 'client/coverage/coverage-final.json', {
      [path.join(rootDir, 'client/src/imported.ts')]: coverageFile('client/src/imported.ts', 1),
      [path.join(rootDir, 'client/src/unimported.ts')]: coverageFile('client/src/unimported.ts', 0),
    });
    fs.mkdirSync(path.join(rootDir, 'client/src'), { recursive: true });
    fs.writeFileSync(path.join(rootDir, 'client/src/imported.ts'), 'export const imported = true;\n');
    fs.writeFileSync(path.join(rootDir, 'client/src/unimported.ts'), 'export const unimported = true;\n');
    return run(rootDir);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

test('dual coverage checker enforces fixed legacy and whole-production metrics from one artifact', () => withFixture((rootDir) => {
  const result = collectClientCoverageFloorResult({
    repoDir: rootDir,
    currentProductionFiles: ['client/src/imported.ts', 'client/src/unimported.ts'],
  });

  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.metrics.legacy, { statements: 100, branches: 100, functions: 100, lines: 100 });
  assert.deepEqual(result.metrics.fullUniverse, { statements: 50, branches: 50, functions: 50, lines: 50 });
  assert.deepEqual(result.zeroHitFiles, ['client/src/unimported.ts']);
}));

test('dual coverage checker reports labeled legacy and whole-universe regressions', () => withFixture((rootDir) => {
  writeJson(rootDir, 'scripts/coverage-baseline.json', {
    global: { statements: 101, branches: 101, functions: 101, lines: 101 },
  });
  writeJson(rootDir, 'scripts/client-coverage-full-baseline.json', {
    global: { statements: 51, branches: 51, functions: 51, lines: 51 },
  });

  const result = collectClientCoverageFloorResult({
    repoDir: rootDir,
    currentProductionFiles: ['client/src/imported.ts', 'client/src/unimported.ts'],
  });
  assert.ok(result.findings.some((finding) => finding.startsWith('legacy-imported statements:')));
  assert.ok(result.findings.some((finding) => finding.startsWith('whole-production statements:')));
}));

test('dual coverage checker fails when a current production file is absent from coverage', () => withFixture((rootDir) => {
  fs.writeFileSync(path.join(rootDir, 'client/src/missing.ts'), 'export const missing = true;\n');
  const result = collectClientCoverageFloorResult({
    repoDir: rootDir,
    currentProductionFiles: ['client/src/imported.ts', 'client/src/unimported.ts', 'client/src/missing.ts'],
  });
  assert.deepEqual(result.missingCoverageFiles, ['client/src/missing.ts']);
  assert.ok(result.findings.includes('whole-production coverage is missing 1 current production file: client/src/missing.ts'));
}));
