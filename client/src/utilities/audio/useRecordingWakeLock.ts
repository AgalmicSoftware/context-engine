import { useEffect, useState } from 'react';

/** A screen lock is best effort: recording must still work when battery or browser policy refuses it. */
export function useRecordingWakeLock(active: boolean) {
  const [held, setHeld] = useState(false);
  const [pageHidden, setPageHidden] = useState(document.visibilityState === 'hidden');
  useEffect(() => {
    const update = () => setPageHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
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
  return { wakeLockHeld: active && held, pageHidden };
}
