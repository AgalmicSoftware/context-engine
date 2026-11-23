import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSync } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import type { UserAnalysisBreakdown } from 'utilities/ai/userAnalysisBreakdown';
import type { AnalysisCard } from 'utilities/analysisCard/analysisCardModel';

import styles from './UserPage.module.scss';
import type { UserPageAnalysisCardPicture } from './UserPageAnalysisCard';
import UserPageAnalysisViews, { type UserPageAnalysisCardPublish } from './UserPageAnalysisViews';
import { formatUserPageAnalysisWait, type UserAnalysisGeneration } from './userPageAnalysisStateHelpers';

type UserPageAnalysisCacheStatusState = {
  analysisCacheAge?: React.ReactNode;
  shouldRenderAnalysisCacheStatus?: boolean;
};

type UserPageAnalysisModalDisplayState = {
  shouldRenderAnalysisBody?: boolean;
  shouldRenderAnalyzing?: boolean;
  shouldRenderDetails?: boolean;
  shouldRenderError?: boolean;
  shouldRenderHistoricalAlignment?: boolean;
  shouldRenderHistoricalFigure?: boolean;
  shouldRenderHistoricalReasoning?: boolean;
};

type UserPageAnalysisModalProps = {
  aiAnalysis?: React.ReactNode;
  analysisBreakdown?: UserAnalysisBreakdown | null;
  analysisCacheStatusState: UserPageAnalysisCacheStatusState;
  analysisCard?: AnalysisCard | null;
  analysisCardPending?: boolean;
  analysisCardPicture?: UserPageAnalysisCardPicture | null;
  analysisCardPublish?: UserPageAnalysisCardPublish | null;
  analysisCardSavedAt?: number | null;
  analysisDetails?: React.ReactNode;
  analysisElapsedMs?: number;
  analysisError?: React.ReactNode;
  analysisErrorAction?: string;
  analysisGeneration?: UserAnalysisGeneration | null;
  analysisHistoricalFigure?: React.ReactNode;
  analysisHistoricalReasoning?: React.ReactNode;
  analysisModalDisplayState: UserPageAnalysisModalDisplayState;
  analysisName?: React.ReactNode;
  analyzing?: boolean;
  isOpen: boolean;
  onAnalysisCardShownChange?: (shown: boolean) => void;
  onOpenAiSettings?: React.MouseEventHandler<HTMLButtonElement>;
  onRefreshAnalysis: React.MouseEventHandler<HTMLButtonElement>;
  onToggle: () => void;
  /** The card this person shows on their page. It stays in the box while an analysis is awaited or has failed. */
  savedCard?: React.ReactNode;
};

// The quick first read, while the analysis is being written or after it failed. Once the analysis is on screen
// the same two places hold its summary and details, so this is drawn only when the analysis itself is not.
const AnalysisFirstRead = ({ headline, lines }: { headline: React.ReactNode; lines: React.ReactNode }) => (
  <div className={styles.analysisFirstRead} data-testid="analysis-first-read" role="status">
    <p className={styles.analysisFirstReadLabel}>First read</p>
    <p className={styles.analysisFirstReadHeadline}>{headline}</p>
    {typeof lines === 'string' && lines ? (
      <ul>
        {lines
          .split('\n')
          .filter(Boolean)
          .map((line, index) => (
            // Keyed by place: the lines never reorder, and two may read the same.
            <li key={index}>{line}</li>
          ))}
      </ul>
    ) : null}
  </div>
);

const UserPageAnalysisModal = ({
  aiAnalysis,
  analysisBreakdown = null,
  analysisCacheStatusState,
  analysisCard = null,
  analysisCardPending = false,
  analysisCardPicture = null,
  analysisCardPublish = null,
  analysisCardSavedAt = null,
  analysisDetails,
  analysisElapsedMs = 0,
  analysisError,
  analysisErrorAction = '',
  analysisGeneration,
  analysisHistoricalFigure,
  analysisHistoricalReasoning,
  analysisModalDisplayState,
  analysisName,
  analyzing = false,
  isOpen,
  onAnalysisCardShownChange,
  onOpenAiSettings,
  onRefreshAnalysis,
  onToggle,
  savedCard = null,
}: UserPageAnalysisModalProps): React.ReactElement => {
  const firstRead =
    !analysisModalDisplayState.shouldRenderAnalysisBody && aiAnalysis ? (
      <AnalysisFirstRead headline={aiAnalysis} lines={analysisDetails} />
    ) : null;
  return (
    <Modal isOpen={isOpen} toggle={onToggle} size="lg" contentClassName={styles.analysisModalContent}>
      <ModalHeader
        toggle={onToggle}
        className={styles.modalHeader}
        close={
          <button
            type="button"
            className={styles.analysisCloseButton}
            data-ce-control-appearance="frameless"
            aria-label="Close"
            onClick={onToggle}
          >
            <span aria-hidden="true">×</span>
          </button>
        }
      >
        <div className={styles.modalTitleRow}>
          Analyze user
          <button
            type="button"
            className={styles.refreshIconButton}
            data-ce-control-appearance="frameless"
            onClick={onRefreshAnalysis}
            title="Refresh analysis"
            disabled={analyzing}
            aria-label="Refresh analysis"
          >
            <FontAwesomeIcon icon={faSync} spin={analyzing} id={styles.refreshAnalysisIcon} />
          </button>
        </div>
        {analysisCacheStatusState.shouldRenderAnalysisCacheStatus && (
          <div className={styles.analysisCacheStatus}>
            Cached analysis from {analysisCacheStatusState.analysisCacheAge}
          </div>
        )}
      </ModalHeader>
      <ModalBody className={styles.modalBody}>
        {analysisModalDisplayState.shouldRenderAnalyzing && (
          <>
            <div className={styles.analyzingContainer}>
              <FontAwesomeIcon icon={faSpinner} spin />
              <span>
                {firstRead ? 'Writing the full analysis… ' : 'Generating insights… '}
                {formatUserPageAnalysisWait(analysisElapsedMs)}
              </span>
            </div>
            {firstRead}
          </>
        )}
        {analysisModalDisplayState.shouldRenderError && (
          <>
            {firstRead}
            <div className={styles.analysisErrorNotice} role="alert">
              <p className={styles.placeholderNote}>
                {firstRead ? 'The full analysis did not arrive. ' : ''}
                {analysisError}
              </p>
              {analysisErrorAction !== 'add-ai-key' ? (
                <button type="button" className={styles.analysisSettingsLink} onClick={onRefreshAnalysis}>
                  Try again
                </button>
              ) : null}
              {(analysisErrorAction === 'add-ai-key' || analysisErrorAction === 'open-ai-settings') &&
              onOpenAiSettings ? (
                <button type="button" className={styles.analysisSettingsLink} onClick={onOpenAiSettings}>
                  {analysisErrorAction === 'add-ai-key' ? 'Add AI key' : 'Open AI settings'}
                </button>
              ) : null}
            </div>
          </>
        )}
        {/* An analysis on screen brings its own card; until then, and when none arrives, the saved one shows. */}
        {!analysisModalDisplayState.shouldRenderAnalysisBody && savedCard}
        {analysisModalDisplayState.shouldRenderAnalysisBody && (
          <UserPageAnalysisViews
            aiAnalysis={aiAnalysis}
            analysisBreakdown={analysisBreakdown}
            analysisCard={analysisCard}
            analysisCardPending={analysisCardPending}
            analysisCardPicture={analysisCardPicture}
            analysisCardPublish={analysisCardPublish}
            analysisCardSavedAt={analysisCardSavedAt}
            analysisDetails={analysisDetails}
            analysisGeneration={analysisGeneration}
            analysisHistoricalFigure={analysisHistoricalFigure}
            analysisHistoricalReasoning={analysisHistoricalReasoning}
            analysisName={analysisName}
            onAnalysisCardShownChange={onAnalysisCardShownChange}
          />
        )}
      </ModalBody>
    </Modal>
  );
};

export default UserPageAnalysisModal;
