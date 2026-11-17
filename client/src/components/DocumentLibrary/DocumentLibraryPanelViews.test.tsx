import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DocumentLibraryList, DocumentLibraryViewerBody } from './DocumentLibraryPanelViews';
import { notify } from '../../utilities/ui/notify.js';

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

describe('DocumentLibraryList copy link', () => {
  it('says so when copying a document link is refused', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const error = jest.spyOn(notify, 'error').mockImplementation(() => '');
    const success = jest.spyOn(notify, 'success').mockImplementation(() => '');
    try {
      render(
        <DocumentLibraryList
          docs={[{ txId: 'tx-1', tagMap: { 'CE-DocName': 'Brief' } } as never]}
          loading={false}
          canList
          cursor={null}
          onLoadMore={jest.fn()}
          openDoc={jest.fn()}
        />,
      );
      fireEvent.click(screen.getByTitle('Copy link'));
      await waitFor(() =>
        expect(error).toHaveBeenCalledWith("Copying isn't allowed here, so the link could not be copied."),
      );
      expect(writeText.mock.calls[0][0]).toContain('tx-1');
      expect(success).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
      success.mockRestore();
    }
  });
});
