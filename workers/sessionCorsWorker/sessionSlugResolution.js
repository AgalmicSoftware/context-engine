const toStr = (val) => (typeof val === 'string' ? val : val == null ? '' : String(val));

export const INVALID_SESSION_SLUG_ERROR = 'Invalid session slug. Use lowercase letters, numbers, "_" or "-".';
export const SLUG_MISMATCH_ERROR = 'sessionSlug does not match worker session.';
export const SLUG_ALIAS_MISMATCH_ERROR = 'sessionSlug aliases do not match.';
export const MISSING_SLUG_ERROR = 'Missing sessionSlug.';
export const DEFAULT_SESSION_SLUG = '';
export const DEFAULT_SESSION_STORAGE_KEY = 'general';

const EMPTY_VALIDATION_RESULT = Object.freeze({
  ok: true,
  slug: '',
  error: '',
});

const hasExplicitWorkerSlugInput = (raw) => (
  raw != null && toStr(raw).trim().length > 0
);

const canonicalizeReservedWorkerAlias = (slug = '') => {
  if (!slug) return '';
  if (slug === 'general') return '';
  if (slug === 'debate') return 'rxc';
  return slug;
};

export const normalizeWorkerSessionSlug = (raw) => {
  const slug = toStr(raw).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!slug) return '';
  return canonicalizeReservedWorkerAlias(slug);
};

export const sessionSlugStorageKey = (raw) => (
  normalizeWorkerSessionSlug(raw) || DEFAULT_SESSION_STORAGE_KEY
);

export const validateInboundWorkerSessionSlug = (raw) => {
  if (raw == null) return EMPTY_VALIDATION_RESULT;
  const rawStr = toStr(raw).trim();
  if (!rawStr) return EMPTY_VALIDATION_RESULT;
  if (rawStr.toLowerCase() === 'general') return EMPTY_VALIDATION_RESULT;
  const canonicalSlug = rawStr.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (rawStr !== canonicalSlug) {
    return {
      ok: false,
      slug: '',
      error: INVALID_SESSION_SLUG_ERROR,
    };
  }
  return { ok: true, slug: canonicalizeReservedWorkerAlias(canonicalSlug), error: '' };
};

export const getDefaultWorkerSessionSlug = (env = {}) => (
  normalizeWorkerSessionSlug(env.DEFAULT_SESSION_SLUG ?? env.DEFAULT_GROUP_SLUG)
);

const hasExplicitDefaultWorkerSessionSlug = (env = {}) => (
  hasExplicitWorkerSlugInput(env?.DEFAULT_SESSION_SLUG ?? env?.DEFAULT_GROUP_SLUG)
);

export const resolveWorkerTenantSlug = ({ envSlug, headerSlug, tokenSlug } = {}) => {
  if (envSlug) return envSlug;
  if (headerSlug) return headerSlug;
  if (tokenSlug) return tokenSlug;
  return '';
};

export const resolveRequestedWorkerSlugPayload = (body = {}) => {
  const source = body && typeof body === 'object' ? body : {};
  const hasSessionSlug = (
    Object.prototype.hasOwnProperty.call(source, 'sessionSlug') &&
    source?.sessionSlug != null
  );
  const hasGroupSlug = (
    Object.prototype.hasOwnProperty.call(source, 'groupSlug') &&
    source?.groupSlug != null
  );
  const sessionSlugResult = hasSessionSlug
    ? validateInboundWorkerSessionSlug(source?.sessionSlug)
    : EMPTY_VALIDATION_RESULT;
  const groupSlugResult = hasGroupSlug
    ? validateInboundWorkerSessionSlug(source?.groupSlug)
    : EMPTY_VALIDATION_RESULT;
  const sessionSlug = hasSessionSlug ? sessionSlugResult.slug : '';
  const groupSlug = hasGroupSlug ? groupSlugResult.slug : '';
  const invalidResult = !sessionSlugResult.ok ? sessionSlugResult : null;

  return {
    ok: !invalidResult,
    error: invalidResult?.error || '',
    hasSessionSlug,
    hasGroupSlug,
    hasAnySlug: hasSessionSlug,
    sessionSlug,
    groupSlug,
    requestedSlug: sessionSlug,
    aliasMismatch: hasSessionSlug && hasGroupSlug && groupSlugResult.ok && sessionSlug !== groupSlug,
  };
};

export const resolveWorkerBodySlugContext = ({ body, env, slugHint } = {}) => {
  const envSlug = getDefaultWorkerSessionSlug(env);
  const slugPayload = resolveRequestedWorkerSlugPayload(body);
  const normalizedHint = normalizeWorkerSessionSlug(slugHint);
  const explicitSlugProvided = (
    hasExplicitDefaultWorkerSessionSlug(env) ||
    slugPayload.hasAnySlug ||
    hasExplicitWorkerSlugInput(slugHint)
  );
  const targetSlug = envSlug || (slugPayload.hasAnySlug ? slugPayload.requestedSlug : normalizedHint);

  if (!slugPayload.ok) {
    return {
      ok: false,
      error: slugPayload.error,
      envSlug,
      slugPayload,
      targetSlug,
      explicitSlugProvided,
    };
  }
  if (slugPayload.aliasMismatch) {
    return {
      ok: false,
      error: SLUG_ALIAS_MISMATCH_ERROR,
      envSlug,
      slugPayload,
      targetSlug,
      explicitSlugProvided,
    };
  }
  if (envSlug && slugPayload.requestedSlug && slugPayload.requestedSlug !== envSlug) {
    return {
      ok: false,
      error: SLUG_MISMATCH_ERROR,
      envSlug,
      slugPayload,
      targetSlug,
      explicitSlugProvided,
    };
  }

  return {
    ok: true,
    error: '',
    envSlug,
    slugPayload,
    targetSlug,
    explicitSlugProvided,
  };
};

export const resolveWorkerRequestSlugContext = ({
  tokenSlug,
  tokenHasSlug = false,
  headerSlug,
  env,
  slugHint,
  countEmptyHeaderAsExplicit = false,
} = {}) => {
  const headerPresent = headerSlug != null;
  const headerHasValue = headerPresent && toStr(headerSlug).trim().length > 0;
  const tokenSlugResult = validateInboundWorkerSessionSlug(tokenSlug);
  if (tokenHasSlug && !tokenSlugResult.ok) {
    return { ok: false, error: tokenSlugResult.error };
  }
  const headerSlugResult = validateInboundWorkerSessionSlug(headerSlug);
  if (headerPresent && !headerSlugResult.ok) {
    return { ok: false, error: headerSlugResult.error };
  }

  const envSlug = getDefaultWorkerSessionSlug(env);
  const normalizedHint = normalizeWorkerSessionSlug(slugHint);
  const resolvedTokenSlug = tokenHasSlug ? tokenSlugResult.slug : '';
  const resolvedHeaderSlug = headerSlugResult.slug;
  const slug = resolveWorkerTenantSlug({
    envSlug,
    headerSlug: resolvedHeaderSlug,
    tokenSlug: resolvedTokenSlug,
  }) || normalizedHint;
  const explicitHeaderProvided = countEmptyHeaderAsExplicit ? headerPresent : headerHasValue;

  return {
    ok: true,
    error: '',
    slug,
    explicitSlugProvided: (
      hasExplicitDefaultWorkerSessionSlug(env) ||
      !!tokenHasSlug ||
      hasExplicitWorkerSlugInput(slugHint) ||
      explicitHeaderProvided
    ),
    envSlug,
    tokenSlug: resolvedTokenSlug,
    headerSlug: resolvedHeaderSlug,
    headerPresent,
    headerHasValue,
  };
};
