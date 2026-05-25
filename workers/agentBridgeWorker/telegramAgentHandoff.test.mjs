import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTelegramAgentHandoffRequest } from './telegramAgentHandoff.mjs';
import { buildTelegramCommandResponse, readAnswerDraft } from './telegramCommands.mjs';

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
      },
      {
        questionId: 'q-freeform',
        questionType: 'freeform',
        prompt: 'What should Alpha decide next?',
      },
    ]),
    AGENT_ACTION_KV: new MemoryKv(),
    ...overrides,
  };
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
