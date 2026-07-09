import { createStore, entries, get } from './cacheScripts.idb.impl.js';

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
});
