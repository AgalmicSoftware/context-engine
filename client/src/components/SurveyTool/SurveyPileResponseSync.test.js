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
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));
const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');
const SLUG = 'response-sync';
const OWNER = `0x${'33'.repeat(20)}`;
const OTHER_OWNER = `0x${'66'.repeat(20)}`;
const QID = `0x${'ab'.repeat(32)}`;
const OTHER_QID = `0x${'cd'.repeat(32)}`;
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
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
const controllers = [];
afterEach(async () => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  jest.restoreAllMocks();
  for (const namespace of ['questionsCache', 'surveysCache', 'userCache'])
    await cacheScripts.removeCache(namespace, SLUG);
  sessionStorage.clear();
  localStorage.clear();
});

// Storage transport only; both the response controller and own-answer loader are real.
const fixture = async ({
  capped = false,
  globalGate,
  ownGate,
  legacyOwn = false,
  failGlobal = () => false,
  failOwn = () => false,
} = {}) => {
  const rows = { questions: [], surveys: [], responses: [] };
  let sequence = 0;
  const add = (resource, payload, responder = OWNER, beyondCap = false) => {
    sequence += 1;
    const storageRef = { id: `response-sync-${sequence}`, backend: 'cloudflare', resource };
    rows[resource].push({
      storageRef,
      beyondCap,
      metadata: { responder, createdAt: new Date(Date.parse('2026-01-01') + sequence * 60000).toISOString() },
      payload: { ...payload, sessionSlug: SLUG, sessionId: SESSION_ID },
    });
    return storageRef;
  };
  [QID, OTHER_QID].forEach((id) => add('questions', { id, type: 'freeform', prompt: 'Example question' }));
  const listPage = jest.fn(async ({ resource, ownResponses, cursor }) => {
    if (ownResponses) {
      if (legacyOwn) throw new storageClient.LegacyOwnResponseListingError();
      if (ownGate) await ownGate.promise;
      if (failOwn()) throw new Error('Own answers unavailable');
    }
    const filtered = rows[resource].filter((row) =>
      ownResponses ? row.metadata.responder === ownResponses.account : !row.beyondCap,
    );
    if (resource === 'responses' && !ownResponses && capped) {
      const page = cursor ? Number(cursor) : 0;
      return { items: page === 0 ? filtered : [], cursor: String(page + 1), listComplete: false };
    }
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
      if (globalGate) await globalGate.promise;
      if (failGlobal()) throw new Error('Response sync unavailable');
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
    await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(2));
    await settle();
    if (engine.state.pileQuestions[engine.state.activePileIndex].id !== QID) {
      await act(async () => engine.handleNext());
      await settle();
    }
  };
  const click = async () => {
    await act(async () => fireEvent.click(screen.getByTestId(E2E_TESTIDS.SURVEY_SUBMIT)));
  };
  return { add, state, host, sync, mount, click, submitResponses, listPage, engine: () => engine, view: () => view };
};

it('shows feedback while the first sync and own-answer read are pending, then preserves saved fields', async () => {
  const gate = deferred();
  const h = await fixture({ globalGate: gate, ownGate: gate });
  h.add('responses', SAVED);
  let run;
  await act(async () => {
    run = h.sync();
  });
  await h.mount();
  await act(async () => h.engine().handleAdditionalPile(QID, 'New comment'));
  await h.click();
  await h.click();
  expect(screen.getByText('Loading your saved answers…')).toBeInTheDocument();
  expect(h.submitResponses).not.toHaveBeenCalled();
  expect(h.listPage.mock.calls.filter(([args]) => args.ownResponses)).toHaveLength(1);
  await act(async () => {
    gate.resolve();
    await run;
  });
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  expect(h.submitResponses.mock.calls[0][2][0]).toMatchObject({ ...SAVED, additional: { value: 'New comment' } });
});

it('submits on the first click when an empty initial response sync is complete', async () => {
  const h = await fixture();
  await act(async () => h.sync());
  await h.mount();
  await act(async () => h.engine().handleAnswerPile(QID, 'First answer'));
  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
});

it('opens login while signed out and submits after sign-in', async () => {
  const h = await fixture();
  await act(async () => h.sync());
  const toggleLoginModal = jest.fn();
  await h.mount({ account: '', loginComplete: false, toggleLoginModal });
  await act(async () => h.engine().handleAnswerPile(QID, 'First answer'));
  await h.click();
  expect(toggleLoginModal).toHaveBeenCalled();
  expect(h.submitResponses).not.toHaveBeenCalled();
  await act(async () => h.view().rerenderSurveyQuestions({ account: OWNER, loginComplete: true }));
  await settle();
  await act(async () => h.engine().handleAnswerPile(QID, 'First answer'));
  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
});

it('loads an owner answer beyond a capped public listing before submitting its new comment', async () => {
  const h = await fixture({ capped: true });
  h.add('responses', { ...SAVED, questionID: OTHER_QID }, OTHER_OWNER);
  h.add('responses', SAVED, OWNER, true);
  await act(async () => h.sync());
  expect(h.state.isResponsesCacheReady).toBe(false);
  await h.mount();
  expect(h.engine().state.surveysResponseState[0].answers[QID].value).toBe('');
  await act(async () => h.engine().handleAdditionalPile(QID, 'New comment'));
  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  expect(h.submitResponses.mock.calls[0][2][0]).toMatchObject({ ...SAVED, additional: { value: 'New comment' } });
  expect(h.listPage.mock.calls.some(([args]) => args.ownResponses?.account === OWNER)).toBe(true);
});

it('keeps a failed initial load blocked with a retry message, then retries the own read on the next click', async () => {
  let failOwn = true;
  const h = await fixture({ failGlobal: () => true, failOwn: () => failOwn });
  h.add('responses', SAVED);
  await act(async () => {
    await expect(h.sync()).rejects.toThrow('Response sync unavailable');
  });
  await h.mount();
  await act(async () => h.engine().handleAdditionalPile(QID, 'New comment'));
  await h.click();
  await waitFor(() =>
    expect(screen.getByText(/could not load your saved answers.*try submit again/i)).toBeInTheDocument(),
  );
  expect(h.state.isResponsesCacheReady).toBe(false);
  expect(h.submitResponses).not.toHaveBeenCalled();
  failOwn = false;
  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
  expect(h.submitResponses.mock.calls[0][2][0]).toMatchObject({ ...SAVED, additional: { value: 'New comment' } });
});

it('keeps a legacy Worker with an incomplete public listing blocked instead of overwriting omitted answers', async () => {
  const h = await fixture({ capped: true, legacyOwn: true });
  h.add('responses', SAVED, OWNER, true);
  await act(async () => h.sync());
  await h.mount();
  await act(async () => h.engine().handleAdditionalPile(QID, 'New comment'));
  await h.click();
  await waitFor(() =>
    expect(screen.getByText(/saved answers are still loading.*try submit again/i)).toBeInTheDocument(),
  );
  expect(h.submitResponses).not.toHaveBeenCalled();
  expect(h.state.isResponsesCacheReady).toBe(false);
});

it('restores completed readiness after the mount-time refresh fails once', async () => {
  let calls = 0;
  const h = await fixture({ failGlobal: () => ++calls === 2 });
  await act(async () => h.sync());
  await h.mount();
  await waitFor(() => expect(h.host.loadWorkerResponses).toHaveBeenCalledTimes(2));
  expect(h.state.isResponsesCacheReady).toBe(true);
  await act(async () => h.engine().handleAnswerPile(QID, 'First answer'));
  await h.click();
  await waitFor(() => expect(h.submitResponses).toHaveBeenCalledTimes(1));
});

it.each(['account', 'worker'])('discards a pending own-answer read after the %s changes', async (target) => {
  const ownGate = deferred();
  const h = await fixture({ failGlobal: () => true, ownGate });
  h.add('responses', SAVED);
  await h.mount();
  await act(async () => h.engine().handleAdditionalPile(QID, 'New comment'));
  await h.click();
  await waitFor(() => expect(h.listPage.mock.calls.some(([args]) => args.ownResponses)).toBe(true));
  await act(async () =>
    h
      .view()
      .rerenderSurveyQuestions(
        target === 'account'
          ? { account: OTHER_OWNER }
          : { sessionConfig: { ...CONFIG, corsWorkerUrl: 'https://other-response-sync.example/' } },
      ),
  );
  await act(async () => ownGate.resolve());
  await settle();
  expect(h.submitResponses).not.toHaveBeenCalled();
});
