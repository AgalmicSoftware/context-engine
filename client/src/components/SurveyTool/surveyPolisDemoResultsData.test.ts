import demoPolisData from '../../variables/demo/demo_polis_data.json';
import {
  buildPolisDemoSurveyResultsAggregatorData,
  buildPolisDemoSurveyResultsNetworkData,
} from './surveyPolisDemoResultsData.js';

const countQuestionResponses = (questionResponses: Record<string, Record<string, unknown>>): number =>
  Object.values(questionResponses).reduce((sum, responders) => sum + Object.keys(responders || {}).length, 0);

const binaryCommentIndexes = new Set(
  demoPolisData.comments
    .map((comment, index) => ({ index, type: String(comment.type) }))
    .filter(({ type }) => type === 'binary')
    .map(({ index }) => index),
);

describe('surveyPolisDemoResultsData', () => {
  it('normalizes the canonical Polis demo comments and votes into question-results cache data', () => {
    const data = buildPolisDemoSurveyResultsNetworkData();
    const expectedVoteCount = demoPolisData.participantsVotes.reduce(
      (sum, participant) =>
        sum + Object.keys(participant.votes || {}).filter((voteIndex) => binaryCommentIndexes.has(Number(voteIndex))).length,
      0,
    );

    expect(Object.keys(data.questions)).toHaveLength(42);
    expect(countQuestionResponses(data.questionResponses)).toBe(expectedVoteCount);
    expect(countQuestionResponses(data.questionResponses)).toBeGreaterThan(0);

    const firstQuestionId = String(demoPolisData.comments[0].commentId).toLowerCase();
    expect(data.questions[firstQuestionId]).toEqual(
      expect.objectContaining({
        id: firstQuestionId,
        prompt: demoPolisData.comments[0].commentBody,
        type: 'binary',
        questionType: 'binary',
        sessionSlug: 'demo',
        sessionSlugExplicit: true,
        source: 'demo-polis-data',
        options: ['Agree', 'Unsure', 'Disagree'],
      }),
    );

    const firstQuestionResponses = Object.values(data.questionResponses[firstQuestionId] || {});
    expect(firstQuestionResponses.length).toBeGreaterThan(0);
    expect(firstQuestionResponses[0]).toEqual(
      expect.objectContaining({
        type: 'binary',
        questionId: firstQuestionId,
        questionID: firstQuestionId,
        answer: expect.objectContaining({
          encrypted: false,
        }),
        source: 'demo-polis-data',
      }),
    );
    expect(['Agree', 'Unsure', 'Disagree']).toContain(
      (firstQuestionResponses[0] as { answer?: { value?: unknown } })?.answer?.value,
    );
  });

  it('does not reinterpret tri-state sentiment as typed answers', () => {
    const data = buildPolisDemoSurveyResultsNetworkData();

    demoPolisData.comments.forEach((comment) => {
      const questionId = String(comment.commentId).toLowerCase();
      const question = data.questions[questionId] as Record<string, unknown>;
      const commentType = String(comment.type);

      if (commentType === 'binary') {
        expect(question).toMatchObject({
          type: 'binary',
          options: ['Agree', 'Unsure', 'Disagree'],
        });
        return;
      }

      expect(Object.keys(data.questionResponses[questionId] || {})).toHaveLength(0);
      if (commentType === 'poll') {
        expect(question).toMatchObject({
          type: 'multichoice',
          options: (comment as { options?: string[] }).options,
        });
      } else {
        expect(['rating', 'freeform']).toContain(question.type);
        expect(question.options).toBeUndefined();
      }
    });
  });

  it('stamps an explicit session slug when callers need a non-default demo bucket', () => {
    const data = buildPolisDemoSurveyResultsNetworkData(
      {
        comments: [
          {
            commentId: '0xABC',
            commentBody: 'Fixture question',
            type: 'binary',
          },
        ],
        participantsVotes: [
          {
            participant: '0x123',
            votes: { 0: 1 },
          },
        ],
      },
      { sessionSlug: 'demo-source' },
    );

    expect(data.questions['0xabc']).toEqual(
      expect.objectContaining({
        id: '0xabc',
        prompt: 'Fixture question',
        sessionSlug: 'demo-source',
        sessionSlugExplicit: true,
      }),
    );
    expect(data.questionResponses['0xabc']['0x123']).toEqual(
      expect.objectContaining({
        answer: { value: 'Agree', encrypted: false },
      }),
    );
  });

  it('normalizes canonical demo votes into Polis report aggregator rows', () => {
    const aggregator = buildPolisDemoSurveyResultsAggregatorData();
    const firstQuestionId = String(demoPolisData.comments[0].commentId).toLowerCase();
    const firstRows = aggregator[firstQuestionId] || [];

    expect(Object.keys(aggregator)).toHaveLength(binaryCommentIndexes.size);
    expect(firstRows.length).toBeGreaterThan(0);
    expect(firstRows[0]).toEqual(
      expect.objectContaining({
        responder: expect.any(String),
        questionId: firstQuestionId,
        response: expect.any(String),
      }),
    );
    const parsed = JSON.parse(firstRows[0].response);
    expect(['Agree', 'Unsure', 'Disagree']).toContain(parsed?.answer?.value);
  });
});
