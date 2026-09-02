import * as defaultSessionRegistry from '../../../utilities/web3/sessionRegistry.js';
import * as defaultSessionConfig from '../sessionConfig.js';
import { sessionRegistryPublishAdapter } from '../publish/sessionPublishAdapters.js';

export type SessionRegistryRecord = Record<string, unknown>;
export type SessionRegistryRawEntry = [string, unknown];
export type SessionRegistryEntry = [string, unknown];

export type SessionRegistryCacheTarget = {
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
};

export type SessionRegistryStore = {
  getAllSessionEntries: () => SessionRegistryRawEntry[];
  getSessionConfig: (slug: string) => SessionRegistryRecord | null | undefined;
  getSessionConfigById: (sessionId: string | number) => SessionRegistryRecord | null | undefined;
};

export type SessionRegistryReadsPort = {
  loadSessionRegistryCache: (input?: SessionRegistryRecord) => Promise<unknown>;
  loadGroupRegistryCache: (input?: SessionRegistryRecord) => Promise<unknown>;
  getAllSessionEntries: () => SessionRegistryEntry[];
  getAllSessionSlugs: (options?: { includeEmpty?: boolean }) => string[];
  getSessionConfig: (slug: string) => SessionRegistryRecord | null | undefined;
  getSessionConfigBySlug: (slug: string) => SessionRegistryRecord | null | undefined;
  getSessionConfigById: (sessionId: string | number) => SessionRegistryRecord | null | undefined;
  fetchSessionFromRegistry: (input?: SessionRegistryRecord) => Promise<SessionRegistryRecord | null | undefined>;
  upsertSessionRegistryCache: (input?: SessionRegistryRecord) => unknown;
  normalizeSessionIdHex: (value: unknown) => string;
  formatSessionId: (value: unknown) => string;
  toRegistrySlug: (value: unknown) => string;
  subscribeToCacheUpdates: (
    target: SessionRegistryCacheTarget,
    listener: EventListenerOrEventListenerObject,
  ) => () => void;
};

const resolveCacheUpdateEvent = (): string =>
  defaultSessionRegistry.SESSION_REGISTRY_CACHE_UPDATED_EVENT ||
  String(
    (defaultSessionRegistry.sessionRegistryUtils as SessionRegistryRecord).SESSION_REGISTRY_CACHE_UPDATED_EVENT || '',
  );

export const sessionRegistryReadsPort: SessionRegistryReadsPort = {
  loadSessionRegistryCache: (input) => defaultSessionRegistry.loadSessionRegistryCache(input),
  loadGroupRegistryCache: (input) => defaultSessionRegistry.loadGroupRegistryCache(input),
  getAllSessionEntries: () => defaultSessionRegistry.sessionRegistryStore.getAllSessionEntries(),
  getAllSessionSlugs: (options) => defaultSessionConfig.getAllSessionSlugs(options),
  getSessionConfig: (slug) => defaultSessionRegistry.sessionRegistryStore.getSessionConfig(slug),
  getSessionConfigBySlug: (slug) => defaultSessionConfig.getSessionConfigBySlug(slug),
  getSessionConfigById: (sessionId) => defaultSessionRegistry.sessionRegistryStore.getSessionConfigById(sessionId),
  fetchSessionFromRegistry: (input) =>
    sessionRegistryPublishAdapter.fetchSessionFromRegistry(input || {}) as Promise<
      SessionRegistryRecord | null | undefined
    >,
  upsertSessionRegistryCache: (input) => sessionRegistryPublishAdapter.upsertSessionRegistryCache(input || {}),
  normalizeSessionIdHex: (value) => sessionRegistryPublishAdapter.normalizeSessionIdHex(value),
  formatSessionId: (value) => sessionRegistryPublishAdapter.formatSessionId(value),
  toRegistrySlug: (value) => sessionRegistryPublishAdapter.toRegistrySlug(value),
  subscribeToCacheUpdates: (target, listener) => {
    const eventName = resolveCacheUpdateEvent();
    target.addEventListener(eventName, listener);
    return () => {
      target.removeEventListener(eventName, listener);
    };
  },
};
