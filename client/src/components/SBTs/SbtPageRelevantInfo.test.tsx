import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtPageRelevantInfo from './SbtPageRelevantInfo';

const createProps = (overrides: Partial<React.ComponentProps<typeof SbtPageRelevantInfo>> = {}) => ({
  documentIDHashes: ['doc hash'],
  documentURLs: ['https://doc.example.test/public'],
  onOpenEncryptedDoc: jest.fn(),
  shouldRenderDocumentIdHashes: true,
  shouldRenderDocumentUrls: true,
  shouldRenderTags: true,
  tags: ['AI Policy'],
  ...overrides,
});

describe('SbtPageRelevantInfo', () => {
  it('renders public document URLs, document IDs, and tags from explicit props', () => {
    render(<SbtPageRelevantInfo {...createProps()} />);

    expect(screen.getByText('This section shows relevant documents, URLs, tags, and IDs.')).toBeInTheDocument();
    expect(screen.getByText('Document URLs:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://doc.example.test/public' })).toHaveAttribute(
      'href',
      'https://doc.example.test/public',
    );
    expect(screen.getByText('Document ID Hashes:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'doc hash' })).toHaveAttribute('href', '/doc/doc%20hash');
    expect(screen.getByText('Tags:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI Policy' })).toHaveAttribute('href', '/tag/AI%20Policy');
  });

  it('renders encrypted document URLs as passive decrypt buttons wired to the parent handler', () => {
    const onOpenEncryptedDoc = jest.fn();
    const encryptedUrl = 'lit://arweave/example-tx';
    render(
      <SbtPageRelevantInfo
        {...createProps({
          documentIDHashes: [],
          documentURLs: [encryptedUrl],
          onOpenEncryptedDoc,
          shouldRenderDocumentIdHashes: false,
          shouldRenderTags: false,
          tags: [],
        })}
      />,
    );

    expect(screen.getByText('Encrypted Doc')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Decrypt and view' }));
    expect(onOpenEncryptedDoc).toHaveBeenCalledWith(encryptedUrl);
  });

  it('preserves PUBLIC_URL when building document and tag routes', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';

    try {
      render(
        <SbtPageRelevantInfo
          {...createProps({
            documentURLs: [],
            shouldRenderDocumentUrls: false,
          })}
        />,
      );

      expect(screen.getByRole('link', { name: 'doc hash' })).toHaveAttribute('href', '/ce/doc/doc%20hash');
      expect(screen.getByRole('link', { name: 'AI Policy' })).toHaveAttribute('href', '/ce/tag/AI%20Policy');
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });

  it('hides optional sections from parent-derived display state', () => {
    render(
      <SbtPageRelevantInfo
        {...createProps({
          shouldRenderDocumentIdHashes: false,
          shouldRenderDocumentUrls: false,
          shouldRenderTags: false,
        })}
      />,
    );

    expect(screen.queryByText('Document URLs:')).toBeNull();
    expect(screen.queryByText('Document ID Hashes:')).toBeNull();
    expect(screen.queryByText('Tags:')).toBeNull();
  });
});
