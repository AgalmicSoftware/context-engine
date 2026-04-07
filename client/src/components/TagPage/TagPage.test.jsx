import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { MemoryRouter } from 'react-router-dom';
import fs from 'fs';
import path from 'path';
import TagPage from './TagPage.jsx';

const mockListNamespaceEntriesSync = jest.fn();
const mockSubscribeCacheUpdates = jest.fn(() => () => {});
const mockGetAllSessionSlugs = jest.fn();
const mockGetSessionConfigBySlug = jest.fn();
const mockGetDemoSessionConfigBySlug = jest.fn();
const mockCallAI = jest.fn();

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  __esModule: true,
  listNamespaceEntriesSync: (...args) => mockListNamespaceEntriesSync(...args),
  peekCacheSync: jest.fn(() => null),
  subscribeCacheUpdates: (...args) => mockSubscribeCacheUpdates(...args),
}));

jest.mock('../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  getAllSessionSlugs: (...args) => mockGetAllSessionSlugs(...args),
  getSessionConfigBySlug: (...args) => mockGetSessionConfigBySlug(...args),
  getDemoSessionConfigBySlug: (...args) => mockGetDemoSessionConfigBySlug(...args),
}));

jest.mock('../../utilities/ai/aiScripts.js', () => ({
  __esModule: true,
  callAI: (...args) => mockCallAI(...args),
}));

const createTagPageStore = (sessionStateOverrides = {}) => createStore(
  (state = {
    profile: {
      network: { id: 84532 },
    },
    sessionState: {
      activeSessionSlug: 'edge',
      primarySessionSlug: 'edge',
      primarySessionExplicit: false,
      selectedSessionScope: 'active',
      selectedSessionSlugs: [],
      ...sessionStateOverrides,
    },
  }) => state
);

const buildQuestionsEntry = ({
  slug = 'edge',
  questions = {},
  questionResponses = {},
} = {}) => ({
  namespace: 'questionsCache',
  slug,
  key: `dg:questionsCache:${slug || 'general'}`,
  value: {
    '84532': {
      questions,
      questionResponses,
    },
  },
});

const renderTagPage = ({
  entry = '/tag/governance',
  isQuestionCacheReady = true,
  sessionState = {},
  tagPageProps = {},
} = {}) => render(
  <Provider store={createTagPageStore(sessionState)}>
    <MemoryRouter initialEntries={[entry]}>
      <TagPage
        questionResponsesNonce={0}
        isQuestionCacheReady={isQuestionCacheReady}
        {...tagPageProps}
      />
    </MemoryRouter>
  </Provider>
);

describe('TagPage', () => {
  beforeEach(() => {
    mockSubscribeCacheUpdates.mockReturnValue(() => {});
    mockGetAllSessionSlugs.mockReturnValue(['', 'edge', 'alpha', 'beta']);
    mockGetSessionConfigBySlug.mockReturnValue(null);
    mockGetDemoSessionConfigBySlug.mockReturnValue(null);
    mockCallAI.mockResolvedValue('Mocked interpretation');
    mockListNamespaceEntriesSync.mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return [];
      return [
        buildQuestionsEntry({
          slug: 'edge',
          questions: {
            q1: {
              id: 'q1',
              prompt: 'What changed?',
              tags: ['governance', 'ai'],
            },
            q2: {
              id: 'q2',
              prompt: 'Something else',
              tags: ['culture'],
            },
          },
          questionResponses: {
            q1: {
              '0x111': {},
            },
          },
        }),
      ];
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    renderTagPage({ entry: '/tag/governance+ai' });

    expect(screen.getByRole('heading', { name: /questions tagged with/i })).toBeInTheDocument();
    expect(screen.getByText('What changed?')).toBeInTheDocument();
    expect(screen.getByText('1 response')).toBeInTheDocument();
    expect(screen.getByTitle('View question page')).toHaveAttribute('href', '/question/q1?session=edge');
    expect(screen.queryByRole('heading', { name: 'Documents' })).not.toBeInTheDocument();
  });

  it('keeps section headers high-contrast on the dark tag page surface', () => {
    const scssPath = path.join(__dirname, 'TagPage.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.sectionTitle\s*{[\s\S]*?color:\s*\$page-text-color;/);
  });

  it('displays tag pills from the URL', () => {
    renderTagPage({ entry: '/tag/governance+AI%20Policy' });

    expect(screen.getByRole('button', { name: /remove governance tag/i })).toHaveTextContent('#governance');
    expect(screen.getByRole('button', { name: /remove AI Policy tag/i })).toHaveTextContent('#AI Policy');
  });

  it('supports an embedded tag selection override with a custom empty question state', () => {
    mockListNamespaceEntriesSync.mockImplementation(() => []);

    renderTagPage({
      entry: '/demo/corpus-viewer',
      tagPageProps: {
        embedded: true,
        emptyQuestionsText: 'No questions tagged AI Governance in this session yet.',
        selectedTagsOverride: ['AI Governance'],
      },
    });

    expect(screen.getByRole('button', { name: /remove AI Governance tag/i })).toHaveTextContent('#AI Governance');
    expect(screen.getByText('No questions tagged AI Governance in this session yet.')).toBeInTheDocument();
  });

  it('only offers comparison tags that co-occur with the current result set', () => {
    renderTagPage({ entry: '/tag/governance' });

    fireEvent.click(screen.getByRole('button', { name: /add tag to comparison/i }));

    const dialog = screen.getByRole('dialog', { name: /add tag to comparison/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /add ai tag to comparison/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /add culture tag to comparison/i })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /add ai tag to comparison/i }));

    expect(screen.getByRole('button', { name: /remove ai tag/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /add tag to comparison/i })).not.toBeInTheDocument();
  });

  it('treats trailing-slash tag routes the same as canonical tag routes', () => {
    renderTagPage({ entry: '/tag/governance/' });

    expect(screen.getByText('What changed?')).toBeInTheDocument();
  });

  it('inherits the global session list scope when no explicit query pin is present', () => {
    mockListNamespaceEntriesSync.mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return [];
      return [
        buildQuestionsEntry({
          slug: 'edge',
          questions: {
            q1: {
              id: 'q1',
              prompt: 'Edge governance question',
              tags: ['governance'],
            },
          },
        }),
        buildQuestionsEntry({
          slug: 'alpha',
          questions: {
            q2: {
              id: 'q2',
              prompt: 'Alpha governance question',
              tags: ['governance'],
            },
          },
        }),
        buildQuestionsEntry({
          slug: 'beta',
          questions: {
            q3: {
              id: 'q3',
              prompt: 'Beta governance question',
              tags: ['governance'],
            },
          },
        }),
      ];
    });

    renderTagPage({
      entry: '/tag/governance',
      sessionState: {
        activeSessionSlug: 'edge',
        primarySessionSlug: 'edge',
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['edge', 'alpha'],
      },
    });

    expect(screen.getByText('Edge governance question')).toBeInTheDocument();
    expect(screen.getByText('Alpha governance question')).toBeInTheDocument();
    expect(screen.queryByText('Beta governance question')).not.toBeInTheDocument();
    expect(screen.getByTestId('tag-page-session-scope')).toHaveTextContent('Session scope: edge + alpha');
    expect(screen.getAllByTitle('View question page').map((node) => node.getAttribute('href'))).toEqual([
      '/question/q2?session=alpha',
      '/question/q1?session=edge',
    ]);
  });

  it('supports a local session override from the cog selector and can reset back to the global scope', () => {
    mockListNamespaceEntriesSync.mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return [];
      return [
        buildQuestionsEntry({
          slug: 'edge',
          questions: {
            q1: {
              id: 'q1',
              prompt: 'Edge governance question',
              tags: ['governance'],
            },
          },
        }),
        buildQuestionsEntry({
          slug: 'alpha',
          questions: {
            q2: {
              id: 'q2',
              prompt: 'Alpha governance question',
              tags: ['governance'],
            },
          },
        }),
      ];
    });

    renderTagPage({
      entry: '/tag/governance',
      sessionState: {
        activeSessionSlug: 'edge',
        primarySessionSlug: 'edge',
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['edge', 'alpha'],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /tag page session selector/i }));
    expect(screen.getByText(/using the global session list by default/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^alpha$/i }));

    expect(screen.queryByText('Edge governance question')).not.toBeInTheDocument();
    expect(screen.getByText('Alpha governance question')).toBeInTheDocument();
    expect(screen.getByTestId('tag-page-session-scope')).toHaveTextContent('Session scope: alpha (override)');

    fireEvent.click(screen.getByRole('button', { name: /tag page session selector/i }));
    fireEvent.click(screen.getByRole('button', { name: /use global default/i }));

    expect(screen.getByText('Edge governance question')).toBeInTheDocument();
    expect(screen.getByText('Alpha governance question')).toBeInTheDocument();
    expect(screen.getByTestId('tag-page-session-scope')).toHaveTextContent('Session scope: edge + alpha');
  });

  it('refreshes selector options when the session registry cache updates', () => {
    mockGetAllSessionSlugs.mockReturnValue(['', 'edge']);

    renderTagPage({ entry: '/tag/governance' });

    fireEvent.click(screen.getByRole('button', { name: /tag page session selector/i }));
    expect(screen.queryByRole('button', { name: /^alpha$/i })).not.toBeInTheDocument();

    act(() => {
      mockGetAllSessionSlugs.mockReturnValue(['', 'edge', 'alpha']);
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
    });

    expect(screen.getByRole('button', { name: /^alpha$/i })).toBeInTheDocument();
  });

  it('keeps explicit session query pins scoped to that session', () => {
    mockListNamespaceEntriesSync.mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return [];
      return [
        buildQuestionsEntry({
          slug: 'edge',
          questions: {
            q1: {
              id: 'q1',
              prompt: 'Edge governance question',
              tags: ['governance'],
            },
          },
        }),
        buildQuestionsEntry({
          slug: 'alpha',
          questions: {
            q2: {
              id: 'q2',
              prompt: 'Alpha governance question',
              tags: ['governance'],
            },
          },
        }),
      ];
    });

    renderTagPage({
      entry: '/tag/governance?session=edge',
      sessionState: {
        activeSessionSlug: 'alpha',
        primarySessionSlug: 'alpha',
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['alpha', 'edge'],
      },
    });

    expect(screen.getByText('Edge governance question')).toBeInTheDocument();
    expect(screen.queryByText('Alpha governance question')).not.toBeInTheDocument();
    expect(screen.getByText('Session scope: edge (URL pin)')).toBeInTheDocument();
    expect(screen.getByTitle('View question page')).toHaveAttribute('href', '/question/q1?session=edge');
  });

  it('keeps showing the loading state while question cache bootstrap is incomplete', () => {
    jest.useFakeTimers();
    mockListNamespaceEntriesSync.mockImplementation(() => []);

    renderTagPage({
      entry: '/tag/governance',
      isQuestionCacheReady: false,
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Loading questions...')).toBeInTheDocument();
    expect(screen.queryByText('No questions found.')).not.toBeInTheDocument();
  });

  it('shows "No questions found" when no questions match the selected tags', () => {
    renderTagPage({ entry: '/tag/nonexistent' });

    expect(screen.getByText('No questions found.')).toBeInTheDocument();
  });

  it('treats the general session as a valid single-session scope for AI interpretation without a documents panel', async () => {
    mockGetDemoSessionConfigBySlug.mockImplementation((slug) => (
      slug === ''
        ? {
          sessionName: 'General',
        }
        : null
    ));
    mockListNamespaceEntriesSync.mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return [];
      return [
        buildQuestionsEntry({
          slug: '',
          questions: {
            q1: {
              id: 'q1',
              prompt: 'General governance question',
              tags: ['governance'],
            },
          },
        }),
      ];
    });

    renderTagPage({
      entry: '/tag/governance',
      sessionState: {
        activeSessionSlug: '',
        primarySessionSlug: '',
        selectedSessionScope: 'general',
      },
    });
    expect(screen.queryByRole('heading', { name: 'Documents' })).not.toBeInTheDocument();

    const summarizeButton = screen.getByRole('button', { name: /summarize discussions/i });
    expect(summarizeButton).toBeEnabled();

    await act(async () => {
      fireEvent.click(summarizeButton);
    });

    expect(mockCallAI).toHaveBeenCalledWith(
      expect.stringContaining('General governance question'),
      expect.objectContaining({ sessionSlug: '' })
    );
    expect(await screen.findByText('Mocked interpretation')).toBeInTheDocument();
  });
});
