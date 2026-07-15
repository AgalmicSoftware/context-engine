import { useRef } from 'react';
import { createLogger } from '../../utilities/logging';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import {
  clearSessionWizardDraftCache,
  readSessionWizardDraftCache,
  writeSessionWizardDraftCache,
} from './sessionWizardDraftCache.js';
import {
  clearSessionWizardPendingSbtDraftsCache,
  writeSessionWizardPendingSbtDraftsCache,
  type PendingSbtDraft,
} from './hooks/usePendingSbtDrafts.js';
import {
  clearSessionWizardWorkerSettlement,
  type SessionWizardWorkerSettlementInput,
} from './sessionWizardWorkerSettlement.js';
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
  expectedWorkerIdentity?: SessionWizardWorkerSettlementInput | null;
  logger?: LoggerLike;
  preservedPendingSbtDrafts?: PendingSbtDraft[];
  retainPendingSbtDrafts?: boolean;
  workerSettlement?: SessionWizardWorkerSettlementInput | null;
};

type FreshSessionWizardDeps = {
  clearCache?: typeof clearSessionWizardCache;
  clearWorkerSettlement?: typeof clearSessionWizardWorkerSettlement;
  navigate?: (target: string) => void;
  settlement?: SessionWizardWorkerSettlementInput | null;
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
  terminalWorkerSettlement?: unknown;
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
  expectedWorkerIdentity,
  logger = log,
  preservedPendingSbtDrafts,
  retainPendingSbtDrafts = false,
  workerSettlement,
}: ClearCacheDeps = {}) => {
  const persistPendingSbtDrafts = () => {
    if (preservedPendingSbtDrafts === undefined) {
      return retainPendingSbtDrafts
        ? { ok: true, removed: 0, failed: 0, status: 'ok' as const }
        : clearPendingSbtDrafts();
    }
    const writeResult = writeSessionWizardPendingSbtDraftsCache(preservedPendingSbtDrafts);
    return {
      ok: writeResult.ok,
      removed: writeResult.ok ? 1 : 0,
      failed: writeResult.ok ? 0 : 1,
      status: writeResult.ok
        ? 'ok' as const
        : writeResult.status === 'missing-storage'
          ? 'missing-storage' as const
          : 'partial-failure' as const,
    };
  };
  const result = clearDraftCache({
    clearPendingSbtDrafts: persistPendingSbtDrafts,
    expectedWorkerIdentity,
    workerSettlement,
  });
  if (!result.ok && result.status !== 'missing-storage') {
    logger.warn?.('SessionWizard: fallback', result.status);
  }
  return result;
};

export const startFreshSessionWizard = ({
  clearCache = clearSessionWizardCache,
  clearWorkerSettlement = clearSessionWizardWorkerSettlement,
  navigate = (target) => window.location.assign(target),
  settlement,
}: FreshSessionWizardDeps = {}) => {
  const clearResult = clearCache({ expectedWorkerIdentity: settlement });
  if (!clearResult.ok) return clearResult;
  const settlementClearResult = clearWorkerSettlement(settlement || {});
  if (!settlementClearResult.ok) return settlementClearResult;
  navigate(buildPublicRoute('/new'));
  return clearResult;
};
