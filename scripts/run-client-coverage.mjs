#!/usr/bin/env node

// Runs the client coverage suite as time-balanced shards and merges what they
// produce. Each shard is one Jest process started by the client's own
// test:coverage:shard script, so a test runs under the same flags whether the
// shards run side by side on one machine or one per CI job.
//
//   --shards         run every shard side by side
//   --shard <n>      run one shard (a CI matrix leg)
//   --merge          check the shards on disk and merge their coverage
//   --write-timings  refresh the slow-suite list from the shards on disk

import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CLIENT_TEST_SHARD_COUNT = 12;

const REPO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARDS_DIR = 'client/coverage/shards';
const MERGED_COVERAGE = 'client/coverage/coverage-final.json';
const TIMINGS = 'client/scripts/jest/shardTimings.json';
const CLIENT_TEST_FILE_RE = /^client\/(src\/(?:.+\/)?(?:__tests__\/.+|[^/]+\.(?:test|spec))\.(?:js|jsx|ts|tsx))$/;
const SLOW_SUITE_SECONDS = 2;

const posix = (value) => value.split(path.sep).join('/');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const shardDir = (repoDir, index) => path.join(repoDir, SHARDS_DIR, String(index));

const sha256 = (content) => crypto.createHash('sha256').update(content).digest('hex');

/**
 * Names the exact source a run saw: the commit, every uncommitted change to a
 * tracked file, and every untracked file's contents. Shards are only merged
 * when they all ran the tree that is checked out now, so a shard run before
 * an edit cannot stand in for the edited code. Git-ignored files are not part
 * of it. A clean checkout of one commit gives the same value on every machine.
 */
export function treeFingerprint(repoDir) {
  const git = (args) => execFileSync('git', args, { cwd: repoDir, maxBuffer: 1024 * 1024 * 1024 });
  const hash = crypto.createHash('sha256')
    .update(git(['rev-parse', 'HEAD']))
    .update(git(['diff', 'HEAD', '--binary', '--no-ext-diff']));
  for (const relativePath of git(['ls-files', '-z', '--others', '--exclude-standard']).toString('utf8').split('\0').filter(Boolean)) {
    const absolutePath = path.join(repoDir, relativePath);
    const stat = fs.lstatSync(absolutePath, { throwIfNoEntry: false });
    // Git lists a nested repository or worktree as one directory entry: its name is enough.
    let content = '';
    if (stat?.isSymbolicLink()) content = fs.readlinkSync(absolutePath);
    else if (stat?.isFile()) content = sha256(fs.readFileSync(absolutePath));
    hash.update(`\0${relativePath}\0${content}`);
  }
  return hash.digest('hex');
}

export function listTrackedClientTestFiles(repoDir) {
  return execFileSync('git', ['ls-files', '-z', '--', 'client/src'], { cwd: repoDir, encoding: 'buffer' })
    .toString('utf8')
    .split('\0')
    // A file deleted but not yet staged is still in the index; Jest rightly does not run it.
    .filter((file) => fs.existsSync(path.join(repoDir, file)))
    .flatMap((file) => {
      const match = CLIENT_TEST_FILE_RE.exec(file);
      return match ? [match[1]] : [];
    })
    .sort();
}

const liveShards = new Set();

// Shards stay in this runner's process group, so whatever stops the group
// (Ctrl-C, or a timeout that kills it) stops them too. When only the runner is
// stopped, it stops each shard here; npm passes the signal on to Jest.
function stopLiveShards() {
  for (const child of liveShards) child.kill('SIGTERM');
}

/** What the merge needs from Jest's report, which also repeats the whole coverage map. */
export function summarizeJestReport(report, clientDir) {
  return {
    success: report.success === true,
    tests: report.numTotalTests,
    suites: report.testResults.map((suite) => [
      posix(path.relative(clientDir, suite.name)),
      (suite.endTime - suite.startTime) / 1000,
    ]),
  };
}

function runShard(repoDir, index, { captureOutput, tree }) {
  const dir = shardDir(repoDir, index);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const logPath = path.join(dir, 'output.log');
  const log = captureOutput ? fs.openSync(logPath, 'w') : null;
  const resultsPath = path.join(dir, 'jest-results.json');
  const startedAt = Date.now();
  const child = spawn('npm', [
    '--prefix', 'client', 'run', '-s', 'test:coverage:shard', '--',
    `--shard=${index}/${CLIENT_TEST_SHARD_COUNT}`,
    `--coverageDirectory=${dir}`,
    '--json',
    `--outputFile=${resultsPath}`,
  ], {
    cwd: repoDir,
    env: { ...process.env, CE_JEST_SHARD_MANIFEST: path.join(dir, 'shard-manifest.json') },
    stdio: ['ignore', captureOutput ? log : 'inherit', captureOutput ? log : 'inherit'],
  });
  liveShards.add(child);
  return new Promise((resolve) => {
    const finish = (exitCode) => {
      liveShards.delete(child);
      if (log !== null) fs.closeSync(log);
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      // The record names the coverage file it belongs to, so coverage left by
      // an earlier run of this shard cannot be merged under this run's result.
      let results = null;
      let coverageSha256 = null;
      try {
        results = summarizeJestReport(readJson(resultsPath), path.join(repoDir, 'client'));
        coverageSha256 = sha256(fs.readFileSync(path.join(dir, 'coverage-final.json')));
      } catch (_error) { /* no report or coverage: the merge treats the shard as incomplete */ }
      fs.rmSync(resultsPath, { force: true });
      fs.writeFileSync(path.join(dir, 'shard-run.json'), `${JSON.stringify({ tree, repoDir, seconds, exitCode, coverageSha256, results })}\n`);
      resolve({ index, exitCode, seconds, logPath });
    };
    child.on('error', () => finish(1));
    child.on('exit', (code) => finish(code ?? 1));
  });
}

async function runAllShards(repoDir, concurrency) {
  fs.rmSync(path.join(repoDir, SHARDS_DIR), { recursive: true, force: true });
  fs.rmSync(path.join(repoDir, MERGED_COVERAGE), { force: true });
  const tree = treeFingerprint(repoDir);
  const startedAt = Date.now();
  const pending = Array.from({ length: CLIENT_TEST_SHARD_COUNT }, (_, offset) => offset + 1);
  const results = [];
  const worker = async () => {
    while (pending.length) {
      const result = await runShard(repoDir, pending.shift(), { captureOutput: true, tree });
      results.push(result);
      console.log(`client tests shard ${result.index}/${CLIENT_TEST_SHARD_COUNT} ${result.exitCode === 0 ? 'passed' : `FAILED (exit ${result.exitCode})`} in ${result.seconds} s`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, CLIENT_TEST_SHARD_COUNT) }, worker));

  const failed = results.filter((result) => result.exitCode !== 0).sort((left, right) => left.index - right.index);
  for (const result of failed) {
    console.log(`\n===== client tests shard ${result.index}/${CLIENT_TEST_SHARD_COUNT} output (${result.logPath}) =====`);
    console.log(fs.readFileSync(result.logPath, 'utf8'));
  }
  console.log(`client tests: ${CLIENT_TEST_SHARD_COUNT} shards in ${Math.round((Date.now() - startedAt) / 1000)} s, ${failed.length} failed`);
  return failed.length ? 1 : 0;
}

function sameShape(left, right) {
  return ['statementMap', 'fnMap', 'branchMap']
    .every((key) => JSON.stringify(left[key]) === JSON.stringify(right[key]));
}

/**
 * Checks that the shards on disk are one complete run of this tree, then sums
 * their coverage. Any gap is a failure: a shard that is missing, failed, from
 * other source or another split, a test file run twice or not at all, or
 * coverage whose maps disagree between shards.
 */
export function mergeShards({ repoDir, shardCount = CLIENT_TEST_SHARD_COUNT, tree, trackedTestFiles }) {
  const failures = [];
  const merged = new Map();
  const ranBy = new Map();
  const shards = [];
  let universe = null;

  for (let index = 1; index <= shardCount; index += 1) {
    const dir = shardDir(repoDir, index);
    const label = `shard ${index}/${shardCount}`;
    let manifest;
    let run;
    let coverage;
    try {
      manifest = readJson(path.join(dir, 'shard-manifest.json'));
      run = readJson(path.join(dir, 'shard-run.json'));
      if (!run.results) throw new Error('Jest wrote no report');
      const coverageText = fs.readFileSync(path.join(dir, 'coverage-final.json'));
      if (sha256(coverageText) !== run.coverageSha256) throw new Error('its coverage file is not the one this run wrote');
      coverage = JSON.parse(coverageText);
    } catch (error) {
      failures.push(`${label} has no complete result (${error.message})`);
      continue;
    }
    const { results } = run;

    if (manifest.shardIndex !== index || manifest.shardCount !== shardCount) {
      failures.push(`${label} was run as shard ${manifest.shardIndex}/${manifest.shardCount}`);
      continue;
    }
    if (run.tree !== tree) failures.push(`${label} ran other source than the tree checked out now`);
    if (run.exitCode !== 0 || results.success !== true) failures.push(`${label} failed`);

    universe ??= manifest.universe;
    if (JSON.stringify(manifest.universe) !== JSON.stringify(universe)) {
      failures.push(`${label} found a different set of test files than shard 1`);
    }

    const executed = results.suites.map(([file]) => file).sort();
    if (JSON.stringify(executed) !== JSON.stringify(manifest.assigned)) {
      const unrun = manifest.assigned.filter((file) => !executed.includes(file));
      const extra = executed.filter((file) => !manifest.assigned.includes(file));
      failures.push(`${label} did not run exactly its files (${unrun.length} not run, ${extra.length} unexpected)`);
    }
    for (const file of manifest.assigned) {
      if (ranBy.has(file)) failures.push(`${file} is in shards ${ranBy.get(file)} and ${index}`);
      ranBy.set(file, index);
    }

    for (const [absolutePath, entry] of Object.entries(coverage)) {
      const relativePath = posix(path.relative(run.repoDir, entry.path || absolutePath));
      const total = merged.get(relativePath);
      if (!total) {
        merged.set(relativePath, { ...entry, path: relativePath });
      } else if (!sameShape(total, entry)) {
        failures.push(`${relativePath} was instrumented differently in ${label}`);
      } else {
        for (const id of Object.keys(entry.s)) total.s[id] += entry.s[id];
        for (const id of Object.keys(entry.f)) total.f[id] += entry.f[id];
        for (const id of Object.keys(entry.b)) total.b[id] = total.b[id].map((count, arm) => count + entry.b[id][arm]);
      }
    }
    shards.push({ index, seconds: run.seconds, suites: results.suites, tests: results.tests });
  }

  if (universe) {
    const unassigned = universe.filter((file) => !ranBy.has(file));
    if (unassigned.length) failures.push(`${unassigned.length} test files were in no shard: ${unassigned.slice(0, 5).join(', ')}`);
    const known = new Set(universe);
    const unseen = trackedTestFiles.filter((file) => !known.has(file));
    if (unseen.length) failures.push(`${unseen.length} tracked client test files were not found by Jest: ${unseen.slice(0, 5).join(', ')}`);
  }

  return {
    failures,
    coverage: Object.fromEntries([...merged.entries()].sort(([left], [right]) => (left < right ? -1 : 1))),
    shards,
    suiteSeconds: shards.flatMap((shard) => shard.suites),
    tests: shards.reduce((sum, shard) => sum + shard.tests, 0),
  };
}

function checkShardsOnDisk(repoDir) {
  const result = mergeShards({
    repoDir,
    tree: treeFingerprint(repoDir),
    trackedTestFiles: listTrackedClientTestFiles(repoDir),
  });
  if (result.failures.length) {
    console.error('Client test shards do not make one complete run:');
    result.failures.forEach((failure) => console.error(`- ${failure}`));
    return null;
  }
  return result;
}

function mergeShardsOnDisk(repoDir) {
  // A failed merge must not leave an earlier run's coverage for the floor check to read.
  fs.rmSync(path.join(repoDir, MERGED_COVERAGE), { force: true });
  const result = checkShardsOnDisk(repoDir);
  if (!result) return 1;
  fs.writeFileSync(path.join(repoDir, MERGED_COVERAGE), JSON.stringify(result.coverage));
  const seconds = result.shards.map((shard) => shard.seconds);
  console.log(`Client tests: ${result.suiteSeconds.length} suites and ${result.tests} tests passed in ${result.shards.length} shards (${Math.min(...seconds)}-${Math.max(...seconds)} s each).`);
  console.log(`Merged coverage for ${Object.keys(result.coverage).length} files into ${MERGED_COVERAGE}.`);
  return 0;
}

/** The slow suites and the average of the rest, from one run's per-suite times. */
export function summarizeTimings(suiteSeconds, recorded) {
  const slow = suiteSeconds.filter(([, seconds]) => seconds >= SLOW_SUITE_SECONDS);
  const rest = suiteSeconds.filter(([, seconds]) => seconds < SLOW_SUITE_SECONDS);
  const average = rest.reduce((sum, [, seconds]) => sum + seconds, 0) / (rest.length || 1);
  return {
    recorded,
    defaultSeconds: Math.round(average * 100) / 100,
    suites: Object.fromEntries(slow
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([file, seconds]) => [file, Math.round(seconds * 10) / 10])),
  };
}

function writeTimings(repoDir) {
  const result = checkShardsOnDisk(repoDir);
  if (!result) return 1;
  const timings = summarizeTimings(result.suiteSeconds, new Date().toISOString().slice(0, 10));
  fs.writeFileSync(path.join(repoDir, TIMINGS), `${JSON.stringify(timings, null, 2)}\n`);
  console.log(`Recorded ${Object.keys(timings.suites).length} slow suites in ${TIMINGS}.`);
  return 0;
}

function parseArgs(argv) {
  const [mode, value, ...rest] = argv;
  if (mode === '--shard') {
    const index = Number(value);
    if (!Number.isInteger(index) || index < 1 || index > CLIENT_TEST_SHARD_COUNT || rest.length) {
      throw new Error(`--shard takes one number from 1 to ${CLIENT_TEST_SHARD_COUNT}`);
    }
    return { mode, index };
  }
  if (!['--shards', '--merge', '--write-timings'].includes(mode) || value !== undefined) {
    throw new Error('usage: run-client-coverage.mjs --shards | --shard <n> | --merge | --write-timings');
  }
  return { mode };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  process.on('exit', stopLiveShards);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => process.exit(1));
  }
  if (args.mode === '--shard') {
    const tree = treeFingerprint(REPO_DIR);
    return (await runShard(REPO_DIR, args.index, { captureOutput: false, tree })).exitCode;
  }
  if (args.mode === '--shards') {
    // Leave two cores for the rest of the machine.
    const requested = process.env.CLIENT_TEST_SHARD_CONCURRENCY;
    const concurrency = requested === undefined ? Math.max(1, os.availableParallelism() - 2) : Number(requested);
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error(`CLIENT_TEST_SHARD_CONCURRENCY must be a whole number of shards, not "${requested}"`);
    }
    return runAllShards(REPO_DIR, concurrency);
  }
  return args.mode === '--merge' ? mergeShardsOnDisk(REPO_DIR) : writeTimings(REPO_DIR);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  // Set the exit code and let the process end by itself: exiting here would cut a failed shard's printed log short.
  main().then((status) => { process.exitCode = status; }, (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
