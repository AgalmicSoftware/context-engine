import {
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  type SessionResultsHtmlSnapshot,
  type SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import {
  buildSurveyResultsHtmlReportDownloadRequest,
  buildSurveyResultsHtmlReportDownloadExecutionPlan,
} from './surveyResultsHtmlReportDownloadRequest';

const buildSnapshot = (): SessionResultsHtmlSnapshot => ({
  counts: {
    atlasNodes: 0,
    participants: 2,
    questions: 3,
    responses: 4,
    riskMatrixComments: 0,
  },
  exportedAt: '2026-05-25T18:30:00.000Z',
  filters: {},
  privacyMode: 'redacted',
  redactions: [],
  sections: {
    argumentMap: { available: false, debates: [] },
    atlas: { available: false, edges: [], nodes: [] },
    report: {
      available: true,
      dimensions: [],
      groups: [],
      questions: [],
      representativeQuestions: [],
      summary: {},
    },
    riskMatrix: {
      available: false,
      categories: [],
      comments: [],
      heatmap: {},
      scenarioLinks: [],
    },
  },
  session: {
    chainId: 11155420,
    latestKnownBlock: 123,
    name: 'Demo Session',
    networkLabel: 'OP Sepolia',
    slug: 'demo-session',
  },
  type: 'ce_session_results_html_snapshot',
  version: 1,
});

const selectedSections: Required<SessionResultsSectionSelection> = {
  argumentMap: false,
  atlas: false,
  report: true,
  riskMatrix: false,
  snapshotJson: true,
};

describe('buildSurveyResultsHtmlReportDownloadRequest', () => {
  it('describes the default HTML report download without executing export work', () => {
    const request = buildSurveyResultsHtmlReportDownloadRequest({
      selectedSections,
      snapshot: buildSnapshot(),
    });

    expect(request).toEqual({
      filename: 'contextEngine_sessionReport_demo-session_2026-05-25T18_30_00_000Z.html',
      filenameIdentity: {
        exportedAt: '2026-05-25T18:30:00.000Z',
        name: 'Demo Session',
        slug: 'demo-session',
      },
      kind: 'html',
      renderOptions: {
        format: SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
        sections: selectedSections,
      },
    });
  });

  it('preserves a single-HTML render format while keeping browser download identity', () => {
    const request = buildSurveyResultsHtmlReportDownloadRequest({
      format: SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
      selectedSections,
      snapshot: buildSnapshot(),
    });

    expect(request.kind).toBe('html');
    expect(request.filename).toBe('contextEngine_sessionReport_demo-session_2026-05-25T18_30_00_000Z.html');
    expect(request.renderOptions).toEqual({
      format: SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
      sections: selectedSections,
    });
  });

  it('describes PDF report download identity without owning DOM capture', () => {
    const request = buildSurveyResultsHtmlReportDownloadRequest({
      format: SESSION_RESULTS_EXPORT_FORMAT_PDF,
      selectedSections,
      snapshot: buildSnapshot(),
    });

    expect(request.kind).toBe('pdf');
    expect(request.filename).toBe('contextEngine_sessionReport_demo-session_2026-05-25T18_30_00_000Z.pdf');
    expect(request.renderOptions).toEqual({
      format: SESSION_RESULTS_EXPORT_FORMAT_PDF,
      sections: selectedSections,
    });
  });
});

describe('buildSurveyResultsHtmlReportDownloadExecutionPlan', () => {
  it('blocks unauthorized downloads before describing render/download execution', () => {
    const plan = buildSurveyResultsHtmlReportDownloadExecutionPlan({
      isAuthorized: false,
      selectedSections,
      snapshot: buildSnapshot(),
    });

    expect(plan.status).toBe('blocked');
    expect(plan.blockedReason).toBe('not-authorized');
    expect(plan.downloadRequest).toBeNull();
    expect(plan.statePatch).toEqual({
      alertMessage: 'Connect a wallet with permission to view these results before export.',
    });
    expect(plan.readinessPlan.canDownload).toBe(false);
  });

  it('blocks unavailable selected analysis sections without building a download request', () => {
    const plan = buildSurveyResultsHtmlReportDownloadExecutionPlan({
      isAuthorized: true,
      selectedSections: {
        ...selectedSections,
        riskMatrix: true,
      },
      snapshot: buildSnapshot(),
    });

    expect(plan.status).toBe('blocked');
    expect(plan.blockedReason).toBe('unavailable-selected-sections');
    expect(plan.downloadRequest).toBeNull();
    expect(plan.statePatch).toEqual({
      alertMessage: 'Generate selected analysis views before downloading the report.',
    });
    expect(plan.readinessPlan.needsAnalysisGeneration).toBe(true);
  });

  it('blocks pending analysis generation before describing render/download execution', () => {
    const plan = buildSurveyResultsHtmlReportDownloadExecutionPlan({
      analysisGenerating: true,
      isAuthorized: true,
      selectedSections,
      snapshot: buildSnapshot(),
    });

    expect(plan.status).toBe('blocked');
    expect(plan.blockedReason).toBe('analysis-generating');
    expect(plan.downloadRequest).toBeNull();
    expect(plan.statePatch).toEqual({
      alertMessage: 'Wait for analysis generation to finish before downloading the report.',
    });
    expect(plan.readinessPlan.canDownload).toBe(false);
  });

  it('describes ready PDF render/download identity without executing report work', () => {
    const plan = buildSurveyResultsHtmlReportDownloadExecutionPlan({
      format: SESSION_RESULTS_EXPORT_FORMAT_PDF,
      isAuthorized: true,
      selectedSections,
      snapshot: buildSnapshot(),
    });

    expect(plan).toEqual(
      expect.objectContaining({
        blockedReason: '',
        statePatch: null,
        status: 'ready',
      }),
    );
    expect(plan.readinessPlan.canDownload).toBe(true);
    expect(plan.downloadRequest).toEqual({
      filename: 'contextEngine_sessionReport_demo-session_2026-05-25T18_30_00_000Z.pdf',
      filenameIdentity: {
        exportedAt: '2026-05-25T18:30:00.000Z',
        name: 'Demo Session',
        slug: 'demo-session',
      },
      kind: 'pdf',
      renderOptions: {
        format: SESSION_RESULTS_EXPORT_FORMAT_PDF,
        sections: selectedSections,
      },
    });
  });
});
