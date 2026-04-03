import {
  fetchImage as fetchImageBoundary,
  fetchUrl as fetchUrlBoundary,
} from './fetchExecution.js';

export const createFetchHelpersWithWorkerDeps = ({
  deps,
} = {}) => ({
  fetchImage: async (url, baseHeaders) => (
    (deps?.fetchImage || fetchImageBoundary)({
      url,
      baseHeaders,
      deps: {
        json: deps?.json,
        normalizeFetchTargetUrl: deps?.normalizeFetchTargetUrl,
        isBlockedOutboundUrl: deps?.isBlockedOutboundUrl,
        safeFetch: deps?.safeFetch,
      },
    })
  ),
  fetchUrl: async (url, baseHeaders) => (
    (deps?.fetchUrl || fetchUrlBoundary)({
      url,
      baseHeaders,
      deps: {
        json: deps?.json,
        normalizeFetchTargetUrl: deps?.normalizeFetchTargetUrl,
        isBlockedOutboundUrl: deps?.isBlockedOutboundUrl,
        safeFetch: deps?.safeFetch,
      },
    })
  ),
});
