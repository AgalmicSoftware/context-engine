import {
  resolveChainIdWithLegacyFallback,
  toChainId as defaultToChainId,
} from './chainIdNormalization.js';
import { toTrimmedString } from './stringCoercion.js';

const toComparableBigInt = (value, deps) => {
  if (typeof deps?.toBigInt === 'function') return deps.toBigInt(value);
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string') {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  if (value && typeof value.toString === 'function') {
    try {
      return BigInt(value.toString());
    } catch {
      return 0n;
    }
  }
  return 0n;
};

export const normalizeFaucetRequest = ({
  payload,
  config,
  secrets,
  deps,
  defaults,
} = {}) => {
  const isAddress = typeof deps?.isAddress === 'function' ? deps.isAddress : () => false;
  const toChainId = typeof deps?.toChainId === 'function'
    ? deps.toChainId
    : defaultToChainId;
  const parseEther = typeof deps?.parseEther === 'function'
    ? deps.parseEther
    : () => {
      throw new Error('parseEther unavailable');
    };
  const resolveFaucetRpcUrls = typeof deps?.resolveFaucetRpcUrls === 'function'
    ? deps.resolveFaucetRpcUrls
    : () => [];
  const maskRpcUrl = typeof deps?.maskRpcUrl === 'function'
    ? deps.maskRpcUrl
    : (value) => toTrimmedString(value, deps);

  const to = toTrimmedString(payload?.to || payload?.recipient || payload?.address, deps);
  if (!to) {
    return {
      ok: false,
      status: 400,
      error: 'Missing address',
      normalized: null,
      logContext: null,
    };
  }
  if (!isAddress(to)) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid address',
      normalized: null,
      logContext: null,
    };
  }

  const faucetCfg = config?.faucet && typeof config.faucet === 'object' ? config.faucet : {};
  const rpcUrls = resolveFaucetRpcUrls(config, faucetCfg);
  const primaryRpc = rpcUrls[0] || toTrimmedString(defaults?.defaultRpcUrl, deps);
  const rpcMasked = maskRpcUrl(primaryRpc);
  const rpcUrlsMasked = rpcUrls.map(maskRpcUrl);
  const registryChainId = toChainId(config?.registryChainId);
  const networkChainId = toChainId(config?.networkChainId);
  const faucetChainId = toChainId(faucetCfg?.chainId);
  const expectedChainId = resolveChainIdWithLegacyFallback(
    faucetCfg?.chainId,
    resolveChainIdWithLegacyFallback(
      config?.networkChainId,
      resolveChainIdWithLegacyFallback(config?.registryChainId, 0),
    ),
  );
  const configuredAmount = toTrimmedString(
    faucetCfg.amountEth || defaults?.defaultAmountEth,
    deps
  );

  let amountEth = configuredAmount;
  const requestedAmount = toTrimmedString(payload?.amountEth || payload?.amount, deps);
  if (requestedAmount) {
    try {
      const requestedWei = parseEther(requestedAmount);
      const configuredWei = parseEther(configuredAmount);
      if (
        toComparableBigInt(requestedWei, deps) > 0n &&
        toComparableBigInt(requestedWei, deps) <= toComparableBigInt(configuredWei, deps)
      ) {
        amountEth = requestedAmount;
      }
    } catch {
      // Ignore malformed override and fall back to the configured amount.
    }
  }

  const thresholdEth = toTrimmedString(
    faucetCfg.balanceThresholdEth || defaults?.defaultThresholdEth,
    deps
  );

  const logContext = {
    to,
    rpcUrl: rpcMasked,
    rpcUrls: rpcUrlsMasked,
    registryChainId,
    networkChainId,
    faucetChainId,
    expectedChainId,
    amountEth,
    thresholdEth,
  };

  const privateKey = toTrimmedString(secrets?.faucetPrivateKey, deps);
  if (!privateKey) {
    return {
      ok: false,
      status: 401,
      error: 'Server misconfigured: faucetPrivateKey is missing.',
      normalized: null,
      logContext,
    };
  }

  let thresholdWei;
  try {
    thresholdWei = parseEther(thresholdEth);
  } catch {
    return {
      ok: false,
      status: 500,
      error: 'Invalid faucet balance threshold (expected ETH string).',
      normalized: null,
      logContext,
    };
  }

  let amountWei;
  try {
    amountWei = parseEther(amountEth);
  } catch {
    return {
      ok: false,
      status: 500,
      error: 'Invalid faucet amount (expected ETH string).',
      normalized: null,
      logContext,
    };
  }

  return {
    ok: true,
    status: 200,
    error: '',
    logContext,
    normalized: {
      to,
      faucetCfg,
      rpcUrls,
      primaryRpc,
      rpcMasked,
      rpcUrlsMasked,
      registryChainId,
      networkChainId,
      faucetChainId,
      expectedChainId,
      configuredAmount,
      amountEth,
      amountWei,
      thresholdEth,
      thresholdWei,
      privateKey,
    },
  };
};
