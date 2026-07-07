import type {
  SessionPublishPlan,
} from './sessionPublishReducer';

export type SessionPublishRequirementsInput = {
  plan: SessionPublishPlan;
  sessionSlug: string;
};

export type SessionPublishRequirementsResult = {
  ok: boolean;
  message?: string;
};

export type SessionPublishUploadSessionHeaderInput = {
  sessionSlug: string;
  workerUrlOverride: string;
  signerAccountOverride: string;
};

export type SessionPublishUploadSessionHeaderResult = {
  txId: string;
  uri: string;
};

export type SessionPublishUploadMetadataInput = {
  workerUrlOverride: string;
  signerAccountOverride: string;
};

export type SessionPublishUploadMetadataResult = {
  txId: string;
  metadataUri: string;
  onChainFields: Record<string, unknown>;
};

export type SessionPublishResolveUploadOptionsInput = {
  sessionSlug: string;
  workerUrl: string;
  arweaveJwk: string;
  adminAddress: string;
};

export type SessionPublishUploadOptionsResult = {
  forceDirectArweaveUpload: boolean;
  arweaveJwk: string;
  workerUrl: string;
  skipAuth: boolean;
  adminAuth: unknown;
};

export type SessionPublishDeployWorkerInput = {
  forceSponsoredAutoDeploy: boolean;
};

export type SessionPublishDeployWorkerResult = {
  ok: boolean;
  deployComplete: boolean;
  workerUrl: string;
  error?: string;
};

export type SessionPublishVerifyWorkerInput = {
  workerUrl: string;
};

export type SessionPublishRegisterSessionInput = {
  metadataUriOverride?: string;
  sessionFieldsOverride?: Record<string, unknown>;
};

export type SessionPublishRegisterSessionResult = {
  txs?: Array<Record<string, unknown>>;
};

export type SessionPublishRefreshRegistryCacheInput = {
  slug: string;
  chainId: number;
  account: string;
};

export type SessionPublishDeployPendingSbtInput = {
  workerUrlOverride: string;
  signerAccountOverride: string;
};

export type SessionPublishDeployPendingSbtResult = {
  deployedCount: number;
};

export type SessionPublishSignAdminActionInput = {
  action: string;
  slug: string;
  body: Record<string, unknown>;
  workerUrl: string;
};

export type SessionWizardPublishPorts = {
  checkRequirements: (input: SessionPublishRequirementsInput) => Promise<SessionPublishRequirementsResult>;
  uploadSessionHeader: (
    input: SessionPublishUploadSessionHeaderInput
  ) => Promise<SessionPublishUploadSessionHeaderResult | null>;
  uploadMetadata: (input: SessionPublishUploadMetadataInput) => Promise<SessionPublishUploadMetadataResult | null>;
  resolveUploadOptions: (
    input: SessionPublishResolveUploadOptionsInput
  ) => Promise<SessionPublishUploadOptionsResult>;
  deployWorker: (input: SessionPublishDeployWorkerInput) => Promise<SessionPublishDeployWorkerResult | null>;
  verifyWorker: (input: SessionPublishVerifyWorkerInput) => Promise<SessionPublishRequirementsResult>;
  registerSession: (input: SessionPublishRegisterSessionInput) => Promise<SessionPublishRegisterSessionResult | null>;
  refreshRegistryCache: (input: SessionPublishRefreshRegistryCacheInput) => Promise<void>;
  deployPendingSbt: (input: SessionPublishDeployPendingSbtInput) => Promise<SessionPublishDeployPendingSbtResult>;
  signAdminAction: (input: SessionPublishSignAdminActionInput) => Promise<unknown>;
  now: () => number;
};
