import { bindSurveyQuestionReadsPort, type SurveyQuestionReadsGateway } from './surveyQuestionReadsPort';

describe('surveyQuestionReadsPort', () => {
  it('routes question and response reads through call-time chain gateway lookup', async () => {
    const firstGateway: SurveyQuestionReadsGateway = {
      getQuestionData: jest.fn(async () => ({ id: 'first-question' })),
      getSurveyDataById: jest.fn(async () => ({ id: 'first-survey' })),
      getResponse: jest.fn(async () => ({ id: 'first-response' })),
      getResponseHash: jest.fn(async () => 'first-hash'),
      getSurveyResponse: jest.fn(async () => ({ id: 'first-survey-response' })),
    };
    const secondGateway: SurveyQuestionReadsGateway = {
      getQuestionData: jest.fn(async () => ({ id: 'second-question' })),
      getSurveyDataById: jest.fn(async () => ({ id: 'second-survey' })),
      getResponse: jest.fn(async () => ({ id: 'second-response' })),
      getResponseHash: jest.fn(async () => 'second-hash'),
      getSurveyResponse: jest.fn(async () => ({ id: 'second-survey-response' })),
    };
    let currentGateway = firstGateway;
    const port = bindSurveyQuestionReadsPort({
      chainGateway: () => currentGateway,
    });

    await expect(port.getQuestionData('provider-a', 'q1', 'slug-a')).resolves.toEqual({ id: 'first-question' });
    await expect(port.getSurveyDataById('provider-a', 's1', 'slug-a')).resolves.toEqual({ id: 'first-survey' });

    currentGateway = secondGateway;

    await expect(port.getResponse('provider-b', '0xabc', 'q2', 'slug-b', { forceArweaveFetch: true })).resolves.toEqual(
      { id: 'second-response' },
    );
    await expect(port.getResponseHash('provider-b', '0xabc', 'q2', 'slug-b')).resolves.toBe('second-hash');
    await expect(port.getSurveyResponse('provider-b', '0xdef', 's2', 'slug-b')).resolves.toEqual({
      id: 'second-survey-response',
    });

    expect(firstGateway.getQuestionData).toHaveBeenCalledWith('provider-a', 'q1', 'slug-a');
    expect(firstGateway.getSurveyDataById).toHaveBeenCalledWith('provider-a', 's1', 'slug-a');
    expect(secondGateway.getResponse).toHaveBeenCalledWith('provider-b', '0xabc', 'q2', 'slug-b', {
      forceArweaveFetch: true,
    });
    expect(secondGateway.getResponseHash).toHaveBeenCalledWith('provider-b', '0xabc', 'q2', 'slug-b');
    expect(secondGateway.getSurveyResponse).toHaveBeenCalledWith('provider-b', '0xdef', 's2', 'slug-b');
  });
});
