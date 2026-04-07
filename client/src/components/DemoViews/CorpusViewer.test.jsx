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
    expect(within(tweetCard).getByText('Debate Map')).toBeInTheDocument();
    expect(issueLink).toHaveAttribute(
      'href',
      '/atlas/0x2110000000000000000000000000000000000000000000000000000000000000?demo=1'
    );
  });

  it('renders arxiv entries with the arxiv-specific card layout', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Safety Papers' }));

    const title = screen.getByText('Language Models are Few-Shot Learners');
    const arxivCard = title.closest('article');

    expect(screen.getByText('[2005.14165]')).toBeInTheDocument();
    expect(arxivCard).toBeTruthy();
    expect(within(arxivCard).getByRole('link', { name: 'View paper' })).toHaveAttribute(
      'href',
      'https://arxiv.org/abs/2005.14165'
    );
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
      'UK Draft Bill',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Proposed' }));

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'UK Draft Bill',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Live' }));

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'EU AI Act',
      'US Executive Order',
    ]);
  });

  it('renders the policy globe on the Laws & Policy tab', () => {
    render(
      <MemoryRouter>
        <CorpusViewer />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Laws & Policy' }));

    expect(screen.getByTestId('ce-policy-globe')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('ce-policy-filter-row')).getByRole('button', { name: 'All' })
    ).toHaveAttribute('aria-pressed', 'true');
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
