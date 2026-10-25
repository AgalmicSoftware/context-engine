import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import SessionModeProfileSections, { type SessionModeProfileSectionsProps } from './SessionModeProfileSections';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
  compileSessionModeProfile,
  mergeSessionModeProfileStorageAccess,
  type SessionModeProfile,
  validateSessionModeProfile,
} from '../../utilities/session/sessionModeProfile';

const VALID_SBT_CONTRACT = '0x00000000000000000000000000000000000000aa';

const renderSection = (
  section: 'privacy' | 'worker' | 'publish',
  initialProfile?: SessionModeProfile,
  renderInfoTooltip?: SessionModeProfileSectionsProps['renderInfoTooltip'],
) => {
  const onChange = jest.fn();
  const seed = initialProfile || cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);

  const Harness = () => {
    const [profile, setProfile] = useState(seed);
    return (
      <SessionModeProfileSections
        section={section}
        registryChainId={11155420}
        value={profile}
        renderInfoTooltip={renderInfoTooltip}
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

type SectionChange = [SessionModeProfile, { storageProfile: Record<string, any> }];

const lastChange = (onChange: jest.Mock): SectionChange => {
  const call = onChange.mock.calls[onChange.mock.calls.length - 1];
  if (!call) throw new Error('Expected a profile change.');
  return call as SectionChange;
};

describe('SessionModeProfileSections', () => {
  it('offers the retained web and agent channels without retired adapter controls', () => {
    renderSection('worker');
    expect(screen.queryByRole('checkbox', { name: /^Telegram/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-new-surface-miniApp')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Agents (HTTP API)' })).toBeInTheDocument();
  });

  it('places storage, encryption, access, and result controls in Privacy', () => {
    renderSection('privacy');

    expect(screen.getByRole('region', { name: 'Hosting and privacy settings' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Data storage' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Session encryption' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Who can see results' })).toBeInTheDocument();
    expect(screen.queryByText('Surfaces')).not.toBeInTheDocument();
    expect(screen.queryByText('Export scope')).not.toBeInTheDocument();
  });

  it('explains storage permanence separately for Cloudflare and Arweave', () => {
    renderSection('privacy', undefined, ({ content, testId, ariaLabel }) => (
      <button type="button" data-testid={testId} aria-label={ariaLabel}>
        {content}
      </button>
    ));

    const cloudflareInfo = screen.getByTestId(E2E_TESTIDS.WIZARD_STORAGE_CLOUDFLARE_INFO);
    expect(cloudflareInfo).toHaveAccessibleName('About Cloudflare storage');
    expect(cloudflareInfo).toHaveTextContent(/mutable and not permanent/i);
    expect(cloudflareInfo).toHaveTextContent(/future attestation.*verifiable proofs/i);

    const arweaveInfo = screen.getByTestId(E2E_TESTIDS.WIZARD_STORAGE_ARWEAVE_INFO);
    expect(arweaveInfo).toHaveAccessibleName('About Arweave storage');
    expect(arweaveInfo).toHaveTextContent(/permanent storage/i);
    expect(arweaveInfo).toHaveTextContent(/encrypted before upload/i);
  });

  it('explains every session encryption option separately', () => {
    renderSection('privacy', undefined, ({ content, testId, ariaLabel }) => (
      <button type="button" data-testid={testId} aria-label={ariaLabel}>
        {content}
      </button>
    ));

    const noneInfo = screen.getByTestId(E2E_TESTIDS.WIZARD_ENCRYPTION_NONE_INFO);
    expect(noneInfo).toHaveAccessibleName('About no encryption');
    expect(noneInfo).toHaveTextContent(/adds no encryption layer/i);
    expect(noneInfo).toHaveTextContent(/stored as provided/i);

    const litInfo = screen.getByTestId(E2E_TESTIDS.WIZARD_ENCRYPTION_LIT_INFO);
    expect(litInfo).toHaveAccessibleName('About Lit encryption');
    expect(litInfo).toHaveTextContent(/encrypts data before upload/i);
    expect(litInfo).toHaveTextContent(/on-chain access conditions/i);
    expect(litInfo).toHaveTextContent(/worker operator and Lit account administrators remain trusted/i);
    expect(litInfo).toHaveTextContent(/not end-to-end encryption/i);

    const cloudflareInfo = screen.getByTestId(E2E_TESTIDS.WIZARD_ENCRYPTION_CLOUDFLARE_INFO);
    expect(cloudflareInfo).toHaveAccessibleName('About Cloudflare encryption');
    expect(cloudflareInfo).toHaveTextContent(/key held by the session worker/i);
    expect(cloudflareInfo).toHaveTextContent(/not end-to-end encryption/i);
  });

  it('keeps group creation policy out of the participation-channel editor', () => {
    renderSection('worker');

    expect(screen.queryByRole('combobox', { name: 'Who can create groups?' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Session participation channels' })).toBeInTheDocument();
  });

  it('uses the explicit Cloudflare defaults and reveals plain-language custom rules only on override', () => {
    const { onChange } = renderSection('privacy', undefined, ({ testId, ariaLabel }) => (
      <button type="button" data-testid={testId} aria-label={ariaLabel}>
        ?
      </button>
    ));

    const useDefaultRules = screen.getByRole('checkbox', { name: 'Use default Cloudflare access rules' });
    expect(useDefaultRules).toBeChecked();
    expect(screen.getByText(/configured admins and accounts with storage permission/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Grant access when')).not.toBeInTheDocument();

    const defaultRulesInfo = screen.getByTestId('ce-new-default-cloudflare-access-rules-info');
    expect(defaultRulesInfo).toHaveAccessibleName('About default Cloudflare access rules');
    fireEvent.click(defaultRulesInfo);
    expect(useDefaultRules).toBeChecked();
    expect(screen.queryByLabelText('Grant access when')).not.toBeInTheDocument();

    fireEvent.click(useDefaultRules);

    expect(screen.getByLabelText('Grant access when')).toBeInTheDocument();
    expect(screen.getByText('Session role')).toBeInTheDocument();
    expect(screen.getByText('Authorized accounts')).toBeInTheDocument();
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

    const explanation = screen.getByText(/Cloudflare encryption requires Cloudflare storage/);
    const cloudflareEncryption = screen.getByTestId('ce-new-encryption-worker_envelope');

    expect(explanation).toHaveAttribute('id', 'ce-new-encryption-worker-envelope-help');
    expect(cloudflareEncryption).toBeDisabled();
    expect(cloudflareEncryption).toHaveAttribute('aria-describedby', explanation.id);
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

  it('toggles HTTP access while keeping the retired adapters disabled', () => {
    const { onChange } = renderSection('worker');
    expect(screen.getByRole('region', { name: 'Participation channels' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Website' })).toBeChecked();
    expect(
      within(screen.getByRole('group', { name: 'Session participation channels' })).getAllByRole('checkbox'),
    ).toHaveLength(2);
    const agents = screen.getByRole('checkbox', { name: 'Agents (HTTP API)' });
    expect(agents).not.toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('Agent API access: Off');
    fireEvent.click(agents);
    expect(screen.getByRole('status')).toHaveTextContent('Agent API access: On after deployment');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        surfaces: expect.objectContaining({ web: true, agentHttp: true, telegram: false, miniApp: false }),
      }),
      expect.any(Object),
    );
    fireEvent.click(agents);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        surfaces: expect.objectContaining({ web: true, agentHttp: false, telegram: false, miniApp: false }),
      }),
      expect.any(Object),
    );
  });

  it('explains every participation channel without toggling its checkbox when help is opened', () => {
    const { onChange } = renderSection('worker', undefined, ({ content, ariaLabel }) => (
      <button type="button" aria-label={ariaLabel}>
        {content}
      </button>
    ));

    for (const [name, explanation] of [
      ['Website', /always enabled/i],
      ['Agents (HTTP API)', /through a scoped credential/i],
    ] as const) {
      const help = screen.getByRole('button', { name: `About ${name}` });
      expect(help).toHaveTextContent(explanation);
      fireEvent.click(help);
    }

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Website' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Website' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Agents (HTTP API)' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'About Agents (HTTP API)' })).toHaveTextContent(
      /additional per-session service/i,
    );
  });

  it.each([SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE, SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED])(
    'reports direct HTTP access for %s',
    (preset) => {
      const { onChange } = renderSection('worker', cloneSessionModePreset(preset));
      const agents = screen.getByRole('checkbox', { name: 'Agents (HTTP API)' });
      fireEvent.click(agents);

      expect(screen.getByRole('status')).toHaveTextContent('Agent API access: On after deployment');
      expect(screen.getByRole('status')).toHaveTextContent(/authorized agents.*HTTP API/i);
      expect(screen.getByRole('status')).toHaveTextContent(/deployed and verified/i);
      expect(screen.queryByRole('checkbox', { name: /^Telegram/ })).not.toBeInTheDocument();

      fireEvent.click(agents);
      expect(screen.getByRole('status')).toHaveTextContent('Agent API access: Off');
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          surfaces: expect.objectContaining({ agentHttp: false, telegram: false, miniApp: false }),
        }),
        expect.any(Object),
      );
    },
  );

  it('does not offer unenforced selected-channel exports', () => {
    renderSection('publish');

    const exportPolicy = screen.getByRole('combobox', { name: 'Export policy' });
    expect(
      within(exportPolicy).getByRole('option', { name: /Admins can export selected channels only/i }),
    ).toBeDisabled();
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

  it('makes unencrypted Cloudflare storage public-read only while public results are selected', () => {
    const { onChange } = renderSection('privacy');
    const visibility = screen.getByRole('combobox', { name: 'Who can see results' });
    const publicOption = within(visibility).getByRole('option', { name: /public stored results/i });

    fireEvent.click(screen.getByTestId('ce-new-encryption-none'));
    expect(publicOption).toBeEnabled();

    fireEvent.change(visibility, { target: { value: 'public_full_if_storage_public' } });
    const [publicProfile, publicCompiled] = lastChange(onChange);
    expect(publicProfile).toEqual(
      expect.objectContaining({
        storage: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
        encryption: { mode: 'none' },
        results: expect.objectContaining({ visibility: 'public_full_if_storage_public' }),
      }),
    );
    expect(validateSessionModeProfile(publicProfile).valid).toBe(true);
    expect(publicCompiled.storageProfile.payloadAccessControl).toEqual(
      expect.objectContaining({ gate: 'none', encryption: 'none' }),
    );
    expect(publicCompiled.storageProfile.payloadAccessControl).not.toHaveProperty('accessConditions');
    expect(screen.getByText(/anyone can read them without signing in/i)).toBeInTheDocument();

    fireEvent.change(visibility, { target: { value: 'participant_aggregate' } });
    const [privateProfile] = lastChange(onChange);
    expect(privateProfile.storage.payloadAccessControl).toEqual(
      expect.objectContaining({
        gate: 'role_gate',
        encryption: 'none',
        accessConditions: expect.objectContaining({ match: 'any' }),
      }),
    );
    expect(validateSessionModeProfile(privateProfile).valid).toBe(true);
    expect(screen.queryByText(/anyone can read them without signing in/i)).not.toBeInTheDocument();
  });

  it('restores gated Cloudflare storage when encryption is enabled on a public session', () => {
    const { onChange } = renderSection('privacy');
    const visibility = screen.getByRole('combobox', { name: 'Who can see results' });

    fireEvent.click(screen.getByTestId('ce-new-encryption-none'));
    fireEvent.change(visibility, { target: { value: 'public_full_if_storage_public' } });
    fireEvent.click(screen.getByTestId('ce-new-encryption-worker_envelope'));

    const [profile] = lastChange(onChange);
    expect(profile.results.visibility).toBe('participant_aggregate');
    expect(profile.storage.payloadAccessControl).toEqual(
      expect.objectContaining({ gate: 'role_gate', encryption: 'worker_envelope' }),
    );
    expect(validateSessionModeProfile(profile).valid).toBe(true);
    expect(within(visibility).getByRole('option', { name: /public stored results/i })).toBeDisabled();
  });

  it('clears a Lit registry chain when encryption returns to None so public results stay valid', () => {
    const { onChange } = renderSection('privacy');
    const visibility = screen.getByRole('combobox', { name: 'Who can see results' });

    fireEvent.click(screen.getByTestId('ce-new-encryption-lit'));
    expect(lastChange(onChange)[0].evm.registryChainId).toBe(11155420);
    fireEvent.click(screen.getByTestId('ce-new-encryption-none'));
    fireEvent.change(visibility, { target: { value: 'public_full_if_storage_public' } });

    const [profile, compiled] = lastChange(onChange);
    expect(profile.evm.registryChainId).toBeNull();
    expect(validateSessionModeProfile(profile).valid).toBe(true);
    expect(compiled.storageProfile.payloadAccessControl).toEqual(
      expect.objectContaining({ gate: 'none', encryption: 'none' }),
    );
  });

  it('keeps public results when the current storage is selected again and resets them on a real switch', () => {
    const { onChange } = renderSection('privacy');
    const visibility = screen.getByRole('combobox', { name: 'Who can see results' });
    const storage = screen.getByRole('radiogroup', { name: 'Data storage' });

    fireEvent.click(screen.getByTestId('ce-new-encryption-none'));
    fireEvent.change(visibility, { target: { value: 'public_full_if_storage_public' } });
    const changesBefore = onChange.mock.calls.length;
    fireEvent.click(within(storage).getByRole('radio', { name: 'Cloudflare' }));
    expect(onChange.mock.calls.length).toBe(changesBefore);
    expect(visibility).toHaveValue('public_full_if_storage_public');

    fireEvent.click(within(storage).getByRole('radio', { name: 'Arweave' }));
    expect(lastChange(onChange)[0].results.visibility).toBe('public_full_if_storage_public');
    fireEvent.click(within(storage).getByRole('radio', { name: 'Cloudflare' }));
    const [profile] = lastChange(onChange);
    expect(profile.results.visibility).toBe('participant_aggregate');
    expect(profile.storage.payloadAccessControl).toEqual(expect.objectContaining({ gate: 'role_gate' }));
    expect(validateSessionModeProfile(profile).valid).toBe(true);
  });

  it('restores gated Cloudflare storage when a public session switches to Lit', () => {
    const { onChange } = renderSection('privacy');

    fireEvent.click(screen.getByTestId('ce-new-encryption-none'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Who can see results' }), {
      target: { value: 'public_full_if_storage_public' },
    });
    fireEvent.click(screen.getByTestId('ce-new-encryption-lit'));

    const [profile, compiled] = lastChange(onChange);
    expect(profile.results.visibility).toBe('participant_aggregate');
    expect(profile.storage.payloadAccessControl).toEqual(
      expect.objectContaining({ gate: 'role_gate', encryption: 'lit', accessConditions: expect.any(Object) }),
    );
    expect(compiled.storageProfile.payloadAccessControl.accessConditions.conditions.length).toBeGreaterThan(0);
    expect(validateSessionModeProfile(profile).valid).toBe(true);
  });

  it('clears a registry chain left by SBT storage rules when public results replace them', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.evm.registryChainId = 11155420;
    profile.encryption = { mode: 'none' };
    profile.storage.payloadAccessControl = {
      gate: 'role_gate',
      encryption: 'none',
      accessConditions: {
        match: 'any',
        conditions: [{ kind: 'sbt_onchain', chainId: 11155420, contract: VALID_SBT_CONTRACT, anyOrAll: 'any' }],
      },
    };
    const { onChange } = renderSection('privacy', profile);

    fireEvent.change(screen.getByRole('combobox', { name: 'Who can see results' }), {
      target: { value: 'public_full_if_storage_public' },
    });
    const [next] = lastChange(onChange);
    expect(next.evm.registryChainId).toBeNull();
    expect(next.storage.payloadAccessControl).toEqual({ gate: 'none', encryption: 'none' });
    expect(validateSessionModeProfile(next).valid).toBe(true);
  });

  it('keeps custom Cloudflare encryption rules when the current encryption is selected again', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.encryption.accessConditions = { match: 'any', conditions: [{ kind: 'worker_role', role: 'moderator' }] };
    const { onChange } = renderSection('privacy', profile);

    fireEvent.click(screen.getByTestId('ce-new-encryption-worker_envelope'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes a loaded public-read draft when it switches to Lit', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.encryption = { mode: 'none' };
    profile.storage.payloadAccessControl = { gate: 'none', encryption: 'none' };
    const { onChange } = renderSection('privacy', profile);

    fireEvent.click(screen.getByTestId('ce-new-encryption-lit'));
    expect(lastChange(onChange)[0].storage.payloadAccessControl).toEqual(
      expect.objectContaining({ gate: 'role_gate', encryption: 'lit', accessConditions: expect.any(Object) }),
    );
  });

  it('keeps custom storage rules when a reloaded Lit draft returns to no encryption', () => {
    const rules = { match: 'any' as const, conditions: [{ kind: 'worker_role' as const, role: 'moderator' }] };
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.evm.registryChainId = 11155420;
    profile.encryption = { mode: 'lit' };
    profile.storage.payloadAccessControl = { gate: 'none', encryption: 'lit', accessConditions: rules };
    const { onChange } = renderSection('privacy', profile);

    fireEvent.click(screen.getByTestId('ce-new-encryption-none'));
    const [next] = lastChange(onChange);
    expect(next.storage.payloadAccessControl).toEqual({
      gate: 'role_gate',
      encryption: 'none',
      accessConditions: rules,
    });
    expect(next.evm.registryChainId).toBeNull();
  });

  it('leaves Lit storage rules untouched when results visibility changes', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.evm.registryChainId = 11155420;
    profile.encryption = { mode: 'lit' };
    profile.storage.payloadAccessControl = { gate: 'none', encryption: 'lit' };
    const { onChange } = renderSection('privacy', profile);

    fireEvent.change(screen.getByRole('combobox', { name: 'Who can see results' }), {
      target: { value: 'session_member_aggregate' },
    });
    expect(lastChange(onChange)[0].storage.payloadAccessControl).toEqual({ gate: 'none', encryption: 'lit' });
  });

  it('offers public results for unencrypted Arweave storage and coerces them when encryption is enabled', () => {
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

it('shows and edits custom storage rules after a saved profile reload', () => {
  const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  profile.preset = 'custom';
  profile.encryption.accessConditions = { match: 'any', conditions: [{ kind: 'worker_role', role: 'reviewer' }] };
  const reloaded = mergeSessionModeProfileStorageAccess(profile, compileSessionModeProfile(profile).storageProfile);
  const { onChange } = renderSection('privacy', reloaded);
  const checkbox = screen.getByRole('checkbox', { name: 'Use default Cloudflare access rules' });
  expect(checkbox).not.toBeChecked();
  fireEvent.change(screen.getByRole('textbox', { name: 'Session role' }), { target: { value: 'moderator' } });
  expect(lastChange(onChange)[1].storageProfile).toMatchObject({
    payloadAccessControl: { accessConditions: { conditions: [{ kind: 'worker_role', role: 'moderator' }] } },
  });
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
  const defaults = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  expect(lastChange(onChange)[1].storageProfile).toMatchObject({
    payloadAccessControl: defaults.storage.payloadAccessControl,
  });
});
