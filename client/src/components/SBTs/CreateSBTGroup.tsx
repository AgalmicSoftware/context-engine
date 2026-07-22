/** @file CreateSBTGroup */

import React, { Component } from 'react';
import type { SessionConfig } from '../../utilities/session/sessionTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faQuestionCircle,
  faCheck,
  faPlus,
  faChevronDown,
  faChevronUp,
  faSpinner,
  faExclamationCircle,
  faExternalLinkAlt,
  faImage,
  faClipboard,
  faBookmark,
  faQrcode,
  faTimes,
  faEraser,
} from '@fortawesome/free-solid-svg-icons';
import { ethers } from 'ethers';
import { arweaveClient as arweaveClient } from '../../utilities/arweave/arweaveClient.js';
import { resolvePublishArweaveUploadOptions } from '../../utilities/arweave/publishUploadAuth.js';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import { validateNoLockedPlaintextInPayload } from '../../utilities/arweave/noLeakPayloads.js';
import contractScripts, {
  getSessionConfigBySlugOrDefault,
  normalizeSessionSlug,
} from '../../utilities/web3/chainGateway.js';
import { getEffectiveArweaveKey } from '../../utilities/session/resourceKeys.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { fetchImageFromURL } from '../../utilities/ui/imageFetchClient.js';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import styles from './CreateSBTGroup.module.scss';
import { QRCodeSVG } from 'qrcode.react';
import { getChainById, getSessionContractsForChain, getSessionRegistryChains } from '../../variables/chains.js';
import { JsonButtonRow, JsonPanel, JsonToggleButton } from '../Shared/Json/JsonControls';
import JsonDisplay from '../Shared/Json/JsonDisplay';
import CETooltip from '../Shared/CETooltip';
import GateMultiSelectLock from '../Gates/GateMultiSelectLock';
import CompactImageChooser from '../Shared/CompactImageChooser';
import { readCompactImageClipboard } from '../Shared/compactImageClipboard.js';
import { resolveSessionContractRef } from '../../utilities/session/sessionNaming.js';
import CreateSbtShareableBlock from './CreateSbtShareableBlock';
import { SbtEncryptedRecoveryControl, selectCreateEncryptedRecovery } from './SbtEncryptedRecoveryControl';

import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { getGlobalLitHooks, uploadEncryptedArweaveData } from '../../utilities/crypto/litProtocol.js';
import { createLogger } from '../../utilities/logging.js';
import { peekCacheSync, writeCache } from '../../utilities/cache/cacheScripts.js';
import { notify } from '../../utilities/ui/notify.js';
import { getRelevantDefaultTags } from '../../utilities/defaultTags.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { normalizeGateMode } from '../../utilities/web3/sponsoredAccess.js';
import { resolveSbtAddressFromFactoryReceipt } from '../../utilities/web3/sbtFactoryReceipt.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import {
  deriveSbtMintModeFromDistribution,
  hasPasswordMintForSbtMintMode,
  usesClaimPasswordsForSbtMintMode,
  usesInviteCodesForSbtMintMode,
} from '../../utilities/sbt/sbtMintMode.js';
import {
  getScopedCreateSbtFormCacheKey,
  hasMeaningfulCreateSbtFormPayload,
  LEGACY_CREATE_SBT_FORM_CACHE_KEY,
} from '../../utilities/sbt/sbtCreateFormCache.js';
import { isCryptoMode, t } from '../../utilities/ui/terminology.js';
import { normalizeWorkerUrl } from '../../utilities/worker/workerAuth.js';
import { renderCreateSbtDistributionOptionsSection, renderCreateSbtMintOptionsSection } from './CreateSBTGroupSections';
import {
  areMetadataLockGateMapsEqual,
  buildCreateSbtAutoCreate2SaltSource,
  buildCreateSbtAccountDistributionSyncPatch,
  buildCreateSbtAccountDistributionSyncStatePatch,
  buildCreateSbtBookmarkedSbtsSetPatch,
  buildCreateSbtBooleanTogglePatch,
  buildCreateSbtCollapseTogglePatch,
  buildCreateSbtCopiedLinkIndexPatch,
  buildCreateSbtCopySuccessPatch,
  buildCreateSbtCountdownStartPatch,
  buildCreateSbtCountdownTickPatch,
  buildCreateSbtCurrentTagInputPatch,
  buildCreateSbtDeferredDraftCreate2Salt,
  buildCreateSbtDeferredSaveCompletePatch,
  buildCreateSbtDeferredUploadFallbackPatch,
  buildCreateSbtDeterministicSymbol,
  buildCreateSbtDistributionFieldPatch,
  buildCreateSbtDocumentUrlAdditionPatch,
  buildCreateSbtDocumentUrlRemovalPatch,
  buildCreateSbtEditResetPatch,
  buildEffectiveCreateSbtDocumentUrls,
  buildCreateSbtErrorPatch,
  buildCreateSbtAutoJoinUrl,
  buildCreateSbtDocumentIdHashList,
  buildCreateSbtExportFormatPatch,
  buildCreateSbtEncryptedImageAsset,
  buildCreateSbtFieldAccessDescriptor,
  buildCreateSbtFormCachePayload,
  buildCreateSbtMetadataEncryption,
  buildCreateSbtNetworkChangePatch,
  buildCreateSbtImageFileClearPatch,
  buildCreateSbtImageFilePatch,
  buildCreateSbtImageChooserStatusPatch,
  buildCreateSbtImageLoadErrorPatch,
  buildCreateSbtImageLoadReadyPatch,
  buildCreateSbtImageResetPatch,
  buildCreateSbtImageUploadMethodPatch,
  buildCreateSbtOpenLockKeyPatch,
  buildCreateSbtImagePreviewState,
  buildCreateSbtInputChangePatch,
  buildCreateSbtInitialState,
  buildCreateSbtInviteLinks,
  buildCreateSbtInviteLinksBackupPatch,
  buildCreateSbtJsonPreviewData,
  buildCreateSbtActionLinkClassName,
  buildCreateSbtCollapseHeaderClassName,
  buildCreateSbtInlineFieldLockClassName,
  buildCreateSbtMetadataLockFallbackPatch,
  buildCreateSbtMetadataLockGateIdsPatch,
  buildCreateSbtMetadataLockSelectionPatch,
  buildCreateSbtMetadataLockSelectionState,
  buildCreateSbtMetadataPreviewTagList,
  buildCreateSbtMintResetFailurePatch,
  buildCreateSbtMintStartPatch,
  buildCreateSbtMintSuccessPatch,
  buildCreateSbtMintValidationFailurePatch,
  buildCreateSbtGateOptionsFromConfig,
  buildCreateSbtGateOptionsFromSessionSources,
  buildCreateSbtNumInviteLinksPatch,
  buildCreateSbtGateObjectsAndRecipients,
  buildCreateSbtGroupHashPatch,
  buildCreateSbtGroupPasswordPredictableEntryPatch,
  buildCreateSbtGroupPasswordPredictableExitPatch,
  buildCreateSbtRecipientAccessControlState,
  buildCreateSbtAuthoringContractRefs,
  buildCreateSbtPasswordExportFile,
  buildCreateSbtPasswordListPatch,
  buildCreateSbtPredictedAddressBusyPatch,
  buildCreateSbtPredictedAddressPatch,
  buildCreateSbtProgressIndicatorState,
  buildCreateSbtProgressStepClassName,
  buildCreateSbtAuthoringChainSyncPatch,
  buildCreateSbtAuthoringChainSyncStatePatch,
  buildCreateSbtPreviewEncryptedImageAsset,
  buildCreateSbtPredictableDeploySignature,
  buildCreateSbtRelevantDefaultTagSyncPatch,
  buildCreateSbtRelevantDefaultTagSyncState,
  buildCreateSbtRenderState,
  buildCreateSbtResetFormState,
  buildCreateSbtShareableUrlPatch,
  buildCreateSbtSelectedImageFilePatch,
  buildCreateSbtRestoredCollapseState,
  buildCreateSbtRestoredDistributionState,
  buildCreateSbtRestoredScalarState,
  buildCreateSbtTagAdditionState,
  buildCreateSbtTagRemovalState,
  buildCreateSbtSymbolPatch,
  buildCreateSbtTokenInfoMetaCardClassName,
  buildCreateSbtTokenTagList,
  buildSessionRoutePath,
  buildUniqueTagList,
  getErrorMessage,
  getCanonicalCreateSbtMetadataImageUrl,
  getConfiguredContractAddress,
  getCreateSbtBurnAuthEnum,
  getFetchableCreateSbtImageUrl,
  getCreateSbtValidGateIds,
  getMetadataFieldLockGateIds,
  generateCreateSbtInviteNonces,
  generateCreateSbtRandomHexString,
  hasUsableCreateSbtFactoryForChain,
  isPlainObject,
  normalizeGateIds,
  normalizeGateText,
  normalizeCreateSbtMetadataLockGateIdsForValidGates,
  normalizeMetadataLockGateIds,
  normalizePositiveChainId,
  normalizeCreateSbtDocumentUrlDraft,
  normalizeCreateSbtRestoredTags,
  parseDefaultSbtTags,
  resolveCreateSbtActionDisplayState,
  resolveCreateSbtActionIconStyle,
  resolveCreateSbtLockAudienceSessionName,
  resolveCreateSbtAuthoringChainOptions,
  resolveCreateSbtAuthoringChainState,
  resolveCreateSbtBookmarkActionDisplayState,
  resolveCreateSbtCachedDistributionChainId,
  resolveCreateSbtClearFormButtonState,
  resolveCreateSbtCollapseHeaderDisplayState,
  resolveCreateSbtCopyActionDisplayState,
  resolveCreateSbtDocumentUrlInputState,
  resolveCreateSbtErrorBannerState,
  resolveCreateSbtFailureIconStyle,
  resolveCreateSbtHiddenQrDisplayState,
  resolveCreateSbtPreferredAuthoringChainId,
  resolveCreateSbtMetadataFieldGateIds,
  resolveCreateSbtInviteCodeList,
  resolveCreateSbtInfoDisplayState,
  resolveCreateSbtMetadataImageSource,
  resolveCreateSbtMetadataSessionSlug,
  resolveCreateSbtMintOptionsDisplayState,
  resolveCreateSbtOpenMintAutoJoinUrl,
  resolveCreateSbtPasswordGenerationCount,
  resolveCreateSbtPredictedAddressCacheHit,
  resolveCreateSbtPredictableAddressActive,
  resolveCreateSbtPredictablePasswordListDecision,
  resolveCreateSbtPredictableDeployBaseState,
  resolveCreateSbtPrimaryActionLabel,
  resolveCreateSbtPrimaryButtonState,
  resolveCreateSbtPredictedAddressDisplayText,
  resolveCreateSbtRestoredDeferredCreate2Salt,
  resolveCreateSbtTagInputState,
  resolveCreateSbtMemoizedImageDataUrl,
  resolveCreateSbtRestoredMetadataLockGateIds,
  resolveCreateSbtRestoredPredictableAddressEnabled,
  resolveCreateSbtEffectiveSessionSlug,
  resolveCreateSbtSuccessDisplayState,
  resolveCreateSbtTooltipIconStyle,
  requireCreateSbtRecipientsForGateSelection,
  shouldFallbackCreateSbtDeferredDraftUpload,
  shouldHideCreateSbtNetworkSelector,
  writeCreateSbtEncryptedFieldGate,
} from './createSbtGroupHelpers';
import type { CreateSbtFormCachePayload } from './createSbtGroupHelpers';

const sbtLog = createLogger('sbt');
const SBT_TOOLTIP_LABEL = isCryptoMode() ? 'Soulbound tokens (SBTs)' : `${t('sbtFull')}s`;
const getCreateSbtProgressIcon = (iconState: string) => {
  if (iconState === 'spinner') return faSpinner;
  if (iconState === 'check') return faCheck;
  return faExclamationCircle;
};
type CreateSbtContractScripts = {
  computeGroupPasswordHash: (input: unknown) => string;
  countSBTCreated: (provider: unknown, groupCfg?: unknown) => Promise<number> | number;
  createSBT: (...args: unknown[]) => Promise<unknown>;
  predictSBTAddress: (...args: unknown[]) => Promise<string>;
};
type CreateSbtRecoveryPersistArgs = {
  sbtAddress?: unknown;
  hasPasswordMintOnChain?: unknown;
  codesToStore?: unknown;
};
type CreateSbtRecoveryPersistResult =
  | {
      ok: true;
      status: 'export-only';
      passwords: string[];
    }
  | {
      ok: false;
      status: 'empty-recovery-payload';
    };
const createSbtContractScripts = contractScripts as unknown as CreateSbtContractScripts;

const DEFAULT_SBT_IMAGE_ARWEAVE_TX = 'h8Z3ZLldhuZafwvUODixAeGZKg8ZBAuwH86UvNzRCuw';
const DEFERRED_DRAFT_CREATE2_SALT_PREFIX = 'draft/';
const buildDeferredDraftCreate2Salt = () =>
  buildCreateSbtDeferredDraftCreate2Salt({
    prefix: DEFERRED_DRAFT_CREATE2_SALT_PREFIX,
    randomBytes: ethers.utils.randomBytes,
  });
const LOCKED_FIELD_MASK = '[encrypted]';
const DEFERRED_MODAL_SURFACE_BG = '#11182c';
const DISTRIBUTION_OPTION_CONFIGS = Object.freeze([
  {
    value: 'hasPasswords',
    label: 'One-use URLs',
    helpText: 'Generate a unique claim link for each participant.',
    tooltipId: 'oneUseTooltip',
    tooltipText: `Generate unique, one-time use links for each member to claim their ${t('sbtLower')}.`,
  },
  {
    value: 'groupPassword',
    label: 'Group Password',
    helpText: 'Share one password with the whole group.',
    tooltipId: 'groupPasswordTooltip',
    tooltipText: 'Create a single shared password for the group.',
  },
  {
    value: 'anyoneCanMint',
    label: 'public URL',
    helpText: 'Anyone with the link can mint.',
    tooltipId: 'anyoneCanMintTooltip',
    tooltipText: `Generate a URL where anyone can ${t('mintLower')} the ${t('sbtLower')}.`,
  },
]);

type DistributionOptionConfig = (typeof DISTRIBUTION_OPTION_CONFIGS)[number];
type SelectableDistributionOptionConfig = DistributionOptionConfig & {
  selected: boolean;
  shouldUseActiveClass: boolean;
};

type CreateSbtSessionConfig = SessionConfig &
  Record<string, unknown> & {
    contracts?: Record<string, unknown>;
    corsWorkerUrl?: unknown;
    networkChainId?: unknown;
    slug?: unknown;
  };
type CreateSbtSessionConfigSources = {
  slug: string;
  sessionConfigOverride: CreateSbtSessionConfig | null;
  resolvedSessionConfig: CreateSbtSessionConfig | null;
};
type CreateSbtChainOption = Record<string, unknown> & {
  id: string | number;
  name: string;
};
type ResolveAuthoringChainIdArgs = {
  selectedChainId?: unknown;
  sessionConfigOverride?: CreateSbtSessionConfig | null;
  resolvedSessionConfig?: CreateSbtSessionConfig | null;
};
type CreateSbtAuthoringChainState = {
  chainId: number | null;
  chain: CreateSbtChainOption | 'not connected';
};
type ArweaveUploadKeyResult = Record<string, unknown> & {
  arweaveJwk?: unknown;
  source?: unknown;
  status?: unknown;
};
type ArweaveUploadRequestOptions = Record<string, unknown> & {
  sessionSlug: string;
  sessionConfig: unknown;
  context: {
    account: unknown;
    providerLike: unknown;
    chainId: number | null;
  };
  skipAuth?: boolean;
  arweaveJwk?: string;
  workerUrl?: string;
  forceDirectArweaveUpload?: boolean;
  adminAuth?: unknown;
};
type ArweaveBootstrapAuthArgs = {
  workerUrl?: string;
};
type EncryptedImageAsset = {
  storage: 'lit-arweave';
  txId: string;
};
type BookmarkCachePayload = Record<string, unknown> & {
  sbts?: unknown[];
};
type CreateSbtTagStateDraft = {
  tags?: unknown[];
  autoAppliedDefaultTags?: unknown[];
  dismissedDefaultTags?: unknown[];
};
type CreateSbtTagKeyEvent = {
  key?: string;
  preventDefault: () => void;
};
type CreateSbtSelectChangeEvent = {
  target: {
    value: unknown;
  };
};
type CreateSbtCollapsibleSectionKey = 'tokenInfoCollapsed' | 'mintOptionsCollapsed' | 'distributionOptionsCollapsed';

type SbtGateBoundary = NonNullable<Parameters<typeof normalizeGateMode>[0]> & Record<string, unknown>;
type LitGateChainId = number | string | null;
type MetadataLockGateOption = {
  id: string;
  gateId?: string;
  label: string;
  displayLabel: string;
  badgeLabel: string;
  secondaryLabel: string;
  color: string;
  mode: ReturnType<typeof normalizeGateMode>;
  requireAll: boolean;
  sbtAddresses: string[];
  sbtAddress: string;
  chainId: LitGateChainId;
  litChain: string;
  resourceKey: string;
  sourceGateId?: string;
  sourceSessionSlug?: string;
  [key: string]: unknown;
};
type MetadataLockGate = MetadataLockGateOption & {
  gateId: string;
  type: unknown;
};
type GateOptionsResult = {
  gateMap: Record<string, MetadataLockGate>;
  gateOptions: MetadataLockGateOption[];
  defaultGateId: string;
};
type BuildGateOptionsFromConfigArgs = {
  sessionConfig?: Record<string, unknown> | null;
  encryptionGates?: unknown[];
  defaultGateId?: unknown;
  chainIdFallback?: unknown;
};
type BuildGateOptionsFromSessionSourcesArgs = {
  sessionSources?: unknown[];
  preferredSessionSlug?: unknown;
  chainIdFallback?: unknown;
};
type LockGatePopoverArgs = {
  lockKey?: unknown;
  fieldKey?: unknown;
  nextOpen?: unknown;
  selectedGateIds?: unknown;
  defaultGateId?: unknown;
  validGateIds?: unknown[];
};
type MetadataLockStateDraft = {
  metadataLockGateIds?: unknown;
  openLockKey?: unknown;
};
type TokenUriMetadataArgs = {
  name?: unknown;
  imageUrl?: unknown;
  description?: unknown;
  metadataSessionSlug?: string;
  tokenTags?: unknown[];
  docIDHashesArray?: unknown[];
  finalDocURLs?: unknown[];
  burnAuth?: unknown;
  networkName?: unknown;
  chainID?: unknown;
  creator?: unknown;
  encryptedFields?: unknown;
  encryptedFieldGates?: unknown;
  encryption?: unknown;
};
type TokenUriMetadata = Record<string, unknown>;
type FieldAccessDescriptorArgs = {
  gateIds?: unknown;
  gateMap?: Record<string, unknown>;
  chainIdFallback?: unknown;
};
type MetadataFieldAccessDescriptor = {
  type: 'sbt';
  gateIds: string[];
  gates: MetadataLockGate[];
  sbtAddresses: string[];
  sbtAddress: string;
  chainId: LitGateChainId;
  litChain: string;
};
type MetadataEncryptionArgs = {
  encryptedFieldGates?: unknown;
  gateMap?: Record<string, unknown>;
  chainIdFallback?: unknown;
  defaultGateId?: unknown;
};
type MetadataEncryptionEnvelope = {
  enabled: true;
  status: 'lit-v1';
  defaultGateId: string;
  gateIds: string[];
  gate: MetadataLockGate | null;
  gates: MetadataLockGate[];
  targets: Record<string, boolean>;
};
type MetadataEncryptionPayload = {
  encryptedFieldGates: Record<string, string | string[]> | null;
  encryption: MetadataEncryptionEnvelope | null;
};
type ResolvedSbtLockGate = SbtGateBoundary & {
  type: unknown;
  gateId: string;
  id: string;
  sbtAddresses: string[];
  sbtAddress: string;
  chainId: LitGateChainId;
  litChain: string;
  mode: ReturnType<typeof normalizeGateMode>;
  label: string;
  color: string;
};
type LitAccessControlCondition = Record<string, unknown>;
type MetadataLockRecipient = {
  accessControlConditions: LitAccessControlCondition[];
  chain: string;
};
type GateObjectsAndRecipientsResult = {
  gates: ResolvedSbtLockGate[];
  recipients: MetadataLockRecipient[];
};
type RequireRecipientsForGateSelectionArgs = {
  gateIds?: unknown;
  recipients?: unknown;
  scopeLabel?: unknown;
};
type EncryptValueWithRecipientsArgs = {
  value?: unknown;
  maskedValue?: unknown;
  contextLabel?: unknown;
  recipients?: unknown;
  chainIdFallback?: unknown;
};
type EncryptValueWithRecipientsResult = {
  value: unknown;
  encrypted: unknown | null;
};
type ImageChooserStatusTone = 'default' | 'error' | 'loading';
type ApplySelectedImageFileOptions = {
  useImageUrl?: boolean;
  statusText?: string;
  statusTone?: ImageChooserStatusTone;
};
type PredictablePasswordListArgs = {
  usesClaimCodes?: unknown;
  targetCount?: unknown;
  allowStateMutation?: boolean;
};
type PredictableDeployShapeArgs = {
  allowStateMutation?: boolean;
};
type PredictableDeployGroupConfig = Record<string, unknown> & {
  contracts?: {
    sbtFactory?: {
      address?: unknown;
      chainId?: unknown;
    };
  };
  networkChainId?: unknown;
  sbtFactoryAddress?: unknown;
};
type PredictableDeployShape = Record<string, unknown> & {
  adminAddress?: string;
  burnAuthEnum?: number;
  contractName?: string;
  create2Salt?: string;
  displayName?: string;
  distributionOption?: unknown;
  groupCfg?: PredictableDeployGroupConfig;
  groupPassword?: string;
  hasPasswordMintOnChain?: boolean;
  hashedPasswords?: string[];
  initializeGroupPasswordHash?: boolean;
  limitedNumber?: number;
  mintingEndTimeUnix?: number;
  mintModeOnChain?: number;
  passwordList?: string[];
  pendingStateUpdate?: boolean;
  symbol?: string;
  unavailableReason?: string;
  usesClaimCodes?: boolean;
  usesInviteCodes?: boolean;
};
type PredictableCreateOptions = Record<string, unknown> & {
  useConfiguredDeterministic?: boolean;
  initializeGroupPasswordHash?: boolean;
};
type PredictableDeployReadyShape = PredictableDeployShape & {
  adminAddress: string;
  burnAuthEnum: number;
  contractName: string;
  create2Salt: string;
  displayName: string;
  groupCfg: PredictableDeployGroupConfig;
  groupPassword: string;
  hasPasswordMintOnChain: boolean;
  hashedPasswords: string[];
  initializeGroupPasswordHash: boolean;
  limitedNumber: number;
  mintingEndTimeUnix: number;
  mintModeOnChain: number;
  passwordList: string[];
  symbol: string;
};
type ResolvePredictableDeployPlanArgs = {
  tokenURI: string;
};
type PredictableDeployPlan = PredictableDeployReadyShape & {
  predictedAddress: string;
  tokenURI: string;
  finalGroupPasswordHash: string;
  createOptions: PredictableCreateOptions;
};
type DeferredDraftMetadataUploadStatus = 'ready' | 'pending-upload';
type CreateSbtDeferredDraftPayload = Record<string, unknown> & {
  id: string;
  predictedAddress: string;
  metadataUploadStatus: DeferredDraftMetadataUploadStatus;
  tokenURI: string;
  createOptions: PredictableCreateOptions;
  authoringPayload: unknown;
  metadataPreview: TokenUriMetadata;
  sessionSlug: string;
  imageUrl: unknown;
};
type ResolvePredictedAddressOptions = {
  allowCached?: boolean;
};
type PredictedAddressResult = {
  predictedAddress: string;
  predictionSignature: string;
};
type RefreshPredictedAddressArgs = {
  requestSeq?: number | null;
};
type CreateSbtDistributionState = Record<string, unknown> & {
  distributionOption?: string;
  isLimited?: boolean;
  limitedNumber?: number | string;
};
type CreateSbtLifecycleState = Record<string, unknown> & {
  create2Salt?: unknown;
  deferredCreate2Salt?: unknown;
  error?: unknown;
  groupHash?: unknown;
  groupPassword?: unknown;
  metadataLockGateIds?: unknown;
  network?: unknown;
  numInviteLinks?: unknown;
  passwordList?: unknown;
  predictableAddressEnabled?: unknown;
  sbtDescription?: unknown;
  sbtDistribution: CreateSbtDistributionState;
  sbtName?: unknown;
};
type CreateSbtValueChangeEvent = {
  target: {
    value: string;
  };
};
type CreateSbtInputChangeEvent = {
  target: {
    checked?: boolean;
    name: string;
    type?: string;
    value: unknown;
  };
};
type CreateSbtGroupProps = Record<string, unknown> & {
  deferredDeploy?: unknown;
};
type FinalizeDeferredCreateSbtDraftUploadArgs = {
  authoringPayload?: unknown;
  componentProps?: Record<string, unknown>;
};
type FinalizeDeferredCreateSbtDraftUploadResult = {
  tokenURI: string;
  metadataPreview: TokenUriMetadata;
  authoringPayload: unknown;
};
type FinalizeDeferredCreateSbtStateUpdate =
  Record<string, unknown> | ((state: Record<string, unknown>) => Record<string, unknown>);
type FinalizeDeferredCreateSbtStateCallback = (() => void) | undefined;
type CreateSbtLitHooks = Record<string, unknown> & {
  connectTimeout?: unknown;
  litNetwork?: unknown;
  providerLike?: unknown;
  resourceAbilityRequests?: unknown;
  saveKey?: (...args: unknown[]) => unknown;
};

const hasUsableSbtFactoryForChain = (chainId: unknown): boolean => {
  return hasUsableCreateSbtFactoryForChain({
    chainId,
    getSessionContractsForChain,
  });
};

const buildGateOptionsFromConfig = buildCreateSbtGateOptionsFromConfig as (
  args?: BuildGateOptionsFromConfigArgs,
) => GateOptionsResult;

const buildGateOptionsFromSessionSources = buildCreateSbtGateOptionsFromSessionSources as (
  args?: BuildGateOptionsFromSessionSourcesArgs,
) => GateOptionsResult;

class CreateSBTGroup extends Component<any, any> {
  _lastSavedCacheJSON: string | null;
  _isMounted: boolean;
  _trackedTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  countdownTimer: ReturnType<typeof setInterval> | null;
  predictAddressTimer: ReturnType<typeof setTimeout> | null;
  _predictAddressRequestSeq: number;
  _predictedAddressShapeSignature: string;
  _autoCreate2SaltForGroupPassword: boolean;
  _suppressFormCachePersistence: boolean;
  _renderDerivationsMemo: { key: string; value: any } | null;
  fileInput: HTMLInputElement | null = null;

  constructor(props: CreateSbtGroupProps) {
    super(props);
    const initialAuthoringChain = this.getAuthoringChainState();
    this.state = buildCreateSbtInitialState({
      account: props.account,
      authoringChain: initialAuthoringChain,
      deferredCreate2SaltBuilder: buildDeferredDraftCreate2Salt,
      deferredDeploy: props.deferredDeploy,
    });

    // internal: avoid redundant writes
    this._lastSavedCacheJSON = null;
    this._isMounted = false;
    this._trackedTimeouts = new Map();
    this.countdownTimer = null;
    this.predictAddressTimer = null;
    this._predictAddressRequestSeq = 0;
    this._predictedAddressShapeSignature = '';
    this._autoCreate2SaltForGroupPassword = false;
    this._suppressFormCachePersistence = false;
    this._renderDerivationsMemo = null;
  }

  /* =========================
   * Cache helpers (sessionStorage)
   * ========================= */
  _fileToDataUrl = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  _dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, data] = dataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(data);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  getNormalizedDocumentUrlDraft = (value: unknown = this.state.documentUrl): string =>
    normalizeCreateSbtDocumentUrlDraft(value);

  getEffectiveDocumentURLs = ({
    documentURLs = this.state.documentURLs,
    documentUrl = this.state.documentUrl,
  }: { documentURLs?: unknown; documentUrl?: unknown } = {}): string[] => {
    return buildEffectiveCreateSbtDocumentUrls({ documentURLs, documentUrl });
  };

  resumeFormCachePersistence = (): void => {
    this._suppressFormCachePersistence = false;
  };

  suppressFormCachePersistenceAfterSuccess = (): void => {
    this._suppressFormCachePersistence = true;
    this.clearFormCache();
  };

  buildCachePayload = (): CreateSbtFormCachePayload => {
    return buildCreateSbtFormCachePayload({
      state: this.state,
      selectedAuthoringChainId: this.getSelectedAuthoringChainId(),
      effectiveSessionSlug: this.getEffectiveSessionSlug() || '',
    });
  };

  _cacheWriteSeq = 0;
  _memoizedImageDataUrl: string | null = null;
  _memoizedImageFileRef: Blob | null = null;

  getScopedFormCacheKey = (): string => getScopedCreateSbtFormCacheKey(this.getEffectiveSessionSlug());

  persistFormCache = (): void => {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      if (this._suppressFormCachePersistence) {
        ++this._cacheWriteSeq;
        return;
      }
      const payload = this.buildCachePayload();
      const imageFile = this.state.sbtImageFile;
      const scopedCacheKey = this.getScopedFormCacheKey();

      const memoizedImageDataUrl = resolveCreateSbtMemoizedImageDataUrl({
        imageFile,
        memoizedImageDataUrl: this._memoizedImageDataUrl,
        memoizedImageFileRef: this._memoizedImageFileRef,
      });
      if (memoizedImageDataUrl) {
        payload._imageDataUrl = memoizedImageDataUrl;
      }

      const json = JSON.stringify(payload);
      if (json !== this._lastSavedCacheJSON) {
        sessionStorage.setItem(scopedCacheKey, json);
        sessionStorage.removeItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY);
        this._lastSavedCacheJSON = json;
      }

      // Async: serialize new image file (only if file ref changed)
      if (imageFile && imageFile !== this._memoizedImageFileRef) {
        const seq = ++this._cacheWriteSeq;
        this._fileToDataUrl(imageFile)
          .then((dataUrl: string) => {
            if (seq !== this._cacheWriteSeq) return; // stale — discard
            this._memoizedImageDataUrl = dataUrl;
            this._memoizedImageFileRef = imageFile;
            try {
              const freshPayload = this.buildCachePayload();
              freshPayload._imageDataUrl = dataUrl;
              const fullJson = JSON.stringify(freshPayload);
              sessionStorage.setItem(scopedCacheKey, fullJson);
              sessionStorage.removeItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY);
              this._lastSavedCacheJSON = fullJson;
            } catch (e) {
              sbtLog.warn('CreateSBTGroup: fallback', e);
            }
          })
          .catch((e: unknown) => {
            sbtLog.warn('CreateSBTGroup: fallback', e);
          });
      } else if (!imageFile) {
        ++this._cacheWriteSeq; // Invalidate any in-flight serialization
        this._memoizedImageDataUrl = null;
        this._memoizedImageFileRef = null;
      }
    } catch (e) {
      sbtLog.warn('CreateSBTGroup: fallback', e);
    }
  };

  buildSerializableAuthoringPayload = async (): Promise<CreateSbtFormCachePayload> => {
    const payload = this.buildCachePayload();
    const imageFile = this.state.sbtImageFile;
    if (!imageFile) return payload;

    const memoizedImageDataUrl = resolveCreateSbtMemoizedImageDataUrl({
      imageFile,
      memoizedImageDataUrl: this._memoizedImageDataUrl,
      memoizedImageFileRef: this._memoizedImageFileRef,
    });
    if (memoizedImageDataUrl) {
      return {
        ...payload,
        _imageDataUrl: memoizedImageDataUrl,
      };
    }

    return {
      ...payload,
      _imageDataUrl: await this._fileToDataUrl(imageFile),
    };
  };

  buildRestoredFormStateFromPayload = (parsedIn: unknown = {}): Record<string, unknown> | null => {
    const parsed = isPlainObject(parsedIn) ? parsedIn : null;
    if (!parsed) return null;

    const { gateOptions } = this.resolveLockGateOptions();
    const validGateIds = getCreateSbtValidGateIds(gateOptions);
    const restoredMetadataLockGateIds = resolveCreateSbtRestoredMetadataLockGateIds({
      parsed,
      gateOptions,
    });

    const distributionPayload = isPlainObject(parsed.sbtDistribution) ? parsed.sbtDistribution : {};
    const cachedNetworkChainId = resolveCreateSbtCachedDistributionChainId(distributionPayload);
    const restoredAuthoringChain = this.getAuthoringChainState({ selectedChainId: cachedNetworkChainId });
    const nextDist = buildCreateSbtRestoredDistributionState({
      currentDistribution: this.state.sbtDistribution,
      distributionPayload,
      restoredAuthoringChain,
    });

    const restoredTags = normalizeCreateSbtRestoredTags(parsed.tags);

    const shouldExpandSections = hasMeaningfulCreateSbtFormPayload({
      ...parsed,
      tags: restoredTags,
      metadataLockGateIds: restoredMetadataLockGateIds,
    });

    return {
      ...buildCreateSbtRestoredScalarState({
        currentExportFormat: this.state.exportFormat,
        currentNumInviteLinks: this.state.numInviteLinks,
        parsed,
      }),
      network: restoredAuthoringChain.chainId || '',
      sbtDistribution: nextDist,
      tags: restoredTags,
      documentUrl: this.getNormalizedDocumentUrlDraft(parsed.documentUrl),
      metadataLockGateIds: normalizeCreateSbtMetadataLockGateIdsForValidGates(
        restoredMetadataLockGateIds,
        validGateIds,
      ),
      lockedImageAsset: null,
      openLockKey: '',
      deferredCreate2Salt: resolveCreateSbtRestoredDeferredCreate2Salt(
        parsed.deferredCreate2Salt,
        this.state.deferredCreate2Salt,
      ),
      predictableAddressEnabled: resolveCreateSbtRestoredPredictableAddressEnabled(
        parsed.predictableAddressEnabled,
        this.state.predictableAddressEnabled,
      ),
      imageLoadError: false,
      sbtImageFile:
        typeof parsed._imageDataUrl === 'string' && parsed._imageDataUrl
          ? this._dataUrlToBlob(parsed._imageDataUrl)
          : null,
      ...buildCreateSbtRestoredCollapseState({
        currentDistributionOptionsCollapsed: this.state.distributionOptionsCollapsed,
        currentMintOptionsCollapsed: this.state.mintOptionsCollapsed,
        shouldExpandSections,
      }),
    };
  };

  applyAuthoringPayload = (parsed: unknown = {}): boolean => {
    const nextState = this.buildRestoredFormStateFromPayload(parsed);
    if (!nextState) return false;
    this.setState(nextState, () => {
      this.updateGroupHash();
    });
    return true;
  };

  loadFormCache = (): boolean => {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return false;
      const scopedCacheKey = this.getScopedFormCacheKey();
      const raw = sessionStorage.getItem(scopedCacheKey) || sessionStorage.getItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY);
      if (!raw) return false;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        // Bad JSON — clear it
        sessionStorage.removeItem(scopedCacheKey);
        sessionStorage.removeItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY);
        return false;
      }
      const parsedRecord = isPlainObject(parsed) ? parsed : null;
      if (!parsedRecord) return false;
      const cachedSlug = String(parsedRecord._sessionSlug || 'general').toLowerCase();
      const currentSlug = (this.getEffectiveSessionSlug() || 'general').toLowerCase();
      if (cachedSlug !== currentSlug) {
        // Session changed — clear stale cache and fall through to defaults
        sessionStorage.removeItem(scopedCacheKey);
        sessionStorage.removeItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY);
        return false;
      }
      try {
        sessionStorage.setItem(scopedCacheKey, raw);
        sessionStorage.removeItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY);
      } catch (e) {
        sbtLog.warn('CreateSBTGroup: fallback', e);
      }
      if (!this.applyAuthoringPayload(parsedRecord)) return false;

      // Keep last snapshot so we don't immediately rewrite
      this._lastSavedCacheJSON = raw;
      return true;
    } catch (e) {
      return false;
    }
  };

  clearFormCache = (): void => {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;

      ++this._cacheWriteSeq;
      sessionStorage.removeItem(LEGACY_CREATE_SBT_FORM_CACHE_KEY);
      sessionStorage.removeItem(this.getScopedFormCacheKey());

      this._lastSavedCacheJSON = null;
    } catch (e) {
      sbtLog.warn('CreateSBTGroup: fallback', e);
    }
  };

  getEffectiveSessionSlug = (): string => {
    return resolveCreateSbtEffectiveSessionSlug({
      props: this.props,
      pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    });
  };

  getActiveLitHooks = (): CreateSbtLitHooks | null =>
    ((this.props.litHooks && typeof this.props.litHooks === 'object' ? this.props.litHooks : null) ||
      getGlobalLitHooks()) as CreateSbtLitHooks | null;

  getSessionConfigSources = (): CreateSbtSessionConfigSources => {
    const slug = this.getEffectiveSessionSlug();
    const sessionConfigOverride = isPlainObject(this.props.sessionConfigOverride)
      ? this.props.sessionConfigOverride
      : isPlainObject(this.props.sessionConfig)
        ? this.props.sessionConfig
        : null;
    const registrySessionConfig = getSessionConfigBySlugOrDefault(slug);
    const resolvedSessionConfig =
      sessionConfigOverride || (isPlainObject(registrySessionConfig) ? registrySessionConfig : null);
    return {
      slug,
      sessionConfigOverride,
      resolvedSessionConfig,
    };
  };

  getAuthoringChainOptions = (): CreateSbtChainOption[] =>
    resolveCreateSbtAuthoringChainOptions({
      getSessionRegistryChains,
      hasUsableSbtFactoryForChain,
    }) as CreateSbtChainOption[];

  resolveAuthoringChainId = ({
    selectedChainId = null,
    sessionConfigOverride = undefined,
    resolvedSessionConfig = undefined,
  }: ResolveAuthoringChainIdArgs = {}): number | null => {
    const sources =
      sessionConfigOverride === undefined || resolvedSessionConfig === undefined
        ? this.getSessionConfigSources()
        : { sessionConfigOverride, resolvedSessionConfig };
    return resolveCreateSbtPreferredAuthoringChainId({
      selectedChainId,
      sessionConfigOverride: sources.sessionConfigOverride,
      resolvedSessionConfig: sources.resolvedSessionConfig,
      network: this.props.network,
      availableChainIds: this.getAuthoringChainOptions().map((chain) => chain.id),
    });
  };

  getSelectedAuthoringChainId = (): number | null =>
    this.resolveAuthoringChainId({ selectedChainId: this.state?.network });

  getSelectedAuthoringChain = (): CreateSbtChainOption | null => {
    const selectedChainId = this.getSelectedAuthoringChainId();
    if (!selectedChainId) return null;
    const selectedChain =
      this.getAuthoringChainOptions().find((chain) => chain.id === selectedChainId) || getChainById(selectedChainId);
    return isPlainObject(selectedChain)
      ? (selectedChain as CreateSbtChainOption)
      : { id: selectedChainId, name: `Chain ${selectedChainId}` };
  };

  getAuthoringChainState = ({
    selectedChainId = null,
    sessionConfigOverride = undefined,
    resolvedSessionConfig = undefined,
  }: ResolveAuthoringChainIdArgs = {}): CreateSbtAuthoringChainState => {
    const chainId = this.resolveAuthoringChainId({
      selectedChainId,
      sessionConfigOverride,
      resolvedSessionConfig,
    });
    return resolveCreateSbtAuthoringChainState({
      chainId,
      chainOptions: this.getAuthoringChainOptions(),
      getChainById,
    }) as CreateSbtAuthoringChainState;
  };

  getSessionConfigForNetwork = (): CreateSbtSessionConfig => {
    const { slug, sessionConfigOverride, resolvedSessionConfig } = this.getSessionConfigSources();
    const networkId = this.resolveAuthoringChainId({
      selectedChainId: this.state?.network,
      sessionConfigOverride,
      resolvedSessionConfig,
    });
    if (!resolvedSessionConfig || networkId === null || !Number.isFinite(networkId) || networkId <= 0) {
      // Keep unresolved requested slugs intact so downstream authoring/mint helpers
      // can stay fail-closed instead of silently inheriting the general session.
      return (resolvedSessionConfig || slug || '') as CreateSbtSessionConfig;
    }

    const contracts = buildCreateSbtAuthoringContractRefs({
      getSessionContractsForChain,
      sessionConfig: resolvedSessionConfig,
      resolveSessionContractRef,
      networkId,
    });

    return {
      ...resolvedSessionConfig,
      networkChainId: networkId,
      sbtFactoryAddress: getConfiguredContractAddress(contracts?.sbtFactory),
      contracts,
    };
  };

  getArweaveUploadSessionSlug = (): string => {
    const sessionConfig = this.getSessionConfigForNetwork();
    return toStr(this.getEffectiveSessionSlug() || sessionConfig?.slug || '').trim();
  };

  getResolvedArweaveUploadWorkerUrl = (): string => {
    const sessionConfig = this.getSessionConfigForNetwork();
    return normalizeWorkerUrl(toStr(sessionConfig?.corsWorkerUrl).trim());
  };

  getArweaveUploadRequestOptions = (): ArweaveUploadRequestOptions => {
    const sessionConfig = this.getSessionConfigForNetwork();
    const authoringChainId = normalizePositiveChainId(
      sessionConfig?.networkChainId ||
        this.getSelectedAuthoringChainId() ||
        this.props.network?.id ||
        this.props.network?.chainId,
    );
    return {
      sessionSlug: toStr(this.getEffectiveSessionSlug() || sessionConfig?.slug || '').trim(),
      sessionConfig,
      context: {
        account: this.props.account,
        providerLike: this.props.provider,
        chainId: authoringChainId,
      },
      skipAuth: this.shouldSkipArweaveWorkerAuth(),
    };
  };

  getEffectiveArweaveUploadKey = async (): Promise<ArweaveUploadKeyResult> => {
    const override = toStr(this.props.arweaveJwkOverride).trim();
    if (override) {
      return {
        arweaveJwk: override,
        source: 'override',
        status: 'override',
      };
    }
    return getEffectiveArweaveKey({
      sessionSlug: this.getArweaveUploadSessionSlug(),
      sessionConfig: this.getSessionConfigForNetwork(),
      context: {
        account: this.props.account,
        providerLike: this.props.provider,
        chainId: normalizePositiveChainId(
          this.getSessionConfigForNetwork()?.networkChainId ||
            this.getSelectedAuthoringChainId() ||
            this.props.network?.id ||
            this.props.network?.chainId,
        ),
      },
    }) as Promise<ArweaveUploadKeyResult>;
  };

  shouldSkipArweaveWorkerAuth = (): boolean => toStr(this.props.arweaveJwkOverride).trim() !== '';

  getArweaveUploadBootstrapAuth = async ({ workerUrl = '' }: ArweaveBootstrapAuthArgs = {}): Promise<Record<
    string,
    unknown
  > | null> => {
    if (!this.shouldSkipArweaveWorkerAuth()) return null;
    if (typeof this.props.signAdminAction !== 'function') {
      throw new Error('Arweave bootstrap signing is unavailable for this draft upload.');
    }
    const sessionConfig = this.getSessionConfigForNetwork();
    const sessionSlug = toStr(this.getEffectiveSessionSlug() || sessionConfig?.slug || '').trim();
    return this.props.signAdminAction({
      statement: 'Admin request: bootstrap arweave upload',
      targetSlug: sessionSlug,
      workerUrl: workerUrl || this.getResolvedArweaveUploadWorkerUrl(),
    }) as Promise<Record<string, unknown> | null>;
  };

  buildArweaveUploadRequestOptions = async (): Promise<ArweaveUploadRequestOptions> => {
    const baseOptions = this.getArweaveUploadRequestOptions();
    if (!this.shouldSkipArweaveWorkerAuth()) return baseOptions;
    const workerUrl = this.getResolvedArweaveUploadWorkerUrl();
    const arweaveJwk = toStr(this.props.arweaveJwkOverride).trim();

    return {
      ...baseOptions,
      // Regression guard: deferred /new publish should still finish when a
      // just-deployed worker cannot serve bootstrap auth yet but the sponsored
      // Arweave JWK is already available in wizard state.
      ...(await resolvePublishArweaveUploadOptions({
        arweaveJwk,
        workerUrl,
        preferDirectArweaveUpload: this.props.preferDirectArweaveUpload === true,
        allowDirectFallbackOnBootstrapFailure: true,
        requireAdminAuthWithoutJwk: false,
        missingAdminAuthMessage: 'Arweave bootstrap signing is unavailable for this draft upload.',
        buildAdminAuth: ({ workerUrl: resolvedWorkerUrl }) =>
          this.getArweaveUploadBootstrapAuth({
            workerUrl: resolvedWorkerUrl,
          }),
      })),
    };
  };

  resolveLockGateOptions = (): GateOptionsResult => {
    const lockGateSessionSources = Array.isArray(this.props.lockGateSessionSources)
      ? this.props.lockGateSessionSources
      : [];
    const sessionConfig = this.getSessionConfigForNetwork();
    const chainIdFallback =
      this.getSelectedAuthoringChainId() ||
      Number(sessionConfig?.networkChainId || this.props.network?.id || this.props.network?.chainId || 0) ||
      null;
    if (lockGateSessionSources.length > 0) {
      return buildGateOptionsFromSessionSources({
        sessionSources: lockGateSessionSources,
        preferredSessionSlug: this.props.lockGatePreferredSessionSlug || this.getEffectiveSessionSlug(),
        chainIdFallback,
      });
    }
    return buildGateOptionsFromConfig({
      sessionConfig: isPlainObject(sessionConfig) ? sessionConfig : {},
      encryptionGates: Array.isArray(this.props.encryptionGates) ? this.props.encryptionGates : [],
      defaultGateId: this.props.defaultGateId || '',
      chainIdFallback,
    });
  };

  getMetadataEncryptionContextBase = (): string => {
    const slug = normalizeSessionSlug(this.getEffectiveSessionSlug() || '');
    const hashSuffix = String(this.state.groupHash || '')
      .replace(/^0x/i, '')
      .slice(0, 12);
    if (slug && hashSuffix) return `${slug}:${hashSuffix}`;
    if (hashSuffix) return `group:${hashSuffix}`;
    return slug || 'group';
  };

  getMetadataLockGateIds = (fieldKey = ''): string[] =>
    getMetadataFieldLockGateIds(this.state.metadataLockGateIds, fieldKey);

  normalizeSelectedGateIds = (value: unknown, validGateIds: unknown[] = []): string[] => {
    const normalized = normalizeGateIds(value);
    if (!Array.isArray(validGateIds) || validGateIds.length === 0) return normalized;
    const validGateSet = new Set<unknown>(validGateIds);
    return normalized.filter((gateId) => validGateSet.has(gateId));
  };

  setLockGateIds = (fieldKey: string, nextIds: unknown, validGateIds: unknown[] = []): void => {
    this.resetFormStateForEdit();
    this.setState(
      (prev: MetadataLockStateDraft) =>
        buildCreateSbtMetadataLockSelectionPatch({
          fieldKey,
          metadataLockGateIds: prev.metadataLockGateIds,
          openLockKey: prev.openLockKey,
          selectedGateIds: nextIds,
          validGateIds,
        }),
      () => {
        this.updateGroupHash();
        this.persistFormCache();
      },
    );
  };

  toggleLockPopover = ({
    lockKey,
    fieldKey,
    nextOpen,
    selectedGateIds = [],
    defaultGateId = '',
    validGateIds = [],
  }: LockGatePopoverArgs = {}): void => {
    if (!nextOpen) {
      this.setState(buildCreateSbtOpenLockKeyPatch());
      return;
    }

    const normalizedSelected = this.normalizeSelectedGateIds(selectedGateIds, validGateIds);
    const fallbackGateIds = this.normalizeSelectedGateIds(defaultGateId ? [defaultGateId] : [], validGateIds);
    if (normalizedSelected.length === 0 && fallbackGateIds.length > 0) {
      this.resetFormStateForEdit();
      this.setState(
        buildCreateSbtMetadataLockFallbackPatch({
          fallbackGateIds,
          fieldKey,
          lockKey,
          metadataLockGateIds: this.state.metadataLockGateIds,
        }),
        () => {
          this.updateGroupHash();
          this.persistFormCache();
        },
      );
      return;
    }

    this.setState(buildCreateSbtOpenLockKeyPatch({ lockKey }));
  };

  buildGateObjectsAndRecipients = (
    gateIds: unknown,
    gateMap: Record<string, unknown> = {},
    chainIdFallback: unknown = null,
  ): GateObjectsAndRecipientsResult => {
    return buildCreateSbtGateObjectsAndRecipients({
      gateIds,
      gateMap,
      chainIdFallback,
    }) as GateObjectsAndRecipientsResult;
  };

  requireRecipientsForGateSelection = ({
    gateIds,
    recipients,
    scopeLabel,
  }: RequireRecipientsForGateSelectionArgs = {}): void => {
    requireCreateSbtRecipientsForGateSelection({
      gateIds,
      recipients,
      scopeLabel,
      gateLowerLabel: t('gateLower'),
      gatesLowerLabel: t('gatesLower'),
    });
  };

  encryptValueWithRecipients = async ({
    value,
    maskedValue,
    contextLabel,
    recipients,
    chainIdFallback = null,
  }: EncryptValueWithRecipientsArgs = {}): Promise<EncryptValueWithRecipientsResult> => {
    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0);
    if (isEmpty) return { value, encrypted: null };

    const litHooks = this.getActiveLitHooks();
    if (!litHooks || typeof litHooks.saveKey !== 'function') {
      throw new Error(`Lit hooks not initialized; connect a ${t('walletLower')} to encrypt.`);
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error(`Selected ${t('gateLower')} does not provide any Lit recipients.`);
    }

    const recipientAccess = buildCreateSbtRecipientAccessControlState({ recipients });

    const envelope = await cryptoUtils.encryptEnvelopeValue(value, {
      providerLike: this.props.provider,
      account: this.props.account,
      chainId: chainIdFallback,
      contextLabel,
      lit: {
        saveKey: litHooks.saveKey,
        accessControlConditions: recipientAccess.combinedAccessControlConditions.length
          ? recipientAccess.combinedAccessControlConditions
          : recipientAccess.primaryAccessControlConditions,
        chain: recipientAccess.primaryChain,
        ...(litHooks.litNetwork ? { litNetwork: litHooks.litNetwork } : {}),
        ...(litHooks.connectTimeout ? { connectTimeout: litHooks.connectTimeout } : {}),
        ...(litHooks.providerLike ? { providerLike: litHooks.providerLike } : {}),
        ...(litHooks.resourceAbilityRequests ? { resourceAbilityRequests: litHooks.resourceAbilityRequests } : {}),
        recipients,
      },
    });

    return { value: maskedValue, encrypted: envelope };
  };

  buildEncryptedImageAsset = ({
    uploadResult = {},
  }: {
    uploadResult?: (Record<string, unknown> & { txId?: unknown }) | null;
  } = {}): EncryptedImageAsset | null => {
    return buildCreateSbtEncryptedImageAsset({ uploadResult }) as EncryptedImageAsset | null;
  };

  buildPreviewEncryptedImageAsset = (): EncryptedImageAsset =>
    buildCreateSbtPreviewEncryptedImageAsset(LOCKED_FIELD_MASK) as EncryptedImageAsset;

  buildFieldAccessDescriptor = ({
    gateIds = [],
    gateMap = {},
    chainIdFallback = null,
  }: FieldAccessDescriptorArgs = {}): MetadataFieldAccessDescriptor | null => {
    return buildCreateSbtFieldAccessDescriptor({
      gateIds,
      gateMap,
      chainIdFallback,
    }) as MetadataFieldAccessDescriptor | null;
  };

  buildMetadataEncryption = ({
    encryptedFieldGates = {},
    gateMap = {},
    chainIdFallback = null,
    defaultGateId = '',
  }: MetadataEncryptionArgs = {}): MetadataEncryptionPayload => {
    return buildCreateSbtMetadataEncryption({
      encryptedFieldGates,
      gateMap,
      chainIdFallback,
      defaultGateId,
    }) as MetadataEncryptionPayload;
  };

  componentDidMount() {
    this._isMounted = true;
    this.loadFormCache();
    this.loadBookmarks();
    this.schedulePredictedAddressRefresh();
  }

  componentDidUpdate(prevProps: Record<string, unknown>, prevState: CreateSbtLifecycleState): void {
    const authoringContextChanged =
      this.props.network !== prevProps.network ||
      this.props.sessionConfigOverride !== prevProps.sessionConfigOverride ||
      this.props.sessionConfig !== prevProps.sessionConfig ||
      this.props.sessionSlug !== prevProps.sessionSlug ||
      this.props.slug !== prevProps.slug;
    const lockAudienceChanged =
      authoringContextChanged ||
      prevState.network !== this.state.network ||
      prevState.sbtDistribution?.network !== this.state.sbtDistribution?.network ||
      this.props.encryptionGates !== prevProps.encryptionGates ||
      this.props.defaultGateId !== prevProps.defaultGateId ||
      this.props.lockGateSessionSources !== prevProps.lockGateSessionSources ||
      this.props.lockGatePreferredSessionSlug !== prevProps.lockGatePreferredSessionSlug;
    if (authoringContextChanged) {
      const syncedChain = this.getAuthoringChainState({ selectedChainId: this.state.network });
      const chainSyncPatch = buildCreateSbtAuthoringChainSyncPatch({
        currentDistributionNetwork: this.state.sbtDistribution?.network,
        currentNetwork: this.state.network,
        syncedAuthoringChain: syncedChain,
      });
      if (chainSyncPatch) {
        this.setState((currentState: { sbtDistribution: Record<string, unknown> }) =>
          buildCreateSbtAuthoringChainSyncStatePatch({
            currentDistribution: currentState.sbtDistribution,
            syncPatch: chainSyncPatch,
          }),
        );
        return;
      }
    }
    if (lockAudienceChanged) {
      const validGateIds = Object.keys(this.resolveLockGateOptions().gateMap || {});
      const normalizedLocks = normalizeMetadataLockGateIds(this.state.metadataLockGateIds);
      const scrubbedLocks = normalizeCreateSbtMetadataLockGateIdsForValidGates(normalizedLocks, validGateIds);
      if (!areMetadataLockGateMapsEqual(normalizedLocks, scrubbedLocks)) {
        this.setState(buildCreateSbtMetadataLockGateIdsPatch({ metadataLockGateIds: scrubbedLocks }));
        return;
      }
    }
    const accountDistributionPatch = buildCreateSbtAccountDistributionSyncPatch({
      currentDistribution: this.state.sbtDistribution,
      nextAccount: this.props.account,
      prevAccount: prevProps.account,
    });
    if (accountDistributionPatch) {
      this.setState((currentState: { sbtDistribution: Record<string, unknown> }) =>
        buildCreateSbtAccountDistributionSyncStatePatch({
          currentDistribution: currentState.sbtDistribution,
          syncPatch: accountDistributionPatch,
        }),
      );
      return;
    }
    if (prevProps.defaultSbtTags !== this.props.defaultSbtTags) {
      this.syncRelevantDefaultTags({ replaceAutoApplied: true, resetDismissed: true });
    }

    if (this.state.sbtName !== prevState.sbtName || this.state.sbtDescription !== prevState.sbtDescription) {
      this.syncRelevantDefaultTags();
    }

    if (
      this.state.sbtDistribution.isLimited !== prevState.sbtDistribution.isLimited ||
      this.state.sbtDistribution.limitedNumber !== prevState.sbtDistribution.limitedNumber
    ) {
      this.updateNumInviteLinks();
    }
    if (this.maybeClearAutoPredictableAddressForGroupPasswordExit(prevState)) {
      return;
    }
    if (this.maybeAutoEnablePredictableAddressForGroupPassword(prevState)) {
      return;
    }

    // Log when error message changes
    if (this.state.error && this.state.error !== prevState.error) {
      sbtLog.error('[CreateSBTGroup] Error:', this.state.error);
    }

    // Ensure any missed changes still get cached (no-op if unchanged)
    this.persistFormCache();

    const predictiveInputsChanged =
      prevState.sbtName !== this.state.sbtName ||
      prevState.create2Salt !== this.state.create2Salt ||
      prevState.deferredCreate2Salt !== this.state.deferredCreate2Salt ||
      prevState.predictableAddressEnabled !== this.state.predictableAddressEnabled ||
      prevState.groupHash !== this.state.groupHash ||
      prevState.groupPassword !== this.state.groupPassword ||
      prevState.numInviteLinks !== this.state.numInviteLinks ||
      prevState.passwordList !== this.state.passwordList ||
      prevState.metadataLockGateIds !== this.state.metadataLockGateIds ||
      prevState.sbtDistribution !== this.state.sbtDistribution ||
      prevProps.account !== this.props.account ||
      prevProps.network !== this.props.network ||
      prevProps.provider !== this.props.provider ||
      prevProps.deferredDeploy !== this.props.deferredDeploy;
    if (predictiveInputsChanged) {
      this.schedulePredictedAddressRefresh();
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    this.clearCountdownTimer();
    this.clearTrackedTimeouts();
    this.clearPredictAddressTimer();
  }

  clearCountdownTimer = (): void => {
    if (!this.countdownTimer) return;
    clearInterval(this.countdownTimer);
    this.countdownTimer = null;
  };

  scheduleTrackedStateReset = (timerKey: string, nextState: Record<string, unknown>, delayMs: unknown): void => {
    if (!timerKey) return;
    const existing = this._trackedTimeouts.get(timerKey);
    if (existing) {
      clearTimeout(existing);
      this._trackedTimeouts.delete(timerKey);
    }
    const timeoutId = setTimeout(
      () => {
        if (this._trackedTimeouts.get(timerKey) === timeoutId) {
          this._trackedTimeouts.delete(timerKey);
        }
        if (!this._isMounted) return;
        this.setState(nextState);
      },
      Math.max(0, Number(delayMs) || 0),
    );
    this._trackedTimeouts.set(timerKey, timeoutId);
  };

  clearTrackedTimeouts = (): void => {
    if (!this._trackedTimeouts || this._trackedTimeouts.size === 0) return;
    this._trackedTimeouts.forEach((timeoutId: ReturnType<typeof setTimeout>) => clearTimeout(timeoutId));
    this._trackedTimeouts.clear();
  };

  clearPredictAddressTimer = (): void => {
    if (!this.predictAddressTimer) return;
    clearTimeout(this.predictAddressTimer);
    this.predictAddressTimer = null;
  };

  setStateAsync = (update: Parameters<CreateSBTGroup['setState']>[0]): Promise<void> =>
    new Promise((resolve) => this.setState(update, () => resolve()));

  isDeferredDeployMode = (): boolean => !!this.props.deferredDeploy;

  isPredictableAddressEnabled = (): boolean =>
    resolveCreateSbtPredictableAddressActive({
      create2Salt: this.state.create2Salt,
      deferredDeployMode: this.isDeferredDeployMode(),
      predictableAddressEnabled: this.state.predictableAddressEnabled,
    });

  maybeClearAutoPredictableAddressForGroupPasswordExit = (prevState: CreateSbtLifecycleState): boolean => {
    const prevDistributionOption = prevState?.sbtDistribution?.distributionOption;
    const nextDistributionOption = this.state.sbtDistribution?.distributionOption;
    const exitPatch = buildCreateSbtGroupPasswordPredictableExitPatch({
      autoCreate2SaltForGroupPassword: this._autoCreate2SaltForGroupPassword,
      nextDistributionOption,
      prevDistributionOption,
    });
    if (!exitPatch) return false;

    this._autoCreate2SaltForGroupPassword = false;
    this.setState(exitPatch, this.persistFormCache);
    return true;
  };

  maybeAutoEnablePredictableAddressForGroupPassword = (prevState: CreateSbtLifecycleState): boolean => {
    const prevDistributionOption = prevState?.sbtDistribution?.distributionOption;
    const nextDistributionOption = this.state.sbtDistribution?.distributionOption;
    const autoSalt = this.buildAutoCreate2SaltSource();
    const entryPatch = buildCreateSbtGroupPasswordPredictableEntryPatch({
      autoSalt,
      isDeferredDeployMode: this.isDeferredDeployMode(),
      isPredictableAddressEnabled: this.isPredictableAddressEnabled(),
      nextDistributionOption,
      prevDistributionOption,
    });
    if (!entryPatch) return false;

    // Group-password hashes must stay scoped to the deterministic SBT address.
    this._autoCreate2SaltForGroupPassword = true;
    this.setState(entryPatch, this.persistFormCache);
    return true;
  };

  shouldHideNetworkSelector = (): boolean =>
    shouldHideCreateSbtNetworkSelector({
      deferredDeploy: this.props.deferredDeploy,
      hideNetworkSelector: this.props.hideNetworkSelector,
    });

  buildAutoCreate2SaltSource = (): string => {
    return buildCreateSbtAutoCreate2SaltSource({
      groupHash: this.state.groupHash,
      sbtName: this.state.sbtName,
      sessionSlug: this.getEffectiveSessionSlug(),
    });
  };

  getAutoCreate2SaltSource = (): string => {
    if (this.isDeferredDeployMode()) {
      return String(this.state.deferredCreate2Salt || '').trim() || this.buildAutoCreate2SaltSource();
    }
    return this.buildAutoCreate2SaltSource();
  };

  getResolvedCreate2SaltSource = (): string => {
    const manual = String(this.state.create2Salt || '').trim();
    if (manual) return manual;
    return this.getAutoCreate2SaltSource();
  };

  buildDeterministicSbtSymbol = (saltSource: unknown = ''): string => {
    return buildCreateSbtDeterministicSymbol({
      digest: ethers.utils.id,
      saltSource,
    });
  };

  ensurePredictablePasswordList = ({
    usesClaimCodes,
    targetCount,
    allowStateMutation = true,
  }: PredictablePasswordListArgs = {}): string[] | null => {
    const decision = resolveCreateSbtPredictablePasswordListDecision({
      allowStateMutation,
      generatePassword: this.generateRandomString,
      passwordList: this.state.passwordList,
      targetCount,
      usesClaimCodes,
    });
    if (decision.shouldUpdatePasswordList) {
      this.setState(buildCreateSbtPasswordListPatch({ passwordList: decision.passwordListPatch }));
    }
    return decision.returnValue;
  };

  buildPredictableDeployShape = ({
    allowStateMutation = true,
  }: PredictableDeployShapeArgs = {}): PredictableDeployShape | null => {
    if (!this.isPredictableAddressEnabled()) return null;

    const {
      sbtName,
      sbtDistribution,
      numInviteLinks,
      groupPassword: rawGroupPassword,
      metadataLockGateIds,
    } = this.state;
    const { isLimited, limitedNumber, burnAdmin, isTimeLimited, burnAuth, distributionOption, mintingEndTime } =
      sbtDistribution || {};
    const { adminAddress, limitedCount, sbtNameTrimmed, unavailableReason } =
      resolveCreateSbtPredictableDeployBaseState({
        account: this.props.account,
        burnAdmin,
        isLimited,
        limitedNumber,
        sbtName,
        walletLowerLabel: t('walletLower'),
      });
    if (unavailableReason) return { unavailableReason };

    const mintModeOnChain = deriveSbtMintModeFromDistribution({ distributionOption, isLimited: !!isLimited });
    const usesClaimCodes = usesClaimPasswordsForSbtMintMode(mintModeOnChain);
    const usesInviteCodes = usesInviteCodesForSbtMintMode(mintModeOnChain);
    const hasPasswordMintOnChain = hasPasswordMintForSbtMintMode(mintModeOnChain);

    const targetPasswordCount = usesClaimCodes
      ? isLimited && limitedCount > 0
        ? limitedCount
        : Math.max(1, Number(numInviteLinks || 0) || 0)
      : 0;
    const passwordList = this.ensurePredictablePasswordList({
      usesClaimCodes,
      targetCount: targetPasswordCount,
      allowStateMutation,
    });
    if (usesClaimCodes && passwordList === null) {
      return {
        unavailableReason: 'Generating invite codes…',
        pendingStateUpdate: allowStateMutation,
      };
    }
    const resolvedPasswordList = Array.isArray(passwordList) ? passwordList : [];

    const create2Salt = this.getResolvedCreate2SaltSource();
    const symbol = this.buildDeterministicSbtSymbol(create2Salt);
    const nameLocked = getMetadataFieldLockGateIds(metadataLockGateIds, 'name').length > 0;
    const contractName = nameLocked ? symbol : sbtNameTrimmed;
    const burnAuthEnum = this.getBurnAuthEnum(burnAuth);
    const hashedPasswords = usesClaimCodes
      ? resolvedPasswordList.map((password) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password)))
      : [];
    const groupPassword = cryptoUtils.normalizeGroupPasswordInput(rawGroupPassword);
    if (distributionOption === 'groupPassword' && !groupPassword) {
      return { unavailableReason: 'Enter a group password to preview the address.' };
    }

    return {
      contractName,
      displayName: sbtNameTrimmed,
      symbol,
      limitedNumber: isLimited ? limitedCount : 0,
      adminAddress,
      mintingEndTimeUnix: isTimeLimited && mintingEndTime ? Math.floor(new Date(mintingEndTime).getTime() / 1000) : 0,
      mintModeOnChain,
      hasPasswordMintOnChain,
      burnAuthEnum,
      hashedPasswords,
      passwordList: resolvedPasswordList,
      distributionOption,
      groupPassword,
      create2Salt,
      initializeGroupPasswordHash: distributionOption === 'groupPassword',
      usesClaimCodes,
      usesInviteCodes,
      groupCfg: this.getSessionConfigForNetwork(),
    };
  };

  getPredictedAddressDisplayText = (): string => {
    const predictedAddress = String(this.state.predictedAddress || '').trim();
    if (predictedAddress || this.state.predictedAddressBusy) {
      return resolveCreateSbtPredictedAddressDisplayText({
        predictedAddress,
        predictedAddressBusy: this.state.predictedAddressBusy,
      });
    }

    const predictionShape = this.buildPredictableDeployShape({ allowStateMutation: false });
    return resolveCreateSbtPredictedAddressDisplayText({
      predictedAddress,
      unavailableReason: predictionShape?.unavailableReason,
      walletLowerLabel: t('walletLower'),
    });
  };

  buildPredictableDeploySignature = (predictionShape: PredictableDeployShape | null): string => {
    return buildCreateSbtPredictableDeploySignature({
      network: this.props.network,
      predictionShape,
      selectedAuthoringChainId: this.getSelectedAuthoringChainId(),
    });
  };

  resolvePredictedAddressForShape = async (
    predictionShape: PredictableDeployShape,
    { allowCached = true }: ResolvePredictedAddressOptions = {},
  ): Promise<PredictedAddressResult> => {
    const predictionSignature = this.buildPredictableDeploySignature(predictionShape);
    const cachedResult = resolveCreateSbtPredictedAddressCacheHit({
      allowCached,
      cachedShapeSignature: this._predictedAddressShapeSignature,
      predictedAddress: this.state.predictedAddress,
      predictionSignature,
    });
    if (cachedResult) return cachedResult;

    const predictedAddress = await createSbtContractScripts.predictSBTAddress(
      this.props.provider || 'none',
      predictionShape.contractName,
      predictionShape.symbol,
      predictionShape.limitedNumber,
      predictionShape.adminAddress,
      predictionShape.mintingEndTimeUnix,
      predictionShape.hasPasswordMintOnChain,
      predictionShape.burnAuthEnum,
      predictionShape.hashedPasswords,
      '',
      ethers.constants.HashZero,
      predictionShape.groupCfg,
      predictionShape.create2Salt,
      {
        useConfiguredDeterministic: true,
        initializeGroupPasswordHash: predictionShape.initializeGroupPasswordHash,
      },
    );

    return {
      predictedAddress: String(predictedAddress || '').trim(),
      predictionSignature,
    };
  };

  refreshPredictedAddress = async ({ requestSeq = null }: RefreshPredictedAddressArgs = {}): Promise<void> => {
    const activeRequestSeq = requestSeq == null ? (this._predictAddressRequestSeq += 1) : requestSeq;
    const predictionShape = this.buildPredictableDeployShape();
    if (!predictionShape) {
      if (activeRequestSeq !== this._predictAddressRequestSeq) return;
      this._predictedAddressShapeSignature = '';
      this.setState(
        buildCreateSbtPredictedAddressPatch({
          predictedAddress: '',
          predictedAddressStatus: '',
          predictedAddressBusy: false,
        }),
      );
      return;
    }
    if (predictionShape.pendingStateUpdate) return;
    if (predictionShape.unavailableReason) {
      if (activeRequestSeq !== this._predictAddressRequestSeq) return;
      this._predictedAddressShapeSignature = '';
      this.setState(
        buildCreateSbtPredictedAddressPatch({
          predictedAddress: '',
          predictedAddressStatus: predictionShape.unavailableReason,
          predictedAddressBusy: false,
        }),
      );
      return;
    }

    this.setState(buildCreateSbtPredictedAddressBusyPatch());
    try {
      const { predictedAddress, predictionSignature } = await this.resolvePredictedAddressForShape(predictionShape, {
        allowCached: false,
      });
      if (activeRequestSeq !== this._predictAddressRequestSeq || !this._isMounted) return;
      // Regression guard: older async predictions can resolve after later edits.
      // Only the latest request may publish a preview as authoritative.
      this._predictedAddressShapeSignature = predictionSignature;
      this.setState(
        buildCreateSbtPredictedAddressPatch({
          predictedAddress,
          predictedAddressStatus: predictedAddress ? '' : `No ${t('sbt')} factory configured for this session.`,
          predictedAddressBusy: false,
        }),
      );
    } catch (error) {
      if (activeRequestSeq !== this._predictAddressRequestSeq || !this._isMounted) return;
      this._predictedAddressShapeSignature = '';
      this.setState(
        buildCreateSbtPredictedAddressPatch({
          predictedAddress: '',
          predictedAddressStatus: getErrorMessage(error, 'Unable to calculate the predicted address.'),
          predictedAddressBusy: false,
        }),
      );
    }
  };

  schedulePredictedAddressRefresh = (): void => {
    this.clearPredictAddressTimer();
    this._predictedAddressShapeSignature = '';
    if (!this.isPredictableAddressEnabled()) {
      this._predictAddressRequestSeq += 1;
      this.setState(
        buildCreateSbtPredictedAddressPatch({
          predictedAddress: '',
          predictedAddressStatus: '',
          predictedAddressBusy: false,
        }),
      );
      return;
    }
    const requestSeq = ++this._predictAddressRequestSeq;
    this.predictAddressTimer = setTimeout(() => {
      this.predictAddressTimer = null;
      void this.refreshPredictedAddress({ requestSeq });
    }, 250);
  };

  /* =========================
   * UX / State Helpers
   * ========================= */

  getBookmarksSlug = (): string => (this.props.sessionSlug == null ? '' : String(this.props.sessionSlug));

  loadBookmarks = (): void => {
    try {
      const parsedRaw = peekCacheSync('bookmarksCache', this.getBookmarksSlug(), { clone: false });
      const parsed = isPlainObject(parsedRaw) ? (parsedRaw as BookmarkCachePayload) : { sbts: [] };
      // Handle legacy cache structure or missing keys
      const list = Array.isArray(parsed.sbts) ? parsed.sbts : [];
      const s = new Set<string>(list.map((x) => String(x).toLowerCase()));
      this.setState(buildCreateSbtBookmarkedSbtsSetPatch({ bookmarkedSbtsSet: s }));
    } catch {
      this.setState(buildCreateSbtBookmarkedSbtsSetPatch());
    }
  };

  bookmarkSBT = (sbtAddress: unknown): void => {
    if (!sbtAddress) return;
    let bookmarksCache: BookmarkCachePayload;
    try {
      const parsed = peekCacheSync('bookmarksCache', this.getBookmarksSlug(), { clone: false });
      bookmarksCache = isPlainObject(parsed)
        ? {
            ...parsed,
            sbts: Array.isArray(parsed.sbts) ? [...parsed.sbts] : [],
          }
        : {};
    } catch {
      bookmarksCache = {};
    }

    if (!Array.isArray(bookmarksCache.sbts)) bookmarksCache.sbts = [];

    const idL = String(sbtAddress).toLowerCase();
    const set = new Set<string>(this.state.bookmarkedSbtsSet);

    if (set.has(idL)) {
      set.delete(idL);
      bookmarksCache.sbts = bookmarksCache.sbts.filter((x) => String(x).toLowerCase() !== idL);
    } else {
      set.add(idL);
      bookmarksCache.sbts = Array.from(new Set([...bookmarksCache.sbts, idL]));
    }

    void writeCache('bookmarksCache', this.getBookmarksSlug(), bookmarksCache as never);
    this.setState(buildCreateSbtBookmarkedSbtsSetPatch({ bookmarkedSbtsSet: set }));
  };

  // Helper to parse default tags from props
  getDefaultTags = (): string[] => {
    return parseDefaultSbtTags(this.props.defaultSbtTags);
  };

  getRelevantDefaultTags = (): string[] =>
    getRelevantDefaultTags([this.state.sbtName, this.state.sbtDescription], this.getDefaultTags());

  buildUniqueTags = (rawTags: unknown = []): string[] => {
    return buildUniqueTagList(rawTags);
  };

  syncRelevantDefaultTags = ({
    resetDismissed = false,
  }: { resetDismissed?: boolean; replaceAutoApplied?: boolean } = {}): void => {
    const next = buildCreateSbtRelevantDefaultTagSyncState({
      autoAppliedDefaultTags: this.state.autoAppliedDefaultTags || [],
      currentShowTagsInput: this.state.showTagsInput,
      dismissedDefaultTags: this.state.dismissedDefaultTags || [],
      relevantDefaults: this.getRelevantDefaultTags(),
      resetDismissed,
      tags: this.state.tags,
    });

    if (!next.shouldUpdate) {
      return;
    }

    this.setState(buildCreateSbtRelevantDefaultTagSyncPatch(next));
  };

  resetForm = (): void => {
    const nextAuthoringChain = this.getAuthoringChainState();
    this.resumeFormCachePersistence();
    this.clearFormCache();
    this._autoCreate2SaltForGroupPassword = false;

    this.setState(
      buildCreateSbtResetFormState({
        account: this.props.account,
        authoringChain: nextAuthoringChain,
        deferredCreate2SaltBuilder: buildDeferredDraftCreate2Salt,
        deferredDeploy: this.props.deferredDeploy,
      }),
      () => {
        this.updateGroupHash();
      },
    );
  };

  resetFormStateForEdit = (): void => {
    this.resumeFormCachePersistence();
    if (this.state.sbtMinted) {
      this.setState(buildCreateSbtEditResetPatch());
    }
  };

  toggleShowJson = (): void => {
    this.setState((prevState: Record<string, unknown>) =>
      buildCreateSbtBooleanTogglePatch({
        state: prevState,
        stateKey: 'showJson',
      }),
    );
  };

  buildSessionAutoJoinUrl = (sbtAddressOverride: unknown = null): string => {
    const sbtAddress = String(sbtAddressOverride || this.state?.sbtAddress || '').trim();
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? String(window.location.origin).replace(/\/+$/, '')
        : '';
    return buildCreateSbtAutoJoinUrl({
      origin,
      basePath: readPublicUrlBasePath(),
      sessionSlug: this.getEffectiveSessionSlug(),
      sbtAddress,
    });
  };

  buildSbtPagePath = (sbtAddressOverride: unknown = null): string =>
    buildSbtDetailPath(
      String(sbtAddressOverride || this.state?.sbtAddress || '').trim(),
      this.getEffectiveSessionSlug(),
    );

  copySbtLinkToClipboard = (): void => {
    const { shareableUrl } = this.state;
    if (!shareableUrl) return;
    navigator.clipboard.writeText(shareableUrl).then(() => {
      notify.success('Copied to clipboard');
      if (!this._isMounted) return;
      this.setState(buildCreateSbtCopySuccessPatch({ stateKey: 'copyLinkSuccess' }));
      this.scheduleTrackedStateReset(
        'copyLinkSuccess',
        buildCreateSbtCopySuccessPatch({ stateKey: 'copyLinkSuccess', copied: false }),
        2000,
      );
    });
  };

  copySbtIdToClipboard = (): void => {
    const { sbtAddress } = this.state;
    if (!sbtAddress) return;
    navigator.clipboard.writeText(sbtAddress).then(() => {
      notify.success('Copied to clipboard');
      if (!this._isMounted) return;
      this.setState(buildCreateSbtCopySuccessPatch({ stateKey: 'copyIdSuccess' }));
      this.scheduleTrackedStateReset(
        'copyIdSuccess',
        buildCreateSbtCopySuccessPatch({ stateKey: 'copyIdSuccess', copied: false }),
        2000,
      );
    });
  };

  copyJsonPreview = (jsonData: unknown): void => {
    try {
      const str = JSON.stringify(jsonData, null, 2);
      navigator.clipboard.writeText(str).then(() => {
        notify.success('Copied to clipboard');
        if (!this._isMounted) return;
        this.setState(buildCreateSbtCopySuccessPatch({ stateKey: 'copyJsonSuccess' }));
        this.scheduleTrackedStateReset(
          'copyJsonSuccess',
          buildCreateSbtCopySuccessPatch({ stateKey: 'copyJsonSuccess', copied: false }),
          1500,
        );
      });
    } catch (e) {
      void e;
      notify.warn('Copy failed');
    }
  };

  handleInputChange = (event: CreateSbtInputChangeEvent): void => {
    this.resetFormStateForEdit();
    const target = event.target;
    let value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    // Special handling for tags is done via separate handlers, ignore here if accidentally caught
    if (name === 'tags') return;
    if (name === 'groupPassword' && typeof value === 'string') {
      value = value.replace(/\s+/g, '');
    }

    if (name.startsWith('sbtDistribution.')) {
      const key = name.split('.')[1];
      this.setState(
        (prevState: CreateSbtLifecycleState) =>
          buildCreateSbtDistributionFieldPatch({
            fieldKey: key,
            fieldValue: value,
            state: prevState,
          }),
        () => {
          this.updateGroupHash();
          this.persistFormCache();
        },
      );
    } else {
      this.setState(buildCreateSbtInputChangePatch({ name, value }), () => {
        this.updateGroupHash();
        this.persistFormCache();
      });

      if (name === 'sbtImageUrl') {
        this.setState(buildCreateSbtImageLoadReadyPatch(), async () => {
          const trimmedUrl = this.state.sbtImageUrl.trim();
          const fetchableUrl = this.getFetchableImageUrl(trimmedUrl);

          if (trimmedUrl !== '' && fetchableUrl) {
            try {
              const file = await fetchImageFromURL(fetchableUrl);
              this.setState(
                buildCreateSbtImageFilePatch({
                  clearLockedAsset: true,
                  file,
                }),
                () => {
                  this.updateGroupHash();
                  this.persistFormCache();
                },
              );
            } catch (error) {
              sbtLog.error('Failed to fetch image via worker:', error);
              this.setState(
                buildCreateSbtImageLoadErrorPatch({
                  clearLockedAsset: true,
                }),
                () => {
                  this.persistFormCache();
                },
              );
            }
          } else {
            this.setState(buildCreateSbtImageFileClearPatch({ clearLockedAsset: true }), () => this.persistFormCache());
          }
        });
      }
    }
  };

  handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0] || null;
    this.applySelectedImageFile(file);
  };

  applySelectedImageFile = (
    file: Blob | null | undefined,
    { useImageUrl = false, statusText = '', statusTone = 'default' }: ApplySelectedImageFileOptions = {},
  ): boolean => {
    if (file && file.size > 10 * 1024 * 1024) {
      sbtLog.error('Image too large (>10MB)');
      if (statusText) {
        this.setState(
          buildCreateSbtImageChooserStatusPatch({
            statusText,
            statusTone,
          }),
        );
      }
      return false;
    }
    this.resetFormStateForEdit();
    this.setState(
      buildCreateSbtSelectedImageFilePatch({
        file,
        statusText,
        statusTone,
        useImageUrl,
      }),
      () => {
        this.updateGroupHash();
        this.persistFormCache();
      },
    );
    return true;
  };

  getFetchableImageUrl = (value: unknown): string => {
    return getFetchableCreateSbtImageUrl(value);
  };

  getCanonicalMetadataImageUrl = (value: unknown): string => {
    return getCanonicalCreateSbtMetadataImageUrl(value);
  };

  handlePasteImage = async (): Promise<void> => {
    const clipboardResult = await readCompactImageClipboard({
      fileNamePrefix: 'clipboard-sbt-image',
    });

    if (clipboardResult?.kind === 'file' && clipboardResult.file) {
      const applied = this.applySelectedImageFile(clipboardResult.file, {
        useImageUrl: false,
      });
      if (!applied) {
        this.setState(
          buildCreateSbtImageChooserStatusPatch({
            statusText: 'Image too large (>10MB)',
            statusTone: 'error',
          }),
        );
      }
      return;
    }

    if (clipboardResult?.kind === 'text') {
      const pastedUrl = String(clipboardResult.text || '').trim();
      const fetchableUrl = this.getFetchableImageUrl(pastedUrl);
      if (!fetchableUrl) {
        this.setState(
          buildCreateSbtImageChooserStatusPatch({
            statusText: clipboardResult?.error || 'Clipboard does not contain a supported image or URL.',
            statusTone: 'error',
          }),
        );
        return;
      }

      this.setState(
        buildCreateSbtImageChooserStatusPatch({
          statusText: 'Loading preview...',
          statusTone: 'loading',
        }),
      );

      try {
        const file = await fetchImageFromURL(fetchableUrl);
        this.resetFormStateForEdit();
        await this.setStateAsync(
          buildCreateSbtSelectedImageFilePatch({
            file,
            sbtImageUrl: pastedUrl,
            useImageUrl: true,
          }),
        );
        this.updateGroupHash();
        this.persistFormCache();
      } catch (error) {
        sbtLog.error('Failed to fetch pasted image via worker:', error);
        this.setState(
          buildCreateSbtImageChooserStatusPatch({
            statusText: getErrorMessage(error, 'Image preview unavailable.'),
            statusTone: 'error',
          }),
        );
      }
      return;
    }

    this.setState(
      buildCreateSbtImageChooserStatusPatch({
        statusText: clipboardResult?.error || 'Clipboard does not contain a supported image or URL.',
        statusTone: 'error',
      }),
    );
  };

  toggleImageUploadMethod = (): void => {
    this.setImageUploadMethod(!this.state.useImageUrl);
  };

  setImageUploadMethod = (useImageUrl: unknown, afterUpdate: (() => void) | null = null): void => {
    this.resetFormStateForEdit();
    this.setState(
      () => buildCreateSbtImageUploadMethodPatch({ useImageUrl }),
      () => {
        this.updateGroupHash();
        this.persistFormCache();
        if (typeof afterUpdate === 'function') afterUpdate();
      },
    );
  };

  openImageUploadPicker = (): void => {
    if (this.state.useImageUrl) {
      this.setImageUploadMethod(false, () => this.fileInput?.click());
      return;
    }
    this.setState(buildCreateSbtImageChooserStatusPatch());
    this.fileInput?.click();
  };

  resetImage = (): void => {
    this.resetFormStateForEdit();
    this.setState(buildCreateSbtImageResetPatch(), () => {
      this.updateGroupHash();
      this.persistFormCache();
    });
  };

  toggleCollapse = (section: CreateSbtCollapsibleSectionKey): void => {
    this.setState((prevState: Record<CreateSbtCollapsibleSectionKey, boolean>) =>
      buildCreateSbtCollapseTogglePatch({
        section,
        state: prevState,
      }),
    );
  };

  renderCollapsibleHeader = (title: string, sectionKey: CreateSbtCollapsibleSectionKey): JSX.Element => {
    const isCollapsed = !!this.state[sectionKey];
    const headerDisplayState = resolveCreateSbtCollapseHeaderDisplayState({
      isCollapsed,
      title,
    });
    return (
      <button
        type="button"
        className={buildCreateSbtCollapseHeaderClassName({
          baseClassName: styles.sectionHeaderButton,
          openClassName: styles.sectionHeaderButtonOpen,
          shouldUseOpenClass: headerDisplayState.shouldUseOpenClass,
        })}
        onClick={() => this.toggleCollapse(sectionKey)}
        aria-expanded={headerDisplayState.ariaExpanded}
        aria-label={headerDisplayState.ariaLabel}
        data-testid={E2E_TESTIDS.SBT_CREATE_SECTION_HEADER}
        data-ce-section-key={sectionKey}
      >
        {headerDisplayState.shouldRenderCollapsedTitle && (
          <span className={styles.sectionHeaderTitleText}>{title}</span>
        )}
        {headerDisplayState.shouldRenderOpenIcon && <FontAwesomeIcon icon={faChevronUp} />}
        {headerDisplayState.shouldRenderClosedIcon && <FontAwesomeIcon icon={faChevronDown} />}
      </button>
    );
  };

  updateGroupHash = (): void => {
    const {
      sbtName,
      sbtDescription,
      sbtImageFile,
      sbtImageUrl,
      sbtDistribution,
      tags,
      documentURLs,
      documentUrl,
      metadataLockGateIds,
    } = this.state;
    const groupData = {
      sbtName,
      sbtDescription,
      sbtImageFile,
      sbtImageUrl,
      sbtDistribution,
      tags,
      documentURLs: this.getEffectiveDocumentURLs({ documentURLs, documentUrl }),
      metadataLockGateIds: normalizeMetadataLockGateIds(metadataLockGateIds),
    };

    const newGroupHash = ethers.utils.id(JSON.stringify(groupData));
    this.setState(buildCreateSbtGroupHashPatch({ groupHash: newGroupHash }));
  };

  handleMintingEndTimeChange = (date: unknown): void => {
    this.resetFormStateForEdit();
    this.setState(
      (prevState: { sbtDistribution: Record<string, unknown> }) =>
        buildCreateSbtDistributionFieldPatch({
          fieldKey: 'mintingEndTime',
          fieldValue: date,
          state: prevState,
        }),
      () => {
        this.updateGroupHash();
        this.persistFormCache();
      },
    );
  };

  handleBurnAuthChange = (event: CreateSbtSelectChangeEvent): void => {
    this.resetFormStateForEdit();
    const value = event.target.value;
    this.setState(
      (prevState: { sbtDistribution: Record<string, unknown> }) =>
        buildCreateSbtDistributionFieldPatch({
          fieldKey: 'burnAuth',
          fieldValue: value,
          state: prevState,
        }),
      this.persistFormCache,
    );
  };

  /* =========================
   * Tag Handling (Pill UI)
   * ========================= */
  handleTagInputKeyDown = (event: CreateSbtTagKeyEvent): void => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.handleAddTag();
    }
  };

  handleAddTag = (): void => {
    const val = (this.state.currentTagInput || '').trim();
    if (!val) return;

    // Prevent duplicates
    if (this.state.tags.includes(val)) {
      this.setState(buildCreateSbtCurrentTagInputPatch());
      return;
    }

    this.setState(
      (prev: CreateSbtTagStateDraft) =>
        buildCreateSbtTagAdditionState({
          autoAppliedDefaultTags: prev.autoAppliedDefaultTags,
          dismissedDefaultTags: prev.dismissedDefaultTags,
          tagValue: val,
          tags: prev.tags,
        }),
      () => {
        this.persistFormCache();
      },
    );
  };

  removeTag = (indexToRemove: unknown): void => {
    const removeIndex = Number(indexToRemove);
    const removedTag = this.state.tags[removeIndex];
    this.setState(
      (prev: CreateSbtTagStateDraft) => ({
        ...buildCreateSbtTagRemovalState({
          autoAppliedDefaultTags: prev.autoAppliedDefaultTags,
          defaultTags: this.getDefaultTags(),
          dismissedDefaultTags: prev.dismissedDefaultTags,
          indexToRemove: removeIndex,
          removedTag,
          tags: prev.tags,
        }),
      }),
      () => {
        this.persistFormCache();
      },
    );
  };

  startClaim = async (): Promise<void> => {
    if (this.state.countdownActive || this.countdownTimer) return;
    this.clearCountdownTimer();
    this.setState(buildCreateSbtCountdownStartPatch());
    this.countdownTimer = setInterval(() => {
      if (!this._isMounted) return;
      this.setState(
        (prevState: Record<string, unknown>) => buildCreateSbtCountdownTickPatch({ state: prevState }),
        () => {
          if (this.state.countdown === 0) {
            this.clearCountdownTimer();
          }
        },
      );
    }, 1000);
  };

  generatePasswords = (): string[] => {
    const { numInviteLinks, sbtDistribution } = this.state;
    const count = resolveCreateSbtPasswordGenerationCount({
      numInviteLinks,
      sbtDistribution,
    });
    const newPasswordList = Array.from({ length: count }, () => this.generateRandomString(32));
    this.setState(buildCreateSbtPasswordListPatch({ passwordList: newPasswordList }));
    return newPasswordList;
  };

  generateInviteNonces = (count: unknown): string[] => {
    return generateCreateSbtInviteNonces({
      bytesToNonce: (bytes: Uint8Array | number[]) => ethers.BigNumber.from(ethers.utils.hexlify(bytes)).toString(),
      count,
      getRandomValues:
        typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function'
          ? (arr: Uint8Array) => window.crypto.getRandomValues(arr)
          : null,
      randomBytes: ethers.utils.randomBytes,
    });
  };

  generateRandomString = (length: unknown): string => {
    return generateCreateSbtRandomHexString({
      getRandomValues:
        typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function'
          ? (arr: Uint8Array) => window.crypto.getRandomValues(arr)
          : null,
      length,
      randomBytes: ethers.utils.randomBytes,
    });
  };

  async uploadImageToArweave() {
    if (!this.props.loginComplete) {
      return null;
    }

    await this.setStateAsync({ currentStep: 1, mintingFailed: false });

    const { sbtImageFile, sbtImageUrl, useImageUrl, metadataLockGateIds } = this.state;

    try {
      const { gateMap } = this.resolveLockGateOptions();
      const chainID = this.getSelectedAuthoringChainId();
      const selectedImageGateIds = this.normalizeSelectedGateIds(
        getMetadataFieldLockGateIds(metadataLockGateIds, 'image'),
        Object.keys(gateMap || {}),
      );
      const isImageLocked = selectedImageGateIds.length > 0;
      const shouldUseLockedUrlFlow = isImageLocked && useImageUrl;
      let fileToUpload = sbtImageFile;
      let imageFormat = 'png';

      if (!fileToUpload || shouldUseLockedUrlFlow) {
        await this.setStateAsync({
          imageUploaded: true,
          lockedImageAsset: null,
          sbtImageUrl: String(sbtImageUrl || '').trim(),
          currentStep: 2,
        });
        return {
          imageUploaded: true,
          lockedImageAsset: null,
          sbtImageUrl: String(sbtImageUrl || '').trim(),
        };
      }

      if (fileToUpload.type === 'image/jpeg' || fileToUpload.type === 'image/jpg') {
        imageFormat = 'jpg';
      } else {
        imageFormat = 'png';
      }

      const arweaveKey = await this.getEffectiveArweaveUploadKey();
      const arweaveRequestOptions = await this.buildArweaveUploadRequestOptions();
      if (isImageLocked) {
        const imageEncryption = this.buildGateObjectsAndRecipients(selectedImageGateIds, gateMap, chainID);
        this.requireRecipientsForGateSelection({
          gateIds: selectedImageGateIds,
          recipients: imageEncryption?.recipients,
          scopeLabel: 'image',
        });
        const litHooks = this.getActiveLitHooks();
        if (!litHooks || typeof litHooks.saveKey !== 'function') {
          throw new Error(`Lit hooks not initialized; connect a ${t('walletLower')} to encrypt.`);
        }
        const imageRecipientAccess = buildCreateSbtRecipientAccessControlState({
          recipients: imageEncryption.recipients,
        });
        const uploadResult = await uploadEncryptedArweaveData({
          data: fileToUpload,
          name: fileToUpload?.name || 'image',
          mime: fileToUpload?.type || 'application/octet-stream',
          arweaveJwk: arweaveKey?.arweaveJwk || '',
          providerLike: this.props.provider,
          account: this.props.account,
          chainId: chainID,
          contextLabel: `sbt:${this.getMetadataEncryptionContextBase()}:image-asset`,
          arweave: arweaveRequestOptions,
          lit: {
            saveKey: litHooks.saveKey,
            accessControlConditions: imageRecipientAccess.combinedAccessControlConditions,
            chain: imageRecipientAccess.primaryChain,
            ...(litHooks.litNetwork ? { litNetwork: litHooks.litNetwork } : {}),
            ...(litHooks.connectTimeout ? { connectTimeout: litHooks.connectTimeout } : {}),
            ...(litHooks.providerLike ? { providerLike: litHooks.providerLike } : {}),
            ...(litHooks.resourceAbilityRequests ? { resourceAbilityRequests: litHooks.resourceAbilityRequests } : {}),
          },
        });
        const lockedAsset = this.buildEncryptedImageAsset({
          uploadResult,
        });
        if (!lockedAsset) {
          throw new Error('Failed to prepare encrypted image asset.');
        }
        await this.setStateAsync({
          imageUploaded: true,
          lockedImageAsset: lockedAsset,
          sbtImageUrl: '',
          currentStep: 2,
        });
        return {
          imageUploaded: true,
          lockedImageAsset: lockedAsset,
          sbtImageUrl: '',
        };
      }
      const imageTxId = await arweaveClient.uploadDataToArweave(fileToUpload, imageFormat, {
        arweaveJwk: arweaveKey?.arweaveJwk || '',
        ...arweaveRequestOptions,
      });
      sbtLog.log('Image uploaded to Arweave with transaction ID:', imageTxId);

      await this.setStateAsync({
        imageUploaded: true,
        sbtImageUrl: imageTxId,
        lockedImageAsset: null,
        currentStep: 2,
      });
      return {
        imageUploaded: true,
        sbtImageUrl: imageTxId,
        lockedImageAsset: null,
      };
    } catch (error) {
      sbtLog.error('Failed to upload image to Arweave:', error);
      this.setState(
        buildCreateSbtMintResetFailurePatch({
          error: getErrorMessage(error, 'Failed to upload image to Arweave.'),
        }),
      );
      throw error;
    }
  }

  async uploadTokenUriToArweave() {
    await this.setStateAsync({ currentStep: 2, mintingFailed: false });
    try {
      const {
        sbtName,
        sbtDescription,
        sbtImageUrl,
        sbtDistribution,
        tags,
        documentIDHashes,
        metadataLockGateIds,
        useImageUrl,
        sbtImageFile,
        lockedImageAsset,
      } = this.state;
      const { burnAuth, network } = sbtDistribution;
      const { gateMap, defaultGateId } = this.resolveLockGateOptions();
      const validGateIds = Object.keys(gateMap || {});
      const finalDocURLs = this.getEffectiveDocumentURLs();

      // Use tags array directly (ensure no empty strings)
      const tokenTags = buildCreateSbtTokenTagList(tags as string[]);
      const documentIdHashesDraft = documentIDHashes as string;
      const docIDHashesArray = buildCreateSbtDocumentIdHashList(documentIdHashesDraft);
      const chainID = this.getSelectedAuthoringChainId();
      const creator = this.props.account;
      const normalizedLockMap = normalizeMetadataLockGateIds(metadataLockGateIds);
      const resolveFieldGateIds = (fieldKey: string): string[] => {
        return resolveCreateSbtMetadataFieldGateIds({
          fieldKey,
          gatesLowerLabel: t('gatesLower'),
          lockMap: normalizedLockMap,
          validGateIds,
        });
      };
      const imageSourceValue = resolveCreateSbtMetadataImageSource({
        defaultImageUrl: DEFAULT_SBT_IMAGE_ARWEAVE_TX,
        getCanonicalMetadataImageUrl: this.getCanonicalMetadataImageUrl,
        sbtImageUrl,
        useImageUrl,
      });

      let finalImageUrl = imageSourceValue;
      let finalName = sbtName || '';
      let finalDescription = sbtDescription || '';
      let finalTags = tokenTags;
      let finalDocumentURLs = finalDocURLs;
      const encryptedFields: Record<string, unknown> = {};
      const encryptedFieldGates: Record<string, string | string[]> = {};
      const contextBase = this.getMetadataEncryptionContextBase();
      const markEncryptedField = (fieldKey: string, selectedGateIds: unknown): void => {
        writeCreateSbtEncryptedFieldGate({
          fieldKey,
          selectedGateIds,
          target: encryptedFieldGates,
          validGateIds,
        });
      };

      const selectedNameGateIds = resolveFieldGateIds('name');
      const nameEncryption = selectedNameGateIds.length
        ? this.buildGateObjectsAndRecipients(selectedNameGateIds, gateMap, chainID)
        : null;
      this.requireRecipientsForGateSelection({
        gateIds: selectedNameGateIds,
        recipients: nameEncryption?.recipients,
        scopeLabel: 'group name',
      });
      if (nameEncryption && nameEncryption.recipients.length) {
        const nameResult = await this.encryptValueWithRecipients({
          value: finalName,
          maskedValue: '',
          contextLabel: `sbt:${contextBase}:name`,
          recipients: nameEncryption.recipients,
          chainIdFallback: chainID,
        });
        finalName = nameResult.value;
        if (nameResult.encrypted) {
          encryptedFields.name = nameResult.encrypted;
          markEncryptedField('name', selectedNameGateIds);
        }
      }

      const selectedDescriptionGateIds = resolveFieldGateIds('description');
      const descriptionEncryption = selectedDescriptionGateIds.length
        ? this.buildGateObjectsAndRecipients(selectedDescriptionGateIds, gateMap, chainID)
        : null;
      this.requireRecipientsForGateSelection({
        gateIds: selectedDescriptionGateIds,
        recipients: descriptionEncryption?.recipients,
        scopeLabel: 'group description',
      });
      if (descriptionEncryption && descriptionEncryption.recipients.length) {
        const descriptionResult = await this.encryptValueWithRecipients({
          value: finalDescription,
          maskedValue: '',
          contextLabel: `sbt:${contextBase}:description`,
          recipients: descriptionEncryption.recipients,
          chainIdFallback: chainID,
        });
        finalDescription = descriptionResult.value;
        if (descriptionResult.encrypted) {
          encryptedFields.description = descriptionResult.encrypted;
          markEncryptedField('description', selectedDescriptionGateIds);
        }
      }

      const selectedTagsGateIds = resolveFieldGateIds('tags');
      const tagsEncryption = selectedTagsGateIds.length
        ? this.buildGateObjectsAndRecipients(selectedTagsGateIds, gateMap, chainID)
        : null;
      this.requireRecipientsForGateSelection({
        gateIds: selectedTagsGateIds,
        recipients: tagsEncryption?.recipients,
        scopeLabel: 'group tags',
      });
      if (tagsEncryption && tagsEncryption.recipients.length) {
        const tagsResult = await this.encryptValueWithRecipients({
          value: finalTags,
          maskedValue: [],
          contextLabel: `sbt:${contextBase}:tags`,
          recipients: tagsEncryption.recipients,
          chainIdFallback: chainID,
        });
        finalTags = tagsResult.value as string[];
        if (tagsResult.encrypted) {
          encryptedFields.tags = tagsResult.encrypted;
          markEncryptedField('tags', selectedTagsGateIds);
        }
      }

      const selectedDocsGateIds = resolveFieldGateIds('documentURLs');
      const docsEncryption = selectedDocsGateIds.length
        ? this.buildGateObjectsAndRecipients(selectedDocsGateIds, gateMap, chainID)
        : null;
      this.requireRecipientsForGateSelection({
        gateIds: selectedDocsGateIds,
        recipients: docsEncryption?.recipients,
        scopeLabel: 'document URLs',
      });
      if (docsEncryption && docsEncryption.recipients.length) {
        const docsResult = await this.encryptValueWithRecipients({
          value: finalDocumentURLs,
          maskedValue: [],
          contextLabel: `sbt:${contextBase}:document-urls`,
          recipients: docsEncryption.recipients,
          chainIdFallback: chainID,
        });
        finalDocumentURLs = docsResult.value as string[];
        if (docsResult.encrypted) {
          encryptedFields.documentURLs = docsResult.encrypted;
          markEncryptedField('documentURLs', selectedDocsGateIds);
        }
      }

      const selectedImageGateIds = resolveFieldGateIds('image');
      const imageEncryption = selectedImageGateIds.length
        ? this.buildGateObjectsAndRecipients(selectedImageGateIds, gateMap, chainID)
        : null;
      this.requireRecipientsForGateSelection({
        gateIds: selectedImageGateIds,
        recipients: imageEncryption?.recipients,
        scopeLabel: 'image',
      });
      if (imageEncryption && imageEncryption.recipients.length) {
        if (!useImageUrl && sbtImageFile && lockedImageAsset?.txId) {
          finalImageUrl = '';
          encryptedFields.image = lockedImageAsset;
          markEncryptedField('image', selectedImageGateIds);
        } else {
          const imageResult = await this.encryptValueWithRecipients({
            value: finalImageUrl,
            maskedValue: '',
            contextLabel: `sbt:${contextBase}:image`,
            recipients: imageEncryption.recipients,
            chainIdFallback: chainID,
          });
          finalImageUrl = imageResult.value as string;
          if (imageResult.encrypted) {
            encryptedFields.image = imageResult.encrypted;
            markEncryptedField('image', selectedImageGateIds);
          }
        }
      }

      const metadataSessionSlug = this.getResolvedMetadataSessionSlug();
      const metadataEncryption = this.buildMetadataEncryption({
        encryptedFieldGates,
        gateMap,
        chainIdFallback: chainID,
        defaultGateId,
      });
      const tokenUriBase = this.buildTokenUriMetadata({
        name: finalName,
        imageUrl: finalImageUrl,
        description: finalDescription,
        metadataSessionSlug,
        tokenTags: finalTags,
        docIDHashesArray,
        finalDocURLs: finalDocumentURLs,
        burnAuth,
        networkName: network?.name,
        chainID,
        creator,
        encryptedFields,
        encryptedFieldGates: metadataEncryption.encryptedFieldGates,
        encryption: metadataEncryption.encryption,
      });
      validateNoLockedPlaintextInPayload(tokenUriBase, {
        family: 'sbt_metadata',
        path: 'sbt tokenURI',
      });

      const tokenUriData = JSON.stringify(tokenUriBase);
      const arweaveKey = await this.getEffectiveArweaveUploadKey();
      const arweaveRequestOptions = await this.buildArweaveUploadRequestOptions();
      const tokenUriTxId = await arweaveClient.uploadDataToArweave(tokenUriData, 'json', {
        arweaveJwk: arweaveKey?.arweaveJwk || '',
        ...arweaveRequestOptions,
      });

      await this.setStateAsync({
        tokenUriUploaded: true,
        tokenURI: `${tokenUriTxId}`,
        currentStep: 3,
      });
      return `${tokenUriTxId}`;
    } catch (error) {
      sbtLog.error('uploadTokenUriToArweave failed:', error);
      this.setState(
        buildCreateSbtMintResetFailurePatch({
          error: getErrorMessage(error, 'Failed to upload tokenURI.'),
        }),
      );
      throw error;
    }
  }

  persistCreatedSbtCodes = ({
    sbtAddress,
    hasPasswordMintOnChain,
    codesToStore = [],
  }: CreateSbtRecoveryPersistArgs = {}): CreateSbtRecoveryPersistResult => {
    if (!hasPasswordMintOnChain || !sbtAddress || !Array.isArray(codesToStore) || codesToStore.length === 0) {
      return {
        ok: false,
        status: 'empty-recovery-payload',
      };
    }
    return {
      ok: true,
      status: 'export-only',
      passwords: [...codesToStore],
    };
  };

  handleEncryptedRecoveryChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    this.setState({ encryptedRecoveryStatus: 'saving' });
    const { patch, warning } = await selectCreateEncryptedRecovery({
      chainId: this.getSelectedAuthoringChainId(),
      enabled: event.target.checked === true,
      passwords: this.state.passwordList,
      sbtAddress: this.state.sbtAddress,
    });
    this.setState(patch);
    if (warning) notify.warn(warning);
  };

  handleDeferredSave = async (): Promise<CreateSbtDeferredDraftPayload> => {
    if (typeof this.props.onSaveDraft !== 'function') {
      throw new Error('Session draft save is unavailable.');
    }
    await this.commitPendingDocumentUrl();
    const draftPayload = await this.buildDeferredDraftPayload();
    await this.props.onSaveDraft(draftPayload);
    this.clearFormCache();
    await this.setStateAsync(buildCreateSbtDeferredSaveCompletePatch());
    return draftPayload;
  };

  getBurnAuthEnum = (burnAuth: unknown): number => {
    return getCreateSbtBurnAuthEnum(burnAuth);
  };

  buildTokenUriMetadata = ({
    name = this.state.sbtName,
    imageUrl,
    description,
    metadataSessionSlug = normalizeSessionSlug(this.getEffectiveSessionSlug() || ''),
    tokenTags = this.state.tags.filter((tag: unknown) => String(tag || '').trim().length > 0),
    docIDHashesArray = (this.state.documentIDHashes || '').trim().length > 0
      ? this.state.documentIDHashes
          .split(',')
          .map((hash: string) => hash.trim())
          .filter(Boolean)
      : [],
    finalDocURLs = this.getEffectiveDocumentURLs(),
    burnAuth = this.state.sbtDistribution.burnAuth,
    networkName = this.getSelectedAuthoringChain()?.name || this.state.sbtDistribution.network?.name,
    chainID = this.getSelectedAuthoringChainId(),
    creator = this.props.account,
    encryptedFields = null,
    encryptedFieldGates = null,
    encryption = null,
  }: TokenUriMetadataArgs = {}): TokenUriMetadata => {
    const { sbtDistribution } = this.state;
    const mintModeOnChain = deriveSbtMintModeFromDistribution({
      distributionOption: sbtDistribution.distributionOption,
      isLimited: !!sbtDistribution.isLimited,
    });
    const metadata: TokenUriMetadata = {
      v: 2,
      name: String(name || '').trim(),
      description: String(description || '').trim(),
      image: typeof imageUrl === 'string' ? imageUrl : '',
      burnAuth,
      network: networkName,
      unlisted: sbtDistribution.unlisted,
      tags: tokenTags,
      maxTokens: sbtDistribution.isLimited ? sbtDistribution.limitedNumber : 0,
      mintMode: mintModeOnChain,
      hasPasswordMint: hasPasswordMintForSbtMintMode(mintModeOnChain),
      chainID,
      creator,
      documentIDHashes: docIDHashesArray,
      documentURLs: finalDocURLs,
      sessionSlug: metadataSessionSlug,
      sessionSlugExplicit: true,
    };

    if (encryptedFields && typeof encryptedFields === 'object' && Object.keys(encryptedFields).length > 0) {
      metadata.encryptedFields = encryptedFields;
    }
    if (encryptedFieldGates && typeof encryptedFieldGates === 'object' && Object.keys(encryptedFieldGates).length > 0) {
      metadata.encryptedFieldGates = encryptedFieldGates;
    }
    if (encryption && typeof encryption === 'object') {
      metadata.encryption = encryption;
    }

    return metadata;
  };

  getResolvedMetadataSessionSlug = (): string => {
    const sessionConfig = this.getSessionConfigForNetwork();
    return resolveCreateSbtMetadataSessionSlug({
      deferredDeployMode: this.isDeferredDeployMode(),
      effectiveSessionSlug: this.getEffectiveSessionSlug(),
      sbtLabel: t('sbt'),
      sessionConfigSlug: sessionConfig?.slug,
    });
  };

  buildMetadataPreview = ({
    gateOptionsResult = null,
  }: { gateOptionsResult?: GateOptionsResult | null } = {}): TokenUriMetadata => {
    const { sbtName, sbtDescription, sbtImageUrl, tags, metadataLockGateIds, useImageUrl, sbtImageFile } = this.state;
    const chainID = this.getSelectedAuthoringChainId();
    const { gateMap, defaultGateId } = gateOptionsResult || this.resolveLockGateOptions();
    const validGateIds = Object.keys(gateMap || {});
    const previewEncryptedFieldGates: Record<string, unknown> = {};
    const previewEncryptedFields: Record<string, unknown> = {};
    const previewDocURLs = this.getEffectiveDocumentURLs();
    const previewTags = buildCreateSbtMetadataPreviewTagList(tags);

    let previewName = sbtName || '';
    let previewDescription = sbtDescription || '';
    let previewTagList = previewTags;
    let previewDocumentList = previewDocURLs;
    let previewImage = resolveCreateSbtMetadataImageSource({
      defaultImageUrl: DEFAULT_SBT_IMAGE_ARWEAVE_TX,
      getCanonicalMetadataImageUrl: this.getCanonicalMetadataImageUrl,
      sbtImageUrl,
    });
    const normalizedLockMap = normalizeMetadataLockGateIds(metadataLockGateIds);

    const registerPreviewField = (fieldKey: string, selectedGateIds: unknown): boolean => {
      return writeCreateSbtEncryptedFieldGate({
        fieldKey,
        selectedGateIds,
        target: previewEncryptedFieldGates,
        validGateIds,
      });
    };

    if ((previewDescription || '').trim().length > 0) {
      if (registerPreviewField('description', normalizedLockMap.description)) {
        previewDescription = '';
        previewEncryptedFields.description = LOCKED_FIELD_MASK;
      }
    }

    if (previewTagList.length > 0) {
      if (registerPreviewField('tags', normalizedLockMap.tags)) {
        previewTagList = [];
        previewEncryptedFields.tags = LOCKED_FIELD_MASK;
      }
    }

    if (previewDocumentList.length > 0) {
      if (registerPreviewField('documentURLs', normalizedLockMap.documentURLs)) {
        previewDocumentList = [];
        previewEncryptedFields.documentURLs = LOCKED_FIELD_MASK;
      }
    }

    if ((previewName || '').trim().length > 0) {
      if (registerPreviewField('name', normalizedLockMap.name)) {
        previewName = '';
        previewEncryptedFields.name = LOCKED_FIELD_MASK;
      }
    }

    if ((previewImage || '').trim().length > 0) {
      if (registerPreviewField('image', normalizedLockMap.image)) {
        previewImage = '';
        previewEncryptedFields.image =
          !useImageUrl && sbtImageFile ? this.buildPreviewEncryptedImageAsset() : LOCKED_FIELD_MASK;
      }
    }

    const metadataEncryption = this.buildMetadataEncryption({
      encryptedFieldGates: previewEncryptedFieldGates,
      gateMap,
      chainIdFallback: chainID,
      defaultGateId,
    });
    const preview = this.buildTokenUriMetadata({
      name: previewName,
      imageUrl: previewImage,
      description: previewDescription,
      tokenTags: previewTagList,
      finalDocURLs: previewDocumentList,
      encryptedFields: previewEncryptedFields,
      encryptedFieldGates: metadataEncryption.encryptedFieldGates,
      encryption: metadataEncryption.encryption,
    });

    return preview;
  };

  getCreateSbtRenderDerivations = ({
    account,
    authoringChain,
    authoringChainId,
    autoJoinUrl,
    create2Salt,
    currentTagInput,
    deferredDeployMode,
    documentIDHashes,
    documentURLs,
    documentUrl,
    effectiveSessionSlug,
    groupPassword,
    imageChooserStatusText,
    imageChooserStatusTone,
    imageLoadError,
    metadataLockGateIds,
    network,
    predictableAddressActive,
    sbtAddress,
    sbtDescription,
    sbtDistribution,
    sbtImageFile,
    sbtImageUrl,
    sbtName,
    shareableUrl,
    tags,
    tokenURI,
    useImageUrl,
  }: any) => {
    const imageFileKey =
      sbtImageFile && typeof sbtImageFile === 'object'
        ? `${sbtImageFile.name || ''}:${sbtImageFile.size || ''}:${sbtImageFile.lastModified || ''}`
        : '';
    const memoKey = JSON.stringify({
      account,
      authoringChain,
      authoringChainId,
      autoJoinUrl,
      create2Salt,
      currentTagInput,
      deferredDeployMode,
      documentIDHashes,
      documentURLs,
      documentUrl,
      effectiveSessionSlug,
      groupPassword,
      imageChooserStatusText,
      imageChooserStatusTone,
      imageFileKey,
      imageLoadError,
      defaultGateId: this.props.defaultGateId || '',
      encryptionGates: this.props.encryptionGates || [],
      lockGatePreferredSessionSlug: this.props.lockGatePreferredSessionSlug || '',
      lockGateSessionSources: this.props.lockGateSessionSources || [],
      metadataLockGateIds,
      network,
      propsNetwork: {
        chainId: this.props.network?.chainId || '',
        id: this.props.network?.id || '',
      },
      sessionConfigOverride: this.props.sessionConfigOverride || null,
      sessionSlug: this.props.sessionSlug || '',
      slug: this.props.slug || '',
      predictableAddressActive,
      sbtAddress,
      sbtDescription,
      sbtDistribution,
      sbtImageUrl,
      sbtName,
      shareableUrl,
      tags,
      tokenURI,
      useImageUrl,
    });
    if (this._renderDerivationsMemo?.key === memoKey) {
      return this._renderDerivationsMemo.value;
    }

    const jsonData = buildCreateSbtJsonPreviewData({
      authoringChain,
      autoJoinUrl,
      groupPassword,
      network,
      sbtName,
      sbtAddress,
      sbtDistribution,
      shareableUrl,
      tokenURI,
    });
    const lockGateOptions = this.resolveLockGateOptions();
    const metadataPreview = this.buildMetadataPreview({ gateOptionsResult: lockGateOptions });
    const documentUrlInputState = resolveCreateSbtDocumentUrlInputState({
      documentURLs,
      documentUrl,
    });
    const tagInputState = resolveCreateSbtTagInputState({
      currentTagInput,
    });
    const openMintAutoJoinUrl = resolveCreateSbtOpenMintAutoJoinUrl({
      autoJoinUrl,
      buildSessionAutoJoinUrl: this.buildSessionAutoJoinUrl,
      distributionOption: sbtDistribution.distributionOption,
      sbtAddress,
    });
    const chainOptions = this.getAuthoringChainOptions();
    const metadataLockSelectionState = buildCreateSbtMetadataLockSelectionState({
      gateOptions: lockGateOptions.gateOptions,
      metadataLockGateIds,
    });
    const imagePreviewState = buildCreateSbtImagePreviewState({
      imageChooserStatusText,
      imageChooserStatusTone,
      imageLoadError,
      sbtImageFile,
      sbtImageUrl,
      useImageUrl,
    });
    const createSbtRenderState = buildCreateSbtRenderState({
      create2Salt,
      deferredDeployMode,
      deferredSurfaceBg: DEFERRED_MODAL_SURFACE_BG,
      descriptionSelectedGateIds: metadataLockSelectionState.descriptionSelectedGateIds,
      distributionConfigs: DISTRIBUTION_OPTION_CONFIGS,
      distributionOption: sbtDistribution.distributionOption,
      docsSelectedGateIds: metadataLockSelectionState.docsSelectedGateIds,
      documentURLs,
      documentUrl,
      imageSelectedGateIds: metadataLockSelectionState.imageSelectedGateIds,
      isLimited: sbtDistribution.isLimited,
      nameSelectedGateIds: metadataLockSelectionState.nameSelectedGateIds,
      normalizeDocumentUrlDraft: this.getNormalizedDocumentUrlDraft,
      sbtDescription,
      sbtImageFile,
      sbtImageUrl,
      sbtName,
      tags,
      tagsSelectedGateIds: metadataLockSelectionState.tagsSelectedGateIds,
    });
    const value = {
      chainOptions,
      createSbtRenderState,
      documentUrlInputState,
      imagePreviewState,
      jsonData,
      lockGateOptions,
      metadataLockSelectionState,
      metadataPreview,
      openMintAutoJoinUrl,
      tagInputState,
    };
    this._renderDerivationsMemo = { key: memoKey, value };
    return value;
  };

  resolvePredictableDeployPlan = async ({
    tokenURI,
  }: ResolvePredictableDeployPlanArgs): Promise<PredictableDeployPlan> => {
    const predictionShape = this.buildPredictableDeployShape();
    if (!predictionShape || predictionShape.pendingStateUpdate) {
      throw new Error('Address preview is still preparing. Please retry in a moment.');
    }
    if (predictionShape.unavailableReason) {
      throw new Error(predictionShape.unavailableReason);
    }
    const deployShape = predictionShape as PredictableDeployReadyShape;
    const { predictedAddress, predictionSignature } = await this.resolvePredictedAddressForShape(deployShape);
    if (!predictedAddress || !ethers.utils.isAddress(predictedAddress)) {
      throw new Error(`Unable to resolve the predicted ${t('sbt')} address.`);
    }
    // Regression guard: a non-empty preview is only reusable when it matches the
    // current deterministic deploy inputs; otherwise we must recompute.
    this._predictedAddressShapeSignature = predictionSignature;

    const finalGroupPasswordHash = deployShape.initializeGroupPasswordHash
      ? createSbtContractScripts.computeGroupPasswordHash({
          password: deployShape.groupPassword,
          sbtAddress: predictedAddress,
        })
      : ethers.constants.HashZero;

    return {
      ...deployShape,
      predictedAddress,
      tokenURI,
      finalGroupPasswordHash,
      createOptions: {
        useConfiguredDeterministic: true,
        initializeGroupPasswordHash: deployShape.initializeGroupPasswordHash,
      },
    };
  };

  buildDeferredDraftPayload = async (): Promise<CreateSbtDeferredDraftPayload> => {
    const authoringPayload = await this.buildSerializableAuthoringPayload();
    const arweaveKey = await this.getEffectiveArweaveUploadKey();
    let tokenURI = String(this.state.tokenURI || '').trim();
    let metadataUploadStatus: DeferredDraftMetadataUploadStatus = tokenURI ? 'ready' : 'pending-upload';
    const shouldAttemptImmediateDeferredUpload = this.props.attemptImmediateDeferredUpload !== false;

    if (!tokenURI && shouldAttemptImmediateDeferredUpload) {
      const hasConnectedCreator = ethers.utils.isAddress(toStr(this.props.account).trim());
      const hasImmediateUploadPath =
        hasConnectedCreator && (!!toStr(arweaveKey?.arweaveJwk).trim() || !!this.getResolvedArweaveUploadWorkerUrl());
      if (hasImmediateUploadPath) {
        try {
          await this.uploadImageToArweave();
          tokenURI = String(await this.uploadTokenUriToArweave()).trim();
          metadataUploadStatus = tokenURI ? 'ready' : 'pending-upload';
        } catch (error) {
          if (!shouldFallbackCreateSbtDeferredDraftUpload(error)) {
            throw error;
          }
          await this.setStateAsync(buildCreateSbtDeferredUploadFallbackPatch());
          tokenURI = '';
          metadataUploadStatus = 'pending-upload';
        }
      }
    }
    const deployPlan = await this.resolvePredictableDeployPlan({ tokenURI });
    const metadataPreview = this.buildMetadataPreview();
    return {
      id: deployPlan.predictedAddress.toLowerCase(),
      predictedAddress: deployPlan.predictedAddress,
      displayName: deployPlan.displayName,
      contractName: deployPlan.contractName,
      symbol: deployPlan.symbol,
      create2Salt: deployPlan.create2Salt,
      limitedNumber: deployPlan.limitedNumber,
      adminAddress: deployPlan.adminAddress,
      mintingEndTimeUnix: deployPlan.mintingEndTimeUnix,
      mintModeOnChain: deployPlan.mintModeOnChain,
      hasPasswordMintOnChain: deployPlan.hasPasswordMintOnChain,
      burnAuthEnum: deployPlan.burnAuthEnum,
      hashedPasswords: deployPlan.hashedPasswords,
      tokenURI: deployPlan.tokenURI,
      metadataUploadStatus,
      finalGroupPasswordHash: deployPlan.finalGroupPasswordHash,
      createOptions: deployPlan.createOptions,
      distributionOption: deployPlan.distributionOption,
      passwordList: deployPlan.passwordList,
      groupPassword: deployPlan.groupPassword,
      usesInviteCodes: deployPlan.usesInviteCodes,
      authoringPayload,
      metadataPreview,
      sessionSlug: this.getEffectiveSessionSlug(),
      imageUrl: metadataPreview?.image || '',
    };
  };

  async mintSBT() {
    if (!this.props.loginComplete) {
      this.props.toggleLoginModal(true);
      return;
    }

    await this.setStateAsync({ currentStep: 3, mintingFailed: false });

    const {
      sbtName,
      sbtDistribution,
      passwordList,
      numInviteLinks,
      tokenURI,
      groupPassword: rawGroupPassword,
      create2Salt,
      metadataLockGateIds,
    } = this.state;

    const { isLimited, limitedNumber, burnAdmin, isTimeLimited, burnAuth, distributionOption } = sbtDistribution;

    // Validation: require name
    const sbtNameTrimmed = (sbtName || '').trim();
    if (!sbtNameTrimmed) {
      this.setState(buildCreateSbtMintValidationFailurePatch({ error: `${t('sbt')} Name is required.` }));
      return;
    }

    // Validation: require group password when using groupPassword distribution
    const groupPassword = cryptoUtils.normalizeGroupPasswordInput(rawGroupPassword);
    if (distributionOption === 'groupPassword' && !groupPassword) {
      this.setState(
        buildCreateSbtMintValidationFailurePatch({ error: 'Group password is required for group minting.' }),
      );
      return;
    }

    const mintModeOnChain = deriveSbtMintModeFromDistribution({ distributionOption, isLimited: !!isLimited });
    const usesClaimCodes = usesClaimPasswordsForSbtMintMode(mintModeOnChain);
    const usesInviteCodes = usesInviteCodesForSbtMintMode(mintModeOnChain);
    const hasPasswordMintOnChain = hasPasswordMintForSbtMintMode(mintModeOnChain);

    const burnAuthEnum = this.getBurnAuthEnum(burnAuth);

    const limitedCountRaw = isLimited ? Number(limitedNumber) : 0;
    const limitedCount = Number.isFinite(limitedCountRaw) ? Math.floor(limitedCountRaw) : 0;
    const tokenUriFull = String(tokenURI || '').trim();

    if (isLimited && limitedCount <= 0) {
      this.setState(
        buildCreateSbtMintValidationFailurePatch({ error: 'Limited groups require a positive token limit.' }),
      );
      return;
    }
    if (!tokenUriFull) {
      this.setState(
        buildCreateSbtMintValidationFailurePatch({ error: 'Token metadata must be uploaded before minting.' }),
      );
      return;
    }

    try {
      const groupCfg = this.getSessionConfigForNetwork();
      let deploymentExpectation: PredictableDeployPlan | null = null;
      let finalPasswordList: string[] = Array.isArray(passwordList) ? (passwordList as string[]) : [];
      let hashedPasswords: string[] = [];
      let mintingEndTimeUnix = 0;
      let groupPasswordHashForCreate = ethers.constants.HashZero;
      let sbtSymbol = '';
      let contractName = '';
      let effectiveCreate2Salt = create2Salt;
      let createOptions: PredictableCreateOptions = {};

      if (this.isPredictableAddressEnabled()) {
        deploymentExpectation = await this.resolvePredictableDeployPlan({ tokenURI: tokenUriFull });
        finalPasswordList = Array.isArray(deploymentExpectation.passwordList) ? deploymentExpectation.passwordList : [];
        hashedPasswords = Array.isArray(deploymentExpectation.hashedPasswords)
          ? deploymentExpectation.hashedPasswords
          : [];
        mintingEndTimeUnix = deploymentExpectation.mintingEndTimeUnix;
        groupPasswordHashForCreate = deploymentExpectation.finalGroupPasswordHash;
        sbtSymbol = deploymentExpectation.symbol;
        contractName = deploymentExpectation.contractName;
        effectiveCreate2Salt = deploymentExpectation.create2Salt;
        createOptions = deploymentExpectation.createOptions;
      } else {
        const sbtCount = await createSbtContractScripts.countSBTCreated(this.props.provider, groupCfg);
        sbtSymbol = `CE-SBT-${sbtCount + 1}`;
        contractName = getMetadataFieldLockGateIds(metadataLockGateIds, 'name').length > 0 ? sbtSymbol : sbtNameTrimmed;
        if (usesClaimCodes && (!finalPasswordList || finalPasswordList.length === 0)) {
          finalPasswordList = this.generatePasswords();
        }
        hashedPasswords = usesClaimCodes
          ? finalPasswordList.map((password: string) => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password)))
          : [];
        mintingEndTimeUnix =
          isTimeLimited && sbtDistribution.mintingEndTime
            ? Math.floor(sbtDistribution.mintingEndTime.getTime() / 1000)
            : 0;
      }

      this.setState(buildCreateSbtSymbolPatch({ sbtSymbol }));

      const receipt = await createSbtContractScripts.createSBT(
        this.props.provider,
        contractName,
        sbtSymbol,
        isLimited ? limitedCount : 0,
        burnAdmin || this.props.account,
        mintingEndTimeUnix,
        hasPasswordMintOnChain,
        burnAuthEnum,
        hashedPasswords,
        tokenUriFull,
        groupPasswordHashForCreate,
        groupCfg,
        effectiveCreate2Salt,
        createOptions,
      );

      const sbtAddress = resolveSbtAddressFromFactoryReceipt(receipt);

      if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) {
        throw new Error(`Failed to resolve ${t('sbt')} address from SBTCreated event.`);
      }
      if (
        deploymentExpectation?.predictedAddress &&
        deploymentExpectation.predictedAddress.toLowerCase() !== sbtAddress.toLowerCase()
      ) {
        throw new Error(
          `Deterministic deployment mismatch: expected ${deploymentExpectation.predictedAddress}, received ${sbtAddress}.`,
        );
      }

      const codesToStore = usesInviteCodes ? [groupPassword] : finalPasswordList;
      this.persistCreatedSbtCodes({ sbtAddress, hasPasswordMintOnChain, codesToStore });
      this.suppressFormCachePersistenceAfterSuccess();

      this.setState(
        buildCreateSbtMintSuccessPatch({
          sbtAddress,
          passwordList: codesToStore,
        }),
      );

      // Shareable links
      const publicAutoJoinUrl = this.buildSessionAutoJoinUrl(sbtAddress);
      const encodedGroupPassword = cryptoUtils.encodeGroupPasswordForUrl(groupPassword);

      if (distributionOption === 'groupPassword' && !isLimited) {
        const secureUrl = publicAutoJoinUrl; // no password in URL
        const oneClick = `${secureUrl}&gp=${encodeURIComponent(encodedGroupPassword)}`; // password embedded

        this.setState(buildCreateSbtShareableUrlPatch({ autoJoinUrl: oneClick }));
      } else if (distributionOption === 'groupPassword' && isLimited) {
        const autoJoinUrl = `${publicAutoJoinUrl}&gp=${encodeURIComponent(encodedGroupPassword)}`;
        this.setState(buildCreateSbtShareableUrlPatch({ autoJoinUrl }));
        await this.generateSBTInviteLinks(sbtAddress, [groupPassword]);
      } else if (distributionOption === 'anyoneCanMint') {
        const autoJoinUrl = publicAutoJoinUrl;
        this.setState(buildCreateSbtShareableUrlPatch({ autoJoinUrl }));
      } else if (distributionOption === 'hasPasswords') {
        await this.generateSBTInviteLinks(sbtAddress);
      }
    } catch (error) {
      sbtLog.error('[CreateSBTGroup] Mint failed:', error);
      this.setState(
        buildCreateSbtMintResetFailurePatch({
          error: getErrorMessage(error, 'Create failed.'),
        }),
      );
    }
  }

  async generateSBTInviteLinks(sbtAddress: unknown, listOverride: unknown = null): Promise<void> {
    const list = resolveCreateSbtInviteCodeList({
      listOverride,
      passwordList: this.state.passwordList,
    });
    const { sbtDistribution } = this.state;
    const distribution = (sbtDistribution || {}) as CreateSbtDistributionState;
    const isInvite = distribution.isLimited && distribution.distributionOption === 'groupPassword';
    const base = window.location.origin;
    const demoPath = buildSessionRoutePath(this.getEffectiveSessionSlug(), readPublicUrlBasePath());
    const encodeGroupPassword = (code: unknown) => {
      const normalized = cryptoUtils.normalizeGroupPasswordInput(code);
      return cryptoUtils.encodeGroupPasswordForUrl(normalized) || '';
    };
    const sbtAddressText = String(sbtAddress || '');
    const detailPath = this.buildSbtPagePath(sbtAddressText);
    const sbtInviteLinks = buildCreateSbtInviteLinks({
      base,
      demoPath,
      detailPath,
      encodeGroupPassword,
      isInvite,
      passwordList: list,
      sbtAddress: sbtAddressText,
    });
    const sbtInviteBackupDate = new Date().toISOString().slice(0, 10);
    this.setState(buildCreateSbtInviteLinksBackupPatch({ sbtInviteLinks, sbtInviteBackupDate }));
  }

  massSendSBTs = async (): Promise<void> => {
    const { csvAddresses } = this.state;
    const addresses = String(csvAddresses || '')
      .split(',')
      .map((address) => address.trim());
    try {
      // placeholder
    } catch (e) {
      sbtLog.warn('CreateSBTGroup: fallback', e);
    }
  };

  updateNumInviteLinks = (): void => {
    if (
      this.state.sbtDistribution.isLimited &&
      (this.state.sbtDistribution.distributionOption === 'hasPasswords' ||
        this.state.sbtDistribution.distributionOption === 'groupPassword')
    ) {
      this.setState(
        buildCreateSbtNumInviteLinksPatch({
          numInviteLinks: this.state.sbtDistribution.limitedNumber,
        }),
        this.persistFormCache,
      );
    }
  };

  handleNumInviteLinksChange = (event: CreateSbtValueChangeEvent): void => {
    const numInviteLinks = parseInt(event.target.value, 10);
    this.setState(buildCreateSbtNumInviteLinksPatch({ numInviteLinks }), this.persistFormCache);
  };

  copyToClipboard = (text: unknown, index: unknown): void => {
    navigator.clipboard.writeText(String(text || '')).then(() => {
      notify.success('Copied to clipboard');
      if (!this._isMounted) return;
      this.setState(buildCreateSbtCopiedLinkIndexPatch({ index }));
      this.scheduleTrackedStateReset('copiedLinkIndex', buildCreateSbtCopiedLinkIndexPatch(), 2000);
    });
  };

  handleExportFormatChange = (event: CreateSbtValueChangeEvent): void => {
    this.setState(
      buildCreateSbtExportFormatPatch({
        exportFormat: event.target.value,
      }),
      this.persistFormCache,
    );
  };

  exportPasswords = (): void => {
    const { passwordList, sbtInviteLinks, exportFormat, sbtSymbol, sbtName, sbtDistribution, autoJoinUrl } = this.state;
    const date = new Date().toISOString().slice(0, 10);
    const exportFile = buildCreateSbtPasswordExportFile({
      autoJoinUrl,
      date,
      exportFormat,
      passwordList,
      sbtDistribution,
      sbtInviteLinks,
      sbtName,
      sbtSymbol,
    });

    const blob = new Blob([exportFile.content], { type: exportFile.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFile.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  handleMintClick = async (): Promise<void> => {
    // Must be connected
    if (!this.props.account) {
      this.props.toggleLoginModal(true);
      return;
    }

    // Block re-entry if flow already started
    if (this.state.currentStep > 0) return;

    await this.commitPendingDocumentUrl();

    // Validation: require a name
    const sbtNameTrimmed = (this.state.sbtName || '').trim();
    if (!sbtNameTrimmed) {
      this.setState(
        buildCreateSbtErrorPatch({ error: `Please enter a group name (${t('sbt')} Name) before creating.` }),
      );
      return;
    }

    // Validation: groupPassword flow requires a non-empty password
    if (this.state.sbtDistribution.distributionOption === 'groupPassword') {
      const gpNormalized = cryptoUtils.normalizeGroupPasswordInput(this.state.groupPassword);
      if (!gpNormalized) {
        this.setState(buildCreateSbtErrorPatch({ error: 'Group password is required for group minting.' }));
        return;
      }
    }

    // Proceed
    this.setState(buildCreateSbtMintStartPatch());

    const fetchableImageUrl = this.getFetchableImageUrl(this.state.sbtImageUrl);
    if (this.state.useImageUrl && fetchableImageUrl && !this.state.sbtImageFile) {
      try {
        const file = await fetchImageFromURL(fetchableImageUrl);
        // Await state update so sbtImageFile is set before uploadImageToArweave reads it
        await new Promise<void>((resolve) => {
          this.setState(buildCreateSbtImageFilePatch({ file }), () => {
            this.updateGroupHash();
            this.persistFormCache();
            resolve();
          });
        });
      } catch (error) {
        this.setState(buildCreateSbtImageLoadErrorPatch({ clearFile: false }), this.persistFormCache);
      }
    }

    try {
      if (this.isDeferredDeployMode()) {
        await this.handleDeferredSave();
      } else {
        await this.uploadImageToArweave();
        await this.uploadTokenUriToArweave();
        await this.mintSBT();
      }
    } catch (error) {
      if (this.state.error) return;
      this.setState(
        buildCreateSbtMintResetFailurePatch({
          error: getErrorMessage(error, `Unable to create this ${t('sbt')}.`),
        }),
      );
    }
  };

  async handleImageLoaded(imgRef: HTMLImageElement): Promise<void> {
    try {
      imgRef.crossOrigin = 'anonymous';
      const imageElement = imgRef;
      if (!imageElement.complete || imageElement.naturalWidth === 0) {
        this.setState(buildCreateSbtImageLoadErrorPatch(), this.persistFormCache);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Unable to create image canvas context.');
      }

      imageElement.setAttribute('crossOrigin', 'anonymous');

      ctx.drawImage(imageElement, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b: Blob | null) => {
          if (!b) {
            reject(new Error('Failed to create blob from canvas'));
            return;
          }
          resolve(b);
        }, 'image/png');
      });
      if (!blob) {
        this.setState(buildCreateSbtImageLoadErrorPatch(), this.persistFormCache);
        return;
      }
      const file = new File([blob], 'url_image.png', { type: 'image/png' });
      this.setState(buildCreateSbtImageFilePatch({ file }), () => {
        this.updateGroupHash();
        this.persistFormCache();
      });
    } catch (error) {
      this.setState(buildCreateSbtImageLoadErrorPatch(), this.persistFormCache);
    }
  }

  commitPendingDocumentUrl = async ({ persist = true }: { persist?: boolean } = {}): Promise<boolean> => {
    this.resetFormStateForEdit();
    const pendingDocumentUrl = this.getNormalizedDocumentUrlDraft();
    if (!pendingDocumentUrl || this.state.documentURLs.length >= 10) {
      return false;
    }

    await this.setStateAsync((prevState: { documentURLs: string[] }) =>
      buildCreateSbtDocumentUrlAdditionPatch({
        documentURLs: prevState.documentURLs,
        documentUrl: pendingDocumentUrl,
      }),
    );
    this.updateGroupHash();
    if (persist) this.persistFormCache();
    return true;
  };

  addDocumentURL = (): void => {
    void this.commitPendingDocumentUrl();
  };

  handleDocUrlKeyDown = (event: CreateSbtTagKeyEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addDocumentURL();
    }
  };

  removeDocumentURL = (index: number): void => {
    this.resetFormStateForEdit();
    this.setState(
      (prevState: { documentURLs: string[] }) =>
        buildCreateSbtDocumentUrlRemovalPatch({
          documentURLs: prevState.documentURLs,
          index,
        }),
      () => {
        this.updateGroupHash();
        this.persistFormCache();
      },
    );
  };

  processQrImage = (elementId: string): Promise<Blob> => {
    return new Promise<Blob>((resolve, reject) => {
      const svg = document.getElementById(elementId);
      if (!svg) return reject(new Error('QR Code not found'));

      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      // Add white background for PNG transparency safety
      img.onload = () => {
        if (!ctx) {
          reject(new Error('QR canvas context unavailable'));
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob: Blob | null) => {
          if (!blob) {
            reject(new Error('QR image export failed'));
            return;
          }
          resolve(blob);
        }, 'image/png');
      };

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });
  };

  downloadQR = async (elementId: string, filename: string): Promise<void> => {
    try {
      const blob = await this.processQrImage(elementId);
      if (!(blob instanceof Blob)) throw new Error('QR image export failed');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      sbtLog.warn('QR download failed', error);
      notify.warn('QR download failed');
    }
  };

  copyQRImage = async (elementId: string, indexKey: unknown): Promise<void> => {
    try {
      const blob = await this.processQrImage(elementId);
      if (!(blob instanceof Blob)) throw new Error('QR image export failed');
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        throw new Error('Clipboard image write is unavailable');
      }
      // Clipboard API usually requires secure context (https or localhost)
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      if (!this._isMounted) return;
      this.setState(buildCreateSbtCopiedLinkIndexPatch({ index: indexKey }));
      this.scheduleTrackedStateReset('copiedLinkIndex', buildCreateSbtCopiedLinkIndexPatch(), 2000);
    } catch (error: unknown) {
      sbtLog.warn('QR clipboard write failed', error);
      notify.warn('QR copy failed');
    }
  };

  handleNetworkChange = async (event: CreateSbtSelectChangeEvent): Promise<void> => {
    const targetChainId = normalizePositiveChainId(event.target.value);
    if (!targetChainId) return;
    const nextChain = this.getAuthoringChainOptions().find(
      (chain: CreateSbtChainOption) => chain.id === targetChainId,
    ) ||
      getChainById(targetChainId) || { id: targetChainId, name: `Chain ${targetChainId}` };
    if (window.ethereum && this.props.account) {
      try {
        // Hexlify the chain ID for the wallet request.
        const chainIdHex = ethers.utils.hexValue(Number(targetChainId));
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
      } catch (error) {
        sbtLog.error('Failed to switch network', error);
        return;
      }
    }
    this.setState((currentState: { sbtDistribution: Record<string, unknown> }) =>
      buildCreateSbtNetworkChangePatch({
        chain: nextChain,
        currentDistribution: currentState.sbtDistribution,
        network: targetChainId,
      }),
    );
  };

  /* FUNCTION: renderShareableBlock */
  renderShareableBlock = (
    title: string,
    tooltipText: string,
    description: string | null,
    url: string,
    qrId: string,
    fileSuffix: string,
    testId: string | null = null,
  ): JSX.Element => {
    const { copiedLinkIndex, sbtAddress } = this.state;
    return (
      <CreateSbtShareableBlock
        copiedLinkIndex={copiedLinkIndex}
        fileSuffix={fileSuffix}
        onCopyQrImage={this.copyQRImage}
        onCopyUrl={this.copyToClipboard}
        onDownloadQr={this.downloadQR}
        qrId={qrId}
        sbtAddress={sbtAddress}
        styles={styles}
        testId={testId}
        title={title}
        tooltipText={tooltipText}
        url={url}
      />
    );
  };

  render() {
    const {
      sbtName,
      sbtDescription,
      sbtImageFile,
      sbtImageUrl,
      useImageUrl,
      sbtDistribution,
      imageUploaded,
      tokenURI,
      tokenUriUploaded,
      sbtMinted,
      sbtAddress,
      csvAddresses,
      tokenInfoCollapsed,
      mintOptionsCollapsed,
      distributionOptionsCollapsed,
      currentStep,
      mintingFailed,
      sbtInviteLinks,
      numInviteLinks,
      network,
      copiedLinkIndex,
      copyIdSuccess,
      copyLinkSuccess,
      exportFormat,
      sbtSymbol,
      passwordList,
      tags,
      currentTagInput,
      documentIDHashes,
      documentUrl,
      showTagsInput,
      imageLoadError,
      imageChooserStatusText,
      imageChooserStatusTone,
      documentURLs,
      startedMinting,
      groupPassword,
      shareableUrl,
      autoJoinUrl,
      openLockKey,
      metadataLockGateIds,
      showJson,
      copyJsonSuccess,
      create2Salt,
      predictedAddressBusy,
    } = this.state;

    const authoringChain = this.getSelectedAuthoringChain();
    const authoringChainId = authoringChain?.id || this.getSelectedAuthoringChainId() || '';
    const effectiveSessionSlug = this.getEffectiveSessionSlug();

    const deferredDeployMode = this.isDeferredDeployMode();
    const predictableAddressActive = this.isPredictableAddressEnabled();
    const {
      chainOptions,
      createSbtRenderState,
      documentUrlInputState,
      imagePreviewState,
      jsonData,
      lockGateOptions,
      metadataLockSelectionState,
      metadataPreview,
      openMintAutoJoinUrl,
      tagInputState,
    } = this.getCreateSbtRenderDerivations({
      account: this.props.account,
      authoringChain,
      authoringChainId,
      autoJoinUrl,
      create2Salt,
      currentTagInput,
      deferredDeployMode,
      documentIDHashes,
      documentURLs,
      documentUrl,
      effectiveSessionSlug,
      groupPassword,
      imageChooserStatusText,
      imageChooserStatusTone,
      imageLoadError,
      metadataLockGateIds,
      network,
      predictableAddressActive,
      sbtAddress,
      sbtDescription,
      sbtDistribution,
      sbtImageFile,
      sbtImageUrl,
      sbtName,
      shareableUrl,
      tags,
      tokenURI,
      useImageUrl,
    });
    const { gateOptions, defaultGateId } = lockGateOptions;
    const {
      validGateIds,
      nameSelectedGateIds,
      descriptionSelectedGateIds,
      tagsSelectedGateIds,
      docsSelectedGateIds,
      imageSelectedGateIds,
    } = metadataLockSelectionState;
    const { effectiveImageStatusText, effectiveImageStatusTone, previewFile } = imagePreviewState;
    const { createActionLabel, headerTitle, isDirty, predictableAddressLocked, rootSurfaceStyle } =
      createSbtRenderState;
    const distributionOptions = createSbtRenderState.distributionOptions as SelectableDistributionOptionConfig[];
    const hiddenQrDisplayState = resolveCreateSbtHiddenQrDisplayState();
    const successActionLinkClassName = buildCreateSbtActionLinkClassName({
      actionClassName: styles.actionBtn,
      linkClassName: styles.actionLink,
    });
    const inlineFieldLockClassName = buildCreateSbtInlineFieldLockClassName({
      baseClassName: styles.fieldLockControl,
      inlineClassName: styles.inlineFieldLockControl,
    });
    const tokenInfoMetaCardClassName = buildCreateSbtTokenInfoMetaCardClassName({
      fieldSectionClassName: styles.fieldSection,
      metaCardClassName: styles.tokenInfoMetaCard,
    });
    const primaryActionLabel = resolveCreateSbtPrimaryActionLabel({
      createActionLabel,
      currentStep,
      deferredDeployMode,
      mintedLabel: 'Created',
      mintingLabel: 'Creating',
      sbtMinted,
    });
    const primaryButtonState = resolveCreateSbtPrimaryButtonState({
      sbtMinted,
      startedMinting,
    });
    const clearFormButtonState = resolveCreateSbtClearFormButtonState({
      isDirty,
      sbtMinted,
    });
    const progressIndicatorState = buildCreateSbtProgressIndicatorState({
      currentStep,
      sbtMinted,
    });
    const successDisplayState = resolveCreateSbtSuccessDisplayState({
      distributionOption: sbtDistribution.distributionOption,
      openMintAutoJoinUrl,
      passwordList,
      sbtInviteLinks,
      sbtMinted,
      showJson,
      startedMinting,
      tokenURI,
    });
    const copyLinkActionState = resolveCreateSbtCopyActionDisplayState({
      copied: copyLinkSuccess,
      defaultLabel: 'Copy Link',
    });
    const copyQrActionState = resolveCreateSbtCopyActionDisplayState({
      copied: copiedLinkIndex === 'page_qr_copy',
      defaultLabel: 'Copy QR',
    });
    const copyIdActionState = resolveCreateSbtCopyActionDisplayState({
      copied: copyIdSuccess,
      copiedLabel: 'Copied!',
      defaultLabel: 'Copy ID',
    });
    const bookmarkActionState = resolveCreateSbtBookmarkActionDisplayState({
      bookmarkedSbtsSet: this.state.bookmarkedSbtsSet,
      sbtAddress,
    });
    const infoDisplayState = resolveCreateSbtInfoDisplayState({
      documentURLs,
      imageSelectedGateIds,
      nameSelectedGateIds,
      tags,
    });
    const mintOptionsDisplayState = resolveCreateSbtMintOptionsDisplayState({
      hideNetworkSelector: this.shouldHideNetworkSelector(),
      isLimited: sbtDistribution.isLimited,
      isTimeLimited: sbtDistribution.isTimeLimited,
      predictableAddressActive,
      predictedAddressBusy,
    });
    const actionDisplayState = resolveCreateSbtActionDisplayState({
      currentStep,
      distributionOption: sbtDistribution.distributionOption,
      mintingFailed,
      sbtMinted,
      startedMinting,
    });
    const errorBannerState = resolveCreateSbtErrorBannerState({ error: this.state.error });
    const renderFieldLock = (lockKey: string, fieldKey: string, selectedGateIds: string[]): JSX.Element => (
      <GateMultiSelectLock
        gateOptions={gateOptions}
        selectedGateIds={selectedGateIds}
        onChangeSelectedGateIds={(nextIds: unknown) => this.setLockGateIds(fieldKey, nextIds, validGateIds)}
        open={openLockKey === lockKey}
        onToggleOpen={(nextOpen: unknown) =>
          this.toggleLockPopover({
            lockKey,
            fieldKey,
            nextOpen,
            selectedGateIds,
            defaultGateId,
            validGateIds,
          })
        }
        disabled={!gateOptions.length}
        showDots={false}
      />
    );
    const onPredictableAddressToggle = (checked: boolean): void => {
      this.setState({ predictableAddressEnabled: checked }, () => {
        this.persistFormCache();
        this.schedulePredictedAddressRefresh();
      });
    };

    return (
      <div className={styles.createGroupExpanded} style={rootSurfaceStyle}>
        <div className={styles.headerContainer}>
          <div className={styles.titleCluster}>
            <h1 className={styles.createGroupTitle}>{headerTitle}</h1>
            <FontAwesomeIcon
              icon={faQuestionCircle}
              className={`${styles.tooltip} ${styles.createGroupTitleTooltip}`}
              id="learnMoreTooltip"
              style={resolveCreateSbtTooltipIconStyle()}
            />
          </div>
          <CETooltip
            placement="right"
            target="learnMoreTooltip"
            delay={{ show: 0, hide: 5000 }}
            className={styles.tooltipBubble}
          >
            {SBT_TOOLTIP_LABEL} enable groups to organize membership, roles, and permissions on-chain. <br />
            <a href="https://www.radicalxchange.org/wiki/social-identity/" target="_blank" rel="noopener noreferrer">
              Learn More
            </a>
          </CETooltip>

          {clearFormButtonState.shouldShowClearFormButton && (
            <button
              onClick={this.resetForm}
              className={styles.clearFormButton}
              title="Clear all fields and reset to defaults"
            >
              <FontAwesomeIcon icon={faEraser} /> Clear
            </button>
          )}
        </div>

        {/* Visible error surface for contract rejections and other failures */}
        {errorBannerState.shouldRenderErrorBanner && (
          <div style={errorBannerState.style} data-testid={E2E_TESTIDS.SBT_CREATE_ERROR}>
            {errorBannerState.errorMessage}
          </div>
        )}

        <div className={styles.collapsibleSection}>
          {this.renderCollapsibleHeader('Info', 'tokenInfoCollapsed')}
          {!tokenInfoCollapsed && (
            <div className={styles.inputColumn}>
              <div className={styles.tokenInfoTopGrid}>
                <div className={styles.tokenInfoPrimaryColumn}>
                  <div className={styles.fieldLockRow} data-testid={E2E_TESTIDS.SBT_CREATE_NAME_LOCK_ROW}>
                    <input
                      type="text"
                      name="sbtName"
                      value={sbtName}
                      onChange={this.handleInputChange}
                      placeholder="Name"
                      id={styles.sbtName}
                      data-testid={E2E_TESTIDS.SBT_CREATE_NAME_INPUT}
                    />
                    <div className={styles.fieldLockControl}>
                      {renderFieldLock('name', 'name', nameSelectedGateIds)}
                    </div>
                  </div>
                  {infoDisplayState.shouldRenderNameLockHelp && (
                    <div className={styles.fieldHelpText}>
                      Locked names deploy with a public placeholder contract name like <code>CE-SBT-12</code> and render
                      as {LOCKED_FIELD_MASK} until decrypted.
                    </div>
                  )}
                  <div className={styles.fieldLockRow} data-testid={E2E_TESTIDS.SBT_CREATE_DESCRIPTION_LOCK_ROW}>
                    <textarea
                      name="sbtDescription"
                      value={sbtDescription}
                      onChange={this.handleInputChange}
                      placeholder="Event / Group Description"
                      id={styles.sbtDescription}
                      className={styles.lockableTextarea}
                      rows={4}
                      data-testid={E2E_TESTIDS.SBT_CREATE_DESCRIPTION_INPUT}
                    />
                    <div className={styles.fieldLockControl}>
                      {renderFieldLock('description', 'description', descriptionSelectedGateIds)}
                    </div>
                  </div>
                </div>

                <div className={styles.tokenInfoCompactColumn}>
                  <div className={styles.imageUploadContainer} data-testid={E2E_TESTIDS.SBT_CREATE_IMAGE_LOCK_ROW}>
                    <div className={styles.imageUploadHeader}>
                      <label className={styles.imageUploadLabel}>Image</label>
                      <div className={styles.fieldLockControl}>
                        {renderFieldLock('image', 'image', imageSelectedGateIds)}
                      </div>
                    </div>
                    <CompactImageChooser
                      isUrlMode={useImageUrl}
                      isUploadMode={!useImageUrl}
                      showUrlInput={useImageUrl}
                      urlValue={sbtImageUrl}
                      urlInputName="sbtImageUrl"
                      onUrlChange={this.handleInputChange}
                      onToggleUrlMode={() => this.setImageUploadMethod(true)}
                      onPaste={this.handlePasteImage}
                      onUploadClick={this.openImageUploadPicker}
                      onFileChange={this.handleImageUpload}
                      fileInputRef={(fileInput: HTMLInputElement | null) => {
                        this.fileInput = fileInput;
                      }}
                      fileInputTestId={E2E_TESTIDS.SBT_CREATE_IMAGE_FILE_INPUT}
                      pasteButtonTestId={E2E_TESTIDS.SBT_CREATE_IMAGE_PASTE}
                      urlInputTestId={E2E_TESTIDS.SBT_CREATE_IMAGE_URL_INPUT}
                      urlPlaceholder="Paste image URL"
                      urlInputAriaLabel="Image URL"
                      selectedFileLabel={!useImageUrl && sbtImageFile ? sbtImageFile.name : ''}
                      previewFile={previewFile}
                      previewAlt="SBT artwork preview"
                      onClear={this.resetImage}
                      statusText={effectiveImageStatusText}
                      statusTone={effectiveImageStatusTone}
                      helpText={
                        infoDisplayState.shouldRenderImageLockHelp
                          ? 'URL mode encrypts the image URL. Upload mode encrypts the image bytes into a Lit-Arweave asset.'
                          : ''
                      }
                    />
                  </div>
                </div>
              </div>

              <div className={styles.tokenInfoMetaGrid}>
                <div className={styles.tokenInfoMetaCard} data-testid={E2E_TESTIDS.SBT_CREATE_DOCS_LOCK_ROW}>
                  <div className={`${styles.addDocUrlSection} ${styles.docUrlField}`}>
                    <input
                      type="text"
                      name="documentUrl"
                      value={documentUrl}
                      onChange={this.handleInputChange}
                      onKeyDown={this.handleDocUrlKeyDown}
                      placeholder="Document URL"
                      aria-label="Document URL"
                      data-testid={E2E_TESTIDS.SBT_CREATE_DOC_URL_INPUT}
                    />
                    <button
                      type="button"
                      onClick={this.addDocumentURL}
                      disabled={!documentUrlInputState.canAddDocumentUrl}
                      className={styles.addDocUrlActionButton}
                      data-testid={E2E_TESTIDS.SBT_CREATE_DOC_URL_ADD}
                    >
                      <FontAwesomeIcon icon={faPlus} className={styles.addDocUrlButton} />
                    </button>
                    <div className={inlineFieldLockClassName}>
                      {renderFieldLock('docs', 'documentURLs', docsSelectedGateIds)}
                    </div>
                  </div>
                  {infoDisplayState.shouldRenderDocumentUrlList && (
                    <ul className={styles.docUrlList}>
                      {documentURLs.map((url: string, index: number) => (
                        <li key={index}>
                          <span>{url}</span>
                          <button type="button" onClick={() => this.removeDocumentURL(index)}>
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={tokenInfoMetaCardClassName} data-testid={E2E_TESTIDS.SBT_CREATE_TAGS_LOCK_ROW}>
                  <div className={styles.tagsContainer}>
                    <div className={styles.tagsInlineRow}>
                      <div className={styles.tagInputGroup}>
                        <input
                          type="text"
                          className={styles.tagInput}
                          value={currentTagInput}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            this.setState(
                              buildCreateSbtCurrentTagInputPatch({
                                value: e.target.value,
                              }),
                            )
                          }
                          onKeyDown={this.handleTagInputKeyDown}
                          placeholder="Add tag..."
                          aria-label="Add tag"
                          data-testid={E2E_TESTIDS.SBT_CREATE_TAG_INPUT}
                        />
                        {tagInputState.shouldShowAddTagButton && (
                          <button
                            type="button"
                            className={styles.addTagButton}
                            onClick={this.handleAddTag}
                            data-testid={E2E_TESTIDS.SBT_CREATE_TAG_ADD}
                          >
                            <FontAwesomeIcon icon={faPlus} />
                          </button>
                        )}
                      </div>
                      <div className={inlineFieldLockClassName}>
                        {renderFieldLock('tags', 'tags', tagsSelectedGateIds)}
                      </div>
                    </div>
                    {infoDisplayState.shouldRenderTagPills &&
                      tags.map((tag: string, index: number) => (
                        <span key={index} className={styles.tagPill}>
                          {tag}
                          <FontAwesomeIcon
                            icon={faTimes}
                            className={styles.removeTagIcon}
                            onClick={() => this.removeTag(index)}
                          />
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.collapsibleSection}>
          {this.renderCollapsibleHeader('Create Options', 'mintOptionsCollapsed')}
          {!mintOptionsCollapsed &&
            renderCreateSbtMintOptionsSection({
              sbtDistribution,
              mintOptionsDisplayState,
              authoringChainId,
              authoringChain,
              chainOptions,
              predictableAddressActive,
              predictableAddressLocked,
              predictedAddressDisplayText: this.getPredictedAddressDisplayText(),
              handleInputChange: this.handleInputChange,
              handleBurnAuthChange: this.handleBurnAuthChange,
              handleNetworkChange: this.handleNetworkChange,
              handleMintingEndTimeChange: this.handleMintingEndTimeChange,
              onPredictableAddressToggle,
            })}
        </div>

        <div className={styles.collapsibleSection}>
          {this.renderCollapsibleHeader('Distribution Options', 'distributionOptionsCollapsed')}
          {!distributionOptionsCollapsed &&
            renderCreateSbtDistributionOptionsSection({
              distributionOptions,
              actionDisplayState,
              groupPassword,
              sbtDistribution,
              handleInputChange: this.handleInputChange,
            })}
        </div>

        <div className={styles.mintingSteps}>
          <button
            onClick={this.handleMintClick}
            disabled={primaryButtonState.disabled}
            data-testid={E2E_TESTIDS.SBT_CREATE_SUBMIT}
            className={styles.primaryCreateButton}
          >
            <span className={styles.primaryCreateButtonContent}>
              {primaryActionLabel}
              {actionDisplayState.shouldRenderMintingFailureIcon && (
                <FontAwesomeIcon icon={faExclamationCircle} style={resolveCreateSbtFailureIconStyle()} />
              )}
            </span>
          </button>

          {actionDisplayState.shouldRenderStartFreshButton && (
            <button onClick={this.resetForm} className={styles.startFreshBtn} title="Reset form to start fresh">
              Create New (Start Fresh)
            </button>
          )}
        </div>

        <div className={styles.jsonPreviewBlock}>
          <JsonDisplay data={metadataPreview} label="View .json" />
        </div>

        {actionDisplayState.shouldRenderProgressIndicator && (
          <div className={styles.progressIndicator}>
            <div
              className={buildCreateSbtProgressStepClassName({
                completed: progressIndicatorState.imageUploadStep.completed,
                completedClassName: styles.stepCompleted,
                pendingClassName: styles.step,
              })}
            >
              <FontAwesomeIcon
                icon={getCreateSbtProgressIcon(progressIndicatorState.imageUploadStep.iconState)}
                spin={progressIndicatorState.imageUploadStep.spin}
              />
              <span>Upload Image</span>
            </div>
            <div
              className={buildCreateSbtProgressStepClassName({
                completed: progressIndicatorState.tokenUriUploadStep.completed,
                completedClassName: styles.stepCompleted,
                pendingClassName: styles.step,
              })}
            >
              <FontAwesomeIcon
                icon={getCreateSbtProgressIcon(progressIndicatorState.tokenUriUploadStep.iconState)}
                spin={progressIndicatorState.tokenUriUploadStep.spin}
              />
              <span>Upload URI</span>
            </div>
            <div
              className={buildCreateSbtProgressStepClassName({
                completed: progressIndicatorState.mintStep.completed,
                completedClassName: styles.stepCompleted,
                pendingClassName: styles.step,
              })}
            >
              <FontAwesomeIcon
                icon={getCreateSbtProgressIcon(progressIndicatorState.mintStep.iconState)}
                spin={progressIndicatorState.mintStep.spin}
              />
              <span>Create</span>
            </div>
          </div>
        )}

        {successDisplayState.shouldRenderContractAddress && (
          <div className={styles.sbtContractAddress}>
            <span>Contract Address: </span>
            {sbtAddress ? (
              <a href={this.buildSbtPagePath(sbtAddress)} target="_blank" rel="noopener noreferrer">
                <FontAwesomeIcon icon={faExternalLinkAlt} /> {`Page (${sbtAddress})`}
              </a>
            ) : (
              <span>-</span>
            )}
          </div>
        )}

        {successDisplayState.shouldRenderSuccessPanel && (
          <div className={styles.surveySubmissionConfirmation} data-testid={E2E_TESTIDS.SBT_CREATE_SUCCESS}>
            <h3>Created</h3>

            {/* Compact Actions Row */}
            <div className={styles.successActionsRow}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={this.copySbtLinkToClipboard}
                title="Copy Link to Page"
              >
                {copyLinkActionState.shouldRenderCopiedIcon && (
                  <FontAwesomeIcon icon={faCheck} style={resolveCreateSbtActionIconStyle()} />
                )}
                {copyLinkActionState.shouldRenderDefaultIcon && (
                  <FontAwesomeIcon icon={faClipboard} style={resolveCreateSbtActionIconStyle()} />
                )}
                {copyLinkActionState.label}
              </button>

              {/* Copy QR button */}
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => this.copyQRImage('hidden-page-qr', 'page_qr_copy')}
                title="Copy QR for Page Link"
              >
                {copyQrActionState.shouldRenderCopiedIcon && (
                  <FontAwesomeIcon icon={faCheck} style={resolveCreateSbtActionIconStyle()} />
                )}
                {copyQrActionState.shouldRenderDefaultIcon && (
                  <FontAwesomeIcon icon={faQrcode} style={resolveCreateSbtActionIconStyle()} />
                )}
                {copyQrActionState.label}
              </button>

              <a
                href={this.buildSbtPagePath(sbtAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className={successActionLinkClassName}
                title="Open Page in New Tab"
                data-testid={E2E_TESTIDS.SBT_CREATE_SUCCESS_PAGE_LINK}
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
                View Page
              </a>

              {successDisplayState.shouldRenderTokenUriLink && (
                <a
                  href={normalizeArweaveUrl(tokenURI)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={successActionLinkClassName}
                  title="View on Arweave"
                  data-testid={E2E_TESTIDS.SBT_CREATE_SUCCESS_ARWEAVE_LINK}
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                  Arweave
                </a>
              )}

              <button
                type="button"
                onClick={() => this.bookmarkSBT(sbtAddress)}
                className={styles.actionBtn}
                title="Bookmark"
              >
                <FontAwesomeIcon icon={faBookmark} style={bookmarkActionState.iconStyle} />
                Bookmark
              </button>

              <button
                type="button"
                onClick={this.copySbtIdToClipboard}
                className={styles.actionBtn}
                title="Copy Address"
              >
                {copyIdActionState.shouldRenderCopiedIcon && <FontAwesomeIcon icon={faCheck} />}
                {copyIdActionState.shouldRenderDefaultIcon && <FontAwesomeIcon icon={faClipboard} />}
                {copyIdActionState.label}
              </button>
            </div>

            {/* Hidden QR Code for the Page Link (Used by the top row button) */}
            <div style={hiddenQrDisplayState.hiddenStyle}>
              <QRCodeSVG
                id="hidden-page-qr"
                value={shareableUrl}
                size={1024}
                bgColor={'#ffffff'}
                fgColor={'#000000'}
                level="L"
                includeMargin={true}
              />
            </div>

            {/* Visual QR Blocks: "Auto-Join" only. "Page Link" block is removed. */}
            {successDisplayState.shouldRenderOpenMintAutoJoin && (
              <>
                {/* Auto-Join URL */}
                {this.renderShareableBlock(
                  'URL Where Anyone Can Join',
                  'Anyone with this link can open the session page and trigger the open-mint flow immediately.',
                  null,
                  openMintAutoJoinUrl,
                  'qr-code-auto-join',
                  'autojoin',
                  E2E_TESTIDS.SBT_CREATE_OPEN_MINT_URL,
                )}
              </>
            )}

            {successDisplayState.shouldRenderGroupPasswordAutoJoin && (
              <>
                {/* Auto-Join URL (Group Password) */}
                {this.renderShareableBlock(
                  sbtDistribution.isLimited ? 'Auto-Join URL (Group Password)' : 'Auto-Join URL (One-Click)',
                  'Password embedded - use with caution. Anyone with this link can join immediately.',
                  null,
                  autoJoinUrl,
                  'qr-code-one-click',
                  'oneclick',
                )}
              </>
            )}

            <JsonButtonRow align="center">
              <JsonToggleButton
                label={showJson ? 'Hide JSON' : 'Show JSON'}
                active={showJson}
                onClick={this.toggleShowJson}
              />
            </JsonButtonRow>
          </div>
        )}

        {/* JSON preview area */}
        {successDisplayState.shouldRenderJsonPanel && (
          <JsonPanel
            as="pre"
            onCopy={() => this.copyJsonPreview(jsonData)}
            copied={copyJsonSuccess}
            copyTitle="Copy JSON"
          >
            {JSON.stringify(jsonData, null, 2)}
          </JsonPanel>
        )}

        {successDisplayState.shouldRenderPasswordRecovery && (
          <div className={styles.sbtInviteLinks}>
            <h3>Password Recovery</h3>
            <SbtEncryptedRecoveryControl
              checked={this.state.encryptedRecoveryEnabled === true}
              mode="create"
              onChange={this.handleEncryptedRecoveryChange}
              status={String(this.state.encryptedRecoveryStatus || 'idle')}
            />
            <div className={styles.exportOptions}>
              <select
                value={exportFormat}
                onChange={this.handleExportFormatChange}
                className={styles.exportFormatSelect}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
              <button onClick={this.exportPasswords} className={styles.exportButton}>
                Export Passwords
              </button>
            </div>
          </div>
        )}

        {successDisplayState.shouldRenderInviteLinks && (
          <div className={styles.sbtInviteLinks}>
            <h3>Invite Links:</h3>
            <ul>
              {sbtInviteLinks.map((link: string, index: number) => {
                const inviteCopyActionState = resolveCreateSbtCopyActionDisplayState({
                  copied: copiedLinkIndex === index,
                });
                return (
                  <li key={index} className={styles.inviteLinkItem}>
                    <span className={styles.inviteLink}>{link}</span>
                    <button onClick={() => this.copyToClipboard(link, index)} className={styles.copyButton}>
                      {inviteCopyActionState.shouldRenderCopiedIcon && <FontAwesomeIcon icon={faCheck} />}
                      {inviteCopyActionState.shouldRenderDefaultIcon && <FontAwesomeIcon icon={faClipboard} />}
                    </button>
                  </li>
                );
              })}
            </ul>
            <SbtEncryptedRecoveryControl
              checked={this.state.encryptedRecoveryEnabled === true}
              mode="create"
              onChange={this.handleEncryptedRecoveryChange}
              status={String(this.state.encryptedRecoveryStatus || 'idle')}
            />
            <div className={styles.exportOptions}>
              <select
                value={exportFormat}
                onChange={this.handleExportFormatChange}
                className={styles.exportFormatSelect}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
              <button onClick={this.exportPasswords} className={styles.exportButton}>
                Export Passwords
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}

export const finalizeDeferredCreateSbtDraftUpload = async ({
  authoringPayload = null,
  componentProps = {},
}: FinalizeDeferredCreateSbtDraftUploadArgs = {}): Promise<FinalizeDeferredCreateSbtDraftUploadResult> => {
  if (!authoringPayload || typeof authoringPayload !== 'object') {
    throw new Error('Pending SBT draft authoring payload is missing.');
  }

  const instance = new CreateSBTGroup({
    deferredDeploy: true,
    hideNetworkSelector: true,
    loginComplete: true,
    toggleLoginModal: () => {},
    ...componentProps,
  });
  instance.setState = (update: FinalizeDeferredCreateSbtStateUpdate, cb: FinalizeDeferredCreateSbtStateCallback) => {
    const next = typeof update === 'function' ? update(instance.state as Record<string, unknown>) : update;
    instance.state = { ...instance.state, ...next };
    if (cb) cb();
  };
  instance._isMounted = true;

  if (!instance.applyAuthoringPayload(authoringPayload)) {
    throw new Error('Pending SBT draft authoring payload is invalid.');
  }

  await instance.uploadImageToArweave();
  const tokenURI = String(await instance.uploadTokenUriToArweave()).trim();
  if (!tokenURI) {
    throw new Error('Pending SBT draft metadata upload did not return a token URI.');
  }

  return {
    tokenURI,
    metadataPreview: instance.buildMetadataPreview(),
    authoringPayload: await instance.buildSerializableAuthoringPayload(),
  };
};

export default CreateSBTGroup;
