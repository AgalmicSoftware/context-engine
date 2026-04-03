import React, { useState } from 'react';
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

const COLORS = {
  accent: '#4dffa4',
  card: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
  muted: 'rgba(244,247,255,0.65)',
  surface: 'rgba(255,255,255,0.06)',
  text: '#f4f7ff',
};

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

const TweetCard = ({ entry }) => {
  const summaryText = entry.summary || entry.text || '';
  const createdAt = formatDate(entry.created_at);
  const sentimentStyle = getSentimentStyle(entry.sentiment);
  const CardTag = entry.url ? 'a' : 'div';
  const cardProps = entry.url
    ? {
      href: entry.url,
      rel: 'noopener noreferrer',
      target: '_blank',
    }
    : {};

  return (
    <CardTag
      {...cardProps}
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 8,
        color: COLORS.text,
        cursor: entry.url ? 'pointer' : 'default',
        display: 'block',
        padding: 16,
        textDecoration: 'none',
      }}
    >
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

      <div style={{ alignItems: 'center', color: COLORS.muted, display: 'flex', flexWrap: 'wrap', fontSize: 12, gap: 12 }}>
        <span>❤ {formatNumber(entry.engagement?.likes)}</span>
        <span>↺ {formatNumber(entry.engagement?.reposts)}</span>
        {entry.engagement?.views ? <span>👁 {formatNumber(entry.engagement.views)}</span> : null}
      </div>
    </CardTag>
  );
};

const EntryCard = ({ corpusKey, entry }) => {
  const meta = buildNonTweetMeta(corpusKey, entry);
  const summaryText = entry.summary || '';
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  const CardTag = entry.url ? 'a' : 'div';
  const cardProps = entry.url
    ? {
      href: entry.url,
      rel: 'noopener noreferrer',
      target: '_blank',
    }
    : {};

  return (
    <CardTag
      {...cardProps}
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.cardBorder}`,
        borderRadius: 8,
        color: 'inherit',
        cursor: entry.url ? 'pointer' : 'default',
        display: 'block',
        padding: 16,
        textDecoration: 'none',
      }}
    >
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
    </CardTag>
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
  const corpusDefinitions = CORPUS_ORDER
    .map((key) => {
      const corpus = corpusSample?.corpuses?.[key];
      if (!corpus) return null;
      return {
        ...corpus,
        entries: Array.isArray(corpus.entries) ? corpus.entries : [],
        key,
        tabLabel: TAB_LABELS[key] || corpus.label || key,
      };
    })
    .filter(Boolean);

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
