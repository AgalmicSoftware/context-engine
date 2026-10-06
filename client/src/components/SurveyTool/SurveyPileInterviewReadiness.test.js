import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort';
import * as workerHydration from '../../utilities/survey/workerResponseHydration';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';

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
jest.mock('./sessionInterview', () => {
  const actual = jest.requireActual('./sessionInterview');
  return {
    ...actual,
    hashInterviewQuestions: jest.fn(async () => 'a'.repeat(64)),
    mapInterviewEvidenceToResponses: jest.fn(),
  };
});
jest.mock('../../utilities/worker/corsProxy.js', () => ({
  ...jest.requireActual('../../utilities/worker/corsProxy.js'),
  getCorsProxyUrlOrThrow: jest.fn(async () => 'https://worker.example'),
}));
jest.mock('../../utilities/audio/realtimeInterviewClient', () => ({ startSessionRealtimeInterview: jest.fn() }));

const A = '0x00000000000000000000000000000000000000a1';
const SESSION_CONFIG = {
  slug: 'edge',
  networkChainId: 11155420,
  corsWorkerUrl: 'https://worker.example',
  __registry: { registryChainId: 11155420, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const SAVED_SOURCE = { platform: 'claude', modelId: 'saved-model', verification: 'self_reported' };
const field = (value) => ({
  value,
  encrypted: false,
  encryptionAudience: 'self',
  audienceMode: 'explicit',
  hash: '',
  encryptedPortion: '',
});
const saved = {
  questionID: 'q1',
  type: 'binary',
  prompt: 'Q1',
  answer: field('Agree'),
  additional: field(''),
  importance: null,
  conviction: null,
  responderName: 'Participant A',
  interviewProvenance: {
    version: 1,
    source: SAVED_SOURCE,
    promptVersion: 'ce-interview-brief-v4',
    questionSetHash: 'b'.repeat(64),
    appliedAt: 1,
  },
};
const packet = (responderContext, answer = 'Agree') => ({
  version: 1,
  sessionSlug: 'edge',
  questionSetHash: 'a'.repeat(64),
  promptVersion: 'ce-interview-brief-v5',
  source: { platform: 'claude', modelId: 'new-model', verification: 'self_reported' },
  responderContext,
  responses: [{ questionId: 'q1', answer, confidence: 0.8 }],
});
const mockCaches = () => {
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === 'edge' ? SESSION_CONFIG : null));
  const cache = () => ({
    11155420: {
      questions: { q1: { id: 'q1', type: 'binary', prompt: 'Q1' } },
      questionResponses: { q1: { [A]: JSON.stringify(saved) } },
      questionResponsesMeta: { q1: { [A]: { ts: 1000, storageRefId: 'ref-a' } } },
      pendingQuestionMetadata: {},
    },
  });
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (ns) => (ns === 'questionsCache' ? cache() : {}));
  jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((ns) => (ns === 'questionsCache' ? cache() : null));
};
const ownAnswersLoad = () => {
  jest.spyOn(workerHydration, 'isWorkerCanonicalSessionConfig').mockReturnValue(true);
  return jest
    .spyOn(workerHydration, 'loadWorkerResponses')
    .mockResolvedValue([{ questionId: 'q1', responder: A, timestamp: 1000, storageRefId: 'ref-a', response: saved }]);
};
const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');
const mockSubmit = () => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network access'));
  jest.spyOn(surveyQuestionReadsPort, 'getResponse').mockResolvedValue(null);
  jest.spyOn(surveyQuestionReadsPort, 'getSurveyResponse').mockResolvedValue(null);
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  jest.spyOn(cryptoUtils, 'hashIdentifier').mockImplementation((value) => `hashed:${String(value)}`);
  return jest
    .spyOn(contractScriptsModule.default, 'submitResponses')
    .mockImplementation(async () => ({ hash: '0xabc', wait: async () => ({ status: 1, blockNumber: 42 }) }));
};
const settle = (ms = 600) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
afterEach(() => {
  expect(globalThis.fetch).not.toHaveBeenCalled();
  jest.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

const mount = async ({ ready, account = A, loginComplete = true, toggleLoginModal = jest.fn() }) => {
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
    account,
    loginComplete,
    provider: { request: jest.fn() },
    cacheHasLoaded: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: ready,
    questionResponsesNonce: 2,
    questionsCacheNonce: 2,
    onFilterChange: jest.fn(),
    runtimeStrategy: strategy,
    sessionConfig: SESSION_CONFIG,
    sessionSlug: 'edge',
    activeSessionSlug: 'edge',
    toggleLoginModal,
  });
  await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  return { getEngine: () => engine, view };
};
const openModal = async (getEngine, prefillPacket) => {
  await act(async () =>
    getEngine().setState({
      showVoiceModeModal: true,
      sessionVoiceMode: 'interview',
      interviewPrefillPacket: prefillPacket,
    }),
  );
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  await settle();
};
const selectDraft = () => {
  const replace = screen.queryByText(/Replace with draft|Restore draft/);
  if (replace) fireEvent.click(replace);
};

const prepare = async () => {
  mockCaches();
  const ownLoad = ownAnswersLoad();
  const upload = mockSubmit();
  const pile = await mount({ ready: false });
  await openModal(pile.getEngine, packet({}, 'Disagree'));
  selectDraft();
  return { ...pile, ownLoad, upload };
};
const apply = async () => {
  await act(async () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)));
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

it('submits reviewed own answers while global sync is pending without leaving a stale readiness error', async () => {
  const h = await prepare();
  await apply();
  await waitFor(() => expect(h.upload).toHaveBeenCalledTimes(1));
  expect(h.upload.mock.calls[0][2][0].answer.value).toBe('Disagree');
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Responses submitted');
  expect(screen.queryByText('Loading your saved answers…')).not.toBeInTheDocument();
  await act(async () => h.view.rerenderSurveyQuestions({ isResponsesCacheReady: true, questionResponsesNonce: 3 }));
  await settle();
  expect(h.upload).toHaveBeenCalledTimes(1);
});

it('continues one Apply when the strict own-answer submit read resolves', async () => {
  const h = await prepare();
  const gate = deferred();
  const rows = h.ownLoad.mock.results[0].value;
  const loadsBeforeApply = h.ownLoad.mock.calls.length;
  h.ownLoad.mockImplementationOnce(() => gate.promise);
  await apply();
  expect(h.upload).not.toHaveBeenCalled();
  expect(h.ownLoad).toHaveBeenCalledTimes(loadsBeforeApply + 1);
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Submitting');
  await act(async () => gate.resolve(await rows));
  await waitFor(() => expect(h.upload).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STATUS)).toHaveTextContent('Responses submitted');
});

it('keeps failed own-answer reads closed and clears the error after a successful retry', async () => {
  const h = await prepare();
  h.ownLoad.mockRejectedValueOnce(new Error('Own answers unavailable'));
  await apply();
  expect(h.upload).not.toHaveBeenCalled();
  expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Could not load your saved answers');
  await apply();
  await waitFor(() => expect(h.upload).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it.each([
  ['account', { account: '0x00000000000000000000000000000000000000b2' }],
  [
    'session',
    { sessionSlug: 'other', activeSessionSlug: 'other', sessionConfig: { ...SESSION_CONFIG, slug: 'other' } },
  ],
  ['Worker', { sessionConfig: { ...SESSION_CONFIG, corsWorkerUrl: 'https://other-worker.example' } }],
])('drops an in-flight interview submission after the %s changes', async (_label, changes) => {
  const h = await prepare();
  const gate = deferred();
  const rows = h.ownLoad.mock.results[0].value;
  const loadsBeforeApply = h.ownLoad.mock.calls.length;
  h.ownLoad.mockImplementationOnce(() => gate.promise);
  await apply();
  expect(h.upload).not.toHaveBeenCalled();
  expect(h.ownLoad).toHaveBeenCalledTimes(loadsBeforeApply + 1);
  await act(async () =>
    h.view.rerenderSurveyQuestions({ ...changes, isResponsesCacheReady: true, questionResponsesNonce: 3 }),
  );
  await act(async () => gate.resolve(await rows));
  await settle();
  expect(h.upload).not.toHaveBeenCalled();
});
