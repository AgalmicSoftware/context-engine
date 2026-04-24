/**
 * @module questionRouting
 * @description Question URL routing — builds and parses question route paths,
 *              resolves session slug from URL search params, and manages masked question payloads.
 *
 * Key exports: buildQuestionRoutePath, parseQuestionSessionSlugFromSearch, isMaskedQuestionPayload, hasQuestionDecryption, litReady
 */
import { normalizeSessionSlug } from '../session/sessionNaming.js';

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
} & Record<string, unknown>;

type LitHooks = {
  getKey?: unknown;
} | null | undefined;

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

export const normalizeQuestionRouteSessionSlug = (rawSlug: unknown): string => normalizeSlug(rawSlug);


export const isKnownOrGeneralSessionSlug = (
  slugIn: unknown,
  getSessionConfigBySlug: SessionConfigResolver
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
  resolverFn: StrictValueResolver<T>
): T | null => {
  const slug = normalizeSlug(slugIn);
  if (!isKnownOrGeneralSessionSlug(slug, getSessionConfigBySlug)) return null;
  return typeof resolverFn === 'function' ? resolverFn(slug) : null;
};

export const parseQuestionSessionSlugFromSearch = (search = ''): string | null => {
  const params = new URLSearchParams(String(search || ''));
  const raw =
    params.get('session') ??
    params.get('sessionSlug') ??
    params.get('s');
  if (raw == null) return null;
  return normalizeSlug(raw);
};

export const parseQuestionSessionIdFromSearch = (search = ''): string | null => {
  const params = new URLSearchParams(String(search || ''));
  const raw =
    params.get('sessionId') ??
    params.get('sessionID') ??
    params.get('sid');
  if (raw == null) return null;
  const trimmed = String(raw || '').trim();
  return trimmed || null;
};


export const isPinnableQuestionRouteSlug = (
  slugIn: unknown,
  getSessionConfigBySlug: SessionConfigResolver
): boolean => (
  slugIn != null && isKnownOrGeneralSessionSlug(slugIn, getSessionConfigBySlug)
);

export const isPinnableQuestionRouteSearchSlug = (
  search = '',
  getSessionConfigBySlug: SessionConfigResolver
): boolean => {
  const slug = parseQuestionSessionSlugFromSearch(search);
  return isPinnableQuestionRouteSlug(slug, getSessionConfigBySlug);
};

export const buildQuestionRoutePath = (questionId: unknown, opts: QuestionRouteOptions = {}): string => {
  const qid = String(questionId || '').trim().toLowerCase();
  if (!qid) return '/questions';
  const responder = String(opts.responderAddress || '').trim().toLowerCase();
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

export const hasQuestionDecryption = (question: unknown): question is QuestionPayload => {
  if (!question || typeof question !== 'object') return false;
  const payload = question as QuestionPayload;
  return !!(payload.promptDecrypted || payload.optionsDecrypted || payload.tagsDecrypted);
};

export const pickBetterQuestionPayload = (
  existingQuestion: QuestionPayload | null | undefined,
  incomingQuestion: QuestionPayload | null | undefined
): QuestionPayload | null => {
  if (!incomingQuestion) return existingQuestion || null;
  if (!existingQuestion) return incomingQuestion;

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

  return { ...existingQuestion, ...incomingQuestion };
};

export const litReady = (litHooks: LitHooks): boolean => !!(litHooks && typeof litHooks.getKey === 'function');

export const shouldRetryMaskedQuestionRefresh = ({ masked, prev, next }: MaskedQuestionRefreshArgs): boolean => {
  if (!masked) return false;
  const loggedIn = !!(next?.loginComplete && next?.account);
  if (!loggedIn) return false;

  const authChanged =
    prev?.account !== next?.account ||
    prev?.provider !== next?.provider ||
    prev?.loginComplete !== next?.loginComplete;
  const litChanged = litReady(prev?.litHooks) !== litReady(next?.litHooks);
  const entitlementChanged = Number(prev?.sbtCacheRevision || 0) !== Number(next?.sbtCacheRevision || 0);
  return authChanged || litChanged || entitlementChanged;
};
