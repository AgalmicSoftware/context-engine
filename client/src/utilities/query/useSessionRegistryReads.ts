import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient, type UseQueryResult } from '@tanstack/react-query';
import { appQueryFoundation } from '../../app/runtime/appQueryClient.js';
import {
  sessionRegistryReadsPort,
  type SessionRegistryReadsPort,
  type SessionRegistryRecord,
} from '../../domains/sessions/registry/sessionRegistryReadPorts.js';
import type { QueryKeyScope, ScopedQueryKey } from './queryKeys.js';

type SessionRegistrySnapshot = {
  slugs: string[];
  configsBySlug: Record<string, SessionRegistryRecord>;
};

type UseSessionRegistryReadsOptions = {
  chainId?: QueryKeyScope['chainId'];
  enabled?: boolean;
  sessionSlugs?: readonly string[];
};

type UseSessionRegistryReadsResult = {
  queryClient: QueryClient;
  snapshotQuery: UseQueryResult<SessionRegistrySnapshot>;
};

const registryFamilyKey = appQueryFoundation.keys.entity('sessions', 'registry');
const emptySessionRegistrySnapshot: SessionRegistrySnapshot = {
  slugs: [],
  configsBySlug: {},
};

const sessionRegistryQueryKeys = Object.freeze({
  family: registryFamilyKey,
  snapshot: ({ chainId = null, sessionSlugs = [] }: UseSessionRegistryReadsOptions = {}): ScopedQueryKey =>
    appQueryFoundation.keys.scoped('sessions', 'registry', {
      chainId,
      sessionSlug: null,
      address: null,
      ids: ['snapshot', ...Array.from(new Set(sessionSlugs.map(String))).sort()],
    }),
});

const readSessionRegistrySnapshot = (
  port: SessionRegistryReadsPort = sessionRegistryReadsPort,
  requestedSlugs: readonly string[] = [],
): SessionRegistrySnapshot => {
  const slugs = Array.from(new Set((port.getAllSessionSlugs({ includeEmpty: true }) || []).map(String)));
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
  const queryClient = useQueryClient();
  if (queryClient !== appQueryFoundation.client) {
    throw new Error('Session registry reads require appQueryFoundation.client');
  }

  const snapshotQuery = useQuery<SessionRegistrySnapshot>({
    queryKey: sessionRegistryQueryKeys.snapshot(options),
    queryFn: () => readSessionRegistrySnapshot(sessionRegistryReadsPort, options.sessionSlugs),
    initialData: () =>
      options.enabled === false
        ? emptySessionRegistrySnapshot
        : readSessionRegistrySnapshot(sessionRegistryReadsPort, options.sessionSlugs),
    enabled: options.enabled !== false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (options.enabled === false) return undefined;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
    return sessionRegistryReadsPort.subscribeToCacheUpdates(window, () => {
      void queryClient.invalidateQueries({ queryKey: sessionRegistryQueryKeys.family });
    });
  }, [options.enabled, queryClient]);

  return { queryClient, snapshotQuery };
};

// Legacy-to-query freshness mapping:
// | Existing behavior | Query v4 mapping |
// | synchronous cache read on render | initialData uses the same read port |
// | no registry TTL | staleTime: Infinity |
// | load/fetch/upsert cache completion | existing cache-update event invalidates this family |
// | no explicit eviction contract | v4 cacheTime remains at its library default |
