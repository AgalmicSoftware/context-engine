import type { AnyRecord } from '../shellTypes';

export type SessionWizardPublishExecutionPlanLike = {
  shouldAutoDeployWorker?: boolean;
  stepNumbers?: Record<string, number>;
};

export type SessionWizardPublishDeployWorkerResult = {
  ok?: boolean;
  deployComplete?: boolean;
  workerUrl?: string;
  error?: string;
};

export type SessionWizardPublishControllerPorts = {
  deployWorker: () => Promise<SessionWizardPublishDeployWorkerResult | null | undefined>;
};

export type SessionWizardPublishControllerCallbacks = {
  setPublishStep: (step: number) => void;
};

export type SessionWizardPublishControllerInput = {
  publishAllowed?: boolean;
  publishExecutionPlan: SessionWizardPublishExecutionPlanLike;
};

export type SessionWizardPublishControllerResult = {
  status: 'blocked' | 'completed';
  workerUrlOverride: string;
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
    };
  }

  const { publishExecutionPlan } = input;
  let workerUrlOverride = '';

  if (publishExecutionPlan.shouldAutoDeployWorker) {
    callbacks.setPublishStep(getPublishStepNumber(publishExecutionPlan, 'deploy-worker'));
    const deployResult = await ports.deployWorker();
    workerUrlOverride = assertVerifiedWorkerDeploy(deployResult);
  }

  return {
    status: 'completed',
    workerUrlOverride,
  };
};

export const __test__ = {
  assertVerifiedWorkerDeploy,
  getPublishStepNumber,
} satisfies AnyRecord;
