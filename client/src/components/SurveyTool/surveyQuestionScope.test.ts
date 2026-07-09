import {
  buildInitialSurveyResponseQuestionIds,
  buildRenderedQuestionIdsFromPileWindow,
  buildRenderedQuestionIdsFromQuestionPools,
  readRenderedQuestionIds,
} from './surveyQuestionScope.js';

describe('surveyQuestionScope', () => {
  it('builds deduped rendered ids from question and pile pools', () => {
    expect(
      buildRenderedQuestionIdsFromQuestionPools({
        questionPool: [{ id: '' }, { id: 'q1' }, { id: 0 }, { id: 'q2' }],
        pileQuestions: [{ id: null }, { id: 'q2' }, { id: 'q3' }],
      }),
    ).toEqual(['q1', 'q2', 'q3']);
  });

  it('reads rendered question ids and optionally normalizes them', () => {
    const getRenderedQuestionIds = jest.fn(() => ['Q1', 'q1', '', 'q2']);
    const normalizeRenderedIds = jest.fn(({ renderedIds }) =>
      renderedIds
        .map((id: unknown) =>
          String(id || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );

    expect(
      readRenderedQuestionIds({
        getRenderedQuestionIds,
      }),
    ).toEqual(['Q1', 'q1', '', 'q2']);

    expect(
      readRenderedQuestionIds({
        getRenderedQuestionIds,
        normalizeRenderedIds,
      }),
    ).toEqual(['q1', 'q1', 'q2']);

    expect(getRenderedQuestionIds).toHaveBeenCalledTimes(2);
    expect(normalizeRenderedIds).toHaveBeenCalledWith({
      renderedIds: ['Q1', 'q1', '', 'q2'],
    });
  });

  it('builds the visible pile window around the active question', () => {
    expect(
      buildRenderedQuestionIdsFromPileWindow({
        pileQuestions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }, { id: 'q6' }],
        activePileIndex: 3,
      }),
    ).toEqual(['q2', 'q3', 'q4', 'q5', 'q6']);
  });

  it('clamps invalid pile-window inputs to the available range', () => {
    expect(
      buildRenderedQuestionIdsFromPileWindow({
        pileQuestions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }],
        activePileIndex: -5,
        visibleBefore: -1,
        visibleAfter: '2',
      }),
    ).toEqual(['q1', 'q2', 'q3']);

    expect(
      buildRenderedQuestionIdsFromPileWindow({
        pileQuestions: null,
        activePileIndex: 2,
      }),
    ).toEqual([]);
  });

  it('builds initial response-state question ids for single-question and standalone flows', () => {
    const getRenderedQuestionIds = jest.fn(() => ['q2', 'q3']);

    expect(
      buildInitialSurveyResponseQuestionIds({
        singleQuestionMode: true,
        questionPoolIds: ['q1'],
        questionId: 'fallback',
        getRenderedQuestionIds,
      }),
    ).toEqual(['q1']);

    expect(getRenderedQuestionIds).not.toHaveBeenCalled();

    expect(
      buildInitialSurveyResponseQuestionIds({
        singleQuestionMode: false,
        isStandalone: true,
        questionPoolIds: [],
        getRenderedQuestionIds,
      }),
    ).toEqual(['q2', 'q3']);
  });

  it('builds initial response-state question ids for full survey mode from rendered ids first, then state pool', () => {
    expect(
      buildInitialSurveyResponseQuestionIds({
        singleQuestionMode: false,
        isStandalone: false,
        getRenderedQuestionIds: () => ['q2', 'q3'],
        stateQuestionPool: [{ id: 'q4' }],
      }),
    ).toEqual(['q2', 'q3']);

    expect(
      buildInitialSurveyResponseQuestionIds({
        singleQuestionMode: false,
        isStandalone: false,
        getRenderedQuestionIds: () => [],
        stateQuestionPool: [{ id: 'q4' }, { id: 'q5' }],
      }),
    ).toEqual(['q4', 'q5']);
  });
});
