import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderSurveyPileViewMode, renderSurveyQuestions } from './surveyQuestionsTestHarness';
import {
  applySessionInterviewAnswer,
  createPileViewRuntimeStrategy,
  submitSessionInterviewResponses,
} from './SurveyPileViewMode';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as storageClient from '../../utilities/storage/storageClient';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort.js';
import { cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { hydrateWorkerCanonicalQuestionCache } from '../../utilities/survey/workerCanonicalCacheHydration';
import { loadWorkerCanonicalQuestions } from '../../domains/surveys/workerCanonicalMetadataHydrationPort';
import { loadWorkerResponses } from '../../utilities/survey/workerResponseHydration';
import { createSessionResponseHydrationController } from '../../utilities/survey/sessionResponseHydrationController';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

// Each scenario edits, filters and submits through the real pile with real cache timers.
jest.setTimeout(20_000);

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));
const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');
const SLUG = 'submit-integrity';
const OWNER = `0x${'33'.repeat(20)}`;
const BINARY_QID = `0x${'ab'.repeat(32)}`;
const FREEFORM_QID = `0x${'cd'.repeat(32)}`;
const FREEFORM_QUESTION = { id: FREEFORM_QID, type: 'freeform', prompt: 'Freeform question' };
const SESSION_ID = `0x${'44'.repeat(16)}`;
const PUBLIC_ACCESS = { gate: 'none', encryption: 'none' };
const CONFIG = {
  slug: SLUG,
  sessionId: SESSION_ID,
  sessionIdHex: SESSION_ID,
  corsWorkerUrl: 'https://submit-integrity.example/',
  storageProfile: {
    backend: 'cloudflare',
    resources: { questions: 'active', surveys: 'active', responses: 'active' },
    payloadAccessControl: PUBLIC_ACCESS,
  },
  responseFieldEncryption: { mode: 'optional', version: 1 },
  sessionModeProfile: {
    ...cloneSessionModePreset('fast_cheap_cloudflare'),
    preset: 'custom',
    storage: { backend: 'cloudflare', payloadAccessControl: PUBLIC_ACCESS },
    encryption: { mode: 'none' },
    results: {
      visibility: 'public_full_if_storage_public',
      exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 },
    },
  },
};
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
// Start inside one act and await in the next so state callbacks can flush in between.
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
const controllers = [];
afterEach(async () => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  jest.restoreAllMocks();
  for (const namespace of ['questionsCache', 'surveysCache', 'userCache'])
    await cacheScripts.removeCache(namespace, SLUG);
  sessionStorage.clear();
  localStorage.clear();
});

// Storage transport only; the response controller, pile and submit path are real.
const fixture = async () => {
  const rows = { questions: [], surveys: [], responses: [] };
  let sequence = 0;
  const add = (resource, payload, responder = OWNER) => {
    sequence += 1;
    const storageRef = { id: `submit-integrity-${sequence}`, backend: 'cloudflare', resource };
    rows[resource].push({
      storageRef,
      metadata: { responder, createdAt: new Date(Date.parse('2026-01-01') + sequence * 60000).toISOString() },
      payload: { ...payload, sessionSlug: SLUG, sessionId: SESSION_ID },
    });
    return storageRef;
  };
  add('questions', { id: BINARY_QID, type: 'binary', prompt: 'Binary question' });
  add('questions', { id: FREEFORM_QID, type: 'freeform', prompt: 'Freeform question' });
  const listPage = jest.fn(async ({ resource, ownResponses }) => ({
    items: rows[resource].filter((row) => !ownResponses || row.metadata.responder === ownResponses.account),
    cursor: null,
    listComplete: true,
  }));
  const readBlob = async ({ storageRef }) => ({
    json: async () => rows[storageRef.resource].find((row) => row.storageRef.id === storageRef.id).payload,
  });
  const deps = { listSessionStorageRefsPage: listPage, readSessionStorageBlob: readBlob };
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network access'));
  jest.spyOn(storageClient, 'listSessionStorageRefsPage').mockImplementation(listPage);
  jest.spyOn(storageClient, 'readSessionStorageBlob').mockImplementation(readBlob);
  jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(CONFIG);
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  jest.spyOn(surveyQuestionReadsPort, 'getResponse').mockResolvedValue(null);
  jest.spyOn(surveyQuestionReadsPort, 'getSurveyResponse').mockResolvedValue(null);
  const submitResponses = jest
    .spyOn(contractScriptsModule.default, 'submitResponses')
    .mockImplementation(async (_provider, ids, responses) => {
      const questionResponseRefs = responses.map((response, index) => ({
        questionId: ids[index],
        storageRef: add('responses', response),
      }));
      return {
        workerCanonicalSubmission: true,
        questionResponseRefs,
        sessionSlug: SLUG,
        storageRefs: questionResponseRefs.map((row) => row.storageRef),
      };
    });
  await hydrateWorkerCanonicalQuestionCache({
    host: {
      getSessionCfg: () => CONFIG,
      getAccount: () => OWNER,
      workerCanonicalMetadataHydrationPort: { loadQuestions: (opts) => loadWorkerCanonicalQuestions(opts, deps) },
    },
    sessionSlug: SLUG,
    sessionConfig: CONFIG,
    persist: async (merge) => {
      await cacheScripts.updateCacheAtomic('questionsCache', SLUG, merge);
      return true;
    },
    createPersistenceError: (message) => new Error(message),
    onSuccess: () => {},
  });
  const state = { isResponsesCacheReady: false, questionResponsesNonce: 1 };
  let view, engine;
  const host = {
    setState: (updater, cb) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      if (patch) Object.assign(state, patch);
      view?.rerenderSurveyQuestions({
        isResponsesCacheReady: state.isResponsesCacheReady,
        questionResponsesNonce: state.questionResponsesNonce,
        questionsCacheNonce: state.questionResponsesNonce,
      });
      cb?.();
    },
    isMounted: () => true,
    getActiveSessionSlug: () => SLUG,
    getSessionCfg: () => CONFIG,
    getAccount: () => OWNER,
    getProviderLike: () => null,
    scanScopeNoop: () => false,
    dgRead: (key, slug) => cacheScripts.peekCacheSync(key, slug),
    updateQuestionsCacheAtomic: async (slug, updater) => {
      await cacheScripts.updateCacheAtomic('questionsCache', slug, updater);
      return true;
    },
    updateUserCacheAtomic: async (slug, updater) => {
      await cacheScripts.updateCacheAtomic('userCache', slug, updater);
      return true;
    },
    setReadinessStateIfChanged: (patch, cb) => host.setState(patch, cb),
    checkAllCachesReady: () => {},
    queueLocalRevisionUpdate: () => {},
    loadWorkerResponses: jest.fn(async (opts) => loadWorkerResponses(opts, deps)),
  };
  const controller = createSessionResponseHydrationController(host);
  controllers.push(controller);
  const sessionProps = () => ({
    isStandalone: true,
    surveyIndex: 0,
    account: OWNER,
    loginComplete: true,
    provider: { request: jest.fn() },
    network: { id: 11155420 },
    networkChainId: 11155420,
    cacheHasLoaded: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: state.isResponsesCacheReady,
    questionResponsesNonce: state.questionResponsesNonce,
    questionsCacheNonce: state.questionResponsesNonce,
    sessionSlug: SLUG,
    activeSessionSlug: SLUG,
    sessionSlugPinned: true,
    sessionConfig: CONFIG,
    refreshQuestionResponses: (ids, opts) => controller.refreshQuestionResponses(ids, opts),
    toggleLoginModal: jest.fn(),
  });
  const mount = async (props = {}) => {
    const strategy = createPileViewRuntimeStrategy();
    const original = strategy.render;
    strategy.render = (current) => {
      engine = current;
      return original(current);
    };
    view = renderSurveyPileViewMode({
      ...sessionProps(),
      minifiedMode: 'pile',
      onFilterChange: jest.fn(),
      runtimeStrategy: strategy,
      ...props,
    });
    await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(2));
    await settle();
  };
  // The "View all" editor: the same session rendered as the full question list.
  const renderEditor = (props = {}) => {
    view = renderSurveyQuestions({ ...sessionProps(), questionPool: [FREEFORM_QUESTION], ...props });
  };
  const click = async () => {
    await act(async () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)));
  };
  const savedRows = (questionId) =>
    rows.responses.filter((row) => row.payload.questionID === questionId).map((row) => row.payload);
  return {
    add,
    sync: () => controller.fetchQuestionResponsesChunkedForGroup(SLUG),
    mount,
    renderEditor,
    mountEditor: async (props = {}) => {
      renderEditor(props);
      await settle();
    },
    rerender: (props) => view.rerenderSurveyQuestions(props),
    unmount: () => {
      view?.unmount();
      view = null;
    },
    click,
    submitResponses,
    savedRows,
    engine: () => engine,
  };
};

const draftHolds = (questionId) =>
  Object.keys(sessionStorage).some(
    (key) => key.startsWith(`dg:surveyDraft:${SLUG}:`) && sessionStorage.getItem(key).includes(questionId),
  );

it('uploads an edit hidden by the active filter instead of marking it saved', async () => {
  const h = await fixture();
  await act(async () => h.sync());
  await h.mount();
  const engine = () => h.engine();
  await act(async () => engine().handleAnswerPile(BINARY_QID, 'Yes'));
  await settle();
  const freeform = engine().state.allQuestionsForFilter.find((question) => question.id === FREEFORM_QID);
  await act(async () => engine().handleFilter([freeform], { questionTypes: ['freeform'] }));
  await settle();
  expect(engine().state.pileQuestions.map((question) => question.id)).toEqual([FREEFORM_QID]);
  await act(async () => engine().handleAnswerPile(FREEFORM_QID, 'Visible answer'));
  await settle();
  expect(engine().getPendingEditStats().total).toBe(2);

  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  await settle();

  const uploaded = h.submitResponses.mock.calls[0][2];
  expect(uploaded.map((response) => [response.questionID, response.answer.value])).toEqual(
    expect.arrayContaining([
      [BINARY_QID, 'Yes'],
      [FREEFORM_QID, 'Visible answer'],
    ]),
  );
  expect(h.savedRows(BINARY_QID)).toHaveLength(1);
  expect(engine().getPendingEditStats().total).toBe(0);
});

it('uploads the other edits and names a changed answer that cannot be included', async () => {
  const h = await fixture();
  await act(async () => h.sync());
  await h.mount();
  const engine = () => h.engine();
  // An interview can apply a draft for a question the pile's question list has not loaded.
  const unknownQid = `0x${'ef'.repeat(32)}`;
  await act(async () => engine().handleAnswerPile(unknownQid, 'Answer for an unlisted question'));
  await act(async () => engine().handleAnswerPile(FREEFORM_QID, 'Listed answer'));
  await settle();
  expect(engine().getPendingEditStats().total).toBe(2);

  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  await settle();

  expect(h.submitResponses.mock.calls[0][2].map((row) => row.questionID)).toEqual([FREEFORM_QID]);
  expect(engine().state.submissionError).toMatch(
    /Question 0xefefefef… isn't in this page's question list, so its change wasn't submitted\. If it came from an interview, remove that draft/,
  );
  expect(engine().getPendingEditStats().total).toBe(1);
  expect(draftHolds(unknownQid)).toBe(true);
});

it('names an interview answer held back from the upload and undoes only its draft', async () => {
  const h = await fixture();
  await act(async () => h.sync());
  await h.mount();
  const engine = () => h.engine();
  const unknownQid = `0x${'ef'.repeat(32)}`;
  const { captureSessionInterviewResponses } = require('./SurveyPileViewMode');
  const restore = captureSessionInterviewResponses(engine(), [unknownQid, FREEFORM_QID]);
  await run(() => applySessionInterviewAnswer(engine(), unknownQid, 'Interview answer for an unlisted question'));
  await run(() => applySessionInterviewAnswer(engine(), FREEFORM_QID, 'Interview answer'));

  const outcome = await run(() => submitSessionInterviewResponses(engine(), [unknownQid, FREEFORM_QID]));
  await settle();

  expect(outcome).toEqual({
    status: 'failed',
    message: expect.stringMatching(/Question 0xefefefef… isn't in this page's question list/),
  });
  expect(h.savedRows(FREEFORM_QID).map((row) => row.answer.value)).toEqual(['Interview answer']);
  await run(() => restore());
  const slice = engine().state.surveysResponseState[0];
  expect(slice.answers[FREEFORM_QID].value).toBe('Interview answer');
  expect(slice.answers[unknownQid]?.value ?? '').toBe('');
  expect(engine().getPendingEditStats().total).toBe(0);
});

it('holds back only a question whose locked value cannot be sent and names it', async () => {
  const envelope = JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: 'old-secret' });
  const h = await fixture();
  await act(async () => h.sync());
  await h.mount();
  const engine = () => h.engine();
  await act(async () => engine().handleAnswerPile(BINARY_QID, 'Yes'));
  // A masked value without its lock can never be uploaded.
  await run(
    () =>
      new Promise((resolve) =>
        engine().setState((prev) => {
          const slice = prev.surveysResponseState[0];
          return {
            surveysResponseState: [
              {
                ...slice,
                answers: {
                  ...slice.answers,
                  [FREEFORM_QID]: {
                    value: '*',
                    encrypted: false,
                    encryptedPortion: envelope,
                    audienceMode: 'explicit',
                  },
                },
              },
            ],
          };
        }, resolve),
      ),
  );
  await settle();

  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  await settle();

  expect(h.submitResponses.mock.calls[0][2].map((row) => [row.questionID, row.answer.value])).toEqual([
    [BINARY_QID, 'Yes'],
  ]);
  expect(engine().state.submissionError).toMatch(
    /“Freeform question” still holds a locked value that can't be sent as it is, so it wasn't submitted\. Decrypt it, set its lock again and submit\./,
  );
  expect(JSON.stringify(h.submitResponses.mock.calls)).not.toContain('old-secret');
});

it('uploads an interview answer for a question hidden by the active filter', async () => {
  const h = await fixture();
  await act(async () => h.sync());
  await h.mount();
  const engine = () => h.engine();
  const freeform = engine().state.allQuestionsForFilter.find((question) => question.id === FREEFORM_QID);
  await act(async () => engine().handleFilter([freeform], { questionTypes: ['freeform'] }));
  await settle();
  await run(() => applySessionInterviewAnswer(engine(), BINARY_QID, 'No'));

  const outcome = await run(() => submitSessionInterviewResponses(engine(), [BINARY_QID]));
  await settle();

  expect(outcome).toEqual({ status: 'submitted' });
  expect(h.savedRows(BINARY_QID).map((row) => row.answer.value)).toEqual(['No']);
});

const savedFreeform = (answer, additional = { value: '', encrypted: false }) => ({
  questionID: FREEFORM_QID,
  type: 'freeform',
  answer,
  additional,
  importance: null,
  conviction: null,
});

it('uploads a cleared saved answer as an explicit blank', async () => {
  const h = await fixture();
  h.add('responses', savedFreeform({ value: 'Saved answer', encrypted: false }));
  await act(async () => h.sync());
  await h.mount();
  const engine = () => h.engine();
  expect(engine().state.surveysResponseState[0].answers[FREEFORM_QID].value).toBe('Saved answer');
  await act(async () => engine().handleAnswerPile(FREEFORM_QID, ''));
  await settle();
  expect(engine().getPendingEditStats().total).toBe(1);

  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  await settle();

  expect(h.submitResponses.mock.calls[0][2]).toEqual([
    expect.objectContaining({ questionID: FREEFORM_QID, answer: expect.objectContaining({ value: '' }) }),
  ]);
  expect(h.savedRows(FREEFORM_QID).at(-1).answer.value).toBe('');
  expect(engine().getPendingEditStats().total).toBe(0);
});

it('never re-sends the envelope of a cleared locked answer', async () => {
  const { buildSelfQuestionDecryptSuccessState } = require('./surveyToolDecryptFlow');
  const envelope = JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: 'old-secret' });
  const h = await fixture();
  h.add(
    'responses',
    savedFreeform(
      { value: '*', encrypted: true, encryptedPortion: envelope, encryptionAudience: 'self', audienceMode: 'explicit' },
      { value: 'Public note', encrypted: false, audienceMode: 'explicit' },
    ),
  );
  await act(async () => h.sync());
  await h.mount();
  const engine = () => h.engine();
  await run(
    () =>
      new Promise((resolve) =>
        engine().setState(
          (prev) =>
            buildSelfQuestionDecryptSuccessState(
              prev,
              {
                surveyIndex: 0,
                questionId: FREEFORM_QID,
                clearMode: 'both',
                didUpdate: true,
                baselineSlice: prev.editBaseline,
                decryptedStateSlice: { answers: { [FREEFORM_QID]: { value: 'Old secret' } }, additionalComments: {} },
              },
              (value) => JSON.parse(JSON.stringify(value)),
            ),
          resolve,
        ),
      ),
  );
  await act(async () => engine().handleAnswerPile(FREEFORM_QID, ''));
  await settle();

  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));

  const [row] = h.submitResponses.mock.calls[0][2];
  expect(row.answer).toMatchObject({ value: '', encryptedPortion: '' });
  expect(row.additional).toMatchObject({ value: 'Public note' });
  expect(JSON.stringify(h.submitResponses.mock.calls[0][2])).not.toContain('old-secret');
});

it('keeps the lock when a decrypted answer would publish its still-masked Match Answer comment', async () => {
  const { buildSelfQuestionDecryptSuccessState } = require('./surveyToolDecryptFlow');
  const envelope = (tag) => JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: tag });
  const h = await fixture();
  h.add(
    'responses',
    savedFreeform(
      {
        value: '*',
        encrypted: true,
        encryptedPortion: envelope('answer'),
        encryptionAudience: 'self_admin',
        audienceMode: 'explicit',
      },
      {
        value: '*',
        encrypted: true,
        encryptedPortion: envelope('comment'),
        encryptionAudience: 'self_admin',
        audienceMode: 'inherit',
      },
    ),
  );
  await act(async () => h.sync());
  await h.mount();
  const engine = () => h.engine();
  await run(
    () =>
      new Promise((resolve) =>
        engine().setState(
          (prev) =>
            buildSelfQuestionDecryptSuccessState(
              prev,
              {
                surveyIndex: 0,
                questionId: FREEFORM_QID,
                clearMode: 'answer',
                didUpdate: true,
                baselineSlice: prev.editBaseline,
                decryptedStateSlice: { answers: { [FREEFORM_QID]: { value: 'Decrypted answer' } } },
              },
              (value) => JSON.parse(JSON.stringify(value)),
            ),
          resolve,
        ),
      ),
  );

  await act(async () => engine().toggleAnswerEncryption(0, FREEFORM_QID, false));
  await settle();

  const slice = engine().state.surveysResponseState[0];
  expect(slice.answers[FREEFORM_QID]).toMatchObject({ value: 'Decrypted answer', encrypted: true });
  expect(slice.additionalComments[FREEFORM_QID]).toMatchObject({ value: '*', encrypted: true });
  expect(engine().state.submissionError).toMatch(/decrypt the locked answer and comment/i);
});

const decryptSavedFreeform = (engine, decrypted) => {
  const { buildSelfQuestionDecryptSuccessState } = require('./surveyToolDecryptFlow');
  return run(
    () =>
      new Promise((resolve) =>
        engine().setState(
          (prev) =>
            buildSelfQuestionDecryptSuccessState(
              prev,
              {
                surveyIndex: 0,
                questionId: FREEFORM_QID,
                clearMode: 'both',
                didUpdate: true,
                baselineSlice: prev.editBaseline,
                decryptedStateSlice: {
                  answers: { [FREEFORM_QID]: { value: decrypted.answer } },
                  additionalComments: decrypted.comment ? { [FREEFORM_QID]: { value: decrypted.comment } } : {},
                },
              },
              (value) => JSON.parse(JSON.stringify(value)),
            ),
          resolve,
        ),
      ),
  );
};

it.each([
  ['an answer', { value: 'Public note', encrypted: false, audienceMode: 'explicit' }],
  ['an answer and its Match Answer comment', 'locked comment'],
])('keeps %s unlocked after Decrypt locked after a reload, without blocking other edits', async (_label, comment) => {
  const envelope = (tag) => JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: tag });
  const lockedComment =
    comment === 'locked comment'
      ? {
          value: '*',
          encrypted: true,
          encryptedPortion: envelope('comment'),
          encryptionAudience: 'self',
          audienceMode: 'inherit',
        }
      : comment;
  const h = await fixture();
  h.add(
    'responses',
    savedFreeform(
      {
        value: '*',
        encrypted: true,
        encryptedPortion: envelope('answer'),
        encryptionAudience: 'self',
        audienceMode: 'explicit',
        hash: '0xsalted',
      },
      lockedComment,
    ),
  );
  await act(async () => h.sync());
  await h.mount();
  const engine = () => h.engine();
  await decryptSavedFreeform(engine, {
    answer: 'Old secret',
    comment: comment === 'locked comment' ? 'Old note' : '',
  });
  await act(async () => engine().toggleAnswerEncryption(0, FREEFORM_QID, false));
  await act(async () => engine().handleAnswerPile(BINARY_QID, 'Yes'));
  await settle();
  expect(engine().getPendingEditStats().total).toBe(2);

  // Reloading restores drafts, which never hold the decrypted value.
  h.unmount();
  await h.mount();
  await settle();
  const slice = engine().state.surveysResponseState[0];
  expect(slice.answers[FREEFORM_QID]).toMatchObject({ value: '*', encrypted: true });
  if (comment === 'locked comment') {
    expect(slice.additionalComments[FREEFORM_QID]).toMatchObject({ value: '*', encrypted: true });
  }
  expect(engine().getPendingEditStats().total).toBe(1);
  for (
    let step = 0;
    step < 2 && engine().state.pileQuestions[engine().state.activePileIndex]?.id !== FREEFORM_QID;
    step += 1
  ) {
    await act(async () => engine().handleNext());
    await settle();
  }
  expect(screen.getAllByText(/Your unlock of this answer wasn't kept after the page reloaded/)).not.toHaveLength(0);

  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  const rows = h.submitResponses.mock.calls[0][2];
  expect(rows.map((row) => [row.questionID, row.answer.value])).toEqual([[BINARY_QID, 'Yes']]);
  expect(engine().state.submissionError || '').toBe('');
});

describe('View all editor after a reload', () => {
  const SAVED_ANSWER = { value: 'Saved public answer', encrypted: false, audienceMode: 'explicit' };
  // A comment typed in the pile is kept as a draft, then the page reloads.
  const draftCommentInPile = async () => {
    const h = await fixture();
    h.add('responses', savedFreeform(SAVED_ANSWER));
    await act(async () => h.sync());
    await h.mount();
    await act(async () => h.engine().handleAdditionalPile(FREEFORM_QID, 'Draft comment'));
    await settle();
    h.unmount();
    return h;
  };
  const expectUpload = async (h, answer, comment) => {
    await h.click();
    await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
    const row = h.submitResponses.mock.calls[0][2].find((response) => response.questionID === FREEFORM_QID);
    expect(row).toMatchObject({ answer: { value: answer }, additional: { value: comment } });
  };
  const expectSavedAnswerAndDraft = async (h) => {
    expect(screen.getByDisplayValue('Saved public answer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Draft comment')).toBeInTheDocument();
    await expectUpload(h, 'Saved public answer', 'Draft comment');
  };

  it('shows the saved answer with the restored draft and uploads both', async () => {
    const h = await draftCommentInPile();
    await h.mountEditor();
    await expectSavedAnswerAndDraft(h);
  });

  it('does the same for a question that joins the list later', async () => {
    const h = await draftCommentInPile();
    await h.mountEditor({ questionPool: [] });
    await act(async () => h.rerender({ questionPool: [FREEFORM_QUESTION] }));
    await settle();
    await expectSavedAnswerAndDraft(h);
  });

  it('does the same again when sign-in completes', async () => {
    const h = await draftCommentInPile();
    await h.mountEditor({ loginComplete: false });
    await act(async () => h.rerender({ loginComplete: true }));
    await settle();
    await expectSavedAnswerAndDraft(h);
  });

  it('keeps an edit made in View all when the question list changes again', async () => {
    const h = await draftCommentInPile();
    await h.mountEditor();
    fireEvent.change(screen.getByDisplayValue('Draft comment'), { target: { value: 'Edited in View all' } });
    // The input hands the edit to the form on the next frame; the draft is saved 150 ms later.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 40)));
    // The list is replaced (same questions) before the edit is saved as a draft.
    await act(async () => h.rerender({ questionPool: [{ ...FREEFORM_QUESTION }] }));
    await settle();
    expect(screen.getByDisplayValue('Edited in View all')).toBeInTheDocument();
    await expectUpload(h, 'Saved public answer', 'Edited in View all');
  });

  it('restores the draft again for a question that leaves the list and returns', async () => {
    const h = await draftCommentInPile();
    await h.mountEditor();
    expect(screen.getByDisplayValue('Draft comment')).toBeInTheDocument();
    await act(async () =>
      h.rerender({ questionPool: [{ id: BINARY_QID, type: 'binary', prompt: 'Binary question' }] }),
    );
    await settle();
    await act(async () => h.rerender({ questionPool: [FREEFORM_QUESTION] }));
    await settle();
    await expectSavedAnswerAndDraft(h);
  });

  it('restores the draft from a newer load when the first load is superseded', async () => {
    const h = await draftCommentInPile();
    h.renderEditor();
    // A counter change starts a newer saved-answer load before the first one finishes.
    h.rerender({ questionResponsesNonce: 2, questionsCacheNonce: 2 });
    await settle();
    await expectSavedAnswerAndDraft(h);
  });

  it('keeps a newer saved answer over a draft answer written against an older one', async () => {
    const h = await fixture();
    h.add('responses', savedFreeform(SAVED_ANSWER));
    await act(async () => h.sync());
    await h.mount();
    await act(async () => h.engine().handleAnswerPile(FREEFORM_QID, 'Draft answer'));
    await act(async () => h.engine().handleAdditionalPile(FREEFORM_QID, 'Draft comment'));
    await settle();
    h.unmount();
    // Another device saves a newer answer before this page reloads.
    h.add('responses', savedFreeform({ ...SAVED_ANSWER, value: 'Newer saved answer' }));
    await act(async () => h.sync());

    await h.mountEditor();
    expect(screen.getByDisplayValue('Newer saved answer')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Draft answer')).toBeNull();
    expect(screen.getByDisplayValue('Draft comment')).toBeInTheDocument();
    await expectUpload(h, 'Newer saved answer', 'Draft comment');
  });

  it('says when a reload could not keep an unlock', async () => {
    const envelope = JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: 'answer' });
    const h = await fixture();
    h.add(
      'responses',
      savedFreeform({
        value: '*',
        encrypted: true,
        encryptedPortion: envelope,
        encryptionAudience: 'self',
        audienceMode: 'explicit',
        hash: '0xsalted',
      }),
    );
    await act(async () => h.sync());
    await h.mount();
    await decryptSavedFreeform(h.engine, { answer: 'Old secret', comment: '' });
    await act(async () => h.engine().toggleAnswerEncryption(0, FREEFORM_QID, false));
    await settle();
    h.unmount();

    await h.mountEditor();
    expect(screen.getByText(/Your unlock of this answer wasn't kept after the page reloaded/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Old secret')).toBeNull();
  });
});
