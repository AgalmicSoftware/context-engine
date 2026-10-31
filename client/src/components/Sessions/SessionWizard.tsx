import RecoveryKeyDialog from '../Shared/RecoveryKeyDialog';
import { getSessionWizardInterviewValidationError } from './sessionWizardInterviewValidation';
/** @file SessionWizard.tsx */
import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { ReactReduxContext } from 'react-redux';
import { resolveLitChain, getGlobalLitHooks } from '../../utilities/crypto/litProtocol.js';
import { getEffectiveArweaveKey } from '../../utilities/session/resourceKeys.js';
import {
  CLOUDFLARE_DEPLOY_HELPER_URL,
  CLOUDFLARE_WORKER_BUNDLE_URL,
  CE_DEFAULT_EMBEDDED_DEPLOY_HELPER_ENABLED,
  DEFAULT_CHAIN_ID,
} from '../../variables/appConfig.js';
import { getChainById, getDefaultHttpRpc } from '../../variables/chains.js';
import type { SessionConfig, UnknownRecord } from '../../utilities/session/sessionTypes.js';
import {
  compileSessionModeProfile,
  validateSessionModeProfile,
  type SessionModeProfile,
} from '../../utilities/session/sessionModeProfile';
import {
  describeSessionModeRule,
  describeWorkerModeError,
  listSessionModeConflicts,
} from '../../utilities/session/sessionModeRuleMessages';
import { normalizeBaseUrl } from '../../utilities/urlUtils.js';
import { t } from '../../utilities/ui/terminology.js';
import { createLogger } from '../../utilities/logging';
import {
  getSessionWizardContractDefaults,
  resolveSessionWizardContractViewerPlan,
  resolveSessionWizardInitialRegistryChainId,
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
import useSessionWizardWorkerSyncEffects from './hooks/useSessionWizardWorkerSyncEffects';
import useSessionWizardIdentityEffects from './hooks/useSessionWizardIdentityEffects';
import useSessionWizardTooltipPreference from './hooks/useSessionWizardTooltipPreference';
import useSessionWizardPublishElapsed from './hooks/useSessionWizardPublishElapsed';
import useSessionWizardCleanupEffect from './hooks/useSessionWizardCleanupEffect';
import useSessionWizardSponsoredBundleController from './hooks/useSessionWizardSponsoredBundleController';
import useSessionWizardWorkerSecretsController from './hooks/useSessionWizardWorkerSecretsController';
import useSessionWizardPendingSbtController from './hooks/useSessionWizardPendingSbtController';
import useSessionWizardWorkerResourceRenderer from './hooks/useSessionWizardWorkerResourceRenderer';
import useSessionWizardCachedInitialState, {
  type SessionWizardEncryptionGateState as EncryptionGateState,
} from './hooks/useSessionWizardCachedInitialState';
import useSessionWizardWorkerSettlementLifecycle from './hooks/useSessionWizardWorkerSettlementLifecycle';
import {
  arweavePublishAdapter,
  sbtFactoryReceiptPublishAdapter,
  sessionPublishSbtMetadataAdapter,
  sessionRegistryPublishAdapter,
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
import SessionPublishAdvancedSettingsPanel from './SessionPublishAdvancedSettingsPanel';
import SessionPublishProgressPanel from './SessionPublishProgressPanel';
import SessionPublishResultLinks from './SessionPublishResultLinks';
import { SetupVoiceKeyNote } from './setup/SetupAiSection';
import { describeContextProblem, readSetupQuestions } from './setup/SetupContentSections';
import { SetupContextFiles, SetupContextPublisher, usePendingContextFiles } from './setup/SetupContextSources';
import {
  SessionTemplateActions,
  SessionTemplateLinkNotice,
  SetupQuestionsPublisher,
} from './setup/SessionTemplateTools';
import {
  diffSessionTemplates,
  sessionTemplateFromDraft,
  type SessionTemplate,
  type SessionTemplateChange,
  type SessionTemplateResult,
} from '@ce-shared/sessionTemplate.mjs';
import { decodeSessionTemplateLink, hasSessionTemplateLink } from '@ce-shared/sessionTemplateLink.mjs';
import type { SetupCreateStage } from './setup/SetupCreatePanel';
import { defaultSessionSetupProfile, editSessionSetupProfile } from './setup/sessionSetupProfile';
import SetupSlugPreview from './setup/SetupSlugPreview';
import SetupWorkerQuick from './setup/SetupWorkerQuick';
import { SetupWithAi } from './setup/SetupWithAi';
import SessionHostedFaucetControl from './SessionHostedFaucetControl';
import WorkerDeployHelperToggle from './WorkerDeployHelperToggle';
import {
  describeHostedFaucetSetup,
  normalizeHostedFaucetSelection,
  setHostedFaucetEnabled,
} from './sessionWizardHostedFaucet';
import { applySessionModeProfileSelectionToDraft } from './sessionWizardModeProfileDraftController';
import { resolveSessionWizardResourceSecretFields } from './sessionWizardResourceConfig';
import {
  LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH,
  getSessionWizardNormalModeBundleUrlOverrideValidationError,
  resolveSessionWizardSponsoredPublishSurfaceState,
  resolveSessionWizardSponsoredAutoDeployReadiness,
} from './sessionWizardPublishFlow';
import {
  appendSessionWizardRegisterTxEntry,
  isSessionWizardRegisterDuplicatePreflightError,
  resolveSessionWizardPublishCompletionRequest,
  resolveSessionWizardRemainingPendingDrafts,
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
import { resolveSessionWizardModeFieldPolicy } from './sessionWizardModeFieldPolicy';
import {
  checkSessionWizardWorkerSlugExists,
  resolveSessionWizardSlugAvailabilityPort,
} from './sessionWizardSlugAvailability';
import { createSessionWizardPublishRuntimeController } from './sessionWizardPublishRuntimeController';
import {
  createPendingWorkerGroupDraft,
  normalizePendingWorkerGroupDrafts,
  validatePendingWorkerGroupDrafts,
  type PendingWorkerGroupDraft,
} from './sessionWizardPendingWorkerGroups';
import { publishPendingWorkerGroupDrafts } from './sessionWizardPendingWorkerGroupPublish';
import { resolveSessionWizardWorkerPublishEvidence } from './sessionWizardWorkerPublishEvidence';
import { resolveSessionWizardPublishRequestDescriptor } from './sessionWizardPublishReadiness';
import { resolveSessionWizardWorkerVerificationUiState } from './sessionWizardWorkerState';
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
import { dedupeSbtSelection, normalizeSbtSelection } from './sessionWizardSbtSelections';
import {
  buildPendingSbtDeployContextSignature,
  deploySessionWizardPendingSbtDraft,
  persistSessionWizardSbtRecoveryCodes,
} from './sessionWizardPendingSbtPublish';
import {
  areSbtSelectionsEqual,
  buildEmptyProvisionedSponsoredContext,
  buildEncryptionGate,
  buildResourceGateMap,
  getNextGateIndex,
  parseListInput,
  resolveSessionWizardSelectorSourceConfig,
  setValueAtPath,
} from './sessionWizardGateUtils';
import { resolveSponsoredBundleAdvancedFieldNotices } from './sessionWizardSponsoredBundleSupport';
import { __test__resetSessionWizardSponsoredBundleCacheKey } from './sessionWizardSponsoredBundleCache';
import {
  getSessionWizardWorkerResourceKeys,
  resolveSessionWizardChipotleHookConfig,
  sanitizeSessionWizardSponsoredFieldSnapshotForLitMode,
  sanitizeSessionWizardWorkerSecretsForLitMode,
} from './sessionWizardWorkerSecretSupport';
import {
  applySessionTemplateToDraft,
  applySessionWizardRegistryChainDraftDefaults,
  buildSessionWizardCacheWritePayload,
  buildSessionWizardInitialDraftFromCache,
} from './sessionWizardDraftState';
import {
  __test__getSessionWizardDefaultAiSettings,
  MANUAL_BUNDLE_URL_OVERRIDE_HELP,
  NORMAL_MODE_MANUAL_BUNDLE_RETRY_MESSAGE,
  NORMAL_MODE_MISSING_HOSTED_BUNDLE_MESSAGE,
  NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED,
  SESSION_WIZARD_DEFAULT_TEMPLATE,
} from './sessionWizardConfig';
import { getSessionSlugValidationError, isReservedSessionSlug } from './sessionWizardSlugValidation';
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
import { writeSessionWizardWorkerSettlement } from './sessionWizardWorkerSettlement';
import { buildPublishedPendingSbtLinks, type PublishedPendingSbtLink } from './sessionWizardPublishLinks';
import {
  getSessionWizardExplorerBaseUrl as getExplorerBaseUrl,
  normalizeSessionWizardWorkerUrl as normalizeWorkerUrl,
} from './sessionWizardUrlSupport';
import { resolveSessionWizardWorkerUrlSourceState } from './sessionWizardWorkerRuntimeSupport';
import {
  buildSessionWizardGateOptions,
  normalizeSessionWizardGateIds as normalizeGateIds,
  resolveSessionWizardResourceGate as resolveResourceGate,
  resolveSessionWizardResourceGateSelectionUpdate,
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
import { buildSessionWizardDraftFieldRenderer } from './sessionWizardDraftFieldRenderer';
import { buildSessionWizardMetadataPayloadBuilder } from './sessionWizardMetadataPayloadBuilder';
import type { WorkerSecretsLike } from '../shellTypes';
import type {
  ContractViewerModalState,
  CreateSbtModalState,
  DeployFormState,
  DraftAiModelsState,
  DraftAiState,
  DraftState,
  GateSelectionsState,
  ProvisionedSponsoredContextState,
  ResourceGateMapState,
  SessionRegistryReadContract,
  SessionSlugExistsArgs,
  SessionWizardProps,
} from './sessionWizardTypes';

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
export { __test__getSessionWizardDefaultAiSettings } from './sessionWizardConfig';
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

const ignoreSessionPublishStep = (_publishStep: number): void => {};

const log = createLogger('general');
const DEFAULT_TEMPLATE: DraftState = SESSION_WIZARD_DEFAULT_TEMPLATE as DraftState;
const pathKey = (path: string[]): string => path.join('.');

const resolveSessionWizardLimitHydrationKey = (limits: unknown): string => {
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return '';
  const record = limits as UnknownRecord;
  const hasWallet = Object.prototype.hasOwnProperty.call(record, 'perWalletPerDay');
  const hasAnonymousIp = Object.prototype.hasOwnProperty.call(record, 'perAnonymousIpPerDay');
  if (!hasWallet && !hasAnonymousIp) return '';
  const nextWallet = hasWallet ? toStr(record.perWalletPerDay).trim() : '';
  const nextAnonymousIp = hasAnonymousIp ? toStr(record.perAnonymousIpPerDay).trim() : '';
  return `${nextWallet}|${hasAnonymousIp ? nextAnonymousIp : '<inherit>'}`;
};

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

const isPlainRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

// The draft's own values at a template's fields, unchecked: a draft the template
// checks refuse, such as one with a blank link row, can still be compared.
const pickTemplateFields = (value: unknown, like: unknown): unknown =>
  isPlainRecord(value) && isPlainRecord(like)
    ? Object.fromEntries(Object.keys(like).map((key) => [key, pickTemplateFields(value[key], like[key])]))
    : value;

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
  const cachedWizard = useMemo(() => readSessionWizardCache(), []);
  const wizardCacheSnapshotRef = useRef<unknown>(cachedWizard);
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
    if (draftFromCache.sessionModeProfile) return draftFromCache;
    // A new draft starts on the quick path's profile; every option edits it.
    const profile = defaultSessionSetupProfile();
    return applySessionModeProfileSelectionToDraft(draftFromCache, profile, compileSessionModeProfile(profile));
  }, [cachedDraftHasEmbeddedDeployHelperEnabled, cachedWizard, sourceEmbeddedDeployHelperDefault]);
  const cachedInitialState = useSessionWizardCachedInitialState({
    cachedWizard,
    initialDraftNetworkChainId: initialDraft.networkChainId,
    networkId: network?.id,
    initialSessionId,
  });

  const [draft, setDraft] = useState<DraftState>(() => initialDraft as DraftState);
  const draftRef = useRef<DraftState>(initialDraft as DraftState);
  const [sessionId, setSessionId] = useState(() => cachedInitialState.initialSessionIdValue);
  const [sessionIdStatus, setSessionIdStatus] = useState('');
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
  const [createStage, setCreateStage] = useState<SetupCreateStage>('idle');
  // A #template= link waits here until it is used or dismissed.
  const [linkTemplate, setLinkTemplate] = useState<{
    result: SessionTemplateResult;
    changes: SessionTemplateChange[];
    sameDraft: boolean;
  } | null>(null);
  const [draftFromLink, setDraftFromLink] = useState(false);
  // The created session's public config, for adding a template's questions.
  const [publishedSessionConfig, setPublishedSessionConfig] = useState<Record<string, unknown> | null>(null);
  // Context files chosen before Create; they are uploaded once the session exists.
  const pendingContextFiles = usePendingContextFiles();
  const publishBusy = resolveSessionWizardPublishReducerUiState({ state: sessionPublishState }).publishBusy;
  const publishRequestInFlightRef = useRef(false);
  const [publishStepElapsedMs, setPublishStepElapsedMs] = useState(0);
  // One page, no advanced mode: the runtime keeps its normal-mode behaviour.
  const wizardMode = 'normal';
  const [registryChainId, setRegistryChainId] = useState<number>(() =>
    resolveSessionWizardInitialRegistryChainId({
      draftChainId: draft.networkChainId,
      networkChainId: network?.id,
    }),
  );
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
  const [encryptionGates, setEncryptionGates] = useState<EncryptionGateState[]>(() => cachedInitialState.initialGates);
  // Pending SBT drafts carry deploy secrets and claim codes, so keep them only
  // in this mounted tab. Reloading or leaving the wizard intentionally clears them.
  const { pendingSbtDrafts, setPendingSbtDrafts, hasUndeployedPendingSbtDrafts } = usePendingSbtDrafts(account);
  const pendingSbtDraftsRef = useRef(pendingSbtDrafts);
  pendingSbtDraftsRef.current = pendingSbtDrafts;
  const [pendingWorkerGroupDrafts, setPendingWorkerGroupDrafts] = useState<PendingWorkerGroupDraft[]>(() =>
    normalizePendingWorkerGroupDrafts(cachedWizard?.pendingWorkerGroupDrafts),
  );
  const pendingWorkerGroupDraftsRef = useRef(pendingWorkerGroupDrafts);
  pendingWorkerGroupDraftsRef.current = pendingWorkerGroupDrafts;
  const [createSbtModalState, setCreateSbtModalState] = useState<CreateSbtModalState>(() => ({
    open: false,
    targetType: 'gate',
    gateId: cachedInitialState.initialDefaultGateId,
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
    () => cachedInitialState.initialGateSelections as GateSelectionsState,
  );
  const [defaultGateId, setDefaultGateId] = useState(() => cachedInitialState.initialDefaultGateId);
  const [createSbtTargetGateId, setCreateSbtTargetGateId] = useState(() => cachedInitialState.initialDefaultGateId);
  const [featuredDraftGateAutoLink, setFeaturedDraftGateAutoLink] = useState(
    () => cachedInitialState.initialFeaturedDraftGateAutoLink,
  );
  // Gate selection is always per-resource when multiple gates exist (no toggle needed).
  const [resourceGateMap, setResourceGateMap] = useState<ResourceGateMapState>(() => {
    const cachedMap = cachedWizard?.resourceGateMap;
    if (cachedMap && typeof cachedMap === 'object') return cachedMap as ResourceGateMapState;
    return buildResourceGateMap(
      cachedInitialState.initialGates,
      cachedInitialState.initialDefaultGateId,
    ) as ResourceGateMapState;
  });
  const sessionIdRotationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminUrlStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jsonCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compactSessionHeaderInputRef = useRef<HTMLInputElement | null>(null);
  const embeddedDeployHelperHydrationKeyRef = useRef('');
  const workerLimitDraftHydrationKeyRef = useRef(resolveSessionWizardLimitHydrationKey(draft?.limits));
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
    workerSecretsEnabled: savedWorkerSecretsEnabled,
    setWorkerSecretsEnabled,
    persistWorkerSecrets,
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
    workerRequirementProof,
    setWorkerRequirementProof,
    provisionedSponsoredContext,
    setProvisionedSponsoredContext,
    workerSecrets,
    setWorkerSecrets,
    workerUrlAutoFilled,
    setWorkerUrlAutoFilled,
    nativeTemplateSetupIdentity,
    setNativeTemplateSetupIdentity,
    workerAllowOrigins,
    setWorkerAllowOrigins,
    workerLimitPerWallet,
    setWorkerLimitPerWallet,
    workerLimitPerAnonymousIp,
    setWorkerLimitPerAnonymousIp,
  } = useSessionWizardWorkerState<ProvisionedSponsoredContextState>({
    cachedWizard,
    deployHelperUrlDefault: CLOUDFLARE_DEPLOY_HELPER_URL,
    workerBundleUrlDefault: CLOUDFLARE_WORKER_BUNDLE_URL,
    defaultAllowedOrigins: DEFAULT_ALLOWED_ORIGINS,
    buildProvisionedSponsoredContextState,
  });
  // "Require users to pay for usage" applies to on-chain sessions only. Its
  // saved choice applies only where its toggle shows; for other profiles
  // Worker secrets stay on, so the AI-key inputs never lock without a control.
  const userPaidUsageAvailable =
    resolveSessionWizardModeRequirements(draft.sessionModeProfile as SessionModeProfile).authorityMode ===
    'evm_registry_canonical';
  const userPaidUsageToggleShown = userPaidUsageAvailable;
  const workerSecretsEnabled = savedWorkerSecretsEnabled || !userPaidUsageToggleShown;

  useEffect(() => {
    const limits = draft?.limits;
    if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return;
    const record = limits as UnknownRecord;
    const hasWallet = Object.prototype.hasOwnProperty.call(record, 'perWalletPerDay');
    const hasAnonymousIp = Object.prototype.hasOwnProperty.call(record, 'perAnonymousIpPerDay');
    if (!hasWallet && !hasAnonymousIp) return;
    const nextWallet = hasWallet ? toStr(record.perWalletPerDay).trim() : '';
    const nextAnonymousIp = hasAnonymousIp ? toStr(record.perAnonymousIpPerDay).trim() : '';
    const hydrationKey = resolveSessionWizardLimitHydrationKey(record);
    if (workerLimitDraftHydrationKeyRef.current === hydrationKey) return;
    setWorkerLimitPerWallet(nextWallet);
    setWorkerLimitPerAnonymousIp(nextAnonymousIp);
    workerLimitDraftHydrationKeyRef.current = hydrationKey;
  }, [draft?.limits, setWorkerLimitPerAnonymousIp, setWorkerLimitPerWallet]);

  const deployFormRef = useRef<DeployFormState>(deployForm);
  const resolvedWalletAccountRef = useRef(toStr(account).trim());
  const advancedBundleFileInputRef = useRef<HTMLInputElement | null>(null);
  const normalModeRetryBundleFileInputRef = useRef<HTMLInputElement | null>(null);
  const deployCompleteRef = useRef(deployComplete);
  const deployWorkerUrlRef = useRef(normalizeBaseUrl(toStr(cachedWizard?.deployWorkerUrl).trim()));
  deployCompleteRef.current = deployComplete;
  deployWorkerUrlRef.current = deployWorkerUrl;
  const provisionedSponsoredContextRef = useRef<ProvisionedSponsoredContextState>(
    buildProvisionedSponsoredContextState(cachedWizard?.provisionedSponsoredContext),
  );
  // Holds the saved choice: sponsored-bundle restore puts it back as it was.
  const workerSecretsEnabledRef = useRef(savedWorkerSecretsEnabled);
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
    sponsoredBundleKeyInput,
    setSponsoredBundleKeyInput,
    submitSponsoredBundleKey,
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
    },
    setWorkerSecrets,
    setDraft,
    setDeployForm,
    setDeployStatus,
    setDeployInFlight,
    setDeployComplete,
    setWorkerMode,
    setDeployWorkerUrl,
    setWorkerRequirementProof,
    setProvisionedSponsoredContext,
    setForceManualBundleFile,
    setNormalModeBundleUrlOverride,
    setWorkerUrlAutoFilled,
    setWorkerSecretsEnabled,
    setBundleFile,
    buildProvisionedSponsoredContextState,
  });
  const getWorkerPublishEvidence = () => {
    try {
      return resolveSessionWizardWorkerPublishEvidence({
        runtime: workerDeployRuntimeRef.current,
        workerSecrets: getCurrentWorkerSecrets(),
        defaultWorkerUrl: getSessionWizardDefaultWorkerUrl(),
      });
    } catch {
      // Draft edits can make a previously verified profile unreachable. Treat
      // that as missing evidence so render stays mounted and publish's live
      // profile validation can report the actionable failure before effects.
      return null;
    }
  };
  const sessionModeRequirements = resolveSessionWizardModeRequirements(draft.sessionModeProfile as SessionModeProfile, {
    hasPendingSbtDrafts: hasUndeployedPendingSbtDrafts,
    sessionConfig: draft,
  });
  const modeFieldPolicy = useMemo(
    () => resolveSessionWizardModeFieldPolicy(sessionModeRequirements),
    [sessionModeRequirements],
  );
  const allowSessionHeaderFileUpload =
    !sessionModeRequirements.selected || sessionModeRequirements.publish.uploadMetadata;
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
    allowFileUpload: allowSessionHeaderFileUpload,
    draftSessionHeader: draft?.sessionHeader,
    updateDraftSessionHeader: (value) => updateDraftValue(['sessionHeader'], value),
  });
  const { showPromptPreview, setShowPromptPreview, metadataObjectCollapsed, setMetadataObjectCollapsed } =
    useSessionWizardChromeState();
  const workerResourceKeys = useMemo(() => getSessionWizardWorkerResourceKeys(), []);
  const normalizedDraftStorageProfile = useMemo(
    () => normalizeSessionStorageProfileConfig(draft?.storageProfile),
    [draft?.storageProfile],
  );
  const cloudflareWorkerSbtGateMode = isWorkerSbtGateCloudflareStorageProfile(normalizedDraftStorageProfile);
  const workerSlugAvailabilityUrl = normalizeBaseUrl(toStr(draft.corsWorkerUrl).trim());
  const checkWorkerSessionSlugExists = useCallback(
    async ({ slug }: SessionSlugExistsArgs): Promise<boolean> =>
      checkSessionWizardWorkerSlugExists({
        workerUrl: workerSlugAvailabilityUrl,
        slug,
      }),
    [workerSlugAvailabilityUrl],
  );
  const slugAvailabilityPort = resolveSessionWizardSlugAvailabilityPort({
    isWorkerCanonical: sessionModeRequirements.isWorkerCanonical,
    registerSession: sessionModeRequirements.publish.registerSession,
    workerUrl: workerSlugAvailabilityUrl,
    checkRegistrySlug: checkSessionSlugExists,
    checkWorkerSlug: checkWorkerSessionSlugExists,
  });
  const { slugAvailability } = useSessionSlugState({
    enabled: slugAvailabilityPort.enabled,
    slug: draft?.slug,
    privateSlugMode,
    registryChainId,
    isReservedSlug: isReservedSessionSlug,
    sessionExists: slugAvailabilityPort.sessionExists,
  });
  const workerCanonicalSettlement = useSessionWizardWorkerSettlementLifecycle(cachedWizard, {
    currentIdentity: { workerUrl: deployWorkerUrl || draft.corsWorkerUrl, slug: draft.slug, sessionId },
    isWorkerCanonical: sessionModeRequirements.isWorkerCanonical,
    publishStatus: sessionPublishState.status,
    setSessionUrl,
    setAdminUrl,
  });
  const visibleWorkerResourceKeys = workerResourceKeys.filter((key) =>
    sessionModeRequirements.selected
      ? sessionModeRequirements.visibleWorkerResourceKeys.includes(key)
      : !cloudflareWorkerSbtGateMode || key !== 'lit',
  );
  const effectivePersistWorkerSecrets = false;

  const registryAddress = useMemo(() => {
    return resolveSessionWizardRegistryAddress(registryChainId, draft?.contracts);
  }, [registryChainId, draft?.contracts]);
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
    // Redact secret values; live deployment evidence never enters localStorage.
    if (workerCanonicalSettlement.isSettled) return;
    const cachePayload = buildSessionWizardCacheWritePayload({
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
      workerSecretsEnabled: savedWorkerSecretsEnabled,
      effectivePersistWorkerSecrets,
      workerSecrets,
      workerAllowOrigins,
      workerLimitPerWallet,
      workerLimitPerAnonymousIp,
      deployForm,
      deployComplete,
      deployWorkerUrl,
      workerRequirementProof,
      provisionedSponsoredContext,
      pendingWorkerGroupDrafts,
      nativeTemplateSetupIdentity,
    });
    const result = writeSessionWizardCache(cachePayload, { expectedCachedPayload: wizardCacheSnapshotRef.current });
    if (result.ok && result.status !== 'preserved-foreign-draft') wizardCacheSnapshotRef.current = cachePayload;
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
    savedWorkerSecretsEnabled,
    effectivePersistWorkerSecrets,
    workerSecrets,
    workerAllowOrigins,
    workerLimitPerWallet,
    workerLimitPerAnonymousIp,
    deployForm,
    deployComplete,
    deployWorkerUrl,
    workerRequirementProof,
    provisionedSponsoredContext,
    pendingWorkerGroupDrafts,
    nativeTemplateSetupIdentity,
    workerCanonicalSettlement.isSettled,
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
    if (!sessionModeRequirements.requiresRpc) return;
    const chainId = Number(registryChainId || 0) || 0;
    if (!chainId) return;
    setDraft((prev) => {
      // NOTE: For now we assume session chain === registry chain; split these when they diverge.
      // Contract defaults currently come from bundled per-chain config; ENS discovery remains future work.
      // Auto-fill the current PATH public RPC; dedicated gateway/provider-tier support remains future work.
      return applySessionWizardRegistryChainDraftDefaults({
        draft: prev,
        chainId,
        contractDefaults: sessionModeRequirements.publish.registerSession
          ? getSessionWizardContractDefaults(chainId)
          : {},
        pathRpc: getDefaultHttpRpc(chainId),
        includeContracts: sessionModeRequirements.publish.registerSession,
        includeFaucet: sessionModeRequirements.requiresFunding,
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
  }, [
    registryChainId,
    sessionModeRequirements.publish.registerSession,
    sessionModeRequirements.requiresFunding,
    sessionModeRequirements.requiresRpc,
  ]);

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
    enabled: sessionModeRequirements.requiresRpc,
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
    workerSecretsEnabled: savedWorkerSecretsEnabled,
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

  const addPendingWorkerGroupDraft = useCallback((label: string) => {
    setPendingWorkerGroupDrafts((current) => {
      if (current.length >= 100) return current;
      return [...current, createPendingWorkerGroupDraft(label)];
    });
  }, []);

  const removePendingWorkerGroupDraft = useCallback((groupId: string) => {
    setPendingWorkerGroupDrafts((current) => current.filter((entry) => entry.groupId !== groupId));
  }, []);

  const updatePendingWorkerGroupDraft = useCallback((groupId: string, patch: Partial<PendingWorkerGroupDraft>) => {
    setPendingWorkerGroupDrafts((current) =>
      current.map((entry) => {
        if (entry.groupId !== groupId) return entry;
        const next = { ...entry, ...patch, groupId: entry.groupId };
        if (next.joinMode === 'open' && next.memberVisibility === 'admin_only') {
          next.memberVisibility = 'session';
        }
        return next;
      }),
    );
  }, []);

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
    preservedPendingSbtDrafts,
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
      // Regression guard: persist drafts suppressed by this publish plan before
      // identity rotation or registry refresh can leave the page mid-settlement.
      const cacheClearResult = clearSessionWizardCache({
        expectedPublicationIdentity: { slug: draft.slug, sessionId },
        ...(Array.isArray(preservedPendingSbtDrafts) ? { preservedPendingSbtDrafts } : {}),
      });
      // A successful clear releases the next generated identity to own this tab's cache.
      if (cacheClearResult.draft.ok && cacheClearResult.draft.status !== 'preserved-foreign-draft')
        wizardCacheSnapshotRef.current = null;
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
      setStatus('Choose where the session runs before creating it.');
      return;
    }
    const sessionModeValidation = validateSessionModeProfile(draft.sessionModeProfile as SessionModeProfile);
    if (!sessionModeValidation.valid) {
      setStatus(
        `Resolve this conflict first: ${describeSessionModeRule(
          sessionModeValidation.issues[0]?.code || '',
          sessionModeValidation.issues[0]?.message,
        )}`,
      );
      return;
    }
    if (publishRequestInFlightRef.current) {
      setStatus('Publish already in progress.');
      return;
    }
    if (workerCanonicalSettlement.preventDuplicatePublish(setStatus)) return;
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
        const pendingWorkerGroupDraftSnapshot = normalizePendingWorkerGroupDrafts(pendingWorkerGroupDraftsRef.current);
        const pendingWorkerGroupIssues = validatePendingWorkerGroupDrafts(pendingWorkerGroupDraftsRef.current);
        if (pendingWorkerGroupIssues.length) {
          setStatus(pendingWorkerGroupIssues[0]);
          return;
        }
        const currentWorkerSecrets = getCurrentWorkerSecrets();
        const liveRuntime = workerDeployRuntimeRef.current;
        const liveDraft = liveRuntime?.draft || draftRef.current;
        const interviewError = getSessionWizardInterviewValidationError(liveDraft?.interviewMode);
        if (interviewError) {
          setStatus(interviewError);
          return;
        }
        const liveSessionModeProfile = liveDraft?.sessionModeProfile as SessionModeProfile | undefined;
        const liveSessionModeValidation = liveSessionModeProfile
          ? validateSessionModeProfile(liveSessionModeProfile)
          : { valid: false, issues: [] };
        if (!liveSessionModeValidation.valid) {
          setStatus(
            `Resolve this conflict first: ${describeSessionModeRule(
              liveSessionModeValidation.issues[0]?.code || '',
              liveSessionModeValidation.issues[0]?.message,
            )}`,
          );
          return;
        }
        const sponsoredAutoDeployState = resolveSessionWizardSponsoredAutoDeployReadiness({
          sponsoredBundle: sponsoredBundleAppliedBundleRef.current,
          deployForm: deployFormRef.current,
          workerSecretsEnabled: workerSecretsEnabledRef.current || !userPaidUsageToggleShown,
          currentWorkerSecrets,
          getMissingWorkerSecretsForDeploy,
        });
        const publishRequestDescriptor = resolveSessionWizardPublishRequestDescriptor({
          pendingDraftSnapshot,
          hasPendingWorkerGroupDrafts: pendingWorkerGroupDraftSnapshot.length > 0,
          manualMetadataUrl,
          workerMode: liveRuntime?.workerMode || workerMode,
          sponsoredAutoDeployReady: sponsoredAutoDeployState.ready,
          deployComplete: deployCompleteRef.current,
          canUploadMetadataNow,
          sessionModeProfile: liveDraft.sessionModeProfile as SessionModeProfile,
        });
        const liveWorkerEvidence = getWorkerPublishEvidence();
        const { publishExecutionPlan } = publishRequestDescriptor;
        const publishAllowed =
          publishUiPlan.publishReadiness.canPublishNow &&
          (!publishExecutionPlan.shouldPersistWorkerConfig ||
            publishExecutionPlan.shouldAutoDeployWorker ||
            liveWorkerEvidence?.verified === true);
        if (!publishAllowed) {
          setStatus('Deploy and verify the selected worker before publishing.');
          return;
        }
        beginSessionPublishReducerAttempt(dispatchSessionPublish, publishExecutionPlan);
        let uploadResult = null;
        let workerUrlOverride = '';
        let deployedPendingDrafts = [];
        const publishControllerResult = await sessionWizardPublishRuntimeController.runPreparation({
          publishAllowed,
          publishExecutionPlan,
          signerAccountOverride,
          runTrackedPublishEffect,
          pendingWorkerGroupDrafts: pendingWorkerGroupDraftSnapshot,
        });
        if (publishControllerResult.status === 'blocked') {
          dispatchSessionPublish({ type: 'edit' });
          return;
        }
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
        const preservedPendingSbtDrafts = normalizePendingSbtDrafts(
          resolveSessionWizardRemainingPendingDrafts({
            deployedPendingDrafts: normalizePendingSbtDrafts(deployedPendingDrafts),
            pendingDraftSnapshot: publishRequestDescriptor.pendingDraftSnapshot,
          }),
        );
        await sessionWizardPublishRuntimeController.settleRegistration({
          preservedPendingSbtDrafts,
          publishExecutionPlan,
          uploadResult,
          publishControllerResult,
          runTrackedPublishEffect,
        });
        setPublishedSessionConfig(publishControllerResult.verifiedWorkerConfig?.publicConfig || null);
        if (publishExecutionPlan.shouldCreateWorkerGroups) {
          setPendingWorkerGroupDrafts([]);
        }
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
            replacePendingSbtDrafts: (remainingDrafts) =>
              setPendingSbtDrafts(normalizePendingSbtDrafts(remainingDrafts)),
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
    resolvedAdminAddress: toStr(resolvedWalletAccountRef.current || account).trim(),
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
    workerAllowOrigins,
    workerLimitPerWallet,
    workerLimitPerAnonymousIp,
    embeddedDeployHelperEnabled,
    deployHelperUrl,
    latestChainBlock,
    sessionId,
    sessionIdHex,
    workerCanonicalPublishCompleted: workerCanonicalSettlement.publishCompleted,
    deployComplete,
    deployWorkerUrl,
    workerRequirementProof,
    draft,
    deployForm,
  };

  const {
    handleDeployWorker,
    resolveConnectedAdminAddress,
    verifyNativeWorker,
    operatorRecoveryKey,
    setOperatorRecoveryKey,
    recoveryDisplay,
    finishRecoveryDisplay,
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

  const sessionWizardPublishRuntimeController = createSessionWizardPublishRuntimeController({
    runtimeRef: workerDeployRuntimeRef,
    dispatch: dispatchSessionPublish,
    getErrorMessage: getSessionWizardErrorMessage,
    deployWorker: () => handleDeployWorker({ forceSponsoredAutoDeploy: true }),
    deployPendingSbts: deployPendingSbtDrafts,
    getWorkerPublishEvidence,
    resolveWorkerRpcUrl,
    resolveWorkerRpcUrlMap,
    parseAllowOriginsInput,
    resolveWorkerFaucetConfig,
    signTypedAdminAction,
    createPendingWorkerGroups: (input) =>
      publishPendingWorkerGroupDrafts({
        ...input,
        signTypedAdminAction,
        workerAuthContext: {
          account: input.signerAccount,
          providerLike: provider,
          chainId: draft.networkChainId || registryChainId,
        },
        onDraftImageUploaded: (groupId, imageUrl) =>
          updatePendingWorkerGroupDraft(groupId, { imageUrl, imageFile: null }),
      }),
    handleRegisterGroup,
    generateSessionId,
    callbacks: {
      setSessionUrl,
      setAdminUrl,
      setAdminUrlStatus,
      setWorkerCanonicalPublishSettled: workerCanonicalSettlement.setSettled,
      clearSessionWizardCache,
      writeSessionWizardWorkerSettlement,
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
    allowSessionHeaderFileUpload,
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
    modeFieldPolicy,
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
  const registerChainId = Number(registryChainId || draft.networkChainId || 0) || null;
  const registerExplorerBaseUrl = getExplorerBaseUrl(registerChainId);
  const isNormalMode = true;
  const hasConfiguredDeployHelperUrl = !!workerAuthPublishAdapter.normalizeWorkerUrl(
    toStr(CLOUDFLARE_DEPLOY_HELPER_URL).trim(),
  );
  const shouldShowDeployHelperUrlInput = !isNormalMode || !hasConfiguredDeployHelperUrl;

  const resolvedWorkerBaseUrl = resolveWorkerBaseUrl();
  const configuredWorkerUrl = normalizeWorkerUrl(toStr(draft.corsWorkerUrl).trim());
  const defaultWorkerUrl = normalizeWorkerUrl(getSessionWizardDefaultWorkerUrl());
  const deployedWorkerUrl = normalizeWorkerUrl(toStr(deployWorkerUrl).trim());
  const normalModeRequiresCustomWorker = isNormalMode && !NORMAL_MODE_SHARED_HOSTED_WORKER_ENABLED;
  const { deployVerifiedInUi: deployIdentityVerifiedInUi, effectiveConfiguredWorkerUrl } =
    resolveSessionWizardWorkerVerificationUiState({
      configuredWorkerUrl,
      deployWorkerUrl: deployedWorkerUrl,
      defaultWorkerUrl,
      deployComplete,
      normalModeRequiresCustomWorker,
    });
  const currentWorkerSecrets = getCurrentWorkerSecrets();
  const deployRequirementsVerified = workerRequirementProof
    ? getWorkerPublishEvidence()?.verified === true
    : !sessionModeRequirements.usesWorkerRuntime;
  // Derive current publish authority from the selected worker, profile, provider, and secrets.
  const deployVerifiedInUi = deployIdentityVerifiedInUi && deployRequirementsVerified;
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
  const showWorkerUrlField = customWorkerSelected && (deployVerifiedInUi || sessionModeRequirements.usesWorkerRuntime);
  const allowNativeWorkerVerification =
    sessionModeRequirements.selected &&
    sessionModeRequirements.usesWorkerRuntime &&
    !sessionModeRequirements.requiresLit;
  const { deployWorkerMatchesConfiguredUrl, usesDefaultWorkerUrl, workerUrlSource } =
    resolveSessionWizardWorkerUrlSourceState({
      defaultWorkerUrl,
      deployedWorkerUrl,
      deployVerifiedInUi,
      resolvedWorkerBaseUrl,
      visibleConfiguredWorkerUrl,
      workerMode,
    });
  const sponsoredAutoDeployState = resolveSessionWizardSponsoredAutoDeployReadiness({
    sponsoredBundle: sponsoredBundleAppliedBundleRef.current,
    deployForm,
    workerSecretsEnabled,
    currentWorkerSecrets,
    getMissingWorkerSecretsForDeploy,
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
  } = resolveSessionWizardSponsoredPublishSurfaceState({
    isNormalMode,
    workerMode,
    sponsoredAutoDeployState,
    forceManualBundleFile,
    normalModeBundleUrlOverride,
    normalModeDefaultBundleUrl: normalModeBundleUrl,
    manualBundleRetryMessage: NORMAL_MODE_MANUAL_BUNDLE_RETRY_MESSAGE,
    missingHostedBundleMessage: NORMAL_MODE_MISSING_HOSTED_BUNDLE_MESSAGE,
  });
  const normalModeBundleUrlOverrideValidationError = useMemo(
    () => getSessionWizardNormalModeBundleUrlOverrideValidationError(normalModeBundleUrlOverride),
    [normalModeBundleUrlOverride],
  );
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
    hasPendingWorkerGroupDrafts: pendingWorkerGroupDrafts.length > 0,
    isNormalMode,
    publishAdvancedOpen,
    publishCompleted: workerCanonicalSettlement.publishCompleted,
    publishStepElapsedMs,
    sbtsLabel: t('sbts'),
    sessionModeProfile: draft.sessionModeProfile as SessionModeProfile,
    interviewMode: draft.interviewMode,
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
    workerCanonicalPublishCompleted: workerCanonicalSettlement.publishCompleted,
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
  // Templates: export, import and share links carry only portable fields.
  const buildDraftTemplate = (): SessionTemplateResult => {
    const current = draftRef.current || draft;
    let draftId = toStr(current.draftId).trim();
    if (!draftId) {
      // Links made from this draft can be matched back to it.
      draftId = Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      updateDraftValue(['draftId'], draftId);
    }
    return sessionTemplateFromDraft({ ...current, draftId });
  };
  const importTemplate = (template: SessionTemplate) => {
    const profileChain = Number((template.sessionModeProfile as SessionModeProfile | null)?.evm?.registryChainId || 0);
    if (profileChain) setRegistryChainId(profileChain);
    setDraft((prev) => {
      const next = applySessionTemplateToDraft(template, prev) as DraftState;
      draftRef.current = next;
      return next;
    });
  };
  const clearTemplateLink = () => {
    setLinkTemplate(null);
    if (typeof window === 'undefined') return;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
  };
  // On load, and when a link is pasted into this tab (only its hash changes).
  // The fragment leaves the address bar once read, so a reload or a copied
  // address doesn't carry the draft again; the notice keeps it until answered.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const readLink = () => {
      if (!hasSessionTemplateLink(window.location.hash)) return;
      void decodeSessionTemplateLink(window.location.hash).then((result) => {
        if (cancelled || !result) return;
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
        const mine = sessionTemplateFromDraft(draftRef.current);
        const sameDraft =
          result.ok && !!result.template.draftId && result.template.draftId === draftRef.current?.draftId;
        // Every difference is listed before the link can replace the draft,
        // including when the draft itself fails the template checks.
        const changes = result.ok
          ? diffSessionTemplates(
              mine.ok ? mine.template : (pickTemplateFields(draftRef.current, result.template) as SessionTemplate),
              result.template,
            )
          : [];
        setLinkTemplate({ result, changes, sameDraft });
      });
    };
    readLink();
    window.addEventListener('hashchange', readLink);
    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', readLink);
    };
  }, []);

  // The rules table, beside the options that conflict.
  const conflicts = useMemo(() => listSessionModeConflicts(draft.sessionModeProfile), [draft.sessionModeProfile]);
  const editProfile = useCallback((mutate: (profile: SessionModeProfile) => void) => {
    const { profile, compiled } = editSessionSetupProfile(draftRef.current?.sessionModeProfile, mutate);
    if (profile.evm.registryChainId) setRegistryChainId(profile.evm.registryChainId);
    setDraft((prev) => {
      const next = applySessionModeProfileSelectionToDraft(prev, profile, compiled) as DraftState;
      draftRef.current = next;
      return next;
    });
  }, []);
  // Hosted test-ETH stays off until chosen again after a network change.
  const hostedFaucetDraftRef = useRef(draft);
  const hostedFaucetChainRef = useRef(registryChainId);
  useEffect(() => {
    let next = normalizeHostedFaucetSelection(draft, hostedFaucetDraftRef.current);
    if (hostedFaucetChainRef.current !== registryChainId && describeHostedFaucetSetup(next).enabled) {
      next = setHostedFaucetEnabled(next, false);
    }
    hostedFaucetChainRef.current = registryChainId;
    hostedFaucetDraftRef.current = next;
    if (next !== draft) {
      draftRef.current = next;
      setDraft(next);
    }
  }, [draft, registryChainId]);

  // Create: the passkey sign-in confirms it, the deploy helper deploys a
  // Worker when none is verified yet, then the existing publish runtime runs.
  const needsWorkerDeploy =
    sessionModeRequirements.usesWorkerRuntime && !deployVerifiedInUi && !canUseSponsoredAutoDeployNow;
  const missingSecrets = needsWorkerDeploy && workerSecretsEnabled ? getMissingWorkerSecretsForDeploy() : [];
  const contextProblem = describeContextProblem(draft);
  const missingInputs = [
    toStr(draft.sessionName).trim() ? '' : 'Enter a session name.',
    contextProblem ? `Fix the context: ${contextProblem}` : '',
    needsWorkerDeploy && !toStr(deployForm.apiToken).trim()
      ? 'Enter your Cloudflare API token, or verify a Worker you deployed from the Cloudflare dashboard.'
      : '',
    ...missingSecrets.map((label) => `Enter the ${label}.`),
  ].filter(Boolean);
  const sessionCreated = workerCanonicalSettlement.publishCompleted || !!toStr(sessionUrl).trim();
  const createRunningRef = useRef(false);
  // The publish handler reads this render's state, so the effect calls the latest one.
  const handlePublishRef = useRef(handlePublish);
  handlePublishRef.current = handlePublish;
  const handleCreate = () => {
    if (sessionCreated || conflicts.length || missingInputs.length || createRunningRef.current) return;
    setStatus('');
    if (loginComplete !== true) {
      setCreateStage('sign-in');
      if (typeof toggleLoginModal === 'function') toggleLoginModal(true);
      return;
    }
    setCreateStage(needsWorkerDeploy ? 'deploy' : 'publish');
  };
  // Each stage starts once the render before it has settled, so publish reads
  // the Worker evidence that deployment produced.
  useEffect(() => {
    if (createStage === 'sign-in') {
      if (loginComplete === true) setCreateStage(needsWorkerDeploy ? 'deploy' : 'publish');
      return;
    }
    if (createStage === 'idle' || createRunningRef.current) return;
    createRunningRef.current = true;
    const run: Promise<SetupCreateStage> =
      createStage === 'deploy'
        ? handleDeployWorker().then((result) => (result?.ok && result.deployComplete ? 'publish' : 'idle'))
        : handlePublishRef.current().then(() => 'idle');
    const finish = (next: SetupCreateStage) => {
      createRunningRef.current = false;
      setCreateStage(next);
    };
    void run.then(finish, () => finish('idle'));
  }, [createStage, handleDeployWorker, loginComplete, needsWorkerDeploy]);
  const publishStatus = describeWorkerModeError(status, draft.sessionModeProfile) || status;
  const visibleResourceKeysWithoutAi = visibleWorkerResourceKeys.filter((key) => key !== 'ai');

  return (
    <SessionWizardShell
      templateActions={
        <SessionTemplateActions
          buildTemplate={buildDraftTemplate}
          onImport={importTemplate}
          fromLink={draftFromLink}
          fileName={toStr(draft.slug || draft.sessionName)}
          linkBase={`${typeof window === 'undefined' ? '' : window.location.origin}/new`}
        />
      }
      aiSetup={<SetupWithAi setupUrl={`${typeof window === 'undefined' ? '' : window.location.origin}/new`} />}
      templateNotice={
        linkTemplate ? (
          <SessionTemplateLinkNotice
            result={linkTemplate.result}
            changes={linkTemplate.changes}
            sameDraft={linkTemplate.sameDraft}
            onAccept={(template) => {
              importTemplate(template);
              setDraftFromLink(true);
              clearTemplateLink();
            }}
            onDismiss={clearTemplateLink}
          />
        ) : null
      }
      contextSources={
        sessionModeRequirements.isWorkerCanonical ? (
          <SetupContextFiles draft={draft} onChange={updateDraftValue} pending={pendingContextFiles} />
        ) : null
      }
      contextPublisher={
        sessionModeRequirements.isWorkerCanonical ? (
          <SetupContextPublisher
            draft={draft}
            onChange={updateDraftValue}
            pending={pendingContextFiles}
            sessionConfig={sessionCreated ? publishedSessionConfig : null}
            sessionSlug={toStr(draft.slug).trim()}
            account={toStr(account).trim()}
          />
        ) : null
      }
      questionsPublisher={
        sessionModeRequirements.isWorkerCanonical ? (
          <SetupQuestionsPublisher
            questions={readSetupQuestions(draft)}
            sessionConfig={sessionCreated ? publishedSessionConfig : null}
            sessionSlug={toStr(draft.slug).trim()}
            account={toStr(account).trim()}
            provider={provider}
            onPublished={() => updateDraftValue(['questions'], [])}
          />
        ) : null
      }
      recoveryKeyDialog={
        recoveryDisplay ? (
          <RecoveryKeyDialog
            key={recoveryDisplay.createdAt}
            value={recoveryDisplay}
            onContinue={finishRecoveryDisplay}
          />
        ) : null
      }
      draft={draft}
      updateDraftValue={updateDraftValue}
      editProfile={editProfile}
      conflicts={conflicts}
      registryChainId={registryChainId || null}
      onRegistryChainIdChange={handleRegistryChainIdChange}
      isWorkerCanonical={sessionModeRequirements.isWorkerCanonical}
      renderField={renderField}
      slugPreview={
        <SetupSlugPreview
          slug={toStr(draft.slug).trim()}
          availability={toStr(slugAvailability?.status)}
          error={toStr(draft.slug).trim() ? getSessionSlugValidationError(toStr(draft.slug).trim()) : ''}
        />
      }
      encryptionPanelProps={{
        isNormalMode,
        t,
        renderSessionWizardInfoTooltip,
        launchCreateSbtModal,
        activeCreateSbtTargetGateId,
        activeCreateSbtTargetGate,
        encryptionGates,
        focusCreateSbtTargetGate,
        updateEncryptionGate,
        removeEncryptionGate,
        normalizeSbtSelection,
        handleGateAddSbt,
        handleGateRemoveSbt,
        network,
        pendingSbtSelectorOptions,
        selectorSourceChainId,
        selectorSourceSessionConfig,
        resolvedActiveSessionSlug,
        sbtCacheRevision,
        ensureLightSbtUniverse,
        addEncryptionGate,
        pendingSbtDrafts,
        removePendingSbtDraft,
        isWorkerCanonical: sessionModeRequirements.isWorkerCanonical,
        showOnChainGateControls:
          sessionModeRequirements.publish.deployPendingSbts || sessionModeRequirements.publish.registerSession,
        pendingWorkerGroupDrafts,
        onAddPendingWorkerGroupDraft: addPendingWorkerGroupDraft,
        onRemovePendingWorkerGroupDraft: removePendingWorkerGroupDraft,
        onUpdatePendingWorkerGroupDraft: updatePendingWorkerGroupDraft,
      }}
      sbtFieldKeys={['defaultSbtTags', 'defaultFeaturedSBTs', 'autoFeatureSBTsBySessionSlug'].filter(
        (key) => key in draft,
      )}
      hostingQuick={
        sessionModeRequirements.usesWorkerRuntime && !canUseSponsoredAutoDeployNow ? (
          <SetupWorkerQuick
            slug={toStr(draft.slug || resolvedActiveSessionSlug).trim()}
            token={toStr(deployForm.apiToken)}
            onTokenChange={(apiToken) =>
              setDeployForm((prev) => {
                const { accountId: _accountId, ...form } = (prev || {}) as DeployFormState & { accountId?: string };
                return { ...form, apiToken };
              })
            }
            verifiedWorkerUrl={deployVerifiedInUi ? displayedWorkerUrl || resolvedWorkerBaseUrl : ''}
            deployStatus={deployStatusDisplayState.deployStatusText}
            deployStatusIsError={deployStatusDisplayState.isError}
            deployDisabled={deployStatusDisplayState.deployButtonDisabled || createStage !== 'idle' || sessionCreated}
            onDeploy={() => void handleDeployWorker()}
          />
        ) : null
      }
      hostingStatus={
        sessionModeRequirements.usesWorkerRuntime
          ? deployVerifiedInUi
            ? 'Worker ready'
            : canUseSponsoredAutoDeployNow
              ? 'sponsored Worker'
              : 'Worker deploys on Create'
          : ''
      }
      workerPanelProps={{
        allowNativeWorkerVerification,
        agentHttpEnabled: sessionModeRequirements.usesAgentSessionWrapped,
        isNormalMode,
        t,
        renderSessionWizardInfoTooltip,
        pageOwnsDeployToken: true,
        showSharedWorkerChoice,
        workerMode,
        onWorkerModeChange: setWorkerMode,
        setWorkerUrlAutoFilled,
        updateDraftValue,
        getDefaultWorkerUrl: getSessionWizardDefaultWorkerUrl,
        draft,
        deployWorkerUrl,
        deployComplete,
        deployVerifiedInUi,
        showUserPaidUsage: userPaidUsageAvailable,
        workerSecretsEnabled,
        setWorkerSecretsEnabled,
        clearWorkerSecretFields,
        workerResourceKeys: visibleResourceKeysWithoutAi,
        renderResourceCard,
        workerAllowOrigins,
        setWorkerAllowOrigins,
        workerLimitPerWallet,
        setWorkerLimitPerWallet,
        workerLimitPerAnonymousIp,
        setWorkerLimitPerAnonymousIp,
        defaultAllowedOrigins: DEFAULT_ALLOWED_ORIGINS,
        shouldUseSponsoredAutoDeployFlow,
        deployForm,
        deployHelperToggle: (
          <WorkerDeployHelperToggle
            checked={embeddedDeployHelperEnabled}
            onChange={(nextValue) => updateDraftValue(['embeddedDeployHelperEnabled'], nextValue)}
            renderInfoTooltip={renderSessionWizardInfoTooltip}
          />
        ),
        shouldShowDeployHelperUrlInput,
        deployHelperUrl,
        setDeployHelperUrl,
        bundleMode,
        setBundleMode,
        normalModeBundleUrl,
        normalModeBundleHelpText,
        showNormalModeManualBundleControls,
        normalModeBundleUrlOverride,
        setNormalModeBundleUrlOverride,
        normalModeBundleUrlOverrideValidationError,
        manualBundleUrlOverrideHelp: MANUAL_BUNDLE_URL_OVERRIDE_HELP,
        normalModeRetryBundleFileInputRef,
        setBundleFile,
        clearSelectedBundleFile,
        bundleFile,
        normalModeManualBundleHelpText,
        localWorkerBundleFallbackFilePath: LOCAL_WORKER_BUNDLE_FALLBACK_FILE_PATH,
        advancedBundleFileInputRef,
        showSponsoredDeployAccessNotice,
        account,
        toggleLoginModal,
        resolvedActiveSessionSlug,
        setDeployForm,
        operatorRecoveryKey,
        setOperatorRecoveryKey,
        handleDeployWorker,
        deployStatusDisplayState,
        showWorkerUrlField,
        displayedWorkerUrl,
        renderField,
        workerUrlAutoFilled,
        sessionModeProfileWorkerControl: (
          <SessionHostedFaucetControl
            draft={{ ...draft, networkChainId: registryChainId || draft.networkChainId }}
            faucetPrivateKey={getCurrentWorkerSecrets().faucetPrivateKey}
            onChange={(next) => {
              draftRef.current = next as DraftState;
              setDraft(next as DraftState);
            }}
          />
        ),
        verifyNativeWorker,
        nativeTemplateSetupIdentity,
        onNativeTemplateSetupGenerated: setNativeTemplateSetupIdentity,
      }}
      aiKeys={
        // While users pay for usage, the card stays with its inputs locked.
        visibleWorkerResourceKeys.includes('ai') ? (
          <>
            {renderResourceCard('ai')}
            {draft.interviewModeEnabled !== false &&
            resolveSessionWizardResourceSecretFields('ai', draft.ai).some((field) => field.key !== 'openaiKey') ? (
              <SetupVoiceKeyNote />
            ) : null}
          </>
        ) : null
      }
      sponsoredStatusProps={{
        decryptionKey: sponsoredBundleKeyInput,
        onDecryptionKeyChange: setSponsoredBundleKeyInput,
        onRetry: () => setSponsoredBundleRetryNonce((prev) => prev + 1),
        onSubmitDecryptionKey: submitSponsoredBundleKey,
        status: sponsoredBundleStatus,
      }}
      createPanelProps={{
        missing: missingInputs,
        conflicts,
        stage: createStage,
        busy: publishBusy || deployInFlight,
        // On-chain publishes settle without the Worker settlement; their URL marks them done.
        completed: sessionCreated,
        onCreate: handleCreate,
        onCancel: () => setCreateStage('idle'),
        progress: <SessionPublishProgressPanel progressDisplayState={publishUiPlan.publishProgressDisplayState} />,
        settings:
          sessionModeRequirements.publishSettings.showArweaveMetadataControls ||
          sessionModeRequirements.publishSettings.showGasOverrideControls ? (
            <SessionPublishAdvancedSettingsPanel
              manualGasLimit={manualGasLimit}
              manualGasPriceGwei={manualGasPriceGwei}
              manualMaxFeePerGasGwei={manualMaxFeePerGasGwei}
              manualMaxPriorityFeePerGasGwei={manualMaxPriorityFeePerGasGwei}
              manualMetadataUrl={manualMetadataUrl}
              onManualGasLimitChange={setManualGasLimit}
              onManualGasPriceGweiChange={setManualGasPriceGwei}
              onManualMaxFeePerGasGweiChange={setManualMaxFeePerGasGwei}
              onManualMaxPriorityFeePerGasGweiChange={setManualMaxPriorityFeePerGasGwei}
              onManualMetadataUrlChange={setManualMetadataUrl}
              publishSettingsCapabilities={sessionModeRequirements.publishSettings}
              renderInfoTooltip={renderSessionWizardInfoTooltip}
              resolvedWorkerBaseUrl={resolvedWorkerBaseUrl}
              workerUrlSource={workerUrlSource}
            />
          ) : null,
        results: (
          <SessionPublishResultLinks
            adminUrl={adminUrl}
            adminUrlStatus={adminUrlStatus}
            onCreateAnotherSession={workerCanonicalSettlement.onCreateAnotherSession}
            onCopyAdminUrl={handleCopyAdminUrl}
            publishMetadataDisplayState={publishUiPlan.publishMetadataDisplayState}
            publishedPendingSbtLinks={publishedPendingSbtLinks}
            registerExplorerBaseUrl={registerExplorerBaseUrl}
            registerTxs={registerTxs}
            sessionUrl={sessionUrl}
            status={publishStatus}
          />
        ),
      }}
      modalsProps={{
        account,
        provider,
        createSbtModalState,
        closeCreateSbtModal,
        createSbtModalNetwork,
        toggleLoginModal,
        createSbtModalSessionSlug,
        draft,
        createSbtModalChainId,
        createSbtModalArweaveJwkOverride,
        encryptionGates,
        normalizeSbtSelection,
        defaultGateId,
        signBootstrapAdminAction,
        handleSavePendingSbtDraft,
        contractViewerModalState,
        selectedWizardContract,
        closeContractViewerModal,
        selectedWizardContractHref,
        sessionHeaderPreviewModalOpen,
        onCloseSessionHeaderPreviewModal: () => setSessionHeaderPreviewModalOpen(false),
        sessionHeaderPreviewSrc,
        t,
      }}
    />
  );
};

export default SessionWizard;
