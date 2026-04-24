type UnknownRecord = Record<string, unknown>;

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

type SurveyDraftPayload = {
  meta?: UnknownRecord | null;
  answers?: Record<string, SurveyDraftQuestionEntry | unknown> | null;
  baseline?: Record<string, SurveyDraftQuestionEntry | unknown> | null;
} & UnknownRecord;

type PendingStatsState = {
  modifiedCount?: unknown;
  encryptedModifiedCount?: unknown;
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

const isRecord = (value: unknown): value is UnknownRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

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
  questionId: string
): SurveyDraftQuestionEntry => {
  if (!map) return {};
  const value = map[questionId];
  return isRecord(value) ? value as SurveyDraftQuestionEntry : {};
};

export const buildSurveyDraftSemanticSignature = (payload: SurveyDraftPayload | null | undefined = {}): string => {
  const safePayload = isRecord(payload) ? payload : {};
  const meta = isRecord(safePayload.meta) ? safePayload.meta : {};
  const answers = isRecord(safePayload.answers) ? safePayload.answers as Record<string, SurveyDraftQuestionEntry | unknown> : {};
  const baseline = isRecord(safePayload.baseline) ? safePayload.baseline as Record<string, SurveyDraftQuestionEntry | unknown> : {};
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
    parts.push(`badditionalEncryptedPortion:${buildStableDraftValueSignature(baselineEntry.additionalEncryptedPortion)}`);
  });
  return parts.join('||');
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
} = {}): boolean => (
  !!forceOverwrite && (
    !!isDirty ||
    Number(pendingTotal || 0) > 0 ||
    !submittedStateActive
  )
);

export const updateSubmittedSinceLastEdit = (prevValue = false, transition = ''): boolean => {
  const mode = String(transition || '').trim().toLowerCase();
  if (mode === 'submit_success') return true;
  if (mode === 'user_edit' || mode === 'reset' || mode === 'submit_error') return false;
  return !!prevValue;
};

const normalizeQuestionIdKey = (value: unknown): string => String(value || '').trim().toLowerCase();

const hasQuestionMapValue = (
  map: Record<string, unknown> | null | undefined = {},
  questionId: unknown = ''
): boolean => {
  if (!isRecord(map)) return false;
  const rawKey = String(questionId || '');
  const normalizedKey = normalizeQuestionIdKey(questionId);
  const candidates = rawKey && normalizedKey && rawKey !== normalizedKey
    ? [rawKey, normalizedKey]
    : [rawKey || normalizedKey];
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
  questionId: unknown = ''
): boolean => (
  hasQuestionMapValue(slice?.conviction || {}, questionId) ||
  hasQuestionMapValue(slice?.importance || {}, questionId)
);

export const shouldAutoEncryptAdditionalOnAudienceChange = (
  field: SurveyDraftField | null | undefined = {}
): boolean => hasMeaningfulFieldValue(field);

export const shouldEncryptResponseFieldForSubmit = (
  field: SurveyDraftField | null | undefined = {}
): boolean => (
  !!field &&
  field.encrypted === true &&
  field.value !== '*' &&
  hasMeaningfulFieldValue(field)
);

export function getPendingStatsSnapshotFromState(state: PendingStatsState | null | undefined = {}): PendingStatsSnapshot {
  return {
    total: Number((state && state.modifiedCount) || 0),
    encrypted: Number((state && state.encryptedModifiedCount) || 0),
  };
}

export function computeSubmitLabel(ctx: SubmitLabelContext = {}, opts: SubmitLabelOptions = {}): string {
  const providedStats = (
    isRecord(opts) &&
    isRecord(opts.pendingStats)
  ) ? opts.pendingStats : null;
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
