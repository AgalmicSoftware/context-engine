import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../session/sessionModeProfile.js';
import { loadWorkerResponses } from './workerResponseHydration.js';
import { hydrateWorkerCanonicalResponses, resolveWorkerResponseHydrationRun } from './workerResponseHydrationRuntime';

const SESSION_ID = `0x${'5'.repeat(32)}`;
const workerConfig = {
  slug: 'demo-sh',
  sessionId: SESSION_ID,
  corsWorkerUrl: 'https://demo-sh-worker.example.test/',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: {
    backend: 'cloudflare',
    resources: { questions: 'active', surveys: 'active', responses: 'active' },
    payloadAccessControl: { gate: 'role_gate', encryption: 'worker_envelope', mode: 'worker_sbt_gate' },
  },
};
const row = (n: number) => ({
  questionId: 'q1',
  responder: `p-${n}`,
  response: { sessionSlug: 'demo-sh', sessionId: SESSION_ID, questionID: 'q1', answer: n },
  storageRefId: `ref-${n}`,
  timestamp: n + 1,
});
const PAGES = 6;

// A load as the loader runs it: a page listed, its rows reported, then the next, stopping when its signal says so.
const pagedLoader = (afterPage: (page: number) => void, pagesRead: number[], signals: Array<AbortSignal | undefined>) =>
  jest.fn(async ({ onRows, signal }: any) => {
    signals.push(signal);
    const rows = [];
    for (let page = 0; page < PAGES; page += 1) {
      signal?.throwIfAborted();
      pagesRead.push(page);
      rows.push(row(page));
      onRows([row(page)], { loaded: page + 1, listed: PAGES, listComplete: page === PAGES - 1 });
      await Promise.resolve();
      afterPage(page);
    }
    return rows;
  });

const hydrate = (loadWorkerResponses: any, current: { account: string; config: any; gone?: boolean }) => {
  let questions: any = {};
  const markReady = jest.fn();
  const run = hydrateWorkerCanonicalResponses({
    sessionSlug: 'demo-sh',
    sessionConfig: workerConfig,
    run: resolveWorkerResponseHydrationRun({ sessionConfig: workerConfig, sessionSlug: 'demo-sh', reader: '' })!,
    loadWorkerResponses,
    getAccount: () => current.account,
    getProviderLike: () => null,
    getCurrentSessionConfig: () => current.config,
    shouldAbort: () => current.gone === true,
    markLoading: () => {},
    markReady,
    markProgress: () => {},
    createPersistenceError: (message) => new Error(message),
    updateQuestionsCacheAtomic: async (update) => {
      questions = update(questions);
      return true;
    },
    updateUserCacheAtomic: async () => true,
  });
  return { run, markReady, worker: () => questions.worker };
};

describe('a load whose reader or page has gone', () => {
  // Someone signing in while a public session's answers load starts their own load; the signed-out one read on to
  // its last page beside it, every answer read twice.
  it.each([
    ['the reader signs in', (current: any) => (current.account = '0xnewreader')],
    ['the page goes', (current: any) => (current.gone = true)],
  ])('stops at the next rows it reports once %s', async (_, change) => {
    const current = { account: '', config: workerConfig };
    const pagesRead: number[] = [];
    const signals: Array<AbortSignal | undefined> = [];
    const loader = pagedLoader((page) => page === 1 && change(current), pagesRead, signals);
    const { run, markReady, worker } = hydrate(loader, current);
    // Not a failure: it ends quietly, and the load that replaced it reports for itself.
    await expect(run).resolves.toBeUndefined();
    expect(signals[0]?.aborted).toBe(true);
    // Pages 0 and 1 were read before the change; page 2's rows are where the load learns it is stale.
    expect(pagesRead).toEqual([0, 1, 2]);
    expect(markReady).not.toHaveBeenCalled();
    expect(worker().workerResponseHydrationStatus).toBe('loading');
  });

  // The same through the real loader: it lists a page, reads it as a batch, and must not hang, read on, or read a
  // batch twice once told to stop.
  it('stops the real loader part-way through the list when the reader signs in', async () => {
    const current = { account: '', config: workerConfig };
    const listing = jest.fn(async ({ cursor, signal }: any) => {
      signal?.throwIfAborted();
      const start = Number(cursor || 0);
      return {
        items: Array.from({ length: 100 }, (_, i) => ({
          storageRef: { id: `ref-${start + i}` },
          metadata: { responder: `p-${start + i}`, createdAt: '2026-01-01T00:00:00Z' },
        })),
        cursor: String(start + 100),
        listComplete: start + 100 >= PAGES * 100,
      };
    });
    const batches: string[] = [];
    const readBatch = jest.fn(async ({ ids, signal }: any) => {
      // As the storage client's request would: an aborted signal fails the read before it is sent.
      signal?.throwIfAborted();
      batches.push(ids[0]);
      // Someone signs in while the second batch is being read.
      if (batches.length === 2) current.account = '0xnewreader';
      return ids.map((id: string) => ({ sessionSlug: 'demo-sh', sessionId: SESSION_ID, questionID: 'q1', answer: id }));
    });
    const { run, markReady, worker } = hydrate(
      (options: any) =>
        loadWorkerResponses(options, {
          listSessionStorageRefsPage: listing,
          readSessionStorageBatch: readBatch,
          readWorkerCapabilities: async () => ({ features: ['storage_read_batch_v1'] }) as any,
        }),
      current,
    );
    await expect(run).resolves.toBeUndefined();
    expect(listing.mock.calls.length).toBeLessThan(PAGES);
    // Each page is asked for with the load's signal, so one still in the air is dropped as well.
    expect(listing.mock.calls.every(([options]: any[]) => options.signal instanceof AbortSignal)).toBe(true);
    expect(batches.length).toBeLessThan(PAGES);
    expect(new Set(batches).size).toBe(batches.length);
    expect(markReady).not.toHaveBeenCalled();
    expect(worker().workerResponseHydrationStatus).toBe('loading');
  });

  it('reads to the end while its reader and session stay', async () => {
    const current = { account: '', config: workerConfig };
    const pagesRead: number[] = [];
    const signals: Array<AbortSignal | undefined> = [];
    const { run, markReady, worker } = hydrate(
      pagedLoader(() => {}, pagesRead, signals),
      current,
    );
    await run;
    expect(signals[0]?.aborted).toBe(false);
    expect(pagesRead).toHaveLength(PAGES);
    expect(markReady).toHaveBeenCalledWith(false);
    expect(worker().workerResponseHydrationStatus).toBe('complete');
  });

  it('still reports a load that fails while its reader stays', async () => {
    const current = { account: '', config: workerConfig };
    const { run, worker } = hydrate(
      jest.fn(async () => {
        throw new Error('Storage list failed (503).');
      }),
      current,
    );
    await expect(run).rejects.toThrow('503');
    expect(worker().workerResponseHydrationStatus).toBe('failed');
  });
});

// The page tells someone their saved answers did not load from the failure left in the cache, which outlasts a
// reload. The next load clears it at once, so the page says the answers are loading, not failed, while it reads.
it('has the page shown again as soon as a load replaces a failure left by an earlier one', async () => {
  let questions: any = {};
  const markProgress = jest.fn();
  const start = (loader: any) =>
    hydrateWorkerCanonicalResponses({
      sessionSlug: 'demo-sh',
      sessionConfig: workerConfig,
      run: resolveWorkerResponseHydrationRun({ sessionConfig: workerConfig, sessionSlug: 'demo-sh', reader: '' })!,
      loadWorkerResponses: loader,
      getAccount: () => '',
      getProviderLike: () => null,
      getCurrentSessionConfig: () => workerConfig,
      shouldAbort: () => false,
      markLoading: () => {},
      markReady: () => {},
      markProgress,
      createPersistenceError: (message) => new Error(message),
      updateQuestionsCacheAtomic: async (update) => {
        questions = update(questions);
        return true;
      },
      updateUserCacheAtomic: async () => true,
    });
  await expect(
    start(async () => {
      throw new TypeError('Failed to fetch');
    }),
  ).rejects.toThrow('Failed to fetch');
  expect(questions.worker.workerResponseHydrationStatus).toBe('failed');
  markProgress.mockClear();

  // The retry's listing is held open, as a slow answer list is, until the page has been told.
  let listed: (() => void) | null = null;
  const retried = start(() => new Promise((resolve) => (listed = () => resolve([]))));
  await waitForListing(() => listed !== null);
  expect(questions.worker.workerResponseHydrationStatus).toBe('loading');
  expect(markProgress).toHaveBeenCalledTimes(1);
  listed!();
  await retried;
  expect(questions.worker.workerResponseHydrationStatus).toBe('complete');

  // A load with no failure to replace waits for its rows, as before.
  markProgress.mockClear();
  await start(async () => []);
  expect(markProgress).not.toHaveBeenCalled();
});

const waitForListing = async (ready: () => boolean) => {
  for (let tick = 0; tick < 50 && !ready(); tick += 1) await Promise.resolve();
  expect(ready()).toBe(true);
};
