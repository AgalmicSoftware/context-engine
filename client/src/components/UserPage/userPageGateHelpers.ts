import { toAnalysisRecord, type UserPageUnknownRecord } from './userPageCoreHelpers';
import { resolveUserPageQuestionSourceSessionSlug } from './userPageAnalysisSessionHelpers';
import { isMaskedQuestionPayload } from '../../utilities/survey/questionRouting.js';

type UserPageGateAccessCacheKeyArgs = {
  account?: unknown;
  networkID?: unknown;
  resourceKey?: unknown;
  sbtCacheRevision?: unknown;
  slug?: unknown;
};
type UserPageGatePendingKeyArgs = {
  resourceKey?: unknown;
  slug?: unknown;
};
type BuildUserPageDecryptedResponsePatchInput = {
  decryptedResult?: unknown;
  fieldToDecrypt?: unknown;
  questionId?: unknown;
  responseObj?: unknown;
};
type BuildUserPageResponseDecryptSurveyBindingsInput = {
  detailedSurveyResponses?: unknown;
  hashZero?: unknown;
  questionId?: unknown;
  questionResponseInfo?: unknown;
  responseOverride?: unknown;
};
type BuildUserPageResponseDecryptRequestPlanInput = BuildUserPageResponseDecryptSurveyBindingsInput & {
  account?: unknown;
  litHooks?: unknown;
  networkId?: unknown;
  provider?: unknown;
};
type BuildUserPageDecryptedResponseStatePatchInput = {
  patchedResponse?: unknown;
  previousState?: unknown;
  questionId?: unknown;
  responseOverride?: unknown;
};
export type UserPageGateAccessStatusByResource = {
  resourceKey: string;
  status: string;
};
export type UserPageEncryptedVisibilityDisplayState = {
  visible: boolean;
  canDecryptOtherResponses: boolean;
  uncertain: boolean;
  pendingResourceKeys: string[];
  uncertainResourceKey: string;
};
export type UserPageEncryptedVisibilityStatusRequestPlan =
  | {
      action: 'terminal';
      displayState: UserPageEncryptedVisibilityDisplayState;
      resourceKeysToCheck: [];
      terminalReason: 'own-profile' | 'self-audience' | 'missing-viewer-account';
    }
  | {
      action: 'read-statuses';
      displayState: null;
      resourceKeysToCheck: string[];
      terminalReason: '';
    };
type BuildUserPageEncryptedVisibilityDisplayStateInput = {
  encryptionAudience?: unknown;
  resourceKey?: unknown;
  statusByResource?: UserPageGateAccessStatusByResource[];
  viewAddressLower?: unknown;
  viewerAccount?: unknown;
};
type BuildUserPageEncryptedVisibilityStatusRequestPlanInput = {
  encryptionAudience?: unknown;
  resourceKey?: unknown;
  viewAddressLower?: unknown;
  viewerAccount?: unknown;
};
type BuildUserPageSurveyResponseSourceDescriptorInput = {
  surveyId?: unknown;
  surveyResponseSourceSlugById?: unknown;
  surveyResponseSourceSlugByKey?: unknown;
  surveySourceSlugById?: unknown;
  viewAddressLower?: unknown;
};
type BuildUserPageQuestionResponseSourceDescriptorInput = {
  getSessionSlugByName?: ((sessionName: unknown) => unknown) | null;
  questionData?: unknown;
  questionId?: unknown;
  questionResponseSourceSlugById?: unknown;
  questionResponseSourceSlugByKey?: unknown;
  questionSourceSlugById?: unknown;
  viewAddressLower?: unknown;
};
type BuildUserPageGateAccessCheckPlanInput = {
  cachedStatus?: unknown;
  cachedTs?: unknown;
  hasCachedEntry?: unknown;
  hasInFlight?: unknown;
  nowMs?: unknown;
  terminalRecheckMs?: unknown;
  unknownRetryMs?: unknown;
};
type BuildUserPageGateAccessRequestDescriptorInput = {
  account?: unknown;
  networkID?: unknown;
  pendingKey?: unknown;
  sbtCacheRevision?: unknown;
};
type DispatchUserPageGateAccessCheckThroughPortInput = {
  checkGateAccess?: UserPageGateAccessCheckPort | null;
  requestDescriptor?: UserPageGateAccessRequestDescriptor | null;
  sessionConfig?: Record<string, unknown> | null;
};
type BuildUserPageGateAccessSettlementPlanInput = {
  resultStatus?: unknown;
  previousStatus?: unknown;
  shouldPreserveStatusWhileRevalidating?: unknown;
};
type BuildUserPageGateRetryTimerPlanInput = {
  currentDueAt?: unknown;
  delayMs?: unknown;
  fallbackDelayMs?: unknown;
  hasCurrentTimer?: unknown;
  isMounted?: unknown;
  nowMs?: unknown;
};
export type UserPageGateAccessCheckPlanAction = 'execute' | 'in-flight' | 'schedule-retry' | 'skip';
export type UserPageGateAccessCheckPlan = {
  action: UserPageGateAccessCheckPlanAction;
  cachedAgeMs: number;
  previousStatus: string;
  readinessDescriptor: UserPageGateAccessReadinessDescriptor;
  retryDelayMs: number;
  shouldPreserveStatusWhileRevalidating: boolean;
  shouldSetCheckingStatus: boolean;
};
export type UserPageGateAccessReadinessDescriptor = {
  hasCachedEntry: boolean;
  hasInFlight: boolean;
  isRetryDelayActive: boolean;
  isStaleTerminalStatus: boolean;
  isTerminalStatus: boolean;
  isTransientRetryStatus: boolean;
};
export type UserPageGateAccessRequestDescriptor = {
  account: string;
  cacheKey: string;
  pendingKey: string;
  resourceKey: string;
  sessionSlug: string;
  sponsoredAccessRequest: {
    account: string;
    resourceKey: string;
    sessionSlug: string;
  };
};
export type UserPageGateAccessCheckPortRequest = {
  account: string;
  resourceKey: string;
  sessionConfig?: Record<string, unknown> | null;
  sessionSlug: string;
};
export type UserPageGateAccessCheckPort = (request: UserPageGateAccessCheckPortRequest) => Promise<unknown>;
export type UserPageGateAccessDispatchResult =
  | {
      action: 'skip';
      cacheKey: string;
      pendingKey: string;
      promise: null;
      reason: 'missing-descriptor' | 'missing-port';
      requestDescriptor: UserPageGateAccessRequestDescriptor | null;
      sponsoredAccessRequest: null;
    }
  | {
      action: 'dispatch';
      cacheKey: string;
      pendingKey: string;
      promise: Promise<unknown>;
      reason: '';
      requestDescriptor: UserPageGateAccessRequestDescriptor;
      sponsoredAccessRequest: UserPageGateAccessCheckPortRequest;
    };
export type UserPageGateAccessSettlementPlan = {
  nextStatus: string;
  shouldQueueCacheRefresh: boolean;
  shouldScheduleRetry: boolean;
};
export type UserPageGateRetryTimerPlan = {
  action: 'ignore-unmounted' | 'keep-existing' | 'schedule';
  nextDueAt: number;
  safeDelayMs: number;
  shouldClearExistingTimer: boolean;
  shouldScheduleTimer: boolean;
};
export type UserPageDecryptableResponseField = UserPageUnknownRecord & {
  encrypted: boolean;
  value: unknown;
};
export type UserPageResponseDecryptSurveyBindings = {
  surveyId: string;
  acceptedSurveyIds: string[];
};
export type UserPageGatedResponseSourceDescriptor = {
  fallbackSlug: string;
  responseSourceKey: string;
  sourceSlug: string;
};
export type UserPageResponseDecryptRequestPlan = {
  account: string;
  blockedReason: '' | 'missing-account' | 'missing-question' | 'missing-response';
  cryptoOptions: {
    acceptedSurveyIds: string[];
    account: string;
    chainId: number;
    lit: { getKey: unknown } | null;
    provider: unknown;
    providerKind: unknown;
    surveyId: string;
    throwOnError: true;
  } | null;
  questionId: string;
  responseSlice: {
    answers: Record<string, UserPageDecryptableResponseField>;
    additionalComments: Record<string, UserPageDecryptableResponseField>;
    importance: Record<string, unknown>;
    conviction: Record<string, unknown>;
  } | null;
  status: 'blocked' | 'ready';
};
export type UserPageDecryptedResponseStatePatchResult = {
  didUpdate: boolean;
  statePatch: UserPageUnknownRecord | null;
};

export const normalizeUserPageGateSlug = (slug: unknown): string => {
  const raw = String(slug || '')
    .trim()
    .toLowerCase();
  return raw === 'general' ? '' : raw;
};

export const normalizeUserPageSourceSlugForSignature = (rawSlug: unknown): string => {
  const normalized = normalizeUserPageGateSlug(rawSlug || '');
  return normalized || 'general';
};

export const normalizeUserPageGateResourceKey = (resourceKey: unknown): string =>
  String(resourceKey || '').trim() || 'default';

const readUserPageSourceSlug = (sourceSlugById: unknown, key: unknown): string => {
  const sourceMap = toAnalysisRecord(sourceSlugById);
  const rawKey = String(key || '').trim();
  const lowerKey = rawKey.toLowerCase();
  return String(sourceMap[rawKey] || sourceMap[lowerKey] || '');
};

export const buildUserPageSurveyResponseSourceDescriptor = ({
  surveyId = '',
  surveyResponseSourceSlugById = null,
  surveyResponseSourceSlugByKey = null,
  surveySourceSlugById = null,
  viewAddressLower = '',
}: BuildUserPageSurveyResponseSourceDescriptorInput = {}): UserPageGatedResponseSourceDescriptor => {
  const surveyIdLower = String(surveyId || '')
    .trim()
    .toLowerCase();
  const viewAddressKey = String(viewAddressLower || '')
    .trim()
    .toLowerCase();
  const responseSourceKey = `${surveyIdLower}|${viewAddressKey}`;
  const fallbackSlug =
    readUserPageSourceSlug(surveyResponseSourceSlugByKey, responseSourceKey) ||
    readUserPageSourceSlug(surveyResponseSourceSlugById, surveyIdLower) ||
    readUserPageSourceSlug(surveySourceSlugById, surveyIdLower);
  return {
    fallbackSlug,
    responseSourceKey,
    sourceSlug: fallbackSlug,
  };
};

export const buildUserPageQuestionResponseSourceDescriptor = ({
  getSessionSlugByName = null,
  questionData = null,
  questionId = '',
  questionResponseSourceSlugById = null,
  questionResponseSourceSlugByKey = null,
  questionSourceSlugById = null,
  viewAddressLower = '',
}: BuildUserPageQuestionResponseSourceDescriptorInput = {}): UserPageGatedResponseSourceDescriptor => {
  const questionIdLower = String(questionId || '')
    .trim()
    .toLowerCase();
  const viewAddressKey = String(viewAddressLower || '')
    .trim()
    .toLowerCase();
  const responseSourceKey = `${questionIdLower}|${viewAddressKey}`;
  const fallbackSlug =
    readUserPageSourceSlug(questionResponseSourceSlugByKey, responseSourceKey) ||
    readUserPageSourceSlug(questionResponseSourceSlugById, questionIdLower) ||
    readUserPageSourceSlug(questionSourceSlugById, questionIdLower);
  const sourceSlug = resolveUserPageQuestionSourceSessionSlug({
    fallbackSlug,
    getSessionSlugByName: typeof getSessionSlugByName === 'function' ? getSessionSlugByName : () => null,
    questionData,
  });
  return {
    fallbackSlug,
    responseSourceKey,
    sourceSlug,
  };
};

export const buildUserPageGateAccessCacheKey = ({
  account = '',
  networkID = '',
  resourceKey = '',
  sbtCacheRevision = 0,
  slug = '',
}: UserPageGateAccessCacheKeyArgs = {}): string => {
  const accountLower = String(account || '')
    .trim()
    .toLowerCase();
  return [
    accountLower || 'anon',
    String(networkID || ''),
    String(sbtCacheRevision || 0),
    normalizeUserPageGateSlug(slug),
    normalizeUserPageGateResourceKey(resourceKey),
  ].join('|');
};

export const buildUserPageGatePendingKey = ({ slug = '', resourceKey = '' }: UserPageGatePendingKeyArgs = {}): string =>
  `${normalizeUserPageGateSlug(slug)}::${normalizeUserPageGateResourceKey(resourceKey)}`;

export const buildUserPageGateAccessRequestDescriptor = ({
  account = '',
  networkID = '',
  pendingKey = '',
  sbtCacheRevision = 0,
}: BuildUserPageGateAccessRequestDescriptorInput = {}): UserPageGateAccessRequestDescriptor => {
  const normalizedPendingKey = String(pendingKey || '');
  const [slugRaw, resourceRaw] = normalizedPendingKey.split('::');
  const sessionSlug = normalizeUserPageGateSlug(slugRaw || '');
  const resourceKey = normalizeUserPageGateResourceKey(resourceRaw || '');
  const normalizedAccount = String(account || '').trim();
  return {
    account: normalizedAccount,
    cacheKey: buildUserPageGateAccessCacheKey({
      account: normalizedAccount,
      networkID,
      resourceKey,
      sbtCacheRevision,
      slug: sessionSlug,
    }),
    pendingKey: buildUserPageGatePendingKey({ slug: sessionSlug, resourceKey }),
    resourceKey,
    sessionSlug,
    sponsoredAccessRequest: {
      account: normalizedAccount,
      resourceKey,
      sessionSlug,
    },
  };
};

export const dispatchUserPageGateAccessCheckThroughPort = ({
  checkGateAccess = null,
  requestDescriptor = null,
  sessionConfig = {},
}: DispatchUserPageGateAccessCheckThroughPortInput = {}): UserPageGateAccessDispatchResult => {
  if (!requestDescriptor) {
    return {
      action: 'skip',
      cacheKey: '',
      pendingKey: '',
      promise: null,
      reason: 'missing-descriptor',
      requestDescriptor: null,
      sponsoredAccessRequest: null,
    };
  }
  if (typeof checkGateAccess !== 'function') {
    return {
      action: 'skip',
      cacheKey: requestDescriptor.cacheKey,
      pendingKey: requestDescriptor.pendingKey,
      promise: null,
      reason: 'missing-port',
      requestDescriptor,
      sponsoredAccessRequest: null,
    };
  }
  const sponsoredAccessRequest: UserPageGateAccessCheckPortRequest = {
    sessionConfig,
    ...requestDescriptor.sponsoredAccessRequest,
  };
  return {
    action: 'dispatch',
    cacheKey: requestDescriptor.cacheKey,
    pendingKey: requestDescriptor.pendingKey,
    promise: checkGateAccess(sponsoredAccessRequest),
    reason: '',
    requestDescriptor,
    sponsoredAccessRequest,
  };
};

export const buildUserPageGateAccessSettlementPlan = ({
  resultStatus = 'unknown',
  previousStatus = 'missing',
  shouldPreserveStatusWhileRevalidating = false,
}: BuildUserPageGateAccessSettlementPlanInput = {}): UserPageGateAccessSettlementPlan => {
  const nextStatus = String(resultStatus || 'unknown');
  const priorStatus = String(previousStatus || 'missing');
  return {
    nextStatus,
    shouldQueueCacheRefresh: nextStatus !== priorStatus || !shouldPreserveStatusWhileRevalidating,
    shouldScheduleRetry: nextStatus === 'unknown' || nextStatus === 'error' || nextStatus === 'unresolved',
  };
};

export const buildUserPageGateRetryTimerPlan = ({
  currentDueAt = 0,
  delayMs = 30 * 1000,
  fallbackDelayMs = 30 * 1000,
  hasCurrentTimer = false,
  isMounted = true,
  nowMs = Date.now(),
}: BuildUserPageGateRetryTimerPlanInput = {}): UserPageGateRetryTimerPlan => {
  const safeDelayMs = Math.max(1000, Number(delayMs) || Number(fallbackDelayMs) || 30 * 1000);
  const nextDueAt = Number(nowMs || 0) + safeDelayMs;
  const existingDueAt = Number(currentDueAt || 0);
  if (!isMounted) {
    return {
      action: 'ignore-unmounted',
      nextDueAt,
      safeDelayMs,
      shouldClearExistingTimer: false,
      shouldScheduleTimer: false,
    };
  }
  if (hasCurrentTimer && existingDueAt > 0 && existingDueAt <= nextDueAt) {
    return {
      action: 'keep-existing',
      nextDueAt,
      safeDelayMs,
      shouldClearExistingTimer: false,
      shouldScheduleTimer: false,
    };
  }
  return {
    action: 'schedule',
    nextDueAt,
    safeDelayMs,
    shouldClearExistingTimer: !!hasCurrentTimer && existingDueAt > 0,
    shouldScheduleTimer: true,
  };
};

export const getUserPageGateResourceKeysToCheck = (resourceKey: unknown = 'default'): string[] => {
  const normalized = normalizeUserPageGateResourceKey(resourceKey);
  if (normalized === 'default') return ['default'];
  return [normalized, 'default'];
};

export const buildUserPageEncryptedVisibilityStatusRequestPlan = ({
  encryptionAudience = 'gate',
  resourceKey = 'default',
  viewAddressLower = '',
  viewerAccount = '',
}: BuildUserPageEncryptedVisibilityStatusRequestPlanInput = {}): UserPageEncryptedVisibilityStatusRequestPlan => {
  const viewerAccountLower = String(viewerAccount || '')
    .trim()
    .toLowerCase();
  const isOwnProfileViewer =
    !!viewerAccountLower && viewerAccountLower === String(viewAddressLower || '').toLowerCase();

  if (isOwnProfileViewer) {
    return {
      action: 'terminal',
      displayState: buildUserPageEncryptedVisibilityDisplayState({
        encryptionAudience,
        resourceKey,
        viewAddressLower,
        viewerAccount,
      }),
      resourceKeysToCheck: [],
      terminalReason: 'own-profile',
    };
  }

  const normalizedAudience = String(encryptionAudience || '')
    .trim()
    .toLowerCase();
  if (normalizedAudience === 'self') {
    return {
      action: 'terminal',
      displayState: buildUserPageEncryptedVisibilityDisplayState({
        encryptionAudience,
        resourceKey,
        viewAddressLower,
        viewerAccount,
      }),
      resourceKeysToCheck: [],
      terminalReason: 'self-audience',
    };
  }

  if (!viewerAccountLower) {
    return {
      action: 'terminal',
      displayState: {
        visible: false,
        canDecryptOtherResponses: false,
        uncertain: false,
        pendingResourceKeys: [],
        uncertainResourceKey: '',
      },
      resourceKeysToCheck: [],
      terminalReason: 'missing-viewer-account',
    };
  }

  return {
    action: 'read-statuses',
    displayState: null,
    resourceKeysToCheck: getUserPageGateResourceKeysToCheck(resourceKey),
    terminalReason: '',
  };
};

export const buildUserPageEncryptedVisibilityDisplayState = ({
  encryptionAudience = 'gate',
  resourceKey = 'default',
  statusByResource = [],
  viewAddressLower = '',
  viewerAccount = '',
}: BuildUserPageEncryptedVisibilityDisplayStateInput = {}): UserPageEncryptedVisibilityDisplayState => {
  const viewerAccountLower = String(viewerAccount || '')
    .trim()
    .toLowerCase();
  const isOwnProfileViewer =
    !!viewerAccountLower && viewerAccountLower === String(viewAddressLower || '').toLowerCase();
  if (isOwnProfileViewer) {
    return {
      visible: true,
      canDecryptOtherResponses: true,
      uncertain: false,
      pendingResourceKeys: [],
      uncertainResourceKey: '',
    };
  }

  const normalizedAudience = String(encryptionAudience || '')
    .trim()
    .toLowerCase();
  if (normalizedAudience === 'self') {
    return {
      visible: false,
      canDecryptOtherResponses: false,
      uncertain: false,
      pendingResourceKeys: [],
      uncertainResourceKey: '',
    };
  }

  const normalizedStatuses = (
    Array.isArray(statusByResource) && statusByResource.length
      ? statusByResource
      : getUserPageGateResourceKeysToCheck(resourceKey).map((key) => ({
          resourceKey: key,
          status: 'unknown',
        }))
  ).map((entry) => ({
    resourceKey: normalizeUserPageGateResourceKey(entry?.resourceKey),
    status: String(entry?.status || 'unknown') || 'unknown',
  }));
  const pendingResourceKeys = viewerAccountLower ? normalizedStatuses.map((entry) => entry.resourceKey) : [];

  if (normalizedStatuses.some((entry) => entry.status === 'granted')) {
    return {
      visible: true,
      canDecryptOtherResponses: true,
      uncertain: false,
      pendingResourceKeys,
      uncertainResourceKey: '',
    };
  }

  const terminalDeniedStatuses = new Set<string>(['denied', 'needs-wallet', 'no-gate', 'invalid-gate']);
  const hasUncertainStatus = normalizedStatuses.some((entry) => !terminalDeniedStatuses.has(entry.status));
  if (!hasUncertainStatus) {
    return {
      visible: false,
      canDecryptOtherResponses: false,
      uncertain: false,
      pendingResourceKeys,
      uncertainResourceKey: '',
    };
  }

  return {
    visible: false,
    canDecryptOtherResponses: false,
    uncertain: true,
    pendingResourceKeys,
    uncertainResourceKey: normalizeUserPageGateResourceKey(resourceKey),
  };
};

const USER_PAGE_GATE_TERMINAL_STATUSES = new Set<string>([
  'granted',
  'denied',
  'needs-wallet',
  'no-gate',
  'invalid-gate',
]);

const USER_PAGE_GATE_TRANSIENT_RETRY_STATUSES = new Set<string>(['unknown', 'error', 'unresolved']);

const buildUserPageGateAccessReadinessDescriptor = ({
  cachedAgeMs,
  hasCached,
  hasInFlight,
  previousStatus,
  retryMs,
  terminalMs,
}: {
  cachedAgeMs: number;
  hasCached: boolean;
  hasInFlight: boolean;
  previousStatus: string;
  retryMs: number;
  terminalMs: number;
}): UserPageGateAccessReadinessDescriptor => {
  const isTerminalStatus = USER_PAGE_GATE_TERMINAL_STATUSES.has(previousStatus);
  const isTransientRetryStatus = USER_PAGE_GATE_TRANSIENT_RETRY_STATUSES.has(previousStatus);
  return {
    hasCachedEntry: hasCached,
    hasInFlight,
    isRetryDelayActive: hasCached && isTransientRetryStatus && cachedAgeMs < retryMs,
    isStaleTerminalStatus: hasCached && isTerminalStatus && cachedAgeMs >= terminalMs,
    isTerminalStatus,
    isTransientRetryStatus,
  };
};

export const buildUserPageGateAccessCheckPlan = ({
  cachedStatus = 'missing',
  cachedTs = 0,
  hasCachedEntry = false,
  hasInFlight = false,
  nowMs = Number.POSITIVE_INFINITY,
  terminalRecheckMs = 60 * 1000,
  unknownRetryMs = 30 * 1000,
}: BuildUserPageGateAccessCheckPlanInput = {}): UserPageGateAccessCheckPlan => {
  const previousStatus = String(cachedStatus || 'missing');
  const cachedTsNumber = Number(cachedTs || 0);
  const cachedAgeMs =
    Number.isFinite(cachedTsNumber) && cachedTsNumber > 0
      ? Math.max(0, Number(nowMs || 0) - cachedTsNumber)
      : Number.POSITIVE_INFINITY;
  const terminalMs = Math.max(0, Number(terminalRecheckMs) || 0);
  const retryMs = Math.max(0, Number(unknownRetryMs) || 0);
  const hasCached = !!hasCachedEntry;
  const readinessDescriptor = buildUserPageGateAccessReadinessDescriptor({
    cachedAgeMs,
    hasCached,
    hasInFlight: !!hasInFlight,
    previousStatus,
    retryMs,
    terminalMs,
  });

  if (hasCached && USER_PAGE_GATE_TERMINAL_STATUSES.has(previousStatus) && cachedAgeMs < terminalMs) {
    return {
      action: 'skip',
      cachedAgeMs,
      previousStatus,
      readinessDescriptor,
      retryDelayMs: 0,
      shouldPreserveStatusWhileRevalidating: false,
      shouldSetCheckingStatus: false,
    };
  }

  if (hasCached && USER_PAGE_GATE_TRANSIENT_RETRY_STATUSES.has(previousStatus) && cachedAgeMs < retryMs) {
    return {
      action: 'schedule-retry',
      cachedAgeMs,
      previousStatus,
      readinessDescriptor,
      retryDelayMs: retryMs - cachedAgeMs,
      shouldPreserveStatusWhileRevalidating: false,
      shouldSetCheckingStatus: false,
    };
  }

  if (hasInFlight) {
    return {
      action: 'in-flight',
      cachedAgeMs,
      previousStatus,
      readinessDescriptor,
      retryDelayMs: 0,
      shouldPreserveStatusWhileRevalidating: false,
      shouldSetCheckingStatus: false,
    };
  }

  const shouldPreserveStatusWhileRevalidating = !!(
    hasCached &&
    USER_PAGE_GATE_TERMINAL_STATUSES.has(previousStatus) &&
    cachedAgeMs >= terminalMs
  );
  return {
    action: 'execute',
    cachedAgeMs,
    previousStatus,
    readinessDescriptor,
    retryDelayMs: 0,
    shouldPreserveStatusWhileRevalidating,
    shouldSetCheckingStatus: !shouldPreserveStatusWhileRevalidating,
  };
};

export const isUserPageEncryptedResponseField = (fieldObj: unknown = null): boolean => {
  const fieldRecord = toAnalysisRecord(fieldObj);
  if (!Object.keys(fieldRecord).length) return false;
  return !!(
    fieldRecord.encrypted ||
    fieldRecord.encryptedPortion ||
    (fieldRecord.value === '*' &&
      (fieldRecord.encryptionAudience || fieldRecord.encrypted || fieldRecord.encryptedPortion))
  );
};

export const isUserPageAnswerFieldEncrypted = (responseObj: unknown = null): boolean => {
  const responseRecord = toAnalysisRecord(responseObj);
  if (!Object.keys(responseRecord).length) return false;
  return isUserPageEncryptedResponseField(responseRecord.answer || {});
};

export const isUserPageAdditionalFieldEncrypted = (responseObj: unknown = null): boolean => {
  const responseRecord = toAnalysisRecord(responseObj);
  if (!Object.keys(responseRecord).length) return false;
  return isUserPageEncryptedResponseField(responseRecord.additional || {});
};

export const isUserPageResponsePayloadEncrypted = (responseObj: unknown = null): boolean =>
  isUserPageAnswerFieldEncrypted(responseObj) || isUserPageAdditionalFieldEncrypted(responseObj);

export const isUserPageQuestionPayloadEncrypted = (questionObj: unknown = null): boolean => {
  const questionRecord = toAnalysisRecord(questionObj);
  if (!Object.keys(questionRecord).length) return false;
  if (isMaskedQuestionPayload(questionRecord)) return true;
  return !!(
    questionRecord.promptEncrypted ||
    questionRecord.encryptedPrompt ||
    questionRecord.optionsEncrypted ||
    questionRecord.encryptedOptions ||
    questionRecord.tagsEncrypted ||
    questionRecord.encryptedTags
  );
};

export const inferUserPageResponseFieldEncryptionAudience = (
  responseObj: unknown = null,
  fieldKey: unknown = 'answer',
  fallback: unknown = 'gate',
): string => {
  const responseRecord = toAnalysisRecord(responseObj);
  const fieldRecord = toAnalysisRecord(responseRecord[String(fieldKey || '')]);
  const rawAudience = String(fieldRecord.encryptionAudience || '')
    .trim()
    .toLowerCase();
  if (rawAudience === 'gate' || rawAudience === 'self') return rawAudience;
  return (
    String(fallback || 'gate')
      .trim()
      .toLowerCase() || 'gate'
  );
};

export const inferUserPageResponseEncryptionAudience = (
  responseObj: unknown = null,
  fallback: unknown = 'gate',
): string => {
  const answerAudience = inferUserPageResponseFieldEncryptionAudience(responseObj, 'answer', fallback);
  const additionalAudience = inferUserPageResponseFieldEncryptionAudience(responseObj, 'additional', fallback);
  if (answerAudience === 'self' && additionalAudience === 'self') return 'self';
  if (answerAudience === 'gate' || additionalAudience === 'gate') return 'gate';
  if (answerAudience === 'self' || additionalAudience === 'self') return 'self';
  return (
    String(fallback || 'gate')
      .trim()
      .toLowerCase() || 'gate'
  );
};

export const buildUserPageDecryptableResponseField = (field: unknown = null): UserPageDecryptableResponseField => {
  const safeField = toAnalysisRecord(field);
  return {
    ...(safeField || {}),
    value: Object.prototype.hasOwnProperty.call(safeField, 'value') ? safeField.value : '',
    encrypted: !!(safeField.encrypted || safeField.encryptedPortion),
  };
};

export const applyUserPageDecryptedPatchToResponseField = (
  field: unknown = null,
  decryptedPatch: unknown = null,
): unknown => {
  const patchRecord = toAnalysisRecord(decryptedPatch);
  if (!Object.prototype.hasOwnProperty.call(patchRecord, 'value')) {
    return field;
  }
  const nextField: UserPageUnknownRecord = {
    ...toAnalysisRecord(field),
    value: patchRecord.value,
    encrypted: false,
  };
  if (Object.prototype.hasOwnProperty.call(patchRecord, 'zkSalt')) {
    nextField.zkSalt = patchRecord.zkSalt;
  }
  delete nextField.encryptedPortion;
  return nextField;
};

export const buildUserPageDecryptedResponsePatch = ({
  responseObj = null,
  questionId = '',
  fieldToDecrypt = 'both',
  decryptedResult = null,
}: BuildUserPageDecryptedResponsePatchInput = {}): UserPageUnknownRecord | null => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  const responseRecord = toAnalysisRecord(responseObj);
  if (!Object.keys(responseRecord).length || !qid) return null;
  const decryptedRecord = toAnalysisRecord(decryptedResult);
  const decryptedAnswers = toAnalysisRecord(decryptedRecord.answers);
  const decryptedAdditionalComments = toAnalysisRecord(decryptedRecord.additionalComments);
  const decryptedAnswer = toAnalysisRecord(decryptedAnswers[qid]);
  const decryptedAdditional = toAnalysisRecord(decryptedAdditionalComments[qid]);
  const shouldPatchAnswer =
    (fieldToDecrypt === 'answer' || fieldToDecrypt === 'both') &&
    Object.prototype.hasOwnProperty.call(decryptedAnswer, 'value');
  const shouldPatchAdditional =
    (fieldToDecrypt === 'additional' || fieldToDecrypt === 'both') &&
    Object.prototype.hasOwnProperty.call(decryptedAdditional, 'value');

  if (!shouldPatchAnswer && !shouldPatchAdditional) return null;

  const nextResponse: UserPageUnknownRecord = {
    ...responseRecord,
  };
  if (shouldPatchAnswer) {
    nextResponse.answer = applyUserPageDecryptedPatchToResponseField(responseRecord.answer, decryptedAnswer);
  }
  if (shouldPatchAdditional) {
    nextResponse.additional = applyUserPageDecryptedPatchToResponseField(
      responseRecord.additional,
      decryptedAdditional,
    );
  }
  return nextResponse;
};

export const buildUserPageResponseDecryptSurveyBindings = ({
  detailedSurveyResponses = null,
  hashZero = '',
  questionId = '',
  questionResponseInfo = [],
  responseOverride = null,
}: BuildUserPageResponseDecryptSurveyBindingsInput = {}): UserPageResponseDecryptSurveyBindings => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  const surveyIds: string[] = [];
  const seen = new Set<string>();
  const pushSurveyId = (value: unknown): void => {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    surveyIds.push(normalized);
  };
  const addFromEntry = (entry: unknown): void => {
    const entryRecord = toAnalysisRecord(entry);
    if (!Object.keys(entryRecord).length) return;
    pushSurveyId(entryRecord.associatedSurveyId);
    pushSurveyId(entryRecord.surveyId);
    pushSurveyId(entryRecord.surveyID);
  };

  addFromEntry(responseOverride);

  const responseInfoEntries = Array.isArray(questionResponseInfo) ? questionResponseInfo : [];
  responseInfoEntries.forEach((entry: unknown) => {
    const entryRecord = toAnalysisRecord(entry);
    if (
      String(entryRecord.id || '')
        .trim()
        .toLowerCase() !== qid
    )
      return;
    addFromEntry(entryRecord);
  });

  const detailedResponsesRecord = toAnalysisRecord(detailedSurveyResponses);
  Object.keys(detailedResponsesRecord).forEach((surveyId: string) => {
    const entries = Array.isArray(detailedResponsesRecord[surveyId]) ? detailedResponsesRecord[surveyId] : [];
    entries.forEach((entry: unknown) => {
      const entryRecord = toAnalysisRecord(entry);
      const questionData = toAnalysisRecord(entryRecord.questionData);
      const responseData = entryRecord.responseData;
      const entryQid = String(questionData.id || questionData.questionID || '')
        .trim()
        .toLowerCase();
      if (responseOverride == null) {
        if (entryQid !== qid) return;
      } else if (responseData !== responseOverride && entryQid !== qid) {
        return;
      }
      pushSurveyId(surveyId);
      addFromEntry(questionData);
      addFromEntry(responseData);
    });
  });

  pushSurveyId(hashZero);
  return {
    surveyId: surveyIds[0] || String(hashZero || ''),
    acceptedSurveyIds: surveyIds,
  };
};

export const buildUserPageResponseDecryptRequestPlan = ({
  account = '',
  detailedSurveyResponses = null,
  hashZero = '',
  litHooks = null,
  networkId = 0,
  provider = null,
  questionId = '',
  questionResponseInfo = [],
  responseOverride = null,
}: BuildUserPageResponseDecryptRequestPlanInput = {}): UserPageResponseDecryptRequestPlan => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  const normalizedAccount = String(account || '').trim();
  const blockedPlan = (
    blockedReason: UserPageResponseDecryptRequestPlan['blockedReason'],
  ): UserPageResponseDecryptRequestPlan => ({
    account: normalizedAccount,
    blockedReason,
    cryptoOptions: null,
    questionId: qid,
    responseSlice: null,
    status: 'blocked',
  });
  if (!qid) return blockedPlan('missing-question');
  if (!normalizedAccount) return blockedPlan('missing-account');

  const responseRecord = toAnalysisRecord(responseOverride);
  if (!Object.keys(responseRecord).length) return blockedPlan('missing-response');

  const hooksRecord = toAnalysisRecord(litHooks);
  const lit = typeof hooksRecord.getKey === 'function' ? { getKey: hooksRecord.getKey } : null;
  const { surveyId, acceptedSurveyIds } = buildUserPageResponseDecryptSurveyBindings({
    detailedSurveyResponses,
    hashZero,
    questionId: qid,
    questionResponseInfo,
    responseOverride,
  });

  return {
    account: normalizedAccount,
    blockedReason: '',
    cryptoOptions: {
      account: normalizedAccount,
      provider,
      providerKind: provider,
      chainId: Number(networkId ?? 0) || 0,
      surveyId,
      acceptedSurveyIds,
      lit,
      throwOnError: true,
    },
    questionId: qid,
    responseSlice: {
      answers: {
        [qid]: buildUserPageDecryptableResponseField(responseRecord.answer),
      },
      additionalComments: {
        [qid]: buildUserPageDecryptableResponseField(responseRecord.additional),
      },
      importance: {},
      conviction: {},
    },
    status: 'ready',
  };
};

export const buildUserPageDecryptedResponseStatePatch = ({
  patchedResponse = null,
  previousState = null,
  questionId = '',
  responseOverride = null,
}: BuildUserPageDecryptedResponseStatePatchInput = {}): UserPageDecryptedResponseStatePatchResult => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  if (!qid || !Object.keys(toAnalysisRecord(patchedResponse)).length) {
    return { didUpdate: false, statePatch: null };
  }
  const prevState = toAnalysisRecord(previousState);
  const prevDetailedQuestionResponses = toAnalysisRecord(prevState.detailedQuestionResponses);
  const prevDetailedSurveyResponses = toAnalysisRecord(prevState.detailedSurveyResponses);
  const nextDetailedQuestionResponses: UserPageUnknownRecord = { ...prevDetailedQuestionResponses };
  const nextDetailedSurveyResponses: UserPageUnknownRecord = { ...prevDetailedSurveyResponses };
  let didUpdate = false;

  Object.keys(nextDetailedQuestionResponses).forEach((questionKey: string) => {
    if (nextDetailedQuestionResponses[questionKey] === responseOverride) {
      nextDetailedQuestionResponses[questionKey] = patchedResponse;
      didUpdate = true;
    }
  });

  if (!didUpdate && Object.prototype.hasOwnProperty.call(nextDetailedQuestionResponses, qid)) {
    nextDetailedQuestionResponses[qid] = patchedResponse;
    didUpdate = true;
  }

  Object.keys(nextDetailedSurveyResponses).forEach((surveyId: string) => {
    const surveyEntries = nextDetailedSurveyResponses[surveyId];
    if (!Array.isArray(surveyEntries)) return;
    let surveyEntriesChanged = false;
    const updatedEntries = surveyEntries.map((entry: unknown) => {
      const entryRecord = toAnalysisRecord(entry);
      if (!Object.keys(entryRecord).length) return entry;
      if (entryRecord.responseData !== responseOverride) return entry;
      surveyEntriesChanged = true;
      return {
        ...entryRecord,
        responseData: patchedResponse,
      };
    });
    if (surveyEntriesChanged) {
      nextDetailedSurveyResponses[surveyId] = updatedEntries;
      didUpdate = true;
    }
  });

  if (!didUpdate) return { didUpdate: false, statePatch: null };
  return {
    didUpdate: true,
    statePatch: {
      detailedQuestionResponses: nextDetailedQuestionResponses,
      detailedSurveyResponses: nextDetailedSurveyResponses,
    },
  };
};
