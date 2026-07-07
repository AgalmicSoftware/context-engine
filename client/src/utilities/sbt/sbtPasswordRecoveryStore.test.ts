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
        key: getSbtPasswordRecoveryKey({ chainId: 84532, sbtAddress }),
        passwords: ['one', 'two'],
        expiresAt: now + SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS,
      }),
    );

    const stored = JSON.parse(storage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY) || '{}');
    expect(stored).toEqual(
      expect.objectContaining({
        v: 1,
        kind: SBT_PASSWORD_RECOVERY_KIND,
        updatedAt: now,
      }),
    );
    expect(stored.entries[result.key]).toEqual(
      expect.objectContaining({
        chainId: 84532,
        sbtAddress: sbtAddress.toLowerCase(),
        passwords: ['one', 'two'],
        expiresAt: now + SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS,
      }),
    );
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

    expect(result.passwords).toEqual(['alpha', 'beta', 'gamma']);
    expect(
      getSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress,
        storage,
        now: 2000,
      }),
    ).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('ignores expired entries instead of falling back to legacy storage', () => {
    const storage = createMemoryStorage();
    const sbtAddress = '0xabc0000000000000000000000000000000000000';
    const key = getSbtPasswordRecoveryKey({ chainId: 84532, sbtAddress });
    storage.setItem(
      SBT_PASSWORD_RECOVERY_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        kind: SBT_PASSWORD_RECOVERY_KIND,
        updatedAt: 1000,
        entries: {
          [key]: {
            chainId: 84532,
            sbtAddress,
            passwords: ['expired'],
            createdAt: 1000,
            updatedAt: 1000,
            expiresAt: 1500,
          },
        },
      }),
    );

    expect(readSbtPasswordRecoveryStore({ storage, now: 2000 }).entries).toEqual({});
    expect(
      getSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress,
        storage,
        now: 2000,
      }),
    ).toEqual([]);
  });

  it('fails closed when a legacy caller asks to write a persisted envelope', () => {
    const storage = createMemoryStorage();

    storage.setItem(
      SBT_PASSWORD_RECOVERY_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        kind: SBT_PASSWORD_RECOVERY_KIND,
        updatedAt: 1000,
        entries: {
          [unknownKey]: {
            chainId: null,
            sbtAddress,
            passwords: ['migrated-code'],
            createdAt: 1000,
            updatedAt: 1000,
            expiresAt: now + 60_000,
          },
        },
      }),
    );

    expect(
      getSbtPasswordRecoveryCodes({
        chainId: 84532,
        sbtAddress,
        storage,
        now,
      }),
    ).toEqual(['migrated-code']);

    const stored = JSON.parse(storage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY) || '{}');
    expect(stored.entries[unknownKey]).toBeUndefined();
    expect(stored.entries[scopedKey]).toEqual(
      expect.objectContaining({
        chainId: 84532,
        sbtAddress,
        passwords: ['migrated-code'],
      }),
    );
  });
});
