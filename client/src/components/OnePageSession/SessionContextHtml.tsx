import React from 'react';
import { loadContextHtmlCleaner } from '../../utilities/session/contextHtml';
import { CONTEXT_HTML_PAGE_CSS } from './sessionContextHtmlCss';
import styles from './SessionContextHtml.module.scss';

type Props = {
  html: string;
  testId?: string;
  /** In the context section's own frame and colour scheme, as the setup page's preview needs. */
  framed?: boolean;
  colorSchemeId?: string;
};

// The page sits two shadow roots deep. Its CSS, :host rules included, reaches
// only the inner host, which stays inside the outer one; that box clips the
// page and holds whatever it positions (contain: paint), so nothing covers the site.
const renderPage = (host: HTMLElement, clean: string) => {
  const outer = host.shadowRoot || host.attachShadow({ mode: 'open' });
  let pageHost = outer.firstElementChild as HTMLElement | null;
  if (!pageHost) {
    pageHost = document.createElement('div');
    outer.appendChild(pageHost);
  }
  const page = pageHost.shadowRoot || pageHost.attachShadow({ mode: 'open' });
  page.innerHTML = `<style>${CONTEXT_HTML_PAGE_CSS}</style>${clean}`;
};

/** The shadow root an uploaded page renders in, for tests and tools. */
export const readContextHtmlPage = (host: Element | null): ShadowRoot | null =>
  host?.shadowRoot?.firstElementChild?.shadowRoot ?? null;

/**
 * An admin's uploaded context page. It is cleaned again on every render,
 * because stored HTML is untrusted: set-config and MCP can write it directly.
 */
const SessionContextHtml = ({ html, testId = 'ce-session-context-html', framed = false, colorSchemeId }: Props) => {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [cleaner, setCleaner] = React.useState<Awaited<ReturnType<typeof loadContextHtmlCleaner>> | null>(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let current = true;
    loadContextHtmlCleaner().then(
      (loaded) => current && setCleaner(() => loaded),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, []);
  const clean = React.useMemo(() => (cleaner ? cleaner(html).html : null), [cleaner, html]);
  React.useLayoutEffect(() => {
    if (hostRef.current && clean !== null) renderPage(hostRef.current, clean);
  }, [clean]);
  const page = failed ? (
    <p data-testid={testId}>This page couldn’t be shown. Reload to try again.</p>
  ) : (
    <div ref={hostRef} className={styles.host} data-testid={testId} />
  );
  return framed ? (
    <div className={styles.frame} data-ce-session-color-scheme={colorSchemeId}>
      {page}
    </div>
  ) : (
    page
  );
};

export default SessionContextHtml;
