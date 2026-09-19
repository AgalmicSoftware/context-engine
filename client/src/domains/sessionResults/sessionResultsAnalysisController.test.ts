import {
  buildInitialGeneratedResultsControllerState,
  resolveGeneratedResultsControllerState,
  shouldOfferGeneratedResultsAuthorization,
} from './sessionResultsAnalysisController';

describe('sessionResultsAnalysisController', () => {
  it('keeps generated controls hidden until server status authorizes admin', () => {
    const state = resolveGeneratedResultsControllerState({
      statusBody: { ok: false, status: 403, error: 'Admin authorization failed.' },
    });

    expect(state.adminAuthorized).toBe(false);
    expect(state.canGenerate).toBe(false);
    expect(state.viewOptions).toEqual([]);
    expect(state.status).toBe('unauthorized');
  });

  it('maps status draft snapshots into renderable generated view state', () => {
    const state = resolveGeneratedResultsControllerState({
      previousSelectedView: 'breakdown',
      statusBody: {
        ok: true,
        adminAuthorized: true,
        settings: {
          version: 1,
          generationMode: 'manual',
          views: { circles: true, breakdown: true, riskMatrix: true },
          autoAfter: { threshold: 10, unit: 'distinctParticipants' },
          inputScope: 'submitted',
          publication: 'latest_success_visible',
        },
        capability: { manual: { supported: true, sourceKinds: ['worker-canonical'] } },
        state: {
          jobState: 'idle',
          lastGood: {
            draftId: 'draft-1',
            generatedAt: '2026-09-17T12:00:00.000Z',
            source: {
              kind: 'worker-canonical',
              responseCount: 4,
              participantCount: 2,
              aiInputResponseCount: 3,
              aiInputQuestionCount: 1,
              totalQuestionCount: 2,
              excludedCount: 1,
              lockedCount: 1,
            },
            artifact: {
              kind: 'ce_session_results_analysis_artifact',
              source: 'ai-generated',
              version: 1,
              generatedAt: '2026-09-17T12:00:00.000Z',
              inputSignature: 'sig',
              participants: [],
              sections: {
                argumentMap: { available: true, debates: [] },
                atlas: { available: false, nodes: [], edges: [], reason: 'empty' },
                breakdown: { available: true, dimensions: [], groups: [], summary: { overview: 'ok' } },
                riskMatrix: {
                  available: false,
                  categories: [],
                  comments: [],
                  heatmap: {},
                  scenarioLinks: [],
                  reason: 'not returned',
                },
              },
            },
            snapshot: {
              questions: [{ questionId: 'q1', prompt: 'What matters?', type: 'text' }],
              responses: [
                { questionId: 'q1', answer: 'Clarity', additionalComments: 'Make it readable', participantId: 'p1' },
              ],
            },
          },
        },
      },
    });

    expect(state.adminAuthorized).toBe(true);
    expect(state.canGenerate).toBe(true);
    expect(state.selectedView).toBe('breakdown');
    expect(state.viewOptions.map((option) => option.key)).toEqual(['circles', 'breakdown', 'riskMatrix']);
    expect(state.coverageLabel).toContain('4 responses');
    expect(state.coverageLabel).toContain('AI input used 3 responses');
    expect(state.coverageLabel).toContain('1/2 questions included');
    expect(state.coverageLabel).toContain('1 excluded');
    expect(state.coverageLabel).toContain('1 locked row skipped');
    expect(state.questions[0]).toEqual(expect.objectContaining({ id: 'q1', prompt: 'What matters?' }));
    expect(state.responses[0]).toEqual(expect.objectContaining({ additional: 'Make it readable' }));
  });

  it('renders viewer-visible artifacts without enabling admin generation', () => {
    const state = resolveGeneratedResultsControllerState({
      statusBody: {
        ok: true,
        viewerAuthorized: true,
        adminAuthorized: false,
        settings: {
          version: 1,
          generationMode: 'manual',
          views: { circles: true, breakdown: true, riskMatrix: true },
          autoAfter: { threshold: 10, unit: 'distinctParticipants' },
          inputScope: 'submitted',
          publication: 'latest_success_visible',
        },
        capability: { manual: { supported: true } },
        state: {
          jobState: 'succeeded',
          lastGood: {
            draftId: 'draft-viewer',
            source: { responseCount: 1, participantCount: 1 },
            artifact: {
              kind: 'ce_session_results_analysis_artifact',
              sections: {
                argumentMap: { available: true },
                atlas: { available: true },
                breakdown: { available: true },
                riskMatrix: { available: true },
              },
            },
            snapshot: { questions: [], responses: [] },
          },
        },
      },
    });

    expect(state.viewerAuthorized).toBe(true);
    expect(state.adminAuthorized).toBe(false);
    expect(state.canGenerate).toBe(false);
    expect(state.viewOptions.map((option) => option.key)).toEqual(['circles', 'breakdown', 'riskMatrix']);
  });

  it('treats queued jobs as running without exposing another generation action', () => {
    const queued = resolveGeneratedResultsControllerState({
      statusBody: {
        ok: true,
        adminAuthorized: true,
        settings: {
          version: 1,
          generationMode: 'automatic',
          views: { circles: true, breakdown: true, riskMatrix: true },
          autoAfter: { threshold: 10, unit: 'distinctParticipants' },
          inputScope: 'submitted',
          publication: 'latest_success_visible',
        },
        capability: { manual: { supported: true } },
        state: { jobState: 'queued', lastFailure: { error: 'Provider failed.' }, lastGood: null },
      },
    });

    expect(queued.isRunning).toBe(true);
    expect(queued.status).toBe('running');
    expect(queued.canGenerate).toBe(false);
    expect(queued.lastFailure).toBe('Provider failed.');
  });

  it('allows retry for automatic-only sessions only after a failed run is no longer active', () => {
    const state = resolveGeneratedResultsControllerState({
      statusBody: {
        ok: true,
        adminAuthorized: true,
        settings: {
          version: 1,
          generationMode: 'automatic',
          views: { circles: true, breakdown: true, riskMatrix: true },
          autoAfter: { threshold: 10, unit: 'distinctParticipants' },
          inputScope: 'submitted',
          publication: 'latest_success_visible',
        },
        capability: { manual: { supported: true } },
        state: { jobState: 'failed', lastFailure: { error: 'Provider failed.' }, lastGood: null },
      },
    });

    expect(state.isRunning).toBe(false);
    expect(state.canGenerate).toBe(true);
    expect(state.canCheckStatus).toBe(false);
    expect(state.lastFailure).toBe('Provider failed.');
  });

  it('turns an expired running poll into a status recheck without enabling another signed generation', () => {
    const state = resolveGeneratedResultsControllerState({
      statusBody: {
        ok: true,
        adminAuthorized: true,
        pollExpired: true,
        settings: {
          version: 1,
          generationMode: 'manual',
          views: { circles: true, breakdown: true, riskMatrix: true },
          autoAfter: { threshold: 10, unit: 'distinctParticipants' },
          inputScope: 'submitted',
          publication: 'latest_success_visible',
        },
        capability: { manual: { supported: true } },
        state: { jobState: 'idle', active: null, lastGood: null },
      },
    });

    expect(state.isRunning).toBe(false);
    expect(state.canCheckStatus).toBe(true);
    expect(state.canGenerate).toBe(false);
    expect(state.statusLabel).toContain('Check again');
  });

  it('uses config hints only to offer explicit authorization', () => {
    expect(
      shouldOfferGeneratedResultsAuthorization({
        account: '0xabc',
        sessionConfig: { adminAddress: '0xAbC' },
      }),
    ).toBe(true);
    expect(
      shouldOfferGeneratedResultsAuthorization({
        account: '0xabc',
        sessionConfig: { adminAddress: '0xdef' },
      }),
    ).toBe(false);
    expect(
      shouldOfferGeneratedResultsAuthorization({
        account: '0xabc',
        sessionConfig: { hatsAddress: '0xhat', adminHatId: '123' },
      }),
    ).toBe(true);
    expect(buildInitialGeneratedResultsControllerState().adminAuthorized).toBe(false);
  });
});
