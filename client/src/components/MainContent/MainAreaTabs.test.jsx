import React from 'react';
import { render, screen } from '@testing-library/react';
import MainAreaTabs, { MAIN_AREA_TABS } from './MainAreaTabs.jsx';

const mockToolExplorer = jest.fn();

jest.mock('./ToolExplorer.jsx', () => ({
  __esModule: true,
  default: (props) => {
    mockToolExplorer(props);
    return (
      <div
        data-testid="mock-tool-explorer"
        data-demo-surface-mode={typeof props.demoSurfaceMode === 'undefined' ? '' : String(props.demoSurfaceMode)}
      />
    );
  },
}));

jest.mock('./OnboardingWalkthrough.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-onboarding-walkthrough" />,
}));

jest.mock('../CommunityTab/CommunityTab.jsx', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-community-tab" />,
}));

const createProps = (overrides = {}) => ({
  focusedTab: MAIN_AREA_TABS.TOOLS,
  changeFocusedTab: jest.fn(),
  toggleLoginModal: jest.fn(),
  toggleDemoMode: jest.fn(),
  demoMode: { tools: false },
  demoSurfaceMode: true,
  provider: {},
  network: { id: 84532 },
  account: '0x1111111111111111111111111111111111111111',
  loginComplete: false,
  loginInProgress: false,
  activeSessionSlug: 'demo',
  isQuestionCacheReady: true,
  isSurveyCacheReady: true,
  isSBTCacheReady: true,
  sbtCacheRevision: 0,
  sbtRealtimeCoverageBySlug: {},
  ensureLightSbtDiscovery: jest.fn(),
  ensureLightSbtUniverse: jest.fn(),
  ...overrides,
});

describe('MainAreaTabs', () => {
  it('omits the empty Votes tab while keeping the Tool Explorer tab available', async () => {
    render(<MainAreaTabs {...createProps()} />);

    expect(screen.queryByText('Votes')).not.toBeInTheDocument();
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(await screen.findByTestId('mock-tool-explorer')).toBeInTheDocument();
    expect(screen.getByTestId('mock-tool-explorer')).toHaveAttribute('data-demo-surface-mode', 'true');
  });

  it('passes demoSurfaceMode through to ToolExplorer on the Tools tab', async () => {
    render(<MainAreaTabs {...createProps({ demoSurfaceMode: false })} />);

    expect(await screen.findByTestId('mock-tool-explorer')).toHaveAttribute('data-demo-surface-mode', 'false');
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
      />
    );

    expect(changeFocusedTab).not.toHaveBeenCalled();
    expect(screen.queryByTestId('mock-tool-explorer')).not.toBeInTheDocument();
  });
});
