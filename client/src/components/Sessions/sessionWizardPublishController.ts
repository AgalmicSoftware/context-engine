import type { AnyRecord } from '../shellTypes';
import { toStr } from '../../utilities/shared/primitives.js';

export type SessionWizardPublishExecutionPlanLike = {
  shouldAutoDeployWorker?: boolean;
  shouldDeployPendingSbts?: boolean;
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

export type SessionWizardPublishDeployPendingSbtsArgs = {
  workerUrlOverride: string;
  signerAccountOverride: string;
};

export type SessionWizardPublishControllerPorts = {
  deployWorker: () => Promise<SessionWizardPublishDeployWorkerResult | null | undefined>;
  deployPendingSbts?: (
    args: SessionWizardPublishDeployPendingSbtsArgs
  ) => Promise<SessionWizardPendingDraftLike[] | null | undefined>;
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
};

export type SessionWizardPublishCompletionLinksInput = {
  deployedDrafts: SessionWizardPendingDraftLike[];
  pendingDraftSnapshot: SessionWizardPendingDraftLike[];
  sessionSlug: string;
};

export type SessionWizardPublishCompletionControllerInput = {
  publishExecutionPlan: SessionWizardPublishExecutionPlanLike;
  deployedPendingDrafts?: SessionWizardPendingDraftLike[];
  pendingDraftSnapshot?: SessionWizardPendingDraftLike[];
  sessionSlug?: unknown;
};

export type SessionWizardPublishCompletionControllerPorts = {
  normalizePendingDrafts: (
    drafts: SessionWizardPendingDraftLike[]
  ) => SessionWizardPendingDraftLike[];
  buildPublishedPendingSbtLinks: (
    args: SessionWizardPublishCompletionLinksInput
  ) => unknown[];
};

export type SessionWizardPublishCompletionControllerCallbacks = {
  promoteDeployedPendingSbtSelections: (
    deployedDrafts: SessionWizardPendingDraftLike[]
  ) => void;
  setPublishedPendingSbtLinks: (links: unknown[]) => void;
  clearPendingSbtDrafts: () => void;
  setPublishStep: (step: number) => void;
};

export type SessionWizardPublishCompletionControllerResult = {
  normalizedDeployedPendingDrafts: SessionWizardPendingDraftLike[];
  publishedPendingSbtLinks: unknown[];
};

export type SessionWizardRegisterTxEntry = AnyRecord;

export type SessionWizardRegisterTxsUpdater =
  | SessionWizardRegisterTxEntry[]
  | ((prev: SessionWizardRegisterTxEntry[]) => SessionWizardRegisterTxEntry[]);

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

export type SessionWizardPublishMetadataUploadRequestInput = {
  publishExecutionPlan: SessionWizardPublishExecutionPlanLike;
  workerUrlOverride?: string;
  signerAccountOverride?: string;
};

export type SessionWizardPublishMetadataUploadRequest = {
  shouldUploadMetadata: boolean;
  publishStep: number;
  uploadArgs: SessionWizardPublishDeployPendingSbtsArgs;
};

const getPublishStepNumber = (
  publishExecutionPlan: SessionWizardPublishExecutionPlanLike,
  stepKey: string
): number => {
  const stepNumber = publishExecutionPlan.stepNumbers?.[stepKey];
  return Number.isFinite(stepNumber) ? Number(stepNumber) : 0;
};

const assertVerifiedWorkerDeploy = (
  deployResult: SessionWizardPublishDeployWorkerResult | null | undefined
): string => {
  if (!deployResult?.ok) {
    throw new Error(deployResult?.error || 'Worker deploy failed.');
  }
  if (!deployResult?.deployComplete || !deployResult?.workerUrl) {
    throw new Error('Worker deploy did not return a verified worker URL.');
  }
  return deployResult.workerUrl;
};

const getPendingDraftAddressKey = (entry: SessionWizardPendingDraftLike): string => (
  toStr(entry?.predictedAddress || entry?.deployedAddress).trim().toLowerCase()
);

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
    };
  }

  const { publishExecutionPlan } = input;
  let workerUrlOverride = '';
  let deployedPendingDrafts: SessionWizardPendingDraftLike[] = [];

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
    deployedPendingDrafts = await ports.deployPendingSbts({
      workerUrlOverride,
      signerAccountOverride: input.signerAccountOverride || '',
    }) || [];
  }

  return {
    status: 'completed',
    workerUrlOverride,
    deployedPendingDrafts,
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

  const registerResult = await ports.registerSessionOnChain({
    ...input.registerArgs,
    onTxHash: (entry: SessionWizardRegisterTxEntry) => {
      callbacks.setRegisterTxs((prev) => [
        ...(Array.isArray(prev) ? prev : []),
        entry,
      ]);
    },
  }) || null;

  if (Array.isArray(registerResult?.txs) && registerResult.txs.length) {
    callbacks.setRegisterTxs(registerResult.txs);
  }
  callbacks.setStatus('Session registered on-chain.');

  return {
    status: 'completed',
    registerResult,
  };
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
  const pendingDraftSnapshot = Array.isArray(input.pendingDraftSnapshot)
    ? input.pendingDraftSnapshot
    : [];
  const normalizedDeployedPendingDrafts = ports.normalizePendingDrafts(
    Array.isArray(input.deployedPendingDrafts) ? input.deployedPendingDrafts : []
  );
  const newlyDeployedPendingAddressSet = new Set(
    normalizedDeployedPendingDrafts
      .map((entry) => getPendingDraftAddressKey(entry))
      .filter(Boolean)
  );

  callbacks.promoteDeployedPendingSbtSelections([
    ...normalizedDeployedPendingDrafts,
    ...pendingDraftSnapshot.filter((entry) => (
      entry?.deployed === true &&
      !newlyDeployedPendingAddressSet.has(getPendingDraftAddressKey(entry))
    )),
  ]);

  const publishedPendingSbtLinks = ports.buildPublishedPendingSbtLinks({
    deployedDrafts: normalizedDeployedPendingDrafts,
    pendingDraftSnapshot,
    sessionSlug: toStr(input.sessionSlug).trim(),
  });
  callbacks.setPublishedPendingSbtLinks(publishedPendingSbtLinks);
  callbacks.clearPendingSbtDrafts();
  callbacks.setPublishStep(getPublishStepNumber(input.publishExecutionPlan, 'done'));

  return {
    normalizedDeployedPendingDrafts,
    publishedPendingSbtLinks,
  };
};

export const __test__ = {
  assertVerifiedWorkerDeploy,
  getPendingDraftAddressKey,
  getPublishStepNumber,
} satisfies AnyRecord;
