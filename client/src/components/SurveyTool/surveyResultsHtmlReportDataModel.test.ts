import {
  buildSurveyResultsHtmlReportParticipantCount,
  buildSurveyResultsHtmlReportQuestionsForExport,
  buildSurveyResultsHtmlReportResponseCountsByQuestion,
} from './surveyResultsHtmlReportDataModel';

describe('surveyResultsHtmlReportDataModel', () => {
  it('counts survey-individual responses by parsed question ID', () => {
    const counts = buildSurveyResultsHtmlReportResponseCountsByQuestion({
      filteredResponses: [
        {
          responder: '0x111',
          response: {
            responses: [
              { questionID: 'Q1' },
              { questionId: 'q2' },
              { questionId: ' ' },
            ],
          },
        },
        {
          responder: { address: '0x222' },
          response: JSON.stringify({
            responses: [
              { questionID: 'q1' },
            ],
          }),
        },
      ],
      surveyViewMode: 'individuals',
      viewMode: 'survey',
    });

    expect(Array.from(counts.entries())).toEqual([
      ['q1', 2],
      ['q2', 1],
    ]);
  });

  it('counts aggregate rows and unique participants from response buckets', () => {
    const aggregatorQuestionResponses = {
      q1: [
        { responder: '0xAAA' },
        { responder: { address: '0xbbb' } },
      ],
      q2: [
        { responder: { walletAddress: '0xAAA' } },
      ],
      q3: 'not rows',
    };

    expect(Array.from(buildSurveyResultsHtmlReportResponseCountsByQuestion({
      aggregatorQuestionResponses,
    }).entries())).toEqual([
      ['q1', 2],
      ['q2', 1],
      ['q3', 0],
    ]);

    expect(buildSurveyResultsHtmlReportParticipantCount({
      aggregatorQuestionResponses,
    })).toBe(2);
  });

  it('counts unique survey-individual responders without parsing payloads', () => {
    expect(buildSurveyResultsHtmlReportParticipantCount({
      filteredResponses: [
        { responder: '0xAAA' },
        { responder: { address: '0xaaa' } },
        { responder: { walletAddress: '0xbbb' } },
        { responder: {} },
      ],
      surveyViewMode: 'individuals',
      viewMode: 'survey',
    })).toBe(2);
  });

  it('builds report question rows with normalized labels and response counts', () => {
    expect(buildSurveyResultsHtmlReportQuestionsForExport({
      filteredQuestions: [
        {
          id: ' Q1 ',
          options: [' Alpha ', '', 'Beta'],
          prompt: ' Prompt one ',
          tags: [' tag-a ', '', 'tag-b'],
          type: ' multichoice ',
        },
      ],
      responseCountsByQuestion: new Map([['q1', 3]]),
    })).toEqual([
      {
        id: 'Q1',
        options: ['Alpha', 'Beta'],
        prompt: 'Prompt one',
        responseCount: 3,
        tags: ['tag-a', 'tag-b'],
        type: 'multichoice',
      },
    ]);
  });
});
