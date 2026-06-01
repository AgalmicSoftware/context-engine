import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faChevronDown,
  faChevronUp,
  faInfinity,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';
import { Alert } from 'reactstrap';

import contextEngineLoadingGif from '../../assets/img/context_engine_logo_animation.gif';
import { getChainLabelById } from '../../utilities/web3/contractScripts.js';
import { getShortenedAddress, getShortenedTransactionHash } from '../../utilities/ui/displayHelpers.js';
import CETooltip from '../Shared/CETooltip';
import styles from './SBTPage.module.scss';
import {
  renderSbtPageDocModal,
  renderSbtPageFullImageModal,
  renderSbtPageHolderModal,
} from './SBTPageModals';
import SbtPageActionsSection from './SbtPageActionsSection';
import SbtPageIdentityPanel from './SbtPageIdentityPanel';
import SbtPageStatsSection from './SbtPageStatsSection';
import {
  buildSbtPageSectionHeaderClassName,
  resolveSbtPageActionFeedbackState,
  resolveSbtPageAdminCreatorAddresses,
  resolveSbtPageBookmarkButtonDisplayState,
  resolveSbtPageBurnAuthLabel,
  resolveSbtPageCopyErrorButtonStyle,
  resolveSbtPageCopyIconState,
  resolveSbtPageHolderDisplayModel,
  resolveSbtPageInlineLockIconStyle,
  resolveSbtPageInteractiveCursorStyle,
  resolveSbtPageMaxTokensDisplay,
  resolveSbtPageMintEndDisplayState,
  resolveSbtPagePasswordAlertState,
  resolveSbtPageQuestionIconStyle,
  resolveSbtPageRefreshIndicatorStyle,
  resolveSbtPageSectionToggleDisplayState,
  resolveSbtPageTokenMetadataLinkDisplayState,
} from './sbtPageHelpers';

type SbtPageInfoForFullView = Record<string, unknown>;

type SbtPageIdentityDisplayState = {
  descriptionText: string;
  imageAlt: string;
  nameText: string;
  showDescriptionLockIcon: boolean;
};

type SbtPageFullViewState = {
  bookmarked: boolean;
  burnedAddresses: unknown[];
  burningStatus: string;
  copiedAddress?: unknown;
  copiedError?: unknown;
  countsLoaded: boolean;
  docModalBlobUrl: string;
  docModalContent: string;
  docModalError: string;
  docModalLoading: boolean;
  docModalName: string;
  docModalOpen: boolean;
  error?: unknown;
  filteredMintedUsers: unknown[];
  lastBurnTxHash?: unknown;
  lastMintTxHash?: unknown;
  loadingMintersBurners: boolean;
  loadingMintedFilter: boolean;
  mintCountdown: React.ReactNode;
  mintedAddresses: unknown[];
  mintedTokensOverride?: unknown;
  mintingStatus: string;
  mintPassword: string;
  showActions: boolean;
  showAdminSection: boolean;
  showFullImage: boolean;
  showModal: boolean;
  showMoreDetails: boolean;
  showPasswordAlert: boolean;
  showStats: boolean;
  transactionHash?: unknown;
  userIsSbtAdmin: boolean;
};

type SbtPageFullViewCallbacks = {
  closeDocModal: () => void;
  closeModal: () => void;
  copyErrorToClipboard: React.MouseEventHandler<HTMLButtonElement>;
  copyToClipboard: (text: unknown, addressType: unknown) => void;
  getExplorerLink: (hash: unknown) => string;
  getExplorerUrl: (address: unknown) => string;
  handleModalFilteredMintedUsers: (filtered: unknown) => void;
  openMintedModal: React.MouseEventHandler<HTMLButtonElement>;
  renderAddressLink: (address: unknown, key?: string) => React.ReactNode;
  toggleActions: React.MouseEventHandler<HTMLHeadingElement>;
  toggleAdminSection: React.MouseEventHandler<HTMLHeadingElement>;
  toggleFullImage: () => void;
  toggleMoreDetails: React.MouseEventHandler<HTMLHeadingElement>;
  toggleStats: React.MouseEventHandler<HTMLHeadingElement>;
  bookmarkSBT: React.MouseEventHandler<HTMLButtonElement>;
  onBackToList: React.MouseEventHandler<HTMLButtonElement>;
};

type RenderSbtPageFullViewArgs = {
  adminActions: React.ReactNode;
  actionLabels: {
    burn: string;
    burnedLower: string;
    mint: string;
    mintedLower: string;
    minting: string;
  };
  callbacks: SbtPageFullViewCallbacks;
  defaultFeaturedSBTs: string[];
  filterNetwork?: unknown;
  identityPanelDisplayState: SbtPageIdentityDisplayState;
  imageErrorHandler?: React.ReactEventHandler<HTMLImageElement>;
  imageUrl: string;
  isHolderScanActive: boolean;
  isSBTCacheReady?: unknown;
  mintedLabel: string;
  netHolders: unknown[];
  networkId?: unknown;
  provider?: unknown;
  relevantInfo: React.ReactNode;
  resolveScanProgressSessionLabel?: (
    progress: { sessionLabel?: string; sessionSlug?: string } | null
  ) => unknown;
  sbtAddressForDisplay: string;
  sbtCacheRevision?: unknown;
  sbtInfo: SbtPageInfoForFullView | null;
  sbtLabel: string;
  sbtMintPassword?: unknown;
  scanProgress?: unknown;
  sessionSlug: string;
  state: SbtPageFullViewState;
  workerScanInProgress?: unknown;
  workerScanPending?: unknown;
  burnButton: React.ReactNode;
  mintButton: React.ReactNode;
};

export const renderSbtPageFullViewLoading = ({
  sbtLabel,
}: {
  sbtLabel: string;
}): React.ReactElement => (
  <div className={styles.loadingPage}>
    <img
      src={contextEngineLoadingGif}
      alt="Context Engine loading"
      className={styles.loadingLogo}
    />
    <div className={styles.loadingTitle}>{`Loading ${sbtLabel} Details`}</div>
  </div>
);

const renderSbtPageMintEndDisplay = ({
  copyToClipboard,
  mintingLabel,
  mintCountdown,
  sbtInfo,
}: {
  copyToClipboard: (text: unknown, addressType: unknown) => void;
  mintingLabel: string;
  mintCountdown: React.ReactNode;
  sbtInfo: SbtPageInfoForFullView | null;
}): React.ReactNode => {
  const mintEndState = resolveSbtPageMintEndDisplayState({ sbtInfo, nowMs: Date.now() });
  if (mintEndState?.status === 'active') {
    return (
      <p>
        <span className={styles.label}>{`${mintingLabel} ends:`}</span>
        <span>{mintCountdown || 'Calculating...'}</span>
      </p>
    );
  }
  if (mintEndState?.status === 'expired') {
    return (
      <p>
        <span className={styles.label}>{`${mintingLabel} Expired`}</span>:
        <span
          className={styles.expiredTime}
          id="mintExpiredTooltip"
          style={resolveSbtPageInteractiveCursorStyle()}
          onClick={() => copyToClipboard(String(mintEndState.unixTS), 'time')}
        >
          {mintEndState.fullMintEndDate}
        </span>
        <FontAwesomeIcon
          icon={faQuestionCircle}
          style={resolveSbtPageQuestionIconStyle()}
          id="expiredTimeQuestionMark"
        />
        <CETooltip
          placement="right"
          target="expiredTimeQuestionMark"
          delay={{ show: 0, hide: 2500 }}
          className={styles.tooltipBubble}
          innerClassName={styles.tooltipInner}
        >
          Click date to copy Unix timestamp: {mintEndState.unixTS}
        </CETooltip>
      </p>
    );
  }
  if (mintEndState?.status === 'never') {
    return (
      <p>
        <span className={styles.label}>{`${mintingLabel} ends:`}</span>
        <span><FontAwesomeIcon icon={faInfinity} /> Never</span>
      </p>
    );
  }
  return null;
};

export const renderSbtPageFullView = ({
  adminActions,
  actionLabels,
  callbacks,
  defaultFeaturedSBTs,
  filterNetwork,
  identityPanelDisplayState,
  imageErrorHandler,
  imageUrl,
  isHolderScanActive,
  isSBTCacheReady,
  mintedLabel,
  netHolders,
  networkId,
  provider,
  relevantInfo,
  resolveScanProgressSessionLabel,
  sbtAddressForDisplay,
  sbtCacheRevision,
  sbtInfo,
  sbtLabel,
  sbtMintPassword,
  scanProgress,
  sessionSlug,
  state,
  workerScanInProgress,
  workerScanPending,
  burnButton,
  mintButton,
}: RenderSbtPageFullViewArgs): React.ReactElement => {
  const {
    bookmarked,
    burnedAddresses,
    burningStatus,
    copiedAddress,
    copiedError,
    countsLoaded,
    docModalBlobUrl,
    docModalContent,
    docModalError,
    docModalLoading,
    docModalName,
    docModalOpen,
    error,
    filteredMintedUsers,
    lastBurnTxHash,
    lastMintTxHash,
    loadingMintersBurners,
    loadingMintedFilter,
    mintCountdown,
    mintedAddresses,
    mintedTokensOverride,
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
  } = state;
  const {
    closeDocModal,
    closeModal,
    copyErrorToClipboard,
    copyToClipboard,
    getExplorerLink,
    getExplorerUrl,
    handleModalFilteredMintedUsers,
    openMintedModal,
    renderAddressLink,
    toggleActions,
    toggleAdminSection,
    toggleFullImage,
    toggleMoreDetails,
    toggleStats,
    bookmarkSBT,
    onBackToList,
  } = callbacks;

  const loadingScreen = renderSbtPageFullViewLoading({ sbtLabel });
  if (!sbtInfo && !error) {
    return loadingScreen;
  }

  const passwordAlertState = resolveSbtPagePasswordAlertState({
    mintPassword,
    sbtMintPassword,
    showPasswordAlert,
  });
  const holderDisplayModel = resolveSbtPageHolderDisplayModel({
    countsLoaded,
    filteredMintedUsers,
    isScanActive: isHolderScanActive,
    loadingMintersBurners,
    loadingMintedFilter,
    mintedAddresses,
    mintedTokensOverride,
    netHolders,
    scanProgress: scanProgress as never,
    sbtScanInProgress: workerScanInProgress,
    sbtScanPending: workerScanPending,
    showModal,
    resolveScanProgressSessionLabel: resolveScanProgressSessionLabel as never,
  });
  const {
    filteredMintedUsers: displayedFilteredMintedUsers,
    hasComputedHolders,
    hasFilteredHolders,
    holdersDisplayCount,
    holderItemsForFilter,
    isInitialLoading,
    isRefreshing,
    mintedCountTitle,
    netMinted,
    scanProgressFillStyle,
    scanProgressPct,
    scanProgressSessionText,
    scanProgressText,
    showApproximateCountHint,
    showCornerSpinner,
    showEmptyStateInModal,
    showHeaderCount,
    showScanProgress,
    showScanProgressInModal,
    showSpinnerInModalBody,
  } = holderDisplayModel;
  const burnLabel = resolveSbtPageBurnAuthLabel(sbtInfo?.burnAuth);
  const maxTokensDisplay = resolveSbtPageMaxTokensDisplay(sbtInfo?.maxTokens);
  const tokenMetadataLinkDisplayState = resolveSbtPageTokenMetadataLinkDisplayState({
    tokenUriRaw: sbtInfo?.tokenURI || sbtInfo?.tokenUri || '',
  });
  const { adminAddress, creatorAddress } = resolveSbtPageAdminCreatorAddresses(sbtInfo);
  const actionFeedbackState = resolveSbtPageActionFeedbackState({
    burningStatus,
    error,
    lastBurnTxHash,
    lastMintTxHash,
    mintingStatus,
    transactionHash,
  });
  const contractCopyIconState = resolveSbtPageCopyIconState({
    copiedAddress,
    targetKey: 'contract',
  });
  const errorCopyIconState = resolveSbtPageCopyIconState({
    copied: copiedError,
  });
  const bookmarkButtonDisplayState = resolveSbtPageBookmarkButtonDisplayState({
    bookmarked,
  });
  const statsSectionToggleState = resolveSbtPageSectionToggleDisplayState({ open: showStats });
  const actionsSectionToggleState = resolveSbtPageSectionToggleDisplayState({ open: showActions });
  const adminSectionToggleState = resolveSbtPageSectionToggleDisplayState({ open: showAdminSection });
  const moreDetailsSectionToggleState = resolveSbtPageSectionToggleDisplayState({ open: showMoreDetails });
  const sectionHeaderClassName = buildSbtPageSectionHeaderClassName({
    baseClassName: styles.sectionHeader,
    roundedClassName: styles.roundedHeader,
  });
  const mintEndDisplay = renderSbtPageMintEndDisplay({
    copyToClipboard,
    mintingLabel: actionLabels.minting,
    mintCountdown,
    sbtInfo,
  });
  const addressDisplay = getShortenedAddress(sbtAddressForDisplay, false);

  return (
    <div className={styles.sbtPage}>
      <button onClick={onBackToList} className={styles.backButton}>
        <FontAwesomeIcon icon={faArrowLeft} /> {`${sbtLabel} list`}
      </button>
      {passwordAlertState.showDetectedPasswordAlert && (
        <Alert color="info" className={styles.passwordAlert} fade={false}>
          Password detected – click "start claim" to mint
        </Alert>
      )}
      {sbtInfo ? (
        <div className={styles.sbtInfo}>
          <SbtPageIdentityPanel
            addressDisplay={addressDisplay}
            bookmarkIconStyle={bookmarkButtonDisplayState.iconStyle}
            contractCopyIconState={contractCopyIconState}
            descriptionLockIconStyle={resolveSbtPageInlineLockIconStyle()}
            descriptionText={identityPanelDisplayState.descriptionText}
            explorerUrl={getExplorerUrl(sbtAddressForDisplay)}
            imageAlt={identityPanelDisplayState.imageAlt}
            imageUrl={imageUrl}
            nameText={identityPanelDisplayState.nameText}
            onBookmark={bookmarkSBT}
            onContractCopy={() => copyToClipboard(sbtAddressForDisplay, 'contract')}
            onImageError={imageErrorHandler}
            onImageOpen={toggleFullImage}
            showDescriptionLockIcon={identityPanelDisplayState.showDescriptionLockIcon}
            tokenUriHref={tokenMetadataLinkDisplayState.href}
          />
          <div className={styles.rightColumn}>
            <SbtPageStatsSection
              adminAddressDisplay={renderAddressLink(adminAddress, 'admin')}
              burnLabel={burnLabel}
              creatorAddressDisplay={renderAddressLink(creatorAddress, 'creator')}
              isInitialLoading={isInitialLoading}
              isOpen={statsSectionToggleState.isOpen}
              isRefreshing={isRefreshing}
              maxTokensDisplay={maxTokensDisplay}
              mintedCountTitle={mintedCountTitle}
              mintedLabel={mintedLabel}
              mintEndDisplay={mintEndDisplay}
              netMinted={netMinted}
              networkLabel={getChainLabelById(sbtInfo?.chainID || networkId)}
              onOpenMintedModal={openMintedModal}
              onToggle={toggleStats}
              questionIconStyle={resolveSbtPageQuestionIconStyle()}
              refreshIndicatorStyle={resolveSbtPageRefreshIndicatorStyle()}
              scanProgressFillStyle={scanProgressFillStyle}
              scanProgressPct={scanProgressPct}
              scanProgressSessionText={scanProgressSessionText}
              scanProgressText={scanProgressText}
              sectionHeaderClassName={sectionHeaderClassName}
              shouldRenderClosedIcon={statsSectionToggleState.shouldRenderClosedIcon}
              shouldRenderOpenIcon={statsSectionToggleState.shouldRenderOpenIcon}
              showScanProgress={showScanProgress}
            />
            <SbtPageActionsSection
              actionFeedbackState={actionFeedbackState}
              burnButton={burnButton}
              burnLabel={actionLabels.burn}
              burnSuccessHref={actionFeedbackState.showBurnSuccess ? getExplorerLink(lastBurnTxHash) : ''}
              burnSuccessText={actionFeedbackState.showBurnSuccess ? getShortenedTransactionHash(lastBurnTxHash) : ''}
              burnedLowerLabel={actionLabels.burnedLower}
              copyErrorButtonStyle={resolveSbtPageCopyErrorButtonStyle()}
              errorCopyIconState={errorCopyIconState}
              errorMessage={error as React.ReactNode}
              isOpen={actionsSectionToggleState.isOpen}
              mintButton={mintButton}
              mintLabel={actionLabels.mint}
              mintSuccessHref={actionFeedbackState.showMintSuccess ? getExplorerLink(lastMintTxHash) : ''}
              mintSuccessText={actionFeedbackState.showMintSuccess ? getShortenedTransactionHash(lastMintTxHash) : ''}
              mintedLowerLabel={actionLabels.mintedLower}
              onCopyError={copyErrorToClipboard}
              onToggle={toggleActions}
              sbtLabel={sbtLabel}
              sectionHeaderClassName={sectionHeaderClassName}
              shouldRenderClosedIcon={actionsSectionToggleState.shouldRenderClosedIcon}
              shouldRenderOpenIcon={actionsSectionToggleState.shouldRenderOpenIcon}
              transactionErrorHref={actionFeedbackState.showErrorTransactionHash ? getExplorerLink(transactionHash) : ''}
              transactionErrorText={actionFeedbackState.showErrorTransactionHash ? getShortenedTransactionHash(transactionHash) : ''}
            />
            {userIsSbtAdmin && (
              <div className={styles.adminSection}>
                <h2 className={sectionHeaderClassName} onClick={toggleAdminSection}>
                  ADMIN{' '}
                  {adminSectionToggleState.shouldRenderOpenIcon && <FontAwesomeIcon icon={faChevronUp} />}
                  {adminSectionToggleState.shouldRenderClosedIcon && <FontAwesomeIcon icon={faChevronDown} />}
                </h2>
                {adminSectionToggleState.isOpen && (
                  <div className={styles.adminContainer}>
                    {adminActions}
                  </div>
                )}
              </div>
            )}
            <div className={styles.moreDetailsSection}>
              <h2 className={sectionHeaderClassName} onClick={toggleMoreDetails}>
                MORE{' '}
                {moreDetailsSectionToggleState.shouldRenderOpenIcon && <FontAwesomeIcon icon={faChevronUp} />}
                {moreDetailsSectionToggleState.shouldRenderClosedIcon && <FontAwesomeIcon icon={faChevronDown} />}
              </h2>
              {moreDetailsSectionToggleState.isOpen && relevantInfo}
            </div>
          </div>
        </div>
      ) : (
        !error && loadingScreen
      )}

      {renderSbtPageHolderModal({
        isOpen: showModal,
        onClose: closeModal,
        showHeaderCount,
        holdersDisplayCount,
        showCornerSpinner,
        holderItemsForFilter,
        provider,
        network: filterNetwork,
        sessionSlug,
        defaultFeaturedSBTs,
        onFilter: handleModalFilteredMintedUsers,
        isSBTCacheReady,
        sbtCacheRevision,
        loadingMintedFilter,
        hasFilteredHolders,
        hasComputedHolders,
        showScanProgressInModal,
        scanProgressText,
        scanProgressSessionText,
        scanProgressPct,
        scanProgressFillStyle,
        showEmptyStateInModal,
        showApproximateCountHint,
        showSpinnerInModalBody,
        filteredMintedUsers: displayedFilteredMintedUsers,
        copiedAddress,
        copyToClipboard,
        getExplorerUrl,
      })}

      {renderSbtPageFullImageModal({
        isOpen: showFullImage,
        onToggle: toggleFullImage,
        shouldRenderImage: !!sbtInfo,
        imageUrl,
        alt: identityPanelDisplayState.nameText,
        onImageError: imageErrorHandler,
      })}

      {renderSbtPageDocModal({
        isOpen: docModalOpen,
        onClose: closeDocModal,
        loading: docModalLoading,
        error: docModalError,
        content: docModalContent,
        name: docModalName,
        blobUrl: docModalBlobUrl,
      })}
    </div>
  );
};
