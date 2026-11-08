import { useEffect, useState } from 'react';

// A load that fails without saying so can leave its cache "not ready" for good,
// so an indicator built on that alone would spin forever. This reports loading
// while `loading` holds, for at most `maxMs` in a row; after that the caller
// shows what it showed before it had an indicator.
export const useBoundedLoading = (loading: boolean, maxMs: number): boolean => {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setExpired(false);
    if (!loading) return undefined;
    const timer = setTimeout(() => setExpired(true), maxMs);
    return () => clearTimeout(timer);
  }, [loading, maxMs]);
  return loading && !expired;
};
