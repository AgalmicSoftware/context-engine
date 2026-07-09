import {
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  type SessionResultsHtmlSnapshot,
} from '../../utilities/sessionResultsExport';
import { bindSurveyResultsHtmlReportExporterPort } from './surveyResultsHtmlReportExporterPort';
import type { SurveyResultsHtmlReportDownloadRequest } from './surveyResultsHtmlReportDownloadRequest';

const buildSnapshot = (): SessionResultsHtmlSnapshot => ({
  counts: {
    atlasNodes: 0,
    participants: 1,
    questions: 1,
    responses: 1,
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

const buildDownloadRequest = (
  overrides: Partial<SurveyResultsHtmlReportDownloadRequest> = {},
): SurveyResultsHtmlReportDownloadRequest => ({
  filename: 'contextEngine_sessionReport_demo-session_2026-05-25T18_30_00_000Z.html',
  filenameIdentity: {
    exportedAt: '2026-05-25T18:30:00.000Z',
    name: 'Demo Session',
    slug: 'demo-session',
  },
  kind: 'html',
  renderOptions: {
    format: SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
    sections: {
      argumentMap: false,
      atlas: false,
      report: true,
      riskMatrix: false,
      snapshotJson: true,
    },
  },
  ...overrides,
});

describe('surveyResultsHtmlReportExporterPort', () => {
  it('renders the requested snapshot before executing the HTML report download', async () => {
    const snapshot = buildSnapshot();
    const downloadRequest = buildDownloadRequest();
    const renderHtmlReport = jest.fn(() => '<html>Rendered report</html>');
    const downloadHtmlReport = jest.fn();
    const downloadPdfReport = jest.fn(async () => undefined);
    const exporter = bindSurveyResultsHtmlReportExporterPort({
      downloadPort: () => ({
        downloadHtmlReport,
        downloadPdfReport,
      }),
      renderHtmlReport: () => renderHtmlReport,
    });

    await expect(
      exporter.exportReport({
        downloadRequest,
        snapshot,
      }),
    ).resolves.toEqual({
      filename: downloadRequest.filename,
      html: '<html>Rendered report</html>',
      kind: 'html',
    });

    expect(renderHtmlReport).toHaveBeenCalledWith(snapshot, downloadRequest.renderOptions);
    expect(downloadHtmlReport).toHaveBeenCalledWith('<html>Rendered report</html>', downloadRequest.filename);
    expect(downloadPdfReport).not.toHaveBeenCalled();
  });

  it('routes PDF requests through the DOM/PDF capture download backend', async () => {
    const snapshot = buildSnapshot();
    const downloadRequest = buildDownloadRequest({
      filename: 'contextEngine_sessionReport_demo-session_2026-05-25T18_30_00_000Z.pdf',
      kind: 'pdf',
      renderOptions: {
        ...buildDownloadRequest().renderOptions,
        format: SESSION_RESULTS_EXPORT_FORMAT_PDF,
      },
    });
    const renderHtmlReport = jest.fn(() => '<html>PDF report</html>');
    const downloadHtmlReport = jest.fn();
    const downloadPdfReport = jest.fn(async () => undefined);
    const exporter = bindSurveyResultsHtmlReportExporterPort({
      downloadPort: () => ({
        downloadHtmlReport,
        downloadPdfReport,
      }),
      renderHtmlReport: () => renderHtmlReport,
    });

    await exporter.exportReport({
      downloadRequest,
      snapshot,
    });

    expect(renderHtmlReport).toHaveBeenCalledWith(snapshot, downloadRequest.renderOptions);
    expect(downloadPdfReport).toHaveBeenCalledWith({
      filename: downloadRequest.filename,
      html: '<html>PDF report</html>',
    });
    expect(downloadHtmlReport).not.toHaveBeenCalled();
  });
});
