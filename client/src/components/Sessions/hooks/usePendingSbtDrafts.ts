/** @file usePendingSbtDrafts.js */
import { useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { createLogger } from '../../../utilities/logging';
import { toStr } from '../../../utilities/shared/primitives.js';
import type { AnyRecord } from '../../shellTypes';

const log = createLogger('general');

export const SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY = 'ce:sessionWizardPendingSbtDrafts:v1';

export type PendingSbtDraft = AnyRecord & {
  id?: string;
  predictedAddress?: string;
  address?: string;
  displayName?: string;
  name?: string;
  tokenURI?: string;
  metadataUploadStatus?: string;
  deployed?: boolean;
};

export const normalizePendingSbtDrafts = (value: unknown): PendingSbtDraft[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((entry): PendingSbtDraft | null => {
      const predictedAddress = toStr(entry?.predictedAddress || entry?.address).trim();
      if (!predictedAddress || !ethers.utils.isAddress(predictedAddress)) return null;
      const key = predictedAddress.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        ...entry,
        id: toStr(entry?.id).trim() || key,
        predictedAddress,
        displayName: toStr(entry?.displayName || entry?.name || predictedAddress).trim() || predictedAddress,
        tokenURI: toStr(entry?.tokenURI).trim(),
        metadataUploadStatus:
          toStr(entry?.metadataUploadStatus).trim() || (toStr(entry?.tokenURI).trim() ? 'ready' : 'pending-upload'),
      };
    })
    .filter((entry): entry is PendingSbtDraft => !!entry);
};

export const readSessionWizardPendingSbtDraftsCache = (): PendingSbtDraft[] => {
  if (typeof window === 'undefined' || !window.sessionStorage) return [];
  try {
    const raw = sessionStorage.getItem(SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY);
    return normalizePendingSbtDrafts(raw ? JSON.parse(raw) : []);
  } catch (_) {
    return [];
  }
};

export const writeSessionWizardPendingSbtDraftsCache = (payload: PendingSbtDraft[] = []): void => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const normalized = normalizePendingSbtDrafts(payload);
    if (!normalized.length) {
      sessionStorage.removeItem(SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY);
      return;
    }
    sessionStorage.setItem(SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY, JSON.stringify(normalized));
  } catch (e) {
    log.warn('SessionWizard: fallback', e);
  }
};

export const clearSessionWizardPendingSbtDraftsCache = (): void => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    sessionStorage.removeItem(SESSION_WIZARD_PENDING_SBT_DRAFTS_KEY);
  } catch (e) {
    log.warn('SessionWizard: fallback', e);
  }
};

const usePendingSbtDrafts = () => {
  const [pendingSbtDrafts, setPendingSbtDrafts] = useState<PendingSbtDraft[]>(() =>
    readSessionWizardPendingSbtDraftsCache(),
  );
  const normalizedPendingSbtDrafts = useMemo(() => normalizePendingSbtDrafts(pendingSbtDrafts), [pendingSbtDrafts]);
  const hasUndeployedPendingSbtDrafts = normalizedPendingSbtDrafts.some((entry) => entry.deployed !== true);

  useEffect(() => {
    writeSessionWizardPendingSbtDraftsCache(pendingSbtDrafts);
  }, [pendingSbtDrafts]);

  return {
    pendingSbtDrafts,
    setPendingSbtDrafts,
    normalizedPendingSbtDrafts,
    hasUndeployedPendingSbtDrafts,
  };
};

export default usePendingSbtDrafts;
