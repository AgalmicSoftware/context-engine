/**
 * @module arweaveRetryHelpers
 * @description Arweave upload retry and failure-state management — determines terminal vs. retryable
 *              failure states, prunes stale pending metadata, and manages cache branch merging.
 *
 * Key exports: isTerminalArweaveFailureState, shouldStopPendingMetadataRetry, prunePendingMetadataEntries, ensureQuestionArweaveCacheBranches
 */
import {
  isTerminalArweaveFailureState,
  normalizeArweaveFailureMeta,
} from './arweaveFailureClassifiers.js';

export { isTerminalArweaveFailureState, normalizeArweaveFailureMeta };

export const shouldStopPendingMetadataRetry = ({
  pendingEntry = null,
  error = null,
  maxAttempts = 0,
}: {
  pendingEntry?: any;
  error?: any;
  maxAttempts?: unknown;
} = {}) => {
  const meta = normalizeArweaveFailureMeta(error);
  const attempts = Math.max(0, Number(pendingEntry?.attempts || 0));
  const boundedMax = Math.max(0, Number(maxAttempts || 0));
  const reachedMaxAttempts = boundedMax > 0 && attempts >= boundedMax;
  const terminal = isTerminalArweaveFailureState(meta.state);
  return {
    stop: terminal || reachedMaxAttempts,
    terminal,
    reachedMaxAttempts,
    meta,
  };
};

const pickNewerTextEntry = (a: any, b: any) => {
  const aTs = Number(a?.savedAtMs || 0);
  const bTs = Number(b?.savedAtMs || 0);
  if (aTs > bTs) return a;
  if (bTs > aTs) return b;
  const aLen = typeof a?.text === 'string' ? a.text.length : 0;
  const bLen = typeof b?.text === 'string' ? b.text.length : 0;
  return aLen >= bLen ? a : b;
};

const pickNewerFailureEntry = (a: any, b: any) => {
  const aTs = Number(a?.lastFailedAtMs || a?.firstFailedAtMs || 0);
  const bTs = Number(b?.lastFailedAtMs || b?.firstFailedAtMs || 0);
  if (aTs > bTs) return a;
  if (bTs > aTs) return b;
  const aAttempts = Number(a?.attempts || 0);
  const bAttempts = Number(b?.attempts || 0);
  if (aAttempts > bAttempts) return a;
  if (bAttempts > aAttempts) return b;
  const aTerminal = isTerminalArweaveFailureState(a?.state);
  const bTerminal = isTerminalArweaveFailureState(b?.state);
  if (aTerminal && !bTerminal) return a;
  if (bTerminal && !aTerminal) return b;
  return a || b || null;
};

const mergeByKey = (localMap: any, freshMap: any, chooser: (a: any, b: any) => any) => {
  const local: Record<string, any> = (localMap && typeof localMap === 'object') ? localMap : {};
  const fresh: Record<string, any> = (freshMap && typeof freshMap === 'object') ? freshMap : {};
  const out: Record<string, any> = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(fresh)]);
  keys.forEach((key) => {
    const localEntry = local[key];
    const freshEntry = fresh[key];
    if (localEntry && freshEntry) {
      out[key] = chooser(localEntry, freshEntry);
      return;
    }
    out[key] = localEntry || freshEntry;
  });
  return out;
};

const normalizePendingMetadataKey = (key: unknown): string => String(key || '').trim().toLowerCase();

export const prunePendingMetadataEntries = ({
  pendingEntries = null,
  hydratedEntries = null,
  normalizeKey = normalizePendingMetadataKey,
}: {
  pendingEntries?: any;
  hydratedEntries?: any;
  normalizeKey?: ((key: unknown) => string) | null;
} = {}) => {
  const normalize = (typeof normalizeKey === 'function') ? normalizeKey : normalizePendingMetadataKey;
  const pending: Record<string, any> = (pendingEntries && typeof pendingEntries === 'object') ? pendingEntries : {};
  const hydrated: Record<string, any> = (hydratedEntries && typeof hydratedEntries === 'object') ? hydratedEntries : {};
  const nextPending: Record<string, any> = {};
  const removedKeys: string[] = [];

  Object.keys(pending).forEach((rawKey) => {
    const normalizedKey = normalize(rawKey);
    if (!normalizedKey) return;
    if (hydrated[normalizedKey]) {
      removedKeys.push(normalizedKey);
      return;
    }
    nextPending[rawKey] = pending[rawKey];
  });

  return {
    nextPending,
    removedKeys,
    removedCount: removedKeys.length,
  };
};

export const ensureQuestionArweaveCacheBranches = (networkNode: any) => {
  const node = (networkNode && typeof networkNode === 'object') ? networkNode : {};
  if (!node.arweaveTxCache || typeof node.arweaveTxCache !== 'object') node.arweaveTxCache = {};
  if (!node.arweaveTxFailureCache || typeof node.arweaveTxFailureCache !== 'object') node.arweaveTxFailureCache = {};
  return node;
};

export const mergeQuestionArweaveCacheBranches = (localNode: any, freshNode: any) => {
  const local = ensureQuestionArweaveCacheBranches(localNode);
  const fresh = ensureQuestionArweaveCacheBranches(
    (freshNode && typeof freshNode === 'object') ? freshNode : {}
  );
  local.arweaveTxCache = mergeByKey(local.arweaveTxCache, fresh.arweaveTxCache, pickNewerTextEntry);
  local.arweaveTxFailureCache = mergeByKey(
    local.arweaveTxFailureCache,
    fresh.arweaveTxFailureCache,
    pickNewerFailureEntry
  );
  return local;
};
