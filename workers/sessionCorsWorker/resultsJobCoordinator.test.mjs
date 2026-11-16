import test from 'node:test';
import assert from 'node:assert/strict';

import { RESULTS_JOB_STALE_MS } from './resultsJobs.js';
import { RESULTS_JOB_RUNNERS } from './resultsJobRunners.js';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';

const BUILDER = `0x${'a'.repeat(40)}`;

const createStorage = () => {
  const values = new Map();
  let alarm = null;
  const storage = {
    values,
    get alarm() { return alarm; },
    // Durable Object storage hands back copies, so an edit is kept only by a put.
    get: async (key) => structuredClone(values.get(key)),
    put: async (key, value) => { values.set(key, structuredClone(value)); },
    delete: async (key) => values.delete(key),
    list: async ({ prefix = '' } = {}) => new Map([...values].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key, structuredClone(value)])),
    transaction: async (run) => run(storage),
    getAlarm: async () => alarm,
    setAlarm: async (at) => { alarm = at; },
  };
  return storage;
};

const settle = () => new Promise((resolve) => { setImmediate(resolve); });

// A runner whose runs finish when the test says.
const createRunner = () => {
  const runs = [];
  return { runs, run: ({ job }) => new Promise((resolve) => { runs.push({ job, finish: resolve }); }) };
};

const createCoordinator = ({ storage = createStorage(), clock = { ms: 1_000_000 }, runners } = {}) => {
  const coordinator = new SessionWriteCoordinator({ storage }, {}, { now: () => clock.ms, ...(runners ? { resultsJobRunners: runners } : {}) });
  const post = async (path, payload = {}) => {
    const response = await coordinator.fetch(new Request(`https://session-coordinator.internal/session-config/${path}`, {
      method: 'POST', body: JSON.stringify({ slug: 'salon', ...payload }),
    }));
    return { status: response.status, body: await response.json() };
  };
  return { coordinator, post, storage, clock };
};

test('the coordinator’s job routes take the atlas lease once, and a second press joins the build', async () => {
  const runner = createRunner();
  const { post } = createCoordinator({ runners: { 'debate-atlas': runner } });
  const first = await post('results-job/start', { kind: 'debate-atlas', input: { builder: BUILDER } });
  assert.equal(first.status, 200);
  assert.equal(first.body.joined, false);
  await settle();
  assert.equal(runner.runs.length, 1);
  assert.match(runner.runs[0].job.attemptId, /\S/, 'the run holds the store’s lease');
  const lease = await post('debate-atlas/read', {});
  assert.equal(lease.body.active.startedAtMs, 1_000_000);

  const second = await post('results-job/start', { kind: 'debate-atlas', input: { builder: `0x${'b'.repeat(40)}` } });
  assert.deepEqual([second.body.joined, second.body.job.jobId], [true, first.body.job.jobId]);
  await settle();
  assert.equal(runner.runs.length, 1, 'one build is paid for');

  runner.runs[0].finish({ ok: true, status: 200, buildId: 'atlas_1' });
  await settle();
  const status = await post('results-job/status', { kind: 'debate-atlas' });
  assert.deepEqual([status.body.job.state, status.body.job.outcome.buildId], ['done', 'atlas_1']);
  assert.equal((await post('results-job/nonsense', { kind: 'debate-atlas' })).status, 404);
});

test('a press while another kind’s lease is held is refused as the store refuses it', async () => {
  const runner = createRunner();
  const { post } = createCoordinator({ runners: { 'risk-matrix': runner } });
  // A build begun before this release holds the lease without a job.
  await post('risk-matrix/reserve', { builder: BUILDER });
  const refused = await post('results-job/start', { kind: 'risk-matrix', input: { builder: BUILDER } });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.reason, 'risk_matrix_build_running');
  assert.equal((await post('results-job/status', { kind: 'risk-matrix' })).body.job, null);
});

test('reading builds, or the alarm, runs again a build cut off with its coordinator', async () => {
  const storage = createStorage();
  const clock = { ms: 1_000_000 };
  const cutOff = createRunner();
  await createCoordinator({ storage, clock, runners: { 'debate-atlas': cutOff } }).post('results-job/start', { kind: 'debate-atlas', input: {} });
  await settle();
  assert.equal(storage.alarm, clock.ms + RESULTS_JOB_STALE_MS);

  clock.ms += RESULTS_JOB_STALE_MS;
  const runner = createRunner();
  const reader = createCoordinator({ storage, clock, runners: { 'debate-atlas': runner } });
  await reader.post('debate-atlas/read', {});
  await settle();
  assert.equal(runner.runs.length, 1, 'the page reading builds wakes it');

  // The same for AI Views, through the status route the site polls, and the alarm.
  const aiStorage = createStorage();
  await createCoordinator({ storage: aiStorage, clock, runners: { 'ai-views': createRunner() } }).post('results-job/start', { kind: 'ai-views', input: {} });
  await settle();
  clock.ms += RESULTS_JOB_STALE_MS;
  const polled = createRunner();
  const poller = createCoordinator({ storage: aiStorage, clock, runners: { 'ai-views': polled } });
  await poller.coordinator.executeResultsAnalysisStatus();
  await settle();
  assert.equal(polled.runs.length, 1, 'the status the site polls wakes it');

  const alarmed = createStorage();
  await createCoordinator({ storage: alarmed, clock, runners: { 'ai-views': createRunner() } }).post('results-job/start', { kind: 'ai-views', input: {} });
  await settle();
  clock.ms += RESULTS_JOB_STALE_MS;
  const slowly = async () => { await new Promise((resolve) => { setTimeout(resolve, 20); }); return { ok: true, status: 200, jobState: 'succeeded' }; };
  const after = createCoordinator({ storage: alarmed, clock, runners: { 'ai-views': { run: slowly } } });
  await after.coordinator.alarm();
  const done = (await after.post('results-job/status', { kind: 'ai-views' })).body.job;
  assert.deepEqual([done.state, done.outcome.ok], ['done', true], 'the alarm runs it and waits for it to finish');
});

test('an atlas job the session no longer allows ends plainly and gives back the lease', async () => {
  const { coordinator, post } = createCoordinator();
  coordinator.readCurrentSessionConfig = async () => ({ config: { scopes: { ai: false } } });
  const { body } = await post('debate-atlas/reserve', { builder: BUILDER });
  const job = { kind: 'debate-atlas', slug: 'salon', runs: 1, attemptId: body.attemptId, input: { builder: BUILDER } };
  const result = await RESULTS_JOB_RUNNERS['debate-atlas'].run({ coordinator, job });
  assert.deepEqual([result.ok, result.status], [false, 403]);
  assert.equal((await post('debate-atlas/read', {})).body.active, null);

  const stale = await RESULTS_JOB_RUNNERS['debate-atlas'].run({ coordinator, job });
  assert.deepEqual([stale.ok, stale.status], [false, 409], 'a run whose lease has gone builds nothing');
});

test('an AI Views request run again gives back the reservation its stopped run left, or ends with a failure', async () => {
  const { coordinator } = createCoordinator();
  const reserve = (requestId) => coordinator.reserveResultsAnalysis({
    requestId, sourceSignature: 'source', viewSignature: 'view', reservationKey: `key-${requestId}`,
  });
  assert.equal((await reserve('manual:a')).kind, 'execute');
  await coordinator.releaseResultsAnalysisRequest('manual:other');
  assert.equal((await coordinator.readResultsAnalysisStatus()).active.requestId, 'manual:a', 'another request’s reservation is kept');
  await coordinator.releaseResultsAnalysisRequest('manual:a');
  assert.equal((await coordinator.readResultsAnalysisStatus()).active, null);
  assert.equal((await reserve('manual:a')).kind, 'execute', 'it may run again');

  await coordinator.releaseResultsAnalysisRequest('manual:a', { status: 503, error: 'The build stopped before it finished.' });
  assert.equal((await coordinator.readResultsAnalysisStatus()).active, null);
  assert.deepEqual(await reserve('manual:a'), { kind: 'failed', status: 503, error: 'The build stopped before it finished.' });
});

test('a run again finds the build its stopped run kept before it could say so, and no older one', async () => {
  const { coordinator, post, clock } = createCoordinator();
  const reserved = await post('debate-atlas/reserve', { builder: BUILDER });
  const startedAtMs = clock.ms;
  const builtAt = new Date(clock.ms + 1000).toISOString();
  const build = { id: 'atlas_k1_00000001', version: 1, builtAt, builtBy: BUILDER, counts: {}, title: 'Atlas', missingTopics: [], branches: [] };
  assert.equal((await post('debate-atlas/finalize', { attemptId: reserved.body.attemptId, build })).status, 200);
  const job = { kind: 'debate-atlas', slug: 'salon', runs: 2, startedAtMs, attemptId: reserved.body.attemptId, input: { builder: BUILDER } };
  assert.deepEqual(await RESULTS_JOB_RUNNERS['debate-atlas'].run({ coordinator, job }), { ok: true, status: 200, buildId: build.id });
  const later = await RESULTS_JOB_RUNNERS['debate-atlas'].run({ coordinator, job: { ...job, startedAtMs: clock.ms + 2000 } });
  assert.deepEqual([later.ok, later.status], [false, 409]);
});

test('a run again whose build fails reports the build its stopped run kept meanwhile', async () => {
  const { coordinator, post, clock } = createCoordinator();
  const reserved = await post('debate-atlas/reserve', { builder: BUILDER });
  const job = { kind: 'debate-atlas', slug: 'salon', runs: 2, startedAtMs: clock.ms, attemptId: reserved.body.attemptId, input: { builder: BUILDER } };
  const build = { id: 'atlas_k2_00000002', version: 1, builtAt: new Date(clock.ms).toISOString(), builtBy: BUILDER, counts: {}, title: 'Atlas', missingTopics: [], branches: [] };
  // The stopped run wakes and keeps its build after this run took the lease again.
  coordinator.readCurrentSessionConfig = async () => {
    await post('debate-atlas/finalize', { attemptId: reserved.body.attemptId, build });
    return { config: { scopes: { ai: false } } };
  };
  assert.deepEqual(await RESULTS_JOB_RUNNERS['debate-atlas'].run({ coordinator, job }), { ok: true, status: 200, buildId: build.id });
  // A first run reports its own failure as it is.
  const first = await RESULTS_JOB_RUNNERS['debate-atlas'].run({ coordinator, job: { ...job, runs: 1, attemptId: (await post('debate-atlas/reserve', { builder: BUILDER })).body.attemptId } });
  assert.deepEqual([first.ok, first.status], [false, 403]);
});
