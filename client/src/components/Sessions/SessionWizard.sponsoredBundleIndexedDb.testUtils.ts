const createIndexedDbMock = () => {
  const stores = new Map();
  const objectStoreNames = new Set();

  const ensureStore = (name) => {
    const key = String(name || '');
    if (!stores.has(key)) stores.set(key, new Map());
    objectStoreNames.add(key);
    return stores.get(key);
  };

  const createRequest = (tx, run) => {
    const request = {
      onsuccess: null,
      onerror: null,
      result: undefined,
      error: null,
    };

    setTimeout(() => {
      try {
        request.result = run();
        if (typeof request.onsuccess === 'function') {
          request.onsuccess({ target: request });
        }
        if (typeof tx.oncomplete === 'function') {
          tx.oncomplete({ target: tx });
        }
      } catch (error) {
        request.error = error;
        tx.error = error;
        if (typeof request.onerror === 'function') {
          request.onerror({ target: request });
        }
        if (typeof tx.onerror === 'function') {
          tx.onerror({ target: tx });
        }
      }
    }, 0);

    return request;
  };

  const db = {
    objectStoreNames: {
      contains: (name) => objectStoreNames.has(String(name || '')),
    },
    createObjectStore: jest.fn((name) => {
      ensureStore(name);
      return {};
    }),
    close: jest.fn(),
    transaction: jest.fn((storeName) => {
      const tx = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: null,
        objectStore: jest.fn(() => ({
          get: jest.fn((key) => createRequest(tx, () => ensureStore(storeName).get(key))),
          put: jest.fn((value, key) =>
            createRequest(tx, () => {
              ensureStore(storeName).set(key, value);
              return key;
            }),
          ),
          delete: jest.fn((key) =>
            createRequest(tx, () => {
              ensureStore(storeName).delete(key);
              return undefined;
            }),
          ),
        })),
      };
      return tx;
    }),
  };

  return {
    __stores: stores,
    open: jest.fn(() => {
      const request = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: null,
        error: null,
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

export { createIndexedDbMock };
