import React, { useMemo } from 'react';
import styles from './DemoAnalysisWorkspace.module.scss';

const BAR_COLORS = Object.freeze({
  Agree: 'linear-gradient(90deg, #1d7f57 0%, #4dffa4 100%)',
  Unsure: 'linear-gradient(90deg, #8b6f1a 0%, #ffd166 100%)',
  Disagree: 'linear-gradient(90deg, #8e2e3b 0%, #ff6b6b 100%)',
});

const QuestionBreakdownChart = ({
  question,
  flatResponses = [],
  comparisonGroups = [],
  onOpenDrilldown,
}) => {
  const datasets = useMemo(() => {
    if (!question) return [];
    const segmentKeys = ['All', ...(comparisonGroups || []).map((group) => group.segmentKey)];
    return segmentKeys.map((segmentKey) => {
      const label = segmentKey === 'All'
        ? 'Overall'
        : (comparisonGroups.find((group) => group.segmentKey === segmentKey)?.name || segmentKey);
      const rows = flatResponses.filter((row) => row.questionId === question.id && row.segmentKey === segmentKey);
      return {
        label,
        segmentKey,
        rows: question.options.map((responseText) => (
          rows.find((row) => row.responseText === responseText) || {
            responseText,
            rate: 0,
            totalVotes: 0,
          }
        )),
      };
    });
  }, [comparisonGroups, flatResponses, question]);

  if (!question) {
    return (
      <section className={`${styles.panel} ${styles.chartPanel}`}>
        <h3 className={styles.panelTitle}>Question Breakdown</h3>
        <p className={styles.emptyHint}>Select a question to inspect its response breakdown.</p>
      </section>
    );
  }

  return (
    <section className={`${styles.panel} ${styles.chartPanel}`} data-testid="demo-analysis-question-breakdown">
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>Question Breakdown</h3>
          <p className={styles.panelMeta} data-testid="demo-analysis-selected-question">{question.text}</p>
        </div>
        <button type="button" className={styles.clearButton} onClick={() => onOpenDrilldown(question.id)}>
          Details
        </button>
      </div>

      <div className={styles.breakdownList}>
        {datasets.map((dataset) => (
          <div key={dataset.segmentKey} className={styles.breakdownDataset}>
            <div className={styles.breakdownDatasetHeader}>
              <span className={styles.breakdownDatasetTitle}>{dataset.label}</span>
              <span className={styles.breakdownDatasetMeta}>
                {dataset.rows[0]?.totalVotes || 0} voters
              </span>
            </div>
            <div className={styles.breakdownBars}>
              {dataset.rows.map((row) => (
                <div key={`${dataset.segmentKey}-${row.responseText}`} className={styles.breakdownBarRow}>
                  <span className={styles.breakdownBarLabel}>{row.responseText}</span>
                  <div className={styles.breakdownBarTrack}>
                    <div
                      className={styles.breakdownBarFill}
                      style={{
                        width: `${Math.max(0, Math.min(100, Number(row.rate || 0) * 100))}%`,
                        background: BAR_COLORS[row.responseText] || BAR_COLORS.Unsure,
                      }}
                    />
                  </div>
                  <span className={styles.breakdownBarValue}>{(Number(row.rate || 0) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default QuestionBreakdownChart;
