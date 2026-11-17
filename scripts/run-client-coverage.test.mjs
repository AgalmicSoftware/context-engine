import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  CLIENT_TEST_SHARD_COUNT,
  mergeShards,
  summarizeJestReport,
  summarizeTimings,
  treeFingerprint,
} from './run-client-coverage.mjs';

const require = createRequire(import.meta.url);
const { partitionByRecordedTime } = require('../client/scripts/jest/shardPartition.cjs');

const TREE = 'a'.repeat(64);
const sha256 = (content) => crypto.createHash('sha256').update(content).digest('hex');

function coverageEntry(absolutePath, count) {
  return {
    path: absolutePath,
    statementMap: { 0: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } } },
    fnMap: { 0: { name: 'fixture', decl: { start: { line: 1, column: 0 } }, loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } } } },
    branchMap: { 0: { type: 'if', locations: [{ start: { line: 1, column: 0 } }, { start: { line: 1, column: 1 } }] } },
    s: { 0: count },
    f: { 0: count },
    b: { 0: [count, 0] },
  };
}

// Two shards of a three-file suite: shard 1 runs a and b, shard 2 runs c.
// Shard 1 alone executes the production file.
function withShards(run) {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-client-shards-'));
  const universe = ['src/a.test.ts', 'src/b.test.ts', 'src/c.test.ts'];
  const shards = [
    { assigned: ['src/a.test.ts', 'src/b.test.ts'], hits: 2 },
    { assigned: ['src/c.test.ts'], hits: 0 },
  ];
  const fileOf = (index, name) => path.join(repoDir, 'client/coverage/shards', String(index), name);
  const write = (index, name, value) => {
    fs.mkdirSync(path.dirname(fileOf(index, name)), { recursive: true });
    fs.writeFileSync(fileOf(index, name), JSON.stringify(value));
  };
  const edit = (index, name, change) => {
    const value = JSON.parse(fs.readFileSync(fileOf(index, name), 'utf8'));
    change(value);
    write(index, name, value);
  };
  shards.forEach(({ assigned, hits }, offset) => {
    const index = offset + 1;
    const production = path.join(repoDir, 'client/src/production.ts');
    const coverage = { [production]: coverageEntry(production, hits) };
    write(index, 'shard-manifest.json', { shardIndex: index, shardCount: 2, universe, assigned });
    write(index, 'shard-run.json', {
      tree: TREE,
      repoDir,
      seconds: 10 * index,
      exitCode: 0,
      coverageSha256: sha256(JSON.stringify(coverage)),
      results: { success: true, tests: assigned.length * 3, suites: assigned.map((file) => [file, 1.5]) },
    });
    write(index, 'coverage-final.json', coverage);
  });
  const merge = (overrides = {}) => mergeShards({
    repoDir,
    shardCount: 2,
    tree: TREE,
    trackedTestFiles: universe,
    ...overrides,
  });
  try {
    return run({
      merge,
      edit,
      read: (index, name) => fs.readFileSync(fileOf(index, name)),
      remove: (index, name) => fs.rmSync(fileOf(index, name)),
    });
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
}

test('merging complete shards sums their coverage under repository paths', () => withShards(({ merge }) => {
  const result = merge();
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.suiteSeconds, [['src/a.test.ts', 1.5], ['src/b.test.ts', 1.5], ['src/c.test.ts', 1.5]]);
  assert.equal(result.tests, 9);
  assert.deepEqual(Object.keys(result.coverage), ['client/src/production.ts']);
  const entry = result.coverage['client/src/production.ts'];
  assert.equal(entry.path, 'client/src/production.ts');
  assert.deepEqual([entry.s, entry.f, entry.b], [{ 0: 2 }, { 0: 2 }, { 0: [2, 0] }]);
}));

test('a missing shard fails the merge', () => withShards(({ merge, remove }) => {
  remove(2, 'coverage-final.json');
  const { failures } = merge();
  assert.match(failures[0], /^shard 2\/2 has no complete result/);
  assert.ok(failures.some((failure) => failure.startsWith('1 test files were in no shard: src/c.test.ts')));
}));

test('a failed shard, or one Jest left no report for, fails the merge', () => withShards(({ merge, edit }) => {
  edit(1, 'shard-run.json', (run) => { run.results.success = false; });
  assert.deepEqual(merge().failures, ['shard 1/2 failed']);
  edit(1, 'shard-run.json', (run) => { run.results.success = true; run.exitCode = 1; });
  assert.deepEqual(merge().failures, ['shard 1/2 failed']);
  edit(1, 'shard-run.json', (run) => { run.results = null; });
  assert.equal(merge().failures[0], 'shard 1/2 has no complete result (Jest wrote no report)');
}));

test('shards of other source or another split fail the merge', () => withShards(({ merge, edit }) => {
  assert.deepEqual(merge({ tree: 'b'.repeat(64) }).failures, [
    'shard 1/2 ran other source than the tree checked out now',
    'shard 2/2 ran other source than the tree checked out now',
  ]);
  edit(2, 'shard-manifest.json', (manifest) => { manifest.shardCount = 3; });
  assert.ok(merge().failures.includes('shard 2/2 was run as shard 2/3'));
}));

test('a test file run twice, not run, or in no shard fails the merge', () => withShards(({ merge, edit }) => {
  edit(2, 'shard-manifest.json', (manifest) => { manifest.assigned = ['src/b.test.ts', 'src/c.test.ts']; });
  let { failures } = merge();
  assert.ok(failures.includes('shard 2/2 did not run exactly its files (1 not run, 0 unexpected)'));
  assert.ok(failures.includes('src/b.test.ts is in shards 1 and 2'));

  edit(2, 'shard-manifest.json', (manifest) => { manifest.assigned = []; });
  edit(2, 'shard-run.json', (run) => { run.results.suites = []; });
  ({ failures } = merge());
  assert.deepEqual(failures, ['1 test files were in no shard: src/c.test.ts']);
}));

test('shards that disagree on the test files, or miss a tracked one, fail the merge', () => withShards(({ merge, edit }) => {
  assert.deepEqual(merge({ trackedTestFiles: ['src/a.test.ts', 'src/d.test.ts'] }).failures, [
    '1 tracked client test files were not found by Jest: src/d.test.ts',
  ]);
  edit(2, 'shard-manifest.json', (manifest) => { manifest.universe = [...manifest.universe, 'src/d.test.ts']; });
  assert.deepEqual(merge().failures, ['shard 2/2 found a different set of test files than shard 1']);
}));

test('coverage instrumented differently between shards fails the merge', () => withShards(({ merge, edit, read }) => {
  edit(2, 'coverage-final.json', (coverage) => {
    Object.values(coverage)[0].statementMap[0].start.line = 2;
  });
  edit(2, 'shard-run.json', (run) => { run.coverageSha256 = sha256(read(2, 'coverage-final.json')); });
  assert.deepEqual(merge().failures, ['client/src/production.ts was instrumented differently in shard 2/2']);
}));

test('coverage that is not the file the shard run wrote fails the merge', () => withShards(({ merge, edit }) => {
  edit(1, 'coverage-final.json', (coverage) => { Object.values(coverage)[0].s[0] = 99; });
  const { failures } = merge();
  assert.equal(failures[0], 'shard 1/2 has no complete result (its coverage file is not the one this run wrote)');
}));

test('the record kept from a Jest report has what the merge reads, with paths under client/', () => {
  assert.deepEqual(summarizeJestReport({
    success: true,
    numTotalTests: 7,
    coverageMap: { large: true },
    testResults: [{ name: path.join('/repo/client', 'src', 'a.test.ts'), startTime: 1000, endTime: 3500 }],
  }, '/repo/client'), { success: true, tests: 7, suites: [['src/a.test.ts', 2.5]] });
  assert.equal(summarizeJestReport({ success: 'yes', numTotalTests: 0, testResults: [] }, '/repo/client').success, false);
});

test('the time-balanced split puts every file in exactly one shard, whatever order Jest lists them in', () => {
  const files = Array.from({ length: 200 }, (_, index) => `src/suite-${String(index).padStart(3, '0')}.test.ts`);
  const timings = { defaultSeconds: 0.4, suites: { [files[0]]: 80, [files[1]]: 70, [files[2]]: 60, [files[3]]: 50 } };
  const shards = partitionByRecordedTime(files, CLIENT_TEST_SHARD_COUNT, timings);

  assert.equal(shards.length, CLIENT_TEST_SHARD_COUNT);
  assert.deepEqual(shards.flat().sort(), files);
  assert.deepEqual(partitionByRecordedTime([...files].reverse(), CLIENT_TEST_SHARD_COUNT, timings), shards);
  // The four slow suites are apart, and the rest fill the other shards first.
  const slowHolders = shards.filter((shard) => shard.some((file) => timings.suites[file]));
  assert.equal(slowHolders.length, 4);
  slowHolders.forEach((shard) => assert.equal(shard.length, 1));
});

test('recorded timings keep the slow suites and average the rest', () => {
  assert.deepEqual(summarizeTimings([
    ['src/slow.test.ts', 12.34],
    ['src/quick-b.test.ts', 0.5],
    ['src/quick-a.test.ts', 0.25],
  ], '2026-01-01'), {
    recorded: '2026-01-01',
    defaultSeconds: 0.38,
    suites: { 'src/slow.test.ts': 12.3 },
  });
});

test('the CI workflow runs every shard, and merges only what all of them produced', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const job = (name) => workflow.split(`\n  ${name}:\n`)[1].split(/\n  [\w-]+:\n/)[0];
  const shardJob = job('client-tests');
  const everyShard = Array.from({ length: CLIENT_TEST_SHARD_COUNT }, (_, offset) => offset + 1);

  assert.ok(shardJob.includes(`        shard: [${everyShard.join(', ')}]\n`), 'one matrix entry per shard');
  // A failing shard must not cancel the others: one run then shows every failure.
  assert.match(shardJob, /\n      fail-fast: false\n/);
  assert.match(shardJob, /\n          path: client\/coverage\/shards\n/);

  const mergeJob = job('client');
  assert.match(mergeJob, /\n    needs: client-tests\n/);
  assert.match(mergeJob, /\n          path: client\/coverage\/shards\n          merge-multiple: true\n/);
  assert.ok(workflow.includes('"client-tests":"${{ needs.client-tests.result }}","client":"${{ needs.client.result }}"'));
});

test('the shard run and the single-process run use the same Jest command', () => {
  const { scripts } = JSON.parse(fs.readFileSync(new URL('../client/package.json', import.meta.url), 'utf8'));
  // A shard writes only the JSON coverage the merge reads; nothing else may differ.
  const withoutReports = scripts['test:coverage:full-universe']
    .replace(' --coverageReporters=json-summary --coverageReporters=lcov --coverageReporters=text-summary', '');
  assert.equal(scripts['test:coverage:shard'], withoutReports);
});

test('the runner starts each shard through the client script whose heap and flags are pinned', () => {
  const source = fs.readFileSync(new URL('./run-client-coverage.mjs', import.meta.url), 'utf8');
  assert.match(source, /spawn\('npm', \[\n\s+'--prefix', 'client', 'run', '-s', 'test:coverage:shard', '--',/);
});

test('the tree fingerprint changes with any edit, tracked or not, and is the same for the same tree', () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-tree-fingerprint-'));
  const git = (...args) => execFileSync('git', args, { cwd: repoDir, stdio: 'pipe' });
  try {
    git('init', '-q');
    fs.writeFileSync(path.join(repoDir, '.gitignore'), 'coverage\n');
    fs.writeFileSync(path.join(repoDir, 'tracked.ts'), 'export const a = 1;\n');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=[redacted-email]', 'commit', '-q', '-m', 'first');
    const clean = treeFingerprint(repoDir);
    assert.equal(treeFingerprint(repoDir), clean);

    // What a run writes is ignored, so running the shards does not change the fingerprint.
    fs.mkdirSync(path.join(repoDir, 'coverage'));
    fs.writeFileSync(path.join(repoDir, 'coverage', 'out.json'), '{}');
    assert.equal(treeFingerprint(repoDir), clean);

    fs.writeFileSync(path.join(repoDir, 'tracked.ts'), 'export const a = 2;\n');
    const edited = treeFingerprint(repoDir);
    assert.notEqual(edited, clean);

    fs.writeFileSync(path.join(repoDir, 'new.test.ts'), 'test("x", () => {});\n');
    const withUntracked = treeFingerprint(repoDir);
    assert.notEqual(withUntracked, edited);
    fs.writeFileSync(path.join(repoDir, 'new.test.ts'), 'test("y", () => {});\n');
    assert.notEqual(treeFingerprint(repoDir), withUntracked);

    git('checkout', '-q', '--', 'tracked.ts');
    fs.rmSync(path.join(repoDir, 'new.test.ts'));
    assert.equal(treeFingerprint(repoDir), clean);

    // Entries git cannot hash as files: a dangling link, and a nested repository.
    fs.symlinkSync('nowhere', path.join(repoDir, 'dangling'));
    fs.mkdirSync(path.join(repoDir, 'nested'));
    execFileSync('git', ['init', '-q'], { cwd: path.join(repoDir, 'nested'), stdio: 'pipe' });
    fs.writeFileSync(path.join(repoDir, 'nested', 'file.ts'), 'export {};\n');
    const withOddEntries = treeFingerprint(repoDir);
    assert.notEqual(withOddEntries, clean);
    fs.rmSync(path.join(repoDir, 'dangling'));
    fs.symlinkSync('elsewhere', path.join(repoDir, 'dangling'));
    assert.notEqual(treeFingerprint(repoDir), withOddEntries);
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});
