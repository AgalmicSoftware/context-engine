import {
  validateFaucetEligibilityRequest as validateFaucetEligibilityRequestBoundary,
} from './faucetEligibilityValidation.js';
import {
  normalizeFaucetRequest as normalizeFaucetRequestBoundary,
} from './faucetRequestNormalization.js';
import {
  json as jsonResponse,
} from './responseKvHelpers.js';

const DEFAULT_GAS_PRICE_HEX = '0x3b9aca00';
const DEFAULT_ACCESS_DENIED_ERROR = 'Access denied.';

const toTrimmedString = (value, deps) => (
  deps?.toStr
    ? deps.toStr(value).trim()
    : (typeof value === 'string' ? value : value == null ? '' : String(value)).trim()
);

const resolveJson = (deps) => deps?.json || jsonResponse;
const resolveLog = (deps) => (typeof deps?.log === 'function' ? deps.log : () => {});
const resolveWarn = (deps) => (
  (typeof deps?.log?.warn === 'function' ? deps.log.warn : null) ||
  (typeof deps?.warn === 'function' ? deps.warn : null) ||
  (typeof deps?.log === 'function' ? deps.log : null) ||
  console.warn
);
const resolveError = (deps) => (
  (typeof deps?.log?.error === 'function' ? deps.log.error : null) ||
  (typeof deps?.error === 'function' ? deps.error : null) ||
  (typeof deps?.log === 'function' ? deps.log : null) ||
  console.error
);

export const faucet = async ({
  payload,
  secrets,
  config,
  baseHeaders,
  slug,
  requesterAddress = '',
  tokenHasFaucetScope = false,
  deps,
  constants,
  defaults,
} = {}) => {
  const json = resolveJson(deps);
  const log = resolveLog(deps);
  const warn = resolveWarn(deps);
  const error = resolveError(deps);
  const normalizeFaucetRequest = (
    deps?.normalizeFaucetRequest || normalizeFaucetRequestBoundary
  );
  const validateFaucetEligibilityRequest = (
    deps?.validateFaucetEligibilityRequest || validateFaucetEligibilityRequestBoundary
  );

  const normalizedFaucet = normalizeFaucetRequest({
    payload,
    config,
    secrets,
    deps: {
      toStr: deps?.toStr,
      toChainId: deps?.toChainId,
      toBigInt: deps?.toBigInt,
      isAddress: deps?.isAddress,
      parseEther: deps?.parseEther,
      resolveFaucetRpcUrls: deps?.resolveFaucetRpcUrls,
      maskRpcUrl: deps?.maskRpcUrl,
    },
    defaults,
  });
  if (normalizedFaucet?.logContext) {
    log('[faucet] request', normalizedFaucet.logContext);
  }
  if (!normalizedFaucet?.ok) {
    return json(
      { error: normalizedFaucet?.error },
      normalizedFaucet?.status || 400,
      baseHeaders,
    );
  }

  const {
    to,
    rpcUrls,
    rpcMasked,
    amountEth,
    amountWei,
    thresholdEth,
    thresholdWei,
    privateKey,
    registryChainId,
    networkChainId,
    faucetChainId,
    expectedChainId,
  } = normalizedFaucet.normalized || {};

  const faucetEligibility = await validateFaucetEligibilityRequest({
    payload,
    config,
    slug,
    requesterAddress,
    tokenHasFaucetScope,
    deps: {
      toStr: deps?.toStr,
      isAddress: deps?.isAddress,
      isBytes32Hex: deps?.isBytes32Hex,
      normalizeAddressLower: deps?.normalizeAddressLower,
      resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
      toRegistrySessionSlug: deps?.toRegistrySessionSlug,
      readSessionExistsOnChain: deps?.readSessionExistsOnChain,
      readResourceGateOnChain: deps?.readResourceGateOnChain,
      resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
      checkSbtGate: deps?.checkSbtGate,
      maskRpcUrl: deps?.maskRpcUrl,
      findSessionGateForSbt: deps?.findSessionGateForSbt,
      readSbtFaucetValidationState: deps?.readSbtFaucetValidationState,
      validateSbtPasswordForFaucet: deps?.validateSbtPasswordForFaucet,
      verifyGroupSignatureForFaucet: deps?.verifyGroupSignatureForFaucet,
    },
    constants: {
      anonymousGateUnavailableError: constants?.anonymousGateUnavailableError,
      zeroBytes32: constants?.zeroBytes32,
    },
  });
  if (!faucetEligibility?.ok) {
    return json(
      {
        error: faucetEligibility?.error || DEFAULT_ACCESS_DENIED_ERROR,
        reason: faucetEligibility?.reason || '',
        details: faucetEligibility?.details || null,
      },
      faucetEligibility?.status || 403,
      baseHeaders,
    );
  }

  const Wallet = deps?.Wallet;
  const rpcRequest = deps?.rpcRequest;
  const toBigInt = deps?.toBigInt;
  const formatEther = deps?.formatEther;
  const maskRpcUrl = deps?.maskRpcUrl;

  const errors = [];
  const wallet = new Wallet(privateKey);
  const fromAddress = wallet.address;
  const thresholdWeiBig = toBigInt(thresholdWei);

  for (const rpc of rpcUrls || []) {
    const masked = maskRpcUrl(rpc);
    let chainId = 0;
    try {
      const chainHex = await rpcRequest({ rpcUrl: rpc, method: 'eth_chainId', params: [] });
      chainId = deps?.toChainId?.(chainHex) || 0;
    } catch (err) {
      errors.push({ rpcUrl: masked, error: err?.message || 'Failed to resolve chain id.' });
      continue;
    }

    if (expectedChainId && chainId && chainId !== expectedChainId) {
      warn('[faucet] chainId mismatch', {
        rpcUrl: masked,
        rpcChainId: chainId,
        registryChainId,
        networkChainId,
        faucetChainId,
      });
      errors.push({
        rpcUrl: masked,
        chainId,
        error: `RPC chainId ${chainId} != expected ${expectedChainId}`,
      });
      continue;
    }

    let currentBalanceWei = 0n;
    try {
      const balanceHex = await rpcRequest({
        rpcUrl: rpc,
        method: 'eth_getBalance',
        params: [to, 'latest'],
      });
      currentBalanceWei = toBigInt(balanceHex);
    } catch (err) {
      errors.push({ rpcUrl: masked, chainId, error: err?.message || 'Failed to fetch balance.' });
      continue;
    }

    if (currentBalanceWei > thresholdWeiBig) {
      return json(
        {
          error: `Balance above threshold (${thresholdEth} ETH).`,
          balanceEth: formatEther(currentBalanceWei.toString()),
          thresholdEth,
          rpcUrl: masked,
          chainId,
        },
        403,
        baseHeaders,
      );
    }

    let nonceHex = '0x0';
    try {
      nonceHex = await rpcRequest({
        rpcUrl: rpc,
        method: 'eth_getTransactionCount',
        params: [fromAddress, 'pending'],
      });
    } catch (err) {
      errors.push({
        rpcUrl: masked,
        chainId,
        error: err?.message || 'Failed to fetch faucet nonce.',
      });
      continue;
    }

    let gasPriceHex = DEFAULT_GAS_PRICE_HEX;
    try {
      gasPriceHex = await rpcRequest({ rpcUrl: rpc, method: 'eth_gasPrice', params: [] });
    } catch (_) {
      gasPriceHex = DEFAULT_GAS_PRICE_HEX;
    }

    const txRequest = {
      to,
      value: amountWei,
      nonce: nonceHex,
      gasLimit: '0x5208',
      ...(gasPriceHex ? { gasPrice: gasPriceHex } : {}),
      ...(chainId ? { chainId } : {}),
    };

    let signedTx = '';
    try {
      signedTx = await wallet.signTransaction(txRequest);
    } catch (err) {
      errors.push({
        rpcUrl: masked,
        chainId,
        error: err?.message || 'Failed to sign faucet transaction.',
      });
      continue;
    }

    try {
      const txHash = await rpcRequest({
        rpcUrl: rpc,
        method: 'eth_sendRawTransaction',
        params: [signedTx],
      });
      return json(
        {
          txHash,
          status: null,
          to,
          amountEth,
          chainId: chainId || null,
          rpcUrl: masked,
        },
        200,
        baseHeaders,
      );
    } catch (err) {
      error('[faucet] send failed', {
        rpcUrl: masked,
        rpcChainId: chainId,
        registryChainId,
        networkChainId,
        faucetChainId,
        error: toTrimmedString(err?.message || err, deps),
      });
      errors.push({
        rpcUrl: masked,
        chainId,
        error: err?.message || 'Failed to send faucet transaction.',
      });
    }
  }

  return json(
    {
      error: errors[errors.length - 1]?.error || 'Faucet transfer failed.',
      rpcUrl: rpcMasked,
      chainId: expectedChainId || null,
      registryChainId,
      networkChainId,
      faucetChainId,
      attempts: errors,
    },
    502,
    baseHeaders,
  );
};
