import React from 'react';

import styles from './CorpusViewer.module.scss';
import { DebateMapSection, ExternalSourceLink } from './TweetCard.jsx';

const CHART_WIDTH = 320;
const CHART_HEIGHT = 100;
const CHART_PADDING_X = 12;
const CHART_PADDING_Y = 10;

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

const buildMeta = (entry = {}) => {
  const bits = [];
  const authorText = formatAuthors(entry);
  const year = getEntryYear(entry);

  if (authorText) bits.push(authorText);
  if (year) bits.push(year);
  if (entry.venue) bits.push(entry.venue);
  if (entry.category) bits.push(entry.category);

  return bits;
};

const formatValue = (value, unit = '') => {
  const numericValue = Number(value);
  const normalizedValue = Number.isFinite(numericValue) ? numericValue : value;
  const displayValue = Number.isFinite(normalizedValue)
    ? `${Number.isInteger(normalizedValue) ? normalizedValue : normalizedValue.toFixed(1).replace(/\.0$/, '')}`
    : String(normalizedValue || '');

  return unit ? `${displayValue} ${unit}`.trim() : displayValue;
};

const buildTooltip = (label, value, unit) => `${label}: ${formatValue(value, unit)}`;

const normalizeChartData = (chartData = {}) => {
  const type = chartData?.type;
  const labels = Array.isArray(chartData?.labels) ? chartData.labels : [];
  const values = Array.isArray(chartData?.values) ? chartData.values : [];

  if (!['bar', 'line'].includes(type) || labels.length === 0 || labels.length !== values.length) {
    return null;
  }

  return {
    type,
    labels,
    title: chartData.title || 'Metric snapshot',
    unit: chartData.unit || '',
    values: values.map((value) => Number(value) || 0),
  };
};

const buildLineGeometry = (values = []) => {
  if (values.length === 0) return null;

  const maxValue = Math.max(...values, 1);
  const usableWidth = CHART_WIDTH - (CHART_PADDING_X * 2);
  const usableHeight = CHART_HEIGHT - (CHART_PADDING_Y * 2);
  const baselineY = CHART_HEIGHT - CHART_PADDING_Y;

  const points = values.map((value, index) => {
    const x = values.length === 1
      ? CHART_WIDTH / 2
      : CHART_PADDING_X + ((usableWidth * index) / (values.length - 1));
    const y = baselineY - ((value / maxValue) * usableHeight);

    return {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    };
  });

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = [
    `M ${firstPoint.x} ${baselineY}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${lastPoint.x} ${baselineY}`,
    'Z',
  ].join(' ');

  return { areaPath, baselineY, linePoints, points };
};

const ChartBlock = ({ chartData }) => {
  const normalizedChartData = normalizeChartData(chartData);

  if (!normalizedChartData) return null;

  const {
    labels,
    title,
    type,
    unit,
    values,
  } = normalizedChartData;
  const maxValue = Math.max(...values, 1);

  if (type === 'bar') {
    return (
      <div className={styles.chartBlock}>
        <div className={styles.chartContainer}>
          <div className={styles.chartTitle}>{title}</div>
          <div className={styles.barChart}>
            {values.map((value, index) => {
              const tooltip = buildTooltip(labels[index], value, unit);
              const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;

              return (
                <div key={`${labels[index]}-${index}`} className={styles.chartSlot}>
                  <div
                    className={styles.bar}
                    style={{ height: `${Math.max(heightPercent, value > 0 ? 6 : 0)}%` }}
                    title={tooltip}
                    tabIndex={0}
                    role="img"
                    aria-label={tooltip}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className={styles.chartLabels}>
          {labels.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className={styles.barLabel}
              title={buildTooltip(label, values[index], unit)}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const lineGeometry = buildLineGeometry(values);

  if (!lineGeometry) return null;

  return (
    <div className={styles.chartBlock}>
      <div className={styles.chartContainer}>
        <div className={styles.chartTitle}>{title}</div>
        <div className={styles.lineChart}>
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label={title}
            preserveAspectRatio="none"
          >
            <line
              x1={CHART_PADDING_X}
              y1={lineGeometry.baselineY}
              x2={CHART_WIDTH - CHART_PADDING_X}
              y2={lineGeometry.baselineY}
              stroke="rgba(244, 247, 255, 0.18)"
              strokeWidth="1"
            />
            <path className={styles.linePath} d={lineGeometry.areaPath} style={{ stroke: 'none' }} />
            <polyline className={styles.linePath} points={lineGeometry.linePoints} style={{ fill: 'none' }} />
            {lineGeometry.points.map((point, index) => {
              const tooltip = buildTooltip(labels[index], values[index], unit);

              return (
                <circle
                  key={`${labels[index]}-${index}`}
                  className={styles.linePoint}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  tabIndex={0}
                  role="img"
                  aria-label={tooltip}
                >
                  <title>{tooltip}</title>
                </circle>
              );
            })}
          </svg>
        </div>
      </div>
      <div className={styles.chartLabels}>
        {labels.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className={styles.barLabel}
            title={buildTooltip(label, values[index], unit)}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

const MetrChart = ({ entry, onTagClick }) => {
  const meta = buildMeta(entry);
  const summaryText = entry?.summary || '';
  const tags = Array.isArray(entry?.tags) ? entry.tags : [];

  return (
    <article className={`${styles.card} ${styles.metrCard}`}>
      <div className={styles.entryHeader}>
        <div className={styles.entryHeaderContent}>
          <div className={styles.entryTitle}>
            {entry?.title || entry?.id || 'Untitled entry'}
          </div>
          {meta.length > 0 ? (
            <div className={styles.entryMeta}>
              {meta.join(' • ')}
            </div>
          ) : null}
        </div>
      </div>

      <ChartBlock chartData={entry?.chart_data} />

      <div className={`${styles.entrySummary} ${styles.clamp3}`}>
        {summaryText}
      </div>

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

      <DebateMapSection entry={entry} />

      {entry?.url ? (
        <div className={styles.entrySourceRow}>
          <ExternalSourceLink entry={entry} />
        </div>
      ) : null}
    </article>
  );
};

export default MetrChart;
