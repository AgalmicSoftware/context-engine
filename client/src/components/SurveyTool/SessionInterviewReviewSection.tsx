import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';

type Props = {
  title: string;
  count?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
  summaryRef?: React.Ref<HTMLElement>;
};

export default function SessionInterviewReviewSection({
  title,
  count,
  children,
  className = '',
  testId,
  summaryRef,
}: Props) {
  return (
    <details open className={`${styles.sessionInterviewReview} ${className}`} data-testid={testId}>
      <summary ref={summaryRef} className={styles.sessionInterviewReviewHeader}>
        <FontAwesomeIcon icon={faCaretDown} className={styles.sessionInterviewReviewCaret} />
        <h4>{title}</h4>
        {count ? <span className={styles.sessionInterviewReviewCount}>{count}</span> : null}
      </summary>
      <div className={styles.sessionInterviewReviewContent}>{children}</div>
    </details>
  );
}
