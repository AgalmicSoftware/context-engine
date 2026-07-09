import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy, faExternalLinkAlt, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import styles from './SBTPage.module.scss';
import SBTFilter from './SBTFilter';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import { generateBlockieDataUrl } from '../../utilities/ui/blockieAvatars.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { resolveSbtPageCopyIconState } from './sbtPageHelpers';

type SbtPageHolderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  showHeaderCount: boolean;
  holdersDisplayCount: string;
  showCornerSpinner: boolean;
  holderItemsForFilter: unknown[];
  provider?: unknown;
  network?: unknown;
  sessionSlug: string;
  defaultFeaturedSBTs: string[];
  onFilter: (filtered: unknown) => void;
  isSBTCacheReady?: unknown;
  sbtCacheRevision?: unknown;
  loadingMintedFilter: boolean;
  hasFilteredHolders: boolean;
  hasComputedHolders: boolean;
  showScanProgressInModal: boolean;
  scanProgressText: string | null;
  scanProgressSessionText: string | null;
  scanProgressPct: number;
  scanProgressFillStyle: React.CSSProperties;
  showEmptyStateInModal: boolean;
  showApproximateCountHint: boolean;
  showSpinnerInModalBody: boolean;
  filteredMintedUsers: unknown[];
  copiedAddress?: unknown;
  copyToClipboard: (text: unknown, addressType: unknown) => void;
  getExplorerUrl: (address: unknown) => string;
};

export const renderSbtPageHolderModal = ({
  isOpen,
  onClose,
  showHeaderCount,
  holdersDisplayCount,
  showCornerSpinner,
  holderItemsForFilter,
  provider,
  network,
  sessionSlug,
  defaultFeaturedSBTs,
  onFilter,
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
  filteredMintedUsers,
  copiedAddress,
  copyToClipboard,
  getExplorerUrl,
}: SbtPageHolderModalProps) => {
  const closeButton = (
    <button type="button" className={styles.modalCloseButton} onClick={onClose} aria-label="Close holders">
      <FontAwesomeIcon icon={faTimes} />
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      toggle={onClose}
      className={styles.modal}
      contentClassName={styles.modalContent}
      size="lg"
      centered
    >
      <ModalHeader toggle={onClose} close={closeButton} className={styles.modalHeader}>
        <div className={styles.modalTitleStack}>
          <div className={styles.modalTitleRow}>
            <span className={styles.modalTitle}>
              Holders
              {showHeaderCount && <span className={styles.modalTitleCount}>({holdersDisplayCount})</span>}
            </span>
            <div className={styles.holdersHeaderFilter}>
              <SBTFilter
                items={holderItemsForFilter}
                mode="addresses"
                provider={provider}
                network={network}
                sessionSlug={sessionSlug}
                defaultFeaturedSBTs={defaultFeaturedSBTs}
                onFilter={onFilter}
                autoExpand={false}
                isSBTCacheReady={isSBTCacheReady}
                sbtCacheRevision={sbtCacheRevision}
                buttonSurface="light"
              />
            </div>
            {showCornerSpinner && (
              <span className={styles.modalTitleSpinnerRow}>
                <FontAwesomeIcon icon={faSpinner} spin className={styles.cornerSpinner} title="Refreshing holders..." />
              </span>
            )}
          </div>
        </div>
      </ModalHeader>
      <ModalBody className={styles.modalBody}>
        <div>
          {loadingMintedFilter && !hasFilteredHolders && !hasComputedHolders && (
            <div className={styles.filteringStatus}>Filtering...</div>
          )}
          <div className={styles.userList}>
            {showScanProgressInModal && (
              <div className={styles.scanProgress}>
                <FontAwesomeIcon icon={faSpinner} spin className={styles.scanSpinner} />
                <div className={styles.scanProgressContent}>
                  <span className={styles.scanProgressText}>{scanProgressText}</span>
                  {scanProgressSessionText ? (
                    <span className={styles.scanProgressSession}>{scanProgressSessionText}</span>
                  ) : null}
                  <div
                    className={styles.scanProgressBar}
                    role="progressbar"
                    aria-valuenow={scanProgressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className={styles.scanProgressFill} style={scanProgressFillStyle} />
                  </div>
                </div>
              </div>
            )}
            {showEmptyStateInModal && <div className={styles.emptyState}>No holders found.</div>}
            {showApproximateCountHint && (
              <div className={styles.emptyState}>
                Holder addresses not available yet. Showing approximate count only.
              </div>
            )}
            {showSpinnerInModalBody && (
              <div className={styles.emptyState}>
                <FontAwesomeIcon icon={faSpinner} spin size="2x" />
              </div>
            )}

            {filteredMintedUsers.map((address: unknown, index: number) => {
              const copyAddressKey = `modal-addr-${index}`;
              const modalAddressCopyIconState = resolveSbtPageCopyIconState({
                copiedAddress,
                targetKey: copyAddressKey,
              });
              const seed = String(address || 'contextengine-default-seed').toLowerCase();
              const blockieUrl = generateBlockieDataUrl(seed, 8, 4);
              return (
                <div key={index} className={styles.userItem}>
                  <div className={styles.userItemLeft}>
                    {blockieUrl ? <img src={blockieUrl} alt="" className={styles.userBlockie} /> : null}
                    <a
                      href={buildPublicRoute(`/u/${address}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.userAddressLink}
                    >
                      {getShortenedAddress(address, false)}
                    </a>
                  </div>
                  <div className={styles.userItemActions}>
                    <button onClick={() => copyToClipboard(address, copyAddressKey)} className={styles.copyButtonSmall}>
                      {modalAddressCopyIconState.shouldRenderCopiedIcon && <FontAwesomeIcon icon={faCheck} />}
                      {modalAddressCopyIconState.shouldRenderDefaultIcon && <FontAwesomeIcon icon={faCopy} />}
                    </button>
                    <a
                      href={getExplorerUrl(address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.explorerLinkSmall}
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
};

type SbtPageFullImageModalProps = {
  isOpen: boolean;
  onToggle: () => void;
  shouldRenderImage: boolean;
  imageUrl: string;
  alt: string;
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
};

export const renderSbtPageFullImageModal = ({
  isOpen,
  onToggle,
  shouldRenderImage,
  imageUrl,
  alt,
  onImageError,
}: SbtPageFullImageModalProps) => (
  <Modal isOpen={isOpen} toggle={onToggle} centered size="xl" contentClassName={styles.imageModalContent}>
    <ModalBody className={styles.imageModalBody} onClick={onToggle}>
      {shouldRenderImage && <img src={imageUrl} alt={alt} onError={onImageError} />}
    </ModalBody>
  </Modal>
);

type SbtPageDocModalProps = {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  error: string;
  content: string;
  name: string;
  blobUrl: string;
};

export const renderSbtPageDocModal = ({
  isOpen,
  onClose,
  loading,
  error,
  content,
  name,
  blobUrl,
}: SbtPageDocModalProps) => (
  <Modal isOpen={isOpen} toggle={onClose} className={styles.modal} contentClassName={styles.modalContent} size="lg">
    <ModalHeader toggle={onClose} className={styles.modalHeader}>
      <span className={styles.modalTitle}>{name || 'Encrypted document'}</span>
      {loading && <FontAwesomeIcon icon={faSpinner} spin className={styles.headerSpinner} />}
    </ModalHeader>
    <ModalBody className={styles.modalBody}>
      {error && <div className={styles.modalError}>{error}</div>}
      {!error && loading && (
        <div className={styles.modalLoading}>
          <FontAwesomeIcon icon={faSpinner} spin /> Decrypting…
        </div>
      )}
      {!error && !loading && content && <pre className={styles.docModalContent}>{content}</pre>}
      {!error && !loading && !content && blobUrl && (
        <div className={styles.docModalDownload}>
          <a href={blobUrl} download={name || 'document'}>
            Download decrypted file
          </a>
        </div>
      )}
    </ModalBody>
  </Modal>
);
