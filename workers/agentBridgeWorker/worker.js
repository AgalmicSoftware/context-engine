import { AGENT_BRIDGE_WORKER_VERSION } from './constants.mjs';
export { ManagedDemoSignerDurableObject } from './durableObjectSigner.mjs';
import { runMockTelegramDemoFlow } from './transportMock.mjs';

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
    return json({ ok: false, error: 'not_found' }, { status: 404 });
  },
};
