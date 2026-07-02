import * as defaultSessionRegistry from '../../../utilities/web3/sessionRegistry.js';
import {
  bindSessionRegistryPublishAdapter,
  type SessionRegistryPublishModule,
} from '../publish/sessionPublishAdapters.js';
import { buildSessionWizardRegistrySessionFields } from './sessionRegistryWriteNormalization.js';

export type AdminSessionRegistryRecord = Record<string, unknown>;
export type AdminSessionRegistryEntry = unknown[];
export type AdminSessionRegistryWriteResult = AdminSessionRegistryRecord & {
  metadataUri?: unknown;
  txHash?: unknown;
  txs?: Array<AdminSessionRegistryRecord & {
    hash?: unknown;
  }>;
};

export type AdminSessionRegistryCacheTarget = {
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject
  ) => void;
};

export type AdminSessionRegistryStore = {
  getAllSessionEntries: () => AdminSessionRegistryEntry[];
};

export type AdminSessionRegistryModule = SessionRegistryPublishModule & {
  SESSION_REGISTRY_CACHE_UPDATED_EVENT: string;
  loadSessionRegistryCache: (
    input?: AdminSessionRegistryRecord
  ) => Promise<unknown>;
  sessionRegistryStore: AdminSessionRegistryStore;
  fetchSessionFromRegistry: (
    input?: AdminSessionRegistryRecord
  ) => Promise<AdminSessionRegistryRecord | null | undefined>;
  upsertSessionRegistryCache: (
    input?: AdminSessionRegistryRecord
  ) => unknown;
  setSessionFieldsOnChain: (
    input?: AdminSessionRegistryRecord
  ) => Promise<AdminSessionRegistryWriteResult>;
  setResourceGatesOnChain: (
    input?: AdminSessionRegistryRecord
  ) => Promise<AdminSessionRegistryWriteResult>;
  uploadSessionMetadata: (
    metadata: AdminSessionRegistryRecord,
    opts?: AdminSessionRegistryRecord
  ) => Promise<AdminSessionRegistryWriteResult>;
  updateSessionMetadataOnChain: (
    input?: AdminSessionRegistryRecord
  ) => Promise<AdminSessionRegistryWriteResult>;
};

export type AdminRegistrySessionFieldsInput = {
  onChainFields?: AdminSessionRegistryRecord;
  sponsoredFields?: AdminSessionRegistryRecord;
  compatibilityFieldPaths?: Record<string, string[]>;
};

export type SessionRegistryReadsPort = {
  loadSessionRegistryCache: (
    input?: AdminSessionRegistryRecord
  ) => Promise<unknown>;
  getAllSessionEntries: () => AdminSessionRegistryEntry[];
  fetchSessionFromRegistry: (
    input?: AdminSessionRegistryRecord
  ) => Promise<AdminSessionRegistryRecord | null | undefined>;
  upsertSessionRegistryCache: (
    input?: AdminSessionRegistryRecord
  ) => unknown;
  normalizeSessionIdHex: (value: unknown) => string;
  toRegistrySlug: (value: unknown) => string;
  subscribeToCacheUpdates: (
    target: AdminSessionRegistryCacheTarget,
    listener: EventListenerOrEventListenerObject
  ) => () => void;
};

export type SessionRegistryAdminWritesPort = {
  buildRegistrySessionFields: (
    input?: AdminRegistrySessionFieldsInput
  ) => AdminSessionRegistryRecord;
  setSessionFieldsOnChain: (
    input?: AdminSessionRegistryRecord
  ) => Promise<AdminSessionRegistryWriteResult>;
  setResourceGatesOnChain: (
    input?: AdminSessionRegistryRecord
  ) => Promise<AdminSessionRegistryWriteResult>;
  uploadSessionMetadata: (
    metadata: AdminSessionRegistryRecord,
    opts?: AdminSessionRegistryRecord
  ) => Promise<AdminSessionRegistryWriteResult>;
  updateSessionMetadataOnChain: (
    input?: AdminSessionRegistryRecord
  ) => Promise<AdminSessionRegistryWriteResult>;
};

export type AdminSessionRegistryPorts = {
  reads: SessionRegistryReadsPort;
  writes: SessionRegistryAdminWritesPort;
};

export type BindAdminSessionRegistryPortsArgs = {
  sessionRegistry: () => AdminSessionRegistryModule;
};

const resolveCacheUpdateEvent = (module: AdminSessionRegistryModule): string => (
  module.SESSION_REGISTRY_CACHE_UPDATED_EVENT ||
  String((module.sessionRegistryUtils as AdminSessionRegistryRecord).SESSION_REGISTRY_CACHE_UPDATED_EVENT || '')
);

export const bindAdminSessionRegistryPorts = ({
  sessionRegistry: readSessionRegistry,
}: BindAdminSessionRegistryPortsArgs): AdminSessionRegistryPorts => {
  const publishAdapter = bindSessionRegistryPublishAdapter({
    sessionRegistry: readSessionRegistry,
  });

  return {
    reads: {
      loadSessionRegistryCache: (input) => (
        readSessionRegistry().loadSessionRegistryCache(input)
      ),
      getAllSessionEntries: () => (
        readSessionRegistry().sessionRegistryStore.getAllSessionEntries()
      ),
      fetchSessionFromRegistry: (input) => (
        publishAdapter.fetchSessionFromRegistry(input || {}) as Promise<AdminSessionRegistryRecord | null | undefined>
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
    },
    writes: {
      buildRegistrySessionFields: (input) => (
        buildSessionWizardRegistrySessionFields(input)
      ),
      setSessionFieldsOnChain: (input) => (
        readSessionRegistry().setSessionFieldsOnChain(input)
      ),
      setResourceGatesOnChain: (input) => (
        readSessionRegistry().setResourceGatesOnChain(input)
      ),
      uploadSessionMetadata: (metadata, opts) => (
        readSessionRegistry().uploadSessionMetadata(metadata, opts)
      ),
      updateSessionMetadataOnChain: (input) => (
        readSessionRegistry().updateSessionMetadataOnChain(input)
      ),
    },
  };
};

export const adminSessionRegistryPorts = bindAdminSessionRegistryPorts({
  sessionRegistry: () => defaultSessionRegistry as AdminSessionRegistryModule,
});
