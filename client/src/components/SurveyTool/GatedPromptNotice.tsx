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
  suffix?: string;
};

const GatedPromptNotice = ({
  questionId = '',
  tooltipId,
  tooltipText,
  suffix = 'Decrypt the prompt to answer.',
}: GatedPromptNoticeProps) => (
  <div
    className={styles.gatedPromptNotice}
    role="note"
    data-testid={E2E_TESTIDS.SURVEY_GATED_PROMPT_NOTICE}
    data-ce-question-id={String(questionId || '').trim().toLowerCase()}
  >
    <FontAwesomeIcon icon={faLock} style={{ marginRight: 8 }} />
    <span>
      This question is{' '}
      <span
        id={tooltipId}
        data-testid={`ce-gated-prompt-tooltip-${questionId}`}
        className={styles.gatedPromptTooltipTrigger}
        onClick={(event) => event.stopPropagation()}
      >
        gated
        <FontAwesomeIcon
          icon={faQuestionCircle}
          className={`${styles.tooltip} ${styles.gatedPromptTooltipIcon}`}
        />
      </span>
      {`. ${suffix}`}
    </span>
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
