import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  sessionRegistryReadsPort,
  type SessionRegistryReadsPort,
  type SessionRegistryRecord,
} from '../../domains/sessions/registry/sessionRegistryReadPorts.js';
import { queryKeys, type QueryKeyScope, type ScopedQueryKey } from './queryKeys.js';
import { sessionRegistryQueryFamilyKey } from './sessionRegistryQueryInvalidation.js';

type SessionRegistrySnapshot = {
  slugs: string[];
  configsBySlug: Record<string, SessionRegistryRecord>;
};

type UseSessionRegistryReadsOptions = {
  chainId?: QueryKeyScope['chainId'];
  includeRegistryList?: boolean;
  sessionSlugs?: readonly string[];
};

type UseSessionRegistryReadsResult = {
  queryClient: QueryClient;
  snapshotQuery: UseQueryResult<SessionRegistrySnapshot>;
};

const sessionRegistryQueryKeys = Object.freeze({
  family: sessionRegistryQueryFamilyKey,
  snapshot: (
    { chainId = null, includeRegistryList = true, sessionSlugs = [] }: UseSessionRegistryReadsOptions = {},
  ): ScopedQueryKey => {
    const requestedSlugs = Array.from(new Set(sessionSlugs.map(String))).sort();
    return queryKeys.scoped('sessions', 'registry', {
      chainId,
      sessionSlug: null,
      address: null,
      ids: ['snapshot', ...(includeRegistryList ? [] : ['requested-only']), ...requestedSlugs],
    });
  },
});

const readSessionRegistrySnapshot = (
  port: SessionRegistryReadsPort = sessionRegistryReadsPort,
  requestedSlugs: readonly string[] = [],
  includeRegistryList = true,
): SessionRegistrySnapshot => {
  const slugs = includeRegistryList
    ? Array.from(new Set((port.getAllSessionSlugs({ includeEmpty: true }) || []).map(String)))
    : [];
  const configsBySlug: Record<string, SessionRegistryRecord> = {};

  Array.from(new Set([...slugs, ...requestedSlugs.map(String)])).forEach((slug) => {
    if (!slug) return;
    const config = port.getSessionConfigBySlug(slug);
    if (config) configsBySlug[slug] = config;
  });

  return { slugs, configsBySlug };
};

export const useSessionRegistryReads = (
  options: UseSessionRegistryReadsOptions = {},
): UseSessionRegistryReadsResult => {
  // Regression guard: hooks resolve the provider client from context. Importing
  // the app bootstrap here would initialize wagmi in every transitive test graph.
  const queryClient = useQueryClient();

  const snapshotQuery = useQuery<SessionRegistrySnapshot>({
    queryKey: sessionRegistryQueryKeys.snapshot(options),
    queryFn: () =>
      readSessionRegistrySnapshot(
        sessionRegistryReadsPort,
        options.sessionSlugs,
        options.includeRegistryList !== false,
      ),
    initialData: () =>
      readSessionRegistrySnapshot(
        sessionRegistryReadsPort,
        options.sessionSlugs,
        options.includeRegistryList !== false,
      ),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
    return sessionRegistryReadsPort.subscribeToCacheUpdates(window, () => {
      void queryClient.invalidateQueries({ queryKey: sessionRegistryQueryKeys.family });
    });
  }, [queryClient]);

  return { queryClient, snapshotQuery };
};

// Legacy-to-query freshness mapping:
// | Existing behavior | Query v4 mapping |
// | synchronous cache read on render | initialData uses the same read port |
// | no registry TTL | staleTime: Infinity |
// | cache load/upsert completion | existing cache-update event invalidates this family |
// | no explicit eviction contract | shared wagmi client retains queries for 24 hours |
