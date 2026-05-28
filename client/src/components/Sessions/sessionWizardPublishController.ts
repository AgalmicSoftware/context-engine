import type { AnyRecord } from '../shellTypes';

export type SessionWizardPublishExecutionPlanLike = {
  shouldAutoDeployWorker?: boolean;
  shouldDeployPendingSbts?: boolean;
  stepNumbers?: Record<string, number>;
};

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
  ) => Promise<unknown[] | null | undefined>;
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
  deployedPendingDrafts: unknown[];
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
  let deployedPendingDrafts: unknown[] = [];

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

export const __test__ = {
  assertVerifiedWorkerDeploy,
  getPublishStepNumber,
} satisfies AnyRecord;
