import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import {
  generateResultsForHost,
  authorizeGeneratedResultsForHost,
  buildGeneratedResultsIdentityKey,
  loadGeneratedResultsArtifactForHost,
} from './onePageSessionGeneratedResultsRuntime';
import { resolveGeneratedResultsControllerState } from '../../domains/sessionResults/sessionResultsAnalysisController';

type GeneratedHost = Parameters<typeof generateResultsForHost>[0];
type UnknownRecord = Record<string, unknown>;
type TestStatusBody = UnknownRecord & { state: UnknownRecord };

const artifact = {
  kind: 'ce_session_results_analysis_artifact',
  source: 'ai-generated',
  version: 1,
  generatedAt: '2026-09-17T12:00:00.000Z',
  inputSignature: 'sig',
  participants: [],
  sections: {
    argumentMap: { available: true, debates: [] },
    atlas: { available: true, nodes: [], edges: [] },
    breakdown: { available: true, dimensions: [], groups: [], summary: { overview: 'ok' } },
    riskMatrix: { available: true, categories: [], comments: [], heatmap: {}, scenarioLinks: [] },
  },
};

const settings = {
  version: 1,
  generationMode: 'manual',
  views: { circles: true, breakdown: true, riskMatrix: true },
  autoAfter: { threshold: 10, unit: 'distinctParticipants' },
  inputScope: 'submitted',
  publication: 'latest_success_visible',
};

const buildStatusBody = (overrides: UnknownRecord = {}): TestStatusBody =>
  ({
    ok: true,
    adminAuthorized: true,
    sessionSlug: 'edge',
    sessionId: `0x${'1'.repeat(32)}`,
    settings,
    capability: { manual: { supported: true, sourceKinds: ['worker-canonical'] } },
    state: {
      jobState: 'idle',
      lastGood: {
        draftId: 'draft-previous',
        generatedAt: '2026-09-17T12:00:00.000Z',
        source: { kind: 'worker-canonical', responseCount: 2, participantCount: 2 },
        artifact,
        snapshot: { questions: [], responses: [] },
      },
    },
    ...overrides,
  }) as TestStatusBody;

const getLastGoodStatusDraft = (): unknown => buildStatusBody().state.lastGood;

const buildSessionConfig = (): UnknownRecord => ({
  slug: 'edge',
  sessionId: `0x${'1'.repeat(32)}`,
  corsWorkerUrl: 'https://worker.example',
  networkChainId: 11155420,
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  storageProfile: {
    backend: 'cloudflare',
    resources: { questions: 'active', surveys: 'active', responses: 'active' },
  },
});

const buildHost = (statusBody: UnknownRecord = buildStatusBody()): GeneratedHost => {
  const sessionConfig = buildSessionConfig();
  const host: GeneratedHost = {
    props: { account: '0xabc', loginComplete: true, provider: { name: 'synthetic-provider' } },
    state: {
      generatedResultsStatusBody: statusBody,
      generatedResultsAnalysis: resolveGeneratedResultsControllerState({ statusBody }),
      resultsViewMode: 'circles',
    },
    setState(patch) {
      const nextPatch = typeof patch === 'function' ? patch(host.state) : patch;
      if (nextPatch) host.state = { ...host.state, ...nextPatch };
    },
    resolveCurrentSessionConfig: () => sessionConfig,
    resolveCurrentSessionSlug: () => 'edge',
  };
  return host;
};

describe('onePageSessionGeneratedResultsRuntime', () => {
  it('includes login/session identity inputs in generated results identity keys', () => {
    const config = buildSessionConfig();
    expect(
      buildGeneratedResultsIdentityKey({
        account: '0xABC',
        loginComplete: true,
        sessionConfig: config,
        sessionSlug: 'edge',
        workerUrl: 'https://worker.example',
      }),
    ).toContain('0xabc|login');
  });

  it('polls a running generation until the latest successful artifact is visible', async () => {
    const host = buildHost();
    const readStatus = jest.fn(async () =>
      buildStatusBody({
        state: {
          jobState: 'succeeded',
          lastGood: {
            draftId: 'draft-next',
            generatedAt: '2026-09-17T12:02:00.000Z',
            source: { kind: 'worker-canonical', responseCount: 5, participantCount: 3 },
            artifact,
            snapshot: { questions: [], responses: [] },
          },
        },
      }),
    );

    await generateResultsForHost(host, {
      ports: {
        pollAttempts: 2,
        pollIntervalMs: 0,
        randomUUID: () => 'request-1',
        readQuestionsCache: () => ({}),
        readStatus,
        startGeneration: async () => ({
          ok: true,
          httpStatus: 202,
          jobState: 'running',
          reservation: { requestId: 'request-1' },
        }),
      },
    });

    expect(readStatus).toHaveBeenCalledTimes(1);
    expect(host.state.generatedResultsAnalysis?.lastGoodDraftId).toBe('draft-next');
    expect(host.state.generatedResultsAnalysis?.status).toBe('ready');
  });

  it('polls running admin status checks until the latest artifact is ready', async () => {
    const host = buildHost({ ok: false });
    const readStatus = jest
      .fn()
      .mockResolvedValueOnce(
        buildStatusBody({ state: { jobState: 'running', active: { requestId: 'queued' }, lastGood: null } }),
      )
      .mockResolvedValueOnce(buildStatusBody());

    await authorizeGeneratedResultsForHost(host, {
      ports: {
        pollAttempts: 2,
        pollIntervalMs: 0,
        readQuestionsCache: () => ({}),
        readStatus,
      },
    });

    expect(readStatus).toHaveBeenCalledTimes(2);
    expect(host.state.generatedResultsAnalysis?.status).toBe('ready');
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
  });

  it('clears stale viewer artifacts when viewer artifact access is revoked', async () => {
    const host = buildHost(buildStatusBody({ viewerAuthorized: true }));

    await loadGeneratedResultsArtifactForHost(host, {
      ports: {
        readQuestionsCache: () => ({}),
        readArtifact: async () => ({
          ok: false,
          status: 403,
          viewerAuthorized: false,
          error: 'Viewer access revoked.',
        }),
      },
    });

    expect(host.state.generatedResultsAnalysis?.viewerAuthorized).toBe(false);
    expect(host.state.generatedResultsAnalysis?.artifact).toBeNull();
    expect(host.state.generatedResultsAnalysis?.status).toBe('unauthorized');
  });

  it('loads viewer-visible artifacts without granting admin generation', async () => {
    const host = buildHost({ ok: false });

    await loadGeneratedResultsArtifactForHost(host, {
      ports: {
        readQuestionsCache: () => ({}),
        readArtifact: async () => ({
          ok: true,
          viewerAuthorized: true,
          sessionSlug: 'edge',
          sessionId: `0x${'1'.repeat(32)}`,
          settings,
          artifact,
          snapshot: { questions: [], responses: [] },
          source: { responseCount: 1, participantCount: 1 },
        }),
      },
    });

    expect(host.state.generatedResultsAnalysis?.viewerAuthorized).toBe(true);
    expect(host.state.generatedResultsAnalysis?.adminAuthorized).toBe(false);
    expect(host.state.generatedResultsAnalysis?.canGenerate).toBe(false);
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
  });

  it('preserves an explicit Report tab selection during viewer artifact refreshes', async () => {
    const host = buildHost(buildStatusBody({ viewerAuthorized: true }));
    host.state.resultsViewMode = 'polis';

    await loadGeneratedResultsArtifactForHost(host, {
      ports: {
        readQuestionsCache: () => ({}),
        readArtifact: async () => ({
          ok: true,
          viewerAuthorized: true,
          sessionSlug: 'edge',
          sessionId: `0x${'1'.repeat(32)}`,
          settings,
          artifact: { ...artifact, inputSignature: 'refresh-same-session' },
          snapshot: { questions: [], responses: [] },
          source: { responseCount: 30, participantCount: 30 },
        }),
      },
    });

    expect(host.state.generatedResultsAnalysis?.viewerAuthorized).toBe(true);
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
    expect(host.state.resultsViewMode).toBe('polis');
  });

  it('preserves a Report click made while a background artifact request is pending', async () => {
    const host = buildHost({ ok: false });
    host.state.resultsViewMode = 'circles';
    let resolveArtifact: (value: unknown) => void = () => {};
    const artifactPromise = new Promise((resolve) => {
      resolveArtifact = resolve;
    });

    const loadPromise = loadGeneratedResultsArtifactForHost(host, {
      ports: {
        readQuestionsCache: () => ({}),
        readArtifact: async () => artifactPromise,
      },
    });
    host.state.resultsViewMode = 'polis';
    resolveArtifact({
      ok: true,
      viewerAuthorized: true,
      sessionSlug: 'edge',
      sessionId: `0x${'1'.repeat(32)}`,
      settings,
      artifact,
      snapshot: { questions: [], responses: [] },
      source: { responseCount: 1, participantCount: 1 },
    });
    await loadPromise;

    expect(host.state.generatedResultsAnalysis?.viewerAuthorized).toBe(true);
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
    expect(host.state.resultsViewMode).toBe('polis');
  });

  it('reloads viewer artifacts even when stale prior session state was running', async () => {
    const host = buildHost(
      buildStatusBody({
        state: { jobState: 'running', active: { requestId: 'old-session' }, lastGood: getLastGoodStatusDraft() },
      }),
    );
    const readArtifact = jest.fn(async () => ({
      ok: true,
      viewerAuthorized: true,
      sessionSlug: 'edge',
      sessionId: `0x${'1'.repeat(32)}`,
      settings,
      artifact,
      snapshot: { questions: [], responses: [] },
      source: { responseCount: 2, participantCount: 2 },
    }));

    await loadGeneratedResultsArtifactForHost(host, {
      ports: { readQuestionsCache: () => ({}), readArtifact },
    });

    expect(readArtifact).toHaveBeenCalledTimes(1);
    expect(host.state.generatedResultsAnalysis?.viewerAuthorized).toBe(true);
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
  });

  it('reloads viewer-visible artifacts after generated state resets', async () => {
    const host = buildHost({ ok: false });
    const readArtifact = jest.fn(async () => ({
      ok: true,
      viewerAuthorized: true,
      sessionSlug: 'edge',
      sessionId: `0x${'1'.repeat(32)}`,
      settings,
      artifact,
      snapshot: { questions: [], responses: [] },
      source: { responseCount: 2, participantCount: 2 },
    }));

    await loadGeneratedResultsArtifactForHost(host, {
      ports: { readQuestionsCache: () => ({}), readArtifact },
    });
    host.state.generatedResultsAnalysis = resolveGeneratedResultsControllerState({ statusBody: { ok: false } });
    host.state.generatedResultsStatusBody = null;
    await loadGeneratedResultsArtifactForHost(host, {
      ports: { readQuestionsCache: () => ({}), readArtifact },
    });

    expect(readArtifact).toHaveBeenCalledTimes(2);
    expect(host.state.generatedResultsAnalysis?.viewerAuthorized).toBe(true);
    expect(host.state.generatedResultsAnalysis?.lastGoodDraftId).toBe('');
  });

  it('allows a second non-admin viewer to load the latest artifact without admin controls', async () => {
    const firstViewer = buildHost({ ok: false });
    const secondViewer = buildHost({ ok: false });
    secondViewer.props = { ...secondViewer.props, account: '0xviewer2' };
    const artifactBody = {
      ok: true,
      viewerAuthorized: true,
      sessionSlug: 'edge',
      sessionId: `0x${'1'.repeat(32)}`,
      settings,
      artifact,
      snapshot: { questions: [], responses: [] },
      source: { responseCount: 2, participantCount: 2 },
    };

    await loadGeneratedResultsArtifactForHost(firstViewer, {
      ports: { readQuestionsCache: () => ({}), readArtifact: async () => artifactBody },
    });
    await loadGeneratedResultsArtifactForHost(secondViewer, {
      ports: { readQuestionsCache: () => ({}), readArtifact: async () => artifactBody },
    });

    expect(firstViewer.state.generatedResultsAnalysis?.viewerAuthorized).toBe(true);
    expect(secondViewer.state.generatedResultsAnalysis?.viewerAuthorized).toBe(true);
    expect(secondViewer.state.generatedResultsAnalysis?.adminAuthorized).toBe(false);
    expect(secondViewer.state.generatedResultsAnalysis?.canGenerate).toBe(false);
  });

  it('preserves a viewer-visible artifact when generation authorization expires', async () => {
    const host = buildHost(buildStatusBody({ viewerAuthorized: true }));

    await generateResultsForHost(host, {
      ports: {
        randomUUID: () => 'request-2',
        readQuestionsCache: () => ({}),
        startGeneration: async () => ({ ok: false, status: 403, error: 'Admin authorization expired.' }),
      },
    });

    expect(host.state.generatedResultsAnalysis?.adminAuthorized).toBe(false);
    expect(host.state.generatedResultsAnalysis?.viewerAuthorized).toBe(true);
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
    expect(host.state.generatedResultsAnalysis?.canGenerate).toBe(false);
  });

  it('stops polling and preserves viewer artifacts when cached admin auth becomes pending', async () => {
    const host = buildHost(buildStatusBody({ viewerAuthorized: true }));

    await generateResultsForHost(host, {
      ports: {
        pollAttempts: 2,
        pollIntervalMs: 0,
        randomUUID: () => 'request-auth-pending',
        readQuestionsCache: () => ({}),
        readStatus: async () => ({ ok: false, authPending: true, error: 'Authenticate with the session Worker.' }),
        startGeneration: async () => ({
          ok: true,
          httpStatus: 202,
          jobState: 'running',
          reservation: { requestId: 'request-auth-pending' },
        }),
      },
    });

    expect(host.state.generatedResultsAnalysis?.adminAuthorized).toBe(false);
    expect(host.state.generatedResultsAnalysis?.viewerAuthorized).toBe(true);
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
    expect(host.state.generatedResultsAnalysis?.canGenerate).toBe(false);
  });

  it('keeps polling queued generation status until it succeeds', async () => {
    const host = buildHost();
    const readStatus = jest
      .fn()
      .mockResolvedValueOnce(
        buildStatusBody({ state: { jobState: 'queued', active: { requestId: 'queued' }, lastGood: null } }),
      )
      .mockResolvedValueOnce(buildStatusBody({ state: { jobState: 'succeeded', lastGood: getLastGoodStatusDraft() } }));

    await generateResultsForHost(host, {
      ports: {
        pollAttempts: 3,
        pollIntervalMs: 0,
        randomUUID: () => 'request-queued',
        readQuestionsCache: () => ({}),
        readStatus,
        startGeneration: async () => ({
          ok: true,
          httpStatus: 202,
          jobState: 'queued',
          reservation: { requestId: 'request-queued' },
        }),
      },
    });

    expect(readStatus).toHaveBeenCalledTimes(2);
    expect(host.state.generatedResultsAnalysis?.status).toBe('ready');
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
  });

  it('uses session results settings when viewer artifact responses omit settings', async () => {
    const host = buildHost({ ok: false });
    host.resolveCurrentSessionConfig = () => ({
      ...buildSessionConfig(),
      resultsAnalysis: {
        ...settings,
        views: { circles: true, breakdown: false, riskMatrix: true },
      },
    });

    await loadGeneratedResultsArtifactForHost(host, {
      ports: {
        readQuestionsCache: () => ({}),
        readArtifact: async () => ({
          ok: true,
          viewerAuthorized: true,
          sessionSlug: 'edge',
          sessionId: `0x${'1'.repeat(32)}`,
          artifact,
          snapshot: { questions: [], responses: [] },
          source: { responseCount: 1, participantCount: 1 },
        }),
      },
    });

    expect(host.state.generatedResultsAnalysis?.viewOptions.map((option) => option.key)).toEqual([
      'circles',
      'riskMatrix',
    ]);
  });

  it('keeps the previous successful artifact visible after a transient refresh failure', async () => {
    const host = buildHost();

    await generateResultsForHost(host, {
      ports: {
        randomUUID: () => 'request-3',
        readQuestionsCache: () => ({}),
        startGeneration: async () => ({ ok: false, error: 'AI provider timeout.' }),
      },
    });

    expect(host.state.generatedResultsAnalysis?.adminAuthorized).toBe(true);
    expect(host.state.generatedResultsAnalysis?.lastGoodDraftId).toBe('draft-previous');
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
    expect(host.state.generatedResultsAnalysis?.lastFailure).toBe('AI provider timeout.');
  });

  it('polls the viewer artifact endpoint when the artifact route reports a queued job without a first artifact', async () => {
    const host = buildHost({ ok: false });
    const readArtifact = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        viewerAuthorized: true,
        jobState: 'queued',
        requestId: 'viewer-queued',
      })
      .mockResolvedValueOnce({
        ok: true,
        viewerAuthorized: true,
        sessionSlug: 'edge',
        sessionId: `0x${'1'.repeat(32)}`,
        settings,
        artifact,
        snapshot: { questions: [], responses: [] },
        source: { responseCount: 2, participantCount: 2 },
      });
    const readStatus = jest.fn();
    const startGeneration = jest.fn();

    await loadGeneratedResultsArtifactForHost(host, {
      ports: {
        pollAttempts: 2,
        pollIntervalMs: 0,
        readQuestionsCache: () => ({}),
        readArtifact,
        readStatus,
        startGeneration,
      },
    });

    expect(readArtifact).toHaveBeenCalledTimes(2);
    expect(readStatus).not.toHaveBeenCalled();
    expect(startGeneration).not.toHaveBeenCalled();
    expect(host.state.generatedResultsAnalysis?.viewerAuthorized).toBe(true);
    expect(host.state.generatedResultsAnalysis?.status).toBe('ready');
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
  });

  it('expires viewer polling after a transient artifact failure while preserving the last good artifact', async () => {
    const host = buildHost(buildStatusBody({ viewerAuthorized: true }));
    const readArtifact = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        viewerAuthorized: true,
        jobState: 'queued',
        requestId: 'viewer-refresh',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        viewerAuthorized: true,
        error: 'Worker temporarily unavailable.',
      });
    const readStatus = jest.fn();

    await loadGeneratedResultsArtifactForHost(host, {
      ports: {
        pollAttempts: 2,
        pollIntervalMs: 0,
        readQuestionsCache: () => ({}),
        readArtifact,
        readStatus,
      },
    });

    expect(readArtifact).toHaveBeenCalledTimes(2);
    expect(readStatus).not.toHaveBeenCalled();
    expect(host.state.generatedResultsAnalysis?.isRunning).toBe(false);
    expect(host.state.generatedResultsAnalysis?.canCheckStatus).toBe(true);
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
    expect(host.state.generatedResultsAnalysis?.lastGoodDraftId).toBe('draft-previous');
  });

  it('continues polling viewer artifact 200 responses that report a running refresh with lastGood', async () => {
    const host = buildHost(buildStatusBody({ viewerAuthorized: true }));
    const runningLastGood = getLastGoodStatusDraft();
    const readArtifact = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        viewerAuthorized: true,
        sessionSlug: 'edge',
        sessionId: `0x${'1'.repeat(32)}`,
        settings,
        jobState: 'running',
        state: { jobState: 'running', lastGood: runningLastGood },
      })
      .mockResolvedValueOnce({
        ok: true,
        viewerAuthorized: true,
        sessionSlug: 'edge',
        sessionId: `0x${'1'.repeat(32)}`,
        settings,
        artifact: { ...artifact, inputSignature: 'finished' },
        snapshot: { questions: [], responses: [] },
        source: { responseCount: 3, participantCount: 2 },
      });

    await loadGeneratedResultsArtifactForHost(host, {
      ports: {
        pollAttempts: 2,
        pollIntervalMs: 0,
        readQuestionsCache: () => ({}),
        readArtifact,
      },
    });

    expect(readArtifact).toHaveBeenCalledTimes(2);
    expect(host.state.generatedResultsAnalysis?.isRunning).toBe(false);
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
    expect((host.state.generatedResultsStatusBody as UnknownRecord | undefined)?.pollExpired).toBe(false);
  });
  it('keeps the previous artifact visible while a same-session viewer reload is queued', async () => {
    const host = buildHost(buildStatusBody({ viewerAuthorized: true }));
    const readArtifact = jest.fn(async () => ({
      ok: false,
      status: 404,
      viewerAuthorized: true,
      jobState: 'queued',
      requestId: 'viewer-refresh',
    }));

    await loadGeneratedResultsArtifactForHost(host, {
      ports: {
        pollAttempts: 0,
        pollIntervalMs: 0,
        readQuestionsCache: () => ({}),
        readArtifact,
      },
    });

    expect(host.state.generatedResultsAnalysis?.status).toBe('ready');
    expect(host.state.generatedResultsAnalysis?.canCheckStatus).toBe(true);
    expect(host.state.generatedResultsAnalysis?.isRunning).toBe(false);
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
    expect(host.state.generatedResultsAnalysis?.lastGoodDraftId).toBe('draft-previous');
  });

  it('marks long running admin polls recheckable instead of leaving generation controls stuck running', async () => {
    const host = buildHost();
    const readStatus = jest.fn(async () =>
      buildStatusBody({
        state: { jobState: 'queued', active: { requestId: 'still-queued' }, lastGood: getLastGoodStatusDraft() },
      }),
    );

    await generateResultsForHost(host, {
      ports: {
        pollAttempts: 1,
        pollIntervalMs: 0,
        randomUUID: () => 'request-timeout',
        readQuestionsCache: () => ({}),
        readStatus,
        startGeneration: async () => ({
          ok: true,
          httpStatus: 202,
          jobState: 'queued',
          reservation: { requestId: 'request-timeout' },
        }),
      },
    });

    expect(readStatus).toHaveBeenCalledTimes(1);
    expect(host.state.generatedResultsAnalysis?.isRunning).toBe(false);
    expect(host.state.generatedResultsAnalysis?.canCheckStatus).toBe(true);
    expect(host.state.generatedResultsAnalysis?.canGenerate).toBe(false);
    expect(host.state.generatedResultsAnalysis?.statusLabel).toContain('Check again');
    expect(host.state.generatedResultsAnalysis?.artifact).not.toBeNull();
  });
});
