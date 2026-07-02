import { bindSurveyReadsPort } from './contractScriptsSurveyReadsPort';

describe('SurveyReadsPort', () => {
  it('routes survey and response reads through call-time contractScripts lookup', async () => {
    const firstContractScripts = {
      getSurveyHash: jest.fn(async () => 'first-hash'),
      getSurveyDataById: jest.fn(async () => ({ id: 'first-survey' })),
      getQuestionData: jest.fn(async () => ({ id: 'first-question' })),
      getSurveyResponse: jest.fn(async () => ({ id: 'first-survey-response' })),
      getResponse: jest.fn(async () => ({ id: 'first-question-response' })),
    };
    const secondContractScripts = {
      getSurveyHash: jest.fn(async () => 'second-hash'),
      getSurveyDataById: jest.fn(async () => ({ id: 'second-survey' })),
      getQuestionData: jest.fn(async () => ({ id: 'second-question' })),
      getSurveyResponse: jest.fn(async () => ({ id: 'second-survey-response' })),
      getResponse: jest.fn(async () => ({ id: 'second-question-response' })),
    };
    let currentContractScripts = firstContractScripts;
    const port = bindSurveyReadsPort({
      contractScripts: () => currentContractScripts,
    });

    await expect(port.getSurveyHash('none', 'survey-1', 'alpha')).resolves.toBe('first-hash');

    currentContractScripts = secondContractScripts;

    await expect(port.getSurveyDataById('none', 'survey-2', 'beta', { strict: true }))
      .resolves.toEqual({ id: 'second-survey' });
    await expect(port.getQuestionData('none', 'question-2', 'beta', { strict: true }))
      .resolves.toEqual({ id: 'second-question' });
    await expect(port.getSurveyResponse('none', '0xabc', 'survey-2', 'beta'))
      .resolves.toEqual({ id: 'second-survey-response' });
    await expect(port.getResponse('none', '0xdef', 'question-2', 'beta', { strict: false }))
      .resolves.toEqual({ id: 'second-question-response' });

    expect(firstContractScripts.getSurveyHash).toHaveBeenCalledWith('none', 'survey-1', 'alpha');
    expect(secondContractScripts.getSurveyDataById).toHaveBeenCalledWith(
      'none',
      'survey-2',
      'beta',
      { strict: true }
    );
    expect(secondContractScripts.getQuestionData).toHaveBeenCalledWith(
      'none',
      'question-2',
      'beta',
      { strict: true }
    );
    expect(secondContractScripts.getSurveyResponse).toHaveBeenCalledWith(
      'none',
      '0xabc',
      'survey-2',
      'beta'
    );
    expect(secondContractScripts.getResponse).toHaveBeenCalledWith(
      'none',
      '0xdef',
      'question-2',
      'beta',
      { strict: false }
    );
  });
});
