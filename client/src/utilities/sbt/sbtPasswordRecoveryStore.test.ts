import {
  SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY,
  SBT_PASSWORD_RECOVERY_INDEXED_DB_NAME,
  SBT_PASSWORD_RECOVERY_STORAGE_KEY,
  clearAllSbtPasswordRecoveryMemory,
  clearSbtPasswordRecoveryCodes,
  getSbtPasswordRecoveryCodes,
  getSbtPasswordRecoveryKey,
  purgeLegacySbtPasswordRecoveryArtifacts,
  readSbtPasswordRecoveryStore,
  upsertSbtPasswordRecoveryCodes,
  writeSbtPasswordRecoveryStore,
} from './sbtPasswordRecoveryStore.js';

const createMemoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: jest.fn((key: string) => data.get(key) || null),
    setItem: jest.fn((key: string, value: unknown) => data.set(key, String(value))),
    removeItem: jest.fn((key: string) => data.delete(key)),
  };
};

describe('sbtPasswordRecoveryStore tab-memory policy', () => {
  beforeEach(() => {
    clearAllSbtPasswordRecoveryMemory();
  });

  it('keeps scoped recovery codes in module memory without writing browser storage', () => {
    const storage = createMemoryStorage();
    const sbtAddress = '0xABC0000000000000000000000000000000000000';

    const result = upsertSbtPasswordRecoveryCodes({
      chainId: 84532,
      sbtAddress,
      passwords: [' one ', 'two', 'one'],
      storage,
      now: 1_000,
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'memory-only',
        key: getSbtPasswordRecoveryKey({ chainId: 84532, sbtAddress }),
        passwords: ['one', 'two'],
      }),
    );
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
    expect(getSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress, storage, now: 1_000 })).toEqual(['one', 'two']);
  });

  it('appends and clears only the selected tab-memory scope', () => {
    const first = '0xabc0000000000000000000000000000000000010';
    const second = '0xabc0000000000000000000000000000000000011';
    upsertSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress: first, passwords: ['alpha', 'beta'], now: 1_000 });
    upsertSbtPasswordRecoveryCodes({
      chainId: 84532,
      sbtAddress: first,
      passwords: ['beta', 'gamma'],
      mode: 'append',
      now: 2_000,
    });
    upsertSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress: second, passwords: ['second'], now: 2_000 });

    expect(getSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress: first, now: 2_000 })).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
    clearSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress: first });
    expect(getSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress: first, now: 2_000 })).toEqual([]);
    expect(getSbtPasswordRecoveryCodes({ chainId: 84532, sbtAddress: second, now: 2_000 })).toEqual(['second']);
  });

  it('purges legacy plaintext/ciphertext artifacts without importing their credentials', () => {
    const legacySecret = 'must-not-import';
    const storage = createMemoryStorage({
      [SBT_PASSWORD_RECOVERY_STORAGE_KEY]: JSON.stringify({ passwords: [legacySecret] }),
      [SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY]: JSON.stringify({ ciphertext: legacySecret }),
    });

    expect(readSbtPasswordRecoveryStore({ storage }).entries).toEqual({});
    expect(storage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
    expect(JSON.stringify(readSbtPasswordRecoveryStore({ storage }))).not.toContain(legacySecret);
  });

  it('purges both browser-storage surfaces and the old IndexedDB key database', () => {
    const localStorageRef = createMemoryStorage({
      [SBT_PASSWORD_RECOVERY_STORAGE_KEY]: 'plaintext',
      [SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY]: 'ciphertext',
    });
    const sessionStorageRef = createMemoryStorage({
      [SBT_PASSWORD_RECOVERY_STORAGE_KEY]: 'plaintext-session',
      [SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY]: 'ciphertext-session',
    });
    const indexedDbRef = { deleteDatabase: jest.fn() };

    purgeLegacySbtPasswordRecoveryArtifacts({ indexedDbRef, localStorageRef, sessionStorageRef });

    for (const storage of [localStorageRef, sessionStorageRef]) {
      expect(storage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
      expect(storage.getItem(SBT_ENCRYPTED_PASSWORD_RECOVERY_STORAGE_KEY)).toBeNull();
    }
    expect(indexedDbRef.deleteDatabase).toHaveBeenCalledWith(SBT_PASSWORD_RECOVERY_INDEXED_DB_NAME);
  });

  it('fails closed when a legacy caller asks to write a persisted envelope', () => {
    const storage = createMemoryStorage();

    expect(writeSbtPasswordRecoveryStore({ passwords: ['secret'] }, { storage })).toEqual({
      ok: false,
      status: 'browser-persistence-disabled',
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
