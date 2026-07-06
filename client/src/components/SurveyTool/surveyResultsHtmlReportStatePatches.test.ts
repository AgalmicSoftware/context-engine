import {
  buildSurveyResultsHtmlReportAnalysisDemoReadyPatch,
  buildSurveyResultsHtmlReportAnalysisEligibilityBlockedPatch,
  buildSurveyResultsHtmlReportAnalysisErrorPatch,
  buildSurveyResultsHtmlReportAnalysisProgressPatch,
  buildSurveyResultsHtmlReportDemoModePatch,
  buildSurveyResultsHtmlReportFormatPatch,
  buildSurveyResultsHtmlReportModalClosePatch,
  buildSurveyResultsHtmlReportModalOpenPatch,
  buildSurveyResultsHtmlReportSectionTogglePatch,
} from './surveyResultsHtmlReportStatePatches';
import {
  SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
} from './surveyResultsHtmlReportSelection';

describe('surveyResultsHtmlReportStatePatches', () => {
  it('builds modal open and close state patches without side effects', () => {
    expect(buildSurveyResultsHtmlReportModalOpenPatch('2026-05-25T18:30:00.000Z')).toEqual({
      htmlReportModalOpen: true,
      htmlReportExportedAt: '2026-05-25T18:30:00.000Z',
      htmlReportAnalysisError: '',
      alertMessage: '',
    });
    expect(buildSurveyResultsHtmlReportModalClosePatch()).toEqual({
      htmlReportModalOpen: false,
    });
  });

  it('builds section toggle patches from normalized selected sections', () => {
    expect(buildSurveyResultsHtmlReportSectionTogglePatch({
      currentSections: {
        report: true,
        snapshotJson: true,
      },
      sectionKey: 'report',
    })).toEqual({
      htmlReportSelectedSections: {
        ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
        report: false,
        snapshotJson: true,
      },
    });
    expect(buildSurveyResultsHtmlReportSectionTogglePatch({
      currentSections: {
        report: false,
        snapshotJson: true,
      },
      sectionKey: 'not-a-section',
    })).toEqual({
      htmlReportSelectedSections: {
        ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
        report: false,
        snapshotJson: true,
      },
    });
  });

  it('builds demo mode and analysis state patches', () => {
    const demoArtifact = {
      kind: 'session-results-analysis',
      model: 'demo-preview',
      version: 1,
      generatedAt: '2026-05-25T18:30:00.000Z',
      inputSignature: 'demo-input',
      sections: {
        argumentMap: { available: true },
        atlas: { available: true },
        breakdown: { available: true },
        riskMatrix: { available: true },
      },
    } as any;
    const liveArtifact = {
      ...demoArtifact,
      model: 'live-analysis',
      inputSignature: 'live-input',
    };

    expect(buildSurveyResultsHtmlReportDemoModePatch({
      currentArtifact: liveArtifact,
      demoArtifact,
      nextDemoMode: true,
    })).toEqual({
      htmlReportDemoMode: true,
      htmlReportAnalysisArtifact: demoArtifact,
      htmlReportAnalysisError: '',
      htmlReportSelectedSections: {
        argumentMap: true,
        atlas: true,
        report: true,
        riskMatrix: true,
        snapshotJson: true,
      },
    });
    expect(buildSurveyResultsHtmlReportDemoModePatch({
      currentArtifact: demoArtifact,
      nextDemoMode: false,
    })).toEqual({
      htmlReportDemoMode: false,
      htmlReportAnalysisArtifact: null,
      htmlReportAnalysisError: '',
      htmlReportSelectedSections: { ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS },
    });
    expect(buildSurveyResultsHtmlReportFormatPatch('pdf-report')).toEqual({
      htmlReportExportFormat: 'pdf-report',
    });
    expect(buildSurveyResultsHtmlReportAnalysisDemoReadyPatch(demoArtifact)).toEqual({
      htmlReportAnalysisArtifact: demoArtifact,
      htmlReportAnalysisError: '',
    });
    expect(buildSurveyResultsHtmlReportAnalysisErrorPatch('Connect first.')).toEqual({
      htmlReportAnalysisError: 'Connect first.',
    });
    expect(buildSurveyResultsHtmlReportAnalysisEligibilityBlockedPatch({
      inputSignature: 'blocked-input',
      reason: 'Need at least one response.',
    })).toEqual({
      htmlReportAnalysisError: 'Need at least one response.',
      htmlReportAnalysisInputSignature: 'blocked-input',
    });
    expect(buildSurveyResultsHtmlReportAnalysisProgressPatch('Generating Breakdown (1/2)')).toEqual({
      htmlReportAnalysisProgress: 'Generating Breakdown (1/2)',
    });
  });
});
