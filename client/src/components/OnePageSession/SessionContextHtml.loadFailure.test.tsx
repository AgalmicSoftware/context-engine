import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// The sanitizer can't load, as when its file fails to download.
jest.mock('../../utilities/ui/browserPdfExport', () => ({
  ...jest.requireActual<typeof import('../../utilities/ui/browserPdfExport')>('../../utilities/ui/browserPdfExport'),
  loadBrowserModuleWithRetry: jest.fn(() => Promise.reject(new Error('offline'))),
}));

import SessionContextHtml from './SessionContextHtml';
import SetupContextHtmlField from '../Sessions/setup/SetupContextHtmlField';

describe('an HTML context page whose sanitizer cannot load', () => {
  it('says the page could not be shown, and never shows it uncleaned', async () => {
    const html = '<p onclick="steal()">Raw</p><script>steal()</script>';
    const { container } = render(<SessionContextHtml html={html} framed colorSchemeId="civic" />);
    await waitFor(() =>
      expect(screen.getByTestId('ce-session-context-html')).toHaveTextContent('This page couldn’t be shown.'),
    );
    expect(container.textContent).not.toContain('Raw');
    expect([...container.querySelectorAll('*')].some((node) => node.shadowRoot)).toBe(false);
  });

  it('refuses an uploaded file rather than saving it uncleaned', async () => {
    const onChange = jest.fn();
    render(<SetupContextHtmlField html="" onChange={onChange} colorSchemeId="civic" />);
    fireEvent.change(screen.getByTestId('ce-setup-context-html-file'), {
      target: { files: [new File(['<p onclick="x()">Hi</p>'], 'page.html', { type: 'text/html' })] },
    });
    expect(await screen.findByTestId('ce-setup-context-html-error')).toHaveTextContent('This file couldn’t be read.');
    expect(onChange).not.toHaveBeenCalled();
  });
});
