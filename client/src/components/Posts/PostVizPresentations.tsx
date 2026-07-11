import React from 'react';
import {
  buildPieGradient,
  isResponseSplitPanel,
  orderedResponseSplitCounts,
  type ResponsePanelDatum,
} from './postVizResponsePanels.js';
import styles from './PostsPage.module.scss';

type PresentationPoint = {
  label: string;
  value: number;
  confidence: number;
  color: string;
};

type PresentationTooltipStyle = React.CSSProperties & {
  '--post-viz-tooltip-x'?: string;
};

type PresentationRow = {
  label: string;
  prompt: string;
  values: PresentationPoint[];
  missing: string[];
};

type PresentationCount = {
  label: string;
  value: number;
  color: string;
};

type PresentationPanel = {
  kind: string;
  title: string;
  prompt: string;
  note: string;
  display: string;
  hideTitle: boolean;
  summaryValue: number | null;
  summarySuffix: string;
  counts: PresentationCount[];
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const formatValue = (value: number, suffix = ''): string => {
  const rounded = Math.abs(value) >= 10 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded}${suffix}`;
};

const formatPreciseValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));

const renderFormattedText = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    parts.push(<strong key={`bold-${match.index}`}>{match[1]}</strong>);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
};

const formatCalcPercentWithPx = (percent: number, pxOffset: number) => {
  if (pxOffset === 0) return `${percent}%`;
  const operator = pxOffset > 0 ? '+' : '-';
  return `calc(${percent}% ${operator} ${Math.abs(pxOffset)}px)`;
};

const duplicateValueKey = (value: number) => value.toFixed(4);

const buildPointPlacements = (points: PresentationPoint[]) => {
  const valueCounts = points.reduce<Map<string, number>>((counts, point) => {
    const key = duplicateValueKey(point.value);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
  const seenCounts = new Map<string, number>();
  const defaultTops = [32, 50, 68, 40, 60];
  const duplicateOffsets = [
    { x: -14, top: 34 },
    { x: 14, top: 66 },
    { x: -14, top: 66 },
    { x: 14, top: 34 },
    { x: 0, top: 50 },
  ];

  return points.map((point, index) => {
    const key = duplicateValueKey(point.value);
    const duplicateIndex = seenCounts.get(key) || 0;
    seenCounts.set(key, duplicateIndex + 1);
    return (valueCounts.get(key) || 0) > 1
      ? duplicateOffsets[duplicateIndex % duplicateOffsets.length]
      : { x: 0, top: defaultTops[index % defaultTops.length] };
  });
};

const medianValue = (points: PresentationPoint[]): number | null => {
  if (points.length === 0) return null;
  const values = points.map((point) => point.value).sort((a, b) => a - b);
  const midpoint = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[midpoint - 1] + values[midpoint]) / 2 : values[midpoint];
};

const PresentationHeader = ({ title, subtitle, hidden }: { title: string; subtitle: string; hidden: boolean }) => {
  if (hidden && !subtitle) return null;
  return (
    <div className={styles.vizHeader}>
      {!hidden && <h3 className={styles.vizTitle}>{title}</h3>}
      {subtitle && <p className={styles.vizSubtitle}>{renderFormattedText(subtitle)}</p>}
    </div>
  );
};

export const PrecisionBeeswarmPresentation = ({
  title,
  subtitle,
  note,
  suffix,
  min,
  max,
  rows,
  hideHeader,
}: {
  title: string;
  subtitle: string;
  note: string;
  suffix: string;
  min: number;
  max: number;
  rows: PresentationRow[];
  hideHeader: boolean;
}) => {
  const ticks = [min, (min + max) / 2, max];
  const [hoverKey, setHoverKey] = React.useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = React.useState<string | null>(null);
  const tooltipId = `precision-rating-tooltip-${React.useId().replace(/:/g, '')}`;
  const clearPinnedRating = React.useCallback(() => setPinnedKey(null), []);

  React.useEffect(() => {
    if (pinnedKey === null) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearPinnedRating();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearPinnedRating, pinnedKey]);

  // Keep click-pinned confidence ahead of hover so pointer exits cannot dismiss it.
  const activeKey = pinnedKey ?? hoverKey;
  const isPinned = pinnedKey !== null;

  return (
    <section className={`${styles.vizCard} ${styles.precisionBeeswarmCard}`} aria-label={title}>
      <PresentationHeader title={title} subtitle={subtitle} hidden={hideHeader} />
      <div className={styles.precisionTable} role="table" aria-label={title}>
        <div className={styles.precisionTableHeader} role="row">
          <span role="columnheader">Question</span>
          <span className={styles.precisionScaleHeader} role="columnheader" aria-label="Response scale">
            {ticks.map((tick) => (
              <span key={tick} aria-hidden="true">
                {formatValue(tick)}
              </span>
            ))}
          </span>
          <span className={styles.precisionMedianHeader} role="columnheader">
            Median
          </span>
        </div>
        {rows.map((row, rowIndex) => {
          const placements = buildPointPlacements(row.values);
          const median = medianValue(row.values);
          return (
            <div key={row.label} className={styles.precisionTableRow} role="row">
              <div className={styles.precisionQuestion} role="rowheader">
                <span className={styles.precisionQuestionLabel}>{row.label}</span>
                <span className={styles.precisionQuestionText}>{row.prompt || row.label}</span>
              </div>
              <div className={styles.precisionScalePlot} role="cell">
                <span className={styles.precisionScaleAxis} aria-hidden="true" />
                {ticks.map((tick) => (
                  <span
                    key={`${row.label}-${tick}`}
                    className={styles.precisionScaleTick}
                    style={{ left: `${clamp(((tick - min) / (max - min)) * 100, 0, 100)}%` }}
                    aria-hidden="true"
                  />
                ))}
                {row.values.map((point, index) => {
                  const pointKey = `${rowIndex}-${index}`;
                  const left = clamp(((point.value - min) / (max - min)) * 100, 0, 100);
                  const placement = placements[index];
                  const confidenceLabel =
                    point.confidence > 0 ? `, ${formatValue(point.confidence, '%')} confidence` : '';
                  const isActive = activeKey === pointKey;
                  return (
                    <button
                      key={`${row.label}-${point.label}-${index}`}
                      type="button"
                      className={`${styles.precisionPoint} ${isActive ? styles.precisionPointActive : ''}`}
                      style={{
                        left: formatCalcPercentWithPx(left, placement.x),
                        top: `${placement.top}%`,
                        backgroundColor: point.color,
                      }}
                      aria-label={`${point.label}: ${formatValue(point.value, suffix)}${confidenceLabel}`}
                      aria-pressed={pinnedKey === pointKey}
                      aria-describedby={isActive ? tooltipId : undefined}
                      onMouseEnter={() => setHoverKey(pointKey)}
                      onMouseLeave={() => setHoverKey(null)}
                      onFocus={() => setHoverKey(pointKey)}
                      onBlur={() => setHoverKey(null)}
                      onClick={() => setPinnedKey((current) => (current === pointKey ? null : pointKey))}
                    >
                      {point.label}
                    </button>
                  );
                })}
                {row.values.map((point, index) => {
                  const pointKey = `${rowIndex}-${index}`;
                  if (activeKey !== pointKey) return null;
                  const left = clamp(((point.value - min) / (max - min)) * 100, 18, 82);
                  const placement = placements[index];
                  const renderBelow = placement.top <= 50;
                  const tooltipStyle: PresentationTooltipStyle = {
                    '--post-viz-tooltip-x': `${left}%`,
                    top: `${placement.top}%`,
                  };
                  return (
                    <div
                      key={`tooltip-${pointKey}`}
                      id={tooltipId}
                      role="tooltip"
                      className={`${styles.binaryBeeswarmTooltip} ${styles.precisionTooltip} ${renderBelow ? styles.precisionTooltipBelow : ''} ${isPinned ? styles.binaryBeeswarmTooltipPinned : ''}`}
                      style={tooltipStyle}
                    >
                      {isPinned && (
                        <button
                          type="button"
                          className={styles.binaryBeeswarmTooltipClose}
                          onClick={clearPinnedRating}
                          aria-label="Close rating details"
                          data-testid="ce-posts-rating-tooltip-close"
                        >
                          &times;
                        </button>
                      )}
                      <strong>
                        {point.label}: {formatValue(point.value, suffix)}
                      </strong>
                      <span className={styles.precisionTooltipConfidence}>
                        Confidence: {formatValue(point.confidence, '%')}
                      </span>
                    </div>
                  );
                })}
              </div>
              <span className={styles.precisionMedian} role="cell">
                {median === null ? '—' : formatValue(median, suffix)}
              </span>
              {row.missing.length > 0 && (
                <p className={styles.precisionMissing}>No completed answer: {row.missing.join(', ')}</p>
              )}
            </div>
          );
        })}
      </div>
      {note && <p className={styles.vizNote}>{renderFormattedText(note)}</p>}
    </section>
  );
};

export const EditorialResponseTypeGridPresentation = ({
  title,
  subtitle,
  panels,
  note,
  hideHeader,
}: {
  title: string;
  subtitle: string;
  panels: PresentationPanel[];
  note: string;
  hideHeader: boolean;
}) => (
  <section className={`${styles.vizCard} ${styles.responseTypeEditorialCard}`} aria-label={title}>
    <PresentationHeader title={title} subtitle={subtitle} hidden={hideHeader} />
    <div className={styles.editorialStatsGrid}>
      {panels.map((panel) => {
        const total = panel.counts.reduce((sum, count) => sum + count.value, 0);
        const maxValue = Math.max(...panel.counts.map((count) => count.value), 1);
        const displayAsPie = panel.display === 'pie';
        const displayAsRing = panel.display === 'ring';
        const pie = displayAsPie || displayAsRing ? buildPieGradient(panel.counts) : null;
        const distributionLabel = `${panel.title} distribution: ${panel.counts
          .map((count) => `${count.label} ${formatValue(count.value)}`)
          .join(', ')}`;
        const editorialLegend = (
          <div className={styles.editorialLegend}>
            {panel.counts.map((count) => (
              <div key={count.label} className={styles.editorialLegendRow}>
                <span className={styles.editorialLegendSwatch} style={{ backgroundColor: count.color }} />
                <span>{count.label}</span>
                <strong>{formatValue(count.value)}</strong>
                <span>{total > 0 ? formatValue((count.value / total) * 100, '%') : '0%'}</span>
              </div>
            ))}
          </div>
        );

        return (
          <article
            key={`${panel.kind}-${panel.title}`}
            className={styles.editorialStatsPanel}
            role="group"
            aria-label={panel.title}
          >
            {!panel.hideTitle && <h4>{panel.title}</h4>}
            {panel.prompt && <p className={styles.editorialStatsPrompt}>{panel.prompt}</p>}
            {panel.display === 'distribution' && panel.counts.length > 0 && (
              <>
                <strong className={styles.editorialStatsTotal}>{formatValue(total)} total</strong>
                <div className={styles.editorialDistribution} role="img" aria-label={distributionLabel}>
                  {panel.counts.map((count) => (
                    <span
                      key={count.label}
                      style={{
                        width: total > 0 ? `${clamp((count.value / total) * 100, 0, 100)}%` : '0%',
                        backgroundColor: count.color,
                      }}
                      title={`${count.label}: ${formatValue(count.value)}`}
                    />
                  ))}
                </div>
              </>
            )}
            {displayAsPie && pie && panel.counts.length > 0 && (
              <div className={styles.responsePie}>
                <div
                  className={`${styles.responsePieChart} ${styles.editorialChartCircle}`}
                  role="img"
                  aria-label={`${panel.title}: ${panel.counts
                    .map((count) => `${count.label} ${formatValue(count.value)}`)
                    .join(', ')}`}
                  style={{ background: pie.gradient }}
                >
                  <span className={styles.responsePieTotal} aria-hidden="true">
                    {formatValue(pie.total)} total
                  </span>
                </div>
                <div className={styles.responsePieLegend}>
                  {panel.counts.map((count) => (
                    <div key={count.label} className={styles.responsePieLegendItem}>
                      <span className={styles.responsePieSwatch} style={{ backgroundColor: count.color }} />
                      <span>{count.label}</span>
                      <span className={styles.responsePieLegendValue}>
                        <strong>{formatValue(count.value)}</strong>
                        <span>{total > 0 ? formatValue((count.value / total) * 100, '%') : '0%'}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {displayAsRing && pie && panel.counts.length > 0 && (
              <div className={styles.editorialRingLayout}>
                <div
                  className={`${styles.editorialRing} ${styles.editorialChartCircle}`}
                  role="img"
                  aria-label={distributionLabel}
                  style={{ background: pie.gradient }}
                >
                  <span aria-hidden="true">{formatValue(pie.total)} total</span>
                </div>
                {editorialLegend}
              </div>
            )}
            {panel.summaryValue !== null && (
              <div className={styles.editorialSummaryValue}>
                <strong>{formatPreciseValue(panel.summaryValue)}</strong>
                {panel.summarySuffix && <span>{panel.summarySuffix}</span>}
              </div>
            )}
            {panel.display !== 'ring' && panel.display !== 'pie' && panel.display !== 'distribution' && (
              <div className={styles.editorialBars}>
                {panel.counts.map((count) => (
                  <div key={count.label} className={styles.editorialBarRow}>
                    <div className={styles.editorialBarMeta}>
                      <span>{count.label}</span>
                      <strong>{formatValue(count.value)}</strong>
                    </div>
                    <div
                      className={styles.editorialBarTrack}
                      aria-label={`${count.label}: ${formatValue(count.value)}`}
                    >
                      <span
                        style={{
                          width: count.value > 0 ? `${clamp((count.value / maxValue) * 100, 3, 100)}%` : '0%',
                          backgroundColor: count.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {panel.display === 'distribution' && editorialLegend}
            {panel.note && <p className={styles.responseTypeNote}>{renderFormattedText(panel.note)}</p>}
          </article>
        );
      })}
    </div>
    {note && <p className={styles.vizNote}>{renderFormattedText(note)}</p>}
  </section>
);

export const ResponseTypeGridPresentation = ({
  title,
  subtitle,
  panels,
  note,
  hideHeader,
  precision,
}: {
  title: string;
  subtitle: string;
  panels: ResponsePanelDatum[];
  note: string;
  hideHeader: boolean;
  precision: boolean;
}) => (
  <section
    className={`${styles.vizCard} ${styles.responseTypeCard} ${precision ? styles.responseTypePrecisionCard : ''}`}
    aria-label={title}
  >
    <PresentationHeader title={title} subtitle={subtitle} hidden={hideHeader} />
    <div className={`${styles.responseTypeGrid} ${precision ? styles.responseTypePrecisionGrid : ''}`}>
      {panels.map((panel) => {
        const isMultiSelect = panel.kind.toLowerCase() === 'multi-select';
        const maxValue = Math.max(...panel.counts.map((count) => count.value), 1);
        const orderedCounts =
          isMultiSelect
            ? [...panel.counts].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
            : panel.counts;
        const displayAsNumbers = panel.display === 'numbers' || panel.display === 'metrics';
        const displayAsPie = panel.display === 'pie';
        const displayAsSplit = !displayAsNumbers && !displayAsPie && isResponseSplitPanel(panel);
        const pie = displayAsPie ? buildPieGradient(panel.counts) : null;
        const splitCounts = displayAsSplit ? orderedResponseSplitCounts(panel.counts) : [];
        const splitTotal = splitCounts.reduce((sum, count) => sum + count.value, 0);
        const visibleTitle = displayAsSplit && panel.prompt ? panel.prompt : panel.title;
        const visiblePrompt = displayAsSplit && panel.prompt ? '' : panel.prompt;
        return (
          <article
            key={`${panel.kind}-${panel.title}`}
            className={`${styles.responseTypePanel} ${
              isMultiSelect ? styles.responseTypeMultiSelectPanel : ''
            } ${precision ? styles.responseTypePrecisionPanel : ''}`}
            role="group"
            aria-label={panel.title}
          >
            {!panel.hideTitle && <h4>{visibleTitle}</h4>}
            {visiblePrompt && <p className={styles.responseTypePrompt}>{visiblePrompt}</p>}
            {panel.counts.length > 0 && displayAsNumbers && (
              <div className={styles.responseMetrics}>
                {panel.counts.map((count) => (
                  <div key={count.label} className={styles.responseMetricRow}>
                    <span>{count.label}</span>
                    <strong style={{ color: count.color }}>{formatValue(count.value)}</strong>
                  </div>
                ))}
              </div>
            )}
            {panel.counts.length > 0 && displayAsPie && pie && (
              <div className={styles.responsePie}>
                <div
                  className={styles.responsePieChart}
                  role="img"
                  aria-label={`${panel.title}: ${panel.counts.map((count) => `${count.label} ${formatValue(count.value)}`).join(', ')}`}
                  style={{ background: pie.gradient }}
                >
                  <span className={styles.responsePieTotal} aria-hidden="true">
                    {formatValue(pie.total)} total
                  </span>
                </div>
                <div className={styles.responsePieLegend}>
                  {panel.counts.map((count) => (
                    <div key={count.label} className={styles.responsePieLegendItem}>
                      <span className={styles.responsePieSwatch} style={{ backgroundColor: count.color }} />
                      <span>{count.label}</span>
                      <span className={styles.responsePieLegendValue}>
                        <strong>{formatValue(count.value)}</strong>
                        <span>{formatValue((count.value / pie.total) * 100, '%')}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {panel.counts.length > 0 && displayAsSplit && (
              <div className={styles.responseSplit}>
                <div className={styles.responseSplitLegend}>
                  {splitCounts.map((count) => (
                    <span key={count.label} className={styles.responseSplitLegendItem}>
                      <span className={styles.responseSplitSwatch} style={{ backgroundColor: count.color }} />
                      <span>{count.label}</span>
                      <strong>{formatValue(count.value)}</strong>
                    </span>
                  ))}
                </div>
                <div
                  className={styles.responseSplitBar}
                  role="img"
                  aria-label={`${visibleTitle}: ${splitCounts.map((count) => `${count.label} ${formatValue(count.value)}`).join(', ')}`}
                >
                  {splitCounts.map((count) => (
                    <span
                      key={count.label}
                      className={styles.responseSplitSegment}
                      style={{
                        width: splitTotal > 0 ? `${clamp((count.value / splitTotal) * 100, 0, 100)}%` : '0%',
                        backgroundColor: count.color,
                      }}
                      title={`${count.label}: ${formatValue(count.value)}`}
                    />
                  ))}
                </div>
              </div>
            )}
            {panel.counts.length > 0 && !displayAsNumbers && !displayAsPie && !displayAsSplit && (
              <div className={styles.responseBars}>
                {orderedCounts.map((count) => (
                  <div key={count.label} className={styles.responseBarRow}>
                    <div className={styles.responseBarMeta}>
                      <span>{count.label}</span>
                      <span>{formatValue(count.value)}</span>
                    </div>
                    <div className={styles.responseBarTrack} aria-label={`${count.label}: ${formatValue(count.value)}`}>
                      <span
                        className={styles.responseBarFill}
                        style={{
                          width: count.value > 0 ? `${clamp((count.value / maxValue) * 100, 6, 100)}%` : '0%',
                          backgroundColor: count.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {panel.quotes.length > 0 && (
              <div className={styles.responseQuotes}>
                {panel.quotes.map((quote, index) => (
                  <figure key={`${quote.label || 'quote'}-${index}`}>
                    <blockquote>{quote.text}</blockquote>
                    {quote.label && (
                      <figcaption style={quote.color ? { color: quote.color } : undefined}>{quote.label}</figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}
            {panel.note && <p className={styles.responseTypeNote}>{renderFormattedText(panel.note)}</p>}
          </article>
        );
      })}
    </div>
    {note && <p className={styles.vizNote}>{renderFormattedText(note)}</p>}
  </section>
);
