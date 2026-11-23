// With cookies and site data blocked (a browser's "block all cookies", a strict privacy shield), reading
// window.localStorage or window.sessionStorage throws. Over a hundred modules read them directly, and a session
// could not open at all. The page gets an in-memory stand-in instead: it works for this visit, and nothing is
// kept once the tab closes or reloads.

// Object.keys(storage) lists the items, as on a real Storage, and never the methods; an item may be named like
// a method without replacing it.
export const createMemoryStorage = (): Storage => {
  const items = new Map<string, string>();
  const api = {
    get length() {
      return items.size;
    },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(String(key)) ?? null,
    setItem: (key: string, value: string) => void items.set(String(key), String(value)),
    removeItem: (key: string) => void items.delete(String(key)),
    clear: () => items.clear(),
  };
  return new Proxy(api, {
    get: (target, key) => (key in target ? Reflect.get(target, key) : items.get(String(key))),
    ownKeys: () => [...items.keys()],
    getOwnPropertyDescriptor: (_target, key) =>
      items.has(String(key))
        ? { value: items.get(String(key)), configurable: true, enumerable: true, writable: true }
        : undefined,
  }) as unknown as Storage;
};

type StorageName = 'localStorage' | 'sessionStorage';
type StorageWindow = { ceStorageBlocked?: StorageName[] } & Partial<Record<StorageName, Storage>>;

// The kinds of storage the browser refused, for the notice App.tsx shows.
export const readBlockedStorage = (win: StorageWindow = globalThis as StorageWindow): StorageName[] =>
  win?.ceStorageBlocked || [];

export const installStorageFallback = (win: StorageWindow = globalThis as StorageWindow): StorageName[] => {
  const replaced: StorageName[] = [];
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      // A browser that refuses throws on the read itself; one that has no storage gives nothing.
      if (win[name]) continue;
    } catch {
      // Replaced below.
    }
    try {
      Object.defineProperty(win, name, { value: createMemoryStorage(), configurable: true, writable: true });
      replaced.push(name);
    } catch {
      // A browser that will not let the property be replaced is left as it was.
    }
  }
  if (replaced.length) win.ceStorageBlocked = replaced;
  return replaced;
};
