import React from 'react';
import type { ReactNode } from 'react';
import styles from './SurveyTool.module.scss';

type AdditionalCommentsInlineRowProps = {
  input: ReactNode;
  lockControl?: ReactNode;
};

const AdditionalCommentsInlineRow = ({ input, lockControl = null }: AdditionalCommentsInlineRowProps) => (
  <div className={styles.additionalCommentsInlineRow}>
    <div className={styles.additionalCommentsInputWrap}>{input}</div>
    <div className={styles.additionalCommentsLockSlot}>{lockControl}</div>
  </div>
);

export default AdditionalCommentsInlineRow;
