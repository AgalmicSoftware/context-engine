/** @file useSessionSlugState.js */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toStr } from '../../../utilities/shared/primitives.js';

export const SESSION_SLUG_AVAILABILITY_DEBOUNCE_MS = 300;

const defaultIsReservedSlug = () => false;
const defaultSessionExists = async () => false;

const useSessionSlugState = ({
  slug = '',
  privateSlugMode = false,
  registryChainId = null,
  debounceMs = SESSION_SLUG_AVAILABILITY_DEBOUNCE_MS,
  isReservedSlug = defaultIsReservedSlug,
  sessionExists = defaultSessionExists,
} = {}) => {
  const [slugAvailability, setSlugAvailability] = useState({ status: 'idle' });
  const slugCheckTimerRef = useRef(null);
  const slugCheckIdRef = useRef(0);

  const resetSlugAvailability = useCallback(() => {
    slugCheckIdRef.current += 1;
    if (slugCheckTimerRef.current) clearTimeout(slugCheckTimerRef.current);
    slugCheckTimerRef.current = null;
    setSlugAvailability({ status: 'idle' });
  }, []);

  useEffect(() => {
    // Invalidate any in-flight check immediately on every dependency change.
    slugCheckIdRef.current += 1;
    if (slugCheckTimerRef.current) clearTimeout(slugCheckTimerRef.current);
    slugCheckTimerRef.current = null;

    if (privateSlugMode) {
      setSlugAvailability({ status: 'idle' });
      return undefined;
    }
    const normalizedSlug = toStr(slug).trim();
    if (!normalizedSlug) {
      setSlugAvailability({ status: 'idle' });
      return undefined;
    }
    if (isReservedSlug(normalizedSlug)) {
      setSlugAvailability({ status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    const checkId = slugCheckIdRef.current;
    slugCheckTimerRef.current = setTimeout(() => {
      slugCheckTimerRef.current = null;
      setSlugAvailability({ status: 'checking' });
      (async () => {
        try {
          const exists = await sessionExists({ registryChainId, slug: normalizedSlug });
          if (!cancelled && checkId === slugCheckIdRef.current) {
            setSlugAvailability({ status: exists ? 'taken' : 'available' });
          }
        } catch (_) {
          if (!cancelled && checkId === slugCheckIdRef.current) {
            setSlugAvailability({ status: 'error' });
          }
        }
      })();
    }, debounceMs);
    return () => {
      cancelled = true;
      if (slugCheckTimerRef.current) clearTimeout(slugCheckTimerRef.current);
      slugCheckTimerRef.current = null;
    };
  }, [debounceMs, isReservedSlug, privateSlugMode, registryChainId, sessionExists, slug]);

  return {
    slugAvailability,
    resetSlugAvailability,
  };
};

export default useSessionSlugState;
