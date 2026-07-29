/** @file useSessionSlugState.js */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toStr } from '../../../utilities/shared/primitives.js';
import type { ChainIdLike } from '../../shellTypes';

export const SESSION_SLUG_AVAILABILITY_DEBOUNCE_MS = 300;

type SlugAvailabilityState = {
  status: 'idle' | 'checking' | 'taken' | 'available' | 'error';
};

type SessionExistsArgs = {
  registryChainId?: ChainIdLike;
  slug: string;
};

type UseSessionSlugStateArgs = {
  enabled?: boolean;
  slug?: string;
  privateSlugMode?: boolean;
  registryChainId?: ChainIdLike;
  debounceMs?: number;
  isReservedSlug?: (slug: string) => boolean;
  sessionExists?: (args: SessionExistsArgs) => Promise<boolean>;
};

const defaultIsReservedSlug = (_slug: string) => false;
const defaultSessionExists = async (_args: SessionExistsArgs) => false;

const useSessionSlugState = ({
  enabled = true,
  slug = '',
  privateSlugMode = false,
  registryChainId = null,
  debounceMs = SESSION_SLUG_AVAILABILITY_DEBOUNCE_MS,
  isReservedSlug = defaultIsReservedSlug,
  sessionExists = defaultSessionExists,
}: UseSessionSlugStateArgs = {}) => {
  const [slugAvailability, setSlugAvailability] = useState<SlugAvailabilityState>({ status: 'idle' });
  const slugCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    if (!enabled || privateSlugMode) {
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
  }, [debounceMs, enabled, isReservedSlug, privateSlugMode, registryChainId, sessionExists, slug]);

  return {
    slugAvailability,
    resetSlugAvailability,
  };
};

export default useSessionSlugState;
