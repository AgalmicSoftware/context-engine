import { useCallback, useEffect, useRef, useState } from 'react';

import type { RecoveryKeyDisplay } from '../Shared/RecoveryKeyDialog';

// Deliberately separate from wizard drafts and deployment status/cache objects.
export const useRecoveryKeyCustody = (identity: string) => {
  const [operatorRecoveryKey, setOperatorRecoveryKey] = useState('');
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
    setOperatorRecoveryKey('');
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
      setOperatorRecoveryKey('');
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
