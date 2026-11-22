import React from 'react';

import { ANALYSIS_CARD_TASTES, type AnalysisCardTaste } from 'utilities/analysisCard/analysisCardModel';

import styles from './UserPageAnalysisCard.module.scss';

type UserPageAnalysisCardSkeletonProps = {
  // The guesses the card has, once it is known; until then, every kind a card can have.
  tastes?: ReadonlyArray<AnalysisCardTaste>;
};

/**
 * The card's first page in outline, with the card's own headings and bars for the words to come, while the card
 * is being made or drawn. It has the card's width and shape, so the card takes its place at the same size. Screen
 * readers skip it: what shows it says what is happening in a status line of its own.
 */
const UserPageAnalysisCardSkeleton = ({
  tastes = ANALYSIS_CARD_TASTES,
}: UserPageAnalysisCardSkeletonProps): React.ReactElement => (
  <div className={styles.skeleton} aria-hidden="true">
    <div className={styles.skeletonPage}>
      <div className={styles.skeletonGroup}>
        <span className={styles.skeletonLabel}>AI analysis</span>
        <span className={`${styles.skeletonBar} ${styles.skeletonTitle}`} />
        <span className={`${styles.skeletonBar} ${styles.skeletonTitle} ${styles.skeletonShort}`} />
      </div>
      <div className={`${styles.skeletonGroup} ${styles.skeletonMatch}`}>
        <span className={styles.skeletonLabel}>Historical match</span>
        <span className={`${styles.skeletonBar} ${styles.skeletonName}`} />
        {[1, 2, 3, 4].map((line) => (
          <span key={line} className={styles.skeletonBar} />
        ))}
        <span className={`${styles.skeletonBar} ${styles.skeletonShort}`} />
      </div>
      <div className={styles.skeletonEnd}>
        {tastes.map((kind) => (
          <div key={kind} className={styles.skeletonPick}>
            <span className={styles.skeletonIcon} />
            <span className={styles.skeletonGroup}>
              <span className={styles.skeletonLabel}>{kind} guess</span>
              <span className={`${styles.skeletonBar} ${styles.skeletonShort}`} />
            </span>
          </div>
        ))}
        <div className={styles.skeletonFoot}>
          <span className={styles.skeletonBar} />
          <span className={styles.skeletonBar} />
        </div>
      </div>
    </div>
  </div>
);

export default UserPageAnalysisCardSkeleton;
