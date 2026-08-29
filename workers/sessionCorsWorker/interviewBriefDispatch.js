import { loadPublicInterviewQuestions as loadPublicInterviewQuestionsBoundary } from './interviewQuestionCatalog.js';

export const INTERVIEW_PROMPT_VERSION = 'ce-interview-brief-v4';

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

const safeSessionUrl = (value, { slug = '', allowOrigins } = {}) => {
  try {
    const url = new URL(trim(value));
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return '';
    const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
    if (parts.length < 2 || parts.at(-2) !== 'session' || parts.at(-1)?.toLowerCase() !== trim(slug).toLowerCase()) {
      return '';
    }
    const allowedOrigins = normalizeAllowedOrigins(allowOrigins);
    if (!allowedOrigins.length || !allowedOrigins.includes(url.origin)) return '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
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

export const buildInterviewBriefDocument = ({
  slug,
  sessionUrl,
  questions,
  questionSetHash,
} = {}) => ({
  type: 'context-engine.interview-question-catalog',
  version: 1,
  sessionSlug: slug,
  reviewUrl: `${sessionUrl}?mode=interview`,
  questionSetHash,
  prefillPromptVersion: INTERVIEW_PROMPT_VERSION,
  answerContract: {
    binary: ['Agree', 'Unsure', 'Disagree'],
    rating: { min: 0, max: 10, step: 1 },
    multichoice: 'Use one exact question option.',
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
  const config = await deps?.getSessionConfig?.(env, slug);
  if (!config) return deps?.json?.({ error: constants?.sessionConfigNotFoundError }, 404, baseHeaders);
  const corsContext = await deps?.getCorsContext?.({ request, config });
  if (!corsContext?.ok) return corsContext?.response;
  const headers = new Headers(corsContext.headers || baseHeaders || {});
  headers.set('cache-control', 'no-store');
  if (!isInterviewEnabled(config)) {
    return deps?.json?.({ error: 'Interview mode is disabled for this session.' }, 404, headers);
  }
  if (typeof deps?.checkRateLimit === 'function') {
    const rateAllowed = await deps.checkRateLimit({
      env,
      slug,
      address: deps?.resolveAnonymousRateIdentity?.(request),
      limit: config?.limits?.perWalletPerDay || 0,
      route: 'interview-brief',
    });
    if (!rateAllowed) return deps?.json?.({ error: 'Rate limit exceeded.' }, 429, headers);
  }

  const loadPublicInterviewQuestions = deps?.loadPublicInterviewQuestions || loadPublicInterviewQuestionsBoundary;
  const questions = await loadPublicInterviewQuestions({
    env,
    config,
    slug,
    storageRoute: deps?.storageRoute,
    fetch: deps?.fetch,
  });
  if (!questions.length) {
    return deps?.json?.({ error: 'No public, accessible questions are available for interview prefill.' }, 404, headers);
  }
  const url = new URL(request.url);
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
  return deps?.json?.(
    buildInterviewBriefDocument({ slug, sessionUrl, questions, questionSetHash }),
    200,
    headers,
  );
};

export const __test__interviewBriefDispatch = { canonicalizeQuestions, isInterviewEnabled, safeSessionUrl };
