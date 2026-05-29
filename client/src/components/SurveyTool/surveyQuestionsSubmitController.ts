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
  status: 'inert' | 'unhandled';
};

export type RunSurveyQuestionsSubmitControllerArgs = {
  plan: SurveyQuestionsPrimarySubmitPlan;
  ports?: SurveyQuestionsSubmitControllerPorts;
};

export const runSurveyQuestionsSubmitController = ({
  plan,
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

  return {
    action: plan.action,
    path: plan.path || '',
    plan,
    reason: plan.reason,
    status: 'unhandled',
  };
};
