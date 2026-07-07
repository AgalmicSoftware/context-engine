import {
  bindSurveyResultsAnalysisArtifactMergePort,
  type SurveyResultsAnalysisArtifactMergeRuntime,
} from './surveyResultsAnalysisArtifactMergePort';

const createArtifact = (inputSignature: string) => ({
  generatedAt: '2026-01-01T00:00:00.000Z',
  inputSignature,
  kind: 'ce_session_results_analysis_artifact' as const,
  participants: [],
  sections: {
    argumentMap: { available: false, debates: [], reason: 'none' },
    atlas: { available: false, edges: [], nodes: [], reason: 'none' },
    breakdown: { available: false, dimensions: [], groups: [], reason: 'none', summary: {} },
    riskMatrix: {
      available: false,
      categories: [],
      comments: [],
      heatmap: {},
      reason: 'none',
      scenarioLinks: [],
    },
  },
  source: 'ai-generated' as const,
  version: 1 as const,
});

const createRuntime = (): SurveyResultsAnalysisArtifactMergeRuntime => ({
  mergeGeneratedSessionResultsAnalysisArtifacts: jest.fn(() => createArtifact('merged')),
  normalizeGeneratedSessionResultsAnalysisArtifact: jest.fn(() => createArtifact('normalized')),
});

describe('surveyResultsAnalysisArtifactMergePort', () => {
  it('routes generated artifact normalization and merge with unchanged arguments', () => {
    const runtime = createRuntime();
    const port = bindSurveyResultsAnalysisArtifactMergePort({
      runtime: () => runtime,
    });
    const base = createArtifact('base');
    const next = createArtifact('next');

    expect(
      port.normalizeGeneratedArtifact({
        generatedAt: '2026-02-02T00:00:00.000Z',
        inputSignature: 'input-a',
        participants: [],
        rawOutput: { sections: { breakdown: { groups: [] } } },
      }).inputSignature,
    ).toBe('normalized');
    expect(
      port.mergeGeneratedArtifacts({
        base,
        next,
        sections: ['breakdown'],
      })?.inputSignature,
    ).toBe('merged');

    expect(runtime.normalizeGeneratedSessionResultsAnalysisArtifact).toHaveBeenCalledWith({
      generatedAt: '2026-02-02T00:00:00.000Z',
      inputSignature: 'input-a',
      participants: [],
      rawOutput: { sections: { breakdown: { groups: [] } } },
    });
    expect(runtime.mergeGeneratedSessionResultsAnalysisArtifacts).toHaveBeenCalledWith({
      base,
      next,
      sections: ['breakdown'],
    });
  });

  it('uses call-time runtime lookup for normalize and merge helpers', () => {
    const firstRuntime = createRuntime();
    const secondRuntime = createRuntime();
    (firstRuntime.normalizeGeneratedSessionResultsAnalysisArtifact as jest.Mock).mockReturnValue(
      createArtifact('first-normalize'),
    );
    (secondRuntime.normalizeGeneratedSessionResultsAnalysisArtifact as jest.Mock).mockReturnValue(
      createArtifact('second-normalize'),
    );
    (firstRuntime.mergeGeneratedSessionResultsAnalysisArtifacts as jest.Mock).mockReturnValue(
      createArtifact('first-merge'),
    );
    (secondRuntime.mergeGeneratedSessionResultsAnalysisArtifacts as jest.Mock).mockReturnValue(
      createArtifact('second-merge'),
    );
    let currentRuntime = firstRuntime;
    const port = bindSurveyResultsAnalysisArtifactMergePort({
      runtime: () => currentRuntime,
    });

    expect(port.normalizeGeneratedArtifact({ inputSignature: 'one' }).inputSignature).toBe('first-normalize');
    expect(port.mergeGeneratedArtifacts({ sections: ['riskMatrix'] })?.inputSignature).toBe('first-merge');

    currentRuntime = secondRuntime;

    expect(port.normalizeGeneratedArtifact({ inputSignature: 'two' }).inputSignature).toBe('second-normalize');
    expect(port.mergeGeneratedArtifacts({ sections: ['atlas'] })?.inputSignature).toBe('second-merge');
    expect(firstRuntime.normalizeGeneratedSessionResultsAnalysisArtifact).toHaveBeenCalledWith({
      inputSignature: 'one',
    });
    expect(secondRuntime.normalizeGeneratedSessionResultsAnalysisArtifact).toHaveBeenCalledWith({
      inputSignature: 'two',
    });
    expect(firstRuntime.mergeGeneratedSessionResultsAnalysisArtifacts).toHaveBeenCalledWith({
      sections: ['riskMatrix'],
    });
    expect(secondRuntime.mergeGeneratedSessionResultsAnalysisArtifacts).toHaveBeenCalledWith({ sections: ['atlas'] });
  });
});
