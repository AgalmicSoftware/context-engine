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
  DRAFT_EDIT_METRIC_KV_PREFIX,
  buildDraftEditMetricSummary,
} from './telegramDraftEditMetrics.mjs';
import {
  AGENT_CREDENTIAL_KV_PREFIX,
  AGENT_CREDENTIAL_KINDS,
  AGENT_CREDENTIAL_SLOT_KV_PREFIX,
  createTelegramAgentDelegationToken,
  issueAgentCredential,
  loadAgentCredential,
  loadTelegramAgentDelegationToken,
  readAgentCredentialSlot,
  readTelegramAgentOnlyTokenUserPointer,
  telegramAgentPrincipal,
  TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_SCOPES,
  TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES,
} from './agentCredentials.mjs';
import {
  AGENT_ONLY_MODE_CONFIG_KV_PREFIX,
  AGENT_ONLY_WINDOW_KV_PREFIX,
} from './telegramAgentOnlyMode.mjs';
import { deriveTelegramResponseExportAccount } from './telegramResponseExport.mjs';
import { persistTelegramSubmitRecord } from './telegramSubmitQueue.mjs';
import { persistTelegramProposedQuestion } from './telegramQuestionProposals.mjs';

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
    this.metadata.delete(key);
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

test('Draft edit metric summary preserves rating zero without raw text', () => {
  const metric = buildDraftEditMetricSummary({
    questionType: 'rating',
    draftAnswer: { value: 0, comments: 'short draft comment' },
    sentAnswer: { value: 7, comments: 'longer final comment with nuance' },
  });

  assert.equal(metric.questionType, 'rating');
  assert.equal(metric.ratingFrom, 0);
  assert.equal(metric.ratingTo, 7);
  assert.equal(metric.ratingDelta, 7);
  assert.equal(metric.ratingDirection, 'up');
  assert.equal(metric.ratingAbsDeltaBucket, '6+');
  assert.equal(metric.commentChanged, true);
  assert.equal(JSON.stringify(metric).includes('short draft comment'), false);
  assert.equal(JSON.stringify(metric).includes('longer final comment'), false);
});

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

async function seedAgentOnlyProposedQuestions(env, sessionSlug = 'alpha', count = 4) {
  const types = ['binary', 'freeform', 'rating', 'multichoice'];
  const ids = [];
  for (let index = 0; index < count; index += 1) {
    const type = types[index % types.length];
    const result = await persistTelegramProposedQuestion({
      env,
      normalized: {
        user: { telegramUserId: '42' },
        chat: { chatId: '42' },
      },
      sessionSlug,
      prompt: `Agent-only route question ${index + 1}?`,
      questionType: type,
      options: type === 'multichoice' ? ['One', 'Two', 'Three'] : [],
      createdAt: `2026-06-12T15:${String(index).padStart(2, '0')}:00.000Z`,
    });
    ids.push(result.questionId);
  }
  return ids;
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

const LONG_TEST_TOKEN_TTL_SECONDS = 3650 * 24 * 60 * 60;

test('credential rotation preserves the active token when the slot write fails', async () => {
  const env = { AGENT_ACTION_KV: new MemoryKv() };
  const principal = telegramAgentPrincipal({ telegramUserId: '42', username: 'host' });
  const first = await issueAgentCredential({
    env,
    principal,
    sessionSlug: 'alpha',
    createdAt: '2026-07-19T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  assert.equal(first.ok, true);

  const originalPut = env.AGENT_ACTION_KV.put.bind(env.AGENT_ACTION_KV);
  let rejectNextSlotWrite = true;
  env.AGENT_ACTION_KV.put = async (key, value, options) => {
    if (rejectNextSlotWrite && String(key).startsWith(AGENT_CREDENTIAL_SLOT_KV_PREFIX)) {
      rejectNextSlotWrite = false;
      throw new Error('slot_write_unavailable');
    }
    return originalPut(key, value, options);
  };

  const failed = await issueAgentCredential({
    env,
    principal,
    sessionSlug: 'alpha',
    createdAt: '2026-07-19T12:01:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.reason, 'agent_token_pointer_write_failed');
  assert.equal((await loadAgentCredential({ env, token: first.token })).ok, true);
  assert.equal((await readAgentCredentialSlot({ env, principal, sessionSlug: 'alpha' })).tokenHash, first.tokenHash);
  assert.equal(
    [...env.AGENT_ACTION_KV.store.keys()].filter((key) => String(key).startsWith(AGENT_CREDENTIAL_KV_PREFIX)).length,
    1,
  );
});

test('fixed-date delegation token fixtures declare an explicit TTL', () => {
  const source = readFileSync(new URL(import.meta.url), 'utf8');
  const tokenCalls = source.matchAll(/createTelegramAgentDelegationToken\(\{[\s\S]*?\n\s*\}\)/g);
  const unsafeLines = [];
  for (const match of tokenCalls) {
    if (/createdAt:\s*['"]\d{4}-\d{2}-\d{2}T/.test(match[0]) && !/ttlSeconds:/.test(match[0])) {
      unsafeLines.push(source.slice(0, match.index).split('\n').length);
    }
  }
  assert.deepEqual(unsafeLines, []);
});

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
  createdAt = '2026-06-01T12:00:00.000Z',
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
    createdAt: '2026-06-01T12:00:00.000Z',
  });
  return account.accountAddress;
}

test('Telegram agent handoff skill is packaged with the worker', () => {
  const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
  const source = readFileSync(
    new URL('./skills/ce-telegram-agent-handoff/SKILL.md', import.meta.url),
    'utf8',
  );
  const reference = readFileSync(
    new URL('./skills/ce-telegram-bot-reference/SKILL.md', import.meta.url),
    'utf8',
  );
  const wrapped = readFileSync(
    new URL('./skills/ce-session-wrapped/SKILL.md', import.meta.url),
    'utf8',
  );

  assert.match(source, /name:\s+context-engine/);
  assert.match(source, /^# Context Engine Agent Runtime/m);
  assert.match(source, /\*\*Skill version:\*\* 2026-07-18 \(v42\)/);
  assert.match(source, /short runtime skill/);
  assert.match(source, /ce-telegram-bot-reference\/SKILL\.md/);
  assert.match(source, /Never make unauthenticated\s+question, draft, answer, vote, or results requests/);
  assert.match(source, /GET \/api\/agent\/skill-version/);
  assert.match(source, /Use `\/api\/agent\/\*` as the canonical/);
  assert.match(source, /`\/telegram\/agent\/api\/\*` prefix remains a transition alias/);
  assert.match(source, /cache or install this Markdown skill locally/);
  assert.match(source, /not a callable tool name/);
  assert.match(source, /Do not call a tool named `ce-telegram-agent-handoff`/);
  assert.match(source, /Agent Only Mode \(agent_only_mode\)/);
  assert.match(source, /future interactive CE report views/);
  assert.match(source, /statement ids, frozen prompts/);
  assert.match(source, /EdgeOS Read Permission: Yes/);
  assert.match(source, /treat that as the principal's consent to run now/);
  assert.match(source, /Do not\s+interrupt the run with a separate run, EdgeOS permission, preference, research,\s+or confirmation question/);
  assert.match(source, /If the setting is absent,\s+default to No and continue/);
  assert.match(source, /runtime `instructions` field from `\/agent-only\/start` is\s+authoritative/);
  assert.match(source, /Do not\s+replace those runtime instructions with cached rules/);
  assert.match(source, /ordinary onboarding section is not required for Session Wrapped/);
  assert.match(source, /One-Time Invite Onboarding/);
  assert.ok(source.indexOf('## Agent Only Mode (agent_only_mode)') < source.indexOf('## One-Time Invite Onboarding'));
  assert.match(source, /GET \/api\/agent\/agent-only\/start/);
  assert.match(source, /Edge-Native Onboarding/);
  assert.match(source, /demographicLinkOptIn/);
  assert.match(source, /attendanceLinkOptIn/);
  assert.match(source, /draftDivergenceOptIn/);
  assert.match(source, /topicPreferences/);
  assert.match(source, /Attended Previous Edge Events/);
  assert.match(source, /group and demographic fields as a storage\s+schema/);
  assert.match(source, /Read And Present Questions/);
  assert.match(source, /Do not lead with raw labels like `Question \(binary, proposed\)`/);
  assert.match(source, /Answer Shapes/);
  assert.match(source, /POST \/api\/agent\/preferences/);
  assert.match(source, /submit: true/);
  assert.match(source, /humanApproved: true/);
  assert.match(source, /every intended answer has a returned `requestId`/);
  assert.match(source, /`myAnswer`/);
  assert.match(source, /POST \/api\/agent\/questions\/create/);
  assert.match(source, /GET \/api\/agent\/results\?sessionSlug=<slug>&view=topic-map/);
  assert.match(source, /GET \/api\/agent\/results\?sessionSlug=<slug>&view=groups/);
  assert.match(source, /GET \/api\/agent\/results-image\?sessionSlug=<slug>&view=topic-map/);
  assert.doesNotMatch(source, /Digest \/ Hermes Cron Install/);
  assert.doesNotMatch(source, /scheduled digest/i);
  assert.doesNotMatch(source, /Skill\(s\) not found and skipped: context-engine/);
  assert.match(source, /GET \/api\/agent\/admin\/metrics/);
  assert.match(source, /POST \/api\/agent\/question-queue\/plan/);
  assert.match(source, /POST \/api\/agent\/question-queue\/apply/);
  assert.doesNotMatch(source, /## Changelog/);

  assert.match(reference, /name:\s+ce-telegram-bot-reference/);
  assert.match(reference, /^# CE Telegram Bot Reference/m);
  assert.match(reference, /Detailed Context Engine Telegram bot, Mini App, admin, and operator reference/);
  assert.match(reference, /POST \/api\/agent\/mini-app-launch/);
  assert.match(source, /skillUpdateAvailable/);
  for (const installGuide of [readme, reference]) {
    assert.match(
      installGuide,
      /raw\.githubusercontent\.com\/AgalmicSoftware\/context-engine\/main\/workers\/agentBridgeWorker\/skills\/ce-telegram-agent-handoff\/SKILL\.md/,
    );
    assert.match(installGuide, /CE_SKILL_REF="\$\{CE_SKILL_REF:-main\}"/);
    assert.doesNotMatch(installGuide, /Set `CE_SKILL_REF=main` after the skill lands/);
  }

  assert.match(wrapped, /name:\s+ce-session-wrapped/);
  assert.match(wrapped, /^# Context Engine Session Wrapped Runtime/m);
  assert.match(wrapped, /\*\*Skill version:\*\* 2026-07-04 \(session-wrapped-v1\)/);
  assert.match(wrapped, /Use this skill only to run a generic Context Engine session wrapped flow/);
  assert.match(wrapped, /not use the broader\s+`context-engine` skill/);
  assert.match(wrapped, /main\/workers\/agentBridgeWorker\/skills\/ce-session-wrapped\/SKILL\.md/);
  assert.match(wrapped, /Placeholder Session Config/);
  assert.match(wrapped, /fixture question bank/);
  assert.match(wrapped, /memory\/context-engine-state\.json/);
  assert.match(wrapped, /The only local data enrichment allowed is the optional known-path token usage/);
  assert.match(wrapped, /Session Wrapped Invite Token/);
  assert.match(wrapped, /Read and run the Context Engine session wrapped skill above \(no search\):/);
  assert.match(wrapped, /Canonical message/);
  assert.match(wrapped, /`Invite Token`, `Wrapped Invite Token`, and `Session Wrapped Invite Token`/);
  assert.match(wrapped, /Do not ask another permission,\s+preference, research, or confirmation question/);
  assert.match(wrapped, /"mode": "agent_only"/);
  assert.match(wrapped, /"skill": "ce-session-wrapped"/);
  assert.match(wrapped, /\/api\/agent\/invite\/onboard/);
  assert.doesNotMatch(wrapped, /Telegram User ID:/);
  assert.match(wrapped, /GET `\/api\/agent\/skill-version`/);
  assert.match(wrapped, /protocol v42/);
  assert.match(wrapped, /Quiet Lifecycle/);
  assert.match(wrapped, /Create one fresh `run_id` for the whole run/);
  assert.match(wrapped, /Do not discover files, inspect logs\/configs\/\s+sessions/);
  assert.match(wrapped, /Use one private helper script for the run after credential resolution/);
  assert.match(wrapped, /Use one private helper script for the rest of the run/);
  assert.match(wrapped, /Helper stdout may contain only\s+one compact final JSON object/);
  assert.match(wrapped, /Internal prediction\s+calls may return compact JSON keyed by local index/);
  assert.match(wrapped, /never print that JSON to\s+chat or stdout/);
  assert.match(wrapped, /Fetch all statement pages silently/);
  assert.match(wrapped, /\/api\/agent\/agent-only\/statements\?limit=5&compact=1/);
  assert.match(wrapped, /compact, low-output execution\s+as the default/);
  assert.match(wrapped, /Do not print statements, options,\s+schemas, ids,\s+payloads,\s+prediction\s+JSON/);
  assert.doesNotMatch(wrapped, /compact direct HTTP calls/);
  assert.doesNotMatch(wrapped, /vote status/);
  assert.doesNotMatch(wrapped, /Session Lab/i);
  assert.doesNotMatch(wrapped, /session-topic/i);
  assert.doesNotMatch(wrapped, /## No Balance Check/);
  assert.doesNotMatch(wrapped, /skill_view|skills_list|search_files|session_search|mcp_index|hermes insights|\/opt\/hermes/i);
  assert.match(wrapped, /Skip token-vote allocations in the default run/);
  assert.match(wrapped, /multichoice uses\s+`values` arrays/);
  assert.match(wrapped, /Do not POST token votes\s+unless the principal explicitly asks/);
  assert.match(wrapped, /daily_usage_30d/);
  assert.match(wrapped, /local sqlite3 query \(including cache\)/);
  assert.match(wrapped, /make at most one quiet\s+known-path SQLite attempt/);
  assert.match(wrapped, /COALESCE\(input_tokens,0\)/);
  assert.match(wrapped, /COALESCE\(output_tokens,0\)/);
  assert.match(wrapped, /COALESCE\(cache_read_tokens,0\)/);
  assert.match(wrapped, /COALESCE\(cache_write_tokens,0\)/);
  assert.match(wrapped, /started_at >= cutoff/);
  assert.match(wrapped, /date\(CAST\(started_at AS INTEGER\), 'unixepoch',\s+'localtime'\)/);
  assert.match(wrapped, /Do not assume a precomputed aggregate column exists/);
  assert.match(wrapped, /do not\s+use SQL datetime string filters against `started_at`/);
  assert.doesNotMatch(wrapped, /total_tokens\s+column|SUM\(\s*total_tokens|SELECT\s+total_tokens/i);
  assert.doesNotMatch(wrapped, /datetime\('now'\)/);
  assert.match(wrapped, /If unavailable or\s+unclear,\s+omit `token_usage`/);
  assert.match(wrapped, /Never print rows\s+or command\s+output/);
  assert.match(wrapped, /"format": "json_url"/);
  assert.match(wrapped, /"include_base64": false/);
  assert.match(wrapped, /exactly\s+one Markdown image line using the\s+returned `image_url`/);
  assert.match(wrapped, /!\[Session Wrapped\]\(<image_url>\)/);
  assert.match(wrapped, /Do not use local paths, raw `image_base64`, duplicate raw links/);
  assert.match(wrapped, /Do not request `mode: "political_compass"` during the default run/);
  assert.match(wrapped, /Generate an\s+optional comparison map only if the user asks after the standard image/);
  assert.match(wrapped, /MP4 story video is not enabled\s+yet/);
  assert.doesNotMatch(wrapped, /visualDefaults\.wrapped_story/);
  assert.doesNotMatch(wrapped, /shareable story version/);
  assert.match(wrapped, /Context Engine Mini App/);
  assert.doesNotMatch(wrapped, /question-queue\/apply/);
  assert.doesNotMatch(wrapped, /results-image/);
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
  assert.equal(body.version, '2026-07-18 (v42)');
  assert.equal(body.skill, 'context-engine');
  assert.equal(body.skillUrl, 'https://example.test/skills/ce-telegram-agent-handoff/SKILL.md');
  assert.equal(Object.hasOwn(body, 'changelogUrl'), false);
  assert.equal(body.updateAvailable, false);
  assert.equal(body.latestVersion, '2026-07-18 (v42)');
  assert.equal(body.updateNote, '');
});

test('Telegram agent handoff exposes dedicated Session Wrapped skill metadata', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_WRAPPED_SKILL_URL: 'https://example.test/skills/ce-session-wrapped/SKILL.md',
  });
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/api/agent/session-wrapped/skill-version', { token: '' }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.version, '2026-07-04 (session-wrapped-v1)');
  assert.equal(body.protocolVersion, '2026-07-18 (v42)');
  assert.equal(body.skill, 'ce-session-wrapped');
  assert.equal(body.skillUrl, 'https://example.test/skills/ce-session-wrapped/SKILL.md');
  assert.equal(body.workerSkillVersionEndpoint, '/api/agent/skill-version');
  assert.equal(body.startEndpoint, '/api/agent/agent-only/start');
  assert.equal(body.wrappedImageEndpoint, '/api/agent/agent-only/wrapped-image');
});

test('Telegram agent handoff serves a short skill redirect', async () => {
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/skill?v=19', { token: '' }),
    env: baseEnv(),
  });

  assert.equal(response.status, 302);
  const location = response.headers.get('location') || '';
  assert.match(location, /^https:\/\/raw\.githubusercontent\.com\/AgalmicSoftware\/context-engine\/main\/workers\/agentBridgeWorker\/skills\/ce-telegram-agent-handoff\/SKILL\.md/);
  assert.match(location, /v=2026-07-18-v42-/);
});

test('Telegram agent handoff serves a dedicated Session Wrapped skill redirect', async () => {
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/api/agent/session-wrapped/skill', { token: '' }),
    env: baseEnv(),
  });

  assert.equal(response.status, 302);
  const location = response.headers.get('location') || '';
  assert.match(location, /^https:\/\/raw\.githubusercontent\.com\/AgalmicSoftware\/context-engine\/main\/workers\/agentBridgeWorker\/skills\/ce-session-wrapped\/SKILL\.md/);
  assert.match(location, /v=2026-07-04-session-wrapped-v1-/);
});

test('Telegram agent handoff serves a short Session Wrapped skill alias', async () => {
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/session-wrapped', { token: '' }),
    env: baseEnv(),
  });

  assert.equal(response.status, 302);
  const location = response.headers.get('location') || '';
  assert.match(location, /^https:\/\/raw\.githubusercontent\.com\/AgalmicSoftware\/context-engine\/main\/workers\/agentBridgeWorker\/skills\/ce-session-wrapped\/SKILL\.md/);
  assert.match(location, /v=2026-07-04-session-wrapped-v1-/);
});

test('Telegram agent handoff serves a short Session Wrapped skill alias to HEAD probes', async () => {
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/session-wrapped', { token: '', method: 'HEAD' }),
    env: baseEnv(),
  });

  assert.equal(response.status, 302);
  const location = response.headers.get('location') || '';
  assert.match(location, /^https:\/\/raw\.githubusercontent\.com\/AgalmicSoftware\/context-engine\/main\/workers\/agentBridgeWorker\/skills\/ce-session-wrapped\/SKILL\.md/);
  assert.match(location, /v=2026-07-04-session-wrapped-v1-/);
});

test('Agent-only start payload exposes configurable visual defaults', async () => {
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/start', { token: '' }),
    env: baseEnv({
      AGENT_BRIDGE_AGENT_WRAPPED_STORY_DEFAULT: 'true',
      AGENT_BRIDGE_AGENT_WRAPPED_COMPASS_DEFAULT: 'true',
    }),
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.wrappedImageEndpoint, '/api/agent/agent-only/wrapped-image');
  assert.deepEqual(body.visualDefaults, {
    wrapped: true,
    wrapped_story: false,
    political_compass: false,
  });
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
    latestVersion: '2026-07-18 (v42)',
    note: 'Refresh before answering.',
    updatedAt: '2026-05-30T00:00:00.000Z',
  }));

  const payload = await __test__telegramAgentHandoff.skillVersionPayloadWithFlag(env);
  assert.equal(payload.updateAvailable, true);
  assert.equal(payload.latestVersion, '2026-07-18 (v42)');
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
    telegramUserId: '43',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-12-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
  assert.equal(mismatch.sessionSlug, 'alpha');

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
    ttlSeconds: 1,
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
  assert.equal(expiredBody.action, 'obtain_new_agent_credential');
  assert.equal(Object.hasOwn(expiredBody, 'telegramCommand'), false);
  assert.equal(Object.hasOwn(expiredBody, 'telegramButton'), false);
  assert.doesNotMatch(expiredBody.message, /invite\/onboard/i);
  assert.doesNotMatch(expiredBody.message, /trusted Geo\/Hermes invite/i);
  assert.match(expiredBody.message, /original onboarding channel/);

  const missingTokenResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha', {
      token: 'ceagt_missing_or_kv_expired_token',
    }),
    env,
  });
  const missingTokenBody = await jsonBody(missingTokenResponse);
  assert.equal(missingTokenResponse.status, 401);
  assert.equal(missingTokenBody.reason, 'agent_token_not_found');
  assert.equal(missingTokenBody.action, 'obtain_new_agent_credential');
});

test('Telegram agent questions endpoint caps candidate batches when requested', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: '' });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '43',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-12-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  assert.equal(issued.ok, true);
  const uncappedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha', {
      token: issued.token,
    }),
    env,
  });
  const uncapped = await jsonBody(uncappedResponse);
  const limitedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha&limit=1', {
      token: issued.token,
    }),
    env,
  });
  const limited = await jsonBody(limitedResponse);
  assert.equal(limited.answerState.answeredCount, 0);
  assert.equal(limited.answerState.unansweredCount, 2);
  assert.equal(limited.answerState.sort, 'unanswered_first');
  const postLimitedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        count: 1,
      },
    }),
    env,
  });
  const postLimited = await jsonBody(postLimitedResponse);

  assert.equal(uncappedResponse.status, 200);
  assert.equal(uncapped.questions.length, 2);
  assert.equal(limitedResponse.status, 200);
  assert.equal(limited.questions.length, 1);
  assert.equal(limited.questions[0].questionId, 'q-binary');
  assert.equal(limited.questions[0].answeredByUser, false);
  assert.equal(postLimitedResponse.status, 200);
  assert.equal(postLimited.questions.length, 1);

  const submitResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/preferences', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        submit: true,
        humanApproved: true,
        preferences: {
          answersByQuestionId: {
            'q-binary': { value: 'unsure' },
          },
        },
      },
    }),
    env,
  });
  const submitted = await jsonBody(submitResponse);
  assert.equal(submitResponse.status, 200);
  assert.equal(submitted.ok, true);
  assert.equal(submitted.submittedCount, 1);

  const unansweredFirstResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha&limit=1', {
      token: issued.token,
    }),
    env,
  });
  const unansweredFirst = await jsonBody(unansweredFirstResponse);
  assert.equal(unansweredFirstResponse.status, 200);
  assert.equal(unansweredFirst.answerState.answeredCount, 1);
  assert.equal(unansweredFirst.answerState.unansweredCount, 1);
  assert.equal(unansweredFirst.questions.length, 1);
  assert.equal(unansweredFirst.questions[0].questionId, 'q-freeform');
  assert.equal(unansweredFirst.questions[0].answeredByUser, false);

  const answeredLookupResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha&questionId=q-binary', {
      token: issued.token,
    }),
    env,
  });
  const answeredLookup = await jsonBody(answeredLookupResponse);
  assert.equal(answeredLookupResponse.status, 200);
  assert.equal(answeredLookup.answerState.sort, 'requested_question');
  assert.equal(answeredLookup.questions.length, 1);
  assert.equal(answeredLookup.questions[0].questionId, 'q-binary');
  assert.equal(answeredLookup.questions[0].answeredByUser, true);
  assert.match(answeredLookup.questions[0].answerStatus, /submit|direct/);
  assert.equal(answeredLookup.questions[0].myAnswer.requestId, submitted.submitted[0].requestId);
  assert.equal(answeredLookup.questions[0].myAnswer.questionType, 'binary');
  assert.equal(answeredLookup.questions[0].myAnswer.label, 'Unsure');
  assert.equal(answeredLookup.questions[0].myAnswer.value, 'unsure');
  assert.equal(answeredLookup.questions[0].myAnswer.status, answeredLookup.questions[0].answerStatus);
});

test('Agent credentials remain bound to their issued session across Telegram default flips', async () => {
  const env = multiTelegramOnlyEnv({ defaultSessionSlug: 'alpha', overrides: { AGENT_BRIDGE_AGENT_API_TOKEN: '' } });
  await env.AGENT_ACTION_KV.put('telegram:private-session:42', JSON.stringify({
    version: 1,
    telegramUserId: '42',
    sessionSlug: 'alpha',
    followDefault: true,
    selectedAt: '2026-06-01T12:00:00.000Z',
  }));
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
  assert.equal((await jsonBody(betaResponse)).sessionSlug, 'alpha');
});

test('Agent credentials remain bound to their issued session despite a Telegram pinned binding', async () => {
  const env = multiTelegramOnlyEnv({ defaultSessionSlug: 'alpha', overrides: { AGENT_BRIDGE_AGENT_API_TOKEN: '' } });
  await env.AGENT_ACTION_KV.put('telegram:private-session:42', JSON.stringify({
    version: 1,
    telegramUserId: '42',
    sessionSlug: 'gamma',
    followDefault: false,
    selectedAt: '2026-06-01T12:00:00.000Z',
  }));
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });

  env.AGENT_BRIDGE_SESSION_POLICY_JSON = multiTelegramOnlyEnv({ defaultSessionSlug: 'beta' }).AGENT_BRIDGE_SESSION_POLICY_JSON;
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', { token: issued.token }),
    env,
  });
  assert.equal((await jsonBody(response)).sessionSlug, 'alpha');
});

test('Agent credentials reject attempts to switch their issued session', async () => {
  const env = multiTelegramOnlyEnv({ defaultSessionSlug: 'alpha', overrides: { AGENT_BRIDGE_AGENT_API_TOKEN: '' } });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });

  const switched = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=gamma', { token: issued.token }),
    env,
  });
  const switchedBody = await jsonBody(switched);
  assert.equal(switched.status, 403);
  assert.equal(switchedBody.reason, 'agent_token_session_mismatch');
  assert.equal(switchedBody.sessionSlug, 'alpha');
  assert.equal(await env.AGENT_ACTION_KV.get('telegram:private-session:42'), null);

  env.AGENT_BRIDGE_SESSION_POLICY_JSON = multiTelegramOnlyEnv({ defaultSessionSlug: 'beta' }).AGENT_BRIDGE_SESSION_POLICY_JSON;
  const omitted = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', { token: issued.token }),
    env,
  });
  assert.equal((await jsonBody(omitted)).sessionSlug, 'alpha');
});

test('Agent credentials do not inherit legacy Telegram session bindings', async () => {
  const env = multiTelegramOnlyEnv({ defaultSessionSlug: 'alpha', overrides: { AGENT_BRIDGE_AGENT_API_TOKEN: '' } });
  await env.AGENT_ACTION_KV.put('telegram:private-session:42', JSON.stringify({
    version: 1,
    telegramUserId: '42',
    sessionSlug: 'beta',
    selectedAt: '2026-06-01T12:00:00.000Z',
  }));
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions', { token: issued.token }),
    env,
  });
  assert.equal((await jsonBody(response)).sessionSlug, 'alpha');
});

test('Telegram agent onboarding returns consent questions and persists first-run answers', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: '' });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
    'Can I use your Edge profile, interests, and calendar info to surface relevant CE questions?'
  );
  assert.equal(
    first.questions.find((question) => question.id === 'demographic_link_opt_in')?.prompt,
    'Can I use non-identifying Edge profile fields for research buckets: bio keywords, age bucket, country/region, role, and attendance week?'
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
        createdAt: '2026-06-01T12:05:00.000Z',
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
  assert.equal(saved.completedAt, '2026-06-01T12:05:00.000Z');
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
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
  assert.equal(body.skill, 'context-engine');
  assert.match(body.token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  const loaded = await loadTelegramAgentDelegationToken({ env, token: body.token });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.principal.adapterUserId, '42');
  assert.equal(loaded.record.sessionSlug, 'alpha');
  const binding = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:private-session:42'));
  assert.equal(binding.sessionSlug, 'alpha');
  assert.equal(binding.followDefault, true);

  const refreshedResponse = await handleTelegramAgentHandoffRequest({
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
  const refreshed = await jsonBody(refreshedResponse);
  const oldLoaded = await loadTelegramAgentDelegationToken({ env, token: body.token });
  const refreshedLoaded = await loadTelegramAgentDelegationToken({ env, token: refreshed.token });

  assert.equal(refreshedResponse.status, 200);
  assert.match(refreshed.token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.notEqual(refreshed.token, body.token);
  assert.equal(oldLoaded.ok, false);
  assert.equal(refreshedLoaded.ok, true);
  assert.equal(refreshedLoaded.record.principal.adapterUserId, '42');
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
        label: 'Session Lab',
        source: 'geo:session-topic',
      }]),
    },
  });
  const previous = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'old_user',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
  assert.equal(body.skill, 'context-engine');
  assert.equal(body.sessionSlug, 'beta');
  assert.equal(body.inviteLabel, 'Session Lab');
  assert.equal(body.inviteSource, 'geo:session-topic');
  assert.match(body.token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.equal(JSON.stringify(body).includes('geo-invite-secret'), false);
  const loaded = await loadTelegramAgentDelegationToken({ env, token: body.token });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.principal.adapterUserId, '42');
  assert.equal(Object.hasOwn(loaded.record.principal, 'label'), false);
  assert.equal(loaded.record.sessionSlug, 'beta');
  assert.equal((await loadTelegramAgentDelegationToken({ env, token: previous.token })).ok, true);
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
        topicPreferences: ['session lab'],
      }),
    }),
    env,
  });
  const onboarding = await jsonBody(onboardingResponse);
  assert.equal(onboardingResponse.status, 200);
  assert.equal(onboarding.ok, true);
  assert.equal(onboarding.sessionSlug, 'beta');
  assert.deepEqual(onboarding.settings.topicPreferences, ['session-lab']);
  assert.equal(JSON.stringify(onboarding).includes(body.token), false);
});

test('Invite onboarding creates a transport-neutral user credential and rejects persisted replay', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: '',
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITES_JSON: JSON.stringify([{
      tokenHash: sha256Hex('browser-invite-secret'),
      sessionSlug: 'alpha',
      label: 'Browser invite',
      source: 'browser',
    }]),
  });
  const onboardRequest = () => new Request('https://bridge.example/api/agent/invite/onboard', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      inviteToken: 'browser-invite-secret',
      label: 'Participant',
    }),
  });

  const response = await handleTelegramAgentHandoffRequest({ request: onboardRequest(), env });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.sessionSlug, 'alpha');
  assert.equal(body.principal.kind, 'user');
  assert.equal(body.principal.adapter, 'invite');
  assert.match(body.principal.principalId, /^cep_[A-Za-z0-9_-]+$/);
  assert.match(body.token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  const loaded = await loadTelegramAgentDelegationToken({ env, token: body.token });
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.record.principal, body.principal);
  assert.equal(Object.hasOwn(loaded.record.principal, 'adapterUserId'), false);
  const questionsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/api/agent/questions?sessionSlug=alpha&telegramUserId=attacker', {
      token: body.token,
    }),
    env,
  });
  assert.equal(questionsResponse.status, 200);

  const replayResponse = await handleTelegramAgentHandoffRequest({ request: onboardRequest(), env });
  const replay = await jsonBody(replayResponse);
  assert.equal(replayResponse.status, 409);
  assert.equal(replay.reason, 'invite_token_redeemed');
});

test('Root bootstrap mints a named scoped service credential', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: 'root-bootstrap-token' });
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/api/agent/credentials/service', {
      method: 'POST',
      token: 'root-bootstrap-token',
      body: {
        name: 'question-indexer',
        sessionSlug: 'alpha',
        scopes: [TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS],
      },
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.principal.kind, 'service');
  assert.equal(body.principal.label, 'question-indexer');
  assert.match(body.principal.principalId, /^cesvc_[A-Za-z0-9_-]+$/);
  assert.match(body.token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  const loaded = await loadTelegramAgentDelegationToken({ env, token: body.token });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.credentialKind, AGENT_CREDENTIAL_KINDS.SERVICE);
  assert.deepEqual(loaded.record.scopes, [TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS]);
  const questionsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/api/agent/questions?sessionSlug=alpha&telegramUserId=attacker', {
      token: body.token,
    }),
    env,
  });
  assert.equal(questionsResponse.status, 200);
  const mismatchResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/api/agent/questions?sessionSlug=beta', { token: body.token }),
    env,
  });
  assert.equal(mismatchResponse.status, 403);
  assert.equal((await jsonBody(mismatchResponse)).reason, 'agent_token_session_mismatch');
});

test('Credential issuance reports missing managed signer configuration', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: 'root-bootstrap-token',
    DEMO_SIGNER_ROOT_SECRET: '',
  });
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/api/agent/credentials/service', {
      method: 'POST',
      token: 'root-bootstrap-token',
      body: {
        name: 'question-indexer',
        sessionSlug: 'alpha',
        scopes: [TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS],
      },
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 503);
  assert.deepEqual(body, { ok: false, reason: 'managed_demo_signer_not_configured' });
});

test('Invite onboarding mode agent_only mints short scoped token without revoking normal token', async () => {
  const env = multiTelegramOnlyEnv({
    defaultSessionSlug: 'alpha',
    sessions: ['alpha'],
    overrides: {
      AGENT_BRIDGE_AGENT_API_TOKEN: '',
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_AGENT_ONLY_TOKEN_TTL_SECONDS: '604800',
      AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITES_JSON: JSON.stringify([{
        tokenHash: sha256Hex('agent-only-invite'),
        sessionSlug: 'alpha',
        label: 'Agent Only',
      }]),
    },
  });
  const previous = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'normal_user',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  const response = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/invite/onboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inviteToken: 'agent-only-invite',
        telegramUserId: '42',
        mode: 'agent_only',
      }),
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'agent_only');
  assert.equal(body.start, 'https://bridge.example/api/agent/agent-only/start');
  assert.equal(Object.hasOwn(body, 'onboarding'), false);
  const loaded = await loadTelegramAgentDelegationToken({ env, token: body.token });
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.record.scopes, [
    TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.AGENT_AUTOFILL,
  ]);
  assert.equal(loaded.record.scopes.includes(TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS), false);
  assert.equal(loaded.record.scopes.includes(TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.DRAFT_ANSWERS), false);
  assert.equal(Object.hasOwn(loaded.record.principal, 'label'), false);
  assert.equal(loaded.record.ttlSeconds, 604800);
  assert.equal((await loadTelegramAgentDelegationToken({ env, token: previous.token })).ok, true);
  const pointer = await readTelegramAgentOnlyTokenUserPointer({ env, telegramUserId: '42', sessionSlug: 'alpha' });
  assert.equal(pointer.tokenHash, loaded.tokenHash);
});

test('Session Wrapped invite onboarding mints wrapped agent-only credential metadata', async () => {
  const env = multiTelegramOnlyEnv({
    defaultSessionSlug: 'session-wrapped',
    sessions: ['session-wrapped'],
    overrides: {
      AGENT_BRIDGE_AGENT_API_TOKEN: '',
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_AGENT_ONLY_TOKEN_TTL_SECONDS: '604800',
      AGENT_BRIDGE_SESSION_WRAPPED_SKILL_URL: 'https://bridge.example/api/agent/session-wrapped/skill',
      AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITES_JSON: JSON.stringify([{
        tokenHash: sha256Hex('wrapped-demo-invite'),
        sessionSlug: 'session-wrapped',
        label: 'Session Wrapped',
      }]),
    },
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/invite/onboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inviteToken: 'wrapped-demo-invite',
        telegramUserId: '4242',
        mode: 'agent_only',
        skill: 'ce-session-wrapped',
        source: 'session-wrapped-forwarded-prompt',
      }),
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'agent_only');
  assert.equal(body.skill, 'ce-session-wrapped');
  assert.equal(body.skillUrl, 'https://bridge.example/api/agent/session-wrapped/skill');
  assert.equal(body.sessionSlug, 'session-wrapped');
  assert.equal(body.start, 'https://bridge.example/api/agent/agent-only/start');
  assert.equal(Object.hasOwn(body, 'onboarding'), false);
  const loaded = await loadTelegramAgentDelegationToken({ env, token: body.token });
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.record.scopes, [
    TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.AGENT_AUTOFILL,
  ]);
  assert.equal(loaded.record.sessionSlug, 'session-wrapped');
  assert.equal(Object.hasOwn(loaded.record.principal, 'label'), false);
  assert.equal(loaded.record.ttlSeconds, 604800);
  const pointer = await readTelegramAgentOnlyTokenUserPointer({
    env,
    telegramUserId: '4242',
    sessionSlug: 'session-wrapped',
  });
  assert.equal(pointer.tokenHash, loaded.tokenHash);
});

test('Agent-only invite tokens cannot apply normal sponsored question writes even for admins', async () => {
  const env = multiTelegramOnlyEnv({
    defaultSessionSlug: 'alpha',
    sessions: ['alpha'],
    overrides: {
      AGENT_BRIDGE_AGENT_API_TOKEN: '',
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_TRUSTED_ONBOARDING_INVITES_JSON: JSON.stringify([{
        tokenHash: sha256Hex('agent-only-admin-invite'),
        sessionSlug: 'alpha',
        label: 'Agent Only Admin',
      }]),
    },
  });
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = await managedAccountAddressForTelegramUser(env, '42');
  const onboardResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/invite/onboard', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inviteToken: 'agent-only-admin-invite',
        telegramUserId: '42',
        mode: 'agent_only',
      }),
    }),
    env,
  });
  const onboard = await jsonBody(onboardResponse);
  assert.equal(onboardResponse.status, 200);

  const applyResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-queue/apply?sessionSlug=alpha', {
      method: 'POST',
      token: onboard.token,
      body: {
        approved: true,
        draftQuestions: [{
          prompt: 'Should agent-only tokens manage sponsored questions?',
          questionType: 'binary',
        }],
      },
    }),
    env,
  });
  const denied = await jsonBody(applyResponse);
  const proposedKeys = Array.from(env.AGENT_ACTION_KV.store.keys())
    .filter((key) => String(key).startsWith('telegram:proposed-question:alpha:'));

  assert.equal(applyResponse.status, 403);
  assert.equal(denied.reason, 'agent_token_scope_denied');
  assert.equal(denied.requiredScope, TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS);
  assert.deepEqual(proposedKeys, []);
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

test('Agent-only routes require agent_autofill scope and serve flagged snapshot pages', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token',
    AGENT_BRIDGE_AGENT_ONLY_TEST_NOW: '2026-06-12T15:06:00.000Z',
  });
  const questionIds = await seedAgentOnlyProposedQuestions(env, 'alpha', 4);
  const configResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/config?sessionSlug=alpha', {
      method: 'POST',
      token: 'agent-test-token',
      body: {
        enabledQuestionIds: questionIds,
        evalTypesByQuestionId: { [questionIds[0]]: 'human_split' },
      },
    }),
    env,
  });
  assert.equal(configResponse.status, 200);
  assert.equal((await jsonBody(configResponse)).config.enabledQuestionIds.length, 4);

  const openResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/window/open?sessionSlug=alpha', {
      method: 'POST',
      token: 'agent-test-token',
      body: { createdAt: '2026-06-12T15:05:00.000Z' },
    }),
    env,
  });
  const opened = await jsonBody(openResponse);
  assert.equal(openResponse.status, 200);
  assert.equal(opened.windowId, 'w-2026-06-12');
  assert.equal(opened.statementCount, 4);

  const lateQuestion = await persistTelegramProposedQuestion({
    env,
    normalized: {
      user: { telegramUserId: '42' },
      chat: { chatId: '42' },
    },
    sessionSlug: 'alpha',
    prompt: 'Agent-only late route question?',
    questionType: 'binary',
    createdAt: '2026-06-12T15:09:00.000Z',
  });
  const extendConfigResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/config?sessionSlug=alpha', {
      method: 'POST',
      token: 'agent-test-token',
      body: {
        enabledQuestionIds: [...questionIds, lateQuestion.questionId],
      },
    }),
    env,
  });
  assert.equal(extendConfigResponse.status, 200);
  const extendOpenResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/window/open?sessionSlug=alpha', {
      method: 'POST',
      token: 'agent-test-token',
      body: { createdAt: '2026-06-12T15:10:00.000Z' },
    }),
    env,
  });
  const extendedOpen = await jsonBody(extendOpenResponse);
  assert.equal(extendOpenResponse.status, 200);
  assert.equal(extendedOpen.created, false);
  assert.equal(extendedOpen.extended, true);
  assert.equal(extendedOpen.addedStatementCount, 1);
  assert.equal(extendedOpen.statementCount, 5);

  for (const request of [
    agentRequest('/telegram/agent/api/agent-only/statements?sessionSlug=alpha', { token: '' }),
    agentRequest('/telegram/agent/api/agent-only/answers/bulk?sessionSlug=alpha', {
      method: 'POST',
      token: '',
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
        answers: [],
      },
    }),
    agentRequest('/telegram/agent/api/agent-only/token-votes/bulk?sessionSlug=alpha', {
      method: 'POST',
      token: '',
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        mode: 'linear',
        agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
        votes: [],
      },
    }),
    agentRequest('/telegram/agent/api/agent-only/wrapped-image?sessionSlug=alpha', {
      method: 'POST',
      token: '',
      body: { window_id: 'w-2026-06-12', run_id: 'route-run-1' },
    }),
  ]) {
    const unauthenticated = await handleTelegramAgentHandoffRequest({ request, env });
    assert.equal(unauthenticated.status, 401);
  }

  const normalToken = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'normal',
    sessionSlug: 'alpha',
    accountAddress: `0x${'34'.repeat(20)}`,
    createdAt: '2026-06-12T15:01:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  const deniedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/statements?sessionSlug=alpha&limit=2&createdAt=2026-06-12T15%3A06%3A00.000Z', {
      token: normalToken.token,
    }),
    env,
  });
  const denied = await jsonBody(deniedResponse);
  assert.equal(deniedResponse.status, 403);
  assert.equal(denied.requiredScope, TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.AGENT_AUTOFILL);

  const deniedImageResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/wrapped-image?sessionSlug=alpha', {
      method: 'POST',
      token: normalToken.token,
      body: { window_id: 'w-2026-06-12', run_id: 'route-run-1', createdAt: '2026-06-12T15:06:00.000Z' },
    }),
    env,
  });
  const deniedImage = await jsonBody(deniedImageResponse);
  assert.equal(deniedImageResponse.status, 403);
  assert.equal(deniedImage.requiredScope, TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.AGENT_AUTOFILL);

  const agentOnlyToken = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: '',
    sessionSlug: 'alpha',
    accountAddress: `0x${'34'.repeat(20)}`,
    scopes: [
      TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.AGENT_AUTOFILL,
    ],
    credentialKind: AGENT_CREDENTIAL_KINDS.AGENT_ONLY,
    createdAt: '2026-06-12T15:02:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  const agentOnlyReadToken = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '43',
    username: '',
    sessionSlug: 'alpha',
    accountAddress: `0x${'34'.repeat(20)}`,
    scopes: [
      TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.AGENT_AUTOFILL,
      TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS,
    ],
    credentialKind: AGENT_CREDENTIAL_KINDS.AGENT_ONLY,
    createdAt: '2026-06-12T15:02:30.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  const agentOnlyNormalRouteResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/question-queue/apply?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyReadToken.token,
      body: {
        telegramUserId: '42',
        proposals: [{ prompt: 'Agent-only tokens must not create normal questions.' }],
      },
    }),
    env,
  });
  const agentOnlyNormalRoute = await jsonBody(agentOnlyNormalRouteResponse);
  assert.equal(agentOnlyNormalRouteResponse.status, 403);
  assert.equal(agentOnlyNormalRoute.reason, 'agent_only_token_route_denied');

  const agentOnlySessionMismatchResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/statements?sessionSlug=beta&limit=2', {
      token: agentOnlyToken.token,
    }),
    env,
  });
  const agentOnlySessionMismatch = await jsonBody(agentOnlySessionMismatchResponse);
  assert.equal(agentOnlySessionMismatchResponse.status, 403);
  assert.equal(agentOnlySessionMismatch.reason, 'agent_token_session_mismatch');
  assert.equal(agentOnlySessionMismatch.sessionSlug, 'alpha');

  const statementsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/statements?sessionSlug=alpha&limit=2&createdAt=2026-06-12T15%3A06%3A00.000Z', {
      token: agentOnlyToken.token,
    }),
    env,
  });
  const statements = await jsonBody(statementsResponse);
  assert.equal(statementsResponse.status, 200);
  assert.equal(statements.window_id, 'w-2026-06-12');
  assert.equal(statements.statements.length, 2);
  assert.ok(statements.cursor);
  assert.equal(JSON.stringify(statements).includes('eval_type'), false);

  const compactStatementsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/statements?sessionSlug=alpha&limit=2&compact=1&createdAt=2026-06-12T15%3A06%3A00.000Z', {
      token: agentOnlyToken.token,
    }),
    env,
  });
  const compactStatements = await jsonBody(compactStatementsResponse);
  assert.equal(compactStatementsResponse.status, 200);
  assert.equal(compactStatements.window_id, 'w-2026-06-12');
  assert.equal(compactStatements.statements.length, 2);
  assert.ok(compactStatements.cursor);
  assert.deepEqual(Object.keys(compactStatements.statements[0]).sort(), [
    'answer_schema',
    'index',
    'question_type',
    'statement_id',
    'text',
  ]);
  assert.equal(compactStatements.statements[0].index, 0);
  assert.equal(typeof compactStatements.statements[0].text, 'string');
  assert.equal(typeof compactStatements.statements[0].answer_schema.kind, 'string');
  assert.equal(JSON.stringify(compactStatements).includes('eval_type'), false);
  assert.equal(Object.hasOwn(compactStatements.statements[0], 'window_id'), false);

  const clientClockResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/statements?sessionSlug=alpha&limit=2&createdAt=2026-06-15T15%3A30%3A00.000Z', {
      token: agentOnlyToken.token,
    }),
    env,
  });
  const clientClock = await jsonBody(clientClockResponse);
  assert.equal(clientClockResponse.status, 200);
  assert.equal(clientClock.window_id, 'w-2026-06-12');

  const staleAnswersResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/answers/bulk?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-15',
        run_id: 'route-run-1',
        createdAt: '2026-06-12T15:07:00.000Z',
        request_id: 'route-answers-stale',
        agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
        answers: [{
          statement_id: questionIds[0],
          answer: { value: 'agree' },
          confidence: 80,
        }],
      },
    }),
    env,
  });
  const staleAnswers = await jsonBody(staleAnswersResponse);
  assert.equal(staleAnswersResponse.status, 409);
  assert.equal(staleAnswers.reason, 'window_mismatch');

  const staleVotesResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/token-votes/bulk?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-15',
        run_id: 'route-run-1',
        createdAt: '2026-06-12T15:07:00.000Z',
        request_id: 'route-votes-stale',
        mode: 'linear',
        agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
        votes: [{ statement_id: questionIds[0], votes: 1 }],
      },
    }),
    env,
  });
  const staleVotes = await jsonBody(staleVotesResponse);
  assert.equal(staleVotesResponse.status, 409);
  assert.equal(staleVotes.reason, 'window_mismatch');

  const wrappedEmptyResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/wrapped-image?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        createdAt: '2026-06-12T15:06:30.000Z',
      },
    }),
    env,
    fetchImpl: async () => {
      throw new Error('OpenAI must not be called before any statement is covered');
    },
  });
  const wrappedEmpty = await jsonBody(wrappedEmptyResponse);
  assert.equal(wrappedEmptyResponse.status, 409);
  assert.equal(wrappedEmpty.reason, 'agent_only_wrapped_incomplete_predictions');
  assert.equal(wrappedEmpty.statement_count, 5);
  assert.equal(wrappedEmpty.agent_prediction_count, 0);
  assert.equal(wrappedEmpty.agent_response_count, 0);
  assert.equal(wrappedEmpty.privacy_skip_count, 0);
  assert.equal(wrappedEmpty.all_statements_predicted, false);
  assert.equal(wrappedEmpty.all_statements_covered, false);

  const answersResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/answers/bulk?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        createdAt: '2026-06-12T15:07:00.000Z',
        request_id: 'route-answers-1',
        agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
        answers: [{
          statement_id: questionIds[0],
          answer: { value: 'agree' },
          confidence: 80,
        }],
      },
    }),
    env,
  });
  const answers = await jsonBody(answersResponse);
  assert.equal(answersResponse.status, 200);
  assert.equal(answers.accepted, 1);

  env.AGENT_BRIDGE_OPENAI_API_KEY = 'sk-bridge-openai';
  const wrappedIncompleteResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/wrapped-image?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        createdAt: '2026-06-12T15:08:00.000Z',
      },
    }),
    env,
    fetchImpl: async () => {
      throw new Error('OpenAI must not be called before every statement is covered');
    },
  });
  const wrappedIncomplete = await jsonBody(wrappedIncompleteResponse);
  assert.equal(wrappedIncompleteResponse.status, 409);
  assert.equal(wrappedIncomplete.reason, 'agent_only_wrapped_incomplete_predictions');
  assert.equal(wrappedIncomplete.statement_count, 5);
  assert.equal(wrappedIncomplete.agent_prediction_count, 1);
  assert.equal(wrappedIncomplete.agent_response_count, 1);
  assert.equal(wrappedIncomplete.privacy_skip_count, 0);
  assert.equal(wrappedIncomplete.all_statements_predicted, false);
  assert.equal(wrappedIncomplete.all_statements_covered, false);
  delete env.AGENT_BRIDGE_OPENAI_API_KEY;

  const remainingAnswersResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/answers/bulk?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        createdAt: '2026-06-12T15:07:30.000Z',
        request_id: 'route-answers-2',
        agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
        answers: [
          {
            statement_id: questionIds[1],
            answer: { text: 'Use concise coordination updates.' },
            confidence: 70,
          },
          {
            statement_id: questionIds[2],
            answer: { value: 8 },
            confidence: 72,
          },
          {
            statement_id: questionIds[3],
            answer: { values: ['One'] },
            confidence: 74,
          },
          {
            statement_id: lateQuestion.questionId,
            skipped: true,
            skip_reason: 'privacy_protective',
          },
        ],
      },
    }),
    env,
  });
  const remainingAnswers = await jsonBody(remainingAnswersResponse);
  assert.equal(remainingAnswersResponse.status, 200);
  assert.equal(remainingAnswers.accepted, 4);
  assert.equal(remainingAnswers.skipsRecorded, 1);

  const wrappedMissingKeyResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/wrapped-image?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        createdAt: '2026-06-12T15:08:00.000Z',
      },
    }),
    env,
  });
  const wrappedMissingKey = await jsonBody(wrappedMissingKeyResponse);
  assert.equal(wrappedMissingKeyResponse.status, 503);
  assert.equal(wrappedMissingKey.reason, 'openai_key_missing');

  const votesResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/token-votes/bulk?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        createdAt: '2026-06-12T15:08:00.000Z',
        request_id: 'route-votes-1',
        mode: 'linear',
        agent_metadata: { model: 'unit-model', scaffold_version: 'unit-scaffold' },
        votes: [{ statement_id: questionIds[0], votes: 20 }],
      },
    }),
    env,
  });
  assert.equal(votesResponse.status, 200);
  env.AGENT_BRIDGE_OPENAI_API_KEY = 'sk-bridge-openai';
  env.AGENT_BRIDGE_PUBLIC_URL = 'https://bridge.example';
  let openAiRequestForm = null;
  const fakeImageFetch = async (url, init = {}) => {
    assert.equal(url, 'https://api.openai.com/v1/images/edits');
    assert.equal(init.headers.authorization, 'Bearer sk-bridge-openai');
    assert.equal(init.headers['content-type'], undefined);
    assert.equal(init.body instanceof FormData, true);
    openAiRequestForm = init.body;
    return new Response(JSON.stringify({
      data: [{ b64_json: Buffer.from('fake-png').toString('base64') }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const wrappedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/wrapped-image?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        createdAt: '2026-06-12T15:09:00.000Z',
        format: 'json_url',
        include_base64: false,
        include_prompt: true,
      },
    }),
    env,
    fetchImpl: fakeImageFetch,
  });
  const wrapped = await jsonBody(wrappedResponse);
  assert.equal(wrappedResponse.status, 200);
  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.window_id, 'w-2026-06-12');
  assert.equal(wrapped.run_id, 'route-run-1');
  assert.equal(wrapped.mode, 'wrapped');
  assert.equal(Number.isInteger(wrapped.statement_count), true);
  assert.equal(Number.isInteger(wrapped.agent_prediction_count), true);
  assert.equal(Number.isInteger(wrapped.agent_response_count), true);
  assert.equal(Number.isInteger(wrapped.privacy_skip_count), true);
  assert.equal(typeof wrapped.all_statements_predicted, 'boolean');
  assert.equal(typeof wrapped.all_statements_covered, 'boolean');
  assert.equal(wrapped.statement_count, 5);
  assert.equal(wrapped.agent_prediction_count, 4);
  assert.equal(wrapped.agent_response_count, 5);
  assert.equal(wrapped.privacy_skip_count, 1);
  assert.equal(wrapped.all_statements_predicted, false);
  assert.equal(wrapped.all_statements_covered, true);
  assert.equal(wrapped.model, 'gpt-image-2');
  assert.equal(wrapped.size, '2048x1152');
  assert.equal(wrapped.reference_image, 'session-lab-logo-reference.png');
  assert.equal(Object.hasOwn(wrapped, 'image_base64'), false);
  assert.equal(wrapped.image_saved, true);
  assert.match(wrapped.image_id, /^\d{13}-[0-9a-f]{8}$/);
  assert.match(wrapped.image_view_id, /^[0-9a-f]{32}$/);
  assert.equal(wrapped.image_url, `https://bridge.example/api/agent/agent-only/wrapped-image/view/${wrapped.image_view_id}`);
  assert.match(wrapped.image_prompt_hash, /^sha256:[0-9a-f]{32}$/);
  assert.equal(Object.hasOwn(wrapped, 'prompt'), false);
  assert.equal(typeof openAiRequestForm.get('prompt'), 'string');
  assert.equal(openAiRequestForm.get('model'), 'gpt-image-2');
  assert.equal(openAiRequestForm.get('output_format'), 'png');
  const logoReference = openAiRequestForm.get('image');
  assert.equal(logoReference?.name, 'session-lab-logo-reference.png');
  assert.equal(logoReference?.type, 'image/png');
  assert.equal(logoReference?.size > 100_000, true);
  const wrappedPrompt = openAiRequestForm.get('prompt');
  assert.match(wrappedPrompt, /Do not number the visible sections/);
  assert.match(wrappedPrompt, /Questions your agent thought you would care about most/);
  assert.match(wrappedPrompt, /Every visible word and sentence must be complete/);
  assert.match(wrappedPrompt, /Hero text fit rule/);
  assert.match(wrappedPrompt, /compact top-left "Session Lab" wordmark/);
  assert.match(wrappedPrompt, /attached Session Lab logo image as the style reference/);
  assert.match(wrappedPrompt, /lay "SESSION" and "LAB" side-by-side/);
  assert.match(wrappedPrompt, /contextengine\.xyz/);
  assert.doesNotMatch(wrappedPrompt, /Review or edit your agent's responses in Context Engine/);
  assert.doesNotMatch(wrappedPrompt, /What Your Agent Upvoted/);

  const wrappedDefaultResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/wrapped-image?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        createdAt: '2026-06-12T15:09:15.000Z',
      },
    }),
    env,
    fetchImpl: fakeImageFetch,
  });
  const wrappedDefault = await jsonBody(wrappedDefaultResponse);
  assert.equal(wrappedDefaultResponse.status, 200);
  assert.equal(wrappedDefault.ok, true);
  assert.equal(Object.hasOwn(wrappedDefault, 'image_base64'), false);
  assert.equal(typeof wrappedDefault.image_url, 'string');
  assert.equal(Object.hasOwn(wrappedDefault, 'prompt'), false);

  const wrappedBase64Response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/wrapped-image?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        createdAt: '2026-06-12T15:09:30.000Z',
        include_base64: true,
      },
    }),
    env,
    fetchImpl: fakeImageFetch,
  });
  const wrappedBase64 = await jsonBody(wrappedBase64Response);
  assert.equal(wrappedBase64Response.status, 200);
  assert.equal(wrappedBase64.ok, true);
  assert.equal(wrappedBase64.image_base64, Buffer.from('fake-png').toString('base64'));
  assert.equal(typeof wrappedBase64.image_url, 'string');
  assert.equal(Object.hasOwn(wrappedBase64, 'prompt'), false);

  const wrappedPngResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/wrapped-image?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        createdAt: '2026-06-12T15:09:45.000Z',
        format: 'png',
      },
    }),
    env,
    fetchImpl: fakeImageFetch,
  });
  assert.equal(wrappedPngResponse.status, 200);
  assert.equal(wrappedPngResponse.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await wrappedPngResponse.arrayBuffer()).toString(), 'fake-png');

  const imageViewResponse = await handleTelegramAgentHandoffRequest({
    request: new Request(wrapped.image_url),
    env,
  });
  assert.equal(imageViewResponse.status, 200);
  assert.equal(imageViewResponse.headers.get('content-type'), 'image/png');
  assert.equal(imageViewResponse.headers.get('content-disposition'), 'inline; filename="session-wrapped.png"');
  assert.equal(Buffer.from(await imageViewResponse.arrayBuffer()).toString(), 'fake-png');

  const imageViewHeadResponse = await handleTelegramAgentHandoffRequest({
    request: new Request(wrapped.image_url, { method: 'HEAD' }),
    env,
  });
  assert.equal(imageViewHeadResponse.status, 200);
  assert.equal(imageViewHeadResponse.headers.get('content-type'), 'image/png');
  assert.equal((await imageViewHeadResponse.text()), '');

  const missingImageViewResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/agent-only/wrapped-image/view/not-real'),
    env,
  });
  const missingImageView = await jsonBody(missingImageViewResponse);
  assert.equal(missingImageViewResponse.status, 404);
  assert.equal(missingImageView.reason, 'wrapped_image_not_found');

  const imageExportResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/export?sessionSlug=alpha&view=images&format=jsonl', {
      token: 'agent-test-token',
    }),
    env,
  });
  const imageExportText = await imageExportResponse.text();
  assert.equal(imageExportResponse.status, 200);
  const imageRows = imageExportText.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const wrappedImageRow = imageRows.find((row) => row.image_id === wrapped.image_id);
  assert.ok(wrappedImageRow);
  assert.equal(wrappedImageRow.image_view_id, wrapped.image_view_id);
  assert.equal(wrappedImageRow.run_id, 'route-run-1');
  assert.equal(wrappedImageRow.mode, 'wrapped');
  assert.equal(Object.hasOwn(wrappedImageRow, 'image_base64'), false);
  assert.equal(wrappedImageRow.prompt_hash, wrapped.image_prompt_hash);
  assert.equal(wrappedImageRow.principal_id.startsWith('cep_'), true);
  assert.equal(JSON.stringify(imageRows).includes('telegramUserId'), false);

  const imageExportWithBase64Response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/export?sessionSlug=alpha&view=images&format=jsonl&include_base64=true', {
      token: 'agent-test-token',
    }),
    env,
  });
  const imageRowsWithBase64 = (await imageExportWithBase64Response.text()).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(imageExportWithBase64Response.status, 200);
  const wrappedImageRowWithBase64 = imageRowsWithBase64.find((row) => row.image_id === wrapped.image_id);
  assert.equal(wrappedImageRowWithBase64.image_base64, Buffer.from('fake-png').toString('base64'));

  const attemptExportResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/export?sessionSlug=alpha&view=attempts&format=jsonl', {
      token: 'agent-test-token',
    }),
    env,
  });
  const attemptRows = (await attemptExportResponse.text()).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(attemptExportResponse.status, 200);
  assert.equal(attemptRows.some((row) => (
    row.stage === 'answers_bulk' &&
    row.ok === true &&
    row.status === 200 &&
    row.accepted === 1 &&
    row.request_id === 'route-answers-1'
  )), true);
  assert.equal(attemptRows.some((row) => (
    row.stage === 'answers_bulk' &&
    row.ok === false &&
    row.status === 409 &&
    row.reason === 'window_mismatch' &&
    row.request_id === 'route-answers-stale'
  )), true);
  assert.equal(attemptRows.some((row) => (
    row.stage === 'token_votes_bulk' &&
    row.ok === true &&
    row.status === 200 &&
    row.budget_used === 20 &&
    row.request_id === 'route-votes-1'
  )), true);
  assert.equal(attemptRows.some((row) => (
    row.stage === 'wrapped_image' &&
    row.ok === false &&
    row.status === 409 &&
    row.reason === 'agent_only_wrapped_incomplete_predictions' &&
    row.statement_count === 5 &&
    row.agent_response_count === 0
  )), true);
  assert.equal(attemptRows.some((row) => (
    row.stage === 'wrapped_image' &&
    row.ok === false &&
    row.status === 503 &&
    row.reason === 'openai_key_missing' &&
    row.agent_response_count === 5
  )), true);
  assert.equal(attemptRows.some((row) => (
    row.stage === 'wrapped_image' &&
    row.ok === true &&
    row.status === 200 &&
    row.run_id === 'route-run-1' &&
    row.mode === 'wrapped' &&
    row.agent_response_count === 5 &&
    row.privacy_skip_count === 1
  )), true);
  assert.equal(attemptRows.every((row) => row.principal_id.startsWith('cep_')), true);
  assert.equal(JSON.stringify(attemptRows).includes('telegramUserId'), false);
  assert.equal(JSON.stringify(attemptRows).includes(agentOnlyToken.token), false);

  const unavailableStoryResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/wrapped-image?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        mode: 'wrapped_story',
        createdAt: '2026-06-12T15:09:30.000Z',
      },
    }),
    env,
    fetchImpl: async () => {
      throw new Error('story video unavailable path must not call OpenAI');
    },
  });
  const unavailableStory = await jsonBody(unavailableStoryResponse);
  assert.equal(unavailableStoryResponse.status, 501);
  assert.equal(unavailableStory.ok, false);
  assert.equal(unavailableStory.reason, 'wrapped_story_mp4_unavailable');

  let storyAttempts = 0;
  const storyPrompts = [];
  const storyResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/wrapped-image?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        mode: 'wrapped_story',
        media_kind: 'animated_svg_storyboard',
        createdAt: '2026-06-12T15:09:30.000Z',
      },
    }),
    env,
    fetchImpl: async (url, init = {}) => {
      assert.equal(url, 'https://api.openai.com/v1/images/edits');
      assert.equal(init.headers.authorization, 'Bearer sk-bridge-openai');
      assert.equal(init.body instanceof FormData, true);
      storyAttempts += 1;
      storyPrompts.push(init.body.get('prompt'));
      assert.equal(init.body.get('size'), '3240x1152');
      return new Response(JSON.stringify({
        data: [{ b64_json: Buffer.from(`fake-story-frame-${storyAttempts}`).toString('base64') }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const story = await jsonBody(storyResponse);
  assert.equal(storyResponse.status, 200);
  assert.equal(story.ok, true);
  assert.equal(story.mode, 'wrapped_story');
  assert.equal(story.media_kind, 'animated_svg_storyboard');
  assert.equal(story.image_content_type, 'image/svg+xml');
  assert.equal(story.frame_count, 5);
  assert.equal(story.story_duration_seconds, 20);
  assert.equal(story.story_frame_seconds, 4);
  assert.deepEqual(story.frame_keys, ['summary', 'token_use', 'predictions', 'agent_guesses', 'comparison']);
  assert.equal(story.story_source, 'single_storyboard');
  assert.equal(storyAttempts, 1);
  assert.equal(storyPrompts.length, 1);
  assert.match(storyPrompts[0], /requested canvas is 3240x1152: exactly five 648x1152 vertical phone panels/);
  assert.match(storyPrompts[0], /natural 9:16 frame/);
  assert.match(storyPrompts[0], /exactly five 648x1152 vertical phone panels side by side/);
  assert.match(storyPrompts[0], /Panel 1: "What your agent thinks it knows about you"/);
  assert.match(storyPrompts[0], /Panel 5: "Agent comparison"/);
  assert.equal(Object.hasOwn(story, 'image_base64'), false);

  const storyImageViewResponse = await handleTelegramAgentHandoffRequest({
    request: new Request(story.image_url),
    env,
  });
  assert.equal(storyImageViewResponse.status, 200);
  assert.equal(storyImageViewResponse.headers.get('content-type'), 'image/svg+xml');
  assert.equal(storyImageViewResponse.headers.get('content-disposition'), 'inline; filename="session-wrapped.svg"');
  const storySvg = Buffer.from(await storyImageViewResponse.arrayBuffer()).toString();
  assert.match(storySvg, /<svg/);
  assert.match(storySvg, /Session Wrapped phone story/);
  assert.match(storySvg, /data:image\/png;base64/);
  assert.match(storySvg, new RegExp(Buffer.from('fake-story-frame-1').toString('base64')));
  assert.match(storySvg, /dur="20s"/);

  const storyExportResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/export?sessionSlug=alpha&view=images&format=jsonl', {
      token: 'agent-test-token',
    }),
    env,
  });
  const storyExportRows = (await storyExportResponse.text()).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(storyExportResponse.status, 200);
  const storyExportRow = storyExportRows.find((row) => row.mode === 'wrapped_story');
  assert.equal(storyExportRow.image_id, story.image_id);
  assert.equal(storyExportRow.media_kind, 'animated_svg_storyboard');
  assert.equal(storyExportRow.frame_count, 5);
  assert.equal(storyExportRow.story_duration_seconds, 20);
  assert.equal(storyExportRow.frame_keys, 'summary,token_use,predictions,agent_guesses,comparison');

  let compassAttempts = 0;
  const compassPrompts = [];
  const compassResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/agent-only/wrapped-image?sessionSlug=alpha', {
      method: 'POST',
      token: agentOnlyToken.token,
      body: {
        window_id: 'w-2026-06-12',
        run_id: 'route-run-1',
        mode: 'political_compass',
        style_hint: 'make it a partisan election poster',
        createdAt: '2026-06-12T15:10:00.000Z',
      },
    }),
    env,
    fetchImpl: async (url, init = {}) => {
      assert.equal(url, 'https://api.openai.com/v1/images/edits');
      compassAttempts += 1;
      compassPrompts.push(init.body.get('prompt'));
      if (compassAttempts === 1) {
        return new Response(JSON.stringify({
          error: { code: 'content_policy_violation', message: 'moderation_blocked' },
        }), { status: 400, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({
        data: [{ b64_json: Buffer.from('fake-compass').toString('base64') }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  const compass = await jsonBody(compassResponse);
  assert.equal(compassResponse.status, 200);
  assert.equal(compass.ok, true);
  assert.equal(compass.mode, 'political_compass');
  assert.equal(compass.image_safety_retried, true);
  assert.equal(compassAttempts, 2);
  assert.match(compassPrompts[0], /Session Lab Norms Compass poster/);
  assert.match(compassPrompts[0], /partisan election poster/);
  assert.match(compassPrompts[1], /Session Lab Norms Map/);
  assert.match(compassPrompts[1], /neutral product-research language/);
  assert.doesNotMatch(compassPrompts[1], /partisan election poster/);
  assert.equal(Object.hasOwn(compass, 'image_base64'), false);
  assert.match(compass.image_url, /\/api\/agent\/agent-only\/wrapped-image\/view\//);
  const compassImageViewResponse = await handleTelegramAgentHandoffRequest({
    request: new Request(compass.image_url),
    env,
  });
  assert.equal(compassImageViewResponse.status, 200);
  assert.equal(compassImageViewResponse.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await compassImageViewResponse.arrayBuffer()).toString(), 'fake-compass');

  const metricsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/export?sessionSlug=alpha&view=answers&format=jsonl', {
      token: 'agent-test-token',
    }),
    env,
  });
  const exported = await metricsResponse.text();
  assert.equal(metricsResponse.status, 200);
  assert.equal(exported.includes('cep_'), true);
  assert.equal(exported.includes('telegramUserId'), false);
  assert.equal(exported.includes('42'), false);

  const pagedMetricsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/export?sessionSlug=alpha&view=answers&format=jsonl&limit=1', {
      token: 'agent-test-token',
    }),
    env,
  });
  const pagedExported = await pagedMetricsResponse.text();
  assert.equal(pagedMetricsResponse.status, 200);
  assert.equal(pagedMetricsResponse.headers.get('x-agent-only-row-count'), '1');
  assert.equal(Boolean(pagedMetricsResponse.headers.get('x-agent-only-next-cursor')), true);
  assert.equal(pagedExported.trim().split('\n').filter(Boolean).length, 1);
});

test('Agent-only admin routes accept session admin delegation tokens and reject non-admin tokens', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token' });
  const questionIds = await seedAgentOnlyProposedQuestions(env, 'alpha', 2);
  const adminAddress = await managedAccountAddressForTelegramUser(env, '42');
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = adminAddress;
  const nonAdmin = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '43',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'34'.repeat(20)}`,
    scopes: [
      TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS,
    ],
    createdAt: '2026-06-12T15:02:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  const admin = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'host',
    sessionSlug: 'alpha',
    accountAddress: adminAddress,
    scopes: [
      TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS,
    ],
    createdAt: '2026-06-12T15:02:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  const agentOnly = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: '',
    sessionSlug: 'alpha',
    accountAddress: adminAddress,
    scopes: [
      TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.AGENT_AUTOFILL,
    ],
    credentialKind: AGENT_CREDENTIAL_KINDS.AGENT_ONLY,
    createdAt: '2026-06-12T15:02:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  const nonAdminResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/config?sessionSlug=alpha', {
      token: nonAdmin.token,
    }),
    env,
  });
  const missingScopeResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/config?sessionSlug=alpha', {
      token: agentOnly.token,
    }),
    env,
  });
  const adminResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/config?sessionSlug=alpha', {
      method: 'POST',
      token: admin.token,
      body: {
        enabledQuestionIds: questionIds,
        evalTypesByQuestionId: { [questionIds[0]]: 'human_split' },
      },
    }),
    env,
  });
  const adminBody = await jsonBody(adminResponse);
  const openResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/window/open?sessionSlug=alpha', {
      method: 'POST',
      token: admin.token,
      body: { createdAt: '2026-06-12T15:05:00.000Z' },
    }),
    env,
  });

  assert.equal(nonAdminResponse.status, 403);
  assert.notEqual((await jsonBody(nonAdminResponse)).reason, 'agent_only_admin_service_token_required');
  assert.equal(missingScopeResponse.status, 403);
  assert.equal((await jsonBody(missingScopeResponse)).requiredScope, TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS);
  assert.equal(adminResponse.status, 200, JSON.stringify(adminBody));
  assert.deepEqual(adminBody.config.enabledQuestionIds, questionIds);
  assert.equal(openResponse.status, 200);
  assert.equal((await jsonBody(openResponse)).statementCount, 2);
});

test('Telegram admin proposed-question delete route accepts service tokens and session admin tokens', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token' });
  const adminAddress = await managedAccountAddressForTelegramUser(env, '42');
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = adminAddress;
  const serviceResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/questions/delete', {
      method: 'POST',
      token: 'agent-test-token',
      body: {
        sessionSlug: 'alpha',
        questionId: 'ceq_missing_auth',
      },
    }),
    env,
  });
  const service = await jsonBody(serviceResponse);
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '43',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'34'.repeat(20)}`,
    scopes: [
      TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS,
    ],
    createdAt: '2026-06-12T15:02:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  const adminIssued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'admin',
    sessionSlug: 'alpha',
    accountAddress: adminAddress,
    scopes: [
      TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS,
    ],
    createdAt: '2026-06-12T15:02:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  const adminDelegatedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/questions/delete', {
      method: 'POST',
      token: adminIssued.token,
      body: {
        sessionSlug: 'alpha',
        questionId: 'ceq_missing_admin',
      },
    }),
    env,
  });
  const delegatedNonAdminResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/questions/delete', {
      method: 'POST',
      token: issued.token,
      body: {
        sessionSlug: 'alpha',
        questionId: 'ceq_missing_auth',
      },
    }),
    env,
  });
  const missingResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/questions/delete', {
      method: 'POST',
      token: '',
      body: {
        sessionSlug: 'alpha',
        questionId: 'ceq_missing_auth',
      },
    }),
    env,
  });

  assert.equal(serviceResponse.status, 200);
  assert.equal(service.ok, true);
  assert.deepEqual(service.results, [{ questionId: 'ceq_missing_auth', result: 'not_found' }]);
  assert.equal(adminDelegatedResponse.status, 200);
  assert.deepEqual((await jsonBody(adminDelegatedResponse)).results, [{ questionId: 'ceq_missing_admin', result: 'not_found' }]);
  assert.equal(delegatedNonAdminResponse.status, 403);
  assert.equal((await jsonBody(delegatedNonAdminResponse)).reason, 'response_export_admin_required');
  assert.equal(missingResponse.status, 401);
  assert.equal((await jsonBody(missingResponse)).reason, 'agent_api_token_invalid');
});

test('Telegram admin can archive proposed questions without mutating existing agent-only snapshots', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token',
  });
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-06-12T15:00:00.000Z',
  });
  const [archivedId, keptId] = await seedAgentOnlyProposedQuestions(env, 'alpha', 2);
  const configResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/config?sessionSlug=alpha', {
      method: 'POST',
      token: 'agent-test-token',
      body: {
        createdAt: '2026-06-12T15:01:00.000Z',
        enabledQuestionIds: [archivedId, keptId],
        evalTypesByQuestionId: {
          [archivedId]: 'human_split',
          [keptId]: 'gold',
        },
        windowing: {
          timezone: 'America/Los_Angeles',
          launchOpensAt: '2026-06-12T08:00:00-07:00',
          launchClosesAt: '2026-06-15T08:00:00-07:00',
          regularBoundaryWeekday: 'monday',
          regularBoundaryHour: 9,
        },
      },
    }),
    env,
  });
  const beforeConfig = (await jsonBody(configResponse)).config;
  const openResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/window/open?sessionSlug=alpha', {
      method: 'POST',
      token: 'agent-test-token',
      body: { createdAt: '2026-06-12T15:05:00.000Z' },
    }),
    env,
  });
  assert.equal(openResponse.status, 200);
  const snapshotKey = `${AGENT_ONLY_WINDOW_KV_PREFIX}alpha:w-2026-06-12`;
  const snapshotBefore = env.AGENT_ACTION_KV.store.get(snapshotKey);
  const archiveResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/questions/delete', {
      method: 'POST',
      token: 'agent-test-token',
      body: {
        sessionSlug: 'alpha',
        questionId: archivedId,
        mode: 'archive',
        createdAt: '2026-06-12T15:10:00.000Z',
      },
    }),
    env,
  });
  const archive = await jsonBody(archiveResponse);
  const questionsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha&telegramUserId=42&groupChatId=-100123', {
      token: 'agent-test-token',
    }),
    env,
  });
  const questions = await jsonBody(questionsResponse);
  const afterConfigResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/config?sessionSlug=alpha', {
      token: 'agent-test-token',
    }),
    env,
  });
  const afterConfig = (await jsonBody(afterConfigResponse)).config;

  assert.equal(archiveResponse.status, 200);
  assert.deepEqual(archive.results, [{ questionId: archivedId, result: 'archived' }]);
  assert.equal(archive.configUpdated, true);
  assert.equal(questionsResponse.status, 200, JSON.stringify(questions));
  assert.equal(questions.questions.some((question) => question.questionId === archivedId), false);
  assert.equal(questions.questions.some((question) => question.questionId === keptId), true);
  assert.deepEqual(afterConfig.enabledQuestionIds, [keptId]);
  assert.equal(Object.hasOwn(afterConfig.evalTypesByQuestionId, archivedId), false);
  assert.equal(afterConfig.evalTypesByQuestionId[keptId], 'gold');
  assert.equal(afterConfig.createdAt, beforeConfig.createdAt);
  assert.deepEqual(afterConfig.windowing, beforeConfig.windowing);
  assert.equal(env.AGENT_ACTION_KV.store.get(snapshotKey), snapshotBefore);
});

test('Telegram admin can delete proposed questions and remove them from agent-only config', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token' });
  const [questionId] = await seedAgentOnlyProposedQuestions(env, 'alpha', 1);
  const questionKey = Array.from(env.AGENT_ACTION_KV.store.keys())
    .find((key) => key.startsWith('telegram:proposed-question:alpha:') && key.endsWith(`:${questionId}`));
  await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/config?sessionSlug=alpha', {
      method: 'POST',
      token: 'agent-test-token',
      body: { enabledQuestionIds: [questionId] },
    }),
    env,
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/questions/delete', {
      method: 'POST',
      token: 'agent-test-token',
      body: {
        sessionSlug: 'alpha',
        questionId,
        mode: 'delete',
      },
    }),
    env,
  });
  const body = await jsonBody(response);
  const configResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/agent-only/config?sessionSlug=alpha', {
      token: 'agent-test-token',
    }),
    env,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(body.results, [{ questionId, result: 'deleted' }]);
  assert.equal(env.AGENT_ACTION_KV.store.has(questionKey), false);
  assert.deepEqual((await jsonBody(configResponse)).config.enabledQuestionIds, []);
});

test('Telegram admin proposed-question delete batches continue across missing ids', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token' });
  const [questionId] = await seedAgentOnlyProposedQuestions(env, 'alpha', 1);
  const missingId = 'ceq_unknown_batch';
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/questions/delete', {
      method: 'POST',
      token: 'agent-test-token',
      body: {
        sessionSlug: 'alpha',
        questionIds: [missingId, questionId],
        mode: 'archive',
      },
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.results, [
    { questionId: missingId, result: 'not_found' },
    { questionId, result: 'archived' },
  ]);
});

test('Telegram admin proposed-question delete skips non-ceq ids before KV reads', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token' });
  env.AGENT_ACTION_KV.resetGetCalls();
  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/questions/delete', {
      method: 'POST',
      token: 'agent-test-token',
      body: {
        sessionSlug: 'alpha',
        questionId: 'q-not-proposed',
        mode: 'archive',
      },
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.deepEqual(body.results, [{ questionId: 'q-not-proposed', result: 'not_proposed' }]);
  assert.equal(env.AGENT_ACTION_KV.getCalls, 0);
});

test('Telegram admin archive does not create an agent-only config record when none exists', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token' });
  const [questionId] = await seedAgentOnlyProposedQuestions(env, 'alpha', 1);
  const configKey = `${AGENT_ONLY_MODE_CONFIG_KV_PREFIX}alpha`;
  assert.equal(env.AGENT_ACTION_KV.store.has(configKey), false);

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/questions/delete', {
      method: 'POST',
      token: 'agent-test-token',
      body: {
        sessionSlug: 'alpha',
        questionId,
        mode: 'archive',
      },
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.deepEqual(body.results, [{ questionId, result: 'archived' }]);
  assert.equal(body.configUpdated, false);
  assert.equal(env.AGENT_ACTION_KV.store.has(configKey), false);
});

test('Telegram bot copied agent token authenticates against handoff questions', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example' });
  const command = await buildTelegramCommandResponse({
    update: {
      update_id: 9101,
      message: {
        message_id: 41,
        text: '/start agent_onboarding__alpha',
        chat: { id: 42, type: 'private' },
        from: { id: 42, username: 'host' },
      },
    },
    env,
  });
  const buttons = command.response?.replyMarkup?.inline_keyboard?.flat?.() || [];
  const copyInfo = buttons.find((button) => button.text === 'Copy Agent Info')?.copy_text?.text || '';
  const token = copyInfo.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/questions?sessionSlug=alpha&limit=1', {
      token,
    }),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(command.screen, 'agent_token');
  assert.match(copyInfo, /^Bearer; GET \/api\/agent\/questions; ask answer/);
  assert.match(copyInfo, /\nworker=https:\/\/bridge\.example/);
  assert.match(token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.ok, true);
  assert.equal(Array.isArray(body.questions), true);
  assert.equal(command.response.text.includes(token), false);
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
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
  assert.equal(body.bridgeCredential.kind, 'agent_bridge_browser_token');
  assert.match(body.bridgeCredential.token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.equal(body.workerCredential.kind, 'session_worker_jwt');
  assert.equal(body.workerCredential.token, 'worker-jwt-1');
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

test('client login derives the worker wallet from a Telegram-optional service principal', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: 'root-bootstrap-token',
    AGENT_BRIDGE_SESSION_WORKER_URL: 'https://session-worker.example',
    AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS: 'https://client.example',
  });
  const bootstrapResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/api/agent/credentials/service', {
      method: 'POST',
      token: 'root-bootstrap-token',
      body: {
        name: 'group-reader',
        sessionSlug: 'alpha',
        scopes: [TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_GROUPS],
      },
    }),
    env,
  });
  const bootstrap = await jsonBody(bootstrapResponse);
  assert.equal(bootstrapResponse.status, 200);
  assert.equal(bootstrap.principal.kind, 'service');

  const response = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/client-login/exchange', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://client.example',
      },
      body: JSON.stringify({ sessionSlug: 'alpha', token: bootstrap.token }),
    }),
    env,
    fetchImpl: async (url) => {
      if (String(url).endsWith('/auth/nonce')) {
        return new Response(JSON.stringify({ nonce: 'service-nonce' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).endsWith('/auth/login')) {
        return new Response(JSON.stringify({ token: 'service-worker-jwt', exp: 1780003600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    },
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.accountAddress, bootstrap.accountAddress);
  assert.equal(body.workerCredential.token, 'service-worker-jwt');
  assert.equal(body.capabilities.readGroups, true);
});

test('client login returns audience-correct credentials and the Bridge credential reads questions', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_SESSION_WORKER_URL: 'https://session-worker.example',
    AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS: 'https://client.example',
  });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'host',
    sessionSlug: 'alpha',
    accountAddress: await managedAccountAddressForTelegramUser(env, '42'),
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  const fetchImpl = async (url) => {
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

  const exchangeResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/client-login/exchange', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://client.example',
      },
      body: JSON.stringify({ sessionSlug: 'alpha', token: issued.token }),
    }),
    env,
    fetchImpl,
  });
  const exchange = await jsonBody(exchangeResponse);

  assert.equal(exchangeResponse.status, 200);
  assert.equal(exchange.bridgeCredential.kind, 'agent_bridge_browser_token');
  assert.match(exchange.bridgeCredential.token, /^ceagt_/);
  assert.notEqual(exchange.bridgeCredential.token, issued.token);
  assert.equal(exchange.workerCredential.kind, 'session_worker_jwt');
  assert.equal(exchange.workerCredential.token, 'worker-jwt-1');
  assert.equal(exchange.capabilities.readQuestions, true);
  assert.equal(exchange.capabilities.readResults, true);
  assert.equal(exchange.capabilities.admin, false);
  assert.equal(exchange.capabilities.export, false);

  const questionsResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/api/agent/questions?sessionSlug=alpha', {
      token: exchange.bridgeCredential.token,
    }),
    env,
  });
  const questions = await jsonBody(questionsResponse);
  assert.equal(questionsResponse.status, 200);
  assert.equal(questions.ok, true);
  assert.equal(questions.sessionSlug, 'alpha');
  assert.equal(Array.isArray(questions.questions), true);

  const nestedExchangeResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/client-login/exchange', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://client.example',
      },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        token: exchange.bridgeCredential.token,
      }),
    }),
    env,
    fetchImpl,
  });
  const nestedExchange = await jsonBody(nestedExchangeResponse);

  assert.equal(nestedExchangeResponse.status, 403);
  assert.equal(nestedExchange.reason, 'agent_credential_exchange_denied');
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
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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

test('Telegram client login exchange ignores raw tokens in URL query parameters', async () => {
  const env = telegramOnlyEnv({ AGENT_BRIDGE_SESSION_WORKER_URL: 'https://session-worker.example' });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'host',
    sessionSlug: 'alpha',
    accountAddress: `0x${'12'.repeat(20)}`,
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: new Request(`https://bridge.example/telegram/agent/api/client-login/exchange?token=${issued.token}&agentToken=${issued.token}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionSlug: 'alpha' }),
    }),
    env,
    fetchImpl: async () => {
      throw new Error('query token must not reach worker auth');
    },
  });

  assert.equal(response.status, 401);
  assert.equal((await jsonBody(response)).reason, 'agent_token_missing');
});

test('Telegram session-meta reports telegram-only status without auth', async () => {
  const env = telegramOnlyEnv();
  let kvReads = 0;
  env.AGENT_ACTION_KV = {
    async get() {
      kvReads += 1;
      throw new Error('session-meta should not read KV when configured policy is present');
    },
    async list() {
      kvReads += 1;
      throw new Error('session-meta should not list KV when configured policy is present');
    },
  };
  const response = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/session-meta?sessionSlug=alpha', {
      headers: { origin: 'https://client.example' },
    }),
    env,
  });
  const body = await jsonBody(response);
  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    ok: true,
    sessionSlug: 'alpha',
    telegramOnly: true,
    telegramBridgeEnabled: true,
    clientSubmitReady: true,
  });
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(response.headers.get('vary'), 'Origin');
  assert.match(response.headers.get('cache-control'), /max-age=60/);
  assert.equal(kvReads, 0);
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes(env.TELEGRAM_BOT_TOKEN), false);
  assert.equal(serialized.includes(env.DEMO_SIGNER_ROOT_SECRET), false);
  assert.deepEqual(Object.keys(body).sort(), [
    'ok',
    'sessionSlug',
    'telegramOnly',
    'telegramBridgeEnabled',
    'clientSubmitReady',
  ].sort());
});

test('Telegram session-meta exposes public client submit readiness', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED: 'false',
  });
  const response = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/session-meta?sessionSlug=alpha', {
      headers: { origin: 'https://client.example' },
    }),
    env,
  });
  const body = await jsonBody(response);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.telegramOnly, true);
  assert.equal(body.telegramBridgeEnabled, true);
  assert.equal(body.clientSubmitReady, false);
  assert.doesNotMatch(JSON.stringify(body), /token|secret|private/i);
});

test('Telegram session-meta reads sessionModeProfile before legacy flags', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'profile-telegram',
      sessions: [{
        sessionSlug: 'profile-telegram',
        sessionName: 'Profile Telegram',
        telegramBridgeEnabled: false,
        telegramOnly: false,
        sessionModeProfile: {
          profileVersion: 1,
          preset: 'custom',
          authority: { mode: 'worker_canonical' },
          evm: { registryChainId: null },
          storage: { backend: 'cloudflare' },
          identity: { default: 'passkey', enabled: ['passkey', 'telegram'] },
          authorization: { mechanisms: ['worker_roles'] },
          encryption: { mode: 'none' },
          surfaces: { web: true, telegram: true, miniApp: true, agentHttp: false, mcp: false, ceCc: false },
          results: { visibility: 'participant_aggregate' },
          export: { scope: 'admin_raw' },
        },
      }, {
        sessionSlug: 'profile-web',
        sessionName: 'Profile Web',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        sessionModeProfile: {
          profileVersion: 1,
          preset: 'custom',
          authority: { mode: 'worker_canonical' },
          evm: { registryChainId: null },
          storage: { backend: 'cloudflare' },
          identity: { default: 'passkey', enabled: ['passkey'] },
          authorization: { mechanisms: ['worker_roles'] },
          encryption: { mode: 'none' },
          surfaces: { web: true, telegram: false, miniApp: false, agentHttp: false, mcp: false, ceCc: false },
          results: { visibility: 'participant_aggregate' },
          export: { scope: 'admin_raw' },
        },
      }],
    }),
  });

  const profileTelegramResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/session-meta?sessionSlug=profile-telegram'),
    env,
  });
  const profileTelegram = await jsonBody(profileTelegramResponse);
  assert.equal(profileTelegramResponse.status, 200);
  assert.equal(profileTelegram.telegramOnly, true);
  assert.equal(profileTelegram.telegramBridgeEnabled, true);
  assert.equal(profileTelegram.clientSubmitReady, true);

  const profileWebResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/session-meta?sessionSlug=profile-web'),
    env,
  });
  const profileWeb = await jsonBody(profileWebResponse);
  assert.equal(profileWebResponse.status, 200);
  assert.equal(profileWeb.telegramOnly, false);
  assert.equal(profileWeb.telegramBridgeEnabled, false);
  assert.equal(profileWeb.clientSubmitReady, false);
});

test('Telegram session-meta reports non-telegram and unknown sessions as not telegram-only', async () => {
  const env = baseEnv();
  const alphaResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/session-meta?sessionSlug=alpha', {
      headers: { origin: 'https://client.example' },
    }),
    env,
  });
  const alpha = await jsonBody(alphaResponse);
  assert.equal(alphaResponse.status, 200);
  assert.equal(alpha.ok, true);
  assert.equal(alpha.sessionSlug, 'alpha');
  assert.equal(alpha.telegramOnly, false);
  assert.equal(alpha.telegramBridgeEnabled, true);

  const unknownResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/session-meta?sessionSlug=__nope__', {
      headers: { origin: 'https://client.example' },
    }),
    env,
  });
  const unknown = await jsonBody(unknownResponse);
  assert.equal(unknownResponse.status, 200);
  assert.equal(unknown.ok, true);
  assert.equal(unknown.sessionSlug, '__nope__');
  assert.equal(unknown.telegramOnly, false);
  assert.equal(unknown.telegramBridgeEnabled, false);
});

test('Telegram session-meta stays within KV read budget with warm registry cache', async () => {
  const slugs = ['alpha', 'beta', 'gamma'];
  const hexWord = (value) => BigInt(value).toString(16).padStart(64, '0');
  const abiString = (value) => {
    const bytes = new TextEncoder().encode(value);
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `0x${hexWord(32)}${hexWord(bytes.length)}${hex.padEnd(Math.ceil(hex.length / 64) * 64, '0')}`;
  };
  let registryFetchCalls = 0;
  const registryFetch = async (_url, init = {}) => {
    registryFetchCalls += 1;
    const data = JSON.parse(init.body).params[0].data;
    if (data === '0x6e6734bf') {
      return new Response(JSON.stringify({ result: `0x${hexWord(slugs.length)}` }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    const index = Number(BigInt(`0x${data.slice(-64)}`));
    return new Response(JSON.stringify({ result: abiString(slugs[index] || '') }), {
      headers: { 'content-type': 'application/json' },
    });
  };
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: '',
    DEFAULT_RPC_URL: 'https://rpc.session-meta-budget.test',
    REGISTRY_FETCH: registryFetch,
  });

  const warmResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/session-meta?sessionSlug=alpha'),
    env,
  });
  assert.equal(warmResponse.status, 200);
  assert.ok(registryFetchCalls > 0);

  env.AGENT_ACTION_KV.resetGetCalls();
  const callsBeforeWarmRead = registryFetchCalls;
  const response = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/session-meta?sessionSlug=alpha'),
    env,
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.sessionSlug, 'alpha');
  assert.equal(registryFetchCalls, callsBeforeWarmRead);
  assert.ok(
    env.AGENT_ACTION_KV.getCalls <= 2,
    `session-meta should use <=2 KV reads with warm registry cache; read ${env.AGENT_ACTION_KV.getCalls}: ${env.AGENT_ACTION_KV.getKeys.join(', ')}`,
  );
  assert.deepEqual(
    env.AGENT_ACTION_KV.getKeys.filter((key) => key.startsWith('telegram:results-exposure:')),
    [],
  );
});

test('Telegram session-meta validates slug and CORS preflight', async () => {
  const env = telegramOnlyEnv();
  const missingResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/session-meta', {
      headers: { origin: 'https://client.example' },
    }),
    env,
  });
  const missing = await jsonBody(missingResponse);
  assert.equal(missingResponse.status, 400);
  assert.equal(missing.reason, 'session_slug_required');

  const optionsResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/session-meta?sessionSlug=alpha', {
      method: 'OPTIONS',
      headers: { origin: 'https://client.example' },
    }),
    env,
  });
  assert.equal(optionsResponse.status, 204);
  assert.equal(optionsResponse.headers.get('access-control-allow-origin'), '*');
  assert.equal(optionsResponse.headers.get('vary'), 'Origin');

  const arbitraryOriginResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/session-meta?sessionSlug=alpha', {
      headers: { origin: 'https://anywhere.example' },
    }),
    env,
  });
  const arbitraryOrigin = await jsonBody(arbitraryOriginResponse);
  assert.equal(arbitraryOriginResponse.status, 200);
  assert.equal(arbitraryOriginResponse.headers.get('access-control-allow-origin'), '*');
  assert.equal(arbitraryOriginResponse.headers.get('vary'), 'Origin');
  assert.equal(arbitraryOrigin.ok, true);
  assert.equal(arbitraryOrigin.telegramOnly, true);
});

test('Telegram polis results view returns pseudonymized binary vectors', async () => {
  const env = telegramOnlyEnv({
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
        resultsExposure: { anonymizedGroupsEnabled: true, minGroupSize: 2 },
      }],
    }),
  });
  await persistTelegramSubmitRecord({
    env,
    record: {
      requestId: 'polis-submit-1',
      sessionSlug: 'alpha',
      telegramUserId: '42',
      questionId: 'q-binary',
      status: 'direct_submitted',
      createdAt: '2026-12-01T10:00:00.000Z',
      answer: { questionType: 'binary', label: 'Agree', value: 'Agree' },
    },
  });
  await persistTelegramSubmitRecord({
    env,
    record: {
      requestId: 'polis-submit-2',
      sessionSlug: 'alpha',
      telegramUserId: '77',
      questionId: 'q-binary',
      status: 'direct_submitted',
      createdAt: '2026-12-01T11:00:00.000Z',
      answer: { questionType: 'binary', label: 'Disagree', value: 'Disagree' },
    },
  });
  // Re-answer by the same participant: only the latest vote counts.
  await persistTelegramSubmitRecord({
    env,
    record: {
      requestId: 'polis-submit-3',
      sessionSlug: 'alpha',
      telegramUserId: '42',
      questionId: 'q-binary',
      status: 'direct_submitted',
      createdAt: '2026-12-01T12:00:00.000Z',
      answer: { questionType: 'binary', label: 'Unsure', value: 'Unsure' },
    },
  });
  // Freeform answers never enter the polis dataset.
  await persistTelegramSubmitRecord({
    env,
    record: {
      requestId: 'polis-submit-4',
      sessionSlug: 'alpha',
      telegramUserId: '42',
      questionId: 'q-freeform',
      status: 'direct_submitted',
      createdAt: '2026-12-01T12:30:00.000Z',
      answer: { questionType: 'freeform', text: 'private thoughts' },
    },
  });

  const response = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/results?sessionSlug=alpha&telegramUserId=42&view=polis'),
    env,
  });
  const body = await jsonBody(response);
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.view, 'polis');
  assert.equal(body.participantCount, 2);
  assert.equal(body.questionCount, 1);
  assert.equal(body.questions[0].questionId, 'q-binary');
  assert.equal(body.questions[0].questionType, 'binary');
  assert.match(body.questions[0].prompt, /fund this proposal/i);
  const rows = body.responses['q-binary'];
  assert.equal(rows.length, 2);
  const values = rows.map((row) => `${row.responder}:${row.value}`).sort();
  assert.deepEqual(values, ['P1:Unsure', 'P2:Disagree']);
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes('"42"'), false);
  assert.equal(serialized.includes('"77"'), false);
  assert.equal(serialized.includes('telegramUserId'), false);
  assert.equal(serialized.includes('private thoughts'), false);

  const gatedEnv = telegramOnlyEnv({
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
        resultsExposure: { anonymizedGroupsEnabled: false },
      }],
    }),
  });
  const gatedResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/results?sessionSlug=alpha&telegramUserId=42&view=polis'),
    env: gatedEnv,
  });
  assert.equal(gatedResponse.status, 403);
  assert.equal((await jsonBody(gatedResponse)).reason, 'anonymized_groups_admin_disabled');
});

test('Telegram browser CORS covers question/result reads and preference submit', async () => {
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
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  assert.equal(issued.ok, true);

  for (const path of [
    '/api/agent/questions',
    '/api/agent/results',
    '/api/agent/preferences',
    '/telegram/agent/api/questions',
    '/telegram/agent/api/results',
    '/telegram/agent/api/preferences',
  ]) {
    const preflight = await handleTelegramAgentHandoffRequest({
      request: new Request(`https://bridge.example${path}`, {
        method: 'OPTIONS',
        headers: { origin: 'https://client.example' },
      }),
      env,
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://client.example');
    assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/);

    const denied = await handleTelegramAgentHandoffRequest({
      request: new Request(`https://bridge.example${path}`, {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example' },
      }),
      env,
    });
    assert.equal(denied.status, 403);
    assert.equal((await jsonBody(denied)).reason, 'origin_not_allowed');
  }

  const questionsResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/questions?sessionSlug=alpha&limit=5', {
      headers: {
        authorization: `Bearer ${issued.token}`,
        origin: 'https://client.example',
      },
    }),
    env,
  });
  const questionsBody = await jsonBody(questionsResponse);
  assert.equal(questionsResponse.status, 200);
  assert.equal(questionsBody.ok, true);
  assert.equal(questionsResponse.headers.get('access-control-allow-origin'), 'https://client.example');

  const resultsResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/results?sessionSlug=alpha&view=consensus', {
      headers: {
        authorization: `Bearer ${issued.token}`,
        origin: 'https://client.example',
      },
    }),
    env,
  });
  // Status depends on the session's results-exposure policy; CORS must be present
  // either way so the browser can read success or the gate reason.
  assert.equal(resultsResponse.headers.get('access-control-allow-origin'), 'https://client.example');
  const resultsBody = await jsonBody(resultsResponse);
  assert.equal(typeof resultsBody.ok, 'boolean');

  const unauthedResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/questions?sessionSlug=alpha', {
      headers: { origin: 'https://client.example' },
    }),
    env,
  });
  assert.equal(unauthedResponse.status, 401);
  assert.equal(unauthedResponse.headers.get('access-control-allow-origin'), 'https://client.example');

  const preferencesResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/api/agent/preferences', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${issued.token}`,
        'content-type': 'application/json',
        origin: 'https://client.example',
      },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        preferences: [{
          questionId: 'q-binary',
          answer: { questionType: 'binary', value: 'agree' },
        }],
        submit: true,
        humanApproved: true,
      }),
    }),
    env,
  });
  const preferencesBody = await jsonBody(preferencesResponse);
  assert.equal(preferencesResponse.status, 200);
  assert.equal(preferencesBody.ok, true);
  assert.equal(preferencesBody.reviewRequired, false);
  assert.equal(preferencesResponse.headers.get('access-control-allow-origin'), 'https://client.example');

  const agentResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/questions?sessionSlug=alpha', {
      headers: { authorization: `Bearer ${issued.token}` },
    }),
    env,
  });
  assert.equal(agentResponse.status, 200);
  assert.equal(agentResponse.headers.get('access-control-allow-origin'), null);
});

test('Telegram result-view cache stores and returns data-version scoped analysis', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_AGENT_API_TOKEN: 'agent-test-token',
    AGENT_BRIDGE_CLIENT_LOGIN_ALLOWED_ORIGINS: 'https://client.example',
  });
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'34'.repeat(20)}`,
    createdAt: '2026-12-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
  assert.equal(saveResponse.status, 403);
  assert.equal(saved.reason, 'result_view_cache_write_root_token_required');

  const serviceSaveResponse = await handleTelegramAgentHandoffRequest({
    request: new Request('https://bridge.example/telegram/agent/api/result-view-cache', {
      method: 'POST',
      headers: {
        authorization: 'Bearer agent-test-token',
        'content-type': 'application/json',
        origin: 'https://client.example',
      },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        telegramUserId: 'service',
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
  const serviceSaved = await jsonBody(serviceSaveResponse);
  assert.equal(serviceSaveResponse.status, 200);
  assert.equal(serviceSaved.cacheLayer, 'stored');
  assert.equal(serviceSaved.value.clusters[0].name, 'Builders');
  assert.equal(JSON.stringify(serviceSaved).includes(issued.token), false);

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
        authorization: 'Bearer agent-test-token',
        'content-type': 'application/json',
        origin: 'https://client.example',
      },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        telegramUserId: 'service',
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
        authorization: 'Bearer agent-test-token',
        'content-type': 'application/json',
        origin: 'https://client.example',
      },
      body: JSON.stringify({
        sessionSlug: 'alpha',
        telegramUserId: 'service',
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
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  assert.equal(issued.ok, true);
  const readOnly = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '43',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress: `0x${'34'.repeat(20)}`,
    scopes: [TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS],
    createdAt: '2026-12-01T12:01:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
        prompt: 'Should the session lab publish a daily recap?',
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
    now: '2026-06-01T12:00:00.000Z',
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
  assert.equal(questions.skillVersion, '2026-07-18 (v42)');
  assert.equal(questions.skillUpdateAvailable, false);

  const draftResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/preferences', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        agent: { name: 'hermes', platform: 'openclaw', model: 'demo-model' },
        source: 'openclaw',
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
  assert.equal(binaryDraft.agentMetadata.agentName, 'hermes');
  assert.equal(binaryDraft.agentMetadata.platform, 'openclaw');
  assert.equal(binaryDraft.actionMetadata.clientSource, 'openclaw');
  assert.equal(binaryDraft.editCount, 0);
  assert.equal(binaryDraft.origin.source, 'agent_handoff');
  assert.equal(binaryDraft.origin.answerLabel, 'Agree');
  assert.equal(binaryDraft.origin.agentMetadata.agentName, 'hermes');
  assert.equal(env.AGENT_ACTION_KV.metadata.get('telegram:answer-draft:42:alpha:q-binary')?.t, 'answer_draft');
  assert.equal(env.AGENT_ACTION_KV.metadata.get('telegram:answer-draft:42:alpha:q-binary')?.o, 'agent_handoff');
  assert.equal(binaryDraft.actionMetadata.authMode, 'root_token');

  await env.AGENT_ACTION_KV.put('telegram:answer-draft:43:alpha:q-binary', JSON.stringify({
    status: 'draft_saved',
    telegramUserId: '43',
    sessionSlug: 'alpha',
    questionId: 'q-binary',
    answerLabel: 'Other user draft',
    answerValue: 'Other user draft',
    selectedAt: '2026-06-01T12:01:00.000Z',
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

  await saveTelegramAgentSettingsPatch({
    env,
    sessionSlug: 'alpha',
    telegramUserId: '42',
    patch: { draftDivergenceOptIn: true },
    createdAt: '2026-06-01T12:02:00.000Z',
  });

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
  assert.equal(submitted.submitRequestedCount, 1);
  assert.equal(submitted.submittedCount, 1);
  assert.equal(submitted.ok, true);
  assert.equal(submitted.reviewRequired, false);
  assert.match(submitted.review.note, /without requiring Mini App finalization/);
  assert.equal(submitted.submitted[0].questionId, 'q-binary');
  assert.equal(submitted.draftEditMetrics[0].questionId, 'q-binary');
  assert.equal(submitted.draftEditMetrics[0].stored, true);
  assert.equal(submitted.draftEditMetrics[0].changed, true);
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
  const draftEditRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => key.startsWith(DRAFT_EDIT_METRIC_KV_PREFIX))
    .map(([, value]) => JSON.parse(value));
  assert.equal(draftEditRecords.length, 1);
  assert.equal(draftEditRecords[0].source, 'agent_preferences');
  assert.equal(draftEditRecords[0].finality, 'submitted');
  assert.equal(draftEditRecords[0].questionId, 'q-binary');
  assert.equal(draftEditRecords[0].metrics.binaryFrom, 'agree');
  assert.equal(draftEditRecords[0].metrics.binaryTo, 'unsure');
  assert.equal(draftEditRecords[0].metrics.binaryTransition, 'to_unsure');
  assert.equal(Object.hasOwn(draftEditRecords[0], 'telegramUserId'), false);
  assert.equal(JSON.stringify(draftEditRecords[0]).includes('Matches the stated priority'), false);
  assert.equal(JSON.stringify(draftEditRecords[0]).includes('User explicitly chose unsure'), false);

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
            initialAnswer: { text: 'Ask the user to review this in the Mini App.' },
            answer: { text: 'Ship the direct chat answer path.', comments: 'User approved direct submission.' },
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
  assert.equal(nestedSubmitted.submitRequestedCount, 1);
  assert.equal(nestedSubmitted.submittedCount, 1);
  assert.equal(nestedSubmitted.ok, true);
  assert.equal(nestedSubmitted.reviewRequired, false);
  assert.equal(nestedSubmitted.submitted[0].questionId, 'q-freeform');
  assert.equal(nestedSubmitted.draftEditMetrics[0].stored, true);
  const allSubmitRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => String(key).startsWith('telegram:submit-request:'))
    .map(([, value]) => JSON.parse(value));
  assert.equal(allSubmitRecords.length, 2);
  const freeformSubmit = allSubmitRecords.find((record) => record.questionId === 'q-freeform');
  assert.equal(freeformSubmit.answer.label, 'Ship the direct chat answer path.');

  const badSubmitResponse = await handleTelegramAgentHandoffRequest({
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
            'q-missing': { value: 'agree' },
          },
        },
      },
    }),
    env,
  });
  const badSubmit = await jsonBody(badSubmitResponse);
  assert.equal(badSubmitResponse.status, 422);
  assert.equal(badSubmit.ok, false);
  assert.equal(badSubmit.reason, 'direct_submit_incomplete');
  assert.equal(badSubmit.submitRequestedCount, 1);
  assert.equal(badSubmit.submittedCount, 0);
  assert.equal(badSubmit.draftCount, 0);
  assert.deepEqual(badSubmit.skipped, [{ questionId: 'q-missing', reason: 'question_not_active_or_answerable' }]);
  const submitRecordsAfterBadReference = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => String(key).startsWith('telegram:submit-request:'));
  assert.equal(submitRecordsAfterBadReference.length, 2);

  const emptySubmitResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/preferences', {
      method: 'POST',
      body: {
        telegramUserId: '42',
        groupChatId: '-100123',
        sessionSlug: 'alpha',
        submit: true,
        humanApproved: true,
        preferences: {
          answersByQuestionId: {},
        },
      },
    }),
    env,
  });
  const emptySubmit = await jsonBody(emptySubmitResponse);
  assert.equal(emptySubmitResponse.status, 422);
  assert.equal(emptySubmit.ok, false);
  assert.equal(emptySubmit.reason, 'direct_submit_incomplete');
  assert.equal(emptySubmit.submitRequestedCount, 1);
  assert.equal(emptySubmit.submittedCount, 0);
  assert.deepEqual(emptySubmit.skipped, [{ questionId: '', reason: 'preference_entries_missing' }]);
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
      createdAt: `2026-06-01T12:02:0${counter}.000Z`,
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

  await env.AGENT_ACTION_KV.put(
    'telegram:agent-only:answer-event:v1:alpha:w-2026-06-12:42:1718192021223-deadbeef',
    JSON.stringify({
      type: 'telegram_agent_only_answer_event',
      version: 1,
      sessionSlug: 'alpha',
      windowId: 'w-2026-06-12',
      telegramUserId: '42',
      questionId: 'ceq_sidecar',
      source: 'agent_autofill',
      eventKind: 'answer',
      answer: { value: 'agent-only-sidecar-answer' },
      confidence: 99,
      rationale: 'Sidecar data must not enter live results.',
      createdAt: '2026-06-12T15:10:00.000Z',
    }),
    { metadata: { v: 1, t: 'ao_evt', k: 'a', src: 'agent_autofill' } },
  );
  await env.AGENT_ACTION_KV.put(
    'telegram:agent-only:answer-state:v1:alpha:w-2026-06-12:42',
    JSON.stringify({
      type: 'telegram_agent_only_answer_state',
      version: 1,
      sessionSlug: 'alpha',
      windowId: 'w-2026-06-12',
      telegramUserId: '42',
      byStatement: {
        ceq_sidecar: {
          agent: { answer: { value: 'agent-only-sidecar-answer' }, confidence: 99 },
          agentSkip: null,
          human: null,
        },
      },
      counts: { answers: 1, skips: 0 },
      createdAt: '2026-06-12T15:10:00.000Z',
      updatedAt: '2026-06-12T15:10:00.000Z',
    }),
    { metadata: { v: 1, t: 'ao_ans', sg: 'alpha', w: 'w-2026-06-12', a: 1, s: 0 } },
  );

  const afterAgentOnlyResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/results?sessionSlug=alpha&telegramUserId=42&view=topic-map'),
    env,
  });
  const afterAgentOnlyBody = await jsonBody(afterAgentOnlyResponse);
  assert.equal(afterAgentOnlyResponse.status, 200);
  assert.deepEqual(afterAgentOnlyBody.counts, body.counts);
  assert.deepEqual(afterAgentOnlyBody.topicMap.counts, body.topicMap.counts);
  assert.deepEqual(afterAgentOnlyBody.topicMap.topics, body.topicMap.topics);
  assert.equal(JSON.stringify(afterAgentOnlyBody).includes('agent-only-sidecar-answer'), false);

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

test('session-member aggregate results require a canonical worker group at the shared minimum size', async () => {
  const env = telegramOnlyEnv({
    AGENT_BRIDGE_SESSION_WORKER_URL: 'https://session-worker.example',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true,
        managedAccountSubmitAllowed: true,
        sessionModeProfile: {
          authority: { mode: 'worker_canonical' },
          authorization: { mechanisms: ['worker_groups'] },
          surfaces: { web: true, telegram: true },
          results: { visibility: 'session_member_aggregate' },
        },
        resultsExposure: { aggregateResultsEnabled: true, minGroupSize: 2 },
      }],
    }),
  });
  const accountAddress = await managedAccountAddressForTelegramUser(env, '42');
  const issued = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'participant',
    sessionSlug: 'alpha',
    accountAddress,
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  let memberships = [{
    group: {
      groupId: 'reviewers',
      label: 'Reviewers',
      joinMode: 'admin_add',
      memberVisibility: 'members',
    },
    member: { principalKey: `evm_address:${accountAddress.toLowerCase()}` },
    memberCount: 2,
  }];
  let membershipsStatus = 200;
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    fetchCalls.push({ url: String(url), init });
    if (String(url).endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'member-results-nonce' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url).endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'member-results-worker-jwt', exp: 1780003600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url).endsWith('/groups/my-memberships')) {
      assert.equal(new Headers(init.headers).get('authorization'), 'Bearer member-results-worker-jwt');
      return new Response(JSON.stringify(
        membershipsStatus === 200
          ? { ok: true, memberships }
          : { ok: false, error: 'storage unavailable' }
      ), {
        status: membershipsStatus,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const requestResults = () => handleTelegramAgentHandoffRequest({
    request: agentRequest('/api/agent/results?sessionSlug=alpha&view=consensus', { token: issued.token }),
    env,
    fetchImpl,
  });

  const allowed = await requestResults();
  assert.equal(allowed.status, 200, JSON.stringify(await jsonBody(allowed.clone())));
  assert.deepEqual(fetchCalls.map((call) => call.url), [
    'https://session-worker.example/auth/nonce',
    'https://session-worker.example/auth/login',
    'https://session-worker.example/groups/my-memberships',
  ]);

  memberships = [{ ...memberships[0], memberCount: 1 }];
  const belowThreshold = await requestResults();
  assert.equal(belowThreshold.status, 403);
  assert.equal((await jsonBody(belowThreshold)).reason, 'session_member_aggregate_min_group_size_not_met');

  memberships = [];
  const notMember = await requestResults();
  assert.equal(notMember.status, 403);
  assert.equal((await jsonBody(notMember)).reason, 'session_member_aggregate_membership_denied');

  const imageDenied = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/api/agent/results-image?sessionSlug=alpha&view=consensus', { token: issued.token }),
    env,
    fetchImpl,
  });
  assert.equal(imageDenied.status, 403);
  assert.equal((await jsonBody(imageDenied)).reason, 'session_member_aggregate_membership_denied');

  membershipsStatus = 503;
  const unavailable = await requestResults();
  assert.equal(unavailable.status, 503);
  assert.equal((await jsonBody(unavailable)).reason, 'session_member_aggregate_membership_unavailable');
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
  await putSubmittedResult(env, { key: 'telegram:submit-request:1', telegramUserId: '42', questionId: 'q-one', label: 'Agree', comments: 'raw private answer one', createdAt: '2026-06-01T12:00:01.000Z' });
  await putSubmittedResult(env, { key: 'telegram:submit-request:2', telegramUserId: '43', questionId: 'q-one', label: 'Agree', comments: 'raw private answer two', createdAt: '2026-06-01T12:00:02.000Z' });
  await putSubmittedResult(env, { key: 'telegram:submit-request:3', telegramUserId: '42', questionId: 'q-two', label: 'Disagree', createdAt: '2026-06-01T12:00:03.000Z' });
  await putSubmittedResult(env, { key: 'telegram:submit-request:4', telegramUserId: '43', questionId: 'q-two', label: 'Disagree', createdAt: '2026-06-01T12:00:04.000Z' });

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
  assert.deepEqual(unknownBody.supportedViews, ['topic-map', 'consensus', 'difference', 'groups', 'polis']);

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
    now: '2026-06-01T12:00:00.000Z',
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
    now: '2026-06-01T12:00:00.000Z',
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
    approvedAt: '2026-06-01T12:00:00.000Z',
  }));
  await env.AGENT_ACTION_KV.put('telegram:group-session:-100123', JSON.stringify({
    version: 1,
    chatId: '-100123',
    sessionSlug: 'alpha',
    sessionName: 'Alpha Session',
    linkedAt: '2026-06-01T12:00:00.000Z',
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
    now: '2026-06-01T12:00:00.000Z',
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
    now: '2026-06-01T12:00:00.000Z',
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
  const scopedAdminAddress = await managedAccountAddressForTelegramUser(env, '44');
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = `${adminAddress},${scopedAdminAddress}`;
  const defaultToken = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '42',
    username: 'admin',
    sessionSlug: 'alpha',
    accountAddress: adminAddress,
    createdAt: '2026-12-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  const scopedToken = await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '44',
    username: 'admin',
    sessionSlug: 'alpha',
    accountAddress: scopedAdminAddress,
    scopes: [
      ...TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_SCOPES,
      TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.MANAGE_GROUP_APPROVALS,
    ],
    createdAt: '2026-12-01T12:01:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
  });
  await createTelegramAgentDelegationToken({
    env,
    telegramUserId: '43',
    username: 'beta_user',
    sessionSlug: 'beta',
    accountAddress: `0x${'34'.repeat(20)}`,
    createdAt: '2026-06-01T12:00:00.000Z',
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
  }), {
    metadata: { v: 1, t: 'answer_draft', sg: 'alpha', e: 1, o: 'agent_handoff' },
  });
  await env.AGENT_ACTION_KV.put('telegram:answer-draft:43:beta:q2', JSON.stringify({
    sessionSlug: 'beta',
    telegramUserId: '43',
  }));
  await env.AGENT_ACTION_KV.put(`${DRAFT_EDIT_METRIC_KV_PREFIX}alpha:q1:metric1`, JSON.stringify({
    type: 'telegram_draft_edit_metric',
    sessionSlug: 'alpha',
    questionId: 'q1',
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
  assert.equal(root.totals.answerDraftsEdited, 1);
  assert.equal(root.totals.agentDraftedAnswers, 1);
  assert.equal(root.totals.draftEditMetrics, 1);
  assert.equal(root.totals.groupProposals, 1);
  assert.equal(root.totals.questionsAnswered, 2);
  assert.equal(root.totals.distinctRespondents, 2);
  assert.equal(root.totals.sessionsWithBridgeActivity, 2);
  assert.deepEqual(submitRecordGetsAfterRoot, []);
  assert.equal(root.definitions.agentsOnboarded.includes('skill installs'), true);
  assert.equal(root.definitions.draftEditMetrics.includes('without storing raw answer text'), true);
  assert.equal(root.definitions.answerDraftsEdited.includes('changed at least once'), true);
  assert.equal(root.perSession.find((entry) => entry.sessionSlug === 'alpha').questionsAnswered, 1);
  assert.equal(root.perSession.find((entry) => entry.sessionSlug === 'alpha').answerDraftsEdited, 1);
  assert.equal(root.perSession.find((entry) => entry.sessionSlug === 'alpha').agentDraftedAnswers, 1);
  assert.equal(root.perSession.find((entry) => entry.sessionSlug === 'alpha').draftEditMetrics, 1);
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

test('Telegram admin metrics respect the visible session cutoff by default', async () => {
  const env = baseEnv({
    DEFAULT_RPC_URL: '',
    ADDITIONAL_RPC_URL: '',
    AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER: '2026-05-20T00:00:00.000Z',
  });
  const rootAdminAddress = await managedAccountAddressForTelegramUser(env, '42');
  env.AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES = rootAdminAddress;
  env.AGENT_BRIDGE_SESSION_POLICY_JSON = JSON.stringify({
    defaultSessionSlug: 'alpha',
    riskCeiling: 'submit',
    sessions: [
      {
        sessionSlug: 'alpha',
        sessionName: 'Default Alpha',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        managedAccountSubmitAllowed: true,
        createdAt: '2026-05-19T00:00:00.000Z',
      },
      {
        sessionSlug: 'beta',
        sessionName: 'Visible Beta',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        managedAccountSubmitAllowed: true,
        createdAt: '2026-05-21T00:00:00.000Z',
      },
      {
        sessionSlug: 'legacy',
        sessionName: 'Legacy Smoke',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        managedAccountSubmitAllowed: true,
        createdAt: '2026-05-18T00:00:00.000Z',
      },
    ],
  });
  for (const slug of ['alpha', 'beta', 'legacy']) {
    await env.AGENT_ACTION_KV.put(`telegram:proposed-question:${slug}:q1`, JSON.stringify({
      sessionSlug: slug,
      questionId: 'q1',
    }));
  }

  const visibleResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/metrics?sessionSlug=alpha&telegramUserId=42'),
    env,
  });
  const visible = await jsonBody(visibleResponse);
  const legacyResponse = await handleTelegramAgentHandoffRequest({
    request: agentRequest('/telegram/agent/api/admin/metrics?sessionSlug=alpha&telegramUserId=42&includeLegacySessions=1'),
    env,
  });
  const legacy = await jsonBody(legacyResponse);

  assert.equal(visibleResponse.status, 200);
  assert.equal(visible.scope, 'global');
  assert.equal(visible.metricVisibility.mode, 'telegram_visible_sessions');
  assert.deepEqual(visible.metricVisibility.sessionSlugs, ['alpha', 'beta']);
  assert.equal(visible.totals.questionsCreated, 2);
  assert.deepEqual(visible.perSession.map((entry) => entry.sessionSlug), ['alpha', 'beta']);
  assert.equal(visible.definitions.metricVisibility.includes('includeLegacySessions=1'), true);
  assert.equal(legacyResponse.status, 200);
  assert.equal(legacy.metricVisibility.mode, 'all_sessions');
  assert.equal(legacy.totals.questionsCreated, 3);
  assert.deepEqual(legacy.perSession.map((entry) => entry.sessionSlug), ['alpha', 'beta', 'legacy']);
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
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
      prompt: 'Should Alpha prioritize participant follow-up after Session Lab?',
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
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
  assert.equal(delegatedPost.reason, 'question_queue_root_token_required');
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
    ttlSeconds: LONG_TEST_TOKEN_TTL_SECONDS,
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
        latestVersion: '2026-07-18 (v42)',
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
  assert.equal(initialStatus.version, '2026-07-18 (v42)');
  assert.equal(delegatedPostResponse.status, 403);
  assert.equal(delegatedPost.reason, 'question_queue_root_token_required');
  assert.equal(setResponse.status, 200);
  assert.equal(set.ok, true);
  assert.equal(set.updateAvailable, true);
  assert.equal(set.latestVersion, '2026-07-18 (v42)');
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
    now: '2026-06-01T12:00:00.000Z',
  });
  await saveTelegramAgentSettingsPatch({
    env,
    telegramUserId: '42',
    sessionSlug: 'alpha',
    patch: { agentAutoApplyQuestionVotes: true },
    createdAt: '2026-06-01T12:00:01.000Z',
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
  assert.equal(decisionRecords[0].actionMetadata.authMode, 'root_token');
  assert.equal(decisionRecords[0].actionMetadata.clientSource, 'openclaw');
  assert.equal(Object.hasOwn(decisionRecords[0].actionMetadata, 'apiKey'), false);
});

test('Telegram agent question auto-votes are opt-in by default', async () => {
  const env = baseEnv();
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-06-01T12:00:00.000Z',
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
    now: '2026-06-01T12:00:00.000Z',
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
    createdAt: '2026-06-01T12:05:00.000Z',
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
    now: '2026-06-01T12:00:00.000Z',
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
    now: '2026-06-01T12:00:00.000Z',
  });
  const sourceUrl = 'https://example.com/session-topic/report?view=public';

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
            prompt: 'Should Session Lab organizers publish a daily recap?',
            questionType: 'binary',
            tags: ['event'],
            geoRefs: [{ geoId: 'edge-node-1', label: 'Session Lab recap' }],
          },
          {
            prompt: 'Should the demo prioritize organizer feedback?',
            questionType: 'binary',
          },
          {
            prompt: 'Which topics need a follow-up discussion?',
            questionType: 'single_choice',
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
    question.prompt === 'Should Session Lab organizers publish a daily recap?'
  ));
  const singleChoiceQuestion = questions.questions.find((question) => (
    question.prompt === 'Which topics need a follow-up discussion?'
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
  assert.equal(body.created[2].questionType, 'multichoice');
  assert.equal(body.created[2].singleSelect, true);
  assert.equal(proposedRecords.length, 3);
  assert.equal(proposedRecords.every((record) => record.status === 'active'), true);
  assert.equal(proposedRecords.every((record) => record.sponsored !== true), true);
  assert.equal(proposedRecords.every((record) => record.actionMetadata.endpoint === '/api/agent/questions/create'), true);
  assert.equal(proposedRecords[2].questionType, 'multichoice');
  assert.equal(proposedRecords[2].singleSelect, true);
  assert.equal(proposedRecords[0].references[0].url, sourceUrl);
  assert.equal(proposedRecords[0].geoRefs[0].geoId, 'edge-node-1');
  assert.equal(sourcedQuestion.references[0].url, sourceUrl);
  assert.equal(sourcedQuestion.geoRefs[0].geoId, 'edge-node-1');
  assert.equal(sourcedQuestion.tags.includes('src:example-com'), true);
  assert.equal(sourcedQuestion.tags.includes('geo:edge-node-1'), true);
  assert.equal(singleChoiceQuestion.questionType, 'multichoice');
  assert.equal(singleChoiceQuestion.singleSelect, true);
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
        sessionName: 'Session Lab Research',
        default: true,
        telegramBridgeEnabled: true,
        telegramGroupOpenAccess: true,
        managedAccountSubmitAllowed: true,
        sessionContext: 'Session Lab governance funding safety research with organizers.',
      }],
    }),
  });
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-06-01T12:00:00.000Z',
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
    now: '2026-06-01T12:00:00.000Z',
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
    now: '2026-06-01T12:00:00.000Z',
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
    now: '2026-06-01T12:00:00.000Z',
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
    now: '2026-06-01T12:00:00.000Z',
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
