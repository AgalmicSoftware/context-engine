// Mechanical Phase 4 extension migration: keep legacy runtime behavior identical and tighten types separately.
/**
 * @file sessionRegistry.ts
 * @module sessionRegistry
 * @description SessionRegistry contract read/write helpers and local cache.
 *              Fetches on-chain session metadata, resolves resource gates, and manages registry cache updates.
 *
 * Key exports: sessionRegistryStore, sessionRegistryUtils, fetchSessionFromRegistry, loadSessionRegistryCache, registerSessionOnChain
 */
import { ethers } from 'ethers';
import SESSION_REGISTRY_ABI from '../../contractsABI/SESSION_REGISTRY_ABI.json';
import {
  DEFAULT_SESSION_SLUG,
  DEFAULT_SESSION_SLUG_ALIAS,
  USE_ONCHAIN_SESSION_REGISTRY,
} from '../../variables/appConfig.js';
import rpcDefaults from '../../variables/rpcDefaults.js';
import {
  getChainById,
  getDefaultGasPriceGwei,
  getDefaultHttpRpc,
  getSessionContractsForChain,
  getSessionRegistryAddress,
  getSessionRegistryChainIds,
} from '../../variables/chains.js';
import { arweaveClient } from '../arweave/arweaveClient.js';
import { getCacheBackendDiagnostics } from '../cache/cacheScripts.js';
import { litStorage } from '../crypto/litProtocol.js';
import { cryptoUtils } from '../crypto/cryptography.js';
import { normalizeSessionNaming, stripAuthoritativeSessionGateFields } from '../session/sessionMetadata.js';
import { overlayCachedSessionWorkerConfig } from '../session/sessionWorkerConfigCache.js';
import { mergeSessionContractMaps, validateRegistrySessionSlugForWrite } from '../session/sessionNaming.js';
import { toStr } from '../shared/primitives.js';
import { createLogger } from '../logging.js';
import { wrapEthersJsonRpcSend } from './rpcReadCache.js';
import { sendContractWriteViaProvider } from './contractWrites.js';

const { getPathRpcUrl } = rpcDefaults;

const surveysLog = createLogger('surveys');

type AnyRecord = Record<string, any>;
type TxFeeOverrides = {
  gasPrice?: ethers.BigNumber;
  maxFeePerGas?: ethers.BigNumber;
  maxPriorityFeePerGas?: ethers.BigNumber;
  [key: string]: any;
};
type NonceTracker = { nextNonce: number | null };
type TxLike = {
  hash?: string;
  transactionHash?: string;
  receipt?: unknown;
  wait: () => Promise<unknown>;
};
type RegistryGateMode = 'any' | 'all';
type RegistryGateSnapshot = {
  lookupStatus: string;
  sbtAddresses: string[];
  chainId: number | null;
  mode: RegistryGateMode;
  perMemberLimit: number | null;
  error?: string;
};
type RegistryGateMap = Record<string, RegistryGateSnapshot | AnyRecord | undefined>;
type RegistryCache = AnyRecord;
type SessionRegistryCacheEntry = [string, unknown];

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';
export const SESSION_REGISTRY_CACHE_UPDATED_EVENT = 'ce:session-registry-cache-updated';

const DEFAULT_RESOURCES = [
  'default',
  'questionResponses',
  'surveyResponses',
  'docUploads',
  'docUrls',
  'ai',
  'arweave',
  'rpc',
  'txGas',
  'lit',
];
const REGISTRY_CHAIN_LOAD_CONCURRENCY = 2;
const REGISTRY_SESSION_LOAD_CONCURRENCY = 4;

const mapWithConcurrency = async <T, R>(
  items: T[] = [],
  limitIn: number = 4,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  const limit = Math.max(1, Math.min(items.length || 1, Math.floor(Number(limitIn) || 1)));
  let nextIndex = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(workers);
  return results;
};
const SPONSORED_FIELD_KEYS = {
  ai: 'sponsored_ai',
  rpc: 'sponsored_rpc',
  faucet: 'sponsored_faucet',
  arweave: 'sponsored_arweave',
  lit: 'sponsored_lit',
  transcribe: 'sponsored_transcribe',
};
const SPONSORED_FIELD_KEY_SET = new Set(Object.values(SPONSORED_FIELD_KEYS));
// Per-function gas fallbacks (measured on Base Sepolia + 1.5x safety margin).
// Dynamic functions accept input size and scale linearly.
const REGISTRY_GAS_FALLBACKS = {
  createSession: 550_000,
  setSessionFields: (numFields: number) => 250_000 + 50_000 * Math.max(numFields, 1),
  setSessionField: 300_000,
  updateSessionMetadata: 350_000,
  setResourceGates: (numGates: number, totalSbtAddresses = 0) =>
    300_000 + 150_000 * Math.max(numGates, 1) + 30_000 * Math.max(totalSbtAddresses, 0),
  setResourceGate: (numSbtAddresses = 1) => 300_000 + 150_000 * Math.max(numSbtAddresses, 1),
  default: 1_000_000,
};
const REGISTRY_GAS_BUFFER_PERCENT = 20;
const REGISTRY_CONTRACT_DEFAULT_KEYS = Object.freeze(['surveys', 'sbtFactory']);
const isExecutionRevert = (err: unknown) => {
  const error = err as AnyRecord;
  if (!err) return false;
  const code = String(error?.code || error?.error?.code || '').toUpperCase();
  if (code === 'CALL_EXCEPTION') return true;
  const msg = String(
    error?.shortMessage || error?.message || error?.error?.message || error?.data?.message || '',
  ).toLowerCase();
  return msg.includes('execution reverted') || msg.includes('always failing transaction') || msg.includes('panic code');
};

const DEFAULT_FIELDS = ['corsWorkerUrl', 'rpcUrl', ...Object.values(SPONSORED_FIELD_KEYS)];
const FIELD_PATHS = {
  corsWorkerUrl: ['corsWorkerUrl'],
  rpcUrl: ['rpc', 'providers', 'path', 'rpcUrl'],
  [SPONSORED_FIELD_KEYS.ai]: ['sponsoredKeys', 'ai'],
  [SPONSORED_FIELD_KEYS.rpc]: ['sponsoredKeys', 'rpc'],
  [SPONSORED_FIELD_KEYS.faucet]: ['sponsoredKeys', 'faucet'],
  [SPONSORED_FIELD_KEYS.arweave]: ['sponsoredKeys', 'arweave'],
  [SPONSORED_FIELD_KEYS.lit]: ['sponsoredKeys', 'lit'],
  [SPONSORED_FIELD_KEYS.transcribe]: ['sponsoredKeys', 'transcribe'],
};

const normalizeSlug = (raw: unknown) => {
  const slug = String(raw ?? '').trim();
  if (!slug) return DEFAULT_SESSION_SLUG;
  return slug === DEFAULT_SESSION_SLUG_ALIAS ? DEFAULT_SESSION_SLUG : slug;
};

const notifySessionRegistryCacheUpdated = () => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  try {
    window.dispatchEvent(new Event(SESSION_REGISTRY_CACHE_UPDATED_EVENT));
  } catch (e) {
    surveysLog.warn('sessionRegistry: telemetry', e);
  }
};

const normalizeSessionIdHex = (raw: unknown) => {
  const value = toStr(raw).trim();
  if (!value) return '';
  if (value.startsWith('0x') && value.length === 34) {
    return value.toLowerCase();
  }
  const compact = value.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (compact.length === 32) return `0x${compact}`;
  return '';
};
const formatSessionId = (raw: unknown) => {
  const hex = normalizeSessionIdHex(raw);
  if (!hex) return '';
  const compact = hex.replace(/^0x/, '');
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join('-');
};
const serializeFieldValue = (val: unknown) => {
  if (typeof val === 'string') return val;
  if (val == null) return '';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch (_) {
      return '';
    }
  }
  return String(val);
};
const parseBool = (value: unknown) => {
  const str = toStr(value).trim().toLowerCase();
  if (!str) return null;
  return ['1', 'true', 'yes', 'y'].includes(str);
};

const didGateLookupSucceed = (gate: unknown) => toStr((gate as AnyRecord)?.lookupStatus).toLowerCase() === 'ok';

const buildGateSnapshot = (gatesByResource: RegistryGateMap = {}) => {
  const snapshot: Record<string, RegistryGateSnapshot> = {};
  DEFAULT_RESOURCES.forEach((resourceKey) => {
    const gate = gatesByResource?.[resourceKey];
    snapshot[resourceKey] = {
      lookupStatus: didGateLookupSucceed(gate) ? 'ok' : toStr(gate?.lookupStatus).trim() || 'unavailable',
      sbtAddresses: Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses.filter(Boolean) : [],
      chainId: Number(gate?.chainId || 0) || null,
      mode: normalizeGateMode(gate?.mode),
      perMemberLimit: Number(gate?.perMemberLimit || 0) || null,
    };
  });
  return snapshot;
};

const resolveBufferedGasLimit = (estimateValue: ethers.BigNumberish, fallbackGasLimit: ethers.BigNumberish) => {
  const fallback = ethers.BigNumber.from(String(fallbackGasLimit || REGISTRY_GAS_FALLBACKS.default));
  const gasEstimate = ethers.BigNumber.from(estimateValue || 0);
  if (gasEstimate.isZero()) return fallback;
  const bufferedGasLimit = gasEstimate.mul(100 + REGISTRY_GAS_BUFFER_PERCENT).div(100);
  return bufferedGasLimit.lt(fallback) ? fallback : bufferedGasLimit;
};

const isNonZeroBigNumber = (value: unknown): value is ethers.BigNumber =>
  ethers.BigNumber.isBigNumber(value) && value.gt(0);

const hasExplicitTxFeeOverrides = (overrides: TxFeeOverrides | null = null) =>
  isNonZeroBigNumber(overrides?.gasPrice) ||
  isNonZeroBigNumber(overrides?.maxFeePerGas) ||
  ethers.BigNumber.isBigNumber(overrides?.maxPriorityFeePerGas);

const hasExplicitEip1559TxFeeOverrides = (overrides: TxFeeOverrides | null = null) =>
  isNonZeroBigNumber(overrides?.maxFeePerGas) && ethers.BigNumber.isBigNumber(overrides?.maxPriorityFeePerGas);

const extractRpcFeeOverrides = (feeData: ethers.providers.FeeData | null = null): TxFeeOverrides => {
  const maxFeePerGas = feeData?.maxFeePerGas;
  const maxPriorityFeePerGas = feeData?.maxPriorityFeePerGas;
  if (
    isNonZeroBigNumber(maxFeePerGas) &&
    ethers.BigNumber.isBigNumber(maxPriorityFeePerGas) &&
    maxFeePerGas.gte(maxPriorityFeePerGas)
  ) {
    return { maxFeePerGas, maxPriorityFeePerGas };
  }
  const gasPrice = feeData?.gasPrice;
  return isNonZeroBigNumber(gasPrice) ? { gasPrice } : {};
};

const isMalformedProviderValueError = (err: unknown) => {
  const error = err as AnyRecord;
  if (!err) return false;
  const message = toStr(
    error?.shortMessage || error?.reason || error?.message || error?.error?.message || error?.data?.message,
  ).toLowerCase();
  if (!message) return false;
  if (message.includes('invalid bignumber value') && message.includes('value=null')) return true;
  if (message.includes('invalid bignumber value') && message.includes('value= null')) return true;
  if (message.includes('bad result from backend') && message.includes('null')) return true;
  if (message.includes('could not coalesce') && message.includes('null')) return true;
  return false;
};

const resolveRpcTxFeeOverrides = async ({ chainId } = {} as AnyRecord): Promise<TxFeeOverrides> => {
  const id = Number(chainId || 0) || 0;
  if (!id) return {};

  const urls = getOrderedRegistryRpcUrls(id, { bootstrapRpc: true });
  if (!urls.length) return {};

  const staticNet = {
    chainId: id,
    name: getChainById(id)?.network || `chain-${id}`,
  };

  for (const rpcUrl of urls) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl, staticNet);
      let feeOverrides: TxFeeOverrides = {};
      try {
        feeOverrides = extractRpcFeeOverrides(
          typeof provider.getFeeData === 'function' ? await provider.getFeeData() : null,
        );
      } catch (_) {
        feeOverrides = {};
      }
      if (hasExplicitTxFeeOverrides(feeOverrides)) {
        return feeOverrides;
      }

      if (typeof provider.getGasPrice === 'function') {
        const gasPrice = await provider.getGasPrice();
        if (isNonZeroBigNumber(gasPrice)) {
          return { gasPrice };
        }
      }
    } catch (_) {
      // Ignore individual RPC failures and continue trying concrete public URLs.
    }
  }

  return {};
};

const resolveRpcPendingNonce = async ({ chainId, address } = {} as AnyRecord): Promise<number | null> => {
  const id = Number(chainId || 0) || 0;
  const normalizedAddress = toStr(address).trim();
  if (!id || !ethers.utils.isAddress(normalizedAddress)) return null;

  const urls = getOrderedRegistryRpcUrls(id, { bootstrapRpc: true });
  if (!urls.length) return null;

  const staticNet = {
    chainId: id,
    name: getChainById(id)?.network || `chain-${id}`,
  };

  for (const rpcUrl of urls) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl, staticNet);
      if (typeof provider.getTransactionCount !== 'function') continue;
      const nonce = await provider.getTransactionCount(normalizedAddress, 'pending');
      if (Number.isInteger(nonce) && nonce >= 0) return nonce;
    } catch (_) {
      // Ignore individual RPC failures and continue trying concrete public URLs.
    }
  }

  return null;
};

const sendWithGasFallback = async ({
  estimate,
  send,
  gasLimitOverride,
  txOverrides,
  fallbackGasLimit,
  preferFallbackGasLimit = false,
}: {
  estimate?: (() => Promise<ethers.BigNumberish>) | null;
  send: (overrides: TxFeeOverrides) => Promise<TxLike>;
  gasLimitOverride?: unknown;
  txOverrides?: TxFeeOverrides | null;
  fallbackGasLimit: ethers.BigNumberish;
  preferFallbackGasLimit?: boolean;
}) => {
  const baseOverrides: TxFeeOverrides = txOverrides && typeof txOverrides === 'object' ? txOverrides : {};
  if (typeof gasLimitOverride === 'number' && Number.isFinite(gasLimitOverride) && gasLimitOverride > 0) {
    return await send({ ...baseOverrides, gasLimit: Math.floor(gasLimitOverride) });
  }
  let gasLimit = fallbackGasLimit || REGISTRY_GAS_FALLBACKS.default;
  if (!preferFallbackGasLimit) {
    try {
      const estimateValue = await (estimate as any)();
      gasLimit = resolveBufferedGasLimit(estimateValue, fallbackGasLimit);
    } catch (estimateErr) {
      if (isExecutionRevert(estimateErr)) throw estimateErr;
    }
  }
  return await send({ ...baseOverrides, gasLimit });
};

const collectErrorText = (err: unknown, depth = 0) => {
  if (!err || depth > 4) return '';
  const error = err as AnyRecord;
  const parts: string[] = [];
  const push = (value: unknown) => {
    const text = toStr(value).trim();
    if (text) parts.push(text);
  };
  push(error?.shortMessage);
  push(error?.message);
  push(error?.details);
  push(error?.cause?.shortMessage);
  push(error?.cause?.message);
  push(error?.cause?.details);
  push(error?.data?.message);
  if (error?.cause && error.cause !== err) {
    push(collectErrorText(error.cause, depth + 1));
  }
  return parts.join('\n');
};

const isNonceError = (err: unknown) => {
  const msg = collectErrorText(err).toLowerCase();
  return (
    msg.includes('nonce') && (msg.includes('too low') || msg.includes('already been used') || msg.includes('expired'))
  );
};

const extractNextNonceFromError = (err: unknown) => {
  const msg = collectErrorText(err);
  const nextNonceMatch = msg.match(/next nonce\s+(\d+)/i);
  if (nextNonceMatch) {
    const parsed = Number(nextNonceMatch[1]);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  const currentNonceMatch = msg.match(/current nonce(?: of the account)?[^\d]*(\d+)/i);
  if (currentNonceMatch) {
    const parsed = Number(currentNonceMatch[1]);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
};

const sendWithNonceRetry = async ({
  estimate,
  send,
  gasLimitOverride,
  signer,
  txOverrides,
  fallbackGasLimit,
  feeFallbackChainId,
  txLabel = 'transaction',
  preferFallbackGasLimit = false,
  nonceTracker = null,
}: {
  estimate?: (() => Promise<ethers.BigNumberish>) | null;
  send: (overrides: TxFeeOverrides) => Promise<TxLike>;
  gasLimitOverride?: unknown;
  signer?: AnyRecord | null;
  txOverrides?: TxFeeOverrides | null;
  fallbackGasLimit: ethers.BigNumberish;
  feeFallbackChainId?: unknown;
  txLabel?: string;
  preferFallbackGasLimit?: boolean;
  nonceTracker?: NonceTracker | null;
}) => {
  let nonceOverride: number | null = null;
  const resolvePendingNonceOverride = async () => {
    const rawTrackedNonce = nonceTracker?.nextNonce;
    const trackedNonce = Number(rawTrackedNonce);
    if (rawTrackedNonce != null && Number.isInteger(trackedNonce) && trackedNonce >= 0) return trackedNonce;
    if (!signer?.provider || typeof signer.getAddress !== 'function') return null;
    try {
      const address = await signer.getAddress();
      const rpcNonce = await resolveRpcPendingNonce({
        chainId: feeFallbackChainId,
        address,
      });
      if (rpcNonce != null && Number.isInteger(rpcNonce) && rpcNonce >= 0) return rpcNonce;
      const signerNonce = await signer.provider.getTransactionCount?.(address, 'pending');
      return Number.isInteger(signerNonce) && signerNonce >= 0 ? signerNonce : null;
    } catch (_) {
      return null;
    }
  };
  nonceOverride = await resolvePendingNonceOverride();
  let resolvedTxOverrides: TxFeeOverrides = txOverrides && typeof txOverrides === 'object' ? { ...txOverrides } : {};
  let attemptedRpcFeeFallback = false;
  let attemptedMalformedRetryWithCurrentOverrides = false;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const tx = await sendWithGasFallback({
        estimate,
        // eslint-disable-next-line no-loop-func
        send: (overrides: TxFeeOverrides) =>
          send({
            ...overrides,
            ...(nonceOverride != null ? { nonce: nonceOverride } : {}),
          }),
        gasLimitOverride,
        txOverrides: resolvedTxOverrides,
        fallbackGasLimit,
        preferFallbackGasLimit,
      });
      if (
        nonceTracker &&
        typeof nonceTracker === 'object' &&
        nonceOverride != null &&
        Number.isInteger(nonceOverride) &&
        nonceOverride >= 0
      ) {
        const confirmedNonceOverride = Number(nonceOverride);
        nonceTracker.nextNonce = Math.max(Number(nonceTracker.nextNonce || 0), confirmedNonceOverride + 1);
      }
      return tx;
    } catch (err) {
      lastErr = err;
      if (isMalformedProviderValueError(err)) {
        const canUpgradeFees = !hasExplicitEip1559TxFeeOverrides(resolvedTxOverrides);
        if (!attemptedRpcFeeFallback && canUpgradeFees) {
          attemptedRpcFeeFallback = true;
          const rpcFeeOverrides = await resolveRpcTxFeeOverrides({ chainId: feeFallbackChainId });
          if (hasExplicitEip1559TxFeeOverrides(rpcFeeOverrides)) {
            const { gasPrice: _ignoredGasPrice, ...restOverrides } = resolvedTxOverrides;
            resolvedTxOverrides = { ...restOverrides, ...rpcFeeOverrides };
            attemptedMalformedRetryWithCurrentOverrides = false;
            surveysLog.warn('[sessionRegistry] retrying transaction with upgraded public RPC fee overrides', {
              chainId: Number(feeFallbackChainId || 0) || null,
              txLabel,
              feeKeys: Object.keys(rpcFeeOverrides),
            });
            continue;
          }
        }
        if (!attemptedMalformedRetryWithCurrentOverrides && hasExplicitTxFeeOverrides(resolvedTxOverrides)) {
          attemptedMalformedRetryWithCurrentOverrides = true;
          surveysLog.warn('[sessionRegistry] retrying transaction with public RPC fee overrides', {
            chainId: Number(feeFallbackChainId || 0) || null,
            txLabel,
            feeKeys: Object.keys(resolvedTxOverrides || {}),
          });
          continue;
        }
      }
      if (!isNonceError(err) || !signer?.provider || typeof signer.getAddress !== 'function') {
        throw err;
      }
      const previousNonceOverride = nonceOverride;
      const nextNonceFromError = extractNextNonceFromError(err);
      const refreshedNonce = await resolvePendingNonceOverride();
      const candidates = [
        nextNonceFromError,
        refreshedNonce,
        previousNonceOverride != null && Number.isInteger(previousNonceOverride) ? previousNonceOverride + 1 : null,
      ].filter((candidate) => Number.isInteger(candidate) && candidate >= 0);
      if (!candidates.length) {
        throw err;
      }
      nonceOverride = Math.max(...candidates);
      if (nonceTracker && typeof nonceTracker === 'object') {
        nonceTracker.nextNonce = nonceOverride;
      }
    }
  }
  throw lastErr;
};

const parseGweiToWei = (value: unknown, label: unknown) => {
  const raw = toStr(value).trim();
  if (!raw) return null;
  try {
    const wei = ethers.utils.parseUnits(raw, 'gwei');
    return wei && wei.gt(0) ? wei : null;
  } catch (_) {
    const name = toStr(label).trim() || 'fee';
    throw new Error(`Invalid ${name}. Enter a positive number in gwei.`);
  }
};

const resolveTxFeeOverrides = async (
  { signer, chainId, gasPriceGwei, maxFeePerGasGwei, maxPriorityFeePerGasGwei } = {} as AnyRecord,
): Promise<TxFeeOverrides> => {
  const normalizedChainId = Number(chainId || 0) || 0;
  const gasPriceWei = parseGweiToWei(gasPriceGwei, 'gas price');
  if (gasPriceWei) {
    // Legacy field. Some wallets/networks will ignore this on EIP-1559 chains.
    return { gasPrice: gasPriceWei };
  }

  const maxFeeWei = parseGweiToWei(maxFeePerGasGwei, 'max fee per gas');
  const maxPriorityWei = parseGweiToWei(maxPriorityFeePerGasGwei, 'max priority fee per gas');
  // Prefer concrete public-RPC fee data so writes do not depend on wallet/provider fee auto-population,
  // which has intermittently returned malformed null BigNumber fields during session publish.
  let suggestedFeeOverrides: TxFeeOverrides = await resolveRpcTxFeeOverrides({ chainId });
  if (!hasExplicitTxFeeOverrides(suggestedFeeOverrides)) {
    let feeData = null;
    try {
      feeData =
        signer?.provider && typeof signer.provider.getFeeData === 'function'
          ? await signer.provider.getFeeData()
          : null;
    } catch (_) {
      feeData = null;
    }
    suggestedFeeOverrides = extractRpcFeeOverrides(feeData);
  }

  if (!maxFeeWei && !maxPriorityWei) {
    if (hasExplicitTxFeeOverrides(suggestedFeeOverrides)) {
      return suggestedFeeOverrides;
    }
    const chainFallbackGasPriceWei = parseGweiToWei(getDefaultGasPriceGwei(normalizedChainId), 'gas price');
    return chainFallbackGasPriceWei ? { gasPrice: chainFallbackGasPriceWei } : {};
  }

  const suggestedMaxFee = suggestedFeeOverrides?.maxFeePerGas || null;
  const suggestedPriority = suggestedFeeOverrides?.maxPriorityFeePerGas || null;
  const suggestedAllowance =
    suggestedMaxFee && suggestedPriority && suggestedMaxFee.gte(suggestedPriority)
      ? suggestedMaxFee.sub(suggestedPriority)
      : ethers.constants.Zero;

  const resolvedPriority = maxPriorityWei || suggestedPriority || null;
  let resolvedMaxFee = maxFeeWei || suggestedMaxFee || null;

  if (!resolvedPriority || !resolvedMaxFee) {
    throw new Error('Set max fee + max priority fee (in gwei), or leave both blank.');
  }

  // Ensure maxFeePerGas is at least priority + (suggestedMaxFee - suggestedPriority) when possible.
  const minMaxFee = resolvedPriority.add(suggestedAllowance);
  if (resolvedMaxFee.lt(minMaxFee)) resolvedMaxFee = minMaxFee;

  if (resolvedPriority.gt(resolvedMaxFee)) {
    throw new Error('Max priority fee must be <= max fee.');
  }

  return { maxFeePerGas: resolvedMaxFee, maxPriorityFeePerGas: resolvedPriority };
};

const toRegistrySlug = (raw: unknown) => {
  const slug = toStr(raw).trim();
  // Registry treats empty slug as the default "general" session.
  if (!slug || slug === DEFAULT_SESSION_SLUG_ALIAS) return DEFAULT_SESSION_SLUG_ALIAS;
  return slug;
};

const validateRegistrySlugForWriteOrThrow = (raw: unknown) => {
  const slugValidation = validateRegistrySessionSlugForWrite(raw);
  if (!slugValidation.ok) {
    throw new Error(slugValidation.error || 'Invalid session slug.');
  }
  return slugValidation.slug;
};

const setValueAtPath = (obj: AnyRecord, path: string[], value: unknown) => {
  let cur = obj;
  path.forEach((key: string, idx: number) => {
    if (idx === path.length - 1) {
      cur[key] = value;
    } else {
      if (!cur[key] || typeof cur[key] !== 'object') {
        cur[key] = {};
      }
      cur = cur[key];
    }
  });
};

const resolveRegistryAddress = (chainId: unknown) => {
  if (!chainId) return '';
  const addr = getSessionRegistryAddress(chainId);
  return ethers.utils.isAddress(addr) ? addr : '';
};

const resolveBootstrapRpcUrl = (chainId: unknown) => {
  // Bootstrap reads should use public/default RPCs (no PATH) so sessions load without wallet config.
  // TODO: Move default registry/contract lookups to <chainId>.contracts.contextengine.eth once live.
  return getDefaultHttpRpc(chainId, { allowPath: false });
};

const normalizeRpcUrlList = (urls: unknown[] = []) => {
  const seen = new Set<string>();
  const out: string[] = [];
  (Array.isArray(urls) ? urls : []).forEach((raw) => {
    const url = toStr(raw).trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  });
  return out;
};

// Memoize read providers so callers share the same FallbackProvider and underlying caches.
const _readProviderCache = new Map<string, ethers.providers.FallbackProvider>(); // key -> provider

const getReadProviderForChain = (chainId: unknown, opts: { bootstrapRpc?: boolean } = {}) => {
  const id = Number(chainId || 0) || 0;
  if (!id) return null;

  const mode = opts.bootstrapRpc ? 'bootstrap' : 'default';
  const cacheKey = `${mode}:${id}`;
  if (_readProviderCache.has(cacheKey)) return _readProviderCache.get(cacheKey);

  const chain = getChainById(id);
  const publicUrls = Array.isArray(chain?.rpcUrls?.public?.http) ? chain.rpcUrls.public.http : [];
  const defaultUrls = Array.isArray(chain?.rpcUrls?.default?.http) ? chain.rpcUrls.default.http : [];
  const pathUrl = toStr(getPathRpcUrl(id)).trim();

  const merged = normalizeRpcUrlList([...(publicUrls || []), ...(defaultUrls || [])]);
  const urls = opts.bootstrapRpc && pathUrl ? merged.filter((url) => url !== pathUrl) : merged;

  const ordered = urls.length
    ? urls
    : normalizeRpcUrlList([opts.bootstrapRpc ? resolveBootstrapRpcUrl(id) : getDefaultHttpRpc(id)].filter(Boolean));
  if (!ordered.length) return null;

  // Static network object avoids `detectNetwork()` overhead.
  const staticNet = { chainId: id, name: chain?.network || `chain-${id}` };
  const lastIndex = ordered.length - 1;

  const providerConfigs = ordered.map((rpcUrl, idx) => {
    const isBackup = ordered.length > 1 && idx === lastIndex;
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, staticNet);
    wrapEthersJsonRpcSend(provider, {
      chainId: id,
      providerKey: `sessionRegistry:${mode}:${id}`,
      providerLabel: 'sessionRegistry',
      url: rpcUrl,
    });
    return {
      provider,
      priority: idx + 1,
      stallTimeout: isBackup ? 6000 : 1200,
      weight: 1,
    };
  });

  const fp = new ethers.providers.FallbackProvider(providerConfigs, 1);
  fp.pollingInterval = 12000;
  _readProviderCache.set(cacheKey, fp);
  return fp;
};

const getOrderedRegistryRpcUrls = (chainId: unknown, opts: { bootstrapRpc?: boolean } = {}) => {
  const id = Number(chainId || 0) || 0;
  if (!id) return [];

  const chain = getChainById(id);
  const publicUrls = Array.isArray(chain?.rpcUrls?.public?.http) ? chain.rpcUrls.public.http : [];
  const defaultUrls = Array.isArray(chain?.rpcUrls?.default?.http) ? chain.rpcUrls.default.http : [];
  const pathUrl = toStr(getPathRpcUrl(id)).trim();
  const merged = normalizeRpcUrlList([...(publicUrls || []), ...(defaultUrls || [])]);
  const urls = opts.bootstrapRpc && pathUrl ? merged.filter((url) => url !== pathUrl) : merged;
  return urls.length
    ? urls
    : normalizeRpcUrlList([opts.bootstrapRpc ? resolveBootstrapRpcUrl(id) : getDefaultHttpRpc(id)].filter(Boolean));
};

const readRegistryMethodWithRpcFallback = async (
  { chainId, registryAddress, method, args = [], contract = null } = {} as {
    chainId?: unknown;
    registryAddress?: string;
    method?: string;
    args?: unknown[];
    contract?: AnyRecord | null;
  },
): Promise<any> => {
  const callArgs = Array.isArray(args) ? args : [];
  let lastError: unknown = null;
  const methodName = method as string;
  const resolvedRegistryAddress = registryAddress as string;

  if (contract && typeof contract[methodName] === 'function') {
    try {
      return await contract[methodName](...callArgs);
    } catch (error) {
      lastError = error;
    }
  }

  const urls = getOrderedRegistryRpcUrls(chainId, { bootstrapRpc: true });
  const staticNet = {
    chainId: Number(chainId || 0) || 0,
    name: getChainById(Number(chainId || 0))?.network || `chain-${Number(chainId || 0) || 0}`,
  };

  for (const rpcUrl of urls) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl, staticNet);
      wrapEthersJsonRpcSend(provider, {
        chainId: Number(chainId || 0) || 0,
        providerKey: `sessionRegistry:fallback:${methodName}:${Number(chainId || 0) || 0}`,
        providerLabel: 'sessionRegistry',
        url: rpcUrl,
      });
      const retryContract = new ethers.Contract(resolvedRegistryAddress, SESSION_REGISTRY_ABI, provider) as AnyRecord;
      if (typeof retryContract[methodName] !== 'function') {
        continue;
      }
      return await retryContract[methodName](...callArgs);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Failed to call ${methodName} on SessionRegistry.`);
};

const getRegistryContract = (
  chainId: unknown,
  provider: ethers.providers.Provider | null = null,
  opts: { bootstrapRpc?: boolean } = {},
) => {
  const addr = resolveRegistryAddress(chainId);
  if (!addr) return null;
  const readProvider = provider || getReadProviderForChain(chainId, opts);
  if (!readProvider) return null;
  return new ethers.Contract(addr, SESSION_REGISTRY_ABI, readProvider);
};

const getWriteContextFromProviderLike = (providerLike: unknown) => {
  const signingProvider = cryptoUtils._getProvider(
    (providerLike || 'wagmi') as Parameters<typeof cryptoUtils._getProvider>[0],
  ) as AnyRecord;
  if (!signingProvider || typeof signingProvider.request !== 'function') {
    throw new Error('Wallet provider not available.');
  }
  const ethersProvider = new ethers.providers.Web3Provider(signingProvider as ethers.providers.ExternalProvider, 'any');
  const signer = ethersProvider.getSigner();
  return {
    signingProvider,
    ethersProvider,
    signer,
  };
};

const toBroadcastTxResponse = ({ txHash, receipt } = {} as AnyRecord): TxLike => ({
  hash: txHash,
  transactionHash: txHash,
  receipt,
  wait: async () => receipt,
});

const sendRegistryContractWriteViaProvider = async (
  {
    signingProvider,
    ethersProvider,
    signer,
    contract,
    method,
    args = [],
    txOverrides = {},
    onBroadcastTxHash,
    rpcFunction = method,
    revertMessage = `${method} transaction reverted on-chain.`,
  } = {} as {
    signingProvider?: AnyRecord;
    ethersProvider?: ethers.providers.Web3Provider;
    signer?: AnyRecord;
    contract?: ethers.Contract;
    method?: string;
    args?: unknown[];
    txOverrides?: TxFeeOverrides;
    onBroadcastTxHash?: ((txHash: unknown) => unknown) | null;
    rpcFunction?: string;
    revertMessage?: string;
  },
): Promise<TxLike> => {
  const { txHash, receipt } = await sendContractWriteViaProvider({
    signingProvider,
    ethersProvider,
    signer,
    contract,
    method,
    args,
    txOverrides,
    onBroadcastTxHash,
    rpcFunction,
    revertMessage,
  });
  return toBroadcastTxResponse({ txHash, receipt });
};

const describeChainTarget = (chainId: unknown) => {
  const id = Number(chainId || 0) || 0;
  if (!id) return 'the required chain';
  const chain = getChainById(id);
  return chain?.name ? `${chain.name} (${id})` : `chain ${id}`;
};

const readSignerChainId = async (
  signer: AnyRecord | null,
  ethersProvider: ethers.providers.Web3Provider | null = null,
) => {
  try {
    if (typeof signer?.getChainId === 'function') {
      const signerChainId = Number(await signer.getChainId());
      if (Number.isFinite(signerChainId) && signerChainId > 0) {
        return signerChainId;
      }
    }
  } catch (_) {}

  try {
    const net = await signer?.provider?.getNetwork?.();
    const signerChainId = Number(net?.chainId || 0) || 0;
    if (signerChainId > 0) return signerChainId;
  } catch (_) {}

  try {
    const net = await ethersProvider?.getNetwork?.();
    const signerChainId = Number(net?.chainId || 0) || 0;
    if (signerChainId > 0) return signerChainId;
  } catch (_) {}

  return 0;
};

const assertSignerOnRegistryWriteChain = async ({
  signer,
  ethersProvider = null,
  chainId,
}: {
  signer: AnyRecord;
  ethersProvider?: ethers.providers.Web3Provider | null;
  chainId?: unknown;
}) => {
  const writeChainId = Number(chainId || 0) || 0;
  const signerChainId = await readSignerChainId(signer, ethersProvider);
  if (writeChainId && !signerChainId) {
    throw new Error(
      `Unable to verify the connected wallet chain. Session registry writes require ${describeChainTarget(writeChainId)}. Switch the wallet network and retry.`,
    );
  }
  if (writeChainId && signerChainId !== writeChainId) {
    throw new Error(
      `Connected wallet is on ${describeChainTarget(signerChainId)}, but session registry writes require ${describeChainTarget(writeChainId)}. Switch the wallet network and retry.`,
    );
  }
  return writeChainId;
};

const isArweaveTxId = (value: string) => /^[a-z0-9_-]{43}$/i.test(value);
const isArweaveGatewayHost = (host: string) =>
  host.endsWith('arweave.net') || host.endsWith('arweave.dev') || host.endsWith('arweave.app');

const decodeBase64Utf8 = (raw = '') => {
  const value = toStr(raw).trim();
  if (!value) return '';
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
      const binary = globalThis.atob(value);
      const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-8').decode(bytes);
      }
      let out = '';
      for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
      return decodeURIComponent(escape(out));
    }
  } catch (e) {
    void e; /* fallback: base64 decoder compatibility. */
  }
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(value, 'base64').toString('utf8');
    }
  } catch (e) {
    void e; /* fallback: base64 decoder compatibility. */
  }
  return '';
};

export const parseSessionRegistryMetadataUri = (uri: unknown) => {
  const raw = toStr(uri).trim();
  if (!raw) return null;
  if (!raw.toLowerCase().startsWith('data:')) return null;
  const commaIdx = raw.indexOf(',');
  if (commaIdx < 0) return null;
  const meta = raw.slice(5, commaIdx).toLowerCase();
  const payload = raw.slice(commaIdx + 1);
  if (!meta.includes('application/json')) return null;
  let text = '';
  if (meta.includes(';base64')) {
    text = decodeBase64Utf8(payload);
  } else {
    try {
      text = decodeURIComponent(payload);
    } catch (_) {
      text = payload;
    }
  }
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
};

const parseArweaveTxId = (uri: unknown) => {
  const raw = toStr(uri).trim();
  if (!raw) return '';
  if (raw.startsWith('ar://')) {
    const txId = raw.slice(5).trim();
    return isArweaveTxId(txId) ? txId : '';
  }
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split('/').filter(Boolean);
    const candidate = segments[segments.length - 1] || '';
    if (isArweaveGatewayHost(host) && isArweaveTxId(candidate)) return candidate;
  } catch (e) {
    surveysLog.warn('sessionRegistry: fallback', e);
  }
  const litTx = litStorage.parseLitArweaveUrl(raw);
  if (litTx) return litTx;
  return isArweaveTxId(raw) ? raw : '';
};

const fetchMetadataFromArweave = async (uri: unknown, opts: AnyRecord = {}) => {
  const inlineJson = parseSessionRegistryMetadataUri(uri);
  if (inlineJson && typeof inlineJson === 'object') return inlineJson;
  const txId = parseArweaveTxId(uri);
  if (!txId) return null;
  const debugContext = {
    category: 'session_registry_metadata',
    caller: toStr(opts?.caller).trim() || 'sessionRegistry',
    slug: toStr(opts?.slug).trim() || '',
    chainId: Number(opts?.chainId || 0) || null,
  };
  let text = '';
  try {
    text = await arweaveClient.downloadDataFromArweave(txId, {
      debugContext,
    });
  } catch (err) {
    const error = err as AnyRecord;
    if (typeof window !== 'undefined') {
      const cacheBackend = getCacheBackendDiagnostics();
      surveysLog.warn('[sessionRegistry] metadata fetch failed', {
        txId,
        error: error?.message || String(err),
        slug: debugContext.slug || null,
        chainId: debugContext.chainId || null,
        cacheBackend: cacheBackend?.persistentBackend || 'unknown',
        cacheBackendProbeState: cacheBackend?.probeState || 'unprobed',
      });
    }
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
};

const resolveMetadataLoadState = ({ metadata, hasMetadataUri = false } = {} as AnyRecord) => {
  if (metadata && typeof metadata === 'object') return 'loaded';
  return hasMetadataUri ? 'unavailable' : 'none';
};

const tryDecryptEnvelope = async (envelope: unknown, opts: AnyRecord = {}) => {
  const account = toStr(opts.account);
  const providerLike = opts.providerLike || 'wagmi';
  const chainId = Number(opts.chainId || 0) || null;
  const lit = opts.lit;
  if (!envelope || !account || !lit || typeof lit.getKey !== 'function') return null;
  try {
    return await cryptoUtils.decryptEnvelopeValue(envelope, {
      account,
      chainId,
      providerLike,
      litOpts: { getKey: lit.getKey },
    });
  } catch (_) {
    return null;
  }
};

const buildSponsoredFromGates = ({
  gatesByResource,
  defaultProvider,
}: {
  gatesByResource?: RegistryGateMap;
  defaultProvider?: unknown;
}) => {
  const gates: AnyRecord = {};
  const resources: AnyRecord = {};
  let defaultGateId: string | null = null;

  Object.entries(gatesByResource || {}).forEach(([resource, gate]) => {
    if (!didGateLookupSucceed(gate)) return;
    const gateRecord = gate as AnyRecord;
    if (!gateRecord || !Array.isArray(gateRecord.sbtAddresses) || !gateRecord.sbtAddresses.length) return;
    const gateId = `registry-${resource}`;
    gates[gateId] = {
      type: 'sbt',
      label: `Registry ${resource} gate`,
      sbtAddresses: gateRecord.sbtAddresses,
      sbtAddress: gateRecord.sbtAddresses[0],
      chainId: gateRecord.chainId || null,
      mode: gateRecord.mode || 'any',
      perMemberLimit: gateRecord.perMemberLimit || null,
    };
    if (resource === 'default') defaultGateId = gateId;
    resources[resource] = {
      gateId,
      provider: resource === 'ai' ? defaultProvider || '' : undefined,
      perMemberLimit: gateRecord.perMemberLimit || null,
    };
  });

  if (!Object.keys(gates).length) return null;

  return {
    defaultGateId: defaultGateId || undefined,
    gates,
    resources,
  };
};

const normalizeGateMode = (mode: unknown): RegistryGateMode => {
  if (mode === 'all') return 'all';
  const numeric =
    typeof mode === 'number'
      ? mode
      : mode && typeof (mode as AnyRecord).toNumber === 'function'
        ? (mode as AnyRecord).toNumber()
        : Number(mode);
  if (numeric === 1) return 'all';
  return 'any';
};

const fetchGateForResource = async (
  contract: AnyRecord,
  slug: unknown,
  resourceKey: string,
): Promise<RegistryGateSnapshot> => {
  try {
    const res = await contract.getResourceGate(slug, resourceKey);
    const sbtAddresses = Array.isArray(res?.[0]) ? (res[0].filter(Boolean) as string[]) : [];
    return {
      lookupStatus: 'ok',
      sbtAddresses,
      chainId: Number(res?.[1] || 0) || null,
      mode: normalizeGateMode(res?.[2]),
      perMemberLimit: Number(res?.[3] || 0) || null,
    };
  } catch (err) {
    const error = err as AnyRecord;
    return {
      lookupStatus: 'error',
      sbtAddresses: [],
      chainId: null,
      mode: 'any',
      perMemberLimit: null,
      error: toStr(error?.message || err),
    };
  }
};

const fetchSessionFields = async (
  contract: AnyRecord,
  slug: unknown,
  fieldKeys: string[] = DEFAULT_FIELDS,
): Promise<Record<string, string>> => {
  const keys = Array.isArray(fieldKeys) ? fieldKeys.filter(Boolean) : [];
  if (!contract || !keys.length) return {};

  if (typeof contract.getSessionFields === 'function') {
    try {
      const values = await contract.getSessionFields(slug, keys);
      const out: Record<string, string> = {};
      keys.forEach((key, idx) => {
        const value = toStr(values?.[idx] || '').trim();
        if (value) out[key] = value;
      });
      return out;
    } catch (e) {
      surveysLog.warn('sessionRegistry: fallback', e);
    }
  }

  if (typeof contract.getSessionField !== 'function') return {};
  const out: Record<string, string> = {};
  for (const key of keys) {
    try {
      const value = await contract.getSessionField(slug, key);
      const cleaned = toStr(value || '').trim();
      if (cleaned) out[key] = cleaned;
    } catch (e) {
      surveysLog.warn('sessionRegistry: fallback', e);
    }
  }
  return out;
};

const buildSessionConfigFromRegistry = ({
  session,
  metadata,
  gatesByResource,
  fieldsByKey,
  registryChainId,
  metadataLoadState = 'loaded',
}: AnyRecord) => {
  const metadataObj = normalizeSessionNaming(
    metadata && typeof metadata === 'object' ? { ...metadata } : {},
  ) as AnyRecord;
  const gateSnapshot = buildGateSnapshot(gatesByResource);
  const hasOnChainGateData = Object.values(gateSnapshot).some((gate) => gate.lookupStatus === 'ok');

  const sessionIdHex = normalizeSessionIdHex(session?.sessionIdHex || session?.sessionId);
  const sessionId = formatSessionId(sessionIdHex);
  const config: AnyRecord = {
    ...metadataObj,
    slug: normalizeSlug(session.slug),
    ...(sessionId ? { sessionId } : {}),
    networkChainId: Number(session.chainId || metadataObj?.networkChainId || 0) || null,
  };

  // Registry sessions may omit contract addresses in metadata; default to chain-wide deployments
  // (e.g. surveys, sbtFactory) when available. Metadata overrides defaults when present.
  const resolvedChainId = Number(config.networkChainId || 0) || 0;
  const chainContractsRaw: AnyRecord = resolvedChainId ? getSessionContractsForChain(resolvedChainId) : {};
  const chainContracts = REGISTRY_CONTRACT_DEFAULT_KEYS.reduce<AnyRecord>((acc, key) => {
    const value = chainContractsRaw?.[key];
    const address = toStr(value).trim();
    if (!address) return acc;
    acc[key] = { address, chainId: resolvedChainId };
    return acc;
  }, {});
  const registryAddress = toStr(getSessionRegistryAddress(resolvedChainId)).trim();
  if (registryAddress) {
    chainContracts.sessionRegistry = { address: registryAddress, chainId: resolvedChainId };
  }
  const metadataContracts: AnyRecord =
    metadataObj.contracts && typeof metadataObj.contracts === 'object' ? metadataObj.contracts : {};
  const metadataDefaultedContractKeys = Object.keys(chainContracts).filter((key) => {
    const entry = metadataContracts[key];
    const address = toStr(entry?.address || entry?.contractAddress || '').trim();
    return !!toStr(chainContracts[key]?.address || '').trim() && !address;
  });
  config.contracts = mergeSessionContractMaps(chainContracts, metadataObj.contracts, config.contracts);

  const fields: Record<string, unknown> = fieldsByKey && typeof fieldsByKey === 'object' ? fieldsByKey : {};
  Object.entries(FIELD_PATHS).forEach(([key, path]) => {
    const value = toStr(fields[key] || '').trim();
    if (!value) return;
    if (SPONSORED_FIELD_KEY_SET.has(key)) {
      const parsed = parseBool(value);
      if (parsed === null) return;
      setValueAtPath(config, path, parsed);
      return;
    }
    setValueAtPath(config, path, value);
  });

  const nextConfig = stripAuthoritativeSessionGateFields(config) as AnyRecord;

  const sponsored = buildSponsoredFromGates({
    gatesByResource: gateSnapshot,
    defaultProvider:
      metadataObj?.ai?.models?.fast?.provider ||
      metadataObj?.ai?.models?.thinking?.provider ||
      metadataObj?.ai?.mode ||
      '',
  });
  if (sponsored) {
    nextConfig.sponsored = sponsored;
  } else if (hasOnChainGateData) {
    delete nextConfig.sponsored;
  }

  nextConfig.__registry = {
    registryChainId: Number(registryChainId || 0) || null,
    chainId: Number(session.chainId || 0) || null,
    metadataURI: session.metadataURI || '',
    encryptedMetadataURI: session.encryptedMetadataURI || '',
    adminAddress: session.adminAddress || null,
    updatedAt: session.updatedAt || null,
    sessionId: sessionId || null,
    sessionIdHex: sessionIdHex || null,
    fields: fields,
    gateAuthority: hasOnChainGateData ? 'onchain' : 'unknown',
    gatesByResource: gateSnapshot,
    metadataLoadState: toStr(metadataLoadState).trim() || 'loaded',
    metadataDefaultedContractKeys,
  };

  return normalizeSessionNaming(nextConfig) as AnyRecord;
};

const mergeSessionFieldsIntoCachedConfig = ({
  baseConfig,
  session,
  fieldsByKey,
  registryChainId,
}: {
  baseConfig?: AnyRecord | null;
  session?: AnyRecord | null;
  fieldsByKey?: AnyRecord | null;
  registryChainId?: number | string | null;
}) => {
  const base = normalizeSessionNaming(
    baseConfig && typeof baseConfig === 'object' ? { ...baseConfig } : {},
  ) as AnyRecord;
  const registryMeta = base.__registry && typeof base.__registry === 'object' ? base.__registry : {};
  const sessionIdHex = normalizeSessionIdHex(session?.sessionIdHex || session?.sessionId || registryMeta.sessionIdHex);
  const sessionId = formatSessionId(sessionIdHex);
  const networkChainId = Number(session?.chainId || base.networkChainId || registryMeta.chainId || 0) || null;
  const config: AnyRecord = {
    ...base,
    slug: normalizeSlug(session?.slug || base.slug),
    ...(sessionId ? { sessionId } : {}),
    networkChainId,
  };

  const resolvedChainId = Number(networkChainId || 0) || 0;
  const chainContractsRaw: AnyRecord = resolvedChainId ? getSessionContractsForChain(resolvedChainId) : {};
  const chainContracts = REGISTRY_CONTRACT_DEFAULT_KEYS.reduce<AnyRecord>((acc, key) => {
    const value = toStr(chainContractsRaw?.[key]).trim();
    if (!value) return acc;
    acc[key] = { address: value, chainId: resolvedChainId };
    return acc;
  }, {});
  const registryAddress = toStr(getSessionRegistryAddress(resolvedChainId)).trim();
  if (registryAddress) {
    chainContracts.sessionRegistry = { address: registryAddress, chainId: resolvedChainId };
  }
  config.contracts = mergeSessionContractMaps(chainContracts, base.contracts, config.contracts);

  const fields = {
    ...(registryMeta.fields && typeof registryMeta.fields === 'object' ? registryMeta.fields : {}),
    ...(fieldsByKey && typeof fieldsByKey === 'object' ? fieldsByKey : {}),
  };
  Object.entries(FIELD_PATHS).forEach(([key, path]) => {
    const value = toStr(fields[key] || '').trim();
    if (!value) return;
    if (SPONSORED_FIELD_KEY_SET.has(key)) {
      const parsed = parseBool(value);
      if (parsed === null) return;
      setValueAtPath(config, path, parsed);
      return;
    }
    setValueAtPath(config, path, value);
  });

  config.__registry = {
    ...registryMeta,
    registryChainId: Number(registryChainId || registryMeta.registryChainId || 0) || null,
    chainId: Number(session?.chainId || registryMeta.chainId || 0) || null,
    metadataURI: session?.metadataURI || registryMeta.metadataURI || '',
    encryptedMetadataURI: session?.encryptedMetadataURI || registryMeta.encryptedMetadataURI || '',
    adminAddress: session?.adminAddress || registryMeta.adminAddress || null,
    updatedAt: session?.updatedAt || registryMeta.updatedAt || null,
    sessionId: sessionId || registryMeta.sessionId || null,
    sessionIdHex: sessionIdHex || registryMeta.sessionIdHex || null,
    fields,
    metadataLoadState: registryMeta.metadataLoadState || 'fields-only',
  };

  return normalizeSessionNaming(config);
};

const addSessionConfigToCache = (cache: RegistryCache | null, config: AnyRecord | null, opts: AnyRecord = {}) => {
  if (!cache || !config || typeof config !== 'object') return;
  const slug = normalizeSlug(config.slug);

  cache.sessions = cache.sessions || {};
  cache.groups = cache.groups || cache.sessions;
  cache.sessionsById = cache.sessionsById || {};
  cache.chains = cache.chains || {};

  cache.sessions[slug] = config;
  cache.groups[slug] = config;

  const sessionIdHex = normalizeSessionIdHex(config?.__registry?.sessionIdHex || config?.sessionId);
  if (sessionIdHex) {
    const sessionId = formatSessionId(sessionIdHex);
    cache.sessionsById[sessionIdHex] = config;
    if (sessionId) cache.sessionsById[sessionId] = config;
  }

  const registryChainId =
    Number(opts.registryChainId || config?.__registry?.registryChainId || config?.__registry?.chainId || 0) || null;
  if (registryChainId) {
    const chainKey = String(registryChainId);
    const chainEntry = opts.chainEntry ||
      cache.chains[chainKey] || {
        registryAddress: resolveRegistryAddress(registryChainId),
        chainId: registryChainId,
        sessions: {},
        sessionsById: {},
      };
    chainEntry.sessions = chainEntry.sessions || {};
    chainEntry.sessionsById = chainEntry.sessionsById || {};
    chainEntry.sessions[slug] = config;
    if (sessionIdHex) {
      const sessionId = formatSessionId(sessionIdHex);
      chainEntry.sessionsById[sessionIdHex] = config;
      if (sessionId) chainEntry.sessionsById[sessionId] = config;
    }
    cache.chains[chainKey] = chainEntry;
  }
};

const getCachedSessionRegistryChainId = (config: AnyRecord | null) => {
  const chainId =
    Number(
      config?.__registry?.registryChainId ||
        config?.__registry?.chainId ||
        config?.networkChainId ||
        config?.contracts?.sessionRegistry?.chainId ||
        config?.contracts?.surveys?.chainId ||
        config?.contracts?.sbtFactory?.chainId ||
        0,
    ) || 0;
  return chainId > 0 ? chainId : 0;
};

const decodeSessionTuple = (tuple: AnyRecord | null) => {
  if (!tuple) return null;
  const sessionIdHex = normalizeSessionIdHex(tuple[7]);
  const sessionId = formatSessionId(sessionIdHex);
  return {
    slug: tuple[0],
    chainId: Number(tuple[1] || 0) || null,
    metadataURI: tuple[2] || '',
    encryptedMetadataURI: tuple[3] || '',
    adminAddress: tuple[4] || '',
    createdAt: tuple[5] ? Number(tuple[5]) : null,
    updatedAt: tuple[6] ? Number(tuple[6]) : null,
    sessionId,
    sessionIdHex,
  };
};

const isNotFoundTupleError = (err: unknown) => {
  const error = err as AnyRecord;
  const code = error?.code ?? error?.error?.code ?? '';
  if (code === 'CALL_EXCEPTION') return true;
  const msg = String(error?.message || error?.reason || '').toLowerCase();
  return msg.includes('call exception') || msg.includes('execution reverted');
};

const resolveSessionTuple = async ({
  contract,
  registrySlug,
  sessionIdHex,
}: {
  contract?: AnyRecord | null;
  registrySlug?: string;
  sessionIdHex?: string;
}) => {
  if (!contract) return null;
  if (sessionIdHex && typeof contract.getSessionById === 'function') {
    try {
      return await contract.getSessionById(sessionIdHex);
    } catch (err) {
      // Treat call reverts as "not found" (or legacy registry lacking this method), but
      // preserve real RPC/network failures for callers that want to retry.
      if (isNotFoundTupleError(err)) return null;
      throw err;
    }
  }
  if (!registrySlug) return null;
  if (typeof contract.getSessionBySlug !== 'function') return null;
  try {
    return await contract.getSessionBySlug(registrySlug);
  } catch (err) {
    if (isNotFoundTupleError(err)) return null;
    throw err;
  }
};

export const fetchSessionFromRegistry = async (
  { chainId, slug, sessionId, providerLike, account, lit, bootstrapRpc } = {} as AnyRecord,
) => {
  const resolvedChainId = Number(chainId || 0) || 0;
  if (!resolvedChainId) throw new Error('Registry chain id is required.');
  const useBootstrapRpc = typeof bootstrapRpc === 'boolean' ? bootstrapRpc : true;
  const registrySlug = slug != null ? toRegistrySlug(slug) : '';
  const sessionIdHex = normalizeSessionIdHex(sessionId);
  if (!registrySlug && !sessionIdHex) return null;

  let contract: AnyRecord | null = getRegistryContract(resolvedChainId, null, { bootstrapRpc: useBootstrapRpc });
  if (!contract && providerLike) {
    const provider = cryptoUtils._getProvider(providerLike || 'wagmi') as ethers.providers.ExternalProvider;
    contract = getRegistryContract(resolvedChainId, new ethers.providers.Web3Provider(provider, 'any'), {
      bootstrapRpc: useBootstrapRpc,
    });
  }
  if (!contract) throw new Error('Session registry contract not configured.');

  const tuple = await resolveSessionTuple({ contract, registrySlug, sessionIdHex });
  const session = decodeSessionTuple(tuple);
  if (!session || !session.slug) return null;

  let metadata = null;
  const hasMetadataUri = !!(session.metadataURI || session.encryptedMetadataURI);
  if (session.metadataURI) {
    metadata = await fetchMetadataFromArweave(session.metadataURI, {
      chainId: session.chainId || resolvedChainId,
      slug: session.slug || registrySlug,
      caller: 'fetchSessionFromRegistry.metadataURI',
    });
  } else if (session.encryptedMetadataURI) {
    const encrypted = await fetchMetadataFromArweave(session.encryptedMetadataURI, {
      chainId: session.chainId || resolvedChainId,
      slug: session.slug || registrySlug,
      caller: 'fetchSessionFromRegistry.encryptedMetadataURI',
    });
    const decrypted = await tryDecryptEnvelope(encrypted, {
      account,
      providerLike,
      chainId: session.chainId || resolvedChainId,
      lit,
    });
    metadata = decrypted || null;
  }

  const gatesByResource: RegistryGateMap = {};
  const gateEntries = await Promise.all(
    DEFAULT_RESOURCES.map(async (resourceKey) => {
      const gate = await fetchGateForResource(contract, session.slug, resourceKey);
      return { resourceKey, gate };
    }),
  );
  gateEntries.forEach(({ resourceKey, gate }) => {
    gatesByResource[resourceKey] = gate;
  });

  const fieldsByKey = await fetchSessionFields(contract, session.slug);

  return buildSessionConfigFromRegistry({
    session,
    metadata,
    gatesByResource,
    fieldsByKey,
    registryChainId: resolvedChainId,
    metadataLoadState: resolveMetadataLoadState({ metadata, hasMetadataUri }),
  });
};

export const upsertSessionRegistryCache = ({ config } = {} as AnyRecord) => {
  if (typeof window === 'undefined') return null;
  if (!config || typeof config !== 'object') return null;
  const slug = normalizeSlug(config.slug);
  const registryChainId = Number(config?.__registry?.registryChainId || config?.__registry?.chainId || 0) || null;
  const sessionIdHex = normalizeSessionIdHex(config?.__registry?.sessionIdHex || config?.sessionId);
  const sessionId = sessionIdHex ? formatSessionId(sessionIdHex) : '';

  const cache: RegistryCache = sessionRegistryStore.readCache() || {
    ts: Date.now(),
    chains: {},
    sessions: {},
    groups: {},
    sessionsById: {},
  };

  cache.ts = Date.now();
  cache.sessions = cache.sessions || {};
  cache.groups = cache.groups || cache.sessions;
  cache.sessionsById = cache.sessionsById || {};
  cache.chains = cache.chains || {};

  cache.sessions[slug] = config;
  cache.groups[slug] = config;

  if (sessionIdHex) {
    cache.sessionsById[sessionIdHex] = config;
    if (sessionId) cache.sessionsById[sessionId] = config;
  }

  if (registryChainId) {
    const chainKey = String(registryChainId);
    const chainEntry = cache.chains[chainKey] || {
      registryAddress: resolveRegistryAddress(registryChainId),
      chainId: registryChainId,
      sessions: {},
      sessionsById: {},
    };
    chainEntry.sessions = chainEntry.sessions || {};
    chainEntry.sessionsById = chainEntry.sessionsById || {};
    chainEntry.sessions[slug] = config;
    if (sessionIdHex) {
      chainEntry.sessionsById[sessionIdHex] = config;
      if (sessionId) chainEntry.sessionsById[sessionId] = config;
    }
    cache.chains[chainKey] = chainEntry;
  }

  try {
    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    surveysLog.warn('sessionRegistry: fallback', e);
  }

  notifySessionRegistryCacheUpdated();

  return cache;
};

export const refreshSessionRegistryFieldsCache = async ({
  chainId,
  slug,
  sessionId,
  providerLike,
  fieldKeys,
  bootstrapRpc,
}: AnyRecord = {}) => {
  const registrySlug = toRegistrySlug(slug || '');
  const existingConfig = sessionRegistryStore.getSessionConfig(registrySlug);
  const existingRegistry =
    existingConfig?.__registry && typeof existingConfig.__registry === 'object' ? existingConfig.__registry : {};
  const resolvedChainId =
    Number(
      chainId || existingRegistry.registryChainId || existingRegistry.chainId || existingConfig?.networkChainId || 0,
    ) || 0;
  if (!resolvedChainId) throw new Error('Registry chain id is required.');

  const useBootstrapRpc = typeof bootstrapRpc === 'boolean' ? bootstrapRpc : true;
  let contract = getRegistryContract(resolvedChainId, null, { bootstrapRpc: useBootstrapRpc });
  if (!contract && providerLike) {
    const provider = cryptoUtils._getProvider(providerLike || 'wagmi');
    contract = getRegistryContract(resolvedChainId, new ethers.providers.Web3Provider(provider, 'any'), {
      bootstrapRpc: useBootstrapRpc,
    });
  }
  if (!contract) throw new Error('Session registry contract not configured.');

  const sessionIdHex = normalizeSessionIdHex(sessionId);
  const tuple = await resolveSessionTuple({
    contract,
    registrySlug,
    sessionIdHex,
  });
  const session = decodeSessionTuple(tuple);
  if (!session || !session.slug) return null;

  const fieldsByKey = await fetchSessionFields(
    contract,
    session.slug,
    Array.isArray(fieldKeys) && fieldKeys.length ? fieldKeys : DEFAULT_FIELDS,
  );
  const config = mergeSessionFieldsIntoCachedConfig({
    baseConfig: existingConfig,
    session,
    fieldsByKey,
    registryChainId: resolvedChainId,
  });
  upsertSessionRegistryCache({ config });
  return config;
};

export const loadSessionRegistryCache = async (
  { chainIds, providerLike, account, lit, force, bootstrapRpc } = {} as AnyRecord,
) => {
  if (!USE_ONCHAIN_SESSION_REGISTRY && !force) return null;
  const useBootstrapRpc = typeof bootstrapRpc === 'boolean' ? bootstrapRpc : true;

  const previousCache = sessionRegistryStore.readCache();
  let hadLoadErrors = false;
  let walletProvider: ethers.providers.Web3Provider | null = null;
  let walletChainId = 0;

  if (providerLike) {
    try {
      const provider = cryptoUtils._getProvider(providerLike || 'wagmi') as AnyRecord;
      if (provider && typeof provider.request === 'function') {
        const ethersProvider = new ethers.providers.Web3Provider(provider as ethers.providers.ExternalProvider, 'any');
        const net = await ethersProvider.getNetwork();
        walletChainId = Number(net?.chainId || 0) || 0;
        walletProvider = ethersProvider;
      }
    } catch (_) {
      walletProvider = null;
      walletChainId = 0;
    }
  }

  const ids = Array.isArray(chainIds) && chainIds.length ? chainIds : getSessionRegistryChainIds();

  const cache: RegistryCache = {
    ts: Date.now(),
    chains: {},
    sessions: {},
    groups: {},
    sessionsById: {},
  };

  const chainResults = await mapWithConcurrency(ids, REGISTRY_CHAIN_LOAD_CONCURRENCY, async (chainId) => {
    const addr = resolveRegistryAddress(chainId);
    if (!addr) return null;
    const contract = getRegistryContract(
      chainId,
      walletProvider && walletChainId === Number(chainId || 0) ? walletProvider : null,
      { bootstrapRpc: useBootstrapRpc },
    );
    if (!contract) return null;

    let count = 0;
    try {
      count = Number(await contract.getSessionCount());
    } catch (_) {
      return { chainId, chainEntry: null, configs: [], hadLoadErrors: true };
    }

    const chainEntry: RegistryCache = {
      registryAddress: addr,
      chainId,
      sessions: {},
      sessionsById: {},
    };

    const sessionIndexes = Array.from({ length: Math.max(0, Math.floor(count)) }, (_entry, index) => index);
    const sessionResults = await mapWithConcurrency(sessionIndexes, REGISTRY_SESSION_LOAD_CONCURRENCY, async (i) => {
      let slug = '';
      try {
        slug = await contract.getSessionSlugByIndex(i);
      } catch (_) {
        return { config: null, hadLoadErrors: true };
      }
      if (!slug) return { config: null, hadLoadErrors: false };
      let tuple = null;
      try {
        tuple = await contract.getSessionBySlug(slug);
      } catch (_) {
        return { config: null, hadLoadErrors: true };
      }
      const session = decodeSessionTuple(tuple);
      if (!session) return { config: null, hadLoadErrors: false };

      let metadata = null;
      const hasMetadataUri = !!(session.metadataURI || session.encryptedMetadataURI);
      if (session.metadataURI) {
        metadata = await fetchMetadataFromArweave(session.metadataURI, {
          chainId: session.chainId || chainId,
          slug: session.slug || slug,
          caller: 'loadSessionRegistryCache.metadataURI',
        });
      } else if (session.encryptedMetadataURI) {
        const encrypted = await fetchMetadataFromArweave(session.encryptedMetadataURI, {
          chainId: session.chainId || chainId,
          slug: session.slug || slug,
          caller: 'loadSessionRegistryCache.encryptedMetadataURI',
        });
        const decrypted = await tryDecryptEnvelope(encrypted, {
          account,
          providerLike,
          chainId: session.chainId || chainId,
          lit,
        });
        metadata = decrypted || null;
      }

      const gatesByResource: RegistryGateMap = {};
      const gateEntries = await Promise.all(
        DEFAULT_RESOURCES.map(async (resourceKey) => {
          const gate = await fetchGateForResource(contract, slug, resourceKey);
          return { resourceKey, gate };
        }),
      );
      gateEntries.forEach(({ resourceKey, gate }) => {
        gatesByResource[resourceKey] = gate;
      });

      const fieldsByKey = await fetchSessionFields(contract, slug);

      const config = buildSessionConfigFromRegistry({
        session,
        metadata,
        gatesByResource,
        fieldsByKey,
        registryChainId: chainId,
        metadataLoadState: resolveMetadataLoadState({ metadata, hasMetadataUri }),
      });
      return { config, hadLoadErrors: false };
    });

    return {
      chainId,
      chainEntry,
      configs: sessionResults.map((result) => result?.config).filter((config): config is AnyRecord => !!config),
      hadLoadErrors: sessionResults.some((result) => !!result?.hadLoadErrors),
    };
  });

  chainResults.forEach((result) => {
    if (!result) return;
    if (result.hadLoadErrors) hadLoadErrors = true;
    if (!result.chainEntry) return;
    result.configs.forEach((config) => {
      addSessionConfigToCache(cache, config, {
        chainEntry: result.chainEntry,
        registryChainId: result.chainId,
      });
    });
    cache.chains[String(result.chainId)] = result.chainEntry;
  });

  const previousSessions =
    previousCache?.sessions && typeof previousCache.sessions === 'object' ? previousCache.sessions : null;
  const requestedChainIds = new Set(
    (Array.isArray(ids) ? ids : [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .map((id) => Math.floor(id)),
  );
  const previousCount = previousSessions ? Object.keys(previousSessions).length : 0;
  const currentCount = Object.keys(cache.sessions || {}).length;
  const shouldMergePrevious = hadLoadErrors || (previousCount && currentCount < previousCount);

  if (shouldMergePrevious && previousSessions) {
    Object.entries(previousSessions).forEach(([slug, cfg]) => {
      const previousConfig = cfg as AnyRecord;
      const previousChainId = getCachedSessionRegistryChainId(previousConfig);
      // Preserve stale entries only for the chain(s) we actually tried to refresh.
      // This prevents a partial OP Sepolia bootstrap from resurrecting old Base sessions.
      if (requestedChainIds.size > 0 && (!previousChainId || !requestedChainIds.has(previousChainId))) {
        return;
      }
      if (!cache.sessions[slug]) addSessionConfigToCache(cache, previousConfig);
    });
  }

  cache.__hadLoadErrors = !!hadLoadErrors;
  try {
    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    surveysLog.warn('sessionRegistry: fallback', e);
  }
  notifySessionRegistryCacheUpdated();

  try {
    Object.defineProperty(cache, '__loadMeta', {
      value: {
        hadLoadErrors: !!hadLoadErrors,
        loadedChainIds: Array.isArray(ids) ? [...ids] : [],
        sessionCount: Object.keys(cache.sessions || {}).length,
        ts: Date.now(),
      },
      enumerable: false,
      configurable: true,
      writable: true,
    });
  } catch (_) {
    cache.__loadMeta = {
      hadLoadErrors: !!hadLoadErrors,
      loadedChainIds: Array.isArray(ids) ? [...ids] : [],
      sessionCount: Object.keys(cache.sessions || {}).length,
      ts: Date.now(),
    };
  }

  return cache;
};

// Back-compat aliases during the session-registry rename.
export const loadGroupRegistryCache = loadSessionRegistryCache;

export const uploadSessionMetadata = async (metadata: AnyRecord, opts: AnyRecord = {}) => {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('Metadata must be an object.');
  }
  const payload = stripAuthoritativeSessionGateFields({ ...metadata });
  const txId = await arweaveClient.uploadDataToArweave(payload, 'json', opts);
  return {
    txId,
    arweaveUrl: `https://arweave.net/${txId}`,
    metadataUri: `ar://${txId}`,
  };
};

export const registerSessionOnChain = async (
  {
    providerLike,
    chainId,
    registryAddress: registryAddressOverride,
    slug,
    sessionId,
    sessionChainId,
    metadataURI,
    encryptedMetadataURI,
    gateSelections,
    sessionFields,
    gasLimitOverride,
    gasPriceGwei,
    maxFeePerGasGwei,
    maxPriorityFeePerGasGwei,
    onTxHash,
  } = {} as AnyRecord,
) => {
  const registryAddress = toStr(registryAddressOverride).trim() || resolveRegistryAddress(chainId);
  if (!registryAddress) {
    throw new Error('Session registry address not configured for this chain.');
  }
  const registrySlug = validateRegistrySlugForWriteOrThrow(slug);
  const sessionIdHex = normalizeSessionIdHex(sessionId);
  if (!sessionIdHex) {
    throw new Error('Session ID (UUID) is required.');
  }

  const { signingProvider, ethersProvider, signer } = getWriteContextFromProviderLike(providerLike);
  const writeChainId = await assertSignerOnRegistryWriteChain({ signer, ethersProvider, chainId });
  const contract = new ethers.Contract(registryAddress, SESSION_REGISTRY_ABI, signer);
  const readContract: AnyRecord = getRegistryContract(writeChainId, null, { bootstrapRpc: true }) || contract;

  let sessionIdAlreadyExists = false;
  try {
    if (typeof readContract?.sessionIdExists === 'function') {
      sessionIdAlreadyExists = !!(await readRegistryMethodWithRpcFallback({
        chainId: writeChainId,
        registryAddress,
        method: 'sessionIdExists',
        args: [sessionIdHex],
        contract: readContract,
      }));
    }
  } catch (error) {
    const err = error as AnyRecord;
    throw new Error(
      `Failed to verify sessionId ${formatSessionId(sessionIdHex) || sessionIdHex} on SessionRegistry ${registryAddress}: ${toStr(err?.message || error).trim() || 'unknown error'}.`,
    );
  }
  if (sessionIdAlreadyExists) {
    throw new Error(`Session ID ${formatSessionId(sessionIdHex) || sessionIdHex} is already registered on-chain.`);
  }

  if (typeof readContract?.sessionExists === 'function') {
    let slugAlreadyExists = false;
    try {
      slugAlreadyExists = !!(await readRegistryMethodWithRpcFallback({
        chainId: writeChainId,
        registryAddress,
        method: 'sessionExists',
        args: [registrySlug],
        contract: readContract,
      }));
    } catch (error) {
      const err = error as AnyRecord;
      throw new Error(
        `Failed to check session slug "${registrySlug}" on SessionRegistry ${registryAddress}: ${toStr(err?.message || error).trim() || 'unknown error'}.`,
      );
    }
    if (slugAlreadyExists) {
      throw new Error(`Session slug "${registrySlug}" is already registered on-chain.`);
    }
  }

  const gasOverride = Number(gasLimitOverride || 0);
  const normalizedGasOverride = Number.isFinite(gasOverride) && gasOverride > 0 ? Math.floor(gasOverride) : null;
  // Registry writes default to a deterministic fallback gas limit unless the caller supplied an override.
  const effectiveGasLimit = normalizedGasOverride;

  const txs: Array<{ action: string; hash: string }> = [];
  const recordTx = (action: string, txResponse: AnyRecord) => {
    const hash = txResponse?.hash || txResponse?.transactionHash;
    if (!hash) return;
    if (txs.some((entry) => entry.action === action && entry.hash === hash)) {
      return;
    }
    const entry = { action, hash };
    txs.push(entry);
    if (typeof onTxHash === 'function') {
      onTxHash(entry, [...txs]);
    }
  };

  const fieldEntries = sessionFields && typeof sessionFields === 'object' ? Object.entries(sessionFields) : [];
  const fieldInputs = fieldEntries.map(([key, value]) => ({
    key: String(key),
    value: serializeFieldValue(value),
  }));

  const selections: AnyRecord = gateSelections && typeof gateSelections === 'object' ? gateSelections : {};
  const gateInputs = Object.entries(selections).reduce<
    Array<{
      resourceKey: string;
      sbtAddresses: string[];
      chainId: number;
      mode: number;
      perMemberLimit: number;
    }>
  >((acc, [resourceKey, gate]) => {
    const gateRecord = gate as AnyRecord;
    if (!gateRecord || !Array.isArray(gateRecord.sbts) || !gateRecord.sbts.length) return acc;
    const sbtAddresses = gateRecord.sbts.map((sbt: AnyRecord) => sbt.address).filter(Boolean);
    if (!sbtAddresses.length) return acc;
    acc.push({
      resourceKey,
      sbtAddresses,
      chainId: Number(gateRecord.chainId || sessionChainId || chainId || 0),
      mode: gateRecord.mode === 'all' ? 1 : 0,
      perMemberLimit: Number(gateRecord.perMemberLimit || 0) || 0,
    });
    return acc;
  }, []);

  if (typeof contract.createSession !== 'function') {
    throw new Error('SessionRegistry does not support createSession. Check the registry deployment.');
  }

  const txFeeOverrides = await resolveTxFeeOverrides({
    signer,
    chainId: writeChainId,
    gasPriceGwei,
    maxFeePerGasGwei,
    maxPriorityFeePerGasGwei,
  });
  const nonceTracker: NonceTracker = { nextNonce: null };

  // Observed Base Sepolia gas: createSession ~350k, setSessionFields ~275k; setResourceGates depends on gate count.
  // SessionRegistry requires a small creation fee to prevent spam session creation.
  let creationFee;
  try {
    creationFee = await readRegistryMethodWithRpcFallback({
      chainId: writeChainId,
      registryAddress,
      method: 'SESSION_CREATION_FEE',
      args: [],
      contract: readContract || contract,
    });
  } catch (e) {
    const err = e as AnyRecord;
    if (err.code === 'CALL_EXCEPTION') {
      creationFee = null;
    } else {
      throw e;
    }
  }
  const createSessionOverrides = creationFee != null ? { value: creationFee } : {};
  const createTx = await sendWithNonceRetry({
    estimate: null,
    send: (overrides: TxFeeOverrides) =>
      sendRegistryContractWriteViaProvider({
        signingProvider,
        ethersProvider,
        signer,
        contract,
        method: 'createSession',
        args: [
          registrySlug,
          sessionIdHex,
          Number(sessionChainId || chainId || 0),
          toStr(metadataURI),
          toStr(encryptedMetadataURI),
        ],
        txOverrides: { ...overrides, ...createSessionOverrides },
        onBroadcastTxHash: (txHash: unknown) => recordTx('createSession', { hash: txHash as string }),
        rpcFunction: 'createSession',
        revertMessage: 'createSession transaction reverted on-chain.',
      }),
    gasLimitOverride: effectiveGasLimit,
    signer,
    txOverrides: txFeeOverrides,
    fallbackGasLimit: REGISTRY_GAS_FALLBACKS.createSession,
    feeFallbackChainId: writeChainId,
    txLabel: 'createSession',
    preferFallbackGasLimit: true,
    nonceTracker,
  });
  recordTx('createSession', createTx);
  await createTx.wait();

  if (fieldInputs.length) {
    const fieldKeys = fieldInputs.map((entry) => entry.key);
    const fieldValues = fieldInputs.map((entry) => entry.value);
    if (typeof contract.setSessionFields === 'function') {
      const tx = await sendWithNonceRetry({
        estimate: null,
        send: (overrides: TxFeeOverrides) =>
          sendRegistryContractWriteViaProvider({
            signingProvider,
            ethersProvider,
            signer,
            contract,
            method: 'setSessionFields',
            args: [registrySlug, fieldKeys, fieldValues],
            txOverrides: overrides,
            onBroadcastTxHash: (txHash: unknown) => recordTx('setSessionFields', { hash: txHash as string }),
            rpcFunction: 'setSessionFields',
            revertMessage: 'setSessionFields transaction reverted on-chain.',
          }),
        gasLimitOverride: effectiveGasLimit,
        signer,
        txOverrides: txFeeOverrides,
        fallbackGasLimit: REGISTRY_GAS_FALLBACKS.setSessionFields(fieldKeys.length),
        feeFallbackChainId: writeChainId,
        txLabel: 'setSessionFields',
        preferFallbackGasLimit: true,
        nonceTracker,
      });
      recordTx('setSessionFields', tx);
      await tx.wait();
    } else if (typeof contract.setSessionField === 'function') {
      for (let i = 0; i < fieldKeys.length; i += 1) {
        const tx = await sendWithNonceRetry({
          estimate: null,
          send: (overrides: TxFeeOverrides) =>
            sendRegistryContractWriteViaProvider({
              signingProvider,
              ethersProvider,
              signer,
              contract,
              method: 'setSessionField',
              args: [registrySlug, fieldKeys[i], fieldValues[i]],
              txOverrides: overrides,
              onBroadcastTxHash: (txHash: unknown) => recordTx('setSessionField', { hash: txHash as string }),
              rpcFunction: 'setSessionField',
              revertMessage: 'setSessionField transaction reverted on-chain.',
            }),
          gasLimitOverride: effectiveGasLimit,
          signer,
          txOverrides: txFeeOverrides,
          fallbackGasLimit: REGISTRY_GAS_FALLBACKS.setSessionField,
          feeFallbackChainId: writeChainId,
          txLabel: 'setSessionField',
          preferFallbackGasLimit: true,
          nonceTracker,
        });
        recordTx('setSessionField', tx);
        await tx.wait();
      }
    }
  }

  if (gateInputs.length) {
    if (typeof contract.setResourceGates === 'function') {
      const tx = await sendWithNonceRetry({
        estimate: null,
        send: (overrides: TxFeeOverrides) =>
          sendRegistryContractWriteViaProvider({
            signingProvider,
            ethersProvider,
            signer,
            contract,
            method: 'setResourceGates',
            args: [registrySlug, gateInputs],
            txOverrides: overrides,
            onBroadcastTxHash: (txHash: unknown) => recordTx('setResourceGates', { hash: txHash as string }),
            rpcFunction: 'setResourceGates',
            revertMessage: 'setResourceGates transaction reverted on-chain.',
          }),
        gasLimitOverride: effectiveGasLimit,
        signer,
        txOverrides: txFeeOverrides,
        fallbackGasLimit: REGISTRY_GAS_FALLBACKS.setResourceGates(
          gateInputs.length,
          gateInputs.reduce((sum, g) => sum + (g.sbtAddresses?.length || 0), 0),
        ),
        feeFallbackChainId: writeChainId,
        txLabel: 'setResourceGates',
        preferFallbackGasLimit: true,
        nonceTracker,
      });
      recordTx('setResourceGates', tx);
      await tx.wait();
    } else if (typeof contract.setResourceGate === 'function') {
      for (let i = 0; i < gateInputs.length; i += 1) {
        const gate = gateInputs[i];
        const tx = await sendWithNonceRetry({
          estimate: null,
          send: (overrides: TxFeeOverrides) =>
            sendRegistryContractWriteViaProvider({
              signingProvider,
              ethersProvider,
              signer,
              contract,
              method: 'setResourceGate',
              args: [registrySlug, gate.resourceKey, gate.sbtAddresses, gate.chainId, gate.mode, gate.perMemberLimit],
              txOverrides: overrides,
              rpcFunction: 'setResourceGate',
              revertMessage: 'setResourceGate transaction reverted on-chain.',
            }),
          gasLimitOverride: effectiveGasLimit,
          signer,
          txOverrides: txFeeOverrides,
          fallbackGasLimit: REGISTRY_GAS_FALLBACKS.setResourceGate(gate.sbtAddresses?.length || 1),
          feeFallbackChainId: writeChainId,
          txLabel: 'setResourceGate',
          preferFallbackGasLimit: true,
          nonceTracker,
        });
        recordTx('setResourceGate', tx);
        await tx.wait();
      }
    }
  }

  return { txs };
};

export const registerGroupOnChain = registerSessionOnChain;

export const setSessionFieldsOnChain = async (
  {
    providerLike,
    chainId,
    slug,
    fields,
    gasLimitOverride,
    gasPriceGwei,
    maxFeePerGasGwei,
    maxPriorityFeePerGasGwei,
  } = {} as AnyRecord,
) => {
  if (slug == null) throw new Error('Slug is required.');
  const registryAddress = resolveRegistryAddress(chainId);
  if (!registryAddress) {
    throw new Error('Session registry address not configured for this chain.');
  }
  const registrySlug = validateRegistrySlugForWriteOrThrow(slug);
  const { signingProvider, ethersProvider, signer } = getWriteContextFromProviderLike(providerLike);
  const writeChainId = await assertSignerOnRegistryWriteChain({ signer, ethersProvider, chainId });
  const contract = new ethers.Contract(registryAddress, SESSION_REGISTRY_ABI, signer);
  const txFeeOverrides = await resolveTxFeeOverrides({
    signer,
    chainId: writeChainId,
    gasPriceGwei,
    maxFeePerGasGwei,
    maxPriorityFeePerGasGwei,
  });
  const nonceTracker: NonceTracker = { nextNonce: null };
  const gasOverride = Number(gasLimitOverride || 0);
  const normalizedGasOverride = Number.isFinite(gasOverride) && gasOverride > 0 ? Math.floor(gasOverride) : null;

  const entries =
    fields && typeof fields === 'object' ? Object.entries(fields).filter(([, value]) => value != null) : [];
  if (!entries.length) return { skipped: true };

  const fieldKeys = entries.map(([key]) => String(key));
  const fieldValues = entries.map(([, value]) => serializeFieldValue(value));
  if (typeof contract.setSessionFields === 'function') {
    const tx = await sendWithNonceRetry({
      estimate: null,
      send: (overrides: TxFeeOverrides) =>
        sendRegistryContractWriteViaProvider({
          signingProvider,
          ethersProvider,
          signer,
          contract,
          method: 'setSessionFields',
          args: [registrySlug, fieldKeys, fieldValues],
          txOverrides: overrides,
          rpcFunction: 'setSessionFields',
          revertMessage: 'setSessionFields transaction reverted on-chain.',
        }),
      gasLimitOverride: normalizedGasOverride,
      signer,
      txOverrides: txFeeOverrides,
      fallbackGasLimit: REGISTRY_GAS_FALLBACKS.setSessionFields(fieldKeys.length),
      feeFallbackChainId: writeChainId,
      txLabel: 'setSessionFields',
      preferFallbackGasLimit: true,
      nonceTracker,
    });
    await tx.wait();
    return { ok: true };
  }

  if (typeof contract.setSessionField !== 'function') {
    throw new Error('SessionRegistry does not support session fields.');
  }

  for (let i = 0; i < fieldKeys.length; i += 1) {
    const tx = await sendWithNonceRetry({
      estimate: null,
      send: (overrides: TxFeeOverrides) =>
        sendRegistryContractWriteViaProvider({
          signingProvider,
          ethersProvider,
          signer,
          contract,
          method: 'setSessionField',
          args: [registrySlug, fieldKeys[i], fieldValues[i]],
          txOverrides: overrides,
          rpcFunction: 'setSessionField',
          revertMessage: 'setSessionField transaction reverted on-chain.',
        }),
      gasLimitOverride: normalizedGasOverride,
      signer,
      txOverrides: txFeeOverrides,
      fallbackGasLimit: REGISTRY_GAS_FALLBACKS.setSessionField,
      feeFallbackChainId: writeChainId,
      txLabel: 'setSessionField',
      preferFallbackGasLimit: true,
      nonceTracker,
    });
    await tx.wait();
  }
  return { ok: true };
};

export const setGroupFieldsOnChain = setSessionFieldsOnChain;

export const updateSessionMetadataOnChain = async (
  {
    providerLike,
    chainId,
    slug,
    metadataURI,
    encryptedMetadataURI,
    gasLimitOverride,
    gasPriceGwei,
    maxFeePerGasGwei,
    maxPriorityFeePerGasGwei,
  } = {} as AnyRecord,
) => {
  if (slug == null) throw new Error('Slug is required.');
  const registryAddress = resolveRegistryAddress(chainId);
  if (!registryAddress) {
    throw new Error('Session registry address not configured for this chain.');
  }
  const registrySlug = validateRegistrySlugForWriteOrThrow(slug);
  const { signingProvider, ethersProvider, signer } = getWriteContextFromProviderLike(providerLike);
  const writeChainId = await assertSignerOnRegistryWriteChain({ signer, ethersProvider, chainId });
  const contract = new ethers.Contract(registryAddress, SESSION_REGISTRY_ABI, signer);
  if (typeof contract.updateSessionMetadata !== 'function') {
    throw new Error('SessionRegistry does not support updateSessionMetadata.');
  }
  const txFeeOverrides = await resolveTxFeeOverrides({
    signer,
    chainId: writeChainId,
    gasPriceGwei,
    maxFeePerGasGwei,
    maxPriorityFeePerGasGwei,
  });
  const gasOverride = Number(gasLimitOverride || 0);
  const normalizedGasOverride = Number.isFinite(gasOverride) && gasOverride > 0 ? Math.floor(gasOverride) : null;
  const tx = await sendWithNonceRetry({
    estimate: null,
    send: (overrides: TxFeeOverrides) =>
      sendRegistryContractWriteViaProvider({
        signingProvider,
        ethersProvider,
        signer,
        contract,
        method: 'updateSessionMetadata',
        args: [registrySlug, toStr(metadataURI), toStr(encryptedMetadataURI)],
        txOverrides: overrides,
        rpcFunction: 'updateSessionMetadata',
        revertMessage: 'updateSessionMetadata transaction reverted on-chain.',
      }),
    gasLimitOverride: normalizedGasOverride,
    signer,
    txOverrides: txFeeOverrides,
    fallbackGasLimit: REGISTRY_GAS_FALLBACKS.updateSessionMetadata,
    feeFallbackChainId: writeChainId,
    txLabel: 'updateSessionMetadata',
    preferFallbackGasLimit: true,
  });
  await tx.wait();
  return { ok: true, txHash: toStr(tx?.hash).trim() };
};

export const setResourceGatesOnChain = async (
  {
    providerLike,
    chainId,
    slug,
    gates,
    gasLimitOverride,
    gasPriceGwei,
    maxFeePerGasGwei,
    maxPriorityFeePerGasGwei,
  } = {} as AnyRecord,
) => {
  if (slug == null) throw new Error('Slug is required.');
  const registryAddress = resolveRegistryAddress(chainId);
  if (!registryAddress) {
    throw new Error('Session registry address not configured for this chain.');
  }
  const registrySlug = validateRegistrySlugForWriteOrThrow(slug);
  const { signingProvider, ethersProvider, signer } = getWriteContextFromProviderLike(providerLike);
  const writeChainId = await assertSignerOnRegistryWriteChain({ signer, ethersProvider, chainId });
  const contract = new ethers.Contract(registryAddress, SESSION_REGISTRY_ABI, signer);
  const txFeeOverrides = await resolveTxFeeOverrides({
    signer,
    chainId: writeChainId,
    gasPriceGwei,
    maxFeePerGasGwei,
    maxPriorityFeePerGasGwei,
  });
  const nonceTracker: NonceTracker = { nextNonce: null };
  const gasOverride = Number(gasLimitOverride || 0);
  const normalizedGasOverride = Number.isFinite(gasOverride) && gasOverride > 0 ? Math.floor(gasOverride) : null;

  const gateInputs = (Array.isArray(gates) ? gates : [])
    .filter((gate: AnyRecord) => gate && Array.isArray(gate.sbtAddresses) && gate.sbtAddresses.length)
    .map((gate: AnyRecord) => ({
      resourceKey: String(gate.resourceKey || ''),
      sbtAddresses: gate.sbtAddresses,
      chainId: Number(gate.chainId || 0),
      mode: Number(gate.mode || 0),
      perMemberLimit: Number(gate.perMemberLimit || 0) || 0,
    }))
    .filter((gate) => gate.resourceKey);

  if (!gateInputs.length) {
    throw new Error('No gate addresses provided.');
  }

  const txs: Array<{ action: string; hash: string }> = [];
  if (typeof contract.setResourceGates === 'function') {
    const totalSbtAddresses = gateInputs.reduce((sum, g) => sum + (g.sbtAddresses?.length || 0), 0);
    const tx = await sendWithNonceRetry({
      estimate: null,
      send: (overrides: TxFeeOverrides) =>
        sendRegistryContractWriteViaProvider({
          signingProvider,
          ethersProvider,
          signer,
          contract,
          method: 'setResourceGates',
          args: [registrySlug, gateInputs],
          txOverrides: overrides,
          rpcFunction: 'setResourceGates',
          revertMessage: 'setResourceGates transaction reverted on-chain.',
        }),
      gasLimitOverride: normalizedGasOverride,
      signer,
      txOverrides: txFeeOverrides,
      fallbackGasLimit: REGISTRY_GAS_FALLBACKS.setResourceGates(gateInputs.length, totalSbtAddresses),
      feeFallbackChainId: writeChainId,
      txLabel: 'setResourceGates',
      preferFallbackGasLimit: true,
      nonceTracker,
    });
    txs.push({ action: 'setResourceGates', hash: toStr(tx?.hash || tx?.transactionHash) });
    await tx.wait();
    return { ok: true, txs };
  }
  if (typeof contract.setResourceGate === 'function') {
    for (let i = 0; i < gateInputs.length; i += 1) {
      const gate = gateInputs[i];
      const tx = await sendWithNonceRetry({
        estimate: null,
        send: (overrides: TxFeeOverrides) =>
          sendRegistryContractWriteViaProvider({
            signingProvider,
            ethersProvider,
            signer,
            contract,
            method: 'setResourceGate',
            args: [registrySlug, gate.resourceKey, gate.sbtAddresses, gate.chainId, gate.mode, gate.perMemberLimit],
            txOverrides: overrides,
            rpcFunction: 'setResourceGate',
            revertMessage: 'setResourceGate transaction reverted on-chain.',
          }),
        gasLimitOverride: normalizedGasOverride,
        signer,
        txOverrides: txFeeOverrides,
        fallbackGasLimit: REGISTRY_GAS_FALLBACKS.setResourceGate(gate.sbtAddresses?.length || 1),
        feeFallbackChainId: writeChainId,
        txLabel: 'setResourceGate',
        preferFallbackGasLimit: true,
        nonceTracker,
      });
      txs.push({ action: `setResourceGate:${gate.resourceKey}`, hash: toStr(tx?.hash || tx?.transactionHash) });
      await tx.wait();
    }
    return { ok: true, txs };
  }
  throw new Error('SessionRegistry does not support resource gates.');
};

export const sessionRegistryStore = {
  readCache: () => {
    if (typeof window === 'undefined') return null;
    try {
      const cache = JSON.parse(localStorage.getItem(REGISTRY_CACHE_KEY) || 'null');
      if (!cache || typeof cache !== 'object') return cache;
      if (!cache.sessions && cache.groups) cache.sessions = cache.groups;
      if (!cache.groups && cache.sessions) cache.groups = cache.sessions;
      if (!cache.sessionsById) cache.sessionsById = {};
      if (cache.sessions && !Object.keys(cache.sessionsById).length) {
        (Object.values(cache.sessions) as AnyRecord[]).forEach((cfg) => {
          const idHex = normalizeSessionIdHex(cfg?.__registry?.sessionIdHex || cfg?.sessionId);
          if (!idHex) return;
          const id = formatSessionId(idHex);
          cache.sessionsById[idHex] = cfg;
          if (id) cache.sessionsById[id] = cfg;
        });
      }
      return cache;
    } catch (_) {
      return null;
    }
  },
  getSessionConfig: (slugIn: unknown) => {
    const slug = normalizeSlug(slugIn);
    const cache = sessionRegistryStore.readCache();
    if (!cache || !cache.sessions) return null;
    return overlayCachedSessionWorkerConfig({
      slug,
      sessionConfig: cache.sessions[slug] || null,
    });
  },
  getSessionConfigById: (sessionIdIn: unknown) => {
    const cache = sessionRegistryStore.readCache();
    if (!cache || !cache.sessionsById) return null;
    const hex = normalizeSessionIdHex(sessionIdIn);
    if (hex && cache.sessionsById[hex]) {
      return overlayCachedSessionWorkerConfig({
        slug: cache.sessionsById[hex]?.slug,
        sessionConfig: cache.sessionsById[hex],
      });
    }
    const formatted = formatSessionId(sessionIdIn);
    if (formatted && cache.sessionsById[formatted]) {
      return overlayCachedSessionWorkerConfig({
        slug: cache.sessionsById[formatted]?.slug,
        sessionConfig: cache.sessionsById[formatted],
      });
    }
    return null;
  },
  getAllSessionEntries: (): SessionRegistryCacheEntry[] => {
    const cache = sessionRegistryStore.readCache();
    if (!cache || !cache.sessions) return [];
    return Object.entries(cache.sessions).map(([slug, cfg]): SessionRegistryCacheEntry => [
      slug,
      overlayCachedSessionWorkerConfig({
        slug,
        sessionConfig: cfg,
      }) || cfg,
    ]);
  },
  getAllSessionSlugs: () => {
    const cache = sessionRegistryStore.readCache();
    if (!cache || !cache.sessions) return [];
    return Object.keys(cache.sessions || {});
  },
};

export const sessionRegistryUtils = {
  normalizeSlug,
  SESSION_REGISTRY_CACHE_UPDATED_EVENT,
  toRegistrySlug,
  normalizeSessionIdHex,
  formatSessionId,
  resolveRegistryAddress,
  getRegistryContract,
  loadSessionRegistryCache,
  refreshSessionRegistryFieldsCache,
  sessionRegistryStore,
  fetchSessionFromRegistry,
  upsertSessionRegistryCache,
  uploadSessionMetadata,
  registerSessionOnChain,
  setSessionFieldsOnChain,
  updateSessionMetadataOnChain,
};

export const __sessionRegistryTestUtils = {
  buildSessionConfigFromRegistry,
  extractRpcFeeOverrides,
  fetchMetadataFromArweave,
  hasExplicitTxFeeOverrides,
  isMalformedProviderValueError,
  resolveRpcTxFeeOverrides,
  readRegistryMethodWithRpcFallback,
  resolveBufferedGasLimit,
};
