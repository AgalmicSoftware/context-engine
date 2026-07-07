const deepClone = (value) => {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
};

const makeLogger = () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const BROADCAST_CHANNEL_NAME = 'ce_dg_cache_updates_v1';
const BASELINE_BROADCAST_CHANNEL = global.BroadcastChannel;

const shouldFail = (counterMap = {}, key = '') => {
  const raw = Number(counterMap[key] || 0);
  if (!Number.isFinite(raw) || raw <= 0) return false;
  counterMap[key] = raw - 1;
  return true;
};

const waitForCondition = async (predicate, label = 'condition') => {
  for (let i = 0; i < 20; i += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error(`Timed out waiting for ${label}`);
};

const loadCacheScripts = ({
  failProbe = false,
  failSetByKey = {},
  failGetByKey = {},
  failDelByKey = {},
  withBroadcastChannel = false,
} = {}) => {
  jest.resetModules();
  const idbStatesByStore = new Map();
  const setFailures = { ...failSetByKey };
  const getFailures = { ...failGetByKey };
  const delFailures = { ...failDelByKey };
  const broadcastChannels = [];
  let idbState = null;
  let defaultStore = null;

  const resolveStoreKey = (store) => {
    const effectiveStore = store || defaultStore;
    const dbName = String(effectiveStore?.dbName || 'default');
    const storeName = String(effectiveStore?.storeName || 'default');
    return `${dbName}::${storeName}`;
  };
  const getStoreState = (store) => {
    const key = resolveStoreKey(store);
    if (!idbStatesByStore.has(key)) {
      const next = new Map();
      idbStatesByStore.set(key, next);
      if (!idbState) idbState = next;
    }
    return idbStatesByStore.get(key);
  };

  if (withBroadcastChannel) {
    class MockBroadcastChannel {
      constructor(name) {
        this.name = name;
        this.listeners = new Set();
        this.onmessage = null;
        this.postMessage = jest.fn();
        broadcastChannels.push(this);
      }

      addEventListener(type, handler) {
        if (type !== 'message' || typeof handler !== 'function') return;
        this.listeners.add(handler);
      }

      removeEventListener(type, handler) {
        if (type !== 'message' || typeof handler !== 'function') return;
        this.listeners.delete(handler);
      }

      emitMessage(data) {
        const evt = { data };
        this.listeners.forEach((handler) => {
          try {
            handler(evt);
          } catch (_) {}
        });
        if (typeof this.onmessage === 'function') {
          this.onmessage(evt);
        }
      }

      close() {}
    }

    global.BroadcastChannel = MockBroadcastChannel;
  } else {
    global.BroadcastChannel = BASELINE_BROADCAST_CHANNEL;
  }

  const idb = {
    createStore: jest.fn((dbName, storeName) => {
      const store = { dbName, storeName };
      if (!defaultStore) defaultStore = store;
      getStoreState(store);
      return store;
    }),
    get: jest.fn(async (key, store) => {
      if (shouldFail(getFailures, key)) {
        throw new Error(`IDB get failed for ${key}`);
      }
      const state = getStoreState(store);
      return state.has(key) ? deepClone(state.get(key)) : undefined;
    }),
    set: jest.fn(async (key, value, store) => {
      if (failProbe && key === '__dg_cache_probe__') {
        throw new Error('IDB probe failed');
      }
      if (shouldFail(setFailures, key)) {
        throw new Error(`IDB set failed for ${key}`);
      }
      const state = getStoreState(store);
      state.set(key, deepClone(value));
    }),
    del: jest.fn(async (key, store) => {
      if (shouldFail(delFailures, key)) {
        throw new Error(`IDB del failed for ${key}`);
      }
      const state = getStoreState(store);
      state.delete(key);
    }),
    entries: jest.fn(async (store) => {
      const state = getStoreState(store);
      return Array.from(state.entries()).map(([key, value]) => [key, deepClone(value)]);
    }),
    getStoreState: (dbName, storeName) => getStoreState({ dbName, storeName }),
  };

  jest.doMock('./cacheScripts.idb.impl.js', () => ({
    createStore: idb.createStore,
    get: idb.get,
    set: idb.set,
    del: idb.del,
    entries: idb.entries,
  }));
  jest.doMock('../logging.js', () => ({
    createLogger: () => makeLogger(),
  }));

  // eslint-disable-next-line global-require
  const cacheScripts = require('./cacheScripts.js');
  const emitBroadcastMessage = (data, name = BROADCAST_CHANNEL_NAME) => {
    broadcastChannels
      .filter((channel) => channel && channel.name === name)
      .forEach((channel) => channel.emitMessage(data));
  };
  return { cacheScripts, idb, idbState, broadcastChannels, emitBroadcastMessage };
};

describe('cacheScripts', () => {
  beforeEach(() => {
    localStorage.clear();
    global.BroadcastChannel = BASELINE_BROADCAST_CHANNEL;
  });

  afterEach(() => {
    global.BroadcastChannel = BASELINE_BROADCAST_CHANNEL;
  });

  it('reconciles managed namespace dg keys from localStorage into IDB and mirror during init', async () => {
    const seed = {
      'dg:questionsCache:alpha': { 1: { questions: { q1: { id: 'q1' } } } },
      'dg:surveysCache:alpha': { 1: { surveys: { s1: { id: 's1' } } } },
      'dg:bookmarksCache:alpha': { users: [{ address: '0xabc' }] },
      'dg:filters:alpha': { active: ['x'] },
      'dg:sbtCache:alpha': { 1: { sbtList: {} } },
      'dg:userCache:alpha': { '0xabc': { 1: { lastBlockScanned: 12 } } },
      'dg:analysisCache:alpha': { 1: { '0xabc': { sha: { version: 1 } } } },
    };
    Object.entries(seed).forEach(([key, value]) => {
      localStorage.setItem(key, JSON.stringify(value));
    });

    const { cacheScripts, idbState } = loadCacheScripts();
    await cacheScripts.initCacheManager();

    Object.keys(seed).forEach((key) => {
      expect(localStorage.getItem(key)).toBeNull();
      expect(idbState.get(key)).toEqual(seed[key]);
    });

    expect(cacheScripts.peekCacheSync('questionsCache', 'alpha')).toEqual(seed['dg:questionsCache:alpha']);
    expect(cacheScripts.listNamespaceEntriesSync('sbtCache')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          namespace: 'sbtCache',
          slug: 'alpha',
          key: 'dg:sbtCache:alpha',
          value: seed['dg:sbtCache:alpha'],
        }),
      ]),
    );

    const report = await cacheScripts.migrateLocalStorageToIDB();
    expect(report).toMatchObject({ migrated: false, idb: true, moved: 0, removed: 0, failed: 0 });

    expect(await cacheScripts.readCache('questionsCache', 'alpha')).toEqual(seed['dg:questionsCache:alpha']);
    expect(idbState.get('dg:questionsCache:alpha')).toEqual(seed['dg:questionsCache:alpha']);
    expect(localStorage.getItem('dg:questionsCache:alpha')).toBeNull();
  });

  it('merges overlapping fallback localStorage data into existing IDB data during init', async () => {
    const key = 'dg:questionsCache:alpha';
    const idbSeed = {
      1: {
        questions: {
          q1: { id: 'q1', prompt: 'old prompt' },
          q2: { id: 'q2', prompt: 'keep me' },
        },
        questionsLatestBlock: 3,
      },
      preserved: { marker: true },
    };
    const localSeed = {
      1: {
        questions: {
          q1: { id: 'q1', prompt: 'new prompt' },
        },
        questionsLatestBlock: 8,
      },
      recovered: { source: 'localStorage' },
    };
    const merged = {
      1: {
        questions: {
          q1: { id: 'q1', prompt: 'new prompt' },
          q2: { id: 'q2', prompt: 'keep me' },
        },
        questionsLatestBlock: 8,
      },
      preserved: { marker: true },
      recovered: { source: 'localStorage' },
    };
    localStorage.setItem(key, JSON.stringify(localSeed));

    const { cacheScripts, idbState } = loadCacheScripts();
    idbState.set(key, deepClone(idbSeed));
    await cacheScripts.initCacheManager();

    expect(cacheScripts.peekCacheSync('questionsCache', 'alpha')).toEqual(merged);
    expect(await cacheScripts.readCache('questionsCache', 'alpha')).toEqual(merged);
    expect(localStorage.getItem(key)).toBeNull();
    expect(idbState.get(key)).toEqual(merged);
  });

  it('ignores legacy bookmarks and filters keys outside the managed dg namespace', async () => {
    const legacyBookmarks = {
      users: [{ address: '0x111', nickname: 'legacy' }],
      surveys: ['0xsurvey'],
    };
    localStorage.setItem('bookmarksCache', JSON.stringify(legacyBookmarks));
    localStorage.setItem('questionFilterState_questions', JSON.stringify({ sort: 'newest' }));
    localStorage.setItem('questionFilterState_results', JSON.stringify({ openOnly: true }));
    localStorage.setItem('bookmarkedFilters', JSON.stringify(['a', 'b']));
    localStorage.setItem('dg:filters:', JSON.stringify({ existing: true }));

    const { cacheScripts, idbState } = loadCacheScripts();
    await cacheScripts.initCacheManager();

    expect(await cacheScripts.readCache('bookmarksCache', '')).toBeNull();
    expect(await cacheScripts.readCache('filters', '')).toEqual({ existing: true });
    expect(idbState.get('dg:bookmarksCache:')).toBeUndefined();
    expect(idbState.get('dg:filters:')).toEqual({ existing: true });
    expect(JSON.parse(localStorage.getItem('bookmarksCache'))).toEqual(legacyBookmarks);
    expect(JSON.parse(localStorage.getItem('questionFilterState_questions'))).toEqual({ sort: 'newest' });
    expect(JSON.parse(localStorage.getItem('questionFilterState_results'))).toEqual({ openOnly: true });
    expect(JSON.parse(localStorage.getItem('bookmarkedFilters'))).toEqual(['a', 'b']);
  });

  it('does not merge legacy namespace keys into managed namespace keys', async () => {
    const legacyBookmarks = {
      surveys: ['legacy-survey'],
      users: [{ address: '0xlegacy' }],
    };
    localStorage.setItem('bookmarksCache', JSON.stringify(legacyBookmarks));

    const { cacheScripts, idbState } = loadCacheScripts();
    idbState.set('dg:bookmarksCache:', {
      notes: { keep: true },
      surveys: ['idb-survey'],
    });

    await cacheScripts.initCacheManager();

    expect(cacheScripts.peekCacheSync('bookmarksCache', '')).toEqual({
      notes: { keep: true },
      surveys: ['idb-survey'],
    });
    expect(await cacheScripts.readCache('bookmarksCache', '')).toEqual({
      notes: { keep: true },
      surveys: ['idb-survey'],
    });
    expect(JSON.parse(localStorage.getItem('bookmarksCache'))).toEqual(legacyBookmarks);
    expect(idbState.get('dg:bookmarksCache:')).toEqual({
      notes: { keep: true },
      surveys: ['idb-survey'],
    });
  });

  it('keeps managed keys readable when initial IDB reads fail transiently', async () => {
    const key = 'dg:questionsCache:alpha';
    const seed = { 1: { questions: { q1: { id: 'q1' } } } };
    localStorage.setItem(key, JSON.stringify(seed));

    const { cacheScripts, idbState } = loadCacheScripts({
      failGetByKey: { [key]: 1 },
    });
    await cacheScripts.initCacheManager();

    // Startup hydration should retain a mirror copy from localStorage fallback data.
    expect(cacheScripts.peekCacheSync('questionsCache', 'alpha')).toEqual(seed);

    // First read self-heals by promoting the fallback key into IDB.
    expect(await cacheScripts.readCache('questionsCache', 'alpha')).toEqual(seed);
    expect(idbState.get(key)).toEqual(seed);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('falls back to localStorage when IndexedDB is unavailable', async () => {
    const key = 'dg:questionsCache:beta';
    const seed = { 1: { questions: { q1: { id: 'q1' } } } };
    localStorage.setItem(key, JSON.stringify(seed));

    const { cacheScripts } = loadCacheScripts({ failProbe: true });
    await cacheScripts.initCacheManager();

    expect(cacheScripts.peekCacheSync('questionsCache', 'beta')).toEqual(seed);
    expect(JSON.parse(localStorage.getItem(key))).toEqual(seed);

    const next = { 1: { questions: { q2: { id: 'q2' } } } };
    await cacheScripts.writeCache('questionsCache', 'beta', next);
    expect(JSON.parse(localStorage.getItem(key))).toEqual(next);
    expect(await cacheScripts.readCache('questionsCache', 'beta')).toEqual(next);

    await cacheScripts.removeCache('questionsCache', 'beta');
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('reports indexeddb as the active managed cache backend after a healthy init', async () => {
    const { cacheScripts } = loadCacheScripts();
    await cacheScripts.initCacheManager();

    expect(cacheScripts.getCacheBackendDiagnostics()).toEqual(
      expect.objectContaining({
        persistentBackend: 'indexeddb',
        probeState: 'ready',
        idbAvailable: true,
        didHydrateMirror: true,
      }),
    );
  });

  it('reports localstorage fallback as the managed cache backend when the idb probe fails', async () => {
    const { cacheScripts } = loadCacheScripts({ failProbe: true });
    await cacheScripts.initCacheManager();

    expect(cacheScripts.getCacheBackendDiagnostics()).toEqual(
      expect.objectContaining({
        persistentBackend: 'localstorage',
        probeState: 'ready',
        idbAvailable: false,
        didHydrateMirror: true,
      }),
    );
  });

  it('serializes atomic updates per key to avoid lost merges', async () => {
    const { cacheScripts } = loadCacheScripts();
    await cacheScripts.writeCache('questionsCache', 'queue', { counter: 0, items: [] });

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const p1 = cacheScripts.updateCacheAtomic('questionsCache', 'queue', async (current) => {
      await wait(20);
      return {
        ...current,
        counter: Number(current?.counter || 0) + 1,
        items: [...(current?.items || []), 'a'],
      };
    });
    const p2 = cacheScripts.updateCacheAtomic('questionsCache', 'queue', async (current) => ({
      ...current,
      counter: Number(current?.counter || 0) + 1,
      items: [...(current?.items || []), 'b'],
    }));
    const p3 = cacheScripts.updateCacheAtomic('questionsCache', 'queue', async (current) => ({
      ...current,
      counter: Number(current?.counter || 0) + 1,
      items: [...(current?.items || []), 'c'],
    }));

    await Promise.all([p1, p2, p3]);
    const finalValue = await cacheScripts.readCache('questionsCache', 'queue');
    expect(finalValue).toEqual({ counter: 3, items: ['a', 'b', 'c'] });
  });

  it('serializes concurrent writes for the same key to prevent stale final state', async () => {
    const key = 'dg:questionsCache:write-race';
    const { cacheScripts, idb, idbState } = loadCacheScripts();
    await cacheScripts.initCacheManager();

    const baseSet = idb.set.getMockImplementation();
    let releaseBlockedWrite;
    const blockedWriteGate = new Promise((resolve) => {
      releaseBlockedWrite = resolve;
    });
    let blockedOnce = false;
    idb.set.mockImplementation(async (storageKey, value) => {
      if (!blockedOnce && storageKey === key && Number(value?.value) === 1) {
        blockedOnce = true;
        await blockedWriteGate;
      }
      return baseSet(storageKey, value);
    });

    const writeA = cacheScripts.writeCache('questionsCache', 'write-race', { value: 1 });
    const writeB = cacheScripts.writeCache('questionsCache', 'write-race', { value: 2 });

    await new Promise((resolve) => setTimeout(resolve, 20));
    releaseBlockedWrite();

    await expect(writeA).resolves.toBe(true);
    await expect(writeB).resolves.toBe(true);
    expect(idbState.get(key)).toEqual({ value: 2 });
    expect(await cacheScripts.readCache('questionsCache', 'write-race')).toEqual({ value: 2 });
  });

  it('serializes remove after pending write for the same key', async () => {
    const key = 'dg:questionsCache:remove-race';
    const { cacheScripts, idb, idbState } = loadCacheScripts();
    await cacheScripts.initCacheManager();

    const baseSet = idb.set.getMockImplementation();
    let releaseBlockedWrite;
    const blockedWriteGate = new Promise((resolve) => {
      releaseBlockedWrite = resolve;
    });
    let blockedOnce = false;
    idb.set.mockImplementation(async (storageKey, value) => {
      if (!blockedOnce && storageKey === key && Number(value?.value) === 5) {
        blockedOnce = true;
        await blockedWriteGate;
      }
      return baseSet(storageKey, value);
    });

    const writePending = cacheScripts.writeCache('questionsCache', 'remove-race', { value: 5 });
    const removePending = cacheScripts.removeCache('questionsCache', 'remove-race');

    await new Promise((resolve) => setTimeout(resolve, 20));
    releaseBlockedWrite();

    await expect(writePending).resolves.toBe(true);
    await expect(removePending).resolves.toBe(true);
    expect(idbState.has(key)).toBe(false);
    expect(await cacheScripts.readCache('questionsCache', 'remove-race')).toBeNull();
    expect(cacheScripts.peekCacheSync('questionsCache', 'remove-race')).toBeNull();
  });

  it('updateCacheAtomic rejects when persistence fails', async () => {
    const key = 'dg:questionsCache:atomic-fail';
    const { cacheScripts, idbState } = loadCacheScripts({
      failSetByKey: { [key]: 2 },
    });
    await cacheScripts.initCacheManager();

    await expect(
      cacheScripts.updateCacheAtomic('questionsCache', 'atomic-fail', (current) => ({
        ...(current || {}),
        value: 1,
      })),
    ).rejects.toThrow('Failed to persist atomic update');
    expect(cacheScripts.peekCacheSync('questionsCache', 'atomic-fail')).toBeNull();
    expect(idbState.has(key)).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('emits subscribeCacheUpdates events for writes and removals', async () => {
    const { cacheScripts } = loadCacheScripts();
    const updates = [];
    const unsubscribe = cacheScripts.subscribeCacheUpdates((payload) => {
      updates.push(payload);
    });

    await cacheScripts.writeCache('userCache', 'sub', { count: 1 });
    await cacheScripts.removeCache('userCache', 'sub');
    unsubscribe();

    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'write',
          namespace: 'userCache',
          slug: 'sub',
          key: 'dg:userCache:sub',
          source: 'local',
        }),
        expect.objectContaining({
          action: 'remove',
          namespace: 'userCache',
          slug: 'sub',
          key: 'dg:userCache:sub',
          source: 'local',
        }),
      ]),
    );
  });

  it('retries transient IDB failures once and keeps IDB active', async () => {
    const key = 'dg:questionsCache:transient';
    const { cacheScripts, idbState } = loadCacheScripts({
      failSetByKey: { [key]: 1 },
      failGetByKey: { [key]: 1 },
      failDelByKey: { [key]: 1 },
    });
    await cacheScripts.initCacheManager();

    const firstWriteOk = await cacheScripts.writeCache('questionsCache', 'transient', { value: 1 });
    expect(firstWriteOk).toBe(true);
    expect(idbState.get(key)).toEqual({ value: 1 });
    expect(localStorage.getItem(key)).toBeNull();
    expect(cacheScripts.peekCacheSync('questionsCache', 'transient')).toEqual({ value: 1 });

    const secondWriteOk = await cacheScripts.writeCache('questionsCache', 'transient', { value: 2 });
    expect(secondWriteOk).toBe(true);
    expect(idbState.get(key)).toEqual({ value: 2 });
    expect(localStorage.getItem(key)).toBeNull();

    const firstRead = await cacheScripts.readCache('questionsCache', 'transient');
    expect(firstRead).toEqual({ value: 2 });
    expect(cacheScripts.peekCacheSync('questionsCache', 'transient')).toEqual({ value: 2 });

    const secondRead = await cacheScripts.readCache('questionsCache', 'transient');
    expect(secondRead).toEqual({ value: 2 });

    const firstRemoveOk = await cacheScripts.removeCache('questionsCache', 'transient');
    expect(firstRemoveOk).toBe(true);
    expect(idbState.has(key)).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('recovers IndexedDB backend by reconciling fallback localStorage data before rehydrating mirror', async () => {
    const key = 'dg:questionsCache:recover';
    const idbSeed = {
      1: {
        questions: {
          q1: { id: 'q1', prompt: 'old prompt' },
          q2: { id: 'q2', prompt: 'keep me' },
        },
        questionsLatestBlock: 3,
      },
      preserved: { marker: true },
    };
    const fallbackSeed = {
      1: {
        questions: {
          q1: { id: 'q1', prompt: 'new prompt' },
        },
        questionsLatestBlock: 9,
      },
      recovered: { source: 'localStorage' },
    };
    const merged = {
      1: {
        questions: {
          q1: { id: 'q1', prompt: 'new prompt' },
          q2: { id: 'q2', prompt: 'keep me' },
        },
        questionsLatestBlock: 9,
      },
      preserved: { marker: true },
      recovered: { source: 'localStorage' },
    };
    const { cacheScripts, idbState } = loadCacheScripts({
      failSetByKey: { [key]: 6 },
    });
    idbState.set(key, deepClone(idbSeed));
    await cacheScripts.initCacheManager();

    const first = await cacheScripts.writeCache('questionsCache', 'recover', { value: 1 });
    const second = await cacheScripts.writeCache('questionsCache', 'recover', { value: 2 });
    const fallback = await cacheScripts.writeCache('questionsCache', 'recover', fallbackSeed);

    expect(first).toBe(false);
    expect(second).toBe(false);
    expect(fallback).toBe(true);
    expect(idbState.get(key)).toEqual(idbSeed);
    expect(JSON.parse(localStorage.getItem(key))).toEqual(fallbackSeed);
    expect(cacheScripts.peekCacheSync('questionsCache', 'recover')).toEqual(fallbackSeed);

    const recovered = await cacheScripts.readCache('questionsCache', 'recover');
    expect(recovered).toEqual(merged);
    expect(cacheScripts.peekCacheSync('questionsCache', 'recover')).toEqual(merged);
    expect(idbState.get(key)).toEqual(merged);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('preserves optimistic mirror entries during IDB recovery hydration', async () => {
    const forceFallbackKey = 'dg:questionsCache:force-recovery';
    const optimisticKey = 'dg:questionsCache:optimistic-recovery';
    const unrelatedKey = 'dg:sbtCache:recovery-unrelated';
    const { cacheScripts, idb, idbState } = loadCacheScripts({
      failSetByKey: { [forceFallbackKey]: 6 },
    });
    idbState.set(optimisticKey, { value: 0 });
    idbState.set(unrelatedKey, { value: 'keep' });
    await cacheScripts.initCacheManager();

    await expect(cacheScripts.writeCache('questionsCache', 'force-recovery', { attempt: 1 })).resolves.toBe(false);
    await expect(cacheScripts.writeCache('questionsCache', 'force-recovery', { attempt: 2 })).resolves.toBe(false);
    await expect(cacheScripts.writeCache('questionsCache', 'force-recovery', { attempt: 3 })).resolves.toBe(true);

    const baseEntries = idb.entries.getMockImplementation();
    const baseSet = idb.set.getMockImplementation();
    let recoveryEntriesRead = false;
    let releaseOptimisticPersist;
    const optimisticPersistGate = new Promise((resolve) => {
      releaseOptimisticPersist = resolve;
    });
    idb.entries.mockImplementation(async (...args) => {
      const result = await baseEntries(...args);
      recoveryEntriesRead = true;
      return result;
    });
    idb.set.mockImplementation(async (storageKey, value, store) => {
      if (storageKey === optimisticKey && Number(value?.value) === 1) {
        await optimisticPersistGate;
      }
      return baseSet(storageKey, value, store);
    });

    const pending = cacheScripts.writeCacheOptimistic('questionsCache', 'optimistic-recovery', { value: 1 });
    expect(cacheScripts.peekCacheSync('questionsCache', 'optimistic-recovery')).toEqual({ value: 1 });

    await waitForCondition(() => recoveryEntriesRead, 'recovery IDB entries read');
    await Promise.resolve();

    expect(cacheScripts.peekCacheSync('questionsCache', 'optimistic-recovery')).toEqual({ value: 1 });
    expect(cacheScripts.listNamespaceEntriesSync('sbtCache')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          namespace: 'sbtCache',
          slug: 'recovery-unrelated',
          value: { value: 'keep' },
        }),
      ]),
    );

    releaseOptimisticPersist();
    await expect(pending).resolves.toBe(true);
    expect(idbState.get(optimisticKey)).toEqual({ value: 1 });
  });

  it('writeCacheOptimistic updates mirror immediately for non-awaited writes', async () => {
    const { cacheScripts } = loadCacheScripts();
    await cacheScripts.initCacheManager();

    const pending = cacheScripts.writeCacheOptimistic('sbtCache', 'optimistic', { value: 1 });
    expect(cacheScripts.peekCacheSync('sbtCache', 'optimistic')).toEqual({ value: 1 });

    const ok = await pending;
    expect(ok).toBe(true);
    expect(await cacheScripts.readCache('sbtCache', 'optimistic')).toEqual({ value: 1 });
  });

  it('preserves optimistic mirror while persistence is still pending', async () => {
    const key = 'dg:questionsCache:optimistic-pending-read';
    const { cacheScripts, idb, idbState } = loadCacheScripts();
    await cacheScripts.initCacheManager();
    await cacheScripts.writeCache('questionsCache', 'optimistic-pending-read', { value: 0 });

    const baseSet = idb.set.getMockImplementation();
    let releasePendingWrite;
    const pendingWriteGate = new Promise((resolve) => {
      releasePendingWrite = resolve;
    });
    let blockedOnce = false;
    idb.set.mockImplementation(async (storageKey, value) => {
      if (!blockedOnce && storageKey === key) {
        blockedOnce = true;
        await pendingWriteGate;
      }
      return baseSet(storageKey, value);
    });

    const pendingWrite = cacheScripts.writeCacheOptimistic('questionsCache', 'optimistic-pending-read', { value: 1 });
    expect(cacheScripts.peekCacheSync('questionsCache', 'optimistic-pending-read')).toEqual({ value: 1 });

    const readWhilePending = await cacheScripts.readCache('questionsCache', 'optimistic-pending-read');
    expect(readWhilePending).toEqual({ value: 1 });
    expect(cacheScripts.peekCacheSync('questionsCache', 'optimistic-pending-read')).toEqual({ value: 1 });

    releasePendingWrite();
    await expect(pendingWrite).resolves.toBe(true);
    expect(idbState.get(key)).toEqual({ value: 1 });
  });

  it('writeCacheOptimistic rolls back mirror when persistence fails', async () => {
    const key = 'dg:questionsCache:optimistic-fail';
    const { cacheScripts } = loadCacheScripts({
      failSetByKey: { [key]: 2 },
    });
    await cacheScripts.initCacheManager();

    const ok = await cacheScripts.writeCacheOptimistic('questionsCache', 'optimistic-fail', { value: 1 });
    expect(ok).toBe(false);
    expect(cacheScripts.peekCacheSync('questionsCache', 'optimistic-fail')).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('writeCacheOptimistic does not roll back newer mirror state when an older write fails', async () => {
    const key = 'dg:questionsCache:optimistic-ordering';
    const { cacheScripts, idb, idbState } = loadCacheScripts();
    await cacheScripts.initCacheManager();

    const baseSet = idb.set.getMockImplementation();
    idb.set.mockImplementation(async (storageKey, value) => {
      if (storageKey === key && Number(value?.value) === 1) {
        throw new Error('forced stale write failure');
      }
      return baseSet(storageKey, value);
    });

    const staleWrite = cacheScripts.writeCacheOptimistic('questionsCache', 'optimistic-ordering', { value: 1 });
    const latestWrite = cacheScripts.writeCacheOptimistic('questionsCache', 'optimistic-ordering', { value: 2 });

    expect(cacheScripts.peekCacheSync('questionsCache', 'optimistic-ordering')).toEqual({ value: 2 });
    await expect(staleWrite).resolves.toBe(false);
    await expect(latestWrite).resolves.toBe(true);

    expect(cacheScripts.peekCacheSync('questionsCache', 'optimistic-ordering')).toEqual({ value: 2 });
    expect(idbState.get(key)).toEqual({ value: 2 });
  });

  it('writeCacheOptimistic serializes same-key persistence and keeps latest committed value', async () => {
    const key = 'dg:questionsCache:optimistic-stale-success';
    const { cacheScripts, idb, idbState } = loadCacheScripts();
    await cacheScripts.initCacheManager();

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const baseSet = idb.set.getMockImplementation();
    idb.set.mockImplementation(async (storageKey, value) => {
      if (storageKey === key && Number(value?.value) === 1) {
        await wait(30);
      }
      if (storageKey === key && Number(value?.value) === 2) {
        await wait(5);
      }
      return baseSet(storageKey, value);
    });

    const staleWrite = cacheScripts.writeCacheOptimistic('questionsCache', 'optimistic-stale-success', { value: 1 });
    const latestWrite = cacheScripts.writeCacheOptimistic('questionsCache', 'optimistic-stale-success', { value: 2 });

    await expect(staleWrite).resolves.toBe(true);
    await expect(latestWrite).resolves.toBe(true);
    expect(cacheScripts.peekCacheSync('questionsCache', 'optimistic-stale-success')).toEqual({ value: 2 });
    expect(idbState.get(key)).toEqual({ value: 2 });
  });

  it('writeCacheOptimistic restores last committed value when queued writes both fail', async () => {
    const key = 'dg:questionsCache:optimistic-double-fail';
    const { cacheScripts, idb, idbState } = loadCacheScripts();
    await cacheScripts.initCacheManager();
    await cacheScripts.writeCache('questionsCache', 'optimistic-double-fail', { value: 0 });

    const baseSet = idb.set.getMockImplementation();
    idb.set.mockImplementation(async (storageKey, value) => {
      if (storageKey === key && (Number(value?.value) === 1 || Number(value?.value) === 2)) {
        throw new Error(`forced failure for value=${value?.value}`);
      }
      return baseSet(storageKey, value);
    });

    const writeA = cacheScripts.writeCacheOptimistic('questionsCache', 'optimistic-double-fail', { value: 1 });
    const writeB = cacheScripts.writeCacheOptimistic('questionsCache', 'optimistic-double-fail', { value: 2 });

    expect(cacheScripts.peekCacheSync('questionsCache', 'optimistic-double-fail')).toEqual({ value: 2 });
    await expect(writeA).resolves.toBe(false);
    await expect(writeB).resolves.toBe(false);

    expect(idbState.get(key)).toEqual({ value: 0 });
    expect(cacheScripts.peekCacheSync('questionsCache', 'optimistic-double-fail')).toEqual({ value: 0 });
    expect(await cacheScripts.readCache('questionsCache', 'optimistic-double-fail')).toEqual({ value: 0 });
  });

  it('writeCacheOptimistic restores previous optimistic mirror when storage snapshot is empty', async () => {
    const key = 'dg:questionsCache:optimistic-empty-snapshot';
    const { cacheScripts, idb, idbState } = loadCacheScripts();
    await cacheScripts.initCacheManager();

    const baseSet = idb.set.getMockImplementation();
    idb.set.mockImplementation(async (storageKey, value) => {
      if (storageKey === key && (Number(value?.value) === 1 || Number(value?.value) === 2)) {
        throw new Error(`forced failure for value=${value?.value}`);
      }
      return baseSet(storageKey, value);
    });

    const writeA = cacheScripts.writeCacheOptimistic('questionsCache', 'optimistic-empty-snapshot', { value: 1 });
    const writeB = cacheScripts.writeCacheOptimistic('questionsCache', 'optimistic-empty-snapshot', { value: 2 });

    expect(cacheScripts.peekCacheSync('questionsCache', 'optimistic-empty-snapshot')).toEqual({ value: 2 });
    await expect(writeA).resolves.toBe(false);
    await expect(writeB).resolves.toBe(false);

    expect(idbState.has(key)).toBe(false);
    expect(cacheScripts.peekCacheSync('questionsCache', 'optimistic-empty-snapshot')).toEqual({ value: 1 });
  });

  it('does not update mirror when persistence fails after retries', async () => {
    const key = 'dg:questionsCache:hard-fail';
    const { cacheScripts, idbState } = loadCacheScripts({
      failSetByKey: { [key]: 2 },
    });
    await cacheScripts.initCacheManager();

    const ok = await cacheScripts.writeCache('questionsCache', 'hard-fail', { value: 1 });
    expect(ok).toBe(false);
    expect(idbState.has(key)).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
    expect(cacheScripts.peekCacheSync('questionsCache', 'hard-fail')).toBeNull();
  });

  it('uses storage-only cross-tab handling in fallback mode to avoid duplicate updates', async () => {
    const { cacheScripts, broadcastChannels, emitBroadcastMessage } = loadCacheScripts({
      failProbe: true,
      withBroadcastChannel: true,
    });
    await cacheScripts.initCacheManager();

    const updates = [];
    const unsubscribe = cacheScripts.subscribeCacheUpdates((payload) => {
      updates.push(payload);
    });

    const key = 'dg:userCache:shared';
    const value = { count: 1 };

    const storageWrite = new Event('storage');
    Object.defineProperty(storageWrite, 'key', { value: key });
    Object.defineProperty(storageWrite, 'newValue', { value: JSON.stringify(value) });
    window.dispatchEvent(storageWrite);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      action: 'write',
      key,
      source: 'storage',
    });

    emitBroadcastMessage({
      _dgCacheScripts: true,
      sourceId: 'remote-tab',
      action: 'write',
      key,
      value,
    });
    expect(updates).toHaveLength(1);

    const storageRemove = new Event('storage');
    Object.defineProperty(storageRemove, 'key', { value: key });
    Object.defineProperty(storageRemove, 'newValue', { value: null });
    window.dispatchEvent(storageRemove);

    expect(updates).toHaveLength(2);
    expect(updates[1]).toMatchObject({
      action: 'remove',
      key,
      source: 'storage',
    });

    emitBroadcastMessage({
      _dgCacheScripts: true,
      sourceId: 'remote-tab',
      action: 'remove',
      key,
    });
    expect(updates).toHaveLength(2);

    await cacheScripts.writeCache('userCache', 'shared', { count: 2 });
    expect(broadcastChannels.length).toBeGreaterThan(0);
    expect(broadcastChannels[0].postMessage).toHaveBeenCalledTimes(0);

    unsubscribe();
  });

  it('peekCacheSync keeps clone-by-default and allows opt-out with clone:false', async () => {
    const { cacheScripts } = loadCacheScripts();
    await cacheScripts.initCacheManager();
    await cacheScripts.writeCache('questionsCache', 'alpha', {
      nested: { count: 1 },
    });

    const cloned = cacheScripts.peekCacheSync('questionsCache', 'alpha');
    cloned.nested.count = 99;
    expect(cacheScripts.peekCacheSync('questionsCache', 'alpha')).toEqual({
      nested: { count: 1 },
    });

    const refValue = cacheScripts.peekCacheSync('questionsCache', 'alpha', { clone: false });
    refValue.nested.count = 42;
    expect(cacheScripts.peekCacheSync('questionsCache', 'alpha', { clone: false })).toEqual({
      nested: { count: 42 },
    });
  });

  it('listNamespaceEntriesSync keeps cloned values by default and allows cloneValues:false', async () => {
    const { cacheScripts } = loadCacheScripts();
    await cacheScripts.initCacheManager();
    await cacheScripts.writeCache('filters', 'alpha', {
      byMode: { questions: { active: true } },
    });

    const clonedEntries = cacheScripts.listNamespaceEntriesSync('filters');
    const clonedEntry = clonedEntries.find((entry) => entry.slug === 'alpha');
    expect(clonedEntry).toBeTruthy();
    clonedEntry.value.byMode.questions.active = false;

    const stillStored = cacheScripts.peekCacheSync('filters', 'alpha');
    expect(stillStored).toEqual({
      byMode: { questions: { active: true } },
    });

    const refEntries = cacheScripts.listNamespaceEntriesSync('filters', { cloneValues: false });
    const refEntry = refEntries.find((entry) => entry.slug === 'alpha');
    expect(refEntry).toBeTruthy();
    refEntry.value.byMode.questions.active = false;

    const rawStored = cacheScripts.peekCacheSync('filters', 'alpha', { clone: false });
    expect(rawStored).toEqual({
      byMode: { questions: { active: false } },
    });
  });

  it('tracks namespace presence and slug listings without materializing entry objects', async () => {
    const { cacheScripts } = loadCacheScripts();
    await cacheScripts.initCacheManager();

    expect(cacheScripts.hasNamespaceEntriesSync('questionsCache')).toBe(false);
    expect(cacheScripts.listNamespaceSlugsSync('questionsCache')).toEqual([]);

    await cacheScripts.writeCache('questionsCache', 'edge', { count: 1 });
    await cacheScripts.writeCache('questionsCache', '', { count: 2 });

    expect(cacheScripts.hasNamespaceEntriesSync('questionsCache')).toBe(true);
    expect(cacheScripts.listNamespaceSlugsSync('questionsCache')).toEqual(['edge', '']);
    expect(cacheScripts.hasNamespaceEntriesSync('unknownNamespace')).toBe(false);
    expect(cacheScripts.listNamespaceSlugsSync('unknownNamespace')).toEqual([]);
  });
});
