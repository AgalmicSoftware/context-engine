import type { SessionPublishState } from '../../domains/sessions/publish/sessionPublishReducer';
import {
  resolveSessionWizardPublishUiPlan,
  type SessionWizardPublishUiPlan,
  type SessionWizardPublishUiPlanInput,
} from './sessionWizardPublishReadiness';

export type SessionWizardPublishStepNumbers = Partial<
  Record<'deploy-worker' | 'deploy-sbts' | 'upload-metadata' | 'register-session' | 'done', number>
>;

export type SessionWizardPublishReducerUiState = {
  publishBusy: boolean;
  publishStep: number;
};

export type SessionWizardPublishReducerUiPlanInput = Omit<
  SessionWizardPublishUiPlanInput,
  'publishBusy' | 'publishStep'
> & {
  state: SessionPublishState;
};

const BUSY_STATUSES = new Set<SessionPublishState['status']>([
  'checkingRequirements',
  'deployingWorker',
  'deployingPendingSbts',
  'uploadingMetadata',
  'registeringOnChain',
]);

const getStepNumber = (
  stepNumbers: SessionWizardPublishStepNumbers,
  stepKey: keyof SessionWizardPublishStepNumbers,
): number => Math.max(0, Number(stepNumbers[stepKey] || 0));

export const resolveSessionWizardPublishReducerUiState = ({
  state,
  stepNumbers = {},
}: {
  state: SessionPublishState;
  stepNumbers?: SessionWizardPublishStepNumbers;
}): SessionWizardPublishReducerUiState => {
  if (state.status === 'published') {
    return {
      publishBusy: false,
      publishStep: getStepNumber(stepNumbers, 'done'),
    };
  }

  if (!BUSY_STATUSES.has(state.status)) {
    return {
      publishBusy: false,
      publishStep: 0,
    };
  }

  if (state.currentEffect === 'deployWorker') {
    return {
      publishBusy: true,
      publishStep: getStepNumber(stepNumbers, 'deploy-worker'),
    };
  }

  if (state.currentEffect === 'deployPendingSbts') {
    return {
      publishBusy: true,
      publishStep: getStepNumber(stepNumbers, 'deploy-sbts'),
    };
  }

  if (state.currentEffect === 'uploadMetadata') {
    return {
      publishBusy: true,
      publishStep: getStepNumber(stepNumbers, 'upload-metadata'),
    };
  }

  if (state.currentEffect === 'registerSession' || state.currentEffect === 'refreshRegistryCache') {
    return {
      publishBusy: true,
      publishStep: getStepNumber(stepNumbers, 'register-session'),
    };
  }

  return {
    publishBusy: true,
    publishStep: 0,
  };
};

export const resolveSessionWizardPublishReducerUiPlan = ({
  state,
  ...input
}: SessionWizardPublishReducerUiPlanInput): SessionWizardPublishUiPlan => {
  const publishBusy = resolveSessionWizardPublishReducerUiState({ state }).publishBusy;
  const stepSeed = resolveSessionWizardPublishUiPlan({
    ...input,
    publishBusy,
    publishStep: 0,
    publishStepElapsedMs: 0,
  });
  const { publishStep } = resolveSessionWizardPublishReducerUiState({
    state,
    stepNumbers: stepSeed.publishExecutionPlan.stepNumbers,
  });
  return resolveSessionWizardPublishUiPlan({
    ...input,
    publishBusy,
    publishStep,
  });
};
