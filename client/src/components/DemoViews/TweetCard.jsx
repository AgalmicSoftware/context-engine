import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faEye,
  faHeart,
  faLink,
  faRetweet,
} from '@fortawesome/free-solid-svg-icons';

import corpusDebateMapLinks from '../../variables/demo/corpus_debate_map_links.json';
import debateMapData from '../../variables/demo/debate_map_demo_data.json';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import styles from './CorpusViewer.module.scss';

const buildPublicRoute = (pathname = '') => {
  const normalizedPath = String(pathname || '').trim();
  if (!normalizedPath) return readPublicUrlBasePath() || '/';
  const basePath = readPublicUrlBasePath();
  return `${basePath}${normalizedPath}` || normalizedPath;
};

const buildAtlasIssueIndex = (nodes, parentPath = [], acc = {}) => {
  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    const nextPath = [...parentPath, node.name];
    acc[node.id] = {
      id: node.id,
      label: node.name,
      pathLabel: nextPath.join(' > '),
    };
    buildAtlasIssueIndex(node.children, nextPath, acc);
  });
  return acc;
};

const ATLAS_ISSUE_INDEX = buildAtlasIssueIndex(debateMapData);

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const resolveDebateMapIssues = (entry = {}) => {
  const rawIssues = Array.isArray(entry?.debate_map_issues)
    ? entry.debate_map_issues
    : (Array.isArray(entry?.debateMapIssues)
      ? entry.debateMapIssues
      : (Array.isArray(entry?.debate_nodes) ? entry.debate_nodes : []));

  const normalizedIssues = [];
  const seenIssueIds = new Set();

  const pushIssue = (atlasNodeId, labelOverride = '') => {
    const atlasIssue = ATLAS_ISSUE_INDEX[atlasNodeId];
    if (!atlasIssue || seenIssueIds.has(atlasIssue.id)) return;

    seenIssueIds.add(atlasIssue.id);
    normalizedIssues.push({
      id: atlasIssue.id,
      href: `${buildPublicRoute(`/atlas/${atlasIssue.id}`)}?demo=1`,
      label: labelOverride || atlasIssue.label,
      pathLabel: atlasIssue.pathLabel,
    });
  };

  rawIssues.forEach((issueRef) => {
    if (typeof issueRef === 'string') {
      if (ATLAS_ISSUE_INDEX[issueRef]) {
        pushIssue(issueRef);
        return;
      }

      const mappedLegacyIssues = Array.isArray(corpusDebateMapLinks?.[issueRef])
        ? corpusDebateMapLinks[issueRef]
        : [];

      mappedLegacyIssues.forEach((mappedIssue) => {
        pushIssue(mappedIssue?.atlasNodeId || mappedIssue?.nodeId || mappedIssue?.id, mappedIssue?.label || '');
      });
      return;
    }

    if (!issueRef || typeof issueRef !== 'object') return;

    pushIssue(
      issueRef.atlasNodeId || issueRef.nodeId || issueRef.id,
      issueRef.label || issueRef.name || ''
    );
  });

  return normalizedIssues;
};

const normalizeHandle = (author = '') => {
  const rawAuthor = String(author || '').trim();
  if (!rawAuthor) return '';
  return rawAuthor.startsWith('@') ? rawAuthor : `@${rawAuthor}`;
};

const buildDisplayName = (entry = {}) => {
  const explicitName = String(entry.author_name || entry.display_name || '').trim();
  if (explicitName) return explicitName;

  const normalizedHandle = normalizeHandle(entry.author).replace(/^@/, '');
  if (!normalizedHandle) return 'Unknown author';

  return normalizedHandle.replace(/[_.]+/g, ' ');
};

const getAvatarLetter = (handle = '') => {
  const normalizedHandle = normalizeHandle(handle).replace(/^@/, '').trim();
  return (normalizedHandle.charAt(0) || '?').toUpperCase();
};

const formatCount = (value) => Number(value || 0).toLocaleString();

export const DebateMapSection = ({ entry }) => {
  const linkedIssues = resolveDebateMapIssues(entry);

  return (
    <div className={styles.debateMapSection}>
      <div className={styles.debateMapHeader}>
        <FontAwesomeIcon className={styles.debateMapIcon} icon={faLink} />
        <span className={styles.debateMapLabel}>
          Debate Map
        </span>
      </div>
      {linkedIssues.length > 0 ? (
        <div className={styles.debateMapLinks}>
          {linkedIssues.map((issue) => (
            <Link
              key={issue.id}
              to={issue.href}
              className={styles.debateMapLink}
              title={issue.pathLabel}
            >
              {issue.label}
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.debateMapEmpty}>
          No linked atlas issues yet.
        </div>
      )}
    </div>
  );
};

export const ExternalSourceLink = ({ entry, fallbackLabel = 'View source' }) => {
  if (!entry?.url) return null;

  return (
    <a
      href={entry.url}
      rel="noopener noreferrer"
      className={styles.externalLink}
      target="_blank"
    >
      <FontAwesomeIcon icon={faLink} />
      <span>{entry.source_label || fallbackLabel}</span>
    </a>
  );
};

const TweetCard = ({ entry, onTagClick }) => {
  const summaryText = entry.text || entry.summary || '';
  const createdAt = formatDate(entry.created_at);
  const normalizedSentiment = String(entry.sentiment || '').toLowerCase();
  const sentimentClassName = normalizedSentiment.includes('optim')
    ? styles.sentimentOptimistic
    : (normalizedSentiment.includes('skept') || normalizedSentiment.includes('caut'))
      ? styles.sentimentSkeptical
      : (normalizedSentiment.includes('alarm')
        || normalizedSentiment.includes('concern')
        || normalizedSentiment.includes('doom'))
        ? styles.sentimentAlarmist
        : styles.sentimentNeutral;
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  const handle = normalizeHandle(entry.author);
  const authorName = buildDisplayName(entry);
  const showMetadataRow = tags.length > 0 || entry.sentiment;

  return (
    <article className={`${styles.card} ${styles.tweetCard}`}>
      <div className={styles.tweetAuthorRow}>
        <div className={styles.tweetAvatar} aria-hidden="true">
          {getAvatarLetter(handle)}
        </div>
        <div className={styles.tweetAuthorMeta}>
          <div className={styles.tweetAuthorNames}>
            <span className={styles.tweetName}>
              {authorName}
            </span>
            {handle ? (
              <span className={styles.tweetHandle}>
                {handle}
              </span>
            ) : null}
          </div>
        </div>
        <div className={styles.tweetDate}>
          {createdAt || 'Undated post'}
        </div>
      </div>

      <div className={styles.tweetBody}>
        {summaryText}
      </div>

      {showMetadataRow ? (
        <div className={`${styles.pillRow} ${styles.tweetTags}`}>
          {tags.slice(0, 5).map((tag) => (
            <button
              key={tag}
              type="button"
              className={`${styles.pill} ${styles.pillButton}`}
              onClick={() => onTagClick?.(tag)}
            >
              {tag}
            </button>
          ))}
          {entry.sentiment ? (
            <span className={`${styles.sentimentBadge} ${sentimentClassName}`}>
              {entry.sentiment}
            </span>
          ) : null}
        </div>
      ) : null}

      <DebateMapSection entry={entry} />

      <div className={styles.tweetEngagement}>
        <div className={styles.engagementRow}>
          <span className={styles.tweetEngagementIcon}>
            <FontAwesomeIcon icon={faHeart} />
            <span>{formatCount(entry.engagement?.likes)}</span>
          </span>
          <span className={styles.tweetEngagementIcon}>
            <FontAwesomeIcon icon={faRetweet} />
            <span>{formatCount(entry.engagement?.reposts)}</span>
          </span>
          <span className={styles.tweetEngagementIcon}>
            <FontAwesomeIcon icon={faEye} />
            <span>{formatCount(entry.engagement?.views)}</span>
          </span>
        </div>
        <ExternalSourceLink entry={entry} fallbackLabel="View post" />
      </div>
    </article>
  );
};

export default TweetCard;
