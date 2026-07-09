import React, { useMemo } from 'react';
import styles from './DemoAnalysisWorkspace.module.scss';

const RESPONSE_ORDER = ['Agree', 'Unsure', 'Disagree'] as const;

type Question = {
  id: string | number;
  text: string;
  options: string[];
};

type FlatResponse = {
  questionId: string | number;
  segmentKey: string;
  responseText: string;
  rate?: number;
  totalVotes?: number;
  participantCount?: number;
};

type ComparisonGroup = {
  segmentKey: string;
  name?: string;
};

type QuestionBreakdownChartProps = {
  question?: Question | null;
  flatResponses?: FlatResponse[];
  comparisonGroups?: ComparisonGroup[];
};

const formatCountLabel = (count = 0, singular = '', plural = '') => {
  const normalizedCount = Number(count || 0);
  return `${normalizedCount} ${normalizedCount === 1 ? singular : plural}`;
};

const formatDatasetMeta = (rows: FlatResponse[] = []) => {
  const modeledResponseCount = rows.reduce((max, row) => Math.max(max, Number(row?.totalVotes || 0)), 0);
  const participantCount = rows.reduce(
    (max, row) => Math.max(max, Number(row?.participantCount || 0)),
    modeledResponseCount,
  );
  const responseCount = modeledResponseCount || participantCount;

  if (modeledResponseCount > 0) {
    return formatCountLabel(responseCount, 'modeled response', 'modeled responses');
  }

  return formatCountLabel(responseCount, 'response', 'responses');
};

const getResponseToneClassName = (responseText = '') => {
  if (responseText === 'Agree') return styles.breakdownCandleSegmentAgree;
  if (responseText === 'Disagree') return styles.breakdownCandleSegmentDisagree;
  return styles.breakdownCandleSegmentUnsure;
};

const getOrderedOptions = (options: string[] = []) => {
  const optionSet = new Set(options);
  return [
    ...RESPONSE_ORDER.filter((responseText) => optionSet.has(responseText)),
    ...options.filter((responseText) => !RESPONSE_ORDER.includes(responseText as (typeof RESPONSE_ORDER)[number])),
  ];
};

const QuestionBreakdownChart = ({
  question,
  flatResponses = [],
  comparisonGroups = [],
}: QuestionBreakdownChartProps) => {
  const datasets = useMemo(() => {
    if (!question) return [];
    const segmentKeys = ['All', ...(comparisonGroups || []).map((group) => group.segmentKey)];
    return segmentKeys.map((segmentKey) => {
      const label =
        segmentKey === 'All'
          ? 'Overall'
          : comparisonGroups.find((group) => group.segmentKey === segmentKey)?.name || segmentKey;
      const rows = flatResponses.filter((row) => row.questionId === question.id && row.segmentKey === segmentKey);
      return {
        label,
        segmentKey,
        rows: getOrderedOptions(question.options).map(
          (responseText) =>
            rows.find((row) => row.responseText === responseText) || {
              questionId: question.id,
              segmentKey,
              responseText,
              rate: 0,
              totalVotes: 0,
            },
        ),
      };
    });
  }, [comparisonGroups, flatResponses, question]);

  if (!question) {
    return (
      <section className={`${styles.panel} ${styles.chartPanel}`} data-testid="demo-analysis-question-breakdown">
        <h3 className={styles.panelTitle}>Question Breakdown</h3>
        <p className={styles.emptyHint}>Select a question to inspect its response breakdown.</p>
      </section>
    );
  }

  return (
    <section className={`${styles.panel} ${styles.chartPanel}`} data-testid="demo-analysis-question-breakdown">
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>Question Breakdown</h3>
      </div>

      <div className={styles.breakdownList}>
        {datasets.map((dataset) => (
          <div key={dataset.segmentKey} className={styles.breakdownDataset}>
            <div className={styles.breakdownDatasetHeader}>
              <span className={styles.breakdownDatasetTitle}>{dataset.label}</span>
              <span className={styles.breakdownDatasetMeta}>{formatDatasetMeta(dataset.rows)}</span>
            </div>
            <div
              className={styles.breakdownCandlestick}
              data-testid={`demo-analysis-breakdown-candlestick-${dataset.segmentKey}`}
              aria-label={`${dataset.label} response distribution: ${dataset.rows.map((row) => `${row.responseText} ${(Number(row.rate || 0) * 100).toFixed(0)}%`).join(', ')}.`}
            >
              {dataset.rows.map((row) => (
                <span
                  key={`${dataset.segmentKey}-${row.responseText}`}
                  className={`${styles.breakdownCandleSegment} ${getResponseToneClassName(row.responseText)}`}
                  data-testid={`demo-analysis-breakdown-segment-${dataset.segmentKey}-${row.responseText}`}
                  style={{
                    width: `${Math.max(0, Math.min(100, Number(row.rate || 0) * 100))}%`,
                  }}
                  title={`${row.responseText}: ${(Number(row.rate || 0) * 100).toFixed(0)}%`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default QuestionBreakdownChart;
