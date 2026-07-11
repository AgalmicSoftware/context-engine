import {
  DEFAULT_PUBLIC_PAGE_DESCRIPTION,
  DEFAULT_PUBLIC_PAGE_TITLE,
  DEFAULT_PUBLIC_SITE_URL,
  buildCanonicalPublicUrl,
  syncPublicPageHead,
} from './publicPageHead.js';
import {
  PUBLIC_DISCOVERABILITY_URL,
  PUBLIC_LLMS_URL,
  PUBLIC_REPO_SOURCE_URL,
  PUBLIC_REPO_URL,
} from '../../variables/publicRepoMetadata.js';

type StructuredDataNode = {
  '@type'?: unknown;
  significantLink?: unknown;
  url?: unknown;
};

type StructuredData = {
  '@graph'?: unknown;
};

const structuredDataSelector = 'script[type="application/ld+json"][data-ce-structured-data="public-page"]';

const isStructuredDataNode = (entry: unknown): entry is StructuredDataNode =>
  typeof entry === 'object' && entry !== null;

const parseStructuredData = (): StructuredData =>
  JSON.parse(document.head.querySelector(structuredDataSelector)?.textContent || '{}') as StructuredData;

const getStructuredDataGraph = (structuredData: StructuredData): StructuredDataNode[] =>
  Array.isArray(structuredData['@graph']) ? structuredData['@graph'].filter(isStructuredDataNode) : [];

const findStructuredDataNode = (structuredData: StructuredData, nodeType: string): StructuredDataNode | undefined =>
  getStructuredDataGraph(structuredData).find((entry) => entry['@type'] === nodeType);

describe('publicPageHead', () => {
  const env = process.env as Record<string, string | undefined>;
  beforeEach(() => {
    document.head.innerHTML = '';
    document.title = '';
    window.history.replaceState({}, '', '/');
  });

  it('falls back to the live browser origin for router-style locations', () => {
    window.history.replaceState({}, '', '/session/current');

    expect(buildCanonicalPublicUrl({ pathname: '/session/demo', search: '?session=edge' })).toBe(
      `${window.location.origin}/session/demo?session=edge`,
    );
  });

  it('keeps route-defining query strings in canonical URLs', () => {
    expect(buildCanonicalPublicUrl(new URL('https://contextengine.xyz/group/0xabc?session=edge#details'))).toBe(
      'https://contextengine.xyz/group/0xabc?session=edge',
    );
  });

  it('drops UI-only query params from canonical URLs', () => {
    expect(
      buildCanonicalPublicUrl(
        new URL('https://contextengine.xyz/surveys?results=true&ref=welcome&ceSessionScanScope=list'),
      ),
    ).toBe('https://contextengine.xyz/surveys');
  });

  it('normalizes trailing-slash aliases to one canonical URL', () => {
    expect(buildCanonicalPublicUrl(new URL('https://contextengine.xyz/compare/?ref=welcome'))).toBe(
      'https://contextengine.xyz/compare',
    );
  });

  it('normalizes route-defining query aliases in canonical URLs', () => {
    expect(
      buildCanonicalPublicUrl(
        new URL('https://contextengine.xyz/question/0xabc?sid=0xsessionid&responder=0xdeadbeef&results=true'),
      ),
    ).toBe('https://contextengine.xyz/question/0xabc?sessionId=0xsessionid&responder=0xdeadbeef');
  });

  it('preserves contract deep-link params while dropping unrelated query strings', () => {
    expect(
      buildCanonicalPublicUrl(new URL('https://contextengine.xyz/contracts?session=edge&contract=surveys&ref=welcome')),
    ).toBe('https://contextengine.xyz/contracts?session=edge&contract=surveys');
  });

  it('preserves session wizard deep-link params while dropping referral query strings', () => {
    expect(
      buildCanonicalPublicUrl(
        new URL('https://contextengine.xyz/session/new?chainID=registry-84532&sponsored=bundle-1&ref=welcome'),
      ),
    ).toBe('https://contextengine.xyz/session/new?chainId=registry-84532&sponsored=bundle-1');
  });

  it('preserves chain-scoped admin and sponsor deep links in canonical URLs', () => {
    expect(
      buildCanonicalPublicUrl(
        new URL('https://contextengine.xyz/admin?sessionId=edge-session-id&chainID=registry-84532&ref=welcome'),
      ),
    ).toBe('https://contextengine.xyz/admin?sessionId=edge-session-id&chainId=registry-84532');
    expect(
      buildCanonicalPublicUrl(
        new URL('https://contextengine.xyz/sponsor?sessionId=edge-session-id&chainID=registry-11155420&ref=welcome'),
      ),
    ).toBe('https://contextengine.xyz/sponsor?sessionId=edge-session-id&chainId=registry-11155420');
  });

  it('keeps route-defining params for PUBLIC_URL-prefixed contracts and wizard routes', () => {
    const priorPublicUrl = env.PUBLIC_URL;
    env.PUBLIC_URL = '/ce/';

    try {
      expect(
        buildCanonicalPublicUrl(
          new URL('https://contextengine.xyz/ce/contracts?session=edge&contract=surveys&ref=welcome'),
        ),
      ).toBe('https://contextengine.xyz/ce/contracts?session=edge&contract=surveys');
      expect(
        buildCanonicalPublicUrl(
          new URL(
            'https://contextengine.xyz/ce/session/new?sessionId=edge-session-id&chainId=84532&sponsored=bundle-1&ref=welcome',
          ),
        ),
      ).toBe('https://contextengine.xyz/ce/session/new?sessionId=edge-session-id&chainId=84532&sponsored=bundle-1');
    } finally {
      if (typeof priorPublicUrl === 'undefined') {
        delete env.PUBLIC_URL;
      } else {
        env.PUBLIC_URL = priorPublicUrl;
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
      }),
    );
    expect(document.title).toBe(DEFAULT_PUBLIC_PAGE_TITLE);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://contextengine.xyz/session/demo?session=edge',
    );
    expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://contextengine.xyz/session/demo?session=edge',
    );
  });

  it('supports article metadata with a large social preview image', () => {
    const state = syncPublicPageHead({
      location: new URL('https://contextengine.xyz/posts/agent-village-wrapped-2026'),
      title: 'Agent Village Wrapped',
      description: 'A personal-agent evaluation.',
      image: 'https://contextengine.xyz/posts/agent-village-wrapped/attachments/header.jpg',
      ogType: 'article',
      twitterCard: 'summary_large_image',
    });

    expect(state).toEqual(
      expect.objectContaining({
        ogType: 'article',
        twitterCard: 'summary_large_image',
      }),
    );
    expect(document.head.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe('article');
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://contextengine.xyz/posts/agent-village-wrapped/attachments/header.jpg',
    );
    expect(document.head.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
      'summary_large_image',
    );
  });

  it('emits deployment-origin discovery significantLink URLs for root-host deployments', () => {
    window.history.replaceState({}, '', '/');

    syncPublicPageHead({ location: window.location });

    const structuredData = parseStructuredData();
    const webPage = findStructuredDataNode(structuredData, 'WebPage');

    expect(webPage?.significantLink).toEqual(
      expect.arrayContaining([`${window.location.origin}/discoverability.html`, `${window.location.origin}/llms.txt`]),
    );
  });

  it('emits deployment-origin discovery significantLink URLs for custom origins', () => {
    const location = { origin: 'https://preview.example.test', pathname: '/', search: '' };

    syncPublicPageHead({ location });

    const structuredData = parseStructuredData();
    const webPage = findStructuredDataNode(structuredData, 'WebPage');

    expect(webPage?.significantLink).toEqual(
      expect.arrayContaining([
        'https://preview.example.test/discoverability.html',
        'https://preview.example.test/llms.txt',
      ]),
    );
  });

  it('respects PUBLIC_URL when building deployment discovery significantLink URLs', () => {
    const priorPublicUrl = env.PUBLIC_URL;
    const location = { origin: 'https://preview.example.test', pathname: '/', search: '' };

    env.PUBLIC_URL = '/ce/';

    try {
      syncPublicPageHead({ location });

      const structuredData = parseStructuredData();
      const webPage = findStructuredDataNode(structuredData, 'WebPage');

      expect(webPage?.significantLink).toEqual(
        expect.arrayContaining([
          'https://preview.example.test/ce/discoverability.html',
          'https://preview.example.test/ce/llms.txt',
        ]),
      );
    } finally {
      if (typeof priorPublicUrl === 'undefined') {
        delete env.PUBLIC_URL;
      } else {
        env.PUBLIC_URL = priorPublicUrl;
      }
    }
  });

  it('publishes structured data with the GitHub repo in sameAs', () => {
    syncPublicPageHead({
      location: new URL('https://contextengine.xyz/about?ref=welcome'),
    });

    const structuredDataNode = document.head.querySelector(structuredDataSelector);
    expect(structuredDataNode).not.toBeNull();

    const structuredData = JSON.parse(structuredDataNode?.textContent || '{}') as StructuredData;
    const organization = findStructuredDataNode(structuredData, 'Organization');
    const sourceCode = findStructuredDataNode(structuredData, 'SoftwareSourceCode');
    const webPage = findStructuredDataNode(structuredData, 'WebPage');

    expect(organization).toEqual(
      expect.objectContaining({
        '@id': `${DEFAULT_PUBLIC_SITE_URL}#organization`,
        url: DEFAULT_PUBLIC_SITE_URL,
        sameAs: [PUBLIC_REPO_URL],
      }),
    );
    expect(sourceCode).toEqual(
      expect.objectContaining({
        '@id': `${DEFAULT_PUBLIC_SITE_URL}#source`,
        codeRepository: PUBLIC_REPO_URL,
        url: PUBLIC_REPO_SOURCE_URL,
      }),
    );
    expect(webPage).toEqual(
      expect.objectContaining({
        url: 'https://contextengine.xyz/about',
        name: DEFAULT_PUBLIC_PAGE_TITLE,
        description: DEFAULT_PUBLIC_PAGE_DESCRIPTION,
        significantLink: [PUBLIC_REPO_URL, PUBLIC_REPO_SOURCE_URL, PUBLIC_DISCOVERABILITY_URL, PUBLIC_LLMS_URL],
      }),
    );
  });

  it('updates existing head tags in place when the route changes', () => {
    document.head.innerHTML = `
      <link rel="canonical" href="https://contextengine.xyz/" />
      <meta property="og:url" content="https://contextengine.xyz/" />
      <script type="application/ld+json" data-ce-structured-data="public-page">{}</script>
    `;

    syncPublicPageHead({
      location: new URL('https://contextengine.xyz/about'),
    });
    syncPublicPageHead({
      location: new URL('https://contextengine.xyz/session/demo'),
    });

    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelectorAll('meta[property="og:url"]')).toHaveLength(1);
    expect(
      document.head.querySelectorAll('script[type="application/ld+json"][data-ce-structured-data="public-page"]'),
    ).toHaveLength(1);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://contextengine.xyz/session/demo',
    );
    expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://contextengine.xyz/session/demo',
    );
    const structuredData = parseStructuredData();
    const webPage = findStructuredDataNode(structuredData, 'WebPage');
    expect(webPage?.url).toBe('https://contextengine.xyz/session/demo');
  });
});
