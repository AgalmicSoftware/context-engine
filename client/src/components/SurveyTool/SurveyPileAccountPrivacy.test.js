// Account transitions must never save decrypted owner fields under the next identity.
import { act, waitFor } from '@testing-library/react';
import * as savedAnswersLoader from './sessionInterviewSavedAnswers';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';

jest.mock('./CreateQuestionsAndSurveys', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('div') };
});
jest.mock('./SessionListeningPanel', () => {
  const React = require('react');
  return { __esModule: true, default: () => React.createElement('div') };
});
jest.mock('./SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));

const ACCOUNT = '0x00000000000000000000000000000000000000a1';
const SESSION_CONFIG = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const SOURCE = { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' };
const PACKET = { promptVersion: 'ce-interview-brief-v5', questionSetHash: 'a'.repeat(64) };

// What the uploaded (saved) version looks like: buildResponsePayload output with name + AI attribution.
const savedResponse = (overrides = {}) => ({
  questionID: 'q1',
  type: 'binary',
  prompt: 'Q1',
  answer: {
    value: 'Agree',
    encrypted: false,
    encryptionAudience: 'self',
    audienceMode: 'explicit',
    hash: '',
    encryptedPortion: '',
  },
  additional: {
    value: '',
    encrypted: false,
    encryptionAudience: 'self',
    audienceMode: 'explicit',
    hash: '',
    encryptedPortion: '',
  },
  importance: null,
  conviction: null,
  responderName: 'Participant A',
  interviewProvenance: {
    version: 1,
    source: { ...SOURCE },
    promptVersion: PACKET.promptVersion,
    questionSetHash: PACKET.questionSetHash,
    appliedAt: 1,
  },
  ...overrides,
});

const mockCaches = (response = savedResponse(), extraQuestions = {}) => {
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === 'edge' ? SESSION_CONFIG : null));
  const cache = () => ({
    84532: {
      questions: { q1: { id: 'q1', type: 'binary', prompt: 'Q1' }, ...extraQuestions },
      questionResponses: { q1: { [ACCOUNT]: JSON.stringify(response) } },
      pendingQuestionMetadata: {},
    },
  });
  jest
    .spyOn(cacheScripts, 'readCache')
    .mockImplementation(async (namespace) => (namespace === 'questionsCache' ? cache() : {}));
  jest
    .spyOn(cacheScripts, 'peekCacheSync')
    .mockImplementation((namespace) => (namespace === 'questionsCache' ? cache() : null));
};

const mountPile = (overrides = {}) => {
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
    ...overrides,
  });
  return { view, getEngine: () => engine };
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

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
  });

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

const OTHER = '0x00000000000000000000000000000000000000b2';
const PLAINTEXT = 'Pile-decrypted owner secret';
const encryptedSaved = () =>
  savedResponse({
    responderName: undefined,
    interviewProvenance: undefined,
    answer: {
      value: '*',
      encrypted: true,
      encryptionAudience: 'self',
      audienceMode: 'explicit',
      hash: '0xhash-answer',
      encryptedPortion: JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: 'answer-ct' }),
    },
  });

it.each([
  ['sign-out', { account: '', loginComplete: false }, ':anon:'],
  ['direct switch to another account', { account: OTHER, loginComplete: true }, `:${OTHER}:`],
])(
  'pile mode, %s after "Decrypt": the owner plaintext must not land in the next identity draft',
  async (_label, next, keyPart) => {
    const { buildSelfQuestionDecryptSuccessState } = require('./surveyToolDecryptFlow');
    mockCaches(encryptedSaved());
    jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue(null);
    const pile = mountPile();
    await waitFor(() => expect(pile.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
    await settle();
    const engine = pile.getEngine();
    await run(
      () =>
        new Promise((resolve) =>
          engine.setState(
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
                (v) => JSON.parse(JSON.stringify(v)),
              ),
            resolve,
          ),
        ),
    );
    expect(pile.getEngine().state.surveysResponseState[0].answers.q1.value).toBe(PLAINTEXT);
    await act(async () => {
      pile.view.rerenderSurveyQuestions(next);
    });
    await settle();
    const drafts = Object.keys(sessionStorage)
      .filter((k) => k.startsWith('dg:surveyDraft:'))
      .map((k) => [k, sessionStorage.getItem(k)]);
    pile.view.unmount();
    const fresh = mountPile(next);
    await waitFor(() => expect(fresh.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
    await settle();
    const leaked = drafts.filter(([k, v]) => k.includes(keyPart) && String(v).includes(PLAINTEXT));
    expect(leaked).toEqual([]);
  },
  40000,
);
