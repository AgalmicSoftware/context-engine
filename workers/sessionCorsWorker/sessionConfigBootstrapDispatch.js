import {
  projectPublicWorkerSessionConfig,
} from '../shared/workerSessionConfig.mjs';
import {
  isWorkerCanonicalSessionConfig,
} from './workerCanonicalAuthority.js';
import {
  validateInboundWorkerSessionSlug,
} from './sessionSlugResolution.js';

export { projectPublicWorkerSessionConfig };

const buildBootstrapHeaders = (headers) => {
  const next = new Headers(headers || {});
  const vary = new Set(
    (next.get('Vary') || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  vary.add('Origin');
  vary.add('X-Session-Slug');
  next.set('Vary', [...vary].join(', '));
  next.set('Cache-Control', 'no-store');
  return next;
};

const protectBootstrapResponse = (response, baseHeaders) => {
  if (!response) return response;
  const headers = buildBootstrapHeaders(response.headers || baseHeaders);
  if (response instanceof Response) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return { ...response, headers };
};

export const dispatchSessionConfigBootstrapRequest = async ({
  request,
  env,
  slugHint,
  baseHeaders,
  deps,
  constants,
} = {}) => {
  const protectedBaseHeaders = buildBootstrapHeaders(baseHeaders);
  const slugResolution = deps?.resolveRequestSlugWithoutToken?.({ request, env, slugHint }) || {
    ok: false,
    error: 'Invalid session slug.',
  };
  if (!slugResolution.ok) {
    return deps?.json?.({ error: slugResolution.error }, 400, protectedBaseHeaders);
  }
  if (!slugResolution.explicitSlugProvided) {
    return deps?.json?.({ error: constants?.missingSlugError }, 400, protectedBaseHeaders);
  }

  const slug = slugResolution.slug;
  let querySlugRaw = null;
  try {
    querySlugRaw = new URL(request?.url || '').searchParams.get('slug');
  } catch {}
  if (querySlugRaw != null) {
    const querySlug = validateInboundWorkerSessionSlug(querySlugRaw);
    if (!querySlug.ok) {
      return deps?.json?.({ error: querySlug.error }, 400, protectedBaseHeaders);
    }
    if (querySlug.slug !== slug) {
      return deps?.json?.({ error: 'Session config slug query does not match X-Session-Slug.' }, 400, protectedBaseHeaders);
    }
  }
  const config = await deps?.getSessionConfig?.(env, slug);
  // Do not expose chain-canonical config through a caller-selected worker.
  if (!config || !isWorkerCanonicalSessionConfig(config)) {
    return deps?.json?.({ error: constants?.sessionConfigNotFoundError }, 404, protectedBaseHeaders);
  }
  const corsContext = await deps?.getCorsContext?.({ request, config });
  if (!corsContext?.ok) return protectBootstrapResponse(corsContext?.response, protectedBaseHeaders);

  return deps?.json?.({
    ok: true,
    sessionSlug: slug,
    config: projectPublicWorkerSessionConfig(config),
  }, 200, buildBootstrapHeaders(corsContext.headers));
};
