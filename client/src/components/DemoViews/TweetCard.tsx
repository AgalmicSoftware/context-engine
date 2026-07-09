import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAtlas, faEye, faHeart, faLink, faRetweet } from '@fortawesome/free-solid-svg-icons';

import corpusDebateMapLinks from '../../variables/demo/corpus_debate_map_links.json';
import debateMapData from '../../variables/demo/debate_map_demo_data.json';
import { buildAtlasNodeRoute } from '../../utilities/ui/publicUrl.js';
import styles from './CorpusViewer.module.scss';

type AtlasNode = {
  id: string;
  name: string;
  children?: AtlasNode[];
};

type AtlasIssue = {
  id: string;
  href: string;
  label: string;
  pathLabel: string;
};

type LegacyIssueLink = {
  atlasNodeId?: string;
  nodeId?: string;
  id?: string;
  label?: string;
};

type DebateIssueRef =
  | string
  | {
      atlasNodeId?: string;
      nodeId?: string;
      id?: string;
      label?: string;
      name?: string;
    };

export type CorpusEntry = {
  id?: string;
  author?: string;
  author_name?: string;
  display_name?: string;
  created_at?: string;
  text?: string;
  summary?: string;
  sentiment?: string;
  tags?: string[];
  url?: string;
  source_label?: string;
  engagement?: {
    likes?: number | string | null;
    reposts?: number | string | null;
    views?: number | string | null;
  };
  debate_map_issues?: unknown[];
  debateMapIssues?: unknown[];
  debate_nodes?: unknown[];
  [key: string]: unknown;
};

type AtlasIssueOpenHandler = (issueId: string) => void;

export type DebateMapSectionProps = {
  entry?: CorpusEntry | null;
  onAtlasIssueOpen?: AtlasIssueOpenHandler;
  inline?: boolean;
  showAtlasIcon?: boolean;
};

export type ExternalSourceLinkProps = {
  entry?: Pick<CorpusEntry, 'url' | 'source_label'> | null;
  fallbackLabel?: string;
};

export type TweetCardProps = {
  entry?: CorpusEntry | null;
  onTagClick?: (tag: string) => void;
  onAtlasIssueOpen?: AtlasIssueOpenHandler;
};

const debateMapNodes = debateMapData as AtlasNode[];
const legacyDebateMapLinks = corpusDebateMapLinks as Record<string, LegacyIssueLink[]>;

const buildAtlasIssueIndex = (
  nodes: AtlasNode[] | null | undefined,
  parentPath: string[] = [],
  acc: Record<string, Omit<AtlasIssue, 'href'>> = {},
) => {
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

const ATLAS_ISSUE_INDEX = buildAtlasIssueIndex(debateMapNodes);

const formatDate = (value: unknown) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(typeof value === 'number' ? value : String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const resolveDebateMapIssues = (entry: CorpusEntry | null | undefined = {}, atlasReturnTo = '') => {
  const rawIssues = Array.isArray(entry?.debate_map_issues)
    ? entry.debate_map_issues
    : Array.isArray(entry?.debateMapIssues)
      ? entry.debateMapIssues
      : Array.isArray(entry?.debate_nodes)
        ? entry.debate_nodes
        : [];

  const normalizedIssues: AtlasIssue[] = [];
  const seenIssueIds = new Set();

  const pushIssue = (atlasNodeId: unknown, labelOverride = '') => {
    const nodeId = String(atlasNodeId || '').trim();
    if (!nodeId) return;
    const atlasIssue = ATLAS_ISSUE_INDEX[nodeId];
    if (!atlasIssue || seenIssueIds.has(atlasIssue.id)) return;

    seenIssueIds.add(atlasIssue.id);
    normalizedIssues.push({
      id: atlasIssue.id,
      href: buildAtlasNodeRoute(atlasIssue.id, {
        demo: true,
        returnTo: atlasReturnTo,
      }),
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

      const mappedLegacyIssues = Array.isArray(legacyDebateMapLinks?.[issueRef]) ? legacyDebateMapLinks[issueRef] : [];

      mappedLegacyIssues.forEach((mappedIssue) => {
        pushIssue(mappedIssue?.atlasNodeId || mappedIssue?.nodeId || mappedIssue?.id, mappedIssue?.label || '');
      });
      return;
    }

    if (!issueRef || typeof issueRef !== 'object') return;
    const issueObject = issueRef as Partial<Record<'atlasNodeId' | 'nodeId' | 'id' | 'label' | 'name', unknown>>;

    pushIssue(
      issueObject.atlasNodeId || issueObject.nodeId || issueObject.id,
      String(issueObject.label || issueObject.name || ''),
    );
  });

  return normalizedIssues;
};

const normalizeHandle = (author: unknown = '') => {
  const rawAuthor = String(author || '').trim();
  if (!rawAuthor) return '';
  return rawAuthor.startsWith('@') ? rawAuthor : `@${rawAuthor}`;
};

const buildDisplayName = (entry: CorpusEntry = {}) => {
  const explicitName = String(entry.author_name || entry.display_name || '').trim();
  if (explicitName) return explicitName;

  const normalizedHandle = normalizeHandle(entry.author).replace(/^@/, '');
  if (!normalizedHandle) return 'Unknown author';

  return normalizedHandle.replace(/[_.]+/g, ' ');
};

const getAvatarLetter = (handle: unknown = '') => {
  const normalizedHandle = normalizeHandle(handle).replace(/^@/, '').trim();
  return (normalizedHandle.charAt(0) || '?').toUpperCase();
};

const formatCount = (value: unknown) => Number(value || 0).toLocaleString();

export const DebateMapSection = ({
  entry,
  onAtlasIssueOpen,
  inline = false,
  showAtlasIcon = false,
}: DebateMapSectionProps) => {
  const location = useLocation();
  const atlasReturnTo = `${location.pathname || ''}${location.search || ''}${location.hash || ''}` || '/';
  const linkedIssues = resolveDebateMapIssues(entry, atlasReturnTo);

  if (linkedIssues.length === 0) return null;

  const issueLinks = linkedIssues.map((issue) =>
    onAtlasIssueOpen ? (
      <button
        key={issue.id}
        type="button"
        className={`${styles.debateMapLink} ${styles.debateMapLinkButton}`}
        title={issue.pathLabel}
        onClick={() => onAtlasIssueOpen(issue.id)}
      >
        {showAtlasIcon ? <FontAwesomeIcon icon={faAtlas} className={styles.debateMapIcon} aria-hidden="true" /> : null}
        <span>{issue.label}</span>
      </button>
    ) : (
      <Link key={issue.id} to={issue.href} className={styles.debateMapLink} title={issue.pathLabel}>
        {showAtlasIcon ? <FontAwesomeIcon icon={faAtlas} className={styles.debateMapIcon} aria-hidden="true" /> : null}
        <span>{issue.label}</span>
      </Link>
    ),
  );

  if (inline) {
    return issueLinks;
  }

  return (
    <div className={styles.debateMapFooter}>
      <div className={styles.debateMapFooterLinks}>{issueLinks}</div>
    </div>
  );
};

export const ExternalSourceLink = ({ entry, fallbackLabel = 'View source' }: ExternalSourceLinkProps) => {
  if (!entry?.url) return null;

  return (
    <a href={entry.url} rel="noopener noreferrer" className={styles.externalLink} target="_blank">
      <FontAwesomeIcon icon={faLink} />
      <span>{entry.source_label || fallbackLabel}</span>
    </a>
  );
};

const TweetCard = ({ entry = {}, onTagClick, onAtlasIssueOpen }: TweetCardProps) => {
  const resolvedEntry = entry || {};
  const [expanded, setExpanded] = useState(false);
  const summaryText = resolvedEntry.text || resolvedEntry.summary || '';
  const shouldTruncate = summaryText.length > 280 && !expanded;
  const displayText = shouldTruncate ? `${summaryText.slice(0, 280)}…` : summaryText;
  const createdAt = formatDate(resolvedEntry.created_at);
  const normalizedSentiment = String(resolvedEntry.sentiment || '').toLowerCase();
  const sentimentClassName = normalizedSentiment.includes('optim')
    ? styles.sentimentOptimistic
    : normalizedSentiment.includes('skept') || normalizedSentiment.includes('caut')
      ? styles.sentimentSkeptical
      : normalizedSentiment.includes('alarm') ||
          normalizedSentiment.includes('concern') ||
          normalizedSentiment.includes('doom')
        ? styles.sentimentAlarmist
        : styles.sentimentNeutral;
  const tags = Array.isArray(resolvedEntry.tags) ? resolvedEntry.tags : [];
  const handle = normalizeHandle(resolvedEntry.author);
  const authorName = buildDisplayName(resolvedEntry);
  const showMetadataRow = tags.length > 0 || resolvedEntry.sentiment;

  return (
    <article className={`${styles.card} ${styles.tweetCard}`}>
      <div className={styles.tweetAuthorRow}>
        <div className={styles.tweetAvatar} aria-hidden="true">
          {getAvatarLetter(handle)}
        </div>
        <div className={styles.tweetAuthorMeta}>
          <div className={styles.tweetAuthorNames}>
            <span className={styles.tweetName}>{authorName}</span>
            {handle ? <span className={styles.tweetHandle}>{handle}</span> : null}
          </div>
        </div>
        <div className={styles.tweetDate}>{createdAt || 'Undated post'}</div>
      </div>

      <div className={`${styles.tweetBody} ${shouldTruncate ? styles.tweetBodyClamped : ''}`.trim()}>{displayText}</div>
      {summaryText.length > 280 ? (
        <button type="button" className={styles.tweetReadMore} onClick={() => setExpanded((value) => !value)}>
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
          {resolvedEntry.sentiment ? (
            <span className={`${styles.sentimentBadge} ${sentimentClassName}`}>{resolvedEntry.sentiment}</span>
          ) : null}
        </div>
      ) : null}

      <div className={styles.tweetEngagement}>
        <div className={styles.engagementRow}>
          <span className={styles.tweetEngagementIcon}>
            <FontAwesomeIcon icon={faHeart} />
            <span>{formatCount(resolvedEntry.engagement?.likes)}</span>
          </span>
          <span className={styles.tweetEngagementIcon}>
            <FontAwesomeIcon icon={faRetweet} />
            <span>{formatCount(resolvedEntry.engagement?.reposts)}</span>
          </span>
          <span className={styles.tweetEngagementIcon}>
            <FontAwesomeIcon icon={faEye} />
            <span>{formatCount(resolvedEntry.engagement?.views)}</span>
          </span>
        </div>
        <div className={`${styles.cardFooterLinks} ${styles.tweetActionRow}`}>
          <DebateMapSection
            entry={resolvedEntry}
            onAtlasIssueOpen={onAtlasIssueOpen}
            inline={true}
            showAtlasIcon={true}
          />
          <ExternalSourceLink entry={resolvedEntry} fallbackLabel="View post" />
        </div>
      </div>
    </article>
  );
};

export default TweetCard;
