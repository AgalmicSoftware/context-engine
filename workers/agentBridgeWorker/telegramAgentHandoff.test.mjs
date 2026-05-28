import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleTelegramAgentHandoffRequest } from './telegramAgentHandoff.mjs';
import { buildTelegramCommandResponse, readAnswerDraft } from './telegramCommands.mjs';
import { saveTelegramAgentSettingsPatch } from './telegramAgentSettings.mjs';
import { createTelegramAgentDelegationToken } from './telegramAgentDelegationTokens.mjs';
import { deriveTelegramResponseExportAccount } from './telegramResponseExport.mjs';

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

async function managedAccountAddressForTelegramUser(env, telegramUserId = '42') {
  const account = await deriveTelegramResponseExportAccount({
    env,
    normalized: {
      type: 'telegram_mock_update',
      user: { telegramUserId, username: 'host' },
      chat: { chatId: telegramUserId, chatType: 'private', type: 'private', isPrivate: true },
    },
    createdAt: '2026-05-08T12:00:00.000Z',
  });
  return account.accountAddress;
}

test('Telegram agent handoff skill is packaged with the worker', () => {
  const source = readFileSync(
    new URL('./skills/ce-telegram-agent-handoff/SKILL.md', import.meta.url),
    'utf8',
  );

  assert.match(source, /^# CE Telegram Agent Handoff/m);
  assert.match(source, /POST \/telegram\/agent\/api\/preferences/);
  assert.match(source, /Non-Telegram Agent Token Flow/);
  assert.match(source, /Install From Public Git/);
  assert.match(source, /raw\.githubusercontent\.com\/AgalmicSoftware\/context-engine/);
  assert.match(source, /CE_SKILL_REF/);
  assert.ok(source.includes('${CODEX_HOME:-$HOME/.codex}/skills/ce-telegram-agent-handoff'));
  assert.match(source, /default token expiry is 28 days/i);
  assert.match(source, /Authorization: Bearer ceagt_/);
  assert.match(source, /refresh_token_via_telegram/);
  assert.match(source, /POST \/telegram\/agent\/api\/questions\/next/);
  assert.match(source, /POST \/telegram\/agent\/api\/question-queue/);
  assert.match(source, /\/question_queue 1 3 4/);
  assert.match(source, /allowedProfileFields/);
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

test('Telegram agent handoff accepts scoped user delegation tokens without a shared service token', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: '' });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-12-01T12:00:00.000Z',
  });

  assert.equal(issued.ok, true);
  const questionsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha', {
      token: issued.token,
    }),
    env,
  });
  const questions = await jsonBody(questionsResponse);
  assert.equal(questionsResponse.status, 200);
  assert.equal(questions.questions.length, 2);
  const nextResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions/next?sessionSlug=alpha&queueKey=token-smoke', {
      method: 'POST',
      token: issued.token,
    }),
    env,
  });
  const next = await jsonBody(nextResponse);
  assert.equal(nextResponse.status, 200);
  assert.equal(next.question.questionId, 'q-binary');

  const mismatchResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=beta', {
      token: issued.token,
    }),
    env,
  });
  const mismatch = await jsonBody(mismatchResponse);
  assert.equal(mismatchResponse.status, 403);
  assert.equal(mismatch.reason, 'agent_token_session_mismatch');

  const childSessionResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/sessions/child', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        sessionName: 'Child should not be allowed',
      },
    }),
    env,
  });
  const child = await jsonBody(childSessionResponse);
  assert.equal(childSessionResponse.status, 403);
  assert.equal(child.reason, 'agent_token_scope_denied');

  const queueAdminResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-queue', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        sponsoredQuestionIds: ['q-binary'],
      },
    }),
    env,
  });
  const queueAdmin = await jsonBody(queueAdminResponse);
  assert.equal(queueAdminResponse.status, 403);
  assert.equal(queueAdmin.reason, 'agent_token_scope_denied');
  assert.equal(queueAdmin.requiredScope, 'unsupported_route');

  const expired = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    sessionSlug: 'alpha',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const expiredResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha', {
      token: expired.token,
    }),
    env,
  });
  const expiredBody = await jsonBody(expiredResponse);
  assert.equal(expiredResponse.status, 401);
  assert.equal(expiredBody.reason, 'agent_token_expired');
  assert.equal(expiredBody.action, 'refresh_token_via_telegram');
  assert.equal(expiredBody.telegramCommand, '/start');
  assert.equal(expiredBody.telegramButton, 'Onboard Agent');
  assert.match(expiredBody.message, /open the Context Engine Telegram bot/i);
  assert.match(expiredBody.message, /Onboard Agent/);

  const missingTokenResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha', {
      token: 'ceagt_missing_or_kv_expired_token',
    }),
    env,
  });
  const missingTokenBody = await jsonBody(missingTokenResponse);
  assert.equal(missingTokenResponse.status, 401);
  assert.equal(missingTokenBody.reason, 'agent_token_not_found');
  assert.equal(missingTokenBody.action, 'refresh_token_via_telegram');
});

test('Telegram agent activity endpoint scopes ceagt tokens to the delegated user and session', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: '' });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'34'.repeat(20)}`,
    createdAt: '2026-12-01T12:00:00.000Z',
  });
  await env.AGENT_ACTION_KV.put('telegram:answer-draft:42:alpha:q-binary', JSON.stringify({
    status: 'draft_saved',
    telegramUserId: '42',
    sessionSlug: 'alpha',
    questionId: 'q-binary',
    answerLabel: 'Delegated user draft',
    answerValue: 'Delegated user draft',
    selectedAt: '2026-12-01T12:01:00.000Z',
  }));
  await env.AGENT_ACTION_KV.put('telegram:answer-draft:42:beta:q-binary', JSON.stringify({
    status: 'draft_saved',
    telegramUserId: '42',
    sessionSlug: 'beta',
    questionId: 'q-binary',
    answerLabel: 'Wrong session draft',
    answerValue: 'Wrong session draft',
    selectedAt: '2026-12-01T12:02:00.000Z',
  }));
  await env.AGENT_ACTION_KV.put('telegram:answer-draft:43:alpha:q-binary', JSON.stringify({
    status: 'draft_saved',
    telegramUserId: '43',
    sessionSlug: 'alpha',
    questionId: 'q-binary',
    answerLabel: 'Wrong user draft',
    answerValue: 'Wrong user draft',
    selectedAt: '2026-12-01T12:03:00.000Z',
  }));
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/actions?sessionSlug=alpha', {
      token: issued.token,
    }),
    env,
  });
  const body = await jsonBody(response);
  const serialized = JSON.stringify(body);

  assert.equal(response.status, 200);
  assert.equal(body.telegramUserId, '42');
  assert.equal(body.sessionSlug, 'alpha');
  assert.equal(body.actions.length, 1);
  assert.match(serialized, /Delegated user draft/);
  assert.equal(serialized.includes('Wrong user draft'), false);
  assert.equal(serialized.includes('Wrong session draft'), false);
  assert.equal(serialized.includes(issued.token), false);
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
  assert.equal(binaryDraft.source, 'agent_handoff');
  assert.equal(binaryDraft.actionMetadata.authMode, 'service_token');
  await env.AGENT_ACTION_KV.put('telegram:answer-draft:43:alpha:q-binary', JSON.stringify({
    status: 'draft_saved',
    telegramUserId: '43',
    sessionSlug: 'alpha',
    questionId: 'q-binary',
    answerLabel: 'Other user draft',
    answerValue: 'Other user draft',
    selectedAt: '2026-05-08T12:01:00.000Z',
  }));

  const actionsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/actions?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123'),
    env,
  });
  const actions = await jsonBody(actionsResponse);
  assert.equal(actionsResponse.status, 200);
  assert.equal(actions.actions.some((item) => (
    item.type === 'answer_draft' &&
    item.sessionSlug === 'alpha' &&
    item.questionId === 'q-binary' &&
    item.pendingAction === 'review_draft' &&
    item.content.answerLabel === 'Agree'
  )), true);
  assert.equal(JSON.stringify(actions).includes('Other user draft'), false);
  assert.equal(JSON.stringify(actions).includes('agent-test-token'), false);
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

test('Telegram agent handoff rejects group calls from sessions with a different approved chat', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true,
        telegramOnly: true,
        approvedTelegramGroupChatIds: ['-100999'],
      }],
    }),
  });
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
      },
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 403);
  assert.equal(body.reason, 'telegram_group_not_approved_for_session');
  assert.equal(body.sessionSlug, 'alpha');
});

test('Telegram agent handoff accepts dynamically approved Telegram groups', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true,
        telegramOnly: true,
        telegramGroupApprovalRequired: true,
      }],
    }),
  });
  await env.AGENT_ACTION_KV.put('telegram:group-approval:alpha:-100123', JSON.stringify({
    version: 1,
    type: 'telegram_group_approval',
    sessionSlug: 'alpha',
    chatId: '-100123',
    approvedAt: '2026-05-08T12:00:00.000Z',
  }));
  await env.AGENT_ACTION_KV.put('telegram:group-session:-100123', JSON.stringify({
    version: 1,
    chatId: '-100123',
    sessionSlug: 'alpha',
    sessionName: 'Alpha Session',
    linkedAt: '2026-05-08T12:00:00.000Z',
  }));
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
      },
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.sessionSlug, 'alpha');
  assert.equal(body.questions.length > 0, true);
});

test('Telegram agent next-question queue serves sponsored questions first and advances per criteria', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_QUESTION_QUEUE_JSON: JSON.stringify({ alpha: ['q-freeform'] }),
  });
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const firstResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions/next', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        queueKey: 'daily-default',
      },
    }),
    env,
  });
  const first = await jsonBody(firstResponse);
  const secondResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions/next', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        queueKey: 'daily-default',
      },
    }),
    env,
  });
  const second = await jsonBody(secondResponse);
  const criteriaResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions/next', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        queueKey: 'funding-only',
        criteria: { tags: ['funding'] },
      },
    }),
    env,
  });
  const criteria = await jsonBody(criteriaResponse);

  assert.equal(firstResponse.status, 200);
  assert.equal(first.question.questionId, 'q-freeform');
  assert.equal(first.sponsored, true);
  assert.equal(first.reason, 'sponsored_question_queue');
  assert.equal(second.question.questionId, 'q-binary');
  assert.equal(second.sponsored, false);
  assert.equal(second.queue.advanced, true);
  assert.equal(criteriaResponse.status, 200);
  assert.equal(criteria.question.questionId, 'q-binary');
  assert.equal(criteria.sponsored, false);
  assert.deepEqual(criteria.queue.criteria.tags, ['funding']);
});

test('Telegram agent service token can manage sponsored question queue as session admin', async () => {
  const env = baseEnv();
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = await managedAccountAddressForTelegramUser(env, '42');
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const setResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-queue', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        sponsoredQuestionIds: ['2', 'q-binary', 'missing-question'],
      },
    }),
    env,
  });
  const setBody = await jsonBody(setResponse);
  const getResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-queue?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123'),
    env,
  });
  const getBody = await jsonBody(getResponse);
  const nextResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions/next', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        queueKey: 'admin-sponsored-smoke',
      },
    }),
    env,
  });
  const next = await jsonBody(nextResponse);

  assert.equal(setResponse.status, 200);
  assert.equal(setBody.saved, true);
  assert.deepEqual(setBody.questionQueue.sponsoredQuestionIds, ['q-freeform', 'q-binary']);
  assert.deepEqual(setBody.skipped, ['missing-question']);
  assert.equal(setBody.candidates.length, 2);
  assert.equal(getResponse.status, 200);
  assert.deepEqual(getBody.questionQueue.sponsoredQuestionIds, ['q-freeform', 'q-binary']);
  assert.equal(nextResponse.status, 200);
  assert.equal(next.question.questionId, 'q-freeform');
  assert.equal(next.sponsored, true);
});

test('Telegram agent question queue management rejects non-admin service users', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: `0x${'ab'.repeat(20)}`,
  });
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-queue', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        sessionSlug: 'alpha',
        sponsoredQuestionIds: ['q-binary'],
      },
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 403);
  assert.equal(body.reason, 'response_export_admin_required');
  assert.match(body.accountAddress, /^0x[0-9a-fA-F]{40}$/);
});

test('Telegram agent can recommend and auto-apply question importance votes with research metadata', async () => {
  const env = baseEnv();
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  await saveTelegramAgentSettingsPatch({
    env,
    telegramUserId: '42',
    sessionSlug: 'alpha',
    patch: { agentAutoApplyQuestionVotes: true },
    createdAt: '2026-05-08T12:00:01.000Z',
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
  assert.equal(decisionRecords[0].actionMetadata.source, 'agent_handoff');
  assert.equal(decisionRecords[0].actionMetadata.authMode, 'service_token');
  assert.equal(decisionRecords[0].actionMetadata.clientSource, 'openclaw');
  assert.equal(Object.hasOwn(decisionRecords[0].actionMetadata, 'apiKey'), false);
});

test('Telegram agent question auto-votes are opt-in by default', async () => {
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
        preferences: { interests: ['funding'] },
      },
    }),
    env,
  });
  const body = await jsonBody(response);
  const voteRecordCount = Array.from(env.AGENT_ACTION_KV.store.keys())
    .filter((key) => key.startsWith('telegram:mini-app-question-vote:v1:alpha:'))
    .length;

  assert.equal(response.status, 200);
  assert.equal(body.settings.agentAutoApplyQuestionVotes, false);
  assert.equal(body.autoApply.ok, false);
  assert.equal(body.autoApply.reason, 'agent_question_vote_auto_apply_disabled');
  assert.equal(voteRecordCount, 0);
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
