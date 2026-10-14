import React, { act } from 'react';
import path from 'path';
import * as sass from 'sass';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider, useSelector } from 'react-redux';
import { applyMiddleware, combineReducers, createStore } from 'redux';
import thunk from 'redux-thunk';
import ConnectedToolExplorer, { ToolExplorer } from './ToolExplorer';
import ToolExplorerSessionControl from './ToolExplorerSessionControl';
import { SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT } from '../../utilities/session/sessionWorkerConfigCache';
import sessionStateReducer from '../../reducers/sessionStateReducer';
import { UPDATE_GLOBAL_SESSION_SELECTION } from '../../actions/types';
import styles from './ToolExplorer.module.scss';
import { sbtsListPath } from '../../utilities/ui/terminology.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const mockGetAllSessionSlugs = jest.fn();
const mockGetSessionConfigBySlug = jest.fn();
const mockReadWorkerCache = jest.fn(() => ({ bySession: {} }));
const mockGetDemoConfigs = jest.fn(() => []);
const compiledToolStyles = sass.compile(path.join(__dirname, 'ToolExplorer.module.scss')).css;
const mockSurveyTool = jest.fn();
const mockSBTsPage = jest.fn();
const mockDebateMap = jest.fn();
const mockAudioSurveyGenerator = jest.fn();
const mutableEnv = process.env as Record<string, string | undefined>;
const originalPublicUrl = process.env.PUBLIC_URL;

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  getAllSessionSlugs: (...args: any[]) => mockGetAllSessionSlugs(...args),
  getSessionConfigBySlug: (...args: any[]) => mockGetSessionConfigBySlug(...args),
  getAllSessionEntries: () => mockGetAllSessionSlugs().map((slug: string) => [slug, mockGetSessionConfigBySlug(slug)]),
}));

jest.mock('../../utilities/session/sessionSourceResolver', () => ({
  getAllDemoSessionConfigs: () => mockGetDemoConfigs(),
}));
jest.mock('../../utilities/session/sessionWorkerConfigCache', () => ({
  SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT: 'ce:session-worker-config-cache-updated',
  readSessionWorkerConfigCache: () => mockReadWorkerCache(),
}));

jest.mock('../SurveyTool/SurveyTool', () => ({
  __esModule: true,
  default: (props: any) => {
    mockSurveyTool(props);
    return <div data-testid="mock-survey-tool" data-active-session-slug={props.activeSessionSlug || ''} />;
  },
}));

jest.mock('../MainContent/RiskMatrix', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../Shared/AudioInput/AudioInput', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../SBTs/SBTsPage', () => ({
  __esModule: true,
  default: (props: any) => {
    mockSBTsPage(props);
    return (
      <div
        data-testid="mock-sbts-page"
        data-create-open={props.showCreateGroupExternal ? 'true' : 'false'}
        data-active-session-slug={props.activeSessionSlug || ''}
        data-session-slug={props.sessionSlug || ''}
      />
    );
  },
}));

jest.mock('../DebateMap/DebateMap', () => ({
  __esModule: true,
  default: (props: any) => {
    mockDebateMap(props);
    return (
      <div
        data-testid="mock-debate-map"
        data-demo-mode={typeof props.demoMode === 'undefined' ? '' : String(props.demoMode)}
      />
    );
  },
}));

jest.mock('../SurveyTool/SurveyGenerator/SurveyGenerator', () => ({
  __esModule: true,
  default: (props: any) => {
    mockAudioSurveyGenerator(props);
    return (
      <div
        data-testid="mock-audio-survey-generator"
        data-explorer-mode={props.explorerMode || ''}
        data-demo-surface-mode={typeof props.demoSurfaceMode === 'undefined' ? '' : String(props.demoSurfaceMode)}
        data-session-override-slug={props.sessionOverrideSlug || ''}
        data-session-override-touched={String(!!props.sessionOverrideTouched)}
        data-hide-internal-session-selector={String(!!props.hideInternalSessionSelector)}
      >
        <input aria-label="Context draft" defaultValue="" />
      </div>
    );
  },
}));

jest.mock('./ToolExplorerPluginExplainer', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-explainer" />,
}));

const renderToolExplorer = (overrides: Record<string, unknown> = {}) =>
  render(
    <ToolExplorer
      activeSessionSlug="demo"
      account="0x1111111111111111111111111111111111111111"
      provider={{}}
      toggleLoginModal={jest.fn()}
      loginComplete={false}
      network={{ id: 84532 }}
      isSBTCacheReady={true}
      isSurveyCacheReady={true}
      isQuestionCacheReady={true}
      demoSurfaceMode={true}
      {...overrides}
    />,
  );

describe('ToolExplorer session propagation', () => {
  afterEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    if (originalPublicUrl === undefined) delete mutableEnv.PUBLIC_URL;
    else mutableEnv.PUBLIC_URL = originalPublicUrl;
  });

  beforeEach(() => {
    localStorage.setItem('ce:selectedSessionScope', 'active');
    mockReadWorkerCache.mockReturnValue({ bySession: {} });
    mockGetDemoConfigs.mockReturnValue([]);
    mockGetAllSessionSlugs.mockReturnValue(['edge', 'rxc']);
    mockGetSessionConfigBySlug.mockImplementation((slug: unknown) => {
      const normalized = String(slug || '');
      if (normalized === 'edge') return { slug: 'edge', sessionName: 'Edge Session' };
      if (normalized === 'rxc') return { slug: 'rxc', sessionName: 'Debate Session' };
      return {};
    });
  });

  it.each(['Questions', 'Groups', 'Context', 'Debate Map', 'Risks'])(
    'keeps the %s session control outside Back and disambiguates the selected name and link',
    async (tool) => {
      mockGetSessionConfigBySlug.mockImplementation((slug: string) => ({ slug, sessionName: 'Shared name' }));
      const { container } = renderToolExplorer({ activeSessionSlug: 'edge' });
      fireEvent.click(screen.getByText(tool, { exact: true }));
      const selector = await screen.findByRole('combobox', { name: 'Active session' });
      expect(screen.getByRole('option', { name: 'Shared name (edge)' })).toHaveProperty('selected', true);
      expect(screen.getByRole('option', { name: 'Shared name (rxc)' })).toBeInTheDocument();
      expect(selector.closest(`.${styles.expandedHeaderLead}`)).toBeNull();
      expect(selector.closest(`.${styles.expandedHeaderSession}`)).toBeInTheDocument();
      const lead = container.querySelector(`.${styles.expandedHeaderLead}`);
      expect(lead).toContainElement(screen.getByRole('button', { name: '← Back' }));
      const helpRegion = lead;
      expect(helpRegion).toContainElement(screen.getByTestId('mock-explainer'));
      const link = screen.getByRole('link', { name: 'Open session Shared name (edge)' });
      expect(link).toHaveAttribute('href', '/session/edge');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link.closest('label')).toBeNull();
    },
  );

  it('preserves exact Worker destinations, refreshes cache-only discovery, and keeps General and stale props safe', () => {
    mutableEnv.PUBLIC_URL = '/ce';
    mockGetAllSessionSlugs.mockReturnValue([]);
    mockGetSessionConfigBySlug.mockReturnValue(null);
    const worker = {
      slug: 'worker-link',
      sessionName: 'Shared Worker',
      corsWorkerUrl: 'https://cached-worker.example',
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    };
    const cache = (origin: string) => ({
      bySession: {
        cached: {
          slug: worker.slug,
          authorityMode: 'worker_canonical',
          canonicalConfig: { ...worker, corsWorkerUrl: origin },
          workerOrigin: origin,
        },
      },
    });
    mockReadWorkerCache.mockReturnValue(cache(worker.corsWorkerUrl));
    const onChange = jest.fn();
    const view = render(
      <ToolExplorerSessionControl
        activeSessionSlug={worker.slug}
        sessionConfig={{ ...worker, corsWorkerUrl: 'https://route-worker.example' }}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/ce/session/worker-link?worker=https%3A%2F%2Froute-worker.example',
    );
    view.rerender(
      <ToolExplorerSessionControl
        activeSessionSlug={worker.slug}
        sessionConfig={{ slug: worker.slug }}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/ce/session/worker-link?worker=https%3A%2F%2Fcached-worker.example',
    );
    mockReadWorkerCache.mockReturnValue(cache('https://refreshed-worker.example'));
    act(() => window.dispatchEvent(new Event(SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT)));
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/ce/session/worker-link?worker=https%3A%2F%2Frefreshed-worker.example',
    );
    view.rerender(
      <ToolExplorerSessionControl activeSessionSlug="other session" sessionConfig={worker} onChange={onChange} />,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/ce/session/other%20session');
    expect(screen.getByRole('option', { name: 'Shared Worker (worker-link)' })).toBeInTheDocument();
    view.rerender(<ToolExplorerSessionControl activeSessionSlug="" sessionConfig={worker} onChange={onChange} />);
    expect(screen.getByRole('link', { name: 'Open session General' })).toHaveAttribute('href', '/ce/session');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(/^General$/);
    view.rerender(
      <ToolExplorerSessionControl
        activeSessionSlug={worker.slug}
        sessionConfig={{ ...worker, corsWorkerUrl: 'javascript:alert(1)' }}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/ce/session/worker-link?worker=https%3A%2F%2Frefreshed-worker.example',
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('preserves the default header layout and readable narrow session controls', () => {
    expect(compiledToolStyles).toMatch(/\.expandedHeaderSession\s*\{[^}]*justify-self:\s*end;/);
    expect(compiledToolStyles).toMatch(/\.expandedHeaderActions\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/);
    expect(compiledToolStyles).toMatch(
      /@media \(max-width: 640px\)\s*\{[\s\S]*?\.expandedHeaderRow\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
    );
    expect(compiledToolStyles).not.toMatch(/\.expandedHeaderLead \.activeSessionControl/);
  });

  it('switches Groups globally, including General from list scope, without closing the tool', async () => {
    const store = createStore(combineReducers({ sessionState: sessionStateReducer }), applyMiddleware(thunk));
    store.dispatch({ type: UPDATE_GLOBAL_SESSION_SELECTION, payload: { primarySessionSlug: 'edge' } });
    const AppSessionHost = () => {
      const activeSessionSlug = useSelector(
        (state: { sessionState: { activeSessionSlug: string } }) => state.sessionState.activeSessionSlug,
      );
      return (
        <ConnectedToolExplorer
          activeSessionSlug={activeSessionSlug}
          sessionConfig={mockGetSessionConfigBySlug(activeSessionSlug)}
          demoSurfaceMode={false}
        />
      );
    };
    render(
      <Provider store={store}>
        <AppSessionHost />
      </Provider>,
    );
    fireEvent.click(screen.getByText('Groups'));
    const previousGroup = await screen.findByTestId('mock-sbts-page');
    const selector = screen.getByRole('combobox', { name: 'Active session' });
    expect(selector).toHaveValue('edge');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(/^Edge Session \(edge\)$/);
    expect(screen.getByRole('option', { name: 'Debate Session (rxc)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    fireEvent.change(selector, { target: { value: 'rxc' } });

    expect(store.getState().sessionState.primarySessionSlug).toBe('rxc');
    expect(localStorage.getItem('ce:primarySessionSlug')).toBe('rxc');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(/^Debate Session \(rxc\)$/);
    expect(screen.getByTestId('mock-sbts-page')).not.toBe(previousGroup);
    expect(screen.getByTestId('mock-sbts-page')).toHaveAttribute('data-create-open', 'false');
    expect(screen.getByRole('button', { name: '← Back' })).toBeInTheDocument();
    expect(mockSBTsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeSessionSlug: 'rxc',
        sessionSlug: 'rxc',
        sessionConfig: { slug: 'rxc', sessionName: 'Debate Session' },
      }),
    );
    expect(
      mockSBTsPage.mock.calls
        .filter(([props]) => props.sessionSlug === 'rxc')
        .every(([props]) => !props.showCreateGroupExternal),
    ).toBe(true);

    localStorage.setItem('ce:selectedSessionScope', 'list');
    localStorage.setItem('ce:selectedSessionSlugs', JSON.stringify(['rxc', 'edge']));
    fireEvent.change(selector, { target: { value: '' } });
    expect(store.getState().sessionState.primarySessionSlug).toBe('');
    expect(store.getState().sessionState.selectedSessionScope).toBe('list');
    expect(store.getState().sessionState.selectedSessionSlugs).toEqual(['rxc', 'edge', '']);
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(/^General$/);
    expect(screen.getByTestId('mock-sbts-page')).toHaveAttribute('data-session-slug', '');
  });

  it('ignores selecting the current session and refreshes known options when focused', async () => {
    const updateGlobalSessionSelection = jest.fn();
    renderToolExplorer({
      activeSessionSlug: 'edge',
      sessionConfig: { slug: 'edge', sessionName: 'Current Session' },
      updateGlobalSessionSelection,
    });
    fireEvent.click(screen.getByText('Questions'));
    await screen.findByTestId('mock-survey-tool');
    const selector = screen.getByRole('combobox', { name: 'Active session' });
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(/^Current Session \(edge\)$/);
    expect(screen.queryByRole('option', { name: /^Use global default/ })).not.toBeInTheDocument();
    fireEvent.change(selector, { target: { value: 'edge' } });
    expect(updateGlobalSessionSelection).not.toHaveBeenCalled();

    mockGetAllSessionSlugs.mockReturnValue(['edge', 'rxc', 'new-session']);
    fireEvent.focus(selector);
    expect(screen.getByRole('option', { name: 'new-session (new-session)' })).toBeInTheDocument();
    fireEvent.change(selector, { target: { value: 'new-session' } });
    expect(updateGlobalSessionSelection).toHaveBeenCalledWith({ primarySessionSlug: 'new-session' });
    expect(screen.getByTestId('mock-survey-tool')).toBeInTheDocument();
  });

  it('drops a stale session config when parent session props change without closing the tool', async () => {
    const staleConfig = { slug: 'edge', sessionName: 'Old Session' };
    const { rerender } = renderToolExplorer({ activeSessionSlug: 'edge', sessionConfig: staleConfig });
    fireEvent.click(screen.getByText('Groups'));
    await screen.findByTestId('mock-sbts-page');
    rerender(<ToolExplorer activeSessionSlug="rxc" sessionConfig={staleConfig} />);
    expect(screen.getByRole('combobox', { name: 'Active session' })).toHaveValue('rxc');
    expect(mockSBTsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionConfig: { slug: 'rxc', sessionName: 'Debate Session' } }),
    );
    expect(screen.getByRole('button', { name: '← Back' })).toBeInTheDocument();
  });

  it('keeps the expanded Debate Map mounted when its detail modal closes', async () => {
    renderToolExplorer();
    fireEvent.click(screen.getByText('Debate Map', { exact: true }));
    await screen.findByTestId('mock-debate-map');
    const call = mockDebateMap.mock.calls.at(-1);
    if (!call) throw new Error('Expected the embedded Debate Map to render');
    const { onModalClose } = call[0];
    expect(onModalClose).toEqual(expect.any(Function));
    onModalClose();
    expect(screen.getByTestId('mock-debate-map')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    expect(screen.queryByTestId('mock-debate-map')).not.toBeInTheDocument();
    expect(screen.getByText('Debate Map', { exact: true })).toBeInTheDocument();
  });

  it('passes the inherited active session slug into the embedded SurveyTool', async () => {
    const sessionConfig = { slug: 'demo', storageProfile: { backend: 'cloudflare' } };
    const questionScanProgress = { slug: 'demo', phase: 'hydrate', discoveredQuestions: 3 };
    const { container } = renderToolExplorer({
      sessionConfig,
      networkChainId: 84532,
      isResponsesCacheReady: true,
      questionResponsesNonce: 7,
      questionScanProgress,
    });

    fireEvent.click(screen.getByText('Questions'));

    expect(await screen.findByTestId('mock-survey-tool')).toHaveAttribute('data-active-session-slug', 'demo');
    expect(mockSurveyTool).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSessionSlug: 'demo',
        sessionConfig,
        networkChainId: 84532,
        isResponsesCacheReady: true,
        questionResponsesNonce: 7,
        questionScanProgress,
        preventUrlChange: true,
        toolbarTarget: container.querySelector(`.${styles.expandedHeaderActions}`),
      }),
    );
    expect(container.querySelector(`.${styles.expandedHeaderRow}`)).toHaveClass(styles.expandedHeaderCompact);
  });

  it('keeps Groups controls in the compact header and retains its create toggle', async () => {
    const { container } = renderToolExplorer({ activeSessionSlug: 'edge' });

    fireEvent.click(screen.getByText('Groups'));

    expect(await screen.findByTestId('mock-sbts-page')).toHaveAttribute('data-create-open', 'false');
    expect(screen.getByRole('button', { name: /^← Back$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^View All$/i })).toHaveAttribute('href', sbtsListPath());
    expect(screen.getByRole('button', { name: /^Create$/i })).toBeInTheDocument();

    const headerLead = container.querySelector(`.${styles.expandedHeaderLead}`) as HTMLElement | null;
    const headerActions = container.querySelector(`.${styles.expandedHeaderActions}`) as HTMLElement | null;
    if (!headerLead || !headerActions) throw new Error('Expected expanded header regions');
    expect(headerLead).toContainElement(screen.getByRole('button', { name: /^← Back$/i }));
    expect(headerLead).toContainElement(screen.getByTestId('mock-explainer'));
    expect(headerActions).toContainElement(screen.getByRole('link', { name: /^View All$/i }));
    expect(headerActions).toContainElement(screen.getByRole('button', { name: /^Create$/i }));
    const primary = headerLead.closest(`.${styles.expandedHeaderPrimaryControls}`);
    expect(primary).toContainElement(screen.getByLabelText('Active session'));
    expect(primary?.nextElementSibling).toBe(headerActions);
    expect(primary?.parentElement).toHaveClass(styles.expandedHeaderCompact);

    expect(mockSBTsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        hideMiniActionRow: true,
        showCreateGroupAboveFeatured: true,
        showCreateGroupExternal: false,
        onCreateGroupToggleExternal: expect.any(Function),
        activeSessionSlug: 'edge',
        sessionSlug: 'edge',
        embeddedWorkerGroups: true,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    expect(await screen.findByRole('button', { name: /^Exit$/i })).toBeInTheDocument();
    expect(screen.getByTestId('mock-sbts-page')).toHaveAttribute('data-create-open', 'true');
    expect(mockSBTsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        hideMiniActionRow: true,
        showCreateGroupAboveFeatured: true,
        showCreateGroupExternal: true,
      }),
    );
  });

  it('auto-opens the embedded Groups create panel from a cached draft', async () => {
    const cachedDraft = {
      sbtName: 'Cached Group',
      sbtDescription: 'Cached draft details',
    };
    sessionStorage.setItem('createSbtFormCache', JSON.stringify(cachedDraft));

    renderToolExplorer({ activeSessionSlug: 'edge' });

    fireEvent.click(screen.getByText('Groups'));

    expect(await screen.findByTestId('mock-sbts-page')).toHaveAttribute('data-create-open', 'true');
    expect(screen.getByRole('button', { name: /^Exit$/i })).toBeInTheDocument();
    expect(sessionStorage.getItem('createSbtFormCache')).toBeNull();
    expect(sessionStorage.getItem('dg:createSbtFormCache:edge')).toBe(JSON.stringify(cachedDraft));
  });

  it('keeps the embedded Groups create panel closed after draft cache has been cleared', async () => {
    const cachedDraft = {
      sbtName: 'Cached Group',
      documentUrl: 'https://doc.test/pending',
      _sessionSlug: 'edge',
    };
    sessionStorage.setItem('createSbtFormCache', JSON.stringify(cachedDraft));

    const { unmount } = renderToolExplorer({ activeSessionSlug: 'edge' });

    fireEvent.click(screen.getByText('Groups'));

    expect(await screen.findByTestId('mock-sbts-page')).toHaveAttribute('data-create-open', 'true');
    unmount();
    sessionStorage.clear();

    renderToolExplorer({ activeSessionSlug: 'edge' });

    fireEvent.click(screen.getByText('Groups'));

    expect(await screen.findByTestId('mock-sbts-page')).toHaveAttribute('data-create-open', 'false');
    expect(screen.queryByRole('button', { name: /^Exit$/i })).not.toBeInTheDocument();
  });

  it('builds expanded header links against PUBLIC_URL for subpath deploys', async () => {
    mutableEnv.PUBLIC_URL = '/ce/';

    renderToolExplorer({ activeSessionSlug: 'edge' });

    fireEvent.click(screen.getByText('Groups'));
    expect(await screen.findByRole('link', { name: /^View All$/i })).toHaveAttribute('href', `/ce${sbtsListPath()}`);
    fireEvent.click(screen.getByRole('button', { name: /^← Back$/i }));
    fireEvent.click(screen.getByText('Debate Map'));
    expect(await screen.findByRole('link', { name: /^Full Screen$/i })).toHaveAttribute('href', '/ce/atlas');
  });

  it('shows Add/View controls for Context, defaults to Add, and resets after leaving', async () => {
    renderToolExplorer({ activeSessionSlug: 'edge' });

    fireEvent.click(screen.getByText('Context'));

    expect(await screen.findByTestId('mock-audio-survey-generator')).toHaveAttribute('data-explorer-mode', 'add');
    expect(screen.getByTestId(E2E_TESTIDS.TOOL_EXPLORER_DATA_ADD)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.TOOL_EXPLORER_DATA_VIEW)).toBeInTheDocument();
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
      expect.objectContaining({
        explorerMode: 'add',
        activeSessionSlug: 'edge',
        hideInternalSessionSelector: true,
      }),
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.TOOL_EXPLORER_DATA_VIEW));

    expect(await screen.findByTestId('mock-audio-survey-generator')).toHaveAttribute('data-explorer-mode', 'view');
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
      expect.objectContaining({
        explorerMode: 'view',
      }),
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.TOOL_EXPLORER_DATA_ADD));

    expect(await screen.findByTestId('mock-audio-survey-generator')).toHaveAttribute('data-explorer-mode', 'add');

    fireEvent.click(screen.getByRole('button', { name: /^← Back$/i }));
    fireEvent.click(screen.getByText('Context'));

    expect(await screen.findByTestId('mock-audio-survey-generator')).toHaveAttribute('data-explorer-mode', 'add');
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
      expect.objectContaining({
        explorerMode: 'add',
        hideInternalSessionSelector: true,
      }),
    );
  });

  it('uses the uniform session chooser for local Context overrides while preserving its mode and draft', async () => {
    const updateGlobalSessionSelection = jest.fn();
    const { container } = renderToolExplorer({ activeSessionSlug: 'edge', updateGlobalSessionSelection });
    fireEvent.click(screen.getByText('Context'));
    const context = await screen.findByTestId('mock-audio-survey-generator');
    const draft = screen.getByRole('textbox', { name: 'Context draft' });
    fireEvent.change(draft, { target: { value: 'Keep this draft' } });
    const selector = screen.getByRole('combobox', { name: 'Active session' });
    expect(selector).toHaveValue('edge');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(/^Edge Session \(edge\)$/);
    expect(selector.closest(`.${styles.expandedHeaderLead}`)).toBeNull();
    expect(selector.closest(`.${styles.expandedHeaderSession}`)).toBeInTheDocument();
    const contextControls = selector.closest(`.${styles.expandedHeaderPrimaryControls}`);
    expect(contextControls).toContainElement(screen.getByTestId('mock-explainer'));
    expect(contextControls).toContainElement(screen.getByRole('button', { name: '← Back' }));
    expect(contextControls).not.toContainElement(screen.getByTestId(E2E_TESTIDS.TOOL_EXPLORER_DATA_ADD));
    const headerGroup = container.querySelector(`.${styles.headerModeToggleGroup}`) as HTMLElement | null;
    if (!headerGroup) throw new Error('Expected header mode toggle group');
    expect(Array.from(headerGroup.querySelectorAll('button')).map((node) => node.textContent?.trim())).toEqual([
      'Add',
      'View',
    ]);
    expect(screen.queryByTestId('ce-database-session-selector-toggle')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.TOOL_EXPLORER_DATA_VIEW));
    fireEvent.change(selector, { target: { value: 'rxc' } });
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(/^Debate Session \(rxc\)$/);
    expect(screen.getByRole('link', { name: 'Open session Debate Session (rxc)' })).toHaveAttribute(
      'href',
      '/session/rxc',
    );
    expect(screen.getByTestId('mock-audio-survey-generator')).toBe(context);
    expect(context).toHaveAttribute('data-explorer-mode', 'view');
    expect(draft).toHaveValue('Keep this draft');
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeSessionSlug: 'edge',
        sessionOverrideSlug: 'rxc',
        sessionOverrideTouched: true,
        hideInternalSessionSelector: true,
      }),
    );
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.TOOL_EXPLORER_DATA_ADD));
    expect(context).toHaveAttribute('data-explorer-mode', 'add');
    expect(draft).toHaveValue('Keep this draft');
    expect(updateGlobalSessionSelection).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '← Back' }));
    fireEvent.click(screen.getByText('Context'));
    expect(await screen.findByTestId('mock-audio-survey-generator')).toHaveAttribute('data-explorer-mode', 'add');
    expect(screen.getByRole('combobox', { name: 'Active session' })).toHaveValue('edge');
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionOverrideSlug: null, sessionOverrideTouched: false }),
    );
  });

  it('keeps an explicit General override across global changes and resumes inheritance when the global session is chosen', async () => {
    const updateGlobalSessionSelection = jest.fn();
    const { rerender } = renderToolExplorer({ activeSessionSlug: 'edge', updateGlobalSessionSelection });
    fireEvent.click(screen.getByText('Context'));
    await screen.findByTestId('mock-audio-survey-generator');
    const selector = screen.getByRole('combobox', { name: 'Active session' });
    rerender(<ToolExplorer activeSessionSlug="rxc" updateGlobalSessionSelection={updateGlobalSessionSelection} />);
    expect(selector).toHaveValue('rxc');

    fireEvent.change(selector, { target: { value: '' } });
    rerender(<ToolExplorer activeSessionSlug="edge" updateGlobalSessionSelection={updateGlobalSessionSelection} />);
    expect(selector).toHaveValue('');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(/^General$/);
    expect(screen.getByRole('link', { name: 'Open session General' })).toHaveAttribute('href', '/session');
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeSessionSlug: 'edge', sessionOverrideSlug: '', sessionOverrideTouched: true }),
    );

    fireEvent.change(selector, { target: { value: 'edge' } });
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionOverrideSlug: null, sessionOverrideTouched: false }),
    );
    rerender(<ToolExplorer activeSessionSlug="rxc" updateGlobalSessionSelection={updateGlobalSessionSelection} />);
    expect(selector).toHaveValue('rxc');
    expect(updateGlobalSessionSelection).not.toHaveBeenCalled();
  });

  it('explicitly resumes inheritance when the pinned Context session and global session coincide', async () => {
    mockGetAllSessionSlugs.mockReturnValue(['edge', 'rxc', '__ce_inherited_session__', '__ce_inherited_session___']);
    const { rerender } = renderToolExplorer({ activeSessionSlug: 'edge' });
    fireEvent.click(screen.getByText('Context'));
    await screen.findByTestId('mock-audio-survey-generator');
    const selector = screen.getByRole('combobox', { name: 'Active session' });
    fireEvent.change(selector, { target: { value: 'rxc' } });
    rerender(<ToolExplorer activeSessionSlug="rxc" />);
    expect(selector).toHaveValue('rxc');
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionOverrideSlug: 'rxc', sessionOverrideTouched: true }),
    );

    const inheritOption = screen.getByRole('option', {
      name: 'Use global default: Debate Session (rxc)',
    }) as HTMLOptionElement;
    expect(mockGetAllSessionSlugs()).not.toContain(inheritOption.value);
    fireEvent.change(selector, { target: { value: inheritOption.value } });
    expect(selector).toHaveValue('rxc');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(/^Debate Session \(rxc\)$/);
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionOverrideSlug: null, sessionOverrideTouched: false }),
    );
    rerender(<ToolExplorer activeSessionSlug="edge" />);
    expect(selector).toHaveValue('edge');
  });

  it.each(['', 'uncatalogued'])(
    'keeps the inherited %j session available after a local override',
    async (inherited) => {
      mockGetAllSessionSlugs.mockReturnValue(['rxc']);
      const { rerender } = renderToolExplorer({ activeSessionSlug: inherited });
      fireEvent.click(screen.getByText('Context'));
      await screen.findByTestId('mock-audio-survey-generator');
      const selector = screen.getByRole('combobox', { name: 'Active session' });
      fireEvent.change(selector, { target: { value: 'rxc' } });
      expect(screen.getByRole('option', { name: inherited ? `${inherited} (${inherited})` : 'General' })).toHaveValue(
        inherited,
      );
      fireEvent.change(selector, { target: { value: inherited } });
      expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
        expect.objectContaining({ sessionOverrideSlug: null, sessionOverrideTouched: false }),
      );
      rerender(<ToolExplorer activeSessionSlug="edge" />);
      expect(selector).toHaveValue('edge');
    },
  );

  it('passes demoSurfaceMode through to the expanded Context tool', async () => {
    renderToolExplorer({ activeSessionSlug: 'edge', demoSurfaceMode: false });

    fireEvent.click(screen.getByText('Context'));

    expect(await screen.findByTestId('mock-audio-survey-generator')).toHaveAttribute('data-demo-surface-mode', 'false');
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
      expect.objectContaining({
        explorerMode: 'add',
        demoSurfaceMode: false,
        activeSessionSlug: 'edge',
      }),
    );
  });

  it.each([
    { demoSurfaceMode: null, expectedDemoMode: 'true' },
    { demoSurfaceMode: true, expectedDemoMode: 'true' },
  ])(
    'shows demo cards and the legend when demoSurfaceMode is $demoSurfaceMode',
    async ({ demoSurfaceMode, expectedDemoMode }: { demoSurfaceMode: boolean | null; expectedDemoMode: string }) => {
      renderToolExplorer({ demoSurfaceMode });

      expect(screen.getByText('Debate Map')).toBeInTheDocument();
      expect(screen.getByText('Risks')).toBeInTheDocument();
      expect(screen.queryByText('Suggest Tool')).not.toBeInTheDocument();
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByText('Demo')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Debate Map'));

      expect(await screen.findByTestId('mock-debate-map')).toHaveAttribute('data-demo-mode', expectedDemoMode);
    },
  );

  it('hides future demo cards and the entire legend row when demoSurfaceMode is false', () => {
    const { container } = renderToolExplorer({ demoSurfaceMode: false });

    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.queryByText('Debate Map')).not.toBeInTheDocument();
    expect(screen.queryByText('Risks')).not.toBeInTheDocument();
    expect(screen.queryByText('Suggest Tool')).not.toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    expect(screen.queryByText('Demo')).not.toBeInTheDocument();

    const explorerContainer = container.querySelector(`.${styles.explorerContainer}`) as HTMLElement | null;
    const explorerRow = container.querySelector(`.${styles.explorerRow}`) as HTMLElement | null;
    const explorerCols = Array.from(container.querySelectorAll(`.${styles.explorerCol}`));
    if (!explorerContainer || !explorerRow) throw new Error('Expected sparse explorer layout');

    expect(explorerContainer).toHaveClass(styles.explorerContainerSparse);
    expect(explorerRow).toHaveClass(styles.explorerRowSparse);
    expect(explorerCols).toHaveLength(3);
    explorerCols.forEach((col) => {
      expect(col).toHaveClass(styles.explorerColSparse);
      expect(col).not.toHaveClass(styles.statusBorderEnabled);
    });
  });

  it('keeps the three live tools identifiable and supplies their bundled artwork for classic mode', () => {
    const { container } = renderToolExplorer({ demoSurfaceMode: false });

    expect(screen.getByText('Create and explore questions.')).toBeInTheDocument();
    expect(screen.getByText('Organize and manage groups.')).toBeInTheDocument();
    expect(screen.getByText('Analyze and explore context.')).toBeInTheDocument();
    expect(container.querySelectorAll(`.${styles.classicToolIcon}`)).toHaveLength(3);
    const artwork = Array.from(container.querySelectorAll<HTMLElement>(`.${styles.backgroundImage}`));
    expect(artwork).toHaveLength(3);
    artwork.forEach((image) => expect(image.style.backgroundImage).toContain('url('));
  });

  it('enables live and future status borders only while demo mode is on', () => {
    const { container } = renderToolExplorer({ demoSurfaceMode: true });
    const explorerCols = Array.from(container.querySelectorAll(`.${styles.explorerCol}`));

    expect(explorerCols).toHaveLength(5);
    explorerCols.forEach((col) => {
      expect(col).toHaveClass(styles.statusBorderEnabled);
    });
  });

  it('collapses an expanded demo card when demoSurfaceMode flips to false', async () => {
    const { rerender } = renderToolExplorer({ demoSurfaceMode: true });

    fireEvent.click(screen.getByText('Debate Map'));
    expect(await screen.findByTestId('mock-debate-map')).toBeInTheDocument();

    rerender(
      <ToolExplorer
        activeSessionSlug="demo"
        account="0x1111111111111111111111111111111111111111"
        provider={{}}
        toggleLoginModal={jest.fn()}
        loginComplete={false}
        network={{ id: 84532 }}
        isSBTCacheReady={true}
        isSurveyCacheReady={true}
        isQuestionCacheReady={true}
        demoSurfaceMode={false}
      />,
    );

    expect(screen.queryByTestId('mock-debate-map')).not.toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.queryByText('Debate Map')).not.toBeInTheDocument();
  });
});
