import React from 'react';
import { render, screen } from '@testing-library/react';

import AdminPageSessionMetadataSummary from './AdminPageSessionMetadataSummary';

const renderSummary = (metadataUri: string) =>
  render(
    <AdminPageSessionMetadataSummary
      allowedOriginCount={0}
      allowedOriginsReported={false}
      groupMetadata={{ sessionName: 'Registry session' }}
      isWorkerCanonical={false}
      metadataAdminAddress=""
      metadataAdminUrl=""
      metadataLoadStateLabel="Loaded"
      metadataSessionUrl=""
      metadataSlugDisplay="registry-session"
      metadataUriUrl={metadataUri}
      metadataUriValue={metadataUri}
      workerUrl=""
    />,
  );

describe('AdminPageSessionMetadataSummary', () => {
  it('shows an unsafe registry metadata URI as text instead of a link', () => {
    const unsafeUri = 'javascript:alert(document.domain)';
    const { container } = renderSummary(unsafeUri);

    expect(screen.getByText(unsafeUri).closest('a')).toBeNull();
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it('links a safe registry metadata URI', () => {
    const metadataUri = 'https://metadata.example.test/session.json';
    renderSummary(metadataUri);

    expect(screen.getByRole('link', { name: metadataUri })).toHaveAttribute('href', metadataUri);
  });
});
