import React from 'react';
import styles from './DemoAnalysisWorkspace.module.scss';

type HeatmapData = {
  title: string;
  rowLabels: string[];
  columnLabels: string[];
  pivotData?: Array<Array<number | null | undefined>>;
};

type IndicatorHeatmapProps = {
  data?: HeatmapData | null;
};

const getCellColor = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'rgba(255,255,255,0.04)';
  const alpha = Math.max(0.12, Math.min(0.88, Number(value || 0)));
  return `rgba(91, 140, 255, ${alpha})`;
};

const IndicatorHeatmap = ({ data }: IndicatorHeatmapProps) => {
  if (!data || !Array.isArray(data.rowLabels) || data.rowLabels.length === 0) {
    return (
      <section className={`${styles.panel} ${styles.heatmapPanel}`}>
        <h3 className={styles.panelTitle}>Indicator Heatmap</h3>
        <p className={styles.emptyHint}>No topic heatmap data is available for the current selection.</p>
      </section>
    );
  }

  return (
    <section className={`${styles.panel} ${styles.heatmapPanel}`} data-testid="demo-analysis-heatmap">
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>Indicator Heatmap</h3>
          <p className={styles.panelMeta}>{data.title}</p>
        </div>
      </div>
      <div className={styles.heatmapLegend}>
        <div className={styles.legendRow}>
          <span className={styles.legendTitle}>Heatmap displays data for:</span>
          <span className={styles.legendPill}>{data.title.replace(/ Topic Heatmap$/, '')}</span>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Topic</th>
              {data.columnLabels.map((columnLabel) => (
                <th key={columnLabel}>{columnLabel}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rowLabels.map((rowLabel, rowIndex) => (
              <tr key={rowLabel}>
                <td className={styles.tableRowLabel}>{rowLabel}</td>
                {data.columnLabels.map((columnLabel, columnIndex) => {
                  const value = data.pivotData?.[rowIndex]?.[columnIndex] ?? null;
                  return (
                    <td
                      key={`${rowLabel}-${columnLabel}`}
                      style={{ backgroundColor: getCellColor(value) }}
                      className={styles.heatmapCell}
                    >
                      {value === null ? '-' : `${(Number(value || 0) * 100).toFixed(0)}%`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default IndicatorHeatmap;
