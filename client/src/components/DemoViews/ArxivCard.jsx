import React from 'react';

import styles from './CorpusViewer.module.scss';
import { DebateMapSection, ExternalSourceLink } from './TweetCard.jsx';

const extractArxivId = (url = '') => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'arxiv.org' && !parsedUrl.hostname.endsWith('.arxiv.org')) return null;

    const absMatch = parsedUrl.pathname.match(/^\/abs\/(.+)$/);
    if (absMatch?.[1]) return decodeURIComponent(absMatch[1]);

    const pdfMatch = parsedUrl.pathname.match(/^\/pdf\/(.+?)(?:\.pdf)?$/);
    if (pdfMatch?.[1]) return decodeURIComponent(pdfMatch[1]);
  } catch {
    return null;
  }

  return null;
};

const formatAuthorSurname = (author = '') => {
  const parts = String(author || '').trim().split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || '';
};

const formatCompactAuthors = (entry = {}) => {
  const listedAuthors = Array.isArray(entry.authors)
    ? entry.authors.filter(Boolean)
    : [];

  if (listedAuthors.length === 0) {
    return entry.author ? String(entry.author).trim() : null;
  }

  const surnames = listedAuthors
    .map((author) => formatAuthorSurname(author))
    .filter(Boolean);

  if (surnames.length === 0) return null;
  if (surnames.length === 1) return surnames[0];
  if (surnames.length === 2) return `${surnames[0]}, ${surnames[1]}`;
  return `${surnames[0]}, ${surnames[1]} et al.`;
};

const parseDisplayDate = (value) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return null;

  const plainDateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plainDateMatch) {
    const [, year, month, day] = plainDateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsedDate = new Date(rawValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatEntryDate = (entry = {}) => {
  const datedValue = entry.date || entry.published_at || entry.published || entry.created_at;
  if (datedValue) {
    const parsedDate = parseDisplayDate(datedValue);
    if (parsedDate) {
      return parsedDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  }

  if (entry.year) return String(entry.year);

  return null;
};

const ArxivCard = ({ entry, onTagClick }) => {
  const arxivId = extractArxivId(entry?.url);
  const authorLabel = formatCompactAuthors(entry);
  const dateLabel = formatEntryDate(entry);
  const summaryText = entry?.summary || entry?.abstract || '';
  const tags = Array.isArray(entry?.tags) ? entry.tags : [];

  return (
    <article className={`${styles.card} ${styles.arxivCard}`}>
      <div className={styles.entryHeader}>
        <div className={styles.entryHeaderContent}>
          {(arxivId || entry?.category) ? (
            <div className={styles.arxivMetaTop}>
              {arxivId ? (
                <span className={styles.arxivId}>
                  [{arxivId}]
                </span>
              ) : null}
              {entry?.category ? (
                <span
                  className={styles.arxivCategory}
                  data-category={entry.category}
                >
                  {entry.category}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className={styles.arxivTitle}>
            {entry?.title || entry?.id || 'Untitled entry'}
          </div>

          {(authorLabel || dateLabel) ? (
            <div className={styles.arxivMetaRow}>
              {authorLabel ? (
                <span className={styles.arxivAuthors} title={authorLabel}>
                  {authorLabel}
                </span>
              ) : null}
              {dateLabel ? (
                <span className={styles.arxivDate}>
                  {authorLabel ? `· ${dateLabel}` : dateLabel}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {summaryText ? (
        <div className={`${styles.entrySummary} ${styles.clamp3}`}>
          {summaryText}
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div className={styles.pillRow}>
          {tags.slice(0, 6).map((tag) => (
            <button
              key={tag}
              type="button"
              className={`${styles.pill} ${styles.pillButton}`}
              onClick={() => onTagClick?.(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}

      <DebateMapSection entry={entry} />

      {entry?.url ? (
        <div className={styles.entrySourceRow}>
          <ExternalSourceLink entry={entry} fallbackLabel={arxivId ? 'View paper' : 'View source'} />
        </div>
      ) : null}
    </article>
  );
};

export default ArxivCard;
