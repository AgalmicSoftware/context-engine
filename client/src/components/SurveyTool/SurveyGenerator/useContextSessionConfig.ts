import { useCallback, useEffect, useRef, useState } from 'react';
import { readKnownSessionCatalog } from '../../../utilities/session/sessionCatalog';
import { SESSION_REGISTRY_CACHE_UPDATED_EVENT } from '../../../utilities/web3/sessionRegistry';
import {
  getVerifiedWorkerCanonicalSessionBootstrap,
  SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT,
} from '../../../utilities/session/sessionWorkerConfigCache';
import {
  parseSessionWorkerDiscoveryOrigin,
  parseSessionWorkerDiscoveryQuery,
  type WorkerCanonicalSessionBootstrap,
} from '../../../utilities/session/sessionWorkerDiscovery';

type Config = Record<string, unknown>;
type Discovery = { slug: string; origin: string; config: Config | null };

export function useContextSessionConfig(slug: string, supplied: Config | null | undefined) {
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const reading = useRef(false);
  const needsDiscovery =
    !supplied ||
    !Object.keys(supplied).length ||
    !!supplied.__unresolved ||
    supplied.workerCanonicalCleanRoute === true;
  const suppliedOrigin = needsDiscovery ? supplied?.corsWorkerUrl : undefined;

  useEffect(() => {
    if (!needsDiscovery) return;
    const refresh = () => {
      if (reading.current) return;
      reading.current = true;
      try {
        const entry = readKnownSessionCatalog().find((entry) => entry.slug === slug);
        const origin = suppliedOrigin
          ? parseSessionWorkerDiscoveryOrigin(suppliedOrigin)
          : entry?.kind === 'centralized'
            ? parseSessionWorkerDiscoveryQuery(new URL(entry.href, window.location.origin).search)
            : '';
        setDiscovery(
          origin
            ? {
                slug,
                origin,
                config: getVerifiedWorkerCanonicalSessionBootstrap({ slug, workerOrigin: origin }),
              }
            : null,
        );
      } catch {
        setDiscovery(null);
      } finally {
        reading.current = false;
      }
    };
    window.addEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, refresh);
    window.addEventListener(SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT, refresh);
    refresh();
    return () => {
      window.removeEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, refresh);
      window.removeEventListener(SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT, refresh);
    };
  }, [slug, needsDiscovery, suppliedOrigin]);

  const onResolved = useCallback((bootstrap: WorkerCanonicalSessionBootstrap) => {
    setDiscovery((current) =>
      current?.slug === bootstrap.sessionSlug && current.origin === bootstrap.workerOrigin
        ? { ...current, config: bootstrap.config }
        : current,
    );
  }, []);
  // Directory hints only locate a Worker. Reuse the normal bootstrap boundary's
  // identity validation and pin checks before routing audio or other Context work.
  const selected = needsDiscovery && discovery?.slug === slug ? discovery : null;
  return {
    sessionConfig: needsDiscovery ? selected?.config || null : supplied,
    bootstrapProps:
      selected && !selected.config ? { sessionSlug: slug, workerQueryValue: selected.origin, onResolved } : null,
  };
}
