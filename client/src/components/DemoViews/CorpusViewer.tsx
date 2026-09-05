import React, { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBook,
  faBrain,
  faChartBar,
  faDownload,
  faExternalLinkAlt,
  faFileAlt,
  faGavel,
  faLink,
  faMicrophone,
} from '@fortawesome/free-solid-svg-icons';
import { faGithub, faTwitter } from '@fortawesome/free-brands-svg-icons';

import corpusSample from '../../variables/demo/corpus_sample.json';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './CorpusViewer.module.scss';
import ArxivCard from './ArxivCard';
import InsiderCard from './InsiderCard';
import TagModal from '../TagPage/TagModal';
import { buildDemoCorpusRecords } from '../../utilities/demo/demoCorpusRecords.js';
import WorldResultsMap from './DemoAnalysis/WorldResultsMap';
import PolicyGlobe, {
  getPolicyJurisdictionAnchor,
  getJurisdictionFlag,
  POLICY_FILTERS,
  getPolicyStatusGroup,
  getPolicyStatusLabel,
} from './PolicyGlobe';
import policyStyles from './PolicyGlobe.module.scss';
import TweetCard, { DebateMapSection, ExternalSourceLink } from './TweetCard';
import { CrossCorpusCard, LessWrongCard, MetricCard, SciFiCard } from './CorpusNativeCards';
import {
  buildPublicRepoBlobUrl,
  buildPublicRepoRawUrl,
  PUBLIC_AI_DISCOURSE_CORPUS_URL,
} from '../../variables/publicRepoMetadata.js';

type CorpusEntry = {
  id?: string;
  title?: string;
  author?: string;
  authors?: string[];
  summary?: string;
  abstract?: string;
  tags?: string[];
  url?: string;
  image_url?: string;
  date?: string | number;
  date_enacted?: string | number;
  created_at?: string | number;
  year?: string | number;
  jurisdiction?: string;
  venue?: string;
  interviewer?: string;
  category?: string;
  icon?: string;
  label?: string;
  [key: string]: any;
};

type CorpusDefinition = {
  key: string;
  label?: string;
  tabLabel: string;
  icon?: string;
  count_full?: unknown;
  entries: CorpusEntry[];
  [key: string]: any;
};

type AtlasIssueOpenHandler = (...args: any[]) => void;

type CorpusViewerProps = {
  onAtlasIssueOpen?: AtlasIssueOpenHandler | null;
  showGithubLink?: boolean;
  externalLoadRequestNonce?: number;
  onExternalLoadStateChange?:
    | ((state: {
        activeCorpusKey: string;
        activeCorpusLabel: string;
        loadStatus: CorpusLoadStatus;
        loadButtonLabel: string;
        disableLoadButton: boolean;
        error: string;
      }) => void)
    | null;
};

type EntryCardProps = {
  corpusKey: string;
  entry: CorpusEntry;
  onTagClick?: (tag: string) => void;
  onAtlasIssueOpen?: AtlasIssueOpenHandler | null;
};

type EmptyCorpusStateProps = {
  corpus: CorpusDefinition;
  title?: string;
  text?: string;
};

const CORPUS_ORDER = [
  'cross_corpus',
  'tweets',
  'ai_laws_policy',
  'arxiv_ai_safety',
  'lesswrong_posts',
  'dwarkesh_lab_insiders',
  'ai_scifi_books',
  'metr_evals_metrics',
];

const FULL_CORPUS_RAW_PATH_BY_KEY = Object.freeze<Record<string, string>>({
  tweets: 'ai-discourse-corpus/corpuses/enriched-tweets.json',
  ai_laws_policy: 'ai-discourse-corpus/corpuses/ai-laws-policy-corpus.json',
  arxiv_ai_safety: 'ai-discourse-corpus/corpuses/arxiv-ai-safety-corpus.json',
  lesswrong_posts: 'ai-discourse-corpus/corpuses/lesswrong-posts-corpus.json',
  cross_corpus: 'ai-discourse-corpus/corpuses/cross-corpus-debates.json',
  dwarkesh_lab_insiders: 'ai-discourse-corpus/corpuses/dwarkesh-lab-insiders-corpus.json',
  ai_scifi_books: 'ai-discourse-corpus/corpuses/ai-scifi-books-corpus.json',
  metr_evals_metrics: 'ai-discourse-corpus/corpuses/metr-evals-metrics-corpus.json',
});

type CorpusLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

const ICONS: Record<string, IconDefinition> = {
  bird: faTwitter,
  gavel: faGavel,
  'file-text': faFileAlt,
  brain: faBrain,
  mic: faMicrophone,
  book: faBook,
  chart: faChartBar,
  link: faLink,
};

const ICON_FALLBACKS: Record<string, string> = {
  bird: '🐦',
  gavel: '⚖️',
  'file-text': '📄',
  brain: '🧠',
  mic: '🎙️',
  book: '📚',
  chart: '📊',
  link: '🔗',
};

const TAB_LABELS: Record<string, string> = {
  tweets: 'Tweets',
  ai_laws_policy: 'Laws & Policy',
  arxiv_ai_safety: 'Papers',
  lesswrong_posts: 'LessWrong',
  dwarkesh_lab_insiders: 'Insider Interviews',
  ai_scifi_books: 'Sci-Fi',
  metr_evals_metrics: 'Metrics',
  cross_corpus: 'Cross-Corpus',
};

const POLICY_ANCHOR_TO_ISO_A3 = Object.freeze<Record<string, string[]>>({
  africa: ['ZAF', 'EGY', 'NGA', 'KEN', 'ETH'],
  asean: ['IDN', 'MYS', 'PHL', 'SGP', 'THA', 'VNM'],
  australia: ['AUS'],
  brazil: ['BRA'],
  canada: ['CAN'],
  china: ['CHN'],
  eu: [
    'FRA',
    'DEU',
    'ITA',
    'POL',
    'ESP',
    'NLD',
    'BEL',
    'IRL',
    'AUT',
    'SWE',
    'DNK',
    'FIN',
    'GRC',
    'PRT',
    'ROU',
    'CZE',
    'HUN',
  ],
  india: ['IND'],
  japan: ['JPN'],
  southKorea: ['KOR'],
  uk: ['GBR'],
  us: ['USA'],
});

const MOBILE_TWEET_PREVIEW_LIMIT = 5;
const MOBILE_TWEET_PREVIEW_QUERY = '(max-width: 720px)';
const demoCorpusesByKey = (corpusSample as { corpuses?: Record<string, any> }).corpuses || {};
const getDemoCorpusRecords = buildDemoCorpusRecords as (demoCorpuses?: CorpusDefinition[]) => any[];

const readIsMobileTweetPreview = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(MOBILE_TWEET_PREVIEW_QUERY).matches;

const useIsMobileTweetPreview = () => {
  const [isMobileTweetPreview, setIsMobileTweetPreview] = useState(readIsMobileTweetPreview);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_TWEET_PREVIEW_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsMobileTweetPreview(!!event.matches);

    setIsMobileTweetPreview(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }

    return undefined;
  }, []);

  return isMobileTweetPreview;
};

const mergePolicyMapStatus = (currentStatus = '', nextStatus = '') => {
  if (!currentStatus) return nextStatus;
  if (!nextStatus || currentStatus === nextStatus) return currentStatus;
  return 'mixed';
};

const buildPolicyMapState = (entries: CorpusEntry[] = []) => {
  const mapData: Record<string, string> = {};
  let globalStatus = '';

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const statusGroup = getPolicyStatusGroup(entry);
    const anchor = getPolicyJurisdictionAnchor(entry?.jurisdiction);

    if (anchor === 'international') {
      globalStatus = mergePolicyMapStatus(globalStatus, statusGroup);
      return;
    }

    (POLICY_ANCHOR_TO_ISO_A3[anchor] || []).forEach((isoCode) => {
      mapData[isoCode] = mergePolicyMapStatus(mapData[isoCode], statusGroup);
    });
  });

  return { globalStatus, mapData };
};

const getPolicyMapFill = (status = '', isFallback = false) => {
  switch (status) {
    case 'live':
      return `color-mix(in srgb, var(--ce-status-success) ${isFallback ? '16%' : '56%'}, transparent)`;
    case 'proposed':
      return `color-mix(in srgb, var(--ce-status-warning) ${isFallback ? '16%' : '56%'}, transparent)`;
    case 'inactive':
      return `color-mix(in srgb, var(--ce-status-danger) ${isFallback ? '16%' : '52%'}, transparent)`;
    case 'mixed':
      return `color-mix(in srgb, var(--ce-data-series-2) ${isFallback ? '16%' : '52%'}, transparent)`;
    default:
      return 'color-mix(in srgb, var(--ce-panel-text) 6%, transparent)';
  }
};

const shouldUseHalfWidthGrid = (corpusKey = '') =>
  corpusKey === 'tweets' || corpusKey === 'arxiv_ai_safety' || corpusKey === 'cross_corpus';

const normalizeEntryText = (value: unknown = '') =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const toTitleCase = (value: unknown = '') =>
  normalizeEntryText(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizeSourceUrl = (value: unknown = '') => {
  if (typeof value === 'string') return normalizeEntryText(value);
  if (value && typeof value === 'object' && 'url' in value) {
    return normalizeEntryText((value as { url?: unknown }).url);
  }
  return '';
};

const getCorpusCount = (value: unknown = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
};

const formatCorpusDisplayName = (value: unknown = '') => {
  const normalized = normalizeEntryText(value).toLowerCase();
  if (!normalized) return '';
  if (normalized === 'metr') return 'METR';
  if (normalized === 'metr_reports') return 'METR Reports';
  if (normalized === 'lesswrong') return 'LessWrong';
  if (normalized === 'dwarkesh') return 'Dwarkesh';
  if (normalized === 'ai_scifi') return 'AI Sci-Fi';
  if (normalized === 'ai_laws') return 'AI Laws';
  return toTitleCase(normalized.replace(/[_-]+/g, ' '));
};

const flattenArgumentTreeNodes = (node: unknown): any[] => {
  if (!node || typeof node !== 'object') return [];
  const nodeObject = node as Record<string, any>;
  const children = Array.isArray(nodeObject.children) ? nodeObject.children : [];
  return [nodeObject, ...children.flatMap((child) => flattenArgumentTreeNodes(child))];
};

const buildLoadedEntry = (entry: CorpusEntry = {}) => {
  const sourceLinks = Array.isArray(entry?.source_links) ? entry.source_links : [];
  const fallbackUrl = normalizeSourceUrl(sourceLinks[0]);
  const sourceUrl = normalizeEntryText(entry?.source_url);
  const questionSummary = normalizeEntryText(entry?.question);
  const relevanceSummary = normalizeEntryText(entry?.relevance_to_ai_discourse);
  const summary = normalizeEntryText(entry?.summary) || questionSummary || relevanceSummary;
  const tags =
    Array.isArray(entry?.tags) && entry.tags.length > 0
      ? entry.tags
      : Array.isArray(entry?.themes)
        ? entry.themes.slice(0, 6)
        : [];

  return {
    ...entry,
    url: normalizeEntryText(entry?.url) || sourceUrl || fallbackUrl,
    summary,
    tags,
  };
};

const buildCrossCorpusDebateEntries = (payload: Record<string, any> = {}) => {
  const debates = Array.isArray(payload?.debates) ? payload.debates : [];
  const datasetUrl = buildPublicRepoBlobUrl(FULL_CORPUS_RAW_PATH_BY_KEY.cross_corpus);
  const fallbackCorpora = Array.isArray(payload?.meta?.corpora_synthesized)
    ? payload.meta.corpora_synthesized.map((value: unknown) => formatCorpusDisplayName(value)).filter(Boolean)
    : [];

  return debates.map((debate: Record<string, any>, index: number) => {
    const contestedPremises = Array.isArray(debate?.premise_extraction?.contested_premises)
      ? debate.premise_extraction.contested_premises
      : [];
    const leadPremise =
      contestedPremises.find((premise: Record<string, any>) => normalizeEntryText(premise?.premise)) || null;
    const argumentNodes = flattenArgumentTreeNodes(debate?.argument_tree?.root);
    const supportingNodes = argumentNodes.filter((node: Record<string, any>) =>
      normalizeEntryText(node?.source?.title),
    );
    const featuredSource = supportingNodes[0]?.source || {};
    const corporaSynthesized = Array.from(
      new Set(
        supportingNodes
          .map((node: Record<string, any>) => formatCorpusDisplayName(node?.source?.corpus))
          .filter(Boolean),
      ),
    );
    const confirmedAgreements = Array.isArray(debate?.agreement_map?.confirmed_agreements)
      ? debate.agreement_map.confirmed_agreements
      : [];
    const normalizedCategory = formatCorpusDisplayName(debate?.category);

    return buildLoadedEntry({
      id: debate?.id || `cross-corpus-${index}`,
      title: debate?.title,
      author: 'Cross-corpus synthesis',
      date: payload?.meta?.date_generated || '',
      url: datasetUrl,
      source_label: 'Open dataset',
      category: normalizedCategory,
      summary: debate?.question,
      central_tension: leadPremise?.premise || debate?.agreement_map?.narrowed_disagreement || '',
      featured_source_title: featuredSource?.title || '',
      featured_source_author: featuredSource?.author || '',
      featured_source_corpus: formatCorpusDisplayName(featuredSource?.corpus),
      corpora_synthesized: corporaSynthesized.length > 0 ? corporaSynthesized : fallbackCorpora,
      confirmed_agreement_count: confirmedAgreements.length,
      tags: ['Cross-Corpus', normalizedCategory, ...corporaSynthesized.slice(0, 3)].filter(Boolean),
    });
  });
};

const truncateEntryText = (value: unknown = '', maxLength = 240) => {
  const normalized = normalizeEntryText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
};

const buildEntryInsight = (entry: CorpusEntry = {}) => {
  const novelArguments = normalizeEntryText(
    entry.novel_arguments_and_concepts || entry.novel_arguments_and_perspectives,
  );
  if (novelArguments) {
    return {
      label: 'Novel argument',
      text: truncateEntryText(novelArguments, 280),
    };
  }

  const centralTension = normalizeEntryText(entry.central_tension);
  if (centralTension) {
    return {
      label: 'Central tension',
      text: truncateEntryText(centralTension, 240),
    };
  }

  return null;
};

const buildEntrySupportMeta = (entry: CorpusEntry = {}) => {
  const lines: string[] = [];
  const corpora = Array.isArray(entry.corpora_synthesized)
    ? entry.corpora_synthesized.map((value) => normalizeEntryText(value)).filter(Boolean)
    : [];

  if (corpora.length > 0) {
    lines.push(`Synthesizes: ${corpora.slice(0, 4).join(' • ')}`);
  }

  const featuredSourceTitle = normalizeEntryText(entry.featured_source_title);
  if (featuredSourceTitle) {
    const featuredSourceMeta = [
      normalizeEntryText(entry.featured_source_corpus),
      normalizeEntryText(entry.featured_source_author),
    ]
      .filter(Boolean)
      .join(' • ');
    lines.push(
      featuredSourceMeta
        ? `Featured source: ${featuredSourceTitle} (${featuredSourceMeta})`
        : `Featured source: ${featuredSourceTitle}`,
    );
  }

  const confirmedAgreementCount = getCorpusCount(entry.confirmed_agreement_count);
  if (confirmedAgreementCount > 0) {
    lines.push(`Shared ground: ${confirmedAgreementCount} confirmed agreements`);
  }

  return lines;
};

const formatAuthors = (entry: CorpusEntry = {}) => {
  if (entry.author) return entry.author;
  if (!Array.isArray(entry.authors) || entry.authors.length === 0) return null;
  if (entry.authors.length === 1) return entry.authors[0];
  if (entry.authors.length === 2) return `${entry.authors[0]}, ${entry.authors[1]}`;
  return `${entry.authors[0]} +${entry.authors.length - 1}`;
};

const buildInsiderAuthorKey = (entry: CorpusEntry = {}) =>
  String(entry.author || entry.title || entry.id || '')
    .trim()
    .toLowerCase();

const diversifyInsiderEntries = (entries: CorpusEntry[] = []) => {
  const remainingEntries = Array.isArray(entries) ? [...entries] : [];
  const orderedEntries: CorpusEntry[] = [];
  let lastAuthorKey = '';

  while (remainingEntries.length > 0) {
    let nextIndex = -1;
    for (let index = 0; index < remainingEntries.length; index += 1) {
      if (buildInsiderAuthorKey(remainingEntries[index]) !== lastAuthorKey) {
        nextIndex = index;
        break;
      }
    }
    const safeIndex = nextIndex >= 0 ? nextIndex : 0;
    const [nextEntry] = remainingEntries.splice(safeIndex, 1);
    orderedEntries.push(nextEntry);
    lastAuthorKey = buildInsiderAuthorKey(nextEntry);
  }

  return orderedEntries;
};

const buildCorpusDefinitions = (): CorpusDefinition[] =>
  CORPUS_ORDER.map((key) => {
    const corpus = demoCorpusesByKey[key];
    if (!corpus) return null;
    const entries = Array.isArray(corpus.entries) ? (corpus.entries as CorpusEntry[]) : [];
    const orderedEntries = key === 'dwarkesh_lab_insiders' ? diversifyInsiderEntries(entries) : entries;

    return {
      ...corpus,
      count_full: corpus.count_full,
      entries: orderedEntries,
      key,
      tabLabel: TAB_LABELS[key] || corpus.label || key,
    };
  }).filter((corpus): corpus is CorpusDefinition => Boolean(corpus));

const buildLoadedCorpusDefinition = (
  key = '',
  payload: any = {},
  fallbackCorpus: CorpusDefinition,
): CorpusDefinition => {
  const rawEntries = Array.isArray(payload) ? payload : Array.isArray(payload?.entries) ? payload.entries : [];
  const loadedEntries =
    key === 'cross_corpus' && Array.isArray(payload?.debates)
      ? buildCrossCorpusDebateEntries(payload)
      : rawEntries.map((entry: CorpusEntry) => buildLoadedEntry(entry));
  const orderedEntries = key === 'dwarkesh_lab_insiders' ? diversifyInsiderEntries(loadedEntries) : loadedEntries;
  const countFull = getCorpusCount(
    payload?.meta?.total_entries ||
      payload?.meta?.entry_count ||
      payload?.meta?.debate_count ||
      payload?.meta?.count_full ||
      loadedEntries.length ||
      fallbackCorpus?.count_full,
  );

  return {
    ...fallbackCorpus,
    count_full: countFull || fallbackCorpus?.count_full,
    entries: orderedEntries,
  };
};

const getEntryYear = (entry: CorpusEntry = {}) => {
  if (entry.year) return entry.year;
  const datedValue = entry.date || entry.date_enacted || entry.created_at;
  if (!datedValue) return null;
  const date = new Date(datedValue);
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
};

const renderCorpusIcon = (iconKey: string | undefined) => {
  const normalizedIconKey = iconKey || 'link';
  const iconDefinition = ICONS[normalizedIconKey];
  if (iconDefinition) {
    return <FontAwesomeIcon icon={iconDefinition} />;
  }
  return <span>{ICON_FALLBACKS[normalizedIconKey] || '•'}</span>;
};

const buildNonTweetMeta = (corpusKey: string, entry: CorpusEntry = {}) => {
  const bits: Array<string | number> = [];
  const authorText = formatAuthors(entry);
  const year = getEntryYear(entry);

  if (authorText) bits.push(authorText);
  if (year) bits.push(year);
  if (entry.jurisdiction && corpusKey !== 'ai_laws_policy') bits.push(entry.jurisdiction);
  if (entry.venue) bits.push(entry.venue);
  if (entry.interviewer) bits.push(`with ${entry.interviewer}`);
  if (entry.category) bits.push(entry.category);

  return bits;
};

const EntryCard = ({ corpusKey, entry, onTagClick, onAtlasIssueOpen }: EntryCardProps) => {
  const isPolicyCorpus = corpusKey === 'ai_laws_policy';
  const isMetrCorpus = corpusKey === 'metr_evals_metrics';
  const meta = buildNonTweetMeta(corpusKey, entry);
  const summaryText = entry.summary || '';
  const entryInsight = buildEntryInsight(entry);
  const entrySupportMeta = buildEntrySupportMeta(entry);
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  const policyStatusGroup = isPolicyCorpus ? getPolicyStatusGroup(entry) : null;
  const policyFlag = isPolicyCorpus ? getJurisdictionFlag(entry.jurisdiction) : null;
  const policyStatusLabel = isPolicyCorpus ? getPolicyStatusLabel(entry) : null;
  const policyStatusBadgeClassName =
    policyStatusGroup === POLICY_FILTERS.proposed
      ? policyStyles.statusProposed
      : policyStatusGroup === POLICY_FILTERS.inactive
        ? policyStyles.statusInactive
        : policyStyles.statusLive;
  const sourceLabel = isMetrCorpus ? 'Open full report' : 'View source';
  const cardClassName = `${styles.card} ${
    isPolicyCorpus ? policyStyles.policyCard : isMetrCorpus ? styles.metrCard : ''
  }`.trim();

  return (
    <article className={cardClassName}>
      <div className={styles.entryHeader}>
        <div className={styles.entryHeaderContent}>
          {isPolicyCorpus ? (
            <div className={policyStyles.policyTitleRow}>
              <span className={policyStyles.jurisdictionFlag} aria-hidden="true">
                {policyFlag}
              </span>
              <div className={styles.entryTitle}>{entry.title || entry.id || 'Untitled entry'}</div>
            </div>
          ) : (
            <div className={styles.entryTitle}>{entry.title || entry.id || 'Untitled entry'}</div>
          )}
          {meta.length > 0 && <div className={styles.entryMeta}>{meta.join(' • ')}</div>}
        </div>
        {isPolicyCorpus ? (
          <div className={policyStyles.policyBadgeRow}>
            <span className={`${policyStyles.statusBadge} ${policyStatusBadgeClassName}`.trim()}>
              {policyStatusLabel}
            </span>
            {entry.jurisdiction ? (
              <span className={`${styles.pill} ${styles.jurisdictionBadge}`}>{entry.jurisdiction}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {entry?.image_url ? (
        <div className={styles.entryMediaBlock}>
          {entry?.url ? (
            <a href={entry.url} rel="noopener noreferrer" target="_blank" className={styles.entryMediaLink}>
              <img
                src={entry.image_url}
                alt={entry.title || 'Explorer preview'}
                className={styles.entryMediaImage}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </a>
          ) : (
            <img
              src={entry.image_url}
              alt={entry.title || 'Explorer preview'}
              className={styles.entryMediaImage}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      ) : null}

      <div className={`${styles.entrySummary} ${styles.clamp3}`}>{summaryText}</div>

      {entryInsight ? (
        <div className={styles.entryInsightBlock}>
          <div className={styles.entryInsightLabel}>{entryInsight.label}</div>
          <div className={styles.entryInsightText}>{entryInsight.text}</div>
        </div>
      ) : null}

      {entrySupportMeta.length > 0 ? (
        <div className={styles.entrySupportMeta}>
          {entrySupportMeta.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}

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

      <div className={styles.cardFooter}>
        <DebateMapSection entry={entry as any} onAtlasIssueOpen={onAtlasIssueOpen || undefined} />
        {entry?.url ? (
          <div className={styles.cardFooterLinks}>
            {isMetrCorpus ? (
              <a
                href={entry.url}
                rel="noopener noreferrer"
                target="_blank"
                className={styles.externalIconLink}
                aria-label={sourceLabel}
                title={sourceLabel}
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </a>
            ) : (
              <ExternalSourceLink entry={entry} fallbackLabel={sourceLabel} />
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
};

const EmptyCorpusState = ({ corpus, title, text }: EmptyCorpusStateProps) => (
  <div className={styles.emptyState}>
    <div className={styles.emptyStateIcon}>{renderCorpusIcon(corpus.icon)}</div>
    <div className={styles.emptyStateTitle}>{title || corpus.label}</div>
    <div className={styles.emptyStateText}>
      {text ||
        'No demo entries are loaded for this tab yet. The tab is wired and ready for cross-corpus debate material.'}
    </div>
  </div>
);

const CorpusViewer = ({
  onAtlasIssueOpen = null,
  showGithubLink = true,
  externalLoadRequestNonce = 0,
  onExternalLoadStateChange = null,
}: CorpusViewerProps) => {
  const [corpusDefinitions, setCorpusDefinitions] = useState<CorpusDefinition[]>(() => buildCorpusDefinitions());
  const [corpusLoadStatusByKey, setCorpusLoadStatusByKey] = useState<Record<string, CorpusLoadStatus>>({});
  const [corpusLoadErrorByKey, setCorpusLoadErrorByKey] = useState<Record<string, string>>({});
  // Intentionally cross-corpus: tag explorer shows every record with the clicked tag across all demo corpuses, ignoring any per-tab (e.g. PolicyGlobe) filter.
  const demoCorpusRecords = useMemo(() => getDemoCorpusRecords(corpusDefinitions), [corpusDefinitions]);

  const [activeCorpusKey, setActiveCorpusKey] = useState(corpusDefinitions[0]?.key || 'cross_corpus');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [mobileTweetsExpanded, setMobileTweetsExpanded] = useState(false);
  const isMobileTweetPreview = useIsMobileTweetPreview();
  const handledExternalLoadRequestNonceRef = React.useRef(externalLoadRequestNonce);

  const activeCorpus = corpusDefinitions.find((corpus) => corpus.key === activeCorpusKey) || corpusDefinitions[0];
  const activeCorpusLoadStatus = activeCorpus ? corpusLoadStatusByKey[activeCorpus.key] || 'idle' : 'idle';
  const activeCorpusLoadError = activeCorpus ? corpusLoadErrorByKey[activeCorpus.key] || '' : '';
  const activeCorpusTotalCount = getCorpusCount(activeCorpus?.count_full) || activeCorpus?.entries.length || 0;
  const activeCorpusCountLabel = activeCorpus
    ? `${activeCorpus.entries.length.toLocaleString()} of ${activeCorpusTotalCount.toLocaleString()} entries`
    : '';
  const loadFullCorpusLabel =
    activeCorpusLoadStatus === 'loading'
      ? 'Loading full corpus…'
      : activeCorpusLoadStatus === 'loaded'
        ? 'Full corpus loaded'
        : activeCorpusLoadStatus === 'error'
          ? 'Retry full corpus'
          : 'Load full corpus';
  const disableLoadFullCorpusButton = activeCorpusLoadStatus === 'loading' || activeCorpusLoadStatus === 'loaded';

  useEffect(() => {
    setMobileTweetsExpanded(false);
  }, [activeCorpusKey]);

  const handleLoadFullCorpus = React.useCallback(async () => {
    if (!activeCorpus) return;
    const rawPath = FULL_CORPUS_RAW_PATH_BY_KEY[activeCorpus.key];
    if (!rawPath || activeCorpusLoadStatus === 'loading' || activeCorpusLoadStatus === 'loaded') return;

    setCorpusLoadStatusByKey((previous) => ({
      ...previous,
      [activeCorpus.key]: 'loading',
    }));
    setCorpusLoadErrorByKey((previous) => ({
      ...previous,
      [activeCorpus.key]: '',
    }));

    try {
      const response = await fetch(buildPublicRepoRawUrl(rawPath), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`GitHub returned ${response.status}`);
      }

      const payload = await response.json();
      setCorpusDefinitions((previous) =>
        previous.map((corpus) =>
          corpus.key === activeCorpus.key ? buildLoadedCorpusDefinition(activeCorpus.key, payload, corpus) : corpus,
        ),
      );
      setCorpusLoadStatusByKey((previous) => ({
        ...previous,
        [activeCorpus.key]: 'loaded',
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to load the full corpus right now.';
      setCorpusLoadStatusByKey((previous) => ({
        ...previous,
        [activeCorpus.key]: 'error',
      }));
      setCorpusLoadErrorByKey((previous) => ({
        ...previous,
        [activeCorpus.key]: errorMessage,
      }));
    }
  }, [activeCorpus, activeCorpusLoadStatus]);

  useEffect(() => {
    if (!activeCorpus || typeof onExternalLoadStateChange !== 'function') return;

    onExternalLoadStateChange({
      activeCorpusKey: activeCorpus.key,
      activeCorpusLabel: activeCorpus.tabLabel,
      loadStatus: activeCorpusLoadStatus,
      loadButtonLabel: loadFullCorpusLabel,
      disableLoadButton: disableLoadFullCorpusButton,
      error: activeCorpusLoadError,
    });
  }, [
    activeCorpus,
    activeCorpusLoadError,
    activeCorpusLoadStatus,
    disableLoadFullCorpusButton,
    loadFullCorpusLabel,
    onExternalLoadStateChange,
  ]);

  useEffect(() => {
    if (externalLoadRequestNonce === handledExternalLoadRequestNonceRef.current) return;
    handledExternalLoadRequestNonceRef.current = externalLoadRequestNonce;
    if (!externalLoadRequestNonce) return;
    void handleLoadFullCorpus();
  }, [externalLoadRequestNonce, handleLoadFullCorpus]);

  if (!activeCorpus) return null;

  const renderEntries = (entries: CorpusEntry[]) =>
    entries.filter(Boolean).map((entry, index) => {
      const key = entry.id || entry.url || `${activeCorpus.key}-${index}`;
      return activeCorpus.key === 'tweets' ? (
        <TweetCard
          key={key}
          entry={entry as any}
          onTagClick={setActiveTag}
          onAtlasIssueOpen={onAtlasIssueOpen || undefined}
        />
      ) : activeCorpus.key === 'arxiv_ai_safety' ? (
        <ArxivCard
          key={key}
          entry={entry as any}
          onTagClick={setActiveTag}
          onAtlasIssueOpen={onAtlasIssueOpen || undefined}
        />
      ) : activeCorpus.key === 'dwarkesh_lab_insiders' ? (
        <InsiderCard
          key={key}
          entry={entry as any}
          onTagClick={setActiveTag}
          onAtlasIssueOpen={onAtlasIssueOpen || undefined}
        />
      ) : activeCorpus.key === 'lesswrong_posts' ? (
        <LessWrongCard
          key={key}
          entry={entry}
          onTagClick={setActiveTag}
          onAtlasIssueOpen={onAtlasIssueOpen || undefined}
        />
      ) : activeCorpus.key === 'ai_scifi_books' ? (
        <SciFiCard key={key} entry={entry} onTagClick={setActiveTag} onAtlasIssueOpen={onAtlasIssueOpen || undefined} />
      ) : activeCorpus.key === 'cross_corpus' ? (
        <CrossCorpusCard
          key={key}
          entry={entry}
          onTagClick={setActiveTag}
          onAtlasIssueOpen={onAtlasIssueOpen || undefined}
        />
      ) : activeCorpus.key === 'metr_evals_metrics' ? (
        <MetricCard
          key={key}
          entry={entry}
          onTagClick={setActiveTag}
          onAtlasIssueOpen={onAtlasIssueOpen || undefined}
        />
      ) : (
        <EntryCard
          key={key}
          corpusKey={activeCorpus.key}
          entry={entry}
          onTagClick={setActiveTag}
          onAtlasIssueOpen={onAtlasIssueOpen}
        />
      );
    });

  const renderEntriesCollection = (entries: CorpusEntry[], { id, testId }: { id?: string; testId?: string } = {}) => (
    <div
      id={id}
      data-testid={testId}
      className={`${styles.entriesCollection} ${shouldUseHalfWidthGrid(activeCorpus.key) ? styles.entriesCollectionHalf : ''}`.trim()}
    >
      {renderEntries(entries)}
    </div>
  );

  const renderTweetEntriesCollection = () => {
    const tweetEntries = activeCorpus.entries.filter(Boolean);
    const shouldShowMobilePreview = isMobileTweetPreview && tweetEntries.length > MOBILE_TWEET_PREVIEW_LIMIT;
    const visibleEntries =
      shouldShowMobilePreview && !mobileTweetsExpanded
        ? tweetEntries.slice(0, MOBILE_TWEET_PREVIEW_LIMIT)
        : tweetEntries;
    const tweetCountLabel = mobileTweetsExpanded
      ? `Showing all ${tweetEntries.length} tweets`
      : `${Math.min(MOBILE_TWEET_PREVIEW_LIMIT, tweetEntries.length)} of ${tweetEntries.length} tweets shown`;

    return (
      <>
        {renderEntriesCollection(visibleEntries, {
          id: 'ce-context-tweet-list',
          testId: 'ce-context-tweet-list',
        })}
        {shouldShowMobilePreview ? (
          <div className={styles.tweetPreviewControl}>
            <span className={styles.tweetPreviewCount} aria-live="polite">
              {tweetCountLabel}
            </span>
            <button
              type="button"
              aria-controls="ce-context-tweet-list"
              aria-expanded={mobileTweetsExpanded}
              className={styles.tweetPreviewButton}
              data-testid="ce-context-tweets-view-more"
              onClick={() => setMobileTweetsExpanded((value) => !value)}
            >
              {mobileTweetsExpanded ? 'Show fewer' : 'View more'}
            </button>
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabBar}>
        {corpusDefinitions.map((corpus) => {
          const isActive = corpus.key === activeCorpus.key;

          return (
            <button
              key={corpus.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveCorpusKey(corpus.key)}
              className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ''}`.trim()}
            >
              <span className={`${styles.tabIcon} ${isActive ? styles.tabIconActive : ''}`.trim()}>
                {renderCorpusIcon(corpus.icon)}
              </span>
              <span className={styles.tabLabel}>{corpus.tabLabel}</span>
            </button>
          );
        })}
      </div>

      {showGithubLink ? (
        <div className={styles.sectionBlock}>
          <div className={styles.sectionActionRow}>
            <a
              href={PUBLIC_AI_DISCOURSE_CORPUS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.githubLink}
            >
              <FontAwesomeIcon className={styles.githubLinkIcon} icon={faGithub} />
              <span>Full corpus on GitHub</span>
            </a>
            <button
              type="button"
              className={`${styles.githubLink} ${styles.loadCorpusButton}`.trim()}
              onClick={handleLoadFullCorpus}
              disabled={disableLoadFullCorpusButton}
              data-testid="ce-context-load-full-corpus"
            >
              <FontAwesomeIcon className={styles.githubLinkIcon} icon={faDownload} />
              <span>{loadFullCorpusLabel}</span>
            </button>
          </div>
          <div className={styles.sectionMeta} data-testid="ce-context-corpus-status">
            {activeCorpusLoadStatus === 'loaded'
              ? `Loaded full ${activeCorpus.tabLabel} corpus • ${activeCorpus.entries.length.toLocaleString()} entries`
              : `Curated ${activeCorpus.tabLabel} sample • ${activeCorpusCountLabel}`}
          </div>
          {activeCorpusLoadError ? (
            <div className={styles.sectionError} role="status">
              {activeCorpusLoadError}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={styles.scrollArea}>
        {activeCorpus.key === 'ai_laws_policy' ? (
          <PolicyGlobe entries={activeCorpus.entries}>
            {({ filteredEntries, filterStatus, FilterControlsElement }) => (
              <div className={styles.policySplitLayout} data-testid={E2E_TESTIDS.CONTEXT_POLICY_SURFACE}>
                <div className={styles.policyListColumn}>
                  <div className={styles.policyListHeader}>
                    <div>
                      <div className={styles.policyListEyebrow}>Filter By</div>
                      <div className={styles.policyListTitle}>AI laws & policy</div>
                    </div>
                    {FilterControlsElement}
                  </div>
                  {filteredEntries.length === 0 ? (
                    <EmptyCorpusState
                      corpus={activeCorpus}
                      title="No matching policy entries"
                      text={
                        filterStatus === 'all'
                          ? 'No policy entries are loaded for this demo corpus yet.'
                          : `No ${filterStatus} policy entries match the current filter.`
                      }
                    />
                  ) : (
                    <div className={styles.policyEntriesList}>
                      {renderEntriesCollection(filteredEntries as CorpusEntry[])}
                    </div>
                  )}
                </div>

                <aside className={styles.policyMapColumn}>
                  {(() => {
                    const { globalStatus, mapData } = buildPolicyMapState(filteredEntries as CorpusEntry[]);

                    return (
                      <div className={styles.policyMapPanel}>
                        <div className={styles.policyMapLens}>
                          <WorldResultsMap
                            data={mapData}
                            colorScale={(regionStatus) =>
                              getPolicyMapFill(String(regionStatus || globalStatus), !regionStatus)
                            }
                            compact
                          />
                        </div>
                      </div>
                    );
                  })()}
                </aside>
              </div>
            )}
          </PolicyGlobe>
        ) : activeCorpus.entries.length === 0 ? (
          <EmptyCorpusState corpus={activeCorpus} />
        ) : activeCorpus.key === 'tweets' ? (
          renderTweetEntriesCollection()
        ) : (
          renderEntriesCollection(activeCorpus.entries)
        )}
      </div>

      <TagModal
        isOpen={!!activeTag}
        toggle={() => setActiveTag(null)}
        activeTag={activeTag}
        demoCorpusMode={true}
        demoCorpusRecords={demoCorpusRecords as any}
      />
    </div>
  );
};

export default CorpusViewer;
