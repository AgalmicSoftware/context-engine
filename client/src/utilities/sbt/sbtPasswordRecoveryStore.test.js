import {
  SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS,
  SBT_PASSWORD_RECOVERY_KIND,
  SBT_PASSWORD_RECOVERY_STORAGE_KEY,
  getSbtPasswordRecoveryCodes,
  getSbtPasswordRecoveryKey,
  readSbtPasswordRecoveryStore,
  upsertSbtPasswordRecoveryCodes,
} from './sbtPasswordRecoveryStore.js';

const createMemoryStorage = () => {
  const data = new Map();
  return {
    getItem: jest.fn((key) => (data.has(key) ? data.get(key) : null)),
    setItem: jest.fn((key, value) => {
      data.set(key, String(value));
    }),
    removeItem: jest.fn((key) => {
      data.delete(key);
    }),
  };
};

describe('sbtPasswordRecoveryStore', () => {
  it('writes scoped, expiring recovery codes with a versioned envelope', () => {
    const storage = createMemoryStorage();
    const now = Date.parse('2026-04-23T00:00:00.000Z');
    const sbtAddress = '0xABC0000000000000000000000000000000000000';

    const result = upsertSbtPasswordRecoveryCodes({
      chainId: 84532,
      sbtAddress,
      passwords: [' one ', 'two', 'one'],
      storage,
      now,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      key: getSbtPasswordRecoveryKey({ chainId: 84532, sbtAddress }),
      passwords: ['one', 'two'],
      expiresAt: now + SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS,
    }));

    const stored = JSON.parse(storage.getItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY));
    expect(stored).toEqual(expect.objectContaining({
      v: 1,
      kind: SBT_PASSWORD_RECOVERY_KIND,
      updatedAt: now,
    }));
    expect(stored.entries[result.key]).toEqual(expect.objectContaining({
      chainId: 84532,
      sbtAddress: sbtAddress.toLowerCase(),
      passwords: ['one', 'two'],
      expiresAt: now + SBT_PASSWORD_RECOVERY_DEFAULT_TTL_MS,
    }));
  });

  it('appends codes without duplicating previous recovery codes', () => {
    const storage = createMemoryStorage();
    const sbtAddress = '0xabc0000000000000000000000000000000000000';

    upsertSbtPasswordRecoveryCodes({
      chainId: 84532,
      sbtAddress,
      passwords: ['alpha', 'beta'],
      storage,
      now: 1000,
    });
    const result = upsertSbtPasswordRecoveryCodes({
      chainId: 84532,
      sbtAddress,
      passwords: ['beta', 'gamma'],
      mode: 'append',
      storage,
      now: 2000,
    });

    expect(result.passwords).toEqual(['alpha', 'beta', 'gamma']);
    expect(getSbtPasswordRecoveryCodes({
      chainId: 84532,
      sbtAddress,
      storage,
      now: 2000,
    })).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('ignores expired entries instead of falling back to legacy storage', () => {
    const storage = createMemoryStorage();
    const sbtAddress = '0xabc0000000000000000000000000000000000000';
    const key = getSbtPasswordRecoveryKey({ chainId: 84532, sbtAddress });
    storage.setItem(SBT_PASSWORD_RECOVERY_STORAGE_KEY, JSON.stringify({
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
    }));

    expect(readSbtPasswordRecoveryStore({ storage, now: 2000 }).entries).toEqual({});
    expect(getSbtPasswordRecoveryCodes({
      chainId: 84532,
      sbtAddress,
      storage,
      now: 2000,
    })).toEqual([]);
  });
});
