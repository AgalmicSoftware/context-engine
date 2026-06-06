// @ts-nocheck
/** @file SessionWizard.tsx */
// Temporary: this file is mid-migration from JSX to TSX. Keep the runtime
// unblocked while we restore strict typing in smaller, reviewable slices.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { Button, Input, Label, FormGroup } from 'reactstrap';
import { ReactReduxContext } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faCheck, faExclamationCircle, faImage, faSpinner } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionWizard.module.scss';
import { renderAiOrGateSelect } from './AiFieldSelect';
import LockableFieldFrame from './LockableFieldFrame';
import BlockLimitsField from './BlockLimitsField';
import SessionHeaderField, { type SessionHeaderFieldProps } from './SessionHeaderField';
import FeaturedSbtField from './FeaturedSbtField';
import CollapsibleFieldGroup from './CollapsibleFieldGroup';
import SessionWizardContractsField from './SessionWizardContractsField';
import SessionWizardStorageProfileField from './SessionWizardStorageProfileField';
import type { WorkerPanelProps } from './WorkerPanel';
import WorkerResourceCard from './WorkerResourceCard';
import WorkerResourceInputs from './WorkerResourceInputs';
import { readCompactImageClipboard } from '../Shared/compactImageClipboard.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  buildSbtAccessControlConditions,
  createLitHooks,
  resolveLitChain,
  getGlobalLitHooks,
  setGlobalLitHooks,
} from '../../utilities/crypto/litProtocol.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { arweaveScripts } from '../../utilities/arweave/arweaveScripts.js';
import { resolvePublishArweaveUploadOptions } from '../../utilities/arweave/publishUploadAuth.js';
import {
  normalizeSparseSponsoredBundlePayload,
} from '../../utilities/arweave/sponsoredBundles.js';
import { getEffectiveArweaveKey } from '../../utilities/session/resourceKeys.js';
import { sessionRegistryUtils, registerSessionOnChain } from '../../utilities/web3/sessionRegistry.js';
import contractScripts from '../../utilities/web3/contractScripts.js';
import { seedGenPrompt } from '../../prompts/seedGenPrompt.js';
import {
  CLOUDFLARE_DEPLOY_HELPER_URL,
  CLOUDFLARE_WORKER_BUNDLE_URL,
  CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED,
  DEFAULT_CHAIN_ID,
} from '../../variables/appConfig.js';
import {
  getChainById,
  getChainBlockTimeMs,
  getDefaultHttpRpc,
  getSessionRegistryAddress,
  getSessionRegistryChains,
} from '../../variables/chains.js';
import {
  buildSignedAdminActionAuth,
  buildSignedBootstrapAdminAuth,
  normalizeWorkerUrl as normalizeWorkerAuthUrl,
} from '../../utilities/worker/workerAuth.js';
import { resolveSbtAddressFromFactoryReceipt } from '../../utilities/web3/sbtFactoryReceipt.js';
import {
  normalizeLitMetadataNetwork,
  normalizeSessionNaming,
} from '../../utilities/session/sessionMetadata.js';
import type { UnknownRecord } from '../../utilities/session/sessionTypes.js';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { normalizeBlockLimitsForConfig } from '../../utilities/session/blockLimits.js';
import { normalizeBaseUrl } from '../../utilities/urlUtils.js';
import { t } from '../../utilities/ui/terminology.js';
import {
  buildSponsoredFlagFields as buildSponsoredSessionFlagFields,
} from '../../utilities/session/sponsoredFlags.js';
import { createLogger } from '../../utilities/logging';
import { wrapEthersJsonRpcSend } from '../../utilities/web3/rpcReadCache.js';
import {
  getSessionWizardContractDefaults,
  getVisibleSessionWizardContractKeys,
  resolveSessionWizardRegistryAddress,
  sanitizeSessionWizardContracts,
} from './sessionWizardContracts.js';
import {
  resolveWorkerSecretsSnapshot,
} from './sessionWizardSecrets.js';
import {
  resolveSessionWizardDeployStatusDisplayState,
} from './sessionWizardDeployErrors';
import { getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { notify } from '../../utilities/ui/notify.js';
import {
  SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS,
  buildSessionWizardRegistrySessionFields,
  sanitizeSessionWizardMetadataPayload,
} from './sessionWizardWriteNormalization.js';
import {
  buildContractsPageHref,
} from '../ContractPage/contractMetadata.js';
import { buildContractViewerContracts } from '../ContractPage/contractViewerUtils.js';
import usePendingSbtDrafts, {
  normalizePendingSbtDrafts,
  type PendingSbtDraft,
} from './hooks/usePendingSbtDrafts.js';
import useSponsoredBundleLifecycle from './hooks/useSponsoredBundleLifecycle';
import useSessionWizardWorkerDeploy from './hooks/useSessionWizardWorkerDeploy';
import useSessionSlugState from './hooks/useSessionSlugState.js';
import SessionWizardInfoTooltip, {
  type SessionWizardTooltipRenderOptions,
} from './SessionWizardInfoTooltip';
import { SESSION_WIZARD_REQUIREMENT_LINKS } from './SessionWizardRequirementsBanner';
import SessionWizardShell from './SessionWizardShell';
import SessionWizardSessionIdBadge from './SessionWizardSessionIdBadge';
import {
  buildNormalModeCards,
  buildNormalModePublishSummary,
} from './sessionWizardNormalModeCards';
import {
  LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH,
  getSessionWizardNormalModeBundleUrlOverrideValidationError,
  resolveSessionWizardBundleUrlForMode,
  resolveSessionWizardDeployBundleMode,
  resolveSessionWizardDeployBundlePayload,
  resolveSessionWizardSponsoredAutoDeployReadiness,
  resolveSponsoredBundleDeployReadiness,
  shouldForceSessionWizardNormalModeManualBundleRetry,
} from './sessionWizardPublishFlow';
import {
  resolveSessionWizardPublishMetadataUploadRequest,
  runSessionWizardRegisterStepController,
  runSessionWizardPublishMetadataUploadController,
  runSessionWizardPublishCompletionController,
  runSessionWizardPublishController,
} from './sessionWizardPublishController';
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
import {
  DEFAULT_AI_MODELS,
  normalizeAiModelForProvider,
  normalizeAiModels,
  normalizeAiProvider,
  resolveSessionWizardAutoFeatureBySessionSlug,
} from './sessionWizardAiConfig';
import {
  buildPendingSbtSelection,
  dedupeSbtSelection,
  normalizeSbtSelection,
  promotePendingSbtSelectionsAfterDeploy,
  serializeDefaultFeaturedSbtSelections,
} from './sessionWizardSbtSelections';
import {
  FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID,
  FEATURED_DRAFT_GATE_AUTO_LINK_SOURCE,
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
  getOnChainFieldKeyForPath,
  getValueAtPath,
  isSecretFieldPath,
  isStringArray,
  parseListInput,
  resolveSessionWizardSelectorSourceConfig,
  setValueAtPath,
  shouldLockable,
} from './sessionWizardGateUtils';
import {
  cacheSessionWorkerConfigAfterDeploy,
  resolveSponsoredBundleAdvancedFieldNotices,
} from './sessionWizardSponsoredBundleSupport';
import {
  __test__resetSessionWizardSponsoredBundleCacheKey,
} from './sessionWizardSponsoredBundleCache';
import {
  CHIPOTLE_LIT_CONFIG_FIELDS,
  DEFAULT_WORKER_SECRETS,
  buildWorkerLitCredentialsConfig,
  getSessionWizardWorkerResourceKeys,
  resolveSessionWizardEnabledWorkerSecrets,
  sanitizeSessionWizardSponsoredFieldSnapshotForLitMode,
  sanitizeSessionWizardWorkerSecretsForLitMode,
} from './sessionWizardWorkerSecretSupport';
import {
  buildSessionWizardCacheWritePayload,
  buildSessionWizardInitialDraftFromCache,
} from './sessionWizardDraftState';
import {
  __test__getSessionWizardDefaultAiSettings,
  __test__isSessionWizardDevMode,
  DEV_PERSIST_WORKER_SECRETS,
  MANUAL_BUNDLE_URL_OVERRIDE_HELP,
  METADATA_FIELD_ORDER,
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
} from './sessionWizardCoreUtils';
import {
  clearSessionWizardCache,
  readSessionWizardCache,
  useStableSerializedObject,
  writeSessionWizardCache,
} from './sessionWizardLocalStateSupport';
import {
  RESOURCE_LABELS,
  RESOURCE_SECTION_TOOLTIPS,
  resolveSessionWizardResourceSecretFields,
} from './sessionWizardResourceConfig';
import {
  buildSessionWizardNewSessionBannerDismissalContextKey,
  isNewSessionWizardPathname,
  readSessionWizardNewSessionBannerDismissed,
  writeSessionWizardNewSessionBannerDismissed,
} from './sessionWizardRouteState';
import { resolveSessionWizardNewSessionRequirementsDisplayState } from './sessionWizardRequirementsDisplay';
import {
  getSessionWizardSecretFieldTestId,
  readSessionWizardTooltipsEnabled,
  resolveSessionHeaderImageFormat,
} from './sessionWizardUiSupport';
import {
  buildSessionWizardAdminUrl as buildAdminUrl,
  buildSessionWizardSessionUrl as buildSessionUrl,
  getSessionWizardExplorerBaseUrl as getExplorerBaseUrl,
  normalizeSessionWizardArweaveUri as normalizeArweaveUri,
  normalizeSessionWizardSlug as normalizeSlug,
  normalizeSessionWizardWorkerUrl as normalizeWorkerUrl,
  parseSessionWizardArweaveTxId as parseArweaveTxId,
} from './sessionWizardUrlSupport';
import {
  parseSessionWizardAllowOriginsInput,
  resolveSessionWizardWorkerBaseUrlFromDraft,
  resolveSessionWizardWorkerFaucetConfigFromDraft,
  resolveSessionWizardWorkerRpcUrlFromDraft,
  resolveSessionWizardWorkerRpcUrlMapFromDraft,
} from './sessionWizardWorkerRuntimeSupport';
import {
  buildSessionWizardGateOptions,
  normalizeSessionWizardGateIds as normalizeGateIds,
  resolveSessionWizardResourceGate as resolveResourceGate,
} from './sessionWizardResourceGateSupport';
import {
  buildSessionWizardCreateSbtModalLaunchState,
  buildSessionWizardDeferredCreateSbtComponentProps,
  getSessionWizardGateById,
  resolveSessionWizardCreateSbtTargetGateId,
} from './sessionWizardCreateSbtSupport';
import {
  getSessionWizardWorkerDeployValidationError,
} from './sessionWizardWorkerRpc';
import {
  getSessionWizardFieldLabel,
  getSessionWizardFieldTooltip,
  getSessionWizardOrderedDraftEntries,
  shouldHideSessionWizardField,
  splitSessionWizardDraftEntries,
} from './sessionWizardFieldDescriptors';
import type {
  ChainIdLike,
  NetworkLike,
  SessionContractsLike,
  WorkerSecretsLike,
} from '../shellTypes';

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
export {
  __test__getSessionWizardDefaultAiSettings,
  __test__isSessionWizardDevMode,
} from './sessionWizardConfig';
export {
  deploySessionWizardPendingSbtDraft,
  finalizeSessionWizardPendingSbtDraft,
  persistSessionWizardSbtRecoveryCodes,
} from './sessionWizardPendingSbtPublish';
export { resolveSessionWizardSelectorSourceConfig } from './sessionWizardGateUtils';
export { cacheSessionWorkerConfigAfterDeploy } from './sessionWizardSponsoredBundleSupport';
export { __test__resetSessionWizardSponsoredBundleCacheKey } from './sessionWizardSponsoredBundleCache';
export {
  mergeSponsoredBundleDeployForm,
  mergeSponsoredBundleWorkerSecrets,
} from './sessionWizardWorkerSecretSupport';
export {
  buildSessionWizardWorkerRpcUrlMap,
  getSessionWizardWorkerDeployValidationError,
  resolveFallbackRpcUrl,
  resolveSessionWizardWorkerRpcUrl,
} from './sessionWizardWorkerRpc';

type PublishedPendingSbtLink = {
  address: string;
  label: string;
  href: string;
};

export const buildPublishedPendingSbtLinks = ({
  deployedDrafts = [],
  pendingDraftSnapshot = [],
  sessionSlug = '',
}: {
  deployedDrafts?: unknown[];
  pendingDraftSnapshot?: unknown[];
  sessionSlug?: string;
} = {}): PublishedPendingSbtLink[] => {
  const normalizedDeployedDrafts = normalizePendingSbtDrafts(deployedDrafts);
  const newlyDeployedAddressSet = new Set(
    normalizedDeployedDrafts
      .map((entry) => toStr(entry?.predictedAddress || entry?.deployedAddress || entry?.address).trim().toLowerCase())
      .filter(Boolean)
  );
  const finalizedDrafts = normalizePendingSbtDrafts([
    ...normalizedDeployedDrafts,
    ...normalizePendingSbtDrafts(pendingDraftSnapshot).filter((entry) => (
      entry?.deployed === true &&
      !newlyDeployedAddressSet.has(
        toStr(entry?.predictedAddress || entry?.deployedAddress || entry?.address).trim().toLowerCase()
      )
    )),
  ]);

  return finalizedDrafts
    .map((entry: PendingSbtDraft) => {
      const address = toStr(entry?.deployedAddress || entry?.predictedAddress || entry?.address).trim();
      if (!address) return null;
      return {
        address,
        label: toStr(entry?.displayName || entry?.name || address).trim() || address,
        href: buildSbtDetailPath(address, sessionSlug),
      };
    })
    .filter((entry): entry is PublishedPendingSbtLink => !!entry && entry.href !== '#');
};

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
  const normalizedWorkerUrl = normalizeWorkerAuthUrl(resolvedWorkerUrl);
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

type DraftState = UnknownRecord & NonNullable<WorkerPanelProps['draft']> & {
  sessionName?: string;
  sessionInfo?: string;
  sessionHeader?: string;
  sessionHeaderImg?: string;
  slug?: string;
  networkChainId?: ChainIdLike;
  blockLimits?: UnknownRecord;
  contracts?: SessionContractsLike;
  featuredSBTs?: UnknownRecord[];
  faucet?: UnknownRecord;
  ai?: UnknownRecord;
  lit?: UnknownRecord;
};

type SessionWizardProps = {
  account?: string;
  provider?: UnknownRecord | null;
  network?: NetworkLike;
  activeSessionSlug?: string;
  ensureLightSbtUniverse?: (() => unknown) | null;
  sbtCacheRevision?: unknown;
  toggleLoginModal?: (() => void) | null;
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

type CollapsedSectionsState = Record<string, boolean> & {
  worker: boolean;
  encryption: boolean;
  metadata: boolean;
  publish: boolean;
};

type MetadataObjectCollapsedState = Record<string, boolean> & {
  contracts: boolean;
  faucet: boolean;
  ai: boolean;
  lit: boolean;
  storageProfile: boolean;
};

type SessionHeaderUploadStatusTone = SessionHeaderFieldProps['sessionHeaderUploadStatusTone'] | string;

const log = createLogger('general');
const DEFAULT_TEMPLATE: DraftState = SESSION_WIZARD_DEFAULT_TEMPLATE as DraftState;
const pathKey = (path: string[]): string => path.join('.');
const ONCHAIN_FIELD_PATHS = SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS;
const ONCHAIN_FIELD_KEYS = new Set(Object.keys(SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS));

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
  const [sessionWizardTooltipsEnabled, setSessionWizardTooltipsEnabled] = useState(() => (
    readSessionWizardTooltipsEnabled(tooltipPreferenceStore)
  ));
  useEffect(() => {
    setSessionWizardTooltipsEnabled(readSessionWizardTooltipsEnabled(tooltipPreferenceStore));
    if (typeof tooltipPreferenceStore?.subscribe !== 'function') return undefined;
    return tooltipPreferenceStore.subscribe(() => {
      const nextEnabled = readSessionWizardTooltipsEnabled(tooltipPreferenceStore);
      setSessionWizardTooltipsEnabled((current) => (current === nextEnabled ? current : nextEnabled));
    });
  }, [tooltipPreferenceStore]);
  const resolvedActiveSessionSlug = sessionRegistryUtils.normalizeSlug(
    activeSessionSlug ?? ''
  );
  const cachedWizard = useMemo(() => readSessionWizardCache(), []);
  const cachedDraftHasEmbeddedDeployHelperEnabled = (
    typeof cachedWizard?.draft?.embeddedDeployHelperEnabled === 'boolean'
  );
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
  }, [
    cachedWizard?.draft?.networkChainId,
    network?.chainId,
    network?.id,
    resolvedActiveSessionSlug,
  ]);
  const initialDraft = useMemo(() => {
    return buildSessionWizardInitialDraftFromCache({
      cachedWizard,
      defaultTemplate: DEFAULT_TEMPLATE,
      normalModeSharedHostedWorkerEnabled: NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED,
      sourceEmbeddedDeployHelperDefault: cachedDraftHasEmbeddedDeployHelperEnabled
        ? null
        : sourceEmbeddedDeployHelperDefault,
    });
  }, [cachedDraftHasEmbeddedDeployHelperEnabled, cachedWizard, sourceEmbeddedDeployHelperDefault]);
  const initialGates = useMemo(() => {
    const cachedGates = cachedWizard?.encryptionGates;
    if (Array.isArray(cachedGates) && cachedGates.length) return cachedGates;
    return [buildEncryptionGate(0)];
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
    () => normalizeFeaturedDraftGateAutoLink(cachedWizard?.featuredDraftGateAutoLink),
    [cachedWizard]
  );
  const initialSessionIdValue = useMemo(() => {
    const fromQuery = sessionRegistryUtils.formatSessionId(initialSessionId);
    if (fromQuery) return fromQuery;
    const fromCache = sessionRegistryUtils.formatSessionId(cachedWizard?.sessionId);
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
  const [encryptedFieldGates, setEncryptedFieldGates] = useState<UnknownRecord>(() => (
    cachedWizard?.encryptedFieldGates && typeof cachedWizard.encryptedFieldGates === 'object'
      ? cachedWizard.encryptedFieldGates
      : {}
  ));
  const [openLockKey, setOpenLockKey] = useState('');
  const [openResourceGateKey, setOpenResourceGateKey] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [metadataUrl, setMetadataUrl] = useState('');
  const [metadataTxId, setMetadataTxId] = useState('');
  const [manualMetadataUrl, setManualMetadataUrl] = useState('');
  const [manualGasLimit, setManualGasLimit] = useState(() => (
    toStr(cachedWizard?.manualGasLimit || '1200000').trim() || '1200000'
  ));
  const [manualGasPriceGwei, setManualGasPriceGwei] = useState(() => (
    toStr(cachedWizard?.manualGasPriceGwei || '').trim()
  ));
  const [manualMaxFeePerGasGwei, setManualMaxFeePerGasGwei] = useState(() => (
    toStr(cachedWizard?.manualMaxFeePerGasGwei || '').trim()
  ));
  const [manualMaxPriorityFeePerGasGwei, setManualMaxPriorityFeePerGasGwei] = useState(() => (
    toStr(cachedWizard?.manualMaxPriorityFeePerGasGwei || '').trim()
  ));
  const [registerTxs, setRegisterTxs] = useState<UnknownRecord[]>([]);
  const [pendingOnChainFields, setPendingOnChainFields] = useState<UnknownRecord>({});
  const [status, setStatus] = useState('');
  const [sessionUrl, setSessionUrl] = useState('');
  const [adminUrl, setAdminUrl] = useState('');
  const [publishedPendingSbtLinks, setPublishedPendingSbtLinks] = useState<PublishedPendingSbtLink[]>([]);
  const [adminUrlStatus, setAdminUrlStatus] = useState('');
  const [publishAdvancedOpen, setPublishAdvancedOpen] = useState(false);
  const [publishStep, setPublishStep] = useState(0); // 0=idle, 1=deploying sbts/uploading, 2=uploading, 3=registering, 4=done
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishStepElapsedMs, setPublishStepElapsedMs] = useState(0);
  const [wizardMode, setWizardMode] = useState('normal');
  const [wizardDisplaySettingsOpen, setWizardDisplaySettingsOpen] = useState(false);
  const [registryChainId, setRegistryChainId] = useState(() => {
    const fromDraft = Number(draft.networkChainId || 0);
    if (fromDraft && getSessionRegistryAddress(fromDraft)) return fromDraft;
    const fromNetwork = Number(network?.id || 0);
    if (fromNetwork && getSessionRegistryAddress(fromNetwork)) return fromNetwork;
    const defaultRegistryChainId = Number(DEFAULT_CHAIN_ID || 0);
    if (defaultRegistryChainId && getSessionRegistryAddress(defaultRegistryChainId)) {
      return defaultRegistryChainId;
    }
    const available = getSessionRegistryChains();
    if (available.length) return available[0].id;
    return DEFAULT_CHAIN_ID;
  });
  const checkSessionSlugExists = useCallback(({ registryChainId: chainId, slug }) => (
    sessionRegistryUtils
      .getRegistryContract(chainId)
      .sessionExists(sessionRegistryUtils.toRegistrySlug(slug))
  ), []);
  const { slugAvailability } = useSessionSlugState({
    slug: draft?.slug,
    privateSlugMode,
    registryChainId,
    isReservedSlug: isReservedSessionSlug,
    sessionExists: checkSessionSlugExists,
  });
  const initialGateRef = useRef(initialGates[0]);
  const [encryptionGates, setEncryptionGates] = useState(() => initialGates);
  // Pending SBT drafts carry deploy secrets and claim codes, so keep them out
  // of localStorage while still surviving same-tab refreshes via sessionStorage.
  const {
    pendingSbtDrafts,
    setPendingSbtDrafts,
    normalizedPendingSbtDrafts,
    hasUndeployedPendingSbtDrafts,
  } = usePendingSbtDrafts();
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
  const [pendingCreateSbtLaunch, setPendingCreateSbtLaunch] = useState<UnknownRecord | null>(null);
  const hasPrivateSbtName = useMemo(() => {
    const gates = Array.isArray(encryptionGates) ? encryptionGates : [];
    return gates.some((gate) => normalizeSbtSelection(gate?.sbts || []).some((sbt) => (
      toStr(sbt?.name).toLowerCase().includes('private')
    )));
  }, [encryptionGates]);
  const lastHasPrivateSbtNameRef = useRef(false);
  const [gateSelections, setGateSelections] = useState<UnknownRecord>(() => initialGateSelections);
  const [defaultGateId, setDefaultGateId] = useState(() => initialDefaultGateId || initialGateRef.current.id);
  const [createSbtTargetGateId, setCreateSbtTargetGateId] = useState(
    () => initialDefaultGateId || initialGateRef.current?.id || ''
  );
  const [featuredDraftGateAutoLink, setFeaturedDraftGateAutoLink] = useState(() => initialFeaturedDraftGateAutoLink);
  // Gate selection is always per-resource when multiple gates exist (no toggle needed).
  const [resourceGateMap, setResourceGateMap] = useState<Record<string, string>>(() => {
    const cachedMap = cachedWizard?.resourceGateMap;
    if (cachedMap && typeof cachedMap === 'object') return cachedMap;
    return buildResourceGateMap(initialGates, initialDefaultGateId || initialGateRef.current.id);
  });
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);
  const [latestChainBlock, setLatestChainBlock] = useState<number | null>(null);
  const [latestBlockStatus, setLatestBlockStatus] = useState('');
  const [blockLimitDuration, setBlockLimitDuration] = useState('');
  const [blockLimitUnit, setBlockLimitUnit] = useState('hours');
  const blockStartManualRef = useRef(false);
  const blockEndAutoRef = useRef(false);
  const sessionIdRotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminUrlStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jsonCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compactSessionHeaderInputRef = useRef<HTMLInputElement | null>(null);
  const registryChainHydratedRef = useRef(false);
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
  }, [
    draft?.networkChainId,
    network?.chainId,
    network?.id,
    registryChainId,
    resolvedActiveSessionSlug,
  ]);

  useEffect(() => {
    const sourceSlugRaw = resolvedActiveSessionSlug ?? selectorSourceSessionConfig?.slug;
    const sourceValue = selectorSourceSessionConfig?.embeddedDeployHelperEnabled;
    if ((sourceSlugRaw === undefined || sourceSlugRaw === null) || typeof sourceValue !== 'boolean') return;
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
  const selectorSourceChainId = Number(
    selectorSourceSessionConfig?.networkChainId ||
    registryChainId ||
    draft?.networkChainId ||
    network?.id ||
    network?.chainId ||
    0
  ) || null;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (sessionIdRotationTimerRef.current) {
        clearTimeout(sessionIdRotationTimerRef.current);
        sessionIdRotationTimerRef.current = null;
      }
      if (adminUrlStatusTimerRef.current) {
        clearTimeout(adminUrlStatusTimerRef.current);
        adminUrlStatusTimerRef.current = null;
      }
      if (sessionIdStatusTimerRef.current) {
        clearTimeout(sessionIdStatusTimerRef.current);
        sessionIdStatusTimerRef.current = null;
      }
      if (jsonCopiedTimerRef.current) {
        clearTimeout(jsonCopiedTimerRef.current);
        jsonCopiedTimerRef.current = null;
      }
    };
  }, []);
  const [workerMode, setWorkerMode] = useState('default');
  const [workerSecretsEnabled, setWorkerSecretsEnabled] = useState(() =>
    typeof cachedWizard?.workerSecretsEnabled === 'boolean' ? cachedWizard.workerSecretsEnabled : true
  );
  const [persistWorkerSecrets, setPersistWorkerSecrets] = useState(() => (
    typeof cachedWizard?.persistWorkerSecrets === 'boolean'
      ? cachedWizard.persistWorkerSecrets
      : DEV_PERSIST_WORKER_SECRETS
  ));
  const cachedDeployForm: DeployFormState = (
    cachedWizard?.deployForm &&
    typeof cachedWizard.deployForm === 'object' &&
    !Array.isArray(cachedWizard.deployForm)
  ) ? cachedWizard.deployForm as DeployFormState : {};
  const [deployHelperUrl, setDeployHelperUrl] = useState(() => toStr(CLOUDFLARE_DEPLOY_HELPER_URL));
  const [deployForm, setDeployForm] = useState<DeployFormState>({
    apiToken: toStr(cachedDeployForm.apiToken || '').trim(),
    workerName: toStr(cachedDeployForm.workerName || '').trim(),
    adminAddress: toStr(cachedDeployForm.adminAddress || '').trim() || null,
    accountId: toStr(cachedDeployForm.accountId || '').trim(),
    bundleUrl: toStr(cachedDeployForm.bundleUrl || CLOUDFLARE_WORKER_BUNDLE_URL),
  });
  const [bundleMode, setBundleMode] = useState(() => (toStr(CLOUDFLARE_WORKER_BUNDLE_URL) ? 'url' : 'upload'));
  const [bundleFile, setBundleFile] = useState<File | null>(null);
  const [forceManualBundleFile, setForceManualBundleFile] = useState(false);
  const [normalModeBundleUrlOverride, setNormalModeBundleUrlOverride] = useState('');
  const [deployStatus, setDeployStatus] = useState('');
  const [deployInFlight, setDeployInFlight] = useState(false);
  const [deployComplete, setDeployComplete] = useState(() => !!cachedWizard?.deployComplete);
  const [deployWorkerUrl, setDeployWorkerUrl] = useState(() => normalizeBaseUrl(toStr(cachedWizard?.deployWorkerUrl).trim()));
  const [provisionedSponsoredContext, setProvisionedSponsoredContext] = useState<UnknownRecord>(() => ({
    ...buildEmptyProvisionedSponsoredContext(),
    sessionSlug: sessionRegistryUtils.normalizeSlug(cachedWizard?.provisionedSponsoredContext?.sessionSlug),
    workerUrl: normalizeWorkerAuthUrl(toStr(cachedWizard?.provisionedSponsoredContext?.workerUrl).trim()),
    fields: sanitizeSessionWizardSponsoredFieldSnapshotForLitMode(cachedWizard?.provisionedSponsoredContext?.fields),
  }));
  const [persistedNewSessionBannerDismissed, setPersistedNewSessionBannerDismissed] = useState(() => (
    readSessionWizardNewSessionBannerDismissed()
  ));
  const [newSessionBannerDismissedContext, setNewSessionBannerDismissedContext] = useState('');
  const [workerSecrets, setWorkerSecrets] = useState<WorkerSecretsLike>(() => {
    const cached = cachedWizard?.workerSecrets;
    return sanitizeSessionWizardWorkerSecretsForLitMode(cached);
  });
  const deployFormRef = useRef<DeployFormState>(deployForm);
  const resolvedWalletAccountRef = useRef(toStr(account).trim());
  const advancedBundleFileInputRef = useRef<HTMLInputElement | null>(null);
  const normalModeRetryBundleFileInputRef = useRef<HTMLInputElement | null>(null);
  const sponsoredPublishBundleFileInputRef = useRef<HTMLInputElement | null>(null);
  const deployCompleteRef = useRef(!!cachedWizard?.deployComplete);
  const deployWorkerUrlRef = useRef(normalizeBaseUrl(toStr(cachedWizard?.deployWorkerUrl).trim()));
  const provisionedSponsoredContextRef = useRef({
    ...buildEmptyProvisionedSponsoredContext(),
    sessionSlug: sessionRegistryUtils.normalizeSlug(cachedWizard?.provisionedSponsoredContext?.sessionSlug),
    workerUrl: normalizeWorkerAuthUrl(toStr(cachedWizard?.provisionedSponsoredContext?.workerUrl).trim()),
    fields: sanitizeSessionWizardSponsoredFieldSnapshotForLitMode(cachedWizard?.provisionedSponsoredContext?.fields),
  });
  const workerSecretsEnabledRef = useRef(workerSecretsEnabled);
  const persistWorkerSecretsRef = useRef(persistWorkerSecrets);
  const workerSecretsRef = useRef<WorkerSecretsLike>(
    sanitizeSessionWizardWorkerSecretsForLitMode(cachedWizard?.workerSecrets)
  );
  const workerDeployRuntimeRef = useRef(null);
  const toggleLoginModalRef = useRef<SessionWizardProps['toggleLoginModal']>(toggleLoginModal);
  toggleLoginModalRef.current = toggleLoginModal;
  const togglePrivateSlugModeRef = useRef<null | (() => void)>(null);
  const updateDraftValueRef = useRef<null | ((path: unknown[], value: unknown) => void)>(null);
  const resolveCreateSbtTargetGateIdRef = useRef<null | ((requestedGateId?: unknown) => string)>(null);
  const openCreateSbtModalRef = useRef<null | ((options?: UnknownRecord) => void)>(null);
  const clearPendingSbtDraftsRef = useRef<null | ((draftsToClear?: unknown[], statusMessage?: string) => void)>(null);
  const pruneAllPendingSbtSelectionsRef = useRef<null | (() => void)>(null);
  const prunePendingSbtSelectionsRef = useRef<null | ((addressLowerSet: Set<string>) => void)>(null);
  const clearFeaturedDraftGateAutoLinkRef = useRef<null | ((address?: unknown) => void)>(null);
  const dismissFeaturedDraftGateAutoLinkRef = useRef<null | ((args?: UnknownRecord) => void)>(null);
  const [workerUrlAutoFilled, setWorkerUrlAutoFilled] = useState(false);
  const defaultSponsoredSbtLookupInFlightRef = useRef('');
  const pendingSbtDeployContextSignature = useMemo(() => (
    buildPendingSbtDeployContextSignature(
      {
        networkChainId: Number(draft?.networkChainId || registryChainId || network?.id || network?.chainId || 0) || 0,
        contracts: draft?.contracts || {},
      },
      registryChainId || network?.id || network?.chainId || null
    )
  ), [
    draft?.contracts,
    draft?.networkChainId,
    network?.chainId,
    network?.id,
    registryChainId,
  ]);
  const slugFreezeAnchor = toStr(draft?.slug || resolvedActiveSessionSlug).trim();
  // Regression guard: queued SBT metadata already bakes in the active session slug.
  // Keep the wizard URL stable until those pending deployments are cleared.
  const slugPinnedByPendingSbtDrafts = hasUndeployedPendingSbtDrafts && !!slugFreezeAnchor;
  const pendingSbtDeployContextRef = useRef(pendingSbtDeployContextSignature);
  // Regression guard: hidden worker secrets must stay out of deferred SBT uploads
  // when the wizard is switched to user-paid mode.
  const getEnabledWorkerArweaveJwk = (secretsIn = workerSecrets) => (
    workerSecretsEnabled ? toStr(secretsIn?.arweaveJwk).trim() : ''
  );
  // Regression guard: sponsored-bundle apply/restore spans async work, so these
  // helpers must read from refs instead of state dependencies. Recreating them
  // mid-apply causes the bundle loader effect to cancel before it can finish.
  const getCurrentWorkerSecrets = useCallback(() => sanitizeSessionWizardWorkerSecretsForLitMode(
    resolveWorkerSecretsSnapshot({
      workerSecretsRef,
      defaults: DEFAULT_WORKER_SECRETS,
    })
  ), []);
  const getCurrentEnabledWorkerSecrets = useCallback(() => resolveSessionWizardEnabledWorkerSecrets({
    workerSecrets: getCurrentWorkerSecrets(),
    workerSecretsEnabled,
  }), [getCurrentWorkerSecrets, workerSecretsEnabled]);
  const applyWorkerSecretsUpdate = useCallback((nextValueOrUpdater) => {
    const current = resolveWorkerSecretsSnapshot({
      workerSecretsRef,
      defaults: DEFAULT_WORKER_SECRETS,
    });
    const nextValue = typeof nextValueOrUpdater === 'function'
      ? nextValueOrUpdater(current)
      : nextValueOrUpdater;
    const next = sanitizeSessionWizardWorkerSecretsForLitMode(
      {
        ...DEFAULT_WORKER_SECRETS,
        ...((nextValue && typeof nextValue === 'object') ? nextValue : {}),
      }
    );
    workerSecretsRef.current = next;
    setWorkerSecrets(next);
    return next;
  }, []);
  const updateSponsoredBundleDraftCorsWorkerUrl = useCallback((nextCorsWorkerUrl = '') => {
    setDraft((prev) => {
      const desiredWorkerUrl = toStr(nextCorsWorkerUrl || '').trim();
      if (toStr(prev?.corsWorkerUrl || '').trim() === desiredWorkerUrl) return prev;
      const next = deepClone(prev);
      next.corsWorkerUrl = desiredWorkerUrl;
      return next;
    });
  }, []);
  const updateSponsoredBundleDeploymentState = useCallback(({
    deployForm: nextDeployForm,
    deployStatus: nextDeployStatus,
    deployInFlight: nextDeployInFlight,
    deployComplete: nextDeployComplete,
    workerMode: nextWorkerMode,
    deployWorkerUrl: nextDeployWorkerUrl,
    provisionedSponsoredContext: nextProvisionedSponsoredContext,
    forceManualBundleFile: nextForceManualBundleFile,
    normalModeBundleUrlOverride: nextNormalModeBundleUrlOverride,
    workerUrlAutoFilled: nextWorkerUrlAutoFilled,
  } = {}) => {
    if (nextDeployForm !== undefined) {
      setDeployForm(nextDeployForm);
    }
    if (typeof nextDeployStatus === 'string') {
      setDeployStatus(nextDeployStatus);
    }
    if (typeof nextDeployInFlight === 'boolean') {
      setDeployInFlight(nextDeployInFlight);
    }
    if (typeof nextDeployComplete === 'boolean') {
      setDeployComplete(nextDeployComplete);
    }
    if (typeof nextWorkerMode === 'string') {
      setWorkerMode(nextWorkerMode);
    }
    if (typeof nextDeployWorkerUrl === 'string') {
      setDeployWorkerUrl(nextDeployWorkerUrl);
    }
    if (nextProvisionedSponsoredContext !== undefined) {
      setProvisionedSponsoredContext(nextProvisionedSponsoredContext);
    }
    if (typeof nextForceManualBundleFile === 'boolean') {
      setForceManualBundleFile(nextForceManualBundleFile);
    }
    if (typeof nextNormalModeBundleUrlOverride === 'string') {
      setNormalModeBundleUrlOverride(nextNormalModeBundleUrlOverride);
    }
    if (typeof nextWorkerUrlAutoFilled === 'boolean') {
      setWorkerUrlAutoFilled(nextWorkerUrlAutoFilled);
    }
  }, []);
  const updateSponsoredBundleWorkerSecretState = useCallback(({
    workerSecretsEnabled: nextWorkerSecretsEnabled,
    persistWorkerSecrets: nextPersistWorkerSecrets,
  } = {}) => {
    if (typeof nextWorkerSecretsEnabled === 'boolean') {
      setWorkerSecretsEnabled(nextWorkerSecretsEnabled);
    }
    if (typeof nextPersistWorkerSecrets === 'boolean') {
      setPersistWorkerSecrets(nextPersistWorkerSecrets);
    }
  }, []);
  const {
    sponsoredBundleStatus,
    sponsoredBundleRetryNonce,
    setSponsoredBundleRetryNonce,
    sponsoredBundleAppliedBundleRef,
    hasSponsoredBundleLink,
  } = useSponsoredBundleLifecycle({
    initialSponsoredBundleId,
    initialSponsoredBundleKey,
    draftSlug: draft?.slug,
    refs: {
      draftRef,
      deployFormRef,
      deployCompleteRef,
      deployWorkerUrlRef,
      provisionedSponsoredContextRef,
      workerSecretsEnabledRef,
      persistWorkerSecretsRef,
    },
    getCurrentWorkerSecrets,
    applyWorkerSecretsUpdate,
    updateDraftCorsWorkerUrl: updateSponsoredBundleDraftCorsWorkerUrl,
    updateDeploymentState: updateSponsoredBundleDeploymentState,
    updateWorkerSecretState: updateSponsoredBundleWorkerSecretState,
  });
  const clearSelectedBundleFile = useCallback(() => {
    setBundleFile(null);
    [
      advancedBundleFileInputRef.current,
      normalModeRetryBundleFileInputRef.current,
      sponsoredPublishBundleFileInputRef.current,
    ].forEach((input) => {
      if (input && typeof input.value === 'string') {
        input.value = '';
      }
    });
  }, []);
  const DEFAULT_ALLOWED_ORIGINS = buildSessionWizardDefaultAllowedOrigins().join('\n');
  const [workerAllowOrigins, setWorkerAllowOrigins] = useState(DEFAULT_ALLOWED_ORIGINS);
  const [workerLimitPerWallet, setWorkerLimitPerWallet] = useState('');
  const [sessionHeaderMode, setSessionHeaderMode] = useState('url');
  const [compactSessionHeaderMode, setCompactSessionHeaderMode] = useState('idle');
  const [sessionHeaderFile, setSessionHeaderFile] = useState<File | null>(null);
  const [sessionHeaderPreviewUrl, setSessionHeaderPreviewUrl] = useState('');
  const sessionHeaderPreviewUrlRef = useRef(sessionHeaderPreviewUrl);
  sessionHeaderPreviewUrlRef.current = sessionHeaderPreviewUrl;
  const [sessionHeaderPreviewModalOpen, setSessionHeaderPreviewModalOpen] = useState(false);
  const [sessionHeaderUploadStatus, setSessionHeaderUploadStatus] = useState('');
  const [sessionHeaderUploadStatusTone, setSessionHeaderUploadStatusTone] = useState<SessionHeaderUploadStatusTone>('default');
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [metadataObjectCollapsed, setMetadataObjectCollapsed] = useState<MetadataObjectCollapsedState>({
    contracts: true,
    faucet: true,
    ai: true,
    lit: true,
    storageProfile: true,
  });
  const [collapsedSections, setCollapsedSections] = useState<CollapsedSectionsState>(() => ({
    worker: true,
    encryption: wizardMode !== 'advanced',
    metadata: false,
    publish: true,
  }));
  const workerResourceKeys = useMemo(
    () => getSessionWizardWorkerResourceKeys(),
    []
  );
  const normalizedDraftStorageProfile = useMemo(
    () => normalizeSessionStorageProfileConfig(draft?.storageProfile),
    [draft?.storageProfile]
  );
  const cloudflareWorkerSbtGateMode = isWorkerSbtGateCloudflareStorageProfile(normalizedDraftStorageProfile);
  const visibleWorkerResourceKeys = useMemo(
    () => workerResourceKeys.filter((key) => !cloudflareWorkerSbtGateMode || key !== 'lit'),
    [cloudflareWorkerSbtGateMode, workerResourceKeys]
  );
  const setSessionHeaderStatus = useCallback((text = '', tone = 'default') => {
    setSessionHeaderUploadStatus(text);
    setSessionHeaderUploadStatusTone(text ? tone : 'default');
  }, []);
  useEffect(() => {
    if (wizardMode === 'advanced') return;
    setCollapsedSections((prev) => {
      const firstOpenSection = ['metadata', 'encryption', 'worker', 'publish']
        .find((key) => prev[key] === false) || 'metadata';
      return {
        metadata: firstOpenSection !== 'metadata',
        encryption: firstOpenSection !== 'encryption',
        worker: firstOpenSection !== 'worker',
        publish: firstOpenSection !== 'publish',
      };
    });
  }, [wizardMode]);
  useEffect(() => {
    if (!hasSponsoredBundleLink) {
      setWizardDisplaySettingsOpen(false);
    }
  }, [hasSponsoredBundleLink]);

  const effectivePersistWorkerSecrets = DEV_PERSIST_WORKER_SECRETS && persistWorkerSecrets;

  const registryAddress = useMemo(() => {
    return resolveSessionWizardRegistryAddress(registryChainId, draft?.contracts);
  }, [registryChainId, draft?.contracts]);
  const registryChainName = useMemo(() => getChainName(registryChainId), [registryChainId]);
  const registryChainOptions = useMemo(() => getSessionRegistryChains(), []);
  const newSessionFundingChain = useMemo(() => {
    const chainId = Number(
      registryChainId ||
      DEFAULT_CHAIN_ID ||
      0
    ) || 0;
    const chain = getChainById(chainId);
    if (chain) return chain;
    if (!chainId) return null;
    return {
      id: chainId,
      name: getChainName(chainId) || `Chain ${chainId}`,
      nativeCurrency: { symbol: 'ETH' },
    };
  }, [registryChainId]);
  const newSessionFundingRequirementLabel = useMemo(() => {
    const chainName = toStr(newSessionFundingChain?.name).trim();
    const chainSymbol = toStr(newSessionFundingChain?.nativeCurrency?.symbol).trim() || 'ETH';
    return `${chainName || 'Selected network'} ${chainSymbol} for on-chain registration`;
  }, [newSessionFundingChain]);
  const newSessionFundingRequirementHref = Number(newSessionFundingChain?.id || 0) === 11155420
    ? SESSION_WIZARD_REQUIREMENT_LINKS.optimismSepoliaFaucet
    : '';

  const buildWorkerName = (rawName) => {
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

  useEffect(() => {
    if (account && (deployForm.adminAddress === undefined || deployForm.adminAddress === null)) {
      setDeployForm((prev) => ({ ...prev, adminAddress: account }));
    }
  }, [account, deployForm.adminAddress]);

  useEffect(() => {
    const desiredChain = Number(initialRegistryChainId || 0) || null;
    if (!desiredChain) return;
    // For now we assume session chain === registry chain; if this diverges, split these values.
    setRegistryChainId((prev) => (Number(prev || 0) === desiredChain ? prev : desiredChain));
  }, [initialRegistryChainId]);

  useEffect(() => {
    const raw = toStr(initialSessionId).trim();
    if (!raw) return;
    const parsedSessionId = sessionRegistryUtils.formatSessionId(raw);
    if (parsedSessionId) {
      setSessionId(parsedSessionId);
      return;
    }
    const desiredSlug = normalizeSlug(raw);
    setDraft((prev) => {
      if (toStr(prev.slug).trim()) return prev;
      const next = deepClone(prev);
      next.slug = desiredSlug;
      return next;
    });
  }, [initialSessionId]);

  useEffect(() => {
    if (slugPinnedByPendingSbtDrafts) return;
    if (!privateSlugMode) return;
    const desiredSlug = sessionRegistryUtils.formatSessionId(sessionId) || toStr(sessionId).trim();
    if (!desiredSlug) return;
    setDraft((prev) => {
      if (toStr(prev.slug).trim() === desiredSlug) return prev;
      const next = deepClone(prev);
      next.slug = desiredSlug;
      return next;
    });
  }, [privateSlugMode, sessionId, slugPinnedByPendingSbtDrafts]);

  // Auto-generate slug from sessionName when not in private URL mode.
  useEffect(() => {
    if (slugPinnedByPendingSbtDrafts) return;
    if (privateSlugMode) return;
    const name = toStr(draft?.sessionName).trim();
    if (!name) return;
    const autoSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 48);
    if (!autoSlug) return;
    const currentSlug = toStr(draft?.slug).trim();
    if (currentSlug && currentSlug === lastManualSlugRef.current && currentSlug !== autoSlug) return;
    if (autoSlug === toStr(draft?.slug).trim()) return;
    setDraft((prev) => {
      const next = deepClone(prev);
      next.slug = autoSlug;
      return next;
    });
  }, [draft?.sessionName, draft?.slug, privateSlugMode, slugPinnedByPendingSbtDrafts]);

  useEffect(() => {
    const prev = lastHasPrivateSbtNameRef.current;
    lastHasPrivateSbtNameRef.current = hasPrivateSbtName;
    if (!hasPrivateSbtName || prev) return;
    if (privateSlugModeRef.current) return;
    togglePrivateSlugModeRef.current?.();
  }, [hasPrivateSbtName]);

  useEffect(() => {
    // Persist wizard state between refreshes until deploy/upload clears them.
    // Default: redact secret values so refresh requires re-entry (security: no keys in localStorage).
    // Pending SBT drafts use sessionStorage so same-tab refresh can recover
    // queued CREATE2 drafts without turning them into long-lived local secrets.
    // Dev toggle: optionally persist secrets locally for faster iteration.
    writeSessionWizardCache(buildSessionWizardCacheWritePayload({
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
      deployComplete,
      deployWorkerUrl,
      provisionedSponsoredContext,
    }));
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
    const nextName = buildWorkerName(draft.sessionName || '');
    if (nextName && nextName !== deployForm.workerName) {
      setDeployForm((prev) => ({ ...prev, workerName: nextName }));
    }
  }, [draft.sessionName, deployForm.workerName]);

  useEffect(() => {
    const defaultUrl = getSessionWizardDefaultWorkerUrl();
    const current = toStr(draft.corsWorkerUrl).trim();
    if (current && defaultUrl && current !== defaultUrl) {
      setWorkerMode('custom');
    }
  }, [draft.corsWorkerUrl]);

  useEffect(() => {
    if (!deployComplete) return;
    const configured = normalizeBaseUrl(toStr(draft.corsWorkerUrl).trim());
    const deployed = normalizeBaseUrl(toStr(deployWorkerUrl).trim());
    if (!configured || !deployed || configured !== deployed) {
      setDeployComplete(false);
    }
  }, [draft.corsWorkerUrl, deployComplete, deployWorkerUrl]);

  useEffect(() => {
    if (wizardMode !== 'normal' || NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED) return;
    const fallbackUrl = normalizeWorkerAuthUrl(getSessionWizardDefaultWorkerUrl());
    const configuredUrl = normalizeWorkerAuthUrl(toStr(draft.corsWorkerUrl).trim());
    if (workerMode === 'default') {
      setWorkerMode('custom');
    }
    if (!deployComplete && configuredUrl && fallbackUrl && configuredUrl === fallbackUrl) {
      setWorkerUrlAutoFilled(false);
      updateDraftValueRef.current?.(['corsWorkerUrl'], '');
    }
  }, [wizardMode, workerMode, draft.corsWorkerUrl, deployComplete]);

  useEffect(() => {
    const chainId = Number(registryChainId || 0) || 0;
    blockStartManualRef.current = false;
    blockEndAutoRef.current = false;
    if (!chainId) return;
    setDraft((prev) => {
      const next = deepClone(prev);
      if (Number(next.networkChainId || 0) !== chainId) {
        // NOTE: For now we assume session chain === registry chain; split these when they diverge.
        next.networkChainId = chainId;
      }
      // Contract defaults currently come from bundled per-chain config; ENS discovery remains future work.
      const defaults = getSessionWizardContractDefaults(chainId);
      if (!next.contracts || typeof next.contracts !== 'object') {
        next.contracts = {};
      }
      const keys = new Set([
        ...Object.keys(next.contracts || {}),
        ...Object.keys(defaults || {}),
      ]);
      keys.forEach((key) => {
        if (!next.contracts[key] || typeof next.contracts[key] !== 'object') {
          next.contracts[key] = {};
        }
        const fallback = toStr(defaults?.[key] || '').trim();
        if (fallback) {
          next.contracts[key].address = fallback;
        }
        next.contracts[key].chainId = chainId;
      });
      // Auto-fill the current PATH public RPC; dedicated gateway/provider-tier support remains future work.
      const pathRpc = getDefaultHttpRpc(chainId);
      if (pathRpc) {
        if (!next.rpc || typeof next.rpc !== 'object') next.rpc = {};
        if (!toStr(next.rpc.provider).trim()) {
          next.rpc.provider = 'path';
        }
        if (!next.rpc.providers || typeof next.rpc.providers !== 'object') next.rpc.providers = {};
        if (!next.rpc.providers.path || typeof next.rpc.providers.path !== 'object') next.rpc.providers.path = {};
        if (!toStr(next.rpc.providers.path.rpcUrl).trim()) {
          next.rpc.providers.path.rpcUrl = pathRpc;
        }
        if (!next.faucet || typeof next.faucet !== 'object') next.faucet = {};
        if (!toStr(next.faucet.rpcUrl).trim()) {
          next.faucet.rpcUrl = pathRpc;
        }
      }
      return next;
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
    const normalizedPendingDrafts = normalizePendingSbtDrafts(pendingSbtDraftsRef.current);
    if (!registryChainHydratedRef.current) {
      registryChainHydratedRef.current = true;
      return;
    }
    if (normalizedPendingDrafts.length > 0) {
      clearPendingSbtDraftsRef.current?.(
        normalizedPendingDrafts,
        'Pending SBT drafts were cleared because the session chain or SBT factory changed. Recreate them before publishing.'
      );
      pruneAllPendingSbtSelectionsRef.current?.();
    }
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
      workerResourceKeys.forEach((key) => {
        const desiredGateIds = normalizeGateIds(prev[key]).filter((id) => gateIds.includes(id));
        const fallbackGateId = toStr(defaultGateId).trim() || gateIds[0] || '';
        const resolved = desiredGateIds.length > 1 ? desiredGateIds : (desiredGateIds[0] || fallbackGateId);
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
      const gates = {};
      encryptionGates.forEach((gate) => {
        const sbtAddresses = normalizeSbtSelection(gate.sbts || [])
          .map((sbt) => sbt.address)
          .filter(Boolean);
        gates[gate.id] = {
          type: 'sbt',
          label: gate.label,
          sbtAddresses,
          sbtAddress: sbtAddresses[0],
          chainId,
          litChain,
          mode: gate.mode,
        };
      });
      const resources = {};
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

  useEffect(() => {
    const chainId = Number(registryChainId || 0) || 0;
    if (!chainId) {
      setLatestChainBlock(null);
      return;
    }
    const rpcUrl = getDefaultHttpRpc(chainId);
    if (!rpcUrl) {
      setLatestChainBlock(null);
      return;
    }
    let alive = true;
    setLatestBlockStatus('Fetching latest block...');
    // Static network avoids `detectNetwork()` overhead; rpcReadCache wraps `.send()` to dedupe/cache reads.
    const providerRpc = new ethers.providers.JsonRpcProvider(rpcUrl, { chainId, name: `chain-${chainId}` });
    wrapEthersJsonRpcSend(providerRpc, {
      chainId,
      providerKey: `sessionWizard:latestBlock:${chainId}`,
      providerLabel: 'sessionWizard',
      url: rpcUrl,
    });
    providerRpc
      .getBlockNumber()
      .then((blockNumber) => {
        if (!alive) return;
        setLatestChainBlock(blockNumber);
        setLatestBlockStatus('');
      })
      .catch(() => {
        if (!alive) return;
        setLatestChainBlock(null);
        setLatestBlockStatus('Unable to load latest block.');
      });
    return () => {
      alive = false;
    };
  }, [registryChainId]);

  useEffect(() => {
    if (!latestChainBlock) return;
    if (blockStartManualRef.current) return;
    setDraft((prev) => {
      const next = deepClone(prev);
      if (!next.blockLimits || typeof next.blockLimits !== 'object') {
        next.blockLimits = {};
      }
      const currentStart = Number(next.blockLimits.start);
      if (!Number.isFinite(currentStart) || currentStart !== latestChainBlock) {
        next.blockLimits.start = latestChainBlock;
      }
      return next;
    });
  }, [latestChainBlock]);

  useEffect(() => {
    const duration = Number(blockLimitDuration || 0);
    const unitMs = blockLimitUnit === 'days' ? 86400000 : blockLimitUnit === 'minutes' ? 60000 : 3600000;
    const startFromDraft = Number(draft?.blockLimits?.start);
    const fallbackStart = Number(latestChainBlock);
    const startBlock = (Number.isFinite(startFromDraft) && startFromDraft > 0)
      ? startFromDraft
      : ((Number.isFinite(fallbackStart) && fallbackStart > 0) ? fallbackStart : 0);
    if (!startBlock || !Number.isFinite(duration) || duration <= 0) {
      if (blockEndAutoRef.current) {
        updateDraftValueRef.current?.(['blockLimits', 'end'], null);
        blockEndAutoRef.current = false;
      }
      return;
    }
    const blockTimeMs = getChainBlockTimeMs(registryChainId);
    const blocks = Math.max(1, Math.ceil((duration * unitMs) / blockTimeMs));
    const endBlock = startBlock + blocks;
    updateDraftValueRef.current?.(['blockLimits', 'end'], endBlock);
    blockEndAutoRef.current = true;
  }, [blockLimitDuration, blockLimitUnit, latestChainBlock, registryChainId, draft?.blockLimits?.start]);

  useEffect(() => {
    const fastProvider = normalizeAiProvider(draft?.ai?.models?.fast?.provider || 'openai');
    const thinkingProvider = normalizeAiProvider(draft?.ai?.models?.thinking?.provider || 'openai');
    const fastCurrent = toStr(draft?.ai?.models?.fast?.model).trim();
    const thinkingCurrent = toStr(draft?.ai?.models?.thinking?.model).trim();
    const fastNext = normalizeAiModelForProvider('fast', fastProvider, fastCurrent);
    const thinkingNext = normalizeAiModelForProvider('thinking', thinkingProvider, thinkingCurrent);
    if (fastNext === fastCurrent && thinkingNext === thinkingCurrent) return;
    setDraft((prev) => {
      const next = deepClone(prev);
      if (!next.ai || typeof next.ai !== 'object') next.ai = {};
      if (!next.ai.models || typeof next.ai.models !== 'object') next.ai.models = {};
      if (fastNext !== fastCurrent) {
        if (!next.ai.models.fast || typeof next.ai.models.fast !== 'object') next.ai.models.fast = {};
        next.ai.models.fast.model = fastNext;
      }
      if (thinkingNext !== thinkingCurrent) {
        if (!next.ai.models.thinking || typeof next.ai.models.thinking !== 'object') next.ai.models.thinking = {};
        next.ai.models.thinking.model = thinkingNext;
      }
      return next;
    });
  }, [
    draft?.ai?.models?.fast?.provider,
    draft?.ai?.models?.fast?.model,
    draft?.ai?.models?.thinking?.provider,
    draft?.ai?.models?.thinking?.model,
  ]);

  useEffect(() => {
    const canCreateObjectUrl = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
    if (!sessionHeaderFile) {
      const currentPreviewUrl = sessionHeaderPreviewUrlRef.current;
      if (
        currentPreviewUrl &&
        typeof URL !== 'undefined' &&
        typeof URL.revokeObjectURL === 'function'
      ) {
        URL.revokeObjectURL(currentPreviewUrl);
      }
      setSessionHeaderPreviewUrl('');
      return;
    }
    if (!canCreateObjectUrl) return undefined;
    const previewUrl = URL.createObjectURL(sessionHeaderFile);
    setSessionHeaderPreviewUrl(previewUrl);
    return () => {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [sessionHeaderFile]);

  const sessionHeaderPreviewSrc = useMemo(() => {
    if (sessionHeaderMode === 'upload') {
      return toStr(sessionHeaderPreviewUrl).trim();
    }
    return normalizeArweaveUrl(draft?.sessionHeader || '', {
      contextLabel: 'session_wizard_header_preview',
    });
  }, [draft?.sessionHeader, sessionHeaderMode, sessionHeaderPreviewUrl]);

  useEffect(() => {
    if (sessionHeaderPreviewSrc) return;
    setSessionHeaderPreviewModalOpen(false);
  }, [sessionHeaderPreviewSrc]);

  const handlePasteSessionHeaderFromClipboard = async () => {
    const clipboardResult = await readCompactImageClipboard({
      fileNamePrefix: 'clipboard-session-header',
    });

    if (clipboardResult?.kind === 'file' && clipboardResult.file) {
      setSessionHeaderMode('upload');
      setCompactSessionHeaderMode('idle');
      setSessionHeaderFile(clipboardResult.file);
      setSessionHeaderStatus('');
      return;
    }

    if (clipboardResult?.kind === 'text') {
      setSessionHeaderMode('url');
      setCompactSessionHeaderMode('url');
      setSessionHeaderFile(null);
      updateDraftValue(['sessionHeader'], clipboardResult.text);
      setSessionHeaderStatus('');
      return;
    }

    setSessionHeaderStatus(clipboardResult?.error || 'Clipboard does not contain a supported image or URL.', 'error');
  };

  const handleClearSessionHeaderPreview = () => {
    setSessionHeaderPreviewModalOpen(false);
    setSessionHeaderMode('url');
    setCompactSessionHeaderMode('idle');
    setSessionHeaderFile(null);
    updateDraftValue(['sessionHeader'], '');
    setSessionHeaderStatus('');
  };

  const defaultSponsoredGateId = draft?.sponsored?.defaultGateId;
  const defaultSponsoredGate = defaultSponsoredGateId ? draft?.sponsored?.gates?.[defaultSponsoredGateId] : null;
  const defaultSponsoredSbtAddress = toStr(defaultSponsoredGate?.sbtAddress || '').trim();
  const defaultSponsoredLookupSlug = resolvedActiveSessionSlug || draft?.slug || '';
  const defaultSponsoredLookupContracts = useStableSerializedObject(draft?.contracts || {});
  const defaultSponsoredLookupRegistry = useStableSerializedObject(draft?.__registry || {});
  const defaultSponsoredLookupNetworkChainId = Number(
    draft?.networkChainId || registryChainId || DEFAULT_CHAIN_ID || 0
  ) || DEFAULT_CHAIN_ID;
  const defaultSponsoredLookupSessionName = draft?.sessionName || '';
  const defaultSponsoredSbtLookupContext = useMemo(() => ({
    slug: defaultSponsoredLookupSlug,
    contracts: defaultSponsoredLookupContracts,
    __registry: defaultSponsoredLookupRegistry,
    networkChainId: defaultSponsoredLookupNetworkChainId,
    sessionName: defaultSponsoredLookupSessionName,
  }), [
    defaultSponsoredLookupContracts,
    defaultSponsoredLookupNetworkChainId,
    defaultSponsoredLookupRegistry,
    defaultSponsoredLookupSessionName,
    defaultSponsoredLookupSlug,
  ]);
  const defaultSponsoredSbtLookupKey = useMemo(() => buildSponsoredSbtLookupContextKey({
    address: defaultSponsoredSbtAddress,
    slug: defaultSponsoredSbtLookupContext.slug,
    sessionName: defaultSponsoredSbtLookupContext.sessionName,
    networkChainId: defaultSponsoredSbtLookupContext.networkChainId,
    contracts: defaultSponsoredSbtLookupContext.contracts,
    registry: defaultSponsoredSbtLookupContext.__registry,
  }), [defaultSponsoredSbtAddress, defaultSponsoredSbtLookupContext]);
  const seededDefaultSponsoredSbtAddress = toStr(encryptionGates?.[0]?.sbts?.[0]?.address || '').trim().toLowerCase();

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
      let sbtName = defaultAddr;
      try {
        const info = await contractScripts.getSbtMetadata(
          'none',
          defaultAddr,
          defaultSponsoredSbtLookupContext
        );
        const displayName = getSbtDisplayName(info);
        if (displayName) sbtName = displayName;
      } catch (e) { log.warn('SessionWizard: fallback', e); }
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

  function focusNormalModeSection(key) {
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

  const toggleSection = (key) => {
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
    const hasQueuedOrSelectedGateSbts = (
      normalizePendingSbtDrafts(pendingSbtDrafts).length > 0 ||
      encryptionGates.some((gate) => normalizeSbtSelection(gate?.sbts || []).length > 0)
    );
    if (hasQueuedOrSelectedGateSbts) {
      setCollapsedSections((prev) => ({ ...prev, encryption: false }));
    }
  };

  const allEncryptionGates = useMemo(() => {
    return [...encryptionGates];
  }, [encryptionGates]);

  const pendingSbtSelectorOptions = useMemo(() => (
    normalizePendingSbtDrafts(pendingSbtDrafts).map((draftEntry) => ({
      address: draftEntry.predictedAddress,
      name: `${draftEntry.displayName} (Pending)`,
      pending: true,
      metadataPreview: draftEntry.metadataPreview || null,
    }))
  ), [pendingSbtDrafts]);

  const getGateById = (gateId) => getSessionWizardGateById(allEncryptionGates, gateId);
  const resolveCreateSbtTargetGateId = (requestedGateId = '') => resolveSessionWizardCreateSbtTargetGateId({
    allEncryptionGates,
    defaultGateId,
    requestedGateId,
  });
  resolveCreateSbtTargetGateIdRef.current = resolveCreateSbtTargetGateId;
  const activeCreateSbtTargetGateId = resolveCreateSbtTargetGateId(createSbtTargetGateId);
  const activeCreateSbtTargetGate = getSessionWizardGateById(allEncryptionGates, activeCreateSbtTargetGateId);
  const focusCreateSbtTargetGate = (gateId = '') => {
    const resolvedGateId = resolveCreateSbtTargetGateId(gateId);
    if (!resolvedGateId) return;
    setCreateSbtTargetGateId((prev) => (prev === resolvedGateId ? prev : resolvedGateId));
  };

  const buildCreateSbtModalLaunchState = (options = {}) => buildSessionWizardCreateSbtModalLaunchState({
    options,
    allEncryptionGates,
    defaultGateId,
    currentDraftSlug: draftRef.current?.slug || '',
    currentArweaveJwk: getEnabledWorkerArweaveJwk(workerSecretsRef.current),
  });

  const openCreateSbtModal = (options = {}) => {
    const nextModalState = buildCreateSbtModalLaunchState(options);
    setCreateSbtModalState({
      open: true,
      ...nextModalState,
    });
  };
  openCreateSbtModalRef.current = openCreateSbtModal;

  const launchCreateSbtModal = (options = {}) => {
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

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    deployFormRef.current = deployForm;
  }, [deployForm]);

  useEffect(() => {
    const normalizedAccount = toStr(account).trim();
    if (normalizedAccount) {
      resolvedWalletAccountRef.current = normalizedAccount;
    }
  }, [account]);

  useEffect(() => {
    if (!toStr(account).trim() || !pendingCreateSbtLaunch) return;
    if (typeof toggleLoginModalRef.current === 'function') toggleLoginModalRef.current(false);
    openCreateSbtModalRef.current?.(pendingCreateSbtLaunch);
    setPendingCreateSbtLaunch(null);
  }, [account, pendingCreateSbtLaunch]);

  useEffect(() => {
    if (!publishBusy || publishStep <= 0) {
      setPublishStepElapsedMs(0);
      return undefined;
    }
    setPublishStepElapsedMs(0);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setPublishStepElapsedMs(Date.now() - startedAt);
    }, 120);
    return () => clearInterval(timer);
  }, [publishBusy, publishStep]);

  useEffect(() => {
    deployCompleteRef.current = deployComplete;
  }, [deployComplete]);

  useEffect(() => {
    deployWorkerUrlRef.current = deployWorkerUrl;
  }, [deployWorkerUrl]);

  useEffect(() => {
    provisionedSponsoredContextRef.current = provisionedSponsoredContext;
  }, [provisionedSponsoredContext]);

  useEffect(() => {
    workerSecretsEnabledRef.current = workerSecretsEnabled;
  }, [workerSecretsEnabled]);

  useEffect(() => {
    persistWorkerSecretsRef.current = persistWorkerSecrets;
  }, [persistWorkerSecrets]);

  useEffect(() => {
    workerSecretsRef.current = workerSecrets;
  }, [workerSecrets]);

  useEffect(() => {
    const resolvedGateId = resolveCreateSbtTargetGateIdRef.current?.(createSbtTargetGateId) || '';
    if (resolvedGateId !== toStr(createSbtTargetGateId).trim()) {
      setCreateSbtTargetGateId(resolvedGateId);
    }
  }, [createSbtTargetGateId, defaultGateId, encryptionGates]);

  const gateOptions = useMemo(() => (
    buildSessionWizardGateOptions(allEncryptionGates)
  ), [allEncryptionGates]);

  const togglePrivateSlugMode = () => {
    if (slugPinnedByPendingSbtDrafts) return;
    setPrivateSlugMode((prev) => {
      const next = !prev;
      setDraft((current) => {
        const nextDraft = deepClone(current);
        if (next) {
          const currentSlug = toStr(current.slug).trim();
          lastManualSlugRef.current = currentSlug;
          const desiredSlug = sessionRegistryUtils.formatSessionId(sessionId) || toStr(sessionId).trim();
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

  const updateDraftValue = (path, value) => {
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

  const updateArrayValue = (path, raw, asJson = false) => {
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

  const updateEncryptionGate = (gateId, updates) => {
    const normalizedUpdates = { ...updates };
    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'sbts')) {
      normalizedUpdates.sbts = dedupeSbtSelection(normalizedUpdates.sbts || []);
    }
    setEncryptionGates((prev) =>
      prev.map((gate) => (gate.id === gateId ? { ...gate, ...normalizedUpdates } : gate))
    );
  };

  const clearFeaturedDraftGateAutoLink = (address = '') => {
    const addressLower = toStr(address).trim().toLowerCase();
    setFeaturedDraftGateAutoLink((prev) => {
      const current = normalizeFeaturedDraftGateAutoLink(prev);
      if (!current) return prev;
      if (addressLower && current.address.toLowerCase() !== addressLower) return prev;
      return null;
    });
  };
  clearFeaturedDraftGateAutoLinkRef.current = clearFeaturedDraftGateAutoLink;

  const dismissFeaturedDraftGateAutoLink = ({ gateId = '', address = '' } = {}) => {
    const gateIdStr = toStr(gateId).trim();
    const addressLower = toStr(address).trim().toLowerCase();
    setFeaturedDraftGateAutoLink((prev) => {
      const current = normalizeFeaturedDraftGateAutoLink(prev);
      if (!current) return prev;
      if (gateIdStr && toStr(current.gateId).trim() !== gateIdStr) return prev;
      if (addressLower && current.address.toLowerCase() !== addressLower) return prev;
      if (current.dismissed) return prev;
      return { ...current, dismissed: true };
    });
  };
  dismissFeaturedDraftGateAutoLinkRef.current = dismissFeaturedDraftGateAutoLink;

  const handleGateAddSbt = (gateId, sbt) => {
    const gateIdStr = toStr(gateId).trim();
    const nextSbt = normalizeSbtSelection([sbt])[0];
    if (!gateIdStr || !nextSbt) return;
    const autoLink = normalizeFeaturedDraftGateAutoLink(featuredDraftGateAutoLink);
    const nextAddressLower = toStr(nextSbt?.address).trim().toLowerCase();
    if (
      autoLink &&
      autoLink.dismissed !== true &&
      toStr(autoLink.gateId).trim() === gateIdStr &&
      nextAddressLower &&
      nextAddressLower !== autoLink.address.toLowerCase()
    ) {
      dismissFeaturedDraftGateAutoLink({ gateId: gateIdStr });
    }
    const targetGate = getGateById(gateIdStr);
    updateEncryptionGate(gateIdStr, { sbts: [...normalizeSbtSelection(targetGate?.sbts || []), nextSbt] });
  };

  const handleGateRemoveSbt = (gateId, address) => {
    const gateIdStr = toStr(gateId).trim();
    const addressLower = toStr(address).trim().toLowerCase();
    if (!gateIdStr || !addressLower) return;
    const autoLink = normalizeFeaturedDraftGateAutoLink(featuredDraftGateAutoLink);
    if (
      autoLink &&
      toStr(autoLink.gateId).trim() === gateIdStr &&
      autoLink.address.toLowerCase() === addressLower
    ) {
      dismissFeaturedDraftGateAutoLink({ gateId: gateIdStr, address });
    }
    const targetGate = getGateById(gateIdStr);
    updateEncryptionGate(gateIdStr, {
      sbts: normalizeSbtSelection(targetGate?.sbts || [])
        .filter((sbt) => toStr(sbt.address).toLowerCase() !== addressLower),
    });
  };

  const handleRemoveDefaultFeaturedSbt = (address) => {
    const addressLower = toStr(address).trim().toLowerCase();
    if (!addressLower) return;
    const nextSelections = normalizeSbtSelection(draftRef.current?.defaultFeaturedSBTs || [])
      .filter((sbt) => toStr(sbt.address).toLowerCase() !== addressLower);
    updateDraftValue(['defaultFeaturedSBTs'], serializeDefaultFeaturedSbtSelections(nextSelections));

    const autoLink = normalizeFeaturedDraftGateAutoLink(featuredDraftGateAutoLink);
    if (
      !autoLink ||
      autoLink.dismissed === true ||
      toStr(autoLink.source).trim() !== FEATURED_DRAFT_GATE_AUTO_LINK_SOURCE ||
      autoLink.address.toLowerCase() !== addressLower
    ) {
      return;
    }

    // Regression guard: removing a Step-1 featured pending SBT should also
    // remove the auto-linked Gate A entry. Otherwise the gate keeps a draft the
    // admin already removed from the featured list.
    clearFeaturedDraftGateAutoLink(address);
    const gateId = toStr(autoLink.gateId).trim() || FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID;
    const targetGate = getGateById(gateId);
    updateEncryptionGate(gateId, {
      sbts: normalizeSbtSelection(targetGate?.sbts || [])
        .filter((sbt) => toStr(sbt.address).toLowerCase() !== addressLower),
    });
  };

  const promoteDeployedPendingSbtSelections = (deployedDrafts = []) => {
    const normalizedDeployedDrafts = normalizePendingSbtDrafts(deployedDrafts);
    if (!normalizedDeployedDrafts.length) return;
    const deployedAddressSet = new Set(
      normalizedDeployedDrafts
        .map((entry) => toStr(entry?.deployedAddress || entry?.predictedAddress).trim().toLowerCase())
        .filter(Boolean)
    );
    if (!deployedAddressSet.size) return;

    // Regression guard: publish clears pending drafts immediately after
    // on-chain registration. Promote matching pending selections to normal
    // deployed selections first so the just-published gate/featured state
    // survives in the local wizard and cache.
    setEncryptionGates((prev) => prev.map((gate) => ({
      ...gate,
      sbts: promotePendingSbtSelectionsAfterDeploy({
        selections: gate?.sbts || [],
        deployedDrafts: normalizedDeployedDrafts,
      }),
    })));
    updateDraftValue(
      ['defaultFeaturedSBTs'],
      serializeDefaultFeaturedSbtSelections(promotePendingSbtSelectionsAfterDeploy({
        selections: draftRef.current?.defaultFeaturedSBTs || [],
        deployedDrafts: normalizedDeployedDrafts,
      }))
    );
    setFeaturedDraftGateAutoLink((prev) => {
      const current = normalizeFeaturedDraftGateAutoLink(prev);
      if (!current) return prev;
      return deployedAddressSet.has(current.address.toLowerCase()) ? null : prev;
    });
  };

  const addEncryptionGate = () => {
    setEncryptionGates((prev) => {
      const idx = getNextGateIndex(prev);
      const next = [...prev, buildEncryptionGate(idx)];
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

  const removeEncryptionGate = (gateId) => {
    const gateIdStr = toStr(gateId).trim();
    setEncryptionGates((prev) => prev.filter((gate) => gate.id !== gateIdStr));
    setEncryptedFieldGates((prev) => {
      const next = { ...(prev || {}) };
      Object.keys(next).forEach((key) => {
        const value = next[key];
        if (Array.isArray(value)) {
          const filtered = value
            .map((id) => toStr(id).trim())
            .filter((id) => id && id !== gateIdStr);
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

  const prunePendingSbtSelections = (addressLowerSet) => {
    if (!(addressLowerSet instanceof Set) || addressLowerSet.size === 0) return;
    setEncryptionGates((prev) => prev.map((gate) => ({
      ...gate,
      sbts: normalizeSbtSelection(gate?.sbts || []).filter(
        (sbt) => !addressLowerSet.has(toStr(sbt?.address).trim().toLowerCase())
      ),
    })));
    updateDraftValue(
      ['defaultFeaturedSBTs'],
      serializeDefaultFeaturedSbtSelections(
        normalizeSbtSelection(draftRef.current?.defaultFeaturedSBTs || [])
          .filter((entry) => !addressLowerSet.has(toStr(entry?.address).trim().toLowerCase()))
      )
    );
  };
  prunePendingSbtSelectionsRef.current = prunePendingSbtSelections;

  const pruneAllPendingSbtSelections = () => {
    setEncryptionGates((prev) => prev.map((gate) => ({
      ...gate,
      sbts: normalizeSbtSelection(gate?.sbts || []).filter((sbt) => sbt?.pending !== true),
    })));
    updateDraftValue(
      ['defaultFeaturedSBTs'],
      serializeDefaultFeaturedSbtSelections(
        normalizeSbtSelection(draftRef.current?.defaultFeaturedSBTs || [])
          .filter((entry) => entry?.pending !== true)
      )
    );
  };
  pruneAllPendingSbtSelectionsRef.current = pruneAllPendingSbtSelections;

  const removePendingSbtDraft = (predictedAddress) => {
    const addressLower = toStr(predictedAddress).trim().toLowerCase();
    if (!addressLower) return;
    setPendingSbtDrafts((prev) => prev.filter((entry) => toStr(entry?.predictedAddress).trim().toLowerCase() !== addressLower));
    prunePendingSbtSelections(new Set([addressLower]));
    clearFeaturedDraftGateAutoLink(predictedAddress);
  };

  const clearPendingSbtDrafts = (draftsToClear = [], statusMessage = '') => {
    const normalizedDrafts = normalizePendingSbtDrafts(draftsToClear);
    if (!normalizedDrafts.length) return;
    const addressLowerSet = new Set(
      normalizedDrafts.map((entry) => toStr(entry?.predictedAddress).trim().toLowerCase()).filter(Boolean)
    );
    setPendingSbtDrafts((prev) => prev.filter(
      (entry) => !addressLowerSet.has(toStr(entry?.predictedAddress).trim().toLowerCase())
    ));
    prunePendingSbtSelections(addressLowerSet);
    if (statusMessage) {
      setStatus(statusMessage);
    }
  };
  clearPendingSbtDraftsRef.current = clearPendingSbtDrafts;

  const handleSavePendingSbtDraft = async (draftPayload) => {
    const normalizedDrafts = normalizePendingSbtDrafts([draftPayload]);
    const nextDraft = normalizedDrafts[0]
      ? {
          ...normalizedDrafts[0],
          deployed: false,
          networkChainId: Number(draftRef.current?.networkChainId || registryChainId || network?.id || network?.chainId || 0) || 0,
          sbtFactoryAddress: toStr(draftRef.current?.contracts?.sbtFactory?.address || '').trim(),
          deploymentContextSignature: pendingSbtDeployContextSignature,
        }
      : null;
    if (!nextDraft) {
      throw new Error('Unable to prepare the pending SBT draft.');
    }
    const pendingSelection = buildPendingSbtSelection(nextDraft);
    if (!pendingSelection) {
      throw new Error('Unable to build the pending SBT selector entry.');
    }

    setPendingSbtDrafts((prev) => {
      const filtered = prev.filter(
        (entry) => toStr(entry?.predictedAddress).trim().toLowerCase() !== nextDraft.predictedAddress.toLowerCase()
      );
      return [...filtered, nextDraft];
    });

    if (createSbtModalState.targetType === 'defaultFeaturedSBTs') {
      const next = [
        ...normalizeSbtSelection(draftRef.current?.defaultFeaturedSBTs || []),
        pendingSelection,
      ];
      updateDraftValue(
        ['defaultFeaturedSBTs'],
        serializeDefaultFeaturedSbtSelections(dedupeSbtSelection(next))
      );
      const gateA = getGateById(FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID);
      const gateASelections = dedupeSbtSelection(gateA?.sbts || []);
      if (!gateASelections.length) {
        updateEncryptionGate(FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID, {
          sbts: [...gateASelections, pendingSelection],
        });
        setFeaturedDraftGateAutoLink({
          gateId: FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID,
          address: pendingSelection.address,
          dismissed: false,
          source: FEATURED_DRAFT_GATE_AUTO_LINK_SOURCE,
        });
      }
    } else {
      const targetGateId = resolveCreateSbtTargetGateId(createSbtModalState.gateId);
      if (targetGateId) {
        const targetGate = getGateById(targetGateId);
        const nextSelections = dedupeSbtSelection([
          ...normalizeSbtSelection(targetGate?.sbts || []),
          pendingSelection,
        ]);
        updateEncryptionGate(targetGateId, { sbts: nextSelections });
      }
    }

    notify.success(`Prepared ${nextDraft.displayName} for deploy.`);
    closeCreateSbtModal();
  };

  useEffect(() => {
    const previousContextSignature = pendingSbtDeployContextRef.current;
    pendingSbtDeployContextRef.current = pendingSbtDeployContextSignature;
    const normalizedDrafts = normalizePendingSbtDrafts(pendingSbtDrafts);
    if (!previousContextSignature || previousContextSignature === pendingSbtDeployContextSignature) return;
    if (!normalizedDrafts.length) return;
    // Regression guard: pending SBT drafts are CREATE2-addressed against the
    // current chain/factory pair. Keeping them after that context changes can
    // mine a real deploy tx and only fail after the address mismatch check.
    clearPendingSbtDraftsRef.current?.(
      normalizedDrafts,
      'Pending SBT drafts were cleared because the session chain or SBT factory changed. Recreate them before publishing.'
    );
    pruneAllPendingSbtSelectionsRef.current?.();
  }, [pendingSbtDeployContextSignature, pendingSbtDrafts]);

  useEffect(() => {
    const livePendingAddressSet = new Set(
      normalizePendingSbtDrafts(pendingSbtDrafts)
        .map((entry) => toStr(entry?.predictedAddress).trim().toLowerCase())
        .filter(Boolean)
    );
    const hasDanglingPendingSelection = encryptionGates.some((gate) => (
      normalizeSbtSelection(gate?.sbts || []).some((sbt) => (
        sbt?.pending === true &&
        !livePendingAddressSet.has(toStr(sbt?.address).trim().toLowerCase())
      ))
    )) || normalizeSbtSelection(draft?.defaultFeaturedSBTs || []).some((entry) => (
      entry?.pending === true &&
      !livePendingAddressSet.has(toStr(entry?.address).trim().toLowerCase())
    ));
    if (!hasDanglingPendingSelection) return;
    // Keep gate selections aligned with the in-memory pending-draft list.
    // A `pending: true` entry without a live draft is always stale UI state.
    prunePendingSbtSelectionsRef.current?.(new Set(
      [
        ...encryptionGates.flatMap((gate) => normalizeSbtSelection(gate?.sbts || [])),
        ...normalizeSbtSelection(draft?.defaultFeaturedSBTs || []),
      ]
        .filter((entry) => entry?.pending === true)
        .map((entry) => toStr(entry?.address).trim().toLowerCase())
        .filter((addressLower) => addressLower && !livePendingAddressSet.has(addressLower))
    ));
  }, [draft?.defaultFeaturedSBTs, encryptionGates, pendingSbtDrafts]);

  useEffect(() => {
    const autoLink = normalizeFeaturedDraftGateAutoLink(featuredDraftGateAutoLink);
    if (!autoLink) return;
    const gateId = toStr(autoLink.gateId).trim() || FEATURED_DRAFT_GATE_AUTO_LINK_GATE_ID;
    const linkedAddressLower = autoLink.address.toLowerCase();
    const liveDraft = normalizePendingSbtDrafts(pendingSbtDrafts).find(
      (entry) => toStr(entry?.predictedAddress).trim().toLowerCase() === linkedAddressLower
    );
    if (!liveDraft) {
      clearFeaturedDraftGateAutoLinkRef.current?.(autoLink.address);
      return;
    }
    const targetGate = encryptionGates.find((gate) => toStr(gate?.id).trim() === gateId);
    if (!targetGate) {
      clearFeaturedDraftGateAutoLinkRef.current?.(autoLink.address);
      return;
    }
    const gateSelections = dedupeSbtSelection(targetGate?.sbts || []);
    const hasAutoLinkedSelection = gateSelections.some(
      (entry) => toStr(entry?.address).trim().toLowerCase() === linkedAddressLower
    );
    const hasOtherSelections = gateSelections.some(
      (entry) => toStr(entry?.address).trim().toLowerCase() !== linkedAddressLower
    );
    if (hasOtherSelections && autoLink.dismissed !== true) {
      dismissFeaturedDraftGateAutoLinkRef.current?.({ gateId, address: autoLink.address });
      return;
    }
    if (autoLink.dismissed || hasAutoLinkedSelection) return;
    const pendingSelection = buildPendingSbtSelection(liveDraft);
    if (!pendingSelection) {
      clearFeaturedDraftGateAutoLinkRef.current?.(autoLink.address);
      return;
    }
    // Keep the Step-1 featured-draft link resilient across refreshes, but stop
    // restoring it once the user has explicitly edited Gate A or the draft is gone.
    setEncryptionGates((prev) => prev.map((gate) => {
      if (toStr(gate?.id).trim() !== gateId) return gate;
      return {
        ...gate,
        sbts: dedupeSbtSelection([...normalizeSbtSelection(gate?.sbts || []), pendingSelection]),
      };
    }));
  }, [featuredDraftGateAutoLink, encryptionGates, pendingSbtDrafts]);

  const renderField = (key, value, path, opts = {}) => {
    const forceShow = !!opts.forceShow;
    const currentPath = [...path, key];
    if (shouldHideSessionWizardField({
      forceShow,
      key,
      path,
      currentPath,
      wizardMode,
    })) {
      return null;
    }
    const keyString = pathKey(currentPath);
    const isSlugField = keyString === 'slug';
    const isNormalMode = wizardMode !== 'advanced';
    const displayLabel = getSessionWizardFieldLabel(keyString, key);
    const isSecretPath = isSecretFieldPath(currentPath);
    const canLock = shouldLockable(value) && (!isSecretPath || !workerSecretsEnabled);
    if (!forceShow && isSecretPath && workerSecretsEnabled) return null;
    // Hide serialized defaultFilterState presets until a user-facing builder exists.
    const isDefaultFilterState = keyString === 'defaultFilterState';
    const isQuestionsPrompt = keyString === 'questionsGenPrompt';
    const isSessionHeaderField = keyString === 'sessionHeader';
    const isCorsWorkerField = keyString === 'corsWorkerUrl';
    const isNetworkChainField = keyString === 'networkChainId';
    const e2eTestId = (() => {
      if (keyString === 'sessionName') return E2E_TESTIDS.WIZARD_SESSION_NAME;
      if (keyString === 'sessionInfo') return E2E_TESTIDS.WIZARD_SESSION_INFO;
      if (keyString === 'slug') return E2E_TESTIDS.WIZARD_SLUG;
      if (keyString === 'corsWorkerUrl') return E2E_TESTIDS.WIZARD_WORKER_URL;
      return '';
    })();
    const gateIds = gateOptions.map((opt) => opt.id).filter(Boolean);
    const selectedGateIds = !isSlugField
      ? normalizeGateIds(encryptedFieldGates[keyString]).filter((id) => gateIds.includes(id))
      : [];
    const primaryGate = selectedGateIds.length === 1 ? getGateById(selectedGateIds[0]) : null;
    const locked = selectedGateIds.length > 0;
    const lockActive = isSlugField ? privateSlugMode : locked;
    const defaultLockLabel = isNormalMode ? '' : t('sbt');
    const lockBadgeLabel = isSlugField
      ? 'ID'
      : (selectedGateIds.length === 0
        ? defaultLockLabel
        : (selectedGateIds.length === 1
          ? (primaryGate?.label || selectedGateIds[0] || defaultLockLabel)
          : `${selectedGateIds.length} ${t('gatesLower')}`));
    const showLockBadge = !!lockBadgeLabel;
    const lockBadgeStyle = (!isSlugField && selectedGateIds.length === 1 && primaryGate)
      ? { borderColor: primaryGate.color, color: primaryGate.color }
      : undefined;
    const lockTitle = isSlugField
      ? (slugPinnedByPendingSbtDrafts
        ? `Queued ${t('sbt')} drafts pinned this session URL. Remove them before changing the slug.`
        : (privateSlugMode
          ? 'Private URL mode enabled (uses session ID). Click to restore manual URL.'
          : 'Use session ID as the URL (private mode). This does not encrypt the URL.'))
      : locked
        ? (selectedGateIds.length === 1
          ? `Locked with ${primaryGate?.label || selectedGateIds[0]}. Click to edit or unlock.`
          : `Locked with ${selectedGateIds.length} ${t('gatesLower')}. Click to edit or unlock.`)
        : `Click to lock with a ${t('gateLower')}.`;
    const lockIconStyle = (!isSlugField && selectedGateIds.length === 1 && primaryGate)
      ? { color: primaryGate.color }
      : undefined;
    const handleLockClick = () => {
      if (isSlugField) {
        if (slugPinnedByPendingSbtDrafts) return;
        togglePrivateSlugMode();
      }
    };
    const tooltipId = `gw-tip-${keyString.replace(/[^a-z0-9_-]/gi, '-')}`;
    const tooltipText = getSessionWizardFieldTooltip(currentPath, value);
    const chainName = /chainid$/i.test(keyString) ? getChainName(value) : '';
    const displayLabelText = chainName ? `${displayLabel} (${chainName})` : displayLabel;
    const fieldTooltipControl = renderSessionWizardInfoTooltip({
      id: tooltipId,
      content: tooltipText,
      placement: 'right',
      ariaLabel: `${displayLabelText} info`,
    });
    const slugValidationError = isSlugField ? getSessionSlugValidationError(value) : '';
    const fieldGateLockProps = !isSlugField ? {
      gateOptions,
      selectedGateIds,
      onChangeSelectedGateIds: (nextIds) => {
        const filtered = normalizeGateIds(nextIds).filter((id) => gateIds.includes(id));
        setEncryptedFieldGates((prev) => {
          const next = { ...(prev || {}) };
          if (!filtered.length) {
            delete next[keyString];
            return next;
          }
          next[keyString] = filtered.length === 1 ? filtered[0] : filtered;
          return next;
        });
        if (!filtered.length) setOpenLockKey('');
      },
      open: openLockKey === keyString,
      onToggleOpen: (nextOpen) => setOpenLockKey(nextOpen ? keyString : ''),
      disabled: !gateIds.length,
      showDots: true,
    } : null;
    const fieldFrameProps = {
      label: displayLabelText,
      tooltipText,
      tooltipId,
      tooltipPlacement: 'right',
      tooltipAriaLabel: `${displayLabelText} info`,
      tooltipsEnabled: sessionWizardTooltipsEnabled,
      canLock,
      isLocked: lockActive,
      onLockToggle: handleLockClick,
      lockTitle,
      lockBadgeLabel: showLockBadge ? lockBadgeLabel : '',
      lockBadgeStyle,
      lockIconStyle,
      gateLockProps: fieldGateLockProps,
    };

    const aiOrGateSelect = renderAiOrGateSelect({
      keyString,
      value,
      currentPath,
      displayLabelText,
      fieldTooltipControl,
      onUpdateDraftValue: updateDraftValue,
      draft,
      encryptionGates,
      defaultGateId,
      onSetDefaultGateId: setDefaultGateId,
    });
    if (aiOrGateSelect) return aiOrGateSelect;

    if (keyString === 'defaultFeaturedSBTs') {
      const selections = normalizeSbtSelection(value);
      const uniqueSelections = selections.filter((sbt, idx, arr) => {
        const addr = toStr(sbt.address).toLowerCase();
        return addr && arr.findIndex((other) => toStr(other.address).toLowerCase() === addr) === idx;
      });
      return (
        <FeaturedSbtField
          key={keyString}
          label={displayLabelText}
          tooltipControl={fieldTooltipControl}
          createButtonLabel={`Create ${t('sbt')}`}
          onCreateSbt={() => launchCreateSbtModal({ targetType: 'defaultFeaturedSBTs' })}
          selectedSBTs={uniqueSelections}
          onSelectionsChange={(next) => {
            updateDraftValue(['defaultFeaturedSBTs'], serializeDefaultFeaturedSbtSelections(next));
          }}
          onRemove={(address) => handleRemoveDefaultFeaturedSbt(address)}
          selectorLabel={`Choose ${t('sbts')} to feature by default`}
          network={network}
          additionalSBTOptions={pendingSbtSelectorOptions}
          chainId={selectorSourceChainId}
          sessionSlug={selectorSourceSessionConfig?.slug || resolvedActiveSessionSlug || ''}
          sessionConfig={selectorSourceSessionConfig}
          sbtCacheRevision={sbtCacheRevision}
          ensureLightSbtUniverse={ensureLightSbtUniverse}
        />
      );
    }

    if (path.length === 0 && key === 'contracts') {
      const contracts = value && typeof value === 'object' ? value : {};
      const defaults = getSessionWizardContractDefaults(registryChainId);
      const visibleKeys = getVisibleSessionWizardContractKeys(contracts, defaults);
      const isCollapsed = metadataObjectCollapsed.contracts;
      return (
        <SessionWizardContractsField
          key={keyString}
          title={displayLabel}
          contracts={contracts}
          defaults={defaults}
          visibleKeys={visibleKeys}
          isCollapsed={isCollapsed}
          onToggleCollapsed={() =>
            setMetadataObjectCollapsed((prev) => ({ ...prev, contracts: !prev.contracts }))
          }
          onAddressChange={(contractKey, address) =>
            updateDraftValue(['contracts', contractKey, 'address'], address)
          }
          onOpenContractViewer={openContractViewerModal}
          renderInfoTooltip={renderSessionWizardInfoTooltip}
        />
      );
    }

    if (path.length === 0 && key === 'faucet') {
      const faucet = value && typeof value === 'object' ? value : {};
      const isCollapsed = metadataObjectCollapsed.faucet;
      return (
        <CollapsibleFieldGroup
          key={keyString}
          title={displayLabel}
          isCollapsed={isCollapsed}
          toggleAriaLabel={`${displayLabel} ${isCollapsed ? 'expand' : 'collapse'}`}
          onToggleCollapsed={() =>
            setMetadataObjectCollapsed((prev) => ({ ...prev, faucet: !prev.faucet }))
          }
        >
          {!isCollapsed && Object.entries(faucet).map(([childKey, childValue]) =>
            renderField(childKey, childValue, currentPath)
          )}
        </CollapsibleFieldGroup>
      );
    }

    if (path.length === 0 && key === 'ai') {
      const ai = value && typeof value === 'object' ? value : {};
      const isCollapsed = metadataObjectCollapsed.ai;
      return (
        <CollapsibleFieldGroup
          key={keyString}
          title={displayLabel}
          isCollapsed={isCollapsed}
          toggleAriaLabel={`${displayLabel} ${isCollapsed ? 'expand' : 'collapse'}`}
          onToggleCollapsed={() =>
            setMetadataObjectCollapsed((prev) => ({ ...prev, ai: !prev.ai }))
          }
        >
          {!isCollapsed && Object.entries(ai).map(([childKey, childValue]) =>
            renderField(childKey, childValue, currentPath)
          )}
        </CollapsibleFieldGroup>
      );
    }

    if (path.length === 0 && key === 'lit') {
      if (wizardMode !== 'advanced') return null;
      const lit = value && typeof value === 'object' ? value : {};
      const isCollapsed = metadataObjectCollapsed.lit;
      return (
        <CollapsibleFieldGroup
          key={keyString}
          title={displayLabel}
          isCollapsed={isCollapsed}
          toggleAriaLabel={`${displayLabel} ${isCollapsed ? 'expand' : 'collapse'}`}
          onToggleCollapsed={() =>
            setMetadataObjectCollapsed((prev) => ({ ...prev, lit: !prev.lit }))
          }
        >
          {!isCollapsed && Object.entries(lit).map(([childKey, childValue]) =>
            renderField(childKey, childValue, currentPath)
          )}
        </CollapsibleFieldGroup>
      );
    }

    if (path.length === 0 && key === 'storageProfile') {
      if (wizardMode !== 'advanced') return null;
      const isCollapsed = metadataObjectCollapsed.storageProfile;
      return (
        <SessionWizardStorageProfileField
          key={keyString}
          title={displayLabel}
          value={value}
          isCollapsed={isCollapsed}
          onToggleCollapsed={() =>
            setMetadataObjectCollapsed((prev) => ({ ...prev, storageProfile: !prev.storageProfile }))
          }
          onStorageProfileChange={(nextProfile) => updateDraftValue(['storageProfile'], nextProfile)}
        />
      );
    }

    if (path.length === 0 && key === 'blockLimits') {
      return (
        <BlockLimitsField
          key={keyString}
          blockLimits={value}
          onStartChange={(raw) => {
            blockStartManualRef.current = true;
            updateDraftValue(['blockLimits', 'start'], raw === '' ? null : Number(raw));
          }}
          blockLimitDuration={blockLimitDuration}
          blockLimitUnit={blockLimitUnit}
          onDurationChange={setBlockLimitDuration}
          onUnitChange={setBlockLimitUnit}
          latestChainBlock={latestChainBlock}
          latestBlockStatus={latestBlockStatus}
          label={displayLabelText}
          tooltipControl={fieldTooltipControl}
        />
      );
    }

    if (Array.isArray(value)) {
      const isFlat = isStringArray(value);
      const display = isFlat ? value.join('\n') : JSON.stringify(value, null, 2);
      return (
        <LockableFieldFrame
          key={keyString}
          {...fieldFrameProps}
          fieldError={fieldErrors[keyString]}
        >
          <Input
            type="textarea"
            rows="4"
            value={display}
            onChange={(e) => updateArrayValue(currentPath, e.target.value, !isFlat)}
            className={styles.textarea}
          />
        </LockableFieldFrame>
      );
    }

    if (value && typeof value === 'object') {
      const childNodes = Object.entries(value)
        .map(([childKey, childValue]) => renderField(childKey, childValue, currentPath))
        .filter(Boolean);
      return (
        <div key={keyString} className={styles.objectGroup}>
          <div className={styles.objectHeader}>
            <div className={styles.objectTitle}>{displayLabel}</div>
          </div>
          <div className={styles.objectBody}>
            {childNodes.length ? childNodes : (
              <div className={styles.helperText}>
                {key === 'arweave' && workerSecretsEnabled
                  ? 'Arweave keys are stored in worker secrets.'
                  : 'No editable fields in this section yet.'}
              </div>
            )}
          </div>
        </div>
      );
    }

    const isBool = typeof value === 'boolean';
    const isNumber = typeof value === 'number';
    if (isBool) {
      const checkboxClass = keyString === 'autoFeatureSBTsBySessionSlug' ? styles.checkboxOffset : '';
      return (
        <LockableFieldFrame
          key={keyString}
          {...fieldFrameProps}
          labelInlineControl={(
            <Input
              type="checkbox"
              checked={!!value}
              onChange={(e) => updateDraftValue(currentPath, !!e.target.checked)}
              disabled={isDefaultFilterState || isNetworkChainField}
              className={`${styles.inlineCheckbox} ${checkboxClass}`}
            />
          )}
        />
      );
    }
    if (isSessionHeaderField) {
      if (isNormalMode) {
        return (
          <LockableFieldFrame
            key={keyString}
            {...fieldFrameProps}
            label="Image"
            labelPrefix={<FontAwesomeIcon icon={faImage} className={styles.compactSessionHeaderIcon} />}
          >
            <SessionHeaderField
              compact
              value={draft?.sessionHeader}
              sessionHeaderMode={sessionHeaderMode}
              compactSessionHeaderMode={compactSessionHeaderMode}
              sessionHeaderPreviewSrc={sessionHeaderPreviewSrc}
              sessionHeaderUploadStatus={sessionHeaderUploadStatus}
              sessionHeaderUploadStatusTone={sessionHeaderUploadStatusTone}
              compactSessionHeaderInputRef={compactSessionHeaderInputRef}
              onCompactUrlChange={(event) => {
                updateDraftValue(['sessionHeader'], event.target.value);
                setSessionHeaderStatus('');
              }}
              onToggleCompactUrlMode={() => {
                setCompactSessionHeaderMode((prev) => (prev === 'url' ? 'idle' : 'url'));
                setSessionHeaderMode('url');
                setSessionHeaderFile(null);
                setSessionHeaderStatus('');
              }}
              onPaste={handlePasteSessionHeaderFromClipboard}
              onCompactUploadClick={() => {
                setCompactSessionHeaderMode('idle');
                setSessionHeaderMode('upload');
                setSessionHeaderStatus('');
                if (compactSessionHeaderInputRef.current) {
                  compactSessionHeaderInputRef.current.click();
                }
              }}
              onCompactFileChange={(event) => {
                setSessionHeaderMode('upload');
                setSessionHeaderFile(event.target.files?.[0] || null);
                setSessionHeaderStatus('');
              }}
              onClear={handleClearSessionHeaderPreview}
            />
          </LockableFieldFrame>
        );
      }
      return (
        <LockableFieldFrame key={keyString} {...fieldFrameProps}>
          <SessionHeaderField
            value={value}
            sessionHeaderMode={sessionHeaderMode}
            compactSessionHeaderMode={compactSessionHeaderMode}
            sessionHeaderPreviewSrc={sessionHeaderPreviewSrc}
            sessionHeaderUploadStatus={sessionHeaderUploadStatus}
            sessionHeaderUploadStatusTone={sessionHeaderUploadStatusTone}
            onUrlChange={(e) => updateDraftValue(currentPath, e.target.value)}
            onUseUrlMode={() => {
              setSessionHeaderMode('url');
              setSessionHeaderFile(null);
              setSessionHeaderStatus('');
            }}
            onUseUploadMode={() => {
              setSessionHeaderMode('upload');
              setSessionHeaderStatus('');
            }}
            onAdvancedFileChange={(e) => setSessionHeaderFile(e.target.files?.[0] || null)}
            onClear={handleClearSessionHeaderPreview}
            onExpandPreview={() => setSessionHeaderPreviewModalOpen(true)}
          />
        </LockableFieldFrame>
      );
    }

    if (isQuestionsPrompt) {
      const promptPreview = seedGenPrompt.replace('<GroupCustomInstructions>', toStr(value || ''));
      return (
        <FormGroup key={keyString} className={styles.fieldGroup}>
          <div className={styles.fieldHeader}>
            <div className={styles.fieldLabelRow}>
              <Label>{displayLabelText}</Label>
              {fieldTooltipControl}
            </div>
            <Button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setShowPromptPreview((prev) => !prev)}
            >
              Preview prompt <FontAwesomeIcon icon={showPromptPreview ? faCaretUp : faCaretDown} style={{ marginLeft: 6 }} />
            </Button>
          </div>
          <Input
            type="textarea"
            rows="4"
            value={value == null ? '' : value}
            onChange={(e) => updateDraftValue(currentPath, e.target.value)}
            className={styles.textarea}
          />
          {showPromptPreview && (
            <div className={styles.promptPreview}>
              <pre className={styles.promptPreviewText}>{promptPreview}</pre>
            </div>
          )}
        </FormGroup>
      );
    }
    return (
      <LockableFieldFrame
        key={keyString}
        {...fieldFrameProps}
        lockTrailingContent={isSlugField ? (
          <>
            {!privateSlugMode && slugAvailability.status === 'checking' && (
              <FontAwesomeIcon icon={faSpinner} spin style={{ marginLeft: 6, opacity: 0.5, fontSize: 12 }} title="Checking availability…" />
            )}
            {!privateSlugMode && slugAvailability.status === 'available' && (
              <FontAwesomeIcon icon={faCheck} style={{ marginLeft: 6, color: '#4dffa4', fontSize: 12 }} title="Slug available" data-testid={E2E_TESTIDS.WIZARD_SLUG_AVAILABLE} />
            )}
            {!privateSlugMode && slugAvailability.status === 'taken' && (
              <FontAwesomeIcon icon={faExclamationCircle} style={{ marginLeft: 6, color: '#ffcc7b', fontSize: 12 }} title="Slug already taken" data-testid={E2E_TESTIDS.WIZARD_SLUG_TAKEN} />
            )}
          </>
        ) : null}
        fieldError={slugValidationError}
      >
        <Input
          type={isNumber ? 'number' : 'text'}
          value={value == null ? '' : value}
          disabled={
            isDefaultFilterState ||
            isNetworkChainField ||
            (isSlugField && (privateSlugMode || slugPinnedByPendingSbtDrafts))
          }
          data-testid={e2eTestId || undefined}
          onChange={(e) => {
            const raw = e.target.value;
            if (isCorsWorkerField) setWorkerUrlAutoFilled(false);
            updateDraftValue(currentPath, isNumber ? Number(raw) : raw);
          }}
        />
        {isSlugField && slugPinnedByPendingSbtDrafts && (
          <div className={styles.helperText}>
            {`Queued ${t('sbt')} drafts pinned this slug so their uploaded metadata stays aligned with the final session URL.`}
          </div>
        )}
      </LockableFieldFrame>
    );
  };

  const applyEncryption = async (metadata) => {
    const encryptedKeys = Object.keys(encryptedFieldGates || {}).filter((key) => key !== 'slug');
    // Testing mode: we do not remap legacy cached gate keys.
    // Only canonical `session*` field paths are encrypted from this point forward.
    const onChainFields = {};
    // Reset any stale encryption artifacts from cached drafts before rebuilding.
    delete metadata.encryptedFields;
    delete metadata.encryptedFieldGates;
    delete metadata.encryption;
    delete metadata.sessionInfoEncrypted;
    if (!encryptedKeys.length) {
      ONCHAIN_FIELD_KEYS.forEach((fieldKey) => {
        const path = ONCHAIN_FIELD_PATHS[fieldKey] || fieldKey.split('.');
        const value = getValueAtPath(metadata, path);
        if (value != null && value !== '') {
          onChainFields[fieldKey] = value;
        }
      });
      return { metadata, onChainFields };
    }

    const chainId = Number(metadata.networkChainId || registryChainId || network?.id || 0) || null;
    const litChain = resolveLitChain({ chainId });

    const encryptedFields = {};
    const encryptedFieldGatesOut = {};
    const encryptionQueue = [];
    for (const key of encryptedKeys) {
      const selectedGateIds = normalizeGateIds(encryptedFieldGates[key] ?? encryptedFieldGates?.[key])
        .map((id) => toStr(id).trim())
        .filter(Boolean);
      if (!selectedGateIds.length) continue;
      const path = key.split('.');
      const value = getValueAtPath(metadata, path);
      if (value == null || value === '') continue;

      const recipients = [];
      const appliedGateIds = [];

      for (const gateId of selectedGateIds) {
        const gate = getGateById(gateId);
        if (!gate) continue;
        const sbtAddresses = normalizeSbtSelection(gate.sbts || [])
          .map((s) => s.address)
          .filter(Boolean);
        if (!sbtAddresses.length) {
          if (typeof console !== 'undefined') {
            log.warn('[lit][encrypt] skipping gate without SBTs', { key, gateId });
          }
          continue;
        }
        const accessControlConditions = buildSbtAccessControlConditions({
          sbtAddresses,
          chainId,
          litChain,
          mode: gate.mode,
        });
        if (!accessControlConditions) continue;
        recipients.push({ accessControlConditions, chain: litChain });
        appliedGateIds.push(gateId);
      }

      if (!recipients.length) continue;

      encryptionQueue.push({
        key,
        gateIds: appliedGateIds,
        path,
        value,
        recipients,
      });
    }

    if (!encryptionQueue.length) {
      ONCHAIN_FIELD_KEYS.forEach((fieldKey) => {
        const path = ONCHAIN_FIELD_PATHS[fieldKey] || fieldKey.split('.');
        const value = getValueAtPath(metadata, path);
        if (value != null && value !== '') {
          onChainFields[fieldKey] = value;
        }
      });
      metadata.encryptedFields = encryptedFields;
      metadata.encryptedFieldGates = encryptedFieldGatesOut;
      return { metadata, onChainFields };
    }

    if (!account) {
      if (toggleLoginModal) toggleLoginModal(true);
      throw new Error('Connect a wallet to encrypt fields.');
    }
    const hooks = getGlobalLitHooks();
    if (!hooks || typeof hooks.saveKey !== 'function') {
      throw new Error('Lit hooks not initialized.');
    }

    if (typeof console !== 'undefined') {
      const litNetwork = hooks?.litNetwork || null;
      log.info('[lit][encrypt] start', {
        fields: encryptionQueue.length,
        chainId,
        litChain,
        litNetwork,
      });
    }

    for (const entry of encryptionQueue) {
      const { key, gateIds, path, value, recipients } = entry;
      let envelope;
      try {
        if (typeof console !== 'undefined') {
          log.info('[lit][encrypt] field start', {
            key,
            gateIds,
            chainId,
            litChain,
            litNetwork: hooks?.litNetwork || null,
            recipientCount: Array.isArray(recipients) ? recipients.length : 0,
          });
        }
        envelope = await cryptoUtils.encryptEnvelopeValue(value, {
          providerLike: provider,
          account,
          chainId,
          contextLabel: `group:${metadata.slug || 'group'}:${key}`,
          lit: {
            saveKey: hooks.saveKey,
            accessControlConditions: recipients?.[0]?.accessControlConditions,
            chain: recipients?.[0]?.chain || litChain,
            recipients,
          },
        });
      } catch (err) {
        if (typeof console !== 'undefined') {
          log.error('[lit][encrypt] field failed', {
            key,
            gateIds,
            chainId,
            litChain,
            litNetwork: hooks?.litNetwork || null,
            message: err?.message || err,
          });
        }
        throw err;
      }

      const onChainFieldKey = getOnChainFieldKeyForPath(path);
      const skipEncryptedFields = (path.length === 1 && path[0] === 'sessionInfo');
      if (path.length >= 4 && path[0] === 'ai' && path[1] === 'providers' && path[path.length - 1] === 'apiKey') {
        const providerKey = path[2];
        const encryptedPath = ['ai', 'providers', providerKey, 'encryptedApiKey'];
        setValueAtPath(metadata, encryptedPath, envelope);
        setValueAtPath(metadata, path, '');
      } else if (path.length >= 4 && path[0] === 'rpc' && path[1] === 'providers' && path[path.length - 1] === 'apiKey') {
        const providerKey = path[2];
        const encryptedPath = ['rpc', 'providers', providerKey, 'encryptedApiKey'];
        setValueAtPath(metadata, encryptedPath, envelope);
        setValueAtPath(metadata, path, '');
      } else if (path.length === 1 && path[0] === 'sessionInfo') {
        metadata.sessionInfoEncrypted = envelope;
        setValueAtPath(metadata, path, '');
      } else if (path.length === 2 && path[0] === 'arweave' && path[1] === 'jwk') {
        const encryptedPath = ['arweave', 'encryptedJwk'];
        setValueAtPath(metadata, encryptedPath, envelope);
        setValueAtPath(metadata, path, '');
      } else if (path.length === 2 && path[0] === 'faucet' && path[1] === 'privateKey') {
        const encryptedPath = ['faucet', 'encryptedPrivateKey'];
        setValueAtPath(metadata, encryptedPath, envelope);
        setValueAtPath(metadata, path, '');
      } else {
        setValueAtPath(metadata, path, '');
      }
      if (onChainFieldKey) {
        onChainFields[onChainFieldKey] = envelope;
      } else if (!skipEncryptedFields) {
        encryptedFields[key] = envelope;
      }
      const cleanGateIds = Array.isArray(gateIds)
        ? gateIds.map((id) => toStr(id).trim()).filter(Boolean)
        : [];
      if (cleanGateIds.length === 1) {
        encryptedFieldGatesOut[key] = cleanGateIds[0];
      } else if (cleanGateIds.length > 1) {
        encryptedFieldGatesOut[key] = cleanGateIds;
      }
    }

    ONCHAIN_FIELD_KEYS.forEach((fieldKey) => {
      if (Object.prototype.hasOwnProperty.call(onChainFields, fieldKey)) return;
      const path = ONCHAIN_FIELD_PATHS[fieldKey] || fieldKey.split('.');
      const value = getValueAtPath(metadata, path);
      if (value != null && value !== '') {
        onChainFields[fieldKey] = value;
      }
    });

    metadata.encryptedFields = encryptedFields;
    metadata.encryptedFieldGates = encryptedFieldGatesOut;
    const gatesById = allEncryptionGates.reduce((acc, gate) => {
      const sbtAddresses = normalizeSbtSelection(gate.sbts || [])
        .map((s) => s.address)
        .filter(Boolean);
      acc[gate.id] = {
        type: 'sbt',
        sbtAddresses,
        mode: gate.mode,
        chainId,
        litChain,
        color: gate.color,
        label: gate.label,
      };
      return acc;
    }, {});
    const gateIds = allEncryptionGates.map((gate) => gate.id);
    const gateCounts = {};
    Object.values(encryptedFieldGatesOut || {}).forEach((value) => {
      if (!value) return;
      const ids = Array.isArray(value) ? value : [value];
      ids.forEach((id) => {
        const gateId = toStr(id).trim();
        if (!gateId) return;
        gateCounts[gateId] = (gateCounts[gateId] || 0) + 1;
      });
    });
    let primaryGateId = gateIds[0] || null;
    if (primaryGateId) {
      gateIds.forEach((id) => {
        if ((gateCounts[id] || 0) > (gateCounts[primaryGateId] || 0)) {
          primaryGateId = id;
        }
      });
    }
    metadata.encryption = { gates: gatesById };
    if (primaryGateId && gatesById[primaryGateId]) {
      metadata.encryption.gate = gatesById[primaryGateId];
    }

    return { metadata, encryptedFields, onChainFields };
  };

  const stripSecretFieldsFromMetadata = (metadata) => {
    if (!metadata || typeof metadata !== 'object') return;
    if (metadata.ai && typeof metadata.ai === 'object') {
      delete metadata.ai.providers;
      delete metadata.ai.mode;
      delete metadata.ai.provider;
    }
    if (metadata.rpc && typeof metadata.rpc === 'object') {
      delete metadata.rpc;
    }
    if (metadata.arweave && typeof metadata.arweave === 'object') {
      delete metadata.arweave;
    }
    if (metadata.faucet && typeof metadata.faucet === 'object') {
      delete metadata.faucet.privateKey;
      delete metadata.faucet.encryptedPrivateKey;
    }
    if (metadata.encryptedFields && typeof metadata.encryptedFields === 'object') {
      Object.keys(metadata.encryptedFields).forEach((key) => {
        if (isSecretFieldPath(key.split('.'))) {
          delete metadata.encryptedFields[key];
        }
      });
    }
    if (metadata.encryptedFieldGates && typeof metadata.encryptedFieldGates === 'object') {
      Object.keys(metadata.encryptedFieldGates).forEach((key) => {
        if (isSecretFieldPath(key.split('.'))) {
          delete metadata.encryptedFieldGates[key];
        }
      });
    }
  };

  const buildMetadataPayload = async ({ workerUrlOverride = '', signerAccountOverride = '' } = {}) => {
    const metadata = normalizeSessionNaming(normalizeLitMetadataNetwork(deepClone(draft)));
    const authAccount = toStr(signerAccountOverride || resolvedWalletAccountRef.current || account).trim();
    metadata.sessionName = toStr(metadata.sessionName || '').trim();
    metadata.sessionInfo = toStr(metadata.sessionInfo || '').trim();
    if (!metadata.sessionName) delete metadata.sessionName;
    if (!metadata.sessionInfo) delete metadata.sessionInfo;
    metadata.slug = normalizeSlug(metadata.slug);
    const resolvedAutoFeature = resolveSessionWizardAutoFeatureBySessionSlug(metadata);
    delete metadata.autoFeatureSBTsWithFeaturedSbtTags;
    if (resolvedAutoFeature !== undefined) {
      metadata.autoFeatureSBTsBySessionSlug = resolvedAutoFeature;
    }
    const formattedSessionId = sessionRegistryUtils.formatSessionId(sessionId);
    const sessionIdHex = sessionRegistryUtils.normalizeSessionIdHex(sessionId);
    metadata.sessionId = formattedSessionId || toStr(sessionId).trim() || '';
    if (sessionIdHex) {
      metadata.sessionIdHex = sessionIdHex;
    } else {
      delete metadata.sessionIdHex;
    }
    delete metadata.sponsoredSbtAddress;
    if (metadata.defaultFeaturedSBTs != null) {
      if (Array.isArray(metadata.defaultFeaturedSBTs)) {
        metadata.defaultFeaturedSBTs = metadata.defaultFeaturedSBTs
          .map((entry) => (typeof entry === 'string' ? entry : entry?.address || entry?.sbtAddress))
          .map((entry) => toStr(entry).trim())
          .filter(Boolean);
      } else if (typeof metadata.defaultFeaturedSBTs === 'string') {
        metadata.defaultFeaturedSBTs = metadata.defaultFeaturedSBTs
          .split(/[\n,]+/)
          .map((entry) => entry.trim())
          .filter(Boolean);
      } else {
        metadata.defaultFeaturedSBTs = [];
      }
      const seen = new Set();
      metadata.defaultFeaturedSBTs = metadata.defaultFeaturedSBTs.filter((entry) => {
        const lower = entry.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });
    }
    if (sessionHeaderMode === 'upload') {
      if (sessionHeaderFile) {
        setSessionHeaderStatus('Uploading header image…', 'loading');
        const format = resolveSessionHeaderImageFormat(sessionHeaderFile);
        if (!format) {
          throw new Error('Unsupported header image format. Use png, jpg, jpeg, or gif.');
        }
        let arweaveJwk = toStr(getCurrentWorkerSecrets().arweaveJwk).trim();
        if (!arweaveJwk && !workerSecretsEnabled) {
          const resolved = await getEffectiveArweaveKey({
            sessionConfig: metadata,
            sessionSlug: metadata.slug || '',
            context: { account: authAccount, providerLike: provider, chainId: metadata.networkChainId || registryChainId },
          });
          arweaveJwk = resolved?.arweaveJwk || '';
        }
        const headerRequestId = `arw_header_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const baseUrl = normalizeWorkerAuthUrl(toStr(workerUrlOverride).trim()) || resolveWorkerBaseUrl();
        const uploadAuthOptions = await buildSessionWizardPublishArweaveUploadOptions({
          arweaveJwk,
          workerUrl: baseUrl,
          sessionSlug: metadata.slug,
          authAccount,
        });
        log.info('[arweave][ui] header upload start', {
          requestId: headerRequestId,
          workerUrl: uploadAuthOptions.forceDirectArweaveUpload ? null : uploadAuthOptions.workerUrl || null,
          sessionSlug: metadata.slug || '',
          adminAddress: null,
          hasJwk: !!uploadAuthOptions.arweaveJwk,
          ts: new Date().toISOString(),
        });
        let headerTxId;
        try {
          headerTxId = await arweaveScripts.uploadDataToArweave(sessionHeaderFile, format, {
            sessionConfig: metadata,
            sessionSlug: metadata.slug || '',
            context: { account: authAccount, providerLike: provider, chainId: metadata.networkChainId || registryChainId },
            requestId: headerRequestId,
            ...uploadAuthOptions,
          });
        } catch (err) {
          log.error('[arweave][ui] header upload error', {
            requestId: headerRequestId,
            message: err?.message || err,
            ts: new Date().toISOString(),
          });
          throw err;
        }
        log.info('[arweave][ui] header upload success', {
          requestId: headerRequestId,
          txId: headerTxId,
          ts: new Date().toISOString(),
        });
        metadata.sessionHeader = `ar://${headerTxId}`;
        setSessionHeaderStatus('Header image uploaded.');
      } else {
        metadata.sessionHeader = '';
      }
    } else {
      setSessionHeaderStatus('');
    }
    const normalizedBlockLimits = normalizeBlockLimitsForConfig(metadata.blockLimits, latestChainBlock);
    if (normalizedBlockLimits) {
      metadata.blockLimits = normalizedBlockLimits;
    }
    stripSecretFieldsFromMetadata(metadata);
    // Keep selected Lit gate id for encryption UX, but do not write auth gate authority to metadata.
    if (metadata.lit && typeof metadata.lit === 'object') {
      metadata.lit.defaultGateId = defaultGateId || metadata.lit.defaultGateId;
    }
    // Keep per-member budget fields hidden until semantics and enforcement are implemented.
    metadata.perMemberSpendLimits = {
      ...(metadata.perMemberSpendLimits || {}),
      ai: gateSelections.ai?.perMemberLimit || metadata.perMemberSpendLimits?.ai || '',
      arweave: gateSelections.arweave?.perMemberLimit || metadata.perMemberSpendLimits?.arweave || '',
      txGas: gateSelections.txGas?.perMemberLimit || metadata.perMemberSpendLimits?.txGas || '',
    };
    const result = await applyEncryption(metadata);
    result.metadata = sanitizeSessionWizardMetadataPayload(result.metadata, {
      fieldOrder: METADATA_FIELD_ORDER,
      sanitizeContracts: sanitizeSessionWizardContracts,
      normalizeAiProvider,
      normalizeAiModels,
      normalizeAiModelForProvider,
      defaultAiModels: DEFAULT_AI_MODELS,
    });
    const sponsoredFields = buildSponsoredFlagFields();
    result.onChainFields = buildSessionWizardRegistrySessionFields({
      onChainFields: result.onChainFields,
      sponsoredFields,
    });
    return { ...result };
  };

  const handleUploadMetadata = async ({ workerUrlOverride = '', signerAccountOverride = '' } = {}) => {
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
          sessionConfig: draft,
          sessionSlug: draft.slug || '',
          context: { account: authAccount, providerLike: provider, chainId: draft.networkChainId || registryChainId },
        });
        arweaveJwk = resolved?.arweaveJwk || '';
      }
      uploadRequestId = `arw_meta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const baseUrl = normalizeWorkerAuthUrl(toStr(workerUrlOverride).trim()) || resolveWorkerBaseUrl();
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
      const txId = await arweaveScripts.uploadDataToArweave(metadata, 'json', {
        sessionConfig: draft,
        sessionSlug: draft.slug || '',
        context: { account: authAccount, providerLike: provider, chainId: draft.networkChainId || registryChainId },
        requestId: uploadRequestId,
        ...uploadAuthOptions,
      });
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
        message: err?.message || err,
        ts: new Date().toISOString(),
      });
      const errorMessage = err?.message || 'Failed to upload metadata.';
      setStatus(errorMessage);
      throw err instanceof Error ? err : new Error(errorMessage);
    }
  };

  const buildDeferredCreateSbtComponentProps = ({
    sessionSlugOverride = '',
    workerUrlOverride = '',
    accountOverride = '',
  } = {}) => buildSessionWizardDeferredCreateSbtComponentProps({
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
    normalizeWorkerAuthUrl,
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
      contracts: (draft && typeof draft.contracts === 'object') ? draft.contracts : {},
    };
    const deployContextSignature = buildPendingSbtDeployContextSignature(
      sessionConfigForDeploy,
      registryChainId || network?.id || network?.chainId || null
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
          null
        )
      ).trim();
      return !!storedSignature && storedSignature !== deployContextSignature;
    });
    if (incompatibleDraft) {
      throw new Error(
        'Pending SBT drafts were created for a different session chain or SBT factory. Recreate them before publishing.'
      );
    }

    const deployedDrafts = [];
    for (let index = 0; index < draftsToDeploy.length; index += 1) {
      const sbtDraft = draftsToDeploy[index];
      const needsMetadataFinalization = !toStr(sbtDraft.tokenURI).trim();
      setStatus(
        needsMetadataFinalization
          ? `Finalizing ${t('sbt')} ${index + 1}/${draftsToDeploy.length}: ${sbtDraft.displayName}…`
          : `Deploying ${t('sbt')} ${index + 1}/${draftsToDeploy.length}: ${sbtDraft.displayName}…`
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
        setPendingSbtDrafts((prev) => prev.map((entry) => (
          toStr(entry?.predictedAddress).trim().toLowerCase() === toStr(finalizedDraft.predictedAddress).trim().toLowerCase()
            ? {
                ...entry,
                tokenURI: finalizedDraft.tokenURI,
                metadataUploadStatus: finalizedDraft.metadataUploadStatus || 'ready',
                metadataPreview: finalizedDraft.metadataPreview || entry?.metadataPreview || null,
                authoringPayload: finalizedDraft.authoringPayload || entry?.authoringPayload,
              }
            : entry
        )));
      }

      const sbtAddress = resolveSbtAddressFromFactoryReceipt(receipt);
      if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) {
        throw new Error(`Failed to resolve deployed address for ${finalizedDraft.displayName}.`);
      }
      if (toStr(finalizedDraft.predictedAddress).trim().toLowerCase() !== sbtAddress.toLowerCase()) {
        throw new Error(
          `Deterministic deploy mismatch for ${finalizedDraft.displayName}: expected ${finalizedDraft.predictedAddress}, received ${sbtAddress}.`
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

      setPendingSbtDrafts((prev) => prev.map((entry) => (
        toStr(entry?.predictedAddress).trim().toLowerCase() === sbtAddress.toLowerCase()
          ? { ...entry, ...deployedDraft }
          : entry
      )));
    }

    return deployedDrafts;
  };

  const handleRegisterGroup = async ({ metadataUriOverride, sessionFieldsOverride } = {}) => {
    try {
      const rawSlug = toStr(draft.slug).trim();
      // Empty slug maps to the on-chain "general" session; metadata keeps ''.
      const registrySlug = sessionRegistryUtils.toRegistrySlug(rawSlug);
      const sessionIdHexValue = sessionRegistryUtils.normalizeSessionIdHex(sessionId);
      if (!sessionIdHexValue) throw new Error('Session ID (UUID) is required.');
      if (!registryAddress) throw new Error('Registry address is not configured for this chain.');
      const effectiveMetadataUrl =
        normalizeArweaveUri(metadataUriOverride) ||
        normalizeArweaveUri(manualMetadataUrl) ||
        metadataUrl;
      if (!effectiveMetadataUrl) throw new Error('Upload metadata or provide a manual Arweave URI.');
      const registryChainIdValue = Number(registryChainId || draft.networkChainId || 0);
      try {
        const registryRead = sessionRegistryUtils.getRegistryContract(registryChainIdValue);
        if (registryRead) {
          if (typeof registryRead.sessionExists === 'function') {
            const slugExists = await registryRead.sessionExists(registrySlug);
            if (slugExists) {
              throw new Error(`Session slug already exists on-chain: ${registrySlug}`);
            }
          }
          if (typeof registryRead.sessionIdExists === 'function') {
            const idExists = await registryRead.sessionIdExists(sessionIdHexValue);
            if (idExists) {
              throw new Error('Session ID already exists on-chain. Generate a new session ID.');
            }
          }
        }
      } catch (err) {
        if (err?.message) throw err;
      }

      const gateSelectionsSnapshot = buildGateSelectionsSnapshot();
      const effectiveSessionFields = sessionFieldsOverride !== undefined
        ? (sessionFieldsOverride || {})
        : pendingOnChainFields;
      await runSessionWizardRegisterStepController({
        input: {
          registerArgs: {
            providerLike: provider,
            chainId: registryChainIdValue,
            registryAddress,
            slug: registrySlug,
            sessionId: sessionIdHexValue,
            sessionChainId: Number(draft.networkChainId || 0),
            metadataURI: effectiveMetadataUrl,
            encryptedMetadataURI: '',
            gateSelections: gateSelectionsSnapshot,
            sessionFields: effectiveSessionFields,
            gasLimitOverride: manualGasLimit,
            gasPriceGwei: manualGasPriceGwei,
            maxFeePerGasGwei: manualMaxFeePerGasGwei,
            maxPriorityFeePerGasGwei: manualMaxPriorityFeePerGasGwei,
          },
        },
        ports: {
          registerSessionOnChain,
        },
        callbacks: {
          setRegisterTxs,
          setStatus,
        },
      });
      const formattedSessionId = sessionRegistryUtils.formatSessionId(sessionIdHexValue) || sessionIdHexValue;
      setSessionUrl(buildSessionUrl({ slug: registrySlug }));
      const adminLink = buildAdminUrl({
        sessionId: formattedSessionId,
        chainId: registryChainIdValue,
      });
      setAdminUrl(adminLink);
      setAdminUrlStatus('');
      clearSessionWizardCache();
      const nextSessionId = generateSessionId();
      setSessionId(nextSessionId);
      setSessionIdStatus('Generated a new session ID for your next session.');
      try {
        const refreshed = await sessionRegistryUtils.fetchSessionFromRegistry({
          chainId: Number(registryChainId || draft.networkChainId || 0),
          slug: registrySlug,
          providerLike: provider,
          account,
          lit: getGlobalLitHooks(),
        });
        if (refreshed) {
          sessionRegistryUtils.upsertSessionRegistryCache({ config: refreshed });
        }
      } catch (e) { log.warn('SessionWizard: fallback', e); }
    } catch (err) {
      const txHash = err?.transactionHash || err?.transaction?.hash || '';
      if (txHash) {
        setRegisterTxs((prev) => {
          if (prev.some((entry) => entry.hash === txHash)) return prev;
          return [...prev, { action: 'createSession', hash: txHash }];
        });
      }
      const errorMessage = err?.message || 'Failed to register session.';
      setStatus(errorMessage);
      throw err instanceof Error ? err : new Error(errorMessage);
    }
  };

  const handlePublish = async () => {
    if (publishBusy) return;
    setPublishStep(0);
    setSessionUrl('');
    setPublishedPendingSbtLinks([]);
    const slugValidationError = getSessionSlugValidationError(draft?.slug);
    if (slugValidationError) {
      setStatus(slugValidationError);
      return;
    }
    if (loginComplete !== true) {
      if (typeof toggleLoginModal === 'function') toggleLoginModal(true);
      setStatus(
        loginInProgress
          ? 'Finish logging in before publishing this session.'
          : 'Connect your wallet to publish this session.'
      );
      return;
    }
    const resolvedPublisher = await resolveConnectedAdminAddress();
    if (!resolvedPublisher) {
      if (typeof toggleLoginModal === 'function') toggleLoginModal(true);
      setStatus('Connect your wallet to publish this session.');
      return;
    }
    setPublishBusy(true);
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
      });
      const { publishExecutionPlan } = publishRequestDescriptor;
      const publishStepNumbers = publishExecutionPlan.stepNumbers;
      let uploadResult = null;
      let workerUrlOverride = '';
      let deployedPendingDrafts = [];
      const publishControllerResult = await runSessionWizardPublishController({
        input: {
          publishExecutionPlan,
          signerAccountOverride: resolvedPublisher,
        },
        ports: {
          deployWorker: () => handleDeployWorker({ forceSponsoredAutoDeploy: true }),
          deployPendingSbts: ({ workerUrlOverride: pendingWorkerUrlOverride, signerAccountOverride }) => (
            deployPendingSbtDrafts({
              workerUrlOverride: pendingWorkerUrlOverride,
              signerAccountOverride,
            })
          ),
        },
        callbacks: {
          setPublishStep,
        },
      });
      workerUrlOverride = publishControllerResult.workerUrlOverride;
      deployedPendingDrafts = publishControllerResult.deployedPendingDrafts;
      const metadataUploadRequest = resolveSessionWizardPublishMetadataUploadRequest({
        publishExecutionPlan,
        workerUrlOverride,
        signerAccountOverride: resolvedPublisher,
      });
      const metadataUploadControllerResult = await runSessionWizardPublishMetadataUploadController({
        request: metadataUploadRequest,
        ports: {
          uploadMetadata: (args) => handleUploadMetadata(args),
        },
        callbacks: {
          setPublishStep,
        },
      });
      uploadResult = metadataUploadControllerResult.uploadResult;
      setPublishStep(publishStepNumbers['register-session']);
      await handleRegisterGroup({
        metadataUriOverride: uploadResult?.metadataUri,
        sessionFieldsOverride: uploadResult?.onChainFields,
      });
      runSessionWizardPublishCompletionController({
        input: {
          publishExecutionPlan,
          deployedPendingDrafts,
          pendingDraftSnapshot: publishRequestDescriptor.pendingDraftSnapshot,
          sessionSlug: draft?.slug,
        },
        ports: {
          normalizePendingDrafts: normalizePendingSbtDrafts,
          buildPublishedPendingSbtLinks,
        },
        callbacks: {
          promoteDeployedPendingSbtSelections,
          setPublishedPendingSbtLinks,
          clearPendingSbtDrafts: () => setPendingSbtDrafts([]),
          setPublishStep,
        },
      });
    } catch (err) {
      setStatus(err?.message || 'Publish failed.');
      setPublishStep(0);
    } finally {
      setPublishBusy(false);
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

  const sessionIdDisplay = sessionRegistryUtils.formatSessionId(sessionId) || toStr(sessionId).trim();

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
    navigator.clipboard.writeText(JSON.stringify(draft, null, 2)).then(() => {
      notify.success('Copied to clipboard');
      setJsonCopied(true);
      scheduleJsonCopiedReset();
    }).catch((e) => { void e; notify.warn('Copy failed'); });
  };

  const resolveWorkerBaseUrl = () => resolveSessionWizardWorkerBaseUrlFromDraft({
    draft,
    wizardMode,
    deployComplete,
    deployWorkerUrl,
    workerMode,
    allowNormalModeSharedHostedWorker: NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED,
  });

  const resolveWorkerRpcUrl = () => resolveSessionWizardWorkerRpcUrlFromDraft({
    draft,
    registryChainId,
    networkId: network?.id,
    workerSecrets: getCurrentEnabledWorkerSecrets(),
  });

  const resolveWorkerRpcUrlMap = () => resolveSessionWizardWorkerRpcUrlMapFromDraft({
    draft,
    registryChainId,
    networkId: network?.id,
    workerSecrets: getCurrentEnabledWorkerSecrets(),
  });

  const resolveWorkerFaucetConfig = () => resolveSessionWizardWorkerFaucetConfigFromDraft({
    draft,
    registryChainId,
    networkId: network?.id,
    workerSecrets: getCurrentEnabledWorkerSecrets(),
  });
  const effectiveDefaultWorkerRpcUrl = toStr(resolveWorkerRpcUrl()).trim();
  const resolvedWorkerBaseUrlForDelegation = resolveWorkerBaseUrl();

  const parseAllowOriginsInput = () => parseSessionWizardAllowOriginsInput(workerAllowOrigins);

  const getResourceSecretFields = (resourceKey) => {
    return resolveSessionWizardResourceSecretFields(resourceKey, draft?.ai);
  };

  const buildSponsoredFlagFields = (secretsSnapshot = getCurrentWorkerSecrets()) => {
    const currentSlug = normalizeSlug(draft?.slug || '');
    const currentWorkerUrl = normalizeWorkerAuthUrl(resolvedWorkerBaseUrlForDelegation);
    const fallbackFields = (
      currentSlug &&
      currentSlug === normalizeSlug(provisionedSponsoredContext?.sessionSlug || '') &&
      (!currentWorkerUrl || !provisionedSponsoredContext?.workerUrl || currentWorkerUrl === provisionedSponsoredContext.workerUrl)
    )
      ? provisionedSponsoredContext?.fields
      : {};

    return buildSponsoredSessionFlagFields({
      secrets: sanitizeSessionWizardWorkerSecretsForLitMode(
        secretsSnapshot
      ),
      fallbackFields: sanitizeSessionWizardSponsoredFieldSnapshotForLitMode(
        fallbackFields
      ),
      workerSecretsEnabled,
    });
  };

  // Build a snapshot of gate selections from the current gate UI (default gate + resource mapping).
  // This keeps on-chain resource gates aligned with the selected default gate even if state updates are still pending.
  const buildGateSelectionsSnapshot = () => {
    const chainId = Number(registryChainId || draft.networkChainId || 0) || null;
    const resolvedDefaultGateId = defaultGateId || encryptionGates[0]?.id || '';
    const snapshot = {};
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


  const getMissingWorkerSecretsForDeploy = (secretsSnapshot = getCurrentWorkerSecrets()) => {
    const missing = [];
    if (!toStr(secretsSnapshot.openaiKey).trim()) {
      missing.push('OpenAI key');
    }
    if (!toStr(secretsSnapshot.arweaveJwk).trim()) missing.push('Arweave JWK');
    const rpcUrl = resolveWorkerRpcUrl();
    if (!rpcUrl) missing.push('Worker RPC URL');
    const hasAnyChipotleField = (
      CHIPOTLE_LIT_CONFIG_FIELDS.some((key) => !!toStr(secretsSnapshot?.[key]).trim()) ||
      !!toStr(secretsSnapshot?.litAccountApiKey).trim() ||
      !!toStr(secretsSnapshot?.litUsageApiKey).trim()
    );
    const accountKeyOnlyChipotleConfig = !!toStr(secretsSnapshot?.litAccountApiKey).trim();
    const bootstrapOnlyChipotleConfig = (
      accountKeyOnlyChipotleConfig ||
      (
        !!toStr(secretsSnapshot?.litApiBase).trim() &&
        !toStr(secretsSnapshot?.litGroupId).trim() &&
        !toStr(secretsSnapshot?.litPkpId).trim() &&
        !toStr(secretsSnapshot?.litActionCid).trim() &&
        !toStr(secretsSnapshot?.litUsageApiKey).trim()
      )
    );
    if (hasAnyChipotleField && !bootstrapOnlyChipotleConfig) {
      const requiredChipotleFields = [
        ['litApiBase', 'Lit API base'],
        ['litGroupId', 'Lit group ID'],
        ['litPkpId', 'Lit PKP ID'],
      ];
      requiredChipotleFields.forEach(([key, label]) => {
        if (!toStr(secretsSnapshot?.[key]).trim()) missing.push(label);
      });
    }
    return missing;
  };

  const chipotleHookWorkerSecrets = useMemo<WorkerSecretsLike>(() => ({
    litApiBase: workerSecrets.litApiBase,
    litGroupId: workerSecrets.litGroupId,
    litPkpId: workerSecrets.litPkpId,
    litActionCid: workerSecrets.litActionCid,
    litAccountApiKey: workerSecrets.litAccountApiKey,
    litUsageApiKey: workerSecrets.litUsageApiKey,
  }), [
    workerSecrets.litAccountApiKey,
    workerSecrets.litActionCid,
    workerSecrets.litApiBase,
    workerSecrets.litGroupId,
    workerSecrets.litPkpId,
    workerSecrets.litUsageApiKey,
  ]);

  useEffect(() => {
    const previousHooks = getGlobalLitHooks();
    const chainId = Number(registryChainId || draft?.networkChainId || network?.id || 0) || null;
    const chipotle = resolveSessionWizardChipotleHookConfig({
      workerSecretsEnabled,
      workerSecrets: chipotleHookWorkerSecrets,
      resolvedWorkerUrl: resolvedWorkerBaseUrlForDelegation,
      draft,
    });
    const nextHooks = chipotle ? createLitHooks({
      providerLike: provider,
      account,
      chainId,
      litChain: resolveLitChain({ chainId }),
      litNetwork: 'chipotle',
      chipotle,
    }) : null;
    setGlobalLitHooks(nextHooks);
    return () => {
      setGlobalLitHooks(previousHooks);
    };
  }, [
    account,
    draft,
    network?.id,
    provider,
    registryChainId,
    resolvedWorkerBaseUrlForDelegation,
    chipotleHookWorkerSecrets,
    workerSecretsEnabled,
  ]);

  const clearWorkerSecretFields = () => {
    const aiProviders = draft?.ai?.providers || {};
    Object.keys(aiProviders).forEach((key) => {
      updateDraftValue(['ai', 'providers', key, 'apiKey'], '');
      updateDraftValue(['ai', 'providers', key, 'encryptedApiKey'], '');
    });
    const rpcProviders = draft?.rpc?.providers || {};
    Object.keys(rpcProviders).forEach((key) => {
      updateDraftValue(['rpc', 'providers', key, 'apiKey'], '');
      updateDraftValue(['rpc', 'providers', key, 'encryptedApiKey'], '');
    });
    updateDraftValue(['arweave', 'jwk'], '');
    updateDraftValue(['arweave', 'encryptedJwk'], '');
    updateDraftValue(['faucet', 'privateKey'], '');
    updateDraftValue(['faucet', 'encryptedPrivateKey'], '');
  };

  // Cache worker secrets only until they've been submitted in a deploy payload.
  // After a successful deploy, stop persisting secrets to cache. Keep the live
  // in-memory copy so the current publish run can still finish without forcing
  // the user to re-enter keys.
  const clearCachedWorkerSecretsAfterDeploy = () => {
    if (effectivePersistWorkerSecrets) return;
  };

  // After successful metadata upload, clear arweaveJwk from cache (skip in dev).
  const clearCachedArweaveJwkAfterUpload = () => {
    if (effectivePersistWorkerSecrets) return;
    applyWorkerSecretsUpdate((prev) => ({ ...prev, arweaveJwk: '' }));
  };

  const signBootstrapAdminAction = async ({ statement, targetSlug, workerUrl, accountOverride = '' }) => {
    const baseUrl = normalizeWorkerUrl(workerUrl || resolveWorkerBaseUrl());
    if (!baseUrl) throw new Error('Worker URL is missing.');
    const authAccount = toStr(accountOverride || resolvedWalletAccountRef.current || account).trim();
    return buildSignedBootstrapAdminAuth({
      slug: normalizeSlug(targetSlug),
      workerUrl: baseUrl,
      statement,
      context: {
        account: authAccount,
        chainId: Number(registryChainId || draft.networkChainId || network?.id || 1) || 1,
        providerLike: typeof provider === 'string' ? provider : undefined,
      },
    });
  };

  const buildSessionWizardPublishArweaveUploadOptions = async ({
    arweaveJwk = '',
    workerUrl = '',
    sessionSlug = '',
    authAccount = '',
  } = {}) => (
    // Regression guard: keep session metadata/header uploads on the same
    // sponsored-JWK path as deferred SBT finalization so /new publish does not
    // fix only one Arweave leg and regress the next.
    resolvePublishArweaveUploadOptions({
      arweaveJwk,
      workerUrl,
      preferDirectArweaveUpload: !!toStr(arweaveJwk).trim(),
      allowDirectFallbackOnBootstrapFailure: false,
      requireAdminAuthWithoutJwk: true,
      buildAdminAuth: ({ workerUrl: resolvedWorkerUrl }) => (
        signBootstrapAdminAction({
          statement: 'Admin request: bootstrap arweave upload',
          targetSlug: sessionSlug,
          workerUrl: resolvedWorkerUrl,
          accountOverride: authAccount,
        })
      ),
    })
  );

  const signTypedAdminAction = async ({ action = 'set-config', body = {}, targetSlug, workerUrl, accountOverride = '' }) => {
    const baseUrl = normalizeWorkerUrl(workerUrl || resolveWorkerBaseUrl());
    if (!baseUrl) throw new Error('Worker URL is missing.');
    const authAccount = toStr(accountOverride || resolvedWalletAccountRef.current || account).trim();
    return buildSignedAdminActionAuth({
      action,
      slug: normalizeSlug(targetSlug),
      body,
      workerUrl: baseUrl,
      context: {
        account: authAccount,
        chainId: Number(registryChainId || draft.networkChainId || network?.id || 1) || 1,
        providerLike: typeof provider === 'string' ? provider : undefined,
      },
    });
  };

  const sessionIdHex = sessionRegistryUtils.normalizeSessionIdHex(sessionId);
  const embeddedDeployHelperEnabled = typeof draft.embeddedDeployHelperEnabled === 'boolean'
    ? draft.embeddedDeployHelperEnabled
    : (CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED !== false);

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

  const {
    handleDeployWorker,
    resolveConnectedAdminAddress,
  } = useSessionWizardWorkerDeploy({
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

  const resourceGateOptions = useMemo(
    () => encryptionGates.map((gate) => ({ value: gate.id, label: gate.label || gate.id })),
    [encryptionGates]
  );

  const updateResourceGate = (resourceKey: string, gateId: string) => {
    setResourceGateMap((prev) => ({
      ...prev,
      [resourceKey]: gateId,
    }));
  };

  const renderSessionWizardInfoTooltip = useCallback(({
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
  }, [sessionWizardTooltipsEnabled]);

  const renderResourceInputs = (resourceKey: string) => {
    const fields = getResourceSecretFields(resourceKey);
    return (
      <WorkerResourceInputs
        resourceKey={resourceKey}
        fields={fields}
        workerSecrets={workerSecrets}
        workerSecretsEnabled={workerSecretsEnabled}
        isNormalMode={isNormalMode}
        showSponsoredFaucetNotice={showSponsoredFaucetNotice}
        effectiveDefaultWorkerRpcUrl={effectiveDefaultWorkerRpcUrl}
        getSecretFieldTestId={getSessionWizardSecretFieldTestId}
        onUpdateSecret={(fieldKey: string, nextValue: string) => {
          applyWorkerSecretsUpdate((prev: WorkerSecretsLike) => ({ ...prev, [fieldKey]: nextValue }));
        }}
      />
    );
  };

  const renderResourceCard = (resourceKey: string) => {
    const fallbackGateId = defaultGateId || resourceGateOptions[0]?.value || '';
    const gateId = resourceGateMap[resourceKey] || fallbackGateId;
    const resourceGateOptionValues = (resourceGateOptions || []).map((option) => option?.value).filter(Boolean);
    const selectedGateIds = normalizeGateIds(gateId)
      .filter((id) => resourceGateOptionValues.includes(id))
      .filter(Boolean);
    return (
      <WorkerResourceCard
        key={resourceKey}
        resourceKey={resourceKey}
        label={RESOURCE_LABELS[resourceKey] || resourceKey}
        tooltipText={RESOURCE_SECTION_TOOLTIPS[resourceKey] || ''}
        renderInfoTooltip={renderSessionWizardInfoTooltip}
        gateOptions={gateOptions}
        selectedGateIds={selectedGateIds}
        onChangeSelectedGateIds={(nextIds: unknown) => {
          const nextGateIds = normalizeGateIds(nextIds).filter((id) => resourceGateOptionValues.includes(id));
          if (!nextGateIds.length) {
            updateResourceGate(resourceKey, fallbackGateId || '');
            return;
          }
          updateResourceGate(resourceKey, nextGateIds.length === 1 ? nextGateIds[0] : nextGateIds);
        }}
        open={openResourceGateKey === resourceKey}
        onToggleOpen={(nextOpen) => setOpenResourceGateKey(nextOpen ? resourceKey : '')}
        disabled={resourceGateOptions.length <= 1}
      >
        {renderResourceInputs(resourceKey)}
      </WorkerResourceCard>
    );
  };

  const orderedDraftEntries = useMemo(
    () => getSessionWizardOrderedDraftEntries(draft),
    [draft]
  );

  const effectiveMetadataUrl = normalizeArweaveUri(manualMetadataUrl) || metadataUrl;
  const effectiveMetadataTxId = parseArweaveTxId(effectiveMetadataUrl);
  const effectiveMetadataGatewayUrl = effectiveMetadataTxId
    ? arweaveScripts.buildArweaveGatewayUrl(effectiveMetadataTxId)
    : '';
  const registerChainId = Number(registryChainId || draft.networkChainId || 0) || null;
  const registerExplorerBaseUrl = getExplorerBaseUrl(registerChainId);
  const isNormalMode = wizardMode !== 'advanced';
  const hasConfiguredDeployHelperUrl = !!normalizeWorkerAuthUrl(toStr(CLOUDFLARE_DEPLOY_HELPER_URL).trim());
  const shouldShowDeployHelperUrlInput = !isNormalMode || !hasConfiguredDeployHelperUrl;

  const { primaryEntries: primaryDraftEntries, moreOptionsEntries } = useMemo(
    () => splitSessionWizardDraftEntries(orderedDraftEntries, isNormalMode),
    [isNormalMode, orderedDraftEntries]
  );

  const resolvedWorkerBaseUrl = resolveWorkerBaseUrl();
  const configuredWorkerUrl = normalizeWorkerUrl(toStr(draft.corsWorkerUrl).trim());
  const defaultWorkerUrl = normalizeWorkerUrl(getSessionWizardDefaultWorkerUrl());
  const deployedWorkerUrl = normalizeWorkerUrl(toStr(deployWorkerUrl).trim());
  const normalModeRequiresCustomWorker = isNormalMode && !NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED;
  const {
    deployVerifiedInUi,
    effectiveConfiguredWorkerUrl,
  } = resolveSessionWizardWorkerVerificationUiState({
    configuredWorkerUrl,
    deployWorkerUrl: deployedWorkerUrl,
    defaultWorkerUrl,
    deployComplete,
    normalModeRequiresCustomWorker,
  });
  const customWorkerSelected = normalModeRequiresCustomWorker || workerMode !== 'default';
  const hideNormalModeDefaultWorkerUrl = normalModeRequiresCustomWorker &&
    !deployVerifiedInUi &&
    isSessionWizardDefaultWorkerPlaceholderUrl(configuredWorkerUrl, defaultWorkerUrl);
  const visibleConfiguredWorkerUrl = hideNormalModeDefaultWorkerUrl ? '' : effectiveConfiguredWorkerUrl;
  const displayedWorkerUrl = hideNormalModeDefaultWorkerUrl
    ? ''
    : (toStr(draft.corsWorkerUrl).trim() || visibleConfiguredWorkerUrl);
  const usesDefaultWorkerUrl = !!visibleConfiguredWorkerUrl && !!defaultWorkerUrl && visibleConfiguredWorkerUrl === defaultWorkerUrl;
  const deployWorkerMatchesConfiguredUrl = !!visibleConfiguredWorkerUrl &&
    !!deployedWorkerUrl &&
    visibleConfiguredWorkerUrl === deployedWorkerUrl;
  const showSharedWorkerChoice = !normalModeRequiresCustomWorker;
  const showWorkerUrlField = customWorkerSelected && deployVerifiedInUi;
  const workerUrlSource = !resolvedWorkerBaseUrl
    ? 'missing (set worker URL)'
    : (workerMode === 'default' || usesDefaultWorkerUrl)
      ? 'default worker'
      : deployVerifiedInUi && deployWorkerMatchesConfiguredUrl
        ? 'deployed worker URL (verified this run)'
        : deployVerifiedInUi && !deployWorkerMatchesConfiguredUrl
          ? 'custom worker URL changed after deploy (re-deploy to verify)'
          : 'custom worker URL (not verified in this run)';
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
  const normalModeBundleUrl =
    toStr(CLOUDFLARE_WORKER_BUNDLE_URL).trim();
  const {
    showSponsoredFaucetNotice,
    showSponsoredDeployAccessNotice,
  } = resolveSponsoredBundleAdvancedFieldNotices({
    sponsoredBundle: sponsoredBundleAppliedBundleRef.current,
    workerSecrets,
    deployForm,
  });
  const shouldUseSponsoredAutoDeployFlow = (
    toStr(workerMode).trim() !== 'default' &&
    sponsoredAutoDeployState.ready
  );
  const hasManualBundleFallbackFile = !!bundleFile;
  const sponsoredAutoDeployBundleMode = resolveSessionWizardDeployBundleMode({
    wizardMode,
    bundleMode,
    bundleUrl: deployForm.bundleUrl,
    sponsoredAutoDeployReady: shouldUseSponsoredAutoDeployFlow,
    forceManualBundleFile,
    hasBundleFile: hasManualBundleFallbackFile,
    normalModeBundleUrlOverride,
  });
  const showNormalModeWorkerStep = !(
    sponsoredAutoDeployState.active &&
    toStr(workerMode).trim() !== 'default'
  );
  const sponsoredLocalBundledAssetAvailable = (
    sponsoredAutoDeployBundleMode !== 'upload' ||
    hasManualBundleFallbackFile
  );
  const canUseSponsoredAutoDeployNow = shouldUseSponsoredAutoDeployFlow && sponsoredLocalBundledAssetAvailable;
  const hasNormalModeBundleUrlOverride = !!toStr(normalModeBundleUrlOverride).trim();
  const sponsoredAutoDeployMissingBundleUrl = (
    sponsoredAutoDeployState.active &&
    sponsoredAutoDeployState.missing.includes('Worker bundle URL')
  );
  const showSponsoredBundleFallbackInput = (
    isNormalMode &&
    !showNormalModeWorkerStep &&
    (
      forceManualBundleFile ||
      hasManualBundleFallbackFile ||
      hasNormalModeBundleUrlOverride ||
      sponsoredAutoDeployMissingBundleUrl
    )
  );
  const normalModeBundleUrlOverrideValidationError = useMemo(
    () => getSessionWizardNormalModeBundleUrlOverrideValidationError(normalModeBundleUrlOverride),
    [normalModeBundleUrlOverride]
  );
  const normalModeHostedBundleConfigured = !!toStr(CLOUDFLARE_WORKER_BUNDLE_URL).trim();
  const showNormalModeManualBundleControls = (
    isNormalMode &&
    (forceManualBundleFile || !normalModeHostedBundleConfigured)
  );
  const normalModeBundleHelpText = normalModeHostedBundleConfigured
    ? 'Normal mode deploys use the GitHub-hosted worker bundle automatically. If a retry needs a different source, keep this Git URL as the default and add a manual bundle URL or upload below after a fetch failure.'
    : NORMAL_MODE_MISSING_HOSTED_BUNDLE_MESSAGE;
  const normalModeManualBundleHelpText = normalModeHostedBundleConfigured
    ? NORMAL_MODE_MANUAL_BUNDLE_RETRY_MESSAGE
    : NORMAL_MODE_MISSING_HOSTED_BUNDLE_MESSAGE;
  const currentSessionWizardPathname = (
    typeof window === 'undefined' || !window.location ? '' : window.location.pathname
  );
  const isNewSessionWizardRoute = isNewSessionWizardPathname(
    currentSessionWizardPathname
  );
  const newSessionBannerDismissalContextKey = buildSessionWizardNewSessionBannerDismissalContextKey({
    pathname: currentSessionWizardPathname,
    sponsoredBundleId: initialSponsoredBundleId,
    sponsoredBundleKey: initialSponsoredBundleKey,
  });
  const normalizedAppliedSponsoredBundle = normalizeSparseSponsoredBundlePayload(
    sponsoredBundleAppliedBundleRef.current
  );
  const {
    newSessionRequiresLitCredential,
    showNewSessionRequirementsBanner,
  } = resolveSessionWizardNewSessionRequirementsDisplayState({
    cloudflareWorkerSbtGateMode,
    currentWorkerSecrets,
    hasSponsoredBundleLink,
    isNewSessionWizardRoute,
    newSessionBannerDismissalContextKey,
    newSessionBannerDismissedContext,
    normalizedAppliedSponsoredBundle,
    persistedNewSessionBannerDismissed,
    sponsoredBundleStatus,
  });
  const publishUiPlan = resolveSessionWizardPublishUiPlan({
    resolvedWorkerBaseUrl,
    workerMode,
    usesDefaultWorkerUrl,
    deployVerifiedInUi,
    deployWorkerMatchesConfiguredUrl,
    canUseSponsoredAutoDeployNow,
    manualMetadataUrl,
    metadataUrl,
    effectiveMetadataGatewayUrl,
    effectiveMetadataTxId,
    deployComplete,
    hasPendingDrafts: hasUndeployedPendingSbtDrafts,
    publishBusy,
    publishStep,
    publishStepElapsedMs,
    sbtsLabel: t('sbts'),
  });
  const {
    canUploadMetadataNow,
  } = publishUiPlan.publishReadiness;
  const deployStatusDisplayState = resolveSessionWizardDeployStatusDisplayState({
    deployInFlight,
    deployStatus,
    deployVerifiedInUi,
  });
  const deployStatusIsError = deployStatusDisplayState.isError;
  const pendingDraftCount = normalizedPendingSbtDrafts.length;
  const sessionDetailsComplete = !!toStr(draft?.sessionName).trim() && !!toStr(draft?.sessionInfo).trim();
  const configuredPrivateGateCount = encryptionGates.filter(
    (gate) => normalizeSbtSelection(gate?.sbts || []).length > 0
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
  useEffect(() => {
    if (!isNormalMode) return;
    const visibleSectionOrder = showNormalModeWorkerStep
      ? ['metadata', 'encryption', 'worker', 'publish']
      : ['metadata', 'encryption', 'publish'];
    setCollapsedSections((prev) => {
      const firstOpenSection = visibleSectionOrder.find((key) => prev[key] === false) || 'metadata';
      return {
        metadata: firstOpenSection !== 'metadata',
        encryption: firstOpenSection !== 'encryption',
        worker: showNormalModeWorkerStep ? firstOpenSection !== 'worker' : true,
        publish: firstOpenSection !== 'publish',
      };
    });
  }, [isNormalMode, showNormalModeWorkerStep]);
  const createSbtModalChainId = Number(draft.networkChainId || registryChainId || network?.id || network?.chainId || 0) || null;
  const createSbtModalNetwork = getChainById(createSbtModalChainId) || (
    createSbtModalChainId
      ? { id: createSbtModalChainId, name: getChainName(createSbtModalChainId) || `Chain ${createSbtModalChainId}` }
      : (network || { id: null, name: '' })
  );
  const createSbtModalSessionSlug = toStr(
    createSbtModalState.sessionSlug ||
    draft.slug ||
    resolvedActiveSessionSlug ||
    ''
  ).trim();
  const createSbtModalArweaveJwkOverride = workerSecretsEnabled
    ? toStr(
        createSbtModalState.arweaveJwkOverride ||
        getEnabledWorkerArweaveJwk()
      ).trim()
    : '';
  const wizardContractViewerContracts = useMemo(() => {
    const draftContracts = draft?.contracts && typeof draft.contracts === 'object'
      ? draft.contracts
      : {};
    const defaults = getSessionWizardContractDefaults(registryChainId);
    const visibleKeys = getVisibleSessionWizardContractKeys(draftContracts, defaults);
    const resolvedChainId = Number(
      registryChainId ||
      draft?.networkChainId ||
      network?.id ||
      network?.chainId ||
      0
    ) || null;
    const mergedContracts = visibleKeys.reduce((acc, contractKey) => {
      const entry = draftContracts[contractKey] && typeof draftContracts[contractKey] === 'object'
        ? draftContracts[contractKey]
        : {};
      const address = toStr(entry.address || '').trim() || toStr(defaults?.[contractKey] || '').trim();
      acc[contractKey] = {
        ...entry,
        address,
        chainId: Number(entry.chainId || resolvedChainId || 0) || null,
      };
      return acc;
    }, {});

    return buildContractViewerContracts({
      sessionContracts: mergedContracts,
      chainId: resolvedChainId,
      includeSessionRegistry: true,
      includeCustomSBT: false,
    });
  }, [
    draft?.contracts,
    draft?.networkChainId,
    network?.chainId,
    network?.id,
    registryChainId,
  ]);
  const selectedWizardContract = useMemo(() => (
    wizardContractViewerContracts.find(
      (contract) => contract.key === contractViewerModalState.contractKey
    ) || null
  ), [contractViewerModalState.contractKey, wizardContractViewerContracts]);
  const selectedWizardContractSessionSlug = toStr(
    selectorSourceSessionConfig?.slug ||
    activeSessionSlug ||
    resolvedActiveSessionSlug ||
    ''
  ).trim();
  const selectedWizardContractHref = useMemo(() => buildContractsPageHref({
    contractKey: selectedWizardContract?.key || '',
    sessionSlug: selectedWizardContractSessionSlug,
  }), [selectedWizardContract?.key, selectedWizardContractSessionSlug]);
  const handleDismissNewSessionRequirementsBanner = useCallback(() => {
    if (newSessionBannerDismissalContextKey) {
      setNewSessionBannerDismissedContext(newSessionBannerDismissalContextKey);
    }
    if (!hasSponsoredBundleLink) {
      setPersistedNewSessionBannerDismissed(true);
      writeSessionWizardNewSessionBannerDismissed();
    }
  }, [hasSponsoredBundleLink, newSessionBannerDismissalContextKey]);

  const sessionMetadataHeaderAccessory = wizardMode === 'advanced' ? (
    <SessionWizardSessionIdBadge
      isRegenerating={isSessionIdRegenerating}
      onCopy={handleCopySessionId}
      onRegenerate={handleRegenerateSessionId}
      renderInfoTooltip={renderSessionWizardInfoTooltip}
      sessionIdDisplay={sessionIdDisplay}
    />
  ) : null;

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
      deployInFlight={deployInFlight}
      deployStatus={deployStatus}
      deployStatusIsError={deployStatusIsError}
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
      onRegistryChainIdChange={setRegistryChainId}
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
      publishAdvancedOpen={publishAdvancedOpen}
      publishBusy={publishBusy}
      publishUiPlan={publishUiPlan}
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
