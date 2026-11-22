/** @file PileEndOfSetCard.tsx: what Next opens after the last question, so the end of the set is plain. */
import React from 'react';
import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import { SubmitCountLabel } from './SubmitCountLabel';
import styles from './SurveyTool.module.scss';
import { submittingLabel } from './surveyToolDraftState';

type Props = {
  answered: number;
  total: number;
  unsent: number;
  isSubmitting: boolean;
  /** "12 of 40" while a Submit saves several answers. */
  submitCountText?: string;
  onSubmit: () => void;
  onSeeResults?: (() => void) | null;
  onTalkItThrough?: (() => void) | null;
  onJoinGroup?: (() => void) | null;
  answersHref?: string;
};

const PileEndOfSetCard = ({
  answered,
  total,
  unsent,
  isSubmitting,
  submitCountText,
  onSubmit,
  onSeeResults,
  onTalkItThrough,
  onJoinGroup,
  answersHref,
}: Props): React.ReactElement => (
  <div
    className={`${styles.pileCardInner} ${styles.pileEndCard}`}
    data-testid="ce-pile-end-of-set"
    role="group"
    aria-labelledby="ce-pile-end-of-set-title"
    tabIndex={-1}
  >
    <h3 id="ce-pile-end-of-set-title" className={styles.pileEndTitle}>
      That was the last question.
    </h3>
    <p className={styles.pileEndSummary}>
      You answered {answered} of {total}.
      {unsent > 0 && ` ${unsent} ${unsent === 1 ? "isn't" : "aren't"} submitted yet.`}
    </p>
    <div className={styles.pileEndActions}>
      {unsent > 0 && (
        <button
          type="button"
          className={styles.pileEndPrimary}
          onClick={onSubmit}
          disabled={isSubmitting}
          // The count shows in the corner without its brackets; the name keeps them.
          aria-label={isSubmitting ? undefined : `Submit (${unsent})`}
        >
          {isSubmitting ? (
            <ElapsedLoadingLabel label={submittingLabel(submitCountText)} />
          ) : (
            <SubmitCountLabel text={`Submit (${unsent})`} />
          )}
        </button>
      )}
      {onSeeResults && (
        <button type="button" className={styles.pileEndAction} onClick={onSeeResults}>
          See results
        </button>
      )}
      {onTalkItThrough && (
        <button type="button" className={styles.pileEndAction} onClick={onTalkItThrough}>
          Talk it through in the interview
        </button>
      )}
      {onJoinGroup && (
        <button type="button" className={styles.pileEndAction} onClick={onJoinGroup}>
          Join a group
        </button>
      )}
      {answersHref && (
        <a className={styles.pileEndAction} href={answersHref} data-ce-control-appearance="raised">
          See your answers
        </a>
      )}
    </div>
  </div>
);

export default PileEndOfSetCard;
