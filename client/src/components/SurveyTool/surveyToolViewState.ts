import { serializeFilterState } from '../../utilities/survey/filterStateUtils.js';

type UnknownRecord = Record<string, unknown>;

type QuestionScanProgress = {
  totalBlocks?: unknown;
  requestedTotalBlocks?: unknown;
  wasCapped?: boolean;
  scannedBlocks?: unknown;
  remainingBlocks?: unknown;
};

type PileFullLoadingStateArgs = {
  loading?: boolean;
  hasVisibleQuestions?: boolean;
  firstBoot?: boolean;
  isQuestionCacheReady?: boolean;
  recentRateLimit?: boolean;
  hasScanOrHydrationWork?: boolean;
  allowUnreadyEmptySettlement?: boolean;
  allowFilteredEmptySettlement?: boolean;
  hasTerminalScanError?: boolean;
};

type CanonicalResponseStatus = {
  responded: boolean;
  notResponded: boolean;
} | null;

type CanonicalSurveyToolFilterState = {
  topQuestions: unknown;
  questionTypes: unknown[];
  sbtFilter: UnknownRecord | null;
  aiFilter: unknown;
  aiTopN: number | null;
  aiCombine: boolean;
  selectedTags: unknown[];
  responseStatus: CanonicalResponseStatus;
};

const isPlainObject = (value: unknown): value is UnknownRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

export const normalizeQuestionProgressSlug = (rawSlug = ''): string => {
  const normalized = String(rawSlug || '').trim().toLowerCase();
  return normalized === 'general' ? '' : normalized;
};

export const doesQuestionProgressMatchSlug = (progressSlug = '', currentSlug = ''): boolean => (
  normalizeQuestionProgressSlug(progressSlug) === normalizeQuestionProgressSlug(currentSlug)
);

export const formatQuestionScanBlockCount = (value: unknown): string => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  return Math.max(0, Math.floor(numericValue)).toLocaleString();
};

export const buildQuestionScanProgressDisplay = (
  questionScanProgress: QuestionScanProgress | null = null
) => {
  const totalBlocks = Math.max(0, Number(questionScanProgress?.totalBlocks || 0));
  const requestedTotalBlocks = Math.max(
    totalBlocks,
    Number(questionScanProgress?.requestedTotalBlocks || totalBlocks || 0)
  );
  const wasCapped = questionScanProgress?.wasCapped === true && requestedTotalBlocks > totalBlocks;
  const progressTotalBlocks = wasCapped ? requestedTotalBlocks : totalBlocks;
  const remainingBlocksRaw = Number(questionScanProgress?.remainingBlocks);
  const scannedBlocksFallback = progressTotalBlocks > 0
    ? Math.max(0, progressTotalBlocks - Math.max(0, Number.isFinite(remainingBlocksRaw) ? remainingBlocksRaw : progressTotalBlocks))
    : 0;
  const scannedBlocks = progressTotalBlocks > 0
    ? Math.max(
      0,
      Math.min(
        progressTotalBlocks,
        Number.isFinite(Number(questionScanProgress?.scannedBlocks))
          ? Number(questionScanProgress?.scannedBlocks)
          : scannedBlocksFallback
      )
    )
    : 0;
  const remainingBlocks = progressTotalBlocks > 0
    ? Math.max(
      0,
      Math.min(
        progressTotalBlocks,
        Number.isFinite(remainingBlocksRaw)
          ? remainingBlocksRaw
          : (progressTotalBlocks - scannedBlocks)
      )
    )
    : 0;
  const percentComplete = progressTotalBlocks > 0
    ? Math.max(0, Math.min(100, Math.round((scannedBlocks / progressTotalBlocks) * 100)))
    : 0;

  return {
    totalBlocks,
    requestedTotalBlocks,
    wasCapped,
    scannedBlocks,
    remainingBlocks,
    percentComplete,
    metaLeftText: `${formatQuestionScanBlockCount(remainingBlocks)} blocks left`,
    metaRightText: `${formatQuestionScanBlockCount(scannedBlocks)} / ${formatQuestionScanBlockCount(progressTotalBlocks)}`,
  };
};

export const shouldShowPileFullLoadingState = ({
  loading = false,
  hasVisibleQuestions = false,
  firstBoot = false,
  isQuestionCacheReady = false,
  recentRateLimit = false,
  hasScanOrHydrationWork = false,
  allowUnreadyEmptySettlement = false,
  allowFilteredEmptySettlement = false,
  hasTerminalScanError = false,
}: PileFullLoadingStateArgs = {}): boolean => {
  if (hasVisibleQuestions) return false;
  if (hasTerminalScanError) return false;
  if (allowUnreadyEmptySettlement) return false;
  if (allowFilteredEmptySettlement) return false;
  if (loading) return true;
  if (hasScanOrHydrationWork) return true;
  return !!(firstBoot || !isQuestionCacheReady || recentRateLimit);
};

const normalizeSbtFilterState = (rawSbtFilter: unknown): UnknownRecord | null => {
  if (!isPlainObject(rawSbtFilter)) return null;
  const normalized: UnknownRecord = {};
  Object.keys(rawSbtFilter).forEach((key) => {
    const value = rawSbtFilter[key];
    if (Array.isArray(value)) {
      const compacted = value.filter((entry) => entry != null && String(entry).trim() !== '');
      if (compacted.length > 0) normalized[key] = compacted;
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) normalized[key] = trimmed;
      return;
    }
    if (typeof value === 'boolean') {
      if (value) normalized[key] = true;
      return;
    }
    if (value != null) {
      normalized[key] = value;
    }
  });
  return Object.keys(normalized).length > 0 ? normalized : null;
};

const buildCanonicalSurveyToolFilterState = (rawFilterState: unknown): CanonicalSurveyToolFilterState => {
  const state = isPlainObject(rawFilterState) ? rawFilterState : {};
  const topQuestions = Object.prototype.hasOwnProperty.call(state, 'topQuestions')
    ? state.topQuestions
    : null;
  const questionTypes = Array.isArray(state.questionTypes)
    ? [...state.questionTypes]
    : (Array.isArray(state.types) ? [...state.types] : []);
  const selectedTags = Array.isArray(state.selectedTags)
    ? [...state.selectedTags]
    : (Array.isArray(state.tags) ? [...state.tags] : []);
  const legacyTopLevelSbt = (
    Array.isArray(state.includedSBTs) ||
    Array.isArray(state.excludedSBTs) ||
    state.onlyVerifiedHumans === true
  )
    ? {
        includedSBTs: Array.isArray(state.includedSBTs) ? [...state.includedSBTs] : [],
        excludedSBTs: Array.isArray(state.excludedSBTs) ? [...state.excludedSBTs] : [],
        onlyVerifiedHumans: state.onlyVerifiedHumans === true,
      }
    : null;
  const sbtFilter = normalizeSbtFilterState(state.sbtFilter || legacyTopLevelSbt);
  const aiFilter = (typeof state.aiFilter === 'string')
    ? (state.aiFilter.trim() || null)
    : (state.aiFilter ?? null);
  const aiTopNRaw = Object.prototype.hasOwnProperty.call(state, 'aiTopN') ? state.aiTopN : null;
  const aiTopN = aiFilter == null
    ? null
    : (() => {
      const parsed = Number.parseInt(String(aiTopNRaw ?? ''), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
    })();
  const aiCombine = aiFilter == null
    ? false
    : state.aiCombine === true;

  const rawResponseStatus = isPlainObject(state.responseStatus) ? state.responseStatus : null;
  const responded = rawResponseStatus?.responded === true;
  const notResponded = rawResponseStatus?.notResponded === true;
  const responseStatus = (responded || notResponded) && !(responded && notResponded)
    ? { responded, notResponded }
    : null;

  return {
    topQuestions,
    questionTypes,
    sbtFilter,
    aiFilter,
    aiTopN,
    aiCombine,
    selectedTags,
    responseStatus,
  };
};

export const normalizeSurveyToolFilterState = (rawFilterState: unknown): UnknownRecord => {
  const canonical = buildCanonicalSurveyToolFilterState(rawFilterState);
  return serializeFilterState(canonical) ? canonical : {};
};

export const serializeSurveyToolFilterState = (filterState: unknown): string => (
  serializeFilterState(buildCanonicalSurveyToolFilterState(filterState))
);

export const isSurveyToolFilterStateActive = (filterState: unknown): boolean => (
  !!serializeSurveyToolFilterState(filterState)
);
