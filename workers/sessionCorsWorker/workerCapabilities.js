import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';
import { buildAgentHttpCapability } from './agent/capability.mjs';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import { SESSION_CONFIG_MIGRATION_REQUIRED_REASON } from './sessionConfigSecretsStore.js';
import { getDefaultWorkerSessionSlug, validateInboundWorkerSessionSlug } from './sessionSlugResolution.js';
import { getStorageIndexBinding, resolvePayloadAccessControl } from './storageRouteExecution.js';
import { GPT_LIVE_1_1_FEATURE } from '../../shared/realtimeInterviewConfig.mjs';

export const FEATURES = Object.freeze([
  'agent_http_v1',
  // limits.aiPerWalletPerDay is honoured; older Workers store it and ignore it.
  'ai_daily_limit_v1',
  // The personal analysis card's picture and saved card; they answer only where analysisCardEnabled is true.
  'analysis_card_v1',
  // Context sources carry cards: /storage/context takes set-card and make-card, and lists show each card.
  'context_cards_v1',
  // A context link may be locked to some of the session's groups, as a file may.
  'context_link_groups_v1',
  'context_sources_v1',
  'draft_text_v1',
  'envelope_export_identity_v1',
  // interviewMode.dataNote, the session's note on where research data goes; older Workers reject the key.
  'interview_data_note_v1',
  // interviewMode.realtimeModel may be gpt-live-1.1; older Workers refuse it on save.
  GPT_LIVE_1_1_FEATURE,
  'participant_context_links_v1',
  'participant_context_v1',
  'recovery_key_export',
  'response_upload_receipts',
  'results_analysis_retry_v1',
  // Chats with the Session Agent can be stored, read by admins and cleared.
  'session_agent_chats',
  // People who aren't signed in may ask the Session Agent, where its setting allows.
  'session_agent_signed_out',
  'session_backup_v1',
  'session_feedback',
  // GET /names, GET /names/me, POST /names/set and POST /admin/names/clear; namesEnabled turns them off.
  'session_names_v1',
  'storage_read_batch_v1',
  'upload_authority_stamps',
  'worker_groups',
]);
// The Session Agent can answer on Cloudflare's models: only a Worker with the AI binding.
export const WORKERS_AI_FEATURE = 'workers_ai_v1';

/* global __CE_RELEASE_VERSION__ */
// scripts/worker-bundle.mjs sets this from package.json; unbundled source reports null.
export const workerRelease = () => (
  typeof __CE_RELEASE_VERSION__ === 'string' && __CE_RELEASE_VERSION__ ? __CE_RELEASE_VERSION__ : null
);

export const dispatchWorkerCapabilities = async ({ request, env = {}, headers = {} }) => {
  const body = {
    type: 'ce_worker_capabilities', version: 1, apiVersion: 1,
    bundle: env.CE_BUNDLE_SHA256 || null, release: workerRelease(), features: FEATURES.filter((feature) => feature !== 'recovery_key_export'),
  };
  const ai = typeof env.AI?.run === 'function' ? [WORKERS_AI_FEATURE] : [];
  body.features = [...body.features, ...ai];
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Cache-Control', 'public, max-age=30');
  const url = new URL(request.url);
  if (url.searchParams.has('slug')) {
    const validated = validateInboundWorkerSessionSlug(url.searchParams.get('slug'));
    if (!validated.ok) return Response.json({ error: validated.error }, { status: 400, headers: responseHeaders });
    const pinnedSlug = getDefaultWorkerSessionSlug(env);
    if (pinnedSlug && pinnedSlug === validated.slug) body.features = [...FEATURES, ...ai];
    const bound = !!env.CE_SESSION_COORDINATOR?.idFromName && !!env.CE_SESSION_COORDINATOR?.get;
    const current = bound
      ? await callSessionConfigCoordinator({ env, slug: validated.slug, path: 'current' })
      : null;
    const migration = current?.body?.reason === SESSION_CONFIG_MIGRATION_REQUIRED_REASON;
    const validCurrent = current?.ok && Number.isSafeInteger(current.body.revision) &&
      (current.body.config === null ? current.body.revision === 0 :
        current.body.revision > 0 && typeof current.body.config === 'object' && !Array.isArray(current.body.config));
    const index = getStorageIndexBinding(env);
    const readiness = {
      coordinator: !bound ? 'missing' : validCurrent || migration ? 'ok' : 'unavailable',
      configAuthority: migration ? 'migration_required' : !validCurrent ? 'unavailable' :
        current.body.config === null ? 'seeding' : 'ok',
      storage: index?.get && index?.put ? 'ok' : 'missing',
      kek: String(env.CE_STORAGE_ENVELOPE_KEK || '').trim() ? 'ok' : 'missing',
      tokenHmac: String(env.TOKEN_HMAC_SECRET || '').trim() ? 'ok' : 'missing',
    };
    // Only return fixed status/reason strings. Coordinator diagnostics and
    // config values can contain private data and must never cross this boundary.
    const needsKek = resolvePayloadAccessControl(current?.body?.config || {}).encryption === 'worker_envelope';
    const unavailable = [];
    for (const operation of ['submit', 'publish_question', 'admin_correction', 'backup']) {
      const required = ['coordinator', 'configAuthority', 'storage',
        ...(operation === 'backup' ? ['kek'] : ['tokenHmac', ...(needsKek ? ['kek'] : [])])];
      const failed = required.find((key) => readiness[key] !== 'ok');
      if (failed) unavailable.push({ operation, reason: `${failed}_${readiness[failed]}` });
    }
    body.session = { readiness, unavailable };
    if (validCurrent && current.body.config && resolveCanonicalWorkerSessionIdHex(current.body.config)) {
      const config = current.body.config;
      const enabled = config.sessionModeProfile?.surfaces?.agentHttp === true;
      const configured = readiness.coordinator === 'ok' && readiness.configAuthority === 'ok' && readiness.tokenHmac === 'ok' &&
        !!env.GROUP_KV?.get && !!env.GROUP_KV?.put && !!env.GROUP_KV?.list && !!env.GROUP_KV?.delete && !!env.AGENT_MANAGED_ROOT_SECRET;
      const ready = enabled && configured;
      body.agentHttp = { enabled, configured, ready };
      body.agentSessionWrapped = await buildAgentHttpCapability({ config, revision: current.body.revision,
        origin: url.origin, enabled: ready, bundle: body.bundle });
      responseHeaders.set('Cache-Control', 'no-store');
    }
  }
  return Response.json(body, { headers: responseHeaders });
};
