import React from 'react';
import type { ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComment } from '@fortawesome/free-solid-svg-icons';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SurveyTool.module.scss';

type FullQuestionFooterIconsProps = {
  hasAdditionalContent?: boolean;
  commentsOpen?: boolean;
  onToggleComments: () => void;
  questionId?: string;
  children?: ReactNode;
};

export const buildFullQuestionCommentButtonClassName = (
  styleMap: Record<string, string>,
  hasAdditionalContent: unknown,
) =>
  [styleMap.iconButton, styleMap.commentButton, hasAdditionalContent ? styleMap.iconButtonActive : '']
    .filter(Boolean)
    .join(' ');

export const resolveFullQuestionCommentIconClassName = (
  styleMap: Record<string, string>,
  hasAdditionalContent: unknown,
) => (hasAdditionalContent ? styleMap.iconGlow : undefined);

const FullQuestionFooterIcons = ({
  hasAdditionalContent = false,
  commentsOpen = false,
  onToggleComments,
  questionId = '',
  children = null,
}: FullQuestionFooterIconsProps) => (
  <div className={styles.fullQuestionIcons}>
    <button
      type="button"
      className={`${styles.iconButton} ${styles.commentButton} ${hasAdditionalContent ? styles.iconButtonActive : ''}`}
      onClick={onToggleComments}
      aria-pressed={commentsOpen}
      title="Additional comments"
      data-testid={E2E_TESTIDS.SURVEY_ADDITIONAL_TOGGLE}
      data-ce-question-id={String(questionId || '')
        .trim()
        .toLowerCase()}
    >
      <FontAwesomeIcon
        icon={faComment}
        className={resolveFullQuestionCommentIconClassName(styles, hasAdditionalContent)}
      />
    </button>
    {children}
  </div>
);

export default FullQuestionFooterIcons;
