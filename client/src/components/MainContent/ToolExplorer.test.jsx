import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ToolExplorer from './ToolExplorer.jsx';
import styles from './ToolExplorer.module.scss';
import { sbtsListPath } from '../../utilities/ui/terminology.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const mockSurveyTool = jest.fn();
const mockSBTsPage = jest.fn();
const mockDebateMap = jest.fn();
const mockAudioSurveyGenerator = jest.fn();
const originalPublicUrl = process.env.PUBLIC_URL;

jest.mock('../SurveyTool/SurveyTool.jsx', () => ({
  __esModule: true,
  default: (props) => {
    mockSurveyTool(props);
    return (
      <div
        data-testid="mock-survey-tool"
        data-active-session-slug={props.activeSessionSlug || ''}
      />
    );
  },
}));

jest.mock('../MainContent/RiskMatrix.jsx', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../Shared/AudioInput/AudioInput.jsx', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../SBTs/SBTsPage.jsx', () => ({
  __esModule: true,
  default: (props) => {
    mockSBTsPage(props);
    return (
      <div
        data-testid="mock-sbts-page"
        data-create-open={props.showCreateGroupExternal ? 'true' : 'false'}
      />
    );
  },
}));

jest.mock('../DebateMap/DebateMap.jsx', () => ({
  __esModule: true,
  default: (props) => {
    mockDebateMap(props);
    return (
      <div
        data-testid="mock-debate-map"
        data-demo-mode={typeof props.demoMode === 'undefined' ? '' : String(props.demoMode)}
      />
    );
  },
}));

jest.mock('../SurveyTool/SurveyGenerator/SurveyGenerator.jsx', () => ({
  __esModule: true,
  default: (props) => {
    mockAudioSurveyGenerator(props);
    return (
      <div
        data-testid="mock-audio-survey-generator"
        data-explorer-mode={props.explorerMode || ''}
        data-demo-surface-mode={typeof props.demoSurfaceMode === 'undefined' ? '' : String(props.demoSurfaceMode)}
      />
    );
  },
}));

jest.mock('./ToolExplorerPluginExplainer.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-explainer" />,
}));

const renderToolExplorer = (overrides = {}) => render(
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
  />
);

describe('ToolExplorer session propagation', () => {
  afterEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    if (originalPublicUrl === undefined) delete process.env.PUBLIC_URL;
    else process.env.PUBLIC_URL = originalPublicUrl;
  });

  it('passes the inherited active session slug into the embedded SurveyTool', async () => {
    renderToolExplorer();

    fireEvent.click(screen.getByText('Questions'));

    expect(await screen.findByTestId('mock-survey-tool')).toHaveAttribute('data-active-session-slug', 'demo');
    expect(mockSurveyTool).toHaveBeenCalledWith(
      expect.objectContaining({ activeSessionSlug: 'demo' })
    );
  });

  it('keeps the tooltip beside Back while grouping Groups actions on the opposite side', async () => {
    const { container } = renderToolExplorer({ activeSessionSlug: 'edge' });

    fireEvent.click(screen.getByText('Groups'));

    expect(await screen.findByTestId('mock-sbts-page')).toHaveAttribute('data-create-open', 'false');
    expect(screen.getByRole('button', { name: /^← Back$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^View All$/i })).toHaveAttribute('href', sbtsListPath());
    expect(screen.getByRole('button', { name: /^Create$/i })).toBeInTheDocument();

    const headerLead = container.querySelector(`.${styles.expandedHeaderLead}`);
    const headerActions = container.querySelector(`.${styles.expandedHeaderActions}`);
    expect(headerLead).toContainElement(screen.getByRole('button', { name: /^← Back$/i }));
    expect(headerLead).toContainElement(screen.getByTestId('mock-explainer'));
    expect(headerActions).toContainElement(screen.getByRole('link', { name: /^View All$/i }));
    expect(headerActions).toContainElement(screen.getByRole('button', { name: /^Create$/i }));

    expect(mockSBTsPage).toHaveBeenLastCalledWith(expect.objectContaining({
      hideMiniActionRow: true,
      showCreateGroupAboveFeatured: true,
      showCreateGroupExternal: false,
      onCreateGroupToggleExternal: expect.any(Function),
      activeSessionSlug: 'edge',
    }));

    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    expect(await screen.findByRole('button', { name: /^Exit$/i })).toBeInTheDocument();
    expect(screen.getByTestId('mock-sbts-page')).toHaveAttribute('data-create-open', 'true');
    expect(mockSBTsPage).toHaveBeenLastCalledWith(expect.objectContaining({
      hideMiniActionRow: true,
      showCreateGroupAboveFeatured: true,
      showCreateGroupExternal: true,
    }));
  });

  it('auto-opens the embedded Groups create panel from a cached draft', async () => {
    const cachedDraft = {
      sbtName: 'Cached Group',
      sbtDescription: 'Cached draft details',
    };
    sessionStorage.setItem(
      'createSbtFormCache',
      JSON.stringify(cachedDraft)
    );

    renderToolExplorer({ activeSessionSlug: 'edge' });

    fireEvent.click(screen.getByText('Groups'));

    expect(await screen.findByTestId('mock-sbts-page')).toHaveAttribute('data-create-open', 'true');
    expect(screen.getByRole('button', { name: /^Exit$/i })).toBeInTheDocument();
    expect(sessionStorage.getItem('createSbtFormCache')).toBeNull();
    expect(sessionStorage.getItem('dg:createSbtFormCache:edge')).toBe(
      JSON.stringify(cachedDraft)
    );
  });

  it('builds expanded header links against PUBLIC_URL for subpath deploys', async () => {
    process.env.PUBLIC_URL = '/ce/';

    renderToolExplorer({ activeSessionSlug: 'edge' });

    fireEvent.click(screen.getByText('Groups'));
    expect(await screen.findByRole('link', { name: /^View All$/i })).toHaveAttribute('href', `/ce${sbtsListPath()}`);
    fireEvent.click(screen.getByRole('button', { name: /^← Back$/i }));
    fireEvent.click(screen.getByText('Debate Tree'));
    expect(await screen.findByRole('link', { name: /^Full Screen$/i })).toHaveAttribute('href', '/ce/atlas');
  });

  it('shows Add/View controls for Data, defaults to Add, and resets after leaving', async () => {
    renderToolExplorer({ activeSessionSlug: 'edge' });

    fireEvent.click(screen.getByText('Data'));

    expect(await screen.findByTestId('mock-audio-survey-generator')).toHaveAttribute('data-explorer-mode', 'add');
    expect(screen.getByTestId(E2E_TESTIDS.TOOL_EXPLORER_DATA_ADD)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.TOOL_EXPLORER_DATA_VIEW)).toBeInTheDocument();
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(expect.objectContaining({
      explorerMode: 'add',
      activeSessionSlug: 'edge',
    }));

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.TOOL_EXPLORER_DATA_VIEW));

    expect(await screen.findByTestId('mock-audio-survey-generator')).toHaveAttribute('data-explorer-mode', 'view');
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(expect.objectContaining({
      explorerMode: 'view',
    }));

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.TOOL_EXPLORER_DATA_ADD));

    expect(await screen.findByTestId('mock-audio-survey-generator')).toHaveAttribute('data-explorer-mode', 'add');

    fireEvent.click(screen.getByRole('button', { name: /^← Back$/i }));
    fireEvent.click(screen.getByText('Data'));

    expect(await screen.findByTestId('mock-audio-survey-generator')).toHaveAttribute('data-explorer-mode', 'add');
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(expect.objectContaining({
      explorerMode: 'add',
    }));
  });

  it('passes demoSurfaceMode through to the expanded Data tool', async () => {
    renderToolExplorer({ activeSessionSlug: 'edge', demoSurfaceMode: false });

    fireEvent.click(screen.getByText('Data'));

    expect(await screen.findByTestId('mock-audio-survey-generator')).toHaveAttribute('data-demo-surface-mode', 'false');
    expect(mockAudioSurveyGenerator).toHaveBeenLastCalledWith(expect.objectContaining({
      explorerMode: 'add',
      demoSurfaceMode: false,
      activeSessionSlug: 'edge',
    }));
  });

  it.each([
    { demoSurfaceMode: null, expectedDemoMode: 'true' },
    { demoSurfaceMode: true, expectedDemoMode: 'true' },
  ])(
    'shows demo cards and the legend when demoSurfaceMode is $demoSurfaceMode',
    async ({ demoSurfaceMode, expectedDemoMode }) => {
      renderToolExplorer({ demoSurfaceMode });

      expect(screen.getByText('Debate Tree')).toBeInTheDocument();
      expect(screen.getByText('Risks')).toBeInTheDocument();
      expect(screen.getByText('Suggest Tool')).toBeInTheDocument();
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByText('Demo')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Debate Tree'));

      expect(await screen.findByTestId('mock-debate-map')).toHaveAttribute('data-demo-mode', expectedDemoMode);
    }
  );

  it('hides future demo cards and the entire legend row when demoSurfaceMode is false', () => {
    const { container } = renderToolExplorer({ demoSurfaceMode: false });

    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.queryByText('Debate Tree')).not.toBeInTheDocument();
    expect(screen.queryByText('Risks')).not.toBeInTheDocument();
    expect(screen.queryByText('Suggest Tool')).not.toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
    expect(screen.queryByText('Demo')).not.toBeInTheDocument();

    const explorerContainer = container.querySelector(`.${styles.explorerContainer}`);
    const explorerRow = container.querySelector(`.${styles.explorerRow}`);
    const explorerCols = Array.from(container.querySelectorAll(`.${styles.explorerCol}`));

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
      />
    );

    expect(screen.queryByTestId('mock-debate-map')).not.toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.queryByText('Debate Tree')).not.toBeInTheDocument();
  });
});
