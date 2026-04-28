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

  const createRequest = <T,>(tx: IDBTransaction, run: () => T) => {
    const request = {
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
          (tx as IDBTransaction & { error?: Error | null }).error = error;
          if (typeof tx.onabort === 'function') {
            tx.onabort({ target: tx } as Event);
          }
          return;
        }
        if (typeof tx.oncomplete === 'function') {
          tx.oncomplete({ target: tx } as Event);
        }
      } catch (error) {
        request.error = error as Error;
        (tx as IDBTransaction & { error?: Error | null }).error = error as Error;
        if (typeof request.onerror === 'function') {
          request.onerror({ target: request });
        }
        if (typeof tx.onerror === 'function') {
          tx.onerror({ target: tx } as Event);
        }
      }
    }, 0);

    return request as IDBRequest<T>;
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
      const tx = {
        oncomplete: null as ((event?: unknown) => void) | null,
        onerror: null as ((event?: unknown) => void) | null,
        onabort: null as ((event?: unknown) => void) | null,
        error: null as Error | null,
        objectStore: jest.fn(() => ({
          put: jest.fn((value: unknown, key: string) => createRequest(tx as unknown as IDBTransaction, () => {
            ensureStore(storeName).set(key, value);
            return key;
          })),
        })),
      };
      return tx;
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
      delete (globalThis as typeof globalThis & { indexedDB?: IDBFactory }).indexedDB;
    }
  });

  it('resolves only after the surrounding transaction completes', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock(),
      configurable: true,
    });

    await expect(
      __test__runSessionWizardSponsoredBundleKeyDbTx('readwrite', (store) => store.put('value', 'key'))
    ).resolves.toBe('key');
  });

  it('rejects when the transaction aborts after the request reports success', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: createIndexedDbMock({ abortAfterRequestSuccess: true }),
      configurable: true,
    });

    await expect(
      __test__runSessionWizardSponsoredBundleKeyDbTx('readwrite', (store) => store.put('value', 'key'))
    ).rejects.toThrow('IndexedDB transaction aborted');
  });
});
