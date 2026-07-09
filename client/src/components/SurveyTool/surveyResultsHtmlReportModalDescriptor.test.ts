import { SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS } from './surveyResultsHtmlReportSelection.js';
import { buildSurveyResultsHtmlReportExportModalDescriptor } from './surveyResultsHtmlReportModalDescriptor.js';
import { buildRedactedSessionResultsSnapshot } from '../../utilities/sessionResultsExport';

const buildHtmlReportSnapshot = ({
  argumentMapAvailable = false,
  atlasAvailable = false,
  reportAvailable = true,
  riskMatrixAvailable = false,
} = {}) =>
  buildRedactedSessionResultsSnapshot({
    exportedAt: '2026-05-25T18:30:00.000Z',
    session: {
      chainId: 11155420,
      name: 'Readiness Session',
      slug: 'readiness-session',
    },
    sections: {
      argumentMap: {
        available: argumentMapAvailable,
        debates: argumentMapAvailable ? [{ id: 'debate-1' }] : [],
      },
      atlas: {
        available: atlasAvailable,
        nodes: atlasAvailable ? [{ id: 'node-1' }] : [],
      },
      report: {
        available: reportAvailable,
        questions: reportAvailable
          ? [{ id: 'q1', options: [], prompt: 'Prompt', responseCount: 1, tags: [], type: 'freeform' }]
          : [],
      },
      riskMatrix: {
        available: riskMatrixAvailable,
        comments: riskMatrixAvailable ? [{ id: 'comment-1' }] : [],
      },
    },
  });

const buildAnalysisPayload = () => ({
  inputSignature: 'analysis-input',
});

describe('surveyResultsHtmlReportModalDescriptor', () => {
  it('builds HTML report modal display descriptors without execution callbacks', () => {
    const snapshot = buildHtmlReportSnapshot({
      argumentMapAvailable: false,
      atlasAvailable: true,
      reportAvailable: true,
      riskMatrixAvailable: false,
    });
    const descriptor = buildSurveyResultsHtmlReportExportModalDescriptor({
      analysisGenerating: false,
      analysisPayload: buildAnalysisPayload(),
      analysisProgress: 42,
      exportFormat: null,
      htmlReportAnalysisError: 'Needs generated analysis.',
      isAuthorized: true,
      isDemoMode: 1,
      isDemoSession: 'demo',
      isOpen: 'yes',
      selectedSections: {
        argumentMap: true,
        atlas: true,
        report: true,
        snapshotJson: true,
      },
      snapshot,
    });

    expect(descriptor).toEqual(
      expect.objectContaining({
        analysisGenerating: false,
        analysisProgress: '42',
        canDownload: false,
        exportFormat: 'viewer',
        htmlReportAnalysisError: 'Needs generated analysis.',
        isAuthorized: true,
        isDemoMode: true,
        isDemoSession: true,
        isOpen: true,
        needsAnalysisGeneration: true,
        snapshot,
      }),
    );
    expect(descriptor.selectedSections).toEqual({
      ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
      argumentMap: true,
      atlas: true,
      report: true,
      snapshotJson: true,
    });
    expect(descriptor.sectionRows).toEqual([
      { available: true, key: 'report', label: 'Report', reason: 'Ready' },
      { available: false, key: 'argumentMap', label: 'Argument Map', reason: 'Needs analysis' },
      { available: false, key: 'riskMatrix', label: 'Risk Matrix', reason: 'Needs analysis' },
      { available: true, key: 'atlas', label: 'Atlas Nodes', reason: 'Ready' },
      { available: true, key: 'snapshotJson', label: 'Embedded Snapshot JSON', reason: 'Always available' },
    ]);
    expect(Object.keys(descriptor).some((key) => key.startsWith('on'))).toBe(false);
  });
});
