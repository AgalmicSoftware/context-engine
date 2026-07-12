import {
  projectPublicWorkerSessionConfig,
} from '../shared/workerSessionConfig.mjs';
import {
  isWorkerCanonicalSessionConfig,
} from './workerCanonicalAuthority.js';

export { projectPublicWorkerSessionConfig };

export const dispatchSessionConfigBootstrapRequest = async ({
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
  if (!slugResolution.ok) {
    return deps?.json?.({ error: slugResolution.error }, 400, baseHeaders);
  }
  if (!slugResolution.explicitSlugProvided) {
    return deps?.json?.({ error: constants?.missingSlugError }, 400, baseHeaders);
  }

  const slug = slugResolution.slug;
  const config = await deps?.getSessionConfig?.(env, slug);
  // Do not expose chain-canonical config through a caller-selected worker.
  if (!config || !isWorkerCanonicalSessionConfig(config)) {
    return deps?.json?.({ error: constants?.sessionConfigNotFoundError }, 404, baseHeaders);
  }
  const corsContext = await deps?.getCorsContext?.({ request, config });
  if (!corsContext?.ok) return corsContext?.response;

  return deps?.json?.({
    ok: true,
    sessionSlug: slug,
    config: projectPublicWorkerSessionConfig(config),
  }, 200, corsContext.headers);
};
