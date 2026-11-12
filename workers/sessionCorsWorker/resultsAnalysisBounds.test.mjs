import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionWriteCoordinator } from './sessionWriteCoordinator.js';
import { generateResultsAnalysisDraft, loadWorkerCanonicalResultsAnalysisSource, maybeTriggerAutomaticResultsAnalysis, readResultsAnalysisAdminStatus, runQueuedAutomaticResultsAnalysisJob } from './resultsAnalysisGeneration.js';
import { buildIndexKey, buildPayloadKey, readStoredCloudflarePayloadsBulk } from './storageRouteExecution.js';
import { RESULTS_ANALYSIS_SCAN_LIMITS } from './storageScanBudget.js';

const config = {
  sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  sessionModeProfile: { authority: { mode: 'worker_canonical' }, storage: { backend: 'cloudflare' } },
  resultsAnalysis: { version: 1, generationMode: 'both', views: { circles: false, breakdown: true, riskMatrix: false }, autoAfter: { threshold: 2, unit: 'distinctParticipants' }, inputScope: 'submitted', publication: 'latest_success_visible' },
};
// More rows than one scan may read, so only the row cap can stop it.
const OVERSIZED_ROWS = RESULTS_ANALYSIS_SCAN_LIMITS.rows + 100;
const oversizedHistory = () => {
  let operations = 0;
  const row = (key) => JSON.stringify({ id: key.split(':').at(-1), encrypted: true });
  const index = {
    list: async ({ prefix, cursor = '', limit = 1000 }) => {
      operations += 1;
      if (!prefix.startsWith('ce-storage:session-a:responses:')) return { keys: [], list_complete: true };
      const offset = Number(cursor || 0);
      const end = Math.min(offset + limit, OVERSIZED_ROWS);
      return { keys: Array.from({ length: end - offset }, (_, i) => ({ name: `${prefix}${offset + i}` })), list_complete: end === OVERSIZED_ROWS, cursor: String(end) };
    },
    get: async (key) => { operations += 1; return Array.isArray(key) ? new Map(key.map((name) => [name, row(name)])) : row(key); },
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
  ['metadata bytes', JSON.stringify({ id: 'question-1', padding: 'x'.repeat(RESULTS_ANALYSIS_SCAN_LIMITS.metadataBytes) })],
  ['payload bytes', JSON.stringify({ id: 'question-1', size: RESULTS_ANALYSIS_SCAN_LIMITS.payloadBytes + 1 })],
]) {
  test(`canonical analysis bounds ${label} before reading a large payload`, async () => {
    let payloadReads = 0;
    const env = { CE_STORAGE_INDEX_KV: {
      list: async ({ prefix }) => ({ keys: prefix.startsWith('ce-storage:session-a:questions:') ? [{ name: `${prefix}question-1` }] : [], list_complete: true }),
      get: async (key) => (Array.isArray(key) ? new Map(key.map((name) => [name, raw])) : raw),
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
    committedResponses: Array.from({ length: RESULTS_ANALYSIS_SCAN_LIMITS.rows + 1 }, () => ({ metadata: {}, payload: {} })) });
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
    // A key list is Cloudflare's bulk get: one operation, at most 100 keys.
    get: async (key) => {
      operations += 1;
      if (!Array.isArray(key)) return values.get(key) ?? null;
      assert.ok(key.length <= 100, `bulk get of ${key.length} keys`);
      return new Map(key.map((name) => [name, values.get(name) ?? null]));
    },
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

// About 80 people answering 30 questions, as at a salon, with a fifth of the
// answers changed once: each changed answer is stored twice.
test('a salon-sized session is read whole, in bulk, well inside the scan budget', async () => {
  const history = readableHistory(0);
  for (let question = 2; question <= 30; question += 1) {
    history.put('questions', `qmeta-${question}`, { ...history.identity, questionId: `q${question}`, prompt: `Question ${question}?`, type: 'text' });
  }
  let stored = 0;
  for (let person = 1; person <= 80; person += 1) {
    for (let question = 1; question <= 30; question += 1) {
      const versions = (person + question) % 5 === 0 ? 2 : 1;
      for (let version = 0; version < versions; version += 1) {
        stored += 1;
        history.put('responses', `answer-${String(stored).padStart(5, '0')}`,
          { ...history.identity, questionId: `q${question}`, answer: version ? 'Changed view.' : 'First view.' },
          { responder: `0x${person.toString(16).padStart(40, '0')}`, createdAt: `2026-11-24T1${version}:00:00.000Z` });
      }
    }
  }
  assert.equal(stored, 2880);
  const source = await loadWorkerCanonicalResultsAnalysisSource({ env: { CE_STORAGE_INDEX_KV: history.index }, slug: 'session-a', config });
  assert.equal(source.ok, true, source.error);
  assert.equal(source.counts.responseCount, 2400);
  assert.equal(source.counts.participantCount, 80);
  assert.equal(source.snapshot.responses.filter((response) => response.answer === 'Changed view.').length, 480);
  assert.ok(history.operations <= 100, `${history.operations} operations`);
});

test('bulk payload reads keep each reply under the bulk limit, and leave R2 to single reads', async () => {
  const gets = [];
  const index = { get: async (keys) => { gets.push(keys); return new Map(keys.map((key) => [key, null])); } };
  // A 7 MiB payload is about 9.3 MiB of base64url, so a bulk reply holds one beside small ones.
  const metadataList = [
    ...[0, 1, 2].map((i) => ({ id: `large-${i}`, size: 7 * 1024 * 1024 })),
    ...Array.from({ length: 150 }, (_, i) => ({ id: `small-${i}`, size: 120 })),
  ];
  const payloads = await readStoredCloudflarePayloadsBulk({ env: {}, index, slug: 'session-a', metadataList });
  assert.deepEqual(gets.map((keys) => keys.length), [1, 1, 100, 51]);
  assert.deepEqual(gets[0], [buildPayloadKey({ slug: 'session-a', id: 'large-0' })]);
  assert.equal(payloads.size, 153);
  assert.ok([...payloads.values()].every((bytes) => bytes === null));

  gets.length = 0;
  assert.equal((await readStoredCloudflarePayloadsBulk({ env: { CE_STORAGE_R2: {} }, index, slug: 'session-a', metadataList })).size, 0);
  // A payload larger than the scan may still read fails before any read.
  const budget = { operation: () => {}, payload: () => {}, remainingPayloadBytes: 1024 };
  await assert.rejects(readStoredCloudflarePayloadsBulk({ env: {}, index, slug: 'session-a', metadataList: [{ id: 'big', size: 1025 }], budget }),
    /synchronous read limit/);
  assert.deepEqual(gets, []);
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
    list: async ({ prefix = '' } = {}) => new Map([...values].filter(([key]) => key.startsWith(prefix))),
    delete: async (key) => values.delete(key), transaction: async (callback) => callback(storage), setAlarm: async () => {} };
  const env = {};
  let providerCalls = 0;
  const coordinator = new SessionWriteCoordinator({ storage }, env, {
    runResultsAnalysisAutoJob: (args) => runQueuedAutomaticResultsAnalysisJob({ ...args,
      deps: { ...args.deps, getSessionConfig: async () => config, generateAnalysisArtifact: async () => { providerCalls += 1; return { ok: true, value: {} }; } } }),
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
    const newest = buildIndexKey({ slug: 'session-a', resource: 'responses', id: 'newest' });
    history.index.get = async (key) => {
      if (![key].flat().includes(newest)) return get(key);
      if (failure === 'throw') throw new Error('temporary read failure');
      const value = failure === 'missing' ? null : '{broken';
      return Array.isArray(key) ? new Map([...(await get(key))].map(([name, raw]) => [name, name === newest ? value : raw])) : value;
    };
    const source = await loadWorkerCanonicalResultsAnalysisSource({ env: { CE_STORAGE_INDEX_KV: history.index }, slug: 'session-a', config });
    assert.equal(source.ok, false, failure);
    assert.equal(source.status, 503);
    assert.equal(source.snapshot, undefined);
  }
});

// With R2 bound, a payload R2 lacks is read from KV, where it was kept before.
test('a failed answer read fails the snapshot rather than dropping the answer', async () => {
  for (const storage of [{}, { CE_STORAGE_R2: { get: async () => null } }]) {
    const history = readableHistory();
    const get = history.index.get;
    const payload = buildPayloadKey({ slug: 'session-a', id: 'response-0001' });
    history.index.get = async (key) => {
      if ([key].flat().includes(payload)) throw new Error('temporary read failure');
      return get(key);
    };
    const source = await loadWorkerCanonicalResultsAnalysisSource({ env: { CE_STORAGE_INDEX_KV: history.index, ...storage }, slug: 'session-a', config });
    assert.equal(source.ok, false, Object.keys(storage).join() || 'KV only');
    assert.equal(source.reason, 'results_analysis_snapshot_unavailable');
    assert.equal(source.snapshot, undefined);
  }
});

// The KV projection can lag the durable authority. After an admin disables AI,
// a queued job must not reach the provider any more than a manual request can.
test('queued and manual analysis both honor the authoritative AI policy over a stale KV projection', async () => {
  const values = new Map();
  const storage = { get: async (key) => structuredClone(values.get(key)), put: async (key, value) => values.set(key, structuredClone(value)),
    list: async ({ prefix = '' } = {}) => new Map([...values].filter(([key]) => key.startsWith(prefix))),
    delete: async (key) => values.delete(key), transaction: async (callback) => callback(storage), setAlarm: async () => {} };
  const enabled = { ...config, slug: 'session-a' };
  values.set('session-config-authority', { schemaVersion: 1, slug: 'session-a', revision: 2, config: { ...enabled, scopes: { ai: false } }, projectionPending: false });
  const staleProjection = new Map([['session:session-a:config', JSON.stringify(enabled)]]);
  // Readable answers, so only the policy can keep the job from the provider.
  const env = { GROUP_KV: { get: async (key) => staleProjection.get(key) ?? null }, CE_STORAGE_INDEX_KV: readableHistory().index };
  let providerCalls = 0;
  const generateAnalysisArtifact = async () => { providerCalls += 1; return { ok: true, value: {} }; };
  const coordinator = new SessionWriteCoordinator({ storage }, env, {
    runResultsAnalysisAutoJob: (args) => runQueuedAutomaticResultsAnalysisJob({ ...args, deps: { ...args.deps, generateAnalysisArtifact } }),
  });

  const { config: authoritative } = await coordinator.readCurrentSessionConfig('session-a');
  const manual = await generateResultsAnalysisDraft({ env, slug: 'session-a', config: authoritative, trigger: 'manual',
    body: { requestId: 'manual', source: { kind: 'worker-canonical' } }, deps: { generateAnalysisArtifact } });
  assert.equal(manual.ok, false);
  await coordinator.enqueueResultsAnalysisAutoJob({ slug: 'session-a', requestId: 'queued', committedResponses: [] });
  const queued = await coordinator.runQueuedResultsAnalysisAutoJob();
  assert.equal(queued.reason, 'ai_scope_disabled');
  assert.equal(providerCalls, 0);
});

test('queued analysis fails closed without the coordinator config authority', async () => {
  const result = await runQueuedAutomaticResultsAnalysisJob({ env: {}, slug: 'session-a', job: { slug: 'session-a' }, deps: {} });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
});
