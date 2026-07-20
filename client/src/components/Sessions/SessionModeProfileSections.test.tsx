import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import SessionModeProfileSections from './SessionModeProfileSections';
import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
  type SessionModeProfile,
} from '../../utilities/session/sessionModeProfile';

const renderSection = (section: 'privacy' | 'worker' | 'publish', initialProfile?: SessionModeProfile) => {
  const onChange = jest.fn();
  const seed = initialProfile || cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);

  const Harness = () => {
    const [profile, setProfile] = useState(seed);
    return (
      <SessionModeProfileSections
        section={section}
        registryChainId={11155420}
        value={profile}
        onChange={(next, compiled) => {
          onChange(next, compiled);
          setProfile(next);
        }}
      />
    );
  };

  render(<Harness />);
  return { onChange };
};

describe('SessionModeProfileSections', () => {
  it('places storage, encryption, access, and result controls in Privacy', () => {
    renderSection('privacy');

    expect(screen.getByRole('region', { name: 'Hosting and privacy settings' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Data storage' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Session encryption' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Who can see results' })).toBeInTheDocument();
    expect(screen.queryByText('Surfaces')).not.toBeInTheDocument();
    expect(screen.queryByText('Export scope')).not.toBeInTheDocument();
  });

  it('uses session access rules by default and reveals plain-language custom rules only on override', () => {
    const { onChange } = renderSection('privacy');

    const useSessionRules = screen.getByRole('checkbox', { name: 'Use session access rules for decryption' });
    expect(useSessionRules).toBeChecked();
    expect(screen.queryByLabelText('Grant access when')).not.toBeInTheDocument();

    fireEvent.click(useSessionRules);

    expect(screen.getByLabelText('Grant access when')).toBeInTheDocument();
    expect(screen.getByText('Session role')).toBeInTheDocument();
    expect(screen.getByText('Authorized agents')).toBeInTheDocument();
    expect(screen.queryByText('worker role')).not.toBeInTheDocument();
    expect(screen.queryByText('agent grant scope')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preset: 'custom',
        encryption: expect.objectContaining({
          accessConditions: expect.objectContaining({
            conditions: expect.arrayContaining([
              { kind: 'worker_role', role: 'admin' },
              { kind: 'agent_grant_scope', scope: 'storage' },
            ]),
          }),
        }),
      }),
      expect.objectContaining({
        storageProfile: expect.objectContaining({
          payloadAccessControl: expect.objectContaining({
            accessConditions: expect.objectContaining({ conditions: expect.any(Array) }),
          }),
        }),
      }),
    );
  });

  it('describes SBT conditions with the network name and participant-facing labels', () => {
    renderSection('privacy');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use session access rules for decryption' }));
    fireEvent.click(screen.getByTestId('ce-new-envelope-add-sbt-onchain'));

    expect(screen.getByText('SBT holders')).toBeInTheDocument();
    expect(screen.getByText('OP Sepolia')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'SBT requirement' })).toHaveValue('any');
    expect(screen.getByRole('option', { name: 'Any SBT from this contract' })).toBeInTheDocument();
  });

  it('keeps a configured custom SBT chain visible by name instead of dropping it', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.encryption.accessConditions = {
      match: 'any',
      conditions: [{ kind: 'sbt_onchain', chainId: 31337, contract: '0x1234', anyOrAll: 'any' }],
    };

    renderSection('privacy', profile);

    expect(screen.getByRole('option', { name: 'Chain 31337' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'SBT network' })).toHaveValue('31337');
  });

  it('disables Cloudflare encryption for decentralized storage', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    renderSection('privacy', profile);

    expect(screen.getByText(/Cloudflare encryption requires Cloudflare storage/)).toBeInTheDocument();
    expect(screen.getByTestId('ce-new-encryption-worker_envelope')).toBeDisabled();
  });

  it('places optional participation channels in Worker and preserves Telegram-to-Mini-App coupling', () => {
    const { onChange } = renderSection('worker');

    expect(screen.getByRole('region', { name: 'Participation channels' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Website' })).toBeChecked();
    const wrapped = screen.getByRole('checkbox', { name: 'Agent Session Wrapped' });
    expect(wrapped).not.toBeChecked();
    expect(screen.getByText(/additional per-session Worker\/Bridge/i)).toBeInTheDocument();
    expect(screen.getByText(/Telegram stays optional/i)).toBeInTheDocument();
    fireEvent.click(wrapped);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preset: 'custom',
        surfaces: expect.objectContaining({ agentHttp: true, telegram: false }),
      }),
      expect.any(Object),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Telegram' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preset: 'custom',
        surfaces: expect.objectContaining({ web: true, telegram: true, miniApp: true }),
      }),
      expect.any(Object),
    );
  });

  it('places export policy in Deploy and keeps selected-channel filtering', () => {
    renderSection('publish');

    const exportPolicy = screen.getByRole('combobox', { name: 'Export policy' });
    fireEvent.change(exportPolicy, { target: { value: 'selected_surfaces' } });

    const filter = screen.getByRole('group', { name: 'Channels included in exports' });
    expect(within(filter).getByRole('checkbox', { name: 'Website' })).toBeChecked();
    expect(screen.queryByText('Results visibility')).not.toBeInTheDocument();
  });
});
