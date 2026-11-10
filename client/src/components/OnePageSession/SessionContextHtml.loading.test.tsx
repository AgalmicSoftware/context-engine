import React from 'react';
import { act, render, waitFor } from '@testing-library/react';

// Holds the sanitizer's load until the test lets it finish.
const mockPending: Array<(value: unknown) => void> = [];
jest.mock('../../utilities/ui/browserPdfExport', () => ({
  ...jest.requireActual<typeof import('../../utilities/ui/browserPdfExport')>('../../utilities/ui/browserPdfExport'),
  loadBrowserModuleWithRetry: jest.fn(() => new Promise((resolve) => mockPending.push(resolve))),
}));

import SessionContextHtml, { readContextHtmlPage } from './SessionContextHtml';

describe('SessionContextHtml while its sanitizer loads', () => {
  it('shows nothing until the sanitizer loads, then only the latest page, cleaned', async () => {
    const errors = jest.spyOn(console, 'error');
    const first = '<p onclick="steal()">First</p><img src="x" onerror="steal()">';
    const { getByTestId, rerender } = render(<SessionContextHtml html={first} />);
    const host = getByTestId('ce-session-context-html');
    expect(host.shadowRoot).toBeNull();
    expect(host.innerHTML).toBe('');
    rerender(<SessionContextHtml html={'<p onclick="steal()">Second</p><script>steal()</script>'} />);
    expect(host.shadowRoot).toBeNull();
    // Another view comes and goes while the load is under way.
    render(<SessionContextHtml html={first} testId="other" />).unmount();
    const dompurify = jest.requireActual('dompurify');
    await act(async () => {
      mockPending.forEach((resolve) => resolve({ default: dompurify }));
    });
    await waitFor(() => expect(readContextHtmlPage(host)?.querySelector('p')?.textContent).toBe('Second'));
    const page = readContextHtmlPage(host);
    expect(page?.querySelector('script, [onclick], img, [onerror]')).toBeNull();
    expect(page?.innerHTML).not.toContain('First');
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
