import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleTelegramAgentHandoffRequest } from './telegramAgentHandoff.mjs';
import { buildTelegramCommandResponse, readAnswerDraft } from './telegramCommands.mjs';
import { saveTelegramAgentSettingsPatch } from './telegramAgentSettings.mjs';

class MemoryKv {
  constructor() {
    this.store = new Map();
  }

  async put(key, value) {
    this.store.set(key, value);
  }

  async get(key) {
    return this.store.get(key) || null;
  }

  async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
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
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    TELEGRAM_BOT_TOKEN: '123456:test-token',
    DEFAULT_CHAIN_ID: '11155420',
    DEFAULT_RPC_URL: 'https://rpc.example.test',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true,
        managedAccountSubmitAllowed: true,
      }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: 'q-binary',
        questionType: 'binary',
        prompt: 'Should Alpha fund this proposal?',
        tags: ['funding', 'governance'],
      },
      {
        questionId: 'q-freeform',
        questionType: 'freeform',
        prompt: 'What should Alpha decide next?',
        tags: ['strategy'],
      },
    ]),
    AGENT_ACTION_KV: new MemoryKv(),
    ...overrides,
  };
}

function telegramOnlyEnv(overrides = {}) {
  return baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true,
        telegramOnly: true,
        managedAccountSubmitAllowed: true,
      }],
    }),
    ...overrides,
  });
}

function groupMessage(text) {
  return {
    update_id: 9001,
    message: {
      message_id: 11,
      text,
      chat: { id: -100123, type: 'supergroup', title: 'Alpha Lobby' },
      from: { id: 42, username: 'host' },
    },
  };
}

function agentRequest(path, {
  method = 'GET',
  token = 'agent-test-token',
  body = null,
} = {}) {
  return new Request(`https://bridge.example${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
}

async function jsonBody(response) {
  return response.json();
}

test('Telegram agent handoff skill is packaged with the worker', () => {
  const source = readFileSync(
    new URL('./skills/ce-telegram-agent-handoff/SKILL.md', import.meta.url),
    'utf8',
  );

  assert.match(source, /^# CE Telegram Agent Handoff/m);
  assert.match(source, /POST \/telegram\/agent\/api\/preferences/);
  assert.match(source, /do not submit answers unless a separate user-approved submit path is set in the user's CE settings/);
});

test('Telegram agent handoff requires the configured token', async () => {
  const env = baseEnv();
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123', {
      token: 'wrong',
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 401);
  assert.equal(body.reason, 'agent_api_token_invalid');
});

test('Telegram agent can read active questions and draft preferences after group join', async () => {
  const env = baseEnv();
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const questionsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123'),
    env,
  });
  const privateBoundResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha&telegramUserId=42'),
    env,
  });
  const questions = await jsonBody(questionsResponse);

  assert.equal(questionsResponse.status, 200);
  assert.equal(privateBoundResponse.status, 200);
  assert.equal(questions.questions.length, 2);
  assert.equal(questions.questions[0].answerable, true);

  const draftResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/preferences', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        preferences: {
          requireReview: true,
          answersByQuestionId: {
            'q-binary': { value: 'agree', comments: 'Matches the stated priority.' },
            'q-freeform': { text: 'Review the budget before voting.' },
          },
        },
      },
    }),
    env,
  });
  const drafted = await jsonBody(draftResponse);
  const binaryDraft = await readAnswerDraft({
    env,
    normalized: { user: { telegramUserId: '42' }, chat: { chatId: '-100123' } },
    sessionSlug: 'alpha',
    selectedQuestionId: 'q-binary',
  });

  assert.equal(draftResponse.status, 200);
  assert.equal(drafted.draftCount, 2);
  assert.equal(drafted.reviewRequired, true);
  assert.equal(binaryDraft.answerLabel, 'Agree');
  assert.match(binaryDraft.answerValue, /Matches the stated priority/);
});

test('Telegram agent can rank or filter questions by preference-derived tags', async () => {
  const env = baseEnv();
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const rankedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        preferences: {
          interests: ['funding'],
        },
      },
    }),
    env,
  });
  const ranked = await jsonBody(rankedResponse);

  assert.equal(rankedResponse.status, 200);
  assert.equal(ranked.relevance.mode, 'rank');
  assert.deepEqual(ranked.relevance.tags, ['funding']);
  assert.equal(ranked.questions[0].questionId, 'q-binary');
  assert.equal(ranked.questions[0].tags.includes('funding'), true);
  assert.equal(ranked.questions[0].relevance.score > 0, true);

  const filteredResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        relevanceMode: 'filter',
        preferences: {
          tags: ['strategy'],
        },
      },
    }),
    env,
  });
  const filtered = await jsonBody(filteredResponse);

  assert.equal(filteredResponse.status, 200);
  assert.equal(filtered.relevance.mode, 'filter');
  assert.deepEqual(filtered.questions.map((question) => question.questionId), ['q-freeform']);
  assert.equal(filtered.questions[0].tags.includes('strategy'), true);
});

test('Telegram agent can recommend and auto-apply question importance votes with research metadata', async () => {
  const env = baseEnv();
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-votes/recommend', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        autoApply: true,
        preferences: {
          interests: ['funding'],
        },
        agent: {
          id: 'hermes-1',
          name: 'Hermes',
          model: 'fixture-model',
        },
        metadata: {
          runId: 'run-123',
          source: 'openclaw',
          apiKey: 'should-not-be-stored',
        },
      },
    }),
    env,
  });
  const body = await jsonBody(response);
  const voteRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => key.startsWith('telegram:mini-app-question-vote:v1:alpha:'))
    .map(([, value]) => JSON.parse(value));
  const decisionRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => key.startsWith('telegram:agent-question-vote-decision:v1:alpha:'))
    .map(([, value]) => JSON.parse(value));

  assert.equal(response.status, 200);
  assert.equal(body.metaQuestion.questionId, 'meta-question-importance');
  assert.equal(body.settings.agentAutoApplyQuestionVotes, true);
  assert.equal(body.recommendations[0].questionId, 'q-binary');
  assert.equal(body.recommendations[0].suggestedVote, 'up');
  assert.equal(body.autoApply.ok, true);
  assert.equal(body.autoApply.appliedVotes.length, 1);
  assert.equal(voteRecords.some((record) => (
    record.questionId === 'q-binary' &&
    record.vote === 'up' &&
    record.source === 'agent_handoff' &&
    record.agentMetadata.agentName === 'Hermes' &&
    record.humanApproval.status === 'agent_auto_applied_pending_human_review' &&
    record.humanApproval.humanReviewed === false
  )), true);
  assert.equal(decisionRecords.length, 1);
  assert.equal(decisionRecords[0].actionMetadata.runId, 'run-123');
  assert.equal(Object.hasOwn(decisionRecords[0].actionMetadata, 'apiKey'), false);
});

test('Telegram agent question vote apply records human overrides and respects auto-apply setting', async () => {
  const env = baseEnv();
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const applyResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-votes/apply', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        approvalText: 'Approve q-binary as a downvote after review.',
        recommendations: [{
          questionId: 'q-binary',
          suggestedVote: 'up',
          reason: 'Matched funding.',
          agentNote: 'Suggested upvote for funding relevance.',
        }],
        decisions: [{
          questionId: 'q-binary',
          suggestedVote: 'up',
          finalVote: 'down',
          approved: true,
          humanNote: 'Not important for this user right now.',
        }],
      },
    }),
    env,
  });
  const applied = await jsonBody(applyResponse);
  const voteRecord = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => key.startsWith('telegram:mini-app-question-vote:v1:alpha:'))
    .map(([, value]) => JSON.parse(value))
    .find((record) => record.questionId === 'q-binary');

  assert.equal(applyResponse.status, 200);
  assert.equal(applied.ok, true);
  assert.equal(applied.appliedVotes[0].vote, 'down');
  assert.equal(applied.decisions[0].overridden, true);
  assert.equal(voteRecord.vote, 'down');
  assert.equal(voteRecord.humanApproval.status, 'human_approved');
  assert.equal(voteRecord.humanApproval.overridden, true);

  const saved = await saveTelegramAgentSettingsPatch({
    env,
    telegramUserId: '42',
    sessionSlug: 'alpha',
    patch: { agentAutoApplyQuestionVotes: false },
    createdAt: '2026-05-08T12:05:00.000Z',
  });
  assert.equal(saved.ok, true);

  const disabledResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-votes/recommend', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        autoApply: true,
        preferences: { interests: ['funding'] },
      },
    }),
    env,
  });
  const disabled = await jsonBody(disabledResponse);

  assert.equal(disabledResponse.status, 200);
  assert.equal(disabled.settings.agentAutoApplyQuestionVotes, false);
  assert.equal(disabled.autoApply.ok, false);
  assert.equal(disabled.autoApply.reason, 'agent_question_vote_auto_apply_disabled');
});

test('Telegram agent can create and dry-run pose a new group question', async () => {
  const env = baseEnv();
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions/pose', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        prompt: 'What question should the group answer next?',
        questionType: 'freeform',
        send: false,
      },
    }),
    env,
  });
  const body = await jsonBody(response);
  const questionsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123'),
    env,
  });
  const questions = await jsonBody(questionsResponse);

  assert.equal(response.status, 200);
  assert.equal(body.posed, true);
  assert.equal(body.sent, false);
  assert.equal(questions.questions.some((question) => question.prompt === 'What question should the group answer next?'), true);
});

test('Telegram agent can propose Cloudflare-only groups for user approval', async () => {
  const env = telegramOnlyEnv();
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const proposeResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/groups/propose', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        category: {
          categoryId: 'ai_tribe',
          label: 'AI tribe',
          selectionMode: 'single',
          options: [{ optionId: 'e_acc', label: 'e/acc' }],
        },
        optionIds: ['e_acc'],
        message: 'Consider joining the e/acc group for this session.',
      },
    }),
    env,
  });
  const proposed = await jsonBody(proposeResponse);

  assert.equal(proposeResponse.status, 200);
  assert.equal(proposed.ok, true);
  assert.equal(proposed.requiresUserApproval, true);
  assert.equal(proposed.category.categoryId, 'ai_tribe');

  const groupsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/groups?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123'),
    env,
  });
  const groups = await jsonBody(groupsResponse);

  assert.equal(groupsResponse.status, 200);
  assert.equal(groups.ok, true);
  assert.equal(groups.groups.categories.some((category) => category.categoryId === 'ai_tribe'), true);
  assert.equal(groups.groups.proposals.length, 1);
  assert.match(groups.groups.proposals[0].message, /e\/acc/);
});

test('Telegram agent can create a worker-local child session record', async () => {
  const env = telegramOnlyEnv();
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/sessions/child', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        childSessionSlug: 'alpha-breakout-1',
        sessionName: 'Alpha Breakout 1',
        questions: [{ questionId: 'q-child', questionType: 'freeform', prompt: 'What should this breakout decide?' }],
        groups: [{
          categoryId: 'breakout_role',
          label: 'Breakout role',
          selectionMode: 'single',
          options: [{ optionId: 'scribe', label: 'Scribe' }],
        }],
      },
    }),
    env,
  });
  const body = await jsonBody(response);
  const stored = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:child-session:alpha-breakout-1'));

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.session.sessionSlug, 'alpha-breakout-1');
  assert.equal(body.session.parentSessionSlug, 'alpha');
  assert.equal(body.canonicalStatus, 'worker_local_until_session_registry_parity');
  assert.equal(stored.questions[0].questionId, 'q-child');
});

test('Telegram agent group and child-session routes require telegram-only sessions', async () => {
  const env = baseEnv();
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const groupsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/groups?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123'),
    env,
  });
  const groups = await jsonBody(groupsResponse);
  const childResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/sessions/child', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        sessionName: 'Normal session child',
      },
    }),
    env,
  });
  const child = await jsonBody(childResponse);

  assert.equal(groupsResponse.status, 403);
  assert.equal(groups.reason, 'telegram_only_session_required');
  assert.equal(childResponse.status, 403);
  assert.equal(child.reason, 'telegram_only_session_required');
});
