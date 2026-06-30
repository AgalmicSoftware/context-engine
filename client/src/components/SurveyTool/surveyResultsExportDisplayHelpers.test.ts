import {
  SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
  buildSurveyResultsDemoAnalysisArtifact,
  buildSurveyResultsHtmlReportAnalysisDemoReadyPatch,
  buildSurveyResultsHtmlReportAnalysisEligibilityBlockedPatch,
  buildSurveyResultsHtmlReportAnalysisErrorPatch,
  buildSurveyResultsHtmlReportAnalysisProgressPatch,
  buildSurveyResultsHtmlReportDownloadAttemptPlan,
  buildSurveyResultsHtmlReportDownloadFailurePatch,
  buildSurveyResultsHtmlReportDownloadSuccessPatch,
  buildSurveyResultsHtmlReportDemoModePatch,
  buildSurveyResultsHtmlReportExportModalDescriptor,
  buildSurveyResultsHtmlReportFormatPatch,
  buildSurveyResultsHtmlReportModalClosePatch,
  buildSurveyResultsHtmlReportModalOpenPatch,
  buildSurveyResultsHtmlReportReadinessPlan,
  buildSurveyResultsHtmlReportSectionTogglePatch,
} from './surveyResultsExportDisplayHelpers.js';
import {
  buildRedactedSessionResultsSnapshot,
} from '../../utilities/sessionResultsExport';
import type {
  SessionResultsAnalysisPayloadBuildResult,
} from '../../utilities/sessionResultsExport';

const buildAnalysisPayload = ({
  questions = [
    { id: 'q1', prompt: 'First prompt', type: 'freeform', options: [], tags: [] },
    { id: 'q2', prompt: 'Second prompt', type: 'binary', options: ['Yes', 'No'], tags: ['tag'] },
  ],
  responses = [
    { answer: 'A', participantId: 'p1', questionId: 'q1' },
    { answer: 'B', participantId: 'p2', questionId: 'q1' },
    { answer: 'Yes', participantId: 'p1', questionId: 'q2' },
  ],
}: Partial<SessionResultsAnalysisPayloadBuildResult['aiPayload']> = {}): SessionResultsAnalysisPayloadBuildResult => ({
  aiPayload: {
    counts: {
      participants: 2,
      questions: questions.length,
      responses: responses.length,
    },
    inputLimits: {
      maxOptionsPerQuestion: 12,
      maxQuestionPromptChars: 900,
      maxQuestions: 80,
      maxResponseAdditionalChars: 900,
      maxResponseAnswerChars: 1400,
      maxResponses: 420,
      maxSegmentDimensions: 12,
      maxSegmentValuesPerDimension: 60,
      maxTagsPerQuestion: 16,
    },
    questions,
    responses,
    segmentDimensions: [],
    session: {
      name: 'Demo session',
      slug: 'demo',
    },
  },
  participants: [
    { displayAddress: '0x111...1111', syntheticId: 'p1' },
    { displayAddress: '0x222...2222', syntheticId: 'p2' },
  ],
});

const buildHtmlReportSnapshot = ({
  argumentMapAvailable = false,
  atlasAvailable = false,
  reportAvailable = true,
  riskMatrixAvailable = false,
} = {}) => buildRedactedSessionResultsSnapshot({
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

describe('surveyResultsExportDisplayHelpers', () => {
  it('builds HTML report modal and analysis state patches', () => {
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

    expect(buildSurveyResultsHtmlReportModalOpenPatch('2026-05-25T18:30:00.000Z')).toEqual({
      htmlReportModalOpen: true,
      htmlReportExportedAt: '2026-05-25T18:30:00.000Z',
      htmlReportAnalysisError: '',
      alertMessage: '',
    });
    expect(buildSurveyResultsHtmlReportModalClosePatch()).toEqual({
      htmlReportModalOpen: false,
    });
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
    expect(buildSurveyResultsHtmlReportReadinessPlan({
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
    })).toMatchObject({
      canDownload: false,
      hasExportableSections: true,
      hasUnavailableSelectedSections: false,
      needsAnalysisGeneration: false,
    });
  });

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

    expect(descriptor).toEqual(expect.objectContaining({
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
    }));
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

  it('describes HTML report download blocked states without applying parent state', () => {
    expect(buildSurveyResultsHtmlReportDownloadAttemptPlan({
      isAuthorized: false,
      readinessPlan: {
        hasExportableSections: true,
        hasUnavailableSelectedSections: false,
      },
    })).toEqual({
      blockedReason: 'not-authorized',
      statePatch: {
        alertMessage: 'Connect a wallet with permission to view these results before export.',
      },
      status: 'blocked',
    });

    expect(buildSurveyResultsHtmlReportDownloadAttemptPlan({
      isAuthorized: true,
      readinessPlan: {
        hasExportableSections: false,
        hasUnavailableSelectedSections: false,
      },
    })).toEqual({
      blockedReason: 'no-exportable-sections',
      statePatch: {
        alertMessage: 'Select at least one available report section before export.',
      },
      status: 'blocked',
    });

    expect(buildSurveyResultsHtmlReportDownloadAttemptPlan({
      analysisGenerating: true,
      isAuthorized: true,
      readinessPlan: {
        hasExportableSections: true,
        hasUnavailableSelectedSections: false,
      },
    })).toEqual({
      blockedReason: 'analysis-generating',
      statePatch: {
        alertMessage: 'Wait for analysis generation to finish before downloading the report.',
      },
      status: 'blocked',
    });

    expect(buildSurveyResultsHtmlReportDownloadAttemptPlan({
      isAuthorized: true,
      readinessPlan: {
        hasExportableSections: true,
        hasUnavailableSelectedSections: true,
      },
    })).toEqual({
      blockedReason: 'unavailable-selected-sections',
      statePatch: {
        alertMessage: 'Generate selected analysis views before downloading the report.',
      },
      status: 'blocked',
    });
  });

  it('describes HTML report download ready and settlement patches', () => {
    expect(buildSurveyResultsHtmlReportDownloadAttemptPlan({
      isAuthorized: true,
      readinessPlan: {
        hasExportableSections: true,
        hasUnavailableSelectedSections: false,
      },
    })).toEqual({
      blockedReason: '',
      statePatch: null,
      status: 'ready',
    });
    expect(buildSurveyResultsHtmlReportDownloadSuccessPatch()).toEqual({
      alertMessage: '',
      htmlReportModalOpen: false,
    });
    expect(buildSurveyResultsHtmlReportDownloadFailurePatch()).toEqual({
      alertMessage: 'Unable to export the HTML report.',
    });
  });

  it('builds a demo analysis artifact from passed-in payload data without download side effects', () => {
    const artifact = buildSurveyResultsDemoAnalysisArtifact({
      analysisPayload: buildAnalysisPayload(),
      generatedAt: '2026-06-04T00:00:00.000Z',
      inputSignature: 'payload-signature',
    });

    expect(artifact).toMatchObject({
      generatedAt: '2026-06-04T00:00:00.000Z',
      inputSignature: 'demo-preview-payload-signature',
      kind: 'ce_session_results_analysis_artifact',
      model: 'demo-preview',
      source: 'ai-generated',
      version: 1,
    });
    expect(artifact.participants).toHaveLength(2);
    expect(artifact.sections.breakdown.groups).toEqual([
      expect.objectContaining({ id: 'demo_group_1', questionIds: ['q1'], responseCount: 2 }),
      expect.objectContaining({ id: 'demo_group_2', questionIds: ['q2'], responseCount: 1 }),
    ]);
    expect(artifact.sections.atlas.nodes).toHaveLength(2);
    expect(artifact.sections.riskMatrix.heatmap).toMatchObject({
      demo_risk_1: { impact: 'medium', likelihood: 'medium' },
      demo_risk_2: { impact: 'high', likelihood: 'low' },
    });
  });

  it('uses the fallback demo question when payload questions are empty', () => {
    const artifact = buildSurveyResultsDemoAnalysisArtifact({
      analysisPayload: buildAnalysisPayload({ questions: [], responses: [] }),
      generatedAt: '2026-06-04T00:00:00.000Z',
      inputSignature: 'empty-payload',
    });

    expect(artifact.sections.breakdown.groups).toEqual([
      expect.objectContaining({
        id: 'demo_group_1',
        label: 'Demo results',
        questionIds: ['demo-results'],
        responseCount: 0,
      }),
    ]);
    expect(artifact.sections.argumentMap.debates[0]).toMatchObject({
      id: 'demo_debate_1',
      title: 'Demo results',
    });
  });
});
