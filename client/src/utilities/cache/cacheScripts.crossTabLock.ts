import { createLogger } from '../logging.js';

const cacheLog = createLogger('cacheScripts');

// How long a write waits for another tab to let go of its key. A phone can suspend a tab in the middle of a write,
// and the lock then stays held for as long as that tab sleeps.
export const CROSS_TAB_LOCK_WAIT_MS = 10_000;
// Keys another tab held past the wait. Their writes take the lock only if it is free, without waiting, until it is
// found free again: the tab that held it has let go, and writes wait their turn as before.
const keysHeldElsewhere = new Set<string>();

// Each persisted write of a key also holds a browser-wide lock on it, so tabs
// write one at a time and an atomic update reads what the last writer saved.
// Without the Web Locks API, only this tab's queue orders the writes, and so it
// is for a key another tab is still holding past the wait.
export const withCrossTabWriteLock = async <T>(storageKey: string, task: () => Promise<T>): Promise<T> => {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (typeof locks?.request !== 'function') return task();
  const name = `ce-cache:${storageKey}`;
  if (keysHeldElsewhere.has(storageKey)) {
    return (await locks.request(name, { ifAvailable: true }, (lock) => {
      if (lock) keysHeldElsewhere.delete(storageKey);
      return task();
    })) as T;
  }
  const wait = new AbortController();
  const timer = setTimeout(() => wait.abort(), CROSS_TAB_LOCK_WAIT_MS);
  let granted = false;
  try {
    return (await locks.request(name, { signal: wait.signal }, () => {
      granted = true;
      clearTimeout(timer);
      return task();
    })) as T;
  } catch (error) {
    if (granted || !wait.signal.aborted) throw error;
    keysHeldElsewhere.add(storageKey);
    cacheLog.warn('[cacheScripts] Another tab held this cache key past the wait; writing it without the lock', {
      storageKey,
      waitedMs: CROSS_TAB_LOCK_WAIT_MS,
    });
    return task();
  } finally {
    clearTimeout(timer);
  }
};
