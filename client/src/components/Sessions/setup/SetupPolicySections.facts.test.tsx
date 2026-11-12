import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { listSessionModeConflicts } from '../../../utilities/session/sessionModeRuleMessages';
import type { SessionModeProfile } from '../../../utilities/session/sessionModeProfile';
import { defaultSessionSetupProfile, editSessionSetupProfile, setHosting } from './sessionSetupProfile';
import { SetupAccessSection, SetupHostingSection } from './SetupPolicySections';

// Access and Hosting on /new, editing one profile as the page does.
const Harness = ({ initial }: { initial: SessionModeProfile }) => {
  const [profile, setProfile] = useState(initial);
  const props = {
    draft: { sessionModeProfile: profile },
    onChange: jest.fn(),
    mode: 'create' as const,
    open: true,
    onToggle: jest.fn(),
    conflicts: listSessionModeConflicts(profile),
    editProfile: (edit: (next: SessionModeProfile) => void) =>
      setProfile((prev) => editSessionSetupProfile(prev, edit).profile),
    registryChainId: null,
  };
  return (
    <>
      <SetupAccessSection {...props} />
      <SetupHostingSection {...props} />
    </>
  );
};

const decentralized = () => {
  const profile = defaultSessionSetupProfile();
  setHosting(profile, 'evm_registry_canonical', null);
  return profile;
};

const workerEncryption = () =>
  within(screen.getByTestId('ce-setup-encryption')).getByRole('option', { name: 'Session Worker' });

describe('settings Runs on decides', () => {
  it('show as text with a "?", leaving SBT permissions the one choice on Centralized', () => {
    const { unmount } = render(<Harness initial={defaultSessionSetupProfile()} />);
    expect(screen.getByTestId('ce-setup-sign-in')).toHaveTextContent('Passkey');
    expect(screen.getByTestId('ce-setup-permissions')).toHaveTextContent('Session roles');
    expect(screen.getByTestId('ce-setup-storage')).toHaveTextContent('Cloudflare');
    for (const label of ['Sign-in', 'Permissions', 'Storage', 'SBTs grant permissions']) {
      expect(screen.getByRole('button', { name: `About ${label}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('combobox', { name: 'Sign-in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Storage' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('SBTs grant permissions')).toHaveAccessibleDescription(/needs an SBT holders rule/);
    expect(workerEncryption()).toBeEnabled();
    unmount();

    render(<Harness initial={decentralized()} />);
    expect(screen.getByTestId('ce-setup-sign-in')).toHaveTextContent('Wallet or passkey');
    expect(screen.getByTestId('ce-setup-permissions')).toHaveTextContent('SBT holders');
    expect(screen.getByTestId('ce-setup-storage')).toHaveTextContent('Arweave');
    expect(screen.queryByLabelText('SBTs grant permissions')).not.toBeInTheDocument();
    // Encryption by the Session Worker needs Cloudflare storage.
    expect(workerEncryption()).toBeDisabled();
  });

  it('come back to what Runs on needs when a template brought others', () => {
    const imported = defaultSessionSetupProfile();
    imported.identity = { default: 'wallet', enabled: ['wallet', 'passkey'] };
    imported.storage = { backend: 'arweave' };
    render(<Harness initial={imported} />);
    expect(screen.getByTestId('ce-setup-sign-in')).toHaveTextContent('Wallet or passkey');
    expect(screen.getByTestId('ce-setup-conflict-worker_identity_mismatch')).toBeInTheDocument();
    expect(screen.getByTestId('ce-setup-conflict-worker_authority_requires_cloudflare')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Match Runs on' })[0]);
    expect(screen.getByTestId('ce-setup-sign-in')).toHaveTextContent('Passkey');
    expect(screen.getByTestId('ce-setup-storage')).toHaveTextContent('Cloudflare');
    expect(screen.queryByTestId('ce-setup-conflict-worker_identity_mismatch')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-setup-conflict-worker_authority_requires_cloudflare')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Match Runs on' })).not.toBeInTheDocument();
  });

  it('leave an SBT permission without a rule to its own box', () => {
    render(<Harness initial={defaultSessionSetupProfile()} />);
    fireEvent.click(screen.getByLabelText('SBTs grant permissions'));
    expect(screen.getByTestId('ce-setup-conflict-sbt_authorization_requires_condition')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Match Runs on' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('SBTs grant permissions'));
    expect(screen.queryByTestId('ce-setup-conflict-sbt_authorization_requires_condition')).not.toBeInTheDocument();
  });
});
