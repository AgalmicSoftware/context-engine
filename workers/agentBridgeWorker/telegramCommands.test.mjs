import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  buildTelegramCommandResponse,
  dispatchTelegramCommandResponse,
  handleTelegramWebhookUpdate,
  parseTelegramCommandText,
} from './telegramCommands.mjs';
import { deriveManagedDemoAccount } from './managedAccounts.mjs';
import { __test__sessionQuestions } from './sessionQuestions.mjs';

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

function groupMessage(text) {
  return {
    update_id: 7001,
    message: {
      message_id: 11,
      text,
      chat: { id: -100123, type: 'supergroup', title: 'Alpha Lobby' },
      from: { id: 42, username: 'host' },
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
    update: groupMessage('/actions'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });
  const buttons = flattenButtons(result.response.replyMarkup);
  const settings = buttons.find((button) => button.text === 'Settings');
  const viewQuestions = buttons.find((button) => button.text === 'View Questions');
  const storedActionKeys = Array.from(env.AGENT_ACTION_KV.store.keys())
    .filter((key) => key.startsWith('telegram:action:'));

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'agent_action_menu');
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
  assert.equal(privateSettings.canonicalApiRequest.path, '/api/agent/settings');
  assert.equal(privateSettings.settings.telegramReminders, false);
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
  assert.match(result.response.text, /Use \/attachments for session files/);
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
      sessions: [{ sessionSlug: 'old-alpha', sessionName: 'Old Alpha', telegramBridgeEnabled: true, telegramOnly: true }],
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
      { sessionSlug: 'old-alpha', sessionName: 'Old Alpha', telegramBridgeEnabled: true, telegramOnly: true },
      { sessionSlug: 'new-beta', sessionName: 'New Beta', telegramBridgeEnabled: true, telegramOnly: true },
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
  assert.equal(buttons.filter((button) => button.callback_data).length, 6);

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
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [
        {
          sessionSlug: 'alpha',
          sessionName: 'Alpha Session',
          telegramBridgeEnabled: true, telegramOnly: true,
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'beta',
          sessionName: 'Beta Session',
          telegramBridgeEnabled: true, telegramOnly: true,
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
  assert.deepEqual(flattenButtons(result.response.replyMarkup).map((button) => button.text), ['Alpha Session', 'Beta Session']);
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
  assert.deepEqual(flattenButtons(callback.response.replyMarkup).map((button) => button.text), [
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
  assert.equal(buttons.length, 2);
  assert.deepEqual(buttons.map((button) => button.text), [
    'Pose 1',
    'Pose 2',
  ]);
  for (const button of buttons) {
    assert.match(button.callback_data, /^cecb_[a-z0-9]{10,48}$/);
    assert.equal(button.callback_data.includes(publicQuestionId), false);
    assert.equal(button.callback_data.includes(lockedQuestionId), false);
  }
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
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      riskCeiling: 'submit',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha Session',
        default: true,
        telegramBridgeEnabled: true, telegramOnly: true,
        managedAccountSubmitAllowed: true,
        sponsoredAiAllowed: true,
        sessionWorkerUrl: 'https://session-worker.example',
      }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-1', questionType: 'agree_unsure_disagree', prompt: 'Should Alpha ship quickly?' },
      { questionId: 'q-2', questionType: 'agree_unsure_disagree', prompt: 'Should Alpha pause for review?' },
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
      assert.match(body.messages?.[1]?.content || '', /Top statements/);
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
    answer: { label: 'Agree', value: 'agree' },
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
  assert.match(result.response.text, /Selected session: alpha/);
  assert.match(result.response.text, /Consensus: highlights questions with the most disagreement/);
  assert.match(result.response.text, /Group: shows participant answer patterns/);
  assert.match(result.response.text, /\/results \[ consensus \| group \]/);
  assert.deepEqual(flattenButtons(result.response.replyMarkup).map((button) => button.text), ['Consensus', 'Group']);
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
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'beta',
          sessionName: 'Beta Session',
          telegramBridgeEnabled: true, telegramOnly: true,
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
    answer: { label: 'Agree', value: 'agree', controlType: 'binary' },
    onChain: {
      ok: true,
      accountAddress,
      storageRef: { backend: 'cloudflare', id: arweaveId(51), resource: 'responses' },
    },
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

test('/start and /me show export controls only to the configured export admin', async () => {
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

  assert.deepEqual(flattenButtons(allowedStart.response.replyMarkup).map((button) => button.text), ['Mini App', 'export_all', 'export_access']);
  assert.equal(flattenButtons(allowedMe.response.replyMarkup).some((button) => button.text === 'export_all'), true);
  assert.equal(flattenButtons(allowedMe.response.replyMarkup).some((button) => button.text === 'export_access'), true);
  assert.deepEqual(flattenButtons(deniedStart.response.replyMarkup).map((button) => button.text), ['Mini App']);
});

test('/start export_all targets the latest submitted session before the registry default', async () => {
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
          sessionWorkerUrl: 'https://session.example',
        },
        {
          sessionSlug: 'telegram-demo-2',
          sessionName: 'Telegram Demo 2',
          telegramBridgeEnabled: true, telegramOnly: true,
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
  const exportButton = flattenButtons(start.response.replyMarkup).find((button) => button.text === 'export_all');
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
  assert.deepEqual(flattenButtons(guestStart.response.replyMarkup).map((button) => button.text), ['Mini App', 'export_all']);
  assert.equal(guestExport.screen, 'response_export');
  assert.equal(guestExport.response.method, 'sendDocument');
  assert.equal(guestGrantAttempt.screen, 'response_export_access_denied');
  assert.match(guestGrantAttempt.response.text, /response_export_admin_required/);
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
    '2. Loaded q-storage-2',
    '3. Loaded q-storage-3',
  ].join('\n'));
  assert.equal(maxActiveReads, 3);
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
          managedAccountSubmitAllowed: true,
          docLibraryEnabled: true,
        },
        {
          sessionSlug: 'demo',
          sessionName: 'Demo Session',
          telegramBridgeEnabled: true, telegramOnly: true,
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
  assert.match(joined.response.text, /Use \/attachments for session files/);
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
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'demo',
          sessionName: 'Demo Session',
          telegramBridgeEnabled: true, telegramOnly: true,
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
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'demo',
          sessionName: 'Demo Session',
          telegramBridgeEnabled: true, telegramOnly: true,
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
          managedAccountSubmitAllowed: true,
        },
        {
          sessionSlug: 'demo',
          sessionName: 'Demo Session',
          telegramBridgeEnabled: true, telegramOnly: true,
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
  assert.notEqual(changedSubmitted.submitRequest.requestId, saved.submitRequest.requestId);
  assert.notEqual(changedSubmitted.submitRequest.idempotencyKey, saved.submitRequest.idempotencyKey);
  const changedSubmitRecords = Array.from(env.AGENT_ACTION_KV.store.entries())
    .filter(([key]) => key.startsWith('telegram:submit-request:'))
    .map(([, value]) => JSON.parse(value));
  assert.equal(changedSubmitRecords.length, 2);
  assert.equal(changedSubmitRecords.some((record) => record.answer.label === 'Agree'), true);
  assert.equal(changedSubmitRecords.some((record) => record.answer.label === 'Disagree'), true);

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

test('/attachments lists public metadata and hides private storage refs', async () => {
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/attachments alpha'),
    env: baseEnv(),
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'doc_library');
  assert.match(result.response.text, /Attachments for alpha/);
  assert.match(result.response.text, /Private or gated files open in the Mini App/);
  assert.match(result.response.text, /Public plan \(md, public\)/);
  assert.match(result.response.text, /Gated appendix \(pdf, sbt_gated\)/);
  assert.equal(result.response.text.includes('r2://private'), false);
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
  const accountAddress = await privateManagedAccountAddress(baseEnv(), now);
  const result = await buildTelegramCommandResponse({
    update: privateMessage('/me'),
    env: baseEnv(),
    now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'my_account');
  assert.match(result.response.text, /Account/);
  assert.match(result.response.text, /Address: <a href="https:\/\/optimism-sepolia\.blockscout\.com\/address\/0x[0-9a-f]{40}">0x[0-9a-f]{4}\.\.\.[0-9a-f]{4}<\/a>/i);
  assert.match(result.response.text, /Chain: OP Sepolia Testnet \(11155420\)/);
  assert.equal(result.response.parseMode, 'HTML');
  const addressButton = flattenButtons(result.response.replyMarkup)
    .find((button) => /^0x[0-9a-f]{40}$/i.test(button.text) || /address\//i.test(button.url || ''));
  assert.equal(addressButton, undefined);
  const buttons = flattenButtons(result.response.replyMarkup);
  const copyAddress = buttons.find((button) => button.text === 'Copy Address');
  assert.deepEqual(copyAddress?.copy_text, { text: accountAddress });
  assert.equal(buttons.some((button) => button.text === 'View Questions'), true);
  assert.equal(JSON.stringify(result).includes('unit-root'), false);
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
  assert.deepEqual(buttonLabels, ['Mini App']);
  assert.equal(result.response.text.includes('/results [ consensus | group ]'), true);
  assert.equal(result.response.text.includes('/actions'), false);
  assert.equal(result.response.text.includes('/settings'), false);
  assert.equal(result.response.text.includes('/join'), false);
  assert.equal(result.response.text.includes('/sessions - list linked sessions'), true);
  assert.equal(result.response.text.includes('/questions - view session questions'), true);
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

test('group /start includes a Mini App deep link to the session picker', async () => {
  const env = baseEnv({ AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example' });
  const result = await buildTelegramCommandResponse({
    update: groupMessage('/start'),
    env,
    now: '2026-05-08T12:00:00.000Z',
  });

  assert.equal(result.ok, true);
  assert.equal(result.screen, 'setup_welcome');
  assert.deepEqual(flattenButtons(result.response.replyMarkup).map((button) => button.text), ['Mini App']);
  const miniApp = flattenButtons(result.response.replyMarkup)
    .find((button) => button.text === 'Mini App');
  assert.match(miniApp.url, /^https:\/\/t\.me\/ce_demo_bot\?start=cecb_[a-z0-9]{10,48}$/);
  const launch = new URL(miniApp.url).searchParams.get('start');
  const record = JSON.parse(await env.AGENT_ACTION_KV.get(`telegram:action:${launch}`));
  assert.equal(record.miniAppLaunch, true);
  assert.equal(record.serverContextRef.sessionPicker, true);
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
