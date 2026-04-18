import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { MemoryRouter } from 'react-router-dom';
import fs from 'fs';
import path from 'path';
import TagPage from './TagPage.jsx';
import TagModal from './TagModal.jsx';
import { buildDemoCorpusRecords } from '../../utilities/demo/demoCorpusRecords.js';

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

jest.mock('reactstrap', () => {
  const actual = jest.requireActual('reactstrap');

  return {
    ...actual,
    Modal: ({
      isOpen,
      children,
      modalClassName,
      contentClassName,
      backdropClassName,
      wrapClassName,
    }) => (isOpen ? (
      <div
        data-testid="tag-modal-shell"
        data-modal-class={modalClassName}
        data-content-class={contentClassName}
        data-backdrop-class={backdropClassName}
        data-wrap-class={wrapClassName}
      >
        {children}
      </div>
    ) : null),
    ModalHeader: ({ children, className, close, toggle }) => (
      <div data-testid="tag-modal-header" data-class={className}>
        <span>{children}</span>
        {close || (
          <button type="button" onClick={toggle} aria-label="Close">
            ×
          </button>
        )}
      </div>
    ),
    ModalBody: ({ children, className }) => (
      <div data-testid="tag-modal-body" data-class={className}>
        {children}
      </div>
    ),
  };
});

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

const demoCorpusRecords = buildDemoCorpusRecords([
  {
    key: 'tweets',
    label: 'AI Discourse Tweets',
    entries: [
      {
        id: 'google-contrails',
        title: 'Google on contrails',
        summary: 'Google partnered with American Airlines to reduce contrails.',
        author: '@jburnmurdoch',
        created_at: '2023-08-09T08:17:22.000Z',
        tags: ['Google', 'Anthropic'],
        url: 'https://example.com/google-contrails',
      },
      {
        id: 'google-agi',
        title: '25 years at Google: from PageRank to AGI',
        summary: 'Reflections on DeepMind and the path to AGI.',
        author: 'Dwarkesh Patel',
        created_at: '2024-01-02T00:00:00.000Z',
        tags: ['Google', 'DeepMind'],
        url: 'https://example.com/google-agi',
      },
      {
        id: 'google-microsoft',
        title: 'Microsoft weighs in on Google competition',
        summary: 'Microsoft compares its strategy against Google.',
        author: '@industry',
        created_at: '2024-02-10T00:00:00.000Z',
        tags: ['Google', 'Microsoft'],
        url: 'https://example.com/google-microsoft',
      },
    ],
  },
  {
    key: 'ai_laws_policy',
    label: 'AI Laws & Policy',
    entries: [
      {
        id: 'policy-governance',
        title: 'A governance brief',
        summary: 'A policy entry that keeps broader corpus tags available.',
        jurisdiction: 'EU',
        date: '2024-03-01',
        tags: ['AI Governance', 'Policy'],
        url: 'https://example.com/policy-governance',
      },
      {
        id: 'policy-international-framework',
        title: 'Comprehensive international AI framework',
        summary: 'A policy entry with enough tags to verify selected demo tags never get clipped.',
        jurisdiction: 'European Union',
        date: '2024-08-01',
        tags: [
          'Regulation',
          'AI Governance',
          'Risk-Based Approach',
          'Transparency',
          'Accountability',
          'Human Oversight',
          'Human Rights',
          'Frontier Models',
          'International Coordination',
        ],
        url: 'https://example.com/policy-international-framework',
      },
    ],
  },
]);

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

const renderTagModal = ({
  activeTag = 'Google',
  isOpen = true,
  sessionState = {},
  entry = '/demo/corpus-viewer',
  demoCorpusMode = false,
  demoCorpusRecordsOverride = [],
} = {}) => render(
  <Provider store={createTagPageStore(sessionState)}>
    <MemoryRouter initialEntries={[entry]}>
      <TagModal
        isOpen={isOpen}
        toggle={jest.fn()}
        activeTag={activeTag}
        demoCorpusMode={demoCorpusMode}
        demoCorpusRecords={demoCorpusRecordsOverride}
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

    expect(screen.getByRole('heading', { name: '#governance + #ai' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /questions tagged with/i })).not.toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: '#AI Governance' })).toBeInTheDocument();
    expect(screen.queryByText(/^Tag explorer$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove AI Governance tag/i })).toHaveTextContent('#AI Governance');
    expect(screen.getByText('No questions tagged AI Governance in this session yet.')).toBeInTheDocument();
  });

  it('shows demo corpus matches when the caller opts in and hides session scope behind the cog', () => {
    renderTagPage({
      entry: '/demo/corpus-viewer',
      tagPageProps: {
        embedded: true,
        demoCorpusMode: true,
        demoCorpusRecords,
        selectedTagsOverride: ['Google'],
      },
    });

    expect(screen.getByTestId('ce-tag-page-demo-corpus')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /demo corpus/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Google on contrails' })).toBeInTheDocument();
    expect(screen.getByText(/25 years at Google: from PageRank to AGI/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Questions' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('tag-page-session-scope')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tag page session selector/i }));

    expect(screen.getByText(/demo corpus mode uses the demo corpus records currently loaded in this view/i)).toBeInTheDocument();
    expect(screen.getByTestId('ce-tag-page-demo-session-info')).toHaveTextContent('Session scope: edge');
    expect(screen.queryByRole('button', { name: /use global default/i })).not.toBeInTheDocument();
  });

  it('keeps matched demo corpus tags visible even when an entry has a long tag list', () => {
    renderTagPage({
      entry: '/demo/corpus-viewer',
      tagPageProps: {
        embedded: true,
        demoCorpusMode: true,
        demoCorpusRecords,
        selectedTagsOverride: ['International Coordination'],
      },
    });

    const cardTitle = screen.getByRole('heading', { name: 'Comprehensive international AI framework' });
    const card = cardTitle.closest('article');
    expect(card).not.toBeNull();
    expect(within(card).getByText('#International Coordination')).toBeInTheDocument();
    expect(within(card).getByText('#Frontier Models')).toBeInTheDocument();
  });

  it('keeps related tags first while still including the broader scoped tag universe in the picker', () => {
    renderTagPage({ entry: '/tag/governance' });

    fireEvent.click(screen.getByRole('button', { name: /add tag to comparison/i }));

    const dialog = screen.getByRole('dialog', { name: /add tag to comparison/i });
    expect(dialog).toBeInTheDocument();
    const dialogButtons = within(dialog).getAllByRole('button').map((button) => button.textContent);
    expect(dialogButtons).toEqual(['#ai', '#culture']);
    expect(within(dialog).getByRole('button', { name: /add ai tag to comparison/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /add culture tag to comparison/i })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /add ai tag to comparison/i }));

    expect(screen.getByRole('button', { name: /remove ai tag/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /add tag to comparison/i })).not.toBeInTheDocument();
  });

  it('uses the scoped tag universe in the comparison picker even when the current selection has no matching questions', () => {
    renderTagPage({ entry: '/tag/nonexistent' });

    fireEvent.click(screen.getByRole('button', { name: /add tag to comparison/i }));

    const dialog = screen.getByRole('dialog', { name: /add tag to comparison/i });
    expect(within(dialog).getByRole('button', { name: /add governance tag to comparison/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /add ai tag to comparison/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /add culture tag to comparison/i })).toBeInTheDocument();
    expect(within(dialog).queryByText(/no additional tags available/i)).not.toBeInTheDocument();
  });

  it('only shows the comparison picker empty state when no additional scoped tags exist', () => {
    mockListNamespaceEntriesSync.mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return [];
      return [
        buildQuestionsEntry({
          slug: 'edge',
          questions: {
            q1: {
              id: 'q1',
              prompt: 'Only governance question',
              tags: ['governance'],
            },
          },
        }),
      ];
    });

    renderTagPage({ entry: '/tag/governance' });

    fireEvent.click(screen.getByRole('button', { name: /add tag to comparison/i }));

    const dialog = screen.getByRole('dialog', { name: /add tag to comparison/i });
    expect(within(dialog).getByText('No additional tags available in this session scope yet.')).toBeInTheDocument();
  });

  it('keeps related demo tags first while still including the broader demo corpus tag universe in the picker', () => {
    renderTagPage({
      entry: '/demo/corpus-viewer',
      tagPageProps: {
        embedded: true,
        demoCorpusMode: true,
        demoCorpusRecords,
        selectedTagsOverride: ['Google'],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /add tag to comparison/i }));

    const dialog = screen.getByRole('dialog', { name: /add tag to comparison/i });
    expect(within(dialog).getAllByRole('button').slice(0, 3).map((button) => button.textContent)).toEqual([
      '#Anthropic',
      '#DeepMind',
      '#Microsoft',
    ]);
    expect(within(dialog).getByRole('button', { name: /add AI Governance tag to comparison/i })).toBeInTheDocument();
    expect(within(dialog).queryByText(/no additional tags available/i)).not.toBeInTheDocument();
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

describe('TagModal', () => {
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
              tags: ['Google', 'AI Governance', 'culture'],
            },
          },
        }),
      ];
    });
  });

  it('uses dedicated tag-modal shell classes and keeps Tag explorer in the top chrome', () => {
    renderTagModal();

    const shell = screen.getByTestId('tag-modal-shell');
    expect(shell).toHaveAttribute('data-modal-class', 'tagModal');
    expect(shell).toHaveAttribute('data-content-class', 'tagModalContent');
    expect(shell).toHaveAttribute('data-backdrop-class', 'tagModalBackdrop');
    expect(shell).toHaveAttribute('data-wrap-class', 'tagModalWrap');
    expect(screen.getByTestId('tag-modal-header')).toHaveAttribute('data-class', 'tagModalHeaderBar');
    expect(screen.getByText('Tag explorer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close tag explorer/i })).toBeInTheDocument();
  });

  it('shows the selected tag as the dominant heading and updates it when a comparison tag is added', () => {
    renderTagModal();

    expect(screen.getByRole('heading', { name: '#Google' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /add ai governance tag to comparison/i })[0]);
    expect(screen.getByRole('heading', { name: '#Google + #AI Governance' })).toBeInTheDocument();
  });

  it('uses demo corpus results when the modal caller opts in outside /session/demo', () => {
    renderTagModal({
      entry: '/demo/corpus-viewer',
      demoCorpusMode: true,
      demoCorpusRecordsOverride: demoCorpusRecords,
    });

    expect(screen.getByTestId('ce-tag-page-demo-corpus')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Google on contrails' })).toBeInTheDocument();
    expect(screen.queryByTestId('tag-page-session-scope')).not.toBeInTheDocument();
  });

  it('keeps the modal framed fullscreen and the backdrop lighter than the default overlay', () => {
    const scssPath = path.join(__dirname, 'TagPage.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');
    const jsxPath = path.join(__dirname, 'TagModal.jsx');
    const jsx = fs.readFileSync(jsxPath, 'utf8');

    expect(scss).toMatch(/\.tagModal\s*{[\s\S]*padding:\s*16px 0 !important;/);
    expect(scss).toMatch(/:global\(\.modal-dialog\)\s*{[\s\S]*width:\s*min\(1440px,\s*calc\(100vw - 32px\)\);[\s\S]*height:\s*calc\(100vh - 32px\);/);
    expect(scss).toMatch(/\.tagModalContent\s*{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*height:\s*100%;/);
    expect(scss).toMatch(/\.tagModalBackdrop\s*{[\s\S]*background:\s*rgba\(3,\s*5,\s*18,\s*0\.08\) !important;/);
    expect(jsx).toContain('contentClassName={styles.tagModalContent}');
    expect(jsx).toContain('backdropClassName={styles.tagModalBackdrop}');
  });
});
