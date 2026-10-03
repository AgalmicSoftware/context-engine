import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as savedAnswersLoader from './sessionInterviewSavedAnswers';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort.js';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { validateNoLockedPlaintextInPayload } from '../../utilities/arweave/noLeakPayloads';
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
import demoSessions from '../../variables/demo/demo_sessions.json';

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

const blockedNetwork = [];
const originalFetch = global.fetch;
beforeAll(() => {
  const block = async (input) => {
    blockedNetwork.push(String((input && input.url) || input));
    throw new Error('Unexpected external request');
  };
  global.fetch = block;
  window.fetch = block;
});
afterAll(() => {
  global.fetch = originalFetch;
  window.fetch = originalFetch;
  expect(blockedNetwork).toEqual([]);
});

const SLUG = 'rxc-ra-test';
const PUBLIC = { gate: 'none', encryption: 'none' };
const SESSION_CONFIG = {
  ...demoSessions[SLUG],
  storageProfile: {
    backend: 'cloudflare',
    resources: { questions: 'active', surveys: 'active', responses: 'active' },
    payloadAccessControl: PUBLIC,
  },
  responseFieldEncryption: { mode: 'optional', version: 1 },
  sessionModeProfile: {
    ...cloneSessionModePreset('fast_cheap_cloudflare'),
    preset: 'custom',
    storage: { backend: 'cloudflare', payloadAccessControl: PUBLIC },
    encryption: { mode: 'none' },
    results: {
      visibility: 'public_full_if_storage_public',
      exposure: { aggregateResultsEnabled: true, anonymizedGroupsEnabled: false, minGroupSize: 2 },
    },
  },
};
const SESSION_ID = SESSION_CONFIG.sessionId;
const OWNER = '0x3333333333333333333333333333333333333333';
const qid = (n) => `0x${String(n).padStart(2, '0')}${'ab'.repeat(31)}`;
const Q = [1, 2, 3, 4].map((n) => ({ id: qid(n), type: 'freeform', prompt: `RA question ${n}` }));
const SURVEY_ID = `0x${'5e'.repeat(32)}`;
const short = (id) => `q${parseInt(String(id).slice(2, 4), 10)}`;
const ADMIN_RECIPIENTS = [
  { type: 'self-eip712-v1' },
  { type: 'worker-response-field-v1', policy: { audience: 'self_admin' } },
];

// Registry-backed envelope model: decrypt returns exactly what was encrypted.
const registry = new Map();
let envSeq = 0;
const makeEnvelope = (plaintext, audience, kind) => {
  envSeq += 1;
  const recipients = audience === 'self_admin' ? ADMIN_RECIPIENTS : [{ type: 'self-eip712-v1' }];
  const env = JSON.stringify({
    v: 1,
    aad: { context: `0x${'aa'.repeat(32)}` },
    recipients,
    ciphertext: `${kind}-${envSeq}`,
  });
  registry.set(env, plaintext);
  return env;
};
// Append-only Worker storage; metadata and response hydration use the production paths.
const createWorkerStore = () => {
  let clock = Date.parse('2026-10-01T10:00:00.000Z');
  let seq = 0;
  const rows = { questions: [], surveys: [], responses: [] };
  const add = (resource, payload, responder = '') => {
    seq += 1;
    clock += 60_000;
    const storageRef = {
      id: `workerflow${String(seq).padStart(4, '0')}`,
      backend: 'cloudflare',
      resource,
      createdAt: new Date(clock).toISOString(),
    };
    rows[resource].push({
      storageRef,
      metadata: {
        resource,
        createdAt: storageRef.createdAt,
        ...(responder ? { responder: responder.toLowerCase() } : {}),
      },
      payload: JSON.parse(JSON.stringify(payload)),
    });
    return storageRef;
  };
  const deps = {
    listSessionStorageRefsPage: async ({ resource, ownResponses }) => ({
      items: rows[resource]
        .filter((row) => !ownResponses || row.metadata.responder === ownResponses.account)
        .map(({ storageRef, metadata }) => ({ storageRef, metadata })),
      cursor: null,
      listComplete: true,
    }),
    readSessionStorageBlob: async ({ storageRef }) => {
      const row = [...rows.questions, ...rows.surveys, ...rows.responses].find(
        (r) => r.storageRef.id === storageRef.id,
      );
      return { json: async () => JSON.parse(JSON.stringify(row.payload)) };
    },
  };
  return { rows, add, deps };
};
const seedWorkerCatalog = (store) => {
  Q.forEach((q) => store.add('questions', { ...q, sessionSlug: SLUG, sessionId: SESSION_ID }));
  store.add('surveys', {
    surveyID: SURVEY_ID,
    title: 'RA',
    questionIDs: Q.map((q) => q.id),
    sessionSlug: SLUG,
    sessionId: SESSION_ID,
  });
};
const persistTo = (namespace) => async (merge) => {
  await cacheScripts.updateCacheAtomic(namespace, SLUG, (current) => merge(current));
  return true;
};
const syncWorkerMetadata = async (store) => {
  const host = {
    getSessionCfg: () => SESSION_CONFIG,
    getAccount: () => OWNER,
    workerCanonicalMetadataHydrationPort: {
      loadQuestions: (input) => loadWorkerCanonicalQuestions(input, store.deps),
      loadSurveys: (input) => loadWorkerCanonicalSurveys(input, store.deps),
    },
  };
  const common = {
    host,
    sessionConfig: SESSION_CONFIG,
    sessionSlug: SLUG,
    createPersistenceError: () => new Error('persist'),
  };
  await hydrateWorkerCanonicalQuestionCache({ ...common, persist: persistTo('questionsCache'), onSuccess: () => {} });
  await hydrateWorkerCanonicalSurveyCache({ ...common, persist: persistTo('surveysCache'), onSuccess: () => {} });
};
const syncWorkerResponses = async (store) => {
  const run = resolveWorkerResponseHydrationRun({ sessionConfig: SESSION_CONFIG, sessionSlug: SLUG });
  await hydrateWorkerCanonicalResponses({
    sessionSlug: SLUG,
    sessionConfig: SESSION_CONFIG,
    run,
    loadWorkerResponses: (opts) => loadWorkerResponses(opts, store.deps),
    getAccount: () => OWNER,
    getProviderLike: () => null,
    getCurrentSessionConfig: () => SESSION_CONFIG,
    shouldAbort: () => false,
    markLoading: () => {},
    markReady: () => {},
    updateQuestionsCacheAtomic: async (updater) => {
      await cacheScripts.updateCacheAtomic('questionsCache', SLUG, (current) => updater(current));
      return true;
    },
    updateUserCacheAtomic: async (updater) => {
      await cacheScripts.updateCacheAtomic('userCache', SLUG, (current) => updater(current));
      return true;
    },
    createPersistenceError: (message) => new Error(message),
  });
};
const reloadFromWorker = async (store, keepCache) => {
  const snapshot = {};
  for (const ns of ['questionsCache', 'surveysCache', 'userCache']) {
    snapshot[ns] = JSON.parse(JSON.stringify(cacheScripts.peekCacheSync(ns, SLUG) || null));
    await cacheScripts.removeCache(ns, SLUG);
  }
  if (keepCache) {
    for (const [ns, value] of Object.entries(snapshot)) if (value) await cacheScripts.writeCache(ns, SLUG, value);
  }
  await syncWorkerMetadata(store);
  await syncWorkerResponses(store);
};

afterEach(async () => {
  jest.restoreAllMocks();
  await cacheScripts.removeCache('questionsCache', SLUG);
  await cacheScripts.removeCache('surveysCache', SLUG);
  await cacheScripts.removeCache('userCache', SLUG);
  sessionStorage.clear();
  localStorage.clear();
});

const mockCommon = (store) => {
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (String(slug || '').toLowerCase() === SLUG ? SESSION_CONFIG : null));
  jest.spyOn(cryptoUtils, 'getProviderKind').mockReturnValue('browser');
  // Worker-canonical sessions have no surveys contract; the real getResponse returns null here.
  jest.spyOn(surveyQuestionReadsPort, 'getResponse').mockResolvedValue(null);
  jest.spyOn(surveyQuestionReadsPort, 'getSurveyResponse').mockResolvedValue(null);
  jest.spyOn(savedAnswersLoader, 'loadSessionInterviewSavedAnswers').mockResolvedValue(null);
  jest
    .spyOn(cryptoUtils, 'encryptEnvelopeValue')
    .mockImplementation(async (value, opts = {}) => makeEnvelope(value, opts.encryptionAudience, 'rating'));
  jest
    .spyOn(cryptoUtils, 'decryptEnvelopeValue')
    .mockImplementation(async (value) => (registry.has(value) ? registry.get(value) : null));
  jest.spyOn(cryptoUtils, 'encryptMultipleAnswers').mockImplementation(async (slice) => {
    const enc = (map, kind) =>
      Object.fromEntries(
        Object.entries(map || {}).map(([id, f]) => [
          id,
          {
            ...f,
            value: '*',
            encrypted: true,
            encryptedPortion: makeEnvelope(f.value, f.encryptionAudience, kind),
            hash: `0x${kind}${envSeq}`,
          },
        ]),
      );
    return {
      answers: enc(slice.answers, 'answer'),
      additionalComments: enc(slice.additionalComments, 'comment'),
      importance: {},
    };
  });
  jest.spyOn(cryptoUtils, 'decryptSingleField').mockImplementation(async (slice, id, selected) => {
    const out = { answers: {}, additionalComments: {}, importance: {} };
    if (selected === 'answer' || selected === 'both') {
      const f = slice?.answers?.[id];
      if (f?.value === '*' && registry.has(f.encryptedPortion))
        out.answers[id] = { value: registry.get(f.encryptedPortion), zkSalt: '0x01' };
    }
    if (selected === 'additional' || selected === 'both') {
      const f = slice?.additionalComments?.[id];
      if (f?.value === '*' && registry.has(f.encryptedPortion))
        out.additionalComments[id] = { value: registry.get(f.encryptedPortion), zkSalt: '0x02' };
    }
    return out;
  });
  const uploads = [];
  jest
    .spyOn(contractScriptsModule.default, 'submitResponses')
    .mockImplementation(async (_p, hashedQuestionIds, questionResponses, surveyId, surveyResponse) => {
      uploads.push({ questionResponses: JSON.parse(JSON.stringify(questionResponses)), surveyResponse });
      const questionResponseRefs = questionResponses.map((response, index) => ({
        questionId: hashedQuestionIds[index],
        storageRef: store.add('responses', { ...response, sessionId: SESSION_ID, sessionSlug: SLUG }, OWNER),
      }));
      return {
        workerCanonicalSubmission: true,
        questionResponseRefs,
        sessionSlug: SLUG,
        storageRefs: questionResponseRefs.map((r) => r.storageRef),
      };
    });
  return { uploads };
};

const mountPile = async (store, { nonce = 1 } = {}) => {
  const mocks = mockCommon(store);
  let engine = null;
  const strategy = createPileViewRuntimeStrategy();
  const renderPile = strategy.render;
  strategy.render = (current) => {
    engine = current;
    return renderPile(current);
  };
  let view = null;
  const bump = { questionResponsesNonce: nonce, questionsCacheNonce: nonce };
  const refreshQuestionResponses = jest.fn(async () => {
    await syncWorkerResponses(store);
    bump.questionResponsesNonce += 1;
    bump.questionsCacheNonce += 1;
    view.rerenderSurveyQuestions({ ...bump });
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
    isResponsesCacheReady: true,
    ...bump,
    onFilterChange: jest.fn(),
    runtimeStrategy: strategy,
    sessionConfig: SESSION_CONFIG,
    sessionSlug: SLUG,
    activeSessionSlug: SLUG,
    sessionSlugPinned: true,
    refreshQuestionResponses,
    toggleLoginModal: jest.fn(),
  });
  await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(Q.length), { timeout: 8000 });
  await act(async () => new Promise((r) => setTimeout(r, 600)));
  return { engine: () => engine, view, ...mocks };
};

const settle = (ms = 200) => act(async () => new Promise((r) => setTimeout(r, ms)));
const submit = async (h) => {
  let outcome;
  await act(async () => {
    try {
      outcome = await h.engine().handlePileSubmitClick();
    } catch (error) {
      outcome = { threw: String(error?.message || error) };
    }
  });
  await settle(500);
  return { outcome, submissionError: h.engine().state.submissionError || '' };
};
const goTo = async (h, n) => {
  for (let step = 0; step < Q.length + 1; step += 1) {
    const st = h.engine().state;
    if (st.pileQuestions?.[st.activePileIndex]?.id === qid(n)) break;
    await act(async () => h.engine().handleNext());
    await settle(150);
  }
  await settle(300);
  const st = h.engine().state;
  return short(st.pileQuestions?.[st.activePileIndex]?.id);
};
const guard = (upload) => {
  try {
    (upload?.questionResponses || []).forEach((r) =>
      validateNoLockedPlaintextInPayload(r, { family: 'question_response_payload', path: 'question response' }),
    );
    return 'passed';
  } catch (error) {
    return `threw: ${error.message}`;
  }
};
const plaintextLeak = (uploads) => /secret/i.test(JSON.stringify(uploads.map((u) => u.questionResponses)));
const lockAndAnswer = async (h, n, audience, text, ratings) => {
  await act(async () => h.engine().toggleAnswerEncryption(0, qid(n), true));
  await act(async () => h.engine().applyAnswerEncryptionAudience(0, qid(n), audience));
  await act(async () => h.engine().handleAnswerPile(qid(n), text));
  if (ratings) {
    await act(async () => h.engine().handleImportance(0, qid(n), ratings[0]));
    await act(async () => h.engine().handleConviction(0, qid(n), ratings[1]));
  }
};
const clickDecrypt = async () => {
  const button = await screen.findByRole('button', { name: 'Decrypt Answer' }, { timeout: 5000 });
  const errors = [];
  const onError = (event) => {
    errors.push(String(event?.error?.message || event?.message));
    event.preventDefault();
  };
  window.addEventListener('error', onError);
  await act(async () => {
    fireEvent.click(button);
  });
  await settle(800);
  window.removeEventListener('error', onError);
  return errors;
};

describe('saved Worker audience changes', () => {
  it('has no per-question chain response to refresh a Worker answer', async () => {
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(SESSION_CONFIG);
    expect(await surveyQuestionReadsPort.getResponse(null, OWNER, qid(2), SLUG)).toBeNull();
    expect(await surveyQuestionReadsPort.getResponse(null, OWNER, qid(2), SESSION_CONFIG)).toBeNull();
  });

  it.each(['first', 'after another submit', 'with a comment'])(
    'saves a self-only audience after decrypt: %s',
    async (order) => {
      const store = createWorkerStore();
      seedWorkerCatalog(store);
      await syncWorkerMetadata(store);
      let h = await mountPile(store);
      await lockAndAnswer(h, 2, 'self_admin', 'secret two', null);
      expect((await submit(h)).outcome).toEqual({ status: 'submitted' });
      h.view.unmount();
      jest.restoreAllMocks();
      sessionStorage.clear();
      await reloadFromWorker(store, true);
      h = await mountPile(store, { nonce: 9 });
      if (order === 'after another submit') {
        await act(async () => h.engine().handleAnswerPile(qid(1), 'public one'));
        expect((await submit(h)).outcome).toEqual({ status: 'submitted' });
      }
      await goTo(h, 2);
      await act(async () => h.engine().applyAnswerEncryptionAudience(0, qid(2), 'self'));
      const countBefore = h.uploads.length;
      const blocked = await submit(h);
      expect(blocked.submissionError).toMatch(/Decrypt and re-encrypt/);
      expect(h.uploads).toHaveLength(countBefore);
      expect(await clickDecrypt()).toEqual([]);
      expect(h.engine().getSubmitCount()).toBe(1);
      if (order === 'with a comment') {
        await act(async () => h.engine().handleAdditionalPile(qid(2), 'public comment'));
      }
      expect((await submit(h)).outcome).toEqual({ status: 'submitted' });
      expect(h.uploads).toHaveLength(countBefore + 1);
      const upload = h.uploads.at(-1);
      const row = upload.questionResponses.find((r) => r.questionID === qid(2));
      expect(row.answer).toMatchObject({ value: '*', encrypted: true, encryptionAudience: 'self' });
      expect(JSON.parse(row.answer.encryptedPortion).recipients).toEqual([{ type: 'self-eip712-v1' }]);
      expect(registry.get(row.answer.encryptedPortion)).toBe('secret two');
      expect(guard(upload)).toBe('passed');
      expect(plaintextLeak(h.uploads)).toBe(false);
      await syncWorkerResponses(store);
      const raw = cacheScripts.peekCacheSync('questionsCache', SLUG).worker.questionResponses[qid(2)][OWNER];
      const latest = typeof raw === 'string' ? JSON.parse(raw) : raw;
      expect(latest.answer).toEqual(row.answer);
    },
    60000,
  );
});

it('preserves both encrypted ratings on the second locked edit in one sitting', async () => {
  const store = createWorkerStore();
  seedWorkerCatalog(store);
  await syncWorkerMetadata(store);
  let h = await mountPile(store);
  await lockAndAnswer(h, 1, 'self', 'secret one', [9, 8]);
  await lockAndAnswer(h, 2, 'self_admin', 'secret two', [6, 5]);
  expect((await submit(h)).outcome).toEqual({ status: 'submitted' });
  const saved = h.uploads[0].questionResponses;
  h.view.unmount();
  jest.restoreAllMocks();
  sessionStorage.clear();
  await reloadFromWorker(store, true);
  h = await mountPile(store, { nonce: 9 });
  for (const [n, text, ratings] of [
    [1, 'secret one edited', [9, 8]],
    [2, 'secret two edited', [6, 5]],
  ]) {
    await goTo(h, n);
    expect(await clickDecrypt()).toEqual([]);
    await act(async () => h.engine().handleAnswerPile(qid(n), text));
    expect((await submit(h)).outcome).toEqual({ status: 'submitted' });
    const upload = h.uploads.at(-1);
    const row = upload.questionResponses.find((response) => response.questionID === qid(n));
    const prior = saved.find((response) => response.questionID === qid(n));
    expect(row.importanceEncrypted).toBe(prior.importanceEncrypted);
    expect(row.convictionEncrypted).toBe(prior.convictionEncrypted);
    expect(registry.get(row.importanceEncrypted)).toBe(ratings[0]);
    expect(registry.get(row.convictionEncrypted)).toBe(ratings[1]);
    expect(row.importance == null).toBe(true);
    expect(row.conviction == null).toBe(true);
    expect(registry.get(row.answer.encryptedPortion)).toBe(text);
    expect(guard(upload)).toBe('passed');
  }
  expect(h.uploads).toHaveLength(2);
  expect(plaintextLeak(h.uploads)).toBe(false);
}, 60000);
