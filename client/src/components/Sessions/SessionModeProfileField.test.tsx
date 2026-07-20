import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import SessionModeProfileField from './SessionModeProfileField';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

describe('SessionModeProfileField', () => {
  it('renders compact hosting choices with Corporate visibly unavailable', () => {
    const onChange = jest.fn();
    render(<SessionModeProfileField registryChainId={11155420} onChange={onChange} />);

    expect(screen.queryByTestId('ce-new-preset-continue')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-new-preset-fast_cheap_cloudflare')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('ce-new-preset-trustless_public_decentralized')).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('button', { name: /advanced options/i })).not.toBeInTheDocument();
    const selector = screen.getByRole('radiogroup', { name: 'Session hosting profile' });
    expect(within(selector).getByRole('radio', { name: /Cloudflare/i })).toBeInTheDocument();
    expect(within(selector).getByRole('radio', { name: 'Decentralized' })).toBeInTheDocument();
    expect(within(selector).getByRole('radio', { name: /Corporate.*coming later/i })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: 'Choose how to host your session' })).not.toBeInTheDocument();
    expect(screen.queryByText('Fastest setup')).not.toBeInTheDocument();
    expect(screen.queryByText('Keys needed')).not.toBeInTheDocument();
  });

  it('can render selected setup mode without the entry Continue button', () => {
    const onChange = jest.fn();
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);

    render(
      <SessionModeProfileField registryChainId={11155420} value={profile} onChange={onChange} showContinue={false} />,
    );

    expect(screen.queryByTestId('ce-new-preset-continue')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-new-preset-fast_cheap_cloudflare')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /advanced options/i })).toBeInTheDocument();
  });

  it('selects a preset and emits the compiled storage profile', () => {
    const onChange = jest.fn();
    render(<SessionModeProfileField registryChainId={84532} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('ce-new-preset-trustless_public_decentralized'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: 'trustless_public_decentralized',
        evm: { registryChainId: 84532 },
        storage: { backend: 'arweave' },
      }),
      expect.objectContaining({
        storageProfile: expect.objectContaining({ backend: 'arweave' }),
      }),
    );
  });

  it('continues immediately after an entry preset is selected', () => {
    const onChange = jest.fn();
    const onContinue = jest.fn();
    render(
      <SessionModeProfileField
        registryChainId={11155420}
        onChange={onChange}
        onContinue={onContinue}
        entryOnly
      />,
    );

    fireEvent.click(screen.getByTestId('ce-new-preset-fast_cheap_cloudflare'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: 'fast_cheap_cloudflare',
        storage: expect.objectContaining({ backend: 'cloudflare' }),
        encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
      }),
      expect.objectContaining({
        storageProfile: expect.objectContaining({
          backend: 'cloudflare',
          payloadAccessControl: expect.objectContaining({ encryption: 'worker_envelope' }),
        }),
      }),
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('ce-new-preset-continue')).not.toBeInTheDocument();
  });

  it('offers Lit and Cloudflare-internal encryption for the Cloudflare preset', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const onChange = jest.fn();
    render(<SessionModeProfileField registryChainId={11155420} value={profile} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));

    expect(screen.getByRole('region', { name: 'Advanced hosting options' })).toBeInTheDocument();
    const encryptionOptions = within(screen.getByRole('radiogroup', { name: /encryption/i }));
    expect(encryptionOptions.getByRole('radio', { name: 'Cloudflare internal' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(encryptionOptions.getByRole('radio', { name: 'Lit' })).not.toBeDisabled();
    fireEvent.click(encryptionOptions.getByRole('radio', { name: 'Lit' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ preset: 'custom', encryption: { mode: 'lit' } }),
      expect.any(Object),
    );
  });

  it('marks profile custom after an advanced override', () => {
    const onChange = jest.fn();
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    render(<SessionModeProfileField registryChainId={11155420} value={profile} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: /storage backend/i })).getByRole('radio', { name: /arweave/i }),
    );

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preset: 'custom',
        storage: expect.objectContaining({ backend: 'arweave' }),
      }),
      expect.objectContaining({
        storageProfile: expect.objectContaining({ backend: 'arweave' }),
      }),
    );
  });

  it('confirms before switching away from customized settings', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const onChange = jest.fn();
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.surfaces.telegram = true;
    render(<SessionModeProfileField registryChainId={11155420} value={profile} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('ce-new-preset-trustless_public_decentralized'));

    expect(confirmSpy).toHaveBeenCalledWith('Switch preset and replace incompatible advanced settings?');
    expect(onChange).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('does not allow Lit until a registry chain exists', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const onChange = jest.fn();
    render(<SessionModeProfileField value={profile} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));

    expect(screen.getByText('Choose a registry chain before enabling Lit.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('radiogroup', { name: /encryption/i })).getByRole('radio', { name: /lit/i }),
    ).toBeDisabled();
  });

  it('selects worker envelope only under Cloudflare and emits condition defaults', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const onChange = jest.fn();
    const { rerender } = render(
      <SessionModeProfileField registryChainId={11155420} value={profile} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));
    fireEvent.click(screen.getByTestId('ce-new-encryption-worker_envelope'));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preset: 'custom',
        encryption: { mode: 'worker_envelope', keyProvider: 'worker_secret' },
      }),
      expect.objectContaining({
        storageProfile: expect.objectContaining({
          payloadAccessControl: {
            gate: 'role_gate',
            encryption: 'worker_envelope',
            accessConditions: {
              match: 'any',
              conditions: [
                { kind: 'worker_role', role: 'admin' },
                { kind: 'agent_grant_scope', scope: 'storage' },
              ],
            },
          },
        }),
      }),
    );

    const selected = onChange.mock.calls.at(-1)?.[0];
    rerender(<SessionModeProfileField registryChainId={11155420} value={selected} onChange={onChange} />);

    expect(screen.getByText(/Encrypted at rest\. Keys are held by the session worker/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ce-new-envelope-add-agent-scope'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        encryption: expect.objectContaining({
          accessConditions: {
            match: 'any',
            conditions: [{ kind: 'agent_grant_scope', scope: 'storage' }],
          },
        }),
      }),
      expect.objectContaining({
        storageProfile: expect.objectContaining({
          payloadAccessControl: expect.objectContaining({
            accessConditions: {
              match: 'any',
              conditions: [{ kind: 'agent_grant_scope', scope: 'storage' }],
            },
          }),
        }),
      }),
    );
  });

  it('keeps worker envelope disabled under Arweave with reason copy', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const onChange = jest.fn();
    render(<SessionModeProfileField registryChainId={11155420} value={profile} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));

    expect(
      screen.getByText(/Worker envelope encryption is available only with Cloudflare storage/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('ce-new-encryption-worker_envelope')).toBeDisabled();
  });
});
