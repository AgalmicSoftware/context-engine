import {
  buildSurveyResultsQuestionTableEntries,
  buildSurveyResultsFreeformSummaryModel,
  buildSurveyResultsMultichoiceSummaryModel,
  getSurveyResultsLatestResponsesByResponder,
  resolveSurveyResultsSummaryQuestionType,
} from './surveyResultsSummaryModels';

describe('surveyResultsSummaryModels', () => {
  it('resolves question type from metadata and response fallbacks', () => {
    expect(resolveSurveyResultsSummaryQuestionType({ type: 'Text' }, [])).toBe('freeform');
    expect(resolveSurveyResultsSummaryQuestionType(null, [{ response: { questionType: 'Multichoice' } }])).toBe(
      'multichoice',
    );
    expect(resolveSurveyResultsSummaryQuestionType(null, [])).toBe('');
  });

  it('keeps the latest response for each responder', () => {
    const rows = [
      {
        responder: '0xA',
        response: { answer: { value: 'old' } },
        timestamp: '2025-01-01T00:00:00.000Z',
      },
      {
        responder: '0xa',
        response: { answer: { value: 'new' } },
        timestamp: '2025-01-02T00:00:00.000Z',
      },
      {
        responder: '0xB',
        response: { answer: { value: 'only' } },
        timestamp: '2025-01-01T00:00:00.000Z',
      },
    ];

    expect(getSurveyResultsLatestResponsesByResponder(rows)).toEqual([rows[1], rows[2]]);
  });

  it('builds sorted question-table entries from network metadata and latest responders', () => {
    const entries = buildSurveyResultsQuestionTableEntries({
      questionMap: {
        Q1: [
          {
            responder: '0xaaa',
            response: { answer: { value: 'old' } },
            timestamp: '2025-01-01T00:00:00.000Z',
          },
          {
            responder: '0xaaa',
            response: { answer: { value: 'new' } },
            timestamp: '2025-01-02T00:00:00.000Z',
          },
          {
            responder: '0xbbb',
            response: { answer: { value: 'only' } },
            timestamp: '2025-01-01T00:00:00.000Z',
          },
        ],
        q2: [
          {
            responder: '0xccc',
            response: { answer: { value: 'other' } },
            timestamp: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
      networkQuestions: {
        q1: {
          prompt: 'First prompt',
          sessionSlug: 'alpha',
          type: 'freeform',
        },
        q2: {
          prompt: 'Second prompt',
          sessionSlug: 'beta',
          type: 'binary',
        },
      },
      sortAsc: true,
      sortBy: 'responses',
    });

    expect(entries).toEqual([
      {
        questionId: 'q2',
        prompt: 'Second prompt',
        responsesCount: 1,
        sessionSlug: 'beta',
        type: 'binary',
      },
      {
        questionId: 'Q1',
        prompt: 'First prompt',
        responsesCount: 2,
        sessionSlug: 'alpha',
        type: 'freeform',
      },
    ]);
  });

  it('builds freeform display models from latest nonblank responses', () => {
    const summary = buildSurveyResultsFreeformSummaryModel([
      {
        responder: '0xA',
        response: {
          answer: { value: 'Old answer' },
        },
        timestamp: '2025-01-01T00:00:00.000Z',
      },
      {
        responder: '0xA',
        response: {
          answer: { value: 'Current answer' },
          additional: { value: { note: 'structured' } },
        },
        timestamp: '2025-01-02T00:00:00.000Z',
      },
      {
        responder: '0xB',
        response: {
          answer: { encrypted: true, value: '*' },
        },
        timestamp: '2025-01-01T00:00:00.000Z',
      },
      {
        responder: '0xC',
        response: {
          answer: { value: '' },
        },
        timestamp: '2025-01-01T00:00:00.000Z',
      },
    ]);

    expect(summary.totalResponses).toBe(2);
    expect(summary.encryptedCount).toBe(1);
    expect(summary.blankCount).toBe(1);
    expect(summary.displayedResponses).toEqual([
      {
        responder: '0xA',
        value: 'Current answer',
        additional: '{"note":"structured"}',
      },
    ]);
  });

  it('builds multichoice option counts from latest responder picks', () => {
    const summary = buildSurveyResultsMultichoiceSummaryModel(
      [
        {
          responder: '0xA',
          response: { answer: { value: ['Alpha'] } },
          timestamp: '2025-01-01T00:00:00.000Z',
        },
        {
          responder: '0xA',
          response: { answer: { value: ['Alpha', 'Beta'] } },
          timestamp: '2025-01-02T00:00:00.000Z',
        },
        {
          responder: '0xB',
          response: { answer: { value: ['Beta'] } },
          timestamp: '2025-01-01T00:00:00.000Z',
        },
        {
          responder: '0xC',
          response: { answer: { encrypted: true, value: ['Alpha'] } },
          timestamp: '2025-01-01T00:00:00.000Z',
        },
      ],
      {
        options: ['Alpha', { label: 'Beta' }, { value: 'Gamma' }],
      },
    );

    expect(summary.totalResponders).toBe(2);
    expect(summary.options).toEqual([
      { key: 'alpha', label: 'Alpha', count: 1 },
      { key: 'beta', label: 'Beta', count: 2 },
      { key: 'gamma', label: 'Gamma', count: 0 },
    ]);
  });
});
