import {
  loadSbtRecoverySnapshot,
  selectCreateEncryptedRecovery,
} from './SbtEncryptedRecoveryControl';

describe('SBT encrypted recovery UI controller', () => {
  it('writes only after explicit create-flow opt-in and reports successful recovery', async () => {
    const write = jest.fn().mockResolvedValue({ ok: true, status: 'ok' });

    await expect(
      selectCreateEncryptedRecovery({
        chainId: 84532,
        enabled: true,
        passwords: ['code-one'],
        sbtAddress: '0xabc0000000000000000000000000000000000000',
        write,
      }),
    ).resolves.toEqual({
      patch: { encryptedRecoveryEnabled: true, encryptedRecoveryStatus: 'saved' },
      warning: '',
    });
    expect(write).toHaveBeenCalledWith(expect.objectContaining({ mode: 'replace', passwords: ['code-one'] }));
  });

  it('keeps export-only active when browser encryption is unavailable', async () => {
    const write = jest.fn().mockResolvedValue({ ok: false, status: 'unavailable' });

    await expect(
      selectCreateEncryptedRecovery({
        enabled: true,
        passwords: ['code-one'],
        sbtAddress: '0xabc0000000000000000000000000000000000000',
        write,
      }),
    ).resolves.toEqual({
      patch: { encryptedRecoveryEnabled: false, encryptedRecoveryStatus: 'unavailable' },
      warning: expect.stringMatching(/export/i),
    });
  });

  it('combines read-only legacy recovery with decrypted opt-in recovery without duplicates', async () => {
    const readLegacy = jest.fn(() => ['legacy-code', 'shared-code']);
    const readEncrypted = jest.fn().mockResolvedValue({
      ok: true,
      status: 'ok',
      passwords: ['shared-code', 'encrypted-code'],
    });

    await expect(
      loadSbtRecoverySnapshot({
        chainId: 84532,
        sbtAddress: '0xabc0000000000000000000000000000000000000',
        readEncrypted,
        readLegacy,
      }),
    ).resolves.toEqual({
      cachedPasswords: ['legacy-code', 'shared-code', 'encrypted-code'],
      encryptedRecoveryEnabled: true,
      encryptedRecoveryStatus: 'saved',
    });
  });
});
