import { useCallback, useEffect, useRef, useState } from 'react';

import type { RecoveryKeyDisplay } from '../Shared/RecoveryKeyDialog';

// Deliberately separate from wizard drafts and deployment status/cache objects.
export const useRecoveryKeyCustody = (identity: string) => {
  // null requests a generated key; an empty string is an unfinished operator choice.
  const [operatorRecoveryKey, updateOperatorRecoveryKey] = useState<string | null>(null);
  const setOperatorRecoveryKey = useCallback((value: string | null) => {
    updateOperatorRecoveryKey(value === null ? null : value.trim().toLowerCase());
  }, []);
  const [recoveryDisplay, setRecoveryDisplay] = useState<RecoveryKeyDisplay | null>(null);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const active = useRef(true);
  const continuation = useRef<((continued: boolean) => void) | null>(null);
  const finishRecoveryDisplay = useCallback(() => {
    setRecoveryDisplay(null);
    continuation.current?.(true);
    continuation.current = null;
  }, []);
  useEffect(() => {
    active.current = true;
    setRecoveryDisplay(null);
    return () => {
      active.current = false;
      continuation.current?.(false);
      continuation.current = null;
    };
  }, [identity]);
  const presentRecoveryKey = useCallback(
    async (value: RecoveryKeyDisplay) => {
      if (!active.current || currentIdentity.current !== identity)
        throw new Error('Deployment context changed. Export the recovery key from Backup & restore.');
      updateOperatorRecoveryKey(null);
      setRecoveryDisplay(value);
      const continued = await new Promise<boolean>((resolve) => {
        continuation.current = resolve;
      });
      if (!continued) throw new Error('Deployment context changed. Export the recovery key from Backup & restore.');
    },
    [identity],
  );
  return { operatorRecoveryKey, setOperatorRecoveryKey, recoveryDisplay, finishRecoveryDisplay, presentRecoveryKey };
};
