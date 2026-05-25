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

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

export const shouldStopPendingMetadataRetry = ({
  pendingEntry = null,
  error = null,
  maxAttempts = 0,
}: {
  pendingEntry?: unknown;
  error?: unknown;
  maxAttempts?: unknown;
} = {}) => {
  const pendingRecord = isRecord(pendingEntry) ? pendingEntry : {};
  const meta = normalizeArweaveFailureMeta(error);
  const attempts = Math.max(0, Number(pendingRecord.attempts || 0));
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

const pickNewerTextEntry = (a: unknown, b: unknown) => {
  const aRecord = isRecord(a) ? a : {};
  const bRecord = isRecord(b) ? b : {};
  const aTs = Number(aRecord.savedAtMs || 0);
  const bTs = Number(bRecord.savedAtMs || 0);
  if (aTs > bTs) return a;
  if (bTs > aTs) return b;
  const aLen = typeof aRecord.text === 'string' ? aRecord.text.length : 0;
  const bLen = typeof bRecord.text === 'string' ? bRecord.text.length : 0;
  return aLen >= bLen ? a : b;
};

const pickNewerFailureEntry = (a: unknown, b: unknown) => {
  const aRecord = isRecord(a) ? a : {};
  const bRecord = isRecord(b) ? b : {};
  const aTs = Number(aRecord.lastFailedAtMs || aRecord.firstFailedAtMs || 0);
  const bTs = Number(bRecord.lastFailedAtMs || bRecord.firstFailedAtMs || 0);
  if (aTs > bTs) return a;
  if (bTs > aTs) return b;
  const aAttempts = Number(aRecord.attempts || 0);
  const bAttempts = Number(bRecord.attempts || 0);
  if (aAttempts > bAttempts) return a;
  if (bAttempts > aAttempts) return b;
  const aTerminal = isTerminalArweaveFailureState(aRecord.state);
  const bTerminal = isTerminalArweaveFailureState(bRecord.state);
  if (aTerminal && !bTerminal) return a;
  if (bTerminal && !aTerminal) return b;
  return a || b || null;
};

const mergeByKey = (localMap: unknown, freshMap: unknown, chooser: (a: unknown, b: unknown) => unknown) => {
  const local: UnknownRecord = isRecord(localMap) ? localMap : {};
  const fresh: UnknownRecord = isRecord(freshMap) ? freshMap : {};
  const out: UnknownRecord = {};
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
  pendingEntries?: unknown;
  hydratedEntries?: unknown;
  normalizeKey?: ((key: unknown) => string) | null;
} = {}) => {
  const normalize = (typeof normalizeKey === 'function') ? normalizeKey : normalizePendingMetadataKey;
  const pending: UnknownRecord = isRecord(pendingEntries) ? pendingEntries : {};
  const hydrated: UnknownRecord = isRecord(hydratedEntries) ? hydratedEntries : {};
  const nextPending: UnknownRecord = {};
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

export const ensureQuestionArweaveCacheBranches = (networkNode: unknown) => {
  const node = (isRecord(networkNode) ? networkNode : {}) as UnknownRecord & {
    arweaveTxCache?: unknown;
    arweaveTxFailureCache?: unknown;
  };
  if (!node.arweaveTxCache || typeof node.arweaveTxCache !== 'object') node.arweaveTxCache = {};
  if (!node.arweaveTxFailureCache || typeof node.arweaveTxFailureCache !== 'object') node.arweaveTxFailureCache = {};
  return node;
};

export const mergeQuestionArweaveCacheBranches = (localNode: unknown, freshNode: unknown) => {
  const local = ensureQuestionArweaveCacheBranches(localNode);
  const fresh = ensureQuestionArweaveCacheBranches(
    isRecord(freshNode) ? freshNode : {}
  );
  local.arweaveTxCache = mergeByKey(local.arweaveTxCache, fresh.arweaveTxCache, pickNewerTextEntry);
  local.arweaveTxFailureCache = mergeByKey(
    local.arweaveTxFailureCache,
    fresh.arweaveTxFailureCache,
    pickNewerFailureEntry
  );
  return local;
};
