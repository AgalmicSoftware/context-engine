import { buildSurveyResultsLockedRows } from './surveyResultsLockedResponsesModel';

describe('surveyResultsLockedResponsesModel', () => {
  const isLockedField = (field: unknown): boolean =>
    !!field && typeof field === 'object' && (field as { locked?: boolean }).locked === true;

  it('builds survey-individual locked rows with normalized identity and overrides', () => {
    const keyArgs: unknown[] = [];
    const rows = buildSurveyResultsLockedRows({
      applyDecryptedOverrideToResponse: ({ key, response }) =>
        key.includes('q1') ? { ...response, answer: { locked: true, value: 'override' } } : response,
      getLockedResponseKey: (args) => {
        keyArgs.push(args);
        return `${args.surveyId}:${args.questionId}:${args.responder}`;
      },
      isBannerEligibleLockedField: isLockedField,
      sbtFilteredResponses: [
        {
          responder: ' 0xAAA ',
          surveyId: ' SURVEY-1 ',
          response: {
            responses: [
              { answer: { locked: false }, questionID: ' Q1 ' },
              { answer: { locked: false }, additional: { locked: false }, questionId: 'q2' },
              { answer: { locked: true }, questionId: '' },
            ],
          },
        },
      ],
      surveyId: 'fallback-survey',
      surveyViewMode: 'individuals',
      viewMode: 'survey',
    });

    expect(rows).toEqual([
      {
        key: 'survey-1:q1:0xaaa',
        mergedResponse: {
          answer: { locked: true, value: 'override' },
          questionID: ' Q1 ',
        },
        questionId: 'q1',
        responder: '0xaaa',
        response: {
          answer: { locked: false },
          questionID: ' Q1 ',
        },
        surveyId: 'survey-1',
      },
    ]);
    expect(keyArgs).toEqual([
      {
        questionId: 'q1',
        responder: '0xaaa',
        response: {
          answer: { locked: false },
          questionID: ' Q1 ',
        },
        surveyId: 'survey-1',
      },
      {
        questionId: 'q2',
        responder: '0xaaa',
        response: {
          additional: { locked: false },
          answer: { locked: false },
          questionId: 'q2',
        },
        surveyId: 'survey-1',
      },
    ]);
  });

  it('builds aggregate locked rows from question buckets', () => {
    const rows = buildSurveyResultsLockedRows({
      aggregatorQuestionResponses: {
        q1: [
          { responder: '0xAAA', response: { additional: { locked: true } } },
          { responder: '0xBBB', response: { answer: { locked: false } } },
        ],
        q2: 'not rows',
      },
      getLockedResponseKey: ({ surveyId, questionId, responder }) => `${surveyId}:${questionId}:${responder}`,
      isBannerEligibleLockedField: isLockedField,
      surveyId: 'survey-2',
      surveyViewMode: 'aggregate',
      viewMode: 'survey',
    });

    expect(rows).toEqual([
      {
        key: 'survey-2:q1:0xaaa',
        mergedResponse: {
          additional: { locked: true },
        },
        questionId: 'q1',
        responder: '0xaaa',
        response: {
          additional: { locked: true },
        },
        surveyId: 'survey-2',
      },
    ]);
  });
});
