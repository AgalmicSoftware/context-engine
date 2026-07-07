import { buildSurveyResultsAnalysisLifecyclePlan } from './surveyResultsAnalysisLifecyclePlan';
import type {
  SessionResultsAnalysisSectionKey,
  SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport';

const allSections: SessionResultsAnalysisSectionKey[] = ['breakdown', 'argumentMap', 'riskMatrix', 'atlas'];

const createArtifact = (
  inputSignature = 'input-sig',
  availableSections: SessionResultsAnalysisSectionKey[] = allSections,
): SessionResultsGeneratedAnalysisArtifact => ({
  generatedAt: '2026-06-01T00:00:00.000Z',
  inputSignature,
  kind: 'ce_session_results_analysis_artifact',
  participants: [],
  sections: {
    argumentMap: { available: availableSections.includes('argumentMap'), debates: [] },
    atlas: { available: availableSections.includes('atlas'), edges: [], nodes: [] },
    breakdown: {
      available: availableSections.includes('breakdown'),
      dimensions: [],
      groups: [],
      summary: {},
    },
    riskMatrix: {
      available: availableSections.includes('riskMatrix'),
      categories: [],
      comments: [],
      heatmap: {},
      scenarioLinks: [],
    },
  },
  source: 'ai-generated',
  version: 1,
});

const retryableFailureRecovery = {
  canRetry: true,
  statePatch: {
    htmlReportAnalysisGenerating: false,
    htmlReportAnalysisError: 'Unable to generate analysis views right now. Check AI settings and try again.',
    htmlReportAnalysisProgress: '',
  },
  status: 'retryable',
};

describe('surveyResultsAnalysisLifecyclePlan', () => {
  it('uses a ready current artifact when it matches the requested input signature', () => {
    const artifact = createArtifact('current-input');

    expect(
      buildSurveyResultsAnalysisLifecyclePlan({
        allSections,
        currentArtifact: artifact,
        inputSignature: 'current-input',
        requestedSections: ['breakdown'],
      }),
    ).toEqual({
      artifact,
      blockedReason: '',
      failureRecovery: retryableFailureRecovery,
      missingSections: [],
      payloadDescriptor: {
        artifactInputSignature: 'current-input',
        artifactPresent: true,
        artifactSource: 'current',
        availableSections: allSections,
        inputSignature: 'current-input',
        missingSections: [],
        requestedSections: ['breakdown'],
        sectionsToGenerate: ['breakdown'],
      },
      sectionsToGenerate: ['breakdown'],
      shouldGenerate: false,
      statePatch: {
        htmlReportAnalysisArtifact: artifact,
        htmlReportAnalysisGenerating: false,
        htmlReportAnalysisError: '',
        htmlReportAnalysisInputSignature: 'current-input',
        htmlReportAnalysisProgress: '',
      },
      status: 'ready-artifact',
      target: {
        artifactInputSignature: 'current-input',
        inputSignature: 'current-input',
        source: 'current',
      },
    });
  });

  it('ignores stale current artifacts and plans generation against the current signature', () => {
    const staleArtifact = createArtifact('stale-input');

    expect(
      buildSurveyResultsAnalysisLifecyclePlan({
        allSections,
        currentArtifact: staleArtifact,
        inputSignature: 'fresh-input',
        requestedSections: ['breakdown', 'riskMatrix'],
      }),
    ).toEqual({
      artifact: null,
      blockedReason: '',
      failureRecovery: retryableFailureRecovery,
      missingSections: ['breakdown', 'riskMatrix'],
      payloadDescriptor: {
        artifactInputSignature: '',
        artifactPresent: false,
        artifactSource: 'none',
        availableSections: [],
        inputSignature: 'fresh-input',
        missingSections: ['breakdown', 'riskMatrix'],
        requestedSections: ['breakdown', 'riskMatrix'],
        sectionsToGenerate: ['breakdown', 'riskMatrix'],
      },
      sectionsToGenerate: ['breakdown', 'riskMatrix'],
      shouldGenerate: true,
      statePatch: {
        htmlReportAnalysisGenerating: true,
        htmlReportAnalysisError: '',
        htmlReportAnalysisInputSignature: 'fresh-input',
        htmlReportAnalysisProgress: '',
      },
      status: 'generate-missing-sections',
      target: {
        artifactInputSignature: '',
        inputSignature: 'fresh-input',
        source: 'none',
      },
    });
  });

  it('ignores stale cached artifacts and plans generation against the current signature', () => {
    const staleArtifact = createArtifact('stale-cache-input');

    expect(
      buildSurveyResultsAnalysisLifecyclePlan({
        allSections,
        cachedArtifact: staleArtifact,
        inputSignature: 'fresh-input',
        requestedSections: ['breakdown'],
      }),
    ).toEqual({
      artifact: null,
      blockedReason: '',
      failureRecovery: retryableFailureRecovery,
      missingSections: ['breakdown'],
      payloadDescriptor: {
        artifactInputSignature: '',
        artifactPresent: false,
        artifactSource: 'none',
        availableSections: [],
        inputSignature: 'fresh-input',
        missingSections: ['breakdown'],
        requestedSections: ['breakdown'],
        sectionsToGenerate: ['breakdown'],
      },
      sectionsToGenerate: ['breakdown'],
      shouldGenerate: true,
      statePatch: {
        htmlReportAnalysisGenerating: true,
        htmlReportAnalysisError: '',
        htmlReportAnalysisInputSignature: 'fresh-input',
        htmlReportAnalysisProgress: '',
      },
      status: 'generate-missing-sections',
      target: {
        artifactInputSignature: '',
        inputSignature: 'fresh-input',
        source: 'none',
      },
    });
  });

  it('expands an empty requested section list to all analysis sections', () => {
    const cachedArtifact = createArtifact('cached-input');

    const plan = buildSurveyResultsAnalysisLifecyclePlan({
      allSections,
      cachedArtifact,
      inputSignature: 'cached-input',
      requestedSections: [],
    });

    expect(plan.sectionsToGenerate).toEqual(allSections);
    expect(plan.missingSections).toEqual([]);
    expect(plan.shouldGenerate).toBe(false);
    expect(plan.status).toBe('ready-artifact');
    expect(plan.target).toEqual({
      artifactInputSignature: 'cached-input',
      inputSignature: 'cached-input',
      source: 'cache',
    });
    expect(plan.blockedReason).toBe('');
    expect(plan.failureRecovery).toEqual(retryableFailureRecovery);
    expect(plan.payloadDescriptor).toEqual({
      artifactInputSignature: 'cached-input',
      artifactPresent: true,
      artifactSource: 'cache',
      availableSections: allSections,
      inputSignature: 'cached-input',
      missingSections: [],
      requestedSections: [],
      sectionsToGenerate: allSections,
    });
  });

  it('keeps partial artifacts as the generation base and reports only missing sections', () => {
    const partialArtifact = createArtifact('partial-input', ['breakdown']);

    const plan = buildSurveyResultsAnalysisLifecyclePlan({
      allSections,
      cachedArtifact: partialArtifact,
      inputSignature: 'partial-input',
      requestedSections: ['breakdown', 'riskMatrix', 'atlas'],
    });

    expect(plan).toEqual({
      artifact: partialArtifact,
      blockedReason: '',
      failureRecovery: retryableFailureRecovery,
      missingSections: ['riskMatrix', 'atlas'],
      payloadDescriptor: {
        artifactInputSignature: 'partial-input',
        artifactPresent: true,
        artifactSource: 'cache',
        availableSections: ['breakdown'],
        inputSignature: 'partial-input',
        missingSections: ['riskMatrix', 'atlas'],
        requestedSections: ['breakdown', 'riskMatrix', 'atlas'],
        sectionsToGenerate: ['breakdown', 'riskMatrix', 'atlas'],
      },
      sectionsToGenerate: ['breakdown', 'riskMatrix', 'atlas'],
      shouldGenerate: true,
      statePatch: {
        htmlReportAnalysisGenerating: true,
        htmlReportAnalysisError: '',
        htmlReportAnalysisInputSignature: 'partial-input',
        htmlReportAnalysisProgress: '',
      },
      status: 'generate-missing-sections',
      target: {
        artifactInputSignature: 'partial-input',
        inputSignature: 'partial-input',
        source: 'cache',
      },
    });
  });

  it('exposes a blocked descriptor when no analysis sections are available to plan', () => {
    const plan = buildSurveyResultsAnalysisLifecyclePlan({
      allSections: [],
      inputSignature: 'empty-sections-input',
      requestedSections: [],
    });

    expect(plan.artifact).toBeNull();
    expect(plan.blockedReason).toBe('missing-analysis-sections');
    expect(plan.failureRecovery).toEqual(retryableFailureRecovery);
    expect(plan.missingSections).toEqual([]);
    expect(plan.payloadDescriptor).toEqual({
      artifactInputSignature: '',
      artifactPresent: false,
      artifactSource: 'none',
      availableSections: [],
      inputSignature: 'empty-sections-input',
      missingSections: [],
      requestedSections: [],
      sectionsToGenerate: [],
    });
    expect(plan.sectionsToGenerate).toEqual([]);
    expect(plan.shouldGenerate).toBe(false);
    expect(plan.statePatch).toEqual({
      htmlReportAnalysisGenerating: false,
      htmlReportAnalysisError: '',
      htmlReportAnalysisInputSignature: 'empty-sections-input',
      htmlReportAnalysisProgress: '',
    });
    expect(plan.status).toBe('blocked');
    expect(plan.target).toEqual({
      artifactInputSignature: '',
      inputSignature: 'empty-sections-input',
      source: 'none',
    });
  });
});
