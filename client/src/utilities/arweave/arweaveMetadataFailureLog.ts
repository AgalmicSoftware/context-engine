/**
 * @module arweaveMetadataFailureLog
 * @description Deduplicated Arweave metadata failure logging helpers shared by contractScripts internals.
 *
 * Key exports: isCallExceptionError, logArweaveMetadataFetchFailure
 */
import { createLogger } from '../logging.js';
import {
  isTerminalArweaveFailureState,
  normalizeArweaveFailureMeta,
} from './arweaveFailureClassifiers.js';

type ArweaveMetadataFailureLogKeyOptions = {
  scope?: string;
  meta?: Record<string, unknown>;
};

type ArweaveMetadataFetchFailureLogOptions = {
  scope?: string;
  error?: unknown;
};

type ArweaveFailureMeta = ReturnType<typeof normalizeArweaveFailureMeta> & Record<string, unknown>;

type ErrorChainNode = {
  code?: unknown;
  message?: unknown;
  reason?: unknown;
  body?: unknown;
  requestBody?: unknown;
  error?: ErrorChainNode | null;
  cause?: unknown;
  data?: unknown;
  errors?: unknown[];
  results?: unknown[];
};

const ARWEAVE_METADATA_FAILURE_LOG_DEDUPE_TTL_MS = 30 * 1000;
const ARWEAVE_METADATA_FAILURE_LOG_DEDUPE_MAX = 2400;

const contractsLog = createLogger('contracts');
const ARWEAVE_METADATA_FAILURE_LOG_MEMO = new Map<string, unknown>();

const pruneMapBySize = (map: Map<string, unknown>, maxEntries: number): void => {
  while (map.size > maxEntries) {
    const oldest = map.keys().next().value;
    if (!oldest) break;
    map.delete(oldest);
  }
};

const isCallExceptionError = (error: unknown): boolean => {
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    if (typeof current !== 'object') {
      const raw = String(current || '').toLowerCase();
      if (
        raw.includes('call exception') ||
        raw.includes('execution reverted') ||
        raw.includes('missing revert data')
      ) {
        return true;
      }
      continue;
    }

    if (seen.has(current)) continue;
    seen.add(current);

    const currentError = current as ErrorChainNode;
    const code = String(currentError?.code ?? currentError?.error?.code ?? '').toUpperCase();
    const msg = String(
      currentError?.message ||
      currentError?.reason ||
      currentError?.error?.message ||
      currentError?.error?.reason ||
      ''
    ).toLowerCase();
    const body = String(currentError?.body || '').toLowerCase();
    const requestBody = String(currentError?.requestBody || '').toLowerCase();

    if (
      code === 'CALL_EXCEPTION' ||
      msg.includes('call exception') ||
      msg.includes('execution reverted') ||
      msg.includes('missing revert data') ||
      body.includes('execution reverted') ||
      requestBody.includes('execution reverted')
    ) {
      return true;
    }

    if (currentError?.error) queue.push(currentError.error);
    if (currentError?.cause) queue.push(currentError.cause);
    if (currentError?.data) queue.push(currentError.data);
    if (Array.isArray(currentError?.errors)) queue.push(...currentError.errors);
    if (Array.isArray(currentError?.results)) queue.push(...currentError.results);
  }
  return false;
};

const buildArweaveMetadataFailureLogKey = ({
  scope = '',
  meta = {},
}: ArweaveMetadataFailureLogKeyOptions = {}): string => {
  const label = String(scope || '').trim().toLowerCase() || 'metadata';
  const txId = String(meta?.txId || '').trim() || 'no-tx';
  const state = String(meta?.state || '').trim().toLowerCase() || 'unknown';
  const kind = String(meta?.kind || '').trim().toLowerCase() || 'unknown';
  const statusNum = Number(meta?.status);
  const status = Number.isFinite(statusNum) ? statusNum : 'na';
  return `${label}|${txId}|${state}|${kind}|${status}`;
};

const shouldEmitArweaveMetadataFailureWarn = ({
  scope = '',
  meta = {},
}: ArweaveMetadataFailureLogKeyOptions = {}): boolean => {
  const key = buildArweaveMetadataFailureLogKey({ scope, meta });
  if (!key) return true;
  const now = Date.now();
  const prevTs = Number(ARWEAVE_METADATA_FAILURE_LOG_MEMO.get(key) || 0);
  if (prevTs > 0 && (now - prevTs) < ARWEAVE_METADATA_FAILURE_LOG_DEDUPE_TTL_MS) {
    return false;
  }
  ARWEAVE_METADATA_FAILURE_LOG_MEMO.set(key, now);
  pruneMapBySize(ARWEAVE_METADATA_FAILURE_LOG_MEMO, ARWEAVE_METADATA_FAILURE_LOG_DEDUPE_MAX);
  return true;
};

const logArweaveMetadataFetchFailure = ({
  scope = 'metadata',
  error = null,
}: ArweaveMetadataFetchFailureLogOptions = {}): void => {
  const scopeLabel = String(scope || 'metadata').trim().toLowerCase() || 'metadata';
  const failureMeta = normalizeArweaveFailureMeta(error) as ArweaveFailureMeta;
  const state = String(failureMeta.state || '').trim().toLowerCase();

  if (
    (scopeLabel === 'question' || scopeLabel === 'survey') &&
    isCallExceptionError(error)
  ) {
    const errorRecord = error as ErrorChainNode | null | undefined;
    const payload = {
      scope: scopeLabel,
      code: errorRecord?.code ?? errorRecord?.error?.code ?? null,
      message: errorRecord?.message || errorRecord?.error?.message || '',
    };
    if (shouldEmitArweaveMetadataFailureWarn({ scope: scopeLabel, meta: failureMeta })) {
      contractsLog.warn(`[arweave-cache] ${scopeLabel} metadata hash lookup reverted`, payload);
    } else {
      contractsLog.debug(`[arweave-cache] ${scopeLabel} metadata hash lookup reverted (deduped)`, payload);
    }
    return;
  }

  if (isTerminalArweaveFailureState(state)) {
    const terminalLabel = (
      scopeLabel === 'question'
        ? 'Question metadata'
        : scopeLabel === 'survey'
      ? 'Survey metadata'
          : scopeLabel === 'response'
            ? 'Response payload'
            : 'Metadata'
    );
    const errorRecord = error as ErrorChainNode | null | undefined;
    contractsLog.warn(
      `${terminalLabel} unavailable (terminal):`,
      failureMeta.message || errorRecord?.message || error
    );
    return;
  }

  const nextRetryAtMs = Number(failureMeta.nextRetryAtMs || 0);
  const kind = String(failureMeta.kind || '').trim().toLowerCase();
  const cooldownLike = (
    nextRetryAtMs > Date.now() ||
    state === 'transient' ||
    kind === 'cooldown' ||
    kind === 'not_found' ||
    kind === 'pending'
  );

  if (cooldownLike) {
    const payload = {
      txId: failureMeta.txId || null,
      state: failureMeta.state || null,
      kind: failureMeta.kind || null,
      status: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
      nextRetryAtMs: nextRetryAtMs > 0 ? nextRetryAtMs : null,
    };
    const cooldownLabel = (
      scopeLabel === 'question'
        ? 'question metadata'
        : scopeLabel === 'survey'
          ? 'survey metadata'
          : scopeLabel === 'response'
            ? 'response payload'
            : `${scopeLabel} metadata`
    );
    if (shouldEmitArweaveMetadataFailureWarn({ scope: scopeLabel, meta: failureMeta })) {
      contractsLog.warn(`[arweave-cache] ${cooldownLabel} fetch cooldown`, payload);
    } else {
      contractsLog.debug(`[arweave-cache] ${cooldownLabel} fetch cooldown (deduped)`, payload);
    }
    return;
  }

  if (scopeLabel === 'question') {
    contractsLog.error('Error fetching question data from Arweave:', error);
    return;
  }
  if (scopeLabel === 'response') {
    contractsLog.error('Error fetching or parsing response:', error);
    return;
  }
  contractsLog.error('Error fetching survey data from Arweave:', error);
};

export {
  ARWEAVE_METADATA_FAILURE_LOG_DEDUPE_MAX,
  ARWEAVE_METADATA_FAILURE_LOG_DEDUPE_TTL_MS,
  isCallExceptionError,
  logArweaveMetadataFetchFailure,
};
