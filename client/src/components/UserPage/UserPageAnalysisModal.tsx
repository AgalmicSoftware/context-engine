import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle, faSpinner, faSync } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalBody, ModalHeader, UncontrolledTooltip } from 'reactstrap';

import type { AnalysisCard } from 'utilities/analysisCard/analysisCardModel';
import { formatSavedAnalysisCardDate } from 'utilities/analysisCard/analysisCardSaved';

import styles from './UserPage.module.scss';
import cardStyles from './UserPageAnalysisCard.module.scss';
import UserPageAnalysisCard, { type UserPageAnalysisCardPicture } from './UserPageAnalysisCard';
import type { UserAnalysisGeneration } from './userPageAnalysisStateHelpers';

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

// On my own page: whether my card is shown on it, while a change is being saved, and why one failed.
export type UserPageAnalysisCardPublish = { shown: boolean; saving: boolean; note: string };

type UserPageAnalysisModalProps = {
  aiAnalysis?: React.ReactNode;
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
};

const UserPageAnalysisModal = ({
  aiAnalysis,
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
}: UserPageAnalysisModalProps): React.ReactElement => (
  <Modal isOpen={isOpen} toggle={onToggle} contentClassName={styles.analysisModalContent}>
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
        {analysisName || 'User Analysis'}
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
        <div className={styles.analyzingContainer}>
          <FontAwesomeIcon icon={faSpinner} spin />
          <span>Generating insights… {(analysisElapsedMs / 1000).toFixed(1)}s</span>
        </div>
      )}
      {analysisModalDisplayState.shouldRenderError && (
        <div className={styles.analysisErrorNotice} role="alert">
          <p className={styles.placeholderNote}>{analysisError}</p>
          {(analysisErrorAction === 'add-ai-key' || analysisErrorAction === 'open-ai-settings') && onOpenAiSettings ? (
            <button type="button" className={styles.analysisSettingsLink} onClick={onOpenAiSettings}>
              {analysisErrorAction === 'add-ai-key' ? 'Add AI key' : 'Open AI settings'}
            </button>
          ) : null}
        </div>
      )}
      {analysisModalDisplayState.shouldRenderAnalysisBody && (
        <>
          <p className={styles.analysisModel}>
            {analysisGeneration?.source === 'requested' ? 'Requested AI model: ' : 'AI model: '}
            {analysisGeneration?.model || 'not recorded'}
            {analysisGeneration?.provider ? ` (${analysisGeneration.provider})` : ''}
          </p>
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
          {(analysisCard || analysisCardPending) && (
            <div className={styles.historicalAlignment}>
              <h4>Picture card</h4>
              {analysisCard ? (
                <>
                  <UserPageAnalysisCard card={analysisCard} picture={analysisCardPicture} />
                  {analysisCardSavedAt ? (
                    <p className={styles.placeholderNote}>
                      Their saved card, from {formatSavedAnalysisCardDate(analysisCardSavedAt)}
                    </p>
                  ) : null}
                  {analysisCardPublish && onAnalysisCardShownChange ? (
                    <div className={cardStyles.publish}>
                      <label>
                        <input
                          type="checkbox"
                          checked={analysisCardPublish.shown}
                          disabled={analysisCardPublish.saving}
                          onChange={(event) => onAnalysisCardShownChange(event.target.checked)}
                        />{' '}
                        Show this card on my page
                      </label>{' '}
                      <button
                        type="button"
                        id="analysisCardPublishHelp"
                        className={cardStyles.publishHelp}
                        data-ce-control-appearance="frameless"
                        aria-label="About showing this card on your page"
                      >
                        <FontAwesomeIcon icon={faQuestionCircle} />
                      </button>
                      <UncontrolledTooltip target="analysisCardPublishHelp" trigger="hover focus" autohide={false}>
                        Anyone signed in to this session who may use its AI and read your answers sees this card on your
                        page, with up to three of those answers. Untick to remove it.
                      </UncontrolledTooltip>
                      {analysisCardPublish.note ? (
                        <p className={styles.placeholderNote} role="status">
                          {analysisCardPublish.note}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className={styles.placeholderNote} role="status">
                  <FontAwesomeIcon icon={faSpinner} spin /> Making the card…
                </p>
              )}
            </div>
          )}
        </>
      )}
    </ModalBody>
  </Modal>
);

export default UserPageAnalysisModal;
