import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESULTS_JOB_MAX_RUNS,
  RESULTS_JOB_STALE_MS,
  awaitResultsJob,
  nextResultsJobAt,
  readResultsJob,
  runResultsJobs,
  startResultsJob,
} from './resultsJobs.js';

const createStorage = () => {
  const values = new Map();
  let alarm = null;
  return {
    values,
    get alarm() { return alarm; },
    get: async (key) => structuredClone(values.get(key)),
    put: async (key, value) => { values.set(key, structuredClone(value)); },
    delete: async (key) => values.delete(key),
    getAlarm: async () => alarm,
    setAlarm: async (at) => { alarm = at; },
  };
};

// A coordinator as the runtime makes one: a new one after a restart shares the storage, not the memory.
const createCoordinator = (storage = createStorage(), clock = { ms: 1_000_000 }) => ({ state: { storage }, now: () => clock.ms, clock });

// A runner whose runs finish when the test says.
const createRunner = () => {
  const runs = [];
  const abandoned = [];
  return {
    runs,
    abandoned,
    run: ({ job }) => new Promise((resolve, reject) => { runs.push({ job, finish: resolve, fail: reject }); }),
    abandon: async ({ job }) => { abandoned.push(job.jobId); },
  };
};

const settle = () => new Promise((resolve) => { setImmediate(resolve); });
const start = (coordinator, runner, extra = {}) => startResultsJob(coordinator, {
  kind: 'debate-atlas', slug: 'salon', input: { builder: '0xabc' }, runners: { 'debate-atlas': runner }, ...extra,
});

test('a press starts the build in the coordinator, which keeps its result after the page has gone', async () => {
  const coordinator = createCoordinator();
  const runner = createRunner();
  const started = await start(coordinator, runner, { reserve: async () => ({ ok: true, attemptId: 'attempt-1' }) });
  assert.equal(started.joined, false);
  assert.equal(started.job.state, 'running');
  assert.equal(JSON.stringify(started).includes('0xabc'), false, 'nor does the press’s answer');
  await settle();
  // The request that pressed is gone; the build still runs, with its lease.
  assert.equal(runner.runs.length, 1);
  assert.equal(runner.runs[0].job.attemptId, 'attempt-1');
  assert.equal(runner.runs[0].job.input.builder, '0xabc');
  assert.equal(coordinator.state.storage.alarm, coordinator.clock.ms + RESULTS_JOB_STALE_MS, 'an alarm looks again should the run be cut off');
  runner.runs[0].finish({ ok: true, status: 200, buildId: 'atlas_1' });
  await settle();
  const read = await readResultsJob(coordinator, 'debate-atlas', { 'debate-atlas': runner });
  assert.deepEqual([read.state, read.outcome], ['done', { ok: true, status: 200, buildId: 'atlas_1' }]);
  assert.equal(JSON.stringify(read).includes('0xabc'), false, 'a read never shows the job’s input');
});

test('a press while a build runs joins it, so only one build is paid for', async () => {
  const coordinator = createCoordinator();
  const runner = createRunner();
  let reserves = 0;
  const reserve = async () => { reserves += 1; return { ok: true, attemptId: `attempt-${reserves}` }; };
  const first = await start(coordinator, runner, { reserve });
  await settle();
  const second = await start(coordinator, runner, { reserve });
  await settle();
  assert.equal(second.joined, true);
  assert.equal(second.job.jobId, first.job.jobId);
  assert.equal(reserves, 1);
  assert.equal(runner.runs.length, 1);
  runner.runs[0].finish({ ok: true, status: 200, buildId: 'atlas_1' });
  await settle();
  // Once it has finished, a press starts a new one.
  const third = await start(coordinator, runner, { reserve });
  await settle();
  assert.notEqual(third.job.jobId, first.job.jobId);
  assert.equal(runner.runs.length, 2);
});

test('a build that fails says why, and the next press starts again at once', async () => {
  const coordinator = createCoordinator();
  const runner = createRunner();
  await start(coordinator, runner);
  await settle();
  runner.runs[0].finish({ ok: false, status: 502, error: 'Planning the atlas failed: provider down' });
  await settle();
  const read = await readResultsJob(coordinator, 'debate-atlas', { 'debate-atlas': runner });
  assert.deepEqual(read.outcome, { ok: false, status: 502, error: 'Planning the atlas failed: provider down' });
  assert.equal((await start(coordinator, runner)).joined, false);
  await settle();
  assert.equal(runner.runs.length, 2);
});

test('a runner that throws ends the job with its error and gives back its lease', async () => {
  const coordinator = createCoordinator();
  const abandoned = [];
  const runner = { run: async () => { throw new Error('boom'); }, abandon: async ({ job }) => { abandoned.push(job.jobId); } };
  const { job } = await start(coordinator, runner);
  await settle();
  const read = await readResultsJob(coordinator, 'debate-atlas', { 'debate-atlas': runner });
  assert.deepEqual([read.state, read.outcome.error], ['done', 'boom']);
  assert.deepEqual(abandoned, [job.jobId]);
});

test('a build cut off with its coordinator runs again once its heartbeat is stale, and only then', async () => {
  const storage = createStorage();
  const clock = { ms: 1_000_000 };
  const before = createCoordinator(storage, clock);
  const cutOff = createRunner();
  await start(before, cutOff);
  await settle();
  assert.equal(cutOff.runs.length, 1);

  // The coordinator restarts: the run's promise is gone with it.
  const after = createCoordinator(storage, clock);
  const runner = createRunner();
  const runners = { 'debate-atlas': runner };
  clock.ms += RESULTS_JOB_STALE_MS - 1;
  await readResultsJob(after, 'debate-atlas', runners);
  await start(after, runner);
  await runResultsJobs(after, runners).catch(() => {});
  assert.equal(runner.runs.length, 0, 'a fresh heartbeat means the build may still be running');

  clock.ms += 1;
  assert.equal(await nextResultsJobAt(after), clock.ms + 1000, 'the alarm is due, a second from now at the soonest');
  const read = await readResultsJob(after, 'debate-atlas', runners);
  assert.equal(read.state, 'running');
  await settle();
  assert.equal(runner.runs.length, 1, 'a read wakes it');
  assert.equal(runner.runs[0].job.runs, 2);
  // The first run, had it carried on after all, never ends the second.
  cutOff.runs[0].finish({ ok: false, status: 500, error: 'late' });
  await settle();
  assert.equal((await readResultsJob(after, 'debate-atlas', runners)).state, 'running');
  runner.runs[0].finish({ ok: true, status: 200, buildId: 'atlas_2' });
  await settle();

  assert.deepEqual((await readResultsJob(after, 'debate-atlas', runners)).outcome, { ok: true, status: 200, buildId: 'atlas_2' });
});

test('a run still held in memory whose heartbeat stopped runs again, and the old run changes nothing', async () => {
  const coordinator = createCoordinator();
  const hung = createRunner();
  const runners = { 'debate-atlas': hung };
  await start(coordinator, hung);
  await settle();
  // The run never settles, and its heartbeat writes nothing more.
  coordinator.clock.ms += RESULTS_JOB_STALE_MS;
  await readResultsJob(coordinator, 'debate-atlas', runners);
  await settle();
  assert.equal(hung.runs.length, 2, 'the same coordinator runs it again');
  assert.equal(await nextResultsJobAt(coordinator), coordinator.clock.ms + RESULTS_JOB_STALE_MS, 'no alarm in the past');
  hung.runs[0].fail(new Error('late'));
  await settle();
  assert.deepEqual(hung.abandoned, [], 'it leaves the lease to the run that replaced it');
  hung.runs[1].finish({ ok: true, status: 200, buildId: 'atlas_2' });
  await settle();
  assert.equal((await readResultsJob(coordinator, 'debate-atlas', runners)).outcome.buildId, 'atlas_2');
});

test('two callers at once claim a job once', async () => {
  const coordinator = createCoordinator();
  const runner = createRunner();
  const runners = { 'debate-atlas': runner };
  // Kept with no claim yet, as a press leaves it before its kick runs.
  await coordinator.state.storage.put('results-job-v1:debate-atlas', { kind: 'debate-atlas', slug: 'salon', jobId: 'j1', state: 'running', startedAtMs: 1, runs: 0, input: {} });
  runResultsJobs(coordinator, runners);
  runResultsJobs(coordinator, runners);
  await settle();
  assert.equal(runner.runs.length, 1);
});

test('the alarm runs a cut-off build again and waits for it to finish', async () => {
  const storage = createStorage();
  const clock = { ms: 1_000_000 };
  await start(createCoordinator(storage, clock), createRunner());
  await settle();
  clock.ms += RESULTS_JOB_STALE_MS;
  const after = createCoordinator(storage, clock);
  const runners = { 'debate-atlas': { run: async () => ({ ok: true, status: 200, buildId: 'atlas_3' }) } };
  await runResultsJobs(after, runners);
  assert.equal((await readResultsJob(after, 'debate-atlas', runners)).outcome.buildId, 'atlas_3');
  assert.equal(await nextResultsJobAt(after), Infinity);
});

test('an alarm that comes while a build runs looks again when its heartbeat would go stale', async () => {
  const storage = createStorage();
  const clock = { ms: 1_000_000 };
  await start(createCoordinator(storage, clock), createRunner());
  await settle();
  clock.ms += RESULTS_JOB_STALE_MS / 2;
  // The alarm that fired is spent; the run, in another coordinator, is alive.
  storage.setAlarm(null);
  await runResultsJobs(createCoordinator(storage, clock), { 'debate-atlas': createRunner() });
  assert.equal(storage.alarm, 1_000_000 + RESULTS_JOB_STALE_MS);
});

test(`a build cut off ${RESULTS_JOB_MAX_RUNS} times ends as a plain failure and frees the next press`, async () => {
  const storage = createStorage();
  const clock = { ms: 1_000_000 };
  await start(createCoordinator(storage, clock), createRunner());
  await settle();
  for (let restart = 1; restart < RESULTS_JOB_MAX_RUNS; restart += 1) {
    clock.ms += RESULTS_JOB_STALE_MS;
    await readResultsJob(createCoordinator(storage, clock), 'debate-atlas', { 'debate-atlas': createRunner() });
    await settle();
  }
  clock.ms += RESULTS_JOB_STALE_MS;
  const last = createCoordinator(storage, clock);
  const runner = createRunner();
  await runResultsJobs(last, { 'debate-atlas': runner });
  assert.equal(runner.runs.length, 0, 'it is not paid for again');
  assert.equal(runner.abandoned.length, 1, 'its lease is given back');
  const read = await readResultsJob(last, 'debate-atlas', { 'debate-atlas': runner });
  assert.deepEqual([read.state, read.outcome.ok, read.outcome.status], ['done', false, 503]);
  assert.match(read.outcome.error, /stopped before it finished.*Press again/);
  assert.equal((await start(last, runner)).joined, false);
});

test('a lease the kind refuses is returned as it is, and starts nothing', async () => {
  const coordinator = createCoordinator();
  const runner = createRunner();
  const refusal = { ok: false, status: 409, body: { reason: 'debate_atlas_build_running' } };
  assert.deepEqual(await start(coordinator, runner, { reserve: async () => refusal }), refusal);
  await settle();
  assert.equal(runner.runs.length, 0);
  assert.equal(await readResultsJob(coordinator, 'debate-atlas', {}), null);
});

test('each kind has its own job, and they run side by side', async () => {
  const coordinator = createCoordinator();
  const atlas = createRunner();
  const risk = createRunner();
  const runners = { 'debate-atlas': atlas, 'risk-matrix': risk };
  await startResultsJob(coordinator, { kind: 'debate-atlas', slug: 'salon', input: {}, runners });
  await startResultsJob(coordinator, { kind: 'risk-matrix', slug: 'salon', input: {}, runners });
  await settle();
  assert.deepEqual([atlas.runs.length, risk.runs.length], [1, 1]);
  assert.equal((await startResultsJob(coordinator, { kind: 'nonsense', slug: 'salon', input: {}, runners })).status, 404);
});

test('the request waiting on a build answers with its result, or that it still runs once its wait is over', async () => {
  const clock = { ms: 0 };
  const replies = [
    { ok: true, body: { job: { jobId: 'j1', state: 'running', startedAtMs: 0 } } },
    { ok: false, status: 503 },
    { ok: true, body: { job: { jobId: 'j1', state: 'done', outcome: { ok: true } } } },
  ];
  const calls = [];
  const call = async (operation) => { calls.push(operation); return replies.shift(); };
  const waits = [];
  const wait = async (ms) => { waits.push(ms); clock.ms += ms; };
  const done = await awaitResultsJob({ call, input: {}, waitMs: 60_000, now: () => clock.ms, wait });
  assert.deepEqual(calls, ['start', 'status', 'status'], 'a read that fails is tried again');
  assert.equal(done.job.state, 'done');
  assert.deepEqual(waits, [250, 500], 'it looks soon, then less often');

  const still = await awaitResultsJob({
    call: async () => ({ ok: true, body: { job: { jobId: 'j2', state: 'running', startedAtMs: 5 } } }),
    input: {}, waitMs: 10_000, now: () => clock.ms, wait,
  });
  assert.deepEqual([still.job.state, still.job.startedAtMs], ['running', 5]);

  const replaced = [{ ok: true, body: { job: { jobId: 'j3', state: 'running' } } }, { ok: true, body: { job: { jobId: 'j4', state: 'running' } } }];
  const gone = await awaitResultsJob({ call: async () => replaced.shift(), input: {}, waitMs: 10_000, now: () => clock.ms, wait });
  assert.deepEqual([gone.job.jobId, gone.job.state], ['j3', 'replaced'], 'a newer job means this one ended unseen');

  const refused = { ok: false, status: 409, body: { reason: 'busy' } };
  assert.deepEqual(await awaitResultsJob({ call: async () => refused, input: {}, waitMs: 1, wait }), refused);
});
