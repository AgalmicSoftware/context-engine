import React from 'react';
import { render, screen } from '@testing-library/react';

import { DocumentLibraryViewerBody } from './DocumentLibraryPanelViews';

const renderLinkDocument = (url: string) =>
  render(
    <DocumentLibraryViewerBody
      viewerError=""
      viewerLoading={false}
      viewerText={JSON.stringify({ kind: 'link', title: 'Saved link', url })}
      viewerMime="application/json"
      viewerBlobUrl=""
      viewerTitle="Saved link"
    />,
  );

describe('DocumentLibraryViewerBody link documents', () => {
  it('links saved http(s) and Arweave URLs through the shared safe-link check', () => {
    const txId = '8_2VRRP5Ka0b5F9yiq_nm2hJto8qnQazZ2EtfLJ0viE';
    const { unmount } = renderLinkDocument('https://docs.example.test/brief');
    expect(screen.getByRole('link', { name: 'https://docs.example.test/brief' })).toHaveAttribute(
      'href',
      'https://docs.example.test/brief',
    );
    unmount();

    renderLinkDocument(`ar://${txId}`);
    expect(screen.getByRole('link')).toHaveAttribute('href', expect.stringMatching(new RegExp(`/${txId}$`)));
  });

  it('shows unsafe saved URLs as text without a link', () => {
    renderLinkDocument('javascript:alert(document.domain)');

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Unsafe or invalid URL (not rendered as a link):', { exact: false })).toBeInTheDocument();
  });
});
