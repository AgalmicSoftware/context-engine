import { render, screen } from '@testing-library/react';
import {
  SbtEncryptedRecoveryControl,
  loadSbtRecoverySnapshot,
  selectCreateEncryptedRecovery,
} from './SbtEncryptedRecoveryControl';

describe('SBT tab-memory recovery UI controller', () => {
  it('writes only to the injected memory port after explicit create-flow opt-in', async () => {
    const write = jest.fn().mockResolvedValue({ ok: true, status: 'memory-only' });

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

  it('keeps export-only active when tab memory is unavailable', async () => {
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

  it('loads only the current tab-memory recovery snapshot', async () => {
    const readMemory = jest.fn().mockResolvedValue({
      ok: true,
      status: 'ok',
      passwords: ['shared-code', 'shared-code', 'memory-code'],
    });

    await expect(
      loadSbtRecoverySnapshot({
        chainId: 84532,
        sbtAddress: '0xabc0000000000000000000000000000000000000',
        readMemory,
      }),
    ).resolves.toEqual({
      cachedPasswords: ['shared-code', 'memory-code'],
      encryptedRecoveryEnabled: true,
      encryptedRecoveryStatus: 'saved',
    });
  });

  it('states that export is durable and tab recovery disappears on reload', () => {
    render(<SbtEncryptedRecoveryControl checked={false} mode="create" onChange={jest.fn()} status="idle" />);

    expect(screen.getByText(/export is the only durable recovery path/i)).toBeInTheDocument();
    expect(screen.getByText(/memory only/i)).toBeInTheDocument();
    expect(screen.getByText(/reloading or closing the tab clears them/i)).toBeInTheDocument();
    expect(screen.queryByText(/encrypted local recovery/i)).not.toBeInTheDocument();
  });
});
