/** @file SBTPage */

import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faCheck, faSpinner, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { ethers } from 'ethers';
import {
  getDemoSessionConfigBySlug,
  getSessionChainId,
  getSessionConfigBySlugOrDefault,
  normalizeSessionSlug,
} from '../../domains/sessions/sessionConfig.js';
import { sbtAdminOpsPort } from '../../domains/sbts/sbtAdminOpsPort.js';
import { sbtGroupMintAuthorizationPort } from '../../domains/sbts/sbtGroupMintAuthorizationPort.js';
import { sbtMetadataReadsPort } from '../../domains/sbts/sbtMetadataReadsPort.js';
import { sbtMintExecutionPort } from '../../domains/sbts/sbtMintExecutionPort.js';
import { sbtOwnershipReadsPort } from '../../domains/sbts/sbtOwnershipReadsPort.js';
import { getChainBlockTimeMs } from '../../variables/chains.js';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import styles from './SBTPage.module.scss';
import defaultSbtImage from '../../assets/img/ce_circuit_logo.png';

import { cryptoUtils } from 'utilities/crypto/cryptography.js';
import { getGlobalLitHooks, litStorage } from 'utilities/crypto/litProtocol.js';
import { createLogger } from 'utilities/logging.js';
import { listNamespaceEntriesSync, peekCacheSync, readCache, writeCache } from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import { buildPublicRoute, readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { notify } from '../../utilities/ui/notify.js';
import { getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { isCryptoMode, sbtBasePath, sbtsListPath, t } from '../../utilities/ui/terminology.js';
import SbtPageAdminActions from './SbtPageAdminActions';
import { renderSbtPageFullActionSurfaces, type SbtPageFullActionSurfaces } from './SbtPageFullActionButtons';
import { renderSbtPageFullView, renderSbtPageFullViewLoading } from './SbtPageFullView';
import SbtPageMiniCard from './SbtPageMiniCard';
import SbtPageRelevantInfo from './SbtPageRelevantInfo';
import {
  appendEncryptedSbtRecovery,
  clearAllSbtRecovery,
  loadSbtRecoverySnapshot,
  selectAdminEncryptedRecovery,
} from './SbtEncryptedRecoveryControl';
import { buildSbtPageMiniCardActionHandlers } from './sbtPageActionController';
import {
  appendSbtPageBookmark,
  appendSbtPageTransactionHash,
  applySbtPageHistorySummaryFallback,
  buildSessionRoutePath,
  buildSbtPageAddressListSignatureMemoState,
  buildSbtPageAddressChangeResetMintUiPatch,
  buildSbtPageAdminFallbackPatch,
  buildSbtPageAdminInviteSuccessPatch,
  buildSbtPageBookmarkedPatch,
  buildSbtPageBooleanTogglePatch,
  buildSbtPageBurnFailurePatch,
  buildSbtPageBurnPendingPatch,
  buildSbtPageBurnSearchInputPatch,
  buildSbtPageBurnSearchResultPatch,
  buildSbtPageBurnSuccessPatch,
  buildSbtPageInitialState,
  buildSbtPageHolderListSignature,
  buildSbtPageIntervalIdPatch,
  buildSbtPageLoadingMintersBurnersPatch,
  buildSbtPageNetworkUpdatePatch,
  buildSbtPageLogScanProgressPatch,
  buildSbtPageLocalBurnSuccessPatch,
  buildSbtPageLocalMintSuccessPatch,
  buildSbtPageNextFilteredHolderRows,
  buildSbtPageNetHoldersMemoState,
  buildSbtPageLoadInfoLoadingStartPatch,
  buildSbtPageLoadInfoRequestKey,
  buildSbtPageAutoMintCleanPath,
  buildSbtPageDetailsPayload,
  buildSbtPageClaimCountdownCompletePatch,
  buildSbtPageClaimCountdownTickPatch,
  buildSbtPageCopiedAddressPatch,
  buildSbtPageCopiedErrorPatch,
  buildSbtPageDirectMetadataContext,
  buildSbtPageDocModalContentPatch,
  buildSbtPageDocModalErrorPatch,
  buildSbtPageDocModalOpenPatch,
  buildSbtPageDocModalResetPatch,
  buildSbtPageEncryptedMetadataDecryptPlan,
  buildSbtPageErrorPatch,
  buildSbtPageExportFormatPatch,
  buildSbtPageExplorerUrl,
  buildSbtPageModalFilteredMintedUsersPatch,
  buildSbtPageIncludePreviousPasswordsPatch,
  buildSbtPageMiniPasswordInputPatch,
  buildSbtPageMintedModalInitialFilterPatch,
  buildSbtPageMintCountdownPatch,
  buildSbtPageMintFailurePatch,
  buildSbtPageMintedModalVisibilityPatch,
  buildSbtPageMintPendingPatch,
  buildSbtPageMintSuccessPatch,
  buildSbtPageOpenMintAutoJoinUrl,
  buildSbtPageEffectiveHolderScanProgress,
  buildSbtPageParentSessionScanProgress,
  buildSbtPagePasswordExportFile,
  buildSbtPagePasswordExportRows,
  buildSbtPagePasswordInputValuePatch,
  buildSbtPageMintPasswordClearPatch,
  buildSbtPageMintPasswordPrefillPatch,
  buildSbtPagePasswordClaimStartSuccessPatch,
  buildSbtPagePasswordGenerationCountPatch,
  buildSbtPagePasswordMintInputPatch,
  buildSbtPageAccountDerivedStatePatch,
  buildSbtPagePrimaryMetadataStatePatch,
  buildSbtPageRefreshOptions,
  buildSbtPageRelevantInfoPatch,
  buildSbtPageResolvedSessionSlugPatch,
  buildSbtPageSbtInfoPatch,
  buildSbtPageSessionSbtAddressesMemoState,
  buildSbtPageLoadInfoStartLogContext,
  coerceSbtPageEpochSeconds,
  coerceSbtPageStringArrayValue,
  computeSbtPageNetHoldersList,
  deriveSbtPageCacheNetKey,
  decodeSbtPageInviteInput,
  encodeSbtPageGroupPasswordForUrl,
  expandSbtPageAddressListFromCountMap,
  findSbtPageCachedEntryAcrossGroups,
  findNestedInteractiveElement,
  generateSbtPageRandomPasswords,
  getDisplayImageFallbackCandidateCount,
  getErrorMessage,
  getExplicitSbtPageSessionSlug,
  hasSbtPageAutoMintFlag,
  getNextDisplayImageFallbackState,
  isActiveSbtPageScanProgress,
  isRecord,
  normalizeSbtPageLoadInfoOptions,
  normalizeSbtPageHistorySummary,
  needsSbtPageDirectMetadataHydration,
  needsSbtPageTokenUriFields,
  readSbtPageCacheBySlug,
  readSbtPageQueuedOrStoredLocalStorageJson,
  serializeSbtPageLocalStorageJsonWrite,
  resolveSbtPageLocalStorageJsonWriteDecision,
  resolveSbtPageSessionSlugFromInfo,
  resolveSbtPageActiveBlockTimeMs,
  resolveSbtPageActiveChainId,
  resolveSbtPageAdminActionDisplayPlan,
  resolveSbtPageAddressLinkState,
  resolveSbtPageCopyableErrorText,
  resolveSbtPageCopyIconState,
  resolveSbtPageEffectiveSessionSlug,
  resolveSbtPageFullActionDisplayPlan,
  resolveSbtPageFullViewShellState,
  resolveSbtPageHolderScanActive,
  resolveSbtPageIdentityPanelDisplayState,
  resolveSbtPageInteractiveCursorStyle,
  resolveSbtPageLoadInfoPendingQueuePlan,
  resolveSbtPageMetadataHydrationMode,
  resolveSbtPageMiniCardDisplayState,
  resolveSbtPageOwnerLookupFallbackDecision,
  resolveSbtPageOwnerLookupTokenCount,
  resolveSbtPagePasswordExportSelection,
  resolveSbtPageRecoveryCacheChainId,
  resolveSbtPageRelevantInfoDisplayState,
  resolveSbtPageRelevantInfoLists,
  resolveSbtPageRefreshLifecyclePlan,
  reconcileSbtPageHolderRefreshState,
  resolveSbtPageCacheRevisionReloadPlan,
  resolveSbtPageCachedGroupPasswordHash,
  resolveSbtPageChainMetadataReadNeeds,
  resolveSbtPageGroupPasswordMintState,
  resolveSbtPageSessionDisplayConfig,
  resolveSbtPageSessionDisplayLabel,
  resolveSbtPageShouldRefreshCounts,
  resolveSbtPageUrlAutoMintIntent,
  resolveSbtPageUserAdminStatus,
  resolveSbtAddress,
  resolveSbtAddressString,
  sanitizeSbtPageMintedTokensOverride,
  shouldRunSbtPagePropListAutoMint,
  shouldRunSbtPagePropPasswordAutoMint,
} from './sbtPageHelpers';
import type {
  ReconcileSbtPageHolderRefreshStateArgs,
  ReconciledSbtPageHolderRefreshState,
  SbtPageFullActionDisplayPlan,
  SbtPageDecodedInviteInput,
  SbtPageUrlAutoMintIntent,
} from './sbtPageHelpers';

const sbtLog = createLogger('sbt');
const inviteLog = createLogger('inviteDebug');
const encodeSbtPageGroupPassword = (code: string): string => encodeSbtPageGroupPasswordForUrl(code, cryptoUtils);
type QueueLocalStorageJsonWriteOptions = {
  immediate?: boolean;
};
type SbtPageInviteClaimPayload = SbtPageDecodedInviteInput;
type SbtPageInviteClaimOptions = {
  accountLowerOverride?: unknown;
  chainIdOverride?: unknown;
  suppressErrors?: boolean;
  sessionSlugOverride?: unknown;
};
type SbtPageGroupPasswordClaimOptions = SbtPageInviteClaimOptions & {
  groupPasswordHashOverride?: unknown;
};
type SbtPageAutoMintOptions = SbtPageInviteClaimOptions & {
  sbtInfoOverride?: unknown;
};
type SbtPageManualMintOptions = SbtPageInviteClaimOptions & {
  passwordOverride?: unknown;
  sbtAddressOverride?: unknown;
};
type SbtPageHandleMintOptions = SbtPageInviteClaimOptions & {
  sbtAddressOverride?: unknown;
  sbtInfoOverride?: unknown;
};
type SbtPageTransactionResult = Record<string, unknown> & {
  transactionHash?: string;
};
type SbtPageInviteClaimResult = { ok: true; tx: SbtPageTransactionResult } | { ok: false; error: unknown };
type BookmarkStorageCache = {
  sbts?: string[];
};
type TransactionStorageCache = Record<string, string[]>;
type SbtAddressPropsLike = {
  SBTAddress?: unknown;
  loginComplete?: boolean;
};
type SessionSlugPropsLike = {
  sessionSlug?: unknown;
  slug?: unknown;
};
type SessionDisplayConfig = Record<string, unknown> & {
  sessionName?: unknown;
  blockLimits?: Record<string, unknown>;
};
type ScanProgressRecord = Record<string, unknown> & {
  currentBlock?: unknown;
  latestBlock?: unknown;
  totalBlocks?: unknown;
  scannedBlocks?: unknown;
  remainingBlocks?: unknown;
  phase?: unknown;
};
type BuildNextFilteredHolderRowsArgs = {
  prevFilteredRows?: unknown;
  prevNetHolders?: unknown;
  nextNetHolders?: unknown;
  replaceRows?: boolean;
};
type HolderRefreshStateLike = Record<string, unknown> & {
  mintedAddresses?: unknown;
  burnedAddresses?: unknown;
  nextMintedAddresses?: unknown;
  holdersMetaKey?: unknown;
  showModal?: unknown;
  mintingAddressesFilterInitialized?: unknown;
  filteredMintedUsers?: unknown;
  filteredMintedUsersSignature?: unknown;
  countsLoaded?: unknown;
  mintedTokensOverride?: unknown;
  showFullImage?: unknown;
};
type SbtPageLoadInfoOptions = {
  forceEventFetch: boolean;
  preferCountsOnly: boolean;
};
type SbtPageNetHoldersMemo = {
  mintedRef: unknown[] | null;
  burnedRef: unknown[] | null;
  mintedSignature: string;
  burnedSignature: string;
  result: string[];
};
type SbtPageAddressSignatureMemo = {
  listRef: unknown[] | null;
  listToken: string;
  signature: string;
};
type SbtPageDisplayImageErrorArgs = {
  sourceKey?: string;
  activeIndex?: number;
  candidates?: string[];
};
type SbtPageBurnSearchResult = Record<string, unknown> & {
  address?: unknown;
  tokenId?: unknown;
};
type SbtPagePreviousProps = Record<string, unknown> & {
  SBTAddress?: unknown;
  account?: unknown;
  network?: {
    id?: unknown;
  };
  sessionSlug?: unknown;
  slug?: unknown;
};
type SbtPageMetadataInfoLike = Record<string, unknown> & {
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
type SbtPageCachedSbtEntry = Record<string, unknown> & {
  burnedAddresses?: unknown;
  burnedCountByAddress?: unknown;
  burnedEventCount?: unknown;
  blockNumber?: unknown;
  countsLoaded?: unknown;
  creationBlock?: unknown;
  mintedAddresses?: unknown;
  mintedCountByAddress?: unknown;
  mintedEventCount?: unknown;
  sbtInfo?: SbtPageMetadataInfoLike | null;
  slug?: unknown;
};
type SbtPageCacheNetNode = Record<string, unknown> & {
  sbtList?: Record<string, SbtPageCachedSbtEntry | null | undefined>;
};
type SbtPageCacheByNet = Record<string, SbtPageCacheNetNode | undefined>;
type SbtPageCachedEntryHit = {
  entry: SbtPageCachedSbtEntry;
  netKey: string;
  slug: string;
};
type SbtPageCacheLookupArgs = {
  excludeSlug?: unknown;
};
type SbtPageDirectMetadataContext = {
  networkChainId?: number;
  slug?: string;
};
type SbtPageLitHooks = Record<string, unknown> & {
  getKey?: (...args: unknown[]) => unknown;
};
type SbtPageScanProgress = Record<string, unknown>;
type SbtPageRefreshOptions = {
  countsOnly?: boolean;
  forceCounts: boolean;
  onProgress?: (progress: SbtPageScanProgress) => void;
};
type SbtPagePrimaryMetadataState = Record<string, unknown> & {
  sbtInfo?: unknown;
};
type SbtPageInfoState = Record<string, unknown> & {
  burnAuth?: unknown;
  chainID?: unknown;
  hasPasswordMint?: boolean;
  image?: unknown;
  maxTokens?: unknown;
  tokenURI?: unknown;
  tokenUri?: unknown;
};
type SbtPageNetworkState = Record<string, unknown> & {
  id?: unknown;
};
type SbtPageState = Record<string, unknown> & {
  adminGeneratedPasswords: string[];
  bookmarked: boolean;
  burnedAddresses: unknown[];
  burningStatus: string;
  burnSearchInput: string;
  burnSearchResult: SbtPageBurnSearchResult | null;
  cachedPasswords: string[];
  claimCountdown: number;
  countsLoaded: boolean;
  copiedAddress: unknown;
  copiedError?: unknown;
  displayImageFallbackIndex?: unknown;
  displayImageFallbackKey?: unknown;
  docModalContent: string;
  docModalError: string;
  docModalLoading: boolean;
  docModalName: string;
  docModalOpen: boolean;
  docModalBlobUrl: string;
  error: React.ReactNode;
  exportFormat: string;
  encryptedRecoveryEnabled: boolean;
  encryptedRecoveryStatus: string;
  filteredMintedUsers: unknown[];
  groupPasswordHash: unknown;
  groupPasswordHashLoaded: boolean;
  groupPasswordInput: string;
  hasGroupPasswordMint: boolean;
  hasInviteMint: boolean;
  includePreviousPasswords: boolean;
  intervalId: ReturnType<typeof setInterval> | null;
  lastBurnTxHash: string | null;
  lastMintTxHash: string | null;
  loadingMintedFilter: boolean;
  loadingMintersBurners: boolean;
  manualPasswordInput: string;
  mintCountdown: React.ReactNode;
  mintingStatus: string;
  mintPassword: string;
  mintStep: number;
  mintedAddresses: unknown[];
  mintedTokensOverride: unknown;
  network: SbtPageNetworkState | null;
  passwordGenerationCount: string | number;
  resolvedSessionSlug: string | null;
  sbtInfo: SbtPageInfoState | null;
  showActions: boolean;
  showAdminSection: boolean;
  showDocsSection: boolean;
  showFullImage: boolean;
  showModal: boolean;
  showMoreDetails: boolean;
  showPasswordAlert: boolean;
  showStats: boolean;
  showMiniPasswordInput: boolean;
  transactionHash: string | null;
  userHasSBT: boolean;
  userIsSbtAdmin: boolean;
};
class SBTPage extends Component<any, any> {
  _isMounted = false;
  hasAttemptedListMint = false; // Flag for sequential minting
  _attemptedListMintTargetKey = '';
  // Per-instance guards (no background loops)
  _metaHydrationTried: Record<string, boolean> = {}; // key: `${netId}:${addrLower}` => true
  _eventScanTried: Record<string, boolean> = {}; // key: `${netId}:${addrLower}` => true
  _descDecryptTried: Record<string, boolean> = {}; // key: `${netId}:${addrLower}:${account}` => true
  _activeScanKey: string | null = null;
  _loadSbtInfoInFlight = false;
  _passwordRecoveryLoadId = 0;
  _loadSbtInfoPending = false;
  _loadSbtInfoPendingForce = false;
  _loadSbtInfoPendingOptions: SbtPageLoadInfoOptions | null = null;
  _latestLoadSbtInfoRequestKey = '';
  _localStorageWriteCache: Record<string, string> = {};
  _queuedLocalStorageWrites = new Map<string, string>();
  _localStorageWriteTimer: ReturnType<typeof setTimeout> | null = null;
  _netHoldersMemo: SbtPageNetHoldersMemo = {
    mintedRef: null,
    burnedRef: null,
    mintedSignature: '',
    burnedSignature: '',
    result: [],
  };
  _filteredMintedUsersSignatureMemo: SbtPageAddressSignatureMemo = {
    listRef: null,
    listToken: '',
    signature: '',
  };
  _sessionSBTAddressesKey = '';
  _sessionSBTAddressesValue: string[] = [];
  _decryptedImageBlobUrl = '';
  _burnSearchTimer: ReturnType<typeof setTimeout> | null = null;
  _activeMintPendingTargetKey = '';

  state: SbtPageState = buildSbtPageInitialState({ network: this.props.network }) as SbtPageState;

  getRecoveryCacheChainId = (): number | null => {
    return resolveSbtPageRecoveryCacheChainId({
      getSessionChainId,
      propNetwork: this.props?.network,
      propSBTAddress: this.props?.SBTAddress,
      sbtInfo: this.state?.sbtInfo,
      sessionSlug: this.getEffectiveSessionSlug(),
      stateNetwork: this.state?.network,
    });
  };

  getActiveBlockTimeMs = (multiplier: unknown = 1): number => {
    return resolveSbtPageActiveBlockTimeMs({
      activeChainId: resolveSbtPageActiveChainId({
        getSessionChainId,
        propNetwork: this.props?.network,
        sbtInfo: this.state?.sbtInfo,
        sessionSlug: this.getEffectiveSessionSlug(),
        stateNetwork: this.state?.network,
      }),
      getChainBlockTimeMs,
      multiplier,
    });
  };

  componentDidMount() {
    this._isMounted = true;
    const { SBTAddress } = this.props;
    (async () => {
      if (SBTAddress) {
        await this.loadSBTInfo();
      }
      this.startMintingEndCountdown();
      this.checkForMintPassword();
      this.fetchRelevantInfo();
      this.loadCachedPasswords();

      // Demo/modern auto-mint (prop-driven)
      if (
        shouldRunSbtPagePropPasswordAutoMint({
          autoMintingMode: this.props.autoMintingMode,
          mintingStatus: this.state.mintingStatus,
          sbtInfo: this.state.sbtInfo,
          sbtMintPassword: this.props.sbtMintPassword,
          userHasSBT: this.state.userHasSBT,
        })
      ) {
        this.handleMint();
      }
      if (
        shouldRunSbtPagePropListAutoMint({
          autoMintingMode: this.props.autoMintingMode,
          hasAttemptedListMint: this.hasAttemptedListMintForCurrentTarget(),
          loginComplete: this.props.loginComplete,
          sbtMintPassword: this.props.sbtMintPassword,
        })
      ) {
        this.markAttemptedListMintForCurrentTarget();
        this.attemptMintWithPasswordList(this.props.sbtMintPassword);
      }

      try {
        await this.handleUrlAutoMintIntent();
      } catch (err) {
        sbtLog.warn('Error parsing auto-mint params:', err);
      }
    })().catch((e: unknown) => sbtLog.warn('componentDidMount async error:', e));
  }

  componentDidUpdate(prevProps: SbtPagePreviousProps): void {
    const { SBTAddress, network, sbtMintPassword, account, sbtCacheRevision, autoMintingMode, loginComplete } =
      this.props;

    const prevAddress = resolveSbtAddress(prevProps.SBTAddress);
    const nextAddress = resolveSbtAddress(SBTAddress);
    const sbtAddressChanged = String(prevAddress || '').toLowerCase() !== String(nextAddress || '').toLowerCase();

    if (sbtAddressChanged || network?.id !== prevProps.network?.id) {
      this._activeMintPendingTargetKey = '';
      if (this._isMounted) {
        const resetMintUiState = buildSbtPageAddressChangeResetMintUiPatch({
          forceReset: network?.id !== prevProps.network?.id,
          sbtAddressChanged,
        });

        if (network && network.id !== this.state.network?.id) {
          this.setState(buildSbtPageNetworkUpdatePatch({ resetMintUiState, network }), () => {
            if (this._isMounted) {
              this.loadSBTInfo();
              this.restartMintingEndCountdown();
              this.checkForMintPassword();
            }
          });
        } else {
          if (resetMintUiState) {
            this.setState(resetMintUiState);
          }
          this.loadSBTInfo();
          this.restartMintingEndCountdown();
          this.checkForMintPassword();
        }
      }
      return;
    }

    const prevSessionSlug = prevProps.sessionSlug ?? prevProps.slug ?? '';
    const nextSessionSlug = this.props.sessionSlug ?? this.props.slug ?? '';
    if (prevSessionSlug !== nextSessionSlug) {
      this._activeMintPendingTargetKey = '';
      const resetMintUiState = buildSbtPageAddressChangeResetMintUiPatch({
        forceReset: true,
      });
      if (nextSessionSlug) {
        if (this._isMounted) {
          this.setState(
            {
              ...(resetMintUiState || {}),
              ...buildSbtPageResolvedSessionSlugPatch({ slug: nextSessionSlug }),
            },
            () => {
              if (this._isMounted) {
                this.loadSBTInfo();
                this.restartMintingEndCountdown();
              }
            },
          );
        } else {
          this.loadSBTInfo();
        }
      } else if (this._isMounted) {
        if (resetMintUiState) this.setState(resetMintUiState);
        if (this.state.resolvedSessionSlug == null) {
          this.loadSBTInfo();
          this.restartMintingEndCountdown();
        }
      }
      return;
    }

    if (account !== prevProps.account) {
      this._activeMintPendingTargetKey = '';
      if (this._isMounted) {
        // Avoid briefly showing the prior account's holder-derived flags while the refresh is in-flight.
        try {
          const resetMintUiState = buildSbtPageAddressChangeResetMintUiPatch({
            forceReset: true,
          });
          const nextPatch = buildSbtPageAccountDerivedStatePatch({ account, state: this.state });
          const mergedPatch = {
            ...(resetMintUiState || {}),
            ...(nextPatch || {}),
          };
          if (Object.keys(mergedPatch).length > 0) this.setState(mergedPatch);
        } catch (e) {
          sbtLog.warn('SBTPage: fallback', e);
        }
        this.loadSBTInfo();
        this.restartMintingEndCountdown();
      }
      try {
        this.handleUrlAutoMintIntent().catch((e: unknown) => {
          const message =
            e instanceof Error && e.message
              ? e.message
              : isRecord(e) && typeof e.message === 'string' && e.message
                ? e.message
                : 'Auto-mint failed.';
          if (this._isMounted) this.setState(buildSbtPageMintFailurePatch({ error: message }));
        });
      } catch (e) {
        sbtLog.warn('SBTPage: fallback', e);
      }
      return;
    }

    const cacheRevisionReloadPlan = resolveSbtPageCacheRevisionReloadPlan({
      isMounted: this._isMounted,
      nextSbtAddress: SBTAddress,
      nextSbtCacheRevision: sbtCacheRevision,
      prevSbtCacheRevision: prevProps.sbtCacheRevision,
    });
    if (cacheRevisionReloadPlan.cacheRevisionChanged) {
      if (cacheRevisionReloadPlan.shouldResetMetaHydrationTried) {
        this._metaHydrationTried = {};
      }
      if (cacheRevisionReloadPlan.shouldReloadSbtInfo) {
        // Re-attempt centralized meta hydration on a new cache revision; no event scan here.
        this.loadSBTInfo(cacheRevisionReloadPlan.loadOptions);
      }
      return;
    }

    if (sbtMintPassword !== prevProps.sbtMintPassword && this._isMounted) {
      this.checkForMintPassword();
    }

    // Demo/modern auto-mint (prop-driven)
    if (
      shouldRunSbtPagePropPasswordAutoMint({
        autoMintingMode,
        mintingStatus: this.state.mintingStatus,
        sbtInfo: this.state.sbtInfo,
        sbtMintPassword,
        userHasSBT: this.state.userHasSBT,
      })
    ) {
      this.handleMint();
    }
    if (
      shouldRunSbtPagePropListAutoMint({
        autoMintingMode,
        hasAttemptedListMint: this.hasAttemptedListMintForCurrentTarget(),
        loginComplete,
        sbtMintPassword,
      })
    ) {
      this.markAttemptedListMintForCurrentTarget();
      this.attemptMintWithPasswordList(sbtMintPassword);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (this.state.intervalId) {
      clearInterval(this.state.intervalId);
    }
    if (this._burnSearchTimer) {
      clearTimeout(this._burnSearchTimer);
      this._burnSearchTimer = null;
    }
    if (this._localStorageWriteTimer) {
      clearTimeout(this._localStorageWriteTimer);
      this._localStorageWriteTimer = null;
    }
    this.releaseDecryptedImageBlobUrl();
    this.flushQueuedLocalStorageWrites();
  }

  releaseDecryptedImageBlobUrl = (): void => {
    const blobUrl = this._decryptedImageBlobUrl;
    if (!blobUrl || typeof URL === 'undefined') return;
    try {
      URL.revokeObjectURL(blobUrl);
    } catch (e: unknown) {
      sbtLog.warn('SBTPage: cleanup', e);
    }
    this._decryptedImageBlobUrl = '';
  };

  flushQueuedLocalStorageWrites = (): void => {
    if (typeof localStorage === 'undefined') return;
    if (!this._queuedLocalStorageWrites || this._queuedLocalStorageWrites.size === 0) return;
    this._queuedLocalStorageWrites.forEach((nextJson: string, key: string) => {
      try {
        const cached = this._localStorageWriteCache[key];
        const currentRaw = localStorage.getItem(key) || '';
        const decision = resolveSbtPageLocalStorageJsonWriteDecision({
          cachedJson: cached,
          currentRaw,
          nextJson,
        });
        if (decision === 'skip') return;
        if (decision === 'adopt') {
          this._localStorageWriteCache[key] = nextJson;
          return;
        }
        localStorage.setItem(key, nextJson);
        this._localStorageWriteCache[key] = nextJson;
      } catch (e: unknown) {
        sbtLog.warn('SBTPage: fallback', e);
      }
    });
    this._queuedLocalStorageWrites.clear();
  };

  queueLocalStorageJsonWrite = (
    key: unknown,
    value: unknown,
    options: QueueLocalStorageJsonWriteOptions = {},
  ): boolean => {
    if (typeof localStorage === 'undefined') return false;
    const serialized = serializeSbtPageLocalStorageJsonWrite({ key, value });
    if (!serialized) return false;
    const { storageKey, nextJson } = serialized;
    try {
      const currentRaw = localStorage.getItem(storageKey) || '';
      const decision = resolveSbtPageLocalStorageJsonWriteDecision({
        cachedJson: this._localStorageWriteCache[storageKey],
        currentRaw,
        nextJson,
      });
      if (decision === 'skip') return false;
      if (decision === 'adopt') {
        this._localStorageWriteCache[storageKey] = nextJson;
        return false;
      }
    } catch (e: unknown) {
      sbtLog.warn('SBTPage: fallback', e);
    }

    this._queuedLocalStorageWrites.set(storageKey, nextJson);
    if (options?.immediate === true) {
      this.flushQueuedLocalStorageWrites();
      return true;
    }
    if (this._localStorageWriteTimer) return true;
    this._localStorageWriteTimer = setTimeout(() => {
      this._localStorageWriteTimer = null;
      this.flushQueuedLocalStorageWrites();
    }, 24);
    return true;
  };

  readQueuedOrStoredLocalStorageJson = <T extends Record<string, unknown>>(key: unknown, fallback: T): T => {
    return readSbtPageQueuedOrStoredLocalStorageJson({
      fallback,
      key,
      queuedWrites: this._queuedLocalStorageWrites,
      storageRef: typeof localStorage !== 'undefined' ? localStorage : null,
    });
  };

  clearAutoMintUrlIntent = (): void => {
    try {
      const search = typeof window !== 'undefined' && window.location.search ? window.location.search : '';
      if (hasSbtPageAutoMintFlag(search)) {
        if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
          const cleanUrl = buildSbtPageAutoMintCleanPath(window.location.href);
          if (cleanUrl) window.history.replaceState(null, '', cleanUrl);
        }
      }
    } catch (e: unknown) {
      sbtLog.warn('SBTPage: fallback', e);
    }
  };

  decodeInviteInput = (raw: unknown): SbtPageDecodedInviteInput | null =>
    decodeSbtPageInviteInput(raw, cryptoUtils.decodeInvite);

  resolveUrlAutoMintIntent = (
    searchRaw: unknown = null,
    propsIn: SbtAddressPropsLike = this.props,
  ): SbtPageUrlAutoMintIntent | null => {
    return resolveSbtPageUrlAutoMintIntent({
      chainId: this.props.network?.id || this.props.networkChainId,
      propsIn,
      searchRaw,
      sessionSlug: this.getEffectiveSessionSlug(),
      sessionStorageRef: typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null,
      state: this.state,
      windowSearch: typeof window !== 'undefined' && window.location.search ? window.location.search : '',
    }) as SbtPageUrlAutoMintIntent | null;
  };

  // Keep mount/update auto-mint routing centralized so query handling stays consistent.
  handleUrlAutoMintIntent = async (propsIn: SbtAddressPropsLike = this.props): Promise<boolean> => {
    const intent = this.resolveUrlAutoMintIntent(null, propsIn);
    if (!intent) return false;

    const { currentSbtAddress, targetInvite, targetPassword, targetCode, shouldAttemptAuto, autoKey } = intent;
    const markAutoMintSuccess = () => {
      if (autoKey && typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(autoKey, 'done');
      }
    };

    if (targetCode && !shouldAttemptAuto) {
      if (this._isMounted)
        this.setState(
          buildSbtPagePasswordInputValuePatch({
            inputValue: targetCode,
          }),
        );
      return false;
    }

    if (!shouldAttemptAuto) {
      return false;
    }

    // Regression guard: URL auto-mint must keep using the address/session captured
    // from the original intent even if routing props change during metadata awaits.
    const targetSlug = this.getEffectiveSessionSlug();
    const targetAccountLower = String(this.props.account || '')
      .trim()
      .toLowerCase();
    const targetChainId = this.getMintTargetChainId();
    const currentSbtAddressString = String(currentSbtAddress || '');
    const isUrlAutoMintTargetCurrent = () =>
      this.isMintTargetContextCurrent({
        accountLower: targetAccountLower,
        chainId: targetChainId,
        sbtAddress: currentSbtAddress,
        sessionSlug: targetSlug,
      });

    if (!isUrlAutoMintTargetCurrent()) return false;

    if (!targetCode) {
      const minted = await this.autoMintPublicIfAllowed(currentSbtAddress, {
        accountLowerOverride: targetAccountLower,
        chainIdOverride: targetChainId,
        sessionSlugOverride: targetSlug,
      });
      if (minted) markAutoMintSuccess();
      return minted;
    }

    if (!isUrlAutoMintTargetCurrent()) return false;
    await new Promise<void>((resolve) => {
      if (this._isMounted) {
        this.setState(
          buildSbtPagePasswordInputValuePatch({
            inputValue: targetCode,
          }),
          resolve,
        );
      } else {
        resolve();
      }
    });

    if (targetInvite) {
      const minted = await this.claimWithInviteCode(targetInvite, currentSbtAddress, {
        accountLowerOverride: targetAccountLower,
        chainIdOverride: targetChainId,
        sessionSlugOverride: targetSlug,
      });
      if (minted) markAutoMintSuccess();
      return minted;
    }

    const slug = targetSlug;
    let sbtInfo: SbtPageInfoState | null = this.state.sbtInfo;
    if (!sbtInfo || typeof sbtInfo !== 'object') {
      try {
        sbtInfo = (await sbtMetadataReadsPort.getSbtMetadata(
          'none',
          currentSbtAddressString,
          slug,
        )) as SbtPageInfoState | null;
      } catch (_) {
        sbtInfo = null;
      }
      if (!isUrlAutoMintTargetCurrent()) return false;
      if (sbtInfo && this._isMounted) {
        this.setState(buildSbtPageSbtInfoPatch({ sbtInfo }));
      }
    }

    if (!isUrlAutoMintTargetCurrent()) return false;
    if (sbtInfo?.hasPasswordMint) {
      const minted = await this.claimWithGroupPassword(targetPassword, currentSbtAddress, {
        accountLowerOverride: targetAccountLower,
        chainIdOverride: targetChainId,
        sessionSlugOverride: slug,
      });
      if (minted) markAutoMintSuccess();
      return minted;
    }

    const onchainGph = await sbtMetadataReadsPort.getGroupPasswordHash('none', currentSbtAddressString, slug);
    if (!isUrlAutoMintTargetCurrent()) return false;
    if (onchainGph && onchainGph !== ethers.constants.HashZero) {
      const minted = await this.mintUnlimitedWithGroupPassword({
        accountLowerOverride: targetAccountLower,
        chainIdOverride: targetChainId,
        passwordOverride: targetPassword,
        sbtAddressOverride: currentSbtAddress,
        sessionSlugOverride: slug,
      });
      if (minted) markAutoMintSuccess();
      return minted;
    }

    if (!isUrlAutoMintTargetCurrent()) return false;
    if (this._isMounted) {
      this.setState(buildSbtPageMintFailurePatch({ error: `Invite code required for this ${t('sbt')}.` }));
    }
    return false;
  };

  resolveSessionSlugFromInfo = (info: unknown): string | null => {
    return resolveSbtPageSessionSlugFromInfo(info);
  };

  getExplicitSessionSlug = (props: SessionSlugPropsLike = this.props): string | null => {
    return getExplicitSbtPageSessionSlug(props);
  };

  getEffectiveSessionSlug = (): string => {
    return resolveSbtPageEffectiveSessionSlug({
      props: this.props,
      resolvedSessionSlug: this.state.resolvedSessionSlug,
      sbtInfo: this.state.sbtInfo,
    });
  };

  getSessionDisplayConfig = (sessionSlugRaw: unknown = this.getEffectiveSessionSlug()): SessionDisplayConfig | null => {
    return resolveSbtPageSessionDisplayConfig({
      getDemoSessionConfigBySlug,
      getSessionConfigBySlugOrDefault,
      sessionSlugRaw,
    }) as SessionDisplayConfig | null;
  };

  getSessionDisplayLabel = (sessionSlugRaw: unknown = this.getEffectiveSessionSlug()): string => {
    return resolveSbtPageSessionDisplayLabel({
      sessionConfig: this.getSessionDisplayConfig(sessionSlugRaw),
      sessionSlugRaw,
    });
  };

  getParentSessionScanProgress = (): ScanProgressRecord | null => {
    const progress = isRecord(this.props?.sbtScanProgress) ? this.props.sbtScanProgress : null;
    if (!progress) return null;

    const sessionSlug = this.getEffectiveSessionSlug();
    return buildSbtPageParentSessionScanProgress({
      progress,
      sessionConfig: this.getSessionDisplayConfig(sessionSlug),
      sessionLabel: this.getSessionDisplayLabel(sessionSlug),
      sessionSlug,
    }) as ScanProgressRecord | null;
  };

  getEffectiveHolderScanProgress = (): ScanProgressRecord | null => {
    return buildSbtPageEffectiveHolderScanProgress({
      getParentProgress: this.getParentSessionScanProgress,
      getSessionLabel: () => this.getSessionDisplayLabel(),
      getSessionSlug: this.getEffectiveSessionSlug,
      localProgress: this.state?.logScanProgress,
    }) as ScanProgressRecord | null;
  };

  isHolderScanActive = (): boolean =>
    resolveSbtPageHolderScanActive({
      hasActiveScanProgress: isActiveSbtPageScanProgress(this.getEffectiveHolderScanProgress()),
      loadingMintersBurners: this.state.loadingMintersBurners,
      loadingMintedFilter: this.state.loadingMintedFilter,
      sbtScanInProgress: this.props.sbtScanInProgress,
      sbtScanPending: this.props.sbtScanPending,
    });

  getSessionSBTAddresses = (): string[] => {
    const sessionSlug = this.getEffectiveSessionSlug();
    const sessionConfig = this.getSessionDisplayConfig(sessionSlug);
    const nextCache = buildSbtPageSessionSbtAddressesMemoState({
      previousAddresses: this._sessionSBTAddressesValue,
      previousCacheKey: this._sessionSBTAddressesKey,
      propSBTAddress: this.props?.SBTAddress,
      routeSbtAddress: this.props?.match?.params?.address,
      sessionConfig,
      sessionSlug,
      stateSbtAddress: this.state?.sbtAddress,
    });
    this._sessionSBTAddressesKey = nextCache.cacheKey;
    this._sessionSBTAddressesValue = nextCache.addresses;
    return nextCache.addresses;
  };

  refreshSbtDataWithSlug = (sbtAddress: unknown, options?: unknown, slugOverride: unknown = null): unknown | null => {
    if (!sbtAddress) return null;
    const slug = slugOverride != null ? slugOverride : this.getEffectiveSessionSlug();
    try {
      return this.props.refreshSbtData && this.props.refreshSbtData(sbtAddress, slug, options);
    } catch (_) {
      return null;
    }
  };

  isMintTargetContextCurrent = ({
    accountLower = '',
    chainId = null,
    sbtAddress = '',
    sessionSlug = null,
  }: {
    accountLower?: unknown;
    chainId?: unknown;
    sbtAddress?: unknown;
    sessionSlug?: unknown;
  } = {}): boolean => {
    const targetAddress = resolveSbtAddressString(sbtAddress);
    const currentAddress = resolveSbtAddressString(this.props.SBTAddress);
    if (!targetAddress || !currentAddress) return false;
    if (String(targetAddress).toLowerCase() !== String(currentAddress).toLowerCase()) return false;

    if (sessionSlug != null) {
      const targetSlug = String(sessionSlug || '');
      const currentSlug = String(this.getEffectiveSessionSlug() || '');
      if (targetSlug !== currentSlug) return false;
    }

    const targetAccount = String(accountLower || '')
      .trim()
      .toLowerCase();
    if (targetAccount) {
      const currentAccount = String(this.props.account || '')
        .trim()
        .toLowerCase();
      if (targetAccount !== currentAccount) return false;
    }

    if (chainId != null) {
      const targetChainId = String(chainId || '').trim();
      const currentChainId = this.getMintTargetChainId();
      if (!targetChainId || !currentChainId || targetChainId !== currentChainId) return false;
    }

    return true;
  };

  getMintTargetChainId = (): string => String(this.props.network?.id || this.props.networkChainId || '').trim();

  buildMintTargetKey = ({
    accountLower = '',
    chainId = null,
    sbtAddress = '',
    sessionSlug = null,
  }: {
    accountLower?: unknown;
    chainId?: unknown;
    sbtAddress?: unknown;
    sessionSlug?: unknown;
  } = {}): string =>
    [
      String(accountLower || '')
        .trim()
        .toLowerCase(),
      chainId == null ? '' : String(chainId || '').trim(),
      String(resolveSbtAddressString(sbtAddress) || '')
        .trim()
        .toLowerCase(),
      sessionSlug == null ? '' : String(sessionSlug || ''),
    ].join('|');

  buildListAutoMintTargetKey = (): string =>
    this.buildMintTargetKey({
      accountLower: String(this.props.account || '')
        .trim()
        .toLowerCase(),
      chainId: this.getMintTargetChainId(),
      sbtAddress: this.props.SBTAddress,
      sessionSlug: this.getEffectiveSessionSlug(),
    });

  hasAttemptedListMintForCurrentTarget = (): boolean => {
    const targetKey = this.buildListAutoMintTargetKey();
    return !!targetKey && this.hasAttemptedListMint && this._attemptedListMintTargetKey === targetKey;
  };

  markAttemptedListMintForCurrentTarget = (): void => {
    this._attemptedListMintTargetKey = this.buildListAutoMintTargetKey();
    this.hasAttemptedListMint = !!this._attemptedListMintTargetKey;
  };

  setMintPendingForTarget = ({
    accountLower = '',
    chainId = null,
    clearError = false,
    sbtAddress = '',
    sessionSlug = null,
  }: {
    accountLower?: unknown;
    chainId?: unknown;
    clearError?: unknown;
    sbtAddress?: unknown;
    sessionSlug?: unknown;
  } = {}): void => {
    this._activeMintPendingTargetKey = this.buildMintTargetKey({ accountLower, chainId, sbtAddress, sessionSlug });
    if (this._isMounted) this.setState(buildSbtPageMintPendingPatch({ clearError }));
  };

  clearMintPendingForTarget = ({
    accountLower = '',
    chainId = null,
    sbtAddress = '',
    sessionSlug = null,
  }: {
    accountLower?: unknown;
    chainId?: unknown;
    sbtAddress?: unknown;
    sessionSlug?: unknown;
  } = {}): void => {
    const targetKey = this.buildMintTargetKey({ accountLower, chainId, sbtAddress, sessionSlug });
    if (!targetKey || this._activeMintPendingTargetKey !== targetKey) return;
    this._activeMintPendingTargetKey = '';
    if (this._isMounted && this.state.mintingStatus === 'pending') {
      this.setState({ mintingStatus: 'idle' });
    }
  };

  // Regression guard: URL auto-mint transactions can finish after the route,
  // session, or wallet changes; only the captured target may receive local UI state.
  completeMintSuccessForTarget = async ({
    accountLower = '',
    chainId = null,
    clearManualPassword = false,
    forceEventRefreshOnSuccess = true,
    mintStep,
    sbtAddress = '',
    sessionSlug = null,
    txHash = '',
  }: {
    accountLower?: unknown;
    chainId?: unknown;
    clearManualPassword?: boolean;
    forceEventRefreshOnSuccess?: unknown;
    mintStep?: number;
    sbtAddress?: unknown;
    sessionSlug?: unknown;
    txHash?: unknown;
  } = {}): Promise<void> => {
    const txHashString = String(txHash || '');
    const isCurrentTarget = () =>
      this.isMintTargetContextCurrent({
        accountLower,
        chainId,
        sbtAddress,
        sessionSlug,
      });

    if (isCurrentTarget()) {
      await this.loadSBTInfo(forceEventRefreshOnSuccess);
    }

    if (isCurrentTarget()) {
      if (this._isMounted) {
        this.setState(
          buildSbtPageMintSuccessPatch({
            clearManualPassword,
            mintStep,
            txHash: txHashString,
          }),
        );
      }
      this.applyLocalMintSuccess(accountLower);
      this.clearAutoMintUrlIntent();
      this._activeMintPendingTargetKey = '';
    } else {
      this.clearMintPendingForTarget({ accountLower, chainId, sbtAddress, sessionSlug });
    }

    this.refreshSbtDataWithSlug(sbtAddress, undefined, sessionSlug);

    try {
      window.dispatchEvent(
        new CustomEvent('sbt-mint-success', {
          detail: { sbtAddress, txHash: txHashString },
        }),
      );
    } catch (e) {
      sbtLog.warn('SBTPage: telemetry', e);
    }
  };

  autoMintPublicIfAllowed = async (sbtAddress: unknown, options: SbtPageAutoMintOptions = {}): Promise<boolean> => {
    if (!sbtAddress) return false;
    const sbtAddressString = String(sbtAddress || '');

    const slug =
      options?.sessionSlugOverride != null ? String(options.sessionSlugOverride || '') : this.getEffectiveSessionSlug();
    const mintAccountLower =
      options?.accountLowerOverride != null
        ? String(options.accountLowerOverride || '')
            .trim()
            .toLowerCase()
        : String(this.props.account || '')
            .trim()
            .toLowerCase();
    const mintChainId =
      options?.chainIdOverride != null ? String(options.chainIdOverride || '').trim() : this.getMintTargetChainId();
    const isCurrentTarget = () =>
      this.isMintTargetContextCurrent({
        accountLower: mintAccountLower,
        chainId: mintChainId,
        sbtAddress,
        sessionSlug: slug,
      });
    if (!isCurrentTarget()) return false;

    const currentPropAddress = resolveSbtAddressString(this.props.SBTAddress);
    let sbtInfo: unknown =
      currentPropAddress && String(currentPropAddress).toLowerCase() === sbtAddressString.toLowerCase()
        ? this.state.sbtInfo
        : null;
    if (!sbtInfo || typeof sbtInfo !== 'object') {
      try {
        sbtInfo = await sbtMetadataReadsPort.getSbtMetadata('none', sbtAddressString, slug);
      } catch (_) {
        sbtInfo = null;
      }
      if (!isCurrentTarget()) return false;
      if (sbtInfo && this._isMounted) this.setState(buildSbtPageSbtInfoPatch({ sbtInfo }));
    }

    if (!sbtInfo) {
      if (!isCurrentTarget()) return false;
      if (this._isMounted)
        this.setState(buildSbtPageMintFailurePatch({ error: `Unable to load ${t('sbt')} metadata.` }));
      return false;
    }

    const sbtInfoRecord = isRecord(sbtInfo) ? sbtInfo : {};
    let onchainGph: unknown = null;
    try {
      onchainGph = await sbtMetadataReadsPort.getGroupPasswordHash('none', sbtAddressString, slug);
    } catch (_) {
      onchainGph = null;
    }
    if (!isCurrentTarget()) return false;

    if (sbtInfoRecord.hasPasswordMint) {
      if (this._isMounted)
        this.setState(buildSbtPageMintFailurePatch({ error: `Password required for this ${t('sbt')}.` }));
      return false;
    }
    if (onchainGph && onchainGph !== ethers.constants.HashZero) {
      if (this._isMounted)
        this.setState(buildSbtPageMintFailurePatch({ error: `Group password required for this ${t('sbt')}.` }));
      return false;
    }

    return await this.handleMint(true, {
      accountLowerOverride: options?.accountLowerOverride,
      chainIdOverride: mintChainId,
      sbtAddressOverride: sbtAddress,
      sessionSlugOverride: slug,
      sbtInfoOverride: sbtInfo,
    });
  };

  handleGroupPasswordInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value.replace(/\s+/g, '');
    this.setState(buildSbtPagePasswordInputValuePatch({ inputValue: value }));
  };

  handleManualPasswordInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState(
      buildSbtPagePasswordInputValuePatch({
        inputField: 'manualPasswordInput',
        inputValue: event.target.value,
      }),
    );
  };

  claimWithInvitePayload = async (
    payload: SbtPageInviteClaimPayload | null | undefined,
    sbtOverride?: unknown,
    options: SbtPageInviteClaimOptions = {},
  ): Promise<SbtPageInviteClaimResult> => {
    let sbt = '';
    let slug = '';
    let mintAccountLower = '';
    let mintChainId = '';
    try {
      if (!this.props.account) {
        this.props.toggleLoginModal(true);
        return { ok: false, error: new Error(`${t('wallet')} not connected`) };
      }
      if (!payload || payload.nonce == null || !payload.signature) {
        if (this._isMounted && !options.suppressErrors) {
          this.setState(buildSbtPageMintFailurePatch({ error: 'Invalid invite code.' }));
        }
        return { ok: false, error: new Error('Invalid invite code.') };
      }

      sbt = String(sbtOverride || resolveSbtAddressString(this.props.SBTAddress) || '');

      if (!sbt) return { ok: false, error: new Error(`Missing ${t('sbt')} address`) };

      slug =
        options?.sessionSlugOverride != null
          ? String(options.sessionSlugOverride || '')
          : this.getEffectiveSessionSlug();
      mintAccountLower =
        options?.accountLowerOverride != null
          ? String(options.accountLowerOverride || '')
              .trim()
              .toLowerCase()
          : String(this.props.account || '')
              .trim()
              .toLowerCase();
      mintChainId =
        options?.chainIdOverride != null ? String(options.chainIdOverride || '').trim() : this.getMintTargetChainId();

      if (
        !this.isMintTargetContextCurrent({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          sbtAddress: sbt,
          sessionSlug: slug,
        })
      ) {
        return { ok: false, error: new Error('Mint context changed before send.') };
      }
      this.setMintPendingForTarget({
        accountLower: mintAccountLower,
        chainId: mintChainId,
        clearError: true,
        sbtAddress: sbt,
        sessionSlug: slug,
      });
      const tx = await sbtMintExecutionPort.claimWithInvite(
        this.props.provider,
        sbt,
        String(payload.nonce),
        String(payload.signature),
      );

      await this.completeMintSuccessForTarget({
        accountLower: mintAccountLower,
        chainId: mintChainId,
        forceEventRefreshOnSuccess: true,
        sbtAddress: sbt,
        sessionSlug: slug,
        txHash: tx.transactionHash,
      });
      return { ok: true, tx };
    } catch (error) {
      inviteLog.error('[INVITE] claimWithInvite failed:', error);
      if (
        this._isMounted &&
        !options.suppressErrors &&
        this.isMintTargetContextCurrent({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          sbtAddress: sbt,
          sessionSlug: slug,
        })
      ) {
        this.setState(buildSbtPageMintFailurePatch({ error: getErrorMessage(error, 'Invite claim failed.') }));
      }
      return { ok: false, error };
    }
  };

  claimWithGroupPassword = async (
    rawPassword: unknown,
    sbtOverride?: unknown,
    options: SbtPageGroupPasswordClaimOptions = {},
  ): Promise<boolean> => {
    let sbt = '';
    let slug = '';
    let mintAccountLower = '';
    let mintChainId = '';
    try {
      if (!this.props.account) {
        this.props.toggleLoginModal(true);
        return false;
      }
      const password = cryptoUtils.normalizeGroupPasswordInput(rawPassword);
      if (!password) {
        if (this._isMounted) this.setState(buildSbtPageMintFailurePatch({ error: 'Group password is required.' }));
        return false;
      }

      sbt = String(sbtOverride || resolveSbtAddressString(this.props.SBTAddress) || '');

      if (!sbt) return false;

      slug =
        options?.sessionSlugOverride != null
          ? String(options.sessionSlugOverride || '')
          : this.getEffectiveSessionSlug();
      mintAccountLower =
        options?.accountLowerOverride != null
          ? String(options.accountLowerOverride || '')
              .trim()
              .toLowerCase()
          : String(this.props.account || '')
              .trim()
              .toLowerCase();
      mintChainId =
        options?.chainIdOverride != null ? String(options.chainIdOverride || '').trim() : this.getMintTargetChainId();
      let sbtInfo = this.state.sbtInfo;
      if (!sbtInfo || typeof sbtInfo !== 'object') sbtInfo = {};

      if (
        !this.isMintTargetContextCurrent({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          sbtAddress: sbt,
          sessionSlug: slug,
        })
      ) {
        return false;
      }

      let onchainHash =
        options?.groupPasswordHashOverride || (sbtOverride ? null : this.state.groupPasswordHash) || null;
      if (!onchainHash) {
        try {
          onchainHash = await sbtMetadataReadsPort.getGroupPasswordHash('none', sbt, slug);
        } catch (e) {
          sbtLog.warn('SBTPage: fallback', e);
        }
      }
      if (
        !this.isMintTargetContextCurrent({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          sbtAddress: sbt,
          sessionSlug: slug,
        })
      ) {
        return false;
      }
      let walletScopeSbtAddress: string | null = sbt;
      if (onchainHash && onchainHash !== ethers.constants.HashZero) {
        walletScopeSbtAddress = cryptoUtils.resolveGroupPasswordWalletScopeAddress({
          password,
          sbtAddress: sbt,
          groupPasswordHash: onchainHash,
        });
        const localHash =
          walletScopeSbtAddress === null
            ? null
            : sbtGroupMintAuthorizationPort.computeGroupPasswordHash({
                password,
                sbtAddress: walletScopeSbtAddress,
              });
        inviteLog.log('[INVITE_DEBUG v4] local groupPasswordHash:', localHash);
        inviteLog.log('[INVITE_DEBUG v4] on-chain groupPasswordHash:', onchainHash);
        if (!localHash || String(localHash).toLowerCase() !== String(onchainHash).toLowerCase()) {
          if (this._isMounted) {
            this.setState(buildSbtPageMintFailurePatch({ error: 'Group password mismatch.' }));
          }
          return false;
        }
      }

      let maxTokens: ethers.BigNumber | null = null;
      try {
        const rawMax = sbtInfo?.maxTokens;
        if (rawMax !== undefined && rawMax !== null && rawMax !== '' && rawMax !== '0') {
          maxTokens = ethers.BigNumber.from(rawMax);
        }
      } catch (_) {
        maxTokens = null;
      }

      const maxAttempts = 3;
      let lastError: unknown = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (
          !this.isMintTargetContextCurrent({
            accountLower: mintAccountLower,
            chainId: mintChainId,
            sbtAddress: sbt,
            sessionSlug: slug,
          })
        ) {
          return false;
        }
        let mintedTokens: unknown = null;
        try {
          mintedTokens = await sbtMetadataReadsPort.getMintedTokens('none', sbt, slug);
        } catch (_) {
          mintedTokens = null;
        }
        if (
          !this.isMintTargetContextCurrent({
            accountLower: mintAccountLower,
            chainId: mintChainId,
            sbtAddress: sbt,
            sessionSlug: slug,
          })
        ) {
          return false;
        }

        if (mintedTokens === null) {
          if (this._isMounted) this.setState(buildSbtPageMintFailurePatch({ error: 'Unable to load minted count.' }));
          return false;
        }

        let mintedBig: ethers.BigNumber | null = null;
        try {
          mintedBig = ethers.BigNumber.from(mintedTokens);
        } catch (_) {
          mintedBig = null;
        }

        if (mintedBig === null) {
          if (this._isMounted) this.setState(buildSbtPageMintFailurePatch({ error: 'Unable to parse minted count.' }));
          return false;
        }

        if (maxTokens && mintedBig.gte(maxTokens)) {
          if (this._isMounted) this.setState(buildSbtPageMintFailurePatch({ error: 'Group limit reached.' }));
          return false;
        }

        const nonce = mintedBig.add(1).toString();
        const invites = await sbtGroupMintAuthorizationPort.generateInvitePayloads({
          password,
          sbtAddress: sbt,
          nonces: [nonce],
          walletScopeSbtAddress,
        });
        if (
          !this.isMintTargetContextCurrent({
            accountLower: mintAccountLower,
            chainId: mintChainId,
            sbtAddress: sbt,
            sessionSlug: slug,
          })
        ) {
          return false;
        }
        const payload = invites && invites[0];
        if (!payload) {
          if (this._isMounted) this.setState(buildSbtPageMintFailurePatch({ error: 'Failed to generate invite.' }));
          return false;
        }

        const suppressErrors = attempt < maxAttempts - 1;
        const result = await this.claimWithInvitePayload(payload, sbt, {
          accountLowerOverride: mintAccountLower,
          chainIdOverride: mintChainId,
          suppressErrors,
          sessionSlugOverride: slug,
        });
        if (result && result.ok) return true;

        lastError = result?.error || new Error('Invite claim failed.');
        if (
          !this.isMintTargetContextCurrent({
            accountLower: mintAccountLower,
            chainId: mintChainId,
            sbtAddress: sbt,
            sessionSlug: slug,
          })
        ) {
          return false;
        }

        let mintedAfter: unknown = null;
        try {
          mintedAfter = await sbtMetadataReadsPort.getMintedTokens('none', sbt, slug);
        } catch (_) {
          mintedAfter = null;
        }

        let mintedAfterBig: ethers.BigNumber | null = null;
        try {
          mintedAfterBig = mintedAfter !== null ? ethers.BigNumber.from(mintedAfter) : null;
        } catch (_) {
          mintedAfterBig = null;
        }
        if (
          !this.isMintTargetContextCurrent({
            accountLower: mintAccountLower,
            chainId: mintChainId,
            sbtAddress: sbt,
            sessionSlug: slug,
          })
        ) {
          return false;
        }

        if (mintedAfterBig === null || mintedAfterBig.lte(mintedBig)) {
          if (this._isMounted && suppressErrors) {
            this.setState(buildSbtPageMintFailurePatch({ error: getErrorMessage(lastError, 'Invite claim failed.') }));
          }
          return false;
        }
      }
    } catch (error) {
      inviteLog.error('[INVITE] claimWithGroupPassword failed:', error);
      if (
        this._isMounted &&
        this.isMintTargetContextCurrent({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          sbtAddress: sbt,
          sessionSlug: slug,
        })
      ) {
        this.setState(buildSbtPageMintFailurePatch({ error: getErrorMessage(error, 'Invite claim failed.') }));
      }
      return false;
    }
    return false;
  };

  claimWithInviteCode = async (
    rawCode: unknown,
    sbtOverride?: unknown,
    options: SbtPageGroupPasswordClaimOptions = {},
  ): Promise<boolean> => {
    const payload = this.decodeInviteInput(rawCode);
    if (payload) {
      const result = await this.claimWithInvitePayload(payload, sbtOverride, options);
      return !!result?.ok;
    }
    return await this.claimWithGroupPassword(rawCode, sbtOverride, options);
  };

  // Helpers
  getMemoizedNetHoldersList = (mintsArr: unknown = [], burnsArr: unknown = []): string[] => {
    const { memo, netHolders } = buildSbtPageNetHoldersMemoState({
      buildHolderListSignature: buildSbtPageHolderListSignature,
      burnedAddresses: burnsArr,
      computeNetHoldersList: (mintedRef, burnedRef) =>
        measureSync('ce.sbtPage.computeNetHoldersList', () => computeSbtPageNetHoldersList(mintedRef, burnedRef)),
      memo: this._netHoldersMemo,
      mintedAddresses: mintsArr,
    });
    this._netHoldersMemo = memo;
    return netHolders;
  };

  buildAddressListSignature = (list: unknown = []): string => {
    const { memo, signature } = buildSbtPageAddressListSignatureMemoState({
      buildAddressListSignature: (entries) =>
        measureSync('ce.sbtPage.filteredMintedUsersSignature', () => buildSbtPageHolderListSignature(entries)),
      list,
      memo: this._filteredMintedUsersSignatureMemo,
    });
    this._filteredMintedUsersSignatureMemo = memo;
    return signature;
  };

  buildNextFilteredHolderRows = ({
    prevFilteredRows = [],
    prevNetHolders = [],
    nextNetHolders = [],
    replaceRows = false,
  }: BuildNextFilteredHolderRowsArgs = {}): string[] => {
    return buildSbtPageNextFilteredHolderRows(
      {
        prevFilteredRows,
        prevNetHolders,
        nextNetHolders,
        replaceRows,
      },
      this.buildAddressListSignature,
    );
  };

  // Regression guard: once holder rows are visible for the active SBT/network, only a
  // resolved replacement set or per-address burn evidence may remove them.
  reconcileHolderRefreshState = (args: ReconcileSbtPageHolderRefreshStateArgs): ReconciledSbtPageHolderRefreshState =>
    reconcileSbtPageHolderRefreshState({
      ...args,
      buildAddressListSignature: this.buildAddressListSignature,
      buildNextFilteredHolderRows: this.buildNextFilteredHolderRows,
    });

  handleModalFilteredMintedUsers = (filtered: unknown): void => {
    if (!this._isMounted) return;
    const nextPatch = buildSbtPageModalFilteredMintedUsersPatch({
      buildAddressListSignature: this.buildAddressListSignature,
      filtered,
      isHolderScanActive: this.isHolderScanActive(),
      state: this.state,
    });
    if (nextPatch) this.setState(nextPatch);
  };

  applyLocalMintSuccess = (addrLower: unknown): void => {
    const addr = String(addrLower || '').toLowerCase();
    if (!this._isMounted || !addr) return;
    this.setState((prev: HolderRefreshStateLike) => {
      const nextPatch = buildSbtPageLocalMintSuccessPatch({ addrLower: addr, prevState: prev });
      return nextPatch || {};
    });
  };

  applyLocalBurnSuccess = (addrLower: unknown): void => {
    const addr = String(addrLower || '').toLowerCase();
    if (!this._isMounted || !addr) return;
    this.setState((prev: HolderRefreshStateLike) => {
      const nextPatch = buildSbtPageLocalBurnSuccessPatch({
        addrLower: addr,
        buildAddressListSignature: this.buildAddressListSignature,
        buildNextFilteredHolderRows: this.buildNextFilteredHolderRows,
        prevState: prev,
      });
      return nextPatch || {};
    });
  };

  toggleFullImage = (): void => {
    if (this._isMounted) {
      this.setState((prevState: HolderRefreshStateLike) =>
        buildSbtPageBooleanTogglePatch({
          state: prevState,
          stateKey: 'showFullImage',
        }),
      );
    }
  };

  async attemptMintWithPasswordList(passwordList: unknown): Promise<void> {
    let sbtAddressOriginalCase = '';
    let targetSlug = '';
    let targetAccountLower = '';
    let targetChainId = '';
    const isCurrentTarget = () =>
      this.isMintTargetContextCurrent({
        accountLower: targetAccountLower,
        chainId: targetChainId,
        sbtAddress: sbtAddressOriginalCase,
        sessionSlug: targetSlug,
      });
    const applyMintInputForTarget = (inputField: string, inputValue: string) =>
      new Promise<boolean>((resolve) => {
        if (!this._isMounted || !isCurrentTarget()) {
          resolve(false);
          return;
        }
        this.setState(
          buildSbtPagePasswordMintInputPatch({
            inputField,
            inputValue,
          }),
          () => resolve(isCurrentTarget()),
        );
      });

    try {
      if (!Array.isArray(passwordList) || passwordList.length === 0) return;
      const passwordTokens = passwordList as string[];

      const { provider } = this.props;
      sbtAddressOriginalCase = resolveSbtAddressString(this.props.SBTAddress);
      targetSlug = this.getEffectiveSessionSlug();
      targetAccountLower = String(this.props.account || '')
        .trim()
        .toLowerCase();
      targetChainId = this.getMintTargetChainId();

      if (!sbtAddressOriginalCase || !provider || !targetAccountLower || !targetChainId) return;
      if (!isCurrentTarget()) return;

      const targetOptions = {
        accountLowerOverride: targetAccountLower,
        chainIdOverride: targetChainId,
        sessionSlugOverride: targetSlug,
      };

      let chosen: string | null = null;
      let inviteToken: string | null = null;
      for (const token of passwordTokens) {
        const payload = this.decodeInviteInput(token);
        if (payload) {
          inviteToken = token;
          break;
        }
      }

      if (inviteToken) {
        const didApply = await applyMintInputForTarget('groupPasswordInput', inviteToken);
        if (!didApply) return;

        if (!isCurrentTarget()) return;
        await this.claimWithInviteCode(inviteToken, sbtAddressOriginalCase, targetOptions);
        return;
      }

      if (this.state.hasInviteMint) {
        const fallbackPassword = passwordTokens[0];
        if (fallbackPassword) {
          const didApply = await applyMintInputForTarget('groupPasswordInput', fallbackPassword);
          if (!didApply) return;
          if (!isCurrentTarget()) return;
          await this.claimWithGroupPassword(fallbackPassword, sbtAddressOriginalCase, targetOptions);
          return;
        }
      }

      for (const token of passwordTokens) {
        const hashed = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(token));
        let ok = false;
        try {
          ok = await sbtAdminOpsPort.isPasswordValid(provider, sbtAddressOriginalCase, hashed, targetSlug);
        } catch {
          ok = false;
        }
        if (!isCurrentTarget()) return;
        if (ok) {
          chosen = token;
          break;
        }
      }

      if (!chosen) {
        if (this._isMounted && isCurrentTarget()) {
          this.setState(buildSbtPageErrorPatch({ error: 'All claim codes have been used.' }));
        }
        return;
      }

      const didApply = await applyMintInputForTarget('manualPasswordInput', chosen);
      if (!didApply) return;

      if (!isCurrentTarget()) return;
      await this.handleMint(false, {
        ...targetOptions,
        sbtAddressOverride: sbtAddressOriginalCase,
      });
      if (this.state.mintingStatus !== 'success') {
        // Rare race: if it failed after check, fall through silently (the UI already shows error)
      }
    } catch (err) {
      if (this._isMounted && isCurrentTarget()) {
        this.setState(buildSbtPageErrorPatch({ error: getErrorMessage(err, 'Failed to mint with provided codes.') }));
      }
    }
  }

  loadCachedPasswords = async (): Promise<void> => {
    const loadId = ++this._passwordRecoveryLoadId;
    const snapshot = await loadSbtRecoverySnapshot({
      chainId: this.getRecoveryCacheChainId(),
      sbtAddress: resolveSbtAddress(this.props.SBTAddress),
    });
    if (this._isMounted && loadId === this._passwordRecoveryLoadId) this.setState(snapshot);
  };

  openMintedModal = (): void => {
    if (this._isMounted)
      this.setState(buildSbtPageMintedModalVisibilityPatch({ visible: true }), () => {
        if (this._isMounted) {
          const netHolders = this.getMemoizedNetHoldersList(this.state.mintedAddresses, this.state.burnedAddresses);
          this.setState(
            buildSbtPageMintedModalInitialFilterPatch({
              buildAddressListSignature: this.buildAddressListSignature,
              netHolders,
            }),
          );
        }
        // One-shot explicit event scan when the user opens the holders modal.
        // This triggers 'loadingMintersBurners' -> true, updating the spinner state in header.
        this.loadSBTInfo({ forceEventFetch: true, preferCountsOnly: true });
      });
  };

  closeModal = (): void => {
    if (this._isMounted) this.setState(buildSbtPageMintedModalVisibilityPatch());
    // Allow another one-shot scan next time modal is opened
    this._eventScanTried = {};
  };

  closeDocModal = (): void => {
    const blobUrl = this.state.docModalBlobUrl;
    if (blobUrl && typeof URL !== 'undefined') {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch (e) {
        sbtLog.warn('SBTPage: cleanup', e);
      }
    }
    if (this._isMounted) {
      this.setState(buildSbtPageDocModalResetPatch());
    }
  };

  getActiveLitHooks = (): SbtPageLitHooks | null =>
    ((this.props.litHooks && typeof this.props.litHooks === 'object' ? this.props.litHooks : null) ||
      getGlobalLitHooks()) as SbtPageLitHooks | null;

  openEncryptedDoc = async (url: unknown): Promise<void> => {
    if (!litStorage.isLitArweaveUrl(url)) return;
    const litHooks = this.getActiveLitHooks();
    if (!litHooks || typeof litHooks.getKey !== 'function') {
      if (this._isMounted) {
        this.setState(
          buildSbtPageDocModalOpenPatch({
            error: `Connect a ${t('walletLower')} to decrypt this document.`,
            name: 'Encrypted document',
          }),
        );
      }
      return;
    }

    if (this._isMounted) {
      this.setState(
        buildSbtPageDocModalOpenPatch({
          loading: true,
          name: 'Decrypting…',
        }),
      );
    }

    try {
      const { payload } = await litStorage.downloadEncryptedArweaveData({
        url,
        providerLike: this.props.provider,
        account: this.props.account,
        chainId: this.props.network?.id || null,
        lit: { getKey: litHooks.getKey },
      });

      const name = payload && payload.name ? String(payload.name) : 'Encrypted document';
      const text = litStorage.decodeLitPayloadToText(payload);
      let blobUrl = '';
      if (!text) {
        const blob = litStorage.decodeLitPayloadToBlob(payload);
        if (blob && typeof URL !== 'undefined') {
          blobUrl = URL.createObjectURL(blob);
        }
      }

      if (this._isMounted) {
        this.setState(
          buildSbtPageDocModalContentPatch({
            error: !text && !blobUrl ? 'Unable to decode encrypted document.' : '',
            content: text || '',
            name,
            blobUrl,
          }),
        );
      }
    } catch (err) {
      if (this._isMounted) {
        this.setState(
          buildSbtPageDocModalErrorPatch({
            error: getErrorMessage(err, 'Failed to decrypt document.'),
          }),
        );
      }
    }
  };

  toggleStats = (): void => {
    if (this._isMounted)
      this.setState((prevState: { showStats?: unknown }) =>
        buildSbtPageBooleanTogglePatch({
          state: prevState,
          stateKey: 'showStats',
        }),
      );
  };

  toggleActions = (): void => {
    if (this._isMounted)
      this.setState((prevState: { showActions?: unknown }) =>
        buildSbtPageBooleanTogglePatch({
          state: prevState,
          stateKey: 'showActions',
        }),
      );
  };

  toggleMoreDetails = (): void => {
    if (this._isMounted)
      this.setState((prevState: { showMoreDetails?: unknown }) =>
        buildSbtPageBooleanTogglePatch({
          state: prevState,
          stateKey: 'showMoreDetails',
        }),
      );
  };

  toggleAdminSection = (): void => {
    if (this._isMounted)
      this.setState((prevState: { showAdminSection?: unknown }) =>
        buildSbtPageBooleanTogglePatch({
          state: prevState,
          stateKey: 'showAdminSection',
        }),
      );
  };

  renderAddressLink = (address: unknown, key = 'contract'): React.ReactNode => {
    const { isRenderable, normalized } = resolveSbtPageAddressLinkState({
      address,
      zeroAddress: ethers.constants.AddressZero,
    });
    if (!isRenderable) return 'N/A';
    const shortenedAddress = getShortenedAddress(normalized, false);
    const copyIconState = resolveSbtPageCopyIconState({
      copiedAddress: this.state.copiedAddress,
      targetKey: key,
    });
    return (
      <>
        <a href={buildPublicRoute(`/u/${normalized}`)} target="_blank" rel="noopener noreferrer">
          {shortenedAddress}
        </a>
        <button onClick={() => this.copyToClipboard(normalized, key)} className={styles.copyButton}>
          {copyIconState.shouldRenderCopiedIcon && <FontAwesomeIcon icon={faCheck} />}
          {copyIconState.shouldRenderDefaultIcon && <FontAwesomeIcon icon={faCopy} />}
        </button>
        <a
          href={this.getExplorerUrl(normalized)}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.expandButton}
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} />
        </a>
      </>
    );
  };

  getOpenMintAutoJoinUrl = (addressOverride: unknown = null): string => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? String(window.location.origin).replace(/\/+$/, '')
        : '';
    return buildSbtPageOpenMintAutoJoinUrl({
      addressOverride,
      basePath: readPublicUrlBasePath(),
      groupPasswordHash: this.state.groupPasswordHash,
      hasGroupPasswordMint: this.state.hasGroupPasswordMint,
      hasInviteMint: this.state.hasInviteMint,
      origin,
      propSBTAddress: this.props.SBTAddress,
      sbtInfo: this.state.sbtInfo,
      sessionSlug: this.getEffectiveSessionSlug(),
    });
  };

  // Keep SBT artwork resilient when the preferred Arweave gateway flakes out mid-load.
  handleDisplayImageError = ({
    sourceKey = '',
    activeIndex = 0,
    candidates = [],
  }: SbtPageDisplayImageErrorArgs = {}): void => {
    const maxIndex = getDisplayImageFallbackCandidateCount(candidates);
    if (activeIndex >= maxIndex) return;
    this.setState((prevState: { displayImageFallbackKey?: unknown; displayImageFallbackIndex?: unknown }) =>
      getNextDisplayImageFallbackState({ activeIndex, maxIndex, sourceKey }, prevState),
    );
  };

  getLoadSbtInfoRequestKey = (): string => {
    const activeSlug = this.getExplicitSessionSlug() ?? '';
    const currentNetwork = this.state.network || this.props.network;
    return buildSbtPageLoadInfoRequestKey({
      account: this.props.account,
      activeSlug,
      network: currentNetwork,
      sbtAddressInput: this.props.SBTAddress,
      sbtCacheRevision: this.props.sbtCacheRevision,
    });
  };

  isCurrentLoadSbtInfoRequest = (requestKey: unknown): boolean =>
    !!requestKey && requestKey === this._latestLoadSbtInfoRequestKey;

  fetchHolderAddressesByTokenOwnership = async (
    sbtAddress: unknown,
    sessionSlug: unknown,
    mintedCountRaw: unknown,
  ): Promise<string[]> => {
    const mintedCount = Math.floor(Number(mintedCountRaw || 0));
    if (!Number.isFinite(mintedCount) || mintedCount <= 0) return [];
    const MAX_OWNER_LOOKUPS = 512;
    if (mintedCount > MAX_OWNER_LOOKUPS) {
      sbtLog.warn('[SBTPage] skipping ownerOf fallback due large minted count', {
        sbtAddress,
        mintedCount,
        maxLookups: MAX_OWNER_LOOKUPS,
      });
      return [];
    }
    const zero = String(ethers.constants.AddressZero || '').toLowerCase();
    const holders = new Set<string>();
    const sbtAddressForLookup = String(sbtAddress || '').trim();
    const probeOwnerByTokenId = async (tokenId: number): Promise<void> => {
      let owner: unknown = null;
      try {
        owner = await sbtOwnershipReadsPort.getOwnerByTokenId('none', sbtAddressForLookup, tokenId, sessionSlug);
      } catch (_) {
        owner = null;
      }
      const normalized = String(owner || '')
        .trim()
        .toLowerCase();
      if (!normalized || normalized === zero) return;
      if (!ethers.utils.isAddress(normalized)) return;
      holders.add(normalized);
    };
    // Probe canonical one-based ids first (CustomSBT), then also probe tokenId 0 for zero-based legacy contracts.
    const BATCH_SIZE = 10;
    for (let i = 1; i <= mintedCount; i += BATCH_SIZE) {
      const batch: Promise<void>[] = [];
      for (let j = i; j < Math.min(i + BATCH_SIZE, mintedCount + 1); j += 1) {
        batch.push(probeOwnerByTokenId(j));
      }
      await Promise.all(batch);
    }
    await probeOwnerByTokenId(0);
    return Array.from(holders).sort();
  };

  // Load SBT info. Always signal loading state so render() can decide whether
  // to show a full placeholder (first load) or a subtle indicator (refresh).

  async loadSBTInfo(optionsOrForce: unknown = false): Promise<void> {
    const loadOptions = normalizeSbtPageLoadInfoOptions(optionsOrForce);
    const { forceEventFetch, preferCountsOnly } = loadOptions;
    const currentNetwork = this.state.network || this.props.network;

    // Resolve address
    const sbtAddressOriginalCase = resolveSbtAddressString(this.props.SBTAddress);
    const requestKey = this.getLoadSbtInfoRequestKey();
    this._latestLoadSbtInfoRequestKey = requestKey;
    const isCurrentLoad = () => this.isCurrentLoadSbtInfoRequest(requestKey);

    if (this._loadSbtInfoInFlight) {
      const pendingQueuePlan = resolveSbtPageLoadInfoPendingQueuePlan({
        forceEventFetch,
        pendingForce: this._loadSbtInfoPendingForce,
        pendingOptions: this._loadSbtInfoPendingOptions,
        preferCountsOnly,
      });
      this._loadSbtInfoPending = pendingQueuePlan.shouldQueueLoad;
      this._loadSbtInfoPendingOptions = pendingQueuePlan.pendingOptions;
      this._loadSbtInfoPendingForce = pendingQueuePlan.pendingForce;
      return;
    }

    if (!sbtAddressOriginalCase) {
      if (this._isMounted) this.setState(buildSbtPageLoadingMintersBurnersPatch());
      return;
    }
    this._loadSbtInfoInFlight = true;
    const addrLower = sbtAddressOriginalCase.toLowerCase();
    const normalizedExplicitSlug = this.getExplicitSessionSlug();
    const hasExplicitSlug = normalizedExplicitSlug != null;
    const initialSlug = hasExplicitSlug ? normalizedExplicitSlug : this.getEffectiveSessionSlug();
    const logContext = buildSbtPageLoadInfoStartLogContext({
      account: this.props.account,
      addrLower,
      forceEventFetch,
      initialSlug,
      network: currentNetwork,
      normalizedExplicitSlug,
      preferCountsOnly,
      sbtAddressOriginalCase,
    });
    sbtLog.info('[SBTPage] loadSBTInfo:start', logContext);

    const fillFromChainIfMissing = async (
      infoIn: unknown,
      addr: unknown,
      slugForRead: unknown,
    ): Promise<SbtPageMetadataInfoLike> => {
      const info = isRecord(infoIn) ? ({ ...infoIn } as SbtPageMetadataInfoLike) : {};
      const zeroAddress = String(ethers.constants.AddressZero || '').toLowerCase();
      const { needAdmin, needBurn, needEnd, needHasPw, needMax, shouldRead } = resolveSbtPageChainMetadataReadNeeds({
        info,
        zeroAddress,
      });
      if (!shouldRead) {
        return info;
      }
      try {
        const { maxTokens, collectionBurnAuth, mintingEndTime, hasPasswordMint, admin, owner } =
          await sbtMetadataReadsPort.getSbtOnChainConfig('none', String(addr || ''), slugForRead, {
            maxTokens: needMax,
            collectionBurnAuth: needBurn,
            mintingEndTime: needEnd,
            hasPasswordMint: needHasPw,
            adminAndOwner: needAdmin,
          });
        if (needMax && maxTokens != null) {
          info.maxTokens = ethers.BigNumber.isBigNumber(maxTokens) ? maxTokens.toString() : String(maxTokens);
        }
        if (needBurn && collectionBurnAuth != null) {
          info.burnAuth = Number(
            ethers.BigNumber.isBigNumber(collectionBurnAuth) ? collectionBurnAuth.toNumber() : collectionBurnAuth,
          );
          info.burnAuthVerifiedOnChain = true;
          delete info.burnAuthNeedsOnChainRefresh;
        }
        if (needEnd && mintingEndTime != null) {
          info.mintingEndTime = coerceSbtPageEpochSeconds(
            ethers.BigNumber.isBigNumber(mintingEndTime) ? mintingEndTime.toNumber() : Number(mintingEndTime),
          );
        }
        if (needHasPw && hasPasswordMint != null) info.hasPasswordMint = !!hasPasswordMint;
        Object.assign(
          info,
          buildSbtPageAdminFallbackPatch({
            adminAddress: needAdmin ? admin : null,
            existingCreator: info.creator,
            existingDeployer: info.deployer,
            ownerAddress: needAdmin ? owner : null,
            zeroAddress,
          }),
        );
      } catch (e) {
        sbtLog.warn('SBTPage: fallback', e);
      }
      return info;
    };

    const readCacheForSlug = async (slugForCache: unknown, netKeyForCache: unknown): Promise<SbtPageCacheByNet> => {
      return readSbtPageCacheBySlug({
        netKeyForCache,
        readCache,
        slugForCache,
      }) as Promise<SbtPageCacheByNet>;
    };

    const needsTokenUriFields = needsSbtPageTokenUriFields;
    const needsDirectMetadataHydration = needsSbtPageDirectMetadataHydration;

    const findCachedEntryAcrossGroups = ({
      excludeSlug = null,
    }: SbtPageCacheLookupArgs = {}): SbtPageCachedEntryHit | null => {
      return findSbtPageCachedEntryAcrossGroups({
        addressLower: addrLower,
        excludeSlug,
        listNamespaceEntriesSync,
      }) as SbtPageCachedEntryHit | null;
    };

    const deriveNetKeyForSlug = (slugForCache: unknown, netKeyHint: unknown = null, infoHint: unknown = null): string =>
      deriveSbtPageCacheNetKey({
        currentNetwork,
        getSessionChainId,
        infoHint,
        netKeyHint,
        slugForCache,
      });
    const buildDirectMetadataContext = (
      slugForRead: unknown,
      netKeyHint: unknown = null,
      infoHint: unknown = null,
    ): SbtPageDirectMetadataContext | string =>
      buildSbtPageDirectMetadataContext({
        currentNetwork,
        getSessionChainId,
        infoHint,
        netKeyHint,
        slugForRead,
      }) as SbtPageDirectMetadataContext | string;

    const syncResolvedSessionSlug = (slugToSync: unknown): void => {
      if (!this._isMounted || !isCurrentLoad()) return;
      const targetSlug = hasExplicitSlug ? normalizedExplicitSlug : slugToSync;
      if (this.state.resolvedSessionSlug !== targetSlug) {
        this.setState(buildSbtPageResolvedSessionSlugPatch({ slug: targetSlug }));
      }
    };

    // Signal loading start (allows render() to choose between placeholder or subtle spinner)
    if (this._isMounted) {
      this.setState(
        buildSbtPageLoadInfoLoadingStartPatch({
          hasExplicitSlug,
          normalizedExplicitSlug,
        }),
      );
    }

    try {
      let cacheHit = hasExplicitSlug ? null : findCachedEntryAcrossGroups();
      let resolvedSlug = hasExplicitSlug ? normalizedExplicitSlug : cacheHit?.slug || initialSlug;
      let netIdStr = deriveNetKeyForSlug(resolvedSlug, cacheHit?.netKey, cacheHit?.entry?.sbtInfo);
      if (!netIdStr) {
        netIdStr = deriveNetKeyForSlug(initialSlug, cacheHit?.netKey, cacheHit?.entry?.sbtInfo);
      }

      syncResolvedSessionSlug(resolvedSlug);

      let cache = await readCacheForSlug(resolvedSlug, netIdStr);
      if (!isCurrentLoad()) return;
      let entry = cache[netIdStr]?.sbtList?.[addrLower] || (hasExplicitSlug ? null : cacheHit?.entry) || null;
      let sbtInfo = entry?.sbtInfo || null;

      if (hasExplicitSlug && (entry == null || needsTokenUriFields(sbtInfo))) {
        const crossGroupFallbackHit = findCachedEntryAcrossGroups({ excludeSlug: resolvedSlug });
        if (crossGroupFallbackHit) {
          netIdStr = deriveNetKeyForSlug(
            resolvedSlug,
            crossGroupFallbackHit.netKey,
            crossGroupFallbackHit.entry?.sbtInfo,
          );
          if (!netIdStr) {
            netIdStr = deriveNetKeyForSlug(
              initialSlug,
              crossGroupFallbackHit.netKey,
              crossGroupFallbackHit.entry?.sbtInfo,
            );
          }
          if (crossGroupFallbackHit.entry?.sbtInfo) {
            sbtInfo = {
              ...(crossGroupFallbackHit.entry.sbtInfo || {}),
              ...(sbtInfo && typeof sbtInfo === 'object' ? sbtInfo : {}),
            };
          }
          sbtLog.info('[SBTPage] explicit slug fallback to cached cross-group entry', {
            explicitSlug: normalizedExplicitSlug,
            fallbackSlug: crossGroupFallbackHit.slug || null,
            netIdStr,
            entryFound: !!crossGroupFallbackHit.entry,
          });
        }
      }

      sbtLog.info('[SBTPage] cache lookup', {
        resolvedSlug,
        netIdStr,
        cacheHitSlug: cacheHit?.slug || null,
        entryFound: !!entry,
        countsLoaded: entry?.countsLoaded === true,
        mintedAddresses: Array.isArray(entry?.mintedAddresses) ? entry.mintedAddresses.length : 0,
        burnedAddresses: Array.isArray(entry?.burnedAddresses) ? entry.burnedAddresses.length : 0,
        mintedEventCount: entry?.mintedEventCount ?? null,
        burnedEventCount: entry?.burnedEventCount ?? null,
        blockNumber: entry?.blockNumber ?? null,
        creationBlock: entry?.creationBlock ?? entry?.sbtInfo?.creationBlock ?? null,
        sbtInfoChainId: entry?.sbtInfo?.chainID ?? null,
        sbtInfoSessionName: entry?.sbtInfo?.sessionName ?? null,
      });
      const canReportProgress = !this.props.miniaturized;
      const makeProgressHandler = (slugForProgress: unknown): ((progress: SbtPageScanProgress) => void) | null => {
        if (!canReportProgress || !isCurrentLoad()) return null;
        const scanKey = `${String(slugForProgress || '')}:${addrLower}:${Date.now()}`;
        this._activeScanKey = scanKey;
        return (progress: SbtPageScanProgress) => {
          if (!this._isMounted || this._activeScanKey !== scanKey || !isCurrentLoad()) return;
          this.setState(buildSbtPageLogScanProgressPatch({ progress, slug: slugForProgress }));
        };
      };

      const buildRefreshOptions = (
        _countsLoadedFlag: unknown,
        slugForProgress: unknown,
      ): SbtPageRefreshOptions | undefined => {
        const onProgress = forceEventFetch ? makeProgressHandler(slugForProgress) : null;
        return buildSbtPageRefreshOptions({
          forceEventFetch,
          onProgress,
          preferCountsOnly,
        }) as SbtPageRefreshOptions | undefined;
      };
      let refreshOptions = buildRefreshOptions(entry?.countsLoaded, resolvedSlug);
      const applyPrimaryMetadataState = (nextSbtInfo: unknown, extraState: Record<string, unknown> = {}): void => {
        if (!this._isMounted || !isCurrentLoad()) return;
        this.setState((prev: SbtPagePrimaryMetadataState) =>
          buildSbtPagePrimaryMetadataStatePatch({
            account: this.props.account,
            extraState,
            nextSbtInfo,
            prevSbtInfo: prev.sbtInfo,
          }),
        );
      };

      // Centralized metadata hydration
      const { usingCentralHydration, parentOwnsInitialRefresh } = resolveSbtPageMetadataHydrationMode({
        forceEventFetch,
        isSBTCacheReady: this.props.isSBTCacheReady,
        refreshSbtData: this.props.refreshSbtData,
      });
      let metaKey = `${normalizeSessionSlug(resolvedSlug || '')}:${netIdStr}:${addrLower}`;
      if (
        usingCentralHydration &&
        !parentOwnsInitialRefresh &&
        needsTokenUriFields(sbtInfo) &&
        !this._metaHydrationTried[metaKey]
      ) {
        if (!isCurrentLoad()) return;
        this._metaHydrationTried[metaKey] = true;
        try {
          await this.refreshSbtDataWithSlug(sbtAddressOriginalCase, refreshOptions, resolvedSlug);
        } catch (e) {
          sbtLog.warn('SBTPage: fallback', e);
        }
        if (!isCurrentLoad()) return;
        cache = await readCacheForSlug(resolvedSlug, netIdStr);
        if (!isCurrentLoad()) return;
        entry = cache[netIdStr]?.sbtList?.[addrLower] || entry;
        sbtInfo = entry?.sbtInfo || sbtInfo;
        refreshOptions = buildRefreshOptions(entry?.countsLoaded, resolvedSlug);
      }

      if (
        (parentOwnsInitialRefresh && needsTokenUriFields(sbtInfo)) ||
        (!usingCentralHydration && needsDirectMetadataHydration(sbtInfo))
      ) {
        if (!isCurrentLoad()) return;
        try {
          const directMetadata = await sbtMetadataReadsPort.getSbtMetadata(
            'none',
            sbtAddressOriginalCase,
            buildDirectMetadataContext(resolvedSlug, netIdStr, sbtInfo),
          );
          if (!isCurrentLoad()) return;
          if (directMetadata && typeof directMetadata === 'object') {
            sbtInfo = {
              ...(sbtInfo && typeof sbtInfo === 'object' ? sbtInfo : {}),
              ...directMetadata,
              ...(Number.isFinite(Number(directMetadata?.burnAuth)) ? { burnAuthVerifiedOnChain: true } : {}),
            };
          }
        } catch (e) {
          sbtLog.warn('SBTPage: fallback', e);
        }
      }

      const slugFromName = this.resolveSessionSlugFromInfo(sbtInfo);
      if (!hasExplicitSlug && slugFromName && slugFromName !== resolvedSlug) {
        resolvedSlug = slugFromName;
        syncResolvedSessionSlug(resolvedSlug);
        sbtLog.info('[SBTPage] slug override from metadata', {
          previousSlug: cacheHit?.slug || normalizedExplicitSlug || initialSlug,
          resolvedSlug,
          sessionName: sbtInfo?.sessionName || null,
        });
        netIdStr = deriveNetKeyForSlug(resolvedSlug, cacheHit?.netKey, sbtInfo);
        metaKey = `${normalizeSessionSlug(resolvedSlug || '')}:${netIdStr}:${addrLower}`;
        cache = await readCacheForSlug(resolvedSlug, netIdStr);
        if (!isCurrentLoad()) return;
        entry = cache[netIdStr]?.sbtList?.[addrLower] || entry;
        sbtInfo = entry?.sbtInfo || sbtInfo;
        refreshOptions = buildRefreshOptions(entry?.countsLoaded, resolvedSlug);

        if (
          usingCentralHydration &&
          !parentOwnsInitialRefresh &&
          needsTokenUriFields(sbtInfo) &&
          !this._metaHydrationTried[metaKey]
        ) {
          if (!isCurrentLoad()) return;
          this._metaHydrationTried[metaKey] = true;
          try {
            await this.refreshSbtDataWithSlug(sbtAddressOriginalCase, refreshOptions, resolvedSlug);
          } catch (e) {
            sbtLog.warn('SBTPage: fallback', e);
          }
          if (!isCurrentLoad()) return;
          cache = await readCacheForSlug(resolvedSlug, netIdStr);
          if (!isCurrentLoad()) return;
          entry = cache[netIdStr]?.sbtList?.[addrLower] || entry;
          sbtInfo = entry?.sbtInfo || sbtInfo;
          refreshOptions = buildRefreshOptions(entry?.countsLoaded, resolvedSlug);
        }
        if (
          (parentOwnsInitialRefresh && needsTokenUriFields(sbtInfo)) ||
          (!usingCentralHydration && needsDirectMetadataHydration(sbtInfo))
        ) {
          if (!isCurrentLoad()) return;
          try {
            const directMetadata = await sbtMetadataReadsPort.getSbtMetadata(
              'none',
              sbtAddressOriginalCase,
              buildDirectMetadataContext(resolvedSlug, netIdStr, sbtInfo),
            );
            if (!isCurrentLoad()) return;
            if (directMetadata && typeof directMetadata === 'object') {
              sbtInfo = {
                ...(sbtInfo && typeof sbtInfo === 'object' ? sbtInfo : {}),
                ...directMetadata,
                ...(Number.isFinite(Number(directMetadata?.burnAuth)) ? { burnAuthVerifiedOnChain: true } : {}),
              };
            }
          } catch (e) {
            sbtLog.warn('SBTPage: fallback', e);
          }
        }
      } else if (hasExplicitSlug && slugFromName && slugFromName !== resolvedSlug) {
        sbtLog.info('[SBTPage] ignoring metadata slug override because route session is pinned', {
          explicitSlug: normalizedExplicitSlug,
          metadataSlug: slugFromName,
          sessionName: sbtInfo?.sessionName || null,
        });
      }

      sbtInfo = await fillFromChainIfMissing(sbtInfo || {}, sbtAddressOriginalCase, resolvedSlug);
      sbtInfo = isRecord(sbtInfo) ? (sbtInfo as SbtPageMetadataInfoLike) : {};
      if (!isCurrentLoad()) return;
      applyPrimaryMetadataState(sbtInfo);

      const resolvedChainId =
        Number(getSessionChainId(resolvedSlug) || sbtInfo?.chainID || currentNetwork?.id || 0) || null;
      const litHooks = this.getActiveLitHooks();
      const lit = litHooks && typeof litHooks.getKey === 'function' ? { getKey: litHooks.getKey } : null;
      const activeAccount = this.props.account;
      const metadataDecryptPlan = buildSbtPageEncryptedMetadataDecryptPlan({
        activeAccount,
        decryptTriedByKey: this._descDecryptTried,
        hasLitKey: !!lit,
        metaKey,
        sbtInfo,
      });
      const { decryptKey, descriptionEnvelope, documentUrlsEnvelope, imageEnvelope, nameEnvelope, tagsEnvelope } =
        metadataDecryptPlan;
      if (metadataDecryptPlan.shouldEnterDecryptBoundary) {
        if (!isCurrentLoad()) return;
        if (metadataDecryptPlan.canAttemptDecrypt && lit && activeAccount) {
          let allFieldsOk = true;
          if (nameEnvelope) {
            try {
              const decrypted = await cryptoUtils.decryptEnvelopeValue(nameEnvelope, {
                account: activeAccount,
                chainId: resolvedChainId,
                providerLike: this.props.provider,
                litOpts: lit,
              });
              if (!isCurrentLoad()) return;
              if (decrypted != null && decrypted !== '') {
                sbtInfo.name = String(decrypted);
                sbtInfo.nameDecrypted = true;
              }
            } catch (e) {
              allFieldsOk = false;
              sbtLog.warn('SBTPage: name decrypt fallback', e);
            }
          }
          if (descriptionEnvelope) {
            try {
              const decrypted = await cryptoUtils.decryptEnvelopeValue(descriptionEnvelope, {
                account: activeAccount,
                chainId: resolvedChainId,
                providerLike: this.props.provider,
                litOpts: lit,
              });
              if (!isCurrentLoad()) return;
              if (decrypted != null && decrypted !== '') {
                sbtInfo.description = String(decrypted);
                sbtInfo.descriptionDecrypted = true;
              }
            } catch (e) {
              allFieldsOk = false;
              sbtLog.warn('SBTPage: description decrypt fallback', e);
            }
          }
          if (tagsEnvelope) {
            try {
              const decrypted = await cryptoUtils.decryptEnvelopeValue(tagsEnvelope, {
                account: activeAccount,
                chainId: resolvedChainId,
                providerLike: this.props.provider,
                litOpts: lit,
              });
              if (!isCurrentLoad()) return;
              if (decrypted != null && decrypted !== '') {
                sbtInfo.tags = coerceSbtPageStringArrayValue(decrypted);
                sbtInfo.tagsDecrypted = true;
              }
            } catch (e) {
              allFieldsOk = false;
              sbtLog.warn('SBTPage: tags decrypt fallback', e);
            }
          }
          if (documentUrlsEnvelope) {
            try {
              const decrypted = await cryptoUtils.decryptEnvelopeValue(documentUrlsEnvelope, {
                account: activeAccount,
                chainId: resolvedChainId,
                providerLike: this.props.provider,
                litOpts: lit,
              });
              if (!isCurrentLoad()) return;
              if (decrypted != null && decrypted !== '') {
                sbtInfo.documentURLs = coerceSbtPageStringArrayValue(decrypted);
                sbtInfo.documentURLsDecrypted = true;
              }
            } catch (e) {
              allFieldsOk = false;
              sbtLog.warn('SBTPage: documentURLs decrypt fallback', e);
            }
          }
          if (imageEnvelope) {
            try {
              if (
                isRecord(imageEnvelope) &&
                (imageEnvelope.storage === 'lit-arweave' || imageEnvelope.txId || imageEnvelope.url)
              ) {
                const { payload } = await litStorage.downloadEncryptedArweaveData({
                  url: imageEnvelope.url,
                  txId: imageEnvelope.txId,
                  providerLike: this.props.provider,
                  account: activeAccount,
                  chainId: resolvedChainId,
                  lit: { getKey: lit.getKey },
                });
                if (!isCurrentLoad()) return;
                const blob = litStorage.decodeLitPayloadToBlob(payload);
                if (blob && typeof URL !== 'undefined') {
                  const blobUrl = URL.createObjectURL(blob);
                  this.releaseDecryptedImageBlobUrl();
                  this._decryptedImageBlobUrl = blobUrl;
                  sbtInfo.image = blobUrl;
                  sbtInfo.imageDecrypted = true;
                }
              } else {
                const decrypted = await cryptoUtils.decryptEnvelopeValue(imageEnvelope, {
                  account: activeAccount,
                  chainId: resolvedChainId,
                  providerLike: this.props.provider,
                  litOpts: lit,
                });
                if (!isCurrentLoad()) return;
                if (decrypted != null && decrypted !== '') {
                  sbtInfo.image = String(decrypted);
                  sbtInfo.imageDecrypted = true;
                }
              }
            } catch (e) {
              allFieldsOk = false;
              sbtLog.warn('SBTPage: image decrypt fallback', e);
            }
          }
          // Only mark as tried when all fields succeeded — allow retry on transient failures
          if (allFieldsOk) {
            this._descDecryptTried[decryptKey] = true;
          }
        }
      }
      applyPrimaryMetadataState(sbtInfo);

      const { groupPasswordHash: cachedGroupPasswordHash, shouldReuseCachedGroupPasswordHash } =
        resolveSbtPageCachedGroupPasswordHash({
          preferCountsOnly,
          groupPasswordHashLoaded: this.state.groupPasswordHashLoaded,
          groupPasswordHash: this.state.groupPasswordHash,
        });
      const groupPasswordHash = shouldReuseCachedGroupPasswordHash
        ? cachedGroupPasswordHash
        : await sbtMetadataReadsPort.getGroupPasswordHash('none', sbtAddressOriginalCase, resolvedSlug);
      if (!isCurrentLoad()) return;
      const { hasGroupHash, hasInviteMint, hasGroupPasswordMint } = resolveSbtPageGroupPasswordMintState({
        groupPasswordHash,
        hashZero: ethers.constants.HashZero,
        hasPasswordMint: sbtInfo?.hasPasswordMint,
      });

      let historySummary = normalizeSbtPageHistorySummary(entry?.historySummary);
      let mintedAddresses = expandSbtPageAddressListFromCountMap(entry?.mintedCountByAddress, entry?.mintedAddresses);
      let burnedAddresses = expandSbtPageAddressListFromCountMap(entry?.burnedCountByAddress, entry?.burnedAddresses);
      let countsLoaded = entry?.countsLoaded === true;
      let mintedTokensOverride: string | null = null;
      let mintedTokensSource: string | null = null;
      let ownerLookupUpperBound: string | null = null;
      const setSummaryFallbacks = (summaryValue: unknown, sourceLabel: string): void => {
        const nextFallbackState = applySbtPageHistorySummaryFallback({
          mintedTokensOverride,
          mintedTokensSource,
          ownerLookupUpperBound,
          sourceLabel,
          summaryValue,
        });
        mintedTokensOverride = nextFallbackState.mintedTokensOverride;
        mintedTokensSource = nextFallbackState.mintedTokensSource;
        ownerLookupUpperBound = nextFallbackState.ownerLookupUpperBound;
      };
      if (!countsLoaded || mintedAddresses.length === 0) {
        setSummaryFallbacks(historySummary, 'summary-cache');
        if (mintedTokensOverride == null) {
          try {
            const summaryRaw = await sbtOwnershipReadsPort.getSbtHistorySummary(
              'none',
              sbtAddressOriginalCase,
              resolvedSlug,
            );
            if (!isCurrentLoad()) return;
            historySummary = normalizeSbtPageHistorySummary(summaryRaw) || historySummary;
            setSummaryFallbacks(historySummary, 'summary-group');
            sbtLog.info('[SBTPage] history summary load via group', {
              resolvedSlug,
              historySummary,
              mintedTokensOverride,
            });
          } catch (err) {
            sbtLog.warn('[SBTPage] history summary fallback failed', { resolvedSlug, error: getErrorMessage(err) });
          }
        }
        if (mintedTokensOverride == null && sbtInfo?.chainID != null) {
          try {
            const fallbackCfg = { networkChainId: Number(sbtInfo.chainID) };
            const summaryRaw = await sbtOwnershipReadsPort.getSbtHistorySummary(
              'none',
              sbtAddressOriginalCase,
              fallbackCfg,
            );
            if (!isCurrentLoad()) return;
            historySummary = normalizeSbtPageHistorySummary(summaryRaw) || historySummary;
            setSummaryFallbacks(historySummary, 'summary-chainId');
            sbtLog.info('[SBTPage] history summary fallback via chainID', {
              resolvedSlug,
              chainID: sbtInfo.chainID,
              historySummary,
              mintedTokensOverride,
            });
          } catch (err) {
            sbtLog.warn('[SBTPage] history summary chain fallback failed', {
              resolvedSlug,
              chainID: sbtInfo.chainID,
              error: getErrorMessage(err),
            });
          }
        }
        if (mintedTokensOverride == null) {
          try {
            const mintedTokensRaw = await sbtMetadataReadsPort.getMintedTokens(
              'none',
              sbtAddressOriginalCase,
              resolvedSlug,
            );
            if (!isCurrentLoad()) return;
            mintedTokensOverride = sanitizeSbtPageMintedTokensOverride(mintedTokensRaw);
            if (mintedTokensOverride != null) {
              mintedTokensSource = 'mintedTokens-group';
              ownerLookupUpperBound = mintedTokensOverride;
            }
          } catch (_) {
            mintedTokensOverride = null;
          }
        }
        if (mintedTokensOverride == null && sbtInfo?.chainID != null) {
          try {
            const fallbackCfg = { networkChainId: Number(sbtInfo.chainID) };
            const mintedTokensRaw = await sbtMetadataReadsPort.getMintedTokens(
              'none',
              sbtAddressOriginalCase,
              fallbackCfg,
            );
            if (!isCurrentLoad()) return;
            mintedTokensOverride = sanitizeSbtPageMintedTokensOverride(mintedTokensRaw);
            if (mintedTokensOverride != null) {
              mintedTokensSource = 'mintedTokens-chainId';
              ownerLookupUpperBound = mintedTokensOverride;
            }
            sbtLog.info('[SBTPage] mintedTokens fallback via chainID', {
              resolvedSlug,
              chainID: sbtInfo.chainID,
              mintedTokensOverride,
            });
          } catch (err) {
            sbtLog.warn('[SBTPage] mintedTokens fallback failed', {
              resolvedSlug,
              chainID: sbtInfo.chainID,
              error: getErrorMessage(err),
            });
          }
        }
      }
      if (sbtInfo?.chainID != null) {
        const groupChainId = getSessionChainId(resolvedSlug);
        const sbtChainId = Number(sbtInfo.chainID);
        const chainMismatch =
          groupChainId &&
          Number.isFinite(Number(groupChainId)) &&
          Number.isFinite(sbtChainId) &&
          Number(groupChainId) !== sbtChainId;
        if (chainMismatch) {
          sbtLog.warn('[SBTPage] chainId mismatch', {
            resolvedSlug,
            groupChainId,
            sbtInfoChainId: sbtInfo.chainID,
          });
          if (mintedTokensSource === 'summary-group' || mintedTokensSource === 'mintedTokens-group') {
            sbtLog.warn('[SBTPage] ignoring holder summary from mismatched group chain', {
              resolvedSlug,
              groupChainId,
              sbtInfoChainId: sbtInfo.chainID,
            });
            mintedTokensOverride = null;
            mintedTokensSource = null;
            ownerLookupUpperBound = null;
          }
        }
      }
      const ownerLookupTokenCount = resolveSbtPageOwnerLookupTokenCount({
        mintedTokensOverride,
        ownerLookupUpperBound,
      });
      if (
        !usingCentralHydration &&
        forceEventFetch === true &&
        resolveSbtPageOwnerLookupFallbackDecision({
          burnedAddresses,
          countsLoaded,
          mintedAddresses,
          ownerLookupTokenCount,
          preferCountsOnly,
          requireCountsNotLoaded: true,
        })
      ) {
        const ownerFallback = await this.fetchHolderAddressesByTokenOwnership(
          sbtAddressOriginalCase,
          resolvedSlug,
          ownerLookupTokenCount,
        );
        if (!isCurrentLoad()) return;
        if (ownerFallback.length > 0) {
          mintedAddresses = ownerFallback;
          burnedAddresses = [];
          countsLoaded = true;
          mintedTokensOverride = null;
          mintedTokensSource = 'ownerOf-fallback';
        }
      }
      const sanitizedMintedTokensOverride = sanitizeSbtPageMintedTokensOverride(mintedTokensOverride);
      sbtLog.info('[SBTPage] counts snapshot', {
        resolvedSlug,
        countsLoaded,
        mintedAddresses: mintedAddresses.length,
        burnedAddresses: burnedAddresses.length,
        mintedTokensOverride: sanitizedMintedTokensOverride,
        mintedTokensSource,
      });
      const userLower = String(this.props.account || '').toLowerCase();

      // Calculate Admin Status
      const userIsSbtAdmin = resolveSbtPageUserAdminStatus({
        account: userLower,
        sbtInfo,
      });
      if (this._isMounted && isCurrentLoad()) {
        this.setState(
          (prev: HolderRefreshStateLike) => {
            const nextHoldersMetaKey = metaKey || null;
            const holderState = this.reconcileHolderRefreshState({
              prevState: prev,
              nextMintedAddresses: mintedAddresses,
              nextBurnedAddresses: burnedAddresses,
              nextCountsLoaded: countsLoaded,
              nextHoldersMetaKey,
              nextMintedTokensOverride: sanitizedMintedTokensOverride,
              userLower,
            });

            return {
              sbtInfo: sbtInfo || null,
              mintedAddresses: holderState.mintedAddresses,
              burnedAddresses: holderState.burnedAddresses,
              countsLoaded: holderState.countsLoaded,
              mintedTokensOverride: holderState.mintedTokensOverride,
              userHasSBT: holderState.userHasSBT,
              userIsSbtAdmin,
              groupPasswordHash: groupPasswordHash || null,
              groupPasswordHashLoaded: true,
              hasInviteMint,
              hasGroupPasswordMint,
              filteredMintedUsers: holderState.filteredMintedUsers,
              filteredMintedUsersSignature: holderState.filteredMintedUsersSignature,
              holdersMetaKey: nextHoldersMetaKey,
            };
          },
          () => {
            if (this._isMounted && isCurrentLoad()) {
              this.loadCachedPasswords();
            }
          },
        );
      }

      // Optional one-shot event scan (counts refresh or user-initiated)
      const shouldRefreshCounts = resolveSbtPageShouldRefreshCounts({
        burnedAddresses,
        countsLoaded,
        forceEventFetch,
        mintedAddresses,
        mintedTokensOverride,
      });
      // Regression guard: MainSite already owns the initial cold-load refresh for /sbt.
      // Kicking off another forced refresh here doubles the same log scan before cache lands.
      sbtLog.info('[SBTPage] refresh decision', {
        resolvedSlug,
        shouldRefreshCounts,
        parentOwnsInitialRefresh,
        forceEventFetch,
        countsLoaded,
        mintedAddresses: mintedAddresses.length,
        burnedAddresses: burnedAddresses.length,
        mintedTokensOverride,
      });
      const refreshLifecyclePlan = resolveSbtPageRefreshLifecyclePlan({
        eventScanTried: this._eventScanTried[metaKey],
        parentOwnsInitialRefresh,
        refreshOptions,
        shouldRefreshCounts,
        usingCentralHydration,
      });
      if (refreshLifecyclePlan.shouldPromoteToForcedCountsRefresh) {
        const onProgress = makeProgressHandler(resolvedSlug);
        refreshOptions = onProgress ? { forceCounts: true, onProgress } : { forceCounts: true };
      }
      if (refreshLifecyclePlan.shouldRunEventScanRefresh) {
        if (!isCurrentLoad()) return;
        this._eventScanTried[metaKey] = true;
        try {
          await this.refreshSbtDataWithSlug(sbtAddressOriginalCase, refreshOptions, resolvedSlug);
        } catch (e) {
          sbtLog.warn('SBTPage: fallback', e);
        }
        if (!isCurrentLoad()) return;
        cache = await readCacheForSlug(resolvedSlug, netIdStr);
        if (!isCurrentLoad()) return;
        entry = cache[netIdStr]?.sbtList?.[addrLower] || entry;
        let minted2 = expandSbtPageAddressListFromCountMap(
          entry?.mintedCountByAddress,
          entry?.mintedAddresses || mintedAddresses,
        );
        let burned2 = expandSbtPageAddressListFromCountMap(
          entry?.burnedCountByAddress,
          entry?.burnedAddresses || burnedAddresses,
        );
        let refreshedCountsLoaded = entry?.countsLoaded === true;
        const needsOwnerFallback = resolveSbtPageOwnerLookupFallbackDecision({
          burnedAddresses: burned2,
          mintedAddresses: minted2,
          ownerLookupTokenCount,
          preferCountsOnly,
        });
        if (needsOwnerFallback) {
          const ownerFallback = await this.fetchHolderAddressesByTokenOwnership(
            sbtAddressOriginalCase,
            resolvedSlug,
            ownerLookupTokenCount,
          );
          if (!isCurrentLoad()) return;
          if (ownerFallback.length > 0) {
            minted2 = ownerFallback;
            burned2 = [];
            refreshedCountsLoaded = true;
          }
        }
        if (!refreshedCountsLoaded) {
          delete this._eventScanTried[metaKey];
        }
        if (this._isMounted && isCurrentLoad()) {
          this.setState((prev: HolderRefreshStateLike) => {
            const nextHoldersMetaKey = metaKey || null;
            const holderState = this.reconcileHolderRefreshState({
              prevState: prev,
              nextMintedAddresses: minted2,
              nextBurnedAddresses: burned2,
              nextCountsLoaded: refreshedCountsLoaded,
              nextHoldersMetaKey,
              nextMintedTokensOverride: mintedTokensOverride,
              userLower,
            });

            return {
              mintedAddresses: holderState.mintedAddresses,
              burnedAddresses: holderState.burnedAddresses,
              userHasSBT: holderState.userHasSBT,
              countsLoaded: holderState.countsLoaded,
              mintedTokensOverride: holderState.mintedTokensOverride,
              filteredMintedUsers: holderState.filteredMintedUsers,
              filteredMintedUsersSignature: holderState.filteredMintedUsersSignature,
            };
          });
        }
        sbtLog.info('[SBTPage] refresh results', {
          resolvedSlug,
          refreshedCountsLoaded,
          mintedAddresses: minted2.length,
          burnedAddresses: burned2.length,
          ownerOfFallbackApplied: needsOwnerFallback && minted2.length > 0,
        });
      }
    } catch (err) {
      sbtLog.error('Error loading SBT info:', err);
    } finally {
      this._loadSbtInfoInFlight = false;
      const isCurrentRequest = this.isCurrentLoadSbtInfoRequest(requestKey);
      const shouldRerun = this._loadSbtInfoPending === true;
      const rerunOptions = this._loadSbtInfoPendingOptions;
      const rerunForce = this._loadSbtInfoPendingForce === true;
      if (this._isMounted && (isCurrentRequest || !shouldRerun)) {
        this.setState(buildSbtPageLoadingMintersBurnersPatch());
      }
      this._loadSbtInfoPending = false;
      this._loadSbtInfoPendingForce = false;
      this._loadSbtInfoPendingOptions = null;
      if (shouldRerun && this._isMounted) {
        // Keep this immediate: it coalesces in-flight refresh calls, not a block-confirmation wait.
        setTimeout(() => {
          if (this._isMounted) this.loadSBTInfo(rerunOptions || rerunForce);
        }, 0);
      }
    }
  }

  clearMintingEndCountdown() {
    const { intervalId } = this.state;
    if (intervalId) {
      clearInterval(intervalId);
      if (this._isMounted) this.setState(buildSbtPageIntervalIdPatch({ intervalId: null }));
    }
  }

  restartMintingEndCountdown() {
    if (!this._isMounted) return;
    this.clearMintingEndCountdown();
    this.startMintingEndCountdown();
  }

  startMintingEndCountdown() {
    const pollingIntervalMs = Math.max(1000, this.getActiveBlockTimeMs(1));
    const intervalId = setInterval(() => {
      if (!this._isMounted) {
        clearInterval(intervalId);
        return;
      }
      const { sbtInfo } = this.state;
      if (sbtInfo && sbtInfo.mintingEndTime != null) {
        const now = Date.now();
        const endSecRaw = Number(sbtInfo.mintingEndTime || 0);
        const endMs = (endSecRaw > 1e12 ? Math.floor(endSecRaw / 1000) : endSecRaw) * 1000;
        const distance = endMs - now;

        if (distance <= 0) {
          clearInterval(intervalId);
          if (this._isMounted && this.state.intervalId === intervalId) {
            this.setState({
              ...buildSbtPageMintCountdownPatch(),
              ...buildSbtPageIntervalIdPatch({ intervalId: null }),
            });
          }
        } else {
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          if (this._isMounted)
            this.setState(
              buildSbtPageMintCountdownPatch({
                countdown: `${days}d ${hours}h ${minutes}m ${seconds}s`,
              }),
            );
        }
      }
    }, pollingIntervalMs);

    if (this._isMounted) this.setState(buildSbtPageIntervalIdPatch({ intervalId }));
  }

  checkForMintPassword = (): void => {
    const { sbtMintPassword } = this.props;
    const finalPasswordToUse = sbtMintPassword;

    if (finalPasswordToUse && this._isMounted) {
      const isList = Array.isArray(finalPasswordToUse);
      const invitePayload =
        !isList && typeof finalPasswordToUse === 'string' ? this.decodeInviteInput(finalPasswordToUse) : null;

      this.setState(
        buildSbtPageMintPasswordPrefillPatch({
          currentGroupPasswordInput: this.state.groupPasswordInput || '',
          finalPasswordToUse,
          invitePayload,
          isList,
        }),
      );
    } else if (!finalPasswordToUse && (this.state.mintPassword || this.state.manualPasswordInput) && this._isMounted) {
      this.setState(buildSbtPageMintPasswordClearPatch());
    }
  };

  async mintUnlimitedWithGroupPassword(options: SbtPageManualMintOptions = {}): Promise<boolean> {
    sbtLog.log('[MANUAL-MINT] Starting manual mint...');
    let sbt: string | null = null;
    let slug = '';
    let mintAccountLower = '';
    let mintChainId = '';
    try {
      if (!this.props.account) {
        this.props.toggleLoginModal(true);
        return false;
      }
      const password = cryptoUtils.normalizeGroupPasswordInput(
        options?.passwordOverride != null ? options.passwordOverride : this.state.groupPasswordInput,
      );
      if (!password) {
        this.setState(buildSbtPageErrorPatch({ error: 'Enter group password first.' }));
        return false;
      }

      sbt = resolveSbtAddressString(options?.sbtAddressOverride || this.props.SBTAddress);
      if (!sbt) return false;

      sbtLog.log('[MANUAL-MINT] Preparing mint for', sbt, '...');
      slug =
        options?.sessionSlugOverride != null
          ? String(options.sessionSlugOverride || '')
          : this.getEffectiveSessionSlug();
      mintAccountLower =
        options?.accountLowerOverride != null
          ? String(options.accountLowerOverride || '')
              .trim()
              .toLowerCase()
          : String(this.props.account || '')
              .trim()
              .toLowerCase();
      mintChainId =
        options?.chainIdOverride != null ? String(options.chainIdOverride || '').trim() : this.getMintTargetChainId();
      const mintAccount = this.props.account;

      if (
        !this.isMintTargetContextCurrent({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          sbtAddress: sbt,
          sessionSlug: slug,
        })
      ) {
        return false;
      }

      sbtLog.log('[MANUAL-MINT] Reading on-chain groupPasswordHash...');
      const onchain = await sbtMetadataReadsPort.getGroupPasswordHash('none', sbt, slug);
      sbtLog.log('[MANUAL-MINT] On-chain groupPasswordHash:', onchain);
      if (
        !this.isMintTargetContextCurrent({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          sbtAddress: sbt,
          sessionSlug: slug,
        })
      ) {
        return false;
      }
      if (!onchain || onchain === ethers.constants.HashZero) {
        this.setState(
          buildSbtPageErrorPatch({
            error: `This ${t('sbt')} does not support group-password signature ${t('mintLower')}.`,
          }),
        );
        return false;
      }

      const walletScopeSbtAddress = cryptoUtils.resolveGroupPasswordWalletScopeAddress({
        password,
        sbtAddress: sbt,
        groupPasswordHash: onchain,
      });
      const local =
        walletScopeSbtAddress === null
          ? null
          : sbtGroupMintAuthorizationPort.computeGroupPasswordHash({
              password,
              sbtAddress: walletScopeSbtAddress,
            });
      if (!local || local.toLowerCase() !== onchain.toLowerCase()) {
        sbtLog.error('[MANUAL-MINT] Sanity check FAILED', { expected: onchain, computed: local });
        if (
          !this.isMintTargetContextCurrent({
            accountLower: mintAccountLower,
            chainId: mintChainId,
            sbtAddress: sbt,
            sessionSlug: slug,
          })
        ) {
          return false;
        }
        this.setState(buildSbtPageErrorPatch({ error: 'Incorrect group password.' }));
        return false;
      }

      if (
        !this.isMintTargetContextCurrent({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          sbtAddress: sbt,
          sessionSlug: slug,
        })
      ) {
        return false;
      }
      this.setMintPendingForTarget({
        accountLower: mintAccountLower,
        chainId: mintChainId,
        sbtAddress: sbt,
        sessionSlug: slug,
      });

      sbtLog.log('[MANUAL-MINT] Signing authorization...');
      const sig = await sbtGroupMintAuthorizationPort.signGroupMintAuthorization({
        password,
        sbtAddress: sbt,
        userAddress: String(mintAccount || ''),
        walletScopeSbtAddress,
      });
      sbtLog.log('[MANUAL-MINT] Signature:', sig);

      if (
        !this.isMintTargetContextCurrent({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          sbtAddress: sbt,
          sessionSlug: slug,
        })
      ) {
        return false;
      }
      sbtLog.log('[MANUAL-MINT] Sending transaction...');
      const tx = await sbtMintExecutionPort.mintWithGroupSignature(this.props.provider, sbt, String(sig || ''));
      sbtLog.log('[MANUAL-MINT] Tx hash:', tx.transactionHash);

      await this.completeMintSuccessForTarget({
        accountLower: mintAccountLower,
        chainId: mintChainId,
        forceEventRefreshOnSuccess: true,
        sbtAddress: sbt,
        sessionSlug: slug,
        txHash: tx.transactionHash,
      });
      return true;
    } catch (error) {
      sbtLog.error('Manual mint flow failed:', error);
      if (
        this.isMintTargetContextCurrent({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          sbtAddress: sbt,
          sessionSlug: slug,
        })
      ) {
        this.setState(buildSbtPageMintFailurePatch({ error: getErrorMessage(error, `${t('mint')} failed.`) }));
      }
      return false;
    }
  }

  fetchRelevantInfo = (): void => {
    if (this._isMounted)
      this.setState(
        buildSbtPageRelevantInfoPatch({
          sbtLabel: t('sbt'),
        }),
      );
  };

  handleMint = async (
    forceEventRefreshOnSuccess: boolean = true,
    options: SbtPageHandleMintOptions = {},
  ): Promise<boolean> => {
    if (!this.props.account) {
      this.props.toggleLoginModal(true);
      return false;
    }

    const sbtAddressOriginalCase = resolveSbtAddressString(options?.sbtAddressOverride || this.props.SBTAddress);

    if (!sbtAddressOriginalCase) return false;

    const { mintPassword, mintStep, manualPasswordInput } = this.state;
    const sbtInfo = (options?.sbtInfoOverride || this.state.sbtInfo || {}) as SbtPageInfoState;
    const slug =
      options?.sessionSlugOverride != null ? String(options.sessionSlugOverride || '') : this.getEffectiveSessionSlug();
    const mintAccountLower =
      options?.accountLowerOverride != null
        ? String(options.accountLowerOverride || '')
            .trim()
            .toLowerCase()
        : String(this.props.account || '')
            .trim()
            .toLowerCase();
    const mintChainId =
      options?.chainIdOverride != null ? String(options.chainIdOverride || '').trim() : this.getMintTargetChainId();
    const mintAccount = this.props.account;

    if (
      !this.isMintTargetContextCurrent({
        accountLower: mintAccountLower,
        chainId: mintChainId,
        sbtAddress: sbtAddressOriginalCase,
        sessionSlug: slug,
      })
    ) {
      return false;
    }

    try {
      if (sbtInfo.hasPasswordMint) {
        const effectivePassword =
          mintPassword && mintPassword.trim() !== '' ? mintPassword : (manualPasswordInput || '').trim();
        if (effectivePassword === '') {
          if (this._isMounted)
            this.setState(buildSbtPageMintFailurePatch({ error: `Password is required for this ${t('sbt')}.` }));
          return false;
        }

        if (mintStep === 0) {
          // Pre-validate password before spending gas on startClaim().
          // isPasswordValid() is a free view call and saves two wasted txs on bad passwords.
          const hashedPassword = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(effectivePassword));
          try {
            const isValid = await sbtAdminOpsPort.isPasswordValid(
              this.props.provider,
              sbtAddressOriginalCase,
              hashedPassword,
              slug,
            );
            if (!isValid) {
              if (
                !this.isMintTargetContextCurrent({
                  accountLower: mintAccountLower,
                  chainId: mintChainId,
                  sbtAddress: sbtAddressOriginalCase,
                  sessionSlug: slug,
                })
              ) {
                return false;
              }
              if (this._isMounted) this.setState(buildSbtPageMintFailurePatch({ error: 'Invalid password.' }));
              return false;
            }
          } catch (preCheckErr) {
            // If the view call fails (e.g. network issue), proceed with the mint anyway —
            // the on-chain transaction will catch invalid passwords. Don't block the user.
            sbtLog.warn('[SBTPage] Password pre-validation call failed, proceeding with mint:', preCheckErr);
          }

          if (
            !this.isMintTargetContextCurrent({
              accountLower: mintAccountLower,
              chainId: mintChainId,
              sbtAddress: sbtAddressOriginalCase,
              sessionSlug: slug,
            })
          ) {
            return false;
          }
          this.setMintPendingForTarget({
            accountLower: mintAccountLower,
            chainId: mintChainId,
            sbtAddress: sbtAddressOriginalCase,
            sessionSlug: slug,
          });

          const userCommit = ethers.utils.solidityKeccak256(['string', 'address'], [effectivePassword, mintAccount]);

          const tx = await sbtAdminOpsPort.startClaim(this.props.provider, sbtAddressOriginalCase, userCommit);
          if (
            this._isMounted &&
            this.isMintTargetContextCurrent({
              accountLower: mintAccountLower,
              chainId: mintChainId,
              sbtAddress: sbtAddressOriginalCase,
              sessionSlug: slug,
            })
          ) {
            this.setState(
              buildSbtPagePasswordClaimStartSuccessPatch({
                txHash: tx.transactionHash,
              }),
            );
            this.startClaimCountdown();
            this._activeMintPendingTargetKey = '';
          } else {
            this.clearMintPendingForTarget({
              accountLower: mintAccountLower,
              chainId: mintChainId,
              sbtAddress: sbtAddressOriginalCase,
              sessionSlug: slug,
            });
          }
          this.cacheTransactionHash(tx.transactionHash, mintAccountLower);
          return true;
        } else if (mintStep === 2) {
          if (
            !this.isMintTargetContextCurrent({
              accountLower: mintAccountLower,
              chainId: mintChainId,
              sbtAddress: sbtAddressOriginalCase,
              sessionSlug: slug,
            })
          ) {
            return false;
          }
          this.setMintPendingForTarget({
            accountLower: mintAccountLower,
            chainId: mintChainId,
            sbtAddress: sbtAddressOriginalCase,
            sessionSlug: slug,
          });
          const tx = await sbtAdminOpsPort.claimWithPassword(
            this.props.provider,
            sbtAddressOriginalCase,
            effectivePassword,
          );
          this.cacheTransactionHash(tx.transactionHash, mintAccountLower);
          await this.completeMintSuccessForTarget({
            accountLower: mintAccountLower,
            chainId: mintChainId,
            clearManualPassword: true,
            forceEventRefreshOnSuccess,
            mintStep: 3,
            sbtAddress: sbtAddressOriginalCase,
            sessionSlug: slug,
            txHash: tx.transactionHash,
          });
          return true;
        }
      } else {
        if (
          !this.isMintTargetContextCurrent({
            accountLower: mintAccountLower,
            chainId: mintChainId,
            sbtAddress: sbtAddressOriginalCase,
            sessionSlug: slug,
          })
        ) {
          return false;
        }
        this.setMintPendingForTarget({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          sbtAddress: sbtAddressOriginalCase,
          sessionSlug: slug,
        });
        const tx = await sbtMintExecutionPort.claim(this.props.provider, sbtAddressOriginalCase);
        this.cacheTransactionHash(tx.transactionHash, mintAccountLower);
        await this.completeMintSuccessForTarget({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          forceEventRefreshOnSuccess,
          sbtAddress: sbtAddressOriginalCase,
          sessionSlug: slug,
          txHash: tx.transactionHash,
        });
        return true;
      }
    } catch (error) {
      sbtLog.error('Minting failed in handleMint:', error);
      if (
        this._isMounted &&
        this.isMintTargetContextCurrent({
          accountLower: mintAccountLower,
          chainId: mintChainId,
          sbtAddress: sbtAddressOriginalCase,
          sessionSlug: slug,
        })
      ) {
        this.setState(buildSbtPageMintFailurePatch({ error: getErrorMessage(error, `${t('minting')} failed.`) }));
      }
      return false;
    }
    return false;
  };

  miniMintHandler = async (): Promise<void> => {
    if (!this.props.account) {
      this.props.toggleLoginModal(true);
      return;
    }
    await this.handleMint(true); // Pass true to force event refresh on success
  };

  miniBurnHandler = async (): Promise<void> => {
    if (!this.props.account) {
      this.props.toggleLoginModal(true);
      return;
    }
    try {
      if (this._isMounted) this.setState(buildSbtPageBurnPendingPatch());

      const sbtAddressOriginalCase = resolveSbtAddressString(this.props.SBTAddress);

      if (!sbtAddressOriginalCase) return;

      const tokenIdToBurn = await sbtOwnershipReadsPort.getSBTTokenIdByOwner(
        'none',
        sbtAddressOriginalCase,
        this.props.account,
        this.getEffectiveSessionSlug(),
      );
      if (!tokenIdToBurn) {
        if (this._isMounted) this.setState(buildSbtPageBurnFailurePatch({ error: 'No valid token ID found' }));
        return;
      }

      const tx = await sbtAdminOpsPort.burnToken(this.props.provider, sbtAddressOriginalCase, tokenIdToBurn);
      await this.loadSBTInfo(true);
      if (this._isMounted) this.setState(buildSbtPageBurnSuccessPatch({ txHash: tx.transactionHash }));
      this.cacheTransactionHash(tx.transactionHash);

      // Optimistic + parent refresh
      this.applyLocalBurnSuccess(this.props.account.toLowerCase());
      this.refreshSbtDataWithSlug(sbtAddressOriginalCase);
    } catch (error) {
      sbtLog.error('Burn failed in miniBurnHandler:', error);
      if (this._isMounted) this.setState(buildSbtPageBurnFailurePatch({ error: getErrorMessage(error) }));
    }
  };

  handleBurnSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const input = event.target.value;

    if (this._isMounted) {
      this.setState(buildSbtPageBurnSearchInputPatch({ input }));
    }

    // Clear any in-flight debounce
    if (this._burnSearchTimer) {
      clearTimeout(this._burnSearchTimer);
      this._burnSearchTimer = null;
    }

    if (!input) return;

    // Wait 300ms after the last keystroke before hitting RPC
    this._burnSearchTimer = setTimeout(() => {
      this._burnSearchTimer = null;
      this.performBurnSearch(this.state.burnSearchInput);
    }, 300);
  };

  // Extracted the actual RPC logic so it can be debounced
  performBurnSearch = async (rawInput: unknown): Promise<void> => {
    const input = String(rawInput || '').trim();
    if (!input) return;

    const sbtAddressOriginalCase = resolveSbtAddressString(this.props.SBTAddress);
    if (!sbtAddressOriginalCase) return;

    try {
      // Full address search
      if (input.startsWith('0x') && input.length === 42) {
        const tokenId = await sbtOwnershipReadsPort.getSBTTokenIdByOwner(
          'none',
          sbtAddressOriginalCase,
          input,
          this.getEffectiveSessionSlug(),
        );
        if (tokenId && this._isMounted) {
          this.setState(
            buildSbtPageBurnSearchResultPatch({
              address: input,
              resultType: 'address',
              tokenId,
            }),
          );
        }
      }
      // Numeric tokenId search
      else if (/^\d+$/.test(input)) {
        const address = await sbtOwnershipReadsPort.getOwnerByTokenId(
          'none',
          sbtAddressOriginalCase,
          input,
          this.getEffectiveSessionSlug(),
        );
        if (address && this._isMounted) {
          this.setState(
            buildSbtPageBurnSearchResultPatch({
              address,
              resultType: 'tokenId',
              tokenId: input,
            }),
          );
        }
      }
    } catch (error) {
      sbtLog.error('Error searching burn target:', error);
    }
  };

  handleBurn = async (): Promise<void> => {
    if (!this.props.account) {
      this.props.toggleLoginModal(true);
      return;
    }

    const sbtAddressOriginalCase = resolveSbtAddressString(this.props.SBTAddress);
    if (!sbtAddressOriginalCase) return;

    const { sbtInfo, burnSearchResult } = this.state;
    const sbtInfoRecord = isRecord(sbtInfo) ? sbtInfo : {};
    const burnSearchResultRecord = isRecord(burnSearchResult) ? (burnSearchResult as SbtPageBurnSearchResult) : null;

    const userAddress = this.props.account.toLowerCase();
    const adminAddr = String(sbtInfoRecord.admin || sbtInfoRecord.admin_ || '');
    const burnAuthNumber = Number(sbtInfoRecord.burnAuth);
    const burnAuth = Number.isFinite(burnAuthNumber) ? burnAuthNumber : Number.NaN;
    const isAdminBurn = this.state.userIsSbtAdmin && (burnAuth === 0 || burnAuth === 2);
    const isOwnerBurn =
      this.state.userHasSBT &&
      (burnAuth === 1 || burnAuth === 2 || (burnAuth === 0 && adminAddr && adminAddr.toLowerCase() === userAddress));

    let tokenIdToBurn: unknown;
    let burnedAddrLower: string | null = null;

    if (isAdminBurn && burnSearchResultRecord && burnSearchResultRecord.tokenId) {
      tokenIdToBurn = burnSearchResultRecord.tokenId;
      burnedAddrLower = burnSearchResultRecord.address ? String(burnSearchResultRecord.address).toLowerCase() : null;
    } else if (isOwnerBurn) {
      tokenIdToBurn = await sbtOwnershipReadsPort.getSBTTokenIdByOwner(
        'none',
        sbtAddressOriginalCase,
        this.props.account,
        this.getEffectiveSessionSlug(),
      );
      burnedAddrLower = userAddress;
      if (!tokenIdToBurn) {
        if (this._isMounted) this.setState(buildSbtPageBurnFailurePatch({ error: 'No valid token ID found' }));
        return;
      }
    } else if (this.state.userIsSbtAdmin && (burnAuth === 0 || burnAuth === 2) && !burnSearchResult) {
      if (this._isMounted)
        this.setState(buildSbtPageBurnFailurePatch({ error: 'Admin burn requires specifying token ID or owner.' }));
      return;
    } else {
      if (this._isMounted)
        this.setState(
          buildSbtPageBurnFailurePatch({ error: `You are not authorized to ${t('burnLower')} this ${t('sbt')}.` }),
        );
      return;
    }

    try {
      if (this._isMounted) this.setState(buildSbtPageBurnPendingPatch());
      const tx = await sbtAdminOpsPort.burnToken(this.props.provider, sbtAddressOriginalCase, tokenIdToBurn);
      await this.loadSBTInfo(true);
      if (this._isMounted)
        this.setState(
          buildSbtPageBurnSuccessPatch({
            resetBurnSearch: true,
            txHash: tx.transactionHash,
          }),
        );
      this.cacheTransactionHash(tx.transactionHash);

      // Optimistic + parent refresh
      if (burnedAddrLower) this.applyLocalBurnSuccess(burnedAddrLower);
      this.refreshSbtDataWithSlug(sbtAddressOriginalCase);
    } catch (error) {
      if (this._isMounted)
        this.setState(
          buildSbtPageBurnFailurePatch({
            error: getErrorMessage(error),
            resetBurnSearch: true,
          }),
        );
    }
  };

  startClaimCountdown = (): void => {
    const confirmationBlocks = 5;
    const intervalMs = Math.max(1000, this.getActiveBlockTimeMs(1));
    const waitMs = this.getActiveBlockTimeMs(confirmationBlocks);
    let remainingMs = waitMs;
    if (this._isMounted) this.setState(buildSbtPageClaimCountdownTickPatch({ remainingMs }));
    const countdownInterval = setInterval(() => {
      if (!this._isMounted) {
        clearInterval(countdownInterval);
        return;
      }
      remainingMs = Math.max(0, remainingMs - intervalMs);
      if (this._isMounted) this.setState(buildSbtPageClaimCountdownTickPatch({ remainingMs }));
      if (remainingMs === 0) {
        clearInterval(countdownInterval);
        if (this._isMounted) {
          this.setState(buildSbtPageClaimCountdownCompletePatch({ waitMs }));
        }
      }
    }, intervalMs);
  };

  copyToClipboard = async (text: unknown, addressType: unknown): Promise<void> => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard write is unavailable');
      await navigator.clipboard.writeText(String(text ?? ''));
      notify.success('Copied to clipboard');
      if (this._isMounted)
        this.setState(buildSbtPageCopiedAddressPatch({ addressType }), () => {
          setTimeout(() => {
            if (this._isMounted) this.setState(buildSbtPageCopiedAddressPatch());
          }, 2500);
        });
    } catch (error: unknown) {
      sbtLog.warn('SBTPage clipboard write failed', error);
      notify.warn('Copy failed');
    }
  };

  bookmarkSBT = (): void => {
    const sbtAddressOriginalCase = resolveSbtAddressString(this.props.SBTAddress);
    if (!sbtAddressOriginalCase) return;
    const sbtAddressLower = String(sbtAddressOriginalCase || '').toLowerCase();
    const bookmarksSlug = String(
      this.state?.resolvedSessionSlug ??
        this.props?.activeSessionSlug ??
        this.props?.sessionSlug ??
        this.props?.slug ??
        '',
    );

    try {
      const existingManaged = peekCacheSync('bookmarksCache', bookmarksSlug, { clone: false });
      const baseManaged = isRecord(existingManaged) ? existingManaged : {};
      const managedBookmarks: Record<string, unknown> & { sbts: string[] } = {
        ...baseManaged,
        sbts: Array.isArray(baseManaged.sbts) ? baseManaged.sbts.map((entry) => String(entry || '')) : [],
      };
      const alreadyManaged = managedBookmarks.sbts.some(
        (entry) => String(entry || '').toLowerCase() === sbtAddressLower,
      );
      if (!alreadyManaged) {
        managedBookmarks.sbts.push(sbtAddressLower);
        void (writeCache as unknown as (namespace: string, slug?: string, value?: unknown) => Promise<unknown>)(
          'bookmarksCache',
          bookmarksSlug,
          managedBookmarks,
        ).catch((e: unknown) => {
          sbtLog.warn('SBTPage: fallback', e);
        });
      }
    } catch (e) {
      sbtLog.warn('SBTPage: fallback', e);
    }

    try {
      const bookmarks = this.readQueuedOrStoredLocalStorageJson<BookmarkStorageCache>('bookmarks', {});
      const next = appendSbtPageBookmark({
        bookmarksObj: bookmarks,
        sbtAddress: sbtAddressOriginalCase,
      });
      if (next.shouldWrite) {
        this.queueLocalStorageJsonWrite('bookmarks', next.bookmarks as BookmarkStorageCache);
        if (this._isMounted) this.setState(buildSbtPageBookmarkedPatch({ bookmarked: true }));
      }
    } catch (e) {
      sbtLog.warn('SBTPage: fallback', e);
    }
    this.storeSBTDetails();
  };

  storeSBTDetails = (): void => {
    const sbtAddressOriginalCase = resolveSbtAddressString(this.props.SBTAddress);
    if (!sbtAddressOriginalCase) return;

    try {
      const sbtDetails = buildSbtPageDetailsPayload({
        sbtInfo: this.state.sbtInfo,
        address: sbtAddressOriginalCase,
      });
      this.queueLocalStorageJsonWrite('sbtDetails', sbtDetails);
    } catch (e) {
      sbtLog.warn('SBTPage: fallback', e);
    }
  };

  getExplorerUrl = (address: unknown): string => {
    const currentNetwork = this.state.network || this.props.network;
    return buildSbtPageExplorerUrl({ network: currentNetwork, value: address, kind: 'address' });
  };

  getExplorerLink = (hash: unknown): string => {
    const currentNetwork = this.state.network || this.props.network;
    return buildSbtPageExplorerUrl({ network: currentNetwork, value: hash, kind: 'tx' });
  };

  handleGenerateAdminInvites = async (): Promise<void> => {
    const passwordGenerationCount = this.state.passwordGenerationCount;
    if (!passwordGenerationCount || Number(passwordGenerationCount) <= 0) return;

    const newPasswordList = this.generateRandomPasswords(passwordGenerationCount);

    const hashedPasswords = newPasswordList.map((password) =>
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes(password)),
    );

    try {
      const sbtAddressOriginalCase = resolveSbtAddressString(this.props.SBTAddress);
      if (!sbtAddressOriginalCase) return;

      const tx = await sbtAdminOpsPort.addHashedPasswords(this.props.provider, sbtAddressOriginalCase, hashedPasswords);
      sbtLog.log('addHashedPasswords transaction hash:', tx.transactionHash);

      this.cacheTransactionHash(tx.transactionHash);

      if (this.state.encryptedRecoveryEnabled) {
        const recoveryWrite = await appendEncryptedSbtRecovery({
          chainId: this.getRecoveryCacheChainId(),
          passwords: newPasswordList,
          sbtAddress: sbtAddressOriginalCase,
        });
        this.setState({
          encryptedRecoveryEnabled: recoveryWrite.ok,
          encryptedRecoveryStatus: recoveryWrite.ok ? 'saved' : 'unavailable',
        });
        if (!recoveryWrite.ok) {
          notify.warn('Encrypted local recovery failed. Export the new passwords before leaving this page.');
        }
      }

      if (this._isMounted)
        this.setState(
          buildSbtPageAdminInviteSuccessPatch({
            passwordList: newPasswordList,
          }),
        );
    } catch (error) {
      sbtLog.error('Error adding hashed passwords:', error);
      if (this._isMounted) this.setState(buildSbtPageErrorPatch({ error: getErrorMessage(error) }));
    }
  };

  handleEncryptedRecoveryChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const patch = await selectAdminEncryptedRecovery({
      chainId: this.getRecoveryCacheChainId(),
      enabled: event.target.checked === true,
      sbtAddress: resolveSbtAddressString(this.props.SBTAddress),
    });
    this.setState(patch);
  };

  handleClearLocalRecovery = async (): Promise<void> => {
    this.setState(
      await clearAllSbtRecovery({
        chainId: this.getRecoveryCacheChainId(),
        sbtAddress: resolveSbtAddressString(this.props.SBTAddress),
      }),
    );
  };

  generateRandomPasswords = (count: unknown): string[] => {
    return generateSbtPageRandomPasswords({
      count,
      getRandomValues:
        typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function'
          ? (arr: Uint8Array) => window.crypto.getRandomValues(arr)
          : null,
      randomBytes: ethers.utils.randomBytes,
    });
  };

  exportPasswords = (): void => {
    const { exportFormat, includePreviousPasswords, cachedPasswords, adminGeneratedPasswords } = this.state;
    const isInvite = !!this.state.hasInviteMint;
    const codeLabel = isInvite ? 'groupPassword' : 'password';
    const fileLabel = isInvite ? 'group-passwords' : 'passwords';

    const sbtAddr = resolveSbtAddressString(this.props.SBTAddress).toLowerCase();

    if (!sbtAddr) {
      sbtLog.error('SBT Address for export is undefined.');
      return;
    }

    const { passwordsToExport } = resolveSbtPagePasswordExportSelection({
      adminGeneratedPasswords,
      cachedPasswords,
      includePreviousPasswords,
    });

    const baseUrl = window.location.origin;
    const demoPath = buildSessionRoutePath(this.getEffectiveSessionSlug(), readPublicUrlBasePath());
    const inviteLinks = buildSbtPagePasswordExportRows({
      baseUrl,
      codeLabel,
      demoPath,
      encodeGroupPassword: encodeSbtPageGroupPassword,
      isInvite,
      passwordsToExport,
      sbtAddr,
      sbtBasePathValue: sbtBasePath(),
    });

    const date = new Date().toISOString().slice(0, 10);
    const sbtSymbolOrName = getSbtDisplayName(this.state.sbtInfo) || t('sbt');
    const exportFile = buildSbtPagePasswordExportFile({
      codeLabel,
      date,
      fileLabel,
      format: exportFormat,
      rows: inviteLinks,
      sbtSymbolOrName,
    });
    if (!exportFile) return;

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

  resolveFullActionDisplayPlan = (): SbtPageFullActionDisplayPlan => {
    const {
      burningStatus,
      claimCountdown,
      groupPasswordInput,
      lastMintTxHash,
      manualPasswordInput,
      mintingStatus,
      mintStep,
      sbtInfo,
      userHasSBT,
    } = this.state;

    return resolveSbtPageFullActionDisplayPlan({
      account: this.props.account,
      actionClassName: styles.actionButton,
      burnedLabel: t('burned'),
      burningStatus,
      burnButtonClassName: styles.burnButton,
      burnLabel: t('burn'),
      claimCountdown,
      groupPasswordInput,
      hasGroupPasswordMint: this.state.hasGroupPasswordMint,
      hasInviteMint: this.state.hasInviteMint,
      lastMintTxHash,
      manualPasswordInput,
      mintedLabel: t('minted'),
      mintButtonClassName: styles.mintButton,
      mintLowerLabel: t('mintLower'),
      mintingStatus,
      mintStep,
      nowSeconds: Math.floor(Date.now() / 1000),
      sbtInfo,
      sbtMintedSuccessLabel: `${t('sbt')} successfully ${t('mintedLower')}!`,
      userHasSBT,
    });
  };

  renderFullActionSurfaces = (
    actionDisplayPlan: SbtPageFullActionDisplayPlan = this.resolveFullActionDisplayPlan(),
  ): SbtPageFullActionSurfaces => {
    const { groupPasswordInput, lastMintTxHash } = this.state;

    return renderSbtPageFullActionSurfaces({
      actionDisplayPlan,
      burnExecution: {
        onBurn: this.handleBurn,
      },
      groupPasswordInput: groupPasswordInput || '',
      mintExecution: {
        onClaimWithInviteCode: this.claimWithInviteCode,
        onGroupPasswordInputChange: this.handleGroupPasswordInputChange,
        onManualPasswordInputChange: this.handleManualPasswordInputChange,
        onMint: this.handleMint,
        onMintUnlimitedWithGroupPassword: this.mintUnlimitedWithGroupPassword,
        onOpenMintTransaction: () => window.open(this.getExplorerLink(lastMintTxHash), '_blank', 'noopener,noreferrer'),
      },
    });
  };

  renderRelevantInfo = (): React.ReactNode => {
    const { sbtInfo } = this.state;
    const { documentIDHashes, documentURLs, tags } = resolveSbtPageRelevantInfoLists({ sbtInfo });
    const relevantInfoDisplayState = resolveSbtPageRelevantInfoDisplayState({
      documentIDHashes,
      documentURLs,
      tags,
    });

    return (
      <SbtPageRelevantInfo
        documentIDHashes={documentIDHashes}
        documentURLs={documentURLs}
        onOpenEncryptedDoc={this.openEncryptedDoc}
        shouldRenderDocumentIdHashes={relevantInfoDisplayState.shouldRenderDocumentIdHashes}
        shouldRenderDocumentUrls={relevantInfoDisplayState.shouldRenderDocumentUrls}
        shouldRenderTags={relevantInfoDisplayState.shouldRenderTags}
        tags={tags}
      />
    );
  };

  cacheTransactionHash = (txHash: string, accountOverride: unknown = null): void => {
    const userAddress = String(accountOverride || this.props.account || '')
      .trim()
      .toLowerCase();
    if (!userAddress) return;
    try {
      const txCache = this.readQueuedOrStoredLocalStorageJson<TransactionStorageCache>('transactions', {});
      const next = appendSbtPageTransactionHash({
        cacheObj: txCache,
        txHash,
        userAddress,
      });
      if (next.shouldWrite) {
        this.queueLocalStorageJsonWrite('transactions', next.txCache as TransactionStorageCache);
      }
    } catch (e) {
      sbtLog.warn('SBTPage: fallback', e);
    }
  };

  handleExportFormatChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    if (this._isMounted)
      this.setState(
        buildSbtPageExportFormatPatch({
          exportFormat: event.target.value,
        }),
      );
  };

  handleIncludePreviousPasswordsChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (this._isMounted)
      this.setState(
        buildSbtPageIncludePreviousPasswordsPatch({
          includePreviousPasswords: event.target.checked,
        }),
      );
  };

  handlePasswordGenerationCountChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (this._isMounted)
      this.setState(
        buildSbtPagePasswordGenerationCountPatch({
          value: event.target.value,
        }),
      );
  };

  handleAdminBurn = async (): Promise<void> => {
    const { burnSearchResult } = this.state;
    const burnSearchResultRecord = isRecord(burnSearchResult) ? (burnSearchResult as SbtPageBurnSearchResult) : null;

    if (!burnSearchResult) {
      if (this._isMounted) this.setState(buildSbtPageErrorPatch({ error: 'No token selected to burn' }));
      return;
    }
    if (this._isMounted) this.setState(buildSbtPageBurnPendingPatch());

    const sbtAddressOriginalCaseForAdminBurn = resolveSbtAddressString(this.props.SBTAddress);
    if (!sbtAddressOriginalCaseForAdminBurn) {
      if (this._isMounted)
        this.setState(
          buildSbtPageBurnFailurePatch({ error: `${t('sbt')} address not found for admin ${t('burnLower')}.` }),
        );
      return;
    }

    const tx = await sbtAdminOpsPort.burnToken(
      this.props.provider,
      sbtAddressOriginalCaseForAdminBurn,
      burnSearchResultRecord?.tokenId,
    );
    await this.loadSBTInfo(true);
    if (this._isMounted)
      this.setState(
        buildSbtPageBurnSuccessPatch({
          resetBurnSearch: true,
          txHash: tx.transactionHash,
        }),
      );
    this.cacheTransactionHash(tx.transactionHash);
  };

  renderAdminActions = (): React.ReactNode => {
    const {
      userIsSbtAdmin,
      sbtInfo,
      burnSearchInput,
      burnSearchResult,
      burningStatus,
      adminGeneratedPasswords,
      cachedPasswords,
      includePreviousPasswords,
      exportFormat,
      encryptedRecoveryEnabled,
      encryptedRecoveryStatus,
      passwordGenerationCount,
    } = this.state;
    if (!userIsSbtAdmin || !sbtInfo) return null;

    const burnSearchResultRecord = isRecord(burnSearchResult) ? (burnSearchResult as SbtPageBurnSearchResult) : null;
    const adminActionDisplayPlan = resolveSbtPageAdminActionDisplayPlan({
      account: this.props.account,
      adminGeneratedPasswords,
      burnedLabel: t('burned'),
      burningStatus,
      burnLabel: t('burn'),
      burnSearchResult,
      cachedPasswords,
      hasInviteMint: this.state.hasInviteMint,
      includePreviousPasswords,
      passwordGenerationCount,
      sbtInfo,
      sbtLabel: t('sbt'),
    });
    const { isInvite } = adminActionDisplayPlan;

    const resolvedSbtAddress = resolveSbtAddress(this.props.SBTAddress);
    const sbtAddr = typeof resolvedSbtAddress === 'string' ? resolvedSbtAddress.toLowerCase() : 'unknown_sbt';

    const baseUrl = window.location.origin;
    const demoPath = buildSessionRoutePath(this.getEffectiveSessionSlug(), readPublicUrlBasePath());
    const passwordInviteLinkContext = {
      baseUrl,
      demoPath,
      encodeGroupPassword: encodeSbtPageGroupPassword,
      isInvite,
      sbtAddr,
      sbtBasePathValue: sbtBasePath(),
    };
    const openMintAutoJoinUrl = this.getOpenMintAutoJoinUrl(sbtAddr);
    const openMintUrlCopyIconState = resolveSbtPageCopyIconState({
      copiedAddress: this.state.copiedAddress,
      targetKey: 'open-mint-url',
    });

    return SbtPageAdminActions({
      burnLabel: t('burn'),
      burnSearchInput,
      burnSearchResultRecord,
      displayPlan: adminActionDisplayPlan,
      exportFormat,
      encryptedRecoveryEnabled,
      encryptedRecoveryStatus,
      onAdminBurn: this.handleAdminBurn,
      onBurnSearchChange: this.handleBurnSearchChange,
      onCopyOpenMintUrl: () => this.copyToClipboard(openMintAutoJoinUrl, 'open-mint-url'),
      onExportFormatChange: this.handleExportFormatChange,
      onExportPasswords: this.exportPasswords,
      onClearLocalRecovery: this.handleClearLocalRecovery,
      onEncryptedRecoveryChange: this.handleEncryptedRecoveryChange,
      onGenerateAdminInvites: this.handleGenerateAdminInvites,
      onIncludePreviousPasswordsChange: this.handleIncludePreviousPasswordsChange,
      onPasswordGenerationCountChange: this.handlePasswordGenerationCountChange,
      openMintAutoJoinUrl,
      openMintUrlCopyIconState,
      passwordInviteLinkContext,
      passwordGenerationCount,
      hasLocalRecovery: cachedPasswords.length > 0 || encryptedRecoveryEnabled,
      sbtLabel: t('sbt'),
    });
  };

  copyErrorToClipboard = async (): Promise<void> => {
    const raw = resolveSbtPageCopyableErrorText(this.state.error);
    if (!raw) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard write is unavailable');
      await navigator.clipboard.writeText(raw);
      notify.success('Copied to clipboard');
      if (this._isMounted) {
        this.setState(buildSbtPageCopiedErrorPatch({ copied: true }), () => {
          setTimeout(() => {
            if (this._isMounted) this.setState(buildSbtPageCopiedErrorPatch());
          }, 2000);
        });
      }
    } catch (error: unknown) {
      sbtLog.warn('SBTPage error clipboard write failed', error);
      notify.warn('Copy failed');
    }
  };

  render() {
    const { SBTAddress: SBTAddressProp, miniaturized, miniMintable } = this.props;
    const {
      sbtInfo,
      userHasSBT,
      userIsSbtAdmin,
      mintCountdown,
      error,
      bookmarked,
      showModal,
      showFullImage,
      mintedAddresses,
      burnedAddresses,
      countsLoaded,
      showStats,
      showActions,
      showMoreDetails,
      showAdminSection,
      showDocsSection,
      loadingMintersBurners,
      mintingStatus,
      burningStatus,
      showPasswordAlert,
      transactionHash,
      lastMintTxHash,
      lastBurnTxHash,
      mintStep,
      mintPassword,
      manualPasswordInput,
      claimCountdown,
      docModalOpen,
      docModalLoading,
      docModalError,
      docModalContent,
      docModalName,
      docModalBlobUrl,
    } = this.state;

    const sbtAddressForDisplay = resolveSbtAddressString(SBTAddressProp);
    const sbtDetailPath = buildSbtDetailPath(sbtAddressForDisplay, this.getEffectiveSessionSlug());
    const identityPanelDisplayState = resolveSbtPageIdentityPanelDisplayState({
      defaultImage: defaultSbtImage,
      fallbackState: this.state,
      sbtInfo,
      unnamedLabel: `Unnamed ${t('sbt')}`,
    });
    const sbtNameText = identityPanelDisplayState.nameText;
    const displayImageState = identityPanelDisplayState.displayImageState;
    const imageUrl = identityPanelDisplayState.imageUrl;
    const imageErrorHandler = displayImageState?.canRetry
      ? () => this.handleDisplayImageError(displayImageState)
      : undefined;

    // Miniaturized card view
    if (miniaturized) {
      if (!sbtInfo) {
        return (
          <div className={styles.loading}>
            <FontAwesomeIcon icon={faSpinner} spin /> Loading...
          </div>
        );
      }
      if (!sbtAddressForDisplay) {
        return null;
      }
      if (error && !sbtInfo) {
        return <div className={styles.error}>Error: {error}</div>;
      }

      const showMiniSbtAddress = isCryptoMode();
      const {
        hasTokenMini,
        isMintingActive,
        mintStatusId,
        miniActionFailureState,
        miniActionFailureStatusDisplayState,
        miniActionStatusDisplayState,
        miniBurnActionButtonClassName,
        miniBurnActionPlan,
        miniBurnButtonState,
        miniBurnContentState,
        miniControlDisplayState,
        miniInviteControlDisplayState,
        miniManualClaimActionRequest,
        miniMintActionButtonClassName,
        miniMintActionPlan,
        miniOpenMintButtonState,
        miniPasswordControlDisplayState,
        miniPasswordJoinButtonState,
        miniPasswordJoinContentState,
        miniTokenActionDisplayState,
        shouldRenderEndedIndicator,
        shouldRenderLiveIndicator,
      } = resolveSbtPageMiniCardDisplayState({
        account: this.props.account,
        actionClassName: styles.actionButton,
        burnButtonClassName: styles.burnButton,
        burnLabel: t('burn'),
        burningStatus,
        claimCountdown,
        groupPasswordInput: this.state.groupPasswordInput,
        hasGroupPasswordMint: this.state.hasGroupPasswordMint,
        hasInviteMint: this.state.hasInviteMint,
        manualPasswordInput,
        mintedLabel: t('minted'),
        miniButtonClassName: styles.miniButton,
        miniMintable,
        mintButtonClassName: styles.mintButton,
        mintingStatus,
        nowSec: Math.floor(Date.now() / 1000),
        sbtAddress: sbtAddressForDisplay,
        sbtInfo,
        mintStep,
        showMiniPasswordInput: this.state.showMiniPasswordInput,
        userHasSBT,
        userIsSbtAdmin,
      });
      const miniCardActionHandlers = buildSbtPageMiniCardActionHandlers({
        groupPasswordInput: this.state.groupPasswordInput,
        miniBurnActionPlan,
        miniBurnDisabled: !!miniBurnButtonState?.disabled,
        miniMintActionPlan,
        ports: {
          dispatchGroupPasswordMint: this.mintUnlimitedWithGroupPassword,
          dispatchInviteCodeMint: this.claimWithInviteCode,
          dispatchMiniBurn: this.miniBurnHandler,
          dispatchMiniMint: this.miniMintHandler,
          dispatchShowPasswordInput: () => this.setState(buildSbtPageMiniPasswordInputPatch({ visible: true })),
        },
      });

      return (
        <SbtPageMiniCard
          burnLabel={t('burn')}
          burnedLabel={t('burned')}
          cardStyle={resolveSbtPageInteractiveCursorStyle()}
          groupPasswordInput={this.state.groupPasswordInput || ''}
          hasTokenMini={hasTokenMini}
          imageUrl={imageUrl}
          isMintingActive={isMintingActive}
          miniActionFailureState={miniActionFailureState}
          miniActionFailureStatusStyle={miniActionFailureStatusDisplayState.style}
          miniActionStatusStyle={miniActionStatusDisplayState.style}
          miniBurnActionButtonClassName={miniBurnActionButtonClassName}
          miniBurnButtonState={miniBurnButtonState}
          miniBurnContentState={miniBurnContentState}
          miniControlTopMarginStyle={miniControlDisplayState.topMarginStyle}
          miniInviteInputStyle={miniInviteControlDisplayState.inputStyle}
          miniManualClaimActionRequest={miniManualClaimActionRequest}
          miniMintActionPlan={miniMintActionPlan}
          miniMintActionButtonClassName={miniMintActionButtonClassName}
          miniOpenMintButtonState={miniOpenMintButtonState}
          miniPasswordControlInputStyle={miniPasswordControlDisplayState.inputStyle}
          miniPasswordJoinButtonState={miniPasswordJoinButtonState}
          miniPasswordJoinContentState={miniPasswordJoinContentState}
          miniTokenActionDisplayState={miniTokenActionDisplayState}
          mintFailedLabel={`${t('mint')} Failed`}
          mintStatusId={mintStatusId}
          mintedLabel={t('minted')}
          mintingLabel={t('minting')}
          onCardClick={(event: React.MouseEvent<HTMLDivElement>) => {
            const interactiveAncestor = findNestedInteractiveElement(event.target);
            if (interactiveAncestor && interactiveAncestor !== event.currentTarget) return;
            event.preventDefault();
            event.stopPropagation();
            window.open(`${window.location.origin}${sbtDetailPath}`, '_blank', 'noopener,noreferrer');
          }}
          onCardKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const interactiveAncestor = findNestedInteractiveElement(event.target);
            if (interactiveAncestor && interactiveAncestor !== event.currentTarget) return;
            event.preventDefault();
            window.open(`${window.location.origin}${sbtDetailPath}`, '_blank', 'noopener,noreferrer');
          }}
          onClaimWithInviteCode={miniCardActionHandlers.onClaimWithInviteCode}
          onGroupPasswordInputChange={this.handleGroupPasswordInputChange}
          onImageError={imageErrorHandler}
          onManualPasswordInputChange={this.handleManualPasswordInputChange}
          onMiniBurn={miniCardActionHandlers.onMiniBurn}
          onMiniMint={miniCardActionHandlers.onMiniMint}
          onMintUnlimitedWithGroupPassword={miniCardActionHandlers.onMintUnlimitedWithGroupPassword}
          onShowMiniPasswordInput={miniCardActionHandlers.onShowMiniPasswordInput}
          sbtAddress={sbtAddressForDisplay}
          sbtName={sbtNameText}
          shouldRenderEndedIndicator={shouldRenderEndedIndicator}
          shouldRenderLiveIndicator={shouldRenderLiveIndicator}
          showLockIcon={!!(sbtInfo.hasPasswordMint || this.state.hasGroupPasswordMint)}
          showMiniSbtAddress={showMiniSbtAddress}
        />
      );
    }

    // Full page view
    const fullViewShellState = resolveSbtPageFullViewShellState({
      error,
      hasSbtAddress: !!sbtAddressForDisplay,
      sbtInfo,
    });
    if (fullViewShellState.shouldRenderMissingAddress) {
      return null;
    }
    if (fullViewShellState.shouldRenderError) {
      return <div className={styles.error}>Error: {error}</div>;
    }
    if (fullViewShellState.shouldRenderLoading) {
      return renderSbtPageFullViewLoading({ sbtLabel: t('sbt') });
    }
    const netHolders = this.getMemoizedNetHoldersList(mintedAddresses, burnedAddresses);
    const scanProgress = this.getEffectiveHolderScanProgress();
    const filterNetwork = this.state.network || this.props.network || null;
    const fullActionDisplayPlan = this.resolveFullActionDisplayPlan();
    const actionSurfaces = this.renderFullActionSurfaces(fullActionDisplayPlan);
    return renderSbtPageFullView({
      actionLabels: {
        burn: t('burn'),
        burnedLower: t('burnedLower'),
        mint: t('mint'),
        mintedLower: t('mintedLower'),
        minting: t('minting'),
      },
      actionSurfaces,
      adminActions: this.renderAdminActions(),
      callbacks: {
        bookmarkSBT: this.bookmarkSBT,
        closeDocModal: this.closeDocModal,
        closeModal: this.closeModal,
        copyErrorToClipboard: this.copyErrorToClipboard,
        copyToClipboard: this.copyToClipboard,
        getExplorerLink: this.getExplorerLink,
        getExplorerUrl: this.getExplorerUrl,
        handleModalFilteredMintedUsers: this.handleModalFilteredMintedUsers,
        onBackToList: () => {
          window.location.href = sbtsListPath();
        },
        openMintedModal: this.openMintedModal,
        renderAddressLink: this.renderAddressLink,
        toggleActions: this.toggleActions,
        toggleAdminSection: this.toggleAdminSection,
        toggleFullImage: this.toggleFullImage,
        toggleMoreDetails: this.toggleMoreDetails,
        toggleStats: this.toggleStats,
      },
      defaultFeaturedSBTs: this.getSessionSBTAddresses(),
      filterNetwork,
      identityPanelDisplayState,
      imageErrorHandler,
      imageUrl,
      isHolderScanActive: this.isHolderScanActive(),
      isSBTCacheReady: this.props.isSBTCacheReady,
      mintedLabel: t('minted'),
      netHolders,
      networkId: this.state.network?.id,
      provider: this.props.provider,
      relevantInfo: this.renderRelevantInfo(),
      resolveScanProgressSessionLabel: (progress: { sessionLabel?: string; sessionSlug?: string } | null) =>
        progress?.sessionLabel ||
        this.getSessionDisplayLabel(progress?.sessionSlug || this.getEffectiveSessionSlug()) ||
        '',
      sbtAddressForDisplay,
      sbtCacheRevision: this.props.sbtCacheRevision,
      sbtInfo: sbtInfo as Record<string, unknown> | null,
      sbtLabel: t('sbt'),
      sbtMintPassword: this.props.sbtMintPassword,
      scanProgress,
      sessionSlug: this.getEffectiveSessionSlug(),
      state: {
        bookmarked,
        burnedAddresses,
        burningStatus,
        copiedAddress: this.state.copiedAddress,
        copiedError: this.state.copiedError,
        countsLoaded,
        docModalBlobUrl,
        docModalContent,
        docModalError,
        docModalLoading,
        docModalName,
        docModalOpen,
        error,
        filteredMintedUsers: this.state.filteredMintedUsers,
        lastBurnTxHash,
        lastMintTxHash,
        loadingMintersBurners,
        loadingMintedFilter: this.state.loadingMintedFilter,
        mintCountdown,
        mintedAddresses,
        mintedTokensOverride: this.state.mintedTokensOverride,
        mintingStatus,
        mintPassword,
        showActions,
        showAdminSection,
        showFullImage,
        showModal,
        showMoreDetails,
        showPasswordAlert,
        showStats,
        transactionHash,
        userIsSbtAdmin,
      },
      workerScanInProgress: this.props.sbtScanInProgress,
      workerScanPending: this.props.sbtScanPending,
    });
  }
}

export default SBTPage;
