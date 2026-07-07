import type {
  SurveySubmitFailureStatePatch,
  SurveySubmitStartStatePatch,
  SurveySubmitSuccessStatePatch,
  SurveyQuestionsPrimarySubmitPlan,
} from './surveyQuestionsTypes.js';
import { buildSubmitFailureState, buildSubmitStartState, buildSubmitSuccessState } from './surveyQuestionsTypes.js';
import { updateSubmittedSinceLastEdit } from './surveyToolUtils.js';
import { buildQuestionRoutePath } from '../../utilities/survey/questionRouting.js';

export type SurveyQuestionsSubmitNavigationPort = (path: string, plan: SurveyQuestionsPrimarySubmitPlan) => void;

export type SurveyQuestionsSubmitDispatchPort = (plan: SurveyQuestionsPrimarySubmitPlan) => void;

export type SurveyQuestionsSubmitControllerPorts = {
  activateSubmitGuard?: () => void;
  navigateToResponse?: SurveyQuestionsSubmitNavigationPort;
  dispatchSubmit?: SurveyQuestionsSubmitDispatchPort;
};

export type SurveyQuestionsSubmitStartPorts = {
  startSubmitAttempt?: () => unknown;
  setSubmitStartState?: (statePatch: SurveySubmitStartStatePatch) => void;
};

export type SurveyQuestionsSubmitPendingStats = {
  total: number;
  encrypted: number;
};

export type SurveyQuestionsSubmitCompletionPorts = {
  clearSubmitGuard?: () => void;
  finishSubmitAttempt?: (submitAttemptId: number) => void;
  setSubmitFailureState?: (statePatch: SurveySubmitFailureStatePatch) => void;
  setSubmitSuccessState?: (statePatch: SurveySubmitSuccessStatePatch, afterStateApplied?: () => void) => void;
};

export type SurveyQuestionsSubmitStaleStatePatch = {
  isSubmitting: false;
  submitProgress: 0;
  currentStep: 0;
};

export type SurveyQuestionsStaleSubmitPorts = {
  clearSubmitGuard?: () => void;
  canUpdateSubmitState?: (snapshot: unknown) => boolean;
  isSubmitAttemptActive?: (submitAttemptId: number, snapshot: unknown) => boolean;
  finishSubmitAttempt?: (submitAttemptId: number) => void;
  setSubmitStaleState?: (statePatch: SurveyQuestionsSubmitStaleStatePatch) => void;
};

export type SurveyQuestionsSubmitControllerResult = {
  action: SurveyQuestionsPrimarySubmitPlan['action'];
  path: string;
  plan: SurveyQuestionsPrimarySubmitPlan;
  reason: string;
  status: 'dispatched' | 'inert' | 'navigated' | 'unhandled';
};

export const resolveSubmitEffectiveDraftSlug = ({
  draftSlug = '',
  routeSlug = '',
  normalizeSlug = null,
}: {
  draftSlug?: unknown;
  routeSlug?: unknown;
  normalizeSlug?: ((value: unknown) => string) | null;
} = {}): string => {
  const normalizeValue =
    typeof normalizeSlug === 'function' ? normalizeSlug : (value: unknown) => String(value ?? '').trim();
  return normalizeValue(draftSlug) || normalizeValue(routeSlug);
};

export type RunSurveyQuestionsSubmitControllerArgs = {
  plan: SurveyQuestionsPrimarySubmitPlan;
  ports?: SurveyQuestionsSubmitControllerPorts;
};

export type RunSurveyQuestionsSubmitStartControllerArgs = {
  ports?: SurveyQuestionsSubmitStartPorts;
};

export type ResolveSurveyQuestionsSubmitPendingStatsArgs = {
  fallbackEncrypted?: unknown;
  fallbackTotal?: unknown;
  getPendingEditStats?: () => unknown;
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

export type RunSurveyQuestionsStaleSubmitControllerArgs = {
  snapshot?: unknown;
  ports?: SurveyQuestionsStaleSubmitPorts;
};

export type ResolveSurveyQuestionsSubmittedResponseUrlArgs = {
  account?: unknown;
  currentPathname?: unknown;
  isStandalone?: unknown;
  logWarn?: (message: string, error: unknown) => void;
  questionID?: unknown;
  singleQuestionMode?: unknown;
  submissionSlug?: unknown;
  surveyId?: unknown;
};

export type SurveyQuestionsSubmitStartControllerResult = {
  outcome: 'started';
  status: 'completed';
  submitAttemptId: number;
  statePatch: SurveySubmitStartStatePatch;
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

export type SurveyQuestionsStaleSubmitControllerResult = {
  outcome: 'stale';
  reason: 'active_attempt' | 'inactive_attempt' | 'missing_attempt' | 'snapshot_not_current';
  status: 'completed' | 'skipped';
  submitAttemptId: number;
  statePatch: SurveyQuestionsSubmitStaleStatePatch | null;
};

const buildUnhandledResult = (plan: SurveyQuestionsPrimarySubmitPlan): SurveyQuestionsSubmitControllerResult => ({
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

const normalizePendingStatCount = (value: unknown, fallback: unknown = 0): number => {
  const fallbackValue = Number(fallback || 0);
  const normalizedFallback = Number.isFinite(fallbackValue) ? fallbackValue : 0;
  const numericValue = Number(value ?? normalizedFallback);
  return Number.isFinite(numericValue) ? numericValue : normalizedFallback;
};

const readPendingStatCount = (pendingStats: unknown, key: 'total' | 'encrypted', fallback: unknown): number => {
  if (pendingStats && typeof pendingStats === 'object' && Object.prototype.hasOwnProperty.call(pendingStats, key)) {
    return normalizePendingStatCount((pendingStats as Partial<Record<'total' | 'encrypted', unknown>>)[key]);
  }
  return normalizePendingStatCount(fallback);
};

const resolveSubmitFailureMessage = (error: unknown): string =>
  (error as { message?: string } | null | undefined)?.message || 'Submission failed.';

const lowerSubmitRouteValue = (value: unknown): string =>
  ((value || '') as { toLowerCase: () => string }).toLowerCase();

const buildSubmitStaleState = (): SurveyQuestionsSubmitStaleStatePatch => ({
  isSubmitting: false,
  submitProgress: 0,
  currentStep: 0,
});

const runSubmitCompletionPrelude = (submitAttemptId: number, ports: SurveyQuestionsSubmitCompletionPorts): void => {
  ports.clearSubmitGuard?.();
  if (submitAttemptId > 0) {
    ports.finishSubmitAttempt?.(submitAttemptId);
  }
};

export const resolveSurveyQuestionsSubmitPendingStats = ({
  fallbackEncrypted = 0,
  fallbackTotal = 0,
  getPendingEditStats,
}: ResolveSurveyQuestionsSubmitPendingStatsArgs = {}): SurveyQuestionsSubmitPendingStats => {
  const pendingStats = typeof getPendingEditStats === 'function' ? getPendingEditStats() : null;

  return {
    total: readPendingStatCount(pendingStats, 'total', fallbackTotal),
    encrypted: readPendingStatCount(pendingStats, 'encrypted', fallbackEncrypted),
  };
};

export const resolveSurveyQuestionsSubmittedResponseUrl = ({
  account = '',
  currentPathname = '',
  isStandalone = false,
  logWarn,
  questionID = '',
  singleQuestionMode = false,
  submissionSlug = '',
  surveyId = '',
}: ResolveSurveyQuestionsSubmittedResponseUrlArgs = {}): string => {
  let responseUrl = '';
  try {
    const accountLower = lowerSubmitRouteValue(account);
    if (accountLower) {
      if (singleQuestionMode) {
        const qLower = lowerSubmitRouteValue(questionID);
        if (qLower) {
          responseUrl = buildQuestionRoutePath(qLower, {
            responderAddress: accountLower,
            sessionSlug: String(submissionSlug || ''),
          });
        }
      } else if (!isStandalone) {
        const sLower = lowerSubmitRouteValue(surveyId);
        if (sLower) {
          responseUrl = `/survey/${sLower}/${accountLower}${submissionSlug ? `?session=${encodeURIComponent(String(submissionSlug))}` : ''}`;
        }
      }
    }
  } catch (error) {
    logWarn?.('SurveyTool: fallback', error);
  }
  return responseUrl || String(currentPathname || '');
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
    ports.activateSubmitGuard?.();
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

export const runSurveyQuestionsSubmitStartController = ({
  ports = {},
}: RunSurveyQuestionsSubmitStartControllerArgs = {}): SurveyQuestionsSubmitStartControllerResult => {
  const submitAttemptId = normalizeSubmitAttemptId(ports.startSubmitAttempt?.());
  const statePatch = buildSubmitStartState();
  ports.setSubmitStartState?.(statePatch);

  return {
    outcome: 'started',
    status: 'completed',
    submitAttemptId,
    statePatch,
  };
};

export const runSurveyQuestionsStaleSubmitController = ({
  snapshot = null,
  ports = {},
}: RunSurveyQuestionsStaleSubmitControllerArgs = {}): SurveyQuestionsStaleSubmitControllerResult => {
  ports.clearSubmitGuard?.();

  const submitAttemptId = normalizeSubmitAttemptId(
    (snapshot as { submitAttemptId?: unknown } | null | undefined)?.submitAttemptId,
  );
  const canUpdateSubmitState =
    typeof ports.canUpdateSubmitState === 'function' ? !!ports.canUpdateSubmitState(snapshot) : false;

  if (!canUpdateSubmitState) {
    return {
      outcome: 'stale',
      reason: 'snapshot_not_current',
      status: 'skipped',
      submitAttemptId,
      statePatch: null,
    };
  }

  if (submitAttemptId <= 0) {
    return {
      outcome: 'stale',
      reason: 'missing_attempt',
      status: 'skipped',
      submitAttemptId,
      statePatch: null,
    };
  }

  const isSubmitAttemptActive =
    typeof ports.isSubmitAttemptActive === 'function'
      ? !!ports.isSubmitAttemptActive(submitAttemptId, snapshot)
      : false;
  if (!isSubmitAttemptActive) {
    return {
      outcome: 'stale',
      reason: 'inactive_attempt',
      status: 'skipped',
      submitAttemptId,
      statePatch: null,
    };
  }

  const statePatch = buildSubmitStaleState();
  ports.finishSubmitAttempt?.(submitAttemptId);
  ports.setSubmitStaleState?.(statePatch);

  return {
    outcome: 'stale',
    reason: 'active_attempt',
    status: 'completed',
    submitAttemptId,
    statePatch,
  };
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
    submittedSinceLastEdit: updateSubmittedSinceLastEdit(submittedSinceLastEdit, 'submit_success'),
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
    submittedSinceLastEdit: updateSubmittedSinceLastEdit(submittedSinceLastEdit, 'submit_error'),
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
