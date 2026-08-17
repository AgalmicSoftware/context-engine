import React from 'react';
import styles from './PostsPage.module.scss';

type VizRecord = Record<string, unknown>;
type VizProps = { spec: VizRecord; hideHeader?: boolean };

const PALETTE = [
  'var(--ce-data-series-1)',
  'var(--ce-data-series-2)',
  'var(--ce-data-series-3)',
  'var(--ce-data-series-4)',
  'var(--ce-data-series-5)',
  'var(--ce-data-series-6)',
];
const asRecord = (value: unknown): VizRecord | null =>
  !!value && typeof value === 'object' && !Array.isArray(value) ? (value as VizRecord) : null;
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const toText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
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
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    parts.push(<strong key={`bold-${match.index}`}>{match[1]}</strong>);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
};

const VizHeader = ({ title, subtitle, hidden }: { title: string; subtitle: string; hidden: boolean }) => {
  if (hidden && !subtitle) return null;
  return (
    <div className={styles.vizHeader}>
      {!hidden && <h3 className={styles.vizTitle}>{title}</h3>}
      {subtitle && <p className={styles.vizSubtitle}>{renderFormattedText(subtitle)}</p>}
    </div>
  );
};

export const CategoryDotsViz = ({ spec, hideHeader = false }: VizProps) => {
  const title = toText(spec.title) || 'Distribution';
  const subtitle = toText(spec.subtitle);
  const suffix = toText(spec.valueSuffix);
  const dotUnit = Math.max(1, toNumber(spec.dotUnit, 1));
  const categories = asArray(spec.categories)
    .map((entry, index) => {
      const record = asRecord(entry);
      const label = toText(record?.label);
      return record && label
        ? {
            label,
            value: Math.max(0, toNumber(record.value)),
            detail: toText(record.detail),
            color: toSafeColor(record.color, PALETTE[index % PALETTE.length]),
          }
        : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);

  if (categories.length === 0) return <p className={styles.vizFallback}>Visualization has no categories.</p>;

  return (
    <section className={styles.vizCard} aria-label={title}>
      <VizHeader title={title} subtitle={subtitle} hidden={hideHeader} />
      <div className={styles.categoryViz}>
        {categories.map((category) => (
          <div key={category.label} className={styles.categoryRow}>
            <div className={styles.categoryMeta}>
              <span className={styles.categoryLabel}>{category.label}</span>
              <span className={styles.categoryValue} style={{ color: category.color }}>
                {formatValue(category.value, suffix)}
              </span>
            </div>
            <div className={styles.dotGrid} aria-label={`${category.label}: ${formatValue(category.value, suffix)}`}>
              {Array.from({ length: Math.max(1, Math.min(160, Math.round(category.value / dotUnit))) }).map(
                (_, index) => (
                  <span
                    key={`${category.label}-${index}`}
                    className={styles.dot}
                    style={{ backgroundColor: category.color }}
                  />
                ),
              )}
            </div>
            {category.detail && <p className={styles.categoryDetail}>{category.detail}</p>}
          </div>
        ))}
      </div>
    </section>
  );
};

export const QuoteWallViz = ({ spec, hideHeader = false }: VizProps) => {
  const title = toText(spec.title) || 'Voices';
  const subtitle = toText(spec.subtitle);
  const quotes = asArray(spec.quotes)
    .map((entry) => {
      const record = asRecord(entry);
      const text = toText(record?.text);
      return record && text ? { text, label: toText(record.label) } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);

  if (quotes.length === 0) return <p className={styles.vizFallback}>Visualization has no quotes.</p>;

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

export const RankedThemesViz = ({ spec, hideHeader = false }: VizProps) => {
  const title = toText(spec.title) || 'Ranked themes';
  const subtitle = toText(spec.subtitle);
  const suffix = toText(spec.valueSuffix) || '%';
  const items = asArray(spec.items || spec.categories)
    .map((entry, index) => {
      const record = asRecord(entry);
      const label = toText(record?.label);
      return record && label
        ? {
            rank: toText(record.rank) || String(index + 1).padStart(2, '0'),
            label,
            value: Math.max(0, toNumber(record.value)),
            summary: toText(record.summary || record.detail),
            quote: toText(record.quote),
            source: toText(record.source),
            color: toSafeColor(record.color, PALETTE[index % PALETTE.length]),
          }
        : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  if (items.length === 0) return <p className={styles.vizFallback}>Visualization has no ranked themes.</p>;

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

export const ThemeNetworkViz = ({ spec, hideHeader = false }: VizProps) => {
  const title = toText(spec.title) || 'Theme network';
  const subtitle = toText(spec.subtitle);
  const nodes = asArray(spec.nodes)
    .map((entry, index) => {
      const record = asRecord(entry);
      const label = toText(record?.label);
      const id = toText(record?.id) || label;
      return record && id && label
        ? {
            id,
            label,
            value: Math.max(1, toNumber(record.value, 1)),
            x: clamp(toNumber(record.x, 50), 8, 92),
            y: clamp(toNumber(record.y, 32), 8, 56),
            detail: toText(record.detail),
            color: toSafeColor(record.color, PALETTE[index % PALETTE.length]),
          }
        : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const links = asArray(spec.links)
    .map((entry) => {
      const record = asRecord(entry);
      const source = toText(record?.source);
      const target = toText(record?.target);
      return record && nodesById.has(source) && nodesById.has(target)
        ? { source, target, strength: clamp(toNumber(record.strength, 0.5), 0.1, 1) }
        : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);
  const maxValue = Math.max(...nodes.map((node) => node.value), 1);
  const reactId = React.useId().replace(/:/g, '');
  const highlightId = `theme-network-node-highlight-${reactId}`;
  const shadowId = `theme-network-node-shadow-${reactId}`;

  if (nodes.length === 0) return <p className={styles.vizFallback}>Visualization has no network nodes.</p>;

  return (
    <section className={`${styles.vizCard} ${styles.themeNetworkCard}`} aria-label={title}>
      <VizHeader title={title} subtitle={subtitle} hidden={hideHeader} />
      <div className={styles.networkFrame}>
        <svg className={styles.networkCanvas} viewBox="0 0 100 64" role="img" aria-label={title}>
          <defs>
            <radialGradient id={highlightId} cx="30%" cy="30%" r="68%">
              <stop offset="0%" stopColor="color-mix(in srgb, var(--ce-edge-highlight) 68%, transparent)" />
              <stop offset="34%" stopColor="color-mix(in srgb, var(--ce-edge-highlight) 28%, transparent)" />
              <stop offset="72%" stopColor="transparent" />
            </radialGradient>
            <filter id={shadowId} x="-70%" y="-70%" width="240%" height="240%" colorInterpolationFilters="sRGB">
              <feDropShadow dx="0" dy="1.4" stdDeviation="1.5" floodColor="var(--ce-edge-dark)" floodOpacity="0.34" />
            </filter>
          </defs>
          {links.map((link) => {
            const source = nodesById.get(link.source);
            const target = nodesById.get(link.target);
            return source && target ? (
              <line
                key={`${link.source}-${link.target}`}
                className={styles.networkLink}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                strokeWidth={0.25 + link.strength * 1.6}
              />
            ) : null;
          })}
          {nodes.map((node) => {
            const radius = 2.8 + (node.value / maxValue) * 5.5;
            return (
              <g key={node.id}>
                <circle
                  className={styles.networkNodeShadow}
                  cx={node.x}
                  cy={node.y + radius * 0.16}
                  r={radius}
                  filter={`url(#${shadowId})`}
                  aria-hidden="true"
                  pointerEvents="none"
                />
                <circle className={styles.networkNode} cx={node.x} cy={node.y} r={radius} fill={node.color} />
                <circle
                  className={styles.networkNodeHighlight}
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={`url(#${highlightId})`}
                  aria-hidden="true"
                  pointerEvents="none"
                />
                <text className={styles.networkLabel} x={node.x} y={node.y + radius + 4.2} textAnchor="middle">
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
