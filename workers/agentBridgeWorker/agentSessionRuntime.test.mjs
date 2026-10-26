import test from 'node:test';
import assert from 'node:assert/strict';
import { clearAgentSkillUpdateFlag, loadQuestionsForSession, loadSubmittedResultRecords, loadSessionPolicy, readAgentSkillUpdateFlag, readAdminDefaultSessionOverride, writeAgentSkillUpdateFlag, writeAdminDefaultSessionOverride } from './agentSessionRuntime.mjs';

import { __test__sessionQuestions } from './sessionQuestions.mjs';

import { canonicalAnswerSessionKvKey, submitRequestSessionKvKey } from './agentSubmitQueue.mjs';

class MemoryKv {
  constructor() {
    this.store = new Map();
    this.listPrefixes = [];
    this.putCalls = [];
  }

  async put(key, value, options = undefined) {
    this.putCalls.push({ key, value, options });
    this.store.set(key, value);
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
    this.listPrefixes.push(prefix);
    const keys = Array.from(this.store.keys())
      .filter((key) => String(key).startsWith(prefix))
      .sort();
    const start = cursor ? Number(cursor) || 0 : 0;
    const page = keys.slice(start, start + limit);
    const next = start + page.length;
    return {
      keys: page.map((name) => ({ name })),
      list_complete: next >= keys.length,
      cursor: next >= keys.length ? undefined : String(next),
    };
  }
}

function baseEnv(overrides = {}) {
  return {
    DEFAULT_CHAIN_ID: '11155420',
    DEFAULT_RPC_URL: 'https://rpc.example.test',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      allowQuestionGeneration: true,
      allowGenerateQuestion: true,
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: false,
        agentHttpEnabled: true,
        telegramGroupOpenAccess: true,
        managedAccountSubmitAllowed: true,
      }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: 'q-readiness',
        questionType: 'freeform',
        prompt: 'What should Alpha decide next?',
      },
      {
        questionId: 'q-locked',
        questionType: 'freeform',
        prompt: 'Private prompt must not leak',
        visibility: 'sbt_gated',
      },
    ]),
    AGENT_ACTION_KV: new MemoryKv(),
    ...overrides,
  };
}

test('admin default-session override writes a durable KV record', async () => {
  const kv = new MemoryKv();
  const env = baseEnv({ AGENT_ACTION_KV: kv });
  const written = await writeAdminDefaultSessionOverride({
    env,
    sessionSlug: 'Beta',
    accountAddress: `0x${'ab'.repeat(20)}`,
    createdAt: '2026-05-29T12:00:00.000Z',
  });
  const read = await readAdminDefaultSessionOverride(env);
  const putCall = kv.putCalls.find((call) => call.key === 'telegram:admin-default-session:v1');

  assert.deepEqual(written, { ok: true, sessionSlug: 'beta' });
  assert.equal(read.sessionSlug, 'beta');
  assert.equal(read.updatedBy, '0xabab...abab');
  assert.equal(putCall.options?.expirationTtl, undefined);
  assert.equal(putCall.options?.expiration, undefined);
});

test('agent skill-update flag writes a durable KV record', async () => {
  const kv = new MemoryKv();
  const env = baseEnv({ AGENT_ACTION_KV: kv });
  const written = await writeAgentSkillUpdateFlag({
    env,
    latestVersion: '2026-05-30 (v19)',
    note: 'Refresh before answering.',
    accountAddress: `0x${'cd'.repeat(20)}`,
    createdAt: '2026-05-30T00:00:00.000Z',
  });
  const read = await readAgentSkillUpdateFlag(env);
  const putCall = kv.putCalls.find((call) => call.key === 'telegram:agent-skill-update:v1');
  const cleared = await clearAgentSkillUpdateFlag(env);

  assert.deepEqual(written, { ok: true, latestVersion: '2026-05-30 (v19)' });
  assert.equal(read.updateAvailable, true);
  assert.equal(read.latestVersion, '2026-05-30 (v19)');
  assert.equal(read.note, 'Refresh before answering.');
  assert.equal(read.updatedBy, '0xcdcd...cdcd');
  assert.equal(putCall.options?.expirationTtl, undefined);
  assert.equal(putCall.options?.expiration, undefined);
  assert.deepEqual(cleared, { ok: true });
  assert.deepEqual(await readAgentSkillUpdateFlag(env), {});
});

test('loadSessionPolicy applies a valid admin default-session pin', async () => {
  const kv = new MemoryKv();
  await kv.put('telegram:admin-default-session:v1', JSON.stringify({
    version: 1,
    sessionSlug: 'beta',
    updatedBy: '0x1234...abcd',
    updatedAt: '2026-05-29T12:00:00.000Z',
  }));
  const env = baseEnv({
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        { sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true },
        { sessionSlug: 'beta', sessionName: 'Beta', telegramBridgeEnabled: true, telegramOnly: true },
      ],
    }),
  });

  const policy = await loadSessionPolicy(env);

  assert.equal(policy.defaultSessionSlug, 'beta');
  assert.equal(policy.adminDefaultSessionSlug, 'beta');
  assert.equal(policy.scheduledDefaultSessionSlug, 'alpha');
});

test('admin default-session pin wins over the schedule', async () => {
  const kv = new MemoryKv();
  await kv.put('telegram:admin-default-session:v1', JSON.stringify({
    version: 1,
    sessionSlug: 'beta',
    updatedAt: '2026-05-29T12:00:00.000Z',
  }));
  const env = baseEnv({
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_SESSION_POLICY_NOW: '2026-05-30T00:00:00.000Z',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      defaultSessionSchedule: [
        { sessionSlug: 'alpha', until: '2026-05-30T00:00:00.000Z' },
        { sessionSlug: 'alpha', from: '2026-05-30T00:00:00.000Z' },
      ],
      riskCeiling: 'submit',
      sessions: [
        { sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true },
        { sessionSlug: 'beta', sessionName: 'Beta', telegramBridgeEnabled: true, telegramOnly: true },
      ],
    }),
  });

  const policy = await loadSessionPolicy(env);

  assert.equal(policy.scheduledDefaultSessionSlug, 'alpha');
  assert.equal(policy.defaultSessionSlug, 'beta');
  assert.equal(policy.adminDefaultSessionSlug, 'beta');
});

test('loadSessionPolicy ignores a stale admin default-session pin', async () => {
  const kv = new MemoryKv();
  await kv.put('telegram:admin-default-session:v1', JSON.stringify({
    version: 1,
    sessionSlug: 'missing-session',
    updatedAt: '2026-05-29T12:00:00.000Z',
  }));
  const env = baseEnv({
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        { sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true },
      ],
    }),
  });

  const policy = await loadSessionPolicy(env);

  assert.equal(policy.defaultSessionSlug, 'alpha');
  assert.equal(policy.adminDefaultSessionSlug, '');
  assert.equal(policy.adminDefaultSessionInvalidSlug, 'missing-session');
});

test('submitted result reads use per-session indexes instead of capped global scans', async () => {
  const env = baseEnv();
  for (let index = 0; index < 650; index += 1) {
    await env.AGENT_ACTION_KV.put(`telegram:submit-request:noise-${String(index).padStart(3, '0')}`, JSON.stringify({
      requestId: `noise-${index}`,
      status: 'direct_submitted',
      sessionSlug: 'other-session',
      telegramUserId: `noise-${index}`,
      questionId: 'q-noise',
      answer: { label: 'Agree', value: 'agree' },
      createdAt: `2026-05-08T11:${String(index % 60).padStart(2, '0')}:00.000Z`,
    }));
  }
  for (let index = 0; index < 3; index += 1) {
    const record = {
      requestId: `alpha-${index}`,
      status: 'direct_submitted',
      sessionSlug: 'alpha',
      telegramUserId: `user-${index}`,
      questionId: `q-${index}`,
      answer: { label: 'Agree', value: 'agree' },
      createdAt: `2026-05-08T12:00:0${index}.000Z`,
    };
    await env.AGENT_ACTION_KV.put(submitRequestSessionKvKey(record), JSON.stringify(record));
  }

  const records = await loadSubmittedResultRecords(env, 'alpha');

  assert.deepEqual(records.map((record) => record.requestId), ['alpha-0', 'alpha-1', 'alpha-2']);
  assert.ok(!env.AGENT_ACTION_KV.listPrefixes.includes('telegram:submit-request:'));
});

test('submitted result reads include durable canonical answer records', async () => {
  const env = baseEnv();
  const record = {
    version: 1,
    type: 'telegram_canonical_answer',
    requestId: 'durable-result',
    status: 'direct_submitted',
    telegramUserId: '42',
    sessionSlug: 'alpha',
    questionId: 'q-durable-result',
    answer: {
      questionType: 'agree_unsure_disagree',
      value: 'agree',
      label: 'Agree',
      comments: 'Durable comment',
    },
    createdAt: '2026-05-23T12:00:00.000Z',
    updatedAt: '2026-05-23T12:00:00.000Z',
  };
  await env.AGENT_ACTION_KV.put(canonicalAnswerSessionKvKey(record), JSON.stringify(record));

  const records = await loadSubmittedResultRecords(env, 'alpha');

  assert.equal(records.length, 1);
  assert.equal(records[0].requestId, 'durable-result');
  assert.equal(records[0].questionId, 'q-durable-result');
  assert.equal(records[0].label, 'Agree');
  assert.equal(records[0].comments, 'Durable comment');
});

test('loadQuestionsForSession skips malformed live and proposed records', async () => {
  __test__sessionQuestions.clearCaches();
  const env = baseEnv({ AGENT_BRIDGE_QUESTION_SOURCE: 'live' });
  const cachedAtMs = Date.now();
  __test__sessionQuestions.questionMemoryCache.set(__test__sessionQuestions.cacheKey('alpha'), {
    ok: true,
    reason: 'live_questions_loaded',
    source: 'unit_live_cache',
    cachedAtMs,
    complete: true,
    questions: [
      {
        questionId: 'q-live-good',
        questionType: 'freeform',
        prompt: 'What should the live loader keep?',
        sessionSlug: 'alpha',
        tags: ['valid'],
      },
      {
        questionType: 'freeform',
        prompt: 'Missing ids should be skipped.',
        sessionSlug: 'alpha',
      },
      {
        questionId: 'q-null-tags',
        questionType: 'freeform',
        prompt: 'Null tags should be skipped.',
        sessionSlug: 'alpha',
        tags: null,
      },
      {
        questionId: 'q-object-prompt',
        questionType: 'freeform',
        prompt: { text: 'Object prompts should be skipped.' },
        sessionSlug: 'alpha',
      },
      {
        questionId: 'q-number-prompt',
        questionType: 'freeform',
        prompt: 42,
        sessionSlug: 'alpha',
      },
    ],
  });
  await env.AGENT_ACTION_KV.put('telegram:proposed-question:alpha:q-bad-proposed', JSON.stringify({
    version: 1,
    questionId: 'q-bad-proposed',
    sessionSlug: 'alpha',
    questionType: 'freeform',
    prompt: { text: 'Malformed proposed prompt' },
    status: 'active',
    createdAt: '2026-05-29T12:00:00.000Z',
  }));

  const loaded = await loadQuestionsForSession(env, 'alpha');

  assert.equal(loaded.ok, true);
  assert.equal(loaded.questionCount, 1);
  assert.deepEqual(loaded.questions.map((question) => question.questionId), ['q-live-good']);
  assert.equal(loaded.skippedMalformed, 5);
});

function workerSessionEnv(questionFetch) {
  return baseEnv({
    AGENT_BRIDGE_DEPLOYMENT_ID: 'unit-deploy',
    AGENT_BRIDGE_QUESTION_SOURCE: 'live',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        telegramOnly: true,
        telegramBridgeEnabled: false,
        agentHttpEnabled: true,
        telegramGroupOpenAccess: true,
        sessionWorkerUrl: 'https://session.example',
        workerSessionSlug: 'alpha',
        questionSource: 'cloudflare_storage',
        storageProfile: { backend: 'cloudflare' },
      }],
    }),
    QUESTION_FETCH: questionFetch,
  });
}

// A session Worker that signs the bridge in, serves question reads, and
// answers each list request with listPage(cursor).
function workerQuestionEnv(listPage) {
  const listQueries = [];
  const env = workerSessionEnv(async (url) => {
    const { pathname, searchParams } = new URL(url);
    if (pathname === '/storage/list') listQueries.push(Object.fromEntries(searchParams));
    const questionId = (searchParams.get('id') || '').replace(/^row-/, '');
    const body = pathname === '/auth/nonce' ? { nonce: 'unit-nonce' }
      : pathname === '/auth/login' ? { token: 'unit-token' }
        : pathname === '/storage/list' ? listPage(searchParams.get('cursor') || '')
          : { id: questionId, type: 'binary', prompt: `Question ${questionId}?` };
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  });
  return { env, listQueries };
}

const listedQuestion = (questionId) => ({
  storageRef: { backend: 'cloudflare', id: `row-${questionId}`, resource: 'questions' },
  metadata: { resource: 'questions', resourceId: questionId },
});
const questionIds = (loaded) => loaded.questions.map((question) => question.questionId);

test('telegram_only storage auth failures still surface proposed questions', async () => {
  const env = workerSessionEnv(async () => {
    throw new Error('session auth unavailable');
  });
  await env.AGENT_ACTION_KV.put('telegram:proposed-question:alpha:q-proposed-ok', JSON.stringify({
    version: 1,
    questionId: 'q-proposed-ok',
    sessionSlug: 'alpha',
    questionType: 'binary',
    prompt: 'Should proposed questions stay visible when storage auth fails?',
    status: 'active',
    createdAt: '2026-05-29T12:00:00.000Z',
  }));

  const loaded = await loadQuestionsForSession(env, 'alpha');

  assert.equal(loaded.ok, true);
  assert.equal(loaded.reason, 'proposed_questions_loaded_with_source_warning');
  assert.equal(loaded.authReason, 'session_worker_auth_failed');
  assert.equal(loaded.questionCount, 1);
  assert.deepEqual(loaded.questions.map((question) => question.questionId), ['q-proposed-ok']);
});

test('Worker-stored questions follow list cursors past the first page', async () => {
  const ids = Array.from({ length: 101 }, (_, index) => `q-${String(index + 1).padStart(3, '0')}`);
  const { env, listQueries } = workerQuestionEnv((cursor) => (cursor
    ? { items: ids.slice(100).map(listedQuestion), cursor: null, listComplete: true }
    : { items: ids.slice(0, 100).map(listedQuestion), cursor: 'page-2', listComplete: false }));

  const loaded = await loadQuestionsForSession(env, 'alpha');

  assert.equal(loaded.questionCount, 101);
  assert.equal(loaded.discoveredCount, 101);
  assert.equal(loaded.complete, true);
  assert.deepEqual(listQueries, [
    { resource: 'questions', limit: '100' },
    { resource: 'questions', limit: '100', cursor: 'page-2' },
  ]);
  // Selection sees every page: a preferred id from page two fills a one-question limit.
  const preferred = await loadQuestionsForSession(env, 'alpha', { questionLimit: 1, preferredQuestionIds: ['q-101'] });
  assert.deepEqual(questionIds(preferred), ['q-101']);
  assert.equal(preferred.complete, false);
});

test('Worker-stored question lists continue past empty pages and reject broken cursors', async () => {
  const load = (listPage) => loadQuestionsForSession(workerQuestionEnv(listPage).env, 'alpha');
  const afterEmpty = await load((cursor) => (cursor
    ? { items: [listedQuestion('q-after-empty')], cursor: null, listComplete: true }
    : { items: [], cursor: 'page-2', listComplete: false }));
  assert.deepEqual(questionIds(afterEmpty), ['q-after-empty']);
  assert.equal(afterEmpty.complete, true);
  // Workers that predate pagination list everything in one response.
  const unpaged = await load(() => ({ items: [listedQuestion('q-unpaged')] }));
  assert.deepEqual(questionIds(unpaged), ['q-unpaged']);
  assert.equal(unpaged.complete, true);
  for (const listPage of [
    () => ({ items: [listedQuestion('q-1')], cursor: null, listComplete: false }),
    () => ({ items: [listedQuestion('q-1')], cursor: 'same', listComplete: false }),
  ]) {
    const broken = await load(listPage);
    assert.equal(broken.ok, false);
    assert.equal(broken.reason, 'telegram_only_cloudflare_questions_list_failed');
    assert.deepEqual(broken.questions, []);
  }
});

test('Worker-stored question loads stop at the page cap and report incomplete', async () => {
  const { env, listQueries } = workerQuestionEnv((cursor) => {
    const page = Number(cursor || 0) + 1;
    return { items: [listedQuestion(`q-${page}`)], cursor: String(page), listComplete: false };
  });

  const loaded = await loadQuestionsForSession(env, 'alpha');

  assert.equal(loaded.ok, true);
  assert.equal(loaded.complete, false);
  assert.equal(loaded.questionCount, 10);
  assert.equal(listQueries.length, 10);
});

test('Worker-stored questions present one current version per question', async () => {
  const rows = {
    'row-q1-original': { createdAt: '2026-10-01T00:00:00.000Z', payload: { id: 'q1', type: 'binary', prompt: 'Original prompt?' } },
    'row-q1-reupload': { createdAt: '2026-10-02T00:00:00.000Z', payload: { id: 'q1', type: 'binary', prompt: 'Re-uploaded prompt?' } },
    'row-q1-admin': { createdAt: '2026-10-03T00:00:00.000Z', uploadAuthority: 'admin', payload: { id: 'q1', type: 'binary', prompt: 'Admin correction?' } },
    // Stored before resourceId was recorded, so it names its question only in the payload.
    'row-legacy': { createdAt: '2026-09-01T00:00:00.000Z', legacy: true, payload: { id: 'q-legacy', type: 'binary', prompt: 'Legacy question?' } },
  };
  const env = workerSessionEnv(async (url) => {
    const { pathname, searchParams } = new URL(url);
    const body = pathname === '/auth/nonce' ? { nonce: 'unit-nonce' }
      : pathname === '/auth/login' ? { token: 'unit-token' }
        : pathname === '/storage/list'
          ? {
              items: Object.entries(rows).map(([id, row]) => ({
                storageRef: { backend: 'cloudflare', id, resource: 'questions' },
                metadata: {
                  resource: 'questions',
                  createdAt: row.createdAt,
                  ...(row.legacy ? {} : { resourceId: row.payload.id }),
                  ...(row.uploadAuthority ? { uploadAuthority: row.uploadAuthority } : {}),
                },
              })),
              cursor: null,
              listComplete: true,
            }
          : rows[searchParams.get('id')]?.payload;
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  });

  const loaded = await loadQuestionsForSession(env, 'alpha');

  assert.deepEqual(loaded.questions.map((question) => [question.questionId, question.prompt]).sort(), [
    ['q-legacy', 'Legacy question?'],
    ['q1', 'Admin correction?'],
  ]);
  assert.equal(loaded.discoveredCount, 2);
  assert.equal(loaded.complete, true);
});

test('Worker-stored questions fold legacy rows into the version choice and read a few at a time', async () => {
  const rows = {
    // Stored before resourceId was recorded; the admin correction below supersedes it.
    'row-legacy-q1': { createdAt: '2026-09-01T00:00:00.000Z', legacy: true, payload: { id: 'q1', type: 'binary', prompt: 'Legacy original?' } },
    'row-q1-admin': { createdAt: '2026-10-03T00:00:00.000Z', uploadAuthority: 'admin', payload: { id: 'q1', type: 'binary', prompt: 'Admin correction?' } },
    // A legacy original still beats a later ordinary re-upload.
    'row-legacy-q2': { createdAt: '2026-09-02T00:00:00.000Z', legacy: true, payload: { id: 'q2', type: 'binary', prompt: 'Legacy q2?' } },
    'row-q2-reupload': { createdAt: '2026-10-04T00:00:00.000Z', payload: { id: 'q2', type: 'binary', prompt: 'Re-uploaded q2?' } },
    ...Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`row-extra-${index}`, {
      createdAt: '2026-10-05T00:00:00.000Z', payload: { id: `q-extra-${index}`, type: 'binary', prompt: `Extra ${index}?` },
    }])),
  };
  let inFlight = 0;
  let peak = 0;
  const env = workerSessionEnv(async (url) => {
    const { pathname, searchParams } = new URL(url);
    if (pathname === '/storage/read') {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
    }
    const body = pathname === '/auth/nonce' ? { nonce: 'unit-nonce' }
      : pathname === '/auth/login' ? { token: 'unit-token' }
        : pathname === '/storage/list'
          ? {
              items: Object.entries(rows).map(([id, row]) => ({
                storageRef: { backend: 'cloudflare', id, resource: 'questions' },
                metadata: {
                  resource: 'questions',
                  createdAt: row.createdAt,
                  ...(row.legacy ? {} : { resourceId: row.payload.id }),
                  ...(row.uploadAuthority ? { uploadAuthority: row.uploadAuthority } : {}),
                },
              })),
              cursor: null,
              listComplete: true,
            }
          : rows[searchParams.get('id')]?.payload;
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  });

  const loaded = await loadQuestionsForSession(env, 'alpha');
  const prompts = new Map(loaded.questions.map((question) => [question.questionId, question.prompt]));

  assert.equal(prompts.get('q1'), 'Admin correction?');
  assert.equal(prompts.get('q2'), 'Legacy q2?');
  assert.equal(loaded.questions.length, 14);
  assert.ok(peak <= 4, `${peak} reads in flight`);
});
