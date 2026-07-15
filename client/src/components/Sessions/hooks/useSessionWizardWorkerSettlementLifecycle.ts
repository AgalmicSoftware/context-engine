import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearSessionWizardCache, type SessionWizardCachedState } from '../sessionWizardLocalStateSupport';
import {
  readSessionWizardWorkerSettlement,
  shouldRestoreSessionWizardWorkerSettlement,
} from '../sessionWizardWorkerSettlement';

const useSessionWizardWorkerSettlementLifecycle = (cachedWizard: SessionWizardCachedState | null) => {
  const cachedSettlement = useMemo(() => readSessionWizardWorkerSettlement(), []);
  const initiallySettled = useMemo(
    () =>
      shouldRestoreSessionWizardWorkerSettlement({
        settlement: cachedSettlement,
        cachedWorkerUrl: cachedWizard?.deployWorkerUrl || cachedWizard?.draft?.corsWorkerUrl,
      }),
    [cachedSettlement, cachedWizard?.deployWorkerUrl, cachedWizard?.draft?.corsWorkerUrl],
  );
  const [isSettled, setIsSettled] = useState(initiallySettled);
  const ref = useRef(initiallySettled);
  const setSettled = useCallback((value: boolean) => {
    ref.current = value;
    setIsSettled(value);
  }, []);

  useEffect(() => {
    if (!isSettled) return;
    // A marker can survive an interrupted settlement with a stale draft. Keep the marker terminal while removing
    // the stale draft so no reload can republish it to the same worker.
    clearSessionWizardCache();
  }, [isSettled]);

  return { isSettled, ref, setSettled };
};

export default useSessionWizardWorkerSettlementLifecycle;
