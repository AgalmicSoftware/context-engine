import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
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

test('worker health endpoint marks private bridge skeleton and broadcast-disabled status', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/health'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.worker, 'agentBridgeWorker');
  assert.equal(body.privateRelease, true);
  assert.equal(body.broadcastEnabled, false);
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
});

test('worker serves Telegram Mini App shell', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/telegram/mini-app'));
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(text, /CE Mini App/);
  assert.match(text, /telegram-web-app\.js/);
  assert.match(text, /telegram\/mini-app\/api\/state/);
  assert.equal(text.includes('button.innerHTML'), false);
  assert.match(text, /title\.textContent = question\.title/);
});

test('worker preview update is disabled unless explicitly enabled and does not mutate KV', async () => {
  const kv = new MemoryKv();
  const response = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chatType: 'supergroup',
      text: '/ce_pose_question',
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
      text: '/ce_pose_question',
    }),
  }), {
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true }],
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
  assert.match(body.preview.response.text, /Choose a question to pose to the group/);
  assert.equal(JSON.stringify(body).includes('TELEGRAM_BOT_TOKEN'), false);
});

test('worker Mini App state and draft endpoints use opaque question actions', async () => {
  const kv = new MemoryKv();
  const bytes32QuestionId = `0x${'12'.repeat(32)}`;
  const env = {
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
    AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true }],
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
    body: JSON.stringify({ chatType: 'private', text: '/ce_questions alpha' }),
  }), env);
  const preview = await previewResponse.json();
  const miniButton = preview.preview.response.replyMarkup.inline_keyboard
    .flat()
    .find((button) => button.text === 'Open Mini App');
  const launch = launchFromMiniButton(miniButton);

  const stateResponse = await worker.fetch(new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}`), env);
  const state = await stateResponse.json();

  assert.equal(stateResponse.status, 200);
  assert.equal(state.ok, true);
  assert.equal(state.session.sessionSlug, 'alpha');
  assert.equal(state.pageSize, 5);
  assert.equal(state.questionCount, 6);
  assert.equal(JSON.stringify(state).includes(bytes32QuestionId), false);
  assert.match(state.questions[0].idShort, /^0x12121212\.\.\.121212$/);
  assert.match(state.questions[0].questionKey, /^cecb_[a-z0-9]{10,48}$/);

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
    AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW: 'true',
    AGENT_BRIDGE_PUBLIC_URL: 'https://bridge.example',
    AGENT_BRIDGE_QUESTION_SOURCE: 'fixture',
    AGENT_BRIDGE_SESSION_POLICY_JSON: JSON.stringify({
      defaultSessionSlug: 'alpha',
      sessions: [{ sessionSlug: 'alpha', sessionName: 'Alpha', telegramBridgeEnabled: true }],
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
    body: JSON.stringify({ chatType: 'supergroup', text: '/ce_questions alpha' }),
  }), env);
  const preview = await previewResponse.json();
  const launch = launchFromMiniButton(preview.preview.response.replyMarkup.inline_keyboard
    .flat()
    .find((button) => button.text === 'Open Mini App'));
  const stateResponse = await worker.fetch(new Request(`https://bridge.example/telegram/mini-app/api/state?launch=${launch}`, {
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
    TELEGRAM_FETCH: telegramFetch,
  });
  const body = await accepted.json();
  assert.equal(accepted.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.transport, 'telegram_webhook');
  assert.equal(body.command, '/start');
  assert.equal(body.screen, 'setup_welcome');
  assert.equal(body.telegram.ok, true);
  assert.equal(telegramCalls.length, 1);
  assert.equal(String(telegramCalls[0][0]).includes('/sendMessage'), true);
  assert.equal(JSON.stringify(body).includes('bot-token'), false);
  assert.equal(JSON.stringify(body).includes('webhook-secret'), false);
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
        text: '/ce_questions',
        chat: { id: -10055, type: 'supergroup' },
        from: { id: 77, username: 'demo_user' },
      },
    }),
  });

  const response = await worker.fetch(request, {
    TELEGRAM_BRIDGE_ENABLED: 'true',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
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
