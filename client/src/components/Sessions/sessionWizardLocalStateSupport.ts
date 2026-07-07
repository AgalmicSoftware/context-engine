import { useRef } from 'react';
import { createLogger } from '../../utilities/logging';
import {
  clearSessionWizardDraftCache,
  readSessionWizardDraftCache,
  writeSessionWizardDraftCache,
} from './sessionWizardDraftCache.js';
import { clearSessionWizardPendingSbtDraftsCache } from './hooks/usePendingSbtDrafts.js';
import type { AnyRecord, WorkerSecretsLike } from '../shellTypes';

const log = createLogger('general');

const normalizeStableObjectValue = (value: unknown): AnyRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const getStableObjectSignature = (value: AnyRecord = {}): string => {
  try {
    return JSON.stringify(normalizeStableObjectValue(value));
  } catch (_) {
    return '';
  }
};

export const useStableSerializedObject = (value: AnyRecord | null | undefined): AnyRecord => {
  const normalizedValue = normalizeStableObjectValue(value);
  const signature = getStableObjectSignature(normalizedValue);
  const stableRef = useRef({ signature, value: normalizedValue });
  if (stableRef.current.signature !== signature) {
    stableRef.current = { signature, value: normalizedValue };
  }
  return stableRef.current.value;
};

type ReadCacheDeps = {
  readDraftCache?: () => unknown | null;
};

type LoggerLike = {
  warn?: (...args: unknown[]) => void;
};

type WriteCacheDeps = {
  logger?: LoggerLike;
  writeDraftCache?: typeof writeSessionWizardDraftCache;
};

type ClearCacheDeps = {
  clearDraftCache?: typeof clearSessionWizardDraftCache;
  clearPendingSbtDrafts?: typeof clearSessionWizardPendingSbtDraftsCache;
  logger?: LoggerLike;
};

export type SessionWizardCachedState = Record<string, unknown> & {
  defaultGateId?: unknown;
  deployComplete?: unknown;
  deployForm?: AnyRecord;
  deployWorkerUrl?: unknown;
  draft?: AnyRecord;
  encryptedFieldGates?: AnyRecord;
  encryptionGates?: AnyRecord[];
  featuredDraftGateAutoLink?: unknown;
  gateSelections?: AnyRecord;
  lastManualSlug?: unknown;
  manualGasLimit?: unknown;
  manualGasPriceGwei?: unknown;
  manualMaxFeePerGasGwei?: unknown;
  manualMaxPriorityFeePerGasGwei?: unknown;
  privateSlugMode?: unknown;
  provisionedSponsoredContext?:
    | (AnyRecord & {
        fields?: AnyRecord;
        sessionSlug?: unknown;
        workerUrl?: unknown;
      })
    | null;
  resourceGateMap?: Record<string, string | string[]>;
  sessionId?: unknown;
  workerSecrets?: WorkerSecretsLike;
  workerSecretsEnabled?: unknown;
  persistWorkerSecrets?: unknown;
};

const isSessionWizardCachedState = (value: unknown): value is SessionWizardCachedState =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const readSessionWizardCache = ({
  readDraftCache = readSessionWizardDraftCache,
}: ReadCacheDeps = {}): SessionWizardCachedState | null => {
  const cachedValue = readDraftCache();
  return isSessionWizardCachedState(cachedValue) ? cachedValue : null;
};

export const writeSessionWizardCache = (
  payload: unknown,
  { logger = log, writeDraftCache = writeSessionWizardDraftCache }: WriteCacheDeps = {},
) => {
  const result = writeDraftCache(payload);
  if (!result.ok) logger.warn?.('SessionWizard: fallback', result.error || result.status);
  return result;
};

export const clearSessionWizardCache = ({
  clearDraftCache = clearSessionWizardDraftCache,
  clearPendingSbtDrafts = clearSessionWizardPendingSbtDraftsCache,
  logger = log,
}: ClearCacheDeps = {}) => {
  const result = clearDraftCache({
    clearPendingSbtDrafts,
  });
  if (!result.ok && result.status !== 'missing-storage') {
    logger.warn?.('SessionWizard: fallback', result.status);
  }
  return result;
};
