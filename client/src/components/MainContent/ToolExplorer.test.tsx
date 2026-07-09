import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ToolExplorer from './ToolExplorer';
import styles from './ToolExplorer.module.scss';
import { sbtsListPath } from '../../utilities/ui/terminology.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const mockGetAllSessionSlugs = jest.fn();
const mockGetSessionConfigBySlug = jest.fn();
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
    return <div data-testid="mock-sbts-page" data-create-open={props.showCreateGroupExternal ? 'true' : 'false'} />;
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
      />
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
    if (originalPublicUrl === undefined) delete mutableEnv.PUBLIC_URL;
    else mutableEnv.PUBLIC_URL = originalPublicUrl;
  });

  beforeEach(() => {
    mockGetAllSessionSlugs.mockReturnValue(['edge', 'rxc']);
    mockGetSessionConfigBySlug.mockImplementation((slug: unknown) => {
      const normalized = String(slug || '');
      if (normalized === 'edge') return { slug: 'edge', sessionName: 'Edge Session' };
      if (normalized === 'rxc') return { slug: 'rxc', sessionName: 'Debate Session' };
      return {};
    });
  });

  it('passes the inherited active session slug into the embedded SurveyTool', async () => {
    renderToolExplorer();

    fireEvent.click(screen.getByText('Questions'));

    expect(await screen.findByTestId('mock-survey-tool')).toHaveAttribute('data-active-session-slug', 'demo');
    expect(mockSurveyTool).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSessionSlug: 'demo',
        preventUrlChange: true,
      }),
    );
  });

  it('keeps the tooltip beside Back while grouping Groups actions on the opposite side', async () => {
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

    expect(mockSBTsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        hideMiniActionRow: true,
        showCreateGroupAboveFeatured: true,
        showCreateGroupExternal: false,
        onCreateGroupToggleExternal: expect.any(Function),
        activeSessionSlug: 'edge',
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
    fireEvent.click(screen.getByText('Debate Tree'));
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

  it('renders Add, View, then the header gear and forwards session overrides into Context', async () => {
    const { container } = renderToolExplorer({ activeSessionSlug: 'edge' });

    fireEvent.click(screen.getByText('Context'));

    expect(await screen.findByTestId('mock-audio-survey-generator')).toBeInTheDocument();
    const headerGroup = container.querySelector(`.${styles.headerModeToggleGroup}`) as HTMLElement | null;
    if (!headerGroup) throw new Error('Expected header mode toggle group');
    const headerButtons = Array.from(headerGroup.querySelectorAll('button')).map(
      (node) => node.getAttribute('aria-label') || node.textContent?.trim(),
    );

    expect(headerButtons).toEqual(['Add', 'View', 'Context session selector']);
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionOverrideSlug: null,
        sessionOverrideTouched: false,
        hideInternalSessionSelector: true,
      }),
    );

    fireEvent.click(screen.getByTestId('ce-database-session-selector-toggle'));

    expect(screen.getByTestId('ce-database-session-selector-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ce-database-session-chip-rxc'));

    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(
      expect.objectContaining({
        explorerMode: 'add',
        sessionOverrideSlug: 'rxc',
        sessionOverrideTouched: true,
        hideInternalSessionSelector: true,
      }),
    );
  });

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

      expect(screen.getByText('Debate Tree')).toBeInTheDocument();
      expect(screen.getByText('Risks')).toBeInTheDocument();
      expect(screen.getByText('Suggest Tool')).toBeInTheDocument();
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByText('Demo')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Debate Tree'));

      expect(await screen.findByTestId('mock-debate-map')).toHaveAttribute('data-demo-mode', expectedDemoMode);
    },
  );

  it('hides future demo cards and the entire legend row when demoSurfaceMode is false', () => {
    const { container } = renderToolExplorer({ demoSurfaceMode: false });

    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.queryByText('Debate Tree')).not.toBeInTheDocument();
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
    });
  });

  it('collapses an expanded demo card when demoSurfaceMode flips to false', async () => {
    const { rerender } = renderToolExplorer({ demoSurfaceMode: true });

    fireEvent.click(screen.getByText('Debate Tree'));
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
    expect(screen.queryByText('Debate Tree')).not.toBeInTheDocument();
  });
});
