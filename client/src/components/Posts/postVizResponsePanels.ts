type VizRecord = Record<string, unknown>;

export type ResponseCountDatum = {
  label: string;
  value: number;
  color: string;
};

export type ResponseQuoteDatum = {
  label: string;
  text: string;
  color: string;
};

export type ResponsePanelDatum = {
  kind: string;
  title: string;
  prompt: string;
  note: string;
  display: string;
  hideTitle: boolean;
  summaryValue: number | null;
  summarySuffix: string;
  counts: ResponseCountDatum[];
  quotes: ResponseQuoteDatum[];
};

const RESPONSE_SPLIT_ORDER = ['agree', 'unsure', 'disagree'];
const RESPONSE_SPLIT_LABELS = new Set(RESPONSE_SPLIT_ORDER);
const RESPONSE_TONE_COLORS: Record<string, string> = {
  agree: 'var(--ce-status-success)',
  unsure: 'var(--ce-status-warning)',
  disagree: 'var(--ce-status-danger)',
};

const normalizeResponseSplitLabel = (label: string) => label.trim().toLowerCase();

const asRecord = (value: unknown): VizRecord | null =>
  !!value && typeof value === 'object' && !Array.isArray(value) ? (value as VizRecord) : null;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const toText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toBoolean = (value: unknown): boolean => value === true || value === 'true';

export const resolveResponseCountColor = (label: string, value: unknown, fallback: string): string => {
  const color = toText(value);
  return (
    RESPONSE_TONE_COLORS[normalizeResponseSplitLabel(label)] || (/^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback)
  );
};

export const readResponsePanels = (spec: VizRecord, palette: string[]): ResponsePanelDatum[] =>
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
              palette[(panelIndex + countIndex) % palette.length],
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
            color: toText(quoteRecord.color),
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
        summaryValue: toOptionalNumber(record.summaryValue),
        summarySuffix: toText(record.summarySuffix),
        counts,
        quotes,
      };
    })
    .filter((entry): entry is ResponsePanelDatum => !!entry);

export const buildPieGradient = (counts: ResponseCountDatum[]) => {
  const total = counts.reduce((sum, count) => sum + count.value, 0);
  if (total <= 0) {
    return { total: 0, gradient: 'conic-gradient(var(--ce-input-border) 0 100%)' };
  }

  let cursor = 0;
  const segments = counts.map((count) => {
    const start = cursor;
    const end = cursor + (count.value / total) * 100;
    cursor = end;
    return `${count.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  return { total, gradient: `conic-gradient(${segments.join(', ')})` };
};

export const isResponseSplitPanel = (panel: ResponsePanelDatum): boolean => {
  if (panel.display === 'split' || panel.display === 'results-bar') return true;
  if (panel.display || panel.counts.length < 2) return false;
  return panel.counts.every((count) => RESPONSE_SPLIT_LABELS.has(normalizeResponseSplitLabel(count.label)));
};

export const orderedResponseSplitCounts = (counts: ResponseCountDatum[]): ResponseCountDatum[] =>
  [...counts].sort((a, b) => {
    const aIndex = RESPONSE_SPLIT_ORDER.indexOf(normalizeResponseSplitLabel(a.label));
    const bIndex = RESPONSE_SPLIT_ORDER.indexOf(normalizeResponseSplitLabel(b.label));
    return (
      (aIndex === -1 ? RESPONSE_SPLIT_ORDER.length : aIndex) - (bIndex === -1 ? RESPONSE_SPLIT_ORDER.length : bIndex)
    );
  });

export const formatBinaryCountsLabel = (counts: ResponseCountDatum[]): string =>
  orderedResponseSplitCounts(counts)
    .map(
      (count) =>
        `${count.label} ${Math.abs(count.value) >= 10 ? Math.round(count.value) : Number(count.value.toFixed(1))}`,
    )
    .join(', ');
