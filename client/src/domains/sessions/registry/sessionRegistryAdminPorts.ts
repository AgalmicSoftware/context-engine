import * as defaultSessionRegistry from '../../../utilities/web3/sessionRegistry.js';
import {
  sessionRegistryReadsPort,
  type SessionRegistryCacheTarget,
  type SessionRegistryEntry,
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

export const adminSessionRegistryPorts: AdminSessionRegistryPorts = {
  reads: sessionRegistryReadsPort,
  writes: {
    buildRegistrySessionFields: (input) => buildSessionWizardRegistrySessionFields(input),
    setSessionFieldsOnChain: (input) => defaultSessionRegistry.setSessionFieldsOnChain(input),
    setResourceGatesOnChain: (input) => defaultSessionRegistry.setResourceGatesOnChain(input),
    uploadSessionMetadata: (metadata, opts) => defaultSessionRegistry.uploadSessionMetadata(metadata, opts),
    updateSessionMetadataOnChain: (input) => defaultSessionRegistry.updateSessionMetadataOnChain(input),
  },
};
