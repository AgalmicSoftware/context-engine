import { isPlainAnalysisObject, toAnalysisRecord, type UserPageUnknownRecord } from './userPageCoreHelpers';

export type UserPageAnalysisFingerprintInput = {
  address?: unknown;
  model?: unknown;
  networkId?: unknown;
  provider?: unknown;
  sessionSlug?: unknown;
  userData: unknown;
  version?: unknown;
};

export type ResolveUserPageAnalysisModalDisplayStateArgs = {
  analysisDetails?: unknown;
  analysisError?: unknown;
  analysisHistoricalFigure?: unknown;
  analysisHistoricalReasoning?: unknown;
  analyzing?: unknown;
};

export type ResolveUserPageAnalysisCacheStatusStateArgs = {
  analysisCachedAt?: unknown;
  analysisServedFromCache?: unknown;
};

export type UserPageAnalysisCacheStatusState = {
  analysisCacheAge: string;
  shouldRenderAnalysisCacheStatus: boolean;
};

export type UserPageAnalysisModalDisplayState = {
  shouldRenderAnalysisBody: boolean;
  shouldRenderAnalyzing: boolean;
  shouldRenderDetails: boolean;
  shouldRenderError: boolean;
  shouldRenderHistoricalAlignment: boolean;
  shouldRenderHistoricalFigure: boolean;
  shouldRenderHistoricalReasoning: boolean;
};

export type ResolveUserPageFullProfileModalDisplayStateArgs = {
  account?: unknown;
  explorerUrl?: unknown;
  minimized?: unknown;
  propViewAddress?: unknown;
  surveyResponseInfo?: unknown;
  surveyResponsesLoadingEmpty?: unknown;
};

export type UserPageFullProfileModalDisplayState = {
  shouldRenderBookmarksLink: boolean;
  shouldRenderModalActions: boolean;
  shouldRenderSurveyEmptyText: boolean;
  shouldRenderSurveyList: boolean;
  shouldRenderSurveySpinner: boolean;
};

export type BuildUserPageAnalysisResultStatePatchArgs = {
  cachedAt?: unknown;
  includeElapsed?: unknown;
  includeError?: unknown;
  includeModal?: unknown;
  result?: unknown;
  servedFromCache?: unknown;
};

export type BuildUserPageAnalysisResetStatePatchArgs = {
  analyzing?: unknown;
};

export type BuildUserPageAnalysisAiOptionsArgs = {
  analysisSession?: unknown;
  context?: unknown;
  defaultReason?: unknown;
};

export type BuildUserPageAnalysisErrorStatePatchArgs = {
  message?: unknown;
};

export type BuildUserPageAnalysisElapsedStatePatchArgs = {
  nowMs?: unknown;
  startedAt?: unknown;
};

type UserPageErrorLike = {
  message?: unknown;
};

export type UserPageTooltipTargetIds = {
  addrFragment: string;
  analyzeBtnWrapId: string;
  compareBtnWrapId: string;
  questionSpinnerId: string;
  questionsCreatedSpinnerId: string;
  sbtSpinnerId: string;
  surveySpinnerId: string;
  surveysCreatedSpinnerId: string;
};

export const getUserPageErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as UserPageErrorLike).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

export const sortUserAnalysisKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortUserAnalysisKeys(item));
  }
  if (!isPlainAnalysisObject(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce<UserPageUnknownRecord>((acc, key) => {
      acc[key] = sortUserAnalysisKeys(value[key]);
      return acc;
    }, {});
};

export const digestUserPageAnalysisCanonicalString = async (canonical: string): Promise<string> => {
  const subtle = globalThis?.crypto?.subtle;
  if (subtle && typeof subtle.digest === 'function' && typeof TextEncoder !== 'undefined') {
    const buffer = await subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a:${hash.toString(16).padStart(8, '0')}`;
};

export const buildUserPageAnalysisFingerprint = async ({
  userData,
  address,
  networkId,
  sessionSlug,
  provider,
  model,
  version = 1,
}: UserPageAnalysisFingerprintInput): Promise<string> => {
  const canonical = JSON.stringify(
    sortUserAnalysisKeys({
      version,
      userData,
      address: String(address || '')
        .trim()
        .toLowerCase(),
      networkId: String(networkId || ''),
      sessionSlug: String(sessionSlug || ''),
      provider: String(provider || '')
        .trim()
        .toLowerCase(),
      model: String(model || '').trim(),
    }),
  );
  return digestUserPageAnalysisCanonicalString(canonical);
};

export const formatAnalysisCacheAge = (cachedAt: unknown): string => {
  const ts = Number(cachedAt || 0);
  if (!Number.isFinite(ts) || ts <= 0) return '';
  const ageMs = Math.max(0, Date.now() - ts);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ageMs < minute) return 'just now';
  if (ageMs < hour) return `${Math.max(1, Math.floor(ageMs / minute))}m ago`;
  if (ageMs < day) return `${Math.max(1, Math.floor(ageMs / hour))}h ago`;
  return `${Math.max(1, Math.floor(ageMs / day))}d ago`;
};

export const resolveUserPageAnalysisCacheStatusState = ({
  analysisCachedAt = null,
  analysisServedFromCache = false,
}: ResolveUserPageAnalysisCacheStatusStateArgs = {}): UserPageAnalysisCacheStatusState => {
  const analysisCacheAge = analysisServedFromCache ? formatAnalysisCacheAge(analysisCachedAt) : '';
  return {
    analysisCacheAge,
    shouldRenderAnalysisCacheStatus: !!analysisCacheAge,
  };
};

export const resolveUserPageAnalysisModalDisplayState = ({
  analysisDetails = '',
  analysisError = '',
  analysisHistoricalFigure = '',
  analysisHistoricalReasoning = '',
  analyzing = false,
}: ResolveUserPageAnalysisModalDisplayStateArgs = {}): UserPageAnalysisModalDisplayState => {
  const shouldRenderAnalyzing = !!analyzing;
  const shouldRenderError = !shouldRenderAnalyzing && !!analysisError;
  const shouldRenderAnalysisBody = !shouldRenderAnalyzing && !shouldRenderError;
  const shouldRenderHistoricalFigure = shouldRenderAnalysisBody && !!analysisHistoricalFigure;
  const shouldRenderHistoricalReasoning = shouldRenderAnalysisBody && !!analysisHistoricalReasoning;
  return {
    shouldRenderAnalysisBody,
    shouldRenderAnalyzing,
    shouldRenderDetails: shouldRenderAnalysisBody && !!analysisDetails,
    shouldRenderError,
    shouldRenderHistoricalAlignment: shouldRenderHistoricalFigure || shouldRenderHistoricalReasoning,
    shouldRenderHistoricalFigure,
    shouldRenderHistoricalReasoning,
  };
};

export const resolveUserPageFullProfileModalDisplayState = ({
  account = '',
  explorerUrl = '',
  minimized = false,
  propViewAddress = '',
  surveyResponseInfo = [],
  surveyResponsesLoadingEmpty = false,
}: ResolveUserPageFullProfileModalDisplayStateArgs = {}): UserPageFullProfileModalDisplayState => {
  const surveyResponseCount = Number((surveyResponseInfo as { length?: unknown })?.length || 0);
  const shouldRenderSurveySpinner = !!surveyResponsesLoadingEmpty;
  const shouldRenderModalActions = !minimized && !!propViewAddress && !!explorerUrl;
  const accountLower = String(account || '').toLowerCase();
  const propViewAddressLower = String(propViewAddress || '').toLowerCase();
  return {
    shouldRenderBookmarksLink: shouldRenderModalActions && !!accountLower && accountLower === propViewAddressLower,
    shouldRenderModalActions,
    shouldRenderSurveyEmptyText: !shouldRenderSurveySpinner && surveyResponseCount === 0,
    shouldRenderSurveyList: !shouldRenderSurveySpinner && surveyResponseCount > 0,
    shouldRenderSurveySpinner,
  };
};

export const buildUserPageTooltipTargetIds = (viewAddress: unknown = ''): UserPageTooltipTargetIds => {
  const rawAddrSeed = String(viewAddress || 'addr');
  const sanitizedAddrSeed = rawAddrSeed.replace(/[^A-Za-z0-9_-]/g, '');
  const normalizedAddrSeed = sanitizedAddrSeed.toLowerCase();
  const addrFragment =
    (normalizedAddrSeed.startsWith('0x') ? normalizedAddrSeed.slice(2) : normalizedAddrSeed).slice(0, 6) || 'addr';
  return {
    addrFragment,
    analyzeBtnWrapId: `analyzeBtnWrap_${addrFragment}`,
    compareBtnWrapId: `compareBtnWrap_${addrFragment}`,
    questionSpinnerId: `questionSpinner_${addrFragment}`,
    questionsCreatedSpinnerId: `questionsCreatedSpinner_${addrFragment}`,
    sbtSpinnerId: `sbtSpinner_${addrFragment}`,
    surveySpinnerId: `surveySpinner_${addrFragment}`,
    surveysCreatedSpinnerId: `surveysCreatedSpinner_${addrFragment}`,
  };
};

export const normalizeUserAnalysisResult = (result: unknown = {}) => {
  const resultRecord = toAnalysisRecord(result);
  const historicalAlignment = toAnalysisRecord(resultRecord.historicalAlignment);
  return {
    name: resultRecord.name || 'User Analysis',
    summary: resultRecord.summary || '',
    details: resultRecord.details || '',
    historicalAlignment: {
      figure: historicalAlignment.figure || '',
      reasoning: historicalAlignment.reasoning || '',
    },
  };
};

export const buildUserPageAnalysisResultStatePatch = ({
  cachedAt = null,
  includeElapsed = false,
  includeError = false,
  includeModal = false,
  result = {},
  servedFromCache = false,
}: BuildUserPageAnalysisResultStatePatchArgs = {}): UserPageUnknownRecord => {
  const normalizedResult = normalizeUserAnalysisResult(result);
  return {
    ...(includeModal ? { showAnalysisModal: true } : {}),
    aiAnalysis: normalizedResult.summary,
    analysisDetails: normalizedResult.details,
    analysisName: normalizedResult.name,
    analysisHistoricalFigure: normalizedResult.historicalAlignment.figure,
    analysisHistoricalReasoning: normalizedResult.historicalAlignment.reasoning,
    ...(includeElapsed ? { analysisElapsedMs: 0 } : {}),
    ...(includeError ? { analysisError: '' } : {}),
    analyzing: false,
    analysisServedFromCache: servedFromCache === true,
    analysisCachedAt: Number(cachedAt || 0) || null,
  };
};

export const buildUserPageAnalysisResetStatePatch = ({
  analyzing = false,
}: BuildUserPageAnalysisResetStatePatchArgs = {}): UserPageUnknownRecord => ({
  showAnalysisModal: true,
  analyzing: analyzing === true,
  analysisError: '',
  aiAnalysis: '',
  analysisDetails: '',
  analysisName: '',
  analysisElapsedMs: 0,
  analysisHistoricalFigure: '',
  analysisHistoricalReasoning: '',
  analysisServedFromCache: false,
  analysisCachedAt: null,
});

export const buildUserPageAnalysisElapsedStatePatch = ({
  nowMs = Date.now(),
  startedAt = 0,
}: BuildUserPageAnalysisElapsedStatePatchArgs = {}): UserPageUnknownRecord => ({
  analysisElapsedMs: Number(nowMs) - Number(startedAt),
});

export const buildUserPageAnalysisAiOptions = ({
  analysisSession = {},
  context,
  defaultReason = 'unknown',
}: BuildUserPageAnalysisAiOptionsArgs = {}): UserPageUnknownRecord => {
  const session = toAnalysisRecord(analysisSession);
  return {
    context,
    sessionSlug: String(session.slug || ''),
    sessionConfig: session.sessionConfig,
    throwOnError: true,
    sessionSelection: {
      gateStatus: String(session.status || 'unknown'),
      reason: String(session.reason || defaultReason || 'unknown'),
    },
  };
};

export const buildUserPageAnalysisErrorStatePatch = ({
  message = 'Unable to generate analysis right now. Please try again later.',
}: BuildUserPageAnalysisErrorStatePatchArgs = {}): UserPageUnknownRecord => ({
  analyzing: false,
  analysisError: String(message || 'Unable to generate analysis right now. Please try again later.'),
  showAnalysisModal: true,
  analysisServedFromCache: false,
  analysisCachedAt: null,
});

export const extractUserPageAnalysisAdditionalComment = (value: unknown): string | null => {
  const record = toAnalysisRecord(value);
  if (!Object.keys(record).length) return null;
  const candidates = [record.additionalComment, record.additionalComments, record.comment, record.comments];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const candidateRecord = toAnalysisRecord(candidate);
    const val = typeof candidate === 'string' ? candidate : (candidateRecord.value ?? candidateRecord.text ?? null);
    const encrypted = typeof candidate === 'object' && candidateRecord.encrypted === true;
    if (val && val !== '*' && !encrypted && String(val).trim() !== '*') return String(val);
  }
  return null;
};

export const extractUserPageAnalysisImportance = (value: unknown): unknown => {
  const record = toAnalysisRecord(value);
  const meta = toAnalysisRecord(record.meta);
  const answer = toAnalysisRecord(record.answer);
  const candidate =
    record.conviction ??
    record.importance ??
    meta.conviction ??
    meta.importance ??
    answer.conviction ??
    answer.importance;
  const candidateRecord = toAnalysisRecord(candidate);
  return candidate === '*' || (candidate && typeof candidate === 'object' && candidateRecord.encrypted === true)
    ? undefined
    : candidate;
};
