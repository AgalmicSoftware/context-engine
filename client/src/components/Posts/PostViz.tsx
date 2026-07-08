import React from 'react';
import styles from './PostsPage.module.scss';

type VizRecord = Record<string, unknown>;

const PALETTE = ['#4dffa4', '#7aa7ff', '#ffb347', '#ff6bcb', '#d8f36a', '#9ee7ff'];

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
      <div className={styles.vizHeader}>
        <h3 className={styles.vizTitle}>{title}</h3>
        {subtitle && <p className={styles.vizSubtitle}>{subtitle}</p>}
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

const ResponseTypeGridViz = ({ spec }: { spec: VizRecord }) => {
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
