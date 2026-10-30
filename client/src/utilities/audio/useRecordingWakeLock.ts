import { useCallback, useEffect, useRef, useState } from 'react';

/** A screen lock is best effort: recording must still work when battery or browser policy refuses it. */
export function useRecordingWakeLock(active: boolean) {
  const [held, setHeld] = useState(false);
  const [pageHidden, setPageHidden] = useState(document.visibilityState === 'hidden');
  const [hiddenPeriods, setHiddenPeriods] = useState<Array<{ startedAt: number; endedAt: number }>>([]);
  const hiddenSince = useRef<number | null>(null);
  const dismissHiddenPeriods = useCallback(() => setHiddenPeriods([]), []);
  useEffect(() => {
    const update = () => {
      const hidden = document.visibilityState === 'hidden';
      setPageHidden(hidden);
      if (active && hidden) {
        if (hiddenSince.current === null) hiddenSince.current = Date.now();
      } else if (hiddenSince.current !== null) {
        const period = { startedAt: hiddenSince.current, endedAt: Date.now() };
        hiddenSince.current = null;
        setHiddenPeriods((previous) => [...previous, period]);
      }
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, [active]);
  useEffect(() => {
    setHeld(false);
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock?.request) return;
    let disposed = false;
    let pending = false;
    let lock: WakeLockSentinel | null = null;
    const isHidden = () => document.visibilityState === 'hidden';
    const release = () => {
      const previous = lock;
      lock = null;
      if (!disposed) setHeld(false);
      if (previous && !previous.released) void previous.release().catch(() => {});
    };
    const acquire = async () => {
      if (disposed || pending || lock || isHidden()) return;
      pending = true;
      try {
        const next = await navigator.wakeLock.request('screen');
        // A permission response can arrive after Stop, unmount or a tab switch.
        if (disposed || isHidden()) {
          await next.release();
          return;
        }
        lock = next;
        setHeld(!next.released);
        next.addEventListener(
          'release',
          () => {
            if (lock !== next) return;
            lock = null;
            if (!disposed) setHeld(false);
          },
          { once: true },
        );
      } catch {
        if (!disposed) setHeld(false);
      } finally {
        pending = false;
      }
    };
    const onVisibilityChange = () => {
      if (isHidden()) release();
      else void acquire();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    void acquire();
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    };
  }, [active]);
  return { wakeLockHeld: active && held, pageHidden, hiddenPeriods, dismissHiddenPeriods };
}
