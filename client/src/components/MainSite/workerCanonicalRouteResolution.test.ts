import { render, screen } from '@testing-library/react';
import {
  renderListedWorkerNotice,
  renderWorkerCanonicalRouteBootstrap,
  resolveMainSiteAdminWorkerRoute,
  resolveMainSiteGroupWorkerRoute,
  resolveMainSiteSessionRouteForRender,
} from './workerCanonicalRouteResolution';
import { sessionRegistryReadsPort } from '../../domains/sessions/registry/sessionRegistryReadPorts';
import type { WorkerCanonicalRouteController } from './workerCanonicalRouteController';
import { upsertWorkerCanonicalSessionBootstrap } from '../../utilities/session/sessionWorkerConfigCache';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { KNOWN_SESSION_CONFIGS } from '../../utilities/session/knownSessionsFile';
import { getSessionEntryRedirect } from './sessionEntryRedirect';

const FIXTURE_SLUG = 'fixture-session';
const FIXTURE_WORKER = 'https://ce-fixture-session.example.workers.dev';
const FIXTURE_SESSION_ID = '0x0123456789abcdef0123456789abcdef';

// A session listed only in known-sessions.json, with no other source change.
jest.mock('../../../../known-sessions.json', () => ({
  ...(jest.requireActual('../../../../known-sessions.json') as object),
  'fixture-session': {
    worker: 'https://ce-fixture-session.example.workers.dev',
    sessionId: '0x0123456789abcdef0123456789abcdef',
  },
}));

const controller: WorkerCanonicalRouteController = {
  getActiveVerifiedConfig: () => null,
  getVerifiedConfig: () => null,
  hasVerifiedRoute: () => false,
  handleBootstrapResolved: () => undefined,
  isSessionSlug: () => false,
};

describe('workerCanonicalRouteResolution', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('uses only the matching cached Worker as a hint and requires live verification', () => {
    const workerOrigin = 'https://group-worker.example';
    const config = {
      slug: 'group-worker',
      sessionId: '0x11111111111111111111111111111111',
      corsWorkerUrl: workerOrigin,
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    upsertWorkerCanonicalSessionBootstrap({ slug: config.slug, sessionIdHex: config.sessionId, workerOrigin, config });
    const options = { searchStr: '', workerSessionSlug: config.slug, sessionConfig: null, controller };
    expect(resolveMainSiteGroupWorkerRoute(options)).toMatchObject({
      kind: 'bootstrap',
      workerOrigin,
      sessionConfig: null,
    });
    expect(resolveMainSiteGroupWorkerRoute({ ...options, workerSessionSlug: 'other-session' }).kind).toBe('standard');
    expect(resolveMainSiteGroupWorkerRoute({ ...options, searchStr: '?worker=' }).kind).toBe('error');
    expect(
      resolveMainSiteGroupWorkerRoute({ ...options, searchStr: '?worker=https%3A%2F%2Fexplicit.example' }),
    ).toMatchObject({ kind: 'bootstrap', workerOrigin: 'https://explicit.example' });
    expect(
      resolveMainSiteGroupWorkerRoute({ ...options, sessionConfig: { slug: config.slug, __registry: { chainId: 1 } } })
        .kind,
    ).toBe('standard');
  });

  it('does not choose between conflicting cached Worker identities for a clean link', () => {
    const makeRecord = (sessionIdHex: string, workerOrigin: string) => ({
      slug: 'ambiguous-worker',
      sessionIdHex,
      registryChainId: 0,
      authorityMode: 'worker_canonical',
      workerOrigin,
      config: { corsWorkerUrl: workerOrigin },
      canonicalConfig: { slug: 'ambiguous-worker' },
    });
    localStorage.setItem(
      'ce:sessionWorkerConfigCache:v1',
      JSON.stringify({
        v: 3,
        bySession: {
          first: makeRecord('0x11111111111111111111111111111111', 'https://first.example'),
          second: makeRecord('0x22222222222222222222222222222222', 'https://second.example'),
        },
      }),
    );
    expect(
      resolveMainSiteGroupWorkerRoute({
        searchStr: '',
        workerSessionSlug: 'ambiguous-worker',
        sessionConfig: null,
        controller,
      }),
    ).toMatchObject({ kind: 'error', sessionConfig: null });
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

  it('opens a session added only to known-sessions.json from its normal link', () => {
    const resolveStandardSessionRoute = jest.fn();

    const result = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: FIXTURE_SLUG,
      searchStr: '?mode=interview',
      controller,
      resolveSessionSlugFromPathToken: (token) => token,
      resolveStandardSessionRoute,
    });

    expect(result).toMatchObject({
      kind: 'bootstrap',
      workerOrigin: FIXTURE_WORKER,
      workerOnlySearch: `?worker=${encodeURIComponent(FIXTURE_WORKER)}`,
      workerSessionSlug: FIXTURE_SLUG,
      expectedSessionId: FIXTURE_SESSION_ID,
      sessionRoute: { sessionSlug: FIXTURE_SLUG, sessionConfig: null },
    });
    expect(resolveStandardSessionRoute).not.toHaveBeenCalled();
  });

  it('bootstraps the public EDDY route without a Worker query parameter', () => {
    const resolveStandardSessionRoute = jest.fn();
    const result = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: 'eddy26',
      searchStr: '?mode=interview&joinGroup=eddy-2026',
      controller,
      resolveSessionSlugFromPathToken: (token) => token,
      resolveStandardSessionRoute,
    });
    expect(result).toMatchObject({
      kind: 'bootstrap',
      workerOrigin: 'https://ce-eddy26-d9702b0d3c41.agalmic.workers.dev',
      workerSessionSlug: 'eddy26',
      expectedSessionId: '0x864a48dfbde5a8ef4b5ac60a2980d842',
      sessionRoute: { sessionSlug: 'eddy26', sessionConfig: null },
    });
    expect(resolveStandardSessionRoute).not.toHaveBeenCalled();
  });

  it('checks the listed session ID on the link the EDDY redirect opens', () => {
    const redirect = new URL(getSessionEntryRedirect('/session/eddy26') || '', 'https://site.example');
    expect(redirect.searchParams.get('worker')).toBe('https://ce-eddy26-d9702b0d3c41.agalmic.workers.dev');
    expect(
      resolveMainSiteSessionRouteForRender({
        sessionTokenRaw: 'eddy26',
        searchStr: redirect.search,
        controller,
        resolveSessionSlugFromPathToken: (token) => token,
      }),
    ).toMatchObject({
      kind: 'bootstrap',
      workerSessionSlug: 'eddy26',
      expectedSessionId: '0x864a48dfbde5a8ef4b5ac60a2980d842',
    });
  });

  it('checks the listed session ID on group pages and links to the listed Worker', () => {
    const groupRoute = {
      searchStr: '',
      workerSessionSlug: FIXTURE_SLUG,
      sessionConfig: KNOWN_SESSION_CONFIGS[FIXTURE_SLUG],
      controller,
    };
    expect(resolveMainSiteGroupWorkerRoute(groupRoute)).toMatchObject({
      kind: 'bootstrap',
      workerOrigin: FIXTURE_WORKER,
      expectedSessionId: FIXTURE_SESSION_ID,
    });
    // A link naming another Worker chose it; the list says nothing about that Worker, so it opens marked.
    const otherWorker = resolveMainSiteGroupWorkerRoute({
      ...groupRoute,
      searchStr: '?worker=https%3A%2F%2Fother.example',
    });
    expect(otherWorker).not.toHaveProperty('expectedSessionId');
    expect(otherWorker).toMatchObject({ kind: 'bootstrap', listedWorkerOrigin: FIXTURE_WORKER });
    expect(resolveMainSiteGroupWorkerRoute(groupRoute)).not.toHaveProperty('listedWorkerOrigin');
  });

  it('opens a listed session’s name from another Worker with a notice linking to the listed one', () => {
    const route = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: FIXTURE_SLUG,
      searchStr: '?worker=https%3A%2F%2Fother.example',
      controller,
      resolveSessionSlugFromPathToken: (token) => token,
    });
    expect(route).toMatchObject({ kind: 'bootstrap', workerOrigin: 'https://other.example' });
    render(renderListedWorkerNotice(route)!);
    expect(screen.getByRole('status')).toHaveTextContent(
      `This link opens “${FIXTURE_SLUG}” from other.example, not the Worker this site lists for it.`,
    );
    expect(screen.getByRole('link', { name: 'Open the listed session' })).toHaveAttribute(
      'href',
      expect.stringMatching(new RegExp(`/session/${FIXTURE_SLUG}$`)),
    );
    // Its own link shows no notice.
    const listed = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: FIXTURE_SLUG,
      searchStr: `?worker=${encodeURIComponent(FIXTURE_WORKER)}`,
      controller,
      resolveSessionSlugFromPathToken: (token) => token,
    });
    expect(renderListedWorkerNotice(listed)).toBeNull();
  });

  it('opens the group-recording QR link on a device that has never seen the session', () => {
    const resolveStandardSessionRoute = jest.fn();
    const result = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: FIXTURE_SLUG,
      searchStr: '?mode=groupRecording&joinGroup=bc96eee1-192b-4b18-b36b-1bf7fc00bd9a',
      controller,
      resolveSessionSlugFromPathToken: (token) => token,
      resolveStandardSessionRoute,
    });
    expect(result).toMatchObject({
      kind: 'bootstrap',
      workerOrigin: FIXTURE_WORKER,
      workerSessionSlug: FIXTURE_SLUG,
      sessionRoute: { sessionSlug: FIXTURE_SLUG, sessionConfig: null },
    });
    expect(resolveStandardSessionRoute).not.toHaveBeenCalled();
  });

  it('opens each listed session from its normal link and checks the listed session ID', () => {
    const listed: Record<string, { worker: string; sessionId: string }> = jest.requireActual(
      '../../../../known-sessions.json',
    );
    expect(Object.keys(listed).length).toBeGreaterThan(0);
    for (const [slug, { worker, sessionId }] of Object.entries(listed)) {
      expect(
        resolveMainSiteSessionRouteForRender({
          sessionTokenRaw: slug,
          searchStr: '',
          controller,
          resolveSessionSlugFromPathToken: (token) => token,
        }),
      ).toMatchObject({
        kind: 'bootstrap',
        workerOrigin: worker,
        workerSessionSlug: slug,
        expectedSessionId: sessionId,
      });
    }
  });

  it('opens demo-sh from its own Worker instead of its bundled demo entry', () => {
    const resolveStandardSessionRoute = jest.fn();
    expect(
      resolveMainSiteSessionRouteForRender({
        sessionTokenRaw: 'demo-sh',
        searchStr: '',
        controller,
        resolveSessionSlugFromPathToken: (token) => token,
        resolveStandardSessionRoute,
      }),
    ).toMatchObject({
      kind: 'bootstrap',
      workerOrigin: 'https://ce-demo-sh-481bb6cd0a81.agalmic.workers.dev',
      expectedSessionId: '0xb822b3eca85bdc35cf83cb947bceb6b2',
      sessionRoute: { sessionSlug: 'demo-sh', sessionConfig: null },
    });
    expect(resolveStandardSessionRoute).not.toHaveBeenCalled();
  });

  it("keeps /session/demo on the bundled demo, though it borrows demo-sh's entry", () => {
    const resolveStandardSessionRoute = jest.fn();
    const result = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: 'demo',
      searchStr: '',
      controller,
      resolveSessionSlugFromPathToken: (token) => token,
      resolveStandardSessionRoute,
    });
    expect(result).toMatchObject({ kind: 'standard', workerOrigin: '' });
    expect(resolveStandardSessionRoute).toHaveBeenCalledTimes(1);
  });

  it("opens the films' rxc-ra-test-5 interview link, which names its group", () => {
    const resolveStandardSessionRoute = jest.fn();
    expect(
      resolveMainSiteSessionRouteForRender({
        sessionTokenRaw: 'rxc-ra-test-5',
        searchStr: '?mode=interview&joinGroup=7824a38f-6946-4351-b74b-81307b406180',
        controller,
        resolveSessionSlugFromPathToken: (token) => token,
        resolveStandardSessionRoute,
      }),
    ).toMatchObject({
      kind: 'bootstrap',
      workerOrigin: 'https://ce-rxc-ra-test-5.agalmic.workers.dev',
      expectedSessionId: '0xb55d194c42422fd61bedc21fda1c7cdc',
      sessionRoute: { sessionSlug: 'rxc-ra-test-5', sessionConfig: null },
    });
    expect(resolveStandardSessionRoute).not.toHaveBeenCalled();
  });

  it('looks up a session that is not in the file like any other slug', () => {
    const resolveStandardSessionRoute = jest.fn();
    const result = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: 'rxc-ra-test-3',
      searchStr: '',
      controller,
      resolveSessionSlugFromPathToken: (token) => token,
      resolveStandardSessionRoute,
    });
    expect(result.kind).toBe('standard');
    expect(resolveStandardSessionRoute).toHaveBeenCalledTimes(1);
  });

  it('keeps registry-resolved routes on the standard path', () => {
    const registryConfig = { slug: FIXTURE_SLUG, sessionName: 'Registry fixture' };
    const standardResult = {
      sessionIdFromPath: null,
      configBySessionId: null,
      sessionSlug: FIXTURE_SLUG,
      sessionConfig: registryConfig,
      hasUnresolvedSessionId: false,
    };
    const resolveStandardSessionRoute = jest.fn(() => standardResult);
    jest.spyOn(sessionRegistryReadsPort, 'getSessionConfig').mockReturnValue(registryConfig);

    const result = resolveMainSiteSessionRouteForRender({
      sessionTokenRaw: FIXTURE_SLUG,
      searchStr: '?mode=interview',
      controller,
      resolveSessionSlugFromPathToken: (token) => token,
      resolveStandardSessionRoute,
    });

    expect(result.kind).toBe('standard');
    expect(result.sessionRoute).toBe(standardResult);
    expect(resolveStandardSessionRoute).toHaveBeenCalledTimes(1);
  });

  describe('after a known session has bootstrapped', () => {
    const verifiedController: WorkerCanonicalRouteController = {
      ...controller,
      hasVerifiedRoute: (slug, origin) => slug === FIXTURE_SLUG && origin === FIXTURE_WORKER,
    };
    const resolveWithCachedConfig = (cachedConfig: Record<string, unknown>, searchStr = '?mode=interview') =>
      resolveMainSiteSessionRouteForRender({
        sessionTokenRaw: FIXTURE_SLUG,
        searchStr,
        controller: verifiedController,
        resolveSessionSlugFromPathToken: (token) => token,
        getVerifiedConfig: (input) =>
          input?.slug === FIXTURE_SLUG && input.workerOrigin === FIXTURE_WORKER ? cachedConfig : null,
      });

    it('uses the verified live Worker config', () => {
      const liveConfig = {
        slug: FIXTURE_SLUG,
        sessionId: FIXTURE_SESSION_ID,
        corsWorkerUrl: `${FIXTURE_WORKER}/`,
        interviewMode: { openingMode: 'owner', followNewQuestions: true },
        liveQuestionCount: 47,
      };

      const result = resolveWithCachedConfig(liveConfig);

      expect(result.kind).toBe('verified');
      expect(result.sessionRoute?.sessionConfig).toBe(liveConfig);
    });

    it('checks a verified config for another session with the Worker again', () => {
      const result = resolveWithCachedConfig({
        slug: FIXTURE_SLUG,
        sessionId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        corsWorkerUrl: FIXTURE_WORKER,
      });

      expect(result).toMatchObject({
        kind: 'bootstrap',
        sessionConfig: null,
        expectedSessionId: FIXTURE_SESSION_ID,
        sessionRoute: { sessionSlug: FIXTURE_SLUG, sessionConfig: null },
      });
      // The bootstrap it renders refuses a Worker that still reports another ID.
      expect(renderWorkerCanonicalRouteBootstrap(result, controller)?.props).toMatchObject({
        sessionSlug: FIXTURE_SLUG,
        workerQueryValue: FIXTURE_WORKER,
        expectedSessionId: FIXTURE_SESSION_ID,
      });
    });

    it('checks a verified config for another session on a link naming the listed Worker', () => {
      const result = resolveWithCachedConfig(
        { slug: FIXTURE_SLUG, sessionId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', corsWorkerUrl: FIXTURE_WORKER },
        `?worker=${encodeURIComponent(FIXTURE_WORKER)}`,
      );

      expect(result).toMatchObject({ kind: 'bootstrap', sessionConfig: null, expectedSessionId: FIXTURE_SESSION_ID });
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
