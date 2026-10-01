// Saved consent regression coverage through the real pile engine.
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
  responderName: 'Participant',
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

const mountPile = () => {
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

it('P1 unchanged answer + unchanged consent: not pending after "already saved" and after a same-tab reload', async () => {
  mockCaches();
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue([savedResponse()]);
  const first = mountPile();
  await waitFor(() => expect(first.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  const engine = first.getEngine();
  await run(() => loadSessionInterviewOwnAnswers(engine, ['q1'], new AbortController().signal));
  expect(engine.getPendingEditStats().total).toBe(0);
  await run(() =>
    recordInterviewProvenance(
      engine,
      [{ questionId: 'q1', answer: 'Agree' }],
      SOURCE,
      PACKET,
      true,
      false,
      'Participant',
    ),
  );
  // Same name and same AI attribution as the saved version.
  expect(engine.getChangedQidsAndFields(0).changedMap).toEqual({});
  expect(engine.getPendingEditStats().total).toBe(0);
  const result = await run(() => submitSessionInterviewResponses(engine, ['q1']));
  expect(result).toEqual({ status: 'already-saved' });
  expect(sessionStorage.getItem(`dg:surveyDraft:edge:84532:${ACCOUNT}:questions`)).toContain(
    '"responderName":"Participant"',
  );

  first.view.unmount();
  const second = mountPile();
  await waitFor(() => expect(second.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  const engine2 = second.getEngine();
  // The saved version already carries "Participant" and the same AI attribution: nothing is pending.
  expect(engine2.getPendingEditStats().total).toBe(0);
}, 40000);

// ---- Real submit path (encryptAndUpload -> submitSurveyResponse -> chainGateway.submitResponses) ----
const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');

const mockSubmit = () => {
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  jest.spyOn(cryptoUtils, 'hashIdentifier').mockImplementation((value) => `hashed:${String(value)}`);
  const encryptMultipleAnswers = jest.spyOn(cryptoUtils, 'encryptMultipleAnswers');
  const encryptEnvelopeValue = jest.spyOn(cryptoUtils, 'encryptEnvelopeValue');
  const submitResponses = jest
    .spyOn(contractScriptsModule.default, 'submitResponses')
    .mockImplementation(async () => ({ hash: '0xabc', wait: async () => ({ status: 1, blockNumber: 42 }) }));
  return { submitResponses, encryptMultipleAnswers, encryptEnvelopeValue };
};

// The real chainGateway.submitResponses runs this guard on every question response before upload
// (contractScripts.surveyWriteMethods.ts:569). The probes mock submitResponses, so run it here.
const { validateNoLockedPlaintextInPayload } = require('../../utilities/arweave/noLeakPayloads');
const guardUpload = (responses) =>
  (responses || []).forEach((response) =>
    validateNoLockedPlaintextInPayload(response, { family: 'question_response_payload', path: 'question response' }),
  );

const interviewSubmit = async (engine, { name = '', includeAi = true, comparison = false } = {}) => {
  await run(() => loadSessionInterviewOwnAnswers(engine, ['q1'], new AbortController().signal));
  await run(() =>
    recordInterviewProvenance(
      engine,
      [{ questionId: 'q1', answer: 'Agree' }],
      SOURCE,
      PACKET,
      includeAi,
      comparison,
      name,
    ),
  );
  const pendingBeforeSubmit = engine.getPendingEditStats().total;
  const changedMap = engine.getChangedQidsAndFields(0).changedMap;
  const result = await run(() => submitSessionInterviewResponses(engine, ['q1']));
  await settle();
  return { pendingBeforeSubmit, changedMap, result };
};

it('P2 opt-in: a consent-only name addition uploads the unchanged answer with the name, then nothing is pending', async () => {
  const saved = savedResponse({ responderName: undefined, interviewProvenance: undefined });
  mockCaches(saved);
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue([saved]);
  const { submitResponses, encryptMultipleAnswers } = mockSubmit();
  const pile = mountPile();
  await waitFor(() => expect(pile.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  const engine = pile.getEngine();
  const outcome = await interviewSubmit(engine, { name: 'Participant', includeAi: false });
  expect(outcome.changedMap).toEqual({ q1: { interviewConsent: 1 } });
  expect(outcome.result).toEqual({ status: 'submitted' });
  expect(submitResponses).toHaveBeenCalledTimes(1);
  const [uploaded] = submitResponses.mock.calls[0][2];
  expect(uploaded).toMatchObject({ questionID: 'q1', responderName: 'Participant', answer: { value: 'Agree' } });
  expect(uploaded).not.toHaveProperty('interviewProvenance');
  expect(encryptMultipleAnswers).not.toHaveBeenCalled();
  expect(engine.getPendingEditStats().total).toBe(0);
}, 40000);

it('P3 opt-out: unticking a saved name and AI attribution uploads a version without them', async () => {
  mockCaches();
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue([savedResponse()]);
  const { submitResponses } = mockSubmit();
  const pile = mountPile();
  await waitFor(() => expect(pile.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  const engine = pile.getEngine();
  const outcome = await interviewSubmit(engine, { name: '', includeAi: false });
  expect(outcome.result).toEqual({ status: 'submitted' });
  const [uploaded] = submitResponses.mock.calls[0][2];
  expect(uploaded).not.toHaveProperty('responderName');
  expect(uploaded).not.toHaveProperty('interviewProvenance');
  expect(uploaded.answer.value).toBe('Agree');
  expect(engine.getPendingEditStats().total).toBe(0);
}, 40000);

it('P4 masked encrypted answer + rating envelopes: a consent-only upload re-sends the saved envelopes unchanged', async () => {
  const envelope = JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: 'answer-ct' });
  const commentEnvelope = JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: 'comment-ct' });
  const saved = savedResponse({
    responderName: undefined,
    interviewProvenance: undefined,
    answer: {
      value: '*',
      encrypted: true,
      encryptionAudience: 'self',
      audienceMode: 'explicit',
      hash: '0xhash-answer',
      encryptedPortion: envelope,
    },
    additional: {
      value: '*',
      encrypted: true,
      encryptionAudience: 'self',
      audienceMode: 'explicit',
      hash: '0xhash-comment',
      encryptedPortion: commentEnvelope,
    },
    importance: null,
    conviction: null,
    importanceEncrypted: 'importance-envelope',
    convictionEncrypted: 'conviction-envelope',
  });
  mockCaches(saved);
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue([saved]);
  const { submitResponses, encryptMultipleAnswers, encryptEnvelopeValue } = mockSubmit();
  const pile = mountPile();
  await waitFor(() => expect(pile.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  const engine = pile.getEngine();
  await run(() => loadSessionInterviewOwnAnswers(engine, ['q1'], new AbortController().signal));
  // The modal only applies unchanged values; a masked answer stays masked. Record consent only.
  await run(() =>
    recordInterviewProvenance(engine, [{ questionId: 'q1', answer: '*' }], SOURCE, PACKET, false, false, 'Participant'),
  );
  const changedMap = engine.getChangedQidsAndFields(0).changedMap;
  const result = await run(() => submitSessionInterviewResponses(engine, ['q1']));
  await settle();
  expect(result).toEqual({ status: 'submitted' });
  const [uploaded] = submitResponses.mock.calls[0][2];
  expect(uploaded.answer).toMatchObject({
    value: '*',
    encrypted: true,
    encryptionAudience: 'self',
    hash: '0xhash-answer',
    encryptedPortion: envelope,
  });
  expect(uploaded.additional).toMatchObject({
    value: '*',
    encrypted: true,
    encryptionAudience: 'self',
    hash: '0xhash-comment',
    encryptedPortion: commentEnvelope,
  });
  expect(uploaded).toMatchObject({
    importanceEncrypted: 'importance-envelope',
    convictionEncrypted: 'conviction-envelope',
    importance: null,
    conviction: null,
    responderName: 'Participant',
  });
  expect(encryptMultipleAnswers).not.toHaveBeenCalled();
  expect(encryptEnvelopeValue).not.toHaveBeenCalled();
}, 40000);

it('P5 after a successful consent upload, an edit to another question plus a same-tab reload keeps q1 saved', async () => {
  const saved = savedResponse({ responderName: undefined, interviewProvenance: undefined });
  mockCaches(saved, { q2: { id: 'q2', type: 'binary', prompt: 'Q2' } });
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue([saved]);
  const { submitResponses } = mockSubmit();
  const first = mountPile();
  await waitFor(() => expect(first.getEngine()?.state?.pileQuestions?.length).toBe(2), { timeout: 8000 });
  await settle();
  const engine = first.getEngine();
  const outcome = await interviewSubmit(engine, { name: 'Participant', includeAi: false });
  expect(outcome.result).toEqual({ status: 'submitted' });
  expect(submitResponses.mock.calls[0][2][0]).toMatchObject({ responderName: 'Participant' });
  expect(engine.getPendingEditStats().total).toBe(0);
  // An ordinary pile edit to another question persists the draft window again.
  await run(() => new Promise((resolve) => engine.handleAnswerPile('q2', 'Disagree', { afterUpdate: resolve })));
  await settle();
  first.view.unmount();
  const second = mountPile();
  await waitFor(() => expect(second.getEngine()?.state?.pileQuestions?.length).toBe(2), { timeout: 8000 });
  await settle();
  const engine2 = second.getEngine();
  // Only q2 has an unsaved edit; q1 was uploaded with "Participant" before the reload.
  expect(engine2.getChangedQidsAndFields(0).changedMap).not.toHaveProperty('q1');
}, 40000);

it('P6 a failed opt-out upload stays pending after a same-tab reload', async () => {
  mockCaches();
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue([savedResponse()]);
  const { submitResponses } = mockSubmit();
  submitResponses.mockImplementation(async () => {
    throw new Error('User rejected the request.');
  });
  const first = mountPile();
  await waitFor(() => expect(first.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  const engine = first.getEngine();
  const outcome = await interviewSubmit(engine, { name: '', includeAi: false });
  expect(outcome.result).toMatchObject({ status: 'failed' });
  // The withdrawal of "Participant" is pending before the reload.
  expect(engine.getChangedQidsAndFields(0).changedMap).toEqual({ q1: { interviewConsent: 1 } });
  first.view.unmount();
  const second = mountPile();
  await waitFor(() => expect(second.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  const engine2 = second.getEngine();
  // The saved version still carries "Participant"; the recorded withdrawal should still be pending.
  expect(engine2.getChangedQidsAndFields(0).changedMap).toEqual({ q1: { interviewConsent: 1 } });
}, 40000);

it('P7 reopening the interview (own-answer load) keeps a pending, not-yet-uploaded consent change', async () => {
  mockCaches();
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue([savedResponse()]);
  const { submitResponses } = mockSubmit();
  submitResponses.mockImplementation(async () => {
    throw new Error('User rejected the request.');
  });
  const pile = mountPile();
  await waitFor(() => expect(pile.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  const engine = pile.getEngine();
  await interviewSubmit(engine, { name: '', includeAi: false });
  expect(engine.getChangedQidsAndFields(0).changedMap).toEqual({ q1: { interviewConsent: 1 } });
  await run(() => loadSessionInterviewOwnAnswers(engine, ['q1'], new AbortController().signal));
  expect(engine.getChangedQidsAndFields(0).changedMap).toEqual({ q1: { interviewConsent: 1 } });
}, 40000);

it('P10 legacy Worker: withdrawing a saved name on an unchanged answer is uploaded', async () => {
  const { applySessionInterviewAnswer } = require('./SurveyPileViewMode');
  mockCaches(); // saved q1 = "Agree" with responderName "Participant" + AI attribution
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue(null);
  const { submitResponses } = mockSubmit();
  const pile = mountPile();
  await waitFor(() => expect(pile.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  const engine = pile.getEngine();
  expect(await run(() => loadSessionInterviewOwnAnswers(engine, ['q1'], new AbortController().signal))).toBeNull();
  await run(() => applySessionInterviewAnswer(engine, 'q1', 'Agree'));
  await run(() =>
    recordInterviewProvenance(engine, [{ questionId: 'q1', answer: 'Agree' }], SOURCE, PACKET, false, false, ''),
  );
  const changedMap = engine.getChangedQidsAndFields(0).changedMap;
  const result = await run(() => submitSessionInterviewResponses(engine, ['q1']));
  expect(result).toEqual({ status: 'submitted' });
}, 40000);

it('P11 legacy Worker: re-sending the same saved name on an unchanged answer is not a new version', async () => {
  const { applySessionInterviewAnswer } = require('./SurveyPileViewMode');
  mockCaches(); // saved q1 = "Agree" with responderName "Participant" + AI attribution
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue(null);
  const { submitResponses } = mockSubmit();
  const pile = mountPile();
  await waitFor(() => expect(pile.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  const engine = pile.getEngine();
  await run(() => loadSessionInterviewOwnAnswers(engine, ['q1'], new AbortController().signal));
  await run(() => applySessionInterviewAnswer(engine, 'q1', 'Agree'));
  await run(() =>
    recordInterviewProvenance(
      engine,
      [{ questionId: 'q1', answer: 'Agree' }],
      SOURCE,
      PACKET,
      true,
      false,
      'Participant',
    ),
  );
  const changedMap = engine.getChangedQidsAndFields(0).changedMap;
  const result = await run(() => submitSessionInterviewResponses(engine, ['q1']));
  await settle();
  expect(submitResponses).not.toHaveBeenCalled();
}, 40000);

it('P8 legacy Worker: a consent-only submit of a decrypted encrypted answer passes the upload no-leak guard', async () => {
  const { buildSelfQuestionDecryptSuccessState } = require('./surveyToolDecryptFlow');
  const { applySessionInterviewAnswer } = require('./SurveyPileViewMode');
  const envelope = JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: 'answer-ct' });
  const saved = savedResponse({
    responderName: undefined,
    interviewProvenance: undefined,
    answer: {
      value: '*',
      encrypted: true,
      encryptionAudience: 'self',
      audienceMode: 'explicit',
      hash: '0xhash-answer',
      encryptedPortion: envelope,
    },
  });
  mockCaches(saved);
  // Legacy Worker: no own-answer listing (loader resolves null).
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue(null);
  const { submitResponses, encryptMultipleAnswers } = mockSubmit();
  const pile = mountPile();
  await waitFor(() => expect(pile.getEngine()?.state?.pileQuestions?.length).toBe(1), { timeout: 8000 });
  await settle();
  const engine = pile.getEngine();

  // "Decrypt" in the pile: the engine's own self-decrypt success transition.
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
                decryptedStateSlice: { answers: { q1: { value: 'My secret answer' } }, additionalComments: {} },
              },
              (value) => JSON.parse(JSON.stringify(value)),
            ),
          resolve,
        ),
      ),
  );

  // Interview on a legacy Worker: own answers cannot be listed, the AI draft equals the decrypted answer.
  expect(await run(() => loadSessionInterviewOwnAnswers(engine, ['q1'], new AbortController().signal))).toBeNull();
  await run(() => applySessionInterviewAnswer(engine, 'q1', 'My secret answer'));
  await run(() =>
    recordInterviewProvenance(
      engine,
      [{ questionId: 'q1', answer: 'My secret answer' }],
      SOURCE,
      PACKET,
      false,
      false,
      'Participant',
    ),
  );
  const changedMap = engine.getChangedQidsAndFields(0).changedMap;
  const result = await run(() => submitSessionInterviewResponses(engine, ['q1']));
  await settle();

  expect(result).toEqual({ status: 'submitted' });
  // In the app the upload itself runs the no-leak guard: this is what the user gets instead of "submitted".
  expect(() => guardUpload(submitResponses.mock.calls[0][2])).not.toThrow();
}, 40000);
it('P9 current Worker: stray consent restored after reload + Decrypt in the pile + pile Submit passes the upload no-leak guard', async () => {
  const { buildSelfQuestionDecryptSuccessState } = require('./surveyToolDecryptFlow');
  const { applySessionInterviewAnswer } = require('./SurveyPileViewMode');
  const envelope = JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: 'answer-ct' });
  const saved = savedResponse({
    responderName: undefined,
    interviewProvenance: undefined,
    answer: {
      value: '*',
      encrypted: true,
      encryptionAudience: 'self',
      audienceMode: 'explicit',
      hash: '0xhash-answer',
      encryptedPortion: envelope,
    },
  });
  mockCaches(saved, { q2: { id: 'q2', type: 'binary', prompt: 'Q2' } });
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue([saved]);
  const { submitResponses, encryptMultipleAnswers } = mockSubmit();
  encryptMultipleAnswers.mockImplementation(async (slice) => ({
    answers: Object.fromEntries(
      Object.keys(slice.answers || {}).map((qid) => [
        qid,
        { ...slice.answers[qid], value: '*', encrypted: true, encryptedPortion: envelope, hash: '0xnew' },
      ]),
    ),
    additionalComments: {},
    importance: {},
  }));
  const first = mountPile();
  await waitFor(() => expect(first.getEngine()?.state?.pileQuestions?.length).toBe(2), { timeout: 8000 });
  await settle();
  const engine = first.getEngine();
  // Interview on a current Worker: saved (masked) answer reloaded, AI draft applied, name ticked, submitted.
  await run(() => loadSessionInterviewOwnAnswers(engine, ['q1'], new AbortController().signal));
  await run(() => applySessionInterviewAnswer(engine, 'q1', 'My secret answer'));
  await run(() =>
    recordInterviewProvenance(
      engine,
      [{ questionId: 'q1', answer: 'My secret answer' }],
      SOURCE,
      PACKET,
      false,
      false,
      'Participant',
    ),
  );
  expect(await run(() => submitSessionInterviewResponses(engine, ['q1']))).toEqual({ status: 'submitted' });
  await settle();
  expect(JSON.stringify(submitResponses.mock.calls[0][2])).not.toContain('My secret answer');
  // Ordinary edit to another question, then a same-tab reload.
  await run(() => new Promise((resolve) => engine.handleAnswerPile('q2', 'Disagree', { afterUpdate: resolve })));
  await settle();
  first.view.unmount();
  const second = mountPile();
  await waitFor(() => expect(second.getEngine()?.state?.pileQuestions?.length).toBe(2), { timeout: 8000 });
  await settle();
  const engine2 = second.getEngine();
  // "Decrypt" q1 in the pile to read it.
  await run(
    () =>
      new Promise((resolve) =>
        engine2.setState(
          (prev) =>
            buildSelfQuestionDecryptSuccessState(
              prev,
              {
                surveyIndex: 0,
                questionId: 'q1',
                clearMode: 'both',
                didUpdate: true,
                baselineSlice: prev.editBaseline,
                decryptedStateSlice: { answers: { q1: { value: 'My secret answer' } }, additionalComments: {} },
              },
              (value) => JSON.parse(JSON.stringify(value)),
            ),
          resolve,
        ),
      ),
  );
  const changedMap = engine2.getChangedQidsAndFields(0).changedMap;
  // The pile's "Submit (2)" button.
  const result = await run(() => engine2.handlePileSubmitClick());
  await settle();
  const uploads = submitResponses.mock.calls.map((call) => call[2]);

  expect(() => guardUpload(uploads[1])).not.toThrow();
}, 40000);
it('P12 PRE-EXISTING control (base code paths unchanged): decrypted encrypted answer + plaintext comment edit, pile Submit', async () => {
  const { buildSelfQuestionDecryptSuccessState } = require('./surveyToolDecryptFlow');
  const envelope = JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: 'answer-ct' });
  const saved = savedResponse({
    responderName: undefined,
    interviewProvenance: undefined,
    answer: {
      value: '*',
      encrypted: true,
      encryptionAudience: 'self',
      audienceMode: 'explicit',
      hash: '0xhash-answer',
      encryptedPortion: envelope,
    },
  });
  mockCaches(saved);
  const { submitResponses } = mockSubmit();
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
                decryptedStateSlice: { answers: { q1: { value: 'My secret answer' } }, additionalComments: {} },
              },
              (value) => JSON.parse(JSON.stringify(value)),
            ),
          resolve,
        ),
      ),
  );
  await run(
    () => new Promise((resolve) => engine.handleAdditionalPile('q1', 'Plain comment', { afterUpdate: resolve })),
  );
  const changedMap = engine.getChangedQidsAndFields(0).changedMap;
  const result = await run(() => engine.handlePileSubmitClick());
  await settle();

  expect(() => guardUpload(submitResponses.mock.calls[0]?.[2])).not.toThrow();
}, 40000);
