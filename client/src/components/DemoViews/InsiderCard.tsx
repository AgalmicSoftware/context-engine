import React, { useState } from 'react';

import styles from './CorpusViewer.module.scss';
import { DebateMapSection, ExternalSourceLink } from './TweetCard';

type InsiderEntry = {
  id?: string;
  author?: string;
  title?: string;
  role_company?: string;
  date?: string;
  interviewer?: string;
  top_quotes?: string[];
  tags?: string[];
  summary?: string;
  url?: string;
  debate_map_issues?: unknown[];
};

export type InsiderCardProps = {
  entry?: InsiderEntry | null;
  onTagClick?: (tag: string) => void;
  onAtlasIssueOpen?: (...args: unknown[]) => void;
};

const INSIDER_ROLE_BY_ID: Record<string, string> = {
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

const formatInterviewDate = (value: unknown) => {
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
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const buildRoleCompany = (entry: InsiderEntry = {}) => {
  const mappedRole = entry.id ? INSIDER_ROLE_BY_ID[entry.id] : '';
  return entry.role_company || mappedRole || null;
};

const buildLeadQuote = (entry: InsiderEntry = {}) => {
  const quotes = Array.isArray(entry.top_quotes) ? entry.top_quotes : [];
  return quotes[0] || '';
};

const INSIDER_SUMMARY_PREVIEW_LENGTH = 300;

const InsiderCard = ({ entry = {}, onTagClick, onAtlasIssueOpen }: InsiderCardProps) => {
  const resolvedEntry = entry || {};
  const [expanded, setExpanded] = useState(false);
  const intervieweeName = resolvedEntry.author || resolvedEntry.title || 'Unknown interviewee';
  const interviewDate = formatInterviewDate(resolvedEntry.date);
  const roleCompany = buildRoleCompany(resolvedEntry);
  const leadQuote = buildLeadQuote(resolvedEntry);
  const tags = Array.isArray(resolvedEntry.tags) ? resolvedEntry.tags : [];
  const summaryText = resolvedEntry.summary || 'No summary available for this interview yet.';
  const shouldClampSummary = summaryText.length > INSIDER_SUMMARY_PREVIEW_LENGTH;
  const visibleSummary =
    shouldClampSummary && !expanded ? `${summaryText.slice(0, INSIDER_SUMMARY_PREVIEW_LENGTH)}…` : summaryText;

  return (
    <article className={`${styles.card} ${styles.insiderCard}`}>
      <div className={styles.tweetAuthorRow}>
        <div className={styles.insiderPortrait} aria-hidden="true">
          {buildInitials(intervieweeName)}
        </div>
        <div className={styles.entryHeaderContent}>
          <div className={styles.insiderName}>{intervieweeName}</div>
          {roleCompany ? <div className={styles.insiderRole}>{roleCompany}</div> : null}
          {resolvedEntry.interviewer ? (
            <div className={styles.insiderInterviewer}>with {resolvedEntry.interviewer}</div>
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
        <div className={styles.entrySummary}>{visibleSummary}</div>
        {shouldClampSummary ? (
          <button type="button" className={styles.insiderExpandBtn} onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        ) : null}
        {interviewDate ? <div className={styles.entryMeta}>Interview date: {interviewDate}</div> : null}
        {resolvedEntry?.url ||
        (Array.isArray(resolvedEntry?.debate_map_issues) && resolvedEntry.debate_map_issues.length > 0) ? (
          <div className={styles.cardFooter}>
            <DebateMapSection entry={resolvedEntry} onAtlasIssueOpen={onAtlasIssueOpen} />
            {resolvedEntry?.url ? (
              <div className={styles.cardFooterLinks}>
                <ExternalSourceLink entry={resolvedEntry} fallbackLabel="View interview" />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default InsiderCard;
