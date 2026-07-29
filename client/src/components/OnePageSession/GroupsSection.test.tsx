import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import OnePageSessionGroupsSection, { type GroupsSectionProps } from './GroupsSection';

const mockWorkerGroupsPanel = jest.fn();
const mockSbtGroupsPage = jest.fn();

jest.mock('../../utilities/ui/terminology.js', () => ({
  isCryptoMode: () => true,
  t: (key: unknown) => (key === 'sbts' ? 'SBTs' : String(key || '')),
}));

jest.mock('./WorkerSessionGroupsPanel', () => (props: unknown) => {
  mockWorkerGroupsPanel(props);
  return <div data-testid="worker-groups-panel">Native Worker Groups</div>;
});

jest.mock('../SBTs/SBTsPage', () => (props: unknown) => {
  mockSbtGroupsPage(props);
  return <div data-testid="sbt-groups-page">Registry SBT Groups</div>;
});

const ADMIN = '0x00000000000000000000000000000000000000aa';
const SBT_CONTRACT = '0x00000000000000000000000000000000000000bb';

const workerConfig = () => ({
  slug: 'alpha',
  corsWorkerUrl: 'https://alpha-worker.example',
  adminAddress: ADMIN,
  // Legacy metadata must not change the validated Worker-native routing decision.
  networkChainId: 11155420,
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
});

const buildProps = (sessionConfig: unknown): GroupsSectionProps => ({
  account: ADMIN,
  autoMintingMode: false,
  blockLimits: { start: null, end: null },
  contracts: {},
  defaultFeaturedSBTs: [],
  defaultSbtTags: '',
  embeddedGroupsSessionConfig: sessionConfig,
  embeddedGroupsSessionSlug: 'alpha',
  ensureLightSbtDiscovery: jest.fn(),
  ensureLightSbtUniverse: jest.fn(),
  isSBTCacheReady: true,
  loginComplete: true,
  network: { id: 11155420 },
  networkChainId: 11155420,
  provider: {},
  refreshSbtData: jest.fn(),
  resolvedSessionConfig: sessionConfig,
  sbtRealtimeCoverageBySlug: {},
  sbtScanProgressBySlug: {},
  sessionInfo: 'Session info',
  sessionName: 'Alpha',
  showEmbeddedCreateGroup: false,
  showGroups: true,
  toggleLoginModal: jest.fn(),
  onGroupsViewAll: jest.fn(),
  onToggleEmbeddedCreateGroup: jest.fn(),
  onToggleGroups: jest.fn(),
});

describe('OnePageSessionGroupsSection authority routing', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders only native Groups for a validated pure Worker profile even with legacy chain metadata', () => {
    const config = workerConfig();
    const props = buildProps(config);
    render(<OnePageSessionGroupsSection {...props} />);

    expect(screen.getByTestId('worker-groups-panel')).toBeInTheDocument();
    expect(screen.getByText('Groups', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('SBTs', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sbt-groups-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-session-advanced-onchain-access-gates')).not.toBeInTheDocument();
    expect(mockWorkerGroupsPanel).toHaveBeenCalledWith(
      expect.objectContaining({ sessionConfig: config, sessionSlug: 'alpha' }),
    );
    expect(mockSbtGroupsPage).not.toHaveBeenCalled();
    expect(props.ensureLightSbtDiscovery).not.toHaveBeenCalled();
    expect(props.ensureLightSbtUniverse).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Refresh groups' })).toBeInTheDocument();
    expect(mockWorkerGroupsPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        refreshNonce: 0,
        showGroupDescriptions: false,
        showMembershipListHeader: false,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh groups' }));
    expect(mockWorkerGroupsPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        refreshNonce: 1,
        showGroupDescriptions: false,
        showMembershipListHeader: false,
      }),
    );
  });

  it('shows participant creation for an opted-in Worker session and keeps legacy Worker sessions admin-only', () => {
    const participantConfig = { ...workerConfig(), groupCreationPolicy: 'participants' };
    const participantProps = {
      ...buildProps(participantConfig),
      account: '0x00000000000000000000000000000000000000cc',
    };
    const { rerender } = render(<OnePageSessionGroupsSection {...participantProps} />);

    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();

    const legacyConfig = workerConfig();
    rerender(
      <OnePageSessionGroupsSection
        {...buildProps(legacyConfig)}
        account="0x00000000000000000000000000000000000000cc"
      />,
    );
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
  });

  it('keeps native Groups primary for a Worker+SBT hybrid and shows only configured Advanced conditions', () => {
    const config = workerConfig();
    config.sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    config.sessionModeProfile.evm.registryChainId = 11155420;
    config.sessionModeProfile.authorization.mechanisms.push('sbt_onchain');
    config.sessionModeProfile.encryption.accessConditions = {
      match: 'all',
      conditions: [
        {
          kind: 'sbt_onchain',
          chainId: 11155420,
          contract: SBT_CONTRACT,
          anyOrAll: 'all',
        },
      ],
    };
    const props = buildProps(config);
    render(<OnePageSessionGroupsSection {...props} />);

    expect(screen.getByTestId('worker-groups-panel')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Advanced on-chain access gates' })).toBeInTheDocument();
    expect(screen.getByText(SBT_CONTRACT)).toBeInTheDocument();
    expect(screen.getByText(/Chain 11155420 · match all/)).toBeInTheDocument();
    expect(screen.getByText(/Native Groups remain Worker-owned/)).toBeInTheDocument();
    expect(mockSbtGroupsPage).not.toHaveBeenCalled();
    expect(props.ensureLightSbtDiscovery).not.toHaveBeenCalled();
    expect(props.ensureLightSbtUniverse).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid', { ...workerConfig(), sessionModeProfile: { authority: { mode: 'worker_canonical' } } }],
    ['missing', { slug: 'alpha', corsWorkerUrl: 'https://alpha-worker.example' }],
  ])('fails closed for a %s session profile without mounting Worker or SBT collections', (_label, config) => {
    render(<OnePageSessionGroupsSection {...buildProps(config)} />);

    expect(screen.getByText('Groups', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('SBTs', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-session-groups-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('worker-groups-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sbt-groups-page')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View All|Create/i })).not.toBeInTheDocument();
  });

  it.each([
    [
      'validated registry',
      {
        slug: 'alpha',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      },
    ],
    [
      'strong legacy registry',
      {
        slug: 'alpha',
        __registry: {
          registryChainId: 11155420,
          sessionIdHex: '0x00112233445566778899aabbccddeeff',
        },
      },
    ],
  ])('preserves the existing SBT collection for a %s session', (_label, config) => {
    const props = buildProps(config);
    render(<OnePageSessionGroupsSection {...props} />);

    expect(screen.getByTestId('sbt-groups-page')).toBeInTheDocument();
    expect(screen.getByText('SBTs', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByTestId('worker-groups-panel')).not.toBeInTheDocument();
    expect(mockSbtGroupsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionSlug: 'alpha',
        sessionConfig: config,
        ensureLightSbtDiscovery: props.ensureLightSbtDiscovery,
        ensureLightSbtUniverse: props.ensureLightSbtUniverse,
      }),
    );
  });

  it('applies the selected creation policy to registry-backed session controls', () => {
    const config = {
      slug: 'alpha',
      groupCreationPolicy: 'admin_only',
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      __registry: {
        registryChainId: 11155420,
        adminAddress: ADMIN,
        sessionIdHex: '0x00112233445566778899aabbccddeeff',
      },
    };
    const props = {
      ...buildProps(config),
      account: '0x00000000000000000000000000000000000000cc',
    };
    const { rerender } = render(<OnePageSessionGroupsSection {...props} />);
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();

    rerender(
      <OnePageSessionGroupsSection
        {...buildProps({ ...config, groupCreationPolicy: 'participants' })}
        account="0x00000000000000000000000000000000000000cc"
      />,
    );
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });
});
