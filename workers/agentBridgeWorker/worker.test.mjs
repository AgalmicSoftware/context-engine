import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Buffer } from 'node:buffer';
import worker from './worker.js';

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

function launchFromMiniButton(button = {}) {
  if (button.web_app?.url) return new URL(button.web_app.url).searchParams.get('launch') || '';
  if (button.url) return new URL(button.url).searchParams.get('start') || '';
  return '';
}

function flattenButtons(replyMarkup = {}) {
  return (replyMarkup?.inline_keyboard || []).flat();
}

function telegramWebhookRequest(update = {}) {
  return new Request('https://bridge.example/telegram/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': 'webhook-secret',
    },
    body: JSON.stringify(update),
  });
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

function telegramMessageUpdate(text, {
  updateId = 1000,
  messageId = 10,
  chatId = -100123,
  chatType = 'supergroup',
  userId = 42,
  username = 'host',
} = {}) {
  return {
    update_id: updateId,
    message: {
      message_id: messageId,
      text,
      chat: { id: chatId, type: chatType, title: chatType === 'private' ? undefined : 'Alpha Lobby' },
      from: { id: userId, username },
    },
  };
}

function parseTelegramCallPayload(call = []) {
  return JSON.parse(call?.[1]?.body || '{}');
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

function assertOpaqueTelegramButtons(buttons = []) {
  for (const button of buttons) {
    if (button.callback_data) {
      assert.match(button.callback_data, /^cecb_[a-z0-9]{10,48}$/);
      assert.equal(button.callback_data.includes('alpha'), false);
      assert.equal(button.callback_data.includes('q-readiness'), false);
    }
    if (button.url) {
      const url = new URL(button.url);
      if (url.hostname === 'optimism-sepolia.blockscout.com') {
        assert.match(url.pathname, /^\/address\/0x[0-9a-f]{40}$/i);
        continue;
      }
      const launch = url.searchParams.get('start') || '';
      assert.match(launch, /^ce(?:cb|tg)_[a-z0-9]{10,48}$/);
      assert.equal(button.url.includes('q-readiness'), false);
      assert.equal(button.url.includes('private'), false);
    }
    if (button.web_app?.url) {
      const launch = new URL(button.web_app.url).searchParams.get('launch') || '';
      assert.match(launch, /^cecb_[a-z0-9]{10,48}$/);
      assert.equal(button.web_app.url.includes('q-readiness'), false);
      assert.equal(button.web_app.url.includes('private'), false);
    }
  }
}

function assertGroupSafeText(text = '') {
  assert.equal(text.includes('Private prompt must not leak'), false);
  assert.equal(text.includes('r2://private'), false);
  assert.equal(text.includes('unit-root'), false);
  assert.equal(text.includes('123456:test-token'), false);
}

test('worker health endpoint marks private bridge and default broadcast-enabled status', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/health'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.worker, 'agentBridgeWorker');
  assert.equal(body.privateRelease, true);
  assert.equal(body.broadcastEnabled, true);
});

test('worker serves the short Session Wrapped skill route', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/session-wrapped'));

  assert.equal(response.status, 302);
  const location = response.headers.get('location') || '';
  assert.match(location, /^https:\/\/raw\.githubusercontent\.com\/AgalmicSoftware\/context-engine\/main\/workers\/agentBridgeWorker\/skills\/ce-session-wrapped\/SKILL\.md/);
  assert.match(location, /v=2026-07-04-session-wrapped-v1-/);
});

test('worker serves the short Session Wrapped skill route to HEAD probes', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/session-wrapped', { method: 'HEAD' }));

  assert.equal(response.status, 302);
  const location = response.headers.get('location') || '';
  assert.match(location, /^https:\/\/raw\.githubusercontent\.com\/AgalmicSoftware\/context-engine\/main\/workers\/agentBridgeWorker\/skills\/ce-session-wrapped\/SKILL\.md/);
  assert.match(location, /v=2026-07-04-session-wrapped-v1-/);
});

test('worker dispatches canonical agent API routes', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/api/agent/session-meta?sessionSlug=alpha'), {
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramOnly: true,
        telegramBridgeEnabled: true,
      }],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.sessionSlug, 'alpha');
  assert.equal(body.telegramOnly, true);
});

test('worker mock demo route returns end-to-end private Telegram flow without secrets', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/mock/telegram/demo-flow', {
    method: 'POST',
    body: JSON.stringify({
      deploymentId: 'deploy-route',
      rootSecret: 'route-secret',
      sessionSlug: 'alpha',
    }),
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.account.accountMode, 'managed_telegram_demo');
  assert.equal(JSON.stringify(body).includes('route-secret'), false);
  assert.equal(JSON.stringify(body.groupCard).includes(body.account.accountAddress), false);
});

test('worker preview route is disabled unless explicitly enabled', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview'));
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'telegram_preview_disabled');
});

test('worker preview route renders an interactive mock Telegram surface when enabled', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview'), {
    AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
  });
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(text, /CE Telegram Preview/);
  assert.match(text, /mock\/telegram\/preview-update/);
  assert.match(text, /data-command="\/join alpha"/);
  assert.match(text, /data-command="\/questions"/);
  assert.equal(text.includes('data-command="/attachments"'), false);
  assert.equal(text.includes('data-command="/ce_join alpha"'), false);
  assert.equal(text.includes('data-command="/ce_questions"'), false);
  assert.equal(text.includes('data-command="/ce_attachments"'), false);
});

test('worker serves Telegram Mini App shell', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/telegram/mini-app'));
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(text, /Context Engine/);
  assert.match(text, /telegram-web-app\.js/);
  assert.match(text, /telegram\/mini-app\/api\/state/);
  assert.match(text, /mic\.innerHTML = MIC_ICON/);
  assert.equal(text.includes('prompt.innerHTML'), false);
  assert.match(text, /prompt\.textContent = question\.prompt \|\| question\.title/);
});

test('worker serves Telegram Mini App loading GIF asset', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/loading.gif'));
  const bytes = new Uint8Array(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/gif');
  assert.equal(new TextDecoder().decode(bytes.slice(0, 6)), 'GIF89a');
  assert.equal(bytes.length > 100000, true);
});

test('worker preview update is disabled unless explicitly enabled and does not mutate KV', async () => {
  const kv = new MemoryKv();
  const response = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chatType: 'supergroup',
      text: '/pose_question',
    }),
  }), {
    AGENT_ACTION_KV: kv,
  });
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'telegram_preview_disabled');
  assert.equal(kv.store.size, 0);
});

test('worker preview update exercises command builder without Telegram network calls when enabled', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chatType: 'supergroup',
      text: '/pose_question',
    }),
  }), {
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true, telegramGroupOpenAccess: true }],
    }),
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-readiness', prompt: 'What should Alpha decide next?' },
    ]),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.preview.screen, 'question_list');
  assert.match(body.preview.response.text, /^Questions \(1\/1\)/);
  assert.match(body.preview.response.text, /1\. What should Alpha decide next\?/);
  assert.equal(body.preview.response.text.includes('Choose a question'), false);
  assert.equal(JSON.stringify(body).includes('TELEGRAM_BOT_TOKEN'), false);
});

test('worker serves short-lived Telegram result photos from KV', async () => {
  const kv = new MemoryKv();
  await kv.put('telegram:result-photo:cecb_1234567890abcdef', JSON.stringify({
    version: 1,
    id: 'cecb_1234567890abcdef',
    filename: 'results.png',
    contentType: 'image/png',
    bytesBase64: Buffer.from([137, 80, 78, 71]).toString('base64'),
    createdAt: '2026-05-24T12:00:00.000Z',
  }));

  const response = await worker.fetch(new Request('https://bridge.example/telegram/result-photo/cecb_1234567890abcdef'), {
    AGENT_ACTION_KV: kv,
  });
  const bytes = new Uint8Array(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.deepEqual(Array.from(bytes), [137, 80, 78, 71]);
});

test('worker Mini App state and draft endpoints use opaque question actions', async () => {
  const kv = new MemoryKv();
  const bytes32QuestionId = `0x${'12'.repeat(32)}`;
  const env = {
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true, telegramGroupOpenAccess: true }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: bytes32QuestionId, questionType: 'rating', prompt: 'How strong is the signal?' },
      { questionId: 'q-binary', questionType: 'binary', prompt: 'Should Alpha proceed?' },
      { questionId: 'q-choice', questionType: 'multichoice', prompt: 'Pick a lane', options: ['A', 'B'], singleSelect: true },
      { questionId: 'q-text', questionType: 'freeform', prompt: 'What should Alpha write down?' },
      { questionId: 'q-extra-1', questionType: 'freeform', prompt: 'Extra 1' },
      { questionId: 'q-extra-2', questionType: 'freeform', prompt: 'Extra 2' },
    ]),
    AGENT_ACTION_KV: kv,
  };
  const previewResponse = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatType: 'private', text: '/start' }),
  }), env);
  const preview = await previewResponse.json();
  const miniButton = preview.preview.response.replyMarkup.inline_keyboard
    .flat()
    .find((button) => button.text === 'Mini App');
  const launch = launchFromMiniButton(miniButton);

  const stateResponse = await worker.fetch(new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha`), env);
  const state = await stateResponse.json();

  assert.equal(stateResponse.status, 200);
  assert.equal(state.ok, true);
  assert.equal(state.session.sessionSlug, 'alpha');
  assert.equal(state.pageSize, 50);
  assert.equal(state.questionCount, 6);
  assert.equal(state.availableQuestionCount, 6);
  assert.equal(state.discoveredQuestionCount, 6);
  assert.equal(state.unavailableQuestionCount, 0);
  assert.equal(JSON.stringify(state).includes(bytes32QuestionId), false);
  assert.equal(Object.hasOwn(state.questions[0], 'idShort'), false);
  assert.match(state.questions[0].questionKey, /^cecb_[a-z0-9]{10,48}$/);
  assert.equal(state.agent.actions.some((action) => action.id === 'agent.settings.update'), true);
  assert.equal(state.agent.account.canonicalApiRequest.path, '/api/agent/accounts/create');
  assert.equal(state.agent.settings.values.draftStyle, 'balanced');
  assert.equal(state.agent.settings.edit.canonicalApiRequest.path, '/api/agent/settings/update-request');

  const settingsResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      launch,
      settings: {
        draftStyle: 'concise',
      },
    }),
  }), env);
  const settings = await settingsResponse.json();

  assert.equal(settingsResponse.status, 200);
  assert.equal(settings.ok, true);
  assert.equal(settings.status, 'settings_update_request_created');
  assert.equal(settings.settings.draftStyle, 'concise');
  assert.equal(Object.hasOwn(settings.settings, 'telegramReminders'), false);
  assert.equal(settings.request.canonicalApiRequest.path, '/api/agent/settings/update-request');
  assert.equal(Object.hasOwn(settings.request.canonicalApiRequest.body.settingsPatchSummary, 'telegramReminders'), false);
  assert.match(settings.request.requestId, /^ceab_[a-z0-9]{10,48}$/);

  const secretSettingsResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      launch,
      settings: {
        draftStyle: 'detailed',
        privateKey: `0x${'99'.repeat(32)}`,
      },
    }),
  }), env);
  const secretSettings = await secretSettingsResponse.json();

  assert.equal(secretSettingsResponse.status, 400);
  assert.equal(secretSettings.ok, false);
  assert.match(secretSettings.error, /settings payloads must not serialize secrets/);

  const draftResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      launch,
      questionKey: state.questions[0].questionKey,
      answer: { value: 8, comments: 'Looks actionable' },
      submit: true,
    }),
  }), env);
  const draft = await draftResponse.json();

  assert.equal(draftResponse.status, 200);
  assert.equal(draft.ok, true);
  assert.equal(draft.status, 'submit_request_created');
  assert.equal(draft.draft.answerLabel, '8');
  assert.match(draft.submitRequest.requestId, /^ceab_[a-z0-9]{10,48}$/);
  assert.equal(draft.submitRequest.replayed, false);
  assert.match(draft.submitRequest.idempotencyKey, /^telegram_mini_submit:preview-user:alpha:/);
  assert.equal(draft.submitRequest.canonicalApiRequest.body.questionId, bytes32QuestionId);

  const replayResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      launch,
      questionKey: state.questions[0].questionKey,
      answer: { value: 8, comments: 'Looks actionable' },
      submit: true,
    }),
  }), env);
  const replay = await replayResponse.json();

  assert.equal(replayResponse.status, 200);
  assert.equal(replay.ok, true);
  assert.equal(replay.submitRequest.requestId, draft.submitRequest.requestId);
  assert.equal(replay.submitRequest.replayed, true);

  const replayedSubmitRequests = Array.from(kv.store.entries())
    .filter(([key]) => key.startsWith('telegram:submit-request:'));
  assert.equal(replayedSubmitRequests.length, 1);
  assert.equal(Array.from(kv.store.keys()).filter((key) => key.startsWith('telegram:agent-request:')).length, 1);
  assert.equal(JSON.parse(replayedSubmitRequests[0][1]).answer.value, 8);
  assert.equal(
    JSON.parse(replayedSubmitRequests[0][1]).canonicalApiRequest.body.idempotencyKey,
    draft.submitRequest.idempotencyKey
  );
  assert.equal(JSON.parse(replayedSubmitRequests[0][1]).canonicalApiRequest.body.questionId, bytes32QuestionId);

  const changedResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      launch,
      questionKey: state.questions[0].questionKey,
      answer: { value: 4, comments: 'Lower confidence' },
      submit: true,
    }),
  }), env);
  const changed = await changedResponse.json();

  assert.equal(changedResponse.status, 200);
  assert.equal(changed.ok, true);
  assert.notEqual(changed.submitRequest.requestId, draft.submitRequest.requestId);
  assert.notEqual(changed.submitRequest.idempotencyKey, draft.submitRequest.idempotencyKey);
  assert.equal(changed.submitRequest.replayed, false);

  const storedSubmitRequests = Array.from(kv.store.entries())
    .filter(([key]) => key.startsWith('telegram:submit-request:'))
    .map(([, value]) => JSON.parse(value));
  assert.equal(storedSubmitRequests.length, 2);
  assert.equal(storedSubmitRequests.some((record) => record.answer.value === 8), true);
  assert.equal(storedSubmitRequests.some((record) => record.answer.value === 4), true);
});

test('worker Mini App direct submit broadcasts on-chain when worker and policy are configured', async () => {
  const kv = new MemoryKv();
  const calls = [];
  const submitted = {};
  const bytes32QuestionId = `0x${'23'.repeat(32)}`;
  const env = {
    BROADCAST_ENABLED: 'true',
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    DEFAULT_CHAIN_ID: '11155420',
    DEFAULT_RPC_URL: 'https://rpc.example',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true, telegramOnly: true,
        managedAccountSubmitAllowed: true,
        sponsoredFaucetAllowed: true,
        sessionWorkerUrl: 'https://session.example',
        surveysAddress: '0x1111111111111111111111111111111111111111',
      }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: bytes32QuestionId, questionType: 'rating', prompt: 'How strong is the signal?' },
    ]),
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_FETCH: mockSessionWorkerFetch(calls, { txId: arweaveId(8) }),
    AGENT_BRIDGE_CONTRACT_FACTORY: ({ signer }) => ({
      async submitResponses(questionIds, responseHashes, surveyId, surveyResponseHash) {
        submitted.signer = signer.address;
        submitted.questionIds = questionIds;
        submitted.responseHashes = responseHashes;
        submitted.surveyId = surveyId;
        submitted.surveyResponseHash = surveyResponseHash;
        return {
          hash: `0x${'56'.repeat(32)}`,
          wait: async () => ({ blockNumber: 88 }),
        };
      },
    }),
  };
  const previewResponse = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatType: 'private', text: '/start' }),
  }), env);
  const preview = await previewResponse.json();
  const miniButton = preview.preview.response.replyMarkup.inline_keyboard
    .flat()
    .find((button) => button.text === 'Mini App');
  const launch = launchFromMiniButton(miniButton);
  const stateResponse = await worker.fetch(new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha`), env);
  const state = await stateResponse.json();

  const draftResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      launch,
      questionKey: state.questions[0].questionKey,
      answer: { value: 9, comments: 'Ready' },
      submit: true,
    }),
  }), env);
  const draft = await draftResponse.json();

  assert.equal(draftResponse.status, 200);
  assert.equal(draft.ok, true);
  assert.equal(draft.status, 'direct_submitted');
  assert.equal(draft.submitRequest.status, 'direct_submitted');
  assert.equal(draft.submitRequest.onChain.txHash, `0x${'56'.repeat(32)}`);
  assert.equal(draft.submitRequest.onChain.blockNumber, 88);
  assert.deepEqual(submitted.questionIds, [bytes32QuestionId]);
  assert.equal(submitted.signer, draft.submitRequest.onChain.accountAddress);
  assert.equal(calls.some((call) => call.url === 'https://session.example/'), true);
  assert.equal(calls.some((call) => call.url === 'https://session.example/storage/upload'), true);

  const storedSubmitRequests = Array.from(kv.store.entries())
    .filter(([key]) => key.startsWith('telegram:submit-request:'))
    .map(([, value]) => JSON.parse(value));
  assert.equal(storedSubmitRequests.length, 1);
  assert.equal(storedSubmitRequests[0].status, 'direct_submitted');
  assert.equal(storedSubmitRequests[0].canonicalApiRequest.status, 'executed_direct_onchain');
  assert.equal(JSON.stringify(storedSubmitRequests[0]).includes('unit-root'), false);
});

test('worker Mini App submit returns actionable worker auth failure details', async () => {
  const kv = new MemoryKv();
  const calls = [];
  const bytes32QuestionId = `0x${'24'.repeat(32)}`;
  const env = {
    BROADCAST_ENABLED: 'true',
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    DEFAULT_CHAIN_ID: '11155420',
    DEFAULT_RPC_URL: 'https://rpc.example',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true, telegramOnly: true,
        managedAccountSubmitAllowed: true,
        sessionWorkerUrl: 'https://session.example',
        surveysAddress: '0x1111111111111111111111111111111111111111',
      }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: bytes32QuestionId, questionType: 'rating', prompt: 'How strong is the signal?' },
    ]),
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_FETCH: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/auth/nonce')) {
        return new Response(JSON.stringify({ error: 'Untrusted worker login origin.' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw new Error(`unexpected session worker call ${url}`);
    },
  };
  const previewResponse = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatType: 'private', text: '/start' }),
  }), env);
  const preview = await previewResponse.json();
  const launch = launchFromMiniButton(preview.preview.response.replyMarkup.inline_keyboard
    .flat()
    .find((button) => button.text === 'Mini App'));
  const stateResponse = await worker.fetch(new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha`), env);
  const state = await stateResponse.json();

  const draftResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      launch,
      questionKey: state.questions[0].questionKey,
      answer: { value: 6 },
      submit: true,
    }),
  }), env);
  const draft = await draftResponse.json();

  assert.equal(draftResponse.status, 503);
  assert.equal(draft.ok, false);
  assert.equal(draft.error, 'worker_auth_failed');
  assert.equal(draft.reason, 'worker_auth_failed');
  assert.match(draft.message, /managed Telegram account/);
  assert.match(draft.message, /worker_nonce_failed: Untrusted worker login origin\./);
  assert.equal(calls[0].init.headers.Origin, 'https://bridge.example');
});

test('worker Mini App retries failed direct submit records instead of replaying auth failures', async () => {
  const kv = new MemoryKv();
  const calls = [];
  const bytes32QuestionId = `0x${'25'.repeat(32)}`;
  let authFails = true;
  let submitCount = 0;
  const env = {
    BROADCAST_ENABLED: 'true',
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    DEFAULT_CHAIN_ID: '11155420',
    DEFAULT_RPC_URL: 'https://rpc.example',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    AGENT_BRIDGE_DEPLOYMENT_ID: 'deploy-a',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{
        sessionSlug: 'alpha',
        sessionName: 'Alpha',
        telegramBridgeEnabled: true, telegramOnly: true,
        managedAccountSubmitAllowed: true,
        sessionWorkerUrl: 'https://session.example',
        surveysAddress: '0x1111111111111111111111111111111111111111',
      }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: bytes32QuestionId, questionType: 'rating', prompt: 'How strong is the signal?' },
    ]),
    AGENT_ACTION_KV: kv,
    AGENT_BRIDGE_FETCH: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (authFails && String(url).endsWith('/auth/nonce')) {
        return new Response(JSON.stringify({ error: 'temporarily missing nonce route' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      }
      return mockSessionWorkerFetch(calls, { txId: arweaveId(9) })(url, init);
    },
    AGENT_BRIDGE_CONTRACT_FACTORY: ({ signer }) => ({
      async submitResponses() {
        submitCount += 1;
        return {
          hash: `0x${'57'.repeat(32)}`,
          wait: async () => ({ blockNumber: 89, signer: signer.address }),
        };
      },
    }),
  };
  const previewResponse = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatType: 'private', text: '/start' }),
  }), env);
  const preview = await previewResponse.json();
  const launch = launchFromMiniButton(preview.preview.response.replyMarkup.inline_keyboard
    .flat()
    .find((button) => button.text === 'Mini App'));
  const stateResponse = await worker.fetch(new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha`), env);
  const state = await stateResponse.json();
  const submitBody = {
    launch,
    questionKey: state.questions[0].questionKey,
    answer: { value: 7 },
    submit: true,
  };

  const failedResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(submitBody),
  }), env);
  const failed = await failedResponse.json();
  assert.equal(failedResponse.status, 503);
  const failedSubmitRecords = Array.from(kv.store.entries())
    .filter(([key]) => key.startsWith('telegram:submit-request:'))
    .map(([key, value]) => ({ key, record: JSON.parse(value) }));
  assert.equal(failedSubmitRecords.length, 1);
  assert.equal(failedSubmitRecords[0].record.status, 'direct_submit_failed');
  assert.match(failed.message, /worker_nonce_failed: temporarily missing nonce route/);

  authFails = false;
  const retryResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(submitBody),
  }), env);
  const retry = await retryResponse.json();

  assert.equal(retryResponse.status, 200);
  assert.equal(retry.ok, true);
  assert.equal(retry.status, 'direct_submitted');
  assert.equal(retry.submitRequest.requestId, failedSubmitRecords[0].record.requestId);
  assert.equal(retry.submitRequest.replayed, false);
  assert.equal(retry.submitRequest.onChain.txHash, `0x${'57'.repeat(32)}`);
  assert.equal(submitCount, 1);
});

test('worker Mini App handoff keeps question-specific group launches opaque through private start', async () => {
  const kv = new MemoryKv();
  const env = {
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true, telegramGroupOpenAccess: true }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-first', questionType: 'rating', prompt: 'How strong is the first signal?' },
      { questionId: 'q-target', questionType: 'multichoice', prompt: 'Which lane should Alpha choose?', options: ['Build', 'Wait'], singleSelect: true },
    ]),
    AGENT_ACTION_KV: kv,
  };
  const groupPoseResponse = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatType: 'supergroup', text: '/q 2' }),
  }), env);
  const groupPose = await groupPoseResponse.json();
  const groupButtons = groupPose.preview.response.replyMarkup.inline_keyboard.flat();
  const groupMiniAppButton = groupButtons.find((button) => button.text === 'Open Mini App');
  const launch = launchFromMiniButton(groupMiniAppButton);

  assert.equal(groupPoseResponse.status, 200);
  assert.equal(groupPose.preview.screen, 'pose_question');
  assert.match(groupMiniAppButton.url, /^https:\/\/t\.me\/ce_demo_bot\?start=cecb_[a-z0-9]{10,48}$/);
  assert.match(launch, /^cecb_[a-z0-9]{10,48}$/);
  assert.equal(groupMiniAppButton.url.includes('q-target'), false);

  const privateStartResponse = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatType: 'private', text: `/start ${launch}` }),
  }), env);
  const privateStart = await privateStartResponse.json();
  const privateMiniAppButton = privateStart.preview.response.replyMarkup.inline_keyboard
    .flat()
    .find((button) => button.text === 'Open Mini App');

  assert.equal(privateStartResponse.status, 200);
  assert.equal(privateStart.preview.screen, 'private_start');
  assert.match(privateMiniAppButton.web_app.url, /^https:\/\/bridge\.example\/telegram\/mini-app\?launch=cecb_[a-z0-9]{10,48}$/);
  assert.equal(new URL(privateMiniAppButton.web_app.url).searchParams.get('launch'), launch);
  assert.equal(privateMiniAppButton.web_app.url.includes('q-target'), false);

  const stateResponse = await worker.fetch(new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}`), env);
  const state = await stateResponse.json();
  const target = state.questions.find((question) => question.prompt === 'Which lane should Alpha choose?');

  assert.equal(stateResponse.status, 200);
  assert.equal(state.ok, true);
  assert.equal(state.launch.launch, launch);
  assert.equal(target.activeFromLaunch, true);
  assert.equal(state.activeQuestionKey, target.questionKey);
  assert.match(target.questionKey, /^cecb_[a-z0-9]{10,48}$/);
  assert.equal(target.questionKey.includes('q-target'), false);
  assert.equal(state.launch.launch.includes('q-target'), false);
  assert.equal(JSON.stringify(state).includes('Which lane should Alpha choose?'), true);
});

test('worker Mini App state endpoint requires Telegram init data before creating question actions', async () => {
  const kv = new MemoryKv();
  const response = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/state?launch=cecb_missing'), {
    TELEGRAM_BOT_TOKEN: '123456:test-token',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-rating', questionType: 'rating', prompt: 'How strong is the signal?' },
    ]),
    AGENT_ACTION_KV: kv,
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'telegram_init_data_missing');
  assert.equal(body.questionCount, 0);
  assert.equal(kv.store.size, 0);
});

test('worker Mini App ignores preview auth bypass vars when a bot token is configured', async () => {
  const env = {
    TELEGRAM_BOT_TOKEN: '123456:test-token',
    AGENT_BRIDGE_MINI_APP_ALLOW_PREVIEW_AUTH: '1',
    AGENT_BRIDGE_MINI_APP_REQUIRE_INIT_DATA: 'false',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-rating', questionType: 'rating', prompt: 'How strong is the signal?' },
    ]),
    AGENT_ACTION_KV: new MemoryKv(),
  };
  const stateResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/state?launch=cecb_missing'), env);
  const state = await stateResponse.json();
  const draftResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ questionKey: 'cecb_0000000000', answer: { value: 1 } }),
  }), env);
  const draft = await draftResponse.json();

  assert.equal(stateResponse.status, 401);
  assert.equal(state.error, 'telegram_init_data_missing');
  assert.equal(draftResponse.status, 401);
  assert.equal(draft.error, 'telegram_init_data_missing');
  assert.equal(env.AGENT_ACTION_KV.store.size, 0);
});

test('worker Mini App state endpoint requires an opaque launch after Telegram init data is valid', async () => {
  const kv = new MemoryKv();
  const botToken = '123456:test-token';
  const initData = signInitData({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 42, username: 'participant' }),
  }, botToken);
  const response = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/state'), {
    TELEGRAM_BOT_TOKEN: botToken,
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-rating', questionType: 'rating', prompt: 'How strong is the signal?' },
    ]),
    AGENT_ACTION_KV: kv,
  });
  const missingHeaderBody = await response.json();

  assert.equal(response.status, 401);
  assert.equal(missingHeaderBody.error, 'telegram_init_data_missing');
  assert.equal(kv.store.size, 0);

  const validAuthResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/state', {
    headers: { 'x-telegram-init-data': initData },
  }), {
    TELEGRAM_BOT_TOKEN: botToken,
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-rating', questionType: 'rating', prompt: 'How strong is the signal?' },
    ]),
    AGENT_ACTION_KV: kv,
  });
  const body = await validAuthResponse.json();

  assert.equal(validAuthResponse.status, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'mini_app_launch_invalid');
  assert.equal(body.questionCount, 0);
  assert.equal(kv.store.size, 0);
});

test('worker Mini App draft endpoint requires a matching opaque launch in Telegram auth mode', async () => {
  const kv = new MemoryKv();
  const botToken = '123456:test-token';
  const initData = signInitData({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'mini-query-1',
    user: JSON.stringify({ id: 42, username: 'participant' }),
  }, botToken);
  const env = {
    TELEGRAM_BOT_TOKEN: botToken,
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true, telegramOnly: true, telegramGroupOpenAccess: true }],
    }),
    AGENT_BRIDGE_DEMO_QUESTIONS_JSON: JSON.stringify([
      { questionId: 'q-rating', questionType: 'rating', prompt: 'How strong is the signal?' },
      { questionId: 'q-other', questionType: 'rating', prompt: 'How strong is the backup?' },
    ]),
    AGENT_ACTION_KV: kv,
  };
  const previewResponse = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatType: 'private', text: '/start' }),
  }), env);
  const preview = await previewResponse.json();
  const launch = launchFromMiniButton(preview.preview.response.replyMarkup.inline_keyboard
    .flat()
    .find((button) => button.text === 'Mini App'));
  const stateResponse = await worker.fetch(new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}&sessions=alpha`, {
    headers: { 'x-telegram-init-data': initData },
  }), env);
  const state = await stateResponse.json();
  const questionKey = state.questions[0].questionKey;

  const missingLaunchResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
    body: JSON.stringify({
      questionKey,
      answer: { value: 8 },
      submit: true,
    }),
  }), env);
  const missingLaunch = await missingLaunchResponse.json();

  assert.equal(stateResponse.status, 200);
  assert.equal(missingLaunchResponse.status, 404);
  assert.equal(missingLaunch.error, 'mini_app_launch_invalid');

  const otherPreviewResponse = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatType: 'supergroup', text: '/q 2' }),
  }), env);
  const otherPreview = await otherPreviewResponse.json();
  const otherLaunch = launchFromMiniButton(otherPreview.preview.response.replyMarkup.inline_keyboard
    .flat()
    .find((button) => button.text === 'Open Mini App'));
  const mismatchResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
    body: JSON.stringify({
      launch: otherLaunch,
      questionKey,
      answer: { value: 8 },
      submit: true,
    }),
  }), env);
  const mismatch = await mismatchResponse.json();

  assert.equal(mismatchResponse.status, 403);
  assert.equal(mismatch.error, 'mini_app_launch_mismatch');

  const validResponse = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-init-data': initData },
    body: JSON.stringify({
      launch,
      questionKey,
      answer: { value: 8 },
      submit: true,
    }),
  }), env);
  const valid = await validResponse.json();
  const submitRecords = Array.from(kv.store.entries())
    .filter(([key]) => key.startsWith('telegram:submit-request:'));

  assert.equal(validResponse.status, 200);
  assert.equal(valid.ok, true);
  assert.equal(valid.status, 'submit_request_created');
  assert.equal(submitRecords.length, 1);
  assert.equal(JSON.parse(submitRecords[0][1]).canonicalApiRequest.body.questionId, 'q-rating');
});

test('worker Mini App draft endpoint requires Telegram init data when a bot token is configured', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/telegram/mini-app/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ questionKey: 'cecb_0000000000', answer: { value: 1 } }),
  }), {
    TELEGRAM_BOT_TOKEN: '123456:test-token',
    AGENT_ACTION_KV: new MemoryKv(),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'telegram_init_data_missing');
});

test('worker Telegram webhook requires enable flag, bot token, and secret token', async () => {
  const telegramCalls = [];
  const telegramFetch = async (...args) => {
    telegramCalls.push(args);
    return new Response(JSON.stringify({ ok: true, result: { message_id: 90 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const request = new Request('https://bridge.example/telegram/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': 'webhook-secret',
    },
    body: JSON.stringify({
      update_id: 101,
      message: {
        message_id: 11,
        text: '/start',
        chat: { id: 55, type: 'private' },
        from: { id: 77, username: 'demo_user' },
      },
    }),
  });

  const disabled = await worker.fetch(request.clone(), {
    TELEGRAM_BRIDGE_ENABLED: 'false',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
  });
  assert.equal(disabled.status, 403);

  const denied = await worker.fetch(request.clone(), {
    TELEGRAM_BRIDGE_ENABLED: 'true',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_WEBHOOK_SECRET: 'different-secret',
  });
  assert.equal(denied.status, 401);

  const accepted = await worker.fetch(request, {
    TELEGRAM_BRIDGE_ENABLED: 'true',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    TELEGRAM_FETCH: telegramFetch,
  });
  const body = await accepted.json();
  assert.equal(accepted.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.transport, 'telegram_webhook');
  assert.equal(body.command, '/start');
  assert.equal(body.screen, 'setup_welcome');
  assert.equal(body.telegram.ok, true);
  const telegramMethods = telegramCalls.map((call) => String(call[0]).split('/').pop());
  assert.equal(telegramMethods.includes('setMessageReaction'), true);
  assert.equal(telegramMethods.includes('sendChatAction'), true);
  assert.equal(telegramMethods.includes('sendMessage'), true);
  assert.equal(JSON.stringify(body).includes('bot-token'), false);
  assert.equal(JSON.stringify(body).includes('webhook-secret'), false);
});

test('worker Telegram webhook defers Telegram sends when waitUntil is available', async () => {
  const telegramCalls = [];
  const request = telegramWebhookRequest({
    update_id: 103,
    message: {
      message_id: 13,
      text: '/start',
      chat: { id: 55, type: 'private' },
      from: { id: 77, username: 'demo_user' },
    },
  });
  const waited = [];

  const response = await withTimeout(worker.fetch(request, {
    TELEGRAM_BRIDGE_ENABLED: 'true',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    TELEGRAM_FETCH: async (...args) => {
      telegramCalls.push(args);
      return new Promise(() => {});
    },
  }, {
    waitUntil: (promise) => waited.push(promise),
  }), 100, 'webhook waited on Telegram send');
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.telegram.ok, true);
  assert.equal(body.telegram.queued, true);
  assert.equal(waited.length, 2);
  const telegramMethods = telegramCalls.map((call) => String(call[0]).split('/').pop());
  assert.equal(telegramMethods.includes('setMessageReaction'), true);
  assert.equal(telegramMethods.includes('sendChatAction'), true);
  assert.equal(telegramMethods.includes('sendMessage'), true);
});

test('worker Telegram webhook mocked live-bot smoke covers core commands with safe opaque payloads', async () => {
  const kv = new MemoryKv();
  const telegramCalls = [];
  const telegramFetch = async (...args) => {
    telegramCalls.push(args);
    return new Response(JSON.stringify({ ok: true, result: { message_id: 900 + telegramCalls.length } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const env = {
    TELEGRAM_BRIDGE_ENABLED: 'true',
    TELEGRAM_BOT_TOKEN: '123456:test-token',
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
    TELEGRAM_FETCH: telegramFetch,
    DEFAULT_CHAIN_ID: '11155420',
    DEFAULT_RPC_URL: 'https://rpc.example.test',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
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
        sessionSlug: 'alpha',
        questionId: 'q-readiness',
        questionType: 'freeform',
        prompt: 'What should Alpha decide next?',
      },
      {
        sessionSlug: 'alpha',
        questionId: 'q-locked',
        questionType: 'freeform',
        prompt: 'Private prompt must not leak',
        visibility: 'sbt_gated',
      },
      {
        sessionSlug: 'demo',
        questionId: 'q-demo',
        questionType: 'rating',
        prompt: 'How ready is Demo?',
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
    AGENT_ACTION_KV: kv,
  };
  const commands = [
    { text: '/start', chatType: 'private', chatId: 42, userId: 42, username: 'participant' },
    { text: '/join alpha', chatType: 'supergroup' },
    { text: '/sessions', chatType: 'supergroup' },
    { text: '/questions', chatType: 'supergroup' },
    { text: '/q 1', chatType: 'supergroup' },
    { text: '/attachments', chatType: 'supergroup' },
    { text: '/docs', chatType: 'supergroup' },
    { text: '/me', chatType: 'private', chatId: 42, userId: 42, username: 'participant' },
  ];
  const bodies = [];
  for (const [index, command] of commands.entries()) {
    const response = await worker.fetch(telegramWebhookRequest(telegramMessageUpdate(command.text, {
      updateId: 2000 + index,
      messageId: 100 + index,
      chatId: command.chatId || -100123,
      chatType: command.chatType,
      userId: command.userId || 42,
      username: command.username || 'host',
    })), env);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.command, command.text.split(/\s+/)[0]);
    bodies.push(body);
  }

  assert.equal(telegramCalls.length, commands.length * 3);
  assert.equal(telegramCalls.filter((call) => String(call[0]).endsWith('/sendMessage')).length, commands.length);
  assert.equal(telegramCalls.filter((call) => String(call[0]).endsWith('/sendChatAction')).length, commands.length);
  assert.equal(telegramCalls.filter((call) => String(call[0]).endsWith('/setMessageReaction')).length, commands.length);
  assert.deepEqual(bodies.map((body) => body.screen), [
    'setup_welcome',
    'group_session_card',
    'group_session_card',
    'question_list',
    'pose_question',
    'doc_library',
    'doc_library',
    'my_account',
  ]);

  const messageCalls = telegramCalls.filter((call) => String(call[0]).endsWith('/sendMessage'));
  const payloads = messageCalls.map(parseTelegramCallPayload);
  const byCommand = Object.fromEntries(commands.map((command, index) => [command.text, payloads[index]]));
  for (const [index, payload] of payloads.entries()) {
    assert.equal(messageCalls[index][0], 'https://api.telegram.org/bot123456:test-token/sendMessage');
    assertOpaqueTelegramButtons(flattenButtons(payload.reply_markup));
    assert.equal(JSON.stringify(payload.reply_markup || {}).includes('q-readiness'), false);
    assert.equal(JSON.stringify(payload.reply_markup || {}).includes('alpha'), false);
  }

  assert.match(byCommand['/start'].text, /Context Engine/);
  assert.match(byCommand['/join alpha'].text, /Session: Alpha Session/);
  assert.equal(byCommand['/join alpha'].text.includes('/attachments'), false);
  assert.match(byCommand['/sessions'].text, /Sessions \(2\/2\)/);
  assert.match(byCommand['/questions'].text, /^Questions \(2\/2\)/);
  assert.match(byCommand['/questions'].text, /1\. What should Alpha decide next\?/);
  assert.equal(byCommand['/questions'].text.includes('Choose a question'), false);
  assert.equal(byCommand['/questions'].text.includes('q-readiness'), false);
  assert.equal(byCommand['/questions'].text.includes('q-locked'), false);
  assert.equal(byCommand['/q 1'].text.startsWith('Question for alpha:'), false);
  assert.match(byCommand['/q 1'].text, /What should Alpha decide next/);
  assert.match(byCommand['/attachments'].text, /Attachments for alpha:/);
  assert.match(byCommand['/docs'].text, /Attachments for alpha:/);
  assert.match(byCommand['/me'].text, /Account/);
  assert.match(byCommand['/me'].text, /Address: 0x[0-9a-f]{4}\.\.\.[0-9a-f]{4}/i);
  assert.doesNotMatch(byCommand['/me'].text, /Chain:/);
  assert.equal(byCommand['/me'].parse_mode, undefined);

  for (const command of ['/join alpha', '/sessions', '/questions', '/q 1', '/attachments', '/docs']) {
    assertGroupSafeText(byCommand[command].text);
  }
  assert.equal(JSON.stringify(payloads).includes('unit-root'), false);
  assert.equal(JSON.stringify(payloads).includes('r2://private'), false);
  assert.equal(JSON.stringify(payloads).includes('Private prompt must not leak'), false);

  const joinButtons = flattenButtons(byCommand['/join alpha'].reply_markup);
  const joinStart = joinButtons.find((button) => button.text === 'Join Session');
  const questionButtons = flattenButtons(byCommand['/questions'].reply_markup);

  assert.match(joinStart.url, /^https:\/\/t\.me\/ce_demo_bot\?start=cetg_[a-z0-9]{10,48}$/);
  assert.deepEqual(
    questionButtons.filter((button) => button.text !== 'Back to Start').map((button) => button.text),
    ['Pose 1', 'Pose 2']
  );
  assert.equal(questionButtons.some((button) => button.text === 'Back to Start'), true);
  assert.equal(questionButtons.some((button) => button.text === 'Open Mini App'), false);
  assert.equal(Array.from(kv.store.keys()).some((key) => key.startsWith('telegram:group-session:')), true);
  assert.equal(Array.from(kv.store.keys()).filter((key) => key.startsWith('telegram:action:')).length >= 12, true);
});

test('worker Telegram webhook handles command send errors without leaking token or payload', async () => {
  const request = new Request('https://bridge.example/telegram/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': 'webhook-secret',
    },
    body: JSON.stringify({
      update_id: 102,
      message: {
        text: '/questions',
        chat: { id: -10055, type: 'supergroup' },
        from: { id: 77, username: 'demo_user' },
      },
    }),
  });

  const response = await worker.fetch(request, {
    TELEGRAM_BRIDGE_ENABLED: 'true',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
    DEMO_SIGNER_ROOT_SECRET: 'unit-root',
    TELEGRAM_FETCH: async () => new Response(JSON.stringify({
      ok: false,
      error_code: 400,
      description: 'Bad Request for bot-token',
    }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, false);
  assert.equal(body.telegram.ok, false);
  assert.equal(JSON.stringify(body).includes('bot-token'), false);
  assert.equal(JSON.stringify(body).includes('Bad Request'), true);
});
