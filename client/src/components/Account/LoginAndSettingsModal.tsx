/** @file LoginAndSettingsModal.tsx */
import React, { Component, Suspense } from "react";
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { ethers } from 'ethers';
import { changeAccount } from '../../actions/accountActions.js';
import type { RootState } from '../../reducers/index.js';
import {
  toggleLoginModal,
  updateLoginInfo,
  changeFocusedTab,
  toggleDemoMode,
  setDemoSurfaceMode,
  toggleTooltips,
  changeActiveSessionSlug,
  updateGlobalSessionSelection,
} from '../../actions/sessionStateActions.js';

// Hooks HOC
import { WagmiHooksHOC } from '../HooksHOC/withWagmiBridge'
import type { WagmiInjectedProps } from '../HooksHOC/withWagmiBridge';

// CSS, icons, logos
import '../../assets/css/contextEngine.scss'
import styles from "./Account.module.scss";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faWindowClose,
  faSpinner,
  faQuestionCircle,
  faWallet,
  faBookmark,
  faSignOutAlt,
  faFingerprint,
  faCog,
  faCaretDown,
  faCaretUp
} from '@fortawesome/free-solid-svg-icons'
import MetaMaskLogo from "assets/img/metamask_icon_white.png";

// Reactstrap components
import { Button, Card, CardHeader, CardBody, CardFooter, Modal } from "reactstrap";

import CETooltip from '../Shared/CETooltip';
import SessionChipSelector from '../Shared/SessionChipSelector';
import {
  LoginSettingsSupportedResourceCard,
} from './LoginSettingsResourceSummary';
import {
  LoginSettingsInlineNetworkSummary,
  LoginSettingsPanelNetworkSummary,
} from './LoginSettingsNetworkSummary';
import {
  LoginSettingsConfigToggleControl,
  LoginSettingsControlRow,
  LoginSettingsSessionSummary,
} from './LoginSettingsControlRow';
import LoginSettingsSectionCard from './LoginSettingsSectionCard';

// Smart contract interactions and config
import {
  DEFAULT_AUTO_REQUEST_TESTNET_FUNDS,
  TESTNET_AUTO_SEND_THRESHOLD_ETH,
  DEFAULT_CHAIN_ID,
} from '../../variables/appConfig.js';
import contractScripts, {
  getAllSessionSlugs,
  getDemoSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  getProviderLocation,
  getSessionNetwork,
} from '../../utilities/web3/contractScripts.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import * as passkeyWallet from '../../wallet/passkeyWallet.js';
import {
  getSessionAiSettings,
  getLocalAiSettings,
  saveLocalAiSettings,
  clearLocalAiSettings,
  AI_PRESET_CONFIGS,
  DEFAULT_REASONING_EFFORT,
  applyPreLoginAiProviderKeyChange,
  deriveAiPreset,
  toModelLeaf,
} from '../../utilities/ai/aiSettings.js';
import { getLocalSessionResourceKeys, saveLocalResourceKeys, clearLocalResourceKeys } from '../../utilities/session/resourceKeys.js';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import { getWorkerSessionToken, clearAllWorkerSessionTokens } from '../../utilities/worker/workerAuth.js';
import { resolveActiveSessionSlug } from '../../utilities/session/sessionNaming.js';
import { markUserExplicitlyDisconnected } from '../../utilities/web3/wagmiDisconnectState.js';
import { notify } from '../../utilities/ui/notify.js';
import {
  normalizeSessionScanScope,
  normalizeSessionScanSlugs,
  readSessionScanScope,
  readSessionScanSlugs,
} from '../../utilities/session/sessionScanScope.js';
import { initCacheManager, listNamespaceEntriesSync, removeCache } from '../../utilities/cache/cacheScripts.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { derivePrimarySessionSlugFromList } from '../../utilities/session/globalSessionState.js';
import { isCryptoMode } from '../../utilities/ui/terminology.js';

// Chain helpers
import { chainHexId, chainHttpRpc, chainHttpRpcNoPath, chainCurrency, getChainById } from '../../variables/chains.js'
import { createLogger } from 'utilities/logging.js';
import {
  buildBookmarksRoutePath,
  buildSettingsSessionHref,
  formatSettingsSessionSlug,
  normalizeSettingsSessionSlug,
} from './loginSettingsRouteHelpers';
import {
  buildLoginSettingsSponsorshipCards,
  formatResourceSponsorHint as formatLoginSettingsResourceSponsorHint,
  getSponsoredKeyAliases,
} from './loginSettingsSponsoredStatusHelpers';
import {
  LOGIN_SETTINGS_AI_REASONING_LEVELS as AI_REASONING_LEVELS,
  LOGIN_SETTINGS_AI_TASK_REASONING_ROWS as AI_TASK_REASONING_ROWS,
  formatLoginSettingsAiProviderLabel,
} from './loginSettingsAiDisplayHelpers';

const accountLog = createLogger('account');
const normalizeAccountForComparison = (value: unknown): string => String(value || '').trim().toLowerCase();
type AccountUserPageProps = {
  viewAddress?: string;
  account?: string;
  provider?: string;
  minimized?: boolean;
  network?: unknown;
  activeSessionSlug?: string;
  sessionConfig?: unknown;
  networkChainId?: unknown;
};
const AccountUserPage = React.lazy(
  () => import("components/UserPage/UserPage")
) as React.LazyExoticComponent<React.ComponentType<AccountUserPageProps>>;

interface LoginAndSettingsModalProps extends Partial<Omit<WagmiInjectedProps, 'network'>> {
  provider: string;
  network: WagmiInjectedProps['network'] | null;
  account: string;
  loginModalToggled: boolean;
  loginInProgress: boolean;
  loginComplete: boolean;
  demoMode: RootState['sessionState']['demoMode'];
  demoSurfaceMode: RootState['sessionState']['demoSurfaceMode'];
  focusedTab: number;
  activeSessionSlug: string;
  primarySessionExplicit: boolean | undefined;
  selectedSessionScope: string;
  selectedSessionSlugs: string[];
  tooltipsEnabled: boolean;
  changeAccount: (payload?: unknown) => void;
  toggleLoginModal: (payload?: unknown) => void;
  updateLoginInfo: (payload?: unknown) => void;
  toggleDemoMode: (payload?: unknown) => void;
  setDemoSurfaceMode: (payload?: unknown) => void;
  toggleTooltips: (payload?: unknown) => void;
  changeFocusedTab: (payload?: unknown) => void;
  changeActiveSessionSlug: (payload?: unknown) => void;
  updateGlobalSessionSelection: (payload?: unknown) => void;
  sessionSlug?: string;
  [key: string]: unknown;
}

interface LoginAndSettingsModalState {
  wagmiLoginUpdateNeeded: boolean;
  firstModalAfterLogin: boolean;
  sendingTestFunds: boolean;
  sentTxHash: string;
  testFundsStatusMessage: string;
  testFundsStatusTone: string;
  passkeyWalletStatusMessage: string;
  passkeyWalletStatusTone: string;
  autoRequestTestnetFundsEnabled: boolean;
  autoSendTriggered: boolean;
  aiSettings: any;
  aiGroupSettings: any;
  aiSettingsDirty: boolean;
  aiSettingsStatus: string;
  aiSettingsOpen: boolean;
  aiSettingsSectionsOpen: Record<string, boolean>;
  expandedSponsorResources: Record<string, boolean>;
  resourceKeys: any;
  resourceKeysDirty: boolean;
  resourceKeysStatus: string;
  sponsoredAccess: any;
  sponsoredAccessLoading: boolean;
  sessionScanScope: string;
  sessionScanSlugs: string[];
  sessionScanSlugsInput: string;
  sessionScanStatus: string;
  preLoginSettingsOpen: boolean;
  preLoginConfigOpen: boolean;
  walletBalanceWei: ethers.BigNumber | null;
}

type SponsoredSessionEntry = Record<string, unknown> & {
  slug: string;
  label: string;
  sponsoredKeys: Record<string, unknown>;
  isActive?: boolean;
  inRpcScope?: boolean;
};

type SettingsSessionDescriptor = Record<string, unknown> & {
  label: string;
};

type SponsoredSessionSources = {
  byResource: Record<string, SponsoredSessionEntry[]>;
  rpcScope: SponsoredSessionEntry[];
};

type SettingsOverviewContext = {
  activeSession: SettingsSessionDescriptor;
  cryptoTerminology: boolean;
  needsNetworkSwitch: boolean;
  showWalletNetwork: boolean;
  sponsorshipCards: ReturnType<typeof buildLoginSettingsSponsorshipCards>;
  sponsorSessions: SponsoredSessionSources;
  targetNetworkName: string;
  targetNetwork: unknown;
  walletNetworkName: string;
};

export { buildBookmarksRoutePath };
const getErrorCode = (error: unknown) => (
  error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
);
const getErrorMessage = (error: unknown): string => (
  error instanceof Error
    ? error.message
    : (
      error && typeof error === 'object'
        ? toStr((error as { message?: unknown }).message)
        : toStr(error)
    )
);
const uniqueList = <T = unknown>(values: T[] = []) => (
  Array.from(
    new Set(
      (Array.isArray(values) ? values : []).filter((value): value is T => value !== undefined && value !== null)
    )
  )
);
const AI_PRESET_LABELS: Record<string, { label: string; badgeLabel: string }> = Object.freeze({
  'gpt-5': { label: 'GPT-5 (default)', badgeLabel: 'GPT-5' },
  'gpt-4o': { label: 'GPT-4o', badgeLabel: 'GPT-4o' },
  'claude-sonnet': { label: 'Claude Sonnet 4.6', badgeLabel: 'Claude Sonnet 4.6' },
  'claude-opus': { label: 'Claude Opus 4.6', badgeLabel: 'Claude Opus 4.6' },
});

const AI_PRESET_OPTIONS: readonly any[] = Object.freeze([
  ...Object.entries(AI_PRESET_CONFIGS).map(([key, config]: any) => Object.freeze({
    key,
    label: AI_PRESET_LABELS[key]?.label || key,
    badgeLabel: AI_PRESET_LABELS[key]?.badgeLabel || key,
    provider: config.provider,
    models: config.models,
  })),
  Object.freeze({
    key: 'custom',
    label: 'Custom...',
    badgeLabel: 'Custom',
  }),
]);

const deriveAiPresetKey = (settings: any = {}) => deriveAiPreset({
  mode: settings?.mode,
  models: settings?.models,
  modelProviders: settings?.modelProviders,
});

const getAiPresetMeta = (presetKey: any = ''): any => (
  AI_PRESET_OPTIONS.find((entry: any) => entry.key === presetKey) ||
  AI_PRESET_OPTIONS[AI_PRESET_OPTIONS.length - 1]
);

const formatAiPresetBadgeLabel = (settings: any = {}) => {
  const hasModelShape = !!(
    settings?.models?.fast ||
    settings?.models?.thinking ||
    settings?.mode
  );
  if (!hasModelShape) {
    return getAiPresetMeta('gpt-5').badgeLabel;
  }
  const presetKey = deriveAiPresetKey(settings);
  if (presetKey !== 'custom') {
    return getAiPresetMeta(presetKey).badgeLabel;
  }
  return toStr(settings?.models?.thinking || settings?.models?.fast || settings?.mode || 'Custom model') || 'Custom model';
};

const settingsSupportReasoning = (settings: any = {}) => (
  [settings?.models?.fast, settings?.models?.thinking]
    .map((model: any) => toModelLeaf(model))
    .some((modelLeaf: any) => /^(gpt-5|o[13])/.test(modelLeaf))
);

export class LoginAndSettingsModal extends Component<LoginAndSettingsModalProps, LoginAndSettingsModalState> {
  state: LoginAndSettingsModalState = (() => {
    const initialSessionScanSlugs = normalizeSessionScanSlugs(
      this.props.selectedSessionSlugs || readSessionScanSlugs()
    );
    return {
      wagmiLoginUpdateNeeded: true,
      firstModalAfterLogin: false,
      sendingTestFunds: false,
      sentTxHash: '',
      testFundsStatusMessage: '',
      testFundsStatusTone: '',
      passkeyWalletStatusMessage: '',
      passkeyWalletStatusTone: '',
      autoRequestTestnetFundsEnabled: DEFAULT_AUTO_REQUEST_TESTNET_FUNDS,
      autoSendTriggered: false,
      aiSettings: null,
      aiGroupSettings: null,
      aiSettingsDirty: false,
      aiSettingsStatus: '',
      aiSettingsOpen: false,
      aiSettingsSectionsOpen: {
        aiConfig: true,
        aiPerTask: false,
        aiAdvanced: false,
        sponsorship: false,
        resourceKeys: false,
      },
      expandedSponsorResources: {},
      resourceKeys: null,
      resourceKeysDirty: false,
      resourceKeysStatus: '',
      sponsoredAccess: null,
      sponsoredAccessLoading: false,
      sessionScanScope: normalizeSessionScanScope(
        this.props.selectedSessionScope || readSessionScanScope()
      ),
      sessionScanSlugs: Array.isArray(initialSessionScanSlugs) ? initialSessionScanSlugs : [],
      sessionScanSlugsInput: (
        Array.isArray(initialSessionScanSlugs)
          ? initialSessionScanSlugs
          : []
      ).map((slug: any) => (slug ? slug : 'general')).join(', '),
      sessionScanStatus: '',
      preLoginSettingsOpen: false,
      preLoginConfigOpen: false,
      walletBalanceWei: null,
    };
  })();
  _isMounted: boolean = false;
  _autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  _sponsoredReqId: number = 0;
  _cacheClearInFlight: boolean = false;
  _testFundsRequestId: number = 0;
  _passkeyWalletRestoreReqId: number = 0;
  _passkeyWalletActionId: number = 0;
  _sponsoredSessionSourcesMemo: { key: string; value: SponsoredSessionSources } | null = null;
  _settingsOverviewMemo: { key: string; value: SettingsOverviewContext } | null = null;

  getListModePrimarySessionSlug = (state: Partial<LoginAndSettingsModalState> = this.state) => {
    const scope = this.getSessionScanScopeValue(state);
    if (scope !== 'list') return '';
    const listSlugs = this.getConfiguredSessionScanSlugs(state);
    return derivePrimarySessionSlugFromList(listSlugs);
  };

  getActiveSessionSlug = (
    props: LoginAndSettingsModalProps = this.props,
    state: Partial<LoginAndSettingsModalState> = this.state,
  ) => {
    const resolvedSlug = normalizeSettingsSessionSlug(
      resolveActiveSessionSlug({
        activeSessionSlug: props.activeSessionSlug,
        sessionSlug: props.sessionSlug,
      })
    );
    if (resolvedSlug) return resolvedSlug;
    const scope = normalizeSessionScanScope(
      state?.sessionScanScope ??
      props.selectedSessionScope ??
      ''
    );
    const configuredScopeSlugs = this.getConfiguredSessionScanSlugs(state);
    const listModePrimary = this.getListModePrimarySessionSlug(state);
    const normalizedPropList = normalizeSessionScanSlugs(props.selectedSessionSlugs || []);
    const propListPrimary = Array.isArray(normalizedPropList)
      ? normalizedPropList[0]
      : String(normalizedPropList || '').split(',').map((slug: any) => slug.trim()).filter(Boolean)[0];
    const effectiveListPrimary = listModePrimary || normalizeSettingsSessionSlug(propListPrimary);
    const listIncludesGeneral = configuredScopeSlugs.includes('') || (
      Array.isArray(normalizedPropList) && normalizedPropList.includes('')
    );
    if (props.primarySessionExplicit === true) {
      if (scope === 'list' && !listIncludesGeneral && effectiveListPrimary) return effectiveListPrimary;
      return '';
    }
    if (scope === 'list' && effectiveListPrimary) return effectiveListPrimary;
    return scope === 'list' && propListPrimary
      ? normalizeSettingsSessionSlug(propListPrimary)
      : effectiveListPrimary;
  };

  getTargetNetwork = () => {
    const slug = this.getActiveSessionSlug();
    const ch = getSessionNetwork(slug);
    if (ch) return ch;

    const fallback = getChainById(DEFAULT_CHAIN_ID);
    if (fallback) return fallback;

    return {
      id: DEFAULT_CHAIN_ID,
      chainId: DEFAULT_CHAIN_ID,
      name: `Chain ${DEFAULT_CHAIN_ID}`,
      network: String(DEFAULT_CHAIN_ID),
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [] }, public: { http: [] } },
      blockExplorers: { default: { name: '', url: '' } },
      unsupported: false
    };
  };

  syncPasskeyWalletChain = (targetNetwork: any = null) => {
    const tn = targetNetwork || this.getTargetNetwork();
    passkeyWallet.setPasskeyWalletChain(tn);
    if (typeof passkeyWallet.getPasskeyWalletChain === 'function') {
      return passkeyWallet.getPasskeyWalletChain();
    }
    return tn;
  };

  getPasskeyWalletNetwork = (targetNetwork: any = null) => {
    const tn = this.syncPasskeyWalletChain(targetNetwork);
    if (!tn) return tn;
    const chainId = Number(tn?.id ?? tn?.chainId ?? 0);
    if (!chainId) return tn;
    const nameBase = tn?.name || `Chain ${chainId}`;
    const name = /\(Passkey\)$/.test(nameBase) ? nameBase : `${nameBase} (Passkey)`;
    return { ...tn, id: chainId, chainId, name };
  };

  async componentDidMount() {
    this._isMounted = true;
    this.checkAndSendTestFundsIfNeeded();

    // Passkey wallet session rehydration
    const passkeyNetwork = this.getPasskeyWalletNetwork();
    const passkeyRestoreReqId = this._passkeyWalletRestoreReqId + 1;
    this._passkeyWalletRestoreReqId = passkeyRestoreReqId;
    const passkeyActionIdAtRestoreStart = this._passkeyWalletActionId;
    const restoredAddress = await passkeyWallet.restorePasskeyWalletSession({ requireSigner: false });
    if (!this._isMounted) return;

    const restoreStillCurrent = (
      passkeyRestoreReqId === this._passkeyWalletRestoreReqId &&
      passkeyActionIdAtRestoreStart === this._passkeyWalletActionId
    );
    if (restoredAddress && restoreStillCurrent) {
       accountLog.log("Restored passkey wallet session:", restoredAddress);
       const web3info = {
        account: restoredAddress,
        provider: 'passkey_eoa',
        network: passkeyNetwork,
        userImageURL: undefined,
      };
      this.props.changeAccount(web3info);
      this.props.updateLoginInfo({
        loginInProgress: false,
        loginComplete: true,
        provider: "passkey_eoa",
      });
    }

    if (this.props.wagmiAddress && this.props.provider !== 'wagmi') {
      this.updateStateUponWagmiLogin();
    }

    this.loadAiSettings();
    this.loadResourceKeys();
    this.loadSponsoredAccess();
    this.loadSessionScanSettings();
  }

  componentWillUnmount() {
    this._isMounted = false;
    this._sponsoredReqId += 1;
    this._testFundsRequestId += 1;
    if (this._autoCloseTimer) {
      clearTimeout(this._autoCloseTimer);
      this._autoCloseTimer = null;
    }
  }

  setStateIfMounted = (nextState: any, cb?: any) => {
    if (!this._isMounted) return;
    if (
      nextState &&
      typeof nextState === 'object' &&
      !Array.isArray(nextState)
    ) {
      const keys = Object.keys(nextState);
      const changed = keys.some((key) => (
        this.state[key as keyof LoginAndSettingsModalState] !== nextState[key]
      ));
      if (!changed) {
        if (typeof cb === 'function') cb();
        return;
      }
    }
    this.setState(nextState, cb);
  };

  getWalletChainId = (props: LoginAndSettingsModalProps = this.props) => (
    Number(
      props.provider === 'wagmi'
        ? ((props.wagmiNetwork as any)?.id ?? (props.wagmiNetwork as any)?.chainId ?? (props.network as any)?.id ?? (props.network as any)?.chainId ?? 0)
        : ((props.network as any)?.id ?? (props.network as any)?.chainId ?? 0)
    ) || null
  );

  getWagmiBalanceInput = (props: LoginAndSettingsModalProps = this.props) => (
    (props.wagmiBalance as any)?.data?.value ?? (props.wagmiBalance as any)?.value ?? null
  );

  areWalletBalanceInputsEqual = (leftBalance: any, rightBalance: any) => {
    if (leftBalance === rightBalance) return true;
    if (leftBalance == null || rightBalance == null) return leftBalance == null && rightBalance == null;
    try {
      const leftNormalized = this.normalizeWalletBalance(leftBalance);
      const rightNormalized = this.normalizeWalletBalance(rightBalance);
      return (
        ethers.BigNumber.isBigNumber(leftNormalized) &&
        ethers.BigNumber.isBigNumber(rightNormalized) &&
        leftNormalized.eq(rightNormalized)
      );
    } catch (err) {
      void err;
      return false;
    }
  };

  getWalletAccount = (props: LoginAndSettingsModalProps = this.props) => (
    (() => {
      if (props.provider === 'wagmi') {
        const hasWagmiAddressProp = Object.prototype.hasOwnProperty.call(props, 'wagmiAddress');
        const wagmiAddress = toStr(props.wagmiAddress).trim();
        if (hasWagmiAddressProp) return wagmiAddress;
      }
      return toStr(props.account).trim();
    })()
  );

  getWalletBalanceContextKey = (props: LoginAndSettingsModalProps = this.props) => {
    const provider = toStr(props.provider).trim();
    const account = this.getWalletAccount(props).toLowerCase();
    const chainId = this.getWalletChainId(props);
    return `${provider}|${account}|${chainId == null ? 'null' : chainId}`;
  };

  getWalletRequestContext = (props: LoginAndSettingsModalProps = this.props) => {
    const targetNetwork = this.getTargetNetwork();
    const targetChainId = Number(targetNetwork?.id ?? targetNetwork?.chainId ?? 0) || null;
    const walletChainId = this.getWalletChainId(props);
    return {
      account: this.getWalletAccount(props),
      providerLike: toStr(props.provider).trim() || 'wagmi',
      chainId: targetChainId || walletChainId,
      walletChainId,
    };
  };

  getTestFundsRequestContextKey = (
    props: LoginAndSettingsModalProps = this.props,
    state: Partial<LoginAndSettingsModalState> = this.state,
  ) => (
    `${this.getWalletBalanceContextKey(props)}|${this.getActiveSessionSlug(props, state)}`
  );

  normalizeWalletBalance = (rawBalance: any) => {
    if (rawBalance == null) return null;
    if (ethers.BigNumber.isBigNumber(rawBalance)) return rawBalance;
    if (typeof rawBalance === 'bigint') return ethers.BigNumber.from(String(rawBalance));
    return ethers.BigNumber.from(String(rawBalance));
  };

  readWalletBalance = async (props: LoginAndSettingsModalProps = this.props) => {
    const walletAccount = this.getWalletAccount(props);
    if (!props.loginComplete || !walletAccount) return null;

    if (props.provider === 'wagmi') {
      return this.normalizeWalletBalance(this.getWagmiBalanceInput(props));
    }

    if (props.provider === 'passkey_eoa' || props.provider === 'web3auth') {
      const providerResolver = (
        typeof getProviderLocation === 'function'
          ? getProviderLocation
          : (
            contractScripts && typeof contractScripts.getProviderLocation === 'function'
              ? contractScripts.getProviderLocation.bind(contractScripts)
              : null
          )
      );
      const providerLocation = providerResolver
        ? providerResolver(props.provider)
        : cryptoUtils._getProvider(props.provider);
      if (!providerLocation) {
        throw new Error(`Selected wallet provider is not available: ${props.provider || 'unknown'}.`);
      }
      const provider = new ethers.providers.Web3Provider(providerLocation, 'any');
      return await provider.getBalance(walletAccount);
    }

    return null;
  };

  syncWalletBalance = async (props: LoginAndSettingsModalProps = this.props) => {
    const balanceContextKey = this.getWalletBalanceContextKey(props);
    let nextBalance: any = null;

    try {
      nextBalance = await this.readWalletBalance(props);
    } catch (err) {
      accountLog.warn('LoginAndSettingsModal balance read failed:', err);
    }

    // Ignore async reads that resolved after the user switched wallets/providers.
    if (balanceContextKey !== this.getWalletBalanceContextKey()) {
      return { balance: null, stale: true };
    }

    const prevBalance = this.state.walletBalanceWei;
    const balanceChanged = !(
      prevBalance === nextBalance ||
      (ethers.BigNumber.isBigNumber(prevBalance) &&
        ethers.BigNumber.isBigNumber(nextBalance) &&
        prevBalance.eq(nextBalance))
    );

    if (balanceChanged) {
      this.setStateIfMounted({ walletBalanceWei: nextBalance });
    }

    return { balance: nextBalance, stale: false };
  };

  clearAutoCloseTimer = () => {
    if (this._autoCloseTimer) {
      clearTimeout(this._autoCloseTimer);
      this._autoCloseTimer = null;
    }
  };

  buildTestFundsSuccessMessage = (result: any = {}) => {
    const amountEth = toStr(result?.amountEth).trim();
    const networkName = this.getTargetNetwork()?.name || 'the session network';
    if (amountEth) return `Test gas sent: ${amountEth} ETH on ${networkName}.`;
    return `Test gas sent on ${networkName}.`;
  };

  buildTestFundsErrorMessage = (error: any, { source = 'manual' }: any = {}) => {
    const prefix = source === 'auto' ? 'Auto-funding failed' : 'Get test gas failed';
    const baseMessage = toStr(error?.message).trim() || 'Failed to request test gas.';
    const status = Number(error?.status || 0) || 0;
    if (status && !baseMessage.includes(`(${status})`) && !baseMessage.includes(`HTTP ${status}`)) {
      return `${prefix}: ${baseMessage} (HTTP ${status}).`;
    }
    return `${prefix}: ${baseMessage}`;
  };

  requestTestFunds = async ({ source = 'manual' }: any = {}) => {
    if (this.state.sendingTestFunds) return null;
    const walletAccount = this.getWalletAccount();
    if (!walletAccount) return null;
    const requestId = this._testFundsRequestId + 1;
    const requestContextKey = this.getTestFundsRequestContextKey();
    this._testFundsRequestId = requestId;

    this.clearAutoCloseTimer();

    try {
      this.setStateIfMounted({
        sendingTestFunds: true,
        sentTxHash: '',
        testFundsStatusMessage: '',
        testFundsStatusTone: '',
      });
      const result = await contractScripts.sendTestnetFunds(
        walletAccount,
        this.getActiveSessionSlug(),
        { context: this.getWalletRequestContext() }
      );
      const txHash = toStr(result?.txHash || result?.hash).trim();
      if (
        requestId !== this._testFundsRequestId ||
        requestContextKey !== this.getTestFundsRequestContextKey()
      ) {
        return result;
      }
      this.setStateIfMounted({
        sendingTestFunds: false,
        sentTxHash: txHash,
        testFundsStatusMessage: this.buildTestFundsSuccessMessage(result),
        testFundsStatusTone: 'success',
      });
      return result;
    } catch (err) {
      accountLog.error(source === 'auto' ? 'Auto-send testnet funds failed:' : 'Manual testnet funds request failed:', err);
      if (
        requestId !== this._testFundsRequestId ||
        requestContextKey !== this.getTestFundsRequestContextKey()
      ) {
        return null;
      }
      this.setStateIfMounted({
        sendingTestFunds: false,
        sentTxHash: '',
        testFundsStatusMessage: this.buildTestFundsErrorMessage(err, { source }),
        testFundsStatusTone: 'error',
      });
      return null;
    }
  };

  handleManualTestFundsRequest = async () => {
    await this.requestTestFunds({ source: 'manual' });
  };

  // Passkey wallet handlers

  startPasskeyWalletAction = (): number => {
    this._passkeyWalletActionId += 1;
    return this._passkeyWalletActionId;
  };

  isCurrentPasskeyWalletAction = (actionId: number): boolean => (
    this._isMounted && actionId === this._passkeyWalletActionId
  );

  handlePasskeyWalletCreate = async () => {
    const passkeyActionId = this.startPasskeyWalletAction();
    this.setStateIfMounted({
      passkeyWalletStatusMessage: '',
      passkeyWalletStatusTone: '',
    });
    this.props.updateLoginInfo({
      loginInProgress: true,
      loginComplete: false,
      provider: "passkey_eoa",
    });

    try {
      const passkeyNetwork = this.getPasskeyWalletNetwork();
      const address = await passkeyWallet.createPasskeyWallet();
      if (!this.isCurrentPasskeyWalletAction(passkeyActionId)) return;
      this._finalizePasskeyWalletLogin(address, passkeyNetwork);
    } catch (error) {
      accountLog.error("Passkey wallet create error:", error);
      if (!this.isCurrentPasskeyWalletAction(passkeyActionId)) return;
      const message = getErrorMessage(error).trim() || 'Could not create passkey wallet.';
      this.setStateIfMounted({
        passkeyWalletStatusMessage: `Create failed: ${message}`,
        passkeyWalletStatusTone: 'error',
      });
      this.props.updateLoginInfo({ loginInProgress: false, loginComplete: false, provider: null });
    }
  };

  handlePasskeyWalletSignIn = async () => {
    const passkeyActionId = this.startPasskeyWalletAction();
    this.setStateIfMounted({
      passkeyWalletStatusMessage: '',
      passkeyWalletStatusTone: '',
    });
    this.props.updateLoginInfo({
      loginInProgress: true,
      loginComplete: false,
      provider: "passkey_eoa",
    });

    try {
      const passkeyNetwork = this.getPasskeyWalletNetwork();
      const address = await passkeyWallet.unlockPasskeyWallet();
      if (!this.isCurrentPasskeyWalletAction(passkeyActionId)) return;
      this._finalizePasskeyWalletLogin(address, passkeyNetwork);
    } catch (error) {
      accountLog.error("Passkey wallet sign-in error:", error);
      if (!this.isCurrentPasskeyWalletAction(passkeyActionId)) return;
      const isMissingWallet = passkeyWallet.isMissingPasskeyWalletRecordError?.(error);
      const message = isMissingWallet
        ? 'No passkey wallet is saved in this browser for this app. Use Create to make one under this RP ID.'
        : `Login failed: ${getErrorMessage(error).trim() || 'Could not unlock passkey wallet.'}`;
      this.setStateIfMounted({
        passkeyWalletStatusMessage: message,
        passkeyWalletStatusTone: 'error',
      });
      this.props.updateLoginInfo({ loginInProgress: false, loginComplete: false, provider: null });
    }
  };

  _finalizePasskeyWalletLogin = (address: any, targetNetwork: any = null) => {
      const passkeyNetwork = this.getPasskeyWalletNetwork(targetNetwork);
      const previousPasskeyAccount = this.props.provider === 'passkey_eoa'
        ? normalizeAccountForComparison(this.props.account)
        : '';
      const nextPasskeyAccount = normalizeAccountForComparison(address);
      if (previousPasskeyAccount && nextPasskeyAccount && previousPasskeyAccount !== nextPasskeyAccount) {
        clearAllWorkerSessionTokens();
        notify.info('Passkey account switched.');
      }
      const web3info = {
        account: address,
        provider: 'passkey_eoa',
        network: passkeyNetwork,
        userImageURL: undefined,
      };

      this.props.changeAccount(web3info);
      this.props.updateLoginInfo({
        loginInProgress: false,
        loginComplete: true,
        provider: "passkey_eoa",
      });
  };

  handleLogout = async () => {
    this._passkeyWalletActionId += 1;
    if (this.props.provider === 'passkey_eoa') {
       await passkeyWallet.logoutPasskeyWallet();
    }

    if (this.props.provider === 'wagmi' && this.props.wagmiDisconnect) {
      markUserExplicitlyDisconnected();
      try {
        await this.props.wagmiDisconnect();
      } catch (e) {
        accountLog.error('wagmiDisconnect failed:', e);
      }
    }

    this.props.updateLoginInfo({
      loginInProgress: false,
      loginComplete: false,
      provider: null,
    });
    this.props.changeAccount({});
    clearAllWorkerSessionTokens();
  };

  componentDidUpdate(prevProps: any, prevState: any) {
    let needsBalanceCheck = false;
    const activeSessionChanged = (
      this.getActiveSessionSlug(this.props, this.state) !== this.getActiveSessionSlug(prevProps, prevState)
    );
    const testFundsContextChanged = (
      this.getTestFundsRequestContextKey(this.props, this.state) !==
      this.getTestFundsRequestContextKey(prevProps, prevState)
    );
    if (this.getWalletChainId() !== this.getWalletChainId(prevProps)) needsBalanceCheck = true;
    if (this.props.account !== prevProps.account) {
      needsBalanceCheck = true;
      this.setStateIfMounted({ wagmiLoginUpdateNeeded: true });
      this.loadSponsoredAccess();
    }
    if (this.props.provider !== prevProps.provider) needsBalanceCheck = true;
    if (this.props.wagmiAddress !== prevProps.wagmiAddress) needsBalanceCheck = true;
    if (!this.areWalletBalanceInputsEqual(this.getWagmiBalanceInput(), this.getWagmiBalanceInput(prevProps))) {
      needsBalanceCheck = true;
    }
    if (this.props.loginComplete && !prevProps.loginComplete) {
      needsBalanceCheck = true;
      this.setStateIfMounted({ firstModalAfterLogin: true });
      // Auto-close after 1 second of success view
      if (this.props.loginModalToggled) {
        if (this._autoCloseTimer) clearTimeout(this._autoCloseTimer);
        this._autoCloseTimer = setTimeout(() => {
          this._autoCloseTimer = null;
          if (!this._isMounted) return;
          this.closeLoginModal();
        }, 1000);
      }
    } else if (!this.props.loginComplete && prevProps.loginComplete) {
      needsBalanceCheck = true;
    }

    if (activeSessionChanged) {
      needsBalanceCheck = true;
    }

    if ((!this.props.loginComplete && prevProps.loginComplete) || testFundsContextChanged) {
      this._testFundsRequestId += 1;
      const resetState: Partial<LoginAndSettingsModalState> = {};
      if (this.state.autoSendTriggered) resetState.autoSendTriggered = false;
      if (this.state.sendingTestFunds) resetState.sendingTestFunds = false;
      if (this.state.sentTxHash) resetState.sentTxHash = '';
      if (this.state.testFundsStatusMessage) resetState.testFundsStatusMessage = '';
      if (this.state.testFundsStatusTone) resetState.testFundsStatusTone = '';
      if (Object.keys(resetState).length) this.setStateIfMounted(resetState);
    }

    if (needsBalanceCheck) this.checkAndSendTestFundsIfNeeded();

    if (this.state.wagmiLoginUpdateNeeded && this.props.wagmiAddress && this.props.provider !== 'wagmi') {
      this.updateStateUponWagmiLogin();
    } else if (this.props.provider === 'wagmi' && !this.props.wagmiAddress && this.state.wagmiLoginUpdateNeeded) {
      this.updateStateUponWagmiLogin();
    }

    if (activeSessionChanged) {
      this.loadAiSettings();
      this.loadResourceKeys();
      this.loadSponsoredAccess();
      this.syncPasskeyWalletChain();
    }

    const prevScope = normalizeSessionScanScope(prevProps.selectedSessionScope || '');
    const nextScope = normalizeSessionScanScope(this.props.selectedSessionScope || '');
    const prevScopeSlugs = normalizeSessionScanSlugs(prevProps.selectedSessionSlugs || []);
    const nextScopeSlugs = normalizeSessionScanSlugs(this.props.selectedSessionSlugs || []);
    if (prevScope !== nextScope || JSON.stringify(prevScopeSlugs) !== JSON.stringify(nextScopeSlugs)) {
      this.loadSessionScanSettings();
    }
  }

  checkAndSendTestFundsIfNeeded = async () => {
    const walletAccount = this.getWalletAccount();
    if (!this.props.loginComplete || !walletAccount) {
      const resetState: Partial<LoginAndSettingsModalState> = {};
      if (this.state.autoSendTriggered) resetState.autoSendTriggered = false;
      if (this.state.walletBalanceWei !== null) resetState.walletBalanceWei = null;
      if (Object.keys(resetState).length) this.setStateIfMounted(resetState);
      return;
    }

    const { balance: currentBalance, stale } = await this.syncWalletBalance();
    if (stale) return;

    if (!this.state.autoRequestTestnetFundsEnabled) {
      if (this.state.autoSendTriggered) {
        this.setStateIfMounted({ autoSendTriggered: false });
      }
      return;
    }

    let shouldTrigger = false;

    try {
      if (currentBalance != null) {
        const threshold = ethers.utils.parseEther(TESTNET_AUTO_SEND_THRESHOLD_ETH);
        shouldTrigger = currentBalance.lte(threshold);
      }
    } catch (e) {
      accountLog.error("Error parsing wallet balance in auto-send check:", e);
    }

    if (shouldTrigger && !this.state.sendingTestFunds && !this.state.autoSendTriggered) {
      this.autoSendTestFunds();
    }

    if (this.state.autoSendTriggered !== shouldTrigger) {
      this.setStateIfMounted({ autoSendTriggered: shouldTrigger });
    }
  };

  autoSendTestFunds = async () => {
    await this.requestTestFunds({ source: 'auto' });
  };

  ensureWorkerSessionToken = async () => {
    if (!this.props.loginComplete || !this.props.account) return;
    try {
      const chainId = (this.props.network as any)?.id || (this.props.network as any)?.chainId || null;
      const sessionSlug = this.getActiveSessionSlug();
      await getWorkerSessionToken({
        sessionSlug,
        context: {
          account: this.props.account,
          providerLike: this.props.provider || 'wagmi',
          chainId,
        },
      });
    } catch (err) {
      accountLog.warn('[WorkerAuth] Session token request failed:', err);
    }
  };

  addCorrectNetwork = async () => {
    if (window.ethereum && this.props.provider === "wagmi") {
      try {
        const tn = this.getTargetNetwork();
        const chainIdHex = chainHexId(tn);
        const rpcHttp = chainHttpRpcNoPath(tn) || chainHttpRpc(tn);
        const native = chainCurrency(tn);

        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: tn.name,
            nativeCurrency: native,
            rpcUrls: rpcHttp ? [rpcHttp] : [],
            blockExplorerUrls: [tn.blockExplorers?.default?.url].filter(Boolean)
          }]
        });
        return true;
      } catch (error) {
        accountLog.error("Error adding network:", error);
        return false;
      }
    }
    return false;
  };

  switchToCorrectNetwork = async () => {
    const ethereum = window.ethereum;
    if (ethereum && this.props.provider === "wagmi") {
      const tn = this.getTargetNetwork();
      const chainIdHex = chainHexId(tn);
      const switchToTargetNetwork = () => ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
      try {
        await switchToTargetNetwork();
      } catch (error: any) {
        if (getErrorCode(error) === 4902) {
          const added = await this.addCorrectNetwork();
          if (!added) return;
          try {
            await switchToTargetNetwork();
          } catch (switchAfterAddError) {
            accountLog.error("Error switching network after adding network:", switchAfterAddError);
          }
        } else {
          accountLog.error("Error switching network:", error);
        }
      }
    }
  };

  reloadPage = () => {
    if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
      window.location.reload();
    }
  };

  handleClearAllCaches = async () => {
    if (this._cacheClearInFlight) return;
    this._cacheClearInFlight = true;
    accountLog.log("Clearing all application caches...");
    const managedNamespaces = [
      'questionsCache',
      'surveysCache',
      'bookmarksCache',
      'filters',
      'sbtCache',
      'userCache',
    ];
    try {
      await initCacheManager();
      for (const namespace of managedNamespaces) {
        const entries = listNamespaceEntriesSync(namespace, { cloneValues: false });
        const slugs: any = new Set(
          entries
            .map((entry: any) => String(entry?.slug || ''))
            .filter((slug: any) => slug)
        );
        await Promise.all(Array.from(slugs).map((slug: any) => removeCache(namespace, slug)));
        await removeCache(namespace, '');
      }
    } catch (error) {
      accountLog.warn('[LoginAndSettingsModal] Failed to clear managed caches:', error);
    }
    try {
      localStorage.removeItem('cacheHasLoaded');
      const tinyFlagPrefixes = [
        'dg:cacheHasLoaded:',
        'dg:sbt:partialReady:',
        'dg:sbt:deferredFullScanNeeded:',
        'dg:sbt:fullScanInProgress:',
      ];
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (tinyFlagPrefixes.some((prefix: any) => key.startsWith(prefix))) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) { accountLog.warn('LoginAndSettingsModal: fallback', e); }
    this._cacheClearInFlight = false;
    this.reloadPage();
  };

  cloneAiSettings = (src: any) => {
    const baseCandidate = src || getLocalAiSettings() || {};
    const base = (baseCandidate && typeof baseCandidate === 'object') ? baseCandidate : {};
    return {
      ...base,
      preset: toStr(base?.preset || ''),
      models: { ...(base.models || {}) },
      modelProviders: { ...(base.modelProviders || {}) },
      taskReasoningEffort: { ...(base.taskReasoningEffort || {}) },
      transcription: { ...(base.transcription || {}) },
      providers: {
        ...(base.providers || {}),
        anthropic: { ...(base.providers?.anthropic || {}) },
        openai: { ...(base.providers?.openai || {}) },
        openrouter: { ...(base.providers?.openrouter || {}) },
        custom: { ...(base.providers?.custom || {}) },
      },
    };
  };

  applyAiPreset = (settings: any, presetKey: any) => {
    const current = this.cloneAiSettings(settings);
    const nextPreset = toStr(presetKey || '').trim() || 'custom';
    if (nextPreset === 'custom') {
      return {
        ...current,
        preset: 'custom',
      };
    }

    const preset = getAiPresetMeta(nextPreset);
    if (!preset?.provider || !preset?.models) {
      return {
        ...current,
        preset: 'custom',
      };
    }

    return {
      ...current,
      preset: preset.key,
      mode: preset.provider,
      models: {
        ...(current.models || {}),
        ...preset.models,
      },
      modelProviders: {
        ...(current.modelProviders || {}),
        fast: preset.provider,
        thinking: preset.provider,
      },
    };
  };

  cloneResourceKeys = (src: any) => {
    const baseCandidate = src || getLocalSessionResourceKeys(this.getActiveSessionSlug()) || {};
    const base = (baseCandidate && typeof baseCandidate === 'object') ? baseCandidate : {};
    return {
      rpc: { ...(base.rpc || {}) },
      arweave: { ...(base.arweave || {}) },
    };
  };

  loadAiSettings = () => {
    const sessionSlug = this.getActiveSessionSlug();
    const aiSettings = getLocalAiSettings();
    const aiGroupSettings = getSessionAiSettings(sessionSlug);
    this.setStateIfMounted({
      aiSettings,
      aiGroupSettings,
      aiSettingsDirty: false,
      aiSettingsStatus: '',
    });
  };

  loadResourceKeys = () => {
    const resourceKeys = getLocalSessionResourceKeys(this.getActiveSessionSlug());
    this.setStateIfMounted({
      resourceKeys,
      resourceKeysDirty: false,
      resourceKeysStatus: '',
    });
  };

  formatSessionScanSlugsInput = (slugsIn: any = []) => {
    const list = Array.isArray(slugsIn) ? slugsIn : [];
    return list.map((slug: any) => (slug ? slug : 'general')).join(', ');
  };

  getSessionScanScopeValue = (state: Partial<LoginAndSettingsModalState> = this.state) => normalizeSessionScanScope(
    state?.sessionScanScope ??
    this.props.selectedSessionScope ??
    readSessionScanScope()
  );

  getConfiguredSessionScanSlugs = (state: Partial<LoginAndSettingsModalState> = this.state) => (
    uniqueList((() => {
      const rawSource =
        Array.isArray(state?.sessionScanSlugs)
          ? state.sessionScanSlugs
          : (
            Array.isArray(this.props.selectedSessionSlugs) && this.props.selectedSessionSlugs.length > 0
              ? this.props.selectedSessionSlugs
              : (state?.sessionScanSlugsInput || '')
          );
      const normalized = normalizeSessionScanSlugs(rawSource);
      const list = Array.isArray(normalized)
        ? normalized
        : String(normalized || '')
          .split(',')
          .map((slug: any) => slug.trim())
          .filter((slug: any) => slug.length > 0);
      return list.map((slug: any) => normalizeSettingsSessionSlug(slug));
    })())
  );

  loadSessionScanSettings = () => {
    const rawScope = this.props.selectedSessionScope || readSessionScanScope();
    const rawSlugs = this.props.selectedSessionSlugs || readSessionScanSlugs();
    const scope = normalizeSessionScanScope(rawScope);
    const selectedSessionSlugs = this.getConfiguredSessionScanSlugs({
      sessionScanSlugs: rawSlugs,
    });
    this.setStateIfMounted({
      sessionScanScope: scope,
      sessionScanSlugs: selectedSessionSlugs,
      sessionScanSlugsInput: this.formatSessionScanSlugsInput(selectedSessionSlugs),
      sessionScanStatus: '',
    });
  };

  loadSponsoredAccess = async () => {
    const slug = this.getActiveSessionSlug();
    const cfg = getSessionConfigBySlugOrDefault(slug) || {};
    const account = this.props.account || '';
    const reqId = (this._sponsoredReqId = (this._sponsoredReqId || 0) + 1);
    this.setStateIfMounted({ sponsoredAccessLoading: true });
    try {
      const keys = ['ai', 'arweave', 'rpc', 'txGas'];
      const results = await Promise.all(
        keys.map((resourceKey: any) =>
          checkSponsoredAccess({
            sessionConfig: cfg,
            sessionSlug: slug,
            account,
            resourceKey,
          })
        )
      );
      if (reqId !== this._sponsoredReqId) return;
      const accessMap = {
        ai: results[0],
        arweave: results[1],
        rpc: results[2],
        txGas: results[3],
      };
      this.setStateIfMounted({ sponsoredAccess: accessMap, sponsoredAccessLoading: false });
    } catch (_) {
      if (reqId !== this._sponsoredReqId) return;
      this.setStateIfMounted({ sponsoredAccessLoading: false });
    }
  };

  updateAiSettings = (updater: any) => {
    this.setState((prev: Readonly<LoginAndSettingsModal['state']>) => {
      const current = this.cloneAiSettings(prev.aiSettings);
      const next = updater ? updater(current) : current;
      return { aiSettings: next, aiSettingsDirty: true, aiSettingsStatus: '' };
    });
  };

  updateResourceKeys = (updater: any) => {
    this.setState((prev: Readonly<LoginAndSettingsModal['state']>) => {
      const current = this.cloneResourceKeys(prev.resourceKeys);
      const next = updater ? updater(current) : current;
      return { resourceKeys: next, resourceKeysDirty: true, resourceKeysStatus: '' };
    });
  };

  updateResourceKeyField = (resource: any, field: any, value: any) => {
    this.updateResourceKeys((s: any) => ({
      ...s,
      [resource]: {
        ...(s[resource] || {}),
        [field]: value,
      },
    }));
  };

  handleResourceToggleLocal = (resource: any, event: any) => {
    const useLocal = !!event?.target?.checked;
    this.updateResourceKeys((s: any) => ({
      ...s,
      [resource]: {
        ...(s[resource] || {}),
        useLocal,
      },
    }));
  };

  updateAiProviderField = (provider: any, field: any, value: any) => {
    this.updateAiSettings((s: any) => ({
      ...s,
      providers: {
        ...(s.providers || {}),
        [provider]: {
          ...(s.providers?.[provider] || {}),
          [field]: value,
        },
      },
    }));
  };

  updateAiModelField = (modelType: any, value: any) => {
    this.updateAiSettings((s: any) => {
      const next = {
        ...s,
        models: {
          ...(s.models || {}),
          [modelType]: value,
        },
      };
      return {
        ...next,
        preset: deriveAiPresetKey(next),
      };
    });
  };

  updateAiTaskReasoningField = (taskType: any, value: any) => {
    this.updateAiSettings((s: any) => ({
      ...s,
      taskReasoningEffort: {
        ...(s.taskReasoningEffort || {}),
        [taskType]: value || null,
      },
    }));
  };

  updateAiTranscriptionField = (field: any, value: any) => {
    this.updateAiSettings((s: any) => ({
      ...s,
      transcription: {
        ...(s.transcription || {}),
        [field]: value,
      },
    }));
  };

  handleAiModeChange = (event: any) => {
    const nextMode = toStr(event?.target?.value || '').trim().toLowerCase() || 'openai';
    this.updateAiSettings((s: any) => {
      const next = {
        ...s,
        mode: nextMode,
        modelProviders: {
          ...(s.modelProviders || {}),
          fast: nextMode,
          thinking: nextMode,
        },
      };
      return {
        ...next,
        preset: deriveAiPresetKey(next),
      };
    });
  };

  handleAiPresetChange = (event: any) => {
    const presetKey = toStr(event?.target?.value || '').trim() || 'custom';
    this.updateAiSettings((s: any) => this.applyAiPreset(s, presetKey));
    if (presetKey === 'custom') {
      this.setState((prevState: Readonly<LoginAndSettingsModal['state']>) => ({
        aiSettingsSectionsOpen: {
          ...(prevState.aiSettingsSectionsOpen || {}),
          aiAdvanced: true,
        },
      }));
    }
  };

  handleAiToggleLocal = (event: any) => {
    const useLocal = !!event?.target?.checked;
    this.updateAiSettings((s: any) => ({ ...s, useLocal }));
  };

  handleSaveAiSettings = () => {
    const saved = saveLocalAiSettings(this.state.aiSettings || {});
    this.setState({
      aiSettings: saved,
      aiSettingsDirty: false,
      aiSettingsStatus: 'Saved.',
    });
  };

  handleSaveResourceKeys = () => {
    const saved = saveLocalResourceKeys(this.getActiveSessionSlug(), this.state.resourceKeys || {});
    this.setState({
      resourceKeys: saved,
      resourceKeysDirty: false,
      resourceKeysStatus: 'Saved.',
    });
  };

  handleClearAiSettings = () => {
    clearLocalAiSettings();
    const aiSettings = getLocalAiSettings();
    this.setState({
      aiSettings,
      aiSettingsDirty: false,
      aiSettingsStatus: 'Local override cleared.',
    });
  };

  handleClearResourceKeys = () => {
    const sessionSlug = this.getActiveSessionSlug();
    clearLocalResourceKeys(sessionSlug);
    const resourceKeys = getLocalSessionResourceKeys(sessionSlug);
    this.setState({
      resourceKeys,
      resourceKeysDirty: false,
      resourceKeysStatus: 'Local overrides cleared.',
    });
  };

  togglePreLoginSettingsPanel = () => {
    this.setState((prevState: Readonly<LoginAndSettingsModal['state']>) => {
      const preLoginSettingsOpen = !prevState.preLoginSettingsOpen;
      return {
        preLoginSettingsOpen,
        preLoginConfigOpen: preLoginSettingsOpen
          ? prevState.preLoginConfigOpen
          : false,
      };
    });
  };

  togglePreLoginConfigPanel = () => {
    this.setState((prevState: Readonly<LoginAndSettingsModal['state']>) => ({
      preLoginConfigOpen: !prevState.preLoginConfigOpen,
    }));
  };

  getDisplaySessionConfig = (slugIn: any = '', cfgIn: any = null) => {
    const slug = normalizeSettingsSessionSlug(slugIn || cfgIn?.slug || '');
    return (
      cfgIn
      || getSessionConfigBySlugOrDefault(slug)
      || getDemoSessionConfigBySlug(slug, { allowDemoFallback: true })
      || {}
    );
  };

  handlePreLoginAiEndpointChange = (event: any) => {
    const rpcUrl = toStr(event?.target?.value || '');
    const current = this.cloneAiSettings(this.state.aiSettings || getLocalAiSettings());
    const saved = saveLocalAiSettings({
      ...current,
      providers: {
        ...(current.providers || {}),
        custom: {
          ...(current.providers?.custom || {}),
          rpcUrl,
        },
      },
    });
    this.setStateIfMounted({
      aiSettings: saved,
      aiSettingsDirty: false,
      aiSettingsStatus: '',
    });
  };

  handlePreLoginAiProviderKeyChange = (provider: any, event: any) => {
    const current = this.cloneAiSettings(this.state.aiSettings || getLocalAiSettings());
    const saved = saveLocalAiSettings(applyPreLoginAiProviderKeyChange(current, {
      provider,
      apiKey: toStr(event?.target?.value || ''),
    }));
    this.setStateIfMounted({
      aiSettings: saved,
      aiSettingsDirty: false,
      aiSettingsStatus: '',
    });
  };

  toggleAiSettingsSection = (sectionKey: any) => {
    if (!sectionKey) return;
    this.setState((prevState: Readonly<LoginAndSettingsModal['state']>) => ({
      aiSettingsSectionsOpen: {
        ...(prevState.aiSettingsSectionsOpen || {}),
        [sectionKey]: !prevState.aiSettingsSectionsOpen?.[sectionKey],
      },
    }));
  };

  isAiSettingsSectionOpen = (sectionKey: any) => {
    const sections = this.state.aiSettingsSectionsOpen || {};
    if (Object.prototype.hasOwnProperty.call(sections, sectionKey)) {
      return !!sections[sectionKey];
    }
    return sectionKey === 'aiConfig';
  };

  toggleSupportedResourceSessions = (resourceKey: any) => {
    const key = toStr(resourceKey).trim();
    if (!key) return;
    this.setState((prevState: Readonly<LoginAndSettingsModal['state']>) => ({
      expandedSponsorResources: {
        ...(prevState.expandedSponsorResources || {}),
        [key]: !prevState.expandedSponsorResources?.[key],
      },
    }));
  };

  getSessionDescriptor = (slugIn: any = '', cfgIn: any = null, activeSlugIn: any = this.getActiveSessionSlug()) => {
    const slug = normalizeSettingsSessionSlug(slugIn || cfgIn?.slug || '');
    const cfg = this.getDisplaySessionConfig(slug, cfgIn);
    const slugKey = toStr(slug).trim();
    const sessionName = toStr(cfg?.sessionName || cfg?.slug || slugKey).trim();
    const slugLabel = formatSettingsSessionSlug(slug);
    const label = sessionName || slugLabel;
    return {
      slug,
      slugLabel,
      sessionName,
      label,
      description: sessionName && sessionName.toLowerCase() !== slugLabel ? `${sessionName} (${slugLabel})` : label,
      isActive: normalizeSettingsSessionSlug(activeSlugIn) === slug,
    };
  };

  getSettingsSessionOptions = (activeSlugIn: any = this.getActiveSessionSlug()) => {
    const activeSlug = normalizeSettingsSessionSlug(activeSlugIn);
    const options: any = new Map();
    const pushSession = (slugIn: any = '') => {
      const descriptor = this.getSessionDescriptor(slugIn, null, activeSlug);
      options.set(descriptor.slug, descriptor);
    };

    (getAllSessionSlugs({ includeEmpty: true }) || []).forEach(pushSession);
    pushSession(activeSlug);
    pushSession('');

    return Array.from(options.values()).sort((left: any, right: any) => {
      if (left.slug === activeSlug && right.slug !== activeSlug) return -1;
      if (left.slug !== activeSlug && right.slug === activeSlug) return 1;
      if (!left.slug && right.slug) return -1;
      if (left.slug && !right.slug) return 1;
      return left.label.localeCompare(right.label);
    });
  };

  formatSettingsSessionOptionLabel = (descriptor: any = {}) => {
    const slug = normalizeSettingsSessionSlug(descriptor.slug);
    if (!slug) return 'General';
    if (descriptor.sessionName && descriptor.sessionName.toLowerCase() !== descriptor.slugLabel) {
      return `${descriptor.sessionName} (${descriptor.slugLabel})`;
    }
    return descriptor.label || descriptor.slugLabel || 'General';
  };

  renderConfigToggleControl = ({
    expanded = false,
    onToggle = null,
    testId = '',
  }: any = {}) => LoginSettingsConfigToggleControl({
    expanded,
    onToggle,
    testId,
  });

  renderSessionSummary = (activeSessionIn: any = null) => {
    const activeSession = activeSessionIn || this.getSessionDescriptor(this.getActiveSessionSlug());
    return LoginSettingsSessionSummary({
      activeSession,
      sessionHref: buildSettingsSessionHref(activeSession.slug),
    });
  };

  renderSettingsControlRow = ({
    activeSession = this.getSessionDescriptor(this.getActiveSessionSlug()),
    configOpen = false,
    onToggleConfig = null,
    configTestId = '',
    beforeConfig = null,
    betweenSessionAndTooltips = null,
    afterDemo = null,
    tooltipsInfoId = '',
    tooltipPlacement = 'top',
    containerClassName = '',
    rowClassName = '',
  }: any = {}) => LoginSettingsControlRow({
    activeSession,
    configOpen,
    onToggleConfig,
    configTestId,
    beforeConfig,
    betweenSessionAndTooltips,
    afterDemo,
    tooltipsControl: this.renderTooltipsToggleControl({
      infoId: tooltipsInfoId,
      tooltipPlacement,
    }),
    demoControl: this.renderDemoSurfaceToggleControl(),
    containerClassName,
    rowClassName,
    sessionHref: buildSettingsSessionHref(activeSession.slug),
  });

  handleActiveSessionChange = (event: any) => {
    const nextSlug = normalizeSettingsSessionSlug(event?.target?.value || '');
    if (nextSlug === this.getActiveSessionSlug()) return;
    this.props.updateGlobalSessionSelection?.({
      primarySessionSlug: nextSlug,
    });
  };

  getScanScopeSessionSlugs = ({
    activeSlug = this.getActiveSessionSlug(),
    sessionScanScope = this.getSessionScanScopeValue(),
    sessionScanSlugs = this.state.sessionScanSlugs,
    sessionScanSlugsInput = this.state.sessionScanSlugsInput,
    knownSlugs = [],
  }: any = {}) => {
    const active = normalizeSettingsSessionSlug(activeSlug);
    const available = uniqueList([
      ...knownSlugs.map((slug: any) => normalizeSettingsSessionSlug(slug)),
      active,
      '',
    ]);
    const scope = normalizeSessionScanScope(sessionScanScope || '');
    const listSlugs = this.getConfiguredSessionScanSlugs({
      sessionScanSlugs,
      sessionScanSlugsInput,
    });
    let selected: any[] = [];
    if (scope === 'all') {
      selected = available;
    } else if (scope === 'active') {
      selected = [active];
    } else if (scope === 'list') {
      selected = listSlugs.length ? listSlugs : [''];
    } else {
      selected = [''];
    }
    return uniqueList(selected.filter((slug: any) => available.includes(slug)));
  };

  getSponsoredSessionSources = ({
    activeSlug = this.getActiveSessionSlug(),
    sessionScanScope = this.getSessionScanScopeValue(),
    sessionScanSlugs = this.state.sessionScanSlugs,
    sessionScanSlugsInput = this.state.sessionScanSlugsInput,
  }: any = {}) => {
    const active = normalizeSettingsSessionSlug(activeSlug);
    const scope = normalizeSessionScanScope(sessionScanScope || '');
    const listSlugs = this.getConfiguredSessionScanSlugs({
      sessionScanSlugs,
      sessionScanSlugsInput,
    });
    const allSessionSlugs = getAllSessionSlugs({ includeEmpty: true }) || [];
    const sourceSlugs = uniqueList([
      ...allSessionSlugs.map((slug: unknown) => normalizeSettingsSessionSlug(slug)),
      active,
      '',
    ]);
    const configBySlug = new Map<string, Record<string, unknown>>();
    const sponsoredSourceSignature = sourceSlugs.map((slug: string) => {
      const cfg = this.getDisplaySessionConfig(slug);
      configBySlug.set(slug, cfg);
      return {
        slug,
        sessionName: cfg?.sessionName || cfg?.name || cfg?.title || '',
        networkChainId: cfg?.networkChainId || cfg?.chainId || '',
        sponsoredKeys: cfg?.sponsoredKeys && typeof cfg.sponsoredKeys === 'object' ? cfg.sponsoredKeys : {},
      };
    });
    const memoKey = JSON.stringify({
      active,
      scope,
      listSlugs,
      allSessionSlugs,
      sponsoredSourceSignature,
    });
    if (this._sponsoredSessionSourcesMemo?.key === memoKey) {
      return this._sponsoredSessionSourcesMemo.value;
    }
    const entries: any = new Map();
    const pushSession = (slugIn: any) => {
      const slug = normalizeSettingsSessionSlug(slugIn);
      if (entries.has(slug)) return;
      const cfg = configBySlug.has(slug) ? configBySlug.get(slug) : this.getDisplaySessionConfig(slug);
      const descriptor = this.getSessionDescriptor(slug, cfg, active);
      entries.set(slug, {
        ...descriptor,
        sponsoredKeys: cfg?.sponsoredKeys && typeof cfg.sponsoredKeys === 'object' ? cfg.sponsoredKeys : {},
      });
    };

    allSessionSlugs.forEach(pushSession);
    pushSession(active);
    pushSession('');

    const allSessions = Array.from(entries.values());
    const knownSlugs = allSessions.map((entry: any) => entry.slug);
    const rpcScopeSlugs = this.getScanScopeSessionSlugs({
      activeSlug: active,
      sessionScanScope: scope,
      sessionScanSlugs: listSlugs,
      sessionScanSlugsInput,
      knownSlugs,
    });

    const byResource = ['ai', 'arweave', 'rpc', 'txGas'].reduce((acc: any, resourceKey: any) => {
      const sponsoredKeyAliases = getSponsoredKeyAliases(resourceKey);
      acc[resourceKey] = allSessions
        .filter((entry: any) => sponsoredKeyAliases.some((alias: any) => !!entry.sponsoredKeys?.[alias]))
        .map((entry: any) => ({
          ...entry,
          inRpcScope: rpcScopeSlugs.includes(entry.slug),
        }))
        .sort((left: any, right: any) => {
          if (left.isActive && !right.isActive) return -1;
          if (!left.isActive && right.isActive) return 1;
          return left.label.localeCompare(right.label);
        });
      return acc;
    }, {});

    const value = {
      byResource,
      rpcScope: byResource.rpc.filter((entry: any) => rpcScopeSlugs.includes(entry.slug)),
    };
    this._sponsoredSessionSourcesMemo = { key: memoKey, value };
    return value;
  };

  toggleAiSettingsPanel = () => {
    this.setState((prevState: Readonly<LoginAndSettingsModal['state']>) => ({
      aiSettingsOpen: !prevState.aiSettingsOpen,
    }));
  };

  handleSessionScanScopeChange = (event: any) => {
    const nextScope = normalizeSessionScanScope(event?.target?.value || '');
    this.setState({
      sessionScanScope: nextScope,
      sessionScanStatus: '',
    });
  };

  handleSessionScanSlugToggle = (slugIn: any) => {
    const slug = normalizeSettingsSessionSlug(slugIn);
    this.setState((prevState: Readonly<LoginAndSettingsModal['state']>) => {
      const current = this.getConfiguredSessionScanSlugs(prevState);
      const next = current.includes(slug)
        ? current.filter((entry: any) => entry !== slug)
        : [...current, slug];
      return {
        sessionScanSlugs: next,
        sessionScanSlugsInput: this.formatSessionScanSlugsInput(next),
        sessionScanStatus: '',
      };
    });
  };

  handleSaveSessionScanSettings = () => {
    const desiredScope = normalizeSessionScanScope(
      this.state?.sessionScanScope ??
      this.props.selectedSessionScope ??
      readSessionScanScope()
    );
    const normalizedSlugs = this.getConfiguredSessionScanSlugs({
      sessionScanSlugs: (
        Array.isArray(this.state?.sessionScanSlugs)
          ? this.state.sessionScanSlugs
          : this.props.selectedSessionSlugs
      ),
      sessionScanSlugsInput: this.state?.sessionScanSlugsInput || '',
    });

    let finalScope = desiredScope;
    if (desiredScope === 'list' && !normalizedSlugs.length) {
      finalScope = 'general';
    }
    // Regression guard: scan-scope saves should not silently rewrite the
    // primary/default session. Only the dedicated session selector owns that.
    this.props.updateGlobalSessionSelection?.({
      selectedSessionScope: finalScope,
      selectedSessionSlugs: normalizedSlugs,
    });

    const status =
      desiredScope === 'list' && !normalizedSlugs.length
        ? 'No sessions selected; saved as general mode.'
        : 'Saved.';

    this.setState({
      sessionScanScope: finalScope,
      sessionScanSlugs: normalizedSlugs,
      sessionScanSlugsInput: this.formatSessionScanSlugsInput(normalizedSlugs),
      sessionScanStatus: status,
    });
  };

  handleResetSessionScanSettings = () => {
    this.props.updateGlobalSessionSelection?.({
      selectedSessionScope: 'general',
      selectedSessionSlugs: [],
    });
    this.setState({
      sessionScanScope: 'general',
      sessionScanSlugs: [],
      sessionScanSlugsInput: '',
      sessionScanStatus: 'Reset to general mode.',
    });
  };

  buildSessionScopeChipOptions = ({
    dataTestIdPrefix = 'ce-web3modal-session-scope',
    includePrimaryBadge = false,
  }: any = {}) => {
    const activeSessionSlug = this.getActiveSessionSlug();
    const selectedSet: any = new Set(this.getConfiguredSessionScanSlugs());
    return this.getSettingsSessionOptions(activeSessionSlug).map((descriptor: any) => ({
      key: `${dataTestIdPrefix}-${descriptor.slug || 'general'}`,
      slug: descriptor.slug,
      label: this.formatSettingsSessionOptionLabel(descriptor),
      metaText: descriptor.description !== this.formatSettingsSessionOptionLabel(descriptor)
        ? descriptor.description
        : '',
      selected: selectedSet.has(descriptor.slug),
      primary: includePrimaryBadge && normalizeSettingsSessionSlug(activeSessionSlug) === descriptor.slug,
      general: descriptor.slug === '',
      chipTestId: `${dataTestIdPrefix}-chip-${descriptor.slug || 'general'}`,
      rowTestId: `${dataTestIdPrefix}-row-${descriptor.slug || 'general'}`,
    }));
  };

  renderSessionScopeChips = ({
    dataTestIdPrefix = 'ce-web3modal-session-scope',
    includePrimaryBadge = false,
  }: any = {}) => (
    <SessionChipSelector
      options={this.buildSessionScopeChipOptions({
        dataTestIdPrefix,
        includePrimaryBadge,
      }).map((option: any) => ({
        ...option,
        onToggle: this.handleSessionScanSlugToggle,
      }))}
      emptyText="No sessions available."
      collapsedLimit={3}
      expandLabel="See more"
      collapseLabel="Show less"
      expandToggleTestId={`${dataTestIdPrefix}-expand-toggle`}
    />
  );

  renderGlobalSessionSettings = ({
    compact = false,
    sessionSelectTestId = 'ce-web3modal-session-select',
    scopePrefix = 'ce-web3modal-session-scope',
  }: any = {}) => {
    const sessionOptions = this.getSettingsSessionOptions();
    const activeSessionSlug = this.getActiveSessionSlug();
    const sessionScanScope = this.getSessionScanScopeValue();
    const selectedSessionSlugs = this.getConfiguredSessionScanSlugs();
    const selectedSessionLabels = this.buildSessionScopeChipOptions({
      dataTestIdPrefix: scopePrefix,
      includePrimaryBadge: true,
    })
      .filter((option: any) => selectedSessionSlugs.includes(option.slug))
      .map((option: any) => option.label);
    const shouldShowListValidation = sessionScanScope === 'list' && selectedSessionLabels.length === 0;

    return (
      <>
        <label className={compact ? styles.preLoginSettingsField : styles.aiSettingsRow}>
          <span className={compact ? styles.preLoginSettingsLabel : styles.aiSettingsLabel}>
            Primary session
          </span>
          <select
            aria-label="Active session"
            className={compact ? styles.preLoginSettingsInput : styles.aiSettingsSelect}
            value={activeSessionSlug}
            onChange={this.handleActiveSessionChange}
            data-testid={sessionSelectTestId}
          >
            {sessionOptions.map((descriptor: any) => (
              <option key={descriptor.slug || 'general'} value={descriptor.slug}>
                {this.formatSettingsSessionOptionLabel(descriptor)}
              </option>
            ))}
          </select>
        </label>

        <label className={compact ? styles.preLoginSettingsField : styles.aiSettingsRow}>
          <span className={compact ? styles.preLoginSettingsLabel : styles.aiSettingsLabel}>
            Selected-session scope
          </span>
          <select
            aria-label="Selected-session scope"
            className={compact ? styles.preLoginSettingsInput : styles.aiSettingsSelect}
            value={sessionScanScope}
            onChange={this.handleSessionScanScopeChange}
            data-testid={`${scopePrefix}-mode`}
          >
            <option value="all">All sessions</option>
            <option value="active">Primary session</option>
            <option value="general">General only</option>
            <option value="list">Session list</option>
          </select>
        </label>

        <div className={compact ? styles.preLoginSettingsField : `${styles.aiSettingsRow} ${styles.aiSettingsRowFull}`}>
          <span className={compact ? styles.preLoginSettingsLabel : styles.aiSettingsLabel}>
            Selected sessions
          </span>
          {this.renderSessionScopeChips({
            dataTestIdPrefix: scopePrefix,
            includePrimaryBadge: true,
          })}
          {shouldShowListValidation ? (
            <div className={compact ? styles.preLoginSettingsHint : styles.aiSettingsHint}>
              List mode needs at least one selected session.
            </div>
          ) : null}
        </div>

        {this.state.sessionScanStatus ? (
          <div className={compact ? styles.preLoginSettingsHint : styles.aiSettingsHint}>
            {this.state.sessionScanStatus}
          </div>
        ) : null}

        <div className={compact ? styles.preLoginSettingsActions : styles.aiSettingsActions}>
          <Button size="sm" color="info" onClick={this.handleSaveSessionScanSettings}>
            Save session settings
          </Button>
          <Button size="sm" color="secondary" outline onClick={this.handleResetSessionScanSettings}>
            Reset to general
          </Button>
        </div>
      </>
    );
  };

  renderPreLoginConfigPanel = () => {
    const aiSettings = this.state.aiSettings || getLocalAiSettings() || {};
    const openAiApiKey = toStr(aiSettings?.providers?.openai?.apiKey || '');
    const anthropicApiKey = toStr(aiSettings?.providers?.anthropic?.apiKey || '');
    const customRpcUrl = toStr(aiSettings?.providers?.custom?.rpcUrl || '');

    return (
      <div className={styles.preLoginSettingsConfigPanel} data-testid="ce-prelogin-config-panel">
        {this.renderGlobalSessionSettings({
          compact: true,
          sessionSelectTestId: 'ce-prelogin-session-select',
          scopePrefix: 'ce-prelogin-session-scope',
        })}
        <div className={styles.preLoginSettingsTitle}>AI settings</div>
        <label className={styles.preLoginSettingsField}>
          <span className={styles.preLoginSettingsLabel}>OpenAI API key</span>
          <input
            type="password"
            className={styles.preLoginSettingsInput}
            value={openAiApiKey}
            onChange={(event: any) => this.handlePreLoginAiProviderKeyChange('openai', event)}
            placeholder="sk-..."
          />
        </label>
        <label className={styles.preLoginSettingsField}>
          <span className={styles.preLoginSettingsLabel}>Anthropic API key</span>
          <input
            type="password"
            className={styles.preLoginSettingsInput}
            value={anthropicApiKey}
            onChange={(event: any) => this.handlePreLoginAiProviderKeyChange('anthropic', event)}
            placeholder="sk-ant-..."
          />
        </label>
        <label className={styles.preLoginSettingsField}>
          <span className={styles.preLoginSettingsLabel}>AI endpoint</span>
          <input
            type="text"
            className={styles.preLoginSettingsInput}
            value={customRpcUrl}
            onChange={this.handlePreLoginAiEndpointChange}
            placeholder="https://your-ai-endpoint.example/v1"
          />
        </label>
        <div className={styles.preLoginSettingsHint}>
          Anthropic powers local text tasks here. Audio and transcription still use local OpenAI, session defaults, or a custom endpoint until downloadable local transcription lands.
        </div>
      </div>
    );
  };

  getSettingsOverviewContext = () => {
    const walletNet = (this.props.provider === 'wagmi' ? this.props.wagmiNetwork : this.props.network);
    const tn = this.getTargetNetwork();
    const targetNetworkName = tn?.name || 'not configured';
    const walletNetworkName = walletNet?.name || 'not connected';
    const corrId = Number(tn.id);
    const isCorrectNetwork = (walletNet?.id === corrId);
    const needsNetworkSwitch = this.props.provider === 'wagmi' && !isCorrectNetwork && this.props.loginComplete;
    const showWalletNetwork = this.props.provider === 'wagmi' && !!walletNet && walletNet?.id !== corrId;
    const sessionSlug = this.getActiveSessionSlug();
    const sessionConfig = this.getDisplaySessionConfig(sessionSlug);
    const activeSession = this.getSessionDescriptor(sessionSlug, sessionConfig);
    const sponsoredAccess = this.state.sponsoredAccess || {};
    const sponsorSessions = this.getSponsoredSessionSources({ activeSlug: sessionSlug });
    const memoKey = JSON.stringify({
      activeSession,
      loginComplete: this.props.loginComplete,
      provider: this.props.provider,
      selectedSessionScope: this.props.selectedSessionScope,
      selectedSessionSlugs: this.props.selectedSessionSlugs || [],
      sessionScanScope: this.getSessionScanScopeValue(),
      sessionScanSlugs: this.state.sessionScanSlugs,
      sessionScanSlugsInput: this.state.sessionScanSlugsInput,
      sponsoredAccess,
      sponsorSessions,
      targetNetworkId: tn?.id,
      targetNetworkName,
      walletNetworkId: walletNet?.id,
      walletNetworkName,
    });
    if (this._settingsOverviewMemo?.key === memoKey) {
      return this._settingsOverviewMemo.value;
    }
    const sponsorshipCards = buildLoginSettingsSponsorshipCards({
      activeSession,
      sponsoredAccess,
      sponsorSessions,
    });

    const value = {
      activeSession,
      cryptoTerminology: isCryptoMode(),
      needsNetworkSwitch,
      showWalletNetwork,
      sponsorshipCards,
      sponsorSessions,
      targetNetworkName,
      targetNetwork: tn,
      walletNetworkName,
    };
    this._settingsOverviewMemo = { key: memoKey, value };
    return value;
  };

  renderInlineNetworkSummary = ({
    targetNetworkName = 'not configured',
    walletNetworkName = 'not connected',
    showWalletNetwork = false,
    tooltipId = 'networkInfoTooltipInline',
  }: any = {}) => {
    return LoginSettingsInlineNetworkSummary({
      targetNetworkName,
      walletNetworkName,
      showWalletNetwork,
      tooltipId,
    });
  };

  renderPanelNetworkSummary = ({
    targetNetwork = null,
    targetNetworkName = 'not configured',
    walletNetworkName = 'not connected',
    showWalletNetwork = false,
    needsNetworkSwitch = false,
    tooltipId = 'networkInfoTooltipPanel',
  }: any = {}) => {
    return LoginSettingsPanelNetworkSummary({
      targetNetwork,
      targetNetworkName,
      walletNetworkName,
      showWalletNetwork,
      needsNetworkSwitch,
      tooltipId,
      onSwitchNetwork: this.switchToCorrectNetwork,
    });
  };

  getPrimarySponsorSession = (sessions: any = []) => {
    const list = Array.isArray(sessions) ? sessions : [];
    return list.find((entry: any) => entry?.isActive) || list[0] || null;
  };

  formatResourceSponsorHint = ({
    resourceKey = '',
    resourceLabel = '',
    sponsoredKeys = {},
    sponsorSessions = {},
  }: any = {}) => formatLoginSettingsResourceSponsorHint({
    resourceKey,
    resourceLabel,
    sponsoredKeys,
    sponsorSessions,
  });

  renderSupportedResourceCard = (card: any) => {
    const activeSession = card?.activeSession || this.getSessionDescriptor(this.getActiveSessionSlug());
    const activeSponsorSession = card?.activeSponsorSession || null;
    const extraSessions = Array.isArray(card?.otherSponsorSessions)
      ? card.otherSponsorSessions
      : (Array.isArray(card?.sessions) ? card.sessions.filter((entry: any) => !entry?.isActive) : []);
    const extrasExpanded = !!this.state.expandedSponsorResources?.[card.key];
    const extraCount = extraSessions.length;

    return (
      <LoginSettingsSupportedResourceCard
        key={card.key}
        activeSession={activeSession}
        activeSponsorSession={activeSponsorSession}
        card={card}
        extraSessions={extraSessions}
        extrasExpanded={extrasExpanded}
        onToggleSessions={this.toggleSupportedResourceSessions}
      />
    );
  };

  renderStaticSettingsSection = ({
    title = '',
    summary = '',
    children = null,
  }: any = {}) => (
    <LoginSettingsSectionCard title={title} summary={summary}>
      {children}
    </LoginSettingsSectionCard>
  );

  renderSettingsOverviewPanel = ({
    overview = this.getSettingsOverviewContext(),
    extraContent = null,
    networkTooltipId = 'networkInfoTooltipPanel',
    showPanelNetwork = !overview.cryptoTerminology,
  }: any = {}) => (
    <div className={styles.aiSettingsPanel}>
      {showPanelNetwork ? this.renderPanelNetworkSummary({
        targetNetwork: overview.targetNetwork,
        targetNetworkName: overview.targetNetworkName,
        walletNetworkName: overview.walletNetworkName,
        showWalletNetwork: overview.showWalletNetwork,
        needsNetworkSwitch: overview.needsNetworkSwitch,
        tooltipId: networkTooltipId,
      }) : null}
      <div className={styles.supportedResourcesGrid}>
        {overview.sponsorshipCards.map(this.renderSupportedResourceCard)}
      </div>
      {extraContent}
    </div>
  );

  getSettingsDisplay = () => {
    const overview = this.getSettingsOverviewContext();
    const {
      activeSession,
      cryptoTerminology,
      needsNetworkSwitch,
      sponsorSessions,
      targetNetwork,
    } = overview;

    const aiLocal = this.state.aiSettings || getLocalAiSettings() || {};
    const sessionSlug = this.getActiveSessionSlug();
    const aiGroup = this.state.aiGroupSettings || getSessionAiSettings(sessionSlug) || {};
    const sessionConfig = this.getDisplaySessionConfig(sessionSlug);
    const sponsoredKeys = sessionConfig?.sponsoredKeys || {};
    const useLocalAi = !!aiLocal.useLocal;
    const aiDisplay = useLocalAi ? aiLocal : aiGroup;
    const resourceKeys = this.state.resourceKeys || getLocalSessionResourceKeys(sessionSlug) || {};
    const useLocalRpc = !!resourceKeys?.rpc?.useLocal;
    const useLocalArweave = !!resourceKeys?.arweave?.useLocal;
    const aiProvider = String(aiDisplay.mode || 'openai').toLowerCase();
    const localProvider = String(aiLocal.mode || 'openai').toLowerCase();
    const aiProviderLabel = formatLoginSettingsAiProviderLabel(aiProvider);
    const aiPresetKey = aiDisplay?.preset || (
      (
        aiDisplay?.models?.fast ||
        aiDisplay?.models?.thinking ||
        aiDisplay?.mode
      )
        ? deriveAiPresetKey(aiDisplay)
        : 'gpt-5'
    );
    const aiPresetLabel = formatAiPresetBadgeLabel(aiDisplay);
    const showReasoningControls = settingsSupportReasoning(aiDisplay);
    const reasoningEffort = toStr(aiDisplay.reasoningEffort || DEFAULT_REASONING_EFFORT).trim().toLowerCase() || DEFAULT_REASONING_EFFORT;
    const taskReasoningEffort = aiDisplay.taskReasoningEffort || {};
    const isPerTaskOpen = this.isAiSettingsSectionOpen('aiPerTask');
    const isAdvancedOpen = this.isAiSettingsSectionOpen('aiAdvanced');
    const providerDisplayEntry = aiDisplay.providers?.[aiProvider] || {};
    const providerLocalEntry = aiLocal.providers?.[localProvider] || {};
    const sponsoredAccess = this.state.sponsoredAccess || {};
    const aiAccess = sponsoredAccess.ai || null;
    const aiAccessStatus = aiAccess?.status || '';
    const aiAccessIsConfirmedLocked = (
      aiAccessStatus === 'denied' ||
      aiAccessStatus === 'needs-wallet' ||
      aiAccessStatus === 'invalid-gate'
    );
    const keyPlaceholder = useLocalAi
      ? 'Enter API key'
      : (sponsoredKeys.ai
          ? (
            aiAccessStatus === 'granted'
              ? 'Sponsored key configured (unlocked)'
              : (aiAccessIsConfirmedLocked ? 'Sponsored key configured (SBT required)' : 'Sponsored key configured')
          )
          : 'No sponsored key set');

    const transcriptionProvider = String(aiDisplay.transcription?.provider || 'openai').toLowerCase();
    const showCustomFields = aiProvider === 'custom';
    const showCustomTranscription = transcriptionProvider === 'custom';
    const sessionScanScope = this.getSessionScanScopeValue();
    const normalizedScanList = this.getConfiguredSessionScanSlugs();
    const usingSessionDefaultsLabel = !useLocalAi
      ? `Session defaults from ${aiGroup._sessionName || activeSession.label}.`
      : 'Local override active in this browser.';
    const sessionDefaultBadgeText = !useLocalAi
      ? `Using session default: ${formatAiPresetBadgeLabel(aiGroup)}`
      : 'Using local override';
    const providerKeyHint = !useLocalAi && providerDisplayEntry.encryptedApiKey
      ? (
        aiAccessStatus === 'granted'
          ? 'Encrypted session key is ready and the current wallet satisfies the sponsor gate.'
          : (aiAccessStatus === 'denied'
            ? 'Encrypted session key exists, but this wallet still needs the sponsor SBT gate.'
            : 'Encrypted session key is available for this session.')
      )
      : '';

    const renderSection = ({ key, title, summary, children }: any) => {
      const isOpen = this.isAiSettingsSectionOpen(key);
      return (
        <LoginSettingsSectionCard
          title={title}
          summary={summary}
          isOpen={isOpen}
          onToggle={() => this.toggleAiSettingsSection(key)}
        >
          {children}
        </LoginSettingsSectionCard>
      );
    };

    return (
      <div>
        {this.renderSettingsControlRow({
          activeSession,
          configOpen: this.state.aiSettingsOpen,
          onToggleConfig: this.toggleAiSettingsPanel,
          betweenSessionAndTooltips: cryptoTerminology ? this.renderInlineNetworkSummary({
            targetNetworkName: overview.targetNetworkName,
            walletNetworkName: overview.walletNetworkName,
            showWalletNetwork: overview.showWalletNetwork,
            tooltipId: 'networkInfoTooltipInline',
          }) : null,
          afterDemo: cryptoTerminology && needsNetworkSwitch ? (
            <Button onClick={this.switchToCorrectNetwork} className={`${styles.networkSwitchButton} ${styles.glow}`}>
              Switch to {targetNetwork?.name || overview.targetNetworkName}
            </Button>
          ) : null,
          tooltipsInfoId: 'postLoginTooltipsToggleTooltip',
          tooltipPlacement: 'right',
        })}

        {this.state.aiSettingsOpen && (
          this.renderSettingsOverviewPanel({
            overview,
            networkTooltipId: 'networkInfoTooltipPanel',
            extraContent: (
              <>
            {renderSection({
              key: 'session',
              title: 'Session',
              summary: `${activeSession.label} · ${sessionScanScope === 'list' ? `${normalizedScanList.length} listed` : sessionScanScope}`,
              children: (
                <>
                  <div className={styles.aiSettingsGrid}>
                    {this.renderGlobalSessionSettings({
                      compact: false,
                      sessionSelectTestId: 'ce-web3modal-session-select',
                      scopePrefix: 'ce-web3modal-session-scope',
                    })}
                  </div>
                </>
              ),
            })}

            {renderSection({
              key: 'aiConfig',
              title: 'AI config',
              summary: `${useLocalAi ? 'Local override on' : 'Using session defaults'} · ${aiPresetLabel}`,
              children: (
                <>
                  <label className={styles.aiSettingsInlineToggle}>
                    <input
                      type="checkbox"
                      checked={useLocalAi}
                      onChange={this.handleAiToggleLocal}
                    />
                    <span>Use local override</span>
                  </label>
                  <div className={styles.aiSessionDefault}>
                    <span>{sessionDefaultBadgeText}</span>
                    {useLocalAi ? (
                      <Button
                        size="sm"
                        color="secondary"
                        outline
                        onClick={this.handleClearAiSettings}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                  <div className={styles.aiSettingsGrid}>
                    <div className={styles.aiSettingsRow}>
                      <label className={styles.aiSettingsLabel}>Model preset</label>
                      <select
                        className={`${styles.aiSettingsSelect} ${styles.aiPresetSelect}`}
                        value={aiPresetKey}
                        onChange={this.handleAiPresetChange}
                        disabled={!useLocalAi}
                      >
                        {AI_PRESET_OPTIONS.map((option: any) => (
                          <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                      </select>
                      <div className={styles.aiSettingsHint}>
                        Presets keep provider and model selection in sync. Choose Custom to edit provider/model details directly.
                      </div>
                    </div>

                    <div className={styles.aiSettingsRow}>
                      <label className={styles.aiSettingsLabel}>API key ({aiProviderLabel})</label>
                      <input
                        className={styles.aiSettingsInput}
                        type="password"
                        value={useLocalAi ? (providerLocalEntry.apiKey || '') : ''}
                        placeholder={keyPlaceholder}
                        onChange={(e: any) => this.updateAiProviderField(localProvider, 'apiKey', e.target.value)}
                        disabled={!useLocalAi}
                      />
                      {providerKeyHint ? <div className={styles.aiSettingsHint}>{providerKeyHint}</div> : null}
                    </div>
                  </div>

                  {showReasoningControls && (
                    <>
                      <div className={styles.aiReasoningControl}>
                        <label className={styles.aiSettingsLabel}>Reasoning effort</label>
                        <div className={styles.aiReasoningButtons}>
                          {AI_REASONING_LEVELS.map((level: any) => (
                            <button
                              key={level}
                              type="button"
                              className={`${styles.aiReasoningBtn} ${reasoningEffort === level ? styles.aiReasoningBtnActive : ''}`}
                              onClick={() => this.updateAiSettings((s: any) => ({ ...s, reasoningEffort: level }))}
                              disabled={!useLocalAi}
                              aria-pressed={reasoningEffort === level}
                            >
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                          ))}
                        </div>
                        <div className={styles.aiSettingsHint}>
                          Applied only to GPT-5 and OpenAI-compatible reasoning models.
                        </div>
                      </div>

                      <div className={styles.aiPerTaskSection}>
                        <button
                          type="button"
                          className={styles.aiAdvancedToggle}
                          onClick={() => this.toggleAiSettingsSection('aiPerTask')}
                          aria-expanded={isPerTaskOpen}
                        >
                          <span>Per-Task Reasoning</span>
                          <FontAwesomeIcon
                            icon={isPerTaskOpen ? faCaretUp : faCaretDown}
                            className={styles.aiSettingsToggleIcon}
                          />
                        </button>
                        {isPerTaskOpen && (
                          <div className={styles.aiSettingsGrid}>
                            {AI_TASK_REASONING_ROWS.map((row: any) => (
                              <div key={row.key} className={styles.aiPerTaskRow}>
                                <div>
                                  <label className={styles.aiSettingsLabel}>{row.label}</label>
                                  <div className={styles.aiSettingsHint}>{row.hint}</div>
                                </div>
                                <select
                                  className={styles.aiSettingsSelect}
                                  value={taskReasoningEffort?.[row.key] || ''}
                                  onChange={(e: any) => this.updateAiTaskReasoningField(row.key, e.target.value)}
                                  disabled={!useLocalAi}
                                >
                                  <option value="">Global default</option>
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div>
                    <button
                      type="button"
                      className={styles.aiAdvancedToggle}
                      onClick={() => this.toggleAiSettingsSection('aiAdvanced')}
                      aria-expanded={isAdvancedOpen}
                    >
                      <span>Advanced</span>
                      <FontAwesomeIcon
                        icon={isAdvancedOpen ? faCaretUp : faCaretDown}
                        className={styles.aiSettingsToggleIcon}
                      />
                    </button>
                    {isAdvancedOpen && (
                      <div className={styles.aiSettingsGrid}>
                        <div className={styles.aiSettingsRow}>
                          <label className={styles.aiSettingsLabel}>Provider</label>
                          <select
                            className={styles.aiSettingsSelect}
                            value={aiDisplay.mode || 'openai'}
                            onChange={this.handleAiModeChange}
                            disabled={!useLocalAi}
                          >
                            <option value="anthropic">Anthropic</option>
                            <option value="openai">OpenAI</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="custom">Custom RPC</option>
                          </select>
                        </div>

                        <div className={styles.aiSettingsRow}>
                          <label className={styles.aiSettingsLabel}>Fast model</label>
                          <input
                            className={styles.aiSettingsInput}
                            type="text"
                            value={aiDisplay.models?.fast || ''}
                            onChange={(e: any) => this.updateAiModelField('fast', e.target.value)}
                            disabled={!useLocalAi}
                          />
                        </div>

                        <div className={styles.aiSettingsRow}>
                          <label className={styles.aiSettingsLabel}>Thinking model</label>
                          <input
                            className={styles.aiSettingsInput}
                            type="text"
                            value={aiDisplay.models?.thinking || ''}
                            onChange={(e: any) => this.updateAiModelField('thinking', e.target.value)}
                            disabled={!useLocalAi}
                          />
                        </div>

                        {showCustomFields && (
                          <>
                            <div className={styles.aiSettingsRow}>
                              <label className={styles.aiSettingsLabel}>Custom RPC URL</label>
                              <input
                                className={styles.aiSettingsInput}
                                type="text"
                                value={aiDisplay.providers?.custom?.rpcUrl || ''}
                                onChange={(e: any) => this.updateAiProviderField('custom', 'rpcUrl', e.target.value)}
                                disabled={!useLocalAi}
                              />
                            </div>
                            <div className={`${styles.aiSettingsRow} ${styles.aiSettingsRowFull}`}>
                              <label className={styles.aiSettingsLabel}>Functions JSON</label>
                              <textarea
                                className={styles.aiSettingsTextarea}
                                value={aiDisplay.providers?.custom?.functions || ''}
                                onChange={(e: any) => this.updateAiProviderField('custom', 'functions', e.target.value)}
                                disabled={!useLocalAi}
                              />
                            </div>
                          </>
                        )}

                        <div className={styles.aiSettingsRow}>
                          <label className={styles.aiSettingsLabel}>Transcription provider</label>
                          <select
                            className={styles.aiSettingsSelect}
                            value={aiDisplay.transcription?.provider || 'openai'}
                            onChange={(e: any) => this.updateAiTranscriptionField('provider', e.target.value)}
                            disabled={!useLocalAi}
                          >
                            <option value="openai">OpenAI</option>
                            <option value="custom">Custom RPC</option>
                            <option value="local">Local (future)</option>
                          </select>
                        </div>

                        <div className={styles.aiSettingsRow}>
                          <label className={styles.aiSettingsLabel}>Transcription model</label>
                          <input
                            className={styles.aiSettingsInput}
                            type="text"
                            value={aiDisplay.transcription?.model || ''}
                            onChange={(e: any) => this.updateAiTranscriptionField('model', e.target.value)}
                            disabled={!useLocalAi}
                          />
                        </div>

                        {showCustomTranscription && (
                          <div className={styles.aiSettingsRow}>
                            <label className={styles.aiSettingsLabel}>Transcription RPC URL</label>
                            <input
                              className={styles.aiSettingsInput}
                              type="text"
                              value={aiDisplay.transcription?.rpcUrl || ''}
                              onChange={(e: any) => this.updateAiTranscriptionField('rpcUrl', e.target.value)}
                              disabled={!useLocalAi}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={styles.aiSettingsFooterRow}>
                    <div className={styles.aiSettingsStatus}>
                      {usingSessionDefaultsLabel}
                      {this.state.aiSettingsStatus ? ` ${this.state.aiSettingsStatus}` : ''}
                    </div>
                    <div className={styles.aiSettingsActions}>
                      <Button
                        size="sm"
                        color="info"
                        onClick={this.handleSaveAiSettings}
                        disabled={!this.state.aiSettingsDirty}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        color="secondary"
                        outline
                        onClick={this.handleClearAiSettings}
                      >
                        Clear local
                      </Button>
                    </div>
                  </div>
                </>
              ),
            })}

            {renderSection({
              key: 'resourceKeys',
              title: 'Resource keys',
              summary: `${useLocalRpc || useLocalArweave ? 'Local key overrides enabled' : 'Using session-sponsored fallbacks'}`,
              children: (
                <>
                  <div className={styles.aiSettingsGrid}>
                    <div className={styles.aiSettingsRow}>
                      <label className={styles.aiSettingsLabel}>RPC API key</label>
                      <input
                        className={styles.aiSettingsInput}
                        type="password"
                        value={useLocalRpc ? (resourceKeys?.rpc?.apiKey || '') : ''}
                        onChange={(e: any) => this.updateResourceKeyField('rpc', 'apiKey', e.target.value)}
                        disabled={!useLocalRpc}
                        placeholder={useLocalRpc ? 'Enter RPC API key' : (sponsoredKeys.rpc ? 'Sponsored key configured' : 'No sponsored key set')}
                      />
                      <label className={styles.aiSettingsInlineToggle}>
                        <input
                          type="checkbox"
                          checked={useLocalRpc}
                          onChange={(e: any) => this.handleResourceToggleLocal('rpc', e)}
                        />
                        <span>Use local override</span>
                      </label>
                      <div className={styles.aiSettingsHint}>
                        {this.formatResourceSponsorHint({
                          resourceKey: 'rpc',
                          resourceLabel: 'RPC',
                          sponsoredKeys,
                          sponsorSessions,
                        })}
                      </div>
                    </div>

                    <div className={`${styles.aiSettingsRow} ${styles.aiSettingsRowFull}`}>
                      <label className={styles.aiSettingsLabel}>Arweave JWK (JSON)</label>
                      <textarea
                        className={styles.aiSettingsTextarea}
                        value={useLocalArweave ? (resourceKeys?.arweave?.jwk || '') : ''}
                        onChange={(e: any) => this.updateResourceKeyField('arweave', 'jwk', e.target.value)}
                        disabled={!useLocalArweave}
                        placeholder={useLocalArweave ? '{ "kty": "...", ... }' : (sponsoredKeys.arweave ? 'Sponsored key configured' : 'No sponsored key set')}
                      />
                      <label className={styles.aiSettingsInlineToggle}>
                        <input
                          type="checkbox"
                          checked={useLocalArweave}
                          onChange={(e: any) => this.handleResourceToggleLocal('arweave', e)}
                        />
                        <span>Use local override</span>
                      </label>
                      <div className={styles.aiSettingsHint}>
                        {this.formatResourceSponsorHint({
                          resourceKey: 'arweave',
                          resourceLabel: 'Arweave',
                          sponsoredKeys,
                          sponsorSessions,
                        })}
                      </div>
                    </div>
                  </div>
                  <div className={styles.aiSettingsFooterRow}>
                    <div className={styles.aiSettingsStatus}>
                      {this.state.resourceKeysStatus || 'Stored locally; only sent on the request that needs them.'}
                    </div>
                    <div className={styles.aiSettingsActions}>
                      <Button
                        size="sm"
                        color="info"
                        onClick={this.handleSaveResourceKeys}
                        disabled={!this.state.resourceKeysDirty}
                      >
                        Save keys
                      </Button>
                      <Button
                        size="sm"
                        color="secondary"
                        outline
                        onClick={this.handleClearResourceKeys}
                      >
                        Clear keys
                      </Button>
                    </div>
                  </div>
                </>
              ),
            })}

              </>
            ),
          })
        )}
      </div>
    );
  };

  shouldComponentUpdate(nextProps: any, nextState: any) {
    const wagmiBalanceChanged = !this.areWalletBalanceInputsEqual(
      this.getWagmiBalanceInput(nextProps),
      this.getWagmiBalanceInput(this.props)
    );
    return (
      nextProps.loginInProgress !== this.props.loginInProgress ||
      nextProps.loginComplete   !== this.props.loginComplete   ||
      nextProps.loginModalToggled !== this.props.loginModalToggled ||
      nextProps.provider        !== this.props.provider        ||
      nextProps.account         !== this.props.account         ||
      nextProps.activeSessionSlug !== this.props.activeSessionSlug ||
      nextProps.selectedSessionScope !== this.props.selectedSessionScope ||
      JSON.stringify(nextProps.selectedSessionSlugs || []) !== JSON.stringify(this.props.selectedSessionSlugs || []) ||
      nextProps.demoSurfaceMode !== this.props.demoSurfaceMode ||
      nextProps.tooltipsEnabled !== this.props.tooltipsEnabled ||
      nextProps.network?.id     !== this.props.network?.id     ||
      this.state               !== nextState                  ||
      nextProps.wagmiNetwork?.id !== this.props.wagmiNetwork?.id ||
      nextProps.wagmiAddress     !== this.props.wagmiAddress     ||
      wagmiBalanceChanged
    );
  }

  openLoginModal = () => {
    document.body.classList.add('modal-open');
    this.props.toggleLoginModal(true);
  };

  closeLoginModal = () => {
    document.body.classList.remove('modal-open');
    this.props.toggleLoginModal(false);
    if (this.state.firstModalAfterLogin === true) {
      this.setState({ firstModalAfterLogin: false })
    }
  };

  updateStateUponWagmiLogin = async () => {
    const wagmiAddr = (this.props.wagmiAddress || '').toLowerCase();
    const reduxAddr = (this.props.account || '').toLowerCase();
    const reduxIsWagmi = this.props.provider === 'wagmi' && this.props.loginComplete === true;

    if (wagmiAddr && reduxIsWagmi && reduxAddr === wagmiAddr) {
      this.setState({ wagmiLoginUpdateNeeded: false });
      return;
    }

    if (this.state.wagmiLoginUpdateNeeded && wagmiAddr && !reduxIsWagmi) {
      this.startPasskeyWalletAction();
      this.setState({ wagmiLoginUpdateNeeded: false });
      this.props.updateLoginInfo({ loginInProgress: true, loginComplete: false, provider: 'wagmi' });
      try {
        const web3info = {
          account: this.props.wagmiAddress,
          provider: 'wagmi',
          network: this.props.wagmiNetwork,
        };
        this.props.changeAccount(web3info);
        this.props.updateLoginInfo({ loginInProgress: false, loginComplete: true, provider: 'wagmi' });
      } catch (err) {
        accountLog.error('updateStateUponWagmiLogin:', err);
        this.props.updateLoginInfo({ loginInProgress: false, loginComplete: false, provider: null });
        this.setState({ wagmiLoginUpdateNeeded: true });
      }
      return;
    }

    if (!wagmiAddr && this.props.provider === 'wagmi') {
      this.startPasskeyWalletAction();
      this.props.updateLoginInfo({ loginInProgress: false, loginComplete: false, provider: null });
      this.props.changeAccount({});
      this.setState({ wagmiLoginUpdateNeeded: false });
    }
  };

  openCryptoModal = () => {
    const { openConnectModal, openAccountModal, wagmiAddress, loginComplete } = this.props;
    try {
      if (wagmiAddress || loginComplete) {
        if (openAccountModal) openAccountModal();
        else if (openConnectModal) openConnectModal();
      } else if (openConnectModal) {
        openConnectModal();
      }
    } catch (e) {
      accountLog.error("Failed to open RainbowKit modal:", e);
    }
  };

  renderTooltipsToggleControl = ({ infoId, tooltipPlacement = 'top' }: any) => {
    const tooltipsEnabled = this.props.tooltipsEnabled !== false;

    return (
      <div className={styles.tooltipsToggleControl}>
        <Button
          type="button"
          onClick={() => this.props.toggleTooltips?.()}
          className={`${styles.sendTestnetFundsButton} ${styles.aiSettingsToggleButton} ${styles.tooltipsToggleButton}`}
          aria-pressed={tooltipsEnabled}
        >
          Explainers {tooltipsEnabled ? 'On' : 'Off'}
        </Button>
        {tooltipsEnabled ? (
          <>
            <FontAwesomeIcon
              icon={faQuestionCircle}
              className={`${styles.infoIcon} ${styles.tooltipsToggleInfoIcon}`}
              id={infoId}
            />
            <CETooltip
              placement={tooltipPlacement}
              target={infoId}
              delay={0}
              trigger="hover click focus"
              autohide={false}
              className={styles.networkTooltip}
            >
              <div style={{ padding: '10px' }}>
                Toggle explainers throughout the app.
              </div>
            </CETooltip>
          </>
        ) : null}
      </div>
    );
  };

  renderDemoSurfaceToggleControl = () => {
    const demoSurfaceEnabled = this.props.demoSurfaceMode !== false;

    return (
      <div className={styles.tooltipsToggleControl}>
        <Button
          type="button"
          onClick={() => this.props.setDemoSurfaceMode?.(!demoSurfaceEnabled)}
          className={`${styles.sendTestnetFundsButton} ${styles.aiSettingsToggleButton} ${styles.tooltipsToggleButton}`}
          aria-pressed={demoSurfaceEnabled}
        >
          Demo Mode {demoSurfaceEnabled ? 'On' : 'Off'}
        </Button>
      </div>
    );
  };

  getPreLoginSettingsDisplay = () => {
    const overview = this.getSettingsOverviewContext();
    const { activeSession, cryptoTerminology } = overview;

    return (
      <div className={styles.preLoginSettingsShell}>
        <div className={styles.preLoginSettingsTopRow}>
          <button
            type="button"
            aria-label="Toggle pre-login settings"
            className={styles.preLoginSettingsGear}
            onClick={this.togglePreLoginSettingsPanel}
            aria-expanded={this.state.preLoginSettingsOpen}
          >
            <FontAwesomeIcon icon={faCog} />
          </button>
        </div>
        {this.state.preLoginSettingsOpen ? (
          <div className={styles.preLoginSettingsPanel} data-testid="ce-prelogin-settings-panel">
            {this.renderSettingsControlRow({
              activeSession,
              configOpen: this.state.preLoginConfigOpen,
              onToggleConfig: this.togglePreLoginConfigPanel,
              configTestId: 'ce-prelogin-config-toggle',
              betweenSessionAndTooltips: cryptoTerminology ? this.renderInlineNetworkSummary({
                targetNetworkName: overview.targetNetworkName,
                walletNetworkName: overview.walletNetworkName,
                showWalletNetwork: overview.showWalletNetwork,
                tooltipId: 'preLoginNetworkInfoTooltipInline',
              }) : null,
              tooltipsInfoId: 'preLoginTooltipsToggleTooltip',
              tooltipPlacement: 'right',
              containerClassName: styles.preLoginSettingsSummaryContainer,
            })}
            {this.renderSettingsOverviewPanel({
              overview,
              networkTooltipId: 'preLoginNetworkInfoTooltipPanel',
              extraContent: this.state.preLoginConfigOpen
                ? this.renderStaticSettingsSection({
                  title: 'Config',
                  summary: 'Session selection and local AI overrides',
                  children: this.renderPreLoginConfigPanel(),
                })
                : null,
            })}
          </div>
        ) : null}
      </div>
    );
  };

  openBookmarks = () => {
    this.closeLoginModal();
    if (typeof window !== 'undefined') {
      window.location.href = buildBookmarksRoutePath();
    }
  };

  getModalDisplay = () => {
    const activeChain = this.props.wagmiNetwork || this.props.network || this.getTargetNetwork();
    const showTestnetOnly = !!activeChain?.testnet;

    // Login view
    if (!this.props.loginComplete && !this.props.loginInProgress) {
      return (
        <CardBody>
          <div className={styles.accountWarningContainer}>
            <div className={styles.accountWarningMessage}>
              <p>
                Account is an{" "}
                <a href="https://ethereum.org/en/wallets/" target="_blank" rel="noopener noreferrer">Ethereum wallet</a>:
              </p>
              <ul>
                <li>controlled by you</li>
                <li>no password</li>
                {showTestnetOnly && <li>test network only</li>}
              </ul>
            </div>

            {/* Passkey wallet buttons */}
             <div className={styles.passkeyButtonContainer}>
               <Button
                  onClick={this.handlePasskeyWalletCreate}
                  color="primary"
                  className={`${styles.passkeyButton} ${styles.passkeyButtonPrimary}`}
                >
                  <FontAwesomeIcon icon={faFingerprint} size="2x" />
                  <span>Create  </span>
               </Button>
               <Button
                  onClick={this.handlePasskeyWalletSignIn}
                  color="secondary"
                  outline
                  className={`${styles.passkeyButton} ${styles.passkeyButtonOutline}`}
                >
                  <FontAwesomeIcon icon={faFingerprint} size="2x" />
                  <span> Login</span>
               </Button>
            </div>
            {this.state.passkeyWalletStatusMessage && (
              <div
                className={`${styles.passkeyWalletStatus} ${
                  this.state.passkeyWalletStatusTone === 'error' ? styles.passkeyWalletStatusError : ''
                }`}
                role="status"
                data-testid="ce-passkey-wallet-status"
              >
                {this.state.passkeyWalletStatusMessage}
              </div>
            )}

            <button
              type="button"
              aria-label="Open Crypto Login (RainbowKit)"
              onClick={this.openCryptoModal}
              className={styles.cryptoLoginLink}
            >
              <img src={MetaMaskLogo} alt="MetaMask" className={styles.cryptoLoginIcon} />
            </button>
          </div>
        </CardBody>
      );
    }

    if (this.props.loginInProgress) {
      return (
        <CardBody>
          <div id={styles.loadingIconContainer}>
            <h3 id={styles.verifyingText}> logging in... </h3>
            <FontAwesomeIcon icon={faSpinner} pulse id={styles.verifyingTXloadingIcon} />
          </div>
        </CardBody>
      );
    }

    // Logged-in view for all providers (passkey wallet, Wagmi)
    if (this.props.loginComplete) {
      const activeSessionSlug = this.getActiveSessionSlug();
      const activeSessionConfig = this.getDisplaySessionConfig(activeSessionSlug);
       return (
        <CardBody id={styles.accountModalCard}>
          <div id={styles.accountModalPanel}>
            <div className={styles.accountModalBody}>
              {this.props.account && (
                <div className={styles.accountModalProfileShell}>
                  <Suspense fallback={null}>
                    <AccountUserPage
                      viewAddress={this.props.account}
                      account={this.props.account}
                      provider={this.props.provider}
                      minimized={true}
                      network={this.props.network}
                      activeSessionSlug={activeSessionSlug}
                      sessionConfig={activeSessionConfig}
                      networkChainId={activeSessionConfig?.networkChainId}
                    />
                  </Suspense>
                </div>
              )}
              <div className={styles.accountModalControls}>
                <Button color="secondary" size="sm" onClick={this.openBookmarks} className={styles.walletButton}>
                  <FontAwesomeIcon icon={faBookmark} /> Bookmarks
                </Button>
                <Button color="danger" size="sm" onClick={this.handleLogout} className={styles.disconnectButton}>
                  <FontAwesomeIcon icon={faSignOutAlt} /> Disconnect
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      );
    }

    return <CardBody><p>Please log in.</p></CardBody>;
  }

  getModalTitle = () => {
    if (!this.props.loginComplete && !this.props.loginInProgress) return "LOGIN";
    if (this.props.loginInProgress) return "ACCOUNT";
    if (this.props.loginComplete) return "ACCOUNT";
    return "CONNECT";
  }

  render() {
    const modalTitle = this.getModalTitle();
    const modalContent = this.getModalDisplay();
    const settingsFooterContent = this.props.loginComplete ? this.getSettingsDisplay() : null;
    const preLoginFooterContent = (!this.props.loginComplete && !this.props.loginInProgress)
      ? this.getPreLoginSettingsDisplay()
      : null;

    return (
      <div id={styles.loginModal}>
        <Modal
          isOpen={this.props.loginModalToggled}
          modalClassName="modal-login"
          className={styles.web3ModalDialog}
          contentClassName={styles.web3ModalContent}
          centered
          toggle={this.closeLoginModal}
          backdrop="static"
        >
          <Card id={styles.loginModalCard}>
            <CardHeader>
              <div className={styles.Web3SettingsModalTitle}>{modalTitle}</div>
              <button aria-label="Close" className="close" type="button" onClick={this.closeLoginModal}>
                <FontAwesomeIcon id={styles.closeModalIcon} icon={faWindowClose} />
              </button>
            </CardHeader>
            {modalContent}
            {settingsFooterContent && (
              <>
                <div className={styles.Web3SettingsModalSubtitle}>SETTINGS</div>
                <CardFooter className="text-center" id={styles.settingsFooter}>
                  {settingsFooterContent}
                </CardFooter>
              </>
            )}
            {preLoginFooterContent && (
              <CardFooter className="text-center" id={styles.preLoginFooter}>
                {preLoginFooterContent}
              </CardFooter>
            )}
          </Card>
        </Modal>
      </div>
    )
  }
}

(LoginAndSettingsModal as any).displayName = 'LoginAndSettingsModal';

(LoginAndSettingsModal as any).propTypes = {
  loginModalToggled: PropTypes.bool,
  loginInProgress: PropTypes.bool,
  loginComplete: PropTypes.bool,
  provider: PropTypes.string,
  account: PropTypes.string,
  network: PropTypes.object,
  demoMode: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
  demoSurfaceMode: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf([null])]),
  changeAccount: PropTypes.func.isRequired,
  toggleLoginModal: PropTypes.func.isRequired,
  updateLoginInfo: PropTypes.func.isRequired,
  toggleDemoMode: PropTypes.func.isRequired,
  setDemoSurfaceMode: PropTypes.func,
  toggleTooltips: PropTypes.func,
  changeFocusedTab: PropTypes.func.isRequired,
  wagmiProvider: PropTypes.object,
  wagmiNetwork: PropTypes.object,
  wagmiAddress: PropTypes.string,
  wagmiBalance: PropTypes.object,
  openConnectModal: PropTypes.func,
  focusedTab: PropTypes.number,
  activeSessionSlug: PropTypes.string,
  primarySessionExplicit: PropTypes.bool,
  selectedSessionScope: PropTypes.string,
  selectedSessionSlugs: PropTypes.arrayOf(PropTypes.string),
  tooltipsEnabled: PropTypes.bool,
  changeActiveSessionSlug: PropTypes.func,
  updateGlobalSessionSelection: PropTypes.func,
};

(LoginAndSettingsModal as any).defaultProps = {
  setDemoSurfaceMode: () => {},
  toggleTooltips: () => {},
  tooltipsEnabled: true,
  changeActiveSessionSlug: () => {},
  updateGlobalSessionSelection: () => {},
  demoSurfaceMode: true,
  primarySessionExplicit: false,
  selectedSessionScope: 'active',
  selectedSessionSlugs: [],
};

const mapStateToProps = (state: RootState) => ({
  provider: state.profile.provider,
  network: state.profile.network,
  account: state.profile.account,
  loginModalToggled: state.sessionState.loginModalToggled,
  loginInProgress: state.sessionState.loginInProgress,
  loginComplete: state.sessionState.loginComplete,
  demoMode: state.sessionState.demoMode,
  demoSurfaceMode: state.sessionState.demoSurfaceMode,
  focusedTab: state.sessionState.focusedTab,
  activeSessionSlug: state.sessionState.activeSessionSlug,
  primarySessionExplicit: state.sessionState.primarySessionExplicit,
  selectedSessionScope: state.sessionState.selectedSessionScope,
  selectedSessionSlugs: state.sessionState.selectedSessionSlugs,
  tooltipsEnabled: state.sessionState.tooltipsEnabled,
});

const LoginAndSettingsModalWithWagmiHooks = WagmiHooksHOC(LoginAndSettingsModal);
(LoginAndSettingsModalWithWagmiHooks as any).displayName = 'LoginAndSettingsModal';

export default connect(mapStateToProps, {
  changeAccount,
  toggleLoginModal,
  updateLoginInfo,
  toggleDemoMode,
  setDemoSurfaceMode,
  toggleTooltips,
  changeFocusedTab,
  changeActiveSessionSlug,
  updateGlobalSessionSelection,
})(LoginAndSettingsModalWithWagmiHooks);
