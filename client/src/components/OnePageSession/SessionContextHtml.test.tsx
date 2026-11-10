import React from 'react';
import { render, waitFor } from '@testing-library/react';
import SessionContextHtml, { readContextHtmlPage } from './SessionContextHtml';
import { CONTEXT_HTML_PAGE_CSS } from './sessionContextHtmlCss';

describe('SessionContextHtml', () => {
  it('renders the cleaned page two shadow roots deep, so its CSS styles only the page', async () => {
    const html =
      '<style>:host { position: fixed !important; inset: 0; } p { color: teal; }</style>' +
      '<p onclick="steal()">Inside</p><script>steal()</script>';
    const { getByTestId } = render(<SessionContextHtml html={html} />);
    const host = getByTestId('ce-session-context-html');
    // The sanitizer loads on first use, then the page renders.
    await waitFor(() => expect(readContextHtmlPage(host)?.querySelector('p')).toBeTruthy());
    // Nothing of the page is in the site's own tree, where its CSS could apply.
    expect(host.childNodes).toHaveLength(0);
    // Nor in the outer shadow root, where its :host rules would reach the host on the site.
    expect(host.shadowRoot?.querySelector('style, p')).toBeNull();
    const page = readContextHtmlPage(host);
    expect(page?.querySelector('p')?.textContent).toBe('Inside');
    expect(page?.querySelector('script, [onclick]')).toBeNull();
    // The defaults come first, so the page's own CSS can override them.
    expect([...(page?.querySelectorAll('style') || [])].map((style) => style.textContent)).toEqual([
      CONTEXT_HTML_PAGE_CSS,
      ':host { position: fixed !important; inset: 0; } p { color: teal; }',
    ]);
  });

  it('replaces the page in place when its HTML changes', async () => {
    const { getByTestId, rerender } = render(<SessionContextHtml html="<p>First</p>" />);
    const host = getByTestId('ce-session-context-html');
    await waitFor(() => expect(readContextHtmlPage(host)?.querySelector('p')?.textContent).toBe('First'));
    rerender(<SessionContextHtml html="<p>Second</p>" />);
    expect(host.shadowRoot?.children).toHaveLength(1);
    expect(readContextHtmlPage(host)?.querySelector('p')?.textContent).toBe('Second');
  });
});
