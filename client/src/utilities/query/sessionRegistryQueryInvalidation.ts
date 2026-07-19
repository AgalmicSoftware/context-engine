import type { QueryClient } from '@tanstack/react-query';
import { sessionRegistryReadsPort } from '../../domains/sessions/registry/sessionRegistryReadPorts.js';
import { queryKeys } from './queryKeys.js';

export const sessionRegistryQueryFamilyKey = queryKeys.entity('sessions', 'registry');

type InstalledClientSubscription = {
  refCount: number;
  unsubscribe: () => void;
};

const installedClients = new WeakMap<QueryClient, InstalledClientSubscription>();
const noop = (): void => undefined;

export const installSessionRegistryQueryInvalidation = (queryClient: QueryClient): (() => void) => {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return noop;
  }

  // Keep exactly one browser listener per QueryClient while allowing provider
  // remounts and StrictMode cleanup to share and release that listener safely.
  let installed = installedClients.get(queryClient);
  if (!installed) {
    installed = {
      refCount: 0,
      unsubscribe: sessionRegistryReadsPort.subscribeToCacheUpdates(window, () => {
        void queryClient.invalidateQueries({ queryKey: sessionRegistryQueryFamilyKey });
      }),
    };
    installedClients.set(queryClient, installed);
  }

  installed.refCount += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;

    const current = installedClients.get(queryClient);
    if (current !== installed) return;
    current.refCount -= 1;
    if (current.refCount > 0) return;

    current.unsubscribe();
    installedClients.delete(queryClient);
  };
};
