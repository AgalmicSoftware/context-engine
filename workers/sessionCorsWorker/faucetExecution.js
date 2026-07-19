import {
  validateFaucetEligibilityRequest as validateFaucetEligibilityRequestBoundary,
} from './faucetEligibilityValidation.js';
import {
  normalizeFaucetRequest as normalizeFaucetRequestBoundary,
} from './faucetRequestNormalization.js';
import {
  json as jsonResponse,
} from './responseKvHelpers.js';
import {
  attachSessionSecretRpcForGateRuntime,
  resolveSessionSecretRpcUrlListForGateRuntime,
} from './gateRpcResolution.js';
import {
  buildSafeRpcFailure,
  createRpcDiagnosticMasker,
  sanitizeRpcFailureDetails,
} from './rpcDiagnosticSafety.js';

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
  const runtimeConfig = attachSessionSecretRpcForGateRuntime({ config, secrets });
  const privateRpcUrls = [
    secrets?.customRpcUrl,
    ...resolveSessionSecretRpcUrlListForGateRuntime({
      config: runtimeConfig,
      gateChainId: runtimeConfig?.networkChainId,
    }),
  ];
  const maskRpcUrl = createRpcDiagnosticMasker({
    privateRpcUrls,
    maskRpcUrl: deps?.maskRpcUrl,
  });

  const normalizedFaucet = normalizeFaucetRequest({
    payload,
    config: runtimeConfig,
    secrets,
    deps: {
      toStr: deps?.toStr,
      toChainId: deps?.toChainId,
      toBigInt: deps?.toBigInt,
      isAddress: deps?.isAddress,
      parseEther: deps?.parseEther,
      resolveFaucetRpcUrls: deps?.resolveFaucetRpcUrls,
      maskRpcUrl,
    },
    defaults,
  });
  if (normalizedFaucet?.logContext) {
    const normalizedRpcUrls = Array.isArray(normalizedFaucet?.normalized?.rpcUrls)
      ? normalizedFaucet.normalized.rpcUrls
      : [];
    const logContext = { ...normalizedFaucet.logContext };
    if (normalizedRpcUrls.length) {
      logContext.rpcUrl = maskRpcUrl(normalizedRpcUrls[0]);
      logContext.rpcUrls = normalizedRpcUrls.map((rpcUrl) => maskRpcUrl(rpcUrl));
    } else {
      if (/^https?:\/\//i.test(toTrimmedString(logContext.rpcUrl, deps))) {
        logContext.rpcUrl = maskRpcUrl(logContext.rpcUrl);
      }
      if (Array.isArray(logContext.rpcUrls)) {
        logContext.rpcUrls = logContext.rpcUrls.map((rpcUrl) => (
          /^https?:\/\//i.test(toTrimmedString(rpcUrl, deps)) ? maskRpcUrl(rpcUrl) : rpcUrl
        ));
      }
    }
    log('[faucet] request', logContext);
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

  if (!expectedChainId) {
    return json(
      { error: 'Invalid faucet chain configuration.' },
      500,
      baseHeaders,
    );
  }

  const faucetEligibility = await validateFaucetEligibilityRequest({
    payload,
    config: runtimeConfig,
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
      maskRpcUrl,
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
    const safeDetails = sanitizeRpcFailureDetails(faucetEligibility?.details, {
      maskRpcUrl,
      privateRpcUrls,
      errorLabel: 'Faucet eligibility RPC request failed.',
    });
    return json(
      {
        error: faucetEligibility?.error || DEFAULT_ACCESS_DENIED_ERROR,
        reason: faucetEligibility?.reason || '',
        details: Array.isArray(faucetEligibility?.details) ? safeDetails : null,
      },
      faucetEligibility?.status || 403,
      baseHeaders,
    );
  }

  const Wallet = deps?.Wallet;
  const rpcRequest = deps?.rpcRequest;
  const toBigInt = deps?.toBigInt;
  const formatEther = deps?.formatEther;
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
      const failure = buildSafeRpcFailure({
        rpcUrl: rpc,
        error: err,
        errorLabel: 'RPC chain check failed.',
        maskRpcUrl,
        privateRpcUrls,
      });
      errors.push({ ...failure, chainId: null });
      continue;
    }

    if (!chainId) {
      errors.push({
        rpcUrl: masked,
        chainId: null,
        error: 'RPC did not return a valid chainId.',
      });
      continue;
    }

    if (expectedChainId && chainId !== expectedChainId) {
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
      const failure = buildSafeRpcFailure({
        rpcUrl: rpc,
        error: err,
        errorLabel: 'RPC balance check failed.',
        maskRpcUrl,
        privateRpcUrls,
      });
      errors.push({ ...failure, chainId });
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
      const failure = buildSafeRpcFailure({
        rpcUrl: rpc,
        error: err,
        errorLabel: 'RPC nonce lookup failed.',
        maskRpcUrl,
        privateRpcUrls,
      });
      errors.push({ ...failure, chainId });
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
        error: 'Faucet transaction signing failed.',
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
      const failure = buildSafeRpcFailure({
        rpcUrl: rpc,
        error: err,
        errorLabel: 'RPC transaction submission failed.',
        maskRpcUrl,
        privateRpcUrls,
      });
      error('[faucet] send failed', {
        rpcUrl: failure.rpcUrl,
        rpcChainId: chainId,
        registryChainId,
        networkChainId,
        faucetChainId,
        error: failure.error,
        rpcStatus: failure.status,
        rpcCode: failure.code ?? null,
      });
      errors.push({
        rpcUrl: failure.rpcUrl,
        chainId,
        status: failure.status,
        ...(failure.code != null ? { code: failure.code } : {}),
        error: failure.error,
      });
    }
  }

  return json(
    {
      error: errors[errors.length - 1]?.error || 'Faucet transfer failed.',
      rpcUrl: (rpcUrls || []).length ? maskRpcUrl(rpcUrls[0]) : maskRpcUrl(rpcMasked),
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
