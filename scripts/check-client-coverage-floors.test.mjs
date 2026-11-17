import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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
    writeJson(rootDir, 'scripts/client-coverage-full-baseline.json', {
      global: { statements: 50, branches: 50, functions: 50, lines: 50 },
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

test('coverage checker enforces the whole-production floor from one artifact', () => withFixture((rootDir) => {
  const result = collectClientCoverageFloorResult({
    repoDir: rootDir,
    currentProductionFiles: ['client/src/imported.ts', 'client/src/unimported.ts'],
  });

  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.metrics.fullUniverse, { statements: 50, branches: 50, functions: 50, lines: 50 });
  assert.deepEqual(result.zeroHitFiles, ['client/src/unimported.ts']);
}));

test('coverage checker reports labeled whole-production regressions', () => withFixture((rootDir) => {
  writeJson(rootDir, 'scripts/client-coverage-full-baseline.json', {
    global: { statements: 51, branches: 51, functions: 51, lines: 51 },
  });

  const result = collectClientCoverageFloorResult({
    repoDir: rootDir,
    currentProductionFiles: ['client/src/imported.ts', 'client/src/unimported.ts'],
  });
  assert.deepEqual(result.findings, [
    'whole-production statements: 50% is below floor 51%',
    'whole-production branches: 50% is below floor 51%',
    'whole-production functions: 50% is below floor 51%',
    'whole-production lines: 50% is below floor 51%',
  ]);
}));

test('coverage checker fails when a current production file is absent from coverage', () => withFixture((rootDir) => {
  fs.writeFileSync(path.join(rootDir, 'client/src/missing.ts'), 'export const missing = true;\n');
  const result = collectClientCoverageFloorResult({
    repoDir: rootDir,
    currentProductionFiles: ['client/src/imported.ts', 'client/src/unimported.ts', 'client/src/missing.ts'],
  });
  assert.deepEqual(result.missingCoverageFiles, ['client/src/missing.ts']);
  assert.ok(result.findings.includes('whole-production coverage is missing 1 current production file: client/src/missing.ts'));
}));

// The whole client suite runs in one process, which holds about 2.1 GB of heap by its end. Node's default
// heap on a small CI runner is about 2 GB, and the run was killed there, so it is given its own, whatever
// NODE_OPTIONS says.
test('the client coverage run gets its own heap, in the process that runs the tests', () => {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { scripts } = JSON.parse(fs.readFileSync(path.join(rootDir, 'client/package.json'), 'utf8'));
  const script = scripts['test:coverage:full-universe'];
  const match = /^node ((?:--\S+ )+)node_modules\/jest\/bin\/jest\.js /.exec(script);
  assert.ok(match, `the coverage run must start Jest under node with its own flags: ${script}`);
  // In band, the process given the heap is the one that holds every suite; Jest's workers would not get it.
  assert.match(script, / --runInBand /);
  const result = spawnSync(
    process.execPath,
    [...match[1].trim().split(' '), '-p', "require('node:v8').getHeapStatistics().heap_size_limit"],
    // A small CI runner's default, forced lower still: the run must not inherit it.
    { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=256' } },
  );
  assert.equal(result.status, 0, result.stderr);
  const heapLimitMb = Number(result.stdout) / (1024 * 1024);
  assert.ok(heapLimitMb >= 4096, `the coverage run would get a ${Math.round(heapLimitMb)} MB heap`);
});
