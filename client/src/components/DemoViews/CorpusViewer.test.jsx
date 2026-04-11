import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockTagPage = jest.fn();

jest.mock('../TagPage/TagPage.jsx', () => ({
  __esModule: true,
  default: (props) => {
    mockTagPage(props);
    const selectedTags = Array.isArray(props?.selectedTagsOverride) ? props.selectedTagsOverride : [];
    return (
      <div data-testid="tag-page-mock">
        {selectedTags.join(' + ')}
      </div>
    );
  },
}));

jest.mock('react-simple-maps', () => ({
  ComposableMap: ({ children }) => <div data-testid="mock-composable-map">{children}</div>,
  Geographies: ({ children }) => children({
    geographies: [
      { rsmKey: 'usa', properties: { name: 'United States of America' } },
      { rsmKey: 'gbr', properties: { name: 'United Kingdom' } },
      { rsmKey: 'ind', properties: { name: 'India' } },
      { rsmKey: 'chn', properties: { name: 'China' } },
    ],
  }),
  Geography: ({ children, geography }) => (
    <div data-testid={`mock-geo-${geography.properties.name}`}>
      {children}
    </div>
  ),
  Sphere: () => null,
  Graticule: () => null,
}));

import CorpusViewer from './CorpusViewer.jsx';
import PolicyGlobe from './PolicyGlobe.jsx';

const extractMediaBlock = (scss, query, requiredSnippet = '') => {
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

const renderPolicyGlobeHarness = (entries) => render(
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
  </PolicyGlobe>
);

describe('CorpusViewer', () => {
  beforeEach(() => {
    mockTagPage.mockClear();
  });

  it('keeps the mobile tab strip, card metadata, and action rows viewport-safe', () => {
    const corpusScss = fs.readFileSync(path.join(__dirname, 'CorpusViewer.module.scss'), 'utf8');
    const mobileBlock = extractMediaBlock(corpusScss, '@media (max-width: 720px)', '.container {');
    const phoneBlock = extractMediaBlock(corpusScss, '@media (max-width: 480px)', '.container {');
    const policyScss = fs.readFileSync(path.join(__dirname, 'PolicyGlobe.module.scss'), 'utf8');
    const policyMobileBlock = extractMediaBlock(policyScss, '@media (max-width: 640px)', '.filterButton {');
    const mapScss = fs.readFileSync(
      path.join(__dirname, 'DemoAnalysis', 'DemoAnalysisWorkspace.module.scss'),
      'utf8'
    );
    const mapJsx = fs.readFileSync(
      path.join(__dirname, 'DemoAnalysis', 'WorldResultsMap.jsx'),
      'utf8'
    );
    const compactMapMobileBlock = extractMediaBlock(mapScss, '@media (max-width: 640px)', '.panel,');

    expect(mobileBlock).toContain('.tabButton {');
    expect(mobileBlock).toContain('.tabBar {');
    expect(mobileBlock).toContain('display: grid;');
    expect(mobileBlock).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(mobileBlock).toContain('overflow: visible;');
    expect(mobileBlock).toContain('max-width: none;');
    expect(mobileBlock).toContain('min-width: 0;');
    expect(mobileBlock).toContain('width: 100%;');
    expect(mobileBlock).toContain('.tabIcon {');
    expect(mobileBlock).toContain('font-size: 28px;');
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
    expect(mobileBlock).toContain('.debateMapLink,');
    expect(mobileBlock).toContain('overflow-wrap: anywhere;');
    expect(mobileBlock).toContain('.externalLink span {');
    expect(mobileBlock).toContain('.pillRow {');
    expect(mobileBlock).toContain('width: 100%;');

    expect(phoneBlock).toContain('.tabButton {');
    expect(phoneBlock).toContain('.tabBar {');
    expect(phoneBlock).toContain('gap: 8px;');
    expect(phoneBlock).toContain('min-height: 78px;');
    expect(phoneBlock).toContain('.tabIcon {');
    expect(phoneBlock).toContain('font-size: 26px;');
    expect(phoneBlock).toContain('.tweetCard .tweetAuthorRow {');
    expect(phoneBlock).toContain('grid-template-columns: 40px minmax(0, 1fr);');

    expect(policyMobileBlock).toContain('.filterButton {');
    expect(policyMobileBlock).toContain('font-size: 11px;');
    expect(policyMobileBlock).toContain('white-space: normal;');
    expect(corpusScss).toMatch(/\.tabIcon\s*{[\s\S]*?font-size:\s*24px;/);
    expect(corpusScss).toMatch(/\.container\s*{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?max-width:\s*100%;[\s\S]*?width:\s*100%;/);
    expect(corpusScss).toMatch(/\.policyMapLens\s*{[\s\S]*?padding:\s*4px 4px 0;/);
    expect(corpusScss).toMatch(/\.policyMapPanel\s*{[\s\S]*?padding:\s*10px 10px 12px;/);
    expect(corpusScss).toMatch(/\.debateMapLink\s*{[\s\S]*?box-sizing:\s*border-box;/);
    expect(corpusScss).toMatch(/\.externalLink\s*{[\s\S]*?box-sizing:\s*border-box;/);
    expect(corpusScss).toMatch(/\.cardFooterLinks\s*{[\s\S]*?width:\s*100%;/);
    expect(mapScss).toMatch(/\.mapFrameCompact\s*{[\s\S]*?width:\s*100%;[\s\S]*?padding:\s*0;/);
    expect(mapScss).toMatch(/\.mapFrameCompact\s*{[\s\S]*?:global\(svg\)\s*{[\s\S]*?display:\s*block;[\s\S]*?max-width:\s*none;[\s\S]*?width:\s*100%;/);
    expect(compactMapMobileBlock).toContain('.mapFrameCompact {');
    expect(compactMapMobileBlock).toContain('padding-top: 0;');
    expect(compactMapMobileBlock).toContain('.mapFrameCompact :global(svg) {');
    expect(compactMapMobileBlock).toContain('max-width: none;');
    expect(mapJsx).toMatch(/projectionConfig=\{\{\s*rotate:\s*\[-10,\s*0,\s*0\],\s*scale:\s*compact \? 147 : 147\s*\}\}/);
  });

  it('maps legacy tweet debate tags into atlas issue links', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>
    );

    const issueLink = screen.getAllByRole('link', { name: 'Exponential Progress Debate' })[0];
    const tweetCard = issueLink.closest('article');

    expect(tweetCard).toBeTruthy();
    expect(within(tweetCard).getByRole('link', { name: 'Exponential Progress Debate' })).toBeInTheDocument();
    expect(issueLink).toHaveAttribute(
      'href',
      '/atlas/0x2110000000000000000000000000000000000000000000000000000000000000?demo=1'
    );
  });

  it('routes atlas issue clicks through the session callback when provided', () => {
    const onAtlasIssueOpen = jest.fn();

    render(
      <MemoryRouter>
        <CorpusViewer onAtlasIssueOpen={onAtlasIssueOpen} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Exponential Progress Debate' })[0]);

    expect(onAtlasIssueOpen).toHaveBeenCalledWith(
      '0x2110000000000000000000000000000000000000000000000000000000000000'
    );
    expect(screen.queryByRole('link', { name: 'Exponential Progress Debate' })).not.toBeInTheDocument();
  });

  it('hides the standalone GitHub corpus link when embedded in another header', () => {
    render(
      <MemoryRouter>
        <CorpusViewer showGithubLink={false} />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: /Full corpus on GitHub/i })).not.toBeInTheDocument();
  });

  it('renders arxiv entries with the arxiv-specific card layout', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Papers' }));

    const title = screen.getByText('Language Models are Few-Shot Learners');
    const arxivCard = title.closest('article');

    expect(screen.getByText('arXiv:2005.14165')).toBeInTheDocument();
    expect(arxivCard).toBeTruthy();
    expect(within(arxivCard).getByRole('link', { name: 'View paper' })).toHaveAttribute(
      'href',
      'https://arxiv.org/abs/2005.14165'
    );
  });

  it('keeps curated paper entries in featured-first order on the Papers tab', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Papers' }));

    const firstFeaturedTitle = screen.getByText('Language Models are Few-Shot Learners');
    const secondFeaturedTitle = screen.getByText('GPT-4 Technical Report');
    const thirdFeaturedTitle = screen.getByText('Attention Is All You Need');

    expect(
      firstFeaturedTitle.compareDocumentPosition(secondFeaturedTitle) & window.Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      secondFeaturedTitle.compareDocumentPosition(thirdFeaturedTitle) & window.Node.DOCUMENT_POSITION_FOLLOWING
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

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'California SB 1047',
    ]);
  });

  it('renders the policy filter row and lightweight world map on the Laws & Policy tab', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Insider Interviews' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Laws & Policy' }));

    expect(screen.getByTestId('ce-policy-split-layout')).toBeInTheDocument();
    expect(screen.getByTestId('demo-analysis-world-map')).toBeInTheDocument();
    expect(screen.getAllByText(/ASEAN Guide on AI Governance and Ethics/i).length).toBeGreaterThan(0);
    expect(
      within(screen.getByTestId('ce-policy-filter-row')).getByRole('button', { name: 'All' })
    ).toHaveAttribute('aria-pressed', 'true');

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
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Insider Interviews' }));

    expect(screen.getAllByText(/Interview date:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'View interview' }).length).toBeGreaterThan(0);
  });

  it('keeps the first insider interview slots diversified when the same guest has multiple entries', () => {
    const { container } = render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>
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
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Insider Interviews' }));

    const ai2027Card = screen.getByText('Daniel Kokotajlo & Scott Alexander').closest('article');
    const interviewLinks = screen.getAllByRole('link', { name: 'View interview' });

    expect(ai2027Card).toBeTruthy();
    expect(within(ai2027Card).getByRole('link', { name: 'View interview' })).toHaveAttribute(
      'href',
      'https://www.dwarkesh.com/p/scott-daniel'
    );
    expect(interviewLinks.map((link) => link.getAttribute('href'))).toEqual(
      expect.arrayContaining([
        'https://www.dwarkesh.com/p/scott-daniel',
        'https://www.dwarkesh.com/p/satya-nadella-2',
      ])
    );
  });

  it('renders METR entries with linked chart preview images when available', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Metrics' }));

    const previewImage = screen.getByAltText('Measuring AI Ability to Complete Long Tasks');
    const metrCard = previewImage.closest('article');

    expect(previewImage).toHaveAttribute(
      'src',
      'https://metr.org/assets/images/measuring-ai-ability-to-complete-long-tasks/models-are-succeeding-at-increasingly-long-tasks.png'
    );
    expect(within(metrCard).getByRole('link', { name: 'Open full report' })).toHaveAttribute(
      'href',
      'https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/'
    );
  });

  it('opens the tag modal with the clicked tweet tag as TagPage filter context', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Google' })[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('tag-page-mock')).toHaveTextContent('Google');
    expect(screen.getByText('#Google')).toBeInTheDocument();

    const tagPageProps = mockTagPage.mock.calls.at(-1)[0];
    expect(tagPageProps).toMatchObject({
      embedded: true,
      emptyQuestionsText: 'No questions tagged Google in this session yet.',
      selectedTagsOverride: ['Google'],
    });
  });

  it('opens the tag modal from generic corpus entry tags', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Laws & Policy' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'AI Governance' })[0]);

    const tagPageProps = mockTagPage.mock.calls.at(-1)[0];
    expect(tagPageProps.selectedTagsOverride).toEqual(['AI Governance']);
    expect(screen.getByText('#AI Governance')).toBeInTheDocument();
  });
});
