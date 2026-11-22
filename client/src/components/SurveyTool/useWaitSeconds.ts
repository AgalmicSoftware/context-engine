import { useEffect, useState } from 'react';

const MS_PER_SECOND = 1000;

/**
 * Whole seconds the current wait has run, ticking once a second; 0 while `wait` is empty.
 * A new wait, or the same one started again, counts from 0. Each tick reads the clock, so a
 * phone that held back a background tab's ticks shows the true time when it comes back.
 */
export const useWaitSeconds = (wait: string): number => {
  const [count, setCount] = useState({ wait: '', seconds: 0 });
  useEffect(() => {
    if (!wait) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(
      () => setCount({ wait, seconds: Math.floor((Date.now() - startedAt) / MS_PER_SECOND) }),
      MS_PER_SECOND,
    );
    return () => {
      clearInterval(timer);
      setCount({ wait: '', seconds: 0 });
    };
  }, [wait]);
  // Until its first tick, a wait reads 0 rather than the count of the one before.
  return count.wait === wait ? count.seconds : 0;
};
