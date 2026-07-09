import React from 'react';
import { render, screen } from '@testing-library/react';
import SessionDocumentsPage from './SessionDocumentsPage';

jest.mock('./DocumentLibraryPanel', () => () => <div data-testid="mock-doc-library-panel" />);

describe('SessionDocumentsPage', () => {
  it('uses the resolved canonical session slug for the back link instead of the raw route token', () => {
    render(<SessionDocumentsPage sessionToken="DEBATE" sessionSlug="rxc" sessionConfig={{ slug: 'rxc' }} />);

    expect(screen.getByRole('link', { name: 'Back to session' })).toHaveAttribute('href', '/session/rxc');
  });

  it('keeps the general-session back link canonical as /session', () => {
    render(<SessionDocumentsPage sessionToken="general" sessionSlug="" sessionConfig={{ slug: '' }} />);

    expect(screen.getByRole('link', { name: 'Back to session' })).toHaveAttribute('href', '/session');
  });
});
