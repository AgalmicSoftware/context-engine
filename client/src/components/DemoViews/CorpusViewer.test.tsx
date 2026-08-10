import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';

import CorpusViewer from './CorpusViewer';
import PolicyGlobe from './PolicyGlobe';

const mockTagPage = jest.fn();

jest.mock('../TagPage/TagPage', () => ({
  __esModule: true,
  default: (props: any) => {
    mockTagPage(props);
    const selectedTags = Array.isArray(props?.selectedTagsOverride) ? props.selectedTagsOverride : [];
    return <div data-testid="tag-page-mock">{selectedTags.join(' + ')}</div>;
  },
}));

jest.mock('react-simple-maps', () => ({
  ComposableMap: ({ children }: any) => <div data-testid="mock-composable-map">{children}</div>,
  Geographies: ({ children }: any) =>
    children({
      geographies: [
        { rsmKey: 'usa', properties: { name: 'United States of America' } },
        { rsmKey: 'gbr', properties: { name: 'United Kingdom' } },
        { rsmKey: 'ind', properties: { name: 'India' } },
        { rsmKey: 'chn', properties: { name: 'China' } },
      ],
    }),
  Geography: ({ children, geography }: any) => (
    <div data-testid={`mock-geo-${geography.properties.name}`}>{children}</div>
  ),
  Sphere: () => null,
  Graticule: () => null,
}));

const originalMatchMedia = window.matchMedia;
const originalFetch = global.fetch;
const fullCrossCorpusPayload = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../../../ai-discourse-corpus/corpuses/cross-corpus-debates.json'), 'utf8'),
);

const setMobileViewport = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => {
      const listeners = new Set<(event: Event) => void>();

      return {
        matches: query === '(max-width: 720px)' ? matches : false,
        media: query,
        onchange: null,
        addEventListener: jest.fn((eventName: string, listener: (event: Event) => void) => {
          if (eventName === 'change') listeners.add(listener);
        }),
        removeEventListener: jest.fn((eventName: string, listener: (event: Event) => void) => {
          if (eventName === 'change') listeners.delete(listener);
        }),
        addListener: jest.fn((listener: (event: Event) => void) => listeners.add(listener)),
        removeListener: jest.fn((listener: (event: Event) => void) => listeners.delete(listener)),
        dispatchEvent: jest.fn((event: Event) => {
          listeners.forEach((listener) => listener(event));
          return true;
        }),
      };
    }),
  });
};

const extractMediaBlock = (scss: string, query: string, requiredSnippet = '') => {
  let searchFrom = 0;

  while (searchFrom < scss.length) {
    const queryIndex = scss.indexOf(query, searchFrom);
    if (queryIndex === -1) {
      return null;
    }

    const blockStart = scss.indexOf('{', queryIndex);
    if (blockStart === -1) {
      return null;
    }

    let depth = 0;
    for (let index = blockStart; index < scss.length; index += 1) {
      const char = scss[index];
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      if (depth === 0) {
        const block = scss.slice(queryIndex, index + 1);
        if (!requiredSnippet || block.includes(requiredSnippet)) {
          return block;
        }
        searchFrom = queryIndex + query.length;
        break;
      }
    }
  }

  return null;
};

const renderPolicyGlobeHarness = (entries: any[]) =>
  render(
    <PolicyGlobe entries={entries}>
      {({ filteredEntries, GlobeElement }) => (
        <div>
          {GlobeElement}
          <ol>
            {filteredEntries.map((entry) => (
              <li key={entry.id}>{entry.title}</li>
            ))}
          </ol>
        </div>
      )}
    </PolicyGlobe>,
  );

const getTabButton = (name: string) => screen.getAllByRole('button', { name })[0];

describe('CorpusViewer', () => {
  beforeEach(() => {
    mockTagPage.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: originalFetch,
    });
  });

  it('keeps the mobile tab strip, card metadata, and action rows viewport-safe', () => {
    const corpusScss = fs.readFileSync(path.join(__dirname, 'CorpusViewer.module.scss'), 'utf8');
    const mobileBlock = extractMediaBlock(corpusScss, '@media (max-width: 720px)', '.container {');
    const phoneBlock = extractMediaBlock(corpusScss, '@media (max-width: 480px)', '.container {');
    const policyScss = fs.readFileSync(path.join(__dirname, 'PolicyGlobe.module.scss'), 'utf8');
    const policyMobileBlock = extractMediaBlock(policyScss, '@media (max-width: 640px)', '.filterButton {');
    const mapScss = fs.readFileSync(path.join(__dirname, 'DemoAnalysis', 'DemoAnalysisWorkspace.module.scss'), 'utf8');
    const mapJsx = fs.readFileSync(path.join(__dirname, 'DemoAnalysis', 'WorldResultsMap.tsx'), 'utf8');
    const compactMapMobileBlock = extractMediaBlock(mapScss, '@media (max-width: 640px)', '.mapFrameCompact {');

    expect(mobileBlock).toContain('.tabButton {');
    expect(mobileBlock).toContain('.tabBar {');
    expect(mobileBlock).toContain('display: grid;');
    expect(mobileBlock).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(mobileBlock).toContain('overflow: visible;');
    expect(mobileBlock).toContain('max-width: none;');
    expect(mobileBlock).toContain('min-width: 0;');
    expect(mobileBlock).toContain('width: 100%;');
    expect(mobileBlock).toContain('min-height: 104px;');
    expect(mobileBlock).toContain('.tabIcon {');
    expect(mobileBlock).toContain('font-size: 28px;');
    expect(mobileBlock).toContain('.tabLabel {');
    expect(mobileBlock).toContain('font-size: 18px;');
    expect(mobileBlock).toContain('line-height: 1.18;');
    expect(mobileBlock).toContain('white-space: normal;');
    expect(mobileBlock).toContain('.policyMapColumn {');
    expect(mobileBlock).toContain('order: -1;');
    expect(mobileBlock).toContain('.policyListColumn {');
    expect(mobileBlock).toContain('order: 1;');
    expect(mobileBlock).toContain('.policySplitLayout {');
    expect(mobileBlock).toContain('gap: 10px;');
    expect(mobileBlock).toContain('.policyMapLens {');
    expect(mobileBlock).toContain('padding: 0;');
    expect(mobileBlock).toContain('.tweetCard .tweetAuthorRow {');
    expect(mobileBlock).toContain('display: grid;');
    expect(mobileBlock).toContain('grid-template-columns: 44px minmax(0, 1fr);');
    expect(mobileBlock).toContain('.tweetDate {');
    expect(mobileBlock).toContain('grid-column: 2;');
    expect(mobileBlock).toContain('.cardFooter {');
    expect(mobileBlock).toContain('flex-direction: column;');
    expect(mobileBlock).toContain('.tweetPreviewControl {');
    expect(mobileBlock).toContain('margin-top: 2px;');
    expect(mobileBlock).toContain('.debateMapLink,');
    expect(mobileBlock).toContain('overflow-wrap: anywhere;');
    expect(mobileBlock).toContain('.externalLink span {');
    expect(mobileBlock).toContain('.pillRow {');
    expect(mobileBlock).toContain('width: 100%;');

    expect(phoneBlock).toContain('.tabButton {');
    expect(phoneBlock).toContain('.tabBar {');
    expect(phoneBlock).toContain('gap: 8px;');
    expect(phoneBlock).toContain('min-height: 96px;');
    expect(phoneBlock).toContain('.tabIcon {');
    expect(phoneBlock).toContain('font-size: 26px;');
    expect(phoneBlock).toContain('.tabLabel {');
    expect(phoneBlock).toContain('font-size: 17px;');
    expect(phoneBlock).toContain('line-height: 1.16;');
    expect(phoneBlock).toContain('.tweetCard .tweetAuthorRow {');
    expect(phoneBlock).toContain('grid-template-columns: 40px minmax(0, 1fr);');
    expect(phoneBlock).toContain('.tweetPreviewControl {');
    expect(phoneBlock).toContain('flex-direction: column;');
    expect(phoneBlock).toContain('.tweetPreviewButton {');
    expect(phoneBlock).toContain('width: 100%;');

    expect(policyMobileBlock).toContain('.filterButton {');
    expect(policyMobileBlock).toContain('font-size: 11px;');
    expect(policyMobileBlock).toContain('white-space: normal;');
    expect(corpusScss).toMatch(/\.tabIcon\s*{[\s\S]*?font-size:\s*24px;/);
    expect(corpusScss).toMatch(
      /\.container\s*{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?max-width:\s*100%;[\s\S]*?width:\s*100%;/,
    );
    expect(corpusScss).toMatch(
      /\.metrCard\s*{[\s\S]*?background:\s*linear-gradient\(180deg,\s*var\(--ce-text-inverse\) 0%,\s*var\(--ce-status-info-text\) 100%\);/,
    );
    expect(corpusScss).toMatch(/\.metrCard \.entrySummary\s*{[\s\S]*?color:\s*var\(--ce-document-text-muted\);/);
    expect(corpusScss).toMatch(/\.policyMapLens\s*{[\s\S]*?padding:\s*4px 4px 0;/);
    expect(corpusScss).toMatch(/\.policyMapPanel\s*{[\s\S]*?padding:\s*10px 10px 12px;/);
    expect(corpusScss).toMatch(/\.debateMapLink\s*{[\s\S]*?box-sizing:\s*border-box;/);
    expect(corpusScss).toMatch(/\.debateMapIcon\s*{[\s\S]*?font-size:\s*0\.8rem;/);
    expect(corpusScss).toMatch(/\.externalLink\s*{[\s\S]*?box-sizing:\s*border-box;/);
    expect(corpusScss).toMatch(/\.cardFooterLinks\s*{[\s\S]*?width:\s*100%;/);
    expect(corpusScss).toMatch(/\.tweetActionRow\s*{[\s\S]*?justify-content:\s*flex-start;/);
    expect(mapScss).toMatch(/\.mapFrameCompact\s*{[\s\S]*?width:\s*100%;[\s\S]*?padding:\s*0;/);
    expect(mapScss).toMatch(
      /\.mapFrameCompact\s*{[\s\S]*?:global\(svg\)\s*{[\s\S]*?display:\s*block;[\s\S]*?max-width:\s*none;[\s\S]*?width:\s*100%;/,
    );
    expect(compactMapMobileBlock).toContain('.mapFrameCompact {');
    expect(compactMapMobileBlock).toContain('padding-top: 0;');
    expect(compactMapMobileBlock).toContain('.mapFrameCompact :global(svg) {');
    expect(compactMapMobileBlock).toContain('max-width: none;');
    expect(mapJsx).toMatch(
      /projectionConfig=\{\{\s*rotate:\s*\[-10,\s*0,\s*0\],\s*scale:\s*compact \? 147 : 147\s*\}\}/,
    );
  });

  it('defaults to Cross-Corpus and loads the richer active corpus from GitHub on demand', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => fullCrossCorpusPayload,
    });
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: fetchMock,
    });

    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    expect(getTabButton('Cross-Corpus')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Is AI Progress Actually Exponential?')).toBeInTheDocument();
    expect(screen.queryByText(/Shared ground: 3 confirmed agreements/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-context-load-full-corpus'));

    await waitFor(() => {
      expect(screen.getAllByText(/Shared ground: 3 confirmed agreements/i).length).toBeGreaterThan(0);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/ai-discourse-corpus/corpuses/cross-corpus-debates.json',
      { cache: 'no-store' },
    );
    expect(screen.getByTestId('ce-context-corpus-status')).toHaveTextContent(
      'Loaded full Cross-Corpus corpus • 16 entries',
    );
    expect(screen.getByTestId('ce-context-load-full-corpus')).toBeDisabled();
  });

  it('shows only the first five tweets behind a mobile View more control', () => {
    setMobileViewport(true);

    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tweets' }));

    expect(screen.getByTestId('ce-context-tweet-list').querySelectorAll('article')).toHaveLength(5);
    expect(screen.queryByText('@sama')).not.toBeInTheDocument();
    expect(screen.getByText('5 of 25 tweets shown')).toBeInTheDocument();

    const viewMoreButton = screen.getByTestId('ce-context-tweets-view-more');
    expect(viewMoreButton).toHaveTextContent('View more');
    expect(viewMoreButton).toHaveAttribute('aria-controls', 'ce-context-tweet-list');
    expect(viewMoreButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(viewMoreButton);

    expect(screen.getByTestId('ce-context-tweet-list').querySelectorAll('article')).toHaveLength(25);
    expect(screen.getByText('@sama')).toBeInTheDocument();
    expect(screen.getByText('Showing all 25 tweets')).toBeInTheDocument();
    expect(screen.getByTestId('ce-context-tweets-view-more')).toHaveTextContent('Show fewer');
    expect(screen.getByTestId('ce-context-tweets-view-more')).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByTestId('ce-context-tweets-view-more'));

    expect(screen.getByTestId('ce-context-tweet-list').querySelectorAll('article')).toHaveLength(5);
    expect(screen.queryByText('@sama')).not.toBeInTheDocument();
    expect(screen.getByText('5 of 25 tweets shown')).toBeInTheDocument();
  });

  it('renders every tweet without the mobile View more control on desktop', () => {
    setMobileViewport(false);

    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tweets' }));

    expect(screen.getByTestId('ce-context-tweet-list').querySelectorAll('article')).toHaveLength(25);
    expect(screen.getByText('@sama')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-context-tweets-view-more')).not.toBeInTheDocument();
    expect(screen.queryByText('5 of 25 tweets shown')).not.toBeInTheDocument();
  });

  it('resets the mobile tweet preview after switching away from Tweets', () => {
    setMobileViewport(true);

    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tweets' }));
    fireEvent.click(screen.getByTestId('ce-context-tweets-view-more'));
    expect(screen.getByTestId('ce-context-tweet-list').querySelectorAll('article')).toHaveLength(25);

    fireEvent.click(screen.getByRole('button', { name: 'Papers' }));
    expect(screen.queryByTestId('ce-context-tweets-view-more')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tweets' }));

    expect(screen.getByTestId('ce-context-tweet-list').querySelectorAll('article')).toHaveLength(5);
    expect(screen.queryByText('@sama')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-context-tweets-view-more')).toHaveTextContent('View more');
    expect(screen.getByTestId('ce-context-tweets-view-more')).toHaveAttribute('aria-expanded', 'false');
  });

  it('maps legacy tweet debate tags into atlas issue links', () => {
    render(
      <MemoryRouter initialEntries={['/session/demo']}>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tweets' }));

    const issueLink = screen.getAllByRole('link', { name: 'Exponential Progress Debate' })[0];
    const tweetCard = issueLink.closest('article') as HTMLElement;

    expect(tweetCard).toBeTruthy();
    expect(within(tweetCard).getByRole('link', { name: 'Exponential Progress Debate' })).toBeInTheDocument();
    expect(issueLink).toHaveAttribute(
      'href',
      '/atlas/0x2110000000000000000000000000000000000000000000000000000000000000?demo=1&returnTo=%2Fsession%2Fdemo',
    );
  });

  it('keeps atlas node links and the source action on the same tweet action row', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tweets' }));

    const issueLink = screen.getAllByRole('link', { name: 'Exponential Progress Debate' })[0];
    const actionRow = issueLink.parentElement as HTMLElement;

    expect(actionRow).toBeTruthy();
    expect(within(actionRow).getByRole('link', { name: 'View post' })).toBeInTheDocument();
    expect(issueLink.querySelector('svg[data-icon="atlas"]')).not.toBeNull();
  });

  it('routes atlas issue clicks through the session callback when provided', () => {
    const onAtlasIssueOpen = jest.fn();

    render(
      <MemoryRouter>
        <CorpusViewer onAtlasIssueOpen={onAtlasIssueOpen} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tweets' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Exponential Progress Debate' })[0]);

    expect(onAtlasIssueOpen).toHaveBeenCalledWith('0x2110000000000000000000000000000000000000000000000000000000000000');
    expect(screen.queryByRole('link', { name: 'Exponential Progress Debate' })).not.toBeInTheDocument();
  });

  it('hides the standalone GitHub corpus link when embedded in another header', () => {
    render(
      <MemoryRouter>
        <CorpusViewer showGithubLink={false} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: /Full corpus on GitHub/i })).not.toBeInTheDocument();
  });

  it('reports active corpus load state and responds to external load requests when embedded under another header', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => fullCrossCorpusPayload,
    });
    const onExternalLoadStateChange = jest.fn();
    Object.defineProperty(global, 'fetch', {
      writable: true,
      value: fetchMock,
    });

    const { rerender } = render(
      <MemoryRouter>
        <CorpusViewer
          showGithubLink={false}
          externalLoadRequestNonce={0}
          onExternalLoadStateChange={onExternalLoadStateChange}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(onExternalLoadStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          activeCorpusKey: 'cross_corpus',
          activeCorpusLabel: 'Cross-Corpus',
          loadStatus: 'idle',
          loadButtonLabel: 'Load full corpus',
          disableLoadButton: false,
        }),
      );
    });

    rerender(
      <MemoryRouter>
        <CorpusViewer
          showGithubLink={false}
          externalLoadRequestNonce={1}
          onExternalLoadStateChange={onExternalLoadStateChange}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/AgalmicSoftware/context-engine/main/ai-discourse-corpus/corpuses/cross-corpus-debates.json',
        { cache: 'no-store' },
      );
    });

    await waitFor(() => {
      expect(onExternalLoadStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          activeCorpusKey: 'cross_corpus',
          loadStatus: 'loaded',
          loadButtonLabel: 'Full corpus loaded',
          disableLoadButton: true,
        }),
      );
    });
  });

  it('renders the standalone GitHub corpus link against the canonical public repo', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Full corpus on GitHub/i })).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/tree/main/ai-discourse-corpus',
    );
  });

  it('renders arxiv entries with the arxiv-specific card layout', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Papers' }));

    const title = screen.getByText('Language Models are Few-Shot Learners');
    const arxivCard = title.closest('article') as HTMLElement;

    expect(screen.getByText('arXiv:2005.14165')).toBeInTheDocument();
    expect(arxivCard).toBeTruthy();
    expect(within(arxivCard).getByRole('link', { name: 'View paper' })).toHaveAttribute(
      'href',
      'https://arxiv.org/abs/2005.14165',
    );
  });

  it('renders LessWrong entries with their novel argument context visible', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(getTabButton('LessWrong'));

    const title = screen.getByText('The AI-Box Experiment');
    const lessWrongCard = title.closest('article') as HTMLElement;

    expect(lessWrongCard).toBeTruthy();
    expect(within(lessWrongCard).getByText('Novel argument')).toBeInTheDocument();
    expect(within(lessWrongCard).getByRole('link', { name: 'View source' })).toHaveAttribute(
      'href',
      'https://www.yudkowsky.net/singularity/aibox',
    );
  });

  it('renders cross-corpus debate entries with synthesis metadata and dataset links', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(getTabButton('Cross-Corpus'));

    const title = screen.getByText('Is AI Progress Actually Exponential?');
    const crossCorpusCard = title.closest('article') as HTMLElement;

    expect(crossCorpusCard).toBeTruthy();
    expect(within(crossCorpusCard).getByText('Central tension')).toBeInTheDocument();
    expect(within(crossCorpusCard).getByText(/Synthesizes: METR • Dwarkesh • LessWrong/i)).toBeInTheDocument();
    expect(within(crossCorpusCard).getByRole('link', { name: 'Open dataset' })).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/blob/main/ai-discourse-corpus/corpuses/cross-corpus-debates.json',
    );
  });

  it('keeps curated paper entries in featured-first order on the Papers tab', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Papers' }));

    const firstFeaturedTitle = screen.getByText('Language Models are Few-Shot Learners');
    const secondFeaturedTitle = screen.getByText('GPT-4 Technical Report');
    const thirdFeaturedTitle = screen.getByText('Attention Is All You Need');

    expect(
      firstFeaturedTitle.compareDocumentPosition(secondFeaturedTitle) & window.Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      secondFeaturedTitle.compareDocumentPosition(thirdFeaturedTitle) & window.Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('sorts policy entries with live items first and filters them by status', () => {
    renderPolicyGlobeHarness([
      {
        id: 'us-live',
        title: 'US Executive Order',
        jurisdiction: 'US',
        status: 'enacted',
        date_enacted: '2023-10-30',
      },
      {
        id: 'uk-proposed',
        title: 'UK Draft Bill',
        jurisdiction: 'UK',
        status: 'proposed',
        date: '2025-01-15',
      },
      {
        id: 'california-vetoed',
        title: 'California SB 1047',
        jurisdiction: 'California, United States',
        status: 'vetoed',
        date: '2024-09-29',
      },
      {
        id: 'brazil-committee',
        title: 'Brazil AI Bill',
        jurisdiction: 'Brazil',
        status: 'in_committee',
        date: '2025-03-17',
      },
      {
        id: 'eu-live',
        title: 'EU AI Act',
        jurisdiction: 'EU',
        status: 'live',
        date_enacted: '2024-08-01',
      },
    ]);

    expect(screen.getByTestId('ce-policy-globe')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'EU AI Act',
      'US Executive Order',
      'Brazil AI Bill',
      'UK Draft Bill',
      'California SB 1047',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Proposed' }));

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Brazil AI Bill',
      'UK Draft Bill',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Live' }));

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'EU AI Act',
      'US Executive Order',
    ]);

    expect(screen.queryByText('California SB 1047')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Inactive' }));

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['California SB 1047']);
  });

  it('renders the policy filter row and lightweight world map on the Laws & Policy tab', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Insider Interviews' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Laws & Policy' }));

    expect(screen.getByTestId('ce-policy-split-layout')).toBeInTheDocument();
    expect(screen.getByTestId('demo-analysis-world-map')).toBeInTheDocument();
    expect(screen.getAllByText(/ASEAN Guide on AI Governance and Ethics/i).length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('ce-policy-filter-row')).getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(within(screen.getByTestId('ce-policy-filter-row')).getByRole('button', { name: 'Proposed' }));

    expect(screen.getByText(/Brazil AI Bill/i)).toBeInTheDocument();
    expect(screen.queryByText(/Safe and Secure Innovation for Frontier AI/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('demo-analysis-world-map')).toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId('ce-policy-filter-row')).getByRole('button', { name: 'Inactive' }));

    expect(screen.getByText(/Safe and Secure Innovation for Frontier AI/i)).toBeInTheDocument();
    expect(screen.queryByText(/Brazil AI Bill/i)).not.toBeInTheDocument();
  });

  it('renders insider interview cards when the Insider Interviews tab is selected', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Insider Interviews' }));

    expect(screen.getAllByText(/Interview date:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'View interview' }).length).toBeGreaterThan(0);
  });

  it('keeps the first insider interview slots diversified when the same guest has multiple entries', () => {
    const { container } = render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Insider Interviews' }));

    const insiderCards = Array.from(container.querySelectorAll('article'));

    expect(insiderCards[0]?.textContent).toContain('Dario Amodei');
    expect(insiderCards[1]?.textContent).toContain('Demis Hassabis');
    expect(insiderCards[2]?.textContent).toContain('Dario Amodei');
  });

  it('keeps curated insider interview links as absolute external URLs', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Insider Interviews' }));

    const ai2027Card = screen.getByText('Daniel Kokotajlo & Scott Alexander').closest('article') as HTMLElement;
    const interviewLinks = screen.getAllByRole('link', { name: 'View interview' });

    expect(ai2027Card).toBeTruthy();
    expect(within(ai2027Card).getByRole('link', { name: 'View interview' })).toHaveAttribute(
      'href',
      'https://www.dwarkesh.com/p/scott-daniel',
    );
    expect(interviewLinks.map((link) => link.getAttribute('href'))).toEqual(
      expect.arrayContaining(['https://www.dwarkesh.com/p/scott-daniel', 'https://www.dwarkesh.com/p/satya-nadella-2']),
    );
  });

  it('renders METR entries with linked chart preview images when available', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Metrics' }));

    const previewImage = screen.getByAltText('Measuring AI Ability to Complete Long Tasks');
    const metrCard = previewImage.closest('article') as HTMLElement;

    expect(previewImage).toHaveAttribute(
      'src',
      'https://metr.org/assets/images/measuring-ai-ability-to-complete-long-tasks/models-are-succeeding-at-increasingly-long-tasks.png',
    );
    expect(within(metrCard).getByRole('link', { name: 'Open full report' })).toHaveAttribute(
      'href',
      'https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/',
    );
  });

  it('opens the tag modal with the clicked tweet tag as TagPage filter context', () => {
    render(
      <MemoryRouter initialEntries={['/session/demo']}>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tweets' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Google' })[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('tag-page-mock')).toHaveTextContent('Google');
    expect(screen.getByText('Tag explorer')).toBeInTheDocument();
    expect(screen.queryByText('#Google')).not.toBeInTheDocument();

    const tagPageProps = mockTagPage.mock.calls.at(-1)[0];
    expect(tagPageProps).toMatchObject({
      embedded: true,
      demoCorpusMode: true,
      emptyQuestionsText: 'No questions tagged Google in this session yet.',
      selectedTagsOverride: ['Google'],
    });
    expect(Array.isArray(tagPageProps.demoCorpusRecords)).toBe(true);
    expect(tagPageProps.demoCorpusRecords.length).toBeGreaterThan(0);
  });

  it('opens the tag modal from generic corpus entry tags', () => {
    render(
      <MemoryRouter initialEntries={['/session/demo']}>
        <CorpusViewer />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Laws & Policy' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'AI Governance' })[0]);

    const tagPageProps = mockTagPage.mock.calls.at(-1)[0];
    expect(tagPageProps.demoCorpusMode).toBe(true);
    expect(tagPageProps.selectedTagsOverride).toEqual(['AI Governance']);
    expect(screen.getByTestId('tag-page-mock')).toHaveTextContent('AI Governance');
  });
});
