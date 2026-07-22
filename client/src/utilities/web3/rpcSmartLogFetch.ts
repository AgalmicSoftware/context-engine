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

type AnyRecord = Record<string, any>;
type RpcDebugContext = {
  fnTag?: string;
  scopeTag?: string;
  method?: string;
  fromBlock?: number | string;
  toBlock?: number | string;
  [key: string]: any;
};
type BlockRangeSegment = {
  fromBlock: number;
  toBlock: number;
  depth: number;
};
type FetchLogsProgressState = AnyRecord & {
  maxConcurrency?: unknown;
  onProgress?: ((payload: AnyRecord) => unknown) | null;
  totalBlocks?: unknown;
  scannedBlocks?: number;
  phase?: unknown;
  fromBlock?: unknown;
  toBlock?: unknown;
  onLogs?: ((payload: AnyRecord) => Promise<unknown> | unknown) | null;
};
type ProviderLike = AnyRecord & {
  getLogs?: (filter: AnyRecord) => Promise<AnyRecord[]>;
  __CE_RPC_META?: AnyRecord;
};
type FetchLogsWithProviderFn = (
  providerForLogs: ProviderLike,
  filter: AnyRecord,
  fromBlock: number,
  toBlock: number,
  depth?: number,
  maxDepth?: number,
  progressState?: FetchLogsProgressState | null,
  rpcDebugContext?: RpcDebugContext | null,
) => Promise<AnyRecord[]>;
type CallWithRetryFn = (
  fn: () => Promise<AnyRecord[]>,
  label: string,
  meta: AnyRecord,
  opts: AnyRecord,
) => Promise<AnyRecord[]>;

const rpcLogger = createLogger('rpc', { prefix: '[RPC_DEBUG]' });
const rpcLog = (...args: unknown[]): void => {
  rpcLogger.log(...args);
};

const toLower = (val: unknown): string => toStr(val).trim().toLowerCase();

// Keep block-window calls under strict public RPC limits (many providers enforce <=10k).
const PATH_LOG_MAX_RANGE = 9500;
const GETLOGS_DEFAULT_MAX_CONCURRENCY = Math.max(1, Number(CE_GETLOGS_MAX_CONCURRENCY || 1) || 1);
const GETLOGS_DEFAULT_MAX_RETRIES = Math.max(0, Number(CE_GETLOGS_MAX_RETRIES || 2) || 2);

const readGetLogsMaxConcurrency = (): number => {
  try {
    if (typeof globalThis !== 'undefined') {
      const runtimeGlobal = globalThis as AnyRecord;
      if (typeof runtimeGlobal.CE_GETLOGS_MAX_CONCURRENCY !== 'undefined') {
        const n = Number(runtimeGlobal.CE_GETLOGS_MAX_CONCURRENCY);
        if (Number.isFinite(n) && n > 0) return Math.min(6, Math.max(1, Math.floor(n)));
      }
    }
  } catch {}
  return Math.min(6, GETLOGS_DEFAULT_MAX_CONCURRENCY);
};

const readGetLogsMaxRetries = (): number => {
  try {
    if (typeof globalThis !== 'undefined') {
      const runtimeGlobal = globalThis as AnyRecord;
      if (typeof runtimeGlobal.CE_GETLOGS_MAX_RETRIES !== 'undefined') {
        const n = Number(runtimeGlobal.CE_GETLOGS_MAX_RETRIES);
        if (Number.isFinite(n) && n >= 0) return Math.min(6, Math.max(0, Math.floor(n)));
      }
    }
  } catch {}
  return Math.min(6, GETLOGS_DEFAULT_MAX_RETRIES);
};

// Helper: detect getLogs errors that indicate the requested block range is too large
export function isLogsRangeTooLargeError(err: unknown): boolean {
  if (!err) return false;

  const candidates: AnyRecord[] = [];
  const stack: unknown[] = [err];
  const seen = new Set<AnyRecord>();

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;

    if (typeof current === 'object' && current !== null) {
      const currentRecord = current as AnyRecord;
      if (seen.has(currentRecord)) continue;
      seen.add(currentRecord);
    }

    candidates.push(current as AnyRecord);

    if (typeof current === 'object' && current !== null) {
      const currentRecord = current as AnyRecord;
      if (currentRecord.error && currentRecord.error !== current) stack.push(currentRecord.error);
      if (currentRecord.cause && currentRecord.cause !== current) stack.push(currentRecord.cause);
      if (Array.isArray(currentRecord.errors)) {
        currentRecord.errors.forEach((nested: unknown) => stack.push(nested));
      }
      if (Array.isArray(currentRecord.results)) {
        currentRecord.results.forEach((nested: unknown) => stack.push(nested));
      }
      if (currentRecord.data && typeof currentRecord.data === 'object') stack.push(currentRecord.data);
      if (typeof currentRecord.body === 'string') {
        const bodyStr = currentRecord.body.trim();
        if ((bodyStr.startsWith('{') && bodyStr.endsWith('}')) || (bodyStr.startsWith('[') && bodyStr.endsWith(']'))) {
          try {
            stack.push(JSON.parse(bodyStr));
          } catch {}
        }
      }
    }
  }

  const matchesRangeTooLarge = (candidate: AnyRecord): boolean => {
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
    )
      .toString()
      .toLowerCase();
    const body = typeof candidate?.body === 'string' ? candidate.body.toLowerCase() : '';

    const combined = `${primaryMsg} ${body}`;

    const hasMoreThanResults = combined.includes('more than') && combined.includes('result');

    const hasExceedMaxRange =
      combined.includes('exceed maximum block range') ||
      combined.includes('exceed max block range') ||
      combined.includes('exceeds max block range') ||
      combined.includes('query exceeds max block range') ||
      combined.includes('max block range');

    const hasRangesOverBlocks = combined.includes('ranges over') && combined.includes('blocks');

    const hasLimitedToRange = combined.includes('limited to') && combined.includes('range');

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
export const splitBlockRange = (fromBlock: unknown, toBlock: unknown, depth: number): BlockRangeSegment[] => {
  if (!Number.isFinite(Number(fromBlock)) || !Number.isFinite(Number(toBlock))) return [];
  if (Number(fromBlock) >= Number(toBlock)) return [];
  const mid = Math.floor((Number(fromBlock) + Number(toBlock)) / 2);
  return [
    { fromBlock: Number(fromBlock), toBlock: mid, depth: depth + 1 },
    { fromBlock: mid + 1, toBlock: Number(toBlock), depth: depth + 1 },
  ];
};

export const normalizeRpcDebugTagValue = (value: unknown): string => {
  const raw = toStr(value).trim().toLowerCase();
  return raw || '';
};

export const normalizeRpcDebugBlockTagValue = (value: unknown): number | string | null => {
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

export const normalizeRpcDebugContext = (contextIn: unknown): RpcDebugContext | null => {
  if (!contextIn || typeof contextIn !== 'object') return null;
  const context = contextIn as AnyRecord;
  const fnTag = normalizeRpcDebugTagValue(context.fnTag || context.fn || '');
  const scopeTag = normalizeRpcDebugTagValue(context.scopeTag || context.scope || '');
  const method = normalizeRpcDebugTagValue(context.method || context.rpcMethod || '');
  const fromBlock = normalizeRpcDebugBlockTagValue(context.fromBlock);
  const toBlock = normalizeRpcDebugBlockTagValue(context.toBlock);
  if (!fnTag && !scopeTag) return null;
  return {
    ...(fnTag ? { fnTag } : {}),
    ...(scopeTag ? { scopeTag } : {}),
    ...(method ? { method } : {}),
    ...(fromBlock != null ? { fromBlock } : {}),
    ...(toBlock != null ? { toBlock } : {}),
  };
};

export const withProviderRpcDebugContext = async (
  provider: unknown,
  contextIn: unknown,
  fn: (() => Promise<unknown>) | (() => unknown),
): Promise<unknown> => {
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

export const isNonRecoverableGetLogsError = (err: unknown): boolean => {
  const errorLike = err as AnyRecord;
  const msg = toLower(
    errorLike?.message || errorLike?.error?.message || errorLike?.reason || errorLike?.error?.reason || '',
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
 */
export function createFetchLogsSmartWithProvider({
  callWithRetry,
  INITIAL_DELAY_MS_DEFAULT,
  DELAY_MULTIPLIER_DEFAULT,
}: {
  callWithRetry: CallWithRetryFn;
  INITIAL_DELAY_MS_DEFAULT: number;
  DELAY_MULTIPLIER_DEFAULT: number;
}): FetchLogsWithProviderFn {
  return async function fetchLogsSmartWithProvider(
    providerForLogs,
    filter,
    fromBlock,
    toBlock,
    depth = 0,
    maxDepth = 20,
    progressState = null,
    rpcDebugContext = null,
  ) {
    if (fromBlock > toBlock) return [];

    const addr = filter && (filter.address || filter?.address);
    if (shouldLog('rpc', 'log') && depth === 0) {
      rpcLog('RPC Call:', {
        function: 'fetchLogsSmartWithProvider',
        op: 'getLogs',
        address: addr || null,
        fromBlock,
        toBlock,
      });
    }

    const providerMeta = providerForLogs && typeof providerForLogs === 'object' ? providerForLogs.__CE_RPC_META : null;
    const maxConcurrencyOverride = Number(progressState?.maxConcurrency || 0);
    const maxConcurrency =
      Number.isFinite(maxConcurrencyOverride) && maxConcurrencyOverride > 0
        ? Math.max(1, Math.floor(maxConcurrencyOverride))
        : readGetLogsMaxConcurrency();
    const getLogsRetryMax = readGetLogsMaxRetries();
    const queue: BlockRangeSegment[] = [
      { fromBlock: Number(fromBlock), toBlock: Number(toBlock), depth: Number(depth) || 0 },
    ];
    const collectedLogs: AnyRecord[] = [];
    let didLogPreSplit = false;
    let didLogSplitOnError = false;

    const emitProgress = (scanFrom: number, scanTo: number): void => {
      if (!progressState || typeof progressState.onProgress !== 'function') return;
      const scanned = Math.max(0, Number(scanTo) - Number(scanFrom) + 1);
      const totalBlocks = Number(progressState.totalBlocks || 0);
      progressState.scannedBlocks = Number(progressState.scannedBlocks || 0) + scanned;
      const remainingBlocks = totalBlocks > 0 ? Math.max(0, totalBlocks - progressState.scannedBlocks) : 0;
      progressState.onProgress({
        phase: progressState.phase,
        fromBlock: progressState.fromBlock,
        toBlock: progressState.toBlock,
        totalBlocks,
        scannedBlocks: progressState.scannedBlocks,
        remainingBlocks,
        scanFrom,
        scanTo,
        lastScannedBlock: scanTo,
      });
    };

    const processSegment = async (
      segment: BlockRangeSegment,
    ): Promise<{ logs: AnyRecord[]; splits: BlockRangeSegment[] }> => {
      const segFrom = Number(segment?.fromBlock);
      const segTo = Number(segment?.toBlock);
      const segDepth = Number(segment?.depth || 0);
      if (!Number.isFinite(segFrom) || !Number.isFinite(segTo) || segFrom > segTo) {
        return { logs: [], splits: [] };
      }

      const rangeSize = segTo - segFrom + 1;
      const shouldPreSplit = Number.isFinite(rangeSize) && rangeSize > PATH_LOG_MAX_RANGE && segDepth < maxDepth;

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
            maxConcurrency,
          });
        }
        return { logs: [], splits };
      }

      try {
        const requestRpcDebugContext =
          rpcDebugContext && typeof rpcDebugContext === 'object'
            ? {
                ...rpcDebugContext,
                method: 'eth_getLogs',
                fromBlock: segFrom,
                toBlock: segTo,
              }
            : rpcDebugContext;
        const logs = await callWithRetry(
          () =>
            withProviderRpcDebugContext(
              providerForLogs,
              requestRpcDebugContext,
              () =>
                providerForLogs.getLogs?.({ ...filter, fromBlock: segFrom, toBlock: segTo }) as Promise<AnyRecord[]>,
            ) as Promise<AnyRecord[]>,
          `getLogs [${segFrom}-${segTo}]`,
          { op: 'getLogs', address: addr || null, fromBlock: segFrom, toBlock: segTo },
          {
            maxRetries: getLogsRetryMax,
            initialDelayMs: INITIAL_DELAY_MS_DEFAULT,
            delayMultiplier: DELAY_MULTIPLIER_DEFAULT,
          },
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
        const errorLike = err as AnyRecord;
        logVerboseRpcError('RPC getLogs error detail', err, {
          function: 'fetchLogsSmartWithProvider',
          op: 'getLogs',
          address: addr || null,
          fromBlock: segFrom,
          toBlock: segTo,
          provider: providerMeta?.providerLabel || 'unknown',
          preferPath: providerMeta?.preferPath,
          preferredUrls: providerMeta?.preferredUrls,
          maxRetries: getLogsRetryMax,
        });

        const shouldSplit = isLogsRangeTooLargeError(err);
        if (shouldSplit && segDepth < maxDepth) {
          const splits = splitBlockRange(segFrom, segTo, segDepth);
          if (!splits.length) {
            const unsplittableRangeError =
              err instanceof Error
                ? err
                : new Error(`RPC getLogs range too large and cannot split further [${segFrom}-${segTo}]`);
            (unsplittableRangeError as AnyRecord).__ce_non_recoverable_getlogs = true;
            (unsplittableRangeError as AnyRecord).__ce_range_too_large_unsplittable = true;
            (unsplittableRangeError as AnyRecord).__ce_getlogs_segment = {
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
              code: errorLike?.code ?? errorLike?.error?.code,
              message: errorLike?.message || errorLike?.error?.message || '',
              maxConcurrency,
            });
          }
          return { logs: [], splits };
        }

        if (isNonRecoverableGetLogsError(err)) {
          errorLike.__ce_non_recoverable_getlogs = true;
        }
        throw err;
      }
    };

    while (queue.length) {
      const batch = queue.splice(0, maxConcurrency);

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
