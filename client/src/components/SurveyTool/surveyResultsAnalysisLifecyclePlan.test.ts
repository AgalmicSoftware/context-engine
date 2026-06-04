import {
  buildSurveyResultsAnalysisLifecyclePlan,
} from './surveyResultsAnalysisLifecyclePlan';
import type {
  SessionResultsAnalysisSectionKey,
  SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport';

const allSections: SessionResultsAnalysisSectionKey[] = [
  'breakdown',
  'argumentMap',
  'riskMatrix',
  'atlas',
];

const createArtifact = (
  inputSignature = 'input-sig',
  availableSections: SessionResultsAnalysisSectionKey[] = allSections
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

describe('surveyResultsAnalysisLifecyclePlan', () => {
  it('uses a ready current artifact when it matches the requested input signature', () => {
    const artifact = createArtifact('current-input');

    expect(buildSurveyResultsAnalysisLifecyclePlan({
      allSections,
      currentArtifact: artifact,
      inputSignature: 'current-input',
      requestedSections: ['breakdown'],
    })).toEqual({
      artifact,
      missingSections: [],
      sectionsToGenerate: ['breakdown'],
      shouldGenerate: false,
      statePatch: {
        htmlReportAnalysisArtifact: artifact,
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

    expect(buildSurveyResultsAnalysisLifecyclePlan({
      allSections,
      currentArtifact: staleArtifact,
      inputSignature: 'fresh-input',
      requestedSections: ['breakdown', 'riskMatrix'],
    })).toEqual({
      artifact: null,
      missingSections: ['breakdown', 'riskMatrix'],
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
      missingSections: ['riskMatrix', 'atlas'],
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
});
