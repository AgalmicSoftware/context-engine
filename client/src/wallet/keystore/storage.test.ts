import { createMemoryWalletStorage, createWalletStorage } from './storage';
import type { PasskeyWalletRecord, PasskeyWalletStorage } from '../types';

// A browser that blocks site data refuses the account database, and sign-in failed outright. Only there, the
// record is held in memory for the visit.
const record = { id: 'a', keyMode: 'passkey-derived', evmAddress: '0x01' } as unknown as PasskeyWalletRecord;
const refusing = (): PasskeyWalletStorage & { calls: number } => {
  const storage = {
    calls: 0,
    fail: async (): Promise<never> => {
      storage.calls += 1;
      throw new DOMException('The user denied permission to access the database.', 'UnknownError');
    },
    read: () => storage.fail(),
    write: () => storage.fail(),
    clear: () => storage.fail(),
  };
  return storage;
};

describe('wallet record storage', () => {
  it('keeps the record in memory where the browser has refused site storage, and stops asking the database', async () => {
    const primary = refusing();
    const storage = createWalletStorage(primary, createMemoryWalletStorage(), () => true);
    await expect(storage.read()).resolves.toBeNull();
    await storage.write(record);
    await expect(storage.read()).resolves.toEqual(record);
    await storage.clear();
    await expect(storage.read()).resolves.toBeNull();
    expect(primary.calls).toBe(1);
  });

  it('still fails in a browser that keeps its data, so an account is never dropped quietly', async () => {
    const storage = createWalletStorage(refusing(), createMemoryWalletStorage(), () => false);
    await expect(storage.write(record)).rejects.toThrow('denied permission');
    await expect(storage.read()).rejects.toThrow('denied permission');
  });

  it('never takes over from a database that has worked: a sign-out must reach the stored record', async () => {
    const stored = createMemoryWalletStorage(record);
    let failing = false;
    const primary: PasskeyWalletStorage = {
      read: () => (failing ? Promise.reject(new Error('transient')) : stored.read()),
      write: (next) => stored.write(next),
      clear: () => stored.clear(),
    };
    const storage = createWalletStorage(primary, createMemoryWalletStorage(), () => true);
    await expect(storage.read()).resolves.toEqual(record);
    failing = true;
    await expect(storage.read()).rejects.toThrow('transient');
    failing = false;
    await storage.clear();
    await expect(stored.read()).resolves.toBeNull();
  });

  it('refuses to keep the only copy of a key in memory', async () => {
    const storage = createWalletStorage(refusing(), createMemoryWalletStorage(), () => true);
    const encrypted = { id: 'e', evmAddress: '0x02' } as unknown as PasskeyWalletRecord;
    await expect(storage.write(encrypted)).rejects.toThrow('cannot be kept here');
    await expect(storage.read()).resolves.toBeNull();
  });

  it('uses the database whenever it answers, blocked notice or not', async () => {
    const primary = createMemoryWalletStorage();
    const memory = createMemoryWalletStorage();
    const storage = createWalletStorage(primary, memory, () => true);
    await storage.write(record);
    await expect(primary.read()).resolves.toEqual(record);
    await expect(memory.read()).resolves.toBeNull();
  });
});
