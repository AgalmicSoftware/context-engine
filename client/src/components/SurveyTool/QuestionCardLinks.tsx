import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookmark, faExpand, faExternalLinkAlt, faSpinner } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';

type QuestionCardLinksProps = {
  showResponseLookupSpinner?: boolean;
  isQuestionBookmarked?: boolean;
  onBookmarkToggle: () => void;
  arweaveHref?: string;
  questionHref?: string;
};

export const buildQuestionCardBookmarkClassName = ({
  activeClassName = '',
  baseClassName = '',
  bookmarkClassName = '',
  isQuestionBookmarked = false,
}: {
  activeClassName?: unknown;
  baseClassName?: unknown;
  bookmarkClassName?: unknown;
  isQuestionBookmarked?: unknown;
} = {}): string =>
  [
    String(baseClassName || ''),
    String(bookmarkClassName || ''),
    isQuestionBookmarked ? String(activeClassName || '') : '',
  ]
    .filter(Boolean)
    .join(' ');

export const resolveQuestionCardBookmarkIconStyle = (isQuestionBookmarked: unknown = false): React.CSSProperties => ({
  color: isQuestionBookmarked ? '#ffc107' : 'white',
});

const QuestionCardLinks = ({
  showResponseLookupSpinner = false,
  isQuestionBookmarked = false,
  onBookmarkToggle,
  arweaveHref = '',
  questionHref = '',
}: QuestionCardLinksProps) => (
  <div className={styles.cardLinksContainer}>
    {showResponseLookupSpinner && (
      <span
        className={styles.cardLinkSpinner}
        title="Checking for existing response..."
        aria-label="Checking for existing response"
      >
        <FontAwesomeIcon icon={faSpinner} spin />
      </span>
    )}
    <button
      onClick={onBookmarkToggle}
      className={`${styles.cardLinkButton} ${styles.fullQuestionBookmarkButton} ${isQuestionBookmarked ? styles.fullQuestionBookmarkButtonActive : ''}`}
      title={isQuestionBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
    >
      <FontAwesomeIcon icon={faBookmark} style={resolveQuestionCardBookmarkIconStyle(isQuestionBookmarked)} />
    </button>
    {arweaveHref ? (
      <a
        href={arweaveHref}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.cardLinkButton}
        title="View on Arweave"
      >
        <FontAwesomeIcon icon={faExternalLinkAlt} />
      </a>
    ) : null}
    {questionHref ? (
      <a
        href={questionHref}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.cardLinkButton}
        title="View question page"
      >
        <FontAwesomeIcon icon={faExpand} />
      </a>
    ) : null}
  </div>
);

export default QuestionCardLinks;
