import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { SESSION_WIZARD_CACHE_KEY } from '../sessionWizardDraftCache';
import {
  clearSessionWizardCache,
  startFreshSessionWizard,
  type SessionWizardCachedState,
} from '../sessionWizardLocalStateSupport';
import { resolveSessionWizardWorkerPublishSuccessSettlementDescriptor } from '../sessionWizardPublishController';
import {
  createSessionWizardWorkerSettlement,
  isSessionWizardWorkerSettlementForIdentity,
  parseSessionWizardWorkerSettlementStorageEvent,
  readSessionWizardWorkerSettlement,
  type SessionWizardWorkerSettlement,
  type SessionWizardWorkerSettlementInput,
} from '../sessionWizardWorkerSettlement';

type CachedSettlementPayload = {
  deployWorkerUrl?: unknown;
  draft?: {
    corsWorkerUrl?: unknown;
    sessionModeProfile?: { authority?: { mode?: unknown } };
    slug?: unknown;
  };
  sessionId?: unknown;
  terminalWorkerSettlement?: unknown;
};

type PublicationLifecycleOptions = {
  currentIdentity?: SessionWizardWorkerSettlementInput | null;
  isWorkerCanonical?: boolean;
  publishStatus?: unknown;
  setSessionUrl?: Dispatch<SetStateAction<string>>;
  setAdminUrl?: Dispatch<SetStateAction<string>>;
  startFreshSession?: typeof startFreshSessionWizard;
};

const readCachedPayload = (raw: string | null): CachedSettlementPayload | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as CachedSettlementPayload) : null;
  } catch (_) {
    return null;
  }
};

const readTerminalSettlementFromCachedPayload = (raw: string | null): SessionWizardWorkerSettlement | null =>
  createSessionWizardWorkerSettlement(readCachedPayload(raw)?.terminalWorkerSettlement);

const useSessionWizardWorkerSettlementLifecycle = (
  cachedWizard: SessionWizardCachedState | null,
  {
    currentIdentity = null,
    isWorkerCanonical = false,
    publishStatus,
    setSessionUrl,
    setAdminUrl,
    startFreshSession = startFreshSessionWizard,
  }: PublicationLifecycleOptions = {},
) => {
  const cachedTerminalSettlement = useMemo(
    () => createSessionWizardWorkerSettlement(cachedWizard?.terminalWorkerSettlement),
    [cachedWizard?.terminalWorkerSettlement],
  );
  const cachedDraftIdentity = useMemo(
    () =>
      createSessionWizardWorkerSettlement({
        workerUrl: cachedWizard?.deployWorkerUrl || cachedWizard?.draft?.corsWorkerUrl,
        slug: cachedWizard?.draft?.slug,
        sessionId: cachedWizard?.sessionId,
        settledAt: 1,
      }),
    [cachedWizard?.deployWorkerUrl, cachedWizard?.draft?.corsWorkerUrl, cachedWizard?.draft?.slug, cachedWizard?.sessionId],
  );
  // Regression guard: after publication the tombstone intentionally replaces the entire draft. Its embedded
  // identity must therefore be sufficient to restore the terminal lock on the next page load.
  const cachedIdentity = cachedTerminalSettlement || cachedDraftIdentity;
  const initialSettlement = useMemo(() => {
    if (isSessionWizardWorkerSettlementForIdentity(cachedTerminalSettlement, cachedIdentity)) {
      return cachedTerminalSettlement;
    }
    return cachedIdentity
      ? readSessionWizardWorkerSettlement({ identity: cachedIdentity })
      : null;
  }, [cachedIdentity, cachedTerminalSettlement]);
  const [settlement, setSettlement] = useState<SessionWizardWorkerSettlement | null>(initialSettlement);
  const isSettled = !!settlement;
  const isPublishedWorkerState = isWorkerCanonical && publishStatus === 'published';
  const publishCompleted = isSettled || isPublishedWorkerState;
  const ref = useRef(isSettled);
  const setSettled = useCallback(
    (value: SessionWizardWorkerSettlementInput | boolean) => {
      if (value === false) {
        ref.current = false;
        setSettlement(null);
        return;
      }
      const nextSettlement = createSessionWizardWorkerSettlement(value === true ? cachedIdentity : value);
      if (!nextSettlement) return;
      ref.current = true;
      setSettlement(nextSettlement);
    },
    [cachedIdentity],
  );
  const preventDuplicatePublish = useCallback(
    (onGuarded: (message: string) => void) => {
      if (!ref.current && !isPublishedWorkerState) return false;
      onGuarded('This worker already owns the published session. Open Create another session to start fresh.');
      return true;
    },
    [isPublishedWorkerState],
  );
  const createAnotherSession = useCallback(
    () => startFreshSession({ settlement: settlement || currentIdentity }),
    [currentIdentity, settlement, startFreshSession],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !cachedIdentity) return undefined;
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      const storedSettlement = parseSessionWizardWorkerSettlementStorageEvent(event);
      if (isSessionWizardWorkerSettlementForIdentity(storedSettlement, cachedIdentity)) {
        setSettled(storedSettlement as SessionWizardWorkerSettlement);
        return;
      }
      if (event.key !== SESSION_WIZARD_CACHE_KEY) return;

      const eventSettlement = event.newValue ? readTerminalSettlementFromCachedPayload(event.newValue) : null;
      if (isSessionWizardWorkerSettlementForIdentity(eventSettlement, cachedIdentity)) {
        // Keep cache events identity-scoped so settling one session cannot lock another live wizard tab.
        setSettled(eventSettlement as SessionWizardWorkerSettlement);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [cachedIdentity, setSettled]);

  useEffect(() => {
    if (!settlement) return;
    // Keep the terminal lock even if a tab-local sessionStorage clear fails; callers can retry without republishing.
    clearSessionWizardCache({
      retainPendingSbtDrafts: true,
      workerSettlement: settlement,
    });
  }, [settlement]);

  useEffect(() => {
    if (!settlement || !setSessionUrl || !setAdminUrl) return;
    const restoredLinks = resolveSessionWizardWorkerPublishSuccessSettlementDescriptor({
      slug: settlement.slug,
      sessionId: settlement.sessionId,
      workerOrigin: settlement.workerUrl,
    });
    setSessionUrl((current) => current || restoredLinks.sessionUrl);
    setAdminUrl((current) => current || restoredLinks.adminUrl);
  }, [setAdminUrl, setSessionUrl, settlement]);

  return {
    isSettled,
    onCreateAnotherSession: publishCompleted ? createAnotherSession : undefined,
    preventDuplicatePublish,
    publishCompleted,
    ref,
    setSettled,
    settlement,
  };
};

export default useSessionWizardWorkerSettlementLifecycle;
