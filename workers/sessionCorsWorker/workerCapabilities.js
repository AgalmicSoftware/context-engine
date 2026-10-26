import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';
import { SESSION_CONFIG_MIGRATION_REQUIRED_REASON } from './sessionConfigSecretsStore.js';
import { validateInboundWorkerSessionSlug } from './sessionSlugResolution.js';
import { getStorageIndexBinding, resolvePayloadAccessControl } from './storageRouteExecution.js';

export const FEATURES = Object.freeze([
  'envelope_export_identity_v1',
  'response_upload_receipts',
  'results_analysis_retry_v1',
  'session_backup_v1',
  'upload_authority_stamps',
  'worker_groups',
]);

export const dispatchWorkerCapabilities = async ({ request, env = {}, headers = {} }) => {
  const body = {
    type: 'ce_worker_capabilities', version: 1, apiVersion: 1,
    bundle: env.CE_BUNDLE_SHA256 || null, features: FEATURES,
  };
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Cache-Control', 'public, max-age=30');
  const url = new URL(request.url);
  if (url.searchParams.has('slug')) {
    const validated = validateInboundWorkerSessionSlug(url.searchParams.get('slug'));
    if (!validated.ok) return Response.json({ error: validated.error }, { status: 400, headers: responseHeaders });
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
  }
  return Response.json(body, { headers: responseHeaders });
};
