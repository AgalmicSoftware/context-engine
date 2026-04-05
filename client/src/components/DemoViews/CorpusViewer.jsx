import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBook,
  faBrain,
  faChartBar,
  faFileAlt,
  faGavel,
  faLink,
  faMicrophone,
} from '@fortawesome/free-solid-svg-icons';
import { faTwitter } from '@fortawesome/free-brands-svg-icons';

import corpusSample from '../../variables/demo/corpus_sample.json';
import corpusDebateMapLinks from '../../variables/demo/corpus_debate_map_links.json';
import debateMapData from '../../variables/demo/debate_map_demo_data.json';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';

const COLORS = {
  accent: '#4dffa4',
  card: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
  muted: 'rgba(244,247,255,0.65)',
  surface: 'rgba(255,255,255,0.06)',
  text: '#f4f7ff',
};

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

const CORPUS_ORDER = [
  'tweets',
  'ai_laws_policy',
  'arxiv_ai_safety',
  'lesswrong_posts',
  'dwarkesh_lab_insiders',
  'ai_scifi_books',
  'metr_evals_metrics',
  'cross_corpus',
];

const ICONS = {
  bird: faTwitter,
  gavel: faGavel,
  'file-text': faFileAlt,
  brain: faBrain,
  mic: faMicrophone,
  book: faBook,
  chart: faChartBar,
  link: faLink,
};

const ICON_FALLBACKS = {
  bird: '🐦',
  gavel: '⚖️',
  'file-text': '📄',
  brain: '🧠',
  mic: '🎙️',
  book: '📚',
  chart: '📊',
  link: '🔗',
};

const TAB_LABELS = {
  tweets: 'Tweets',
  ai_laws_policy: 'Laws & Policy',
  arxiv_ai_safety: 'Safety Papers',
  lesswrong_posts: 'LessWrong',
  dwarkesh_lab_insiders: 'Insider Interviews',
  ai_scifi_books: 'Sci-Fi',
  metr_evals_metrics: 'METR Metrics',
  cross_corpus: 'Cross-Corpus',
};

const PILL_STYLE = {
  background: 'rgba(77,255,164,0.1)',
  borderRadius: 12,
  color: COLORS.accent,
  display: 'inline-flex',
  fontSize: 11,
  lineHeight: 1.4,
  padding: '2px 8px',
};

const clampStyle = (lines = 3) => ({
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: lines,
});

const CARD_STYLE = {
  background: COLORS.card,
  border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: 8,
  color: COLORS.text,
  display: 'block',
  padding: 16,
};

const EXTERNAL_LINK_STYLE = {
  alignItems: 'center',
  background: 'rgba(255,255,255,0.08)',
  border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: 999,
  color: COLORS.text,
  display: 'inline-flex',
  flexShrink: 0,
  fontSize: 12,
  fontWeight: 600,
  gap: 6,
  padding: '8px 12px',
  textDecoration: 'none',
};

const DEBATE_MAP_SECTION_STYLE = {
  background: 'rgba(8, 16, 42, 0.45)',
  border: '1px solid rgba(77,255,164,0.18)',
  borderRadius: 10,
  marginTop: 14,
  padding: '12px 12px 10px',
};

const DEBATE_MAP_LINK_STYLE = {
  alignItems: 'center',
  background: 'rgba(77,255,164,0.12)',
  border: '1px solid rgba(77,255,164,0.22)',
  borderRadius: 999,
  color: COLORS.text,
  display: 'inline-flex',
  fontSize: 12,
  fontWeight: 600,
  gap: 6,
  lineHeight: 1.4,
  padding: '6px 10px',
  textDecoration: 'none',
};

const formatNumber = (value) => (
  Number(value || 0).toLocaleString()
);

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

const formatAuthors = (entry = {}) => {
  if (entry.author) return entry.author;
  if (!Array.isArray(entry.authors) || entry.authors.length === 0) return null;
  if (entry.authors.length === 1) return entry.authors[0];
  if (entry.authors.length === 2) return `${entry.authors[0]}, ${entry.authors[1]}`;
  return `${entry.authors[0]} +${entry.authors.length - 1}`;
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

const buildCorpusDefinitions = () => (
  CORPUS_ORDER
    .map((key) => {
      const corpus = corpusSample?.corpuses?.[key];
      if (!corpus) return null;
      const entries = Array.isArray(corpus.entries) ? corpus.entries : [];

      return {
        ...corpus,
        count_full: corpus.count_full,
        entries,
        key,
        tabLabel: TAB_LABELS[key] || corpus.label || key,
      };
    })
    .filter(Boolean)
);

const getEntryYear = (entry = {}) => {
  if (entry.year) return entry.year;
  const datedValue = entry.date || entry.date_enacted || entry.created_at;
  if (!datedValue) return null;
  const date = new Date(datedValue);
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
};

const renderCorpusIcon = (iconKey) => {
  const iconDefinition = ICONS[iconKey];
  if (iconDefinition) {
    return <FontAwesomeIcon icon={iconDefinition} />;
  }
  return <span>{ICON_FALLBACKS[iconKey] || '•'}</span>;
};

const getSentimentStyle = (sentiment = '') => {
  const normalized = String(sentiment || '').toLowerCase();
  if (normalized.includes('optim')) {
    return {
      background: 'rgba(77,255,164,0.14)',
      color: COLORS.accent,
    };
  }
  if (normalized.includes('skept') || normalized.includes('caut')) {
    return {
      background: 'rgba(255,179,71,0.14)',
      color: '#ffb347',
    };
  }
  if (normalized.includes('alarm') || normalized.includes('concern') || normalized.includes('doom')) {
    return {
      background: 'rgba(255,107,203,0.14)',
      color: '#ff6bcb',
    };
  }
  return {
    background: 'rgba(255,255,255,0.1)',
    color: COLORS.muted,
  };
};

const buildNonTweetMeta = (corpusKey, entry = {}) => {
  const bits = [];
  const authorText = formatAuthors(entry);
  const year = getEntryYear(entry);

  if (authorText) bits.push(authorText);
  if (year) bits.push(year);
  if (entry.jurisdiction && corpusKey !== 'ai_laws_policy') bits.push(entry.jurisdiction);
  if (entry.venue) bits.push(entry.venue);
  if (entry.interviewer) bits.push(`with ${entry.interviewer}`);
  if (entry.category) bits.push(entry.category);
  if (corpusKey === 'ai_laws_policy' && entry.status) bits.push(entry.status);

  return bits;
};

const DebateMapSection = ({ entry }) => {
  const linkedIssues = resolveDebateMapIssues(entry);

  return (
    <div style={DEBATE_MAP_SECTION_STYLE}>
      <div style={{ alignItems: 'center', display: 'flex', gap: 8, marginBottom: 8 }}>
        <FontAwesomeIcon icon={faLink} style={{ color: COLORS.accent, fontSize: 12 }} />
        <span style={{ color: COLORS.text, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Debate Map
        </span>
      </div>
      {linkedIssues.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {linkedIssues.map((issue) => (
            <Link
              key={issue.id}
              to={issue.href}
              style={DEBATE_MAP_LINK_STYLE}
              title={issue.pathLabel}
            >
              {issue.label}
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.5 }}>
          No linked atlas issues yet.
        </div>
      )}
    </div>
  );
};

const ExternalSourceLink = ({ entry, fallbackLabel = 'View source' }) => {
  if (!entry?.url) return null;

  return (
    <a
      href={entry.url}
      rel="noopener noreferrer"
      style={EXTERNAL_LINK_STYLE}
      target="_blank"
    >
      <FontAwesomeIcon icon={faLink} />
      <span>{entry.source_label || fallbackLabel}</span>
    </a>
  );
};

const TweetCard = ({ entry }) => {
  const summaryText = entry.summary || entry.text || '';
  const createdAt = formatDate(entry.created_at);
  const sentimentStyle = getSentimentStyle(entry.sentiment);

  return (
    <article style={CARD_STYLE}>
      <div style={{ alignItems: 'flex-start', display: 'flex', gap: 12, justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            {entry.author || 'Unknown author'}
          </div>
          <div style={{ color: COLORS.muted, fontSize: 12 }}>
            {createdAt || 'Undated post'}
          </div>
        </div>
        <span
          style={{
            ...sentimentStyle,
            borderRadius: 999,
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
            textTransform: 'capitalize',
          }}
        >
          {entry.sentiment || 'mixed'}
        </span>
      </div>

      <div
        style={{
          ...clampStyle(8),
          color: COLORS.text,
          fontSize: 14,
          lineHeight: 1.55,
          marginBottom: 12,
        }}
      >
        {summaryText}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {(entry.tags || []).slice(0, 5).map((tag) => (
          <span key={tag} style={PILL_STYLE}>
            {tag}
          </span>
        ))}
      </div>

      <DebateMapSection entry={entry} />

      <div style={{ alignItems: 'center', color: COLORS.muted, display: 'flex', flexWrap: 'wrap', fontSize: 12, gap: 12, justifyContent: 'space-between', marginTop: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <span>❤ {formatNumber(entry.engagement?.likes)}</span>
          <span>↺ {formatNumber(entry.engagement?.reposts)}</span>
          {entry.engagement?.views ? <span>👁 {formatNumber(entry.engagement.views)}</span> : null}
        </div>
        <ExternalSourceLink entry={entry} fallbackLabel="View post" />
      </div>
    </article>
  );
};

const EntryCard = ({ corpusKey, entry }) => {
  const meta = buildNonTweetMeta(corpusKey, entry);
  const summaryText = entry.summary || '';
  const tags = Array.isArray(entry.tags) ? entry.tags : [];

  return (
    <article style={CARD_STYLE}>
      <div style={{ alignItems: 'flex-start', display: 'flex', gap: 12, justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: COLORS.text, fontSize: 15, fontWeight: 700, lineHeight: 1.4, marginBottom: 6 }}>
            {entry.title || entry.id || 'Untitled entry'}
          </div>
          {meta.length > 0 && (
            <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.45 }}>
              {meta.join(' • ')}
            </div>
          )}
        </div>
        {corpusKey === 'ai_laws_policy' && entry.jurisdiction ? (
          <span style={{ ...PILL_STYLE, flexShrink: 0 }}>
            {entry.jurisdiction}
          </span>
        ) : null}
      </div>

      <div
        style={{
          ...clampStyle(3),
          color: COLORS.muted,
          fontSize: 14,
          lineHeight: 1.6,
          marginBottom: 12,
        }}
      >
        {summaryText}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.slice(0, 6).map((tag) => (
          <span key={tag} style={PILL_STYLE}>
            {tag}
          </span>
        ))}
      </div>

      <DebateMapSection entry={entry} />

      {entry?.url ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <ExternalSourceLink entry={entry} />
        </div>
      ) : null}
    </article>
  );
};

const EmptyCorpusState = ({ corpus }) => (
  <div
    style={{
      alignItems: 'center',
      background: COLORS.card,
      border: `1px dashed ${COLORS.cardBorder}`,
      borderRadius: 8,
      color: COLORS.muted,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      justifyContent: 'center',
      minHeight: 220,
      padding: 24,
      textAlign: 'center',
    }}
  >
    <div style={{ color: COLORS.accent, fontSize: 20 }}>
      {renderCorpusIcon(corpus.icon)}
    </div>
    <div style={{ color: COLORS.text, fontSize: 15, fontWeight: 700 }}>
      {corpus.label}
    </div>
    <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 420 }}>
      No demo entries are loaded for this tab yet. The tab is wired and ready for cross-corpus debate material.
    </div>
  </div>
);

const CorpusViewer = () => {
  const corpusDefinitions = useMemo(() => buildCorpusDefinitions(), []);

  const [activeCorpusKey, setActiveCorpusKey] = useState(corpusDefinitions[0]?.key || 'tweets');

  const activeCorpus = corpusDefinitions.find((corpus) => corpus.key === activeCorpusKey) || corpusDefinitions[0];

  if (!activeCorpus) return null;

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 12,
        color: COLORS.text,
        padding: 16,
      }}
    >
      <div
        style={{
          borderBottom: `1px solid ${COLORS.cardBorder}`,
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          overflowX: 'auto',
          paddingBottom: 2,
        }}
      >
        {corpusDefinitions.map((corpus) => {
          const isActive = corpus.key === activeCorpus.key;

          return (
            <button
              key={corpus.key}
              type="button"
              onClick={() => setActiveCorpusKey(corpus.key)}
              style={{
                alignItems: 'center',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${COLORS.accent}` : '2px solid transparent',
                color: COLORS.text,
                cursor: 'pointer',
                display: 'inline-flex',
                flexShrink: 0,
                gap: 8,
                opacity: isActive ? 1 : 0.72,
                padding: '8px 4px 10px',
              }}
            >
              <span style={{ color: isActive ? COLORS.accent : COLORS.muted, fontSize: 14 }}>
                {renderCorpusIcon(corpus.icon)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {`${corpus.tabLabel} (${formatNumber(corpus.entries.length)} of ${formatNumber(corpus.count_full)})`}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ alignItems: 'center', display: 'flex', gap: 10, marginBottom: 6 }}>
          <span style={{ color: COLORS.accent, fontSize: 16 }}>
            {renderCorpusIcon(activeCorpus.icon)}
          </span>
          <div style={{ color: COLORS.text, fontSize: 18, fontWeight: 700 }}>
            {activeCorpus.label}
          </div>
        </div>
        <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
          Showing {formatNumber(activeCorpus.entries.length)} sampled entries from a corpus of {formatNumber(activeCorpus.count_full)}.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxHeight: 560,
          overflowY: 'auto',
          paddingRight: 4,
        }}
      >
        {activeCorpus.entries.length === 0 ? (
          <EmptyCorpusState corpus={activeCorpus} />
        ) : (
          activeCorpus.entries.map((entry, index) => {
            const key = entry.id || entry.url || `${activeCorpus.key}-${index}`;
            return activeCorpus.key === 'tweets' ? (
              <TweetCard key={key} entry={entry} />
            ) : (
              <EntryCard key={key} corpusKey={activeCorpus.key} entry={entry} />
            );
          })
        )}
      </div>
    </div>
  );
};

export default CorpusViewer;
