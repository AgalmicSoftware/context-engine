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
  it('labels SBT creation as external to a Worker-native session', () => {
    render(
      <SessionWizardCreateSbtModal
        {...buildProps(cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE))}
      />,
    );

    expect(screen.getByTestId('create-sbt-group')).toBeInTheDocument();
    expect(screen.getByTestId('ce-sbt-create-advanced-external-notice')).toHaveTextContent(
      /does not replace or modify this session's Worker-native Groups/i,
    );
  });

  it('does not show the Worker-native notice for a registry session', () => {
    render(
      <SessionWizardCreateSbtModal
        {...buildProps(cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED))}
      />,
    );

    expect(screen.getByTestId('create-sbt-group')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-sbt-create-advanced-external-notice')).not.toBeInTheDocument();
  });
});
