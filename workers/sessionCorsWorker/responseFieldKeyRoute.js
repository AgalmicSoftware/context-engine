import { assertResponseFieldAudience, resolveResponseFieldPolicy } from '../../shared/encryption/responseFieldPolicy.mjs';
import { base64urlToBytes, bytesToBase64url, wrapResponseFieldKey, unwrapResponseFieldKey, writeStorageEnvelopeKeyReleaseAudit } from './storageEnvelopeEncryption.js';

const address = value => /^0x[0-9a-f]{40}$/i.test(String(value || '')) ? String(value).toLowerCase() : '';
const response = (body, status, headers) => new Response(JSON.stringify(body), {
  status, headers: { ...Object.fromEntries(new Headers(headers || {})), 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
});
export const responseFieldKeyRoute = async ({ path, request, env, config, slug, uploaderAddress, authScopes, baseHeaders, deps, authorizeSession, isAdmin }) => {
  const principal = address(uploaderAddress);
  if (!principal || (authScopes?.storage !== true && authScopes?.arweave !== true)) return response({ error: 'Authentication required.' }, 401, baseHeaders);
  if (Number(request.headers.get('content-length') || 0) > 8192) return response({ error: 'Key request too large.' }, 413, baseHeaders);
  let body;
  try {
    const text = await request.text();
    if (text.length > 8192) return response({ error: 'Key request too large.' }, 413, baseHeaders);
    body = JSON.parse(text);
  } catch { return response({ error: 'Invalid key request.' }, 400, baseHeaders); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return response({ error: 'Invalid key request.' }, 400, baseHeaders);
  const wrapping = path === '/storage/response-field-key/wrap';
  const policy = wrapping ? {
    sessionSlug: slug, sessionId: config.sessionId || config.sessionIdHex,
    owner: principal, audience: body.audience, context: body.context,
  } : body.recipient?.policy;
  if (!policy || !['self_admin', 'session'].includes(policy.audience) ||
      !policy.sessionId || policy.sessionSlug !== slug || policy.sessionId !== (config.sessionId || config.sessionIdHex) ||
      !address(policy.owner) || !/^0x[0-9a-f]{64}$/i.test(policy.context) ||
      (!wrapping && (body.context !== policy.context || body.recipient?.type !== 'worker-response-field-v1'))) {
    return response({ error: 'Invalid response field policy.' }, 400, baseHeaders);
  }
  try {
    if (wrapping) assertResponseFieldAudience(config, policy.audience, { workerAvailable: true });
    else {
      const capability = resolveResponseFieldPolicy(config, { workerAvailable: true });
      if (!capability.centralized || (policy.audience === 'session' && !capability.privateSession)) throw new Error('Response field audience is no longer available.');
    }
  }
  catch (error) { return response({ error: error.message }, 403, baseHeaders); }
  // Author access is explicit. Admin access is granted only by self_admin;
  // session readers must pass the current private-session gate on every release.
  if (policy.audience === 'session') {
    const access = await authorizeSession();
    if (!access?.ok) return access?.response || response({ error: 'Session membership required.' }, 403, baseHeaders);
    // Empty/removed gates can make ordinary storage public. They must never
    // turn a Session-members field into a key available to every signed-in user.
    if (!access.conditionMatched || access.conditionMatched.emptyGate) return response({ error: 'Private session membership required.' }, 403, baseHeaders);
  } else if (!wrapping && principal !== policy.owner && !isAdmin(principal)) {
    return response({ error: 'This field is restricted to its submitter and session admins.' }, 403, baseHeaders);
  }
  try {
    if (wrapping) {
      if (typeof body.key !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.key)) return response({ error: 'Invalid field key.' }, 400, baseHeaders);
      const keyBytes = base64urlToBytes(body.key);
      if (keyBytes.length !== 32) return response({ error: 'Invalid field key.' }, 400, baseHeaders);
      try {
        const wrapped = await wrapResponseFieldKey({ env, keyBytes, policy, deps });
        return response({ recipient: { type: 'worker-response-field-v1', policy, wrapped } }, 200, baseHeaders);
      } finally { keyBytes.fill(0); }
    }
    const keyBytes = await unwrapResponseFieldKey({ env, wrapped: body.recipient.wrapped, policy, deps });
    try {
      if (keyBytes.length !== 32) throw new Error('Invalid field key.');
      await writeStorageEnvelopeKeyReleaseAudit({ env, slug, payloadId: policy.context, principal, conditionMatched: { audience: policy.audience, owner: policy.owner }, deps });
      return response({ key: bytesToBase64url(keyBytes) }, 200, baseHeaders);
    } finally { keyBytes.fill(0); }
  } catch { return response({ error: 'Unable to release response field key.' }, 503, baseHeaders); }
};
