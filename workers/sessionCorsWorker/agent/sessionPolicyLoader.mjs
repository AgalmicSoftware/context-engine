import { normalizeSessionPolicy } from './sessionPolicy.mjs';
import { authorityError } from './authority.mjs';


export async function loadSessionPolicy(env = {}) {
  const ctx = env.AGENT_CONTEXT;
  if (!ctx?.config) throw authorityError('agent_session_authority_unavailable', 503);
  const config = ctx.config;
  // There is one authority: persisted Session Worker config. Auxiliary records
  // cannot widen gates, change the active session or restore an old Bridge policy.
  return normalizeSessionPolicy({ ...config.agentHttp, defaultSessionSlug: ctx.slug,
    sessions: [{ ...config, ...config.agentHttp, sessionSlug: ctx.slug, sessionIdHex: ctx.sessionId,
      sessionModeProfile: config.sessionModeProfile, sessionWorkerUrl: ctx.origin, sessionWorkerSlug: ctx.slug,
      resultsExposure: config.sessionModeProfile?.results?.exposure || config.resultsExposure,
      chainId: config.networkChainId || config.chainId,
      surveysAddress: config.contracts?.surveys?.address || config.contracts?.surveysAddress }],
  }, { now: new Date(ctx.now()).toISOString() });
}


// Removed default-session handlers never reach these exports; retained callers
// must use their already resolved canonical session instead of an override.
