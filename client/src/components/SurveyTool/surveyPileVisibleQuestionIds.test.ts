import { buildPileVisibleQuestionIds } from './surveyPileVisibleQuestionIds.js';

const normalizeQuestionIdKey = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

describe('surveyPileVisibleQuestionIds', () => {
  it('builds the visible pile id window around the active question', () => {
    expect(
      buildPileVisibleQuestionIds({
        activePileIndex: 3,
        normalizeQuestionIdKey,
        pileQuestions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }, { id: 'q6' }],
      }),
    ).toEqual(['q2', 'q3', 'q4', 'q5', 'q6']);
  });

  it('normalizes and dedupes ids after applying the visible window', () => {
    expect(
      buildPileVisibleQuestionIds({
        activePileIndex: 1,
        normalizeQuestionIdKey,
        pileQuestions: [{ id: ' Q1 ' }, { id: 'q1' }, { id: '' }, { id: 'Q2' }],
      }),
    ).toEqual(['q1', 'q2']);
  });

  it('returns an empty signature scope for non-list pile state', () => {
    expect(
      buildPileVisibleQuestionIds({
        normalizeQuestionIdKey,
        pileQuestions: null,
      }),
    ).toEqual([]);
  });
});
