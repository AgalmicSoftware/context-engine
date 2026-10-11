/**
 * @module arweaveRetryHelpers
 * @description Arweave upload retry and failure-state management — determines terminal vs. retryable
 *              failure states, prunes stale pending metadata, and manages cache branch merging.
 *
 * Key exports: isTerminalArweaveFailureState, shouldStopPendingMetadataRetry, ensureQuestionArweaveCacheBranches
 */
import { isTerminalArweaveFailureState, normalizeArweaveFailureMeta } from './arweaveFailureClassifiers.js';

export { isTerminalArweaveFailureState, normalizeArweaveFailureMeta };
export {
  ensureQuestionArweaveCacheBranches,
  mergeQuestionArweaveCacheBranches,
} from '../../domains/surveys/questionArweaveCacheBranches.js';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

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
