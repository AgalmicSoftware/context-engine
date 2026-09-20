import React, { Suspense } from 'react';

import LazyFallback from '../Shared/LazyFallback';
import type { SessionResultsGeneratedAnalysisArtifact } from '../../utilities/sessionResultsExport/sessionResultsAnalysisArtifacts';
import {
  buildGeneratedBreakdownAnalysisData,
  buildGeneratedDebateMapAdapter,
  buildGeneratedRiskMatrixAdapter,
  type GeneratedSessionResultsSubmittedQuestion,
  type GeneratedSessionResultsSubmittedResponse,
} from './sessionResultsGeneratedViewAdapters';
import {
  SESSION_GENERATED_RESULTS_VIEW_KEYS,
  type SessionGeneratedResultsViewKey,
} from '../../domains/sessionResults/sessionResultsGeneratedViewTypes';
import styles from './SessionGeneratedResultsViews.module.scss';

const DebateMap = React.lazy(() => import('../DebateMap/DebateMap'));
const DemoAnalysisWorkspace = React.lazy(() => import('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace'));
const RiskMatrix = React.lazy(() => import('../MainContent/RiskMatrix'));

export type SessionGeneratedResultsViewsProps = {
  artifact: SessionResultsGeneratedAnalysisArtifact | null;
  className?: string;
  questions?: GeneratedSessionResultsSubmittedQuestion[];
  responses?: GeneratedSessionResultsSubmittedResponse[];
  selectedView: SessionGeneratedResultsViewKey;
  sessionSlug?: string;
};

const VIEW_LABELS: Record<SessionGeneratedResultsViewKey, string> = {
  [SESSION_GENERATED_RESULTS_VIEW_KEYS.ATLAS]: 'Atlas',
  [SESSION_GENERATED_RESULTS_VIEW_KEYS.BREAKDOWN]: 'Breakdown',
  [SESSION_GENERATED_RESULTS_VIEW_KEYS.CIRCLES]: 'Circles',
  [SESSION_GENERATED_RESULTS_VIEW_KEYS.RISK_MATRIX]: 'Risk Matrix',
};

const formatGeneratedAt = (value: unknown): string => {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

type PlainRecord = Record<string, unknown>;

type GeneratedBreakdownItem = {
  body: string;
  id: string;
  label: string;
  sourceRefs: string[];
};

const ETH_ADDRESS_TEXT_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const toRecord = (value: unknown): PlainRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as PlainRecord) : {};

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const toText = (value: unknown): string =>
  value === null || value === undefined
    ? ''
    : String(value)
        .replace(/\b0x[a-fA-F0-9]{40}\b/g, '[redacted-address]')
        .replace(/\r?\n/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const slugify = (value: unknown, fallback = 'item'): string => {
  const slug = toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || fallback;
};

const uniqueTexts = (values: unknown[]): string[] => Array.from(new Set(values.map(toText).filter(Boolean)));

const flattenSourceRefValues = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value.flatMap(flattenSourceRefValues);
  const record = toRecord(value);
  if (Object.keys(record).length > 0) {
    return [record.label ?? record.ref ?? record.id ?? record.questionId ?? record.sourceId ?? ''];
  }
  return [value];
};

const collectSourceRefs = (...values: unknown[]): string[] =>
  uniqueTexts(values.flatMap(flattenSourceRefValues)).filter((ref) => !ETH_ADDRESS_TEXT_PATTERN.test(ref));

const buildGeneratedBreakdownItems = (values: unknown[], fallbackPrefix: string): GeneratedBreakdownItem[] =>
  values
    .map((value, index) => {
      const record = toRecord(value);
      const label = toText(record.label ?? record.name ?? record.title ?? record.group ?? record.dimension);
      const body = toText(
        record.summary ??
          record.description ??
          record.interpretation ??
          record.insight ??
          record.finding ??
          record.body,
      );
      if (!label && !body) return null;
      return {
        id: slugify(record.id ?? label ?? body, `${fallbackPrefix}-${index + 1}`),
        label: label || `${fallbackPrefix} ${index + 1}`,
        body,
        sourceRefs: collectSourceRefs(record.sourceRefs, record.sources, record.questionIds, record.evidenceIds),
      };
    })
    .filter(Boolean) as GeneratedBreakdownItem[];

const getBreakdownSection = (artifact: SessionResultsGeneratedAnalysisArtifact): PlainRecord =>
  toRecord(toRecord(artifact.sections).breakdown);

const renderGeneratedBreakdownSourceRefs = (sourceRefs: string[]) =>
  sourceRefs.length > 0 ? (
    <div className={styles.generatedBreakdownSourceBlock}>
      <span className={styles.generatedBreakdownSourceLabel}>Source refs</span>
      <ul className={styles.generatedBreakdownSourceList}>
        {sourceRefs.map((sourceRef) => (
          <li key={sourceRef}>{sourceRef}</li>
        ))}
      </ul>
    </div>
  ) : null;

const renderGeneratedBreakdownItems = (title: string, items: GeneratedBreakdownItem[]) =>
  items.length > 0 ? (
    <div className={styles.generatedBreakdownItemGroup}>
      <h4>{title}</h4>
      <div className={styles.generatedBreakdownCardGrid}>
        {items.map((item) => (
          <article key={item.id} className={styles.generatedBreakdownCard}>
            <h5>{item.label}</h5>
            {item.body ? <p>{item.body}</p> : null}
            {renderGeneratedBreakdownSourceRefs(item.sourceRefs)}
          </article>
        ))}
      </div>
    </div>
  ) : null;

const GeneratedBreakdownInterpretation = ({ artifact }: { artifact: SessionResultsGeneratedAnalysisArtifact }) => {
  const section = getBreakdownSection(artifact);
  const available = section.available === true;
  const reason = toText(section.reason) || 'Generated breakdown interpretation is unavailable for this artifact.';

  if (!available) {
    return (
      <section
        className={styles.generatedBreakdownInterpretation}
        data-testid="ce-session-generated-breakdown-interpretation"
      >
        <p className={styles.generatedBreakdownEyebrow}>Generated interpretation</p>
        <h3>Breakdown interpretation unavailable</h3>
        <p className={styles.generatedBreakdownCopy}>{reason}</p>
      </section>
    );
  }

  const summaryRecord = toRecord(section.summary);
  const overview = toText(
    summaryRecord.overview ?? summaryRecord.summary ?? summaryRecord.interpretation ?? summaryRecord.narrative,
  );
  const themes = buildGeneratedBreakdownItems(
    toArray(summaryRecord.themes).length > 0
      ? toArray(summaryRecord.themes)
      : toArray(summaryRecord.keyFindings ?? summaryRecord.findings),
    'Theme',
  );
  const dimensions = buildGeneratedBreakdownItems(toArray(section.dimensions), 'Dimension');
  const groups = buildGeneratedBreakdownItems(toArray(section.groups), 'Group');
  const hasContent = Boolean(overview || themes.length > 0 || dimensions.length > 0 || groups.length > 0);

  return (
    <section
      className={styles.generatedBreakdownInterpretation}
      data-testid="ce-session-generated-breakdown-interpretation"
    >
      <p className={styles.generatedBreakdownEyebrow}>Generated interpretation</p>
      <h3>Breakdown interpretation</h3>
      <p className={styles.generatedBreakdownCopy}>
        AI-generated themes and groups from the frozen session snapshot. Measured distributions render separately below
        when submitted response counts are available.
      </p>
      {overview ? <p className={styles.generatedBreakdownOverview}>{overview}</p> : null}
      {renderGeneratedBreakdownItems('Themes', themes)}
      {renderGeneratedBreakdownItems('Dimensions', dimensions)}
      {renderGeneratedBreakdownItems('Groups', groups)}
      {!hasContent ? (
        <p className={styles.generatedBreakdownCopy}>
          The generated breakdown section did not include displayable overview, themes, dimensions, or groups.
        </p>
      ) : null}
    </section>
  );
};

const UnavailableView = ({ reason }: { reason: string }) => (
  <section className={styles.unavailable} data-testid="ce-session-generated-results-unavailable">
    <h3 className={styles.unavailableTitle}>Generated view unavailable</h3>
    <p className={styles.unavailableCopy}>{reason || 'This generated artifact does not include renderable data.'}</p>
  </section>
);

const SessionGeneratedResultsViews = ({
  artifact,
  className = '',
  questions = [],
  responses = [],
  selectedView,
  sessionSlug = '',
}: SessionGeneratedResultsViewsProps): React.ReactElement => {
  const generatedAt = formatGeneratedAt(artifact?.generatedAt);
  const model = artifact?.model || '';
  const label = VIEW_LABELS[selectedView] || 'Generated View';
  const wrapperClassName = [styles.surface, className].filter(Boolean).join(' ');

  const renderSelectedView = () => {
    if (!artifact) {
      return <UnavailableView reason="No generated analysis artifact has been loaded for this session." />;
    }

    if (
      selectedView === SESSION_GENERATED_RESULTS_VIEW_KEYS.CIRCLES ||
      selectedView === SESSION_GENERATED_RESULTS_VIEW_KEYS.ATLAS
    ) {
      const { props, unavailableReason } = buildGeneratedDebateMapAdapter(artifact);
      if (!props) return <UnavailableView reason={unavailableReason} />;
      return (
        <DebateMap
          {...props}
          activeSessionSlug={sessionSlug}
          atlasLayoutMode={selectedView === SESSION_GENERATED_RESULTS_VIEW_KEYS.ATLAS ? 'orbital' : 'packed'}
          embedded={true}
        />
      );
    }

    if (selectedView === SESSION_GENERATED_RESULTS_VIEW_KEYS.BREAKDOWN) {
      const { analysisData, unavailableReason } = buildGeneratedBreakdownAnalysisData({ questions, responses });
      return (
        <div className={styles.breakdownStack}>
          <GeneratedBreakdownInterpretation artifact={artifact} />
          <DemoAnalysisWorkspace
            analysisData={analysisData}
            emptyReason={analysisData ? '' : unavailableReason}
            sessionSlug={sessionSlug}
          />
        </div>
      );
    }

    if (selectedView === SESSION_GENERATED_RESULTS_VIEW_KEYS.RISK_MATRIX) {
      const { props, unavailableReason } = buildGeneratedRiskMatrixAdapter(artifact);
      if (!props) return <UnavailableView reason={unavailableReason} />;
      return <RiskMatrix {...props} embedded={true} />;
    }

    return <UnavailableView reason="The selected generated view is not supported." />;
  };

  return (
    <section className={wrapperClassName} data-testid="ce-session-generated-results-view">
      <div className={styles.header}>
        <p className={styles.eyebrow}>AI-generated session view</p>
        <h2 className={styles.title}>{label}</h2>
        {generatedAt || model ? (
          <p className={styles.meta}>
            {[generatedAt ? `Generated ${generatedAt}` : '', model ? `Model ${model}` : ''].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </div>
      <div className={styles.viewFrame}>
        <Suspense fallback={<LazyFallback label={`Loading ${label}...`} minHeight="24rem" />}>
          {renderSelectedView()}
        </Suspense>
      </div>
    </section>
  );
};

export default SessionGeneratedResultsViews;
