import { readCurrentSessionConfig } from './sessionConfigAuthority.js';
import { resolveAnonymousIpDailyLimit } from './anonymousRateLimitPolicy.js';
import { resolveAuthenticatedRouteContext } from './authenticatedRouteContextResolution.js';
import { evaluateAuthenticatedRoutePreflight } from './authenticatedRoutePreflight.js';
import { issueInterviewCatalogTicket, verifyInterviewCatalogTicket } from './interviewCatalogTicket.js';
import { loadPublicInterviewQuestions as loadPublicInterviewQuestionsBoundary } from './interviewQuestionCatalog.js';
import {
  listSelfJoinableWorkerGroupsForMember as listSelfJoinableWorkerGroupsForMemberBoundary,
  listSelfJoinableWorkerGroupsForVisitor as listSelfJoinableWorkerGroupsForVisitorBoundary,
} from './workerGroups.js';
import { GROUP_SUGGESTION_DATA, GROUP_SUGGESTION_NEVER, normalizeInterviewSettings } from '../../shared/interviewSettings.mjs';

// v6 asks for confidence as the chance the person keeps the answer; hashes follow v5.
export const INTERVIEW_PROMPT_VERSION = 'ce-interview-brief-v6';

const trim = (value) => String(value == null ? '' : value).trim();
const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const isInterviewEnabled = (config = {}) => {
  const interview = isObj(config.interviewMode || config.interview) ? (config.interviewMode || config.interview) : {};
  return config.interviewModeEnabled !== false && interview.enabled !== false;
};

const normalizeAllowedOrigins = (raw) => (Array.isArray(raw) ? raw : [raw])
  .map((entry) => {
    try { return new URL(trim(entry)).origin; } catch { return ''; }
  })
  .filter(Boolean);

const isLocalHttpHostname = (hostname = '') => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(String(hostname));

const normalizeRecruitmentSource = (value) => {
  const normalized = trim(value).replace(/\s+/g, '-').slice(0, 128);
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(normalized) ? normalized : '';
};

const normalizeJoinGroup = (value) => {
  const normalized = trim(value).toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{0,79}$/.test(normalized) ? normalized : '';
};

const copySafeReturnParams = (sourceUrl, targetUrl) => {
  const recruitmentSources = sourceUrl.searchParams.getAll('src').map(normalizeRecruitmentSource).filter(Boolean);
  if (recruitmentSources.length === 1) targetUrl.searchParams.set('src', recruitmentSources[0]);
  const joinGroups = sourceUrl.searchParams.getAll('joinGroup').map(normalizeJoinGroup).filter(Boolean);
  if (joinGroups.length === 1) targetUrl.searchParams.set('joinGroup', joinGroups[0]);
};

const safeServedWorkerOrigin = (value) => {
  try {
    const url = new URL(trim(value));
    if (url.protocol === 'https:' || (url.protocol === 'http:' && isLocalHttpHostname(url.hostname))) {
      return url.origin;
    }
  } catch {}
  return '';
};

const safeSessionUrl = (value, { slug = '', allowOrigins } = {}) => {
  try {
    const url = new URL(trim(value));
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalHttpHostname(url.hostname))) return '';
    const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
    if (parts.length < 2 || parts.at(-2) !== 'session' || parts.at(-1)?.toLowerCase() !== trim(slug).toLowerCase()) {
      return '';
    }
    const allowedOrigins = normalizeAllowedOrigins(allowOrigins);
    if (!allowedOrigins.length || !allowedOrigins.includes(url.origin)) return '';
    const safeUrl = new URL(`${url.origin}${url.pathname}`);
    copySafeReturnParams(url, safeUrl);
    return safeUrl.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
};

const sha256 = async (value) => {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const canonicalizeQuestions = (questions = []) => [...questions].sort((left, right) =>
  trim(left?.id).localeCompare(trim(right?.id)) ||
  trim(left?.prompt).localeCompare(trim(right?.prompt)) ||
  trim(left?.type).localeCompare(trim(right?.type)),
);

const buildReviewUrl = ({ sessionUrl, servedWorkerOrigin } = {}) => {
  const url = new URL(sessionUrl);
  const workerOrigin = safeServedWorkerOrigin(servedWorkerOrigin);
  if (workerOrigin) url.searchParams.set('worker', workerOrigin);
  url.searchParams.set('mode', 'interview');
  return url.toString();
};

// Groups an AI may suggest, as data; the clipboard prompt, not the catalog, says how to suggest them.
const catalogGroup = (group) => ({
  groupId: group.groupId,
  label: group.label,
  ...(group.description ? { description: group.description } : {}),
  ...(Array.isArray(group.tags) && group.tags.length ? { tags: group.tags } : {}),
});

export const buildInterviewBriefDocument = ({
  slug,
  sessionUrl,
  servedWorkerOrigin,
  questions,
  questionSetHash,
  groups,
  groupSuggestionData,
} = {}) => ({
  type: 'context-engine.interview-question-catalog',
  version: 1,
  sessionSlug: slug,
  reviewUrl: buildReviewUrl({ sessionUrl, servedWorkerOrigin }),
  questionSetHash,
  prefillPromptVersion: INTERVIEW_PROMPT_VERSION,
  answerContract: {
    binary: ['Agree', 'Unsure', 'Disagree'],
    rating: { min: 0, max: 10, step: 1 },
    ratingScaleOverrides: 'Use a question.scale object when present: answer min plus a whole number of steps (1 when no step is given), at most max. Otherwise use the default rating contract.',
    multichoice: 'When singleSelect is true, use one exact question option. Otherwise use an array of one or more exact question options.',
    quadratic: 'Signed integer array in option order; sum(vote²) <= voiceCredits (99 default). Zero is neutral; unused credits are allowed.',
  },
  researchCoverageContract: {
    countFields: [
      'historyChatsSearched',
      'historyChatsUsed',
      'memoryItemsSearched',
      'memoryItemsUsed',
      'connectedSourcesSearched',
      'connectedSourcesUsed',
      'userStatementsUsed',
    ],
    unknownSearchedCount: null,
    verification: 'self_reported',
  },
  questions,
  ...(groups?.length
    ? {
        groups: groups.map(catalogGroup),
        // What the session lets an AI base a suggestion on, in words, and what it never may.
        groupSuggestionData: (groupSuggestionData || []).map((kind) => GROUP_SUGGESTION_DATA[kind]),
        groupSuggestionNever: GROUP_SUGGESTION_NEVER,
      }
    : {}),
});

export const dispatchInterviewBriefRequest = async ({
  request,
  env,
  slugHint,
  baseHeaders,
  deps,
  constants,
} = {}) => {
  const slugResolution = deps?.resolveRequestSlugWithoutToken?.({ request, env, slugHint }) || {
    ok: false,
    error: 'Invalid session slug.',
  };
  if (!slugResolution.ok || !slugResolution.explicitSlugProvided) {
    return deps?.json?.({ error: slugResolution.error || constants?.missingSlugError }, 400, baseHeaders);
  }
  const slug = slugResolution.slug;
  let config;
  try {
    ({ config } = await (deps?.readCurrentSessionConfig || readCurrentSessionConfig)({ env, slug }));
  } catch (error) {
    return deps?.json?.({ error: error.message }, 503, baseHeaders);
  }
  if (!config) return deps?.json?.({ error: constants?.sessionConfigNotFoundError }, 404, baseHeaders);
  const corsContext = await deps?.getCorsContext?.({ request, config });
  if (!corsContext?.ok) return corsContext?.response;
  const headers = new Headers(corsContext.headers || baseHeaders || {});
  headers.set('cache-control', 'no-store');
  // A catalog link may carry a ticket; never pass it on in a Referer.
  headers.set('referrer-policy', 'no-referrer');
  if (!isInterviewEnabled(config)) {
    return deps?.json?.({ error: 'Interview mode is disabled for this session.' }, 404, headers);
  }
  if (typeof deps?.checkRateLimit === 'function') {
    const rateAllowed = await deps.checkRateLimit({
      env,
      slug,
      address: deps?.resolveAnonymousRateIdentity?.(request),
      limit: resolveAnonymousIpDailyLimit(config),
      route: 'interview-brief',
    });
    if (!rateAllowed) return deps?.json?.({ error: 'Rate limit exceeded.' }, 429, headers);
  }

  const url = new URL(request.url);
  // A ticket lets one person's AI read what that person may see; without one, the catalog is public.
  const ticket = url.searchParams.get('ticket');
  let reader = null;
  if (ticket) {
    const verified = await verifyInterviewCatalogTicket({
      env,
      ticket,
      config,
      slug,
      deps: {
        now: deps?.now,
        computeScopesForLogin: deps?.computeScopesForLogin,
        validateAuthTokenRecord: deps?.validateAuthTokenRecord,
      },
    });
    if (!verified.ok) return deps?.json?.({ error: verified.error, reason: verified.reason }, verified.status, headers);
    reader = verified.reader;
  }
  const loadPublicInterviewQuestions = deps?.loadPublicInterviewQuestions || loadPublicInterviewQuestionsBoundary;
  const { questions, incomplete, refused } = await loadPublicInterviewQuestions({
    env,
    config,
    slug,
    storageRoute: deps?.storageRoute,
    fetch: deps?.fetch,
    ...(reader ? { reader } : {}),
  });
  if (!questions.length && refused && !reader) {
    return deps?.json?.({
      error: 'This session’s questions need a sign-in. Sign in on the session page, then copy the prompt again.',
      reason: 'sign_in_required',
    }, 401, headers);
  }
  if (!questions.length && incomplete) {
    headers.set('retry-after', '5');
    return deps?.json?.({ error: 'Interview question discovery is incomplete. Retry shortly.' }, 503, headers);
  }
  if (!questions.length) {
    return deps?.json?.(reader
      ? { error: 'No questions you can see are available for interview prefill.' }
      // Group-only questions may still show once the person signs in.
      : { error: 'No public, accessible questions are available for interview prefill.', reason: 'sign_in_required' },
    404, headers);
  }
  const configuredAllowedOrigins = [
    ...(Array.isArray(config.allowOrigins) ? config.allowOrigins : [config.allowOrigins]),
    config.sessionUrl,
    config.publicSessionUrl,
    config.appSessionUrl,
  ];
  const sessionUrl = safeSessionUrl(
    url.searchParams.get('sessionUrl') || config.sessionUrl || config.publicSessionUrl || config.appSessionUrl,
    { slug, allowOrigins: configuredAllowedOrigins },
  );
  if (!sessionUrl) {
    return deps?.json?.({ error: 'A session-approved HTTPS (or localhost) sessionUrl is required.' }, 400, headers);
  }
  const questionSetHash = await (deps?.sha256 || sha256)(JSON.stringify(canonicalizeQuestions(questions)));
  // With joining matching groups on, the person's own AI may suggest groups too: those a ticket's
  // person could join and hasn't, or those a visitor could see, which is all of them on a public
  // session or what a join link allows. A session that lets an AI use no kind of detail about
  // people lists none.
  const { joinMatchingGroups, groupSuggestionData } = normalizeInterviewSettings(config.interviewMode);
  const groups = !joinMatchingGroups || !groupSuggestionData.length
    ? []
    : reader
      ? await (deps?.listSelfJoinableWorkerGroupsForMember || listSelfJoinableWorkerGroupsForMemberBoundary)({
          env,
          config,
          slug,
          address: reader.address,
          deps: { now: deps?.now },
        })
      : await (deps?.listSelfJoinableWorkerGroupsForVisitor || listSelfJoinableWorkerGroupsForVisitorBoundary)({
          env,
          config,
          slug,
          inviteGroupId: new URL(sessionUrl).searchParams.get('joinGroup'),
          deps: { now: deps?.now },
        });
  return deps?.json?.(
    buildInterviewBriefDocument({
      slug,
      sessionUrl,
      servedWorkerOrigin: safeServedWorkerOrigin(request.url),
      questions,
      questionSetHash,
      groups,
      groupSuggestionData,
    }),
    200,
    headers,
  );
};

/** A ticket a signed-in person's page puts in the catalog link it gives their AI. */
export const dispatchInterviewCatalogTicketRequest = async ({ request, env, baseHeaders, slug, deps } = {}) => {
  const auth = await deps?.requireAuth?.({ request, env, baseHeaders, slugHint: slug });
  if (!auth?.ok) return auth?.response;
  const context = await resolveAuthenticatedRouteContext({ request, env, auth, baseHeaders, deps });
  if (!context?.ok) return context?.response;
  const headers = new Headers(context.headers || {});
  headers.set('cache-control', 'no-store');
  if (!isInterviewEnabled(context.config)) {
    return deps?.json?.({ error: 'Interview mode is disabled for this session.' }, 404, headers);
  }
  // An agent's own key reads the session directly, and a ticket would outlive revoking that key.
  if (auth.payload?.agentSource) {
    return deps?.json?.({
      error: 'Catalog tickets are for people signed in on the session page.',
      reason: 'catalog_ticket_person_only',
    }, 403, headers);
  }
  // The ticket reads questions, so it needs what a signed-in storage read needs, checked now.
  const preflight = await (deps?.evaluateAuthenticatedRoutePreflight || evaluateAuthenticatedRoutePreflight)({
    ...context,
    env,
    headers,
    route: 'interview-ticket',
    scope: context.scopes?.storage === true ? 'storage' : 'arweave',
    deps: { computeScopesForLogin: deps?.computeScopesForLogin, checkRateLimit: deps?.checkRateLimit, json: deps?.json },
  });
  if (!preflight?.ok) return preflight?.response;
  try {
    const issued = await issueInterviewCatalogTicket({
      env,
      config: context.config,
      slug: context.slug,
      sub: context.address,
      parent: auth.payload?.jti,
      parentExp: auth.payload?.exp,
      deps: { now: deps?.now },
    });
    return deps?.json?.(issued, 200, headers);
  } catch {
    return deps?.json?.({ error: 'Could not issue a catalog ticket.' }, 500, headers);
  }
};

export const __test__interviewBriefDispatch = {
  buildReviewUrl,
  canonicalizeQuestions,
  isInterviewEnabled,
  normalizeJoinGroup,
  normalizeRecruitmentSource,
  safeServedWorkerOrigin,
  safeSessionUrl,
};
