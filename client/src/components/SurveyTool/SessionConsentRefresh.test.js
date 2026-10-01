// Saved consent refresh and ordinary-edit coverage through the pile engine.
import { act, waitFor } from '@testing-library/react';
import * as savedAnswersLoader from './sessionInterviewSavedAnswers';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import {
  createPileViewRuntimeStrategy,
  loadSessionInterviewOwnAnswers,
  recordInterviewProvenance,
  submitSessionInterviewResponses,
} from './SurveyPileViewMode';
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

const A = '0x00000000000000000000000000000000000000a1';
const SESSION_CONFIG = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const SOURCE = { platform: 'claude', modelId: 'claude-example', verification: 'self_reported' };
const PACKET = { promptVersion: 'ce-interview-brief-v5', questionSetHash: 'a'.repeat(64) };
const field = (value) => ({
  value,
  encrypted: false,
  encryptionAudience: 'self',
  audienceMode: 'explicit',
  hash: '',
  encryptedPortion: '',
});
const aiProvenance = (appliedAt = 1) => ({
  version: 1,
  source: { ...SOURCE },
  promptVersion: PACKET.promptVersion,
  questionSetHash: PACKET.questionSetHash,
  appliedAt,
});
const saved = (qid, overrides = {}) => ({
  questionID: qid,
  type: 'binary',
  prompt: qid.toUpperCase(),
  answer: field('Agree'),
  additional: field(''),
  importance: null,
  conviction: null,
  ...overrides,
});

// Mutable public cache: { qid: { account: response } }
let cached = {};
let questions = {};
const setCache = (next, qs = { q1: { id: 'q1', type: 'binary', prompt: 'Q1' } }) => {
  cached = next;
  questions = qs;
};
const mockCaches = () => {
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === 'edge' ? SESSION_CONFIG : null));
  const cache = () => ({
    84532: {
      questions,
      questionResponses: Object.fromEntries(
        Object.entries(cached).map(([qid, byAccount]) => [
          qid,
          Object.fromEntries(Object.entries(byAccount).map(([acct, resp]) => [acct, JSON.stringify(resp)])),
        ]),
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
};

const mountPile = (props = {}) => {
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
    ...props,
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
const settle = (ms = 600) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');
const mockSubmit = () => {
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  jest.spyOn(cryptoUtils, 'hashIdentifier').mockImplementation((value) => `hashed:${String(value)}`);
  return jest
    .spyOn(contractScriptsModule.default, 'submitResponses')
    .mockImplementation(async () => ({ hash: '0xabc', wait: async () => ({ status: 1, blockNumber: 42 }) }));
};
const ownAnswers = (byAccount) =>
  jest
    .spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers')
    .mockImplementation(async ({ account }) => (byAccount[account] === undefined ? [] : byAccount[account]));

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

const waitForPile = async (pile, n = 1) => {
  await waitFor(() => expect(pile.getEngine()?.state?.pileQuestions?.length).toBe(n), { timeout: 8000 });
  await settle();
  return pile.getEngine();
};

describe('E1 ordinary pile edits never claim AI provenance', () => {
  it('E1a a manual edit of a saved, never-interviewed answer uploads no interviewProvenance', async () => {
    setCache({ q1: { [A]: saved('q1') } });
    mockCaches();
    ownAnswers({ [A]: [saved('q1')] });
    const submitResponses = mockSubmit();
    const engine = await waitForPile(mountPile());
    await run(() => new Promise((resolve) => engine.handleAnswerPile('q1', 'Disagree', { afterUpdate: resolve })));
    await run(() => engine.handlePileSubmitClick());
    await settle();
    const [uploaded] = submitResponses.mock.calls[0][2];
    expect(uploaded.answer.value).toBe('Disagree');
    expect(uploaded).not.toHaveProperty('interviewProvenance');
  }, 40000);

  it('E1b control: a manual first answer (no saved response) uploads no interviewProvenance', async () => {
    setCache({});
    mockCaches();
    ownAnswers({});
    const submitResponses = mockSubmit();
    const engine = await waitForPile(mountPile());
    await run(() => new Promise((resolve) => engine.handleAnswerPile('q1', 'Disagree', { afterUpdate: resolve })));
    await run(() => engine.handlePileSubmitClick());
    await settle();
    const [uploaded] = submitResponses.mock.calls[0][2];
    expect(uploaded).not.toHaveProperty('interviewProvenance');
  }, 40000);

  it('E1c a manual edit of an answer saved with a name only (AI attribution off) keeps the name and claims no AI', async () => {
    const withName = saved('q1', { responderName: 'Participant A' });
    setCache({ q1: { [A]: withName } });
    mockCaches();
    ownAnswers({ [A]: [withName] });
    const submitResponses = mockSubmit();
    const engine = await waitForPile(mountPile());
    await run(() => new Promise((resolve) => engine.handleAnswerPile('q1', 'Disagree', { afterUpdate: resolve })));
    await run(() => engine.handlePileSubmitClick());
    await settle();
    const [uploaded] = submitResponses.mock.calls[0][2];
    expect(uploaded.responderName).toBe('Participant A');
    expect(uploaded).not.toHaveProperty('interviewProvenance');
  }, 40000);
});

describe('E2 consent change then undo then reload', () => {
  const withConsent = saved('q1', { responderName: 'Participant A', interviewProvenance: aiProvenance() });

  it('E2a re-recording the saved consent after a withdrawal leaves nothing pending, before and after reload', async () => {
    setCache({ q1: { [A]: withConsent } });
    mockCaches();
    ownAnswers({ [A]: [withConsent] });
    mockSubmit();
    const first = mountPile();
    const engine = await waitForPile(first);
    await run(() => loadSessionInterviewOwnAnswers(engine, ['q1'], new AbortController().signal));
    await run(() =>
      recordInterviewProvenance(engine, [{ questionId: 'q1', answer: 'Agree' }], SOURCE, PACKET, false, false, ''),
    );
    expect(engine.getChangedQidsAndFields(0).changedMap).toEqual({ q1: { interviewConsent: 1 } });
    await run(() =>
      recordInterviewProvenance(
        engine,
        [{ questionId: 'q1', answer: 'Agree' }],
        SOURCE,
        PACKET,
        true,
        false,
        'Participant A',
      ),
    );
    expect(engine.getChangedQidsAndFields(0).changedMap).toEqual({});
    expect(engine.getSubmitCount()).toBe(0);
    first.view.unmount();
    const engine2 = await waitForPile(mountPile());
    expect(engine2.getChangedQidsAndFields(0).changedMap).toEqual({});
    expect(engine2.getSubmitCount()).toBe(0);
    expect(await run(() => submitSessionInterviewResponses(engine2, ['q1']))).toEqual({ status: 'already-saved' });
  }, 40000);

  it('E2b Clear changes after a withdrawal leaves nothing pending, before and after reload', async () => {
    setCache({ q1: { [A]: withConsent } });
    mockCaches();
    ownAnswers({ [A]: [withConsent] });
    mockSubmit();
    const first = mountPile();
    const engine = await waitForPile(first);
    await run(() => loadSessionInterviewOwnAnswers(engine, ['q1'], new AbortController().signal));
    await run(() =>
      recordInterviewProvenance(engine, [{ questionId: 'q1', answer: 'Agree' }], SOURCE, PACKET, false, false, ''),
    );
    expect(engine.getSubmitCount()).toBe(1);
    await run(async () => engine.handleRevertPendingChanges());
    await settle();
    expect(engine.getSubmitCount()).toBe(0);
    first.view.unmount();
    const engine2 = await waitForPile(mountPile());
    expect(engine2.getSubmitCount()).toBe(0);
    const submitResponses = contractScriptsModule.default.submitResponses;
    await run(() => new Promise((resolve) => engine2.handleAnswerPile('q1', 'Disagree', { afterUpdate: resolve })));
    await run(() => engine2.handlePileSubmitClick());
    await settle();
    const [uploaded] = submitResponses.mock.calls[0][2];
    expect(uploaded.responderName).toBe('Participant A');
    expect(uploaded.interviewProvenance.source.platform).toBe('claude');
  }, 40000);
});

describe('E7/E8 saved consent changed elsewhere (another device or tab)', () => {
  const sNamed = saved('q1', { responderName: 'Participant A', interviewProvenance: aiProvenance(1000) });
  const sWithdrawn = saved('q1'); // full opt-out: no name, no AI attribution

  it('E7 a public-cache refresh carrying a withdrawal replaces the stale saved name', async () => {
    setCache({ q1: { [A]: sNamed } });
    mockCaches();
    ownAnswers({ [A]: [sNamed] });
    const submitResponses = mockSubmit();
    const pile = mountPile();
    const engine = await waitForPile(pile);
    setCache({ q1: { [A]: sWithdrawn } });
    await act(async () => {
      pile.view.rerenderSurveyQuestions({ questionResponsesNonce: 3 });
    });
    await settle(1200);
    const engine2 = pile.getEngine();
    await run(() => new Promise((resolve) => engine2.handleAnswerPile('q1', 'Disagree', { afterUpdate: resolve })));
    await run(() => engine2.handlePileSubmitClick());
    await settle();
    const uploaded = submitResponses.mock.calls[0]?.[2]?.[0];
    expect(uploaded).not.toHaveProperty('responderName');
  }, 40000);

  it('E8 stale public cache (Participant A) + fresh own-answer load (withdrawn): no stray consent change re-adding the name', async () => {
    setCache({ q1: { [A]: sNamed } });
    mockCaches();
    ownAnswers({ [A]: [sWithdrawn] });
    mockSubmit();
    const engine = await waitForPile(mountPile());
    await run(() => loadSessionInterviewOwnAnswers(engine, ['q1'], new AbortController().signal));
    expect(engine.getSubmitCount()).toBe(0);
  }, 40000);
});

it('preserves each saved consent until the participant explicitly changes the controls', async () => {
  const named = saved('q1', { responderName: 'Participant A', interviewProvenance: aiProvenance() });
  const optedOut = saved('q2');
  setCache(
    { q1: { [A]: named }, q2: { [A]: optedOut } },
    {
      q1: { id: 'q1', type: 'binary', prompt: 'Q1' },
      q2: { id: 'q2', type: 'binary', prompt: 'Q2' },
    },
  );
  mockCaches();
  ownAnswers({ [A]: [named, optedOut] });
  const engine = await waitForPile(mountPile(), 2);
  await run(() => loadSessionInterviewOwnAnswers(engine, ['q1', 'q2'], new AbortController().signal));
  const drafts = [
    { questionId: 'q1', answer: 'Agree' },
    { questionId: 'q2', answer: 'Agree' },
  ];
  await run(() =>
    recordInterviewProvenance(
      engine,
      drafts,
      { ...SOURCE, modelId: 'different-model' },
      PACKET,
      true,
      false,
      '',
      [],
      {},
    ),
  );
  expect(engine.getChangedQidsAndFields(0).changedMap).toEqual({});
  expect(engine.state.surveysResponseState[0].interviewProvenance.q1.responderName).toBe('Participant A');
  expect(engine.state.surveysResponseState[0].interviewProvenance.q2.includeAiProvenance).toBe(false);
  await run(() =>
    recordInterviewProvenance(engine, drafts, SOURCE, PACKET, false, false, '', [], {
      includeAiProvenance: false,
      includeResponderName: false,
    }),
  );
  expect(engine.getChangedQidsAndFields(0).changedMap).toEqual({ q1: { interviewConsent: 1 } });
}, 40000);

it('keeps an authoritative withdrawal over a conflicting public cache at the same timestamp', async () => {
  const old = saved('q1', { timeStamp: 1000, responderName: 'Participant A', interviewProvenance: aiProvenance() });
  const latest = saved('q1', { timeStamp: 1000 });
  setCache({ q1: { [A]: old } });
  mockCaches();
  ownAnswers({ [A]: [latest] });
  const submitResponses = mockSubmit();
  const pile = mountPile();
  const engine = await waitForPile(pile);
  await run(() => loadSessionInterviewOwnAnswers(engine, ['q1'], new AbortController().signal));
  await act(async () => pile.view.rerenderSurveyQuestions({ questionResponsesNonce: 3 }));
  await settle(1200);
  const current = pile.getEngine();
  await run(() => new Promise((resolve) => current.handleAnswerPile('q1', 'Disagree', { afterUpdate: resolve })));
  await run(() => current.handlePileSubmitClick());
  await settle();
  const uploaded = submitResponses.mock.calls[0]?.[2]?.[0];
  expect(uploaded).toBeDefined();
  expect(uploaded).not.toHaveProperty('responderName');
}, 40000);
