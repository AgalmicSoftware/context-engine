import type { AnyRecord } from '../shellTypes';
import { toStr } from '../../utilities/shared/primitives.js';
import { sessionRegistryUtils } from '../../utilities/web3/sessionRegistry.js';
import {
  buildSessionWizardAdminUrl,
  buildSessionWizardSessionUrl,
  normalizeSessionWizardArweaveUri,
} from './sessionWizardUrlSupport';
import { getSessionSlugValidationError } from './sessionWizardSlugValidation';
import type { PublishedPendingSbtLink } from './sessionWizardPublishLinks';

export type SessionWizardPublishExecutionPlanLike = {
  shouldAutoDeployWorker?: boolean;
  shouldDeployPendingSbts?: boolean;
  shouldPersistWorkerConfig?: boolean;
  shouldUploadMetadata?: boolean;
  stepNumbers?: Record<string, number>;
};

export type SessionWizardPendingDraftLike = AnyRecord | null | undefined;

export type SessionWizardPublishDeployWorkerResult = {
  ok?: boolean;
  deployComplete?: boolean;
  workerUrl?: string;
  error?: string;
};

export type SessionWizardPublishWorkerSignerArgs = {
  workerUrlOverride: string;
  signerAccountOverride: string;
};

export type SessionWizardPublishControllerPorts = {
  deployWorker: () => Promise<SessionWizardPublishDeployWorkerResult | null | undefined>;
  deployPendingSbts?: (
    args: SessionWizardPublishWorkerSignerArgs,
  ) => Promise<SessionWizardPendingDraftLike[] | null | undefined>;
  persistWorkerConfig?: (
    args: SessionWizardPublishWorkerSignerArgs,
  ) => Promise<SessionWizardPublishPersistWorkerConfigResult | null | undefined>;
};

export type SessionWizardPublishPersistWorkerConfigResult = {
  workerUrl?: string;
  configRevision?: string;
  publicConfig?: AnyRecord;
};

export type SessionWizardPublishControllerCallbacks = {
  setPublishStep: (step: number) => void;
};

export type SessionWizardPublishControllerInput = {
  publishAllowed?: boolean;
  publishExecutionPlan: SessionWizardPublishExecutionPlanLike;
  signerAccountOverride?: string;
};

export type SessionWizardPublishControllerResult = {
  status: 'blocked' | 'completed';
  workerUrlOverride: string;
  deployedPendingDrafts: SessionWizardPendingDraftLike[];
  verifiedWorkerConfig: SessionWizardPublishPersistWorkerConfigResult | null;
};

export type SessionWizardPublishStartPreflightInput = {
  publishBusy?: boolean;
  draftSlug?: unknown;
  loginComplete?: boolean;
  loginInProgress?: boolean;
};

export type SessionWizardPublishStartPreflightDescriptor = {
  status: 'blocked' | 'ready';
  blockedReason: 'busy' | 'invalid-slug' | 'login-required' | '';
  shouldResetPublishState: boolean;
  shouldOpenLoginModal: boolean;
  statusMessage: string;
};

export type SessionWizardPublishAdminPreflightInput = {
  resolvedPublisher?: string | null;
};

export type SessionWizardPublishAdminPreflightDescriptor = {
  status: 'blocked' | 'ready';
  blockedReason: 'publisher-required' | '';
  signerAccountOverride: string;
  shouldOpenLoginModal: boolean;
  statusMessage: string;
};

export type SessionWizardPublishCompletionLinksInput = {
  deployedDrafts: readonly SessionWizardPendingDraftLike[];
  pendingDraftSnapshot: readonly SessionWizardPendingDraftLike[];
  sessionSlug: string;
};

export type SessionWizardPublishCompletionControllerInput = {
  publishExecutionPlan: SessionWizardPublishExecutionPlanLike;
  deployedPendingDrafts?: readonly SessionWizardPendingDraftLike[];
  pendingDraftSnapshot?: readonly SessionWizardPendingDraftLike[];
  sessionSlug?: unknown;
};

export type SessionWizardPublishCompletionRequestInput = {
  publishExecutionPlan: SessionWizardPublishExecutionPlanLike;
  deployedPendingDrafts?: readonly SessionWizardPendingDraftLike[] | null;
  pendingDraftSnapshot?: readonly SessionWizardPendingDraftLike[] | null;
  sessionSlug?: unknown;
};

export type SessionWizardPublishCompletionControllerPorts = {
  normalizePendingDrafts: (drafts: readonly SessionWizardPendingDraftLike[]) => SessionWizardPendingDraftLike[];
  buildPublishedPendingSbtLinks: (args: SessionWizardPublishCompletionLinksInput) => PublishedPendingSbtLink[];
};

export type SessionWizardPublishCompletionControllerCallbacks = {
  promoteDeployedPendingSbtSelections: (deployedDrafts: SessionWizardPendingDraftLike[]) => void;
  setPublishedPendingSbtLinks: (links: PublishedPendingSbtLink[]) => void;
  replacePendingSbtDrafts: (drafts: SessionWizardPendingDraftLike[]) => void;
  setPublishStep: (step: number) => void;
};

export type SessionWizardPublishCompletionControllerResult = {
  normalizedDeployedPendingDrafts: SessionWizardPendingDraftLike[];
  publishedPendingSbtLinks: PublishedPendingSbtLink[];
  remainingPendingDrafts: SessionWizardPendingDraftLike[];
};

export type SessionWizardPublishFailureSettlementInput = {
  error?: unknown;
};

export type SessionWizardPublishFailureSettlementDescriptor = {
  errorMessage: string;
  publishStep: number;
};

export type SessionWizardRegisterTxEntry = AnyRecord & {
  hash: string;
  action: string;
};

export type SessionWizardRegisterTxsUpdater =
  SessionWizardRegisterTxEntry[] | ((prev: SessionWizardRegisterTxEntry[]) => SessionWizardRegisterTxEntry[]);

export type SessionWizardRegisterStepControllerInput = {
  registerArgs: AnyRecord;
};

export type SessionWizardRegisterStepControllerPorts = {
  registerSessionOnChain: (args: AnyRecord) => Promise<AnyRecord | null | undefined>;
};

export type SessionWizardRegisterStepControllerCallbacks = {
  setRegisterTxs: (value: SessionWizardRegisterTxsUpdater) => void;
  setStatus: (status: string) => void;
};

export type SessionWizardRegisterStepControllerResult = {
  status: 'completed';
  registerResult: AnyRecord | null;
};

export type SessionWizardRegisterArgsDescriptorInput = {
  providerLike?: unknown;
  registryChainId?: unknown;
  sessionNetworkChainId?: unknown;
  registryAddress?: unknown;
  registrySlug?: unknown;
  sessionIdHexValue?: unknown;
  metadataUriOverride?: unknown;
  manualMetadataUrl?: unknown;
  metadataUrl?: unknown;
  gateSelectionsSnapshot?: unknown;
  sessionFieldsOverride?: unknown;
  pendingOnChainFields?: unknown;
  manualGasLimit?: unknown;
  manualGasPriceGwei?: unknown;
  manualMaxFeePerGasGwei?: unknown;
  manualMaxPriorityFeePerGasGwei?: unknown;
};

export type SessionWizardRegisterIdentityDescriptorInput = {
  draftSlug?: unknown;
  sessionId?: unknown;
  registryChainId?: unknown;
  sessionNetworkChainId?: unknown;
  registryAddress?: unknown;
};

export type SessionWizardRegisterIdentityDescriptor = {
  status: 'blocked' | 'ready';
  blockedReason: 'session-id-required' | 'registry-address-required' | '';
  registrySlug: string;
  sessionIdHexValue: string;
  registryChainIdValue: number;
  statusMessage: string;
};

export type SessionWizardRegisterDuplicateCheckDescriptorInput = {
  registryChainId?: unknown;
  registrySlug?: unknown;
  sessionIdHexValue?: unknown;
};

export type SessionWizardRegisterDuplicateCheckDescriptor = {
  chainId: number;
  registrySlug: string;
  sessionIdHexValue: string;
  shouldCheckSlug: boolean;
  shouldCheckSessionId: boolean;
  slugDuplicateMessage: string;
  sessionIdDuplicateMessage: string;
};

export type SessionWizardRegisterArgsDescriptor = {
  metadataUriMissing: boolean;
  registerArgs: AnyRecord;
};

export type SessionWizardRegisterPreflightDescriptorInput = SessionWizardRegisterArgsDescriptorInput & {
  missingMetadataMessage?: unknown;
};

export type SessionWizardRegisterPreflightDescriptor = SessionWizardRegisterArgsDescriptor & {
  canRegister: boolean;
  statusMessage: string;
};

export type SessionWizardRegisterSuccessSettlementInput = {
  registrySlug?: unknown;
  sessionIdHexValue?: unknown;
  registryChainId?: unknown;
  sessionNetworkChainId?: unknown;
  providerLike?: unknown;
  account?: unknown;
  origin?: string;
};

export type SessionWizardRegisterSuccessSettlementDescriptor = {
  formattedSessionId: string;
  sessionUrl: string;
  adminUrl: string;
  adminUrlStatus: string;
  nextSessionIdStatus: string;
  registryRefreshArgs: {
    chainId: number;
    slug: string;
    providerLike?: unknown;
    account?: unknown;
  };
};

export type SessionWizardWorkerPublishSuccessSettlementDescriptor = {
  formattedSessionId: string;
  sessionUrl: string;
  adminUrl: string;
  adminUrlStatus: string;
  nextSessionIdStatus: string;
};

export type SessionWizardRegisterFailureSettlementInput = {
  error?: unknown;
};

export type SessionWizardRegisterFailureSettlementDescriptor = {
  txEntry: SessionWizardRegisterTxEntry | null;
  errorMessage: string;
};

export type SessionWizardPublishMetadataUploadRequestInput = {
  publishExecutionPlan: SessionWizardPublishExecutionPlanLike;
  workerUrlOverride?: string;
  signerAccountOverride?: string;
};

export type SessionWizardPublishMetadataUploadRequest = {
  shouldUploadMetadata: boolean;
  publishStep: number;
  uploadArgs: SessionWizardPublishWorkerSignerArgs;
};

export type SessionWizardPublishMetadataUploadControllerPorts = {
  uploadMetadata: (args: SessionWizardPublishWorkerSignerArgs) => Promise<AnyRecord | null | undefined>;
};

export type SessionWizardPublishMetadataUploadControllerCallbacks = {
  setPublishStep: (step: number) => void;
};

export type SessionWizardPublishMetadataUploadControllerResult = {
  status: 'completed' | 'skipped';
  uploadResult: AnyRecord | null;
};

export type SessionWizardRegisterStepRequestInput = {
  publishExecutionPlan: SessionWizardPublishExecutionPlanLike;
  uploadResult?: AnyRecord | null;
};

export type SessionWizardRegisterGroupArgs = {
  metadataUriOverride?: unknown;
  sessionFieldsOverride?: unknown;
};

export type SessionWizardRegisterStepRequest = {
  publishStep: number;
  registerGroupArgs: SessionWizardRegisterGroupArgs;
};

const getPublishStepNumber = (publishExecutionPlan: SessionWizardPublishExecutionPlanLike, stepKey: string): number => {
  const stepNumber = publishExecutionPlan.stepNumbers?.[stepKey];
  return Number.isFinite(stepNumber) ? Number(stepNumber) : 0;
};

const assertVerifiedWorkerDeploy = (
  deployResult: SessionWizardPublishDeployWorkerResult | null | undefined,
): string => {
  if (!deployResult?.ok) {
    throw new Error(deployResult?.error || 'Worker deploy failed.');
  }
  if (!deployResult?.deployComplete || !deployResult?.workerUrl) {
    throw new Error('Worker deploy did not return a verified worker URL.');
  }
  return deployResult.workerUrl;
};

const getPendingDraftAddressKey = (entry: SessionWizardPendingDraftLike): string =>
  toStr(entry?.predictedAddress || entry?.deployedAddress)
    .trim()
    .toLowerCase();

export const runSessionWizardPublishController = async ({
  input,
  ports,
  callbacks,
}: {
  input: SessionWizardPublishControllerInput;
  ports: SessionWizardPublishControllerPorts;
  callbacks: SessionWizardPublishControllerCallbacks;
}): Promise<SessionWizardPublishControllerResult> => {
  if (input.publishAllowed === false) {
    return {
      status: 'blocked',
      workerUrlOverride: '',
      deployedPendingDrafts: [],
      verifiedWorkerConfig: null,
    };
  }

  const { publishExecutionPlan } = input;
  let workerUrlOverride = '';
  let deployedPendingDrafts: SessionWizardPendingDraftLike[] = [];
  let verifiedWorkerConfig: SessionWizardPublishPersistWorkerConfigResult | null = null;

  if (publishExecutionPlan.shouldAutoDeployWorker) {
    callbacks.setPublishStep(getPublishStepNumber(publishExecutionPlan, 'deploy-worker'));
    const deployResult = await ports.deployWorker();
    workerUrlOverride = assertVerifiedWorkerDeploy(deployResult);
  }

  if (publishExecutionPlan.shouldDeployPendingSbts) {
    if (typeof ports.deployPendingSbts !== 'function') {
      throw new Error('Pending SBT deploy port is required.');
    }
    callbacks.setPublishStep(getPublishStepNumber(publishExecutionPlan, 'deploy-sbts'));
    deployedPendingDrafts =
      (await ports.deployPendingSbts({
        workerUrlOverride,
        signerAccountOverride: input.signerAccountOverride || '',
      })) || [];
  }

  if (publishExecutionPlan.shouldPersistWorkerConfig) {
    if (typeof ports.persistWorkerConfig !== 'function') {
      throw new Error('Worker config persistence port is required.');
    }
    callbacks.setPublishStep(getPublishStepNumber(publishExecutionPlan, 'persist-worker-config'));
    verifiedWorkerConfig =
      (await ports.persistWorkerConfig({
        workerUrlOverride,
        signerAccountOverride: input.signerAccountOverride || '',
      })) || null;
    const verifiedWorkerUrl = toStr(verifiedWorkerConfig?.workerUrl).trim();
    if (!verifiedWorkerUrl) {
      throw new Error('Worker config persistence did not return a verified worker URL.');
    }
    workerUrlOverride = verifiedWorkerUrl;
  }

  return {
    status: 'completed',
    workerUrlOverride,
    deployedPendingDrafts,
    verifiedWorkerConfig,
  };
};

export const resolveSessionWizardPublishStartPreflightDescriptor = ({
  publishBusy = false,
  draftSlug,
  loginComplete = false,
  loginInProgress = false,
}: SessionWizardPublishStartPreflightInput): SessionWizardPublishStartPreflightDescriptor => {
  if (publishBusy) {
    return {
      status: 'blocked',
      blockedReason: 'busy',
      shouldResetPublishState: false,
      shouldOpenLoginModal: false,
      statusMessage: '',
    };
  }

  const slugValidationError = getSessionSlugValidationError(draftSlug);
  if (slugValidationError) {
    return {
      status: 'blocked',
      blockedReason: 'invalid-slug',
      shouldResetPublishState: true,
      shouldOpenLoginModal: false,
      statusMessage: slugValidationError,
    };
  }

  if (loginComplete !== true) {
    return {
      status: 'blocked',
      blockedReason: 'login-required',
      shouldResetPublishState: true,
      shouldOpenLoginModal: true,
      statusMessage: loginInProgress
        ? 'Finish logging in before publishing this session.'
        : 'Connect your wallet to publish this session.',
    };
  }

  return {
    status: 'ready',
    blockedReason: '',
    shouldResetPublishState: true,
    shouldOpenLoginModal: false,
    statusMessage: '',
  };
};

export const resolveSessionWizardPublishAdminPreflightDescriptor = ({
  resolvedPublisher = '',
}: SessionWizardPublishAdminPreflightInput): SessionWizardPublishAdminPreflightDescriptor => {
  if (!resolvedPublisher) {
    return {
      status: 'blocked',
      blockedReason: 'publisher-required',
      signerAccountOverride: '',
      shouldOpenLoginModal: true,
      statusMessage: 'Connect your wallet to publish this session.',
    };
  }

  return {
    status: 'ready',
    blockedReason: '',
    signerAccountOverride: resolvedPublisher,
    shouldOpenLoginModal: false,
    statusMessage: '',
  };
};

export const resolveSessionWizardPublishMetadataUploadRequest = ({
  publishExecutionPlan,
  workerUrlOverride = '',
  signerAccountOverride = '',
}: SessionWizardPublishMetadataUploadRequestInput): SessionWizardPublishMetadataUploadRequest => ({
  shouldUploadMetadata: !!publishExecutionPlan.shouldUploadMetadata,
  publishStep: getPublishStepNumber(publishExecutionPlan, 'upload-metadata'),
  uploadArgs: {
    workerUrlOverride: toStr(workerUrlOverride),
    signerAccountOverride: toStr(signerAccountOverride),
  },
});

export const runSessionWizardPublishMetadataUploadController = async ({
  request,
  ports,
  callbacks,
}: {
  request: SessionWizardPublishMetadataUploadRequest;
  ports: SessionWizardPublishMetadataUploadControllerPorts;
  callbacks: SessionWizardPublishMetadataUploadControllerCallbacks;
}): Promise<SessionWizardPublishMetadataUploadControllerResult> => {
  if (!request.shouldUploadMetadata) {
    return {
      status: 'skipped',
      uploadResult: null,
    };
  }

  callbacks.setPublishStep(request.publishStep);
  const uploadResult = (await ports.uploadMetadata(request.uploadArgs)) || null;
  return {
    status: 'completed',
    uploadResult,
  };
};

export const resolveSessionWizardRegisterStepRequest = ({
  publishExecutionPlan,
  uploadResult = null,
}: SessionWizardRegisterStepRequestInput): SessionWizardRegisterStepRequest => ({
  publishStep: getPublishStepNumber(publishExecutionPlan, 'register-session'),
  registerGroupArgs: {
    metadataUriOverride: uploadResult?.metadataUri,
    sessionFieldsOverride: uploadResult?.onChainFields,
  },
});

export const resolveSessionWizardRegisterIdentityDescriptor = ({
  draftSlug,
  sessionId,
  registryChainId,
  sessionNetworkChainId,
  registryAddress,
}: SessionWizardRegisterIdentityDescriptorInput): SessionWizardRegisterIdentityDescriptor => {
  const registrySlug = sessionRegistryUtils.toRegistrySlug(toStr(draftSlug).trim());
  const sessionIdHexValue = sessionRegistryUtils.normalizeSessionIdHex(sessionId);
  const registryChainIdValue = Number(registryChainId || sessionNetworkChainId || 0);

  if (!sessionIdHexValue) {
    return {
      status: 'blocked',
      blockedReason: 'session-id-required',
      registrySlug,
      sessionIdHexValue,
      registryChainIdValue,
      statusMessage: 'Session ID (UUID) is required.',
    };
  }

  if (!registryAddress) {
    return {
      status: 'blocked',
      blockedReason: 'registry-address-required',
      registrySlug,
      sessionIdHexValue,
      registryChainIdValue,
      statusMessage: 'Registry address is not configured for this chain.',
    };
  }

  return {
    status: 'ready',
    blockedReason: '',
    registrySlug,
    sessionIdHexValue,
    registryChainIdValue,
    statusMessage: '',
  };
};

export const resolveSessionWizardRegisterDuplicateCheckDescriptor = ({
  registryChainId,
  registrySlug,
  sessionIdHexValue,
}: SessionWizardRegisterDuplicateCheckDescriptorInput): SessionWizardRegisterDuplicateCheckDescriptor => {
  const normalizedRegistrySlug = toStr(registrySlug).trim();
  const normalizedSessionIdHexValue = toStr(sessionIdHexValue).trim();

  return {
    chainId: Number(registryChainId || 0),
    registrySlug: normalizedRegistrySlug,
    sessionIdHexValue: normalizedSessionIdHexValue,
    shouldCheckSlug: !!normalizedRegistrySlug,
    shouldCheckSessionId: !!normalizedSessionIdHexValue,
    slugDuplicateMessage: `Session slug already exists on-chain: ${normalizedRegistrySlug}`,
    sessionIdDuplicateMessage: 'Session ID already exists on-chain. Generate a new session ID.',
  };
};

export const isSessionWizardRegisterDuplicatePreflightError = (
  errorMessage: unknown,
  duplicateCheckDescriptor:
    | Pick<SessionWizardRegisterDuplicateCheckDescriptor, 'slugDuplicateMessage' | 'sessionIdDuplicateMessage'>
    | null
    | undefined,
): boolean => {
  const message = toStr(errorMessage);
  if (!message || !duplicateCheckDescriptor) return false;
  return (
    message === duplicateCheckDescriptor.slugDuplicateMessage ||
    message === duplicateCheckDescriptor.sessionIdDuplicateMessage
  );
};

export const resolveSessionWizardRegisterArgsDescriptor = ({
  providerLike,
  registryChainId,
  sessionNetworkChainId,
  registryAddress,
  registrySlug,
  sessionIdHexValue,
  metadataUriOverride,
  manualMetadataUrl,
  metadataUrl,
  gateSelectionsSnapshot,
  sessionFieldsOverride,
  pendingOnChainFields,
  manualGasLimit,
  manualGasPriceGwei,
  manualMaxFeePerGasGwei,
  manualMaxPriorityFeePerGasGwei,
}: SessionWizardRegisterArgsDescriptorInput): SessionWizardRegisterArgsDescriptor => {
  const metadataURI =
    normalizeSessionWizardArweaveUri(metadataUriOverride) ||
    normalizeSessionWizardArweaveUri(manualMetadataUrl) ||
    toStr(metadataUrl);
  const sessionFields = sessionFieldsOverride !== undefined ? sessionFieldsOverride || {} : pendingOnChainFields;

  return {
    metadataUriMissing: !metadataURI,
    registerArgs: {
      providerLike,
      chainId: Number(registryChainId || sessionNetworkChainId || 0),
      registryAddress,
      slug: toStr(registrySlug).trim(),
      sessionId: toStr(sessionIdHexValue).trim(),
      sessionChainId: Number(sessionNetworkChainId || 0),
      metadataURI,
      encryptedMetadataURI: '',
      gateSelections: gateSelectionsSnapshot,
      sessionFields,
      gasLimitOverride: manualGasLimit,
      gasPriceGwei: manualGasPriceGwei,
      maxFeePerGasGwei: manualMaxFeePerGasGwei,
      maxPriorityFeePerGasGwei: manualMaxPriorityFeePerGasGwei,
    },
  };
};

const DEFAULT_REGISTER_MISSING_METADATA_MESSAGE = 'Upload metadata or provide a manual Arweave URI.';

export const resolveSessionWizardRegisterPreflightDescriptor = ({
  missingMetadataMessage = DEFAULT_REGISTER_MISSING_METADATA_MESSAGE,
  ...registerArgsInput
}: SessionWizardRegisterPreflightDescriptorInput): SessionWizardRegisterPreflightDescriptor => {
  const registerArgsDescriptor = resolveSessionWizardRegisterArgsDescriptor(registerArgsInput);
  const statusMessage = registerArgsDescriptor.metadataUriMissing
    ? toStr(missingMetadataMessage) || DEFAULT_REGISTER_MISSING_METADATA_MESSAGE
    : '';

  return {
    ...registerArgsDescriptor,
    canRegister: !registerArgsDescriptor.metadataUriMissing,
    statusMessage,
  };
};

export const runSessionWizardRegisterStepController = async ({
  input,
  ports,
  callbacks,
}: {
  input: SessionWizardRegisterStepControllerInput;
  ports: SessionWizardRegisterStepControllerPorts;
  callbacks: SessionWizardRegisterStepControllerCallbacks;
}): Promise<SessionWizardRegisterStepControllerResult> => {
  callbacks.setRegisterTxs([]);
  callbacks.setStatus('Registering session on-chain…');

  const registerResult =
    (await ports.registerSessionOnChain({
      ...input.registerArgs,
      onTxHash: (entry: SessionWizardRegisterTxEntry) => {
        callbacks.setRegisterTxs((prev) => [...(Array.isArray(prev) ? prev : []), entry]);
      },
    })) || null;

  if (Array.isArray(registerResult?.txs) && registerResult.txs.length) {
    callbacks.setRegisterTxs(registerResult.txs);
  }
  callbacks.setStatus('Session registered on-chain.');

  return {
    status: 'completed',
    registerResult,
  };
};

export const appendSessionWizardRegisterTxEntry = (
  previousEntries: SessionWizardRegisterTxEntry[] | unknown,
  nextEntry: SessionWizardRegisterTxEntry | null | undefined,
): SessionWizardRegisterTxEntry[] => {
  const existingEntries = Array.isArray(previousEntries) ? previousEntries : [];
  const nextHash = nextEntry?.hash;
  if (!nextHash) return existingEntries;
  if (existingEntries.some((entry) => entry?.hash === nextHash)) {
    return existingEntries;
  }
  return [...existingEntries, nextEntry];
};

export const resolveSessionWizardRegisterFailureSettlementDescriptor = ({
  error,
}: SessionWizardRegisterFailureSettlementInput): SessionWizardRegisterFailureSettlementDescriptor => {
  const err = error && typeof error === 'object' ? (error as AnyRecord) : {};
  const transaction = err.transaction && typeof err.transaction === 'object' ? (err.transaction as AnyRecord) : {};
  const txHash = err.transactionHash || transaction.hash || '';

  return {
    txEntry: txHash ? { action: 'createSession', hash: txHash } : null,
    errorMessage: toStr(err.message) || 'Failed to register session.',
  };
};

export const resolveSessionWizardRegisterSuccessSettlementDescriptor = ({
  registrySlug,
  sessionIdHexValue,
  registryChainId,
  sessionNetworkChainId,
  providerLike,
  account,
  origin,
}: SessionWizardRegisterSuccessSettlementInput): SessionWizardRegisterSuccessSettlementDescriptor => {
  const normalizedRegistrySlug = toStr(registrySlug).trim();
  const formattedSessionId = sessionRegistryUtils.formatSessionId(sessionIdHexValue) || toStr(sessionIdHexValue).trim();
  const refreshChainId = Number(registryChainId || sessionNetworkChainId || 0);

  return {
    formattedSessionId,
    sessionUrl: buildSessionWizardSessionUrl({ slug: normalizedRegistrySlug, origin }),
    adminUrl: buildSessionWizardAdminUrl({
      sessionId: formattedSessionId,
      chainId: refreshChainId,
      origin,
    }),
    adminUrlStatus: '',
    nextSessionIdStatus: 'Generated a new session ID for your next session.',
    registryRefreshArgs: {
      chainId: refreshChainId,
      slug: normalizedRegistrySlug,
      providerLike,
      account,
    },
  };
};

export const resolveSessionWizardWorkerPublishSuccessSettlementDescriptor = ({
  slug,
  sessionId,
  workerOrigin,
  origin,
}: {
  slug?: unknown;
  sessionId?: unknown;
  workerOrigin?: unknown;
  origin?: string;
} = {}): SessionWizardWorkerPublishSuccessSettlementDescriptor => {
  const formattedSessionId = sessionRegistryUtils.formatSessionId(sessionId) || toStr(sessionId).trim();
  return {
    formattedSessionId,
    sessionUrl: buildSessionWizardSessionUrl({ slug, workerOrigin, origin }),
    adminUrl: buildSessionWizardAdminUrl({
      sessionId: formattedSessionId,
      sessionSlug: slug,
      workerOrigin,
      origin,
    }),
    adminUrlStatus: '',
    nextSessionIdStatus: 'Generated a new session ID for your next session.',
  };
};

export const resolveSessionWizardPublishCompletionRequest = ({
  publishExecutionPlan,
  deployedPendingDrafts = [],
  pendingDraftSnapshot = [],
  sessionSlug = '',
}: SessionWizardPublishCompletionRequestInput): SessionWizardPublishCompletionControllerInput => ({
  publishExecutionPlan,
  deployedPendingDrafts: Array.isArray(deployedPendingDrafts) ? deployedPendingDrafts : [],
  pendingDraftSnapshot: Array.isArray(pendingDraftSnapshot) ? pendingDraftSnapshot : [],
  sessionSlug: toStr(sessionSlug).trim(),
});

export const resolveSessionWizardPublishFailureSettlementDescriptor = ({
  error,
}: SessionWizardPublishFailureSettlementInput): SessionWizardPublishFailureSettlementDescriptor => {
  const err = error && typeof error === 'object' ? (error as AnyRecord) : {};
  const errorMessage = err.message ? toStr(err.message) : '';
  return {
    errorMessage: errorMessage || 'Publish failed.',
    publishStep: 0,
  };
};

export const resolveSessionWizardRemainingPendingDrafts = ({
  deployedPendingDrafts = [],
  pendingDraftSnapshot = [],
}: {
  deployedPendingDrafts?: readonly SessionWizardPendingDraftLike[];
  pendingDraftSnapshot?: readonly SessionWizardPendingDraftLike[];
}): SessionWizardPendingDraftLike[] => {
  const newlyDeployedPendingAddressSet = new Set(
    deployedPendingDrafts.map((entry) => getPendingDraftAddressKey(entry)).filter(Boolean),
  );
  return pendingDraftSnapshot.filter((entry) => {
    if (entry?.deployed === true) return false;
    const addressKey = getPendingDraftAddressKey(entry);
    return !addressKey || !newlyDeployedPendingAddressSet.has(addressKey);
  });
};

export const runSessionWizardPublishCompletionController = ({
  input,
  ports,
  callbacks,
}: {
  input: SessionWizardPublishCompletionControllerInput;
  ports: SessionWizardPublishCompletionControllerPorts;
  callbacks: SessionWizardPublishCompletionControllerCallbacks;
}): SessionWizardPublishCompletionControllerResult => {
  const pendingDraftSnapshot = Array.isArray(input.pendingDraftSnapshot) ? input.pendingDraftSnapshot : [];
  const normalizedDeployedPendingDrafts = ports.normalizePendingDrafts(
    Array.isArray(input.deployedPendingDrafts) ? input.deployedPendingDrafts : [],
  );
  const newlyDeployedPendingAddressSet = new Set(
    normalizedDeployedPendingDrafts.map((entry) => getPendingDraftAddressKey(entry)).filter(Boolean),
  );

  callbacks.promoteDeployedPendingSbtSelections([
    ...normalizedDeployedPendingDrafts,
    ...pendingDraftSnapshot.filter(
      (entry) => entry?.deployed === true && !newlyDeployedPendingAddressSet.has(getPendingDraftAddressKey(entry)),
    ),
  ]);

  const publishedPendingSbtLinks = ports.buildPublishedPendingSbtLinks({
    deployedDrafts: normalizedDeployedPendingDrafts,
    pendingDraftSnapshot,
    sessionSlug: toStr(input.sessionSlug).trim(),
  });
  callbacks.setPublishedPendingSbtLinks(publishedPendingSbtLinks);
  // Regression guard: a selected mode can suppress SBT deployment; only
  // drafts proven deployed may be removed from the author's pending state.
  const remainingPendingDrafts = resolveSessionWizardRemainingPendingDrafts({
    deployedPendingDrafts: normalizedDeployedPendingDrafts,
    pendingDraftSnapshot,
  });
  callbacks.replacePendingSbtDrafts(remainingPendingDrafts);
  callbacks.setPublishStep(getPublishStepNumber(input.publishExecutionPlan, 'done'));

  return {
    normalizedDeployedPendingDrafts,
    publishedPendingSbtLinks,
    remainingPendingDrafts,
  };
};

export const __test__ = {
  assertVerifiedWorkerDeploy,
  getPendingDraftAddressKey,
  getPublishStepNumber,
} satisfies AnyRecord;
