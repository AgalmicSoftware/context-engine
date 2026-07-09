import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect } from 'react';
import { sessionRegistryUtils } from '../../../utilities/web3/sessionRegistry.js';
import { toStr } from '../../../utilities/shared/primitives.js';
import { deepClone } from '../sessionWizardCoreUtils';
import { normalizeSessionWizardSlug as normalizeSlug } from '../sessionWizardUrlSupport';

type DraftWithIdentity = {
  slug?: unknown;
  sessionName?: unknown;
};

export interface UseSessionWizardIdentityEffectsOptions<TDraft extends DraftWithIdentity> {
  initialRegistryChainId?: unknown;
  setRegistryChainId: Dispatch<SetStateAction<number>>;
  initialSessionId?: unknown;
  setSessionId: Dispatch<SetStateAction<string>>;
  setDraft: Dispatch<SetStateAction<TDraft>>;
  privateSlugMode: boolean;
  sessionId: unknown;
  slugPinnedByPendingSbtDrafts: boolean;
  draftSessionName?: unknown;
  draftSlug?: unknown;
  lastManualSlugRef: MutableRefObject<string>;
  hasPrivateSbtName: boolean;
  lastHasPrivateSbtNameRef: MutableRefObject<boolean>;
  privateSlugModeRef: MutableRefObject<boolean>;
  togglePrivateSlugModeRef: MutableRefObject<null | (() => void)>;
}

const useSessionWizardIdentityEffects = <TDraft extends DraftWithIdentity>({
  initialRegistryChainId,
  setRegistryChainId,
  initialSessionId,
  setSessionId,
  setDraft,
  privateSlugMode,
  sessionId,
  slugPinnedByPendingSbtDrafts,
  draftSessionName,
  draftSlug,
  lastManualSlugRef,
  hasPrivateSbtName,
  lastHasPrivateSbtNameRef,
  privateSlugModeRef,
  togglePrivateSlugModeRef,
}: UseSessionWizardIdentityEffectsOptions<TDraft>) => {
  useEffect(() => {
    const desiredChain = Number(initialRegistryChainId || 0) || null;
    if (!desiredChain) return;
    // For now we assume session chain === registry chain; if this diverges, split these values.
    setRegistryChainId((prev) => (Number(prev || 0) === desiredChain ? prev : desiredChain));
  }, [initialRegistryChainId, setRegistryChainId]);

  useEffect(() => {
    const raw = toStr(initialSessionId).trim();
    if (!raw) return;
    const parsedSessionId = sessionRegistryUtils.formatSessionId(raw);
    if (parsedSessionId) {
      setSessionId(parsedSessionId);
      return;
    }
    const desiredSlug = normalizeSlug(raw);
    setDraft((prev) => {
      if (toStr(prev.slug).trim()) return prev;
      const next = deepClone(prev) as TDraft;
      next.slug = desiredSlug;
      return next;
    });
  }, [initialSessionId, setDraft, setSessionId]);

  useEffect(() => {
    if (slugPinnedByPendingSbtDrafts) return;
    if (!privateSlugMode) return;
    const desiredSlug = sessionRegistryUtils.formatSessionId(sessionId) || toStr(sessionId).trim();
    if (!desiredSlug) return;
    setDraft((prev) => {
      if (toStr(prev.slug).trim() === desiredSlug) return prev;
      const next = deepClone(prev) as TDraft;
      next.slug = desiredSlug;
      return next;
    });
  }, [privateSlugMode, sessionId, slugPinnedByPendingSbtDrafts, setDraft]);

  useEffect(() => {
    if (slugPinnedByPendingSbtDrafts) return;
    if (privateSlugMode) return;
    const name = toStr(draftSessionName).trim();
    if (!name) return;
    const autoSlug = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 48);
    if (!autoSlug) return;
    const currentSlug = toStr(draftSlug).trim();
    if (currentSlug && currentSlug === lastManualSlugRef.current && currentSlug !== autoSlug) return;
    if (autoSlug === toStr(draftSlug).trim()) return;
    setDraft((prev) => {
      const next = deepClone(prev) as TDraft;
      next.slug = autoSlug;
      return next;
    });
  }, [draftSessionName, draftSlug, privateSlugMode, slugPinnedByPendingSbtDrafts, lastManualSlugRef, setDraft]);

  useEffect(() => {
    const prev = lastHasPrivateSbtNameRef.current;
    lastHasPrivateSbtNameRef.current = hasPrivateSbtName;
    if (!hasPrivateSbtName || prev) return;
    if (privateSlugModeRef.current) return;
    togglePrivateSlugModeRef.current?.();
  }, [hasPrivateSbtName, lastHasPrivateSbtNameRef, privateSlugModeRef, togglePrivateSlugModeRef]);
};

export default useSessionWizardIdentityEffects;
