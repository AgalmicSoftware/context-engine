import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
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

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({
  __esModule: true,
  default: () => null,
  SessionListeningWaveform: () => null,
  formatSessionRecordingElapsed: () => '0:00',
}));
jest.mock('./SessionInterviewRecommendedGroups', () => ({ __esModule: true, default: () => null }));
jest.mock('./useSessionInterviewGroupRecommendations', () => ({
  useSessionInterviewGroupRecommendations: () => ({ availability: 'idle', recommendations: [] }),
}));
jest.mock('./useInterviewReadiness', () => ({
  useInterviewReadiness: () => ({ state: 'ready', detail: '', retry: jest.fn() }),
}));
jest.mock('./useInterviewOpening', () => ({
  useInterviewOpening: () => ({ opening: '', notice: '', loading: false }),
}));
jest.mock('./sessionInterview', () => ({
  ...jest.requireActual('./sessionInterview'),
  hashInterviewQuestions: jest.fn(async () => 'a'.repeat(64)),
  mapInterviewEvidenceToResponses: jest.fn(),
}));
jest.mock('../../utilities/audio/realtimeInterviewClient', () => ({ startSessionRealtimeInterview: jest.fn() }));
const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');
const SLUG = 'own-read';
const OWNER = `0x${'33'.repeat(20)}`;
const QID = `0x${'ab'.repeat(32)}`;
const BLANK_QID = `0x${'ef'.repeat(32)}`;
const QUESTION_IDS = [QID, ...['bc', 'cd'].map((part) => `0x${part.repeat(32)}`), BLANK_QID];
const SESSION_ID = `0x${'44'.repeat(16)}`;
const PUBLIC_ACCESS = { gate: 'none', encryption: 'none' };
const CONFIG = {
  slug: SLUG,
  sessionId: SESSION_ID,
  sessionIdHex: SESSION_ID,
  corsWorkerUrl: 'https://response-sync.example/',
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
const SAVED = {
  questionID: QID,
  type: 'freeform',
  answer: { value: 'Saved answer', encrypted: false },
  additional: { value: 'Saved comment', encrypted: false },
  importance: 7,
  conviction: 8,
};
const pendingGates = [];
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  const gate = { promise, resolve, reject };
  pendingGates.push(gate);
  return gate;
};
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
const controllers = [];
afterEach(async () => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  await act(async () => pendingGates.splice(0).forEach((gate) => gate.resolve()));
  expect(globalThis.fetch).not.toHaveBeenCalled();
  jest.restoreAllMocks();
  for (const namespace of ['questionsCache', 'surveysCache', 'userCache'])
    await cacheScripts.removeCache(namespace, SLUG);
  sessionStorage.clear();
  localStorage.clear();
});

// Storage transport only; both the response controller and own-answer loader are real.
const fixture = async () => {
  const globalGate = deferred();
  const hooks = { ownRead: null };
  const envelopes = new Map();
  const rows = { questions: [], surveys: [], responses: [] };
  let sequence = 0;
  const add = (resource, payload, responder = OWNER) => {
    sequence += 1;
    const storageRef = { id: `response-sync-${sequence}`, backend: 'cloudflare', resource };
    rows[resource].push({
      storageRef,
      metadata: { responder, createdAt: new Date(Date.parse('2026-01-01') + sequence * 60000).toISOString() },
      payload: { ...payload, sessionSlug: SLUG, sessionId: SESSION_ID },
    });
    return storageRef;
  };
  QUESTION_IDS.forEach((id) => add('questions', { id, type: 'freeform', prompt: 'Example question' }));
  const listPage = jest.fn(async ({ resource, ownResponses, signal }) => {
    if (ownResponses && hooks.ownRead) await hooks.ownRead(signal);
    const filtered = rows[resource].filter((row) => !ownResponses || row.metadata.responder === ownResponses.account);
    return { items: filtered, cursor: null, listComplete: true };
  });
  const readBlob = async ({ storageRef }) => ({
    json: async () => rows[storageRef.resource].find((row) => row.storageRef.id === storageRef.id).payload,
  });
  const deps = { listSessionStorageRefsPage: listPage, readSessionStorageBlob: readBlob };
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network access'));
  jest.spyOn(storageClient, 'listSessionStorageRefsPage').mockImplementation(listPage);
  jest.spyOn(storageClient, 'readSessionStorageBlob').mockImplementation(readBlob);
  jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(CONFIG);
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  const encrypt = (value, audience = 'self') => {
    const envelope = JSON.stringify({
      v: 1,
      ciphertext: `cipher-${envelopes.size}`,
      recipients: [{ type: 'self-eip712-v1' }],
    });
    envelopes.set(envelope, { value, audience });
    return envelope;
  };
  jest
    .spyOn(cryptoUtils, 'encryptEnvelopeValue')
    .mockImplementation(async (value, opts = {}) => encrypt(value, opts.encryptionAudience));
  jest.spyOn(cryptoUtils, 'encryptMultipleAnswers').mockImplementation(async (slice) => {
    const fields = (entries) =>
      Object.fromEntries(
        Object.entries(entries || {}).map(([id, field]) => [
          id,
          {
            ...field,
            value: '*',
            encrypted: true,
            encryptedPortion: encrypt(field.value, field.encryptionAudience),
            hash: '0x01',
          },
        ]),
      );
    return { answers: fields(slice.answers), additionalComments: fields(slice.additionalComments), importance: {} };
  });
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
    loadWorkerResponses: jest.fn(async (opts) => {
      await globalGate.promise;
      return loadWorkerResponses(opts, deps);
    }),
  };
  const controller = createSessionResponseHydrationController(host);
  controllers.push(controller);
  const sync = () => controller.fetchQuestionResponsesChunkedForGroup(SLUG);
  const mount = async (props = {}) => {
    const strategy = createPileViewRuntimeStrategy();
    const original = strategy.render;
    strategy.render = (current) => {
      engine = current;
      return original(current);
    };
    view = renderSurveyPileViewMode({
      minifiedMode: 'pile',
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
      onFilterChange: jest.fn(),
      runtimeStrategy: strategy,
      refreshQuestionResponses: (ids, opts) => controller.refreshQuestionResponses(ids, opts),
      toggleLoginModal: jest.fn(),
      ...props,
    });
    await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(4));
    await settle();
    if (engine.state.pileQuestions[engine.state.activePileIndex].id !== QID) {
      await act(async () => engine.handleNext());
      await settle();
    }
  };
  const click = async () => {
    await act(async () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)));
  };
  return {
    add,
    state,
    host,
    sync,
    mount,
    click,
    submitResponses,
    listPage,
    hooks,
    globalGate,
    envelopes,
    engine: () => engine,
    view: () => view,
  };
};

const goTo = async (h, id) => {
  for (let index = 0; index < QUESTION_IDS.length; index += 1) {
    if (h.engine().state.pileQuestions[h.engine().state.activePileIndex].id === id) return;
    const target = h.engine().state.pileQuestions.findIndex((question) => question.id === id);
    await act(async () =>
      target < h.engine().state.activePileIndex ? h.engine().handlePrev() : h.engine().handleNext(),
    );
    await settle();
  }
  throw new Error('Question was not reachable');
};
const setup = async () => {
  const h = await fixture();
  h.add('responses', SAVED);
  await h.mount();
  await goTo(h, QID);
  return h;
};
const slice = (h) => h.engine().state.surveysResponseState[0];
const editComment = async (h) => act(async () => h.engine().handleAdditionalPile(QID, 'Updated comment'));
const ownCalls = (h) => h.listPage.mock.calls.filter(([args]) => args.ownResponses);
const completeSync = async (h) => {
  await act(async () => {
    h.globalGate.resolve();
    await h.sync();
  });
  await waitFor(() => expect(h.state.isResponsesCacheReady).toBe(true));
};
const lockBlank = async (h, field) => {
  await goTo(h, BLANK_QID);
  await act(async () => {
    if (field === 'answers') {
      h.engine().toggleAnswerEncryption(0, BLANK_QID, true);
      h.engine().applyAnswerEncryptionAudience(0, BLANK_QID, 'self');
    } else {
      h.engine().toggleAdditionalCommentsEncryption(0, BLANK_QID, true);
      h.engine().applyAdditionalEncryptionAudience(0, BLANK_QID, 'self');
    }
  });
  expect(slice(h)[field][BLANK_QID]).toMatchObject({ encrypted: true, encryptionAudience: 'self' });
};

it.each(['answers', 'additionalComments'])(
  'keeps a blank %s lock when submitting another question, then encrypts later typing',
  async (field) => {
    const h = await setup();
    await lockBlank(h, field);
    await goTo(h, QID);
    await editComment(h);
    await h.click();
    await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
    expect(h.submitResponses.mock.calls[0][1]).toEqual([QID]);
    expect(h.submitResponses.mock.calls[0][2][0]).toMatchObject({ ...SAVED, additional: { value: 'Updated comment' } });
    expect(slice(h)[field][BLANK_QID]).toMatchObject({ encrypted: true, encryptionAudience: 'self' });
    await goTo(h, BLANK_QID);
    if (field === 'answers') {
      const lock = screen
        .getAllByTestId(E2E_TESTIDS.SURVEY_ANSWER_LOCK)
        .find((button) => button.querySelector('[data-icon="lock"]'));
      expect(lock).toBeDefined();
      await act(async () => h.engine().handleAnswerPile(BLANK_QID, 'Private later answer'));
    } else {
      const toggle = screen
        .getAllByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_TOGGLE)
        .find((button) => button.getAttribute('data-ce-question-id') === BLANK_QID);
      fireEvent.click(toggle);
      const lock = screen
        .getAllByTestId(E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK)
        .find((button) => button.querySelector('[data-icon="lock"]'));
      expect(lock).toBeDefined();
      await act(async () => h.engine().handleAdditionalPile(BLANK_QID, 'Private later comment'));
    }
    await h.click();
    await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(2));
    const row = h.submitResponses.mock.calls[1][2].find((entry) => entry.questionID === BLANK_QID);
    const uploaded = field === 'answers' ? row.answer : row.additional;
    expect(uploaded).toMatchObject({ value: '*', encrypted: true, encryptionAudience: 'self' });
    expect(h.envelopes.get(uploaded.encryptedPortion)).toEqual({
      value: field === 'answers' ? 'Private later answer' : 'Private later comment',
      audience: 'self',
    });
    expect(JSON.stringify(h.submitResponses.mock.calls)).not.toContain('Private later');
  },
);

it('keeps an unsubmitted blank lock when interview Apply runs its own-answer merge', async () => {
  const h = await setup();
  await lockBlank(h, 'answers');
  await act(async () =>
    h.engine().setState({
      showVoiceModeModal: true,
      sessionVoiceMode: 'interview',
      interviewPrefillPacket: {
        version: 1,
        sessionSlug: SLUG,
        questionSetHash: 'a'.repeat(64),
        promptVersion: 'ce-interview-brief-v5',
        source: { platform: 'claude', modelId: 'example-model', verification: 'self_reported' },
        responses: [{ questionId: QID, answer: 'Reviewed answer', confidence: 0.8 }],
      },
    }),
  );
  await screen.findByTestId(E2E_TESTIDS.SESSION_INTERVIEW_REVIEW);
  await waitFor(() => expect(ownCalls(h).length).toBeGreaterThan(0));
  const replace = await screen.findByText(/Replace with draft|Restore draft/);
  fireEvent.click(replace);
  const before = ownCalls(h).length;
  await act(async () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SESSION_INTERVIEW_APPLY)));
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  expect(ownCalls(h).length).toBeGreaterThan(before);
  expect(h.submitResponses.mock.calls[0][1]).toEqual([QID]);
  expect(slice(h).answers[BLANK_QID]).toMatchObject({ encrypted: true, encryptionAudience: 'self' });
});

it('includes questions visited during the own read without refusing the pending submit', async () => {
  const h = await setup();
  const gate = deferred();
  h.hooks.ownRead = () => gate.promise;
  await editComment(h);
  expect(slice(h).answers[BLANK_QID]).toBeUndefined();
  await h.click();
  expect(ownCalls(h)).toHaveLength(1);
  await goTo(h, BLANK_QID);
  expect(slice(h).answers[BLANK_QID]).toBeDefined();
  await act(async () => gate.resolve());
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  expect(h.submitResponses.mock.calls[0][2][0]).toMatchObject({ ...SAVED, additional: { value: 'Updated comment' } });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('clears loading after sign-out and relogin without submitting the stale read', async () => {
  const h = await setup();
  const gate = deferred();
  h.hooks.ownRead = () => gate.promise;
  await editComment(h);
  await h.click();
  expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)).toHaveTextContent('Loading your saved answers');
  await act(async () => h.view().rerenderSurveyQuestions({ account: '', loginComplete: false }));
  await act(async () => gate.resolve());
  await settle();
  await act(async () => h.view().rerenderSurveyQuestions({ account: OWNER, loginComplete: true }));
  await completeSync(h);
  await goTo(h, BLANK_QID);
  await act(async () => h.engine().handleAnswerPile(BLANK_QID, 'New answer'));
  expect(h.submitResponses).not.toHaveBeenCalled();
  expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)).not.toHaveTextContent('Loading your saved answers');
});

it.each(['resolve', 'reject'])('supersedes a hung own read once ready and ignores its late %s', async (completion) => {
  const h = await setup();
  const gate = deferred();
  h.hooks.ownRead = () => gate.promise;
  await editComment(h);
  await h.click();
  const oldSignal = ownCalls(h)[0][0].signal;
  await completeSync(h);
  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  expect(oldSignal.aborted).toBe(true);
  expect(h.engine().state.pileSubmitTempText).not.toContain('Loading your saved answers');
  expect(screen.queryByText('Loading your saved answers…')).not.toBeInTheDocument();
  const afterSubmit = JSON.stringify(slice(h));
  await act(async () => (completion === 'resolve' ? gate.resolve() : gate.reject(new Error('Late failure'))));
  await settle();
  expect(h.submitResponses).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(slice(h))).toBe(afterSubmit);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('does not clear a newer own read label when an aborted read finishes', async () => {
  const h = await setup();
  const oldGate = deferred();
  const newGate = deferred();
  h.hooks.ownRead = () => oldGate.promise;
  await editComment(h);
  await h.click();
  await act(async () => h.view().rerenderSurveyQuestions({ account: '', loginComplete: false }));
  await act(async () => h.view().rerenderSurveyQuestions({ account: OWNER, loginComplete: true }));
  await settle();
  h.hooks.ownRead = () => newGate.promise;
  await goTo(h, QID);
  await editComment(h);
  await h.click();
  expect(ownCalls(h)).toHaveLength(2);
  await act(async () => oldGate.resolve());
  await settle();
  expect(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)).toHaveTextContent('Loading your saved answers');
  expect(h.submitResponses).not.toHaveBeenCalled();
  await act(async () => newGate.resolve());
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
});

it('keeps a blank comment lock after submitting its public answer and completing sync', async () => {
  const h = await setup();
  await goTo(h, BLANK_QID);
  await act(async () => h.engine().handleAnswerPile(BLANK_QID, 'Public answer'));
  await lockBlank(h, 'additionalComments');
  await goTo(h, QID);
  await editComment(h);
  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  expect(h.submitResponses.mock.calls[0][1]).toEqual(expect.arrayContaining([QID, BLANK_QID]));
  await completeSync(h);
  await goTo(h, BLANK_QID);
  await settle();
  expect(slice(h).additionalComments[BLANK_QID]).toMatchObject({
    value: '',
    encrypted: true,
    encryptionAudience: 'self',
  });
  await act(async () => h.engine().handleAdditionalPile(BLANK_QID, 'Private later comment'));
  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(2));
  const row = h.submitResponses.mock.calls[1][2].find((entry) => entry.questionID === BLANK_QID);
  expect(row.additional).toMatchObject({ value: '*', encrypted: true, encryptionAudience: 'self' });
  expect(h.envelopes.get(row.additional.encryptedPortion)).toEqual({
    value: 'Private later comment',
    audience: 'self',
  });
  expect(JSON.stringify(h.submitResponses.mock.calls)).not.toContain('Private later comment');
});

it.each(['answers', 'additionalComments'])(
  'preserves only an explicit blank %s lock when hydrating another empty public field',
  async (field) => {
    const h = await setup();
    const locked = {
      value: '',
      encrypted: true,
      encryptedPortion: '',
      encryptionAudience: 'self',
      audienceMode: 'explicit',
    };
    const apply = (current, cached, allowMaskedDraftEmpty = false) => {
      const target = {
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
        [field]: { [QID]: current },
      };
      h.engine()._applyLocalCacheHydrationEntryToSlice({
        targetSlice: target,
        questionId: QID,
        [field === 'answers' ? 'cachedAnswer' : 'cachedAdditional']: cached,
        [field === 'answers' ? 'allowMaskedAnswerDraftEmpty' : 'allowMaskedAdditionalDraftEmpty']:
          allowMaskedDraftEmpty,
      });
      return target[field][QID];
    };
    expect(apply(locked, { value: '', encrypted: false, encryptedPortion: '' })).toEqual(locked);
    expect(apply(locked, { value: 'Saved text', encrypted: false })).toMatchObject({
      value: 'Saved text',
      encrypted: false,
    });
    expect(apply(locked, { value: '*', encrypted: true, encryptedPortion: 'saved-cipher' })).toMatchObject({
      value: '*',
      encryptedPortion: 'saved-cipher',
    });
    expect(
      apply(
        { ...locked, value: '*', encryptedPortion: 'saved-cipher' },
        { ...locked, encryptedPortion: 'saved-cipher' },
        true,
      ),
    ).toMatchObject({ value: '', encryptedPortion: 'saved-cipher' });
    expect(
      apply(
        { ...locked, encryptedPortion: 'saved-cipher' },
        { value: '*', encrypted: true, encryptedPortion: 'saved-cipher' },
      ),
    ).toMatchObject({ value: '', encryptedPortion: 'saved-cipher' });
    expect(apply({ ...locked, audienceMode: 'inherited' }, { value: '', encrypted: false })).toMatchObject({
      encrypted: false,
    });
  },
);

it('keeps a new blank comment lock over a previously saved public answer during the own read', async () => {
  const h = await setup();
  h.add('responses', {
    ...SAVED,
    questionID: BLANK_QID,
    answer: { value: 'Previously saved answer', encrypted: false },
    additional: { value: '', encrypted: false },
  });
  await lockBlank(h, 'additionalComments');
  await goTo(h, QID);
  await editComment(h);
  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  expect(h.submitResponses.mock.calls[0][1]).toEqual([QID]);
  expect(slice(h).answers[BLANK_QID]).toMatchObject({ value: 'Previously saved answer', encrypted: false });
  expect(slice(h).additionalComments[BLANK_QID]).toMatchObject({
    value: '',
    encrypted: true,
    encryptionAudience: 'self',
  });
  await goTo(h, BLANK_QID);
  await act(async () => h.engine().handleAdditionalPile(BLANK_QID, 'Private comment after own read'));
  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(2));
  const row = h.submitResponses.mock.calls[1][2].find((entry) => entry.questionID === BLANK_QID);
  expect(row.answer).toMatchObject({ value: 'Previously saved answer', encrypted: false });
  expect(row.additional).toMatchObject({ value: '*', encrypted: true, encryptionAudience: 'self' });
  expect(h.envelopes.get(row.additional.encryptedPortion)).toEqual({
    value: 'Private comment after own read',
    audience: 'self',
  });
  expect(JSON.stringify(h.submitResponses.mock.calls)).not.toContain('Private comment after own read');
});
