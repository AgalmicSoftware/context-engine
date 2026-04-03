/** @file withWagmiBridge.jsx */
import React, { useEffect, useRef } from "react";

import { useAccount, useBalance, useBlockNumber, useNetwork, useProvider, useDisconnect } from 'wagmi'
import { useConnectModal, useAccountModal, useChainModal, } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from '../../variables/chains.js';
import { getSessionNetwork } from '../../utilities/web3/contractScripts.js';
import { clearUserExplicitlyDisconnected } from '../../utilities/web3/wagmiDisconnectState.js';
import { createLogger } from 'utilities/logging.js';

const accountLog = createLogger('account');



export function WagmiHooksHOC(Component) {
    return function WrappedComponent(props) {
        // wagmi hooks
        const { address, isConnecting, isDisconnected } = useAccount({
          onConnect({ address, connector, isReconnected }) {
            accountLog.log("Connected – address: " + address)
          },
          onDisconnect() {
            accountLog.log("Wallet Disconnected")
          }
        });
        const { disconnect } = useDisconnect();

        const balance = useBalance({
            address: address,
        })

        const componentName = String(Component?.displayName || Component?.name || '');
        const needsBlockNumber = (
          componentName === 'MainSite' ||
          componentName === 'MainSiteWithWagmiHooks' ||
          props.__ceRequireWagmiBlockNumber === true
        );
        // Only components that consume the value should subscribe/fetch.
        const { data: blockNumber } = useBlockNumber({
          watch: false,
          cacheTime: 30_000,
          enabled: needsBlockNumber,
        });
        const { chain, chains } = useNetwork()

        // Derive desired chain from activeSessionSlug; fall back gently if absent
        const activeSlug = props.activeSessionSlug || '';
        const groupResolvedNetwork = getSessionNetwork(activeSlug);
        const desiredChainId = groupResolvedNetwork?.id;

        const provider = useProvider({ chainId: desiredChainId })
        // Avoid a second websocket hook subscription here; it is unused in consumers and can
        // trigger noisy updates during unmount/navigation in dev.
        const wsProvider = provider;

        // Resolve a usable chain object
        const configuredChains = chains ?? [];
        const fallbackChains = [base, baseSepolia].filter(Boolean);
        const knownChains = [...configuredChains, ...fallbackChains];

        // Prioritize group-derived network; then wallet network; then fallback list head
        const currentNetwork =
          groupResolvedNetwork ?? chain ?? knownChains[0];

        // Removed: local JsonRpcProvider + window.defaultProvider anti-pattern.
        // Downstream components should use the centralized, group-aware read provider
        // from contractScripts.js (getReadProviderForGroup).

        const { openConnectModal } = useConnectModal();
        const { openAccountModal } = useAccountModal();
        const { openChainModal } = useChainModal();

        const examplePropFunc = (args) => {
            accountLog.log("Footer-HooksHOC – callback working: " + args)
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
          } catch (e) { accountLog.warn('WagmiHooksHOC: fallback', e); }
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
            } catch (e) { accountLog.warn('WagmiHooksHOC: fallback', e); }
          };
        }, []);

        // --- NEW: Redux hydration bridge for wagmi autoConnect / disconnect ---
        // Keeps Redux session + profile in sync with wagmi so UI shows logged-in state after refresh.
        const lastHydratedRef = useRef({ key: null });
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

            const canDispatch =
              typeof props.changeAccount === 'function' &&
              typeof props.updateLoginInfo === 'function';

            if (!canDispatch) return;

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
                props.updateLoginInfo({
                  loginInProgress: true,
                  loginComplete: false,
                  provider: 'wagmi',
                });

                props.changeAccount({
                  account: address,
                  provider: 'wagmi',
                  network: chain || currentNetwork,
                });

                props.updateLoginInfo({
                  loginInProgress: false,
                  loginComplete: true,
                  provider: 'wagmi',
                });
              } else {
                if (!mountedRef.current) return;
                // Already wagmi + same account: refresh network/balance only (no login flags)
                props.changeAccount({
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
                props.updateLoginInfo({
                  loginInProgress: false,
                  loginComplete: false,
                  provider: null,
                });
                props.changeAccount({});
                lastHydratedRef.current.key = `|${chainId == null ? 'null' : chainId}`;
              }
            }
          } catch (e) {
            accountLog.error("WagmiHooksHOC auth bridge error:", e);
          } finally {
            prevAddressRef.current = address;
          }
        // Track the wallet chain separately because currentNetwork can stay pinned to the session.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [address, chain?.id, currentNetwork?.id, props.provider, props.account, props.loginComplete]);

        return <Component {...props}
                  wagmiProvider={provider}
                  wagmiWsProvider={wsProvider}
                  wagmiNetwork={chain}
                  network={currentNetwork}
                  wagmiChainOptions={chains}
                  wagmiAddress={address}
                  wagmiBalance={balance}
                  wagmiBlocknumber={blockNumber}
                  wagmiDisconnect={disconnect}
                  openConnectModal={openConnectModal}
                  openAccountModal={openAccountModal}
                  openChainModal={openChainModal}
                  examplePropFunc={examplePropFunc}
                  urlExtension={props.urlExtension}
                />
      }
}

export default WagmiHooksHOC;
