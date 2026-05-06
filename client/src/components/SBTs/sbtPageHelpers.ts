import {
  getSessionSlugByName,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import { ethers } from 'ethers';
import {
  buildArweaveGatewayUrlCandidates,
  normalizeArweaveUrl,
} from '../../utilities/arweave/arweaveUrls.js';

type BlockExplorerNetworkLike = Record<string, unknown> & {
  blockExplorers?: {
    default?: {
      url?: string;
    };
  };
};

type ClosestCapableTarget = {
  closest?: (selectors: string) => unknown;
};

type BuildNextFilteredHolderRowsArgs = {
  prevFilteredRows?: unknown;
  prevNetHolders?: unknown;
  nextNetHolders?: unknown;
  replaceRows?: boolean;
};
type SbtPageAddressSignatureMemoLike = {
  listRef?: unknown;
  listToken?: unknown;
  signature?: unknown;
};
type SbtPageAddressSignatureMemoState = {
  listRef: unknown[] | null;
  listToken: string;
  signature: string;
};
type BuildSbtPageAddressListSignatureMemoStateArgs = {
  buildAddressListSignature?: (list: unknown) => unknown;
  list?: unknown;
  memo?: SbtPageAddressSignatureMemoLike | null;
};
type SbtPageAddressListSignatureMemoStateResult = {
  memo: SbtPageAddressSignatureMemoState;
  signature: string;
};
type SbtPageNetHoldersMemoLike = {
  burnedRef?: unknown;
  burnedSignature?: unknown;
  mintedRef?: unknown;
  mintedSignature?: unknown;
  result?: unknown;
};
type SbtPageNetHoldersMemoState = {
  burnedRef: unknown[] | null;
  burnedSignature: string;
  mintedRef: unknown[] | null;
  mintedSignature: string;
  result: string[];
};
type BuildSbtPageNetHoldersMemoStateArgs = {
  buildHolderListSignature?: (list: unknown) => string;
  burnedAddresses?: unknown;
  computeNetHoldersList?: (mintsArr: unknown, burnsArr: unknown) => unknown;
  memo?: SbtPageNetHoldersMemoLike | null;
  mintedAddresses?: unknown;
};
type SbtPageNetHoldersMemoStateResult = {
  memo: SbtPageNetHoldersMemoState;
  netHolders: string[];
};
type SbtPageModalFilteredMintedUsersStateLike = Record<string, unknown> & {
  filteredMintedUsers?: unknown;
  filteredMintedUsersSignature?: unknown;
  loadingMintedFilter?: unknown;
};
type BuildSbtPageModalFilteredMintedUsersPatchArgs = {
  buildAddressListSignature?: (list: unknown) => string;
  filtered?: unknown;
  isHolderScanActive?: unknown;
  state?: SbtPageModalFilteredMintedUsersStateLike | null;
};
type BuildSbtPageMintedModalInitialFilterPatchArgs = {
  buildAddressListSignature?: (list: unknown) => string;
  netHolders?: unknown;
};
type SbtPageModalFilteredMintedUsersPatch = {
  filteredMintedUsers?: unknown[];
  filteredMintedUsersSignature?: string;
  loadingMintedFilter: false;
};
type SbtPageMintedModalInitialFilterPatch = {
  filteredMintedUsers: unknown[];
  filteredMintedUsersSignature: string;
  mintingAddressesFilterInitialized: true;
  loadingMintedFilter: false;
};

type PreservedHolderState = {
  mintedAddresses: string[];
  burnedAddresses: string[];
  burnDiscovered: boolean;
};
type AddressCountMap = Record<string, number>;
type SbtPageLoadInfoOptions = {
  forceEventFetch: boolean;
  preferCountsOnly: boolean;
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
type ResolveSbtPageMintEndDisplayStateArgs = {
  nowMs?: unknown;
  sbtInfo?: unknown;
};
type ResolveSbtPageMiniMintStateArgs = {
  burningStatus?: unknown;
  mintingStatus?: unknown;
  nowSec?: unknown;
  sbtAddress?: unknown;
  sbtInfo?: unknown;
  userHasSBT?: unknown;
};
type ResolveSbtPageMiniActionFailureStateArgs = {
  burningStatus?: unknown;
  hasTokenMini?: unknown;
  mintingStatus?: unknown;
};
export type SbtPageMintEndDisplayState = {
  fullMintEndDate: string;
  status: 'active' | 'expired' | 'never';
  unixTS: number | string;
};
type SbtPageMiniMintState = {
  hasTokenMini: boolean;
  isMintingActive: boolean;
  justJoined: boolean;
  mintStatusId: string;
  shouldRenderEndedIndicator: boolean;
  shouldRenderLiveIndicator: boolean;
};
type SbtPageMiniActionFailureState = {
  showBurnFailedStatus: boolean;
  showMintFailedStatus: boolean;
};
export type AutoMintPair = {
  auto: boolean;
  gp: string | null;
  inv: string | null;
  sbt: string | null;
};
export type AutoMintPairsResult = {
  globalAuto: boolean;
  pairs: AutoMintPair[];
};
type SbtPageSessionStorageLike = {
  getItem?: (key: string) => string | null;
};
type SbtPageUrlAutoMintState = {
  mintingStatus?: unknown;
  userHasSBT?: unknown;
};
type ResolveSbtPagePropPasswordAutoMintArgs = {
  autoMintingMode?: unknown;
  mintingStatus?: unknown;
  sbtInfo?: unknown;
  sbtMintPassword?: unknown;
  userHasSBT?: unknown;
};
type ResolveSbtPagePropListAutoMintArgs = {
  autoMintingMode?: unknown;
  hasAttemptedListMint?: unknown;
  loginComplete?: unknown;
  sbtMintPassword?: unknown;
};
export type SbtPageUrlAutoMintIntent = {
  autoKey: string | null;
  currentSbtAddress: unknown;
  shouldAttemptAuto: boolean;
  targetCode: string | null;
  targetInvite: string | null;
  targetPassword: string | null;
};
export type SbtPageScanProgressRecord = Record<string, unknown> & {
  currentBlock?: unknown;
  latestBlock?: unknown;
  totalBlocks?: unknown;
  scannedBlocks?: unknown;
  remainingBlocks?: unknown;
  phase?: unknown;
};
export type SbtPageSessionDisplayConfig = Record<string, unknown> & {
  blockLimits?: Record<string, unknown>;
  sessionName?: unknown;
};
type SbtAddressPropsLike = {
  SBTAddress?: unknown;
  loginComplete?: unknown;
};
type SbtAddressInfo = {
  lower: string;
  original: unknown;
};
type ResolveSbtPageAddressLinkStateArgs = {
  address?: unknown;
  isAddress?: ((value: string) => boolean) | null;
  zeroAddress?: unknown;
};
type SbtPageAddressLinkState = {
  isRenderable: boolean;
  isZeroAddress: boolean;
  normalized: string;
};
type ResolveSbtPageEffectiveSessionSlugArgs = {
  props?: SessionSlugPropsLike | null;
  resolvedSessionSlug?: unknown;
  sbtInfo?: unknown;
};
type SbtPageSessionConfigReader = (slug: string) => unknown;
type SbtPageDemoSessionConfigReader = (
  slug: string,
  options?: { allowDemoFallback?: boolean }
) => unknown;
type ResolveSbtPageSessionDisplayConfigArgs = {
  getDemoSessionConfigBySlug?: SbtPageDemoSessionConfigReader | null;
  getSessionConfigBySlugOrDefault?: SbtPageSessionConfigReader | null;
  sessionSlugRaw?: unknown;
};
type ResolveSbtPageSessionDisplayLabelArgs = {
  sessionConfig?: unknown;
  sessionSlugRaw?: unknown;
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
type ResolveSbtPageUrlAutoMintIntentArgs = {
  propsIn?: SbtAddressPropsLike | null;
  searchRaw?: unknown;
  sessionStorageRef?: SbtPageSessionStorageLike | null;
  state?: SbtPageUrlAutoMintState | null;
  windowSearch?: unknown;
};
type BuildSbtPageParentSessionScanProgressArgs = {
  progress?: unknown;
  sessionConfig?: Record<string, unknown> | null;
  sessionLabel?: unknown;
  sessionSlug?: unknown;
};
type BuildSbtPageEffectiveHolderScanProgressArgs = {
  getParentProgress?: (() => unknown) | null;
  getSessionLabel?: (() => unknown) | null;
  getSessionSlug?: (() => unknown) | null;
  localProgress?: unknown;
};
type ResolveSbtPageHolderScanActiveArgs = {
  hasActiveScanProgress?: unknown;
  loadingMintersBurners?: unknown;
  loadingMintedFilter?: unknown;
  sbtScanInProgress?: unknown;
  sbtScanPending?: unknown;
};
type ResolveSbtPageHolderLoadingStateArgs = {
  countsLoaded?: unknown;
  hasComputedHolders?: unknown;
  hasFilteredHolders?: unknown;
  isScanActive?: unknown;
  loadingMintersBurners?: unknown;
  loadingMintedFilter?: unknown;
  mintedTokensOverride?: unknown;
  netHoldersCount?: unknown;
  sbtScanInProgress?: unknown;
  sbtScanPending?: unknown;
};
type ResolveSbtPageHolderResolutionStateArgs = {
  isRefreshing?: unknown;
  loadingMintersBurners?: unknown;
  loadingMintedFilter?: unknown;
  mintedAddresses?: unknown[];
  mintedTokensOverride?: unknown;
  showScanProgress?: unknown;
};
type ResolveSbtPageHoldersDisplayCountArgs = {
  mintedTokensOverride?: unknown;
  netHoldersCount?: unknown;
  shouldOverrideMinted?: unknown;
};
type ResolveSbtPageMiniBurnPermissionArgs = {
  account?: unknown;
  sbtInfo?: unknown;
  userIsSbtAdmin?: unknown;
};
type ResolveSbtPageBurnButtonStateArgs = {
  account?: unknown;
  sbtInfo?: unknown;
  userHasSBT?: unknown;
};
type SbtPageBurnButtonState = {
  canOwnerBurn: boolean;
  shouldRenderBurnButton: boolean;
};
type ResolveSbtPageBurnStatusButtonStateArgs = {
  burningStatus?: unknown;
};
type SbtPageBurnStatusButtonState = {
  disabled: boolean;
  isFailure: boolean;
  isIdle: boolean;
  isPending: boolean;
  isSuccess: boolean;
};
type ResolveSbtPageAdminBurnButtonStateArgs = ResolveSbtPageBurnStatusButtonStateArgs & {
  burnSearchResult?: unknown;
};
type ResolveSbtPageOpenMintButtonStateArgs = {
  burningStatus?: unknown;
  lastMintTxHash?: unknown;
  mintLowerLabel?: unknown;
  mintingStatus?: unknown;
};
type SbtPageOpenMintButtonState = {
  canOpenMintTx: boolean;
  disabled: boolean;
  isFailure: boolean;
  isIdle: boolean;
  isMinted: boolean;
  isPending: boolean;
  title?: string;
};
type ResolveSbtPagePasswordJoinButtonStateArgs = {
  groupPasswordInput?: unknown;
  mintingStatus?: unknown;
};
type SbtPagePasswordJoinButtonState = {
  disabled: boolean;
  isPending: boolean;
};
type ResolveSbtPagePendingButtonContentStateArgs = {
  isPending?: unknown;
  label?: unknown;
};
type SbtPagePendingButtonContentState = {
  label: string;
  shouldRenderLabel: boolean;
  shouldRenderPendingIcon: boolean;
};
type ResolveSbtPageStatusButtonContentStateArgs = {
  failureLabel?: unknown;
  idleLabel?: unknown;
  isFailure?: unknown;
  isIdle?: unknown;
  isPending?: unknown;
  isSuccess?: unknown;
  successLabel?: unknown;
};
type SbtPageStatusButtonContentState = {
  failureLabel: string;
  idleLabel: string;
  shouldRenderFailure: boolean;
  shouldRenderIdleLabel: boolean;
  shouldRenderPendingIcon: boolean;
  shouldRenderSuccess: boolean;
  successLabel: string;
};
type ResolveSbtPagePasswordGenerationButtonStateArgs = {
  passwordGenerationCount?: unknown;
};
type SbtPagePasswordGenerationButtonState = {
  disabled: boolean;
};
type ResolveSbtPagePasswordAlertStateArgs = {
  mintPassword?: unknown;
  sbtMintPassword?: unknown;
  showPasswordAlert?: unknown;
};
type SbtPagePasswordAlertState = {
  showDetectedPasswordAlert: boolean;
};
type ResolveSbtPageActionFeedbackStateArgs = {
  burningStatus?: unknown;
  error?: unknown;
  lastBurnTxHash?: unknown;
  lastMintTxHash?: unknown;
  mintingStatus?: unknown;
  transactionHash?: unknown;
};
type SbtPageActionFeedbackState = {
  showBurnSuccess: boolean;
  showErrorTransactionHash: boolean;
  showMintSuccess: boolean;
  showTransactionError: boolean;
};
type ResolveSbtPageManualClaimButtonStateArgs = {
  manualPasswordInput?: unknown;
  mintingStatus?: unknown;
};
type SbtPageManualClaimButtonState = {
  disabled: boolean;
  isPending: boolean;
};
type ResolveSbtPageMiniOpenMintButtonStateArgs = {
  mintingStatus?: unknown;
};
type ResolveSbtPageMiniActionStatusDisplayStateArgs = {
  isFailure?: unknown;
};
type BuildSbtPageActionButtonClassNameArgs = {
  actionClassName?: unknown;
  includeMiniClass?: unknown;
  miniClassName?: unknown;
  variantClassName?: unknown;
};
type SbtPageMiniActionStatusDisplayState = {
  style: Record<string, string>;
};
type ResolveSbtPageMiniControlDisplayStateArgs = {
  inputMaxWidth?: unknown;
};
type SbtPageMiniControlDisplayState = {
  inputStyle: Record<string, string>;
  topMarginStyle: Record<string, string>;
};
type SbtPageMiniOpenMintButtonState = {
  disabled: boolean;
  isFailure: boolean;
  isIdle: boolean;
  isPending: boolean;
  isSuccess: boolean;
};
type ResolveSbtPageMiniMintFlowDisplayStateArgs = {
  hasGroupPasswordMint?: unknown;
  hasInviteMint?: unknown;
  hasPasswordMint?: unknown;
  hasTokenMini?: unknown;
  isMintingActive?: unknown;
  miniMintable?: unknown;
  mintStep?: unknown;
  showMiniPasswordInput?: unknown;
};
type SbtPageMiniMintFlowDisplayState = {
  shouldRenderGroupPasswordDisclosureButton: boolean;
  shouldRenderGroupPasswordInput: boolean;
  shouldRenderInviteDisclosureButton: boolean;
  shouldRenderInviteInput: boolean;
  shouldRenderManualClaimCountdown: boolean;
  shouldRenderManualClaimSuccess: boolean;
  shouldRenderManualPasswordDisclosureButton: boolean;
  shouldRenderManualPasswordFinishInput: boolean;
  shouldRenderManualPasswordStartInput: boolean;
  shouldRenderOpenMintButton: boolean;
};
type ResolveSbtPageMiniBurnButtonStateArgs = {
  burningStatus?: unknown;
};
type SbtPageMiniBurnButtonState = {
  disabled: boolean;
  isPending: boolean;
};
type ResolveSbtPageMiniTokenActionDisplayStateArgs = {
  burningStatus?: unknown;
  canBurnMini?: unknown;
};
type SbtPageMiniTokenActionDisplayState = {
  shouldRenderBurnButton: boolean;
  shouldRenderBurnedStatus: boolean;
  shouldRenderJoinedStatus: boolean;
};
type ResolveSbtPageAdminActionStateArgs = {
  account?: unknown;
  hasInviteMint?: unknown;
  sbtInfo?: unknown;
};
type ResolveSbtPageMintFlowDisplayStateArgs = {
  hasGroupPasswordMint?: unknown;
  hasInviteMint?: unknown;
  mintingStatus?: unknown;
  mintStep?: unknown;
  sbtInfo?: unknown;
};
type SbtPageAdminActionState = {
  canAdminBurn: boolean;
  hasPasswordMint: boolean;
  isInvite: boolean;
  showNoMoreInvites: boolean;
  showPasswordGen: boolean;
};
type SbtPageMintFlowDisplayState = {
  shouldRenderClaimCountdown: boolean;
  shouldRenderClaimSuccess: boolean;
  shouldRenderGroupPasswordJoin: boolean;
  shouldRenderInviteJoin: boolean;
  shouldRenderManualClaimFinish: boolean;
  shouldRenderManualClaimStart: boolean;
  shouldRenderOpenMintButton: boolean;
  shouldSuppressMintControls: boolean;
};
type ResolveSbtPageRelevantInfoListsArgs = {
  sbtInfo?: unknown;
};
type SbtPageRelevantInfoLists = {
  documentIDHashes: string[];
  documentURLs: string[];
  tags: string[];
};
type ResolveSbtPageRelevantInfoDisplayStateArgs = {
  documentIDHashes?: unknown;
  documentURLs?: unknown;
  tags?: unknown;
};
type SbtPageRelevantInfoDisplayState = {
  shouldRenderDocumentIdHashes: boolean;
  shouldRenderDocumentUrls: boolean;
  shouldRenderTags: boolean;
};
type ShouldRenderSbtPageMintButtonArgs = {
  burningStatus?: unknown;
  nowSeconds?: unknown;
  sbtInfo?: unknown;
  userHasSBT?: unknown;
};
type ResolveSbtPageScanProgressPercentArgs = {
  progress?: unknown;
  showScanProgress?: unknown;
};
type ResolveSbtPageScanProgressFillStyleArgs = {
  percent?: unknown;
};
type ResolveSbtPageScanProgressDisplayArgs = {
  phaseLabel?: unknown;
  rawRemainingBlocksCount?: unknown;
  sessionLabel?: unknown;
  showScanProgress?: unknown;
};
type ShouldShowSbtPageScanProgressArgs = {
  effectiveLoading?: unknown;
  hasActiveScanProgress?: unknown;
  rawRemainingBlocksCount?: unknown;
};
type ResolveSbtPageHolderFilterItemsArgs = {
  filteredMintedUsers?: unknown;
  hasComputedHolders?: unknown;
  hasFilteredHolders?: unknown;
  isScanActive?: unknown;
  netHolders?: unknown;
};
type ResolveSbtPageHolderModalDisplayStateArgs = {
  addressesAreResolving?: unknown;
  hasActiveScanProgress?: unknown;
  hasComputedHolders?: unknown;
  hasFilteredHolders?: unknown;
  holdersReady?: unknown;
  isInitialLoading?: unknown;
  isRefreshing?: unknown;
  isScanActive?: unknown;
  loadingMintersBurners?: unknown;
  loadingMintedFilter?: unknown;
  shouldOverrideMinted?: unknown;
  showModal?: unknown;
  showScanProgress?: unknown;
};
type SbtPageHolderLoadingState = {
  countsReady: boolean;
  effectiveLoading: boolean;
  holdersReady: boolean;
  isGlobalLoading: boolean;
  isLocalLoading: boolean;
  netMinted: string;
  shouldOverrideMinted: boolean;
  terminalEmptyHoldersState: boolean;
};
type SbtPageHolderResolutionState = {
  addressesAreResolving: boolean;
  addressesNeedResolutionHint: boolean;
};
type SbtPageMiniBurnPermission = {
  canAdminBurn: boolean;
  canBurnMini: boolean;
  canOwnerBurn: boolean;
};
type SbtPageScanProgressDisplay = {
  remainingBlocksCount: number;
  scanProgressSessionText: string | null;
  scanProgressText: string | null;
};
type SbtPageHolderFilterItems = {
  filteredMintedUsers: unknown[];
  holderItemsForFilter: unknown;
  keepStaleFilterRowsWhileRefreshing: boolean;
};
type SbtPageHolderModalDisplayState = {
  mintedCountTitle?: string;
  showApproximateCountHint: boolean;
  showCornerSpinner: boolean;
  showEmptyStateInModal: boolean;
  showHeaderCount: boolean;
  showScanProgressInModal: boolean;
  showSpinnerInModalBody: boolean;
  waitingForHolderDetails: boolean;
};
type SbtPageQueuedJsonWritesLike = {
  get?: (key: string) => unknown;
};
type SbtPageStoredJsonReaderLike = {
  getItem?: (key: string) => string | null;
};
type SerializeSbtPageLocalStorageJsonWriteArgs = {
  key?: unknown;
  value?: unknown;
};
type SbtPageSerializedLocalStorageJsonWrite = {
  nextJson: string;
  storageKey: string;
};
type ResolveSbtPageLocalStorageJsonWriteDecisionArgs = {
  cachedJson?: unknown;
  currentRaw?: unknown;
  nextJson?: unknown;
};
export type SbtPageLocalStorageJsonWriteDecision = 'adopt' | 'skip' | 'write';
type ReadSbtPageQueuedOrStoredLocalStorageJsonArgs<T extends Record<string, unknown>> = {
  fallback: T;
  key?: unknown;
  queuedWrites?: SbtPageQueuedJsonWritesLike | null;
  storageRef?: SbtPageStoredJsonReaderLike | null;
};
type AppendSbtPageTransactionHashArgs = {
  cacheObj?: unknown;
  txHash: string;
  userAddress?: unknown;
};
type AppendSbtPageTransactionHashResult = {
  shouldWrite: boolean;
  txCache: Record<string, unknown>;
};
type AppendSbtPageBookmarkArgs = {
  bookmarksObj?: unknown;
  sbtAddress?: unknown;
};
type AppendSbtPageBookmarkResult = {
  bookmarks: Record<string, unknown>;
  shouldWrite: boolean;
};
type ResolveSbtPagePasswordExportSelectionArgs = {
  adminGeneratedPasswords?: unknown;
  cachedPasswords?: unknown;
  includePreviousPasswords?: unknown;
};
type ResolveSbtPagePasswordExportControlsStateArgs = {
  adminGeneratedPasswordList?: unknown;
  effectiveIncludePreviousPasswords?: unknown;
  onlyCachedPasswords?: unknown;
};
type ResolveSbtPagePasswordInventoryDisplayStateArgs = {
  combinedPasswords?: unknown;
  showNoMoreInvites?: unknown;
  showPasswordGen?: unknown;
};
type SbtPageRandomBytesReader = (length: number) => Uint8Array | number[];
type SbtPageGetRandomValues = (array: Uint8Array) => Uint8Array;
type GenerateSbtPageRandomPasswordsArgs = {
  count?: unknown;
  getRandomValues?: SbtPageGetRandomValues | null;
  randomBytes?: SbtPageRandomBytesReader | null;
};
type BuildSbtPagePasswordExportRowsArgs = {
  baseUrl?: unknown;
  codeLabel?: unknown;
  demoPath?: unknown;
  encodeGroupPassword?: ((code: string) => string) | null;
  isInvite?: unknown;
  passwordsToExport?: unknown;
  sbtAddr?: unknown;
  sbtBasePathValue?: unknown;
};
type BuildSbtPagePasswordInviteLinkArgs = {
  baseUrl?: unknown;
  code?: unknown;
  demoPath?: unknown;
  encodeGroupPassword?: ((code: string) => string) | null;
  isInvite?: unknown;
  sbtAddr?: unknown;
  sbtBasePathValue?: unknown;
};
type SbtPageGroupPasswordCodec = {
  encodeGroupPasswordForUrl?: (raw: unknown) => string | null | undefined;
  normalizeGroupPasswordInput?: (raw: unknown) => string;
};
type BuildSbtPagePasswordExportFileArgs = {
  codeLabel?: unknown;
  date?: unknown;
  fileLabel?: unknown;
  format?: unknown;
  rows?: unknown;
  sbtSymbolOrName?: unknown;
};
type SbtPagePasswordExportSelection = {
  adminGeneratedPasswordList: string[];
  cachedPasswordList: string[];
  combinedPasswords: string[];
  effectiveIncludePreviousPasswords: unknown;
  onlyCachedPasswords: boolean;
  passwordsToExport: string[];
};
type SbtPagePasswordExportControlsState = {
  effectiveIncludePreviousPasswordsChecked: boolean;
  renderIncludePreviousCheckbox: boolean;
  showCachedPasswordsIncludedNote: boolean;
};
type SbtPagePasswordInventoryDisplayState = {
  shouldRenderGeneratedPasswordList: boolean;
  shouldRenderNoMoreInvitesEmptyState: boolean;
  shouldRenderPasswordGenerationSection: boolean;
  shouldRenderPreviousPasswordsSection: boolean;
};
export type SbtPagePasswordExportFormat = 'json' | 'csv';
export type SbtPagePasswordExportRow = Record<string, string> & {
  inviteLink: string;
};
export type SbtPagePasswordExportFile = {
  content: string;
  fileName: string;
  mimeType: string;
};
type SbtPageLoadInfoRequestNetwork = {
  id?: unknown;
};
type SbtPageChainIdNetworkLike = {
  id?: unknown;
};
type SbtPageSessionChainIdReader = (slug: string) => unknown;
type SbtPageBlockTimeReader = (chainId: unknown) => number;
type ResolveSbtPageActiveChainIdArgs = {
  getSessionChainId?: SbtPageSessionChainIdReader;
  propNetwork?: SbtPageChainIdNetworkLike | null;
  sbtInfo?: Record<string, unknown> | null;
  sessionSlug?: unknown;
  stateNetwork?: SbtPageChainIdNetworkLike | null;
};
type ResolveSbtPageRecoveryCacheChainIdArgs = ResolveSbtPageActiveChainIdArgs & {
  propSBTAddress?: unknown;
};
type ResolveSbtPageActiveBlockTimeMsArgs = {
  activeChainId?: unknown;
  getChainBlockTimeMs?: SbtPageBlockTimeReader;
  multiplier?: unknown;
};
type BuildSbtPageClaimCountdownTickPatchArgs = {
  remainingMs?: unknown;
};
type BuildSbtPageClaimCountdownCompletePatchArgs = {
  waitMs?: unknown;
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
type SessionSlugPropsLike = {
  sessionSlug?: unknown;
  slug?: unknown;
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
export type SbtPageInfoImageLike = Record<string, unknown> & {
  image?: unknown;
};
export type SbtPageHistorySummary = {
  activeSupply: string;
  currentHolderCount: string;
  historicalHolderCount: string;
  totalBurned: string;
  totalMinted: string;
};
export type SbtPageHistorySummaryInput = Record<string, unknown> & {
  activeSupply?: unknown;
  currentHolderCount?: unknown;
  historicalHolderCount?: unknown;
  totalBurned?: unknown;
  totalMinted?: unknown;
};
type ApplySbtPageHistorySummaryFallbackArgs = {
  mintedTokensOverride?: string | null;
  mintedTokensSource?: string | null;
  ownerLookupUpperBound?: string | null;
  sourceLabel?: unknown;
  summaryValue?: unknown;
};
type SbtPageHistorySummaryFallbackState = {
  mintedTokensOverride: string | null;
  mintedTokensSource: string | null;
  ownerLookupUpperBound: string | null;
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
type SbtPageDisplayImageFallbackState = {
  displayImageFallbackKey?: unknown;
  displayImageFallbackIndex?: unknown;
};
type SbtPageDisplayImageNextFallbackArgs = {
  activeIndex?: number;
  maxIndex?: number;
  sourceKey?: string;
};
type ResolveSbtPageFullViewShellStateArgs = {
  error?: unknown;
  hasSbtAddress?: unknown;
  sbtInfo?: unknown;
};
type ResolveSbtPageSectionToggleDisplayStateArgs = {
  open?: unknown;
};
type BuildSbtPageSectionHeaderClassNameArgs = {
  baseClassName?: unknown;
  roundedClassName?: unknown;
};
type ResolveSbtPageCopyIconStateArgs = {
  copied?: unknown;
  copiedAddress?: unknown;
  targetKey?: unknown;
};
type ResolveSbtPageBookmarkButtonDisplayStateArgs = {
  bookmarked?: unknown;
};
type SbtPageFullViewShellState = {
  shouldRenderContent: boolean;
  shouldRenderError: boolean;
  shouldRenderLoading: boolean;
  shouldRenderMissingAddress: boolean;
};
type SbtPageSectionToggleDisplayState = {
  isOpen: boolean;
  shouldRenderClosedIcon: boolean;
  shouldRenderOpenIcon: boolean;
};
type SbtPageCopyIconState = {
  shouldRenderCopiedIcon: boolean;
  shouldRenderDefaultIcon: boolean;
};
type SbtPageBookmarkButtonDisplayState = {
  iconStyle: Record<string, string | undefined>;
};
type BuildSbtPageInitialStateArgs = {
  network?: unknown;
};
type BuildSbtPageBooleanTogglePatchArgs = {
  state?: unknown;
  stateKey?: unknown;
};
type BuildSbtPageAddressChangeResetMintUiPatchArgs = {
  sbtAddressChanged?: unknown;
};
type BuildSbtPageNetworkUpdatePatchArgs = {
  network?: unknown;
  resetMintUiState?: Record<string, unknown> | null;
};
type BuildSbtPageMintFailurePatchArgs = {
  error?: unknown;
};
type BuildSbtPageMintPendingPatchArgs = {
  clearError?: unknown;
};
type BuildSbtPageMintSuccessPatchArgs = {
  clearManualPassword?: unknown;
  mintStep?: unknown;
  txHash?: unknown;
};
type BuildSbtPageBurnFailurePatchArgs = {
  error?: unknown;
  resetBurnSearch?: unknown;
};
type BuildSbtPageBurnSuccessPatchArgs = {
  resetBurnSearch?: unknown;
  txHash?: unknown;
};
type BuildSbtPageBurnSearchInputPatchArgs = {
  input?: unknown;
};
type BuildSbtPageBurnSearchResultPatchArgs = {
  address?: unknown;
  resultType?: unknown;
  tokenId?: unknown;
};
type BuildSbtPageErrorPatchArgs = {
  error?: unknown;
};
type BuildSbtPageCachedPasswordsPatchArgs = {
  cachedPasswords?: unknown;
};
type BuildSbtPageMintedModalVisibilityPatchArgs = {
  visible?: unknown;
};
type BuildSbtPageLoadingMintersBurnersPatchArgs = {
  loading?: unknown;
};
type BuildSbtPageLoadInfoLoadingStartPatchArgs = {
  hasExplicitSlug?: unknown;
  normalizedExplicitSlug?: unknown;
};
type BuildSbtPageMintCountdownPatchArgs = {
  countdown?: unknown;
};
type BuildSbtPageIntervalIdPatchArgs = {
  intervalId?: unknown;
};
type BuildSbtPageSbtInfoPatchArgs = {
  sbtInfo?: unknown;
};
type BuildSbtPageResolvedSessionSlugPatchArgs = {
  slug?: unknown;
};
type BuildSbtPageRelevantInfoPatchArgs = {
  sbtLabel?: unknown;
};
type BuildSbtPageLogScanProgressPatchArgs = {
  progress?: unknown;
  slug?: unknown;
};
type BuildSbtPageBookmarkedPatchArgs = {
  bookmarked?: unknown;
};
type BuildSbtPagePasswordMintInputPatchArgs = {
  inputField?: unknown;
  inputValue?: unknown;
};
type BuildSbtPagePasswordInputValuePatchArgs = {
  inputField?: unknown;
  inputValue?: unknown;
};
type BuildSbtPageMintPasswordPrefillPatchArgs = {
  currentGroupPasswordInput?: unknown;
  finalPasswordToUse?: unknown;
  invitePayload?: {
    inviteCode?: unknown;
  } | null;
  isList?: unknown;
};
type BuildSbtPagePasswordClaimStartSuccessPatchArgs = {
  txHash?: unknown;
};
type BuildSbtPageAdminInviteSuccessPatchArgs = {
  passwordList?: unknown;
};
type BuildSbtPageExportFormatPatchArgs = {
  exportFormat?: unknown;
};
type BuildSbtPageIncludePreviousPasswordsPatchArgs = {
  includePreviousPasswords?: unknown;
};
type BuildSbtPagePasswordGenerationCountPatchArgs = {
  value?: unknown;
};
type BuildSbtPageCopiedAddressPatchArgs = {
  addressType?: unknown;
};
type BuildSbtPageCopiedErrorPatchArgs = {
  copied?: unknown;
};
type BuildSbtPageMiniPasswordInputPatchArgs = {
  visible?: unknown;
};
type SbtPageAdminInviteSuccessPatch = {
  adminGeneratedPasswords: unknown[];
  passwordGenerationCount: '';
};
type SbtPageDocModalResetPatch = {
  docModalOpen: false;
  docModalLoading: false;
  docModalError: '';
  docModalContent: '';
  docModalName: '';
  docModalBlobUrl: '';
};
type BuildSbtPageDocModalOpenPatchArgs = {
  blobUrl?: unknown;
  content?: unknown;
  error?: unknown;
  loading?: unknown;
  name?: unknown;
};
type BuildSbtPageDocModalContentPatchArgs = {
  blobUrl?: unknown;
  content?: unknown;
  error?: unknown;
  name?: unknown;
};
type BuildSbtPageDocModalErrorPatchArgs = {
  error?: unknown;
};
type SbtPageDocModalOpenPatch = {
  docModalOpen: true;
  docModalLoading: boolean;
  docModalError: string;
  docModalContent: string;
  docModalName: string;
  docModalBlobUrl: string;
};
type SbtPageDocModalContentPatch = {
  docModalLoading: false;
  docModalError: string;
  docModalContent: string;
  docModalName: string;
  docModalBlobUrl: string;
};
type SbtPageDocModalErrorPatch = {
  docModalLoading: false;
  docModalError: string;
};
export type SbtPageDisplayImageState = {
  sourceKey: string;
  candidates: string[];
  activeIndex: number;
  src: string;
  canRetry: boolean;
};

export const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object'
);

export const toStringList = (value: unknown): string[] => (
  Array.isArray(value) ? value.map((entry) => String(entry ?? '')) : []
);

export const buildSbtPageInitialState = ({
  network = null,
}: BuildSbtPageInitialStateArgs = {}): Record<string, unknown> => ({
  sbtInfo: null,
  userHasSBT: false,
  userIsSbtAdmin: false,
  claimCountdown: 5,
  error: null,
  copiedAddress: null,
  network,
  bookmarked: false,
  showModal: false,
  showFullImage: false,
  mintedAddresses: [],
  burnedAddresses: [],
  countsLoaded: false,
  holdersMetaKey: null,
  mintedTokensOverride: null,
  showStats: true,
  showActions: true,
  showMoreDetails: false,
  showAdminSection: false,
  showDocsSection: true,
  intervalId: null,
  loadingMintersBurners: true,
  mintingStatus: 'idle',
  burningStatus: 'idle',
  mintPassword: '',
  groupPasswordInput: '',
  mintStep: 0,
  relevantQuestions: [],
  relevantDocuments: [],
  showPasswordAlert: false,
  mintCountdown: null,
  transactionHash: null,
  burnSearchInput: '',
  burnSearchResult: null,
  burnSearchType: null,
  filteredMintedUsers: [],
  filteredMintedUsersSignature: '',
  loadingMintedFilter: false,
  lastTransactionType: null,
  adminInvitesToGenerate: '',
  adminGeneratedPasswords: [],
  manualPasswordInput: '',
  createGroupMode: false,
  passwordGenerationCount: '',
  mintingAddressesFilterInitialized: false,
  includePreviousPasswords: false,
  exportFormat: 'json',
  cachedPasswords: [],
  newPasswords: [],
  lastMintTxHash: null,
  lastBurnTxHash: null,
  showMiniPasswordInput: false,
  hasGroupPasswordMint: false,
  hasInviteMint: false,
  groupPasswordHash: null,
  groupPasswordHashLoaded: false,
  docModalOpen: false,
  docModalLoading: false,
  docModalError: '',
  docModalContent: '',
  docModalName: '',
  docModalBlobUrl: '',
  resolvedSessionSlug: null,
  logScanProgress: null,
  displayImageFallbackKey: '',
  displayImageFallbackIndex: 0,
});

export const buildSbtPageBooleanTogglePatch = ({
  state = {},
  stateKey = '',
}: BuildSbtPageBooleanTogglePatchArgs = {}): Record<string, boolean> => {
  const key = String(stateKey || '');
  const source = isRecord(state) ? state : {};
  return {
    [key]: !source[key],
  };
};

export const buildSbtPageAddressChangeResetMintUiPatch = ({
  sbtAddressChanged = false,
}: BuildSbtPageAddressChangeResetMintUiPatchArgs = {}): Record<string, unknown> | null => (
  sbtAddressChanged
    ? {
      showMiniPasswordInput: false,
      mintStep: 0,
      mintingStatus: 'idle',
      burningStatus: 'idle',
      manualPasswordInput: '',
      groupPasswordInput: '',
      mintPassword: '',
      showPasswordAlert: false,
      error: null,
    }
    : null
);

export const buildSbtPageNetworkUpdatePatch = ({
  network = null,
  resetMintUiState = null,
}: BuildSbtPageNetworkUpdatePatchArgs = {}): Record<string, unknown> => ({
  ...(resetMintUiState || {}),
  network,
});

export const buildSbtPageMintFailurePatch = ({
  error = null,
}: BuildSbtPageMintFailurePatchArgs = {}): Record<string, unknown> => ({
  error,
  mintingStatus: 'failure',
});

export const buildSbtPageMintPendingPatch = ({
  clearError = false,
}: BuildSbtPageMintPendingPatchArgs = {}): Record<string, unknown> => ({
  mintingStatus: 'pending',
  lastTransactionType: 'mint',
  ...(clearError === true ? { error: null } : {}),
});

export const buildSbtPageMintSuccessPatch = ({
  clearManualPassword = false,
  mintStep,
  txHash = '',
}: BuildSbtPageMintSuccessPatchArgs = {}): Record<string, unknown> => ({
  mintingStatus: 'success',
  transactionHash: txHash,
  lastTransactionType: 'mint',
  lastMintTxHash: txHash,
  ...(mintStep !== undefined ? { mintStep } : {}),
  ...(clearManualPassword === true ? { manualPasswordInput: '' } : {}),
});

export const buildSbtPageBurnFailurePatch = ({
  error = null,
  resetBurnSearch = false,
}: BuildSbtPageBurnFailurePatchArgs = {}): Record<string, unknown> => ({
  error,
  burningStatus: 'failure',
  ...(resetBurnSearch === true
    ? {
      burnSearchInput: '',
      burnSearchResult: null,
      burnSearchType: null,
    }
    : {}),
});

export const buildSbtPageBurnPendingPatch = (): Record<string, string> => ({
  burningStatus: 'pending',
  lastTransactionType: 'burn',
});

export const buildSbtPageBurnSuccessPatch = ({
  resetBurnSearch = false,
  txHash = '',
}: BuildSbtPageBurnSuccessPatchArgs = {}): Record<string, unknown> => ({
  burningStatus: 'success',
  transactionHash: txHash,
  lastTransactionType: 'burn',
  lastBurnTxHash: txHash,
  ...(resetBurnSearch === true
    ? {
      burnSearchInput: '',
      burnSearchResult: null,
      burnSearchType: null,
    }
    : {}),
});

export const buildSbtPageBurnSearchInputPatch = ({
  input = '',
}: BuildSbtPageBurnSearchInputPatchArgs = {}): Record<string, unknown> => ({
  burnSearchInput: String(input ?? ''),
  burnSearchResult: null,
  burnSearchType: null,
});

export const buildSbtPageBurnSearchResultPatch = ({
  address = '',
  resultType = '',
  tokenId = null,
}: BuildSbtPageBurnSearchResultPatchArgs = {}): Record<string, unknown> => ({
  burnSearchResult: {
    address,
    tokenId,
  },
  burnSearchType: String(resultType ?? ''),
});

export const buildSbtPageErrorPatch = ({
  error = null,
}: BuildSbtPageErrorPatchArgs = {}): Record<string, unknown> => ({
  error,
});

export const buildSbtPageCachedPasswordsPatch = ({
  cachedPasswords = [],
}: BuildSbtPageCachedPasswordsPatchArgs = {}): Record<string, unknown> => ({
  cachedPasswords,
});

export const buildSbtPageMintedModalVisibilityPatch = ({
  visible = false,
}: BuildSbtPageMintedModalVisibilityPatchArgs = {}): Record<string, boolean> => ({
  showModal: visible === true,
});

export const buildSbtPageMintedModalInitialFilterPatch = ({
  buildAddressListSignature = buildSbtPageHolderListSignature,
  netHolders = [],
}: BuildSbtPageMintedModalInitialFilterPatchArgs = {}): SbtPageMintedModalInitialFilterPatch => {
  const safeNetHolders = Array.isArray(netHolders) ? netHolders : [];
  return {
    filteredMintedUsers: safeNetHolders,
    filteredMintedUsersSignature: buildAddressListSignature(safeNetHolders),
    mintingAddressesFilterInitialized: true,
    loadingMintedFilter: false,
  };
};

export const buildSbtPageLoadingMintersBurnersPatch = ({
  loading = false,
}: BuildSbtPageLoadingMintersBurnersPatchArgs = {}): Record<string, boolean> => ({
  loadingMintersBurners: loading === true,
});

export const buildSbtPageLoadInfoLoadingStartPatch = ({
  hasExplicitSlug = false,
  normalizedExplicitSlug = null,
}: BuildSbtPageLoadInfoLoadingStartPatchArgs = {}): Record<string, unknown> => ({
  loadingMintersBurners: true,
  logScanProgress: null,
  ...(hasExplicitSlug === true ? { resolvedSessionSlug: normalizedExplicitSlug } : {}),
});

export const buildSbtPageMintCountdownPatch = ({
  countdown = null,
}: BuildSbtPageMintCountdownPatchArgs = {}): Record<string, unknown> => ({
  mintCountdown: countdown,
});

export const buildSbtPageIntervalIdPatch = ({
  intervalId = null,
}: BuildSbtPageIntervalIdPatchArgs = {}): Record<string, unknown> => ({
  intervalId,
});

export const buildSbtPageSbtInfoPatch = ({
  sbtInfo = null,
}: BuildSbtPageSbtInfoPatchArgs = {}): Record<string, unknown> => ({
  sbtInfo,
});

export const buildSbtPageResolvedSessionSlugPatch = ({
  slug = null,
}: BuildSbtPageResolvedSessionSlugPatchArgs = {}): Record<string, unknown> => ({
  resolvedSessionSlug: slug,
});

export const buildSbtPageRelevantInfoPatch = ({
  sbtLabel = 'SBT',
}: BuildSbtPageRelevantInfoPatchArgs = {}): Record<string, unknown> => {
  const label = String(sbtLabel || 'SBT');
  return {
    relevantQuestions: [`What is the purpose of this ${label}?`, `How can I use this ${label}?`],
    relevantDocuments: [`${label} Whitepaper`, 'Community Guidelines'],
  };
};

export const buildSbtPageLogScanProgressPatch = ({
  progress = {},
  slug = '',
}: BuildSbtPageLogScanProgressPatchArgs = {}): Record<string, unknown> => ({
  logScanProgress: {
    ...(isRecord(progress) ? progress : {}),
    slug,
  },
});

export const buildSbtPageBookmarkedPatch = ({
  bookmarked = false,
}: BuildSbtPageBookmarkedPatchArgs = {}): Record<string, boolean> => ({
  bookmarked: bookmarked === true,
});

export const buildSbtPagePasswordMintInputPatch = ({
  inputField = 'groupPasswordInput',
  inputValue = '',
}: BuildSbtPagePasswordMintInputPatchArgs = {}): Record<string, unknown> => {
  const field = inputField === 'manualPasswordInput' ? 'manualPasswordInput' : 'groupPasswordInput';
  return {
    [field]: String(inputValue ?? ''),
    mintingStatus: 'idle',
    mintStep: 0,
    error: null,
  };
};

export const buildSbtPagePasswordInputValuePatch = ({
  inputField = 'groupPasswordInput',
  inputValue = '',
}: BuildSbtPagePasswordInputValuePatchArgs = {}): Record<string, unknown> => {
  const field = inputField === 'manualPasswordInput' ? 'manualPasswordInput' : 'groupPasswordInput';
  return {
    [field]: String(inputValue ?? ''),
  };
};

export const buildSbtPageMintPasswordPrefillPatch = ({
  currentGroupPasswordInput = '',
  finalPasswordToUse = '',
  invitePayload = null,
  isList = false,
}: BuildSbtPageMintPasswordPrefillPatchArgs = {}): Record<string, unknown> => {
  const hasInvitePayload = !!invitePayload;
  const shouldHidePlainPassword = isList === true || hasInvitePayload;
  return {
    mintPassword: shouldHidePlainPassword ? '' : finalPasswordToUse,
    manualPasswordInput: shouldHidePlainPassword ? '' : finalPasswordToUse,
    groupPasswordInput: hasInvitePayload ? invitePayload?.inviteCode : currentGroupPasswordInput,
    mintStep: 0,
    showPasswordAlert: isList !== true && !hasInvitePayload,
  };
};

export const buildSbtPageMintPasswordClearPatch = (): Record<string, unknown> => ({
  mintPassword: '',
  manualPasswordInput: '',
  showPasswordAlert: false,
});

export const buildSbtPagePasswordClaimStartSuccessPatch = ({
  txHash = '',
}: BuildSbtPagePasswordClaimStartSuccessPatchArgs = {}): Record<string, unknown> => ({
  mintStep: 1,
  mintingStatus: 'idle',
  transactionHash: txHash,
});

export const buildSbtPageAdminInviteSuccessPatch = ({
  passwordList = [],
}: BuildSbtPageAdminInviteSuccessPatchArgs = {}): SbtPageAdminInviteSuccessPatch => ({
  adminGeneratedPasswords: Array.isArray(passwordList) ? passwordList : [],
  passwordGenerationCount: '',
});

export const buildSbtPageExportFormatPatch = ({
  exportFormat = '',
}: BuildSbtPageExportFormatPatchArgs = {}): Record<string, unknown> => ({
  exportFormat: String(exportFormat ?? ''),
});

export const buildSbtPageIncludePreviousPasswordsPatch = ({
  includePreviousPasswords = false,
}: BuildSbtPageIncludePreviousPasswordsPatchArgs = {}): Record<string, boolean> => ({
  includePreviousPasswords: includePreviousPasswords === true,
});

export const buildSbtPagePasswordGenerationCountPatch = ({
  value = '',
}: BuildSbtPagePasswordGenerationCountPatchArgs = {}): Record<string, unknown> => {
  const parsed = parseInt(String(value ?? ''), 10);
  return {
    passwordGenerationCount: isNaN(parsed) ? '' : parsed,
  };
};

export const buildSbtPageCopiedAddressPatch = ({
  addressType = null,
}: BuildSbtPageCopiedAddressPatchArgs = {}): Record<string, unknown> => ({
  copiedAddress: addressType,
});

export const buildSbtPageCopiedErrorPatch = ({
  copied = false,
}: BuildSbtPageCopiedErrorPatchArgs = {}): Record<string, boolean> => ({
  copiedError: copied === true,
});

export const buildSbtPageMiniPasswordInputPatch = ({
  visible = false,
}: BuildSbtPageMiniPasswordInputPatchArgs = {}): Record<string, boolean> => ({
  showMiniPasswordInput: visible === true,
});

export const buildSbtPageDocModalResetPatch = (): SbtPageDocModalResetPatch => ({
  docModalOpen: false,
  docModalLoading: false,
  docModalError: '',
  docModalContent: '',
  docModalName: '',
  docModalBlobUrl: '',
});

export const buildSbtPageDocModalOpenPatch = ({
  blobUrl = '',
  content = '',
  error = '',
  loading = false,
  name = '',
}: BuildSbtPageDocModalOpenPatchArgs = {}): SbtPageDocModalOpenPatch => ({
  docModalOpen: true,
  docModalLoading: Boolean(loading),
  docModalError: String(error ?? ''),
  docModalContent: String(content ?? ''),
  docModalName: String(name ?? ''),
  docModalBlobUrl: String(blobUrl ?? ''),
});

export const buildSbtPageDocModalContentPatch = ({
  blobUrl = '',
  content = '',
  error = '',
  name = '',
}: BuildSbtPageDocModalContentPatchArgs = {}): SbtPageDocModalContentPatch => ({
  docModalLoading: false,
  docModalError: String(error ?? ''),
  docModalContent: String(content ?? ''),
  docModalName: String(name ?? ''),
  docModalBlobUrl: String(blobUrl ?? ''),
});

export const buildSbtPageDocModalErrorPatch = ({
  error = '',
}: BuildSbtPageDocModalErrorPatchArgs = {}): SbtPageDocModalErrorPatch => ({
  docModalLoading: false,
  docModalError: String(error ?? ''),
});

export const coerceSbtPageStringArrayValue = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((entry: unknown) => String(entry));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((entry: unknown) => String(entry));
      } catch (_) {}
    }
    return [trimmed];
  }
  return [];
};

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

export const getErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
  const message = (
    error !== null &&
    (typeof error === 'object' || typeof error === 'function') &&
    'message' in error
  )
    ? error.message
    : undefined;
  return error instanceof Error && error.message ? error.message : String(message || error || fallback);
};

export const resolveSbtPageCopyableErrorText = (error: unknown): string => (
  (typeof error === 'string' && error)
    ? error
    : getErrorMessage(error, '')
);

export const coerceSbtPageEpochSeconds = (value: unknown): number => {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 1e12 ? Math.floor(n / 1000) : n;
};

export const normalizeSbtPageHistorySummary = (value: unknown): SbtPageHistorySummary | null => {
  if (!isRecord(value)) return null;
  const summary = value as SbtPageHistorySummaryInput;
  const normalizeField = (fieldValue: unknown): string | null => {
    const raw = String(fieldValue ?? '').trim();
    if (!/^\d+$/.test(raw)) return null;
    return raw.replace(/^0+(?=\d)/, '') || '0';
  };
  const totalMinted = normalizeField(summary.totalMinted);
  const totalBurned = normalizeField(summary.totalBurned);
  const activeSupply = normalizeField(summary.activeSupply);
  const currentHolderCount = normalizeField(summary.currentHolderCount);
  const historicalHolderCount = normalizeField(summary.historicalHolderCount);
  if (
    totalMinted == null ||
    totalBurned == null ||
    activeSupply == null ||
    currentHolderCount == null ||
    historicalHolderCount == null
  ) {
    return null;
  }
  return {
    totalMinted,
    totalBurned,
    activeSupply,
    currentHolderCount,
    historicalHolderCount,
  };
};

export const applySbtPageHistorySummaryFallback = ({
  mintedTokensOverride = null,
  mintedTokensSource = null,
  ownerLookupUpperBound = null,
  sourceLabel = '',
  summaryValue = null,
}: ApplySbtPageHistorySummaryFallbackArgs = {}): SbtPageHistorySummaryFallbackState => {
  const summaryRecord = isRecord(summaryValue) ? summaryValue as SbtPageHistorySummaryInput : {};
  const holderCount = sanitizeSbtPageMintedTokensOverride(summaryRecord.currentHolderCount);
  const totalMinted = sanitizeSbtPageMintedTokensOverride(summaryRecord.totalMinted);
  return {
    mintedTokensOverride: holderCount != null ? holderCount : mintedTokensOverride,
    mintedTokensSource: holderCount != null ? String(sourceLabel || '') : mintedTokensSource,
    ownerLookupUpperBound: totalMinted != null ? totalMinted : ownerLookupUpperBound,
  };
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

export const buildSessionRoutePath = (slugRaw: unknown = '', basePath: unknown = ''): string => {
  const slug = normalizeSessionSlug(slugRaw || '');
  const normalizedBasePath = String(basePath || '').replace(/\/+$/, '');
  return normalizedBasePath + (slug ? `/session/${encodeURIComponent(slug)}` : '/session');
};

export const resolveSbtAddress = (input: unknown): unknown | null => {
  if (Array.isArray(input)) {
    const found = input.find((entry) => isRecord(entry) && entry.sbtAddress !== undefined);
    return found ? found.sbtAddress : null;
  }
  if (isRecord(input) && input.sbtAddress !== undefined) return input.sbtAddress;
  return input || null;
};

export const resolveSbtAddressString = (input: unknown): string => {
  const resolved = resolveSbtAddress(input);
  return resolved ? String(resolved) : '';
};

export const resolveSbtPageAddressLinkState = ({
  address = '',
  isAddress = ethers.utils.isAddress,
  zeroAddress = ethers.constants.AddressZero,
}: ResolveSbtPageAddressLinkStateArgs = {}): SbtPageAddressLinkState => {
  const normalized = String(address || '').trim();
  const isZeroAddress =
    normalized.toLowerCase() === String(zeroAddress || '').toLowerCase();
  return {
    isRenderable: !!normalized && !isZeroAddress && typeof isAddress === 'function' && isAddress(normalized),
    isZeroAddress,
    normalized,
  };
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

export const getCurrentSbtAddressInfo = (propsIn: SbtAddressPropsLike = {}): SbtAddressInfo => {
  const original = resolveSbtAddress(propsIn.SBTAddress) || '';
  return {
    original,
    lower: String(original || '').toLowerCase(),
  };
};

export const resolveSbtPageSessionSlugFromInfo = (info: unknown): string | null => {
  const record = isRecord(info) ? info : {};
  if (Object.prototype.hasOwnProperty.call(record, 'sessionSlug')) {
    const hasExplicitFlag = Object.prototype.hasOwnProperty.call(record, 'sessionSlugExplicit');
    const isExplicitSessionSlug = record.sessionSlugExplicit === true;
    if (isExplicitSessionSlug || !hasExplicitFlag) {
      return normalizeSessionSlug(record.sessionSlug || '');
    }
  }
  const name = String(record.sessionName || '').trim();
  if (!name) return null;
  return getSessionSlugByName(name);
};

export const hasExplicitSbtPageSessionSlugProp = (props: SessionSlugPropsLike = {}): boolean => (
  !!props && (
    Object.prototype.hasOwnProperty.call(props, 'sessionSlug') ||
    Object.prototype.hasOwnProperty.call(props, 'slug')
  )
);

export const getExplicitSbtPageSessionSlug = (props: SessionSlugPropsLike = {}): string | null => {
  if (!hasExplicitSbtPageSessionSlugProp(props)) return null;
  const raw = Object.prototype.hasOwnProperty.call(props || {}, 'sessionSlug')
    ? props.sessionSlug
    : props.slug;
  return normalizeSessionSlug(raw || '');
};

export const resolveSbtPageEffectiveSessionSlug = ({
  props = {},
  resolvedSessionSlug = null,
  sbtInfo = null,
}: ResolveSbtPageEffectiveSessionSlugArgs = {}): string => {
  const propsIn = props || {};
  const explicitSlug = getExplicitSbtPageSessionSlug(propsIn);
  if (explicitSlug != null) return explicitSlug;
  if (resolvedSessionSlug != null) return String(resolvedSessionSlug || '');
  const fromInfo = resolveSbtPageSessionSlugFromInfo(sbtInfo);
  if (fromInfo != null) return fromInfo;
  return String(propsIn.sessionSlug || propsIn.slug || '');
};

export const resolveSbtPageSessionDisplayConfig = ({
  getDemoSessionConfigBySlug: readDemoSessionConfig = null,
  getSessionConfigBySlugOrDefault: readSessionConfig = null,
  sessionSlugRaw = '',
}: ResolveSbtPageSessionDisplayConfigArgs = {}): SbtPageSessionDisplayConfig | null => {
  const sessionSlug = normalizeSessionSlug(sessionSlugRaw || '');
  try {
    const config = (
      (readSessionConfig ? readSessionConfig(sessionSlug || '') : null)
      || (readDemoSessionConfig ? readDemoSessionConfig(sessionSlug || '', { allowDemoFallback: true }) : null)
      || null
    );
    return isRecord(config) ? config as SbtPageSessionDisplayConfig : null;
  } catch (_) {
    return null;
  }
};

export const resolveSbtPageSessionDisplayLabel = ({
  sessionConfig = null,
  sessionSlugRaw = '',
}: ResolveSbtPageSessionDisplayLabelArgs = {}): string => {
  const sessionSlug = normalizeSessionSlug(sessionSlugRaw || '');
  const sessionName = String(
    isRecord(sessionConfig) ? sessionConfig.sessionName || '' : ''
  ).trim();
  if (!sessionSlug) return sessionName || 'General';
  return sessionName || sessionSlug;
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
  burnedAddresses = [],
  countsLoaded = false,
  forceEventFetch = false,
  mintedAddresses = [],
  mintedTokensOverride = null,
}: ResolveSbtPageShouldRefreshCountsArgs = {}): boolean => (
  forceEventFetch === true ||
  (
    !countsLoaded &&
    Array.isArray(mintedAddresses) &&
    mintedAddresses.length === 0 &&
    Array.isArray(burnedAddresses) &&
    burnedAddresses.length === 0 &&
    mintedTokensOverride == null
  )
);

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

export const resolveSbtPageMintEndDisplayState = ({
  nowMs = Date.now(),
  sbtInfo = null,
}: ResolveSbtPageMintEndDisplayStateArgs = {}): SbtPageMintEndDisplayState | null => {
  const info = isRecord(sbtInfo) ? sbtInfo : null;
  if (!info) return null;
  const unixTS = info.mintingEndTime as number | string;
  if (unixTS) {
    const endTime = Number(unixTS) * 1000;
    return {
      fullMintEndDate: new Date(endTime).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      status: endTime > Number(nowMs) ? 'active' : 'expired',
      unixTS,
    };
  }
  if (unixTS === 0) {
    return {
      fullMintEndDate: '',
      status: 'never',
      unixTS,
    };
  }
  return null;
};

export const resolveSbtPageMiniMintState = ({
  burningStatus = '',
  mintingStatus = '',
  nowSec = Math.floor(Date.now() / 1000),
  sbtAddress = '',
  sbtInfo = null,
  userHasSBT = false,
}: ResolveSbtPageMiniMintStateArgs = {}): SbtPageMiniMintState => {
  const info = isRecord(sbtInfo) ? sbtInfo : {};
  const mintingEndTime = info.mintingEndTime;
  const mintingEndTimeNumber = Number(mintingEndTime);
  const isMintingActive = mintingEndTime === 0 || mintingEndTimeNumber > Number(nowSec);
  const justJoined = mintingStatus === 'success' && burningStatus !== 'success';
  return {
    hasTokenMini: !!userHasSBT || justJoined,
    isMintingActive,
    justJoined,
    mintStatusId: `mintStatus-${String(sbtAddress || '').toLowerCase()}`,
    shouldRenderEndedIndicator: !isMintingActive,
    shouldRenderLiveIndicator: isMintingActive,
  };
};

export const resolveSbtPageMiniActionFailureState = ({
  burningStatus = '',
  hasTokenMini = false,
  mintingStatus = '',
}: ResolveSbtPageMiniActionFailureStateArgs = {}): SbtPageMiniActionFailureState => ({
  showBurnFailedStatus: burningStatus === 'failure' && !!hasTokenMini,
  showMintFailedStatus: mintingStatus === 'failure' && !hasTokenMini,
});

export const resolveSbtPageMiniMintFlowDisplayState = ({
  hasGroupPasswordMint = false,
  hasInviteMint = false,
  hasPasswordMint = false,
  hasTokenMini = false,
  isMintingActive = false,
  miniMintable = false,
  mintStep = 0,
  showMiniPasswordInput = false,
}: ResolveSbtPageMiniMintFlowDisplayStateArgs = {}): SbtPageMiniMintFlowDisplayState => {
  const canRenderMintFlow = !hasTokenMini && !!isMintingActive && !!miniMintable;
  const isGroupPasswordFlow = canRenderMintFlow && !!hasGroupPasswordMint;
  const isInviteFlow = canRenderMintFlow && !isGroupPasswordFlow && !!hasInviteMint;
  const isManualPasswordFlow = canRenderMintFlow && !isGroupPasswordFlow && !isInviteFlow && !!hasPasswordMint;
  const step = mintStep as number;
  const inputVisible = !!showMiniPasswordInput;
  return {
    shouldRenderGroupPasswordDisclosureButton: isGroupPasswordFlow && !inputVisible,
    shouldRenderGroupPasswordInput: isGroupPasswordFlow && inputVisible,
    shouldRenderInviteDisclosureButton: isInviteFlow && !inputVisible,
    shouldRenderInviteInput: isInviteFlow && inputVisible,
    shouldRenderManualClaimCountdown: isManualPasswordFlow && step === 1,
    shouldRenderManualClaimSuccess: isManualPasswordFlow && step >= 3,
    shouldRenderManualPasswordDisclosureButton: isManualPasswordFlow && step === 0 && !inputVisible,
    shouldRenderManualPasswordFinishInput: isManualPasswordFlow && step === 2,
    shouldRenderManualPasswordStartInput: isManualPasswordFlow && step === 0 && inputVisible,
    shouldRenderOpenMintButton: canRenderMintFlow && !isGroupPasswordFlow && !isInviteFlow && !isManualPasswordFlow,
  };
};

export const hasUsableSbtPageScanProgress = (progress: unknown): boolean => {
  const record = isRecord(progress) ? progress : null;
  if (!record) return false;
  const totalBlocks = Number(record.totalBlocks || 0);
  const currentBlock = Number(record.currentBlock || 0);
  const latestBlock = Number(record.latestBlock || 0);
  const remainingBlocks = Number(record.remainingBlocks);
  return (
    (Number.isFinite(totalBlocks) && totalBlocks > 0) ||
    (
      Number.isFinite(currentBlock) &&
      currentBlock >= 0 &&
      Number.isFinite(latestBlock) &&
      latestBlock > 0 &&
      latestBlock >= currentBlock
    ) ||
    (Number.isFinite(remainingBlocks) && remainingBlocks >= 0)
  );
};

export const isActiveSbtPageScanProgress = (progress: unknown): boolean => {
  if (!hasUsableSbtPageScanProgress(progress)) return false;
  const record = isRecord(progress) ? progress : {};
  const remainingBlocks = Number(record.remainingBlocks);
  if (Number.isFinite(remainingBlocks)) return remainingBlocks > 0;

  const totalBlocks = Number(record.totalBlocks || 0);
  const scannedBlocks = Number(record.scannedBlocks);
  if (
    Number.isFinite(totalBlocks) &&
    totalBlocks > 0 &&
    Number.isFinite(scannedBlocks)
  ) {
    return scannedBlocks < totalBlocks;
  }

  const currentBlock = Number(record.currentBlock || 0);
  const latestBlock = Number(record.latestBlock || 0);
  return (
    Number.isFinite(currentBlock) &&
    currentBlock >= 0 &&
    Number.isFinite(latestBlock) &&
    latestBlock > currentBlock
  );
};

export const resolveSbtPageHolderScanActive = ({
  hasActiveScanProgress = false,
  loadingMintersBurners = false,
  loadingMintedFilter = false,
  sbtScanInProgress = false,
  sbtScanPending = false,
}: ResolveSbtPageHolderScanActiveArgs = {}): boolean => Boolean(
  hasActiveScanProgress ||
  loadingMintersBurners ||
  loadingMintedFilter ||
  sbtScanInProgress ||
  sbtScanPending
);

export const formatSbtPageBlockCount = (value: unknown): string => (
  Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '-'
);

export const resolveSbtPageRemainingBlocksCount = (progress: unknown): number => {
  const record = isRecord(progress) ? progress : {};
  const remainingBlocks = Number(record.remainingBlocks);
  return Math.max(
    0,
    Number.isFinite(remainingBlocks)
      ? remainingBlocks
      : (Number(record.totalBlocks || 0) - Number(record.scannedBlocks || 0))
  );
};

const SBT_PAGE_BURN_AUTH_LABELS = ['Admin Only', 'Owner Only', 'Both', 'Neither'];
const SBT_PAGE_BURN_AUTH_INDEX_BY_NAME: Record<string, number> = {
  AdminOnly: 0,
  OwnerOnly: 1,
  Both: 2,
  Neither: 3,
};

export const resolveSbtPageBurnAuthLabel = (burnAuth: unknown): string => {
  const burnIdx = typeof burnAuth === 'string'
    ? (SBT_PAGE_BURN_AUTH_INDEX_BY_NAME[burnAuth] ?? undefined)
    : (burnAuth != null ? Number(burnAuth) : undefined);
  const normalizedBurnIdx = Number.isInteger(burnIdx) ? Number(burnIdx) : -1;
  return (normalizedBurnIdx >= 0 && normalizedBurnIdx < SBT_PAGE_BURN_AUTH_LABELS.length)
    ? SBT_PAGE_BURN_AUTH_LABELS[normalizedBurnIdx]
    : '?';
};

export const resolveSbtPageMaxTokensDisplay = (maxTokens: unknown): string => (
  maxTokens === '0'
    ? '∞'
    : (maxTokens != null ? String(maxTokens) : '-')
);

export const resolveSbtPageAdminCreatorAddresses = (sbtInfoInput: unknown): {
  adminAddress: unknown;
  creatorAddress: unknown;
} => {
  const sbtInfo = isRecord(sbtInfoInput) ? sbtInfoInput : {};
  const adminAddress = sbtInfo.admin || sbtInfo.admin_ || sbtInfo.deployer || '';
  const creatorAddress = sbtInfo.creator || adminAddress || sbtInfo.deployer || sbtInfo.admin_ || '';
  return { adminAddress, creatorAddress };
};

export const resolveSbtPageHolderLoadingState = ({
  countsLoaded = false,
  hasComputedHolders = false,
  hasFilteredHolders = false,
  isScanActive = false,
  loadingMintersBurners = false,
  loadingMintedFilter = false,
  mintedTokensOverride = null,
  netHoldersCount = 0,
  sbtScanInProgress = false,
  sbtScanPending = false,
}: ResolveSbtPageHolderLoadingStateArgs = {}): SbtPageHolderLoadingState => {
  const hasComputed = !!hasComputedHolders;
  const hasFiltered = !!hasFilteredHolders;
  const terminalEmptyHoldersState =
    !loadingMintersBurners &&
    !loadingMintedFilter &&
    !isScanActive &&
    mintedTokensOverride == null &&
    !hasComputed &&
    !hasFiltered;
  const holdersReady =
    countsLoaded === true ||
    hasComputed ||
    hasFiltered ||
    terminalEmptyHoldersState;
  const holderCount = Number(netHoldersCount || 0);
  const shouldOverrideMinted =
    mintedTokensOverride != null &&
    (!countsLoaded || holderCount === 0);
  const netMinted = shouldOverrideMinted ? String(mintedTokensOverride) : String(holderCount);
  const countsReady = countsLoaded === true || mintedTokensOverride != null || terminalEmptyHoldersState;
  const isGlobalLoading = !!sbtScanInProgress || (!!sbtScanPending && !countsReady);
  const isLocalLoading = !!loadingMintersBurners || !countsReady;
  const effectiveLoading = isLocalLoading || isGlobalLoading;
  return {
    countsReady,
    effectiveLoading,
    holdersReady,
    isGlobalLoading,
    isLocalLoading,
    netMinted,
    shouldOverrideMinted,
    terminalEmptyHoldersState,
  };
};

export const resolveSbtPageHolderResolutionState = ({
  isRefreshing = false,
  loadingMintersBurners = false,
  loadingMintedFilter = false,
  mintedAddresses = [],
  mintedTokensOverride = null,
  showScanProgress = false,
}: ResolveSbtPageHolderResolutionStateArgs = {}): SbtPageHolderResolutionState => {
  const addressesNeedResolutionHint =
    mintedTokensOverride != null &&
    Number(mintedTokensOverride) > 0 &&
    mintedAddresses.length === 0;
  const addressesAreResolving =
    addressesNeedResolutionHint &&
    (
      !!loadingMintersBurners ||
      !!loadingMintedFilter ||
      !!isRefreshing ||
      !!showScanProgress
  );
  return { addressesAreResolving, addressesNeedResolutionHint };
};

export const resolveSbtPageHoldersDisplayCount = ({
  mintedTokensOverride = null,
  netHoldersCount = 0,
  shouldOverrideMinted = false,
}: ResolveSbtPageHoldersDisplayCountArgs = {}): string => (
  shouldOverrideMinted
    ? `~${mintedTokensOverride}`
    : String(netHoldersCount || 0)
);

export const shouldShowSbtPageScanProgress = ({
  effectiveLoading = false,
  hasActiveScanProgress = false,
  rawRemainingBlocksCount = 0,
}: ShouldShowSbtPageScanProgressArgs = {}): boolean => (
  !!hasActiveScanProgress && (!!effectiveLoading || Number(rawRemainingBlocksCount) > 0)
);

export const resolveSbtPageMiniBurnPermission = ({
  account = '',
  sbtInfo = null,
  userIsSbtAdmin = false,
}: ResolveSbtPageMiniBurnPermissionArgs = {}): SbtPageMiniBurnPermission => {
  const info = isRecord(sbtInfo) ? sbtInfo : {};
  const userAddressLower = account ? String(account).toLowerCase() : null;
  const adminAddr = info.admin || info.admin_;
  const adminAddrLower = adminAddr ? String(adminAddr).toLowerCase() : '';
  const burnAuth = info.burnAuth;
  const canOwnerBurn = (
    burnAuth === 1 ||
    burnAuth === 2 ||
    (burnAuth === 0 && !!adminAddr && adminAddrLower === userAddressLower)
  );
  const canAdminBurn = !!userIsSbtAdmin && (burnAuth === 0 || burnAuth === 2);
  return {
    canAdminBurn,
    canBurnMini: canOwnerBurn || canAdminBurn,
    canOwnerBurn,
  };
};

export const resolveSbtPageBurnButtonState = ({
  account = '',
  sbtInfo = null,
  userHasSBT = false,
}: ResolveSbtPageBurnButtonStateArgs = {}): SbtPageBurnButtonState => {
  const info = isRecord(sbtInfo) ? sbtInfo : {};
  const userAddressLower = account ? String(account).toLowerCase() : null;
  const adminAddr = String(info.admin || info.admin_ || '');
  const canOwnerBurn = !!userHasSBT && (
    info.burnAuth === 1 ||
    info.burnAuth === 2 ||
    (info.burnAuth === 0 && !!adminAddr && adminAddr.toLowerCase() === userAddressLower) ||
    (info.burnAuth === 1 && !!userHasSBT)
  );
  return {
    canOwnerBurn,
    shouldRenderBurnButton: !!userHasSBT && canOwnerBurn,
  };
};

export const resolveSbtPageBurnStatusButtonState = ({
  burningStatus = '',
}: ResolveSbtPageBurnStatusButtonStateArgs = {}): SbtPageBurnStatusButtonState => ({
  disabled: burningStatus !== 'idle' && burningStatus !== 'success' && burningStatus !== 'failure',
  isFailure: burningStatus === 'failure',
  isIdle: burningStatus === 'idle',
  isPending: burningStatus === 'pending',
  isSuccess: burningStatus === 'success',
});

export const resolveSbtPageAdminBurnButtonState = ({
  burningStatus = '',
  burnSearchResult = null,
}: ResolveSbtPageAdminBurnButtonStateArgs = {}): SbtPageBurnStatusButtonState => {
  const statusButtonState = resolveSbtPageBurnStatusButtonState({ burningStatus });
  return {
    ...statusButtonState,
    disabled: statusButtonState.disabled || !burnSearchResult,
  };
};

export const resolveSbtPageOpenMintButtonState = ({
  burningStatus = '',
  lastMintTxHash = '',
  mintLowerLabel = 'mint',
  mintingStatus = '',
}: ResolveSbtPageOpenMintButtonStateArgs = {}): SbtPageOpenMintButtonState => {
  const isMinted = mintingStatus === 'success' && burningStatus !== 'success';
  const canOpenMintTx = !!(isMinted && lastMintTxHash);
  const isPending = mintingStatus === 'pending';
  return {
    canOpenMintTx,
    disabled: isPending || (isMinted && !canOpenMintTx),
    isFailure: mintingStatus === 'failure',
    isIdle: mintingStatus === 'idle',
    isMinted,
    isPending,
    title: canOpenMintTx ? `View ${String(mintLowerLabel || 'mint')} transaction` : undefined,
  };
};

export const resolveSbtPagePasswordJoinButtonState = ({
  groupPasswordInput = '',
  mintingStatus = '',
}: ResolveSbtPagePasswordJoinButtonStateArgs = {}): SbtPagePasswordJoinButtonState => {
  const isPending = mintingStatus === 'pending';
  return {
    disabled: isPending || String(groupPasswordInput || '').trim() === '',
    isPending,
  };
};

export const resolveSbtPagePendingButtonContentState = ({
  isPending = false,
  label = '',
}: ResolveSbtPagePendingButtonContentStateArgs = {}): SbtPagePendingButtonContentState => {
  const pending = !!isPending;
  return {
    label: String(label || ''),
    shouldRenderLabel: !pending,
    shouldRenderPendingIcon: pending,
  };
};

export const resolveSbtPageStatusButtonContentState = ({
  failureLabel = 'Failed',
  idleLabel = '',
  isFailure = false,
  isIdle = false,
  isPending = false,
  isSuccess = false,
  successLabel = '',
}: ResolveSbtPageStatusButtonContentStateArgs = {}): SbtPageStatusButtonContentState => ({
  failureLabel: String(failureLabel || ''),
  idleLabel: String(idleLabel || ''),
  shouldRenderFailure: !!isFailure,
  shouldRenderIdleLabel: !!isIdle,
  shouldRenderPendingIcon: !!isPending,
  shouldRenderSuccess: !!isSuccess,
  successLabel: String(successLabel || ''),
});

export const resolveSbtPagePasswordGenerationButtonState = ({
  passwordGenerationCount = null,
}: ResolveSbtPagePasswordGenerationButtonStateArgs = {}): SbtPagePasswordGenerationButtonState => ({
  disabled: !passwordGenerationCount || (passwordGenerationCount as number) <= 0,
});

export const resolveSbtPagePasswordAlertState = ({
  mintPassword = '',
  sbtMintPassword = '',
  showPasswordAlert = false,
}: ResolveSbtPagePasswordAlertStateArgs = {}): SbtPagePasswordAlertState => ({
  showDetectedPasswordAlert: !!(showPasswordAlert && (mintPassword || sbtMintPassword)),
});

export const resolveSbtPageActionFeedbackState = ({
  burningStatus = '',
  error = null,
  lastBurnTxHash = '',
  lastMintTxHash = '',
  mintingStatus = '',
  transactionHash = '',
}: ResolveSbtPageActionFeedbackStateArgs = {}): SbtPageActionFeedbackState => {
  const showTransactionError = !!error && (mintingStatus === 'failure' || burningStatus === 'failure');
  return {
    showBurnSuccess: burningStatus === 'success' && !!lastBurnTxHash,
    showErrorTransactionHash: showTransactionError && !!transactionHash,
    showMintSuccess: mintingStatus === 'success' && !!lastMintTxHash && burningStatus !== 'success',
    showTransactionError,
  };
};

export const resolveSbtPageManualClaimButtonState = ({
  manualPasswordInput = '',
  mintingStatus = '',
}: ResolveSbtPageManualClaimButtonStateArgs = {}): SbtPageManualClaimButtonState => {
  const isPending = mintingStatus === 'pending';
  return {
    disabled: isPending || String(manualPasswordInput || '').trim() === '',
    isPending,
  };
};

export const resolveSbtPageMiniOpenMintButtonState = ({
  mintingStatus = '',
}: ResolveSbtPageMiniOpenMintButtonStateArgs = {}): SbtPageMiniOpenMintButtonState => {
  const isPending = mintingStatus === 'pending';
  return {
    disabled: isPending,
    isFailure: mintingStatus === 'failure',
    isIdle: mintingStatus === 'idle',
    isPending,
    isSuccess: mintingStatus === 'success',
  };
};

export const resolveSbtPageMiniActionStatusDisplayState = ({
  isFailure = false,
}: ResolveSbtPageMiniActionStatusDisplayStateArgs = {}): SbtPageMiniActionStatusDisplayState => ({
  style: {
    marginTop: '10px',
    ...(isFailure ? { color: 'red' } : {}),
  },
});

export const buildSbtPageActionButtonClassName = ({
  actionClassName = '',
  includeMiniClass = false,
  miniClassName = '',
  variantClassName = '',
}: BuildSbtPageActionButtonClassNameArgs = {}): string => ([
  String(actionClassName || ''),
  String(variantClassName || ''),
  includeMiniClass ? String(miniClassName || '') : '',
].filter(Boolean).join(' '));

export const resolveSbtPageMiniControlDisplayState = ({
  inputMaxWidth = '',
}: ResolveSbtPageMiniControlDisplayStateArgs = {}): SbtPageMiniControlDisplayState => {
  const maxWidth = String(inputMaxWidth || '').trim();
  return {
    inputStyle: maxWidth ? { maxWidth } : {},
    topMarginStyle: { marginTop: '10px' },
  };
};

export const resolveSbtPageMiniBurnButtonState = ({
  burningStatus = '',
}: ResolveSbtPageMiniBurnButtonStateArgs = {}): SbtPageMiniBurnButtonState => {
  const isPending = burningStatus === 'pending';
  return {
    disabled: isPending,
    isPending,
  };
};

export const resolveSbtPageMiniTokenActionDisplayState = ({
  burningStatus = '',
  canBurnMini = false,
}: ResolveSbtPageMiniTokenActionDisplayStateArgs = {}): SbtPageMiniTokenActionDisplayState => {
  const shouldRenderBurnedStatus = burningStatus === 'success';
  const shouldRenderBurnButton = !shouldRenderBurnedStatus && !!canBurnMini;
  return {
    shouldRenderBurnButton,
    shouldRenderBurnedStatus,
    shouldRenderJoinedStatus: !shouldRenderBurnedStatus && !shouldRenderBurnButton,
  };
};

export const shouldRenderSbtPageMintButton = ({
  burningStatus = '',
  nowSeconds = 0,
  sbtInfo = null,
  userHasSBT = false,
}: ShouldRenderSbtPageMintButtonArgs = {}): boolean => {
  if (userHasSBT && burningStatus !== 'success') return false;
  if (!sbtInfo) return false;

  const mintingEndTime = (sbtInfo as { mintingEndTime?: unknown })?.mintingEndTime;
  if (mintingEndTime !== 0 && Number(mintingEndTime) < Number(nowSeconds || 0)) return false;
  return true;
};

export const resolveSbtPageAdminActionState = ({
  account = '',
  hasInviteMint = false,
  sbtInfo = null,
}: ResolveSbtPageAdminActionStateArgs = {}): SbtPageAdminActionState => {
  const info = isRecord(sbtInfo) ? sbtInfo : {};
  const adminAddr = String(info.admin || info.admin_ || '');
  const hasPasswordMint = !!info.hasPasswordMint;
  const showPasswordGen = hasPasswordMint && info.maxTokens === '0';
  const showNoMoreInvites = hasPasswordMint && info.maxTokens !== '0';
  return {
    canAdminBurn: (
      (info.burnAuth === 0 || info.burnAuth === 2) &&
      adminAddr.toLowerCase() === String(account || '').toLowerCase()
    ),
    hasPasswordMint,
    isInvite: !!hasInviteMint,
    showNoMoreInvites,
    showPasswordGen,
  };
};

export const resolveSbtPageMintFlowDisplayState = ({
  hasGroupPasswordMint = false,
  hasInviteMint = false,
  mintingStatus = '',
  mintStep = 0,
  sbtInfo = null,
}: ResolveSbtPageMintFlowDisplayStateArgs = {}): SbtPageMintFlowDisplayState => {
  const hasSuccessfulMint = mintingStatus === 'success';
  const isGroupPasswordFlow = !!hasGroupPasswordMint;
  const isInviteFlow = !isGroupPasswordFlow && !!hasInviteMint;
  const info = isRecord(sbtInfo) ? sbtInfo : {};
  const hasPasswordMint = !!info.hasPasswordMint;
  const shouldRenderOpenMintButton = !isGroupPasswordFlow && !isInviteFlow && !hasPasswordMint;
  const shouldRenderManualClaimFlow = !isGroupPasswordFlow && !isInviteFlow && hasPasswordMint;
  const step = Number(mintStep || 0);
  return {
    shouldRenderClaimCountdown: shouldRenderManualClaimFlow && step === 1,
    shouldRenderClaimSuccess: shouldRenderManualClaimFlow && step === 3,
    shouldRenderGroupPasswordJoin: isGroupPasswordFlow && !hasSuccessfulMint,
    shouldRenderInviteJoin: isInviteFlow && !hasSuccessfulMint,
    shouldRenderManualClaimFinish: shouldRenderManualClaimFlow && step === 2,
    shouldRenderManualClaimStart: shouldRenderManualClaimFlow && step === 0,
    shouldRenderOpenMintButton,
    shouldSuppressMintControls: (isGroupPasswordFlow || isInviteFlow) && hasSuccessfulMint,
  };
};

export const resolveSbtPageRelevantInfoLists = ({
  sbtInfo = null,
}: ResolveSbtPageRelevantInfoListsArgs = {}): SbtPageRelevantInfoLists => {
  const info = isRecord(sbtInfo) ? sbtInfo : {};
  return {
    documentIDHashes: toStringList(info.documentIDHashes),
    documentURLs: toStringList(info.documentURLs),
    tags: toStringList(info.tags),
  };
};

export const resolveSbtPageRelevantInfoDisplayState = ({
  documentIDHashes = [],
  documentURLs = [],
  tags = [],
}: ResolveSbtPageRelevantInfoDisplayStateArgs = {}): SbtPageRelevantInfoDisplayState => ({
  shouldRenderDocumentIdHashes: Array.isArray(documentIDHashes) && documentIDHashes.length > 0,
  shouldRenderDocumentUrls: Array.isArray(documentURLs) && documentURLs.length > 0,
  shouldRenderTags: Array.isArray(tags) && tags.length > 0,
});

export const resolveSbtPageScanProgressPercent = ({
  progress = null,
  showScanProgress = false,
}: ResolveSbtPageScanProgressPercentArgs = {}): number => {
  if (!showScanProgress) return 0;
  const record = isRecord(progress) ? progress : {};
  return (
    Number.isFinite(Number(record.totalBlocks)) &&
    Number(record.totalBlocks) > 0 &&
    Number.isFinite(Number(record.scannedBlocks))
      ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (Number(record.scannedBlocks || 0) / Number(record.totalBlocks || 1)) * 100
          )
        )
      )
      : 0
  );
};

export const resolveSbtPageScanProgressFillStyle = ({
  percent = 0,
}: ResolveSbtPageScanProgressFillStyleArgs = {}): Record<string, string> => ({
  width: `${Number(percent || 0) || 0}%`,
});

export const resolveSbtPageScanProgressDisplay = ({
  phaseLabel = 'Scanning mint/burn history',
  rawRemainingBlocksCount = 0,
  sessionLabel = '',
  showScanProgress = false,
}: ResolveSbtPageScanProgressDisplayArgs = {}): SbtPageScanProgressDisplay => {
  if (!showScanProgress) {
    return {
      remainingBlocksCount: 0,
      scanProgressSessionText: null,
      scanProgressText: null,
    };
  }
  const remainingBlocksCount = rawRemainingBlocksCount == null
    ? 0
    : Number(rawRemainingBlocksCount);
  return {
    remainingBlocksCount,
    scanProgressSessionText: `Session: ${String(sessionLabel || '').trim()}`,
    scanProgressText: `${String(phaseLabel || '')}: ${formatSbtPageBlockCount(remainingBlocksCount)} blocks remaining`,
  };
};

export const resolveSbtPageHolderFilterItems = ({
  filteredMintedUsers: filteredMintedUsersRaw = [],
  hasComputedHolders = false,
  hasFilteredHolders = false,
  isScanActive = false,
  netHolders = [],
}: ResolveSbtPageHolderFilterItemsArgs = {}): SbtPageHolderFilterItems => {
  const keepStaleFilterRowsWhileRefreshing =
    !!hasFilteredHolders &&
    !hasComputedHolders &&
    !!isScanActive;
  const holderItemsForFilter = hasComputedHolders
    ? netHolders
    : (keepStaleFilterRowsWhileRefreshing ? filteredMintedUsersRaw : []);
  const filteredMintedUsers = Array.isArray(filteredMintedUsersRaw)
    ? filteredMintedUsersRaw
    : [];
  return {
    filteredMintedUsers,
    holderItemsForFilter,
    keepStaleFilterRowsWhileRefreshing,
  };
};

const SBT_PAGE_MINTED_COUNT_ESTIMATE_TITLE = 'Holder list not loaded yet; showing an on-chain holder count estimate.';

export const resolveSbtPageHolderModalDisplayState = ({
  addressesAreResolving = false,
  hasActiveScanProgress = false,
  hasComputedHolders = false,
  hasFilteredHolders = false,
  holdersReady = false,
  isInitialLoading = false,
  isRefreshing = false,
  isScanActive = false,
  loadingMintersBurners = false,
  loadingMintedFilter = false,
  shouldOverrideMinted = false,
  showModal = false,
  showScanProgress = false,
}: ResolveSbtPageHolderModalDisplayStateArgs = {}): SbtPageHolderModalDisplayState => {
  const showEmptyStateInModal =
    !hasFilteredHolders &&
    !hasComputedHolders &&
    !isInitialLoading &&
    !loadingMintedFilter &&
    !addressesAreResolving &&
    !!holdersReady &&
    !shouldOverrideMinted;
  const waitingForHolderDetails =
    !!addressesAreResolving ||
    (
      !!shouldOverrideMinted &&
      !hasFilteredHolders &&
      !hasComputedHolders &&
      (
        !!loadingMintersBurners ||
        !!loadingMintedFilter ||
        !!isRefreshing ||
        !!showScanProgress
      )
    );
  const showApproximateCountHint =
    !hasFilteredHolders &&
    !hasComputedHolders &&
    !showEmptyStateInModal &&
    !addressesAreResolving &&
    !isScanActive &&
    !!shouldOverrideMinted;
  const showSpinnerInModalBody =
    !hasFilteredHolders &&
    !hasComputedHolders &&
    !showEmptyStateInModal &&
    (waitingForHolderDetails || !holdersReady || !!isInitialLoading || !!loadingMintedFilter);
  const showScanProgressInModal =
    !!showModal &&
    !!hasActiveScanProgress &&
    (
      !!showScanProgress ||
      showSpinnerInModalBody ||
      !!loadingMintedFilter ||
      !!hasActiveScanProgress
    );
  const showCornerSpinner =
    (
      !!hasActiveScanProgress ||
      !!loadingMintedFilter ||
      (!!loadingMintersBurners && (!!holdersReady || !!hasFilteredHolders)) ||
      (!!isRefreshing && !!hasActiveScanProgress)
    ) &&
    (!!holdersReady || !!hasFilteredHolders);
  const showHeaderCount = !!holdersReady || !!shouldOverrideMinted;
  return {
    mintedCountTitle: shouldOverrideMinted ? SBT_PAGE_MINTED_COUNT_ESTIMATE_TITLE : undefined,
    showApproximateCountHint,
    showCornerSpinner,
    showEmptyStateInModal,
    showHeaderCount,
    showScanProgressInModal,
    showSpinnerInModalBody,
    waitingForHolderDetails,
  };
};

export const buildSbtPageParentSessionScanProgress = ({
  progress: progressRaw = null,
  sessionConfig = null,
  sessionLabel = '',
  sessionSlug = '',
}: BuildSbtPageParentSessionScanProgressArgs = {}): SbtPageScanProgressRecord | null => {
  const progress = isRecord(progressRaw) ? progressRaw : null;
  if (!progress) return null;

  const currentBlock = Math.max(0, Math.floor(Number(progress?.currentBlock || 0)));
  const latestBlock = Math.max(currentBlock, Math.floor(Number(progress?.latestBlock || 0)));
  if (!Number.isFinite(currentBlock) || !Number.isFinite(latestBlock) || latestBlock <= 0) {
    return null;
  }

  const blockLimits = isRecord(sessionConfig?.blockLimits) ? sessionConfig.blockLimits : {};
  const startCandidate = Math.floor(Number(blockLimits.start || 0));
  const hasStartBlock = Number.isFinite(startCandidate) && startCandidate > 0;
  const startBlock = hasStartBlock ? Math.min(startCandidate, latestBlock) : 0;
  const totalBlocks = hasStartBlock
    ? Math.max(1, latestBlock - startBlock + 1)
    : null;
  const scannedBlocks = totalBlocks != null
    ? Math.max(0, Math.min(totalBlocks, currentBlock - startBlock + 1))
    : null;

  return {
    ...progress,
    source: 'session',
    phase: progress.phase || 'activity',
    currentBlock,
    latestBlock,
    fromBlock: hasStartBlock ? startBlock : undefined,
    toBlock: latestBlock,
    totalBlocks: totalBlocks != null ? totalBlocks : undefined,
    scannedBlocks: scannedBlocks != null ? scannedBlocks : undefined,
    remainingBlocks: Math.max(0, latestBlock - currentBlock),
    sessionSlug,
    sessionLabel,
  };
};

export const buildSbtPageEffectiveHolderScanProgress = ({
  getParentProgress = null,
  getSessionLabel = null,
  getSessionSlug = null,
  localProgress: localProgressRaw = null,
}: BuildSbtPageEffectiveHolderScanProgressArgs = {}): SbtPageScanProgressRecord | null => {
  const localProgress = isRecord(localProgressRaw) ? localProgressRaw : null;
  if (hasUsableSbtPageScanProgress(localProgress)) {
    return {
      sessionSlug: getSessionSlug ? getSessionSlug() : '',
      sessionLabel: getSessionLabel ? getSessionLabel() : '',
      ...localProgress,
    };
  }
  const parentProgress = getParentProgress ? getParentProgress() : null;
  if (hasUsableSbtPageScanProgress(parentProgress)) {
    return parentProgress as SbtPageScanProgressRecord;
  }
  return null;
};

export const readSbtPageQueuedOrStoredLocalStorageJson = <T extends Record<string, unknown>>({
  fallback,
  key = '',
  queuedWrites = null,
  storageRef = null,
}: ReadSbtPageQueuedOrStoredLocalStorageJsonArgs<T>): T => {
  if (!storageRef) return fallback;
  const storageKey = String(key || '');
  if (!storageKey) return fallback;
  try {
    const pendingRaw = queuedWrites?.get ? queuedWrites.get(storageKey) : undefined;
    const raw = (typeof pendingRaw === 'string' ? pendingRaw : storageRef.getItem?.(storageKey)) || '';
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed as T : fallback;
  } catch (_) {
    return fallback;
  }
};

export const serializeSbtPageLocalStorageJsonWrite = ({
  key = '',
  value = undefined,
}: SerializeSbtPageLocalStorageJsonWriteArgs = {}): SbtPageSerializedLocalStorageJsonWrite | null => {
  const storageKey = String(key || '');
  if (!storageKey) return null;
  try {
    const nextJson = JSON.stringify(value);
    if (typeof nextJson !== 'string') return null;
    return { storageKey, nextJson };
  } catch (_) {
    return null;
  }
};

export const resolveSbtPageLocalStorageJsonWriteDecision = ({
  cachedJson = '',
  currentRaw = '',
  nextJson = '',
}: ResolveSbtPageLocalStorageJsonWriteDecisionArgs = {}): SbtPageLocalStorageJsonWriteDecision => {
  const next = typeof nextJson === 'string' ? nextJson : '';
  if (cachedJson === next) return 'skip';
  if (currentRaw === next) return 'adopt';
  return 'write';
};

export const appendSbtPageTransactionHash = ({
  cacheObj = {},
  txHash,
  userAddress = '',
}: AppendSbtPageTransactionHashArgs): AppendSbtPageTransactionHashResult => {
  const txCache = isRecord(cacheObj) ? cacheObj : {};
  const userAddressLower = String(userAddress || '').toLowerCase();
  if (!userAddressLower) return { shouldWrite: false, txCache };

  if (!txCache[userAddressLower]) txCache[userAddressLower] = [];
  (txCache[userAddressLower] as string[]).push(txHash);
  return { shouldWrite: true, txCache };
};

export const appendSbtPageBookmark = ({
  bookmarksObj = {},
  sbtAddress = '',
}: AppendSbtPageBookmarkArgs = {}): AppendSbtPageBookmarkResult => {
  const bookmarks = isRecord(bookmarksObj) ? bookmarksObj : {};
  const address = String(sbtAddress || '');
  if (!address) return { bookmarks, shouldWrite: false };

  if (!bookmarks.sbts) bookmarks.sbts = [];
  const sbts = bookmarks.sbts as string[];
  if (!sbts.includes(address)) {
    sbts.push(address);
    return { bookmarks, shouldWrite: true };
  }
  return { bookmarks, shouldWrite: false };
};

export const resolveSbtPagePasswordExportSelection = ({
  adminGeneratedPasswords = [],
  cachedPasswords = [],
  includePreviousPasswords = false,
}: ResolveSbtPagePasswordExportSelectionArgs = {}): SbtPagePasswordExportSelection => {
  const cachedPasswordList = toStringList(cachedPasswords);
  const adminGeneratedPasswordList = toStringList(adminGeneratedPasswords);
  const combinedPasswords = [...cachedPasswordList, ...adminGeneratedPasswordList];
  const onlyCachedPasswords = adminGeneratedPasswordList.length === 0 && combinedPasswords.length > 0;
  const effectiveIncludePreviousPasswords = onlyCachedPasswords ? true : includePreviousPasswords;
  let passwordsToExport: string[];
  if (adminGeneratedPasswordList.length > 0) {
    passwordsToExport = effectiveIncludePreviousPasswords ? combinedPasswords : adminGeneratedPasswordList;
  } else {
    passwordsToExport = combinedPasswords;
  }

  return {
    adminGeneratedPasswordList,
    cachedPasswordList,
    combinedPasswords,
    effectiveIncludePreviousPasswords,
    onlyCachedPasswords,
    passwordsToExport,
  };
};

export const resolveSbtPagePasswordExportControlsState = ({
  adminGeneratedPasswordList = [],
  effectiveIncludePreviousPasswords = false,
  onlyCachedPasswords = false,
}: ResolveSbtPagePasswordExportControlsStateArgs = {}): SbtPagePasswordExportControlsState => {
  const generatedCount = Number((adminGeneratedPasswordList as { length?: unknown })?.length || 0);
  const renderIncludePreviousCheckbox = generatedCount > 0;
  return {
    effectiveIncludePreviousPasswordsChecked: !!effectiveIncludePreviousPasswords,
    renderIncludePreviousCheckbox,
    showCachedPasswordsIncludedNote: !renderIncludePreviousCheckbox && !!onlyCachedPasswords,
  };
};

export const resolveSbtPagePasswordInventoryDisplayState = ({
  combinedPasswords = [],
  showNoMoreInvites = false,
  showPasswordGen = false,
}: ResolveSbtPagePasswordInventoryDisplayStateArgs = {}): SbtPagePasswordInventoryDisplayState => {
  const passwordCount = Number((combinedPasswords as { length?: unknown })?.length || 0);
  const hasPasswords = passwordCount > 0;
  return {
    shouldRenderGeneratedPasswordList: !!showPasswordGen && hasPasswords,
    shouldRenderNoMoreInvitesEmptyState: !!showNoMoreInvites && !hasPasswords,
    shouldRenderPasswordGenerationSection: !!showPasswordGen,
    shouldRenderPreviousPasswordsSection: !!showNoMoreInvites && hasPasswords,
  };
};

export const generateSbtPageRandomPasswords = ({
  count = 0,
  getRandomValues = null,
  randomBytes = ethers.utils.randomBytes,
}: GenerateSbtPageRandomPasswordsArgs = {}): string[] => {
  const targetCount = Number(count || 0);
  if (!Number.isFinite(targetCount) || targetCount <= 0) return [];
  const generated = new Set<string>();
  while (generated.size < targetCount) {
    let arr: Uint8Array | number[];
    if (typeof getRandomValues === 'function') {
      const next = new Uint8Array(16);
      arr = getRandomValues(next);
    } else if (typeof randomBytes === 'function') {
      arr = randomBytes(16);
    } else {
      arr = ethers.utils.randomBytes(16);
    }
    const token = Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
    generated.add(token);
  }
  return Array.from(generated);
};

export const encodeSbtPageGroupPasswordForUrl = (
  code: unknown,
  codec: SbtPageGroupPasswordCodec | null | undefined = null
): string => {
  const normalized = typeof codec?.normalizeGroupPasswordInput === 'function'
    ? codec.normalizeGroupPasswordInput(code)
    : String(code ?? '');
  const encoded = typeof codec?.encodeGroupPasswordForUrl === 'function'
    ? codec.encodeGroupPasswordForUrl(normalized)
    : normalized;
  return String(encoded || '');
};

export const buildSbtPagePasswordInviteLink = ({
  baseUrl = '',
  code = '',
  demoPath = '',
  encodeGroupPassword = null,
  isInvite = false,
  sbtAddr = '',
  sbtBasePathValue = '',
}: BuildSbtPagePasswordInviteLinkArgs = {}): string => {
  const origin = String(baseUrl || '');
  const routePath = String(demoPath || '');
  const address = String(sbtAddr || '');
  const codeText = String(code ?? '');
  if (isInvite) {
    const encodePassword = typeof encodeGroupPassword === 'function'
      ? encodeGroupPassword
      : (password: string) => password;
    return `${origin}${routePath}?auto=1&sbt=${encodeURIComponent(address)}&gp=${encodeURIComponent(encodePassword(codeText))}`;
  }
  return `${origin}${String(sbtBasePathValue || '')}/${address}/${codeText}`;
};

export const buildSbtPagePasswordExportRows = ({
  baseUrl = '',
  codeLabel = 'password',
  demoPath = '',
  encodeGroupPassword = null,
  isInvite = false,
  passwordsToExport = [],
  sbtAddr = '',
  sbtBasePathValue = '',
}: BuildSbtPagePasswordExportRowsArgs = {}): SbtPagePasswordExportRow[] => {
  const label = String(codeLabel || 'password');
  return toStringList(passwordsToExport).map((code) => ({
    [label]: code,
    inviteLink: buildSbtPagePasswordInviteLink({
      baseUrl,
      code,
      demoPath,
      encodeGroupPassword,
      isInvite,
      sbtAddr,
      sbtBasePathValue,
    }),
  }));
};

export const buildSbtPagePasswordExportFile = ({
  codeLabel = 'password',
  date = '',
  fileLabel = 'passwords',
  format = null,
  rows = [],
  sbtSymbolOrName = 'SBT',
}: BuildSbtPagePasswordExportFileArgs = {}): SbtPagePasswordExportFile | null => {
  const passwordExportFormat: SbtPagePasswordExportFormat | null = format === 'json' || format === 'csv'
    ? format
    : null;
  if (!passwordExportFormat) return null;

  const exportRows = Array.isArray(rows) ? rows as SbtPagePasswordExportRow[] : [];
  const label = String(codeLabel || 'password');
  const fileNameBase = String(sbtSymbolOrName || 'SBT');
  const fileSuffix = String(fileLabel || 'passwords');
  const datePart = String(date || '');

  if (passwordExportFormat === 'json') {
    return {
      content: JSON.stringify(exportRows, null, 2),
      fileName: `${fileNameBase}_${fileSuffix}_${datePart}.json`,
      mimeType: 'application/json',
    };
  }

  return {
    content: `index,${label},inviteLink\n` +
      exportRows.map((item, index) => `${index},${item[label]},${item.inviteLink}`).join('\n'),
    fileName: `${fileNameBase}_${fileSuffix}_${datePart}.csv`,
    mimeType: 'text/csv',
  };
};

export const decodeSbtPageJsonDataUri = (uriRaw: unknown): Record<string, unknown> | null => {
  const raw = String(uriRaw || '').trim();
  if (!/^data:application\/json/i.test(raw)) return null;
  const commaIndex = raw.indexOf(',');
  if (commaIndex < 0) return null;
  const header = raw.slice(0, commaIndex).toLowerCase();
  const payload = raw.slice(commaIndex + 1);
  if (!payload) return null;
  let text = '';
  try {
    if (header.includes(';base64')) {
      if (typeof Buffer !== 'undefined') {
        text = Buffer.from(payload, 'base64').toString('utf8');
      } else if (typeof window !== 'undefined' && typeof window.atob === 'function') {
        text = decodeURIComponent(escape(window.atob(payload)));
      }
    } else {
      text = decodeURIComponent(payload);
    }
  } catch (_) {
    return null;
  }
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
};

export const isSbtPageImageLikeUri = (uriRaw: unknown): boolean => {
  const raw = String(uriRaw || '').trim();
  if (!raw) return false;
  if (/^data:image\//i.test(raw)) return true;
  try {
    const parsed = new URL(raw);
    const path = String(parsed.pathname || '').toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|tiff?)$/i.test(path)) return true;
    const extHint = String(
      parsed.searchParams.get('ext') ||
      parsed.searchParams.get('format') ||
      ''
    ).toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico', 'tif', 'tiff'].includes(extHint)) {
      return true;
    }
  } catch (_) {
    return false;
  }
  return false;
};

export const getDisplayImageUrlCandidates = (
  sbtInfo: SbtPageInfoImageLike | null | undefined
): string[] => {
  const imageValue = sbtInfo?.image;
  return buildArweaveGatewayUrlCandidates(imageValue, { gateway: '' });
};

export const resolveDisplayImageHref = (
  sbtInfo: SbtPageInfoImageLike | null | undefined,
  defaultImage: unknown = ''
): string => {
  const candidates = getDisplayImageUrlCandidates(sbtInfo);
  const candidate = candidates[0] || '';
  return candidate || String(defaultImage || '');
};

export const getDisplayImageRenderState = (
  sbtInfo: SbtPageInfoImageLike | null | undefined,
  fallbackState: SbtPageDisplayImageFallbackState = {},
  defaultImage: unknown = ''
): SbtPageDisplayImageState => {
  const sourceKey = String(sbtInfo?.image || '').trim();
  const candidates = getDisplayImageUrlCandidates(sbtInfo);
  const activeIndex = fallbackState.displayImageFallbackKey === sourceKey
    ? Math.max(0, Number(fallbackState.displayImageFallbackIndex || 0))
    : 0;
  const fallbackImage = String(defaultImage || '');
  const src = candidates[activeIndex] || fallbackImage;
  return {
    sourceKey,
    candidates,
    activeIndex,
    src,
    canRetry: activeIndex < candidates.length,
  };
};

export const getDisplayImageFallbackCandidateCount = (candidates: unknown): number => (
  Array.isArray(candidates) ? candidates.length : 0
);

export const getNextDisplayImageFallbackState = (
  {
    activeIndex = 0,
    maxIndex = 0,
    sourceKey = '',
  }: SbtPageDisplayImageNextFallbackArgs = {},
  prevState: SbtPageDisplayImageFallbackState = {}
): SbtPageDisplayImageFallbackState | null => {
  const currentIndex = prevState.displayImageFallbackKey === sourceKey
    ? Math.max(0, Number(prevState.displayImageFallbackIndex || 0))
    : 0;
  if (currentIndex !== activeIndex) return null;
  return {
    displayImageFallbackKey: sourceKey,
    displayImageFallbackIndex: Math.min(activeIndex + 1, maxIndex),
  };
};

export const resolveSbtPageFullViewShellState = ({
  error = '',
  hasSbtAddress = false,
  sbtInfo = null,
}: ResolveSbtPageFullViewShellStateArgs = {}): SbtPageFullViewShellState => {
  const hasInfo = !!sbtInfo;
  const hasError = !!error;
  const hasAddress = !!hasSbtAddress;
  return {
    shouldRenderContent: hasAddress && hasInfo,
    shouldRenderError: hasAddress && hasError && !hasInfo,
    shouldRenderLoading: hasAddress && !hasInfo && !hasError,
    shouldRenderMissingAddress: !hasAddress,
  };
};

export const resolveSbtPageSectionToggleDisplayState = ({
  open = false,
}: ResolveSbtPageSectionToggleDisplayStateArgs = {}): SbtPageSectionToggleDisplayState => {
  const isOpen = !!open;
  return {
    isOpen,
    shouldRenderClosedIcon: !isOpen,
    shouldRenderOpenIcon: isOpen,
  };
};

export const buildSbtPageSectionHeaderClassName = ({
  baseClassName = '',
  roundedClassName = '',
}: BuildSbtPageSectionHeaderClassNameArgs = {}): string => ([
  String(baseClassName || ''),
  String(roundedClassName || ''),
].filter(Boolean).join(' '));

export const resolveSbtPageBookmarkButtonDisplayState = ({
  bookmarked = false,
}: ResolveSbtPageBookmarkButtonDisplayStateArgs = {}): SbtPageBookmarkButtonDisplayState => ({
  iconStyle: { color: bookmarked ? '#FFD700' : undefined },
});

export const resolveSbtPageInteractiveCursorStyle = (): Record<string, string> => ({
  cursor: 'pointer',
});

export const resolveSbtPageQuestionIconStyle = (): Record<string, string | number> => ({
  marginLeft: '5px',
  color: '#00ff9d',
  cursor: 'pointer',
  opacity: 0.5,
});

export const resolveSbtPageItalicNoteStyle = (): Record<string, string> => ({
  fontStyle: 'italic',
});

export const resolveSbtPageCopyErrorButtonStyle = (): Record<string, string> => ({
  background: 'transparent',
  border: 'none',
  marginLeft: '8px',
  cursor: 'pointer',
});

export const resolveSbtPageMutedInfoIconStyle = (): Record<string, number> => ({
  opacity: 0.5,
});

export const resolveSbtPageInlineLockIconStyle = (): Record<string, string> => ({
  marginRight: '6px',
});

export const resolveSbtPageRefreshIndicatorStyle = (): Record<string, string | number> => ({
  marginLeft: '10px',
  fontSize: '0.8em',
  opacity: 0.7,
});

export const resolveSbtPageCopyIconState = ({
  copied = undefined,
  copiedAddress = '',
  targetKey = '',
}: ResolveSbtPageCopyIconStateArgs = {}): SbtPageCopyIconState => {
  const target = String(targetKey || '');
  const isCopied = typeof copied !== 'undefined'
    ? !!copied
    : !!target && String(copiedAddress || '') === target;
  return {
    shouldRenderCopiedIcon: isCopied,
    shouldRenderDefaultIcon: !isCopied,
  };
};

export const normalizeSbtPageCanonicalMetadataHref = (candidateRaw: unknown): string => {
  const candidate = String(candidateRaw || '').trim();
  if (!candidate) return '';
  const normalized = normalizeArweaveUrl(candidate, { contextLabel: 'sbt_page_token_uri' });
  if (!normalized || /^data:/i.test(normalized)) return '';
  if (isSbtPageImageLikeUri(normalized)) return '';
  return normalized;
};

export const resolveSbtPageTokenMetadataHref = (tokenUriRaw: unknown): string => {
  const raw = String(tokenUriRaw || '').trim();
  if (!raw) return '';

  const normalizedDirect = normalizeSbtPageCanonicalMetadataHref(raw);
  if (normalizedDirect) return normalizedDirect;
  if (!/^data:application\/json/i.test(raw)) return '';

  const decoded = decodeSbtPageJsonDataUri(raw);
  if (!decoded) return '';
  const candidates = [
    decoded.tokenURI,
    decoded.tokenUri,
    decoded.token_uri,
    decoded.uri,
    decoded.sbtTokenURI,
    decoded.sbtTokenUri,
    decoded.sbt_token_uri,
    decoded.metadataUri,
    decoded.metadataURI,
    decoded.metadata_uri,
    decoded.arweaveUri,
    decoded.arweaveURL,
    (typeof decoded.arweaveTxId === 'string' ? `ar://${decoded.arweaveTxId}` : null),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeSbtPageCanonicalMetadataHref(candidate);
    if (normalized) return normalized;
  }
  return '';
};

export const getBlockExplorerBaseUrl = (network: unknown): string => {
  const networkRecord = isRecord(network) ? network as BlockExplorerNetworkLike : null;
  return String(networkRecord?.blockExplorers?.default?.url || '').replace(/\/+$/, '');
};

export const buildSbtPageExplorerUrl = ({
  network = null,
  value = '',
  kind = 'address',
  fallbackBaseUrl = 'https://sepolia.etherscan.io',
}: {
  network?: unknown;
  value?: unknown;
  kind?: 'address' | 'tx';
  fallbackBaseUrl?: string;
} = {}): string => {
  const baseUrl = getBlockExplorerBaseUrl(network) || fallbackBaseUrl;
  const path = kind === 'tx' ? 'tx' : 'address';
  return `${baseUrl}/${path}/${value}`;
};

export const buildSbtPageDetailsPayload = ({
  sbtInfo = {},
  address = '',
}: {
  sbtInfo?: unknown;
  address?: unknown;
} = {}): Record<string, unknown> => ({
  ...Object(sbtInfo || {}),
  address,
});

export const resolveSbtChainId = (input: unknown): number | null => {
  const readChainId = (value: unknown): number | null => {
    const record = isRecord(value) ? value : {};
    const chainId = Number(record.chainId || record.chainID || 0);
    return chainId > 0 ? chainId : null;
  };

  if (Array.isArray(input)) {
    const found = input.find((entry) => readChainId(entry));
    return readChainId(found);
  }

  if (isRecord(input)) {
    return readChainId(input);
  }

  return null;
};

const readSbtPagePositiveNumber = (value: unknown): number | null => {
  const n = Number(value || 0);
  return n > 0 ? n : null;
};

export const resolveSbtPageActiveChainId = ({
  getSessionChainId,
  propNetwork = null,
  sbtInfo = null,
  sessionSlug = '',
  stateNetwork = null,
}: ResolveSbtPageActiveChainIdArgs = {}): number | null => {
  const networkChainId = readSbtPagePositiveNumber(stateNetwork?.id || propNetwork?.id);
  if (networkChainId) return networkChainId;

  const info = isRecord(sbtInfo) ? sbtInfo : {};
  const sbtChainId = readSbtPagePositiveNumber(info.chainID || info.chainId);
  if (sbtChainId) return sbtChainId;

  const sessionChainId = readSbtPagePositiveNumber(
    typeof getSessionChainId === 'function'
      ? getSessionChainId(String(sessionSlug || ''))
      : null
  );
  return sessionChainId || null;
};

export const resolveSbtPageRecoveryCacheChainId = ({
  getSessionChainId,
  propNetwork = null,
  propSBTAddress = null,
  sbtInfo = null,
  sessionSlug = '',
  stateNetwork = null,
}: ResolveSbtPageRecoveryCacheChainIdArgs = {}): number | null => {
  const info = isRecord(sbtInfo) ? sbtInfo : {};
  const sbtChainId = readSbtPagePositiveNumber(info.chainID || info.chainId);
  if (sbtChainId) return sbtChainId;

  const propChainId = resolveSbtChainId(propSBTAddress);
  if ((propChainId ?? 0) > 0) return propChainId;

  const sessionChainId = readSbtPagePositiveNumber(
    typeof getSessionChainId === 'function'
      ? getSessionChainId(String(sessionSlug || ''))
      : null
  );
  if (sessionChainId) return sessionChainId;

  const networkChainId = readSbtPagePositiveNumber(stateNetwork?.id || propNetwork?.id);
  return networkChainId || null;
};

export const resolveSbtPageActiveBlockTimeMs = ({
  activeChainId = null,
  getChainBlockTimeMs,
  multiplier = 1,
}: ResolveSbtPageActiveBlockTimeMsArgs = {}): number => {
  const factor = Number(multiplier || 1);
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const blockTimeMs = typeof getChainBlockTimeMs === 'function'
    ? getChainBlockTimeMs(activeChainId)
    : 0;
  return Math.round(blockTimeMs * safeFactor);
};

export const resolveSbtPageCountdownDisplaySeconds = (remainingMs: unknown): number => (
  Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000))
);

export const buildSbtPageClaimCountdownTickPatch = ({
  remainingMs = 0,
}: BuildSbtPageClaimCountdownTickPatchArgs = {}): Record<string, unknown> => ({
  claimCountdown: resolveSbtPageCountdownDisplaySeconds(remainingMs),
});

export const buildSbtPageClaimCountdownCompletePatch = ({
  waitMs = 0,
}: BuildSbtPageClaimCountdownCompletePatchArgs = {}): Record<string, unknown> => ({
  mintStep: 2,
  claimCountdown: resolveSbtPageCountdownDisplaySeconds(waitMs),
});

export const sanitizeSbtPageMintedTokensOverride = (value: unknown): string | null => {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) return null;
  return String(parsed);
};

export const normalizeSbtInviteCode = (raw: unknown): string => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('inv:')) return trimmed.slice(4).trim();
  if (lower.startsWith('invite:')) return trimmed.slice(7).trim();
  return trimmed;
};

export type SbtPageDecodedInviteInput = Record<string, unknown> & {
  inviteCode: string;
  nonce?: unknown;
  signature?: unknown;
};
type DecodeSbtPageInviteInput = (
  normalizedInviteCode: string
) => Record<string, unknown> | null | undefined;
export const decodeSbtPageInviteInput = (
  raw: unknown,
  decodeInvite: DecodeSbtPageInviteInput
): SbtPageDecodedInviteInput | null => {
  const normalized = normalizeSbtInviteCode(raw);
  if (!normalized || typeof decodeInvite !== 'function') return null;
  const payload = decodeInvite(normalized);
  if (!payload) return null;
  return { ...payload, inviteCode: normalized };
};

export const hasSbtPageAutoMintFlag = (searchRaw: unknown = ''): boolean => {
  try {
    const qs = String(searchRaw || '').replace(/^\?/, '');
    const params = new URLSearchParams(qs);
    if (params.get('auto') === '1') return true;
    for (const key of params.keys()) {
      if (/^auto\d+$/.test(key) && params.get(key) === '1') return true;
    }
    return false;
  } catch (_) {
    return false;
  }
};

export const buildSbtPageAutoMintCleanPath = (hrefRaw: unknown = ''): string | null => {
  try {
    const url = new URL(String(hrefRaw || ''));
    const params = url.searchParams;
    if (!hasSbtPageAutoMintFlag(params.toString())) return null;

    params.delete('auto');
    params.delete('sbt');
    params.delete('gp');
    params.delete('inv');
    Array.from(params.keys()).forEach((key) => {
      if (/^(sbt|gp|inv|auto)\d+$/.test(key)) params.delete(key);
    });

    const qs = params.toString();
    return url.pathname + (qs ? `?${qs}` : '');
  } catch (_) {
    return null;
  }
};

export const collectAutoMintPairsFromSearchParams = (
  searchParams: URLSearchParams | string | null = null
): AutoMintPairsResult => {
  const sp = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams || '');
  const globalAuto = sp.get('auto') === '1';
  const pairs: AutoMintPair[] = [];

  if (sp.has('sbt')) {
    pairs.push({
      sbt: sp.get('sbt'),
      gp: sp.get('gp'),
      inv: sp.get('inv'),
      auto: globalAuto,
    });
  }

  for (const key of sp.keys()) {
    const match = key.match(/^sbt(\d+)$/);
    if (!match) continue;
    const idx = match[1];
    const sbtVal = sp.get(key);
    if (!sbtVal) continue;
    pairs.push({
      sbt: sbtVal,
      gp: sp.get(`gp${idx}`),
      inv: sp.get(`inv${idx}`),
      auto: globalAuto || sp.get(`auto${idx}`) === '1',
    });
  }

  return { pairs, globalAuto };
};

export const resolveSbtPageUrlAutoMintIntent = ({
  propsIn = {},
  searchRaw = null,
  sessionStorageRef = null,
  state = {},
  windowSearch = '',
}: ResolveSbtPageUrlAutoMintIntentArgs = {}): SbtPageUrlAutoMintIntent | null => {
  const { original: currentSbtAddress, lower: currentSbtAddrLower } = getCurrentSbtAddressInfo(propsIn || {});
  if (!currentSbtAddress) return null;

  const qs = typeof searchRaw === 'string'
    ? searchRaw.replace(/^\?/, '')
    : String(windowSearch || '').replace(/^\?/, '');
  if (!qs) return null;

  const sp = new URLSearchParams(qs);
  const { pairs, globalAuto } = collectAutoMintPairsFromSearchParams(sp);
  const matchedPair = pairs.find((pair) => (pair.sbt || '').toLowerCase() === currentSbtAddrLower);

  let targetInvite: string | null = null;
  let targetPassword: string | null = null;
  let shouldAutoMint = false;

  if (matchedPair) {
    targetInvite = matchedPair.inv || null;
    targetPassword = matchedPair.gp || null;
    shouldAutoMint = matchedPair.auto;
  } else if (pairs.length === 0) {
    const legacyInv = sp.get('inv');
    const legacyGp = sp.get('gp');
    if (legacyInv && !sp.has('sbt')) {
      targetInvite = legacyInv;
      shouldAutoMint = globalAuto;
    } else if (legacyGp && !sp.has('sbt')) {
      targetPassword = legacyGp;
      shouldAutoMint = globalAuto;
    } else if (globalAuto) {
      shouldAutoMint = true;
    }
  }

  const targetCode = targetInvite || targetPassword;
  const autoKey = currentSbtAddrLower ? `autoMint:${currentSbtAddrLower}` : null;
  const alreadyTried = !!(
    autoKey &&
    sessionStorageRef?.getItem &&
    sessionStorageRef.getItem(autoKey) === 'done'
  );

  return {
    currentSbtAddress,
    targetInvite,
    targetPassword,
    targetCode,
    shouldAttemptAuto: Boolean(
      shouldAutoMint &&
      propsIn?.loginComplete &&
      !state?.userHasSBT &&
      state?.mintingStatus === 'idle' &&
      !alreadyTried
    ),
    autoKey,
  };
};

export const shouldRunSbtPagePropPasswordAutoMint = ({
  autoMintingMode = false,
  mintingStatus = '',
  sbtInfo = null,
  sbtMintPassword = null,
  userHasSBT = false,
}: ResolveSbtPagePropPasswordAutoMintArgs = {}): boolean => (
  !!autoMintingMode &&
  typeof sbtMintPassword === 'string' &&
  !userHasSBT &&
  mintingStatus === 'idle' &&
  !!sbtInfo
);

export const shouldRunSbtPagePropListAutoMint = ({
  autoMintingMode = false,
  hasAttemptedListMint = false,
  loginComplete = false,
  sbtMintPassword = null,
}: ResolveSbtPagePropListAutoMintArgs = {}): boolean => (
  !!loginComplete &&
  !!autoMintingMode &&
  Array.isArray(sbtMintPassword) &&
  !hasAttemptedListMint
);

export const normalizeSbtPageCountMap = (value: unknown = null): AddressCountMap => {
  const out: AddressCountMap = {};
  Object.entries(isRecord(value) ? value : {}).forEach(([addrRaw, countRaw]) => {
    const addr = String(addrRaw || '').toLowerCase();
    if (!addr) return;
    const count = Math.max(0, Math.floor(Number(countRaw || 0)));
    if (count <= 0) return;
    out[addr] = count;
  });
  return out;
};

export const expandSbtPageAddressListFromCountMap = (
  countMapIn: unknown = null,
  fallbackList: unknown = []
): string[] => {
  const hasStructuredCountMap =
    !!countMapIn &&
    typeof countMapIn === 'object' &&
    !Array.isArray(countMapIn);
  if (!hasStructuredCountMap) {
    return (Array.isArray(fallbackList) ? fallbackList : []).map((addr) => String(addr || '').toLowerCase());
  }
  const normalized = normalizeSbtPageCountMap(countMapIn);
  if (!Object.keys(normalized).length && Array.isArray(fallbackList) && fallbackList.length > 0) {
    return fallbackList.map((addr) => String(addr || '').toLowerCase());
  }
  const expanded: string[] = [];
  Object.entries(normalized).forEach(([addr, count]) => {
    for (let i = 0; i < count; i += 1) {
      expanded.push(addr);
    }
  });
  return expanded;
};

export const buildSbtPageAddressOccurrenceMap = (list: unknown = []): Map<string, number> => {
  const counts = new Map<string, number>();
  (Array.isArray(list) ? list : []).forEach((entry) => {
    const normalized = String(entry || '').toLowerCase();
    if (!normalized) return;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  });
  return counts;
};

export const computeSbtPageNetCounts = (
  mintsArr: unknown = [],
  burnsArr: unknown = []
): Map<string, number> => {
  const counts = new Map<string, number>();
  (Array.isArray(mintsArr) ? mintsArr : []).forEach((a) => {
    const k = (a || '').toLowerCase();
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  (Array.isArray(burnsArr) ? burnsArr : []).forEach((a) => {
    const k = (a || '').toLowerCase();
    counts.set(k, (counts.get(k) || 0) - 1);
  });
  return counts;
};

export const computeSbtPageNetHoldersList = (
  mintsArr: unknown = [],
  burnsArr: unknown = []
): string[] => {
  const counts = computeSbtPageNetCounts(mintsArr, burnsArr);
  return Array.from(counts.entries())
    .filter(([, v]) => v > 0)
    .map(([k]) => k);
};

export const buildSbtPageHolderListSignature = (list: unknown = []): string => {
  const entries = Array.isArray(list) ? list : [];
  let hash = 2166136261;
  for (let i = 0; i < entries.length; i += 1) {
    const normalized = String(entries[i] || '').toLowerCase();
    for (let j = 0; j < normalized.length; j += 1) {
      hash ^= normalized.charCodeAt(j);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 124;
    hash = Math.imul(hash, 16777619);
  }
  return `${entries.length}:${hash >>> 0}`;
};

export const buildSbtPageNetHoldersMemoState = ({
  buildHolderListSignature = buildSbtPageHolderListSignature,
  burnedAddresses = [],
  computeNetHoldersList = computeSbtPageNetHoldersList,
  memo = null,
  mintedAddresses = [],
}: BuildSbtPageNetHoldersMemoStateArgs = {}): SbtPageNetHoldersMemoStateResult => {
  const mintedRef = Array.isArray(mintedAddresses) ? mintedAddresses : [];
  const burnedRef = Array.isArray(burnedAddresses) ? burnedAddresses : [];
  const memoRecord = isRecord(memo) ? memo : {};
  const memoResult = Array.isArray(memoRecord.result) ? memoRecord.result as string[] : [];
  if (memoRecord.mintedRef === mintedRef && memoRecord.burnedRef === burnedRef) {
    return {
      memo: memoRecord as SbtPageNetHoldersMemoState,
      netHolders: memoResult,
    };
  }
  const mintedSignature = buildHolderListSignature(mintedRef);
  const burnedSignature = buildHolderListSignature(burnedRef);
  if (
    memoRecord.mintedSignature === mintedSignature &&
    memoRecord.burnedSignature === burnedSignature
  ) {
    return {
      memo: {
        ...(memoRecord as SbtPageNetHoldersMemoState),
        burnedRef,
        mintedRef,
        result: memoResult,
      },
      netHolders: memoResult,
    };
  }
  const nextResult = computeNetHoldersList(mintedRef, burnedRef);
  const netHolders = Array.isArray(nextResult) ? nextResult.map((entry) => String(entry || '')) : [];
  return {
    memo: {
      burnedRef,
      burnedSignature,
      mintedRef,
      mintedSignature,
      result: netHolders,
    },
    netHolders,
  };
};

export const buildSbtPageAddressListSignatureMemoState = ({
  buildAddressListSignature = buildSbtPageHolderListSignature,
  list = [],
  memo = null,
}: BuildSbtPageAddressListSignatureMemoStateArgs = {}): SbtPageAddressListSignatureMemoStateResult => {
  const entries = Array.isArray(list) ? list : [];
  const listToken = entries.map((entry) => String(entry || '').toLowerCase()).join('|');
  const memoRecord = isRecord(memo) ? memo : {};
  if (
    memoRecord.listRef === entries &&
    memoRecord.listToken === listToken &&
    typeof memoRecord.signature === 'string'
  ) {
    return {
      memo: memoRecord as SbtPageAddressSignatureMemoState,
      signature: memoRecord.signature,
    };
  }
  const signature = String(buildAddressListSignature(entries) || `${entries.length}:0`);
  return {
    memo: {
      listRef: entries,
      listToken,
      signature,
    },
    signature,
  };
};

export const buildSbtPageModalFilteredMintedUsersPatch = ({
  buildAddressListSignature = buildSbtPageHolderListSignature,
  filtered = [],
  isHolderScanActive = false,
  state = null,
}: BuildSbtPageModalFilteredMintedUsersPatchArgs = {}): SbtPageModalFilteredMintedUsersPatch | null => {
  const safeFiltered = Array.isArray(filtered) ? filtered : [];
  const currentState = isRecord(state) ? state : {};
  const currentFiltered = Array.isArray(currentState.filteredMintedUsers)
    ? currentState.filteredMintedUsers
    : [];
  const preserveDuringRefresh =
    safeFiltered.length === 0 &&
    Boolean(isHolderScanActive) &&
    currentFiltered.length > 0;
  if (preserveDuringRefresh) {
    return currentState.loadingMintedFilter ? { loadingMintedFilter: false } : null;
  }
  const nextSignature = buildAddressListSignature(safeFiltered);
  if (nextSignature !== currentState.filteredMintedUsersSignature) {
    return {
      filteredMintedUsers: safeFiltered,
      filteredMintedUsersSignature: nextSignature,
      loadingMintedFilter: false,
    };
  }
  return currentState.loadingMintedFilter ? { loadingMintedFilter: false } : null;
};

export const buildSbtPageNextFilteredHolderRows = (
  {
    prevFilteredRows = [],
    prevNetHolders = [],
    nextNetHolders = [],
    replaceRows = false,
  }: BuildNextFilteredHolderRowsArgs = {},
  buildAddressListSignature: (list: unknown) => string = buildSbtPageHolderListSignature
): string[] => {
  const prevFiltered = (Array.isArray(prevFilteredRows) ? prevFilteredRows : [])
    .map((entry) => String(entry || '').toLowerCase())
    .filter(Boolean);
  const nextRows = (Array.isArray(nextNetHolders) ? nextNetHolders : [])
    .map((entry) => String(entry || '').toLowerCase())
    .filter(Boolean);
  if (replaceRows) {
    const prevWasFullHolderSet =
      buildAddressListSignature(prevFiltered) === buildAddressListSignature(prevNetHolders);
    if (prevWasFullHolderSet) {
      return nextRows;
    }
  }
  const nextSet = new Set<string>(nextRows);
  return prevFiltered.filter((entry) => nextSet.has(entry));
};

export const mergeSbtPageBurnEvidenceIntoPreservedHolderState = (
  prevMinted: unknown = [],
  prevBurned: unknown = [],
  nextMinted: unknown = [],
  nextBurned: unknown = []
): PreservedHolderState => {
  const preservedMinted = Array.isArray(prevMinted) ? prevMinted.map((entry) => String(entry || '').toLowerCase()) : [];
  const preservedBurned = Array.isArray(prevBurned) ? prevBurned.map((entry) => String(entry || '').toLowerCase()) : [];
  const nextMintedSafe = Array.isArray(nextMinted) ? nextMinted : [];
  const nextBurnedSafe = Array.isArray(nextBurned) ? nextBurned : [];
  const prevNetCounts = computeSbtPageNetCounts(preservedMinted, preservedBurned);
  const nextNetCounts = computeSbtPageNetCounts(nextMintedSafe, nextBurnedSafe);
  const prevBurnCounts = buildSbtPageAddressOccurrenceMap(preservedBurned);
  const nextBurnCounts = buildSbtPageAddressOccurrenceMap(nextBurnedSafe);
  let burnDiscovered = false;

  prevNetCounts.forEach((prevNetCount, addr) => {
    if (prevNetCount <= 0) return;
    const prevBurnCount = prevBurnCounts.get(addr) || 0;
    const nextBurnCount = nextBurnCounts.get(addr) || 0;
    const nextNetCount = nextNetCounts.get(addr) || 0;
    if (nextBurnCount <= prevBurnCount || nextNetCount >= prevNetCount) return;
    const burnDelta = nextBurnCount - prevBurnCount;
    for (let i = 0; i < burnDelta; i += 1) {
      preservedBurned.push(addr);
    }
    burnDiscovered = true;
  });

  return {
    mintedAddresses: preservedMinted,
    burnedAddresses: preservedBurned,
    burnDiscovered,
  };
};

export const normalizeSbtPageLoadInfoOptions = (
  optionsOrForce: unknown = false
): SbtPageLoadInfoOptions => {
  if (optionsOrForce && typeof optionsOrForce === 'object' && !Array.isArray(optionsOrForce)) {
    const options = optionsOrForce as Record<string, unknown>;
    return {
      forceEventFetch: options.forceEventFetch === true || options.force === true,
      preferCountsOnly: options.preferCountsOnly === true || options.countsOnly === true,
    };
  }
  return {
    forceEventFetch: optionsOrForce === true,
    preferCountsOnly: false,
  };
};
