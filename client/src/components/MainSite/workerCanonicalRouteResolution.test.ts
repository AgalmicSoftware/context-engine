import {
  resolveMainSiteAdminWorkerRoute,
  resolveMainSiteSessionRouteForRender,
} from './workerCanonicalRouteResolution';
import type { WorkerCanonicalRouteController } from './workerCanonicalRouteController';

const controller: WorkerCanonicalRouteController = {
  getActiveVerifiedConfig: () => null,
  getVerifiedConfig: () => null,
  hasVerifiedRoute: () => false,
  handleBootstrapResolved: () => undefined,
  isSessionSlug: () => false,
};

describe('workerCanonicalRouteResolution', () => {
  it('treats an explicit empty Worker discovery record as a Worker error', () => {
    const resolveStandardSessionRoute = jest.fn();

    const result = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: 'worker-session',
      searchStr: '?worker=',
      controller,
      resolveSessionSlugFromPathToken: (token) => token,
      resolveStandardSessionRoute,
    });

    expect(result).toMatchObject({
      kind: 'error',
      error: 'No Session Worker origin is available in this discovery link.',
      sessionRoute: null,
    });
    expect(resolveStandardSessionRoute).not.toHaveBeenCalled();
  });

  it('keeps a route without Worker discovery in the standard registry/demo lookup', () => {
    const standardResult = {
      sessionIdFromPath: null,
      configBySessionId: null,
      sessionSlug: 'registry-session',
      sessionConfig: null,
      hasUnresolvedSessionId: false,
    };
    const resolveStandardSessionRoute = jest.fn(() => standardResult);

    const result = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: 'registry-session',
      searchStr: '',
      controller,
      resolveSessionSlugFromPathToken: (token) => token,
      resolveStandardSessionRoute,
    });

    expect(result.kind).toBe('standard');
    expect(result.sessionRoute).toBe(standardResult);
    expect(resolveStandardSessionRoute).toHaveBeenCalledTimes(1);
  });

  it('requires a session slug in Worker-canonical Admin discovery links', () => {
    expect(
      resolveMainSiteAdminWorkerRoute({
        searchStr: '?worker=https%3A%2F%2Fworker.example.test',
        controller,
      }),
    ).toMatchObject({
      kind: 'error',
      error: 'Worker-canonical admin links require a sessionSlug.',
    });
  });
});
