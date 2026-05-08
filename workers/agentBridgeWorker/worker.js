import { AGENT_BRIDGE_WORKER_VERSION } from './constants.mjs';
export { ManagedDemoSignerDurableObject } from './durableObjectSigner.mjs';
import { runMockTelegramDemoFlow } from './transportMock.mjs';
import { normalizeTelegramMockUpdate } from './telegramUpdates.mjs';

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
  });
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({
        ok: true,
        worker: 'agentBridgeWorker',
        version: AGENT_BRIDGE_WORKER_VERSION,
        privateRelease: true,
        broadcastEnabled: false,
      });
    }
    if (url.pathname === '/mock/telegram/demo-flow' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      return json(await runMockTelegramDemoFlow({
        ...body,
        deploymentId: body.deploymentId || env.AGENT_BRIDGE_DEPLOYMENT_ID || 'local-demo',
      }));
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
      const normalized = normalizeTelegramMockUpdate(update);
      return json({
        ok: true,
        transport: 'telegram_webhook',
        updateId: normalized.updateId,
        lane: normalized.lane,
        kind: normalized.kind,
      });
    }
    return json({ ok: false, error: 'not_found' }, { status: 404 });
  },
};
