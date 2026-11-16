import assert from 'node:assert/strict';
import test from 'node:test';

import { Wallet } from 'ethers';
import { answerVersionStamp } from './answerVersionStamp.js';
import { loadWorkerCanonicalResultsAnalysisSource } from './resultsAnalysisGeneration.js';
import { countResultsScanRows } from './resultsScanRowCount.js';
import { buildIndexKey, buildPayloadKey, listedAnswerVersions, storageIndexPutOptions } from './storageRouteExecution.js';
import { SESSION_ID, SLUG, createSessionEnv, login, uploadJson } from './sessionWorkerRuntimeFixture.mjs';

// AI builds choose each person's latest answer to each question. An answer
// stored with its question in its list entry lets a build leave that person's
// older answers to the question unread. Builds must come out exactly as if
// every version were read; rows stored without the entry (0.9.0 wrote none,
// 0.9.6 only the author) are all read, as before.
const session = { sessionId: SESSION_ID, sessionSlug: SLUG };

test('only a single readable answer naming this session is stamped with its question', () => {
  const config = { slug: SLUG, sessionId: SESSION_ID };
  const stamp = (payload) => answerVersionStamp({ payload, slug: SLUG, config });
  assert.deepEqual(stamp({ questionID: ' q-1 ', ...session }), { answerQuestionId: 'q-1', answerSessionId: SESSION_ID });
  // The build reads questionId before questionID, and so does the stamp.
  assert.equal(stamp({ questionId: 'q-2', questionID: 'q-1', ...session }).answerQuestionId, 'q-2');
  for (const payload of [
    { questionID: 'q-1', ...session, responses: [] },
    { questionID: 'q-1', sessionSlug: 'another-session', sessionId: SESSION_ID },
    { questionID: 'q-1', sessionSlug: SLUG, sessionId: `0x${'b'.repeat(32)}` },
    { questionID: 'q-1', sessionSlug: SLUG },
    { ...session },
    null,
  ]) assert.equal(stamp(payload), null, JSON.stringify(payload));
  assert.equal(answerVersionStamp({ payload: { questionID: 'q-1', ...session }, slug: SLUG, config: { slug: SLUG } }), null);
});

test('an answer lists its question only when stamped and readable', () => {
  const metadata = { resource: 'responses', responder: '0xABC', createdAt: '2026-11-13T00:00:00.000Z', answerQuestionId: 'q-1', answerSessionId: SESSION_ID };
  assert.deepEqual(storageIndexPutOptions(metadata).metadata,
    { responder: '0xabc', questionId: 'q-1', sessionId: SESSION_ID, createdAt: '2026-11-13T00:00:00.000Z' });
  for (const locked of [{ encrypted: true }, { payloadEncrypted: true }]) {
    assert.deepEqual(storageIndexPutOptions({ ...metadata, ...locked }).metadata, { responder: '0xabc' });
  }
  assert.deepEqual(storageIndexPutOptions({ ...metadata, answerQuestionId: undefined }).metadata, { responder: '0xabc' });
  // Builds cut a question id at 128 characters without trimming again, so a
  // cut that ends in a space lists exactly as the build keys it.
  const cut = answerVersionStamp({ payload: { questionID: `${'q'.repeat(127)} tail`, ...session }, slug: SLUG, config: { slug: SLUG, sessionId: SESSION_ID } });
  assert.equal(cut.answerQuestionId, `${'q'.repeat(127)} `);
  const listed = storageIndexPutOptions({ ...metadata, answerQuestionId: cut.answerQuestionId }).metadata;
  assert.equal(listed.questionId, cut.answerQuestionId);
  assert.equal(listedAnswerVersions([{ name: 'p:x', metadata: listed }], { prefix: 'p:', sessionId: SESSION_ID })[0].questionId, cut.answerQuestionId);
});

test('a person’s newest stamped answer to a question is the one not marked older, by time then id', () => {
  const prefix = 'p:';
  const entry = (id, questionId, responder, createdAt, sessionId = SESSION_ID) => ({ name: `${prefix}${id}`, metadata: { responder, questionId, sessionId, createdAt } });
  const versions = listedAnswerVersions([
    entry('b', 'q-1', '0xa', '2026-11-13T00:00:00.000Z'),
    entry('a', 'q-1', '0xa', '2026-11-13T00:00:00.000Z'),
    entry('c', 'q-1', '0xa', '2026-11-12T00:00:00.000Z'),
    entry('d', 'q-2', '0xa', '2026-11-11T00:00:00.000Z'),
    entry('e', 'q-1', '0xb', '2026-11-10T00:00:00.000Z'),
    entry('f', 'q-1', '0xb', '2026-11-14T00:00:00.000Z', `0x${'b'.repeat(32)}`),
    { name: `${prefix}g`, metadata: { responder: '0xa' } },
  ], { prefix, sessionId: SESSION_ID });
  assert.deepEqual(versions.map((version) => version && version.older), [false, true, true, false, false, null, null]);
});

// A real session's answers: three versions by one person, two by another, and
// rows shaped as 0.9.0 (no list entry) and 0.9.6 (author only) stored them.
const setup = async () => {
  const created = createSessionEnv();
  const { env, config } = created;
  const kv = env.CE_STORAGE_INDEX_KV;
  const admin = await login({ env, wallet: created.admin });
  for (const id of ['q-1', 'q-2']) {
    assert.equal((await uploadJson({ env, token: admin, resource: 'questions', data: { id, type: 'binary', prompt: `Statement ${id}`, ...session } })).status, 200);
  }
  const people = await Promise.all(['1', '2', '3'].map((digit) => login({ env, wallet: new Wallet(`0x${digit.repeat(64)}`) })));
  const answer = async (token, questionID, value, extra = {}) => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    const stored = await uploadJson({ env, token, resource: 'responses', data: { questionID, answer: { value, encrypted: false }, ...session, ...extra } });
    assert.equal(stored.status, 200, JSON.stringify(stored.body));
    return stored.body.id;
  };
  const indexKey = (id) => buildIndexKey({ slug: SLUG, resource: 'responses', id });
  // Rewrites a stored answer as an older Worker stored it.
  const asOlderWorker = async (id, { author }) => {
    const { answerQuestionId: _q, answerSessionId: _s, ...metadata } = JSON.parse(await kv.get(indexKey(id)));
    await kv.put(indexKey(id), JSON.stringify(metadata), author ? storageIndexPutOptions(metadata) : undefined);
  };
  const [a, b, c] = people;
  await asOlderWorker(await answer(a, 'q-1', 'Agree'), { author: false });
  await asOlderWorker(await answer(b, 'q-1', 'Agree'), { author: true });
  await answer(a, 'q-1', 'Disagree');
  await answer(a, 'q-2', 'Agree');
  await answer(b, 'q-1', 'Disagree');
  await answer(b, 'q-1', 'Agree');
  // Not stamped: it names another session, so builds exclude it.
  await answer(c, 'q-2', 'Agree', { sessionSlug: 'another-session' });
  await answer(a, 'q-1', 'Agree');
  await answer(c, 'q-2', 'Disagree');
  let readKeys = 0;
  let hideEntries = false;
  const counted = {
    put: kv.put.bind(kv),
    async get(key, type) {
      readKeys += [key].flat().filter((name) => name.startsWith(indexKey(''))).length;
      return kv.get(key, type);
    },
    // Without list entries the build reads every version, as before stamps.
    async list(options) {
      const listed = await kv.list(options);
      return hideEntries ? { ...listed, keys: listed.keys.map(({ name }) => ({ name })) } : listed;
    },
  };
  const build = async ({ entries }) => {
    hideEntries = !entries;
    readKeys = 0;
    const source = await loadWorkerCanonicalResultsAnalysisSource({ env: { CE_STORAGE_INDEX_KV: counted }, slug: SLUG, config });
    assert.equal(source.ok, true, JSON.stringify(source));
    return { source, readKeys };
  };
  return { env, kv, config, indexKey, build };
};

test('an AI build leaves older stamped answers unread and comes out exactly as reading every version', async () => {
  const { build } = await setup();
  const all = await build({ entries: false });
  const latest = await build({ entries: true });
  assert.deepEqual(latest.source, all.source);
  // Each person's latest answer to each question, less the one naming another session.
  assert.deepEqual(all.source.counts, { responseCount: 4, participantCount: 3, aiInputParticipantCount: 3, excludedCount: 1,
    lockedCount: 0, aiInputResponseCount: 4, aiInputQuestionCount: 2, totalQuestionCount: 2 });
  // Nine answers stored; two are older stamped versions of an answer to q-1.
  assert.deepEqual([all.readKeys, latest.readKeys], [9, 7]);
});

// Its stored answer now names another session, so the build drops it and an older one is current.
const tamperNewestAnswer = async ({ kv, indexKey }) => {
  const names = (await kv.list({ prefix: indexKey('') })).keys;
  const newest = names.map(({ name, metadata }) => ({ name, metadata })).filter(({ metadata }) => metadata?.questionId === 'q-1')
    .sort((x, y) => x.metadata.createdAt.localeCompare(y.metadata.createdAt)).at(-1);
  const id = newest.name.split(':').pop();
  const payloadKey = buildPayloadKey({ slug: SLUG, id });
  const envelope = JSON.parse(await kv.get(payloadKey));
  const payload = JSON.parse(Buffer.from(envelope.payloadBase64url, 'base64url').toString());
  envelope.payloadBase64url = Buffer.from(JSON.stringify({ ...payload, sessionSlug: 'another-session' })).toString('base64url');
  await kv.put(payloadKey, JSON.stringify(envelope));
};

test('if a newest stamped answer fails to read as stamped, the build reads every version', async () => {
  const { kv, build, indexKey } = await setup();
  await tamperNewestAnswer({ kv, indexKey });
  const all = await build({ entries: false });
  assert.deepEqual((await build({ entries: true })).source, all.source);
});

test('a build that reads every version again shares one operation count with its first pass', async () => {
  const { kv, config, indexKey } = await setup();
  // 450 empty pages before the answers: each list call is one of the 800 operations a build may use.
  const padded = {
    put: kv.put.bind(kv),
    get: kv.get.bind(kv),
    async list({ cursor = '', ...options }) {
      const page = cursor.startsWith('pad:') ? Number(cursor.slice(4)) : cursor ? null : 0;
      if (options.prefix === indexKey('') && page != null && page < 450) return { keys: [], list_complete: false, cursor: `pad:${page + 1}` };
      return kv.list({ ...options, ...(page == null ? { cursor } : {}) });
    },
  };
  const load = () => loadWorkerCanonicalResultsAnalysisSource({ env: { CE_STORAGE_INDEX_KV: padded }, slug: SLUG, config });
  assert.equal((await load()).ok, true, 'one pass fits');
  await tamperNewestAnswer({ kv, indexKey });
  assert.deepEqual(await load(), { ok: false, status: 503, reason: 'results_analysis_snapshot_unavailable',
    error: 'Answers changed while the results were read. No report was generated; the last successful report is unchanged. Try again.' });
});

test('admin diagnostics count each person’s latest stamped answer, as a build reads them', async () => {
  const { env, config } = await setup();
  // Two questions, and nine answers less two older stamped versions.
  assert.deepEqual(await countResultsScanRows({ env, slug: SLUG, config }), { count: 9, limit: 10_000, overLimit: false });
});

test('a build stops before reading anything past 50,000 listed answers', async () => {
  let gets = 0;
  const index = {
    async list({ prefix, cursor = '0' }) {
      if (!prefix.includes(':responses:')) return { keys: [], list_complete: true };
      const start = Number(cursor);
      return { keys: Array.from({ length: 1000 }, (_, i) => ({ name: `${buildIndexKey({ slug: SLUG, resource: 'responses', id: '' })}r${start + i}` })), list_complete: false, cursor: String(start + 1000) };
    },
    async get() { gets += 1; return new Map(); },
  };
  const source = await loadWorkerCanonicalResultsAnalysisSource({ env: { CE_STORAGE_INDEX_KV: index }, slug: SLUG, config: { slug: SLUG, sessionId: SESSION_ID } });
  assert.equal(source.reason, 'results_analysis_snapshot_limit');
  assert.match(source.error, /AI builds read at most 10,000 stored question and answer versions at once, and this session stores more\./);
  assert.equal(gets, 0);
});
