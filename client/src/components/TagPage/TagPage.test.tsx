import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';
import fs from 'fs';
import path from 'path';
import TagPage, { readTagAiCacheEntry, writeTagAiCacheEntry } from './TagPage';
import TagModal from './TagModal';
import buildTagInterpretationPrompt from '../../prompts/tagInterpretationPrompt.js';
import { buildDemoCorpusRecords } from '../../utilities/demo/demoCorpusRecords.js';
import { installSessionRegistryQueryInvalidation } from '../../utilities/query/sessionRegistryQueryInvalidation.js';

const mockListNamespaceEntriesSync = jest.fn();
const mockSubscribeCacheUpdates = jest.fn(() => () => {});
const mockGetAllSessionSlugs = jest.fn();
const mockGetSessionConfigBySlug = jest.fn();
const mockGetDemoSessionConfigBySlug = jest.fn();
const mockCallAI = jest.fn();
const mockPortGetAllSessionSlugs = jest.fn((...args: any[]) => mockGetAllSessionSlugs(...args));
const mockPortGetSessionConfigBySlug = jest.fn((...args: any[]) => mockGetSessionConfigBySlug(...args));
const mockSubscribeSessionRegistryUpdates = jest.fn((target: Window, listener: EventListenerOrEventListenerObject) => {
  target.addEventListener('ce:session-registry-cache-updated', listener);
  return () => target.removeEventListener('ce:session-registry-cache-updated', listener);
});
const SESSION_REGISTRY_MOUNT_READ_BASELINE = Object.freeze({
  slugReads: 1,
  configReads: 2,
  totalReads: 3,
});

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  __esModule: true,
  listNamespaceEntriesSync: (...args: any[]) => mockListNamespaceEntriesSync(...args),
  peekCacheSync: jest.fn(() => null),
  subscribeCacheUpdates: (...args: any[]) => (mockSubscribeCacheUpdates as any)(...args),
}));

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  default: {},
  getAllSessionSlugs: (...args: any[]) => mockGetAllSessionSlugs(...args),
  getSessionConfigBySlug: (...args: any[]) => mockGetSessionConfigBySlug(...args),
  getDemoSessionConfigBySlug: (...args: any[]) => mockGetDemoSessionConfigBySlug(...args),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  __esModule: true,
  SESSION_REGISTRY_CACHE_UPDATED_EVENT: 'ce:session-registry-cache-updated',
}));

jest.mock('../../domains/sessions/registry/sessionRegistryReadPorts.js', () => ({
  __esModule: true,
  sessionRegistryReadsPort: {
    getAllSessionSlugs: (...args: any[]) => mockPortGetAllSessionSlugs(...args),
    getSessionConfigBySlug: (...args: any[]) => mockPortGetSessionConfigBySlug(...args),
    subscribeToCacheUpdates: (...args: any[]) => mockSubscribeSessionRegistryUpdates(...args),
  },
}));

jest.mock('../../utilities/ai/aiClient.js', () => ({
  __esModule: true,
  callAI: (...args: any[]) => mockCallAI(...args),
}));

jest.mock('reactstrap', () => {
  const actual = jest.requireActual('reactstrap');

  return {
    ...actual,
    Modal: ({
      isOpen,
      children,
      innerRef,
      modalClassName,
      contentClassName,
      backdropClassName,
      wrapClassName,
    }: any) => {
      const refCallback = (node: HTMLDivElement | null) => {
        if (typeof innerRef === 'function') {
          innerRef(node);
        } else if (innerRef && typeof innerRef === 'object') {
          innerRef.current = node;
        }
      };

      return isOpen ? (
        <div
          ref={refCallback}
          data-testid="tag-modal-shell"
          data-modal-class={modalClassName}
          data-content-class={contentClassName}
          data-backdrop-class={backdropClassName}
          data-wrap-class={wrapClassName}
        >
          {children}
        </div>
      ) : null;
    },
    ModalHeader: ({ children, className, close, toggle }: any) => (
      <div data-testid="tag-modal-header" data-class={className}>
        <span>{children}</span>
        {close ||
          (toggle ? (
            <button type="button" onClick={toggle} aria-label="Close">
              ×
            </button>
          ) : null)}
      </div>
    ),
    ModalBody: ({ children, className }: any) => (
      <div data-testid="tag-modal-body" data-class={className}>
        {children}
      </div>
    ),
  };
});

const TagPageComponent = TagPage as React.ComponentType<any>;
const TagModalComponent = TagModal as React.ComponentType<any>;
const buildTagInterpretationPromptAny = buildTagInterpretationPrompt as any;
let queryClient: QueryClient;

describe('tag AI cache helpers', () => {
  it('refreshes cache recency when reading an existing interpretation', () => {
    const cache = new Map([
      ['old', 'Old summary'],
      ['keep', 'Kept summary'],
      ['new', 'New summary'],
    ]);

    expect(readTagAiCacheEntry(cache, 'old')).toBe('Old summary');
    expect([...cache.keys()]).toEqual(['keep', 'new', 'old']);
    expect(readTagAiCacheEntry(cache, 'missing')).toBe('');
    expect([...cache.keys()]).toEqual(['keep', 'new', 'old']);
  });

  it('evicts the least recent entries when writing beyond the cache limit', () => {
    const cache = new Map([
      ['first', 'First summary'],
      ['second', 'Second summary'],
    ]);

    writeTagAiCacheEntry(cache, 'third', 'Third summary', 2);

    expect([...cache.entries()]).toEqual([
      ['second', 'Second summary'],
      ['third', 'Third summary'],
    ]);

    writeTagAiCacheEntry(cache, 'second', 'Updated summary', 2);

    expect([...cache.entries()]).toEqual([
      ['third', 'Third summary'],
      ['second', 'Updated summary'],
    ]);
  });
});

const createTagPageStore = (sessionStateOverrides: Record<string, any> = {}) =>
  createStore(
    (
      state = {
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
      },
    ) => state,
  );

const buildQuestionsEntry = ({ slug = 'edge', questions = {}, questionResponses = {} }: Record<string, any> = {}) => ({
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
] as any[]) as any[];

const renderTagPage = ({
  entry = '/tag/governance',
  isQuestionCacheReady = true,
  sessionState = {},
  tagPageProps = {},
}: Record<string, any> = {}) =>
  render(
    <Provider store={createTagPageStore(sessionState)}>
      <MemoryRouter initialEntries={[entry]}>
        <TagPageComponent questionResponsesNonce={0} isQuestionCacheReady={isQuestionCacheReady} {...tagPageProps} />
      </MemoryRouter>
    </Provider>,
  );

const renderTagModal = ({
  activeTag = 'Google',
  isOpen = true,
  sessionState = {},
  entry = '/demo/corpus-viewer',
  demoCorpusMode = false,
  demoCorpusRecordsOverride = [],
  toggle = jest.fn(),
}: Record<string, any> = {}) =>
  render(
    <Provider store={createTagPageStore(sessionState)}>
      <MemoryRouter initialEntries={[entry]}>
        <TagModalComponent
          isOpen={isOpen}
          toggle={toggle}
          activeTag={activeTag}
          demoCorpusMode={demoCorpusMode}
          demoCorpusRecords={demoCorpusRecordsOverride}
        />
      </MemoryRouter>
    </Provider>,
  );

describe('TagPage', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
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
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    renderTagPage({ entry: '/tag/governance+ai' });

    const title = screen.getByRole('heading', { name: '#governance + #ai' });
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass('titlePillHeading');
    expect(screen.queryByText(/^Tag explorer$/i)).not.toBeInTheDocument();
    expect(within(title).getByText('#governance').parentElement).toHaveClass('tagPillHero');
    expect(within(title).getByText('#ai').parentElement).toHaveClass('tagPillHero');
    expect(screen.getAllByText('#governance')).toHaveLength(1);
    expect(screen.getAllByText('#ai')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /remove governance tag/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /remove ai tag/i })).toHaveLength(1);
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

  it('keeps the fullscreen tag modal content shrink-safe so demo cards cannot overflow the viewport width', () => {
    const scssPath = path.join(__dirname, 'TagPage.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.pageEmbedded\s*{[\s\S]*?overflow-x:\s*hidden;/);
    expect(scss).toMatch(/\.headerControls\s*{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/);
    expect(scss).toMatch(/\.tagPickerEmbedded\s*{[\s\S]*?margin-left:\s*auto;/);
    expect(scss).toMatch(
      /\.tagPickerPopover\s*{[\s\S]*?right:\s*0;[\s\S]*?max-height:\s*min\(420px,\s*calc\(100vh - 220px\)\);[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(scss).toMatch(/\.demoCorpusFooter\s*{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/);
    expect(scss).toMatch(
      /\.demoCorpusTagList\s*{[\s\S]*?flex:\s*1 1 420px;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*720px\)\s*{[\s\S]*?\.headerTopRow\s*{[\s\S]*?flex-direction:\s*row;[\s\S]*?flex-wrap:\s*wrap;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*720px\)\s*{[\s\S]*?\.headerLead\s*{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?width:\s*auto;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*720px\)\s*{[\s\S]*?\.headerMeta\s*{[\s\S]*?width:\s*auto;[\s\S]*?flex:\s*0 0 auto;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*720px\)\s*{[\s\S]*?\.headerControls\s*{[\s\S]*?flex-direction:\s*row;[\s\S]*?flex-wrap:\s*wrap;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*720px\)\s*{[\s\S]*?\.tagPickerPopover\s*{[\s\S]*?right:\s*0;[\s\S]*?left:\s*auto;[\s\S]*?max-height:\s*min\(360px,\s*calc\(100vh - 190px\)\);/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*720px\)\s*{[\s\S]*?\.demoCorpusTagList\s*{[\s\S]*?flex:\s*0 1 auto;[\s\S]*?width:\s*100%;[\s\S]*?align-items:\s*flex-start;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*720px\)\s*{[\s\S]*?\.demoCorpusTag\s*{[\s\S]*?align-self:\s*flex-start;/,
    );
  });

  it('displays tag pills from the URL', () => {
    renderTagPage({ entry: '/tag/governance+AI%20Policy' });

    expect(screen.getByText('#governance')).toBeInTheDocument();
    expect(screen.getByText('#AI Policy')).toBeInTheDocument();
    expect(screen.getByTestId('tag-page-title')).toHaveClass('titlePillHeading');
    expect(screen.getAllByText('#governance')).toHaveLength(1);
    expect(screen.getAllByText('#AI Policy')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /remove governance tag/i })).toHaveTextContent('×');
    expect(screen.getByRole('button', { name: /remove AI Policy tag/i })).toHaveTextContent('×');
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
    expect(screen.getAllByRole('button', { name: /remove AI Governance tag/i })).toHaveLength(1);
    expect(screen.getByText('#AI Governance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove AI Governance tag/i })).toHaveTextContent('×');
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

    expect(
      screen.getByText(/demo corpus mode uses the demo corpus records currently loaded in this view/i),
    ).toBeInTheDocument();
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
    const card = cardTitle.closest('article') as HTMLElement;
    expect(card).not.toBeNull();
    expect(within(card).getByText('#International Coordination')).toBeInTheDocument();
    expect(within(card).getByText('#Frontier Models')).toBeInTheDocument();
  });

  it('keeps demo tweet cards collapsed by default and expands them on demand with a footer icon link', () => {
    renderTagPage({
      entry: '/demo/corpus-viewer',
      tagPageProps: {
        embedded: true,
        demoCorpusMode: true,
        demoCorpusRecords,
        selectedTagsOverride: ['Google'],
      },
    });

    const cardTitle = screen.getByRole('heading', { name: 'Google on contrails' });
    const card = cardTitle.closest('article') as HTMLElement;
    expect(card).not.toBeNull();
    expect(
      within(card).queryByText('Google partnered with American Airlines to reduce contrails.'),
    ).not.toBeInTheDocument();
    expect(within(card).queryByText('View source')).not.toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /view source/i })).toHaveAttribute(
      'href',
      'https://example.com/google-contrails',
    );

    fireEvent.click(within(card).getByRole('button', { name: /expand google on contrails/i }));

    expect(within(card).getByText('Google partnered with American Airlines to reduce contrails.')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /collapse google on contrails/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('keeps related tags first while still including the broader scoped tag universe in the picker', () => {
    renderTagPage({ entry: '/tag/governance' });

    fireEvent.click(screen.getByRole('button', { name: /add tag to comparison/i }));

    const dialog = screen.getByRole('dialog', { name: /add tag to comparison/i });
    expect(dialog).toBeInTheDocument();
    const dialogButtons = within(dialog)
      .getAllByRole('button')
      .map((button) => button.textContent);
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
    expect(
      within(dialog)
        .getAllByRole('button')
        .slice(0, 3)
        .map((button) => button.textContent),
    ).toEqual(['#Anthropic', '#DeepMind', '#Microsoft']);
    expect(within(dialog).getByRole('button', { name: /add AI Governance tag to comparison/i })).toBeInTheDocument();
    expect(within(dialog).queryByText(/no additional tags available/i)).not.toBeInTheDocument();
  });

  it('keeps the add-tag control compact while preserving the comparison-picker accessibility label', () => {
    renderTagPage({
      entry: '/demo/corpus-viewer',
      tagPageProps: {
        embedded: true,
        demoCorpusMode: true,
        demoCorpusRecords,
        selectedTagsOverride: ['Media'],
      },
    });

    const addTagButton = screen.getByRole('button', { name: /add tag to comparison/i });
    expect(addTagButton).toHaveTextContent('Add tag');
    expect(addTagButton).not.toHaveTextContent('Add tag to comparison');

    fireEvent.click(addTagButton);

    expect(screen.getByRole('dialog', { name: /add tag to comparison/i })).toBeInTheDocument();
    expect(screen.getByText('Select another tag to compare')).toBeInTheDocument();
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

  it('refreshes selector options when the session registry cache updates', async () => {
    mockGetAllSessionSlugs.mockReturnValue(['', 'edge']);

    renderTagPage({ entry: '/tag/governance' });

    fireEvent.click(screen.getByRole('button', { name: /tag page session selector/i }));
    expect(screen.queryByRole('button', { name: /^alpha$/i })).not.toBeInTheDocument();

    act(() => {
      mockGetAllSessionSlugs.mockReturnValue(['', 'edge', 'alpha']);
      window.dispatchEvent(new Event('ce:session-registry-cache-updated'));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^alpha$/i })).toBeInTheDocument();
    });
    expect(mockSubscribeSessionRegistryUpdates).toHaveBeenCalledTimes(1);
    expect(mockGetAllSessionSlugs).toHaveBeenCalledTimes(2);
  });

  it('preserves the registry shape without exceeding the mount read baseline', () => {
    mockGetAllSessionSlugs.mockReturnValue(['', 'edge']);
    mockGetSessionConfigBySlug.mockImplementation((slug) =>
      slug === 'edge' ? { slug: 'edge', sessionName: 'Edge Registry' } : { slug: '', sessionName: 'General' },
    );

    renderTagPage({ entry: '/tag/governance' });

    expect(screen.getByTestId('tag-page-session-scope')).toHaveTextContent('Session scope: Edge Registry (edge)');
    fireEvent.click(screen.getByRole('button', { name: /tag page session selector/i }));
    expect(screen.getByRole('button', { name: 'Edge Registry (edge)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'General' })).toBeInTheDocument();
    expect(mockGetAllSessionSlugs).toHaveBeenCalledTimes(1);
    expect(mockGetSessionConfigBySlug.mock.calls).toEqual([['edge']]);
    expect(mockPortGetAllSessionSlugs).toHaveBeenCalledTimes(1);
    expect(mockPortGetSessionConfigBySlug).toHaveBeenCalledTimes(1);
    expect(mockSubscribeSessionRegistryUpdates).toHaveBeenCalledTimes(1);
    const currentReads = {
      slugReads: mockPortGetAllSessionSlugs.mock.calls.length,
      configReads: mockPortGetSessionConfigBySlug.mock.calls.length,
    };
    expect(currentReads).toEqual({ slugReads: 1, configReads: 1 });
    expect(currentReads.slugReads + currentReads.configReads).toBeLessThanOrEqual(
      SESSION_REGISTRY_MOUNT_READ_BASELINE.totalReads,
    );
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
    mockGetDemoSessionConfigBySlug.mockImplementation((slug) =>
      slug === ''
        ? {
            sessionName: 'General',
          }
        : null,
    );
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

    const expectedPrompt = buildTagInterpretationPromptAny({
      selectedTags: ['governance'],
      questions: [
        {
          prompt: 'General governance question',
          responseCount: 0,
        },
      ],
    });
    expect(mockCallAI).toHaveBeenCalledWith(expectedPrompt, expect.objectContaining({ sessionSlug: '' }));
    expect(await screen.findByText('Mocked interpretation')).toBeInTheDocument();
  });

  it('keeps an AI interpretation until the scoped question content actually changes', async () => {
    let edgePrompt = 'What changed?';
    mockListNamespaceEntriesSync.mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return [];
      return [
        buildQuestionsEntry({
          slug: 'edge',
          questions: {
            q1: {
              id: 'q1',
              prompt: edgePrompt,
              tags: ['governance'],
            },
          },
        }),
      ];
    });

    renderTagPage({ entry: '/tag/governance' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /summarize discussions/i }));
    });
    expect(await screen.findByText('Mocked interpretation')).toBeInTheDocument();

    const cacheSubscriber = mockSubscribeCacheUpdates.mock.calls[0][0];
    act(() => {
      cacheSubscriber({ namespace: 'questionsCache', slug: 'alpha', value: { unrelated: true } });
    });
    expect(screen.getByText('Mocked interpretation')).toBeInTheDocument();

    act(() => {
      cacheSubscriber({ namespace: 'questionsCache', slug: 'edge', value: { '11155420': {} } });
    });
    expect(screen.getByText('Mocked interpretation')).toBeInTheDocument();

    edgePrompt = 'What materially changed?';
    act(() => {
      cacheSubscriber({ namespace: 'questionsCache', slug: 'EDGE', value: { '84532': {} } });
    });

    expect(screen.getByText('What materially changed?')).toBeInTheDocument();
    expect(screen.queryByText('Mocked interpretation')).not.toBeInTheDocument();
  });

  it('shows elapsed seconds while AI interpretation is generating', async () => {
    jest.useFakeTimers();
    let nowMs = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => nowMs);
    let resolveAi!: (value: string) => void;
    mockCallAI.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveAi = resolve;
        }),
    );

    renderTagPage({ entry: '/tag/governance' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /summarize discussions/i }));
    });

    expect(screen.getByRole('status')).toHaveTextContent('Generating interpretation... 0.0s');

    act(() => {
      nowMs += 2500;
      jest.advanceTimersByTime(2500);
    });

    expect(screen.getByRole('status')).toHaveTextContent('Generating interpretation... 2.5s');

    await act(async () => {
      resolveAi('Delayed interpretation');
      await Promise.resolve();
    });

    expect(screen.getByText('Delayed interpretation')).toBeInTheDocument();
  });

  it('keeps the Tag Explorer AI prompt builder in the prompts folder', () => {
    const promptShimPath = path.join(__dirname, '../../prompts/tagInterpretationPrompt.js');
    const promptSourcePath = path.join(__dirname, '../../prompts/tagInterpretationPrompt.ts');
    const promptSource = fs.readFileSync(promptSourcePath, 'utf8');
    const componentSource = fs.readFileSync(path.join(__dirname, 'TagPage.tsx'), 'utf8');

    expect(fs.existsSync(promptShimPath)).toBe(false);
    expect(promptSource).toContain('export default function buildTagInterpretationPrompt');
    expect(componentSource).toContain('../../prompts/tagInterpretationPrompt.js');
  });
});

describe('TagModal', () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
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

  it('uses dedicated tag-modal shell classes and keeps the demo info cog beside the modal close control', () => {
    mockGetSessionConfigBySlug.mockImplementation((slug) =>
      slug === 'edge' ? { slug: 'edge', sessionName: 'Registry Edge' } : null,
    );
    mockGetDemoSessionConfigBySlug.mockImplementation((slug) =>
      slug === 'edge' ? { slug: 'edge', sessionName: 'Demo Edge' } : null,
    );
    renderTagModal({
      entry: '/demo/corpus-viewer',
      demoCorpusMode: true,
      demoCorpusRecordsOverride: demoCorpusRecords,
    });

    const shell = screen.getByTestId('tag-modal-shell');
    expect(shell).toHaveAttribute('data-modal-class', 'tagModal');
    expect(shell).toHaveAttribute('data-content-class', 'tagModalContent');
    expect(shell).toHaveAttribute('data-backdrop-class', 'tagModalBackdrop');
    expect(shell).toHaveAttribute('data-wrap-class', 'tagModalWrap');
    expect(screen.getByTestId('tag-modal-top-bar')).toHaveClass('tagModalHeaderBar');
    expect(screen.getByText('Tag explorer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tag explorer info/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /close tag explorer/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /tag explorer info/i }));

    expect(screen.getByTestId('tag-modal-demo-info-panel')).toBeInTheDocument();
    expect(
      screen.getByText(/demo corpus mode uses the demo corpus records currently loaded in this view/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/session scope: edge/i)).toBeInTheDocument();
    expect(screen.queryByTestId('ce-tag-page-session-selector-toggle')).not.toBeInTheDocument();
  });

  it('shows the selected tag as the dominant heading and updates it when a comparison tag is added', () => {
    renderTagModal();

    expect(screen.getByRole('heading', { name: '#Google' })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /add ai governance tag to comparison/i })[0]);
    expect(screen.getByRole('heading', { name: '#Google + #AI Governance' })).toBeInTheDocument();
  });

  it('only lets the dedicated x control remove the last selected tag in the modal', () => {
    const toggle = jest.fn();
    renderTagModal({ toggle });

    fireEvent.click(screen.getByText('#Google'));
    expect(toggle).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: '#Google' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remove Google tag/i }));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('resets the modal scroll area to the top when the selected tag context changes', () => {
    const toggle = jest.fn();
    const { rerender } = renderTagModal({ activeTag: 'Google', toggle });
    const shell = screen.getByTestId('tag-modal-shell');
    const scrollArea = screen.getByTestId('tag-modal-scroll-area');

    shell.scrollTop = 180;
    scrollArea.scrollTop = 240;

    rerender(
      <Provider store={createTagPageStore({})}>
        <MemoryRouter initialEntries={['/demo/corpus-viewer']}>
          <TagModalComponent
            isOpen={true}
            toggle={toggle}
            activeTag="Open Source"
            demoCorpusMode={false}
            demoCorpusRecords={[]}
          />
        </MemoryRouter>
      </Provider>,
    );

    expect(screen.getByRole('heading', { name: '#Open Source' })).toBeInTheDocument();
    expect(screen.getByTestId('tag-modal-shell').scrollTop).toBe(0);
    expect(screen.getByTestId('tag-modal-scroll-area').scrollTop).toBe(0);
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

  it('describes the current global session scope inside demo info when the modal is not URL-pinned', () => {
    renderTagModal({
      entry: '/demo/corpus-viewer',
      demoCorpusMode: true,
      demoCorpusRecordsOverride: demoCorpusRecords,
      sessionState: {
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['alpha', 'beta'],
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /tag explorer info/i }));

    expect(screen.getByTestId('tag-modal-demo-info-panel')).toHaveTextContent('Session scope: alpha + beta');
  });

  it('keeps the modal framed fullscreen and the backdrop lighter than the default overlay', () => {
    const scssPath = path.join(__dirname, 'TagPage.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');
    const jsxPath = path.join(__dirname, 'TagModal.tsx');
    const jsx = fs.readFileSync(jsxPath, 'utf8');

    expect(scss).toMatch(/\.tagModal\s*{[\s\S]*padding:\s*16px 0 !important;[\s\S]*overflow:\s*hidden !important;/);
    expect(scss).toMatch(
      /:global\(\.modal-dialog\)\s*{[\s\S]*width:\s*min\(1440px,\s*calc\(100vw - 32px\)\);[\s\S]*height:\s*calc\(100vh - 32px\);/,
    );
    expect(scss).toMatch(
      /\.tagModalContent\s*{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*flex-wrap:\s*nowrap;[\s\S]*height:\s*100%;[\s\S]*position:\s*relative;/,
    );
    expect(scss).toMatch(/\.tagModalBackdrop\s*{[\s\S]*background:\s*rgba\(3,\s*5,\s*18,\s*0\.08\) !important;/);
    expect(scss).toMatch(
      /\.tagModalHeaderBar\s*{[\s\S]*display:\s*flex;[\s\S]*width:\s*100%;[\s\S]*justify-content:\s*space-between;[\s\S]*position:\s*relative;/,
    );
    expect(scss).toMatch(
      /\.tagModalHeaderActions\s*{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;[\s\S]*gap:\s*10px;/,
    );
    expect(scss).toMatch(
      /\.tagModalChromeButton\s*{[\s\S]*border-radius:\s*999px;[\s\S]*width:\s*2\.4rem;[\s\S]*height:\s*2\.4rem;/,
    );
    expect(scss).toMatch(
      /\.tagModalChromePopover\s*{[\s\S]*position:\s*absolute;[\s\S]*top:\s*calc\(100% \+ 10px\);[\s\S]*right:\s*0;/,
    );
    expect(scss).toMatch(/\.tagModalBody\s*{[\s\S]*overflow:\s*hidden;[\s\S]*padding:\s*0;/);
    expect(scss).toMatch(
      /\.tagModalScrollArea\s*{[\s\S]*overflow-x:\s*hidden;[\s\S]*overflow-y:\s*auto;[\s\S]*height:\s*100%;[\s\S]*width:\s*100%;/,
    );
    expect(scss).toMatch(/\.titleEmbedded\s*{[\s\S]*font-size:\s*clamp\(2rem,\s*5\.35vw,\s*3\.95rem\);/);
    expect(scss).toMatch(/\.titlePillHeading\s*{[\s\S]*font-size:\s*1rem;[\s\S]*line-height:\s*1;/);
    expect(scss).toMatch(/\.tagPillHero\s*{[\s\S]*font-size:\s*clamp\(1\.25rem,\s*3\.6vw,\s*2\.7rem\);/);
    expect(scss).toMatch(
      /\.tagPillRemove\s*{[\s\S]*min-width:\s*1\.5rem;[\s\S]*min-height:\s*1\.5rem;[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*font-size:\s*1\.18rem;/,
    );
    expect(scss).toMatch(
      /\.tagPillRemoveHero\s*{[\s\S]*min-width:\s*1\.8rem;[\s\S]*min-height:\s*1\.8rem;[\s\S]*font-size:\s*1\.38rem;/,
    );
    expect(jsx).toContain('contentClassName={styles.tagModalContent}');
    expect(jsx).toContain('backdropClassName={styles.tagModalBackdrop}');
    expect(jsx).toContain('innerRef={modalRef}');
    expect(jsx).toContain('data-testid="tag-modal-top-bar"');
    expect(jsx).toContain('data-testid="tag-modal-demo-info-toggle"');
    expect(jsx).toContain('data-testid="tag-modal-demo-info-panel"');
    expect(jsx).toContain('data-testid="tag-modal-scroll-area"');
    expect(jsx).not.toMatch(/import\s+\{\s*[^}]*\bModalHeader\b/);
    expect(jsx).not.toMatch(/<ModalHeader\b/);
  });

  it('uses the fullscreen tag route blue palette for the modal shell', () => {
    const scssPath = path.join(__dirname, 'TagPage.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\$tag-route-bg:\s*#20204e;/);
    expect(scss).toMatch(
      /\.tagModalContent\s*{[\s\S]*radial-gradient\(circle at top right,\s*rgba\(\$tag-route-accent,\s*0\.18\),\s*transparent 34%\),[\s\S]*linear-gradient\(180deg,\s*rgba\(\$tag-route-bg,\s*0\.985\),\s*rgba\(\$tag-route-bg-deep,\s*0\.985\)\);[\s\S]*background-color:\s*\$tag-route-bg;/,
    );
    expect(scss).toMatch(
      /\.tagModalHeaderBar\s*{[\s\S]*linear-gradient\(180deg,\s*rgba\(\$tag-route-accent-alt,\s*0\.16\),\s*rgba\(\$tag-route-bg,\s*0\.1\)\),/,
    );
    expect(scss).toMatch(
      /\.tagModalChromePopover\s*{[\s\S]*linear-gradient\(180deg,\s*rgba\(\$tag-route-accent-alt,\s*0\.14\),\s*rgba\(\$tag-route-bg-deep,\s*0\.14\)\),[\s\S]*rgba\(\$tag-route-bg,\s*0\.98\);/,
    );
  });
});
