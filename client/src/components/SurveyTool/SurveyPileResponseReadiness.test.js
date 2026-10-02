import { act, waitFor } from '@testing-library/react';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort.js';
import { cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import {
  hydrateWorkerCanonicalQuestionCache,
  hydrateWorkerCanonicalSurveyCache,
} from '../../utilities/survey/workerCanonicalCacheHydration';
import {
  loadWorkerCanonicalQuestions,
  loadWorkerCanonicalSurveys,
} from '../../domains/surveys/workerCanonicalMetadataHydrationPort';
import {
  hydrateWorkerCanonicalResponses,
  resolveWorkerResponseHydrationRun,
} from '../../utilities/survey/workerResponseHydrationRuntime';
import { loadWorkerResponses } from '../../utilities/survey/workerResponseHydration';

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));

const { cryptoUtils } = require('../../utilities/crypto/cryptography.js');
const SLUG = 'response-readiness';
const OWNER = `0x${'33'.repeat(20)}`;
const QUESTION_ID = `0x${'ab'.repeat(32)}`;
const QUESTION_IDS = [QUESTION_ID, ...['bc', 'cd', 'de'].map((hex) => `0x${hex.repeat(32)}`)];
const SESSION_ID = `0x${'44'.repeat(16)}`;
const PUBLIC_ACCESS = { gate: 'none', encryption: 'none' };
const SESSION_CONFIG = {
  slug: SLUG,
  sessionId: SESSION_ID,
  sessionIdHex: SESSION_ID,
  corsWorkerUrl: 'https://readiness-worker.example/',
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
const SAVED_RESPONSE = {
  questionID: QUESTION_ID,
  type: 'freeform',
  prompt: 'Example question',
  answer: { value: 'Saved answer', encrypted: false },
  additional: { value: 'Saved comment', encrypted: false },
  importance: 7,
  conviction: 8,
};

// Model only storage transport: each Worker upload creates a new immutable row.
const createWorkerStore = () => {
  const rows = { questions: [], surveys: [], responses: [] };
  let sequence = 0;
  const add = (resource, payload, responder = '') => {
    sequence += 1;
    const storageRef = {
      id: `readiness${sequence}`,
      backend: 'cloudflare',
      resource,
      createdAt: new Date(Date.parse('2026-01-01T00:00:00Z') + sequence * 60_000).toISOString(),
    };
    rows[resource].push({
      storageRef,
      metadata: { resource, createdAt: storageRef.createdAt, ...(responder ? { responder } : {}) },
      payload: JSON.parse(JSON.stringify({ ...payload, sessionSlug: SLUG, sessionId: SESSION_ID })),
    });
    return storageRef;
  };
  QUESTION_IDS.forEach((id) => add('questions', { id, type: 'freeform', prompt: 'Example question' }));
  add('surveys', { surveyID: `0x${'55'.repeat(32)}`, questionIDs: QUESTION_IDS, title: 'Example survey' });
  return {
    rows,
    add,
    deps: {
      listSessionStorageRefsPage: async ({ resource }) => ({
        items: rows[resource].map(({ storageRef, metadata }) => ({ storageRef, metadata })),
        cursor: null,
        listComplete: true,
      }),
      readSessionStorageBlob: async ({ storageRef }) => ({
        json: async () => rows[storageRef.resource].find((row) => row.storageRef.id === storageRef.id).payload,
      }),
    },
  };
};

const persistTo = (namespace) => async (merge) => {
  await cacheScripts.updateCacheAtomic(namespace, SLUG, merge);
  return true;
};
const syncMetadata = async (store) => {
  const common = {
    host: {
      getSessionCfg: () => SESSION_CONFIG,
      getAccount: () => OWNER,
      workerCanonicalMetadataHydrationPort: {
        loadQuestions: (input) => loadWorkerCanonicalQuestions(input, store.deps),
        loadSurveys: (input) => loadWorkerCanonicalSurveys(input, store.deps),
      },
    },
    sessionConfig: SESSION_CONFIG,
    sessionSlug: SLUG,
    createPersistenceError: (message) => new Error(message),
    onSuccess: () => {},
  };
  await hydrateWorkerCanonicalQuestionCache({ ...common, persist: persistTo('questionsCache') });
  await hydrateWorkerCanonicalSurveyCache({ ...common, persist: persistTo('surveysCache') });
};
const syncResponses = (store) =>
  hydrateWorkerCanonicalResponses({
    sessionSlug: SLUG,
    sessionConfig: SESSION_CONFIG,
    run: resolveWorkerResponseHydrationRun({ sessionConfig: SESSION_CONFIG, sessionSlug: SLUG }),
    loadWorkerResponses: (opts) => loadWorkerResponses(opts, store.deps),
    getAccount: () => OWNER,
    getProviderLike: () => null,
    getCurrentSessionConfig: () => SESSION_CONFIG,
    shouldAbort: () => false,
    markLoading: () => {},
    markReady: () => {},
    updateQuestionsCacheAtomic: persistTo('questionsCache'),
    updateUserCacheAtomic: persistTo('userCache'),
    createPersistenceError: (message) => new Error(message),
  });

afterEach(async () => {
  jest.restoreAllMocks();
  for (const namespace of ['questionsCache', 'surveysCache', 'userCache']) {
    await cacheScripts.removeCache(namespace, SLUG);
  }
  sessionStorage.clear();
  localStorage.clear();
});

const mountWhileResponsesLoad = async (store, responsesReady = false) => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network access'));
  jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(SESSION_CONFIG);
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  jest.spyOn(surveyQuestionReadsPort, 'getResponse').mockResolvedValue(null);
  jest.spyOn(surveyQuestionReadsPort, 'getSurveyResponse').mockResolvedValue(null);
  const submitResponses = jest
    .spyOn(contractScriptsModule.default, 'submitResponses')
    .mockImplementation(async (_provider, questionIds, responses) => {
      const questionResponseRefs = responses.map((response, index) => ({
        questionId: questionIds[index],
        storageRef: store.add('responses', response, OWNER),
      }));
      return {
        workerCanonicalSubmission: true,
        questionResponseRefs,
        sessionSlug: SLUG,
        storageRefs: questionResponseRefs.map((row) => row.storageRef),
      };
    });
  await syncMetadata(store);
  let engine;
  const strategy = createPileViewRuntimeStrategy();
  const renderPile = strategy.render;
  strategy.render = (current) => {
    engine = current;
    return renderPile(current);
  };
  let releaseSync;
  const syncGate = new Promise((resolve) => {
    releaseSync = resolve;
  });
  let view;
  let responseNonce = 1;
  const refreshQuestionResponses = jest.fn(async () => {
    if (!responsesReady) await syncGate;
    await syncResponses(store);
    responseNonce += 1;
    view.rerenderSurveyQuestions({ questionResponsesNonce: responseNonce, questionsCacheNonce: responseNonce });
  });
  view = renderSurveyPileViewMode({
    minifiedMode: 'pile',
    isStandalone: true,
    surveyIndex: 0,
    network: { id: 11155420 },
    networkChainId: 11155420,
    account: OWNER,
    loginComplete: true,
    provider: { request: jest.fn() },
    cacheHasLoaded: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: responsesReady,
    questionResponsesNonce: 1,
    questionsCacheNonce: 1,
    onFilterChange: jest.fn(),
    runtimeStrategy: strategy,
    sessionConfig: SESSION_CONFIG,
    sessionSlug: SLUG,
    activeSessionSlug: SLUG,
    sessionSlugPinned: true,
    refreshQuestionResponses,
    toggleLoginModal: jest.fn(),
  });
  await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(QUESTION_IDS.length));
  await waitFor(() => expect(engine.state.loading).toBe(false));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 600)));
  for (let step = 0; step < QUESTION_IDS.length; step += 1) {
    if (engine.state.pileQuestions[engine.state.activePileIndex].id === QUESTION_ID) break;
    await act(async () => engine.handleNext());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
  }
  await waitFor(() => expect(engine.state.surveysResponseState?.[0]?.answers?.[QUESTION_ID]).toBeDefined());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));
  const finishSync = async () => {
    await act(async () => {
      releaseSync();
      await syncResponses(store);
      expect(
        cacheScripts.peekCacheSync('questionsCache', SLUG).worker.questionResponses[QUESTION_ID][OWNER],
      ).toMatchObject(SAVED_RESPONSE);
      view.rerenderSurveyQuestions({
        isResponsesCacheReady: true,
        questionResponsesNonce: ++responseNonce,
        questionsCacheNonce: responseNonce,
      });
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 800)));
  };
  return { engine: () => engine, view, submitResponses, finishSync };
};

const submit = async (h) => {
  let outcome;
  await act(async () => {
    outcome = await h.engine().handlePileSubmitClick();
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));
  return outcome;
};
const newestResponse = async (store) => {
  const rows = await loadWorkerResponses({ sessionSlug: SLUG, sessionConfig: SESSION_CONFIG }, store.deps);
  return rows.sort((a, b) => b.timestamp - a.timestamp)[0].response;
};

it.each(['submit-first', 'sync-first-comment', 'sync-first-answer'])(
  'preserves saved fields on a new device when the response sync is delayed (%s)',
  async (order) => {
    const store = createWorkerStore();
    const firstSitting = await mountWhileResponsesLoad(store, true);
    await act(async () => firstSitting.engine().handleAnswerPile(QUESTION_ID, 'Saved answer'));
    await act(async () => firstSitting.engine().handleAdditionalPile(QUESTION_ID, 'Saved comment'));
    await act(async () => firstSitting.engine().handleImportance(0, QUESTION_ID, 7));
    await act(async () => firstSitting.engine().handleConviction(0, QUESTION_ID, 8));
    expect(await submit(firstSitting)).toEqual({ status: 'submitted' });
    expect(await newestResponse(store)).toMatchObject(SAVED_RESPONSE);
    firstSitting.view.unmount();
    jest.restoreAllMocks();
    for (const namespace of ['questionsCache', 'surveysCache', 'userCache']) {
      await cacheScripts.removeCache(namespace, SLUG);
    }
    sessionStorage.clear();
    localStorage.clear();
    const h = await mountWhileResponsesLoad(store);
    expect(h.engine().state.surveysResponseState[0].answers[QUESTION_ID].value).toBe('');
    await act(async () => {
      if (order === 'sync-first-answer') h.engine().handleAnswerPile(QUESTION_ID, 'New answer');
      else h.engine().handleAdditionalPile(QUESTION_ID, 'New comment');
    });
    if (order === 'submit-first') {
      const outcome = await submit(h);
      expect(h.submitResponses).not.toHaveBeenCalled();
      expect(outcome).toEqual({ status: 'pending', message: 'Loading your saved answers…' });
      expect(await newestResponse(store)).toMatchObject(SAVED_RESPONSE);
    }
    await h.finishSync();
    await submit(h);
    expect(h.submitResponses).toHaveBeenCalledTimes(1);
    expect(await newestResponse(store)).toMatchObject({
      answer: { value: order === 'sync-first-answer' ? 'New answer' : 'Saved answer' },
      additional: { value: order === 'sync-first-answer' ? 'Saved comment' : 'New comment' },
      importance: 7,
      conviction: 8,
    });
  },
);
