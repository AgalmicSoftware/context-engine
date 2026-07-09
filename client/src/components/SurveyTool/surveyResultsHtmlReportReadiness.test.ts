import { buildSurveyResultsHtmlReportReadinessPlan } from './surveyResultsHtmlReportReadiness';
import { SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS } from './surveyResultsHtmlReportSelection';
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

describe('surveyResultsHtmlReportReadiness', () => {
  it('builds an HTML report readiness plan from snapshot and selected-section identity', () => {
    const plan = buildSurveyResultsHtmlReportReadinessPlan({
      isAuthorized: true,
      selectedSections: {
        argumentMap: true,
        atlas: false,
        report: true,
        riskMatrix: false,
        snapshotJson: false,
      },
      snapshot: buildHtmlReportSnapshot(),
    });

    expect(plan.selectedSections).toEqual({
      ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
      argumentMap: true,
      atlas: false,
      report: true,
      riskMatrix: false,
      snapshotJson: false,
    });
    expect(plan.availability).toEqual({
      argumentMap: false,
      atlas: false,
      report: true,
      riskMatrix: false,
      snapshotJson: true,
    });
    expect(plan.sectionRows).toEqual([
      { available: true, key: 'report', label: 'Report', reason: 'Ready' },
      { available: false, key: 'argumentMap', label: 'Argument Map', reason: 'Needs analysis' },
      { available: false, key: 'riskMatrix', label: 'Risk Matrix', reason: 'Needs analysis' },
      { available: false, key: 'atlas', label: 'Atlas Nodes', reason: 'Needs analysis' },
      { available: true, key: 'snapshotJson', label: 'Embedded Snapshot JSON', reason: 'Always available' },
    ]);
    expect(plan).toMatchObject({
      canDownload: false,
      hasExportableSections: true,
      hasUnavailableSelectedSections: true,
      needsAnalysisGeneration: true,
    });
  });

  it('keeps snapshot JSON fallback exportable without selecting unavailable report content', () => {
    const plan = buildSurveyResultsHtmlReportReadinessPlan({
      isAuthorized: true,
      selectedSections: {
        report: false,
      },
      snapshot: buildHtmlReportSnapshot({ reportAvailable: false }),
    });

    expect(plan.selectedSections).toEqual({
      ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
      report: false,
    });
    expect(plan.sectionRows[0]).toEqual({
      available: false,
      key: 'report',
      label: 'Report',
      reason: 'No hydrated results',
    });
    expect(plan).toMatchObject({
      canDownload: true,
      hasExportableSections: true,
      hasUnavailableSelectedSections: false,
      needsAnalysisGeneration: false,
    });
  });

  it('blocks ready report downloads while analysis generation is pending', () => {
    expect(
      buildSurveyResultsHtmlReportReadinessPlan({
        analysisGenerating: true,
        isAuthorized: true,
        selectedSections: {
          argumentMap: true,
          atlas: true,
          report: true,
          riskMatrix: true,
          snapshotJson: true,
        },
        snapshot: buildHtmlReportSnapshot({
          argumentMapAvailable: true,
          atlasAvailable: true,
          reportAvailable: true,
          riskMatrixAvailable: true,
        }),
      }),
    ).toMatchObject({
      canDownload: false,
      hasExportableSections: true,
      hasUnavailableSelectedSections: false,
      needsAnalysisGeneration: false,
    });
  });
});
