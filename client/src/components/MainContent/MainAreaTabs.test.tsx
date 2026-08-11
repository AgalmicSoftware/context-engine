import React from 'react';
import { render, screen } from '@testing-library/react';
import MainAreaTabs, { MAIN_AREA_TABS } from './MainAreaTabs';

const mockToolExplorer = jest.fn();

jest.mock('./ToolExplorer', () => ({
  __esModule: true,
  default: (props: any) => {
    mockToolExplorer(props);
    return (
      <div
        data-testid="mock-tool-explorer"
        data-demo-surface-mode={typeof props.demoSurfaceMode === 'undefined' ? '' : String(props.demoSurfaceMode)}
      />
    );
  },
}));

jest.mock('./OnboardingWalkthrough', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-onboarding-walkthrough" />,
}));

jest.mock('../CommunityTab/CommunityTab', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-community-tab" />,
}));

const createProps = (overrides: Record<string, unknown> = {}) => ({
  focusedTab: MAIN_AREA_TABS.TOOLS,
  changeFocusedTab: jest.fn(),
  toggleLoginModal: jest.fn(),
  toggleDemoMode: jest.fn(),
  demoMode: { tools: false },
  demoSurfaceMode: true,
  provider: {},
  network: { id: 84532 },
  networkChainId: 84532,
  sessionConfig: { slug: 'demo', storageProfile: { backend: 'cloudflare' } },
  account: '0x1111111111111111111111111111111111111111',
  loginComplete: false,
  loginInProgress: false,
  activeSessionSlug: 'demo',
  isQuestionCacheReady: true,
  isResponsesCacheReady: true,
  isSurveyCacheReady: true,
  isSBTCacheReady: true,
  sbtCacheRevision: 0,
  sbtRealtimeCoverageBySlug: {},
  questionResponsesNonce: 7,
  questionScanProgress: { slug: 'demo', phase: 'hydrate', discoveredQuestions: 3 },
  ensureLightSbtDiscovery: jest.fn(),
  ensureLightSbtUniverse: jest.fn(),
  ...overrides,
});

describe('MainAreaTabs', () => {
  it('omits the empty Votes tab while keeping the Tool Explorer tab available', async () => {
    const { container } = render(<MainAreaTabs {...createProps()} />);

    expect(screen.queryByText('Votes')).not.toBeInTheDocument();
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.getByText('Stats')).toBeInTheDocument();
    expect(screen.queryByText('Community')).not.toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(container.querySelector('.mainAreaTabsAlt')).toBeInTheDocument();
    expect(container.querySelector('.mainTabsCard')).toBeInTheDocument();
    expect(container.querySelector('.mainTabsCardHeader')).toBeInTheDocument();
    expect(container.querySelector('.mainAreaCardBody')).toBeInTheDocument();
    expect(container.querySelectorAll('.navTabIcon')).toHaveLength(4);
    expect(await screen.findByTestId('mock-tool-explorer')).toBeInTheDocument();
    expect(screen.getByTestId('mock-tool-explorer')).toHaveAttribute('data-demo-surface-mode', 'true');
  });

  it('passes demoSurfaceMode through to ToolExplorer on the Tools tab', async () => {
    render(<MainAreaTabs {...createProps({ demoSurfaceMode: false })} />);

    expect(await screen.findByTestId('mock-tool-explorer')).toHaveAttribute('data-demo-surface-mode', 'false');
  });

  it('passes the active session cache context through to the embedded explorer', async () => {
    const props = createProps();
    render(<MainAreaTabs {...props} />);

    await screen.findByTestId('mock-tool-explorer');
    expect(mockToolExplorer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeSessionSlug: 'demo',
        sessionConfig: props.sessionConfig,
        networkChainId: 84532,
        isResponsesCacheReady: true,
        questionResponsesNonce: 7,
        questionScanProgress: props.questionScanProgress,
      }),
    );
  });

  it('renders the onboarding walkthrough on the Welcome tab', async () => {
    render(<MainAreaTabs {...createProps({ focusedTab: MAIN_AREA_TABS.WELCOME })} />);

    expect(await screen.findByTestId('mock-onboarding-walkthrough')).toBeInTheDocument();
  });

  it('preserves stale removed tab ids without normalizing them to the Tools tab on mount', () => {
    const changeFocusedTab = jest.fn();

    render(
      <MainAreaTabs
        {...createProps({
          focusedTab: 2,
          changeFocusedTab,
        })}
      />,
    );

    expect(changeFocusedTab).not.toHaveBeenCalled();
    expect(screen.queryByTestId('mock-tool-explorer')).not.toBeInTheDocument();
  });
});
