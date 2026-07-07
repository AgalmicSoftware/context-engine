/**
 * @module arweaveDownload
 * @description Arweave tx download and failure-cache helpers extracted from contractScripts internals.
 *
 * Key exports: createArweaveDownloadOps
 */

import { createLogger } from '../logging.js';
import { arweaveScripts } from './arweaveScripts.js';
import {
  isTerminalArweaveFailureState,
  normalizeArweaveFailureMeta,
  classifyArweaveFailureState,
  buildArweaveFailureError,
} from './arweaveFailureClassifiers.js';
import { logArweaveMetadataFetchFailure } from './arweaveMetadataFailureLog.js';
import { normalizeArweaveUrl } from './arweaveUrls.js';

export interface ArweaveDownloadOpsDeps {
  resolveReadContext: (groupKeyOrCfg: unknown) => { chainId: number; [key: string]: unknown };
  readArweaveTxCacheEntry: (opts: {
    groupKeyOrCfg: unknown;
    txId: string;
  }) => Promise<{ text?: string; [key: string]: unknown } | null>;
  writeArweaveTxCacheEntry: (opts: { groupKeyOrCfg: unknown; txId: string; text: string }) => Promise<void>;
  readArweaveTxFailureCacheEntry: (opts: {
    groupKeyOrCfg: unknown;
    txId: string;
  }) => Promise<Record<string, unknown> | null>;
  writeArweaveTxFailureCacheEntry: (opts: {
    groupKeyOrCfg: unknown;
    txId: string;
    entry: Record<string, unknown>;
  }) => Promise<void>;
  clearArweaveTxFailureCacheEntry: (opts: { groupKeyOrCfg: unknown; txId: string }) => Promise<void>;
  runArweaveTxFetchCoalesced: (opts: {
    chainId: number;
    txId: string;
    forceFetch?: boolean;
    task: () => Promise<string>;
  }) => Promise<string>;
  buildArweaveDebugContext?: (...args: unknown[]) => unknown;
}

export interface ArweaveDownloadOps {
  recordTerminalArweaveInvalidFailure: (opts: {
    groupKeyOrCfg: unknown;
    txId: unknown;
    message: unknown;
    cause?: unknown;
  }) => Promise<unknown>;
  downloadArweaveTextForGroup: (opts?: {
    txId?: unknown;
    groupKeyOrCfg?: unknown;
    arweaveOpts?: Record<string, unknown>;
  }) => Promise<string>;
}

const contractsLog = createLogger('contracts');

export function createArweaveDownloadOps(deps: ArweaveDownloadOpsDeps): ArweaveDownloadOps;
export function createArweaveDownloadOps({
  resolveReadContext,
  readArweaveTxCacheEntry,
  writeArweaveTxCacheEntry,
  readArweaveTxFailureCacheEntry,
  writeArweaveTxFailureCacheEntry,
  clearArweaveTxFailureCacheEntry,
  runArweaveTxFetchCoalesced,
  buildArweaveDebugContext,
}: ArweaveDownloadOpsDeps): ArweaveDownloadOps {
  // Reserved for follow-on extraction phases that share the same arweave helper surface.
  void buildArweaveDebugContext;
  void logArweaveMetadataFetchFailure;
  void normalizeArweaveUrl;

  const recordTerminalArweaveInvalidFailure: ArweaveDownloadOps['recordTerminalArweaveInvalidFailure'] = async ({
    groupKeyOrCfg,
    txId,
    message,
    cause = null,
  }) => {
    const normalizedTxId = String(txId || '').trim();
    if (!normalizedTxId) return null;

    const prev = await readArweaveTxFailureCacheEntry({ groupKeyOrCfg, txId: normalizedTxId });
    const now = Date.now();
    const failureEntry = {
      attempts: Math.max(1, Number(prev?.attempts || 0) + 1),
      firstFailedAtMs: Number(prev?.firstFailedAtMs || 0) > 0 ? Number(prev!.firstFailedAtMs) : now,
      lastFailedAtMs: now,
      nextRetryAtMs: 0,
      lastStatus: Number.isFinite(Number(prev?.lastStatus)) ? Number(prev!.lastStatus) : null,
      state: 'terminal_invalid',
      message: String(message || 'Arweave payload parse failed'),
    };

    await writeArweaveTxFailureCacheEntry({
      groupKeyOrCfg,
      txId: normalizedTxId,
      entry: failureEntry,
    });

    return buildArweaveFailureError({
      txId: normalizedTxId,
      state: failureEntry.state,
      status: failureEntry.lastStatus,
      retryable: false,
      kind: 'invalid',
      nextRetryAtMs: failureEntry.nextRetryAtMs,
      message: failureEntry.message,
      failureEntry,
      cause,
    });
  };

  const downloadArweaveTextForGroup: ArweaveDownloadOps['downloadArweaveTextForGroup'] = async ({
    txId,
    groupKeyOrCfg,
    arweaveOpts = {},
  } = {}) => {
    const normalizedTxId = String(txId || '').trim();
    if (!normalizedTxId) return '';

    const { chainId } = resolveReadContext(groupKeyOrCfg);
    const forceArweaveFetch = !!(
      arweaveOpts?.forceRetry ||
      arweaveOpts?.bypassFailureCache ||
      arweaveOpts?.cacheBypass
    );

    return runArweaveTxFetchCoalesced({
      chainId,
      txId: normalizedTxId,
      forceFetch: forceArweaveFetch,
      task: async () => {
        const cached = await readArweaveTxCacheEntry({ groupKeyOrCfg, txId: normalizedTxId });
        if (!forceArweaveFetch && cached && typeof cached.text === 'string' && cached.text.length > 0) {
          contractsLog.debug('[arweave-cache] tx-cache-hit', { txId: normalizedTxId });
          return cached.text;
        }
        contractsLog.debug('[arweave-cache] tx-cache-miss', { txId: normalizedTxId });

        const failureEntry = await readArweaveTxFailureCacheEntry({ groupKeyOrCfg, txId: normalizedTxId });
        const now = Date.now();
        if (!forceArweaveFetch && failureEntry && isTerminalArweaveFailureState(failureEntry.state)) {
          const terminalState = String(failureEntry.state || '');
          const terminalRetryAtMs = Number(failureEntry.nextRetryAtMs || 0);
          const isNotFoundTerminal = terminalState === 'terminal_not_found';
          const shouldSkipTerminal = !isNotFoundTerminal || terminalRetryAtMs > now;
          if (!shouldSkipTerminal) {
            contractsLog.debug('[arweave-cache] tx-failure-terminal-recheck', {
              txId: normalizedTxId,
              state: terminalState,
              attempts: failureEntry.attempts,
              status: failureEntry.lastStatus,
            });
          } else {
            contractsLog.debug('[arweave-cache] tx-failure-terminal-skip', {
              txId: normalizedTxId,
              state: failureEntry.state,
              attempts: failureEntry.attempts,
              status: failureEntry.lastStatus,
            });
            throw buildArweaveFailureError({
              txId: normalizedTxId,
              state: failureEntry.state,
              status: failureEntry.lastStatus,
              retryable: false,
              kind: failureEntry.state === 'terminal_not_found' ? 'not_found' : 'invalid',
              nextRetryAtMs: Number(failureEntry.nextRetryAtMs || 0),
              message: failureEntry.message || 'Arweave tx marked terminal',
              failureEntry,
            });
          }
        }

        if (!forceArweaveFetch && failureEntry && Number(failureEntry.nextRetryAtMs || 0) > now) {
          contractsLog.debug('[arweave-cache] tx-failure-cooldown-hit', {
            txId: normalizedTxId,
            nextRetryAtMs: Number(failureEntry.nextRetryAtMs || 0),
            attempts: failureEntry.attempts,
            status: failureEntry.lastStatus,
          });
          throw buildArweaveFailureError({
            txId: normalizedTxId,
            state: failureEntry.state || 'transient',
            status: failureEntry.lastStatus,
            retryable: true,
            kind: 'cooldown',
            nextRetryAtMs: Number(failureEntry.nextRetryAtMs || 0),
            message: failureEntry.message || 'Arweave tx is in retry cooldown',
            failureEntry,
          });
        }

        let text = '';
        try {
          text = await arweaveScripts.downloadDataFromArweave(normalizedTxId, arweaveOpts || {});
          if (typeof text !== 'string' || text.length === 0) {
            throw buildArweaveFailureError({
              txId: normalizedTxId,
              state: 'terminal_invalid',
              status: null,
              retryable: false,
              kind: 'invalid',
              message: 'Arweave payload is empty',
            });
          }
        } catch (error) {
          const nextFailureEntry = classifyArweaveFailureState({
            txId: normalizedTxId,
            prevEntry: failureEntry,
            error,
          });

          await writeArweaveTxFailureCacheEntry({
            groupKeyOrCfg,
            txId: normalizedTxId,
            entry: nextFailureEntry,
          });

          contractsLog.warn('[arweave-cache] tx-fetch-fail', {
            txId: normalizedTxId,
            state: nextFailureEntry.state,
            attempts: nextFailureEntry.attempts,
            status: nextFailureEntry.lastStatus,
            nextRetryAtMs: nextFailureEntry.nextRetryAtMs,
          });

          const meta = normalizeArweaveFailureMeta(error);
          throw buildArweaveFailureError({
            txId: normalizedTxId,
            state: nextFailureEntry.state,
            status: nextFailureEntry.lastStatus,
            retryable: nextFailureEntry.state === 'transient',
            kind: meta.kind || (nextFailureEntry.state === 'terminal_not_found' ? 'not_found' : 'fetch'),
            nextRetryAtMs: Number(nextFailureEntry.nextRetryAtMs || 0),
            message: nextFailureEntry.message,
            failureEntry: nextFailureEntry,
            cause: error,
          });
        }

        let cachePersistOk = true;
        try {
          await writeArweaveTxCacheEntry({ groupKeyOrCfg, txId: normalizedTxId, text });
        } catch (cachePersistError) {
          cachePersistOk = false;
          contractsLog.warn('[arweave-cache] tx-fetch-success-cache-persist-fail', {
            txId: normalizedTxId,
            error: (cachePersistError as { message?: unknown })?.message || cachePersistError,
          });
        }

        try {
          await clearArweaveTxFailureCacheEntry({ groupKeyOrCfg, txId: normalizedTxId });
        } catch (failureClearError) {
          cachePersistOk = false;
          contractsLog.warn('[arweave-cache] tx-fetch-success-failure-clear-fail', {
            txId: normalizedTxId,
            error: (failureClearError as { message?: unknown })?.message || failureClearError,
          });
        }

        contractsLog.debug('[arweave-cache] tx-fetch-success', { txId: normalizedTxId, cachePersistOk });
        return text;
      },
    });
  };

  return {
    recordTerminalArweaveInvalidFailure,
    downloadArweaveTextForGroup,
  };
}
