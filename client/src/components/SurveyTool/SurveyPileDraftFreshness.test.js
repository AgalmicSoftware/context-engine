// Drafts hold only a responder's unsaved edits, so a reload never resurrects an
// older saved answer or decrypted plaintext over what storage now holds.
import { act, waitFor } from '@testing-library/react';
import * as savedAnswersLoader from './sessionInterviewSavedAnswers';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));

const ACCOUNT = '0x00000000000000000000000000000000000000a1';
const SESSION_CONFIG = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const PLAINTEXT = 'Only-me saved secret';
const ENVELOPE = JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: 'answer-ct' });

const field = (value, extra = {}) => ({
  value,
  encrypted: false,
  encryptionAudience: 'self',
  audienceMode: 'explicit',
  hash: '',
  encryptedPortion: '',
  ...extra,
});
let saved = {};
const savedRow = (qid) => ({
  questionID: qid,
  type: 'binary',
  prompt: qid,
  answer: saved[qid].answer,
  additional: saved[qid].additional || field(''),
  importance: null,
  conviction: null,
});

const mockCaches = () => {
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === 'edge' ? SESSION_CONFIG : null));
  const cache = () => ({
    84532: {
      questions: Object.fromEntries(['q1', 'q2', 'q3'].map((id) => [id, { id, type: 'binary', prompt: id }])),
      questionResponses: Object.fromEntries(
        Object.keys(saved).map((qid) => [qid, { [ACCOUNT]: JSON.stringify(savedRow(qid)) }]),
      ),
      pendingQuestionMetadata: {},
    },
  });
  jest
    .spyOn(cacheScripts, 'readCache')
    .mockImplementation(async (namespace) => (namespace === 'questionsCache' ? cache() : {}));
  jest
    .spyOn(cacheScripts, 'peekCacheSync')
    .mockImplementation((namespace) => (namespace === 'questionsCache' ? cache() : null));
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue(null);
};

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
    network: { id: 84532 },
    networkChainId: 84532,
    account: ACCOUNT,
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
    isStandalone: true,
  });
  await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(3), { timeout: 8000 });
  await settle();
  return { view, engine: () => engine };
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

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
  });

const draftText = () =>
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith('dg:surveyDraft:'))
    .map((key) => sessionStorage.getItem(key))
    .join('\n');

beforeEach(() => {
  saved = { q1: { answer: field('Agree') }, q2: { answer: field('Agree') }, q3: { answer: field('Agree') } };
});

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

it('keeps newer saved answers for questions the draft never edited', async () => {
  mockCaches();
  const tabA = await mountPile();
  await run(() => new Promise((resolve) => tabA.engine().handleAnswerPile('q1', 'Disagree', { afterUpdate: resolve })));
  await settle();
  tabA.view.unmount();

  // Another device changes q2, which this tab never edited.
  saved.q2 = { answer: field('Disagree') };
  const reloaded = await mountPile();
  const slice = reloaded.engine().state.surveysResponseState[0];

  expect(slice.answers.q1.value).toBe('Disagree');
  expect(slice.answers.q2.value).toBe('Disagree');
  expect(reloaded.engine().state.editBaseline.answers.q2.value).toBe('Disagree');
  expect(Array.from(reloaded.engine().getChangedQidsAndFields(0).changedQids)).toEqual(['q1']);
});

it('keeps a comment draft when only the saved answer changed elsewhere', async () => {
  mockCaches();
  const tabA = await mountPile();
  await run(
    () =>
      new Promise((resolve) => tabA.engine().handleAdditionalPile('q1', 'Note from tab A', { afterUpdate: resolve })),
  );
  await settle();
  tabA.view.unmount();

  saved.q1 = { answer: field('Disagree') };
  const reloaded = await mountPile();
  const slice = reloaded.engine().state.surveysResponseState[0];

  expect(slice.answers.q1.value).toBe('Disagree');
  expect(slice.additionalComments.q1.value).toBe('Note from tab A');
  expect(Array.from(reloaded.engine().getChangedQidsAndFields(0).changedQids)).toEqual(['q1']);
});

it('drops a comment draft when the saved comment changed elsewhere', async () => {
  mockCaches();
  const tabA = await mountPile();
  await run(
    () =>
      new Promise((resolve) => tabA.engine().handleAdditionalPile('q1', 'Note from tab A', { afterUpdate: resolve })),
  );
  await settle();
  tabA.view.unmount();

  saved.q1 = { answer: field('Agree'), additional: field('Note from another device') };
  const reloaded = await mountPile();
  const slice = reloaded.engine().state.surveysResponseState[0];

  expect(slice.additionalComments.q1.value).toBe('Note from another device');
  expect(reloaded.engine().getPendingEditStats().total).toBe(0);
});

it('never writes the plaintext of a decrypted saved answer into drafts', async () => {
  const { buildSelfQuestionDecryptSuccessState } = require('./surveyToolDecryptFlow');
  saved.q1 = { answer: field('*', { encrypted: true, hash: '0xhash', encryptedPortion: ENVELOPE }) };
  mockCaches();
  const pile = await mountPile();
  await run(
    () =>
      new Promise((resolve) =>
        pile.engine().setState(
          (prev) =>
            buildSelfQuestionDecryptSuccessState(
              prev,
              {
                surveyIndex: 0,
                questionId: 'q1',
                clearMode: 'both',
                didUpdate: true,
                baselineSlice: prev.editBaseline,
                decryptedStateSlice: { answers: { q1: { value: PLAINTEXT } }, additionalComments: {} },
              },
              (value) => JSON.parse(JSON.stringify(value)),
            ),
          resolve,
        ),
      ),
  );
  expect(pile.engine().state.surveysResponseState[0].answers.q1.value).toBe(PLAINTEXT);

  // A later edit elsewhere persists the draft; the decrypted answer is not an edit.
  await run(() => new Promise((resolve) => pile.engine().handleAnswerPile('q2', 'Disagree', { afterUpdate: resolve })));
  await act(async () => pile.engine().persistDraft());

  expect(draftText()).toContain('Disagree');
  expect(draftText()).not.toContain(PLAINTEXT);
});

it('drops an older draft after the saved answer is cleared elsewhere', async () => {
  mockCaches();
  const tabA = await mountPile();
  await run(() => new Promise((resolve) => tabA.engine().handleAnswerPile('q1', 'Disagree', { afterUpdate: resolve })));
  await settle();
  tabA.view.unmount();
  saved.q1 = { answer: field('') };
  const reloaded = await mountPile();
  expect(reloaded.engine().state.surveysResponseState[0].answers.q1.value).toBe('');
  expect(reloaded.engine().getPendingEditStats().total).toBe(0);
});
