import { screen, waitFor } from '@testing-library/react';
import { renderSurveyQuestions } from './surveyQuestionsTestHarness';
import * as chainGateway from '../../utilities/web3/chainGateway';
import * as cacheScripts from '../../utilities/cache/cacheScripts';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort';

const config = (slug) => ({
  slug,
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
});
const question = { id: 'q1', type: 'freeform', prompt: 'Fetched survey question' };

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
});

it.each(['edge', 'explicit-session'])(
  'the mounted survey reads and writes its explicit %s session',
  async (sessionSlug) => {
    jest.spyOn(chainGateway, 'getSessionConfigBySlug').mockImplementation((slug) => config(slug));
    const peek = jest
      .spyOn(cacheScripts, 'peekCacheSync')
      .mockImplementation((namespace) =>
        namespace === 'questionsCache' ? { 84532: { questions: { q1: question }, questionResponses: {} } } : {},
      );
    jest
      .spyOn(cacheScripts, 'readCache')
      .mockImplementation(async (namespace) =>
        namespace === 'questionsCache' ? { 84532: { questions: { q1: question }, questionResponses: {} } } : {},
      );
    const write = jest.spyOn(cacheScripts, 'writeCacheOptimistic').mockResolvedValue(true);
    const readSurvey = jest.spyOn(surveyQuestionReadsPort, 'getSurveyDataById').mockResolvedValue({
      title: 'Fetched survey',
      questionIDs: ['q1'],
      creator: '0x00000000000000000000000000000000000000a1',
    });
    jest.spyOn(surveyQuestionReadsPort, 'getSurveyResponse').mockResolvedValue(null);
    const provider = { request: jest.fn() };
    renderSurveyQuestions({
      provider,
      sessionSlug,
      activeSessionSlug: 'other-active-session',
      surveyId: '0xSurvey',
      sessionConfig: config(sessionSlug),
      isQuestionCacheReady: true,
    });
    await waitFor(() => expect(readSurvey).toHaveBeenCalledWith(provider, '0xsurvey', sessionSlug));
    expect(peek).toHaveBeenCalledWith('surveysCache', sessionSlug);
    expect(write).toHaveBeenCalledWith(
      'surveysCache',
      sessionSlug,
      expect.objectContaining({
        84532: expect.objectContaining({
          surveys: expect.objectContaining({
            '0xsurvey': expect.objectContaining({ id: '0xsurvey', surveyID: '0xsurvey', title: 'Fetched survey' }),
          }),
        }),
      }),
    );
    await waitFor(() => expect(screen.getByText('Fetched survey question')).toBeInTheDocument());
    expect(readSurvey.mock.calls.every((call) => call[2] === sessionSlug)).toBe(true);
    expect(
      write.mock.calls.filter(([namespace]) => namespace === 'surveysCache').every((call) => call[1] === sessionSlug),
    ).toBe(true);
  },
);
