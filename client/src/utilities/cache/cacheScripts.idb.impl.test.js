import { IDB_STALL_MS, createStore, entries, get, set } from './cacheScripts.idb.impl.js';

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

  describe('an operation that makes no progress', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const installDatabase = (transaction) => {
      const db = { objectStoreNames: { contains: () => true }, transaction, close: jest.fn() };
      const open = jest.fn(() => {
        const request = { result: db };
        setTimeout(() => request.onsuccess(), 0);
        return request;
      });
      Object.defineProperty(globalThis, 'indexedDB', { value: { open }, configurable: true, writable: true });
      return { db, open };
    };

    it('fails, aborting its transaction and closing its connection, when another tab holds the store', async () => {
      const aborts = [];
      // The write waits behind another tab's write that never ends (a tab the phone suspended mid-write).
      const { db } = installDatabase(() => {
        const tx = {
          objectStore: () => ({ put: () => ({}) }),
          abort: jest.fn(() => {
            aborts.push(tx);
            setTimeout(() => tx.onabort(), 0);
          }),
        };
        return tx;
      });
      const write = set('key', 'value', createStore('held-store', 'records'));
      const outcome = write.then(
        () => 'saved',
        (error) => error.message,
      );

      await jest.advanceTimersByTimeAsync(IDB_STALL_MS - 1);
      expect(aborts).toHaveLength(0);
      await jest.advanceTimersByTimeAsync(1);
      await expect(outcome).resolves.toMatch('made no progress');
      // Aborted, so the write can't land later over whatever replaced it. The next operation opens a new connection,
      // so this one is closed rather than left open.
      expect(aborts).toHaveLength(1);
      expect(db.close).toHaveBeenCalledTimes(1);
    });

    it("runs a long queue of the tab's own writes for as long as the queue keeps moving", async () => {
      const step = IDB_STALL_MS - 1000;
      let queueEndsAt = 0;
      const { db } = installDatabase(() => {
        const tx = { abort: jest.fn() };
        tx.objectStore = () => ({
          put: () => {
            // IndexedDB runs one write at a time: each ends a step after the one before it.
            queueEndsAt = Math.max(queueEndsAt, Date.now()) + step;
            setTimeout(() => tx.oncomplete(), queueEndsAt - Date.now());
            return {};
          },
        });
        return tx;
      });
      const store = createStore('busy-store', 'records');
      // Such as the pass that hides decrypted text when the reader changes, which writes every entry at once.
      const writes = Promise.all(['a', 'b', 'c'].map((key) => set(key, 'value', store)));

      // The last write waits almost three times the limit, but the queue never stops for that long.
      await jest.advanceTimersByTimeAsync(3 * step + 10);
      await expect(writes).resolves.toEqual([undefined, undefined, undefined]);
      expect(db.close).not.toHaveBeenCalled();
    });

    it('keeps reading a large store for as long as its entries keep coming', async () => {
      const step = IDB_STALL_MS - 1000;
      let tx;
      installDatabase(() => {
        tx = { abort: jest.fn() };
        tx.objectStore = () => ({
          openCursor: () => {
            const cursorRequest = {};
            let at = 0;
            const next = () =>
              setTimeout(() => {
                if (at < 3) {
                  at += 1;
                  cursorRequest.result = { key: `k${at}`, value: at, continue: next };
                } else {
                  cursorRequest.result = null;
                  setTimeout(() => tx.oncomplete(), 0);
                }
                cursorRequest.onsuccess();
              }, step);
            next();
            return cursorRequest;
          },
        });
        return tx;
      });
      const read = entries(createStore('slow-store', 'records'));

      // Four steps of almost the limit each: longer in all than the limit, never that long without an entry.
      await jest.advanceTimersByTimeAsync(4 * step + 10);
      await expect(read).resolves.toEqual([
        ['k1', 1],
        ['k2', 2],
        ['k3', 3],
      ]);
      expect(tx.abort).not.toHaveBeenCalled();
    });

    it('fails an open that is never answered, and the next operation opens again', async () => {
      const db = {
        objectStoreNames: { contains: () => true },
        transaction: () => {
          const tx = {};
          return Object.assign(tx, {
            objectStore: () => ({
              get: () => {
                setTimeout(() => tx.oncomplete(), 0);
                return { result: 'stored' };
              },
            }),
          });
        },
      };
      const unanswered = {};
      let opened = 0;
      const open = () => {
        opened += 1;
        if (opened === 1) return unanswered;
        const request = { result: db };
        setTimeout(() => request.onsuccess(), 0);
        return request;
      };
      Object.defineProperty(globalThis, 'indexedDB', { value: { open }, configurable: true, writable: true });
      const store = createStore('unanswered-open', 'records');

      const first = get('key', store).catch((error) => error.message);
      await jest.advanceTimersByTimeAsync(IDB_STALL_MS);
      await expect(first).resolves.toMatch('open made no progress');

      const second = get('key', store);
      await jest.advanceTimersByTimeAsync(1);
      await expect(second).resolves.toBe('stored');
      expect(opened).toBe(2);

      // Answered at last: nothing uses that connection, so it is closed.
      const late = { close: jest.fn() };
      unanswered.result = late;
      unanswered.onsuccess();
      expect(late.close).toHaveBeenCalledTimes(1);
    });

    it('keeps the newer connection when one given up on is told to close', async () => {
      const connections = [];
      const open = jest.fn(() => {
        const stalls = connections.length === 0;
        const db = {
          objectStoreNames: { contains: () => true },
          close: jest.fn(),
          transaction: () => {
            const tx = { abort: () => setTimeout(() => tx.onabort(), 0) };
            tx.objectStore = () => ({
              get: () => {
                if (!stalls) setTimeout(() => tx.oncomplete(), 0);
                return { result: 'stored' };
              },
            });
            return tx;
          },
        };
        connections.push(db);
        const request = { result: db };
        setTimeout(() => request.onsuccess(), 0);
        return request;
      });
      Object.defineProperty(globalThis, 'indexedDB', { value: { open }, configurable: true, writable: true });
      const store = createStore('version-change', 'records');
      const read = async () => {
        const value = get('key', store).catch((error) => error.message);
        await jest.advanceTimersByTimeAsync(IDB_STALL_MS);
        return value;
      };

      await expect(read()).resolves.toMatch('made no progress');
      await expect(read()).resolves.toBe('stored');
      // Another tab upgrades or deletes the database: the first connection hears of it late.
      connections[0].onversionchange();
      await expect(read()).resolves.toBe('stored');
      expect(open).toHaveBeenCalledTimes(2);
    });
  });
});
