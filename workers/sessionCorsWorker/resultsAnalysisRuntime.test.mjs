import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { buildDebateAtlas } from './debateAtlasBuild.js';
import {
  generateResultsAnalysisDraft,
  loadWorkerCanonicalResultsAnalysisSource,
  maybeTriggerAutomaticResultsAnalysis,
} from './resultsAnalysisGeneration.js';
import { buildIndexKey, buildObjectKey, buildPayloadKey, readStoredCloudflarePayloadsBulk } from './storageRouteExecution.js';

// Results reads against the KV and R2 of workerd, the Workers runtime, which
// wrangler runs locally. Its KV refuses a bulk get of more than 100 keys or a
// reply over 25 MB, as Cloudflare's does. The tests count each operation.

const MiB = 1024 * 1024;
const config = {
  sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  sessionName: 'Salon',
  ai: { model: 'test-model' },
  sessionModeProfile: { authority: { mode: 'worker_canonical' }, storage: { backend: 'cloudflare' } },
  resultsAnalysis: { version: 1, generationMode: 'both', views: { circles: false, breakdown: true, riskMatrix: false }, autoAfter: { threshold: 2, unit: 'distinctParticipants' }, inputScope: 'submitted', publication: 'latest_success_visible' },
};
const address = (number) => `0x${number.toString(16).padStart(40, '0')}`;

let runtime;
let configDir;
before(async () => {
  // Otherwise Miniflare fetches Cloudflare's request metadata (cf.json) over the network.
  process.env.NODE_ENV = 'test';
  configDir = mkdtempSync(join(tmpdir(), 'ce-results-runtime-'));
  const configPath = join(configDir, 'wrangler.json');
  writeFileSync(configPath, JSON.stringify({
    name: 'results-runtime-test',
    compatibility_date: '2025-08-01',
    kv_namespaces: [{ binding: 'KV', id: 'results-runtime-kv' }],
    r2_buckets: [{ binding: 'R2', bucket_name: 'results-runtime-r2' }],
  }));
  runtime = await getPlatformProxy({ configPath, persist: false });
  await seedSalon('salon');
});
after(async () => {
  await runtime?.dispose();
  rmSync(configDir, { recursive: true, force: true });
});

// A binding as the Worker sees it, counting its operations and the keys it
// gets. `fail` makes a get throw, as a storage outage would.
const counted = (binding, { fail } = {}) => {
  const counts = { operations: 0, keys: [] };
  const count = (method) => async (...args) => {
    counts.operations += 1;
    if (method === 'get') {
      counts.keys.push(...[args[0]].flat());
      if (fail?.(args[0])) throw new Error('storage unavailable');
    }
    return binding[method](...args);
  };
  return { counts, binding: { get: count('get'), list: count('list') } };
};

// Stores an item as the storage routes do: its row in the KV index, and its
// bytes in R2 when given or else in a KV envelope beside a copy of the row.
const storeItem = async ({ slug, resource, id, payload, metadata = {}, r2 }) => {
  const bytes = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload));
  const row = { id, resource, contentType: 'application/json', createdAt: '2026-11-24T09:00:00.000Z', size: bytes.length, ...metadata };
  await runtime.env.KV.put(buildIndexKey({ slug, resource, id }), JSON.stringify(row));
  if (r2) await r2.put(buildObjectKey({ slug, id }), new Uint8Array(bytes));
  else await runtime.env.KV.put(buildPayloadKey({ slug, id }), JSON.stringify({ metadata: row, payloadBase64url: bytes.toString('base64url') }));
};
const storeAll = async (items) => {
  for (let start = 0; start < items.length; start += 200) await Promise.all(items.slice(start, start + 200).map(storeItem));
};
const question = (slug, number) => ({ slug, resource: 'questions', id: `question-${number}`,
  payload: { sessionSlug: slug, sessionId: config.sessionId, questionId: `q${number}`, prompt: `Question ${number}?`, type: 'text' } });
const answer = (slug, id, person, number, text, createdAt) => ({ slug, resource: 'responses', id,
  payload: { sessionSlug: slug, sessionId: config.sessionId, questionId: `q${number}`, answer: text },
  metadata: { responder: address(person), ...(createdAt ? { createdAt } : {}) } });

// About 80 people answering 30 questions, as at a salon, with a fifth of the
// answers changed once: each changed answer is stored twice.
const seedSalon = async (slug) => {
  const items = Array.from({ length: 30 }, (_, index) => question(slug, index + 1));
  for (let person = 1; person <= 80; person += 1) {
    for (let number = 1; number <= 30; number += 1) {
      const versions = (person + number) % 5 === 0 ? 2 : 1;
      for (let version = 0; version < versions; version += 1) {
        items.push(answer(slug, `answer-${String(items.length).padStart(5, '0')}`, person, number,
          version ? 'Changed view.' : 'First view.', `2026-11-24T1${version}:00:00.000Z`));
      }
    }
  }
  await storeAll(items);
};
const salonEnv = (options) => {
  const kv = counted(runtime.env.KV, options);
  return { kv, env: { CE_STORAGE_INDEX_KV: kv.binding } };
};
// Cloudflare allows 1,000 KV operations a request, and a scan budgets 800.
const assertFewOperations = (kv) => assert.ok(kv.counts.operations <= 120, `${kv.counts.operations} operations`);

test('80 people answering 30 questions are read whole, in bulk, well inside the scan budget', async () => {
  const { kv, env } = salonEnv();
  const source = await loadWorkerCanonicalResultsAnalysisSource({ env, slug: 'salon', config });
  assert.equal(source.ok, true, source.error);
  assert.equal(source.counts.responseCount, 2400);
  assert.equal(source.counts.participantCount, 80);
  assert.equal(source.snapshot.responses.filter((response) => response.answer === 'Changed view.').length, 480);
  assertFewOperations(kv);
});

const generated = { ok: true, value: { breakdown: { summary: { overview: 'Synthesis.' } } } };
const coordinated = {
  readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: {} }),
  reserveCoordinatedResultsAnalysis: async () => ({ kind: 'execute', attemptId: 'attempt-1' }),
  finalizeCoordinatedResultsAnalysis: async () => ({ ok: true }),
};

test('AI Views, asked for or automatic, analyse every answer of a salon-sized session', async () => {
  for (const run of [
    (env, deps) => generateResultsAnalysisDraft({ env, slug: 'salon', config, body: { requestId: 'salon-manual' }, deps }),
    (env, deps) => maybeTriggerAutomaticResultsAnalysis({ env, slug: 'salon', config, requestId: 'salon-automatic', deps }),
  ]) {
    const { kv, env } = salonEnv();
    let analysed = null;
    const result = await run(env, { ...coordinated, generateAnalysisArtifact: async ({ source }) => { analysed = source; return generated; } });
    assert.equal(result.ok, true, result.error);
    assert.equal(analysed.snapshot.responses.length, 2400);
    assert.equal(analysed.counts.participantCount, 80);
    assertFewOperations(kv);
  }
});

// A plan of two branches, each of two topics, that covers all 30 questions.
const atlasPlan = {
  title: 'Atlas',
  branches: [0, 1].map((branch) => ({
    label: `Branch ${branch + 1}`,
    summary: 'A branch.',
    topics: [0, 1].map((topic) => ({
      label: `Topic ${branch + 1}.${topic + 1}`,
      questionIds: Array.from({ length: 30 }, (_, index) => `q${index + 1}`).filter((_, index) => index % 4 === branch * 2 + topic),
    })),
  })),
};
const atlasMap = {
  summary: 'They split.',
  compass: { x: { label: 'Pace', left: 'Slow', right: 'Fast' }, y: { label: 'Scope', top: 'Local', bottom: 'Global' } },
  positions: [{ label: 'Go slow', summary: 'Care first.', participantIds: ['participant_001', 'participant_002'], x: 0.1, y: 0.8 }],
  participants: [{ participantId: 'participant_001', x: 0.2, y: 0.9, reason: 'Wants care.' }],
};
// The session coordinator's store, keeping each build a run finalizes.
const buildStore = (builds) => async (_env, _slug, operation, payload) => {
  if (operation === 'finalize' && payload.build) builds.push(payload.build);
  return { ok: true, status: 200, body: { ok: true, attemptId: 'attempt-1' } };
};
const buildAtlas = ({ env, builds }) => buildDebateAtlas({
  env, slug: 'salon', config, builderAddress: address(1),
  deps: {
    callBuildStore: buildStore(builds),
    getSessionSecrets: async () => ({}),
    callProvider: async ({ prompt }) => ({ ok: true, value: prompt.startsWith('You are planning') ? atlasPlan : atlasMap }),
  },
});

// The AI reads a window of the answers, every question in it; the counts say
// how many it read of the whole.
test('the atlas build reads every answer of a salon-sized session', async () => {
  const { kv, env } = salonEnv();
  const builds = [];
  const result = await buildAtlas({ env, builds });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual([builds[0].counts.responses, builds[0].counts.participants, builds[0].counts.aiQuestions], [2400, 80, 30]);
  assertFewOperations(kv);
});

test('a build stops, keeping nothing, when an answer cannot be read', async () => {
  const payloadKey = buildPayloadKey({ slug: 'salon', id: 'answer-01234' });
  const { env } = salonEnv({ fail: (keys) => [keys].flat().includes(payloadKey) });
  const builds = [];
  const result = await buildAtlas({ env, builds });
  assert.equal(result.ok, false);
  assert.match(result.error, /could not be read/);
  assert.deepEqual(builds, []);
});

test('bulk payload reads keep each reply under the 25 MB limit', async () => {
  // Three 9 MiB payloads: 12 MiB each as base64url, 36 MiB in one reply.
  const items = ['large-1', 'large-2', 'large-3'].map((id) => ({ slug: 'large', resource: 'responses', id, payload: 'x'.repeat(9 * MiB) }));
  await storeAll(items);
  const keys = items.map(({ id }) => buildPayloadKey({ slug: 'large', id }));
  await assert.rejects(runtime.env.KV.get(keys), /413/);

  const kv = counted(runtime.env.KV);
  const payloads = await readStoredCloudflarePayloadsBulk({ env: {}, index: kv.binding, slug: 'large',
    metadataList: items.map(({ id }) => ({ id, size: 9 * MiB })) });
  assert.deepEqual([...payloads.values()].map((bytes) => bytes.length), [9 * MiB, 9 * MiB, 9 * MiB]);
  assert.equal(kv.counts.operations, 3);
});

test('answers too large for one scan are refused as too large, not read in part', async () => {
  await storeAll([question('outsized', 1),
    ...[1, 2, 3].map((person) => answer('outsized', `answer-${person}`, person, 1, 'x'.repeat(7 * MiB)))]);
  const source = await loadWorkerCanonicalResultsAnalysisSource({ env: salonEnv().env, slug: 'outsized', config });
  assert.equal(source.ok, false);
  assert.equal(source.reason, 'results_analysis_snapshot_limit');
  assert.equal(source.snapshot, undefined);
});

// An answer kept before R2 was bound is still in KV, and is read from there.
test('with R2 bound, each payload is one R2 read, and KV gives only what R2 lacks', async () => {
  const slug = 'stored-in-r2';
  await storeAll([question(slug, 1), ...[1, 2, 3].map((person) => answer(slug, `answer-${person}`, person, 1, `View ${person}`))]
    .map((item) => ({ ...item, r2: runtime.env.R2 })));
  await storeAll([answer(slug, 'answer-4', 4, 1, 'View 4')]);
  const fallback = buildPayloadKey({ slug, id: 'answer-4' });
  const load = async (options) => {
    const r2 = counted(runtime.env.R2);
    const kv = counted(runtime.env.KV, options);
    const source = await loadWorkerCanonicalResultsAnalysisSource({ env: { CE_STORAGE_INDEX_KV: kv.binding, CE_STORAGE_R2: r2.binding }, slug, config });
    return { source, r2, kv };
  };
  const { source, r2, kv } = await load();
  assert.equal(source.ok, true, source.error);
  assert.deepEqual(source.snapshot.responses.map((response) => response.answer).sort(), ['View 1', 'View 2', 'View 3', 'View 4']);
  assert.equal(r2.counts.operations, 5);
  assert.deepEqual(kv.counts.keys.filter((key) => key.startsWith('ce-storage-payload:')), [fallback]);

  const failed = await load({ fail: (keys) => [keys].flat().includes(fallback) });
  assert.equal(failed.source.ok, false);
  assert.equal(failed.source.snapshot, undefined);
});
