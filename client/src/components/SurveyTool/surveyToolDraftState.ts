import { normalizeQuestionIdKey } from './surveyToolSignatures.js';
import type { UnknownRecord } from './surveyToolTypes.js';

type SurveyDraftField = {
  value?: unknown;
  encrypted?: boolean;
} & UnknownRecord;

type SurveyDraftQuestionEntry = {
  value?: unknown;
  answerEncrypted?: unknown;
  answerEncryptionAudience?: unknown;
  answerEncryptionGateId?: unknown;
  answerAudienceMode?: unknown;
  answerEncryptedPortion?: unknown;
  additional?: unknown;
  additionalEncrypted?: unknown;
  additionalEncryptionAudience?: unknown;
  additionalEncryptionGateId?: unknown;
  additionalAudienceMode?: unknown;
  additionalEncryptedPortion?: unknown;
  importance?: unknown;
  conviction?: unknown;
} & UnknownRecord;

type PersistedDraftEntryResolvers = {
  resolveFieldEncryptionAudience?: ((field: UnknownRecord, questionId: string, fieldKey?: string) => unknown) | null;
  resolveFieldEncryptionGateId?: ((field: UnknownRecord, questionId: string, fieldKey?: string) => unknown) | null;
  normalizeFieldAudienceMode?: ((audienceMode: unknown, fieldKey?: string, field?: UnknownRecord) => unknown) | null;
};

type PersistDraftAllowedIdsArgs = {
  renderedQuestionIds?: unknown[];
  dirtyQuestionIds?: unknown[];
  slice?: PersistedDraftSliceLike | null;
};

type SurveyDraftStorageKeyArgs = {
  sessionSlug?: unknown;
  networkIdStr?: unknown;
  account?: unknown;
  surveyScope?: unknown;
};

type SurveyDraftStorageVariantKeysArgs = SurveyDraftStorageKeyArgs & {
  questionId?: unknown;
  includePerQuestionScope?: boolean;
};

type SurveyDraftLoadPlanArgs = {
  hasAccount?: boolean;
  primaryAccountKey?: unknown;
  primaryAnonKey?: unknown;
  compatAccountKey?: unknown;
  compatAnonKey?: unknown;
  pendingAccountKey?: unknown;
  perQuestionAccountKey?: unknown;
  perQuestionAnonKey?: unknown;
};

type MergePersistedDraftPayloadsArgs = {
  drafts?: unknown[];
};

type PersistedDraftWritePlanArgs = {
  draftKey?: unknown;
  sessionSlug?: unknown;
  networkIdStr?: unknown;
  account?: unknown;
  surveyScope?: unknown;
  singleQuestionMode?: boolean;
};

type SurveyDraftParseCache = {
  key?: unknown;
  raw?: unknown;
  parsed?: unknown;
} | null;

type PreviousPersistedDraftSnapshotArgs = {
  key?: unknown;
  lastDraftKey?: unknown;
  lastDraftJSON?: unknown;
  lastDraftSemanticSignature?: unknown;
  draftParseCache?: SurveyDraftParseCache;
};

type DraftTrackingStateArgs = {
  lastDraftKey?: unknown;
  lastDraftJSON?: unknown;
  lastDraftSemanticSignature?: unknown;
  draftParseCache?: SurveyDraftParseCache;
};

type DraftTrackingKeyChangeArgs = DraftTrackingStateArgs & {
  nextDraftKey?: unknown;
};

type DraftTrackingAfterLoadArgs = DraftTrackingStateArgs & {
  nextDraftParseCache?: SurveyDraftParseCache;
  shouldResetDraftTracking?: boolean;
};

type DraftTrackingAfterWriteArgs = {
  key?: unknown;
  raw?: unknown;
  payload?: SurveyDraftPayload | null;
  semanticSignature?: unknown;
};

type DraftTrackingAfterScopedDeleteArgs = DraftTrackingStateArgs & {
  key?: unknown;
};

type SurveyDraftPayload = {
  meta?: UnknownRecord | null;
  answers?: Record<string, SurveyDraftQuestionEntry | unknown> | null;
  baseline?: Record<string, SurveyDraftQuestionEntry | unknown> | null;
} & UnknownRecord;

type PersistedDraftPayloadArgs = {
  draftContext?: UnknownRecord | null;
  singleQuestionMode?: boolean;
  questionId?: unknown;
  surveyId?: unknown;
  answersObj?: Record<string, SurveyDraftQuestionEntry | unknown> | null;
  baselineObj?: Record<string, SurveyDraftQuestionEntry | unknown> | null;
  now?: number;
};

type RemoveQuestionFromPersistedDraftPayloadArgs = {
  draftPayload?: unknown;
  questionId?: unknown;
};

type PersistedDraftQuestionRemovalPlanArgs = {
  raw?: unknown;
  questionId?: unknown;
  buildSemanticSignature?: ((payload: SurveyDraftPayload) => unknown) | null;
};

type ParsePersistedDraftStorageValueArgs = {
  raw?: unknown;
  requireAnswers?: boolean;
};

type DraftHydrationDependencies = {
  normalizeResponseEncryptionAudience?: ((audience: unknown, questionId?: string) => unknown) | null;
  normalizeFieldAudienceMode?: ((audienceMode: unknown, fieldKey?: string, field?: UnknownRecord) => unknown) | null;
  buildInheritedAdditionalFieldState?:
    ((additionalState: UnknownRecord, answerState: UnknownRecord, questionId?: string) => UnknownRecord) | null;
  buildEmptyResponseFieldState?: ((questionId?: string, fieldKey?: string) => UnknownRecord) | null;
};

type BuildDraftHydrationPatchForQuestionArgs = {
  questionId?: unknown;
  draftEntry?: unknown;
  currentAnswer?: UnknownRecord | null;
  currentAdditional?: UnknownRecord | null;
  hasCurrentImportance?: boolean;
  hasCurrentConviction?: boolean;
  allowOverwrite?: boolean;
  deps?: DraftHydrationDependencies;
};

type PendingStatsState = {
  modifiedCount?: unknown;
  encryptedModifiedCount?: unknown;
} & UnknownRecord;

type PersistedDraftSliceLike = {
  answers?: Record<string, UnknownRecord | unknown> | null;
  additionalComments?: Record<string, UnknownRecord | unknown> | null;
  importance?: Record<string, unknown> | null;
  conviction?: Record<string, unknown> | null;
} & UnknownRecord;

type SubmitLabelContext = {
  getPendingEditStats?: (() => Partial<PendingStatsSnapshot> | PendingStatsSnapshot | null | undefined) | null;
  state?: PendingStatsState | null;
} & UnknownRecord;

type SubmitLabelOptions = {
  suffix?: unknown;
  pendingStats?: Partial<PendingStatsSnapshot> | PendingStatsSnapshot | null;
} & UnknownRecord;

type SingleQuestionResponseLookupSpinnerArgs = {
  singleQuestionMode?: boolean;
  isLoadingResponse?: boolean;
  account?: unknown;
  viewAddress?: unknown;
  responderAddress?: unknown;
};

type SubmittedIndicatorArgs = {
  submittedStateActive?: boolean;
  isLoadingResponse?: boolean;
};

type InlineSubmitButtonArgs = {
  useHeaderSubmit?: boolean;
  canEditQuestions?: boolean;
  hasPendingEdits?: boolean;
  submittedStateActive?: boolean;
  isLoadingResponse?: boolean;
};

export type PendingStatsSnapshot = {
  total: number;
  encrypted: number;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasPresentHydratedValue = (value: unknown): boolean =>
  value !== undefined && value !== null && (Array.isArray(value) ? value.length > 0 : String(value).length > 0);

export const hasMeaningfulFieldValue = (field: SurveyDraftField | null | undefined = {}): boolean => {
  if (!isRecord(field)) return false;
  const val = field.value;
  if (val === '*') return true;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return true;
  if (Array.isArray(val)) return val.length > 0;
  if (val && typeof val === 'object') return Object.keys(val).length > 0;
  if (typeof val === 'string') return val.trim().length > 0;
  return false;
};

const buildStableDraftValueSignature = (value: unknown): string => {
  if (value === undefined) return 'u';
  if (value === null) return 'n';
  if (typeof value === 'string') return `s:${value}`;
  if (typeof value === 'number') return `d:${Number.isNaN(value) ? 'NaN' : String(value)}`;
  if (typeof value === 'boolean') return value ? 'b:1' : 'b:0';
  if (Array.isArray(value)) {
    return `a:[${value.map((item) => buildStableDraftValueSignature(item)).join(',')}]`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `o:{${keys.map((key) => `${key}:${buildStableDraftValueSignature(value[key])}`).join('|')}}`;
  }
  return `${typeof value}:${String(value)}`;
};

const getDraftQuestionEntry = (
  map: Record<string, SurveyDraftQuestionEntry | unknown> | null | undefined,
  questionId: string,
): SurveyDraftQuestionEntry => {
  if (!map) return {};
  const value = map[questionId];
  return isRecord(value) ? (value as SurveyDraftQuestionEntry) : {};
};

export const buildDraftAnswersByQuestionId = (
  draftPayload: unknown = null,
): Record<string, SurveyDraftQuestionEntry> => {
  const out: Record<string, SurveyDraftQuestionEntry> = {};
  const answers =
    isRecord(draftPayload) && isRecord(draftPayload.answers) ? (draftPayload.answers as Record<string, unknown>) : {};

  Object.keys(answers).forEach((rawQuestionId) => {
    const questionId = normalizeQuestionIdKey(rawQuestionId);
    if (!questionId || out[questionId]) return;
    const entry = answers[rawQuestionId];
    if (isRecord(entry)) {
      out[questionId] = entry as SurveyDraftQuestionEntry;
    }
  });

  return out;
};

export const buildSurveyDraftSemanticSignature = (payload: SurveyDraftPayload | null | undefined = {}): string => {
  const safePayload = isRecord(payload) ? payload : {};
  const meta = isRecord(safePayload.meta) ? safePayload.meta : {};
  const answers = isRecord(safePayload.answers)
    ? (safePayload.answers as Record<string, SurveyDraftQuestionEntry | unknown>)
    : {};
  const baseline = isRecord(safePayload.baseline)
    ? (safePayload.baseline as Record<string, SurveyDraftQuestionEntry | unknown>)
    : {};
  const questionIds = Object.keys(answers)
    .map((qid) => String(qid || ''))
    .filter(Boolean)
    .sort();
  const baselineIds = Object.keys(baseline)
    .map((qid) => String(qid || ''))
    .filter(Boolean)
    .sort();
  const parts = [
    `network:${meta.networkId == null ? '' : String(meta.networkId)}`,
    `survey:${meta.surveyId == null ? '' : String(meta.surveyId)}`,
    `count:${questionIds.length}`,
    `bcount:${baselineIds.length}`,
  ];
  questionIds.forEach((qid) => {
    const answerEntry = getDraftQuestionEntry(answers, qid);
    parts.push(`qid:${qid}`);
    parts.push(`value:${buildStableDraftValueSignature(answerEntry.value)}`);
    parts.push(`answerEncrypted:${buildStableDraftValueSignature(answerEntry.answerEncrypted)}`);
    parts.push(`answerAudience:${buildStableDraftValueSignature(answerEntry.answerEncryptionAudience)}`);
    parts.push(`answerGateId:${buildStableDraftValueSignature(answerEntry.answerEncryptionGateId)}`);
    parts.push(`answerAudienceMode:${buildStableDraftValueSignature(answerEntry.answerAudienceMode)}`);
    parts.push(`answerEncryptedPortion:${buildStableDraftValueSignature(answerEntry.answerEncryptedPortion)}`);
    parts.push(`additional:${buildStableDraftValueSignature(answerEntry.additional)}`);
    parts.push(`additionalEncrypted:${buildStableDraftValueSignature(answerEntry.additionalEncrypted)}`);
    parts.push(`additionalAudience:${buildStableDraftValueSignature(answerEntry.additionalEncryptionAudience)}`);
    parts.push(`additionalGateId:${buildStableDraftValueSignature(answerEntry.additionalEncryptionGateId)}`);
    parts.push(`additionalAudienceMode:${buildStableDraftValueSignature(answerEntry.additionalAudienceMode)}`);
    parts.push(`additionalEncryptedPortion:${buildStableDraftValueSignature(answerEntry.additionalEncryptedPortion)}`);
    parts.push(`importance:${buildStableDraftValueSignature(answerEntry.importance)}`);
    parts.push(`conviction:${buildStableDraftValueSignature(answerEntry.conviction)}`);
  });
  baselineIds.forEach((qid) => {
    const baselineEntry = getDraftQuestionEntry(baseline, qid);
    parts.push(`bqid:${qid}`);
    parts.push(`bvalue:${buildStableDraftValueSignature(baselineEntry.value)}`);
    parts.push(`banswerEncryptedPortion:${buildStableDraftValueSignature(baselineEntry.answerEncryptedPortion)}`);
    parts.push(`badditional:${buildStableDraftValueSignature(baselineEntry.additional)}`);
    parts.push(
      `badditionalEncryptedPortion:${buildStableDraftValueSignature(baselineEntry.additionalEncryptedPortion)}`,
    );
  });
  return parts.join('||');
};

const normalizePersistedDraftQuestionMap = (map: unknown): Record<string, SurveyDraftQuestionEntry> => {
  const out: Record<string, SurveyDraftQuestionEntry> = {};
  if (!isRecord(map)) return out;

  Object.keys(map).forEach((rawQuestionId) => {
    const questionId = normalizeQuestionIdKey(rawQuestionId);
    if (!questionId || out[questionId]) return;
    const entry = map[rawQuestionId];
    if (isRecord(entry)) {
      out[questionId] = entry as SurveyDraftQuestionEntry;
    }
  });

  return out;
};

const getPersistedDraftTimestamp = (payload: unknown): number => {
  const meta = isRecord(payload) && isRecord(payload.meta) ? payload.meta : {};
  const ts = Number(meta.ts);
  return Number.isFinite(ts) ? ts : 0;
};

const mergePersistedDraftQuestionMaps = (
  drafts: SurveyDraftPayload[],
  mapKey: 'answers' | 'baseline',
): Record<string, SurveyDraftQuestionEntry> => {
  const merged: Record<string, SurveyDraftQuestionEntry> = {};
  const sourceByQuestionId: Record<string, { timestamp: number; index: number }> = {};

  drafts.forEach((draft, index) => {
    const timestamp = getPersistedDraftTimestamp(draft);
    const questionMap = normalizePersistedDraftQuestionMap(draft?.[mapKey]);
    Object.keys(questionMap).forEach((questionId) => {
      const previous = sourceByQuestionId[questionId];
      if (previous && timestamp < previous.timestamp) return;
      if (previous && timestamp === previous.timestamp && index > previous.index) return;
      merged[questionId] = questionMap[questionId];
      sourceByQuestionId[questionId] = { timestamp, index };
    });
  });

  return merged;
};

export const mergePersistedDraftPayloads = ({
  drafts = [],
}: MergePersistedDraftPayloadsArgs = {}): SurveyDraftPayload | null => {
  const normalizedDrafts = (Array.isArray(drafts) ? drafts : []).filter((draft): draft is SurveyDraftPayload =>
    isRecord(draft),
  );
  if (normalizedDrafts.length === 0) return null;

  const answers = mergePersistedDraftQuestionMaps(normalizedDrafts, 'answers');
  const baseline = mergePersistedDraftQuestionMaps(normalizedDrafts, 'baseline');
  if (Object.keys(answers).length === 0 && Object.keys(baseline).length === 0) return null;

  let metaSource = normalizedDrafts[0];
  normalizedDrafts.forEach((draft) => {
    if (getPersistedDraftTimestamp(draft) > getPersistedDraftTimestamp(metaSource)) {
      metaSource = draft;
    }
  });
  const meta = isRecord(metaSource.meta) ? { ...metaSource.meta } : {};
  meta.ts = Math.max(...normalizedDrafts.map((draft) => getPersistedDraftTimestamp(draft)), 0);

  return {
    ...metaSource,
    meta,
    answers,
    baseline,
  };
};

export const buildPersistedDraftTrackingOnKeyChange = ({
  nextDraftKey = '',
  lastDraftKey = '',
  lastDraftJSON = null,
  lastDraftSemanticSignature = null,
  draftParseCache = null,
}: DraftTrackingKeyChangeArgs = {}) => {
  const normalizedNextDraftKey = String(nextDraftKey || '');
  const normalizedLastDraftKey = String(lastDraftKey || '');
  if (!normalizedNextDraftKey || normalizedNextDraftKey === normalizedLastDraftKey) {
    return {
      lastDraftKey: normalizedLastDraftKey,
      lastDraftJSON,
      lastDraftSemanticSignature,
      draftParseCache,
      didSwitchKey: false,
    } as const;
  }

  return {
    lastDraftKey: normalizedNextDraftKey,
    lastDraftJSON: null,
    lastDraftSemanticSignature: null,
    draftParseCache,
    didSwitchKey: true,
  } as const;
};

export const buildPersistedDraftTrackingAfterLoad = ({
  lastDraftKey = '',
  lastDraftJSON = null,
  lastDraftSemanticSignature = null,
  draftParseCache = null,
  nextDraftParseCache = null,
  shouldResetDraftTracking = false,
}: DraftTrackingAfterLoadArgs = {}) => ({
  lastDraftKey: String(lastDraftKey || ''),
  lastDraftJSON: shouldResetDraftTracking ? null : lastDraftJSON,
  lastDraftSemanticSignature: shouldResetDraftTracking ? null : lastDraftSemanticSignature,
  draftParseCache: nextDraftParseCache == null ? draftParseCache : nextDraftParseCache,
});

export const buildPersistedDraftTrackingAfterWrite = ({
  key = '',
  raw = '',
  payload = null,
  semanticSignature = null,
}: DraftTrackingAfterWriteArgs = {}) => ({
  lastDraftKey: String(key || ''),
  lastDraftJSON: typeof raw === 'string' ? raw : String(raw || ''),
  lastDraftSemanticSignature: semanticSignature,
  draftParseCache:
    payload && typeof payload === 'object'
      ? {
          key: String(key || ''),
          raw: typeof raw === 'string' ? raw : String(raw || ''),
          parsed: payload,
        }
      : null,
});

export const buildPersistedDraftTrackingAfterScopedDelete = ({
  key = '',
  lastDraftKey = '',
  lastDraftJSON = null,
  lastDraftSemanticSignature = null,
  draftParseCache = null,
}: DraftTrackingAfterScopedDeleteArgs = {}) => {
  const normalizedKey = String(key || '');
  const normalizedLastDraftKey = String(lastDraftKey || '');
  return {
    lastDraftKey: normalizedLastDraftKey,
    lastDraftJSON: normalizedLastDraftKey === normalizedKey ? null : lastDraftJSON,
    lastDraftSemanticSignature: normalizedLastDraftKey === normalizedKey ? null : lastDraftSemanticSignature,
    draftParseCache: draftParseCache && draftParseCache.key === normalizedKey ? null : draftParseCache,
  };
};

export const buildPersistedDraftTrackingClearedState = () => ({
  lastDraftKey: '',
  lastDraftJSON: null,
  lastDraftSemanticSignature: null,
  draftParseCache: null,
});

export const parsePersistedDraftStorageValue = ({
  raw = '',
  requireAnswers = true,
}: ParsePersistedDraftStorageValueArgs = {}) => {
  const normalizedRaw = typeof raw === 'string' ? raw : String(raw || '');
  if (!normalizedRaw) {
    return {
      status: 'empty',
      payload: null,
      raw: '',
    } as const;
  }

  try {
    const parsed = JSON.parse(normalizedRaw);
    const hasRequiredAnswers = !requireAnswers || isRecord(parsed?.answers);
    if (!isRecord(parsed) || !hasRequiredAnswers) {
      return {
        status: 'invalid',
        payload: null,
        raw: normalizedRaw,
      } as const;
    }
    return {
      status: 'valid',
      payload: parsed as SurveyDraftPayload,
      raw: normalizedRaw,
    } as const;
  } catch {
    return {
      status: 'invalid',
      payload: null,
      raw: normalizedRaw,
    } as const;
  }
};

export const buildDraftHydrationPatchForQuestion = ({
  questionId = '',
  draftEntry = null,
  currentAnswer = null,
  currentAdditional = null,
  hasCurrentImportance = false,
  hasCurrentConviction = false,
  allowOverwrite = false,
  deps = {},
}: BuildDraftHydrationPatchForQuestionArgs = {}) => {
  if (!isRecord(draftEntry)) {
    return {
      changed: false,
      answerState: undefined,
      additionalState: undefined,
      importanceChanged: false,
      importanceValue: undefined,
      convictionChanged: false,
      convictionValue: undefined,
    };
  }

  const qid = normalizeQuestionIdKey(questionId);
  const currentAnswerState = isRecord(currentAnswer) ? currentAnswer : {};
  const currentAdditionalState = isRecord(currentAdditional) ? currentAdditional : {};
  const normalizeResponseEncryptionAudience = deps.normalizeResponseEncryptionAudience;
  const normalizeFieldAudienceMode = deps.normalizeFieldAudienceMode;
  const buildInheritedAdditionalFieldState = deps.buildInheritedAdditionalFieldState;
  const buildEmptyResponseFieldState = deps.buildEmptyResponseFieldState;

  const hasCurrentAnswer = hasPresentHydratedValue(currentAnswerState.value);
  const hasCurrentAdditional = hasPresentHydratedValue(currentAdditionalState.value);
  let answerState;
  let additionalState;
  let importanceValue;
  let convictionValue;
  let importanceChanged = false;
  let convictionChanged = false;
  let changed = false;

  if ((!hasCurrentAnswer || allowOverwrite) && draftEntry.value !== undefined) {
    answerState = {
      ...currentAnswerState,
      value: draftEntry.value,
      encrypted: !!draftEntry.answerEncrypted,
      encryptionAudience:
        typeof normalizeResponseEncryptionAudience === 'function'
          ? normalizeResponseEncryptionAudience(draftEntry.answerEncryptionAudience, qid)
          : draftEntry.answerEncryptionAudience,
      encryptionGateId: draftEntry.answerEncryptionGateId || null,
      audienceMode:
        typeof normalizeFieldAudienceMode === 'function'
          ? normalizeFieldAudienceMode(draftEntry.answerAudienceMode, 'answer', draftEntry as UnknownRecord)
          : draftEntry.answerAudienceMode,
      ...(draftEntry.answerEncryptedPortion ? { encryptedPortion: draftEntry.answerEncryptedPortion } : {}),
    };
    changed = true;
  }

  if ((!hasCurrentAdditional || allowOverwrite) && draftEntry.additional !== undefined) {
    additionalState = {
      ...currentAdditionalState,
      value: draftEntry.additional,
      encrypted: !!draftEntry.additionalEncrypted,
      encryptionAudience:
        typeof normalizeResponseEncryptionAudience === 'function'
          ? normalizeResponseEncryptionAudience(draftEntry.additionalEncryptionAudience, qid)
          : draftEntry.additionalEncryptionAudience,
      encryptionGateId: draftEntry.additionalEncryptionGateId || null,
      audienceMode:
        typeof normalizeFieldAudienceMode === 'function'
          ? normalizeFieldAudienceMode(draftEntry.additionalAudienceMode, 'additional', draftEntry as UnknownRecord)
          : draftEntry.additionalAudienceMode,
      ...(draftEntry.additionalEncryptedPortion ? { encryptedPortion: draftEntry.additionalEncryptedPortion } : {}),
    };
    if (
      typeof normalizeFieldAudienceMode === 'function' &&
      normalizeFieldAudienceMode(draftEntry.additionalAudienceMode, 'additional', draftEntry as UnknownRecord) ===
        'inherit' &&
      typeof buildInheritedAdditionalFieldState === 'function'
    ) {
      additionalState = buildInheritedAdditionalFieldState(
        additionalState,
        answerState ||
          currentAnswerState ||
          (typeof buildEmptyResponseFieldState === 'function' ? buildEmptyResponseFieldState(qid) : {}),
        qid,
      ) as SurveyDraftQuestionEntry;
    }
    changed = true;
  }

  if (
    (!hasCurrentImportance || allowOverwrite) &&
    draftEntry.importance !== undefined &&
    draftEntry.importance !== null
  ) {
    importanceValue = Number(draftEntry.importance);
    importanceChanged = true;
    changed = true;
  }

  if (
    (!hasCurrentConviction || allowOverwrite) &&
    draftEntry.conviction !== undefined &&
    draftEntry.conviction !== null
  ) {
    convictionValue = Number(draftEntry.conviction);
    convictionChanged = true;
    changed = true;
  }

  return {
    changed,
    answerState,
    additionalState,
    importanceChanged,
    importanceValue,
    convictionChanged,
    convictionValue,
  };
};

export const shouldForceOverwriteDraftValues = ({
  forceOverwrite = false,
  isDirty = false,
  pendingTotal = 0,
  submittedStateActive = false,
}: {
  forceOverwrite?: boolean;
  isDirty?: boolean;
  pendingTotal?: unknown;
  submittedStateActive?: boolean;
} = {}): boolean => !!forceOverwrite && (!!isDirty || Number(pendingTotal || 0) > 0 || !submittedStateActive);

export const updateSubmittedSinceLastEdit = (prevValue = false, transition = ''): boolean => {
  const mode = String(transition || '')
    .trim()
    .toLowerCase();
  if (mode === 'submit_success') return true;
  if (mode === 'user_edit' || mode === 'reset' || mode === 'submit_error') return false;
  return !!prevValue;
};

const hasQuestionMapValue = (
  map: Record<string, unknown> | null | undefined = {},
  questionId: unknown = '',
): boolean => {
  if (!isRecord(map)) return false;
  const rawKey = String(questionId || '');
  const normalizedKey = normalizeQuestionIdKey(questionId);
  const candidates =
    rawKey && normalizedKey && rawKey !== normalizedKey ? [rawKey, normalizedKey] : [rawKey || normalizedKey];
  for (const key of candidates) {
    if (!key) continue;
    if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
    const value = map[key];
    if (value === undefined || value === null) continue;
    return true;
  }
  return false;
};

export const hasConvictionOrImportanceValueForQuestion = (
  slice: {
    conviction?: Record<string, unknown> | null;
    importance?: Record<string, unknown> | null;
  } = {},
  questionId: unknown = '',
): boolean =>
  hasQuestionMapValue(slice?.conviction || {}, questionId) || hasQuestionMapValue(slice?.importance || {}, questionId);

export const shouldAutoEncryptAdditionalOnAudienceChange = (field: SurveyDraftField | null | undefined = {}): boolean =>
  hasMeaningfulFieldValue(field);

export const shouldEncryptResponseFieldForSubmit = (field: SurveyDraftField | null | undefined = {}): boolean =>
  !!field && field.encrypted === true && field.value !== '*' && hasMeaningfulFieldValue(field);

export const buildSurveyDraftCompatScope = (surveyScope: unknown = 'questions'): string => {
  const normalizedScope = String(surveyScope || 'questions');
  return /^questions:q:[^:]+$/.test(normalizedScope) ? 'questions' : normalizedScope;
};

export const buildSurveyDraftStorageKey = ({
  sessionSlug = '',
  networkIdStr = '__pending__',
  account = '',
  surveyScope = 'questions',
}: SurveyDraftStorageKeyArgs = {}): string => {
  const slug = String(sessionSlug || '');
  const networkSegment = String(networkIdStr || '__pending__');
  const accountOwner = String(account || '').toLowerCase() || 'anon';
  const scope = String(surveyScope || 'questions');
  return `dg:surveyDraft:${slug}:${networkSegment}:${accountOwner}:${scope}`;
};

export const buildSurveyDraftStorageVariantKeys = ({
  sessionSlug = '',
  networkIdStr = '',
  account = '',
  surveyScope = 'questions',
  questionId = '',
  includePerQuestionScope = false,
}: SurveyDraftStorageVariantKeysArgs = {}) => {
  const normalizedSessionSlug = String(sessionSlug || '');
  const normalizedScope = String(surveyScope || 'questions');
  const compatScope = buildSurveyDraftCompatScope(normalizedScope);
  const normalizedQuestionId = includePerQuestionScope ? normalizeQuestionIdKey(questionId) : '';
  const perQuestionScope = normalizedQuestionId ? `questions:q:${normalizedQuestionId}` : null;
  const accountOwner = String(account || '').toLowerCase() || 'anon';
  const baseNetworkIdStr = String(networkIdStr || '__pending__');

  const purgeKeys = [
    ...new Set(
      [...new Set(['__pending__', ...(networkIdStr ? [String(networkIdStr)] : [])])].flatMap((net) =>
        [...new Set([accountOwner, 'anon'])].flatMap((owner) =>
          [...new Set([normalizedScope, compatScope, ...(perQuestionScope ? [perQuestionScope] : [])])].map((scope) =>
            buildSurveyDraftStorageKey({
              sessionSlug: normalizedSessionSlug,
              networkIdStr: net,
              account: owner,
              surveyScope: scope,
            }),
          ),
        ),
      ),
    ),
  ];

  return {
    accountOwner,
    baseNetworkIdStr,
    compatScope,
    perQuestionScope,
    primaryAccountKey: buildSurveyDraftStorageKey({
      sessionSlug: normalizedSessionSlug,
      networkIdStr: baseNetworkIdStr,
      account: accountOwner,
      surveyScope: normalizedScope,
    }),
    primaryAnonKey: buildSurveyDraftStorageKey({
      sessionSlug: normalizedSessionSlug,
      networkIdStr: baseNetworkIdStr,
      account: 'anon',
      surveyScope: normalizedScope,
    }),
    compatAccountKey: buildSurveyDraftStorageKey({
      sessionSlug: normalizedSessionSlug,
      networkIdStr: baseNetworkIdStr,
      account: accountOwner,
      surveyScope: compatScope,
    }),
    compatAnonKey: buildSurveyDraftStorageKey({
      sessionSlug: normalizedSessionSlug,
      networkIdStr: baseNetworkIdStr,
      account: 'anon',
      surveyScope: compatScope,
    }),
    pendingAccountKey: buildSurveyDraftStorageKey({
      sessionSlug: normalizedSessionSlug,
      networkIdStr: '__pending__',
      account: accountOwner,
      surveyScope: normalizedScope,
    }),
    perQuestionAccountKey: perQuestionScope
      ? buildSurveyDraftStorageKey({
          sessionSlug: normalizedSessionSlug,
          networkIdStr: baseNetworkIdStr,
          account: accountOwner,
          surveyScope: perQuestionScope,
        })
      : null,
    perQuestionAnonKey: perQuestionScope
      ? buildSurveyDraftStorageKey({
          sessionSlug: normalizedSessionSlug,
          networkIdStr: baseNetworkIdStr,
          account: 'anon',
          surveyScope: perQuestionScope,
        })
      : null,
    purgeKeys,
  };
};

export const buildSurveyDraftLoadPlan = ({
  hasAccount = false,
  primaryAccountKey = '',
  primaryAnonKey = '',
  compatAccountKey = '',
  compatAnonKey = '',
  pendingAccountKey = '',
  perQuestionAccountKey = null,
  perQuestionAnonKey = null,
}: SurveyDraftLoadPlanArgs = {}) => {
  const primaryAccount = String(primaryAccountKey || '').trim();
  const primaryAnon = String(primaryAnonKey || '').trim();
  const targetKey = hasAccount ? primaryAccount : primaryAnon;
  const candidates = hasAccount
    ? [
        { readKey: primaryAccount, writeKey: null },
        { readKey: String(compatAccountKey || '').trim(), writeKey: targetKey },
        { readKey: String(pendingAccountKey || '').trim(), writeKey: targetKey },
        { readKey: String(perQuestionAccountKey || '').trim(), writeKey: targetKey },
        { readKey: primaryAnon, writeKey: targetKey },
        { readKey: String(compatAnonKey || '').trim(), writeKey: targetKey },
        { readKey: String(perQuestionAnonKey || '').trim(), writeKey: targetKey },
      ]
    : [
        { readKey: primaryAnon, writeKey: null },
        { readKey: String(compatAnonKey || '').trim(), writeKey: primaryAnon },
        { readKey: String(pendingAccountKey || '').trim(), writeKey: primaryAnon },
        { readKey: String(perQuestionAnonKey || '').trim(), writeKey: primaryAnon },
      ];

  const seen = new Set<string>();
  return candidates
    .filter(({ readKey, writeKey }) => {
      if (!readKey) return false;
      const normalizedWriteKey = writeKey && writeKey !== readKey ? writeKey : null;
      const signature = `${readKey}::${normalizedWriteKey || ''}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .map(({ readKey, writeKey }) => ({
      readKey,
      writeKey: writeKey && writeKey !== readKey ? writeKey : null,
    }));
};

export const loadPreviousPersistedDraftSnapshot = (
  {
    key = '',
    lastDraftKey = '',
    lastDraftJSON = null,
    lastDraftSemanticSignature = null,
    draftParseCache = null,
  }: PreviousPersistedDraftSnapshotArgs = {},
  {
    readDraftRaw,
    removeDraftRaw,
    buildSemanticSignature,
  }: {
    readDraftRaw: (draftKey: string) => string;
    removeDraftRaw?: ((draftKey: string) => void) | null;
    buildSemanticSignature: (payload: SurveyDraftPayload | null | undefined) => string;
  },
) => {
  const normalizedKey = String(key || '');
  const cachedDraftRaw = draftParseCache && typeof draftParseCache.raw === 'string' ? draftParseCache.raw : null;
  const canUseCachedPrevDraft =
    String(lastDraftKey || '') === normalizedKey &&
    draftParseCache &&
    draftParseCache.key === normalizedKey &&
    cachedDraftRaw !== null &&
    cachedDraftRaw === String(lastDraftJSON ?? '') &&
    draftParseCache.parsed &&
    typeof draftParseCache.parsed === 'object';

  const emptyResult = {
    prevAnswers: {},
    prevBaseline: {},
    prevDraftRaw: '',
    prevSemanticSignature: null,
    nextDraftParseCache: draftParseCache,
    shouldResetDraftTracking: false,
  };

  if (canUseCachedPrevDraft) {
    const parsed = draftParseCache.parsed as SurveyDraftPayload;
    return {
      ...emptyResult,
      prevAnswers: (parsed && typeof parsed === 'object' ? parsed.answers : {}) || {},
      prevBaseline: (parsed && typeof parsed === 'object' ? parsed.baseline : {}) || {},
      prevDraftRaw: String(draftParseCache?.raw || ''),
      prevSemanticSignature: lastDraftSemanticSignature || buildSemanticSignature(parsed),
      nextDraftParseCache: draftParseCache,
    };
  }

  try {
    const raw = String(readDraftRaw(normalizedKey) || '');
    if (!raw) {
      return {
        ...emptyResult,
        nextDraftParseCache: draftParseCache,
      };
    }

    const cacheHit =
      draftParseCache &&
      draftParseCache.key === normalizedKey &&
      draftParseCache.raw === raw &&
      draftParseCache.parsed &&
      typeof draftParseCache.parsed === 'object';
    const parsedResult = cacheHit
      ? { status: 'valid', payload: draftParseCache.parsed as SurveyDraftPayload, raw }
      : parsePersistedDraftStorageValue({ raw, requireAnswers: false });
    if (parsedResult.status !== 'valid') {
      throw new Error('invalid_draft_payload');
    }
    const parsed = parsedResult.payload;

    return {
      ...emptyResult,
      prevAnswers: (parsed && typeof parsed === 'object' ? parsed.answers : {}) || {},
      prevBaseline: (parsed && typeof parsed === 'object' ? parsed.baseline : {}) || {},
      prevDraftRaw: raw,
      prevSemanticSignature: buildSemanticSignature(parsed),
      nextDraftParseCache: cacheHit ? draftParseCache : { key: normalizedKey, raw, parsed },
    };
  } catch {
    try {
      removeDraftRaw && removeDraftRaw(normalizedKey);
    } catch (_) {
      /* noop */
    }
    return {
      ...emptyResult,
      nextDraftParseCache: null,
      shouldResetDraftTracking: true,
    };
  }
};

export const buildPersistedDraftWritePlan = ({
  draftKey = '',
  sessionSlug = '',
  networkIdStr = '',
  account = '',
  surveyScope = 'questions',
  singleQuestionMode = false,
}: PersistedDraftWritePlanArgs = {}) => {
  const normalizedDraftKey = String(draftKey || '').trim();
  const variants = buildSurveyDraftStorageVariantKeys({
    sessionSlug,
    networkIdStr,
    account,
    surveyScope,
  });

  return {
    compatWriteKey:
      singleQuestionMode && variants.compatAccountKey && variants.compatAccountKey !== normalizedDraftKey
        ? variants.compatAccountKey
        : null,
    staleAnonKeys: String(account || '').trim()
      ? [...new Set([variants.primaryAnonKey, variants.compatAnonKey].filter(Boolean))]
      : [],
  };
};

export const buildPersistedDraftQuestionRemovalPlan = ({
  raw = '',
  questionId = '',
  buildSemanticSignature = buildSurveyDraftSemanticSignature,
}: PersistedDraftQuestionRemovalPlanArgs = {}) => {
  const parsedResult = parsePersistedDraftStorageValue({ raw });
  if (parsedResult.status !== 'valid') {
    return {
      action: 'delete-storage',
      removed: false,
      nextPayload: null,
      nextJson: null,
      nextSemanticSignature: null,
    } as const;
  }

  const removal = removeQuestionFromPersistedDraftPayload({
    draftPayload: parsedResult.payload,
    questionId,
  });

  if (removal.action === 'delete') {
    return {
      action: 'delete-storage',
      removed: removal.removed,
      nextPayload: null,
      nextJson: null,
      nextSemanticSignature: null,
    } as const;
  }

  if (removal.action === 'update' && removal.nextPayload) {
    const nextJson = JSON.stringify(removal.nextPayload);
    return {
      action: 'update-storage',
      removed: removal.removed,
      nextPayload: removal.nextPayload,
      nextJson,
      nextSemanticSignature:
        typeof buildSemanticSignature === 'function' ? buildSemanticSignature(removal.nextPayload) : null,
    } as const;
  }

  return {
    action: 'keep',
    removed: removal.removed,
    nextPayload: removal.nextPayload || parsedResult.payload,
    nextJson: null,
    nextSemanticSignature: null,
  } as const;
};

export const buildPersistedDraftQuestionEntry = ({
  questionId = '',
  answer = {},
  additional = {},
  importance = null,
  conviction = null,
  resolvers = {},
}: {
  questionId?: unknown;
  answer?: UnknownRecord | null;
  additional?: UnknownRecord | null;
  importance?: unknown;
  conviction?: unknown;
  resolvers?: PersistedDraftEntryResolvers;
} = {}): SurveyDraftQuestionEntry | null => {
  const qid = normalizeQuestionIdKey(questionId);
  const answerField = isRecord(answer) ? answer : {};
  const additionalField = isRecord(additional) ? additional : {};
  const resolveFieldEncryptionAudience = resolvers.resolveFieldEncryptionAudience;
  const resolveFieldEncryptionGateId = resolvers.resolveFieldEncryptionGateId;
  const normalizeFieldAudienceMode = resolvers.normalizeFieldAudienceMode;

  const hasVal =
    answerField.value !== undefined &&
    answerField.value !== null &&
    (Array.isArray(answerField.value) ? answerField.value.length > 0 : String(answerField.value).length > 0);
  const hasAdd =
    additionalField.value !== undefined && additionalField.value !== null && String(additionalField.value).length > 0;
  const hasImp = importance !== null;
  const hasConv = conviction !== null;

  if (!hasVal && !hasAdd && !hasImp && !hasConv) return null;

  return {
    value: answerField.value,
    answerEncrypted: answerField.encrypted,
    answerEncryptionAudience:
      typeof resolveFieldEncryptionAudience === 'function'
        ? resolveFieldEncryptionAudience(answerField, qid)
        : undefined,
    answerEncryptionGateId:
      typeof resolveFieldEncryptionGateId === 'function'
        ? resolveFieldEncryptionGateId(answerField, qid, 'answer')
        : undefined,
    answerAudienceMode:
      typeof normalizeFieldAudienceMode === 'function'
        ? normalizeFieldAudienceMode(answerField?.audienceMode, 'answer', answerField)
        : undefined,
    ...(answerField.encryptedPortion ? { answerEncryptedPortion: answerField.encryptedPortion } : {}),
    additional: additionalField.value,
    additionalEncrypted: additionalField.encrypted,
    additionalEncryptionAudience:
      typeof resolveFieldEncryptionAudience === 'function'
        ? resolveFieldEncryptionAudience(additionalField, qid, 'additional')
        : undefined,
    additionalEncryptionGateId:
      typeof resolveFieldEncryptionGateId === 'function'
        ? resolveFieldEncryptionGateId(additionalField, qid, 'additional')
        : undefined,
    additionalAudienceMode:
      typeof normalizeFieldAudienceMode === 'function'
        ? normalizeFieldAudienceMode(additionalField?.audienceMode, 'additional', additionalField)
        : undefined,
    ...(additionalField.encryptedPortion ? { additionalEncryptedPortion: additionalField.encryptedPortion } : {}),
    importance,
    conviction,
  };
};

export const buildPersistedDraftMapsForAllowedIds = ({
  allowedQuestionIds = [],
  slice = {},
  baselineSlice = {},
  prevAnswers = {},
  prevBaseline = {},
  resolvers = {},
}: {
  allowedQuestionIds?: unknown[];
  slice?: PersistedDraftSliceLike | null;
  baselineSlice?: PersistedDraftSliceLike | null;
  prevAnswers?: Record<string, SurveyDraftQuestionEntry | unknown> | null;
  prevBaseline?: Record<string, SurveyDraftQuestionEntry | unknown> | null;
  resolvers?: PersistedDraftEntryResolvers;
} = {}) => {
  const answersObj = { ...(isRecord(prevAnswers) ? prevAnswers : {}) };
  const baselineObj = { ...(isRecord(prevBaseline) ? prevBaseline : {}) };
  const normalizedSlice = isRecord(slice) ? slice : {};
  const normalizedBaselineSlice = isRecord(baselineSlice) ? baselineSlice : {};

  allowedQuestionIds.forEach((rawQuestionId) => {
    const qid = normalizeQuestionIdKey(rawQuestionId);
    if (!qid) return;

    const ans = isRecord(normalizedSlice.answers?.[qid]) ? (normalizedSlice.answers?.[qid] as UnknownRecord) : {};
    const add = isRecord(normalizedSlice.additionalComments?.[qid])
      ? (normalizedSlice.additionalComments?.[qid] as UnknownRecord)
      : {};
    const imp =
      normalizedSlice.importance && Object.prototype.hasOwnProperty.call(normalizedSlice.importance, qid)
        ? normalizedSlice.importance[qid]
        : null;
    const conv =
      normalizedSlice.conviction && Object.prototype.hasOwnProperty.call(normalizedSlice.conviction, qid)
        ? normalizedSlice.conviction[qid]
        : null;

    const answerEntry = buildPersistedDraftQuestionEntry({
      questionId: qid,
      answer: ans,
      additional: add,
      importance: imp,
      conviction: conv,
      resolvers,
    });

    if (answerEntry) {
      answersObj[qid] = answerEntry;
    } else if (answersObj[qid]) {
      delete answersObj[qid];
    }

    const bAns = isRecord(normalizedBaselineSlice.answers?.[qid])
      ? (normalizedBaselineSlice.answers?.[qid] as UnknownRecord)
      : {};
    const bAdd = isRecord(normalizedBaselineSlice.additionalComments?.[qid])
      ? (normalizedBaselineSlice.additionalComments?.[qid] as UnknownRecord)
      : {};
    const bImp =
      normalizedBaselineSlice.importance &&
      Object.prototype.hasOwnProperty.call(normalizedBaselineSlice.importance, qid)
        ? normalizedBaselineSlice.importance[qid]
        : null;
    const bConv =
      normalizedBaselineSlice.conviction &&
      Object.prototype.hasOwnProperty.call(normalizedBaselineSlice.conviction, qid)
        ? normalizedBaselineSlice.conviction[qid]
        : null;

    const baselineEntry = buildPersistedDraftQuestionEntry({
      questionId: qid,
      answer: bAns,
      additional: bAdd,
      importance: bImp,
      conviction: bConv,
      resolvers,
    });

    if (baselineEntry) {
      baselineObj[qid] = baselineEntry;
    } else if (baselineObj[qid]) {
      delete baselineObj[qid];
    }
  });

  return { answersObj, baselineObj };
};

export const buildPersistDraftAllowedQuestionIds = ({
  renderedQuestionIds = [],
  dirtyQuestionIds = [],
  slice = {},
}: PersistDraftAllowedIdsArgs = {}) => {
  const normalizedRendered = Array.isArray(renderedQuestionIds)
    ? renderedQuestionIds.map((questionId) => normalizeQuestionIdKey(questionId)).filter(Boolean)
    : [];
  const normalizedDirty = Array.isArray(dirtyQuestionIds)
    ? dirtyQuestionIds.map((questionId) => normalizeQuestionIdKey(questionId)).filter(Boolean)
    : [];

  if (normalizedRendered.length > 0) {
    return [...new Set([...normalizedRendered, ...normalizedDirty])];
  }

  const normalizedSlice = isRecord(slice) ? slice : {};
  return [
    ...new Set(
      [
        ...Object.keys(normalizedSlice.answers || {}),
        ...Object.keys(normalizedSlice.additionalComments || {}),
        ...Object.keys(normalizedSlice.importance || {}),
        ...Object.keys(normalizedSlice.conviction || {}),
      ]
        .map((questionId) => normalizeQuestionIdKey(questionId))
        .filter(Boolean),
    ),
  ];
};

export const buildPersistedDraftPayload = ({
  draftContext = {},
  singleQuestionMode = false,
  questionId = '',
  surveyId = '',
  answersObj = {},
  baselineObj = {},
  now = Date.now(),
}: PersistedDraftPayloadArgs = {}): SurveyDraftPayload => ({
  meta: {
    networkId: isRecord(draftContext) ? draftContext.networkId : undefined,
    surveyId: singleQuestionMode ? questionId || 'questions' : surveyId || 'questions',
    ts: now,
  },
  answers: isRecord(answersObj) ? answersObj : {},
  baseline: isRecord(baselineObj) ? baselineObj : {},
});

export const removeQuestionFromPersistedDraftPayload = ({
  draftPayload = null,
  questionId = '',
}: RemoveQuestionFromPersistedDraftPayloadArgs = {}) => {
  if (!isRecord(draftPayload) || !isRecord(draftPayload.answers)) {
    return {
      action: 'delete',
      nextPayload: null,
      removed: false,
    };
  }

  const qid = normalizeQuestionIdKey(questionId);
  if (!qid) {
    return {
      action: 'keep',
      nextPayload: draftPayload,
      removed: false,
    };
  }

  const nextAnswers = { ...draftPayload.answers };
  const nextBaseline = isRecord(draftPayload.baseline) ? { ...draftPayload.baseline } : draftPayload.baseline;
  let removed = false;

  Object.keys(nextAnswers).forEach((answerKey) => {
    if (normalizeQuestionIdKey(answerKey) !== qid) return;
    delete nextAnswers[answerKey];
    if (isRecord(nextBaseline) && Object.prototype.hasOwnProperty.call(nextBaseline, answerKey)) {
      delete nextBaseline[answerKey];
    }
    removed = true;
  });

  if (!removed) {
    return {
      action: 'keep',
      nextPayload: draftPayload,
      removed: false,
    };
  }

  if (Object.keys(nextAnswers).length === 0) {
    return {
      action: 'delete',
      nextPayload: null,
      removed: true,
    };
  }

  return {
    action: 'update',
    nextPayload: {
      ...draftPayload,
      answers: nextAnswers,
      ...(nextBaseline !== undefined ? { baseline: nextBaseline } : {}),
    },
    removed: true,
  };
};

export function getPendingStatsSnapshotFromState(
  state: PendingStatsState | null | undefined = {},
): PendingStatsSnapshot {
  return {
    total: Number((state && state.modifiedCount) || 0),
    encrypted: Number((state && state.encryptedModifiedCount) || 0),
  };
}

export function computeSubmitLabel(ctx: SubmitLabelContext = {}, opts: SubmitLabelOptions = {}): string {
  const providedStats = isRecord(opts) && isRecord(opts.pendingStats) ? opts.pendingStats : null;
  const stats =
    providedStats ||
    (typeof ctx.getPendingEditStats === 'function' && ctx.getPendingEditStats()) ||
    getPendingStatsSnapshotFromState(ctx.state);

  const pendingCount = Number(stats?.total || 0);
  const base = 'Submit';
  const suffix = opts.suffix ? ` ${String(opts.suffix)}` : '';
  const baseWithSuffix = `${base}${suffix}`;

  return pendingCount > 0 ? `${baseWithSuffix} (${pendingCount})` : baseWithSuffix;
}

export function shouldShowSingleQuestionResponseLookupSpinner({
  singleQuestionMode = false,
  isLoadingResponse = false,
  account = '',
  viewAddress = '',
  responderAddress = '',
}: SingleQuestionResponseLookupSpinnerArgs = {}): boolean {
  if (!singleQuestionMode || !isLoadingResponse) return false;
  const probeAddress = String(responderAddress || viewAddress || account || '').trim();
  return !!probeAddress;
}

export function shouldRenderSubmittedIndicator({
  submittedStateActive = false,
  isLoadingResponse = false,
}: SubmittedIndicatorArgs = {}): boolean {
  return !!submittedStateActive && !isLoadingResponse;
}

export function shouldRenderInlineSubmitButton({
  useHeaderSubmit = false,
  canEditQuestions = false,
  hasPendingEdits = false,
  submittedStateActive = false,
  isLoadingResponse = false,
}: InlineSubmitButtonArgs = {}): boolean {
  if (useHeaderSubmit) return false;
  const submittedIndicatorActive = shouldRenderSubmittedIndicator({
    submittedStateActive,
    isLoadingResponse,
  });
  if (canEditQuestions) return !!hasPendingEdits || submittedIndicatorActive;
  return submittedIndicatorActive;
}
