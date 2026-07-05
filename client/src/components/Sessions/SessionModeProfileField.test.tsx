import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import SessionModeProfileField from './SessionModeProfileField';
import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
} from '../../utilities/session/sessionModeProfile';

describe('SessionModeProfileField', () => {
  it('starts with no selected preset and gates Continue', () => {
    const onChange = jest.fn();
    render(<SessionModeProfileField registryChainId={11155420} onChange={onChange} />);

    expect(screen.getByTestId('ce-new-preset-continue')).toBeDisabled();
    expect(screen.getByTestId('ce-new-preset-fast_cheap_cloudflare')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('ce-new-preset-trustless_public_decentralized')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/Hosted on Cloudflare\. Private by default and session-scoped\./)).toBeInTheDocument();
    expect(screen.getByText(/Published publicly and permanently unless you enable encryption\./)).toBeInTheDocument();
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
      })
    );
  });

  it('marks profile custom after an advanced override', () => {
    const onChange = jest.fn();
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const { rerender } = render(
      <SessionModeProfileField registryChainId={11155420} value={profile} onChange={onChange} />
    );

    fireEvent.click(screen.getByRole('button', { name: /advanced options/i }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: /storage backend/i })).getByRole('radio', { name: /arweave/i }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preset: 'custom',
        storage: { backend: 'arweave' },
      }),
      expect.objectContaining({
        storageProfile: expect.objectContaining({ backend: 'arweave' }),
      })
    );

    rerender(
      <SessionModeProfileField
        registryChainId={11155420}
        value={onChange.mock.calls[0][0]}
        onChange={onChange}
      />
    );
    expect(screen.getByText('Custom')).toBeInTheDocument();
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
    expect(within(screen.getByRole('radiogroup', { name: /encryption/i })).getByRole('radio', { name: /lit/i }))
      .toBeDisabled();
  });
});
