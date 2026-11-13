import { resolveCanonicalWorkerSessionIdHex } from './sessionConfigMutation.js';
import { normalizeWorkerSessionSlug } from './sessionSlugResolution.js';
import { toStr } from './stringCoercion.js';

const trim = (value) => toStr(value).trim();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

export const normalizeQuestionId = (value) => trim(value).slice(0, 128);
// AI builds' own reading of a session id (looser than sign-in's).
export const normalizeSessionIdHex = (value) => {
  const raw = trim(value).toLowerCase().replace(/^0x/, '').replace(/-/g, '');
  return /^[0-9a-f]{32}$/.test(raw) ? `0x${raw}` : '';
};

// The session id AI builds expect rows to name.
export const buildSessionIdOf = (config) => normalizeSessionIdHex(resolveCanonicalWorkerSessionIdHex(config));

// Whether a row's stated session is this one. A row that names no slug or id
// passes only when `allowInherited` (admin snapshots).
export const compareIdentity = ({ slug, config, suppliedSlug, suppliedSessionId, allowInherited = false }) => {
  const expectedSlug = normalizeWorkerSessionSlug(slug || config?.slug);
  const actualSlug = normalizeWorkerSessionSlug(suppliedSlug);
  if (!allowInherited && expectedSlug && !actualSlug) return false;
  if (expectedSlug && actualSlug && expectedSlug !== actualSlug) return false;
  const expectedSessionId = buildSessionIdOf(config);
  const actualSessionId = normalizeSessionIdHex(suppliedSessionId);
  if (!allowInherited && expectedSessionId && !actualSessionId) return false;
  if (expectedSessionId && actualSessionId && expectedSessionId !== actualSessionId) return false;
  return true;
};

// What an AI build would key a readable stored answer on, decided once at
// upload: its question and this session's id. Only a single answer whose
// session identity a build accepts gets one, so a build can choose each
// person's latest answer to a question from list entries alone (see
// listLatestResponseRows). A survey's bundled answers get none.
export const answerVersionStamp = ({ payload, slug, config }) => {
  if (!isObj(payload) || Array.isArray(payload.responses)) return null;
  const questionId = normalizeQuestionId(payload.questionId || payload.questionID || payload.id);
  const sessionId = buildSessionIdOf(config);
  if (!questionId || !sessionId) return null;
  if (!compareIdentity({ slug, config, suppliedSlug: payload.sessionSlug, suppliedSessionId: payload.sessionId || payload.sessionIdHex })) return null;
  return { answerQuestionId: questionId, answerSessionId: sessionId };
};
