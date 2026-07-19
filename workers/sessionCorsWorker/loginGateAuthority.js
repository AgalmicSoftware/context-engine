import { resolveRegistryChainId } from './chainIdNormalization.js';
import { isSessionSecretRpcUrlForGateRuntime } from './gateRpcResolution.js';
import { PRIVATE_SESSION_RPC_LABEL } from './rpcDiagnosticSafety.js';
import { toTrimmedString } from './stringCoercion.js';

const maskRpcUrlList = (rpcUrls, deps) => {
  const maskRpcUrl = typeof deps?.maskRpcUrl === 'function'
    ? deps.maskRpcUrl
    : (value) => toTrimmedString(value, deps);
  return (Array.isArray(rpcUrls) ? rpcUrls : []).map(maskRpcUrl);
};

const maskGateRpcUrl = ({ config, gateChainId, rpcUrl, deps }) => {
  if (isSessionSecretRpcUrlForGateRuntime({ config, gateChainId, rpcUrl })) {
    return PRIVATE_SESSION_RPC_LABEL;
  }
  const maskRpcUrl = typeof deps?.maskRpcUrl === 'function'
    ? deps.maskRpcUrl
    : (value) => toTrimmedString(value, deps);
  return maskRpcUrl(rpcUrl);
};

const maskGateRpcUrlList = ({ config, gateChainId, rpcUrls, deps }) => (
  (Array.isArray(rpcUrls) ? rpcUrls : []).map((rpcUrl) => maskGateRpcUrl({
    config,
    gateChainId,
    rpcUrl,
    deps,
  }))
);

export const resolveLoginGateAuthority = async ({
  address,
  config,
  registryAddress,
  registryRpcUrls,
  registrySlug,
  sessionCheck,
  resourceKeys,
  deps,
} = {}) => {
  const keys = Array.isArray(resourceKeys) ? resourceKeys : [];
  const readResourceGateOnChain = typeof deps?.readResourceGateOnChain === 'function'
    ? deps.readResourceGateOnChain
    : async () => ({ ok: false, error: 'readResourceGateOnChain unavailable.', errors: [] });
  const resolveRpcUrlListForGate = typeof deps?.resolveRpcUrlListForGate === 'function'
    ? deps.resolveRpcUrlListForGate
    : () => [];
  const checkSbtGate = typeof deps?.checkSbtGate === 'function'
    ? deps.checkSbtGate
    : async () => false;
  const probeRpcUrls = typeof deps?.probeRpcUrls === 'function'
    ? deps.probeRpcUrls
    : async () => {};
  const readRegistryCodeOnChain = typeof deps?.readRegistryCodeOnChain === 'function'
    ? deps.readRegistryCodeOnChain
    : async () => ({ size: null, rpcUrl: '', errors: [], error: null });
  const maskRpcUrl = typeof deps?.maskRpcUrl === 'function'
    ? deps.maskRpcUrl
    : (value) => toTrimmedString(value, deps);
  const log = typeof deps?.log === 'function' ? deps.log : () => {};
  const warn = (
    (typeof deps?.log?.warn === 'function' ? deps.log.warn : null) ||
    (typeof deps?.warn === 'function' ? deps.warn : null) ||
    (typeof deps?.log === 'function' ? deps.log : null) ||
    console.warn
  );

  const gateResults = {};
  const registryChainId = resolveRegistryChainId(config);
  let didProbeRegistryRpc = false;
  let didCheckRegistryCode = false;
  const chainAttestationCache = deps?.chainAttestationCache instanceof Map
    ? deps.chainAttestationCache
    : new Map();

  for (const key of keys) {
    let gate = null;
    const gateSource = 'onchain';
    let gateLookupFailed = false;
    let gateLookupError = '';
    let registryRpcUrlUsed = '';
    let registryRpcErrors = [];

    const gateRead = await readResourceGateOnChain({
      registryAddress,
      registryRpcUrls,
      registrySlug,
      resourceKey: key,
      expectedChainId: registryChainId,
      chainAttestationCache,
    });
    if (gateRead.ok) {
      registryRpcUrlUsed = gateRead.rpcUrl;
      registryRpcErrors = gateRead.errors || [];
      gate = gateRead.gate;
    } else {
      gateLookupFailed = true;
      gateLookupError = toTrimmedString(gateRead.error || 'Registry gate lookup failed.', deps);
      registryRpcErrors = gateRead.errors || registryRpcErrors;
    }

    if (!gate) {
      gateResults[key] = false;
      if (key === 'default') {
        warn('[gating] default gate lookup failed', {
          slug: registrySlug,
          address,
          registryAddress,
          registryRpcUrls: maskRpcUrlList(registryRpcUrls, deps),
          registryRpcErrors,
          error: gateLookupError || 'on-chain gate lookup unavailable',
          gateLookupFailed,
          onChainAuthoritative: sessionCheck?.exists === true,
        });
        if (!didProbeRegistryRpc) {
          didProbeRegistryRpc = true;
          await probeRpcUrls({ rpcUrls: registryRpcUrls, label: 'registry' });
        }
        warn('[gating] sessionExists probe', {
          slug: registrySlug,
          exists: sessionCheck?.exists,
          rpcUrl: sessionCheck?.rpcUrl ? maskRpcUrl(sessionCheck.rpcUrl) : '',
          errors: sessionCheck?.errors || [],
          error: sessionCheck?.error ? toTrimmedString(sessionCheck.error?.message || sessionCheck.error, deps) : '',
        });
        if (!didCheckRegistryCode) {
          didCheckRegistryCode = true;
          const codeCheck = await readRegistryCodeOnChain({
            registryAddress,
            registryRpcUrls,
            expectedChainId: registryChainId,
            chainAttestationCache,
          });
          warn('[gating] registry code probe', {
            slug: registrySlug,
            bytecodeSize: codeCheck.size,
            rpcUrl: codeCheck.rpcUrl ? maskRpcUrl(codeCheck.rpcUrl) : '',
            errors: codeCheck.errors || [],
            error: codeCheck.error ? toTrimmedString(codeCheck.error?.message || codeCheck.error, deps) : '',
          });
        }
      }
      continue;
    }

    if (gate.sbtAddresses.length === 0) {
      gateResults[key] = true;
      if (key === 'default') {
        log(`[gating] default gate empty (allow) [${gateSource}]`, {
          slug: registrySlug,
          address,
          gateChainId: gate.chainId || null,
          registryAddress,
          registryRpcUrl: registryRpcUrlUsed ? maskRpcUrl(registryRpcUrlUsed) : '',
        });
      }
      continue;
    }

    const rpcUrls = resolveRpcUrlListForGate(config, gate.chainId);
    if (!rpcUrls.length && key === 'default') {
      warn('[gating] default gate missing rpc url', {
        slug: registrySlug,
        address,
        gateChainId: gate.chainId || null,
        registryChainId,
        registryAddress,
        registryRpcUrls: maskRpcUrlList(registryRpcUrls, deps),
        source: gateSource,
      });
    }

    let ok = false;
    let rpcUrlUsed = '';
    for (const rpcUrl of rpcUrls) {
      const candidate = await checkSbtGate({
        sbtAddresses: gate.sbtAddresses,
        address,
        rpcUrl,
        mode: gate.mode,
        chainId: gate.chainId,
        rpcUrlIsPrivate: isSessionSecretRpcUrlForGateRuntime({
          config,
          gateChainId: gate.chainId,
          rpcUrl,
        }),
        chainAttestationCache,
      });
      if (candidate) {
        ok = true;
        rpcUrlUsed = rpcUrl;
        break;
      }
    }

    gateResults[key] = ok;
    if (key === 'default') {
      (ok ? log : warn)(`[gating] default gate check ${ok ? 'ok' : 'failed'} [${gateSource}]`, {
        slug: registrySlug,
        address,
        gateChainId: gate.chainId || null,
        mode: gate.mode,
        sbtCount: gate.sbtAddresses.length,
        sbtAddresses: gate.sbtAddresses,
        rpcUrl: rpcUrlUsed ? maskGateRpcUrl({
          config,
          gateChainId: gate.chainId,
          rpcUrl: rpcUrlUsed,
          deps,
        }) : '',
        rpcUrls: maskGateRpcUrlList({
          config,
          gateChainId: gate.chainId,
          rpcUrls,
          deps,
        }),
        registryChainId,
      });
    }
  }

  return gateResults;
};
