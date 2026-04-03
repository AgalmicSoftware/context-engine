var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// client/src/variables/rpcDefaults.js
var require_rpcDefaults = __commonJS({
  "client/src/variables/rpcDefaults.js"(exports, module) {
    var toStr2 = (value) => typeof value === "string" ? value : value == null ? "" : String(value);
    var normalizeUrl = (value) => toStr2(value).trim();
    var freezeUrlList = (value) => Object.freeze(
      (Array.isArray(value) ? value : [value]).map((entry) => normalizeUrl(entry)).filter(Boolean)
    );
    var freezeUrlListMap = (map) => Object.freeze(
      Object.fromEntries(
        Object.entries(map || {}).map(([key, value]) => [Number(key), freezeUrlList(value)])
      )
    );
    var freezeUrlMap = (map) => Object.freeze(
      Object.fromEntries(
        Object.entries(map || {}).map(([key, value]) => [Number(key), normalizeUrl(value)])
      )
    );
    var readChainValue = (map, chainId) => {
      const id = Number(chainId || 0);
      if (!id) return void 0;
      return map[id] || map[String(id)];
    };
    var cloneUrlList = (list) => Array.isArray(list) ? [...list] : [];
    var publicRpcUrlsByChainId = freezeUrlListMap({
      1: [
        "https://ethereum.publicnode.com",
        "https://eth.merkle.io",
        "https://rpc.flashbots.net"
      ],
      10: [
        "https://mainnet.optimism.io",
        "https://optimism.publicnode.com"
      ],
      56: [
        "https://bsc-dataseed.binance.org",
        "https://bsc.publicnode.com",
        "https://bsc-rpc.publicnode.com"
      ],
      137: [
        "https://polygon-rpc.com",
        "https://polygon.publicnode.com"
      ],
      42220: [
        "https://forno.celo.org",
        "https://celo.publicnode.com",
        "https://rpc.ankr.com/celo"
      ],
      8453: [
        "https://base.publicnode.com",
        "https://base-rpc.publicnode.com",
        "https://base.llamarpc.com",
        "https://mainnet.base.org"
      ],
      84532: [
        "https://base-sepolia-rpc.publicnode.com",
        "https://base-sepolia.publicnode.com",
        "https://base-sepolia.blockscout.com/api/eth-rpc",
        "https://base-sepolia.gateway.tenderly.co",
        "https://base-sepolia.drpc.org",
        "https://sepolia.base.org"
      ],
      11155420: [
        "https://sepolia.optimism.io",
        "https://optimism-sepolia.publicnode.com",
        "https://optimism-sepolia-rpc.publicnode.com",
        "https://optimism-sepolia.gateway.tenderly.co",
        "https://optimism-sepolia.drpc.org"
      ],
      42161: [
        "https://arb1.arbitrum.io/rpc",
        "https://arbitrum.publicnode.com"
      ],
      421614: [
        "https://sepolia-rollup.arbitrum.io/rpc",
        "https://arbitrum-sepolia.publicnode.com"
      ],
      747474: [
        "https://rpc.katana.network"
      ]
    });
    var pathRpcUrlsByChainId = freezeUrlMap({
      1: "https://eth.api.pocket.network",
      10: "https://op.api.pocket.network",
      56: "https://bsc.api.pocket.network",
      137: "https://poly.api.pocket.network",
      42220: "https://celo.api.pocket.network",
      8453: "https://base.api.pocket.network",
      42161: "https://arb-one.api.pocket.network",
      43114: "https://avax.api.pocket.network",
      11155111: "https://eth-sepolia-testnet.api.pocket.network",
      11155420: "https://op-sepolia-testnet.api.pocket.network",
      421614: "https://arb-sepolia-testnet.api.pocket.network",
      84532: "https://base-sepolia-testnet.api.pocket.network",
      80002: "https://poly-amoy-testnet.api.pocket.network"
    });
    var faucetFallbackRpcUrlsByChainId = freezeUrlListMap({
      8453: [
        "https://mainnet.base.org",
        "https://base.publicnode.com",
        "https://base-rpc.publicnode.com"
      ],
      84532: [
        "https://sepolia.base.org",
        "https://base-sepolia-rpc.publicnode.com",
        "https://base-sepolia.drpc.org"
      ],
      11155420: [
        "https://sepolia.optimism.io",
        "https://optimism-sepolia.publicnode.com",
        "https://optimism-sepolia-rpc.publicnode.com",
        "https://optimism-sepolia.drpc.org",
        "https://optimism-sepolia.gateway.tenderly.co"
      ]
    });
    var getPublicRpcUrls = (chainId, overrides = null) => {
      const base = readChainValue(publicRpcUrlsByChainId, chainId);
      const override = overrides && typeof overrides === "object" ? readChainValue(overrides, chainId) : void 0;
      return cloneUrlList(Array.isArray(override) ? freezeUrlList(override) : base);
    };
    var getPathRpcUrl2 = (chainId, overrides = null) => {
      const override = overrides && typeof overrides === "object" ? readChainValue(overrides, chainId) : void 0;
      return normalizeUrl(override || readChainValue(pathRpcUrlsByChainId, chainId) || "");
    };
    var getFaucetFallbackRpcUrls = (chainId, overrides = null) => {
      const base = readChainValue(faucetFallbackRpcUrlsByChainId, chainId);
      const override = overrides && typeof overrides === "object" ? readChainValue(overrides, chainId) : void 0;
      return cloneUrlList(Array.isArray(override) ? freezeUrlList(override) : base);
    };
    var rpcDefaults2 = Object.freeze({
      publicRpcUrlsByChainId,
      pathRpcUrlsByChainId,
      faucetFallbackRpcUrlsByChainId,
      getPublicRpcUrls,
      getPathRpcUrl: getPathRpcUrl2,
      getFaucetFallbackRpcUrls
    });
    module.exports = rpcDefaults2;
  }
});

// workers/shared/deployHelperCore.mjs
var import_rpcDefaults = __toESM(require_rpcDefaults(), 1);
var { getPathRpcUrl } = import_rpcDefaults.default;
var API_BASE = "https://api.cloudflare.com/client/v4";
var DEFAULT_COMPAT_DATE = "2024-09-02";
var DEFAULT_FAUCET_RPC_URL = getPathRpcUrl(11155420) || "";
var DEFAULT_FAUCET_AMOUNT_ETH = "0.0002";
var DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH = "0.001";
var DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED = true;
var DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000"
];
var DEPLOY_HELPER_ORIGINS_KEY = "deploy-helper:origins";
var TRUE_STRINGS = /* @__PURE__ */ new Set(["1", "true", "yes", "on"]);
var FALSE_STRINGS = /* @__PURE__ */ new Set(["0", "false", "no", "off"]);
var toStr = (val) => typeof val === "string" ? val : val == null ? "" : String(val);
var hasScheme = (value) => /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);
var ensureHttpUrl = (raw) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return "";
  if (hasScheme(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return trimmed;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
};
var normalizeOrigin = (raw) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return "";
  const withScheme = ensureHttpUrl(trimmed);
  if (withScheme.startsWith("/")) return "";
  try {
    return new URL(withScheme).origin;
  } catch {
    return "";
  }
};
var normalizeOriginList = (list) => {
  const entries = Array.isArray(list) ? list : [list];
  const cleaned = entries.map((entry) => normalizeOrigin(entry)).filter(Boolean);
  return Array.from(new Set(cleaned));
};
var normalizeAllowList = (list, fallback = DEFAULT_ALLOWED_ORIGINS) => {
  const normalized = normalizeOriginList(list);
  if (normalized.length) return normalized;
  return normalizeOriginList(fallback);
};
var normalizeSlug = (raw) => {
  const slug = toStr(raw).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!slug) return "";
  return slug === "general" ? "" : slug;
};
var validateInboundSlug = (raw) => {
  if (raw == null) return { ok: true, slug: "", error: "" };
  const rawStr = toStr(raw).trim();
  if (!rawStr) return { ok: true, slug: "", error: "" };
  if (rawStr.toLowerCase() === "general") return { ok: true, slug: "", error: "" };
  const canonicalSlug = rawStr.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (rawStr !== canonicalSlug) {
    return {
      ok: false,
      slug: "",
      error: 'Invalid session slug. Use lowercase letters, numbers, "_" or "-".'
    };
  }
  return { ok: true, slug: canonicalSlug, error: "" };
};
var parseAllowList = (raw) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return [];
  return normalizeOriginList(trimmed.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean));
};
var parseStoredAllowList = (raw) => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return normalizeOriginList(parsed);
  } catch {
  }
  return parseAllowList(trimmed);
};
var readJsonOrText = async (resp) => {
  let text = "";
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
var cfFetch = async (token, path, options = {}, { fetchImpl = globalThis.fetch } = {}) => {
  let resp;
  try {
    resp = await fetchImpl(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers || {}
      }
    });
  } catch (err) {
    return {
      ok: false,
      error: `Cloudflare API request failed: ${toStr(err?.message || err).trim() || "Unknown error."}`,
      detail: void 0,
      status: 502,
      data: null
    };
  }
  const data = await readJsonOrText(resp);
  if (!resp.ok || data?.success === false) {
    const err = data?.errors?.[0]?.message || data?.message || `Cloudflare API error (${resp.status})`;
    const detail = data?.errors?.length ? data.errors : void 0;
    return { ok: false, error: err, detail, status: resp.status, data };
  }
  return { ok: true, data };
};
var lookupCloudflareAccount = async ({
  apiToken,
  fetchImpl = globalThis.fetch
} = {}) => {
  const accountsResp = await cfFetch(apiToken, "/accounts?per_page=1", {}, { fetchImpl });
  if (!accountsResp.ok) {
    const status = Number(accountsResp.status || 0) || 502;
    return {
      ok: false,
      error: accountsResp.error,
      detail: accountsResp.detail,
      status,
      fallbackEligible: status >= 500 || status === 429
    };
  }
  const account = accountsResp.data?.result?.[0] || null;
  if (!account || !account.id) {
    return {
      ok: false,
      error: "No accounts found for token.",
      detail: void 0,
      status: 404,
      fallbackEligible: false
    };
  }
  return {
    ok: true,
    accountId: account.id,
    accountName: account.name || ""
  };
};
var randomSecret = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
};
var sha256Hex = async (value) => {
  const input = new TextEncoder().encode(toStr(value));
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
var buildBundleDiagnostics = async (bundleSource, sourceKind) => {
  const normalized = toStr(bundleSource);
  return {
    source: toStr(sourceKind).trim() || "unknown",
    length: normalized.length,
    sha256: await sha256Hex(normalized),
    hasAnyExport: normalized.includes("export "),
    hasExportDefault: normalized.includes("export default"),
    hasNamedDefaultExport: normalized.includes(" as default") || normalized.includes("worker_default"),
    hasStringExportWrapper: /^export\s+default\s+["'`]/.test(normalized) || /^module\.exports\s*=\s*["'`]/.test(normalized),
    hasFetchHandler: normalized.includes("fetch("),
    hasServiceWorkerFetch: normalized.includes(`addEventListener('fetch'`) || normalized.includes('addEventListener("fetch"'),
    prefix: normalized.slice(0, 120),
    suffix: normalized.slice(-120)
  };
};
var formatBundleDiagnostics = (diagnostics = {}) => {
  const sha256 = toStr(diagnostics?.sha256).trim();
  return [
    `source=${toStr(diagnostics?.source).trim() || "unknown"}`,
    `len=${Number(diagnostics?.length || 0) || 0}`,
    `sha256=${sha256 ? sha256.slice(0, 16) : "n/a"}`,
    `export=${diagnostics?.hasAnyExport === true ? "1" : "0"}`,
    `default=${diagnostics?.hasExportDefault === true ? "1" : "0"}`,
    `namedDefault=${diagnostics?.hasNamedDefaultExport === true ? "1" : "0"}`,
    `stringWrap=${diagnostics?.hasStringExportWrapper === true ? "1" : "0"}`,
    `fetch=${diagnostics?.hasFetchHandler === true ? "1" : "0"}`,
    `swFetch=${diagnostics?.hasServiceWorkerFetch === true ? "1" : "0"}`
  ].join(" ");
};
var normalizeSecretValue = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return toStr(value).trim();
};
var sanitizeSecrets = (incoming) => {
  const allowed = [
    "openaiKey",
    "anthropicKey",
    "openrouterKey",
    "customRpcUrl",
    "customRpcKey",
    "arweaveJwk",
    "faucetPrivateKey",
    "litPayerPrivateKey",
    "litPayerAddress"
  ];
  const out = {};
  allowed.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(incoming || {}, key)) {
      out[key] = normalizeSecretValue(incoming[key]);
    }
  });
  return out;
};
var sanitizeBlockLimits = (incoming) => {
  if (!incoming || typeof incoming !== "object") return null;
  const start = Number(incoming.start);
  if (!Number.isFinite(start) || start <= 0) return null;
  const normalizedStart = Math.floor(start);
  const endRaw = incoming.end;
  const parsedEnd = endRaw == null || endRaw === "" ? null : Number(endRaw);
  const normalizedEnd = Number.isFinite(parsedEnd) && parsedEnd > 0 && parsedEnd >= normalizedStart ? Math.floor(parsedEnd) : null;
  return {
    start: normalizedStart,
    end: normalizedEnd
  };
};
var normalizeEmbeddedDeployHelperEnabled = (value, fallback = DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED) => {
  if (typeof value === "boolean") return value;
  const trimmed = toStr(value).trim().toLowerCase();
  if (!trimmed) return fallback;
  if (TRUE_STRINGS.has(trimmed)) return true;
  if (FALSE_STRINGS.has(trimmed)) return false;
  return fallback;
};
var buildFailure = (status, body, { fallbackEligible = false } = {}) => ({
  ok: false,
  status,
  body,
  fallbackEligible
});
var buildSuccess = (status, body) => ({
  ok: true,
  status,
  body,
  fallbackEligible: false
});
var shouldAllowFallbackForCloudflareFailure = (result = {}) => {
  const status = Number(result?.status || 0);
  if (!status) return true;
  return status >= 500 || status === 429;
};
var ensureWorkersDevSubdomain = async ({
  apiToken,
  accountId,
  workerName,
  requestedSubdomain = "",
  fetchImpl = globalThis.fetch
} = {}) => {
  let subdomain = null;
  let subdomainStatus = "";
  let subdomainEnabled = false;
  let subdomainError = "";
  let scriptSubdomainEnabled = false;
  let scriptSubdomainError = "";
  const fallbackSubdomain = accountId ? `ce-${toStr(accountId).replace(/[^a-z0-9-]/gi, "").slice(0, 10)}` : "";
  const subdomainResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/subdomain`, {}, { fetchImpl });
  if (subdomainResp.ok) {
    subdomain = subdomainResp.data?.result?.subdomain || null;
    subdomainStatus = subdomainResp.data?.result?.status || "";
  } else {
    subdomainError = subdomainResp.error || subdomainError;
  }
  const ensureAccountSubdomain = async (candidate) => {
    if (!candidate) return;
    const enableResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/subdomain`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subdomain: candidate })
    }, { fetchImpl });
    if (enableResp.ok) {
      subdomain = enableResp.data?.result?.subdomain || candidate;
      subdomainStatus = enableResp.data?.result?.status || subdomainStatus || "active";
      subdomainEnabled = true;
      subdomainError = "";
    } else {
      subdomainError = enableResp.error || "Failed to enable workers.dev subdomain.";
    }
  };
  if (!subdomain) {
    await ensureAccountSubdomain(toStr(requestedSubdomain).trim() || fallbackSubdomain);
  } else if (subdomainStatus && subdomainStatus !== "active") {
    await ensureAccountSubdomain(subdomain);
  }
  if (subdomain) {
    const scriptSubdomainResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true })
    }, { fetchImpl });
    if (scriptSubdomainResp.ok) {
      scriptSubdomainEnabled = scriptSubdomainResp.data?.result?.enabled !== false;
    } else {
      scriptSubdomainError = scriptSubdomainResp.error || "Failed to enable workers.dev for script.";
    }
  }
  const workerUrl = subdomain ? `https://${workerName}.${subdomain}.workers.dev/` : "";
  return {
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    scriptSubdomainEnabled,
    scriptSubdomainError,
    workerUrl
  };
};
var resolveDeploymentAccountId = async ({
  body,
  fetchImpl
} = {}) => {
  const explicitAccountId = toStr(body?.accountId).trim();
  if (explicitAccountId) {
    return {
      ok: true,
      accountId: explicitAccountId,
      accountName: ""
    };
  }
  const lookup = await lookupCloudflareAccount({
    apiToken: toStr(body?.apiToken || body?.token).trim(),
    fetchImpl
  });
  if (!lookup.ok) {
    return lookup;
  }
  return lookup;
};
var executeDeployHelperRequest = async ({
  body,
  env,
  requestOrigin = "",
  fetchImpl = globalThis.fetch,
  consoleImpl = console
} = {}) => {
  const sessionSlugCheck = validateInboundSlug(body?.sessionSlug);
  if (!sessionSlugCheck.ok) {
    return buildFailure(400, { error: sessionSlugCheck.error });
  }
  if (body?.groupSlug != null && body?.sessionSlug == null) {
    return buildFailure(400, {
      error: "Legacy groupSlug is no longer accepted. Use sessionSlug instead."
    });
  }
  const apiToken = toStr(body?.apiToken || body?.token).trim();
  const workerName = toStr(body?.workerName).trim();
  const defaultSlug = normalizeSlug(env?.DEFAULT_SESSION_SLUG ?? env?.DEFAULT_GROUP_SLUG ?? "");
  const sessionSlug = body?.sessionSlug != null ? sessionSlugCheck.slug : defaultSlug;
  const displaySlug = sessionSlug || "general";
  const bundleText = typeof body?.bundleText === "string" ? body.bundleText : toStr(body?.bundleText);
  const hasBundleText = bundleText.trim() !== "";
  const bundleUrl = toStr(body?.bundleUrl || env?.WORKER_BUNDLE_URL).trim();
  if (!apiToken) return buildFailure(400, { error: "Missing apiToken." });
  if (!workerName) return buildFailure(400, { error: "Missing workerName." });
  if (!hasBundleText && !bundleUrl) {
    return buildFailure(400, {
      error: "Missing bundleText or bundleUrl (set WORKER_BUNDLE_URL or pass bundleUrl)."
    });
  }
  const accountLookup = await resolveDeploymentAccountId({
    body: {
      ...body,
      apiToken
    },
    fetchImpl
  });
  if (!accountLookup.ok) {
    return buildFailure(502, {
      error: accountLookup.error || "Failed to resolve Cloudflare account.",
      detail: accountLookup.detail
    }, {
      fallbackEligible: accountLookup.fallbackEligible === true
    });
  }
  const accountId = toStr(accountLookup.accountId).trim();
  if (!accountId) {
    return buildFailure(404, { error: "No accounts found for token." });
  }
  const registryAddress = toStr(body?.registryAddress).trim();
  const registryChainId = Number(body?.registryChainId || 0) || 0;
  const hatsAddress = toStr(body?.hatsAddress).trim();
  const adminHatId = toStr(body?.adminHatId).trim();
  const adminAddress = toStr(body?.adminAddress).trim();
  const rpcUrl = toStr(body?.rpcUrl).trim();
  const rpcUrlsByChainId = body?.rpcUrlsByChainId && typeof body.rpcUrlsByChainId === "object" ? body.rpcUrlsByChainId : {};
  const allowOriginsInput = Array.isArray(body?.allowOrigins) ? body.allowOrigins : [];
  const allowOrigins = normalizeAllowList(
    allowOriginsInput.length ? allowOriginsInput : [requestOrigin]
  );
  const limits = body?.limits || {};
  const scopes = body?.scopes || {};
  const faucetInput = body?.faucet && typeof body.faucet === "object" ? body.faucet : {};
  const faucet = {
    rpcUrl: toStr(faucetInput.rpcUrl).trim() || DEFAULT_FAUCET_RPC_URL,
    amountEth: toStr(faucetInput.amountEth).trim() || DEFAULT_FAUCET_AMOUNT_ETH,
    balanceThresholdEth: toStr(faucetInput.balanceThresholdEth).trim() || DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH
  };
  const embeddedDeployHelperEnabled = normalizeEmbeddedDeployHelperEnabled(
    body?.embeddedDeployHelperEnabled ?? body?.deployHelperEnabled,
    true
  );
  let bundleSource = hasBundleText ? bundleText : "";
  let bundleSourceKind = hasBundleText ? "bundleText" : "bundleUrl";
  if (!bundleSource) {
    let bundleResp;
    try {
      bundleResp = await fetchImpl(bundleUrl);
    } catch (err) {
      return buildFailure(502, {
        error: `Failed to fetch bundle: ${toStr(err?.message || err).trim() || "Unknown error."}`
      }, {
        fallbackEligible: true
      });
    }
    if (!bundleResp.ok) {
      return buildFailure(502, {
        error: `Failed to fetch bundle (${bundleResp.status}).`
      }, {
        fallbackEligible: bundleResp.status >= 500 || bundleResp.status === 429
      });
    }
    bundleSource = await bundleResp.text();
  }
  const bundleDiagnostics = await buildBundleDiagnostics(bundleSource, bundleSourceKind);
  consoleImpl?.log?.("[deploy-helper] bundle diagnostics", JSON.stringify({
    workerName,
    sessionSlug: displaySlug,
    diagnostics: {
      ...bundleDiagnostics,
      prefix: bundleDiagnostics.prefix,
      suffix: bundleDiagnostics.suffix
    }
  }));
  const kvCreate = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: `ContextEngineSessionCorsWorker:${displaySlug}` })
  }, { fetchImpl });
  if (!kvCreate.ok) {
    return buildFailure(502, {
      error: kvCreate.error,
      detail: kvCreate.detail
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(kvCreate)
    });
  }
  const kvId = kvCreate.data?.result?.id;
  if (!kvId) {
    return buildFailure(502, { error: "Failed to create KV namespace." }, { fallbackEligible: true });
  }
  const tokenSecret = randomSecret();
  const metadata = {
    main_module: "worker.mjs",
    bindings: [
      { name: "GROUP_KV", type: "kv_namespace", namespace_id: kvId },
      { name: "DEFAULT_SESSION_SLUG", type: "plain_text", text: sessionSlug },
      { name: "DEPLOY_HELPER_ENABLED", type: "plain_text", text: embeddedDeployHelperEnabled ? "1" : "0" }
    ],
    compatibility_date: toStr(env?.WORKER_COMPATIBILITY_DATE || DEFAULT_COMPAT_DATE),
    compatibility_flags: ["nodejs_compat"]
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json");
  form.append("worker.mjs", new Blob([bundleSource], { type: "application/javascript+module" }), "worker.mjs");
  const scriptUpload = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}`, {
    method: "PUT",
    body: form
  }, { fetchImpl });
  if (!scriptUpload.ok) {
    consoleImpl?.error?.("[deploy-helper] script upload failed", JSON.stringify({
      workerName,
      sessionSlug: displaySlug,
      error: scriptUpload.error,
      detail: scriptUpload.detail,
      diagnostics: bundleDiagnostics
    }));
    const bundleSummary = formatBundleDiagnostics(bundleDiagnostics);
    return buildFailure(502, {
      error: `${scriptUpload.error} Bundle diagnostics: ${bundleSummary}`,
      detail: scriptUpload.detail,
      bundleDiagnostics
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(scriptUpload)
    });
  }
  const secretResp = await cfFetch(apiToken, `/accounts/${accountId}/workers/scripts/${workerName}/secrets`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "TOKEN_HMAC_SECRET", type: "secret_text", text: tokenSecret })
  }, { fetchImpl });
  if (!secretResp.ok) {
    return buildFailure(502, {
      error: secretResp.error,
      detail: secretResp.detail
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(secretResp)
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
    embeddedDeployHelperEnabled
  };
  const blockLimits = sanitizeBlockLimits(body?.blockLimits);
  if (blockLimits) {
    config.blockLimits = blockLimits;
  }
  const sessionConfigKey = `session:${sessionSlug}:config`;
  const sessionSecretsKey = `session:${sessionSlug}:secrets`;
  const secrets = sanitizeSecrets(body?.secrets || {});
  const configPut = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionConfigKey}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config)
  }, { fetchImpl });
  if (!configPut.ok) {
    return buildFailure(502, {
      error: configPut.error,
      detail: configPut.detail
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(configPut)
    });
  }
  const secretsPut = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionSecretsKey}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(secrets)
  }, { fetchImpl });
  if (!secretsPut.ok) {
    return buildFailure(502, {
      error: secretsPut.error,
      detail: secretsPut.detail
    }, {
      fallbackEligible: shouldAllowFallbackForCloudflareFailure(secretsPut)
    });
  }
  const {
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    scriptSubdomainEnabled,
    scriptSubdomainError,
    workerUrl
  } = await ensureWorkersDevSubdomain({
    apiToken,
    accountId,
    workerName,
    requestedSubdomain: toStr(body?.subdomain || body?.workersSubdomain).trim(),
    fetchImpl
  });
  const deploymentPayload = {
    ok: true,
    workerUrl,
    resolvedSlug: displaySlug,
    kvNamespaceId: kvId,
    sessionConfigKey,
    sessionSecretsKey,
    sessionKvPrefix: "session",
    writesSessionConfig: true,
    writesSessionSecrets: true,
    tokenSecretSet: true,
    subdomain,
    subdomainStatus,
    subdomainEnabled,
    subdomainError,
    scriptSubdomainEnabled,
    scriptSubdomainError
  };
  if (workerUrl) {
    const configWithWorkerUrl = {
      ...config,
      corsWorkerUrl: workerUrl
    };
    const configUpdate = await cfFetch(apiToken, `/accounts/${accountId}/storage/kv/namespaces/${kvId}/values/${sessionConfigKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(configWithWorkerUrl)
    }, { fetchImpl });
    if (!configUpdate.ok) {
      return buildSuccess(207, {
        ...deploymentPayload,
        partial: true,
        configWriteError: configUpdate.error,
        configWriteStatus: configUpdate.status || 502,
        configWriteDetail: configUpdate.detail
      });
    }
  }
  return buildSuccess(200, deploymentPayload);
};

// workers/shared/deployHelperOrigins.mjs
var resolveDeployHelperAllowList = async (env) => {
  const kv = env?.DEPLOY_HELPER_KV;
  if (kv && typeof kv.get === "function") {
    const stored = await kv.get(DEPLOY_HELPER_ORIGINS_KEY);
    const storedOrigins = parseStoredAllowList(stored);
    if (storedOrigins.length) {
      return { origins: storedOrigins, source: "kv" };
    }
  }
  const envOrigins = parseAllowList(env?.ALLOWED_ORIGINS);
  if (envOrigins.length) {
    return { origins: envOrigins, source: "env" };
  }
  return { origins: normalizeOriginList(DEFAULT_ALLOWED_ORIGINS), source: "default" };
};
var resolveDeployHelperFallbackAllowList = (env) => {
  const envOrigins = parseAllowList(env?.ALLOWED_ORIGINS);
  if (envOrigins.length) return envOrigins;
  return normalizeOriginList(DEFAULT_ALLOWED_ORIGINS);
};

// workers/deploy-helper/worker.js
var isAdminAuthorized = (request, env) => {
  const adminSecret = toStr(env?.ADMIN_SECRET).trim();
  const authHeader = toStr(request.headers.get("Authorization")).trim();
  if (!adminSecret || !authHeader.startsWith("Bearer ")) return false;
  return authHeader.slice(7).trim() === adminSecret;
};
var originAllowed = (origin, allowList) => {
  if (!origin) return true;
  return allowList.includes(origin);
};
var corsHeaders = (origin, allowList) => new Headers({
  "Access-Control-Allow-Origin": origin && allowList.includes(origin) ? origin : "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
});
var json = (data, status, baseHeaders) => {
  const headers = new Headers(baseHeaders);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(data), { status, headers });
};
var worker_default = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowListInfo = await resolveDeployHelperAllowList(env);
    const url = new URL(request.url);
    const allowList = url.pathname === "/admin/origins" ? normalizeOriginList([...allowListInfo.origins, ...resolveDeployHelperFallbackAllowList(env)]) : allowListInfo.origins;
    const headers = corsHeaders(origin, allowList);
    if (request.method === "OPTIONS") {
      if (!originAllowed(origin, allowList)) {
        return json({ error: "Origin not allowed." }, 403, headers);
      }
      return new Response(null, { status: 204, headers });
    }
    if (!originAllowed(origin, allowList)) {
      return json({ error: "Origin not allowed." }, 403, headers);
    }
    if (url.pathname === "/admin/origins") {
      if (!isAdminAuthorized(request, env)) {
        return json({ error: "Admin authorization failed." }, 401, headers);
      }
      if (request.method === "GET") {
        return json(allowListInfo, 200, headers);
      }
      if (request.method === "POST") {
        if (!env?.DEPLOY_HELPER_KV || typeof env.DEPLOY_HELPER_KV.put !== "function" || typeof env.DEPLOY_HELPER_KV.delete !== "function") {
          return json({ error: "DEPLOY_HELPER_KV binding not configured." }, 500, headers);
        }
        let body2;
        try {
          body2 = await request.json();
        } catch {
          return json({ error: "Invalid JSON." }, 400, headers);
        }
        if (!Array.isArray(body2?.origins)) {
          return json({ error: "Invalid origins payload." }, 400, headers);
        }
        const nextOrigins = normalizeOriginList(body2.origins);
        if (nextOrigins.length) {
          await env.DEPLOY_HELPER_KV.put(DEPLOY_HELPER_ORIGINS_KEY, JSON.stringify(nextOrigins));
          return json({ origins: nextOrigins, source: "kv" }, 200, headers);
        }
        await env.DEPLOY_HELPER_KV.delete(DEPLOY_HELPER_ORIGINS_KEY);
        const fallbackAllowList = await resolveDeployHelperAllowList(env);
        return json(fallbackAllowList, 200, headers);
      }
      return json({ error: "Not found." }, 404, headers);
    }
    if (url.pathname === "/account" && request.method === "POST") {
      let body2;
      try {
        body2 = await request.json();
      } catch {
        return json({ error: "Invalid JSON." }, 400, headers);
      }
      const apiToken = toStr(body2?.apiToken || body2?.token).trim();
      if (!apiToken) return json({ error: "Missing apiToken." }, 400, headers);
      const accountLookup = await lookupCloudflareAccount({ apiToken });
      if (!accountLookup.ok) {
        return json({
          error: accountLookup.error,
          detail: accountLookup.detail
        }, 502, headers);
      }
      return json({
        accountId: accountLookup.accountId,
        accountName: accountLookup.accountName
      }, 200, headers);
    }
    if (url.pathname !== "/deploy" || request.method !== "POST") {
      return json({ error: "Not found." }, 404, headers);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON." }, 400, headers);
    }
    const deployResult = await executeDeployHelperRequest({
      body,
      env,
      requestOrigin: origin,
      consoleImpl: console
    });
    return json(deployResult.body, deployResult.status, headers);
  }
};
export {
  worker_default as default
};
