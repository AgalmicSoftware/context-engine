import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { renderSurveyQuestions, renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as savedAnswersLoader from './sessionInterviewSavedAnswers';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';

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
const SLUG = 'edge';
const NET = 84532;
const SESSION_CONFIG = {
  slug: SLUG,
  networkChainId: NET,
  __registry: { registryChainId: NET, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const SURVEY_ID = `0x${'ab'.repeat(32)}`;
const envelope = (tag, recipients = [{ type: 'self-eip712-v1' }]) =>
  JSON.stringify({ v: 1, aad: { context: `0x${'aa'.repeat(32)}` }, recipients, ciphertext: tag });
const ADMIN = [{ type: 'self-eip712-v1' }, { type: 'worker-response-field-v1', policy: { audience: 'self_admin' } }];
const E0 = envelope('ct-P0');
const E1 = envelope('ct-P1');
const E0_ADMIN = envelope('ct-P0-admin', ADMIN);
const E1_ADMIN = envelope('ct-P1-admin', ADMIN);
const C0 = envelope('ct-C0');
const C1 = envelope('ct-C1');
const C1_ADMIN = envelope('ct-C1-admin', ADMIN);
const FRESH = envelope('fresh');
const FRESH_ADMIN = envelope('fresh-admin', ADMIN);
const PLAINTEXT = {
  [E0]: 'P0 older secret',
  [E1]: 'P1 newer secret',
  [E0_ADMIN]: 'P0 older secret',
  [E1_ADMIN]: 'P1 newer secret',
  [C0]: 'C0 older secret comment',
  [C1]: 'C1 newer secret comment',
  [C1_ADMIN]: 'C1 newer secret comment',
};
const I0 = envelope('imp-3');
const I1 = envelope('imp-9');
const V0 = envelope('conv-2');
const V1 = envelope('conv-8');
const RATINGS = { [I0]: 3, [I1]: 9, [V0]: 2, [V1]: 8 };
const field = (env, hash, audience = 'self', extra = {}) => ({
  value: '*',
  encrypted: true,
  encryptedPortion: env,
  encryptionAudience: audience,
  encryptionGateId: null,
  audienceMode: 'explicit',
  hash,
  ...extra,
});
const plainComment = (value = 'old public comment') => ({
  value,
  encrypted: false,
  encryptionAudience: 'self',
  encryptionGateId: null,
  audienceMode: 'explicit',
  hash: '',
  encryptedPortion: '',
});
const qResponse = ({ env, hash, audience = 'self', additional = plainComment(), imp = '', conv = '' }) => ({
  questionID: 'q1',
  type: 'freeform',
  prompt: 'Question one',
  answer: field(env, hash, audience),
  additional,
  importance: null,
  conviction: null,
  ...(imp ? { importanceEncrypted: imp } : {}),
  ...(conv ? { convictionEncrypted: conv } : {}),
});

const seedCaches = async ({ cachedOwnerResponse = null } = {}) => {
  await cacheScripts.writeCache('questionsCache', SLUG, {
    [NET]: {
      questionsLatestBlock: 0,
      questions: { q1: { id: 'q1', type: 'freeform', prompt: 'Question one', sessionName: SLUG } },
      questionResponses: cachedOwnerResponse ? { q1: { [OWNER]: JSON.stringify(cachedOwnerResponse) } } : {},
      questionResponsesLatestBlock: 0,
      pendingQuestionMetadata: {},
    },
  });
  await cacheScripts.writeCache('surveysCache', SLUG, {
    [NET]: {
      surveysLatestBlock: 0,
      surveys: { [SURVEY_ID]: { id: SURVEY_ID, surveyID: SURVEY_ID, questionIDs: ['q1'], sessionName: SLUG } },
      surveyResponses: {},
      surveyResponsesLatestBlock: {},
    },
  });
};

afterEach(async () => {
  jest.restoreAllMocks();
  await cacheScripts.removeCache('questionsCache', SLUG);
  await cacheScripts.removeCache('surveysCache', SLUG);
  sessionStorage.clear();
  localStorage.clear();
});

const mockCommon = ({ latestPerQuestion, decryptGate = null, receiptBlock = 120 }) => {
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === SLUG ? SESSION_CONFIG : null));
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  jest.spyOn(cryptoUtils, 'hashIdentifier').mockImplementation((value) => `hashed:${String(value)}`);
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
      if (decryptGate) await decryptGate.promise;
      const out = { answers: {}, additionalComments: {}, importance: {} };
      if (selected === 'answer' || selected === 'both') {
        const f = slice?.answers?.[qid];
        if (f?.value === '*' && PLAINTEXT[f.encryptedPortion])
          out.answers[qid] = { value: PLAINTEXT[f.encryptedPortion], zkSalt: '0x01' };
      }
      if (selected === 'additional' || selected === 'both') {
        const f = slice?.additionalComments?.[qid];
        if (f?.value === '*' && PLAINTEXT[f.encryptedPortion])
          out.additionalComments[qid] = { value: PLAINTEXT[f.encryptedPortion], zkSalt: '0x02' };
      }
      return out;
    });
  const decryptMultipleAnswers = jest.spyOn(cryptoUtils, 'decryptMultipleAnswers').mockImplementation(async (slice) => {
    const out = { answers: {}, additionalComments: {}, importance: {} };
    for (const [qid, f] of Object.entries(slice?.answers || {})) {
      if (f?.value === '*' && PLAINTEXT[f.encryptedPortion])
        out.answers[qid] = { value: PLAINTEXT[f.encryptedPortion], zkSalt: '0x01' };
    }
    for (const [qid, f] of Object.entries(slice?.additionalComments || {})) {
      if (f?.value === '*' && PLAINTEXT[f.encryptedPortion])
        out.additionalComments[qid] = { value: PLAINTEXT[f.encryptedPortion], zkSalt: '0x02' };
    }
    return out;
  });
  const decryptEnvelopeValue = jest
    .spyOn(cryptoUtils, 'decryptEnvelopeValue')
    .mockImplementation(async (value) => (value in RATINGS ? RATINGS[value] : null));
  const encryptEnvelopeValue = jest
    .spyOn(cryptoUtils, 'encryptEnvelopeValue')
    .mockImplementation(async (value) => envelope(`fresh-rating-${value}`));
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
      additionalComments: Object.fromEntries(
        Object.entries(slice.additionalComments || {}).map(([qid, f]) => [
          qid,
          {
            ...f,
            value: '*',
            encrypted: true,
            encryptedPortion: f.encryptionAudience === 'self_admin' ? FRESH_ADMIN : FRESH,
            hash: '0xfreshc',
          },
        ]),
      ),
      importance: {},
    }));
  const submitResponses = jest
    .spyOn(contractScriptsModule.default, 'submitResponses')
    .mockImplementation(async () => ({ hash: '0xabc', wait: async () => ({ status: 1, blockNumber: receiptBlock }) }));
  return {
    getResponse,
    decryptSingleField,
    decryptMultipleAnswers,
    decryptEnvelopeValue,
    encryptEnvelopeValue,
    encryptMultipleAnswers,
    submitResponses,
  };
};

// Keep the runtime and rendered controls real; isolate only transport and crypto.
const mountFull = async ({ hydrate, latest, latestPerQuestion, decryptGate = null, dom = true }) => {
  await seedCaches();
  let current = hydrate;
  jest
    .spyOn(surveyQuestionReadsPort, 'getSurveyResponse')
    .mockImplementation(async (_p, responder) => (String(responder).toLowerCase() === OWNER ? current : null));
  const mocks = mockCommon({ latestPerQuestion, decryptGate });
  let engine = null;
  const view = renderSurveyQuestions({
    account: OWNER,
    loginComplete: true,
    provider: { request: async () => null },
    surveyId: SURVEY_ID,
    isQuestionCacheReady: true,
    questionPool: [{ id: 'q1', type: 'freeform', prompt: 'Question one' }],
    toggleLoginModal: () => {},
    sessionConfig: SESSION_CONFIG,
    sessionSlug: SLUG,
    activeSessionSlug: SLUG,
    network: { id: NET },
    networkChainId: NET,
    runtimeStrategy: {
      render: (e) => {
        engine = e;
        return dom ? e.renderDefaultSurveyQuestionsRoute() : null;
      },
    },
  });
  await waitFor(() => expect(engine?.state?.surveysResponseState?.[0]?.answers?.q1?.value).toBe('*'), {
    timeout: 8000,
  });
  await waitFor(() => expect(engine.state.isLoadingResponse).toBe(false));
  await act(async () => new Promise((r) => setTimeout(r, 200)));
  current = latest;
  return { engine: () => engine, view, ...mocks };
};

const mountPile = async ({ cached, latestPerQuestion, decryptGate = null }) => {
  await seedCaches({ cachedOwnerResponse: cached });
  const mocks = mockCommon({ latestPerQuestion, decryptGate });
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue(null);
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
    network: { id: NET },
    networkChainId: NET,
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
    sessionSlug: SLUG,
    activeSessionSlug: SLUG,
  });
  await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await act(async () => new Promise((r) => setTimeout(r, 600)));
  return { engine: () => engine, view, ...mocks };
};

describe('rendered field decrypt controls', () => {
  it.each(['pile answer', 'pile comment', 'full editing answer', 'full display answer'])(
    'decrypts the owner field from the %s button',
    async (mode) => {
      const comment = mode === 'pile comment';
      const response = qResponse({ env: E1, hash: '0xh1', additional: field(C1, '0xc1') });
      const h = mode.startsWith('pile')
        ? await mountPile({ cached: response, latestPerQuestion: response })
        : await mountFull({
            hydrate: { responses: [response] },
            latest: { responses: [response] },
            latestPerQuestion: response,
          });
      if (comment) await act(async () => h.engine().toggleComments('q1'));
      if (mode === 'full editing answer')
        await act(async () => h.engine().setState({ isEditing: true, displayAnswerMode: false }));
      const button = await screen.findByRole('button', { name: comment ? 'Decrypt Comments' : 'Decrypt Answer' });
      fireEvent.click(button);
      await waitFor(() =>
        expect(h.engine().state.surveysResponseState[0][comment ? 'additionalComments' : 'answers'].q1.value).toBe(
          comment ? 'C1 newer secret comment' : 'P1 newer secret',
        ),
      );
      expect(h.decryptSingleField).toHaveBeenCalledWith(
        expect.anything(),
        'q1',
        comment ? 'additional' : 'answer',
        expect.anything(),
      );
      expect(h.engine().state.submissionError || '').toBe('');
    },
    15000,
  );
});

const mountMode = (mode, cached, latest, decryptGate = null) =>
  mode === 'pile'
    ? mountPile({ cached, latestPerQuestion: latest, decryptGate })
    : mountFull({
        hydrate: { responses: [cached] },
        latest: { responses: [latest] },
        latestPerQuestion: latest,
        decryptGate,
      });

it.each(['full', 'pile'].flatMap((mode) => ['before', 'during'].map((timing) => [mode, timing])))(
  'keeps a narrower audience chosen %s/%s decrypt through the encrypted upload',
  async (mode, timing) => {
    let release;
    const gate = {
      promise: new Promise((resolve) => {
        release = resolve;
      }),
    };
    const response = qResponse({ env: E1_ADMIN, hash: '0xh1', audience: 'self_admin' });
    const h = await mountMode(mode, response, response, timing === 'during' ? gate : null);
    let pending;
    if (timing === 'during') {
      await act(async () => {
        pending = h.engine().handleDecryptQuestionAnswer('q1', 'answer');
      });
      await waitFor(() => expect(h.decryptSingleField).toHaveBeenCalled());
    }
    await act(async () => h.engine().applyAnswerEncryptionAudience(0, 'q1', 'self'));
    await act(async () => {
      if (pending) {
        release();
        await pending;
      } else await h.engine().handleDecryptQuestionAnswer('q1', 'answer');
    });
    expect(h.engine().state.surveysResponseState[0].answers.q1.encryptionAudience).toBe('self');
    expect(h.engine().state.editBaseline.answers.q1.encryptionAudience).toBe('self_admin');
    await act(async () => h.engine().handleAdditional(0, 'q1', 'Updated public comment'));
    await act(async () => (mode === 'pile' ? h.engine().handlePileSubmitClick() : h.engine().encryptAndUpload()));
    expect(h.submitResponses).toHaveBeenCalledTimes(1);
    const uploaded = h.submitResponses.mock.calls[0][2][0].answer;
    expect(uploaded).toMatchObject({ value: '*', encryptionAudience: 'self', encryptedPortion: FRESH });
    expect(JSON.parse(uploaded.encryptedPortion).recipients).toEqual([{ type: 'self-eip712-v1' }]);
  },
  15000,
);

it.each(['full', 'pile'])('updates an unchanged stale audience in %s', async (mode) => {
  const cached = qResponse({ env: E0_ADMIN, hash: '0xh0', audience: 'self_admin' });
  const latest = qResponse({ env: E1, hash: '0xh1' });
  const h = await mountMode(mode, cached, latest);
  await act(async () => h.engine().handleDecryptQuestionAnswer('q1', 'answer'));
  expect(h.engine().state.surveysResponseState[0].answers.q1.encryptionAudience).toBe('self');
  expect(h.engine().state.editBaseline.answers.q1.encryptionAudience).toBe('self');
});

it.each(['full', 'pile'].flatMap((mode) => [true, false].map((stale) => [mode, stale])))(
  'resubmits the rating envelopes decrypted by the %s button (stale=%s)',
  async (mode, stale) => {
    const latest = qResponse({ env: E1, hash: '0xh1', imp: I1, conv: V1 });
    const cached = stale ? qResponse({ env: E0, hash: '0xh0', imp: I0, conv: V0 }) : latest;
    const h = await mountMode(mode, cached, latest);
    fireEvent.click(await screen.findByRole('button', { name: 'Decrypt Answer' }));
    await waitFor(() => expect(h.engine().state.surveysResponseState[0].importance.q1).toBe(9));
    expect(h.engine().state.surveysResponseState[0].conviction.q1).toBe(8);
    await act(async () => h.engine().handleAdditional(0, 'q1', 'Updated public comment'));
    await act(async () => (mode === 'pile' ? h.engine().handlePileSubmitClick() : h.engine().encryptAndUpload()));
    expect(h.submitResponses).toHaveBeenCalledTimes(1);
    expect(h.submitResponses.mock.calls[0][2][0]).toMatchObject({
      importance: null,
      conviction: null,
      importanceEncrypted: I1,
      convictionEncrypted: V1,
    });
    expect(h.encryptEnvelopeValue).not.toHaveBeenCalled();
  },
  15000,
);
