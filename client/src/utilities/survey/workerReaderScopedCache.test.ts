import { listNamespaceSlugsSync, peekCacheSync, updateCacheAtomic } from '../cache/cacheScripts';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../session/sessionModeProfile';
import {
  purgeWorkerCanonicalCaches,
  resolveWorkerCanonicalCacheIdentity,
  resolveWorkerCanonicalSessionKey,
  workerCanonicalCacheIdentityMatches,
} from './workerCanonicalCacheIdentity';
import { setWorkerCanonicalCacheReader } from './workerCanonicalCacheReader';
import { loadWorkerResponses } from './workerResponseHydration';
import { hydrateWorkerCanonicalResponses, resolveWorkerResponseHydrationRun } from './workerResponseHydrationRuntime';

jest.mock('../cache/cacheScripts', () => ({
  ...jest.requireActual<typeof import('../cache/cacheScripts')>('../cache/cacheScripts'),
  listNamespaceSlugsSync: jest.fn(),
  peekCacheSync: jest.fn(),
  updateCacheAtomic: jest.fn(),
}));

type Stored = { id: string; responder: string; question?: string; value: string };
type Cache = Record<string, any>;

const slug = 'reader-session';
const sessionId = `0x${'7'.repeat(32)}`;
const config = {
  slug,
  sessionId,
  corsWorkerUrl: 'https://reader-worker.example.test',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};

// The reader-aware check every display path (Results, PolisReport, aggregates) applies.
const visibleNode = (cache: Cache): Cache | null =>
  workerCanonicalCacheIdentityMatches(
    cache.worker,
    resolveWorkerCanonicalCacheIdentity({ sessionConfig: config, sessionSlug: slug }),
  )
    ? cache.worker
    : null;

const createBrowser = () => {
  let account = '';
  let questions: Cache = {};
  let users: Cache = {};
  let stored: Stored[] = [];
  let hold: { started: () => void; released: Promise<void> } | null = null;
  const listSessionStorageRefsPage = async () => {
    // The Worker answers for the principal at request time.
    const items = stored.map(({ id, responder }) => ({
      storageRef: { id },
      metadata: { responder, createdAt: '2026-10-01T00:00:00.000Z' },
    }));
    if (hold) {
      hold.started();
      await hold.released;
    }
    return { items, cursor: null, listComplete: true };
  };
  const readSessionStorageBlob = async ({ storageRef }: any) => {
    const row = stored.find(({ id }) => id === storageRef.id) || { question: 'q', value: '' };
    return new Response(
      JSON.stringify({ questionId: row.question || 'q', sessionSlug: slug, sessionId, answer: { value: row.value } }),
    );
  };
  return {
    signIn: (next: string) => {
      account = next;
      setWorkerCanonicalCacheReader(next);
    },
    store: (rows: Stored[]) => {
      stored = rows;
    },
    holdListing: () => {
      let started = () => {};
      let release = () => {};
      const startedPromise = new Promise<void>((resolve) => {
        started = resolve;
      });
      hold = {
        started: () => started(),
        released: new Promise<void>((resolve) => {
          release = resolve;
        }),
      };
      return { started: startedPromise, release: () => release() };
    },
    // An answer the post-submit cache wrote before any listing returned its ref.
    saveLocally: (question: string, responder: string, storageRefId: string, value: string) => {
      questions.worker.questionResponses[question] = { [responder]: { answer: { value } } };
      questions.worker.questionResponsesMeta[question] = { [responder]: { ts: 1, storageRefId } };
    },
    hydrate: () => {
      const run = resolveWorkerResponseHydrationRun({ sessionConfig: config, sessionSlug: slug, reader: account });
      if (!run) throw new Error('Fixture needs a Worker session');
      return hydrateWorkerCanonicalResponses({
        sessionSlug: slug,
        sessionConfig: config,
        run,
        loadWorkerResponses: (options) =>
          loadWorkerResponses(options, { listSessionStorageRefsPage, readSessionStorageBlob }),
        getAccount: () => account,
        getProviderLike: () => null,
        getCurrentSessionConfig: () => config,
        shouldAbort: () => false,
        markLoading: jest.fn(),
        markReady: jest.fn(),
        createPersistenceError: (message) => new Error(message),
        updateQuestionsCacheAtomic: async (update) => {
          questions = update(questions) as Cache;
          return true;
        },
        updateUserCacheAtomic: async (update) => {
          users = update(users) as Cache;
          return true;
        },
      });
    },
    questions: () => questions,
    snapshot: () => JSON.stringify({ questions, users }),
  };
};

afterEach(() => setWorkerCanonicalCacheReader(''));

it('discards a private load that finishes after the account changed', async () => {
  const browser = createBrowser();
  browser.signIn('0xadmin');
  browser.store([{ id: 'r-other', responder: '0xother', value: 'private answer' }]);
  const listing = browser.holdListing();
  const loading = browser.hydrate();
  await listing.started;
  browser.signIn('0xparticipant');
  listing.release();
  await loading;
  expect(browser.snapshot()).not.toContain('private answer');
});

it('never shows one reader what another loaded, including after logout or an empty refresh', async () => {
  const browser = createBrowser();
  browser.signIn('0xadmin');
  browser.store([
    { id: 'r-other', responder: '0xother', value: 'private answer' },
    { id: 'r-own', responder: '0xadmin', value: 'admin answer' },
  ]);
  await browser.hydrate();
  expect(visibleNode(browser.questions())?.questionResponses.q).toEqual({
    '0xother': expect.objectContaining({ answer: { value: 'private answer' } }),
    '0xadmin': expect.objectContaining({ answer: { value: 'admin answer' } }),
  });

  browser.signIn('');
  expect(visibleNode(browser.questions())).toBeNull();
  browser.signIn('0xparticipant');
  expect(visibleNode(browser.questions())).toBeNull();

  browser.store([]);
  await browser.hydrate();
  expect(browser.snapshot()).not.toContain('private answer');
  expect(visibleNode(browser.questions())).toMatchObject({ questionResponses: {} });
});

it('drops answers the same reader can no longer read, but keeps a save no listing returned yet', async () => {
  const browser = createBrowser();
  browser.signIn('0xadmin');
  browser.store([
    { id: 'r-other', responder: '0xother', value: 'private answer' },
    { id: 'r-own', responder: '0xadmin', value: 'admin answer' },
  ]);
  await browser.hydrate();
  browser.saveLocally('q2', '0xadmin', 'r-new', 'just saved');

  // The admin role was removed: the listing now returns only the reader's own answer.
  browser.store([{ id: 'r-own', responder: '0xadmin', value: 'admin answer' }]);
  await browser.hydrate();

  expect(browser.snapshot()).not.toContain('private answer');
  const node = visibleNode(browser.questions());
  expect(Object.keys(node?.questionResponses.q || {})).toEqual(['0xadmin']);
  expect(node?.questionResponses.q2).toEqual({ '0xadmin': { answer: { value: 'just saved' } } });
  expect(Object.keys(node?.workerResponseStorageRefs || {})).toEqual(['r-own']);
});

it('removes every reader-scoped Worker node from persistent caches on an account change', async () => {
  const chainNode = { questions: { q: { id: 'q' } } };
  const cache = new Map<string, unknown>([
    ['questionsCache|a', { worker: { questionResponses: { q: {} } }, 11155420: chainNode }],
    ['surveysCache|a', { 11155420: chainNode }],
    ['userCache|a', { '0xadmin': { worker: { data: {} }, 11155420: chainNode }, '0xother': { 11155420: chainNode } }],
  ]);
  jest
    .mocked(listNamespaceSlugsSync)
    .mockImplementation((namespace) =>
      [...cache.keys()].filter((key) => key.startsWith(`${namespace}|`)).map((key) => key.split('|')[1]),
    );
  jest.mocked(peekCacheSync).mockImplementation((namespace, key) => cache.get(`${namespace}|${key}`) as any);
  jest.mocked(updateCacheAtomic).mockImplementation(async (namespace, key, update) => {
    const next = await update!(cache.get(`${namespace}|${key}`) as any);
    cache.set(`${namespace}|${key}`, next);
    return next;
  });

  await purgeWorkerCanonicalCaches();

  expect(cache.get('questionsCache|a')).toEqual({ 11155420: chainNode });
  expect(cache.get('userCache|a')).toEqual({ '0xadmin': { 11155420: chainNode }, '0xother': { 11155420: chainNode } });
  expect(updateCacheAtomic).toHaveBeenCalledTimes(2);
});

it('keeps draft storage keys independent of the reader so saved drafts stay reachable', () => {
  setWorkerCanonicalCacheReader('0xadmin');
  const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig: config, sessionSlug: slug });
  const key = resolveWorkerCanonicalSessionKey({ sessionConfig: config, sessionSlug: slug });
  setWorkerCanonicalCacheReader('0xparticipant');
  expect(resolveWorkerCanonicalSessionKey({ sessionConfig: config, sessionSlug: slug })).toBe(key);
  // The key format drafts were saved under before cache identities named a reader.
  expect(key).toBe(JSON.stringify([identity.workerOrigin, identity.sessionSlug, identity.sessionId]));
});
