import {
  DEFAULT_PUBLIC_PAGE_DESCRIPTION,
  DEFAULT_PUBLIC_PAGE_TITLE,
  buildCanonicalPublicUrl,
  syncPublicPageHead,
} from './publicPageHead.js';
import {
  PUBLIC_DISCOVERABILITY_URL,
  PUBLIC_LLMS_URL,
  PUBLIC_REPO_SOURCE_URL,
  PUBLIC_REPO_URL,
} from '../../variables/publicRepoMetadata.js';

describe('publicPageHead', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
    window.history.replaceState({}, '', '/');
  });

  it('falls back to the live browser origin for router-style locations', () => {
    window.history.replaceState({}, '', '/session/current');

    expect(
      buildCanonicalPublicUrl({ pathname: '/session/demo', search: '?session=edge' })
    ).toBe(`${window.location.origin}/session/demo?session=edge`);
  });

  it('keeps route-defining query strings in canonical URLs', () => {
    expect(
      buildCanonicalPublicUrl(new URL('https://contextengine.xyz/group/0xabc?session=edge#details'))
    ).toBe('https://contextengine.xyz/group/0xabc?session=edge');
  });

  it('drops UI-only query params from canonical URLs', () => {
    expect(
      buildCanonicalPublicUrl(
        new URL('https://contextengine.xyz/surveys?results=true&ref=welcome&ceSessionScanScope=list')
      )
    ).toBe('https://contextengine.xyz/surveys');
  });

  it('normalizes trailing-slash aliases to one canonical URL', () => {
    expect(
      buildCanonicalPublicUrl(
        new URL('https://contextengine.xyz/compare/?ref=welcome')
      )
    ).toBe('https://contextengine.xyz/compare');
  });

  it('normalizes route-defining query aliases in canonical URLs', () => {
    expect(
      buildCanonicalPublicUrl(
        new URL('https://contextengine.xyz/question/0xabc?sid=0xsessionid&responder=0xdeadbeef&results=true')
      )
    ).toBe('https://contextengine.xyz/question/0xabc?sessionId=0xsessionid&responder=0xdeadbeef');
  });

  it('preserves contract deep-link params while dropping unrelated query strings', () => {
    expect(
      buildCanonicalPublicUrl(
        new URL('https://contextengine.xyz/contracts?session=edge&contract=surveys&ref=welcome')
      )
    ).toBe('https://contextengine.xyz/contracts?session=edge&contract=surveys');
  });

  it('preserves session wizard deep-link params while dropping referral query strings', () => {
    expect(
      buildCanonicalPublicUrl(
        new URL('https://contextengine.xyz/session/new?chainID=registry-84532&sponsored=bundle-1&ref=welcome')
      )
    ).toBe('https://contextengine.xyz/session/new?chainId=registry-84532&sponsored=bundle-1');
  });

  it('preserves chain-scoped admin and sponsor deep links in canonical URLs', () => {
    expect(
      buildCanonicalPublicUrl(
        new URL('https://contextengine.xyz/admin?sessionId=edge-session-id&chainID=registry-84532&ref=welcome')
      )
    ).toBe('https://contextengine.xyz/admin?sessionId=edge-session-id&chainId=registry-84532');
    expect(
      buildCanonicalPublicUrl(
        new URL('https://contextengine.xyz/sponsor?sessionId=edge-session-id&chainID=registry-11155420&ref=welcome')
      )
    ).toBe('https://contextengine.xyz/sponsor?sessionId=edge-session-id&chainId=registry-11155420');
  });

  it('keeps route-defining params for PUBLIC_URL-prefixed contracts and wizard routes', () => {
    const priorPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';

    try {
      expect(
        buildCanonicalPublicUrl(
          new URL('https://contextengine.xyz/ce/contracts?session=edge&contract=surveys&ref=welcome')
        )
      ).toBe('https://contextengine.xyz/ce/contracts?session=edge&contract=surveys');
      expect(
        buildCanonicalPublicUrl(
          new URL('https://contextengine.xyz/ce/session/new?sessionId=edge-session-id&chainId=84532&sponsored=bundle-1&ref=welcome')
        )
      ).toBe('https://contextengine.xyz/ce/session/new?sessionId=edge-session-id&chainId=84532&sponsored=bundle-1');
    } finally {
      if (typeof priorPublicUrl === 'undefined') {
        delete process.env.PUBLIC_URL;
      } else {
        process.env.PUBLIC_URL = priorPublicUrl;
      }
    }
  });

  it('syncs canonical and open graph URLs to the active SPA route', () => {
    const state = syncPublicPageHead({
      location: new URL('https://contextengine.xyz/session/demo?session=edge&results=true#details'),
    });

    expect(state).toEqual(
      expect.objectContaining({
        title: DEFAULT_PUBLIC_PAGE_TITLE,
        description: DEFAULT_PUBLIC_PAGE_DESCRIPTION,
        canonicalUrl: 'https://contextengine.xyz/session/demo?session=edge',
        ogUrl: 'https://contextengine.xyz/session/demo?session=edge',
      })
    );
    expect(document.title).toBe(DEFAULT_PUBLIC_PAGE_TITLE);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://contextengine.xyz/session/demo?session=edge'
    );
    expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://contextengine.xyz/session/demo?session=edge'
    );
  });

  it('publishes structured data with the GitHub repo in sameAs', () => {
    syncPublicPageHead({
      location: new URL('https://contextengine.xyz/about?ref=welcome'),
    });

    const structuredDataNode = document.head.querySelector(
      'script[type="application/ld+json"][data-ce-structured-data="public-page"]'
    );
    expect(structuredDataNode).not.toBeNull();

    const structuredData = JSON.parse(structuredDataNode?.textContent || '{}');
    const graph = Array.isArray(structuredData['@graph']) ? structuredData['@graph'] : [];
    const organization = graph.find((entry) => entry?.['@type'] === 'Organization');
    const sourceCode = graph.find((entry) => entry?.['@type'] === 'SoftwareSourceCode');
    const webPage = graph.find((entry) => entry?.['@type'] === 'WebPage');

    expect(organization).toEqual(
      expect.objectContaining({
        '@id': `${DEFAULT_PUBLIC_SITE_URL}#organization`,
        url: DEFAULT_PUBLIC_SITE_URL,
        sameAs: [PUBLIC_REPO_URL],
      })
    );
    expect(sourceCode).toEqual(
      expect.objectContaining({
        '@id': `${DEFAULT_PUBLIC_SITE_URL}#source`,
        codeRepository: PUBLIC_REPO_URL,
        url: PUBLIC_REPO_SOURCE_URL,
      })
    );
    expect(webPage).toEqual(
      expect.objectContaining({
        url: 'https://contextengine.xyz/about',
        name: DEFAULT_PUBLIC_PAGE_TITLE,
        description: DEFAULT_PUBLIC_PAGE_DESCRIPTION,
        significantLink: [
          PUBLIC_REPO_URL,
          PUBLIC_REPO_SOURCE_URL,
          PUBLIC_DISCOVERABILITY_URL,
          PUBLIC_LLMS_URL,
        ],
      })
    );
  });

  it('updates existing head tags in place when the route changes', () => {
    document.head.innerHTML = `
      <link rel="canonical" href="https://contextengine.xyz/" />
      <meta property="og:url" content="https://contextengine.xyz/" />
    `;

    syncPublicPageHead({
      location: new URL('https://contextengine.xyz/about'),
    });
    syncPublicPageHead({
      location: new URL('https://contextengine.xyz/session/demo'),
    });

    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[property="og:url"]')).toHaveLength(1);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://contextengine.xyz/session/demo'
    );
    expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://contextengine.xyz/session/demo'
    );
  });
});
