/** @file LoginAndSettingsModal.tsx */
import React, { Component } from 'react';
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
import { WagmiHooksHOC } from '../HooksHOC/withWagmiBridge';
import type { WagmiInjectedProps } from '../HooksHOC/withWagmiBridge';

// CSS, icons, logos
import '../../assets/css/contextEngine.scss';
import styles from './Account.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWindowClose, faQuestionCircle, faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

// Reactstrap components
import { Button, Card, CardHeader, CardFooter, Modal } from 'reactstrap';

import CETooltip from '../Shared/CETooltip';
import SessionChipSelector from '../Shared/SessionChipSelector';
import { LoginSettingsSupportedResourceCard } from './LoginSettingsResourceSummary';
import { LoginSettingsInlineNetworkSummary, LoginSettingsPanelNetworkSummary } from './LoginSettingsNetworkSummary';
import { LoginSettingsConfigToggleControl, LoginSettingsControlRow } from './LoginSettingsControlRow';
import LoginSettingsSectionCard from './LoginSettingsSectionCard';
import LoginSettingsAiConfigContent from './LoginSettingsAiConfigContent';
import LoginSettingsResourceKeysContent from './LoginSettingsResourceKeysContent';
import { assignLoginAndSettingsModalLegacyStatics } from './loginAndSettingsModalLegacyStatics';
import LoginModalDisplayBody from './LoginModalDisplayBody';
import LoginTooltipsToggleControl from './LoginTooltipsToggleControl';
import LoginPreLoginConfigPanel from './LoginPreLoginConfigPanel';
import LoginPreLoginSettingsDisplay from './LoginPreLoginSettingsDisplay';
import LoginDemoSurfaceToggleControl from './LoginDemoSurfaceToggleControl';

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
} from '../../utilities/web3/chainGateway.js';
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
import {
  getLocalSessionResourceKeys,
  saveLocalResourceKeys,
  clearLocalResourceKeys,
} from '../../utilities/session/resourceKeys.js';
import { getWorkerSessionToken, clearAllWorkerSessionTokens } from '../../utilities/worker/workerAuth.js';
import type { WorkerResourcePresence } from '../../utilities/worker/workerResourcePresence';
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
import { isTelegramFirstSessionConfig } from '../../utilities/session/sessionBackendKind';
import {
  exchangeAgentClientLogin,
  extractAgentClientToken,
  readAgentClientLoginEnvelope,
} from '../../utilities/session/agentClientLogin';

// Chain helpers
import { chainHexId, chainHttpRpc, chainHttpRpcNoPath, chainCurrency, getChainById } from '../../variables/chains.js';
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
  mergeWorkerResourcePresenceIntoSponsoredKeys,
} from './loginSettingsSponsoredStatusHelpers';
import {
  LOGIN_SETTINGS_AI_REASONING_LEVELS as AI_REASONING_LEVELS,
  LOGIN_SETTINGS_AI_TASK_REASONING_ROWS as AI_TASK_REASONING_ROWS,
  formatLoginSettingsAiProviderLabel,
} from './loginSettingsAiDisplayHelpers';
import LoginAgentTokenPanel from './LoginAgentTokenPanel';
import { createLoginAgentActions } from './loginAndSettingsAgentTokenActions';
import { createLoginPasskeyActions } from './loginAndSettingsPasskeyActions';
import { loadLoginSettingsSponsoredAccess } from './loginSettingsSponsoredAccessRuntime';

const accountLog = createLogger('account');
const normalizeAccountForComparison = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();
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
  workerResourcePresence: WorkerResourcePresence | null;
  sessionScanScope: string;
  sessionScanSlugs: string[];
  sessionScanSlugsInput: string;
  sessionScanStatus: string;
  preLoginSettingsOpen: boolean;
  preLoginConfigOpen: boolean;
  agentTokenLoginOpen: boolean;
  agentTokenInput: string;
  agentTokenStatus: string;
  agentTokenError: string;
  walletBalanceWei: ethers.BigNumber | null;
}

type SponsoredSessionEntry = Record<string, unknown> & {
  slug: string;
  label: string;
  sponsoredKeys: Record<string, unknown>;
  isActive?: boolean;
  inRpcScope?: boolean;
};

type AiSettingsLike = Record<string, unknown> & {
  mode?: unknown;
  models?: Record<string, unknown>;
  modelProviders?: Record<string, unknown>;
  providers?: Record<string, unknown>;
  preset?: unknown;
  taskReasoningEffort?: Record<string, unknown>;
  transcription?: Record<string, unknown>;
};

type AiPresetOption = {
  key: string;
  label: string;
  badgeLabel: string;
  provider?: unknown;
  models?: Readonly<Record<string, unknown>>;
};

type AiPresetConfig = {
  provider?: unknown;
  models?: Readonly<Record<string, unknown>>;
};

type ChainIdLike =
  | {
      id?: unknown;
      chainId?: unknown;
    }
  | null
  | undefined;

type WagmiBalanceLike =
  | {
      data?: { value?: unknown };
      value?: unknown;
    }
  | null
  | undefined;

type TestFundsRequestOptions = {
  source?: 'manual' | 'auto';
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
const getErrorCode = (error: unknown) =>
  error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : error && typeof error === 'object'
      ? toStr((error as { message?: unknown }).message)
      : toStr(error);
const uniqueList = <T = unknown,>(values: T[] = []) =>
  Array.from(
    new Set((Array.isArray(values) ? values : []).filter((value): value is T => value !== undefined && value !== null)),
  );
const readChainIdLike = (value: ChainIdLike): unknown =>
  value && typeof value === 'object' ? (value.id ?? value.chainId ?? 0) : 0;
const readWagmiBalanceValue = (value: WagmiBalanceLike): unknown =>
  value && typeof value === 'object' ? (value.data?.value ?? value.value ?? null) : null;
const AI_PRESET_LABELS: Record<string, { label: string; badgeLabel: string }> = Object.freeze({
  'gpt-5': { label: 'GPT-5 (default)', badgeLabel: 'GPT-5' },
  'gpt-4o': { label: 'GPT-4o', badgeLabel: 'GPT-4o' },
  'claude-sonnet': { label: 'Claude Sonnet 4.6', badgeLabel: 'Claude Sonnet 4.6' },
  'claude-opus': { label: 'Claude Opus 4.6', badgeLabel: 'Claude Opus 4.6' },
});

const AI_PRESET_OPTIONS: readonly AiPresetOption[] = Object.freeze([
  ...Object.entries(AI_PRESET_CONFIGS as Record<string, AiPresetConfig>).map(([key, config]) =>
    Object.freeze({
      key,
      label: AI_PRESET_LABELS[key]?.label || key,
      badgeLabel: AI_PRESET_LABELS[key]?.badgeLabel || key,
      provider: config.provider,
      models: config.models,
    }),
  ),
  Object.freeze({
    key: 'custom',
    label: 'Custom...',
    badgeLabel: 'Custom',
  }),
]);

const deriveAiPresetKey = (settings: AiSettingsLike = {}) =>
  deriveAiPreset({
    mode: settings?.mode,
    models: settings?.models,
    modelProviders: settings?.modelProviders,
  });

const getAiPresetMeta = (presetKey: unknown = ''): AiPresetOption =>
  AI_PRESET_OPTIONS.find((entry) => entry.key === presetKey) || AI_PRESET_OPTIONS[AI_PRESET_OPTIONS.length - 1];

const formatAiPresetBadgeLabel = (settings: AiSettingsLike = {}) => {
  const hasModelShape = !!(settings?.models?.fast || settings?.models?.thinking || settings?.mode);
  if (!hasModelShape) {
    return getAiPresetMeta('gpt-5').badgeLabel;
  }
  const presetKey = deriveAiPresetKey(settings);
  if (presetKey !== 'custom') {
    return getAiPresetMeta(presetKey).badgeLabel;
  }
  return (
    toStr(settings?.models?.thinking || settings?.models?.fast || settings?.mode || 'Custom model') || 'Custom model'
  );
};

const settingsSupportReasoning = (settings: AiSettingsLike = {}) =>
  [settings?.models?.fast, settings?.models?.thinking]
    .map((model) => toModelLeaf(model))
    .some((modelLeaf) => /^(gpt-5|o[13])/.test(toStr(modelLeaf)));

export class LoginAndSettingsModal extends Component<LoginAndSettingsModalProps, LoginAndSettingsModalState> {
  state: LoginAndSettingsModalState = (() => {
    const initialSessionScanSlugs = normalizeSessionScanSlugs(
      this.props.selectedSessionSlugs || readSessionScanSlugs(),
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
      workerResourcePresence: null,
      sessionScanScope: normalizeSessionScanScope(this.props.selectedSessionScope || readSessionScanScope()),
      sessionScanSlugs: Array.isArray(initialSessionScanSlugs) ? initialSessionScanSlugs : [],
      sessionScanSlugsInput: (Array.isArray(initialSessionScanSlugs) ? initialSessionScanSlugs : [])
        .map((slug: string) => (slug ? slug : 'general'))
        .join(', '),
      sessionScanStatus: '',
      preLoginSettingsOpen: false,
      preLoginConfigOpen: false,
      agentTokenLoginOpen: false,
      agentTokenInput: '',
      agentTokenStatus: '',
      agentTokenError: '',
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
  _passkeyActions = createLoginPasskeyActions({
    accountLogError: (message, error) => accountLog.error(message, error),
    changeAccount: (payload) => this.props.changeAccount(payload),
    clearAllWorkerSessionTokens,
    getAccount: () => this.props.account,
    getErrorMessage,
    getProvider: () => this.props.provider,
    getTargetNetwork: () => this.getTargetNetwork(),
    isCurrentAction: (actionId) => this.isCurrentPasskeyWalletAction(actionId),
    normalizeAccountForComparison,
    notifyInfo: (message) => notify.info(message),
    passkeyWallet,
    setStatus: (patch) => this.setStateIfMounted(patch),
    startAction: () => this.startPasskeyWalletAction(),
    updateLoginInfo: (payload) => this.props.updateLoginInfo(payload),
  });
  syncPasskeyWalletChain = this._passkeyActions.syncPasskeyWalletChain;
  getPasskeyWalletNetwork = this._passkeyActions.getPasskeyWalletNetwork;
  handlePasskeyWalletCreate = this._passkeyActions.handlePasskeyWalletCreate;
  handlePasskeyWalletSignIn = this._passkeyActions.handlePasskeyWalletSignIn;
  _finalizePasskeyWalletLogin = this._passkeyActions._finalizePasskeyWalletLogin;
  _agentTokenActions = createLoginAgentActions({
    changeAccount: (payload) => this.props.changeAccount(payload),
    exchangeAgentClientLogin,
    extractAgentClientToken,
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getAgentTokenInput: () => this.state.agentTokenInput,
    getDemoSessionConfigBySlug,
    getPropSessionConfig: () => this.props.sessionConfig,
    getSessionConfigBySlugOrDefault,
    getTargetNetwork: () => this.getTargetNetwork(),
    isTelegramFirstSessionConfig,
    normalizeSettingsSessionSlug,
    setState: (patch) => {
      if (typeof patch === 'function') {
        this.setState(
          (prev) =>
            patch(prev) as Pick<
              LoginAndSettingsModalState,
              'agentTokenError' | 'agentTokenInput' | 'agentTokenStatus' | 'agentTokenLoginOpen'
            >,
        );
        return;
      }
      this.setState(
        patch as Pick<LoginAndSettingsModalState, 'agentTokenError' | 'agentTokenInput' | 'agentTokenStatus'>,
      );
    },
    setStateIfMounted: (patch) => this.setStateIfMounted(patch),
    updateLoginInfo: (payload) => this.props.updateLoginInfo(payload),
    windowTarget: typeof window !== 'undefined' ? window : null,
  });
  getDisplaySessionConfig = this._agentTokenActions.getDisplaySessionConfig;
  getAgentTokenLoginSessionContext = this._agentTokenActions.getAgentTokenLoginSessionContext;
  shouldShowAgentTokenLogin = this._agentTokenActions.shouldShowAgentTokenLogin;
  toggleAgentTokenLogin = this._agentTokenActions.toggleAgentTokenLogin;
  handleAgentTokenLoginSubmit = this._agentTokenActions.handleAgentTokenLoginSubmit;

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
      }),
    );
    if (resolvedSlug) return resolvedSlug;
    const scope = normalizeSessionScanScope(state?.sessionScanScope ?? props.selectedSessionScope ?? '');
    const configuredScopeSlugs = this.getConfiguredSessionScanSlugs(state);
    const listModePrimary = this.getListModePrimarySessionSlug(state);
    const normalizedPropList = normalizeSessionScanSlugs(props.selectedSessionSlugs || []);
    const propListPrimary = Array.isArray(normalizedPropList)
      ? normalizedPropList[0]
      : String(normalizedPropList || '')
          .split(',')
          .map((slug: any) => slug.trim())
          .filter(Boolean)[0];
    const effectiveListPrimary = listModePrimary || normalizeSettingsSessionSlug(propListPrimary);
    const listIncludesGeneral =
      configuredScopeSlugs.includes('') || (Array.isArray(normalizedPropList) && normalizedPropList.includes(''));
    if (props.primarySessionExplicit === true) {
      if (scope === 'list' && !listIncludesGeneral && effectiveListPrimary) return effectiveListPrimary;
      return '';
    }
    if (scope === 'list' && effectiveListPrimary) return effectiveListPrimary;
    return scope === 'list' && propListPrimary ? normalizeSettingsSessionSlug(propListPrimary) : effectiveListPrimary;
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
      unsupported: false,
    };
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

    const restoreStillCurrent =
      passkeyRestoreReqId === this._passkeyWalletRestoreReqId &&
      passkeyActionIdAtRestoreStart === this._passkeyWalletActionId;
    if (restoredAddress && restoreStillCurrent) {
      accountLog.log('Restored passkey wallet session:', restoredAddress);
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
        provider: 'passkey_eoa',
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
    if (nextState && typeof nextState === 'object' && !Array.isArray(nextState)) {
      const keys = Object.keys(nextState);
      const changed = keys.some((key) => this.state[key as keyof LoginAndSettingsModalState] !== nextState[key]);
      if (!changed) {
        if (typeof cb === 'function') cb();
        return;
      }
    }
    this.setState(nextState, cb);
  };

  getWalletChainId = (props: LoginAndSettingsModalProps = this.props) =>
    Number(
      props.provider === 'wagmi'
        ? readChainIdLike(props.wagmiNetwork) || readChainIdLike(props.network)
        : readChainIdLike(props.network),
    ) || null;

  getWagmiBalanceInput = (props: LoginAndSettingsModalProps = this.props) => readWagmiBalanceValue(props.wagmiBalance);

  areWalletBalanceInputsEqual = (leftBalance: unknown, rightBalance: unknown) => {
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

  getWalletAccount = (props: LoginAndSettingsModalProps = this.props) =>
    (() => {
      if (props.provider === 'wagmi') {
        const hasWagmiAddressProp = Object.prototype.hasOwnProperty.call(props, 'wagmiAddress');
        const wagmiAddress = toStr(props.wagmiAddress).trim();
        if (hasWagmiAddressProp) return wagmiAddress;
      }
      return toStr(props.account).trim();
    })();

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
  ) => `${this.getWalletBalanceContextKey(props)}|${this.getActiveSessionSlug(props, state)}`;

  normalizeWalletBalance = (rawBalance: unknown) => {
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
      const providerResolver =
        typeof getProviderLocation === 'function'
          ? getProviderLocation
          : contractScripts && typeof contractScripts.getProviderLocation === 'function'
            ? contractScripts.getProviderLocation.bind(contractScripts)
            : null;
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
    let nextBalance: ethers.BigNumber | null = null;

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

  buildTestFundsSuccessMessage = (result: Record<string, unknown> = {}) => {
    const amountEth = toStr(result?.amountEth).trim();
    const networkName = this.getTargetNetwork()?.name || 'the session network';
    if (amountEth) return `Test gas sent: ${amountEth} ETH on ${networkName}.`;
    return `Test gas sent on ${networkName}.`;
  };

  buildTestFundsErrorMessage = (error: unknown, { source = 'manual' }: TestFundsRequestOptions = {}) => {
    const prefix = source === 'auto' ? 'Auto-funding failed' : 'Get test gas failed';
    const errorRecord = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
    const baseMessage = toStr(errorRecord.message).trim() || 'Failed to request test gas.';
    const status = Number(errorRecord.status || 0) || 0;
    if (status && !baseMessage.includes(`(${status})`) && !baseMessage.includes(`HTTP ${status}`)) {
      return `${prefix}: ${baseMessage} (HTTP ${status}).`;
    }
    return `${prefix}: ${baseMessage}`;
  };

  requestTestFunds = async ({ source = 'manual' }: TestFundsRequestOptions = {}) => {
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
      const result = await contractScripts.sendTestnetFunds(walletAccount, this.getActiveSessionSlug(), {
        context: this.getWalletRequestContext(),
      });
      const txHash = toStr(result?.txHash || result?.hash).trim();
      if (requestId !== this._testFundsRequestId || requestContextKey !== this.getTestFundsRequestContextKey()) {
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
      accountLog.error(
        source === 'auto' ? 'Auto-send testnet funds failed:' : 'Manual testnet funds request failed:',
        err,
      );
      if (requestId !== this._testFundsRequestId || requestContextKey !== this.getTestFundsRequestContextKey()) {
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

  isCurrentPasskeyWalletAction = (actionId: number): boolean =>
    this._isMounted && actionId === this._passkeyWalletActionId;

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

  componentDidUpdate(prevProps: Readonly<LoginAndSettingsModalProps>, prevState: Readonly<LoginAndSettingsModalState>) {
    let needsBalanceCheck = false;
    const activeSessionChanged =
      this.getActiveSessionSlug(this.props, this.state) !== this.getActiveSessionSlug(prevProps, prevState);
    const testFundsContextChanged =
      this.getTestFundsRequestContextKey(this.props, this.state) !==
      this.getTestFundsRequestContextKey(prevProps, prevState);
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
      accountLog.error('Error parsing wallet balance in auto-send check:', e);
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
    if (window.ethereum && this.props.provider === 'wagmi') {
      try {
        const tn = this.getTargetNetwork();
        const chainIdHex = chainHexId(tn);
        const rpcHttp = chainHttpRpcNoPath(tn) || chainHttpRpc(tn);
        const native = chainCurrency(tn);
        const ethereum = window.ethereum as {
          request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
        };

        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: chainIdHex,
              chainName: tn.name,
              nativeCurrency: native,
              rpcUrls: rpcHttp ? [rpcHttp] : [],
              blockExplorerUrls: [tn.blockExplorers?.default?.url].filter(Boolean),
            },
          ],
        });
        return true;
      } catch (error) {
        accountLog.error('Error adding network:', error);
        return false;
      }
    }
    return false;
  };

  switchToCorrectNetwork = async () => {
    const ethereum = window.ethereum;
    if (ethereum && this.props.provider === 'wagmi') {
      const tn = this.getTargetNetwork();
      const chainIdHex = chainHexId(tn);
      const switchToTargetNetwork = () =>
        ethereum.request({
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
            accountLog.error('Error switching network after adding network:', switchAfterAddError);
          }
        } else {
          accountLog.error('Error switching network:', error);
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
    accountLog.log('Clearing all application caches...');
    const managedNamespaces = ['questionsCache', 'surveysCache', 'bookmarksCache', 'filters', 'sbtCache', 'userCache'];
    try {
      await initCacheManager();
      for (const namespace of managedNamespaces) {
        const entries = listNamespaceEntriesSync(namespace, { cloneValues: false });
        const slugs: any = new Set(entries.map((entry: any) => String(entry?.slug || '')).filter((slug: any) => slug));
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
    } catch (e) {
      accountLog.warn('LoginAndSettingsModal: fallback', e);
    }
    this._cacheClearInFlight = false;
    this.reloadPage();
  };

  cloneAiSettings = (src: any) => {
    const baseCandidate = src || getLocalAiSettings() || {};
    const base = baseCandidate && typeof baseCandidate === 'object' ? baseCandidate : {};
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
    const base = baseCandidate && typeof baseCandidate === 'object' ? baseCandidate : {};
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

  getSessionScanScopeValue = (state: Partial<LoginAndSettingsModalState> = this.state) =>
    normalizeSessionScanScope(state?.sessionScanScope ?? this.props.selectedSessionScope ?? readSessionScanScope());

  getConfiguredSessionScanSlugs = (state: Partial<LoginAndSettingsModalState> = this.state) =>
    uniqueList(
      (() => {
        const rawSource = Array.isArray(state?.sessionScanSlugs)
          ? state.sessionScanSlugs
          : Array.isArray(this.props.selectedSessionSlugs) && this.props.selectedSessionSlugs.length > 0
            ? this.props.selectedSessionSlugs
            : state?.sessionScanSlugsInput || '';
        const normalized = normalizeSessionScanSlugs(rawSource);
        const list = Array.isArray(normalized)
          ? normalized
          : String(normalized || '')
              .split(',')
              .map((slug: any) => slug.trim())
              .filter((slug: any) => slug.length > 0);
        return list.map((slug: any) => normalizeSettingsSessionSlug(slug));
      })(),
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
    const reqId = (this._sponsoredReqId = (this._sponsoredReqId || 0) + 1);
    this.setStateIfMounted({ sponsoredAccessLoading: true, workerResourcePresence: null });
    try {
      const { accessMap, workerResourcePresence } = await loadLoginSettingsSponsoredAccess({
        slug,
        sessionConfig: getSessionConfigBySlugOrDefault(slug) || {},
        account: this.props.account || '',
        providerLike: this.props.provider || null,
        fallbackChainId: this.getTargetNetwork()?.id,
      });
      if (reqId !== this._sponsoredReqId) return;
      this.setStateIfMounted({
        sponsoredAccess: accessMap,
        sponsoredAccessLoading: false,
        workerResourcePresence,
      });
    } catch (_) {
      if (reqId !== this._sponsoredReqId) return;
      this.setStateIfMounted({ sponsoredAccessLoading: false, workerResourcePresence: null });
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
    const nextMode =
      toStr(event?.target?.value || '')
        .trim()
        .toLowerCase() || 'openai';
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
        preLoginConfigOpen: preLoginSettingsOpen ? prevState.preLoginConfigOpen : false,
      };
    });
  };

  togglePreLoginConfigPanel = () => {
    this.setState((prevState: Readonly<LoginAndSettingsModal['state']>) => ({
      preLoginConfigOpen: !prevState.preLoginConfigOpen,
    }));
  };

  handleAgentTokenInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({
      agentTokenInput: event.target.value,
      agentTokenError: '',
      agentTokenStatus: '',
    });
  };

  renderAgentTokenLoginPanel = () => {
    if (!this.shouldShowAgentTokenLogin()) return null;
    const { sessionSlug } = this.getAgentTokenLoginSessionContext();
    const cachedEnvelope = readAgentClientLoginEnvelope(sessionSlug);
    return (
      <LoginAgentTokenPanel
        agentTokenError={this.state.agentTokenError}
        agentTokenInput={this.state.agentTokenInput}
        agentTokenLoginOpen={this.state.agentTokenLoginOpen}
        agentTokenStatus={this.state.agentTokenStatus}
        cachedEnvelope={cachedEnvelope}
        onInputChange={this.handleAgentTokenInputChange}
        onSubmit={this.handleAgentTokenLoginSubmit}
        onToggle={this.toggleAgentTokenLogin}
      />
    );
  };

  handlePreLoginAiEndpointChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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

  handlePreLoginAiProviderKeyChange = (provider: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const current = this.cloneAiSettings(this.state.aiSettings || getLocalAiSettings());
    const saved = saveLocalAiSettings(
      applyPreLoginAiProviderKeyChange(current, {
        provider,
        apiKey: toStr(event?.target?.value || ''),
      }),
    );
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

  renderConfigToggleControl = ({ expanded = false, onToggle = null, testId = '' }: any = {}) =>
    LoginSettingsConfigToggleControl({
      expanded,
      onToggle,
      testId,
    });

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
  }: any = {}) =>
    LoginSettingsControlRow({
      activeSession,
      configOpen,
      onToggleConfig,
      configTestId,
      beforeConfig,
      betweenSessionAndTooltips,
      afterDemo,
      tooltipsControl: LoginTooltipsToggleControl({
        infoId: tooltipsInfoId,
        onToggle: () => this.props.toggleTooltips?.(),
        tooltipPlacement,
        tooltipsEnabled: this.props.tooltipsEnabled !== false,
      }),
      demoControl: LoginDemoSurfaceToggleControl({
        demoSurfaceEnabled: this.props.demoSurfaceMode !== false,
        onToggle: () => this.props.setDemoSurfaceMode?.(this.props.demoSurfaceMode === false),
      }),
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
    const available = uniqueList([...knownSlugs.map((slug: any) => normalizeSettingsSessionSlug(slug)), active, '']);
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
    const readSponsoredKeys = (slug: string, cfg: Record<string, unknown> | undefined) =>
      mergeWorkerResourcePresenceIntoSponsoredKeys(
        cfg?.sponsoredKeys && typeof cfg.sponsoredKeys === 'object'
          ? (cfg.sponsoredKeys as Record<string, unknown>)
          : {},
        slug === active ? this.state.workerResourcePresence : null,
      );
    const configBySlug = new Map<string, Record<string, unknown>>();
    const sponsoredSourceSignature = sourceSlugs.map((slug: string) => {
      const cfg = this.getDisplaySessionConfig(slug);
      configBySlug.set(slug, cfg);
      return {
        slug,
        sessionName: cfg?.sessionName || cfg?.name || cfg?.title || '',
        networkChainId: cfg?.networkChainId || cfg?.chainId || '',
        sponsoredKeys: readSponsoredKeys(slug, cfg),
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
        sponsoredKeys: readSponsoredKeys(slug, cfg),
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
      const next = current.includes(slug) ? current.filter((entry: any) => entry !== slug) : [...current, slug];
      return {
        sessionScanSlugs: next,
        sessionScanSlugsInput: this.formatSessionScanSlugsInput(next),
        sessionScanStatus: '',
      };
    });
  };

  handleSaveSessionScanSettings = () => {
    const desiredScope = normalizeSessionScanScope(
      this.state?.sessionScanScope ?? this.props.selectedSessionScope ?? readSessionScanScope(),
    );
    const normalizedSlugs = this.getConfiguredSessionScanSlugs({
      sessionScanSlugs: Array.isArray(this.state?.sessionScanSlugs)
        ? this.state.sessionScanSlugs
        : this.props.selectedSessionSlugs,
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
      desiredScope === 'list' && !normalizedSlugs.length ? 'No sessions selected; saved as general mode.' : 'Saved.';

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
      metaText:
        descriptor.description !== this.formatSettingsSessionOptionLabel(descriptor) ? descriptor.description : '',
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
          <span className={compact ? styles.preLoginSettingsLabel : styles.aiSettingsLabel}>Primary session</span>
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
          <span className={compact ? styles.preLoginSettingsLabel : styles.aiSettingsLabel}>Selected sessions</span>
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
      <LoginPreLoginConfigPanel
        anthropicApiKey={anthropicApiKey}
        customRpcUrl={customRpcUrl}
        onAiEndpointChange={this.handlePreLoginAiEndpointChange}
        onAiProviderKeyChange={this.handlePreLoginAiProviderKeyChange}
        openAiApiKey={openAiApiKey}
        sessionSettings={this.renderGlobalSessionSettings({
          compact: true,
          sessionSelectTestId: 'ce-prelogin-session-select',
          scopePrefix: 'ce-prelogin-session-scope',
        })}
      />
    );
  };

  getSettingsOverviewContext = () => {
    const walletNet = this.props.provider === 'wagmi' ? this.props.wagmiNetwork : this.props.network;
    const tn = this.getTargetNetwork();
    const targetNetworkName = tn?.name || 'not configured';
    const walletNetworkName = walletNet?.name || 'not connected';
    const corrId = Number(tn.id);
    const isCorrectNetwork = walletNet?.id === corrId;
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
  }: any = {}) =>
    formatLoginSettingsResourceSponsorHint({
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
      : Array.isArray(card?.sessions)
        ? card.sessions.filter((entry: any) => !entry?.isActive)
        : [];
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

  renderStaticSettingsSection = ({ title = '', summary = '', children = null }: any = {}) => (
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
      {showPanelNetwork
        ? this.renderPanelNetworkSummary({
            targetNetwork: overview.targetNetwork,
            targetNetworkName: overview.targetNetworkName,
            walletNetworkName: overview.walletNetworkName,
            showWalletNetwork: overview.showWalletNetwork,
            needsNetworkSwitch: overview.needsNetworkSwitch,
            tooltipId: networkTooltipId,
          })
        : null}
      <div className={styles.supportedResourcesGrid}>
        {overview.sponsorshipCards.map(this.renderSupportedResourceCard)}
      </div>
      {extraContent}
    </div>
  );

  getSettingsDisplay = () => {
    const overview = this.getSettingsOverviewContext();
    const { activeSession, cryptoTerminology, needsNetworkSwitch, sponsorSessions, targetNetwork } = overview;

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
    const aiPresetKey =
      aiDisplay?.preset ||
      (aiDisplay?.models?.fast || aiDisplay?.models?.thinking || aiDisplay?.mode
        ? deriveAiPresetKey(aiDisplay)
        : 'gpt-5');
    const aiPresetLabel = formatAiPresetBadgeLabel(aiDisplay);
    const showReasoningControls = settingsSupportReasoning(aiDisplay);
    const reasoningEffort =
      toStr(aiDisplay.reasoningEffort || DEFAULT_REASONING_EFFORT)
        .trim()
        .toLowerCase() || DEFAULT_REASONING_EFFORT;
    const taskReasoningEffort = aiDisplay.taskReasoningEffort || {};
    const isPerTaskOpen = this.isAiSettingsSectionOpen('aiPerTask');
    const isAdvancedOpen = this.isAiSettingsSectionOpen('aiAdvanced');
    const providerDisplayEntry = aiDisplay.providers?.[aiProvider] || {};
    const providerLocalEntry = aiLocal.providers?.[localProvider] || {};
    const sponsoredAccess = this.state.sponsoredAccess || {};
    const aiAccess = sponsoredAccess.ai || null;
    const aiAccessStatus = aiAccess?.status || '';
    const aiAccessIsConfirmedLocked =
      aiAccessStatus === 'denied' || aiAccessStatus === 'needs-wallet' || aiAccessStatus === 'invalid-gate';
    const keyPlaceholder = useLocalAi
      ? 'Enter API key'
      : sponsoredKeys.ai
        ? aiAccessStatus === 'granted'
          ? 'Sponsored key configured (unlocked)'
          : aiAccessIsConfirmedLocked
            ? 'Sponsored key configured (SBT required)'
            : 'Sponsored key configured'
        : 'No sponsored key set';

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
    const providerKeyHint =
      !useLocalAi && providerDisplayEntry.encryptedApiKey
        ? aiAccessStatus === 'granted'
          ? 'Encrypted session key is ready and the current wallet satisfies the sponsor gate.'
          : aiAccessStatus === 'denied'
            ? 'Encrypted session key exists, but this wallet still needs the sponsor SBT gate.'
            : 'Encrypted session key is available for this session.'
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
          betweenSessionAndTooltips: cryptoTerminology
            ? this.renderInlineNetworkSummary({
                targetNetworkName: overview.targetNetworkName,
                walletNetworkName: overview.walletNetworkName,
                showWalletNetwork: overview.showWalletNetwork,
                tooltipId: 'networkInfoTooltipInline',
              })
            : null,
          afterDemo:
            cryptoTerminology && needsNetworkSwitch ? (
              <Button onClick={this.switchToCorrectNetwork} className={`${styles.networkSwitchButton} ${styles.glow}`}>
                Switch to {overview.targetNetworkName}
              </Button>
            ) : null,
          tooltipsInfoId: 'postLoginTooltipsToggleTooltip',
          tooltipPlacement: 'right',
        })}

        {this.state.aiSettingsOpen &&
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
                  summary: (useLocalAi ? 'Local override on' : 'Using session defaults') + ' · ' + aiPresetLabel,
                  children: (
                    <LoginSettingsAiConfigContent
                      aiDisplay={aiDisplay}
                      aiPresetKey={aiPresetKey}
                      aiPresetOptions={AI_PRESET_OPTIONS}
                      aiProviderLabel={aiProviderLabel}
                      aiSettingsDirty={this.state.aiSettingsDirty}
                      aiSettingsStatus={this.state.aiSettingsStatus}
                      handleAiModeChange={this.handleAiModeChange}
                      handleAiPresetChange={this.handleAiPresetChange}
                      handleAiToggleLocal={this.handleAiToggleLocal}
                      handleClearAiSettings={this.handleClearAiSettings}
                      handleSaveAiSettings={this.handleSaveAiSettings}
                      isAdvancedOpen={isAdvancedOpen}
                      isPerTaskOpen={isPerTaskOpen}
                      keyPlaceholder={keyPlaceholder}
                      localProvider={localProvider}
                      providerKeyHint={providerKeyHint}
                      providerLocalEntry={providerLocalEntry}
                      reasoningEffort={reasoningEffort}
                      sessionDefaultBadgeText={sessionDefaultBadgeText}
                      showCustomFields={showCustomFields}
                      showCustomTranscription={showCustomTranscription}
                      showReasoningControls={showReasoningControls}
                      taskReasoningEffort={taskReasoningEffort}
                      taskReasoningRows={AI_TASK_REASONING_ROWS}
                      reasoningLevels={AI_REASONING_LEVELS}
                      toggleAiSettingsSection={this.toggleAiSettingsSection}
                      updateAiModelField={this.updateAiModelField}
                      updateAiProviderField={this.updateAiProviderField}
                      updateAiSettings={this.updateAiSettings}
                      updateAiTaskReasoningField={this.updateAiTaskReasoningField}
                      updateAiTranscriptionField={this.updateAiTranscriptionField}
                      useLocalAi={useLocalAi}
                      usingSessionDefaultsLabel={usingSessionDefaultsLabel}
                    />
                  ),
                })}

                {renderSection({
                  key: 'resourceKeys',
                  title: 'Resource keys',
                  summary:
                    useLocalRpc || useLocalArweave
                      ? 'Local key overrides enabled'
                      : 'Using session-sponsored fallbacks',
                  children: (
                    <LoginSettingsResourceKeysContent
                      formatResourceSponsorHint={this.formatResourceSponsorHint}
                      handleClearResourceKeys={this.handleClearResourceKeys}
                      handleResourceToggleLocal={this.handleResourceToggleLocal}
                      handleSaveResourceKeys={this.handleSaveResourceKeys}
                      resourceKeys={resourceKeys}
                      resourceKeysDirty={this.state.resourceKeysDirty}
                      resourceKeysStatus={this.state.resourceKeysStatus}
                      sponsorSessions={sponsorSessions}
                      sponsoredKeys={sponsoredKeys}
                      updateResourceKeyField={this.updateResourceKeyField}
                      useLocalArweave={useLocalArweave}
                      useLocalRpc={useLocalRpc}
                    />
                  ),
                })}
              </>
            ),
          })}
      </div>
    );
  };

  shouldComponentUpdate(nextProps: any, nextState: any) {
    const wagmiBalanceChanged = !this.areWalletBalanceInputsEqual(
      this.getWagmiBalanceInput(nextProps),
      this.getWagmiBalanceInput(this.props),
    );
    return (
      nextProps.loginInProgress !== this.props.loginInProgress ||
      nextProps.loginComplete !== this.props.loginComplete ||
      nextProps.loginModalToggled !== this.props.loginModalToggled ||
      nextProps.provider !== this.props.provider ||
      nextProps.account !== this.props.account ||
      nextProps.activeSessionSlug !== this.props.activeSessionSlug ||
      nextProps.selectedSessionScope !== this.props.selectedSessionScope ||
      JSON.stringify(nextProps.selectedSessionSlugs || []) !== JSON.stringify(this.props.selectedSessionSlugs || []) ||
      nextProps.demoSurfaceMode !== this.props.demoSurfaceMode ||
      nextProps.tooltipsEnabled !== this.props.tooltipsEnabled ||
      nextProps.network?.id !== this.props.network?.id ||
      this.state !== nextState ||
      nextProps.wagmiNetwork?.id !== this.props.wagmiNetwork?.id ||
      nextProps.wagmiAddress !== this.props.wagmiAddress ||
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
      this.setState({ firstModalAfterLogin: false });
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
      accountLog.error('Failed to open RainbowKit modal:', e);
    }
  };

  getPreLoginSettingsDisplay = () => {
    const overview = this.getSettingsOverviewContext();

    return LoginPreLoginSettingsDisplay({
      overview,
      preLoginConfigOpen: this.state.preLoginConfigOpen,
      preLoginSettingsOpen: this.state.preLoginSettingsOpen,
      renderInlineNetworkSummary: this.renderInlineNetworkSummary,
      renderPreLoginConfigPanel: this.renderPreLoginConfigPanel,
      renderSettingsControlRow: this.renderSettingsControlRow,
      renderSettingsOverviewPanel: this.renderSettingsOverviewPanel,
      renderStaticSettingsSection: this.renderStaticSettingsSection,
      togglePreLoginConfigPanel: this.togglePreLoginConfigPanel,
      togglePreLoginSettingsPanel: this.togglePreLoginSettingsPanel,
    });
  };

  getModalDisplay = () => {
    const activeChain = this.props.wagmiNetwork || this.props.network || this.getTargetNetwork();
    const showTestnetOnly = !!activeChain?.testnet;
    const activeSessionSlug = this.props.loginComplete ? this.getActiveSessionSlug() : '';
    const activeSessionConfig = this.props.loginComplete ? this.getDisplaySessionConfig(activeSessionSlug) : null;

    return LoginModalDisplayBody({
      account: this.props.account,
      activeSessionConfig,
      activeSessionSlug,
      handleLogout: this.handleLogout,
      handlePasskeyWalletCreate: this.handlePasskeyWalletCreate,
      handlePasskeyWalletSignIn: this.handlePasskeyWalletSignIn,
      loginComplete: this.props.loginComplete,
      loginInProgress: this.props.loginInProgress,
      network: this.props.network,
      openBookmarks: () => {
        this.closeLoginModal();
        if (typeof window !== 'undefined') {
          window.location.href = buildBookmarksRoutePath();
        }
      },
      openCryptoModal: this.openCryptoModal,
      passkeyWalletStatusMessage: this.state.passkeyWalletStatusMessage,
      passkeyWalletStatusTone: this.state.passkeyWalletStatusTone,
      provider: this.props.provider,
      renderAgentTokenLoginPanel: this.renderAgentTokenLoginPanel,
      showTestnetOnly,
    });
  };

  render() {
    const modalTitle =
      !this.props.loginComplete && !this.props.loginInProgress
        ? 'LOGIN'
        : this.props.loginInProgress || this.props.loginComplete
          ? 'ACCOUNT'
          : 'CONNECT';
    const modalContent = this.getModalDisplay();
    const settingsFooterContent = this.props.loginComplete ? this.getSettingsDisplay() : null;
    const preLoginFooterContent =
      !this.props.loginComplete && !this.props.loginInProgress ? this.getPreLoginSettingsDisplay() : null;

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
    );
  }
}

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
assignLoginAndSettingsModalLegacyStatics(LoginAndSettingsModal, LoginAndSettingsModalWithWagmiHooks);

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
