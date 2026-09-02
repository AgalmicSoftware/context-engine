import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faBookOpen, faChartLine, faProjectDiagram } from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import baseStyles from './CorpusViewer.module.scss';
import nativeStyles from './CorpusNativeCards.module.scss';
import { DebateMapSection, ExternalSourceLink } from './TweetCard';

const styles = { ...baseStyles, ...nativeStyles };

type NativeCorpusEntry = {
  id?: string;
  title?: string;
  author?: string;
  authors?: string[];
  summary?: string;
  url?: string;
  source_label?: string;
  date?: string | number;
  year?: string | number;
  category?: string;
  tags?: string[];
  themes?: string[];
  novel_arguments_and_concepts?: string;
  novel_arguments_and_perspectives?: string;
  central_tension?: string;
  featured_source_title?: string;
  featured_source_author?: string;
  featured_source_corpus?: string;
  corpora_synthesized?: string[];
  confirmed_agreement_count?: number;
  chart_data?: {
    type?: string;
    labels?: string[];
    values?: number[];
    unit?: string;
  };
  debate_map_issues?: unknown[];
  [key: string]: unknown;
};

type NativeCorpusCardProps = {
  entry?: NativeCorpusEntry | null;
  onTagClick?: (tag: string) => void;
  onAtlasIssueOpen?: (issueId: string) => void;
};

const normalizeText = (value: unknown = '') =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const truncate = (value: unknown = '', maxLength = 360) => {
  const normalized = normalizeText(value);
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trimEnd()}…` : normalized;
};

const formatYear = (entry: NativeCorpusEntry = {}) => {
  if (entry.year) return String(entry.year);
  if (!entry.date) return '';
  const date = new Date(entry.date);
  return Number.isNaN(date.getTime()) ? '' : String(date.getFullYear());
};

const uniqueLabels = (...labelGroups: Array<unknown[] | undefined>) =>
  Array.from(
    new Set(
      labelGroups
        .flatMap((labels) => (Array.isArray(labels) ? labels : []))
        .map((label) => normalizeText(label))
        .filter(Boolean),
    ),
  );

const TagPills = ({
  labels,
  onTagClick,
  variantClassName = '',
}: {
  labels: string[];
  onTagClick?: (tag: string) => void;
  variantClassName?: string;
}) =>
  labels.length > 0 ? (
    <div className={styles.pillRow}>
      {labels.slice(0, 6).map((label) => (
        <button
          key={label}
          type="button"
          className={`${styles.pill} ${styles.pillButton} ${variantClassName}`.trim()}
          onClick={() => onTagClick?.(label)}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null;

const CardFooter = ({
  entry,
  label,
  onAtlasIssueOpen,
  actionClassName = '',
}: {
  entry: NativeCorpusEntry;
  label: string;
  onAtlasIssueOpen?: (issueId: string) => void;
  actionClassName?: string;
}) => (
  <div className={styles.cardFooter}>
    <DebateMapSection entry={entry as any} onAtlasIssueOpen={onAtlasIssueOpen} className={actionClassName} />
    {entry.url ? (
      <div className={styles.cardFooterLinks}>
        <ExternalSourceLink entry={entry as any} fallbackLabel={label} className={actionClassName} />
      </div>
    ) : null}
  </div>
);

export const LessWrongCard = ({ entry = {}, onTagClick, onAtlasIssueOpen }: NativeCorpusCardProps) => {
  const resolvedEntry = entry || {};
  const novelArgument =
    resolvedEntry.novel_arguments_and_concepts || resolvedEntry.novel_arguments_and_perspectives || '';
  const readingMinutes = Math.max(3, Math.round(normalizeText(resolvedEntry.summary).split(' ').length / 45));

  return (
    <article className={`${styles.card} ${styles.lessWrongCard}`} data-testid={E2E_TESTIDS.CONTEXT_LESSWRONG_CARD}>
      <header className={styles.lessWrongHeader}>
        <div className={styles.nativeCardEyebrow}>
          <span>LessWrong essay</span>
          <span>{readingMinutes} min read</span>
        </div>
        <h3 className={styles.lessWrongTitle}>{resolvedEntry.title || resolvedEntry.id || 'Untitled essay'}</h3>
        <div className={styles.lessWrongByline}>
          {[resolvedEntry.author, formatYear(resolvedEntry)].filter(Boolean).join(' • ')}
        </div>
      </header>

      <div className={styles.lessWrongArgumentPath} aria-label="Argument path">
        <span>Claim</span>
        <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
        <span>Reasoning</span>
        <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
        <span>Implication</span>
      </div>

      {resolvedEntry.summary ? <p className={styles.lessWrongSummary}>{resolvedEntry.summary}</p> : null}
      {novelArgument ? (
        <aside className={styles.lessWrongInsight}>
          <div className={styles.lessWrongInsightLabel}>Novel argument</div>
          <div>{truncate(novelArgument)}</div>
        </aside>
      ) : null}

      <div className={styles.lessWrongInset}>
        <TagPills
          labels={uniqueLabels(resolvedEntry.tags)}
          onTagClick={onTagClick}
          variantClassName={styles.paperPill}
        />
      </div>
      <div className={styles.lessWrongFooter}>
        <CardFooter
          entry={resolvedEntry}
          label="View source"
          onAtlasIssueOpen={onAtlasIssueOpen}
          actionClassName={styles.paperAction}
        />
      </div>
    </article>
  );
};

export const SciFiCard = ({ entry = {}, onTagClick, onAtlasIssueOpen }: NativeCorpusCardProps) => {
  const resolvedEntry = entry || {};
  const themes = uniqueLabels(resolvedEntry.themes, resolvedEntry.tags);

  return (
    <article className={`${styles.card} ${styles.sciFiCard}`} data-testid={E2E_TESTIDS.CONTEXT_SCIFI_CARD}>
      <div className={styles.sciFiCover} aria-hidden="true">
        <FontAwesomeIcon icon={faBookOpen} />
        <span>{formatYear(resolvedEntry) || 'FUTURE'}</span>
      </div>
      <div className={styles.sciFiContent}>
        <div className={styles.nativeCardEyebrow}>Speculative futures archive</div>
        <h3 className={styles.sciFiTitle}>{resolvedEntry.title || resolvedEntry.id || 'Untitled story'}</h3>
        <div className={styles.sciFiByline}>{resolvedEntry.author || 'Unknown author'}</div>
        {resolvedEntry.summary ? <p className={styles.sciFiSummary}>{resolvedEntry.summary}</p> : null}

        {themes.length > 0 ? (
          <div className={styles.themeConstellation} aria-label="Story themes">
            {themes.slice(0, 5).map((theme, index) => (
              <button key={theme} type="button" onClick={() => onTagClick?.(theme)}>
                <span aria-hidden="true" style={{ '--theme-index': index } as React.CSSProperties} />
                {theme}
              </button>
            ))}
          </div>
        ) : null}

        <CardFooter entry={resolvedEntry} label="Explore story" onAtlasIssueOpen={onAtlasIssueOpen} />
      </div>
    </article>
  );
};

export const CrossCorpusCard = ({ entry = {}, onTagClick, onAtlasIssueOpen }: NativeCorpusCardProps) => {
  const resolvedEntry = entry || {};
  const corpora = uniqueLabels(resolvedEntry.corpora_synthesized);
  const featuredSource = [resolvedEntry.featured_source_corpus, resolvedEntry.featured_source_title]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(' • ');

  return (
    <article className={`${styles.card} ${styles.crossCorpusCard}`} data-testid={E2E_TESTIDS.CONTEXT_CROSS_CARD}>
      <div className={styles.nativeCardEyebrow}>
        <span>Cross-corpus debate</span>
        {resolvedEntry.category ? <span>{resolvedEntry.category}</span> : null}
      </div>
      <h3 className={styles.crossCorpusTitle}>{resolvedEntry.title || resolvedEntry.id || 'Untitled debate'}</h3>
      {resolvedEntry.summary ? <p className={styles.crossCorpusQuestion}>{resolvedEntry.summary}</p> : null}

      <div className={styles.sourceNetwork} aria-label="Sources synthesized">
        <div className={styles.sourceNetworkNodes}>
          {corpora.slice(0, 4).map((corpus) => (
            <span key={corpus}>{corpus}</span>
          ))}
        </div>
        <div className={styles.sourceNetworkAxis} aria-hidden="true">
          <FontAwesomeIcon icon={faProjectDiagram} />
        </div>
        <div className={styles.sourceNetworkLabel}>
          {corpora.length > 0 ? `Synthesizes: ${corpora.slice(0, 4).join(' • ')}` : 'Cross-source synthesis'}
        </div>
      </div>

      {resolvedEntry.central_tension ? (
        <aside className={styles.crossCorpusTension}>
          <div className={styles.entryInsightLabel}>Central tension</div>
          <div>{truncate(resolvedEntry.central_tension, 260)}</div>
        </aside>
      ) : null}

      {featuredSource ? <div className={styles.crossCorpusSource}>Featured source: {featuredSource}</div> : null}
      {Number(resolvedEntry.confirmed_agreement_count || 0) > 0 ? (
        <div className={styles.crossCorpusAgreement}>
          Shared ground: {resolvedEntry.confirmed_agreement_count} confirmed agreements
        </div>
      ) : null}

      <TagPills labels={uniqueLabels(resolvedEntry.tags)} onTagClick={onTagClick} />
      <CardFooter entry={resolvedEntry} label="Open dataset" onAtlasIssueOpen={onAtlasIssueOpen} />
    </article>
  );
};

export const MetricCard = ({ entry = {}, onTagClick, onAtlasIssueOpen }: NativeCorpusCardProps) => {
  const resolvedEntry = entry || {};
  const labels = Array.isArray(resolvedEntry.chart_data?.labels) ? resolvedEntry.chart_data?.labels : [];
  const values = Array.isArray(resolvedEntry.chart_data?.values) ? resolvedEntry.chart_data?.values : [];
  const maxValue = Math.max(...values.map((value) => Number(value) || 0), 1);
  const unit = normalizeText(resolvedEntry.chart_data?.unit) || 'score';

  return (
    <article className={`${styles.card} ${styles.metricCard}`} data-testid={E2E_TESTIDS.CONTEXT_METRIC_CARD}>
      <div className={styles.metricCopy}>
        <div className={styles.nativeCardEyebrow}>
          <FontAwesomeIcon icon={faChartLine} aria-hidden="true" />
          <span>{resolvedEntry.category || 'Evaluation metric'}</span>
        </div>
        <h3 className={styles.metricTitle}>{resolvedEntry.title || resolvedEntry.id || 'Untitled metric'}</h3>
        <div className={styles.metricMeta}>
          {[
            Array.isArray(resolvedEntry.authors) ? resolvedEntry.authors.join(', ') : resolvedEntry.author,
            formatYear(resolvedEntry),
          ]
            .filter(Boolean)
            .join(' • ')}
        </div>
        {resolvedEntry.summary ? <p className={styles.metricSummary}>{resolvedEntry.summary}</p> : null}
        <TagPills
          labels={uniqueLabels(resolvedEntry.tags)}
          onTagClick={onTagClick}
          variantClassName={styles.metricPill}
        />
        <CardFooter
          entry={resolvedEntry}
          label="Open full report"
          onAtlasIssueOpen={onAtlasIssueOpen}
          actionClassName={styles.metricAction}
        />
      </div>

      {values.length > 0 ? (
        <figure className={styles.metricFigure} aria-label={`${resolvedEntry.title || 'Metric'} trend chart`}>
          <figcaption>Measured trend • {unit}</figcaption>
          <div className={styles.metricPlot}>
            {values.map((value, index) => {
              const numericValue = Number(value) || 0;
              const barHeight = Math.max(8, Math.round((numericValue / maxValue) * 100));
              return (
                <div className={styles.metricPlotColumn} key={`${labels[index] || index}-${numericValue}`}>
                  <span className={styles.metricValue}>{numericValue.toLocaleString()}</span>
                  <span
                    className={styles.metricBar}
                    style={{ '--metric-bar-height': `${barHeight}%` } as React.CSSProperties}
                  />
                  <span className={styles.metricLabel}>{labels[index] || index + 1}</span>
                </div>
              );
            })}
          </div>
        </figure>
      ) : null}
    </article>
  );
};
