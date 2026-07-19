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
    [
      cachedWizard?.deployWorkerUrl,
      cachedWizard?.draft?.corsWorkerUrl,
      cachedWizard?.draft?.slug,
      cachedWizard?.sessionId,
    ],
  );
  const currentLiveIdentity = useMemo(
    () =>
      createSessionWizardWorkerSettlement({
        workerUrl: currentIdentity?.workerUrl,
        slug: currentIdentity?.slug,
        sessionId: currentIdentity?.sessionId,
        settledAt: 1,
      }),
    [currentIdentity?.sessionId, currentIdentity?.slug, currentIdentity?.workerUrl],
  );
  // Regression guard: after publication the tombstone intentionally replaces the entire draft. Its embedded
  // identity must therefore be sufficient to restore the terminal lock on the next page load.
  // A tombstone is already terminal and must survive the post-publish form reset. Otherwise the complete live
  // form identity is authoritative: a stale cached draft cannot choose this tab's marker.
  const liveIdentity = cachedTerminalSettlement || currentLiveIdentity || cachedDraftIdentity;
  const initialSettlement = useMemo(() => {
    if (isSessionWizardWorkerSettlementForIdentity(cachedTerminalSettlement, liveIdentity)) {
      return cachedTerminalSettlement;
    }
    return liveIdentity ? readSessionWizardWorkerSettlement({ identity: liveIdentity }) : null;
  }, [cachedTerminalSettlement, liveIdentity]);
  const [storedSettlement, setStoredSettlement] = useState<SessionWizardWorkerSettlement | null>(initialSettlement);
  const isPublishedWorkerState = isWorkerCanonical && publishStatus === 'published';
  // Publishing rotates the form session ID for the next draft. Pin the just-completed settlement while the
  // publish state is terminal so Create Another clears the published marker, not the newly generated identity.
  const pinsPublishedSettlement = isPublishedWorkerState && !!storedSettlement;
  const boundIdentity = pinsPublishedSettlement ? storedSettlement : liveIdentity;
  const settlement = isSessionWizardWorkerSettlementForIdentity(storedSettlement, boundIdentity)
    ? storedSettlement
    : null;
  const isSettled = !!settlement;
  const publishCompleted = isSettled || isPublishedWorkerState;
  const ref = useRef(isSettled);
  const setSettled = useCallback(
    (value: SessionWizardWorkerSettlementInput | boolean) => {
      if (value === false) {
        ref.current = false;
        setStoredSettlement(null);
        return;
      }
      const nextSettlement = createSessionWizardWorkerSettlement(value === true ? boundIdentity : value);
      if (!nextSettlement) return;
      ref.current = true;
      setStoredSettlement(nextSettlement);
    },
    [boundIdentity],
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
    if (!boundIdentity) {
      ref.current = false;
      setStoredSettlement(null);
      return undefined;
    }
    const restoredSettlement = pinsPublishedSettlement
      ? boundIdentity
      : isSessionWizardWorkerSettlementForIdentity(cachedTerminalSettlement, boundIdentity)
        ? cachedTerminalSettlement
        : readSessionWizardWorkerSettlement({ identity: boundIdentity });
    ref.current = !!restoredSettlement;
    setStoredSettlement((current) =>
      current?.workerUrl === restoredSettlement?.workerUrl &&
      current?.slug === restoredSettlement?.slug &&
      current?.sessionId === restoredSettlement?.sessionId &&
      current?.settledAt === restoredSettlement?.settledAt
        ? current
        : restoredSettlement,
    );
    if (typeof window === 'undefined') return undefined;
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      const storedSettlement = parseSessionWizardWorkerSettlementStorageEvent(event);
      if (isSessionWizardWorkerSettlementForIdentity(storedSettlement, boundIdentity)) {
        setSettled(storedSettlement as SessionWizardWorkerSettlement);
        return;
      }
      if (event.key !== SESSION_WIZARD_CACHE_KEY) return;

      const eventSettlement = event.newValue ? readTerminalSettlementFromCachedPayload(event.newValue) : null;
      if (isSessionWizardWorkerSettlementForIdentity(eventSettlement, boundIdentity)) {
        // Keep cache events identity-scoped so settling one session cannot lock another live wizard tab.
        setSettled(eventSettlement as SessionWizardWorkerSettlement);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [boundIdentity, cachedTerminalSettlement, pinsPublishedSettlement, setSettled]);

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
