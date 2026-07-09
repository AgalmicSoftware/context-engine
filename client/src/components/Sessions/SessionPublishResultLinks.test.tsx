import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionPublishResultLinks from './SessionPublishResultLinks';

const metadataDisplayState = {
  effectiveMetadataGatewayUrl: 'https://arweave.example.test/metadata-tx',
  effectiveMetadataTxId: 'metadata-tx',
  manualMetadataDisplayUri: '',
  metadataUri: 'ar://metadata-tx',
  metadataUriLabel: 'Metadata URI' as const,
  showArweaveTx: true,
  showManualMetadataUri: false,
  showMetadataUri: true,
};

describe('SessionPublishResultLinks', () => {
  it('renders metadata, register, session, admin, pending SBT, and status links', () => {
    const onCopyAdminUrl = jest.fn();

    render(
      <SessionPublishResultLinks
        adminUrl="https://context.example.test/admin/readiness-session"
        adminUrlStatus="Admin URL copied."
        onCopyAdminUrl={onCopyAdminUrl}
        publishMetadataDisplayState={metadataDisplayState}
        publishedPendingSbtLinks={[
          {
            address: '0x00000000000000000000000000000000000000f1',
            href: 'https://context.example.test/sbt/0xf1',
            label: 'Access Badge',
          },
        ]}
        registerExplorerBaseUrl="https://optimism-sepolia.blockscout.com"
        registerTxs={[
          { action: 'createSession', hash: '0xregister1' },
          { action: 'setSessionFields', hash: '0xregister2' },
        ]}
        sessionUrl="https://context.example.test/session/readiness-session"
        status="Published session readiness-session."
      />,
    );

    expect(screen.getByText('Metadata URI:')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_METADATA_URI)).toHaveTextContent('ar://metadata-tx');
    expect(screen.getByRole('link', { name: 'https://arweave.example.test/metadata-tx' })).toHaveAttribute(
      'href',
      'https://arweave.example.test/metadata-tx',
    );
    expect(screen.getByText('Register txs:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'https://optimism-sepolia.blockscout.com/tx/0xregister1',
      }),
    ).toHaveAttribute('href', 'https://optimism-sepolia.blockscout.com/tx/0xregister1');
    expect(
      screen.getByRole('link', {
        name: 'https://context.example.test/session/readiness-session',
      }),
    ).toHaveAttribute('href', 'https://context.example.test/session/readiness-session');
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_ADMIN_URL)).toHaveAttribute(
      'href',
      'https://context.example.test/admin/readiness-session',
    );
    expect(screen.getByRole('link', { name: 'Access Badge' })).toHaveAttribute(
      'href',
      'https://context.example.test/sbt/0xf1',
    );
    expect(screen.getByText('Admin URL copied.')).toBeInTheDocument();
    expect(screen.getByText('Published session readiness-session.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Copy/i }));
    expect(onCopyAdminUrl).toHaveBeenCalledTimes(1);
  });

  it('renders manual metadata and raw register hashes when no explorer base is available', () => {
    render(
      <SessionPublishResultLinks
        adminUrl=""
        adminUrlStatus=""
        onCopyAdminUrl={jest.fn()}
        publishMetadataDisplayState={{
          ...metadataDisplayState,
          effectiveMetadataGatewayUrl: '',
          effectiveMetadataTxId: '',
          manualMetadataDisplayUri: 'ar://manual-tx',
          metadataUri: '',
          metadataUriLabel: '',
          showArweaveTx: false,
          showManualMetadataUri: true,
          showMetadataUri: false,
        }}
        publishedPendingSbtLinks={[]}
        registerExplorerBaseUrl=""
        registerTxs={[{ action: 'createSession', hash: '0xregister1' }]}
        sessionUrl=""
        status=""
      />,
    );

    expect(screen.getByText('Manual metadata URI:')).toBeInTheDocument();
    expect(screen.getByText('ar://manual-tx')).toBeInTheDocument();
    expect(screen.getByText('0xregister1')).toBeInTheDocument();
  });
});
