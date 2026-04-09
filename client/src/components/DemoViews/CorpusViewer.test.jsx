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
      'California SB 1047',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Live' }));

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'EU AI Act',
      'US Executive Order',
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

    expect(screen.getByText(/Safe and Secure Innovation for Frontier AI/i)).toBeInTheDocument();
    expect(screen.getByText(/Brazil AI Bill/i)).toBeInTheDocument();
    expect(screen.getByTestId('demo-analysis-world-map')).toBeInTheDocument();
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
