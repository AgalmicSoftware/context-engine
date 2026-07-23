import {
  SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY,
  clearEncryptedSbtPasswordRecoveryCodes,
  readEncryptedSbtPasswordRecoveryCodes,
  upsertEncryptedSbtPasswordRecoveryCodes,
} from './sbtEncryptedPasswordRecoveryStore.js';
import { SBT_PASSWORD_RECOVERY_STORAGE_KEY, clearAllSbtPasswordRecoveryMemory } from './sbtPasswordRecoveryStore.js';

const createMemoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: jest.fn((key: string) => data.get(key) || null),
    setItem: jest.fn((key: string, value: unknown) => data.set(key, String(value))),
    removeItem: jest.fn((key: string) => data.delete(key)),
  };
};

describe('legacy encrypted SBT recovery compatibility', () => {
  beforeEach(() => {
    clearAllSbtPasswordRecoveryMemory();
  });

  it('uses tab memory only and purges both old browser-storage envelopes', async () => {
    const storage = createMemoryStorage({
      [SBT_PASSWORD_RECOVERY_STORAGE_KEY]: 'legacy-plaintext',
      [SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY]: 'legacy-ciphertext',
    });
    const sbtAddress = '0xABC0000000000000000000000000000000000000';

    await expect(
      upsertEncryptedSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress,
        passwords: ['secret-one', 'secret-two'],
        storage,
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: true, status: 'memory-only' }));

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
    await expect(readEncryptedSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress, storage })).resolves.toEqual({
      ok: true,
      status: 'ok',
      passwords: ['secret-one', 'secret-two'],
    });
  });

  it('does not require WebCrypto or an IndexedDB key for memory-only recovery', async () => {
    const storage = createMemoryStorage();
    const sbtAddress = '0xabc0000000000000000000000000000000000001';

    await expect(
      upsertEncryptedSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress,
        passwords: ['memory-only'],
        cryptoApi: null,
        keyStore: null,
        storage,
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: true, status: 'memory-only' }));
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('clears only the selected in-memory group', async () => {
    const first = '0xabc0000000000000000000000000000000000004';
    const second = '0xabc0000000000000000000000000000000000005';
    for (const sbtAddress of [first, second]) {
      await upsertEncryptedSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress,
        passwords: [sbtAddress],
      });
    }

    await clearEncryptedSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress: first });
    await expect(readEncryptedSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress: first })).resolves.toEqual({
      ok: true,
      status: 'empty',
      passwords: [],
    });
    await expect(readEncryptedSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress: second })).resolves.toEqual({
      ok: true,
      status: 'ok',
      passwords: [second],
    });
  });
});
