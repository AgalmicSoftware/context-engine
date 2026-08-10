import React from 'react';
import styles from './PostsPage.module.scss';

type VizRecord = Record<string, unknown>;

const PALETTE = [
  'var(--ce-data-series-7)',
  'var(--ce-data-series-1)',
  'var(--ce-data-series-5)',
  'var(--ce-data-series-3)',
  'var(--ce-data-series-6)',
  'var(--ce-data-series-8)',
];
const BINARY_DOT_COLOR = 'var(--ce-data-series-8)';
const BINARY_AXIS_COLOR = 'var(--ce-data-series-1)';

const asRecord = (value: unknown): VizRecord | null => (
  !!value && typeof value === 'object' && !Array.isArray(value)
    ? value as VizRecord
    : null
);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const toText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const toSafeColor = (value: unknown, fallback: string): string => {
  const color = toText(value);
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
};

const formatValue = (value: number, suffix = ''): string => {
  const rounded = Math.abs(value) >= 10
    ? Math.round(value)
    : Number(value.toFixed(1));
  return `${rounded}${suffix}`;
};

type CategoryDatum = {
  label: string;
  value: number;
  detail: string;
  color: string;
};

const readCategories = (spec: VizRecord): CategoryDatum[] => (
  asArray(spec.categories)
    .map((entry, index): CategoryDatum | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const label = toText(record.label);
      if (!label) return null;
      return {
        label,
        value: Math.max(0, toNumber(record.value)),
        detail: toText(record.detail),
        color: toSafeColor(record.color, PALETTE[index % PALETTE.length]),
      };
    })
    .filter((entry): entry is CategoryDatum => !!entry)
);

const CategoryDotsViz = ({ spec }: { spec: VizRecord }) => {
  const title = toText(spec.title) || 'Distribution';
  const subtitle = toText(spec.subtitle);
  const suffix = toText(spec.valueSuffix);
  const dotUnit = Math.max(1, toNumber(spec.dotUnit, 1));
  const categories = readCategories(spec);

  if (categories.length === 0) {
    return <p className={styles.vizFallback}>Visualization has no categories.</p>;
  }

  return (
    <section className={styles.vizCard} aria-label={title}>
      <div className={styles.vizHeader}>
        <h3 className={styles.vizTitle}>{title}</h3>
        {subtitle && <p className={styles.vizSubtitle}>{subtitle}</p>}
      </div>
      <div className={styles.categoryViz}>
        {categories.map((category) => {
          const dotCount = Math.max(1, Math.min(160, Math.round(category.value / dotUnit)));
          return (
            <div key={category.label} className={styles.categoryRow}>
              <div className={styles.categoryMeta}>
                <span className={styles.categoryLabel}>{category.label}</span>
                <span className={styles.categoryValue}>{formatValue(category.value, suffix)}</span>
              </div>
              <div
                className={styles.dotGrid}
                aria-label={`${category.label}: ${formatValue(category.value, suffix)}`}
              >
                {Array.from({ length: dotCount }).map((_, index) => (
                  <span
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${category.label}-${index}`}
                    className={styles.dot}
                    style={{ backgroundColor: category.color }}
                  />
                ))}
              </div>
              {category.detail && <p className={styles.categoryDetail}>{category.detail}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
};

type QuoteDatum = {
  text: string;
  label: string;
};

const readQuotes = (spec: VizRecord): QuoteDatum[] => (
  asArray(spec.quotes)
    .map((entry): QuoteDatum | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const text = toText(record.text);
      if (!text) return null;
      return {
        text,
        label: toText(record.label),
      };
    })
    .filter((entry): entry is QuoteDatum => !!entry)
);

const QuoteWallViz = ({ spec }: { spec: VizRecord }) => {
  const title = toText(spec.title) || 'Voices';
  const subtitle = toText(spec.subtitle);
  const quotes = readQuotes(spec);

  if (quotes.length === 0) {
    return <p className={styles.vizFallback}>Visualization has no quotes.</p>;
  }

  return (
    <section className={styles.vizCard} aria-label={title}>
      <div className={styles.vizHeader}>
        <h3 className={styles.vizTitle}>{title}</h3>
        {subtitle && <p className={styles.vizSubtitle}>{subtitle}</p>}
      </div>
      <div className={styles.quoteWall}>
        {quotes.map((quote, index) => (
          <figure key={`${quote.label || 'quote'}-${index}`} className={styles.quoteItem}>
            <blockquote className={styles.quoteText}>{quote.text}</blockquote>
            {quote.label && <figcaption className={styles.quoteLabel}>{quote.label}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
};

type RankedThemeDatum = {
  rank: string;
  label: string;
  value: number;
  summary: string;
  quote: string;
  source: string;
  color: string;
};

const readRankedThemes = (spec: VizRecord): RankedThemeDatum[] => (
  asArray(spec.items || spec.categories)
    .map((entry, index): RankedThemeDatum | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const label = toText(record.label);
      if (!label) return null;
      return {
        rank: toText(record.rank) || String(index + 1).padStart(2, '0'),
        label,
        value: Math.max(0, toNumber(record.value)),
        summary: toText(record.summary || record.detail),
        quote: toText(record.quote),
        source: toText(record.source),
        color: toSafeColor(record.color, PALETTE[index % PALETTE.length]),
      };
    })
    .filter((entry): entry is RankedThemeDatum => !!entry)
);

const RankedThemesViz = ({ spec }: { spec: VizRecord }) => {
  const title = toText(spec.title) || 'Ranked themes';
  const subtitle = toText(spec.subtitle);
  const suffix = toText(spec.valueSuffix) || '%';
  const items = readRankedThemes(spec);
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  if (items.length === 0) {
    return <p className={styles.vizFallback}>Visualization has no ranked themes.</p>;
  }

  return (
    <section className={`${styles.vizCard} ${styles.rankedThemesCard}`} aria-label={title}>
      <div className={styles.vizHeader}>
        <h3 className={styles.vizTitle}>{title}</h3>
        {subtitle && <p className={styles.vizSubtitle}>{subtitle}</p>}
      </div>
      <div className={styles.rankedThemes}>
        {items.map((item) => (
          <article key={`${item.rank}-${item.label}`} className={styles.rankedTheme}>
            <div className={styles.rankBadge}>{item.rank}</div>
            <div className={styles.rankedThemeBody}>
              <div className={styles.rankedThemeHeader}>
                <h4 className={styles.rankedThemeTitle}>{item.label}</h4>
                <span className={styles.rankedThemeValue}>{formatValue(item.value, suffix)}</span>
              </div>
              <div className={styles.rankedThemeTrack} aria-label={`${item.label}: ${formatValue(item.value, suffix)}`}>
                <span
                  className={styles.rankedThemeFill}
                  style={{
                    width: `${clamp((item.value / maxValue) * 100, 4, 100)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
              {item.summary && <p className={styles.rankedThemeSummary}>{item.summary}</p>}
              {item.quote && (
                <figure className={styles.rankedThemeQuote}>
                  <blockquote>{item.quote}</blockquote>
                  {item.source && <figcaption>{item.source}</figcaption>}
                </figure>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

type NetworkNodeDatum = {
  id: string;
  label: string;
  value: number;
  x: number;
  y: number;
  detail: string;
  color: string;
};

type NetworkLinkDatum = {
  source: string;
  target: string;
  strength: number;
  label: string;
};

const readNetworkNodes = (spec: VizRecord): NetworkNodeDatum[] => (
  asArray(spec.nodes)
    .map((entry, index): NetworkNodeDatum | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const label = toText(record.label);
      const id = toText(record.id) || label;
      if (!id || !label) return null;
      return {
        id,
        label,
        value: Math.max(1, toNumber(record.value, 1)),
        x: clamp(toNumber(record.x, 50), 8, 92),
        y: clamp(toNumber(record.y, 32), 8, 56),
        detail: toText(record.detail),
        color: toSafeColor(record.color, PALETTE[index % PALETTE.length]),
      };
    })
    .filter((entry): entry is NetworkNodeDatum => !!entry)
);

const readNetworkLinks = (spec: VizRecord, nodeIds: Set<string>): NetworkLinkDatum[] => (
  asArray(spec.links)
    .map((entry): NetworkLinkDatum | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const source = toText(record.source);
      const target = toText(record.target);
      if (!nodeIds.has(source) || !nodeIds.has(target)) return null;
      return {
        source,
        target,
        strength: clamp(toNumber(record.strength, 0.5), 0.1, 1),
        label: toText(record.label),
      };
    })
    .filter((entry): entry is NetworkLinkDatum => !!entry)
);

const ThemeNetworkViz = ({ spec }: { spec: VizRecord }) => {
  const title = toText(spec.title) || 'Theme network';
  const subtitle = toText(spec.subtitle);
  const nodes = readNetworkNodes(spec);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const links = readNetworkLinks(spec, new Set(nodesById.keys()));
  const maxValue = Math.max(...nodes.map((node) => node.value), 1);

  if (nodes.length === 0) {
    return <p className={styles.vizFallback}>Visualization has no network nodes.</p>;
  }

  return (
    <section className={`${styles.vizCard} ${styles.themeNetworkCard}`} aria-label={title}>
      <div className={styles.vizHeader}>
        <h3 className={styles.vizTitle}>{title}</h3>
        {subtitle && <p className={styles.vizSubtitle}>{subtitle}</p>}
      </div>
      <div className={styles.networkFrame}>
        <svg className={styles.networkCanvas} viewBox="0 0 100 64" role="img" aria-label={title}>
          {links.map((link) => {
            const source = nodesById.get(link.source);
            const target = nodesById.get(link.target);
            if (!source || !target) return null;
            return (
              <line
                key={`${link.source}-${link.target}`}
                className={styles.networkLink}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                strokeWidth={0.25 + link.strength * 1.6}
              />
            );
          })}
          {nodes.map((node) => {
            const radius = 2.8 + (node.value / maxValue) * 5.5;
            return (
              <g key={node.id}>
                <circle
                  className={styles.networkNode}
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={node.color}
                />
                <text
                  className={styles.networkLabel}
                  x={node.x}
                  y={node.y + radius + 4.2}
                  textAnchor="middle"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
        <div className={styles.networkLegend}>
          {nodes.map((node) => (
            <div key={node.id} className={styles.networkLegendItem}>
              <span className={styles.networkLegendSwatch} style={{ backgroundColor: node.color }} />
              <div>
                <span className={styles.networkLegendTitle}>{node.label}</span>
                {node.detail && <p>{node.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

type LegendDatum = {
  label: string;
  detail: string;
  color: string;
};

const readLegend = (spec: VizRecord): LegendDatum[] => (
  asArray(spec.participants || spec.legend)
    .map((entry, index): LegendDatum | null => {
      const record = asRecord(entry);
      const label = record ? toText(record.label) : toText(entry);
      if (!label) return null;
      return {
        label,
        detail: record ? toText(record.status || record.detail) : '',
        color: record ? toSafeColor(record.color, PALETTE[index % PALETTE.length]) : PALETTE[index % PALETTE.length],
      };
    })
    .filter((entry): entry is LegendDatum => !!entry)
);

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

const readBeeswarmRows = (spec: VizRecord): BeeswarmRowDatum[] => (
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
    .filter((entry): entry is BeeswarmRowDatum => !!entry)
);

const BeeswarmViz = ({ spec }: { spec: VizRecord }) => {
  const title = toText(spec.title) || 'Rating responses';
  const subtitle = toText(spec.subtitle);
  const note = toText(spec.note);
  const suffix = toText(spec.valueSuffix);
  const min = toNumber(spec.min, 0);
  const max = Math.max(min + 1, toNumber(spec.max, 10));
  const rows = readBeeswarmRows(spec);
  const legend = readLegend(spec);
  const ticks = [min, (min + max) / 2, max];

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
                        boxShadow: `0 7px 20px color-mix(in srgb, var(--ce-compat-dark) 32%, transparent), 0 0 0 ${ringWidth}px color-mix(in srgb, var(--ce-text-inverse) ${ringOpacity * 100}%, transparent)`,
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
      <div className={styles.beeswarmViz}>
        {rows.map((row) => (
          <div key={row.label} className={styles.beeswarmRow}>
            <div className={styles.beeswarmRowMeta}>
              <h4>{row.label}</h4>
              {row.prompt && <p>{row.prompt}</p>}
            </div>
            <div className={styles.beeswarmPlot} role="img" aria-label={`${row.label} ratings`}>
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
                const left = clamp(((point.value - min) / (max - min)) * 100, 0, 100);
                const top = 26 + (index % 3) * 18;
                const confidenceLabel = point.confidence > 0 ? `, ${formatValue(point.confidence, '%')} confidence` : '';
                return (
                  <span
                    key={`${row.label}-${point.label}-${index}`}
                    className={styles.beeswarmDot}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      backgroundColor: point.color,
                      opacity: 0.62 + (point.confidence / 100) * 0.34,
                    }}
                    role="img"
                    aria-label={`${point.label}: ${formatValue(point.value, suffix)}${confidenceLabel}`}
                    title={`${point.label}: ${formatValue(point.value, suffix)}${confidenceLabel}`}
                  >
                    {point.label}
                  </span>
                );
              })}
            </div>
            {row.missing.length > 0 && (
              <p className={styles.beeswarmMissing}>No completed answer: {row.missing.join(', ')}</p>
            )}
          </div>
        ))}
      </div>
      {legend.length > 0 && (
        <div className={styles.vizLegend} aria-label="Participant legend">
          {legend.map((item) => (
            <span key={item.label} className={styles.vizLegendItem}>
              <span className={styles.vizLegendSwatch} style={{ backgroundColor: item.color }} />
              <span>{item.label}{item.detail ? ` - ${item.detail}` : ''}</span>
            </span>
          ))}
        </div>
      )}
      {note && <p className={styles.vizNote}>{note}</p>}
    </section>
  );
};

type ResponseCountDatum = {
  label: string;
  value: number;
  color: string;
};

type ResponseQuoteDatum = {
  label: string;
  text: string;
};

type ResponsePanelDatum = {
  kind: string;
  title: string;
  prompt: string;
  note: string;
  counts: ResponseCountDatum[];
  quotes: ResponseQuoteDatum[];
};

const readResponsePanels = (spec: VizRecord): ResponsePanelDatum[] => (
  asArray(spec.panels || spec.items)
    .map((entry, panelIndex): ResponsePanelDatum | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const title = toText(record.title || record.label);
      if (!title) return null;
      const counts = asArray(record.counts || record.choices || record.options)
        .map((count, countIndex): ResponseCountDatum | null => {
          const countRecord = asRecord(count);
          if (!countRecord) return null;
          const label = toText(countRecord.label);
          if (!label) return null;
          return {
            label,
            value: Math.max(0, toNumber(countRecord.value)),
            color: toSafeColor(countRecord.color, PALETTE[(panelIndex + countIndex) % PALETTE.length]),
          };
        })
        .filter((count): count is ResponseCountDatum => !!count);
      const quotes = asArray(record.quotes || record.examples)
        .map((quote): ResponseQuoteDatum | null => {
          const quoteRecord = asRecord(quote);
          if (!quoteRecord) return null;
          const text = toText(quoteRecord.text);
          if (!text) return null;
          return {
            label: toText(quoteRecord.label),
            text,
          };
        })
        .filter((quote): quote is ResponseQuoteDatum => !!quote);
      return {
        kind: toText(record.kind || record.type),
        title,
        prompt: toText(record.prompt),
        note: toText(record.note),
        counts,
        quotes,
      };
    })
    .filter((entry): entry is ResponsePanelDatum => !!entry)
);

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
                <stop offset="0%" stopColor="color-mix(in srgb, var(--ce-text-inverse) 70%, transparent)" />
                <stop offset="36%" stopColor="color-mix(in srgb, var(--ce-text-inverse) 28%, transparent)" />
                <stop offset="72%" stopColor="transparent" />
              </radialGradient>
              <filter id={sphereShadowId} x="-70%" y="-70%" width="240%" height="240%" colorInterpolationFilters="sRGB">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="var(--ce-compat-dark)" floodOpacity="0.34" />
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
  const panels = readResponsePanels(spec);
  const note = toText(spec.note);

  if (panels.length === 0) {
    return <p className={styles.vizFallback}>Visualization has no response panels.</p>;
  }

  return (
    <section className={`${styles.vizCard} ${styles.responseTypeCard}`} aria-label={title}>
      <div className={styles.vizHeader}>
        <h3 className={styles.vizTitle}>{title}</h3>
        {subtitle && <p className={styles.vizSubtitle}>{subtitle}</p>}
      </div>
      <div className={styles.responseTypeGrid}>
        {panels.map((panel) => {
          const maxValue = Math.max(...panel.counts.map((count) => count.value), 1);
          return (
            <article key={`${panel.kind}-${panel.title}`} className={styles.responseTypePanel}>
              {panel.kind && <p className={styles.responseTypeKind}>{panel.kind}</p>}
              <h4>{panel.title}</h4>
              {panel.prompt && <p className={styles.responseTypePrompt}>{panel.prompt}</p>}
              {panel.counts.length > 0 && (
                <div className={styles.responseBars}>
                  {panel.counts.map((count) => (
                    <div key={count.label} className={styles.responseBarRow}>
                      <div className={styles.responseBarMeta}>
                        <span>{count.label}</span>
                        <span>{formatValue(count.value)}</span>
                      </div>
                      <div className={styles.responseBarTrack} aria-label={`${count.label}: ${formatValue(count.value)}`}>
                        <span
                          className={styles.responseBarFill}
                          style={{
                            width: `${clamp((count.value / maxValue) * 100, 6, 100)}%`,
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
                      {quote.label && <figcaption>{quote.label}</figcaption>}
                    </figure>
                  ))}
                </div>
              )}
              {panel.note && <p className={styles.responseTypeNote}>{panel.note}</p>}
            </article>
          );
        })}
      </div>
      {note && <p className={styles.vizNote}>{note}</p>}
    </section>
  );
};

type PostVizProps = {
  spec: unknown;
  error?: string;
};

const PostViz = ({ spec, error = '' }: PostVizProps) => {
  if (error) {
    return <p className={styles.vizFallback}>Visualization JSON is invalid.</p>;
  }

  const record = asRecord(spec);
  const type = toText(record?.type);
  if (!record || !type) {
    return <p className={styles.vizFallback}>Visualization block is missing a type.</p>;
  }

  if (type === 'category-dots') return <CategoryDotsViz spec={record} />;
  if (type === 'quote-wall') return <QuoteWallViz spec={record} />;
  if (type === 'ranked-themes') return <RankedThemesViz spec={record} />;
  if (type === 'theme-network') return <ThemeNetworkViz spec={record} />;
  if (type === 'beeswarm') return <BeeswarmViz spec={record} />;
  if (type === 'response-type-grid') return <ResponseTypeGridViz spec={record} />;

  return <p className={styles.vizFallback}>Unsupported visualization type: {type}</p>;
};

export default PostViz;
