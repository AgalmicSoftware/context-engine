/** @file withWagmiBridge.tsx */
import React, { useEffect, useRef } from 'react';

import { useAccount, useBalance, useBlockNumber, useNetwork, useProvider, useDisconnect } from 'wagmi';
import { useConnectModal, useAccountModal, useChainModal } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from '../../variables/chains.js';
import { getSessionNetwork } from '../../utilities/web3/chainGateway.js';
import { clearUserExplicitlyDisconnected } from '../../utilities/web3/wagmiDisconnectState.js';
import { createLogger } from 'utilities/logging.js';

export interface WagmiInjectedProps {
  wagmiProvider: ReturnType<typeof useProvider>;
  wagmiWsProvider: ReturnType<typeof useProvider>;
  wagmiNetwork: ReturnType<typeof useNetwork>['chain'];
  network: ReturnType<typeof useNetwork>['chain'] | typeof base | typeof baseSepolia | undefined;
  wagmiChainOptions: ReturnType<typeof useNetwork>['chains'];
  wagmiAddress: ReturnType<typeof useAccount>['address'];
  wagmiBalance: ReturnType<typeof useBalance>;
  wagmiBlocknumber: ReturnType<typeof useBlockNumber>['data'];
  wagmiDisconnect: ReturnType<typeof useDisconnect>['disconnect'];
  openConnectModal: ReturnType<typeof useConnectModal>['openConnectModal'];
  openAccountModal: ReturnType<typeof useAccountModal>['openAccountModal'];
  openChainModal: ReturnType<typeof useChainModal>['openChainModal'];
  examplePropFunc: (args: unknown) => void;
  urlExtension?: string;
}

type WagmiManagedPropKeys = Exclude<keyof WagmiInjectedProps, 'urlExtension'>;

type WagmiBridgeRuntimeProps = {
  __ceRequireWagmiBlockNumber?: boolean;
  activeSessionSlug?: string;
  changeAccount?: (payload: Record<string, unknown>) => void;
  updateLoginInfo?: (payload: Record<string, unknown>) => void;
  provider?: string | null;
  account?: string;
  loginComplete?: boolean;
};

const accountLog = createLogger('account');

declare global {
  interface Window {
    __wagmiReduxBridgeOwner?: string;
  }
}

export function WagmiHooksHOC<P extends object>(Component: React.ComponentType<P>) {
  return function WrappedComponent(props: Omit<P, WagmiManagedPropKeys> & WagmiBridgeRuntimeProps) {
    // wagmi hooks
    const { address, isConnecting, isDisconnected } = useAccount({
      onConnect({ address }: { address?: string }) {
        accountLog.log('Connected – address: ' + address);
      },
      onDisconnect() {
        accountLog.log('Wallet Disconnected');
      },
    });
    const { disconnect } = useDisconnect();

    const balance = useBalance({
      address: address,
    });

    const componentName = String(Component?.displayName || Component?.name || '');
    const needsBlockNumber =
      componentName === 'AppShell' ||
      componentName === 'AppShellWithWagmiHooks' ||
      componentName === 'MainSite' ||
      componentName === 'MainSiteWithWagmiHooks' ||
      props.__ceRequireWagmiBlockNumber === true;
    // Only components that consume the value should subscribe/fetch.
    const { data: blockNumber } = useBlockNumber({
      watch: false,
      cacheTime: 30_000,
      enabled: needsBlockNumber,
    });
    const { chain, chains } = useNetwork();

    // Derive desired chain from activeSessionSlug; fall back gently if absent
    const activeSlug = props.activeSessionSlug || '';
    const groupResolvedNetwork = getSessionNetwork(activeSlug);
    const desiredChainId = groupResolvedNetwork?.id;

    const provider = useProvider({ chainId: desiredChainId });
    // Avoid a second websocket hook subscription here; it is unused in consumers and can
    // trigger noisy updates during unmount/navigation in dev.
    const wsProvider = provider;

    // Resolve a usable chain object
    const configuredChains = chains ?? [];
    const fallbackChains = [base, baseSepolia].filter(Boolean);
    const knownChains = [...configuredChains, ...fallbackChains];

    // Prioritize group-derived network; then wallet network; then fallback list head
    const currentNetwork = (groupResolvedNetwork as WagmiInjectedProps['network']) ?? chain ?? knownChains[0];

    // Removed: local JsonRpcProvider + window.defaultProvider anti-pattern.
    // Downstream components should use the centralized, group-aware read provider
    // from the chain gateway (getReadProviderForGroup).

    const { openConnectModal } = useConnectModal();
    const { openAccountModal } = useAccountModal();
    const { openChainModal } = useChainModal();

    const examplePropFunc = (args: unknown) => {
      accountLog.log('Footer-HooksHOC – callback working: ' + args);
    };

    // --- NEW: ensure only ONE Wagmi->Redux bridge instance runs (HOC wraps multiple components) ---
    const bridgeIdRef = useRef(Math.random().toString(36).slice(2));
    const bridgeOwnerRef = useRef(false);
    const mountedRef = useRef(false);
    const syncBridgeOwnership = () => {
      const currentBridgeId = bridgeIdRef.current;
      try {
        if (typeof window === 'undefined') return false;
        // Regression guard: whichever bridge sees the owner slot empty next
        // must be able to reclaim it after the previous owner unmounts.
        if (!window.__wagmiReduxBridgeOwner) {
          window.__wagmiReduxBridgeOwner = currentBridgeId;
        }
        bridgeOwnerRef.current = window.__wagmiReduxBridgeOwner === currentBridgeId;
      } catch (e) {
        accountLog.warn('WagmiHooksHOC: fallback', e);
      }
      return bridgeOwnerRef.current;
    };
    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);
    useEffect(() => {
      const currentBridgeId = bridgeIdRef.current;
      syncBridgeOwnership();
      return () => {
        try {
          if (typeof window !== 'undefined' && window.__wagmiReduxBridgeOwner === currentBridgeId) {
            delete window.__wagmiReduxBridgeOwner;
          }
        } catch (e) {
          accountLog.warn('WagmiHooksHOC: fallback', e);
        }
      };
    }, []);

    // --- NEW: Redux hydration bridge for wagmi autoConnect / disconnect ---
    // Keeps Redux session + profile in sync with wagmi so UI shows logged-in state after refresh.
    const lastHydratedRef = useRef<{ key: string | null }>({ key: null });
    const prevAddressRef = useRef(address);
    useEffect(() => {
      const wasAddressConnected = Boolean(prevAddressRef.current);
      try {
        if (!mountedRef.current) return;
        if (address && !wasAddressConnected) {
          clearUserExplicitlyDisconnected();
        }
        syncBridgeOwnership();
        // Only one HOC instance owns the bridge
        if (!bridgeOwnerRef.current) return;

        const changeAccount = props.changeAccount;
        const updateLoginInfo = props.updateLoginInfo;

        if (typeof changeAccount !== 'function' || typeof updateLoginInfo !== 'function') return;

        const addrLower = (address || '').toLowerCase();
        const reduxAddrLower = (props.account || '').toLowerCase();
        const chainId = chain?.id || currentNetwork?.id || null;

        const tripleKey = `${addrLower}|${chainId == null ? 'null' : chainId}`;
        const prevKey = lastHydratedRef.current.key;

        // CONNECT / REHYDRATE
        if (address) {
          const acctMatches = reduxAddrLower === addrLower;
          const alreadyWagmi = props.provider === 'wagmi' && props.loginComplete === true;

          // If we're already in wagmi and only network/balance changed, keep it idempotent.
          if (alreadyWagmi && acctMatches && prevKey === tripleKey) {
            return;
          }

          if (!alreadyWagmi || !acctMatches) {
            if (!mountedRef.current) return;
            // First time (or account mismatch): run the 3-step sequence
            updateLoginInfo({
              loginInProgress: true,
              loginComplete: false,
              provider: 'wagmi',
            });

            changeAccount({
              account: address,
              provider: 'wagmi',
              network: chain || currentNetwork,
            });

            updateLoginInfo({
              loginInProgress: false,
              loginComplete: true,
              provider: 'wagmi',
            });
          } else {
            if (!mountedRef.current) return;
            // Already wagmi + same account: refresh network/balance only (no login flags)
            changeAccount({
              account: address,
              provider: 'wagmi',
              network: chain || currentNetwork,
            });
          }

          lastHydratedRef.current.key = tripleKey;
          return;
        }

        // DISCONNECT
        if (!address) {
          if (props.provider === 'wagmi' && (props.account || props.loginComplete)) {
            if (!mountedRef.current) return;
            // Only clear if Redux currently reflects wagmi (avoid clobbering Web3Auth)
            updateLoginInfo({
              loginInProgress: false,
              loginComplete: false,
              provider: null,
            });
            changeAccount({});
            lastHydratedRef.current.key = `|${chainId == null ? 'null' : chainId}`;
          }
        }
      } catch (e) {
        accountLog.error('WagmiHooksHOC auth bridge error:', e);
      } finally {
        prevAddressRef.current = address;
      }
      // Track the wallet chain separately because currentNetwork can stay pinned to the session.
    }, [
      address,
      chain,
      currentNetwork,
      props.changeAccount,
      props.updateLoginInfo,
      props.provider,
      props.account,
      props.loginComplete,
    ]);

    const injectedProps = {
      wagmiProvider: provider,
      wagmiWsProvider: wsProvider,
      wagmiNetwork: chain,
      network: currentNetwork,
      wagmiChainOptions: chains,
      wagmiAddress: address,
      wagmiBalance: balance,
      wagmiBlocknumber: blockNumber,
      wagmiDisconnect: disconnect,
      openConnectModal,
      openAccountModal,
      openChainModal,
      examplePropFunc,
      urlExtension: (props as { urlExtension?: unknown }).urlExtension as string | undefined,
    } satisfies WagmiInjectedProps;

    const componentProps = { ...props, ...injectedProps } as P;

    return <Component {...componentProps} />;
  };
}

export default WagmiHooksHOC;
