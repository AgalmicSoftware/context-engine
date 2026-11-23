import { createMemoryStorage, installStorageFallback, readBlockedStorage } from './storageFallback';

// With site data blocked, reading window.localStorage throws and a session could not open. The page gets an
// in-memory stand-in for the visit.
const blockedWindow = () => {
  const win = {} as Record<string, unknown>;
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(win, name, {
      configurable: true,
      get() {
        throw new DOMException('Access is denied for this document.', 'SecurityError');
      },
    });
  }
  return win;
};

describe('storage stand-in', () => {
  it('replaces storage the browser refuses, and says which', () => {
    const win = blockedWindow();
    expect(installStorageFallback(win)).toEqual(['localStorage', 'sessionStorage']);
    expect(readBlockedStorage(win)).toEqual(['localStorage', 'sessionStorage']);
    const storage = win.localStorage as Storage;
    storage.setItem('a', '1');
    expect(storage.getItem('a')).toBe('1');
    expect(win.sessionStorage).not.toBe(storage);
  });

  it('leaves working storage alone', () => {
    const before = window.localStorage;
    expect(installStorageFallback(window)).toEqual([]);
    expect(window.localStorage).toBe(before);
    expect(readBlockedStorage(window)).toEqual([]);
  });

  it('behaves as a Storage: strings, missing keys, listing, removal', () => {
    const storage = createMemoryStorage();
    expect(storage.getItem('missing')).toBeNull();
    storage.setItem('n', 5 as unknown as string);
    storage.setItem('dg:x', '{"a":1}');
    expect(storage.getItem('n')).toBe('5');
    expect(storage.length).toBe(2);
    expect(storage.key(1)).toBe('dg:x');
    expect(storage.key(2)).toBeNull();
    // Callers list keys this way; the methods are never among them.
    expect(Object.keys(storage)).toEqual(['n', 'dg:x']);
    storage.setItem('getItem', 'kept');
    expect(storage.getItem('n')).toBe('5');
    storage.removeItem('n');
    expect(storage.getItem('n')).toBeNull();
    storage.clear();
    expect(storage.length).toBe(0);
  });
});
