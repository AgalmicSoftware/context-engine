import {
  resolveSurveyQuestionsSubmitPendingStats,
  resolveSurveyQuestionsSubmittedResponseUrl,
  resolveSubmitEffectiveDraftSlug,
  runSurveyQuestionsSubmitController,
  runSurveyQuestionsSubmitFailureController,
  runSurveyQuestionsStaleSubmitController,
  runSurveyQuestionsSubmitStartController,
  runSurveyQuestionsSubmitSuccessController,
  type SurveyQuestionsSubmitCompletionPorts,
  type SurveyQuestionsSubmitControllerPorts,
} from './surveyQuestionsSubmitController';
import type { SurveyQuestionsPrimarySubmitPlan } from './surveyQuestionsTypes';

const createPorts = (): Required<SurveyQuestionsSubmitControllerPorts> => ({
  activateSubmitGuard: jest.fn(),
  dispatchSubmit: jest.fn(),
  navigateToResponse: jest.fn(),
});

const createCompletionPorts = (events: string[] = []) =>
  ({
    clearSubmitGuard: jest.fn(() => events.push('clear-submit-guard')),
    finishSubmitAttempt: jest.fn(() => events.push('finish-submit-attempt')),
    setSubmitFailureState: jest.fn(() => events.push('set-submit-failure-state')),
    setSubmitSuccessState: jest.fn((_state, afterStateApplied) => {
      events.push('set-submit-success-state');
      if (afterStateApplied) afterStateApplied();
    }),
    cacheWrite: jest.fn(),
    decrypt: jest.fn(),
    storageWrite: jest.fn(),
    workerSubmit: jest.fn(),
  }) as SurveyQuestionsSubmitCompletionPorts & {
    cacheWrite: jest.Mock;
    decrypt: jest.Mock;
    storageWrite: jest.Mock;
    workerSubmit: jest.Mock;
  };

describe('surveyQuestionsSubmitController', () => {
  it('falls back to the explicit session route when pile submit has no draft slug', () => {
    expect(
      resolveSubmitEffectiveDraftSlug({
        draftSlug: '',
        routeSlug: ' demo-1 ',
        normalizeSlug: (value) =>
          String(value ?? '')
            .trim()
            .toLowerCase(),
      }),
    ).toBe('demo-1');
  });

  it('keeps the id-derived draft slug ahead of the route slug for cross-session question submits', () => {
    expect(
      resolveSubmitEffectiveDraftSlug({
        draftSlug: 'question-session',
        routeSlug: 'route-session',
        normalizeSlug: (value) =>
          String(value ?? '')
            .trim()
            .toLowerCase(),
      }),
    ).toBe('question-session');
  });

  it.each([
    ['submitting'],
    ['submit_guard'],
    ['submitted_without_new_edits'],
    ['completed_standalone_response'],
    ['missing_account'],
    ['missing_question_id'],
    ['missing_survey_id'],
  ])('keeps inert %s plans side-effect free', (reason) => {
    const ports = createPorts();
    const plan: SurveyQuestionsPrimarySubmitPlan = {
      action: 'inert',
      path: '',
      reason,
    };

    const result = runSurveyQuestionsSubmitController({ plan, ports });

    expect(result).toEqual({
      action: 'inert',
      path: '',
      plan,
      reason,
      status: 'inert',
    });
    expect(ports.activateSubmitGuard).not.toHaveBeenCalled();
    expect(ports.dispatchSubmit).not.toHaveBeenCalled();
    expect(ports.navigateToResponse).not.toHaveBeenCalled();
  });

  it('routes navigate plans through the injected navigation port', () => {
    const ports = createPorts();
    const plan: SurveyQuestionsPrimarySubmitPlan = {
      action: 'navigate',
      path: '/survey/0xsurvey/0xabc?session=edge%20session',
      reason: 'completed_survey_response',
    };

    const result = runSurveyQuestionsSubmitController({ plan, ports });

    expect(result).toEqual({
      action: 'navigate',
      path: '/survey/0xsurvey/0xabc?session=edge%20session',
      plan,
      reason: 'completed_survey_response',
      status: 'navigated',
    });
    expect(ports.navigateToResponse).toHaveBeenCalledTimes(1);
    expect(ports.navigateToResponse).toHaveBeenCalledWith(plan.path, plan);
    expect(ports.activateSubmitGuard).not.toHaveBeenCalled();
    expect(ports.dispatchSubmit).not.toHaveBeenCalled();
  });

  it('keeps navigate plans unhandled and side-effect free when the navigation port is absent', () => {
    const ports = {
      activateSubmitGuard: jest.fn(),
      dispatchSubmit: jest.fn(),
    };
    const plan: SurveyQuestionsPrimarySubmitPlan = {
      action: 'navigate',
      path: '/survey/0xsurvey/0xabc?session=edge%20session',
      reason: 'completed_survey_response',
    };

    const result = runSurveyQuestionsSubmitController({ plan, ports });

    expect(result).toEqual({
      action: 'navigate',
      path: plan.path,
      plan,
      reason: 'completed_survey_response',
      status: 'unhandled',
    });
    expect(ports.activateSubmitGuard).not.toHaveBeenCalled();
    expect(ports.dispatchSubmit).not.toHaveBeenCalled();
  });

  it('activates the submit guard before dispatching submit plans', () => {
    const events: string[] = [];
    const ports = createPorts();
    ports.activateSubmitGuard.mockImplementation(() => events.push('activate-submit-guard'));
    ports.dispatchSubmit.mockImplementation(() => events.push('dispatch-submit'));
    const plan: SurveyQuestionsPrimarySubmitPlan = {
      action: 'submit',
      path: '',
      reason: 'pending_edits',
    };

    const result = runSurveyQuestionsSubmitController({ plan, ports });

    expect(result).toEqual({
      action: 'submit',
      path: '',
      plan,
      reason: 'pending_edits',
      status: 'dispatched',
    });
    expect(events).toEqual(['activate-submit-guard', 'dispatch-submit']);
    expect(ports.activateSubmitGuard).toHaveBeenCalledTimes(1);
    expect(ports.dispatchSubmit).toHaveBeenCalledTimes(1);
    expect(ports.dispatchSubmit).toHaveBeenCalledWith(plan);
    expect(ports.navigateToResponse).not.toHaveBeenCalled();
  });

  it('keeps submit dispatch unhandled and guard-free when the submit port is absent', () => {
    const activateSubmitGuard = jest.fn();
    const plan: SurveyQuestionsPrimarySubmitPlan = {
      action: 'submit',
      path: '',
      reason: 'pending_edits',
    };

    const result = runSurveyQuestionsSubmitController({
      plan,
      ports: { activateSubmitGuard },
    });

    expect(result).toEqual({
      action: 'submit',
      path: '',
      plan,
      reason: 'pending_edits',
      status: 'unhandled',
    });
    expect(activateSubmitGuard).not.toHaveBeenCalled();
  });

  it('starts submit attempts before applying submit-start state', () => {
    const events: string[] = [];
    const startSubmitAttempt = jest.fn(() => {
      events.push('start-submit-attempt');
      return 12;
    });
    const setSubmitStartState = jest.fn(() => events.push('set-submit-start-state'));

    const result = runSurveyQuestionsSubmitStartController({
      ports: { startSubmitAttempt, setSubmitStartState },
    });

    expect(events).toEqual(['start-submit-attempt', 'set-submit-start-state']);
    expect(setSubmitStartState).toHaveBeenCalledWith(result.statePatch);
    expect(result).toEqual({
      outcome: 'started',
      status: 'completed',
      submitAttemptId: 12,
      statePatch: {
        isSubmitting: true,
        submitProgress: 0,
        currentStep: 1,
        submissionError: '',
      },
    });
  });

  it('returns submit-start state without side effects when start ports are absent', () => {
    const result = runSurveyQuestionsSubmitStartController();

    expect(result).toEqual({
      outcome: 'started',
      status: 'completed',
      submitAttemptId: 0,
      statePatch: {
        isSubmitting: true,
        submitProgress: 0,
        currentStep: 1,
        submissionError: '',
      },
    });
  });

  it('runs stale submit cleanup only for the active async attempt', () => {
    const events: string[] = [];
    const ports = {
      clearSubmitGuard: jest.fn(() => events.push('clear-submit-guard')),
      canUpdateSubmitState: jest.fn(() => {
        events.push('can-update-submit-state');
        return true;
      }),
      isSubmitAttemptActive: jest.fn(() => {
        events.push('is-submit-attempt-active');
        return true;
      }),
      finishSubmitAttempt: jest.fn(() => events.push('finish-submit-attempt')),
      setSubmitStaleState: jest.fn(() => events.push('set-submit-stale-state')),
    };
    const snapshot = { submitAttemptId: 13, mounted: true };

    const result = runSurveyQuestionsStaleSubmitController({ snapshot, ports });

    expect(events).toEqual([
      'clear-submit-guard',
      'can-update-submit-state',
      'is-submit-attempt-active',
      'finish-submit-attempt',
      'set-submit-stale-state',
    ]);
    expect(ports.canUpdateSubmitState).toHaveBeenCalledWith(snapshot);
    expect(ports.isSubmitAttemptActive).toHaveBeenCalledWith(13, snapshot);
    expect(ports.finishSubmitAttempt).toHaveBeenCalledWith(13);
    expect(ports.setSubmitStaleState).toHaveBeenCalledWith(result.statePatch);
    expect(result).toEqual({
      outcome: 'stale',
      reason: 'active_attempt',
      status: 'completed',
      submitAttemptId: 13,
      statePatch: {
        isSubmitting: false,
        submitProgress: 0,
        currentStep: 0,
      },
    });
  });

  it('clears stale submit guard but skips status writes for inactive attempts', () => {
    const events: string[] = [];
    const ports = {
      clearSubmitGuard: jest.fn(() => events.push('clear-submit-guard')),
      canUpdateSubmitState: jest.fn(() => {
        events.push('can-update-submit-state');
        return true;
      }),
      isSubmitAttemptActive: jest.fn(() => {
        events.push('is-submit-attempt-active');
        return false;
      }),
      finishSubmitAttempt: jest.fn(() => events.push('finish-submit-attempt')),
      setSubmitStaleState: jest.fn(() => events.push('set-submit-stale-state')),
    };

    const result = runSurveyQuestionsStaleSubmitController({
      snapshot: { submitAttemptId: 14 },
      ports,
    });

    expect(events).toEqual(['clear-submit-guard', 'can-update-submit-state', 'is-submit-attempt-active']);
    expect(ports.finishSubmitAttempt).not.toHaveBeenCalled();
    expect(ports.setSubmitStaleState).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: 'stale',
      reason: 'inactive_attempt',
      status: 'skipped',
      submitAttemptId: 14,
      statePatch: null,
    });
  });

  it('keeps stale submit cleanup inert when ports are absent', () => {
    expect(runSurveyQuestionsStaleSubmitController()).toEqual({
      outcome: 'stale',
      reason: 'snapshot_not_current',
      status: 'skipped',
      submitAttemptId: 0,
      statePatch: null,
    });
  });

  it('falls back to parent pending stats when no stats port is available', () => {
    expect(
      resolveSurveyQuestionsSubmitPendingStats({
        fallbackTotal: 5,
        fallbackEncrypted: 2,
      }),
    ).toEqual({ total: 5, encrypted: 2 });
  });

  it('falls back to parent pending stats when the stats port returns no data', () => {
    expect(
      resolveSurveyQuestionsSubmitPendingStats({
        getPendingEditStats: () => null,
        fallbackTotal: 4,
        fallbackEncrypted: 1,
      }),
    ).toEqual({ total: 4, encrypted: 1 });
  });

  it('uses injected pending stats when available', () => {
    const getPendingEditStats = jest.fn(() => ({ total: 7, encrypted: 3 }));

    const result = resolveSurveyQuestionsSubmitPendingStats({
      getPendingEditStats,
      fallbackTotal: 5,
      fallbackEncrypted: 2,
    });

    expect(result).toEqual({ total: 7, encrypted: 3 });
    expect(getPendingEditStats).toHaveBeenCalledTimes(1);
  });

  it('resolves submitted response URLs for single-question and survey success states', () => {
    expect(
      resolveSurveyQuestionsSubmittedResponseUrl({
        account: '0xABC',
        currentPathname: '/questions',
        questionID: 'Q1',
        singleQuestionMode: true,
        submissionSlug: 'edge',
      }),
    ).toBe('/question/q1?session=edge&responder=0xabc');

    expect(
      resolveSurveyQuestionsSubmittedResponseUrl({
        account: '0xABC',
        currentPathname: '/surveys',
        singleQuestionMode: false,
        submissionSlug: 'edge session',
        surveyId: '0xSURVEY',
      }),
    ).toBe('/survey/0xsurvey/0xabc?session=edge%20session');
  });

  it('keeps submitted response URL fallback behavior for standalone and malformed route inputs', () => {
    const logWarn = jest.fn();

    expect(
      resolveSurveyQuestionsSubmittedResponseUrl({
        account: '0xABC',
        currentPathname: '/standalone',
        isStandalone: true,
        logWarn,
        singleQuestionMode: false,
        surveyId: '0xSURVEY',
      }),
    ).toBe('/standalone');
    expect(logWarn).not.toHaveBeenCalled();

    expect(
      resolveSurveyQuestionsSubmittedResponseUrl({
        account: { address: '0xabc' },
        currentPathname: '/fallback',
        logWarn,
        singleQuestionMode: false,
        surveyId: '0xSURVEY',
      }),
    ).toBe('/fallback');
    expect(logWarn).toHaveBeenCalledTimes(1);
    expect(logWarn).toHaveBeenCalledWith('SurveyTool: fallback', expect.any(TypeError));
  });

  it('runs success completion status callbacks in the current order', () => {
    const events: string[] = [];
    const ports = createCompletionPorts(events);
    const afterStateApplied = jest.fn(() => events.push('after-success-state-applied'));
    const editBaseline = { answers: { '0xq': { value: 'yes' } } };
    const surveysResponseState = [{ answers: { '0xq': { value: 'yes' } } }];
    const userAnswers = { responses: [{ questionId: '0xq', answer: 'yes' }] };

    const result = runSurveyQuestionsSubmitSuccessController({
      editBaseline,
      hasEncrypted: true,
      responseUrl: '/survey/0xsurvey/0xabc?session=edge',
      submitAttemptId: 7,
      submittedSinceLastEdit: false,
      surveysResponseState,
      userAnswers,
      afterStateApplied,
      ports,
    });

    expect(events).toEqual([
      'clear-submit-guard',
      'finish-submit-attempt',
      'set-submit-success-state',
      'after-success-state-applied',
    ]);
    expect(ports.clearSubmitGuard).toHaveBeenCalledTimes(1);
    expect(ports.finishSubmitAttempt).toHaveBeenCalledWith(7);
    expect(ports.setSubmitSuccessState).toHaveBeenCalledTimes(1);
    expect(ports.setSubmitSuccessState).toHaveBeenCalledWith(result.statePatch, afterStateApplied);
    expect(result).toMatchObject({
      outcome: 'success',
      status: 'completed',
      submitAttemptId: 7,
      statePatch: {
        currentStep: 3,
        editBaseline,
        hasEncryptedChanges: false,
        isDirty: false,
        isSubmitting: false,
        modifiedCount: 0,
        responseUrl: '/survey/0xsurvey/0xabc?session=edge',
        submissionComplete: true,
        submittedSinceLastEdit: true,
        submitProgress: 100,
        surveysResponseState,
        userAnswers,
        userHasResponse: true,
        userResponseEncrypted: true,
      },
    });
    expect(ports.cacheWrite).not.toHaveBeenCalled();
    expect(ports.decrypt).not.toHaveBeenCalled();
    expect(ports.storageWrite).not.toHaveBeenCalled();
    expect(ports.workerSubmit).not.toHaveBeenCalled();
  });

  it('keeps success completion inert when optional status ports are absent', () => {
    const result = runSurveyQuestionsSubmitSuccessController({
      responseUrl: '/survey/0xsurvey/0xabc',
      submittedSinceLastEdit: true,
    });

    expect(result).toMatchObject({
      outcome: 'success',
      status: 'completed',
      submitAttemptId: 0,
      statePatch: {
        responseUrl: '/survey/0xsurvey/0xabc',
        submissionComplete: true,
        submittedSinceLastEdit: true,
      },
    });
  });

  it('runs failure completion status callbacks and preserves error-message mapping', () => {
    const events: string[] = [];
    const ports = createCompletionPorts(events);

    const result = runSurveyQuestionsSubmitFailureController({
      error: new Error('Receipt reverted'),
      submitAttemptId: 9,
      submittedSinceLastEdit: true,
      ports,
    });

    expect(events).toEqual(['clear-submit-guard', 'finish-submit-attempt', 'set-submit-failure-state']);
    expect(ports.clearSubmitGuard).toHaveBeenCalledTimes(1);
    expect(ports.finishSubmitAttempt).toHaveBeenCalledWith(9);
    expect(ports.setSubmitFailureState).toHaveBeenCalledTimes(1);
    expect(ports.setSubmitFailureState).toHaveBeenCalledWith(result.statePatch);
    expect(result).toEqual({
      outcome: 'failure',
      status: 'completed',
      submitAttemptId: 9,
      statePatch: {
        isSubmitting: false,
        submitProgress: 0,
        submissionComplete: false,
        submittedSinceLastEdit: false,
        submissionError: 'Receipt reverted',
      },
    });
    expect(ports.cacheWrite).not.toHaveBeenCalled();
    expect(ports.decrypt).not.toHaveBeenCalled();
    expect(ports.storageWrite).not.toHaveBeenCalled();
    expect(ports.workerSubmit).not.toHaveBeenCalled();
  });

  it('maps non-Error failure values to the existing fallback message', () => {
    const ports = createCompletionPorts();

    const result = runSurveyQuestionsSubmitFailureController({
      error: 'raw failure',
      ports,
    });

    expect(ports.finishSubmitAttempt).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      outcome: 'failure',
      status: 'completed',
      submitAttemptId: 0,
      statePatch: {
        submissionComplete: false,
        submissionError: 'Submission failed.',
        submittedSinceLastEdit: false,
      },
    });
  });
});
