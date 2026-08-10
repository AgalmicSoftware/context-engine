import React, { act } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { clearAgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import { MetaMaskLoginButton } from '../../app/runtime/walletUiRuntime.js';
import styles from './Account.module.scss';

jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => null,
}));

jest.mock('../HooksHOC/withWagmiBridge', () => ({
  WagmiHooksHOC: (Comp) => Comp,
}));

jest.mock('./LoginSettingsAiConfigContent', () => ({
  __esModule: true,
  default: () => require('react').createElement('input', { placeholder: 'Sponsored key configured' }),
}));

jest.mock('./LoginSettingsResourceKeysContent', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('components/UserPage/UserPage', () => (props) => (
  <div
    data-testid="mock-user-page"
    data-view-address={props.viewAddress || ''}
    data-active-session-slug={props.activeSessionSlug || ''}
    data-network-chain-id={props.networkChainId || ''}
    data-session-config-chain-id={props.sessionConfig?.networkChainId || ''}
  />
));

jest.mock('../Shared/CETooltip', () => ({
  __esModule: true,
  default: (props) => (
    <div data-testid={`mock-tooltip-${props.target || 'unknown'}`} data-placement={props.placement || ''} />
  ),
}));

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  default: {
    sendTestnetFunds: jest.fn(),
  },
  getDemoSessionConfigBySlug: jest.fn(() => null),
  getSessionNetwork: jest.fn(() => ({ id: 84532, chainId: 84532, name: 'Base Sepolia' })),
  getSessionConfigBySlugOrDefault: jest.fn(() => ({})),
  getAllSessionSlugs: jest.fn(() => []),
}));

jest.mock('../../wallet/passkeyWallet.js', () => ({
  createPasskeyWallet: jest.fn(),
  getPasskeyWalletChain: jest.fn(() => null),
  isMissingPasskeyWalletRecordError: jest.fn((error) => error?.code === 'CE_PASSKEY_WALLET_RECORD_MISSING'),
  unlockPasskeyWallet: jest.fn(),
  logoutPasskeyWallet: jest.fn(),
  restorePasskeyWalletSession: jest.fn(async () => null),
  setPasskeyWalletChain: jest.fn(),
}));

jest.mock('../../utilities/ai/aiSettings.js', () => {
  const actual = jest.requireActual('../../utilities/ai/aiSettings.js');
  return {
    __esModule: true,
    ...actual,
    getSessionAiSettings: jest.fn(() => null),
    getLocalAiSettings: jest.fn(() => ({
      useLocal: false,
      providers: {
        anthropic: { apiKey: '' },
        openai: { apiKey: '' },
        custom: { rpcUrl: '' },
      },
    })),
    saveLocalAiSettings: jest.fn((next) => next),
    clearLocalAiSettings: jest.fn(),
    deriveAiPreset: jest.fn(() => 'gpt-5'),
    toModelLeaf: jest.fn((m) =>
      String(m || '')
        .toLowerCase()
        .split('/')
        .pop(),
    ),
  };
});

jest.mock('../../utilities/session/resourceKeys.js', () => ({
  getLocalSessionResourceKeys: jest.fn(() => ({})),
  saveLocalResourceKeys: jest.fn(),
  clearLocalResourceKeys: jest.fn(),
}));

jest.mock('../../utilities/web3/sponsoredAccess.js', () => ({
  checkSponsoredAccess: jest.fn(async () => ({ status: 'unknown' })),
}));

jest.mock('../../utilities/worker/workerAuth.js', () => ({
  getWorkerSessionToken: jest.fn(async () => null),
  clearAllWorkerSessionTokens: jest.fn(),
}));

jest.mock('../../utilities/session/sessionNaming.js', () => ({
  normalizeSessionSlug: jest.fn((value = '') => {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    return normalized === 'general' ? '' : normalized;
  }),
  resolveActiveSessionSlug: jest.fn(
    ({ activeSessionSlug = '', sessionSlug = '' } = {}) => activeSessionSlug || sessionSlug || '',
  ),
}));

jest.mock('../../utilities/session/sessionScanScope.js', () => ({
  normalizeSessionScanScope: jest.fn((value) => value || 'all'),
  normalizeSessionScanSlugs: jest.fn((value) => value || []),
  readSessionScanScope: jest.fn(() => 'all'),
  readSessionScanSlugs: jest.fn(() => []),
  writeSessionScanScope: jest.fn(),
  writeSessionScanSlugs: jest.fn(),
}));

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  initCacheManager: jest.fn(async () => undefined),
  listNamespaceEntriesSync: jest.fn(() => []),
  removeCache: jest.fn(async () => true),
}));

import { LoginAndSettingsModal, buildBookmarksRoutePath } from './LoginAndSettingsModal';
import contractScripts from '../../utilities/web3/contractScripts.js';
import * as passkeyWallet from '../../wallet/passkeyWallet.js';
import { saveLocalAiSettings } from '../../utilities/ai/aiSettings.js';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import { clearAllWorkerSessionTokens } from '../../utilities/worker/workerAuth.js';
import {
  getAllSessionSlugs,
  getSessionConfigBySlugOrDefault,
  getSessionNetwork,
} from '../../utilities/web3/contractScripts.js';

const DEFAULT_NETWORK = {
  id: 84532,
  chainId: 84532,
  name: 'Base Sepolia',
  testnet: true,
};

const PASSKEY_ADDRESS = '0x1111111111111111111111111111111111111111';
const WAGMI_ADDRESS = '0x2222222222222222222222222222222222222222';
const RAW_AGENT_TOKEN = 'ceagt_abcdefghijklmnopqrstuvwxyz123456';
const ORIGINAL_TERMINOLOGY_MODE = process.env.REACT_APP_TERMINOLOGY_MODE;
const ORIGINAL_PUBLIC_URL = process.env.PUBLIC_URL;

const buildRegistrySessionConfig = (overrides = {}) => {
  const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
  const chainId = Number(overrides.networkChainId || 84532);
  if (sessionModeProfile.evm.registryChainId !== chainId) {
    sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  }
  sessionModeProfile.evm.registryChainId = chainId;
  return {
    networkChainId: chainId,
    sessionModeProfile,
    ...overrides,
  };
};

const buildPureWorkerSessionConfig = (overrides = {}) => ({
  slug: 'demo-sh',
  sessionName: 'Demo Session',
  corsWorkerUrl: 'https://demo-sh.example.test',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  ...overrides,
});

const buildHybridWorkerSessionConfig = (overrides = {}) => {
  const sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  sessionModeProfile.evm.registryChainId = 11155420;
  sessionModeProfile.encryption = { mode: 'lit' };
  sessionModeProfile.storage.payloadAccessControl = {
    ...sessionModeProfile.storage.payloadAccessControl,
    encryption: 'lit',
  };
  return {
    slug: 'hybrid',
    sessionName: 'Hybrid Session',
    corsWorkerUrl: 'https://hybrid.example.test',
    sessionModeProfile,
    ...overrides,
  };
};

const treeHasElementType = (node, expectedType) => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasElementType(child, expectedType));
  if (typeof node !== 'object') return false;
  if (node.type === expectedType) return true;
  return treeHasElementType(node.props?.children, expectedType);
};

const buildProps = (overrides = {}) => ({
  account: '',
  activeSessionSlug: '',
  changeAccount: jest.fn(),
  changeActiveSessionSlug: jest.fn(),
  changeFocusedTab: jest.fn(),
  demoMode: { tools: false },
  demoSurfaceMode: true,
  loginComplete: false,
  loginInProgress: false,
  loginModalToggled: true,
  network: DEFAULT_NETWORK,
  openAccountModal: jest.fn(),
  openConnectModal: jest.fn(),
  provider: null,
  primarySessionExplicit: false,
  setDemoSurfaceMode: jest.fn(),
  selectedSessionScope: 'active',
  selectedSessionSlugs: [],
  toggleDemoMode: jest.fn(),
  toggleLoginModal: jest.fn(),
  toggleTooltips: jest.fn(),
  tooltipsEnabled: true,
  updateLoginInfo: jest.fn(),
  updateGlobalSessionSelection: jest.fn(),
  wagmiDisconnect: jest.fn(),
  ...overrides,
});

const restoreTerminologyMode = () => {
  if (typeof ORIGINAL_TERMINOLOGY_MODE === 'undefined') {
    delete process.env.REACT_APP_TERMINOLOGY_MODE;
    return;
  }
  process.env.REACT_APP_TERMINOLOGY_MODE = ORIGINAL_TERMINOLOGY_MODE;
};

const restorePublicUrl = () => {
  if (typeof ORIGINAL_PUBLIC_URL === 'undefined') {
    delete process.env.PUBLIC_URL;
    return;
  }
  process.env.PUBLIC_URL = ORIGINAL_PUBLIC_URL;
};

const loadIsolatedSettingsModal = () => {
  jest.resetModules();
  jest.doMock('react', () => React);
  let loaded;

  jest.isolateModules(() => {
    loaded = {
      LoginAndSettingsModal: require('./LoginAndSettingsModal').LoginAndSettingsModal,
      getAllSessionSlugs: require('../../utilities/web3/contractScripts.js').getAllSessionSlugs,
      getSessionConfigBySlugOrDefault: require('../../utilities/web3/contractScripts.js')
        .getSessionConfigBySlugOrDefault,
      checkSponsoredAccess: require('../../utilities/web3/sponsoredAccess.js').checkSponsoredAccess,
    };
  });

  jest.dontMock('react');

  return loaded;
};

const buildWrongNetworkSubject = ({ mode = undefined, aiSettingsOpen = false, activeSessionSlug = 'edge' } = {}) => {
  if (typeof mode === 'undefined') {
    delete process.env.REACT_APP_TERMINOLOGY_MODE;
  } else {
    process.env.REACT_APP_TERMINOLOGY_MODE = mode;
  }

  const {
    LoginAndSettingsModal: IsolatedLoginAndSettingsModal,
    getAllSessionSlugs: isolatedGetAllSessionSlugs,
    getSessionConfigBySlugOrDefault: isolatedGetSessionConfigBySlugOrDefault,
    checkSponsoredAccess: isolatedCheckSponsoredAccess,
  } = loadIsolatedSettingsModal();

  isolatedGetAllSessionSlugs.mockReturnValue([]);
  isolatedGetSessionConfigBySlugOrDefault.mockImplementation((slug) =>
    String(slug || '')
      .trim()
      .toLowerCase() === 'edge'
      ? sessionConfig ||
        buildRegistrySessionConfig({
          slug: 'edge',
          sessionName: 'Edge Session',
          sponsoredKeys: { rpc: 'edge-rpc' },
        })
      : {},
  );
  isolatedCheckSponsoredAccess.mockImplementation(async () => ({ status: 'unknown' }));

  const subject = new IsolatedLoginAndSettingsModal(
    buildProps({
      account: WAGMI_ADDRESS,
      activeSessionSlug,
      loginComplete: true,
      provider: 'wagmi',
      wagmiAddress: WAGMI_ADDRESS,
      wagmiNetwork: {
        id: 8453,
        chainId: 8453,
        name: 'Base',
      },
    }),
  );

  if (aiSettingsOpen) {
    subject.state = {
      ...subject.state,
      aiSettingsOpen: true,
    };
  }

  return subject;
};

const getPasskeyLoginButton = () =>
  screen.getAllByRole('button').find((button) => button.textContent.trim() === 'Login');

const clickAndSettle = async (element) => {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
    await Promise.resolve();
  });
};

const openPreLoginSettingsDrawer = async () => {
  await clickAndSettle(screen.getByRole('button', { name: 'Toggle pre-login settings' }));
};

const openPreLoginConfigPanel = async () => {
  await clickAndSettle(screen.getByTestId('ce-prelogin-config-toggle'));
};

afterEach(() => {
  restoreTerminologyMode();
  restorePublicUrl();
  jest.resetModules();
});

describe('LoginAndSettingsModal rendered auth flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    passkeyWallet.createPasskeyWallet.mockReset();
    passkeyWallet.getPasskeyWalletChain.mockReset();
    passkeyWallet.getPasskeyWalletChain.mockReturnValue(null);
    passkeyWallet.isMissingPasskeyWalletRecordError.mockReset();
    passkeyWallet.isMissingPasskeyWalletRecordError.mockImplementation(
      (error) => error?.code === 'CE_PASSKEY_WALLET_RECORD_MISSING',
    );
    passkeyWallet.unlockPasskeyWallet.mockReset();
    passkeyWallet.logoutPasskeyWallet.mockReset();
    passkeyWallet.restorePasskeyWalletSession.mockReset();
    passkeyWallet.restorePasskeyWalletSession.mockResolvedValue(null);
    passkeyWallet.setPasskeyWalletChain.mockReset();
    getAllSessionSlugs.mockReturnValue([]);
    getSessionConfigBySlugOrDefault.mockImplementation(() => ({}));
    checkSponsoredAccess.mockImplementation(async () => ({ status: 'unknown' }));
  });

  it('resolves a signed-out pure Worker session and presents passkey as its only identity path', () => {
    getSessionConfigBySlugOrDefault.mockImplementation((slug) =>
      slug === 'demo-sh' ? buildPureWorkerSessionConfig() : {},
    );
    const subject = new LoginAndSettingsModal(buildProps({ activeSessionSlug: 'demo-sh' }));

    const tree = subject.getModalDisplay();
    render(tree);

    expect(getSessionConfigBySlugOrDefault).toHaveBeenCalledWith('demo-sh');
    expect(screen.getByText('Account uses a passkey:')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ethereum wallet' })).not.toBeInTheDocument();
    expect(screen.queryByText('test network only')).not.toBeInTheDocument();
    expect(treeHasElementType(tree, MetaMaskLoginButton)).toBe(false);
  });

  it('retains the signed-out wallet identity path for registry sessions', () => {
    getSessionConfigBySlugOrDefault.mockImplementation((slug) =>
      slug === 'registry' ? buildRegistrySessionConfig({ slug: 'registry' }) : {},
    );
    const subject = new LoginAndSettingsModal(buildProps({ activeSessionSlug: 'registry' }));

    const tree = subject.getModalDisplay();
    render(tree);

    expect(getSessionConfigBySlugOrDefault).toHaveBeenCalledWith('registry');
    expect(screen.getByRole('link', { name: 'Ethereum wallet' })).toBeInTheDocument();
    expect(screen.getByText('test network only')).toBeInTheDocument();
    expect(treeHasElementType(tree, MetaMaskLoginButton)).toBe(true);
  });

  it.each([
    [
      'missing',
      {
        slug: 'unavailable',
        networkChainId: 11155420,
      },
    ],
    [
      'invalid',
      {
        slug: 'unavailable',
        networkChainId: 11155420,
        sessionModeProfile: {
          profileVersion: 1,
          authority: { mode: 'worker_canonical' },
        },
      },
    ],
  ])('fails closed for a concrete %s capability profile instead of inferring wallet auth', (_label, config) => {
    getSessionConfigBySlugOrDefault.mockImplementation((slug) => (slug === 'unavailable' ? config : {}));
    const subject = new LoginAndSettingsModal(buildProps({ activeSessionSlug: 'unavailable' }));

    const tree = subject.getModalDisplay();
    render(tree);

    expect(screen.getByTestId('ce-session-identity-unavailable')).toHaveTextContent(
      /capability profile is unavailable or invalid/i,
    );
    expect(screen.queryByRole('link', { name: 'Ethereum wallet' })).not.toBeInTheDocument();
    expect(screen.queryByText('test network only')).not.toBeInTheDocument();
    expect(treeHasElementType(tree, MetaMaskLoginButton)).toBe(false);
  });

  it('retains the signed-out wallet access path for validated Worker hybrids', () => {
    const hybridConfig = buildHybridWorkerSessionConfig();
    expect(resolveSessionCapabilityProjection(hybridConfig)).toMatchObject({
      profileValid: true,
      isWorkerCanonical: true,
      isPureWorkerCanonical: false,
      usesRpc: true,
    });
    getSessionConfigBySlugOrDefault.mockImplementation((slug) => (slug === 'hybrid' ? hybridConfig : {}));
    const subject = new LoginAndSettingsModal(buildProps({ activeSessionSlug: 'hybrid' }));

    const tree = subject.getModalDisplay();
    render(tree);

    expect(screen.getByText('Account uses a passkey:')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ethereum wallet' })).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-advanced-wallet-access')).toHaveTextContent('Advanced on-chain access');
    expect(screen.getByTestId('ce-advanced-wallet-access')).toHaveTextContent(
      "Use an Ethereum wallet only for this session's optional on-chain gates.",
    );
    expect(screen.getByText('test network only')).toBeInTheDocument();
    expect(treeHasElementType(tree, MetaMaskLoginButton)).toBe(true);
  });

  it('renders passkey auth without a MetaMask login control by default', () => {
    const props = buildProps();
    const subject = new LoginAndSettingsModal(props);

    render(subject.getModalDisplay());

    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(getPasskeyLoginButton()).toBeTruthy();
    expect(screen.getByText('test network only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Crypto Login (RainbowKit)' })).not.toBeInTheDocument();
    expect(screen.queryByAltText('MetaMask')).not.toBeInTheDocument();
    expect(props.openConnectModal).not.toHaveBeenCalled();
  });

  it('shows an inline recovery hint when login has no stored passkey wallet record', async () => {
    const missingWalletError = Object.assign(new Error('No encrypted passkey wallet is saved in this browser.'), {
      code: 'CE_PASSKEY_WALLET_RECORD_MISSING',
    });
    passkeyWallet.unlockPasskeyWallet.mockRejectedValueOnce(missingWalletError);

    render(<LoginAndSettingsModal {...buildProps()} />);

    const loginButton = getPasskeyLoginButton();
    expect(loginButton).toBeTruthy();
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByTestId('ce-passkey-wallet-status')).toHaveTextContent(
        /No passkey wallet is saved in this browser/i,
      );
    });
  });

  it('renders the full auth modal with a centered dialog wrapper', async () => {
    render(<LoginAndSettingsModal {...buildProps()} />);

    await waitFor(() => {
      const dialog = document.body.querySelector(`.modal-dialog.${styles.web3ModalDialog}`);
      const content = document.body.querySelector(`.modal-content.${styles.web3ModalContent}`);

      expect(dialog).toBeTruthy();
      expect(dialog).toHaveClass('modal-dialog-centered');
      expect(content).toBeTruthy();
    });
  });

  it('keeps a single accessible close button in the full auth modal shell', async () => {
    render(<LoginAndSettingsModal {...buildProps()} />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(1);
    });
  });

  it('shows the old network-style active session row up top and keeps network details out of the collapsed row in plain mode', () => {
    const subject = buildWrongNetworkSubject();

    render(subject.getSettingsDisplay());

    expect(screen.getByText('SESSION')).toBeInTheDocument();
    expect(screen.getAllByText('Edge Session').length).toBeGreaterThan(0);
    const sessionLink = screen.getByRole('link', { name: 'Open session Edge Session' });
    expect(sessionLink).toHaveAttribute('href', '/session/edge');
    expect(sessionLink).not.toHaveAttribute('target');
    expect(screen.queryByText('session:')).not.toBeInTheDocument();
    expect(screen.queryByText('network:')).not.toBeInTheDocument();
    expect(screen.queryByText('wallet:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Switch to Base Sepolia' })).not.toBeInTheDocument();
  });

  it('builds the active-session link from the slug instead of the visible session name', () => {
    const subject = buildWrongNetworkSubject();

    render(subject.getSettingsDisplay());

    const sessionLink = screen.getByRole('link', { name: 'Open session Edge Session' });
    expect(sessionLink).toHaveAttribute('href', '/session/edge');
    expect(sessionLink).not.toHaveAttribute('href', '/session/Edge%20Session');
  });

  it('shows worker session access and AI state without chain resource controls', () => {
    const subject = buildWrongNetworkSubject({
      mode: 'crypto',
      aiSettingsOpen: true,
      sessionConfig: {
        slug: 'edge',
        sessionName: 'Edge Session',
        corsWorkerUrl: 'https://edge-worker.example.test',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      },
    });
    subject.state = {
      ...subject.state,
      aiSettingsSectionsOpen: {
        ...subject.state.aiSettingsSectionsOpen,
        session: true,
      },
    };

    render(subject.getSettingsDisplay());

    expect(screen.getByTestId('ce-settings-worker-session-access')).toHaveTextContent(
      /Passkey session access: signed in.*Session Worker: configured.*AI: session default/i,
    );
    expect(screen.queryByText('Network')).not.toBeInTheDocument();
    expect(screen.queryByText('RPC')).not.toBeInTheDocument();
    expect(screen.queryByText('Arweave')).not.toBeInTheDocument();
    expect(screen.queryByText('Tx gas')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resource keys/i })).not.toBeInTheDocument();
  });

  it('keeps the bundled app colors and theme control as the final signed-in settings section', () => {
    const subject = buildWrongNetworkSubject({ aiSettingsOpen: true });

    render(subject.getSettingsDisplay());

    const aiConfigSection = screen.getByRole('button', { name: /AI config/i });
    const appearanceSection = screen.getByRole('button', { name: /Appearance & colors/i });
    expect(aiConfigSection.compareDocumentPosition(appearanceSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('ce-settings-theme')).toHaveAccessibleName('App theme');
  });

  it('preserves PUBLIC_URL when building the active-session link', () => {
    process.env.PUBLIC_URL = '/ce/';
    const subject = buildWrongNetworkSubject();

    render(subject.getSettingsDisplay());

    expect(screen.getByRole('link', { name: 'Open session Edge Session' })).toHaveAttribute('href', '/ce/session/edge');
  });

  it('preserves PUBLIC_URL when building the Bookmarks route', () => {
    process.env.PUBLIC_URL = '/ce/';

    expect(buildBookmarksRoutePath()).toBe('/ce/bookmarks');
  });

  it('falls back to the general session route when no active session slug exists', () => {
    const subject = buildWrongNetworkSubject({ activeSessionSlug: '' });

    render(subject.getSettingsDisplay());

    expect(screen.getByRole('link', { name: 'Open session general' })).toHaveAttribute('href', '/session');
  });

  it('renders the list-derived primary session in the summary when list scope excludes general', () => {
    const subject = buildWrongNetworkSubject({ activeSessionSlug: 'edge' });
    subject.props = {
      ...subject.props,
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['edge'],
    };
    subject.state = {
      ...subject.state,
      sessionScanScope: 'list',
      sessionScanSlugs: ['edge'],
    };

    render(subject.getSettingsDisplay());

    expect(screen.getByRole('link', { name: 'Open session Edge Session' })).toHaveAttribute('href', '/session/edge');
  });

  it('shows network details inside the expanded panel in plain mode when wagmi is on the wrong chain', () => {
    const subject = buildWrongNetworkSubject({ aiSettingsOpen: true });

    render(subject.getSettingsDisplay());

    expect(screen.getAllByText('Edge Session').length).toBeGreaterThan(0);
    expect(screen.queryByText('session:')).not.toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('Base Sepolia')).toBeInTheDocument();
    expect(screen.getByText('Wallet')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Base Sepolia' })).toBeInTheDocument();
  });

  it('keeps the network summary in the top row in crypto mode with corrected wording', () => {
    const subject = buildWrongNetworkSubject({ mode: 'crypto' });

    render(subject.getSettingsDisplay());

    expect(screen.getByText('Edge Session')).toBeInTheDocument();
    expect(screen.queryByText('session:')).not.toBeInTheDocument();
    expect(screen.getByText('network:')).toBeInTheDocument();
    expect(screen.getByText('Base Sepolia')).toBeInTheDocument();
    expect(screen.getByText('wallet:')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Base Sepolia' })).toBeInTheDocument();
  });

  it('re-renders the tooltip toggle when the preference changes', async () => {
    const toggleTooltips = jest.fn();

    function TooltipToggleHarness() {
      const [tooltipsEnabled, setTooltipsEnabled] = React.useState(true);
      const stableProps = React.useRef(
        buildProps({
          account: WAGMI_ADDRESS,
          loginComplete: true,
          provider: 'wagmi',
        }),
      );
      const handleToggle = React.useRef((...args) => {
        toggleTooltips(...args);
        setTooltipsEnabled((prev) => !prev);
      });

      return (
        <LoginAndSettingsModal
          {...stableProps.current}
          toggleTooltips={handleToggle.current}
          tooltipsEnabled={tooltipsEnabled}
        />
      );
    }

    render(<TooltipToggleHarness />);

    const button = screen.getByRole('button', { name: 'Explainers On' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(document.getElementById('postLoginTooltipsToggleTooltip')).toBeTruthy();

    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Explainers Off' })).toHaveAttribute('aria-pressed', 'false');
    });
    expect(document.getElementById('postLoginTooltipsToggleTooltip')).toBeNull();
    expect(toggleTooltips).toHaveBeenCalledTimes(1);
    expect(toggleTooltips.mock.calls[0]).toEqual([]);
  });

  it('exposes pre-login settings so tooltip preference and custom AI endpoint can be updated before sign-in', async () => {
    const props = buildProps({
      setDemoSurfaceMode: jest.fn(),
      toggleTooltips: jest.fn(),
      tooltipsEnabled: true,
    });

    render(<LoginAndSettingsModal {...props} />);

    await openPreLoginSettingsDrawer();

    expect(screen.getByTestId('ce-prelogin-settings-panel')).toBeInTheDocument();
    expect(screen.getByText('Appearance & colors')).toBeInTheDocument();
    expect(screen.getByTestId('ce-settings-theme')).toHaveAccessibleName('App theme');
    expect(document.getElementById('preLoginTooltipsToggleTooltip')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Explainers On' }));
    expect(props.toggleTooltips).toHaveBeenCalledTimes(1);

    await openPreLoginConfigPanel();

    fireEvent.change(screen.getByLabelText('AI endpoint'), {
      target: { value: 'https://self-hosted.example/v1' },
    });

    await waitFor(() => {
      expect(saveLocalAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          providers: expect.objectContaining({
            custom: expect.objectContaining({
              rpcUrl: 'https://self-hosted.example/v1',
            }),
          }),
        }),
      );
    });
  });

  it('shows the signed-in-style session summary inside the logged-out settings drawer', () => {
    getAllSessionSlugs.mockReturnValue(['edge']);
    getSessionConfigBySlugOrDefault.mockImplementation((slug) =>
      String(slug || '') === 'edge' ? { slug: 'edge', sessionName: 'Edge Session' } : {},
    );
    const subject = new LoginAndSettingsModal(buildProps({ activeSessionSlug: 'edge' }));
    subject.state = {
      ...subject.state,
      preLoginSettingsOpen: true,
      preLoginConfigOpen: false,
    };
    subject.getActiveSessionSlug = jest.fn(() => 'edge');

    render(subject.getPreLoginSettingsDisplay());

    expect(screen.getByText('SESSION')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open session Edge Session' })).toHaveAttribute('href', '/session/edge');
    expect(screen.queryByTestId('ce-prelogin-session-select')).not.toBeInTheDocument();
  });

  it('shows the shared network summary and sponsored-resource cards in the logged-out drawer before login', async () => {
    getAllSessionSlugs.mockReturnValue(['demo', 'edge']);
    getSessionConfigBySlugOrDefault.mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'demo') {
        return buildRegistrySessionConfig({
          slug: 'demo',
          sessionName: 'Demo Session',
          sponsoredKeys: {
            ai: 'demo-ai',
            arweave: 'demo-ar',
            rpc: 'demo-rpc',
            txGas: 'demo-gas',
          },
        });
      }
      if (normalized === 'edge') {
        return buildRegistrySessionConfig({
          slug: 'edge',
          sessionName: 'Edge Session',
          sponsoredKeys: {
            ai: 'edge-ai',
          },
        });
      }
      return {};
    });
    checkSponsoredAccess.mockImplementation(async ({ resourceKey }) => {
      if (resourceKey === 'ai') return { status: 'needs-wallet' };
      return { status: 'no-gate' };
    });

    const subject = new LoginAndSettingsModal(buildProps({ activeSessionSlug: 'demo' }));
    subject._sessionCapabilityProjectionResolver = resolveSessionCapabilityProjection;
    subject.state = {
      ...subject.state,
      preLoginSettingsOpen: true,
      preLoginConfigOpen: false,
      sponsoredAccess: {
        ai: { status: 'needs-wallet' },
        arweave: { status: 'no-gate' },
        rpc: { status: 'no-gate' },
        txGas: { status: 'no-gate' },
      },
    };
    subject.getActiveSessionSlug = jest.fn(() => 'demo');

    render(subject.getPreLoginSettingsDisplay());

    expect(screen.queryByTestId('ce-prelogin-session-select')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('AI endpoint')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Network')).toBeInTheDocument();
      expect(screen.getByText(/The active session targets/i)).toBeInTheDocument();
      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.getByText('Arweave')).toBeInTheDocument();
      expect(screen.getByText('RPC')).toBeInTheDocument();
      expect(screen.getByText('Tx gas')).toBeInTheDocument();
      expect(screen.getByText('Connect wallet')).toBeInTheDocument();
      expect(screen.getAllByText('Sponsored').length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: 'Open session Demo Session' })).toBeInTheDocument();
      expect(screen.getAllByText('configured here').length).toBeGreaterThan(0);
    });
  });

  it('keeps pre-login session and local AI controls behind Config with a capability-driven overview', async () => {
    getAllSessionSlugs.mockReturnValue(['demo']);
    getSessionConfigBySlugOrDefault.mockImplementation((slug) =>
      String(slug || '')
        .trim()
        .toLowerCase() === 'demo'
        ? {
            slug: 'demo',
            sessionName: 'Demo Session',
            sponsoredKeys: {
              ai: 'demo-ai',
            },
          }
        : {},
    );
    checkSponsoredAccess.mockImplementation(async () => ({ status: 'needs-wallet' }));

    render(<LoginAndSettingsModal {...buildProps({ activeSessionSlug: 'demo' })} />);

    await openPreLoginSettingsDrawer();

    expect(await screen.findByText('AI')).toBeInTheDocument();
    expect(screen.queryByText('Network')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-prelogin-session-select')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('OpenAI API key')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('AI endpoint')).not.toBeInTheDocument();

    await openPreLoginConfigPanel();

    expect(screen.queryByText('Network')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-prelogin-session-select')).toBeInTheDocument();
    expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument();
    expect(screen.getByLabelText('AI endpoint')).toBeInTheDocument();
  });

  it('keeps the logged-out footer gear-only until the settings drawer opens', async () => {
    const props = buildProps({
      demoSurfaceMode: true,
      setDemoSurfaceMode: jest.fn(),
    });

    render(<LoginAndSettingsModal {...props} />);

    expect(screen.queryByRole('button', { name: 'Demo Mode On' })).not.toBeInTheDocument();

    await openPreLoginSettingsDrawer();

    const panel = screen.getByTestId('ce-prelogin-settings-panel');
    const demoToggle = within(panel).getByRole('button', { name: 'Demo Mode On' });

    expect(demoToggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: 'Demo Mode On' })).toHaveLength(1);
    expect(panel).toContainElement(demoToggle);

    fireEvent.click(demoToggle);

    expect(props.setDemoSurfaceMode).toHaveBeenCalledTimes(1);
    expect(props.setDemoSurfaceMode).toHaveBeenCalledWith(false);
  });

  it('updates the demo mode toggle label when demoSurfaceMode changes', async () => {
    const props = buildProps({
      demoSurfaceMode: true,
    });
    const { rerender } = render(<LoginAndSettingsModal {...props} />);

    await openPreLoginSettingsDrawer();
    expect(screen.getByRole('button', { name: 'Demo Mode On' })).toHaveAttribute('aria-pressed', 'true');

    rerender(<LoginAndSettingsModal {...props} demoSurfaceMode={false} />);

    expect(screen.getByRole('button', { name: 'Demo Mode Off' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders the demo mode toggle in the signed-in top-level settings row without duplicating it in the config body', () => {
    const setDemoSurfaceMode = jest.fn();
    const subject = buildWrongNetworkSubject({ aiSettingsOpen: true });
    subject.props = {
      ...subject.props,
      demoSurfaceMode: true,
      setDemoSurfaceMode,
    };

    render(subject.getSettingsDisplay());

    const demoToggle = screen.getByRole('button', { name: 'Demo Mode On' });
    expect(demoToggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: 'Demo Mode On' })).toHaveLength(1);

    fireEvent.click(demoToggle);

    expect(setDemoSurfaceMode).toHaveBeenCalledTimes(1);
    expect(setDemoSurfaceMode).toHaveBeenCalledWith(false);
  });

  it('renders the pre-login AI settings subsection with both provider key inputs and the Anthropic hint', async () => {
    render(<LoginAndSettingsModal {...buildProps()} />);

    await openPreLoginSettingsDrawer();
    await openPreLoginConfigPanel();

    expect(screen.getByText('AI settings')).toBeInTheDocument();
    expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument();
    expect(screen.getByLabelText('Anthropic API key')).toBeInTheDocument();
    expect(screen.getByText(/Anthropic powers local text tasks here/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Audio and transcription still use local OpenAI, session defaults, or a custom endpoint/i),
    ).toBeInTheDocument();
  });

  it('saves an OpenAI pre-login key and activates the local GPT-5 preset', async () => {
    render(<LoginAndSettingsModal {...buildProps()} />);

    await openPreLoginSettingsDrawer();
    await openPreLoginConfigPanel();
    fireEvent.change(screen.getByLabelText('OpenAI API key'), {
      target: { value: 'sk-open-test' },
    });

    await waitFor(() => {
      expect(saveLocalAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          useLocal: true,
          preset: 'gpt-5',
          mode: 'openai',
          models: expect.objectContaining({
            fast: 'gpt-5',
            thinking: 'gpt-5',
          }),
          providers: expect.objectContaining({
            openai: expect.objectContaining({
              apiKey: 'sk-open-test',
            }),
          }),
        }),
      );
    });
  });

  it('saves an Anthropic pre-login key and activates the local Claude Sonnet preset', async () => {
    render(<LoginAndSettingsModal {...buildProps()} />);

    await openPreLoginSettingsDrawer();
    await openPreLoginConfigPanel();
    fireEvent.change(screen.getByLabelText('Anthropic API key'), {
      target: { value: 'sk-ant-test' },
    });

    await waitFor(() => {
      expect(saveLocalAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          useLocal: true,
          preset: 'claude-sonnet',
          mode: 'anthropic',
          models: expect.objectContaining({
            fast: 'claude-sonnet-4-6',
            thinking: 'claude-sonnet-4-6',
          }),
          providers: expect.objectContaining({
            anthropic: expect.objectContaining({
              apiKey: 'sk-ant-test',
            }),
          }),
        }),
      );
    });
  });

  it('lets pre-login settings switch the active session before connect', async () => {
    getAllSessionSlugs.mockReturnValue(['edge']);
    getSessionConfigBySlugOrDefault.mockImplementation((slug) =>
      String(slug || '') === 'edge' ? { slug: 'edge', sessionName: 'Edge Session' } : {},
    );
    const props = buildProps({
      updateGlobalSessionSelection: jest.fn(),
      activeSessionSlug: '',
    });

    render(<LoginAndSettingsModal {...props} />);

    await openPreLoginSettingsDrawer();
    await openPreLoginConfigPanel();

    expect(screen.getByTestId('ce-prelogin-session-select')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Active session'), {
      target: { value: 'edge' },
    });

    expect(props.updateGlobalSessionSelection).toHaveBeenCalledTimes(1);
    expect(props.updateGlobalSessionSelection).toHaveBeenCalledWith({
      primarySessionSlug: 'edge',
    });
  });

  it('shows multi-session chips in pre-login settings and saves list mode without collapsing the selection', () => {
    getAllSessionSlugs.mockReturnValue(['edge', 'rxc']);
    getSessionConfigBySlugOrDefault.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === 'edge') return { slug: 'edge', sessionName: 'Edge Session' };
      if (normalized === 'rxc') return { slug: 'rxc', sessionName: 'Debate Session' };
      return {};
    });
    const props = buildProps({
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['edge', 'rxc'],
      updateGlobalSessionSelection: jest.fn(),
    });
    const subject = new LoginAndSettingsModal(props);
    subject.state = {
      ...subject.state,
      preLoginSettingsOpen: true,
      preLoginConfigOpen: true,
      sessionScanScope: 'list',
      sessionScanSlugs: ['edge', 'rxc'],
      sessionScanSlugsInput: 'edge, rxc',
    };
    subject.getSessionScanScopeValue = jest.fn(() => 'list');
    subject.getConfiguredSessionScanSlugs = jest.fn(() => ['edge', 'rxc']);
    subject.getActiveSessionSlug = jest.fn(() => 'edge');

    render(subject.getPreLoginSettingsDisplay());

    expect(screen.getByTestId('ce-prelogin-session-select')).toHaveValue('edge');
    expect(screen.getByTestId('ce-prelogin-session-scope-chip-edge')).toBeInTheDocument();
    expect(screen.getByTestId('ce-prelogin-session-scope-chip-rxc')).toBeInTheDocument();
  });

  it('collapses long pre-login session lists to three rows until see more is clicked', () => {
    getAllSessionSlugs.mockReturnValue(['edge', 'alpha', 'beta', 'rxc']);
    getSessionConfigBySlugOrDefault.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === 'edge') return { slug: 'edge', sessionName: 'Edge Session' };
      if (normalized === 'alpha') return { slug: 'alpha', sessionName: 'Alpha Session' };
      if (normalized === 'beta') return { slug: 'beta', sessionName: 'Beta Session' };
      if (normalized === 'rxc') return { slug: 'rxc', sessionName: 'Debate Session' };
      return {};
    });
    const subject = new LoginAndSettingsModal(
      buildProps({
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['edge', 'rxc'],
      }),
    );
    subject.state = {
      ...subject.state,
      preLoginSettingsOpen: true,
      preLoginConfigOpen: true,
      sessionScanScope: 'list',
      sessionScanSlugs: ['edge', 'rxc'],
    };
    subject.getSessionScanScopeValue = jest.fn(() => 'list');
    subject.getConfiguredSessionScanSlugs = jest.fn(() => ['edge', 'rxc']);
    subject.getActiveSessionSlug = jest.fn(() => 'edge');

    render(subject.getPreLoginSettingsDisplay());

    expect(screen.getAllByTestId(/ce-prelogin-session-scope-chip-/)).toHaveLength(3);
    expect(screen.getByTestId('ce-prelogin-session-scope-expand-toggle')).toHaveTextContent('See more (2 more)');
    expect(screen.queryByTestId('ce-prelogin-session-scope-chip-beta')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-prelogin-session-scope-expand-toggle'));

    expect(screen.getAllByTestId(/ce-prelogin-session-scope-chip-/)).toHaveLength(5);
    expect(screen.getByTestId('ce-prelogin-session-scope-chip-beta')).toBeInTheDocument();
    expect(screen.getByTestId('ce-prelogin-session-scope-expand-toggle')).toHaveTextContent('Show less');
  });

  it('removes passive selected-session helper copy from the pre-login drawer', () => {
    getAllSessionSlugs.mockReturnValue(['edge', 'rxc']);
    getSessionConfigBySlugOrDefault.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === 'edge') return { slug: 'edge', sessionName: 'Edge Session' };
      if (normalized === 'rxc') return { slug: 'rxc', sessionName: 'Debate Session' };
      return {};
    });
    const subject = new LoginAndSettingsModal(
      buildProps({
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['edge', 'rxc'],
      }),
    );
    subject.state = {
      ...subject.state,
      preLoginSettingsOpen: true,
      preLoginConfigOpen: true,
      sessionScanScope: 'list',
      sessionScanSlugs: ['edge', 'rxc'],
    };
    subject.getSessionScanScopeValue = jest.fn(() => 'list');
    subject.getConfiguredSessionScanSlugs = jest.fn(() => ['edge', 'rxc']);
    subject.getActiveSessionSlug = jest.fn(() => 'edge');

    render(subject.getPreLoginSettingsDisplay());

    expect(screen.queryByText(/List mode will scan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Selected 2 sessions?/i)).not.toBeInTheDocument();
  });

  it('completes passkey wallet sign-in from the rendered login view', async () => {
    passkeyWallet.unlockPasskeyWallet.mockResolvedValue(PASSKEY_ADDRESS);
    const props = buildProps();
    const subject = new LoginAndSettingsModal(props);
    subject._isMounted = true;

    render(subject.getModalDisplay());
    fireEvent.click(getPasskeyLoginButton());

    expect(props.updateLoginInfo).toHaveBeenNthCalledWith(1, {
      loginInProgress: true,
      loginComplete: false,
      provider: 'passkey_eoa',
    });

    await waitFor(() => {
      expect(props.changeAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          account: PASSKEY_ADDRESS,
          provider: 'passkey_eoa',
        }),
      );
    });

    const payload = props.changeAccount.mock.calls[0][0];
    expect(payload).not.toHaveProperty('availableETH');
    expect(payload).not.toHaveProperty('ETHBalance');

    expect(props.updateLoginInfo).toHaveBeenLastCalledWith({
      loginInProgress: false,
      loginComplete: true,
      provider: 'passkey_eoa',
    });
  });

  it('labels passkey registration as creation while it is in progress', () => {
    const subject = new LoginAndSettingsModal(
      buildProps({
        loginComplete: false,
        loginInProgress: true,
        provider: 'passkey_eoa',
      }),
    );
    subject.state = {
      ...subject.state,
      passkeyMode: 'create',
    };

    render(subject.getModalDisplay());

    expect(screen.getByText('creating passkey...')).toBeInTheDocument();
    expect(screen.queryByText('logging in...')).not.toBeInTheDocument();
  });

  it('resets back to a logged-out state when passkey wallet sign-in fails', async () => {
    passkeyWallet.unlockPasskeyWallet.mockRejectedValue(new Error('passkey rejected'));
    const props = buildProps();
    const subject = new LoginAndSettingsModal(props);
    subject._isMounted = true;

    render(subject.getModalDisplay());
    fireEvent.click(getPasskeyLoginButton());

    await waitFor(() => {
      expect(props.updateLoginInfo).toHaveBeenLastCalledWith({
        loginInProgress: false,
        loginComplete: false,
        provider: null,
      });
    });

    expect(props.changeAccount).not.toHaveBeenCalled();
  });

  it('renders logged-in controls and disconnects wagmi users from the modal', async () => {
    getSessionConfigBySlugOrDefault.mockImplementation((slug) =>
      slug === 'demo-1'
        ? buildRegistrySessionConfig({
            slug: 'demo-1',
            sessionName: 'Demo Session',
            networkChainId: 11155420,
          })
        : {},
    );
    const props = buildProps({
      account: WAGMI_ADDRESS,
      activeSessionSlug: 'demo-1',
      loginComplete: true,
      provider: 'wagmi',
      wagmiDisconnect: jest.fn().mockResolvedValue(undefined),
    });
    const subject = new LoginAndSettingsModal(props);
    subject.getSettingsDisplay = jest.fn(() => null);

    render(subject.getModalDisplay());

    const profileShell = screen.getByTestId('mock-user-page').closest(`.${styles.accountModalProfileShell}`);

    expect(profileShell).toBeTruthy();
    expect(screen.getByTestId('mock-user-page')).toHaveAttribute('data-view-address', WAGMI_ADDRESS);
    expect(screen.getByTestId('mock-user-page')).toHaveAttribute('data-active-session-slug', 'demo-1');
    expect(screen.getByTestId('mock-user-page')).toHaveAttribute('data-network-chain-id', '11155420');
    expect(screen.getByTestId('mock-user-page')).toHaveAttribute('data-session-config-chain-id', '11155420');
    expect(screen.getByRole('button', { name: /bookmarks/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }));

    await waitFor(() => {
      expect(props.wagmiDisconnect).toHaveBeenCalledTimes(1);
      expect(props.updateLoginInfo).toHaveBeenCalledWith({
        loginInProgress: false,
        loginComplete: false,
        provider: null,
      });
      expect(props.changeAccount).toHaveBeenCalledWith({});
      expect(clearAllWorkerSessionTokens).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('ce:userDisconnected')).toBe('true');
    });
  });

  it('does not pass legacy chain metadata into the account profile for a pure Worker session', () => {
    getSessionConfigBySlugOrDefault.mockImplementation((slug) =>
      slug === 'demo-sh'
        ? {
            slug: 'demo-sh',
            sessionName: 'Worker Session',
            networkChainId: 11155420,
            corsWorkerUrl: 'https://demo-sh.example.test',
            sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
          }
        : {},
    );
    const subject = new LoginAndSettingsModal(
      buildProps({
        account: WAGMI_ADDRESS,
        activeSessionSlug: 'demo-sh',
        loginComplete: true,
        provider: 'wagmi',
      }),
    );

    render(subject.getModalDisplay());

    expect(screen.getByTestId('mock-user-page')).toHaveAttribute('data-active-session-slug', 'demo-sh');
    expect(screen.getByTestId('mock-user-page')).toHaveAttribute('data-network-chain-id', '');
    expect(screen.getByTestId('mock-user-page')).toHaveAttribute('data-session-config-chain-id', '11155420');
  });

  it('replaces the legacy settings summary strip with compact supported-resource cards', async () => {
    getAllSessionSlugs.mockReturnValue(['demo', 'edge']);
    getSessionConfigBySlugOrDefault.mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (normalized === 'demo') {
        return buildRegistrySessionConfig({
          slug: 'demo',
          sessionName: 'Demo Session',
          sponsoredKeys: {
            ai: 'demo-ai',
            arweave: 'demo-ar',
            rpc: 'demo-rpc',
          },
        });
      }
      if (normalized === 'edge') {
        return buildRegistrySessionConfig({
          slug: 'edge',
          sessionName: 'Edge Session',
          sponsoredKeys: {
            ai: 'edge-ai',
          },
        });
      }
      return {};
    });
    checkSponsoredAccess.mockImplementation(async ({ resourceKey }) => {
      if (resourceKey === 'ai') {
        return { status: 'granted' };
      }
      if (resourceKey === 'rpc') {
        return { status: 'granted' };
      }
      if (resourceKey === 'arweave') {
        return { status: 'granted' };
      }
      return { status: 'no-gate' };
    });

    const subject = new LoginAndSettingsModal(
      buildProps({
        account: WAGMI_ADDRESS,
        activeSessionSlug: 'demo',
        loginComplete: true,
        provider: 'wagmi',
      }),
    );
    subject.state = {
      ...subject.state,
      aiSettingsOpen: true,
      sponsoredAccess: {
        ai: { status: 'granted' },
        arweave: { status: 'granted' },
        rpc: { status: 'granted' },
        txGas: { status: 'no-gate' },
      },
    };
    subject.getActiveSessionSlug = jest.fn(() => 'demo');

    const { rerender } = render(subject.getSettingsDisplay());

    expect(await screen.findByText('AI')).toBeInTheDocument();
    expect(screen.getByText('Arweave')).toBeInTheDocument();
    expect(screen.getByText('RPC')).toBeInTheDocument();
    expect(screen.queryByText('Source')).not.toBeInTheDocument();
    expect(screen.queryByText('Provider')).not.toBeInTheDocument();
    expect(screen.queryByText('AI gate')).not.toBeInTheDocument();
    expect(screen.queryByText('RPC scan scope')).not.toBeInTheDocument();
    expect(screen.queryByText(/Gate status is evaluated against the active session/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open session Demo Session' })).toBeInTheDocument();
    expect(screen.getAllByText('configured here').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Edge Session')).toHaveLength(0);

    expect(screen.getByRole('button', { name: 'Show other AI sponsor sessions' })).toBeInTheDocument();
    subject.state = {
      ...subject.state,
      expandedSponsorResources: {
        ...subject.state.expandedSponsorResources,
        ai: true,
      },
    };
    rerender(subject.getSettingsDisplay());

    expect((await screen.findAllByText('Edge Session')).length).toBeGreaterThan(0);
  });

  it('does not expose another session’s RPC capability in the active session settings', async () => {
    getAllSessionSlugs.mockReturnValue(['op-session-test']);
    getSessionConfigBySlugOrDefault.mockImplementation((slug) => {
      const normalized = String(slug || '')
        .trim()
        .toLowerCase();
      if (!normalized) {
        return {
          slug: '',
          sessionName: 'General',
          sponsoredKeys: {},
        };
      }
      if (normalized === 'op-session-test') {
        return {
          slug: 'op-session-test',
          sessionName: 'OP Session Test',
          sponsoredKeys: {
            rpc: 'sponsored-rpc',
          },
        };
      }
      return {};
    });
    checkSponsoredAccess.mockImplementation(async () => ({ status: 'unknown' }));

    const modalRef = React.createRef();

    render(
      <LoginAndSettingsModal
        {...buildProps({
          account: WAGMI_ADDRESS,
          activeSessionSlug: '',
          loginComplete: true,
          provider: 'wagmi',
        })}
        ref={modalRef}
      />,
    );

    await act(async () => {
      modalRef.current.setState({
        aiSettingsOpen: true,
        sponsoredAccess: {
          ai: { status: 'unknown' },
          arweave: { status: 'unknown' },
          rpc: { status: 'denied' },
          txGas: { status: 'unknown' },
        },
      });
    });

    const rpcCard = (await screen.findByText('RPC')).closest(`.${styles.supportedResourceCard}`);
    expect(rpcCard).toBeTruthy();
    expect(within(rpcCard).getByText('Not sponsored')).toBeInTheDocument();
    expect(within(rpcCard).queryByText('Gate locked')).not.toBeInTheDocument();
    expect(within(rpcCard).getByText('General')).toBeInTheDocument();
    expect(within(rpcCard).getByText('not configured here')).toBeInTheDocument();
    expect(within(rpcCard).queryByText('OP Session Test')).not.toBeInTheDocument();

    fireEvent.click(within(rpcCard).getByRole('button', { name: 'Show other RPC sponsor sessions' }));

    await waitFor(() => {
      expect(within(rpcCard).getByText('OP Session Test')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Resource keys/i }));

    expect(
      await screen.findByText(
        'No active-session RPC sponsor. Other sessions with RPC: OP Session Test. Switch sessions to use one.',
      ),
    ).toBeInTheDocument();
  });

  it('does not render the legacy send-testnet-funds control in settings', () => {
    const props = buildProps({
      account: WAGMI_ADDRESS,
      loginComplete: true,
      provider: 'wagmi',
      activeSessionSlug: 'edge',
    });
    const subject = new LoginAndSettingsModal(props);

    render(subject.getSettingsDisplay());

    expect(screen.queryByTestId('mock-send-testnet-funds')).not.toBeInTheDocument();
  });

  it('removes passive selected-session helper copy from the logged-in session panel', () => {
    getAllSessionSlugs.mockReturnValue(['edge', 'rxc']);
    getSessionConfigBySlugOrDefault.mockImplementation((slug) => {
      const normalized = String(slug || '');
      if (normalized === 'edge') return { slug: 'edge', sessionName: 'Edge Session' };
      if (normalized === 'rxc') return { slug: 'rxc', sessionName: 'Debate Session' };
      return {};
    });
    const subject = new LoginAndSettingsModal(
      buildProps({
        account: WAGMI_ADDRESS,
        loginComplete: true,
        provider: 'wagmi',
        activeSessionSlug: 'edge',
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['edge', 'rxc'],
      }),
    );
    subject.state = {
      ...subject.state,
      aiSettingsOpen: true,
      sessionScanScope: 'list',
      sessionScanSlugs: ['edge', 'rxc'],
      aiSettingsSectionsOpen: {
        ...subject.state.aiSettingsSectionsOpen,
        session: true,
      },
    };
    subject.getSessionScanScopeValue = jest.fn(() => 'list');
    subject.getConfiguredSessionScanSlugs = jest.fn(() => ['edge', 'rxc']);
    subject.getActiveSessionSlug = jest.fn(() => 'edge');

    render(subject.getSettingsDisplay());

    expect(screen.queryByText(/List mode will scan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Selected 2 sessions?/i)).not.toBeInTheDocument();
  });

  it('renders sponsored access errors in the compact supported-resource cards', () => {
    const props = buildProps({
      account: WAGMI_ADDRESS,
      loginComplete: true,
      provider: 'wagmi',
      activeSessionSlug: 'edge',
    });
    const subject = new LoginAndSettingsModal(props);
    subject._sessionCapabilityProjectionResolver = resolveSessionCapabilityProjection;
    subject.state = {
      ...subject.state,
      aiSettingsOpen: true,
      sponsoredAccessLoading: false,
      sponsoredAccess: {
        ai: null,
        arweave: null,
        rpc: {
          status: 'error',
          gate: {
            label: 'RPC Gate',
            mode: 'any',
          },
        },
        txGas: null,
      },
    };
    subject.getSessionDescriptor = jest.fn(() => ({ label: 'Edge Session' }));
    subject.getDisplaySessionConfig = jest.fn(() =>
      buildRegistrySessionConfig({
        slug: 'edge',
        sessionName: 'Edge Session',
        sponsoredKeys: { rpc: 'edge-rpc' },
      }),
    );
    subject.getSettingsSessionOptions = jest.fn(() => [{ slug: 'edge', label: 'Edge Session' }]);
    subject.getSponsoredSessionSources = jest.fn(() => ({
      byResource: {
        ai: [],
        arweave: [],
        rpc: [{ slug: 'edge', label: 'Edge Session', slugLabel: 'edge', isActive: true }],
        txGas: [],
      },
      rpcScope: [],
    }));

    render(subject.getSettingsDisplay());

    expect(screen.getByText('Check unavailable')).toBeInTheDocument();
    expect(screen.getAllByText('Edge Session').length).toBeGreaterThan(0);
    expect(screen.getByText('We could not confirm gate access for the active-session sponsor.')).toBeInTheDocument();
    expect(screen.queryByText('RPC Gate · ANY')).not.toBeInTheDocument();
  });

  it('keeps unresolved sponsored AI access in a non-terminal state', () => {
    const subject = new LoginAndSettingsModal(
      buildProps({
        account: WAGMI_ADDRESS,
        activeSessionSlug: 'edge',
        loginComplete: true,
        provider: 'wagmi',
      }),
    );
    subject.state = {
      ...subject.state,
      aiSettingsOpen: true,
      sponsoredAccessLoading: false,
      sponsoredAccess: {
        ai: { status: 'unresolved' },
        arweave: null,
        rpc: null,
        txGas: null,
      },
    };
    subject.getDisplaySessionConfig = jest.fn(() => ({
      slug: 'edge',
      sessionName: 'Edge Session',
      sponsoredKeys: {
        ai: 'edge-ai',
      },
    }));
    subject.getSessionDescriptor = jest.fn(() => ({
      label: 'Edge Session',
      _sessionName: 'Edge Session',
    }));
    subject.getSettingsSessionOptions = jest.fn(() => [{ slug: 'edge', label: 'Edge Session' }]);
    subject.getSponsoredSessionSources = jest.fn(() => ({
      byResource: {
        ai: [{ slug: 'edge', label: 'Edge Session', slugLabel: 'edge', isActive: true }],
        arweave: [],
        rpc: [],
        txGas: [],
      },
      rpcScope: [],
    }));

    render(subject.getSettingsDisplay());

    expect(screen.getByText('Check unavailable')).toBeInTheDocument();
    expect(screen.getByText('We could not confirm gate access for the active-session sponsor.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Sponsored key configured')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Sponsored key configured (SBT required)')).not.toBeInTheDocument();
  });

  it('keeps gas transaction UI hidden even when faucet success state exists', () => {
    const subject = new LoginAndSettingsModal(
      buildProps({
        account: WAGMI_ADDRESS,
        activeSessionSlug: 'edge',
        loginComplete: true,
        provider: 'wagmi',
        wagmiAddress: WAGMI_ADDRESS,
      }),
    );
    subject.state = {
      ...subject.state,
      aiSettingsOpen: true,
      sentTxHash: '0xfeed1234',
      testFundsStatusMessage: 'Test gas sent.',
      testFundsStatusTone: 'success',
    };
    subject.getSessionDescriptor = jest.fn(() => ({ label: 'Edge Session' }));
    subject.getSponsoredSessionSources = jest.fn(() => ({
      byResource: {
        ai: [],
        arweave: [],
        rpc: [],
        txGas: [{ slug: 'edge', label: 'Edge Session', slugLabel: 'edge', isActive: true }],
      },
      rpcScope: [],
    }));

    render(subject.getSettingsDisplay());

    expect(screen.queryByTestId('ce-settings-get-test-gas')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-settings-get-test-gas-status')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /view tx/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Test gas sent/i)).not.toBeInTheDocument();
  });

  it('does not render manual Get test gas when only another session has faucet sponsorship', () => {
    const subject = new LoginAndSettingsModal(
      buildProps({
        account: WAGMI_ADDRESS,
        activeSessionSlug: 'edge',
        loginComplete: true,
        provider: 'wagmi',
        wagmiAddress: WAGMI_ADDRESS,
        wagmiBalance: { data: { value: 1n } },
      }),
    );
    subject.state = {
      ...subject.state,
      aiSettingsOpen: true,
      walletBalanceWei: { isZero: () => false },
      sponsoredAccessLoading: false,
      sponsoredAccess: {
        ai: null,
        arweave: null,
        rpc: null,
        txGas: null,
      },
    };
    subject.getSessionDescriptor = jest.fn(() => ({ label: 'Edge Session' }));
    subject.getSponsoredSessionSources = jest.fn(() => ({
      byResource: {
        ai: [],
        arweave: [],
        rpc: [],
        txGas: [{ slug: 'demo', label: 'Demo Session', slugLabel: 'demo', isActive: false }],
      },
      rpcScope: [],
    }));

    render(subject.getSettingsDisplay());

    expect(screen.queryByTestId('ce-settings-get-test-gas')).not.toBeInTheDocument();
  });

  it('keeps gas transaction UI hidden even when auto-funding errors are present', () => {
    const subject = new LoginAndSettingsModal(
      buildProps({
        account: WAGMI_ADDRESS,
        activeSessionSlug: 'edge',
        loginComplete: true,
        provider: 'wagmi',
        wagmiAddress: WAGMI_ADDRESS,
      }),
    );
    subject.state = {
      ...subject.state,
      aiSettingsOpen: true,
      testFundsStatusMessage: 'Auto-funding failed: Token missing faucet scope.',
      testFundsStatusTone: 'error',
    };
    subject.getSessionDescriptor = jest.fn(() => ({ label: 'Edge Session' }));
    subject.getSponsoredSessionSources = jest.fn(() => ({
      byResource: {
        ai: [],
        arweave: [],
        rpc: [],
        txGas: [{ slug: 'edge', label: 'Edge Session', slugLabel: 'edge', isActive: true }],
      },
      rpcScope: [],
    }));

    render(subject.getSettingsDisplay());

    expect(screen.queryByTestId('ce-settings-get-test-gas')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ce-settings-get-test-gas-status')).not.toBeInTheDocument();
    expect(screen.queryByText(/Auto-funding failed/i)).not.toBeInTheDocument();
  });
});

describe('LoginAndSettingsModal agent token login', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearAgentClientLoginEnvelope('alpha');
    window.history.replaceState({}, '', '/session/alpha');
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            tokenType: 'session_worker_jwt',
            sessionSlug: 'alpha',
            accountAddress: '0x3333333333333333333333333333333333333333',
            workerUrl: 'https://session-worker.example',
            workerToken: 'jwt-session-token',
            expiresAt: '2027-07-05T00:00:00.000Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearAgentClientLoginEnvelope('alpha');
    window.localStorage.clear();
    window.sessionStorage.clear();
    delete global.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__;
  });

  it('shows agent-token login only for telegram-first sessions and clears raw token after exchange', async () => {
    const props = buildProps({
      activeSessionSlug: 'alpha',
      sessionConfig: { slug: 'alpha', telegramOnly: true, sessionMode: 'telegram_only' },
    });
    render(<LoginAndSettingsModal {...props} />);

    fireEvent.click(screen.getByTestId('ce-agent-token-login-toggle'));
    const input = screen.getByTestId('ce-agent-token-login-input');
    fireEvent.change(input, { target: { value: RAW_AGENT_TOKEN } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('ce-agent-token-login-submit'));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(props.updateLoginInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          loginComplete: true,
          provider: 'telegram_agent',
        }),
      );
    });

    expect(input).toHaveValue('');
    expect(window.location.href).not.toContain(RAW_AGENT_TOKEN);
    expect(JSON.stringify(window.localStorage)).not.toContain(RAW_AGENT_TOKEN);
    expect(Object.values(window.sessionStorage).join('\n')).not.toContain(RAW_AGENT_TOKEN);
    expect(Object.values(window.sessionStorage).join('\n')).not.toContain('bridge-browser-token');
    expect(Object.values(window.sessionStorage).join('\n')).not.toContain('jwt-session-token');
    expect(JSON.stringify(props.changeAccount.mock.calls)).not.toContain(RAW_AGENT_TOKEN);
    expect(JSON.stringify(props.updateLoginInfo.mock.calls)).not.toContain(RAW_AGENT_TOKEN);
  });

  it('hides agent-token login for normal sessions', () => {
    render(
      <LoginAndSettingsModal
        {...buildProps({
          activeSessionSlug: 'alpha',
          sessionConfig: { slug: 'alpha', sessionName: 'Normal Session' },
        })}
      />,
    );

    expect(screen.queryByTestId('ce-agent-token-login-toggle')).not.toBeInTheDocument();
  });
});
