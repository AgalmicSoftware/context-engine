import { getSubmittedWorkerResponseRecency } from './workerResponseRecency';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../session/sessionModeProfile';
import { resolveWorkerCanonicalCacheIdentity, withWorkerCanonicalCacheIdentity } from './workerCanonicalCacheIdentity';
import { loadWorkerResponses, mergeWorkerQuestionResponses, mergeWorkerUserResponses } from './workerResponseHydration';
import { hydrateWorkerCanonicalResponses, resolveWorkerResponseHydrationRun } from './workerResponseHydrationRuntime';

const slug = 'ordering-session';
const sessionId = `0x${'5'.repeat(32)}`;
const responder = 'participant';
const config = {
  slug,
  sessionId,
  corsWorkerUrl: 'https://ordering-worker.example.test',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};
const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig: config, sessionSlug: slug });
const early = Date.parse('2026-09-20T12:00:00.100Z') / 1000;
const late = Date.parse('2026-09-20T12:00:00.900Z') / 1000;
const payload = (id: string) => ({
  questionId: 'q',
  sessionSlug: slug,
  sessionId,
  answer: { value: id },
  blockNumber: id === 'old' ? 999999999 : 0,
  transactionIndex: 999,
  logIndex: 999,
});
const fixture = (ids = ['old', 'new'], sameTime = false) => {
  const listSessionStorageRefsPage = jest.fn(async () => ({
    items: ids.map((id) => ({
      storageRef: { backend: 'cloudflare', id },
      metadata: { responder, createdAt: new Date((id === 'old' || sameTime ? early : late) * 1000).toISOString() },
    })),
    cursor: null,
    listComplete: true,
  }));
  const readSessionStorageBlob = jest.fn(
    async ({ storageRef }: Record<string, unknown>) =>
      new Response(JSON.stringify(payload(String((storageRef as { id: string }).id)))),
  );
  const load = (cachedStorageRefIds?: ReadonlySet<string>) =>
    loadWorkerResponses(
      { sessionSlug: slug, sessionConfig: config, cachedStorageRefIds },
      { listSessionStorageRefsPage, readSessionStorageBlob },
    );
  return { load, readSessionStorageBlob };
};

it.each([
  ['old', 'new'],
  ['new', 'old'],
])('uses authoritative subsecond ordering for refs %s/%s in both caches', async (first, second) => {
  const { load } = fixture([first, second]);
  const rows = await load();
  expect(rows.find(({ storageRefId }) => storageRefId === 'new')?.timestamp).toBe(late);
  const questions = mergeWorkerQuestionResponses({}, rows, slug, identity);
  const users = mergeWorkerUserResponses({}, rows, identity);
  expect(questions).toMatchObject({
    worker: {
      questionResponses: { q: { participant: payload('new') } },
      questionResponsesMeta: { q: { participant: { ts: late, storageRefId: 'new' } } },
    },
  });
  expect(users).toMatchObject({
    participant: {
      worker: {
        data: {
          questionResponses: [{ questionId: 'q', response: payload('new'), timestamp: late, storageRefId: 'new' }],
        },
      },
    },
  });
  const incremental = rows.reduce((cache, row) => mergeWorkerQuestionResponses(cache, [row], slug, identity), {});
  expect(incremental).toEqual(questions);
});

it('converges deterministically on case-sensitive storage refs for equal timestamps', async () => {
  const rows = await fixture(['A', 'a'], true).load();
  const forward = mergeWorkerQuestionResponses({}, rows, slug, identity);
  const reverse = mergeWorkerQuestionResponses({}, [...rows].reverse(), slug, identity);
  expect(forward).toEqual(reverse);
  expect(forward).toMatchObject({ worker: { questionResponses: { q: { participant: payload('a') } } } });
  expect(mergeWorkerUserResponses({}, rows, identity)).toEqual(
    mergeWorkerUserResponses({}, [...rows].reverse(), identity),
  );
});

const runtimeFixture = () => {
  const { load, readSessionStorageBlob } = fixture();
  const oldSeconds = Math.floor(early);
  let questionCache: unknown = {
    chain: { preserved: true },
    worker: withWorkerCanonicalCacheIdentity(
      {
        questions: { q: { id: 'q', type: 'freeform', prompt: 'Question?' } },
        pendingQuestionMetadata: { later: true },
        questionResponses: { q: { participant: payload('old') } },
        questionResponsesMeta: { q: { participant: { ts: oldSeconds } } },
        workerResponseStorageRefs: { old: oldSeconds, new: oldSeconds },
      },
      identity,
    ),
  };
  let userCache: unknown = {
    participant: {
      chain: { preserved: true },
      worker: withWorkerCanonicalCacheIdentity(
        {
          lastScanTimestamp: oldSeconds,
          data: {
            sbts: ['keep'],
            questionResponses: [{ questionId: 'q', response: payload('old'), timestamp: oldSeconds }],
          },
        },
        identity,
      ),
    },
  };
  const run = resolveWorkerResponseHydrationRun({ sessionConfig: config, sessionSlug: slug });
  if (!run) throw new Error('Fixture needs a valid Worker identity');
  const loader = jest.fn(({ cachedStorageRefIds }: { cachedStorageRefIds?: ReadonlySet<string> }) =>
    load(cachedStorageRefIds),
  );
  const hydrate = () =>
    hydrateWorkerCanonicalResponses({
      sessionSlug: slug,
      sessionConfig: config,
      run,
      loadWorkerResponses: loader,
      getAccount: () => '',
      getProviderLike: () => null,
      getCurrentSessionConfig: () => config,
      shouldAbort: () => false,
      markLoading: jest.fn(),
      markReady: jest.fn(),
      createPersistenceError: (message) => new Error(message),
      updateQuestionsCacheAtomic: async (update) => {
        questionCache = update(questionCache);
        return true;
      },
      updateUserCacheAtomic: async (update) => {
        userCache = update(userCache);
        return true;
      },
    });
  return {
    hydrate,
    loader,
    readSessionStorageBlob,
    questions: () => questionCache,
    users: () => userCache,
    clearUsers: () => {
      userCache = {};
    },
  };
};

it('repairs both legacy seen-reference layers once and rebuilds a missing user cache from precise saved metadata', async () => {
  const run = runtimeFixture();
  await run.hydrate();
  expect(run.loader).toHaveBeenLastCalledWith(expect.objectContaining({ cachedStorageRefIds: new Set() }));
  expect(run.readSessionStorageBlob).toHaveBeenCalledTimes(2);
  expect(run.questions()).toMatchObject({
    chain: { preserved: true },
    worker: {
      questions: { q: { prompt: 'Question?' } },
      pendingQuestionMetadata: { later: true },
      questionResponses: { q: { participant: payload('new') } },
    },
  });
  expect(run.users()).toMatchObject({
    participant: {
      chain: { preserved: true },
      worker: {
        data: {
          sbts: ['keep'],
          questionResponses: [{ response: payload('new'), timestamp: late, storageRefId: 'new' }],
        },
      },
    },
  });
  await run.hydrate();
  expect(run.readSessionStorageBlob).toHaveBeenCalledTimes(2);
  run.clearUsers();
  await run.hydrate();
  expect(run.readSessionStorageBlob).toHaveBeenCalledTimes(2);
  expect(run.users()).toMatchObject({
    participant: {
      worker: { data: { questionResponses: [{ response: payload('new'), timestamp: late, storageRefId: 'new' }] } },
    },
  });
});

it('leaves failed legacy rereads retryable rather than marking old refs consumed', async () => {
  const run = runtimeFixture();
  run.loader.mockRejectedValueOnce(new Error('Synthetic outage'));
  await expect(run.hydrate()).rejects.toThrow('Synthetic outage');
  expect(run.questions()).toEqual(
    expect.objectContaining({
      worker: expect.objectContaining({ workerResponseStorageRefs: {}, questionResponses: {} }),
    }),
  );
  await run.hydrate();
  expect(run.readSessionStorageBlob).toHaveBeenCalledTimes(2);
  expect(run.questions()).toMatchObject({ worker: { questionResponses: { q: { participant: payload('new') } } } });
});

it('keeps fractional local time for older receipts without per-question metadata', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(late * 1000);
  try {
    expect(getSubmittedWorkerResponseRecency({ workerCanonicalSubmission: true }, 'q')).toEqual({
      ts: late,
      storageRefId: '',
    });
  } finally {
    now.mockRestore();
  }
});
