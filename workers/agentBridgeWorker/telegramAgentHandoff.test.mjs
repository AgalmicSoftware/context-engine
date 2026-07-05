import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { handleTelegramAgentHandoffRequest } from './telegramAgentHandoff.mjs';
import {
  buildTelegramAgentActivityMetadata,
  listTelegramAgentActivity,
} from './telegramAgentActivity.mjs';
import { buildTelegramCommandResponse, readAnswerDraft } from './telegramCommands.mjs';
import { saveTelegramAgentSettingsPatch } from './telegramAgentSettings.mjs';
import {
  createTelegramAgentDelegationToken,
  loadTelegramAgentDelegationToken,
  TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_SCOPES,
  TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES,
} from './telegramAgentDelegationTokens.mjs';
import { deriveTelegramResponseExportAccount } from './telegramResponseExport.mjs';
import { persistTelegramSubmitRecord } from './telegramSubmitQueue.mjs';

const LONG_LIVED_TEST_TOKEN_TTL_SECONDS = 365 * 24 * 60 * 60;

class MemoryKv {
  constructor() {
    this.store = new Map();
    this.metadata = new Map();
    this.getCalls = 0;
    this.getKeys = [];
    this.listCalls = 0;
  }

  async put(key, value, options = {}) {
    this.store.set(key, value);
    if (options && typeof options === 'object' && Object.hasOwn(options, 'metadata')) {
      this.metadata.set(key, options.metadata);
    } else {
      this.metadata.delete(key);
    }
  }

  async get(key) {
    this.getCalls += 1;
    this.getKeys.push(key);
    return this.store.get(key) || null;
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list({ prefix = '', limit = 1000, cursor = '' } = {}) {
    this.listCalls += 1;
    const keys = Array.from(this.store.keys())
      .filter((key) => String(key).startsWith(prefix))
      .sort();
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

  resetGetCalls() {
    this.getCalls = 0;
    this.getKeys = [];
  }

  resetListCalls() {
    this.listCalls = 0;
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
        telegramGroupOpenAccess: true,
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
        telegramGroupOpenAccess: true,
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

function signInitData(fields = {}, botToken = '') {
  const dataCheckString = Object.entries(fields)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => (
      leftKey === rightKey
        ? String(leftValue).localeCompare(String(rightValue))
        : leftKey.localeCompare(rightKey)
    ))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
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
  assert.match(source, /\*\*Skill version:\*\* 2026-05-28 \(v2\)/);
  assert.match(source, /GET \/telegram\/agent\/api\/skill-version/);
  assert.match(source, /## Changelog/);
  assert.match(source, /POST \/telegram\/agent\/api\/preferences/);
  assert.match(source, /GET \/telegram\/agent\/api\/geo-backlink/);
  assert.match(source, /POST \/telegram\/agent\/api\/ce-install-preference/);
  assert.match(source, /GET \/telegram\/agent\/api\/digest/);
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
  assert.match(source, /GET \/telegram\/agent\/api\/admin\/status/);
  assert.match(source, /GET \/telegram\/agent\/api\/results\?sessionSlug=<slug>&view=topic-map/);
  assert.match(source, /GET \/telegram\/agent\/api\/results-image\?sessionSlug=<slug>&view=topic-map/);
  assert.match(source, /POST \/telegram\/agent\/api\/question-queue\/plan/);
  assert.match(source, /POST \/telegram\/agent\/api\/question-queue\/apply/);
  assert.match(source, /\/question_queue 1 3 4/);
  assert.match(source, /allowedProfileFields/);
  assert.match(source, /do not submit answers unless a separate user-approved submit path is set in the user's CE settings/);
});

test('Telegram agent handoff exposes unauthenticated skill version metadata', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_AGENT_SKILL_URL: 'https://example.test/skills/ce-telegram-agent-handoff/SKILL.md',
  });
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/skill-version', { token: '' }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.version, '2026-05-28 (v2)');
  assert.equal(body.skill, 'ce-telegram-agent-handoff');
  assert.equal(body.skillUrl, 'https://example.test/skills/ce-telegram-agent-handoff/SKILL.md');
  assert.equal(body.changelogUrl, 'https://example.test/skills/ce-telegram-agent-handoff/SKILL.md#changelog');
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

test('Telegram agent CE install preference respects decline cooldown and token ownership', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: '',
    AGENT_BRIDGE_CE_INSTALL_DECLINE_COOLDOWN_DAYS: '2',
  });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    ttlSeconds: LONG_LIVED_TEST_TOKEN_TTL_SECONDS,
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  const initialResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/ce-install-preference?sessionSlug=alpha', {
      token: issued.token,
    }),
    env,
  });
  const initial = await jsonBody(initialResponse);
  const declineResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/ce-install-preference', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        telegramUserId: '999',
        declined: true,
        createdAt: '2026-05-08T12:00:00.000Z',
      },
    }),
    env,
  });
  const declined = await jsonBody(declineResponse);
  const getResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/ce-install-preference?sessionSlug=alpha&telegramUserId=999&now=2026-05-08T12:00:01.000Z', {
      token: issued.token,
    }),
    env,
  });
  const got = await jsonBody(getResponse);
  const serviceGetOtherResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/ce-install-preference?telegramUserId=999', {
      token: 'agent-test-token',
    }),
    env: { ...env, AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token' },
  });
  const serviceOther = await jsonBody(serviceGetOtherResponse);
  await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/ce-install-preference', {
      method: 'POST',
      token: 'agent-test-token',
      body: {
        telegramUserId: '43',
        declined: true,
        createdAt: '2026-05-01T00:00:00.000Z',
      },
    }),
    env: { ...env, AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token' },
  });
  const expiredResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/ce-install-preference?telegramUserId=43&now=2026-05-08T12:00:00.000Z', {
      token: 'agent-test-token',
    }),
    env: { ...env, AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token' },
  });
  const expired = await jsonBody(expiredResponse);
  const clearResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/ce-install-preference', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        declined: false,
      },
    }),
    env,
  });
  const cleared = await jsonBody(clearResponse);

  assert.equal(initialResponse.status, 200);
  assert.equal(initial.declined, false);
  assert.equal(declineResponse.status, 200);
  assert.equal(declined.telegramUserId, '42');
  assert.equal(declined.declined, true);
  assert.equal(declined.cooldownDays, 2);
  assert.equal(declined.declinedUntil, '2026-05-10T12:00:00.000Z');
  assert.equal(getResponse.status, 200);
  assert.equal(got.telegramUserId, '42');
  assert.equal(got.declined, true);
  assert.equal(serviceGetOtherResponse.status, 200);
  assert.equal(serviceOther.telegramUserId, '999');
  assert.equal(serviceOther.declined, false);
  assert.equal(expiredResponse.status, 200);
  assert.equal(expired.declined, false);
  assert.equal(clearResponse.status, 200);
  assert.equal(cleared.declined, false);
});

test('Telegram agent onboarding returns consent questions and persists first-run answers', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: '' });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    ttlSeconds: LONG_LIVED_TEST_TOKEN_TTL_SECONDS,
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  const firstResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/onboarding?sessionSlug=alpha', {
      token: issued.token,
    }),
    env,
  });
  const first = await jsonBody(firstResponse);
  assert.equal(firstResponse.status, 200);
  assert.equal(first.completed, false);
  assert.equal(first.questions.length, 5);
  assert.equal(first.answers.preference_tailoring, false);
  assert.equal(first.settings.agentAutoApplyQuestionVotes, false);
  assert.equal(first.settings.dailyDigestOptIn, false);

  const saveResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/onboarding', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        createdAt: '2026-05-08T12:05:00.000Z',
        answers: {
          preference_tailoring: true,
          demographics_research: false,
          draft_responses: true,
          auto_apply_question_votes: true,
          edge_daily_digest: true,
        },
      },
    }),
    env,
  });
  const saved = await jsonBody(saveResponse);
  assert.equal(saveResponse.status, 200);
  assert.equal(saved.completed, true);
  assert.equal(saved.completedAt, '2026-05-08T12:05:00.000Z');
  assert.equal(saved.answers.preference_tailoring, true);
  assert.equal(saved.answers.draft_responses, true);
  assert.equal(saved.answers.auto_apply_question_votes, true);
  assert.equal(saved.settings.allowedProfileFields.includes('interests'), true);
  assert.equal(saved.settings.allowedUses.includes('rank_questions'), true);
  assert.equal(saved.settings.allowedUses.includes('draft_answers'), true);
  assert.equal(saved.settings.agentAutoApplyQuestionVotes, true);
  assert.equal(saved.settings.dailyDigestOptIn, true);

  const secondResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/onboarding?sessionSlug=alpha', {
      token: issued.token,
    }),
    env,
  });
  const second = await jsonBody(secondResponse);
  assert.equal(secondResponse.status, 200);
  assert.equal(second.completed, true);
  assert.equal(second.answers.preference_tailoring, true);
  assert.equal(second.answers.edge_daily_digest, true);
  assert.equal(JSON.stringify(second).includes(issued.token), false);
});

test('Mini App onboarding endpoint validates Telegram initData and mints a scoped user token', async () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: '',
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS: 'https://mini.example',
  });
  const initData = signInitData({
    auth_date: String(nowSeconds),
    query_id: 'mini-onboard-query',
    user: JSON.stringify({ id: 42, username: 'participant' }),
  }, env.TELEGRAM_BOT_TOKEN);
  const response = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/miniapp/onboard', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://mini.example',
      },
      body: JSON.stringify({
        initData,
        startParam: 'onboard__alpha',
      }),
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://mini.example');
  assert.equal(body.ok, true);
  assert.equal(body.worker, 'https://bridge.example');
  assert.equal(body.sessionSlug, 'alpha');
  assert.equal(body.skill, 'ce-telegram-agent-handoff');
  assert.match(body.token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  const loaded = await loadTelegramAgentDelegationToken({ env, token: body.token });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.telegramUserId, '42');
  assert.equal(loaded.record.sessionSlug, 'alpha');
});

test('Mini App onboarding endpoint rejects disallowed origins and invalid initData', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_MINIAPP_ALLOWED_ORIGINS: 'https://mini.example',
  });
  const originResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/miniapp/onboard', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example',
      },
      body: JSON.stringify({ initData: 'bad' }),
    }),
    env,
  });
  assert.equal(originResponse.status, 403);
  assert.equal((await jsonBody(originResponse)).reason, 'origin_not_allowed');

  const invalidResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/miniapp/onboard', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://mini.example',
      },
      body: JSON.stringify({ initData: 'bad' }),
    }),
    env,
  });
  assert.equal(invalidResponse.status, 401);
  assert.equal((await jsonBody(invalidResponse)).reason, 'miniapp_initdata_invalid');
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

test('Telegram agent activity vote scans use user-scoped prefixes past shared list caps', async () => {
  const env = telegramOnlyEnv();
  for (let index = 0; index < 320; index += 1) {
    await env.AGENT_ACTION_KV.put(`telegram:agent-question-vote-decision:v1:alpha:42:req-${String(index).padStart(3, '0')}`, JSON.stringify({
      sessionSlug: 'alpha',
      telegramUserId: '42',
      requestId: `other-${index}`,
      createdAt: `2026-12-01T10:${String(index % 60).padStart(2, '0')}:00.000Z`,
      decisions: [{
        questionId: `q-other-${index}`,
        suggestedVote: 'up',
        finalVote: 'up',
        applied: true,
      }],
    }));
  }
  for (let index = 0; index < 80; index += 1) {
    await env.AGENT_ACTION_KV.put(`telegram:agent-question-vote-decision:v1:alpha:99:req-${String(index).padStart(3, '0')}`, JSON.stringify({
      sessionSlug: 'alpha',
      telegramUserId: '99',
      requestId: `own-${index}`,
      createdAt: `2026-12-01T11:${String(index % 60).padStart(2, '0')}:00.000Z`,
      decisions: [{
        questionId: `q-own-${index}`,
        suggestedVote: 'down',
        finalVote: 'down',
        applied: true,
      }],
    }));
  }

  const items = await listTelegramAgentActivity({
    env,
    telegramUserId: '99',
    sessionSlugs: ['alpha'],
    includeContent: true,
    limit: 100,
  });
  const decisions = items.filter((item) => item.type === 'question_vote_decision');

  assert.equal(decisions.length, 80);
  assert.equal(decisions.every((item) => item.sessionSlug === 'alpha'), true);
  assert.equal(decisions.every((item) => item.questionId.startsWith('q-own-')), true);
  assert.equal(JSON.stringify(decisions).includes('q-other-'), false);
});

test('Telegram agent activity uses KV metadata for non-content one-to-one records with fallback', async () => {
  const env = telegramOnlyEnv();
  const metadataRecords = [
    {
      key: 'telegram:answer-draft:42:alpha:q-binary',
      value: {
        status: 'draft_saved',
        telegramUserId: '42',
        sessionSlug: 'alpha',
        questionId: 'q-binary',
        answerLabel: 'Agree',
        answerValue: 'Agree',
        controlType: 'binary',
        selectedAt: '2026-12-01T12:01:00.000Z',
      },
      metadata: buildTelegramAgentActivityMetadata({
        type: 'answer_draft',
        status: 'draft_saved',
        createdAt: '2026-12-01T12:01:00.000Z',
        pendingAction: 'review_draft',
        sessionSlug: 'alpha',
        questionId: 'q-binary',
        telegramUserId: '42',
      }),
    },
    {
      key: 'telegram:proposed-question:alpha:q-agent',
      value: {
        status: 'active',
        createdByTelegramUserId: '42',
        sessionSlug: 'alpha',
        questionId: 'q-agent',
        prompt: 'Should the agent village publish a daily recap?',
        questionType: 'binary',
        tags: ['recap'],
        createdAt: '2026-12-01T12:02:00.000Z',
      },
      metadata: buildTelegramAgentActivityMetadata({
        type: 'proposed_question',
        status: 'active',
        createdAt: '2026-12-01T12:02:00.000Z',
        sessionSlug: 'alpha',
        questionId: 'q-agent',
        telegramUserId: '42',
      }),
    },
    {
      key: 'telegram:lightweight-group-proposal:alpha:g-agent',
      value: {
        status: 'pending_user_decision',
        proposedBy: '42',
        targetTelegramUserId: '',
        sessionSlug: 'alpha',
        proposalId: 'g-agent',
        categoryId: 'role',
        optionIds: ['organizer'],
        message: 'Review the organizer group.',
        createdAt: '2026-12-01T12:03:00.000Z',
      },
      metadata: buildTelegramAgentActivityMetadata({
        type: 'group_proposal',
        status: 'pending_user_decision',
        createdAt: '2026-12-01T12:03:00.000Z',
        pendingAction: 'review_group_proposal',
        sessionSlug: 'alpha',
        telegramUserId: '42',
      }),
    },
  ];
  for (const record of metadataRecords) {
    await env.AGENT_ACTION_KV.put(record.key, JSON.stringify(record.value), { metadata: record.metadata });
  }

  env.AGENT_ACTION_KV.resetGetCalls();
  const metadataItems = await listTelegramAgentActivity({
    env,
    telegramUserId: '42',
    sessionSlugs: ['alpha'],
    includeContent: false,
    limit: 10,
  });

  assert.equal(env.AGENT_ACTION_KV.getCalls, 0);
  assert.deepEqual(metadataItems.map((item) => item.type).sort(), [
    'answer_draft',
    'group_proposal',
    'proposed_question',
  ]);
  assert.equal(JSON.stringify(metadataItems).includes('daily recap'), false);
  assert.equal(metadataItems.every((item) => !Object.hasOwn(item, 'content')), true);

  await env.AGENT_ACTION_KV.put('telegram:proposed-question:alpha:q-legacy', JSON.stringify({
    status: 'active',
    createdByTelegramUserId: '42',
    sessionSlug: 'alpha',
    questionId: 'q-legacy',
    prompt: 'Should legacy questions still render?',
    questionType: 'binary',
    tags: ['legacy'],
    createdAt: '2026-12-01T12:04:00.000Z',
  }));
  env.AGENT_ACTION_KV.resetGetCalls();
  const fallbackItems = await listTelegramAgentActivity({
    env,
    telegramUserId: '42',
    sessionSlugs: ['alpha'],
    includeContent: false,
    limit: 10,
  });
  assert.equal(env.AGENT_ACTION_KV.getCalls, 1);
  assert.equal(fallbackItems.some((item) => item.summary.includes('legacy questions still render')), true);

  env.AGENT_ACTION_KV.resetGetCalls();
  const contentItems = await listTelegramAgentActivity({
    env,
    telegramUserId: '42',
    sessionSlugs: ['alpha'],
    includeContent: true,
    limit: 10,
  });
  assert.equal(env.AGENT_ACTION_KV.getCalls >= 4, true);
  assert.equal(contentItems.some((item) => item.content?.prompt?.includes('daily recap')), true);
  assert.equal(contentItems.some((item) => item.content?.answerLabel === 'Agree'), true);
});

test('Telegram agent digest returns sponsored-first ranked questions and redacted pending activity', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: '',
    AGENT_BRIDGE_QUESTION_QUEUE_JSON: JSON.stringify({ alpha: ['q-sponsored'] }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: 'q-sponsored',
        questionType: 'binary',
        prompt: 'Should organizers sponsor baseline onboarding questions?',
        tags: ['sponsored'],
      },
      {
        questionId: 'q-geo',
        questionType: 'binary',
        prompt: 'Should the town hall host more agent demos?',
        tags: ['venue-feedback'],
        geoRefs: [{ geoId: 'edge-town-hall', kind: 'venue', label: 'Town Hall' }],
      },
      {
        questionId: 'q-other',
        questionType: 'binary',
        prompt: 'Should the schedule include longer breaks?',
        tags: ['schedule'],
      },
    ]),
  });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'78'.repeat(20)}`,
    ttlSeconds: LONG_LIVED_TEST_TOKEN_TTL_SECONDS,
    createdAt: '2026-05-08T12:00:00.000Z',
  });
  await saveTelegramAgentSettingsPatch({
    env,
    sessionSlug: 'alpha',
    telegramUserId: '42',
    patch: { dailyDigestOptIn: true },
    createdAt: '2026-05-08T12:00:01.000Z',
  });
  await env.AGENT_ACTION_KV.put('telegram:answer-draft:42:alpha:q-geo', JSON.stringify({
    status: 'draft_saved',
    telegramUserId: '42',
    sessionSlug: 'alpha',
    questionId: 'q-geo',
    answerLabel: 'Private draft answer should stay out of digest',
    answerValue: 'Private draft answer should stay out of digest',
    selectedAt: '2026-05-08T12:01:00.000Z',
  }), {
    metadata: buildTelegramAgentActivityMetadata({
      type: 'answer_draft',
      status: 'draft_saved',
      createdAt: '2026-05-08T12:01:00.000Z',
      pendingAction: 'review_draft',
      sessionSlug: 'alpha',
      questionId: 'q-geo',
      telegramUserId: '42',
    }),
  });
  await env.AGENT_ACTION_KV.put('telegram:agent-question-vote-recommendation:v1:alpha:42:req-1', JSON.stringify({
    sessionSlug: 'alpha',
    telegramUserId: '42',
    requestId: 'req-1',
    createdAt: '2026-05-08T12:02:00.000Z',
    recommendations: [{
      questionId: 'q-other',
      prompt: 'Internal prompt text is not needed in the digest.',
      suggestedVote: 'up',
      reason: 'Looks relevant.',
    }],
  }));
  await env.AGENT_ACTION_KV.put('telegram:answer-draft:99:alpha:q-other', JSON.stringify({
    status: 'draft_saved',
    telegramUserId: '99',
    sessionSlug: 'alpha',
    questionId: 'q-other',
    answerLabel: 'Wrong user draft',
    answerValue: 'Wrong user draft',
    selectedAt: '2026-05-08T12:03:00.000Z',
  }));

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/digest?sessionSlug=alpha&limit=2&geoIds=edge-town-hall&relevanceMode=filter', {
      token: issued.token,
    }),
    env,
  });
  const body = await jsonBody(response);
  const serialized = JSON.stringify(body);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.optedIn, true);
  assert.equal(body.limit, 2);
  assert.deepEqual(body.questions.map((question) => question.questionId), ['q-sponsored', 'q-geo']);
  assert.equal(body.questions[0].sponsored, true);
  assert.equal(body.questions[0].digestReason, 'admin_sponsored');
  assert.equal(body.questions[1].digestReason, 'preference_ranked');
  assert.deepEqual(body.questions[1].geoRefs, [{ geoId: 'edge-town-hall', kind: 'venue', label: 'Town Hall' }]);
  assert.deepEqual(body.relevance.geoIds, ['edge-town-hall']);
  assert.equal(body.relevance.mode, 'filter');
  assert.equal(body.pending.answerDraftCount, 1);
  assert.equal(body.pending.voteRecommendationCount, 1);
  assert.equal(body.pendingAnswerDrafts.length, 1);
  assert.equal(body.pendingVoteRecommendations.length, 1);
  assert.equal(serialized.includes('Private draft answer should stay out of digest'), false);
  assert.equal(serialized.includes('Wrong user draft'), false);
  assert.equal(serialized.includes(issued.token), false);
});

test('Telegram agent digest handles empty sessions and marks missing opt-in', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-unavailable', payloadUnavailable: true },
    ]),
  });
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/digest?sessionSlug=alpha&telegramUserId=42&limit=99'),
    env,
  });
  const body = await jsonBody(response);
  const serialized = JSON.stringify(body);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.optedIn, false);
  assert.equal(body.limit, 5);
  assert.deepEqual(body.questions, []);
  assert.equal(body.pending.answerDraftCount, 0);
  assert.equal(body.pending.voteRecommendationCount, 0);
  assert.equal(serialized.includes('agent-test-token'), false);
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
  assert.equal(env.AGENT_ACTION_KV.metadata.get('telegram:answer-draft:42:alpha:q-binary')?.t, 'answer_draft');
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

test('Telegram agent can read and render topic-map results without raw response records', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-onboarding', questionType: 'binary', prompt: 'Should onboarding be one click?', tags: ['onboarding'] },
      { questionId: 'q-privacy', questionType: 'binary', prompt: 'Should raw responses stay private?', tags: ['privacy'] },
    ]),
  });
  let counter = 0;
  for (const [questionId, telegramUserId, label] of [
    ['q-onboarding', '42', 'Agree'],
    ['q-onboarding', '43', 'Agree'],
    ['q-privacy', '42', 'Disagree'],
    ['q-privacy', '43', 'Agree'],
  ]) {
    counter += 1;
    await env.AGENT_ACTION_KV.put(`telegram:submit-request:${counter}`, JSON.stringify({
      status: 'direct_submitted',
      sessionSlug: 'alpha',
      telegramUserId,
      questionId,
      answer: { label, value: String(label).toLowerCase() },
      createdAt: `2026-05-08T12:02:0${counter}.000Z`,
    }));
  }

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/results?sessionSlug=alpha&telegramUserId=42&view=topic-map'),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.view, 'topic-map');
  assert.equal(body.available, true);
  assert.equal(body.topicMap.counts.answeredQuestions, 2);
  assert.equal(body.topicMap.topics.length, 2);
  assert.equal(JSON.stringify(body).includes('telegramUserId'), false);
  assert.equal(JSON.stringify(body).includes('direct_submitted'), false);

  const imageResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/results-image?sessionSlug=alpha&telegramUserId=42&view=topic-map'),
    env,
  });
  const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get('content-type'), 'image/png');
  assert.deepEqual(Array.from(imageBytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
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

test('Telegram agent ranks and returns geo-linked questions from geo preferences', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: 'q-general',
        questionType: 'binary',
        prompt: 'Should every session collect organizer feedback?',
        tags: ['governance'],
      },
      {
        questionId: 'q-geo',
        questionType: 'binary',
        prompt: 'Should the town hall venue host more agent demos?',
        tags: ['venue-feedback'],
        geoRefs: [{ geoId: 'edge-town-hall', kind: 'venue', label: 'Town Hall' }],
      },
    ]),
  });
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        preferences: {
          geoIds: ['edge-town-hall'],
        },
      },
    }),
    env,
  });
  const body = await jsonBody(response);
  const serialized = JSON.stringify(body);

  assert.equal(response.status, 200);
  assert.equal(body.relevance.mode, 'rank');
  assert.deepEqual(body.relevance.geoIds, ['edge-town-hall']);
  assert.equal(body.questions[0].questionId, 'q-geo');
  assert.equal(body.questions[0].tags.includes('geo:edge-town-hall'), true);
  assert.deepEqual(body.questions[0].geoRefs, [{ geoId: 'edge-town-hall', kind: 'venue', label: 'Town Hall' }]);
  assert.equal(body.questions[0].relevance.matchedGeoIds.includes('edge-town-hall'), true);
  assert.equal(serialized.includes('agent-test-token'), false);
  assert.equal(serialized.includes('123456:test-token'), false);
});

test('Telegram agent geo backlink returns public-safe Mini App link text', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: 'q-geo',
        questionType: 'binary',
        prompt: 'Should the town hall venue host more agent demos?',
        tags: ['venue-feedback'],
        geoRefs: [{ geoId: 'edge-town-hall', kind: 'venue', label: 'Town Hall' }],
      },
    ]),
  });
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/geo-backlink?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123&questionId=q-geo&geoId=edge-town-hall'),
    env,
  });
  const body = await jsonBody(response);
  const parsedUrl = new URL(body.questionUrl);
  const serialized = JSON.stringify(body);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.geoId, 'edge-town-hall');
  assert.equal(parsedUrl.origin, 'https://bridge.example');
  assert.equal(parsedUrl.pathname, '/telegram/mini-app');
  assert.equal(parsedUrl.searchParams.get('sessionSlug'), 'alpha');
  assert.equal(parsedUrl.searchParams.get('questionId'), 'q-geo');
  assert.match(body.suggestedComment, /Should the town hall venue host more agent demos/);
  assert.equal(serialized.includes('agent-test-token'), false);
  assert.equal(serialized.includes('123456:test-token'), false);
});

test('Telegram agent tags endpoint returns active tag counts and falls back to the default session', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: 'q-recap',
        questionType: 'binary',
        prompt: 'Do organizers need a recap?',
        tags: ['shared', 'alpha topic'],
      },
      {
        questionId: 'q-notes',
        questionType: 'binary',
        prompt: 'Should planning notes stay short?',
        tags: ['shared', 'beta-topic'],
      },
      {
        questionId: 'q-rotation',
        questionType: 'binary',
        prompt: 'Should facilitators rotate?',
        tags: ['alpha-topic'],
      },
    ]),
  });
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/tags?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123'),
    env,
  });
  const body = await jsonBody(response);
  const unknownResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/tags?sessionSlug=missing-session&telegramUserId=42'),
    env,
  });
  const unknown = await jsonBody(unknownResponse);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.sessionSlug, 'alpha');
  assert.equal(body.tags.find((entry) => entry.tag === 'alpha-topic')?.count, 2);
  assert.equal(body.tags.find((entry) => entry.tag === 'shared')?.count, 2);
  assert.equal(body.tags.find((entry) => entry.tag === 'beta-topic')?.count, 1);
  assert.equal(body.tags.findIndex((entry) => entry.tag === 'alpha-topic') < body.tags.findIndex((entry) => entry.tag === 'shared'), true);
  assert.equal(JSON.stringify(body).includes('organizers need a recap'), false);
  assert.equal(JSON.stringify(body).includes('agent-test-token'), false);
  assert.equal(unknownResponse.status, 200);
  assert.equal(unknown.sessionSlug, 'alpha');
  assert.equal(unknown.tags.find((entry) => entry.tag === 'shared')?.count, 2);
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
  const aliasResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-queue', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        questions: ['1'],
      },
    }),
    env,
  });
  const aliasBody = await jsonBody(aliasResponse);

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
  assert.equal(aliasResponse.status, 200);
  assert.deepEqual(aliasBody.questionQueue.sponsoredQuestionIds, ['q-binary']);
});

test('Telegram agent admin can mint a one-use group approval link through the API', async () => {
  const env = baseEnv();
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = await managedAccountAddressForTelegramUser(env, '42');

  const adminResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/group-approval-link', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        sessionSlug: 'alpha',
      },
    }),
    env,
  });
  const adminBody = await jsonBody(adminResponse);
  const payload = new URL(adminBody.url).searchParams.get('startgroup');
  const actionRecord = JSON.parse(await env.AGENT_ACTION_KV.get(`telegram:action:${payload}`));
  const nonAdminResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/group-approval-link', {
      method: 'POST',
      body: {
        telegramUserId: '43',
        sessionSlug: 'alpha',
      },
    }),
    env,
  });
  const nonAdmin = await jsonBody(nonAdminResponse);

  assert.equal(adminResponse.status, 200);
  assert.equal(adminBody.ok, true);
  assert.equal(adminBody.sessionSlug, 'alpha');
  assert.match(adminBody.url, /^https:\/\/t\.me\/ce_demo_bot\?startgroup=cetg_[a-z0-9]{10,58}$/);
  assert.equal(payload.length <= 64, true);
  assert.equal(actionRecord.serverContextRef.sessionSlug, 'alpha');
  assert.equal(actionRecord.serverContextRef.approvedByTelegramUserId, '42');
  assert.equal(nonAdminResponse.status, 403);
  assert.equal(nonAdmin.reason, 'group_approval_admin_required');
});

test('Telegram agent group approval links require an explicit delegated admin scope', async () => {
  const env = baseEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: '' });
  const adminAddress = await managedAccountAddressForTelegramUser(env, '42');
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = adminAddress;
  const defaultToken = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'admin',
    sessionSlug: 'alpha',
    accountAddress: adminAddress,
    createdAt: '2026-12-01T12:00:00.000Z',
  });
  const scopedToken = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'admin',
    sessionSlug: 'alpha',
    accountAddress: adminAddress,
    scopes: [
      ...TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_SCOPES,
      TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.MANAGE_GROUP_APPROVALS,
    ],
    createdAt: '2026-12-01T12:01:00.000Z',
  });

  const deniedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/group-approval-link?sessionSlug=alpha', {
      method: 'POST',
      token: defaultToken.token,
    }),
    env,
  });
  const denied = await jsonBody(deniedResponse);
  const allowedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/group-approval-link?sessionSlug=alpha', {
      method: 'POST',
      token: scopedToken.token,
    }),
    env,
  });
  const allowed = await jsonBody(allowedResponse);
  await env.AGENT_ACTION_KV.put('telegram:group-approval:alpha:-100123', JSON.stringify({
    version: 1,
    type: 'telegram_group_approval',
    sessionSlug: 'alpha',
    sessionName: 'Alpha Session',
    chatId: '-100123',
    approvedByTelegramUserId: '42',
    approvedByAccountAddress: adminAddress.toLowerCase(),
    approvalTokenId: 'scope-test',
  }));
  const revokeDeniedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/group-approval-revoke?sessionSlug=alpha&chatId=-100123', {
      method: 'POST',
      token: defaultToken.token,
    }),
    env,
  });
  const revokeDenied = await jsonBody(revokeDeniedResponse);
  const revokeAllowedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/group-approval-revoke?sessionSlug=alpha&chatId=-100123', {
      method: 'POST',
      token: scopedToken.token,
    }),
    env,
  });
  const revokeAllowed = await jsonBody(revokeAllowedResponse);

  assert.equal(deniedResponse.status, 403);
  assert.equal(denied.reason, 'agent_token_scope_denied');
  assert.equal(denied.requiredScope, 'manage_group_approvals');
  assert.equal(allowedResponse.status, 200);
  assert.equal(allowed.ok, true);
  assert.match(allowed.url, /^https:\/\/t\.me\/ce_demo_bot\?startgroup=cetg_[a-z0-9]{10,58}$/);
  assert.equal(revokeDeniedResponse.status, 403);
  assert.equal(revokeDenied.reason, 'agent_token_scope_denied');
  assert.equal(revokeDenied.requiredScope, 'manage_group_approvals');
  assert.equal(revokeAllowedResponse.status, 200);
  assert.equal(revokeAllowed.revoked, true);
});

test('Telegram agent admin can revoke group approval through the API', async () => {
  const env = baseEnv();
  const adminAddress = await managedAccountAddressForTelegramUser(env, '42');
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = adminAddress;
  await env.AGENT_ACTION_KV.put('telegram:group-approval:alpha:-100123', JSON.stringify({
    version: 1,
    type: 'telegram_group_approval',
    sessionSlug: 'alpha',
    sessionName: 'Alpha Session',
    chatId: '-100123',
    chatTitle: 'Alpha Lobby',
    approvedAt: '2026-12-01T12:00:00.000Z',
    approvedByTelegramUserId: '42',
    approvedByAccountAddress: adminAddress.toLowerCase(),
    approvalTokenId: 'admin_launch',
  }));

  const revokedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/group-approval-revoke', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        sessionSlug: 'alpha',
        chatId: '-100123',
      },
    }),
    env,
  });
  const revoked = await jsonBody(revokedResponse);
  const nonAdminResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/group-approval-revoke', {
      method: 'POST',
      body: {
        telegramUserId: '43',
        sessionSlug: 'alpha',
        chatId: '-100123',
      },
    }),
    env,
  });
  const nonAdmin = await jsonBody(nonAdminResponse);

  assert.equal(revokedResponse.status, 200);
  assert.equal(revoked.ok, true);
  assert.equal(revoked.revoked, true);
  assert.equal(revoked.sessionSlug, 'alpha');
  assert.equal(revoked.chatId, '-100123');
  assert.equal(await env.AGENT_ACTION_KV.get('telegram:group-approval:alpha:-100123'), null);
  assert.equal(nonAdminResponse.status, 403);
  assert.equal(nonAdmin.reason, 'group_approval_admin_required');
});

test('Telegram admin metrics report scoped KV aggregate counts and cache snapshots', async () => {
  const env = baseEnv({
    DEFAULT_RPC_URL: '',
    ADDITIONAL_RPC_URL: '',
  });
  const rootAdminAddress = await managedAccountAddressForTelegramUser(env, '42');
  const betaAdminAddress = await managedAccountAddressForTelegramUser(env, '44');
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = rootAdminAddress;
  env.AGENT_BRIDGE_SESSION_POLICY_JSON = JSON.stringify({
    defaultSessionSlug: 'alpha',
    riskCeiling: 'submit',
    sessions: [
      {
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true,
        telegramGroupOpenAccess: true,
        managedAccountSubmitAllowed: true,
      },
      {
        sessionSlug: 'beta',
        sessionName: 'Beta Session',
        telegramBridgeEnabled: true,
        telegramGroupOpenAccess: true,
        managedAccountSubmitAllowed: true,
        responseExportAllowedAddresses: [betaAdminAddress],
      },
    ],
  });
  await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'alpha_admin',
    sessionSlug: 'alpha',
    accountAddress: rootAdminAddress,
    createdAt: '2026-05-08T12:00:00.000Z',
  });
  await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '43',
    username: 'beta_user',
    sessionSlug: 'beta',
    accountAddress: `0x${'34'.repeat(20)}`,
    createdAt: '2026-05-08T12:00:00.000Z',
  });
  await env.AGENT_ACTION_KV.put('telegram:proposed-question:alpha:q1', JSON.stringify({
    sessionSlug: 'alpha',
    questionId: 'q1',
  }));
  await env.AGENT_ACTION_KV.put('telegram:proposed-question:beta:q2', JSON.stringify({
    sessionSlug: 'beta',
    questionId: 'q2',
  }));
  await env.AGENT_ACTION_KV.put('telegram:answer-draft:42:alpha:q1', JSON.stringify({
    sessionSlug: 'alpha',
    telegramUserId: '42',
  }));
  await env.AGENT_ACTION_KV.put('telegram:answer-draft:43:beta:q2', JSON.stringify({
    sessionSlug: 'beta',
    telegramUserId: '43',
  }));
  await env.AGENT_ACTION_KV.put('telegram:lightweight-group-proposal:beta:g1', JSON.stringify({
    sessionSlug: 'beta',
    proposedBy: '43',
  }));
  await persistTelegramSubmitRecord({
    env,
    record: {
      requestId: 'submit-alpha-ok',
      sessionSlug: 'alpha',
      telegramUserId: '42',
      questionId: 'q1',
      status: 'direct_submitted',
    },
  });
  await persistTelegramSubmitRecord({
    env,
    record: {
      requestId: 'submit-alpha-failed',
      sessionSlug: 'alpha',
      telegramUserId: '42',
      questionId: 'q-failed',
      status: 'submit_failed',
    },
  });
  await persistTelegramSubmitRecord({
    env,
    record: {
      requestId: 'submit-beta-ok',
      sessionSlug: 'beta',
      telegramUserId: '43',
      questionId: 'q2',
      status: 'submit_queued',
    },
  });

  env.AGENT_ACTION_KV.resetGetCalls();
  const rootResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/metrics?sessionSlug=alpha&telegramUserId=42'),
    env,
  });
  const root = await jsonBody(rootResponse);
  const submitRecordGetsAfterRoot = env.AGENT_ACTION_KV.getKeys
    .filter((key) => String(key).startsWith('telegram:submit-request'));
  const listCallsAfterRoot = env.AGENT_ACTION_KV.listCalls;
  const cachedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/metrics?sessionSlug=alpha&telegramUserId=42'),
    env,
  });
  const cached = await jsonBody(cachedResponse);
  const listCallsAfterCachedRoot = env.AGENT_ACTION_KV.listCalls;
  const betaResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/metrics?sessionSlug=beta&telegramUserId=44'),
    env,
  });
  const beta = await jsonBody(betaResponse);
  const deniedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/metrics?sessionSlug=alpha&telegramUserId=45'),
    env,
  });
  const denied = await jsonBody(deniedResponse);

  assert.equal(rootResponse.status, 200);
  assert.equal(root.scope, 'global');
  assert.equal(root.cached, false);
  assert.equal(root.totals.agentsOnboarded, 2);
  assert.equal(root.totals.distinctUsersOnboarded, 2);
  assert.equal(root.totals.questionsCreated, 2);
  assert.equal(root.totals.answerDrafts, 2);
  assert.equal(root.totals.groupProposals, 1);
  assert.equal(root.totals.questionsAnswered, 2);
  assert.equal(root.totals.distinctRespondents, 2);
  assert.equal(root.totals.sessionsWithBridgeActivity, 2);
  assert.deepEqual(submitRecordGetsAfterRoot, []);
  assert.equal(root.definitions.agentsOnboarded.includes('skill installs'), true);
  assert.equal(root.perSession.find((entry) => entry.sessionSlug === 'alpha').questionsAnswered, 1);
  assert.equal(root.perSession.find((entry) => entry.sessionSlug === 'beta').groupProposals, 1);
  assert.equal(cachedResponse.status, 200);
  assert.equal(cached.cached, true);
  assert.equal(listCallsAfterCachedRoot, listCallsAfterRoot);
  assert.equal(betaResponse.status, 200);
  assert.equal(beta.scope, 'session');
  assert.equal(beta.sessionSlug, 'beta');
  assert.equal(beta.totals.agentsOnboarded, 1);
  assert.equal(beta.totals.questionsCreated, 1);
  assert.equal(beta.totals.questionsAnswered, 1);
  assert.equal(Object.hasOwn(beta, 'perSession'), false);
  assert.equal(deniedResponse.status, 403);
  assert.equal(denied.reason, 'metrics_admin_required');
  assert.equal(JSON.stringify(root).includes('ceagt_'), false);
});

test('Telegram admin metrics falls back to legacy submit record bodies without metadata', async () => {
  const env = baseEnv({
    DEFAULT_RPC_URL: '',
    ADDITIONAL_RPC_URL: '',
  });
  const adminAddress = await managedAccountAddressForTelegramUser(env, '42');
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = adminAddress;
  await env.AGENT_ACTION_KV.put('telegram:submit-request:legacy-alpha-ok', JSON.stringify({
    requestId: 'legacy-alpha-ok',
    sessionSlug: 'alpha',
    telegramUserId: '77',
    questionId: 'q-legacy',
    status: 'direct_submitted',
  }));

  env.AGENT_ACTION_KV.resetGetCalls();
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/metrics?sessionSlug=alpha&telegramUserId=42'),
    env,
  });
  const body = await jsonBody(response);
  const submitRecordGets = env.AGENT_ACTION_KV.getKeys
    .filter((key) => String(key).startsWith('telegram:submit-request'));

  assert.equal(response.status, 200);
  assert.equal(body.totals.questionsAnswered, 1);
  assert.equal(body.totals.distinctRespondents, 1);
  assert.equal(body.perSession.find((entry) => entry.sessionSlug === 'alpha').questionsAnswered, 1);
  assert.deepEqual(submitRecordGets, ['telegram:submit-request:legacy-alpha-ok']);
});

test('Telegram admin metrics counts more than one KV page of submit metadata without per-record gets', async () => {
  const env = baseEnv({
    DEFAULT_RPC_URL: '',
    ADDITIONAL_RPC_URL: '',
  });
  const adminAddress = await managedAccountAddressForTelegramUser(env, '42');
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = adminAddress;
  for (let index = 0; index < 1005; index += 1) {
    await persistTelegramSubmitRecord({
      env,
      record: {
        requestId: `submit-alpha-${index}`,
        sessionSlug: 'alpha',
        telegramUserId: `user-${index % 25}`,
        questionId: `q-${index}`,
        status: 'direct_submitted',
        createdAt: `2026-05-23T12:${String(index % 60).padStart(2, '0')}:00.000Z`,
      },
    });
  }

  env.AGENT_ACTION_KV.resetGetCalls();
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/metrics?sessionSlug=alpha&telegramUserId=42'),
    env,
  });
  const body = await jsonBody(response);
  const submitRecordGets = env.AGENT_ACTION_KV.getKeys
    .filter((key) => String(key).startsWith('telegram:submit-request'));

  assert.equal(response.status, 200);
  assert.equal(body.totals.questionsAnswered, 1005);
  assert.equal(body.totals.distinctRespondents, 25);
  assert.deepEqual(submitRecordGets, []);
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

test('Telegram admin ceagt token can plan and apply sponsored questions after approval', async () => {
  const env = baseEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: '' });
  const adminAddress = await managedAccountAddressForTelegramUser(env, '42');
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = adminAddress;
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'admin',
    sessionSlug: 'alpha',
    accountAddress: adminAddress,
    createdAt: '2026-12-01T12:00:00.000Z',
  });

  const statusResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/status?sessionSlug=alpha', {
      token: issued.token,
    }),
    env,
  });
  const status = await jsonBody(statusResponse);
  const planRequestBody = {
    sessionSlug: 'alpha',
    references: ['fund proposal'],
    instruction: 'Create a question about edge city outcomes and make it sponsored.',
    createQuestions: [{
      prompt: 'Should Alpha prioritize participant follow-up after Agent Village?',
      questionType: 'binary',
    }],
  };
  const planResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-queue/plan', {
      method: 'POST',
      token: issued.token,
      body: planRequestBody,
    }),
    env,
  });
  const plan = await jsonBody(planResponse);
  const unapprovedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-queue/apply', {
      method: 'POST',
      token: issued.token,
      body: planRequestBody,
    }),
    env,
  });
  const unapproved = await jsonBody(unapprovedResponse);
  const applyResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-queue/apply', {
      method: 'POST',
      token: issued.token,
      body: {
        ...planRequestBody,
        approvalText: 'Approved, make these sponsored questions.',
      },
    }),
    env,
  });
  const applied = await jsonBody(applyResponse);
  const nextResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions/next?sessionSlug=alpha&queueKey=admin-ceagt-smoke&resetQueue=true', {
      method: 'POST',
      token: issued.token,
    }),
    env,
  });
  const next = await jsonBody(nextResponse);

  assert.equal(statusResponse.status, 200);
  assert.equal(status.admin, true);
  assert.equal(status.capabilities.canManageSponsoredQuestions, true);
  assert.equal(planResponse.status, 200);
  assert.equal(plan.requiresConfirmation, true);
  assert.equal(plan.resolvedExistingQuestions[0].question.questionId, 'q-binary');
  assert.equal(plan.draftQuestions.length, 2);
  assert.match(plan.draftQuestions[0].prompt, /participant follow-up/i);
  assert.match(plan.draftQuestions[1].prompt, /edge city outcomes/i);
  assert.equal(unapprovedResponse.status, 400);
  assert.equal(unapproved.reason, 'sponsored_question_confirmation_required');
  assert.equal(applyResponse.status, 200);
  assert.equal(applied.questionQueue.sponsoredQuestionIds[0], 'q-binary');
  assert.equal(applied.createdQuestions.length, 2);
  assert.equal(applied.questionQueue.sponsoredQuestionIds.length, 3);
  assert.equal(nextResponse.status, 200);
  assert.equal(next.question.questionId, 'q-binary');
  assert.equal(next.sponsored, true);
});

test('Telegram sponsored question planning rejects non-admin ceagt tokens', async () => {
  const env = baseEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: '' });
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = `0x${'ab'.repeat(20)}`;
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-12-01T12:00:00.000Z',
  });
  const statusResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/status?sessionSlug=alpha', {
      token: issued.token,
    }),
    env,
  });
  const status = await jsonBody(statusResponse);
  const planResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-queue/plan', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        references: ['funding'],
      },
    }),
    env,
  });
  const plan = await jsonBody(planResponse);

  assert.equal(statusResponse.status, 200);
  assert.equal(status.admin, false);
  assert.equal(status.capabilities.canManageSponsoredQuestions, false);
  assert.equal(planResponse.status, 403);
  assert.equal(plan.reason, 'response_export_admin_required');
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
  assert.equal(Array.from(env.AGENT_ACTION_KV.metadata.entries()).some(([key, metadata]) => (
    key.startsWith('telegram:proposed-question:alpha:') &&
    metadata.t === 'proposed_question' &&
    metadata.u === '42'
  )), true);
});

test('Telegram agent can batch-create sourced proposed questions without posing them', async () => {
  const env = baseEnv();
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const sourceUrl = 'https://example.com/agent-village/report?view=public';

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions/create', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        sourceUrl,
        questions: [
          {
            prompt: 'Should Agent Village organizers publish a daily recap?',
            questionType: 'binary',
            tags: ['event'],
          },
          {
            prompt: 'Should the demo prioritize organizer feedback?',
            questionType: 'binary',
            geoId: 'edge-organizer-hall',
            geoKind: 'venue',
            geoLabel: 'Organizer Hall',
          },
          {
            prompt: 'Which topics need a follow-up discussion?',
            questionType: 'multichoice',
            options: ['onboarding', 'results', 'groups'],
            references: [{ type: 'url', url: 'https://example.com/followup', title: 'Follow-up note' }],
          },
        ],
      },
    }),
    env,
  });
  const body = await jsonBody(response);
  const proposedRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => key.startsWith('telegram:proposed-question:alpha:'))
    .map(([, value]) => JSON.parse(value));
  const questionsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123'),
    env,
  });
  const questions = await jsonBody(questionsResponse);
  const geoResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        preferences: { geoIds: ['edge-organizer-hall'] },
      },
    }),
    env,
  });
  const geoRanked = await jsonBody(geoResponse);
  const sourcedQuestion = questions.questions.find((question) => (
    question.prompt === 'Should Agent Village organizers publish a daily recap?'
  ));
  const geoQuestion = questions.questions.find((question) => (
    question.prompt === 'Should the demo prioritize organizer feedback?'
  ));
  const emptyResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions/create', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        questions: [],
      },
    }),
    env,
  });
  const oversizedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions/create', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        questions: Array.from({ length: 21 }, (_, index) => ({
          prompt: `Batch question ${index + 1}?`,
        })),
      },
    }),
    env,
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.created.length, 3);
  assert.equal(body.skipped.length, 0);
  assert.equal(body.created[0].references[0].url, sourceUrl);
  assert.equal(body.created[0].tags.includes('src:example-com'), true);
  assert.deepEqual(body.created[1].geoRefs, [{ geoId: 'edge-organizer-hall', kind: 'venue', label: 'Organizer Hall' }]);
  assert.equal(body.created[1].tags.includes('geo:edge-organizer-hall'), true);
  assert.equal(proposedRecords.length, 3);
  assert.equal(proposedRecords.every((record) => record.status === 'active'), true);
  assert.equal(proposedRecords.every((record) => record.sponsored !== true), true);
  assert.equal(proposedRecords.every((record) => record.actionMetadata.endpoint === '/telegram/agent/api/questions/create'), true);
  assert.equal(proposedRecords[0].references[0].url, sourceUrl);
  assert.equal(sourcedQuestion.references[0].url, sourceUrl);
  assert.equal(sourcedQuestion.tags.includes('src:example-com'), true);
  assert.deepEqual(geoQuestion.geoRefs, [{ geoId: 'edge-organizer-hall', kind: 'venue', label: 'Organizer Hall' }]);
  assert.equal(geoResponse.status, 200);
  assert.equal(geoRanked.questions[0].questionId, geoQuestion.questionId);
  assert.equal(JSON.stringify(body).includes('ceagt_'), false);
  assert.equal(emptyResponse.status, 400);
  assert.equal((await jsonBody(emptyResponse)).reason, 'questions_create_batch_required');
  assert.equal(oversizedResponse.status, 400);
  assert.equal((await jsonBody(oversizedResponse)).reason, 'questions_create_batch_too_large');
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
  assert.equal(Array.from(env.AGENT_ACTION_KV.metadata.entries()).some(([key, metadata]) => (
    key.startsWith('telegram:lightweight-group-proposal:alpha:') &&
    metadata.t === 'group_proposal' &&
    metadata.u === '42'
  )), true);

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
