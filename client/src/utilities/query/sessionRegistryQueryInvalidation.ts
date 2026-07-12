import type { QueryClient } from '@tanstack/react-query';
import { sessionRegistryReadsPort } from '../../domains/sessions/registry/sessionRegistryReadPorts.js';
import { queryKeys } from './queryKeys.js';

export const sessionRegistryQueryFamilyKey = queryKeys.entity('sessions', 'registry');

const installedClients = new WeakSet<QueryClient>();

export const installSessionRegistryQueryInvalidation = (queryClient: QueryClient): void => {
  if (
    typeof window === 'undefined' ||
    typeof window.addEventListener !== 'function' ||
    installedClients.has(queryClient)
  ) {
    return;
  }

  installedClients.add(queryClient);
  sessionRegistryReadsPort.subscribeToCacheUpdates(window, () => {
    void queryClient.invalidateQueries({ queryKey: sessionRegistryQueryFamilyKey });
  });
};
