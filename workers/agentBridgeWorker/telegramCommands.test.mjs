import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  buildTelegramCommandResponse,
  clearAdminDefaultSessionOverride,
  clearAgentSkillUpdateFlag,
  dispatchTelegramCommandResponse,
  fetchUrlQuestionSource,
  handleTelegramWebhookUpdate,
  loadQuestionsForSession,
  loadSubmittedResultRecords,
  loadSessionPolicy,
  parseTelegramCommandText,
  readAgentSkillUpdateFlag,
  readAdminDefaultSessionOverride,
  writeAgentSkillUpdateFlag,
  writeAdminDefaultSessionOverride,
} from './telegramCommands.mjs';
import { saveTelegramAgentSettingsPatch } from './telegramAgentSettings.mjs';
import { DRAFT_EDIT_METRIC_KV_PREFIX } from './telegramDraftEditMetrics.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import {
  loadTelegramAgentDelegationToken,
  readTelegramAgentDelegationTokenUserPointer,
  TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_TTL_SECONDS,
  TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES,
} from './agentCredentials.mjs';
import { __test__sessionQuestions } from './sessionQuestions.mjs';
import {
  canonicalAnswerSessionKvKey,
  submitRequestSessionKvKey,
} from './telegramSubmitQueue.mjs';

class MemoryKv {
  constructor() {
    this.store = new Map();
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
        telegramBridgeEnabled: true,
        telegramGroupOpenAccess: true,
        managedAccountSubmitAllowed: true,
        docLibraryEnabled: true,
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
    AGENT_BRIDGE_DEMO_DOCS_JSON: JSON.stringify([
      {
        docId: 'doc-public',
        sessionSlug: 'alpha',
        title: 'Public plan',
        fileType: 'md',
        visibility: 'public',
        contentPreview: 'Safe public summary',
      },
      {
        docId: 'doc-gated',
        sessionSlug: 'alpha',
        title: 'Gated appendix',
        fileType: 'pdf',
        visibility: 'sbt_gated',
        privateContentRef: 'r2://private/gated.pdf',
      },
    ]),
    AGENT_ACTION_KV: new MemoryKv(),
    ...overrides,
  };
}

function agentTokenEnv(overrides = {}) {
  return baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      allowQuestionGeneration: true,
      allowGenerateQuestion: true,
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

function dotenvEscapedJson(value = {}) {
  return JSON.stringify(value).replaceAll('"', '\\"');
}

function groupMessage(text) {
  return groupMessageFrom(text);
}

function groupMessageFrom(text, {
  chatId = -100123,
  title = 'Alpha Lobby',
  telegramUserId = 42,
  username = 'host',
} = {}) {
  return {
    update_id: 7001,
    message: {
      message_id: 11,
      text,
      chat: { id: chatId, type: 'supergroup', title },
      from: { id: telegramUserId, username },
    },
  };
}

function privateMessage(text) {
  return privateMessageFrom(text);
}

function privateMessageFrom(text, {
  telegramUserId = '42',
  username = 'participant',
} = {}) {
  return {
    update_id: 7002,
    message: {
      message_id: 12,
      text,
      chat: { id: Number(telegramUserId), type: 'private' },
      from: { id: Number(telegramUserId), username },
    },
  };
}

function privateVoiceMessage({
  telegramUserId = '42',
  username = 'participant',
  fileId = 'voice-file-1',
} = {}) {
  return {
    update_id: 7003,
    message: {
      message_id: 13,
      voice: {
        file_id: fileId,
        duration: 4,
        mime_type: 'audio/ogg',
      },
      chat: { id: Number(telegramUserId), type: 'private' },
      from: { id: Number(telegramUserId), username },
    },
  };
}

async function withTimeout(promise, ms = 100, message = 'operation timed out') {
  let timeout = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function managedAccountAddressFor({
  telegramUserId = '42',
  username = 'participant',
} = {}, env = baseEnv(), now = '2026-05-08T12:00:00.000Z') {
  const account = await deriveManagedDemoAccount({
    principal: { telegramUserId, username },
    deploymentId: env.AGENT_BRIDGE_DEPLOYMENT_ID || 'agent-bridge-live-demo',
    rootSecret: env.DEMO_SIGNER_ROOT_SECRET || '',
    createdAt: now,
  });
  return account.accountAddress;
}

async function privateManagedAccountAddress(env = baseEnv(), now = '2026-05-08T12:00:00.000Z') {
  return managedAccountAddressFor({}, env, now);
}

function word(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function encodeRegistryStringResult(value = '') {
  const bytes = new TextEncoder().encode(String(value));
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const paddedLength = Math.ceil(hex.length / 64) * 64;
  return `0x${word(32)}${word(bytes.length)}${hex.padEnd(paddedLength, '0')}`;
}

function arweaveId(byte = 7) {
  return Buffer.from(Uint8Array.from({ length: 32 }, () => byte)).toString('base64url');
}

function u16le(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32le(bytes, offset) {
  return (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;
}

function readZipTextFiles(bytes) {
  const out = {};
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 30 <= bytes.length && u32le(bytes, offset) === 0x04034b50) {
    const method = u16le(bytes, offset + 8);
    const compressedSize = u32le(bytes, offset + 18);
    const nameLength = u16le(bytes, offset + 26);
    const extraLength = u16le(bytes, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    if (method === 0) out[name] = decoder.decode(data);
    offset = dataStart + compressedSize;
  }
  return out;
}

function mockSessionWorkerFetch(calls = [], { txId = arweaveId() } = {}) {
  return async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url).endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token', exp: 2000000000 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (String(url).endsWith('/storage/upload')) {
      return new Response(JSON.stringify({
        id: txId,
        storageRef: { backend: 'arweave', id: txId, resource: 'responses' },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ amountEth: '0.05', txHash: `0x${'34'.repeat(32)}` }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

function registryFetchForSlugs(slugs = []) {
  return async (_url, init = {}) => {
    const body = JSON.parse(init.body || '{}');
    const data = String(body.params?.[0]?.data || '');
    if (data === '0x6e6734bf') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: `0x${word(slugs.length)}` }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (data.startsWith('0x27916a76')) {
      const index = Number(BigInt(`0x${data.slice(10) || '0'}`));
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: encodeRegistryStringResult(slugs[index] || '') }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { message: 'unknown call' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

function flattenButtons(replyMarkup) {
  return (replyMarkup?.inline_keyboard || []).flat();
}

function nonNavigationButtons(replyMarkup) {
  return flattenButtons(replyMarkup).filter((button) => button.text !== 'Back to Start');
}

function launchFromButton(button = {}) {
  if (button.web_app?.url) return new URL(button.web_app.url).searchParams.get('launch') || '';
  if (button.url) return new URL(button.url).searchParams.get('start') || '';
  return '';
}

test('parseTelegramCommandText handles mentions without accepting commands for another bot', () => {
  assert.deepEqual(parseTelegramCommandText('/join@ce_demo_bot alpha', {
    botUsername: 'ce_demo_bot',
  }), {
    isCommand: true,
    command: '/join',
    args: ['alpha'],
    argText: 'alpha',
    mention: 'ce_demo_bot',
    addressedToOtherBot: false,
  });
  assert.equal(parseTelegramCommandText('/join@other_bot alpha', {
    botUsername: 'ce_demo_bot',
  }).addressedToOtherBot, true);
  assert.equal(parseTelegramCommandText('/ce_join@ce_demo_bot alpha', {
    botUsername: 'ce_demo_bot',
  }).command, '/join');
  assert.equal(parseTelegramCommandText('/drop_question 2', {
    botUsername: 'ce_demo_bot',
  }).command, '/pose_question');
  assert.equal(parseTelegramCommandText('/ce_drop_question 2', {
    botUsername: 'ce_demo_bot',
  }).command, '/pose_question');
  assert.equal(parseTelegramCommandText('hello').isCommand, false);
});

test('agent action menu is group-safe and persists only opaque launch records', async () => {
  const env = baseEnv();
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/agent'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const removedActions = await buildTelegramCommandResponse({
    update: groupMessage('/actions'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const buttons = flattenButtons(result.response.replyMarkup);
  const settings = buttons.find((button) => button.text === 'Settings');
  const viewQuestions = buttons.find((button) => button.text === 'View Questions');
  const storedActionKeys = Array.from(env.AGENT_ACTION_KV.store.keys())
    .filter((key) => key.startsWith('telegram:action:'));

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'agent_action_menu');
  assert.notEqual(removedActions.screen, 'agent_action_menu');
  assert.equal(removedActions.response.text.includes('Agent Actions'), false);
  assert.match(result.response.text, /Account and settings inputs open in private chat or Mini App/);
  assert.equal(result.response.text.includes('Address:'), false);
  assert.equal(result.catalog.canonicalBoundary, '/api/agent/*');
  assert.equal(result.catalog.capabilities.some((capability) => capability.id === 'agent.settings.update'), false);
  assert.equal(buttons.some((button) => button.text === 'Create Agent'), false);
  assert.match(settings.url, /^https:\/\/t\.me\/ce_demo_bot\?start=cetg_[a-z0-9]{10,48}$/);
  assert.match(viewQuestions.callback_data, /^cecb_[a-z0-9]{10,48}$/);
  assert.equal(JSON.stringify(result).includes('unit-root'), false);
  assert.equal(settings.url.includes('alpha'), false);
  assert.equal(storedActionKeys.length >= 2, true);

  const activity = await buildTelegramCommandResponse({
    update: privateMessage('/activity'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });
  assert.equal(activity.screen, 'agent_activity');
});

test('agent create and settings commands route group inputs private and model canonical requests', async () => {
  const env = baseEnv();
  const groupCreate = await buildTelegramCommandResponse({
    update: groupMessage('/create_agent'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const privateCreate = await buildTelegramCommandResponse({
    update: privateMessage('/create_agent'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const groupSettings = await buildTelegramCommandResponse({
    update: groupMessage('/settings'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });
  const privateSettings = await buildTelegramCommandResponse({
    update: privateMessage('/settings'),
    env,
    now: '2026-05-08T12:00:03.000Z',
  });
  const agentRequests = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => key.startsWith('telegram:agent-request:'))
    .map(([, value]) => JSON.parse(value));

  assert.equal(groupCreate.screen, 'agent_account_create');
  assert.equal(groupCreate.privateChatRequired, true);
  assert.match(groupCreate.response.text, /No account state is shown in group chat/);
  assert.equal(groupCreate.response.text.includes('Address:'), false);
  assert.match(flattenButtons(groupCreate.response.replyMarkup)[0].url, /^https:\/\/t\.me\/ce_demo_bot\?start=cetg_[a-z0-9]{10,48}$/);

  assert.equal(privateCreate.screen, 'agent_account_create');
  assert.match(privateCreate.response.text, /Agent account/);
  assert.match(privateCreate.response.text, /Canonical: POST \/api\/agent\/accounts\/create/);
  assert.equal(privateCreate.canonicalApiRequest.path, '/api/agent/accounts/create');
  assert.equal(privateCreate.canonicalApiRequest.status, 'implemented');
  assert.deepEqual(privateCreate.canonicalApiRequest.missingRequiredFields, []);
  assert.equal(JSON.stringify(privateCreate).includes('unit-root'), false);
  assert.equal(agentRequests.length, 1);
  assert.equal(agentRequests[0].canonicalApiRequest.path, '/api/agent/accounts/create');

  assert.equal(groupSettings.screen, 'agent_settings_overview');
  assert.equal(groupSettings.privateChatRequired, true);
  assert.equal(groupSettings.response.text.includes('Draft style:'), false);
  assert.match(flattenButtons(groupSettings.response.replyMarkup)[0].url, /^https:\/\/t\.me\/ce_demo_bot\?start=cetg_[a-z0-9]{10,48}$/);

  assert.equal(privateSettings.screen, 'agent_settings_overview');
  assert.match(privateSettings.response.text, /Draft style: balanced/);
  assert.equal(privateSettings.response.text.includes('Telegram reminders'), false);
  assert.equal(privateSettings.canonicalApiRequest.path, '/api/agent/settings');
  assert.equal(Object.hasOwn(privateSettings.settings, 'telegramReminders'), false);
});

test('settings edit callback stays private and points input collection at Mini App scaffold', async () => {
  const env = baseEnv();
  const settings = await buildTelegramCommandResponse({
    update: privateMessage('/settings'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const edit = flattenButtons(settings.response.replyMarkup)
    .find((button) => button.text === 'Edit Settings');
  const callback = await buildTelegramCommandResponse({
    update: {
      update_id: 7100,
      callback_query: {
        id: 'callback-edit-settings',
        data: edit.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 70,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(callback.ok, true);
  assert.equal(callback.screen, 'agent_settings_edit');
  assert.equal(callback.response.method, 'editMessageText');
  assert.match(callback.response.text, /Mini App is not configured/);
  assert.equal(callback.response.text.includes('Telegram reminders'), false);
  assert.equal(callback.canonicalApiRequest.path, '/api/agent/settings/update-request');
  assert.equal(callback.canonicalApiRequest.body.settingsPatchRef, 'telegram_settings_patch_ref');
  assert.equal(callback.canonicalApiRequest.body.idempotencyKey, 'provided_on_submit');
});

test('group /join returns a Workers-safe session card with opaque buttons only', async () => {
  const env = baseEnv();
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.command, '/join');
  assert.equal(result.screen, 'group_session_card');
  assert.equal(result.response.chatId, '-100123');
  assert.match(result.response.text, /Session: Alpha Session/);
  assert.equal(result.response.text.includes('/attachments'), false);
  assert.equal(result.response.text.includes('/me'), false);
  assert.equal(result.response.text.includes('Use /questions'), false);

  const buttons = flattenButtons(result.response.replyMarkup);
  const startButton = buttons.find((button) => button.text === 'Join Session');
  const callbackButtons = buttons.filter((button) => button.callback_data);
  assert.match(startButton.url, /^https:\/\/t\.me\/ce_demo_bot\?start=cetg_[a-z0-9]{10,48}$/);
  assert.equal(startButton.url.includes('alpha'), false);
  assert.equal(callbackButtons.length, 3);
  for (const button of callbackButtons) {
    assert.match(button.callback_data, /^cecb_[a-z0-9]{10,48}$/);
    assert.equal(button.callback_data.includes('alpha'), false);
    assert.equal(button.callback_data.includes('q-readiness'), false);
  }
});

test('/sessions does not expose registry-only sessions without telegram_only policy', async () => {
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/sessions'),
    env: {
      TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
      DEFAULT_CHAIN_ID: '11155420',
      DEFAULT_RPC_URL: 'https://public-rpc.example',
      ADDITIONAL_RPC_URL: 'https://infura.example/op-sepolia',
      REGISTRY_FETCH: registryFetchForSlugs(['alpha', 'e2e-smoke-noise', 'beta-room']),
    },
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'group_session_card');
  assert.match(result.response.text, /Sessions \(0\/0\)/);
  assert.equal(result.response.text.includes('- alpha (alpha)'), false);
  assert.equal(result.response.text.includes('- beta-room (beta-room)'), false);
  assert.equal(result.response.text.includes('e2e-smoke-noise'), false);
  assert.equal(result.response.text.includes('general'), false);
});

test('/sessions reads the current telegram_only policy list', async () => {
  const env = {
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'old-alpha',
      sessions: [{ sessionSlug: 'old-alpha', sessionName: 'Old Alpha', telegramBridgeEnabled: true, telegramOnly: true, telegramGroupOpenAccess: true }],
    }),
    AGENT_ACTION_KV: new MemoryKv(),
  };
  const stale = await buildTelegramCommandResponse({
    update: groupMessage('/sessions'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  env.AGENT_BRIDGE_SESSION_POLICY_JSON = JSON.stringify({
    defaultSessionSlug: 'old-alpha',
    sessions: [
      { sessionSlug: 'old-alpha', sessionName: 'Old Alpha', telegramBridgeEnabled: true, telegramOnly: true, telegramGroupOpenAccess: true },
      { sessionSlug: 'new-beta', sessionName: 'New Beta', telegramBridgeEnabled: true, telegramOnly: true, telegramGroupOpenAccess: true },
    ],
  });
  const fresh = await buildTelegramCommandResponse({
    update: groupMessage('/sessions'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.match(stale.response.text, /- old-alpha \(Old Alpha\)/);
  assert.equal(stale.response.text.includes('new-beta'), false);
  assert.match(fresh.response.text, /- old-alpha \(Old Alpha\)/);
  assert.match(fresh.response.text, /- new-beta \(New Beta\)/);
});

test('Telegram group allowlist filters and blocks group session binding', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          approvedTelegramGroupChatIds: ['-100999'],
        },
        {
          sessionSlug: 'beta',
          sessionName: 'Beta Session',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          approvedTelegramGroupChatIds: [{ chatId: '-100123', title: 'Alpha Lobby' }],
        },
        {
          sessionSlug: 'gamma',
          sessionName: 'Gamma Session',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          approvedTelegramGroupChatIds: ['-100123'],
        },
      ],
    }),
  });
  const sessions = await buildTelegramCommandResponse({
    update: groupMessage('/sessions'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const denied = await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const allowed = await buildTelegramCommandResponse({
    update: groupMessage('/join beta'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });
  const groupId = await buildTelegramCommandResponse({
    update: groupMessage('/group_id'),
    env,
    now: '2026-05-08T12:00:03.000Z',
  });
  await env.AGENT_ACTION_KV.put('telegram:group-session:-100123', JSON.stringify({
    version: 1,
    chatId: '-100123',
    sessionSlug: 'alpha',
    sessionName: 'Alpha Session',
    linkedAt: '2026-05-08T12:00:04.000Z',
  }));
  const staleStart = await buildTelegramCommandResponse({
    update: groupMessage('/start'),
    env,
    now: '2026-05-08T12:00:05.000Z',
  });

  assert.equal(sessions.response.text.includes('- alpha (Alpha Session)'), false);
  assert.match(sessions.response.text, /- beta \(Beta Session\)/);
  assert.match(sessions.response.text, /- gamma \(Gamma Session\)/);
  assert.equal(denied.screen, 'telegram_group_access_denied');
  assert.match(denied.response.text, /not approved for Alpha Session/);
  assert.match(denied.response.text, /Group ID: -100123/);
  assert.equal(allowed.screen, 'group_session_card');
  assert.match(allowed.response.text, /Session: Beta Session/);
  assert.equal(groupId.screen, 'telegram_group_id');
  assert.match(groupId.response.text, /Telegram group ID: -100123/);
  assert.match(groupId.response.text, /Selected session: beta/);
  assert.equal(staleStart.response.text.includes('Session: Alpha Session'), false);
  assert.match(staleStart.response.text, /\/sessions - choose session/);
});

test('Telegram group access is closed by default until an admin or open-access policy allows it', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const closedPolicy = {
    defaultSessionSlug: 'alpha',
    sessions: [{
      sessionSlug: 'alpha',
      sessionName: 'Alpha Session',
      telegramBridgeEnabled: true,
      telegramOnly: true,
    }],
  };
  const deniedEnv = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify(closedPolicy),
  });
  const adminAddress = await privateManagedAccountAddress(baseEnv(), now);
  const adminEnv = baseEnv({
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: adminAddress,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify(closedPolicy),
  });
  const openEnv = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        telegramGroupOpenAccess: true,
      }],
    }),
  });

  const denied = await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env: deniedEnv,
    now,
  });
  const adminJoin = await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env: adminEnv,
    now,
  });
  const adminApproval = JSON.parse(await adminEnv.AGENT_ACTION_KV.get('telegram:group-approval:alpha:-100123'));
  const openJoin = await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env: openEnv,
    now,
  });

  assert.equal(denied.screen, 'telegram_group_access_denied');
  assert.match(denied.response.text, /not approved for Alpha Session/);
  assert.equal(await deniedEnv.AGENT_ACTION_KV.get('telegram:group-approval:alpha:-100123'), null);
  assert.equal(adminJoin.screen, 'group_session_card');
  assert.match(adminJoin.response.text, /Group auto-approved for Alpha Session by admin/);
  assert.equal(adminApproval.approvalTokenId, 'admin_launch');
  assert.equal(adminApproval.approvedByTelegramUserId, '42');
  assert.equal(adminApproval.approvedByAccountAddress, adminAddress.toLowerCase());
  assert.equal(openJoin.screen, 'group_session_card');
  assert.equal(await openEnv.AGENT_ACTION_KV.get('telegram:group-approval:alpha:-100123'), null);
});

test('admin-generated group approval link approves the first Telegram group that uses it', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const accountAddress = await privateManagedAccountAddress(baseEnv(), now);
  const env = baseEnv({
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: accountAddress,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        telegramGroupApprovalRequired: true,
      }],
    }),
  });
  const beforeApproval = await buildTelegramCommandResponse({
    update: groupMessage('/sessions'),
    env,
    now,
  });
  const link = await buildTelegramCommandResponse({
    update: privateMessage('/group_link alpha'),
    env,
    now,
  });
  const invite = flattenButtons(link.response.replyMarkup).find((button) => button.text === 'Add Bot To Group');
  const payload = new URL(invite.url).searchParams.get('startgroup');
  const approved = await buildTelegramCommandResponse({
    update: groupMessage(`/start ${payload}`),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const approvalRecord = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:group-approval:alpha:-100123'));
  const afterApproval = await buildTelegramCommandResponse({
    update: groupMessage('/sessions'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });
  const reusedElsewhere = await buildTelegramCommandResponse({
    update: groupMessageFrom(`/start ${payload}`, { chatId: -100999, title: 'Other Lobby' }),
    env,
    now: '2026-05-08T12:00:03.000Z',
  });

  assert.equal(beforeApproval.response.text.includes('- alpha (Alpha Session)'), false);
  assert.equal(link.screen, 'telegram_group_approval_link');
  assert.match(invite.url, /^https:\/\/t\.me\/ce_demo_bot\?startgroup=cetg_[a-z0-9]{10,58}$/);
  assert.equal(payload.length <= 64, true);
  assert.equal(approved.screen, 'telegram_group_approved');
  assert.match(approved.response.text, /Group approved for Alpha Session/);
  assert.equal(approvalRecord.chatId, '-100123');
  assert.equal(approvalRecord.sessionSlug, 'alpha');
  assert.match(afterApproval.response.text, /- alpha \(Alpha Session\)/);
  assert.equal(reusedElsewhere.screen, 'telegram_group_approval_token_used');
  assert.equal((await env.AGENT_ACTION_KV.get('telegram:group-approval:alpha:-100999')), null);
});

test('admin can revoke a Telegram group approval and close access again', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const accountAddress = await privateManagedAccountAddress(baseEnv(), now);
  const env = baseEnv({
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: accountAddress,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        telegramBridgeEnabled: true,
        telegramOnly: true,
      }],
    }),
  });
  await env.AGENT_ACTION_KV.put('telegram:group-approval:alpha:-100123', JSON.stringify({
    version: 1,
    type: 'telegram_group_approval',
    sessionSlug: 'alpha',
    sessionName: 'Alpha Session',
    chatId: '-100123',
    chatTitle: 'Alpha Lobby',
    approvedAt: now,
    approvedByTelegramUserId: '42',
    approvedByAccountAddress: accountAddress.toLowerCase(),
    approvalTokenId: 'admin_launch',
  }));

  const beforeRevoke = await buildTelegramCommandResponse({
    update: groupMessage('/sessions'),
    env,
    now,
  });
  const revoked = await buildTelegramCommandResponse({
    update: groupMessage('/group_revoke alpha'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const nonAdminJoin = await buildTelegramCommandResponse({
    update: groupMessageFrom('/join alpha', { telegramUserId: 99, username: 'guest' }),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });

  assert.match(beforeRevoke.response.text, /- alpha \(Alpha Session\)/);
  assert.equal(revoked.screen, 'telegram_group_approval_revoked');
  assert.match(revoked.response.text, /approval revoked/);
  assert.equal(await env.AGENT_ACTION_KV.get('telegram:group-approval:alpha:-100123'), null);
  assert.equal(nonAdminJoin.screen, 'telegram_group_access_denied');
});

test('/sessions paginates tall Telegram session lists', async () => {
  const env = {
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'one',
      sessions: ['one', 'two', 'three', 'four', 'five', 'six'].map((slug) => ({
        sessionSlug: slug,
        sessionName: slug,
        telegramBridgeEnabled: true,
        telegramOnly: true,
        telegramGroupOpenAccess: true,
      })),
    }),
    AGENT_ACTION_KV: new MemoryKv(),
  };
  const first = await buildTelegramCommandResponse({
    update: groupMessage('/sessions'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const buttons = flattenButtons(first.response.replyMarkup);
  const loadNext = buttons.find((button) => button.text === 'Load Next');
  assert.match(first.response.text, /Sessions \(5\/6\)/);
  assert.equal(first.response.text.includes('- six (six)'), false);
  assert.equal(nonNavigationButtons(first.response.replyMarkup).filter((button) => button.callback_data).length, 6);
  assert.equal(buttons.some((button) => button.text === 'Back to Start'), true);

  const second = await buildTelegramCommandResponse({
    update: {
      update_id: 7007,
      callback_query: {
        id: 'session-page-next',
        data: loadNext.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 57,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  assert.match(second.response.text, /Sessions \(6\/6\)/);
  assert.match(second.response.text, /- six \(six\)/);
  assert.equal(flattenButtons(second.response.replyMarkup).some((button) => button.text === 'Load Next'), false);
});

test('/sessions lists only Telegram-enabled sessions', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_OPENAI_API_KEY: 'sk-bridge-openai',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          telegramBridgeEnabled: true, telegramOnly: true, telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'beta',
          sessionName: 'Beta Session',
          telegramBridgeEnabled: true, telegramOnly: true, telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: false,
        },
        {
          sessionSlug: 'gamma',
          sessionName: 'Gamma Session',
          telegramBridgeEnabled: false,
          managedAccountSubmitAllowed: true,
        },
      ],
    }),
  });
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/sessions'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.match(result.response.text, /Sessions \(2\/2\)/);
  assert.match(result.response.text, /- alpha \(Alpha Session\)/);
  assert.match(result.response.text, /- beta \(Beta Session\)/);
  assert.equal(result.response.text.includes('Gamma Session'), false);
  assert.deepEqual(nonNavigationButtons(result.response.replyMarkup).map((button) => button.text), ['Alpha Session', 'Beta Session']);
  assert.equal(flattenButtons(result.response.replyMarkup).some((button) => button.text === 'Back to Start'), true);
});

test('/sessions and /start honor the Cloudflare Telegram session created-after cutoff', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_MINI_APP_URL: 'https://mini.example/telegram/mini-app',
    AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER: '2026-05-20T00:00:00.000Z',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'old-alpha',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'old-alpha',
          sessionName: 'Old Alpha',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          createdAt: '2026-05-19T23:59:59.000Z',
        },
        {
          sessionSlug: 'new-beta',
          sessionName: 'New Beta',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          telegramGroupOpenAccess: true,
          createdAt: '2026-05-20T00:00:00.000Z',
        },
        {
          sessionSlug: 'missing-created-at',
          sessionName: 'Missing Created At',
          telegramBridgeEnabled: true,
          telegramOnly: true,
        },
      ],
    }),
  });

  const sessions = await buildTelegramCommandResponse({
    update: privateMessage('/sessions'),
    env,
    now: '2026-05-21T12:00:00.000Z',
  });
  assert.equal(sessions.ok, true);
  assert.match(sessions.response.text, /Sessions \(2\/2\)/);
  assert.match(sessions.response.text, /- old-alpha \(Old Alpha\)/);
  assert.match(sessions.response.text, /- new-beta \(New Beta\)/);
  assert.equal(sessions.response.text.includes('Missing Created At'), false);
  assert.deepEqual(nonNavigationButtons(sessions.response.replyMarkup).map((button) => button.text), ['Old Alpha', 'New Beta']);

  const start = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env,
    now: '2026-05-21T12:00:01.000Z',
  });
  assert.equal(start.ok, true);
  assert.match(start.response.text, /\/sessions - choose session/);
  const binding = await env.AGENT_ACTION_KV.get('telegram:private-session:42');
  assert.equal(binding, null);
});

test('/sessions keeps the default visible when the cutoff is newer than its createdAt', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER: '2026-05-20T00:00:00.000Z',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'old-default',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'old-default',
          sessionName: 'Old Default',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          createdAt: '2026-05-19T00:00:00.000Z',
        },
        {
          sessionSlug: 'old-non-default',
          sessionName: 'Old Non Default',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          createdAt: '2026-05-19T12:00:00.000Z',
        },
        {
          sessionSlug: 'new-non-default',
          sessionName: 'New Non Default',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          createdAt: '2026-05-20T00:00:00.000Z',
        },
        {
          sessionSlug: 'e2e-new',
          sessionName: 'E2E New Session',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          createdAt: '2026-05-21T00:00:00.000Z',
        },
      ],
    }),
  });

  const sessions = await buildTelegramCommandResponse({
    update: privateMessage('/sessions'),
    env,
    now: '2026-05-21T12:00:00.000Z',
  });

  assert.equal(sessions.ok, true);
  assert.match(sessions.response.text, /Sessions \(2\/2\)/);
  assert.match(sessions.response.text, /- old-default \(Old Default\)/);
  assert.match(sessions.response.text, /- new-non-default \(New Non Default\)/);
  assert.equal(sessions.response.text.includes('Old Non Default'), false);
  assert.equal(sessions.response.text.includes('E2E New Session'), false);
  assert.deepEqual(nonNavigationButtons(sessions.response.replyMarkup).map((button) => button.text), [
    'Old Default',
    'New Non Default',
  ]);
});

test('/sessions keeps the default visible when cutoff metadata is missing', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER: '2026-05-20T00:00:00.000Z',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'metadata-free-default',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'metadata-free-default',
          sessionName: 'Metadata Free Default',
          telegramBridgeEnabled: true,
          telegramOnly: true,
        },
        {
          sessionSlug: 'metadata-free-other',
          sessionName: 'Metadata Free Other',
          telegramBridgeEnabled: true,
          telegramOnly: true,
        },
        {
          sessionSlug: 'fresh-session',
          sessionName: 'Fresh Session',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          createdAt: '2026-05-21T00:00:00.000Z',
        },
      ],
    }),
  });

  const sessions = await buildTelegramCommandResponse({
    update: privateMessage('/sessions'),
    env,
    now: '2026-05-21T12:00:00.000Z',
  });

  assert.equal(sessions.ok, true);
  assert.match(sessions.response.text, /Sessions \(2\/2\)/);
  assert.match(sessions.response.text, /- metadata-free-default \(Metadata Free Default\)/);
  assert.match(sessions.response.text, /- fresh-session \(Fresh Session\)/);
  assert.equal(sessions.response.text.includes('Metadata Free Other'), false);
  assert.deepEqual(nonNavigationButtons(sessions.response.replyMarkup).map((button) => button.text), [
    'Metadata Free Default',
    'Fresh Session',
  ]);
});

test('/sessions can use the Edge 2026 cutoff to hide the test session', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_TELEGRAM_SESSION_CREATED_AFTER: '2026-05-29T01:00:00.000Z',
    AGENT_BRIDGE_SESSION_POLICY_NOW: '2026-05-30T00:00:00.000Z',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'ee-26-organizers',
      defaultSessionSchedule: [
        { sessionSlug: 'ee-26-organizers', until: '2026-05-30T00:00:00Z' },
        { sessionSlug: 'ee-26-users', from: '2026-05-30T00:00:00Z' },
      ],
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'ee-26-test',
          sessionName: 'EE26 Test',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          createdAt: '2026-05-29T00:00:00Z',
        },
        {
          sessionSlug: 'ee-26-organizers',
          sessionName: 'EE26 Organizers',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          telegramGroupOpenAccess: true,
          createdAt: '2026-05-29T01:00:00Z',
        },
        {
          sessionSlug: 'ee-26-users',
          sessionName: 'EE26 Users',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          telegramGroupOpenAccess: true,
          createdAt: '2026-05-29T02:00:00Z',
        },
      ],
    }),
  });

  const sessions = await buildTelegramCommandResponse({
    update: groupMessage('/sessions'),
    env,
    now: '2026-05-30T00:00:01.000Z',
  });

  assert.equal(sessions.ok, true);
  assert.match(sessions.response.text, /Sessions \(2\/2\)/);
  assert.equal(sessions.response.text.includes('EE26 Test'), false);
  assert.match(sessions.response.text, /- ee-26-organizers \(EE26 Organizers\)/);
  assert.match(sessions.response.text, /- ee-26-users \(EE26 Users\)/);
  assert.deepEqual(nonNavigationButtons(sessions.response.replyMarkup).map((button) => button.text), [
    'EE26 Organizers',
    'EE26 Users',
  ]);

  const start = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env,
    now: '2026-05-30T00:00:02.000Z',
  });
  assert.equal(start.ok, true);
  assert.match(start.response.text, /\/sessions - choose session/);
});

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

test('/set_default is private-chat only and admin-gated', async () => {
  const now = '2026-05-29T12:00:00.000Z';
  const kv = new MemoryKv();
  const adminAddress = await privateManagedAccountAddress(baseEnv(), now);
  const env = baseEnv({
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: adminAddress,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        { sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true },
        { sessionSlug: 'beta', sessionName: 'Beta', telegramBridgeEnabled: true, telegramOnly: true },
      ],
    }),
  });
  const nonAdminEnv = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: env.AGENT_BRIDGE_SESSION_POLICY_JSON,
  });

  const groupDenied = await buildTelegramCommandResponse({
    update: groupMessage('/set_default beta'),
    env,
    now,
  });
  const adminDenied = await buildTelegramCommandResponse({
    update: privateMessage('/set_default beta'),
    env: nonAdminEnv,
    now,
  });
  const unknown = await buildTelegramCommandResponse({
    update: privateMessage('/set_default missing'),
    env,
    now,
  });
  const set = await buildTelegramCommandResponse({
    update: privateMessage('/set_default beta'),
    env,
    now,
  });
  const putsAfterSet = kv.putCalls.length;
  const status = await buildTelegramCommandResponse({
    update: privateMessage('/set_default'),
    env,
    now,
  });

  assert.equal(groupDenied.screen, 'admin_default_session_private_required');
  assert.equal(adminDenied.screen, 'admin_default_session_denied');
  assert.equal(adminDenied.ok, false);
  assert.equal(unknown.screen, 'admin_default_session_invalid');
  assert.equal(unknown.ok, false);
  assert.equal(set.screen, 'admin_default_session_set');
  assert.match(set.response.text, /Default session pinned to Beta/);
  assert.equal(JSON.parse(await kv.get('telegram:admin-default-session:v1')).sessionSlug, 'beta');
  assert.equal(status.screen, 'admin_default_session_status');
  assert.match(status.response.text, /Effective default: beta/);
  assert.match(status.response.text, /Admin pin: beta/);
  assert.equal(kv.putCalls.length, putsAfterSet);

  const clear = await buildTelegramCommandResponse({
    update: privateMessage('/set_default clear'),
    env,
    now,
  });

  assert.equal(clear.screen, 'admin_default_session_cleared');
  assert.equal(await kv.get('telegram:admin-default-session:v1'), null);
});

test('private voice message updates the latest Mini App launch draft', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_MINI_APP_URL: 'https://bridge.example/telegram/mini-app',
    AGENT_BRIDGE_DEPLOYMENT_ID: 'test-deploy',
    AGENT_BRIDGE_OPENAI_API_KEY: 'sk-bridge-openai',
    AGENT_BRIDGE_TRANSCRIBE_RATE_LIMIT: '1',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        telegramBridgeEnabled: true,
        telegramOnly: true,
        telegramGroupOpenAccess: true,
        managedAccountSubmitAllowed: true,
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session.example',
      }],
    }),
  });
  const launch = 'cecb_voice_draft';
  await env.AGENT_ACTION_KV.put(`telegram:action:${launch}`, JSON.stringify({
    action: 'submit_response',
    lane: 'telegram_mini_app',
    callbackData: launch,
    miniAppLaunch: true,
    serverContextRef: {
      sessionSlug: 'alpha',
      questionId: 'q-readiness',
      questionSeries: {
        questionIds: ['q-readiness'],
        skippedQuestionIds: [],
        draftAnswersByQuestionId: {
          'q-readiness': { text: 'Existing draft' },
        },
      },
    },
  }));
  await env.AGENT_ACTION_KV.put('telegram:mini-app-latest-launch:v1:42', JSON.stringify({
    type: 'telegram_mini_app_latest_launch',
    version: 1,
    telegramUserId: '42',
    sessionSlug: 'alpha',
    launch,
    questionIds: ['q-readiness'],
    updatedAt: '2026-05-29T12:00:00.000Z',
  }));
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, init });
    if (target.endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-voice' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/getFile')) {
      const body = JSON.parse(init.body);
      assert.equal(body.file_id, 'voice-file-1');
      return new Response(JSON.stringify({
        ok: true,
        result: { file_path: 'voice/file_1.ogg' },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.includes('/file/bot123456:test-token/voice/file_1.ogg')) {
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'audio/ogg' },
      });
    }
    if (target.endsWith('/transcribe')) {
      assert.equal(init.headers.Authorization, 'Bearer worker-token');
      assert.equal(init.body.get('model'), 'whisper-1');
      assert.equal(init.body.get('apiKey'), 'sk-bridge-openai');
      assert.equal(init.body.get('file').name, 'file_1.ogg');
      return new Response(JSON.stringify({ text: 'spoken update' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: `unexpected ${target}` }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await buildTelegramCommandResponse({
    update: privateVoiceMessage(),
    env,
    fetchImpl,
    now: '2026-05-29T12:05:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'mini_app_voice_draft_fallback');
  assert.match(result.response.text, /Updated the Mini App draft/);
  assert.equal(flattenButtons(result.response.replyMarkup)[0].text, 'Review Draft');
  const stored = JSON.parse(await env.AGENT_ACTION_KV.get(`telegram:action:${launch}`));
  assert.equal(
    stored.serverContextRef.questionSeries.draftAnswersByQuestionId['q-readiness'].text,
    'Existing draft\n\nspoken update'
  );
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    '/auth/nonce',
    '/auth/login',
    '/bot123456:test-token/getFile',
    '/file/bot123456:test-token/voice/file_1.ogg',
    '/transcribe',
  ]);

  const second = await buildTelegramCommandResponse({
    update: privateVoiceMessage({ fileId: 'voice-file-2' }),
    env,
    fetchImpl,
    now: '2026-05-29T12:06:00.000Z',
  });
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'transcribe_rate_limited');
  assert.match(second.response.text, /temporarily rate limited/);
  assert.equal(calls.length, 5);
});

test('/questions and callback dispatch list questions without leaking locked prompts', async () => {
  const env = baseEnv();
  const joined = await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const viewQuestions = flattenButtons(joined.response.replyMarkup)
    .find((button) => button.text === 'View Questions');
  const callback = await buildTelegramCommandResponse({
    update: {
      update_id: 7003,
      callback_query: {
        id: 'callback-1',
        data: viewQuestions.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 55,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(callback.ok, true);
  assert.equal(callback.response.method, 'editMessageText');
  assert.match(callback.response.text, /^Questions \(2\/2\)\n\n1\. What should Alpha decide next\?/);
  assert.equal(callback.response.text.includes('Choose a question'), false);
  assert.deepEqual(nonNavigationButtons(callback.response.replyMarkup).map((button) => button.text), [
    'Pose 1',
    'Pose 2',
  ]);
  assert.equal(callback.response.text.includes('q-readiness'), false);
  assert.equal(callback.response.text.includes('q-locked'), false);
  assert.equal(callback.response.text.includes('Private prompt must not leak'), false);
  assert.match(callback.response.text, /2\. Requires session access/);
});

test('/questions handles bytes32 question IDs without putting them in opaque seeds', async () => {
  const publicQuestionId = `0x${'12'.repeat(32)}`;
  const lockedQuestionId = `0x${'34'.repeat(32)}`;
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/questions alpha'),
    env: baseEnv({
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
        {
          questionId: publicQuestionId,
          questionType: 'freeform',
          prompt: 'Can bytes32 question IDs render?',
        },
        {
          questionId: lockedQuestionId,
          questionType: 'freeform',
          prompt: 'Locked bytes32 prompt must not leak',
          visibility: 'lit_encrypted',
        },
      ]),
    }),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'question_list');
  assert.match(result.response.text, /^Questions \(2\/2\)\n\n1\. Can bytes32 question IDs render\?/);
  assert.equal(result.response.text.includes('0x12121212'), false);
  assert.equal(result.response.text.includes('0x34343434'), false);
  assert.equal(result.response.text.includes('Locked bytes32 prompt must not leak'), false);
  assert.match(result.response.text, /2\. Encrypted question/);
  const buttons = flattenButtons(result.response.replyMarkup);
  assert.equal(nonNavigationButtons(result.response.replyMarkup).length, 2);
  assert.deepEqual(nonNavigationButtons(result.response.replyMarkup).map((button) => button.text), [
    'Pose 1',
    'Pose 2',
  ]);
  assert.equal(buttons.some((button) => button.text === 'Back to Start'), true);
  for (const button of buttons) {
    assert.match(button.callback_data, /^cecb_[a-z0-9]{10,48}$/);
    assert.equal(button.callback_data.includes(publicQuestionId), false);
    assert.equal(button.callback_data.includes(lockedQuestionId), false);
  }
});

test('/questions assigns stable numbers that survive list reordering', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: 'q-alpha-first',
        questionType: 'freeform',
        prompt: 'Alpha first question?',
      },
      {
        questionId: 'q-alpha-second',
        questionType: 'freeform',
        prompt: 'Alpha second question?',
      },
    ]),
  });

  const firstList = await buildTelegramCommandResponse({
    update: groupMessage('/questions alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(firstList.ok, true);
  assert.match(firstList.response.text, /1\. Alpha first question\?/);
  assert.match(firstList.response.text, /2\. Alpha second question\?/);
  assert.doesNotMatch(firstList.response.text, /\(#\d+\)/);
  assert.match(firstList.response.text, /Alpha first question\?\n\n2\. Alpha second question\?/);
  assert.equal(flattenButtons(firstList.response.replyMarkup).some((button) => button.text === 'Back to Start'), true);

  env.AGENT_BRIDGE_DEMO_QUESTIONS_JSON = JSON.stringify([
    {
      questionId: 'q-alpha-second',
      questionType: 'freeform',
      prompt: 'Alpha second question?',
    },
    {
      questionId: 'q-alpha-new',
      questionType: 'freeform',
      prompt: 'Alpha new question?',
    },
    {
      questionId: 'q-alpha-first',
      questionType: 'freeform',
      prompt: 'Alpha first question?',
    },
  ]);

  const reorderedList = await buildTelegramCommandResponse({
    update: groupMessage('/questions alpha'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const stablePose = await buildTelegramCommandResponse({
    update: groupMessage('/q 2'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });
  const namedStablePose = await buildTelegramCommandResponse({
    update: groupMessage('/q question 3'),
    env,
    now: '2026-05-08T12:00:03.000Z',
  });

  assert.match(reorderedList.response.text, /1\. Alpha second question\?/);
  assert.match(reorderedList.response.text, /2\. Alpha new question\?/);
  assert.match(reorderedList.response.text, /3\. Alpha first question\?/);
  assert.doesNotMatch(reorderedList.response.text, /\(#\d+\)/);
  assert.equal(stablePose.ok, true);
  assert.match(stablePose.response.text, /Alpha second question\?/);
  assert.equal(stablePose.response.text.includes('Alpha new question?'), false);
  assert.equal(namedStablePose.ok, true);
  assert.match(namedStablePose.response.text, /Alpha new question\?/);

  const map = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:question-number:alpha'));
  assert.equal(map.questionIdToNumber['q-alpha-first'], 1);
  assert.equal(map.questionIdToNumber['q-alpha-second'], 2);
  assert.equal(map.questionIdToNumber['q-alpha-new'], 3);
  assert.equal(map.nextNumber, 4);
});

test('/questions caps Telegram rows at five and keeps the chat page minimal', async () => {
  const questions = Array.from({ length: 7 }, (_value, index) => ({
    questionId: `q-${index + 1}`,
    questionType: index % 2 === 0 ? 'freeform' : 'rating',
    prompt: `Question ${index + 1} prompt`,
  }));
  const env = baseEnv({
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify(questions),
  });
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/questions alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.match(result.response.text, /^Questions \(5\/7\)\n\n1\. Question 1 prompt/);
  assert.equal(result.response.text.includes('Open the Mini App for the full queue'), false);
  assert.equal(result.response.text.includes('5. Question 5 prompt'), true);
  assert.equal(result.response.text.includes('Question 6 prompt'), false);

  const buttons = flattenButtons(result.response.replyMarkup);
  assert.deepEqual(buttons.slice(0, 5).map((button) => button.text), [
    'Pose 1',
    'Pose 2',
    'Pose 3',
    'Pose 4',
    'Pose 5',
  ]);
  const loadNext = buttons.find((button) => button.text === 'Load Next');
  assert.match(loadNext.callback_data, /^cecb_[a-z0-9]{10,48}$/);
  assert.equal(buttons.some((button) => button.text === 'Open Mini App'), false);

  const nextPage = await buildTelegramCommandResponse({
    update: {
      update_id: 7008,
      callback_query: {
        id: 'question-page-next',
        data: loadNext.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 58,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  assert.match(nextPage.response.text, /^Questions \(7\/7\)\n\n6\. Question 6 prompt/);
  assert.equal(nextPage.response.text.includes('7. Question 7 prompt'), true);
  assert.equal(flattenButtons(nextPage.response.replyMarkup).some((button) => button.text === 'Load Next'), false);
});

test('/questions omits Mini App buttons in private chat', async () => {
  const result = await buildTelegramCommandResponse({
    update: privateMessage('/questions alpha'),
    env: baseEnv({
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
        { questionId: 'q-private-1', questionType: 'freeform', prompt: 'Private prompt?' },
      ]),
    }),
    now: '2026-05-08T12:00:00.000Z',
  });
  assert.equal(result.ok, true);
  assert.equal(flattenButtons(result.response.replyMarkup).some((button) => button.text === 'Open Mini App'), false);
});

test('/questions prioritizes answerable questions before payload-unavailable rows', async () => {
  const unavailableQuestionId = `0x${'11'.repeat(32)}`;
  const answerableQuestionId = `0x${'22'.repeat(32)}`;
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/questions alpha'),
    env: baseEnv({
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
        {
          questionId: unavailableQuestionId,
          questionType: 'unknown',
          title: 'Question unavailable',
          payloadUnavailable: true,
          visibility: 'payload_unavailable',
        },
        {
          questionId: answerableQuestionId,
          questionType: 'rating',
          prompt: 'How much do you trust this result?',
        },
      ]),
    }),
    now: '2026-05-08T12:00:00.000Z',
  });
  const posed = await buildTelegramCommandResponse({
    update: groupMessage('/q 1'),
    env: baseEnv({
      AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
        {
          questionId: unavailableQuestionId,
          questionType: 'unknown',
          title: 'Question unavailable',
          payloadUnavailable: true,
          visibility: 'payload_unavailable',
        },
        {
          questionId: answerableQuestionId,
          questionType: 'rating',
          prompt: 'How much do you trust this result?',
        },
      ]),
    }),
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(result.ok, true);
  assert.match(result.response.text, /^Questions \(2\/2\)\n\n1\. How much do you trust this result\?/);
  assert.match(result.response.text, /2\. Failed to load question prompt\./);
  assert.deepEqual(flattenButtons(result.response.replyMarkup).slice(0, 2).map((button) => button.text), [
    'Pose 1',
    'Pose 2',
  ]);
  assert.equal(result.response.text.includes('0x22222222'), false);
  assert.equal(result.response.text.includes('0x11111111'), false);
  assert.equal(posed.ok, true);
  assert.match(posed.response.text, /How much do you trust this result\?/);
  assert.equal(posed.payloadUnavailable, false);
  assert.equal(posed.posed, true);
});

test('payload-unavailable question rows do not render as encrypted locks', async () => {
  const unavailableQuestionId = `0x${'78'.repeat(32)}`;
  const env = baseEnv({
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: unavailableQuestionId,
        questionType: 'unknown',
        title: 'Question unavailable',
        payloadUnavailable: true,
        visibility: 'payload_unavailable',
      },
      {
        questionId: `0x${'90'.repeat(32)}`,
        questionType: 'freeform',
        prompt: 'Encrypted prompt must not leak',
        visibility: 'lit_encrypted',
      },
    ]),
  });
  const list = await buildTelegramCommandResponse({
    update: groupMessage('/questions alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const posed = await buildTelegramCommandResponse({
    update: groupMessage(`/q ${unavailableQuestionId.slice(0, 10)}...${unavailableQuestionId.slice(-6)}`),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(list.ok, true);
  assert.match(list.response.text, /^Questions \(2\/2\)/);
  assert.match(list.response.text, /Failed to load question prompt\./);
  assert.match(list.response.text, /Encrypted question/);
  assert.deepEqual(flattenButtons(list.response.replyMarkup).slice(0, 2).map((button) => button.text), [
    'Pose 1',
    'Pose 2',
  ]);
  assert.equal(list.response.text.includes('0x78787878'), false);
  assert.equal(list.response.text.includes('0x90909090'), false);
  assert.equal(list.response.text.includes('Encrypted prompt must not leak'), false);

  assert.equal(posed.ok, true);
  assert.match(posed.response.text, /Question is unavailable/);
  assert.equal(posed.response.text.includes('0x78787878'), false);
  assert.match(posed.response.text, /public payload could not be loaded yet/);
  const buttons = flattenButtons(posed.response.replyMarkup);
  assert.equal(buttons.some((button) => button.text === 'Open Mini App'), false);
  assert.equal(posed.payloadUnavailable, true);
  assert.equal(posed.posed, false);
});

test('/results consensus shows top difference questions from submitted records', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: 'q-a',
        questionType: 'agree_unsure_disagree',
        prompt: 'Should the group block launch?',
      },
      {
        questionId: 'q-b',
        questionType: 'agree_unsure_disagree',
        prompt: 'Should the group publish the summary?',
      },
      {
        questionId: 'q-c',
        questionType: 'agree_unsure_disagree',
        prompt: 'Should the group add a risk review?',
      },
      {
        questionId: 'q-d',
        questionType: 'agree_unsure_disagree',
        prompt: 'Should the group run another pilot?',
      },
      {
        questionId: 'q-freeform',
        questionType: 'freeform',
        prompt: 'What should the group write in the open note?',
      },
    ]),
  });
  let counter = 0;
  async function putResponse(questionId, telegramUserId, label) {
    counter += 1;
    await env.AGENT_ACTION_KV.put(`telegram:submit-request:${counter}`, JSON.stringify({
      status: 'direct_submitted',
      sessionSlug: 'alpha',
      telegramUserId,
      questionId,
      answer: { label, value: label.toLowerCase() },
      onChain: { ok: true, txHash: `0x${String(counter).padStart(2, '0').repeat(32)}` },
      createdAt: `2026-05-08T12:00:${String(counter).padStart(2, '0')}.000Z`,
    }));
  }
  await putResponse('q-a', '1', 'Agree');
  await putResponse('q-a', '2', 'Agree');
  await putResponse('q-a', '3', 'Disagree');
  await putResponse('q-a', '4', 'Disagree');
  await putResponse('q-b', '1', 'Agree');
  await putResponse('q-b', '2', 'Disagree');
  await putResponse('q-c', '1', 'Agree');
  await putResponse('q-c', '2', 'Disagree');
  await putResponse('q-d', '1', 'Agree');
  await putResponse('q-d', '2', 'Disagree');
  await putResponse('q-freeform', '1', 'Agree');
  await putResponse('q-freeform', '2', 'Disagree');

  const result = await buildTelegramCommandResponse({
    update: groupMessage('/results consensus'),
    env,
    now: '2026-05-08T12:01:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'results_consensus');
  assert.equal(result.response.method, 'sendPhoto');
  assert.equal(result.response.photo.contentType, 'image/png');
  assert.deepEqual(Array.from(result.response.photo.bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(result.response.text, /^Beeswarm/);
  assert.match(result.response.text, /Live responses: 12/);
  assert.match(result.response.text, /Most difference 1-3 of 4/);
  assert.match(result.response.text, /1\. ● Should the group block launch\?/);
  assert.match(result.response.text, /Agree 2 \| Disagree 2/);
  assert.match(result.response.text, /2\. ● Should the group add a risk review\?/);
  assert.match(result.response.text, /3\. ● Should the group publish the summary\?/);
  assert.equal(result.response.text.includes('Should the group run another pilot?'), false);
  assert.equal(result.response.text.includes('open note'), false);
  assert.deepEqual(flattenButtons(result.response.replyMarkup).map((button) => button.text), ['Next 3']);
  assert.equal(result.response.text.includes('Demo mode'), false);

  const nextButton = flattenButtons(result.response.replyMarkup).find((button) => button.text === 'Next 3');
  const next = await buildTelegramCommandResponse({
    update: {
      update_id: 7010,
      callback_query: {
        id: 'callback-results-next',
        data: nextButton.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 72,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:01:01.000Z',
  });

  assert.equal(next.ok, true);
  assert.equal(next.screen, 'results_consensus');
  assert.match(next.response.text, /Most difference 4-4 of 4/);
  assert.match(next.response.text, /4\. ● Should the group run another pilot\?/);
  assert.deepEqual(flattenButtons(next.response.replyMarkup).map((button) => button.text), ['Previous 3']);
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

test('/results group shows participant graph with question legend', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-1', questionType: 'freeform', prompt: 'First prompt?' },
      { questionId: 'q-2', questionType: 'freeform', prompt: 'Second prompt?' },
    ]),
  });
  await env.AGENT_ACTION_KV.put('telegram:submit-request:one', JSON.stringify({
    status: 'direct_submitted',
    sessionSlug: 'alpha',
    telegramUserId: '42',
    questionId: 'q-1',
    answer: { label: 'Agree', value: 'agree' },
    onChain: { ok: true },
    createdAt: '2026-05-08T12:00:00.000Z',
  }));
  await env.AGENT_ACTION_KV.put('telegram:submit-request:two', JSON.stringify({
    status: 'direct_submitted',
    sessionSlug: 'alpha',
    telegramUserId: '42',
    questionId: 'q-2',
    answer: { label: 'Unsure', value: 'unsure' },
    onChain: { ok: true },
    createdAt: '2026-05-08T12:00:01.000Z',
  }));
  await env.AGENT_ACTION_KV.put('telegram:submit-request:three', JSON.stringify({
    status: 'direct_submitted',
    sessionSlug: 'alpha',
    telegramUserId: '43',
    questionId: 'q-1',
    answer: { label: 'Disagree', value: 'disagree' },
    onChain: { ok: true },
    createdAt: '2026-05-08T12:00:02.000Z',
  }));
  await env.AGENT_ACTION_KV.put('telegram:submit-request:four', JSON.stringify({
    status: 'direct_submitted',
    sessionSlug: 'alpha',
    telegramUserId: '43',
    questionId: 'q-2',
    answer: { label: 'Agree', value: 'agree' },
    onChain: { ok: true },
    createdAt: '2026-05-08T12:00:03.000Z',
  }));

  const result = await buildTelegramCommandResponse({
    update: groupMessage('/results group'),
    env,
    now: '2026-05-08T12:01:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'results_group');
  assert.equal(result.response.method, 'sendPhoto');
  assert.equal(result.response.photo.contentType, 'image/png');
  assert.match(result.response.text, /^Participants graph/);
  assert.match(result.response.text, /Responses: 4/);
  assert.match(result.response.text, /Choose a group to analyze\./);
  assert.match(result.response.text, /P1 -> Q1:Agree, Q2:Unsure/);
  assert.match(result.response.text, /P2 -> Q1:Disagree, Q2:Agree/);
  assert.match(result.response.text, /1\. First prompt\?/);
  assert.deepEqual(flattenButtons(result.response.replyMarkup).map((button) => button.text), [
    'Analyze Group 1',
    'Analyze Group 2',
  ]);
});

test('/results group analysis callback uses session worker AI for the selected participant group', async () => {
  const calls = [];
  const env = baseEnv({
    AGENT_BRIDGE_OPENAI_API_KEY: 'sk-bridge-openai',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true, telegramOnly: true,
        telegramGroupOpenAccess: true,
        managedAccountSubmitAllowed: true,
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session-worker.example',
      }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-1', questionType: 'agree_unsure_disagree', prompt: 'Should Alpha ship quickly?' },
      { questionId: 'q-2', questionType: 'agree_unsure_disagree', prompt: 'Should Alpha pause for review?' },
      { questionId: 'q-3', questionType: 'freeform', prompt: 'What context should the group consider?' },
    ]),
  });
  env.AGENT_BRIDGE_FETCH = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, init });
    if (target.endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token', exp: 2000000000 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/ai')) {
      assert.equal(init.headers.Authorization, 'Bearer worker-token');
      const body = JSON.parse(init.body || '{}');
      assert.equal(body.apiKey, 'sk-bridge-openai');
      assert.match(body.messages?.[1]?.content || '', /Top statements/);
      assert.match(body.messages?.[1]?.content || '', /Additional comments and freeform responses/);
      assert.match(body.messages?.[1]?.content || '', /Shipping is okay if rollback is ready/);
      assert.match(body.messages?.[1]?.content || '', /Check the venue capacity before launch/);
      return new Response(JSON.stringify({
        completion: JSON.stringify({
          name: 'Launch Balancers',
          short: 'They support moving forward while still noticing review tradeoffs.',
          long: 'This group is more favorable toward shipping quickly than the overall room. Its strongest distinction is willingness to proceed while others hold more concern.',
        }),
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'unexpected route' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  };
  await env.AGENT_ACTION_KV.put('telegram:submit-request:one', JSON.stringify({
    status: 'direct_submitted',
    sessionSlug: 'alpha',
    telegramUserId: '42',
    questionId: 'q-1',
    answer: { label: 'Agree', value: 'agree', comments: 'Shipping is okay if rollback is ready.' },
    onChain: { ok: true },
    createdAt: '2026-05-08T12:00:00.000Z',
  }));
  await env.AGENT_ACTION_KV.put('telegram:submit-request:two', JSON.stringify({
    status: 'direct_submitted',
    sessionSlug: 'alpha',
    telegramUserId: '42',
    questionId: 'q-2',
    answer: { label: 'Agree', value: 'agree' },
    onChain: { ok: true },
    createdAt: '2026-05-08T12:00:01.000Z',
  }));
  await env.AGENT_ACTION_KV.put('telegram:submit-request:freeform', JSON.stringify({
    status: 'direct_submitted',
    sessionSlug: 'alpha',
    telegramUserId: '42',
    questionId: 'q-3',
    answer: { questionType: 'freeform', text: 'Check the venue capacity before launch.' },
    onChain: { ok: true },
    createdAt: '2026-05-08T12:00:01.500Z',
  }));
  await env.AGENT_ACTION_KV.put('telegram:submit-request:three', JSON.stringify({
    status: 'direct_submitted',
    sessionSlug: 'alpha',
    telegramUserId: '43',
    questionId: 'q-1',
    answer: { label: 'Disagree', value: 'disagree' },
    onChain: { ok: true },
    createdAt: '2026-05-08T12:00:02.000Z',
  }));
  await env.AGENT_ACTION_KV.put('telegram:submit-request:four', JSON.stringify({
    status: 'direct_submitted',
    sessionSlug: 'alpha',
    telegramUserId: '43',
    questionId: 'q-2',
    answer: { label: 'Disagree', value: 'disagree' },
    onChain: { ok: true },
    createdAt: '2026-05-08T12:00:03.000Z',
  }));

  const graph = await buildTelegramCommandResponse({
    update: groupMessage('/results group'),
    env,
    now: '2026-05-08T12:01:00.000Z',
  });
  const analyze = flattenButtons(graph.response.replyMarkup)
    .find((button) => button.text === 'Analyze Group 1');
  const analysis = await buildTelegramCommandResponse({
    update: {
      update_id: 7012,
      callback_query: {
        id: 'callback-analyze-group',
        data: analyze.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 73,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:01:01.000Z',
  });

  assert.equal(analysis.ok, true);
  assert.equal(analysis.screen, 'results_group_analysis');
  assert.match(analysis.response.text, /^Group 1: Launch Balancers/);
  assert.match(analysis.response.text, /They support moving forward/);
  assert.match(analysis.response.text, /more favorable toward shipping quickly/);
  assert.equal(analysis.response.text.includes('AI analysis unavailable'), false);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), ['/auth/nonce', '/auth/login', '/ai']);
  assert.deepEqual(flattenButtons(analysis.response.replyMarkup).map((button) => button.text), ['Participants graph']);
});

test('/results without arguments explains available result views', async () => {
  const env = baseEnv();
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/results'),
    env,
    now: '2026-05-08T12:01:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'results_options');
  assert.equal(result.response.method, 'sendMessage');
  assert.match(result.response.text, /^Results/);
  assert.match(result.response.text, /Selected session: Alpha Session/);
  assert.equal(result.response.text.includes('Choose a results view'), false);
  assert.match(result.response.text, /Consensus: highlights questions with the most disagreement/);
  assert.match(result.response.text, /Consensus:[\s\S]*\n\nGroup: Response clusters across questions\.[\s\S]*\n\nTopic Map/);
  assert.equal(result.response.text.includes('Topic map: circles view'), false);
  assert.equal(result.response.text.includes('/results [ consensus | group | topic ]'), false);
  assert.deepEqual(flattenButtons(result.response.replyMarkup).map((button) => button.text), ['Consensus', 'Group', 'Topic Map']);
});

test('/results topic returns a topic-map image when enough answered questions exist', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-onboarding', questionType: 'binary', prompt: 'Should onboarding be one click?', tags: ['onboarding'] },
      { questionId: 'q-privacy', questionType: 'binary', prompt: 'Should raw responses stay private?', tags: ['privacy'] },
    ]),
  });
  let counter = 0;
  async function putResponse(questionId, telegramUserId, label) {
    counter += 1;
    await env.AGENT_ACTION_KV.put(`telegram:submit-request:${counter}`, JSON.stringify({
      status: 'direct_submitted',
      sessionSlug: 'alpha',
      telegramUserId,
      questionId,
      answer: { label, value: label.toLowerCase() },
      createdAt: `2026-05-08T12:02:0${counter}.000Z`,
    }));
  }
  await putResponse('q-onboarding', '1', 'Agree');
  await putResponse('q-onboarding', '2', 'Agree');
  await putResponse('q-privacy', '1', 'Disagree');
  await putResponse('q-privacy', '2', 'Agree');

  const result = await buildTelegramCommandResponse({
    update: groupMessage('/results topic'),
    env,
    now: '2026-05-08T12:03:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'results_topic_map');
  assert.equal(result.response.method, 'sendPhoto');
  assert.equal(result.response.photo.filename, 'context-engine-topic-map-results.png');
  assert.match(result.response.text, /^Topic map/);
  assert.match(result.response.text, /2 topics from 2 answered questions/);
});

test('/results consensus demo rows are limited to binary questions', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-binary', questionType: 'binary', prompt: 'Pets should be allowed in the office.' },
      { questionId: 'q-freeform', questionType: 'freeform', prompt: 'What should the office policy say?' },
      { questionId: 'q-rating', questionType: 'rating', prompt: 'How strongly do you agree?' },
    ]),
  });
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/results consensus'),
    env,
    now: '2026-05-08T12:01:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'results_consensus');
  assert.match(result.response.text, /^Beeswarm \(demo data\)/);
  assert.match(result.response.text, /Most difference 1-1 of 1/);
  assert.match(result.response.text, /Pets should be allowed in the office\./);
  assert.equal(result.response.text.includes('office policy'), false);
  assert.equal(result.response.text.includes('strongly'), false);
  assert.equal(result.response.text.includes('Arriving 10 minutes early'), false);
});

test('/results uses the joined Telegram-enabled session without requiring SBT joins', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          telegramBridgeEnabled: true, telegramOnly: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'beta',
          sessionName: 'Beta Session',
          telegramBridgeEnabled: true, telegramOnly: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: false,
          requiredSbtGroups: [{ groupId: 'beta-sbt', name: 'Beta SBT', joinMode: 'public' }],
        },
      ],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { sessionSlug: 'alpha', questionId: 'q-alpha', questionType: 'freeform', prompt: 'Alpha prompt?' },
      { sessionSlug: 'beta', questionId: 'q-beta', questionType: 'binary', prompt: 'Beta results prompt?' },
    ]),
  });
  const sessions = await buildTelegramCommandResponse({
    update: groupMessage('/sessions'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const betaButton = flattenButtons(sessions.response.replyMarkup)
    .find((button) => button.text === 'Beta Session');
  const selected = await buildTelegramCommandResponse({
    update: {
      update_id: 7011,
      callback_query: {
        id: 'callback-select-beta',
        data: betaButton.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 61,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const results = await buildTelegramCommandResponse({
    update: groupMessage('/results consensus'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });

  assert.equal(selected.sessionSlug, 'beta');
  assert.equal(results.ok, true);
  assert.equal(results.screen, 'results_consensus');
  assert.equal(results.response.method, 'sendPhoto');
  assert.equal(results.sessionSlug, 'beta');
  assert.match(results.response.text, /Beta results prompt\?/);
});

test('/export_all sends a zip for the allowlisted Telegram managed wallet', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const accountAddress = await privateManagedAccountAddress(baseEnv(), now);
  const storageId = arweaveId(33);
  const calls = [];
  const kv = new MemoryKv();
  await kv.put('telegram:submit-request:export-one', JSON.stringify({
    version: 1,
    requestId: 'export-one',
    status: 'direct_submitted',
    action: 'direct_submit_response',
    lane: 'telegram_private_account',
    telegramUserId: '42',
    chatId: '42',
    sessionSlug: 'alpha',
    questionId: `0x${'12'.repeat(32)}`,
    answer: { label: 'Agree', value: 'agree', controlType: 'agree_unsure_disagree' },
    onChain: {
      ok: true,
      status: 'direct_submitted',
      accountAddress,
      txHash: `0x${'34'.repeat(32)}`,
      storageRef: { backend: 'cloudflare', id: storageId, resource: 'responses' },
      storageId,
      responseHash: `0x${'56'.repeat(32)}`,
      chainId: 11155420,
    },
    createdAt: now,
  }));
  const env = baseEnv({
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: accountAddress,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        telegramBridgeEnabled: true, telegramOnly: true,
        managedAccountSubmitAllowed: true,
        sessionWorkerUrl: 'https://session.example',
        storageProfile: { backend: 'cloudflare' },
      }],
    }),
  });
  env.AGENT_BRIDGE_FETCH = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, init });
    if (target.endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/storage/list?resource=responses')) {
      assert.equal(init.headers.Authorization, 'Bearer worker-token');
      return new Response(JSON.stringify({
        items: [{
          storageRef: { backend: 'cloudflare', id: storageId, resource: 'responses' },
          metadata: { resource: 'responses', contentType: 'application/json', createdAt: now },
        }],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith(`/storage/read?id=${encodeURIComponent(storageId)}`)) {
      assert.equal(init.headers.Authorization, 'Bearer worker-token');
      return new Response(JSON.stringify({
        sessionSlug: 'alpha',
        questionId: `0x${'12'.repeat(32)}`,
        response: { value: 'agree', label: 'Agree' },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'unexpected_url' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await buildTelegramCommandResponse({
    update: privateMessage('/export_all'),
    env,
    now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'response_export');
  assert.equal(result.response.method, 'sendDocument');
  assert.equal(result.response.document.filename, 'context-engine-alpha-responses.zip');
  assert.equal(result.response.document.contentType, 'application/zip');
  assert.deepEqual(Array.from(result.response.document.bytes.slice(0, 4)), [80, 75, 3, 4]);
  assert.equal(result.exportedPayloadCount, 1);
  assert.equal(result.submitRecordCount, 1);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    '/auth/nonce',
    '/auth/login',
    '/storage/list',
    '/storage/read',
  ]);
});

test('/export_all falls back to Telegram submit records when storage payload listing is unavailable', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const kv = new MemoryKv();
  const accountAddress = await privateManagedAccountAddress(baseEnv(), now);
  await kv.put('telegram:submit-request:storage-list-fallback', JSON.stringify({
    requestId: 'storage-list-fallback',
    action: 'submit_response',
    status: 'direct_submitted',
    lane: 'telegram_private_account',
    sessionSlug: 'telegram-demo-2',
    telegramUserId: '42',
    questionId: `0x${'12'.repeat(32)}`,
    questionIdShort: '0x121212...1212',
    answer: {
      label: 'Agree',
      value: 'agree',
      controlType: 'binary',
      comments: 'This needs a rollback plan.',
    },
    onChain: null,
    createdAt: now,
  }));
  const env = baseEnv({
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: accountAddress,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'telegram-demo-2',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'telegram-demo-2',
        sessionName: 'Telegram Demo 2',
        telegramBridgeEnabled: true, telegramOnly: true,
        managedAccountSubmitAllowed: true,
        sessionWorkerUrl: 'https://session.example',
      }],
    }),
  });
  env.AGENT_BRIDGE_FETCH = async (url) => {
    const target = String(url);
    if (target.endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/storage/list?resource=responses')) {
      return new Response(JSON.stringify({
        error: 'Storage route read/list is only available for Cloudflare storage.',
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'unexpected_url' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await buildTelegramCommandResponse({
    update: privateMessage('/export_all telegram-demo-2'),
    env,
    now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'response_export');
  assert.equal(result.response.method, 'sendDocument');
  assert.equal(result.exportedPayloadCount, 1);
  assert.equal(result.submitRecordCount, 1);
  assert.equal(result.partial, true);
  assert.equal(result.synthesizedFromSubmitRecords, true);
  assert.match(result.response.text, /Responses were exported from Telegram submit records\./);
  assert.match(result.response.text, /Storage payloads unavailable: Storage route read\/list is only available for Cloudflare storage\./);
  assert.equal(result.response.document.filename, 'context-engine-telegram-demo-2-responses.zip');
  const normalizedAccountAddress = accountAddress.toLowerCase();
  const files = readZipTextFiles(result.response.document.bytes);
  const responsePayload = JSON.parse(files['responses/001-storage-list-fallback.json']);
  assert.equal(responsePayload.type, 'telegram_research_response');
  assert.equal(responsePayload.participant.accountAddress, normalizedAccountAddress);
  assert.equal(responsePayload.participant.stableRef, `evm:${normalizedAccountAddress}`);
  assert.equal(responsePayload.answer.comments, 'This needs a rollback plan.');
  assert.equal(responsePayload.answer.value, 'agree');
  assert.equal(responsePayload.session.sessionSlug, 'telegram-demo-2');
  assert.equal(responsePayload.question.questionId, `0x${'12'.repeat(32)}`);
  assert.equal(Object.hasOwn(responsePayload, 'telegramUserId'), false);
  assert.equal(Object.hasOwn(responsePayload, 'idempotencyKey'), false);
  const responsesIndex = JSON.parse(files['responses.json']);
  assert.equal(responsesIndex[0].payload.answer.comments, 'This needs a rollback plan.');
  assert.equal(Object.hasOwn(responsesIndex[0], 'submitRecord'), false);
  const submitRecords = JSON.parse(files['telegram-submit-records.json']);
  assert.equal(submitRecords[0].answer.comments, 'This needs a rollback plan.');
});

test('/export_all denies non-allowlisted Telegram managed wallets', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: `0x${'11'.repeat(20)}`,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        telegramBridgeEnabled: true, telegramOnly: true,
        sessionWorkerUrl: 'https://session.example',
        storageProfile: { backend: 'cloudflare' },
      }],
    }),
  });

  const result = await buildTelegramCommandResponse({
    update: privateMessage('/export_all'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'response_export_denied');
  assert.equal(result.response.method, 'sendMessage');
  assert.match(result.response.text, /response_export_address_not_allowed/);
});

test('/start and /me show admin actions only to the configured export admin', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const accountAddress = await privateManagedAccountAddress(baseEnv(), now);
  const allowedEnv = baseEnv({
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: accountAddress,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        telegramBridgeEnabled: true, telegramOnly: true,
        sessionWorkerUrl: 'https://session.example',
        storageProfile: { backend: 'cloudflare' },
      }],
    }),
  });
  const deniedEnv = baseEnv({
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: `0x${'11'.repeat(20)}`,
  });

  const allowedStart = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env: allowedEnv,
    now,
  });
  const allowedMe = await buildTelegramCommandResponse({
    update: privateMessage('/me'),
    env: allowedEnv,
    now,
  });
  const deniedStart = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env: deniedEnv,
    now,
  });
  const adminButton = flattenButtons(allowedStart.response.replyMarkup).find((button) => button.text === 'Admin Actions');
  const adminView = await buildTelegramCommandResponse({
    update: {
      update_id: 7101,
      callback_query: {
        id: 'callback-admin-actions',
        data: adminButton.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 71,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env: allowedEnv,
    now,
  });
  const resultsSettingsButton = flattenButtons(adminView.response.replyMarkup)
    .find((button) => button.text === 'Results Settings');
  const questionQueueButton = flattenButtons(adminView.response.replyMarkup)
    .find((button) => button.text === 'Question Queue');
  const settingsView = await buildTelegramCommandResponse({
    update: {
      update_id: 7102,
      callback_query: {
        id: 'callback-results-settings',
        data: resultsSettingsButton.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 71,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env: allowedEnv,
    now,
  });
  const enableGroupsButton = flattenButtons(settingsView.response.replyMarkup)
    .find((button) => button.text === 'Enable Anonymized Groups');
  const toggled = await buildTelegramCommandResponse({
    update: {
      update_id: 7103,
      callback_query: {
        id: 'callback-toggle-results',
        data: enableGroupsButton.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 71,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env: allowedEnv,
    now,
  });
  const questionQueueView = await buildTelegramCommandResponse({
    update: {
      update_id: 7104,
      callback_query: {
        id: 'callback-question-queue',
        data: questionQueueButton.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 71,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env: allowedEnv,
    now,
  });
  const savedQuestionQueue = await buildTelegramCommandResponse({
    update: privateMessage('/question_queue 1'),
    env: allowedEnv,
    now,
  });
  const policyAfterToggle = await loadSessionPolicy(allowedEnv);
  const alphaAfterToggle = policyAfterToggle.linkedSessions.find((session) => session.sessionSlug === 'alpha');

  assert.deepEqual(flattenButtons(allowedStart.response.replyMarkup).map((button) => button.text), ['Mini App', 'Onboard Agent', 'About', 'Admin Actions']);
  assert.equal(flattenButtons(allowedMe.response.replyMarkup).some((button) => button.text === 'Admin Actions'), true);
  assert.equal(flattenButtons(allowedMe.response.replyMarkup).some((button) => button.text === 'export_all'), false);
  assert.equal(flattenButtons(allowedMe.response.replyMarkup).some((button) => button.text === 'export_access'), false);
  assert.deepEqual(flattenButtons(deniedStart.response.replyMarkup).map((button) => button.text), ['Mini App', 'Onboard Agent', 'About']);
  assert.equal(adminView.screen, 'admin_actions');
  assert.deepEqual(flattenButtons(adminView.response.replyMarkup).map((button) => button.text), [
    'Export Responses',
    'Export Access',
    'Results Settings',
    'Question Queue',
    'Add Bot To Group Link',
  ]);
  assert.equal(settingsView.screen, 'results_settings');
  assert.match(settingsView.response.text, /Anonymized groups: off/);
  assert.equal(toggled.screen, 'results_settings');
  assert.match(toggled.response.text, /Anonymized groups: on/);
  assert.equal(alphaAfterToggle.resultsExposure.anonymizedGroupsEnabled, true);
  assert.equal(questionQueueView.screen, 'question_queue_settings');
  assert.match(questionQueueView.response.text, /Sponsored questions are served first/);
  assert.match(questionQueueView.response.text, /Set: \/question_queue 1 3 4/);
  assert.equal(savedQuestionQueue.screen, 'question_queue_settings');
  assert.deepEqual(savedQuestionQueue.questionQueue.sponsoredQuestionIds, ['q-readiness']);
});

test('/start admin actions target the latest submitted session before the registry default', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const kv = new MemoryKv();
  const accountAddress = await privateManagedAccountAddress(baseEnv(), now);
  await kv.put('telegram:submit-request:latest-export-session', JSON.stringify({
    requestId: 'latest-export-session',
    status: 'direct_submitted',
    sessionSlug: 'telegram-demo-2',
    telegramUserId: '42',
    onChain: {
      ok: true,
      accountAddress,
      storageRef: { backend: 'cloudflare', id: arweaveId(44), resource: 'responses' },
    },
    createdAt: now,
  }));
  const env = baseEnv({
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: accountAddress,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'test-session',
      sessions: [
        {
          sessionSlug: 'test-session',
          sessionName: 'Registry First Session',
          telegramBridgeEnabled: true, telegramOnly: true,
          telegramGroupOpenAccess: true,
          sessionWorkerUrl: 'https://session.example',
        },
        {
          sessionSlug: 'telegram-demo-2',
          sessionName: 'Telegram Demo 2',
          telegramBridgeEnabled: true, telegramOnly: true,
          telegramGroupOpenAccess: true,
          sessionWorkerUrl: 'https://session.example',
          storageProfile: { backend: 'cloudflare' },
        },
      ],
    }),
  });

  const start = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env,
    now,
  });
  const adminButton = flattenButtons(start.response.replyMarkup).find((button) => button.text === 'Admin Actions');
  const adminView = await buildTelegramCommandResponse({
    update: {
      update_id: 7104,
      callback_query: {
        id: 'callback-admin-latest-session',
        data: adminButton.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 72,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env,
    now,
  });
  const exportButton = flattenButtons(adminView.response.replyMarkup).find((button) => button.text === 'Export Responses');
  const actionRecord = JSON.parse(await kv.get(`telegram:action:${exportButton.callback_data}`));

  assert.equal(actionRecord.serverContextRef.sessionSlug, 'telegram-demo-2');
});

test('configured export admin can grant and revoke another Telegram managed wallet export access', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const kv = new MemoryKv();
  const adminAddress = await privateManagedAccountAddress(baseEnv(), now);
  const guestAddress = await managedAccountAddressFor({
    telegramUserId: '43',
    username: 'guest',
  }, baseEnv(), now);
  const env = baseEnv({
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: adminAddress,
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        telegramBridgeEnabled: true, telegramOnly: true,
        sessionWorkerUrl: 'https://session.example',
        storageProfile: { backend: 'cloudflare' },
      }],
    }),
  });
  env.AGENT_BRIDGE_FETCH = async (url) => {
    const target = String(url);
    if (target.endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.endsWith('/storage/list?resource=responses')) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'unexpected_url' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  };

  const grant = await buildTelegramCommandResponse({
    update: privateMessage(`/export_allow ${guestAddress} alpha`),
    env,
    now,
  });
  const guestStart = await buildTelegramCommandResponse({
    update: privateMessageFrom('/start', { telegramUserId: '43', username: 'guest' }),
    env,
    now,
  });
  const guestExport = await buildTelegramCommandResponse({
    update: privateMessageFrom('/export_all alpha', { telegramUserId: '43', username: 'guest' }),
    env,
    now,
  });
  const guestGrantAttempt = await buildTelegramCommandResponse({
    update: privateMessageFrom(`/export_allow 0x${'22'.repeat(20)} alpha`, { telegramUserId: '43', username: 'guest' }),
    env,
    now,
  });
  const guestAfterRootDisabled = await buildTelegramCommandResponse({
    update: privateMessageFrom('/export_all alpha', { telegramUserId: '43', username: 'guest' }),
    env: {
      ...env,
      AGENT_BRIDGE_RESPONSE_EXPORT_ALLOWED_ADDRESSES: '',
    },
    now,
  });
  const revoke = await buildTelegramCommandResponse({
    update: privateMessage(`/export_revoke ${guestAddress} alpha`),
    env,
    now,
  });
  const guestAfterRevoke = await buildTelegramCommandResponse({
    update: privateMessageFrom('/export_all alpha', { telegramUserId: '43', username: 'guest' }),
    env,
    now,
  });

  assert.equal(grant.screen, 'response_export_access_updated');
  assert.equal(grant.added, true);
  assert.deepEqual(flattenButtons(guestStart.response.replyMarkup).map((button) => button.text), ['Mini App', 'Onboard Agent', 'About', 'Admin Actions']);
  assert.equal(guestExport.screen, 'response_export');
  assert.equal(guestExport.response.method, 'sendDocument');
  assert.equal(guestGrantAttempt.screen, 'response_export_access_updated');
  assert.equal(guestGrantAttempt.added, true);
  assert.equal(guestAfterRootDisabled.screen, 'response_export_denied');
  assert.match(guestAfterRootDisabled.response.text, /response_export_allowlist_empty/);
  assert.equal(revoke.screen, 'response_export_access_updated');
  assert.equal(revoke.removed, true);
  assert.equal(guestAfterRevoke.screen, 'response_export_denied');
});

test('dispatchTelegramCommandResponse uploads rendered result photos and falls back to text on media failure', async () => {
  const commandResponse = await buildTelegramCommandResponse({
    update: groupMessage('/results consensus'),
    env: baseEnv(),
    now: '2026-05-08T12:01:00.000Z',
  });
  const calls = [];
  const fetchMock = async (url, init = {}) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 77 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const dispatched = await dispatchTelegramCommandResponse({
    commandResponse,
    env: baseEnv(),
    fetchImpl: fetchMock,
  });

  assert.equal(dispatched.telegram.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.telegram.org/bot123456:test-token/sendPhoto');
  assert.equal(calls[0].init.body.get('chat_id'), '-100123');
  assert.equal(calls[0].init.body.get('photo').type, 'image/png');

  const urlEnv = baseEnv({ AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example' });
  const urlCalls = [];
  const urlDispatched = await dispatchTelegramCommandResponse({
    commandResponse,
    env: urlEnv,
    fetchImpl: async (url, init = {}) => {
      urlCalls.push({ url, init });
      return new Response(JSON.stringify({ ok: true, result: { message_id: 79 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const resultPhotoKeys = Array.from(urlEnv.AGENT_ACTION_KV.store.keys())
    .filter((key) => key.startsWith('telegram:result-photo:'));
  assert.equal(urlDispatched.telegram.ok, true);
  assert.equal(resultPhotoKeys.length, 1);
  assert.match(urlCalls[0].init.body.get('photo'), /^https:\/\/bridge\.example\/telegram\/result-photo\/cecb_/);

  const fallbackCalls = [];
  const fallbackFetch = async (url, init = {}) => {
    fallbackCalls.push({ url, init });
    if (String(url).endsWith('/sendPhoto')) {
      return new Response(JSON.stringify({ ok: false, description: 'bad photo' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, result: { message_id: 78 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const fallback = await dispatchTelegramCommandResponse({
    commandResponse,
    env: baseEnv(),
    fetchImpl: fallbackFetch,
  });

  assert.equal(fallback.telegram.ok, true);
  assert.deepEqual(fallbackCalls.map((call) => String(call.url).split('/').pop()), ['sendPhoto', 'sendDocument']);
});

test('dispatchTelegramCommandResponse falls back when Telegram media upload times out', async () => {
  const calls = [];
  const dispatched = await dispatchTelegramCommandResponse({
    commandResponse: {
      ok: true,
      command: '/results',
      screen: 'results_consensus',
      response: {
        method: 'sendPhoto',
        chatId: '55',
        text: 'Beeswarm\nSession: telegram-demo-3',
        photo: {
          url: 'https://bridge.example/telegram/result-photo/cecb_timeouttest',
          contentType: 'image/png',
          filename: 'results.png',
        },
      },
    },
    env: baseEnv({ AGENT_BRIDGE_TELEGRAM_API_TIMEOUT_MS: '1' }),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/sendPhoto')) return new Promise(() => {});
      return new Response(JSON.stringify({ ok: true, result: { message_id: 79 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(dispatched.telegram.ok, true);
  assert.deepEqual(calls.map((call) => call.url.split('/').pop()), ['sendPhoto', 'sendDocument']);
});

test('/questions does not invent demo questions when live question cache is empty', async () => {
  __test__sessionQuestions.clearCaches();
  const questionFetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body || '{}');
    if (body.method === 'eth_blockNumber') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0x64' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (body.method === 'eth_getLogs') {
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected ${body.method}`);
  };
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/questions alpha'),
    env: baseEnv({
      AGENT_BRIDGE_QUESTION_SOURCE: 'live',
      AGENT_BRIDGE_QUESTION_SKIP_SESSION_REGISTRY: '1',
      AGENT_BRIDGE_QUESTION_SCAN_START_BLOCK: '90',
      AGENT_BRIDGE_QUESTION_SCAN_END_BLOCK: '100',
      QUESTION_FETCH: questionFetch,
    }),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.questionCount, 0);
  assert.equal(result.questionSourceReason, 'live_questions_empty');
  assert.equal(result.response.text, 'Questions (0/0)\n\nNo questions are available.');
  assert.equal(result.response.text.includes('q-readiness'), false);
  assert.equal(result.response.text.includes('What should Alpha decide next'), false);
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

test('/questions reads telegram_only preloaded policy questions without chain indexing', async () => {
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/questions telegram-native'),
    env: {
      TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
      AGENT_BRIDGE_QUESTION_SOURCE: 'live',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'telegram-native',
        sessions: [{
          sessionSlug: 'telegram-native',
          sessionName: 'Telegram Native',
          telegramOnly: true,
          telegramBridgeEnabled: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
          questions: [{
            questionId: 'q-native-1',
            questionType: 'binary',
            prompt: 'Should this session avoid chain question indexing?',
          }],
        }],
      }),
      REGISTRY_FETCH: async () => {
        throw new Error('registry should not be called');
      },
    },
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.questionSourceReason, 'telegram_only_policy_questions_loaded');
  assert.equal(result.response.text, 'Questions (1/1)\n\n1. Should this session avoid chain question indexing?');
  assert.equal(flattenButtons(result.response.replyMarkup)[0].text, 'Pose 1');
});

test('/questions reads telegram_only Cloudflare question payloads concurrently', async () => {
  let activeReads = 0;
  let maxActiveReads = 0;
  let releaseReads = null;
  const readBarrier = new Promise((resolve) => {
    releaseReads = resolve;
  });
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(String(url));
    if (target.pathname.endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/storage/list')) {
      return new Response(JSON.stringify({
        items: [
          { id: 'q-storage-1' },
          { id: 'q-storage-2' },
          { id: 'q-storage-3' },
        ],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/storage/read')) {
      activeReads += 1;
      maxActiveReads = Math.max(maxActiveReads, activeReads);
      if (activeReads === 3) releaseReads();
      await readBarrier;
      const id = target.searchParams.get('id');
      activeReads -= 1;
      return new Response(JSON.stringify({
        questionId: id,
        questionType: 'binary',
        prompt: `Loaded ${id}`,
        sessionSlug: 'telegram-cloudflare',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'unexpected_url' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await withTimeout(buildTelegramCommandResponse({
    update: groupMessage('/questions telegram-cloudflare'),
    env: baseEnv({
      AGENT_BRIDGE_DEPLOYMENT_ID: 'unit-deploy',
      AGENT_BRIDGE_QUESTION_SOURCE: 'live',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'telegram-cloudflare',
        sessions: [{
          sessionSlug: 'telegram-cloudflare',
          sessionName: 'Telegram Cloudflare',
          telegramOnly: true,
          telegramBridgeEnabled: true,
          telegramGroupOpenAccess: true,
          sessionWorkerUrl: 'https://session.example',
          workerSessionSlug: 'telegram-cloudflare',
          questionSource: 'cloudflare_storage',
          storageProfile: { backend: 'cloudflare' },
        }],
      }),
      QUESTION_FETCH: fetchImpl,
    }),
    now: '2026-05-08T12:00:00.000Z',
  }), 500, 'telegram_only Cloudflare question reads were not concurrent');

  assert.equal(result.ok, true);
  assert.equal(result.questionSourceReason, 'telegram_only_cloudflare_questions_loaded');
  assert.equal(result.response.text, [
    'Questions (3/3)',
    '',
    '1. Loaded q-storage-1',
    '',
    '2. Loaded q-storage-2',
    '',
    '3. Loaded q-storage-3',
  ].join('\n'));
  assert.equal(maxActiveReads, 3);
});

test('/questions reads Cloudflare question storage without falling back to on-chain when no onchain mode is configured', async () => {
  const fetchCalls = [];
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(String(url));
    fetchCalls.push({ url: target.toString(), init });
    if (init?.body) {
      const body = JSON.parse(init.body);
      if (body?.jsonrpc || body?.method?.startsWith?.('eth_')) {
        throw new Error(`unexpected_rpc_${body.method || 'call'}`);
      }
    }
    if (target.pathname.endsWith('/auth/nonce')) {
      return new Response(JSON.stringify({ nonce: 'nonce-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: 'worker-token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/storage/list')) {
      return new Response(JSON.stringify({ items: [{ id: 'q-storage-1' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (target.pathname.endsWith('/storage/read')) {
      return new Response(JSON.stringify({
        questionId: target.searchParams.get('id'),
        questionType: 'binary',
        prompt: 'Loaded from Cloudflare without chain indexing.',
        sessionSlug: 'cloudflare-worker',
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected_url_${target.pathname}`);
  };

  const result = await buildTelegramCommandResponse({
    update: groupMessage('/questions cloudflare-worker'),
    env: baseEnv({
      AGENT_BRIDGE_DEPLOYMENT_ID: 'unit-deploy',
      AGENT_BRIDGE_QUESTION_SOURCE: 'live',
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'cloudflare-worker',
        sessions: [{
          sessionSlug: 'cloudflare-worker',
          sessionName: 'Cloudflare Worker',
          telegramBridgeEnabled: true,
          telegramGroupOpenAccess: true,
          sessionMode: 'telegram_enabled',
          sessionWorkerUrl: 'https://session.example',
          workerSessionSlug: 'cloudflare-worker',
          questionSource: 'cloudflare_storage',
          storageProfile: { backend: 'cloudflare' },
        }],
      }),
      QUESTION_FETCH: fetchImpl,
      REGISTRY_FETCH: async () => {
        throw new Error('registry_rpc_should_not_be_called');
      },
    }),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.questionSourceReason, 'telegram_only_cloudflare_questions_loaded');
  assert.equal(result.response.text, [
    'Questions (1/1)',
    '',
    '1. Loaded from Cloudflare without chain indexing.',
  ].join('\n'));
  assert.deepEqual(
    fetchCalls.map((call) => new URL(call.url).pathname),
    ['/auth/nonce', '/auth/login', '/storage/list', '/storage/read']
  );
});

test('telegram_only storage auth failures still surface proposed questions', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEPLOYMENT_ID: 'unit-deploy',
    AGENT_BRIDGE_QUESTION_SOURCE: 'live',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        telegramOnly: true,
        telegramBridgeEnabled: true,
        telegramGroupOpenAccess: true,
        sessionWorkerUrl: 'https://session.example',
        workerSessionSlug: 'alpha',
        questionSource: 'cloudflare_storage',
        storageProfile: { backend: 'cloudflare' },
      }],
    }),
    QUESTION_FETCH: async () => {
      throw new Error('session auth unavailable');
    },
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

test('/questions live_or_fixture does not show fixture questions when live loading is slow', async () => {
  __test__sessionQuestions.clearCaches();
  const waited = [];
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/questions telegram-demo-3'),
    env: baseEnv({
      AGENT_BRIDGE_QUESTION_SOURCE: 'live_or_fixture',
      AGENT_BRIDGE_QUESTION_LIVE_FALLBACK_TIMEOUT_MS: '1',
      QUESTION_FETCH: async () => new Promise(() => {}),
      AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
        defaultSessionSlug: 'telegram-demo-3',
        riskCeiling: 'submit',
        sessions: [{
          sessionSlug: 'telegram-demo-3',
          sessionName: 'Telegram Demo 3',
          default: true,
          telegramBridgeEnabled: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
        }],
      }),
      AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
        {
          sessionSlug: 'telegram-demo-3',
          questionId: 'q-demo-3',
          questionType: 'freeform',
          prompt: 'What should demo 3 test first?',
        },
      ]),
    }),
    now: '2026-05-08T12:00:00.000Z',
    waitUntil: (promise) => waited.push(promise),
  });

  assert.equal(result.ok, true);
  assert.equal(result.questionSource, 'telegram_worker_question_cache');
  assert.equal(result.questionSourceReason, 'live_question_cache_timeout');
  assert.equal(result.response.text, 'Questions (0/0)\n\nQuestions are still loading from Cloudflare. Run /questions again shortly.');
  assert.equal(result.response.text.includes('What should demo 3 test first?'), false);
  assert.equal(waited.length, 1);
});

test('/questions reports live source failures without caching them as empty lists', async () => {
  __test__sessionQuestions.clearCaches();
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/questions alpha'),
    env: baseEnv({
      AGENT_BRIDGE_QUESTION_SOURCE: 'live',
      DEFAULT_RPC_URL: '',
      ADDITIONAL_RPC_URL: '',
    }),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.questionCount, 0);
  assert.equal(result.questionSourceReason, 'question_rpc_url_missing');
  assert.equal(result.response.text, 'Questions (0/0)\n\nQuestion source is missing RPC config.');
  assert.equal(result.response.text.includes('No public questions are available yet'), false);
});

test('group session binding makes later question and doc commands use the joined session', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      allowQuestionGeneration: true,
      allowGenerateQuestion: true,
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          default: true,
          telegramBridgeEnabled: true, telegramOnly: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
          docLibraryEnabled: true,
        },
        {
          sessionSlug: 'demo',
          sessionName: 'Demo Session',
          telegramBridgeEnabled: true, telegramOnly: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
          docLibraryEnabled: true,
        },
      ],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: 'q-demo',
        questionType: 'freeform',
        prompt: 'What should Demo decide next?',
      },
    ]),
    AGENT_BRIDGE_DEMO_DOCS_JSON: JSON.stringify([
      {
        docId: 'doc-demo',
        sessionSlug: 'demo',
        title: 'Demo brief',
        fileType: 'md',
        visibility: 'public',
      },
    ]),
  });

  const joined = await buildTelegramCommandResponse({
    update: groupMessage('/join demo'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const questions = await buildTelegramCommandResponse({
    update: groupMessage('/questions'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const posed = await buildTelegramCommandResponse({
    update: groupMessage('/q q-demo'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });
  const docs = await buildTelegramCommandResponse({
    update: groupMessage('/attachments'),
    env,
    now: '2026-05-08T12:00:03.000Z',
  });

  assert.equal(joined.sessionSlug, 'demo');
  assert.equal(joined.groupSessionBinding.ok, true);
  assert.equal(joined.userSessionBinding.ok, true);
  const joinedUserBinding = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:private-session:42'));
  assert.equal(joinedUserBinding.sessionSlug, 'demo');
  assert.equal(joinedUserBinding.source, 'group_session_select');
  assert.equal(joinedUserBinding.sourceChatId, '-100123');
  assert.equal(joined.response.text.includes('/attachments'), false);
  assert.equal(joined.response.text.includes('/me'), false);
  assert.equal(joined.response.text.includes('Use /questions'), false);
  assert.equal(questions.response.text, 'Questions (1/1)\n\n1. What should Demo decide next?');
  assert.equal(flattenButtons(questions.response.replyMarkup)[0].text, 'Pose 1');
  assert.equal(questions.response.text.includes('q-demo'), false);
  assert.equal(posed.response.text.startsWith('Question for demo:'), false);
  assert.match(posed.response.text, /^What should Demo decide next\?/);
  assert.match(docs.response.text, /Attachments for demo/);
  assert.match(docs.response.text, /Demo brief/);
});

test('private session join makes later question commands use the selected session', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          default: true,
          telegramBridgeEnabled: true, telegramOnly: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'demo',
          sessionName: 'Demo Session',
          telegramBridgeEnabled: true, telegramOnly: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
        },
      ],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        sessionSlug: 'alpha',
        questionId: 'q-alpha',
        questionType: 'freeform',
        prompt: 'What should Alpha decide next?',
      },
      {
        sessionSlug: 'demo',
        questionId: 'q-demo',
        questionType: 'freeform',
        prompt: 'What should Demo decide next?',
      },
    ]),
  });

  const joined = await buildTelegramCommandResponse({
    update: privateMessage('/join demo'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const questions = await buildTelegramCommandResponse({
    update: privateMessage('/questions'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const posed = await buildTelegramCommandResponse({
    update: privateMessage('/q 1'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });

  assert.equal(joined.sessionSlug, 'demo');
  assert.equal(questions.response.text, 'Questions (1/1)\n\n1. What should Demo decide next?');
  assert.equal(flattenButtons(questions.response.replyMarkup)[0].text, 'Pose 1');
  assert.equal(questions.response.text.includes('q-demo'), false);
  assert.equal(questions.response.text.includes('q-alpha'), false);
  assert.equal(posed.response.text.startsWith('Question for demo:'), false);
  assert.match(posed.response.text, /^What should Demo decide next\?/);
});

test('private session join schedules question prefetch without blocking the join reply', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          default: true,
          telegramBridgeEnabled: true, telegramOnly: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'demo',
          sessionName: 'Demo Session',
          telegramBridgeEnabled: true, telegramOnly: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
        },
      ],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        sessionSlug: 'demo',
        questionId: 'q-demo',
        questionType: 'freeform',
        prompt: 'What should Demo decide next?',
      },
    ]),
  });
  const waited = [];
  const waitUntil = (promise) => waited.push(promise);

  const joined = await buildTelegramCommandResponse({
    update: privateMessage('/join demo'),
    env,
    now: '2026-05-08T12:00:00.000Z',
    waitUntil,
  });

  assert.equal(joined.ok, true);
  assert.deepEqual(joined.questionPrefetch, {
    scheduled: true,
    sessionSlug: 'demo',
    ok: true,
    reason: 'question_prefetch_scheduled',
    questionCount: 0,
    availableQuestionCount: 0,
    unavailableQuestionCount: 0,
    lockedQuestionCount: 0,
    discoveredQuestionCount: 0,
    complete: false,
  });
  assert.match(joined.response.text, /Questions: loading\./);
  assert.equal(waited.length, 1);
  await Promise.all(waited);
});

test('group session join schedules question prefetch without blocking the join reply', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'demo',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'demo',
        sessionName: 'Demo Session',
        default: true,
        telegramBridgeEnabled: true, telegramOnly: true,
        telegramGroupOpenAccess: true,
        managedAccountSubmitAllowed: true,
      }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        sessionSlug: 'demo',
        questionId: 'q-demo',
        questionType: 'freeform',
        prompt: 'What should Demo decide next?',
      },
    ]),
  });
  const waited = [];
  const waitUntil = (promise) => waited.push(promise);

  const joined = await buildTelegramCommandResponse({
    update: groupMessage('/join demo'),
    env,
    now: '2026-05-08T12:00:00.000Z',
    waitUntil,
  });

  assert.equal(joined.ok, true);
  assert.deepEqual(joined.questionPrefetch, {
    scheduled: true,
    sessionSlug: 'demo',
    ok: true,
    reason: 'question_prefetch_scheduled',
    questionCount: 0,
    availableQuestionCount: 0,
    unavailableQuestionCount: 0,
    lockedQuestionCount: 0,
    discoveredQuestionCount: 0,
    complete: false,
  });
  assert.match(joined.response.text, /Questions: loading\./);
  assert.equal(waited.length, 1);
  await Promise.all(waited);
});

test('private session join schedules faucet funding when session policy allows it', async () => {
  const calls = [];
  const env = baseEnv({
    AGENT_BRIDGE_FETCH: mockSessionWorkerFetch(calls),
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true, telegramOnly: true,
        telegramGroupOpenAccess: true,
        managedAccountSubmitAllowed: true,
        sponsoredFaucetAllowed: true,
        sessionWorkerUrl: 'https://session.example',
      }],
    }),
  });

  const waited = [];
  const joined = await buildTelegramCommandResponse({
    update: privateMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
    waitUntil: (promise) => waited.push(promise),
  });

  assert.equal(joined.ok, true);
  assert.equal(joined.response.text.includes('Faucet:'), false);
  assert.equal(joined.faucet.ok, true);
  assert.equal(joined.faucet.scheduled, true);
  assert.equal(waited.length, 2);
  await Promise.all(waited);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].url, 'https://session.example/');
  const faucetBody = JSON.parse(calls[2].init.body);
  assert.equal(faucetBody.action, 'request_test_eth');
  assert.equal(faucetBody.sessionSlug, 'alpha');
  assert.match(faucetBody.to, /^0x[0-9a-fA-F]{40}$/);
  assert.equal(JSON.stringify(joined).includes('unit-root'), false);
});

test('/sessions join callback returns before slow session worker setup completes', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_FETCH: async () => new Promise(() => {}),
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'telegram-demo-3',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'telegram-demo-3',
        sessionName: 'Telegram Demo 3',
        default: true,
        telegramBridgeEnabled: true, telegramOnly: true,
        managedAccountSubmitAllowed: true,
        sponsoredFaucetAllowed: true,
        sessionWorkerUrl: 'https://session.example',
      }],
    }),
  });
  const sessions = await buildTelegramCommandResponse({
    update: privateMessage('/sessions'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const joinButton = flattenButtons(sessions.response.replyMarkup)
    .find((button) => button.text === 'Telegram Demo 3');
  const waited = [];

  const joined = await withTimeout(buildTelegramCommandResponse({
    update: {
      update_id: 7100,
      callback_query: {
        id: 'callback-join-demo3',
        data: joinButton.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 88,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
    waitUntil: (promise) => waited.push(promise),
  }), 100, 'join callback waited on slow session worker setup');

  assert.equal(joined.ok, true);
  assert.equal(joined.command, 'callback:join_session');
  assert.match(joined.response.text, /Joined session: Telegram Demo 3/);
  assert.match(joined.response.text, /Questions: loading\./);
  assert.equal(joined.faucet.scheduled, true);
  assert.equal(waited.length, 2);
});

test('/sessions callback switches the group session used by later question commands', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          default: true,
          telegramBridgeEnabled: true, telegramOnly: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'demo',
          sessionName: 'Demo Session',
          telegramBridgeEnabled: true, telegramOnly: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
        },
      ],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        sessionSlug: 'alpha',
        questionId: 'q-alpha',
        questionType: 'freeform',
        prompt: 'What should Alpha decide next?',
      },
      {
        sessionSlug: 'demo',
        questionId: 'q-demo',
        questionType: 'freeform',
        prompt: 'What should Demo decide next?',
      },
    ]),
  });
  const sessions = await buildTelegramCommandResponse({
    update: groupMessage('/sessions'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const demoButton = flattenButtons(sessions.response.replyMarkup)
    .find((button) => button.text === 'Demo Session');

  const selected = await buildTelegramCommandResponse({
    update: {
      update_id: 7010,
      callback_query: {
        id: 'callback-select-demo',
        data: demoButton.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 60,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const questions = await buildTelegramCommandResponse({
    update: groupMessage('/questions'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });

  assert.equal(selected.sessionSlug, 'demo');
  assert.equal(selected.userSessionBinding.ok, true);
  const selectedUserBinding = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:private-session:42'));
  assert.equal(selectedUserBinding.sessionSlug, 'demo');
  assert.equal(selectedUserBinding.source, 'group_session_select');
  assert.equal(questions.response.text, 'Questions (1/1)\n\n1. What should Demo decide next?');
  assert.equal(flattenButtons(questions.response.replyMarkup)[0].text, 'Pose 1');
  assert.equal(questions.response.text.includes('q-demo'), false);
  assert.equal(questions.response.text.includes('q-alpha'), false);
});

test('group Pose Question callback opens a choose-question menu instead of posing the first question', async () => {
  const env = baseEnv();
  const joined = await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const poseQuestion = flattenButtons(joined.response.replyMarkup)
    .find((button) => button.text === 'Pose Question');
  const callback = await buildTelegramCommandResponse({
    update: {
      update_id: 7004,
      callback_query: {
        id: 'callback-pose-menu',
        data: poseQuestion.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 56,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(callback.ok, true);
  assert.equal(callback.response.method, 'editMessageText');
  assert.equal(callback.response.messageId, '56');
  assert.equal(callback.screen, 'question_list');
  assert.match(callback.response.text, /^Questions \(2\/2\)\n\n1\. What should Alpha decide next\?/);
  assert.equal(callback.response.text.includes('Choose a question'), false);
  assert.equal(flattenButtons(callback.response.replyMarkup)[0].text, 'Pose 1');
  assert.equal(callback.response.text.includes('q-readiness'), false);
  assert.equal(callback.response.text.startsWith('Question for alpha:'), false);
});

test('/q poses existing or ad hoc public questions to the group', async () => {
  const env = baseEnv();
  const existing = await buildTelegramCommandResponse({
    update: groupMessage('/q q-readiness'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const byNumber = await buildTelegramCommandResponse({
    update: groupMessage('/q 1'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const adHoc = await buildTelegramCommandResponse({
    update: groupMessage('/q What should we fund this week?'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });

  assert.equal(existing.ok, true);
  assert.equal(existing.screen, 'pose_question');
  assert.match(existing.response.text, /What should Alpha decide next/);
  assert.equal(byNumber.ok, true);
  assert.match(byNumber.response.text, /What should Alpha decide next/);
  assert.equal(adHoc.ok, true);
  assert.match(adHoc.response.text, /What should we fund this week\?/);
  assert.equal(JSON.stringify(adHoc.response.replyMarkup).includes('What should we fund'), false);
});

test('/add_question requires a joined Telegram group and adds questions to the session list', async () => {
  const env = baseEnv();
  const denied = await buildTelegramCommandResponse({
    update: groupMessage('/add_question What should we fund this week?'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'telegram_group_session_binding_required');

  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const added = await buildTelegramCommandResponse({
    update: groupMessage('/add_question binary: Should we fund this week?'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });
  const questions = await buildTelegramCommandResponse({
    update: groupMessage('/questions'),
    env,
    now: '2026-05-08T12:00:03.000Z',
  });

  assert.equal(added.ok, true);
  assert.equal(added.screen, 'add_question');
  assert.match(added.response.text, /Question added to Alpha Session/);
  assert.equal(flattenButtons(added.response.replyMarkup).some((button) => button.text === 'Pose Question'), true);
  assert.match(questions.response.text, /Should we fund this week\?/);
});

test('/add_question exposes type chooser, supports multichoice syntax, and allows private Telegram-only participants', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true,
        telegramOnly: true,
        defaultGroupChatId: '-100123',
      }, {
        sessionSlug: 'beta',
        sessionName: 'Beta Session',
        telegramBridgeEnabled: true,
        telegramOnly: true,
      }],
    }),
  });
  const chooser = await buildTelegramCommandResponse({
    update: privateMessage('/add_question'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const chooserButtons = flattenButtons(chooser.response.replyMarkup);

  assert.equal(chooser.ok, true);
  assert.match(chooser.response.text, /Type: Freeform/);
  assert.equal(chooserButtons.some((button) => button.text === 'Agree'), true);
  assert.equal(chooserButtons.some((button) => button.text === 'Rating'), true);
  assert.equal(chooserButtons.some((button) => button.text === 'Multi-choice'), true);
  assert.equal(chooserButtons.some((button) => button.text === '✓ Freeform'), true);

  const multiButton = chooserButtons.find((button) => button.text === 'Multi-choice');
  const typed = await buildTelegramCommandResponse({
    update: {
      update_id: 7003,
      callback_query: {
        id: 'callback-add-multi',
        data: multiButton.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 70,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  assert.match(typed.response.text, /Type: Multi-choice/);
  assert.match(typed.response.text, /Pizza \| Salad \| Tacos/);

  const start = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });
  assert.equal(start.ok, true);
  const added = await buildTelegramCommandResponse({
    update: privateMessage('/add_question multichoice: What should lunch be? options: Pizza, Salad, Tacos'),
    env,
    now: '2026-05-08T12:00:03.000Z',
  });
  const questions = await buildTelegramCommandResponse({
    update: privateMessage('/questions alpha'),
    env,
    now: '2026-05-08T12:00:04.000Z',
  });

  assert.equal(added.ok, true);
  assert.match(added.response.text, /Question added to Alpha Session/);
  assert.match(questions.response.text, /What should lunch be\?/);
});

test('URL question generation drafts numbered candidates and keeps selected questions', async () => {
  const aiPrompts = [];
  let aiGenerationCall = 0;
  const env = baseEnv({
    AGENT_BRIDGE_OPENAI_API_KEY: 'sk-bridge-openai',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      allowQuestionGeneration: true,
      allowGenerateQuestion: true,
      allowAddQuestion: true,
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true,
        telegramOnly: true,
        defaultGroupChatId: '-100123',
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session.example',
        workerSessionSlug: 'alpha',
        sessionContext: 'Alpha focuses on source-grounded AI governance tradeoffs.',
        questionTags: ['ai', 'governance'],
      }, {
        sessionSlug: 'beta',
        sessionName: 'Beta Session',
        telegramBridgeEnabled: true,
        telegramOnly: true,
      }],
    }),
    AGENT_BRIDGE_FETCH: async (url, options = {}) => {
      const target = String(url);
      if (target === 'https://example.com/article') {
        return new Response(`<!doctype html><html><head><title>AI Governance Article</title></head><body>
          <h1>AI Governance Article</h1>
          <p>This article argues that communities need practical AI governance norms, clear consent,
          participant review, and lightweight ways to surface disagreement before decisions are made.</p>
          <p>It also says source material should lead to questions that expose tradeoffs rather than
          quizzes about the article itself.</p>
        </body></html>`, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      if (target.endsWith('/auth/nonce')) {
        return new Response(JSON.stringify({ nonce: 'nonce-1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (target.endsWith('/auth/login')) {
        return new Response(JSON.stringify({ token: 'session-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (target.endsWith('/ai')) {
        const body = JSON.parse(options.body || '{}');
        assert.equal(body.apiKey, 'sk-bridge-openai');
        const prompt = body.messages?.[1]?.content || '';
        aiPrompts.push(prompt);
        aiGenerationCall += 1;
        const regenerated = /Regeneration Feedback:/i.test(prompt);
        const prefix = regenerated ? 'Regenerated organizer tradeoff question' : 'AI governance question';
        return new Response(JSON.stringify({
          completion: JSON.stringify({
            surveyTitle: 'AI Governance Article',
            questions: Array.from({ length: 5 }, (_, index) => ({
              prompt: `${prefix} ${index + 1} should be discussed by the group.`,
              questionType: 'binary',
              tags: ['ai', 'governance'],
            })),
          }),
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch ${target}`);
    },
  });

  const start = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  assert.equal(start.ok, true);
  const generated = await buildTelegramCommandResponse({
    update: privateMessage('Create some questions based on this URL: https://example.com/article'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  assert.equal(generated.ok, true);
  assert.equal(generated.screen, 'generate_questions');
  assert.match(generated.response.text, /Drafted 5 Agree questions for Alpha Session/);
  assert.match(generated.response.text, /1\. AI governance question 1/);
  assert.match(generated.response.text, /1\. AI governance question 1 should be discussed by the group\.\n\n2\. AI governance question 2/);
  assert.doesNotMatch(generated.response.text, /6\. AI governance question 6/);
  assert.match(generated.response.text, /Reply with numbers to keep/);
  assert.match(generated.response.text, /Reply regenerate with <feedback>/);
  assert.equal(aiPrompts.length, 1);
  assert.equal(aiGenerationCall, 1);
  assert.match(aiPrompts[0], /Group Custom Instructions: Alpha focuses on source-grounded AI governance tradeoffs\./);
  assert.match(aiPrompts[0], /These should not be about the document itself, or in any sort of quiz format/);
  assert.match(aiPrompts[0], /Prioritize questions that clarify contested terms, surface trade-offs, and invite constructive next steps/);
  assert.match(aiPrompts[0], /prioritizing the most contentious or interesting hotspots first/);
  assert.match(aiPrompts[0], /Count fidelity: generate exactly the requested count/);
  assert.match(aiPrompts[0], /numberOfSeedStatementsOrPrompts: 5/);
  assert.match(aiPrompts[0], /TypeOfQuestionsToInclude: binary/);

  const regenerated = await buildTelegramCommandResponse({
    update: privateMessage('regenerate with focus on organizer decision tradeoffs'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });
  assert.equal(regenerated.ok, true);
  assert.equal(regenerated.screen, 'generate_questions');
  assert.match(regenerated.response.text, /Regenerated 5 Agree questions for Alpha Session/);
  assert.match(regenerated.response.text, /Feedback: focus on organizer decision tradeoffs/);
  assert.match(regenerated.response.text, /1\. Regenerated organizer tradeoff question 1/);
  assert.match(regenerated.response.text, /1\. Regenerated organizer tradeoff question 1 should be discussed by the group\.\n\n2\. Regenerated organizer tradeoff question 2/);
  assert.equal(aiPrompts.length, 2);
  assert.match(aiPrompts[1], /Regeneration Feedback:\s+focus on organizer decision tradeoffs/);
  assert.match(aiPrompts[1], /Previous Candidates To Improve Or Replace/);
  assert.match(aiPrompts[1], /AI governance question 1 should be discussed by the group\./);

  const kept = await buildTelegramCommandResponse({
    update: privateMessage('1 3 5'),
    env,
    now: '2026-05-08T12:00:03.000Z',
  });
  assert.equal(kept.ok, true);
  assert.equal(kept.screen, 'generate_questions');
  assert.match(kept.response.text, /Kept 3 questions in Alpha Session/);
  assert.match(kept.response.text, /Regenerated organizer tradeoff question 1/);
  assert.match(kept.response.text, /Regenerated organizer tradeoff question 3/);
  assert.match(kept.response.text, /Regenerated organizer tradeoff question 5/);

  const questions = await buildTelegramCommandResponse({
    update: privateMessage('/questions alpha'),
    env,
    now: '2026-05-08T12:00:04.000Z',
  });
  assert.match(questions.response.text, /Regenerated organizer tradeoff question 1/);
  assert.match(questions.response.text, /Regenerated organizer tradeoff question 3/);
  assert.match(questions.response.text, /Regenerated organizer tradeoff question 5/);
});

test('URL question generation retries empty AI output and accepts compact string candidates', async () => {
  let aiCalls = 0;
  const env = baseEnv({
    AGENT_BRIDGE_OPENAI_API_KEY: 'sk-bridge-openai',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      allowQuestionGeneration: true,
      allowGenerateQuestion: true,
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true,
        telegramOnly: true,
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session.example',
        workerSessionSlug: 'alpha',
      }],
    }),
    AGENT_BRIDGE_FETCH: async (url, options = {}) => {
      const target = String(url);
      if (target === 'https://example.com/source') {
        return new Response('<html><head><title>Source</title></head><body>Agent village organizers need questions about participant onboarding, governance, consent, and experiment outcomes. The group wants practical deliberation prompts rather than quizzes.</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      if (target.endsWith('/auth/nonce')) {
        return new Response(JSON.stringify({ nonce: 'nonce-1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (target.endsWith('/auth/login')) {
        return new Response(JSON.stringify({ token: 'session-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (target.endsWith('/ai')) {
        aiCalls += 1;
        const body = JSON.parse(options.body || '{}');
        assert.equal(body.apiKey, 'sk-bridge-openai');
        if (aiCalls === 1) {
          assert.equal(body.max_output_tokens, 6000);
          return new Response(JSON.stringify({ completion: JSON.stringify({ questions: [] }) }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        assert.equal(body.max_output_tokens, 12000);
        assert.equal(body.reasoning_effort, 'minimal');
        return new Response(JSON.stringify({
          completion: JSON.stringify({
            questions: [
              'Organizers should prioritize participant onboarding before adding more agent features.',
              { statement: 'The experiment should measure governance outcomes explicitly.', type: 'binary' },
            ],
          }),
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch ${target}`);
    },
  });

  const generated = await buildTelegramCommandResponse({
    update: privateMessage('Generate 2 questions based on this URL: https://example.com/source'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(generated.ok, true);
  assert.equal(aiCalls, 2);
  assert.match(generated.response.text, /Drafted 2 Agree questions for Alpha Session/);
  assert.match(generated.response.text, /1\. Organizers should prioritize participant onboarding/);
  assert.match(generated.response.text, /2\. The experiment should measure governance outcomes explicitly\./);
});

test('URL question generation falls back to source-grounded local drafts when AI stays empty', async () => {
  let aiCalls = 0;
  const env = baseEnv({
    AGENT_BRIDGE_OPENAI_API_KEY: 'sk-bridge-openai',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      allowQuestionGeneration: true,
      allowGenerateQuestion: true,
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Session Lab Organizers',
        default: true,
        telegramBridgeEnabled: true,
        telegramOnly: true,
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session.example',
        workerSessionSlug: 'alpha',
      }],
    }),
    AGENT_BRIDGE_FETCH: async (url) => {
      const target = String(url);
      if (target === 'https://example.com/source') {
        return new Response('<html><head><title>Source</title></head><body>Agent village organizers need questions about personal AI agents, participant consent, community governance, and experiment outcomes. The session should help organizers decide how to run a useful coordination experiment.</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      if (target.endsWith('/auth/nonce')) {
        return new Response(JSON.stringify({ nonce: 'nonce-1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (target.endsWith('/auth/login')) {
        return new Response(JSON.stringify({ token: 'session-token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (target.endsWith('/ai')) {
        aiCalls += 1;
        return new Response(JSON.stringify({ completion: JSON.stringify({ questions: [] }) }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch ${target}`);
    },
  });

  const generated = await buildTelegramCommandResponse({
    update: privateMessage('Generate 3 questions based on this URL: https://example.com/source'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(generated.ok, true);
  assert.equal(aiCalls, 2);
  assert.match(generated.response.text, /Drafted 3 Agree questions for Session Lab Organizers/);
  assert.match(generated.response.text, /agent coordination|participant onboarding|community governance/i);
});

test('URL question source fetch rejects oversized responses before buffering content', async () => {
  const fetched = await fetchUrlQuestionSource({
    url: 'https://example.com/huge',
    fetchImpl: async () => new Response('small placeholder body', {
      status: 200,
      headers: {
        'content-type': 'text/html',
        'content-length': '1000001',
      },
    }),
  });

  assert.equal(fetched.ok, false);
  assert.equal(fetched.reason, 'url_response_too_large');
  assert.equal(fetched.finalUrl, 'https://example.com/huge');
});

test('private Telegram-only authoring accepts dotenv-escaped session policy JSON', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: dotenvEscapedJson({
      defaultSessionSlug: 'telegram-demo-4',
      riskCeiling: 'submit',
      allowAddQuestion: true,
      sessions: [{
        sessionSlug: 'telegram-demo-4',
        sessionName: 'Session Lab Organizers (Demo)',
        default: true,
        telegramBridgeEnabled: true,
        telegramOnly: true,
        sessionMode: 'telegram_only',
        managedAccountSubmitAllowed: true,
        defaultGroupChatId: '-100123',
      }],
    }),
  });

  const start = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env,
    now: '2026-05-27T18:30:00.000Z',
  });
  assert.equal(start.ok, true);
  assert.match(start.response.text, /Session: Session Lab Organizers \(Demo\)/);

  const added = await buildTelegramCommandResponse({
    update: privateMessage('/add_question binary: Organizers should publish explicit agent override rules.'),
    env,
    now: '2026-05-27T18:30:01.000Z',
  });

  assert.equal(added.ok, true);
  assert.equal(added.screen, 'add_question');
  assert.match(added.response.text, /Question added to Session Lab Organizers \(Demo\)/);
});

test('/groups manages lightweight Telegram-only group selections from the private bot', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true,
        telegramOnly: true,
      }],
    }),
  });
  await buildTelegramCommandResponse({
    update: privateMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const groups = await buildTelegramCommandResponse({
    update: privateMessage('/groups'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const buttons = flattenButtons(groups.response.replyMarkup);
  const investor = buttons.find((button) => button.text === 'Investor');

  assert.equal(groups.ok, true);
  assert.equal(groups.screen, 'telegram_groups');
  assert.match(groups.response.text, /Groups for Alpha Session/);
  assert.ok(investor);

  const selected = await buildTelegramCommandResponse({
    update: {
      update_id: 7004,
      callback_query: {
        id: 'callback-group-investor',
        data: investor.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 71,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:02.000Z',
  });

  assert.equal(selected.ok, true);
  assert.equal(selected.screen, 'telegram_groups');
  assert.match(selected.response.text, /Role: Investor/);
  assert.equal(flattenButtons(selected.response.replyMarkup).some((button) => button.text === '✓ Investor'), true);
});

test('/q natural language persists as a proposed question after a group joins', async () => {
  const env = baseEnv();
  await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const posed = await buildTelegramCommandResponse({
    update: groupMessage('/q What should we review next?'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const questions = await buildTelegramCommandResponse({
    update: groupMessage('/questions'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });

  assert.equal(posed.ok, true);
  assert.match(posed.response.text, /What should we review next\?/);
  assert.match(questions.response.text, /What should we review next\?/);
});

test('/q renders structured answer buttons and auto-submits from callbacks', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      {
        questionId: `0x${'12'.repeat(32)}`,
        questionType: 'binary',
        prompt: 'Should Demo adopt this proposal?',
      },
      {
        questionId: `0x${'34'.repeat(32)}`,
        questionType: 'rating',
        prompt: 'How strong is the signal?',
      },
      {
        questionId: `0x${'56'.repeat(32)}`,
        questionType: 'multichoice',
        prompt: 'Which option should Demo prioritize?',
        options: ['Option A', 'Option B', 'Option C'],
        singleSelect: true,
      },
    ]),
  });

  const binary = await buildTelegramCommandResponse({
    update: groupMessage('/q 1'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const rating = await buildTelegramCommandResponse({
    update: groupMessage('/q 2'),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const multichoice = await buildTelegramCommandResponse({
    update: groupMessage('/q 3'),
    env,
    now: '2026-05-08T12:00:02.000Z',
  });

  assert.equal(binary.ok, true);
  assert.equal(binary.response.text, 'Should Demo adopt this proposal?');
  assert.equal(binary.response.text.includes('Options:'), false);
  assert.equal(binary.response.text.includes('Tap an answer'), false);
  assert.deepEqual(
    flattenButtons(binary.response.replyMarkup).map((button) => button.text).slice(0, 3),
    ['Agree', 'Disagree', 'Unsure']
  );
  assert.deepEqual(
    binary.response.replyMarkup.inline_keyboard.slice(0, 3).map((row) => row.map((button) => button.text)),
    [['Agree', 'Disagree'], ['Unsure'], ['Other Questions']],
  );
  assert.deepEqual(
    flattenButtons(rating.response.replyMarkup).map((button) => button.text).slice(0, 11),
    ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  );
  assert.deepEqual(
    flattenButtons(multichoice.response.replyMarkup).map((button) => button.text).slice(0, 3),
    ['Option A', 'Option B', 'Option C']
  );
  assert.equal(binary.response.text.includes('0x1212121212121212121212121212121212121212121212121212121212121212'), false);

  const binaryButtons = flattenButtons(binary.response.replyMarkup);
  const onboardAgent = binaryButtons.find((button) => button.text === 'Onboard Agent');
  assert.match(onboardAgent?.url || '', /^https:\/\/t\.me\/ce_demo_bot\?start=cetg_[a-z0-9]{10,48}$/);
  const agree = binaryButtons.find((button) => button.text === 'Agree');
  const disagree = binaryButtons.find((button) => button.text === 'Disagree');
  const submitDraft = binaryButtons.find((button) => button.text === 'Submit Draft');
  assert.equal(submitDraft, undefined);
  const saved = await buildTelegramCommandResponse({
    update: {
      update_id: 7011,
      callback_query: {
        id: 'callback-answer-agree',
        data: agree.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 61,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:03.000Z',
  });

  assert.equal(saved.ok, true);
  assert.equal(saved.response, null);
  assert.equal(saved.answerDraftSaved, true);
  assert.equal(saved.userSessionBound, true);
  assert.equal(saved.submitRequestCreated, true);
  assert.equal(saved.submitRequest.status, 'submit_request_created');
  assert.equal(saved.submitRequest.canonicalApiRequest.path, '/api/agent/responses/submit-request');
  assert.equal(saved.submitRequest.replayed, false);
  assert.match(saved.submitRequest.idempotencyKey, /^telegram_bot_submit:42:alpha:/);
  assert.equal(saved.callbackAnswerText, 'Submitted.');
  const answerUserBinding = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:private-session:42'));
  assert.equal(answerUserBinding.sessionSlug, 'alpha');
  assert.equal(answerUserBinding.source, 'group_answer');
  assert.equal(answerUserBinding.sourceChatId, '-100123');

  const draftRecords = Array.from(env.AGENT_ACTION_KV.store.values())
    .map((value) => JSON.parse(value))
    .filter((value) => value.status === 'draft_saved');
  assert.equal(draftRecords.length, 1);
  assert.equal(draftRecords[0].answerLabel, 'Agree');
  assert.equal(draftRecords[0].questionId, `0x${'12'.repeat(32)}`);
  assert.equal(draftRecords[0].submitLane, 'telegram_private_account');

  const replayedSubmit = await buildTelegramCommandResponse({
    update: {
      update_id: 7012,
      callback_query: {
        id: 'callback-answer-agree-replay',
        data: agree.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 61,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:04.000Z',
  });

  assert.equal(replayedSubmit.ok, true);
  assert.equal(replayedSubmit.submitRequestCreated, true);
  assert.equal(replayedSubmit.submitRequest.requestId, saved.submitRequest.requestId);
  assert.equal(replayedSubmit.submitRequest.replayed, true);

  await saveTelegramAgentSettingsPatch({
    env,
    sessionSlug: 'alpha',
    telegramUserId: '42',
    patch: { draftDivergenceOptIn: true },
    createdAt: '2026-05-08T12:00:05.000Z',
  });

  const submitRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => key.startsWith('telegram:submit-request:'))
    .map(([, value]) => JSON.parse(value));
  assert.equal(submitRecords.length, 1);
  assert.equal(submitRecords[0].action, 'submit_response');
  assert.equal(submitRecords[0].lane, 'telegram_private_account');
  assert.equal(submitRecords[0].answer.label, 'Agree');
  assert.equal(submitRecords[0].canonicalApiRequest.body.questionId, `0x${'12'.repeat(32)}`);
  assert.equal(submitRecords[0].canonicalApiRequest.body.idempotencyKey, saved.submitRequest.idempotencyKey);

  const changedSubmitted = await buildTelegramCommandResponse({
    update: {
      update_id: 7014,
      callback_query: {
        id: 'callback-answer-disagree',
        data: disagree.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 61,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:06.000Z',
  });

  assert.equal(changedSubmitted.ok, true);
  assert.equal(changedSubmitted.submitRequestCreated, true);
  assert.equal(changedSubmitted.submitRequest.replayed, false);
  assert.equal(changedSubmitted.draftEditMetric.stored, true);
  assert.notEqual(changedSubmitted.submitRequest.requestId, saved.submitRequest.requestId);
  assert.notEqual(changedSubmitted.submitRequest.idempotencyKey, saved.submitRequest.idempotencyKey);
  const changedSubmitRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => key.startsWith('telegram:submit-request:'))
    .map(([, value]) => JSON.parse(value));
  assert.equal(changedSubmitRecords.length, 2);
  assert.equal(changedSubmitRecords.some((record) => record.answer.label === 'Agree'), true);
  assert.equal(changedSubmitRecords.some((record) => record.answer.label === 'Disagree'), true);
  const draftEditRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => key.startsWith(DRAFT_EDIT_METRIC_KV_PREFIX))
    .map(([, value]) => JSON.parse(value));
  assert.equal(draftEditRecords.length, 1);
  assert.equal(draftEditRecords[0].source, 'telegram_bot');
  assert.equal(draftEditRecords[0].finality, 'submitted');
  assert.equal(draftEditRecords[0].metrics.binaryFrom, 'agree');
  assert.equal(draftEditRecords[0].metrics.binaryTo, 'disagree');
  assert.equal(draftEditRecords[0].metrics.binaryTransition, 'opposite');
  assert.equal(Object.hasOwn(draftEditRecords[0], 'telegramUserId'), false);

  const calls = [];
  const dispatched = await dispatchTelegramCommandResponse({
    commandResponse: saved,
    env,
    fetchImpl: async (...args) => {
      calls.push(args);
      return new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  assert.equal(dispatched.telegram.ok, true);
  assert.equal(dispatched.telegram.skipped, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://api.telegram.org/bot123456:test-token/answerCallbackQuery');
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    callback_query_id: 'callback-answer-agree',
    show_alert: false,
    cache_time: 0,
    text: 'Submitted.',
  });
});

test('callback dispatch answers callback queries before editing messages', async () => {
  const env = baseEnv();
  const joined = await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const viewQuestions = flattenButtons(joined.response.replyMarkup)
    .find((button) => button.text === 'View Questions');
  const commandResponse = await buildTelegramCommandResponse({
    update: {
      update_id: 7005,
      callback_query: {
        id: 'callback-answer-me',
        data: viewQuestions.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 57,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const dispatched = await dispatchTelegramCommandResponse({
    commandResponse,
    env,
    fetchImpl: fetchMock,
  });

  assert.equal(dispatched.telegram.ok, true);
  assert.equal(dispatched.telegram.callbackAnswer.ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'https://api.telegram.org/bot123456:test-token/answerCallbackQuery');
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    callback_query_id: 'callback-answer-me',
    show_alert: false,
    cache_time: 0,
  });
  assert.equal(calls[1][0], 'https://api.telegram.org/bot123456:test-token/editMessageText');
});

test('callback dispatch sends a fresh message when editing an old message fails', async () => {
  const env = baseEnv();
  const joined = await buildTelegramCommandResponse({
    update: groupMessage('/join alpha'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const viewQuestions = flattenButtons(joined.response.replyMarkup)
    .find((button) => button.text === 'View Questions');
  const commandResponse = await buildTelegramCommandResponse({
    update: {
      update_id: 7006,
      callback_query: {
        id: 'callback-old-message',
        data: viewQuestions.callback_data,
        from: { id: 42, username: 'host' },
        message: {
          message_id: 57,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:01.000Z',
  });
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    const method = String(args[0]).split('/').pop();
    if (method === 'editMessageText') {
      return new Response(JSON.stringify({ ok: false, description: 'Bad Request: message can not be edited' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const dispatched = await dispatchTelegramCommandResponse({
    commandResponse,
    env,
    fetchImpl: fetchMock,
  });

  assert.equal(dispatched.telegram.ok, true);
  assert.equal(calls.map((call) => String(call[0]).split('/').pop()).join(','), 'answerCallbackQuery,editMessageText,sendMessage');
});

test('/attachments lists public metadata and hides private storage refs', async () => {
  const kv = new MemoryKv();
  const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  await kv.put('telegram:mini-app-document:v1:alpha:mini-doc-uploaded-plan', JSON.stringify({
    docId: 'mini-doc-uploaded-plan',
    sessionSlug: 'alpha',
    title: 'Mini App uploaded notes',
    fileType: 'png',
    visibility: 'session',
    storageProfile: 'cloudflare',
    privateContentRef: 'kv://telegram:mini-app-document-bytes:v1:alpha:mini-doc-uploaded-plan',
    createdAt: '2026-05-08T12:00:00.000Z',
  }));
  await kv.put('telegram:mini-app-document-bytes:v1:alpha:mini-doc-uploaded-plan', JSON.stringify({
    sessionSlug: 'alpha',
    docId: 'mini-doc-uploaded-plan',
    title: 'Mini App uploaded notes',
    fileType: 'png',
    contentType: 'image/png',
    dataBase64: Buffer.from(imageBytes).toString('base64'),
  }));
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/attachments alpha'),
    env: baseEnv({ AGENT_ACTION_KV: kv }),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'doc_library');
  assert.match(result.response.text, /Attachments for alpha/);
  assert.match(result.response.text, /Private or gated files open in the Mini App/);
  assert.match(result.response.text, /Mini App uploaded notes \(png, session\)/);
  assert.match(result.response.text, /Public plan \(md, public\)/);
  assert.match(result.response.text, /Gated appendix \(pdf, sbt_gated\)/);
  assert.equal(result.response.text.includes('r2://private'), false);
  assert.equal(result.response.text.includes('kv://telegram'), false);
  const buttons = flattenButtons(result.response.replyMarkup);
  assert.deepEqual(buttons.map((button) => button.text), [
    'Show 1 as image',
    'Show 2 as image',
    'Show 3 as image',
    'View Questions',
  ]);
  assert.match(buttons[0].callback_data, /^cecb_[a-z0-9]{10,48}$/);
  const imageCallback = await buildTelegramCommandResponse({
    update: {
      update_id: 7110,
      callback_query: {
        id: 'callback-doc-image',
        data: buttons[0].callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 71,
          chat: { id: -100123, type: 'supergroup' },
        },
      },
    },
    env: baseEnv({ AGENT_ACTION_KV: kv }),
    now: '2026-05-08T12:00:00.000Z',
  });
  assert.equal(imageCallback.ok, true);
  assert.equal(imageCallback.screen, 'doc_image');
  assert.equal(imageCallback.response.method, 'sendPhoto');
  assert.match(imageCallback.response.text, /Mini App uploaded notes \(png\)/);
  assert.equal(imageCallback.response.photo.contentType, 'image/png');
  assert.deepEqual(Array.from(imageCallback.response.photo.bytes), Array.from(imageBytes));
  assert.equal(imageCallback.callbackQueryId, 'callback-doc-image');
});

test('/docs remains a legacy alias for attachments', async () => {
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/docs alpha'),
    env: baseEnv(),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'doc_library');
  assert.match(result.response.text, /Attachments for alpha/);
});

test('/me returns managed demo account metadata without the root secret', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const env = agentTokenEnv();
  const accountAddress = await privateManagedAccountAddress(env, now);
  const result = await buildTelegramCommandResponse({
    update: privateMessage('/me'),
    env,
    now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'my_account');
  assert.match(result.response.text, /Account/);
  assert.match(result.response.text, /Address: 0x[0-9a-f]{4}\.\.\.[0-9a-f]{4}/i);
  assert.doesNotMatch(result.response.text, /Chain:/);
  assert.doesNotMatch(result.response.text, /Use \/questions/);
  assert.equal(result.response.parseMode, '');
  const addressButton = flattenButtons(result.response.replyMarkup)
    .find((button) => /^0x[0-9a-f]{40}$/i.test(button.text) || /address\//i.test(button.url || ''));
  assert.equal(addressButton, undefined);
  const buttons = flattenButtons(result.response.replyMarkup);
  const copyAddress = buttons.find((button) => button.text === 'Copy Address');
  assert.deepEqual(copyAddress?.copy_text, { text: accountAddress });
  assert.equal(buttons.some((button) => button.text === 'View Questions'), true);
  assert.equal(buttons.some((button) => button.text === 'Onboard Agent'), true);
  assert.equal(buttons.some((button) => button.text === 'Activity'), true);
  const backToStart = buttons.find((button) => button.text === 'Back to Start');
  assert.match(backToStart?.callback_data || '', /^cecb_[a-z0-9]{10,48}$/);
  const start = await buildTelegramCommandResponse({
    update: {
      update_id: 9203,
      callback_query: {
        id: 'account-back-start',
        data: backToStart.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 79,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env,
    now,
  });
  assert.equal(start.screen, 'setup_welcome');
  assert.equal(start.response.method, 'editMessageText');
  assert.equal(JSON.stringify(result).includes('unit-root'), false);
});

test('/agent_token creates a 28-day scoped delegation token with masked chat body', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const env = agentTokenEnv();
  const result = await buildTelegramCommandResponse({
    update: privateMessage('/agent_token'),
    env,
    now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'agent_token');
  assert.equal(result.response.text, [
    'Press Copy Agent Info and paste to your agent or Claude Code',
    '',
    'Context Engine will ask questions, draft responses, and create a privacy-preserving opinion map',
  ].join('\n'));
  const copyInfoButton = flattenButtons(result.response.replyMarkup)
    .find((button) => button.text === 'Copy Agent Info');
  const copyInfo = copyInfoButton?.copy_text?.text || '';
  const token = copyInfo.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';
  assert.match(token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.match(copyInfo, /^Bearer; GET \/api\/agent\/questions; ask answer/);
  assert.doesNotMatch(copyInfo, /^CE Claude:/);
  assert.doesNotMatch(copyInfo, /\/questions first/);
  assert.match(copyInfo, /\ntoken=ceagt_/);
  assert.match(copyInfo, /\nworker=https:\/\/ce-agent-bridge-worker\.agalmic\.workers\.dev/);
  assert.match(copyInfo, /\nskill=https:\/\/ce-agent-bridge-worker\.agalmic\.workers\.dev\/api\/agent\/skill\?v=41/);
  assert.equal(new TextEncoder().encode(copyInfo).length <= 256, true);
  assert.equal(result.response.text.includes(token), false);
  assert.doesNotMatch(result.response.text, /Worker:/);
  assert.doesNotMatch(result.response.text, /Skill:/);
  assert.doesNotMatch(result.response.text, /Token:/);
  assert.doesNotMatch(result.response.text, /Expires:/);

  const loaded = await loadTelegramAgentDelegationToken({ env, token, now });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.record.principal.adapterUserId, '42');
  assert.equal(loaded.record.sessionSlug, 'alpha');
  const pointer = await readTelegramAgentDelegationTokenUserPointer({
    env,
    telegramUserId: '42',
    sessionSlug: 'alpha',
  });
  assert.equal(pointer.tokenHash, loaded.tokenHash);
  assert.equal(pointer.tokenHash.length, 64);
  assert.equal(JSON.stringify(pointer).includes(token), false);
  assert.equal(loaded.record.ttlSeconds, TELEGRAM_AGENT_DELEGATION_TOKEN_DEFAULT_TTL_SECONDS);
  assert.equal(loaded.record.scopes.includes(TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.READ_QUESTIONS), true);
  assert.equal(loaded.record.scopes.includes(TELEGRAM_AGENT_DELEGATION_TOKEN_SCOPES.DRAFT_ANSWERS), true);
  const storedRecords = Array.from(env.AGENT_ACTION_KV.store.values()).join('\n');
  assert.equal(storedRecords.includes(token), false);
  assert.equal(JSON.stringify(result).includes('unit-root'), false);
});

test('/agent_token re-onboard revokes the prior token pointer', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const env = agentTokenEnv();
  const first = await buildTelegramCommandResponse({
    update: privateMessage('/agent_token'),
    env,
    now,
  });
  const firstCopy = flattenButtons(first.response.replyMarkup)
    .find((button) => button.text === 'Copy Agent Info')?.copy_text?.text || '';
  const firstToken = firstCopy.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';
  const firstLoaded = await loadTelegramAgentDelegationToken({ env, token: firstToken, now });
  assert.equal(firstLoaded.ok, true);

  const second = await buildTelegramCommandResponse({
    update: privateMessage('/agent_token'),
    env,
    now,
  });
  const secondCopy = flattenButtons(second.response.replyMarkup)
    .find((button) => button.text === 'Copy Agent Info')?.copy_text?.text || '';
  const secondToken = secondCopy.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';
  const oldLoaded = await loadTelegramAgentDelegationToken({ env, token: firstToken, now });
  const secondLoaded = await loadTelegramAgentDelegationToken({ env, token: secondToken, now });
  const pointer = await readTelegramAgentDelegationTokenUserPointer({
    env,
    telegramUserId: '42',
    sessionSlug: 'alpha',
  });

  assert.equal(secondToken && secondToken !== firstToken, true);
  assert.equal(oldLoaded.ok, false);
  assert.equal(oldLoaded.reason, 'agent_token_not_found');
  assert.equal(secondLoaded.ok, true);
  assert.equal(pointer.tokenHash, secondLoaded.tokenHash);
  assert.notEqual(pointer.tokenHash, firstLoaded.tokenHash);
});

test('private Onboard Agent callback renders the copy install screen on first tap', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const env = agentTokenEnv();
  const start = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env,
    now,
  });
  const onboard = flattenButtons(start.response.replyMarkup)
    .find((button) => button.text === 'Onboard Agent');

  const result = await buildTelegramCommandResponse({
    update: {
      update_id: 9201,
      callback_query: {
        id: 'onboard-first-tap',
        data: onboard.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 77,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env,
    now,
  });
  const copyInfo = flattenButtons(result.response.replyMarkup)
    .find((button) => button.text === 'Copy Agent Info')?.copy_text?.text || '';
  const token = copyInfo.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';

  assert.ok(onboard.callback_data);
  assert.equal(onboard.url, undefined);
  assert.equal(result.screen, 'agent_token');
  assert.equal(result.response.method, 'editMessageText');
  assert.equal(result.callbackQueryId, 'onboard-first-tap');
  assert.match(result.response.text, /Press Copy Agent Info and paste to your agent or Claude Code/);
  assert.match(token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.equal(result.response.text.includes(token), false);
});

test('expired private Onboard Agent callback mints a fresh copy token screen', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const env = agentTokenEnv();

  const result = await buildTelegramCommandResponse({
    update: {
      update_id: 9202,
      callback_query: {
        id: 'onboard-expired-tap',
        data: 'cecb_expired001',
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 78,
          chat: { id: 42, type: 'private' },
          reply_markup: {
            inline_keyboard: [[
              { text: 'Onboard Agent', callback_data: 'cecb_expired001' },
            ]],
          },
        },
      },
    },
    env,
    now,
  });
  const copyToken = flattenButtons(result.response.replyMarkup)
    .find((button) => button.text === 'Copy Agent Info')?.copy_text?.text || '';
  const token = copyToken.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';

  assert.equal(result.screen, 'agent_token');
  assert.equal(result.response.method, 'editMessageText');
  assert.equal(result.callbackQueryId, 'onboard-expired-tap');
  assert.match(token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.equal(result.response.text.includes(token), false);
});

test('/start Onboard Agent deep-link mints private install info without exposing tokens in group', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const env = agentTokenEnv({
    AGENT_BRIDGE_MINI_APP_SHORT_NAME: 'context_engine',
  });
  const groupStart = await buildTelegramCommandResponse({
    update: groupMessage('/start'),
    env,
    now,
  });
  const onboard = flattenButtons(groupStart.response.replyMarkup)
    .find((button) => button.text === 'Onboard Agent');
  const miniAppOnboard = flattenButtons(groupStart.response.replyMarkup)
    .find((button) => button.text === 'Onboard Agent (Mini App)');
  assert.ok(onboard?.url);
  assert.ok(miniAppOnboard?.url);
  assert.equal(JSON.stringify(groupStart).includes('ceagt_'), false);
  assert.equal(JSON.stringify(onboard).includes('copy_text'), false);
  const onboardUrl = new URL(onboard.url);
  assert.equal(onboardUrl.pathname, `/${env.TELEGRAM_BOT_USERNAME}`);
  assert.equal(onboardUrl.searchParams.has('startapp'), false);
  const miniAppOnboardUrl = new URL(miniAppOnboard.url);
  assert.equal(miniAppOnboardUrl.pathname, `/${env.TELEGRAM_BOT_USERNAME}/${env.AGENT_BRIDGE_MINI_APP_SHORT_NAME}`);
  assert.equal(miniAppOnboardUrl.searchParams.get('startapp'), 'onboard__alpha');
  const payload = onboardUrl.searchParams.get('start');
  const privateStart = await buildTelegramCommandResponse({
    update: privateMessage(`/start ${payload}`),
    env,
    now,
  });
  const copyInfo = flattenButtons(privateStart.response.replyMarkup)
    .find((button) => button.text === 'Copy Agent Info')?.copy_text?.text || '';
  const token = copyInfo.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';

  assert.equal(privateStart.screen, 'agent_token');
  assert.match(token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.equal(privateStart.response.text.includes(token), false);
  assert.match(copyInfo, /https:\/\/ce-agent-bridge-worker\.agalmic\.workers\.dev/);
});

test('/start agent_onboarding slug deep-link opens the private copy install screen directly', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const env = agentTokenEnv();
  const result = await buildTelegramCommandResponse({
    update: privateMessage('/start agent_onboarding__alpha'),
    env,
    now,
  });
  const copyInfo = flattenButtons(result.response.replyMarkup)
    .find((button) => button.text === 'Copy Agent Info')?.copy_text?.text || '';
  const token = copyInfo.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'agent_token');
  assert.match(result.response.text, /Press Copy Agent Info and paste to your agent or Claude Code/);
  assert.doesNotMatch(result.response.text, /Session: Alpha Session/);
  assert.match(token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.equal(result.response.text.includes(token), false);
  const binding = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:private-session:42'));
  assert.equal(binding.sessionSlug, 'alpha');
  assert.equal(binding.followDefault, true);
});

test('/start agent_onboarding opens Mini App when already onboarded', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const env = agentTokenEnv({ AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example' });
  const first = await buildTelegramCommandResponse({
    update: privateMessage('/start agent_onboarding__alpha'),
    env,
    now,
  });
  const firstCopy = flattenButtons(first.response.replyMarkup)
    .find((button) => button.text === 'Copy Agent Info')?.copy_text?.text || '';
  const firstToken = firstCopy.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';
  const firstLoaded = await loadTelegramAgentDelegationToken({ env, token: firstToken, now });
  const firstPointer = await readTelegramAgentDelegationTokenUserPointer({
    env,
    telegramUserId: '42',
    sessionSlug: 'alpha',
  });

  const linkedAgain = await buildTelegramCommandResponse({
    update: privateMessage('/start agent_onboarding__alpha'),
    env,
    now,
  });
  const buttons = flattenButtons(linkedAgain.response.replyMarkup);
  const miniApp = buttons.find((button) => button.text === 'Open Mini App');
  const copyNew = buttons.find((button) => button.text === 'Copy New Agent Info');
  const secondToken = copyNew?.copy_text?.text?.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';
  const secondPointer = await readTelegramAgentDelegationTokenUserPointer({
    env,
    telegramUserId: '42',
    sessionSlug: 'alpha',
  });
  const oldLoaded = await loadTelegramAgentDelegationToken({ env, token: firstToken, now });
  const secondLoaded = await loadTelegramAgentDelegationToken({ env, token: secondToken, now });

  assert.equal(firstLoaded.ok, true);
  assert.equal(linkedAgain.screen, 'agent_onboarded_mini_app');
  assert.match(linkedAgain.response.text, /Context Engine is already enabled/);
  assert.equal(buttons.some((button) => button.text === 'Copy Agent Info'), false);
  assert.equal(buttons.some((button) => button.text === 'Copy New Agent Info'), true);
  assert.ok(copyNew?.copy_text?.text);
  assert.equal(copyNew.callback_data, undefined);
  assert.match(secondToken, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.match(miniApp.web_app.url, /^https:\/\/bridge\.example\/telegram\/mini-app\?launch=cecb_[a-z0-9]{10,48}$/);
  assert.equal(linkedAgain.response.text.includes(secondToken), false);
  assert.notEqual(secondPointer.tokenHash, firstPointer.tokenHash);
  assert.equal(oldLoaded.ok, false);
  assert.equal(secondLoaded.ok, true);
  assert.equal(secondPointer.tokenHash, secondLoaded.tokenHash);
});

test('private Onboard Agent callback opens Mini App when already onboarded', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const env = agentTokenEnv({ AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example' });
  await buildTelegramCommandResponse({
    update: privateMessage('/start agent_onboarding__alpha'),
    env,
    now,
  });
  const start = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env,
    now,
  });
  const onboard = flattenButtons(start.response.replyMarkup)
    .find((button) => button.text === 'Onboard Agent');

  const result = await buildTelegramCommandResponse({
    update: {
      update_id: 9205,
      callback_query: {
        id: 'onboard-existing-tap',
        data: onboard.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 79,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env,
    now,
  });
  const buttons = flattenButtons(result.response.replyMarkup);
  const miniApp = buttons.find((button) => button.text === 'Open Mini App');
  const copyNew = buttons.find((button) => button.text === 'Copy New Agent Info');

  assert.equal(result.screen, 'agent_onboarded_mini_app');
  assert.equal(result.response.method, 'editMessageText');
  assert.equal(result.callbackQueryId, 'onboard-existing-tap');
  assert.equal(buttons.some((button) => button.text === 'Copy Agent Info'), false);
  assert.equal(buttons.some((button) => button.text === 'Copy New Agent Info'), true);
  assert.ok(copyNew?.copy_text?.text);
  assert.equal(copyNew.callback_data, undefined);
  assert.match(miniApp.web_app.url, /^https:\/\/bridge\.example\/telegram\/mini-app\?launch=cecb_[a-z0-9]{10,48}$/);
  const token = copyNew.copy_text.text.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';
  assert.match(token, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.equal(result.response.text.includes(token), false);
});

test('already-onboarded agent screen exposes fresh install info as a copy button', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const env = agentTokenEnv({ AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example' });
  const first = await buildTelegramCommandResponse({
    update: privateMessage('/start agent_onboarding__alpha'),
    env,
    now,
  });
  const firstCopy = flattenButtons(first.response.replyMarkup)
    .find((button) => button.text === 'Copy Agent Info')?.copy_text?.text || '';
  const firstToken = firstCopy.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';
  const firstLoaded = await loadTelegramAgentDelegationToken({ env, token: firstToken, now });
  assert.equal(firstLoaded.ok, true);

  const linkedAgain = await buildTelegramCommandResponse({
    update: privateMessage('/start agent_onboarding__alpha'),
    env,
    now,
  });
  const copyNewButton = flattenButtons(linkedAgain.response.replyMarkup)
    .find((button) => button.text === 'Copy New Agent Info');
  const refreshedCopy = copyNewButton?.copy_text?.text || '';
  const refreshedToken = refreshedCopy.match(/ceagt_[A-Za-z0-9_-]+/)?.[0] || '';
  const oldLoaded = await loadTelegramAgentDelegationToken({ env, token: firstToken, now });
  const refreshedLoaded = await loadTelegramAgentDelegationToken({ env, token: refreshedToken, now });
  const pointer = await readTelegramAgentDelegationTokenUserPointer({
    env,
    telegramUserId: '42',
    sessionSlug: 'alpha',
  });

  assert.equal(linkedAgain.screen, 'agent_onboarded_mini_app');
  assert.equal(copyNewButton.callback_data, undefined);
  assert.match(refreshedToken, /^ceagt_[A-Za-z0-9_-]{32,}$/);
  assert.notEqual(refreshedToken, firstToken);
  assert.equal(oldLoaded.ok, false);
  assert.equal(refreshedLoaded.ok, true);
  assert.equal(pointer.tokenHash, refreshedLoaded.tokenHash);
  assert.match(refreshedCopy, /\ntoken=ceagt_/);
  assert.equal(linkedAgain.response.text.includes(refreshedToken), false);
});

test('/start agent_onboarding non-default slug pins the session', async () => {
  const now = '2026-05-08T12:00:00.000Z';
  const env = agentTokenEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          default: true,
          telegramBridgeEnabled: true,
          telegramOnly: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'beta',
          sessionName: 'Beta Session',
          telegramBridgeEnabled: true,
          telegramOnly: true,
          telegramGroupOpenAccess: true,
          managedAccountSubmitAllowed: true,
        },
      ],
    }),
  });
  const result = await buildTelegramCommandResponse({
    update: privateMessage('/start agent_onboarding__beta'),
    env,
    now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'agent_token');
  const binding = JSON.parse(await env.AGENT_ACTION_KV.get('telegram:private-session:42'));
  assert.equal(binding.sessionSlug, 'beta');
  assert.equal(binding.followDefault, false);
});

test('/agent_token refuses explicit sessions that are not selectable for the Telegram account', async () => {
  const env = agentTokenEnv({
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          default: true,
          telegramBridgeEnabled: true,
          telegramOnly: true,
        },
        {
          sessionSlug: 'beta',
          sessionName: 'Normal CE Session',
          telegramBridgeEnabled: true,
          telegramOnly: false,
        },
      ],
    }),
  });
  const result = await buildTelegramCommandResponse({
    update: privateMessage('/agent_token beta'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'agent_token_session_not_selectable');
  assert.match(result.response.text, /Join or select a Telegram-enabled session first/);
});

test('/start includes a Mini App button that opens the session picker before a private session is selected', async () => {
  const env = baseEnv({ AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example' });
  const result = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'setup_welcome');
  const buttonLabels = flattenButtons(result.response.replyMarkup).map((button) => button.text);
  assert.deepEqual(buttonLabels, ['Mini App', 'Onboard Agent', 'About']);
  assert.equal(result.response.text.includes('/results [ consensus | group ]'), false);
  assert.equal(result.response.text.split('\n').includes('/results'), true);
  assert.equal(result.response.text.includes('/q <number>'), false);
  assert.equal(result.response.text.includes('/actions'), false);
  assert.equal(result.response.text.includes('/settings'), false);
  assert.equal(result.response.text.includes('/join'), false);
  assert.equal(result.response.text.includes('/sessions'), false);
  assert.equal(result.response.text.includes('/groups'), false);
  assert.equal(result.response.text.includes('/add_question'), false);
  assert.equal(result.response.text.includes('/attachments'), false);
  assert.equal(result.response.text.split('\n').includes('/questions'), true);
  assert.equal(result.response.text.split('\n').includes('Onboard Agent or use Mini-App'), true);
  assert.equal(result.response.text.split('\n').includes('/me'), true);
  assert.equal(result.response.text.includes('/me - My Account'), false);
  assert.equal(result.response.text.includes('/questions - view session questions'), false);
  const miniApp = flattenButtons(result.response.replyMarkup)
    .find((button) => button.text === 'Mini App');
  assert.match(miniApp.web_app.url, /^https:\/\/bridge\.example\/telegram\/mini-app\?launch=cecb_[a-z0-9]{10,48}$/);
  const launch = new URL(miniApp.web_app.url).searchParams.get('launch');
  const record = JSON.parse(await env.AGENT_ACTION_KV.get(`telegram:action:${launch}`));
  assert.equal(record.miniAppLaunch, true);
  assert.equal(record.action, 'view_questions');
  assert.equal(record.serverContextRef.sessionPicker, true);
  assert.equal(record.serverContextRef.sessionSlug, undefined);
});

test('/start About button explains Context Engine and links the OSS repo and worker skill', async () => {
  const env = baseEnv();
  const start = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const about = flattenButtons(start.response.replyMarkup).find((button) => button.text === 'About');
  const result = await buildTelegramCommandResponse({
    update: {
      update_id: 9204,
      callback_query: {
        id: 'about-tap',
        data: about.callback_data,
        from: { id: 42, username: 'participant' },
        message: {
          message_id: 80,
          chat: { id: 42, type: 'private' },
        },
      },
    },
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.screen, 'about_context_engine');
  assert.match(result.response.text, /privacy-preserving opinion maps/);
  assert.match(result.response.text, /Worker skill: https:\/\/github\.com\/AgalmicSoftware\/context-engine\/blob\/main\/workers\/agentBridgeWorker\/skills\/ce-telegram-agent-handoff\/SKILL\.md/);
  const repo = flattenButtons(result.response.replyMarkup).find((button) => button.text === 'Open OSS Repo');
  assert.equal(repo.url, 'https://github.com/AgalmicSoftware/context-engine/tree/main');
  const skill = flattenButtons(result.response.replyMarkup).find((button) => button.text === 'Worker Skill.md');
  assert.equal(skill.url, 'https://github.com/AgalmicSoftware/context-engine/blob/main/workers/agentBridgeWorker/skills/ce-telegram-agent-handoff/SKILL.md');
});

test('/start auto-joins a single Telegram-only session and keeps the welcome screen minimal', async () => {
  const policy = {
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
  };
  const privateEnv = baseEnv({
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify(policy),
  });
  const privateStart = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env: privateEnv,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(privateStart.ok, true);
  assert.equal(privateStart.screen, 'setup_welcome');
  assert.match(privateStart.response.text, /Session: Alpha Session/);
  assert.equal(privateStart.response.text.includes('/sessions'), false);
  assert.equal(privateStart.response.text.includes('/groups'), false);
  assert.equal(privateStart.response.text.includes('/add_question'), false);
  assert.equal(privateStart.response.text.includes('/attachments'), false);
  const privateBinding = JSON.parse(await privateEnv.AGENT_ACTION_KV.get('telegram:private-session:42'));
  assert.equal(privateBinding.sessionSlug, 'alpha');
  assert.equal(privateBinding.source, 'private_chat');
  assert.equal(privateBinding.followDefault, true);
  const privateMiniApp = flattenButtons(privateStart.response.replyMarkup).find((button) => button.text === 'Mini App');
  const privateLaunch = new URL(privateMiniApp.web_app.url).searchParams.get('launch');
  const privateRecord = JSON.parse(await privateEnv.AGENT_ACTION_KV.get(`telegram:action:${privateLaunch}`));
  assert.equal(privateRecord.serverContextRef.sessionSlug, 'alpha');
  assert.equal(privateRecord.serverContextRef.sessionPicker, undefined);

  const groupEnv = baseEnv({
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify(policy),
  });
  const groupStart = await buildTelegramCommandResponse({
    update: groupMessage('/start'),
    env: groupEnv,
    now: '2026-05-08T12:00:00.000Z',
  });
  assert.equal(groupStart.ok, true);
  assert.match(groupStart.response.text, /Session: Alpha Session/);
  assert.equal(groupStart.response.text.includes('/sessions'), false);
  const groupBinding = JSON.parse(await groupEnv.AGENT_ACTION_KV.get('telegram:group-session:-100123'));
  assert.equal(groupBinding.sessionSlug, 'alpha');
  assert.equal(groupBinding.followDefault, true);
  const groupUserBinding = JSON.parse(await groupEnv.AGENT_ACTION_KV.get('telegram:private-session:42'));
  assert.equal(groupUserBinding.sessionSlug, 'alpha');
  assert.equal(groupUserBinding.source, 'single_session_start');
  assert.equal(groupUserBinding.followDefault, true);
  const groupMiniApp = flattenButtons(groupStart.response.replyMarkup).find((button) => button.text === 'Mini App');
  const groupLaunch = new URL(groupMiniApp.url).searchParams.get('start');
  const groupRecord = JSON.parse(await groupEnv.AGENT_ACTION_KV.get(`telegram:action:${groupLaunch}`));
  assert.equal(groupRecord.serverContextRef.sessionSlug, 'alpha');
});

test('/start keeps session selection visible when multiple Telegram-only sessions are available', async () => {
  const env = baseEnv({
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        { sessionSlug: 'alpha', sessionName: 'Alpha Session', telegramBridgeEnabled: true, telegramOnly: true, telegramGroupOpenAccess: true },
        { sessionSlug: 'beta', sessionName: 'Beta Session', telegramBridgeEnabled: true, telegramOnly: true, telegramGroupOpenAccess: true },
      ],
    }),
  });
  const result = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.response.text.includes('/sessions - choose session'), true);
  assert.equal(result.response.text.includes('/groups'), false);
  assert.equal(result.response.text.includes('/add_question'), false);
  assert.equal(result.response.text.includes('/attachments'), false);
  assert.equal(await env.AGENT_ACTION_KV.get('telegram:private-session:42'), null);
  const miniApp = flattenButtons(result.response.replyMarkup).find((button) => button.text === 'Mini App');
  const launch = new URL(miniApp.web_app.url).searchParams.get('launch');
  const record = JSON.parse(await env.AGENT_ACTION_KV.get(`telegram:action:${launch}`));
  assert.equal(record.serverContextRef.sessionPicker, true);
});

test('group /start includes a Mini App deep link to the session picker', async () => {
  const env = baseEnv({ AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example' });
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/start'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'setup_welcome');
  assert.deepEqual(flattenButtons(result.response.replyMarkup).map((button) => button.text), ['Mini App', 'Onboard Agent', 'About']);
  assert.equal(result.response.text.includes('/sessions'), false);
  assert.equal(result.response.text.includes('/groups'), false);
  assert.equal(result.response.text.includes('/add_question'), false);
  assert.equal(result.response.text.includes('/attachments'), false);
  const miniApp = flattenButtons(result.response.replyMarkup)
    .find((button) => button.text === 'Mini App');
  assert.match(miniApp.url, /^https:\/\/t\.me\/ce_demo_bot\?start=cecb_[a-z0-9]{10,48}$/);
  const launch = new URL(miniApp.url).searchParams.get('start');
  const record = JSON.parse(await env.AGENT_ACTION_KV.get(`telegram:action:${launch}`));
  assert.equal(record.miniAppLaunch, true);
  assert.equal(record.serverContextRef.sessionPicker, true);
  const putCall = env.AGENT_ACTION_KV.putCalls.find((call) => call.key === `telegram:action:${launch}`);
  assert.equal(putCall?.options?.expirationTtl, 30 * 24 * 60 * 60);
});

test('expired private start payload refreshes Mini App entry point', async () => {
  const env = agentTokenEnv({ AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example' });
  const result = await buildTelegramCommandResponse({
    update: privateMessage('/start cecb_expired001'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'private_start_refreshed');
  assert.equal(result.startPayload, 'cecb_expired001');
  assert.equal(result.active, false);
  assert.equal(result.refreshed, true);
  assert.match(result.response.text, /refreshed the Mini App entry point/);
  const miniApp = flattenButtons(result.response.replyMarkup)
    .find((button) => button.text === 'Mini App');
  assert.ok(miniApp?.web_app?.url);
  const launch = new URL(miniApp.web_app.url).searchParams.get('launch');
  const record = JSON.parse(await env.AGENT_ACTION_KV.get(`telegram:action:${launch}`));
  assert.equal(record.miniAppLaunch, true);
  assert.equal(record.serverContextRef.sessionSlug, 'alpha');
});

test('Mini App start payload shows session name instead of slug', async () => {
  const env = baseEnv({ AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example' });
  const launch = 'cecb_live000001';
  await env.AGENT_ACTION_KV.put(`telegram:action:${launch}`, JSON.stringify({
    action: 'view_questions',
    lane: 'telegram_mini_app',
    serverContextRef: { sessionSlug: 'alpha' },
    callbackData: launch,
    miniAppLaunch: true,
    createdAt: '2026-05-08T12:00:00.000Z',
  }));

  const result = await buildTelegramCommandResponse({
    update: privateMessage(`/start ${launch}`),
    env,
    now: '2026-05-08T12:00:01.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'private_start');
  assert.match(result.response.text, /Open the Mini App for Alpha Session\./);
  assert.equal(result.response.text.includes('Open the Mini App for alpha.'), false);
});

test('dispatchTelegramCommandResponse uses mocked fetch and does not require real Telegram credentials', async () => {
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    return new Response(JSON.stringify({ ok: true, result: { message_id: 77 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const commandResponse = await buildTelegramCommandResponse({
    update: privateMessage('/start'),
    env: baseEnv(),
    now: '2026-05-08T12:00:00.000Z',
  });
  const dispatched = await dispatchTelegramCommandResponse({
    commandResponse,
    env: baseEnv(),
    fetchImpl: fetchMock,
  });

  assert.equal(dispatched.telegram.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://api.telegram.org/bot123456:test-token/sendMessage');
});
