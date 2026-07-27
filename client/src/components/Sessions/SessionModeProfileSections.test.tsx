import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import SessionModeProfileSections from './SessionModeProfileSections';
import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
  type SessionModeProfile,
  validateSessionModeProfile,
} from '../../utilities/session/sessionModeProfile';

const VALID_SBT_CONTRACT = '0x00000000000000000000000000000000000000aa';

const renderSection = (
  section: 'privacy' | 'worker' | 'publish',
  initialProfile?: SessionModeProfile,
  initialGroupCreationPolicy = 'participants',
) => {
  const onChange = jest.fn();
  const onGroupCreationPolicyChange = jest.fn();
  const seed = initialProfile || cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);

  const Harness = () => {
    const [profile, setProfile] = useState(seed);
    const [groupCreationPolicy, setGroupCreationPolicy] = useState(initialGroupCreationPolicy);
    return (
      <SessionModeProfileSections
        section={section}
        registryChainId={11155420}
        value={profile}
        groupCreationPolicy={groupCreationPolicy}
        onGroupCreationPolicyChange={(next) => {
          onGroupCreationPolicyChange(next);
          setGroupCreationPolicy(next);
        }}
        onChange={(next, compiled) => {
          onChange(next, compiled);
          setProfile(next);
        }}
      />
    );
  };

  render(<Harness />);
  return { onChange, onGroupCreationPolicyChange };
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

  it.each([
    ['Cloudflare', cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE)],
    ['on-chain', cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED)],
  ])('offers admin and participant group creation policies for %s sessions', (_label, profile) => {
    const { onGroupCreationPolicyChange } = renderSection('worker', profile);
    const policy = screen.getByRole('radiogroup', { name: 'Who can create groups?' });

    expect(within(policy).getByRole('radio', { name: 'All participants' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(policy).getByRole('radio', { name: 'Admins only' }));
    expect(onGroupCreationPolicyChange).toHaveBeenLastCalledWith('admin_only');
    expect(within(policy).getByRole('radio', { name: 'Admins only' })).toHaveAttribute('aria-checked', 'true');
  });

  it('discloses the public-factory limit for on-chain admin-only policy', () => {
    renderSection(
      'worker',
      cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      'admin_only',
    );

    expect(screen.getByText(/Public SBT factories remain callable directly on-chain/i)).toBeInTheDocument();
  });

  it('uses the explicit Cloudflare defaults and reveals plain-language custom rules only on override', () => {
    const { onChange } = renderSection('privacy');

    const useDefaultRules = screen.getByRole('checkbox', { name: 'Use default Cloudflare access rules' });
    expect(useDefaultRules).toBeChecked();
    expect(screen.getByText(/configured admins and agents granted the storage scope/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Grant access when')).not.toBeInTheDocument();

    fireEvent.click(useDefaultRules);

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
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use default Cloudflare access rules' }));
    fireEvent.click(screen.getByTestId('ce-new-envelope-add-sbt-onchain'));

    expect(screen.getByText('SBT holders')).toBeInTheDocument();
    expect(screen.getByText('OP Sepolia')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'SBT requirement' })).toHaveValue('any');
    expect(screen.getByRole('option', { name: 'Any SBT from this contract' })).toBeInTheDocument();
  });

  it('updates the profile chain atomically when an SBT rule network changes', () => {
    const { onChange } = renderSection('privacy');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Use default Cloudflare access rules' }));
    fireEvent.click(screen.getByTestId('ce-new-envelope-add-sbt-onchain'));
    fireEvent.change(screen.getByRole('textbox', { name: 'SBT contract address' }), {
      target: { value: VALID_SBT_CONTRACT },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'SBT network' }), {
      target: { value: '84532' },
    });

    const [profile, compiled] = onChange.mock.calls.at(-1) as [SessionModeProfile, { storageProfile: any }];
    expect(profile.evm.registryChainId).toBe(84532);
    expect(profile.encryption.accessConditions?.conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'sbt_onchain',
          chainId: 84532,
          contract: VALID_SBT_CONTRACT,
        }),
      ]),
    );
    expect(validateSessionModeProfile(profile)).toEqual({ valid: true, issues: [] });
    expect(compiled.storageProfile.payloadAccessControl.accessConditions.conditions).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'sbt_onchain', chainId: 84532 })]),
    );
  });

  it('keeps a configured custom SBT chain visible by name instead of dropping it', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    profile.evm.registryChainId = 31337;
    profile.encryption.accessConditions = {
      match: 'any',
      conditions: [{ kind: 'sbt_onchain', chainId: 31337, contract: VALID_SBT_CONTRACT, anyOrAll: 'any' }],
    };

    expect(validateSessionModeProfile(profile)).toEqual({ valid: true, issues: [] });
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

  it('shows privacy validation beside the invalid privacy rule', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.encryption.accessConditions = {
      match: 'any',
      conditions: [{ kind: 'sbt_onchain', chainId: 11155420, contract: '', anyOrAll: 'any' }],
    };
    profile.evm.registryChainId = 11155420;

    renderSection('privacy', profile);

    expect(screen.getByText('SBT envelope conditions require a contract address.')).toBeInTheDocument();
  });

  it('switches decentralized storage to an explicit Cloudflare role gate', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const { onChange } = renderSection('privacy', profile);

    const storage = screen.getByRole('radiogroup', { name: 'Data storage' });
    fireEvent.click(within(storage).getByRole('radio', { name: 'Cloudflare' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        authority: { mode: 'worker_canonical' },
        evm: { registryChainId: null },
        storage: expect.objectContaining({
          backend: 'cloudflare',
          payloadAccessControl: expect.objectContaining({ gate: 'role_gate' }),
        }),
        identity: { default: 'passkey', enabled: ['passkey'] },
        authorization: { mechanisms: ['worker_roles'] },
        results: expect.objectContaining({ visibility: 'participant_aggregate' }),
      }),
      expect.objectContaining({
        storageProfile: expect.objectContaining({
          payloadAccessControl: expect.objectContaining({ gate: 'role_gate' }),
        }),
      }),
    );
  });

  it('switches Cloudflare storage to a coherent registry, wallet, and SBT lineage', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const { onChange } = renderSection('privacy', profile);

    const storage = screen.getByRole('radiogroup', { name: 'Data storage' });
    fireEvent.click(within(storage).getByRole('radio', { name: 'Arweave' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        authority: { mode: 'evm_registry_canonical' },
        evm: { registryChainId: 11155420 },
        storage: { backend: 'arweave' },
        identity: { default: 'wallet', enabled: ['wallet', 'passkey'] },
        authorization: { mechanisms: ['sbt_onchain'] },
        encryption: { mode: 'none' },
      }),
      expect.objectContaining({
        storageProfile: expect.objectContaining({ backend: 'arweave' }),
      }),
    );
  });

  it('supports arrow-key selection in segmented radio controls', () => {
    const { onChange } = renderSection('privacy');

    const storage = screen.getByRole('radiogroup', { name: 'Data storage' });
    fireEvent.keyDown(within(storage).getByRole('radio', { name: 'Cloudflare' }), { key: 'ArrowRight' });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ storage: expect.objectContaining({ backend: 'arweave' }) }),
      expect.any(Object),
    );
  });

  it('places optional participation channels in Worker and keeps the Telegram Mini App dependent on Telegram', () => {
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
    fireEvent.click(screen.getByRole('checkbox', { name: 'Telegram Mini App' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preset: 'custom',
        surfaces: expect.objectContaining({ web: true, telegram: true, miniApp: true }),
      }),
      expect.any(Object),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Telegram' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        surfaces: expect.objectContaining({ telegram: false, miniApp: false }),
      }),
      expect.any(Object),
    );
  });

  it('does not offer unenforced selected-channel exports', () => {
    renderSection('publish');

    const exportPolicy = screen.getByRole('combobox', { name: 'Export policy' });
    expect(within(exportPolicy).getByRole('option', { name: /Export selected channels only/i })).toBeDisabled();
    expect(screen.queryByRole('group', { name: 'Channels included in exports' })).not.toBeInTheDocument();
    expect(screen.queryByText('Results visibility')).not.toBeInTheDocument();
  });

  it('marks result modes without complete enforcement as unavailable', () => {
    renderSection('privacy');

    const visibility = screen.getByRole('combobox', { name: 'Who can see results' });
    expect(within(visibility).getByRole('option', { name: /Admins only/i })).toBeDisabled();
    expect(within(visibility).getByRole('option', { name: /redacted summary/i })).toBeDisabled();
    expect(within(visibility).getByRole('option', { name: /public stored results/i })).toBeDisabled();
  });

  it('offers public results only for unencrypted Arweave storage and coerces them when encryption is enabled', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    const { onChange } = renderSection('privacy', profile);
    const visibility = screen.getByRole('combobox', { name: 'Who can see results' });

    expect(within(visibility).getByRole('option', { name: /public stored results/i })).toBeEnabled();
    expect(visibility).toHaveValue('public_full_if_storage_public');

    fireEvent.click(screen.getByTestId('ce-new-encryption-lit'));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        storage: { backend: 'arweave' },
        encryption: { mode: 'lit' },
        results: expect.objectContaining({ visibility: 'participant_aggregate' }),
      }),
      expect.any(Object),
    );
    expect(within(visibility).getByRole('option', { name: /public stored results/i })).toBeDisabled();
    expect(visibility).toHaveValue('participant_aggregate');
  });

  it('lets a minimum group size be cleared while editing before committing a valid integer', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.results.exposure = {
      aggregateResultsEnabled: true,
      anonymizedGroupsEnabled: true,
      minGroupSize: 2,
    };
    const { onChange } = renderSection('privacy', profile);
    const input = screen.getByRole('spinbutton', { name: 'Minimum group size' });

    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue(null);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '10' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        results: expect.objectContaining({
          exposure: expect.objectContaining({ minGroupSize: 10 }),
        }),
      }),
      expect.any(Object),
    );
  });
});
