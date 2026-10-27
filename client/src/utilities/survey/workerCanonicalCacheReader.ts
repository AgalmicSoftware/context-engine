// The Worker authorizes each read for its principal and decrypts envelopes for
// authorized readers, so cached Worker data belongs to the account that read it.
// The store sets the reader synchronously on every account change, before any
// render. This module stays dependency-free so the store can import it.
let currentReader = '';

export const normalizeWorkerCanonicalCacheReader = (account: unknown): string =>
  typeof account === 'string' ? account.trim().toLowerCase() : '';

export const setWorkerCanonicalCacheReader = (account: unknown): void => {
  currentReader = normalizeWorkerCanonicalCacheReader(account);
};

export const getWorkerCanonicalCacheReader = (): string => currentReader;
