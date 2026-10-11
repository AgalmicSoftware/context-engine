// Interview drafts and the pile share one response slice. These tests drive the real
// pile and interview modal to check that drafts only reach the pile for an upload.
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
const packet = (responses) => ({
  version: 1,
  sessionSlug: 'edge',
  questionSetHash: 'a'.repeat(64),
  promptVersion: 'ce-interview-brief-v5',
  source: { platform: 'claude', modelId: 'new-model', verification: 'self_reported' },
  responderContext: {},
  responses,
});
const field = (value) => ({
  value,
  encrypted: false,
  encryptionAudience: 'self',
  audienceMode: 'explicit',
  hash: '',
  encryptedPortion: '',
});
const savedNamedQ1 = {
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
    source: { platform: 'claude', modelId: 'saved-model', verification: 'self_reported' },
    promptVersion: 'ce-interview-brief-v4',
    questionSetHash: 'b'.repeat(64),
    appliedAt: 1,
  },
};
const mockSession = (saved = []) => {
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === 'edge' ? SESSION_CONFIG : null));
  const cache = () => ({
    11155420: {
      questions: {
        q1: { id: 'q1', type: 'binary', prompt: 'Q1' },
        q3: { id: 'q3', type: 'binary', prompt: 'Q3' },
      },
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
  jest.spyOn(workerHydration, 'loadWorkerResponses').mockResolvedValue(
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
  const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  jest.spyOn(cryptoUtils, 'hashIdentifier').mockImplementation((value) => `hashed:${String(value)}`);
  return jest
    .spyOn(contractScriptsModule.default, 'submitResponses')
    .mockImplementation(async () => ({ hash: '0xabc', wait: async () => ({ status: 1, blockNumber: 42 }) }));
};
const settle = (ms = 600) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

// `edit` runs on the pile before the interview opens; drafts arrive after the own-answer read.
const mountWithInterview = async (prefill, edit = null) => {
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
  if (edit) await run(() => edit(engine));
  await act(async () => engine.setState({ showVoiceModeModal: true, sessionVoiceMode: 'interview' }));
  await settle();
  await act(async () => engine.setState({ interviewPrefillPacket: prefill }));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  await settle();
  return { engine: () => engine, view };
};
const run = async (fn) => {
  let promise;
  await act(async () => {
    promise = fn();
  });
  await act(async () => {
    await promise;
  });
};
const typeInPile = (fields) => (engine) =>
  Object.entries(fields).reduce(
    (previous, [key, value]) =>
      previous.then(
        () =>
          new Promise((resolve) =>
            key === 'answer'
              ? engine.handleAnswerPile('q1', value, { afterUpdate: resolve })
              : engine.handleAdditionalPile('q1', value, { afterUpdate: resolve }),
          ),
      ),
    Promise.resolve(),
  );
const submitDrafts = async () => {
  await act(async () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)));
  await settle();
};
const draftText = () =>
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith('dg:surveyDraft:'))
    .map((key) => sessionStorage.getItem(key))
    .join('\n');
const uploadedRows = (upload, call) => upload.mock.calls[call][2].map((row) => [row.questionID, row.answer?.value]);

it('does not upload a draft removed after a failed interview submit', async () => {
  const upload = mockSession();
  upload.mockRejectedValueOnce(new Error('User rejected the request.'));
  const pile = await mountWithInterview(
    packet([
      { questionId: 'q1', answer: 'Agree', confidence: 0.8 },
      { questionId: 'q3', answer: 'Disagree', confidence: 0.8 },
    ]),
  );

  await submitDrafts();
  expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('User rejected the request.');
  // The failed upload leaves nothing from the interview pending in the pile.
  expect(pile.engine().getPendingEditStats().total).toBe(0);
  expect(pile.engine().state.surveysResponseState[0].answers?.q3?.value ?? '').toBe('');
  // Nor in stored drafts, which a page reload would restore.
  expect(draftText()).not.toMatch(/Agree|Disagree/);

  fireEvent.click(screen.getByRole('button', { name: 'Remove draft for Q3' }));
  await submitDrafts();

  expect(upload).toHaveBeenCalledTimes(2);
  expect(uploadedRows(upload, 1)).toEqual([['q1', 'Agree']]);
  expect(pile.engine().getPendingEditStats().total).toBe(0);
});

it('keeps an unsaved pile comment when the AI proposes no comment', async () => {
  const upload = mockSession();
  await mountWithInterview(
    packet([{ questionId: 'q1', answer: 'Agree', confidence: 0.8 }]),
    typeInPile({ comment: 'My unsaved note' }),
  );
  // Review shows the pending comment and selects the draft for the unanswered question.
  expect(screen.getByText('My unsaved note')).toBeInTheDocument();

  await submitDrafts();

  expect(upload).toHaveBeenCalledTimes(1);
  const [row] = upload.mock.calls[0][2];
  expect(row.answer.value).toBe('Agree');
  expect(row.additional.value).toBe('My unsaved note');
});

it('treats an unsaved pile answer as existing, so its draft is not preselected', async () => {
  const upload = mockSession();
  await mountWithInterview(
    packet([{ questionId: 'q1', answer: 'Agree', confidence: 0.8 }]),
    typeInPile({ answer: 'Disagree' }),
  );

  expect(screen.getByRole('button', { name: 'Replace with draft' })).toBeEnabled();
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)).toBeDisabled();
  expect(upload).not.toHaveBeenCalled();
});

it('names every submitted response once the saved name box is ticked', async () => {
  const upload = mockSession([savedNamedQ1]);
  await mountWithInterview(
    packet([
      { questionId: 'q1', answer: 'Disagree', confidence: 0.8 },
      { questionId: 'q3', answer: 'Agree', confidence: 0.8 },
    ]),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Replace with draft' }));
  fireEvent.click(screen.getByText('AI submission info'));
  const name = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME);
  expect(name).toHaveAttribute('aria-checked', 'mixed');
  fireEvent.click(name);
  expect(name.closest('label')).toHaveTextContent(
    'Include “Participant A” as the responder name with submitted responses',
  );

  await submitDrafts();

  expect(upload).toHaveBeenCalledTimes(1);
  expect(upload.mock.calls[0][2].map((row) => [row.questionID, row.responderName]).sort()).toEqual([
    ['q1', 'Participant A'],
    ['q3', 'Participant A'],
  ]);
});
