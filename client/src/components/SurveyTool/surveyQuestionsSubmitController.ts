import type {
  SurveyQuestionsPrimarySubmitPlan,
} from './surveyQuestionsTypes.js';

export type SurveyQuestionsSubmitNavigationPort = (
  path: string,
  plan: SurveyQuestionsPrimarySubmitPlan
) => void;

export type SurveyQuestionsSubmitDispatchPort = (
  plan: SurveyQuestionsPrimarySubmitPlan
) => void;

export type SurveyQuestionsSubmitControllerPorts = {
  navigateToResponse?: SurveyQuestionsSubmitNavigationPort;
  dispatchSubmit?: SurveyQuestionsSubmitDispatchPort;
};

export type SurveyQuestionsSubmitControllerResult = {
  action: SurveyQuestionsPrimarySubmitPlan['action'];
  path: string;
  plan: SurveyQuestionsPrimarySubmitPlan;
  reason: string;
  status: 'dispatched' | 'inert' | 'navigated' | 'unhandled';
};

export type RunSurveyQuestionsSubmitControllerArgs = {
  plan: SurveyQuestionsPrimarySubmitPlan;
  ports?: SurveyQuestionsSubmitControllerPorts;
};

const buildUnhandledResult = (
  plan: SurveyQuestionsPrimarySubmitPlan
): SurveyQuestionsSubmitControllerResult => ({
  action: plan.action,
  path: plan.path || '',
  plan,
  reason: plan.reason,
  status: 'unhandled',
});

export const runSurveyQuestionsSubmitController = ({
  plan,
  ports = {},
}: RunSurveyQuestionsSubmitControllerArgs): SurveyQuestionsSubmitControllerResult => {
  if (plan.action === 'inert') {
    return {
      action: plan.action,
      path: '',
      plan,
      reason: plan.reason,
      status: 'inert',
    };
  }

  if (plan.action === 'navigate') {
    const path = plan.path || '';
    if (typeof ports.navigateToResponse !== 'function') {
      return buildUnhandledResult(plan);
    }
    ports.navigateToResponse(path, plan);
    return {
      action: plan.action,
      path,
      plan,
      reason: plan.reason,
      status: 'navigated',
    };
  }

  if (plan.action === 'submit') {
    if (typeof ports.dispatchSubmit !== 'function') {
      return buildUnhandledResult(plan);
    }
    ports.dispatchSubmit(plan);
    return {
      action: plan.action,
      path: plan.path || '',
      plan,
      reason: plan.reason,
      status: 'dispatched',
    };
  }

  return buildUnhandledResult(plan);
};
