/** @file App.jsx */
import React from "react";
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import store from '../store.js';
import { SERVER } from '../variables/appConfig.js';
import { installCeAgent } from '../utilities/ceAgent.js';
import { createLogger } from '../utilities/logging';

import "assets/css/contextEngine.scss";

import { Container, Row, Col } from "reactstrap";

import withRouter from "./HooksHOC/withRouterBridge.jsx";
import MainSite from "./MainSite/MainSite.jsx";
import AppErrorBoundary from './ErrorBoundary/AppErrorBoundary.jsx';
import { readColdLoadOnboardingState } from './Onboarding/onboardingConfig.js';
import { toastTheme } from '../utilities/ui/toastTheme.js';

import '@rainbow-me/rainbowkit/styles.css';

import {
  getDefaultWallets,
  connectorsForWallets,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import {
  rainbowWallet,
  metaMaskWallet,
  coinbaseWallet } from '@rainbow-me/rainbowkit/wallets';
import { configureChains, createClient, createStorage, WagmiConfig } from 'wagmi';
import { noopStorage } from '@wagmi/core';
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
import { InjectedConnector } from 'wagmi/connectors/injected';
import {
  getFallbackRpcUrlForChain,
  getPrimaryRpcUrlForChain,
} from '../utilities/web3/appRpcSelection.js';
import { wasUserExplicitlyDisconnected } from '../utilities/web3/wagmiDisconnectState.js';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';

const log = createLogger('general');

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
    jsonRpcProvider({
      rpc: (chain) => {
        const url = getPrimaryRpcUrlForChain(chain);
        return url ? { http: url } : null;
      },
    }),
    jsonRpcProvider({
      rpc: (chain) => {
        const url = getFallbackRpcUrlForChain(chain);
        return url ? { http: url } : null;
      },
    }),
  ]
);

const connectors = connectorsForWallets([
  {
    groupName: "Recommended",
    wallets: [
              metaMaskWallet({ chains, shimDisconnect: true }),
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

var socket;
var firstVisit;
var _coldLoadSnapshot;
try {
  _coldLoadSnapshot = readColdLoadOnboardingState(window.localStorage);
  firstVisit = _coldLoadSnapshot.firstVisit;
} catch (_) {
  try {
    _coldLoadSnapshot = readColdLoadOnboardingState(window.sessionStorage);
    firstVisit = _coldLoadSnapshot.firstVisit;
  } catch (__) {
    firstVisit = false;
    _coldLoadSnapshot = { firstVisit: false, shouldStartOnboarding: false };
  }
}

class App extends React.Component {
  state = {
    serverEndpoint: SERVER,
    matchesAddress: "",
  };

  componentDidMount() {
    document.body.classList.add("index-page");
    const { serverEndpoint } = this.state;

    if (_coldLoadSnapshot?.shouldStartOnboarding) {
      store.dispatch({ type: 'SET_ONBOARDING_STEP', payload: 1 });
    }

    // Dev/E2E-only agent interface (gated; no-op unless enabled).
    try { installCeAgent(); } catch (e) { log.warn('App: fallback', e); }

  }

  componentDidUpdate() {
  }

  componentWillUnmount() {
    document.body.classList.remove("index-page");
  }

  render() {
    const params = this.props.params
    const location = this.props.location
    const navigate = this.props.navigate

    const search = location.search
    const nftCode = search.substring(search.indexOf("=") + 1);
    const urlPath = location.pathname.toString()
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
            <Toaster
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
