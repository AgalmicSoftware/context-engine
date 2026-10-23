import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';
import { generateResultsAnalysisDraft, loadWorkerCanonicalResultsAnalysisSource, maybeTriggerAutomaticResultsAnalysis, readResultsAnalysisAdminStatus, runQueuedAutomaticResultsAnalysisJob } from './resultsAnalysisGeneration.js';
import { buildIndexKey, buildPayloadKey } from './storageRouteExecution.js';

const config = {
  sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  sessionModeProfile: { authority: { mode: 'worker_canonical' }, storage: { backend: 'cloudflare' } },
  resultsAnalysis: { version: 1, generationMode: 'both', views: { circles: false, breakdown: true, riskMatrix: false }, autoAfter: { threshold: 2, unit: 'distinctParticipants' }, inputScope: 'submitted', publication: 'latest_success_visible' },
};
const oversizedHistory = () => {
  let operations = 0;
  const index = {
    list: async ({ prefix, cursor = '', limit = 1000 }) => {
      operations += 1;
      if (!prefix.startsWith('ce-storage:session-a:responses:')) return { keys: [], list_complete: true };
      const offset = Number(cursor || 0);
      const end = Math.min(offset + limit, 1100);
      return { keys: Array.from({ length: end - offset }, (_, i) => ({ name: `${prefix}${offset + i}` })), list_complete: end === 1100, cursor: String(end) };
    },
    get: async (key) => { operations += 1; return JSON.stringify({ id: key.split(':').at(-1), encrypted: true }); },
  };
  return { index, get operations() { return operations; } };
};

test('canonical analysis fails clearly before an unbounded history scan completes', async () => {
  const history = oversizedHistory();
  const source = await loadWorkerCanonicalResultsAnalysisSource({ env: { CE_STORAGE_INDEX_KV: history.index }, slug: 'session-a', config });
  assert.equal(source.ok, false);
  assert.equal(source.status, 503);
  assert.match(source.error, /synchronous.*limit/i);
  assert.ok(history.operations <= 800);
  assert.equal(source.snapshot, undefined);
});

test('an oversized canonical source neither calls AI nor replaces the last good artifact', async () => {
  const values = new Map();
  const storage = { get: async (key) => structuredClone(values.get(key)), put: async (key, value) => values.set(key, structuredClone(value)),
    delete: async (key) => values.delete(key), transaction: async (callback) => callback(storage) };
  const env = {};
  const coordinator = new SessionWriteCoordinator({ storage }, env);
  env.CE_SESSION_COORDINATOR = { idFromName: (name) => name, get: () => ({ fetch: (url, init) => coordinator.fetch(new Request(url, init)) }) };
  const initial = await generateResultsAnalysisDraft({ env, slug: 'session-a', config,
    body: { requestId: 'initial', source: { kind: 'admin-snapshot', snapshot: { sessionSlug: 'session-a', sessionId: config.sessionId,
      questions: [{ id: 'q1', type: 'freeform', prompt: 'Thoughts?' }], responses: [1, 2, 3].map((id) => ({ participantId: `test-participant-${id}`, questionId: 'q1', answer: 'A view.' })) } } },
    deps: { generateAnalysisArtifact: async () => ({ ok: true, value: { breakdown: { summary: { overview: 'Last good synthesis.' } } } }) },
  });
  assert.equal(initial.ok, true, JSON.stringify(initial));
  env.CE_STORAGE_INDEX_KV = oversizedHistory().index;
  let providerCalls = 0;
  const result = await generateResultsAnalysisDraft({ env, slug: 'session-a', config, body: { requestId: 'too-large', source: { kind: 'worker-canonical' } },
    deps: { generateAnalysisArtifact: async () => { providerCalls += 1; return { ok: true }; } } });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(providerCalls, 0);
  const status = await readResultsAnalysisAdminStatus({ env, slug: 'session-a', config });
  assert.deepEqual(status.state.lastGood.artifact, initial.draft.artifact);
});

for (const [label, raw] of [
  ['metadata bytes', JSON.stringify({ id: 'question-1', padding: 'x'.repeat(2 * 1024 * 1024) })],
  ['payload bytes', JSON.stringify({ id: 'question-1', size: 9 * 1024 * 1024 })],
]) {
  test(`canonical analysis bounds ${label} before reading a large payload`, async () => {
    let payloadReads = 0;
    const env = { CE_STORAGE_INDEX_KV: {
      list: async ({ prefix }) => ({ keys: prefix.startsWith('ce-storage:session-a:questions:') ? [{ name: `${prefix}question-1` }] : [], list_complete: true }),
      get: async () => raw,
    }, CE_STORAGE_R2: { get: async () => { payloadReads += 1; throw new Error('must not read payload'); } } };
    const source = await loadWorkerCanonicalResultsAnalysisSource({ env, config, slug: 'session-a' });
    assert.equal(source.status, 503);
    assert.match(source.error, /synchronous analysis limit/);
    assert.equal(payloadReads, 0);
  });
}

test('committed responses cannot bypass the canonical snapshot row budget', async () => {
  const env = { CE_STORAGE_INDEX_KV: { list: async () => ({ keys: [], list_complete: true }), get: async () => null } };
  const source = await loadWorkerCanonicalResultsAnalysisSource({ env, config, slug: 'session-a',
    committedResponses: Array.from({ length: 1001 }, () => ({ metadata: {}, payload: {} })) });
  assert.equal(source.status, 503);
  assert.equal(source.snapshot, undefined);
});

const readableHistory = (count = 3) => {
  const values = new Map();
  let operations = 0;
  const put = (resource, id, payload, metadata = {}) => {
    const fullMetadata = { id, resource, contentType: 'application/json', createdAt: '2026-09-17T00:00:00.000Z', ...metadata };
    values.set(buildIndexKey({ slug: 'session-a', resource, id }), JSON.stringify(fullMetadata));
    values.set(buildPayloadKey({ slug: 'session-a', id }), JSON.stringify({ metadata: fullMetadata, payloadBase64url: Buffer.from(JSON.stringify(payload)).toString('base64url') }));
  };
  const identity = { sessionSlug: 'session-a', sessionId: config.sessionId };
  put('questions', 'qmeta', { ...identity, questionId: 'q1', prompt: 'Question?', type: 'text' });
  for (let i = 0; i < count; i += 1) put('responses', `response-${String(i).padStart(4, '0')}`,
    { ...identity, questionId: 'q1', answer: `View ${i}` }, { responder: `0x${String(i + 1).padStart(40, '0')}` });
  const index = {
    get: async (key) => { operations += 1; return values.get(key) ?? null; },
    list: async ({ prefix, cursor = '', limit = 1000 }) => {
      operations += 1;
      const keys = [...values.keys()].filter((key) => key.startsWith(prefix)).sort();
      const offset = Number(cursor || 0);
      const end = Math.min(offset + limit, keys.length);
      return { keys: keys.slice(offset, end).map((name) => ({ name })), list_complete: end === keys.length, cursor: String(end) };
    },
  };
  return { index, put, identity, get operations() { return operations; } };
};

test('automatic analysis reuses one complete source and one scan budget through generation', async () => {
  const history = readableHistory(390);
  const env = { CE_STORAGE_INDEX_KV: history.index };
  assert.equal((await loadWorkerCanonicalResultsAnalysisSource({ env, slug: 'session-a', config })).ok, true);
  const singleScanOperations = history.operations;
  let operationsAtProvider = 0;
  const result = await maybeTriggerAutomaticResultsAnalysis({ env, slug: 'session-a', config, requestId: 'one-snapshot',
    deps: {
      readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: {} }),
      reserveCoordinatedResultsAnalysis: async () => ({ kind: 'execute', attemptId: 'attempt-1' }),
      finalizeCoordinatedResultsAnalysis: async () => ({ ok: true }),
      generateAnalysisArtifact: async ({ source }) => {
        operationsAtProvider = history.operations - singleScanOperations;
        assert.equal(source.snapshot.responses.length, 390);
        return { ok: true, value: { breakdown: { summary: { overview: 'Synthesis.' } } } };
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(operationsAtProvider, singleScanOperations);
  assert.ok(operationsAtProvider <= 800);
});

test('automatic analysis checks its pause state before any storage scan', async () => {
  const history = readableHistory();
  const result = await maybeTriggerAutomaticResultsAnalysis({ env: { CE_STORAGE_INDEX_KV: history.index }, slug: 'session-a', config,
    deps: { readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: { lastFailure: { trigger: 'automatic' } } }) } });
  assert.equal(result.reason, 'automatic_paused_after_failure');
  assert.equal(history.operations, 0);
});

test('automatic capacity failure is recorded and later uploads do not rescan or replace the last good report', async () => {
  const values = new Map();
  const storage = { get: async (key) => structuredClone(values.get(key)), put: async (key, value) => values.set(key, structuredClone(value)),
    delete: async (key) => values.delete(key), transaction: async (callback) => callback(storage), setAlarm: async () => {} };
  const env = {};
  let providerCalls = 0;
  const coordinator = new SessionWriteCoordinator({ storage }, env, {
    runResultsAnalysisAutoJob: (args) => runQueuedAutomaticResultsAnalysisJob({ ...args, job: { ...args.job, config },
      deps: { ...args.deps, generateAnalysisArtifact: async () => { providerCalls += 1; return { ok: true, value: {} }; } } }),
  });
  env.CE_SESSION_COORDINATOR = { idFromName: (name) => name, get: () => ({ fetch: (url, init) => coordinator.fetch(new Request(url, init)) }) };
  const initial = await generateResultsAnalysisDraft({ env, slug: 'session-a', config,
    body: { requestId: 'initial', source: { kind: 'admin-snapshot', snapshot: { sessionSlug: 'session-a', sessionId: config.sessionId,
      questions: [{ id: 'q1', type: 'text', prompt: 'Question?' }], responses: [1, 2, 3].map((id) => ({ participantId: `fixture-${id}`, questionId: 'q1', answer: 'A view.' })) } } },
    deps: { generateAnalysisArtifact: async () => ({ ok: true, value: { breakdown: { summary: { overview: 'Last good.' } } } }) } });
  assert.equal(initial.ok, true);
  const history = oversizedHistory();
  env.CE_STORAGE_INDEX_KV = history.index;
  await coordinator.enqueueResultsAnalysisAutoJob({ slug: 'session-a', requestId: 'over-capacity', committedResponses: [] });
  await coordinator.alarm();
  const failed = await coordinator.readResultsAnalysisStatus();
  assert.equal(failed.jobState, 'failed');
  assert.equal(failed.lastFailure.status, 503);
  assert.equal(failed.lastFailure.trigger, 'automatic');
  assert.equal(failed.lastFailure.requestId, 'over-capacity');
  assert.deepEqual(failed.lastGood.artifact, initial.draft.artifact);
  const operationsAfterFailure = history.operations;
  await coordinator.enqueueResultsAnalysisAutoJob({ slug: 'session-a', requestId: 'later-upload', committedResponses: [] });
  await coordinator.alarm();
  assert.equal(history.operations, operationsAfterFailure);
  assert.equal(providerCalls, 0);
  assert.equal((await coordinator.readResultsAnalysisStatus()).lastFailure.requestId, 'over-capacity');
});

test('unreadable latest answer metadata cannot silently select the participant older answer', async () => {
  for (const failure of ['throw', 'missing', 'malformed']) {
    const history = readableHistory();
    history.put('responses', 'newest', { ...history.identity, questionId: 'q1', answer: 'Changed view.' }, {
      responder: `0x${'1'.padStart(40, '0')}`, createdAt: '2026-09-18T00:00:00.000Z',
    });
    const get = history.index.get;
    history.index.get = async (key) => {
      if (key === buildIndexKey({ slug: 'session-a', resource: 'responses', id: 'newest' })) {
        if (failure === 'throw') throw new Error('temporary read failure');
        return failure === 'missing' ? null : '{broken';
      }
      return get(key);
    };
    const source = await loadWorkerCanonicalResultsAnalysisSource({ env: { CE_STORAGE_INDEX_KV: history.index }, slug: 'session-a', config });
    assert.equal(source.ok, false, failure);
    assert.equal(source.status, 503);
    assert.equal(source.snapshot, undefined);
  }
});
