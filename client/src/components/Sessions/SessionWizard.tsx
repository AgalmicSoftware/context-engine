/** @file SessionWizard.tsx */
import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { ReactReduxContext } from 'react-redux';
import styles from './SessionWizard.module.scss';
import type { WorkerPanelProps } from './WorkerPanel';
import { resolveLitChain, getGlobalLitHooks } from '../../utilities/crypto/litProtocol.js';
import { getEffectiveArweaveKey } from '../../utilities/session/resourceKeys.js';
import {
  CLOUDFLARE_DEPLOY_HELPER_URL,
  CLOUDFLARE_WORKER_BUNDLE_URL,
  CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED,
  DEFAULT_CHAIN_ID,
} from '../../variables/appConfig.js';
import {
  getChainById,
  getDefaultHttpRpc,
  getSessionRegistryAddress,
  getSessionRegistryChains,
} from '../../variables/chains.js';
import type { SessionConfig, UnknownRecord } from '../../utilities/session/sessionTypes.js';
import type { SessionModeProfile } from '../../utilities/session/sessionModeProfile';
import { normalizeBaseUrl } from '../../utilities/urlUtils.js';
import { t } from '../../utilities/ui/terminology.js';
import { createLogger } from '../../utilities/logging';
import {
  getSessionWizardContractDefaults,
  resolveSessionWizardContractViewerPlan,
  resolveSessionWizardRegistryAddress,
} from './sessionWizardContracts.js';
import { resolveSessionWizardDeployStatusDisplayState } from './sessionWizardDeployErrors';
import { getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { notify } from '../../utilities/ui/notify.js';
import usePendingSbtDrafts, { normalizePendingSbtDrafts } from './hooks/usePendingSbtDrafts.js';
import useSessionWizardWorkerDeploy, {
  type SessionWizardWorkerDeployRuntime,
} from './hooks/useSessionWizardWorkerDeploy';
import useSessionSlugState from './hooks/useSessionSlugState.js';
import useSessionHeaderPreview from './hooks/useSessionHeaderPreview';
import useSessionWizardChromeState from './hooks/useSessionWizardChromeState';
import useSessionWizardLiveRefs from './hooks/useSessionWizardLiveRefs';
import useSessionWizardPublishAdvancedState from './hooks/useSessionWizardPublishAdvancedState';
import useSessionWizardWorkerState from './hooks/useSessionWizardWorkerState';
import useSessionWizardBlockLimits from './hooks/useSessionWizardBlockLimits';
import useSessionWizardNewSessionBanner from './hooks/useSessionWizardNewSessionBanner';
import useSessionWizardWorkerSyncEffects from './hooks/useSessionWizardWorkerSyncEffects';
import useSessionWizardIdentityEffects from './hooks/useSessionWizardIdentityEffects';
import useSessionWizardTooltipPreference from './hooks/useSessionWizardTooltipPreference';
import useSessionWizardNormalModeSectionVisibility from './hooks/useSessionWizardNormalModeSectionVisibility';
import useSessionWizardPublishElapsed from './hooks/useSessionWizardPublishElapsed';
import useSessionWizardCleanupEffect from './hooks/useSessionWizardCleanupEffect';
import useSessionWizardSponsoredBundleController from './hooks/useSessionWizardSponsoredBundleController';
import useSessionWizardWorkerSecretsController from './hooks/useSessionWizardWorkerSecretsController';
import useSessionWizardPendingSbtController from './hooks/useSessionWizardPendingSbtController';
import useSessionWizardWorkerResourceRenderer from './hooks/useSessionWizardWorkerResourceRenderer';
import {
  arweavePublishAdapter,
  sbtFactoryReceiptPublishAdapter,
  sessionPublishSbtMetadataAdapter,
  sessionRegistryPublishAdapter,
  sponsoredBundlePublishAdapter,
  workerAuthPublishAdapter,
} from '../../domains/sessions/publish/sessionPublishAdapters.js';
import {
  createInitialSessionPublishState,
  sessionPublishReducer,
  type SessionPublishEffect,
} from '../../domains/sessions/publish/sessionPublishReducer.js';
import {
  beginSessionPublishReducerAttempt,
  markSessionPublishEffectFailed,
  runSessionPublishEffect,
} from '../../domains/sessions/publish/sessionPublishDispatch.js';
import {
  resolveSessionWizardPublishReducerUiPlan,
  resolveSessionWizardPublishReducerUiState,
} from './sessionWizardPublishReducerUiState';
import SessionWizardInfoTooltip, { type SessionWizardTooltipRenderOptions } from './SessionWizardInfoTooltip';
import SessionWizardShell from './SessionWizardShell';
import SessionWizardSessionIdBadge from './SessionWizardSessionIdBadge';
import SessionWizardSessionModeProfileControl from './SessionWizardSessionModeProfileControl';
import { applySessionModeProfileSelectionToDraft } from './sessionWizardModeProfileDraftController';
import { buildNormalModeCards, buildNormalModePublishSummary } from './sessionWizardNormalModeCards';
import {
  LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH,
  getSessionWizardNormalModeBundleUrlOverrideValidationError,
  resolveSessionWizardBundleUrlForMode,
  resolveSessionWizardDeployBundlePayload,
  resolveSessionWizardSponsoredPublishSurfaceState,
  resolveSessionWizardSponsoredAutoDeployReadiness,
  resolveSponsoredBundleDeployReadiness,
  shouldForceSessionWizardNormalModeManualBundleRetry,
} from './sessionWizardPublishFlow';
import {
  appendSessionWizardRegisterTxEntry,
  isSessionWizardRegisterDuplicatePreflightError,
  resolveSessionWizardPublishCompletionRequest,
  resolveSessionWizardPublishFailureSettlementDescriptor,
  resolveSessionWizardRegisterFailureSettlementDescriptor,
  resolveSessionWizardRegisterDuplicateCheckDescriptor,
  resolveSessionWizardRegisterIdentityDescriptor,
  resolveSessionWizardRegisterSuccessSettlementDescriptor,
  resolveSessionWizardRegisterPreflightDescriptor,
  resolveSessionWizardPublishMetadataUploadRequest,
  resolveSessionWizardPublishStartPreflightDescriptor,
  resolveSessionWizardPublishAdminPreflightDescriptor,
  runSessionWizardRegisterStepController,
  runSessionWizardPublishMetadataUploadController,
  runSessionWizardPublishCompletionController,
  type SessionWizardPublishWorkerSignerArgs,
  type SessionWizardRegisterGroupArgs,
  type SessionWizardRegisterTxEntry,
} from './sessionWizardPublishController';
import { resolveSessionWizardModeRequirements } from './sessionWizardModeRequirements';
import { createSessionWizardPublishRuntimeController } from './sessionWizardPublishRuntimeController';
import {
  resolveSessionWizardPublishRequestDescriptor,
  resolveSessionWizardPublishUiPlan,
} from './sessionWizardPublishReadiness';
import {
  resolveDeployWorkerState,
  resolveSessionWizardWorkerBaseUrl,
  resolveSessionWizardWorkerVerificationUiState,
  shouldCacheSessionWorkerConfigAfterDeploy,
} from './sessionWizardWorkerState';
import {
  buildSessionWizardDefaultAllowedOrigins,
  getSessionWizardDefaultWorkerUrl,
  isSessionWizardDefaultWorkerPlaceholderUrl,
} from './sessionWizardWorkerDefaults';
import {
  isWorkerSbtGateCloudflareStorageProfile,
  normalizeSessionStorageProfileConfig,
} from './sessionWizardStorageProfile';
import { resolveSessionWizardAiModelProviderPatch } from './sessionWizardAiConfig';
import { dedupeSbtSelection, normalizeSbtSelection, type SbtSelection } from './sessionWizardSbtSelections';
import {
  buildPendingSbtDeployContextSignature,
  deploySessionWizardPendingSbtDraft,
  finalizeSessionWizardPendingSbtDraft,
  normalizeFeaturedDraftGateAutoLink,
  persistSessionWizardSbtRecoveryCodes,
} from './sessionWizardPendingSbtPublish';
import {
  areSbtSelectionsEqual,
  buildDefaultGateState,
  buildEmptyProvisionedSponsoredContext,
  buildEncryptionGate,
  buildResourceGateMap,
  getNextGateIndex,
  getValueAtPath,
  isSecretFieldPath,
  parseListInput,
  resolveSessionWizardSelectorSourceConfig,
  setValueAtPath,
} from './sessionWizardGateUtils';
import {
  cacheSessionWorkerConfigAfterDeploy,
  resolveSponsoredBundleAdvancedFieldNotices,
} from './sessionWizardSponsoredBundleSupport';
import { __test__resetSessionWizardSponsoredBundleCacheKey } from './sessionWizardSponsoredBundleCache';
import {
  buildWorkerLitCredentialsConfig,
  getSessionWizardWorkerResourceKeys,
  sanitizeSessionWizardSponsoredFieldSnapshotForLitMode,
  sanitizeSessionWizardWorkerSecretsForLitMode,
} from './sessionWizardWorkerSecretSupport';
import {
  applySessionWizardRegistryChainDraftDefaults,
  buildSessionWizardCacheWritePayload,
  buildSessionWizardInitialDraftFromCache,
} from './sessionWizardDraftState';
import {
  __test__getSessionWizardDefaultAiSettings,
  __test__isSessionWizardDevMode,
  DEV_PERSIST_WORKER_SECRETS,
  MANUAL_BUNDLE_URL_OVERRIDE_HELP,
  NORMAL_MODE_MANUAL_BUNDLE_RETRY_MESSAGE,
  NORMAL_MODE_MISSING_HOSTED_BUNDLE_MESSAGE,
  NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED,
  SESSION_WIZARD_DEFAULT_TEMPLATE,
  SPONSORED_MANUAL_BUNDLE_RETRY_MESSAGE,
} from './sessionWizardConfig';
import {
  getSessionSlugValidationError,
  hasInvalidSessionSlugFormat,
  INVALID_SESSION_SLUG_FORMAT_ERROR,
  isMissingSessionSlug,
  isReservedSessionSlug,
  REQUIRED_SESSION_SLUG_ERROR,
  RESERVED_SESSION_SLUG_ERROR,
  RESERVED_SESSION_SLUGS,
} from './sessionWizardSlugValidation';
import {
  buildSponsoredSbtLookupContextKey,
  deepClone,
  generateSessionId,
  getChainName,
  getSessionWizardErrorMessage,
} from './sessionWizardCoreUtils';
import {
  clearSessionWizardCache,
  readSessionWizardCache,
  useStableSerializedObject,
  writeSessionWizardCache,
} from './sessionWizardLocalStateSupport';
import {
  buildSessionWizardNewSessionBannerDismissalContextKey,
  isNewSessionWizardPathname,
} from './sessionWizardRouteState';
import { buildPublishedPendingSbtLinks, type PublishedPendingSbtLink } from './sessionWizardPublishLinks';
import { resolveSessionWizardNewSessionRequirementsDisplayState } from './sessionWizardRequirementsDisplay';
import {
  getSessionWizardExplorerBaseUrl as getExplorerBaseUrl,
  normalizeSessionWizardSlug as normalizeSlug,
  normalizeSessionWizardWorkerUrl as normalizeWorkerUrl,
} from './sessionWizardUrlSupport';
import { resolveSessionWizardWorkerUrlSourceState } from './sessionWizardWorkerRuntimeSupport';
import {
  buildSessionWizardGateOptions,
  normalizeSessionWizardGateIds as normalizeGateIds,
  resolveSessionWizardResourceGate as resolveResourceGate,
  resolveSessionWizardResourceGateSelectionUpdate,
  type SessionWizardResourceGateSelectionState,
} from './sessionWizardResourceGateSupport';
import {
  buildSessionWizardCreateSbtModalLaunchState,
  buildSessionWizardDeferredCreateSbtComponentProps,
  getSessionWizardGateById,
  resolveSessionWizardCreateSbtModalPlan,
  resolveSessionWizardCreateSbtTargetGateId,
  type SessionWizardCreateSbtLaunchOptions,
  type SessionWizardCreateSbtLaunchState,
} from './sessionWizardCreateSbtSupport';
import { getSessionWizardWorkerDeployValidationError } from './sessionWizardWorkerRpc';
import { resolveSessionWizardFundingRequirement } from './sessionWizardFundingRequirement';
import { getSessionWizardOrderedDraftEntries, splitSessionWizardDraftEntries } from './sessionWizardFieldDescriptors';
import { buildSessionWizardDraftFieldRenderer } from './sessionWizardDraftFieldRenderer';
import { buildSessionWizardMetadataPayloadBuilder } from './sessionWizardMetadataPayloadBuilder';
import type { ChainIdLike, NetworkLike, SessionContractsLike, WorkerSecretsLike } from '../shellTypes';

export {
  LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH,
  buildSessionWizardPublishPlan,
  buildSessionWizardPublishStepNumbers,
  getSessionWizardNormalModeBundleUrlOverrideValidationError,
  getSessionWizardPublishProgressPercent,
  resolveSessionWizardPublishProgressDisplayState,
  resolveSessionWizardBundleUrlForMode,
  resolveSessionWizardDeployBundleMode,
  resolveSessionWizardDeployBundlePayload,
  resolveSessionWizardSponsoredPublishSurfaceState,
  resolveSessionWizardSponsoredAutoDeployReadiness,
  resolveSponsoredBundleDeployReadiness,
  resolveSessionWizardShouldAutoDeployWorker,
  shouldForceSessionWizardNormalModeManualBundleRetry,
} from './sessionWizardPublishFlow';
export {
  resolveSessionWizardPublishRequestDescriptor,
  resolveSessionWizardPublishUiPlan,
} from './sessionWizardPublishReadiness';
export {
  resolveDeployWorkerState,
  resolveSessionWizardWorkerBaseUrl,
  resolveSessionWizardWorkerVerificationUiState,
  shouldCacheSessionWorkerConfigAfterDeploy,
} from './sessionWizardWorkerState';
export { buildSessionWizardDefaultAllowedOrigins } from './sessionWizardWorkerDefaults';
export { promotePendingSbtSelectionsAfterDeploy } from './sessionWizardSbtSelections';
export {
  getSessionSlugValidationError,
  hasInvalidSessionSlugFormat,
  INVALID_SESSION_SLUG_FORMAT_ERROR,
  isMissingSessionSlug,
  isReservedSessionSlug,
  REQUIRED_SESSION_SLUG_ERROR,
  RESERVED_SESSION_SLUG_ERROR,
  RESERVED_SESSION_SLUGS,
} from './sessionWizardSlugValidation';
export { getSessionWizardSecretFieldTestId } from './sessionWizardUiSupport';
export { __test__getSessionWizardDefaultAiSettings, __test__isSessionWizardDevMode } from './sessionWizardConfig';
export {
  deploySessionWizardPendingSbtDraft,
  finalizeSessionWizardPendingSbtDraft,
  persistSessionWizardSbtRecoveryCodes,
} from './sessionWizardPendingSbtPublish';
export { buildPublishedPendingSbtLinks } from './sessionWizardPublishLinks';
export type { PublishedPendingSbtLink } from './sessionWizardPublishLinks';
export { resolveSessionWizardSelectorSourceConfig } from './sessionWizardGateUtils';
export { cacheSessionWorkerConfigAfterDeploy } from './sessionWizardSponsoredBundleSupport';
export { __test__resetSessionWizardSponsoredBundleCacheKey } from './sessionWizardSponsoredBundleCache';
export { mergeSponsoredBundleDeployForm, mergeSponsoredBundleWorkerSecrets } from './sessionWizardWorkerSecretSupport';
export {
  buildSessionWizardWorkerRpcUrlMap,
  getSessionWizardWorkerDeployValidationError,
  resolveFallbackRpcUrl,
  resolveSessionWizardWorkerRpcUrl,
} from './sessionWizardWorkerRpc';

export const resolveSessionWizardChipotleHookConfig = ({
  workerSecretsEnabled = true,
  workerSecrets = {},
  resolvedWorkerUrl = '',
  draft = null,
}: {
  workerSecretsEnabled?: boolean;
  workerSecrets?: WorkerSecretsLike | UnknownRecord;
  resolvedWorkerUrl?: string;
  draft?: UnknownRecord | null;
} = {}) => {
  if (!workerSecretsEnabled) return null;
  const litCredentials = buildWorkerLitCredentialsConfig(workerSecrets);
  const normalizedWorkerUrl = workerAuthPublishAdapter.normalizeWorkerUrl(resolvedWorkerUrl);
  if (
    !normalizedWorkerUrl ||
    !toStr(litCredentials?.litApiBase).trim() ||
    !toStr(litCredentials?.litPkpId).trim() ||
    !toStr(litCredentials?.litActionCid).trim()
  ) {
    return null;
  }
  return {
    enabled: true,
    workerUrl: normalizedWorkerUrl,
    sessionSlug: normalizeSlug(draft?.slug || ''),
    litCredentials,
    sessionConfig: {
      ...(draft && typeof draft === 'object' ? draft : {}),
      corsWorkerUrl: normalizedWorkerUrl,
      litCredentials,
    },
  };
};

type DeployFormState = NonNullable<WorkerPanelProps['deployForm']> & {
  accountId?: string;
  bundleUrl?: string;
};

type ResourceGateMapState = Record<string, SessionWizardResourceGateSelectionState>;

type GateSelectionState = UnknownRecord & {
  sbts?: unknown[];
  mode?: string;
  chainId?: ChainIdLike | null;
  perMemberLimit?: unknown;
};

type GateSelectionsState = Record<string, GateSelectionState>;

type EncryptionGateState = UnknownRecord & {
  id: string;
  label?: string;
  color?: string;
  mode?: string;
  chainId?: ChainIdLike | null;
  perMemberLimit?: unknown;
  sbts?: unknown[];
};

type DraftState = UnknownRecord &
  NonNullable<WorkerPanelProps['draft']> & {
    sessionName?: string;
    sessionInfo?: string;
    sessionHeader?: string;
    sessionHeaderImg?: string;
    slug?: string;
    corsWorkerUrl?: string;
    networkChainId?: string | number;
    blockLimits?: UnknownRecord;
    contracts?: SessionContractsLike;
    defaultFeaturedSBTs?: unknown;
    embeddedDeployHelperEnabled?: boolean;
    featuredSBTs?: UnknownRecord[];
    faucet?: UnknownRecord;
    ai?: UnknownRecord;
    arweave?: UnknownRecord;
    lit?: UnknownRecord;
    rpc?: UnknownRecord;
    sponsored?: DraftSponsoredState;
    sessionModeProfile?: UnknownRecord;
    __registry?: UnknownRecord;
  };

type DraftAiModelsState = Record<string, UnknownRecord>;
type DraftAiState = UnknownRecord & {
  models?: DraftAiModelsState;
};
type DraftSponsoredState = UnknownRecord & {
  defaultGateId?: unknown;
  gates?: Record<string, UnknownRecord>;
};

type SessionWizardProps = {
  account?: string;
  provider?: UnknownRecord | null;
  network?: NetworkLike;
  activeSessionSlug?: string;
  ensureLightSbtUniverse?: (() => unknown) | null;
  sbtCacheRevision?: unknown;
  toggleLoginModal?: ((open?: boolean) => void) | null;
  loginComplete?: boolean;
  loginInProgress?: boolean;
  initialSessionId?: string | number | null;
  initialRegistryChainId?: ChainIdLike;
  initialSponsoredBundleId?: string | null;
  initialSponsoredBundleKey?: string | null;
  [key: string]: unknown;
};

type CreateSbtModalState = {
  open: boolean;
  targetType: string;
  gateId: string;
  sessionSlug: string;
  arweaveJwkOverride: string;
};

type ContractViewerModalState = {
  open: boolean;
  contractKey: string;
};

type SessionSlugExistsArgs = {
  registryChainId?: ChainIdLike;
  slug: string;
};

type SessionRegistryReadContract = {
  sessionExists?: (slug: string) => Promise<boolean> | boolean;
  sessionIdExists?: (sessionIdHex: string) => Promise<boolean> | boolean;
};

const ignoreSessionPublishStep = (_publishStep: number): void => {};

type ProvisionedSponsoredContextState = UnknownRecord & {
  sessionSlug: string;
  workerUrl: string;
  fields: UnknownRecord;
};

const log = createLogger('general');
const DEFAULT_TEMPLATE: DraftState = SESSION_WIZARD_DEFAULT_TEMPLATE as DraftState;
const pathKey = (path: string[]): string => path.join('.');

const buildProvisionedSponsoredContextState = (value: unknown): ProvisionedSponsoredContextState => {
  const context = value && typeof value === 'object' ? (value as UnknownRecord) : {};
  return {
    ...buildEmptyProvisionedSponsoredContext(),
    ...context,
    sessionSlug: sessionRegistryPublishAdapter.normalizeSlug(context.sessionSlug),
    workerUrl: workerAuthPublishAdapter.normalizeWorkerUrl(toStr(context.workerUrl).trim()),
    fields: sanitizeSessionWizardSponsoredFieldSnapshotForLitMode(context.fields as UnknownRecord | undefined),
  };
};

const SessionWizard = ({
  account,
  provider,
  network,
  activeSessionSlug,
  ensureLightSbtUniverse,
  sbtCacheRevision,
  toggleLoginModal,
  loginComplete = !!toStr(account).trim(),
  loginInProgress = false,
  initialSessionId,
  initialRegistryChainId,
  initialSponsoredBundleId,
  initialSponsoredBundleKey,
}: SessionWizardProps) => {
  const reduxContext = useContext(ReactReduxContext);
  const tooltipPreferenceStore = reduxContext?.store || null;
  const sessionWizardTooltipsEnabled = useSessionWizardTooltipPreference(tooltipPreferenceStore);
  const resolvedActiveSessionSlug = sessionRegistryPublishAdapter.normalizeSlug(activeSessionSlug ?? '');
  const currentSessionWizardPathname =
    typeof window === 'undefined' || !window.location ? '' : window.location.pathname;
  const isNewSessionWizardRoute = isNewSessionWizardPathname(currentSessionWizardPathname);
  const cachedWizard = useMemo(() => readSessionWizardCache(), []);
  const cachedDraftHasEmbeddedDeployHelperEnabled =
    typeof cachedWizard?.draft?.embeddedDeployHelperEnabled === 'boolean';
  const sourceEmbeddedDeployHelperDefault = useMemo(() => {
    // The canonical default session slug is an empty string, so only treat
    // nullish values as "no source session".
    if (resolvedActiveSessionSlug === undefined || resolvedActiveSessionSlug === null) return null;
    const sourceConfig = resolveSessionWizardSelectorSourceConfig({
      activeSessionSlug: resolvedActiveSessionSlug,
      draftNetworkChainId: cachedWizard?.draft?.networkChainId,
      network: {
        id: network?.id,
        chainId: network?.chainId,
      },
    });
    return typeof sourceConfig?.embeddedDeployHelperEnabled === 'boolean'
      ? sourceConfig.embeddedDeployHelperEnabled
      : null;
  }, [cachedWizard?.draft?.networkChainId, network?.chainId, network?.id, resolvedActiveSessionSlug]);
  const initialDraft = useMemo(() => {
    const draftFromCache = buildSessionWizardInitialDraftFromCache({
      cachedWizard,
      defaultTemplate: DEFAULT_TEMPLATE,
      normalModeSharedHostedWorkerEnabled: NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED,
      sourceEmbeddedDeployHelperDefault: cachedDraftHasEmbeddedDeployHelperEnabled
        ? null
        : sourceEmbeddedDeployHelperDefault,
    });
    if (!isNewSessionWizardRoute) return draftFromCache;
    const freshNewSessionDraft = { ...draftFromCache };
    delete freshNewSessionDraft.sessionModeProfile;
    return freshNewSessionDraft;
  }, [
    cachedDraftHasEmbeddedDeployHelperEnabled,
    cachedWizard,
    isNewSessionWizardRoute,
    sourceEmbeddedDeployHelperDefault,
  ]);
  const initialGates = useMemo<EncryptionGateState[]>(() => {
    const cachedGates = cachedWizard?.encryptionGates;
    if (Array.isArray(cachedGates) && cachedGates.length) return cachedGates as EncryptionGateState[];
    return [buildEncryptionGate(0) as EncryptionGateState];
  }, [cachedWizard]);
  const initialDefaultGateId = useMemo(() => {
    const cachedId = toStr(cachedWizard?.defaultGateId).trim();
    if (cachedId) return cachedId;
    return initialGates[0]?.id || '';
  }, [cachedWizard, initialGates]);
  const initialGateSelections = useMemo(() => {
    const cachedSelections = cachedWizard?.gateSelections;
    if (cachedSelections && typeof cachedSelections === 'object') return cachedSelections;
    return buildDefaultGateState(initialDraft.networkChainId || network?.id);
  }, [cachedWizard, initialDraft.networkChainId, network?.id]);
  const initialFeaturedDraftGateAutoLink = useMemo(
    () =>
      normalizeFeaturedDraftGateAutoLink(cachedWizard?.featuredDraftGateAutoLink as UnknownRecord | null | undefined),
    [cachedWizard],
  );
  const initialSessionIdValue = useMemo(() => {
    const fromQuery = sessionRegistryPublishAdapter.formatSessionId(initialSessionId);
    if (fromQuery) return fromQuery;
    const fromCache = sessionRegistryPublishAdapter.formatSessionId(cachedWizard?.sessionId);
    if (fromCache) return fromCache;
    return generateSessionId();
  }, [cachedWizard?.sessionId, initialSessionId]);

  const [draft, setDraft] = useState<DraftState>(() => initialDraft as DraftState);
  const draftRef = useRef<DraftState>(initialDraft as DraftState);
  const [sessionId, setSessionId] = useState(() => initialSessionIdValue);
  const [sessionIdStatus, setSessionIdStatus] = useState('');
  const [isSessionIdRegenerating, setIsSessionIdRegenerating] = useState(false);
  const [privateSlugMode, setPrivateSlugMode] = useState(() => !!cachedWizard?.privateSlugMode);
  const privateSlugModeRef = useRef(privateSlugMode);
  privateSlugModeRef.current = privateSlugMode;
  const lastManualSlugRef = useRef(toStr(cachedWizard?.lastManualSlug).trim());
  const [encryptedFieldGates, setEncryptedFieldGates] = useState<UnknownRecord>(() =>
    cachedWizard?.encryptedFieldGates && typeof cachedWizard.encryptedFieldGates === 'object'
      ? cachedWizard.encryptedFieldGates
      : {},
  );
  const [openLockKey, setOpenLockKey] = useState('');
  const [openResourceGateKey, setOpenResourceGateKey] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const {
    metadataUrl,
    setMetadataUrl,
    metadataTxId,
    setMetadataTxId,
    manualMetadataUrl,
    setManualMetadataUrl,
    manualGasLimit,
    setManualGasLimit,
    manualGasPriceGwei,
    setManualGasPriceGwei,
    manualMaxFeePerGasGwei,
    setManualMaxFeePerGasGwei,
    manualMaxPriorityFeePerGasGwei,
    setManualMaxPriorityFeePerGasGwei,
    publishAdvancedOpen,
    setPublishAdvancedOpen,
  } = useSessionWizardPublishAdvancedState({ cachedWizard });
  const [registerTxs, setRegisterTxs] = useState<SessionWizardRegisterTxEntry[]>([]);
  const [pendingOnChainFields, setPendingOnChainFields] = useState<UnknownRecord>({});
  const [status, setStatus] = useState('');
  const [sessionUrl, setSessionUrl] = useState('');
  const [adminUrl, setAdminUrl] = useState('');
  const [publishedPendingSbtLinks, setPublishedPendingSbtLinks] = useState<PublishedPendingSbtLink[]>([]);
  const [adminUrlStatus, setAdminUrlStatus] = useState('');
  const [sessionPublishState, dispatchSessionPublish] = useReducer(sessionPublishReducer, undefined, () =>
    createInitialSessionPublishState({ status: 'editing' }),
  );
  const [sessionModeProfileStepComplete, setSessionModeProfileStepComplete] = useState(false);
  const publishBusy = resolveSessionWizardPublishReducerUiState({ state: sessionPublishState }).publishBusy;
  const publishRequestInFlightRef = useRef(false);
  const [publishStepElapsedMs, setPublishStepElapsedMs] = useState(0);
  const [wizardMode, setWizardMode] = useState('normal');
  const [registryChainId, setRegistryChainId] = useState<number>(() => {
    const fromDraft = Number(draft.networkChainId || 0);
    if (fromDraft && getSessionRegistryAddress(fromDraft)) return fromDraft;
    const fromNetwork = Number(network?.id || 0);
    if (fromNetwork && getSessionRegistryAddress(fromNetwork)) return fromNetwork;
    const defaultRegistryChainId = Number(DEFAULT_CHAIN_ID || 0);
    if (defaultRegistryChainId && getSessionRegistryAddress(defaultRegistryChainId)) {
      return defaultRegistryChainId;
    }
    const available = getSessionRegistryChains();
    if (available.length) return Number(available[0].id || 0) || 0;
    return Number(DEFAULT_CHAIN_ID || 0) || 0;
  });
  const checkSessionSlugExists = useCallback(
    async ({ registryChainId: chainId, slug }: SessionSlugExistsArgs): Promise<boolean> => {
      const registryRead = sessionRegistryPublishAdapter.getRegistryContract({
        chainId,
        providerLike: null,
      }) as SessionRegistryReadContract | null;
      if (!registryRead || typeof registryRead.sessionExists !== 'function') {
        throw new Error('Session registry read contract not available.');
      }
      return !!(await registryRead.sessionExists(sessionRegistryPublishAdapter.toRegistrySlug(slug)));
    },
    [],
  );
  const { slugAvailability } = useSessionSlugState({
    slug: draft?.slug,
    privateSlugMode,
    registryChainId,
    isReservedSlug: isReservedSessionSlug,
    sessionExists: checkSessionSlugExists,
  });
  const initialGateRef = useRef<EncryptionGateState>(initialGates[0]);
  const [encryptionGates, setEncryptionGates] = useState<EncryptionGateState[]>(() => initialGates);
  // Pending SBT drafts carry deploy secrets and claim codes, so keep them out
  // of localStorage while still surviving same-tab refreshes via sessionStorage.
  const { pendingSbtDrafts, setPendingSbtDrafts, normalizedPendingSbtDrafts, hasUndeployedPendingSbtDrafts } =
    usePendingSbtDrafts();
  const pendingSbtDraftsRef = useRef(pendingSbtDrafts);
  pendingSbtDraftsRef.current = pendingSbtDrafts;
  const [createSbtModalState, setCreateSbtModalState] = useState<CreateSbtModalState>(() => ({
    open: false,
    targetType: 'gate',
    gateId: initialDefaultGateId || initialGateRef.current?.id || '',
    sessionSlug: '',
    arweaveJwkOverride: '',
  }));
  const [contractViewerModalState, setContractViewerModalState] = useState<ContractViewerModalState>(() => ({
    open: false,
    contractKey: '',
  }));
  const [pendingCreateSbtLaunch, setPendingCreateSbtLaunch] = useState<SessionWizardCreateSbtLaunchState | null>(null);
  const hasPrivateSbtName = useMemo(() => {
    const gates = Array.isArray(encryptionGates) ? encryptionGates : [];
    return gates.some((gate) =>
      normalizeSbtSelection(gate?.sbts || []).some((sbt) => toStr(sbt?.name).toLowerCase().includes('private')),
    );
  }, [encryptionGates]);
  const lastHasPrivateSbtNameRef = useRef(false);
  const [gateSelections, setGateSelections] = useState<GateSelectionsState>(
    () => initialGateSelections as GateSelectionsState,
  );
  const [defaultGateId, setDefaultGateId] = useState(() => initialDefaultGateId || initialGateRef.current.id);
  const [createSbtTargetGateId, setCreateSbtTargetGateId] = useState(
    () => initialDefaultGateId || initialGateRef.current?.id || '',
  );
  const [featuredDraftGateAutoLink, setFeaturedDraftGateAutoLink] = useState(() => initialFeaturedDraftGateAutoLink);
  // Gate selection is always per-resource when multiple gates exist (no toggle needed).
  const [resourceGateMap, setResourceGateMap] = useState<ResourceGateMapState>(() => {
    const cachedMap = cachedWizard?.resourceGateMap;
    if (cachedMap && typeof cachedMap === 'object') return cachedMap as ResourceGateMapState;
    return buildResourceGateMap(
      initialGates,
      initialDefaultGateId || initialGateRef.current.id,
    ) as ResourceGateMapState;
  });
  const [jsonCopied, setJsonCopied] = useState(false);
  const sessionIdRotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminUrlStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jsonCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compactSessionHeaderInputRef = useRef<HTMLInputElement | null>(null);
  const embeddedDeployHelperHydrationKeyRef = useRef('');
  const isMountedRef = useRef(true);
  const selectorSourceSessionConfig = useMemo(() => {
    return resolveSessionWizardSelectorSourceConfig({
      activeSessionSlug: resolvedActiveSessionSlug,
      registryChainId,
      draftNetworkChainId: draft?.networkChainId,
      network: {
        id: network?.id,
        chainId: network?.chainId,
      },
    });
  }, [draft?.networkChainId, network?.chainId, network?.id, registryChainId, resolvedActiveSessionSlug]);

  useEffect(() => {
    const sourceSlugRaw = resolvedActiveSessionSlug ?? selectorSourceSessionConfig?.slug;
    const sourceValue = selectorSourceSessionConfig?.embeddedDeployHelperEnabled;
    if (sourceSlugRaw === undefined || sourceSlugRaw === null || typeof sourceValue !== 'boolean') return;
    if (cachedDraftHasEmbeddedDeployHelperEnabled) return;

    const sourceSlug = toStr(sourceSlugRaw).trim();
    const hydrationKey = `${sourceSlug}:${sourceValue ? '1' : '0'}`;
    if (embeddedDeployHelperHydrationKeyRef.current === hydrationKey) return;

    setDraft((prev) => {
      if (prev?.embeddedDeployHelperEnabled === sourceValue) return prev;
      const next = deepClone(prev);
      next.embeddedDeployHelperEnabled = sourceValue;
      return next;
    });
    embeddedDeployHelperHydrationKeyRef.current = hydrationKey;
  }, [
    cachedDraftHasEmbeddedDeployHelperEnabled,
    resolvedActiveSessionSlug,
    selectorSourceSessionConfig?.embeddedDeployHelperEnabled,
    selectorSourceSessionConfig?.slug,
  ]);
  const selectorSourceChainId =
    Number(
      selectorSourceSessionConfig?.networkChainId ||
        registryChainId ||
        draft?.networkChainId ||
        network?.id ||
        network?.chainId ||
        0,
    ) || null;

  useSessionWizardCleanupEffect({
    isMountedRef,
    sessionIdRotationTimerRef,
    adminUrlStatusTimerRef,
    sessionIdStatusTimerRef,
    jsonCopiedTimerRef,
  });
  const DEFAULT_ALLOWED_ORIGINS = buildSessionWizardDefaultAllowedOrigins().join('\n');
  const {
    workerMode,
    setWorkerMode,
    workerSecretsEnabled,
    setWorkerSecretsEnabled,
    persistWorkerSecrets,
    setPersistWorkerSecrets,
    deployHelperUrl,
    setDeployHelperUrl,
    deployForm,
    setDeployForm,
    bundleMode,
    setBundleMode,
    bundleFile,
    setBundleFile,
    forceManualBundleFile,
    setForceManualBundleFile,
    normalModeBundleUrlOverride,
    setNormalModeBundleUrlOverride,
    deployStatus,
    setDeployStatus,
    deployInFlight,
    setDeployInFlight,
    deployComplete,
    setDeployComplete,
    deployWorkerUrl,
    setDeployWorkerUrl,
    provisionedSponsoredContext,
    setProvisionedSponsoredContext,
    workerSecrets,
    setWorkerSecrets,
    workerUrlAutoFilled,
    setWorkerUrlAutoFilled,
    workerAllowOrigins,
    setWorkerAllowOrigins,
    workerLimitPerWallet,
    setWorkerLimitPerWallet,
  } = useSessionWizardWorkerState<ProvisionedSponsoredContextState>({
    cachedWizard,
    deployHelperUrlDefault: CLOUDFLARE_DEPLOY_HELPER_URL,
    workerBundleUrlDefault: CLOUDFLARE_WORKER_BUNDLE_URL,
    devPersistWorkerSecrets: DEV_PERSIST_WORKER_SECRETS,
    defaultAllowedOrigins: DEFAULT_ALLOWED_ORIGINS,
    buildProvisionedSponsoredContextState,
  });
  const deployFormRef = useRef<DeployFormState>(deployForm);
  const resolvedWalletAccountRef = useRef(toStr(account).trim());
  const advancedBundleFileInputRef = useRef<HTMLInputElement | null>(null);
  const normalModeRetryBundleFileInputRef = useRef<HTMLInputElement | null>(null);
  const sponsoredPublishBundleFileInputRef = useRef<HTMLInputElement | null>(null);
  const deployCompleteRef = useRef(!!cachedWizard?.deployComplete);
  const deployWorkerUrlRef = useRef(normalizeBaseUrl(toStr(cachedWizard?.deployWorkerUrl).trim()));
  const provisionedSponsoredContextRef = useRef<ProvisionedSponsoredContextState>(
    buildProvisionedSponsoredContextState(cachedWizard?.provisionedSponsoredContext),
  );
  const workerSecretsEnabledRef = useRef(workerSecretsEnabled);
  const persistWorkerSecretsRef = useRef(persistWorkerSecrets);
  const workerSecretsRef = useRef<WorkerSecretsLike>(
    sanitizeSessionWizardWorkerSecretsForLitMode(cachedWizard?.workerSecrets),
  );
  const workerDeployRuntimeRef = useRef<SessionWizardWorkerDeployRuntime | null>(null);
  const toggleLoginModalRef = useRef<SessionWizardProps['toggleLoginModal']>(toggleLoginModal);
  toggleLoginModalRef.current = toggleLoginModal;
  const togglePrivateSlugModeRef = useRef<null | (() => void)>(null);
  const updateDraftValueRef = useRef<null | ((path: string[], value: unknown) => void)>(null);
  const resolveCreateSbtTargetGateIdRef = useRef<null | ((requestedGateId?: unknown) => string)>(null);
  const openCreateSbtModalRef = useRef<
    null | ((options?: SessionWizardCreateSbtLaunchOptions | SessionWizardCreateSbtLaunchState) => void)
  >(null);
  const defaultSponsoredSbtLookupInFlightRef = useRef('');
  const pendingSbtDeployContextSignature = useMemo(
    () =>
      buildPendingSbtDeployContextSignature(
        {
          networkChainId: Number(draft?.networkChainId || registryChainId || network?.id || network?.chainId || 0) || 0,
          contracts: draft?.contracts || {},
        },
        registryChainId || network?.id || network?.chainId || null,
      ),
    [draft?.contracts, draft?.networkChainId, network?.chainId, network?.id, registryChainId],
  );
  const slugFreezeAnchor = toStr(draft?.slug || resolvedActiveSessionSlug).trim();
  // Regression guard: queued SBT metadata already bakes in the active session slug.
  // Keep the wizard URL stable until those pending deployments are cleared.
  const slugPinnedByPendingSbtDrafts = hasUndeployedPendingSbtDrafts && !!slugFreezeAnchor;
  // Regression guard: hidden worker secrets must stay out of deferred SBT uploads
  // when the wizard is switched to user-paid mode.
  const getEnabledWorkerArweaveJwk = (secretsIn: unknown = workerSecrets): string => {
    if (!workerSecretsEnabled) return '';
    const secrets = sanitizeSessionWizardWorkerSecretsForLitMode(
      secretsIn && typeof secretsIn === 'object' ? (secretsIn as WorkerSecretsLike) : undefined,
    );
    return toStr(secrets?.arweaveJwk).trim();
  };
  const {
    sponsoredBundleStatus,
    sponsoredBundleRetryNonce,
    setSponsoredBundleRetryNonce,
    sponsoredBundleAppliedBundleRef,
    hasSponsoredBundleLink,
    getCurrentWorkerSecrets,
    getCurrentEnabledWorkerSecrets,
    applyWorkerSecretsUpdate,
    updateSponsoredBundleDeploymentState,
    clearSelectedBundleFile,
  } = useSessionWizardSponsoredBundleController<DraftState, DeployFormState, ProvisionedSponsoredContextState>({
    initialSponsoredBundleId,
    initialSponsoredBundleKey,
    draftSlug: draft?.slug,
    workerSecretsEnabled,
    refs: {
      draftRef,
      deployFormRef,
      deployCompleteRef,
      deployWorkerUrlRef,
      provisionedSponsoredContextRef,
      workerSecretsEnabledRef,
      persistWorkerSecretsRef,
      workerSecretsRef,
      advancedBundleFileInputRef,
      normalModeRetryBundleFileInputRef,
      sponsoredPublishBundleFileInputRef,
    },
    setWorkerSecrets,
    setDraft,
    setDeployForm,
    setDeployStatus,
    setDeployInFlight,
    setDeployComplete,
    setWorkerMode,
    setDeployWorkerUrl,
    setProvisionedSponsoredContext,
    setForceManualBundleFile,
    setNormalModeBundleUrlOverride,
    setWorkerUrlAutoFilled,
    setWorkerSecretsEnabled,
    setPersistWorkerSecrets,
    setBundleFile,
    buildProvisionedSponsoredContextState,
  });
  const {
    sessionHeaderMode,
    setSessionHeaderMode,
    compactSessionHeaderMode,
    setCompactSessionHeaderMode,
    sessionHeaderFile,
    setSessionHeaderFile,
    sessionHeaderPreviewSrc,
    sessionHeaderPreviewModalOpen,
    setSessionHeaderPreviewModalOpen,
    sessionHeaderUploadStatus,
    sessionHeaderUploadStatusTone,
    setSessionHeaderStatus,
    handlePasteSessionHeaderFromClipboard,
    handleClearSessionHeaderPreview,
  } = useSessionHeaderPreview({
    draftSessionHeader: draft?.sessionHeader,
    updateDraftSessionHeader: (value) => updateDraftValue(['sessionHeader'], value),
  });
  const {
    wizardDisplaySettingsOpen,
    setWizardDisplaySettingsOpen,
    moreOptionsOpen,
    setMoreOptionsOpen,
    showJsonPreview,
    setShowJsonPreview,
    showPromptPreview,
    setShowPromptPreview,
    metadataObjectCollapsed,
    setMetadataObjectCollapsed,
    collapsedSections,
    setCollapsedSections,
  } = useSessionWizardChromeState({
    wizardMode,
    hasSponsoredBundleLink,
  });
  const workerResourceKeys = useMemo(() => getSessionWizardWorkerResourceKeys(), []);
  const normalizedDraftStorageProfile = useMemo(
    () => normalizeSessionStorageProfileConfig(draft?.storageProfile),
    [draft?.storageProfile],
  );
  const cloudflareWorkerSbtGateMode = isWorkerSbtGateCloudflareStorageProfile(normalizedDraftStorageProfile);
  const sessionModeRequirements = resolveSessionWizardModeRequirements(draft.sessionModeProfile as SessionModeProfile);
  const visibleWorkerResourceKeys = workerResourceKeys.filter((key) =>
    sessionModeRequirements.selected
      ? sessionModeRequirements.visibleWorkerResourceKeys.includes(key)
      : !cloudflareWorkerSbtGateMode || key !== 'lit',
  );
  const effectivePersistWorkerSecrets = DEV_PERSIST_WORKER_SECRETS && persistWorkerSecrets;

  const registryAddress = useMemo(() => {
    return resolveSessionWizardRegistryAddress(registryChainId, draft?.contracts);
  }, [registryChainId, draft?.contracts]);
  const registryChainName = useMemo(() => getChainName(registryChainId), [registryChainId]);
  const registryChainOptions = useMemo(() => getSessionRegistryChains(), []);
  const newSessionFundingRequirement = useMemo(
    () =>
      resolveSessionWizardFundingRequirement({
        defaultChainId: DEFAULT_CHAIN_ID,
        getChainById,
        getChainName,
        registryChainId,
        purpose:
          sessionModeRequirements.publish.deployPendingSbts && !sessionModeRequirements.publish.registerSession
            ? 'SBT publishing'
            : 'registration',
      }),
    [
      registryChainId,
      sessionModeRequirements.publish.deployPendingSbts,
      sessionModeRequirements.publish.registerSession,
    ],
  );
  const newSessionFundingRequirementLabel = newSessionFundingRequirement.label;
  const newSessionFundingRequirementHref = newSessionFundingRequirement.href;

  const buildWorkerName = (rawName: unknown): string => {
    const base = toStr(rawName)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    if (!base) return '';
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    return `${base}-worker-${dd}${hh}${yy}`;
  };

  useSessionWizardWorkerSyncEffects<DeployFormState>({
    account,
    deployFormAdminAddress: deployForm.adminAddress,
    deployFormWorkerName: deployForm.workerName,
    setDeployForm,
    draftSessionName: draft.sessionName,
    draftCorsWorkerUrl: draft.corsWorkerUrl,
    buildWorkerName,
    deployComplete,
    deployWorkerUrl,
    setDeployComplete,
    wizardMode,
    workerMode,
    setWorkerMode,
    setWorkerUrlAutoFilled,
    updateDraftValueRef,
  });

  useSessionWizardIdentityEffects<DraftState>({
    initialRegistryChainId,
    setRegistryChainId,
    initialSessionId,
    setSessionId,
    setDraft,
    privateSlugMode,
    sessionId,
    slugPinnedByPendingSbtDrafts,
    draftSessionName: draft?.sessionName,
    draftSlug: draft?.slug,
    lastManualSlugRef,
    hasPrivateSbtName,
    lastHasPrivateSbtNameRef,
    privateSlugModeRef,
    togglePrivateSlugModeRef,
  });

  const handleRegistryChainIdChange = useCallback((value: string | number) => {
    setRegistryChainId(Number(value || 0) || 0);
  }, []);

  useEffect(() => {
    // Persist wizard state between refreshes until deploy/upload clears them.
    // Default: redact secret values so refresh requires re-entry (security: no keys in localStorage).
    // Pending SBT drafts use sessionStorage so same-tab refresh can recover
    // queued CREATE2 drafts without turning them into long-lived local secrets.
    // Dev toggle: optionally persist secrets locally for faster iteration.
    writeSessionWizardCache(
      buildSessionWizardCacheWritePayload({
        sessionId,
        draft,
        privateSlugMode,
        lastManualSlug: lastManualSlugRef.current,
        encryptionGates,
        encryptedFieldGates,
        gateSelections,
        defaultGateId,
        featuredDraftGateAutoLink,
        resourceGateMap,
        manualGasLimit,
        manualGasPriceGwei,
        manualMaxFeePerGasGwei,
        manualMaxPriorityFeePerGasGwei,
        workerSecretsEnabled,
        effectivePersistWorkerSecrets,
        workerSecrets,
        deployForm,
        deployComplete,
        deployWorkerUrl,
        provisionedSponsoredContext,
      }),
    );
  }, [
    sessionId,
    draft,
    privateSlugMode,
    encryptionGates,
    pendingSbtDrafts,
    encryptedFieldGates,
    gateSelections,
    defaultGateId,
    featuredDraftGateAutoLink,
    resourceGateMap,
    manualGasLimit,
    manualGasPriceGwei,
    manualMaxFeePerGasGwei,
    manualMaxPriorityFeePerGasGwei,
    workerSecretsEnabled,
    effectivePersistWorkerSecrets,
    workerSecrets,
    deployForm,
    deployComplete,
    deployWorkerUrl,
    provisionedSponsoredContext,
  ]);

  useEffect(() => {
    if (!encryptedFieldGates?.slug) return;
    setEncryptedFieldGates((prev) => {
      if (!prev?.slug) return prev;
      const next = { ...prev };
      delete next.slug;
      return next;
    });
  }, [encryptedFieldGates]);

  useEffect(() => {
    const chainId = Number(registryChainId || 0) || 0;
    if (!chainId) return;
    setDraft((prev) => {
      // NOTE: For now we assume session chain === registry chain; split these when they diverge.
      // Contract defaults currently come from bundled per-chain config; ENS discovery remains future work.
      // Auto-fill the current PATH public RPC; dedicated gateway/provider-tier support remains future work.
      return applySessionWizardRegistryChainDraftDefaults({
        draft: prev,
        chainId,
        contractDefaults: getSessionWizardContractDefaults(chainId),
        pathRpc: getDefaultHttpRpc(chainId),
      }) as DraftState;
    });
    setGateSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (!next[key]) return;
        if (Number(next[key].chainId || 0) !== chainId) {
          next[key] = { ...next[key], chainId };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [registryChainId]);

  useEffect(() => {
    const gateIds = encryptionGates.map((gate) => gate.id).filter(Boolean);
    if (!gateIds.length) return;
    if (!gateIds.includes(defaultGateId)) {
      setDefaultGateId(gateIds[0]);
    }
    setResourceGateMap((prev) => {
      let changed = false;
      const next = { ...prev };
      const fallbackGateId = toStr(defaultGateId).trim() || gateIds[0] || '';
      workerResourceKeys.forEach((key) => {
        const resolved = resolveSessionWizardResourceGateSelectionUpdate({
          nextIds: prev[key],
          availableGateIds: gateIds,
          fallbackGateId,
        });
        if (JSON.stringify(next[key]) !== JSON.stringify(resolved)) {
          next[key] = resolved;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [defaultGateId, encryptionGates, workerResourceKeys]);

  useEffect(() => {
    if (!encryptionGates.length) return;
    const chainId = Number(registryChainId || 0) || null;
    setGateSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      workerResourceKeys.forEach((key) => {
        const resourceGate = resolveResourceGate(resourceGateMap[key], encryptionGates[0]?.id, encryptionGates);
        if (!resourceGate) return;
        const sbts = resourceGate.sbts;
        const mode = resourceGate.mode || 'any';
        const prevGate = next[key] || {};
        const sameSbts = areSbtSelectionsEqual(prevGate.sbts, sbts);
        const sameMode = (prevGate.mode || 'any') === mode;
        const sameChain = Number(prevGate.chainId || 0) === Number(chainId || 0);
        if (!sameSbts || !sameMode || !sameChain) {
          next[key] = { ...prevGate, sbts, mode, chainId };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [encryptionGates, registryChainId, resourceGateMap, workerResourceKeys]);

  useEffect(() => {
    if (!encryptionGates.length) return;
    const chainId = Number(registryChainId || 0) || null;
    const litChain = resolveLitChain({ chainId });
    // In /new, the default gate selection drives both the encryption defaultGateId and
    // the on-chain "default" resource gate snapshot used during registration.
    const resolvedDefaultGateId = defaultGateId || encryptionGates[0]?.id || '';
    setDraft((prev) => {
      const next = deepClone(prev);
      const gates: Record<string, UnknownRecord> = {};
      encryptionGates.forEach((gate) => {
        const gateId = toStr(gate?.id).trim();
        if (!gateId) return;
        const sbtAddresses = normalizeSbtSelection(gate.sbts || [])
          .map((sbt) => sbt.address)
          .filter(Boolean);
        gates[gateId] = {
          type: 'sbt',
          label: gate.label,
          sbtAddresses,
          sbtAddress: sbtAddresses[0],
          chainId,
          litChain,
          mode: gate.mode,
        };
      });
      const resources: UnknownRecord = {};
      workerResourceKeys.forEach((key) => {
        const resourceGate = resolveResourceGate(resourceGateMap[key], resolvedDefaultGateId, encryptionGates);
        if (!resourceGate) return;
        resources[key] = {
          gateId: resourceGate.gateId,
          ...(Array.isArray(resourceGate.gateIds) && resourceGate.gateIds.length > 1
            ? { gateIds: resourceGate.gateIds }
            : {}),
          ...(key === 'ai' ? { provider: next.ai?.mode || '' } : {}),
        };
      });
      next.sponsored = {
        ...(next.sponsored && typeof next.sponsored === 'object' ? next.sponsored : {}),
        defaultGateId: resolvedDefaultGateId || undefined,
        gates,
        resources,
      };
      if (next.lit && typeof next.lit === 'object' && resolvedDefaultGateId) {
        next.lit.defaultGateId = resolvedDefaultGateId;
      }
      return next;
    });
  }, [defaultGateId, encryptionGates, registryChainId, resourceGateMap, workerResourceKeys]);

  const {
    latestChainBlock,
    latestBlockStatus,
    blockLimitDuration,
    setBlockLimitDuration,
    blockLimitUnit,
    setBlockLimitUnit,
    markBlockStartManual,
  } = useSessionWizardBlockLimits<DraftState>({
    registryChainId,
    draftBlockLimitStart: draft?.blockLimits?.start,
    setDraft,
    updateDraftValueRef,
  });

  const aiModelProviderPatch = useMemo(() => resolveSessionWizardAiModelProviderPatch(draft?.ai), [draft?.ai]);
  useEffect(() => {
    if (!aiModelProviderPatch.hasChanges) return;
    setDraft((prev) => {
      const next = deepClone(prev);
      const nextAi = (next.ai && typeof next.ai === 'object' ? next.ai : {}) as DraftAiState;
      const nextModels = (
        nextAi.models && typeof nextAi.models === 'object' ? nextAi.models : {}
      ) as DraftAiModelsState;
      next.ai = nextAi;
      nextAi.models = nextModels;
      if (aiModelProviderPatch.models.fast !== undefined) {
        const fastModel = (
          nextModels.fast && typeof nextModels.fast === 'object' ? nextModels.fast : {}
        ) as UnknownRecord;
        fastModel.model = aiModelProviderPatch.models.fast;
        nextModels.fast = fastModel;
      }
      if (aiModelProviderPatch.models.thinking !== undefined) {
        const thinkingModel = (
          nextModels.thinking && typeof nextModels.thinking === 'object' ? nextModels.thinking : {}
        ) as UnknownRecord;
        thinkingModel.model = aiModelProviderPatch.models.thinking;
        nextModels.thinking = thinkingModel;
      }
      return next;
    });
  }, [aiModelProviderPatch]);

  const defaultSponsoredGateId = toStr(draft?.sponsored?.defaultGateId).trim();
  const defaultSponsoredGate = defaultSponsoredGateId ? draft?.sponsored?.gates?.[defaultSponsoredGateId] : null;
  const defaultSponsoredSbtAddress = toStr(defaultSponsoredGate?.sbtAddress || '').trim();
  const defaultSponsoredLookupSlug = resolvedActiveSessionSlug || draft?.slug || '';
  const defaultSponsoredLookupContracts = useStableSerializedObject(draft?.contracts || {});
  const defaultSponsoredLookupRegistry = useStableSerializedObject(draft?.__registry || {});
  const defaultSponsoredLookupNetworkChainId =
    Number(draft?.networkChainId || registryChainId || DEFAULT_CHAIN_ID || 0) || DEFAULT_CHAIN_ID;
  const defaultSponsoredLookupSessionName = draft?.sessionName || '';
  const defaultSponsoredSbtLookupContext = useMemo(
    () => ({
      slug: defaultSponsoredLookupSlug,
      contracts: defaultSponsoredLookupContracts,
      __registry: defaultSponsoredLookupRegistry,
      networkChainId: defaultSponsoredLookupNetworkChainId,
      sessionName: defaultSponsoredLookupSessionName,
    }),
    [
      defaultSponsoredLookupContracts,
      defaultSponsoredLookupNetworkChainId,
      defaultSponsoredLookupRegistry,
      defaultSponsoredLookupSessionName,
      defaultSponsoredLookupSlug,
    ],
  );
  const defaultSponsoredSbtLookupKey = useMemo(
    () =>
      buildSponsoredSbtLookupContextKey({
        address: defaultSponsoredSbtAddress,
        slug: defaultSponsoredSbtLookupContext.slug,
        sessionName: defaultSponsoredSbtLookupContext.sessionName,
        networkChainId: defaultSponsoredSbtLookupContext.networkChainId,
        contracts: defaultSponsoredSbtLookupContext.contracts,
        registry: defaultSponsoredSbtLookupContext.__registry,
      }),
    [defaultSponsoredSbtAddress, defaultSponsoredSbtLookupContext],
  );
  const seededDefaultSponsoredSbtAddress = toStr(
    normalizeSbtSelection(encryptionGates?.[0]?.sbts || [])[0]?.address || '',
  )
    .trim()
    .toLowerCase();

  useEffect(() => {
    const defaultAddr = defaultSponsoredSbtAddress;
    if (!defaultAddr || !ethers.utils.isAddress(defaultAddr)) return;
    if (seededDefaultSponsoredSbtAddress === defaultAddr.toLowerCase()) {
      if (defaultSponsoredSbtLookupInFlightRef.current === defaultSponsoredSbtLookupKey) {
        defaultSponsoredSbtLookupInFlightRef.current = '';
      }
      return;
    }
    if (defaultSponsoredSbtLookupInFlightRef.current === defaultSponsoredSbtLookupKey) return;
    // Regression guard: unrelated wizard draft updates should not fan out into repeated
    // SBT metadata fetches for the same sponsored default gate.
    defaultSponsoredSbtLookupInFlightRef.current = defaultSponsoredSbtLookupKey;
    let cancelled = false;
    const run = async () => {
      let sbtName: string = defaultAddr;
      try {
        const info = await sessionPublishSbtMetadataAdapter.getSbtMetadata({
          providerName: 'none',
          sbtAddress: defaultAddr,
          groupKeyOrCfg: defaultSponsoredSbtLookupContext,
        });
        const displayName = toStr(getSbtDisplayName(info)).trim();
        if (displayName) sbtName = displayName;
      } catch (e) {
        log.warn('SessionWizard: fallback', e);
      }
      if (cancelled) return;
      const defaultSbt = { address: defaultAddr, name: `${sbtName} (Sponsored SBT)` };
      setEncryptionGates((prev) => {
        if (!prev.length) return prev;
        if (Array.isArray(prev[0].sbts) && prev[0].sbts.length) return prev;
        const next = [...prev];
        next[0] = { ...next[0], sbts: [defaultSbt] };
        return next;
      });
    };
    run().finally(() => {
      if (defaultSponsoredSbtLookupInFlightRef.current === defaultSponsoredSbtLookupKey) {
        defaultSponsoredSbtLookupInFlightRef.current = '';
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    defaultSponsoredSbtAddress,
    defaultSponsoredSbtLookupContext,
    defaultSponsoredSbtLookupKey,
    seededDefaultSponsoredSbtAddress,
  ]);

  function focusNormalModeSection(key: string) {
    const validKeys = showNormalModeWorkerStep
      ? ['metadata', 'encryption', 'worker', 'publish']
      : ['metadata', 'encryption', 'publish'];
    if (!validKeys.includes(key)) return;
    setCollapsedSections((prev) => ({
      ...prev,
      metadata: key !== 'metadata',
      encryption: key !== 'encryption',
      worker: showNormalModeWorkerStep ? key !== 'worker' : true,
      publish: key !== 'publish',
    }));
    if (typeof window !== 'undefined') {
      const scrollToSection = () => {
        const el = document.getElementById(`session-wizard-section-${key}`);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(scrollToSection);
      } else {
        setTimeout(scrollToSection, 0);
      }
    }
  }

  const toggleSection = (key: string) => {
    if (wizardMode !== 'advanced') {
      focusNormalModeSection(key);
      return;
    }
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEnterNormalMode = () => {
    setWizardDisplaySettingsOpen(false);
    clearSelectedBundleFile();
    setWizardMode('normal');
  };

  const handleEnterAdvancedMode = () => {
    setWizardDisplaySettingsOpen(false);
    setWizardMode('advanced');
    const hasQueuedOrSelectedGateSbts =
      normalizePendingSbtDrafts(pendingSbtDrafts).length > 0 ||
      encryptionGates.some((gate) => normalizeSbtSelection(gate?.sbts || []).length > 0);
    if (hasQueuedOrSelectedGateSbts) {
      setCollapsedSections((prev) => ({ ...prev, encryption: false }));
    }
  };

  const allEncryptionGates = useMemo(() => {
    return [...encryptionGates];
  }, [encryptionGates]);

  const getGateById = (gateId: unknown): EncryptionGateState | null =>
    getSessionWizardGateById(allEncryptionGates, gateId) as EncryptionGateState | null;
  const resolveCreateSbtTargetGateId = (requestedGateId: unknown = '') =>
    resolveSessionWizardCreateSbtTargetGateId({
      allEncryptionGates,
      defaultGateId,
      requestedGateId,
    });
  resolveCreateSbtTargetGateIdRef.current = resolveCreateSbtTargetGateId;
  const activeCreateSbtTargetGateId = resolveCreateSbtTargetGateId(createSbtTargetGateId);
  const activeCreateSbtTargetGate = getGateById(activeCreateSbtTargetGateId);
  const focusCreateSbtTargetGate = (gateId: unknown = '') => {
    const resolvedGateId = resolveCreateSbtTargetGateId(gateId);
    if (!resolvedGateId) return;
    setCreateSbtTargetGateId((prev) => (prev === resolvedGateId ? prev : resolvedGateId));
  };

  const buildCreateSbtModalLaunchState = (
    options: SessionWizardCreateSbtLaunchOptions | SessionWizardCreateSbtLaunchState = {},
  ) =>
    buildSessionWizardCreateSbtModalLaunchState({
      options,
      allEncryptionGates,
      defaultGateId,
      currentDraftSlug: draftRef.current?.slug || '',
      currentArweaveJwk: getEnabledWorkerArweaveJwk(workerSecretsRef.current),
    });

  const openCreateSbtModal = (
    options: SessionWizardCreateSbtLaunchOptions | SessionWizardCreateSbtLaunchState = {},
  ) => {
    const nextModalState = buildCreateSbtModalLaunchState(options);
    setCreateSbtModalState({
      open: true,
      ...nextModalState,
    });
  };
  openCreateSbtModalRef.current = openCreateSbtModal;

  const launchCreateSbtModal = (
    options: SessionWizardCreateSbtLaunchOptions | SessionWizardCreateSbtLaunchState = {},
  ) => {
    const nextModalState = buildCreateSbtModalLaunchState(options);
    if (loginComplete !== true) {
      setPendingCreateSbtLaunch(nextModalState);
      if (typeof toggleLoginModal === 'function') toggleLoginModal(true);
      return;
    }
    setPendingCreateSbtLaunch(null);
    openCreateSbtModal(nextModalState);
  };

  const closeCreateSbtModal = () => {
    setCreateSbtModalState((prev) => ({ ...prev, open: false }));
  };

  const openContractViewerModal = useCallback((contractKey = '') => {
    setContractViewerModalState({
      open: true,
      contractKey: toStr(contractKey).trim(),
    });
  }, []);

  const closeContractViewerModal = useCallback(() => {
    setContractViewerModalState({
      open: false,
      contractKey: '',
    });
  }, []);

  useSessionWizardLiveRefs({
    draft,
    draftRef,
    deployForm,
    deployFormRef,
    account,
    resolvedWalletAccountRef,
    deployComplete,
    deployCompleteRef,
    deployWorkerUrl,
    deployWorkerUrlRef,
    provisionedSponsoredContext,
    provisionedSponsoredContextRef,
    workerSecretsEnabled,
    workerSecretsEnabledRef,
    persistWorkerSecrets,
    persistWorkerSecretsRef,
    workerSecrets,
    workerSecretsRef,
  });

  useEffect(() => {
    if (!toStr(account).trim() || !pendingCreateSbtLaunch) return;
    if (typeof toggleLoginModalRef.current === 'function') toggleLoginModalRef.current(false);
    openCreateSbtModalRef.current?.(pendingCreateSbtLaunch);
    setPendingCreateSbtLaunch(null);
  }, [account, pendingCreateSbtLaunch]);

  useEffect(() => {
    const resolvedGateId = resolveCreateSbtTargetGateIdRef.current?.(createSbtTargetGateId) || '';
    if (resolvedGateId !== toStr(createSbtTargetGateId).trim()) {
      setCreateSbtTargetGateId(resolvedGateId);
    }
  }, [createSbtTargetGateId, defaultGateId, encryptionGates]);

  const gateOptions = useMemo(() => buildSessionWizardGateOptions(allEncryptionGates), [allEncryptionGates]);

  const togglePrivateSlugMode = () => {
    if (slugPinnedByPendingSbtDrafts) return;
    setPrivateSlugMode((prev) => {
      const next = !prev;
      setDraft((current) => {
        const nextDraft = deepClone(current);
        if (next) {
          const currentSlug = toStr(current.slug).trim();
          lastManualSlugRef.current = currentSlug;
          const desiredSlug = sessionRegistryPublishAdapter.formatSessionId(sessionId) || toStr(sessionId).trim();
          if (desiredSlug) {
            nextDraft.slug = desiredSlug;
          }
        } else {
          nextDraft.slug = lastManualSlugRef.current || '';
        }
        return nextDraft;
      });
      return next;
    });
  };
  togglePrivateSlugModeRef.current = togglePrivateSlugMode;

  const updateDraftValue = (path: string[], value: unknown) => {
    if (pathKey(path) === 'slug' && !privateSlugMode) {
      lastManualSlugRef.current = toStr(value).trim();
    }
    setDraft((prev) => {
      const next = deepClone(prev);
      setValueAtPath(next, path, value);
      draftRef.current = next;
      return next;
    });
  };
  updateDraftValueRef.current = updateDraftValue;

  const updateArrayValue = (path: string[], raw: string, asJson = false) => {
    try {
      if (asJson) {
        const parsed = JSON.parse(raw);
        updateDraftValue(path, parsed);
        setFieldErrors((prev) => ({ ...prev, [pathKey(path)]: '' }));
        return;
      }
      updateDraftValue(path, parseListInput(raw));
      setFieldErrors((prev) => ({ ...prev, [pathKey(path)]: '' }));
    } catch (err) {
      setFieldErrors((prev) => ({ ...prev, [pathKey(path)]: 'Invalid JSON' }));
    }
  };

  const updateEncryptionGate = (gateId: string, updates: Partial<EncryptionGateState>) => {
    const normalizedUpdates = { ...updates };
    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'sbts')) {
      normalizedUpdates.sbts = dedupeSbtSelection(normalizedUpdates.sbts || []);
    }
    setEncryptionGates((prev) => prev.map((gate) => (gate.id === gateId ? { ...gate, ...normalizedUpdates } : gate)));
  };

  const addEncryptionGate = () => {
    setEncryptionGates((prev) => {
      const idx = getNextGateIndex(prev);
      const next = [...prev, buildEncryptionGate(idx) as EncryptionGateState];
      return next.sort((a, b) => {
        const matchA = /^gate-(\d+)$/.exec(toStr(a?.id).trim());
        const matchB = /^gate-(\d+)$/.exec(toStr(b?.id).trim());
        const numA = matchA ? Number.parseInt(matchA[1], 10) : Number.POSITIVE_INFINITY;
        const numB = matchB ? Number.parseInt(matchB[1], 10) : Number.POSITIVE_INFINITY;
        if (numA !== numB) return numA - numB;
        return toStr(a?.id).localeCompare(toStr(b?.id));
      });
    });
  };

  const removeEncryptionGate = (gateId: unknown) => {
    const gateIdStr = toStr(gateId).trim();
    setEncryptionGates((prev) => prev.filter((gate) => gate.id !== gateIdStr));
    setEncryptedFieldGates((prev) => {
      const next = { ...(prev || {}) };
      Object.keys(next).forEach((key) => {
        const value = next[key];
        if (Array.isArray(value)) {
          const filtered = value.map((id) => toStr(id).trim()).filter((id) => id && id !== gateIdStr);
          if (!filtered.length) {
            delete next[key];
          } else {
            next[key] = filtered.length === 1 ? filtered[0] : filtered;
          }
          return;
        }
        if (toStr(value).trim() === gateIdStr) delete next[key];
      });
      return next;
    });
  };

  const {
    clearPendingSbtDrafts,
    handleGateAddSbt,
    handleGateRemoveSbt,
    handleRemoveDefaultFeaturedSbt,
    handleSavePendingSbtDraft,
    pendingSbtSelectorOptions,
    promoteDeployedPendingSbtSelections,
    removePendingSbtDraft,
  } = useSessionWizardPendingSbtController<EncryptionGateState>({
    allEncryptionGates,
    createSbtModalState,
    draftDefaultFeaturedSBTs: draft?.defaultFeaturedSBTs,
    draftRef,
    encryptionGates,
    featuredDraftGateAutoLink,
    network,
    pendingSbtDeployContextSignature,
    pendingSbtDrafts,
    registryChainId,
    closeCreateSbtModal,
    resolveCreateSbtTargetGateId,
    setEncryptionGates,
    setFeaturedDraftGateAutoLink,
    setPendingSbtDrafts,
    setStatus,
    updateDraftValue,
  });

  const handleUploadMetadata = async ({
    workerUrlOverride = '',
    signerAccountOverride = '',
  }: Partial<SessionWizardPublishWorkerSignerArgs> = {}) => {
    let uploadRequestId = '';
    try {
      const rawSlug = toStr(draft.slug).trim();
      const slugValidationError = getSessionSlugValidationError(rawSlug);
      if (slugValidationError) {
        throw new Error(slugValidationError);
      }
      setStatus('Preparing metadata…');
      const authAccount = toStr(signerAccountOverride || resolvedWalletAccountRef.current || account).trim();
      const { metadata, onChainFields } = await buildMetadataPayload({
        workerUrlOverride,
        signerAccountOverride: authAccount,
      });
      setStatus('Uploading to Arweave…');
      let arweaveJwk = toStr(getCurrentWorkerSecrets().arweaveJwk).trim();
      if (!arweaveJwk && !workerSecretsEnabled) {
        const resolved = await getEffectiveArweaveKey({
          sessionConfig: draft as SessionConfig,
          sessionSlug: draft.slug || '',
          context: { account: authAccount, providerLike: provider, chainId: draft.networkChainId || registryChainId },
        });
        arweaveJwk = resolved?.arweaveJwk || '';
      }
      uploadRequestId = `arw_meta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const baseUrl =
        workerAuthPublishAdapter.normalizeWorkerUrl(toStr(workerUrlOverride).trim()) || resolveWorkerBaseUrl();
      const uploadAuthOptions = await buildSessionWizardPublishArweaveUploadOptions({
        arweaveJwk,
        workerUrl: baseUrl,
        sessionSlug: draft.slug,
        authAccount,
      });
      log.info('[arweave][ui] metadata upload start', {
        requestId: uploadRequestId,
        workerUrl: uploadAuthOptions.forceDirectArweaveUpload ? null : uploadAuthOptions.workerUrl || null,
        sessionSlug: draft.slug || '',
        adminAddress: null,
        hasJwk: !!uploadAuthOptions.arweaveJwk,
        ts: new Date().toISOString(),
      });
      const txId = (await arweavePublishAdapter.uploadDataToArweave({
        data: metadata,
        format: 'json',
        options: {
          sessionConfig: draft as SessionConfig,
          sessionSlug: draft.slug || '',
          context: { account: authAccount, providerLike: provider, chainId: draft.networkChainId || registryChainId },
          requestId: uploadRequestId,
          ...uploadAuthOptions,
        },
      })) as string;
      log.info('[arweave][ui] metadata upload success', {
        requestId: uploadRequestId,
        txId,
        ts: new Date().toISOString(),
      });
      const metadataUri = `ar://${txId}`;
      setMetadataTxId(txId);
      setMetadataUrl(metadataUri);
      setPendingOnChainFields(onChainFields || {});
      setStatus('Uploaded metadata to Arweave.');
      clearCachedArweaveJwkAfterUpload();
      return { txId, metadataUri, onChainFields: onChainFields || {} };
    } catch (err) {
      log.error('[arweave][ui] metadata upload error', {
        requestId: uploadRequestId || null,
        message: getSessionWizardErrorMessage(err),
        ts: new Date().toISOString(),
      });
      const errorMessage = getSessionWizardErrorMessage(err, 'Failed to upload metadata.');
      setStatus(errorMessage);
      throw err instanceof Error ? err : new Error(errorMessage);
    }
  };

  const buildDeferredCreateSbtComponentProps = ({
    sessionSlugOverride = '',
    workerUrlOverride = '',
    accountOverride = '',
  } = {}) =>
    buildSessionWizardDeferredCreateSbtComponentProps({
      account,
      accountOverride,
      defaultGateId,
      draft: draftRef.current,
      encryptionGates,
      getChainById,
      getChainName,
      getEnabledWorkerArweaveJwk,
      network,
      normalizeSbtSelection,
      normalizeWorkerAuthUrl: workerAuthPublishAdapter.normalizeWorkerUrl,
      provider,
      registryChainId,
      resolvedActiveSessionSlug,
      resolvedWalletAccount: resolvedWalletAccountRef.current,
      sessionSlugOverride,
      signAdminAction: signBootstrapAdminAction,
      toggleLoginModal,
      workerSecrets: workerSecretsRef.current,
      workerUrlOverride,
    });

  const deployPendingSbtDrafts = async ({ workerUrlOverride = '', signerAccountOverride = '' } = {}) => {
    const draftsToDeploy = normalizePendingSbtDrafts(pendingSbtDrafts).filter((entry) => entry.deployed !== true);
    if (!draftsToDeploy.length) return [];

    const sessionConfigForDeploy = {
      ...(draft && typeof draft === 'object' ? draft : {}),
      slug: resolvedActiveSessionSlug || draft.slug || '',
      networkChainId: Number(draft.networkChainId || registryChainId || network?.id || network?.chainId || 0) || null,
      contracts: draft && typeof draft.contracts === 'object' ? draft.contracts : {},
    };
    const deployContextSignature = buildPendingSbtDeployContextSignature(
      sessionConfigForDeploy,
      registryChainId || network?.id || network?.chainId || null,
    );
    const incompatibleDraft = draftsToDeploy.find((entry) => {
      const storedSignature = toStr(
        entry?.deploymentContextSignature ||
          buildPendingSbtDeployContextSignature(
            {
              networkChainId: entry?.networkChainId,
              contracts: {
                sbtFactory: {
                  address: entry?.sbtFactoryAddress,
                },
              },
            },
            null,
          ),
      ).trim();
      return !!storedSignature && storedSignature !== deployContextSignature;
    });
    if (incompatibleDraft) {
      throw new Error(
        'Pending SBT drafts were created for a different session chain or SBT factory. Recreate them before publishing.',
      );
    }

    const deployedDrafts = [];
    for (let index = 0; index < draftsToDeploy.length; index += 1) {
      const sbtDraft = draftsToDeploy[index];
      const needsMetadataFinalization = !toStr(sbtDraft.tokenURI).trim();
      setStatus(
        needsMetadataFinalization
          ? `Finalizing ${t('sbt')} ${index + 1}/${draftsToDeploy.length}: ${sbtDraft.displayName}…`
          : `Deploying ${t('sbt')} ${index + 1}/${draftsToDeploy.length}: ${sbtDraft.displayName}…`,
      );
      const { finalizedDraft, receipt } = await deploySessionWizardPendingSbtDraft({
        sbtDraft,
        providerLike: provider,
        sessionConfigForDeploy,
        workerUrlOverride,
        createSbtComponentProps: buildDeferredCreateSbtComponentProps({
          sessionSlugOverride: sbtDraft.sessionSlug,
          workerUrlOverride,
          accountOverride: signerAccountOverride,
        }),
      });
      if (toStr(finalizedDraft.tokenURI).trim() !== toStr(sbtDraft.tokenURI).trim()) {
        setPendingSbtDrafts((prev) =>
          prev.map((entry) =>
            toStr(entry?.predictedAddress).trim().toLowerCase() ===
            toStr(finalizedDraft.predictedAddress).trim().toLowerCase()
              ? {
                  ...entry,
                  tokenURI: finalizedDraft.tokenURI,
                  metadataUploadStatus: finalizedDraft.metadataUploadStatus || 'ready',
                  metadataPreview: finalizedDraft.metadataPreview || entry?.metadataPreview || null,
                  authoringPayload: finalizedDraft.authoringPayload || entry?.authoringPayload,
                }
              : entry,
          ),
        );
      }

      const sbtAddress = sbtFactoryReceiptPublishAdapter.resolveSbtAddressFromFactoryReceipt({ receipt });
      if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) {
        throw new Error(`Failed to resolve deployed address for ${finalizedDraft.displayName}.`);
      }
      if (toStr(finalizedDraft.predictedAddress).trim().toLowerCase() !== sbtAddress.toLowerCase()) {
        throw new Error(
          `Deterministic deploy mismatch for ${finalizedDraft.displayName}: expected ${finalizedDraft.predictedAddress}, received ${sbtAddress}.`,
        );
      }

      persistSessionWizardSbtRecoveryCodes({
        finalizedDraft,
        sbtAddress,
        sessionConfigForDeploy,
      });

      const deployedDraft = {
        ...finalizedDraft,
        tokenURI: finalizedDraft.tokenURI,
        metadataUploadStatus: finalizedDraft.metadataUploadStatus || sbtDraft.metadataUploadStatus || 'ready',
        metadataPreview: finalizedDraft.metadataPreview || sbtDraft.metadataPreview || null,
        authoringPayload: finalizedDraft.authoringPayload || sbtDraft.authoringPayload,
        deployed: true,
        deployedAddress: sbtAddress,
        deploymentTxHash: receipt?.transactionHash || '',
      };
      deployedDrafts.push(deployedDraft);

      setPendingSbtDrafts((prev) =>
        prev.map((entry) =>
          toStr(entry?.predictedAddress).trim().toLowerCase() === sbtAddress.toLowerCase()
            ? { ...entry, ...deployedDraft }
            : entry,
        ),
      );
    }

    return deployedDrafts;
  };

  const resolveAvailableRegisterIdentity = async () => {
    const registerIdentityDescriptor = resolveSessionWizardRegisterIdentityDescriptor({
      draftSlug: draft.slug,
      sessionId,
      registryChainId,
      sessionNetworkChainId: draft.networkChainId,
      registryAddress,
    });
    if (registerIdentityDescriptor.status === 'blocked') {
      throw new Error(registerIdentityDescriptor.statusMessage);
    }
    const { registrySlug, sessionIdHexValue, registryChainIdValue } = registerIdentityDescriptor;
    const registerDuplicateCheckDescriptor = resolveSessionWizardRegisterDuplicateCheckDescriptor({
      registryChainId: registryChainIdValue,
      registrySlug,
      sessionIdHexValue,
    });
    try {
      const registryRead = sessionRegistryPublishAdapter.getRegistryContract({
        chainId: registerDuplicateCheckDescriptor.chainId,
        providerLike: null,
      }) as SessionRegistryReadContract | null;
      if (registryRead) {
        if (registerDuplicateCheckDescriptor.shouldCheckSlug && typeof registryRead.sessionExists === 'function') {
          const slugExists = await registryRead.sessionExists(registerDuplicateCheckDescriptor.registrySlug);
          if (slugExists) {
            throw new Error(registerDuplicateCheckDescriptor.slugDuplicateMessage);
          }
        }
        if (
          registerDuplicateCheckDescriptor.shouldCheckSessionId &&
          typeof registryRead.sessionIdExists === 'function'
        ) {
          const idExists = await registryRead.sessionIdExists(registerDuplicateCheckDescriptor.sessionIdHexValue);
          if (idExists) {
            throw new Error(registerDuplicateCheckDescriptor.sessionIdDuplicateMessage);
          }
        }
      }
    } catch (err) {
      const message = getSessionWizardErrorMessage(err);
      if (isSessionWizardRegisterDuplicatePreflightError(message, registerDuplicateCheckDescriptor)) throw err;
      if (message) {
        console.warn('SessionWizard: duplicate preflight check unavailable; continuing to publish flow', err);
      }
    }
    return registerIdentityDescriptor;
  };

  const handleRegisterGroup = async ({
    metadataUriOverride,
    sessionFieldsOverride,
  }: SessionWizardRegisterGroupArgs = {}) => {
    try {
      const registerIdentityDescriptor = await resolveAvailableRegisterIdentity();
      const { registrySlug, sessionIdHexValue, registryChainIdValue } = registerIdentityDescriptor;
      const registerPreflightDescriptor = resolveSessionWizardRegisterPreflightDescriptor({
        providerLike: provider,
        registryChainId: registryChainIdValue,
        sessionNetworkChainId: draft.networkChainId,
        registryAddress,
        registrySlug,
        sessionIdHexValue,
        metadataUriOverride,
        manualMetadataUrl,
        metadataUrl,
        gateSelectionsSnapshot: buildGateSelectionsSnapshot(),
        sessionFieldsOverride,
        pendingOnChainFields,
        manualGasLimit,
        manualGasPriceGwei,
        manualMaxFeePerGasGwei,
        manualMaxPriorityFeePerGasGwei,
      });
      if (!registerPreflightDescriptor.canRegister) {
        throw new Error(registerPreflightDescriptor.statusMessage);
      }
      await runSessionWizardRegisterStepController({
        input: {
          registerArgs: registerPreflightDescriptor.registerArgs,
        },
        ports: {
          registerSessionOnChain: (args) => sessionRegistryPublishAdapter.registerSession(args),
        },
        callbacks: {
          setRegisterTxs,
          setStatus,
        },
      });
      const registerSuccessSettlement = resolveSessionWizardRegisterSuccessSettlementDescriptor({
        registrySlug,
        sessionIdHexValue,
        registryChainId: registryChainIdValue,
        sessionNetworkChainId: draft.networkChainId,
        providerLike: provider,
        account,
      });
      setSessionUrl(registerSuccessSettlement.sessionUrl);
      setAdminUrl(registerSuccessSettlement.adminUrl);
      setAdminUrlStatus(registerSuccessSettlement.adminUrlStatus);
      clearSessionWizardCache();
      const nextSessionId = generateSessionId();
      setSessionId(nextSessionId);
      setSessionIdStatus(registerSuccessSettlement.nextSessionIdStatus);
      try {
        const refreshed = await sessionRegistryPublishAdapter.fetchSessionFromRegistry({
          ...registerSuccessSettlement.registryRefreshArgs,
          lit: getGlobalLitHooks(),
        });
        if (refreshed) {
          sessionRegistryPublishAdapter.upsertSessionRegistryCache({ config: refreshed });
        }
      } catch (e) {
        log.warn('SessionWizard: fallback', e);
      }
    } catch (err) {
      const registerFailureSettlement = resolveSessionWizardRegisterFailureSettlementDescriptor({ error: err });
      if (registerFailureSettlement.txEntry) {
        setRegisterTxs((prev) => appendSessionWizardRegisterTxEntry(prev, registerFailureSettlement.txEntry));
      }
      setStatus(registerFailureSettlement.errorMessage);
      throw err instanceof Error ? err : new Error(registerFailureSettlement.errorMessage);
    }
  };

  const handlePublish = async () => {
    if (!draft?.sessionModeProfile) {
      setStatus('Choose a session mode before publishing.');
      return;
    }
    if (publishRequestInFlightRef.current) {
      setStatus('Publish already in progress.');
      return;
    }
    publishRequestInFlightRef.current = true;
    try {
      const publishStartPreflightDescriptor = resolveSessionWizardPublishStartPreflightDescriptor({
        publishBusy,
        draftSlug: draft?.slug,
        loginComplete,
        loginInProgress,
      });
      if (publishStartPreflightDescriptor.status === 'blocked') {
        if (publishStartPreflightDescriptor.shouldResetPublishState) {
          dispatchSessionPublish({ type: 'edit' });
          setSessionUrl('');
          setPublishedPendingSbtLinks([]);
        }
        if (publishStartPreflightDescriptor.shouldOpenLoginModal && typeof toggleLoginModal === 'function') {
          toggleLoginModal(true);
        }
        if (publishStartPreflightDescriptor.statusMessage) {
          setStatus(publishStartPreflightDescriptor.statusMessage);
        }
        return;
      }
      if (sessionModeRequirements.publish.registerSession) {
        try {
          await resolveAvailableRegisterIdentity();
        } catch (err) {
          const publishFailureSettlement = resolveSessionWizardPublishFailureSettlementDescriptor({ error: err });
          setStatus(publishFailureSettlement.errorMessage);
          dispatchSessionPublish({ type: 'edit' });
          return;
        }
      }
      dispatchSessionPublish({ type: 'edit' });
      setSessionUrl('');
      setPublishedPendingSbtLinks([]);
      const resolvedPublisher = await resolveConnectedAdminAddress();
      const publishAdminPreflightDescriptor = resolveSessionWizardPublishAdminPreflightDescriptor({
        resolvedPublisher,
      });
      if (publishAdminPreflightDescriptor.status === 'blocked') {
        if (publishAdminPreflightDescriptor.shouldOpenLoginModal && typeof toggleLoginModal === 'function') {
          toggleLoginModal(true);
        }
        if (publishAdminPreflightDescriptor.statusMessage) {
          setStatus(publishAdminPreflightDescriptor.statusMessage);
        }
        return;
      }
      const signerAccountOverride = publishAdminPreflightDescriptor.signerAccountOverride;
      let activeSessionPublishEffect: SessionPublishEffect = 'checkRequirements';
      const runTrackedPublishEffect = <Result,>(
        effect: SessionPublishEffect,
        run: () => Promise<Result>,
      ): Promise<Result> => {
        activeSessionPublishEffect = effect;
        return run();
      };
      try {
        const pendingDraftSnapshot = normalizePendingSbtDrafts(pendingSbtDrafts);
        const currentWorkerSecrets = getCurrentWorkerSecrets();
        const sponsoredAutoDeployState = resolveSessionWizardSponsoredAutoDeployReadiness({
          wizardMode,
          sponsoredBundle: sponsoredBundleAppliedBundleRef.current,
          deployForm: deployFormRef.current,
          workerSecretsEnabled: workerSecretsEnabledRef.current,
          currentWorkerSecrets,
          getMissingWorkerSecretsForDeploy,
          hasBundleFile: !!bundleFile,
          normalModeBundleUrlOverride,
        });
        const publishRequestDescriptor = resolveSessionWizardPublishRequestDescriptor({
          pendingDraftSnapshot,
          manualMetadataUrl,
          workerMode,
          sponsoredAutoDeployReady: sponsoredAutoDeployState.ready,
          deployComplete,
          canUploadMetadataNow,
          sessionModeProfile: draft.sessionModeProfile as SessionModeProfile,
        });
        const { publishExecutionPlan } = publishRequestDescriptor;
        beginSessionPublishReducerAttempt(dispatchSessionPublish, publishExecutionPlan);
        let uploadResult = null;
        let workerUrlOverride = '';
        let deployedPendingDrafts = [];
        const publishControllerResult = await sessionWizardPublishRuntimeController.runPreparation({
          publishExecutionPlan,
          signerAccountOverride,
          runTrackedPublishEffect,
        });
        workerUrlOverride = publishControllerResult.workerUrlOverride;
        deployedPendingDrafts = publishControllerResult.deployedPendingDrafts;
        const metadataUploadRequest = resolveSessionWizardPublishMetadataUploadRequest({
          publishExecutionPlan,
          workerUrlOverride,
          signerAccountOverride,
        });
        const metadataUploadControllerResult = await runSessionWizardPublishMetadataUploadController({
          request: metadataUploadRequest,
          ports: {
            uploadMetadata: (args) =>
              runSessionPublishEffect({
                dispatch: dispatchSessionPublish,
                effect: 'uploadMetadata',
                getErrorMessage: getSessionWizardErrorMessage,
                run: () => runTrackedPublishEffect('uploadMetadata', () => handleUploadMetadata(args)),
                result: (result) => ({ metadataUri: result?.metadataUri || '' }),
              }),
          },
          callbacks: { setPublishStep: ignoreSessionPublishStep },
        });
        uploadResult = metadataUploadControllerResult.uploadResult;
        await sessionWizardPublishRuntimeController.settleRegistration({
          publishExecutionPlan,
          uploadResult,
          publishControllerResult,
          runTrackedPublishEffect,
        });
        const completionRequest = resolveSessionWizardPublishCompletionRequest({
          publishExecutionPlan,
          deployedPendingDrafts,
          pendingDraftSnapshot: publishRequestDescriptor.pendingDraftSnapshot,
          sessionSlug: draft?.slug,
        });
        runSessionWizardPublishCompletionController({
          input: completionRequest,
          ports: {
            normalizePendingDrafts: normalizePendingSbtDrafts,
            buildPublishedPendingSbtLinks,
          },
          callbacks: {
            promoteDeployedPendingSbtSelections,
            setPublishedPendingSbtLinks,
            clearPendingSbtDrafts: () => setPendingSbtDrafts([]),
            setPublishStep: ignoreSessionPublishStep,
          },
        });
      } catch (err) {
        const publishFailureSettlement = resolveSessionWizardPublishFailureSettlementDescriptor({ error: err });
        markSessionPublishEffectFailed(
          dispatchSessionPublish,
          activeSessionPublishEffect,
          publishFailureSettlement.errorMessage,
        );
        setStatus(publishFailureSettlement.errorMessage);
      }
    } finally {
      publishRequestInFlightRef.current = false;
    }
  };

  const scheduleAdminUrlStatusReset = () => {
    if (adminUrlStatusTimerRef.current) {
      clearTimeout(adminUrlStatusTimerRef.current);
      adminUrlStatusTimerRef.current = null;
    }
    adminUrlStatusTimerRef.current = setTimeout(() => {
      adminUrlStatusTimerRef.current = null;
      setAdminUrlStatus('');
    }, 2500);
  };

  const scheduleSessionIdStatusReset = () => {
    if (sessionIdStatusTimerRef.current) {
      clearTimeout(sessionIdStatusTimerRef.current);
      sessionIdStatusTimerRef.current = null;
    }
    sessionIdStatusTimerRef.current = setTimeout(() => {
      sessionIdStatusTimerRef.current = null;
      setSessionIdStatus('');
    }, 2500);
  };

  const scheduleJsonCopiedReset = () => {
    if (jsonCopiedTimerRef.current) {
      clearTimeout(jsonCopiedTimerRef.current);
      jsonCopiedTimerRef.current = null;
    }
    jsonCopiedTimerRef.current = setTimeout(() => {
      jsonCopiedTimerRef.current = null;
      setJsonCopied(false);
    }, 1500);
  };

  const handleCopyAdminUrl = async () => {
    const url = toStr(adminUrl).trim();
    if (!url) {
      setAdminUrlStatus('Admin URL unavailable yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notify.success('Copied to clipboard');
      setAdminUrlStatus('Admin URL copied.');
    } catch {
      setAdminUrlStatus('Copy failed. Select the URL manually.');
    }
    scheduleAdminUrlStatusReset();
  };

  const sessionIdDisplay = sessionRegistryPublishAdapter.formatSessionId(sessionId) || toStr(sessionId).trim();

  const handleCopySessionId = async () => {
    const value = sessionIdDisplay || '';
    if (!value) {
      setSessionIdStatus('Enter a valid session ID first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      notify.success('Copied to clipboard');
      setSessionIdStatus('Copied session ID.');
    } catch {
      setSessionIdStatus('Copy failed.');
    }
    scheduleSessionIdStatusReset();
  };

  const handleRegenerateSessionId = () => {
    if (slugPinnedByPendingSbtDrafts && privateSlugMode) {
      setSessionIdStatus('Remove queued SBT drafts before changing the session URL.');
      scheduleSessionIdStatusReset();
      return;
    }
    if (isSessionIdRegenerating) return;
    const next = generateSessionId();
    setSessionId(next);
    setSessionIdStatus('Generated a new session ID.');
    setIsSessionIdRegenerating(true);
    if (sessionIdRotationTimerRef.current) {
      clearTimeout(sessionIdRotationTimerRef.current);
    }
    sessionIdRotationTimerRef.current = setTimeout(() => {
      setIsSessionIdRegenerating(false);
      sessionIdRotationTimerRef.current = null;
    }, 650);
    scheduleSessionIdStatusReset();
  };

  const handleCopyDraftJson = () => {
    navigator.clipboard
      .writeText(JSON.stringify(draft, null, 2))
      .then(() => {
        notify.success('Copied to clipboard');
        setJsonCopied(true);
        scheduleJsonCopiedReset();
      })
      .catch((e) => {
        void e;
        notify.warn('Copy failed');
      });
  };

  const {
    buildSessionWizardPublishArweaveUploadOptions,
    buildSponsoredFlagFields,
    clearCachedArweaveJwkAfterUpload,
    clearCachedWorkerSecretsAfterDeploy,
    clearWorkerSecretFields,
    effectiveDefaultWorkerRpcUrl,
    getMissingWorkerSecretsForDeploy,
    getResourceSecretFields,
    parseAllowOriginsInput,
    resolveWorkerBaseUrl,
    resolveWorkerFaucetConfig,
    resolveWorkerRpcUrl,
    resolveWorkerRpcUrlMap,
    resolvedWorkerBaseUrlForDelegation,
    signBootstrapAdminAction,
    signTypedAdminAction,
  } = useSessionWizardWorkerSecretsController({
    account,
    provider,
    network,
    draft,
    wizardMode,
    deployComplete,
    deployWorkerUrl,
    workerMode,
    workerSecrets,
    workerSecretsEnabled,
    workerAllowOrigins,
    provisionedSponsoredContext,
    effectivePersistWorkerSecrets,
    registryChainId,
    allowNormalModeSharedHostedWorker: NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED,
    getCurrentWorkerSecrets,
    getCurrentEnabledWorkerSecrets,
    applyWorkerSecretsUpdate,
    updateDraftValue,
    resolvedWalletAccountRef,
    resolveChipotleHookConfig: resolveSessionWizardChipotleHookConfig,
  });

  const buildMetadataPayload = buildSessionWizardMetadataPayloadBuilder({
    account,
    allEncryptionGates,
    buildSessionWizardPublishArweaveUploadOptions,
    buildSponsoredFlagFields,
    defaultGateId,
    draft,
    encryptedFieldGates,
    gateSelections,
    getCurrentWorkerSecrets,
    getGateById,
    latestChainBlock,
    network,
    provider,
    registryChainId,
    resolveWorkerBaseUrl,
    resolvedWalletAccountRef,
    sessionHeaderFile,
    sessionHeaderMode,
    sessionId,
    setSessionHeaderStatus,
    toggleLoginModal,
    workerSecretsEnabled,
  });

  // Build a snapshot of gate selections from the current gate UI (default gate + resource mapping).
  // This keeps on-chain resource gates aligned with the selected default gate even if state updates are still pending.
  const buildGateSelectionsSnapshot = () => {
    const chainId = Number(registryChainId || draft.networkChainId || 0) || null;
    const resolvedDefaultGateId = defaultGateId || encryptionGates[0]?.id || '';
    const snapshot: GateSelectionsState = {};
    workerResourceKeys.forEach((key) => {
      const gate = resolveResourceGate(resourceGateMap[key], resolvedDefaultGateId, encryptionGates);
      if (!gate) return;
      if (gate.hasConflicts) {
        const reason = [
          ...(gate.conflictSummary?.modeConflicts ? ['mode'] : []),
          ...(gate.conflictSummary?.chainIdConflicts ? ['chain'] : []),
          ...(gate.conflictSummary?.perMemberLimitConflicts ? ['per-member limit'] : []),
        ];
        throw new Error(`Resource "${key}" has conflicting gate settings (${reason.join(', ')}).`);
      }
      if (gate.registryRepresentable === false) {
        throw new Error(
          `Resource "${key}" uses multiple gate groups with All semantics, which cannot be encoded on-chain. Pick one resource gate or use Any-mode gates only.`,
        );
      }
      const prev = gateSelections?.[key] || {};
      snapshot[key] = {
        sbts: gate.sbts,
        mode: gate.mode || 'any',
        chainId,
        perMemberLimit: prev.perMemberLimit || '',
      };
    });
    return snapshot;
  };

  const sessionIdHex = sessionRegistryPublishAdapter.normalizeSessionIdHex(sessionId);
  const embeddedDeployHelperEnabled =
    typeof draft.embeddedDeployHelperEnabled === 'boolean'
      ? draft.embeddedDeployHelperEnabled
      : CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED !== false;

  workerDeployRuntimeRef.current = {
    account,
    provider,
    network,
    loginComplete,
    loginInProgress,
    toggleLoginModal,
    registryAddress,
    registryChainId,
    wizardMode,
    workerMode,
    bundleMode,
    bundleFile,
    forceManualBundleFile,
    normalModeBundleUrlOverride,
    workerSecretsEnabled,
    workerLimitPerWallet,
    embeddedDeployHelperEnabled,
    deployHelperUrl,
    latestChainBlock,
    sessionId,
    sessionIdHex,
    draft,
    deployForm,
  };

  const { handleDeployWorker, resolveConnectedAdminAddress } = useSessionWizardWorkerDeploy({
    refs: {
      runtimeRef: workerDeployRuntimeRef,
      resolvedWalletAccountRef,
      sponsoredBundleAppliedBundleRef,
    },
    getCurrentWorkerSecrets,
    applyWorkerSecretsUpdate,
    getMissingWorkerSecretsForDeploy,
    resolveWorkerRpcUrl,
    resolveWorkerRpcUrlMap,
    resolveWorkerFaucetConfig,
    parseAllowOriginsInput,
    signTypedAdminAction,
    setDeployForm,
    updateDraftValue,
    updateDeploymentState: updateSponsoredBundleDeploymentState,
    clearSelectedBundleFile,
    clearCachedWorkerSecretsAfterDeploy,
  });

  const sessionWizardPublishRuntimeController = createSessionWizardPublishRuntimeController({
    runtimeRef: workerDeployRuntimeRef,
    dispatch: dispatchSessionPublish,
    getErrorMessage: getSessionWizardErrorMessage,
    deployWorker: () => handleDeployWorker({ forceSponsoredAutoDeploy: true }),
    deployPendingSbts: deployPendingSbtDrafts,
    getCurrentWorkerSecrets,
    resolveWorkerBaseUrl,
    resolveWorkerRpcUrl,
    resolveWorkerRpcUrlMap,
    parseAllowOriginsInput,
    resolveWorkerFaucetConfig,
    signTypedAdminAction,
    handleRegisterGroup,
    generateSessionId,
    callbacks: {
      setSessionUrl,
      setAdminUrl,
      setAdminUrlStatus,
      clearSessionWizardCache,
      setSessionId,
      setSessionIdStatus,
    },
  });

  const resourceGateOptions = useMemo(
    () => encryptionGates.map((gate) => ({ value: gate.id, label: gate.label || gate.id })),
    [encryptionGates],
  );

  const renderSessionWizardInfoTooltip = useCallback(
    ({
      id,
      content,
      placement = 'right',
      testId = '',
      ariaLabel = 'Show more info',
    }: SessionWizardTooltipRenderOptions = {}) => {
      return (
        <SessionWizardInfoTooltip
          enabled={sessionWizardTooltipsEnabled}
          id={id}
          content={content}
          placement={placement}
          testId={testId}
          ariaLabel={ariaLabel}
        />
      );
    },
    [sessionWizardTooltipsEnabled],
  );

  const renderField = buildSessionWizardDraftFieldRenderer({
    blockLimitDuration,
    blockLimitUnit,
    compactSessionHeaderInputRef,
    compactSessionHeaderMode,
    defaultGateId,
    draft,
    draftRef,
    encryptedFieldGates,
    encryptionGates,
    ensureLightSbtUniverse,
    fieldErrors,
    gateOptions,
    getGateById,
    handleClearSessionHeaderPreview,
    handlePasteSessionHeaderFromClipboard,
    handleRemoveDefaultFeaturedSbt,
    latestBlockStatus,
    latestChainBlock,
    launchCreateSbtModal,
    markBlockStartManual,
    metadataObjectCollapsed,
    network,
    normalizeGateIds,
    openContractViewerModal,
    openLockKey,
    pendingSbtSelectorOptions,
    privateSlugMode,
    registryChainId,
    renderSessionWizardInfoTooltip,
    resolvedActiveSessionSlug,
    sbtCacheRevision,
    selectorSourceChainId,
    selectorSourceSessionConfig,
    sessionHeaderMode,
    sessionHeaderPreviewSrc,
    sessionHeaderUploadStatus,
    sessionHeaderUploadStatusTone,
    sessionWizardTooltipsEnabled,
    setBlockLimitDuration,
    setBlockLimitUnit,
    setCompactSessionHeaderMode,
    setDefaultGateId,
    setDraft,
    setEncryptedFieldGates,
    setMetadataObjectCollapsed,
    setOpenLockKey,
    setSessionHeaderFile,
    setSessionHeaderMode,
    setSessionHeaderPreviewModalOpen,
    setSessionHeaderStatus,
    setShowPromptPreview,
    setWorkerUrlAutoFilled,
    showPromptPreview,
    slugAvailability,
    slugPinnedByPendingSbtDrafts,
    togglePrivateSlugMode,
    updateArrayValue,
    updateDraftValue,
    workerSecretsEnabled,
    wizardMode,
  });
  const orderedDraftEntries = useMemo(() => getSessionWizardOrderedDraftEntries(draft), [draft]);

  const registerChainId = Number(registryChainId || draft.networkChainId || 0) || null;
  const registerExplorerBaseUrl = getExplorerBaseUrl(registerChainId);
  const isNormalMode = wizardMode !== 'advanced';
  const hasConfiguredDeployHelperUrl = !!workerAuthPublishAdapter.normalizeWorkerUrl(
    toStr(CLOUDFLARE_DEPLOY_HELPER_URL).trim(),
  );
  const shouldShowDeployHelperUrlInput = !isNormalMode || !hasConfiguredDeployHelperUrl;

  const { primaryEntries: primaryDraftEntries, moreOptionsEntries } = useMemo(
    () => splitSessionWizardDraftEntries(orderedDraftEntries, isNormalMode),
    [isNormalMode, orderedDraftEntries],
  );

  const resolvedWorkerBaseUrl = resolveWorkerBaseUrl();
  const configuredWorkerUrl = normalizeWorkerUrl(toStr(draft.corsWorkerUrl).trim());
  const defaultWorkerUrl = normalizeWorkerUrl(getSessionWizardDefaultWorkerUrl());
  const deployedWorkerUrl = normalizeWorkerUrl(toStr(deployWorkerUrl).trim());
  const normalModeRequiresCustomWorker = isNormalMode && !NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED;
  const { deployVerifiedInUi, effectiveConfiguredWorkerUrl } = resolveSessionWizardWorkerVerificationUiState({
    configuredWorkerUrl,
    deployWorkerUrl: deployedWorkerUrl,
    defaultWorkerUrl,
    deployComplete,
    normalModeRequiresCustomWorker,
  });
  const customWorkerSelected = normalModeRequiresCustomWorker || workerMode !== 'default';
  const hideNormalModeDefaultWorkerUrl =
    normalModeRequiresCustomWorker &&
    !deployVerifiedInUi &&
    isSessionWizardDefaultWorkerPlaceholderUrl(configuredWorkerUrl, defaultWorkerUrl);
  const visibleConfiguredWorkerUrl = hideNormalModeDefaultWorkerUrl ? '' : effectiveConfiguredWorkerUrl;
  const displayedWorkerUrl = hideNormalModeDefaultWorkerUrl
    ? ''
    : toStr(draft.corsWorkerUrl).trim() || visibleConfiguredWorkerUrl;
  const showSharedWorkerChoice = !normalModeRequiresCustomWorker;
  const showWorkerUrlField = customWorkerSelected && deployVerifiedInUi;
  const { deployWorkerMatchesConfiguredUrl, usesDefaultWorkerUrl, workerUrlSource } =
    resolveSessionWizardWorkerUrlSourceState({
      defaultWorkerUrl,
      deployedWorkerUrl,
      deployVerifiedInUi,
      resolvedWorkerBaseUrl,
      visibleConfiguredWorkerUrl,
      workerMode,
    });
  const currentWorkerSecrets = getCurrentWorkerSecrets();
  const sponsoredAutoDeployState = resolveSessionWizardSponsoredAutoDeployReadiness({
    wizardMode,
    sponsoredBundle: sponsoredBundleAppliedBundleRef.current,
    deployForm,
    workerSecretsEnabled,
    currentWorkerSecrets,
    getMissingWorkerSecretsForDeploy,
    hasBundleFile: !!bundleFile,
    normalModeBundleUrlOverride,
  });
  const normalModeBundleUrl = toStr(CLOUDFLARE_WORKER_BUNDLE_URL).trim();
  const { showSponsoredFaucetNotice, showSponsoredDeployAccessNotice } = resolveSponsoredBundleAdvancedFieldNotices({
    sponsoredBundle: sponsoredBundleAppliedBundleRef.current,
    workerSecrets,
    deployForm,
  });
  const { renderResourceCard } = useSessionWizardWorkerResourceRenderer({
    defaultGateId,
    effectiveDefaultWorkerRpcUrl,
    gateOptions,
    isNormalMode,
    openResourceGateKey,
    resourceGateMap,
    resourceGateOptions,
    showSponsoredFaucetNotice,
    workerSecrets,
    workerSecretsEnabled,
    applyWorkerSecretsUpdate,
    getResourceSecretFields,
    renderInfoTooltip: renderSessionWizardInfoTooltip,
    setOpenResourceGateKey,
    setResourceGateMap,
  });
  const {
    canUseSponsoredAutoDeployNow,
    normalModeBundleHelpText,
    normalModeManualBundleHelpText,
    shouldUseSponsoredAutoDeployFlow,
    showNormalModeManualBundleControls,
    showNormalModeWorkerStep,
    showSponsoredBundleFallbackInput,
  } = resolveSessionWizardSponsoredPublishSurfaceState({
    isNormalMode,
    wizardMode,
    workerMode,
    bundleMode,
    deployForm,
    sponsoredAutoDeployState,
    forceManualBundleFile,
    hasBundleFile: !!bundleFile,
    normalModeBundleUrlOverride,
    normalModeDefaultBundleUrl: normalModeBundleUrl,
    manualBundleRetryMessage: NORMAL_MODE_MANUAL_BUNDLE_RETRY_MESSAGE,
    missingHostedBundleMessage: NORMAL_MODE_MISSING_HOSTED_BUNDLE_MESSAGE,
  });
  const normalModeBundleUrlOverrideValidationError = useMemo(
    () => getSessionWizardNormalModeBundleUrlOverrideValidationError(normalModeBundleUrlOverride),
    [normalModeBundleUrlOverride],
  );
  useEffect(() => {
    if (isNewSessionWizardRoute) {
      setSessionModeProfileStepComplete(false);
    }
  }, [isNewSessionWizardRoute]);
  const effectiveSessionModeProfileStepComplete = !isNewSessionWizardRoute || sessionModeProfileStepComplete;
  const newSessionBannerDismissalContextKey = buildSessionWizardNewSessionBannerDismissalContextKey({
    pathname: currentSessionWizardPathname,
    sponsoredBundleId: initialSponsoredBundleId,
    sponsoredBundleKey: initialSponsoredBundleKey,
  });
  const {
    persistedNewSessionBannerDismissed,
    newSessionBannerDismissedContext,
    handleDismissNewSessionRequirementsBanner,
  } = useSessionWizardNewSessionBanner({
    hasSponsoredBundleLink,
    newSessionBannerDismissalContextKey,
  });
  const normalizedAppliedSponsoredBundle = sponsoredBundlePublishAdapter.normalizeSparseSponsoredBundlePayload(
    sponsoredBundleAppliedBundleRef.current,
  );
  const { newSessionRequiresLitCredential, requiredRequirementIds, showNewSessionRequirementsBanner } =
    resolveSessionWizardNewSessionRequirementsDisplayState({
      cloudflareWorkerSbtGateMode,
      currentWorkerSecrets,
      hasSponsoredBundleLink,
      isNewSessionWizardRoute,
      newSessionBannerDismissalContextKey,
      newSessionBannerDismissedContext,
      normalizedAppliedSponsoredBundle,
      persistedNewSessionBannerDismissed,
      sessionAi: draft.ai,
      sessionModeProfile: draft.sessionModeProfile,
      sponsoredBundleStatus,
    });
  const publishUiPlan = resolveSessionWizardPublishReducerUiPlan({
    state: sessionPublishState,
    resolvedWorkerBaseUrl,
    workerMode,
    usesDefaultWorkerUrl,
    deployVerifiedInUi,
    deployWorkerMatchesConfiguredUrl,
    canUseSponsoredAutoDeployNow,
    manualMetadataUrl,
    metadataUrl,
    buildMetadataGatewayUrl: (txId) => arweavePublishAdapter.buildArweaveGatewayUrl({ txId }),
    deployComplete,
    hasPendingDrafts: hasUndeployedPendingSbtDrafts,
    isNormalMode,
    publishAdvancedOpen,
    publishStepElapsedMs,
    sbtsLabel: t('sbts'),
    sessionModeProfile: draft.sessionModeProfile as SessionModeProfile,
  });
  const {
    publishProgressDisplayState: { publishStep },
  } = publishUiPlan;
  useSessionWizardPublishElapsed({ publishBusy, publishStep, setPublishStepElapsedMs });
  const { canUploadMetadataNow } = publishUiPlan.publishReadiness;
  const deployStatusDisplayState = resolveSessionWizardDeployStatusDisplayState({
    deployInFlight,
    deployStatus,
    deployVerifiedInUi,
  });
  const pendingDraftCount = normalizedPendingSbtDrafts.length;
  const sessionDetailsComplete = !!toStr(draft?.sessionName).trim() && !!toStr(draft?.sessionInfo).trim();
  const configuredPrivateGateCount = encryptionGates.filter(
    (gate) => normalizeSbtSelection(gate?.sbts || []).length > 0,
  ).length;
  const normalModeCards = buildNormalModeCards({
    sessionName: toStr(draft?.sessionName),
    sessionDetailsComplete,
    configuredPrivateGateCount,
    privateSlugMode,
    showNormalModeWorkerStep,
    normalModeRequiresCustomWorker,
    resolvedWorkerBaseUrl,
    workerMode,
    deployVerifiedInUi,
    canUseSponsoredAutoDeployNow,
    publishReadiness: publishUiPlan.publishReadiness,
    t,
  });
  const activeNormalModeIndex = normalModeCards.findIndex((card) => collapsedSections[card.key] === false);
  const normalModePublishSummary = buildNormalModePublishSummary({
    sessionName: toStr(draft?.sessionName),
    configuredPrivateGateCount,
    privateSlugMode,
    canUseSponsoredAutoDeployNow,
    shouldUseSponsoredAutoDeployFlow,
    normalModeRequiresCustomWorker,
    resolvedWorkerBaseUrl,
    workerMode,
    deployVerifiedInUi,
    pendingDraftCount,
    t,
  });
  useSessionWizardNormalModeSectionVisibility({
    isNormalMode,
    showNormalModeWorkerStep,
    setCollapsedSections,
  });
  const createSbtModalPlan = resolveSessionWizardCreateSbtModalPlan({
    createSbtModalState,
    draft,
    getChainById,
    getChainName,
    getEnabledWorkerArweaveJwk,
    network: network
      ? {
          chainId: network?.chainId,
          id: network?.id,
          name: network?.name,
        }
      : null,
    registryChainId,
    resolvedActiveSessionSlug,
    workerSecretsEnabled,
  });
  const createSbtModalChainId = createSbtModalPlan.chainId;
  const createSbtModalNetwork = createSbtModalPlan.network;
  const createSbtModalSessionSlug = createSbtModalPlan.sessionSlug;
  const createSbtModalArweaveJwkOverride = createSbtModalPlan.arweaveJwkOverride;
  const wizardContractViewerPlan = useMemo(
    () =>
      resolveSessionWizardContractViewerPlan({
        activeSessionSlug,
        draftContracts: draft?.contracts,
        draftNetworkChainId: draft?.networkChainId,
        network: {
          chainId: network?.chainId,
          id: network?.id,
        },
        registryChainId,
        resolvedActiveSessionSlug,
        selectedContractKey: contractViewerModalState.contractKey,
        selectorSourceSessionSlug: selectorSourceSessionConfig?.slug,
      }),
    [
      activeSessionSlug,
      contractViewerModalState.contractKey,
      draft?.contracts,
      draft?.networkChainId,
      network?.chainId,
      network?.id,
      registryChainId,
      resolvedActiveSessionSlug,
      selectorSourceSessionConfig?.slug,
    ],
  );
  const wizardContractViewerContracts = wizardContractViewerPlan.contracts;
  const selectedWizardContract = wizardContractViewerPlan.selectedContract;
  const selectedWizardContractHref = wizardContractViewerPlan.selectedContractHref;
  const sessionMetadataHeaderAccessory =
    wizardMode === 'advanced' ? (
      <SessionWizardSessionIdBadge
        isRegenerating={isSessionIdRegenerating}
        onCopy={handleCopySessionId}
        onRegenerate={handleRegenerateSessionId}
        renderInfoTooltip={renderSessionWizardInfoTooltip}
        sessionIdDisplay={sessionIdDisplay}
      />
    ) : null;
  const handleSessionModeProfileContinue = useCallback(() => {
    setSessionModeProfileStepComplete(true);
  }, []);
  const showSessionModeProfileEntryStep = isNewSessionWizardRoute && !effectiveSessionModeProfileStepComplete;
  const sessionModeProfileControl = (
    <SessionWizardSessionModeProfileControl
      registryChainId={registryChainId}
      value={draft.sessionModeProfile}
      onChange={(profile, compiled) => {
        setDraft((prev) => {
          const next = applySessionModeProfileSelectionToDraft(prev, profile, compiled);
          draftRef.current = next;
          return next;
        });
      }}
      onContinue={handleSessionModeProfileContinue}
      entryOnly={showSessionModeProfileEntryStep}
      showContinue={showSessionModeProfileEntryStep || !isNewSessionWizardRoute}
    />
  );

  return (
    <SessionWizardShell
      account={account}
      activeCreateSbtTargetGate={activeCreateSbtTargetGate}
      activeCreateSbtTargetGateId={activeCreateSbtTargetGateId}
      activeNormalModeIndex={activeNormalModeIndex}
      addEncryptionGate={addEncryptionGate}
      adminUrl={adminUrl}
      adminUrlStatus={adminUrlStatus}
      advancedBundleFileInputRef={advancedBundleFileInputRef}
      bundleFile={bundleFile}
      bundleMode={bundleMode}
      clearSelectedBundleFile={clearSelectedBundleFile}
      clearWorkerSecretFields={clearWorkerSecretFields}
      closeContractViewerModal={closeContractViewerModal}
      closeCreateSbtModal={closeCreateSbtModal}
      collapsedSections={collapsedSections}
      contractViewerModalState={contractViewerModalState}
      createSbtModalArweaveJwkOverride={createSbtModalArweaveJwkOverride}
      createSbtModalChainId={createSbtModalChainId}
      createSbtModalNetwork={createSbtModalNetwork}
      createSbtModalSessionSlug={createSbtModalSessionSlug}
      createSbtModalState={createSbtModalState}
      defaultAllowedOrigins={DEFAULT_ALLOWED_ORIGINS}
      defaultGateId={defaultGateId}
      deployComplete={deployComplete}
      deployForm={deployForm}
      deployHelperUrl={deployHelperUrl}
      deployStatusDisplayState={deployStatusDisplayState}
      deployWorkerUrl={deployWorkerUrl}
      devPersistWorkerSecrets={DEV_PERSIST_WORKER_SECRETS}
      displayedWorkerUrl={displayedWorkerUrl}
      draft={draft}
      effectivePersistWorkerSecrets={effectivePersistWorkerSecrets}
      embeddedDeployHelperEnabled={embeddedDeployHelperEnabled}
      encryptionGates={encryptionGates}
      ensureLightSbtUniverse={ensureLightSbtUniverse}
      focusCreateSbtTargetGate={focusCreateSbtTargetGate}
      focusNormalModeSection={focusNormalModeSection}
      getSessionWizardDefaultWorkerUrl={getSessionWizardDefaultWorkerUrl}
      handleCopyAdminUrl={handleCopyAdminUrl}
      handleDeployWorker={handleDeployWorker}
      handleGateAddSbt={handleGateAddSbt}
      handleGateRemoveSbt={handleGateRemoveSbt}
      handleSavePendingSbtDraft={handleSavePendingSbtDraft}
      hasSponsoredBundleLink={hasSponsoredBundleLink}
      isNormalMode={isNormalMode}
      jsonCopied={jsonCopied}
      launchCreateSbtModal={launchCreateSbtModal}
      localWorkerBundleFallbackFilePath={LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH}
      manualBundleUrlOverrideHelp={MANUAL_BUNDLE_URL_OVERRIDE_HELP}
      manualGasLimit={manualGasLimit}
      manualGasPriceGwei={manualGasPriceGwei}
      manualMaxFeePerGasGwei={manualMaxFeePerGasGwei}
      manualMaxPriorityFeePerGasGwei={manualMaxPriorityFeePerGasGwei}
      manualMetadataUrl={manualMetadataUrl}
      moreOptionsEntries={moreOptionsEntries}
      moreOptionsOpen={moreOptionsOpen}
      network={network}
      newSessionFundingRequirementHref={newSessionFundingRequirementHref}
      newSessionFundingRequirementLabel={newSessionFundingRequirementLabel}
      newSessionRequiresLitCredential={newSessionRequiresLitCredential}
      newSessionRequiredRequirementIds={requiredRequirementIds}
      normalModeBundleHelpText={normalModeBundleHelpText}
      normalModeBundleUrl={normalModeBundleUrl}
      normalModeBundleUrlOverride={normalModeBundleUrlOverride}
      normalModeBundleUrlOverrideValidationError={normalModeBundleUrlOverrideValidationError}
      normalModeCards={normalModeCards}
      normalModeManualBundleHelpText={normalModeManualBundleHelpText}
      normalModePublishSummary={normalModePublishSummary}
      normalModeRetryBundleFileInputRef={normalModeRetryBundleFileInputRef}
      onCloseDisplaySettings={() => setWizardDisplaySettingsOpen(false)}
      onCloseSessionHeaderPreviewModal={() => setSessionHeaderPreviewModalOpen(false)}
      onCopyDraftJson={handleCopyDraftJson}
      onDismissNewSessionRequirementsBanner={handleDismissNewSessionRequirementsBanner}
      onEnterAdvancedMode={handleEnterAdvancedMode}
      onEnterNormalMode={handleEnterNormalMode}
      onManualGasLimitChange={setManualGasLimit}
      onManualGasPriceGweiChange={setManualGasPriceGwei}
      onManualMaxFeePerGasGweiChange={setManualMaxFeePerGasGwei}
      onManualMaxPriorityFeePerGasGweiChange={setManualMaxPriorityFeePerGasGwei}
      onManualMetadataUrlChange={setManualMetadataUrl}
      onNormalModeBundleUrlOverrideChange={setNormalModeBundleUrlOverride}
      onPublish={handlePublish}
      onRegistryChainIdChange={handleRegistryChainIdChange}
      onRetrySponsoredBundle={() => setSponsoredBundleRetryNonce((prev) => prev + 1)}
      onToggleDisplaySettings={() => setWizardDisplaySettingsOpen((prev) => !prev)}
      onToggleJsonPreview={() => setShowJsonPreview((prev) => !prev)}
      onToggleMoreOptions={() => setMoreOptionsOpen((prev) => !prev)}
      onTogglePublishAdvanced={() => setPublishAdvancedOpen((prev) => !prev)}
      pendingSbtDrafts={pendingSbtDrafts}
      pendingSbtSelectorOptions={pendingSbtSelectorOptions}
      persistWorkerSecrets={persistWorkerSecrets}
      primaryDraftEntries={primaryDraftEntries}
      provider={provider}
      publishUiPlan={publishUiPlan}
      publishSettingsCapabilities={sessionModeRequirements.publishSettings}
      publishedPendingSbtLinks={publishedPendingSbtLinks}
      registerExplorerBaseUrl={registerExplorerBaseUrl}
      registerTxs={registerTxs}
      registryAddress={registryAddress}
      registryChainId={registryChainId}
      registryChainName={registryChainName}
      registryChainOptions={registryChainOptions}
      removeEncryptionGate={removeEncryptionGate}
      removePendingSbtDraft={removePendingSbtDraft}
      renderField={renderField}
      renderResourceCard={renderResourceCard}
      renderSessionWizardInfoTooltip={renderSessionWizardInfoTooltip}
      resolvedActiveSessionSlug={resolvedActiveSessionSlug}
      resolvedWorkerBaseUrl={resolvedWorkerBaseUrl}
      sbtCacheRevision={sbtCacheRevision}
      selectedWizardContract={selectedWizardContract}
      selectedWizardContractHref={selectedWizardContractHref}
      selectorSourceChainId={selectorSourceChainId}
      selectorSourceSessionConfig={selectorSourceSessionConfig}
      sessionHeaderPreviewModalOpen={sessionHeaderPreviewModalOpen}
      sessionHeaderPreviewSrc={sessionHeaderPreviewSrc}
      sessionMetadataHeaderAccessory={sessionMetadataHeaderAccessory}
      sessionModeProfileControl={sessionModeProfileControl}
      showSessionModeProfileControlInSetup={effectiveSessionModeProfileStepComplete}
      sessionModeProfileStepComplete={effectiveSessionModeProfileStepComplete}
      sessionUrl={sessionUrl}
      setBundleFile={setBundleFile}
      setBundleMode={setBundleMode}
      setDeployForm={setDeployForm}
      setDeployHelperUrl={setDeployHelperUrl}
      setNormalModeBundleUrlOverride={setNormalModeBundleUrlOverride}
      setPersistWorkerSecrets={setPersistWorkerSecrets}
      setWorkerAllowOrigins={setWorkerAllowOrigins}
      setWorkerMode={setWorkerMode}
      setWorkerSecretsEnabled={setWorkerSecretsEnabled}
      setWorkerUrlAutoFilled={setWorkerUrlAutoFilled}
      shouldShowDeployHelperUrlInput={shouldShowDeployHelperUrlInput}
      shouldUseSponsoredAutoDeployFlow={shouldUseSponsoredAutoDeployFlow}
      showJsonPreview={showJsonPreview}
      showNewSessionRequirementsBanner={showNewSessionRequirementsBanner}
      showNormalModeManualBundleControls={showNormalModeManualBundleControls}
      showNormalModeWorkerStep={showNormalModeWorkerStep}
      showSharedWorkerChoice={showSharedWorkerChoice}
      showSponsoredBundleFallbackInput={showSponsoredBundleFallbackInput}
      showSponsoredDeployAccessNotice={showSponsoredDeployAccessNotice}
      showWorkerUrlField={showWorkerUrlField}
      signBootstrapAdminAction={signBootstrapAdminAction}
      sponsoredBundleStatus={sponsoredBundleStatus}
      sponsoredManualBundleRetryMessage={SPONSORED_MANUAL_BUNDLE_RETRY_MESSAGE}
      sponsoredPublishBundleFileInputRef={sponsoredPublishBundleFileInputRef}
      status={status}
      t={t}
      toggleLoginModal={toggleLoginModal}
      toggleSection={toggleSection}
      updateDraftValue={updateDraftValue}
      updateEncryptionGate={updateEncryptionGate}
      visibleWorkerResourceKeys={visibleWorkerResourceKeys}
      workerAllowOrigins={workerAllowOrigins}
      workerMode={workerMode}
      workerSecretsEnabled={workerSecretsEnabled}
      workerUrlAutoFilled={workerUrlAutoFilled}
      workerUrlSource={workerUrlSource}
      wizardDisplaySettingsOpen={wizardDisplaySettingsOpen}
      wizardMode={wizardMode}
      normalizeSbtSelection={normalizeSbtSelection}
    />
  );
};

export default SessionWizard;
