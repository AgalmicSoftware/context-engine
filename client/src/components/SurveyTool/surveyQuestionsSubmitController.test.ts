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
});
