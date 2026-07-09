import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComment } from '@fortawesome/free-solid-svg-icons';

import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

export type PileAdditionalEditorRowProps = {
  input: React.ReactNode;
  lockControl: React.ReactNode;
};

export type PileCommentsSectionProps = {
  showComments: boolean;
  maskedAdditional: boolean;
  decryptAdditionalControl: React.ReactNode;
  additionalEditorRow: React.ReactNode;
};

export type PileQuestionIconsProps = {
  questionId: React.Key | null | undefined;
  hasAdditionalContent: boolean;
  onToggleComments: () => void;
  answerLockControl: React.ReactNode;
};

export type PileFooterSectionProps = {
  sliderSection: React.ReactNode;
  questionIcons: React.ReactNode;
  commentsSection: React.ReactNode;
};

export const buildPileQuestionCommentButtonClassName = ({
  activeClassName = '',
  baseClassName = '',
  commentClassName = '',
  hasAdditionalContent = false,
}: {
  activeClassName?: unknown;
  baseClassName?: unknown;
  commentClassName?: unknown;
  hasAdditionalContent?: unknown;
} = {}): string =>
  [
    String(baseClassName || ''),
    String(commentClassName || ''),
    hasAdditionalContent ? String(activeClassName || '') : '',
  ]
    .filter(Boolean)
    .join(' ');

export const resolvePileQuestionCommentIconClassName = ({
  glowClassName = '',
  hasAdditionalContent = false,
}: {
  glowClassName?: unknown;
  hasAdditionalContent?: unknown;
} = {}): string | undefined => (hasAdditionalContent ? String(glowClassName || '') || undefined : undefined);

export const renderPileAdditionalEditorRow = ({
  input,
  lockControl,
}: PileAdditionalEditorRowProps): React.ReactElement => (
  <div className={styles.pileAdditionalEditor}>
    <AdditionalCommentsInlineRow input={input} lockControl={lockControl} />
  </div>
);

export const renderPileCommentsSection = ({
  showComments,
  maskedAdditional,
  decryptAdditionalControl,
  additionalEditorRow,
}: PileCommentsSectionProps): React.ReactNode => {
  if (!showComments) return null;

  return (
    <div className={styles.pileCommentsRow}>{maskedAdditional ? decryptAdditionalControl : additionalEditorRow}</div>
  );
};

export const renderPileQuestionIcons = ({
  questionId,
  hasAdditionalContent,
  onToggleComments,
  answerLockControl,
}: PileQuestionIconsProps): React.ReactElement => (
  <div className={styles.pileCardIcons}>
    <button
      className={buildPileQuestionCommentButtonClassName({
        activeClassName: styles.iconButtonActive,
        baseClassName: styles.iconButton,
        commentClassName: styles.commentButton,
        hasAdditionalContent,
      })}
      onClick={onToggleComments}
      data-testid={E2E_TESTIDS.SURVEY_ADDITIONAL_TOGGLE}
      data-ce-question-id={String(questionId || '')
        .trim()
        .toLowerCase()}
    >
      <FontAwesomeIcon
        icon={faComment}
        className={resolvePileQuestionCommentIconClassName({
          glowClassName: styles.iconGlow,
          hasAdditionalContent,
        })}
      />
    </button>

    {answerLockControl}
  </div>
);

export const renderPileFooterSection = ({
  sliderSection,
  questionIcons,
  commentsSection,
}: PileFooterSectionProps): React.ReactElement => (
  <div className={styles.pileCardFooter}>
    <div className={styles.pileControlsRow}>
      {sliderSection}
      {questionIcons}
    </div>

    {commentsSection}
  </div>
);
