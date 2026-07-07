import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import CETooltip from '../Shared/CETooltip';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';

type GatedPromptNoticeProps = {
  questionId?: string;
  tooltipId: string;
  tooltipText: string;
  leadingText?: string;
  statusText?: string;
  suffix?: string;
};

export const resolveGatedPromptLockIconStyle = (): React.CSSProperties => ({
  marginRight: 8,
});

export const buildGatedPromptTooltipIconClassName = ({
  baseClassName = '',
  tooltipClassName = '',
}: {
  baseClassName?: unknown;
  tooltipClassName?: unknown;
} = {}): string => [String(baseClassName || ''), String(tooltipClassName || '')].filter(Boolean).join(' ');

const GatedPromptNotice = ({
  questionId = '',
  tooltipId,
  tooltipText,
  leadingText = 'This question is',
  statusText = 'gated',
  suffix = 'Decrypt the prompt to answer.',
}: GatedPromptNoticeProps) => (
  <div
    className={styles.gatedPromptNotice}
    role="note"
    data-testid={E2E_TESTIDS.SURVEY_GATED_PROMPT_NOTICE}
    data-ce-question-id={String(questionId || '')
      .trim()
      .toLowerCase()}
  >
    <FontAwesomeIcon icon={faLock} style={resolveGatedPromptLockIconStyle()} />
    <span className={styles.gatedPromptNoticeText}>
      {leadingText}{' '}
      <span
        id={tooltipId}
        data-testid={`ce-gated-prompt-tooltip-${questionId}`}
        className={styles.gatedPromptTooltipTrigger}
        onClick={(event) => event.stopPropagation()}
      >
        {statusText}
        <FontAwesomeIcon
          icon={faQuestionCircle}
          className={`${styles.tooltip} ${styles.gatedPromptTooltipIcon}`}
        />
      </span>
      {`. ${suffix}`}
    </span>
    {typeof onAction === 'function' && (
      <button
        type="button"
        className={styles.gatedPromptNoticeActionButton}
        data-testid={actionTestId}
        data-ce-question-id={String(questionId || '')
          .trim()
          .toLowerCase()}
        disabled={actionDisabled}
        aria-busy={actionBusy}
        title={actionTitle}
        onClick={(event) => {
          event.stopPropagation();
          onAction();
        }}
      >
        {actionBusy ? (
          <span className={styles.maskedPromptLoading}>
            <FontAwesomeIcon icon={faSpinner} spin className={styles.maskedPromptLoadingSpinner} />
            <span>Decrypting...</span>
          </span>
        ) : (
          actionLabel
        )}
      </button>
    )}
    <CETooltip
      placement="right"
      trigger="hover focus click"
      target={tooltipId}
      className={styles.tooltipBubble}
      container="body"
    >
      {tooltipText}
    </CETooltip>
  </div>
);

export default GatedPromptNotice;
