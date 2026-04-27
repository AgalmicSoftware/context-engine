import { buildDraftHydrationState } from './surveyToolHydrationFlow.js';

describe('surveyToolHydrationFlow', () => {
  it('builds draft hydration state for live and baseline slices', () => {
    const cloneBaseline = jest.fn((baseline) => JSON.parse(JSON.stringify(baseline)));
    const applyDraftEntryToSlice = jest.fn(({ targetSlice, questionId, draftEntry }) => {
      targetSlice.answers[questionId] = { value: draftEntry.value };
      targetSlice.additionalComments[questionId] = { value: `${draftEntry.value}-notes` };
      targetSlice.importance[questionId] = draftEntry.importance;
      targetSlice.conviction[questionId] = draftEntry.conviction;
      return true;
    });

    expect(buildDraftHydrationState({
      renderedQuestionIds: ['Q1', 'q2'],
      draft: {
        answers: {
          q1: { value: 'answer-1', importance: 4, conviction: 7 },
        },
        baseline: {
          q2: { value: 'baseline-2', importance: 2, conviction: 3 },
        },
      },
      prevSlice: {
        answers: { q0: { value: 'keep' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      prevBaseline: {
        answers: { q9: { value: 'baseline-keep' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      allowOverwrite: true,
      cloneBaseline,
      applyDraftEntryToSlice,
    })).toEqual({
      nextSlice: {
        answers: {
          q0: { value: 'keep' },
          q1: { value: 'answer-1' },
        },
        importance: { q1: 4 },
        conviction: { q1: 7 },
        additionalComments: { q1: { value: 'answer-1-notes' } },
      },
      nextBaseline: {
        answers: {
          q9: { value: 'baseline-keep' },
          q2: { value: 'baseline-2' },
        },
        importance: { q2: 2 },
        conviction: { q2: 3 },
        additionalComments: { q2: { value: 'baseline-2-notes' } },
      },
      changed: true,
      baselineChanged: true,
    });

    expect(cloneBaseline).toHaveBeenCalledTimes(1);
    expect(applyDraftEntryToSlice).toHaveBeenCalledTimes(2);
  });

  it('returns unchanged slices when no rendered ids or draft entries apply', () => {
    const applyDraftEntryToSlice = jest.fn();

    expect(buildDraftHydrationState({
      renderedQuestionIds: [],
      draft: null,
      prevSlice: null,
      prevBaseline: null,
      allowOverwrite: false,
      cloneBaseline: null,
      applyDraftEntryToSlice,
    })).toEqual({
      nextSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      nextBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      changed: false,
      baselineChanged: false,
    });

    expect(applyDraftEntryToSlice).not.toHaveBeenCalled();
  });
});
