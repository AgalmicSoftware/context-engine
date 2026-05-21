/** @file App.tsx */
import React from "react";
import { Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux';
import store from '../store.js';
import { CE_ENABLE_WALLETCONNECT_FALLBACK, SERVER } from '../variables/appConfig.js';
import { installCeAgent } from '../utilities/ceAgent.js';
import { createLogger } from '../utilities/logging';
import { syncPublicPageHead } from '../utilities/ui/publicPageHead.js';
import CEToaster from './Shared/CEToaster';

import "assets/css/contextEngine.scss";

import withRouter from "./HooksHOC/withRouterBridge";
import MainSite from "./MainSite/MainSite";
import AppErrorBoundary from './ErrorBoundary/AppErrorBoundary';
import { readColdLoadOnboardingState } from './Onboarding/onboardingConfig.js';
import { toastTheme } from '../utilities/ui/toastTheme.js';

import '@rainbow-me/rainbowkit/styles.css';

import {
  connectorsForWallets,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import type { Wallet } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { configureChains, createClient, createStorage, WagmiConfig } from 'wagmi';
import { noopStorage } from '@wagmi/core';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { goerli, localhost } from 'wagmi/chains';
import {
  mainnet,
  base,
  optimism,
  arbitrum,
  baseSepolia,
  optimismSepolia,
  arbitrumSepolia,
} from '../variables/chains.js'
import {
  getFallbackRpcUrlForChain,
  getPrimaryRpcUrlForChain,
} from '../utilities/web3/rpcSelection.js';
import { wrapEthersJsonRpcSend } from '../utilities/web3/rpcReadCache.js';
import { wasUserExplicitlyDisconnected } from '../utilities/web3/wagmiDisconnectState.js';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';

const log = createLogger('general');

type RouterLocationLike = {
  pathname?: string;
  search?: string;
};

type AppProps = {
  location?: RouterLocationLike;
  navigate?: unknown;
  params?: Record<string, string | undefined>;
};

type AppState = {
  serverEndpoint: string;
  matchesAddress: string;
  urlExtension?: string;
};

type ColdLoadSnapshot = {
  firstVisit: boolean;
  shouldStartOnboarding: boolean;
};

const buildBackoffJsonRpcProvider = (
  providerKey: string,
  resolveUrl: (chain: any) => string,
): any => {
  const baseProvider: any = jsonRpcProvider({
    rpc: (chain: any) => {
      const url = resolveUrl(chain);
      return url ? { http: url } : null;
    },
  });

  return (chain: any): any => {
    const config = typeof baseProvider === 'function' ? baseProvider(chain) : null;
    if (!config || typeof config.provider !== 'function') return config;
    const selectedUrl = (
      config?.chain?.rpcUrls?.default?.http?.[0]
      || config?.chain?.rpcUrls?.public?.http?.[0]
      || resolveUrl(chain)
      || ''
    );
    return {
      ...config,
      provider: (): any => wrapEthersJsonRpcSend(config.provider() as any, {
        chainId: Number(chain?.id || config?.chain?.id || 0) || 0,
        providerKey,
        providerLabel: providerKey,
        url: selectedUrl,
      }) as any,
    };
  };
};

const { chains, provider, webSocketProvider } = configureChains(
  [
    mainnet,
    base,
    optimism,
    arbitrum,
    baseSepolia,
    optimismSepolia,
    arbitrumSepolia,
    goerli,
    localhost,
  ],
  [
    // NOTE: `publicProvider()` is intentionally not used here.
    // We keep deterministic ordering by resolving primary/fallback RPC URLs ourselves
    // (from chains.js + chain rpcUrls public/default lists) via jsonRpcProvider.
    buildBackoffJsonRpcProvider('wagmi-primary', getPrimaryRpcUrlForChain),
    buildBackoffJsonRpcProvider('wagmi-fallback', getFallbackRpcUrlForChain),
  ]
);

const buildMetaMaskWallet = (): Wallet => {
  const wallet = metaMaskWallet({ chains, shimDisconnect: true });
  if (CE_ENABLE_WALLETCONNECT_FALLBACK) return wallet;

  return {
    ...wallet,
    createConnector: () => ({
      connector: new MetaMaskConnector({
        chains,
        options: { shimDisconnect: true },
      }),
    }),
  };
};

const connectors = connectorsForWallets([
  {
    groupName: "Recommended",
    wallets: [
              buildMetaMaskWallet(),
    ],
  },]);

const userExplicitlyDisconnected = wasUserExplicitlyDisconnected();
const safeStorage = (() => {
  try {
    return window.localStorage;
  } catch (_) {
    return noopStorage;
  }
})();

const wagmiClient = createClient({
  autoConnect: !userExplicitlyDisconnected,
  storage: createStorage({ storage: safeStorage }),
  connectors,
  provider,
  webSocketProvider
})

let socket: unknown;
let firstVisit = false;
let _coldLoadSnapshot: ColdLoadSnapshot | null = null;
const APP_HISTORY_SYNC_EVENT = 'ce:app-history-sync';
let historySyncListenerCount = 0;
let restoreHistorySyncBridge: (() => void) | null = null;
let patchedPushState: History['pushState'] | null = null;
let patchedReplaceState: History['replaceState'] | null = null;

const dispatchAppHistorySync = () => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new window.Event(APP_HISTORY_SYNC_EVENT));
};

const ensureHistorySyncBridge = () => {
  if (typeof window === 'undefined' || !window.history || restoreHistorySyncBridge) return;

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  patchedPushState = function patchedPushStateWrapper(
    this: History,
    ...args: Parameters<History['pushState']>
  ) {
    const result = originalPushState.apply(this, args);
    dispatchAppHistorySync();
    return result;
  };

  patchedReplaceState = function patchedReplaceStateWrapper(
    this: History,
    ...args: Parameters<History['replaceState']>
  ) {
    const result = originalReplaceState.apply(this, args);
    dispatchAppHistorySync();
    return result;
  };

  window.history.pushState = patchedPushState;
  window.history.replaceState = patchedReplaceState;
  restoreHistorySyncBridge = () => {
    if (window.history.pushState === patchedPushState) {
      window.history.pushState = originalPushState;
    }
    if (window.history.replaceState === patchedReplaceState) {
      window.history.replaceState = originalReplaceState;
    }
    patchedPushState = null;
    patchedReplaceState = null;
    restoreHistorySyncBridge = null;
  };
};

const subscribeToHistorySync = (onChange: () => void) => {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }

  ensureHistorySyncBridge();

  const listener = () => {
    try {
      onChange();
    } catch (e) {
      log.warn('App: fallback', e);
    }
  };

  historySyncListenerCount += 1;
  window.addEventListener(APP_HISTORY_SYNC_EVENT, listener);
  window.addEventListener('popstate', listener);

  return () => {
    window.removeEventListener(APP_HISTORY_SYNC_EVENT, listener);
    window.removeEventListener('popstate', listener);
    historySyncListenerCount = Math.max(0, historySyncListenerCount - 1);
    if (historySyncListenerCount === 0) {
      try {
        restoreHistorySyncBridge?.();
      } catch (e) {
        log.warn('App: cleanup', e);
      }
    }
  };
};

const getColdLoadOnboardingPathname = () => {
  try {
    return window.location?.pathname || '';
  } catch (_) {
    return '';
  }
};

try {
  _coldLoadSnapshot = readColdLoadOnboardingState(window.localStorage, getColdLoadOnboardingPathname());
  firstVisit = _coldLoadSnapshot.firstVisit;
} catch (_) {
  try {
    _coldLoadSnapshot = readColdLoadOnboardingState(window.sessionStorage, getColdLoadOnboardingPathname());
    firstVisit = _coldLoadSnapshot.firstVisit;
  } catch (__) {
    firstVisit = false;
    _coldLoadSnapshot = { firstVisit: false, shouldStartOnboarding: false };
  }
}

class App extends React.Component<AppProps, AppState> {
  state: AppState = {
    serverEndpoint: SERVER,
    matchesAddress: "",
  };

  _lastSyncedRouteHeadKey: string | null = null;
  unsubscribeHistorySync: (() => void) | null = null;

  readRouteHeadKey = () => {
    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.pathname || ''}${window.location.search || ''}`;
    }
    return `${this.props.location?.pathname || ''}${this.props.location?.search || ''}`;
  };

  syncRouteHead = () => {
    try {
      const nextKey = this.readRouteHeadKey();
      if (nextKey === this._lastSyncedRouteHeadKey) return;
      syncPublicPageHead();
      this._lastSyncedRouteHeadKey = nextKey;
    } catch (e) {
      log.warn('App: fallback', e);
    }
  };

  didBrowserRouteChangeSinceRender = () => {
    if (typeof window === 'undefined' || !window.location) return false;
    const browserKey = `${window.location.pathname || ''}${window.location.search || ''}`;
    const propsKey = `${this.props.location?.pathname || ''}${this.props.location?.search || ''}`;
    return browserKey !== propsKey;
  };

  componentDidMount() {
    document.body.classList.add("index-page");

    if (_coldLoadSnapshot?.shouldStartOnboarding) {
      store.dispatch({ type: 'SET_ONBOARDING_STEP', payload: 1 });
    }

    // Dev/E2E-only agent interface (gated; no-op unless enabled).
    try { installCeAgent(); } catch (e) { log.warn('App: fallback', e); }
    // React Router updates do not cover direct history.replaceState/pushState calls,
    // so bridge the History API back into the same head-sync path.
    this.unsubscribeHistorySync = subscribeToHistorySync(() => {
      this.forceUpdate();
      this.syncRouteHead();
    });
    if (this.didBrowserRouteChangeSinceRender()) {
      this.forceUpdate();
    }
    this.syncRouteHead();

  }

  componentDidUpdate(prevProps: AppProps) {
    if (
      prevProps.location?.pathname !== this.props.location?.pathname ||
      prevProps.location?.search !== this.props.location?.search
    ) {
      this.syncRouteHead();
    }
  }

  componentWillUnmount() {
    try {
      this.unsubscribeHistorySync?.();
    } catch (e) {
      log.warn('App: cleanup', e);
    }
    document.body.classList.remove("index-page");
  }

  render() {
    const location = (
      typeof window !== 'undefined' && window.location
        ? {
          pathname: window.location.pathname || this.props.location?.pathname || '',
          search: window.location.search || this.props.location?.search || '',
        }
        : (this.props.location || { pathname: '', search: '' })
    );

    const search = location.search || ''
    const nftCode = search.substring(search.indexOf("=") + 1);
    const urlPath = (location.pathname || '').toString()
    const viewAddress = urlPath.split('/u/')[1];
    const siteProps = {
      nftCode,
      urlPath,
      firstVisit,
      socket,
      matchesContractAddress: this.state.matchesAddress,
      urlExtension: this.state.urlExtension,
      viewAddress,
    };

    return (
        <WagmiConfig client={wagmiClient}>
          <RainbowKitProvider chains={chains}>
            <Provider store={store}>
            <AppErrorBoundary>
            <CEToaster
              position='bottom-right'
              toastOptions={{ style: toastTheme }}
            />
            <Routes>
              <Route path="*" element={<MainSite path={urlPath} {...siteProps} />} />
            </Routes>
            </AppErrorBoundary>
            </Provider>
          </RainbowKitProvider>
        </WagmiConfig>
    );
  }
}

export default withRouter(App);
