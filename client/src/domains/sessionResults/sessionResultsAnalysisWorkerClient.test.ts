import {
  buildResultsAnalysisArtifactUrl,
  buildResultsAnalysisStatusUrl,
  getCachedWorkerAuthHeaders,
  readSessionResultsAnalysisArtifact,
  readSessionResultsAnalysisStatus,
  startSessionResultsAnalysisGeneration,
} from './sessionResultsAnalysisWorkerClient';
import {
  buildTokenCacheEnvelope,
  buildTokenCacheKey,
  clearAllTokenCaches,
  writeTokenCache,
} from '../../utilities/worker/workerAuthTokenCache';

describe('sessionResultsAnalysisWorkerClient', () => {
  it('builds status URL with session slug and includeDraft query', () => {
    expect(
      buildResultsAnalysisStatusUrl({ workerUrl: 'https://worker.example/admin/set-config', sessionSlug: 'edge' }),
    ).toBe('https://worker.example/admin/results-analysis/status?sessionSlug=edge&includeDraft=true');
  });

  it('reads status using supplied JWT headers without signing itself', async () => {
    const getAuthHeaders = jest.fn(async (_args: unknown) => ({
      Authorization: 'Bearer cached-token',
      'X-Group-Slug': 'edge',
    }));
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        sessionSlug: 'edge',
        settings: { generationMode: 'manual', views: { circles: true, breakdown: true, riskMatrix: true } },
        capability: { manual: { supported: true } },
        state: { jobState: 'idle' },
      }),
    })) as unknown as typeof fetch;

    const result = await readSessionResultsAnalysisStatus({
      account: '0xabc',
      fetchImpl,
      getAuthHeaders: getAuthHeaders as typeof import('../../utilities/worker/workerAuth').getWorkerAuthHeaders,
      sessionSlug: 'edge',
      workerUrl: 'https://worker.example',
    });

    expect(result.adminAuthorized).toBe(true);
    expect(getAuthHeaders).toHaveBeenCalledWith(
      expect.objectContaining({ sessionSlug: 'edge', workerUrl: 'https://worker.example' }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example/admin/results-analysis/status?sessionSlug=edge&includeDraft=true',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer cached-token' }),
      }),
    );
  });

  it('does not authorize malformed 200 responses', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const result = await readSessionResultsAnalysisStatus({
      fetchImpl,
      getAuthHeaders: async () => ({ Authorization: 'Bearer cached-token' }),
      sessionSlug: 'edge',
      workerUrl: 'https://worker.example',
    });

    expect(result.adminAuthorized).toBe(false);
    expect(result.ok).toBe(false);
  });

  it('rejects null-shaped 200 responses and mismatched session ids', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          sessionSlug: 'edge',
          sessionId: `0x${'2'.repeat(32)}`,
          settings: null,
          capability: null,
          state: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          sessionSlug: 'edge',
          sessionId: `0x${'2'.repeat(32)}`,
          settings: {},
          capability: {},
          state: {},
        }),
      }) as unknown as typeof fetch;

    const nullShape = await readSessionResultsAnalysisStatus({
      fetchImpl,
      getAuthHeaders: async () => ({ Authorization: 'Bearer cached-token' }),
      sessionSlug: 'edge',
      sessionId: `0x${'1'.repeat(32)}`,
      workerUrl: 'https://worker.example',
    });
    const wrongSession = await readSessionResultsAnalysisStatus({
      fetchImpl,
      getAuthHeaders: async () => ({ Authorization: 'Bearer cached-token' }),
      sessionSlug: 'edge',
      sessionId: `0x${'1'.repeat(32)}`,
      workerUrl: 'https://worker.example',
    });

    expect(nullShape.adminAuthorized).toBe(false);
    expect(wrongSession.adminAuthorized).toBe(false);
  });

  it('reads viewer artifacts without admin status authorization', async () => {
    expect(buildResultsAnalysisArtifactUrl({ workerUrl: 'https://worker.example', sessionSlug: 'edge' })).toBe(
      'https://worker.example/results-analysis/artifact?sessionSlug=edge&includeSnapshot=true',
    );
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        sessionSlug: 'edge',
        sessionId: `0x${'1'.repeat(32)}`,
        artifact: { kind: 'ce_session_results_analysis_artifact' },
        snapshot: { questions: [], responses: [] },
      }),
    })) as unknown as typeof fetch;

    const result = await readSessionResultsAnalysisArtifact({
      fetchImpl,
      sessionSlug: 'edge',
      sessionId: `0x${'1'.repeat(32)}`,
      workerUrl: 'https://worker.example',
    });

    expect(result.viewerAuthorized).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example/results-analysis/artifact?sessionSlug=edge&includeSnapshot=true',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('uses cached viewer auth headers for artifact reads without invoking signing auth', async () => {
    clearAllTokenCaches();
    const sessionId = `0x${'1'.repeat(32)}`;
    const cacheKey = buildTokenCacheKey({
      workerUrl: 'https://worker.example',
      slug: 'edge',
      sessionId,
      address: '0x0000000000000000000000000000000000000abc',
    });
    writeTokenCache(
      cacheKey,
      buildTokenCacheEnvelope({
        token: 'cached-viewer-token',
        exp: Math.floor(Date.now() / 1000) + 3600,
        workerUrl: 'https://worker.example',
        sessionId,
        sessionSlug: 'edge',
        address: '0x0000000000000000000000000000000000000abc',
      }),
    );
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        sessionSlug: 'edge',
        sessionId,
        artifact: { kind: 'ce_session_results_analysis_artifact' },
        snapshot: { questions: [], responses: [] },
      }),
    })) as unknown as typeof fetch;

    await readSessionResultsAnalysisArtifact({
      account: '0x0000000000000000000000000000000000000abc',
      fetchImpl,
      sessionSlug: 'edge',
      sessionId,
      workerUrl: 'https://worker.example',
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example/results-analysis/artifact?sessionSlug=edge&includeSnapshot=true',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer cached-viewer-token', 'X-Group-Slug': 'edge' }),
      }),
    );
  });

  it('keeps artifact reads anonymous when no cached viewer token exists', async () => {
    clearAllTokenCaches();
    expect(
      getCachedWorkerAuthHeaders({
        account: '0x0000000000000000000000000000000000000abc',
        sessionSlug: 'edge',
        sessionId: `0x${'1'.repeat(32)}`,
        workerUrl: 'https://worker.example',
      }),
    ).toEqual({});
  });

  it('posts generation through the signed admin request channel', async () => {
    const signAdminAction = jest.fn(async (_args: unknown) => ({ signature: 'sig', address: '0xabc' }));
    const fetchImpl = jest.fn(async (_url, init) => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, echoed: JSON.parse(String(init?.body || '{}')) }),
    })) as unknown as typeof fetch;

    const result = await startSessionResultsAnalysisGeneration({
      body: { sessionSlug: 'edge', source: { kind: 'worker-canonical' } },
      fetchImpl,
      signAdminAction,
      workerUrl: 'https://worker.example',
    });

    expect(signAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'results-analysis/generate' }));
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example/admin/results-analysis/generate',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.echoed).toEqual(expect.objectContaining({ signature: 'sig', sessionSlug: 'edge' }));
  });
});
