import { act, waitFor } from '@testing-library/react';

import { renderSurveyQuestions, renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as savedAnswersLoader from './sessionInterviewSavedAnswers';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { validateNoLockedPlaintextInPayload } from '../../utilities/arweave/noLeakPayloads';

jest.mock('./CreateQuestionsAndSurveys', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('div') };
});
jest.mock('./SessionListeningPanel', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('div') };
});
jest.mock('./SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));

const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');

const OWNER = '0x3333333333333333333333333333333333333333';
const SESSION_CONFIG = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const SURVEY_ID = `0x${'ab'.repeat(32)}`;
const envelope = (tag, recipients = [{ type: 'self-eip712-v1' }]) =>
  JSON.stringify({ v: 1, aad: { context: `0x${'aa'.repeat(32)}` }, recipients, ciphertext: tag });
const E0 = envelope('ciphertext-of-P0'); // what this tab hydrated (stale cache / older version)
const E1 = envelope('ciphertext-of-P1'); // the latest saved version (e.g. submitted from another device)
const E1_ADMIN = envelope('ciphertext-of-P1-admin', [
  { type: 'self-eip712-v1' },
  { type: 'worker-response-field-v1', policy: { audience: 'self_admin' } },
]);
const FRESH = envelope('fresh-ciphertext');
const FRESH_ADMIN = envelope('fresh-ciphertext-admin', [
  { type: 'self-eip712-v1' },
  { type: 'worker-response-field-v1', policy: { audience: 'self_admin' } },
]);
const PLAINTEXT = { [E0]: 'P0 older secret', [E1]: 'P1 newer secret', [E1_ADMIN]: 'P1 newer secret' };

const field = (env, hash, audience = 'self') => ({
  value: '*',
  encrypted: true,
  encryptedPortion: env,
  encryptionAudience: audience,
  audienceMode: 'explicit',
  hash,
});
const plainComment = {
  value: 'old public comment',
  encrypted: false,
  encryptionAudience: 'self',
  audienceMode: 'explicit',
};
const questionResponse = (env, hash, audience) => ({
  questionID: 'q1',
  type: 'freeform',
  prompt: 'Question one',
  answer: field(env, hash, audience),
  additional: { ...plainComment },
  importance: null,
  conviction: null,
});
const surveyResponse = (env, hash, audience) => ({ responses: [questionResponse(env, hash, audience)] });

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

const mockCommon = ({ latestPerQuestion }) => {
  const cache = {
    84532: {
      questions: { q1: { id: 'q1', type: 'freeform', prompt: 'Question one' } },
      questionResponses: {},
      pendingQuestionMetadata: {},
    },
  };
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (ns) => (ns === 'questionsCache' ? cache : {}));
  jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((ns) => (ns === 'questionsCache' ? cache : null));
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === 'edge' ? SESSION_CONFIG : null));
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  jest.spyOn(cryptoUtils, 'hashIdentifier').mockImplementation((value) => `hashed:${String(value)}`);
  // getLatestQuestionResponse (per-question decrypt) reads the network, not the tab cache.
  const getResponse = jest
    .spyOn(surveyQuestionReadsPort, 'getResponse')
    .mockImplementation(async (_p, responder, qid) =>
      String(responder).toLowerCase() === OWNER && String(qid).toLowerCase() === 'q1'
        ? { ...latestPerQuestion, blockNumber: 99, logIndex: 1 }
        : null,
    );
  const decryptSingleField = jest
    .spyOn(cryptoUtils, 'decryptSingleField')
    .mockImplementation(async (slice, qid, selected) => {
      const key = selected === 'additional' ? 'additionalComments' : 'answers';
      const env = slice?.[key]?.[qid]?.encryptedPortion;
      return PLAINTEXT[env]
        ? { answers: {}, additionalComments: {}, [key]: { [qid]: { value: PLAINTEXT[env], zkSalt: '0x01' } } }
        : { answers: {}, additionalComments: {} };
    });
  jest.spyOn(cryptoUtils, 'decryptMultipleAnswers').mockImplementation(async (slice) => {
    const out = { answers: {}, additionalComments: {}, importance: {} };
    for (const [qid, f] of Object.entries(slice?.answers || {})) {
      if (f?.value === '*' && PLAINTEXT[f.encryptedPortion])
        out.answers[qid] = { value: PLAINTEXT[f.encryptedPortion], zkSalt: '0x01' };
    }
    return out;
  });
  const encryptMultipleAnswers = jest
    .spyOn(cryptoUtils, 'encryptMultipleAnswers')
    .mockImplementation(async (slice) => ({
      answers: Object.fromEntries(
        Object.entries(slice.answers || {}).map(([qid, f]) => [
          qid,
          {
            ...f,
            value: '*',
            encrypted: true,
            encryptedPortion: f.encryptionAudience === 'self_admin' ? FRESH_ADMIN : FRESH,
            hash: '0xfresh',
          },
        ]),
      ),
      additionalComments: {},
      importance: {},
    }));
  const submitResponses = jest
    .spyOn(contractScriptsModule.default, 'submitResponses')
    .mockImplementation(async () => ({ hash: '0xabc', wait: async () => ({ status: 1, blockNumber: 42 }) }));
  return { getResponse, decryptSingleField, encryptMultipleAnswers, submitResponses };
};

const mountFull = async ({ hydrate, latest, latestPerQuestion }) => {
  let current = hydrate;
  jest
    .spyOn(surveyQuestionReadsPort, 'getSurveyResponse')
    .mockImplementation(async (_p, responder) => (String(responder).toLowerCase() === OWNER ? current : null));
  const mocks = mockCommon({ latestPerQuestion });
  let engine = null;
  renderSurveyQuestions({
    account: OWNER,
    loginComplete: true,
    provider: { request: async () => null },
    surveyId: SURVEY_ID,
    isQuestionCacheReady: true,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
    toggleLoginModal: () => {},
    sessionConfig: SESSION_CONFIG,
    sessionSlug: 'edge',
    activeSessionSlug: 'edge',
    network: { id: 84532 },
    networkChainId: 84532,
    runtimeStrategy: { render: (e) => ((engine = e), null) },
  });
  await waitFor(() => expect(engine?.state?.surveysResponseState?.[0]?.answers?.q1?.value).toBe('*'));
  await waitFor(() => expect(engine.state.isLoadingResponse).toBe(false));
  current = latest;
  return { engine: () => engine, ...mocks };
};

const run = async (fn) => {
  let promise;
  await act(async () => {
    promise = fn();
  });
  let value;
  await act(async () => {
    value = await promise;
  });
  return value;
};

const submit = async (fn) => {
  let outcome;
  await act(async () => {
    try {
      outcome = await fn();
    } catch (error) {
      outcome = { threw: String(error?.message || error) };
    }
  });
  return outcome;
};

const guard = (uploaded) => {
  try {
    if (uploaded[4])
      validateNoLockedPlaintextInPayload(uploaded[4], { family: 'survey_response_payload', path: 'survey response' });
    (uploaded[2] || []).forEach((r) =>
      validateNoLockedPlaintextInPayload(r, { family: 'question_response_payload', path: 'question response' }),
    );
    return 'passed';
  } catch (error) {
    return `threw: ${error.message}`;
  }
};

const mountPile = async ({ cached, latestPerQuestion }) => {
  const mocks = mockCommon({ latestPerQuestion });
  const cache = () => ({
    84532: {
      questions: { q1: { id: 'q1', type: 'freeform', prompt: 'Question one' } },
      questionResponses: { q1: { [OWNER]: JSON.stringify(cached) } },
      pendingQuestionMetadata: {},
    },
  });
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (ns) => (ns === 'questionsCache' ? cache() : {}));
  jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((ns) => (ns === 'questionsCache' ? cache() : null));
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue(null);
  let engine = null;
  const strategy = createPileViewRuntimeStrategy();
  const renderPile = strategy.render;
  strategy.render = (current) => {
    engine = current;
    return renderPile(current);
  };
  renderSurveyPileViewMode({
    minifiedMode: 'pile',
    network: { id: 84532 },
    networkChainId: 84532,
    account: OWNER,
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
  await act(async () => new Promise((r) => setTimeout(r, 600)));
  return { engine: () => engine, ...mocks };
};

describe.each(['full', 'pile'])('%s own-answer decrypt', (mode) => {
  it.each(['self', 'self_admin'])(
    'keeps the latest %s envelope when resubmitting a decrypted answer',
    async (audience) => {
      const latestEnvelope = audience === 'self_admin' ? E1_ADMIN : E1;
      const latest = questionResponse(latestEnvelope, '0xh1', audience);
      const h =
        mode === 'full'
          ? await mountFull({
              hydrate: surveyResponse(E0, '0xh0'),
              latest: { responses: [latest] },
              latestPerQuestion: latest,
            })
          : await mountPile({ cached: questionResponse(E0, '0xh0'), latestPerQuestion: latest });
      expect(await run(() => h.engine().handleDecryptQuestionAnswer('q1', 'answer'))).toBe(true);
      expect(h.engine().state.submissionError || '').not.toContain('deepClone');
      for (const slice of [h.engine().state.surveysResponseState[0], h.engine().state.editBaseline]) {
        expect(slice.answers.q1).toMatchObject({
          value: 'P1 newer secret',
          encryptedPortion: latestEnvelope,
          hash: '0xh1',
          encryptionAudience: audience,
        });
      }
      await act(async () =>
        mode === 'full'
          ? h.engine().handleAdditional(0, 'q1', 'new public comment')
          : h.engine().handleAdditionalPile('q1', 'new public comment'),
      );
      await submit(() => (mode === 'full' ? h.engine().encryptAndUpload() : h.engine().handlePileSubmitClick()));
      expect(h.engine().state.submissionError).toBeFalsy();
      const uploaded = h.submitResponses.mock.calls[0];
      expect(uploaded).toBeDefined();
      expect(uploaded[2][0].answer).toMatchObject({
        value: '*',
        encryptedPortion: latestEnvelope,
        hash: '0xh1',
        encryptionAudience: audience,
      });
      expect(guard(uploaded)).toBe('passed');
      expect(JSON.stringify(uploaded)).not.toContain('secret');
    },
    40000,
  );
});

describe.each(['full', 'pile'])('%s own-comment decrypt', (mode) => {
  it('keeps the latest encrypted comment and its audience in the editable and saved baseline', async () => {
    const cached = { ...questionResponse(E0, '0xh0'), additional: field(E0, '0xc0') };
    const latest = { ...cached, additional: field(E1_ADMIN, '0xc1', 'self_admin') };
    const h =
      mode === 'full'
        ? await mountFull({
            hydrate: { responses: [cached] },
            latest: { responses: [latest] },
            latestPerQuestion: latest,
          })
        : await mountPile({ cached, latestPerQuestion: latest });
    expect(await run(() => h.engine().handleDecryptQuestionAnswer('q1', 'additional'))).toBe(true);
    for (const slice of [h.engine().state.surveysResponseState[0], h.engine().state.editBaseline]) {
      expect(slice.additionalComments.q1).toMatchObject({
        value: 'P1 newer secret',
        encryptedPortion: E1_ADMIN,
        hash: '0xc1',
        encryptionAudience: 'self_admin',
      });
      expect(slice.answers.q1).toMatchObject({ value: '*', encryptedPortion: E0 });
    }
  }, 40000);
});

it.each([false, true])(
  'resubmits the decrypted rating envelopes (stale tab: %s)',
  async (stale) => {
    const oldImportance = envelope('importance-3');
    const latestImportance = envelope('importance-9');
    const oldConviction = envelope('conviction-2');
    const latestConviction = envelope('conviction-8');
    const latest = {
      ...questionResponse(E1, '0xh1'),
      importanceEncrypted: latestImportance,
      convictionEncrypted: latestConviction,
    };
    const cached = stale
      ? { ...questionResponse(E0, '0xh0'), importanceEncrypted: oldImportance, convictionEncrypted: oldConviction }
      : latest;
    const h = await mountFull({
      hydrate: { responses: [cached] },
      latest: { responses: [latest] },
      latestPerQuestion: latest,
    });
    const ratings = { [oldImportance]: 3, [latestImportance]: 9, [oldConviction]: 2, [latestConviction]: 8 };
    jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockImplementation(async (value) => ratings[value]);
    const encryptRating = jest
      .spyOn(cryptoUtils, 'encryptEnvelopeValue')
      .mockImplementation(async (value) => envelope(`new-rating-${value}`));
    await run(() => h.engine().handleDecryptEdit());
    expect(h.engine().state.surveysResponseState[0]).toMatchObject({ importance: { q1: 9 }, conviction: { q1: 8 } });
    await act(async () => h.engine().handleAdditional(0, 'q1', 'new public comment'));
    await submit(() => h.engine().encryptAndUpload());
    const uploaded = h.submitResponses.mock.calls[0];
    expect(uploaded).toBeDefined();
    const survey = typeof uploaded[4] === 'string' ? JSON.parse(uploaded[4]) : uploaded[4];
    for (const response of [uploaded[2][0], survey.responses[0]]) {
      expect(response.importanceEncrypted).toBe(latestImportance);
      expect(response.convictionEncrypted).toBe(latestConviction);
      expect(response.importance).toBeNull();
      expect(response.conviction).toBeNull();
    }
    expect(encryptRating).not.toHaveBeenCalled();
    expect(guard(uploaded)).toBe('passed');
  },
  40000,
);

const consentSource = { platform: 'claude', modelId: 'example-model', verification: 'self_reported' };
const savedAi = {
  version: 1,
  source: consentSource,
  promptVersion: 'ce-interview-brief-v5',
  questionSetHash: 'a'.repeat(64),
  appliedAt: 1,
};

it.each(['decrypt', 'exit'])(
  'keeps saved consent through full-view %s and a manual edit',
  async (action) => {
    const response = { ...questionResponse(E1, '0xh1'), responderName: 'Participant A', interviewProvenance: savedAi };
    const h = await mountFull({
      hydrate: { responses: [response] },
      latest: { responses: [response] },
      latestPerQuestion: response,
    });
    const consent = h.engine().state.editBaseline.interviewProvenance;
    expect(consent.q1.responderName).toBe('Participant A');
    if (action === 'exit') {
      await run(() => h.engine().handleExitEditing());
      expect(h.engine().state.editBaseline.interviewProvenance).toEqual(consent);
    }
    await run(() => h.engine().handleDecryptEdit());
    expect(h.engine().state.editBaseline.interviewProvenance).toEqual(consent);
    expect(h.engine().state.surveysResponseState[0].interviewProvenance).toBeUndefined();
    await act(async () => h.engine().handleAdditional(0, 'q1', 'new public comment'));
    await submit(() => h.engine().encryptAndUpload());
    const responseUploaded = h.submitResponses.mock.calls[0]?.[2]?.[0];
    expect(responseUploaded?.responderName).toBe('Participant A');
    expect(responseUploaded?.interviewProvenance?.source).toEqual(consentSource);
  },
  40000,
);

it('uses the latest saved withdrawal when decrypting in a stale full view', async () => {
  const cached = {
    ...questionResponse(E0, '0xh0'),
    responderName: 'Participant A',
    interviewProvenance: savedAi,
    timeStamp: 1000,
  };
  const latest = { ...questionResponse(E1, '0xh1'), timeStamp: 2000 };
  const h = await mountFull({
    hydrate: { responses: [cached] },
    latest: { responses: [latest] },
    latestPerQuestion: latest,
  });
  await run(() => h.engine().handleDecryptEdit());
  expect(h.engine().state.editBaseline.interviewProvenance.q1).toEqual({
    responderName: '',
    consentSavedAt: 2000000,
    consentStorageRefId: '',
  });
  await act(async () => h.engine().handleAdditional(0, 'q1', 'new public comment'));
  await submit(() => h.engine().encryptAndUpload());
  const responseUploaded = h.submitResponses.mock.calls[0]?.[2]?.[0];
  expect(responseUploaded).toBeDefined();
  expect(responseUploaded).not.toHaveProperty('responderName');
  expect(responseUploaded).not.toHaveProperty('interviewProvenance');
}, 40000);
