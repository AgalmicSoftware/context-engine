import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import SBTPage from '../SBTs/SBTPage';
import StatsSection from './UserStats';
import styles from './UserPage.module.scss';

type UserPageSurveyPreviewEntry = {
  questionsCount?: React.ReactNode;
  title?: React.ReactNode;
};

type UserPageFullProfileModalDisplayState = {
  shouldRenderBookmarksLink?: boolean;
  shouldRenderModalActions?: boolean;
  shouldRenderSurveyEmptyText?: boolean;
  shouldRenderSurveyList?: boolean;
  shouldRenderSurveySpinner?: boolean;
};

type UserPageSbtDisplayState = {
  shouldRenderModalEmptyText?: boolean;
  shouldRenderModalSpinner?: boolean;
};

type UserPageSbtEntry = {
  sbtInfo: {
    sbtAddress?: unknown;
  };
  slug?: unknown;
};

type UserPageFullProfileModalProps = {
  aiAnalysis?: React.ReactNode;
  bookmarksHref: string;
  collapseOpen?: string | null;
  explorerUrl?: string | null;
  fullProfileModalDisplayState: UserPageFullProfileModalDisplayState;
  isOpen: boolean;
  isSBTCacheReady?: unknown;
  loginComplete?: unknown;
  mintedSbtsHeading: React.ReactNode;
  network?: unknown;
  onRefreshSbtData: (address: unknown, slug?: unknown) => unknown;
  onStatsCollapseToggle: (statType: string) => unknown;
  onToggle: () => void;
  provider?: unknown;
  sbtDisplayState: UserPageSbtDisplayState;
  sbtEmptyText: React.ReactNode;
  sbtEntries: UserPageSbtEntry[];
  surveyResponseEntries: UserPageSurveyPreviewEntry[];
  userStats: Record<string, React.ReactNode>;
};

const UserPageFullProfileModal = ({
  aiAnalysis,
  bookmarksHref,
  collapseOpen,
  explorerUrl,
  fullProfileModalDisplayState,
  isOpen,
  isSBTCacheReady,
  loginComplete,
  mintedSbtsHeading,
  network,
  onRefreshSbtData,
  onStatsCollapseToggle,
  onToggle,
  provider,
  sbtDisplayState,
  sbtEmptyText,
  sbtEntries,
  surveyResponseEntries,
  userStats,
}: UserPageFullProfileModalProps): React.ReactElement => (
  <Modal isOpen={isOpen} toggle={onToggle} size="lg" className={styles.modalContent}>
    <ModalHeader toggle={onToggle} className={styles.modalHeader}>
      Full User Profile
    </ModalHeader>
    <ModalBody className={styles.modalBody}>
      <div className={styles.modalSummary}>
        <h3>User Summary</h3>
        <p>{aiAnalysis || 'Summary not available.'}</p>
      </div>
      <StatsSection userStats={userStats} collapseOpen={collapseOpen} toggleCollapse={onStatsCollapseToggle} />
      <div className={styles.modalSurveys}>
        <h3>Survey Responses</h3>
        {fullProfileModalDisplayState.shouldRenderSurveySpinner ? (
          <FontAwesomeIcon icon={faSpinner} spin id={styles.loadingIcon} />
        ) : fullProfileModalDisplayState.shouldRenderSurveyEmptyText ? (
          <p>No survey responses.</p>
        ) : fullProfileModalDisplayState.shouldRenderSurveyList ? (
          surveyResponseEntries.map((survey, index: number) => (
            <div key={index} className={styles.surveyPreview}>
              <div className={styles.surveyTitle}>{survey.title}</div>
              <div className={styles.surveyInfo}>Questions: {survey.questionsCount}</div>
            </div>
          ))
        ) : null}
      </div>
      <div className={styles.modalSBTs}>
        <h3>{mintedSbtsHeading}</h3>
        {sbtDisplayState.shouldRenderModalSpinner ? (
          <FontAwesomeIcon icon={faSpinner} spin id={styles.loadingIcon} />
        ) : sbtDisplayState.shouldRenderModalEmptyText ? (
          <p>{sbtEmptyText}</p>
        ) : (
          sbtEntries.map((sbtItem, index: number) => (
            <SBTPage
              key={index}
              SBTAddress={sbtItem.sbtInfo.sbtAddress}
              provider={provider}
              network={network}
              miniaturized={true}
              loginComplete={loginComplete}
              isSBTCacheReady={isSBTCacheReady}
              metadataOnly={true}
              sessionSlug={sbtItem.slug}
              refreshSbtData={(addr: unknown) => onRefreshSbtData(addr, sbtItem.slug)}
            />
          ))
        )}
      </div>
      {fullProfileModalDisplayState.shouldRenderModalActions && (
        <div className={styles.modalActions}>
          {fullProfileModalDisplayState.shouldRenderBookmarksLink && (
            <a href={bookmarksHref} className={styles.bookmarksLink}>
              My Bookmarks <FontAwesomeIcon icon={faExternalLinkAlt} />
            </a>
          )}
          <a href={explorerUrl || undefined} target="_blank" rel="noopener noreferrer" className={styles.explorerLink}>
            View on Explorer <FontAwesomeIcon icon={faExternalLinkAlt} />
          </a>
        </div>
      )}
    </ModalBody>
  </Modal>
);

export default UserPageFullProfileModal;
