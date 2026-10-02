// Saved consent displayed by the real pile interview and submitted through its callbacks.
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import * as savedAnswersLoader from './sessionInterviewSavedAnswers';
import * as workerHydration from '../../utilities/survey/workerResponseHydration';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { createPileViewRuntimeStrategy, recordInterviewProvenance } from './SurveyPileViewMode';
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
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
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
const savedNamedAi = {
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
    84532: {
      questions: { q1: { id: 'q1', type: 'binary', prompt: 'Q1' } },
      questionResponses: { q1: { [A]: JSON.stringify(savedNamedAi) } },
      questionResponsesMeta: { q1: { [A]: { ts: 1000, storageRefId: 'ref-a' } } },
      pendingQuestionMetadata: {},
    },
  });
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (ns) => (ns === 'questionsCache' ? cache() : {}));
  jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((ns) => (ns === 'questionsCache' ? cache() : null));
};
const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');
const mockSubmit = () => {
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

const mountPileEngine = async () => {
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
    network: { id: 84532 },
    networkChainId: 84532,
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
  });
  await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  return Object.assign(() => engine, { view });
};

const renderModal = async (getEngine, prefillPacket) => {
  await act(async () =>
    getEngine().setState({
      showVoiceModeModal: true,
      sessionVoiceMode: 'interview',
      interviewPrefillPacket: prefillPacket,
    }),
  );
};

const consentControls = () => {
  fireEvent.click(screen.getByText('AI submission info'));
  const name = screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME);
  const ai = screen.queryByLabelText(/Include platform\/model provenance/i);
  return {
    nameShown: !!name,
    nameChecked: name ? name.checked : null,
    nameAria: name ? name.getAttribute('aria-checked') : null,
    nameLabel: name ? name.closest('label')?.textContent : null,
    aiShown: !!ai,
    aiChecked: ai ? ai.checked : null,
    aiAria: ai ? ai.getAttribute('aria-checked') : null,
  };
};
const selectDraft = () => {
  // A draft for an answered question starts deselected; "Replace with draft" selects it.
  const replace = screen.queryByText(/Replace with draft|Restore draft/);
  if (replace) fireEvent.click(replace);
};
const submitAndCapture = async (submitResponses) => {
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
  await waitFor(() => expect(submitResponses).toHaveBeenCalled(), { timeout: 8000 });
  await settle();
  return submitResponses.mock.calls[0][2][0];
};

it('shows the saved name when own answers load', async () => {
  mockCaches();
  jest.spyOn(workerHydration, 'isWorkerCanonicalSessionConfig').mockReturnValue(true);
  jest
    .spyOn(workerHydration, 'loadWorkerResponses')
    .mockResolvedValue([
      { questionId: 'q1', responder: A, timestamp: 1000, storageRefId: 'ref-a', response: savedNamedAi },
    ]);
  const submitResponses = mockSubmit();
  const getEngine = await mountPileEngine();
  await renderModal(getEngine, packet({}, 'Disagree'));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  await settle();
  selectDraft();
  const controls = consentControls();
  const uploaded = await submitAndCapture(submitResponses);
  expect(controls.nameShown && controls.nameChecked).toBe(true);
  expect(uploaded.responderName).toBe('Participant A');
  expect(uploaded.interviewProvenance).toMatchObject({
    source: { modelId: 'new-model' },
    promptVersion: 'ce-interview-brief-v5',
    questionSetHash: 'a'.repeat(64),
  });
}, 40000);

it('shows saved consent from the pile baseline when own-answer loading is unavailable', async () => {
  mockCaches();
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue(null);
  const submitResponses = mockSubmit();
  const getEngine = await mountPileEngine();
  await renderModal(getEngine, packet({}, 'Disagree'));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  await settle();
  selectDraft();
  const controls = consentControls();
  const uploaded = await submitAndCapture(submitResponses);
  // A name may only be submitted when the modal shows a ticked (or mixed) name control.
  expect(controls.nameShown && controls.nameChecked).toBe(true);
  expect(uploaded.responderName).toBe('Participant A');
  expect(uploaded.interviewProvenance).toMatchObject({
    source: { modelId: 'new-model' },
    promptVersion: 'ce-interview-brief-v5',
    questionSetHash: 'a'.repeat(64),
  });
}, 40000);

it('preserves the saved name choice when the packet names a different participant', async () => {
  mockCaches();
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue(null);
  const submitResponses = mockSubmit();
  const getEngine = await mountPileEngine();
  await renderModal(getEngine, packet({ name: 'Fixture Responder' }, 'Disagree'));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  await settle();
  selectDraft();
  const controls = consentControls();
  const uploaded = await submitAndCapture(submitResponses);
  expect(controls.nameChecked).toBe(true);
  expect(uploaded.responderName).toBe('Participant A');
  expect(uploaded.interviewProvenance).toMatchObject({
    source: { modelId: 'new-model' },
    promptVersion: 'ce-interview-brief-v5',
    questionSetHash: 'a'.repeat(64),
  });
}, 40000);

const mockOwnAnswerListing = (available) => {
  if (!available) {
    jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue(null);
    return;
  }
  jest.spyOn(workerHydration, 'isWorkerCanonicalSessionConfig').mockReturnValue(true);
  jest
    .spyOn(workerHydration, 'loadWorkerResponses')
    .mockResolvedValue([
      { questionId: 'q1', responder: A, timestamp: 1000, storageRefId: 'ref-a', response: savedNamedAi },
    ]);
};
const openReplacementDraft = async (getEngine, answer) => {
  await renderModal(getEngine, packet({}, answer));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  await settle();
  selectDraft();
  consentControls();
};

it.each([
  [false, 'name', false],
  [true, 'name', false],
  [false, 'AI attribution', false],
  [true, 'AI attribution', false],
  [false, 'name', true],
  [true, 'AI attribution', true],
])(
  'keeps a pending withdrawal with own listing %s for %s after a rejected apply (reload: %s)',
  async (listingAvailable, choice, reload) => {
    mockCaches();
    mockOwnAnswerListing(listingAvailable);
    const submitResponses = mockSubmit();
    let getEngine = await mountPileEngine();
    await openReplacementDraft(getEngine, 'Disagree');
    const checkbox =
      choice === 'name'
        ? screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME)
        : screen.getByLabelText(/Include platform\/model provenance/i);
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    submitResponses.mockRejectedValueOnce(new Error('User rejected the request.'));
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(submitResponses).toHaveBeenCalledTimes(1));
    await settle();
    if (reload) {
      getEngine.view.unmount();
      getEngine = await mountPileEngine();
    } else {
      await act(async () => getEngine().closeSessionVoiceModeModal());
      await settle(300);
    }
    await openReplacementDraft(getEngine, 'Unsure');
    if (choice === 'name') {
      expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME)).not.toBeInTheDocument();
    } else {
      expect(screen.getByLabelText(/Include platform\/model provenance/i)).not.toBeChecked();
    }
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY));
    await waitFor(() => expect(submitResponses).toHaveBeenCalledTimes(2));
    await settle();
    const uploaded = submitResponses.mock.calls[1][2][0];
    expect(uploaded.answer.value).toBe('Unsure');
    if (choice === 'name') {
      expect(uploaded).not.toHaveProperty('responderName');
      expect(uploaded.interviewProvenance).toMatchObject({
        source: { modelId: 'new-model' },
        promptVersion: 'ce-interview-brief-v5',
        questionSetHash: 'a'.repeat(64),
      });
    } else {
      expect(uploaded).not.toHaveProperty('interviewProvenance');
      expect(uploaded.responderName).toBe('Participant A');
    }
  },
  40000,
);

it.each([false, true])(
  'uses a directly recorded pending withdrawal with own listing %s',
  async (available) => {
    mockCaches();
    mockOwnAnswerListing(available);
    const submitResponses = mockSubmit();
    const getEngine = await mountPileEngine();
    let recorded;
    await act(async () => {
      recorded = recordInterviewProvenance(
        getEngine(),
        [{ questionId: 'q1', answer: 'Agree' }],
        SAVED_SOURCE,
        packet({}),
        false,
        false,
        '',
        [],
        { includeAiProvenance: false, includeResponderName: false },
      );
    });
    await act(async () => recorded);
    await openReplacementDraft(getEngine, 'Disagree');
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Include platform\/model provenance/i)).not.toBeChecked();
    const uploaded = await submitAndCapture(submitResponses);
    expect(uploaded).not.toHaveProperty('responderName');
    expect(uploaded).not.toHaveProperty('interviewProvenance');
  },
  40000,
);
