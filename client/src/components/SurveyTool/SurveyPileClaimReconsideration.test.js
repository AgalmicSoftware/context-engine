// What a claim's AI is told about the person's earlier answers, through the real pile and interview modal:
// the saved-answer read, its merge into the form beside an unsent draft restored on load, and the prompt.
// Only the network reads and the AI call itself are replaced.
import { act, waitFor } from '@testing-library/react';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort';
import * as workerHydration from '../../utilities/survey/workerResponseHydration';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { callAI } from '../../utilities/ai/aiClient.js';
import { createPileViewRuntimeStrategy, receiveTranscriptClaim } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';

jest.setTimeout(30_000);

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({
  __esModule: true,
  default: () => null,
  SessionListeningWaveform: () => null,
  formatSessionRecordingElapsed: (seconds) => `0:${seconds}`,
}));
jest.mock('./SessionInterviewRecommendedGroups', () => ({ __esModule: true, default: () => null }));
jest.mock('./useSessionInterviewGroupRecommendations', () => ({
  useSessionInterviewGroupRecommendations: jest.fn(() => ({ availability: 'idle', recommendations: [] })),
}));
jest.mock('./useInterviewReadiness', () => ({
  useInterviewReadiness: jest.fn(() => ({ state: 'ready', detail: 'Voice setup ready.', retry: jest.fn() })),
}));
jest.mock('./useInterviewOpening', () => ({
  useInterviewOpening: () => ({ opening: '', notice: '', loading: false }),
}));
jest.mock('../../utilities/worker/corsProxy.js', () => ({
  ...jest.requireActual('../../utilities/worker/corsProxy.js'),
  getCorsProxyUrlOrThrow: jest.fn(async () => 'https://worker.example'),
}));
jest.mock('../../utilities/audio/realtimeInterviewClient', () => ({ startSessionRealtimeInterview: jest.fn() }));
jest.mock('../../utilities/ai/aiClient.js', () => ({
  ...jest.requireActual('../../utilities/ai/aiClient.js'),
  callAI: jest.fn(),
}));

const A = '0x00000000000000000000000000000000000000a1';
const SESSION_CONFIG = {
  slug: 'edge',
  networkChainId: 11155420,
  corsWorkerUrl: 'https://worker.example',
  __registry: { registryChainId: 11155420, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const field = (value) => ({
  value,
  encrypted: false,
  encryptionAudience: 'self',
  audienceMode: 'explicit',
  hash: '',
  encryptedPortion: '',
});
const saved = (questionID, answer, comment = '') => ({
  questionID,
  type: 'binary',
  prompt: questionID.toUpperCase(),
  answer: field(answer),
  additional: field(comment),
  importance: null,
  conviction: null,
});

const mockSession = (saved) => {
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === 'edge' ? SESSION_CONFIG : null));
  const cache = () => ({
    11155420: {
      questions: Object.fromEntries(['q1', 'q2'].map((id) => [id, { id, type: 'binary', prompt: id.toUpperCase() }])),
      questionResponses: Object.fromEntries(saved.map((row) => [row.questionID, { [A]: JSON.stringify(row) }])),
      questionResponsesMeta: Object.fromEntries(
        saved.map((row) => [row.questionID, { [A]: { ts: 1000, storageRefId: `ref-${row.questionID}` } }]),
      ),
      pendingQuestionMetadata: {},
    },
  });
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (ns) => (ns === 'questionsCache' ? cache() : {}));
  jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((ns) => (ns === 'questionsCache' ? cache() : null));
  jest.spyOn(workerHydration, 'isWorkerCanonicalSessionConfig').mockReturnValue(true);
  // The person's own saved answers, as the Worker lists them.
  const ownRead = jest.spyOn(workerHydration, 'loadWorkerResponses').mockImplementation(async () =>
    saved.map((row) => ({
      questionId: row.questionID,
      responder: A,
      timestamp: 1000,
      storageRefId: `ref-${row.questionID}`,
      response: row,
    })),
  );
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network access'));
  jest.spyOn(surveyQuestionReadsPort, 'getResponse').mockResolvedValue(null);
  jest.spyOn(surveyQuestionReadsPort, 'getSurveyResponse').mockResolvedValue(null);
  return ownRead;
};
const settle = (ms = 600) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
const mountPile = async () => {
  let engine = null;
  const strategy = createPileViewRuntimeStrategy();
  const renderPile = strategy.render;
  strategy.render = (current) => {
    engine = current;
    return renderPile(current);
  };
  const view = renderSurveyPileViewMode({
    minifiedMode: 'pile',
    isStandalone: true,
    surveyIndex: 0,
    network: { id: 11155420 },
    networkChainId: 11155420,
    account: A,
    loginComplete: true,
    provider: { request: jest.fn() },
    cacheHasLoaded: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    questionResponsesNonce: 2,
    questionsCacheNonce: 2,
    onFilterChange: jest.fn(),
    runtimeStrategy: strategy,
    sessionConfig: SESSION_CONFIG,
    sessionSlug: 'edge',
    activeSessionSlug: 'edge',
    toggleLoginModal: jest.fn(),
  });
  await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(2), { timeout: 8000 });
  await settle();
  return { engine: () => engine, view };
};
// The JSON list the prompt gives under its heading.
const earlierAnswersIn = (prompt) => {
  const start = prompt.indexOf('Earlier answers to reconsider:\n');
  expect(start).toBeGreaterThan(-1);
  const list = prompt.slice(start).split('\n')[1];
  return JSON.parse(list).sort((left, right) => left.questionId.localeCompare(right.questionId));
};

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

it('tells a claim’s AI the saved answers it read, and marks an unsent draft restored on load as unsubmitted', async () => {
  const ownRead = mockSession([saved('q1', 'Agree', 'Saved note'), saved('q2', 'Agree')]);
  jest.mocked(callAI).mockResolvedValue(JSON.stringify({ responses: [] }));

  // A change to a submitted answer, typed but not submitted, is kept as a draft that the next page load restores.
  const first = await mountPile();
  // Started in one act and awaited in another, so the pile can commit the edit it waits on.
  let typed;
  await act(async () => {
    typed = new Promise((resolve) => first.engine().handleAnswerPile('q2', 'Disagree', { afterUpdate: resolve }));
  });
  await act(async () => {
    await typed;
  });
  await settle();
  expect(Object.keys(sessionStorage).filter((key) => sessionStorage.getItem(key).includes('Disagree'))).toHaveLength(1);
  first.view.unmount();

  const pile = await mountPile();
  expect(pile.engine().state.surveysResponseState[0].answers.q2.value).toBe('Disagree');
  expect(pile.engine().getChangedQidsAndFields(0).changedMap.q2).toMatchObject({ answer: 1 });

  await act(async () =>
    receiveTranscriptClaim(pile.engine(), {
      sessionSlug: 'edge',
      person: 'Person 2',
      transcript: 'Other person: Do you agree?\nResponder: I still agree, and I disagree with the second one.',
    }),
  );
  await waitFor(() => expect(callAI).toHaveBeenCalledTimes(1), { timeout: 15_000 });

  // The claim waited for the person's own saved answers and merged them into the form, where the restored draft
  // stays in place of the submitted "Agree", and only then drafted.
  expect(ownRead).toHaveBeenCalledWith(expect.objectContaining({ account: A, ownResponses: true }));
  expect(pile.engine().state.surveysResponseState[0].answers.q2.value).toBe('Disagree');
  expect(earlierAnswersIn(jest.mocked(callAI).mock.calls[0][0])).toEqual([
    { questionId: 'q1', answer: 'Agree', additionalComments: 'Saved note' },
    { questionId: 'q2', answer: 'Disagree', unsubmitted: ['answer'] },
  ]);
});
