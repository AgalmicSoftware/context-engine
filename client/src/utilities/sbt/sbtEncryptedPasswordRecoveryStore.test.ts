import { webcrypto } from 'crypto';

import {
  SBT_ENCRYPTED_PASSWORD_RECOVERY_KIND,
  SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY,
  clearEncryptedSbtPasswordRecoveryCodes,
  createMemorySbtPasswordRecoveryKeyStore,
  readEncryptedSbtPasswordRecoveryCodes,
  upsertEncryptedSbtPasswordRecoveryCodes,
} from './sbtEncryptedPasswordRecoveryStore.js';

const cryptoApi = webcrypto as unknown as Crypto;

const createMemoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => data.get(key) || null),
    setItem: jest.fn((key: string, value: unknown) => data.set(key, String(value))),
    removeItem: jest.fn((key: string) => data.delete(key)),
  };
};

describe('sbtEncryptedPasswordRecoveryStore', () => {
  it('persists only an AES-GCM envelope and decrypts it with the browser-local key', async () => {
    const storage = createMemoryStorage();
    const keyStore = createMemorySbtPasswordRecoveryKeyStore();
    const sbtAddress = '0xABC0000000000000000000000000000000000000';
    const now = 1_000;

    await expect(
      upsertEncryptedSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress,
        passwords: ['secret-one', 'secret-two'],
        cryptoApi,
        keyStore,
        storage,
        now,
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: true, status: 'ok' }));

    const raw = storage.getItem(SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY) || '';
    expect(raw).not.toContain('secret-one');
    expect(JSON.parse(raw)).toEqual(
      expect.objectContaining({
        v: 2,
        kind: SBT_ENCRYPTED_PASSWORD_RECOVERY_KIND,
      }),
    );

    await expect(
      readEncryptedSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress,
        cryptoApi,
        keyStore,
        storage,
        now,
      }),
    ).resolves.toEqual({ ok: true, status: 'ok', passwords: ['secret-one', 'secret-two'] });
  });

  it('falls back without writing when WebCrypto is unavailable', async () => {
    const storage = createMemoryStorage();

    await expect(
      upsertEncryptedSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress: '0xabc0000000000000000000000000000000000000',
        passwords: ['export-only'],
        cryptoApi: null,
        keyStore: createMemorySbtPasswordRecoveryKeyStore(),
        storage,
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: false, status: 'unavailable' }));
    expect(storage.getItem(SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
  });

  it('does not write ciphertext when the IndexedDB key transaction aborts after request success', async () => {
    const storage = createMemoryStorage();
    const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    const db = {
      objectStoreNames: { contains: jest.fn(() => true) },
      close: jest.fn(),
      transaction: jest.fn(() => {
        const tx = {
          error: null as Error | null,
          oncomplete: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onabort: null as (() => void) | null,
          objectStore: jest.fn(() => ({
            get: jest.fn(() => {
              const request = { result: null, error: null, onsuccess: null as (() => void) | null, onerror: null };
              setTimeout(() => {
                request.onsuccess?.();
                tx.oncomplete?.();
              }, 0);
              return request;
            }),
            put: jest.fn(() => {
              const request = { result: 'browser-local-v1', error: null, onsuccess: null as (() => void) | null, onerror: null };
              setTimeout(() => {
                request.onsuccess?.();
                tx.error = new Error('key transaction aborted');
                tx.onabort?.();
              }, 0);
              return request;
            }),
          })),
        };
        return tx;
      }),
    };
    const indexedDbMock = {
      open: jest.fn(() => {
        const request = {
          result: db,
          error: null,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
          onupgradeneeded: null as (() => void) | null,
        };
        setTimeout(() => request.onsuccess?.(), 0);
        return request;
      }),
    };
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: indexedDbMock });

    try {
      await expect(
        upsertEncryptedSbtPasswordRecoveryCodes({
          chainId: 84532,
          sbtAddress: '0xabc0000000000000000000000000000000000006',
          passwords: ['must-not-write'],
          cryptoApi,
          storage,
        }),
      ).resolves.toEqual(expect.objectContaining({ ok: false, status: 'encrypt-failed' }));
      expect(storage.getItem(SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
    } finally {
      if (originalIndexedDb) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDb);
      else Reflect.deleteProperty(globalThis as Record<string, unknown>, 'indexedDB');
    }
  });

  it('does not create a replacement key while reading missing-key ciphertext', async () => {
    const storage = createMemoryStorage();
    const writerKeyStore = createMemorySbtPasswordRecoveryKeyStore();
    const readerKeyStore = createMemorySbtPasswordRecoveryKeyStore();
    const sbtAddress = '0xabc0000000000000000000000000000000000001';

    await upsertEncryptedSbtPasswordRecoveryCodes({
      chainId: 84532,
      sbtAddress,
      passwords: ['cannot-recover'],
      cryptoApi,
      keyStore: writerKeyStore,
      storage,
    });

    await expect(
      readEncryptedSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress,
        cryptoApi,
        keyStore: readerKeyStore,
        storage,
      }),
    ).resolves.toEqual({ ok: false, status: 'missing-key', passwords: [] });
    await expect(readerKeyStore.read()).resolves.toBeNull();
  });

  it('fails closed when ciphertext or its scoped metadata is tampered', async () => {
    const storage = createMemoryStorage();
    const keyStore = createMemorySbtPasswordRecoveryKeyStore();
    const sbtAddress = '0xabc0000000000000000000000000000000000002';

    await upsertEncryptedSbtPasswordRecoveryCodes({
      chainId: 84532,
      sbtAddress,
      passwords: ['authenticated'],
      cryptoApi,
      keyStore,
      storage,
    });
    const envelope = JSON.parse(storage.getItem(SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY) || '{}');
    const [entryKey] = Object.keys(envelope.entries);
    envelope.entries[entryKey].expiresAt += 1;
    storage.setItem(SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY, JSON.stringify(envelope));

    await expect(
      readEncryptedSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress,
        cryptoApi,
        keyStore,
        storage,
      }),
    ).resolves.toEqual({ ok: false, status: 'decrypt-failed', passwords: [] });
  });

  it('prunes expired entries without trying to decrypt them', async () => {
    const storage = createMemoryStorage();
    const keyStore = createMemorySbtPasswordRecoveryKeyStore();
    const sbtAddress = '0xabc0000000000000000000000000000000000003';

    await upsertEncryptedSbtPasswordRecoveryCodes({
      chainId: 84532,
      sbtAddress,
      passwords: ['expired'],
      cryptoApi,
      keyStore,
      storage,
      now: 1_000,
      ttlMs: 10,
    });

    await expect(
      readEncryptedSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress,
        cryptoApi: null,
        keyStore,
        storage,
        now: 1_011,
      }),
    ).resolves.toEqual({ ok: true, status: 'empty', passwords: [] });
    expect(JSON.parse(storage.getItem(SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY) || '{}').entries).toEqual({});
  });

  it('clears encrypted recovery for only the selected chain and group', async () => {
    const storage = createMemoryStorage();
    const keyStore = createMemorySbtPasswordRecoveryKeyStore();
    const first = '0xabc0000000000000000000000000000000000004';
    const second = '0xabc0000000000000000000000000000000000005';

    for (const sbtAddress of [first, second]) {
      await upsertEncryptedSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress,
        passwords: [sbtAddress],
        cryptoApi,
        keyStore,
        storage,
      });
    }

    await expect(
      clearEncryptedSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress: first, storage }),
    ).resolves.toEqual(expect.objectContaining({ ok: true, status: 'cleared' }));
    await expect(
      readEncryptedSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress: second,
        cryptoApi,
        keyStore,
        storage,
      }),
    ).resolves.toEqual({ ok: true, status: 'ok', passwords: [second] });
  });
});
