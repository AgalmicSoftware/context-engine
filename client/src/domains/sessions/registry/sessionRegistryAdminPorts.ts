import * as defaultSessionRegistry from '../../../utilities/web3/sessionRegistry.js';
import {
  bindSessionRegistryReadsPort,
  type SessionRegistryCacheTarget,
  type SessionRegistryEntry,
  type SessionRegistryReadModule,
  type SessionRegistryReadsPort,
  type SessionRegistryRecord,
  type SessionRegistryStore,
} from './sessionRegistryReadPorts.js';
import { buildSessionWizardRegistrySessionFields } from './sessionRegistryWriteNormalization.js';

export type { SessionRegistryReadsPort } from './sessionRegistryReadPorts.js';

export type AdminSessionRegistryRecord = SessionRegistryRecord;
export type AdminSessionRegistryEntry = SessionRegistryEntry;
export type AdminSessionRegistryWriteResult = AdminSessionRegistryRecord & {
  metadataUri?: unknown;
  txHash?: unknown;
  txs?: Array<
    AdminSessionRegistryRecord & {
      hash?: unknown;
    }
  >;
};

export type AdminSessionRegistryCacheTarget = SessionRegistryCacheTarget;
export type AdminSessionRegistryStore = SessionRegistryStore;

export type AdminSessionRegistryModule = SessionRegistryReadModule & {
  setSessionFieldsOnChain: (input?: AdminSessionRegistryRecord) => Promise<AdminSessionRegistryWriteResult>;
  setResourceGatesOnChain: (input?: AdminSessionRegistryRecord) => Promise<AdminSessionRegistryWriteResult>;
  uploadSessionMetadata: (
    metadata: AdminSessionRegistryRecord,
    opts?: AdminSessionRegistryRecord,
  ) => Promise<AdminSessionRegistryWriteResult>;
  updateSessionMetadataOnChain: (input?: AdminSessionRegistryRecord) => Promise<AdminSessionRegistryWriteResult>;
};

export type AdminRegistrySessionFieldsInput = {
  onChainFields?: AdminSessionRegistryRecord;
  sponsoredFields?: AdminSessionRegistryRecord;
  compatibilityFieldPaths?: Record<string, string[]>;
};

export type SessionRegistryAdminWritesPort = {
  buildRegistrySessionFields: (input?: AdminRegistrySessionFieldsInput) => AdminSessionRegistryRecord;
  setSessionFieldsOnChain: (input?: AdminSessionRegistryRecord) => Promise<AdminSessionRegistryWriteResult>;
  setResourceGatesOnChain: (input?: AdminSessionRegistryRecord) => Promise<AdminSessionRegistryWriteResult>;
  uploadSessionMetadata: (
    metadata: AdminSessionRegistryRecord,
    opts?: AdminSessionRegistryRecord,
  ) => Promise<AdminSessionRegistryWriteResult>;
  updateSessionMetadataOnChain: (input?: AdminSessionRegistryRecord) => Promise<AdminSessionRegistryWriteResult>;
};

export type AdminSessionRegistryPorts = {
  reads: SessionRegistryReadsPort;
  writes: SessionRegistryAdminWritesPort;
};

export type BindAdminSessionRegistryPortsArgs = {
  sessionRegistry: () => AdminSessionRegistryModule;
};

export const bindAdminSessionRegistryPorts = ({
  sessionRegistry: readSessionRegistry,
}: BindAdminSessionRegistryPortsArgs): AdminSessionRegistryPorts => {
  const reads = bindSessionRegistryReadsPort({
    sessionRegistry: readSessionRegistry,
  });

  return {
    reads,
    writes: {
      buildRegistrySessionFields: (input) => buildSessionWizardRegistrySessionFields(input),
      setSessionFieldsOnChain: (input) => readSessionRegistry().setSessionFieldsOnChain(input),
      setResourceGatesOnChain: (input) => readSessionRegistry().setResourceGatesOnChain(input),
      uploadSessionMetadata: (metadata, opts) => readSessionRegistry().uploadSessionMetadata(metadata, opts),
      updateSessionMetadataOnChain: (input) => readSessionRegistry().updateSessionMetadataOnChain(input),
    },
  };
};

export const adminSessionRegistryPorts = bindAdminSessionRegistryPorts({
  sessionRegistry: () => defaultSessionRegistry as AdminSessionRegistryModule,
});
