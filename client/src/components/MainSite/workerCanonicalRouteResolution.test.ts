import {
  resolveMainSiteAdminWorkerRoute,
  resolveMainSiteSessionRouteForRender,
} from './workerCanonicalRouteResolution';
import { sessionRegistryReadsPort } from '../../domains/sessions/registry/sessionRegistryReadPorts';
import type { WorkerCanonicalRouteController } from './workerCanonicalRouteController';

const controller: WorkerCanonicalRouteController = {
  getActiveVerifiedConfig: () => null,
  getVerifiedConfig: () => null,
  hasVerifiedRoute: () => false,
  handleBootstrapResolved: () => undefined,
  isSessionSlug: () => false,
};

describe('workerCanonicalRouteResolution', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('bootstraps bundled demo-interview-5 clean routes from the pinned Worker', () => {
    const resolveStandardSessionRoute = jest.fn();

    const result = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: 'demo-interview-5',
      searchStr: '?mode=interview',
      controller,
      resolveSessionSlugFromPathToken: (token) => token,
      resolveStandardSessionRoute,
    });

    expect(result).toMatchObject({
      kind: 'bootstrap',
      workerOrigin: 'https://ce-demo-interview-5-c1cde84edac7.agalmic.workers.dev',
      workerOnlySearch: '?worker=https%3A%2F%2Fce-demo-interview-5-c1cde84edac7.agalmic.workers.dev',
      workerSessionSlug: 'demo-interview-5',
      sessionRoute: {
        sessionSlug: 'demo-interview-5',
        sessionConfig: null,
      },
    });
    expect(resolveStandardSessionRoute).not.toHaveBeenCalled();
  });

  it('keeps registry-resolved demo-interview-5 routes on the standard path', () => {
    const registryConfig = {
      slug: 'demo-interview-5',
      sessionName: 'Registry Demo Interview 5',
    };
    const standardResult = {
      sessionIdFromPath: null,
      configBySessionId: null,
      sessionSlug: 'demo-interview-5',
      sessionConfig: registryConfig,
      hasUnresolvedSessionId: false,
    };
    const resolveStandardSessionRoute = jest.fn(() => standardResult);
    jest.spyOn(sessionRegistryReadsPort, 'getSessionConfig').mockReturnValue(registryConfig);

    const result = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: 'demo-interview-5',
      searchStr: '?mode=interview',
      controller,
      resolveSessionSlugFromPathToken: (token) => token,
      resolveStandardSessionRoute,
    });

    expect(result.kind).toBe('standard');
    expect(result.sessionRoute).toBe(standardResult);
    expect(resolveStandardSessionRoute).toHaveBeenCalledTimes(1);
  });

  it('uses verified live Worker config after bundled demo-interview-5 bootstrap', () => {
    const liveConfig = {
      slug: 'demo-interview-5',
      sessionId: '0xa0dfc46736b8288854ae2c4156877879',
      corsWorkerUrl: 'https://ce-demo-interview-5-c1cde84edac7.agalmic.workers.dev/',
      interviewMode: {
        openingMode: 'owner',
        followNewQuestions: true,
      },
      liveQuestionCount: 47,
    };
    const verifiedController: WorkerCanonicalRouteController = {
      ...controller,
      hasVerifiedRoute: (slug, origin) =>
        slug === 'demo-interview-5' && origin === 'https://ce-demo-interview-5-c1cde84edac7.agalmic.workers.dev',
    };

    const result = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: 'demo-interview-5',
      searchStr: '?mode=interview',
      controller: verifiedController,
      resolveSessionSlugFromPathToken: (token) => token,
      getVerifiedConfig: (input) =>
        input?.slug === 'demo-interview-5' &&
        input.workerOrigin === 'https://ce-demo-interview-5-c1cde84edac7.agalmic.workers.dev'
          ? liveConfig
          : null,
    });

    expect(result.kind).toBe('verified');
    expect(result.sessionRoute?.sessionConfig).toBe(liveConfig);
    expect(result.sessionRoute?.sessionConfig).toMatchObject({
      interviewMode: {
        openingMode: 'owner',
        followNewQuestions: true,
      },
      liveQuestionCount: 47,
    });
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
