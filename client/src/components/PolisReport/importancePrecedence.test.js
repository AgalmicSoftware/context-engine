import { applyFilterStateToAggregator } from './polisReportRuntime';
import { buildSurveyResultsResponsesCsvExport } from '../SurveyTool/surveyResultsExportPlans';

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  peekCacheSync: jest.fn(() => ({})),
}));

const row = (responder, questionID, importance, conviction) => ({
  responder,
  response: JSON.stringify({ questionID, answer: { value: 5 }, importance, conviction, timestamp: 1700000000000 }),
});

describe('importance is read before conviction', () => {
  it('ranks Polis "Top N by importance" by importance', () => {
    const out = applyFilterStateToAggregator(
      {
        highImportance: [row('0x1111111111111111111111111111111111111111', 'highImportance', 9, 1)],
        highConviction: [row('0x2222222222222222222222222222222222222222', 'highConviction', 1, 9)],
      },
      { id: 84532 },
      { topQuestions: { count: 1, by: 'importance' } },
      '',
    );
    expect(Object.keys(out)).toEqual(['highImportance']);
  });

  it('fills the CSV importance column from importance', () => {
    const csv = buildSurveyResultsResponsesCsvExport({
      aggregatorQuestionResponses: { q1: [row('0x1111111111111111111111111111111111111111', 'q1', 7, 2)] },
      networkQuestions: { q1: { id: 'q1', prompt: 'Prompt', type: 'rating' } },
    });
    const [header, first] = csv.split('\n');
    const importanceIndex = header.split(',').indexOf('importance');
    expect(first.split(',')[importanceIndex]).toBe('"7"');
  });
});
