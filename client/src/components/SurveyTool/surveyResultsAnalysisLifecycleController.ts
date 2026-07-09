import type {
  SurveyResultsAnalysisLifecyclePlan,
  SurveyResultsAnalysisLifecycleStatePatch,
  SurveyResultsAnalysisLifecycleStatus,
} from './surveyResultsAnalysisLifecyclePlan';

export type SurveyResultsAnalysisLifecycleControllerPhase = 'before-generation' | 'failure-recovery';

export type SurveyResultsAnalysisLifecycleStatePatchPort = (patch: SurveyResultsAnalysisLifecycleStatePatch) => unknown;

export type SurveyResultsAnalysisLifecycleControllerPorts = {
  applyBlockedState?: SurveyResultsAnalysisLifecycleStatePatchPort;
  applyFailureRecoveryState?: SurveyResultsAnalysisLifecycleStatePatchPort;
  applyGenerateStartState?: SurveyResultsAnalysisLifecycleStatePatchPort;
  applyReadyState?: SurveyResultsAnalysisLifecycleStatePatchPort;
};

export type SurveyResultsAnalysisLifecycleControllerArgs = {
  phase?: SurveyResultsAnalysisLifecycleControllerPhase;
  plan?: SurveyResultsAnalysisLifecyclePlan | null;
  ports?: SurveyResultsAnalysisLifecycleControllerPorts;
};

export type SurveyResultsAnalysisLifecycleAppliedPort =
  '' | 'blocked-state' | 'failure-recovery-state' | 'generate-start-state' | 'ready-state';

export type SurveyResultsAnalysisLifecycleControllerResult = {
  appliedPort: SurveyResultsAnalysisLifecycleAppliedPort;
  handled: boolean;
  patch: SurveyResultsAnalysisLifecycleStatePatch | null;
  shouldGenerate: boolean;
  status: SurveyResultsAnalysisLifecycleStatus | 'failure-recovery' | 'missing-plan';
  target: SurveyResultsAnalysisLifecyclePlan['target'] | null;
};

const missingPlanResult: SurveyResultsAnalysisLifecycleControllerResult = {
  appliedPort: '',
  handled: false,
  patch: null,
  shouldGenerate: false,
  status: 'missing-plan',
  target: null,
};

const applyPort = (
  appliedPort: SurveyResultsAnalysisLifecycleAppliedPort,
  patch: SurveyResultsAnalysisLifecycleStatePatch,
  port?: SurveyResultsAnalysisLifecycleStatePatchPort,
): SurveyResultsAnalysisLifecycleAppliedPort => {
  if (typeof port !== 'function') return '';
  port(patch);
  return appliedPort;
};

export const runSurveyResultsAnalysisLifecycleController = ({
  phase = 'before-generation',
  plan = null,
  ports = {},
}: SurveyResultsAnalysisLifecycleControllerArgs = {}): SurveyResultsAnalysisLifecycleControllerResult => {
  if (!plan) return missingPlanResult;

  if (phase === 'failure-recovery') {
    const patch = plan.failureRecovery.statePatch;
    return {
      appliedPort: applyPort('failure-recovery-state', patch, ports.applyFailureRecoveryState),
      handled: true,
      patch,
      shouldGenerate: false,
      status: 'failure-recovery',
      target: plan.target,
    };
  }

  if (plan.status === 'blocked') {
    const patch = plan.statePatch;
    return {
      appliedPort: applyPort('blocked-state', patch, ports.applyBlockedState),
      handled: true,
      patch,
      shouldGenerate: false,
      status: plan.status,
      target: plan.target,
    };
  }

  if (!plan.shouldGenerate) {
    const patch = plan.statePatch;
    return {
      appliedPort: applyPort('ready-state', patch, ports.applyReadyState),
      handled: true,
      patch,
      shouldGenerate: false,
      status: plan.status,
      target: plan.target,
    };
  }

  const patch = plan.statePatch;
  return {
    appliedPort: applyPort('generate-start-state', patch, ports.applyGenerateStartState),
    handled: false,
    patch,
    shouldGenerate: true,
    status: plan.status,
    target: plan.target,
  };
};
