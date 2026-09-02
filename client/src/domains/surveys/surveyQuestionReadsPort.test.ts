import chainGateway from '../../utilities/web3/chainGateway.js';
import { surveyQuestionReadsPort } from './surveyQuestionReadsPort';

describe('surveyQuestionReadsPort', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes question and response reads through call-time chain gateway property lookup', async () => {
    const getQuestionData = jest.spyOn(chainGateway, 'getQuestionData').mockResolvedValue({ id: 'first-question' });
    const getSurveyDataById = jest.spyOn(chainGateway, 'getSurveyDataById').mockResolvedValue({ id: 'first-survey' });
    const getResponse = jest.spyOn(chainGateway, 'getResponse').mockResolvedValue({ id: 'second-response' });
    const getResponseHash = jest.spyOn(chainGateway, 'getResponseHash').mockResolvedValue('second-hash');
    const getSurveyResponse = jest
      .spyOn(chainGateway, 'getSurveyResponse')
      .mockResolvedValue({ id: 'second-survey-response' });

    await expect(surveyQuestionReadsPort.getQuestionData('provider-a', 'q1', 'slug-a')).resolves.toEqual({
      id: 'first-question',
    });
    await expect(surveyQuestionReadsPort.getSurveyDataById('provider-a', 's1', 'slug-a')).resolves.toEqual({
      id: 'first-survey',
    });

    await expect(
      surveyQuestionReadsPort.getResponse('provider-b', '0xabc', 'q2', 'slug-b', { forceArweaveFetch: true }),
    ).resolves.toEqual({ id: 'second-response' });
    await expect(surveyQuestionReadsPort.getResponseHash('provider-b', '0xabc', 'q2', 'slug-b')).resolves.toBe(
      'second-hash',
    );
    await expect(surveyQuestionReadsPort.getSurveyResponse('provider-b', '0xdef', 's2', 'slug-b')).resolves.toEqual({
      id: 'second-survey-response',
    });

    expect(getQuestionData).toHaveBeenCalledWith('provider-a', 'q1', 'slug-a');
    expect(getSurveyDataById).toHaveBeenCalledWith('provider-a', 's1', 'slug-a');
    expect(getResponse).toHaveBeenCalledWith('provider-b', '0xabc', 'q2', 'slug-b', {
      forceArweaveFetch: true,
    });
    expect(getResponseHash).toHaveBeenCalledWith('provider-b', '0xabc', 'q2', 'slug-b');
    expect(getSurveyResponse).toHaveBeenCalledWith('provider-b', '0xdef', 's2', 'slug-b');
  });
});
