import * as defaultSessionRegistry from '../../../utilities/web3/sessionRegistry.js';
import {
  bindSessionRegistryPublishAdapter,
  type SessionRegistryPublishModule,
} from '../publish/sessionPublishAdapters.js';

export type SessionRegistryRecord = Record<string, unknown>;
export type SessionRegistryRawEntry = unknown[];
export type SessionRegistryEntry = [string, unknown];

export type SessionRegistryCacheTarget = {
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject
  ) => void;
};

export type SessionRegistryStore = {
  getAllSessionEntries: () => SessionRegistryRawEntry[];
};

export type SessionRegistryReadModule = SessionRegistryPublishModule & {
  SESSION_REGISTRY_CACHE_UPDATED_EVENT: string;
  loadSessionRegistryCache: (
    input?: SessionRegistryRecord
  ) => Promise<unknown>;
  sessionRegistryStore: SessionRegistryStore;
  fetchSessionFromRegistry: (
    input?: SessionRegistryRecord
  ) => Promise<SessionRegistryRecord | null | undefined>;
  upsertSessionRegistryCache: (
    input?: SessionRegistryRecord
  ) => unknown;
};

export type SessionRegistryReadsPort = {
  loadSessionRegistryCache: (
    input?: SessionRegistryRecord
  ) => Promise<unknown>;
  getAllSessionEntries: () => SessionRegistryEntry[];
  fetchSessionFromRegistry: (
    input?: SessionRegistryRecord
  ) => Promise<SessionRegistryRecord | null | undefined>;
  upsertSessionRegistryCache: (
    input?: SessionRegistryRecord
  ) => unknown;
  normalizeSessionIdHex: (value: unknown) => string;
  toRegistrySlug: (value: unknown) => string;
  subscribeToCacheUpdates: (
    target: SessionRegistryCacheTarget,
    listener: EventListenerOrEventListenerObject
  ) => () => void;
};

export type BindSessionRegistryReadsPortArgs = {
  sessionRegistry: () => SessionRegistryReadModule;
};

const resolveCacheUpdateEvent = (module: SessionRegistryReadModule): string => (
  module.SESSION_REGISTRY_CACHE_UPDATED_EVENT ||
  String((module.sessionRegistryUtils as SessionRegistryRecord).SESSION_REGISTRY_CACHE_UPDATED_EVENT || '')
);

export const bindSessionRegistryReadsPort = ({
  sessionRegistry: readSessionRegistry,
}: BindSessionRegistryReadsPortArgs): SessionRegistryReadsPort => {
  const publishAdapter = bindSessionRegistryPublishAdapter({
    sessionRegistry: readSessionRegistry,
  });

  return {
    loadSessionRegistryCache: (input) => (
      readSessionRegistry().loadSessionRegistryCache(input)
    ),
    getAllSessionEntries: () => (
      readSessionRegistry().sessionRegistryStore.getAllSessionEntries() as SessionRegistryEntry[]
    ),
    fetchSessionFromRegistry: (input) => (
      publishAdapter.fetchSessionFromRegistry(input || {}) as Promise<SessionRegistryRecord | null | undefined>
    ),
    upsertSessionRegistryCache: (input) => (
      publishAdapter.upsertSessionRegistryCache(input || {})
    ),
    normalizeSessionIdHex: (value) => (
      publishAdapter.normalizeSessionIdHex(value)
    ),
    toRegistrySlug: (value) => (
      publishAdapter.toRegistrySlug(value)
    ),
    subscribeToCacheUpdates: (target, listener) => {
      const eventName = resolveCacheUpdateEvent(readSessionRegistry());
      target.addEventListener(eventName, listener);
      return () => {
        target.removeEventListener(eventName, listener);
      };
    },
  };
};

export const sessionRegistryReadsPort = bindSessionRegistryReadsPort({
  sessionRegistry: () => defaultSessionRegistry as SessionRegistryReadModule,
});
