import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

import type { SbtCardDetails, SbtListMetaRowModel } from './sbtListHelpers';

type SbtListCardChromeStyles = Record<string, string>;

type SbtListDetailsPanelProps = {
  details?: SbtCardDetails | null;
  detailsId: string;
  styles: SbtListCardChromeStyles;
};

type SbtListMetaRowProps = {
  buttonLabel: unknown;
  detailsId: string;
  model?: SbtListMetaRowModel | null;
  onTagClick: (event: React.MouseEvent<HTMLButtonElement>, tag: string) => void;
  onToggleDetails: () => void;
  styles: SbtListCardChromeStyles;
};

export const SbtListDetailsPanel = ({ details, detailsId, styles }: SbtListDetailsPanelProps): JSX.Element | null => {
  if (!details?.hasDetails) return null;
  return (
    <div id={detailsId} className={styles.sbtDetailsPanel}>
      {details.documentUrls.length > 0 && (
        <div className={styles.sbtDetailsSection}>
          <span className={styles.sbtDetailsHeading}>Documents</span>
          <div className={styles.sbtDocumentList}>
            {details.documentUrls.map((documentUrl) => (
              <a
                key={documentUrl.href}
                className={styles.sbtDocumentLink}
                href={documentUrl.href}
                target="_blank"
                rel="noopener noreferrer"
                title={documentUrl.label}
              >
                {documentUrl.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const SbtListMetaRow = ({
  buttonLabel,
  detailsId,
  model,
  onTagClick,
  onToggleDetails,
  styles,
}: SbtListMetaRowProps): JSX.Element | null => {
  if (!model) return null;
  const { hasDetailsToggle, hasTags, isExpanded, tags } = model;
  const metaRowClassName = [styles.sbtMetaRow, hasTags ? styles.sbtMetaRowWithTags : styles.sbtMetaRowToggleOnly]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={metaRowClassName}>
      {hasTags && (
        <div className={styles.sbtTagList}>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles.sbtTagChip}
              aria-label={`Open tag explorer for ${tag}`}
              onClick={(event) => onTagClick(event, tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
      {hasDetailsToggle && (
        <button
          type="button"
          className={styles.sbtDetailsToggle}
          aria-controls={detailsId}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${buttonLabel}`}
          onClick={onToggleDetails}
        >
          <FontAwesomeIcon icon={isExpanded ? faCaretUp : faCaretDown} className={styles.sbtDetailsToggleIcon} />
        </button>
      )}
    </div>
  );
};
