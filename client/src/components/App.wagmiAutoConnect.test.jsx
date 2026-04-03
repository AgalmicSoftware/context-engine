import React from 'react';
import { cleanup, render } from '@testing-library/react';

const mockCreateClient = jest.fn(() => ({}));
const mockReadColdLoadOnboardingState = jest.fn(() => ({
  firstVisit: true,
  shouldStartOnboarding: false,
}));
const mockStoreDispatch = jest.fn();
const mockToaster = jest.fn(() => null);
let routeProps = [];

const MockRoute = (props) => {
  routeProps.push(props);
  return null;
};

const mockAppDependencies = () => {
  jest.doMock('react-redux', () => ({
    Provider: ({ children }) => children,
  }));

  jest.doMock('react-router-dom', () => ({
    BrowserRouter: ({ children }) => children,
    Routes: ({ children }) => children,
    Route: MockRoute,
    Link: () => null,
  }));

  jest.doMock('reactstrap', () => ({
    Container: ({ children }) => children,
    Row: ({ children }) => children,
    Col: ({ children }) => children,
  }));

  jest.doMock('@rainbow-me/rainbowkit/styles.css', () => ({}));
  jest.doMock('react-hot-toast', () => ({
    Toaster: (props) => {
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
  jest.doMock('../variables/appConfig.js', () => ({ SERVER: 'http://localhost' }));
  jest.doMock('../utilities/ceAgent.js', () => ({ installCeAgent: jest.fn() }));
  jest.doMock('../utilities/logging', () => ({
    createLogger: () => ({
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }),
  }));

  jest.doMock('./HooksHOC/withRouterBridge.jsx', () => ({
    __esModule: true,
    default: (Comp) => Comp,
  }));
  jest.doMock('./MainSite/MainSite.jsx', () => ({
    __esModule: true,
    default: () => null,
  }));
  jest.doMock('./Onboarding/onboardingConfig.js', () => ({
    readColdLoadOnboardingState: mockReadColdLoadOnboardingState,
  }));

  jest.doMock('@rainbow-me/rainbowkit', () => ({
    getDefaultWallets: jest.fn(),
    connectorsForWallets: jest.fn(() => []),
    RainbowKitProvider: ({ children }) => children,
  }));
  jest.doMock('@rainbow-me/rainbowkit/wallets', () => ({
    rainbowWallet: jest.fn(() => ({})),
    metaMaskWallet: jest.fn(() => ({})),
    coinbaseWallet: jest.fn(() => ({})),
  }));

  jest.doMock('wagmi', () => ({
    configureChains: jest.fn(() => ({
      chains: [{ id: 84532, chainId: 84532, name: 'Base Sepolia' }],
      provider: {},
      webSocketProvider: {},
    })),
    createClient: mockCreateClient,
    createStorage: jest.fn(({ storage }) => ({ storage })),
    WagmiConfig: ({ children }) => children,
  }));
  jest.doMock('@wagmi/core', () => ({
    noopStorage: {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
  }));
  jest.doMock('wagmi/chains', () => ({
    goerli: { id: 5, chainId: 5, name: 'Goerli' },
    localhost: { id: 31337, chainId: 31337, name: 'Localhost' },
  }));
  jest.doMock('wagmi/connectors/injected', () => ({
    InjectedConnector: jest.fn(),
  }));
  jest.doMock('wagmi/providers/jsonRpc', () => ({
    jsonRpcProvider: jest.fn(() => ({})),
  }));

  jest.doMock('../utilities/web3/appRpcSelection.js', () => ({
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

const loadAppModule = () => {
  let appModule;
  jest.isolateModules(() => {
    appModule = require('./App.jsx');
  });
  return appModule;
};

describe('App wagmi auto-connect persistence', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    routeProps = [];
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

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({ autoConnect: false })
    );
  });

  it('keeps wagmi autoConnect enabled when disconnect flag is absent', () => {
    loadAppModule();

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({ autoConnect: true })
    );
  });

  it('passes firstVisit to MainSite during the initial render', () => {
    const { default: App } = loadAppModule();

    render(
      <App
        params={{}}
        location={{ search: '', pathname: '/' }}
        navigate={jest.fn()}
      />
    );

    const mainSiteElement = routeProps[0].element;
    expect(mainSiteElement.props.firstVisit).toBe(true);
  });

  it('passes the shared toast theme to the app toaster', () => {
    const { toastTheme } = require('../utilities/ui/toastTheme.js');
    const { default: App } = loadAppModule();

    render(
      <App
        params={{}}
        location={{ search: '', pathname: '/' }}
        navigate={jest.fn()}
      />
    );

    expect(mockToaster).toHaveBeenCalled();
    expect(mockToaster.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        position: 'bottom-right',
        toastOptions: {
          style: toastTheme,
        },
      })
    );
  });

  it('reuses the cold-load onboarding snapshot on mount', () => {
    mockReadColdLoadOnboardingState.mockReturnValue({
      firstVisit: true,
      shouldStartOnboarding: true,
    });

    const { default: App } = loadAppModule();

    render(
      <App
        params={{}}
        location={{ search: '', pathname: '/' }}
        navigate={jest.fn()}
      />
    );

    expect(mockReadColdLoadOnboardingState).toHaveBeenCalledTimes(1);
    expect(mockStoreDispatch).toHaveBeenCalledWith({
      type: 'SET_ONBOARDING_STEP',
      payload: 1,
    });
  });

  it('falls back to sessionStorage when the localStorage onboarding read fails', () => {
    mockReadColdLoadOnboardingState.mockImplementation((storage) => {
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

    render(
      <App
        params={{}}
        location={{ search: '', pathname: '/' }}
        navigate={jest.fn()}
      />
    );

    expect(mockReadColdLoadOnboardingState).toHaveBeenNthCalledWith(1, window.localStorage);
    expect(mockReadColdLoadOnboardingState).toHaveBeenNthCalledWith(2, window.sessionStorage);
    expect(routeProps[0].element.props.firstVisit).toBe(true);
  });

  it('suppresses first-visit redirects when both storage onboarding reads fail', () => {
    mockReadColdLoadOnboardingState.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const { default: App } = loadAppModule();

    render(
      <App
        params={{}}
        location={{ search: '', pathname: '/' }}
        navigate={jest.fn()}
      />
    );

    expect(mockReadColdLoadOnboardingState).toHaveBeenCalledTimes(2);
    expect(routeProps[0].element.props.firstVisit).toBe(false);
    expect(mockStoreDispatch).not.toHaveBeenCalled();
  });

  it('mounts App when localStorage getter throws', () => {
    const localStorageGetterSpy = jest
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

    try {
      const { default: App } = loadAppModule();
      expect(() =>
        render(
          <App
            params={{}}
            location={{ search: '', pathname: '/' }}
            navigate={jest.fn()}
          />
        )
      ).not.toThrow();
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
      const mainSiteElement = routeProps[0].element;
      expect(mainSiteElement.props.firstVisit).toBe(true);
    } finally {
      localStorageGetterSpy.mockRestore();
    }
  });
});
