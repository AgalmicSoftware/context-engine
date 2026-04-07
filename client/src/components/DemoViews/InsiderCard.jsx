import React from 'react';

import styles from './CorpusViewer.module.scss';
import { DebateMapSection, ExternalSourceLink } from './TweetCard.jsx';

const INSIDER_ROLE_BY_ID = {
  amodei_dario_dwarkesh_2023_scaling: 'CEO, Anthropic',
  amodei_dario_dwarkesh_2026_scaling: 'CEO, Anthropic',
  hassabis_demis_dwarkesh_2024_superhuman: 'CEO, Google DeepMind',
  zuckerberg_mark_dwarkesh_2024_llama: 'CEO, Meta',
  zuckerberg_mark_dwarkesh_2025_ai_code: 'CEO, Meta',
  sutskever_ilya_dwarkesh_2025_research: 'Founder, SSI',
  aschenbrenner_leopold_dwarkesh_2024_agi: 'Author, Situational Awareness',
  legg_shane_dwarkesh_2023_agi: 'Chief AGI Scientist, DeepMind',
  schulman_john_dwarkesh_2024_rl: 'Research scientist, OpenAI',
  christiano_paul_dwarkesh_2023_takeover: 'Founder, Alignment Research Center',
  yudkowsky_eliezer_dwarkesh_2023_danger: 'AI safety researcher',
  hotz_george_vs_yudkowsky_dwarkesh_2023_debate: 'Builder vs safety theorist',
  douglas_sholto_dwarkesh_2024_gpt7: 'Anthropic interpretability researchers',
  douglas_sholto_dwarkesh_2025_claude4: 'Anthropic interpretability researchers',
  douglas_sholto_dwarkesh_2025_rl: 'Anthropic interpretability researchers',
  dean_jeff_dwarkesh_2025_google: 'Google researchers',
  cowen_tyler_dwarkesh_2025_bottleneck: 'Economist and writer',
  musk_elon_dwarkesh_2026_space: 'Founder, xAI and SpaceX',
  nadella_satya_dwarkesh_2025_azure: 'CEO, Microsoft',
  karpathy_andrej_dwarkesh_2025_agi: 'AI researcher and educator',
};

const formatInterviewDate = (value) => {
  if (!value) return null;
  const rawValue = String(value).trim();
  const plainDateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = plainDateMatch
    ? new Date(Number(plainDateMatch[1]), Number(plainDateMatch[2]) - 1, Number(plainDateMatch[3]))
    : new Date(rawValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const buildInitials = (name = '') => {
  const parts = String(name || '')
    .replace(/\b(vs\.?|and)\b/gi, ' ')
    .replace(/&/g, ' ')
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]/gi, '').trim())
    .filter(Boolean);

  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
};

const buildRoleCompany = (entry = {}) => (
  entry.role_company || INSIDER_ROLE_BY_ID[entry.id] || null
);

const buildLeadQuote = (entry = {}) => {
  const quotes = Array.isArray(entry.top_quotes) ? entry.top_quotes : [];
  return quotes[0] || '';
};

const InsiderCard = ({ entry, onTagClick, onAtlasIssueOpen }) => {
  const intervieweeName = entry.author || entry.title || 'Unknown interviewee';
  const interviewDate = formatInterviewDate(entry.date);
  const roleCompany = buildRoleCompany(entry);
  const leadQuote = buildLeadQuote(entry);
  const tags = Array.isArray(entry.tags) ? entry.tags : [];

  return (
    <article className={`${styles.card} ${styles.insiderCard}`}>
      <div className={styles.tweetAuthorRow}>
        <div className={styles.insiderPortrait} aria-hidden="true">
          {buildInitials(intervieweeName)}
        </div>
        <div className={styles.entryHeaderContent}>
          <div className={styles.insiderName}>
            {intervieweeName}
          </div>
          {roleCompany ? (
            <div className={styles.insiderRole}>
              {roleCompany}
            </div>
          ) : null}
          {entry.interviewer ? (
            <div className={styles.insiderInterviewer}>
              with {entry.interviewer}
            </div>
          ) : null}
        </div>
      </div>

      {leadQuote ? (
        <div className={styles.insiderQuote}>
          <span className={styles.insiderQuoteMark} aria-hidden="true">
            &ldquo;
          </span>
          <span>{leadQuote}</span>
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

      <div className={styles.insiderDetails}>
        <div className={styles.entrySummary}>
          {entry.summary || 'No summary available for this interview yet.'}
        </div>
        {interviewDate ? (
          <div className={styles.entryMeta}>
            Interview date: {interviewDate}
          </div>
        ) : null}
        {(entry?.url || (Array.isArray(entry?.debate_map_issues) && entry.debate_map_issues.length > 0)) ? (
          <div className={styles.cardFooter}>
            <DebateMapSection entry={entry} onAtlasIssueOpen={onAtlasIssueOpen} />
            {entry?.url ? (
              <div className={styles.cardFooterLinks}>
                <ExternalSourceLink entry={entry} fallbackLabel="View interview" />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default InsiderCard;
