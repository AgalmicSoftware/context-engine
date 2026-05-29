import {
  runSurveyQuestionsSubmitController,
  type SurveyQuestionsSubmitControllerPorts,
} from './surveyQuestionsSubmitController';
import type {
  SurveyQuestionsPrimarySubmitPlan,
} from './surveyQuestionsTypes';

const createPorts = (): Required<SurveyQuestionsSubmitControllerPorts> => ({
  dispatchSubmit: jest.fn(),
  navigateToResponse: jest.fn(),
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
});
