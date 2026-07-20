import { AGENT_BRIDGE_WORKER_VERSION } from './constants.mjs';
import { directSubmitFeatureEnabled } from './onChainResponses.mjs';
import { runMockTelegramDemoFlow } from './transportMock.mjs';
import { handleTelegramAgentHandoffRequest } from './telegramAgentHandoff.mjs';
import { buildTelegramCommandResponse, handleTelegramWebhookUpdate, readTelegramResultPhoto } from './telegramCommands.mjs';
import { handleTelegramMiniAppRequest } from './telegramMiniApp.mjs';
import { processTelegramSubmitQueueBatch } from './telegramSubmitQueue.mjs';

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  });
}

function html(text, init = {}) {
  return new Response(text, {
    ...init,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      ...(init.headers || {}),
    },
  });
}

function safeString(value) {
  return String(value || '').trim();
}

function envFlagEnabled(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(safeString(value).toLowerCase());
}

function telegramPreviewEnabled(env = {}) {
  return envFlagEnabled(env.AGENT_BRIDGE_ENABLE_TELEGRAM_PREVIEW);
}

function buildPreviewUpdate(body = {}) {
  const chatType = safeString(body.chatType || 'supergroup') || 'supergroup';
  const chatId = chatType === 'private' ? 42 : -100123;
  const from = { id: 42, username: 'preview_user' };
  if (body.callbackData) {
    return {
      update_id: Date.now(),
      callback_query: {
        id: `preview-${Date.now()}`,
        data: safeString(body.callbackData),
        from,
        message: {
          message_id: Number(body.messageId || 1) || 1,
          chat: { id: chatId, type: chatType, title: 'Preview Lobby' },
        },
      },
    };
  }
  return {
    update_id: Date.now(),
    message: {
      message_id: Number(body.messageId || 1) || 1,
      text: safeString(body.text || '/start'),
      chat: { id: chatId, type: chatType, title: chatType === 'private' ? undefined : 'Preview Lobby' },
      from,
    },
  };
}

function telegramPreviewHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CE Telegram Preview</title>
  <style>
    :root { color-scheme: light; --ink: #17202a; --muted: #5f6b7a; --line: #d6dee8; --panel: #f7f9fc; --accent: #1769e0; --accent-ink: #ffffff; --danger: #b42318; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: #ffffff; }
    main { min-height: 100vh; display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); }
    aside { border-right: 1px solid var(--line); padding: 18px; background: var(--panel); }
    section { padding: 18px; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 14px; }
    h1 { margin: 0 0 12px; font-size: 20px; font-weight: 700; }
    label { display: block; margin: 12px 0 6px; color: var(--muted); font-size: 13px; }
    select, input { width: 100%; min-height: 38px; border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; font: inherit; background: #fff; color: var(--ink); }
    .commands { display: grid; gap: 8px; margin-top: 12px; }
    button { min-height: 36px; border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; font: inherit; color: var(--ink); background: #fff; cursor: pointer; text-align: left; }
    button:hover { border-color: var(--accent); }
    button.primary { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); text-align: center; }
    .toolbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; }
    .phone { width: min(100%, 520px); min-height: 520px; border: 1px solid var(--line); border-radius: 8px; background: #eef3f8; padding: 16px; overflow: auto; }
    .bubble { max-width: 92%; background: #fff; border: 1px solid #dce5ef; border-radius: 8px; padding: 12px; white-space: pre-wrap; box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08); }
    .keyboard { display: grid; gap: 8px; margin-top: 12px; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; }
    .row button { text-align: center; min-width: 120px; background: #e8f1ff; border-color: #bfd6ff; }
    .meta { color: var(--muted); font-size: 13px; margin-bottom: 8px; }
    .error { color: var(--danger); white-space: pre-wrap; }
    @media (max-width: 760px) { main { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid var(--line); } }
  </style>
</head>
<body>
  <main>
    <aside>
      <h1>CE Telegram Preview</h1>
      <label for="chatType">Lane</label>
      <select id="chatType">
        <option value="supergroup">Group lobby</option>
        <option value="private">Private account</option>
      </select>
      <div class="commands">
        <button data-command="/start">/start</button>
        <button data-command="/actions">/actions</button>
        <button data-command="/settings">/settings</button>
        <button data-command="/join alpha">/join alpha</button>
        <button data-command="/sessions">/sessions</button>
        <button data-command="/questions">/questions</button>
        <button data-command="/add_question What should we decide next?">/add_question</button>
        <button data-command="/pose_question">/pose_question</button>
        <button data-command="/q 1">/q 1</button>
        <button data-command="/me">/me</button>
      </div>
    </aside>
    <section>
      <div class="toolbar">
        <div>
          <label for="command">Command</label>
          <input id="command" value="/join alpha" autocomplete="off">
        </div>
        <button id="send" class="primary">Send</button>
      </div>
      <div>
        <div id="meta" class="meta"></div>
        <div class="phone">
          <div id="message" class="bubble">Run a command to preview the Telegram response.</div>
          <div id="keyboard" class="keyboard"></div>
          <pre id="error" class="error"></pre>
        </div>
      </div>
    </section>
  </main>
  <script>
    const command = document.getElementById('command');
    const chatType = document.getElementById('chatType');
    const message = document.getElementById('message');
    const keyboard = document.getElementById('keyboard');
    const meta = document.getElementById('meta');
    const error = document.getElementById('error');
    let messageId = 1;
    async function postPreview(payload) {
      error.textContent = '';
      const response = await fetch('/mock/telegram/preview-update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chatType: chatType.value, messageId, ...payload }),
      });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        error.textContent = JSON.stringify(body, null, 2);
        return;
      }
      const result = body.preview || {};
      const reply = result.response || {};
      meta.textContent = [result.command, result.screen].filter(Boolean).join(' | ');
      message.textContent = reply.text || '';
      keyboard.innerHTML = '';
      const rows = reply.replyMarkup?.inline_keyboard || [];
      rows.forEach((row) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'row';
        row.forEach((button) => {
          const btn = document.createElement('button');
          btn.textContent = button.text || 'Action';
          if (button.callback_data) {
            btn.onclick = () => postPreview({ callbackData: button.callback_data });
          } else if (button.url) {
            btn.onclick = () => window.open(button.url, '_blank', 'noopener,noreferrer');
          } else if (button.web_app?.url) {
            btn.onclick = () => window.open(button.web_app.url, '_blank', 'noopener,noreferrer');
          } else {
            btn.disabled = true;
          }
          rowEl.appendChild(btn);
        });
        keyboard.appendChild(rowEl);
      });
      messageId += 1;
    }
    document.getElementById('send').onclick = () => postPreview({ text: command.value });
    document.querySelectorAll('[data-command]').forEach((button) => {
      button.onclick = () => { command.value = button.dataset.command; postPreview({ text: button.dataset.command }); };
    });
  </script>
</body>
</html>`;
}

export default {
  async queue(batch, env = {}) {
    await processTelegramSubmitQueueBatch(batch, env);
  },

  async fetch(request, env = {}, ctx = {}) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({
        ok: true,
        worker: 'agentBridgeWorker',
        version: AGENT_BRIDGE_WORKER_VERSION,
        privateRelease: true,
        broadcastEnabled: directSubmitFeatureEnabled(env),
      });
    }
    if (url.pathname === '/session-wrapped' && (request.method === 'GET' || request.method === 'HEAD')) {
      return handleTelegramAgentHandoffRequest({
        request,
        env,
        waitUntil: typeof ctx.waitUntil === 'function' ? (promise) => ctx.waitUntil(promise) : null,
      });
    }
    if (url.pathname === '/mock/telegram/demo-flow' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return json(await runMockTelegramDemoFlow({
        ...body,
        deploymentId: body.deploymentId || env.AGENT_BRIDGE_DEPLOYMENT_ID || 'local-demo',
      }));
    }
    if (url.pathname === '/mock/telegram/preview' && request.method === 'GET') {
      if (!telegramPreviewEnabled(env)) {
        return json({ ok: false, error: 'telegram_preview_disabled' }, { status: 404 });
      }
      return html(telegramPreviewHtml());
    }
    if (url.pathname === '/mock/telegram/preview-update' && request.method === 'POST') {
      if (!telegramPreviewEnabled(env)) {
        return json({ ok: false, error: 'telegram_preview_disabled' }, { status: 404 });
      }
      const body = await request.json().catch(() => ({}));
      const preview = await buildTelegramCommandResponse({
        update: buildPreviewUpdate(body),
        env,
        waitUntil: typeof ctx.waitUntil === 'function' ? (promise) => ctx.waitUntil(promise) : null,
      });
      return json({
        ok: preview.ok === true,
        preview: {
          ok: preview.ok === true,
          command: preview.command || null,
          screen: preview.screen || null,
          reason: preview.reason || null,
          response: preview.response || null,
        },
      }, { status: preview.ok === true ? 200 : 400 });
    }
    if (url.pathname.startsWith('/telegram/result-photo/') && request.method === 'GET') {
      const id = safeString(url.pathname.split('/').pop());
      const photo = await readTelegramResultPhoto({ env, id });
      if (!photo.ok) {
        return json({ ok: false, error: photo.reason || 'result_photo_not_found' }, { status: photo.status || 404 });
      }
      return new Response(photo.bytes, {
        status: 200,
        headers: {
          'content-type': photo.contentType,
          'cache-control': 'public, max-age=600',
          'content-disposition': `inline; filename="${photo.filename.replace(/[^A-Za-z0-9_.-]/g, '_')}"`,
        },
      });
    }
    if (url.pathname === '/telegram/mini-app' || url.pathname.startsWith('/telegram/mini-app/')) {
      return handleTelegramMiniAppRequest({
        request,
        env,
        waitUntil: typeof ctx.waitUntil === 'function' ? (promise) => ctx.waitUntil(promise) : null,
      });
    }
    if (url.pathname.startsWith('/api/agent/') || url.pathname.startsWith('/telegram/agent/api/')) {
      return handleTelegramAgentHandoffRequest({
        request,
        env,
        waitUntil: typeof ctx.waitUntil === 'function' ? (promise) => ctx.waitUntil(promise) : null,
      });
    }
    if (url.pathname === '/telegram/webhook' && request.method === 'POST') {
      if (String(env.TELEGRAM_BRIDGE_ENABLED || '').trim().toLowerCase() !== 'true') {
        return json({ ok: false, error: 'telegram_bridge_disabled' }, { status: 403 });
      }
      if (!String(env.TELEGRAM_BOT_TOKEN || '').trim()) {
        return json({ ok: false, error: 'telegram_bot_token_missing' }, { status: 503 });
      }
      const expectedSecret = String(env.TELEGRAM_WEBHOOK_SECRET || '').trim();
      const suppliedSecret = String(request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '').trim();
      if (!expectedSecret || suppliedSecret !== expectedSecret) {
        return json({ ok: false, error: 'telegram_webhook_secret_invalid' }, { status: 401 });
      }
      const update = await request.json().catch(() => null);
      if (!update || typeof update !== 'object') {
        return json({ ok: false, error: 'invalid_telegram_update' }, { status: 400 });
      }
      const waitUntil = typeof ctx.waitUntil === 'function' ? (promise) => ctx.waitUntil(promise) : null;
      const handled = await handleTelegramWebhookUpdate({
        update,
        env,
        fetchImpl: env.TELEGRAM_FETCH || globalThis.fetch,
        waitUntil,
        deferDispatch: !!waitUntil,
      });
      if (!handled.ok && !handled.response) {
        return json({ ok: false, error: handled.reason || 'invalid_telegram_update' }, { status: 400 });
      }
      return json({
        ok: handled.telegram?.ok === true,
        transport: 'telegram_webhook',
        updateId: handled.updateId,
        command: handled.command || null,
        screen: handled.screen || null,
        telegram: handled.telegram || null,
      });
    }
    return json({ ok: false, error: 'not_found' }, { status: 404 });
  },
};
