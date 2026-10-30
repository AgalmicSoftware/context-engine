// Interview drafts and the pile share one response slice. These tests drive the real
// pile and interview modal to check that drafts only reach the pile for an upload.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort';
import * as workerHydration from '../../utilities/survey/workerResponseHydration';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { startSessionRealtimeInterview } from '../../utilities/audio/realtimeInterviewClient';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { mapInterviewEvidenceToResponses } from './sessionInterview';
import * as savedAnswersLoader from './sessionInterviewSavedAnswers';
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
let sessionConfig = SESSION_CONFIG;
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
const DEFAULT_QUESTION_IDS = ['q1', 'q3'];
let questionIds = DEFAULT_QUESTION_IDS;
// The interview leaves out drafts for answered questions, so a draft for a saved answer is
// reviewed only when the person edits it before that answer loads. With `late`, neither the
// response cache nor the own-answer read returns the saved rows until answerBeforeSavedAnswersLoad().
let savedLoaded = true;
let releaseOwnRead = () => {};
let ownRead = Promise.resolve();
const mockSession = (saved = [], { late = false } = {}) => {
  savedLoaded = !late;
  ownRead = late
    ? new Promise((resolve) => {
        releaseOwnRead = resolve;
      })
    : Promise.resolve();
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === 'edge' ? sessionConfig : null));
  const known = () => (savedLoaded ? saved : []);
  const cache = () => ({
    11155420: {
      questions: Object.fromEntries(questionIds.map((id) => [id, { id, type: 'binary', prompt: id.toUpperCase() }])),
      questionResponses: Object.fromEntries(known().map((row) => [row.questionID, { [A]: JSON.stringify(row) }])),
      questionResponsesMeta: Object.fromEntries(
        known().map((row) => [row.questionID, { [A]: { ts: 1000, storageRefId: `ref-${row.questionID}` } }]),
      ),
      pendingQuestionMetadata: {},
    },
  });
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (ns) => (ns === 'questionsCache' ? cache() : {}));
  jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((ns) => (ns === 'questionsCache' ? cache() : null));
  jest.spyOn(workerHydration, 'isWorkerCanonicalSessionConfig').mockReturnValue(true);
  jest.spyOn(workerHydration, 'loadWorkerResponses').mockImplementation(async () => {
    await ownRead;
    return saved.map((row) => ({
      questionId: row.questionID,
      responder: A,
      timestamp: 1000,
      storageRefId: `ref-${row.questionID}`,
      response: row,
    }));
  });
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
  questionIds = DEFAULT_QUESTION_IDS;
  sessionConfig = SESSION_CONFIG;
  savedLoaded = true;
  ownRead = Promise.resolve();
  jest.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

// `edit` runs on the pile before the interview opens; drafts arrive after the own-answer read.
// Without a prefill the pile mounts without opening the interview.
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
    sessionConfig,
    sessionSlug: 'edge',
    activeSessionSlug: 'edge',
    toggleLoginModal: jest.fn(),
  });
  await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(questionIds.length), { timeout: 8000 });
  await settle();
  if (edit) await run(() => edit(engine));
  if (!prefill) return { engine: () => engine, view };
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
// The person changes the AI's drafts before their saved answers load, so the drafts stay in review,
// chosen, each saying which saved answer it changes.
const answerBeforeSavedAnswersLoad = async (answers) => {
  for (const [questionId, answer] of Object.entries(answers)) {
    const card = screen
      .getAllByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT)
      .find((element) => element.dataset.ceQuestionId === questionId);
    fireEvent.click(within(card).getByRole('radio', { name: answer }));
  }
  savedLoaded = true;
  await act(async () => releaseOwnRead());
  await settle();
};
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
const draftIds = () =>
  screen.getAllByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT).map((card) => card.getAttribute('data-ce-question-id'));
const openInterview = async (pile) => {
  await act(async () => pile.engine().setState({ showVoiceModeModal: true, sessionVoiceMode: 'interview' }));
  await settle();
};
// One voice round whose mapper returns these drafts; resolves to the interviewer's instructions.
const speak = async (drafts) => {
  const transcript = 'Responder: Here is what I think now.';
  let instructions = '';
  jest.mocked(mapInterviewEvidenceToResponses).mockResolvedValue(drafts);
  jest.mocked(startSessionRealtimeInterview).mockImplementation(async (options) => {
    instructions = options.instructions;
    options.onRecordingState?.('recording');
    options.onTranscript?.(transcript, []);
    return {
      mediaStream: {},
      stop: jest.fn(async () => ({ transcript, turns: [] })),
      pause: jest.fn(),
      resume: jest.fn(),
      getTranscript: () => transcript,
    };
  });
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_START));
  await screen.findByLabelText('Pause interview');
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_STOP));
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  await settle();
  return instructions;
};
const savedQ1 = { ...savedNamedQ1, responderName: undefined, interviewProvenance: undefined };

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

it('treats an unsaved pile answer as answered, so the interview leaves its draft out', async () => {
  const upload = mockSession();
  const pile = await mountWithInterview(
    packet([
      { questionId: 'q1', answer: 'Agree', confidence: 0.8 },
      { questionId: 'q3', answer: 'Agree', confidence: 0.8 },
    ]),
    typeInPile({ answer: 'Disagree' }),
  );

  expect(screen.getAllByTestId(E2E_TESTIDS.SESSION_INTERVIEW_DRAFT).map((card) => card.dataset.ceQuestionId)).toEqual([
    'q3',
  ]);
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
    'Left out 1 draft for a question you’ve already answered.',
  );
  await submitDrafts();
  // Only the selected interview draft is uploaded; the page answer stays pending.
  expect(uploadedRows(upload, 0)).toEqual([['q3', 'Agree']]);
  expect(pile.engine().state.surveysResponseState[0].answers.q1.value).toBe('Disagree');
  expect(pile.engine().getPendingEditStats().total).toBe(1);
  expect(screen.getByText("1 answer on the page isn't submitted yet.")).toBeInTheDocument();
  expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)).toBeEnabled();
  await act(async () => {
    await pile.engine().handlePileSubmitClick();
  });
  expect(uploadedRows(upload, 1)).toEqual([['q1', 'Disagree']]);
  expect(pile.engine().getPendingEditStats().total).toBe(0);
  expect(screen.queryByText(/answer.*on the page.*submitted yet/)).not.toBeInTheDocument();
});

it('names every submitted response once the saved name box is ticked', async () => {
  const upload = mockSession([savedNamedQ1], { late: true });
  await mountWithInterview(
    packet([
      { questionId: 'q1', answer: 'Unsure', confidence: 0.8 },
      { questionId: 'q3', answer: 'Agree', confidence: 0.8 },
    ]),
  );
  await answerBeforeSavedAnswersLoad({ q1: 'Disagree' });
  expect(screen.getByText('Changes your earlier answer: Agree')).toBeInTheDocument();
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

it('undoes a rejected draft but keeps its name withdrawal for the next pile Submit', async () => {
  const upload = mockSession([savedNamedQ1], { late: true });
  upload.mockRejectedValueOnce(new Error('User rejected the request.'));
  const pile = await mountWithInterview(packet([{ questionId: 'q1', answer: 'Unsure', confidence: 0.8 }]));
  await answerBeforeSavedAnswersLoad({ q1: 'Disagree' });
  expect(screen.getByText('Changes your earlier answer: Agree')).toBeInTheDocument();
  fireEvent.click(screen.getByText('AI submission info'));
  const name = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME);
  expect(name).toBeChecked();
  fireEvent.click(name);

  await submitDrafts();
  await act(async () => pile.engine().closeSessionVoiceModeModal());
  await settle(300);

  const slice = pile.engine().state.surveysResponseState[0];
  // The draft answer is undone; the withdrawal stays and is the only pending change.
  expect(slice.answers.q1.value).toBe('Agree');
  expect(slice.interviewProvenance.q1).not.toHaveProperty('responderName');
  expect(Array.from(pile.engine().getChangedQidsAndFields(0).changedQids)).toEqual(['q1']);

  await act(async () => {
    await pile.engine().handlePileSubmitClick();
  });
  await settle();
  const [row] = upload.mock.calls.at(-1)[2];
  expect(row.answer.value).toBe('Agree');
  expect(row).not.toHaveProperty('responderName');
});

it('keeps a saved comment that loads during a rejected interview upload', async () => {
  const saved = { ...savedNamedQ1, responderName: undefined, interviewProvenance: undefined };
  const upload = mockSession([saved], { late: true });
  upload.mockRejectedValueOnce(new Error('User rejected the request.'));
  const pile = await mountWithInterview(packet([{ questionId: 'q1', answer: 'Unsure', confidence: 0.8 }]));
  await answerBeforeSavedAnswersLoad({ q1: 'Disagree' });
  expect(screen.getByText('Changes your earlier answer: Agree')).toBeInTheDocument();
  // Another device saves a comment while this upload waits for its own-answer read.
  const newer = { ...saved, additional: field('Note from another device') };
  workerHydration.loadWorkerResponses.mockResolvedValue([
    { questionId: 'q1', responder: A, timestamp: 2000, storageRefId: 'ref-q1-b', response: newer },
  ]);
  await act(async () => pile.view.rerenderSurveyQuestions({ isResponsesCacheReady: false }));

  await submitDrafts();

  const slice = pile.engine().state.surveysResponseState[0];
  expect(slice.answers.q1.value).toBe('Agree');
  expect(slice.additionalComments.q1.value).toBe('Note from another device');
  expect(pile.engine().getPendingEditStats().total).toBe(0);
});

it('keeps omitted saved fields after the pile resets to another window during interview review', async () => {
  questionIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
  const upload = mockSession([{ ...savedNamedQ1, additional: field('Keep this saved comment'), importance: 7 }], {
    late: true,
  });
  const pile = await mountWithInterview(packet([{ questionId: 'q1', answer: 'Unsure', confidence: 0.8 }]));
  await answerBeforeSavedAnswersLoad({ q1: 'Disagree' });
  expect(screen.getByText('Changes your earlier answer: Agree')).toBeInTheDocument();

  // Rebuilding a different card window leaves the reviewed question outside the form.
  await act(async () => pile.engine().setState({ activePileIndex: 7 }));
  await run(() => new Promise((resolve) => pile.engine().initializeResponseState(resolve)));
  expect(pile.engine().state.surveysResponseState[0].additionalComments.q1?.value ?? '').toBe('');
  expect(pile.engine().props.isResponsesCacheReady).toBe(true);

  await submitDrafts();

  expect(upload).toHaveBeenCalledTimes(1);
  const [row] = upload.mock.calls[0][2];
  expect(row.answer.value).toBe('Disagree');
  expect(row.additional.value).toBe('Keep this saved comment');
  expect(row.importance).toBe(7);
});

it.each(['', 'My edited comment'])(
  'keeps an explicit comment edit %j when an imported question needs hydration',
  async (comment) => {
    // A saved comment on a question without an answer, so its draft is offered.
    const upload = mockSession([{ ...savedNamedQ1, answer: field(''), additional: field('Saved comment') }]);
    const pile = await mountWithInterview(
      packet([{ questionId: 'q1', answer: 'Disagree', confidence: 0.8 }]),
      typeInPile({ comment }),
    );
    pile.engine()._savedAnswersLoadedQids.clear();

    await submitDrafts();

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][2][0].additional.value).toBe(comment);
  },
);

it('keeps a withdrawal from a rejected interview upload through Clear changes', async () => {
  const upload = mockSession([savedNamedQ1], { late: true });
  upload.mockRejectedValueOnce(new Error('User rejected the request.'));
  const pile = await mountWithInterview(packet([{ questionId: 'q1', answer: 'Unsure', confidence: 0.8 }]));
  await answerBeforeSavedAnswersLoad({ q1: 'Disagree' });
  expect(screen.getByText('Changes your earlier answer: Agree')).toBeInTheDocument();
  fireEvent.click(screen.getByText('AI submission info'));
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME));
  await submitDrafts();
  await act(async () => pile.engine().closeSessionVoiceModeModal());
  await settle(300);
  await act(async () => pile.engine().handleAnswerPile('q3', 'Agree'));
  await settle(300);
  expect(pile.engine().getPendingEditStats().total).toBe(2);

  await act(async () => pile.engine().handleRevertPendingChanges());
  await settle(300);

  const slice = pile.engine().state.surveysResponseState[0];
  expect(slice.answers.q3?.value ?? '').toBe('');
  expect(slice.interviewProvenance.q1).not.toHaveProperty('responderName');
  expect(Array.from(pile.engine().getChangedQidsAndFields(0).changedQids)).toEqual(['q1']);
  expect(draftText()).toContain('"includeAiProvenance":true');
  await act(async () => {
    await pile.engine().handlePileSubmitClick();
  });
  await settle();
  const [row] = upload.mock.calls.at(-1)[2];
  expect(row.answer.value).toBe('Agree');
  expect(row).not.toHaveProperty('responderName');
});

it('stores every kept withdrawal on Clear changes, not only the cards near the current one', async () => {
  questionIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
  const upload = mockSession(
    questionIds.map((id) => ({ ...savedNamedQ1, questionID: id, prompt: id.toUpperCase() })),
    { late: true },
  );
  upload.mockRejectedValueOnce(new Error('User rejected the request.'));
  const pile = await mountWithInterview(
    packet(questionIds.map((questionId) => ({ questionId, answer: 'Unsure', confidence: 0.8 }))),
  );
  await answerBeforeSavedAnswersLoad(Object.fromEntries(questionIds.map((id) => [id, 'Disagree'])));
  expect(screen.getAllByText('Changes your earlier answer: Agree')).toHaveLength(questionIds.length);
  fireEvent.click(screen.getByText('AI submission info'));
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME));
  await submitDrafts();
  await act(async () => pile.engine().closeSessionVoiceModeModal());
  await settle(300);

  await act(async () => pile.engine().handleRevertPendingChanges());
  await settle(300);
  expect(pile.engine().getPendingEditStats().total).toBe(questionIds.length);

  // The pile shows only a few cards around the current one, but every withdrawal is stored,
  // and a reload keeps them all; each comes back as its card comes into view.
  const storedWithdrawals = () =>
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith('dg:surveyDraft:'))
      .flatMap((key) =>
        Object.entries(JSON.parse(sessionStorage.getItem(key)).answers || {})
          .filter(([, entry]) => entry?.interviewProvenance && !('responderName' in entry.interviewProvenance))
          .map(([id]) => id),
      )
      .sort();
  expect(storedWithdrawals()).toEqual(questionIds);
  pile.view.unmount();
  const reloaded = await mountWithInterview(null);
  await act(async () => reloaded.engine().handleAnswerPile('q1', 'Agree'));
  await settle(300);
  expect(storedWithdrawals()).toEqual(questionIds);
}, 40000);

it('makes every stored withdrawal pending after a reload, and uploads them all', async () => {
  questionIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
  const upload = mockSession(
    questionIds.map((id) => ({ ...savedNamedQ1, questionID: id, prompt: id.toUpperCase() })),
    { late: true },
  );
  upload.mockRejectedValueOnce(new Error('User rejected the request.'));
  const pile = await mountWithInterview(
    packet(questionIds.map((questionId) => ({ questionId, answer: 'Unsure', confidence: 0.8 }))),
  );
  await answerBeforeSavedAnswersLoad(Object.fromEntries(questionIds.map((id) => [id, 'Disagree'])));
  expect(screen.getAllByText('Changes your earlier answer: Agree')).toHaveLength(questionIds.length);
  fireEvent.click(screen.getByText('AI submission info'));
  fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_NAME));
  await submitDrafts();
  await act(async () => pile.engine().closeSessionVoiceModeModal());
  await settle(300);
  await act(async () => pile.engine().handleRevertPendingChanges());
  await settle(300);
  pile.view.unmount();

  // The reloaded pile shows a few cards around the first one, but all eight withdrawals are pending.
  const reloaded = await mountWithInterview(null);
  expect(reloaded.engine().getPendingEditStats().total).toBe(questionIds.length);
  await act(async () => {
    await reloaded.engine().handlePileSubmitClick();
  });
  await settle();
  const rows = upload.mock.calls.at(-1)[2];
  expect(rows.map((row) => row.questionID).sort()).toEqual(questionIds);
  rows.forEach((row) => {
    expect(row.answer.value).toBe('Agree');
    expect(row).not.toHaveProperty('responderName');
  });
}, 60000);

it('loads a card that scrolls into view after a Submit, before a rating-only change uploads it', async () => {
  questionIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
  const saved = (id) => ({
    ...savedNamedQ1,
    questionID: id,
    prompt: id.toUpperCase(),
    additional: field(id === 'q5' ? 'Saved comment q5' : ''),
  });
  const upload = mockSession(questionIds.map(saved));
  const pile = await mountWithInterview(null);
  await act(async () => pile.engine().handleAnswerPile('q1', 'Disagree'));
  await settle(300);
  await act(async () => {
    await pile.engine().handlePileSubmitClick();
  });
  await settle();
  expect(pile.engine().state.submissionComplete).toBe(true);
  for (let step = 0; step < 4; step += 1) {
    await act(async () => pile.engine().handleNext());
    await settle(250);
  }
  const slice = pile.engine().state.surveysResponseState[0];
  expect(slice.answers.q5).toMatchObject({ value: 'Agree' });
  expect(slice.additionalComments.q5).toMatchObject({ value: 'Saved comment q5' });
  await act(async () => pile.engine().handleImportance(0, 'q5', 7));
  await settle(400);
  await act(async () => {
    await pile.engine().handlePileSubmitClick();
  });
  await settle();
  const [row] = upload.mock.calls.at(-1)[2];
  expect(row).toMatchObject({
    questionID: 'q5',
    answer: { value: 'Agree' },
    additional: { value: 'Saved comment q5' },
  });
  expect(row.importance).toBe(7);
}, 60000);

it('leaves out an AI draft for an answer saved outside the card window when the Worker lists no own answers', async () => {
  questionIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
  const upload = mockSession([savedQ1]);
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue(null);
  const pile = await mountWithInterview(
    packet([
      { questionId: 'q1', answer: 'Disagree', confidence: 0.8 },
      { questionId: 'q2', answer: 'Agree', confidence: 0.8 },
    ]),
  );
  // The pile puts answered questions last, so q1's saved answer sits outside its card window.
  expect(pile.engine().state.surveysResponseState[0].answers.q1).toBeUndefined();
  expect(draftIds()).toEqual(['q2']);
  expect(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_MAPPING_NOTICE)).toHaveTextContent(
    'Left out 1 draft for a question you’ve already answered.',
  );

  await submitDrafts();

  expect(uploadedRows(upload, 0)).toEqual([['q2', 'Agree']]);
}, 40000);

it('reads answers saved outside a rebuilt card window for the voice interviewer, its drafts and the upload', async () => {
  questionIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'];
  const upload = mockSession([savedQ1, { ...savedQ1, questionID: 'q2', prompt: 'Q2' }]);
  const pile = await mountWithInterview(null);
  await openInterview(pile);
  // Moving the card window drops the saved answers the interview loaded from the form.
  await act(async () => pile.engine().setState({ activePileIndex: 3 }));
  await run(() => new Promise((resolve) => pile.engine().initializeResponseState(resolve)));
  const form = pile.engine().state.surveysResponseState[0].answers;
  expect([form.q1?.value ?? '', form.q2?.value ?? '']).toEqual(['', '']);

  const instructions = await speak([
    { questionId: 'q1', answer: 'Agree', confidence: 0.9 },
    { questionId: 'q2', answer: 'Disagree', confidence: 0.9 },
    { questionId: 'q3', answer: 'Agree', confidence: 0.9 },
  ]);

  expect(instructions).toContain('[q3]');
  expect(instructions).not.toContain('[q1]');
  expect(instructions).not.toContain('[q2]');
  // Repeating the saved q1 adds nothing; the new q2 answer says what it changes.
  expect(draftIds()).toEqual(['q2', 'q3']);
  expect(screen.getByText('Changes your earlier answer: Agree')).toBeInTheDocument();
  await submitDrafts();
  expect(uploadedRows(upload, 0).sort()).toEqual([
    ['q2', 'Disagree'],
    ['q3', 'Agree'],
  ]);
}, 40000);

it.each([
  ['full', ['q3']],
  ['minimal', undefined],
])(
  'records a voice draft that changes a saved answer as shown, and a dismissed one only at %s detail',
  async (researchDetail, unselected) => {
    sessionConfig = { ...SESSION_CONFIG, interviewMode: { researchDetail, shareDraftChangesByDefault: true } };
    const upload = mockSession([savedQ1, { ...savedQ1, questionID: 'q3', prompt: 'Q3' }]);
    const pile = await mountWithInterview(null);
    await openInterview(pile);
    await speak([
      { questionId: 'q1', answer: 'Disagree', confidence: 0.9 },
      { questionId: 'q3', answer: 'Disagree', confidence: 0.9 },
    ]);
    expect(screen.getAllByText('Changes your earlier answer: Agree')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Remove draft for Q3' }));
    // The earlier answer kept its own research choice, so sharing this one is an explicit choice.
    const sharing = screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_INCLUDE_PREDICTION_COMPARISON);
    expect(sharing).not.toBeChecked();
    fireEvent.click(sharing);

    await submitDrafts();

    const rows = upload.mock.calls[0][2];
    expect(rows.map((row) => [row.questionID, row.answer.value])).toEqual([['q1', 'Disagree']]);
    expect(rows[0].interviewProvenance).toMatchObject({ predictionCondition: 'shown', draftOrigin: 'voice_interview' });
    expect(rows[0].interviewProvenance.unselectedPredictions?.map((entry) => entry.questionId)).toEqual(unselected);
  },
  40000,
);
