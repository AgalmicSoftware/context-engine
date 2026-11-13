// POST /feedback: anyone on the session page, signed in or not, tells the
// session's admins about the app. Signed in, it runs as a signed-in route;
// signed out, the request names the session with ?slug=. Either way the
// message is stored in the session's coordinator (sessionFeedback.js), and the
// Worker stamps its own release on it.
import { callSessionConfigCoordinator, readCurrentSessionConfig } from './sessionConfigAuthority.js';
import { workerRelease } from './workerCapabilities.js';
import { normalizeWorkerSessionSlug } from './sessionSlugResolution.js';
import { isWorkerCanonicalSessionConfig } from './workerCanonicalAuthority.js';

export const FEEDBACK_PATH = '/feedback';
export const FEEDBACK_LIMITS = Object.freeze({ perPersonPerDay: 5, textChars: 2000, reachMeChars: 200, bodyBytes: 8192 });

const SCREENS = new Set(['phone', 'tablet', 'desktop']);
// A view names a section, never a URL: links carry group ids and fragments carry invites.
const VIEW = /^[A-Za-z0-9:_-]{1,80}$/;
const THEME = /^[a-z0-9-]{1,40}$/;
const RELEASE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const PERSON_LIMIT = { error: 'You’ve sent 5 today. Thanks! Try again tomorrow.', reason: 'feedback_person_limit' };
const STORE_REFUSALS = {
  feedback_full: { status: 409, error: 'Feedback is full; an admin can clear old messages.' },
  feedback_session_limit: { status: 429, error: 'Feedback is closed for today.' },
};

const plain = (value) => (typeof value === 'string' ? value.normalize('NFC').trim() : '');
const absent = (value) => value === undefined || value === null || value === '';
const invalid = (error) => ({ ok: false, status: 400, body: { error, reason: 'feedback_invalid' } });
const byteLength = (value) => new TextEncoder().encode(value).length;

/** The record to store for a send, or the 400 that says which field is wrong. */
export const normalizeFeedback = (body, { address = '' } = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid('Send the feedback as a JSON object.');
  if (byteLength(JSON.stringify(body)) > FEEDBACK_LIMITS.bodyBytes) return invalid('That feedback is too long to send.');
  const text = plain(body.text);
  if (!text) return invalid('Write some feedback first.');
  if (text.length > FEEDBACK_LIMITS.textChars) return invalid(`Feedback can be at most ${FEEDBACK_LIMITS.textChars} characters.`);
  if (typeof body.view !== 'string' || !VIEW.test(body.view)) return invalid('view must name a section, such as results or answering.');
  if (typeof body.theme !== 'string' || !THEME.test(body.theme)) return invalid('theme must be a theme id.');
  if (!SCREENS.has(body.screen)) return invalid('screen must be phone, tablet or desktop.');
  if (!absent(body.appRelease) && !(typeof body.appRelease === 'string' && body.appRelease.length <= 40 && RELEASE.test(body.appRelease))) {
    return invalid('appRelease must be a release number such as 0.9.8.');
  }
  let contact;
  if (!absent(body.contact)) {
    const reachMe = plain(body.contact?.reachMe);
    if (typeof body.contact !== 'object' || !reachMe || reachMe.length > FEEDBACK_LIMITS.reachMeChars) {
      return invalid(`How to reach you must be 1 to ${FEEDBACK_LIMITS.reachMeChars} characters.`);
    }
    // Only the Worker names who sent it: the signed-in address, never a name the sender typed.
    contact = { ...(address ? { address } : {}), reachMe };
  }
  // Without the contact box ticked, nothing stored names the sender.
  return {
    ok: true,
    record: {
      text,
      view: body.view,
      theme: body.theme,
      screen: body.screen,
      ...(absent(body.appRelease) ? {} : { appRelease: body.appRelease }),
      signedIn: Boolean(address),
      ...(contact ? { contact } : {}),
    },
  };
};

export const callSessionFeedbackStore = (env, slug, operation, payload = {}) =>
  callSessionConfigCoordinator({ env, slug, path: `session-feedback/${operation}`, ...payload });

/**
 * Checks the setting, the message and the sender's daily limit, then stores it.
 * `identity` is who the daily limit counts: the address signed in, the network signed out.
 */
export const sendSessionFeedback = async ({
  env, slug, config, body, address = '', identity, checkRateLimit, release = workerRelease(), store = callSessionFeedbackStore,
} = {}) => {
  // Only a session the Worker runs has the Settings panel where admins read
  // feedback and turn it off; an on-chain session takes none.
  if (config?.feedbackEnabled === false || !isWorkerCanonicalSessionConfig(config)) {
    return { status: 403, body: { error: 'This session isn’t taking feedback.', reason: 'feedback_off' } };
  }
  const normalized = normalizeFeedback(body, { address: String(address || '').toLowerCase() });
  if (!normalized.ok) return normalized;
  const allowed = await checkRateLimit({ env, slug, address: identity, limit: FEEDBACK_LIMITS.perPersonPerDay, route: 'feedback' });
  if (!allowed) return { status: 429, body: PERSON_LIMIT };
  const saved = await store(env, slug, 'add', { record: { ...normalized.record, workerRelease: release } });
  if (saved.ok) return { status: 200, body: { ok: true } };
  const refusal = STORE_REFUSALS[saved.body?.reason];
  return refusal
    ? { status: refusal.status, body: { error: refusal.error, reason: saved.body.reason } }
    : { status: 503, body: { error: 'Feedback couldn’t be saved just now. Try again shortly.', reason: 'feedback_unavailable' } };
};

const querySlugOf = (request) => {
  try {
    const params = new URL(request.url).searchParams;
    return params.get('sessionSlug') ?? params.get('slug');
  } catch {
    return null;
  }
};

/** A signed-out send: the session comes from ?slug=, and the daily limit counts the network. */
export const dispatchAnonymousFeedbackRequest = async ({ request, env, slugHint, baseHeaders, deps, constants }) => {
  // The page names the session in the query; the resolver reads it from the header.
  const querySlug = querySlugOf(request);
  let slugRequest = request;
  if (querySlug != null && !request.headers.has('x-session-slug')) {
    const headers = new Headers(request.headers);
    headers.set('x-session-slug', querySlug);
    slugRequest = new Request(request.url, { headers });
  }
  const resolved = deps.resolveRequestSlugWithoutToken({ request: slugRequest, env, slugHint });
  if (!resolved?.ok || !resolved.explicitSlugProvided) {
    return deps.json({ error: resolved?.error || constants?.missingSlugError }, 400, baseHeaders);
  }
  const slug = resolved.slug;
  // A Worker pinned to one session keeps it; feedback named for another is refused, not misfiled.
  if (querySlug != null && normalizeWorkerSessionSlug(querySlug) !== slug) {
    return deps.json({ error: constants?.sessionConfigNotFoundError }, 404, baseHeaders);
  }
  let config;
  try {
    ({ config } = await (deps.readCurrentSessionConfig || readCurrentSessionConfig)({ env, slug, cache: true }));
  } catch (error) {
    return deps.json({ error: error.message }, 503, baseHeaders);
  }
  if (!config) return deps.json({ error: constants?.sessionConfigNotFoundError }, 404, baseHeaders);
  const cors = await deps.getCorsContext({ request, config });
  if (!cors.ok) return cors.response;
  const raw = await request.text();
  if (byteLength(raw) > FEEDBACK_LIMITS.bodyBytes) return deps.json(invalid('That feedback is too long to send.').body, 400, cors.headers);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    body = undefined;
  }
  const result = await sendSessionFeedback({
    env, slug, config, body, identity: deps.resolveAnonymousRateIdentity(request), checkRateLimit: deps.checkRateLimit,
  });
  return deps.json(result.body, result.status, cors.headers);
};
