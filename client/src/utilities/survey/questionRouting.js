/**
 * @module questionRouting
 * @description Question URL routing — builds and parses question route paths,
 *              resolves session slug from URL search params, and manages masked question payloads.
 *
 * Key exports: buildQuestionRoutePath, parseQuestionSessionSlugFromSearch, isMaskedQuestionPayload, hasQuestionDecryption, litReady
 */
import { normalizeSessionSlug } from '../session/sessionNaming.js';

const normalizeSlug = (rawSlug) => normalizeSessionSlug(rawSlug);

export const normalizeQuestionRouteSessionSlug = (rawSlug) => normalizeSlug(rawSlug);


export const isKnownOrGeneralSessionSlug = (slugIn, getSessionConfigBySlug) => {
  const slug = normalizeSlug(slugIn);
  if (!slug) return true;
  if (typeof getSessionConfigBySlug !== 'function') return false;
  const cfg = getSessionConfigBySlug(slug);
  return !!(cfg && !cfg.__unresolved);
};


export const resolveStrictSessionValue = (slugIn, getSessionConfigBySlug, resolverFn) => {
  const slug = normalizeSlug(slugIn);
  if (!isKnownOrGeneralSessionSlug(slug, getSessionConfigBySlug)) return null;
  return typeof resolverFn === 'function' ? resolverFn(slug) : null;
};

export const parseQuestionSessionSlugFromSearch = (search = '') => {
  const params = new URLSearchParams(String(search || ''));
  const raw =
    params.get('session') ??
    params.get('sessionSlug') ??
    params.get('s');
  if (raw == null) return null;
  return normalizeSlug(raw);
};

export const parseQuestionSessionIdFromSearch = (search = '') => {
  const params = new URLSearchParams(String(search || ''));
  const raw =
    params.get('sessionId') ??
    params.get('sessionID') ??
    params.get('sid');
  if (raw == null) return null;
  const trimmed = String(raw || '').trim();
  return trimmed || null;
};


export const isPinnableQuestionRouteSlug = (slugIn, getSessionConfigBySlug) => (
  slugIn != null && isKnownOrGeneralSessionSlug(slugIn, getSessionConfigBySlug)
);

export const isPinnableQuestionRouteSearchSlug = (search = '', getSessionConfigBySlug) => {
  const slug = parseQuestionSessionSlugFromSearch(search);
  return isPinnableQuestionRouteSlug(slug, getSessionConfigBySlug);
};

export const buildQuestionRoutePath = (questionId, opts = {}) => {
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

export const isMaskedQuestionPayload = (question) => {
  if (!question || typeof question !== 'object') return false;
  if (question.prompt === '[encrypted]') return true;
  const hasEncryptedOptions = !!(question.optionsEncrypted || question.encryptedOptions);
  const hasEncryptedTags = !!(question.tagsEncrypted || question.encryptedTags);
  if (hasEncryptedOptions && Array.isArray(question.options) && question.options.length === 0) return true;
  if (hasEncryptedTags && (!Array.isArray(question.tags) || question.tags.length === 0)) return true;
  return false;
};

export const hasQuestionDecryption = (question) => !!(
  question &&
  typeof question === 'object' &&
  (question.promptDecrypted || question.optionsDecrypted || question.tagsDecrypted)
);

export const pickBetterQuestionPayload = (existingQuestion, incomingQuestion) => {
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

export const litReady = (litHooks) => !!(litHooks && typeof litHooks.getKey === 'function');

export const shouldRetryMaskedQuestionRefresh = ({ masked, prev, next }) => {
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
