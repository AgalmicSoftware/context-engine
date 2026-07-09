import {
  buildRedactedSessionResultsSnapshot,
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
} from '../../utilities/sessionResultsExport';
import { buildSurveyResultsHtmlReportModalProps } from './surveyResultsHtmlReportModalProps';

const styleMap = {
  htmlReportModal: 'htmlReportModal',
};

const buildSnapshot = () =>
  buildRedactedSessionResultsSnapshot({
    exportedAt: '2026-06-08T12:00:00.000Z',
    session: {
      chainId: 11155420,
      name: 'Report Session',
      slug: 'report-session',
    },
    sections: {
      argumentMap: {
        available: false,
        debates: [],
      },
      atlas: {
        available: true,
        nodes: [{ id: 'node-1' }],
      },
      report: {
        available: true,
        questions: [
          {
            id: 'q1',
            options: [],
            prompt: 'Question one',
            responseCount: 2,
            tags: [],
            type: 'freeform',
          },
        ],
      },
      riskMatrix: {
        available: false,
        comments: [],
      },
    },
  });

describe('buildSurveyResultsHtmlReportModalProps', () => {
  it('combines modal display descriptors with named execution props without invoking them', () => {
    const onClose = jest.fn();
    const onDownload = jest.fn();
    const onFormatChange = jest.fn();
    const onGenerateAnalysis = jest.fn();
    const onToggleDemoMode = jest.fn();
    const onToggleSection = jest.fn();

    const props = buildSurveyResultsHtmlReportModalProps({
      analysisGenerating: false,
      analysisPayload: {
        eligibility: {
          counts: {
            participants: 2,
            questions: 1,
            responses: 2,
          },
          eligible: true,
          reasons: [],
        },
      },
      analysisProgress: 42,
      exportFormat: SESSION_RESULTS_EXPORT_FORMAT_PDF,
      htmlReportAnalysisError: 'Needs generated analysis.',
      isAuthorized: true,
      isDemoMode: 1,
      isDemoSession: 'demo',
      isOpen: 'yes',
      onClose,
      onDownload,
      onFormatChange,
      onGenerateAnalysis,
      onToggleDemoMode,
      onToggleSection,
      selectedSections: {
        argumentMap: true,
        atlas: true,
        report: true,
        snapshotJson: true,
      },
      snapshot: buildSnapshot(),
      styleMap,
    });

    expect(props).toEqual(
      expect.objectContaining({
        analysisGenerating: false,
        analysisProgress: '42',
        canDownload: false,
        exportFormat: SESSION_RESULTS_EXPORT_FORMAT_PDF,
        htmlReportAnalysisError: 'Needs generated analysis.',
        isAuthorized: true,
        isDemoMode: true,
        isDemoSession: true,
        isOpen: true,
        needsAnalysisGeneration: true,
        styleMap,
      }),
    );
    expect(props.sectionRows).toEqual([
      { available: true, key: 'report', label: 'Report', reason: 'Ready' },
      { available: false, key: 'argumentMap', label: 'Argument Map', reason: 'Needs analysis' },
      { available: false, key: 'riskMatrix', label: 'Risk Matrix', reason: 'Needs analysis' },
      { available: true, key: 'atlas', label: 'Atlas Nodes', reason: 'Ready' },
      { available: true, key: 'snapshotJson', label: 'Embedded Snapshot JSON', reason: 'Always available' },
    ]);
    expect(props.selectedSections).toEqual({
      argumentMap: true,
      atlas: true,
      report: true,
      riskMatrix: false,
      snapshotJson: true,
    });
    expect(props.onClose).toBe(onClose);
    expect(props.onDownload).toBe(onDownload);
    expect(props.onFormatChange).toBe(onFormatChange);
    expect(props.onGenerateAnalysis).toBe(onGenerateAnalysis);
    expect(props.onToggleDemoMode).toBe(onToggleDemoMode);
    expect(props.onToggleSection).toBe(onToggleSection);
    expect(onClose).not.toHaveBeenCalled();
    expect(onDownload).not.toHaveBeenCalled();
    expect(onFormatChange).not.toHaveBeenCalled();
    expect(onGenerateAnalysis).not.toHaveBeenCalled();
    expect(onToggleDemoMode).not.toHaveBeenCalled();
    expect(onToggleSection).not.toHaveBeenCalled();
  });
});
