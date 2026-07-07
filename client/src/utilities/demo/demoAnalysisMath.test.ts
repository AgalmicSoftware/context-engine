import demoAnalysisData from '../../variables/demo/demo_analysis_data.json';
import historicalFigureDemographics from '../../variables/demo/historical_figure_demographics.js';
import buildDemoAnalysisData from './demoAnalysisAdapter.js';
import { findMostDivergentPairs } from './demoAnalysisMath.js';

describe('demoAnalysisMath', () => {
  it('keeps perfectly divergent suggestion candidates above weaker splits', () => {
    const results = findMostDivergentPairs({
      demographics: {
        Era: [
          { value: 'Modern', count: 20 },
          { value: 'Industrial', count: 20 },
          { value: 'Ancient', count: 20 },
        ],
      },
      questions: [
        { id: 'q1', text: 'Perfect split question' },
        { id: 'q2', text: 'Moderate split question' },
      ],
      segmentCounts: {
        q1: {
          'Era:Modern': 20,
          'Era:Industrial': 20,
        },
        q2: {
          'Era:Modern': 20,
          'Era:Ancient': 20,
        },
      },
      flatResponses: [
        { questionId: 'q1', responseText: 'Agree', segmentKey: 'Era:Modern', rate: 1 },
        { questionId: 'q1', responseText: 'Agree', segmentKey: 'Era:Industrial', rate: 0 },
        { questionId: 'q2', responseText: 'Agree', segmentKey: 'Era:Modern', rate: 0.65 },
        { questionId: 'q2', responseText: 'Agree', segmentKey: 'Era:Ancient', rate: 0.35 },
      ],
      topN: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(
      expect.objectContaining({
        pair: ['Era:Modern', 'Era:Industrial'],
        questionId: 'q1',
      }),
    );
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('limits filtered suggestions to pairs fully inside the active selection', () => {
    const results = findMostDivergentPairs({
      demographics: {
        Era: [
          { value: 'Modern', count: 20 },
          { value: 'Industrial', count: 20 },
        ],
        Country: [{ value: 'United States', count: 20 }],
      },
      questions: [
        { id: 'q1', text: 'Outside-pair question' },
        { id: 'q2', text: 'Inside-pair question' },
      ],
      segmentCounts: {
        q1: {
          'Era:Modern': 20,
          'Country:United States': 20,
        },
        q2: {
          'Era:Modern': 20,
          'Era:Industrial': 20,
        },
      },
      flatResponses: [
        { questionId: 'q1', responseText: 'Agree', segmentKey: 'Era:Modern', rate: 1 },
        { questionId: 'q1', responseText: 'Agree', segmentKey: 'Country:United States', rate: 0 },
        { questionId: 'q2', responseText: 'Agree', segmentKey: 'Era:Modern', rate: 0.8 },
        { questionId: 'q2', responseText: 'Agree', segmentKey: 'Era:Industrial', rate: 0.2 },
      ],
      allowedSegmentKeys: ['Era:Modern', 'Era:Industrial'],
      topN: 5,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(
      expect.objectContaining({
        pair: ['Era:Modern', 'Era:Industrial'],
        questionId: 'q2',
      }),
    );
  });

  it('keeps single-segment filters usable by returning pairs that include that segment', () => {
    const results = findMostDivergentPairs({
      demographics: {
        Era: [
          { value: 'Modern', count: 20 },
          { value: 'Industrial', count: 20 },
        ],
        Country: [{ value: 'United States', count: 20 }],
      },
      questions: [
        { id: 'q1', text: 'Selected-segment question' },
        { id: 'q2', text: 'Outside-pair question' },
      ],
      segmentCounts: {
        q1: {
          'Era:Modern': 20,
          'Country:United States': 20,
        },
        q2: {
          'Era:Industrial': 20,
          'Country:United States': 20,
        },
      },
      flatResponses: [
        { questionId: 'q1', responseText: 'Agree', segmentKey: 'Era:Modern', rate: 0.8 },
        { questionId: 'q1', responseText: 'Agree', segmentKey: 'Country:United States', rate: 0.2 },
        { questionId: 'q2', responseText: 'Agree', segmentKey: 'Era:Industrial', rate: 1 },
        { questionId: 'q2', responseText: 'Agree', segmentKey: 'Country:United States', rate: 0 },
      ],
      allowedSegmentKeys: ['Era:Modern'],
      topN: 5,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(
      expect.objectContaining({
        pair: ['Era:Modern', 'Country:United States'],
        questionId: 'q1',
      }),
    );
  });

  it('keeps the generated demo analysis fixture rich enough to populate the default suggestions list', () => {
    const analysisData = buildDemoAnalysisData(demoAnalysisData, historicalFigureDemographics);
    const results = findMostDivergentPairs({
      demographics: analysisData.demographics,
      flatResponses: analysisData.flatResponses,
      segmentCounts: analysisData.segmentCounts,
      questions: analysisData.questions,
      topN: 6,
    });

    expect(results).toHaveLength(6);
    expect(results.every((result) => String(result.questionText || '').trim().length > 0)).toBe(true);
    expect(new Set(results.map((result) => `${result.pair.join('::')}::${result.questionId}`)).size).toBe(
      results.length,
    );
  });
});
