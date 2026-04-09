import React, { useState } from 'react';
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

export const DebateMapSection = ({ entry, onAtlasIssueOpen }) => {
  const linkedIssues = resolveDebateMapIssues(entry);

  if (linkedIssues.length === 0) return null;

  return (
    <div className={styles.debateMapFooter}>
      <div className={styles.debateMapFooterLinks}>
        {linkedIssues.map((issue) => (
          onAtlasIssueOpen ? (
            <button
              key={issue.id}
              type="button"
              className={`${styles.debateMapLink} ${styles.debateMapLinkButton}`}
              title={issue.pathLabel}
              onClick={() => onAtlasIssueOpen(issue.id)}
            >
              {issue.label}
            </button>
          ) : (
            <Link
              key={issue.id}
              to={issue.href}
              className={styles.debateMapLink}
              title={issue.pathLabel}
            >
              {issue.label}
            </Link>
          )
        ))}
      </div>
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

const TweetCard = ({ entry, onTagClick, onAtlasIssueOpen }) => {
  const [expanded, setExpanded] = useState(false);
  const summaryText = entry.text || entry.summary || '';
  const shouldTruncate = summaryText.length > 280 && !expanded;
  const displayText = shouldTruncate ? `${summaryText.slice(0, 280)}…` : summaryText;
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

      <div className={`${styles.tweetBody} ${shouldTruncate ? styles.tweetBodyClamped : ''}`.trim()}>
        {displayText}
      </div>
      {summaryText.length > 280 ? (
        <button
          type="button"
          className={styles.tweetReadMore}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}

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
        <div className={styles.cardFooterLinks}>
          <DebateMapSection entry={entry} onAtlasIssueOpen={onAtlasIssueOpen} />
          <ExternalSourceLink entry={entry} fallbackLabel="View post" />
        </div>
      </div>
    </article>
  );
};

export default TweetCard;
