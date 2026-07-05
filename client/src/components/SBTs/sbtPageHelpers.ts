import {
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import { ethers } from 'ethers';
import {
  buildSbtPageHolderListSignature,
  buildSbtPageNextFilteredHolderRows,
  computeSbtPageNetCounts,
  computeSbtPageNetHoldersList,
} from './sbtPageHolderHelpers';
import {
  buildSessionRoutePath,
  resolveSbtAddress,
} from './sbtPageAddressSessionHelpers';
export {
  buildSessionRoutePath,
  getCurrentSbtAddressInfo,
  resolveSbtAddress,
  resolveSbtAddressString,
  resolveSbtPageAddressLinkState,
} from './sbtPageAddressSessionHelpers';
export {
  resolveSbtPageAdminCreatorAddresses,
  resolveSbtPageBurnAuthLabel,
  resolveSbtPageMaxTokensDisplay,
  resolveSbtPageRelevantInfoDisplayState,
  resolveSbtPageRelevantInfoLists,
  toSbtPageDocumentUrlList,
  toStringList,
} from './sbtPageMetadataDisplayHelpers';
export {
  getExplicitSbtPageSessionSlug,
  hasExplicitSbtPageSessionSlugProp,
  resolveSbtPageEffectiveSessionSlug,
  resolveSbtPageSessionDisplayConfig,
  resolveSbtPageSessionDisplayLabel,
  resolveSbtPageSessionSlugFromInfo,
} from './sbtPageSessionDisplayHelpers';
export type {
  SbtPageSessionDisplayConfig,
} from './sbtPageSessionDisplayHelpers';
export {
  applySbtPageHistorySummaryFallback,
  normalizeSbtPageHistorySummary,
} from './sbtPageHistorySummaryHelpers';
export type {
  SbtPageHistorySummary,
  SbtPageHistorySummaryInput,
} from './sbtPageHistorySummaryHelpers';
export {
  coerceSbtPageEpochSeconds,
  coerceSbtPageStringArrayValue,
  getErrorMessage,
  resolveSbtPageCopyableErrorText,
} from './sbtPageValueCoercionHelpers';
export {
  buildSbtPageAutoMintCleanPath,
  collectAutoMintPairsFromSearchParams,
  decodeSbtPageInviteInput,
  hasSbtPageAutoMintFlag,
  normalizeSbtInviteCode,
  resolveSbtPageUrlAutoMintIntent,
  sanitizeSbtPageMintedTokensOverride,
  shouldRunSbtPagePropListAutoMint,
  shouldRunSbtPagePropPasswordAutoMint,
} from './sbtPageAutoMintHelpers';
export type {
  AutoMintPair,
  AutoMintPairsResult,
  SbtPageDecodedInviteInput,
  SbtPageUrlAutoMintIntent,
} from './sbtPageAutoMintHelpers';
export {
  buildSbtPageAddressChangeResetMintUiPatch,
  buildSbtPageAdminInviteSuccessPatch,
  buildSbtPageBookmarkedPatch,
  buildSbtPageBooleanTogglePatch,
  buildSbtPageBurnFailurePatch,
  buildSbtPageBurnPendingPatch,
  buildSbtPageBurnSearchInputPatch,
  buildSbtPageBurnSearchResultPatch,
  buildSbtPageBurnSuccessPatch,
  buildSbtPageCachedPasswordsPatch,
  buildSbtPageCopiedAddressPatch,
  buildSbtPageCopiedErrorPatch,
  buildSbtPageDocModalContentPatch,
  buildSbtPageDocModalErrorPatch,
  buildSbtPageDocModalOpenPatch,
  buildSbtPageDocModalResetPatch,
  buildSbtPageErrorPatch,
  buildSbtPageExportFormatPatch,
  buildSbtPageIncludePreviousPasswordsPatch,
  buildSbtPageInitialState,
  buildSbtPageIntervalIdPatch,
  buildSbtPageLoadInfoLoadingStartPatch,
  buildSbtPageLoadingMintersBurnersPatch,
  buildSbtPageLogScanProgressPatch,
  buildSbtPageMiniPasswordInputPatch,
  buildSbtPageMintCountdownPatch,
  buildSbtPageMintFailurePatch,
  buildSbtPageMintPasswordClearPatch,
  buildSbtPageMintPasswordPrefillPatch,
  buildSbtPageMintPendingPatch,
  buildSbtPageMintSuccessPatch,
  buildSbtPageMintedModalInitialFilterPatch,
  buildSbtPageMintedModalVisibilityPatch,
  buildSbtPageNetworkUpdatePatch,
  buildSbtPagePasswordClaimStartSuccessPatch,
  buildSbtPagePasswordGenerationCountPatch,
  buildSbtPagePasswordInputValuePatch,
  buildSbtPagePasswordMintInputPatch,
  buildSbtPageRelevantInfoPatch,
  buildSbtPageResolvedSessionSlugPatch,
  buildSbtPageSbtInfoPatch,
} from './sbtPageStatePatchHelpers';
export {
  buildSbtPageAddressListSignatureMemoState,
  buildSbtPageAddressOccurrenceMap,
  buildSbtPageHolderListSignature,
  buildSbtPageModalFilteredMintedUsersPatch,
  buildSbtPageNetHoldersMemoState,
  buildSbtPageNextFilteredHolderRows,
  computeSbtPageNetCounts,
  computeSbtPageNetHoldersList,
  expandSbtPageAddressListFromCountMap,
  mergeSbtPageBurnEvidenceIntoPreservedHolderState,
  normalizeSbtPageCountMap,
  normalizeSbtPageLoadInfoOptions,
  reconcileSbtPageHolderRefreshState,
} from './sbtPageHolderHelpers';
export type {
  ReconcileSbtPageHolderRefreshStateArgs,
  ReconciledSbtPageHolderRefreshState,
  SbtPageHolderRefreshStateLike,
} from './sbtPageHolderHelpers';
export {
  buildSbtPagePasswordExportFile,
  buildSbtPagePasswordExportRows,
  buildSbtPagePasswordInviteLink,
  decodeSbtPageJsonDataUri,
  encodeSbtPageGroupPasswordForUrl,
  generateSbtPageRandomPasswords,
  resolveSbtPagePasswordExportControlsState,
  resolveSbtPagePasswordExportSelection,
  resolveSbtPagePasswordInventoryDisplayState,
} from './sbtPagePasswordExportHelpers';
export type {
  SbtPagePasswordExportFile,
  SbtPagePasswordExportFormat,
  SbtPagePasswordExportRow,
} from './sbtPagePasswordExportHelpers';
export {
  getDisplayImageFallbackCandidateCount,
  getDisplayImageRenderState,
  getDisplayImageUrlCandidates,
  getNextDisplayImageFallbackState,
  isSbtPageImageLikeUri,
  normalizeSbtPageCanonicalMetadataHref,
  resolveDisplayImageHref,
  resolveSbtPageTokenMetadataHref,
  resolveSbtPageTokenMetadataLinkDisplayState,
} from './sbtPageMediaHelpers';
export {
  buildSbtPageSectionHeaderClassName,
  resolveSbtPageBookmarkButtonDisplayState,
  resolveSbtPageCopyErrorButtonStyle,
  resolveSbtPageCopyIconState,
  resolveSbtPageFullViewShellState,
  resolveSbtPageIdentityPanelDisplayState,
  resolveSbtPageInlineLockIconStyle,
  resolveSbtPageInteractiveCursorStyle,
  resolveSbtPageItalicNoteStyle,
  resolveSbtPageMutedInfoIconStyle,
  resolveSbtPageQuestionIconStyle,
  resolveSbtPageRefreshIndicatorStyle,
  resolveSbtPageSectionToggleDisplayState,
} from './sbtPageFullViewDisplayHelpers';
export {
  buildSbtPageClaimCountdownCompletePatch,
  buildSbtPageClaimCountdownTickPatch,
  buildSbtPageDetailsPayload,
  buildSbtPageExplorerUrl,
  getBlockExplorerBaseUrl,
  resolveSbtChainId,
  resolveSbtPageActiveBlockTimeMs,
  resolveSbtPageActiveChainId,
  resolveSbtPageCountdownDisplaySeconds,
  resolveSbtPageRecoveryCacheChainId,
} from './sbtPageChainRuntimeHelpers';
export {
  buildSbtPageActionButtonClassName,
  resolveSbtPageActionFeedbackState,
  resolveSbtPageAdminActionDisplayPlan,
  resolveSbtPageAdminActionState,
  resolveSbtPageAdminBurnButtonState,
  resolveSbtPageBurnActionPlan,
  resolveSbtPageBurnButtonState,
  resolveSbtPageBurnStatusButtonState,
  resolveSbtPageManualClaimButtonState,
  resolveSbtPageManualClaimActionRequest,
  resolveSbtPageMiniActionFailureState,
  resolveSbtPageMiniActionStatusDisplayState,
  resolveSbtPageMiniBurnButtonState,
  resolveSbtPageMiniBurnPermission,
  resolveSbtPageMiniCardDisplayState,
  resolveSbtPageMiniControlDisplayState,
  resolveSbtPageMiniManualClaimActionRequest,
  resolveSbtPageMiniMintActionPlan,
  resolveSbtPageMiniMintFlowDisplayState,
  resolveSbtPageMiniMintState,
  resolveSbtPageMiniOpenMintButtonState,
  resolveSbtPageMiniTokenActionDisplayState,
  resolveSbtPageMintEndDisplayState,
  resolveSbtPageMintActionPlan,
  resolveSbtPageMintButtonDisplayState,
  resolveSbtPageMintFlowDisplayState,
  resolveSbtPageFullActionDisplayPlan,
  resolveSbtPageOpenMintButtonState,
  resolveSbtPagePasswordAlertState,
  resolveSbtPagePasswordGenerationButtonState,
  resolveSbtPagePasswordJoinButtonState,
  resolveSbtPagePendingButtonContentState,
  resolveSbtPageStatusButtonContentState,
  shouldRenderSbtPageMintButton,
} from './sbtPageActionDisplayHelpers';
export type {
  SbtPageAdminActionDisplayPlan,
  SbtPageManualClaimActionRequest,
  SbtPageManualClaimActionRequestViewKind,
  SbtPageFullActionDisplayPlan,
  SbtPageMiniManualClaimActionRequest,
  SbtPageMiniManualClaimActionRequestViewKind,
  SbtPageMiniMintActionPlan,
  SbtPageMintEndDisplayState,
} from './sbtPageActionDisplayHelpers';
export {
  appendSbtPageBookmark,
  appendSbtPageTransactionHash,
  readSbtPageQueuedOrStoredLocalStorageJson,
  resolveSbtPageLocalStorageJsonWriteDecision,
  serializeSbtPageLocalStorageJsonWrite,
} from './sbtPageLocalStorageHelpers';
export type {
  AppendSbtPageBookmarkArgs,
  AppendSbtPageBookmarkResult,
  AppendSbtPageTransactionHashArgs,
  AppendSbtPageTransactionHashResult,
  ReadSbtPageQueuedOrStoredLocalStorageJsonArgs,
  ResolveSbtPageLocalStorageJsonWriteDecisionArgs,
  SbtPageLocalStorageJsonWriteDecision,
  SbtPageSerializedLocalStorageJsonWrite,
  SerializeSbtPageLocalStorageJsonWriteArgs,
} from './sbtPageLocalStorageHelpers';
export {
  buildSbtPageEffectiveHolderScanProgress,
  buildSbtPageParentSessionScanProgress,
  formatSbtPageBlockCount,
  hasUsableSbtPageScanProgress,
  isActiveSbtPageScanProgress,
  resolveSbtPageHolderScanActive,
  resolveSbtPageRemainingBlocksCount,
  resolveSbtPageScanProgressDisplay,
  resolveSbtPageScanProgressFillStyle,
  resolveSbtPageScanProgressPercent,
  shouldShowSbtPageScanProgress,
} from './sbtPageScanProgressHelpers';
export type {
  SbtPageScanProgressRecord,
} from './sbtPageScanProgressHelpers';
export type {
  SbtPageDisplayImageState,
  SbtPageInfoImageLike,
} from './sbtPageMediaHelpers';
export {
  resolveSbtPageHolderDisplayModel,
  resolveSbtPageHolderFilterItems,
  resolveSbtPageHolderLoadingState,
  resolveSbtPageHolderModalDisplayState,
  resolveSbtPageHolderResolutionState,
  resolveSbtPageHoldersDisplayCount,
} from './sbtPageHolderDisplayHelpers';
export type {
  ResolveSbtPageHolderDisplayModelArgs,
  ResolveSbtPageHolderFilterItemsArgs,
  ResolveSbtPageHolderLoadingStateArgs,
  ResolveSbtPageHolderModalDisplayStateArgs,
  ResolveSbtPageHolderResolutionStateArgs,
  ResolveSbtPageHoldersDisplayCountArgs,
  SbtPageHolderDisplayModel,
  SbtPageHolderFilterItems,
  SbtPageHolderLoadingState,
  SbtPageHolderModalDisplayState,
  SbtPageHolderResolutionState,
} from './sbtPageHolderDisplayHelpers';

type ClosestCapableTarget = {
  closest?: (selectors: string) => unknown;
};

type BuildNextFilteredHolderRowsArgs = {
  prevFilteredRows?: unknown;
  prevNetHolders?: unknown;
  nextNetHolders?: unknown;
  replaceRows?: boolean;
};
type SbtPageRefreshOptions = Record<string, unknown> & {
  countsOnly?: boolean;
  forceCounts: true;
  onProgress?: unknown;
};
type BuildSbtPageRefreshOptionsArgs = {
  forceEventFetch?: unknown;
  onProgress?: unknown;
  preferCountsOnly?: unknown;
};
type ResolveSbtPageShouldRefreshCountsArgs = {
  burnedAddresses?: unknown;
  countsLoaded?: unknown;
  forceEventFetch?: unknown;
  mintedAddresses?: unknown;
  mintedTokensOverride?: unknown;
};
type ResolveSbtPageRefreshLifecyclePlanArgs = {
  eventScanTried?: unknown;
  parentOwnsInitialRefresh?: unknown;
  refreshOptions?: unknown;
  shouldRefreshCounts?: unknown;
  usingCentralHydration?: unknown;
};
export type SbtPageRefreshLifecyclePlan = {
  shouldPromoteToForcedCountsRefresh: boolean;
  shouldRunEventScanRefresh: boolean;
};
type ResolveSbtPageCacheRevisionReloadPlanArgs = {
  isMounted?: unknown;
  nextSbtAddress?: unknown;
  nextSbtCacheRevision?: unknown;
  prevSbtCacheRevision?: unknown;
};
export type SbtPageCacheRevisionReloadPlan = {
  cacheRevisionChanged: boolean;
  shouldReloadSbtInfo: boolean;
  shouldResetMetaHydrationTried: boolean;
  loadOptions: false | null;
};
type ResolveSbtPageOwnerLookupFallbackDecisionArgs = {
  burnedAddresses?: unknown;
  countsLoaded?: unknown;
  mintedAddresses?: unknown;
  ownerLookupTokenCount?: unknown;
  preferCountsOnly?: unknown;
  requireCountsNotLoaded?: unknown;
};
type ResolveSbtPageOwnerLookupTokenCountArgs = {
  mintedTokensOverride?: unknown;
  ownerLookupUpperBound?: unknown;
};
type ResolveSbtPageUserAdminStatusArgs = {
  account?: unknown;
  sbtInfo?: unknown;
};
type BuildSbtPagePrimaryMetadataStatePatchArgs = {
  account?: unknown;
  extraState?: Record<string, unknown>;
  nextSbtInfo?: unknown;
  prevSbtInfo?: unknown;
};
type BuildSbtPageAccountDerivedStatePatchArgs = {
  account?: unknown;
  state?: SbtPageAccountDerivedStateLike | null;
};
type BuildSbtPageLocalMintSuccessPatchArgs = {
  addrLower?: unknown;
  prevState?: SbtPageLocalHolderStateLike | null;
};
type BuildSbtPageLocalBurnSuccessPatchArgs = {
  addrLower?: unknown;
  buildAddressListSignature?: ((list: unknown) => unknown) | null;
  buildNextFilteredHolderRows?: ((args: BuildNextFilteredHolderRowsArgs) => unknown) | null;
  prevState?: SbtPageLocalHolderStateLike | null;
};
type SbtPageAccountDerivedStateLike = Record<string, unknown> & {
  burnedAddresses?: unknown;
  mintedAddresses?: unknown;
  sbtInfo?: unknown;
  userHasSBT?: unknown;
  userIsSbtAdmin?: unknown;
};
type SbtPageLocalHolderStateLike = Record<string, unknown> & {
  burnedAddresses?: unknown;
  filteredMintedUsers?: unknown;
  filteredMintedUsersSignature?: unknown;
  mintedAddresses?: unknown;
  mintingAddressesFilterInitialized?: unknown;
  showModal?: unknown;
};
type BuildSbtPageEncryptedEnvelopeFingerprintArgs = {
  descriptionEnvelope?: unknown;
  documentUrlsEnvelope?: unknown;
  imageEnvelope?: unknown;
  nameEnvelope?: unknown;
  tagsEnvelope?: unknown;
};
type BuildSbtPageEncryptedEnvelopeDecryptKeyArgs = {
  activeAccount?: unknown;
  envelopeFingerprint?: unknown;
  metaKey?: unknown;
};
type BuildSbtPageEncryptedMetadataDecryptPlanArgs = {
  activeAccount?: unknown;
  decryptTriedByKey?: unknown;
  hasLitKey?: unknown;
  metaKey?: unknown;
  sbtInfo?: unknown;
};
export type SbtPageEncryptedMetadataDecryptPlan = {
  alreadyTried: boolean;
  canAttemptDecrypt: boolean;
  decryptKey: string;
  descriptionEnvelope: unknown;
  documentUrlsEnvelope: unknown;
  envelopeFingerprint: string;
  hasEncryptedMetadata: boolean;
  imageEnvelope: unknown;
  nameEnvelope: unknown;
  shouldEnterDecryptBoundary: boolean;
  tagsEnvelope: unknown;
};
type ResolveSbtPageCachedGroupPasswordHashArgs = {
  groupPasswordHash?: unknown;
  groupPasswordHashLoaded?: unknown;
  preferCountsOnly?: unknown;
};
type SbtPageCachedGroupPasswordHashState = {
  groupPasswordHash: unknown;
  shouldReuseCachedGroupPasswordHash: boolean;
};
type ResolveSbtPageGroupPasswordMintStateArgs = {
  groupPasswordHash?: unknown;
  hashZero?: unknown;
  hasPasswordMint?: unknown;
};
type SbtPageGroupPasswordMintState = {
  hasGroupHash: boolean;
  hasGroupPasswordMint: boolean;
  hasInviteMint: boolean;
};
type ResolveSbtPageChainMetadataReadNeedsArgs = {
  info?: unknown;
  zeroAddress?: unknown;
};
type SbtPageChainMetadataReadNeeds = {
  needAdmin: boolean;
  needBurn: boolean;
  needEnd: boolean;
  needHasPw: boolean;
  needMax: boolean;
  shouldRead: boolean;
};
type SbtPageMetadataInfoLike = Record<string, unknown> & {
  chainID?: unknown;
  chainId?: unknown;
};
type SbtPageNetworkLike = Record<string, unknown> & {
  id?: unknown;
};
type SbtPageLooseSessionChainIdReader = (slug: unknown) => unknown;
type DeriveSbtPageCacheNetKeyArgs = {
  currentNetwork?: unknown;
  getSessionChainId?: SbtPageLooseSessionChainIdReader | null;
  infoHint?: unknown;
  netKeyHint?: unknown;
  slugForCache?: unknown;
};
type BuildSbtPageDirectMetadataContextArgs = {
  currentNetwork?: unknown;
  getSessionChainId?: SbtPageLooseSessionChainIdReader | null;
  infoHint?: unknown;
  netKeyHint?: unknown;
  slugForRead?: unknown;
};
type SbtPageCacheReader = (
  namespace: string,
  slug?: string
) => Promise<unknown> | unknown;
type SbtPageNamespaceEntriesReader = (
  namespace: string,
  options?: Record<string, unknown>
) => unknown;
type SbtPageCachedSbtEntry = Record<string, unknown> & {
  sbtInfo?: unknown;
  slug?: unknown;
};
type SbtPageCacheNetNode = Record<string, unknown> & {
  sbtList?: Record<string, unknown>;
};
type SbtPageCacheByNet = Record<string, Record<string, unknown> | undefined>;
type SbtPageCachedEntryHit = {
  entry: SbtPageCachedSbtEntry;
  netKey: string;
  slug: string;
};
type ReadSbtPageCacheBySlugArgs = {
  netKeyForCache?: unknown;
  readCache?: SbtPageCacheReader | null;
  slugForCache?: unknown;
};
type FindSbtPageCachedEntryAcrossGroupsArgs = {
  addressLower?: unknown;
  excludeSlug?: unknown;
  listNamespaceEntriesSync?: SbtPageNamespaceEntriesReader | null;
};
type ResolveSbtPageMetadataHydrationModeArgs = {
  forceEventFetch?: unknown;
  isSBTCacheReady?: unknown;
  refreshSbtData?: unknown;
};
type SbtPageMetadataHydrationMode = {
  parentOwnsInitialRefresh: boolean;
  usingCentralHydration: boolean;
};
type SbtPageLoadInfoRequestNetwork = {
  id?: unknown;
};
type BuildSbtPageLoadInfoRequestKeyArgs = {
  account?: unknown;
  activeSlug?: unknown;
  network?: SbtPageLoadInfoRequestNetwork | null;
  sbtAddressInput?: unknown;
  sbtCacheRevision?: unknown;
};
type BuildSbtPageLoadInfoStartLogContextArgs = {
  account?: unknown;
  addrLower?: unknown;
  forceEventFetch?: unknown;
  initialSlug?: unknown;
  network?: SbtPageLoadInfoRequestNetwork | null;
  normalizedExplicitSlug?: unknown;
  preferCountsOnly?: unknown;
  sbtAddressOriginalCase?: unknown;
};
type ResolveSbtPageLoadInfoPendingQueuePlanArgs = {
  forceEventFetch?: unknown;
  pendingForce?: unknown;
  pendingOptions?: unknown;
  preferCountsOnly?: unknown;
};
type SbtPageLoadInfoPendingOptions = {
  forceEventFetch: boolean;
  preferCountsOnly: boolean;
};
export type SbtPageLoadInfoPendingQueuePlan = {
  pendingForce: boolean;
  pendingOptions: SbtPageLoadInfoPendingOptions;
  shouldQueueLoad: true;
};
type BuildSbtPageOpenMintAutoJoinUrlArgs = {
  addressOverride?: unknown;
  basePath?: unknown;
  groupPasswordHash?: unknown;
  hasGroupPasswordMint?: unknown;
  hasInviteMint?: unknown;
  origin?: unknown;
  propSBTAddress?: unknown;
  sbtInfo?: unknown;
  sessionSlug?: unknown;
};
type SbtPageSessionSbtAddressesConfig = Record<string, unknown> & {
  defaultFeaturedSBTs?: unknown;
  featured_SBTs_LIST?: unknown;
};
type BuildSbtPageSessionSbtAddressesArgs = {
  propSBTAddress?: unknown;
  routeSbtAddress?: unknown;
  sessionConfig?: SbtPageSessionSbtAddressesConfig | null;
  sessionSlug?: unknown;
  stateSbtAddress?: unknown;
};
type BuildSbtPageSessionSbtAddressesResult = {
  addresses: string[];
  cacheKey: string;
};
type ResolveSbtPageSessionSbtAddressCacheArgs = {
  addresses?: string[];
  cacheKey?: string;
  previousAddresses?: string[];
  previousCacheKey?: string;
};
type ResolveSbtPageSessionSbtAddressCacheResult = {
  addresses: string[];
  cacheKey: string;
  reusedPrevious: boolean;
};
type BuildSbtPageSessionSbtAddressesMemoStateArgs = BuildSbtPageSessionSbtAddressesArgs & {
  previousAddresses?: string[];
  previousCacheKey?: string;
};
type BuildSbtPageAdminFallbackPatchArgs = {
  adminAddress?: unknown;
  existingCreator?: unknown;
  existingDeployer?: unknown;
  ownerAddress?: unknown;
  zeroAddress?: unknown;
};
type SbtPageMetadataCompletenessInfo = Record<string, unknown> & {
  admin?: unknown;
  admin_?: unknown;
  burnAuth?: unknown;
  deployer?: unknown;
  encryptedFields?: unknown;
  encryptedImage?: unknown;
  hasPasswordMint?: unknown;
  image?: unknown;
  imageEncrypted?: unknown;
  imageLocked?: unknown;
  maxTokens?: unknown;
  mintingEndTime?: unknown;
  tokenURI?: unknown;
  tokenUri?: unknown;
};
export const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object'
);

export const buildSbtPageEncryptedEnvelopeFingerprint = ({
  descriptionEnvelope = null,
  documentUrlsEnvelope = null,
  imageEnvelope = null,
  nameEnvelope = null,
  tagsEnvelope = null,
}: BuildSbtPageEncryptedEnvelopeFingerprintArgs = {}): string => (
  [
    nameEnvelope ? 'n' : '',
    descriptionEnvelope ? 'd' : '',
    tagsEnvelope ? 't' : '',
    documentUrlsEnvelope ? 'u' : '',
    imageEnvelope ? 'i' : '',
  ].join('')
);

export const buildSbtPageEncryptedEnvelopeDecryptKey = ({
  activeAccount = '',
  envelopeFingerprint = '',
  metaKey = '',
}: BuildSbtPageEncryptedEnvelopeDecryptKeyArgs = {}): string => (
  `${metaKey}:${activeAccount || ''}:${envelopeFingerprint || ''}`
);

export const buildSbtPageEncryptedMetadataDecryptPlan = ({
  activeAccount = '',
  decryptTriedByKey = null,
  hasLitKey = false,
  metaKey = '',
  sbtInfo = {},
}: BuildSbtPageEncryptedMetadataDecryptPlanArgs = {}): SbtPageEncryptedMetadataDecryptPlan => {
  const info = isRecord(sbtInfo) ? sbtInfo : {};
  const encryptedFields = isRecord(info.encryptedFields) ? info.encryptedFields : {};
  const nameEnvelope = encryptedFields.name || info.nameEncrypted || info.encryptedName || null;
  const descriptionEnvelope = encryptedFields.description || info.descriptionEncrypted || info.encryptedDescription || null;
  const tagsEnvelope = encryptedFields.tags || info.tagsEncrypted || info.encryptedTags || null;
  const documentUrlsEnvelope = encryptedFields.documentURLs || info.documentURLsEncrypted || info.docUrlsEncrypted || null;
  const imageEnvelope = encryptedFields.image || info.imageEncrypted || info.encryptedImage || null;
  const envelopeFingerprint = buildSbtPageEncryptedEnvelopeFingerprint({
    nameEnvelope,
    descriptionEnvelope,
    tagsEnvelope,
    documentUrlsEnvelope,
    imageEnvelope,
  });
  const decryptKey = buildSbtPageEncryptedEnvelopeDecryptKey({
    metaKey,
    activeAccount,
    envelopeFingerprint,
  });
  const alreadyTried = !!(
    isRecord(decryptTriedByKey) &&
    decryptTriedByKey[decryptKey]
  );
  const hasEncryptedMetadata = !!(
    nameEnvelope ||
    descriptionEnvelope ||
    tagsEnvelope ||
    documentUrlsEnvelope ||
    imageEnvelope
  );
  const shouldEnterDecryptBoundary = hasEncryptedMetadata && !alreadyTried;
  return {
    alreadyTried,
    canAttemptDecrypt: shouldEnterDecryptBoundary && !!activeAccount && !!hasLitKey,
    decryptKey,
    descriptionEnvelope,
    documentUrlsEnvelope,
    envelopeFingerprint,
    hasEncryptedMetadata,
    imageEnvelope,
    nameEnvelope,
    shouldEnterDecryptBoundary,
    tagsEnvelope,
  };
};

export const resolveSbtPageCachedGroupPasswordHash = ({
  groupPasswordHash = null,
  groupPasswordHashLoaded = false,
  preferCountsOnly = false,
}: ResolveSbtPageCachedGroupPasswordHashArgs = {}): SbtPageCachedGroupPasswordHashState => {
  const shouldReuseCachedGroupPasswordHash = (
    !!preferCountsOnly &&
    groupPasswordHashLoaded === true
  );
  return {
    groupPasswordHash: shouldReuseCachedGroupPasswordHash ? groupPasswordHash : null,
    shouldReuseCachedGroupPasswordHash,
  };
};

export const resolveSbtPageGroupPasswordMintState = ({
  groupPasswordHash = null,
  hashZero = '',
  hasPasswordMint = false,
}: ResolveSbtPageGroupPasswordMintStateArgs = {}): SbtPageGroupPasswordMintState => {
  const hasGroupHash = !!groupPasswordHash && groupPasswordHash !== hashZero;
  return {
    hasGroupHash,
    hasInviteMint: hasGroupHash && !!hasPasswordMint,
    hasGroupPasswordMint: hasGroupHash && !hasPasswordMint,
  };
};

export const resolveSbtPageChainMetadataReadNeeds = ({
  info = {},
  zeroAddress = ethers.constants.AddressZero,
}: ResolveSbtPageChainMetadataReadNeedsArgs = {}): SbtPageChainMetadataReadNeeds => {
  const metadata = isRecord(info) ? info as SbtPageMetadataCompletenessInfo : {};
  const zeroAddressLower = String(zeroAddress || '').toLowerCase();
  const adminRaw = String(metadata.admin || metadata.admin_ || '').trim();
  const needMax = metadata.maxTokens == null;
  const needBurn = metadata.burnAuthNeedsOnChainRefresh === true || !Number.isFinite(Number(metadata.burnAuth));
  const needEnd = !(Number(metadata.mintingEndTime) >= 0);
  const needHasPw = typeof metadata.hasPasswordMint !== 'boolean';
  const needAdmin = !adminRaw || adminRaw.toLowerCase() === zeroAddressLower;
  return {
    needAdmin,
    needBurn,
    needEnd,
    needHasPw,
    needMax,
    shouldRead: needMax || needBurn || needEnd || needHasPw || needAdmin,
  };
};

export const findNestedInteractiveElement = (target: EventTarget | null): unknown => {
  const candidate = target as ClosestCapableTarget | null;
  return typeof candidate?.closest === 'function'
    ? candidate.closest('button, a, input, [role="button"]')
    : null;
};

export const needsSbtPageTokenUriFields = (infoInput: unknown): boolean => {
  if (!isRecord(infoInput)) return true;
  const info = infoInput as SbtPageMetadataCompletenessInfo;
  const has = (value: unknown): boolean => value !== undefined && value !== null && String(value).trim() !== '';
  const tokenUri = info.tokenURI ?? info.tokenUri ?? null;
  const image = info.image ?? null;
  const hasImageMetadata =
    has(image) ||
    info.imageLocked === true ||
    !!info.imageEncrypted ||
    !!info.encryptedImage ||
    !!(isRecord(info.encryptedFields) && info.encryptedFields.image);
  const endOk = Number.isFinite(Number(info.mintingEndTime));
  const burnOk = Number.isFinite(Number(info.burnAuth));
  const hasPw = (typeof info.hasPasswordMint === 'boolean');
  const maxTok = has(info.maxTokens);
  const adminAddress = String(info.admin || info.admin_ || info.deployer || '').trim();
  const adminOk =
    !!adminAddress &&
    adminAddress.toLowerCase() !== String(ethers.constants.AddressZero || '').toLowerCase();
  return !(has(tokenUri) && hasImageMetadata && endOk && burnOk && hasPw && maxTok && adminOk);
};

export const needsSbtPageDirectMetadataHydration = (infoInput: unknown): boolean => {
  if (!isRecord(infoInput)) return true;
  return Object.keys(infoInput).length === 0;
};

export const buildSbtPageAdminFallbackPatch = ({
  adminAddress = '',
  existingCreator = '',
  existingDeployer = '',
  ownerAddress = '',
  zeroAddress = ethers.constants.AddressZero,
}: BuildSbtPageAdminFallbackPatchArgs = {}): Record<string, string> => {
  const zeroAddressLower = String(zeroAddress || '').trim().toLowerCase();
  const nextAdmin = [adminAddress, ownerAddress]
    .map((value: unknown) => String(value || '').trim())
    .find((value: string) => value && value.toLowerCase() !== zeroAddressLower);
  if (!nextAdmin) return {};
  return {
    admin: nextAdmin,
    admin_: nextAdmin,
    ...(existingCreator ? {} : { creator: nextAdmin }),
    ...(existingDeployer ? {} : { deployer: nextAdmin }),
  };
};

export const buildSbtPageLoadInfoRequestKey = ({
  account,
  activeSlug,
  network,
  sbtAddressInput,
  sbtCacheRevision,
}: BuildSbtPageLoadInfoRequestKeyArgs = {}): string => {
  const sbtAddress = resolveSbtAddress(sbtAddressInput);
  return [
    String(sbtAddress || '').trim().toLowerCase(),
    normalizeSessionSlug(activeSlug || ''),
    String(Number(network?.id || 0) || 0),
    String(account || '').trim().toLowerCase(),
    String(Number(sbtCacheRevision || 0) || 0),
  ].join('|');
};

export const resolveSbtPageCacheRevisionReloadPlan = ({
  isMounted = false,
  nextSbtAddress = null,
  nextSbtCacheRevision = undefined,
  prevSbtCacheRevision = undefined,
}: ResolveSbtPageCacheRevisionReloadPlanArgs = {}): SbtPageCacheRevisionReloadPlan => {
  const cacheRevisionChanged = nextSbtCacheRevision !== prevSbtCacheRevision;
  const shouldReloadSbtInfo = cacheRevisionChanged && !!isMounted && !!nextSbtAddress;
  return {
    cacheRevisionChanged,
    shouldReloadSbtInfo,
    shouldResetMetaHydrationTried: shouldReloadSbtInfo,
    loadOptions: shouldReloadSbtInfo ? false : null,
  };
};

export const buildSbtPageLoadInfoStartLogContext = ({
  account = null,
  addrLower = '',
  forceEventFetch = false,
  initialSlug = '',
  network = null,
  normalizedExplicitSlug = null,
  preferCountsOnly = false,
  sbtAddressOriginalCase = '',
}: BuildSbtPageLoadInfoStartLogContextArgs = {}): Record<string, unknown> => ({
  address: sbtAddressOriginalCase,
  addrLower,
  explicitSlug: normalizedExplicitSlug,
  initialSlug,
  forceEventFetch,
  preferCountsOnly,
  account: account ? String(account).toLowerCase() : null,
  networkId: network?.id ?? null,
});

export const resolveSbtPageLoadInfoPendingQueuePlan = ({
  forceEventFetch = false,
  pendingForce = false,
  pendingOptions = null,
  preferCountsOnly = false,
}: ResolveSbtPageLoadInfoPendingQueuePlanArgs = {}): SbtPageLoadInfoPendingQueuePlan => {
  const existingOptions = isRecord(pendingOptions) ? pendingOptions : {};
  return {
    pendingForce: pendingForce === true || forceEventFetch === true,
    pendingOptions: {
      forceEventFetch: existingOptions.forceEventFetch === true || forceEventFetch === true,
      preferCountsOnly: existingOptions.preferCountsOnly === true || preferCountsOnly === true,
    },
    shouldQueueLoad: true,
  };
};

const buildSbtPageAddressListSignature = (input: unknown): string => {
  if (!Array.isArray(input)) return '';
  return input
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter(Boolean)
    .join(',');
};

const pushSbtPageSessionAddress = (input: unknown, out: string[], seen: Set<string>): void => {
  const raw = String(input || '').trim();
  if (!raw || !ethers.utils.isAddress(raw)) return;
  const lower = raw.toLowerCase();
  if (seen.has(lower)) return;
  seen.add(lower);
  out.push(lower);
};

export const buildSbtPageSessionSbtAddresses = ({
  propSBTAddress,
  routeSbtAddress,
  sessionConfig,
  sessionSlug,
  stateSbtAddress,
}: BuildSbtPageSessionSbtAddressesArgs = {}): BuildSbtPageSessionSbtAddressesResult => {
  const cacheKey = [
    String(stateSbtAddress || '').trim().toLowerCase(),
    String(routeSbtAddress || '').trim().toLowerCase(),
    String(resolveSbtAddress(propSBTAddress) || '').trim().toLowerCase(),
    String(sessionSlug || '').trim().toLowerCase(),
    buildSbtPageAddressListSignature(sessionConfig?.defaultFeaturedSBTs),
    buildSbtPageAddressListSignature(sessionConfig?.featured_SBTs_LIST),
  ].join('|');

  const addresses: string[] = [];
  const seen = new Set<string>();

  pushSbtPageSessionAddress(stateSbtAddress, addresses, seen);
  pushSbtPageSessionAddress(routeSbtAddress, addresses, seen);
  pushSbtPageSessionAddress(resolveSbtAddress(propSBTAddress), addresses, seen);

  const fromSession = [
    ...(Array.isArray(sessionConfig?.defaultFeaturedSBTs) ? sessionConfig.defaultFeaturedSBTs : []),
    ...(Array.isArray(sessionConfig?.featured_SBTs_LIST) ? sessionConfig.featured_SBTs_LIST : []),
  ];
  fromSession.forEach((address) => pushSbtPageSessionAddress(address, addresses, seen));

  return { addresses, cacheKey };
};

export const resolveSbtPageSessionSbtAddressCache = ({
  addresses = [],
  cacheKey = '',
  previousAddresses = [],
  previousCacheKey = '',
}: ResolveSbtPageSessionSbtAddressCacheArgs = {}): ResolveSbtPageSessionSbtAddressCacheResult => {
  if (previousCacheKey === cacheKey) {
    return { addresses: previousAddresses, cacheKey, reusedPrevious: true };
  }
  return { addresses, cacheKey, reusedPrevious: false };
};

export const buildSbtPageSessionSbtAddressesMemoState = ({
  previousAddresses = [],
  previousCacheKey = '',
  propSBTAddress,
  routeSbtAddress,
  sessionConfig,
  sessionSlug,
  stateSbtAddress,
}: BuildSbtPageSessionSbtAddressesMemoStateArgs = {}): ResolveSbtPageSessionSbtAddressCacheResult => {
  const { addresses, cacheKey } = buildSbtPageSessionSbtAddresses({
    propSBTAddress,
    routeSbtAddress,
    sessionConfig,
    sessionSlug,
    stateSbtAddress,
  });
  return resolveSbtPageSessionSbtAddressCache({
    addresses,
    cacheKey,
    previousAddresses,
    previousCacheKey,
  });
};

export const buildSbtPageOpenMintAutoJoinUrl = ({
  addressOverride = null,
  basePath = '',
  groupPasswordHash = '',
  hasGroupPasswordMint = false,
  hasInviteMint = false,
  origin = '',
  propSBTAddress = null,
  sbtInfo = null,
  sessionSlug = '',
}: BuildSbtPageOpenMintAutoJoinUrlArgs = {}): string => {
  const sbtAddress = String(addressOverride || resolveSbtAddress(propSBTAddress) || '').trim();
  if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) return '';

  const info = isRecord(sbtInfo) ? sbtInfo : {};
  const normalizedHash = String(groupPasswordHash || '').trim().toLowerCase();
  const zeroHash = String(ethers.constants.HashZero || '').toLowerCase();
  const hasGroupHash = !!normalizedHash && normalizedHash !== zeroHash;
  if (info.hasPasswordMint || hasInviteMint || hasGroupPasswordMint || hasGroupHash) {
    return '';
  }

  const normalizedOrigin = String(origin || '').replace(/\/+$/, '');
  if (!normalizedOrigin) return '';

  const demoPath = buildSessionRoutePath(sessionSlug, basePath);
  return `${normalizedOrigin}${demoPath}?sbt=${encodeURIComponent(sbtAddress)}&auto=1`;
};

export const deriveSbtPageCacheNetKey = ({
  currentNetwork = null,
  getSessionChainId: readSessionChainId = null,
  infoHint = null,
  netKeyHint = null,
  slugForCache = '',
}: DeriveSbtPageCacheNetKeyArgs = {}): string => {
  const infoRecord = isRecord(infoHint) ? infoHint as SbtPageMetadataInfoLike : {};
  const networkRecord = isRecord(currentNetwork) ? currentNetwork as SbtPageNetworkLike : {};
  const chainIdHint =
    infoRecord.chainID ||
    infoRecord.chainId ||
    netKeyHint;
  const sessionChainId = typeof readSessionChainId === 'function'
    ? readSessionChainId(slugForCache)
    : null;
  const chainId =
    sessionChainId ||
    (chainIdHint != null ? Number(chainIdHint) : null) ||
    networkRecord.id ||
    null;
  return chainId != null ? String(chainId) : '';
};

export const buildSbtPageDirectMetadataContext = ({
  currentNetwork = null,
  getSessionChainId: readSessionChainId = null,
  infoHint = null,
  netKeyHint = null,
  slugForRead = '',
}: BuildSbtPageDirectMetadataContextArgs = {}): Record<string, unknown> | string => {
  const normalizedSlug = normalizeSessionSlug(slugForRead || '');
  const infoRecord = isRecord(infoHint) ? infoHint as SbtPageMetadataInfoLike : {};
  const networkRecord = isRecord(currentNetwork) ? currentNetwork as SbtPageNetworkLike : {};
  const chainId = Number(
    (typeof readSessionChainId === 'function' ? readSessionChainId(normalizedSlug) : null) ||
    infoRecord.chainID ||
    infoRecord.chainId ||
    netKeyHint ||
    networkRecord.id ||
    0
  ) || null;
  const ctx: Record<string, unknown> = {};
  if (normalizedSlug) ctx.slug = normalizedSlug;
  if (chainId) ctx.networkChainId = chainId;
  return Object.keys(ctx).length ? ctx : (normalizedSlug || '');
};

export const readSbtPageCacheBySlug = async ({
  netKeyForCache = '',
  readCache: readCacheFn = null,
  slugForCache = null,
}: ReadSbtPageCacheBySlugArgs = {}): Promise<SbtPageCacheByNet> => {
  try {
    if (typeof readCacheFn !== 'function') return {};
    const parsedRaw = await readCacheFn(
      'sbtCache',
      slugForCache == null ? undefined : String(slugForCache)
    );
    const parsed = isRecord(parsedRaw) ? parsedRaw as SbtPageCacheByNet : {};
    const netKey = String(netKeyForCache);
    if (parsed[netKey] == null) {
      const legacy = Object.keys(parsed || {}).find((key: string) => (
        key !== netKey && Number(key) === Number(netKey)
      ));
      if (legacy) {
        parsed[netKey] = {
          ...(isRecord(parsed[netKey]) ? parsed[netKey] : {}),
          ...(isRecord(parsed[legacy]) ? parsed[legacy] : {}),
        };
      }
    }
    return parsed;
  } catch (_) {
    return {};
  }
};

export const findSbtPageCachedEntryAcrossGroups = ({
  addressLower = '',
  excludeSlug = null,
  listNamespaceEntriesSync: listEntries = null,
}: FindSbtPageCachedEntryAcrossGroupsArgs = {}): SbtPageCachedEntryHit | null => {
  const normalizedAddress = String(addressLower || '').toLowerCase();
  if (!normalizedAddress || typeof listEntries !== 'function') return null;
  const excludedSlug = normalizeSessionSlug(excludeSlug || '');
  try {
    const entries = listEntries('sbtCache', { cloneValues: false });
    for (const item of Array.isArray(entries) ? entries : []) {
      const namespaceEntry = isRecord(item) ? item : {};
      const sourceSlug = namespaceEntry.slug || '';
      const normalizedSourceSlug = normalizeSessionSlug(sourceSlug);
      if (excludedSlug && normalizedSourceSlug === excludedSlug) continue;
      const parsed = isRecord(namespaceEntry.value)
        ? namespaceEntry.value as Record<string, SbtPageCacheNetNode | undefined>
        : {};
      for (const netKey of Object.keys(parsed || {})) {
        const netNode = isRecord(parsed[netKey]) ? parsed[netKey] as SbtPageCacheNetNode : {};
        const sbtList = isRecord(netNode.sbtList) ? netNode.sbtList : {};
        const entry = sbtList[normalizedAddress];
        const entryRecord = isRecord(entry) ? entry as SbtPageCachedSbtEntry : null;
        if (!entryRecord) continue;
        const candidateSlug = normalizeSessionSlug(entryRecord.slug != null ? entryRecord.slug : sourceSlug);
        if (excludedSlug && candidateSlug === excludedSlug) continue;
        return {
          slug: candidateSlug,
          entry: entryRecord,
          netKey: String(netKey),
        };
      }
    }
  } catch (_) {
    return null;
  }
  return null;
};

export const resolveSbtPageMetadataHydrationMode = ({
  forceEventFetch = false,
  isSBTCacheReady = undefined,
  refreshSbtData = null,
}: ResolveSbtPageMetadataHydrationModeArgs = {}): SbtPageMetadataHydrationMode => {
  const usingCentralHydration = typeof refreshSbtData === 'function';
  return {
    usingCentralHydration,
    parentOwnsInitialRefresh: (
      usingCentralHydration &&
      forceEventFetch !== true &&
      isSBTCacheReady === false
    ),
  };
};

export const buildSbtPageRefreshOptions = ({
  forceEventFetch = false,
  onProgress = null,
  preferCountsOnly = false,
}: BuildSbtPageRefreshOptionsArgs = {}): SbtPageRefreshOptions | undefined => {
  if (!forceEventFetch) return undefined;
  const refreshOptions: SbtPageRefreshOptions = onProgress
    ? { forceCounts: true, onProgress }
    : { forceCounts: true };
  if (preferCountsOnly) refreshOptions.countsOnly = true;
  return refreshOptions;
};

export const resolveSbtPageShouldRefreshCounts = ({
  countsLoaded = false,
  forceEventFetch = false,
}: ResolveSbtPageShouldRefreshCountsArgs = {}): boolean => (
  forceEventFetch === true ||
  countsLoaded !== true
);

export const resolveSbtPageRefreshLifecyclePlan = ({
  eventScanTried = false,
  parentOwnsInitialRefresh = false,
  refreshOptions = null,
  shouldRefreshCounts = false,
  usingCentralHydration = false,
}: ResolveSbtPageRefreshLifecyclePlanArgs = {}): SbtPageRefreshLifecyclePlan => {
  const shouldUseCentralRefresh = (
    !!shouldRefreshCounts &&
    !!usingCentralHydration &&
    !parentOwnsInitialRefresh
  );
  const hasForcedCountsOptions = (
    isRecord(refreshOptions) &&
    !!refreshOptions.forceCounts
  );
  return {
    shouldPromoteToForcedCountsRefresh: shouldUseCentralRefresh && !hasForcedCountsOptions,
    shouldRunEventScanRefresh: shouldUseCentralRefresh && !eventScanTried,
  };
};

export const resolveSbtPageOwnerLookupFallbackDecision = ({
  burnedAddresses = [],
  countsLoaded = false,
  mintedAddresses = [],
  ownerLookupTokenCount = NaN,
  preferCountsOnly = false,
  requireCountsNotLoaded = false,
}: ResolveSbtPageOwnerLookupFallbackDecisionArgs = {}): boolean => (
  !preferCountsOnly &&
  (!requireCountsNotLoaded || countsLoaded !== true) &&
  Array.isArray(mintedAddresses) &&
  mintedAddresses.length === 0 &&
  Array.isArray(burnedAddresses) &&
  burnedAddresses.length === 0 &&
  Number.isFinite(Number(ownerLookupTokenCount)) &&
  Number(ownerLookupTokenCount) > 0
);

export const resolveSbtPageOwnerLookupTokenCount = ({
  mintedTokensOverride = null,
  ownerLookupUpperBound = null,
}: ResolveSbtPageOwnerLookupTokenCountArgs = {}): number => {
  let ownerLookupTokenCount = ownerLookupUpperBound != null ? Number(ownerLookupUpperBound) : NaN;
  if (!Number.isFinite(ownerLookupTokenCount) && mintedTokensOverride != null) {
    ownerLookupTokenCount = Number(mintedTokensOverride);
  }
  return ownerLookupTokenCount;
};

export const resolveSbtPageUserAdminStatus = ({
  account = '',
  sbtInfo = null,
}: ResolveSbtPageUserAdminStatusArgs = {}): unknown => {
  const infoRecord = isRecord(sbtInfo) ? sbtInfo : null;
  const adminAddr = infoRecord ? (infoRecord.admin || infoRecord.admin_ || '') : '';
  const userLower = String(account || '').toLowerCase();
  return userLower && adminAddr && (userLower === String(adminAddr).toLowerCase());
};

export const buildSbtPagePrimaryMetadataStatePatch = ({
  account = '',
  extraState = {},
  nextSbtInfo = null,
  prevSbtInfo = null,
}: BuildSbtPagePrimaryMetadataStatePatchArgs = {}): Record<string, unknown> => {
  const nextInfoRecord = isRecord(nextSbtInfo) ? nextSbtInfo : null;
  const nextUserIsAdmin = resolveSbtPageUserAdminStatus({ account, sbtInfo: nextInfoRecord });
  return {
    sbtInfo: nextInfoRecord || prevSbtInfo || null,
    userIsSbtAdmin: nextUserIsAdmin,
    ...extraState,
  };
};

export const buildSbtPageAccountDerivedStatePatch = ({
  account = '',
  state = null,
}: BuildSbtPageAccountDerivedStatePatchArgs = {}): Record<string, unknown> | null => {
  const stateRecord = isRecord(state) ? state : {};
  const nextLower = String(account || '').toLowerCase();
  const minted = Array.isArray(stateRecord.mintedAddresses) ? stateRecord.mintedAddresses : [];
  const burned = Array.isArray(stateRecord.burnedAddresses) ? stateRecord.burnedAddresses : [];
  const net = computeSbtPageNetCounts(minted, burned);
  const nextUserHasSBT = nextLower ? ((net.get(nextLower) || 0) > 0) : false;
  const sbtInfoRecord = isRecord(stateRecord.sbtInfo) ? stateRecord.sbtInfo : null;
  const nextUserIsAdmin = resolveSbtPageUserAdminStatus({ account: nextLower, sbtInfo: sbtInfoRecord });
  if (
    nextUserHasSBT === stateRecord.userHasSBT &&
    nextUserIsAdmin === stateRecord.userIsSbtAdmin
  ) {
    return null;
  }
  return {
    userHasSBT: nextUserHasSBT,
    userIsSbtAdmin: nextUserIsAdmin,
  };
};

export const buildSbtPageLocalMintSuccessPatch = ({
  addrLower = '',
  prevState = null,
}: BuildSbtPageLocalMintSuccessPatchArgs = {}): Record<string, unknown> | null => {
  const addr = String(addrLower || '').toLowerCase();
  if (!addr) return null;
  const prev = isRecord(prevState) ? prevState : {};
  const minted = (Array.isArray(prev.mintedAddresses) ? prev.mintedAddresses : []).concat(addr);
  const burned = Array.isArray(prev.burnedAddresses) ? [...prev.burnedAddresses] : [];
  const idx = burned.indexOf(addr);
  if (idx !== -1) burned.splice(idx, 1);
  const net = computeSbtPageNetCounts(minted, burned);
  return {
    mintedAddresses: minted,
    burnedAddresses: burned,
    userHasSBT: (net.get(addr) || 0) > 0,
  };
};

export const buildSbtPageLocalBurnSuccessPatch = ({
  addrLower = '',
  buildAddressListSignature = buildSbtPageHolderListSignature,
  buildNextFilteredHolderRows = buildSbtPageNextFilteredHolderRows,
  prevState = null,
}: BuildSbtPageLocalBurnSuccessPatchArgs = {}): Record<string, unknown> | null => {
  const addr = String(addrLower || '').toLowerCase();
  if (!addr) return null;
  const prev = isRecord(prevState) ? prevState : {};
  const minted = Array.isArray(prev.mintedAddresses) ? prev.mintedAddresses : [];
  const burned = (Array.isArray(prev.burnedAddresses) ? prev.burnedAddresses : []).concat(addr);
  const net = computeSbtPageNetCounts(minted, burned);
  const prevNetHolders = computeSbtPageNetHoldersList(prev.mintedAddresses, prev.burnedAddresses);
  const nextNetHolders = computeSbtPageNetHoldersList(minted, burned);
  const shouldManageVisibleRows =
    prev.showModal === true ||
    prev.mintingAddressesFilterInitialized === true ||
    (Array.isArray(prev.filteredMintedUsers) && prev.filteredMintedUsers.length > 0);
  const resolveNextRows = typeof buildNextFilteredHolderRows === 'function'
    ? buildNextFilteredHolderRows
    : buildSbtPageNextFilteredHolderRows;
  const filteredMintedUsers = shouldManageVisibleRows
    ? resolveNextRows({
      prevFilteredRows: prev.filteredMintedUsers,
      prevNetHolders,
      nextNetHolders,
      replaceRows: false,
    })
    : (Array.isArray(prev.filteredMintedUsers) ? prev.filteredMintedUsers : []);
  const nextFilteredRows = Array.isArray(filteredMintedUsers) ? filteredMintedUsers : [];
  const resolveSignature = typeof buildAddressListSignature === 'function'
    ? buildAddressListSignature
    : buildSbtPageHolderListSignature;
  return {
    burnedAddresses: burned,
    userHasSBT: (net.get(addr) || 0) > 0,
    filteredMintedUsers: nextFilteredRows,
    filteredMintedUsersSignature: shouldManageVisibleRows
      ? resolveSignature(nextFilteredRows)
      : prev.filteredMintedUsersSignature,
  };
};
