import test from 'node:test';
import assert from 'node:assert/strict';

import { RESULTS_BUILD_WAIT_MS, pressResultsAnalysis, pressResultsBuild } from './resultsJobPress.js';
import { readResultsJob, startResultsJob } from './resultsJobs.js';

// The coordinator's job routes over an in-memory coordinator, with runners the test controls.
const createJobs = (runners) => {
  const values = new Map();
  const storage = {
    get: async (key) => structuredClone(values.get(key)),
    put: async (key, value) => { values.set(key, structuredClone(value)); },
    getAlarm: async () => null,
    setAlarm: async () => {},
  };
  const clock = { ms: 1_000_000 };
  const coordinator = { state: { storage }, now: () => clock.ms };
  const call = async (kind, operation, payload) => {
    if (operation === 'start') {
      const started = await startResultsJob(coordinator, { kind, slug: 'salon', input: payload.input, runners });
      return started.ok ? { ok: true, body: { job: started.job } } : started;
    }
    return { ok: true, body: { job: await readResultsJob(coordinator, kind, runners) } };
  };
  // The wait lets the job's run take its turn, and moves the clock.
  const wait = async (ms) => { await new Promise((resolve) => { setImmediate(resolve); }); clock.ms += ms; };
  return { call, wait, now: () => clock.ms, clock };
};

const BUILD = { id: 'atlas_k1_00000001', title: 'Atlas' };
const buildDeps = (jobs, extra = {}) => ({
  callResultsJob: jobs.call,
  wait: jobs.wait,
  now: jobs.now,
  callBuildStore: async (_env, _slug, operation, payload) => (operation === 'read' && payload.id === BUILD.id
    ? { ok: true, status: 200, body: { ok: true, build: BUILD } }
    : { ok: false, status: 404, body: {} }),
  ...extra,
});

test('a press answers with the build its job kept', async () => {
  const seen = [];
  const jobs = createJobs({ 'debate-atlas': { run: async ({ job }) => { seen.push(job.input); return { ok: true, status: 200, buildId: BUILD.id }; } } });
  const result = await pressResultsBuild({ kindName: 'debate-atlas', config: {}, builderAddress: '0xABC', deps: buildDeps(jobs) });
  assert.deepEqual(result, { ok: true, status: 200, build: BUILD });
  assert.deepEqual(seen, [{ builder: '0xabc', body: { source: { kind: 'worker-canonical' } } }]);
});

test('a press answers with its build’s failure, plainly', async () => {
  const jobs = createJobs({ 'risk-matrix': { run: async () => ({ ok: false, status: 504, error: 'The risk matrix build ran out of time.' }) } });
  const result = await pressResultsBuild({ kindName: 'risk-matrix', config: {}, deps: buildDeps(jobs) });
  assert.deepEqual(result, { ok: false, status: 504, error: 'The risk matrix build ran out of time.' });
});

test('a press whose wait is over says the build is still running, as the site expects of a running one', async () => {
  const jobs = createJobs({ 'debate-atlas': { run: () => new Promise(() => {}) } });
  const result = await pressResultsBuild({ kindName: 'debate-atlas', config: {}, deps: buildDeps(jobs) });
  assert.equal(result.status, 409);
  assert.equal(result.reason, 'debate_atlas_build_running');
  assert.equal(result.active.startedAtMs, 1_000_000);
  assert.ok(jobs.clock.ms >= 1_000_000 + RESULTS_BUILD_WAIT_MS);
});

test('a press the build would refuse starts no job', async () => {
  let started = false;
  const deps = { callResultsJob: async () => { started = true; return { ok: false }; } };
  const off = await pressResultsBuild({ kindName: 'debate-atlas', config: { scopes: { ai: false } }, deps });
  assert.equal(off.status, 403);
  const supplied = await pressResultsBuild({ kindName: 'debate-atlas', config: {}, body: { source: { kind: 'admin-snapshot' } }, deps });
  assert.equal(supplied.status, 400);
  assert.equal(started, false);
});

test('an AI Views press joining another’s job finds the draft under that job’s request, with no second call', async () => {
  const generated = [];
  let finish;
  const jobs = createJobs({ 'ai-views': { run: ({ job }) => new Promise((resolve) => { finish = () => resolve({ ok: true, status: 200, jobState: 'succeeded', requestId: job.input.body.requestId }); }) } });
  // The first press's job is running when the second press comes; it finishes while the second waits.
  await jobs.call('ai-views', 'start', { input: { body: { requestId: 'manual:first' } } });
  const result = await pressResultsAnalysis({
    config: {},
    body: { requestId: 'manual:second', refresh: true, sections: ['summary'] },
    deps: {
      callResultsJob: jobs.call,
      wait: async (ms) => { finish?.(); await jobs.wait(ms); },
      now: jobs.now,
      generateResultsAnalysisDraft: async ({ body, trigger }) => { generated.push({ body, trigger }); return { ok: true, status: 200, jobState: 'succeeded', draft: { draftId: 'd1' } }; },
    },
  });
  assert.deepEqual(result.draft, { draftId: 'd1' });
  assert.equal(generated.length, 1);
  assert.equal(generated[0].body.requestId, 'manual:first');
  assert.equal(generated[0].trigger, 'manual');
});

test('an AI Views press answers 202 while its job runs, and with the job’s failure when it fails', async () => {
  const running = createJobs({ 'ai-views': { run: () => new Promise(() => {}) } });
  const pending = await pressResultsAnalysis({ config: {}, body: { requestId: 'manual:a' }, deps: { callResultsJob: running.call, wait: running.wait, now: running.now } });
  assert.deepEqual(pending, { ok: true, status: 202, jobState: 'running', reservation: { requestId: 'manual:a' } });

  const failing = createJobs({ 'ai-views': { run: async () => ({ ok: false, status: 422, jobState: 'failed', error: 'Results analysis input is not eligible.', reasons: ['Too few answers.'] }) } });
  let generated = false;
  const failed = await pressResultsAnalysis({
    config: {},
    body: { requestId: 'manual:b' },
    deps: { callResultsJob: failing.call, wait: failing.wait, now: failing.now, generateResultsAnalysisDraft: async () => { generated = true; } },
  });
  assert.deepEqual(failed, { ok: false, status: 422, jobState: 'failed', error: 'Results analysis input is not eligible.', reasons: ['Too few answers.'] });
  assert.equal(generated, false, 'a failure is never generated again');

  // A job that found another AI Views run holding the lease answers as that one runs.
  const inputs = [];
  const behind = createJobs({ 'ai-views': { run: async ({ job }) => { inputs.push(job.input); return { ok: true, status: 202, jobState: 'running' }; } } });
  const queued = await pressResultsAnalysis({
    config: {},
    body: { requestId: 'manual:c', refresh: true, sections: ['summary'], source: { kind: 'admin-snapshot' } },
    deps: { callResultsJob: behind.call, wait: behind.wait, now: behind.now, generateResultsAnalysisDraft: async () => { generated = true; } },
  });
  assert.equal(queued.status, 202);
  assert.equal(generated, false);
  assert.deepEqual(inputs, [{ body: { requestId: 'manual:c', refresh: true, sections: ['summary'], source: { kind: 'worker-canonical' } } }]);
});
