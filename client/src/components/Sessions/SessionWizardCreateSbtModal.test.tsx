import React from 'react';
import { render, screen } from '@testing-library/react';

import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import SessionWizardCreateSbtModal, { type SessionWizardCreateSbtModalProps } from './SessionWizardCreateSbtModal';

jest.mock('reactstrap', () => ({
  Modal: ({ children, isOpen }: React.PropsWithChildren<{ isOpen?: boolean }>) =>
    isOpen ? <div>{children}</div> : null,
  ModalBody: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ModalHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('../SBTs/CreateSBTGroup', () => () => <div data-testid="create-sbt-group" />);

const buildProps = (
  sessionModeProfile: ReturnType<typeof cloneSessionModePreset>,
): SessionWizardCreateSbtModalProps => ({
  account: '',
  provider: null,
  createSbtModalState: { open: true },
  closeCreateSbtModal: jest.fn(),
  createSbtModalNetwork: { id: 11155420, name: 'OP Sepolia' },
  toggleLoginModal: jest.fn(),
  createSbtModalSessionSlug: 'draft-session',
  draft: { slug: 'draft-session', sessionModeProfile },
  createSbtModalChainId: 11155420,
  createSbtModalArweaveJwkOverride: '',
  encryptionGates: [],
  normalizeSbtSelection: () => [],
  defaultGateId: '',
  signBootstrapAdminAction: jest.fn(),
  handleSavePendingSbtDraft: jest.fn(),
  t: (value) => value,
});

describe('SessionWizardCreateSbtModal', () => {
  it('does not add an external on-chain notice for a Worker-native draft', () => {
    render(
      <SessionWizardCreateSbtModal
        {...buildProps(cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE))}
      />,
    );

    expect(screen.getByTestId('create-sbt-group')).toBeInTheDocument();
    expect(screen.queryByText(/Advanced\/external on-chain SBT/i)).not.toBeInTheDocument();
  });

  it('continues to render the SBT draft creator for a registry session', () => {
    render(
      <SessionWizardCreateSbtModal
        {...buildProps(cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED))}
      />,
    );

    expect(screen.getByTestId('create-sbt-group')).toBeInTheDocument();
  });
});
