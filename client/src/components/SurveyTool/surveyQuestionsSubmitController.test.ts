import {
  runSurveyQuestionsSubmitController,
  runSurveyQuestionsSubmitFailureController,
  runSurveyQuestionsSubmitSuccessController,
  type SurveyQuestionsSubmitCompletionPorts,
  type SurveyQuestionsSubmitControllerPorts,
} from './surveyQuestionsSubmitController';
import type {
  SurveyQuestionsPrimarySubmitPlan,
} from './surveyQuestionsTypes';

const createPorts = (): Required<SurveyQuestionsSubmitControllerPorts> => ({
  dispatchSubmit: jest.fn(),
  navigateToResponse: jest.fn(),
});

const createCompletionPorts = (events: string[] = []) => ({
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
} as SurveyQuestionsSubmitCompletionPorts & {
  cacheWrite: jest.Mock;
  decrypt: jest.Mock;
  storageWrite: jest.Mock;
  workerSubmit: jest.Mock;
});

describe('surveyQuestionsSubmitController', () => {
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
    expect(ports.dispatchSubmit).not.toHaveBeenCalled();
  });

  it('dispatches submit plans through the injected submit port', () => {
    const ports = createPorts();
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
    expect(ports.dispatchSubmit).toHaveBeenCalledTimes(1);
    expect(ports.dispatchSubmit).toHaveBeenCalledWith(plan);
    expect(ports.navigateToResponse).not.toHaveBeenCalled();
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

    expect(events).toEqual([
      'clear-submit-guard',
      'finish-submit-attempt',
      'set-submit-failure-state',
    ]);
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
