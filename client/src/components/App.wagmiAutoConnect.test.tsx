import React from 'react';
import { act, cleanup, render } from '@testing-library/react';

const buildMockConfigureChainsResult = (_chains: unknown[], _providers: unknown[]) => ({
  chains: [{ id: 84532, chainId: 84532, name: 'Base Sepolia' }],
  provider: {},
  webSocketProvider: { kind: 'configured-websocket-provider' },
});
const buildMockJsonRpcProvider =
  ({ rpc }: { rpc: (chain: any) => { http: string } | null }) =>
  (chain: any) => {
    const rpcConfig = rpc(chain);
    if (!rpcConfig?.http) return null;
    const provider = jest.fn(() => ({ send: jest.fn(), rpcUrl: rpcConfig.http }));
    return {
      chain: {
        ...chain,
        rpcUrls: {
          ...(chain?.rpcUrls || {}),
          default: { http: [rpcConfig.http] },
          public: { http: [rpcConfig.http] },
        },
      },
      provider,
    };
  };
const mockCreateClient = jest.fn(() => ({}));
const mockConfigureChains = jest.fn(buildMockConfigureChainsResult);
const mockConnectorsForWallets = jest.fn(() => []);
const mockJsonRpcProvider = jest.fn(buildMockJsonRpcProvider);
const mockWrapEthersJsonRpcSend = jest.fn((provider: any, _meta: any) => provider);
const mockMetaMaskWalletCreateConnector = jest.fn(() => ({
  connector: { id: 'walletConnect-fallback' },
}));
const mockMetaMaskWallet = jest.fn(() => ({
  id: 'metaMask',
  name: 'MetaMask',
  iconUrl: 'metamask-icon',
  iconBackground: '#fff',
  createConnector: mockMetaMaskWalletCreateConnector,
}));
const mockMetaMaskConnector = jest.fn((options: unknown) => ({
  id: 'metaMask-injected',
  options,
}));
const mockReadColdLoadOnboardingState = jest.fn((_storage?: Storage, _pathname?: string) => ({
  firstVisit: true,
  shouldStartOnboarding: false,
}));
const mockStoreDispatch = jest.fn();
const mockSyncPublicPageHead = jest.fn();
const mockToaster = jest.fn((_props?: any) => null);
let MockAppShellComponent: React.ComponentType<any> = () => null;
let routeProps: any[] = [];
let mockWalletConnectFallbackEnabled = false;

type WalletGroup = {
  wallets?: Array<{
    createConnector: () => {
      connector: {
        id: string;
      };
    };
  }>;
};

const MockRoute = (props: any) => {
  routeProps.push(props);
  return null;
};

const mockAppDependencies = () => {
  jest.doMock('react-redux', () => ({
    Provider: ({ children }: { children: React.ReactNode }) => children,
  }));

  jest.doMock('react-router-dom', () => ({
    BrowserRouter: ({ children }: { children: React.ReactNode }) => children,
    Routes: ({ children }: { children: React.ReactNode }) => children,
    Route: MockRoute,
    Link: () => null,
  }));

  jest.doMock('reactstrap', () => ({
    Container: ({ children }: { children: React.ReactNode }) => children,
    Row: ({ children }: { children: React.ReactNode }) => children,
    Col: ({ children }: { children: React.ReactNode }) => children,
  }));

  jest.doMock('@rainbow-me/rainbowkit/styles.css', () => ({}));
  jest.doMock('./Shared/CEToaster', () => ({
    __esModule: true,
    default: (props: any) => {
      mockToaster(props);
      return null;
    },
  }));

  jest.doMock('../store.js', () => ({
    __esModule: true,
    default: {
      dispatch: mockStoreDispatch,
    },
  }));
  jest.doMock('../variables/appConfig.js', () => ({
    SERVER: 'http://localhost',
    CE_ENABLE_WALLETCONNECT_FALLBACK: mockWalletConnectFallbackEnabled,
  }));
  jest.doMock('../utilities/ceAgent.js', () => ({ installCeAgent: jest.fn() }));
  jest.doMock('../utilities/logging', () => ({
    createLogger: () => ({
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  }));
  jest.doMock('../utilities/ui/publicPageHead.js', () => ({
    syncPublicPageHead: mockSyncPublicPageHead,
  }));

  jest.doMock('./HooksHOC/withRouterBridge', () => ({
    __esModule: true,
    default: (Comp: React.ComponentType<any>) => Comp,
  }));
  jest.doMock('./MainSite/AppShell', () => ({
    __esModule: true,
    default: (props: any) => <MockAppShellComponent {...props} />,
  }));
  jest.doMock('./Onboarding/onboardingConfig.js', () => ({
    readColdLoadOnboardingState: mockReadColdLoadOnboardingState,
  }));

  jest.doMock('@rainbow-me/rainbowkit', () => ({
    getDefaultWallets: jest.fn(),
    connectorsForWallets: mockConnectorsForWallets,
    RainbowKitProvider: ({ children }: { children: React.ReactNode }) => children,
  }));
  jest.doMock('@rainbow-me/rainbowkit/wallets', () => ({
    rainbowWallet: jest.fn(() => ({})),
    metaMaskWallet: mockMetaMaskWallet,
    coinbaseWallet: jest.fn(() => ({})),
  }));

  jest.doMock('wagmi', () => ({
    configureChains: mockConfigureChains,
    createClient: mockCreateClient,
    createStorage: jest.fn(({ storage }: { storage: unknown }) => ({ storage })),
    WagmiConfig: ({ children }: { children: React.ReactNode }) => children,
  }));
  jest.doMock('@wagmi/core', () => ({
    noopStorage: {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
  }));
  jest.doMock('wagmi/connectors/metaMask', () => ({
    MetaMaskConnector: mockMetaMaskConnector,
  }));
  jest.doMock('wagmi/chains', () => ({
    goerli: { id: 5, chainId: 5, name: 'Goerli' },
    localhost: { id: 31337, chainId: 31337, name: 'Localhost' },
  }));
  jest.doMock('wagmi/connectors/injected', () => ({
    InjectedConnector: jest.fn(),
  }));
  jest.doMock('wagmi/providers/jsonRpc', () => ({
    jsonRpcProvider: mockJsonRpcProvider,
  }));
  jest.doMock('../utilities/web3/rpcReadCache.js', () => ({
    wrapEthersJsonRpcSend: mockWrapEthersJsonRpcSend,
  }));

  jest.doMock('../utilities/web3/rpcSelection.js', () => ({
    getFallbackRpcUrlForChain: jest.fn(() => 'https://fallback.example'),
    getPrimaryRpcUrlForChain: jest.fn(() => 'https://primary.example'),
  }));

  const chain = { id: 84532, chainId: 84532, name: 'Base Sepolia' };
  jest.doMock('../variables/chains.js', () => ({
    mainnet: chain,
    base: chain,
    optimism: chain,
    arbitrum: chain,
    baseSepolia: chain,
    optimismSepolia: chain,
    arbitrumSepolia: chain,
  }));
};

const loadAppModule = (): any => {
  let appModule: any;
  jest.isolateModules(() => {
    appModule = require('./App');
  });
  return appModule;
};

describe('App wagmi auto-connect persistence', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    routeProps = [];
    MockAppShellComponent = () => null;
    mockWalletConnectFallbackEnabled = false;
    mockCreateClient.mockImplementation(() => ({}));
    mockConfigureChains.mockImplementation(buildMockConfigureChainsResult);
    mockJsonRpcProvider.mockImplementation(buildMockJsonRpcProvider);
    mockWrapEthersJsonRpcSend.mockImplementation((provider: any, _meta: any) => provider);
    mockConfigureChains.mockClear();
    mockJsonRpcProvider.mockClear();
    mockWrapEthersJsonRpcSend.mockClear();
    mockConnectorsForWallets.mockReturnValue([]);
    mockMetaMaskWalletCreateConnector.mockReturnValue({
      connector: { id: 'walletConnect-fallback' },
    });
    mockMetaMaskWallet.mockImplementation(() => ({
      id: 'metaMask',
      name: 'MetaMask',
      iconUrl: 'metamask-icon',
      iconBackground: '#fff',
      createConnector: mockMetaMaskWalletCreateConnector,
    }));
    mockMetaMaskConnector.mockImplementation((options: unknown) => ({
      id: 'metaMask-injected',
      options,
    }));
    mockSyncPublicPageHead.mockReset();
    mockReadColdLoadOnboardingState.mockReturnValue({
      firstVisit: true,
      shouldStartOnboarding: false,
    });
    mockAppDependencies();
  });

  afterEach(() => {
    cleanup();
  });

  it('disables wagmi autoConnect after explicit disconnect flag is set', () => {
    localStorage.setItem('ce:userDisconnected', 'true');

    loadAppModule();

    expect(mockCreateClient).toHaveBeenCalledWith(expect.objectContaining({ autoConnect: false }));
  });

  it('keeps wagmi autoConnect enabled when disconnect flag is absent', () => {
    loadAppModule();

    expect(mockCreateClient).toHaveBeenCalledWith(expect.objectContaining({ autoConnect: true }));
  });

  it('passes the configured websocket provider through without enabling WalletConnect by default', () => {
    loadAppModule();

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        webSocketProvider: { kind: 'configured-websocket-provider' },
      }),
    );
    expect(mockMetaMaskWalletCreateConnector).not.toHaveBeenCalled();
  });

  it('uses an injected-only MetaMask connector by default to avoid WalletConnect bridge startup', () => {
    loadAppModule();

    const connectorCalls = mockConnectorsForWallets.mock.calls as unknown as Array<[WalletGroup[]]>;
    const walletGroups = connectorCalls[0]?.[0] ?? [];
    const wallet = walletGroups[0]?.wallets?.[0];
    if (!wallet) throw new Error('Expected injected MetaMask wallet in connectorsForWallets call.');
    const connectorConfig = wallet.createConnector();

    expect(mockMetaMaskWallet).toHaveBeenCalledWith(
      expect.objectContaining({ chains: expect.any(Array), shimDisconnect: true }),
    );
    expect(mockMetaMaskWalletCreateConnector).not.toHaveBeenCalled();
    expect(mockMetaMaskConnector).toHaveBeenCalledWith(
      expect.objectContaining({
        chains: expect.any(Array),
        options: { shimDisconnect: true },
      }),
    );
    expect(connectorConfig.connector).toEqual(expect.objectContaining({ id: 'metaMask-injected' }));
  });

  it('preserves RainbowKit MetaMask WalletConnect fallback when explicitly enabled', () => {
    mockWalletConnectFallbackEnabled = true;

    loadAppModule();

    const connectorCalls = mockConnectorsForWallets.mock.calls as unknown as Array<[WalletGroup[]]>;
    const walletGroups = connectorCalls[0]?.[0] ?? [];
    const wallet = walletGroups[0]?.wallets?.[0];
    if (!wallet) throw new Error('Expected MetaMask wallet fallback in connectorsForWallets call.');
    const connectorConfig = wallet.createConnector();

    expect(mockMetaMaskWalletCreateConnector).toHaveBeenCalledTimes(1);
    expect(mockMetaMaskConnector).not.toHaveBeenCalled();
    expect(connectorConfig.connector).toEqual({ id: 'walletConnect-fallback' });
  });

  it('wraps wagmi JSON-RPC providers with RPC rate-limit backoff metadata', () => {
    loadAppModule();

    const providerFactories = mockConfigureChains.mock.calls[0]?.[1] as Array<(chain: any) => any>;
    const chain = { id: 11155420, chainId: 11155420, name: 'OP Sepolia' };
    const primaryConfig = providerFactories[0](chain);
    const fallbackConfig = providerFactories[1](chain);

    primaryConfig.provider();
    fallbackConfig.provider();

    expect(mockWrapEthersJsonRpcSend).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ rpcUrl: 'https://primary.example' }),
      expect.objectContaining({
        chainId: 11155420,
        providerKey: 'wagmi-primary',
        url: 'https://primary.example',
      }),
    );
    expect(mockWrapEthersJsonRpcSend).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ rpcUrl: 'https://fallback.example' }),
      expect.objectContaining({
        chainId: 11155420,
        providerKey: 'wagmi-fallback',
        url: 'https://fallback.example',
      }),
    );
  });

  it('passes firstVisit to AppShell during the initial render', () => {
    const { default: App } = loadAppModule();

    render(<App params={{}} location={{ search: '', pathname: '/' }} navigate={jest.fn()} />);

    const mainSiteElement = routeProps[0].element;
    expect(mainSiteElement.props.firstVisit).toBe(true);
  });

  it('passes the shared toast theme to the app toast host', () => {
    const { toastTheme } = require('../utilities/ui/toastTheme.js');
    const { default: App } = loadAppModule();

    render(<App params={{}} location={{ search: '', pathname: '/' }} navigate={jest.fn()} />);

    expect(mockToaster).toHaveBeenCalled();
    expect(mockToaster.mock.calls[0]?.[0] as any).toEqual(
      expect.objectContaining({
        position: 'bottom-right',
        toastOptions: {
          style: toastTheme,
        },
      }),
    );
  });

  it('syncs the public page head on mount', () => {
    const { default: App } = loadAppModule();
    window.history.replaceState({}, '', '/session/demo?tab=overview');

    render(<App params={{}} location={{ search: '?tab=overview', pathname: '/session/demo' }} navigate={jest.fn()} />);

    expect(mockSyncPublicPageHead).toHaveBeenCalledTimes(1);
    expect(mockSyncPublicPageHead).toHaveBeenCalledWith();
  });

  it('re-syncs the public page head when the route changes', () => {
    const { default: App } = loadAppModule();
    const navigate = jest.fn();
    const { rerender } = render(<App params={{}} location={{ search: '', pathname: '/' }} navigate={navigate} />);

    expect(mockSyncPublicPageHead).toHaveBeenCalledTimes(1);
    act(() => {
      window.history.replaceState({}, '', '/session/demo?view=results');
    });

    rerender(<App params={{}} location={{ search: '?view=results', pathname: '/session/demo' }} navigate={navigate} />);

    expect(mockSyncPublicPageHead).toHaveBeenCalledTimes(2);
    expect(mockSyncPublicPageHead).toHaveBeenLastCalledWith();
  });

  it('re-syncs the public page head after history.replaceState canonicalizes the URL', () => {
    const { default: App } = loadAppModule();

    render(<App params={{}} location={{ search: '', pathname: '/' }} navigate={jest.fn()} />);

    expect(mockSyncPublicPageHead).toHaveBeenCalledTimes(1);

    act(() => {
      window.history.replaceState({}, '', '/session/edge?session=edge');
    });

    expect(mockSyncPublicPageHead).toHaveBeenCalledTimes(2);
    expect(mockSyncPublicPageHead).toHaveBeenLastCalledWith();
  });

  it('re-renders AppShell with the browser path after direct history.replaceState updates', () => {
    const { default: App } = loadAppModule();

    render(<App params={{}} location={{ search: '', pathname: '/' }} navigate={jest.fn()} />);

    expect(routeProps[routeProps.length - 1].element.props.path).toBe('/');

    act(() => {
      window.history.replaceState({}, '', '/session/demo?view=results');
    });

    expect(routeProps[routeProps.length - 1].element.props.path).toBe('/session/demo');
  });

  it('reuses the cold-load onboarding snapshot on mount', () => {
    window.history.replaceState({}, '', '/session/demo');
    mockReadColdLoadOnboardingState.mockReturnValue({
      firstVisit: true,
      shouldStartOnboarding: true,
    });

    const { default: App } = loadAppModule();

    render(<App params={{}} location={{ search: '', pathname: '/' }} navigate={jest.fn()} />);

    expect(mockReadColdLoadOnboardingState).toHaveBeenCalledTimes(1);
    expect(mockReadColdLoadOnboardingState).toHaveBeenCalledWith(window.localStorage, '/session/demo');
    expect(mockStoreDispatch).toHaveBeenCalledWith({
      type: 'SET_ONBOARDING_STEP',
      payload: 1,
    });
  });

  it('falls back to sessionStorage when the localStorage onboarding read fails', () => {
    mockReadColdLoadOnboardingState.mockImplementation((storage?: Storage) => {
      if (storage === window.localStorage) {
        throw new Error('localStorage unavailable');
      }
      if (storage === window.sessionStorage) {
        return {
          firstVisit: true,
          shouldStartOnboarding: false,
        };
      }
      return {
        firstVisit: false,
        shouldStartOnboarding: false,
      };
    });

    const { default: App } = loadAppModule();

    render(<App params={{}} location={{ search: '', pathname: '/' }} navigate={jest.fn()} />);

    expect(mockReadColdLoadOnboardingState).toHaveBeenNthCalledWith(1, window.localStorage, '/');
    expect(mockReadColdLoadOnboardingState).toHaveBeenNthCalledWith(2, window.sessionStorage, '/');
    expect(routeProps[0].element.props.firstVisit).toBe(true);
  });

  it('suppresses first-visit redirects when both storage onboarding reads fail', () => {
    mockReadColdLoadOnboardingState.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const { default: App } = loadAppModule();

    render(<App params={{}} location={{ search: '', pathname: '/' }} navigate={jest.fn()} />);

    expect(mockReadColdLoadOnboardingState).toHaveBeenCalledTimes(2);
    expect(routeProps[0].element.props.firstVisit).toBe(false);
    expect(mockStoreDispatch).not.toHaveBeenCalled();
  });

  it('mounts App when localStorage getter throws', () => {
    const localStorageGetterSpy = jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    try {
      const { default: App } = loadAppModule();
      expect(() =>
        render(<App params={{}} location={{ search: '', pathname: '/' }} navigate={jest.fn()} />),
      ).not.toThrow();
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
      const mainSiteElement = routeProps[0].element;
      expect(mainSiteElement.props.firstVisit).toBe(true);
    } finally {
      localStorageGetterSpy.mockRestore();
    }
  });
});
