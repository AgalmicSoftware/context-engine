import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';

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

test('worker preview route renders an interactive mock Telegram surface', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview'));
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(text, /CE Telegram Preview/);
  assert.match(text, /mock\/telegram\/preview-update/);
});

test('worker preview update exercises command builder without Telegram network calls', async () => {
  const response = await worker.fetch(new Request('https://bridge.example/mock/telegram/preview-update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chatType: 'supergroup',
      text: '/ce_pose_question',
    }),
  }), {
    TELEGRAM_BOT_USERNAME: 'ce_demo_bot',
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
