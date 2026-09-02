import * as sessionResultsExport from '../../utilities/sessionResultsExport/sessionResultsAnalysisArtifacts';
import { surveyResultsAnalysisArtifactMergePort } from './surveyResultsAnalysisArtifactMergePort';

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

describe('surveyResultsAnalysisArtifactMergePort', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes generated artifact normalization and merge with unchanged arguments', () => {
    const normalizeGeneratedSessionResultsAnalysisArtifact = jest
      .spyOn(sessionResultsExport, 'normalizeGeneratedSessionResultsAnalysisArtifact')
      .mockReturnValue(createArtifact('normalized'));
    const mergeGeneratedSessionResultsAnalysisArtifacts = jest
      .spyOn(sessionResultsExport, 'mergeGeneratedSessionResultsAnalysisArtifacts')
      .mockReturnValue(createArtifact('merged'));
    const base = createArtifact('base');
    const next = createArtifact('next');

    expect(
      surveyResultsAnalysisArtifactMergePort.normalizeGeneratedArtifact({
        generatedAt: '2026-02-02T00:00:00.000Z',
        inputSignature: 'input-a',
        participants: [],
        rawOutput: { sections: { breakdown: { groups: [] } } },
      }).inputSignature,
    ).toBe('normalized');
    expect(
      surveyResultsAnalysisArtifactMergePort.mergeGeneratedArtifacts({
        base,
        next,
        sections: ['breakdown'],
      })?.inputSignature,
    ).toBe('merged');

    expect(normalizeGeneratedSessionResultsAnalysisArtifact).toHaveBeenCalledWith({
      generatedAt: '2026-02-02T00:00:00.000Z',
      inputSignature: 'input-a',
      participants: [],
      rawOutput: { sections: { breakdown: { groups: [] } } },
    });
    expect(mergeGeneratedSessionResultsAnalysisArtifacts).toHaveBeenCalledWith({
      base,
      next,
      sections: ['breakdown'],
    });
  });

  it('uses call-time runtime property lookup for normalize and merge helpers', () => {
    const normalizeGeneratedSessionResultsAnalysisArtifact = jest
      .spyOn(sessionResultsExport, 'normalizeGeneratedSessionResultsAnalysisArtifact')
      .mockReturnValueOnce(createArtifact('first-normalize'))
      .mockReturnValueOnce(createArtifact('second-normalize'));
    const mergeGeneratedSessionResultsAnalysisArtifacts = jest
      .spyOn(sessionResultsExport, 'mergeGeneratedSessionResultsAnalysisArtifacts')
      .mockReturnValueOnce(createArtifact('first-merge'))
      .mockReturnValueOnce(createArtifact('second-merge'));

    expect(
      surveyResultsAnalysisArtifactMergePort.normalizeGeneratedArtifact({ inputSignature: 'one' }).inputSignature,
    ).toBe('first-normalize');
    expect(
      surveyResultsAnalysisArtifactMergePort.mergeGeneratedArtifacts({ sections: ['riskMatrix'] })?.inputSignature,
    ).toBe('first-merge');
    expect(
      surveyResultsAnalysisArtifactMergePort.normalizeGeneratedArtifact({ inputSignature: 'two' }).inputSignature,
    ).toBe('second-normalize');
    expect(surveyResultsAnalysisArtifactMergePort.mergeGeneratedArtifacts({ sections: ['atlas'] })?.inputSignature).toBe(
      'second-merge',
    );
    expect(normalizeGeneratedSessionResultsAnalysisArtifact).toHaveBeenNthCalledWith(1, {
      inputSignature: 'one',
    });
    expect(normalizeGeneratedSessionResultsAnalysisArtifact).toHaveBeenNthCalledWith(2, {
      inputSignature: 'two',
    });
    expect(mergeGeneratedSessionResultsAnalysisArtifacts).toHaveBeenNthCalledWith(1, {
      sections: ['riskMatrix'],
    });
    expect(mergeGeneratedSessionResultsAnalysisArtifacts).toHaveBeenNthCalledWith(2, { sections: ['atlas'] });
  });
});
