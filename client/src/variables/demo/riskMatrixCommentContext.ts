import corpusSample from './corpus_sample.json';
import riskMatrixCommentContextData from './riskMatrixCommentContext.json';

export type RiskMatrixHistoricalFigure = {
  name: string;
  role?: string;
};

export type RiskMatrixCorpusRef = {
  corpusId?: string;
  label: string;
  note?: string;
  url?: string;
};

type RiskMatrixCommentContextEntry = {
  historicalFigure?: RiskMatrixHistoricalFigure | null;
  corpusRefs?: RiskMatrixCorpusRef[];
};

type RiskMatrixCommentContextData = {
  SUBCATEGORY_CONTEXT?: Record<string, RiskMatrixCommentContextEntry>;
  CATEGORY_CONTEXT?: Record<string, RiskMatrixCommentContextEntry>;
  CONTEXT_CATEGORY_PRIORITY?: string[];
};

type EnrichableRiskCommentRecord = {
  cell: string;
  historicalFigure?: RiskMatrixHistoricalFigure | null;
  corpusRefs?: RiskMatrixCorpusRef[];
};

type CorpusEntryRecord = {
  author?: unknown;
  title?: unknown;
  summary?: unknown;
  url?: unknown;
};

type CorpusMetaRecord = {
  label?: unknown;
};

type CorpusRecord = {
  entries?: unknown;
};

type CorpusSampleData = {
  meta?: {
    corpuses?: Record<string, CorpusMetaRecord>;
  };
  corpuses?: Record<string, CorpusRecord>;
};

type UnknownRecord = Record<string, unknown>;

type CorpusRefInput = {
  corpusId?: unknown;
  label?: unknown;
  note?: unknown;
  url?: unknown;
};

const {
  SUBCATEGORY_CONTEXT = {},
  CATEGORY_CONTEXT = {},
  CONTEXT_CATEGORY_PRIORITY = [],
} = riskMatrixCommentContextData as RiskMatrixCommentContextData;

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null
);

const isCorpusEntryRecord = (value: unknown): value is CorpusEntryRecord => isRecord(value);

const corpusSampleData = corpusSample as CorpusSampleData;

const RISK_MATRIX_CORPUS_LABEL_BY_ID = Object.freeze(
  Object.entries(corpusSampleData.meta?.corpuses || {}).reduce((acc, [corpusId, corpusEntry]) => {
    const label = hasText(corpusEntry.label)
      ? corpusEntry.label.trim()
      : '';
    if (label) acc[corpusId] = label;
    return acc;
  }, {} as Record<string, string>)
);

const normalizeCorpusUrl = (value: unknown = '') => String(value || '').trim().replace(/\/+$/g, '');

const CORPUS_ENTRY_BY_URL = Object.freeze(
  Object.entries(corpusSampleData.corpuses || {}).reduce((acc, [corpusId, corpusEntry]) => {
    const entries = Array.isArray(corpusEntry.entries)
      ? corpusEntry.entries.filter(isCorpusEntryRecord)
      : [];

    entries.forEach((entry) => {
      const normalizedUrl = normalizeCorpusUrl(entry?.url || '');
      if (normalizedUrl && !acc[normalizedUrl]) {
        acc[normalizedUrl] = {
          corpusId,
          entry,
        };
      }
    });

    return acc;
  }, {} as Record<string, { corpusId: string; entry: CorpusEntryRecord }>)
);

const isValidCorpusRef = (ref: unknown): ref is CorpusRefInput => (
  isRecord(ref)
  && (hasText(ref.label) || hasText(ref.corpusId))
);

const normalizeCorpusRefs = (refs: unknown): RiskMatrixCorpusRef[] => {
  if (!Array.isArray(refs)) return [];

  return refs
    .filter(isValidCorpusRef)
    .map((ref) => {
      const rawCorpusId = hasText(ref.corpusId) ? ref.corpusId.trim() : '';
      const corpusId = hasText(RISK_MATRIX_CORPUS_LABEL_BY_ID[rawCorpusId]) ? rawCorpusId : '';
      const label = corpusId
        ? RISK_MATRIX_CORPUS_LABEL_BY_ID[corpusId]
        : (hasText(ref.label) ? ref.label.trim() : '');

      if (!label) return null;

      return {
        corpusId: corpusId || undefined,
        label,
        note: hasText(ref.note) ? ref.note.trim() : undefined,
        url: hasText(ref.url) ? ref.url.trim() : undefined,
      };
    })
    .filter(Boolean) as RiskMatrixCorpusRef[];
};

const uniqueRefs = (refs: RiskMatrixCorpusRef[] = []) => {
  const seen = new Set<string>();

  return refs.filter((ref) => {
    const key = `${ref.corpusId || ''}::${ref.label}::${ref.note || ''}::${ref.url || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getContextEntry = (key = '', source: Record<string, RiskMatrixCommentContextEntry> = {}) => {
  if (!hasText(key)) return null;
  return source[key] || null;
};

const compactSourceText = (value = '', maxLength = 120) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}\u2026`;
};

const getSpecificCorpusCitation = (ref: RiskMatrixCorpusRef): string | null => {
  const normalizedUrl = normalizeCorpusUrl(ref?.url || '');
  if (!normalizedUrl) return null;

  const resolvedEntry = CORPUS_ENTRY_BY_URL[normalizedUrl];
  if (!resolvedEntry) return null;

  const corpusId = String(resolvedEntry.corpusId || '').trim();
  const entry = resolvedEntry.entry || {};
  const author = hasText(entry.author) ? entry.author.trim() : '';
  const title = hasText(entry.title) ? entry.title.trim() : '';
  const summary = hasText(entry.summary) ? entry.summary.trim() : '';

  if (corpusId === 'tweets') {
    const tweetLine = [author, summary].filter(Boolean).join(' — ');
    return hasText(tweetLine) ? compactSourceText(tweetLine, 132) : null;
  }

  const documentLine = [author, title || summary].filter(Boolean).join(' — ');
  return hasText(documentLine) ? compactSourceText(documentLine) : null;
};

export const getRiskMatrixCorpusSourceCitations = (refs: RiskMatrixCorpusRef[] = []) => {
  const seen = new Set<string>();

  return refs.reduce<string[]>((acc, ref) => {
    const citation = getSpecificCorpusCitation(ref);
    if (!citation || seen.has(citation)) return acc;
    seen.add(citation);
    acc.push(citation);
    return acc;
  }, []);
};

export const enrichRiskMatrixCommentRecord = <T extends EnrichableRiskCommentRecord>(
  entry: T
): T & {
  historicalFigure: RiskMatrixHistoricalFigure | null;
  corpusRefs: RiskMatrixCorpusRef[];
} => {
  const [categoryX, subcategoryX, categoryY, subcategoryY] = String(entry?.cell || '').split('.');
  const categoryXRank = CONTEXT_CATEGORY_PRIORITY.indexOf(categoryX);
  const categoryYRank = CONTEXT_CATEGORY_PRIORITY.indexOf(categoryY);
  const chooseYFirst = categoryYRank !== -1 && (categoryXRank === -1 || categoryYRank < categoryXRank);
  const primarySubcategory = chooseYFirst ? subcategoryY : subcategoryX;
  const secondarySubcategory = chooseYFirst ? subcategoryX : subcategoryY;
  const primaryCategory = chooseYFirst ? categoryY : categoryX;
  const secondaryCategory = chooseYFirst ? categoryX : categoryY;

  const primaryContext = getContextEntry(primarySubcategory, SUBCATEGORY_CONTEXT)
    || getContextEntry(primaryCategory, CATEGORY_CONTEXT);
  const secondaryContext = getContextEntry(secondarySubcategory, SUBCATEGORY_CONTEXT)
    || getContextEntry(secondaryCategory, CATEGORY_CONTEXT);

  const normalizedEntryRefs = normalizeCorpusRefs(entry?.corpusRefs);
  const historicalFigure = entry?.historicalFigure || primaryContext?.historicalFigure || secondaryContext?.historicalFigure || null;
  const corpusRefs = normalizedEntryRefs.length > 0
    ? normalizedEntryRefs
    : uniqueRefs([
      ...normalizeCorpusRefs(primaryContext?.corpusRefs),
      ...normalizeCorpusRefs(secondaryContext?.corpusRefs),
    ]).slice(0, 3);

  return {
    ...entry,
    historicalFigure,
    corpusRefs,
  };
};
