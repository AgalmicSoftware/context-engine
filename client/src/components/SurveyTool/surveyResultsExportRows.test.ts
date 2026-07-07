import {
  buildSurveyResultsFilteredQuestionIdsForExport,
  buildSurveyResultsFilteredQuestionsForExport,
} from './surveyResultsExportRows';

describe('surveyResultsExportRows', () => {
  it('builds filtered question ids from aggregate buckets and parsed survey responses', () => {
    const parseResponse = jest.fn((response) => response as any);
    const getResponseQuestionId = jest.fn((response) =>
      String(response?.questionID || response?.questionId || '').trim(),
    );

    expect(
      buildSurveyResultsFilteredQuestionIdsForExport({
        aggregatorQuestionResponses: {
          ' Q1 ': [{ response: {} }],
          '': [{ response: {} }],
        },
        filteredResponses: [
          {
            response: {
              responses: [{ questionID: ' Q2 ' }, { questionId: 'q3' }, { questionID: '' }],
            },
          },
          {
            response: {
              responses: [{ questionID: 'Q2' }],
            },
          },
        ],
        getResponseQuestionId,
        parseResponse,
      }),
    ).toEqual(['q1', 'q2', 'q3']);

    expect(parseResponse).toHaveBeenCalledTimes(2);
    expect(getResponseQuestionId).toHaveBeenCalledTimes(4);
  });

  it('builds cloned filtered question export rows with stable fallbacks', () => {
    const tags = ['segment-a'];
    const options = ['Yes', 'No'];

    const rows = buildSurveyResultsFilteredQuestionsForExport({
      questionIds: ['q1', 'Q2', 'q3'],
      networkQuestions: {
        q1: {
          id: 'Question-1',
          options,
          prompt: 'First prompt',
          tags,
          type: 'binary',
        },
        Q2: {
          prompt: 'Second prompt',
        },
      },
    });

    expect(rows).toEqual([
      {
        id: 'Question-1',
        options: ['Yes', 'No'],
        prompt: 'First prompt',
        tags: ['segment-a'],
        type: 'binary',
      },
      {
        id: 'Q2',
        options: [],
        prompt: 'Second prompt',
        tags: [],
        type: '',
      },
      {
        id: 'q3',
        options: [],
        prompt: '',
        tags: [],
        type: '',
      },
    ]);
    expect(rows[0].tags).not.toBe(tags);
    expect(rows[0].options).not.toBe(options);
  });
});
