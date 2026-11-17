import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen } from '@testing-library/react';
import SessionDocumentsPage from './SessionDocumentsPage';

jest.mock('./DocumentLibraryPanel', () => () => <div data-testid="mock-doc-library-panel" />);

describe('SessionDocumentsPage', () => {
  it('uses the resolved canonical session slug for the back link instead of the raw route token', () => {
    render(<SessionDocumentsPage sessionToken="DEBATE" sessionSlug="rxc" sessionConfig={{ slug: 'rxc' }} />);

    expect(screen.getByRole('link', { name: 'Back to session' })).toHaveAttribute('href', '/session/rxc');
  });

  it('preserves worker discovery in the back link for an unregistered worker-canonical session', () => {
    render(
      <SessionDocumentsPage
        sessionToken="worker-docs"
        sessionSlug="worker-docs"
        sessionConfig={{ slug: 'worker-docs' }}
        workerOrigin="https://worker-docs.example.workers.dev"
      />,
    );

    expect(screen.getByRole('link', { name: 'Back to session' })).toHaveAttribute(
      'href',
      '/session/worker-docs?worker=https%3A%2F%2Fworker-docs.example.workers.dev',
    );
  });

  it('keeps the general-session back link canonical as /session', () => {
    render(<SessionDocumentsPage sessionToken="general" sessionSlug="" sessionConfig={{ slug: '' }} />);

    expect(screen.getByRole('link', { name: 'Back to session' })).toHaveAttribute('href', '/session');
  });

  // The library and its viewer draw in the inverse colour, made for dark panels. As a page it is a
  // document; as a dialog it takes the setup page's surface and text. Each pair reads in every theme.
  it('paints the page as a document and the viewer in its dialog’s colours, so their text reads in every theme', () => {
    const rule = (file: string, selector: string) => {
      const css = fs.readFileSync(path.join(__dirname, file), 'utf8');
      const start = css.indexOf(`${selector} {`);
      expect(start).toBeGreaterThanOrEqual(0);
      return css.slice(start, css.indexOf('\n}', start));
    };
    const page = rule('SessionDocumentsPage.module.scss', '.page');
    expect(page).toMatch(/--ce-text-inverse:\s*var\(--ce-document-text\);/);
    expect(page).toMatch(/\bbackground:\s*var\(--ce-document-canvas\);/);
    expect(page).toMatch(/\bcolor:\s*var\(--ce-document-text\);/);
    const viewer = rule('DocumentLibraryPanel.module.scss', '.documentViewer');
    expect(viewer).toMatch(/--ce-text-inverse:\s*var\(--ce-panel-text\);/);
    expect(viewer).toMatch(/\bbackground:\s*var\(--ce-surface\) !important;/);
    expect(viewer).toMatch(/\bcolor:\s*var\(--ce-panel-text\) !important;/);
  });
});
