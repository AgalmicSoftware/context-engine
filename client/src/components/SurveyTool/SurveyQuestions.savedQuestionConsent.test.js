import { act, waitFor } from '@testing-library/react';
import { renderSurveyQuestions } from './surveyQuestionsTestHarness';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));

const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');
const ACCOUNT = '0x3333333333333333333333333333333333333333';
const SURVEY_ID = `0x${'ab'.repeat(32)}`;
const SESSION_CONFIG = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const POOL = ['q1', 'q2'].map((id) => ({ id, type: 'freeform', prompt: `Question ${id}` }));
const AI = {
  version: 1,
  source: { platform: 'claude', modelId: 'saved-model', verification: 'self_reported' },
  promptVersion: 'ce-interview-brief-v5',
  questionSetHash: 'a'.repeat(64),
  appliedAt: 1,
};
const plain = (value) => ({ value, encrypted: false, encryptionAudience: 'self', audienceMode: 'explicit', hash: '' });
const ENVELOPE = JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: 'saved-answer' });
const response = (id, named = false) => ({
  questionID: id,
  type: 'freeform',
  prompt: `Question ${id}`,
  answer:
    id === 'q1'
      ? { ...plain('*'), encrypted: true, encryptedPortion: ENVELOPE, hash: '0xhash' }
      : plain(`Answer ${id}`),
  additional: plain('Saved comment'),
  importance: null,
  conviction: null,
  ...(named ? { responderName: 'Participant A', interviewProvenance: AI } : {}),
});
const run = async (fn) => {
  let promise;
  await act(async () => {
    promise = fn();
  });
  await act(async () => promise);
};
const mountFull = async ({ survey = null, records, timestamp = 1700000000 }) => {
  const world = { survey };
  jest.spyOn(surveyQuestionReadsPort, 'getSurveyResponse').mockImplementation(async () => world.survey);
  jest.spyOn(surveyQuestionReadsPort, 'getResponse').mockResolvedValue(null);
  const cache = {
    84532: {
      questions: Object.fromEntries(POOL.map((q) => [q.id, q])),
      questionResponses: Object.fromEntries(records.map((r) => [r.questionID, { [ACCOUNT]: JSON.stringify(r) }])),
      questionResponsesMeta: Object.fromEntries(
        records.map((r) => [r.questionID, { [ACCOUNT]: { ts: timestamp, storageRefId: `saved-${r.questionID}` } }]),
      ),
      pendingQuestionMetadata: {},
    },
  };
  jest
    .spyOn(cacheScripts, 'readCache')
    .mockImplementation(async (namespace) => (namespace === 'questionsCache' ? cache : {}));
  jest
    .spyOn(cacheScripts, 'peekCacheSync')
    .mockImplementation((namespace) => (namespace === 'questionsCache' ? cache : null));
  jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(SESSION_CONFIG);
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  jest.spyOn(cryptoUtils, 'hashIdentifier').mockImplementation((value) => `hashed:${value}`);
  const decrypt = jest.spyOn(cryptoUtils, 'decryptMultipleAnswers').mockResolvedValue({
    answers: { q1: { value: 'Answer q1', zkSalt: '0x01' } },
    additionalComments: {},
    importance: {},
  });
  jest.spyOn(cryptoUtils, 'encryptMultipleAnswers').mockImplementation(async (slice) => ({
    answers: Object.fromEntries(
      Object.entries(slice.answers || {}).map(([id, field]) => [
        id,
        { ...field, value: '*', encrypted: true, encryptedPortion: ENVELOPE, hash: '0xhash' },
      ]),
    ),
    additionalComments: {},
    importance: {},
  }));
  const submitResponses = jest.spyOn(contractScriptsModule.default, 'submitResponses').mockResolvedValue({
    hash: '0xabc',
    wait: async () => ({ status: 1, blockNumber: 42 }),
  });
  let engine;
  const view = renderSurveyQuestions({
    account: ACCOUNT,
    loginComplete: true,
    provider: { request: async () => null },
    surveyId: SURVEY_ID,
    surveyIndex: 0,
    questionPool: POOL,
    surveys: [{ id: SURVEY_ID, surveyID: SURVEY_ID, questionIDs: ['q1', 'q2'], title: 'Survey' }],
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    toggleLoginModal: jest.fn(),
    sessionConfig: SESSION_CONFIG,
    sessionSlug: 'edge',
    activeSessionSlug: 'edge',
    network: { id: 84532 },
    networkChainId: 84532,
    runtimeStrategy: {
      render: (current) => {
        engine = current;
        return null;
      },
    },
  });
  await waitFor(() => expect(engine?.state.surveysResponseState?.[0]?.answers?.q1?.value).toBeDefined());
  await waitFor(() => expect(engine.state.isLoadingResponse).toBe(false));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
  return { getEngine: () => engine, world, view, submitResponses, decrypt };
};
const uploadComment = async (h, qid, comment) => {
  await act(async () => h.getEngine().handleAdditional(0, qid, comment));
  await run(() => h.getEngine().encryptAndUpload());
  return h.submitResponses.mock.calls.at(-1)?.[2]?.find((r) => r.questionID === qid);
};

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

it.each(['none', 'exit', 'decrypt'])(
  'keeps a per-question withdrawal after the full-view %s transition',
  async (transition) => {
    const h = await mountFull({
      survey: { responses: [response('q1', true)], timeStamp: 1700000000000 },
      records: [response('q1'), response('q2')],
      timestamp: 1700000500,
    });
    if (transition === 'exit') await run(() => h.getEngine().handleExitEditing());
    if (transition !== 'none') await run(() => h.getEngine().handleDecryptEdit());
    if (transition !== 'none') expect(h.decrypt).toHaveBeenCalledTimes(1);
    const uploaded = await uploadComment(h, 'q1', 'Updated comment');
    expect(uploaded).toBeDefined();
    expect(uploaded).not.toHaveProperty('responderName');
    expect(uploaded).not.toHaveProperty('interviewProvenance');
  },
);

it('honors a later pile withdrawal after a full-view submit saved the earlier name', async () => {
  const first = await mountFull({ records: [response('q1', true), response('q2')] });
  const firstUpload = await uploadComment(first, 'q1', 'First visit comment');
  expect(firstUpload.responderName).toBe('Participant A');
  const survey = first.submitResponses.mock.calls[0][4];
  first.view.unmount();
  jest.restoreAllMocks();
  const second = await mountFull({ survey, records: [response('q1'), response('q2')], timestamp: 1700000500 });
  const secondUpload = await uploadComment(second, 'q1', 'Second visit comment');
  expect(secondUpload).toBeDefined();
  expect(secondUpload).not.toHaveProperty('responderName');
  expect(secondUpload).not.toHaveProperty('interviewProvenance');
});

it('preserves consent and its timestamp for an unsubmitted question across editing transitions', async () => {
  const h = await mountFull({ records: [response('q1', true), response('q2', true)] });
  const q2Consent = h.getEngine().state.editBaseline.interviewProvenance.q2;
  await uploadComment(h, 'q1', 'First question edit');
  h.world.survey = h.submitResponses.mock.calls[0][4];
  expect(h.world.survey.responses.map((r) => r.questionID)).toEqual(['q1']);
  await run(() => h.getEngine().handleExitEditing());
  expect(h.getEngine().state.editBaseline.interviewProvenance.q2).toEqual(q2Consent);
  await run(() => h.getEngine().handleDecryptEdit());
  expect(h.decrypt).toHaveBeenCalledTimes(1);
  const uploaded = await uploadComment(h, 'q2', 'Second question edit');
  expect(uploaded.responderName).toBe('Participant A');
  expect(uploaded.interviewProvenance.source).toEqual(AI.source);
});
