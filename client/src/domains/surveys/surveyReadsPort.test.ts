import chainGateway from '../../utilities/web3/chainGateway.js';
import { surveyReadsPort } from './surveyChainReadsPort';

describe('SurveyReadsPort', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes survey and response reads through call-time chainGateway property lookup', async () => {
    const getSurveyHash = jest.spyOn(chainGateway, 'getSurveyHash').mockResolvedValue('first-hash');
    const getSurveyDataById = jest.spyOn(chainGateway, 'getSurveyDataById').mockResolvedValue({ id: 'second-survey' });
    const getQuestionData = jest.spyOn(chainGateway, 'getQuestionData').mockResolvedValue({ id: 'second-question' });
    const getSurveyResponse = jest
      .spyOn(chainGateway, 'getSurveyResponse')
      .mockResolvedValue({ id: 'second-survey-response' });
    const getResponse = jest.spyOn(chainGateway, 'getResponse').mockResolvedValue({ id: 'second-question-response' });

    await expect(surveyReadsPort.getSurveyHash('none', 'survey-1', 'alpha')).resolves.toBe('first-hash');

    await expect(surveyReadsPort.getSurveyDataById('none', 'survey-2', 'beta', { strict: true })).resolves.toEqual({
      id: 'second-survey',
    });
    await expect(surveyReadsPort.getQuestionData('none', 'question-2', 'beta', { strict: true })).resolves.toEqual({
      id: 'second-question',
    });
    await expect(surveyReadsPort.getSurveyResponse('none', '0xabc', 'survey-2', 'beta')).resolves.toEqual({
      id: 'second-survey-response',
    });
    await expect(
      surveyReadsPort.getResponse('none', '0xdef', 'question-2', 'beta', { strict: false }),
    ).resolves.toEqual({
      id: 'second-question-response',
    });

    expect(getSurveyHash).toHaveBeenCalledWith('none', 'survey-1', 'alpha');
    expect(getSurveyDataById).toHaveBeenCalledWith('none', 'survey-2', 'beta', { strict: true });
    expect(getQuestionData).toHaveBeenCalledWith('none', 'question-2', 'beta', { strict: true });
    expect(getSurveyResponse).toHaveBeenCalledWith('none', '0xabc', 'survey-2', 'beta');
    expect(getResponse).toHaveBeenCalledWith('none', '0xdef', 'question-2', 'beta', {
      strict: false,
    });
  });
});
