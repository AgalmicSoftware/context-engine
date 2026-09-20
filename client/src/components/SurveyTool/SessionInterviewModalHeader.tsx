import React from 'react';
import { ModalHeader, UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';

type SessionInterviewModalHeaderProps = {
  guidance: string;
  idle: boolean;
  onClose: () => void;
  readinessDetail: string;
  readinessRetry: () => void;
  statusLabel: string;
  statusTone: string;
  statusRef: React.RefObject<HTMLButtonElement>;
};

export default function SessionInterviewModalHeader({
  guidance,
  idle,
  onClose,
  readinessDetail,
  readinessRetry,
  statusLabel,
  statusTone,
  statusRef,
}: SessionInterviewModalHeaderProps) {
  return (
    <ModalHeader toggle={onClose}>
      <span className={styles.sessionInterviewHeader}>
        <span id="ce-session-voice-mode-title">Interview</span>
        <button
          type="button"
          id="ce-interview-help"
          className={styles.sessionInterviewHeaderButton}
          aria-label="About Interview"
        >
          <FontAwesomeIcon icon={faQuestionCircle} />
        </button>
        <UncontrolledTooltip target="ce-interview-help" placement="bottom" trigger="hover focus" autohide={false}>
          {guidance}
        </UncontrolledTooltip>
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`Interview status: ${statusLabel}`}
          data-testid={E2E_TESTIDS.SESSION_INTERVIEW_STATUS}
        >
          <button
            type="button"
            id="ce-interview-status-help"
            ref={statusRef}
            className={styles.sessionInterviewStatusPill}
            data-tone={statusTone}
            onClick={idle ? readinessRetry : undefined}
            aria-label={`Interview status: ${statusLabel}`}
          >
            <span>{statusLabel}</span>
          </button>
        </span>
        <UncontrolledTooltip
          target="ce-interview-status-help"
          placement="bottom"
          trigger="hover focus"
          autohide={false}
        >
          {idle ? `${readinessDetail} Click to check again.` : guidance}
        </UncontrolledTooltip>
      </span>
    </ModalHeader>
  );
}
