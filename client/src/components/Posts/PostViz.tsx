import React from 'react';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  EditorialResponseTypeGridPresentation,
  PrecisionBeeswarmPresentation,
  ResponseTypeGridPresentation,
} from './PostVizPresentations.js';
import { CategoryDotsViz, QuoteWallViz, RankedThemesViz, ThemeNetworkViz } from './PostVizQualitative.js';
import {
  formatBinaryCountsLabel,
  orderedResponseSplitCounts,
  readResponsePanels,
  resolveResponseCountColor,
  type ResponseCountDatum,
} from './postVizResponsePanels.js';
import styles from './PostsPage.module.scss';

type VizRecord = Record<string, unknown>;
type TooltipPositionStyle = React.CSSProperties & {
  '--post-viz-tooltip-x'?: string;
};

const PALETTE = ['#4dffa4', '#7aa7ff', '#ffb347', '#ff6bcb', '#d8f36a', '#9ee7ff'];
const BINARY_DOT_COLOR = '#9ee7ff';
const BINARY_AXIS_COLOR = '#7aa7ff';

const asRecord = (value: unknown): VizRecord | null =>
  !!value && typeof value === 'object' && !Array.isArray(value) ? (value as VizRecord) : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const toText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: unknown): boolean => value === true || value === 'true';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const useEscapeToClear = (active: boolean, onClear: () => void) => {
  React.useEffect(() => {
    if (!active) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClear();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, onClear]);
};

const toSafeColor = (value: unknown, fallback: string): string => {
  const color = toText(value);
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
};

const formatValue = (value: number, suffix = ''): string => {
  const rounded = Math.abs(value) >= 10 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded}${suffix}`;
};

const renderFormattedText = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }
    parts.push(<strong key={`bold-${match.index}`}>{match[1]}</strong>);
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
};

const VizHeader = ({ title, subtitle, hidden = false }: { title: string; subtitle?: string; hidden?: boolean }) => {
  if (hidden && !subtitle) return null;

  return (
    <div className={styles.vizHeader}>
      {!hidden && <h3 className={styles.vizTitle}>{title}</h3>}
      {subtitle && <p className={styles.vizSubtitle}>{renderFormattedText(subtitle)}</p>}
    </div>
  );
};

type VizBodyProps = {
  spec: VizRecord;
  hideHeader?: boolean;
};

type BeeswarmPointDatum = {
  label: string;
  value: number;
  confidence: number;
  detail: string;
  color: string;
};

type BeeswarmRowDatum = {
  label: string;
  prompt: string;
  values: BeeswarmPointDatum[];
  missing: string[];
};

const readBeeswarmRows = (spec: VizRecord): BeeswarmRowDatum[] =>
  asArray(spec.items || spec.questions)
    .map((entry, rowIndex): BeeswarmRowDatum | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const label = toText(record.label || record.title);
      if (!label) return null;
      const values = asArray(record.values || record.points)
        .map((point, pointIndex): BeeswarmPointDatum | null => {
          const pointRecord = asRecord(point);
          if (!pointRecord) return null;
          const rawValue = typeof pointRecord.value === 'number' ? pointRecord.value : Number(pointRecord.value);
          if (!Number.isFinite(rawValue)) return null;
          const pointLabel = toText(pointRecord.label || pointRecord.participant) || `P${pointIndex + 1}`;
          return {
            label: pointLabel,
            value: rawValue,
            confidence: clamp(toNumber(pointRecord.confidence, 0), 0, 100),
            detail: toText(pointRecord.detail),
            color: toSafeColor(pointRecord.color, PALETTE[(rowIndex + pointIndex) % PALETTE.length]),
          };
        })
        .filter((point): point is BeeswarmPointDatum => !!point);
      return {
        label,
        prompt: toText(record.prompt || record.detail),
        values,
        missing: asArray(record.missing).map(toText).filter(Boolean),
      };
    })
    .filter((entry): entry is BeeswarmRowDatum => !!entry);

const duplicateValueKey = (value: number) => value.toFixed(4);

const defaultBeeswarmTops = [32, 50, 68, 40, 60];
// Carousel scroll tracks clip at their padding box, so top-edge pins flip below
// their dot instead of escaping the visible slide.
const SWARM_TOOLTIP_FLIP_TOP_PERCENT = 40;

const duplicateBeeswarmOffsets = [
  { x: -14, top: 34 },
  { x: 14, top: 66 },
  { x: -14, top: 66 },
  { x: 14, top: 34 },
  { x: 0, top: 50 },
];

const buildBeeswarmPlacements = (points: BeeswarmPointDatum[]) => {
  const valueCounts = points.reduce<Map<string, number>>((counts, point) => {
    const key = duplicateValueKey(point.value);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
  const seenCounts = new Map<string, number>();

  return points.map((point, index) => {
    const key = duplicateValueKey(point.value);
    const totalWithValue = valueCounts.get(key) || 0;
    const duplicateIndex = seenCounts.get(key) || 0;
    seenCounts.set(key, duplicateIndex + 1);

    if (totalWithValue <= 1) {
      return {
        x: 0,
        top: defaultBeeswarmTops[index % defaultBeeswarmTops.length],
      };
    }

    const offset = duplicateBeeswarmOffsets[duplicateIndex % duplicateBeeswarmOffsets.length];
    return offset;
  });
};

const formatCalcPercentWithPx = (percent: number, pxOffset: number) => {
  if (pxOffset === 0) return `${percent}%`;
  const operator = pxOffset > 0 ? '+' : '-';
  return `calc(${percent}% ${operator} ${Math.abs(pxOffset)}px)`;
};

const DefaultBeeswarmViz = ({ spec, hideHeader = false }: VizBodyProps) => {
  const title = toText(spec.title) || 'Rating responses';
  const subtitle = toText(spec.subtitle);
  const note = toText(spec.note);
  const suffix = toText(spec.valueSuffix);
  const min = toNumber(spec.min, 0);
  const max = Math.max(min + 1, toNumber(spec.max, 10));
  const rows = readBeeswarmRows(spec);
  const ticks = [min, (min + max) / 2, max];
  const [hoverKey, setHoverKey] = React.useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = React.useState<string | null>(null);
  const tooltipId = `rating-beeswarm-tooltip-${React.useId().replace(/:/g, '')}`;
  const clearPin = React.useCallback(() => setPinnedKey(null), []);
  useEscapeToClear(pinnedKey !== null, clearPin);
  const activeKey = pinnedKey ?? hoverKey;
  const isPinned = pinnedKey !== null;

  if (rows.length === 0) {
    return <p className={styles.vizFallback}>Visualization has no beeswarm rows.</p>;
  }

  return (
    <section className={`${styles.vizCard} ${styles.beeswarmCard}`} aria-label={title}>
      <VizHeader title={title} subtitle={subtitle} hidden={hideHeader} />
      <div className={styles.beeswarmViz}>
        {rows.map((row, rowIndex) => {
          const placements = buildBeeswarmPlacements(row.values);
          return (
            <div key={row.label} className={styles.beeswarmRow}>
              <div className={styles.beeswarmRowMeta}>
                <h4>{row.label}</h4>
                {row.prompt && <p>{row.prompt}</p>}
              </div>
              <div className={styles.beeswarmPlot}>
                <span className={styles.beeswarmAxis} />
                {ticks.map((tick) => (
                  <span
                    key={`${row.label}-${tick}`}
                    className={styles.beeswarmTick}
                    style={{ left: `${clamp(((tick - min) / (max - min)) * 100, 0, 100)}%` }}
                  >
                    {formatValue(tick, suffix)}
                  </span>
                ))}
                {row.values.map((point, index) => {
                  const pointKey = `${rowIndex}-${index}`;
                  const left = clamp(((point.value - min) / (max - min)) * 100, 0, 100);
                  const placement = placements[index];
                  const confidenceLabel =
                    point.confidence > 0 ? `, ${formatValue(point.confidence, '%')} confidence` : '';
                  const isActive = activeKey === pointKey;
                  const ringWidth = 1 + (point.confidence / 100) * 3;
                  const ringOpacity = 0.12 + (point.confidence / 100) * 0.36;
                  return (
                    <button
                      key={`${row.label}-${point.label}-${index}`}
                      type="button"
                      className={`${styles.beeswarmDot} ${isActive ? styles.beeswarmDotActive : ''}`}
                      style={{
                        left: formatCalcPercentWithPx(left, placement.x),
                        top: `${placement.top}%`,
                        backgroundColor: point.color,
                        opacity: 0.62 + (point.confidence / 100) * 0.34,
                        boxShadow: `0 7px 20px rgba(0, 0, 0, 0.32), 0 0 0 ${ringWidth}px rgba(255, 255, 255, ${ringOpacity})`,
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
                  const renderBelow = placement.top <= SWARM_TOOLTIP_FLIP_TOP_PERCENT;
                  const tooltipStyle: TooltipPositionStyle = {
                    '--post-viz-tooltip-x': `${left}%`,
                    top: `${placement.top}%`,
                  };
                  return (
                    <div
                      key={`tooltip-${pointKey}`}
                      id={tooltipId}
                      role="tooltip"
                      className={`${styles.binaryBeeswarmTooltip} ${styles.beeswarmTooltip} ${renderBelow ? styles.beeswarmTooltipBelow : ''} ${isPinned ? styles.binaryBeeswarmTooltipPinned : ''}`}
                      style={tooltipStyle}
                    >
                      {isPinned && (
                        <button
                          type="button"
                          className={styles.binaryBeeswarmTooltipClose}
                          onClick={clearPin}
                          aria-label="Close rating details"
                          data-testid="ce-posts-rating-tooltip-close"
                        >
                          &times;
                        </button>
                      )}
                      <strong>
                        {point.label}: {formatValue(point.value, suffix)}
                      </strong>
                      {point.confidence > 0 && <span>Confidence: {formatValue(point.confidence)}/100</span>}
                      {point.detail && <p>{point.detail}</p>}
                    </div>
                  );
                })}
              </div>
              {row.missing.length > 0 && (
                <p className={styles.beeswarmMissing}>No completed answer: {row.missing.join(', ')}</p>
              )}
            </div>
          );
        })}
      </div>
      {note && <p className={styles.vizNote}>{renderFormattedText(note)}</p>}
    </section>
  );
};

const BeeswarmViz = (props: VizBodyProps) => {
  if (toText(props.spec.presentation).toLowerCase() !== 'precision') {
    return <DefaultBeeswarmViz {...props} />;
  }

  const title = toText(props.spec.title) || 'Rating responses';
  const min = toNumber(props.spec.min, 0);
  const max = Math.max(min + 1, toNumber(props.spec.max, 10));
  const rows = readBeeswarmRows(props.spec);

  if (rows.length === 0) {
    return <p className={styles.vizFallback}>Visualization has no beeswarm rows.</p>;
  }

  return (
    <PrecisionBeeswarmPresentation
      title={title}
      subtitle={toText(props.spec.subtitle)}
      note={toText(props.spec.note)}
      suffix={toText(props.spec.valueSuffix)}
      min={min}
      max={max}
      rows={rows}
      hideHeader={props.hideHeader ?? false}
    />
  );
};

type BinaryBeeswarmQuestionDatum = {
  label: string;
  prompt: string;
  counts: ResponseCountDatum[];
  total: number;
  averageConfidence: number;
  difference: number;
};

const readBinaryBeeswarmItems = (spec: VizRecord): BinaryBeeswarmQuestionDatum[] =>
  asArray(spec.items || spec.questions)
    .map((entry, itemIndex): BinaryBeeswarmQuestionDatum | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const label = toText(record.label || record.title);
      if (!label) return null;
      const counts = orderedResponseSplitCounts(
        asArray(record.counts || record.choices || record.options)
          .map((count, countIndex): ResponseCountDatum | null => {
            const countRecord = asRecord(count);
            if (!countRecord) return null;
            const countLabel = toText(countRecord.label);
            if (!countLabel) return null;
            return {
              label: countLabel,
              value: Math.max(0, toNumber(countRecord.value)),
              color: resolveResponseCountColor(
                countLabel,
                countRecord.color,
                PALETTE[(itemIndex + countIndex) % PALETTE.length],
              ),
            };
          })
          .filter((count): count is ResponseCountDatum => !!count),
      );
      const total = counts.reduce((sum, count) => sum + count.value, 0);
      if (total <= 0) return null;
      const maxCount = Math.max(...counts.map((count) => count.value));
      return {
        label,
        prompt: toText(record.prompt || record.detail),
        counts,
        total,
        averageConfidence: clamp(toNumber(record.averageConfidence || record.confidence, 0), 0, 100),
        difference: clamp((total - maxCount) / total, 0, 0.5),
      };
    })
    .filter((entry): entry is BinaryBeeswarmQuestionDatum => !!entry);

type BinaryBeeswarmPlacement = {
  x: number;
  y: number;
};

type BinaryConfidenceScale = {
  min: number;
  max: number;
  ticks: number[];
};

const BINARY_SWARM_WIDTH = 720;
const BINARY_SWARM_HEIGHT = 300;
const BINARY_SWARM_LEFT = 74;
const BINARY_SWARM_RIGHT = 668;
const BINARY_SWARM_TOP = 34;
const BINARY_SWARM_BOTTOM = 232;
const BINARY_SWARM_AXIS_Y = 254;
const BINARY_SWARM_DOMAIN_MAX = 0.5;
const BINARY_SWARM_DOT_GAP = 15;

const getBinarySwarmX = (difference: number) =>
  BINARY_SWARM_LEFT + (difference / BINARY_SWARM_DOMAIN_MAX) * (BINARY_SWARM_RIGHT - BINARY_SWARM_LEFT);

const buildBinaryConfidenceScale = (items: BinaryBeeswarmQuestionDatum[]): BinaryConfidenceScale => {
  const confidences = items.map((item) => item.averageConfidence).filter((confidence) => confidence > 0);

  if (confidences.length === 0) {
    return { min: 0, max: 100, ticks: [0, 50, 100] };
  }

  const min = clamp(Math.floor((Math.min(...confidences) - 4) / 10) * 10, 0, 90);
  const max = clamp(Math.ceil((Math.max(...confidences) + 4) / 10) * 10, min + 10, 100);
  const step = max - min > 60 ? 20 : 10;
  const ticks: number[] = [];
  for (let tick = min; tick <= max; tick += step) {
    ticks.push(tick);
  }

  return { min, max, ticks };
};

const getBinarySwarmY = (confidence: number, scale: BinaryConfidenceScale) => {
  if (confidence <= 0) return BINARY_SWARM_BOTTOM;
  const ratio = clamp((confidence - scale.min) / (scale.max - scale.min), 0, 1);
  return BINARY_SWARM_BOTTOM - ratio * (BINARY_SWARM_BOTTOM - BINARY_SWARM_TOP);
};

const buildBinaryBeeswarmPlacements = (items: BinaryBeeswarmQuestionDatum[], scale: BinaryConfidenceScale) => {
  const placements = new Map<number, BinaryBeeswarmPlacement>();
  const placed: BinaryBeeswarmPlacement[] = [];

  items.forEach((item, index) => {
    const base: BinaryBeeswarmPlacement = {
      x: getBinarySwarmX(item.difference),
      y: getBinarySwarmY(item.averageConfidence, scale),
    };
    let candidate = base;
    let attempt = 0;

    const collides = (point: BinaryBeeswarmPlacement) =>
      placed.some((existing) => Math.hypot(existing.x - point.x, existing.y - point.y) < BINARY_SWARM_DOT_GAP);

    while (collides(candidate) && attempt < 12) {
      attempt += 1;
      const direction = attempt % 2 === 0 ? 1 : -1;
      const distance = Math.ceil(attempt / 2) * BINARY_SWARM_DOT_GAP;
      candidate = {
        x: clamp(base.x + direction * distance, BINARY_SWARM_LEFT, BINARY_SWARM_RIGHT),
        y: base.y,
      };
    }

    placed.push(candidate);
    placements.set(index, candidate);
  });

  return placements;
};

const BinaryTooltipSplitBar = ({ counts }: { counts: ResponseCountDatum[] }) => {
  const total = counts.reduce((sum, count) => sum + count.value, 0);
  if (total <= 0) return null;

  return (
    <span className={styles.binaryTooltipSplitBar} aria-hidden="true">
      {counts.map((count) => (
        <span
          key={count.label}
          className={styles.binaryTooltipSplitSegment}
          style={{
            width: `${clamp((count.value / total) * 100, 0, 100)}%`,
            backgroundColor: count.color,
          }}
        />
      ))}
    </span>
  );
};

const BinaryBeeswarmViz = ({ spec, hideHeader = false }: VizBodyProps) => {
  const title = toText(spec.title) || 'Binary question beeswarm';
  const subtitle = toText(spec.subtitle);
  const note = toText(spec.note);
  const items = readBinaryBeeswarmItems(spec);
  const scale = buildBinaryConfidenceScale(items);
  const placements = buildBinaryBeeswarmPlacements(items, scale);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = React.useState<number | null>(null);
  const reactId = React.useId().replace(/:/g, '');
  const tooltipId = `binary-beeswarm-tooltip-${reactId}`;
  const ticks = [0, 0.125, 0.25, 0.375, 0.5];
  const activeIndex = pinnedIndex ?? hoverIndex;
  const activeItem = activeIndex === null ? null : items[activeIndex] || null;
  const activePlacement = activeIndex === null ? null : placements.get(activeIndex) || null;
  const isPinned = pinnedIndex !== null;
  const tooltipLeft = activePlacement ? clamp((activePlacement.x / BINARY_SWARM_WIDTH) * 100, 18, 82) : 50;
  const tooltipTop = activePlacement ? clamp((activePlacement.y / BINARY_SWARM_HEIGHT) * 100, 16, 84) : 50;
  const renderTooltipBelow = tooltipTop <= SWARM_TOOLTIP_FLIP_TOP_PERCENT;
  const sphereHighlightId = `binary-beeswarm-sphere-highlight-${reactId}`;
  const sphereShadowId = `binary-beeswarm-sphere-shadow-${reactId}`;
  const tooltipStyle: TooltipPositionStyle = {
    '--post-viz-tooltip-x': `${tooltipLeft}%`,
    top: `${tooltipTop}%`,
  };

  const clearPin = React.useCallback(() => setPinnedIndex(null), []);
  useEscapeToClear(pinnedIndex !== null, clearPin);

  const [view, setView] = React.useState<'swarm' | 'list'>('swarm');
  const [sortKey, setSortKey] = React.useState<'difference' | 'confidence'>('difference');

  if (items.length === 0) {
    return <p className={styles.vizFallback}>Visualization has no binary questions.</p>;
  }

  const switchView = (nextView: 'swarm' | 'list') => {
    setView(nextView);
    setPinnedIndex(null);
    setHoverIndex(null);
  };

  const sortedItems = [...items].sort((a, b) => {
    if (sortKey === 'confidence') return b.averageConfidence - a.averageConfidence;
    return b.difference - a.difference || b.averageConfidence - a.averageConfidence;
  });

  const viewButtons: Array<{ id: 'swarm' | 'list'; label: string }> = [
    { id: 'swarm', label: 'Swarm' },
    { id: 'list', label: 'List' },
  ];
  const sortButtons: Array<{ id: 'difference' | 'confidence'; label: string }> = [
    { id: 'difference', label: 'Most split' },
    { id: 'confidence', label: 'Confidence' },
  ];

  return (
    <section className={`${styles.vizCard} ${styles.binaryBeeswarmCard}`} aria-label={title}>
      <VizHeader title={title} subtitle={subtitle} hidden={hideHeader} />
      <div className={styles.vizToolbar}>
        <div className={styles.vizToggleGroup} role="group" aria-label="Chart view">
          {viewButtons.map((button) => (
            <button
              key={button.id}
              type="button"
              className={`${styles.vizToggleButton} ${view === button.id ? styles.vizToggleButtonActive : ''}`}
              aria-pressed={view === button.id}
              data-testid={`ce-posts-binary-view-${button.id}`}
              onClick={() => switchView(button.id)}
            >
              {button.label}
            </button>
          ))}
        </div>
        {view === 'list' && (
          <div className={styles.vizToggleGroup} role="group" aria-label="Sort questions">
            <span className={styles.vizToolbarLabel}>Sort</span>
            {sortButtons.map((button) => (
              <button
                key={button.id}
                type="button"
                className={`${styles.vizToggleButton} ${sortKey === button.id ? styles.vizToggleButtonActive : ''}`}
                aria-pressed={sortKey === button.id}
                data-testid={`ce-posts-binary-sort-${button.id}`}
                onClick={() => setSortKey(button.id)}
              >
                {button.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {view === 'list' && (
        <ul className={styles.binaryList} data-testid="ce-posts-binary-list">
          {sortedItems.map((item) => (
            <li key={item.label} className={styles.binaryListRow}>
              <p className={styles.binaryListPrompt}>{item.prompt || item.label}</p>
              <div className={styles.binaryListMeta}>
                <span className={styles.binaryListBar}>
                  <BinaryTooltipSplitBar counts={item.counts} />
                </span>
                <span className={styles.binaryListCounts}>{formatBinaryCountsLabel(item.counts)}</span>
                {item.averageConfidence > 0 && (
                  <span className={styles.binaryListConfidence}>
                    avg confidence {formatValue(item.averageConfidence)}%
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {view === 'swarm' && (
        <div className={styles.binaryBeeswarmFrame}>
          <svg
            className={styles.binaryBeeswarmSvg}
            viewBox={`0 0 ${BINARY_SWARM_WIDTH} ${BINARY_SWARM_HEIGHT}`}
            role="img"
            aria-label={title}
            onClick={() => setPinnedIndex(null)}
          >
            <defs>
              <radialGradient id={sphereHighlightId} cx="30%" cy="30%" r="68%">
                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.7)" />
                <stop offset="36%" stopColor="rgba(255, 255, 255, 0.28)" />
                <stop offset="72%" stopColor="rgba(255, 255, 255, 0)" />
              </radialGradient>
              <filter id={sphereShadowId} x="-70%" y="-70%" width="240%" height="240%" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.34" />
              </filter>
            </defs>
            {scale.ticks.map((tick) => {
              const y = getBinarySwarmY(tick, scale);
              return (
                <g key={`confidence-${tick}`}>
                  <line
                    className={styles.binaryBeeswarmGridline}
                    x1={BINARY_SWARM_LEFT}
                    y1={y}
                    x2={BINARY_SWARM_RIGHT}
                    y2={y}
                  />
                  <text
                    className={styles.binaryBeeswarmYTickLabel}
                    x={BINARY_SWARM_LEFT - 10}
                    y={y + 4}
                    textAnchor="end"
                  >
                    {tick}%
                  </text>
                </g>
              );
            })}
            <text
              className={styles.binaryBeeswarmYAxisLabel}
              transform={`rotate(-90 16 ${(BINARY_SWARM_TOP + BINARY_SWARM_BOTTOM) / 2})`}
              x={16}
              y={(BINARY_SWARM_TOP + BINARY_SWARM_BOTTOM) / 2}
              textAnchor="middle"
            >
              Avg. confidence
            </text>
            <line
              className={styles.binaryBeeswarmAxisBase}
              x1={BINARY_SWARM_LEFT}
              y1={BINARY_SWARM_AXIS_Y}
              x2={BINARY_SWARM_RIGHT}
              y2={BINARY_SWARM_AXIS_Y}
            />
            <line
              className={styles.binaryBeeswarmAxis}
              x1={BINARY_SWARM_LEFT}
              y1={BINARY_SWARM_AXIS_Y}
              x2={BINARY_SWARM_RIGHT}
              y2={BINARY_SWARM_AXIS_Y}
              stroke={BINARY_AXIS_COLOR}
            />
            {ticks.map((tick) => {
              const x = getBinarySwarmX(tick);
              return (
                <line
                  key={tick}
                  className={styles.binaryBeeswarmTick}
                  x1={x}
                  y1={BINARY_SWARM_TOP - 6}
                  x2={x}
                  y2={BINARY_SWARM_AXIS_Y + 6}
                />
              );
            })}
            <text className={styles.binaryBeeswarmAxisLabel} x={BINARY_SWARM_LEFT} y={BINARY_SWARM_HEIGHT - 8}>
              Consensus
            </text>
            <text
              className={styles.binaryBeeswarmAxisLabel}
              x={BINARY_SWARM_RIGHT}
              y={BINARY_SWARM_HEIGHT - 8}
              textAnchor="end"
            >
              Difference
            </text>
            {items.map((item, index) => {
              const placement = placements.get(index) || {
                x: getBinarySwarmX(item.difference),
                y: (BINARY_SWARM_TOP + BINARY_SWARM_BOTTOM) / 2,
              };
              const countsLabel = formatBinaryCountsLabel(item.counts);
              const confidenceLabel =
                item.averageConfidence > 0 ? `, average confidence: ${formatValue(item.averageConfidence)}%` : '';
              const promptLabel = item.prompt || item.label;
              const ariaLabel = `${promptLabel}: ${countsLabel}${confidenceLabel}`;
              const isActive = activeIndex === index;
              const showTooltip = () => setHoverIndex(index);
              const hideTooltip = () => setHoverIndex(null);
              const togglePin = (event: React.SyntheticEvent) => {
                event.stopPropagation();
                setPinnedIndex((current) => (current === index ? null : index));
              };
              return (
                <g
                  key={`${item.label}-${index}`}
                  className={`${styles.binaryBeeswarmPoint} ${isActive ? styles.binaryBeeswarmPointActive : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={ariaLabel}
                  aria-pressed={pinnedIndex === index}
                  aria-describedby={isActive ? tooltipId : undefined}
                  onMouseEnter={showTooltip}
                  onMouseLeave={hideTooltip}
                  onFocus={showTooltip}
                  onBlur={hideTooltip}
                  onClick={togglePin}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      togglePin(event);
                    }
                  }}
                >
                  <circle
                    className={styles.binaryBeeswarmHitArea}
                    cx={placement.x}
                    cy={placement.y}
                    r={20}
                    fill="transparent"
                    onMouseEnter={showTooltip}
                    onMouseLeave={hideTooltip}
                  />
                  <circle
                    className={styles.binaryBeeswarmDotShadow}
                    cx={placement.x}
                    cy={placement.y + 1.2}
                    r={8.4}
                    filter={`url(#${sphereShadowId})`}
                    aria-hidden="true"
                    pointerEvents="none"
                  />
                  <circle
                    className={styles.binaryBeeswarmDot}
                    cx={placement.x}
                    cy={placement.y}
                    r={7.5}
                    fill={BINARY_DOT_COLOR}
                    onMouseEnter={showTooltip}
                    onMouseLeave={hideTooltip}
                  />
                  <circle
                    className={styles.binaryBeeswarmDotHighlight}
                    cx={placement.x}
                    cy={placement.y}
                    r={7.5}
                    fill={`url(#${sphereHighlightId})`}
                    aria-hidden="true"
                    pointerEvents="none"
                  />
                  <title>{ariaLabel}</title>
                </g>
              );
            })}
          </svg>
          {activeItem && activePlacement && (
            <div
              id={tooltipId}
              role="tooltip"
              className={`${styles.binaryBeeswarmTooltip} ${renderTooltipBelow ? styles.binaryBeeswarmTooltipBelow : ''} ${isPinned ? styles.binaryBeeswarmTooltipPinned : ''}`}
              style={tooltipStyle}
            >
              {isPinned && (
                <button
                  type="button"
                  className={styles.binaryBeeswarmTooltipClose}
                  onClick={() => setPinnedIndex(null)}
                  aria-label="Close question details"
                  data-testid="ce-posts-binary-swarm-tooltip-close"
                >
                  &times;
                </button>
              )}
              <strong>{activeItem.label}</strong>
              {activeItem.prompt && activeItem.prompt !== activeItem.label && <p>{activeItem.prompt}</p>}
              <BinaryTooltipSplitBar counts={activeItem.counts} />
              <span>{formatBinaryCountsLabel(activeItem.counts)}</span>
              {activeItem.averageConfidence > 0 && (
                <span>Average confidence: {formatValue(activeItem.averageConfidence)}%</span>
              )}
            </div>
          )}
        </div>
      )}
      {note && <p className={styles.vizNote}>{renderFormattedText(note)}</p>}
    </section>
  );
};

const ResponseTypeGridViz = ({ spec, hideHeader = false }: VizBodyProps) => {
  const title = toText(spec.title) || 'Response types';
  const subtitle = toText(spec.subtitle);
  const panels = readResponsePanels(spec, PALETTE);
  const note = toText(spec.note);
  const presentation = toText(spec.presentation).toLowerCase();

  if (panels.length === 0) {
    return <p className={styles.vizFallback}>Visualization has no response panels.</p>;
  }

  if (presentation === 'editorial') {
    return (
      <EditorialResponseTypeGridPresentation
        title={title}
        subtitle={subtitle}
        panels={panels}
        note={note}
        hideHeader={hideHeader}
      />
    );
  }

  return (
    <ResponseTypeGridPresentation
      title={title}
      subtitle={subtitle}
      panels={panels}
      note={note}
      hideHeader={hideHeader}
      precision={presentation === 'precision'}
    />
  );
};

type PostVizProps = {
  spec: unknown;
  error?: string;
  defaultOpen?: boolean;
  nested?: boolean;
  presentation?: 'disclosure' | 'slide';
};

const getFallbackTitle = (type: string): string => {
  if (type === 'category-dots') return 'Distribution';
  if (type === 'quote-wall') return 'Voices';
  if (type === 'ranked-themes') return 'Ranked themes';
  if (type === 'theme-network') return 'Theme network';
  if (type === 'beeswarm') return 'Rating responses';
  if (type === 'binary-beeswarm') return 'Binary question beeswarm';
  if (type === 'response-type-grid') return 'Response types';
  return 'Data exhibit';
};

export const getPostVizTitle = (spec: unknown): string => {
  const record = asRecord(spec);
  const type = toText(record?.type);

  return toText(record?.title) || getFallbackTitle(type);
};

const renderVizBody = (record: VizRecord, type: string, hideHeader = true) => {
  if (type === 'category-dots') return <CategoryDotsViz spec={record} hideHeader={hideHeader} />;
  if (type === 'quote-wall') return <QuoteWallViz spec={record} hideHeader={hideHeader} />;
  if (type === 'ranked-themes') return <RankedThemesViz spec={record} hideHeader={hideHeader} />;
  if (type === 'theme-network') return <ThemeNetworkViz spec={record} hideHeader={hideHeader} />;
  if (type === 'beeswarm') return <BeeswarmViz spec={record} hideHeader={hideHeader} />;
  if (type === 'binary-beeswarm') return <BinaryBeeswarmViz spec={record} hideHeader={hideHeader} />;
  if (type === 'response-type-grid') return <ResponseTypeGridViz spec={record} hideHeader={hideHeader} />;

  return <p className={styles.vizFallback}>Unsupported visualization type: {type}</p>;
};

const PostViz = ({
  spec,
  error = '',
  defaultOpen = true,
  nested = false,
  presentation = 'disclosure',
}: PostVizProps) => {
  if (error) {
    return <p className={styles.vizFallback}>Visualization JSON is invalid.</p>;
  }

  const record = asRecord(spec);
  const type = toText(record?.type);
  if (!record || !type) {
    return <p className={styles.vizFallback}>Visualization block is missing a type.</p>;
  }

  const title = getPostVizTitle(record);
  const inline = toBoolean(record.inline);

  if (presentation === 'slide') {
    // hideTitle only affects the visible header; the title still names the
    // slide and its dot via getPostVizTitle, so accessible labels survive.
    return renderVizBody(record, type, toBoolean(record.hideTitle));
  }

  if (inline) {
    return <div className={styles.vizInlineContent}>{renderVizBody(record, type)}</div>;
  }

  return (
    <details className={`${styles.vizDisclosure} ${nested ? styles.vizDisclosureNested : ''}`} open={defaultOpen}>
      <summary className={styles.vizDisclosureSummary}>
        <span>{title}</span>
        <span className={styles.vizDisclosureIcon} aria-hidden="true">
          <FontAwesomeIcon className={styles.vizDisclosureIconClosed} icon={faCaretDown} />
          <FontAwesomeIcon className={styles.vizDisclosureIconOpen} icon={faCaretUp} />
        </span>
      </summary>
      {renderVizBody(record, type)}
    </details>
  );
};

export default PostViz;
