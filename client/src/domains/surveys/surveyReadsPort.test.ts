import { bindSurveyReadsPort } from './surveyChainReadsPort';

describe('SurveyReadsPort', () => {
  it('routes survey and response reads through call-time chainGateway lookup', async () => {
    const firstChainGateway = {
      getSurveyHash: jest.fn(async () => 'first-hash'),
      getSurveyDataById: jest.fn(async () => ({ id: 'first-survey' })),
      getQuestionData: jest.fn(async () => ({ id: 'first-question' })),
      getSurveyResponse: jest.fn(async () => ({ id: 'first-survey-response' })),
      getResponse: jest.fn(async () => ({ id: 'first-question-response' })),
    };
    const secondChainGateway = {
      getSurveyHash: jest.fn(async () => 'second-hash'),
      getSurveyDataById: jest.fn(async () => ({ id: 'second-survey' })),
      getQuestionData: jest.fn(async () => ({ id: 'second-question' })),
      getSurveyResponse: jest.fn(async () => ({ id: 'second-survey-response' })),
      getResponse: jest.fn(async () => ({ id: 'second-question-response' })),
    };
    let currentChainGateway = firstChainGateway;
    const port = bindSurveyReadsPort({
      chainGateway: () => currentChainGateway,
    });

    await expect(port.getSurveyHash('none', 'survey-1', 'alpha')).resolves.toBe('first-hash');

    currentChainGateway = secondChainGateway;

    await expect(port.getSurveyDataById('none', 'survey-2', 'beta', { strict: true }))
      .resolves.toEqual({ id: 'second-survey' });
    await expect(port.getQuestionData('none', 'question-2', 'beta', { strict: true }))
      .resolves.toEqual({ id: 'second-question' });
    await expect(port.getSurveyResponse('none', '0xabc', 'survey-2', 'beta'))
      .resolves.toEqual({ id: 'second-survey-response' });
    await expect(port.getResponse('none', '0xdef', 'question-2', 'beta', { strict: false }))
      .resolves.toEqual({ id: 'second-question-response' });

    expect(firstChainGateway.getSurveyHash).toHaveBeenCalledWith('none', 'survey-1', 'alpha');
    expect(secondChainGateway.getSurveyDataById).toHaveBeenCalledWith(
      'none',
      'survey-2',
      'beta',
      { strict: true }
    );
    expect(secondChainGateway.getQuestionData).toHaveBeenCalledWith(
      'none',
      'question-2',
      'beta',
      { strict: true }
    );
    expect(secondChainGateway.getSurveyResponse).toHaveBeenCalledWith(
      'none',
      '0xabc',
      'survey-2',
      'beta'
    );
    expect(secondChainGateway.getResponse).toHaveBeenCalledWith(
      'none',
      '0xdef',
      'question-2',
      'beta',
      { strict: false }
    );
  });
});
