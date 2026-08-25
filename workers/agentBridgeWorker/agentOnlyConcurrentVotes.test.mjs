import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_ONLY_VOTE_EVENT_KV_PREFIX,
  AGENT_ONLY_VOTE_STATE_KV_PREFIX,
  buildAgentOnlyMetrics,
  exportAgentOnlyData,
  materializeAgentOnlyWindow,
  saveAgentOnlyModeConfig,
  submitAgentOnlyTokenVotesBulk,
} from './telegramAgentOnlyMode.mjs';
import { persistTelegramProposedQuestion } from './telegramQuestionProposals.mjs';

class MemoryKv {
  constructor() {
    this.store = new Map();
    this.metadata = new Map();
  }

  async put(key, value, options = {}) {
    this.store.set(key, value);
    if (Object.hasOwn(options, 'metadata')) this.metadata.set(key, options.metadata);
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
    const keys = [...this.store.keys()].filter((key) => key.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) || 0 : 0;
    const page = keys.slice(start, start + limit);
    const next = start + page.length;
    return {
      keys: page.map((name) => ({ name, metadata: this.metadata.get(name) })),
      list_complete: next >= keys.length,
      cursor: next >= keys.length ? undefined : String(next),
    };
  }
}

const SESSION_SLUG = 'concurrent-votes';
const WINDOW_ID = 'w-2026-06-12';
const NOW = '2026-06-12T15:10:00.000Z';
const PRINCIPAL_COUNT = 20;
const AGENT_METADATA = Object.freeze({
  model: 'ci-concurrency-fixture',
  scaffold_version: 'v1',
});

function normalizedUser() {
  return {
    user: { telegramUserId: 'fixture-admin' },
    chat: { chatId: 'fixture-admin' },
  };
}

async function seedVoteWindow(testEnv) {
  const questions = await Promise.all([
    persistTelegramProposedQuestion({
      env: testEnv,
      normalized: normalizedUser(),
      sessionSlug: SESSION_SLUG,
      prompt: 'Should the first concurrent proposal pass?',
      questionType: 'binary',
    }),
    persistTelegramProposedQuestion({
      env: testEnv,
      normalized: normalizedUser(),
      sessionSlug: SESSION_SLUG,
      prompt: 'Should the second concurrent proposal pass?',
      questionType: 'binary',
    }),
  ]);
  const ids = questions.map((question) => question.questionId);
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: SESSION_SLUG,
    patch: {
      enabledQuestionIds: ids,
      windowing: {
        launchOpensAt: '2026-06-12T08:00:00-07:00',
        launchClosesAt: '2026-06-15T08:00:00-07:00',
      },
    },
    createdAt: NOW,
  });
  const materialized = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: SESSION_SLUG,
    now: NOW,
  });
  assert.equal(materialized.ok, true);
  assert.equal(materialized.snapshot.windowId, WINDOW_ID);
  return ids;
}

function voteBodies(ids, index) {
  return [
    {
      window_id: WINDOW_ID,
      run_id: `principal-${index}-linear`,
      request_id: 'shared-linear-request',
      mode: 'linear',
      agent_metadata: AGENT_METADATA,
      votes: [
        { statement_id: ids[0], votes: index % 2 === 0 ? 7 : -3 },
        { statement_id: ids[1], votes: index % 4 < 2 ? 5 : -5 },
      ],
    },
    {
      window_id: WINDOW_ID,
      run_id: `principal-${index}-quadratic`,
      request_id: 'shared-quadratic-request',
      mode: 'quadratic',
      agent_metadata: AGENT_METADATA,
      votes: [
        { statement_id: ids[0], votes: index % 2 === 0 ? 3 : -2 },
        { statement_id: ids[1], votes: index % 4 < 2 ? 4 : -1 },
      ],
    },
  ];
}

function sumVotes(rows, mode, statementId) {
  return rows
    .filter((row) => row.mode === mode && row.statement_id === statementId)
    .reduce((sum, row) => sum + row.votes, 0);
}

test('concurrent agent principals persist exact isolated linear and quadratic votes', async () => {
  const testEnv = { AGENT_ACTION_KV: new MemoryKv() };
  const ids = await seedVoteWindow(testEnv);
  const principals = Array.from({ length: PRINCIPAL_COUNT }, (_, index) => `ci-agent-${index}`);
  const bodiesByPrincipal = principals.map((_, index) => voteBodies(ids, index));

  const results = await Promise.all(
    principals.flatMap((telegramUserId, index) =>
      bodiesByPrincipal[index].map((body) =>
        submitAgentOnlyTokenVotesBulk({
          env: testEnv,
          sessionSlug: SESSION_SLUG,
          telegramUserId,
          body,
          now: NOW,
        }),
      ),
    ),
  );

  assert.equal(results.length, PRINCIPAL_COUNT * 2);
  assert.equal(
    results.every((result) => result.ok === true && result.replay === false),
    true,
  );

  const replay = await submitAgentOnlyTokenVotesBulk({
    env: testEnv,
    sessionSlug: SESSION_SLUG,
    telegramUserId: principals[0],
    body: bodiesByPrincipal[0][0],
    now: NOW,
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.replay, true);

  const conflict = await submitAgentOnlyTokenVotesBulk({
    env: testEnv,
    sessionSlug: SESSION_SLUG,
    telegramUserId: principals[0],
    body: {
      ...bodiesByPrincipal[0][0],
      votes: [{ statement_id: ids[0], votes: 1 }],
    },
    now: NOW,
  });
  assert.deepEqual(conflict, { ok: false, status: 409, reason: 'request_id_conflict' });

  const exported = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: SESSION_SLUG,
    windowId: WINDOW_ID,
    view: 'votes',
    format: 'jsonl',
  });
  const rows = exported.body
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.equal(exported.ok, true);
  assert.equal(rows.length, PRINCIPAL_COUNT * 2 * ids.length);
  assert.equal(new Set(rows.map((row) => row.principal_id)).size, PRINCIPAL_COUNT);
  principals.forEach((principal) => assert.equal(exported.body.includes(principal), false));
  assert.equal(sumVotes(rows, 'linear', ids[0]), 40);
  assert.equal(sumVotes(rows, 'linear', ids[1]), 0);
  assert.equal(sumVotes(rows, 'quadratic', ids[0]), 10);
  assert.equal(sumVotes(rows, 'quadratic', ids[1]), 30);

  const eventKeys = await testEnv.AGENT_ACTION_KV.list({ prefix: AGENT_ONLY_VOTE_EVENT_KV_PREFIX });
  const stateKeys = await testEnv.AGENT_ACTION_KV.list({ prefix: AGENT_ONLY_VOTE_STATE_KV_PREFIX });
  assert.equal(eventKeys.keys.length, PRINCIPAL_COUNT * 2);
  assert.equal(stateKeys.keys.length, PRINCIPAL_COUNT * 2);

  const metrics = await buildAgentOnlyMetrics({
    env: testEnv,
    scope: 'session',
    sessionSlug: SESSION_SLUG,
  });
  assert.equal(metrics.voteAllocations, PRINCIPAL_COUNT * 2);
  assert.equal(metrics.voteBudgetUsed, 500);
  principals.forEach((principal) => assert.equal(JSON.stringify(metrics).includes(principal), false));
});
