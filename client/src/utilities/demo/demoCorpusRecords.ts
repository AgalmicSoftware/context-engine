import { getQuestionTagDisplayList } from '../survey/questionTags.js';
import { normalizeTagList } from '../defaultTags.js';

type DemoCorpusEntry = {
  id?: unknown;
  year?: unknown;
  date?: unknown;
  date_enacted?: unknown;
  created_at?: unknown;
  author?: unknown;
  authors?: unknown;
  title?: unknown;
  summary?: unknown;
  text?: unknown;
  novel_arguments_and_concepts?: unknown;
  top_quotes?: unknown;
  tags?: unknown;
  url?: unknown;
  interviewer?: unknown;
  jurisdiction?: unknown;
  venue?: unknown;
  category?: unknown;
};

type DemoCorpus = {
  key?: unknown;
  label?: unknown;
  entries?: unknown;
};

export type DemoCorpusRecord = {
  key: string;
  corpusKey: string;
  corpusLabel: string;
  title: string;
  summary: string;
  url: string;
  metaLine: string;
  tags: string[];
  normalizedTags: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asDemoCorpus = (value: unknown): DemoCorpus => (isRecord(value) ? value : {});
const asDemoCorpusEntry = (value: unknown): DemoCorpusEntry => (isRecord(value) ? value : {});

const normalizeDemoText = (value: unknown = ''): string =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const truncateDemoText = (value: unknown = '', maxLength = 180): string => {
  const normalized = normalizeDemoText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
};

const formatDemoCorpusDate = (entry: DemoCorpusEntry = {}): string => {
  if (entry?.year) return String(entry.year);

  const datedValue = String(entry?.date || entry?.date_enacted || entry?.created_at || '').trim();
  if (!datedValue) return '';
  if (/^\d{4}$/.test(datedValue)) return datedValue;
  if (/^\d{4}-\d{2}$/.test(datedValue)) {
    const monthDate = new Date(`${datedValue}-01T00:00:00Z`);
    if (Number.isNaN(monthDate.getTime())) return datedValue;
    return monthDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  }

  const resolvedDate = new Date(datedValue);
  if (Number.isNaN(resolvedDate.getTime())) return datedValue;

  const formatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(/^\d{4}-\d{2}-\d{2}$/.test(datedValue) || datedValue.includes('T') ? { timeZone: 'UTC' } : {}),
  };
  return resolvedDate.toLocaleDateString('en-US', formatOptions);
};

const formatDemoCorpusAuthors = (entry: DemoCorpusEntry = {}): string => {
  const author = normalizeDemoText(entry?.author);
  if (author) return author;

  const authors = Array.isArray(entry?.authors)
    ? entry.authors.map((value) => normalizeDemoText(value)).filter(Boolean)
    : [];
  if (!authors.length) return '';
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]}, ${authors[1]}`;
  return `${authors[0]} +${authors.length - 1}`;
};

const buildDemoCorpusTitle = (entry: DemoCorpusEntry = {}, corpusLabel = ''): string => {
  const explicitTitle = normalizeDemoText(entry?.title);
  if (explicitTitle) return explicitTitle;

  const summaryTitle = normalizeDemoText(entry?.summary);
  if (summaryTitle) return truncateDemoText(summaryTitle, 140);

  const textTitle = normalizeDemoText(entry?.text);
  if (textTitle) return truncateDemoText(textTitle, 140);

  return `${corpusLabel || 'Demo corpus'} entry`;
};

const buildDemoCorpusSummary = (entry: DemoCorpusEntry = {}, title = ''): string => {
  const titleText = normalizeDemoText(title);
  const explicitTitle = normalizeDemoText(entry?.title);
  const normalizedSummary = normalizeDemoText(entry?.summary);
  const normalizedText = normalizeDemoText(entry?.text);
  const titleUsesSummary = !explicitTitle && !!normalizedSummary;
  const titleUsesText = !explicitTitle && !normalizedSummary && !!normalizedText;

  // If the title was synthesized from summary/text, skip that same source here so
  // the demo corpus cards don't repeat the exact same copy in both slots.
  const candidates = [
    titleUsesSummary ? '' : normalizedSummary,
    titleUsesText ? '' : normalizedText,
    entry?.novel_arguments_and_concepts,
    Array.isArray(entry?.top_quotes) ? entry.top_quotes[0] : '',
  ]
    .map((value) => normalizeDemoText(value))
    .filter(Boolean);

  const summary = candidates.find((value) => value !== titleText) || '';
  return truncateDemoText(summary, 320);
};

export const buildDemoCorpusRecords = (demoCorpuses: unknown = []): DemoCorpusRecord[] => {
  const corpuses = Array.isArray(demoCorpuses) ? demoCorpuses : [];
  const records: DemoCorpusRecord[] = [];

  corpuses.forEach((corpusInput, corpusIndex) => {
    const corpus = asDemoCorpus(corpusInput);
    const entries = Array.isArray(corpus?.entries) ? corpus.entries : [];
    const corpusKey = normalizeDemoText(corpus?.key) || `demo-corpus-${corpusIndex}`;
    const corpusLabel = normalizeDemoText(corpus?.label) || corpusKey.replace(/_/g, ' ');

    entries.forEach((entryInput, entryIndex) => {
      const entry = asDemoCorpusEntry(entryInput);
      const displayTags = getQuestionTagDisplayList(Array.isArray(entry?.tags) ? entry.tags : []);
      const normalizedTags = normalizeTagList(displayTags);
      if (!normalizedTags.length) return;

      const title = buildDemoCorpusTitle(entry, corpusLabel);
      const summary = buildDemoCorpusSummary(entry, title);
      const metaBits = [
        formatDemoCorpusAuthors(entry),
        normalizeDemoText(entry?.interviewer) ? `with ${normalizeDemoText(entry.interviewer)}` : '',
        normalizeDemoText(entry?.jurisdiction),
        normalizeDemoText(entry?.venue),
        normalizeDemoText(entry?.category),
        formatDemoCorpusDate(entry),
      ].filter(Boolean);

      records.push({
        key: `${corpusKey}-${normalizeDemoText(entry?.id) || normalizeDemoText(entry?.url) || `${corpusIndex}-${entryIndex}`}`,
        corpusKey,
        corpusLabel,
        title,
        summary,
        url: normalizeDemoText(entry?.url),
        metaLine: metaBits.join(' • '),
        tags: displayTags,
        normalizedTags,
      });
    });
  });

  return records;
};
