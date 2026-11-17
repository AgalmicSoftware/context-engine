import { createStore, entries, get, set } from './cacheScripts.idb.impl.js';

const originalIndexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');

describe('cacheScripts.idb.impl', () => {
  afterEach(() => {
    if (originalIndexedDbDescriptor) {
      Object.defineProperty(globalThis, 'indexedDB', originalIndexedDbDescriptor);
    } else {
      delete globalThis.indexedDB;
    }
  });

  it('normalizes store names with idb-keyval-compatible defaults', () => {
    expect(createStore()).toEqual({
      dbName: 'keyval-store',
      storeName: 'keyval',
    });
    expect(createStore('ce-cache', 'records')).toEqual({
      dbName: 'ce-cache',
      storeName: 'records',
    });
  });

  it('rejects reads when IndexedDB is unavailable without falling back silently', async () => {
    delete globalThis.indexedDB;

    await expect(get('key', createStore('missing-idb', 'records'))).rejects.toThrow('IndexedDB not available');
    await expect(entries(createStore('missing-idb-entries', 'records'))).rejects.toThrow('IndexedDB not available');
  });

  it('opens a new connection after one is lost, so one failure does not fail every later read', async () => {
    let opened = 0;
    const open = () => {
      opened += 1;
      const lost = opened === 1;
      const db = {
        objectStoreNames: { contains: () => true },
        transaction: () => {
          // WebKit after iOS suspends the page: the connection to the IndexedDB server is gone.
          if (lost) throw new Error('Connection to Indexed Database server lost. Refresh the page to try again');
          const tx = {};
          return Object.assign(tx, {
            objectStore: () => ({
              get: () => {
                const request = { result: 'stored' };
                setTimeout(() => tx.oncomplete(), 0);
                return request;
              },
              put: () => {
                setTimeout(() => tx.oncomplete(), 0);
                return {};
              },
            }),
          });
        },
      };
      const request = { result: db };
      setTimeout(() => request.onsuccess(), 0);
      return request;
    };
    Object.defineProperty(globalThis, 'indexedDB', { value: { open }, configurable: true, writable: true });
    const store = createStore('lost-connection', 'records');

    await expect(get('key', store)).rejects.toThrow('Connection to Indexed Database server lost');
    await expect(get('key', store)).resolves.toBe('stored');
    await expect(set('key', 'value', store)).resolves.toBeUndefined();
    expect(opened).toBe(2);
  });
});
