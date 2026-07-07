/**
 * @module questionRouting
 * @description Question URL routing — builds and parses question route paths,
 *              resolves session slug from URL search params, and manages masked question payloads.
 *
 * Key exports: buildQuestionRoutePath, parseQuestionSessionSlugFromSearch, isMaskedQuestionPayload, hasQuestionDecryption, litReady
 */
import { normalizeSessionSlug } from '../session/sessionNaming.js';
import {
  SESSION_STORAGE_PAYLOAD_ACCESS_MODES,
  normalizeSessionStorageConfig,
} from '../storage/sessionStorageConfig.js';

type SessionConfig = {
  __unresolved?: boolean;
} & Record<string, unknown>;

type SessionConfigResolver = ((slug: string) => SessionConfig | null | undefined) | null | undefined;
type StrictValueResolver<T> = ((slug: string) => T) | null | undefined;

type QuestionRouteOptions = {
  responderAddress?: unknown;
  sessionId?: unknown;
  sessionID?: unknown;
  sessionSlug?: unknown;
};

type QuestionPayload = {
  __ceQuestionMetadataPending?: unknown;
  payloadAccessControl?: unknown;
  payloadAccessMode?: unknown;
  payloadUnavailable?: unknown;
  prompt?: unknown;
  options?: unknown;
  tags?: unknown;
  optionsEncrypted?: unknown;
  encryptedOptions?: unknown;
  tagsEncrypted?: unknown;
  encryptedTags?: unknown;
  promptDecrypted?: unknown;
  optionsDecrypted?: unknown;
  tagsDecrypted?: unknown;
  storageRef?: unknown;
  visibility?: unknown;
} & Record<string, unknown>;

type LitHooks =
  | {
      getKey?: unknown;
    }
  | null
  | undefined;

type RetryContext = {
  account?: unknown;
  provider?: unknown;
  loginComplete?: unknown;
  litHooks?: LitHooks;
  sbtCacheRevision?: unknown;
};

type MaskedQuestionRefreshArgs = {
  masked?: unknown;
  prev?: RetryContext | null;
  next?: RetryContext | null;
};

const normalizeSlug = (rawSlug: unknown): string => normalizeSessionSlug(rawSlug);
const toLowerString = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const normalizePayloadAccessModeValue = (value: unknown): string => {
  const normalized = toLowerString(value).replace(/-/g, '_');
  if (normalized === 'public' || normalized === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ) {
    return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ;
  }
  if (
    normalized === 'worker_sbt' ||
    normalized === 'sbt_gated' ||
    normalized === 'sbt_gate' ||
    normalized === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE
  ) {
    return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE;
  }
  if (
    normalized === 'encrypted' ||
    normalized === 'lit' ||
    normalized === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED
  ) {
    return SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED;
  }
  return '';
};

const readPayloadAccessMode = (value: unknown): string => {
  if (!isRecord(value)) return normalizePayloadAccessModeValue(value);
  if (
    Object.prototype.hasOwnProperty.call(value, 'gate') ||
    Object.prototype.hasOwnProperty.call(value, 'encryption')
  ) {
    return normalizeSessionStoragePayloadAccessControl(value).mode;
  }
  return normalizePayloadAccessModeValue(value.mode ?? value.payloadAccessMode ?? value.accessControlMode);
};

const hasEnvelope = (value: unknown): boolean => {
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const hasPromptEncryptionEnvelope = (payload: QuestionPayload): boolean => {
  const encryptedFields = isRecord(payload.encryptedFields) ? payload.encryptedFields : {};
  const encryptionTargets =
    isRecord(payload.encryption) && isRecord(payload.encryption.targets) ? payload.encryption.targets : {};
  return (
    hasEnvelope(payload.promptEncrypted) ||
    hasEnvelope(payload.encryptedPrompt) ||
    hasEnvelope(encryptedFields.prompt) ||
    encryptionTargets.questions === true ||
    encryptionTargets.prompt === true
  );
};

export const normalizeQuestionRouteSessionSlug = (rawSlug: unknown): string => normalizeSlug(rawSlug);

export const isKnownOrGeneralSessionSlug = (
  slugIn: unknown,
  getSessionConfigBySlug: SessionConfigResolver,
): boolean => {
  const slug = normalizeSlug(slugIn);
  if (!slug) return true;
  if (typeof getSessionConfigBySlug !== 'function') return false;
  const cfg = getSessionConfigBySlug(slug);
  return !!(cfg && !cfg.__unresolved);
};

export const resolveStrictSessionValue = <T>(
  slugIn: unknown,
  getSessionConfigBySlug: SessionConfigResolver,
  resolverFn: StrictValueResolver<T>,
): T | null => {
  const slug = normalizeSlug(slugIn);
  if (!isKnownOrGeneralSessionSlug(slug, getSessionConfigBySlug)) return null;
  return typeof resolverFn === 'function' ? resolverFn(slug) : null;
};

export const parseQuestionSessionSlugFromSearch = (search = ''): string | null => {
  const params = new URLSearchParams(String(search || ''));
  const raw = params.get('session') ?? params.get('sessionSlug') ?? params.get('s');
  if (raw == null) return null;
  return normalizeSlug(raw);
};

export const parseQuestionSessionIdFromSearch = (search = ''): string | null => {
  const params = new URLSearchParams(String(search || ''));
  const raw = params.get('sessionId') ?? params.get('sessionID') ?? params.get('sid');
  if (raw == null) return null;
  const trimmed = String(raw || '').trim();
  return trimmed || null;
};

export const isPinnableQuestionRouteSlug = (slugIn: unknown, getSessionConfigBySlug: SessionConfigResolver): boolean =>
  slugIn != null && isKnownOrGeneralSessionSlug(slugIn, getSessionConfigBySlug);

export const isPinnableQuestionRouteSearchSlug = (
  search = '',
  getSessionConfigBySlug: SessionConfigResolver,
): boolean => {
  const slug = parseQuestionSessionSlugFromSearch(search);
  return isPinnableQuestionRouteSlug(slug, getSessionConfigBySlug);
};

export const buildQuestionRoutePath = (questionId: unknown, opts: QuestionRouteOptions = {}): string => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  if (!qid) return '/questions';
  const responder = String(opts.responderAddress || '')
    .trim()
    .toLowerCase();
  const sessionId = String(opts.sessionId ?? opts.sessionID ?? '').trim();
  const sessionSlug = normalizeSlug(opts.sessionSlug ?? '');
  const base = `/question/${qid}`;
  const params = new URLSearchParams();
  if (sessionSlug) {
    params.set('session', sessionSlug);
  } else if (sessionId) {
    params.set('sessionId', sessionId);
  }
  if (responder) params.set('responder', responder);
  return params.toString() ? `${base}?${params.toString()}` : base;
};

export const isMaskedQuestionPayload = (question: unknown): question is QuestionPayload => {
  if (!question || typeof question !== 'object') return false;
  const payload = question as QuestionPayload;
  if (payload.prompt === '[encrypted]') return true;
  const hasEncryptedOptions = !!(payload.optionsEncrypted || payload.encryptedOptions);
  const hasEncryptedTags = !!(payload.tagsEncrypted || payload.encryptedTags);
  if (hasEncryptedOptions && Array.isArray(payload.options) && payload.options.length === 0) return true;
  if (hasEncryptedTags && (!Array.isArray(payload.tags) || payload.tags.length === 0)) return true;
  return false;
};

export const resolveQuestionPayloadAccessMode = (question: unknown, sessionConfig: unknown = null): string => {
  const payload = isRecord(question) ? (question as QuestionPayload) : {};
  const storageRef = isRecord(payload.storageRef) ? payload.storageRef : {};
  const explicitMode =
    readPayloadAccessMode(payload.payloadAccessControl) ||
    normalizePayloadAccessModeValue(payload.payloadAccessMode) ||
    normalizePayloadAccessModeValue(payload.accessControlMode) ||
    normalizePayloadAccessModeValue(payload.visibility) ||
    readPayloadAccessMode(storageRef.payloadAccessControl) ||
    normalizePayloadAccessModeValue(storageRef.payloadAccessMode) ||
    normalizePayloadAccessModeValue(storageRef.accessControlMode);
  if (explicitMode) return explicitMode;
  const cfg = normalizeSessionStorageConfig(sessionConfig as any);
  return cfg.payloadAccessControl.mode;
};

export const resolveQuestionPayloadDisplayState = (question: unknown, sessionConfig: unknown = null) => {
  const payload = isRecord(question) ? (question as QuestionPayload) : {};
  const masked = isMaskedQuestionPayload(payload);
  if (!masked) {
    return {
      masked: false,
      status: 'public',
      label: '',
      actionLabel: '',
      actionTitle: '',
      busyLabel: '',
      noticeLeadingText: 'This question is',
      noticeStatusText: 'available',
      noticeSuffix: '',
      requiresAuth: false,
    };
  }

  const visibility = toLowerString(payload.visibility);
  const unavailable =
    payload.__ceQuestionMetadataPending === true ||
    payload.payloadUnavailable === true ||
    visibility === 'payload_unavailable' ||
    visibility === 'unavailable';
  const accessMode = resolveQuestionPayloadAccessMode(payload, sessionConfig);
  if (unavailable || accessMode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ) {
    return {
      masked: true,
      status: 'unavailable',
      label: 'Unavailable',
      actionLabel: 'Retry',
      actionTitle: 'Retry loading question prompt',
      busyLabel: 'Loading...',
      noticeLeadingText: 'This question is',
      noticeStatusText: 'unavailable',
      noticeSuffix: 'Retry loading the prompt.',
      requiresAuth: false,
    };
  }
  if (accessMode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE) {
    return {
      masked: true,
      status: 'worker_sbt_gate',
      label: 'Requires session access',
      actionLabel: 'Load Prompt',
      actionTitle: 'Load gated prompt',
      busyLabel: 'Loading...',
      noticeLeadingText: 'This question',
      noticeStatusText: 'requires session access',
      noticeSuffix: 'Connect an eligible account and load the prompt to answer.',
      requiresAuth: true,
    };
  }
  if (accessMode === SESSION_STORAGE_PAYLOAD_ACCESS_MODES.LIT_ENCRYPTED || hasPromptEncryptionEnvelope(payload)) {
    return {
      masked: true,
      status: 'lit_encrypted',
      label: 'Encrypted',
      actionLabel: 'Decrypt Prompt',
      actionTitle: 'Decrypt gated prompt',
      busyLabel: 'Decrypting...',
      noticeLeadingText: 'This question is',
      noticeStatusText: 'encrypted',
      noticeSuffix: 'Decrypt the prompt to answer.',
      requiresAuth: true,
    };
  }
  return {
    masked: true,
    status: 'encrypted',
    label: 'Encrypted',
    actionLabel: 'Decrypt Prompt',
    actionTitle: 'Decrypt gated prompt',
    busyLabel: 'Decrypting...',
    noticeLeadingText: 'This question is',
    noticeStatusText: 'encrypted',
    noticeSuffix: 'Decrypt the prompt to answer.',
    requiresAuth: true,
  };
};

export const hasQuestionDecryption = (question: unknown): question is QuestionPayload => {
  if (!question || typeof question !== 'object') return false;
  const payload = question as QuestionPayload;
  return !!(payload.promptDecrypted || payload.optionsDecrypted || payload.tagsDecrypted);
};

const hasNonEmptyQuestionOptions = (question: QuestionPayload | null | undefined): boolean =>
  Array.isArray(question?.options) && question.options.length > 0;

export const pickBetterQuestionPayload = (
  existingQuestion: QuestionPayload | null | undefined,
  incomingQuestion: QuestionPayload | null | undefined,
): QuestionPayload | null => {
  if (!incomingQuestion) return existingQuestion || null;
  if (!existingQuestion) return incomingQuestion;

  const existingPending = existingQuestion.__ceQuestionMetadataPending === true;
  const incomingPending = incomingQuestion.__ceQuestionMetadataPending === true;
  if (existingPending && !incomingPending) return incomingQuestion;
  if (incomingPending && !existingPending) return existingQuestion;

  const existingMasked = isMaskedQuestionPayload(existingQuestion);
  const incomingMasked = isMaskedQuestionPayload(incomingQuestion);
  const existingDecrypted = hasQuestionDecryption(existingQuestion);
  const incomingDecrypted = hasQuestionDecryption(incomingQuestion);

  if ((existingDecrypted && !incomingDecrypted) || (!existingMasked && incomingMasked)) {
    return existingQuestion;
  }
  if ((incomingDecrypted && !existingDecrypted) || (existingMasked && !incomingMasked)) {
    return incomingQuestion;
  }

  const merged = { ...existingQuestion, ...incomingQuestion };
  const mergedType = toLowerString(incomingQuestion.type ?? existingQuestion.type);
  if (
    (mergedType === 'multichoice' || mergedType === 'poll') &&
    hasNonEmptyQuestionOptions(existingQuestion) &&
    !hasNonEmptyQuestionOptions(incomingQuestion)
  ) {
    merged.options = existingQuestion.options;
  }
  return merged;
};

export const litReady = (litHooks: LitHooks): boolean => !!(litHooks && typeof litHooks.getKey === 'function');

export const shouldRetryMaskedQuestionRefresh = ({ masked, prev, next }: MaskedQuestionRefreshArgs): boolean => {
  if (!masked) return false;
  const loggedIn = !!(next?.loginComplete && next?.account);
  if (!loggedIn) return false;

  const authChanged =
    prev?.account !== next?.account || prev?.provider !== next?.provider || prev?.loginComplete !== next?.loginComplete;
  const litChanged = litReady(prev?.litHooks) !== litReady(next?.litHooks);
  const entitlementChanged = Number(prev?.sbtCacheRevision || 0) !== Number(next?.sbtCacheRevision || 0);
  return authChanged || litChanged || entitlementChanged;
};
