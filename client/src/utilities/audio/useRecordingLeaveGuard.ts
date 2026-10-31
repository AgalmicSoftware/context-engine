import { useEffect, useState } from 'react';

const GUARD_STATE = 'ceRecordingGuard';
const onGuardEntry = () => Boolean((window.history.state as Record<string, unknown> | null)?.[GUARD_STATE]);

/**
 * Leaving must not end a recording or lose its audio by accident. While audio would be lost or left unsent,
 * a reload or tab close asks first (the browser's own prompt; iOS Safari shows none). While capturing, Back
 * stays on this page: an extra entry at the same address takes it, and the result says Back was pressed.
 */
export function useRecordingLeaveGuard(capturing: boolean, unsent: boolean): boolean {
  const [backBlocked, setBackBlocked] = useState(false);
  useEffect(() => {
    if (!capturing && !unsent) return undefined;
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Some browsers show the prompt only when returnValue is set.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', ask);
    return () => window.removeEventListener('beforeunload', ask);
  }, [capturing, unsent]);
  useEffect(() => {
    setBackBlocked(false);
    if (!capturing) return undefined;
    const address = window.location.href;
    const arm = () => {
      try {
        window.history.pushState({ ...window.history.state, [GUARD_STATE]: true }, '', address);
      } catch {
        // Without the extra entry Back leaves as before; a reload or close still asks.
      }
    };
    if (!onGuardEntry()) arm();
    const onPopState = () => {
      // Back reached the entry beneath ours, at the same address: keep the page and say why.
      if (onGuardEntry() || window.location.href !== address) return;
      arm();
      setBackBlocked(true);
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      // Take our entry off the top once capture ends, so one Back leaves.
      if (onGuardEntry()) window.history.back();
    };
  }, [capturing]);
  return backBlocked;
}
