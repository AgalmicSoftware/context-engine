export const AGENT_SESSION_WRAPPED_DEPLOYMENT_KIND = 'agent_session_wrapped';
export const AGENT_SESSION_WRAPPED_PROTOCOL_VERSION = 'agent-session-wrapped-v1';

const COMPATIBILITY_DATE = '2024-09-02';
const REQUIRED_SECRET_NAMES = Object.freeze([
  'DEMO_SIGNER_ROOT_SECRET',
  'AGENT_BRIDGE_AGENT_API_TOKEN',
]);

const toStr = (value) => (typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim());
const safeSlug = (value) => {
  const slug = toStr(value).toLowerCase();
  return /^[a-z0-9_-]{1,128}$/.test(slug) ? slug : '';
};
const safeDeploymentIdentity = (value) => {
  const identity = toStr(value);
  return /^[A-Za-z0-9._:-]{8,180}$/.test(identity) ? identity : '';
};
const normalizeHttpsOrigin = (value) => {
  try {
    const parsed = new URL(toStr(value));
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return '';
    return parsed.origin;
  } catch {
    return '';
  }
};
const normalizeHttpsUrl = (value) => {
  try {
    const parsed = new URL(toStr(value));
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) return '';
    return parsed.toString();
  } catch {
    return '';
  }
};
const normalizeAuthorityMode = (value) => {
  const mode = toStr(value).toLowerCase();
  return ['worker_canonical', 'evm_registry_canonical', 'registry_canonical'].includes(mode) ? mode : '';
};
const encode = (value) => new TextEncoder().encode(String(value || ''));
const bytesToHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const sha256Hex = async (value) => bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encode(value))));
const deriveSecret = async ({ apiToken, deploymentId, purpose }) => {
  const key = await crypto.subtle.importKey('raw', encode(apiToken), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encode(`context-engine:agent-session-wrapped:v1:${deploymentId}:${purpose}`));
  return bytesToHex(new Uint8Array(signature));
};
const response = (ok, status, body) => ({ ok, status, body });
const failure = (status, step, error) => response(false, status, { ok: false, step, error: toStr(error) });

const policyFor = ({ sessionSlug, sessionWorkerOrigin, authorityMode }) => ({
  version: 1,
  defaultSessionSlug: sessionSlug,
  sessions: [{
    sessionSlug,
    sessionWorkerUrl: sessionWorkerOrigin,
    telegramBridgeEnabled: false,
    sessionModeProfile: {
      surfaces: { agentHttp: true, telegram: false },
      authority: { mode: authorityMode },
    },
  }],
});

const workerNameFor = ({ sessionSlug, deploymentId }) => {
  const prefix = `ce-wrapped-${sessionSlug}`
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return `${prefix || 'ce-wrapped-session'}-${deploymentId.slice(0, 12)}`;
};

const bindingMap = (bindings = []) => new Map(
  (Array.isArray(bindings) ? bindings : []).map((binding) => [toStr(binding?.name), binding]),
);

const settingsOwnDeployment = ({ settings, expectedBindings, kvNamespaceId, verifyBundle = true }) => {
  if (!settings?.ok) return false;
  const result = settings.data?.result || {};
  if (toStr(result.main_module) && toStr(result.main_module) !== 'worker.mjs') return false;
  const actual = bindingMap(result.bindings);
  const kv = actual.get('AGENT_ACTION_KV');
  if (toStr(kv?.type) !== 'kv_namespace' || toStr(kv?.namespace_id) !== kvNamespaceId) return false;
  return expectedBindings
    .filter((binding) => binding.type === 'plain_text')
    .filter((binding) => verifyBundle || binding.name !== 'AGENT_BRIDGE_BUNDLE_SHA256')
    .every((binding) => {
      const observed = actual.get(binding.name);
      return toStr(observed?.type) === 'plain_text' && toStr(observed?.text) === binding.text;
    });
};

const buildUploadForm = ({ bundleSource, bindings }) => {
  const metadata = {
    main_module: 'worker.mjs',
    compatibility_date: COMPATIBILITY_DATE,
    compatibility_flags: ['nodejs_compat', 'global_fetch_strictly_public'],
    bindings,
  };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  form.append('worker.mjs', new Blob([bundleSource], { type: 'application/javascript+module' }), 'worker.mjs');
  return { form, metadata };
};

const readBundle = async ({ body, env, fetchImpl }) => {
  const inline = typeof body?.bundleText === 'string' ? body.bundleText : '';
  if (inline.trim()) return { ok: true, source: inline };
  const url = normalizeHttpsUrl(body?.bundleUrl || env?.AGENT_BRIDGE_BUNDLE_URL);
  if (!url) return { ok: false, error: 'Missing a trusted Agent Bridge bundle.' };
  try {
    const result = await fetchImpl(url, { method: 'GET', cache: 'no-store' });
    if (!result.ok) return { ok: false, error: `Failed to fetch Agent Bridge bundle (${result.status}).` };
    const source = await result.text();
    return source.trim() ? { ok: true, source } : { ok: false, error: 'Agent Bridge bundle is empty.' };
  } catch (error) {
    return { ok: false, error: `Failed to fetch Agent Bridge bundle: ${toStr(error?.message || error)}` };
  }
};

const listMatchingKvNamespaces = async ({ apiToken, accountId, title, cfFetchImpl }) => {
  const listed = await cfFetchImpl(
    apiToken,
    `/accounts/${accountId}/storage/kv/namespaces?per_page=100&page=1`,
    { method: 'GET' },
  );
  if (!listed.ok) return { ok: false, error: listed.error || 'Failed to list KV namespaces.' };
  const matches = (Array.isArray(listed.data?.result) ? listed.data.result : [])
    .filter((entry) => toStr(entry?.title) === title && toStr(entry?.id));
  if (matches.length > 1) return { ok: false, status: 409, error: 'Multiple KV namespaces match this Wrapped deployment identity.' };
  return { ok: true, match: matches[0] || null };
};

const normalizeCapability = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const origin = normalizeHttpsOrigin(value.origin);
  const protocolVersion = toStr(value.protocolVersion);
  const revision = toStr(value.revision);
  const verifiedAt = toStr(value.verifiedAt);
  if (
    Number(value.version) !== 1 ||
    value.enabled !== true ||
    !origin ||
    protocolVersion !== AGENT_SESSION_WRAPPED_PROTOCOL_VERSION ||
    !/^wrapped-[0-9a-f]{16}$/.test(revision) ||
    !Number.isFinite(Date.parse(verifiedAt))
  ) return null;
  return { version: 1, enabled: true, origin, protocolVersion, revision, verifiedAt };
};

export async function persistAgentSessionWrappedCapability({
  apiToken = '',
  accountId = '',
  kvNamespaceId = '',
  sessionConfigKey = '',
  sessionSlug = '',
  sessionWorkerOrigin = '',
  capability = null,
  cfFetchImpl,
} = {}) {
  const token = toStr(apiToken);
  const account = toStr(accountId);
  const kvId = toStr(kvNamespaceId);
  const configKey = toStr(sessionConfigKey);
  const slug = safeSlug(sessionSlug);
  const workerOrigin = normalizeHttpsOrigin(sessionWorkerOrigin);
  const normalizedCapability = normalizeCapability(capability);
  if (!token || !account || !kvId || !configKey || !slug || !workerOrigin || !normalizedCapability) {
    return failure(400, 'capability_config_validate', 'Wrapped capability publication inputs are invalid.');
  }
  if (typeof cfFetchImpl !== 'function') {
    return failure(500, 'capability_config_validate', 'Cloudflare deployment client is unavailable.');
  }
  const path = `/accounts/${account}/storage/kv/namespaces/${kvId}/values/${configKey}`;
  const current = await cfFetchImpl(token, path, { method: 'GET' });
  const currentConfig = current?.data?.result || current?.data || {};
  if (!current.ok) {
    return failure(502, 'capability_config_read', current.error || 'Session Worker config is unavailable.');
  }
  if (
    safeSlug(currentConfig.slug) !== slug ||
    normalizeHttpsOrigin(currentConfig.corsWorkerUrl) !== workerOrigin
  ) {
    return failure(409, 'capability_config_identity', 'Live session config does not match the paired session Worker.');
  }
  const nextConfig = { ...currentConfig, agentSessionWrapped: normalizedCapability };
  const written = await cfFetchImpl(token, path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nextConfig),
  });
  if (!written.ok) {
    return failure(502, 'capability_config_write', written.error || 'Wrapped capability config write failed.');
  }
  const verified = await cfFetchImpl(token, path, { method: 'GET' });
  const verifiedConfig = verified?.data?.result || verified?.data || {};
  if (
    !verified.ok ||
    safeSlug(verifiedConfig.slug) !== slug ||
    normalizeHttpsOrigin(verifiedConfig.corsWorkerUrl) !== workerOrigin ||
    JSON.stringify(normalizeCapability(verifiedConfig.agentSessionWrapped)) !== JSON.stringify(normalizedCapability)
  ) {
    return failure(502, 'capability_config_verify', 'Wrapped capability did not verify in session Worker config.');
  }
  return response(true, 200, { ok: true, agentSessionWrapped: normalizedCapability });
}

export async function executeAgentSessionWrappedDeployment({
  body = {},
  env = {},
  accountId = '',
  cfFetchImpl,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  markMutationStarted = null,
} = {}) {
  let mutationMarked = false;
  const beforeMutation = async () => {
    if (mutationMarked) return;
    if (typeof markMutationStarted === 'function') await markMutationStarted();
    mutationMarked = true;
  };
  const fail = (status, step, error) => {
    const result = failure(status, step, error);
    if (mutationMarked) result.body.deploymentRequestPending = true;
    return result;
  };
  const apiToken = toStr(body.apiToken || body.token);
  const resolvedAccountId = toStr(accountId);
  const sessionSlug = safeSlug(body.sessionSlug);
  const sessionWorkerOrigin = normalizeHttpsOrigin(body.sessionWorkerOrigin || body.sessionWorkerUrl);
  const sessionDeploymentIdentity = safeDeploymentIdentity(body.sessionDeploymentIdentity);
  const authorityMode = normalizeAuthorityMode(body.authorityMode);
  if (body.deploymentKind !== AGENT_SESSION_WRAPPED_DEPLOYMENT_KIND) {
    return fail(400, 'validate', 'Invalid deployment kind.');
  }
  if (!apiToken || !resolvedAccountId || !sessionSlug || !sessionWorkerOrigin || !sessionDeploymentIdentity || !authorityMode) {
    return fail(400, 'validate', 'Dedicated Wrapped deployment requires token, account, session identity, authority mode, and HTTPS session Worker origin.');
  }
  if (typeof cfFetchImpl !== 'function') return fail(500, 'validate', 'Cloudflare deployment client is unavailable.');
  if (body.telegramEnabled === true || toStr(body.telegramBotToken || body.telegramWebhookSecret)) {
    return fail(400, 'validate', 'Telegram configuration is not part of the default dedicated Wrapped deployment.');
  }

  const bundle = await readBundle({ body, env, fetchImpl });
  if (!bundle.ok) return fail(400, 'bundle', bundle.error);
  const [deploymentId, bundleSha256] = await Promise.all([
    sha256Hex(`context-engine:agent-session-wrapped:deployment:v1:${sessionDeploymentIdentity}`),
    sha256Hex(bundle.source),
  ]);
  const workerName = workerNameFor({ sessionSlug, deploymentId });

  const accountSubdomain = await cfFetchImpl(
    apiToken,
    `/accounts/${resolvedAccountId}/workers/subdomain`,
    { method: 'GET' },
  );
  const subdomain = toStr(accountSubdomain.data?.result?.subdomain);
  if (!accountSubdomain.ok || !subdomain) {
    return fail(502, 'workers_dev_subdomain', accountSubdomain.error || 'Cloudflare workers.dev subdomain is unavailable.');
  }
  const workerUrl = `https://${workerName}.${subdomain}.workers.dev`;
  const policyJson = JSON.stringify(policyFor({ sessionSlug, sessionWorkerOrigin, authorityMode }));
  const plainBindings = [
    { name: 'AGENT_BRIDGE_DEPLOYMENT_ID', type: 'plain_text', text: deploymentId },
    { name: 'AGENT_BRIDGE_BUNDLE_SHA256', type: 'plain_text', text: bundleSha256 },
    { name: 'AGENT_BRIDGE_PUBLIC_URL', type: 'plain_text', text: workerUrl },
    { name: 'CE_SESSION_WORKER_BASE_URL', type: 'plain_text', text: sessionWorkerOrigin },
    { name: 'AGENT_BRIDGE_SESSION_POLICY_JSON', type: 'plain_text', text: policyJson },
    { name: 'AGENT_BRIDGE_DIRECT_SUBMIT_ENABLED', type: 'plain_text', text: 'false' },
    { name: 'BROADCAST_ENABLED', type: 'plain_text', text: 'false' },
  ];
  const kvTitle = `ContextEngineAgentSessionWrapped:${sessionSlug}:${deploymentId.slice(0, 12)}`;
  const inventory = await listMatchingKvNamespaces({
    apiToken,
    accountId: resolvedAccountId,
    title: kvTitle,
    cfFetchImpl,
  });
  if (!inventory.ok) return fail(inventory.status || 502, 'kv_inventory', inventory.error);
  let kvId = toStr(inventory.match?.id);
  let kvReused = !!kvId;
  if (!kvId) {
    await beforeMutation();
    const created = await cfFetchImpl(
      apiToken,
      `/accounts/${resolvedAccountId}/storage/kv/namespaces`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: kvTitle }) },
    );
    kvId = toStr(created.data?.result?.id);
    if (!created.ok || !kvId) return fail(502, 'kv_create', created.error || 'Cloudflare did not create Wrapped KV.');
    kvReused = false;
  }

  const bindings = [
    { name: 'AGENT_ACTION_KV', type: 'kv_namespace', namespace_id: kvId },
    ...plainBindings,
  ];
  const settingsPath = `/accounts/${resolvedAccountId}/workers/scripts/${workerName}/settings`;
  const beforeSettings = await cfFetchImpl(apiToken, settingsPath, { method: 'GET' });
  const exists = beforeSettings.ok;
  if (!exists && Number(beforeSettings.status || 0) !== 404) {
    return fail(502, 'worker_preflight', beforeSettings.error || 'Unable to verify Wrapped Worker identity.');
  }
  if (exists && !settingsOwnDeployment({
    settings: beforeSettings,
    expectedBindings: plainBindings,
    kvNamespaceId: kvId,
    verifyBundle: false,
  })) {
    return fail(409, 'worker_preflight', 'Existing Worker does not match this Wrapped deployment identity.');
  }
  const beforeBindingMap = bindingMap(beforeSettings.data?.result?.bindings);
  const bundleAlreadyUploaded = exists && toStr(beforeBindingMap.get('AGENT_BRIDGE_BUNDLE_SHA256')?.text) === bundleSha256;
  let uploadMetadata = null;
  if (!bundleAlreadyUploaded) {
    await beforeMutation();
    const upload = buildUploadForm({ bundleSource: bundle.source, bindings });
    uploadMetadata = upload.metadata;
    const uploaded = await cfFetchImpl(
      apiToken,
      `/accounts/${resolvedAccountId}/workers/scripts/${workerName}`,
      { method: 'PUT', body: upload.form },
    );
    if (!uploaded.ok) return fail(502, 'worker_upload', uploaded.error || 'Wrapped Worker upload failed.');
  }
  const verifiedSettings = await cfFetchImpl(apiToken, settingsPath, { method: 'GET' });
  if (!settingsOwnDeployment({ settings: verifiedSettings, expectedBindings: plainBindings, kvNamespaceId: kvId })) {
    return fail(502, 'worker_binding_verification', 'Wrapped Worker bindings did not verify after upload.');
  }

  let existingSecrets = new Set();
  if (exists) {
    const listedSecrets = await cfFetchImpl(
      apiToken,
      `/accounts/${resolvedAccountId}/workers/scripts/${workerName}/secrets`,
      { method: 'GET' },
    );
    if (!listedSecrets.ok || !Array.isArray(listedSecrets.data?.result)) {
      return fail(502, 'worker_secret_inventory', listedSecrets.error || 'Unable to verify existing Wrapped secrets.');
    }
    existingSecrets = new Set(listedSecrets.data.result
      .filter((entry) => toStr(entry?.type) === 'secret_text')
      .map((entry) => toStr(entry?.name)));
  }
  const generated = [];
  const preserved = [];
  for (const name of REQUIRED_SECRET_NAMES) {
    if (existingSecrets.has(name)) {
      preserved.push(name);
      continue;
    }
    await beforeMutation();
    const text = await deriveSecret({ apiToken, deploymentId, purpose: name.toLowerCase() });
    const written = await cfFetchImpl(
      apiToken,
      `/accounts/${resolvedAccountId}/workers/scripts/${workerName}/secrets`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type: 'secret_text', text }) },
    );
    if (!written.ok) return fail(502, `worker_secret_${name}`, written.error || `Failed to write ${name}.`);
    generated.push(name);
  }

  await beforeMutation();
  const activation = await cfFetchImpl(
    apiToken,
    `/accounts/${resolvedAccountId}/workers/scripts/${workerName}/subdomain`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }) },
  );
  if (!activation.ok || activation.data?.result?.enabled !== true) {
    return fail(502, 'worker_activation', activation.error || 'Wrapped Worker workers.dev activation failed.');
  }

  let healthResponse;
  let health;
  try {
    healthResponse = await fetchImpl(`${workerUrl}/health`, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });
    health = await healthResponse.json();
  } catch (error) {
    return fail(503, 'authority_health_probe', toStr(error?.message || error) || 'Wrapped health request failed.');
  }
  const authorityReady = healthResponse.ok &&
    health?.ok === true &&
    health?.worker === 'agentBridgeWorker' &&
    health?.protocolVersion === AGENT_SESSION_WRAPPED_PROTOCOL_VERSION &&
    health?.agentSessionWrappedReady === true &&
    safeSlug(health?.dedicatedSession?.sessionSlug) === sessionSlug &&
    normalizeHttpsOrigin(health?.dedicatedSession?.sessionWorkerOrigin) === sessionWorkerOrigin;
  if (!authorityReady) {
    return fail(503, 'authority_health_probe', 'Wrapped Worker health, protocol, or pinned authority did not verify.');
  }

  const verifiedAt = now().toISOString();
  return response(true, 200, {
    ok: true,
    deploymentKind: AGENT_SESSION_WRAPPED_DEPLOYMENT_KIND,
    accountId: resolvedAccountId,
    workerName,
    workerUrl,
    sessionSlug,
    sessionWorkerOrigin,
    telegramConfigured: false,
    resources: { kvNamespaceId: kvId, kvReused },
    upload: { reused: bundleAlreadyUploaded, bundleSha256, metadata: uploadMetadata ? { main_module: uploadMetadata.main_module } : null },
    secrets: { generated, preserved },
    health: { ok: true, protocolVersion: health.protocolVersion, authorityPinned: true },
    agentSessionWrapped: {
      version: 1,
      enabled: true,
      origin: workerUrl,
      protocolVersion: AGENT_SESSION_WRAPPED_PROTOCOL_VERSION,
      revision: `wrapped-${bundleSha256.slice(0, 16)}`,
      verifiedAt,
    },
  });
}

export const __test__agentSessionWrappedDeployment = {
  policyFor,
  workerNameFor,
  sha256Hex,
};
