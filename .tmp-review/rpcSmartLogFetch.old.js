/**
 * @module rpcSmartLogFetch
 * @description Smart log fetch helper utilities extracted from contractScripts.
 *
 * Key exports: isLogsRangeTooLargeError, splitBlockRange, normalizeRpcDebugContext, withProviderRpcDebugContext
 */

import { CE_GETLOGS_MAX_CONCURRENCY, CE_GETLOGS_MAX_RETRIES } from '../../variables/appConfig.js';
import { createLogger, shouldLog } from '../logging.js';
import { toStr } from '../shared/primitives.js';
import { logVerboseRpcError } from './rpcErrorSummarization.js';
import { rpcDebugPopProviderContext, rpcDebugPushProviderContextWithToken } from './rpcDebugStats.js';

const rpcLogger = createLogger('rpc', { prefix: '[RPC_DEBUG]' });
const rpcLog = (...args) => {
  rpcLogger.log(...args);
};

const toLower = (val) => toStr(val).trim().toLowerCase();

// Keep block-window calls under strict public RPC limits (many providers enforce <=10k).
const PATH_LOG_MAX_RANGE = 9500;
const GETLOGS_DEFAULT_MAX_CONCURRENCY = Math.max(1, Number(CE_GETLOGS_MAX_CONCURRENCY || 1) || 1);
const GETLOGS_DEFAULT_MAX_RETRIES = Math.max(0, Number(CE_GETLOGS_MAX_RETRIES || 2) || 2);

const readGetLogsMaxConcurrency = () => {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.CE_GETLOGS_MAX_CONCURRENCY !== 'undefined') {
      const n = Number(globalThis.CE_GETLOGS_MAX_CONCURRENCY);
      if (Number.isFinite(n) && n > 0) return Math.min(6, Math.max(1, Math.floor(n)));
    }
  } catch (_) {}
  return Math.min(6, GETLOGS_DEFAULT_MAX_CONCURRENCY);
};

const readGetLogsMaxRetries = () => {
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis.CE_GETLOGS_MAX_RETRIES !== 'undefined') {
      const n = Number(globalThis.CE_GETLOGS_MAX_RETRIES);
      if (Number.isFinite(n) && n >= 0) return Math.min(6, Math.max(0, Math.floor(n)));
    }
  } catch (_) {}
  return Math.min(6, GETLOGS_DEFAULT_MAX_RETRIES);
};

// Helper: detect getLogs errors that indicate the requested block range is too large
export function isLogsRangeTooLargeError(err) {
  if (!err) return false;

  const candidates = [];
  const stack = [err];
  const seen = new Set();

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;

    if (typeof current === 'object') {
      if (seen.has(current)) continue;
      seen.add(current);
    }

    candidates.push(current);

    if (typeof current === 'object') {
      if (current.error && current.error !== current) stack.push(current.error);
      if (current.cause && current.cause !== current) stack.push(current.cause);
      if (Array.isArray(current.errors)) {
        current.errors.forEach((nested) => stack.push(nested));
      }
      if (Array.isArray(current.results)) {
        current.results.forEach((nested) => stack.push(nested));
      }
      if (current.data && typeof current.data === 'object') stack.push(current.data);
      if (typeof current.body === 'string') {
        const bodyStr = current.body.trim();
        if (
          (bodyStr.startsWith('{') && bodyStr.endsWith('}')) ||
          (bodyStr.startsWith('[') && bodyStr.endsWith(']'))
        ) {
          try {
            stack.push(JSON.parse(bodyStr));
          } catch (_) {}
        }
      }
    }
  }

  const matchesRangeTooLarge = (candidate) => {
    if (candidate && candidate.__ce_range_too_large) return true;
    const primaryCode = candidate?.code ?? candidate?.error?.code;
    const stringMsg = typeof candidate === 'string' ? candidate : '';
    const primaryMsg = (
      candidate?.message ||
      candidate?.error?.message ||
      candidate?.reason ||
      candidate?.error?.reason ||
      stringMsg ||
      ''
    ).toString().toLowerCase();
    const body = typeof candidate?.body === 'string' ? candidate.body.toLowerCase() : '';

    const combined = `${primaryMsg} ${body}`;

    const hasMoreThanResults =
      combined.includes('more than') && combined.includes('result');

    const hasExceedMaxRange =
      combined.includes('exceed maximum block range') ||
      combined.includes('exceed max block range') ||
      combined.includes('exceeds max block range') ||
      combined.includes('query exceeds max block range') ||
      combined.includes('max block range');

    const hasRangesOverBlocks =
      combined.includes('ranges over') && combined.includes('blocks');

    const hasLimitedToRange =
      combined.includes('limited to') && combined.includes('range');

    const hasResponseTooLarge =
      combined.includes('query returned more') ||
      combined.includes('too many results') ||
      combined.includes('log response size') ||
      combined.includes('response size exceeded') ||
      combined.includes('limit exceeded') ||
      combined.includes('request too large');

    // Existing Infura "more than X results" path
    if (primaryCode === -32005 && hasMoreThanResults) return true;

    // Some providers return HTTP 400 without a JSON-RPC code for large ranges
    if (hasMoreThanResults || hasResponseTooLarge) return true;

    // PublicNode-style max range errors
    if ((primaryCode === -32701 || candidate?.error?.code === -32701) && hasExceedMaxRange) return true;

    // Free-tier range errors (e.g., drpc.org)
    if ((primaryCode === 35 || candidate?.error?.code === 35) && hasRangesOverBlocks) return true;

    // Public/base providers often use this wording:
    // "eth_getLogs is limited to a 10,000 range"
    if ((primaryCode === -32614 || candidate?.error?.code === -32614) && hasLimitedToRange) return true;

    // Fallback: if the text clearly says the range is too large, treat as chunkable
    if (hasExceedMaxRange || hasRangesOverBlocks || hasLimitedToRange) return true;

    return false;
  };

  return candidates.some(matchesRangeTooLarge);
}

/**
 * Same as existing fetchLogsSmart but against a specific provider.
 * (We keep the original untouched for default paths.)
 */
export const splitBlockRange = (fromBlock, toBlock, depth) => {
  if (!Number.isFinite(Number(fromBlock)) || !Number.isFinite(Number(toBlock))) return [];
  if (fromBlock >= toBlock) return [];
  const mid = Math.floor((Number(fromBlock) + Number(toBlock)) / 2);
  return [
    { fromBlock: Number(fromBlock), toBlock: mid, depth: depth + 1 },
    { fromBlock: mid + 1, toBlock: Number(toBlock), depth: depth + 1 },
  ];
};

export const normalizeRpcDebugTagValue = (value) => {
  const raw = toStr(value).trim().toLowerCase();
  return raw || '';
};

export const normalizeRpcDebugBlockTagValue = (value) => {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  const raw = toStr(value).trim().toLowerCase();
  if (!raw) return null;
  if (/^0x[0-9a-f]+$/.test(raw)) return raw;
  if (/^[0-9]+$/.test(raw)) {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : raw;
  }
  return raw;
};

export const normalizeRpcDebugContext = (contextIn) => {
  if (!contextIn || typeof contextIn !== 'object') return null;
  const fnTag = normalizeRpcDebugTagValue(contextIn.fnTag || contextIn.fn || '');
  const scopeTag = normalizeRpcDebugTagValue(contextIn.scopeTag || contextIn.scope || '');
  const method = normalizeRpcDebugTagValue(contextIn.method || contextIn.rpcMethod || '');
  const fromBlock = normalizeRpcDebugBlockTagValue(contextIn.fromBlock);
  const toBlock = normalizeRpcDebugBlockTagValue(contextIn.toBlock);
  if (!fnTag && !scopeTag) return null;
  return {
    ...(fnTag ? { fnTag } : {}),
    ...(scopeTag ? { scopeTag } : {}),
    ...(method ? { method } : {}),
    ...(fromBlock != null ? { fromBlock } : {}),
    ...(toBlock != null ? { toBlock } : {}),
  };
};

export const withProviderRpcDebugContext = async (provider, contextIn, fn) => {
  if (typeof fn !== 'function') return undefined;
  const context = normalizeRpcDebugContext(contextIn);
  if (!provider || typeof provider !== 'object' || !context) return await fn();

  const contextToken = rpcDebugPushProviderContextWithToken(provider, context);
  if (contextToken == null) return await fn();
  try {
    // Keep the tag visible until the provider call fully settles so async
    // provider internals (e.g. deferred `send`) still see the intended context.
    return await fn();
  } finally {
    rpcDebugPopProviderContext(provider, contextToken);
  }
};

export const isNonRecoverableGetLogsError = (err) => {
  const msg = toLower(
    err?.message ||
    err?.error?.message ||
    err?.reason ||
    err?.error?.reason ||
    ''
  );
  if (!msg) return false;
  return (
    msg.includes('invalid argument') ||
    msg.includes('invalid params') ||
    msg.includes('invalid filter') ||
    msg.includes('method not found') ||
    msg.includes('unsupported method') ||
    msg.includes('address is not valid') ||
    msg.includes('hex data is odd-length')
  );
};

/**
 * Factory: creates a bound fetchLogsSmartWithProvider using caller-provided retry infrastructure.
 * Avoids circular dependency since callWithRetry lives in contractScripts.impl.ts.
 *
 * @param {object} deps
 * @param {Function} deps.callWithRetry retry wrapper from contractScripts.impl
 * @param {number} deps.INITIAL_DELAY_MS_DEFAULT base retry delay
 * @param {number} deps.DELAY_MULTIPLIER_DEFAULT retry backoff multiplier
 * @returns {Function} fetchLogsSmartWithProvider
 */
export function createFetchLogsSmartWithProvider({
  callWithRetry,
  INITIAL_DELAY_MS_DEFAULT,
  DELAY_MULTIPLIER_DEFAULT,
}) {
  return async function fetchLogsSmartWithProvider(
    providerForLogs,
    filter,
    fromBlock,
    toBlock,
    depth = 0,
    maxDepth = 20,
    progressState = null,
    rpcDebugContext = null
  ) {
    if (fromBlock > toBlock) return [];

    const addr = filter && (filter.address || filter?.address);
    if (shouldLog('rpc', 'log') && depth === 0) {
      rpcLog('RPC Call:', {
        function: 'fetchLogsSmartWithProvider',
        op: 'getLogs',
        address: addr || null,
        fromBlock,
        toBlock
      });
    }

    const providerMeta =
      providerForLogs && typeof providerForLogs === 'object'
        ? providerForLogs.__CE_RPC_META
        : null;
    const maxConcurrencyOverride = Number(progressState?.maxConcurrency || 0);
    const maxConcurrency = Number.isFinite(maxConcurrencyOverride) && maxConcurrencyOverride > 0
      ? Math.max(1, Math.floor(maxConcurrencyOverride))
      : readGetLogsMaxConcurrency();
    const getLogsRetryMax = readGetLogsMaxRetries();
    const queue = [{ fromBlock: Number(fromBlock), toBlock: Number(toBlock), depth: Number(depth) || 0 }];
    const collectedLogs = [];
    let didLogPreSplit = false;
    let didLogSplitOnError = false;

    const emitProgress = (scanFrom, scanTo) => {
      if (!progressState || typeof progressState.onProgress !== 'function') return;
      const scanned = Math.max(0, Number(scanTo) - Number(scanFrom) + 1);
      const totalBlocks = Number(progressState.totalBlocks || 0);
      progressState.scannedBlocks = Number(progressState.scannedBlocks || 0) + scanned;
      const remainingBlocks = totalBlocks > 0
        ? Math.max(0, totalBlocks - progressState.scannedBlocks)
        : 0;
      progressState.onProgress({
        phase: progressState.phase,
        fromBlock: progressState.fromBlock,
        toBlock: progressState.toBlock,
        totalBlocks,
        scannedBlocks: progressState.scannedBlocks,
        remainingBlocks,
        scanFrom,
        scanTo,
        lastScannedBlock: scanTo
      });
    };

    const processSegment = async (segment) => {
      const segFrom = Number(segment?.fromBlock);
      const segTo = Number(segment?.toBlock);
      const segDepth = Number(segment?.depth || 0);
      if (!Number.isFinite(segFrom) || !Number.isFinite(segTo) || segFrom > segTo) {
        return { logs: [], splits: [] };
      }

      const rangeSize = segTo - segFrom + 1;
      const shouldPreSplit =
        Number.isFinite(rangeSize) &&
        rangeSize > PATH_LOG_MAX_RANGE &&
        segDepth < maxDepth;

      if (shouldPreSplit) {
        const splits = splitBlockRange(segFrom, segTo, segDepth);
        if (!didLogPreSplit && shouldLog('rpc', 'log')) {
          didLogPreSplit = true;
          rpcLog('RPC getLogs range exceeds PATH max; queue split', {
            function: 'fetchLogsSmartWithProvider',
            op: 'getLogs-range-presplit',
            address: addr || null,
            fromBlock: segFrom,
            toBlock: segTo,
            rangeSize,
            pathMaxRange: PATH_LOG_MAX_RANGE,
            provider: providerMeta?.providerLabel || 'rpc',
            maxConcurrency
          });
        }
        return { logs: [], splits };
      }

      try {
        const requestRpcDebugContext = rpcDebugContext && typeof rpcDebugContext === 'object'
          ? {
            ...rpcDebugContext,
            method: 'eth_getLogs',
            fromBlock: segFrom,
            toBlock: segTo,
          }
          : rpcDebugContext;
        const logs = await callWithRetry(
          () => withProviderRpcDebugContext(
            providerForLogs,
            requestRpcDebugContext,
            () => providerForLogs.getLogs({ ...filter, fromBlock: segFrom, toBlock: segTo })
          ),
          `getLogs [${segFrom}-${segTo}]`,
          { op: 'getLogs', address: addr || null, fromBlock: segFrom, toBlock: segTo },
          {
            maxRetries: getLogsRetryMax,
            initialDelayMs: INITIAL_DELAY_MS_DEFAULT,
            delayMultiplier: DELAY_MULTIPLIER_DEFAULT,
          }
        );
        if (progressState && typeof progressState.onLogs === 'function') {
          await progressState.onLogs({
            phase: progressState.phase,
            fromBlock: progressState.fromBlock,
            toBlock: progressState.toBlock,
            scanFrom: segFrom,
            scanTo: segTo,
            logs: Array.isArray(logs) ? logs : [],
          });
        }
        emitProgress(segFrom, segTo);
        return { logs: Array.isArray(logs) ? logs : [], splits: [] };
      } catch (err) {
        logVerboseRpcError('RPC getLogs error detail', err, {
          function: 'fetchLogsSmartWithProvider',
          op: 'getLogs',
          address: addr || null,
          fromBlock: segFrom,
          toBlock: segTo,
          provider: providerMeta?.providerLabel || 'unknown',
          preferPath: providerMeta?.preferPath,
          preferredUrls: providerMeta?.preferredUrls,
          maxRetries: getLogsRetryMax
        });

        const shouldSplit = isLogsRangeTooLargeError(err);
        if (shouldSplit && segDepth < maxDepth) {
          const splits = splitBlockRange(segFrom, segTo, segDepth);
          if (!splits.length) {
            const unsplittableRangeError = err instanceof Error
              ? err
              : new Error(`RPC getLogs range too large and cannot split further [${segFrom}-${segTo}]`);
            unsplittableRangeError.__ce_non_recoverable_getlogs = true;
            unsplittableRangeError.__ce_range_too_large_unsplittable = true;
            unsplittableRangeError.__ce_getlogs_segment = {
              fromBlock: segFrom,
              toBlock: segTo,
              depth: segDepth,
              maxDepth,
            };
            throw unsplittableRangeError;
          }
          if (!didLogSplitOnError && shouldLog('rpc', 'log')) {
            didLogSplitOnError = true;
            rpcLog('RPC getLogs range too large; queue split', {
              function: 'fetchLogsSmartWithProvider',
              op: 'getLogs-range-split',
              address: addr || null,
              fromBlock: segFrom,
              toBlock: segTo,
              code: err?.code ?? err?.error?.code,
              message: err?.message || err?.error?.message || '',
              maxConcurrency
            });
          }
          return { logs: [], splits };
        }

        if (isNonRecoverableGetLogsError(err)) {
          err.__ce_non_recoverable_getlogs = true;
        }
        throw err;
      }
    };

    while (queue.length) {
      const batch = queue.splice(0, maxConcurrency);
      // eslint-disable-next-line no-await-in-loop
      const batchResults = await Promise.all(batch.map((segment) => processSegment(segment)));
      batchResults.forEach((result) => {
        if (Array.isArray(result?.logs) && result.logs.length) {
          collectedLogs.push(...result.logs);
        }
        if (Array.isArray(result?.splits) && result.splits.length) {
          queue.push(...result.splits);
        }
      });
    }

    if (collectedLogs.length > 1) {
      collectedLogs.sort((a, b) => {
        const byBlock = Number(a?.blockNumber || 0) - Number(b?.blockNumber || 0);
        if (byBlock !== 0) return byBlock;
        const byTx = Number(a?.transactionIndex || 0) - Number(b?.transactionIndex || 0);
        if (byTx !== 0) return byTx;
        return Number(a?.logIndex || 0) - Number(b?.logIndex || 0);
      });
    }
    return collectedLogs;
  };
}
