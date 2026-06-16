import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  AGENT_ONLY_ANSWER_EVENT_KV_PREFIX,
  AGENT_ONLY_INSTRUCTIONS,
  AGENT_ONLY_WINDOW_KV_PREFIX,
  __test__telegramAgentOnlyMode,
  agentOnlyInstructionWordCount,
  buildAgentOnlyWrappedImagePrompt,
  buildAgentOnlyStartPayload,
  buildAgentOnlyMetrics,
  canonicalAgentOnlyAnswerProjection,
  exportAgentOnlyData,
  getAgentOnlyStatementsPage,
  loadAgentOnlyPredictionsForPrincipal,
  loadAgentOnlyModeConfig,
  materializeAgentOnlyWindow,
  recordAgentOnlyHumanReview,
  saveAgentOnlyModeConfig,
  semanticFingerprintForAgentOnlyAnswer,
  submitAgentOnlyAnswersBulk,
  submitAgentOnlyHumanVoteTaps,
  submitAgentOnlyTokenVotesBulk,
  windowBoundariesAround,
} from './telegramAgentOnlyMode.mjs';
import { persistTelegramProposedQuestion } from './telegramQuestionProposals.mjs';
import { persistTelegramSubmitRecord } from './telegramSubmitQueue.mjs';

class MemoryKv {
  constructor() {
    this.store = new Map();
    this.metadata = new Map();
    this.getCalls = 0;
  }

  async put(key, value, options = {}) {
    this.store.set(key, value);
    if (options && Object.hasOwn(options, 'metadata')) this.metadata.set(key, options.metadata);
    else this.metadata.delete(key);
  }

  async get(key) {
    this.getCalls += 1;
    return this.store.get(key) || null;
  }

  async delete(key) {
    this.store.delete(key);
    this.metadata.delete(key);
  }

  async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
    const keys = [...this.store.keys()].filter((key) => key.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) || 0 : 0;
    const page = keys.slice(start, start + limit);
    const next = start + page.length;
    return {
      keys: page.map((name) => ({
        name,
        ...(this.metadata.has(name) ? { metadata: this.metadata.get(name) } : {}),
      })),
      list_complete: next >= keys.length,
      cursor: next >= keys.length ? undefined : String(next),
    };
  }
}

function env(overrides = {}) {
  return {
    AGENT_ACTION_KV: new MemoryKv(),
    ...overrides,
  };
}

function normalizedUser(id = '1001') {
  return {
    user: { telegramUserId: id },
    chat: { chatId: id },
  };
}

async function seedQuestions(testEnv, sessionSlug = 'alpha') {
  const binary = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug,
    prompt: 'Should Alpha fund the shared workspace?',
    questionType: 'binary',
  });
  const freeform = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug,
    prompt: 'What should Alpha improve next?',
    questionType: 'freeform',
  });
  const rating = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug,
    prompt: 'Rate the Alpha schedule from 0 to 10.',
    questionType: 'rating',
  });
  const multichoice = await persistTelegramProposedQuestion({
    env: testEnv,
    normalized: normalizedUser(),
    sessionSlug,
    prompt: 'Which Alpha dinner should happen?',
    questionType: 'multichoice',
    options: ['Pizza', 'Sushi', 'Salad'],
  });
  const ids = [binary, freeform, rating, multichoice].map((result) => result.questionId);
  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug,
    patch: {
      enabledQuestionIds: ids,
      evalTypesByQuestionId: { [ids[0]]: 'human_split' },
    },
    createdAt: '2026-06-12T15:01:00.000Z',
  });
  return { ids, binary, freeform, rating, multichoice };
}

test('windowBoundariesAround handles launch, regular boundary, DST, and edited launch close', () => {
  assert.equal(windowBoundariesAround(Date.parse('2026-06-12T14:59:59.000Z')), null);
  assert.deepEqual(windowBoundariesAround(Date.parse('2026-06-12T15:00:00.000Z')), {
    windowId: 'w-2026-06-12',
    opensAt: '2026-06-12T15:00:00.000Z',
    closesAt: '2026-06-15T15:00:00.000Z',
  });
  assert.deepEqual(windowBoundariesAround(Date.parse('2026-06-15T15:00:00.000Z')), {
    windowId: 'w-2026-06-15',
    opensAt: '2026-06-15T15:00:00.000Z',
    closesAt: '2026-06-22T15:00:00.000Z',
  });
  assert.deepEqual(windowBoundariesAround(Date.parse('2026-11-02T16:00:00.000Z')), {
    windowId: 'w-2026-11-02',
    opensAt: '2026-11-02T16:00:00.000Z',
    closesAt: '2026-11-09T16:00:00.000Z',
  });
  assert.equal(
    windowBoundariesAround(Date.parse('2026-06-16T15:00:00.000Z'), {
      launchClosesAt: '2026-06-19T08:00:00-07:00',
    }).windowId,
    'w-2026-06-12',
  );
});

test('start payload pins path-only endpoints and instruction size', () => {
  const payload = buildAgentOnlyStartPayload({ sessionSlug: 'alpha', skillVersion: '2026-06-12 (v40)' });
  assert.equal(payload.statementEndpoint, '/telegram/agent/api/agent-only/statements');
  assert.equal(payload.answerEndpoint, '/telegram/agent/api/agent-only/answers/bulk');
  assert.equal(payload.voteEndpoint, '/telegram/agent/api/agent-only/token-votes/bulk');
  assert.equal(payload.wrappedImageEndpoint, '/telegram/agent/api/agent-only/wrapped-image');
  assert.ok(agentOnlyInstructionWordCount(AGENT_ONLY_INSTRUCTIONS) >= 400);
  assert.ok(agentOnlyInstructionWordCount(AGENT_ONLY_INSTRUCTIONS) <= 800);
  assert.equal(/https?:\/\//i.test(payload.instructions), false);
});

test('wrapped image prompt uses importance wording and suppresses decorative text', () => {
  const snapshot = {
    windowId: 'w-2026-06-15',
    statements: [
      {
        statement_id: 'ceq_trust',
        text: 'I would trust my agent to schedule meetings while I sleep if it could preserve enough private coordination context.',
        answer_schema: { kind: 'choice', values: ['agree', 'unsure', 'disagree'] },
      },
      {
        statement_id: 'ceq_info',
        text: 'A mostly AI-written information environment could be healthier than today.',
        answer_schema: { kind: 'choice', values: ['agree', 'unsure', 'disagree'] },
      },
      {
        statement_id: 'ceq_book',
        text: 'Agent guess: what is my favorite book?',
        answer_schema: { kind: 'text', maxChars: 280 },
      },
    ],
  };
  const state = {
    byStatement: {
      ceq_trust: { agent: { answer: { value: 'agree' }, confidence: 92 } },
      ceq_info: { agent: { answer: { value: 'unsure' }, confidence: 41 } },
      ceq_book: { agent: { answer: { text: 'The Diamond Age' }, confidence: 52 } },
    },
  };
  const prompt = buildAgentOnlyWrappedImagePrompt({
    snapshot,
    state,
    linearVoteState: { mode: 'linear', votes: { ceq_trust: 20 } },
    quadraticVoteState: { mode: 'quadratic', votes: { ceq_info: 4 } },
  });
  assert.match(prompt, /Most Important To You/);
  assert.match(prompt, /Questions your agent thought you would care about most/);
  assert.match(prompt, /horizontal wordmark running along the top/);
  assert.match(prompt, /flowing calligraphic V/);
  assert.match(prompt, /Do not place a standalone logo icon/);
  assert.match(prompt, /35-45% of the title height/);
  assert.match(prompt, /Show these actual question prompts/);
  assert.match(prompt, /Do not replace them with theme summaries/);
  assert.match(prompt, /Agree is green with white text/);
  assert.match(prompt, /Unsure is bright yellow with dark navy text/);
  assert.match(prompt, /Disagree is red with white text/);
  assert.match(prompt, /I would trust my agent to schedule meetings while I sleep/);
  assert.match(prompt, /High-Confidence Reads/);
  assert.match(prompt, /Cautious Reads/);
  assert.match(prompt, /Agent Guesses/);
  assert.match(prompt, /favorite book/);
  assert.match(prompt, /several small evidence artifacts\/icons/);
  assert.match(prompt, /Review or edit your agent's responses in Context Engine/);
  assert.doesNotMatch(prompt, /What Your Agent Upvoted/);
});

test('wrapped image prompt supports political compass mode around the most-important question', () => {
  const snapshot = {
    windowId: 'w-2026-06-15',
    statements: [
      {
        statement_id: 'ceq_privacy',
        text: 'I would rather my agent be too conservative with privacy than too proactive with opportunities.',
        answer_schema: { kind: 'choice', values: ['agree', 'unsure', 'disagree'] },
      },
      {
        statement_id: 'ceq_movie',
        text: 'Agent guess: what movie would I recommend?',
        answer_schema: { kind: 'text', maxChars: 280 },
      },
    ],
  };
  const state = {
    byStatement: {
      ceq_privacy: { agent: { answer: { value: 'agree' }, confidence: 88 } },
      ceq_movie: { agent: { answer: { text: 'Her' }, confidence: 49 } },
    },
  };
  const prompt = buildAgentOnlyWrappedImagePrompt({
    snapshot,
    state,
    linearVoteState: { mode: 'linear', votes: { ceq_privacy: 30 } },
    quadraticVoteState: { mode: 'quadratic', votes: {} },
    mode: 'political_compass',
  });
  assert.match(prompt, /political compass meme/);
  assert.match(prompt, /Agent Village Compass/);
  assert.match(prompt, /most-important question/);
  assert.match(prompt, /historical figures or fictional\/book characters/);
  assert.match(prompt, /I would rather my agent be too conservative with privacy/);
  assert.match(prompt, /Agent guesses/);
  assert.doesNotMatch(prompt, /Most Important To You/);
});

test('canonical answer fingerprints compare semantics across agent and mini-app shapes', async () => {
  const longText = 'This is a deliberately long answer that would be truncated in the mini app review label.';
  assert.deepEqual(
    canonicalAgentOnlyAnswerProjection({ text: ` ${longText}\n` }, { kind: 'text' }),
    canonicalAgentOnlyAnswerProjection({ questionType: 'freeform', text: longText, label: `${longText.slice(0, 39)}...`, comments: 'ignored' }),
  );
  assert.deepEqual(
    canonicalAgentOnlyAnswerProjection({ values: ['Alpha', 'Beta'] }, { kind: 'multichoice' }),
    canonicalAgentOnlyAnswerProjection({ questionType: 'multichoice', values: ['Beta', 'Alpha'], label: 'Beta, Alpha', comments: 'ignored' }),
  );
  assert.deepEqual(
    canonicalAgentOnlyAnswerProjection({ values: ['b', 'A', 'a'] }, { kind: 'multichoice' }),
    { values: ['A', 'a', 'b'] },
  );
  assert.deepEqual(
    canonicalAgentOnlyAnswerProjection({ value: 'AGREE' }, { kind: 'choice' }),
    canonicalAgentOnlyAnswerProjection({ questionType: 'agree_unsure_disagree', value: 'agree', label: 'Agree' }),
  );
  assert.deepEqual(
    canonicalAgentOnlyAnswerProjection({ value: 0 }, { kind: 'choice', values: [0, 1, 2] }),
    canonicalAgentOnlyAnswerProjection({ questionType: 'rating', value: 0, label: '0', comments: 'ignored' }),
  );
  assert.equal(
    await semanticFingerprintForAgentOnlyAnswer({ values: ['Alpha', 'Beta'] }, { kind: 'multichoice' }),
    await semanticFingerprintForAgentOnlyAnswer({ questionType: 'multichoice', values: ['Beta', 'Alpha'], label: 'Beta, Alpha' }),
  );
  assert.equal(
    await semanticFingerprintForAgentOnlyAnswer({ value: 0 }, { kind: 'choice', values: [0, 1, 2] }),
    await semanticFingerprintForAgentOnlyAnswer({ questionType: 'rating', value: 0, label: '0' }),
  );
});

test('config normalizes ceq ids and snapshots freeze flagged statements with shared answer schemas', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  const loaded = await loadAgentOnlyModeConfig({ env: testEnv, sessionSlug: 'alpha' });
  assert.deepEqual(loaded.config.enabledQuestionIds, ids);
  assert.equal(loaded.config.evalTypesByQuestionId[ids[0]], 'human_split');

  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(opened.ok, true);
  assert.equal(opened.snapshot.windowId, 'w-2026-06-12');
  assert.equal(opened.snapshot.statements.length, 4);
  assert.deepEqual(opened.snapshot.statements[0].answer_schema, {
    kind: 'choice',
    values: ['agree', 'disagree', 'unsure'],
  });
  assert.deepEqual(opened.snapshot.statements[2].answer_schema.values, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(opened.snapshot.statements[3].answer_schema.selectionMode, 'multi');
  assert.equal(opened.snapshot.statements[3].answer_schema.maxSelections, 3);
  assert.equal(testEnv.AGENT_ACTION_KV.metadata.get(`${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`).c, 4);

  await saveAgentOnlyModeConfig({
    env: testEnv,
    sessionSlug: 'alpha',
    patch: { enabledQuestionIds: ids.slice(0, 1) },
    createdAt: '2026-06-12T16:00:00.000Z',
  });
  const reopened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T16:05:00.000Z',
  });
  assert.equal(reopened.created, false);
  assert.equal(reopened.snapshot.statements.length, 4);
});

test('agent-only prediction reads do not materialize windows before config exists', async () => {
  const testEnv = env();
  const predictions = await loadAgentOnlyPredictionsForPrincipal({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(predictions.windowId, null);
  const opened = await materializeAgentOnlyWindow({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
  });
  assert.equal(opened.ok, false);
  assert.equal(opened.reason, 'agent_only_not_configured');
  assert.equal((await testEnv.AGENT_ACTION_KV.list({ prefix: AGENT_ONLY_WINDOW_KV_PREFIX })).keys.length, 0);
});

test('single-select multichoice snapshots enforce one selected value', () => {
  const statement = __test__telegramAgentOnlyMode.snapshotStatementFromQuestion({
    questionId: 'ceq_single_choice',
    questionType: 'multichoice',
    prompt: 'Choose one option.',
    options: ['Alpha', 'Beta', 'Gamma'],
    singleSelect: true,
  });
  assert.equal(statement.answer_schema.selectionMode, 'single');
  assert.equal(statement.answer_schema.maxSelections, 1);
  assert.deepEqual(
    __test__telegramAgentOnlyMode.normalizeAnswerForSchema({ values: ['Alpha'] }, statement.answer_schema),
    { ok: true, answer: { values: ['Alpha'] } },
  );
  assert.deepEqual(
    __test__telegramAgentOnlyMode.normalizeAnswerForSchema({ values: ['Alpha', 'Beta'] }, statement.answer_schema),
    { ok: false, reason: 'answer_multichoice_too_many' },
  );
});

test('statement page supports pre-launch response, cursor pagination, and no config leakage', async () => {
  const testEnv = env();
  await seedQuestions(testEnv);
  const prelaunch = await getAgentOnlyStatementsPage({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T14:59:00.000Z',
  });
  assert.deepEqual(prelaunch, {
    ok: true,
    window_id: null,
    window_state: 'not_open',
    statements: [],
    cursor: '',
  });

  const first = await getAgentOnlyStatementsPage({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
    limit: 2,
  });
  assert.equal(first.statements.length, 2);
  assert.ok(first.cursor);
  const second = await getAgentOnlyStatementsPage({
    env: testEnv,
    sessionSlug: 'alpha',
    now: '2026-06-12T15:05:00.000Z',
    cursor: first.cursor,
    limit: 2,
  });
  assert.equal(second.statements.length, 2);
  assert.equal(second.cursor, '');
  const serialized = JSON.stringify(first);
  assert.equal(serialized.includes('eval_type'), false);
  assert.equal(serialized.includes('evalType'), false);
  assert.equal(serialized.includes('agent_mode_enabled'), false);
});

test('answer bulk validates rows, writes sidecar events/state, and replays idempotently', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const base = {
    window_id: 'w-2026-06-12',
    request_id: 'answers-1',
    agent_metadata: {
      model: 'unit-model',
      scaffold_version: 'unit-scaffold',
      agent_initialized_at: '2026-06-12T12:00:00.000Z',
    },
  };
  const rejected = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...base,
      request_id: 'bad-skip',
      answers: [{ statement_id: ids[0], skipped: true, skip_reason: 'privacy_protective', rationale: 'too much' }],
    },
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors[0].reason, 'privacy_skip_shape_invalid');
  const stale = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...base,
      request_id: 'stale-window',
      window_id: 'w-2026-06-15',
      answers: [{ statement_id: ids[0], answer: { value: 'agree' }, confidence: 85 }],
    },
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.status, 409);
  assert.equal(stale.reason, 'window_mismatch');

  const accepted = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...base,
      answers: [
        { statement_id: ids[0], answer: { value: 'agree' }, confidence: 85, rationale: 'Matches prior preferences.' },
        { statement_id: ids[1], answer: { text: 'Improve the way sessions are scheduled.' }, confidence: 61 },
        { statement_id: ids[2], answer: { value: 8 }, confidence: 74 },
        { statement_id: ids[3], skipped: true, skip_reason: 'privacy_protective' },
      ],
    },
  });
  assert.deepEqual(accepted, {
    ok: true,
    window_id: 'w-2026-06-12',
    accepted: 4,
    skipsRecorded: 1,
    replay: false,
  });
  const eventCount = (await testEnv.AGENT_ACTION_KV.list({ prefix: AGENT_ONLY_ANSWER_EVENT_KV_PREFIX })).keys.length;
  assert.equal(eventCount, 4);

  const replay = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...base,
      answers: [
        { statement_id: ids[0], answer: { value: 'agree' }, confidence: 85, rationale: 'Matches prior preferences.' },
        { statement_id: ids[1], answer: { text: 'Improve the way sessions are scheduled.' }, confidence: 61 },
        { statement_id: ids[2], answer: { value: 8 }, confidence: 74 },
        { statement_id: ids[3], skipped: true, skip_reason: 'privacy_protective' },
      ],
    },
  });
  assert.equal(replay.replay, true);
  const eventCountAfterReplay = (await testEnv.AGENT_ACTION_KV.list({ prefix: AGENT_ONLY_ANSWER_EVENT_KV_PREFIX })).keys.length;
  assert.equal(eventCountAfterReplay, 4);

  const metrics = await buildAgentOnlyMetrics({ env: testEnv, scope: 'session', sessionSlug: 'alpha' });
  assert.equal(metrics.responsesSubmitted, 3);
  assert.equal(metrics.privacySkips, 1);
  assert.equal(metrics.distinctPrincipals, 1);

  const exported = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'answers',
    format: 'jsonl',
  });
  const answerRows = exported.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const skipRow = answerRows.find((row) => row.event_kind === 'privacy_protective_skip');
  assert.equal(exported.ok, true);
  assert.equal(answerRows.length, 4);
  assert.equal(answerRows.every((row) => row.request_id === 'answers-1'), true);
  assert.equal(skipRow.rationale, null);
  assert.equal(skipRow.confidence, null);

  const calibration = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'calibration',
    format: 'jsonl',
  });
  const calibrationRows = calibration.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(calibrationRows.reduce((sum, row) => sum + row.prediction_count, 0), 3);
  assert.equal(calibrationRows.some((row) => row.confidence_band === '0-9'), false);

  const rerun = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:11:00.000Z',
    body: {
      ...base,
      request_id: 'answers-rerun',
      answers: [{ statement_id: ids[0], answer: { value: 'disagree' }, confidence: 42 }],
    },
  });
  assert.equal(rerun.ok, true);
  const rerunAnswers = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'answers',
    format: 'jsonl',
  });
  assert.equal(rerunAnswers.body.split('\n').filter(Boolean).length, 5);
  const rerunCalibration = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'calibration',
    format: 'jsonl',
  });
  const rerunCalibrationRows = rerunCalibration.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(rerunCalibrationRows.reduce((sum, row) => sum + row.prediction_count, 0), 3);
  assert.deepEqual(rerunCalibrationRows.map((row) => row.confidence_band), ['40-49', '60-69', '70-79']);
});

test('admin metrics count distinct principals once across multiple windows', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  const common = {
    agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
    answers: [{ statement_id: ids[0], answer: { value: 'agree' }, confidence: 83 }],
  };
  const first = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...common,
      window_id: 'w-2026-06-12',
      request_id: 'principal-window-a',
    },
  });
  const second = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-15T15:10:00.000Z',
    body: {
      ...common,
      window_id: 'w-2026-06-15',
      request_id: 'principal-window-b',
    },
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const metrics = await buildAgentOnlyMetrics({ env: testEnv, scope: 'session', sessionSlug: 'alpha' });
  assert.equal(metrics.responsesSubmitted, 2);
  assert.equal(metrics.distinctPrincipals, 1);
  assert.deepEqual(
    metrics.perWindow.map((window) => [window.windowId, window.distinctPrincipals]),
    [['w-2026-06-12', 1], ['w-2026-06-15', 1]],
  );
});

test('rating zero predictions keep a visible label and matching semantic fingerprint', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const accepted = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      request_id: 'rating-zero',
      agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
      answers: [{ statement_id: ids[2], answer: { value: 0 }, confidence: 77 }],
    },
  });
  assert.equal(accepted.ok, true);
  const review = await loadAgentOnlyPredictionsForPrincipal({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:11:00.000Z',
  });
  assert.equal(review.predictionsByQuestionId[ids[2]].valueLabel, '0');
  assert.equal(
    review.predictionsByQuestionId[ids[2]].semanticFingerprint,
    await semanticFingerprintForAgentOnlyAnswer({ questionType: 'rating', value: 0, label: '0' }),
  );
});

test('token votes enforce linear and quadratic budgets and replace per-mode allocation', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const common = {
    window_id: 'w-2026-06-12',
    agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
  };
  const linear = await submitAgentOnlyTokenVotesBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...common,
      request_id: 'linear-1',
      mode: 'linear',
      votes: [{ statement_id: ids[0], votes: 60 }, { statement_id: ids[1], votes: -40 }],
    },
  });
  assert.equal(linear.ok, true);
  assert.equal(linear.budgetUsed, 100);

  const over = await submitAgentOnlyTokenVotesBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...common,
      request_id: 'linear-over',
      mode: 'linear',
      votes: [{ statement_id: ids[0], votes: 60 }, { statement_id: ids[1], votes: -41 }],
    },
  });
  assert.equal(over.ok, false);
  assert.equal(over.errors[0].reason, 'vote_budget_exceeded');
  const stale = await submitAgentOnlyTokenVotesBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...common,
      request_id: 'stale-votes',
      window_id: 'w-2026-06-15',
      mode: 'linear',
      votes: [{ statement_id: ids[0], votes: 1 }],
    },
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.status, 409);
  assert.equal(stale.reason, 'window_mismatch');

  const quadratic = await submitAgentOnlyTokenVotesBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      ...common,
      request_id: 'quad-1',
      mode: 'quadratic',
      votes: [{ statement_id: ids[0], votes: 10 }],
    },
  });
  assert.equal(quadratic.ok, true);
  assert.equal(quadratic.budgetUsed, 100);

  const metrics = await buildAgentOnlyMetrics({ env: testEnv, scope: 'session', sessionSlug: 'alpha' });
  assert.equal(metrics.voteAllocations, 2);
  assert.equal(metrics.voteBudgetUsed, 200);
});

test('human review is idempotent and agent reruns never overwrite human precedence', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const firstAgent = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      request_id: 'precedence-agent-1',
      agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
      answers: [{ statement_id: ids[0], answer: { value: 'agree' }, confidence: 85 }],
    },
  });
  assert.equal(firstAgent.ok, true);
  const confirm = await recordAgentOnlyHumanReview({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    questionId: ids[0],
    answer: { questionType: 'agree_unsure_disagree', value: 'agree' },
    kind: 'confirm',
    now: '2026-06-12T15:11:00.000Z',
  });
  assert.equal(confirm.recorded, true);
  assert.equal(confirm.source, 'human_confirm');
  const duplicateConfirm = await recordAgentOnlyHumanReview({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    questionId: ids[0],
    answer: { questionType: 'agree_unsure_disagree', value: 'agree' },
    kind: 'confirm',
    now: '2026-06-12T15:12:00.000Z',
  });
  assert.equal(duplicateConfirm.recorded, false);
  assert.equal(duplicateConfirm.reason, 'already_confirmed');
  const rerun = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:13:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      request_id: 'precedence-agent-2',
      agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
      answers: [{ statement_id: ids[0], answer: { value: 'disagree' }, confidence: 64 }],
    },
  });
  assert.equal(rerun.ok, true);
  const stateKey = __test__telegramAgentOnlyMode.answerStateKey('alpha', 'w-2026-06-12', '1001');
  const state = JSON.parse(await testEnv.AGENT_ACTION_KV.get(stateKey));
  assert.deepEqual(state.byStatement[ids[0]].agent.answer, { value: 'disagree' });
  assert.equal(state.byStatement[ids[0]].human.kind, 'confirm');
  assert.deepEqual(state.byStatement[ids[0]].human.answer, { questionType: 'agree_unsure_disagree', value: 'agree' });
});

test('explicit confirm after a human edit is a no-op and preserves edit classification', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const agent = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      request_id: 'edit-before-confirm-agent',
      agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
      answers: [{ statement_id: ids[0], answer: { value: 'agree' }, confidence: 85 }],
    },
  });
  assert.equal(agent.ok, true);
  const edit = await recordAgentOnlyHumanReview({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    questionId: ids[0],
    answer: { questionType: 'agree_unsure_disagree', value: 'disagree' },
    kind: 'edit',
    now: '2026-06-12T15:11:00.000Z',
  });
  assert.equal(edit.recorded, true);
  assert.equal(edit.source, 'human_edit_after_agent');
  const eventCountBeforeConfirm = (await testEnv.AGENT_ACTION_KV.list({ prefix: AGENT_ONLY_ANSWER_EVENT_KV_PREFIX })).keys.length;
  const confirm = await recordAgentOnlyHumanReview({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    questionId: ids[0],
    answer: { questionType: 'agree_unsure_disagree', value: 'disagree' },
    kind: 'confirm',
    now: '2026-06-12T15:12:00.000Z',
  });
  assert.equal(confirm.recorded, false);
  assert.equal(confirm.reason, 'already_reviewed');
  const eventCountAfterConfirm = (await testEnv.AGENT_ACTION_KV.list({ prefix: AGENT_ONLY_ANSWER_EVENT_KV_PREFIX })).keys.length;
  assert.equal(eventCountAfterConfirm, eventCountBeforeConfirm);
  const stateKey = __test__telegramAgentOnlyMode.answerStateKey('alpha', 'w-2026-06-12', '1001');
  const state = JSON.parse(await testEnv.AGENT_ACTION_KV.get(stateKey));
  assert.equal(state.byStatement[ids[0]].human.kind, 'edit');
  assert.deepEqual(state.byStatement[ids[0]].human.answer, { questionType: 'agree_unsure_disagree', value: 'disagree' });
});

test('human tap batches are flagged-only, refundable, and exported without raw user ids', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  const taps = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:10:00.000Z',
    taps: [{ questionId: ids[0], delta: 1 }, { questionId: ids[0], delta: 1 }, { questionId: ids[0], delta: -1 }],
  });
  assert.equal(taps.ok, true);
  assert.deepEqual(taps.nets, { [ids[0]]: 1 });
  assert.equal(taps.budgetUsed, 1);
  const refunded = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:11:00.000Z',
    taps: [{ questionId: ids[0], delta: -1 }],
  });
  assert.equal(refunded.ok, true);
  assert.deepEqual(refunded.nets, {});
  assert.equal(refunded.budgetUsed, 0);
  const exactBatches = Array.from({ length: 50 }, () => ({ questionId: ids[0], delta: 1 }));
  const exactA = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:12:00.000Z',
    taps: exactBatches,
  });
  const exactB = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:13:00.000Z',
    taps: exactBatches,
  });
  assert.equal(exactA.ok, true);
  assert.equal(exactB.ok, true);
  assert.equal(exactB.budgetUsed, 100);
  const over = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1001',
    now: '2026-06-12T15:14:00.000Z',
    taps: [{ questionId: ids[0], delta: 1 }],
  });
  assert.equal(over.ok, false);
  assert.equal(over.reason, 'human_vote_budget_exceeded');
  const afterOver = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'votes',
    format: 'jsonl',
  });
  assert.equal(afterOver.body.includes('"votes":100'), true);

  const isolated = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1002',
    now: '2026-06-12T15:15:00.000Z',
    taps: [{ questionId: ids[1], delta: 1 }],
  });
  assert.equal(isolated.ok, true);
  assert.deepEqual(isolated.nets, { [ids[1]]: 1 });
  const unflagged = await submitAgentOnlyHumanVoteTaps({
    env: testEnv,
    sessionSlug: 'alpha',
    windowId: 'w-2026-06-12',
    telegramUserId: '1002',
    now: '2026-06-12T15:16:00.000Z',
    taps: [{ questionId: 'ceq_not_flagged', delta: 1 }],
  });
  assert.equal(unflagged.ok, false);
  assert.equal(unflagged.reason, 'tap_statement_not_flagged');

  const exported = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'votes',
    format: 'jsonl',
  });
  assert.equal(exported.ok, true);
  assert.equal(exported.body.includes('1001'), false);
  assert.equal(exported.body.includes('cep_'), true);
  assert.notEqual(
    exported.body.includes(createHash('sha256').update('1001').digest('hex').slice(0, 24)),
    true,
  );
});

test('wide and gold exports join normal submitted answers and snapshot eval types', async () => {
  const testEnv = env();
  const { ids } = await seedQuestions(testEnv);
  await materializeAgentOnlyWindow({ env: testEnv, sessionSlug: 'alpha', now: '2026-06-12T15:05:00.000Z' });
  await persistTelegramSubmitRecord({
    env: testEnv,
    record: {
      requestId: 'normal-prior',
      status: 'submit_request_created',
      sessionSlug: 'alpha',
      telegramUserId: '1001',
      questionId: ids[0],
      answer: { value: 'disagree' },
      createdAt: '2026-06-12T15:03:00.000Z',
    },
  });
  const agent = await submitAgentOnlyAnswersBulk({
    env: testEnv,
    sessionSlug: 'alpha',
    telegramUserId: '1001',
    now: '2026-06-12T15:05:00.000Z',
    body: {
      window_id: 'w-2026-06-12',
      agent_metadata: { model: 'unit', scaffold_version: 'test' },
      request_id: 'agent-after-prior',
      answers: [{ statement_id: ids[0], answer: { value: 'agree' }, confidence: 70 }],
    },
  });
  assert.equal(agent.ok, true);
  await persistTelegramSubmitRecord({
    env: testEnv,
    record: {
      requestId: 'normal-current',
      status: 'submit_request_created',
      sessionSlug: 'alpha',
      telegramUserId: '1001',
      questionId: ids[0],
      answer: { value: 'unsure' },
      createdAt: '2026-06-12T15:10:00.000Z',
    },
  });

  const wide = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'wide',
    format: 'jsonl',
  });
  assert.equal(wide.ok, true);
  const wideRows = wide.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(wideRows.length, 1);
  assert.equal(wideRows[0].eval_type, 'human_split');
  assert.deepEqual(wideRows[0].agent_prediction, { value: 'agree' });
  assert.deepEqual(wideRows[0].human_current_answer, { value: 'unsure' });

  const gold = await exportAgentOnlyData({
    env: testEnv,
    sessionSlug: 'alpha',
    view: 'gold',
    format: 'jsonl',
  });
  assert.equal(gold.ok, true);
  const goldRows = gold.body.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(goldRows.length, 1);
  assert.equal(goldRows[0].eval_type, 'human_split');
  assert.deepEqual(goldRows[0].prior_human_answer, { value: 'disagree' });
  assert.deepEqual(goldRows[0].agent_prediction, { value: 'agree' });
  assert.equal(gold.body.includes('1001'), false);
});
