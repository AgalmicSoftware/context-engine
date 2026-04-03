import { toTrimmedString } from './stringCoercion.js';

const RESOURCE_GATE_KEYS_FALLBACK = ['default', 'ai', 'arweave', 'txGas', 'rpc', 'lit'];
const ZERO_BYTES32_FALLBACK = `0x${'0'.repeat(64)}`;

const normalizeAddressLower = (value, deps) => {
  const raw = toTrimmedString(value, deps);
  const isAddress = typeof deps?.isAddress === 'function' ? deps.isAddress : () => false;
  return isAddress(raw) ? raw.toLowerCase() : '';
};

export const createFaucetGateAuthorityWithDeps = ({
  deps,
  constants,
} = {}) => {
  const findSessionGateForSbt = async ({
    slug,
    config,
    sbtAddress,
  } = {}) => {
    const isAddress = typeof deps?.isAddress === 'function' ? deps.isAddress : () => false;
    const resolveRegistryRpcUrls = typeof deps?.resolveRegistryRpcUrls === 'function'
      ? deps.resolveRegistryRpcUrls
      : () => [];
    const normalizeLower = typeof deps?.normalizeAddressLower === 'function'
      ? deps.normalizeAddressLower
      : (value) => normalizeAddressLower(value, deps);
    const toRegistrySessionSlug = typeof deps?.toRegistrySessionSlug === 'function'
      ? deps.toRegistrySessionSlug
      : (value) => toTrimmedString(value, deps) || 'general';
    const readSessionExistsOnChain = typeof deps?.readSessionExistsOnChain === 'function'
      ? deps.readSessionExistsOnChain
      : async () => ({ exists: null, errors: [], error: null });
    const maskRpcUrl = typeof deps?.maskRpcUrl === 'function'
      ? deps.maskRpcUrl
      : (value) => toTrimmedString(value, deps);
    const readResourceGateOnChain = typeof deps?.readResourceGateOnChain === 'function'
      ? deps.readResourceGateOnChain
      : async () => ({ ok: false, error: 'Registry gate lookup failed.', errors: [] });

    const anonymousGateUnavailableError = toTrimmedString(constants?.anonymousGateUnavailableError, deps)
      || 'Access denied: on-chain gate data unavailable.';
    const resourceGateKeys = Array.isArray(constants?.resourceGateKeys) && constants.resourceGateKeys.length
      ? constants.resourceGateKeys
      : RESOURCE_GATE_KEYS_FALLBACK;

    const registryAddress = toTrimmedString(config?.registryAddress, deps);
    const registryRpcUrls = resolveRegistryRpcUrls(config);
    if (!isAddress(registryAddress) || !registryRpcUrls.length) {
      return {
        ok: false,
        status: 403,
        error: anonymousGateUnavailableError,
        reason: 'registry-unavailable',
      };
    }

    const normalizedSbt = normalizeLower(sbtAddress);
    if (!normalizedSbt) {
      return { ok: false, status: 400, error: 'Invalid sbtAddress.' };
    }

    const registrySlug = toRegistrySessionSlug(slug);
    const sessionCheck = await readSessionExistsOnChain({ registryAddress, registryRpcUrls, registrySlug });
    if (sessionCheck.exists !== true) {
      return {
        ok: false,
        status: 403,
        error: anonymousGateUnavailableError,
        reason: sessionCheck.exists === false ? 'session-not-registered' : 'session-check-unavailable',
        details: {
          registryAddress,
          rpcUrl: sessionCheck.rpcUrl ? maskRpcUrl(sessionCheck.rpcUrl) : '',
          errors: sessionCheck.errors || [],
        },
      };
    }

    // TODO(PRD-137): Confirm whether faucet eligibility should require `txGas`
    // specifically or any on-chain session gate containing the requested SBT.
    // Until that is clarified, prefer `txGas` first and then fall back to the
    // other worker-known resource gates so we only fund SBTs explicitly wired
    // into the session's on-chain gate configuration.
    const gateKeys = ['txGas', ...resourceGateKeys.filter((key) => key !== 'txGas')];
    const failures = [];
    for (const resourceKey of gateKeys) {
      const gateResult = await readResourceGateOnChain({
        registryAddress,
        registryRpcUrls,
        registrySlug,
        resourceKey,
      });
      if (!gateResult.ok) {
        failures.push({
          resourceKey,
          error: gateResult.error || 'Registry gate lookup failed.',
          rpcErrors: gateResult.errors || [],
        });
        continue;
      }

      const gateAddresses = Array.isArray(gateResult.gate?.sbtAddresses)
        ? gateResult.gate.sbtAddresses
            .map((addr) => normalizeLower(addr))
            .filter(Boolean)
        : [];
      if (gateAddresses.includes(normalizedSbt)) {
        return {
          ok: true,
          resourceKey,
          gate: gateResult.gate,
        };
      }
    }

    if (failures.length) {
      return {
        ok: false,
        status: 403,
        error: anonymousGateUnavailableError,
        reason: 'gate-lookup-unavailable',
        details: { failures },
      };
    }

    return {
      ok: false,
      status: 403,
      error: 'Requested SBT is not part of a session gate.',
      reason: 'sbt-not-gated',
    };
  };

  const readSbtFaucetValidationState = async ({
    config,
    gateChainId,
    sbtAddress,
  } = {}) => {
    const resolveRpcUrlListForGate = typeof deps?.resolveRpcUrlListForGate === 'function'
      ? deps.resolveRpcUrlListForGate
      : () => [];
    const toChainId = typeof deps?.toChainId === 'function' ? deps.toChainId : () => 0;
    const getFaucetSbtGateInterface = deps?.getFaucetSbtGateInterface;
    const callContractFunction = deps?.callContractFunction;
    const maskRpcUrl = typeof deps?.maskRpcUrl === 'function'
      ? deps.maskRpcUrl
      : (value) => toTrimmedString(value, deps);
    const zeroBytes32 = toTrimmedString(constants?.zeroBytes32, deps) || ZERO_BYTES32_FALLBACK;

    const rpcUrls = resolveRpcUrlListForGate(config, gateChainId);
    if (!rpcUrls.length) {
      return {
        ok: false,
        error: `Missing RPC URL for chainId ${toChainId(gateChainId) || 'unknown'}.`,
        errors: [],
      };
    }

    const iface = getFaucetSbtGateInterface();
    let lastError = null;
    const errors = [];
    for (const rpcUrl of rpcUrls) {
      try {
        const [passwordMintDecoded, groupHashDecoded] = await Promise.all([
          callContractFunction({
            rpcUrl,
            contractAddress: sbtAddress,
            iface,
            method: 'hasPasswordMint',
            args: [],
          }),
          callContractFunction({
            rpcUrl,
            contractAddress: sbtAddress,
            iface,
            method: 'groupPasswordHash',
            args: [],
          }),
        ]);
        const hasPasswordMint = !!(Array.isArray(passwordMintDecoded) ? passwordMintDecoded[0] : passwordMintDecoded);
        const groupPasswordHashRaw = Array.isArray(groupHashDecoded) ? groupHashDecoded[0] : groupHashDecoded;
        const groupPasswordHash = toTrimmedString(groupPasswordHashRaw || zeroBytes32, deps) || zeroBytes32;
        return {
          ok: true,
          rpcUrl,
          hasPasswordMint,
          groupPasswordHash,
        };
      } catch (err) {
        lastError = err;
        errors.push({
          rpcUrl: maskRpcUrl(rpcUrl),
          status: err?.rpcStatus ?? null,
          error: toTrimmedString(err?.message || err, deps),
          rpcError: err?.rpcError || null,
        });
      }
    }

    return {
      ok: false,
      error: toTrimmedString(lastError?.message || lastError || 'SBT gate validation failed.', deps),
      errors,
    };
  };

  const validateSbtPasswordForFaucet = async ({
    config,
    gateChainId,
    sbtAddress,
    hashedPassword,
  } = {}) => {
    const resolveRpcUrlListForGate = typeof deps?.resolveRpcUrlListForGate === 'function'
      ? deps.resolveRpcUrlListForGate
      : () => [];
    const toChainId = typeof deps?.toChainId === 'function' ? deps.toChainId : () => 0;
    const getFaucetSbtGateInterface = deps?.getFaucetSbtGateInterface;
    const callContractFunction = deps?.callContractFunction;
    const maskRpcUrl = typeof deps?.maskRpcUrl === 'function'
      ? deps.maskRpcUrl
      : (value) => toTrimmedString(value, deps);

    const rpcUrls = resolveRpcUrlListForGate(config, gateChainId);
    if (!rpcUrls.length) {
      return {
        ok: false,
        error: `Missing RPC URL for chainId ${toChainId(gateChainId) || 'unknown'}.`,
        errors: [],
      };
    }

    const iface = getFaucetSbtGateInterface();
    let lastError = null;
    const errors = [];
    for (const rpcUrl of rpcUrls) {
      try {
        const decoded = await callContractFunction({
          rpcUrl,
          contractAddress: sbtAddress,
          iface,
          method: 'isPasswordValid',
          args: [hashedPassword],
        });
        const isValid = !!(Array.isArray(decoded) ? decoded[0] : decoded);
        return { ok: true, rpcUrl, isValid };
      } catch (err) {
        lastError = err;
        errors.push({
          rpcUrl: maskRpcUrl(rpcUrl),
          status: err?.rpcStatus ?? null,
          error: toTrimmedString(err?.message || err, deps),
          rpcError: err?.rpcError || null,
        });
      }
    }

    return {
      ok: false,
      error: toTrimmedString(lastError?.message || lastError || 'SBT password validation failed.', deps),
      errors,
    };
  };

  return {
    findSessionGateForSbt,
    readSbtFaucetValidationState,
    validateSbtPasswordForFaucet,
  };
};
