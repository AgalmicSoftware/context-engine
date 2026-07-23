import { ethers } from 'ethers';
import { LoginAndSettingsModal } from './LoginAndSettingsModal';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as passkeyWallet from '../../wallet/passkeyWallet.js';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import { refreshSessionRegistryFieldsCache } from '../../utilities/web3/sessionRegistry.js';
import { readWorkerResourcePresence } from '../../utilities/worker/workerResourcePresence';
import contractScripts from '../../utilities/web3/chainGateway.js';
import {
  getDemoSessionConfigBySlug,
  getAllSessionSlugs,
  getSessionConfigBySlugOrDefault,
  getSessionNetwork,
  getProviderLocation,
} from '../../utilities/web3/chainGateway.js';
import { getWorkerSessionToken, clearAllWorkerSessionTokens } from '../../utilities/worker/workerAuth.js';
import { notify } from '../../utilities/ui/notify.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import { baseSepolia, getDefaultHttpRpc } from '../../variables/chains.js';

jest.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => null,
}));

jest.mock('../HooksHOC/withWagmiBridge', () => ({
  WagmiHooksHOC: (Comp: any) => Comp,
}));

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  default: {
    getProviderLocation: jest.fn(() => ({})),
    sendTestnetFunds: jest.fn(),
  },
  getProviderLocation: jest.fn(() => ({})),
  getDemoSessionConfigBySlug: jest.fn(() => null),
  getSessionNetwork: jest.fn(() => ({ id: 84532, chainId: 84532, name: 'Base Sepolia' })),
  getSessionConfigBySlugOrDefault: jest.fn(() => ({})),
  getAllSessionSlugs: jest.fn(() => []),
}));

jest.mock('../../wallet/passkeyWallet.js', () => ({
  getPasskeyWalletChain: jest.fn(() => null),
  setPasskeyWalletChain: jest.fn(),
  restorePasskeyWalletSession: jest.fn(async () => null),
  createPasskeyWallet: jest.fn(async () => '0x1111111111111111111111111111111111111111'),
  unlockPasskeyWallet: jest.fn(async () => '0x1111111111111111111111111111111111111111'),
  logoutPasskeyWallet: jest.fn(),
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
    saveLocalAiSettings: jest.fn(),
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

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  refreshSessionRegistryFieldsCache: jest.fn(async () => null),
}));

jest.mock('../../utilities/worker/workerResourcePresence', () => ({
  readWorkerResourcePresence: jest.fn(async () => null),
}));

jest.mock('../../utilities/worker/workerAuth.js', () => ({
  getWorkerSessionToken: jest.fn(async () => null),
  clearAllWorkerSessionTokens: jest.fn(),
}));

jest.mock('../../utilities/ui/notify.js', () => ({
  notify: {
    info: jest.fn(),
  },
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

const LoginAndSettingsModalSubject = LoginAndSettingsModal as any;
const mockedCacheScripts = cacheScripts as any;
const mockedPasskeyWallet = passkeyWallet as any;
const mockedCheckSponsoredAccess = checkSponsoredAccess as any;
const mockedRefreshSessionRegistryFieldsCache = refreshSessionRegistryFieldsCache as any;
const mockedReadWorkerResourcePresence = readWorkerResourcePresence as any;
const mockedContractScripts = contractScripts as any;
const mockedGetDemoSessionConfigBySlug = getDemoSessionConfigBySlug as any;
const mockedGetAllSessionSlugs = getAllSessionSlugs as any;
const mockedGetSessionConfigBySlugOrDefault = getSessionConfigBySlugOrDefault as any;
const mockedGetSessionNetwork = getSessionNetwork as any;
const mockedSessionScanScope = sessionScanScope as any;
const mockedNotify = notify as any;

const buildProps = (overrides: Record<string, any> = {}) => ({
  changeAccount: jest.fn(),
  toggleLoginModal: jest.fn(),
  updateLoginInfo: jest.fn(),
  toggleDemoMode: jest.fn(),
  changeFocusedTab: jest.fn(),
  changeActiveSessionSlug: jest.fn(),
  updateGlobalSessionSelection: jest.fn(),
  primarySessionExplicit: false,
  selectedSessionScope: 'active',
  selectedSessionSlugs: [],
  demoMode: { tools: false },
  provider: 'wagmi',
  loginComplete: false,
  network: { id: 84532, chainId: 84532, name: 'Base Sepolia' },
  ...overrides,
});

const treeHasPropValue = (node: any, propName: string, expected: any): boolean => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasPropValue(child, propName, expected));
  if (typeof node !== 'object') return false;
  if (node?.props?.[propName] === expected) return true;
  return treeHasPropValue(node?.props?.children, propName, expected);
};

const PASSKEY_ADDRESS = '0x1111111111111111111111111111111111111111';
const WAGMI_ADDRESS = '0x2222222222222222222222222222222222222222';
const ALT_PASSKEY_ADDRESS = '0x3333333333333333333333333333333333333333';

const mountClassSubject = (subject: any) => {
  subject._isMounted = true;
  subject.setState = (nextState: any, cb?: () => void) => {
    const update = typeof nextState === 'function' ? nextState(subject.state, subject.props) : nextState;
    subject.state = { ...subject.state, ...(update || {}) };
    if (typeof cb === 'function') cb();
  };
  return subject;
};

describe('LoginAndSettingsModal cache clearing performance guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRefreshSessionRegistryFieldsCache.mockResolvedValue(null);
    mockedReadWorkerResourcePresence.mockResolvedValue(null);
    mockedGetSessionConfigBySlugOrDefault.mockReturnValue({});
    mockedGetDemoSessionConfigBySlug.mockReturnValue(null);
    localStorage.clear();
    mockedGetSessionNetwork.mockReturnValue({ id: 84532, chainId: 84532, name: 'Base Sepolia' });
    window.history.replaceState({}, '', '/');
  });

  it('does not update local state after unmount while session restore is pending', async () => {
    let resolveRestore!: (value: string | null) => void;
    mockedPasskeyWallet.restorePasskeyWalletSession.mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          resolveRestore = resolve;
        }),
    );

    const subject = new LoginAndSettingsModalSubject(buildProps());
    const setStateSpy = jest.fn();
    subject.setState = setStateSpy;

    const mountPromise = subject.componentDidMount();
    subject.componentWillUnmount();

    resolveRestore(null);
    await mountPromise;

    expect(mockedPasskeyWallet.restorePasskeyWalletSession).toHaveBeenCalledTimes(1);
    expect(mockedPasskeyWallet.restorePasskeyWalletSession).toHaveBeenCalledWith({ requireSigner: false });
    expect(setStateSpy).not.toHaveBeenCalled();
  });

  it('hydrates passkey wallet login state from stored session metadata on mount without forcing signer restore', async () => {
    mockedPasskeyWallet.restorePasskeyWalletSession.mockResolvedValueOnce(PASSKEY_ADDRESS);
    const props = buildProps({
      provider: 'none',
    });
    const subject = mountClassSubject(new LoginAndSettingsModalSubject(props));

    await subject.componentDidMount();

    expect(mockedPasskeyWallet.restorePasskeyWalletSession).toHaveBeenCalledWith({ requireSigner: false });
    expect(props.changeAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        account: PASSKEY_ADDRESS,
        provider: 'passkey_eoa',
      }),
    );
    expect(props.updateLoginInfo).toHaveBeenCalledWith({
      loginInProgress: false,
      loginComplete: true,
      provider: 'passkey_eoa',
    });
  });

  it('does not let pending passkey wallet restore overwrite explicit sign-in', async () => {
    let resolveRestore!: (value: string | null) => void;
    mockedPasskeyWallet.restorePasskeyWalletSession.mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          resolveRestore = resolve;
        }),
    );
    mockedPasskeyWallet.unlockPasskeyWallet.mockResolvedValueOnce(ALT_PASSKEY_ADDRESS);
    const props = buildProps({
      provider: 'none',
    });
    const subject = mountClassSubject(new LoginAndSettingsModalSubject(props));

    const mountPromise = subject.componentDidMount();
    await subject.handlePasskeyWalletSignIn();
    resolveRestore(PASSKEY_ADDRESS);
    await mountPromise;

    expect(mockedPasskeyWallet.unlockPasskeyWallet).toHaveBeenCalledTimes(1);
    expect(props.changeAccount).toHaveBeenCalledTimes(1);
    expect(props.changeAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        account: ALT_PASSKEY_ADDRESS,
        provider: 'passkey_eoa',
      }),
    );
    expect(props.changeAccount).not.toHaveBeenCalledWith(
      expect.objectContaining({
        account: PASSKEY_ADDRESS,
      }),
    );
  });

  it('does not let stale passkey wallet sign-in completion overwrite logout', async () => {
    let resolveLogin!: (value: string) => void;
    mockedPasskeyWallet.unlockPasskeyWallet.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const props = buildProps({
      provider: 'none',
    });
    const subject = mountClassSubject(new LoginAndSettingsModalSubject(props));

    const signInPromise = subject.handlePasskeyWalletSignIn();
    await subject.handleLogout();
    resolveLogin(ALT_PASSKEY_ADDRESS);
    await signInPromise;

    expect(mockedPasskeyWallet.unlockPasskeyWallet).toHaveBeenCalledTimes(1);
    expect(props.changeAccount).toHaveBeenCalledTimes(1);
    expect(props.changeAccount).toHaveBeenCalledWith({});
    expect(props.changeAccount).not.toHaveBeenCalledWith(
      expect.objectContaining({
        account: ALT_PASSKEY_ADDRESS,
      }),
    );
    expect(props.updateLoginInfo).not.toHaveBeenLastCalledWith({
      loginInProgress: false,
      loginComplete: true,
      provider: 'passkey_eoa',
    });
  });

  it('does not let stale passkey wallet sign-in completion overwrite a Wagmi login', async () => {
    let resolveLogin!: (value: string) => void;
    mockedPasskeyWallet.unlockPasskeyWallet.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const props = buildProps({
      account: '',
      provider: 'none',
      wagmiAddress: '',
    });
    const subject = mountClassSubject(new LoginAndSettingsModalSubject(props));

    const signInPromise = subject.handlePasskeyWalletSignIn();
    subject.props = {
      ...subject.props,
      wagmiAddress: WAGMI_ADDRESS,
      wagmiNetwork: { id: 84532, chainId: 84532, name: 'Base Sepolia' },
    };
    await subject.updateStateUponWagmiLogin();
    resolveLogin(ALT_PASSKEY_ADDRESS);
    await signInPromise;

    expect(mockedPasskeyWallet.unlockPasskeyWallet).toHaveBeenCalledTimes(1);
    expect(props.changeAccount).toHaveBeenCalledTimes(1);
    expect(props.changeAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        account: WAGMI_ADDRESS,
        provider: 'wagmi',
      }),
    );
    expect(props.changeAccount).not.toHaveBeenCalledWith(
      expect.objectContaining({
        account: ALT_PASSKEY_ADDRESS,
        provider: 'passkey_eoa',
      }),
    );
    expect(props.updateLoginInfo).toHaveBeenLastCalledWith({
      loginInProgress: false,
      loginComplete: true,
      provider: 'wagmi',
    });
  });

  it('does not prefetch worker auth when loginComplete flips true after restore', () => {
    const prevProps = buildProps({
      account: PASSKEY_ADDRESS,
      provider: 'passkey_eoa',
      loginComplete: false,
    });
    const nextProps = buildProps({
      account: PASSKEY_ADDRESS,
      provider: 'passkey_eoa',
      loginComplete: true,
    });
    const subject = mountClassSubject(new LoginAndSettingsModalSubject(nextProps));
    subject.checkAndSendTestFundsIfNeeded = jest.fn();

    subject.componentDidUpdate(prevProps, subject.state);

    expect(getWorkerSessionToken).not.toHaveBeenCalled();
  });

  it('uses the explicit worker route slug when requesting a passkey session token', async () => {
    window.history.replaceState({}, '', '/session/worker-login?worker=https%3A%2F%2Fworker-login.example.com');
    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: PASSKEY_ADDRESS,
          provider: 'passkey_eoa',
          loginComplete: true,
          activeSessionSlug: 'stale-registry-session',
        }),
      ),
    );

    await subject.ensureWorkerSessionToken();

    expect(getWorkerSessionToken).toHaveBeenCalledWith({
      sessionSlug: 'worker-login',
      context: {
        account: PASSKEY_ADDRESS,
        providerLike: 'passkey_eoa',
        chainId: 84532,
      },
    });
  });

  it('adds the target network with a non-PATH RPC URL', async () => {
    const originalEthereum = window.ethereum;
    const request = jest.fn().mockResolvedValue(undefined);
    (window as any).ethereum = { request };
    try {
      const subject = mountClassSubject(new LoginAndSettingsModalSubject(buildProps()));
      subject.getTargetNetwork = jest.fn(() => baseSepolia);

      await subject.addCorrectNetwork();

      expect(request).toHaveBeenCalledWith({
        method: 'wallet_addEthereumChain',
        params: [
          expect.objectContaining({
            rpcUrls: [getDefaultHttpRpc(84532, { allowPath: false })],
          }),
        ],
      });
    } finally {
      (window as any).ethereum = originalEthereum;
    }
  });

  it('retries switching after adding an unknown target network', async () => {
    const originalEthereum = window.ethereum;
    const request = jest
      .fn()
      .mockRejectedValueOnce({ code: 4902 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    (window as any).ethereum = { request };
    try {
      const subject = mountClassSubject(new LoginAndSettingsModalSubject(buildProps()));
      subject.getTargetNetwork = jest.fn(() => baseSepolia);

      await subject.switchToCorrectNetwork();

      expect(request).toHaveBeenNthCalledWith(1, {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x14a34' }],
      });
      expect(request).toHaveBeenNthCalledWith(2, {
        method: 'wallet_addEthereumChain',
        params: [
          expect.objectContaining({
            chainId: '0x14a34',
            rpcUrls: [getDefaultHttpRpc(84532, { allowPath: false })],
          }),
        ],
      });
      expect(request).toHaveBeenNthCalledWith(3, {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x14a34' }],
      });
    } finally {
      (window as any).ethereum = originalEthereum;
    }
  });

  it('does not prefetch worker auth when navigating between sessions', () => {
    const prevProps = buildProps({
      account: PASSKEY_ADDRESS,
      provider: 'passkey_eoa',
      loginComplete: true,
      activeSessionSlug: 'edge',
    });
    const nextProps = buildProps({
      account: PASSKEY_ADDRESS,
      provider: 'passkey_eoa',
      loginComplete: true,
      activeSessionSlug: 'demo',
    });
    const subject = mountClassSubject(new LoginAndSettingsModalSubject(nextProps));
    subject.checkAndSendTestFundsIfNeeded = jest.fn();
    subject.loadAiSettings = jest.fn();
    subject.loadResourceKeys = jest.fn();
    subject.loadSponsoredAccess = jest.fn();
    subject.syncPasskeyWalletChain = jest.fn();

    subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.checkAndSendTestFundsIfNeeded).toHaveBeenCalledTimes(1);
    expect(subject.loadAiSettings).toHaveBeenCalledTimes(1);
    expect(subject.loadResourceKeys).toHaveBeenCalledTimes(1);
    expect(subject.loadSponsoredAccess).toHaveBeenCalledTimes(1);
    expect(subject.syncPasskeyWalletChain).toHaveBeenCalledTimes(1);
    expect(getWorkerSessionToken).not.toHaveBeenCalled();
  });

  it('refreshes worker resource presence when account settings are opened', () => {
    const prevProps = buildProps({
      activeSessionSlug: 'demo-1',
      loginModalToggled: false,
    });
    const nextProps = buildProps({
      activeSessionSlug: 'demo-1',
      loginModalToggled: true,
    });
    const subject = mountClassSubject(new LoginAndSettingsModalSubject(nextProps));
    subject.checkAndSendTestFundsIfNeeded = jest.fn();
    subject.loadSponsoredAccess = jest.fn();

    subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.loadSponsoredAccess).toHaveBeenCalledTimes(1);
  });

  it('coalesces simultaneous settings, account, and session sponsorship refreshes', () => {
    const prevProps = buildProps({
      account: '',
      activeSessionSlug: 'demo-1',
      loginModalToggled: false,
    });
    const nextProps = buildProps({
      account: PASSKEY_ADDRESS,
      activeSessionSlug: 'demo-2',
      loginModalToggled: true,
    });
    const subject = mountClassSubject(new LoginAndSettingsModalSubject(nextProps));
    subject.checkAndSendTestFundsIfNeeded = jest.fn();
    subject.loadSponsoredAccess = jest.fn();

    subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.loadSponsoredAccess).toHaveBeenCalledTimes(1);
  });

  it('scans managed cache entries without cloning values and de-duplicates slug clears', async () => {
    mockedCacheScripts.listNamespaceEntriesSync.mockImplementation((namespace: string) => {
      if (namespace === 'questionsCache') {
        return [
          { slug: 'edge', value: { heavy: true } },
          { slug: 'edge', value: { heavy: true } },
          { slug: '', value: { heavy: true } },
        ];
      }
      return [];
    });

    const subject = new LoginAndSettingsModalSubject(buildProps());
    subject.reloadPage = jest.fn();

    await subject.handleClearAllCaches();

    expect(mockedCacheScripts.listNamespaceEntriesSync).toHaveBeenCalledWith('questionsCache', { cloneValues: false });
    const edgeCalls = mockedCacheScripts.removeCache.mock.calls.filter(
      ([namespace, slug]: any[]) => namespace === 'questionsCache' && slug === 'edge',
    );
    expect(edgeCalls).toHaveLength(1);
    expect(mockedCacheScripts.removeCache).toHaveBeenCalledWith('questionsCache', '');
    expect(subject.reloadPage).toHaveBeenCalledTimes(1);
  });

  it('deduplicates in-flight cache clear requests', async () => {
    let resolveInit!: () => void;
    mockedCacheScripts.initCacheManager.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveInit = resolve;
        }),
    );

    const subject = new LoginAndSettingsModalSubject(buildProps());
    subject.reloadPage = jest.fn();

    const first = subject.handleClearAllCaches();
    const second = subject.handleClearAllCaches();
    expect(mockedCacheScripts.initCacheManager).toHaveBeenCalledTimes(1);

    resolveInit();
    await Promise.all([first, second]);

    expect(mockedCacheScripts.initCacheManager).toHaveBeenCalledTimes(1);
    expect(subject.reloadPage).toHaveBeenCalledTimes(1);
  });

  it('renders only the current pre-login layout and does not render legacy Torus button ids', () => {
    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        loginComplete: false,
        loginInProgress: false,
      }),
    );

    const tree = subject.getModalDisplay();

    expect(treeHasPropValue(tree, 'className', 'accountWarningContainer')).toBe(true);
    expect(treeHasPropValue(tree, 'className', 'passkeyButtonContainer')).toBe(true);
    expect(treeHasPropValue(tree, 'aria-label', 'Open Crypto Login (RainbowKit)')).toBe(false);
    expect(treeHasPropValue(tree, 'id', 'inModalTorusButton')).toBe(false);
    expect(treeHasPropValue(tree, 'id', 'torusButtonContainer')).toBe(false);
  });

  it('renders the shared overview panel in the pre-login drawer while config stays collapsed by default', () => {
    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        loginComplete: false,
        loginInProgress: false,
      }),
    );
    subject.state = {
      ...subject.state,
      preLoginSettingsOpen: true,
      preLoginConfigOpen: false,
    };

    const tree = subject.getPreLoginSettingsDisplay();

    expect(treeHasPropValue(tree, 'className', 'aiSettingsPanel')).toBe(true);
    expect(treeHasPropValue(tree, 'data-testid', 'ce-prelogin-config-panel')).toBe(false);
  });

  it('sets persistent wagmi disconnect flag on wagmi logout', async () => {
    const wagmiDisconnect = jest.fn();
    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        provider: 'wagmi',
        wagmiDisconnect,
      }),
    );

    await subject.handleLogout();

    expect(wagmiDisconnect).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('ce:userDisconnected')).toBe('true');
  });

  it('persists wagmi disconnect intent even when wagmi disconnect throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const disconnectError = new Error('disconnect failed');
    const wagmiDisconnect = jest.fn(() => {
      throw disconnectError;
    });
    const props = buildProps({
      provider: 'wagmi',
      wagmiDisconnect,
    });
    const subject = new LoginAndSettingsModalSubject(props);

    try {
      await expect(subject.handleLogout()).resolves.toBeUndefined();
      expect(wagmiDisconnect).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('ce:userDisconnected')).toBe('true');
      expect(props.updateLoginInfo).toHaveBeenCalledWith({
        loginInProgress: false,
        loginComplete: false,
        provider: null,
      });
      expect(props.changeAccount).toHaveBeenCalledWith({});
      expect(clearAllWorkerSessionTokens).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith('[account]', 'wagmiDisconnect failed:', disconnectError);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('does not set wagmi disconnect flag when logging out passkey wallet', async () => {
    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        provider: 'passkey_eoa',
        wagmiDisconnect: jest.fn(),
      }),
    );

    await subject.handleLogout();

    expect(mockedPasskeyWallet.logoutPasskeyWallet).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('ce:userDisconnected')).toBeNull();
  });

  it('clears worker tokens and notifies when passkey wallet sign-in switches passkey accounts', () => {
    const props = buildProps({
      account: PASSKEY_ADDRESS,
      provider: 'passkey_eoa',
    });
    const subject = new LoginAndSettingsModalSubject(props);

    subject._finalizePasskeyWalletLogin(ALT_PASSKEY_ADDRESS, { id: 84532, chainId: 84532, name: 'Base Sepolia' });

    expect(clearAllWorkerSessionTokens).toHaveBeenCalledTimes(1);
    expect(mockedNotify.info).toHaveBeenCalledWith('Passkey account switched.');
    expect(props.changeAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        account: ALT_PASSKEY_ADDRESS,
        provider: 'passkey_eoa',
      }),
    );
    expect(props.updateLoginInfo).toHaveBeenCalledWith({
      loginInProgress: false,
      loginComplete: true,
      provider: 'passkey_eoa',
    });
  });

  it('uses wagmi balance props for faucet checks without Redux balance state', async () => {
    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: WAGMI_ADDRESS,
          loginComplete: true,
          provider: 'wagmi',
          wagmiBalance: { data: { value: 0n } },
        }),
      ),
    );
    subject.autoSendTestFunds = jest.fn();

    await subject.checkAndSendTestFundsIfNeeded();

    expect(subject.autoSendTestFunds).toHaveBeenCalledTimes(1);
    expect(getProviderLocation).not.toHaveBeenCalled();
    expect(subject.state.autoSendTriggered).toBe(true);
    expect(subject.state.walletBalanceWei.eq(ethers.BigNumber.from(0))).toBe(true);
  });

  it('does not repeat automatic faucet sends for the same low-balance context', async () => {
    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: WAGMI_ADDRESS,
          activeSessionSlug: 'edge',
          loginComplete: true,
          provider: 'wagmi',
          wagmiBalance: { data: { value: 0n } },
        }),
      ),
    );
    subject.autoSendTestFunds = jest.fn();
    subject.loadAiSettings = jest.fn();
    subject.loadResourceKeys = jest.fn();
    subject.loadSponsoredAccess = jest.fn();
    subject.syncPasskeyWalletChain = jest.fn();

    await subject.checkAndSendTestFundsIfNeeded();
    await subject.checkAndSendTestFundsIfNeeded();

    expect(subject.autoSendTestFunds).toHaveBeenCalledTimes(1);
    expect(subject.state.autoSendTriggered).toBe(true);

    const checkAndSendTestFundsIfNeeded = subject.checkAndSendTestFundsIfNeeded;
    const prevProps = subject.props;
    const prevState = { ...subject.state };
    subject.checkAndSendTestFundsIfNeeded = jest.fn();
    subject.props = {
      ...subject.props,
      activeSessionSlug: 'demo',
    };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.state.autoSendTriggered).toBe(false);

    subject.checkAndSendTestFundsIfNeeded = checkAndSendTestFundsIfNeeded;
    await subject.checkAndSendTestFundsIfNeeded();

    expect(subject.autoSendTestFunds).toHaveBeenCalledTimes(2);
    expect(subject.state.autoSendTriggered).toBe(true);
  });

  it('treats equivalent wagmi BigNumber balance snapshots as unchanged', () => {
    const prevProps = buildProps({
      account: WAGMI_ADDRESS,
      loginComplete: true,
      provider: 'wagmi',
      wagmiBalance: { data: { value: ethers.BigNumber.from(0) } },
    });
    const nextProps = {
      ...prevProps,
      wagmiBalance: { data: { value: ethers.BigNumber.from(0) } },
    };
    const subject = mountClassSubject(new LoginAndSettingsModalSubject(nextProps));
    subject.checkAndSendTestFundsIfNeeded = jest.fn();

    subject.componentDidUpdate(prevProps);

    expect(subject.checkAndSendTestFundsIfNeeded).not.toHaveBeenCalled();
    expect(
      subject.shouldComponentUpdate(
        {
          ...nextProps,
          wagmiBalance: { data: { value: ethers.BigNumber.from(0) } },
        },
        subject.state,
      ),
    ).toBe(false);
  });

  it('uses the live wagmi address for faucet checks before Redux account catches up', async () => {
    const nextWagmiAddress = '0x4444444444444444444444444444444444444444';
    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: WAGMI_ADDRESS,
          loginComplete: true,
          provider: 'wagmi',
          wagmiAddress: nextWagmiAddress,
          wagmiBalance: { data: { value: 0n } },
        }),
      ),
    );

    await subject.checkAndSendTestFundsIfNeeded();

    expect(mockedContractScripts.sendTestnetFunds).toHaveBeenCalledWith(
      nextWagmiAddress,
      '',
      expect.objectContaining({
        context: expect.objectContaining({
          account: nextWagmiAddress,
          providerLike: 'wagmi',
          chainId: 84532,
        }),
      }),
    );
    expect(subject.state.walletBalanceWei.eq(ethers.BigNumber.from(0))).toBe(true);
  });

  it('uses the active session chain for faucet requests even when the wallet is on another chain', async () => {
    mockedGetSessionNetwork.mockImplementation((slug: string) =>
      slug === 'demo-1'
        ? { id: 11155420, chainId: 11155420, name: 'OP Sepolia' }
        : { id: 84532, chainId: 84532, name: 'Base Sepolia' },
    );
    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: WAGMI_ADDRESS,
          loginComplete: true,
          provider: 'wagmi',
          activeSessionSlug: 'demo-1',
          network: { id: 84532, chainId: 84532, name: 'Base Sepolia' },
          wagmiNetwork: { id: 84532, chainId: 84532, name: 'Base Sepolia' },
          wagmiBalance: { data: { value: 0n } },
        }),
      ),
    );

    await subject.checkAndSendTestFundsIfNeeded();

    expect(mockedContractScripts.sendTestnetFunds).toHaveBeenCalledWith(
      WAGMI_ADDRESS,
      'demo-1',
      expect.objectContaining({
        context: expect.objectContaining({
          account: WAGMI_ADDRESS,
          providerLike: 'wagmi',
          chainId: 11155420,
          walletChainId: 84532,
        }),
      }),
    );
  });

  it('preserves the zero-balance state when auto-funding is disabled', async () => {
    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: WAGMI_ADDRESS,
          loginComplete: true,
          provider: 'wagmi',
          wagmiBalance: { data: { value: 0n } },
        }),
      ),
    );
    subject.state.autoRequestTestnetFundsEnabled = false;

    await subject.checkAndSendTestFundsIfNeeded();

    expect(mockedContractScripts.sendTestnetFunds).not.toHaveBeenCalled();
    expect(subject.state.autoSendTriggered).toBe(false);
    expect(subject.state.walletBalanceWei.eq(ethers.BigNumber.from(0))).toBe(true);
  });

  it('keeps the wallet balance unknown state when the balance has not been loaded yet', () => {
    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        account: WAGMI_ADDRESS,
        loginComplete: true,
        provider: 'wagmi',
        wagmiBalance: { data: { value: null } },
      }),
    );

    expect(subject.state.walletBalanceWei).toBeNull();
  });

  it('keeps the balance unset when passkey balance reads fail', async () => {
    const getBalance = jest.fn(async () => {
      throw new Error('rpc timeout');
    });
    const providerCtorSpy = jest.spyOn(ethers.providers, 'Web3Provider').mockImplementation(function MockWeb3Provider(
      this: any,
    ) {
      this.getBalance = getBalance;
    } as any);

    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: PASSKEY_ADDRESS,
          loginComplete: true,
          provider: 'passkey_eoa',
        }),
      ),
    );
    subject.autoSendTestFunds = jest.fn();

    await subject.checkAndSendTestFundsIfNeeded();

    expect(subject.state.walletBalanceWei).toBeNull();
    expect(subject.autoSendTestFunds).not.toHaveBeenCalled();

    providerCtorSpy.mockRestore();
  });

  it('triggers passkey faucet checks after a successful balance sync', async () => {
    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: PASSKEY_ADDRESS,
          loginComplete: true,
          provider: 'passkey_eoa',
        }),
      ),
    );
    subject.autoSendTestFunds = jest.fn();
    subject.syncWalletBalance = jest.fn(async () => ({
      balance: ethers.BigNumber.from(0),
      stale: false,
    }));

    await subject.checkAndSendTestFundsIfNeeded();

    expect(subject.syncWalletBalance).toHaveBeenCalledTimes(1);
    expect(subject.autoSendTestFunds).toHaveBeenCalledTimes(1);
  });

  it('does not request testnet funds for a chainless worker-canonical session', async () => {
    mockedGetSessionConfigBySlugOrDefault.mockReturnValue(null);
    mockedGetDemoSessionConfigBySlug.mockReturnValue({
      slug: 'demo-sh',
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    });
    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: PASSKEY_ADDRESS,
          activeSessionSlug: 'demo-sh',
          loginComplete: true,
          provider: 'passkey_eoa',
        }),
      ),
    );
    subject.syncWalletBalance = jest.fn(async () => ({
      balance: ethers.BigNumber.from(0),
      stale: false,
    }));
    subject.autoSendTestFunds = jest.fn();

    await subject.checkAndSendTestFundsIfNeeded();

    expect(subject.syncWalletBalance).not.toHaveBeenCalled();
    expect(subject.autoSendTestFunds).not.toHaveBeenCalled();
    expect(subject.state.autoSendTriggered).toBe(false);
  });

  it('stores visible faucet success state for manual settings requests', async () => {
    mockedContractScripts.sendTestnetFunds.mockResolvedValueOnce({
      txHash: '0xfeed1234',
      amountEth: '0.0002',
    });

    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: WAGMI_ADDRESS,
          loginComplete: true,
          provider: 'wagmi',
          activeSessionSlug: 'edge',
          wagmiBalance: { data: { value: 0n } },
        }),
      ),
    );

    await subject.handleManualTestFundsRequest();

    expect(mockedContractScripts.sendTestnetFunds).toHaveBeenCalledWith(
      WAGMI_ADDRESS,
      'edge',
      expect.objectContaining({
        context: expect.objectContaining({
          account: WAGMI_ADDRESS,
          providerLike: 'wagmi',
          chainId: 84532,
        }),
      }),
    );
    expect(subject.state.sentTxHash).toBe('0xfeed1234');
    expect(subject.state.testFundsStatusTone).toBe('success');
    expect(subject.state.testFundsStatusMessage).toMatch(/Test gas sent/i);
  });

  it('stores visible faucet error state for manual settings requests', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Failed to request test ETH: Token missing faucet scope.');
    (error as any).status = 403;
    mockedContractScripts.sendTestnetFunds.mockRejectedValueOnce(error);

    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: WAGMI_ADDRESS,
          loginComplete: true,
          provider: 'wagmi',
          activeSessionSlug: 'edge',
          wagmiBalance: { data: { value: 0n } },
        }),
      ),
    );

    try {
      await subject.handleManualTestFundsRequest();

      expect(subject.state.sentTxHash).toBe('');
      expect(subject.state.testFundsStatusTone).toBe('error');
      expect(subject.state.testFundsStatusMessage).toContain('Get test gas failed');
      expect(subject.state.testFundsStatusMessage).toContain('Token missing faucet scope.');
      expect(consoleErrorSpy).toHaveBeenCalledWith('[account]', 'Manual testnet funds request failed:', error);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('ignores stale manual faucet responses after the active session changes', async () => {
    let resolveFunds!: (value: any) => void;
    mockedContractScripts.sendTestnetFunds.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFunds = resolve;
        }),
    );

    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: WAGMI_ADDRESS,
          loginComplete: true,
          provider: 'wagmi',
          activeSessionSlug: 'edge',
          wagmiBalance: { data: { value: 0n } },
        }),
      ),
    );
    subject.checkAndSendTestFundsIfNeeded = jest.fn();
    subject.loadAiSettings = jest.fn();
    subject.loadResourceKeys = jest.fn();
    subject.loadSponsoredAccess = jest.fn();
    subject.syncPasskeyWalletChain = jest.fn();

    const requestPromise = subject.handleManualTestFundsRequest();
    expect(subject.state.sendingTestFunds).toBe(true);

    const prevProps = subject.props;
    const prevState = { ...subject.state };
    subject.props = {
      ...subject.props,
      activeSessionSlug: 'demo',
    };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.state.sendingTestFunds).toBe(false);
    expect(subject.state.sentTxHash).toBe('');
    expect(subject.state.testFundsStatusMessage).toBe('');

    resolveFunds({
      txHash: '0xfeed1234',
      amountEth: '0.0002',
    });
    await requestPromise;

    expect(subject.state.sendingTestFunds).toBe(false);
    expect(subject.state.sentTxHash).toBe('');
    expect(subject.state.testFundsStatusMessage).toBe('');
    expect(subject.state.testFundsStatusTone).toBe('');
  });

  it('ignores stale balance reads after the active wallet changes', async () => {
    let resolveBalance!: (value: any) => void;
    const subject = mountClassSubject(
      new LoginAndSettingsModalSubject(
        buildProps({
          account: PASSKEY_ADDRESS,
          loginComplete: true,
          provider: 'passkey_eoa',
        }),
      ),
    );
    subject.autoSendTestFunds = jest.fn();
    subject.readWalletBalance = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveBalance = resolve;
        }),
    );

    const pendingCheck = subject.checkAndSendTestFundsIfNeeded();
    for (let attempt = 0; attempt < 10 && subject.readWalletBalance.mock.calls.length === 0; attempt += 1) {
      await Promise.resolve();
    }
    expect(subject.readWalletBalance).toHaveBeenCalledTimes(1);
    subject.props = buildProps({
      account: ALT_PASSKEY_ADDRESS,
      loginComplete: true,
      provider: 'passkey_eoa',
    });
    resolveBalance(ethers.BigNumber.from(0));
    await pendingCheck;

    expect(subject.autoSendTestFunds).not.toHaveBeenCalled();
    expect(subject.state.walletBalanceWei).toBeNull();
  });

  it('uses explicit demo-session metadata for non-authoritative session descriptors', () => {
    mockedGetSessionConfigBySlugOrDefault.mockReturnValueOnce(null);
    mockedGetDemoSessionConfigBySlug.mockReturnValueOnce({
      slug: 'rxc',
      sessionName: 'Weyl v. Yarvin Debate',
    });

    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        activeSessionSlug: 'rxc',
      }),
    );

    expect(subject.getSessionDescriptor('rxc')).toEqual(
      expect.objectContaining({
        slug: 'rxc',
        slugLabel: 'rxc',
        sessionName: 'Weyl v. Yarvin Debate',
        label: 'Weyl v. Yarvin Debate',
        description: 'Weyl v. Yarvin Debate (rxc)',
      }),
    );
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('rxc', { allowDemoFallback: true });
  });

  it('includes the logged-in session selector when the settings panel is open', () => {
    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        account: WAGMI_ADDRESS,
        loginComplete: true,
        provider: 'wagmi',
        activeSessionSlug: 'edge',
      }),
    );
    subject.state = {
      ...subject.state,
      aiSettingsOpen: true,
      aiSettingsSectionsOpen: {
        ...subject.state.aiSettingsSectionsOpen,
        session: true,
      },
    };

    expect(treeHasPropValue(subject.getSettingsDisplay(), 'data-testid', 'ce-web3modal-session-select')).toBe(true);
  });

  it('persists the selected-session scope and list from the settings panel', () => {
    const props = buildProps({
      account: WAGMI_ADDRESS,
      loginComplete: true,
      provider: 'wagmi',
      activeSessionSlug: 'edge',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['edge', 'rxc'],
      updateGlobalSessionSelection: jest.fn(),
    });
    const subject = mountClassSubject(new LoginAndSettingsModalSubject(props));
    subject.state = {
      ...subject.state,
      sessionScanScope: 'list',
      sessionScanSlugs: ['edge', 'rxc'],
    };
    subject.getConfiguredSessionScanSlugs = jest.fn(() => ['edge', 'rxc']);
    subject.getActiveSessionSlug = jest.fn(() => 'edge');

    subject.handleSaveSessionScanSettings();

    const savedSelection = props.updateGlobalSessionSelection.mock.calls[0]?.[0] || {};
    expect(savedSelection).toEqual(
      expect.objectContaining({
        selectedSessionSlugs: ['edge', 'rxc'],
      }),
    );
    expect(savedSelection).not.toHaveProperty('primarySessionSlug');
    expect(subject.state.sessionScanStatus).toBe('Saved.');
  });

  it('preserves an explicit general primary session while list scope is active', () => {
    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        activeSessionSlug: '',
        primarySessionExplicit: true,
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['', 'edge'],
      }),
    );
    subject.state = {
      ...subject.state,
      sessionScanScope: 'list',
      sessionScanSlugs: ['', 'edge'],
    };

    expect(subject.getActiveSessionSlug()).toBe('');
  });

  it('allows saving an empty selected-session list from the local draft', () => {
    mockedSessionScanScope.normalizeSessionScanScope.mockImplementation((value: any) => value || 'all');
    const props = buildProps({
      account: WAGMI_ADDRESS,
      loginComplete: true,
      provider: 'wagmi',
      activeSessionSlug: 'edge',
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['edge'],
      updateGlobalSessionSelection: jest.fn(),
    });
    const subject = mountClassSubject(new LoginAndSettingsModalSubject(props));
    subject.state = {
      ...subject.state,
      sessionScanScope: 'list',
      sessionScanSlugs: [],
      sessionScanSlugsInput: '',
    };
    expect(
      subject.getConfiguredSessionScanSlugs({
        sessionScanSlugs: [],
        sessionScanSlugsInput: '',
      }),
    ).toEqual([]);
    subject.getConfiguredSessionScanSlugs = jest.fn(() => []);
    subject.getActiveSessionSlug = jest.fn(() => 'edge');

    subject.handleSaveSessionScanSettings();

    const savedSelection = props.updateGlobalSessionSelection.mock.calls[0]?.[0] || {};
    expect(savedSelection).toEqual(
      expect.objectContaining({
        selectedSessionSlugs: [],
      }),
    );
    expect(savedSelection).not.toHaveProperty('primarySessionSlug');
    expect(subject.state.sessionScanScope).toBe('general');
    expect(subject.state.sessionScanStatus).toBe('No sessions selected; saved as general mode.');
  });

  it('derives the list-mode primary session from the first selected session slug', () => {
    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        activeSessionSlug: '',
      }),
    );
    subject.getSessionScanScopeValue = jest.fn(() => 'list');
    subject.getConfiguredSessionScanSlugs = jest.fn(() => ['edge', 'rxc']);

    expect(
      subject.getListModePrimarySessionSlug({
        sessionScanScope: 'list',
        sessionScanSlugs: ['edge', 'rxc'],
      }),
    ).toBe('edge');
  });

  it('uses demo-session sponsored keys for display-only sponsor session sources', () => {
    mockedGetAllSessionSlugs.mockReturnValue(['edge']);
    mockedGetSessionConfigBySlugOrDefault.mockImplementation((slug: any) => (String(slug || '') === '' ? {} : null));
    mockedGetDemoSessionConfigBySlug.mockImplementation((slug: any) =>
      String(slug || '') === 'edge'
        ? {
            slug: 'edge',
            sessionName: 'Edge 2025',
            sponsoredKeys: {
              ai: { encrypted: true },
              rpc: { encrypted: true },
            },
          }
        : null,
    );

    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        activeSessionSlug: 'edge',
      }),
    );

    const sources = subject.getSponsoredSessionSources({ activeSlug: 'edge' });

    expect(sources.byResource.ai).toEqual([
      expect.objectContaining({
        slug: 'edge',
        sessionName: 'Edge 2025',
        isActive: true,
        sponsoredKeys: expect.objectContaining({
          ai: expect.objectContaining({ encrypted: true }),
        }),
      }),
    ]);
    expect(sources.byResource.rpc).toEqual([
      expect.objectContaining({
        slug: 'edge',
        sessionName: 'Edge 2025',
        sponsoredKeys: expect.objectContaining({
          rpc: expect.objectContaining({ encrypted: true }),
        }),
      }),
    ]);
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('edge', { allowDemoFallback: true });
  });

  it('refreshes sponsored session source memo entries when sponsored keys change without slug churn', () => {
    mockedGetAllSessionSlugs.mockReturnValue(['edge']);
    let sponsoredKeys: any = {
      ai: { encrypted: true },
    };
    mockedGetSessionConfigBySlugOrDefault.mockImplementation((slug: any) =>
      String(slug || '') === 'edge'
        ? {
            slug: 'edge',
            sessionName: 'Edge 2025',
            sponsoredKeys,
          }
        : {},
    );

    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        activeSessionSlug: 'edge',
      }),
    );

    expect(subject.getSponsoredSessionSources({ activeSlug: 'edge' }).byResource.rpc).toEqual([]);

    sponsoredKeys = {
      ...sponsoredKeys,
      rpc: { encrypted: true },
    };

    expect(subject.getSponsoredSessionSources({ activeSlug: 'edge' }).byResource.rpc).toEqual([
      expect.objectContaining({
        slug: 'edge',
        sponsoredKeys: expect.objectContaining({
          rpc: expect.objectContaining({ encrypted: true }),
        }),
      }),
    ]);
  });

  it('uses active worker presence when registry sponsorship flags are stale', () => {
    mockedGetAllSessionSlugs.mockReturnValue(['demo-1']);
    mockedGetSessionConfigBySlugOrDefault.mockImplementation((slug: any) =>
      String(slug || '') === 'demo-1'
        ? {
            slug: 'demo-1',
            sessionName: 'demo 1',
            sponsoredKeys: { faucet: true },
          }
        : {},
    );

    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        activeSessionSlug: 'demo-1',
      }),
    );
    subject.state.workerResourcePresence = {
      ai: true,
      arweave: true,
      rpc: true,
      txGas: true,
    };

    const sources = subject.getSponsoredSessionSources({ activeSlug: 'demo-1' });
    expect(sources.byResource.ai[0]).toEqual(expect.objectContaining({ slug: 'demo-1', isActive: true }));
    expect(sources.byResource.arweave[0]).toEqual(expect.objectContaining({ slug: 'demo-1', isActive: true }));
    expect(sources.byResource.rpc[0]).toEqual(expect.objectContaining({ slug: 'demo-1', isActive: true }));
    expect(sources.byResource.txGas[0]).toEqual(expect.objectContaining({ slug: 'demo-1', isActive: true }));
  });

  it('refreshes settings overview sponsorship cards when sponsored keys change without slug churn', () => {
    mockedGetAllSessionSlugs.mockReturnValue(['edge']);
    let sponsoredKeys: any = {
      ai: { encrypted: true },
    };
    mockedGetSessionConfigBySlugOrDefault.mockImplementation((slug: any) =>
      String(slug || '') === 'edge'
        ? {
            slug: 'edge',
            sessionName: 'Edge 2025',
            sponsoredKeys,
          }
        : {},
    );

    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        activeSessionSlug: 'edge',
        loginComplete: true,
      }),
    );

    expect(subject.getSettingsOverviewContext().sponsorSessions.byResource.rpc).toEqual([]);

    sponsoredKeys = {
      ...sponsoredKeys,
      rpc: { encrypted: true },
    };

    expect(subject.getSettingsOverviewContext().sponsorSessions.byResource.rpc).toEqual([
      expect.objectContaining({
        slug: 'edge',
        sponsoredKeys: expect.objectContaining({
          rpc: expect.objectContaining({ encrypted: true }),
        }),
      }),
    ]);
  });

  it('uses demo-session sponsored keys for display-only active-session config when strict config is missing', () => {
    mockedGetSessionConfigBySlugOrDefault.mockImplementation((slug: any) => (String(slug || '') === '' ? {} : null));
    mockedGetDemoSessionConfigBySlug.mockImplementation((slug: any) =>
      String(slug || '') === 'edge'
        ? {
            slug: 'edge',
            sessionName: 'Edge 2025',
            sponsoredKeys: {
              ai: { encrypted: true },
            },
          }
        : null,
    );

    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        activeSessionSlug: 'edge',
      }),
    );

    expect(subject.getDisplaySessionConfig('edge')).toEqual(
      expect.objectContaining({
        slug: 'edge',
        sessionName: 'Edge 2025',
        sponsoredKeys: expect.objectContaining({
          ai: expect.objectContaining({ encrypted: true }),
        }),
      }),
    );
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('edge', { allowDemoFallback: true });
  });

  it('keeps registry operational fields authoritative over a matching route overlay', () => {
    mockedGetSessionConfigBySlugOrDefault.mockImplementation((slug: any) =>
      String(slug || '') === 'demo-1'
        ? {
            slug: 'demo-1',
            sessionName: 'demo 1',
            corsWorkerUrl: 'https://live-worker.example',
            sponsoredKeys: { arweave: true, rpc: true },
          }
        : {},
    );
    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        activeSessionSlug: 'demo-1',
        sessionConfig: {
          slug: 'demo-1',
          sessionName: 'Demo display overlay',
          corsWorkerUrl: 'https://stale-worker.example',
          sponsoredKeys: { faucet: true },
        },
      }),
    );

    expect(subject.getDisplaySessionConfig('demo-1')).toEqual(
      expect.objectContaining({
        sessionName: 'demo 1',
        corsWorkerUrl: 'https://live-worker.example',
        sponsoredKeys: { faucet: true, arweave: true, rpc: true },
      }),
    );
  });

  it('keeps loadSponsoredAccess strict when only a demo-session config exists', async () => {
    mockedGetSessionConfigBySlugOrDefault.mockImplementation((slug: any) => (String(slug || '') === 'rxc' ? null : {}));
    mockedGetDemoSessionConfigBySlug.mockImplementation((slug: any) =>
      String(slug || '') === 'rxc'
        ? {
            slug: 'rxc',
            sessionName: 'Weyl v. Yarvin Debate',
            sponsoredKeys: {
              ai: { encrypted: true },
            },
          }
        : null,
    );
    mockedCheckSponsoredAccess.mockResolvedValue({ status: 'unknown' });

    const subject = new LoginAndSettingsModalSubject(
      buildProps({
        activeSessionSlug: 'rxc',
        account: '0x00000000000000000000000000000000000000aa',
      }),
    );
    subject.setState = jest.fn((patch) => {
      subject.state = { ...subject.state, ...(patch || {}) };
    });

    await subject.loadSponsoredAccess();

    expect(checkSponsoredAccess).toHaveBeenCalledTimes(4);
    mockedCheckSponsoredAccess.mock.calls.forEach(([arg]: any[]) => {
      expect(arg).toEqual(
        expect.objectContaining({
          sessionSlug: 'rxc',
          account: '0x00000000000000000000000000000000000000aa',
        }),
      );
      expect(arg.sessionConfig).toEqual({});
    });
    expect(getDemoSessionConfigBySlug).not.toHaveBeenCalled();
    expect(readWorkerResourcePresence).not.toHaveBeenCalled();
  });

  it('reads worker resource presence only while account settings are visible', async () => {
    mockedGetSessionConfigBySlugOrDefault.mockReturnValue({
      slug: 'demo-1',
      corsWorkerUrl: 'https://worker.example',
    });

    const hiddenSubject = mountClassSubject(
      new LoginAndSettingsModalSubject(buildProps({ activeSessionSlug: 'demo-1', loginModalToggled: false })),
    );
    await hiddenSubject.loadSponsoredAccess();
    expect(readWorkerResourcePresence).not.toHaveBeenCalled();

    const visibleSubject = mountClassSubject(
      new LoginAndSettingsModalSubject(buildProps({ activeSessionSlug: 'demo-1', loginModalToggled: true })),
    );
    await visibleSubject.loadSponsoredAccess();

    expect(readWorkerResourcePresence).toHaveBeenCalledTimes(1);
    expect(readWorkerResourcePresence).toHaveBeenCalledWith(expect.objectContaining({ sessionSlug: 'demo-1' }));
  });
});
