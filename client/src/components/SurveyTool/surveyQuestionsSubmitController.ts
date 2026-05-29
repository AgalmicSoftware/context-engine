import type {
  SurveySubmitFailureStatePatch,
  SurveySubmitSuccessStatePatch,
  SurveyQuestionsPrimarySubmitPlan,
} from './surveyQuestionsTypes.js';
import {
  buildSubmitFailureState,
  buildSubmitSuccessState,
} from './surveyQuestionsTypes.js';
import {
  updateSubmittedSinceLastEdit,
} from './surveyToolUtils.js';

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

export type SurveyQuestionsSubmitCompletionPorts = {
  clearSubmitGuard?: () => void;
  finishSubmitAttempt?: (submitAttemptId: number) => void;
  setSubmitFailureState?: (statePatch: SurveySubmitFailureStatePatch) => void;
  setSubmitSuccessState?: (
    statePatch: SurveySubmitSuccessStatePatch,
    afterStateApplied?: () => void
  ) => void;
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

export type RunSurveyQuestionsSubmitSuccessControllerArgs = {
  editBaseline?: unknown;
  hasEncrypted?: unknown;
  responseUrl?: unknown;
  submittedSinceLastEdit?: boolean;
  surveysResponseState?: unknown;
  userAnswers?: unknown;
  submitAttemptId?: unknown;
  afterStateApplied?: () => void;
  ports?: SurveyQuestionsSubmitCompletionPorts;
};

export type RunSurveyQuestionsSubmitFailureControllerArgs = {
  error?: unknown;
  submittedSinceLastEdit?: boolean;
  submitAttemptId?: unknown;
  ports?: SurveyQuestionsSubmitCompletionPorts;
};

export type SurveyQuestionsSubmitSuccessControllerResult = {
  outcome: 'success';
  status: 'completed';
  submitAttemptId: number;
  statePatch: SurveySubmitSuccessStatePatch;
};

export type SurveyQuestionsSubmitFailureControllerResult = {
  outcome: 'failure';
  status: 'completed';
  submitAttemptId: number;
  statePatch: SurveySubmitFailureStatePatch;
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

const normalizeSubmitAttemptId = (submitAttemptId: unknown): number => {
  const value = Number(submitAttemptId || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const resolveSubmitFailureMessage = (error: unknown): string => (
  ((error as { message?: string } | null | undefined)?.message) || 'Submission failed.'
);

const runSubmitCompletionPrelude = (
  submitAttemptId: number,
  ports: SurveyQuestionsSubmitCompletionPorts
): void => {
  ports.clearSubmitGuard?.();
  if (submitAttemptId > 0) {
    ports.finishSubmitAttempt?.(submitAttemptId);
  }
};

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

export const runSurveyQuestionsSubmitSuccessController = ({
  editBaseline = null,
  hasEncrypted = false,
  responseUrl = '',
  submittedSinceLastEdit = false,
  surveysResponseState = [],
  userAnswers = null,
  submitAttemptId = 0,
  afterStateApplied,
  ports = {},
}: RunSurveyQuestionsSubmitSuccessControllerArgs): SurveyQuestionsSubmitSuccessControllerResult => {
  const normalizedSubmitAttemptId = normalizeSubmitAttemptId(submitAttemptId);
  const statePatch = buildSubmitSuccessState({
    editBaseline,
    hasEncrypted,
    responseUrl,
    submittedSinceLastEdit: updateSubmittedSinceLastEdit(
      submittedSinceLastEdit,
      'submit_success'
    ),
    surveysResponseState,
    userAnswers,
  });

  runSubmitCompletionPrelude(normalizedSubmitAttemptId, ports);
  ports.setSubmitSuccessState?.(statePatch, afterStateApplied);

  return {
    outcome: 'success',
    status: 'completed',
    submitAttemptId: normalizedSubmitAttemptId,
    statePatch,
  };
};

export const runSurveyQuestionsSubmitFailureController = ({
  error,
  submittedSinceLastEdit = false,
  submitAttemptId = 0,
  ports = {},
}: RunSurveyQuestionsSubmitFailureControllerArgs): SurveyQuestionsSubmitFailureControllerResult => {
  const normalizedSubmitAttemptId = normalizeSubmitAttemptId(submitAttemptId);
  const statePatch = buildSubmitFailureState({
    submittedSinceLastEdit: updateSubmittedSinceLastEdit(
      submittedSinceLastEdit,
      'submit_error'
    ),
    submissionError: resolveSubmitFailureMessage(error),
  });

  runSubmitCompletionPrelude(normalizedSubmitAttemptId, ports);
  ports.setSubmitFailureState?.(statePatch);

  return {
    outcome: 'failure',
    status: 'completed',
    submitAttemptId: normalizedSubmitAttemptId,
    statePatch,
  };
};
