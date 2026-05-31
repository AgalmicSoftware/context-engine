import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';
import {
  handleTelegramAgentHandoffRequest,
  __test__telegramAgentHandoff,
} from './telegramAgentHandoff.mjs';
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
  writeTelegramAgentDelegationTokenUserPointer,
} from './telegramAgentDelegationTokens.mjs';
import { deriveTelegramResponseExportAccount } from './telegramResponseExport.mjs';
import { persistTelegramSubmitRecord } from './telegramSubmitQueue.mjs';

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

function multiTelegramOnlyEnv({
  defaultSessionSlug = 'alpha',
  sessions = ['alpha', 'beta', 'gamma'],
  overrides = {},
} = {}) {
  return telegramOnlyEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug,
      riskCeiling: 'submit',
      sessions: sessions.map((sessionSlug) => ({
        sessionSlug,
        sessionName: `${sessionSlug[0].toUpperCase()}${sessionSlug.slice(1)} Session`,
        default: sessionSlug === defaultSessionSlug,
        telegramBridgeEnabled: true,
        telegramOnly: true,
        telegramGroupOpenAccess: true,
        managedAccountSubmitAllowed: true,
      })),
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

function sha256Hex(value = '') {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

async function jsonBody(response) {
  return response.json();
}

async function putSubmittedResult(env, {
  key = '',
  sessionSlug = 'alpha',
  telegramUserId = '42',
  questionId = 'q-binary',
  label = 'Agree',
  value = '',
  comments = '',
  createdAt = '2026-05-08T12:00:00.000Z',
} = {}) {
  await env.AGENT_ACTION_KV.put(key || `telegram:submit-request:${sessionSlug}:${telegramUserId}:${questionId}:${createdAt}`, JSON.stringify({
    status: 'direct_submitted',
    sessionSlug,
    telegramUserId,
    questionId,
    answer: {
      label,
      value: value || String(label).toLowerCase(),
      comments,
    },
    createdAt,
  }));
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
  assert.match(source, /\*\*Skill version:\*\* 2026-05-30 \(v26\)/);
  assert.match(source, /direct-answer first/);
  assert.match(source, /GET \/telegram\/agent\/api\/skill-version/);
  assert.match(source, /cache or install this Markdown skill locally/);
  assert.match(source, /not a callable tool name/);
  assert.match(source, /## Changelog/);
  assert.match(source, /demographicLinkOptIn/);
  assert.match(source, /attendanceLinkOptIn/);
  assert.match(source, /Attended\s+Previous Edge Events/);
  assert.match(source, /draftDivergenceOptIn/);
  assert.match(source, /topicPreferences/);
  assert.match(source, /Interactive Client Report/);
  assert.match(source, /\/session\/<session-slug>\/questions\/results\?telegramToken=/);
  assert.match(source, /client-login\/exchange/);
  assert.match(source, /POST \/telegram\/agent\/api\/preferences/);
  assert.match(source, /Non-Telegram Agent Token Flow/);
  assert.match(source, /Install From Public Git/);
  assert.match(source, /raw\.githubusercontent\.com\/AgalmicSoftware\/context-engine/);
  assert.match(source, /CE_SKILL_REF/);
  assert.ok(source.includes('${CODEX_HOME:-$HOME/.codex}/skills/ce-telegram-agent-handoff'));
  assert.match(source, /default token expiry is 28 days/i);
  assert.match(source, /Authorization: Bearer ceagt_/);
  assert.match(source, /Do not ask for `telegramUserId` or `groupChatId`/);
  assert.match(source, /Send it on every CE\s+request as `Authorization: Bearer <token>`/);
  assert.match(source, /Never make an unauthenticated\s+question, draft, answer, vote, or results request/);
  assert.match(source, /do not run the full Edge-agent onboarding flow/);
  assert.match(source, /Context Engine is\s+ready; I am fetching/);
  assert.match(source, /Present Questions To Humans/);
  assert.match(source, /Do not lead with raw labels like\s+`Question \(binary, proposed\)`/);
  assert.match(source, /immediately surface\s+the first or most relevant one/);
  assert.match(source, /do not ask whether to fetch questions, fetch\s+the skill endpoint, or "do anything else" first/);
  assert.match(source, /Want me to do anything with this\?/);
  assert.match(source, /How would you like to answer\?/);
  assert.match(source, /Answer options: Agree \/ Unsure \/ Disagree/);
  assert.match(source, /refresh_user_agent_token/);
  assert.match(source, /POST \/telegram\/agent\/api\/questions\/next/);
  assert.match(source, /POST \/telegram\/agent\/api\/question-queue/);
  assert.match(source, /GET \/telegram\/agent\/api\/admin\/status/);
  assert.match(source, /GET \/telegram\/agent\/api\/results\?sessionSlug=<slug>&view=topic-map/);
  assert.match(source, /GET \/telegram\/agent\/api\/results\?sessionSlug=<slug>&view=groups/);
  assert.match(source, /GET \/telegram\/agent\/api\/results-image\?sessionSlug=<slug>&view=topic-map/);
  assert.match(source, /POST \/telegram\/agent\/api\/mini-app-launch/);
  assert.match(source, /POST \/telegram\/agent\/api\/question-queue\/plan/);
  assert.match(source, /POST \/telegram\/agent\/api\/question-queue\/apply/);
  assert.match(source, /\/question_queue 1 3 4/);
  assert.match(source, /allowedProfileFields/);
  assert.match(source, /skillUpdateAvailable/);
  assert.match(source, /questionsPerBatch/);
  assert.match(source, /never repeat, summarize, echo, log/);
  assert.match(source, /submit: true/);
  assert.match(source, /humanApproved: true/);
  assert.match(source, /digestTimeOfDay/);
  assert.match(source, /auto-fill[\s\S]*aggregate buckets/);
  assert.match(source, /Copied-Token First Run/);
  assert.match(source, /Claude Code, OpenClaw, Hermes/);
});

test('Telegram agent handoff skill version constant matches SKILL.md header', () => {
  const source = readFileSync(
    new URL('./skills/ce-telegram-agent-handoff/SKILL.md', import.meta.url),
    'utf8',
  );
  const match = source.match(/^\*\*Skill version:\*\*\s*(.+)$/m);
  assert.ok(match);
  assert.equal(match[1], __test__telegramAgentHandoff.CE_TELEGRAM_AGENT_HANDOFF_SKILL_VERSION);
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
  assert.equal(body.version, '2026-05-30 (v26)');
  assert.equal(body.skill, 'ce-telegram-agent-handoff');
  assert.equal(body.skillUrl, 'https://example.test/skills/ce-telegram-agent-handoff/SKILL.md');
  assert.equal(body.changelogUrl, 'https://example.test/skills/ce-telegram-agent-handoff/SKILL.md#changelog');
  assert.equal(body.updateAvailable, false);
  assert.equal(body.latestVersion, '2026-05-30 (v26)');
  assert.equal(body.updateNote, '');
});

test('Telegram agent handoff serves a short skill redirect', async () => {
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/skill?v=19', { token: '' }),
    env: baseEnv(),
  });

  assert.equal(response.status, 302);
  const location = response.headers.get('location') || '';
  assert.match(location, /^https:\/\/raw\.githubusercontent\.com\/AgalmicSoftware\/context-engine\/[0-9a-f]{40}\/workers\/agentBridgeWorker\/skills\/ce-telegram-agent-handoff\/SKILL\.md/);
  assert.match(location, /v=2026-05-30-v26-/);
});

test('Telegram agent handoff wraps unexpected throws as JSON errors', async () => {
  const response = await handleTelegramAgentHandoffRequest({});
  const body = await jsonBody(response);

  assert.equal(response.status, 500);
  assert.deepEqual(body, { ok: false, reason: 'telegram_agent_internal_error' });
});

test('Telegram agent skill-version payload includes admin update flag', async () => {
  const env = baseEnv();
  await env.AGENT_ACTION_KV.put('telegram:agent-skill-update:v1', JSON.stringify({
    version: 1,
    updateAvailable: true,
    latestVersion: '2026-05-30 (v26)',
    note: 'Refresh before answering.',
    updatedAt: '2026-05-30T00:00:00.000Z',
  }));

  const payload = await __test__telegramAgentHandoff.skillVersionPayloadWithFlag(env);
  assert.equal(payload.updateAvailable, true);
  assert.equal(payload.latestVersion, '2026-05-30 (v26)');
  assert.equal(payload.updateNote, 'Refresh before answering.');
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
  assert.equal(mismatchResponse.status, 404);
  assert.match(mismatch.reason, /session_not_(found|linked)/);

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
  assert.equal(expiredBody.action, 'refresh_user_agent_token');
  assert.equal(expiredBody.telegramCommand, '/start');
  assert.equal(expiredBody.telegramButton, 'Onboard Agent');
  assert.match(expiredBody.message, /trusted Geo\/Hermes invite/i);
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
  assert.equal(missingTokenBody.action, 'refresh_user_agent_token');
});

test('Telegram agent token follows a follow-default private binding across default flips', async () => {
  const env = multiTelegramOnlyEnv({ defaultSessionSlug: 'alpha', overrides: { AGENT_BRIDGE_AGENT_API_TOKEN: '' } });
  await env.AGENT_ACTION_KV.put('telegram:private-session:42', JSON.stringify({
    version: 1,
    telegramUserId: '42',
    sessionSlug: 'alpha',
    followDefault: true,
    selectedAt: '2026-05-08T12:00:00.000Z',
  }));
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  const alphaResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', { token: issued.token }),
    env,
  });
  assert.equal((await jsonBody(alphaResponse)).sessionSlug, 'alpha');

  env.AGENT_BRIDGE_SESSION_POLICY_JSON = multiTelegramOnlyEnv({ defaultSessionSlug: 'beta' }).AGENT_BRIDGE_SESSION_POLICY_JSON;
  const betaResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', { token: issued.token }),
    env,
  });
  assert.equal((await jsonBody(betaResponse)).sessionSlug, 'beta');
});

test('Telegram agent token preserves pinned bindings across default flips', async () => {
  const env = multiTelegramOnlyEnv({ defaultSessionSlug: 'alpha', overrides: { AGENT_BRIDGE_AGENT_API_TOKEN: '' } });
  await env.AGENT_ACTION_KV.put('telegram:private-session:42', JSON.stringify({
    version: 1,
    telegramUserId: '42',
    sessionSlug: 'gamma',
    followDefault: false,
    selectedAt: '2026-05-08T12:00:00.000Z',
  }));
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  env.AGENT_BRIDGE_SESSION_POLICY_JSON = multiTelegramOnlyEnv({ defaultSessionSlug: 'beta' }).AGENT_BRIDGE_SESSION_POLICY_JSON;
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', { token: issued.token }),
    env,
  });
  assert.equal((await jsonBody(response)).sessionSlug, 'gamma');
});

test('Telegram agent request with existing sessionSlug switches and pins the user', async () => {
  const env = multiTelegramOnlyEnv({ defaultSessionSlug: 'alpha', overrides: { AGENT_BRIDGE_AGENT_API_TOKEN: '' } });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  const switched = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=gamma', { token: issued.token }),
    env,
  });
  assert.equal((await jsonBody(switched)).sessionSlug, 'gamma');
  const binding = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:private-session:42'));
  assert.equal(binding.sessionSlug, 'gamma');
  assert.equal(binding.followDefault, false);
  assert.equal(binding.source, 'telegram_agent_delegation_token');

  env.AGENT_BRIDGE_SESSION_POLICY_JSON = multiTelegramOnlyEnv({ defaultSessionSlug: 'beta' }).AGENT_BRIDGE_SESSION_POLICY_JSON;
  const omitted = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', { token: issued.token }),
    env,
  });
  assert.equal((await jsonBody(omitted)).sessionSlug, 'gamma');
});

test('Telegram agent treats legacy private bindings without followDefault as pinned', async () => {
  const env = multiTelegramOnlyEnv({ defaultSessionSlug: 'alpha', overrides: { AGENT_BRIDGE_AGENT_API_TOKEN: '' } });
  await env.AGENT_ACTION_KV.put('telegram:private-session:42', JSON.stringify({
    version: 1,
    telegramUserId: '42',
    sessionSlug: 'beta',
    selectedAt: '2026-05-08T12:00:00.000Z',
  }));
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', { token: issued.token }),
    env,
  });
  assert.equal((await jsonBody(response)).sessionSlug, 'beta');
});

test('Telegram agent onboarding returns consent questions and persists first-run answers', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: '' });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
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
  assert.equal(first.questions.length, 6);
  assert.equal(
    first.questions.find((question) => question.id === 'preference_tailoring')?.prompt,
    'Can I pass preferences and calendar info to CE to surface relevant questions?'
  );
  assert.equal(
    first.questions.find((question) => question.id === 'demographic_link_opt_in')?.prompt,
    'Can I link non-identifying information (demographics, attendance week) to your responses for research purposes?'
  );
  assert.equal(first.answers.preference_tailoring, false);
  assert.equal(first.answers.demographic_link_opt_in, false);
  assert.equal(first.answers.attendance_context_opt_in, false);
  assert.equal(first.answers.draft_divergence_research, false);
  assert.equal(first.settings.agentAutoApplyQuestionVotes, false);
  assert.equal(first.settings.dailyDigestOptIn, false);
  assert.equal(first.settings.digestTimeOfDay, 'morning');
  assert.equal(first.settings.attendanceLinkOptIn, false);
  assert.equal(first.groupFollowUpQuestions, undefined);
  assert.deepEqual(first.settings.topicPreferences, []);

  const saveResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/onboarding', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        createdAt: '2026-05-08T12:05:00.000Z',
        topicPreferences: ['AI Futures', 'Governance'],
        digestTimeOfDay: 'night',
        answers: {
          preference_tailoring: true,
          demographic_link_opt_in: true,
          draft_responses: true,
          draft_divergence_research: true,
          auto_apply_question_votes: true,
          edge_daily_digest: true,
        },
        groups: {
          selections: {
            events_attended: ['week_1', 'attended_previous_edge_events'],
            region: ['north_america'],
            contribution_role: ['community_host'],
          },
          details: {
            contribution_role: { other: 'community research' },
          },
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
  assert.equal(saved.answers.demographics_research, true);
  assert.equal(saved.answers.demographic_link_opt_in, true);
  assert.equal(saved.answers.attendance_context_opt_in, true);
  assert.equal(saved.answers.draft_divergence_research, true);
  assert.equal(saved.answers.auto_apply_question_votes, true);
  assert.deepEqual(saved.settings.topicPreferences, ['ai-futures', 'governance']);
  assert.equal(saved.settings.allowedProfileFields.includes('interests'), true);
  assert.equal(saved.settings.allowedProfileFields.includes('edge_bio_keywords'), true);
  assert.equal(saved.settings.allowedProfileFields.includes('age_bucket'), true);
  assert.equal(saved.settings.allowedProfileFields.includes('country'), true);
  assert.equal(saved.settings.allowedProfileFields.includes('edge_attendance'), true);
  assert.equal(saved.settings.allowedProfileFields.includes('roles'), true);
  assert.equal(saved.settings.allowedUses.includes('rank_questions'), true);
  assert.equal(saved.settings.allowedUses.includes('link_demographics_research'), true);
  assert.equal(saved.settings.allowedUses.includes('link_attendance_context'), true);
  assert.equal(saved.settings.allowedUses.includes('draft_answers'), true);
  assert.equal(saved.settings.allowedUses.includes('research_draft_divergence'), true);
  assert.equal(saved.settings.demographicLinkOptIn, true);
  assert.equal(saved.settings.attendanceLinkOptIn, true);
  assert.equal(saved.settings.draftDivergenceOptIn, true);
  assert.equal(saved.settings.agentAutoApplyQuestionVotes, true);
  assert.equal(saved.settings.dailyDigestOptIn, true);
  assert.equal(saved.settings.digestTimeOfDay, 'night');
  assert.deepEqual(saved.groups.selections.events_attended, ['week_1', 'attended_previous_edge_events']);
  assert.deepEqual(saved.groups.selections.region, ['north_america']);
  const membership = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:lightweight-group-membership:alpha:42'));
  assert.deepEqual(membership.selections.events_attended, ['week_1', 'attended_previous_edge_events']);
  assert.deepEqual(membership.selections.region, ['north_america']);

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
  assert.equal(second.answers.demographic_link_opt_in, true);
  assert.equal(second.answers.draft_divergence_research, true);
  assert.equal(second.answers.edge_daily_digest, true);
  assert.equal(second.settings.digestTimeOfDay, 'night');
  assert.deepEqual(second.topicPreferences, ['ai-futures', 'governance']);
  assert.equal(JSON.stringify(second).includes(issued.token), false);
});

test('Telegram agent onboarding infers consented bucket groups from profile context', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: '' });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/onboarding', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        profile: {
          bio: 'Researcher and Edge organizer attending Week 2; attended previous Edge events.',
        },
        answers: {
          preference_tailoring: true,
          demographic_link_opt_in: true,
        },
      },
    }),
    env,
  });
  const body = await jsonBody(response);
  const membership = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:lightweight-group-membership:alpha:42'));

  assert.equal(response.status, 200);
  assert.deepEqual(body.groups.selections.events_attended, ['week_2', 'attended_previous_edge_events']);
  assert.equal(body.groups.selections.contribution_role.includes('researcher'), true);
  assert.equal(body.groups.selections.contribution_role.includes('community_host'), true);
  assert.equal(body.groupFollowUpQuestions, undefined);
  assert.deepEqual(membership.selections.events_attended, ['week_2', 'attended_previous_edge_events']);
  assert.equal(membership.selections.contribution_role.includes('researcher'), true);
  assert.equal(membership.selections.contribution_role.includes('community_host'), true);
});

test('Telegram agent onboarding asks bucket follow-ups when profile lacks consented fields', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: '' });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/onboarding', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        answers: {
          demographic_link_opt_in: true,
        },
      },
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.groups, undefined);
  assert.deepEqual(body.groupFollowUpQuestions.map((question) => question.categoryId), [
    'events_attended',
    'contribution_role',
  ]);
  assert.equal(await env.AGENT_ACTION_KV.get('telegram:lightweight-group-membership:alpha:42'), null);
});

test('Telegram agent onboarding keeps topic and bucket data opt-in', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: '' });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/onboarding', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        topicPreferences: ['AI Futures', 'Governance'],
        answers: {
          preference_tailoring: false,
          demographic_link_opt_in: false,
        },
        groups: {
          selections: {
            events_attended: ['week_1'],
            region: ['north_america'],
          },
        },
      },
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.deepEqual(body.settings.topicPreferences, []);
  assert.equal(body.settings.allowedUses.includes('rank_questions'), false);
  assert.equal(body.groups, undefined);
  assert.equal(await env.AGENT_ACTION_KV.get('telegram:lightweight-group-membership:alpha:42'), null);
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
  const binding = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:private-session:42'));
  assert.equal(binding.sessionSlug, 'alpha');
  assert.equal(binding.followDefault, true);
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

test('Invite onboarding mints a user token from a configured Geo invite', async () => {
  const env = multiTelegramOnlyEnv({
    defaultSessionSlug: 'alpha',
    sessions: ['alpha', 'beta'],
    overrides: {
      AGENT_BRIDGE_AGENT_API_TOKEN: '',
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITES_JSON: JSON.stringify([{
        tokenHash: sha256Hex('geo-invite-secret'),
        sessionSlug: 'beta',
        label: 'Agent Village',
        source: 'geo:agent-village',
      }]),
    },
  });
  const previous = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'old_user',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-05-08T12:00:00.000Z',
  });
  await writeTelegramAgentDelegationTokenUserPointer({
    env,
    telegramUserId: '42',
    tokenHash: previous.tokenHash,
    issuedAt: previous.record.issuedAt,
    createdAt: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/invite/onboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contextEngine: { inviteToken: 'geo-invite-secret' },
        telegramUserId: '42',
        username: 'participant',
      }),
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.worker, 'https://bridge.example');
  assert.equal(body.skill, 'ce-telegram-agent-handoff');
  assert.equal(body.sessionSlug, 'beta');
  assert.equal(body.inviteLabel, 'Agent Village');
  assert.equal(body.inviteSource, 'geo:agent-village');
  assert.match(body.token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.equal(JSON.stringify(body).includes('geo-invite-secret'), false);
  const loaded = await loadTelegramAgentDelegationToken({ env, token: body.token });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.telegramUserId, '42');
  assert.equal(loaded.record.username, '');
  assert.equal(loaded.record.sessionSlug, 'beta');
  assert.equal((await loadTelegramAgentDelegationToken({ env, token: previous.token })).ok, false);
  const binding = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:private-session:42'));
  assert.equal(binding.sessionSlug, 'beta');
  assert.equal(binding.followDefault, false);
  assert.equal(body.onboarding.sessionSlug, 'beta');
  assert.equal(body.onboarding.completed, false);

  const onboardingResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/onboarding', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer <${body.token}>`,
      },
      body: JSON.stringify({
        answers: { preference_tailoring: true },
        topicPreferences: ['agent village'],
      }),
    }),
    env,
  });
  const onboarding = await jsonBody(onboardingResponse);
  assert.equal(onboardingResponse.status, 200);
  assert.equal(onboarding.ok, true);
  assert.equal(onboarding.sessionSlug, 'beta');
  assert.deepEqual(onboarding.settings.topicPreferences, ['agent-village']);
  assert.equal(JSON.stringify(onboarding).includes(body.token), false);
});

test('Invite onboarding rejects random Telegram ids without a valid invite token', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: '',
    AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITE_TOKEN_HASHES: sha256Hex('real-invite'),
  });

  const invalidResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/invite/onboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inviteToken: 'wrong-invite',
        telegramUserId: '123456',
      }),
    }),
    env,
  });
  const invalid = await jsonBody(invalidResponse);

  assert.equal(invalidResponse.status, 401);
  assert.equal(invalid.reason, 'invite_token_invalid');
  assert.equal(Array.from(env.AGENT_ACTION_KV.store.keys()).some((key) => key.includes('agent-delegation-token')), false);

  const missingResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/invite/onboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inviteToken: 'real-invite' }),
    }),
    env,
  });
  const missing = await jsonBody(missingResponse);

  assert.equal(missingResponse.status, 400);
  assert.equal(missing.reason, 'telegram_user_required');
});

test('Invite onboarding ignores plaintext invite token env config', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: '',
    AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITE_TOKENS: 'plaintext-invite',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/invite/onboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inviteToken: 'plaintext-invite',
        telegramUserId: '123456',
      }),
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 503);
  assert.equal(body.reason, 'invite_onboarding_not_configured');
  assert.equal(Array.from(env.AGENT_ACTION_KV.store.keys()).some((key) => key.includes('agent-delegation-token')), false);
});

test('Telegram client login exchanges copied ceagt token for a worker JWT', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_SESSION_WORKER_URL: 'https://session-worker.example',
    AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS: 'https://client.example',
  });
  const accountAddress = await managedAccountAddressForTelegramUser(env, '42');
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'host',
    sessionSlug: 'alpha',
    accountAddress,
    createdAt: '2026-05-08T12:00:00.000Z',
  });
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url: String(url), init });
    if (String(url).endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url).endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-jwt-1', exp: 1780003600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const response = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/client-login/exchange', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://client.example',
      },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        token: `Install info:\nAuthorization: Bearer ${issued.token}`,
      }),
    }),
    env,
    fetchImpl,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://client.example');
  assert.equal(body.ok, true);
  assert.equal(body.tokenType, 'session_worker_jwt');
  assert.equal(body.workerToken, 'worker-jwt-1');
  assert.equal(body.sessionSlug, 'alpha');
  assert.equal(body.accountAddress, accountAddress);
  assert.equal(body.workerUrl, 'https://session-worker.example');
  assert.equal(body.buckets.sessionSlug, 'alpha');
  assert.equal(body.buckets.categories.some((category) => category.categoryId === 'events_attended' && category.label === 'Attendance'), true);
  assert.equal(body.buckets.categories.some((category) => category.categoryId === 'primary_focus'), false);
  assert.equal(JSON.stringify(body).includes(issued.token), false);
  assert.deepEqual(fetchCalls.map((call) => call.url), [
    'https://session-worker.example/auth/nonce',
    'https://session-worker.example/auth/login',
  ]);
});

test('Telegram client login ignores caller-supplied workerUrl', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_SESSION_WORKER_URL: 'https://session-worker.example',
    AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS: 'https://client.example',
  });
  const accountAddress = await managedAccountAddressForTelegramUser(env, '42');
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'host',
    sessionSlug: 'alpha',
    accountAddress,
    createdAt: '2026-05-08T12:00:00.000Z',
  });
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = String(url);
    fetchCalls.push({ url: target, init });
    if (target.startsWith('https://attacker.example')) {
      throw new Error('caller-supplied workerUrl must not be fetched');
    }
    if (target.endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-jwt-1', exp: 1780003600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const response = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/client-login/exchange?workerUrl=https%3A%2F%2Fattacker.example', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://client.example',
      },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        token: issued.token,
        workerUrl: 'https://attacker.example',
      }),
    }),
    env,
    fetchImpl,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.workerUrl, 'https://session-worker.example');
  assert.deepEqual(fetchCalls.map((call) => call.url), [
    'https://session-worker.example/auth/nonce',
    'https://session-worker.example/auth/login',
  ]);
});

test('Telegram client login rejects preview-user and session-mismatched tokens', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_SESSION_WORKER_URL: 'https://session-worker.example',
  });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'host',
    sessionSlug: 'alpha',
    accountAddress: await managedAccountAddressForTelegramUser(env, '42'),
  });

  const previewResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/client-login/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionSlug: 'alpha', token: 'preview-user' }),
    }),
    env,
    fetchImpl: async () => {
      throw new Error('preview-user must not reach worker auth');
    },
  });
  const mismatchResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/client-login/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionSlug: 'beta', token: issued.token }),
    }),
    env,
    fetchImpl: async () => {
      throw new Error('mismatched token must not reach worker auth');
    },
  });

  assert.equal(previewResponse.status, 401);
  assert.equal((await jsonBody(previewResponse)).reason, 'agent_token_missing');
  assert.equal(mismatchResponse.status, 404);
  assert.match((await jsonBody(mismatchResponse)).reason, /session_not_(found|linked)/);
});

test('Telegram result-view cache stores and returns data-version scoped analysis', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: '',
    AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS: 'https://client.example',
  });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'34'.repeat(20)}`,
    createdAt: '2026-12-01T12:00:00.000Z',
  });
  assert.equal(issued.ok, true);

  const missResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/result-view-cache?sessionSlug=alpha&viewType=polis_clusters&dataVersionKey=v1', {
      headers: {
        authorization: `Bearer ${issued.token}`,
        origin: 'https://client.example',
      },
    }),
    env,
  });
  const miss = await jsonBody(missResponse);
  assert.equal(missResponse.status, 200);
  assert.equal(miss.cached, false);
  assert.equal(miss.cacheLayer, 'miss');
  assert.equal(missResponse.headers.get('access-control-allow-origin'), 'https://client.example');

  const saveResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/result-view-cache', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${issued.token}`,
        'content-type': 'application/json',
        origin: 'https://client.example',
      },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        viewType: 'polis_clusters',
        dataVersionKey: 'v1',
        value: {
          clusters: {
            0: {
              name: 'Builders',
              short: 'Builders want more prototypes.',
              long: 'Builders want more prototypes and fewer panels.',
            },
          },
        },
      }),
    }),
    env,
  });
  const saved = await jsonBody(saveResponse);
  assert.equal(saveResponse.status, 200);
  assert.equal(saved.cacheLayer, 'stored');
  assert.equal(saved.value.clusters[0].name, 'Builders');
  assert.equal(JSON.stringify(saved).includes(issued.token), false);

  const hitResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/result-view-cache?sessionSlug=alpha&viewType=polis_clusters&dataVersionKey=v1', {
      headers: {
        authorization: `Bearer ${issued.token}`,
        origin: 'https://client.example',
      },
    }),
    env,
  });
  const hit = await jsonBody(hitResponse);
  assert.equal(hitResponse.status, 200);
  assert.equal(hit.cached, true);
  assert.equal(hit.cacheLayer, 'kv');
  assert.equal(hit.value.clusters[0].long, 'Builders want more prototypes and fewer panels.');

  const circlesSaveResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/result-view-cache', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${issued.token}`,
        'content-type': 'application/json',
        origin: 'https://client.example',
      },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        viewType: 'circles',
        dataVersionKey: 'v1-circles',
        value: {
          summary: { nodes: 12, responses: 48 },
          representativeNodes: [{ id: 'n1', label: 'Protocol design', score: 0.84 }],
        },
      }),
    }),
    env,
  });
  const circlesSaved = await jsonBody(circlesSaveResponse);
  assert.equal(circlesSaveResponse.status, 200);
  assert.equal(circlesSaved.value.summary.nodes, 12);
  assert.equal(circlesSaved.value.representativeNodes[0].label, 'Protocol design');

  const circlesHitResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/result-view-cache?sessionSlug=alpha&viewType=circles&dataVersionKey=v1-circles', {
      headers: {
        authorization: `Bearer ${issued.token}`,
        origin: 'https://client.example',
      },
    }),
    env,
  });
  const circlesHit = await jsonBody(circlesHitResponse);
  assert.equal(circlesHitResponse.status, 200);
  assert.equal(circlesHit.cached, true);
  assert.equal(circlesHit.value.summary.responses, 48);

  const oversizedResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/result-view-cache', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${issued.token}`,
        'content-type': 'application/json',
        origin: 'https://client.example',
      },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        viewType: 'breakdown',
        dataVersionKey: 'v1-oversized',
        value: {
          rows: Array.from({ length: 200 }, () => 'x'.repeat(8000)),
        },
      }),
    }),
    env,
  });
  const oversized = await jsonBody(oversizedResponse);
  assert.equal(oversizedResponse.status, 413);
  assert.equal(oversized.reason, 'result_view_cache_value_too_large');
});

test('Telegram agent can mint a Mini App question-series launch link', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: '',
    TELEGRAM_BOT_USERNAME: 'contextengineer_bot',
    AGENT_BRIDGE_MINIAPP_SHORT_NAME: 'contextengineer',
  });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'34'.repeat(20)}`,
    createdAt: '2026-12-01T12:00:00.000Z',
  });
  assert.equal(issued.ok, true);
  const readOnly = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'34'.repeat(20)}`,
    scopes: [TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS],
    createdAt: '2026-12-01T12:01:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/mini-app-launch', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${issued.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        questionIds: ['q-freeform', 'q-binary'],
        skippedQuestionIds: ['q-binary'],
        draftAnswersByQuestionId: {
          'q-freeform': { text: 'Drafted answer for review' },
        },
      }),
    }),
    env,
  });

  const body = await jsonBody(response);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.match(body.link, /^https:\/\/t\.me\/contextengineer_bot\/contextengineer\?startapp=cecb_/);
  assert.deepEqual(body.questionIds, ['q-freeform', 'q-binary']);
  assert.equal(body.prefilledDraftCount, 1);
  const stored = JSON.parse(await env.AGENT_ACTION_KV.get(`telegram:action:${body.launch}`));
  assert.equal(stored.miniAppLaunch, true);
  assert.equal(stored.action, 'submit_response');
  assert.deepEqual(stored.serverContextRef.questionSeries.questionIds, ['q-freeform', 'q-binary']);
  assert.deepEqual(stored.serverContextRef.questionSeries.skippedQuestionIds, ['q-binary']);
  assert.deepEqual(stored.serverContextRef.questionSeries.draftAnswersByQuestionId['q-freeform'], {
    text: 'Drafted answer for review',
  });
  const latest = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:mini-app-latest-launch:v1:42'));
  assert.equal(latest.launch, body.launch);
  assert.equal(latest.sessionSlug, 'alpha');
  assert.deepEqual(latest.questionIds, ['q-freeform', 'q-binary']);
  assert.equal(JSON.stringify(latest).includes(issued.token), false);
  assert.equal(JSON.stringify(stored).includes(issued.token), false);

  const deniedResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/mini-app-launch', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${readOnly.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sessionSlug: 'alpha', questionIds: ['q-freeform'] }),
    }),
    env,
  });
  const denied = await jsonBody(deniedResponse);
  assert.equal(deniedResponse.status, 403);
  assert.equal(denied.requiredScope, TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.DRAFT_ANSWERS);
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
  assert.equal(questions.skillVersion, '2026-05-30 (v26)');
  assert.equal(questions.skillUpdateAvailable, false);

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

  const submitResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/preferences', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        submit: true,
        humanApproved: true,
        preferences: {
          answersByQuestionId: {
            'q-binary': { value: 'unsure', comments: 'User explicitly chose unsure.' },
          },
        },
      },
    }),
    env,
  });
  const submitted = await jsonBody(submitResponse);
  assert.equal(submitResponse.status, 200);
  assert.equal(submitted.draftCount, 1);
  assert.equal(submitted.submittedCount, 1);
  assert.equal(submitted.reviewRequired, false);
  assert.match(submitted.review.note, /without requiring Mini App finalization/);
  assert.equal(submitted.submitted[0].questionId, 'q-binary');
  const submitRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => String(key).startsWith('telegram:submit-request:'))
    .map(([, value]) => JSON.parse(value));
  assert.equal(submitRecords.length, 1);
  assert.equal(submitRecords[0].answer.label, 'Unsure');
  const submittedDraft = await readAnswerDraft({
    env,
    normalized: { user: { telegramUserId: '42' }, chat: { chatId: '-100123' } },
    sessionSlug: 'alpha',
    selectedQuestionId: 'q-binary',
  });
  assert.equal(submittedDraft.actionMetadata.reviewRequired, false);
  assert.equal(submittedDraft.actionMetadata.submitRequested, true);

  const nestedSubmitResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/preferences', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        preferences: [
          {
            questionId: 'q-freeform',
            answer: 'Ship the direct chat answer path.',
            submit: true,
            humanApproved: true,
          },
        ],
      },
    }),
    env,
  });
  const nestedSubmitted = await jsonBody(nestedSubmitResponse);
  assert.equal(nestedSubmitResponse.status, 200);
  assert.equal(nestedSubmitted.draftCount, 1);
  assert.equal(nestedSubmitted.submittedCount, 1);
  assert.equal(nestedSubmitted.reviewRequired, false);
  assert.equal(nestedSubmitted.submitted[0].questionId, 'q-freeform');
  const allSubmitRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => String(key).startsWith('telegram:submit-request:'))
    .map(([, value]) => JSON.parse(value));
  assert.equal(allSubmitRecords.length, 2);
  const freeformSubmit = allSubmitRecords.find((record) => record.questionId === 'q-freeform');
  assert.equal(freeformSubmit.answer.label, 'Ship the direct chat answer path.');
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

test('Telegram agent results exposes consensus and difference as aggregate-only JSON', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-onboarding', questionType: 'binary', prompt: 'Should onboarding be one click?', tags: ['onboarding'] },
      { questionId: 'q-privacy', questionType: 'binary', prompt: 'Should raw responses stay private?', tags: ['privacy'] },
    ]),
  });

  for (const view of ['consensus', 'difference']) {
    const response = await handleTelegramAgentHandoffRequest({
      request: agentRequest(`/telegram/agent/api/results?sessionSlug=alpha&telegramUserId=42&view=${view}&demo=1`),
      env,
    });
    const body = await jsonBody(response);
    const serialized = JSON.stringify(body);

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.view, view);
    assert.ok(Array.isArray(body.questions));
    assert.ok(body.questions.length > 0);
    assert.equal(serialized.includes('telegramUserId'), false);
    assert.equal(serialized.includes('aliases'), false);
    assert.equal(serialized.includes('qualitativeResponses'), false);
    assert.equal(serialized.includes('raw private answer'), false);
  }
});

test('Telegram agent groups JSON strips aliases and raw qualitative responses', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-onboarding', questionType: 'binary', prompt: 'Should onboarding be one click?', tags: ['onboarding'] },
      { questionId: 'q-privacy', questionType: 'binary', prompt: 'Should raw responses stay private?', tags: ['privacy'] },
    ]),
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/results?sessionSlug=alpha&telegramUserId=42&view=groups&demo=1'),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.view, 'groups');
  assert.ok(Array.isArray(body.groups));
  assert.ok(body.groups.length > 0);
  assert.equal(typeof body.groupCount, 'number');
  assert.equal(typeof body.suppressedGroupCount, 'number');
  for (const group of body.groups) {
    assert.equal(Object.hasOwn(group, 'aliases'), false);
    assert.equal(Object.hasOwn(group, 'qualitativeResponses'), false);
  }
});

test('Telegram agent groups suppress live groups below minGroupSize', async () => {
  const env = baseEnv({
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
        resultsExposure: { anonymizedGroupsEnabled: true, minGroupSize: 3 },
      }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-one', questionType: 'binary', prompt: 'Should Alpha publish recaps?', tags: ['results'] },
      { questionId: 'q-two', questionType: 'binary', prompt: 'Should Alpha ask more questions?', tags: ['results'] },
    ]),
  });
  await putSubmittedResult(env, { key: 'telegram:submit-request:1', telegramUserId: '42', questionId: 'q-one', label: 'Agree', comments: 'raw private answer one', createdAt: '2026-05-08T12:00:01.000Z' });
  await putSubmittedResult(env, { key: 'telegram:submit-request:2', telegramUserId: '43', questionId: 'q-one', label: 'Agree', comments: 'raw private answer two', createdAt: '2026-05-08T12:00:02.000Z' });
  await putSubmittedResult(env, { key: 'telegram:submit-request:3', telegramUserId: '42', questionId: 'q-two', label: 'Disagree', createdAt: '2026-05-08T12:00:03.000Z' });
  await putSubmittedResult(env, { key: 'telegram:submit-request:4', telegramUserId: '43', questionId: 'q-two', label: 'Disagree', createdAt: '2026-05-08T12:00:04.000Z' });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/results?sessionSlug=alpha&telegramUserId=42&view=groups'),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.minGroupSize, 3);
  assert.equal(body.groupCount, 0);
  assert.ok(body.suppressedGroupCount >= 1);
  assert.equal(JSON.stringify(body).includes('raw private answer'), false);
});

test('Telegram agent result views enforce exposure gates and supported view list', async () => {
  const env = baseEnv({
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
        resultsExposure: {
          aggregateResultsEnabled: false,
          anonymizedGroupsEnabled: false,
        },
      }],
    }),
  });

  const consensus = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/results?sessionSlug=alpha&telegramUserId=42&view=consensus'),
    env,
  });
  assert.equal(consensus.status, 403);
  assert.equal((await jsonBody(consensus)).reason, 'level_3_aggregate_results_admin_disabled');

  const groups = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/results?sessionSlug=alpha&telegramUserId=42&view=groups'),
    env,
  });
  assert.equal(groups.status, 403);
  assert.equal((await jsonBody(groups)).reason, 'anonymized_groups_admin_disabled');

  const unknown = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/results?sessionSlug=alpha&telegramUserId=42&view=geo-map'),
    env,
  });
  const unknownBody = await jsonBody(unknown);
  assert.equal(unknown.status, 400);
  assert.equal(unknownBody.reason, 'unsupported_results_view');
  assert.deepEqual(unknownBody.supportedViews, ['topic-map', 'consensus', 'difference', 'groups']);

  const unsupportedImage = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/results-image?sessionSlug=alpha&telegramUserId=42&view=difference'),
    env,
  });
  const unsupportedImageBody = await jsonBody(unsupportedImage);
  assert.equal(unsupportedImage.status, 400);
  assert.equal(unsupportedImageBody.reason, 'unsupported_results_view');
  assert.deepEqual(unsupportedImageBody.supportedViews, ['topic-map', 'consensus', 'groups']);
});

test('Telegram agent can render group results image with demo data', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-onboarding', questionType: 'binary', prompt: 'Should onboarding be one click?', tags: ['onboarding'] },
      { questionId: 'q-privacy', questionType: 'binary', prompt: 'Should raw responses stay private?', tags: ['privacy'] },
    ]),
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/results-image?sessionSlug=alpha&telegramUserId=42&view=group&demo=1'),
    env,
  });
  const imageBytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
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

test('Telegram agent tags endpoint returns active tag counts and rejects explicit unknown sessions', async () => {
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
  const defaultResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/tags?telegramUserId=42'),
    env,
  });
  const defaultBody = await jsonBody(defaultResponse);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.sessionSlug, 'alpha');
  assert.equal(body.tags.find((entry) => entry.tag === 'alpha-topic')?.count, 2);
  assert.equal(body.tags.find((entry) => entry.tag === 'shared')?.count, 2);
  assert.equal(body.tags.find((entry) => entry.tag === 'beta-topic')?.count, 1);
  assert.equal(body.tags.findIndex((entry) => entry.tag === 'alpha-topic') < body.tags.findIndex((entry) => entry.tag === 'shared'), true);
  assert.equal(JSON.stringify(body).includes('organizers need a recap'), false);
  assert.equal(JSON.stringify(body).includes('agent-test-token'), false);
  assert.equal(defaultResponse.status, 200);
  assert.equal(defaultBody.sessionSlug, 'alpha');
  assert.equal(defaultBody.tags.find((entry) => entry.tag === 'shared')?.count, 2);
  assert.equal(unknownResponse.status, 404);
  assert.equal(unknown.reason, 'session_not_found');
  assert.equal(unknown.sessionSlug, 'missing-session');
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

test('Telegram admin default-session endpoint exposes delegated status and service-token mutations', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        { sessionSlug: 'alpha', sessionName: 'Alpha Session', telegramBridgeEnabled: true, telegramOnly: true },
        { sessionSlug: 'beta', sessionName: 'Beta Session', telegramBridgeEnabled: true, telegramOnly: true },
      ],
    }),
  });
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
  await env.AGENT_ACTION_KV.put('telegram:admin-default-session:v1', JSON.stringify({
    version: 1,
    sessionSlug: 'beta',
    updatedBy: '0x1234...abcd',
    updatedAt: '2026-12-01T12:00:00.000Z',
  }));

  const statusResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/default-session?sessionSlug=alpha', {
      token: issued.token,
    }),
    env,
  });
  const status = await jsonBody(statusResponse);
  const delegatedPostResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/default-session', {
      method: 'POST',
      token: issued.token,
      body: { telegramUserId: '42', sessionSlug: 'alpha' },
    }),
    env,
  });
  const delegatedPost = await jsonBody(delegatedPostResponse);
  const emptySlugResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/default-session', {
      method: 'POST',
      body: { telegramUserId: '42', sessionSlug: '' },
    }),
    env,
  });
  const emptySlug = await jsonBody(emptySlugResponse);
  const unknownSlugResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/default-session', {
      method: 'POST',
      body: { telegramUserId: '42', sessionSlug: 'missing-session' },
    }),
    env,
  });
  const unknownSlug = await jsonBody(unknownSlugResponse);
  const setResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/default-session', {
      method: 'POST',
      body: { telegramUserId: '42', sessionSlug: 'beta' },
    }),
    env,
  });
  const set = await jsonBody(setResponse);
  const deleteResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/default-session?telegramUserId=42&sessionSlug=alpha', {
      method: 'DELETE',
    }),
    env,
  });
  const deleted = await jsonBody(deleteResponse);

  assert.equal(statusResponse.status, 200);
  assert.equal(status.ok, true);
  assert.equal(status.effectiveDefaultSessionSlug, 'beta');
  assert.equal(status.adminDefaultSessionSlug, 'beta');
  assert.equal(status.scheduledDefaultSessionSlug, 'alpha');
  assert.equal(status.configuredDefaultSessionSlug, 'alpha');
  assert.equal(status.adminDefaultSessionInvalidSlug, '');
  assert.equal(delegatedPostResponse.status, 403);
  assert.equal(delegatedPost.reason, 'question_queue_service_token_required');
  assert.equal(emptySlugResponse.status, 400);
  assert.equal(emptySlug.reason, 'invalid_session_slug');
  assert.equal(unknownSlugResponse.status, 404);
  assert.equal(unknownSlug.reason, 'session_not_linked');
  assert.equal(setResponse.status, 200);
  assert.equal(set.ok, true);
  assert.equal(set.adminDefaultSessionSlug, 'beta');
  assert.equal(set.effectiveDefaultSessionSlug, 'beta');
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleted.ok, true);
  assert.equal(deleted.cleared, true);
  assert.equal(deleted.effectiveDefaultSessionSlug, 'alpha');
  assert.equal(await env.AGENT_ACTION_KV.get('telegram:admin-default-session:v1'), null);
});

test('Telegram admin skill-update endpoint exposes status and service-token mutations', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        telegramBridgeEnabled: true,
        telegramOnly: true,
      }],
    }),
  });
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

  const initialStatusResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/skill-update?sessionSlug=alpha', {
      token: issued.token,
    }),
    env,
  });
  const initialStatus = await jsonBody(initialStatusResponse);
  const delegatedPostResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/skill-update', {
      method: 'POST',
      token: issued.token,
      body: { sessionSlug: 'alpha' },
    }),
    env,
  });
  const delegatedPost = await jsonBody(delegatedPostResponse);
  const setResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/skill-update', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        sessionSlug: 'alpha',
        latestVersion: '2026-05-30 (v26)',
        note: 'Refresh before answering.',
      },
    }),
    env,
  });
  const set = await jsonBody(setResponse);
  const flaggedStatusResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/skill-update?sessionSlug=alpha', {
      token: issued.token,
    }),
    env,
  });
  const flaggedStatus = await jsonBody(flaggedStatusResponse);
  const deleteResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/skill-update?telegramUserId=42&sessionSlug=alpha', {
      method: 'DELETE',
    }),
    env,
  });
  const deleted = await jsonBody(deleteResponse);
  const clearedStatusResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/skill-update?sessionSlug=alpha', {
      token: issued.token,
    }),
    env,
  });
  const clearedStatus = await jsonBody(clearedStatusResponse);

  assert.equal(initialStatusResponse.status, 200);
  assert.equal(initialStatus.ok, true);
  assert.equal(initialStatus.updateAvailable, false);
  assert.equal(initialStatus.version, '2026-05-30 (v26)');
  assert.equal(delegatedPostResponse.status, 403);
  assert.equal(delegatedPost.reason, 'question_queue_service_token_required');
  assert.equal(setResponse.status, 200);
  assert.equal(set.ok, true);
  assert.equal(set.updateAvailable, true);
  assert.equal(set.latestVersion, '2026-05-30 (v26)');
  assert.equal(flaggedStatusResponse.status, 200);
  assert.equal(flaggedStatus.updateAvailable, true);
  assert.equal(flaggedStatus.updateNote, 'Refresh before answering.');
  assert.equal(deleteResponse.status, 200);
  assert.equal(deleted.ok, true);
  assert.equal(deleted.cleared, true);
  assert.equal(clearedStatusResponse.status, 200);
  assert.equal(clearedStatus.updateAvailable, false);
  assert.equal(await env.AGENT_ACTION_KV.get('telegram:agent-skill-update:v1'), null);
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
            geoRefs: [{ geoId: 'edge-node-1', label: 'Agent Village recap' }],
          },
          {
            prompt: 'Should the demo prioritize organizer feedback?',
            questionType: 'binary',
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
  const sourcedQuestion = questions.questions.find((question) => (
    question.prompt === 'Should Agent Village organizers publish a daily recap?'
  ));
  const geoFilteredResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123&tags=geo:edge-node-1&relevanceMode=filter'),
    env,
  });
  const geoFiltered = await jsonBody(geoFilteredResponse);
  const backlinkResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest(`/telegram/agent/api/geo-backlink?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123&questionId=${encodeURIComponent(body.created[0].questionId)}`),
    env,
  });
  const backlink = await jsonBody(backlinkResponse);
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
  assert.equal(body.created[0].geoRefs[0].geoId, 'edge-node-1');
  assert.equal(body.created[0].tags.includes('geo:edge-node-1'), true);
  assert.equal(body.created[0].tags.includes('src:example-com'), true);
  assert.equal(proposedRecords.length, 3);
  assert.equal(proposedRecords.every((record) => record.status === 'active'), true);
  assert.equal(proposedRecords.every((record) => record.sponsored !== true), true);
  assert.equal(proposedRecords.every((record) => record.actionMetadata.endpoint === '/telegram/agent/api/questions/create'), true);
  assert.equal(proposedRecords[0].references[0].url, sourceUrl);
  assert.equal(proposedRecords[0].geoRefs[0].geoId, 'edge-node-1');
  assert.equal(sourcedQuestion.references[0].url, sourceUrl);
  assert.equal(sourcedQuestion.geoRefs[0].geoId, 'edge-node-1');
  assert.equal(sourcedQuestion.tags.includes('src:example-com'), true);
  assert.equal(sourcedQuestion.tags.includes('geo:edge-node-1'), true);
  assert.equal(geoFilteredResponse.status, 200);
  assert.deepEqual(geoFiltered.questions.map((question) => question.questionId), [body.created[0].questionId]);
  assert.equal(backlinkResponse.status, 200);
  assert.equal(backlink.backlink.questionId, body.created[0].questionId);
  assert.equal(backlink.backlink.geoRefs[0].geoId, 'edge-node-1');
  assert.equal(backlink.note.includes('does not call Geo'), true);
  assert.equal(JSON.stringify(body).includes('ceagt_'), false);
  assert.equal(JSON.stringify(backlink).includes('EDGEOS'), false);
  assert.equal(emptyResponse.status, 400);
  assert.equal((await jsonBody(emptyResponse)).reason, 'questions_create_batch_required');
  assert.equal(oversizedResponse.status, 400);
  assert.equal((await jsonBody(oversizedResponse)).reason, 'questions_create_batch_too_large');
});

test('Telegram agent preserves explicit question tags without session tag inference', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Agent Village Research',
        default: true,
        telegramBridgeEnabled: true,
        telegramGroupOpenAccess: true,
        managedAccountSubmitAllowed: true,
        sessionContext: 'Agent Village governance funding safety research with organizers.',
      }],
    }),
  });
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions/create', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        questions: [{
          prompt: 'Should safety reviewers intervene immediately?',
          questionType: 'binary',
          tags: ['ethics', 'safety', 'methodology'],
        }],
      },
    }),
    env,
  });
  const created = await jsonBody(response);
  const questionsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123'),
    env,
  });
  const listed = await jsonBody(questionsResponse);
  const question = listed.questions.find((entry) => entry.questionId === created.created[0].questionId);

  assert.equal(response.status, 200);
  assert.deepEqual(created.created[0].tags, ['ethics', 'safety', 'methodology']);
  assert.deepEqual(question.tags, ['ethics', 'safety', 'methodology']);
});

test('Telegram agent geo backlinks handle bytes32 question ids without secret false positives', async () => {
  const questionId = `0x${'a'.repeat(64)}`;
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId,
        questionType: 'binary',
        prompt: 'Should a Geo-linked node use CE follow-up questions?',
        geoRefs: [{ geoId: 'edge-node-bytes32' }],
      },
    ]),
  });
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest(`/telegram/agent/api/geo-backlink?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123&questionId=${encodeURIComponent(questionId)}`),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.backlink.questionId, questionId);
  assert.equal(body.backlink.questionQuery.questionId, questionId);
  assert.equal(body.backlink.questionEndpoint.includes(questionId), false);
  assert.equal(body.backlink.geoRefs[0].geoId, 'edge-node-bytes32');
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
