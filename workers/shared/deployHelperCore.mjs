import rpcDefaults from '../../client/src/variables/rpcDefaults.js';
import { buildSessionSecretsEnvelope } from './sessionSecretsEnvelope.mjs';

const { getPathRpcUrl } = rpcDefaults;

const API_BASE = 'https://api.cloudflare.com/client/v4';
export const DEFAULT_COMPAT_DATE = '2024-09-02';
export const DEFAULT_FAUCET_RPC_URL = getPathRpcUrl(11155420) || '';
export const DEFAULT_FAUCET_AMOUNT_ETH = '0.0002';
export const DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH = '0.001';
export const DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED = true;
// Fail closed for self-hosted/manual deploys that forgot to configure
// ALLOWED_ORIGINS. The broader CE/local bootstrap defaults belong in the
// publish CLI, not in the runtime fallback for a misconfigured helper.
export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
];
export const DEPLOY_HELPER_ORIGINS_KEY = 'deploy-helper:origins';

const TRUE_STRINGS = new Set(['1', 'true', 'yes', 'on']);
const FALSE_STRINGS = new Set(['0', 'false', 'no', 'off']);

export const toStr = (val) => (typeof val === 'string' ? val : val == null ? '' : String(val));
export const hasScheme = (value) => /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);
export const ensureHttpUrl = (raw) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return '';
  if (hasScheme(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return trimmed;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
};
export const normalizeOrigin = (raw) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return '';
  const withScheme = ensureHttpUrl(trimmed);
  if (withScheme.startsWith('/')) return '';
  try {
    return new URL(withScheme).origin;
  } catch {
    return '';
  }
};
export const normalizeOriginList = (list) => {
  const entries = Array.isArray(list) ? list : [list];
  const cleaned = entries.map((entry) => normalizeOrigin(entry)).filter(Boolean);
  return Array.from(new Set(cleaned));
};
export const normalizeAllowList = (list, fallback = DEFAULT_ALLOWED_ORIGINS) => {
  const normalized = normalizeOriginList(list);
  if (normalized.length) return normalized;
  return normalizeOriginList(fallback);
};
export const normalizeSlug = (raw) => {
  const slug = toStr(raw).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!slug) return '';
  return slug === 'general' ? '' : slug;
};
export const validateInboundSlug = (raw) => {
  if (raw == null) return { ok: true, slug: '', error: '' };
  const rawStr = toStr(raw).trim();
  if (!rawStr) return { ok: true, slug: '', error: '' };
  if (rawStr.toLowerCase() === 'general') return { ok: true, slug: '', error: '' };
  const canonicalSlug = rawStr.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (rawStr !== canonicalSlug) {
    return {
      ok: false,
      slug: '',
      error: 'Invalid session slug. Use lowercase letters, numbers, "_" or "-".',
    };
  }
  return { ok: true, slug: canonicalSlug, error: '' };
};

export const parseAllowList = (raw) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return [];
  return normalizeOriginList(trimmed.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean));
};
export const parseStoredAllowList = (raw) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return normalizeOriginList(parsed);
  } catch {}
  return parseAllowList(trimmed);
};

export const readJsonOrText = async (resp) => {
  let text = '';
  try {
    text = await resp.text();
  } catch {
    return {};
  }
  const trimmed = toStr(text).trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return { message: trimmed };
  }
};

export const cfFetch = async (token, path, options = {}, { fetchImpl = globalThis.fetch } = {}) => {
  let resp;
  try {
    resp = await fetchImpl(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: `Cloudflare API request failed: ${toStr(err?.message || err).trim() || 'Unknown error.'}`,
      detail: undefined,
      status: 502,
      data: null,
    };
  }
  const data = await readJsonOrText(resp);
  if (!resp.ok || data?.success === false) {
    const err = data?.errors?.[0]?.message || data?.message || `Cloudflare API error (${resp.status})`;
    const detail = data?.errors?.length ? data.errors : undefined;
    return { ok: false, error: err, detail, status: resp.status, data };
  }
  return { ok: true, data };
};

export const lookupCloudflareAccount = async ({
  apiToken,
  fetchImpl = globalThis.fetch,
} = {}) => {
  const accountsResp = await cfFetch(apiToken, '/accounts?per_page=1', {}, { fetchImpl });
  if (!accountsResp.ok) {
    const status = Number(accountsResp.status || 0) || 502;
    return {
      ok: false,
      error: accountsResp.error,
      detail: accountsResp.detail,
      status,
      fallbackEligible: status >= 500 || status === 429,
    };
  }
  const account = accountsResp.data?.result?.[0] || null;
  if (!account || !account.id) {
    return {
      ok: false,
      error: 'No accounts found for token.',
      detail: undefined,
      status: 404,
      fallbackEligible: false,
    };
  }
  return {
    ok: true,
    accountId: account.id,
    accountName: account.name || '',
  };
};

export const randomSecret = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
};
export const sha256Hex = async (value) => {
  const input = new TextEncoder().encode(toStr(value));
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};
export const buildBundleDiagnostics = async (bundleSource, sourceKind) => {
  const normalized = toStr(bundleSource);
  return {
    source: toStr(sourceKind).trim() || 'unknown',
    length: normalized.length,
    sha256: await sha256Hex(normalized),
    hasAnyExport: normalized.includes('export '),
    hasExportDefault: normalized.includes('export default'),
    hasNamedDefaultExport: normalized.includes(' as default') || normalized.includes('worker_default'),
    hasStringExportWrapper: (
      /^export\s+default\s+["'`]/.test(normalized) ||
      /^module\.exports\s*=\s*["'`]/.test(normalized)
    ),
    hasFetchHandler: normalized.includes('fetch('),
    hasServiceWorkerFetch: (
      normalized.includes(`addEventListener('fetch'`) ||
      normalized.includes('addEventListener("fetch"')
    ),
    prefix: normalized.slice(0, 120),
    suffix: normalized.slice(-120),
  };
};
export const formatBundleDiagnostics = (diagnostics = {}) => {
  const sha256 = toStr(diagnostics?.sha256).trim();
  return [
    `source=${toStr(diagnostics?.source).trim() || 'unknown'}`,
    `len=${Number(diagnostics?.length || 0) || 0}`,
    `sha256=${sha256 ? sha256.slice(0, 16) : 'n/a'}`,
    `export=${diagnostics?.hasAnyExport === true ? '1' : '0'}`,
    `default=${diagnostics?.hasExportDefault === true ? '1' : '0'}`,
    `namedDefault=${diagnostics?.hasNamedDefaultExport === true ? '1' : '0'}`,
    `stringWrap=${diagnostics?.hasStringExportWrapper === true ? '1' : '0'}`,
    `fetch=${diagnostics?.hasFetchHandler === true ? '1' : '0'}`,
    `swFetch=${diagnostics?.hasServiceWorkerFetch === true ? '1' : '0'}`,
  ].join(' ');
};

export const normalizeSecretValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return toStr(value).trim();
};

export const sanitizeSecrets = (incoming) => {
  const allowed = [
    'openaiKey',
    'anthropicKey',
    'openrouterKey',
    'customRpcUrl',
    'customRpcKey',
    'arweaveJwk',
    'faucetPrivateKey',
    'litAccountApiKey',
    'litUsageApiKey',
  ];
  const out = {};
  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(incoming || {}, key)) {
      out[key] = normalizeSecretValue(incoming[key]);
    }
  });
  return out;
};

export const sanitizeBlockLimits = (incoming) => {
  if (!incoming || typeof incoming !== 'object') return null;
  const start = Number(incoming.start);
  if (!Number.isFinite(start) || start <= 0) return null;
  const normalizedStart = Math.floor(start);
  const endRaw = incoming.end;
  const parsedEnd = (endRaw == null || endRaw === '') ? null : Number(endRaw);
  const normalizedEnd = Number.isFinite(parsedEnd) && parsedEnd > 0 && parsedEnd >= normalizedStart
    ? Math.floor(parsedEnd)
    : null;
  return {
    start: normalizedStart,
    end: normalizedEnd,
  };
};

export const normalizeEmbeddedDeployHelperEnabled = (
  value,
  fallback = DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED
) => {
  if (typeof value === 'boolean') return value;
  const trimmed = toStr(value).trim().toLowerCase();
  if (!trimmed) return fallback;
  if (TRUE_STRINGS.has(trimmed)) return true;
  if (FALSE_STRINGS.has(trimmed)) return false;
  return fallback;
};

const buildFailure = (status, body, { fallbackEligible = false } = {}) => ({
  ok: false,
  status,
  body,
  fallbackEligible,
});

const buildSuccess = (status, body) => ({
  ok: true,
  status,
  body,
  fallbackEligible: false,
});

const shouldAllowFallbackForCloudflareFailure = (result = {}) => {
  const status = Number(result?.status || 0);
  if (!status) return true;
  return status >= 500 || status === 429;
};

export const ensureWorkersDevSubdomain = async ({
  apiToken,
  accountId,
  workerName,
  requestedSubdomain = '',
  fetchImpl = globalThis.fetch,
} = {}) => {
  let subdomain = null;
  let subdomainStatus = '';
  let subdomainEnabled = false;
  let subdomainError = '';
  let scriptSubdomainEnabled = false;
  let scriptSubdomainError = '';

  const fallbackSubdomain = accountId
    ? `ce-${toStr(accountId).replace(/[^a-z0-9-]/gi, '').slice(0, 10)}`
    : '';

  const subdomainResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/subdomain`, {}, { fetchImpl });
  if (subdomainResp.ok) {
    subdomain = subdomainResp.data?.result?.subdomain || null;
    subdomainStatus = subdomainResp.data?.result?.status || '';
  } else {
    subdomainError = subdomainResp.error || subdomainError;
  }

  const ensureAccountSubdomain = async (candidate) => {
    if (!candidate) return;
    const enableResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/subdomain`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain: candidate }),
    }, { fetchImpl });
    if (enableResp.ok) {
      subdomain = enableResp.data?.result?.subdomain || candidate;
      subdomainStatus = enableResp.data?.result?.status || subdomainStatus || 'active';
      subdomainEnabled = true;
      subdomainError = '';
    } else {
      subdomainError = enableResp.error || 'Failed to enable workers.dev subdomain.';
    }
  };

  if (!subdomain) {
    await ensureAccountSubdomain(toStr(requestedSubdomain).trim() || fallbackSubdomain);
  } else if (subdomainStatus && subdomainStatus !== 'active') {
    await ensureAccountSubdomain(subdomain);
  }

  if (subdomain) {
    const scriptSubdomainResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    }, { fetchImpl });
    if (scriptSubdomainResp.ok) {
      scriptSubdomainEnabled = scriptSubdomainResp.data?.result?.enabled !== false;
    } else {
      scriptSubdomainError = scriptSubdomainResp.error || 'Failed to enable workers.dev for script.';
    }
  }

  const workerUrl = subdomain ? `https://${workerName}.${subdomain}.workers.dev/` : '';
  return {
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    scriptSubdomainEnabled,
    scriptSubdomainError,
    workerUrl,
  };
};

const resolveDeploymentAccountId = async ({
  body,
  fetchImpl,
} = {}) => {
  const explicitAccountId = toStr(body?.accountId).trim();
  if (explicitAccountId) {
    return {
      ok: true,
      accountId: explicitAccountId,
      accountName: '',
    };
  }

  const lookup = await lookupCloudflareAccount({
    apiToken: toStr(body?.apiToken || body?.token).trim(),
    fetchImpl,
  });
  if (!lookup.ok) {
    return lookup;
  }
  return lookup;
};

export const executeDeployHelperRequest = async ({
  body,
  env,
  requestOrigin = '',
  fetchImpl = globalThis.fetch,
  consoleImpl = console,
} = {}) => {
  const sessionSlugCheck = validateInboundSlug(body?.sessionSlug);
  if (!sessionSlugCheck.ok) {
    return buildFailure(400, { error: sessionSlugCheck.error });
  }
  if (body?.groupSlug != null && body?.sessionSlug == null) {
    return buildFailure(400, {
      error: 'Legacy groupSlug is no longer accepted. Use sessionSlug instead.',
    });
  }

  const apiToken = toStr(body?.apiToken || body?.token).trim();
  const workerName = toStr(body?.workerName).trim();
  const defaultSlug = normalizeSlug(env?.DEFAULT_SESSION_SLUG ?? env?.DEFAULT_GROUP_SLUG ?? '');
  const sessionSlug = body?.sessionSlug != null ? sessionSlugCheck.slug : defaultSlug;
  const displaySlug = sessionSlug || 'general';
  const bundleText = typeof body?.bundleText === 'string'
    ? body.bundleText
    : toStr(body?.bundleText);
  const hasBundleText = bundleText.trim() !== '';
  const bundleUrl = toStr(body?.bundleUrl || env?.WORKER_BUNDLE_URL).trim();

  if (!apiToken) return buildFailure(400, { error: 'Missing apiToken.' });
  if (!workerName) return buildFailure(400, { error: 'Missing workerName.' });
  if (!hasBundleText && !bundleUrl) {
    return buildFailure(400, {
      error: 'Missing bundleText or bundleUrl (set WORKER_BUNDLE_URL or pass bundleUrl).',
    });
  }

  const accountLookup = await resolveDeploymentAccountId({
    body: {
      ...body,
      apiToken,
    },
    fetchImpl,
  });
  if (!accountLookup.ok) {
    return buildFailure(502, {
      error: accountLookup.error || 'Failed to resolve Cloudflare account.',
      detail: accountLookup.detail,
    }, {
      fallbackEligible: accountLookup.fallbackEligible === true,
    });
  }
  const accountId = toStr(accountLookup.accountId).trim();
  if (!accountId) {
    return buildFailure(404, { error: 'No accounts found for token.' });
  }

  const registryAddress = toStr(body?.registryAddress).trim();
  const registryChainId = Number(body?.registryChainId || 0) || 0;
  const hatsAddress = toStr(body?.hatsAddress).trim();
  const adminHatId = toStr(body?.adminHatId).trim();
  const adminAddress = toStr(body?.adminAddress).trim();
  const rpcUrl = toStr(body?.rpcUrl).trim();
  const rpcUrlsByChainId = (body?.rpcUrlsByChainId && typeof body.rpcUrlsByChainId === 'object')
    ? body.rpcUrlsByChainId
    : {};
  const allowOriginsInput = Array.isArray(body?.allowOrigins) ? body.allowOrigins : [];
  const allowOrigins = normalizeAllowList(
    allowOriginsInput.length ? allowOriginsInput : [requestOrigin]
  );
  const limits = body?.limits || {};
  const scopes = body?.scopes || {};
  const faucetInput = body?.faucet && typeof body.faucet === 'object' ? body.faucet : {};
  const faucet = {
    rpcUrl: toStr(faucetInput.rpcUrl).trim() || DEFAULT_FAUCET_RPC_URL,
    amountEth: toStr(faucetInput.amountEth).trim() || DEFAULT_FAUCET_AMOUNT_ETH,
    balanceThresholdEth: toStr(faucetInput.balanceThresholdEth).trim() || DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH,
  };
  const embeddedDeployHelperEnabled = normalizeEmbeddedDeployHelperEnabled(
    body?.embeddedDeployHelperEnabled ?? body?.deployHelperEnabled,
    true
  );

  let bundleSource = hasBundleText ? bundleText : '';
  let bundleSourceKind = hasBundleText ? 'bundleText' : 'bundleUrl';
  if (!bundleSource) {
    let bundleResp;
    try {
      bundleResp = await fetchImpl(bundleUrl);
    } catch (err) {
      return buildFailure(502, {
        error: `Failed to fetch bundle: ${toStr(err?.message || err).trim() || 'Unknown error.'}`,
      }, {
        fallbackEligible: true,
      });
    }
    if (!bundleResp.ok) {
      return buildFailure(502, {
        error: `Failed to fetch bundle (${bundleResp.status}).`,
      }, {
        fallbackEligible: bundleResp.status >= 500 || bundleResp.status === 429,
      });
    }
    bundleSource = await bundleResp.text();
  }
  const bundleDiagnostics = await buildBundleDiagnostics(bundleSource, bundleSourceKind);
  consoleImpl?.log?.('[deploy-helper] bundle diagnostics', JSON.stringify({
    workerName,
    sessionSlug: displaySlug,
    diagnostics: {
      ...bundleDiagnostics,
      prefix: bundleDiagnostics.prefix,
      suffix: bundleDiagnostics.suffix,
    },
  }));

  const kvCreate = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `ContextEngineSessionCorsWorker:${displaySlug}` }),
  }, { fetchImpl });
  if (!kvCreate.ok) {
    return buildFailure(502, {
      error: kvCreate.error,
      detail: kvCreate.detail,
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(kvCreate),
    });
  }
  const kvId = kvCreate.data?.result?.id;
  if (!kvId) {
    return buildFailure(502, { error: 'Failed to create KV namespace.' }, { fallbackEligible: true });
  }

  const tokenSecret = randomSecret();
  const metadata = {
    main_module: 'worker.mjs',
    bindings: [
      { name: 'GROUP_KV', type: 'kv_namespace', namespace_id: kvId },
      { name: 'DEFAULT_SESSION_SLUG', type: 'plain_text', text: sessionSlug },
      { name: 'DEPLOY_HELPER_ENABLED', type: 'plain_text', text: embeddedDeployHelperEnabled ? '1' : '0' },
    ],
    compatibility_date: toStr(env?.WORKER_COMPATIBILITY_DATE || DEFAULT_COMPAT_DATE),
    compatibility_flags: ['nodejs_compat'],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  form.append('worker.mjs', new Blob([bundleSource], { type: 'application/javascript+module' }), 'worker.mjs');

  const scriptUpload = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}`, {
    method: 'PUT',
    body: form,
  }, { fetchImpl });
  if (!scriptUpload.ok) {
    consoleImpl?.error?.('[deploy-helper] script upload failed', JSON.stringify({
      workerName,
      sessionSlug: displaySlug,
      error: scriptUpload.error,
      detail: scriptUpload.detail,
      diagnostics: bundleDiagnostics,
    }));
    const bundleSummary = formatBundleDiagnostics(bundleDiagnostics);
    return buildFailure(502, {
      error: `${scriptUpload.error} Bundle diagnostics: ${bundleSummary}`,
      detail: scriptUpload.detail,
      bundleDiagnostics,
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(scriptUpload),
    });
  }

  const secretResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}/secrets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'TOKEN_HMAC_SECRET', type: 'secret_text', text: tokenSecret }),
  }, { fetchImpl });
  if (!secretResp.ok) {
    return buildFailure(502, {
      error: secretResp.error,
      detail: secretResp.detail,
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(secretResp),
    });
  }

  const config = {
    registryAddress,
    registryChainId,
    hatsAddress,
    adminHatId,
    adminAddress,
    rpcUrl,
    rpcUrlsByChainId,
    allowOrigins,
    limits,
    scopes,
    faucet,
    embeddedDeployHelperEnabled,
  };
  const blockLimits = sanitizeBlockLimits(body?.blockLimits);
  if (blockLimits) {
    config.blockLimits = blockLimits;
  }

  const sessionConfigKey = `session:${sessionSlug}:config`;
  const sessionSecretsKey = `session:${sessionSlug}:secrets`;
  const secrets = sanitizeSecrets(body?.secrets || {});
  const secretsEnvelope = buildSessionSecretsEnvelope(secrets);

  const configPut = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionConfigKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  }, { fetchImpl });
  if (!configPut.ok) {
    return buildFailure(502, {
      error: configPut.error,
      detail: configPut.detail,
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(configPut),
    });
  }

  const secretsPut = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionSecretsKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(secretsEnvelope),
  }, { fetchImpl });
  if (!secretsPut.ok) {
    return buildFailure(502, {
      error: secretsPut.error,
      detail: secretsPut.detail,
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(secretsPut),
    });
  }

  const {
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    scriptSubdomainEnabled,
    scriptSubdomainError,
    workerUrl,
  } = await ensureWorkersDevSubdomain({
    apiToken,
    accountId,
    workerName,
    requestedSubdomain: toStr(body?.subdomain || body?.workersSubdomain).trim(),
    fetchImpl,
  });
  const deploymentPayload = {
    ok: true,
    workerUrl,
    resolvedSlug: displaySlug,
    kvNamespaceId: kvId,
    sessionConfigKey,
    sessionSecretsKey,
    sessionKvPrefix: 'session',
    writesSessionConfig: true,
    writesSessionSecrets: true,
    tokenSecretSet: true,
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    scriptSubdomainEnabled,
    scriptSubdomainError,
  };
  if (workerUrl) {
    const configWithWorkerUrl = {
      ...config,
      corsWorkerUrl: workerUrl,
    };
    const configUpdate = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionConfigKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configWithWorkerUrl),
    }, { fetchImpl });
    if (!configUpdate.ok) {
      return buildSuccess(207, {
        ...deploymentPayload,
        partial: true,
        configWriteError: configUpdate.error,
        configWriteStatus: configUpdate.status || 502,
        configWriteDetail: configUpdate.detail,
      });
    }
  }

  return buildSuccess(200, deploymentPayload);
};
