import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import SessionModeProfileField from './SessionModeProfileField';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

describe('SessionModeProfileField', () => {
  it('renders compact hosting choices with Corporate visibly unavailable', () => {
    const onChange = jest.fn();
    render(<SessionModeProfileField registryChainId={11155420} onChange={onChange} />);

    expect(screen.queryByTestId('ce-new-preset-continue')).not.toBeInTheDocument();
    expect(screen.queryByText('How should this session run?')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Select the infrastructure path that matches the inputs you have available.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Choose a setup')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View the deployment architecture diagram on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/blob/main/README.md#architecture-at-a-glance',
    );
    expect(screen.getByTestId('ce-new-preset-fast_cheap_cloudflare')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('ce-new-preset-trustless_public_decentralized')).toHaveAttribute('aria-checked', 'false');
    const cloudflareRequirements = within(screen.getByTestId('ce-new-preset-fast_cheap_cloudflare')).getByRole('list', {
      name: 'Fast & Cheap requirements',
    });
    expect(
      within(cloudflareRequirements)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Cloudflare login', 'AI API key']);
    const decentralizedRequirements = within(
      screen.getByTestId('ce-new-preset-trustless_public_decentralized'),
    ).getByRole('list', { name: 'Trustless & Public requirements' });
    expect(
      within(decentralizedRequirements)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Compatible Session Worker', 'AI API key', 'Arweave wallet', 'RPC URL', 'EVM testnet gas']);
    expect(
      screen.getByText('Use a Session Worker for the web runtime while the EVM registry and Arweave stay canonical.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /advanced options/i })).not.toBeInTheDocument();
    const selector = screen.getByRole('radiogroup', { name: 'Session hosting profile' });
    expect(within(selector).getByRole('radio', { name: 'Fast & Cheap (Cloudflare)' })).toBeInTheDocument();
    expect(within(selector).getByRole('radio', { name: 'Trustless & Public (Decentralized)' })).toBeInTheDocument();
    expect(within(selector).queryByRole('radio', { name: /Corporate/i })).not.toBeInTheDocument();
  });

  it('collapses the chosen entry card into the compact hosting selector', () => {
    const Harness = () => {
      const [profile, setProfile] = React.useState<ReturnType<typeof cloneSessionModePreset> | null>(null);
      const [entryOnly, setEntryOnly] = React.useState(true);
      return (
        <SessionModeProfileField
          registryChainId={11155420}
          value={profile}
          onChange={(nextProfile) => setProfile(nextProfile)}
          onContinue={() => setEntryOnly(false)}
          entryOnly={entryOnly}
          showContinue={entryOnly}
        />
      );
    };
    render(<Harness />);

    fireEvent.click(screen.getByTestId('ce-new-preset-fast_cheap_cloudflare'));

    expect(screen.queryByRole('list', { name: 'Fast & Cheap requirements' })).not.toBeInTheDocument();
    expect(screen.queryByText('Hosting')).not.toBeInTheDocument();
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Cloudflare' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Corporate.*coming later/i })).toBeDisabled();
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

    const customizeButton = screen.getByRole('button', { name: 'Customize session settings' });
    expect(customizeButton).toHaveAttribute('aria-pressed', 'false');
    expect(customizeButton).toHaveAttribute('data-testid', E2E_TESTIDS.WIZARD_MODE_ADVANCED);
    fireEvent.click(customizeButton);

    expect(onCustomize).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Advanced hosting options' })).not.toBeInTheDocument();
  });

  it('marks Customize active and returns to the guided flow when a preset is selected', () => {
    const onSelectPreset = jest.fn();
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <SessionModeProfileField
        registryChainId={11155420}
        value={cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE)}
        onChange={jest.fn()}
        onSelectPreset={onSelectPreset}
        onCustomize={jest.fn()}
        customizing
      />,
    );

    expect(screen.getByRole('button', { name: 'Finish customizing session settings' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Finish customizing session settings' })).toHaveTextContent('Done');
    fireEvent.click(screen.getByTestId('ce-new-preset-trustless_public_decentralized'));

    expect(onSelectPreset).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
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

  it('continues an existing saved profile without replacing its custom settings', () => {
    const onContinue = jest.fn();
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.surfaces.agentHttp = true;

    render(
      <SessionModeProfileField
        registryChainId={11155420}
        value={profile}
        onChange={jest.fn()}
        onContinue={onContinue}
        entryOnly
      />,
    );

    expect(screen.getByText('Saved custom settings')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with saved settings' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('supports arrow-key selection within the hosting radio group', () => {
    const onChange = jest.fn();
    const onContinue = jest.fn();
    render(
      <SessionModeProfileField registryChainId={11155420} onChange={onChange} onContinue={onContinue} entryOnly />,
    );

    fireEvent.keyDown(screen.getByTestId('ce-new-preset-fast_cheap_cloudflare'), { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ preset: SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED }),
      expect.any(Object),
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

    expect(confirmSpy).toHaveBeenCalledWith('Switch preset and replace incompatible custom settings?');
    expect(onChange).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
