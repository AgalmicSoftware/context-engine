import React from 'react';
import * as d3 from 'd3';

import { clusterUMAPPointsKmeans, doUMAP } from '../../utilities/survey/consensusMath';
import demoData from '../../variables/demo/demo_polis_data.json';
import { CE_DEMO_SESSION_SLUGS, POLIS_DEMO_DATA_AUTOLOAD_SLUGS } from '../../variables/appConfig.js';
import { getChainById } from '../../variables/chains.js';
import { analyzeClusterOpinions } from '../../utilities/ai/aiClient.js';
import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { isResponseAllowedForSessionSlug } from '../../utilities/session/responseSessionScope.js';
import { canonicalizeLegacySessionAlias } from '../../utilities/session/sessionDemoCompat.js';
import { resolveDemoPolisDataset } from '../../utilities/demo/demoPolisDatasets';
import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';
import {
  getHistoricalFigureAvatarOrBlockie,
  getHistoricalFigureBlockie,
} from 'utilities/ui/historicalFigureAvatars.js';
import { createLogger } from 'utilities/logging.js';
import styles from './PolisReport.module.scss';

const surveyLog = createLogger('surveys');

export type UnknownRecord = Record<string, unknown>;
export type StringMap = Record<string, string>;
export type NumberMap = Record<string, number>;
export type BooleanMap = Record<string, boolean>;
export type ConcretePolisVote = -1 | 0 | 1;
export type PolisVote = ConcretePolisVote | null;
export type RatingMatrix = PolisVote[][];
export type EmbeddingChoice = 'UMAP' | 'SVD' | 'POLIS';

export interface PolisResponseRow extends UnknownRecord {
  responder?: string | null;
  questionId?: string | null;
  response?: string | null;
}

export type PolisQuestionResponses = Record<string, PolisResponseRow[]>;

export interface PolisQuestionMeta extends UnknownRecord {
  tags?: unknown[];
  type?: unknown;
  creator?: unknown;
}

export interface PolisSbtEntry extends UnknownRecord {
  name?: string;
  address?: string;
  mintedAddresses?: string[];
  burnedAddresses?: string[];
  mintedCountByAddress?: unknown;
  burnedCountByAddress?: unknown;
  countsLoaded?: boolean;
  countsScanCheckpoint?: unknown;
}

export interface PolisSbtSelection extends UnknownRecord {
  name?: string;
  address: string;
}

export interface PolisSbtFilter extends UnknownRecord {
  selectedSBTGroupsResponder?: PolisSbtSelection[];
  excludedSBTGroupsResponder?: PolisSbtSelection[];
  selectedSBTGroupsCreator?: PolisSbtSelection[];
  excludedSBTGroupsCreator?: PolisSbtSelection[];
  selectedSBTGroups?: PolisSbtSelection[];
  excludedSBTGroups?: PolisSbtSelection[];
}

export interface PolisFilterState extends UnknownRecord {
  selectedTags?: unknown[];
  tag?: string;
  tags?: string | unknown[];
  includeTags?: string | unknown[];
  questionTypes?: unknown[];
  sbtFilter?: PolisSbtFilter | null;
  topQuestions?: {
    count?: unknown;
    by?: unknown;
  };
  onlyVerifiedHumans?: boolean;
}

export interface PolisStats {
  nParticipants: number;
  nComments: number;
  totalVotes: number;
  votesPerVoterAvg: number;
}

export interface PolisPoint extends UnknownRecord {
  x: number;
  y: number;
  index: number;
}

export interface PolisRepresentativeQuestion extends UnknownRecord {
  label: string;
  questionIndex: number;
  prompt: string;
  difference: number | null;
  repfulFor?: string;
}

export type PolisRepQuestionsMap = Record<string, PolisRepresentativeQuestion[]>;

export interface PolisClusterAnalysisResult {
  short: string;
  long: string;
  name?: string;
}

export type PolisAnalysisCacheByCluster = Record<string, PolisClusterAnalysisResult>;
export type PolisAnalysisCacheByKey = Record<string, PolisAnalysisCacheByCluster>;
export type PolisAnalysisErrorsByKey = Record<string, StringMap>;

export interface PrecomputedDemoClusterState {
  clusterCount: number;
  clusterAssignments: number[];
  repQuestions: PolisRepQuestionsMap;
  clusterCollapseState: BooleanMap;
  analysisCacheByClusterIndex: PolisAnalysisCacheByCluster;
  commentStats?: PolisCommentStat[];
}

export interface PolisCommentStat extends UnknownRecord {
  commentIndex: number;
  extremity: number;
  agrees: number;
  disagrees: number;
  unsure?: number;
  total: number;
}

export interface RatingMatrixBuildResult {
  matrix: RatingMatrix | null;
  responders: string[];
  questions: string[];
  promptsMap: StringMap;
  displayNamesMap?: StringMap;
}

export interface PolisReportProps {
  [key: string]: unknown;
  questionResponses?: PolisQuestionResponses | UnknownRecord | null;
  network?: UnknownRecord | null;
  disclaimersActive?: boolean;
  sbtFilterString?: string;
  filterState?: PolisFilterState | null;
  sessionName?: unknown;
  sessionHeader?: unknown;
  sessionInfo?: unknown;
  onePageDemo?: boolean;
  demoMode?: boolean;
  demoDataFirstLoad?: boolean;
  demoDataBySlug?: unknown;
  miniMode?: boolean;
  isQuestionCacheReady?: boolean;
  isResponsesCacheReady?: boolean;
  questionScanProgress?: UnknownRecord | null;
  questionResponsesNonce?: number;
  networkChainId?: number | string | null;
  slug?: string;
  sessionSlug?: string;
}

export type DoUMAPFn = (data: number[][], nNeighbors: number, randomSeed: number) => [number, number][];
export type ClusterPointsFn = (points: PolisPoint[], clusterCount: number, randomSeed: number) => number[];
export type AnalyzeClusterOpinionsFn = (
  payload: UnknownRecord,
  allClustersData: UnknownRecord,
  options: { sessionSlug: string },
) => Promise<Partial<PolisClusterAnalysisResult>>;

export type D3LinearScale = {
  domain(values: [number, number]): {
    range(values: [number, number]): (value: number) => number;
  };
};

export type D3ReportApi = {
  scaleOrdinal(range: readonly string[]): (value: string | number) => string;
  schemeCategory10: readonly string[];
  polygonHull(points: [number, number][]): [number, number][] | null;
  min(values: number[]): number | undefined;
  max(values: number[]): number | undefined;
  scaleLinear(): D3LinearScale;
  line(): (points: [number, number][]) => string | null;
};

export type JsPdfDocument = {
  internal: {
    pageSize: {
      getWidth(): number;
      getHeight(): number;
    };
  };
  addImage(...args: unknown[]): void;
  addPage(): void;
  save(filename: string): void;
};

export type JsPdfConstructor = new (...args: unknown[]) => JsPdfDocument;

export type RuntimeFunction = (...args: unknown[]) => unknown;
const d3Runtime = Object(d3) as Record<string, unknown>;
const getD3Function = (key: string): RuntimeFunction => {
  const fn = d3Runtime[key];
  if (typeof fn !== 'function') {
    throw new Error(`d3.${key} is not available.`);
  }
  return fn as RuntimeFunction;
};
const getD3StringArray = (key: string): readonly string[] => {
  const value = d3Runtime[key];
  if (!Array.isArray(value)) {
    throw new Error(`d3.${key} is not available.`);
  }
  return value.map(String);
};

export const d3Report: D3ReportApi = {
  scaleOrdinal: (range) =>
    Reflect.apply(getD3Function('scaleOrdinal'), d3, [range]) as (value: string | number) => string,
  schemeCategory10: getD3StringArray('schemeCategory10'),
  polygonHull: (points) => Reflect.apply(getD3Function('polygonHull'), d3, [points]) as [number, number][] | null,
  min: (values) => Reflect.apply(getD3Function('min'), d3, [values]) as number | undefined,
  max: (values) => Reflect.apply(getD3Function('max'), d3, [values]) as number | undefined,
  scaleLinear: () => Reflect.apply(getD3Function('scaleLinear'), d3, []) as D3LinearScale,
  line: () => Reflect.apply(getD3Function('line'), d3, []) as (points: [number, number][]) => string | null,
};
export const doUMAPTyped: DoUMAPFn = (data, nNeighbors, randomSeed) =>
  Reflect.apply(doUMAP, null, [data, nNeighbors, randomSeed]) as [number, number][];
export const clusterUMAPPointsKmeansTyped: ClusterPointsFn = (points, clusterCount, randomSeed) =>
  Reflect.apply(clusterUMAPPointsKmeans, null, [points, clusterCount, randomSeed]) as number[];
export const analyzeClusterOpinionsTyped: AnalyzeClusterOpinionsFn = (payload, allClustersData, options) =>
  Reflect.apply(analyzeClusterOpinions, null, [payload, allClustersData, options]) as Promise<
    Partial<PolisClusterAnalysisResult>
  >;
export const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};
export const getErrorMessage = (error: unknown, fallback = 'Unknown error') => {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }
  return fallback;
};

export const sanitizePolisReportPdfNamePart = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.,-]+|[_.,-]+$/g, '')
    .slice(0, 80);

export const buildPolisReportPdfFilename = (sessionName: unknown, now: Date = new Date()): string => {
  const sessionPart = sanitizePolisReportPdfNamePart(sessionName);
  const timestamp = now.toISOString().replace(/[:.-]/g, '_');
  return `contextEngine_report${sessionPart ? `_${sessionPart}` : ''}_${timestamp}.pdf`;
};

export const resolveJsPdfConstructor = (module: unknown): JsPdfConstructor => {
  const record = module && typeof module === 'object' ? (module as UnknownRecord) : {};
  const defaultExport = record.default;
  if (typeof defaultExport === 'function') return defaultExport as JsPdfConstructor;
  if (typeof record.jsPDF === 'function') return record.jsPDF as JsPdfConstructor;
  if (defaultExport && typeof defaultExport === 'object') {
    const defaultRecord = defaultExport as UnknownRecord;
    if (typeof defaultRecord.jsPDF === 'function') return defaultRecord.jsPDF as JsPdfConstructor;
  }
  throw new Error('jsPDF constructor is unavailable');
};

/**************************************************************
 * Helper: parse JSON safely
 **************************************************************/
function safeJsonParse(str: unknown): UnknownRecord | null {
  if (!str) return null;
  try {
    const parsed = JSON.parse(String(str));
    return parsed && typeof parsed === 'object' ? (parsed as UnknownRecord) : null;
  } catch (e) {
    return null;
  }
}

const isPolisDemoFixturePayload = (value: UnknownRecord | null | undefined): boolean =>
  !!value && value.source === 'demo-polis-data';

export function normalizePolisBinaryVote(value: unknown): ConcretePolisVote | null {
  if (value === 1) return 1;
  if (value === -1) return -1;
  if (value === 0) return 0;
  if (value === true) return 1;
  if (value === false) return -1;

  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (
    normalized === 'agree' ||
    normalized === 'yes' ||
    normalized === 'y' ||
    normalized === 'true' ||
    normalized === '1'
  ) {
    return 1;
  }
  if (
    normalized === 'disagree' ||
    normalized === 'no' ||
    normalized === 'n' ||
    normalized === 'false' ||
    normalized === '-1'
  ) {
    return -1;
  }
  if (
    normalized === 'unsure' ||
    normalized === 'unknown' ||
    normalized === 'maybe' ||
    normalized === 'neutral' ||
    normalized === '0'
  ) {
    return 0;
  }
  return null;
}

export const DEFAULT_POLIS_DEMO_DATA = demoData;
export const DEFAULT_EXPLORATORY_CLUSTER_COUNT = 3;
const POLIS_DEMO_CLUSTER_ANALYSIS_VERSION = 2;
// Registry-backed demo pages can reuse the shared Context corpus fixture while
// their question/response storage migrates independently.
const BUILT_IN_POLIS_DEMO_DATASETS_BY_SLUG = Object.freeze(
  (Array.isArray(CE_DEMO_SESSION_SLUGS) ? CE_DEMO_SESSION_SLUGS : ['demo']).reduce<Record<string, unknown>>(
    (acc, rawSlug) => {
      const slug = normalizeSessionSlug(rawSlug);
      if (slug) acc[slug] = resolveDemoPolisDataset(slug, DEFAULT_POLIS_DEMO_DATA);
      return acc;
    },
    { demo: DEFAULT_POLIS_DEMO_DATA },
  ),
);

export function buildPolisDemoDatasetsBySlug(demoDataBySlug: unknown = null) {
  const out: Record<string, unknown> = { ...BUILT_IN_POLIS_DEMO_DATASETS_BY_SLUG };
  if (!demoDataBySlug || typeof demoDataBySlug !== 'object' || Array.isArray(demoDataBySlug)) {
    return out;
  }
  Object.entries(demoDataBySlug).forEach(([rawSlug, value]) => {
    const slug = normalizeSessionSlug(rawSlug);
    if (!slug || !value || typeof value !== 'object') return;
    out[slug] = value;
  });
  return out;
}

function resolvePolisDemoDatasetsBySlug(options: { datasetsBySlug?: unknown; demoDataBySlug?: unknown } = {}) {
  if (options?.datasetsBySlug && typeof options.datasetsBySlug === 'object' && !Array.isArray(options.datasetsBySlug)) {
    return options.datasetsBySlug as Record<string, unknown>;
  }
  return buildPolisDemoDatasetsBySlug(options?.demoDataBySlug);
}

const resolvePolisReadSlugs = (baseSlug: unknown = '') => {
  const normalizedBaseSlug = normalizeSessionSlug(baseSlug);
  return [normalizedBaseSlug];
};

const POLIS_DEMO_AUTOLOAD_SLUG_SET = new Set<string>(
  Array.isArray(POLIS_DEMO_DATA_AUTOLOAD_SLUGS)
    ? POLIS_DEMO_DATA_AUTOLOAD_SLUGS.map((slug: unknown) => normalizeSessionSlug(slug))
    : [],
);

export function getPolisHistoricalParticipantAvatar(displayName: unknown = '', fallbackSeed: unknown = '') {
  const normalizedDisplayName = String(displayName || '').trim();
  if (!normalizedDisplayName) return '';
  return getHistoricalFigureAvatarOrBlockie(normalizedDisplayName, {
    preferBlockie: false,
    fallbackSeed: normalizedDisplayName || String(fallbackSeed || ''),
  });
}

export function getPolisHistoricalParticipantBlockie(displayName: unknown = '', fallbackSeed: unknown = '') {
  const normalizedDisplayName = String(displayName || '').trim();
  if (!normalizedDisplayName) return generateBlockieDataUrl(String(fallbackSeed || '').toLowerCase(), 8, 4);
  return getHistoricalFigureBlockie(normalizedDisplayName, {
    fallbackSeed: normalizedDisplayName || String(fallbackSeed || ''),
  });
}

const SUPERSCRIPT_DIGITS: Record<string, string> = Object.freeze({
  0: '⁰',
  1: '¹',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
});

export function formatSuperscriptNumber(value: unknown) {
  return String(value ?? '')
    .split('')
    .map((char) => SUPERSCRIPT_DIGITS[char] || char)
    .join('');
}

export function hasPolisDemoDatasetForSlug(
  slugIn: unknown = '',
  options: { datasetsBySlug?: unknown; demoDataBySlug?: unknown } = {},
) {
  const datasetsBySlug = resolvePolisDemoDatasetsBySlug(options);
  const slug = normalizeSessionSlug(slugIn);
  if (!slug) return false;
  return Object.prototype.hasOwnProperty.call(datasetsBySlug, slug);
}

export function getPolisDemoDatasetForSlug(
  slugIn: unknown = '',
  options: { datasetsBySlug?: unknown; demoDataBySlug?: unknown; allowFallback?: boolean } = {},
) {
  const datasetsBySlug = resolvePolisDemoDatasetsBySlug(options);
  const allowFallback = options?.allowFallback !== false;
  const slug = normalizeSessionSlug(slugIn);
  if (slug && Object.prototype.hasOwnProperty.call(datasetsBySlug, slug)) return datasetsBySlug[slug];
  return allowFallback ? DEFAULT_POLIS_DEMO_DATA : null;
}

export function shouldAutoEnablePolisDemoData(
  input: {
    slug?: unknown;
    sessionSlug?: unknown;
    demoDataFirstLoad?: boolean;
    datasetsBySlug?: unknown;
    demoDataBySlug?: unknown;
  } = {},
) {
  const slug = normalizeSessionSlug(input?.slug ?? input?.sessionSlug ?? '');
  if (input?.demoDataFirstLoad) {
    return slug === 'demo' || hasPolisDemoDatasetForSlug(slug, input);
  }
  return POLIS_DEMO_AUTOLOAD_SLUG_SET.has(slug) && hasPolisDemoDatasetForSlug(slug, input);
}

export function buildClusterAnalysisDataKey({
  activeClusterAssignments = [],
  activeClusterCount = 0,
  activeRepQuestions = {},
  embeddingChoice = '',
  useDemoData = false,
  questionResponsesNonce = 0,
  questionPrompts = {},
  allQuestions = [],
}: {
  activeClusterAssignments?: number[];
  activeClusterCount?: number;
  activeRepQuestions?: PolisRepQuestionsMap;
  embeddingChoice?: string;
  useDemoData?: boolean;
  questionResponsesNonce?: number;
  questionPrompts?: StringMap;
  allQuestions?: string[];
} = {}) {
  const assignmentHash = (Array.isArray(activeClusterAssignments) ? activeClusterAssignments : []).reduce(
    (acc, val) => {
      return (acc * 31 + (val + 1)) % 1000000007;
    },
    7,
  );
  const promptEntries = Object.entries(questionPrompts || {});
  let promptsHash = 0;
  promptEntries.forEach(([key, value]) => {
    const text = `${key}:${value || ''}`;
    for (let i = 0; i < text.length; i += 31) {
      promptsHash = (promptsHash * 33 + text.charCodeAt(i)) % 1000000007;
    }
  });
  const questionCount = allQuestions?.length || 0;
  const repCount = Object.keys(activeRepQuestions || {}).length;
  // Demo-mode analysis derives from the fixed fixture, so upstream response
  // nonce churn should not invalidate the visible cluster-analysis cache.
  const nonce = useDemoData ? 0 : (questionResponsesNonce ?? 0);

  return `${embeddingChoice}-${activeClusterCount}-${nonce}-${questionCount}-${promptEntries.length}-${repCount}-${assignmentHash}-${promptsHash}`;
}

/**************************************************************
 * Helper: applyFilterStateToAggregator
 * Filters the aggregator BEFORE building the rating matrix.
 * - questionResponses: { [qId]: Array<{ responder, questionId, response }> }
 * - network: chain object (uses network.id to read caches)
 * - filterState: QuestionFilter state from parent (see types in prompt)
 *
 * Returns a pruned aggregator with only filtered question IDs and
 * per-question filtered response arrays.
 *
 * Notes:
 *  - If caches are missing/partial, we skip that filter step gracefully.
 *  - We DO NOT read demo mode here; caller bypasses filtering when demo is on.
 **************************************************************/
export function applyFilterStateToAggregator(
  questionResponses: PolisQuestionResponses | UnknownRecord | null | undefined,
  network: UnknownRecord | null | undefined,
  filterState: PolisFilterState | null | undefined,
  sessionSlug: unknown,
): PolisQuestionResponses {
  if (!questionResponses || typeof questionResponses !== 'object') return {};

  const netId = network?.id != null ? String(network.id) : null;

  // Resolve group slug (optional param -> URL path fallback)
  const resolveSlug = () => {
    if (typeof sessionSlug === 'string') {
      return canonicalizeLegacySessionAlias(sessionSlug);
    }
    try {
      const p =
        typeof window !== 'undefined' && window.location && window.location.pathname ? window.location.pathname : '';
      if (p.startsWith('/session/')) {
        const s = (p.split('/').filter(Boolean)[1] || '').trim();
        if (!s) return '';
        return canonicalizeLegacySessionAlias(s);
      }
    } catch (e) {
      surveyLog.warn('PolisReport: fallback', e);
    }
    return ''; // default to general
  };
  const slug = resolveSlug();
  const readSlugs = resolvePolisReadSlugs(slug);

  // Safe cache reads (group-aware dg:* keys)
  const qMap: Record<string, PolisQuestionMeta> = {};
  const sbtList: Record<string, PolisSbtEntry> = {};
  readSlugs.forEach((readSlug) => {
    const qParsed = peekCacheSync('questionsCache', readSlug, { clone: false });
    const sParsed = peekCacheSync('sbtCache', readSlug, { clone: false });
    const qCache = (qParsed || null) as Record<string, { questions?: Record<string, PolisQuestionMeta> }> | null;
    const sCache = (sParsed || null) as Record<string, { sbtList?: Record<string, PolisSbtEntry> }> | null;
    const scopedQuestions = netId && qCache && qCache[netId] && qCache[netId].questions ? qCache[netId].questions : {};
    const scopedSbtList = netId && sCache && sCache[netId] && sCache[netId].sbtList ? sCache[netId].sbtList : {};

    Object.keys(scopedQuestions).forEach((questionId) => {
      const lowerQuestionId = String(questionId || '').toLowerCase();
      if (!lowerQuestionId || Object.prototype.hasOwnProperty.call(qMap, lowerQuestionId)) return;
      qMap[lowerQuestionId] = scopedQuestions[questionId];
    });
    Object.assign(sbtList, scopedSbtList);
  });

  // ---- Build combined tag set (lowercased) ----
  const combinedTagSet = new Set<string>();
  if (Array.isArray(filterState?.selectedTags)) {
    filterState.selectedTags
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean)
      .forEach((t) => combinedTagSet.add(t));
  }
  // ---- NEW: accept additional tag filter shapes (comma-strings or arrays) ----
  if (typeof filterState?.tag === 'string' && filterState.tag.trim() !== '') {
    filterState.tag
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .forEach((t) => combinedTagSet.add(t));
  }
  if (Array.isArray(filterState?.tags)) {
    filterState.tags
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean)
      .forEach((t) => combinedTagSet.add(t));
  }
  if (typeof filterState?.tags === 'string' && filterState.tags.trim() !== '') {
    filterState.tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .forEach((t) => combinedTagSet.add(t));
  }
  if (Array.isArray(filterState?.includeTags)) {
    filterState.includeTags
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean)
      .forEach((t) => combinedTagSet.add(t));
  }
  if (typeof filterState?.includeTags === 'string' && filterState.includeTags.trim() !== '') {
    filterState.includeTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .forEach((t) => combinedTagSet.add(t));
  }

  // ---- Question types set (lowercased) ----
  const typesSet = new Set<string>(
    Array.isArray(filterState?.questionTypes) ? filterState.questionTypes.map((s) => String(s).toLowerCase()) : [],
  );

  // ---- SBT helpers ----
  const sbtFilter = filterState?.sbtFilter || null;
  const toLowerAddr = (x: unknown) =>
    (x && typeof x === 'object' && 'address' in x ? String(x.address).toLowerCase() : '').trim();
  const normalizeAddressCountMap = (value: unknown = null): NumberMap => {
    const out: NumberMap = {};
    Object.entries(value && typeof value === 'object' ? value : {}).forEach(([addrRaw, countRaw]) => {
      const addr = String(addrRaw || '')
        .toLowerCase()
        .trim();
      if (!addr) return;
      const count = Math.max(0, Math.floor(Number(countRaw || 0)));
      if (count <= 0) return;
      out[addr] = count;
    });
    return out;
  };

  function isAddrInSbt(sbtAddrLower: string, personLower: string) {
    if (!sbtAddrLower || !personLower) return false;
    const entry = sbtList[sbtAddrLower];
    if (!entry) return false;
    const checkpointBackedPartialCounts =
      entry?.countsLoaded !== true && !!entry?.countsScanCheckpoint && typeof entry.countsScanCheckpoint === 'object';
    const mintedCountMap = normalizeAddressCountMap(entry.mintedCountByAddress);
    const burnedCountMap = normalizeAddressCountMap(entry.burnedCountByAddress);
    if (
      !checkpointBackedPartialCounts &&
      (Object.keys(mintedCountMap).length > 0 || Object.keys(burnedCountMap).length > 0)
    ) {
      return Number(mintedCountMap[personLower] || 0) > Number(burnedCountMap[personLower] || 0);
    }
    if (checkpointBackedPartialCounts) return false;
    const minted = Array.isArray(entry.mintedAddresses) ? entry.mintedAddresses : [];
    const burned = Array.isArray(entry.burnedAddresses) ? entry.burnedAddresses : [];
    const inMinted = minted.includes(personLower);
    const inBurned = burned.includes(personLower);
    return inMinted && !inBurned;
  }

  function isMemberOfAny(personLower: string, groupListLower: string[]) {
    if (!personLower || !Array.isArray(groupListLower) || groupListLower.length === 0) return false;
    for (const g of groupListLower) {
      if (!g) continue;
      if (isAddrInSbt(g, personLower)) return true;
    }
    return false;
  }

  // Responder SBT lists (new + legacy)
  const incResponderGroupsLower = [
    ...(Array.isArray(sbtFilter?.selectedSBTGroupsResponder) ? sbtFilter.selectedSBTGroupsResponder : []),
    ...(Array.isArray(sbtFilter?.selectedSBTGroups) ? sbtFilter.selectedSBTGroups : []),
  ]
    .map(toLowerAddr)
    .filter(Boolean);

  const excResponderGroupsLower = [
    ...(Array.isArray(sbtFilter?.excludedSBTGroupsResponder) ? sbtFilter.excludedSBTGroupsResponder : []),
    ...(Array.isArray(sbtFilter?.excludedSBTGroups) ? sbtFilter.excludedSBTGroups : []),
  ]
    .map(toLowerAddr)
    .filter(Boolean);

  // Creator SBT lists (new only)
  const incCreatorGroupsLower = Array.isArray(sbtFilter?.selectedSBTGroupsCreator)
    ? sbtFilter.selectedSBTGroupsCreator.map(toLowerAddr).filter(Boolean)
    : [];
  const excCreatorGroupsLower = Array.isArray(sbtFilter?.excludedSBTGroupsCreator)
    ? sbtFilter.excludedSBTGroupsCreator.map(toLowerAddr).filter(Boolean)
    : [];

  // --- Build filtered aggregator ---
  let filteredAgg: PolisQuestionResponses = {};

  Object.entries(questionResponses).forEach(([qId, arr]) => {
    const qIdLower = String(qId || '').toLowerCase();

    // Question metadata (may be missing)
    const qMeta = qMap[qIdLower] || null;
    const qTagsLower = Array.isArray(qMeta?.tags) ? qMeta.tags.map((t) => String(t).toLowerCase()) : null;
    const qTypeLower = qMeta?.type ? String(qMeta.type).toLowerCase() : null;
    const creatorLower = qMeta?.creator ? String(qMeta.creator).toLowerCase() : null;

    // 1) Tags: if we have tags in cache AND combined set is non-empty, require intersection.
    if (combinedTagSet.size > 0 && Array.isArray(qTagsLower) && qTagsLower.length > 0) {
      const hasAny = qTagsLower.some((t) => combinedTagSet.has(t));
      if (!hasAny) return; // skip this question
    }
    // If tags missing from cache, skip gating (graceful).

    // 2) Types: if provided AND we know the type, require it to match; if unknown type, skip gating.
    if (typesSet.size > 0 && qTypeLower && !typesSet.has(qTypeLower)) {
      return;
    }

    // 3) Creator SBT rules: gate entire question
    if (incCreatorGroupsLower.length > 0) {
      // If creator unknown, skip gating (do NOT drop due to cache miss).
      if (creatorLower) {
        const ok = isMemberOfAny(creatorLower, incCreatorGroupsLower);
        if (!ok) return;
      }
    }
    if (excCreatorGroupsLower.length > 0) {
      if (creatorLower) {
        const bad = isMemberOfAny(creatorLower, excCreatorGroupsLower);
        if (bad) return;
      }
    }

    // 4) Responder SBT rules: filter per-response
    const nextArr: PolisResponseRow[] = [];
    const originalArr = Array.isArray(arr) ? (arr as PolisResponseRow[]) : [];
    for (const respObj of originalArr) {
      const responderLower = respObj?.responder ? String(respObj.responder).toLowerCase() : '';
      if (!responderLower) continue;

      // Inclusion lists (union): if present, responder must be in at least one
      if (incResponderGroupsLower.length > 0) {
        if (!isMemberOfAny(responderLower, incResponderGroupsLower)) {
          continue;
        }
      }
      // Exclusion lists (union): drop if responder is in any excluded group
      if (excResponderGroupsLower.length > 0) {
        if (isMemberOfAny(responderLower, excResponderGroupsLower)) {
          continue;
        }
      }
      nextArr.push(respObj);
    }

    if (nextArr.length > 0) {
      filteredAgg[qId] = nextArr;
    }
  });

  // 5) Top questions (after the above)
  const top = filterState?.topQuestions;
  const topCount = Number(top?.count || 0);
  const topBy =
    top?.by === 'responses' ? 'responses' : top?.by === 'conviction' || top?.by === 'importance' ? 'importance' : null;

  if (topBy && topCount > 0) {
    const scored = Object.entries(filteredAgg).map(([qId, arr]) => {
      let score = 0;
      for (const r of arr) {
        const parsed = safeJsonParse(r?.response);
        if (!parsed) continue;
        if (isPolisDemoFixturePayload(parsed)) continue;
        // We only consider binary answers here to align with rating-matrix & spec
        if (parsed.type !== 'binary') continue;
        const answer = asRecord(parsed.answer);
        if (answer.encrypted) continue;

        if (topBy === 'responses') {
          if (normalizePolisBinaryVote(answer.value) !== null) {
            score += 1;
          }
        } else {
          const imp = Number(parsed?.conviction ?? parsed?.importance ?? 0);
          if (!Number.isNaN(imp)) score += imp;
        }
      }
      return { qId, score };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    const keep = scored.slice(0, Math.min(topCount, scored.length)).map((s) => s.qId);
    const keepSet = new Set(keep);

    const limited: PolisQuestionResponses = {};
    Object.keys(filteredAgg).forEach((qid) => {
      if (keepSet.has(qid)) limited[qid] = filteredAgg[qid];
    });
    filteredAgg = limited;
  }

  // onlyVerifiedHumans: If true but no SBT constraints exist, no-op per spec.
  // (If there is already an SBT include list for humans, it's already applied above.)

  return filteredAgg;
}

/***************************************************************
 * Build rating matrix from real or from the included demo
 *
 * We only consider question responses of type 'binary'.
 *   That means we only parse if r.response has { type: 'binary' } and
 *   answer { value: 'Agree' | 'Disagree' | 'Unsure' }, including
 *   legacy yes/no/0/1 encodings from older response payloads.
 ***************************************************************/
function isPolisRealRowAllowedForSession(
  row: PolisResponseRow,
  parsedResponse: UnknownRecord | null,
  sessionSlug: unknown = '',
): boolean {
  return (
    isResponseAllowedForSessionSlug(row, sessionSlug) && isResponseAllowedForSessionSlug(parsedResponse, sessionSlug)
  );
}

export function buildRatingMatrixFromRealData(
  realQR: PolisQuestionResponses | UnknownRecord,
  options: { sessionSlug?: unknown } = {},
): RatingMatrixBuildResult {
  if (!realQR || typeof realQR !== 'object') {
    return { matrix: null, responders: [], questions: [], promptsMap: {} };
  }
  const sessionSlug = options.sessionSlug || '';

  // Collect binary questions deterministically and gather prompts
  const participantsSet = new Set<string>();
  const binaryQuestions: Array<{ qId: string; prompt: string }> = [];
  const promptsMap: StringMap = {};

  Object.entries(realQR).forEach(([qId, arr]) => {
    if (!Array.isArray(arr) || arr.length === 0) return;

    // Find the first parsed response with a declared type to decide if it's binary
    let firstType: unknown = null;
    let firstPrompt: unknown = null;
    for (const r of arr) {
      const parsed = safeJsonParse(r?.response);
      if (isPolisDemoFixturePayload(parsed)) continue;
      if (!isPolisRealRowAllowedForSession(r, parsed, sessionSlug)) continue;
      if (parsed && typeof parsed === 'object' && parsed.type) {
        firstType = parsed.type;
        firstPrompt = parsed.prompt || '(No prompt)';
        break;
      }
    }
    if (firstType !== 'binary') return; // we only include binary questions

    binaryQuestions.push({ qId, prompt: String(firstPrompt || '(No prompt)') });
    promptsMap[qId] = String(firstPrompt || '(No prompt)');

    // Gather participants who answered this (binary) question
    for (const r of arr) {
      const parsed = safeJsonParse(r?.response);
      if (isPolisDemoFixturePayload(parsed)) continue;
      if (!isPolisRealRowAllowedForSession(r, parsed, sessionSlug)) continue;
      if (r?.responder) {
        participantsSet.add(String(r.responder).toLowerCase());
      }
    }
  });

  // No usable questions or participants => bail out
  if (binaryQuestions.length === 0 || participantsSet.size === 0) {
    return { matrix: null, responders: [], questions: [], promptsMap: {} };
  }

  // Deterministic ordering
  const questionsSorted = binaryQuestions.map(({ qId }) => qId).sort((a, b) => String(a).localeCompare(String(b)));

  const respondersSorted = Array.from(participantsSet).sort((a, b) => String(a).localeCompare(String(b)));

  // Build index maps
  const questionIndexMap: NumberMap = {};
  questionsSorted.forEach((qId, idx) => {
    questionIndexMap[qId] = idx;
  });

  const participantIndexMap: NumberMap = {};
  respondersSorted.forEach((addr, idx) => {
    participantIndexMap[addr] = idx;
  });

  // Initialize matrix [nQuestions x nParticipants] with nulls
  const numQ = questionsSorted.length;
  const numP = respondersSorted.length;
  const matrix: RatingMatrix = Array.from({ length: numQ }, () => Array(numP).fill(null));

  // Fill matrix with -1 / 0 / 1 for Disagree / Unsure / Agree
  questionsSorted.forEach((qId) => {
    const rowIndex = questionIndexMap[qId];
    const arr = Array.isArray(realQR[qId]) ? (realQR[qId] as PolisResponseRow[]) : [];
    for (const r of arr) {
      const parsed = safeJsonParse(r?.response);
      if (!parsed || parsed.type !== 'binary') continue;
      if (isPolisDemoFixturePayload(parsed)) continue;
      if (!isPolisRealRowAllowedForSession(r, parsed, sessionSlug)) continue;
      const answer = asRecord(parsed.answer);
      if (answer.encrypted) continue;

      const val: PolisVote = normalizePolisBinaryVote(answer.value);

      const pIdx = participantIndexMap[String(r?.responder || '').toLowerCase()];
      if (pIdx !== undefined) {
        matrix[rowIndex][pIdx] = val;
      }
    }
  });

  return {
    matrix,
    responders: respondersSorted,
    questions: questionsSorted,
    promptsMap,
  };
}

export function buildRatingMatrixFromDemo(demoDataSource: unknown = DEFAULT_POLIS_DEMO_DATA): RatingMatrixBuildResult {
  const demoRecord = demoDataSource && typeof demoDataSource === 'object' ? (demoDataSource as UnknownRecord) : {};
  const commentsArr = Array.isArray(demoRecord.comments) ? (demoRecord.comments as UnknownRecord[]) : [];
  const participantsArr = Array.isArray(demoRecord.participantsVotes)
    ? (demoRecord.participantsVotes as UnknownRecord[])
    : [];

  if (!commentsArr.length || !participantsArr.length) {
    return { matrix: null, responders: [], questions: [], promptsMap: {}, displayNamesMap: {} };
  }

  const binaryComments = commentsArr.filter((c) => {
    const t = String(c?.type || '')
      .trim()
      .toLowerCase();
    return !t || t === 'binary';
  });
  const binaryOriginalIndices: number[] = [];
  commentsArr.forEach((c, i) => {
    const t = String(c?.type || '')
      .trim()
      .toLowerCase();
    if (!t || t === 'binary') binaryOriginalIndices.push(i);
  });

  const promptsMap: StringMap = {};
  const questionList: string[] = [];
  binaryComments.forEach((comment) => {
    const commentId = String(comment.commentId || '');
    questionList.push(commentId);
    promptsMap[commentId] = String(comment.commentBody || '(No prompt)');
  });

  const participantsSet = new Set<string>();
  participantsArr.forEach((p) => {
    participantsSet.add(String(p.participant || ''));
  });

  const participantArray = Array.from(participantsSet);
  const participantIndexMap: NumberMap = {};
  participantArray.forEach((addr, i) => {
    participantIndexMap[addr] = i;
  });

  // Build display names map from xid field (e.g. historical figure usernames)
  const displayNamesMap: StringMap = {};
  participantsArr.forEach((p) => {
    if (p.xid && p.participant) {
      displayNamesMap[String(p.participant)] = String(p.xid);
    }
  });

  const numC = binaryComments.length;
  const numP = participantArray.length;
  const matrix: RatingMatrix = [];
  for (let i = 0; i < numC; i++) {
    matrix.push(new Array(numP).fill(null));
  }

  participantsArr.forEach((p) => {
    const pIdx = participantIndexMap[String(p.participant || '')];
    if (pIdx === undefined) return;
    const vs = p.votes && typeof p.votes === 'object' ? (p.votes as UnknownRecord) : {};
    binaryOriginalIndices.forEach((origIdx, filteredIdx) => {
      const val = vs[String(origIdx)];
      if ((val === 1 || val === 0 || val === -1 || val === null) && filteredIdx < numC) {
        matrix[filteredIdx][pIdx] = val;
      }
    });
  });

  return {
    matrix,
    responders: participantArray,
    questions: questionList,
    promptsMap,
    displayNamesMap,
  };
}

export const resolvePrecomputedClusterDifference = (
  differenceFromData: unknown,
  clusterAgreeRate: unknown,
  overallAgreeRate: unknown,
): number | null => {
  const toFiniteNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const difference = toFiniteNumber(differenceFromData);
  if (difference !== null) return difference;
  const clusterRate = toFiniteNumber(clusterAgreeRate);
  const overallRate = toFiniteNumber(overallAgreeRate);
  if (clusterRate === null || overallRate === null) return null;
  return +Math.abs(clusterRate - overallRate).toFixed(1);
};

export const resolveExploratoryClusterCount = ({
  activeClusterCount = 0,
  manualClusterCountValue = null,
}: {
  activeClusterCount?: unknown;
  manualClusterCountValue?: unknown;
} = {}): number => {
  const count = Number(activeClusterCount || 0);
  const safeCount = Number.isFinite(count) ? count : 0;
  return manualClusterCountValue !== null ? Math.max(safeCount, 2) : safeCount;
};

export function buildPrecomputedDemoClusterState(
  demoDataSource: unknown = DEFAULT_POLIS_DEMO_DATA,
): PrecomputedDemoClusterState | null {
  const demoRecord = demoDataSource && typeof demoDataSource === 'object' ? (demoDataSource as UnknownRecord) : {};
  if (Number(demoRecord.clusterAnalysisVersion) !== POLIS_DEMO_CLUSTER_ANALYSIS_VERSION) {
    return null;
  }
  const clusterAnalysis = Array.isArray(demoRecord.clusterAnalysis)
    ? (demoRecord.clusterAnalysis as UnknownRecord[])
    : [];
  const participantsArr = Array.isArray(demoRecord.participantsVotes)
    ? (demoRecord.participantsVotes as UnknownRecord[])
    : [];

  if (!clusterAnalysis.length || !participantsArr.length) return null;

  const participantOrder: string[] = [];
  const participantGroupIdByAddress: NumberMap = {};
  participantsArr.forEach((participant) => {
    const address = String(participant?.participant || '').trim();
    const groupId = Number(participant?.groupId);
    if (!address || !Number.isInteger(groupId)) return;
    if (Object.prototype.hasOwnProperty.call(participantGroupIdByAddress, address)) return;
    participantGroupIdByAddress[address] = groupId;
    participantOrder.push(address);
  });

  const uniqueGroupIds = Array.from(
    new Set(
      participantOrder
        .map((address) => participantGroupIdByAddress[address])
        .filter((groupId) => Number.isInteger(groupId)),
    ),
  ).sort((a, b) => a - b);

  if (!uniqueGroupIds.length || uniqueGroupIds.length !== clusterAnalysis.length) return null;

  const clusterIndexByGroupId = new Map(uniqueGroupIds.map((groupId, index) => [groupId, index]));
  const clusterAssignmentsMaybe = participantOrder.map((address) =>
    clusterIndexByGroupId.get(participantGroupIdByAddress[address]),
  );
  if (clusterAssignmentsMaybe.some((clusterIndex) => !Number.isInteger(clusterIndex))) return null;
  const clusterAssignments = clusterAssignmentsMaybe as number[];

  const repQuestions: PolisRepQuestionsMap = {};
  const clusterCollapseState: BooleanMap = {};
  const analysisCacheByClusterIndex: PolisAnalysisCacheByCluster = {};

  clusterAnalysis.forEach((cluster, clusterIndex) => {
    const topStatements = Array.isArray(cluster?.topStatements) ? (cluster.topStatements as UnknownRecord[]) : [];
    repQuestions[clusterIndex] = topStatements
      .map((statement): PolisRepresentativeQuestion | null => {
        const questionIndex = Number(statement?.questionIndex);
        if (!Number.isInteger(questionIndex) || questionIndex < 0) return null;
        const difference = resolvePrecomputedClusterDifference(
          statement?.differenceScore,
          asRecord(statement?.cluster).agreeRate,
          asRecord(statement?.overall).agreeRate,
        );

        return {
          label: String(statement?.label || `#${questionIndex + 1}`),
          questionIndex,
          prompt: String(statement?.prompt || ''),
          difference,
        };
      })
      .filter((statement): statement is PolisRepresentativeQuestion => !!statement);

    clusterCollapseState[clusterIndex] = true;

    const participantCount = Number(cluster?.participantCount);
    const topLabels = repQuestions[clusterIndex].map((statement) => statement.label);
    const details: string[] = [];
    if (Number.isFinite(participantCount) && participantCount > 0) {
      details.push(`${participantCount} demo participants.`);
    }
    if (topLabels.length) {
      details.push(`Most distinctive questions: ${topLabels.join(', ')}.`);
    }

    analysisCacheByClusterIndex[clusterIndex] = {
      name: String(cluster?.clusterLabel || `Cluster ${clusterIndex}`),
      short: String(cluster?.characteristics || '').trim(),
      long: details.join(' ').trim(),
    };
  });

  return {
    clusterCount: uniqueGroupIds.length,
    clusterAssignments,
    repQuestions,
    clusterCollapseState,
    analysisCacheByClusterIndex,
  };
}

export function getRenderableParticipantList(responders: unknown[] = [], displayNames: StringMap = {}) {
  const isEth = (value: unknown) => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
  const hasDisplayNames = !!(displayNames && Object.keys(displayNames).length > 0);
  const unique = Array.from(new Set(Array.isArray(responders) ? responders : []))
    .filter((addr) => {
      const displayName = displayNames?.[String(addr)];
      return !!displayName || isEth(addr);
    })
    .map((addr) => String(addr));

  if (!hasDisplayNames) {
    unique.sort();
  }

  return unique;
}

export function formatBlockchainNetworkLabel(network: UnknownRecord | null = null, fallbackChainId: unknown = null) {
  const networkChainId = Number(network?.id ?? network?.chainId ?? network?.networkChainId ?? 0) || 0;
  const chainId = Number(fallbackChainId ?? networkChainId ?? 0) || 0;
  const chain = chainId ? getChainById(chainId) : null;
  const shouldUseWalletName = !!networkChainId && networkChainId === chainId;
  const name = shouldUseWalletName
    ? String(network?.name || '').trim() || String(chain?.name || '').trim()
    : String(chain?.name || '').trim() || String(network?.name || '').trim();
  if (name && chainId) return `${name} (${chainId})`;
  if (name) return name;
  if (chainId) return `Chain ${chainId}`;
  return 'Unknown';
}

export function getUTCDataTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').split('.')[0] + ' UTC';
}

export const REPORT_DEFAULT_EMBEDDING_LABEL = 'Polis Auto';
export const PARTICIPANTS_GRAPH_TOOLTIP_TEXT = `This diagram opens in UMAP with 3 groups. Switch to SVD/PCA for the PCA view, or ${REPORT_DEFAULT_EMBEDDING_LABEL} for the report's Polis-inspired automatic grouping.`;
export const REPORT_DEFAULT_EMBEDDING_TOOLTIP_TEXT =
  "Polis Auto uses Context Engine's Polis-inspired automatic grouping. It keeps the report's PCA-based participant layout and auto-selects opinion groups from that layout. UMAP and SVD/PCA are exploratory views where you can override K manually. This is Polis-inspired analysis inside Context Engine, not an official Polis/Pol.is integration or endorsement.";
export const OPINION_GROUPS_TOOLTIP_TEXT =
  "Leave K on auto to use Polis Auto's automatic grouping, or set K manually when exploring UMAP or SVD/PCA layouts.";
