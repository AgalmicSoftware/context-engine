import {
  buildSurveyResultsAnalysisResponsesForExport,
  readSurveyResultsAnalysisTextField,
} from './surveyResultsAnalysisDataModel';

describe('surveyResultsAnalysisDataModel', () => {
  it('normalizes analysis text fields from primitive and envelope-like values', () => {
    expect(readSurveyResultsAnalysisTextField(' Alpha ')).toBe('Alpha');
    expect(readSurveyResultsAnalysisTextField({ value: ' Beta ' })).toBe('Beta');
    expect(readSurveyResultsAnalysisTextField({ text: ' Gamma ' })).toBe('Gamma');
    expect(readSurveyResultsAnalysisTextField({ answer: ' Delta ' })).toBe('Delta');
    expect(readSurveyResultsAnalysisTextField({ value: '*' })).toBe('');
    expect(readSurveyResultsAnalysisTextField({ value: { nested: true } })).toBe('');
  });

  it('builds survey-individual response rows from parsed response payloads', () => {
    const rows = buildSurveyResultsAnalysisResponsesForExport({
      filteredResponses: [
        {
          responder: '0x111',
          response: {
            responses: [
              { answer: { value: 'Yes' }, questionID: 'Q1' },
              { additional: { text: 'Because' }, questionId: 'q2' },
              { answer: { value: '*' }, questionId: 'q3' },
            ],
          },
        },
        {
          responder: '0x222',
          response: JSON.stringify({
            responses: [
              { answer: 'Maybe', questionID: 'Q1' },
            ],
          }),
        },
      ],
      networkQuestions: {
        q1: { prompt: 'Question one', type: 'binary' },
        q2: { prompt: 'Question two', questionType: 'freeform' },
      },
      surveyViewMode: 'individuals',
      viewMode: 'survey',
    });

    expect(rows).toEqual([
      {
        additional: '',
        answer: 'Yes',
        participantAddress: '0x111',
        questionId: 'Q1',
        questionPrompt: 'Question one',
        questionType: 'binary',
      },
      {
        additional: 'Because',
        answer: '',
        participantAddress: '0x111',
        questionId: 'q2',
        questionPrompt: 'Question two',
        questionType: 'freeform',
      },
      {
        additional: '',
        answer: 'Maybe',
        participantAddress: '0x222',
        questionId: 'Q1',
        questionPrompt: 'Question one',
        questionType: 'binary',
      },
    ]);
  });

  it('builds aggregate response rows using bucket question fallbacks', () => {
    const rows = buildSurveyResultsAnalysisResponsesForExport({
      aggregatorQuestionResponses: {
        q1: [
          { responder: '0xAAA', response: { answer: { value: 'Agree' } } },
          { responder: '0xBBB', response: JSON.stringify({ additional: 'Notes' }) },
          { responder: '0xCCC', response: { answer: { value: '*' } } },
        ],
        q2: 'not rows',
      },
      networkQuestions: {
        q1: { prompt: 'Prompt one', type: 'rating' },
      },
    });

    expect(rows).toEqual([
      {
        additional: '',
        answer: 'Agree',
        participantAddress: '0xAAA',
        questionId: 'q1',
        questionPrompt: 'Prompt one',
        questionType: 'rating',
      },
      {
        additional: 'Notes',
        answer: '',
        participantAddress: '0xBBB',
        questionId: 'q1',
        questionPrompt: 'Prompt one',
        questionType: 'rating',
      },
    ]);
  });

  it('uses injected parse and question metadata ports without owning lookup semantics', () => {
    const rows = buildSurveyResultsAnalysisResponsesForExport({
      aggregatorQuestionResponses: {
        fallback: [
          { responder: '0xAAA', response: 'raw-response' },
        ],
      },
      getResponseQuestionId: () => 'custom-id',
      getResponseQuestionPrompt: (_response, questionData) => questionData?.prompt,
      getResponseQuestionType: (_response, questionData) => questionData?.type,
      networkQuestions: {
        'custom-id': { prompt: 'Custom prompt', type: 'custom-type' },
      },
      parseResponse: () => ({ answer: 'custom answer' }),
    });

    expect(rows).toEqual([
      {
        additional: '',
        answer: 'custom answer',
        participantAddress: '0xAAA',
        questionId: 'custom-id',
        questionPrompt: 'Custom prompt',
        questionType: 'custom-type',
      },
    ]);
  });
});
