/**
 * @module arweaveFailureClassifiers
 * @description Arweave tx failure classification, backoff calculation, and error constructors.
 *              Stateless - no module-level mutable state.
 *
 * Key exports: normalizeArweaveFailureEntry, normalizeArweaveFailureMeta, isTerminalArweaveFailureState, classifyArweaveFailureState, buildArweaveFailureError, computeArweaveFailureBackoffMs, buildHashUnavailableMetadataError
 */

const TERMINAL_ARWEAVE_FAILURE_STATES = new Set(['terminal_not_found', 'terminal_invalid']);

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const normalizeState = (state: unknown): string =>
  String(state || '')
    .trim()
    .toLowerCase();

export const isTerminalArweaveFailureState = (state: unknown): boolean =>
  TERMINAL_ARWEAVE_FAILURE_STATES.has(normalizeState(state));

// Regression guard: keep failure-entry normalization in the Arweave layer.
// Importing the cache module here reintroduces the HMR/runtime cycle that leaves
// `isTerminalArweaveFailureState` uninitialized during module evaluation.
export const normalizeArweaveFailureEntry = (rawEntry: unknown) => {
  if (!isRecord(rawEntry)) return null;
  const attempts = Math.max(0, Number(rawEntry.attempts || 0));
  const firstFailedAtMs = Number(rawEntry.firstFailedAtMs || 0);
  const lastFailedAtMs = Number(rawEntry.lastFailedAtMs || 0);
  const nextRetryAtMs = Number(rawEntry.nextRetryAtMs || 0);
  const lastStatusNum = Number(rawEntry.lastStatus);
  return {
    attempts,
    firstFailedAtMs: Number.isFinite(firstFailedAtMs) ? firstFailedAtMs : 0,
    lastFailedAtMs: Number.isFinite(lastFailedAtMs) ? lastFailedAtMs : 0,
    nextRetryAtMs: Number.isFinite(nextRetryAtMs) ? nextRetryAtMs : 0,
    lastStatus: Number.isFinite(lastStatusNum) ? lastStatusNum : null,
    state: normalizeState(rawEntry.state) || 'transient',
    message: String(rawEntry.message || ''),
  };
};

export const normalizeArweaveFailureMeta = (raw: unknown) => {
  const fromError: UnknownRecord = isRecord(raw) ? raw : {};
  const nested: UnknownRecord = isRecord(fromError.arweaveFailure) ? fromError.arweaveFailure : {};
  const read = (key: string, fallback: unknown = null): unknown =>
    fromError[key] !== undefined ? fromError[key] : nested[key] !== undefined ? nested[key] : fallback;
  const statusRaw = Number(read('status', NaN));
  const nextRetryRaw = Number(read('nextRetryAtMs', NaN));
  const retryableRaw = read('retryable', null);
  return {
    txId: String(read('txId', '') || ''),
    state: normalizeState(read('state', '')),
    kind: String(read('kind', '') || ''),
    message: String(read('message', '') || ''),
    status: Number.isFinite(statusRaw) ? statusRaw : null,
    retryable: typeof retryableRaw === 'boolean' ? retryableRaw : null,
    nextRetryAtMs: Number.isFinite(nextRetryRaw) ? nextRetryRaw : null,
  };
};

export const ARWEAVE_TX_CACHE_MAX_ENTRIES = 1200;
export const ARWEAVE_TX_FAILURE_CACHE_MAX_ENTRIES = 1200;
export const ARWEAVE_TX_FAILURE_BASE_RETRY_MS = 1500;
export const ARWEAVE_TX_FAILURE_MAX_RETRY_MS = 10 * 60 * 1000;
export const ARWEAVE_TX_FAILURE_NOT_FOUND_TERMINAL_ATTEMPTS = 8;
export const ARWEAVE_TX_FAILURE_NOT_FOUND_TERMINAL_MIN_AGE_MS = 10 * 60 * 1000;
export const ARWEAVE_TX_FAILURE_TERMINAL_RECHECK_MS = 30 * 60 * 1000;

export const computeArweaveFailureBackoffMs = (attempts: unknown): number => {
  const n = Math.max(0, Math.min(12, Number(attempts || 0) - 1));
  return Math.min(ARWEAVE_TX_FAILURE_MAX_RETRY_MS, Math.round(ARWEAVE_TX_FAILURE_BASE_RETRY_MS * Math.pow(2, n)));
};

export const buildArweaveFailureError = ({
  txId,
  state = 'transient',
  status = null,
  retryable = false,
  kind = 'unknown',
  nextRetryAtMs = 0,
  message = 'Arweave fetch failed',
  failureEntry = null,
  cause = null,
}: {
  txId?: unknown;
  state?: unknown;
  status?: unknown;
  retryable?: boolean;
  kind?: unknown;
  nextRetryAtMs?: unknown;
  message?: unknown;
  failureEntry?: unknown;
  cause?: unknown;
}) => {
  const failureRecord = isRecord(failureEntry) ? failureEntry : {};
  const err = new Error(String(message || 'Arweave fetch failed')) as Error & UnknownRecord;
  err.name = 'ArweaveTxFailureError';
  err.txId = String(txId || '');
  err.status = Number.isFinite(Number(status)) ? Number(status) : null;
  err.retryable = !!retryable;
  err.kind = String(kind || 'unknown');
  err.state = String(state || 'transient');
  err.arweaveFailureState = err.state;
  err.nextRetryAtMs = Number.isFinite(Number(nextRetryAtMs)) ? Number(nextRetryAtMs) : 0;
  err.arweaveFailure = {
    txId: err.txId,
    status: err.status,
    retryable: err.retryable,
    kind: err.kind,
    state: err.state,
    nextRetryAtMs: err.nextRetryAtMs,
    attempts: Number(failureRecord.attempts || 0),
    lastStatus: Number.isFinite(Number(failureRecord.lastStatus)) ? Number(failureRecord.lastStatus) : null,
    message: String(message || failureRecord.message || ''),
  };
  if (cause) err.cause = cause;
  return err;
};

export const classifyArweaveFailureState = ({
  txId,
  prevEntry,
  error,
}: {
  txId?: unknown;
  prevEntry?: unknown;
  error?: unknown;
}) => {
  const now = Date.now();
  const prev = normalizeArweaveFailureEntry(prevEntry) || {
    attempts: 0,
    firstFailedAtMs: 0,
    lastFailedAtMs: 0,
    nextRetryAtMs: 0,
    lastStatus: null,
    state: 'transient',
    message: '',
  };
  const meta = normalizeArweaveFailureMeta(error);
  const attempts = Number(prev.attempts || 0) + 1;
  const firstFailedAtMs = Number(prev.firstFailedAtMs || 0) > 0 ? Number(prev.firstFailedAtMs) : now;
  const ageMs = Math.max(0, now - firstFailedAtMs);
  const status = Number.isFinite(Number(meta.status))
    ? Number(meta.status)
    : Number.isFinite(Number(prev.lastStatus))
      ? Number(prev.lastStatus)
      : null;

  let state = 'transient';
  if (isTerminalArweaveFailureState(meta.state)) {
    state = meta.state;
  } else if (
    meta.kind === 'invalid' ||
    (meta.retryable === false && status !== 404 && status !== 202 && status !== 429)
  ) {
    state = 'terminal_invalid';
  } else if (
    (status === 404 || meta.kind === 'not_found') &&
    attempts >= ARWEAVE_TX_FAILURE_NOT_FOUND_TERMINAL_ATTEMPTS &&
    ageMs >= ARWEAVE_TX_FAILURE_NOT_FOUND_TERMINAL_MIN_AGE_MS
  ) {
    state = 'terminal_not_found';
  }

  const computedBackoff = computeArweaveFailureBackoffMs(attempts);
  const externalNextRetryAt = Number(meta.nextRetryAtMs || 0);
  let nextRetryAtMs = 0;
  if (state === 'transient') {
    nextRetryAtMs = Math.max(now + computedBackoff, Number.isFinite(externalNextRetryAt) ? externalNextRetryAt : 0);
  } else if (state === 'terminal_not_found') {
    nextRetryAtMs = Math.max(
      now + ARWEAVE_TX_FAILURE_TERMINAL_RECHECK_MS,
      Number.isFinite(externalNextRetryAt) ? externalNextRetryAt : 0,
    );
  }
  const errorRecord = isRecord(error) ? error : {};
  const message = String(meta.message || errorRecord.message || prev.message || 'Arweave fetch failed');
  return {
    txId: String(txId || ''),
    attempts,
    firstFailedAtMs,
    lastFailedAtMs: now,
    nextRetryAtMs,
    lastStatus: status,
    state,
    message,
  };
};

export const buildHashUnavailableMetadataError = (message: unknown, meta: unknown = {}) => {
  const metaRecord = isRecord(meta) ? meta : {};
  const retryAtMs =
    Number(metaRecord.nextRetryAtMs || 0) > 0
      ? Number(metaRecord.nextRetryAtMs)
      : Date.now() + ARWEAVE_TX_FAILURE_TERMINAL_RECHECK_MS;
  const err = new Error(String(message || 'Metadata hash is unavailable')) as Error & UnknownRecord;
  err.name = 'MetadataUnavailableError';
  err.state = 'terminal_not_found';
  err.kind = 'not_found';
  err.retryable = false;
  err.status = 404;
  err.nextRetryAtMs = retryAtMs;
  err.arweaveFailure = {
    txId: String(metaRecord.txId || ''),
    state: 'terminal_not_found',
    kind: 'not_found',
    retryable: false,
    status: 404,
    nextRetryAtMs: retryAtMs,
    message: String(message || ''),
  };
  return err;
};
