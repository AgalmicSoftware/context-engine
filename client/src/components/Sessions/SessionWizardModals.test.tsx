import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SessionWizardModals from './SessionWizardModals';
import type { SessionWizardModalsProps } from './SessionWizardModals';
import { WIZARD_CONTRACT_MODAL_TESTID } from '../DocsPage/contractMetadata.js';

type MockCreateSbtGroupProps = {
  sessionSlug?: string;
  sessionConfigOverride?: {
    slug?: string;
    networkChainId?: number | null;
  };
  arweaveJwkOverride?: string;
  encryptionGates?: Array<{
    id?: string;
    requireAll?: boolean;
    sbtAddresses?: string[];
  }>;
  defaultGateId?: string;
  defaultSbtTags?: string;
  deferredDeploy?: boolean;
  attemptImmediateDeferredUpload?: boolean;
  hideNetworkSelector?: boolean;
};

type MockContractViewerProps = {
  contracts?: Array<{ name?: string }>;
  renderSourceHeaderActions?: (contract: { name?: string }) => React.ReactNode;
};

jest.mock('../SBTs/CreateSBTGroup', () => ({
  __esModule: true,
  default: jest.fn((props: MockCreateSbtGroupProps) => (
    <div
      data-testid="mock-create-sbt-group"
      data-session-slug={props.sessionSlug || ''}
      data-session-config-slug={props.sessionConfigOverride?.slug || ''}
      data-network-chain-id={String(props.sessionConfigOverride?.networkChainId || '')}
      data-arweave-jwk={props.arweaveJwkOverride || ''}
      data-gate-ids={(props.encryptionGates || []).map((gate) => gate.id).join(',')}
      data-gate-require-all={(props.encryptionGates || []).map((gate) => String(gate.requireAll)).join(',')}
      data-sbt-addresses={(props.encryptionGates || []).flatMap((gate) => gate.sbtAddresses || []).join(',')}
      data-default-gate-id={props.defaultGateId || ''}
      data-default-sbt-tags={props.defaultSbtTags || ''}
      data-deferred-deploy={String(props.deferredDeploy)}
      data-attempt-immediate-deferred-upload={String(props.attemptImmediateDeferredUpload)}
      data-hide-network-selector={String(props.hideNetworkSelector)}
    />
  )),
}));

jest.mock('../DocsPage/ContractViewer', () => ({
  __esModule: true,
  default: jest.fn(({ contracts = [], renderSourceHeaderActions }: MockContractViewerProps) => (
    <div data-testid="mock-contract-viewer">
      {renderSourceHeaderActions?.(contracts[0] || { name: 'Unknown contract' })}
    </div>
  )),
}));

const buildProps = (overrides: Partial<SessionWizardModalsProps> = {}): SessionWizardModalsProps => ({
  account: '0x00000000000000000000000000000000000000aa',
  provider: { kind: 'mock-provider' },
  createSbtModalState: { open: false },
  closeCreateSbtModal: jest.fn(),
  createSbtModalNetwork: { id: 84532, name: 'Base Sepolia' },
  toggleLoginModal: jest.fn(),
  createSbtModalSessionSlug: 'edge-session',
  draft: {
    slug: 'draft-slug',
    defaultSbtTags: 'writers,reviewers',
    contracts: {
      surveys: {
        address: '0x0000000000000000000000000000000000000001',
      },
    },
  },
  createSbtModalChainId: 84532,
  createSbtModalArweaveJwkOverride: '{"kty":"RSA"}',
  encryptionGates: [
    {
      id: 'gate-a',
      label: 'Gate A',
      color: '#2468ac',
      mode: 'all',
      sbts: [
        {
          address: '0x00000000000000000000000000000000000000ab',
        },
      ],
    },
  ],
  normalizeSbtSelection: (value) => value as Array<{ address?: string }>,
  defaultGateId: 'gate-a',
  signBootstrapAdminAction: jest.fn(),
  handleSavePendingSbtDraft: jest.fn(),
  contractViewerModalState: { open: false },
  selectedWizardContract: null,
  closeContractViewerModal: jest.fn(),
  selectedWizardContractHref: '/docs?contract=surveys',
  sessionHeaderPreviewModalOpen: false,
  onCloseSessionHeaderPreviewModal: jest.fn(),
  sessionHeaderPreviewSrc: '',
  t: (value) => value,
  ...overrides,
});

describe('SessionWizardModals', () => {
  it('keeps inline create-SBT deferred deploy props stable', () => {
    render(<SessionWizardModals {...buildProps({ createSbtModalState: { open: true } })} />);

    expect(screen.getByText('Add sbt to Session')).toBeInTheDocument();
    expect(screen.getByTestId('mock-create-sbt-group')).toHaveAttribute('data-session-slug', 'edge-session');
    expect(screen.getByTestId('mock-create-sbt-group')).toHaveAttribute('data-session-config-slug', 'edge-session');
    expect(screen.getByTestId('mock-create-sbt-group')).toHaveAttribute('data-network-chain-id', '84532');
    expect(screen.getByTestId('mock-create-sbt-group')).toHaveAttribute('data-arweave-jwk', '{"kty":"RSA"}');
    expect(screen.getByTestId('mock-create-sbt-group')).toHaveAttribute(
      'data-sbt-addresses',
      '0x00000000000000000000000000000000000000ab',
    );
    expect(screen.getByTestId('mock-create-sbt-group')).toHaveAttribute('data-gate-require-all', 'true');
    expect(screen.getByTestId('mock-create-sbt-group')).toHaveAttribute('data-default-gate-id', 'gate-a');
    expect(screen.getByTestId('mock-create-sbt-group')).toHaveAttribute('data-default-sbt-tags', 'writers,reviewers');
    expect(screen.getByTestId('mock-create-sbt-group')).toHaveAttribute('data-deferred-deploy', 'true');
    expect(screen.getByTestId('mock-create-sbt-group')).toHaveAttribute(
      'data-attempt-immediate-deferred-upload',
      'false',
    );
    expect(screen.getByTestId('mock-create-sbt-group')).toHaveAttribute('data-hide-network-selector', 'true');
  });

  it('keeps the contract viewer modal test id and full-page link stable', () => {
    render(
      <SessionWizardModals
        {...buildProps({
          contractViewerModalState: { open: true },
          selectedWizardContract: {
            key: 'surveys',
            name: 'Surveys',
            address: '0x0000000000000000000000000000000000000001',
          },
        })}
      />,
    );

    expect(screen.getByTestId(WIZARD_CONTRACT_MODAL_TESTID)).toBeInTheDocument();
    expect(screen.getByTestId('mock-contract-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('ce-wizard-contract-modal-full-link')).toHaveAttribute('href', '/docs?contract=surveys');
    expect(screen.getByTestId('ce-wizard-contract-modal-full-link')).toHaveAttribute(
      'aria-label',
      'Open Surveys in Docs',
    );
  });

  it('renders and closes the session header preview modal body', () => {
    const onCloseSessionHeaderPreviewModal = jest.fn();
    render(
      <SessionWizardModals
        {...buildProps({
          sessionHeaderPreviewModalOpen: true,
          sessionHeaderPreviewSrc: 'https://example.test/header.png',
          onCloseSessionHeaderPreviewModal,
        })}
      />,
    );

    const preview = screen.getByAltText('Expanded session header preview');
    expect(preview).toHaveAttribute('src', 'https://example.test/header.png');

    fireEvent.click(preview.closest('.modal-body') || preview);

    expect(onCloseSessionHeaderPreviewModal).toHaveBeenCalledTimes(1);
  });
});
