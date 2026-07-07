import {
  __test__resetSessionWizardSponsoredBundleCacheKey,
  __test__runSessionWizardSponsoredBundleKeyDbTx,
} from './sessionWizardSponsoredBundleCache';

jest.mock('../../utilities/logging', () => ({
  createLogger: jest.fn(() => ({
    warn: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('../../utilities/arweave/sponsoredBundles.js', () => ({
  hasSponsoredBundleFields: jest.fn(() => true),
  normalizeSparseSponsoredBundlePayload: jest.fn((value) => value),
}));

type IndexedDbMockOptions = {
  abortAfterRequestSuccess?: boolean;
};

type MockDbRequest<T> = {
  onsuccess: ((event?: unknown) => void) | null;
  onerror: ((event?: unknown) => void) | null;
  result: T | undefined;
  error: Error | null;
};

type MockDbTransaction = {
  oncomplete: ((event?: unknown) => void) | null;
  onerror: ((event?: unknown) => void) | null;
  onabort: ((event?: unknown) => void) | null;
  error: Error | null;
  objectStore: jest.Mock;
};

const asEvent = (target: unknown): Event => ({ target }) as unknown as Event;

const originalIndexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

const createIndexedDbMock = ({ abortAfterRequestSuccess = false }: IndexedDbMockOptions = {}) => {
  const stores = new Map<string, Map<string, unknown>>();
  const objectStoreNames = new Set<string>();

  const ensureStore = (name: string) => {
    const key = String(name || '');
    if (!stores.has(key)) stores.set(key, new Map());
    objectStoreNames.add(key);
    return stores.get(key) as Map<string, unknown>;
  };

  const createRequest = <T>(tx: MockDbTransaction, run: () => T) => {
    const request: MockDbRequest<T> = {
      onsuccess: null as ((event?: unknown) => void) | null,
      onerror: null as ((event?: unknown) => void) | null,
      result: undefined as T | undefined,
      error: null as Error | null,
    };

    setTimeout(() => {
      try {
        request.result = run();
        if (typeof request.onsuccess === 'function') {
          request.onsuccess({ target: request });
        }
        if (abortAfterRequestSuccess) {
          const error = new Error('IndexedDB transaction aborted');
          tx.error = error;
          if (typeof tx.onabort === 'function') {
            tx.onabort(asEvent(tx));
          }
          return;
        }
        if (typeof tx.oncomplete === 'function') {
          tx.oncomplete(asEvent(tx));
        }
      } catch (error) {
        request.error = error as Error;
        tx.error = error as Error;
        if (typeof request.onerror === 'function') {
          request.onerror({ target: request });
        }
        if (typeof tx.onerror === 'function') {
          tx.onerror(asEvent(tx));
        }
      }
    }, 0);

    return request as unknown as IDBRequest<T>;
  };

  const db = {
    objectStoreNames: {
      contains: (name: string) => objectStoreNames.has(String(name || '')),
    },
    createObjectStore: jest.fn((name: string) => {
      ensureStore(name);
      return {};
    }),
    close: jest.fn(),
    transaction: jest.fn((storeName: string) => {
      const tx: MockDbTransaction = {
        oncomplete: null as ((event?: unknown) => void) | null,
        onerror: null as ((event?: unknown) => void) | null,
        onabort: null as ((event?: unknown) => void) | null,
        error: null as Error | null,
        objectStore: jest.fn(),
      };
      tx.objectStore.mockImplementation(() => ({
        put: jest.fn((value: unknown, key: string) =>
          createRequest(tx, () => {
            ensureStore(storeName).set(key, value);
            return key;
          }),
        ),
      }));
      return tx as unknown as IDBTransaction;
    }),
  };

  return {
    __stores: stores,
    open: jest.fn(() => {
      const request = {
        onsuccess: null as ((event?: unknown) => void) | null,
        onerror: null as ((event?: unknown) => void) | null,
        onupgradeneeded: null as ((event?: unknown) => void) | null,
        result: null as unknown,
        error: null as Error | null,
      };

      setTimeout(() => {
        request.result = db;
        if (!objectStoreNames.has('keys') && typeof request.onupgradeneeded === 'function') {
          request.onupgradeneeded({ target: request });
        }
        if (typeof request.onsuccess === 'function') {
          request.onsuccess({ target: request });
        }
      }, 0);

      return request;
    }),
  };
};

describe('sessionWizardSponsoredBundleCache IndexedDB transaction helper', () => {
  afterEach(() => {
    __test__resetSessionWizardSponsoredBundleCacheKey();
    if (originalIndexedDbDescriptor) {
      Object.defineProperty(globalThis, 'indexedDB', originalIndexedDbDescriptor);
    } else {
      Reflect.deleteProperty(globalThis as Record<string, unknown>, 'indexedDB');
    }
  });

  it('resolves only after the surrounding transaction completes', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock(),
      configurable: true,
    });

    await expect(
      __test__runSessionWizardSponsoredBundleKeyDbTx('readwrite', (store) => store.put('value', 'key')),
    ).resolves.toBe('key');
  });

  it('rejects when the transaction aborts after the request reports success', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock({ abortAfterRequestSuccess: true }),
      configurable: true,
    });

    await expect(
      __test__runSessionWizardSponsoredBundleKeyDbTx('readwrite', (store) => store.put('value', 'key')),
    ).rejects.toThrow('IndexedDB transaction aborted');
  });
});
