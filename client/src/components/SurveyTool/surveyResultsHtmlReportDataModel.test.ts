import {
  buildSurveyResultsHtmlReportAnswersForExport,
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
            responses: [{ questionID: 'Q1' }, { questionId: 'q2' }, { questionId: ' ' }],
          },
        },
        {
          responder: { address: '0x222' },
          response: JSON.stringify({
            responses: [{ questionID: 'q1' }],
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
      q1: [{ responder: '0xAAA' }, { responder: { address: '0xbbb' } }],
      q2: [{ responder: { walletAddress: '0xAAA' } }],
      q3: 'not rows',
    };

    expect(
      Array.from(
        buildSurveyResultsHtmlReportResponseCountsByQuestion({
          aggregatorQuestionResponses,
        }).entries(),
      ),
    ).toEqual([
      ['q1', 2],
      ['q2', 1],
      ['q3', 0],
    ]);

    expect(
      buildSurveyResultsHtmlReportParticipantCount({
        aggregatorQuestionResponses,
      }),
    ).toBe(2);
  });

  it('counts unique survey-individual responders without parsing payloads', () => {
    expect(
      buildSurveyResultsHtmlReportParticipantCount({
        filteredResponses: [
          { responder: '0xAAA' },
          { responder: { address: '0xaaa' } },
          { responder: { walletAddress: '0xbbb' } },
          { responder: {} },
        ],
        surveyViewMode: 'individuals',
        viewMode: 'survey',
      }),
    ).toBe(2);
  });

  it('builds report question rows with normalized labels and response counts', () => {
    expect(
      buildSurveyResultsHtmlReportQuestionsForExport({
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
      }),
    ).toEqual([
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

it('passes a rating question’s scale on to the report', () => {
  const scale = { min: 0, max: 10, step: 2, minLabel: 'Never', maxLabel: 'Always' };
  const [rating, binary] = buildSurveyResultsHtmlReportQuestionsForExport({
    filteredQuestions: [
      { id: 'q1', prompt: 'How often?', type: 'rating', scale },
      { id: 'q2', prompt: 'Agree?', type: 'binary' },
    ],
  });
  expect(rating.scale).toEqual(scale);
  expect(binary).not.toHaveProperty('scale');
});

describe('report answers', () => {
  const responder = '0x1111111111111111111111111111111111111111';
  const other = '0x2222222222222222222222222222222222222222';
  const row = (questionId: string, fields: Record<string, unknown>, who = responder, timestamp = 1) => ({
    responder: who,
    timestamp,
    response: { questionID: questionId, timestamp, ...fields },
  });

  it('reads what the Results view shows for each question type', () => {
    expect(
      buildSurveyResultsHtmlReportAnswersForExport({
        aggregatorQuestionResponses: {
          free: [row('free', { answer: { value: ' My view ' }, additional: { value: ' A note ' }, conviction: 7 })],
          pick: [row('pick', { answer: { value: ['One', 'Two'] } })],
          rate: [row('rate', { answer: { value: 8 } })],
          vote: [row('vote', { answer: { value: [2, -1] } })],
        },
        networkQuestions: {
          free: { type: 'freeform', prompt: 'Why?' },
          pick: { type: 'multichoice', prompt: 'Which?', options: ['One', 'Two'] },
          rate: { type: 'rating', prompt: 'How much?' },
          vote: { type: 'quadratic', prompt: 'Allocate', options: ['A', 'B'], voiceCredits: 9 },
        },
      }),
    ).toEqual([
      { questionId: 'free', responder, answer: 'My view', comment: 'A note', conviction: 7 },
      { questionId: 'pick', responder, answer: 'One; Two', comment: '' },
      { questionId: 'rate', responder, answer: '8', comment: '' },
      { questionId: 'vote', responder, answer: 'A: +2; B: -1', comment: '' },
    ]);
  });

  it('takes each responder’s latest answer, as the Results view does', () => {
    expect(
      buildSurveyResultsHtmlReportAnswersForExport({
        aggregatorQuestionResponses: {
          q1: [
            row('q1', { answer: { value: 'First' } }, responder, 1),
            row('q1', { answer: { value: 'Changed' } }, responder, 2),
            row('q1', { answer: { value: 'Theirs' } }, other, 1),
          ],
        },
      }).map(({ answer }) => answer),
    ).toEqual(['Changed', 'Theirs']);
  });

  it('reads individual survey responses in that view', () => {
    expect(
      buildSurveyResultsHtmlReportAnswersForExport({
        applyDecryptedOverride: (response, _responder, _questionId, surveyId) => {
          // The Results view looks up what was decrypted under the row's own survey.
          expect(surveyId).toBe('s1');
          return response;
        },
        filteredResponses: [
          { responder, surveyId: 's1', response: { responses: [{ questionID: 'q1', answer: { value: 'Agree' } }] } },
        ],
        surveyViewMode: 'individuals',
        viewMode: 'survey',
      }),
    ).toEqual([{ questionId: 'q1', responder, answer: 'Agree', comment: '' }]);
  });

  it('leaves out locked answers and the answers to a question this reader can’t read', () => {
    expect(
      buildSurveyResultsHtmlReportAnswersForExport({
        aggregatorQuestionResponses: {
          locked: [
            row('locked', { answer: { encrypted: true, value: '*' }, additional: { encrypted: true, value: '*' } }),
          ],
          masked: [row('masked', { answer: { value: 'Agree' } })],
        },
        networkQuestions: { masked: { type: 'binary', prompt: '[encrypted]' } },
      }),
    ).toEqual([]);
  });

  it('shows what this reader decrypted through the override port', () => {
    expect(
      buildSurveyResultsHtmlReportAnswersForExport({
        aggregatorQuestionResponses: {
          q1: [row('q1', { answer: { encrypted: true, value: '*' }, conviction: { encrypted: true, value: '*' } })],
        },
        applyDecryptedOverride: (response) => ({
          ...(response as Record<string, unknown>),
          answer: { encrypted: true, value: 'Disagree' },
          conviction: 4,
        }),
      }),
    ).toEqual([{ questionId: 'q1', responder, answer: 'Disagree', comment: '', conviction: 4 }]);
  });
});
