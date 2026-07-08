import React from 'react';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import styles from './PostsPage.module.scss';

type VizRecord = Record<string, unknown>;

const PALETTE = ['#4dffa4', '#7aa7ff', '#ffb347', '#ff6bcb', '#d8f36a', '#9ee7ff'];
const RESPONSE_SPLIT_ORDER = ['agree', 'unsure', 'disagree'];
const RESPONSE_SPLIT_LABELS = new Set(RESPONSE_SPLIT_ORDER);
const RESPONSE_TONE_COLORS: Record<string, string> = {
  agree: '#4dffa4',
  unsure: '#ffd166',
  disagree: '#ff6b6b',
};

const normalizeResponseSplitLabel = (label: string) => label.trim().toLowerCase();

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

const toBoolean = (value: unknown): boolean => value === true || value === 'true';

const clamp = (value: number, min: number, max: number): number => (
  Math.min(max, Math.max(min, value))
);

const toSafeColor = (value: unknown, fallback: string): string => {
  const color = toText(value);
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
};

const resolveResponseCountColor = (label: string, value: unknown, fallback: string): string => (
  RESPONSE_TONE_COLORS[normalizeResponseSplitLabel(label)] || toSafeColor(value, fallback)
);

const formatValue = (value: number, suffix = ''): string => {
  const rounded = Math.abs(value) >= 10
    ? Math.round(value)
    : Number(value.toFixed(1));
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

const VizHeader = ({
  title,
  subtitle,
  hidden = false,
}: {
  title: string;
  subtitle?: string;
  hidden?: boolean;
}) => {
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

const CategoryDotsViz = ({ spec, hideHeader = false }: VizBodyProps) => {
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
      <VizHeader title={title} subtitle={subtitle} hidden={hideHeader} />
      <div className={styles.categoryViz}>
        {categories.map((category) => {
          const dotCount = Math.max(1, Math.min(160, Math.round(category.value / dotUnit)));
          return (
            <div key={category.label} className={styles.categoryRow}>
              <div className={styles.categoryMeta}>
                <span className={styles.categoryLabel}>{category.label}</span>
                <span className={styles.categoryValue} style={{ color: category.color }}>
                  {formatValue(category.value, suffix)}
                </span>
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

const QuoteWallViz = ({ spec, hideHeader = false }: VizBodyProps) => {
  const title = toText(spec.title) || 'Voices';
  const subtitle = toText(spec.subtitle);
  const quotes = readQuotes(spec);

  if (quotes.length === 0) {
    return <p className={styles.vizFallback}>Visualization has no quotes.</p>;
  }

  return (
    <section className={styles.vizCard} aria-label={title}>
      <VizHeader title={title} subtitle={subtitle} hidden={hideHeader} />
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

const RankedThemesViz = ({ spec, hideHeader = false }: VizBodyProps) => {
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
      <VizHeader title={title} subtitle={subtitle} hidden={hideHeader} />
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

const ThemeNetworkViz = ({ spec, hideHeader = false }: VizBodyProps) => {
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
      <VizHeader title={title} subtitle={subtitle} hidden={hideHeader} />
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

const duplicateValueKey = (value: number) => value.toFixed(4);

const defaultBeeswarmTops = [32, 50, 68, 40, 60];

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

const BeeswarmViz = ({ spec, hideHeader = false }: VizBodyProps) => {
  const title = toText(spec.title) || 'Rating responses';
  const subtitle = toText(spec.subtitle);
  const note = toText(spec.note);
  const suffix = toText(spec.valueSuffix);
  const min = toNumber(spec.min, 0);
  const max = Math.max(min + 1, toNumber(spec.max, 10));
  const rows = readBeeswarmRows(spec);
  const ticks = [min, (min + max) / 2, max];

  if (rows.length === 0) {
    return <p className={styles.vizFallback}>Visualization has no beeswarm rows.</p>;
  }

  return (
    <section className={`${styles.vizCard} ${styles.beeswarmCard}`} aria-label={title}>
      <VizHeader title={title} subtitle={subtitle} hidden={hideHeader} />
      <div className={styles.beeswarmViz}>
        {rows.map((row) => {
          const placements = buildBeeswarmPlacements(row.values);
          return (
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
                  const placement = placements[index];
                  const confidenceLabel = point.confidence > 0 ? `, ${formatValue(point.confidence, '%')} confidence` : '';
                  return (
                    <span
                      key={`${row.label}-${point.label}-${index}`}
                      className={styles.beeswarmDot}
                      style={{
                        left: formatCalcPercentWithPx(left, placement.x),
                        top: `${placement.top}%`,
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
          );
        })}
      </div>
      {note && <p className={styles.vizNote}>{renderFormattedText(note)}</p>}
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
  display: string;
  hideTitle: boolean;
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
            color: resolveResponseCountColor(
              label,
              countRecord.color,
              PALETTE[(panelIndex + countIndex) % PALETTE.length]
            ),
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
        display: toText(record.display || record.layout).toLowerCase(),
        hideTitle: toBoolean(record.hideTitle),
        counts,
        quotes,
      };
    })
    .filter((entry): entry is ResponsePanelDatum => !!entry)
);

const buildPieGradient = (counts: ResponseCountDatum[]) => {
  const total = counts.reduce((sum, count) => sum + count.value, 0);
  if (total <= 0) {
    return {
      total: 0,
      gradient: 'conic-gradient(rgba(255, 255, 255, 0.16) 0 100%)',
    };
  }

  let cursor = 0;
  const segments = counts.map((count) => {
    const start = cursor;
    const end = cursor + (count.value / total) * 100;
    cursor = end;
    return `${count.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });

  return {
    total,
    gradient: `conic-gradient(${segments.join(', ')})`,
  };
};

const isResponseSplitPanel = (panel: ResponsePanelDatum) => {
  if (panel.display === 'split' || panel.display === 'results-bar') return true;
  if (panel.display) return false;
  if (panel.counts.length < 2) return false;
  return panel.counts.every((count) => RESPONSE_SPLIT_LABELS.has(normalizeResponseSplitLabel(count.label)));
};

const orderedResponseSplitCounts = (counts: ResponseCountDatum[]) => (
  [...counts].sort((a, b) => {
    const aIndex = RESPONSE_SPLIT_ORDER.indexOf(normalizeResponseSplitLabel(a.label));
    const bIndex = RESPONSE_SPLIT_ORDER.indexOf(normalizeResponseSplitLabel(b.label));
    const normalizedA = aIndex === -1 ? RESPONSE_SPLIT_ORDER.length : aIndex;
    const normalizedB = bIndex === -1 ? RESPONSE_SPLIT_ORDER.length : bIndex;
    return normalizedA - normalizedB;
  })
);

type BinaryBeeswarmQuestionDatum = {
  label: string;
  prompt: string;
  counts: ResponseCountDatum[];
  total: number;
  averageConfidence: number;
  difference: number;
  color: string;
  majorityLabel: string;
};

const readBinaryBeeswarmItems = (spec: VizRecord): BinaryBeeswarmQuestionDatum[] => (
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
                PALETTE[(itemIndex + countIndex) % PALETTE.length]
              ),
            };
          })
          .filter((count): count is ResponseCountDatum => !!count)
      );
      const total = counts.reduce((sum, count) => sum + count.value, 0);
      if (total <= 0) return null;
      const maxCount = Math.max(...counts.map((count) => count.value));
      const leaders = counts.filter((count) => count.value === maxCount);
      const majority = leaders.length === 1 ? leaders[0] : null;
      return {
        label,
        prompt: toText(record.prompt || record.detail),
        counts,
        total,
        averageConfidence: clamp(toNumber(record.averageConfidence || record.confidence, 0), 0, 100),
        difference: clamp((total - maxCount) / total, 0, 0.5),
        color: majority?.color || '#ff6bcb',
        majorityLabel: majority?.label || 'split',
      };
    })
    .filter((entry): entry is BinaryBeeswarmQuestionDatum => !!entry)
);

type BinaryBeeswarmPlacement = {
  x: number;
  y: number;
};

const BINARY_SWARM_WIDTH = 720;
const BINARY_SWARM_HEIGHT = 250;
const BINARY_SWARM_LEFT = 58;
const BINARY_SWARM_RIGHT = 662;
const BINARY_SWARM_TOP = 36;
const BINARY_SWARM_BOTTOM = 178;
const BINARY_SWARM_AXIS_Y = 202;
const BINARY_SWARM_DOMAIN_MAX = 0.5;

const getBinarySwarmX = (difference: number) => (
  BINARY_SWARM_LEFT + (difference / BINARY_SWARM_DOMAIN_MAX) * (BINARY_SWARM_RIGHT - BINARY_SWARM_LEFT)
);

const buildBinaryBeeswarmPlacements = (items: BinaryBeeswarmQuestionDatum[]) => {
  const grouped = items.reduce<Map<string, number[]>>((groups, item, index) => {
    const key = item.difference.toFixed(4);
    const group = groups.get(key) || [];
    group.push(index);
    groups.set(key, group);
    return groups;
  }, new Map());
  const placements = new Map<number, BinaryBeeswarmPlacement>();

  grouped.forEach((indexes) => {
    const visibleRows = Math.min(indexes.length, 7);
    indexes.forEach((itemIndex, localIndex) => {
      const columnIndex = Math.floor(localIndex / visibleRows);
      const rowIndex = localIndex % visibleRows;
      const centeredRow = rowIndex - (visibleRows - 1) / 2;
      const y = visibleRows <= 1
        ? (BINARY_SWARM_TOP + BINARY_SWARM_BOTTOM) / 2
        : ((BINARY_SWARM_TOP + BINARY_SWARM_BOTTOM) / 2) + centeredRow * 19;
      const columnDirection = columnIndex % 2 === 0 ? -1 : 1;
      const columnDistance = Math.ceil(columnIndex / 2);
      const rowDirection = rowIndex % 2 === 0 ? -1 : 1;
      const jitter = columnIndex === 0
        ? rowDirection * Math.min(localIndex, 2) * 5
        : columnDirection * columnDistance * 17;
      placements.set(itemIndex, {
        x: clamp(getBinarySwarmX(items[itemIndex].difference) + jitter, BINARY_SWARM_LEFT, BINARY_SWARM_RIGHT),
        y: clamp(y, BINARY_SWARM_TOP, BINARY_SWARM_BOTTOM),
      });
    });
  });

  return placements;
};

const formatBinaryCountsLabel = (counts: ResponseCountDatum[]) => (
  orderedResponseSplitCounts(counts)
    .map((count) => `${count.label} ${formatValue(count.value)}`)
    .join(', ')
);

const BinaryBeeswarmViz = ({ spec, hideHeader = false }: VizBodyProps) => {
  const title = toText(spec.title) || 'Binary question beeswarm';
  const subtitle = toText(spec.subtitle);
  const note = toText(spec.note);
  const items = readBinaryBeeswarmItems(spec);
  const placements = buildBinaryBeeswarmPlacements(items);
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const reactId = React.useId().replace(/:/g, '');
  const gradientId = `binary-beeswarm-gradient-${reactId}`;
  const tooltipId = `binary-beeswarm-tooltip-${reactId}`;
  const ticks = [0, 0.125, 0.25, 0.375, 0.5];
  const activeItem = activeIndex === null ? null : items[activeIndex];
  const activePlacement = activeIndex === null ? null : placements.get(activeIndex);
  const tooltipLeft = activePlacement
    ? `${clamp((activePlacement.x / BINARY_SWARM_WIDTH) * 100, 18, 82)}%`
    : '50%';
  const tooltipTop = activePlacement
    ? `${clamp((activePlacement.y / BINARY_SWARM_HEIGHT) * 100, 18, 82)}%`
    : '50%';

  if (items.length === 0) {
    return <p className={styles.vizFallback}>Visualization has no binary questions.</p>;
  }

  return (
    <section className={`${styles.vizCard} ${styles.binaryBeeswarmCard}`} aria-label={title}>
      <VizHeader title={title} subtitle={subtitle} hidden={hideHeader} />
      <div className={styles.binaryBeeswarmFrame}>
        <svg
          className={styles.binaryBeeswarmSvg}
          viewBox={`0 0 ${BINARY_SWARM_WIDTH} ${BINARY_SWARM_HEIGHT}`}
          role="img"
          aria-label={title}
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor={RESPONSE_TONE_COLORS.agree} />
              <stop offset="48%" stopColor={RESPONSE_TONE_COLORS.unsure} />
              <stop offset="100%" stopColor="#ff6bcb" />
            </linearGradient>
          </defs>
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
            stroke={`url(#${gradientId})`}
          />
          {ticks.map((tick) => {
            const x = getBinarySwarmX(tick);
            return (
              <line
                key={tick}
                className={styles.binaryBeeswarmTick}
                x1={x}
                y1={BINARY_SWARM_TOP - 8}
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
            const confidenceLabel = item.averageConfidence > 0
              ? `, average confidence: ${formatValue(item.averageConfidence)}/100`
              : '';
            const promptLabel = item.prompt || item.label;
            const ariaLabel = `${promptLabel}: ${countsLabel}${confidenceLabel}`;
            const isActive = activeIndex === index;
            const showTooltip = () => setActiveIndex(index);
            const hideTooltip = () => setActiveIndex(null);
            return (
              <g
                key={`${item.label}-${index}`}
                className={`${styles.binaryBeeswarmPoint} ${isActive ? styles.binaryBeeswarmPointActive : ''}`}
                tabIndex={0}
                aria-label={ariaLabel}
                aria-describedby={isActive ? tooltipId : undefined}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
              >
                <circle
                  className={styles.binaryBeeswarmHitArea}
                  cx={placement.x}
                  cy={placement.y}
                  r={18}
                  fill="transparent"
                  onMouseEnter={showTooltip}
                  onMouseLeave={hideTooltip}
                />
                <circle
                  className={styles.binaryBeeswarmDot}
                  cx={placement.x}
                  cy={placement.y}
                  r={8.5}
                  fill={item.color}
                  onMouseEnter={showTooltip}
                  onMouseLeave={hideTooltip}
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
            className={styles.binaryBeeswarmTooltip}
            style={{ left: tooltipLeft, top: tooltipTop }}
          >
            <strong>{activeItem.label}</strong>
            {activeItem.prompt && activeItem.prompt !== activeItem.label && <p>{activeItem.prompt}</p>}
            <span>{formatBinaryCountsLabel(activeItem.counts)}</span>
            {activeItem.averageConfidence > 0 && (
              <span>Average confidence: {formatValue(activeItem.averageConfidence)}/100</span>
            )}
          </div>
        )}
      </div>
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
      <VizHeader title={title} subtitle={subtitle} hidden={hideHeader} />
      <div className={styles.responseTypeGrid}>
        {panels.map((panel) => {
          const maxValue = Math.max(...panel.counts.map((count) => count.value), 1);
          const displayAsNumbers = panel.display === 'numbers' || panel.display === 'metrics';
          const displayAsPie = panel.display === 'pie';
          const displayAsSplit = !displayAsNumbers && !displayAsPie && isResponseSplitPanel(panel);
          const pie = displayAsPie ? buildPieGradient(panel.counts) : null;
          const splitCounts = displayAsSplit ? orderedResponseSplitCounts(panel.counts) : [];
          const splitTotal = splitCounts.reduce((sum, count) => sum + count.value, 0);
          const visibleTitle = displayAsSplit && panel.prompt ? panel.prompt : panel.title;
          const visiblePrompt = displayAsSplit && panel.prompt ? '' : panel.prompt;
          return (
            <article key={`${panel.kind}-${panel.title}`} className={styles.responseTypePanel}>
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
                  />
                  <div className={styles.responsePieLegend}>
                    {panel.counts.map((count) => (
                      <div key={count.label} className={styles.responsePieLegendItem}>
                        <span className={styles.responsePieSwatch} style={{ backgroundColor: count.color }} />
                        <span>{count.label}</span>
                        <strong>{formatValue(count.value)}</strong>
                      </div>
                    ))}
                    <p>{formatValue(pie.total)} total</p>
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
                      {quote.label && <figcaption>{quote.label}</figcaption>}
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
};

type PostVizProps = {
  spec: unknown;
  error?: string;
  defaultOpen?: boolean;
  nested?: boolean;
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

const renderVizBody = (record: VizRecord, type: string) => {
  if (type === 'category-dots') return <CategoryDotsViz spec={record} hideHeader />;
  if (type === 'quote-wall') return <QuoteWallViz spec={record} hideHeader />;
  if (type === 'ranked-themes') return <RankedThemesViz spec={record} hideHeader />;
  if (type === 'theme-network') return <ThemeNetworkViz spec={record} hideHeader />;
  if (type === 'beeswarm') return <BeeswarmViz spec={record} hideHeader />;
  if (type === 'binary-beeswarm') return <BinaryBeeswarmViz spec={record} hideHeader />;
  if (type === 'response-type-grid') return <ResponseTypeGridViz spec={record} hideHeader />;

  return <p className={styles.vizFallback}>Unsupported visualization type: {type}</p>;
};

const PostViz = ({
  spec,
  error = '',
  defaultOpen = true,
  nested = false,
}: PostVizProps) => {
  if (error) {
    return <p className={styles.vizFallback}>Visualization JSON is invalid.</p>;
  }

  const record = asRecord(spec);
  const type = toText(record?.type);
  if (!record || !type) {
    return <p className={styles.vizFallback}>Visualization block is missing a type.</p>;
  }

  const title = toText(record.title) || getFallbackTitle(type);
  const inline = toBoolean(record.inline);

  if (inline) {
    return <div className={styles.vizInlineContent}>{renderVizBody(record, type)}</div>;
  }

  return (
    <details
      className={`${styles.vizDisclosure} ${nested ? styles.vizDisclosureNested : ''}`}
      open={defaultOpen}
    >
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
