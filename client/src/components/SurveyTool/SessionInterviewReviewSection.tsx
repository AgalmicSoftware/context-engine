import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UncontrolledTooltip } from 'reactstrap';
import { faCaretDown, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';

type Props = {
  title: string;
  help?: string;
  helpId?: string;
  count?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
  summaryRef?: React.Ref<HTMLElement>;
};

export default function SessionInterviewReviewSection({
  title,
  help,
  helpId,
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
        {help && helpId ? (
          <>
            <button
              type="button"
              id={helpId}
              className={styles.sessionInterviewHeaderButton}
              aria-label={`About ${title.replace(/ \(.*$/, '')}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <FontAwesomeIcon icon={faQuestionCircle} />
            </button>
            <UncontrolledTooltip target={helpId} placement="bottom" trigger="hover focus" autohide={false}>
              {help}
            </UncontrolledTooltip>
          </>
        ) : null}
        {count ? <span className={styles.sessionInterviewReviewCount}>{count}</span> : null}
      </summary>
      <div className={styles.sessionInterviewReviewContent}>{children}</div>
    </details>
  );
}
