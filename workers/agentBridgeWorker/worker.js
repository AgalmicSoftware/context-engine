import { AGENT_BRIDGE_WORKER_VERSION, AGENT_SESSION_WRAPPED_PROTOCOL_VERSION } from './constants.mjs';
import { directSubmitFeatureEnabled } from './onChainResponses.mjs';
import { handleAgentHttpRequest } from './agentHttp.mjs';
import { processAgentSubmitQueueBatch } from './agentSubmitQueue.mjs';
import { resolvePinnedSessionWorkerAuthority } from './sessionWorkerAuthority.mjs';

export { AgentInviteRedemptionCoordinator } from './agentInviteRedemptionCoordinator.mjs';

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export default {
  async queue(batch, env = {}) {
    await processAgentSubmitQueueBatch(batch, env);
  },

  async fetch(request, env = {}, ctx = {}) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      const authority = resolvePinnedSessionWorkerAuthority({
        policyJson: env.AGENT_BRIDGE_SESSION_POLICY_JSON,
        sessionWorkerOrigin: env.CE_SESSION_WORKER_BASE_URL,
      });
      return json({
        ok: true,
        worker: 'agentBridgeWorker',
        version: AGENT_BRIDGE_WORKER_VERSION,
        privateRelease: true,
        broadcastEnabled: directSubmitFeatureEnabled(env),
        protocolVersion: AGENT_SESSION_WRAPPED_PROTOCOL_VERSION,
        agentSessionWrappedConfigured: authority.ok,
        agentSessionWrappedReady: authority.ok && authority.accessEnabled,
        dedicatedSession: authority.ok ? {
          accessEnabled: authority.accessEnabled,
          sessionSlug: authority.sessionSlug,
          sessionWorkerOrigin: authority.sessionWorkerOrigin,
        } : null,
      });
    }
    if ((url.pathname === '/session-wrapped' && ['GET', 'HEAD'].includes(request.method)) ||
        url.pathname.startsWith('/api/agent/') || url.pathname.startsWith('/telegram/agent/api/')) {
      return handleAgentHttpRequest({
        request, env,
        waitUntil: typeof ctx.waitUntil === 'function' ? promise => ctx.waitUntil(promise) : null,
      });
    }
    return json({ ok: false, error: 'not_found' }, 404);
  },
};
