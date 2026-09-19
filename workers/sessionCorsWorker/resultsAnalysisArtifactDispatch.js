import {
  evaluateResultsAnalysisViewerEligibility,
  readPublishedResultsAnalysisArtifact,
} from './resultsAnalysisGeneration.js';
import {
  authorizeCloudflareStorageResourceRead,
} from './storageRouteExecution.js';

const withPrivateNoStoreHeaders = (headers = {}) => {
  const next = new Headers(headers || {});
  next.set('Cache-Control', 'private, no-store');
  return next;
};

const readIncludeSnapshot = (request) => {
  try {
    const value = new URL(request?.url || 'https://worker.invalid/').searchParams.get('includeSnapshot');
    return value == null || value === '' ? true : value !== 'false' && value !== '0';
  } catch {
    return true;
  }
};

export const dispatchResultsAnalysisArtifactRequest = async ({
  request,
  env,
  config,
  slug,
  address,
  scopes,
  headers,
  deps,
} = {}) => {
  const responseHeaders = withPrivateNoStoreHeaders(headers);
  const visibility = (deps?.evaluateResultsAnalysisViewerEligibility || evaluateResultsAnalysisViewerEligibility)({ config });
  if (!visibility?.ok) {
    return deps?.json?.({ ok: false, error: visibility?.error || 'Results analysis artifact is not visible.', reason: visibility?.reason }, visibility?.status || 403, responseHeaders);
  }

  const authorize = deps?.authorizeCloudflareStorageResourceRead || authorizeCloudflareStorageResourceRead;
  for (const resource of ['generatedArtifacts', 'questions', 'responses']) {
    const storageAccess = await authorize({
      env,
      config,
      slug,
      resource,
      requesterAddress: address,
      authScopes: scopes,
      baseHeaders: responseHeaders,
      deps,
    });
    if (!storageAccess?.ok) return storageAccess?.response || deps?.json?.({ ok: false, error: 'Access denied.' }, 403, responseHeaders);
  }

  const result = await (deps?.readPublishedResultsAnalysisArtifact || readPublishedResultsAnalysisArtifact)({
    env,
    slug,
    config,
    includeSnapshot: readIncludeSnapshot(request),
    deps,
  });
  if (!result?.ok) {
    return deps?.json?.({ ok: false, error: result?.error || 'No generated results analysis artifact is available yet.', jobState: result?.jobState }, result?.status || 404, responseHeaders);
  }
  return deps?.json?.(result, 200, responseHeaders);
};
