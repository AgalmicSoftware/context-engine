import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSync } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import styles from './UserPage.module.scss';

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
  analysisCacheStatusState: UserPageAnalysisCacheStatusState;
  analysisDetails?: React.ReactNode;
  analysisElapsedMs?: number;
  analysisError?: React.ReactNode;
  analysisHistoricalFigure?: React.ReactNode;
  analysisHistoricalReasoning?: React.ReactNode;
  analysisModalDisplayState: UserPageAnalysisModalDisplayState;
  analysisName?: React.ReactNode;
  analyzing?: boolean;
  isOpen: boolean;
  onRefreshAnalysis: React.MouseEventHandler<HTMLButtonElement>;
  onToggle: () => void;
};

const UserPageAnalysisModal = ({
  aiAnalysis,
  analysisCacheStatusState,
  analysisDetails,
  analysisElapsedMs = 0,
  analysisError,
  analysisHistoricalFigure,
  analysisHistoricalReasoning,
  analysisModalDisplayState,
  analysisName,
  analyzing = false,
  isOpen,
  onRefreshAnalysis,
  onToggle,
}: UserPageAnalysisModalProps): React.ReactElement => (
  <Modal isOpen={isOpen} toggle={onToggle} className={styles.modalContent}>
    <ModalHeader toggle={onToggle} className={styles.modalHeader}>
      {/* Close "X" is intentionally hidden via CSS; do not delete this feature. */}
      <div className={styles.modalTitleRow}>
        {analysisName || 'User Analysis'}
        <button
          type="button"
          className={styles.refreshIconButton}
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
        <div className={styles.analyzingContainer}>
          <FontAwesomeIcon icon={faSpinner} spin />
          <span>Generating insights… {(analysisElapsedMs / 1000).toFixed(1)}s</span>
        </div>
      )}
      {analysisModalDisplayState.shouldRenderError && <p className={styles.placeholderNote}>{analysisError}</p>}
      {analysisModalDisplayState.shouldRenderAnalysisBody && (
        <>
          <p className={styles.placeholderNote}>{aiAnalysis}</p>
          {analysisModalDisplayState.shouldRenderDetails && <p className={styles.analysisDetails}>{analysisDetails}</p>}
          {analysisModalDisplayState.shouldRenderHistoricalAlignment && (
            <div className={styles.historicalAlignment}>
              <h4>Historical Alignment</h4>
              {analysisModalDisplayState.shouldRenderHistoricalFigure && <p>{analysisHistoricalFigure}</p>}
              {analysisModalDisplayState.shouldRenderHistoricalReasoning && (
                <p className={styles.placeholderNote}>{analysisHistoricalReasoning}</p>
              )}
            </div>
          )}
        </>
      )}
    </ModalBody>
  </Modal>
);

export default UserPageAnalysisModal;
