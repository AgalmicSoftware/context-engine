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
  });

  it('sends customization into the wizard instead of opening a header popover', () => {
    const onCustomize = jest.fn();
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    render(
      <SessionModeProfileField
        registryChainId={11155420}
        value={profile}
        onChange={jest.fn()}
        onCustomize={onCustomize}
        showContinue={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));

    expect(onCustomize).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Advanced hosting options' })).not.toBeInTheDocument();
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
});
